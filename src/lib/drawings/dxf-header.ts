// DXF başlığı — EL YAZIMI grup kodu okuyucusu, kütüphane YOK.
//
// NEDEN KÜTÜPHANE DEĞİL. Hazır ayrıştırıcılar (dxf-parser ve akrabaları)
// dosyayı UTF-8 varsayar. Bu depodaki 134 DXF'in 134'ü başlığında
// `$DWGCODEPAGE = ANSI_1254` beyan ediyor ve 20'sinde gerçekten ASCII dışı
// bayt VAR — katman/blok/yazı stili adlarında:
//
//     "Ölçülendirme Yazı Stili"        (yazı stili adı)
//     "C:\PROJELER\ORİON INVENTOR ..."  (kaynak yol)
//
// UTF-8 çözümü bu adları bozar. Kod sayfası ilk kilobaytlardan koklanır ve
// çözme ona göre yapılır (`sniffCodePage` + `decodeDxf`).
//
// İKİNCİ SEBEP: bize dosyanın tamamı gerekmiyor. DXF'ler 232–553 KB ama
// başlık bölümü ortalama 6,5 KB. Değerli olan tek şey `$EXTMIN`/`$EXTMAX`:
// parçanın kesim kutusu. Ölçüldü — 134/134 dosyada extents okunuyor ve
// nominal ölçüyle karşılaştırılabiliyor (`SAC 8x475x8270` → 8270,0 × 475,0).
//
// DXF'lerin İÇİ KİMLİK TAŞIMAZ: 134/134 dosyanın ENTITIES bölümünde hiç metin
// yok, 125'inde tek katman (`0`) var. Katman listesi ve varlık histogramı
// neredeyse bilgisizdir — bu yüzden büyük dosyada ilk atlanacak şey onlardır.
//
// BİÇİM: dosya (kod satırı, değer satırı) ÇİFTLERİNDEN oluşur. Kodlar sağa
// hizalı yazılır (`  0`, ` 70`, `  9`) — `trim()` şarttır. Satır sonu bu
// derlemede CRLF ama LF de kabul edilir.

/** Ölçü birimi kodları ($INSUNITS). Yalnız gerekli olanlar. */
const BIRIM_MM: Record<string, number> = {
  // mm cinsinden çarpan; listede olmayan kod "bilinmiyor"dur.
  "1": 25.4,   // inç
  "2": 304.8,  // ayak
  "4": 1,      // milimetre
  "5": 10,     // santimetre
  "6": 1000,   // metre
};

/** AutoCAD sürüm kodu → okunabilir ad. Liste kapalı DEĞİLDİR. */
const SURUM_ADLARI: Record<string, string> = {
  AC1006: "R10", AC1009: "R11/R12", AC1012: "R13", AC1014: "R14",
  AC1015: "AutoCAD 2000", AC1018: "AutoCAD 2004", AC1021: "AutoCAD 2007",
  AC1024: "AutoCAD 2010", AC1027: "AutoCAD 2013", AC1032: "AutoCAD 2018",
};

/**
 * AutoCAD'in "tanımsız extent" değeri. Hiç varlığı olmayan bir çizimde
 * `$EXTMIN` +1e20, `$EXTMAX` −1e20 yazılır; bunu 1e20 mm sanmak parçaya
 * astronomik bir ölçü biçmek olurdu.
 */
const TANIMSIZ = 1e19;

/** 5 MB üstünde katman ve histogram atlanır — başlık yine okunur. */
const AYRINTI_SINIRI = 5 * 1024 * 1024;

export interface DxfHeader {
  /** `$ACADVER` ham değeri: "AC1018" */
  version: string;
  /** İnsan okuru için: "AutoCAD 2004". Bilinmeyen sürümde "" */
  versionLabel: string;
  /** `$INSUNITS` ham kodu */
  unitsCode: string;
  /** Birim milimetre mi? */
  unitsMm: boolean;
  /** `$DWGCODEPAGE`: "ANSI_1254" */
  codePage: string;
  /** Çizim kutusunun genişliği (mm). Tanımsızsa null */
  extentsXMm: number | null;
  extentsYMm: number | null;
  /** Katman adları. Büyük dosyada okunmaz → boş dizi */
  layers: string[];
  /** Varlık türü → adet. Büyük dosyada okunmaz → boş nesne */
  entityCounts: Record<string, number>;
  /** "" ya da "DXF_KISMI_OKUNDU" / "DXF_OKUNAMADI" */
  note: string;
}

