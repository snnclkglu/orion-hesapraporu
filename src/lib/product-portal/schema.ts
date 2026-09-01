// VİNÇ KİMLİĞİ — SUNUCU EYLEMLERİNİN GİRDİ SÖZLEŞMESİ (SAF).
//
// NEDEN AYRI DOSYA: bu şemalar `actions.ts` içinde yaşıyordu ve `actions.ts`
// `"use server"` taşır — yani `next/headers`, Supabase sunucu istemcisi ve
// `server-only` işaretli materyalizasyon modülünü içeri alır. Testten import
// EDİLEMEZ. Bedeli teoriye kalmadı: `overrides` alanı Zod 4'te tükenmiş bir
// `z.record` olarak yazıldığı için "Taslağı Kaydet" HİÇBİR KOŞULDA çalışmıyordu
// (boş `overrides` → 14 hata) ve bunu yakalayacak tek bir sınama yoktu.
//
// Şema burada saftır: yalnız `zod` ve kendi sabitlerimiz. `actions.ts` onu
// YENİDEN DIŞA AKTARMAZ, doğrudan kullanır; test de aynı nesneyi kullanır.

import { z } from "zod";
import {
  PORTAL_FOLDER_OPTIONS,
  PORTAL_REPORT_LEVELS,
  PORTAL_SOURCE_KINDS,
  PRODUCT_IDENTITY_FIELDS,
} from "./types";

export const UUID = z.string().uuid();

const accessMode = z.enum(["view_watermarked", "download"]);
const sourceKind = z.enum(PORTAL_SOURCE_KINDS);
const identityField = z.enum(PRODUCT_IDENTITY_FIELDS);
const reportLevel = z.enum(PORTAL_REPORT_LEVELS);

/**
 * KLASÖR ANAHTARI LİSTEYE ÜYE OLMAK ZORUNDADIR — desene uyması yetmez.
 *
 * Önceki hâli `z.string().regex(/^[a-z0-9-]{1,40}$/)` idi; yani
 * `PORTAL_FOLDER_OPTIONS` içinde olmayan bir anahtar da kaydedilebiliyordu.
 * Bedeli SESSİZDİ: kart klasörü `<Select value={folderKey}>` ile gösterir ve
 * seçeneklerde karşılığı olmayan bir değerde kutu BOŞ görünür — kullanıcı
 * belgenin hangi klasöre gideceğini göremeden yayımlıyordu (kullanıcı
 * bildirimi, 30.08.2026: üç belgenin ikisinde Klasör boştu). Eski kayıtları
 * `identity.ts:withProductPortalDefaults` "Diğer Belgeler"e düşürür.
 */
const folderKey = z.enum(
  PORTAL_FOLDER_OPTIONS.map((folder) => folder.key) as [string, ...string[]]
);

export const documentSchema = z.object({
  id: z.string().min(1).max(120),
  sourceKind,
  sourceId: z.string().min(1).max(500),
  sourceLabel: z.string().max(240),
  sourceRevisionLabel: z.string().max(80),
  reportLevel: reportLevel.optional(),
  equipmentDetail: z.enum(["standart", "detayli"]).optional(),
  title: z.string().trim().min(1).max(180),
  folderKey,
  folderTitle: z.string().trim().min(1).max(100),
  folderSort: z.number().int().min(0).max(10000),
  fileSort: z.number().int().min(0).max(10000),
  accessMode,
  included: z.boolean(),
  automatic: z.boolean(),
  ready: z.boolean(),
  unavailableReason: z.string().max(240).optional(),
});

