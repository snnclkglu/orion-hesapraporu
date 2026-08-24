// Standart referans kayıt defteri.
//
// Hesap satırlarının ve kontrollerin `standard` alanı ("FEM 1.001 T.4.2.2.1.2"
// gibi) bu deftere bakar; kullanıcı referansa tıkladığında ilgili standardın
// tablosu / formülü / açıklaması pop-up olarak açılır. Böylece mühendis, bir
// katsayının nereden geldiğini raporu terk etmeden görebilir.
//
// Kaynaklar: FEM 1.001 3rd Edition Revised (1998), CMAA Specification #70,
// DIN 15018-1. Tablo değerleri `docs/standards/*.md` inceleme notlarından ve
// motor sabitlerinden (coefficients.ts, tables.ts) alınmıştır — tek kaynak
// ilkesi için mümkün olan yerlerde sabitler doğrudan içe aktarılır.

import { DIN15018_T17 } from "@/lib/calc/tables";
import {
  CMAA_ACCEL_TORQUE_KT,
  CMAA_APPLICATION_CLASSES,
  CMAA_DRIVE_CONTROLS,
  CMAA_DRIVE_CONTROL_LABELS,
  CMAA_MOTOR_CONTROLS,
  CMAA_MOTOR_CONTROL_LABELS,
  CMAA_SERVICE_FACTOR_KS,
} from "@/lib/calc/derive";
import { HOISTING_CLASS_FACTORS } from "@/lib/calc/modules/wheelLoads";
import {
  DIN15020_GROUPS,
  DIN15400_T3,
  HOOK_NUMBERS,
  HOOK_STRENGTH_CLASSES,
  HOOK_STRENGTH_CLASS_INFO,
  hookColumnIndex,
} from "@/lib/calc/hook-table";
import { DIN15407_ROWS, din15407Label } from "@/lib/calc/hook-standards";

/** Aktif satırın vurgulanması için sihirbazdan gelen sınıf bağlamı. */
export interface StandardContext {
  /** Bölümün ait olduğu mekanizmanın grubu (M1–M8) */
  mechanismClass?: string;
  /** Bölümün ait olduğu mekanizmanın kullanım sınıfı (T0–T9) */
  usageClass?: string;
  /** Çelik konstrüksiyon sınıfı (A1–A8) */
  structureClass?: string;
  /** Malzeme (S235 / S355 …) */
  material?: string;
  /** Yük grubu (B1–B6) */
  loadGroup?: string;
  /**
   * CMAA 70 uygulama (servis) sınıfı A…F — Ks tablosunun satır vurgusu için.
   * Yürütme bölümlerinde FEM mekanizma sınıfından türetilir
   * (`travelApplicationClass`).
   */
  applicationClass?: string;
}

export interface StandardTableDef {
  caption?: string;
  headers: string[];
  rows: (string | number)[][];
  /**
   * Satır vurgusu: satırın ilk hücresi, bağlamdaki bu anahtarın değeriyle
   * eşleşirse satır vurgulanır (ör. mechanismClass = "M6" → M6 satırı).
   */
  highlightBy?: keyof StandardContext;
  footnote?: string;
}

export interface StandardFormulaDef {
  label?: string;
  /** math/formula.ts sözdizimi — MathFormula ile dizilir */
  expr: string;
}

export interface StandardRef {
  /** Gösterilecek referans kodu (rozetteki metin) */
  code: string;
  title: string;
  /** Standardın tam adı (kaynak künyesi) */
  source: string;
  /** Madde / sayfa bilgisi */
  clause?: string;
  summary: string;
  formulas?: StandardFormulaDef[];
  tables?: StandardTableDef[];
  notes?: string[];
}

// --------------------------------------------------------------- yardımcılar

/**
 * DIN 15018 Tablo 17'yi motor sabitinden okunabilir tabloya çevirir.
 *
 * Satırlar YÜK GRUBUDUR (B1–B6), sütunlar çentik sınıfıdır: böylece
 * `highlightBy: "loadGroup"` ile hesabın kullandığı satır vurgulanabilir.
 * Malzeme başına ayrı bir tablo üretilir (tek tabloda iki eksen vurgulanamaz).
 */
const DIN15018_LOAD_GROUPS = ["B1", "B2", "B3", "B4", "B5", "B6"];
const DIN15018_NOTCHES = ["W0", "W1", "W2", "K0", "K1", "K2", "K3", "K4"];

function din15018T17Table(material: "St37" | "St52"): StandardTableDef {
  const rows: (string | number)[][] = DIN15018_LOAD_GROUPS.map((g) => [
    g,
    ...DIN15018_NOTCHES.map((notch) =>
      DIN15018_T17[material][notch][g].toLocaleString("tr-TR", {
        maximumFractionDigits: 1,
      })
    ),
  ]);
  return {
    caption:
      `${material === "St37" ? "St 37 (S235)" : "St 52 (S355)"} — ` +
      "izin verilen yorulma gerilmeleri zul σD(−1) [N/mm²]",
    headers: ["Yük grubu", ...DIN15018_NOTCHES],
    rows,
    highlightBy: "loadGroup",
    footnote:
      "W0–W2: kaynaksız (çentiksiz) çentik sınıfları; K0–K4: kaynaklı birleşim " +
      "çentik sınıfları. Yük grubu B1–B6, gerilme çevrim sayısı ve gerilme " +
      "kolektifinden belirlenir.",
  };
}

/**
 * CMAA 70 Tablo 5.2.9.1.2.1-E'yi MOTOR SABİTİNDEN üretir — defterde görünen
 * sayılar ile hesabın kullandığı sayılar tek kaynaktan gelir. Satır vurgusu
 * `applicationClass` bağlamıyla yapılır (satırın ilk hücresi sınıf koduysa).
 */
function cmaaServiceFactorTable(): StandardTableDef {
  const cols = CMAA_DRIVE_CONTROLS;
  return {
    caption: "Ks — CMAA servis sınıfı (satır) × tahrik/kumanda tipi (sütun)",
    headers: ["Servis sınıfı", ...cols.map((c) => CMAA_DRIVE_CONTROL_LABELS[c])],
    rows: CMAA_APPLICATION_CLASSES.map((cls) => [
      cls,
      ...cols.map((c) => {
        const v = CMAA_SERVICE_FACTOR_KS[cls][c];
        return v === null ? "N/A" : v.toLocaleString("tr-TR", { minimumFractionDigits: 2 });
      }),
    ]),
    highlightBy: "applicationClass",
    footnote:
      "Değerler CMAA Specification #70, Tablo 5.2.9.1.2.1-E'den birebir " +
      "alınmıştır. \"N/A\" = o sınıf için o kumanda tipi önerilmez.",
  };
}

