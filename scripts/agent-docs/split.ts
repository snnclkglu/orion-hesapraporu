/**
 * AGENTS.md'yi yönlendirici + alan dosyalarına BÖLER.
 *
 *   npx tsx scripts/agent-docs/split.ts          → prova (scratch dizinine yazar, hiçbir şeye dokunmaz)
 *   npx tsx scripts/agent-docs/split.ts --uygula → gerçekten uygular
 *
 * Bölme KAYIPSIZDIR ve bunu iddia etmez, ÖLÇER: her bloğun gövdesi yazıldıktan
 * sonra geri okunur ve kaynakla satır satır karşılaştırılır. Tek bir satır
 * düşerse betik yığın iziyle patlar — "sanırım hepsi taşındı" bu belgede
 * kabul edilebilir bir cümle değil.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { coz, kimlik, kirp, type Blok } from "./lib";
import {
  ALANLAR,
  KAP_BOLUMLER,
  KOKTE_KALAN,
  PROSEDUR_BOLUMLER,
  type Alan,
} from "./manifest";

// Betik uygulama kökünden koşar (`npx tsx scripts/agent-docs/split.ts`).
// `import.meta.url` KULLANILMAZ: workspace yolunda boşluk var ve URL biçimi
// onu `%20` yapıyor, `readFileSync` de o yolu bulamıyor (ölçüldü).
const KOK = process.cwd();
const KAYNAK = join(KOK, "AGENTS.md");
if (!existsSync(KAYNAK)) {
  throw new Error(`AGENTS.md bulunamadı — betik uygulama kökünden koşturulur (şu an: ${KOK})`);
}
const UYGULA = process.argv.includes("--uygula");
const HEDEF = UYGULA ? KOK : join(KOK, ".tmp-agent-docs");

// ─────────────────────────────────────────────────────────── eşleştirme

const belge = coz(KAYNAK);
const SS = belge.satirSonu;

/** Bir seçici (`bolum` ya da `bolum|başlık-öneki`) bloğa uyuyor mu? */
function uyuyor(secici: string, b: Blok): boolean {
  const [bolum, bas] = secici.split("|");
  if (b.bolum !== bolum) return false;
  if (!bas) return b.tur === "bolum" || true; // bölümün tamamı
  return b.tur === "madde" && kimlik(b.baslik).startsWith(kimlik(bas));
}

const sahip = new Map<Blok, Alan>();
for (const alan of ALANLAR) {
  for (const secici of alan.al) {
    const [, bas] = secici.split("|");
    const bulunan = belge.bloklar.filter((b) =>
      bas ? uyuyor(secici, b) : b.bolum === secici,
    );
    if (bulunan.length === 0) {
      throw new Error(`PLAN ESKİMİŞ: "${secici}" hiçbir bloğa uymuyor (${alan.dosya}.md)`);
    }
    if (bas && bulunan.length > 1) {
      throw new Error(
        `SEÇİCİ BELİRSİZ: "${secici}" ${bulunan.length} bloğa birden uyuyor — başlık önekini uzat`,
      );
    }
    for (const b of bulunan) {
      const onceki = sahip.get(b);
      if (onceki && onceki !== alan) {
        throw new Error(`ÇİFT SAHİP: "${b.baslik}" hem ${onceki.dosya} hem ${alan.dosya}`);
      }
      sahip.set(b, alan);
    }
  }
}

const kokte = new Set(
  belge.bloklar.filter((b) => b.tur === "bolum" && KOKTE_KALAN.includes(b.bolum)),
);
// Kökte kalan bölümün altındaki maddeler de kökte kalır.
for (const b of belge.bloklar) {
  if (b.tur === "madde" && KOKTE_KALAN.includes(b.bolum)) kokte.add(b);
}

