// Birleşik İmalat PDF'i — atölyenin tek dosyada yazdıracağı resim destesi.
//
//     /drawings/<id>/export/production-pdf                       → bütün orman
//     /drawings/<id>/export/production-pdf?kok=0043-00-0100      → yalnız o alt ağaç
//     /drawings/<id>/export/production-pdf?bas=100               → sınırın ötesi
//
// NEDEN VAR: `export/production` aynı listeyi EXCEL olarak veriyor ama resmin
// kendisini vermiyor; atölye 171 PDF'i tek tek açıp tek tek yazdırıyordu.
// `@react-pdf/renderer` var olan PDF'leri birleştiremez, bu iş `pdf-lib`indir
// (`lib/pdf/merge.ts` başlığında gerekçesiyle).
//
// KAPSAM, EXCEL LİSTESİNİN AYNISIDIR ve bilinçli olarak öyledir: aynı
// `imalatListesi` çağrılır, aynı `?kok=` süzgeci geçerlidir, sıra aynı
// `drawing_parts.sort`tur. İkisi ayrı hesaplansaydı elindeki deste ile
// elindeki liste sessizce ayrışırdı — bu depoda birden çok kez yaşanmış hata.
// Bir satırın resmi (`sheet_file_id`) yoksa o satır sessizce yok sayılmaz,
// künyede sayılır.
//
// "İMALAT PARÇASI" BURADA `kind === "imalat"` DEĞİL, İMALAT LİSTESİNİN
// SATIRIDIR. `kind` süzgeci koysaydık montaj satırlarının genel görünüş
// resimleri düşerdi ve kaynakçının ilk baktığı sayfa tam odur; satın alma
// satırının resmi ise zaten çok seyrek, olduğunda da zararsızdır.
//
// YETKİ YALNIZ OTURUMDUR (`exportBaglami`): çıktı indirmek OKUMADIR,
// `canEditDrawings` sorulmaz. `package-outputs.tsx` de aynı sebeple yetki
// kapısının dışındadır.

import type { NextRequest } from "next/server";
import { APP_NAME, COMPANY_NAME } from "@/lib/app";
import { downloadFileName } from "@/lib/pdf/doc-naming";
import { pdfBirlestir, type BirlesecekPdf } from "@/lib/pdf/merge";
import { imalatListesi } from "@/lib/drawings/derive";
import { createClient } from "@/lib/supabase/server";
import { loadFiles, loadParts, type FileRow } from "../../../data";
import { exportBaglami } from "../shared";

export const runtime = "nodejs";

/**
 * İşlevin süre tavanı. 60 s her Vercel planında kabul edilen üst değerdir;
 * daha yükseği plana bağlıdır ve dağıtımı kırardı. Aşağıdaki iki sınır bu
 * bütçeye göre seçilmiştir.
 */
export const maxDuration = 60;

const BUCKET = "drawings";

/**
 * Bir indirmede birleştirilecek EN ÇOK resim.
 *
 * MTC paketinde 171 resim var ve toplamı ~100 MB (ortalama 585 KB/dosya,
 * `import/route.ts` ölçümü). O desteyi tek istekte indirip pdf-lib ile
 * ayrıştırmak hem 60 s'yi hem de işlevin bellek tavanını zorlar: pdf-lib ham
 * baytı da ayrıştırılmış nesne ağacını da bellekte tutar ve ikincisi
 * birincinin birkaç katıdır.
 *
 * SINIR AŞILDIĞINDA İŞ DÜŞMEZ: sınıra kadar birleşir, dışarıda kalan sayı
 * dosya ADINDA ve belge künyesinde yazar, kalanı `?bas=` ile alınır
 * (`import/route.ts`teki `?ofset=` deseninin aynısı). MTC ölçüsünde deste
 * İKİYE bölünür; bu bilinçli bir karardır — yarısı elde olan bir atölye,
 * 500 hatası alan bir atölyeden iyidir.
 */