/** CMAA 70 Tablo 5.2.9.1.2.1-C'yi motor sabitinden üretir. */
function cmaaAccelTorqueTable(): StandardTableDef {
  return {
    caption: "Kt — motor tipi × kumanda tipi",
    headers: ["Motor / kumanda", "Kt (katalog)", "Uygulamanın seçtiği"],
    rows: CMAA_MOTOR_CONTROLS.map((k) => {
      const r = CMAA_ACCEL_TORQUE_KT[k];
      const printed =
        r.min === r.max
          ? r.min.toLocaleString("tr-TR", { minimumFractionDigits: 2 })
          : `${r.min.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} – ${r.max.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
      return [
        CMAA_MOTOR_CONTROL_LABELS[k],
        printed,
        r.min.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      ];
    }),
    footnote:
      "Aralık verilen satırlarda alt uç seçilir (katalog dipnotu 2: sürekli " +
      "kayma direncinde alt uç önerilir).",
  };
}

/**
 * FEM Kitapçık 9 T.9.3.a'yı motor sabitinden üretir — tablo iki referansta
 * (md. 9.3 ve T.9.3.a) aynı verilerle görünsün diye tek fonksiyondur.
 */
function femHoistingClassTable(): StandardTableDef {
  return {
    caption: "T.9.3.a — β₂ [s/m] ve φ₂min",
    headers: ["Kaldırma sınıfı", "β₂", "φ₂min"],
    rows: Object.entries(HOISTING_CLASS_FACTORS).map(([cls, f]) => [
      cls,
      f.beta2.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
      f.phi2Min.toLocaleString("tr-TR", { minimumFractionDigits: 2 }),
    ]),
    footnote:
      "HC1: hassas kaldırma · HC2: normal · HC3: sert (kepçe, mıknatıs) · " +
      "HC4: çok sert (ağır hizmet).",
  };
}

/**
 * DIN 15407 Teil 1 Tablo 1 — lamel (Lamellen) tek ağızlı kancanın ana ölçüleri.
 * Satır sırası standardın kendi sırasıdır (ağız yarıçapı a₁ artan).
 */
function din15407Table(): StandardTableDef {
  return {
    caption: "Tablo 1 — Lamellen-Einfachhaken ana ölçüleri [mm]",
    headers: [
      "Kanca", "t", "a₁", "a₂", "b₁", "b₂", "d₁", "g₁", "l₁", "l₂", "s₁",
      "Lamel", "Vinç [t]",
    ],
    rows: DIN15407_ROWS.map((r) => [
      din15407Label(r), r.capacityT, r.a1, r.a2, r.b1, r.b2, r.d1, r.g1,
      r.l1, r.l2, r.s1, r.plateCount, r.craneCapacityT,
    ]),
    footnote:
      "Kancanın adı kapasite × ağız yarıçapıdır (\"Lamellenhaken DIN 15407 — " +
      "63 × 150\"): aynı tonaj iki farklı ağız yarıçapıyla iki ayrı kancadır. " +
      "Son sütun kancanın KENDİ kapasitesi değil, takıldığı döküm vincinin " +
      "kapasitesidir — pota iki kancaya asılır. a₁, d₁ ve l₁ özel şartlarda " +
      "değiştirilebilir (standardın 1 numaralı dipnotu).",
  };
}

/**
 * DIN 15400 Tablo 3'ü okunabilir biçime çevirir: satırlar kanca numarası,
 * sütunlar mukavemet sınıfı × mekanizma grubu. Her sınıf tabloda farklı bir
 * sütun penceresine oturduğundan gösterimde sınıf/grup başlıkları açık yazılır.
 */
function din15400T3Table(): StandardTableDef {
  const headers = [
    "Kanca No",
    ...HOOK_STRENGTH_CLASSES.flatMap((cls) =>
      DIN15020_GROUPS.map((g) => `${cls} · ${g}`)
    ),
  ];
  const rows: (string | number)[][] = HOOK_NUMBERS.map((nr) => {
    const row = DIN15400_T3[nr];
    return [
      nr,
      ...HOOK_STRENGTH_CLASSES.flatMap((cls) =>
        DIN15020_GROUPS.map((g) => {
          const idx = hookColumnIndex(cls, g);
          const v = idx >= 0 ? row[idx] : null;
          return v === null || v === undefined
            ? "–"
            : v.toLocaleString("tr-TR");
        })
      ),
    ];
  });
  return {
    caption: "Taşıma kapasitesi [kg] — mukavemet sınıfı × mekanizma grubu",
    headers,
    rows,
    footnote:
      "Sınıflar: " +
      HOOK_STRENGTH_CLASSES.map((c) => `${c} (${HOOK_STRENGTH_CLASS_INFO[c]})`).join(" · ") +
      ". FEM 1.001 karşılıkları: M1–M4 → 1Bm, M5 → 1Am, M6 → 2m, M7 → 3m, " +
      "M8 → 4m. 1Bm'den hafif çalışma dikkate alınmaz. “–” o sınıf/grup " +
      "birleşimi için tanımsız demektir.",
  };
}

// ------------------------------------------------------------------ FEM 1.001

const FEM_SOURCE = "FEM 1.001 3rd Edition Revised (1998-10-01)";

const FEM_REFS: Record<string, StandardRef> = {
  "FEM 1.001 T.2.1.3.2": {
    code: "FEM 1.001 T.2.1.3.2",
    title: "Mekanizma kullanım sınıfları T0–T9",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.1.3.2",
    summary:
      "Bir mekanizmanın toplam çalışma süresi (saat) kullanım sınıfına göre " +
      "sınıflandırılır. Rulman seçiminde gerekli teorik ömür (L10h) bu tablodaki " +
      "üst banttan alınır (madde 4.2.1.1).",
    tables: [
      {
        caption: "Toplam kullanım süresi T [saat]",
        headers: ["Sınıf", "Toplam kullanım süresi T (h)"],
        rows: [
          ["T0", "T ≤ 200"],
          ["T1", "200 < T ≤ 400"],
          ["T2", "400 < T ≤ 800"],
          ["T3", "800 < T ≤ 1 600"],
          ["T4", "1 600 < T ≤ 3 200"],
          ["T5", "3 200 < T ≤ 6 300"],
          ["T6", "6 300 < T ≤ 12 500"],
          ["T7", "12 500 < T ≤ 25 000"],
          ["T8", "25 000 < T ≤ 50 000"],
          ["T9", "50 000 < T"],
        ],
        highlightBy: "usageClass",
      },
    ],
    notes: [
      "Mekanizma grubu M1–M8, kullanım sınıfı (T) ile yük spektrumu sınıfının (L) " +
        "birleşiminden belirlenir (Tablo T.2.1.3.4).",
    ],
  },

  "FEM 1.001 T.2.3.4": {
    code: "FEM 1.001 T.2.3.4",
    title: "Yük arttırma katsayısı γC",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.3.4",
    summary:
      "Yapı hesabında I/II/III yükleme durumlarındaki tüm yükler, vincin grup " +
      "sınıflandırmasına (A1–A8) bağlı γC katsayısıyla çarpılır.",
    formulas: [{ expr: "S = γ_c · (S_G + ψ · S_L + S_H)" }],
    tables: [
      {
        headers: ["Vinç grubu", "γC"],
        rows: [
          ["A1", "1,00"],
          ["A2", "1,02"],
          ["A3", "1,05"],
          ["A4", "1,08"],
          ["A5", "1,11"],
          ["A6", "1,14"],
          ["A7", "1,17"],
          ["A8", "1,20"],
        ],
        highlightBy: "structureClass",
      },
    ],
  },

  "FEM 1.001 T.2.6": {
    code: "FEM 1.001 T.2.6",
    title: "Mekanizma arttırma katsayısı γm",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.6",
    summary:
      "Mekanizma elemanlarının hesabında yükler, mekanizmanın grup " +
      "sınıflandırmasına (M1–M8) bağlı γm katsayısıyla çarpılır.",
    tables: [
      {
        headers: ["Mekanizma grubu", "γm"],
        rows: [
          ["M1", "1,00"],
          ["M2", "1,04"],
          ["M3", "1,08"],
          ["M4", "1,12"],
          ["M5", "1,16"],
          ["M6", "1,20"],
          ["M7", "1,25"],
          ["M8", "1,30"],
        ],
        highlightBy: "mechanismClass",
      },
    ],
  },

  "FEM 1.001 T.3.2.1.1": {
    code: "FEM 1.001 T.3.2.1.1",
    title: "Yapı çelikleri için izin verilen gerilmeler σa",
    source: FEM_SOURCE,
    clause: "Booklet 3, madde 3.2.1.1",
    summary:
      "Elastik sınıra göre kontrolde izin verilen gerilme σa = σE / νE. Emniyet " +
      "katsayısı νE yükleme durumuna göre 1,5 (I) / 1,33 (II) / 1,1 (III) alınır.",
    formulas: [
      { label: "Basit çekme / basınç", expr: "σ_em = σ_E / ν_E" },
      { label: "Kayma", expr: "τ_em = σ_em / √3" },
      {
        label: "Bileşik (von Mises)",
        expr: "σ_bil = √(σ_x² + σ_y² − σ_x·σ_y + 3·τ_xy²)",
      },
    ],
    tables: [
      {
        caption: "σE ve σa [N/mm²]",
        headers: ["Çelik", "σE", "σa — Durum I", "σa — Durum II", "σa — Durum III"],
        rows: [
          ["E.24 (Fe 360 ≈ S235)", 240, 160, 180, 215],
          ["E.26 (Fe 430)", 260, 175, 195, 240],
          ["E.36 (Fe 510 ≈ S355)", 360, 240, 270, 325],
        ],
        footnote:
          "σE, %0,2 kalıcı uzamaya karşılık gelen akma gerilmesi olarak alınır. " +
          "σE/σR > 0,7 olan yüksek elastik limitli çeliklerde σa ayrı bir " +
          "orantı bağıntısıyla hesaplanır.",
      },
      {
        caption: "Emniyet katsayısı νE",
        headers: ["Yükleme durumu", "νE"],
        rows: [
          ["Durum I — normal işletme (rüzgârsız)", "1,50"],
          ["Durum II — normal işletme (rüzgârlı)", "1,33"],
          ["Durum III — istisnai yükler / test", "1,10"],
        ],
      },
    ],
  },

  "FEM 1.001 T.3.2.2.3": {
    code: "FEM 1.001 T.3.2.2.3",
    title: "Kaynak dikişlerinde izin verilen gerilmeler",
    source: FEM_SOURCE,
    clause: "Booklet 3, madde 3.2.2.3 (kaynaklı birleşimler)",
    summary:
      "Kaynak dikişinde izin verilen gerilme, dikiş TÜRÜNE (küt / köşe), " +
      "zorlama biçimine (çekme · basınç · kayma) ve yükleme durumuna bağlıdır. " +
      "Köşe (fillet) dikişte enine çekme ile kayma AYNI sınırı paylaşır; " +
      "boğaz kesitine indirgenmiş gerilme bu değeri aşamaz. Uygulama tambur " +
      "ve tambur mili kaynaklarında yalnız normal işletmeyi hesapladığından " +
      "en muhafazakâr olan Durum I sütunu kullanılır.",
    formulas: [
      { label: "Boğaz kesiti alanı (Ek A-3.2.2.3 HESAP-4)", expr: "A_k = a · L_k" },
      {
        label: "Eşdeğer gerilme (Ek A-3.2.2.3 HESAP-3)",
        expr: "σ_cp = (σ² + 2 · τ²)^0,5 ≤ σ_a,k",
      },
      {
        label: "İki normal gerilmeli hâl (Ek A-3.2.2.3 HESAP-3)",
        expr: "σ_cp = (σx² + σy² − σx · σy + 2 · τxy²)^0,5",
      },
    ],
    tables: [
      {
        caption: "Köşe (fillet) dikiş — izin verilen gerilme σa,k [N/mm²]",
        headers: ["Çelik", "Durum I", "Durum II", "Durum III"],
        rows: [
          ["A.37 (Fe 360 ≈ S235)", 113, 127, 152],
          ["A.42 (Fe 430)", 124, 138, 170],
          ["A.52 (Fe 510 ≈ S355)", 170, 191, 230],
        ],
        footnote:
          "Köşe dikişte enine çekme ve kayma satırları aynı değeri verdiğinden " +
          "iki etkiyi birden gören tambur/mil dikişlerinde bu ortak değer sınırdır. " +
          "Küt (tam nüfuziyetli) dikişlerin sınırı ana metalinkiyle aynıdır.",
      },
    ],
    notes: [
      "Dayanım hesabında ZAYIF ana metal yönetir: madde 3.2.2.3 kaynak metalinin " +
        "en az ana metal kadar iyi olduğunu varsayar. Tambur–göbek ve mil–göbek " +
        "dikişlerinde zayıf taraf her zaman yapı çeliğinden yanak/göbek sacıdır; " +
        "mil malzemesi (C30, 42CrMo4 …) ıslah çeliğidir ve daha dayanıklıdır.",
      "EŞDEĞER GERİLMEDE KAYMA TERİMİNİN KATSAYISI 2'DİR (Ek A-3.2.2.3 HESAP-3, " +
        "standardın basılı metni: “σcp = ( σ2 + 2 . τ2 )0,5”). " +
        "√(σ² + τ²) yazmak dikişi olduğundan EMNİYETLİ gösterir.",
      "TAŞIYICI KESİT BOĞAZ KESİTİDİR (Ek A-3.2.2.3 HESAP-4): köşe dikişte hesaba " +
        "giren genişlik boğaz derinliği, uzunluk ise dikişin etkin boyudur. " +
        "Dikişin izdüşüm halka alanı taşıyıcı kesit değildir.",
      "Uygulama bu sınırı CMAA 70 md. 3.4.4.2'nin asal gerilme kuralıyla " +
        "BİRLİKTE hesaplar; iki standardın kullanım oranından BÜYÜĞÜ yönetir. " +
        "İki sınır doğrudan karşılaştırılmaz — her standart kendi gerilmesini " +
        "tanımlar.",
    ],
  },

  "FEM 1.001 T.4.2.2.1.2": {
    code: "FEM 1.001 T.4.2.2.1.2",
    title: "Halat minimum pratik emniyet katsayısı Zp",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2.2.1.2.1",
    summary:
      "Halat emniyet katsayısı Zp = F0 / S olarak tanımlanır: F0 halatın minimum " +
      "kopma yükü, S maksimum halat çekme kuvvetidir. Gerekli minimum Zp, " +
      "mekanizmanın grup sınıflandırmasına bağlıdır.",
    formulas: [{ expr: "Z_p = F₀ / S" }],
    tables: [
      {
        headers: [
          "Mekanizma grubu",
          "Zp — Hareketli halat",
          "Zp — Sabit (taşıyıcı) halat",
        ],
        rows: [
          ["M1", "3,15", "2,50"],
          ["M2", "3,35", "2,50"],
          ["M3", "3,55", "3,00"],
          ["M4", "4,00", "3,50"],
          ["M5", "4,50", "4,00"],
          ["M6", "5,60", "4,50"],
          ["M7", "7,10", "5,00"],
          ["M8", "9,00", "5,00"],
        ],
        highlightBy: "mechanismClass",
      },
    ],
    notes: [
      "Maksimum halat çekme kuvveti S; güvenli çalışma yükü, kanca bloğu ve " +
        "aksesuar ağırlıkları, palanga oranı ve palanga verimi dikkate alınarak " +
        "bulunur. İvme yükleri statik yükün %10'unu aşıyorsa ve halatın kaldırma " +
        "eksenine açısı 22,5°'yi geçiyorsa bunlar da hesaba katılır (4.2.2.1.1.1).",
      "Alternatif C-faktörü yöntemi (4.2.2.1.3) yalnız hareketli halatlar için " +
        "geçerlidir: d ≥ C·√S.",
    ],
  },

  "FEM 1.001 T.4.2.3.1.1": {
    code: "FEM 1.001 T.4.2.3.1.1",
    title: "Minimum tambur / makara çapı katsayısı H",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2.3.1.1",
    summary:
      "Halat ekseninden ölçülen minimum sarım çapı D ≥ H · d bağıntısıyla " +
      "bulunur; H mekanizma grubuna ve elemana (tambur / makara / dengeleme " +
      "makarası) bağlıdır.",
    formulas: [{ expr: "D ≥ H · d" }],
    tables: [
      {
        headers: ["Mekanizma grubu", "Tambur", "Makara", "Dengeleme makarası"],
        rows: [
          ["M1", "11,2", "12,5", "11,2"],
          ["M2", "12,5", "14", "12,5"],
          ["M3", "14", "16", "12,5"],
          ["M4", "16", "18", "14"],
          ["M5", "18", "20", "14"],
          ["M6", "20", "22,4", "16"],
          ["M7", "22,4", "25", "16"],
          ["M8", "25", "28", "18"],
        ],
        highlightBy: "mechanismClass",
      },
    ],
    notes: [
      "Makarada H tamburdan büyüktür: halat bir çevrimde makara üzerinde iki kat " +
        "fazla eğilme tersinmesi görür. Dengeleme makarasında hareket sınırlı " +
        "olduğundan H daha düşüktür.",
      "Yiv dip yarıçapı r = 0,53 · d (madde 4.2.3.2).",
      "Halat tamamen açıldığında, uç bağlantısından önce tamburda en az 2 tam " +
        "sarım kalmalıdır (madde 4.2.3.3).",
    ],
  },

  "FEM 1.001 T.4.2.4.1.3 / T.9.12.a": {
    code: "FEM 1.001 T.4.2.4.1.3",
    title: "Tekerlek limit basıncı PL",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2.4.1.3 (+ Booklet 9, Tablo T.9.12.a)",
    summary:
      "Tekerlek/ray temasında izin verilen kavramsal basınç PL, teker " +
      "malzemesinin kopma dayanımına bağlıdır. Kontrol: Pmean / (b · D) ≤ PL · c1 · c2.",
    formulas: [
      { label: "Ortalama teker yükü", expr: "P_ort = (P_min + 2 · P_maks) / 3" },
      { label: "Kontrol", expr: "P_ort / (b · D) ≤ P_L · c₁ · c₂" },
    ],
    tables: [
      {
        headers: ["Teker malzemesi kopma dayanımı σR", "PL [N/mm²]"],
        rows: [
          ["σR > 500 N/mm²", "5,0"],
          ["σR > 600 N/mm²", "5,6"],
          ["σR > 700 N/mm²", "6,5"],
          ["σR > 800 N/mm²", "7,2"],
          ["σR > 900 N/mm² (Booklet 9, T.9.12.a)", "7,8"],
          ["σR > 1000 N/mm² (Booklet 9, T.9.12.a)", "8,5"],
        ],
        footnote:
          "900 ve 1000 N/mm² satırları Booklet 9 Tablo T.9.12.a'dandır ve ray " +
          "malzemesi için asgari mukavemet şartı getirir (sırasıyla ≥ 600 ve " +
          "≥ 700 N/mm²).",
      },
    ],
    notes: [
      "Faydalı ray genişliği b: düz oturma yüzeyinde b = l − 2r, bombeli " +
        "yüzeyde b = l − 4r/3 (madde 4.2.4.1.2).",
      "Formüller D ≤ 1,25 m tekerler için geçerlidir.",
      "Yüzey sertleştirilmiş tekerlerde PL, yüzey işlemi öncesi çelik kalitesine " +
        "göre sınırlanır; sertleştirilmiş dökme demir tekerde PL = 5 N/mm² alınır.",
    ],
  },

  "FEM 1.001 T.4.2.4.1.4.a": {
    code: "FEM 1.001 T.4.2.4.1.4.a",
    title: "Teker devir katsayısı c1",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2.4.1.4",
    summary:
      "c1, tekerleğin dakikadaki devir sayısına bağlı düzeltme katsayısıdır. " +
      "Tablo T.4.2.4.1.4.b aynı değerleri teker çapı × yürüyüş hızı matrisi " +
      "olarak verir; uygulamada bu matris kullanılır.",
    tables: [
      {
        caption: "Devir sayısına göre c1",
        headers: ["Devir [d/dak]", "c1", "Devir [d/dak]", "c1", "Devir [d/dak]", "c1"],
        rows: [
          ["200", "0,66", "50", "0,94", "16", "1,09"],
          ["160", "0,72", "45", "0,96", "14", "1,10"],
          ["125", "0,77", "40", "0,97", "12,5", "1,11"],
          ["112", "0,79", "35,5", "0,99", "11,2", "1,12"],
          ["100", "0,82", "31,5", "1,00", "10", "1,13"],
          ["90", "0,84", "28", "1,02", "8", "1,14"],
          ["80", "0,87", "25", "1,03", "6,3", "1,15"],
          ["71", "0,89", "22,4", "1,04", "5,6", "1,16"],
          ["63", "0,91", "20", "1,06", "5", "1,17"],
          ["56", "0,92", "18", "1,07", "", ""],
        ],
      },
    ],
  },

  "FEM 1.001 T.4.2.4.1.5": {
    code: "FEM 1.001 T.4.2.4.1.5",
    title: "Mekanizma katsayısı c2 (tekerlek)",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2.4.1.5",
    summary:
      "c2, tekerleğin bağlı olduğu yürütme mekanizmasının grup " +
      "sınıflandırmasına bağlı düzeltme katsayısıdır.",
    tables: [
      {
        headers: ["Mekanizma grubu", "c2"],
        rows: [
          ["M1", "1,12"],
          ["M2", "1,12"],
          ["M3", "1,12"],
          ["M4", "1,12"],
          ["M5", "1,00"],
          ["M6", "0,90"],
          ["M7", "0,80"],
          ["M8", "0,80"],
        ],
        highlightBy: "mechanismClass",
      },
    ],
    notes: [
      "Booklet 9 Tablo T.9.12.b, M1–M2 için 1,25 değerini verir (daha yeni kabul).",
    ],
  },

  "FEM 1.001 3.4": {
    code: "FEM 1.001 3.4",
    title: "Burkulmaya (buruşmaya) karşı kontrol — emniyet katsayısı νv",
    source: FEM_SOURCE,
    clause: "Booklet 3, madde 3.4 (Booklet 9 md. 9.10 ile güncellenmiş)",
    summary:
      "Hesaplanan gerilmenin, kritik burkulma gerilmesinin νv'ye bölünmüş " +
      "hâlini aşmadığı doğrulanır. Plaka genişliği boyunca gerilme DÜZGÜN " +
      "dağıldığında (ψ = +1) burkulma tehlikesi en büyüktür; bu yüzden emniyet " +
      "katsayısı ψ'ye bağlıdır ve ψ = +1'de en yüksek değerini alır. Kenar " +
      "gerilmeleri oranı ψ, +1 ile −1 arasında değişir.",
    formulas: [
      { label: "Durum I", expr: "νv = 1,70 + 0,175 · (ψ − 1)" },
      { label: "Durum II", expr: "νv = 1,50 + 0,125 · (ψ − 1)" },
      { label: "Durum III", expr: "νv = 1,35 + 0,075 · (ψ − 1)" },
      { label: "İzin verilen gerilme", expr: "σ_izin = σ_vcrc / νv" },
    ],
    tables: [
      {
        caption: "Tablo T.9.10 — buruşma emniyet katsayısı νv",
        headers: ["Yükleme durumu", "Düzlem elemanlar (plaka)", "ψ = +1", "ψ = −1", "Eğri elemanlar"],
        rows: [
          ["I — normal işletme", "1,70 + 0,175·(ψ − 1)", "1,70", "1,35", "1,70"],
          ["II — rüzgârlı işletme", "1,50 + 0,125·(ψ − 1)", "1,50", "1,25", "1,50"],
          ["III — test / olağanüstü", "1,35 + 0,075·(ψ − 1)", "1,35", "1,20", "1,35"],
        ],
        footnote:
          "Eğri elemanlarda (dairesel silindirler, borular) katsayı ψ'den " +
          "bağımsızdır. Kritik gerilmenin belirlenmesi için bkz. Appendix A-3.4.",
      },
    ],
    notes: [
      "Uygulama Durum I ve Durum III'ü hesaplar. Durum II rüzgâr yükü " +
        "gerektirir; rüzgâr uygulamanın hiçbir modülünde modellenmediğinden " +
        "buruşmada da kapsam dışıdır ve raporda bilgi kontrolüyle belirtilir.",
      "ψ tanım gereği [−1, +1] aralığındadır; çekme baskın eğilmede (ψ < −1) " +
        "νv hesabında ψ = −1 alınır, Kσ ise T.A.3.4.1 durum 3'ten okunur.",
    ],
  },

  "FEM 1.001 T.A.3.4.2": {
    code: "FEM 1.001 T.A.3.4.2",
    title: "Orantı sınırı ve indirgeme katsayısı ρ",
    source: FEM_SOURCE,
    clause: "Booklet 3, Appendix A-3.4 (Tablo T.A.3.4.2)",
    summary:
      "Elastik burkulma bağıntıları YALNIZ orantı sınırının altında " +
      "geçerlidir: St 37 için 190 N/mm², St 52 için 290 N/mm². Hesaplanan " +
      "kritik gerilme bu sınırı aşarsa gerçek kritik gerilme plastikleşme " +
      "nedeniyle daha küçüktür ve tablodaki ρ katsayısıyla indirgenir. Kayma " +
      "için koşul √3·τvcr ≤ orantı sınırı biçimindedir; bu yüzden τ sütunu σ " +
      "sütununun √3'e bölünmüş hâlidir.",
    formulas: [
      { label: "İndirgenmiş kritik gerilme", expr: "σ_vcr,ind = ρ · σ_vcr" },
      { label: "Kayma koşulu", expr: "3^0,5 · τ_vcr ≤ σ_P" },
    ],
    tables: [
      {
        caption: "St 37 (Fe 360) — orantı sınırı 190 N/mm²",
        headers: ["σvcr hesaplanan", "τvcr hesaplanan", "ρ", "σvcr indirgenmiş", "τvcr indirgenmiş"],
        rows: [
          [190, 110, "1,00", 190, 110],
          [200, 116, "0,97", 194, 113],
          [210, 121, "0,94", 197, 114],
          [220, 127, "0,91", 200, 116],
          [230, 133, "0,88", 202, 117],
          [240, 139, "0,85", 204, 118],
          [250, 145, "0,82", 206, 119],
          [260, 150, "0,80", 208, 120],
          [280, 162, "0,76", 212, 122],
          [300, 173, "0,72", 215, 124],
          [340, 197, "0,65", 221, 128],
        ],
      },
      {
        caption: "St 52 (Fe 510) — orantı sınırı 290 N/mm²",
        headers: ["σvcr hesaplanan", "τvcr hesaplanan", "ρ", "σvcr indirgenmiş", "τvcr indirgenmiş"],
        rows: [
          [290, 168, "1,00", 290, 168],
          [300, 173, "0,98", 294, 169],
          [310, 179, "0,96", 297, 172],
          [320, 185, "0,94", 300, 174],
          [330, 191, "0,92", 303, 175],
          [340, 196, "0,90", 306, 176],
          [350, 202, "0,88", 308, 177],
          [360, 208, "0,86", 309, 178],
          [380, 220, "0,82", 312, 180],
          [400, 231, "0,79", 316, 182],
          [440, 254, "0,73", 322, 185],
        ],
      },
    ],
    notes: [
      "Ara değerlerde uygulama İNDİRGENMİŞ DEĞER üzerinden doğrusal " +
        "enterpolasyon yapar; bu yol sonucun tablodaki gibi monoton artmasını " +
        "garanti eder (ρ üzerinden enterpolasyonla farkı binde birkaçtır).",
      "Tablonun son satırının ötesinde indirgenmiş değer SABİT tutulur " +
        "(St 37 → 221, St 52 → 322 N/mm²). Gerçek eğri akma sınırına doğru çok " +
        "yavaş yükselmeye devam eder; sabitlemek kapasiteyi olduğundan küçük " +
        "gösterir, yani emniyetli taraftadır — belgelenmiş firma kabulüdür.",
      "FEM tabloyu yalnız St 37 ve St 52 için verir. St 44 için uygulama " +
        "emniyetli tarafta kalmak üzere St 37 satırlarını kullanır.",
    ],
  },

  "FEM 1.001 T.A.3.4.1": {
    code: "FEM 1.001 T.A.3.4.1",
    title: "Plaka burkulma katsayıları Kσ ve Kτ",
    source: FEM_SOURCE,
    clause: "Booklet 3, Appendix A-3.4",
    summary:
      "Dört kenarı mesnetli plakalarda kritik burkulma gerilmeleri " +
      "σv,cr = Kσ · σE,R ve τv,cr = Kτ · σE,R bağıntılarıyla bulunur. " +
      "Kσ ve Kτ, kenar oranı α = a/b ve gerilme dağılımı ψ'ye bağlıdır.",
    formulas: [
      { label: "Euler referans gerilmesi", expr: "σ_ER = 189800 · (e/b)²" },
      { label: "Basınç", expr: "σ_vcr = K_σ · σ_ER" },
      { label: "Kayma", expr: "τ_vcr = K_τ · σ_ER" },
    ],
    tables: [
      {
        headers: ["Durum", "Kenar oranı", "Kσ / Kτ"],
        rows: [
          ["1 — Üniform basınç", "α ≥ 1", "Kσ = 4"],
          ["1 — Üniform basınç", "α ≤ 1", "Kσ = (α + 1/α)²"],
          ["2 — Üniform olmayan basınç (0 ≤ ψ < 1)", "α ≥ 1", "Kσ = 8,4 / (ψ + 1,1)"],
          ["2 — Üniform olmayan basınç (0 ≤ ψ < 1)", "α ≤ 1", "Kσ = 2,1·(α + 1/α)² / (ψ + 1,1)"],
          ["3 — Saf eğilme (ψ = −1)", "α ≥ 2/3", "Kσ = 23,9"],
          ["3 — Saf eğilme (ψ = −1)", "α ≤ 2/3", "Kσ = 15,87 + 1,87/α² + 8,6·α²"],
          ["4 — Basınç baskın eğilme (−1 < ψ < 0)", "—", "Kσ = (1+ψ)·K′ − ψ·K″ + 10·ψ·(1+ψ)"],
          ["5 — Saf kayma", "α ≥ 1", "Kτ = 5,34 + 4/α²"],
          ["5 — Saf kayma", "α ≤ 1", "Kτ = 4 + 5,34/α²"],
        ],
        footnote:
          "K′: durum 2'nin ψ = 0 değeri, K″: durum 3 (saf eğilme) değeri. " +
          "e: plaka kalınlığı, b: basınç kuvvetlerine dik plaka genişliği.",
      },
    ],
    notes: [
      "Formüller yalnız orantı sınırının altında geçerlidir (St 37 için " +
        "190 N/mm², St 52 için 290 N/mm²); üzerinde kritik değerler ρ " +
        "katsayısıyla azaltılır (Tablo T.A.3.4.2).",
      "Burkulma emniyet katsayısı: Durum I → νv = 1,7 + 0,175·(ψ − 1); " +
        "Durum II → 1,5 + 0,125·(ψ − 1); Durum III → 1,35 + 0,075·(ψ − 1).",
    ],
  },

  "FEM 1.001 A-3.4": {
    code: "FEM 1.001 A-3.4",
    title: "Plaka burkulması (Appendix A-3.4)",
    source: FEM_SOURCE,
    clause: "Booklet 3, Appendix A-3.4",
    summary:
      "Basınç ve kayma altındaki ince cidarlı plakaların (kutu kesitin yan ve " +
      "üst sacları) burkulma kontrolü. Kritik karşılaştırma gerilmesi σv,cr,c " +
      "hesaplanır ve gerçekleşen bileşik gerilmeyle karşılaştırılır.",
    formulas: [
      { expr: "σ_ER = 189800 · (e/b)²" },
      {
        label: "Bileşik basınç + kayma",
        expr:
          "σ_vcrc = √(σ² + 3·τ²) / ((1 + ψ)/4 · (σ/σ_vcr) + √((0,25·(3 − ψ)·(σ/σ_vcr))² + (τ/τ_vcr)²))",
      },
    ],
    notes: [
      "Kσ / Kτ katsayıları için bkz. Tablo T.A.3.4.1; orantı sınırı ve ρ " +
        "indirgemesi için Tablo T.A.3.4.2; emniyet katsayısı νv için madde 3.4.",
      "DİKKAT — standardın BASILI metninde σ_vcrc bağıntısında karekökün " +
        "içindeki iki terim arasında çarpma işareti görünür; bu bir dizgi " +
        "hatasıdır. Standardın kendi çözümlü örneği (σ = 28, τ = 47, ψ = −0,79, " +
        "σ_vcr = 158,5, τ_vcr = 99 → σ_vcrc = 168 N/mm²) yalnız TOPLAMA ile " +
        "çıkar; çarpma yorumu 965 N/mm² verir. Toplama ayrıca τ = 0'da " +
        "σ_vcrc = σ_vcr, σ = 0'da σ_vcrc = √3·τ_vcr sınır hâllerini sağlar. " +
        "Bağıntının kaynağı DIN 4114'tür ve orada da toplamalıdır.",
      "İşaret kuralı: σ1 panelin BASINÇ kenarı gerilmesidir, σ2 karşı kenardır " +
        "ve çekme ise ters işaretlidir. Bağıntıya σ mutlak değeriyle girer; " +
        "işaretin etkisi yalnız ψ üzerindendir.",
      "σ ve τ aynı noktanın gerilmeleri değildir: σ panelin kenar eğilme " +
        "gerilmesi, τ ise panelin ortalama kaymasıdır. Bu FEM'in kasıtlı " +
        "panel kabulüdür.",
    ],
  },

  "FEM 1.001 2.2.2.1.1": {
    code: "FEM 1.001 2.2.2.1.1",
    title: "Dinamik katsayı ψ (kaldırma yükü)",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.2.2.1.1",
    summary:
      "Yükün yerden alınmasındaki dinamik etkiler, kaldırma yükünün ψ dinamik " +
      "katsayısıyla çarpılmasıyla dikkate alınır.",
    formulas: [{ expr: "ψ = 1 + ξ · V_L" }],
    tables: [
      {
        headers: ["Vinç tipi", "ξ"],
        rows: [
          ["Köprülü / gezer vinç", "0,6"],
          ["Pergel (jib) vinç", "0,3"],
        ],
      },
    ],
    notes: [
      "V_L: kaldırma hızı [m/s]. ψ hiçbir durumda 1,15'ten küçük alınmaz; " +
        "V_L > 1 m/s için üst sınır uygulanır.",
      "DIN 15018 Tablo 2, aynı etkiyi kaldırma sınıfı H1–H4 üzerinden " +
        "ψ = k + l·v biçiminde verir.",
    ],
  },

  "FEM 1.001 2.2.3.1.1": {
    code: "FEM 1.001 2.2.3.1.1",
    title: "Yatay hareketten doğan yükler",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.2.3.1.1",
    summary:
      "Yürütme hareketinin hızlanma/yavaşlamasından doğan yatay atalet yükleri. " +
      "Tahrik tekerleğine gelen yatay kuvvet, tekerlek yükünün 1/30 ile 1/4'ü " +
      "arasında kalacak şekilde sınırlandırılır.",
    notes: [
      "Tablo T.2.2.3.1.1 yalnız kılavuz ivme/hızlanma süresi değerleri verir; " +
        "yatay yükün kendisi mekanizma verilerinden hesaplanır.",
      "Çapraz yürüyüş yükleri için madde 2.2.3.3: λ katsayısı p/a " +
        "oranına bağlıdır (p/a = 2…8 → λ = 0,05…0,20).",
    ],
  },

  "FEM 1.001 2.2.3.3": {
    code: "FEM 1.001 2.2.3.3",
    title: "Çapraz yürüyüşten doğan enine reaksiyonlar (λ katsayısı)",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.2.3.3",
    summary:
      "İki tekerlek (ya da iki boji) ray üzerinde yuvarlanırken raya dik bir " +
      "yatay kuvvet çifti doğar. Bileşenler, tekerleğin düşey yükünün λ " +
      "katsayısıyla çarpımıdır; λ, açıklık p'nin dingil mesafesi a'ya oranına " +
      "bağlıdır.",
    formulas: [
      { label: "Enine kuvvet", expr: "F_hλ = λ · P_düşey" },
      { label: "Uygulamadaki bağıntı", expr: "λ = 0,025 · p / a" },
    ],
    tables: [
      {
        caption: "λ katsayısı (grafikten okunur)",
        headers: ["p / a", "λ"],
        rows: [
          ["2", "0,05"],
          ["4", "0,10"],
          ["6", "0,15"],
          ["8", "0,20"],
        ],
        footnote:
          "p/a < 2 için λ = 0,05, p/a > 8 için λ = 0,20 alınır (band dışına " +
          "çıkılmaz). “Dingil mesafesi” en dıştaki tekerlek çiftlerinin merkez " +
          "mesafesidir; bojide boji pivot merkezleri arası alınır.",
      },
    ],
    notes: [
      "Uygulama λ'yı p/a oranından doğrusal olarak türetir ve 0,05 … 0,20 " +
        "bandına kırpar — tablo değerleriyle birebir örtüşür.",
    ],
  },

  "FEM 1.001 2.2.3.4.1": {
    code: "FEM 1.001 2.2.3.4.1",
    title: "Tampon çarpma etkisi (yapıya)",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.2.3.4.1 (Booklet 9, md. 9.4.2 ile değiştirilmiş)",
    summary:
      "Vincin tamponla çarpışmasından doğan tepki kuvveti. Yük salınabiliyorsa " +
      "çarpma enerjisi vincin (yüksüz) kinetik enerjisinden hesaplanır; yük " +
      "rijit kılavuzluysa kaldırılan yük de hesaba katılır.",
    notes: [
      "Booklet 2 eşiği 0,7 m/s idi; Booklet 9 md. 9.4.2 bunu 0,4 m/s'ye " +
        "indirmiştir — uygulama 0,4 m/s eşiğini kullanır.",
      "Tampon enerjisi, vincin nominal hızının %70'ini soğuracak biçimde " +
        "boyutlandırılır (Vt = 0,7·V).",
      "Tampon tepki kuvveti ayrıca köprü yürütme bölümünde hesaplanır; teker " +
        "yükleri bölümü aynı değeri yol kirişi yüklerine taşır.",
      "Standardın özgün metni: \"It shall be assumed that a buffer is capable " +
        "of absorbing the kinetic energy of the appliance (without the working " +
        "load) at a fraction of the rated speed Vt fixed at 0.7 Vt.\"",
    ],
    formulas: [
      { label: "Çarpma hızı", expr: "v_ç = (v / 60) · k" },
      { label: "Çarpma enerjisi", expr: "E_kin = 0,5 · m_t · v_ç^2" },
      { label: "Tahrik kuvveti", expr: "F_0 = P / v" },
      { label: "Sönümlenecek enerji", expr: "E_a = E_kin + F_0 · f'" },
    ],
  },

  "FEM 1.001 9.4.2": {
    code: "FEM 1.001 9.4.2",
    title: "Tampon etkisinin yapıya aktarılma eşiği",
    source: FEM_SOURCE,
    clause: "Booklet 9, madde 9.4.2 (Booklet 2 md. 2.2.3.4.1'i değiştirir)",
    summary:
      "Kitapçık 9'un bu maddesi tek cümledir: \"In clause 2.2.3.4.1 replace " +
      "0,7 m/s with 0,4 m/s\". Yani tampon tepkisinin YAPIYA taşınması için " +
      "eşik yürüyüş hızı 0,7 m/s'den 0,4 m/s'ye indirilmiştir.",
    tables: [
      {
        caption: "Eşik hızın etkisi",
        headers: ["Anma yürüyüş hızı", "Tampon boyutlandırması", "Yapı yüklemesi"],
        rows: [
          ["v ≤ 0,4 m/s", "Yapılır", "Tampon tepkisi yapıya taşınmaz"],
          ["v > 0,4 m/s", "Yapılır", "Tepki Yükleme Durumu III'e girer"],
        ],
      },
    ],
    notes: [
      "Eşiğin altında tampon YİNE boyutlandırılır — madde yalnız yapıya " +
        "aktarılan tepkiyi kapsam dışı bırakır.",
      "Uygulamada aynı eşik `modules/wheelLoads.ts` içinde de kullanılır; " +
        "iki yer tek sayıyı paylaşır (BUFFER_SPEED_THRESHOLD).",
    ],
  },

  "FEM 1.001 7.7.1.2": {
    code: "FEM 1.001 7.7.1.2",
    title: "Yürütme tahrikleri — tampon ve yavaşlama sınırı",
    source: FEM_SOURCE,
    clause: "Booklet 7, madde 7.7.1.2 (Emniyet tertibatları)",
    summary:
      "Tahrikli vinç ve arabalar; hareket eden kütlelerin anma yürüyüş " +
      "hızındaki enerjisinin YARISINI yutabilen pabuç fren, kauçuk, yay ya da " +
      "hidrolik tamponlarla donatılmalıdır. Kabin içindeki azami yavaşlama " +
      "5 m/s²'yi aşamaz.",
    tables: [
      {
        caption: "Azami yavaşlama sınırı",
        headers: ["Durum", "a_maks [m/s²]"],
        rows: [
          ["Normal işletme", "5,0"],
          ["Yürüyüş sınırına normal işletmede SIK ulaşılıyorsa", "2,5"],
          ["İki vincin aynı yolda çarpışması", "5,0 (hiçbir koşulda aşılamaz)"],
        ],
      },
    ],
    notes: [
      "Uygulama iki yavaşlamayı da hesaplar: ortalama a = v_ç²/(2·f′) ve azami " +
        "a = F_t/m_t; kontrol büyük olanı sınıra karşı yapar.",
      "Radyo kumandalı vinç ve arabalarda yürüyüş hızı 40 m/dak'yı aşıyorsa " +
        "ayrıca yürüyüş sınır şalteri istenir.",
    ],
  },

  "FEM 1.001 9.3": {
    code: "FEM 1.001 9.3",
    title: "Dinamik katsayı φ2 — yerden yük alma",
    source: FEM_SOURCE,
    clause: "Booklet 9, madde 9.3 (Booklet 2 md. 2.2.2.1.1 yerine geçer)",
    summary:
      "Serbest duran bir yükün yerden alınması sırasındaki dinamik etki, " +
      "kaldırma yükünün ağırlık kuvvetini φ2 ile çarparak hesaba katılır. " +
      "Kaldırma yükü; kaldırılan yükü, kaldırma aparatını ve asılı halatın bir " +
      "bölümünü kapsar. Ölü yük (köprü, araba) φ2 ile büyütülmez.",
    formulas: [{ label: "Dinamik katsayı", expr: "φ₂ = φ₂min + β₂ · ν_h" }],
    tables: [femHoistingClassTable()],
    notes: [
      "φ2, Booklet 2'deki ψ katsayısının yerine kullanılabilir.",
      "ν_h değeri kaldırma tahrik sınıfına göre T.9.3.b'den okunur.",
    ],
  },

  "FEM 1.001 T.9.3.a": {
    code: "FEM 1.001 T.9.3.a",
    title: "β2 ve φ2min — kaldırma sınıfı",
    source: FEM_SOURCE,
    clause: "Booklet 9, Tablo T.9.3.a",
    summary:
      "Vincin dinamik davranışına göre atandığı HC1–HC4 kaldırma sınıfları ve " +
      "bunlara karşılık gelen β2 [s/m] ile φ2min değerleri.",
    tables: [femHoistingClassTable()],
    notes: [
      "HC1 en yumuşak (hassas kaldırma), HC4 en sert (ağır hizmet, kepçe/mıknatıs) " +
        "kaldırmadır.",
      "φ2 değerleri deney ya da analizle de belirlenebilir; sınıf zorunlu değildir.",
    ],
  },

  "FEM 1.001 T.9.3.b": {
    code: "FEM 1.001 T.9.3.b",
    title: "ν_h — kaldırma tahrik sınıfına göre hız",
    source: FEM_SOURCE,
    clause: "Booklet 9, Tablo T.9.3.b",
    summary:
      "φ2 hesabına giren kararlı kaldırma hızı, tahrik sisteminin sürünme " +
      "hızıyla çalışıp çalışamamasına göre değişir.",
    tables: [
      {
        caption: "Yükleme Durumu I ve II için ν_h",
        headers: ["Tahrik sınıfı", "ν_h", "Tanım"],
        rows: [
          ["HD1", "ν_h,maks", "Sürünme hızıyla çalıştırılamaz"],
          ["HD2", "ν_h,sürünme", "Sürünme hızını operatör seçer"],
          [
            "HD3",
            "ν_h,sürünme",
            "Kumanda sistemi, yük yerden kalkana kadar sürünme hızını zorunlu kılar",
          ],
          ["HD4", "0,5 · ν_h,maks", "Kademesiz hız kontrolü, operatör kumandalı"],
          ["HD5", "0", "Ön germeli kademesiz hız kontrolü, operatörden bağımsız"],
        ],
        footnote:
          "Yükleme Durumu III (deney) satırı ayrıdır: HD2 ve HD4 için ν_h,maks, " +
          "HD5 için 0,5·ν_h,maks alınır. Uygulama Durum I/II satırını kullanır.",
      },
    ],
  },

  "FEM 1.001 9.4.1.3": {
    code: "FEM 1.001 9.4.1.3",
    title: "Savrulma kuvvetleri — kılavuz kuvveti ve kayma kutbu",
    source: FEM_SOURCE,
    clause: "Booklet 9, madde 9.4.1.3 (Booklet 2 md. 2.2.3 yerine geçer)",
    summary:
      "Vinç sabit hızla yürürken raya göre α açısı kadar savrulur ve anlık kayma " +
      "kutbu etrafında döner. Kılavuz elemanda oluşan Fy kuvveti, tekerlerdeki " +
      "teğetsel kuvvetlerle dengededir. Sürtünme katsayısı yanal kaymanın " +
      "(slip) fonksiyonudur ve 0,3'te doyar.",
    formulas: [
      { label: "Sürtünme fonksiyonu", expr: "f = 0,3 · (1 − e^(−250·α))" },
      { label: "Kayma kutbu (F/F)", expr: "h = (p·µ·µ'·l² + Σdᵢ²) / Σdᵢ" },
      { label: "Kayma kutbu (F/M)", expr: "h = (p·µ·l² + Σdᵢ²) / Σdᵢ" },
      { label: "Kılavuz kuvveti (F/F)", expr: "ν = 1 − Σdᵢ / (n·h)" },
      { label: "Kılavuz kuvveti (F/M)", expr: "ν = µ' · (1 − Σdᵢ / (n·h))" },
      { label: "Kılavuz kuvveti", expr: "F_y = ν · f · mg" },
    ],
    notes: [
      "p: bağlı (coupled) teker çifti adedi; n: tek taraftaki teker adedi; " +
        "l: açıklık; dᵢ: teker çiftinin kılavuz elemandan uzaklığı.",
      "µ, ağırlık merkezinin 1 numaralı raya normalize uzaklığıdır; " +
        "µ' = 1 − µ ise 1 numaralı rayın taşıdığı yük payına eşittir.",
      "Teker flanşıyla kılavuzlamada ilk teker kılavuz elemandır → d₁ = 0.",
      "Booklet 2'nin λ katsayılı basitleştirilmiş yöntemi (md. 2.2.3.3) yerine " +
        "bu model kullanılır.",
    ],
  },

  "FEM 1.001 T.9.4": {
    code: "FEM 1.001 T.9.4",
    title: "ξ ve ν katsayıları — teker çifti düzenine göre",
    source: FEM_SOURCE,
    clause: "Booklet 9, Tablo T.9.4",
    summary:
      "Teker başına teğetsel kuvvetler Fx = ξ·f·mg ve Fy = ν·f·mg bağıntılarıyla " +
      "bulunur. Katsayılar, teker çiftinin bağlı (C) / bağımsız (I) olmasına ve " +
      "iki tarafın yanal sabit (F) / hareketli (M) olmasına göre değişir.",
    tables: [
      {
        caption: "T.9.4 — ξ1i = ξ2i, ν1i ve ν2i",
        headers: ["Teker çifti", "ξ1i = ξ2i", "ν1i (ray 1)", "ν2i (ray 2)"],
        rows: [
          ["CFF", "µ·µ'·l / (n·h)", "(µ'/n)·(1 − dᵢ/h)", "(µ/n)·(1 − dᵢ/h)"],
          ["IFF", "0", "(µ'/n)·(1 − dᵢ/h)", "(µ/n)·(1 − dᵢ/h)"],
          ["CFM", "µ·µ'·l / (n·h)", "(µ'/n)·(1 − dᵢ/h)", "0"],
          ["IFM", "0", "(µ'/n)·(1 − dᵢ/h)", "0"],
        ],
        footnote:
          "C: bağlı (mekanik mil ya da elektriksel senkronizasyon) · I: bağımsız · " +
          "F: yanal sabit · M: yanal hareketli (ör. mafsallı ayak). Bağımsız " +
          "teker çiftinde raya paralel teğetsel kuvvet doğmaz.",
      },
    ],
    notes: [
      "Katsayıların toplamı kılavuz kuvvetini verir: Σ(ν1i + ν2i) = ν.",
      "1 numaralı ray, arabanın yanaştığı (yükü ağır olan) raydır; araba karşı " +
        "uca gittiğinde raylar yer değiştirir, bu yüzden tasarımda her iki ray " +
        "da büyük değere göre boyutlandırılır.",
    ],
  },

  "FEM 1.001 9.4.1.5": {
    code: "FEM 1.001 9.4.1.5",
    title: "Savrulma açısı α",
    source: FEM_SOURCE,
    clause: "Booklet 9, madde 9.4.1.5",
    summary:
      "Savrulma açısı; kılavuz eleman ile ray arasındaki boşluk, tekerlerin ve " +
      "rayların aşınması ve imalat toleransları toplanarak bulunur. 0,015 " +
      "radyanı aşamaz.",
    formulas: [
      { label: "Toplam açı", expr: "α = α_g + α_w + α_t ≤ 0,015 rad" },
      { label: "Kılavuz boşluğu payı", expr: "α_g = s_g / w_b" },
      { label: "Aşınma payı", expr: "α_w = 0,1 · b / w_b" },
      { label: "Tolerans payı", expr: "α_t = 0,001 rad" },
    ],
    notes: [
      "s_g: kılavuzun TOPLAM boşluğu (tek taraf boşluğun iki katı).",
      "w_b: kılavuz elemanları arası mesafe — teker flanşıyla kılavuzlamada " +
        "dingil mesafesine eşittir.",
      "b: ray başı genişliği.",
      "α > 0,015 rad çıkarsa kılavuz boşluğu daraltılmalı ya da dingil mesafesi " +
        "büyütülmelidir; sürtünme fonksiyonu bu bandın dışında geçerli değildir.",
    ],
  },

  "FEM 1.001 3.2.1.1": {
    code: "FEM 1.001 3.2.1.1",
    title: "Basit çekme / basınç — izin verilen gerilme σa",
    source: FEM_SOURCE,
    clause: "Booklet 3, madde 3.2.1.1",
    summary:
      "Eğilme ve eksenel yüklerden doğan normal gerilme σ, elastik sınıra göre " +
      "belirlenen σa değerini aşmamalıdır: σa = σE / νE. Emniyet katsayısı νE " +
      "yükleme durumuna göre 1,5 (I) / 1,33 (II) / 1,1 (III) alınır.",
    formulas: [{ expr: "σ ≤ σ_a = σ_E / ν_E" }],
    tables: [
      {
        caption: "σE ve σa [N/mm²]",
        headers: ["Çelik", "σE", "σa — Durum I", "σa — Durum II", "σa — Durum III"],
        rows: [
          ["E.24 (Fe 360 ≈ S235)", 240, 160, 180, 215],
          ["E.26 (Fe 430)", 260, 175, 195, 240],
          ["E.36 (Fe 510 ≈ S355)", 360, 240, 270, 325],
        ],
      },
    ],
    notes: [
      "Ana kirişte σx bileşenleri (düşey eğilme σ1–σ3, yatay eğilme σ4–σ5, ray " +
        "kolu σ6, ikincil momentler σ7–σ8) bu maddeye dayanır.",
      "σE/σR > 0,7 olan yüksek elastik limitli çeliklerde σa ayrı bir orantı " +
        "bağıntısıyla hesaplanır.",
    ],
  },

  "FEM 1.001 3.2.1.2": {
    code: "FEM 1.001 3.2.1.2",
    title: "Kayma gerilmesi — izin verilen τa",
    source: FEM_SOURCE,
    clause: "Booklet 3, madde 3.2.1.2",
    summary:
      "Kesme kuvveti ve burulmadan doğan kayma gerilmesi, aynı yükleme " +
      "durumundaki normal gerilme sınırının √3'e bölünmesiyle sınırlandırılır.",
    formulas: [{ expr: "τ ≤ τ_a = σ_a / √3" }],
    notes: [
      "Ana kirişte τ bileşenleri (burulma τ1–τ2, kesme τ3–τ5) bu maddeye " +
        "dayanır; kutu kesitte burulma Bredt bağıntısıyla (τ = T / (2·Am·t)) " +
        "hesaplanır.",
      "Kayma gerilmesi her gövde sacı için ayrı hesaplanır; kalınlığı küçük " +
        "olan sac elverişsizdir.",
    ],
  },

  "FEM 1.001 3.2.1.3": {
    code: "FEM 1.001 3.2.1.3",
    title: "Bileşik gerilme — von Mises eşdeğeri σcp",
    source: FEM_SOURCE,
    clause: "Booklet 3, madde 3.2.1.3",
    summary:
      "Normal ve kayma gerilmelerinin birlikte etkidiği noktalarda eşdeğer " +
      "(von Mises) gerilme hesaplanır ve σa ile karşılaştırılır. Ayrıca her " +
      "bileşen tek başına da kendi sınırını aşmamalıdır.",
    formulas: [
      { label: "İki eksenli", expr: "σ_cp = √(σ_x² + σ_y² − σ_x·σ_y + 3·τ_xy²) ≤ σ_a" },
      { label: "Çekme/basınç + kayma", expr: "σ_cp = √(σ² + 3·τ²) ≤ σ_a" },
      { label: "Ek koşullar", expr: "σ_x ≤ σ_a ,  σ_y ≤ σ_a ,  τ_xy ≤ τ_a" },
    ],
    notes: [
      "Bütün bileşenlerin maksimumlarını birlikte almak muhafazakârdır; daha " +
        "hassas hesapta σx,maks / σy,maks / τ,maks üçlüsü ayrı ayrı kontrol edilir.",
      "Uygulama σy yerine tekerlek basıncından gelen σz'yi kullanır ve karışım " +
        "terimini |σx·σz| olarak (işaretten bağımsız, güvenli tarafta) alır.",
    ],
  },

  "FEM 1.001 A.2.2.1": {
    code: "FEM 1.001 A.2.2.1",
    title: "Yatay ivme dinamik katsayısı ψh",
    source: FEM_SOURCE,
    clause: "Booklet 2, Appendix A.2.2.3 — Şekil A.2.2.1",
    summary:
      "Yürütme hareketinin hızlanma/yavaşlamasında asılı yükün salınımı, yükün " +
      "ortalama atalet kuvvetini ψh katsayısıyla büyütür. ψh; kütle oranı " +
      "µ = m1/m (m1 asılı kütle, m harekete zorlanan eşdeğer kütle) ve " +
      "β = tm/T1 (ivmelenme süresi / sarkaç periyodu) ile Şekil A.2.2.1'den " +
      "okunur.",
    formulas: [
      { label: "Sarkaç periyodu", expr: "T₁ = 2π · √(l / g)" },
      { label: "Parametreler", expr: "µ = m₁ / m ,  β = t_m / T₁" },
      { label: "µ ≤ 1 (üst zarf)", expr: "ψ_h = 2" },
      { label: "µ > 1 (teorik maksimum)", expr: "ψ_h = √(2 + µ + 1/µ)" },
      { label: "Regüle ivmeli sistem", expr: "ψ_h = 2·sin(β·π)  (β ≤ 0,5) ;  ψ_h = 2  (β > 0,5)" },
      { label: "Yapıya etkiyen atalet kuvveti", expr: "F_h = ψ_h · F_cm" },
    ],
    tables: [
      {
        caption: "Kütle oranından türetilen ψh (uygulamadaki üst zarf)",
        headers: ["µ = m1/m", "ψh"],
        rows: [
          ["≤ 1,0", "2,000"],
          ["1,5", "2,082"],
          ["2,0", "2,121"],
          ["2,5", "2,214"],
          ["3,0", "2,309"],
          ["4,0", "2,510"],
          ["5,0", "2,683"],
        ],
        footnote:
          "Değerler ψh = √(2 + µ + 1/µ) bağıntısından gelir; µ ≤ 1 bölgesinde " +
          "grafiğin üst zarfı olan 2,0 kullanılır.",
      },
    ],
    notes: [
      "Yük dışındaki hareketli parçalar için standart ψh = 2 öngörür — bu " +
        "yüzden atalet yükü bağıntısında araç ağırlığı 2 katsayısıyla girer: " +
        "F' = a · (W1·ψh + 2·W_araç) / g.",
      "l: kancanın en üst konumundaki askı boyu; l < 2,00 m alınmaz.",
      "Uygulamada m1 = yük + kanca bloğu + halat, m = araba yürütmede arabanın " +
        "kütlesi, köprü yürütmede köprü + araba kütlesidir.",
    ],
  },

  "FEM 1.001 §2.3.1": {
    code: "FEM 1.001 §2.3.1",
    title: "Yükleme Durumu I — normal işletme (rüzgârsız)",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.3.1",
    summary:
      "Normal işletme yüklemesi: öz ağırlık, dinamik katsayılı kaldırma yükü ve " +
      "en elverişsiz iki yatay hareket etkisi γC ile arttırılarak toplanır.",
    formulas: [{ expr: "S_I = γ_c · (S_G + ψ · S_L + S_H)" }],
    notes: [
      "γC değerleri için bkz. Tablo T.2.3.4 (A1–A8 → 1,00…1,20).",
      "Durum II aynı kombinasyona servis rüzgârını ekler; Durum III istisnai " +
        "yükler ve test yüklemesidir.",
    ],
  },

  "FEM 1.001 §2.3.3": {
    code: "FEM 1.001 §2.3.3",
    title: "Yükleme Durumu III — istisnai yükler ve test",
    source: FEM_SOURCE,
    clause: "Booklet 2, madde 2.3.3 (c) + Booklet 8, madde 8.1",
    summary:
      "Test yüklemesi iki kombinasyondan elverişsiz olanıyla kontrol edilir: " +
      "öz ağırlık + ψ·ρ1·kaldırma yükü, ya da öz ağırlık + ρ2·kaldırma yükü.",
    formulas: [
      { label: "Dinamik test", expr: "S_III = S_G + ψ · ρ₁ · S_L" },
      { label: "Statik test", expr: "S_III = S_G + ρ₂ · S_L" },
    ],
    tables: [
      {
        headers: ["Test", "Katsayı", "Yük"],
        rows: [
          ["Dinamik test (8.1.1)", "ρ1 = 1,20", "Güvenli çalışma yükünün %120'si"],
          ["Statik test (8.1.2)", "ρ2 = 1,40", "Güvenli çalışma yükünün %140'ı"],
        ],
      },
    ],
    notes: [
      "Bunlar asgari şartlardır; ulusal mevzuat daha yüksek değer isteyebilir.",
      "Bu kurallar test sırasında izin verilen sehim için bir zorunluluk getirmez.",
    ],
  },

  "FEM 1.001 4.1.1": {
    code: "FEM 1.001 4.1.1",
    title: "Mekanizma elemanlarında kopma mukavemeti kontrolü",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.1.1",
    summary:
      "Mekanizma elemanlarında izin verilen gerilme, malzemenin kopma " +
      "dayanımının νR emniyet katsayısına bölünmesiyle bulunur.",
    formulas: [
      { expr: "σ_em = σ_R / ν_R" },
      { label: "Kayma", expr: "τ_em = σ_em / √3" },
      {
        label: "Bileşik",
        expr: "σ_bil = √(σ² + 3·τ²) ≤ σ_em",
      },
    ],
    tables: [
      {
        caption: "νR emniyet katsayısı (T.4.1.1.2)",
        headers: ["Yükleme durumu", "νR"],
        rows: [
          ["Durum I", "≈ 3,0"],
          ["Durum II", "≈ 2,7"],
          ["Durum III", "≈ 2,2"],
        ],
        footnote:
          "Değerler malzemenin σE/σR oranına göre değişir; kesin değerler için " +
          "Booklet 4 Tablo T.4.1.1.2'ye bakılır.",
      },
    ],
  },

  "FEM 1.001 4.1.2": {
    code: "FEM 1.001 4.1.2",
    title: "Mekanizma elemanlarında burkulma kontrolü",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.1.2",
    summary:
      "Basınç altındaki mekanizma elemanlarında narinlik oranına bağlı ω " +
      "katsayısıyla burkulma kontrolü yapılır; hesaplanan gerilme ω ile " +
      "çarpılıp izin verilen gerilmeyle karşılaştırılır.",
    formulas: [{ expr: "ω · σ ≤ σ_em" }],
  },

  "FEM 1.001 4.1.3": {
    code: "FEM 1.001 4.1.3",
    title: "Mekanizma elemanlarında yorulma kontrolü",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.1.3",
    summary:
      "Yorulma dayanımı; parlatılmış numune dayanım sınırından başlanarak şekil " +
      "(ks), boyut (kd), yüzey (ku) ve korozyon (kc) katsayılarıyla düzeltilir, " +
      "ardından gerilme oranı κ ve Wöhler eğrisi üzerinden izin verilen gerilme " +
      "bulunur (SMITH diyagramı).",
    formulas: [
      { expr: "σ_wk = σ_w / (k_s · k_d · k_u · k_c)" },
      { label: "Kayma", expr: "τ_wk = τ_w" },
    ],
    notes: [
      "Katsayı verileri Appendix A-4.1.3'tedir (ks eğrileri, kd boyut tablosu, " +
        "ku yüzey ve kc korozyon grafikleri).",
      "Bu uygulamada kiriş/başkiriş yorulması DIN 15018 Tablo 17/18 yöntemiyle " +
        "yapılır; FEM karşılığı Booklet 3 madde 3.6'dır.",
    ],
  },

  "FEM 1.001 4.1.4": {
    code: "FEM 1.001 4.1.4",
    title: "Aşınma kontrolü",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.1.4",
    summary:
      "Sürtünmeli temas yüzeylerinde (tekerlek/ray, burç/mil) yüzey basıncı " +
      "aşınma açısından sınırlandırılır. Tekerlekler için sayısal yöntem madde " +
      "4.2.4'te verilmiştir.",
  },

  "FEM 1.001 4.2": {
    code: "FEM 1.001 4.2",
    title: "Mekanizma elemanlarının seçimi",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2",
    summary:
      "Rulman (4.2.1), halat (4.2.2), tambur ve makara (4.2.3), tekerlek " +
      "(4.2.4) ve dişli (4.2.5) seçim kurallarını kapsar. Her eleman için " +
      "mekanizmanın grup sınıflandırması (M1–M8) belirleyicidir.",
  },

  "FEM 1.001 4.2.4.1": {
    code: "FEM 1.001 4.2.4.1",
    title: "Tekerlek hesabı — yüzey basıncı",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.2.4.1",
    summary:
      "Tekerlek/ray temasında HERTZ basıncından türetilen kavramsal basınç " +
      "kontrolü. Ortalama tekerlek yükü Pmean, faydalı ray genişliği b ve " +
      "tekerlek çapı D üzerinden hesaplanır.",
    formulas: [
      { expr: "P_ort = (P_min + 2 · P_maks) / 3" },
      { expr: "P_ort / (b · D) ≤ P_L · c₁ · c₂" },
    ],
    notes: [
      "Pmean hesaplanırken dinamik katsayı ψ ihmal edilir.",
      "PL için T.4.2.4.1.3, c1 için T.4.2.4.1.4, c2 için T.4.2.4.1.5.",
    ],
  },

  "FEM 1.001 4.3.1": {
    code: "FEM 1.001 4.3.1",
    title: "Elektrik motorlarının seçimi",
    source: FEM_SOURCE,
    clause: "Booklet 4, madde 4.3.1",
    summary:
      "Motor, mekanizmanın gerektirdiği gücü sağlamalı ve çalışma çevrimi " +
      "boyunca termik olarak yeterli olmalıdır. Gerekli güç, statik dirençler ve " +
      "hızlanma momentleri toplanarak bulunur.",
  },
};

// -------------------------------------------------------------------- CMAA 70

const CMAA_SOURCE = "CMAA Specification No. 70 (Elektrikli Gezer Köprülü Vinçler)";

const CMAA_REFS: Record<string, StandardRef> = {
  "CMAA 70 3.5.1": {
    code: "CMAA 70 3.5.1",
    title: "Kaynaklı kutu kiriş oranları",
    source: CMAA_SOURCE,
    clause: "Madde 3.5.1 (Design Limitations)",
    summary:
      "Kaynaklı kutu kirişte açıklığın kiriş derinliğine ve gövde sacları arası " +
      "genişliğe oranı sınırlandırılır. Oranlar aşıldığında kiriş fazla narin " +
      "kalır; sehim ve yanal burkulma belirleyici olur.",
    formulas: [
      { label: "Açıklık / derinlik", expr: "L / h ≤ 25" },
      { label: "Açıklık / genişlik", expr: "L / b ≤ 65" },
    ],
    tables: [
      {
        headers: ["Oran", "Sınır", "Anlamı"],
        rows: [
          ["L / h", "≤ 25", "L: açıklık, h: kiriş derinliği"],
          ["L / b", "≤ 65", "b: gövde sacları arası mesafe"],
        ],
      },
    ],
    notes: [
      "b/t ve h/t (plaka narinlik) oranları ayrıca burkulma analiziyle " +
        "doğrulanır — bkz. FEM 1.001 Appendix A-3.4 ve 08 Buruşma bölümü.",
      "Sınırlar CMAA 70'te inç cinsinden verilir; oran birimsiz olduğundan mm " +
        "ile de doğrudan uygulanır.",
    ],
  },

  "CMAA 70 3.5.5.1": {
    code: "CMAA 70 3.5.5.1",
    title: "Ana kiriş düşey sehim sınırı",
    source: CMAA_SOURCE,
    clause: "Madde 3.5.5.1 (+ 3.5.7)",
    summary:
      "Araba ve nominal yük altında (kamber etkisi hariç) ana kirişin düşey " +
      "sehimi, açıklığın belirli bir oranını aşmamalıdır.",
    formulas: [{ expr: "δ ≤ L / 888" }],
    tables: [
      {
        headers: ["Kriter", "Değer"],
        rows: [
          ["Birim sehim", "0,001125 in/in"],
          ["Açıklık oranı", "≈ L / 888"],
          ["Yükleme", "Araba + nominal yük (dinamik katsayısız)"],
        ],
      },
    ],
    notes: [
      "FEM 1.001 kiriş sehimi için bir sınır getirmez; sehim sınırı sözleşmeyle " +
        "belirlenir. Uygulamada sınır oranı kullanıcı girdisidir (ör. L/1000).",
    ],
  },

  "SIBRE SHI": {
    code: "SIBRE SHI",
    title: "Tambur emniyet freni — kaliper fren kataloğu",
    source: "SIBRE Siegerland-Bremsen GmbH — Caliper Brake SHI / SHI-FC",
    clause: "Clamping Force FA · Torque Calculation · Brake Discs",
    summary:
      "Emniyet freni tamburun flanşını disk olarak kullanan hidrolik açmalı, " +
      "yay kapamalı kaliper frendir. Sıkma kuvveti FA ayarlanan hava aralığına " +
      "(c) göre değişir; frenleme momenti flanşın iki yüzündeki sürtünmeden " +
      "doğar ve etkin sürtünme yarıçapı flanş yarıçapından modele özgü x " +
      "ölçüsü çıkarılarak bulunur.",
    formulas: [
      { expr: "M_fren = 2 · FA · µ · (d_flanş/2 − x)" },
      { expr: "d_flanş ≥ maks(d_katalog ; D_tambur + Δ)" },
    ],
    tables: [
      {
        headers: ["Seri", "x [mm]", "En küçük disk Ø [mm]", "Δ = d − d1 [mm]", "En küçük kalınlık [mm]"],
        rows: [
          ["SHI 75-1…6", "42,5", "400", "230", "20"],
          ["SHI 103…107", "60", "650", "280", "20"],
          ["SHI 161/162", "62,5", "900", "325", "20"],
          ["SHI 201/202", "60", "1.100", "360", "20"],
          ["SHI 231/232", "95", "1.100", "440", "20"],
          ["SHI 251/252", "100", "1.200", "490", "20"],
          ["SHI 281/282", "112,5", "1.600", "545", "30"],
        ],
      },
    ],
    notes: [
      "µ = 0,4 — sinter balata, çevresel hız 15 m/s'ye kadar geçerli ortalama değer.",
      "d1 katalogda \"azami göbek/tambur çapı\" olarak verilir; Δ = d − d1 " +
        "kaliper gövdesinin oturması için gereken radyal paydır.",
      "SHI 231 ve 232 yalnız 2…3 mm hava aralığı bandında çalışır; c = 1 mm " +
        "için sıkma kuvveti tanımlı değildir.",
      "Açma basıncı PL hidrolik güç ünitesinin seçimini belirler.",
    ],
  },

  "CMAA 70 3.5.5.2": {
    code: "CMAA 70 3.5.5.2",
    title: "Ana kiriş ters sehimi (kamber)",
    source: CMAA_SOURCE,
    clause: "Madde 3.5.5.2",
    summary:
      "Kaynaklı kutu kirişler, ölü yük sehimi ile canlı yük sehiminin yarısı " +
      "toplamı kadar yukarı yönde ters sehim (kamber) verilerek imal edilir. " +
      "Kamber, kiriş sacları kesilirken uygulanan bir imalat ölçüsüdür.",
    formulas: [
      { expr: "kamber(x) = δ_ölü(x) + δ_canlı(x) / 2" },
      { expr: "mesnette(x) = kamber(x) − δ_ölü(x) = δ_canlı(x) / 2" },
    ],
    tables: [
      {
        headers: ["Büyüklük", "İçerik"],
        rows: [
          ["Ölü yük", "Kirişin kendi yayılı ağırlığı + üstündeki sabit yükler (ray, yürüme yolu, festun)"],
          ["Canlı yük", "Araba + nominal kaldırma yükü — darbe/dinamik katsayı GİRMEZ"],
          ["Kesimde verisi", "δ_ölü + δ_canlı/2 — sacların kesim ve ütüleme kotu"],
          ["Mesnette verisi", "δ_canlı/2 — kiriş sehpaya alındığında ölçülmesi beklenen kot"],
        ],
      },
    ],
    notes: [
      "Başkiriş ağırlığı ölü yüke girmez: mesnet üzerinde durur, ana kirişi eğmez.",
      "Kotlar açıklık ortasından başlayıp sağa ve sola perde (diyafram) " +
        "aralığınca verilir; uçlarda (teker ekseni) sıfırdır.",
      "Mesnette ölçülen değer beklenen kotu tutuyorsa kiriş doğru üretilmiştir; " +
        "bu, imalat kabul kontrolüdür.",
    ],
  },

  "CMAA 70 5.2.9.1.1": {
    code: "CMAA 70 5.2.9.1.1",
    title: "Kaldırma motoru gücü",
    source: CMAA_SOURCE,
    clause: "Madde 5.2.9.1.1",
    summary:
      "Kaldırma mekanizmasının mekanik gücü, yük ve kaldırma hızından toplam " +
      "verim üzerinden hesaplanır; gerekli motor gücü kontrol faktörü Kc ile " +
      "çarpılarak bulunur.",
    formulas: [
      { label: "Mekanik güç", expr: "P_mek = W · V / (33000 · E)" },
      { label: "Gerekli güç", expr: "P_ger = P_mek · K_c" },
    ],
    tables: [
      {
        caption: "Tipik verimler (Tablo 5.2.9.1.1.1-1)",
        headers: ["Yataklama", "Dişli kademe verimi Eg", "Makara verimi Es"],
        rows: [
          ["Rulmanlı (anti-friction)", "0,97", "0,99"],
          ["Kaymalı / burçlu (sleeve)", "0,93", "0,98"],
        ],
      },
    ],
    notes: [
      "Kc = 1 (kalıcı sekonder direnç yoksa). Kalıcı kayma dirençli AC bilezikli " +
        "sistemlerde Kc = motor nominal devri / kaldırmadaki işletme devri.",
    ],
  },

  "CMAA 70 5.2.9.1.2.1": {
    code: "CMAA 70 5.2.9.1.2.1",
    title: "Köprü ve araba yürütme motoru gücü (kapalı saha)",
    source: CMAA_SOURCE,
    clause: "Madde 5.2.9.1.2.1",
    summary:
      "Yürütme motoru gücü; toplam ağırlık W, yürüyüş hızı V, servis faktörü Ks " +
      "ve ivmelenme faktörü Ka üzerinden hesaplanır.",
    formulas: [
      { label: "Gerekli güç", expr: "P = K_a · W · V · K_s" },
      {
        label: "İvmelenme faktörü",
        expr: "K_a = (f + 2000 · a · C_r / (g · E)) / (33000 · K_t)",
      },
      { label: "Dönme atalet faktörü", expr: "C_r = 1,05 + a / 7,5" },
    ],
    notes: [
      "W: hareket ettirilecek toplam ağırlık [ton], V: nominal hız [ft/dak], " +
        "f: yürüyüş sürtünmesi [lb/ton] (Tablo 5.2.9.1.2.1-D), " +
        "Ks: servis faktörü (Tablo 5.2.9.1.2.1-E), Kt: ivmelendirme momenti faktörü.",
      "BİRİM UYARISI — W METRİK TON DEĞİL, ABD KISA TONUDUR (short ton, " +
        "1 US ton = 2000 lb = 907,185 kg). Bağıntı baştan sona imperial " +
        "birimlidir: f tablosu lb/ton basar ve ivmelenme teriminin payındaki " +
        "2000 sayısı bir kısa tonun pound karşılığıdır. Uygulama hareket eden " +
        "kütleyi kg → metrik ton → kısa ton sırasıyla çevirir (×1,1; tam çevrim " +
        "1,10231, firma kabulü yuvarlanmış 1,1'dir). Metrik ton doğrudan " +
        "yazılırsa gerekli güç yaklaşık %10 EKSİK çıkar.",
      "Redüktör oranı sapması: gerçek tam yük hızı, belirtilen hızın ±%10'u " +
        "içinde kalmalıdır (madde 5.2.10.3).",
    ],
  },

  "CMAA 70 T.5.2.9.1.2.1-D": {
    code: "CMAA 70 T.5.2.9.1.2.1-D",
    title: "Yürüyüş sürtünme faktörü f",
    source: CMAA_SOURCE,
    clause: "Tablo 5.2.9.1.2.1-D",
    summary:
      "Metalik tekerlek + rulmanlı yatak için yürüyüş sürtünmesi (aktarma " +
      "kayıpları dahil), tekerlek çapına bağlı olarak lb/ton cinsinden verilir.",
    tables: [
      {
        headers: ["Tekerlek çapı", "f [lb/ton]"],
        rows: [
          ['36″ – 24″ (≈ 900 – 600 mm)', "10 – 12"],
          ['21″ – 10″ (≈ 530 – 250 mm)', "12 – 15"],
          ['8″ – 6″ (≈ 200 – 150 mm)', "16"],
        ],
        footnote:
          "Uygulamadaki eşleme (200 mm → 16; 250–500 mm → 15; 630–900 mm → 12) " +
          "tablonun muhafazakâr tarafında kalır.",
      },
    ],
  },

  "CMAA 70 T.5.2.9.1.2.1-E": {
    code: "CMAA 70 T.5.2.9.1.2.1-E",
    title: "Yürütme tahriki servis sınıfı faktörü Ks",
    source: CMAA_SOURCE,
    clause: "Tablo 5.2.9.1.2.1-E",
    summary:
      "Gerekli yürütme motoru gücünü ölçekleyen servis faktörü. Tablo İKİ " +
      "EKSENLİDİR: satır CMAA uygulama (servis) sınıfı A…F, SÜTUN tahrik ve " +
      "kumanda tipidir. Ks yalnız sınıftan seçilemez — kumanda tipi de bilinmelidir.",
    tables: [cmaaServiceFactorTable()],
    notes: [
      "Sınıf E değerleri, tahrikin en çok %30 çalışma süresi ve saatte en çok " +
        "25 çevrim esasına dayanır; sınıf F için %50 ve 45 çevrimdir. Daha ağır " +
        "hizmette çevrim analizi önerilir.",
      "\"N/A\": o sınıf o kumanda tipiyle önerilmez; uygulama bu hücrede " +
        "otomatik seçim YAPMAZ ve mühendisi uyarır.",
      "Tabloda bulunmayan kumanda tipleri için CMAA vinç imalatçısına " +
        "danışılmasını ister (dipnot 3).",
    ],
  },

  "CMAA 70 T.5.2.9.1.2.1-C": {
    code: "CMAA 70 T.5.2.9.1.2.1-C",
    title: "İvmelenme tork faktörü Kt",
    source: CMAA_SOURCE,
    clause: "Tablo 5.2.9.1.2.1-C",
    summary:
      "Motorun anma devrine kadar hızlanırken ürettiği, anma momentine göre " +
      "EŞDEĞER KARARLI momentin oranı. Tablo yalnız MOTOR TİPİ ve KUMANDA " +
      "TİPİYLE indislenir — CMAA servis sınıfına (A…F) BAĞLI DEĞİLDİR.",
    formulas: [
      { label: "İvmelenme faktöründeki yeri", expr: "K_a = (f + 2000 · a · C_r / (g · E)) / (33000 · K_t)" },
    ],
    tables: [cmaaAccelTorqueTable()],
    notes: [
      "Katalog dipnotu 1: Kt kumanda ve/veya direnç tasarımının bir " +
        "fonksiyonudur.",
      "Katalog dipnotu 2: aralık verilen satırlarda SÜREKLİ KAYMA DİRENCİ " +
        "kullanıldığında aralığın ALT ucu önerilir. Uygulama alt ucu seçer; " +
        "bu aynı zamanda Ka'yı (dolayısıyla gerekli gücü) büyüten muhafazakâr " +
        "taraftır.",
    ],
  },

  "CMAA 70 4.11.4.1": {
    code: "CMAA 70 4.11.4.1",
    title: "Mil ve pim gerilmeleri",
    source: CMAA_SOURCE,
    clause: "Madde 4.11.4.1 (kanca bloğu mil ve pimleri)",
    summary:
      "Kanca bloğu ve tambur mili gibi taşıyıcı mil/pimlerde izin verilen " +
      "gerilmeler, malzemenin kopma dayanımı Su üzerinden sınırlandırılır. " +
      "Eğilme momenti mesnet reaksiyonu ile konsol boyunun çarpımından, kesme " +
      "gerilmesi ise yatak oturma kesitinden bulunur.",
    formulas: [
      { label: "Eğilme", expr: "σ ≤ S_u / 5" },
      { label: "Kayma", expr: "τ ≤ S_u / (5 · √3)" },
      { label: "Bileşik", expr: "σ_t = √(σ² + 3·τ²) ≤ S_u / 5" },
    ],
    notes: [
      "Kaynakta CMAA #74 madde 4.5 referansı verilmişti; elimizdeki CMAA 70 " +
        "baskısında 4.5 makaralara (sheaves) ayrılmıştır — mil gerilmelerinin " +
        "doğru karşılığı 4.11.4.1'dir.",
    ],
  },

  "CMAA 70 3.4.1": {
    code: "CMAA 70 3.4.1",
    title: "Yapısal elemanlarda izin verilen gerilmeler (Durum 1)",
    source: CMAA_SOURCE,
    clause: "Madde 3.4.1 — Allowable Stresses, Stress Level 1",
    summary:
      "Yapı çeliğinden elemanlarda izin verilen gerilmeler akma gerilmesinin " +
      "kesirleri olarak verilir: çekme/eğilme için 0,60·σ_akma, kayma için " +
      "0,35·σ_akma. Her sınır KENDİ gerilmesiyle karşılaştırılır: kaynakta " +
      "md. 3.4.4.2'nin ASAL gerilmesi bir normal gerilmedir ve 0,60·σ_akma " +
      "ile, saf kayma τ ise 0,35·σ_akma ile sınırlanır.",
    formulas: [
      { label: "Çekme / eğilme", expr: "σ_em = 0,60 · σ_akma" },
      { label: "Kayma", expr: "τ_em = 0,35 · σ_akma" },
    ],
    tables: [
      {
        caption: "Yapı çelikleri — Durum 1 sınırları [N/mm²]",
        headers: ["Çelik", "σ_akma", "0,60·σ_akma", "0,35·σ_akma"],
        rows: [
          ["S235", 235, 141, 82.3],
          ["S355", 355, 213, 124.3],
        ],
        footnote:
          "Durum 2 ve Durum 3 için CMAA aynı oranları farklı emniyet " +
          "katsayılarıyla kullanır; uygulama yalnız Durum 1'i (normal işletme) " +
          "hesaplar.",
      },
    ],
    notes: [
      "Kaynak dikişi kontrolünde bu tablo FEM 1.001 T.3.2.2.3 ile BİRLİKTE " +
        "kullanılır; ancak iki sınır doğrudan karşılaştırılmaz. Her standart " +
        "kendi gerilmesini tanımladığı için uygulama iki KULLANIM ORANI " +
        "hesaplar (σ_cp/σ_a,k ve maks(σ_v/0,60σ_akma ; τ/0,35σ_akma)) ve " +
        "büyük olanı yönetici alır.",
      "Eski yöntem √(σ²+τ²) bileşkesini 0,35·σ_akma ile karşılaştırıyordu; bu " +
        "büyüklük CMAA'nın tanımladığı gerilme değildi.",
    ],
  },

  "CMAA 70 3.4.4.2": {
    code: "CMAA 70 3.4.4.2",
    title: "Kaynakta bileşik gerilme (asal gerilme)",
    source: CMAA_SOURCE,
    clause: "Madde 3.4.4.2 — Combined Stresses, for welds",
    summary:
      "CMAA kaynak dikişinde bileşik gerilmeyi ASAL GERİLME olarak tanımlar: " +
      "dikiş düzlemindeki normal gerilmeler σx, σy ve kayma gerilmesi τ'dan " +
      "Mohr çemberinin kökleri bulunur ve mutlak değeri büyük olan kök izin " +
      "verilen gerilme ile karşılaştırılır. Tambur ve mil kaynaklarında dikişe " +
      "dik ikinci normal gerilme yoktur (σy = 0).",
    formulas: [
      {
        label: "Asal gerilme (md. 3.4.4.2)",
        expr: "σ_v = ½·(σx + σy) ± ½·√((σx − σy)² + 4·τ²) ≤ σ_ALL",
      },
      { label: "σy = 0 hâli", expr: "σ_v = ½·σ ± ½·√(σ² + 4·τ²)" },
      { label: "Sınır (md. 3.4.1, Durum 1)", expr: "σ_ALL = 0,60 · σ_akma" },
    ],
    tables: [
      {
        caption: "Durum 1 sınırları [N/mm²]",
        headers: ["Çelik", "σ_akma", "σ_ALL = 0,60·σ_akma", "τ_em = 0,35·σ_akma"],
        rows: [
          ["S235", 235, 141, 82.3],
          ["S355", 355, 213, 124.3],
        ],
      },
    ],
    notes: [
      "σ_v bir NORMAL gerilmedir; çekme sınırı (0,60·σ_akma) ile karşılaştırılır. " +
        "Kayma gerilmesi bu kuralla tek başına sınırlanmadığından uygulama " +
        "τ ≤ 0,35·σ_akma kontrolünü AYRICA yapar (md. 3.4.1).",
      "Aynı dikiş FEM 1.001 Ek A-3.2.2.3 md.3'ün eşdeğer gerilmesiyle de " +
        "değerlendirilir; kullanım oranı büyük olan standart yönetir.",
    ],
  },
};

// ------------------------------------------------------------------ DIN

const DIN_REFS: Record<string, StandardRef> = {
  "DIN 15018 T.17": {
    code: "DIN 15018 Tablo 17",
    title: "İzin verilen yorulma gerilmeleri zul σD(−1)",
    source: "DIN 15018-1 — Vinçler, çelik yapıların hesap esasları",
    clause: "Tablo 17",
    summary:
      "Tam tersinir yükleme (κ = −1) altında izin verilen yorulma gerilmesi; " +
      "malzeme, çentik sınıfı (W0–W2 kaynaksız, K0–K4 kaynaklı) ve yük grubuna " +
      "(B1–B6) bağlıdır.",
    tables: [din15018T17Table("St37"), din15018T17Table("St52")],
    notes: [
      "Kayma gerilmesi için çentik sınıfı daima W0 alınır (madde 7.4.3); " +
        "izin verilen kayma zul τD = zul σDz,W0(κ) / √3'tür.",
    ],
  },

  "DIN 15018 Tablo 18": {
    code: "DIN 15018 Tablo 18",
    title: "Gerilme oranına bağlı izin verilen yorulma gerilmesi",
    source: "DIN 15018-1",
    clause: "Tablo 18 + madde 7.4.5",
    summary:
      "Tablo 17'den okunan zul σD(−1) değeri, gerçek gerilme oranı κ = σmin/σmax " +
      "için dönüştürülür. Önce sıfır-çekme dayanımı zul σDz(0), ardından κ'ya " +
      "bağlı değer hesaplanır.",
    formulas: [
      { label: "Sıfır-çekme", expr: "σ_Dz0 = σ_D(−1) · 5 / 3" },
      {
        label: "Gerilme oranına bağlı",
        expr:
          "σ_Dz(κ) = σ_Dz0 / (1 − (1 − σ_Dz0 / (0,75 · σ_B)) · κ)",
      },
      { label: "Kayma", expr: "τ_D = σ_Dz,W0 / √3" },
    ],
    notes: [
      "σB: malzemenin kopma dayanımı. Kayma için daima W0 çentik sınıfı değeri " +
        "kullanılır.",
    ],
  },

  "DIN 15018 Tablo 2": {
    code: "DIN 15018 Tablo 2",
    title: "Dinamik katsayı ψ (kaldırma sınıfı H1–H4)",
    source: "DIN 15018-1",
    clause: "Tablo 2",
    summary:
      "Kaldırma yükünün dinamik etkisi, kaldırma sınıfına bağlı ψ = k + l·v " +
      "bağıntısıyla hesaplanır (v: kaldırma hızı [m/dak]).",
    formulas: [{ expr: "ψ = k + l · v" }],
    tables: [
      {
        headers: ["Kaldırma sınıfı", "k", "l"],
        rows: [
          ["H1", "1,10", "0,0022"],
          ["H2", "1,20", "0,0044"],
          ["H3", "1,30", "0,0066"],
          ["H4", "1,40", "0,0088"],
        ],
      },
    ],
    notes: [
      "FEM 1.001 karşılığı madde 2.2.2.1.1'dir (ψ = 1 + ξ·V_L).",
    ],
  },

  "DIN 15018 7.4.5": {
    code: "DIN 15018 Madde 7.4.5",
    title: "Bileşik yorulma kontrolü",
    source: "DIN 15018-1",
    clause: "Madde 7.4.5",
    summary:
      "Normal ve kayma gerilmelerinin birlikte etkidiği kesitlerde yorulma " +
      "kontrolü, gerilme oranlarının kareleri toplamıyla yapılır.",
    formulas: [
      {
        expr:
          "(σ_x / σ_x,em)² + (σ_y / σ_y,em)² − (σ_x · σ_y) / (|σ_x,em| · |σ_y,em|) + (τ / τ_em)² ≤ 1,1",
      },
    ],
    notes: [
      "Ayrıca her bileşen tek başına da kendi izin verilen değerini aşmamalıdır.",
    ],
  },

  "DIN 15018 Şekil 9": {
    code: "DIN 15018 Şekil 9",
    title: "Tekerlek basıncının kiriş gövdesine yayılımı",
    source: "DIN 15018-1",
    clause: "Şekil 9",
    summary:
      "Ray üzerinden gelen tekerlek yükünün gövde sacına yayıldığı etkin boy; " +
      "ray ve üst başlık kalınlıklarına bağlı olarak belirlenir ve yerel " +
      "gövde gerilmesi σz'nin hesabında kullanılır.",
    formulas: [{ expr: "σ_z = P / (l_e · t_g)" }],
  },

  "DIN 15061": {
    code: "DIN 15061",
    title: "Tambur ve makara halat yivi (hatve)",
    source: "DIN 15061-1 — Vinçler, halat yivi profilleri",
    clause: "DIN 15061-1",
    summary:
      "Halat yivi hatvesi (p) ve profil ölçüleri halat çapına göre " +
      "standartlaştırılmıştır. Uygulamadaki basamak fonksiyonu bu standarttan gelir.",
    tables: [
      {
        caption: "Hatve p = d + pay",
        headers: ["Halat çapı d [mm]", "Pay [mm]", "Hatve p [mm]"],
        rows: [
          ["d < 8", "1,0", "d + 1,0"],
          ["8 ≤ d < 11", "1,5", "d + 1,5"],
          ["11 ≤ d < 21", "2,0", "d + 2,0"],
          ["21 ≤ d < 29", "3,0", "d + 3,0"],
          ["29 ≤ d < 41", "4,0", "d + 4,0"],
          ["41 ≤ d < 46", "5,0", "d + 5,0"],
          ["46 ≤ d < 56", "6,0", "d + 6,0"],
          ["d ≥ 56", "7,0", "d + 7,0"],
        ],
      },
    ],
    notes: ["FEM 1.001 madde 4.2.3.2 yalnız yiv dip yarıçapını verir: r = 0,53 · d."],
  },

  "ISO 281": {
    code: "ISO 281",
    title: "Rulman nominal ömrü L10",
    source: "TS ISO 281 — Rulmanlar, dinamik yük sayıları ve nominal ömür",
    clause: "ISO 281 §5",
    summary:
      "Bir rulmanın, aynı koşullarda çalışan bir grup rulmanın %90'ının ulaştığı " +
      "devir sayısı olarak tanımlanan nominal ömrü. Dinamik yük sayısı C ile " +
      "eşdeğer rulman yükü P'nin oranının üssü alınır: bilyalı rulmanda 3, " +
      "makaralı rulmanda 10/3. Vinç uygulamasında ömür saat cinsinden istenir, " +
      "bu yüzden devir sayısı dakikadaki devirle bölünür.",
    formulas: [
      { label: "Nominal ömür (devir)", expr: "L_10 = (C / P)^p" },
      { label: "Saat cinsinden", expr: "L_10h = (10^6 / (60 · n)) · (C / P)^p" },
    ],
    tables: [
      {
        caption: "Ömür üsteli p",
        headers: ["Rulman tipi", "p"],
        rows: [
          ["Bilyalı rulman", "3"],
          ["Makaralı rulman", "10/3"],
        ],
      },
    ],
    notes: [
      "Gerekli ömrün kendisi ISO 281'den değil, mekanizmanın FEM 1.001 T.2.1.3.2 " +
      "kullanım sınıfından gelir.",
    ],
  },

  "DIN 15400": {
    code: "DIN 15400 Tablo 3",
    title: "Kanca taşıma kapasiteleri",
    source: "DIN 15400 — Vinç kancaları, malzeme ve taşıma kapasiteleri",
    clause: "Madde 4, Tablo 3 (Tragfähigkeit)",
    summary:
      "Bir kancanın taşıma kapasitesi üç veriyle belirlenir: kanca numarası, " +
      "malzemenin mukavemet sınıfı (M < P < S < T < V) ve kancanın kullanılacağı " +
      "mekanizma grubu. Aynı kanca numarasında daha yüksek mukavemet sınıfı daha " +
      "büyük kapasite, daha ağır çalışma grubu ise daha küçük kapasite verir.",
    tables: [din15400T3Table()],
    notes: [
      "Uygulama vincin FEM 1.001 mekanizma sınıfını (M1–M8) DIN 15020 grubuna " +
        "çevirir: M1–M4 → 1Bm, M5 → 1Am, M6 → 2m, M7 → 3m, M8 → 4m.",
      "Standardın notu: 1Bm'den daha hafif çalışma dikkate alınmaz — bu yüzden " +
        "M1–M4 için aynı (1Bm) sütunu kullanılır.",
      "Kanca somun ve mili gerilmeleri ayrıca kontrol edilir (bkz. CMAA 70 4.11.4.1).",
      "Tekli kanca ölçüleri DIN 15401, çift ağızlı kanca ölçüleri DIN 15402'dedir.",
      "Lamel (sac perçinli) kancalar bu tabloya GİRMEZ: kapasiteleri DIN 15407 " +
        "(tek ağızlı) ve DIN 15408'in (çift ağızlı) kendi satırlarındadır ve " +
        "malzeme mukavemet sınıfına bağlı değildir.",
    ],
  },
  "DIN 15407": {
    code: "DIN 15407 Teil 1",
    title: "Lamel kanca (tek ağızlı) — ana ölçüler",
    source:
      "DIN 15407 Teil 1 (Eylül 1977) — Lasthaken für Krane; " +
      "Lamellen-Einfachhaken für Roheisen- und Stahlgießpfannen",
    clause: "Zusammenstellung, Hauptmaße — Tablo 1",
    summary:
      "Ham demir ve çelik döküm potaları için sac lamellerden perçinlenen tek " +
      "ağızlı kanca. Dövme kancadan farkı kapasitenin nereden okunduğudur: " +
      "burada taşıma kapasitesi tablonun KENDİ satırındadır (\"Tragfähigkeit " +
      "t\") ve malzeme mukavemet sınıfına ya da mekanizma grubuna bağlı " +
      "değildir. Kanca kapasite × ağız yarıçapıyla adlandırılır.",
    tables: [din15407Table()],
    notes: [
      "İşaretleme DIN 15404 Teil 2'ye göredir.",
      "Perçin delikleri 1, 2 ve 3 numaralı lamellerle birlikte delinir.",
      "160 × 250 boyundan itibaren ilave bir perçin bulunur (standardın 2 " +
        "numaralı dipnotu).",
      "Uygulama ölçüleri hesaba SOKMAZ; imalat resmi ve ekipman listesi için " +
        "taşır. Kontrol edilen tek büyüklük taşıma kapasitesidir.",
    ],
  },
  "DIN 15408": {
    code: "DIN 15408",
    title: "Lamel kanca (çift ağızlı)",
    source:
      "DIN 15408 — Lasthaken für Krane; Lamellen-Doppelhaken für Roheisen- " +
      "und Stahlgießpfannen",
    clause: "—",
    summary:
      "DIN 15407'nin çift ağızlı karşılığı. Uygulamada kanca tanımı olarak " +
      "SEÇİLEBİLİR ama ÖLÇÜ VE KAPASİTE TABLOSU YÜKLÜ DEĞİLDİR: kapasite elle " +
      "girilir ve rapor bunu bilgilendirme kontrolüyle açıkça söyler. " +
      "DIN 15407'nin satırlarını çift ağızlı kancaya kopyalamak, ölçü resmine " +
      "yanlış sayı yazdırmak olurdu.",
    notes: [
      "Tablo elde edildiğinde `hook-standards.ts`e eklenir; o ana kadar " +
        "kapasitenin kaynağı mühendisin kendi girdisidir.",
    ],
  },
};

// ------------------------------------------------------------------ birleştirme

/** Ana defter — anahtar, hesap satırındaki `standard` dizesinin birebir kendisi. */
/**
 * Üretici referansları (standart değil, KATALOG bilgisi). Alan yanındaki rozet
 * bu kaydı açar; mühendis seçim yaparken kaynağı görür.
 */
const MANUF_REFS: Record<string, StandardRef> = {
  "Conductix Kauçuk Kaliteleri": {
    code: "Conductix Kauçuk Kaliteleri",
    title: "Kauçuk tampon malzeme kalite dereceleri",
    source:
      "Conductix-Wampfler — Rubber and Cellular Buffers (KAT0170-0002-EN), " +
      "'Quality Degrees of the Most Common Materials'",
    clause: "En yaygın malzemeler",
    summary:
      "Kauçuk tamponun gövde malzemesi kalite derecesi. Standart kaliteler N " +
      "(NR · doğal kauçuk) ve S (CR · kloropren); özel kaliteler (SBR, EPDM, " +
      "NBR, VMQ) yalnız büyük siparişlerde temin edilir. Değerler ortam " +
      "sıcaklığına göre değişebilir.",
    tables: [
      {
        headers: ["Özellik", "N · NR", "S · CR", "SBR", "EPDM", "NBR", "VMQ"],
        rows: [
          ["Aşınma direnci", "++", "++", "++", "+", "++", "--"],
          ["Kopma uzaması", "+++", "++", "++", "+", "++", "○"],
          ["Yırtılma direnci", "++", "++", "+", "+", "+", "---"],
          ["Geri sekme (rebound)", "++", "+", "+", "+", "+", "+"],
          ["Çekme muk. (takviyesiz)", "+++", "+", "--", "--", "--", "---"],
          ["Çekme muk. (takviyeli)", "+++", "++", "++", "+", "++", "○"],
          ["Sıcaklık — sıcak hava", "+90°C", "+120°C", "+100°C", "+150°C", "+130°C", "+200°C"],
          ["Sıcaklık — soğuk", "−50°C", "−30°C", "−40°C", "−40°C", "−40°C", "−80°C"],
          ["Alkali direnci", "+", "++", "+", "++", "+", "--"],
          ["Yaşlanma direnci", "+", "++", "+", "+++", "+", "+++"],
          ["Benzin direnci", "---", "++", "○", "--", "+++", "--"],
          ["Elektrik yalıtım direnci", "+++", "+", "++", "++", "+", "+++"],
          ["Yağ ve gres direnci", "---", "++", "--", "○", "+++", "+++"],
          ["Ozon direnci", "○", "++", "○", "+++", "+", "+++"],
          ["Asit direnci", "+", "++", "+", "+++", "○", "--"],
          ["Sıcak su", "+", "+", "++", "++", "+", "--"],
        ],
        footnote:
          "+++ çok iyi · ++ iyi · + yeterli · ○ orta · -- zayıf · --- yetersiz. " +
          "NBR elektrik yalıtımı kaynak katalogda belirsiz basılıdır. " +
          "Toleranslar ISO 3302-1M.",
      },
    ],
    notes: [
      "N (NR) ve S (CR) standart kalitelerdir; özel kaliteler (SBR, EPDM, NBR, " +
        "VMQ) yalnız büyük sipariş adetlerinde temin edilir — üretici teyidi alın.",
      "Kalite derecesi malzeme etkileşimine ve maruz kalma süresine göre değişir; " +
        "tablo yön göstericidir, kesin şartname değildir.",
    ],
  },

  "Redüktör Mil Yönleri": {
    code: "Redüktör Mil Yönleri",
    title: "Redüktör mil ve flanş yönleri (R / L / U / V)",
    source: "YILMAZ Redüktör — Mil ve Flanş Pozisyonları kataloğu",
    clause: "Çıkış özelliğine (00…08) göre geçerli yönler",
    summary:
      "Çıkış mili/flanş yönü: R sağ, L sol, U üst, V alt. Bazı çıkış " +
      "özelliklerinde U ve V geçersizdir (delik milli 00 ve çift çıkış 04). " +
      "Kod sonu giriş mili (küçük mil) adedini gösterir: 1 tek, 2 çift " +
      "(ör. R1 sağ/tek giriş, R2 sağ/çift giriş).",
    tables: [
      {
        headers: ["Çıkış Özelliği", "R (Sağ)", "L (Sol)", "U (Üst)", "V (Alt)"],
        rows: [
          ["00 Delik Milli", "✓", "✓", "—", "—"],
          ["01 Mil Çıkışlı", "✓", "✓", "✓", "✓"],
          ["02 Mil Çıkışlı + Flanşlı", "✓", "✓", "✓", "✓"],
          ["03 Delik Milli + Flanşlı", "✓", "✓", "✓", "✓"],
          ["04 Çift Çıkış Milli", "✓", "✓", "—", "—"],
          ["05 Çift Mil + Flanşlı", "✓", "✓", "✓", "✓"],
          ["08 Delik Milli + Çift Flanşlı", "✓", "✓", "✓", "✓"],
        ],
        footnote: "✓ geçerli · — geçersiz (o özellikte o yön üretilmez).",
      },
    ],
    notes: [
      "Giriş mili (küçük mil) ÇİFT olabilir: her iki uçtan giriş için '2' " +
        "soneki kullanılır (R2/L2/U2/V2). Tek giriş milli için '1' (R1/L1/U1/V1).",
      "Yönler redüktöre ÜSTTEN bakışa göredir. Kesin geçerlilik ve ölçüler " +
        "üretici kataloğundan doğrulanır.",
    ],
  },

  "IEC 60034-1 Yalıtım Sınıfı": {
    code: "IEC 60034-1",
    title: "Sargı yalıtım sınıfı (B / F / H)",
    source: "IEC 60034-1 — Dönen elektrik makineleri: anma değerleri ve çalışma özellikleri",
    clause: "Termal sınıflar",
    summary:
      "Yalıtım sınıfı, motor sargı yalıtımının SÜREKLİ dayanabileceği en " +
      "yüksek sıcaklığı belirtir. Sınıf bir dayanım sınırıdır, bir çalışma " +
      "sıcaklığı değildir: motor normalde sınıfının altında ısınır ve aradaki " +
      "fark ömür payıdır.",
    tables: [
      {
        headers: ["Sınıf", "Maks. sargı sıcaklığı"],
        rows: [
          ["B", "130 °C"],
          ["F", "155 °C"],
          ["H", "180 °C"],
        ],
        footnote: "ORION standardı F sınıfıdır.",
      },
    ],
    notes: [
      "Yaygın uygulama F yalıtım / B sıcaklık artışıdır: sargı F'e göre " +
        "yalıtılır ama B sınırında çalıştırılır; aradaki 25 K, sıcak ortamda " +
        "ve ağır rejimde harcanan ömür payıdır.",
      "Ortam sıcaklığı üst sınırı 40 °C'yi aşıyorsa motorun anma gücü " +
        "düşürülür (derating) — yalıtım sınıfını yükseltmek bunun yerine geçmez.",
    ],
  },

  "IEC 60034-1 Çalışma Sınıfı": {
    code: "IEC 60034-1",
    title: "Çalışma sınıfları — duty types (S1…S10)",
    source: "IEC 60034-1 — Dönen elektrik makineleri: anma değerleri ve çalışma özellikleri",
    clause: "Çalışma biçimleri (duty types)",
    summary:
      "Çalışma sınıfı motorun yük/dinlenme rejimini tanımlar ve TERMAL " +
      "BOYUTLANDIRMAYI belirler. Katalog etiket değeri S1'dir; vinç " +
      "tahriklerinin gerçek rejimi çoğu kez S3/S4'tür ve o seçildiğinde " +
      "siparişte açıkça belirtilmelidir.",
    tables: [
      {
        headers: ["Tip", "Açıklama"],
        rows: [
          ["S1", "Sürekli çalışma — termal denge kurulana kadar sabit yük. Pompa, fan, konveyör. Standart etiket değeri."],
          ["S2", "Kısa süreli çalışma — belirli süre yük, sonra tam soğuma (ör. S2 30 dk). Baraj kapağı, kriko."],
          ["S3", "Kesintili periyodik — yük/duruş çevrimi, kalkış akımı ihmal edilebilir. Devrede kalma oranı %'yle verilir (ör. S3 %40). Asansör, pres."],
          ["S4", "S3 + kalkışın termal etkisi önemli (sık start). Vinç, kaldırma."],
          ["S5", "S4 + elektriksel frenleme içerir."],
          ["S6", "Kesintili sürekli — duruş yok, yüksüz (rölanti) çalışma var. Takım tezgâhı."],
          ["S7", "S6 + frenlemeli, boşta çalışma yok."],
          ["S8", "Değişken yük ve devirli periyodik çalışma."],
          ["S9", "Yük ve devir periyodik olmayan şekilde değişir."],
          ["S10", "Ayrık sabit yük/devir kademeleri, her kademede farklı termal durum."],
        ],
        footnote: "ORION standardı S1'dir; rejim farklıysa kutu değiştirilir.",
      },
    ],
    notes: [
      "Vinç kaldırma ve yürütme mekanizmalarının fiziksel rejimi S4'tür " +
        "(sık kalkış, kalkış ısısı belirleyici). Motor S1 etiketiyle sipariş " +
        "edilse de mekanizmanın FEM sınıfı (M/T) hesabın termal payını zaten " +
        "taşır; iki sınıflandırma birbirinin yerine geçmez.",
    ],
  },

  "Redüktör Montaj Pozisyonları": {
    code: "Redüktör Montaj Pozisyonları",
    title: "Redüktör montaj pozisyonları (M1…M6)",
    source: "YILMAZ Redüktör — Montaj Pozisyonları kataloğu",
    clause: "Uzaydaki montaj yönü",
    summary:
      "Montaj pozisyonu redüktörün uzaydaki yönünü belirler; yağ seviyesi, " +
      "havalandırma tapası ve yağ tahliye tapasının yeri buna göre değişir. " +
      "Siparişte pozisyon bildirilmezse üretici M1 (yatay standart) kabul eder.",
    tables: [
      {
        headers: ["Pozisyon", "Yön"],
        rows: [
          ["M1", "Yatay — standart (ayaklar altta)"],
          ["M2", "Dikey — çıkış mili aşağı"],
          ["M3", "Yatay — ters (ayaklar üstte)"],
          ["M4", "Dikey — çıkış mili yukarı"],
          ["M5", "Yatay — bir yan üzerinde"],
          ["M6", "Yatay — diğer yan üzerinde"],
        ],
        footnote: "Yönler tipiktir; kesin oryantasyon üretici kataloğundaki şemaya göredir.",
      },
    ],
    notes: [
      "Montaj pozisyonu YAĞLAMA açısından kritiktir: yanlış pozisyon yağ " +
        "seviyesini ve tapaların yerini değiştirir. Standart dışı pozisyon " +
        "siparişte AÇIKÇA belirtilmelidir.",
    ],
  },
};

const REGISTRY: Record<string, StandardRef> = {
  ...FEM_REFS,
  ...CMAA_REFS,
  ...DIN_REFS,
  ...MANUF_REFS,
};

/** Aynı içeriğe işaret eden alternatif yazımlar. */
const ALIASES: Record<string, string> = {
  "FEM 1.001 §2.2.2.1.1": "FEM 1.001 2.2.2.1.1",
  "FEM 1.001 T.2.2.3.1.1": "FEM 1.001 2.2.3.1.1",
  "FEM 1.001 2.3.1": "FEM 1.001 §2.3.1",
  "FEM 1.001 2.3.3": "FEM 1.001 §2.3.3",
  "FEM 1.001 T.4.2.4.1": "FEM 1.001 4.2.4.1",
  "FEM 1.001 T.4.2.4.1.3": "FEM 1.001 T.4.2.4.1.3 / T.9.12.a",
  "FEM T.3.2.1.1": "FEM 1.001 T.3.2.1.1",
  "DIN 15018 Tablo 17": "DIN 15018 T.17",
  "DIN 15018 T.17/18": "DIN 15018 Tablo 18",
  "DIN 15018 Tablo 17/18": "DIN 15018 Tablo 18",
  "DIN 15018 Bölüm 7.4.5": "DIN 15018 7.4.5",
  "DIN 15018 T.18": "DIN 15018 Tablo 18",
  "CMAA #74, 4.5": "CMAA 70 4.11.4.1",
  "DIN 15401": "DIN 15400",
  "DIN 15402": "DIN 15400",
};

/** Karşılaştırma için normalize: boşluk sadeleştirme, § ve "T." önekini atma. */
function normalize(code: string): string {
  return code
    .trim()
    .replace(/\s+/g, " ")
    .replace(/§/g, "")
    .replace(/\bT\.(?=\d)/g, "")
    .replace(/\bTablo\s+/gi, "")
    .replace(/\bBölüm\s+/gi, "")
    .replace(/\bMadde\s+/gi, "")
    .toLocaleUpperCase("tr-TR");
}

const NORMALIZED_INDEX: Map<string, StandardRef> = (() => {
  const map = new Map<string, StandardRef>();
  for (const [key, ref] of Object.entries(REGISTRY)) {
    map.set(normalize(key), ref);
  }
  for (const [alias, target] of Object.entries(ALIASES)) {
    const ref = REGISTRY[target];
    if (ref) map.set(normalize(alias), ref);
  }
  return map;
})();

/**
 * Hesap satırındaki `standard` dizesinden referans kaydını bulur.
 * Birebir eşleşme yoksa normalize edilmiş eşleşme, o da yoksa "A / B" biçimli
 * bileşik referansın ilk parçası denenir.
 */
export function resolveStandardRef(code: string | undefined): StandardRef | undefined {
  if (!code) return undefined;
  const direct = REGISTRY[code];
  if (direct) return direct;
  const aliased = ALIASES[code];
  if (aliased && REGISTRY[aliased]) return REGISTRY[aliased];
  const norm = NORMALIZED_INDEX.get(normalize(code));
  if (norm) return norm;
  // "FEM 1.001 T.4.2.4.1.3 / T.9.12.a" gibi bileşik referanslarda ilk parça
  const first = code.split("/")[0]?.trim();
  if (first && first !== code) {
    return NORMALIZED_INDEX.get(normalize(first));
  }
  return undefined;
}

/** Bir referansın defterde karşılığı var mı (rozeti tıklanabilir yapmak için). */
export function hasStandardRef(code: string | undefined): boolean {
  return resolveStandardRef(code) !== undefined;
}
