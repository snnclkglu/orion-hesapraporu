// MALZEME LİSTESİ (Parts list) — elektrik projesi PDF'inden SAF okuma.
//
// NEDEN DÜZ METİN DEĞİL, KONUM. `drawings/titleblock.ts`teki dersin aynısı:
// pdf.js'in metin katmanında tablo bir IZGARADIR, satır değil. Düz dizgede
// aygıt etiketi, adet ve tanım tek bir satır gibi görünür ve `1` ile `10A`
// birbirine karışır.
//
// SÜTUN SINIRI BAŞLIKTAN ÇIKARILAMAZ — ölçüldü (185/40T Şarj Vinci elektrik
// projesi, 157 sayfa, 726 satır): başlık ORTALANMIŞ, veri SOLA DAYALIDIR.
// "Designation" başlığı x=397'de başlıyor ama altındaki metin x=281'de;
// başlığa en yakın sütunu seçen her kural o metni komşu "Quantity" sütununa
// yazıyordu.
//
// SÜTUNU VERİNİN KENDİSİ SÖYLER. Sola dayalı bir tabloda sol kenarlar
// KÜMELENİR: aynı sayfada 43 · 252 · 281 · 575 · 780 · 927 değerlerinin her
// biri 55-56 kez, gürültünün en yükseği ise 4 kez geçiyor. Ayrım bir eşik
// meselesi değil, iki büyüklük mertebesi.
//
// BAŞLIK YİNE DE GEREKLİDİR: kümeler sütunun NEREDE olduğunu söyler, başlık
// NE olduğunu. İkisi SIRAYLA eşlenir (ikisi de soldan sağa artar); sayılar
// tutmazsa tek yönlü (monoton) bir hizalama en ucuz eşleşmeyi seçer — boş
// kalan bir sütunun kümesi hiç doğmaz ve düz sıra eşlemesi oradan itibaren
// kayardı.
//
// BOŞ SONUÇ BİR HATA DEĞİLDİR: tanınmayan bir şablon kapsam kaybıdır. Uydurma
// satır üretmektense hiç satır üretmemek doğrudur (değişmez md. 4).

import { parseDeviceTag } from "./device-tag";
import type { ElectricalPart } from "./types";

/**
 * Metin katmanındaki konumlu bir parça.
 *
 * `drawings/titleblock.ts`teki `TextSpan` ile aynı şekildedir ve bu KOPYA
 * BİLİNÇLİDİR: iki çekirdek birbirini içe aktarmaz ve teknik resim anteti ile
 * elektrik projesi ayrı şablonlardır — birinin modeline yapılacak bir ekleme
 * ötekini ilgilendirmez.
 */
export interface PdfSpan {
  text: string;
  /** Sol kenar (PDF kullanıcı uzayı). */
  x: number;
  /** Taban çizgisi; y YUKARI artar. */
  y: number;
  /** Yatay ilerleme. */
  w: number;
  /** Yazı yüksekliği. */
  h: number;
}

/** Tanınan sütunlar — sıra BELGEDEKİ soldan sağa sıradır. */
const SUTUNLAR = [
  {
    alan: "deviceTag",
    adlar: ["device tag", "devicetag", "aygit etiketi", "cihaz kodu", "bmk", "betriebsmittelkennzeichen"],
  },
  { alan: "qty", adlar: ["quantity", "qty", "adet", "miktar", "menge"] },
  { alan: "designation", adlar: ["designation", "tanim", "aciklama", "cins", "bezeichnung"] },
  {
    alan: "typeNo",
    adlar: ["type number", "type no", "typenumber", "tip no", "tip numarasi", "typnummer"],
  },
  {
    alan: "supplier",
    adlar: ["supplier", "tedarikci", "lieferant", "uretici", "marka", "manufacturer"],
  },
  {
    alan: "partNo",
    adlar: ["part number", "part no", "partnumber", "parca no", "malzeme no", "stok kodu", "sachnummer"],
  },
] as const;

type Alan = (typeof SUTUNLAR)[number]["alan"];

/** Başlık sayılmak için gereken en az sütun. */
const EN_AZ_SUTUN = 3;

/** Bir kümenin sütun sayılması için en az yoğunluk (en yoğun kümeye oran). */
const KUME_ESIGI = 0.25;