// Kap bölümler: yalnız başlık satırı taşırlar, maddeleri alanlara dağılmıştır.
// Gövdeleri boş DEĞİLSE sessizce düşmemeleri gerekir — kayıp denetimi yakalar.
const kap = new Set(
  belge.bloklar.filter((b) => b.tur === "bolum" && KAP_BOLUMLER.includes(b.bolum)),
);
for (const b of kap) {
  if (kirp(b.satirlar.slice(1)).length) {
    throw new Error(`KAP SANILAN BÖLÜMÜN GÖVDESİ VAR: "${b.bolum}" — plana alan olarak ekle`);
  }
}

const sahipsiz = belge.bloklar.filter(
  (b) => !sahip.has(b) && !kokte.has(b) && !kap.has(b),
);
if (sahipsiz.length) {
  console.error("\nSAHİPSİZ BLOKLAR — plana eklenmeden bölme yapılmaz:");
  for (const b of sahipsiz) {
    console.error(`  satır ${b.satirNo}  [${b.bolum}] ${b.no ? b.no + ". " : ""}${b.baslik}`);
  }
  throw new Error(`${sahipsiz.length} blok hiçbir alana atanmamış`);
}

// ─────────────────────────────────────────────────────────── biçimlendirme

/** Madde bloğunu başlık + gövdeye ayırır; liste girintisini söker. */
function maddeyiYaz(b: Blok, onek: string): { kimlikNo: string; satirlar: string[] } {
  const ilk = b.satirlar[0];
  // `s` bayrağı YOK: tsconfig hedefi onu desteklemiyor (TS1501) ve gerek de
  // yok — `ilk` tek bir satırdır, `.` zaten hepsini görür.
  const m = /^\d+[a-z]?\. \*\*(.+?)\*\*(.*)$/.exec(ilk);
  const baslik = m ? m[1] : b.baslik;
  const kalan = m ? m[2].trim() : "";
  const kimlikNo = onek ? `${onek}-${b.no}` : b.no;

  const govde = b.satirlar.slice(1);
  // Liste devamı girintisi (3–4 boşluk) sökülür; kod bloğu görece korunur.
  const girintiler = govde.filter((s) => s.trim()).map((s) => s.length - s.trimStart().length);
  const ortakGirinti = girintiler.length ? Math.min(...girintiler) : 0;
  const acilmis = govde.map((s) => (s.trim() ? s.slice(ortakGirinti) : ""));

  return {
    kimlikNo,
    satirlar: kirp([`## ${kimlikNo} — ${baslik}`, "", ...(kalan ? [kalan] : []), ...acilmis]),
  };
}

/** Gövde bloğunu (## bölüm) başlık düzeyini bir kademe indirerek yazar. */
function bolumuYaz(b: Blok): string[] {
  return kirp(b.satirlar.slice(1));
}

// ─────────────────────────────────────────────────────────── üretim

type Uretilen = { yol: string; icerik: string };
const uretilenler: Uretilen[] = [];
const kimlikDefteri: { id: string; alan: string; no: string; baslik: string }[] = [];

