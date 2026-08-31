// "BU BÖLÜMDE NE YAPMALISIN" — editörün bölüm rehberi (saf).
//
// Kullanıcı bildirimi (20.08.2026): *"Kullanıcı oluştururken ne yaptığını pek
// anlayamıyor."* Editör bölüm bölüm ilerliyor ama her bölümün NE İSTEDİĞİNİ
// söylemiyordu: bir mühendis "3.1 Teknik Bilgiler"i açtığında oradaki tablonun
// hesap raporundan geldiğini, "4.2 Operatör Kabini"nin ise BOŞ geldiğini ve
// kendisinin doldurması gerektiğini ancak deneyerek öğreniyordu.
//
// REHBER ÇOĞUNLUKLA TÜRETİLİR, YAZILMAZ. Bölümün ne istediği zaten
// BLOKLARINDA yazılıdır: boş bir şablon metni "sen dolduracaksın" demektir,
// bir `auto` blok "bu tablo kaynağından gelir" demektir. Seksen beş bölüme
// elle cümle yazmak, şablon değiştiğinde sessizce yalan söyleyen seksen beş
// cümle demekti (değişmez md. 8'in ruhu).
//
// ELLE YAZILAN İSTİSNALAR yalnız TÜRETİLEMEYEN bilgiler içindir: bir bölümün
// hangi standarda dayandığı, hangi belgeden bakılacağı, hangi tuzağı taşıdığı.

import type { ManualPayload, ManualSection } from "./types";
import { MANUAL_AUTO_LABELS } from "./types";
import { blockHasContent } from "./payload";

export type ManualGuideTone = "doldur" | "otomatik" | "standart" | "ek";

export interface ManualGuide {
  tone: ManualGuideTone;
  /** Bir cümlelik yönerge. */
  text: string;
  /** Türetilemeyen ek bilgi — dayanak, kaynak belge, tuzak. */
  note?: string;
}

export interface ManualPublishReadiness {
  missingIdentity: string[];
  missingSections: { id: string; title: string }[];
}

/**
 * YAYIM KALİTE KAPISI — istemci ve sunucunun ortak, saf kuralı.
 *
 * Bir üst bölüm gizliyse bütün alt ağacı da bilinçli olarak kapsam dışıdır.
 * Görünür bir bölümdeki boş `fromTemplate` blok ise vince özel bilgi
 * beklediğimizi söyler; standart dolu metin ve otomatik blok engel değildir.
 */
export function manualPublishReadiness(payload: ManualPayload): ManualPublishReadiness {
  const identityFields: [string, string][] = [
    ["Belge adı", payload.docTitle],
    ["Kapak başlığı", payload.coverTitle],
    ["Üretici", payload.identity.manufacturer],
    ["Ürün", payload.identity.product],
    ["Vinç tipi", payload.identity.craneType],
    ["Müşteri", payload.identity.customer],
  ];
  const missingIdentity = identityFields
    .filter(([, value]) => !value.trim())
    .map(([label]) => label);

  const missingSections: { id: string; title: string }[] = [];
  const visit = (sections: readonly ManualSection[], parentHidden = false) => {
    for (const section of sections) {
      const hidden = parentHidden || Boolean(section.hidden);
      if (
        !hidden &&
        !section.appendix &&
        section.blocks.some(
          (block) => block.fromTemplate && !block.hidden && !blockHasContent(block)
        )
      ) {
        missingSections.push({ id: section.id, title: section.title });
      }
      visit(section.children, hidden);
    }
  };
  visit(payload.sections);

  return { missingIdentity, missingSections };
}

/**
 * ELLE YAZILAN NOTLAR — anahtar `template.ts`teki `key`dir.
 *
 * Buraya yalnız bloklardan ÇIKARILAMAYAN şey yazılır. "Bu bölümü doldurun"
 * yazmak yasaktır: onu zaten türetim söylüyor.
 */