/**
 * Karşılaştırma anahtarı: Türkçe küçük harf + aksansızlaştırma.
 *
 * `drawings/tr-text.ts`teki `trKatla` ile aynı iş; burada aksan da düşer çünkü
 * başlıklar belgeden belgeye "Tanım" ve "Tanim" arasında gidip geliyor.
 */
function katla(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface Satir {
  y: number;
  h: number;
  spans: PdfSpan[];
}

function medyan(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Parçaları taban çizgisine göre satırlara böler. */
function satirlaraBol(spans: readonly PdfSpan[]): Satir[] {
  const dolu = spans.filter((s) => s.text.trim() !== "");
  if (dolu.length === 0) return [];
  const ortancaH = medyan(dolu.map((s) => s.h).filter((h) => h > 0)) || 1;
  const tolerans = Math.max(0.6, 0.5 * ortancaH);

  const sirali = [...dolu].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: Satir[] = [];
  for (const s of sirali) {
    const son = out[out.length - 1];
    if (son && Math.abs(son.y - s.y) <= tolerans) {
      son.spans.push(s);
      son.h = Math.max(son.h, s.h);
    } else {
      out.push({ y: s.y, h: s.h || ortancaH, spans: [s] });
    }
  }
  for (const l of out) l.spans.sort((a, b) => a.x - b.x);
  return out;
}

interface BaslikSutunu {
  alan: Alan;
  /** Başlık metninin SOL kenarı. */
  x: number;
}

/**
 * Satırda hangi sütun başlıkları geçiyor?
 *
 * BAŞLIK KAÇ PARÇAYA BÖLÜNDÜĞÜ BELLİ DEĞİLDİR ve bu ölçülmüş bir gerçektir:
 * pdf.js "Device tag"i TEK parça verirken (hücreyi birleştirir), aynı belgeyi
 * okuyan başka bir çözücü "Device" + "tag" olarak ikiye böler. Bu yüzden
 * eşleşme parça sınırına DEĞİL, ardışık parçaların birleşimine bakar; bulunan
 * dizinin İLK parçası sütunun çapasıdır.
 */
function basliklariOku(l: Satir): BaslikSutunu[] {
  const dolu = l.spans.filter((s) => katla(s.text) !== "");
  const parcalar = dolu.map((s) => katla(s.text));
  const out: BaslikSutunu[] = [];
  for (const s of SUTUNLAR) {
    let bulundu = -1;
    for (const ad of s.adlar) {
      for (let i = 0; i < parcalar.length && bulundu < 0; i++) {
        let birlesik = "";
        for (let j = i; j < parcalar.length; j++) {
          birlesik = birlesik ? `${birlesik} ${parcalar[j]}` : parcalar[j];
          if (birlesik === ad) {
            bulundu = i;
            break;
          }
          // Aday adı aşınca bu başlangıç noktası tükenmiştir.
          if (!ad.startsWith(birlesik)) break;
        }
      }
      if (bulundu >= 0) break;
    }
    if (bulundu < 0) continue;
    out.push({ alan: s.alan, x: dolu[bulundu].x });
  }
  return out.sort((a, b) => a.x - b.x);
}

/**
 * Sola dayalı sütunların SOL KENARLARINI verinin kendisinden bulur.
 *
 * Kümeleme 1 pt'lik kovalarla yapılır, komşu kovalar birleştirilir ve yalnız
 * en yoğun kümenin `KUME_ESIGI` katını aşanlar sütun sayılır.
 */
function sutunKenarlari(satirlar: readonly Satir[], yaziYuksekligi: number): number[] {
  const kova = new Map<number, number>();
  for (const l of satirlar) {
    for (const s of l.spans) {
      const k = Math.round(s.x);
      kova.set(k, (kova.get(k) ?? 0) + 1);
    }
  }
  // BİRLEŞTİRME EŞİĞİ YAZI YÜKSEKLİĞİNDEN GELİR, sabit bir punto değil.
  //
  // Ölçüldü (aynı belgenin 157. sayfası): ADET SÜTUNU SOLA DAYALI DEĞİLDİR —
  // tek haneli "1" x=252'de, iki haneli "24" x=248'de başlıyor ve iki ayrı
  // küme doğuruyordu. Yedinci küme, altı başlıkla eşlemeyi bozup tek haneli
  // bütün adetleri düşürüyordu (34 satır).
  //
  // İki AYRI sütun bir satır yüksekliğinden daha yakın olamaz — o boşluğa tek
  // bir harf bile sığmaz. 4 pt'lik fark aynı sütunun hizalama oyunudur,
  // 29 pt'lik fark gerçek bir sütundur; eşik ikisinin arasına oturur.
  const birlesme = Math.max(2, 1.2 * (yaziYuksekligi || 1));
  const anahtarlar = [...kova.keys()].sort((a, b) => a - b);
  const kumeler: { x: number; n: number }[] = [];
  for (const k of anahtarlar) {
    const son = kumeler[kumeler.length - 1];
    const n = kova.get(k) ?? 0;
    // Kümenin x'i EN SOLdaki kovadır: sütun sınırı orada başlar ve sağa
    // kayan hizalamalar da o sınırın içinde kalır.
    if (son && k - son.x <= birlesme) son.n += n;
    else kumeler.push({ x: k, n });
  }
  if (kumeler.length === 0) return [];
  // YOĞUNLUK SÜZGECİ ANCAK YETERİNCE SATIR VARSA ANLAMLIDIR. Bir sütunu
  // gürültüden ayıran şey TEKRARdır; üç satırlık bir listede her şey bir kez
  // geçer ve süzgeç bütün sütunları düşürürdü. Basit bir vincin malzeme
  // listesi gerçekten kısa olabilir (kullanıcı notu), o yüzden az satırda
  // BÜTÜN kümeler tutulur ve ayıklamayı monoton eşleme yapar — başlıksız
  // kalan küme orada zaten düşer.
  const enYogun = Math.max(...kumeler.map((c) => c.n));
  const esik = satirlar.length >= 8 ? Math.max(3, enYogun * KUME_ESIGI) : 1;
  return kumeler
    .filter((c) => c.n >= esik)
    .map((c) => c.x)
    .sort((a, b) => a - b);
}

/**
 * Kümeleri başlıklarla MONOTON eşler.
 *
 * İkisi de soldan sağa artar; eşleme sırayı BOZAMAZ. Sayılar tutuyorsa
 * doğrudan sıra eşlemesidir; tutmuyorsa en küçük toplam sapmayı veren monoton
 * eşleme seçilir.
 */
function esle(kenarlar: readonly number[], basliklar: readonly BaslikSutunu[]): (Alan | null)[] {
  const n = kenarlar.length;
  const m = basliklar.length;
  if (n === 0 || m === 0) return [];
  if (n === m) return basliklar.map((b) => b.alan);

  const SONSUZ = Number.POSITIVE_INFINITY;
  /** Başlıksız bir sütunu düşürmenin bedeli — sapmalardan büyük olmalı. */
  const ATLAMA = 500;
  // dp[i][j] = ilk i kümeyi ilk j başlıkla eşlemenin en küçük maliyeti.
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(SONSUZ));
  const iz: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  dp[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (dp[i][j] === SONSUZ) continue;
      // 1 — başlığı atla (o sütunda hiç veri yok).
      if (j < m && dp[i][j] < dp[i][j + 1]) {
        dp[i][j + 1] = dp[i][j];
        iz[i][j + 1] = 1;
      }
      // 2 — küme ile başlığı eşle.
      if (i < n && j < m) {
        const bedel = dp[i][j] + Math.abs(kenarlar[i] - basliklar[j].x);
        if (bedel < dp[i + 1][j + 1]) {
          dp[i + 1][j + 1] = bedel;
          iz[i + 1][j + 1] = 2;
        }
      }
      // 3 — kümeyi atla (başlıksız sütun; içeriği düşer).
      if (i < n && dp[i][j] + ATLAMA < dp[i + 1][j]) {
        dp[i + 1][j] = dp[i][j] + ATLAMA;
        iz[i + 1][j] = 3;
      }
    }
  }
  const out: (Alan | null)[] = Array<Alan | null>(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const adim = iz[i][j];
    if (adim === 1) j--;
    else if (adim === 2) {
      out[i - 1] = basliklar[j - 1].alan;
      i--;
      j--;
    } else if (adim === 3) i--;
    else break;
  }
  return out;
}