for (const alan of ALANLAR) {
  const bloklar = belge.bloklar.filter((b) => sahip.get(b) === alan);
  const govde: string[] = [];

  govde.push(`# ${alan.baslik}`, "");
  govde.push(
    `> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.`,
    `> Kök kurallar ve harita: \`AGENTS.md\`. Bu dosya ELLE düzenlenir;`,
    // Kapsamı olmayan alanın kural dosyası ÜRETİLMEZ; başlıkta ondan söz
    // etmek, denetçinin haklı olarak "böyle bir yol yok" demesine yol açar.
    alan.yollar.length
      ? `> \`.claude/rules/${alan.dosya}.md\` ve haritadaki satır ondan ÜRETİLİR`
      : `> haritadaki satır ondan ÜRETİLİR`,
    `> (\`npx tsx scripts/agent-docs/split.ts --uygula\`).`,
    "",
  );
  if (alan.yollar.length) {
    govde.push(`**Kapsam:** ${alan.yollar.map((y) => `\`${y}\``).join(" · ")}`, "");
  }

  for (const b of bloklar) {
    if (b.tur === "bolum") {
      const ic = bolumuYaz(b);
      // Bölümün kendi adı zaten dosya başlığıdır; alt maddeleri ayrıca gelir.
      if (ic.length) govde.push(...ic, "");
    } else if (PROSEDUR_BOLUMLER.includes(b.bolum)) {
      // Adım listesi: kimlik almaz, liste biçiminde aynen taşınır.
      govde.push(...kirp(b.satirlar), "");
    } else {
      const { kimlikNo, satirlar } = maddeyiYaz(b, alan.onek);
      kimlikDefteri.push({ id: kimlikNo, alan: alan.dosya, no: b.no, baslik: b.baslik });
      govde.push(...satirlar, "");
    }
  }

  uretilenler.push({
    yol: join("docs", "agent", `${alan.dosya}.md`),
    icerik: kirp(govde).join(SS) + SS,
  });

  if (alan.yollar.length) {
    const yollar = alan.yollar.flatMap((y) => [y, `orion-hesapraporu/${y}`]);
    const kural = [
      "---",
      "paths:",
      ...yollar.map((y) => `  - "${y}"`),
      "---",
      "",
      `# ${alan.baslik} — kurallar \`docs/agent/${alan.dosya}.md\` dosyasındadır`,
      "",
      `Bu alanda **yazmadan önce** \`docs/agent/${alan.dosya}.md\` dosyasını OKU.`,
      `${alan.ozet}.`,
      "",
      alan.onek
        ? `Madde kimlikleri \`${alan.onek}-N\` biçimindedir; kod yorumlarındaki atıflar bu deftere gider.`
        : "",
    ];
    uretilenler.push({
      yol: join(".claude", "rules", `${alan.dosya}.md`),
      icerik: kirp(kural).join(SS) + SS,
    });
  }
}

// ─────────────────────────────────────────────────────────── kök yönlendirici

const kokBloklari = belge.bloklar.filter((b) => kokte.has(b));
const harita = ALANLAR.map(
  (a) => `| ${a.baslik} | \`docs/agent/${a.dosya}.md\` | ${a.ozet} |`,
).join(SS);

/**
 * DEĞİŞMEZLER — alan dosyası okunmasa bile uyulması gerekenler.
 *
 * Buraya yalnız HER YERDE geçerli ve çiğnenmesi PAHALI olan kurallar girer.
 * Gerekçeler burada DEĞİL, atıf verdiği alan dosyasındadır: gerekçe bir kez
 * okunur, kural her oturumda yüklenir.
 */
const DEGISMEZLER = [
  "## Değişmezler",
  "",
  "Bunlar alan dosyası okunmadan da geçerlidir. Gerekçeleri atıf verilen dosyadadır.",
  "",
  "1. **Excel'e bakarak kod yazma** — kaynak standardın maddesidir (yukarıdaki temel ilke).",
  "2. **Arayüz, rapor ve kod yorumları TÜRKÇE**; tanımlayıcılar İngilizce lowerCamelCase.",
  "3. **Ad alanları BÜYÜK HARF saklanır** — `adBuyuk`/`kimlikBuyuk`, düz `toUpperCase()` DEĞİL",
  '   ("İş" → "IS" olurdu). Dönüşüm hem formda hem Zod şemasında yapılır (`IS-14`).',
  "4. **UYDURMA VERİ GİRİLMEZ.** Bilinmeyen alan BOŞ kalır; `0` ya da `1` varsayılmaz —",
  "   sessiz bir varsayım, yanlış adet sipariş ettirmenin en kısa yoludur (`SATIN-21`).",
  "5. **YER TUTUCU BİR DEĞER DEĞİLDİR.** Veri örneği taşıyan `placeholder` yasaktır;",
  "   boş kutu `null` üretir, ekranda `—` görünür (`SATIS-16`).",
  "6. **Renk HEX değil AÇIdır** (OKLCH ton). Doygunluk/parlaklık `globals.css`te ve tema",
  "   başına verilir; grafikte, çipte, satır zemininde elle hex yazılmaz (`IS-14`).",
  "7. **Çekirdekler SAFTIR.** `lib/calc`, `lib/purchasing`, `lib/personnel`, `lib/drawings`,",
  "   `lib/panel` DB/HTTP/React içe aktarmaz.",
  "8. **Bir kural iki yerde yaşıyorsa** (TS + SQL) ayrışmayı bir test KAYNAK DOSYAYI",
  "   okuyarak engeller (`terms.test.ts` deseni).",
  "9. **Migration'ı ajan uygular.** Yeni migration eklerken `ls supabase/migrations` ile",
  "   aynı gün başka bir dosyanın aynı damgayı taşımadığı doğrulanır — çakışan sürüm",
  "   `db push`u uzak veritabanında düşürür.",
  "10. **Dokunmatik tabanı:** hedef `.oc-tap` ile 44px, girdi yazısı 16px, yükseklik `dvh`,",
  "    telefonda ANA TABLO yatay kaymaz — listeye katlanır. Ayrıntı: `docs/agent/arayuz.md`.",
  "11. **Ekran değiştirdiysen `/dev/*-preview` sayfasına ÖNCE bak** (auth'suz, gerçek fikstür).",
  "12. **Yeni kural bu dosyaya değil alan dosyasına yazılır** (aşağıdaki harita).",
  "",
];

