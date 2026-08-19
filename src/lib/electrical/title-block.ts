// ELEKTRİK PROJESİNİN KÜNYESİ — kapak sayfasından SAF okuma.
//
// Kapak, çizim antedinden AYRI bir künye taşır: etiket solda (x≈57), değer
// aynı taban çizgisinde sağda. Bu "SAĞ yön"dür ve `drawings/titleblock.ts`te
// 240 gerçek PDF üzerinde ölçülmüş desenin aynısıdır — etikete ÇAPALI
// geometri, düz metin değil.
//
// ÇİZİM ANTEDİ (sayfanın sağ alt köşesindeki ızgara) BİLEREK OKUNMAZ: orada
// "İŞ NO", "PAFTA NO" ve "ÖLÇEK" hücreleri iç içedir ve yanlış hücreyi okumak
// belgeye başkasının iş numarasını yazdırırdı. Kapaktaki künye aynı bilgiyi
// açık etiketlerle taşıyor.
//
// BÜTÜN ALANLAR BOŞ OLABİLİR. Tanınmayan şablon bir hata değil kapsam
// kaybıdır; boş kalmak yanlış söylemekten iyidir (değişmez md. 4).

import type { PdfSpan } from "./parts-list";
import type { ElectricalTitleBlock } from "./types";

export const BOS_KUNYE: ElectricalTitleBlock = {
  projectName: "",
  projectDescription: "",
  jobNumber: "",
  company: "",
  location: "",
  drawnBy: "",
  declaredPages: null,
  dateIso: "",
};

type Alan = keyof ElectricalTitleBlock;

/** Etiket sözlüğü — İngilizce (EPLAN öntanımı), Türkçe ve Almanca yazımlar. */
const ETIKETLER: { alan: Exclude<Alan, "dateIso" | "declaredPages">; adlar: string[] }[] = [
  { alan: "company", adlar: ["company customer", "company", "firma", "musteri", "kunde"] },
  { alan: "location", adlar: ["location", "yer", "tesis", "ort"] },
  { alan: "projectDescription", adlar: ["project description", "proje tanimi", "proje aciklamasi"] },
  { alan: "jobNumber", adlar: ["job number", "is no", "is numarasi", "auftragsnummer"] },
  { alan: "projectName", adlar: ["project name", "proje adi", "projektname"] },
  { alan: "drawnBy", adlar: ["by short name", "cizen", "gezeichnet"] },
];

const SAYFA_ADLARI = ["number of pages", "toplam sayfa", "sayfa sayisi", "seitenzahl"];
const TARIH_ADLARI = ["edit date", "created on", "tarih", "datum"];

/** Bütün etiket yazımları — bir değerin başka bir etiket olmadığını sınamak için. */
const TUM_ETIKETLER = new Set<string>([
  ...ETIKETLER.flatMap((e) => e.adlar),
  ...SAYFA_ADLARI,
  ...TARIH_ADLARI,
  "adress",
  "address",
  "phone",
  "web",
  "project manager",
]);

function katla(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** `27.06.2026` · `2026-06-27` → ISO; tanınmazsa "". */
export function parseElectricalDate(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(s);
  if (m) {
    const [, g, a, y] = m;
    return `${y}-${a.padStart(2, "0")}-${g.padStart(2, "0")}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/**
 * Kapak künyesini okur.
 *
 * @param spans kapak sayfasının konumlu parçaları (dönmüş olanlar ELENMİŞ)
 * @param meta PDF üstverisi — etiket bulunamazsa YEDEKTİR, önceliği değil:
 *   üstveri çizim programının kendi alanıdır ve bazı dışa aktarımlarda
 *   dosyayı en son kim kaydettiyse onun adını taşır.
 */
export function readElectricalTitleBlock(
  spans: readonly PdfSpan[],
  meta?: { title?: string; author?: string; creationDate?: string }
): ElectricalTitleBlock {
  const out: ElectricalTitleBlock = { ...BOS_KUNYE };
  const dolu = spans.filter((s) => s.text.trim() !== "");

  /** Etiketin SAĞINDAKİ, aynı taban çizgisindeki ilk anlamlı değer. */
  const sagdaki = (etiket: PdfSpan): string => {
    const tolerans = Math.max(1, 0.7 * (etiket.h || 1));
    const adaylar = dolu
      .filter((s) => s !== etiket && Math.abs(s.y - etiket.y) <= tolerans && s.x > etiket.x + etiket.w * 0.5)
      .sort((a, b) => a.x - b.x);
    for (const a of adaylar) {
      // Bir etiketin sağındaki ilk şey BAŞKA BİR ETİKET olabilir (künye iki
      // sütunlu): o zaman bu alanın değeri YOKTUR, komşunun değeri çalınmaz.
      if (TUM_ETIKETLER.has(katla(a.text))) return "";
      return a.text.trim();
    }
    return "";
  };

  for (const s of dolu) {
    const k = katla(s.text);
    if (!k) continue;
    for (const e of ETIKETLER) {
      if (!e.adlar.includes(k) || out[e.alan]) continue;
      const deger = sagdaki(s);
      if (!deger) continue;
      // ŞEKİL DENETİMİ (`drawings/titleblock.ts`in üçüncü koruma katmanı).
      // Ölçüldü: kapakta "by (short name)" etiketinin sağındaki ilk şey
      // ÇİZERİN ADI değil DÜZENLEME TARİHİdir — künye orada iki sütunlu ve
      // ad etiketin üstünde duruyor. Tarih şekilli bir değer isim olamaz;
      // alan boş kalır ve PDF üstverisindeki `Author` devreye girer.
      if (e.alan === "drawnBy" && parseElectricalDate(deger)) continue;
      out[e.alan] = deger;
    }
    if (SAYFA_ADLARI.includes(k) && out.declaredPages === null) {
      const n = Number(sagdaki(s).replace(/\s/g, ""));
      if (Number.isFinite(n) && n > 0) out.declaredPages = n;
    }
    if (TARIH_ADLARI.includes(k) && !out.dateIso) {
      // EN YENİ tarih alınır: kapakta "Created on" ve "Edit date" yan yanadır
      // ve belgenin GÜNCELLİĞİNİ ikincisi söyler.
      const iso = parseElectricalDate(sagdaki(s));
      if (iso && iso > out.dateIso) out.dateIso = iso;
    }
  }

  if (!out.projectName && meta?.title) out.projectName = meta.title.trim();
  if (!out.drawnBy && meta?.author) out.drawnBy = meta.author.trim();
  if (!out.dateIso && meta?.creationDate) out.dateIso = parseElectricalDate(meta.creationDate);
  return out;
}