/** Aygıt etiketi olabilecek bir dizge mi? Boşluk taşıyan hiçbir şey değildir. */
function etiketMi(s: string): boolean {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  // EPLAN antetindeki REVISION hücresi cihaz etiketi sütununun altında kalır;
  // biçimsel olarak etikete benzese de malzeme değildir.
  if (t.toUpperCase() === "REVISION") return false;
  return /^[=+\-A-Za-z0-9][A-Za-z0-9=+._/-]*$/.test(t);
}

/** EPLAN sayfa antedinin tablo altına taşan satırı mı? */
function cerceveSatiriMi(hucre: Partial<Record<Alan, string>>): boolean {
  const metin = katla(Object.values(hucre).join(" "));
  return [
    "date name draw",
    "sheet form date name",
    "date approval",
    "job no approval",
    "drawing no sheet",
  ].some((isaret) => metin.includes(isaret));
}

/** Antetteki tek başına sayfa numarası, son ürünün malzeme kodu devamı değildir. */
function cerceveSayfaNumarasiMi(hucre: Partial<Record<Alan, string>>): boolean {
  const dolu = Object.entries(hucre).filter(([, value]) => value?.trim());
  return dolu.length === 1 && dolu[0][0] === "partNo" && /^\d{1,3}$/.test(dolu[0][1]!.trim());
}