export function emptyDxfHeader(): DxfHeader {
  return {
    version: "", versionLabel: "", unitsCode: "", unitsMm: false, codePage: "",
    extentsXMm: null, extentsYMm: null, layers: [], entityCounts: {}, note: "",
  };
}

/**
 * Kod sayfasını ilk kilobaytlardan koklar.
 *
 * Yalnız ASCII aralığına bakılır: `$DWGCODEPAGE` ve değeri her zaman ASCII'dir,
 * yani hangi kod sayfasıyla çözersek çözelim aynı görünür. Tavuk-yumurta
 * sorunu bu yüzden yoktur.
 */
export function sniffCodePage(bytes: Uint8Array): string {
  const bas = bytes.subarray(0, Math.min(bytes.length, 4096));
  let ascii = "";
  for (const b of bas) ascii += b < 128 ? String.fromCharCode(b) : "\uFFFD";
  const m = ascii.match(/\$DWGCODEPAGE\s*[\r\n]+\s*\d+\s*[\r\n]+\s*([A-Za-z0-9_]+)/);
  return m ? m[1].trim() : "";
}

/**
 * Kod sayfası adını `TextDecoder` etiketine çevirir.
 *
 * Bilinmeyen bir kod sayfası UTF-8'e düşer: yanlış bir tek-bayt eşlemesi
 * seçmektense çoğunlukla doğru olan varsayılana dönmek daha az zarar verir.
 */
export function decoderLabelFor(codePage: string): string {
  const a = codePage.trim().toUpperCase();
  if (a === "ANSI_1254") return "windows-1254";
  if (a === "ANSI_1252") return "windows-1252";
  if (a === "ANSI_1251") return "windows-1251";
  if (a === "ANSI_1250") return "windows-1250";
  if (a === "ANSI_1253") return "windows-1253";
  if (a === "UTF8" || a === "UTF-8") return "utf-8";
  return "utf-8";
}

/** Baytları kendi beyan ettiği kod sayfasıyla çözer. */
export function decodeDxf(bytes: Uint8Array): { text: string; codePage: string } {
  const codePage = sniffCodePage(bytes);
  const label = decoderLabelFor(codePage);
  let text: string;
  try {
    text = new TextDecoder(label).decode(bytes);
  } catch {
    // Çalışma zamanı o kod sayfasını tanımıyorsa okumayı bırakmayız: UTF-8
    // ile devam etmek, bütün başlığı kaybetmekten iyidir.
    text = new TextDecoder("utf-8").decode(bytes);
  }
  return { text, codePage };
}

interface Cift {
  kod: string;
  deger: string;
}

/**
 * Metni (kod, değer) çiftlerine böler.
 *
 * Çiftleme HER ZAMAN dosyanın başından yapılır. Bir bölümün adını arayıp
 * oradan çiftlemeye başlamak parite hatası üretir: "ENTITIES" bir DEĞER
 * satırıdır, yani tek indistedir ve oradan başlayan çiftleme kodu değerle
 * yer değiştirir.
 */
function ciftle(text: string): Cift[] {
  const satirlar = text.split(/\r\n|\n|\r/);
  const out: Cift[] = [];
  for (let i = 0; i + 1 < satirlar.length; i += 2) {
    out.push({ kod: satirlar[i].trim(), deger: satirlar[i + 1] });
  }
  return out;
}

function sayi(deger: string | undefined): number | null {
  if (deger === undefined) return null;
  const n = Number(deger.trim());
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) >= TANIMSIZ) return null;
  return n;
}

/**
 * DXF metnini okur.
 *
 * Bozuk ya da yarıda kesilmiş dosya FIRLATMAZ: elde ne varsa onunla döner.
 * Bir kesim dosyasının okunamaması, o paketin yüklenmesini engellememeli.
 */