export const MANUAL_SECTION_GUIDE: Record<string, string> = {
  "guvenlik.uyariIsaretleri":
    "Vincin üzerindeki etiketlerin FOTOĞRAFINI ekleyin; okunmayan bir etiket ISO 12480-1'e göre yenilenmelidir.",
  "guvenlik.kimlikPlakalari":
    "Kimlik plakasının fotoğrafı ve okunan değerleri; seri numarası kapak künyesiyle AYNI olmalıdır.",
  "guvenlik.ekipmanlar":
    "Acil stop butonlarının SAYISI ve YERİ vince özeldir — kaç adet, nerede, hangisi neyi keser.",
  "tanim.guvenliErisim":
    "Platform, merdiven, kilit noktaları ve emniyet kemeri bağlantı noktaları; yüksekte çalışma bölümüyle tutarlı olmalı.",
  "kullanim.kabin":
    "Kabin konsolunun fotoğrafı ve kumanda organlarının dökümü; joystick eksenleri hangi hareketi verir.",
  "kullanim.anaKesici": "Ana kesicinin yeri, kilitlenebilirliği ve kilitleme (LOTO) sırası.",
  "kullanim.devreyeAlmak":
    "Adım adım devreye alma. Numaralı liste kullanın ve son adımın SONUCUNU yazın.",
  "kullanim.gucKumanda":
    "Güç ve kumanda şeması — elektrik projesinden sayfa atfı verin, şemayı kopyalamayın.",
  "kullanim.emniyetBakimSistemleri.sensorIptal":
    "Sensör iptali GÜVENLİK FONKSİYONUNU devre dışı bırakır: hangi yetkiyle, hangi şartla, ne kadar süreyle.",
  "kullanim.halatKontrol.telHalat.hasarGorunumleri":
    "Şekiller DIN 15020 / ISO 4309 muayene kıstaslarıdır ve her çelik halatlı vinçte geçerlidir.",
  "muayene.kalanOmur":
    "Kalan servis ömrü (SWP) ISO 12482 / FEM 9.755'e göre izlenir; vincin çalışma grubu hesap raporundadır.",
  bakim:
    "Bakım çizelgesi VİNCE ÖZELDİR ve grubuna bağlıdır. Satırları kendiniz yazın ya da bir önceki kılavuzdan taşıyın.",
  yaglama:
    "Yağ değişim aralıkları redüktör üreticisinin kataloğundadır — şablon sabit bir saat vermez.",
  "yedek.kece":
    "Keçe listesi hesap motorunda bir seçim alanı değildir; ekipman kataloglarından elle girilir.",
};

/**
 * Bölümün ne istediğini SÖYLER.
 *
 * Sıra önemlidir: bir bölüm hem boş blok hem otomatik tablo taşıyorsa,
 * kullanıcının yapması gereken iş BOŞ OLANIDIR — otomatik tablo zaten
 * kendiliğinden dolar ve ondan söz etmek asıl işi gölgelerdi.
 */
export function manualSectionGuide(section: ManualSection): ManualGuide {
  const el = section.key ? MANUAL_SECTION_GUIDE[section.key] : undefined;

  if (section.appendix) {
    return {
      tone: "ek",
      text:
        "Bu bir EK'tir: gövdede yalnız ayraç kapağı basılır, belgenin kendisi " +
        "«Tam Sürüm» indirilirken kapağın ardına eklenir.",
      note: el,
    };
  }

  const bosSablon = section.blocks.filter((b) => b.fromTemplate && !blockHasContent(b));
  if (bosSablon.length > 0) {
    return {
      tone: "doldur",
      text:
        `Bu bölüm VİNCE ÖZELDİR: şablon ${bosSablon.length} boş blokla gelir ve ` +
        "siz doldurursunuz. Boş bırakılan blok belgeye HİÇ girmez.",
      note: el,
    };
  }

  const oto = section.blocks.filter((b) => b.kind === "auto");
  if (oto.length > 0) {
    const kaynaklar = oto
      .map((b) => (b.kind === "auto" ? MANUAL_AUTO_LABELS[b.source] : ""))
      .filter(Boolean)
      .join(" · ");
    return {
      tone: "otomatik",
      text: `Bu bölümdeki tablo ÜRETİLİR, elle yazılmaz — kaynak: ${kaynaklar}. Taslakta kaynak değişince tazelenir, yayımda donar.`,
      note: el,
    };
  }

  if (section.blocks.some((b) => b.fromTemplate)) {
    return {
      tone: "standart",
      text:
        "Standart metin hazır gelir. Değiştirebilirsiniz; ilk dokunuşta blok " +
        "«standarttan ayrıldı» rozetini alır ve «Standarda Dön» ile geri alınır.",
      note: el,
    };
  }

  return {
    tone: "doldur",
    text: "Bu bölüm boş. Paragraf, liste, uyarı kutusu, tablo ya da görsel ekleyin.",
    note: el,
  };
}

/**
 * BÖLÜMÜN DOLULUK DURUMU — ağaçtaki noktanın rengi.
 *
 * "Dolu" demek BELGEYE GİRİYOR demektir; süzgecin (`printedManual`) sorduğu
 * sorunun aynısı sorulur — ağaçta dolu görünüp belgede olmayan bir bölüm,
 * kullanıcının bir daha bu ekrana güvenmemesi demektir.
 */
export type ManualFillState = "gizli" | "bos" | "dolu" | "ek";

export function manualFillState(section: ManualSection): ManualFillState {
  if (section.hidden) return "gizli";
  if (section.appendix) return "ek";
  const kendi = section.blocks.some((b) => !b.hidden && blockHasContent(b));
  if (kendi) return "dolu";
  // ÇOCUĞU DOLU OLAN BAŞLIK DA DOLUDUR: "4 Kullanım" kendi başına blok
  // taşımaz ama on alt bölümü doluysa belgede vardır.
  const alt = section.children.some((c) => manualFillState(c) === "dolu");
  return alt ? "dolu" : "bos";
}