const router = [
  ...belge.onsoz,
  ...kirp(belge.giris),
  "",
  ...kokBloklari.flatMap((b) => [...kirp(b.satirlar), ""]),
  ...DEGISMEZLER,
  "## HARİTA — hangi işte hangi dosyayı okumalısın",
  "",
  "Kural gövdeleri bu dosyada DEĞİL, alan dosyalarındadır. Bir bölüme dokunmadan",
  "önce satırındaki dosyayı OKU. `.claude/rules/` altındaki yol kapsamlı",
  "işaretçiler aynı yönlendirmeyi otomatik yapar; harita onların yedeğidir.",
  "",
  "| Alan | Dosya | Kapsam |",
  "|---|---|---|",
  harita,
  "",
  "**Madde kimliği ALAN ÖNEKİ taşır** (`ROL-15`, `HESAP-15`, `MOBIL-15`). Numara",
  "korunmuştur; önek, aynı numaranın üç ayrı maddeye denk gelmesinden doğan",
  "belirsizliği kapatır. Kod yorumlarındaki atıflar da bu biçimdedir.",
  "",
  "**Yeni kural buraya YAZILMAZ**, alan dosyasına yazılır. Bu dosya her oturumda",
  "ve her alt-ajanda bütünüyle yüklenir; büyümesi bütün ajanların bedelidir.",
  "Yeni bir alan açılırsa `scripts/agent-docs/manifest.ts`e eklenir ve",
  "`npx tsx scripts/agent-docs/split.ts --uygula` haritayı, alan dosyasını ve",
  "kural işaretçisini birlikte tazeler. Denetim: `npx tsx scripts/agent-docs/doctor.ts`.",
  "",
].join(SS);

// Kimlik BENZERSİZ olmalı — bölmenin var oluş sebebi bu. Aynı öneke iki kez
// aynı numarayı vermek, kapatmaya çalıştığımız belirsizliği geri getirirdi.
const gorulen = new Map<string, string>();
for (const k of kimlikDefteri) {
  const onceki = gorulen.get(k.id);
  if (onceki) {
    throw new Error(`KİMLİK ÇAKIŞMASI: ${k.id} hem "${onceki}" hem "${k.baslik}"`);
  }
  gorulen.set(k.id, k.baslik);
}

uretilenler.push({ yol: "AGENTS.md", icerik: router + SS });
uretilenler.push({
  yol: join("docs", "agent", "kimlikler.json"),
  icerik: JSON.stringify(kimlikDefteri, null, 2) + SS,
});

// ─────────────────────────────────────────────────────────── yaz + ölç

if (!UYGULA) rmSync(HEDEF, { recursive: true, force: true });
for (const u of uretilenler) {
  const tam = join(HEDEF, u.yol);
  mkdirSync(dirname(tam), { recursive: true });
  writeFileSync(tam, u.icerik, "utf8");
}