export function readDxf(text: string, codePage = ""): DxfHeader {
  const out = emptyDxfHeader();
  out.codePage = codePage;
  if (!text || text.length < 8) {
    out.note = "DXF_OKUNAMADI";
    return out;
  }

  const ayrintili = text.length <= AYRINTI_SINIRI;
  if (!ayrintili) out.note = "DXF_KISMI_OKUNDU";

  const cift = ciftle(text);
  let bolum = "";
  let birimCarpani: number | null = null;
  const ext: { minX: number | null; minY: number | null; maxX: number | null; maxY: number | null } = {
    minX: null, minY: null, maxX: null, maxY: null,
  };
  let katmanTablosu = false;

  for (let i = 0; i < cift.length; i++) {
    const { kod, deger } = cift[i];

    if (kod === "0") {
      const v = deger.trim();
      if (v === "SECTION") {
        // Bölüm adı bir sonraki çiftte, kod 2 ile gelir.
        bolum = cift[i + 1]?.kod === "2" ? cift[i + 1].deger.trim() : "";
        continue;
      }
      if (v === "ENDSEC") { bolum = ""; katmanTablosu = false; continue; }
      if (bolum === "TABLES") {
        if (v === "TABLE") {
          katmanTablosu = cift[i + 1]?.kod === "2" && cift[i + 1].deger.trim() === "LAYER";
        } else if (v === "ENDTAB") {
          katmanTablosu = false;
        } else if (v === "LAYER" && katmanTablosu && ayrintili) {
          // Katman adı bu kaydın ilk kod-2 alanıdır.
          for (let j = i + 1; j < cift.length && cift[j].kod !== "0"; j++) {
            if (cift[j].kod === "2") {
              const ad = cift[j].deger.trim();
              if (ad && !out.layers.includes(ad)) out.layers.push(ad);
              break;
            }
          }
        }
        continue;
      }
      if (bolum === "ENTITIES" && ayrintili) {
        out.entityCounts[v] = (out.entityCounts[v] ?? 0) + 1;
      }
      continue;
    }

    if (bolum !== "HEADER" || kod !== "9") continue;
    const ad = deger.trim();
    if (ad === "$ACADVER") {
      out.version = cift[i + 1]?.deger.trim() ?? "";
      out.versionLabel = SURUM_ADLARI[out.version] ?? "";
    } else if (ad === "$INSUNITS") {
      out.unitsCode = cift[i + 1]?.deger.trim() ?? "";
      birimCarpani = BIRIM_MM[out.unitsCode] ?? null;
      out.unitsMm = out.unitsCode === "4";
    } else if (ad === "$DWGCODEPAGE") {
      const v = cift[i + 1]?.deger.trim() ?? "";
      if (v) out.codePage = v;
    } else if (ad === "$EXTMIN") {
      ext.minX = sayi(cift[i + 1]?.deger);
      ext.minY = sayi(cift[i + 2]?.deger);
    } else if (ad === "$EXTMAX") {
      ext.maxX = sayi(cift[i + 1]?.deger);
      ext.maxY = sayi(cift[i + 2]?.deger);
    }
  }

  // Birim bilinmiyorsa ölçü YAZILMAZ. "Muhtemelen mm'dir" demek, kesimciye
  // yanlış boyda bir parça göstermenin en kısa yoludur.
  const k = birimCarpani;
  if (k !== null && ext.minX !== null && ext.maxX !== null && ext.maxX >= ext.minX) {
    out.extentsXMm = (ext.maxX - ext.minX) * k;
  }
  if (k !== null && ext.minY !== null && ext.maxY !== null && ext.maxY >= ext.minY) {
    out.extentsYMm = (ext.maxY - ext.minY) * k;
  }

  if (!out.version && out.extentsXMm === null && out.layers.length === 0) {
    out.note = out.note || "DXF_OKUNAMADI";
  }
  return out;
}

/** Baytlardan tek adımda: kod sayfasını kokla, çöz, oku. */
export function readDxfBytes(bytes: Uint8Array): DxfHeader {
  try {
    const { text, codePage } = decodeDxf(bytes);
    return readDxf(text, codePage);
  } catch {
    return { ...emptyDxfHeader(), note: "DXF_OKUNAMADI" };
  }
}