/** `1`, `1,5`, `24` → sayı; okunamayan `null` (değişmez md. 4). */
function adet(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface PartsListRead {
  parts: ElectricalPart[];
  /** Sayfada malzeme listesi başlığı bulundu mu — çağıran sayfayı işaretler. */
  found: boolean;
}

/**
 * Eski okumada veritabanına girmiş EPLAN antet eklerini temizler.
 *
 * Yeni okuyucu antedi hücreye eklemeden eler; bu işlev ise restore edilmiş
 * eski satırları yeniden okuma zorunluluğu olmadan aynı biçime getirir.
 */
export function cleanElectricalPart(part: ElectricalPart): ElectricalPart | null {
  if (part.deviceTag.trim().toUpperCase() === "REVISION") return null;
  const typeNo = part.typeNo.replace(/\s+(?:SIGN|İMZA)\s+.*$/i, "").trim();
  let partNo = part.partNo
    .replace(/\s+\d*\s*(?:SHEET\s+FORM|KAĞIT\s+FORMU)\b.*$/iu, "")
    .trim();
  const sayfali = /^(.*?)\s+\d{1,3}$/.exec(partNo);
  if (sayfali && typeNo) {
    const katlaKod = (value: string): string => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (katlaKod(sayfali[1]).endsWith(katlaKod(typeNo))) partNo = sayfali[1].trim();
  }
  return {
    ...part,
    designation: part.designation
      .replace(/\s+(?:DATE\s+NAME\s+DRAW|TARİH\s+İSİM\s+ÇİZEN)\b.*$/iu, "")
      .trim(),
    typeNo,
    // ASTOR çizim antetindeki firma adıdır; iki ölçülmüş sayfada üretici
    // hücresinin devamına taşarak `SE ASTOR` / `RESSA ASTOR` üretmiştir.
    supplier: part.supplier.replace(/\s+ASTOR\s*$/iu, "").trim(),
    partNo,
  };
}

/**
 * Tek bir sayfanın malzeme listesini okur.
 *
 * @param spans sayfanın konumlu metin parçaları (dönmüş olanlar ELENMİŞ)
 * @param page 1 tabanlı sayfa numarası — satırın belgede nerede yazdığı
 */
export function readPartsList(spans: readonly PdfSpan[], page: number): PartsListRead {
  const satirlar = satirlaraBol(spans);
  if (satirlar.length === 0) return { parts: [], found: false };

  // Başlık: en çok sütun adı taşıyan satır.
  let bas: Satir | null = null;
  let basSutunlar: BaslikSutunu[] = [];
  for (const l of satirlar) {
    const c = basliklariOku(l);
    if (c.length >= EN_AZ_SUTUN && c.length > basSutunlar.length) {
      bas = l;
      basSutunlar = c;
    }
  }
  if (!bas) return { parts: [], found: false };
  // Kimlik taşımayan bir başlık (yalnız adet + tanım) malzeme listesi değildir.
  const alanlar = new Set<Alan>(basSutunlar.map((c) => c.alan));
  if (!alanlar.has("deviceTag") && !alanlar.has("partNo") && !alanlar.has("typeNo")) {
    return { parts: [], found: false };
  }

  const basY = bas.y;
  const basH = bas.h;
  const veri = satirlar.filter((l) => l.y < basY - 0.3 * basH);
  if (veri.length === 0) return { parts: [], found: true };

  const veriYuksekligi = medyan(veri.map((l) => l.h).filter((h) => h > 0)) || basH;
  const kenarlar = sutunKenarlari(veri, veriYuksekligi);
  if (kenarlar.length === 0) return { parts: [], found: true };
  const eslesme = esle(kenarlar, basSutunlar);

  // Sınır KOMŞU KENARLARIN ORTASIDIR: sütunun gerçek çizgisi metin katmanında
  // yoktur, ama sola dayalı iki sütun arasındaki bir metin ancak kendi
  // kenarına yakınsa oraya aittir.
  const ortalar = kenarlar.map((x, k) =>
    k + 1 < kenarlar.length ? (x + kenarlar[k + 1]) / 2 : Number.POSITIVE_INFINITY
  );
  const sinir = (x: number): number => {
    for (let k = 0; k < ortalar.length; k++) if (x < ortalar[k]) return k;
    return kenarlar.length - 1;
  };

  // Satır adımı: komşu iki satırın tipik y farkı. Devam satırlarının tabloya
  // ait olduğunu bundan anlarız — sayfanın altındaki çerçeve yazıları
  // tabloya karışmasın.
  const adimlar: number[] = [];
  for (let i = 1; i < veri.length; i++) adimlar.push(Math.abs(veri[i - 1].y - veri[i].y));
  const adim = medyan(adimlar.filter((d) => d > 0.5)) || 2 * basH;

  const parts: ElectricalPart[] = [];
  let acik: { row: ElectricalPart; y: number } | null = null;

  for (const l of veri) {
    const hucre: Partial<Record<Alan, string>> = {};
    for (const s of l.spans) {
      const alan = eslesme[sinir(s.x)];
      if (!alan) continue;
      const metin = s.text.trim();
      if (!metin) continue;
      hucre[alan] = hucre[alan] ? `${hucre[alan]} ${metin}` : metin;
    }
    const etiket = (hucre.deviceTag ?? "").trim();

    // Antet, son ürün satırına 1-2 satır adımı kadar yakındır. Yalnız mesafe
    // ile karar verilirse DATE/SIGN/SHEET FORM metinleri ürünün tanım, tip ve
    // malzeme koduna eklenir; aynı ürün ikinci ve sahte bir malzeme olur.
    if (cerceveSatiriMi(hucre) || cerceveSayfaNumarasiMi(hucre)) {
      acik = null;
      continue;
    }

    if (etiket && etiketMi(etiket)) {
      const tag = parseDeviceTag(etiket);
      const row: ElectricalPart = {
        deviceTag: etiket,
        installation: tag.installation,
        location: tag.location,
        device: tag.device,
        qty: adet(hucre.qty ?? ""),
        designation: (hucre.designation ?? "").trim(),
        typeNo: (hucre.typeNo ?? "").trim(),
        supplier: (hucre.supplier ?? "").trim(),
        partNo: (hucre.partNo ?? "").trim(),
        page,
      };
      parts.push(row);
      acik = { row, y: l.y };
      continue;
    }

    // DEVAM SATIRI: aynı kaydın sarmış hücreleri ya da ayrı taban çizgisine
    // düşmüş adeti. Tablodan UZAKSA (sayfa altbilgisi, çerçeve numaraları)
    // alınmaz — iki buçuk satır adımı bir kaydın en fazla sarma payıdır.
    if (!acik || Math.abs(acik.y - l.y) > 2.5 * adim) continue;
    if (hucre.qty && acik.row.qty === null) acik.row.qty = adet(hucre.qty);
    for (const alan of ["designation", "typeNo", "supplier", "partNo"] as const) {
      const ek = (hucre[alan] ?? "").trim();
      if (!ek) continue;
      acik.row[alan] = acik.row[alan] ? `${acik.row[alan]} ${ek}` : ek;
    }
    acik.y = l.y;
  }

  return { parts, found: true };
}