/**
 * KAYIP DENETİMİ — blok blok, JETON JETON.
 *
 * Satır kümesi karşılaştırmak YETMEZ: bölme bir maddenin ilk satırını bilerek
 * ikiye ayırıyor (`1. **Başlık.** gövde…` → başlık satırı + gövde satırı) ve
 * liste girintisini söküyor. O yüzden karşılaştırma BİÇİMİ değil METNİ ölçer:
 * her blok kendi çıktı dosyasında bulunur, iki taraf da markdown süsünden
 * arındırılıp jeton dizisine indirgenir ve diziler BİREBİR eşit olmalıdır.
 * Blok başına bakmak dosyalar arası sıra sorununu da doğurmaz.
 */
const jetonla = (satirlar: string[]): string[] =>
  satirlar
    .join("\n")
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\d+[a-z]?\.\s+/gm, "")
    .replace(/^[A-ZÇĞİÖŞÜ]+-\d+[a-z]?\s+—\s+/gm, "")
    .replace(/\*\*/g, "")
    .split(/\s+/)
    .filter(Boolean);

const ciktiJetonlari = new Map<string, string[]>();
for (const u of uretilenler) {
  if (u.yol.endsWith(".json")) continue;
  ciktiJetonlari.set(u.yol, jetonla(readFileSync(join(HEDEF, u.yol), "utf8").split("\n")));
}

/** `ara` dizisi `icinde` dizisinde ARDIŞIK olarak geçiyor mu? */
function ardisikGeciyor(icinde: string[], ara: string[]): boolean {
  if (!ara.length) return true;
  for (let i = 0; i + ara.length <= icinde.length; i++) {
    let k = 0;
    while (k < ara.length && icinde[i + k] === ara[k]) k++;
    if (k === ara.length) return true;
  }
  return false;
}

const kayip: string[] = [];
for (const b of belge.bloklar) {
  if (kap.has(b)) continue;
  const alan = sahip.get(b);
  const yol = kokte.has(b) ? "AGENTS.md" : join("docs", "agent", `${alan!.dosya}.md`);
  const hedefJetonlar = ciktiJetonlari.get(yol);
  if (!hedefJetonlar) {
    kayip.push(`${b.baslik} → ${yol} (dosya üretilmedi)`);
    continue;
  }
  // Bölüm bloğunun `## Ad` başlığı dosya başlığına dönüşür; gövdesi ölçülür.
  const olculecek = b.tur === "bolum" && !kokte.has(b) ? b.satirlar.slice(1) : b.satirlar;
  if (!ardisikGeciyor(hedefJetonlar, jetonla(kirp(olculecek)))) {
    kayip.push(`${b.no ? b.no + ". " : ""}${b.baslik} → ${yol}`);
  }
}

console.log(`\nKAYNAK  ${KAYNAK}`);
console.log(`HEDEF   ${HEDEF}${UYGULA ? "" : "   (PROVA — gerçek dosyalara dokunulmadı)"}\n`);

const bayt = (s: string) => Buffer.byteLength(s, "utf8");
const kokBayt = bayt(router);
console.log(`AGENTS.md  ${bayt(readFileSync(KAYNAK, "utf8"))} B  →  ${kokBayt} B`);
console.log(`${uretilenler.length - 2} dosya üretildi (alan + kural)\n`);
for (const u of uretilenler.filter((x) => x.yol.startsWith("docs"))) {
  console.log(`  ${String(bayt(u.icerik)).padStart(7)} B  ${u.yol}`);
}

const olculenBlok = belge.bloklar.length - kap.size;
console.log(`KAYIP DENETİMİ: ${olculenBlok} blok, jeton jeton karşılaştırıldı`);
if (kayip.length) {
  console.error(`\n✗ ${kayip.length} BLOK EKSİK YA DA BOZULDU:`);
  for (const s of kayip) console.error(`    ${s}`);
  throw new Error("bölme kayıplı — uygulanmadı");
}
console.log("✓ her bloğun metni hedef dosyada birebir duruyor\n");
