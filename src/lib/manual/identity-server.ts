import "server-only";

// EL KİTABI KÜNYESİNİN OTOMATİK KAYNAĞI.
//
// Kullanıcı isteği (01.09.2026): *"Künye kısmı olabildiğince her şey otomatik
// gelsin. Bu bilgiler diğer bölümlerde var. Vinç Kimliği bölümünden de gereken
// bilgileri al."*
//
// İKİNCİ BİR ÇÖZÜCÜ YAZILMADI. Vinç Kimliği'nin `resolveAutomaticProductIdentity`
// fonksiyonu projeyi, iş emri kalemini, hesap raporu revizyonunun `specs`ini ve
// firma ayarlarını zaten okuyor; el kitabı künyesinin ondan farkı yalnız ALAN
// ADLARIDIR. İki çözücü olsaydı plakada "2026", kılavuzda "2025" yazan bir gün
// gelirdi — ve ikisi de aynı vincin belgesidir.
//
// ÜRETİCİ KÜNYESİ MÜŞTERİ DEFTERİNDEN gelir (`customers.is_self`); defterde
// işaretli kayıt yoksa uygulama ayarlarına düşülür. Kullanıcı isteği: *"kendi
// bilgilerimizi de buradan çeksin."*
//
// DEĞER SNAPSHOT'TIR, CANLI DEĞİL: çözülen alanlar payload'a YAZILIR (KITAP-2).
// Bu fonksiyon yalnız ÖNERİ üretir; neyin yazılacağına çağıran karar verir ve
// kullanıcının elle doldurduğu bir alan EZİLMEZ (KITAP-4: makine önerir, insan
// son sözü söyler).

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAutomaticProductIdentity } from "@/lib/product-portal/data-server";
import { withProductPortalDefaults } from "@/lib/product-portal/identity";
import { loadSelfCompany, type CustomerCompany } from "@/lib/customers/company-server";
import { resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { manualDocCode } from "./naming";
import type { ManualIdentity } from "./types";

/** `01.09.2026` — belgede okunan tarih biçimi. */
function bugun(): string {
  const d = new Date();
  const iki = (n: number) => String(n).padStart(2, "0");
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** `R01` — kılavuzun kendi revizyon etiketi, iş emrininki değil. */
export function manualRevisionLabel(revNo: number): string {
  return `R${String(Math.max(1, Number(revNo) || 1)).padStart(2, "0")}`;
}

export interface ManualIdentitySuggestion {
  /** Kaynaklardan çözülen künye; bilinmeyen alan BOŞ metindir. */
  values: ManualIdentity;
  /** Alan başına insan-okunur kaynak adı — editörde etiketin altında görünür. */
  sources: Partial<Record<keyof ManualIdentity, string>>;
  /** Üretici olarak kullanılan defter kaydı (varsa). */
  selfCompany: CustomerCompany | null;
}

/**
 * Projenin el kitabı künyesini kaynaklardan çözer.
 *
 * `revNo` verilirse doküman no ve revizyon etiketi ona göre üretilir; bunlar
 * revizyona bağlı olan TEK iki alandır ve her yeni sürümde kesin olarak
 * değişirler (eskiden elle güncellenmediği için V2 hâlâ "R01" yazıyordu).
 */
export async function resolveManualIdentity(
  supabase: SupabaseClient,
  projectId: string,
  revNo: number
): Promise<ManualIdentitySuggestion> {
  const bosPayload = withProductPortalDefaults(null);
  const [kimlik, kendiFirma, proje] = await Promise.all([
    resolveAutomaticProductIdentity(supabase, projectId, bosPayload),
    loadSelfCompany(supabase),
    supabase
      .from("projects")
      .select("id, doc_no, name")
      .eq("id", projectId)
      .maybeSingle(),
  ]);

  const v = kimlik.values;
  const kaynakEtiketi = new Map(kimlik.fields.map((f) => [f.key, f.source.label]));
  const docNo = String((proje.data as { doc_no?: string } | null)?.doc_no ?? "");
  const kalemNo = await resolveProjectItemNo(supabase, projectId, docNo);
  const numara = kalemNo || docNo;

  // ÜRETİCİ: önce defterdeki "kendi firmamız" kaydı, sonra rapor ayarları.
  // Defterdeki kayıt adres/vergi/telefonu birlikte taşır; ayarlardaki adres
  // seed'lenmemiş olabilir ve o hâlde plaka da kılavuz da adressiz kalırdı.
  const manufacturer = kendiFirma?.name || v.manufacturer;
  const manufacturerAddress = kendiFirma
    ? [kendiFirma.address, [kendiFirma.taxOffice, kendiFirma.taxNo].filter(Boolean).join(" · ")]
        .filter(Boolean)
        .join("\n")
    : v.manufacturerAddress;

  const tarih = bugun();
  const values: ManualIdentity = {
    manufacturer,
    ...(kendiFirma ? { manufacturerCustomerId: kendiFirma.id } : {}),
    manufacturerAddress,
    product: v.product,
    craneType: v.craneType,
    serialNo: v.projectCode,
    productionYear: v.productionYear,
    customer: v.customer,
    site: v.site,
    customerDocNo: numara ? manualDocCode(numara, revNo) : "",
    customerRevision: manualRevisionLabel(revNo),
    preparedOn: tarih,
    revisedOn: tarih,
    // TELİF SATIRI ÜRETİCİNİN UNVANINDAN TÜRETİLİR; elle yazdırılmaz.
    copyright: manufacturer
      ? `© ${new Date().getFullYear()} ${manufacturer}. Bu doküman ve içeriği ${manufacturer} mülkiyetindedir; izinsiz çoğaltılamaz ve üçüncü kişilere verilemez.`
      : "",
  };

  const sources: Partial<Record<keyof ManualIdentity, string>> = {
    manufacturer: kendiFirma ? "Müşteri defteri · kendi firmamız" : (kaynakEtiketi.get("manufacturer") ?? ""),
    manufacturerAddress: kendiFirma
      ? "Müşteri defteri · kendi firmamız"
      : (kaynakEtiketi.get("manufacturerAddress") ?? ""),
    product: kaynakEtiketi.get("product") ?? "",
    craneType: kaynakEtiketi.get("craneType") ?? "",
    serialNo: kaynakEtiketi.get("projectCode") ?? "",
    productionYear: kaynakEtiketi.get("productionYear") ?? "",
    customer: kaynakEtiketi.get("customer") ?? "",
    site: kaynakEtiketi.get("site") ?? "",
    customerDocNo: "El kitabı belge kodu",
    customerRevision: "Revizyon numarası",
    preparedOn: "Bugünün tarihi",
    revisedOn: "Bugünün tarihi",
    copyright: "Üretici unvanı",
  };

  return { values, sources, selfCompany: kendiFirma };
}

/**
 * Öneriyi var olan künyenin üzerine uygular.
 *
 * `zorunlu` listesindeki alanlar HER ZAMAN yazılır (revizyona bağlı olanlar);
 * geri kalanı yalnız BOŞSA doldurulur — kullanıcının yazdığı bir değer bir
 * kaynak yenilemesiyle silinemez (KITAP-4).
 */
export function applyManualIdentitySuggestion(
  mevcut: ManualIdentity,
  oneri: ManualIdentity,
  { hepsiniTazele = false }: { hepsiniTazele?: boolean } = {}
): { identity: ManualIdentity; doldurulan: number; korunan: number } {
  const zorunlu: (keyof ManualIdentity)[] = ["customerDocNo", "customerRevision", "revisedOn"];
  const sonuc: ManualIdentity = { ...mevcut };
  let doldurulan = 0;
  let korunan = 0;
  for (const anahtar of Object.keys(oneri) as (keyof ManualIdentity)[]) {
    const yeni = String(oneri[anahtar] ?? "").trim();
    if (!yeni) continue;
    const eski = String(mevcut[anahtar] ?? "").trim();
    if (eski === yeni) continue;
    if (!eski || hepsiniTazele || zorunlu.includes(anahtar)) {
      sonuc[anahtar] = yeni;
      doldurulan += 1;
    } else {
      korunan += 1;
    }
  }
  return { identity: sonuc, doldurulan, korunan };
}