const EN_COK_RESIM = 100;

/** Aynı bütçenin bayt yüzü: 100 dosya ortalama boyda ~58 MB eder. */
const EN_COK_TOPLAM_BAYT = 64 * 1024 * 1024;

/**
 * Eşzamanlı indirme sayısı.
 *
 * Baskın maliyet AYRIŞTIRMA DEĞİL İNDİRMEDİR (aynı ölçüm). Sırayla inen 100
 * dosya tek başına süre bütçesini yer; altı koldan inince gidiş-dönüş süresi
 * örtüşür. Daha yükseği depo tarafında kısıtlanma riskini büyütür.
 */
const ESZAMANLI_INDIRME = 6;

/** Künyede adıyla sayılacak en çok atlanan dosya — künye bir liste değildir. */
const KUNYEDE_EN_COK_AD = 12;

interface ResimAdayi {
  ad: string;
  storagePath: string;
  boyut: number;
}

function metinYanit(mesaj: string, status: number): Response {
  return new Response(mesaj, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

interface KunyeSayilari {
  birlesen: number;
  sayfaSayisi: number;
  aralikMetni: string;
  adaySayisi: number;
  kalan: number;
  resimsizSatir: number;
  canliOlmayan: number;
  depodaOlmayan: number;
  alinamayan: readonly { ad: string; sebep: string }[];
  hazirlayan: string;
  tarih: string;
}

/**
 * Belge künyesi (PDF "Konu" alanı) — dosya adının taşıyamadığı AYRINTI.
 *
 * Dosya adı yalnız bir SAYI taşıyabilir ("3 resim alınamadı"); hangi resmin
 * hangi sebeple dışarıda kaldığını taşıyamaz. Bu metin belgenin özelliklerinde
 * durur ve soru sorulduğunda cevabı olur — `drawing_files.upload_error`
 * alanının var oluş gerekçesiyle aynı.
 */
function kunyeMetni(s: KunyeSayilari): string {
  return [
    `${s.birlesen} resim birleştirildi (${s.aralikMetni}; bu seçimde toplam ${s.adaySayisi}).`,
    `${s.sayfaSayisi} sayfa.`,
    s.kalan > 0 ? `${s.kalan} resim sınır nedeniyle bu dosyaya girmedi.` : "",
    s.resimsizSatir > 0 ? `${s.resimsizSatir} defter satırının ölçülü resmi yok.` : "",
    s.canliOlmayan > 0 ? `${s.canliOlmayan} resim canlı olmadığı için alınmadı.` : "",
    s.depodaOlmayan > 0 ? `${s.depodaOlmayan} resmin baytları depoda bulunamadı.` : "",
    s.alinamayan.length
      ? `Açılamayan: ${s.alinamayan
          .slice(0, KUNYEDE_EN_COK_AD)
          .map((a) => `${a.ad} (${a.sebep})`)
          .join("; ")}${s.alinamayan.length > KUNYEDE_EN_COK_AD ? " …" : ""}`
      : "",
    `Hazırlayan: ${s.hazirlayan} · ${s.tarih}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Yetki + belge kimliği + künye: dört türev ucun ORTAK yükü.
  const sonuc = await exportBaglami(id);
  if ("hata" in sonuc) return sonuc.hata;
  const { ctx } = sonuc;

  // Ham satırlar İKİNCİ KEZ okunur. `exportBaglami` parçaları `TurevParca`ya,
  // dosyaları `KesimDosyasi`ya daraltıyor ve ikisi de bu ucun ihtiyacı olan
  // `sheet_file_id` / `storage_path` / `stored` alanlarını taşımıyor. `shared.ts`
  // bu fazın sahipliğinde olmadığı için genişletilmedi; iki ek sorgunun bedeli
  // (~700 satır) indirilecek onlarca MB'ın yanında ölçülemez.
  const supabase = await createClient();
  const [partRows, fileRows] = await Promise.all([loadParts(supabase, id), loadFiles(supabase, id)]);

  const dosyalar = new Map<string, FileRow>();
  for (const f of fileRows) dosyalar.set(f.id, f);

  // Parça kodu → resim dosyası kimliği. Aynı kod iki satırda geçebilir
  // (kodsuz satırlar ayrı anahtarlanır); resmi OLAN ilk satır kazanır.
  const resimKimligi = new Map<string, string>();
  for (const p of partRows) {
    if (!p.part_code || !p.sheet_file_id) continue;
    if (!resimKimligi.has(p.part_code)) resimKimligi.set(p.part_code, p.sheet_file_id);
  }

  const kokKod = (request.nextUrl.searchParams.get("kok") ?? "").trim();
  const imalat = imalatListesi(ctx.parts, kokKod);

  // ————————————————————————————————————————————————— adayları süz
  //
  // Sayaçlar AYRI TUTULUR çünkü üçü üç ayrı soruya cevap verir ve hiçbiri
  // öbürünün yerine geçemez (depo bütünlüğü fazının kuralı: "atlanan ≠ eksik").
  const gorulen = new Set<string>();
  const adaylar: ResimAdayi[] = [];
  let resimsizSatir = 0;
  /** Defterde resmi var ama CANLI değil: kopya · hariç · süperse · iptal. */
  let canliOlmayan = 0;
  /** Kayıt var, bayt depoya hiç ulaşmamış. İndirmeye çalışmak sahte hata üretirdi. */
  let depodaOlmayan = 0;

  for (const satir of imalat.satirlar) {
    const fileId = resimKimligi.get(satir.partCode);
    if (!fileId) {
      resimsizSatir += 1;
      continue;
    }
    // Aynı PDF iki parçaya bağlıysa desteye BİR KEZ girer.
    if (gorulen.has(fileId)) continue;
    gorulen.add(fileId);

    // Defter bir dosyayı işaret ediyor ama satırı yok. `on delete set null`
    // yüzünden pratikte olmaması gerekir; olduğunda da elde bir resim YOKTUR,
    // yani cevabı "resmi yok" kefesidir.
    const f = dosyalar.get(fileId);
    if (!f) {
      resimsizSatir += 1;
      continue;
    }

    // YALNIZ CANLI. Görevde açıkça dışarıda bırakılanlar kopya · hariç ·
    // süperse; `iptal` de aynı kefeye konur çünkü iptal edilmiş bir resmi
    // imalata indirmek yanlış parça üretmek demektir. Emsal `kesimListesi`:
    // kesimciye giden DXF süzgeci de `lifecycle !== "canli"` der.
    if (f.lifecycle !== "canli") {
      canliOlmayan += 1;
      continue;
    }

    // `stored=false` + `upload_skipped=false` = ULAŞMAMIŞ dosya. Atlanmış
    // satır (bayt bayt kopya) ise `storage_path`i ASLININKİNİ gösterir ve
    // pekâlâ inebilir — ikisini karıştırmak indirme raporunu sahte hatalarla
    // doldururdu (`import/route.ts`teki `DEPODA` süzgeciyle aynı kural).
    if (!f.stored && !f.upload_skipped) {
      depodaOlmayan += 1;
      continue;
    }
    if (!f.storage_path) {
      depodaOlmayan += 1;
      continue;
    }

    adaylar.push({
      ad: f.file_name || f.rel_path || satir.partCode,
      storagePath: f.storage_path,
      boyut: Number(f.size_bytes ?? 0),
    });
  }

  if (adaylar.length === 0) {
    // BOŞ PDF ÜRETİLMEZ. Sebep hangisiyse o yazılır: kök seçimi tutmamış
    // olabilir, satırların resmi olmayabilir, ya da baytlar depoya ulaşmamış
    // olabilir — üçü ayrı sorundur ve ayrı çözülür.
    const nedenler = [
      imalat.satirlar.length === 0 && kokKod
        ? `"${kokKod}" koduyla eşleşen bir alt ağaç bulunamadı.`
        : "",
      resimsizSatir > 0 ? `${resimsizSatir} satırın ölçülü resmi yok.` : "",
      canliOlmayan > 0 ? `${canliOlmayan} resim canlı değil (kopya/hariç/süperse/iptal).` : "",
      depodaOlmayan > 0 ? `${depodaOlmayan} resmin baytları depoya ulaşmamış.` : "",
    ].filter(Boolean);
    return metinYanit(
      `Bu seçimde birleştirilecek ölçülü resim bulunamadı.\n${nedenler.join("\n")}`.trim(),
      404
    );
  }

  // ————————————————————————————————————————————————— pencereyi seç
  const bas = Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get("bas") ?? 0) || 0));
  if (bas >= adaylar.length) {
    return metinYanit(
      `Bu seçimde ${adaylar.length} resim var; ${bas + 1}. resimden başlayan bir bölüm yok.`,
      400
    );
  }

  const secilen: ResimAdayi[] = [];
  let toplamBayt = 0;
  for (let i = bas; i < adaylar.length; i += 1) {
    const a = adaylar[i];
    if (secilen.length >= EN_COK_RESIM) break;
    // İLK resim koşulsuz girer: tek başına bayt sınırını aşan dev bir resim
    // yüzünden dosyanın boş dönmesi sınırın amacı değildir; o resim kendi
    // bölümünü alır ve deste yine ilerler.
    if (secilen.length > 0 && toplamBayt + a.boyut > EN_COK_TOPLAM_BAYT) break;
    secilen.push(a);
    toplamBayt += a.boyut;
  }
  const kalan = adaylar.length - bas - secilen.length;

  // ————————————————————————————————————————————————— depodan indir
  const govdeler: (Uint8Array | null)[] = new Array(secilen.length).fill(null);
  const inemeyen: { ad: string; sebep: string }[] = [];
  let sonraki = 0;

  async function isci(): Promise<void> {
    for (;;) {
      const i = sonraki;
      sonraki += 1;
      if (i >= secilen.length) return;
      const a = secilen[i];
      const { data, error } = await supabase.storage.from(BUCKET).download(a.storagePath);
      if (error || !data) {
        // Tek dosyanın inmemesi desteyi düşürmez (merge.ts ile aynı ilke).
        inemeyen.push({ ad: a.ad, sebep: error?.message ?? "indirilemedi" });
        continue;
      }
      govdeler[i] = new Uint8Array(await data.arrayBuffer());
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(ESZAMANLI_INDIRME, secilen.length) }, () => isci())
  );

  const girdiler: BirlesecekPdf[] = [];
  for (let i = 0; i < secilen.length; i += 1) {
    const bytes = govdeler[i];
    if (bytes) girdiler.push({ ad: secilen[i].ad, bytes });
  }

  // ————————————————————————————————————————————————— birleştir
  //
  // Künye BİRLEŞTİRME BİTİNCE bilinir (kaç sayfa oldu, hangi dosya açılamadı)
  // ama belgeye kaydetmeden önce yazılmalıdır; `pdfBirlestir` bu yüzden künyeyi
  // bir fonksiyondan da alır. Belgeyi ikinci kez ayrıştırıp yeniden kaydetmek
  // süre bütçesini ikiye katlardı.
  const aralikMetni =
    bas > 0 || kalan > 0 ? `${bas + 1}-${bas + secilen.length}. resim` : `${secilen.length} resim`;

  const birlestirme = await pdfBirlestir(girdiler, (ozet) => ({
    baslik: [ctx.isAdi, ctx.belgeKodu, "İmalat Resimleri"].join(" - "),
    uretici: `${COMPANY_NAME} — ${APP_NAME}`,
    olusturan: ctx.meta.preparedBy,
    konu: kunyeMetni({
      birlesen: ozet.birlesen,
      sayfaSayisi: ozet.sayfaSayisi,
      aralikMetni,
      adaySayisi: adaylar.length,
      kalan,
      resimsizSatir,
      canliOlmayan,
      depodaOlmayan,
      alinamayan: [...inemeyen, ...ozet.atlananlar],
      hazirlayan: ctx.meta.preparedBy,
      tarih: ctx.meta.generatedAt,
    }),
  }));

  const alinamayan = [...inemeyen, ...birlestirme.atlananlar];

  if (birlestirme.sayfaSayisi === 0) {
    const detay = alinamayan.slice(0, KUNYEDE_EN_COK_AD).map((a) => `· ${a.ad} — ${a.sebep}`);
    return metinYanit(
      [
        `Seçilen ${secilen.length} resmin hiçbiri açılamadı; birleşik dosya üretilmedi.`,
        ...detay,
      ].join("\n"),
      422
    );
  }

  // ————————————————————————————————————————————————— dosya adı
  //
  // KULLANICIYA SÖYLEMENİN YERİ DOSYA ADIDIR. Uyarıyı belgenin İÇİNE bir kapak
  // sayfası olarak basmak isterdik ama pdf-lib'in gömülü fontları WinAnsi'dir
  // ve "ş · ğ · ı · İ" harflerini kodlayamaz; TTF gömmek `@pdf-lib/fontkit`
  // ister ve yeni paket kurulmayacak. Dosya adı zaten indirir indirmez
  // görünen tek yüzeydir ve firma adlandırma kuralı da orada durur.
  //
  // ÜÇ SAYI ÜÇ AYRI SORUYA CEVAP VERİR ve tek bir "eksik" toplamında
  // birleştirilmez (depo bütünlüğü fazının kuralı): sınır yüzünden sonraya
  // kalan resim geri alınabilir, açılamayan resim ressamı ilgilendirir,
  // depoda olmayan resim ise yüklemeyi. Sağlıklı bir pakette üçü de sıfırdır
  // ve ada hiçbir not girmez.
  const notlar: string[] = [];
  if (kalan > 0) notlar.push(`${kalan} RESİM SONRAKİ BÖLÜMDE`);
  if (alinamayan.length > 0) notlar.push(`${alinamayan.length} RESİM AÇILAMADI`);
  if (depodaOlmayan > 0) notlar.push(`${depodaOlmayan} RESİM DEPODA YOK`);

  const dosyaAdi = downloadFileName(
    [
      ctx.isAdi,
      ctx.belgeKodu,
      "İmalat Resimleri",
      imalat.kokKod || null,
      bas > 0 || kalan > 0 ? `${bas + 1}-${bas + secilen.length}. RESİM` : null,
      notlar.length ? `(${notlar.join(" · ")})` : null,
    ],
    "pdf"
  );

  // Content-Disposition ÇİFT yazılır: Türkçe harf taşıyan ad `filename*` ile
  // gider, ASCII yedek eski istemciler içindir (`export/shared.ts` kalıbı).
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new Response(birlestirme.bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
      // Sayılar makine tarafında da okunabilsin (ileride ilerleme göstergesi
      // yazan bir istemci bunlara bakacaktır).
      "X-Orion-Aday": String(adaylar.length),
      "X-Orion-Birlesen": String(birlestirme.birlesen),
      "X-Orion-Sayfa": String(birlestirme.sayfaSayisi),
      "X-Orion-Acilamayan": String(alinamayan.length),
      "X-Orion-Depoda-Yok": String(depodaOlmayan),
      "X-Orion-Kalan": String(kalan),
      ...(kalan > 0 ? { "X-Orion-Sonraki-Bas": String(bas + secilen.length) } : {}),
    },
  });
}