export const saveSchema = z.object({
  projectId: UUID,
  revisionId: UUID,
  serialBase: z.string().trim().min(1).max(80),
  /*
   * CE VE TEK RENK ANAHTARLARI DA ŞEMADADIR.
   *
   * Zod bilinmeyen anahtarı SESSİZCE ATAR: kart `plate.ceMark`i gönderiyordu
   * ama şemada karşılığı olmadığı için doğrulamadan sonra yok oluyor ve
   * `plate: data.plate` eksik nesneyi yazıyordu. Kullanıcı "CE İşareti"
   * onayını kapatıp kaydetse bile sayfa yenilenince işaret geri geliyordu —
   * yani BELGE-3'ün "kapatılabilir olması şarttır" kuralı pratikte hiç
   * çalışmıyordu. Uygunluk değerlendirmesi bitmemiş bir makineye CE basmak
   * eksik bir plakadan ağır bir hatadır.
   */
  plate: z.object({
    widthMm: z.number().min(120).max(1000),
    heightMm: z.number().min(80).max(1000),
    holeDiameterMm: z.number().positive().max(50).optional(),
    holeInsetMm: z.number().positive().max(100).optional(),
    ceMark: z.boolean().optional(),
    monochrome: z.boolean().optional(),
  }),
  /**
   * KISMİ KAYIT — `z.record` DEĞİL, `z.partialRecord`.
   *
   * `overrides` yalnız ELLE DEĞİŞTİRİLEN alanları taşır; kullanıcı hiçbir şeyi
   * elle yazmadıysa `{}` gelir (tasarım gereği: `identity.ts` "otomatiğe dön"
   * anahtarı SİLER). Zod 4'te enum anahtarlı `z.record` TÜKENMİŞTİR ve 14 alanın
   * hepsini ister — yani "Taslağı Kaydet" hiçbir koşulda çalışmıyordu: boş
   * `overrides` 14, tek override 13 hata veriyor ve kullanıcı İngilizce
   * "Invalid input: expected string, received undefined" toast'ı görüyordu
   * (kullanıcı bildirimi, 30.08.2026). Çağıran taraftaki `as Record<…>` cast'i
   * aynı hatayı tip düzeyinde de gizlemişti; cast kaldırıldı, tip artık kısmi.
   */
  overrides: z.partialRecord(identityField, z.string().max(180)),
  hiddenFields: z.array(identityField),
  portal: z.object({
    title: z.string().trim().min(1).max(100),
    note: z.string().max(600),
    supportEmail: z.union([z.literal(""), z.string().email().max(160)]),
  }),
  documents: z.array(documentSchema).max(500),
  units: z.array(z.object({ id: UUID, serialNo: z.string().trim().min(1).max(80) })).min(1).max(99),
});

export type SaveProductPortalDraftInput = z.input<typeof saveSchema>;

/**
 * ZOD MESAJI KULLANICIYA HAM GİTMEZ — hangi ALANIN reddedildiğini söyler.
 *
 * `issues[0].message` İngilizcedir ve yolu taşımaz; kullanıcı "Invalid input:
 * expected string, received undefined" görüp neyi düzelteceğini bilemiyordu.
 * Alan yolu Türkçe bir adla eşlenir; eşleşme yoksa yolun kendisi yazılır — hiçbir
 * durumda sessiz veya anlamsız bir hata kalmaz.
 */
const FIELD_PATH_LABELS: Record<string, string> = {
  serialBase: "Seri numarası kökü",
  plate: "Plaka ölçüsü",
  overrides: "Kimlik alanı",
  hiddenFields: "Plakada gösterilecek alanlar",
  portal: "Müşteri portalı metinleri",
  documents: "Doküman listesi",
  units: "Fiziksel üniteler",
  folderKey: "Klasör",
  folderTitle: "Klasör adı",
  title: "Belge adı",
  accessMode: "Erişim biçimi",
  supportEmail: "Destek e-postası",
  widthMm: "Plaka genişliği",
  heightMm: "Plaka yüksekliği",
  serialNo: "Seri numarası",
};

export function schemaError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Alanlar geçersiz.";
  const path = issue.path.map(String);
  const named = [...path].reverse().find((part) => FIELD_PATH_LABELS[part]);
  if (named) return `${FIELD_PATH_LABELS[named]}: değer geçersiz.`;
  const joined = path.join(" › ");
  return joined ? `${joined}: değer geçersiz.` : "Alanlar geçersiz.";
}
