// ŞABLON GÖRSELLERİNİN BAYTLARI — YALNIZCA SUNUCUDA çalışır (fs okur).
//
// `server-only` İÇE AKTARILMAZ ve bu evin kuralına uyar: `pdf/brand.tsx` de
// fontları ve logoyu `fs` ile okur ve o işareti taşımaz. Sebep pratiktir —
// işaret, modülü duman testi betiklerinden (`scripts/test-manual-pdf.ts`)
// de erişilemez yapıyor; oysa betiğin PDF'i indirme ucuyla AYNI yoldan
// üretmesi şart, yoksa varlıklar yüklenmeden ölçülür ve boş yaprak çıkar.
// İstemciye sızma riski `fs` içe aktarımının kendisi tarafından zaten
// derleme anında yakalanır.
//
// Defter (`assets.ts`) SAFTIR ve yalnız tanım taşır; baytları okuyan tek yer
// burasıdır. Ayrım `pdf/brand.tsx`in `BRAND_LOGO`unu okuma biçiminin aynısı:
// dosya BUFFER olarak okunur, çünkü react-pdf string `src`yi URL sayıp
// getirmeye çalışır ve Windows dosya yolunda düşer.
//
// BİR KEZ OKUNUR, BELLEKTE KALIR: on beş görselin toplamı ~1,3 MB'tır ve her
// PDF isteğinde diskten okumak, aynı baytları saniyede birkaç kez taşımak
// olurdu. Süreç ömrü boyunca sabittirler — varlık koddur, kodla sürümlenir.
//
// DOSYALAR `public/manual-assets/` ALTINDADIR ve bu TEK kopyadır. İki
// kullanıcıları var — sunucu PDF'e gömmek için diskten okur, editör önizleme
// için `/manual-assets/…` adresinden çeker — ve `public/` ikisini birden
// karşılar: Next onu hem statik olarak sunar hem dağıtım izine kendiliğinden
// katar. `src/assets/` altında ikinci bir kopya tutmak, bir dosya
// değiştirildiğinde ekranla belgenin sessizce ayrışması demekti.

import fs from "node:fs";
import path from "node:path";
import { MANUAL_ASSETS, manualAsset } from "./assets";

const KLASOR = path.join(process.cwd(), "public", "manual-assets");

const bellek = new Map<string, Buffer>();

/**
 * Şablon görselinin baytları; dosya okunamazsa `null`.
 *
 * OKUNAMAYAN VARLIK BELGEYİ DÜŞÜRMEZ: `pdf/manual.tsx` kaydı bulunamayan
 * görsel bloğunu hiç basmaz. Bir piktogramın eksikliği yüzünden bütün
 * kılavuzun 500 dönmesi, o piktogramın yokluğundan kat kat kötüdür.
 */
export function manualAssetBytes(key: string): Buffer | null {
  const varOlan = bellek.get(key);
  if (varOlan) return varOlan;

  const tanim = manualAsset(key);
  if (!tanim) return null;
  try {
    const bytes = fs.readFileSync(path.join(KLASOR, tanim.file));
    bellek.set(key, bytes);
    return bytes;
  } catch {
    return null;
  }
}

/** Belgede geçen şablon varlıklarının baytları — PDF ucu bunu çağırır. */
export function manualAssetsFor(
  keys: readonly string[]
): { id: string; bytes: Buffer; width: number; height: number }[] {
  const out: { id: string; bytes: Buffer; width: number; height: number }[] = [];
  for (const key of new Set(keys)) {
    const tanim = manualAsset(key);
    const bytes = manualAssetBytes(key);
    if (!tanim || !bytes) continue;
    // GENİŞLİK BİR ÖLÇEK BİRİMİDİR, gerçek piksel değil: çizim `width` ve
    // `height` oranını kullanır, mutlak değerini değil. 1000 seçilir ki
    // oran defterdeki dört ondalıkla tam ifade edilsin.
    out.push({ id: tanim.key, bytes, width: 1000, height: Math.round(tanim.ratio * 1000) });
  }
  return out;
}

/** Defterdeki bütün varlıkların dosyaları gerçekten var mı (denetim). */
export function eksikManualAssets(): string[] {
  return MANUAL_ASSETS.filter((a) => !fs.existsSync(path.join(KLASOR, a.file))).map((a) => a.file);
}
