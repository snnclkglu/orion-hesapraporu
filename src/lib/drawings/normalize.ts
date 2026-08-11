// TANIM NORMALİZASYONU — ham depo tanımı → standart satın alma tanımı.
//
// ══════════════════════════════════════════════════════ NEDEN VAR
//
// Satınalmacının elindeki gerçek çalışma dosyası (İŞ HAZIRLAMA LİSTESİ) ile
// ressamın Inventor'dan çıkardığı DEPO Excel'i aynı parçayı iki ayrı dille
// yazıyor:
//
//     DEPO                                   İŞ HAZIRLAMA
//     CİVATA M16x120 DIN931 (GALVANİZLİ)  →  Cıvata M16x120 DIN 931 Galvanizli
//     RULMAN EKSENEL 51106                →  Rulman 51106
//     YAG KECESİ - 50x62x7  KK-T          →  Keçe Ø50xØ62x7
//     GİJON M10x105 DIN976                →  Saplama M10x105 DIN 976
//     AVARE TEKER MİLİ Ø60x173            →  Tahriksiz Tekerlek Mili
//
// Aradaki fark bir zevk meselesi değil: satınalmacı "RULMAN EKSENEL 51106"
// diye sipariş vermiyor, "RULMAN 51106" diyor (kullanıcı kararı, 11.08.2026 —
// "satın alma Eksel Ruman olarak görmek istemiyor"). Daha önemlisi, aynı
// rulmanın iki yazımı fiyat arşivinde İKİ AYRI KALEM olurdu ve "bunu geçen
// sene kaça almıştık" sorusunun cevabı ikiye bölünürdü.
//
// ═════════════════════════════════════════ ÜÇ KURAL, ÜÇÜ DE PAZARLIĞA KAPALI
//
// 1. UYDURMA YOK. Kullanıcının açık talimatı: "tabi uydurma bir veri
//    girmeyeceğiz sadece olan hataları düzeltecek ve standart bir formata
//    çevirmiş olacağız." Bu yüzden burada EKLEME YAPILMAZ:
//      · "GALVANİZLİ" yazmayan bir cıvataya galvaniz EKLENMEZ
//      · DIN numarası olmayan bir kamaya DIN 6885 EKLENMEZ
//      · Eksik ölçü tamamlanmaz
//    Yalnız YAZILANI düzeltir ve yeniden dizeriz. Eksik bilgi eksik kalır ve
//    ekranda öyle görünür — sessizce doldurulmuş bir alan, boş bir alandan çok
//    daha tehlikelidir.
//
// 2. HER KURALIN BİR KANITI VAR. Sözlükteki her satır iki gerçek teslim
//    klasörünün 317 ham tanımından ya da satın alma ekibinin 178 satırlık
//    çalışma dosyasından çıktı. Kanıtsız kural EKLENMEZ: yanlış normalleştirme
//    iki ayrı parçayı tek kaleme birleştirir ve bu, ayrı kalmasından çok daha
//    pahalıdır (`satinAlmaSinifi` sözlüğünün kuralının aynısı).
//
// 3. NE YAPTIĞINI SÖYLER. `normalizeTanim` yalnız sonucu değil HANGİ KURALIN
//    çalıştığını da döndürür; ekran ham tanımı ve düzeltmeyi yan yana gösterir.
//    Sessiz düzeltme, kullanıcının veriye olan güvenini bitirir — md. 18/4'ün
//    ("rapor dili suçlamaz, sistem ne anladığını söyler") satın almadaki
//    karşılığı budur.
//
// ═════════════════════════════════════════════════════ BÜYÜK HARF KURALI
//
// Kullanıcı kararı: "Depo excelinde nasıl yazılırsa yazılsın tüm parça
// tanımları kodları vs bilgileri büyük harfle yazılacak." Uygulamadaki ad
// alanları zaten böyle saklanıyor (`adBuyuk`, AGENTS.md md. 14) — satın alma
// kalemleri de aynı kurala girer. Büyütme tr-TR yerelindedir: `toUpperCase()`
// "i"yi "I" yapar ve "GALVANİZLİ" "GALVANIZLI" olurdu.
//
// ÇEKİRDEK SAFTIR: DB/HTTP importu yoktur (`src/lib/drawings/` kuralı). Kural
// sürümü değiştiğinde tanımlar yeniden üretilebilsin diye sürüm numarası taşır.

import { trBuyuk, trKatla } from "./tr-text";

/**
 * Kural sürümü. `RECONCILER_VERSION` ile aynı ruhta: sözlük değiştiğinde
 * saklanmış normalleştirilmiş tanımların yeniden üretilmesi gerektiği buradan
 * anlaşılır.
 */
export const NORMALIZE_VERSION = 1;

// ————————————————————————————————————————————————————————— kural defteri

/** Bir düzeltmenin kimliği — ekranda "ne değişti" diye gösterilir. */
export type NormKuralKodu =
  | "BOSLUK"
  | "CAP"
  | "BUYUK"
  | "TR_HARF"
  | "DIN"
  | "KAPLAMA"
  | "TERIM"
  | "AILE"
  | "OLCU";

export const NORM_KURAL_ADLARI: Record<NormKuralKodu, string> = {
  BOSLUK: "Boşluk düzeltildi",
  CAP: "Çap simgesi birleştirildi",
  BUYUK: "Büyük harfe çevrildi",
  TR_HARF: "Türkçe yazım düzeltildi",
  DIN: "DIN normu ayrıldı",
  KAPLAMA: "Kaplama bilgisi sona alındı",
  TERIM: "Terim standartlaştırıldı",
  AILE: "Ürün ailesi kalıbına getirildi",
  OLCU: "Ölçü yazımı düzeltildi",
};

export interface NormSonucu {
  /** Standart tanım — BÜYÜK HARF, tek boşluk, kalıba dizilmiş. */
  tanim: string;
  /** Ham tanım, olduğu gibi (kenar boşlukları atılmış). */
  ham: string;
  /** Çalışan kurallar; boşsa tanım zaten standarttı. */
  kurallar: NormKuralKodu[];
  /** Eşleştirme anahtarı — `trKatla(tanim)`. Fiyat arşivi bunu kullanır. */
  key: string;
}

// ————————————————————————————————————————————————— 1. TERİM SÖZLÜĞÜ
//
// SÖZCÜK BAZINDA çalışır, harf dizisi içinde DEĞİL: "TEKER" → "TEKERLEK"
// kuralı harf dizisi içinde arasaydı "TEKERLEK" kelimesi "TEKERLEKLEK"
// olurdu. Anahtarlar KATLANMIŞ hâlde tutulur (`trKatla`) — kaynak veride
// "A-TİP" ve "A-TIP", "KECESİ" ve "KEÇESİ" bir arada geçiyor ve ikisi de
// bulunmalı.
//
// Her satırın yanında kanıtı var: ham tanımın gerçekten görüldüğü dosya.

interface TerimKurali {
  /** Katlanmış aranan sözcük dizisi (bir ya da iki sözcük). */
  ara: string;
  /** Yerine yazılacak standart metin (BÜYÜK HARF, tr-TR). */
  yaz: string;
  /** Nereden geldiği — sözlüğü savunmak için. */
  kanit: string;
}

const TERIMLER: TerimKurali[] = [
  // ---- yazım hataları (aynı sözcüğün bozuk yazımı) ----
  { ara: "CIVATA", yaz: "CIVATA", kanit: "İŞ HAZ. 'Civata' (10 satır, 0057-06) ↔ 'Cıvata' (22 satır)" },
  { ara: "GALVANIZLI", yaz: "GALVANİZLİ", kanit: "DEPO '(GALVANİZLİ)' ↔ bazı satırlarda noktasız" },
  { ara: "KECESI", yaz: "KEÇESİ", kanit: "DEPO 'YAG KECESİ' — Ç ve İ düşmüş" },
  { ara: "YAG", yaz: "YAĞ", kanit: "DEPO 'YAG KECESİ' — Ğ düşmüş" },
  { ara: "KLAVUZ", yaz: "KILAVUZ", kanit: "DEPO 'HALAT KLAVUZU', 'KLAVUZ TUTMA APARATI'" },
  { ara: "SASE", yaz: "ŞASİ", kanit: "DEPO Title 'SASE' (0057-00-0510) ↔ İŞ HAZ. 'Araba Şasi'" },
  // Bitişik yazılmış grup adları ayrılır: İŞ HAZ. 'Kullanıldığı Yer' sözlüğü
  // ikisini de ayrı yazar ("Ana Kiriş", "Baş Kiriş").
  { ara: "ANAKIRIS", yaz: "ANA KİRİŞ", kanit: "ÜRÜN AĞACI 'ANAKİRİŞ' ↔ İŞ HAZ. 'Ana Kiriş'" },
  { ara: "BASKIRIS", yaz: "BAŞ KİRİŞ", kanit: "ÜRÜN AĞACI 'BAŞKİRİŞ' ↔ İŞ HAZ. 'Baş Kiriş'" },
  { ara: "YURUME", yaz: "YÜRÜME", kanit: "ÜRÜN AĞACI 'RAY YURUME YOLU'" },
  { ara: "ELEKTRIK", yaz: "ELEKTRİK", kanit: "ÜRÜN AĞACI 'ELEKTRIK PANOSU'" },
  { ara: "TAHRIKLI", yaz: "TAHRİKLİ", kanit: "DEPO 'TAHRIKLI MİL' ↔ 'TAHRİKLİ TEKER MİLİ'" },
  { ara: "SEHBASI", yaz: "SEHPASI", kanit: "ÜRÜN AĞACI 'TAMBUR SEHBASI'" },
  { ara: "REDUKTOR", yaz: "REDÜKTÖR", kanit: "DEPO 'YILMAZ REDUKTOR DR173-…'" },
  { ara: "PROFIL", yaz: "PROFİL", kanit: "DEPO 'VS1028R2 - C PROFIL'" },

  // ---- terim birleştirme (aynı ürün iki adla) ----
  { ara: "GIJON", yaz: "SAPLAMA", kanit: "DEPO 'GİJON M10x105 DIN976' → İŞ HAZ. 'Saplama M6x95 DIN 976'" },
  { ara: "DUZ GRESORLUK", yaz: "GRES NİPELİ", kanit: "DEPO 'DÜZ GRESÖRLÜK M8x1 DIN71412 H1'" },
  { ara: "GRESORLUK", yaz: "GRES NİPELİ", kanit: "İŞ HAZ. 'Gresörlük M10x1' ↔ 'Gres Nipeli M8x1'" },
  { ara: "AVARE", yaz: "TAHRİKSİZ", kanit: "DEPO 'AVARE TEKER MİLİ' → İŞ HAZ. 'Tahriksiz Tekerlek Mili'" },
  // "TEKER" → "TEKERLEK" SÖZCÜK BAZINDA güvenlidir: "TEKERLEK" ayrı bir
  // sözcüktür ve kural ona dokunmaz (harf dizisi içinde arasaydı
  // "TEKERLEKLEK" olurdu — önek kuralının düştüğü tuzağın aynısı).
  { ara: "TEKER", yaz: "TEKERLEK", kanit: "DEPO 'TEKER Ø315x105' → İŞ HAZ. 'Tekerlek'" },
  { ara: "MIL SEGMANI", yaz: "SEGMAN", kanit: "DEPO 'MİL SEGMANI Ø30 DIN471' → İŞ HAZ. 'Segman Ø30 DIN 471'" },
  { ara: "DELIK SEGMANI", yaz: "SEGMAN", kanit: "DEPO 'DELİK SEGMANI Ø68 DIN472'" },
  { ara: "PUL RONDELA", yaz: "RONDELA", kanit: "DEPO 'PUL RONDELA M8 DIN125' → İŞ HAZ. 'Rondela M12 DIN 125'" },
  { ara: "KABLO ARABACIGI", yaz: "ARABACIK", kanit: "İŞ HAZ. 'Kablo Arabacığı VS 1028T5' ↔ 'Arabacık VS1028T3'" },
  { ara: "IMBUS CIVATA", yaz: "İMBUS CIVATA", kanit: "DEPO 'İMBUS CİVATA M6x10 DIN7984'" },
];

/** Katlanmış anahtar → kural. Çok sözcüklüler önce denenir (uzun eşleşme yener). */
const TERIM_HARITASI = new Map(TERIMLER.map((t) => [trKatla(t.ara), t]));
const TERIM_EN_UZUN = Math.max(...TERIMLER.map((t) => trKatla(t.ara).split(" ").length));

/**
 * ÖNEK TAMAMLAMA — profil kesit kodları.
 *
 * DEPO profili yalnız kesit koduyla yazar ("NPU 80 L=225"); İŞ HAZIRLAMA ürün
 * adını da yazar ("Profil NPU 80"). Bu bir terim DEĞİŞTİRME değil bir önek
 * EKLEMEsidir ve terim sözlüğüne konamaz: sözlük sözcüğü kayıtsız şartsız
 * değiştirdiği için "KÖŞEBENT NPL" bir kez daha genişler ve `KÖŞEBENT KÖŞEBENT
 * NPL` çıkar — fonksiyon değişmez olmaktan çıkardı (testin yakaladığı hata).
 *
 * Kural bu yüzden yalnız kesit kodu CÜMLENİN BAŞINDAYKEN çalışır. Kanıt bunu
 * destekliyor: öneksiz yazımların hepsi ("NPL 50x50x5 L=23500", "NPU 80 L=225",
 * "NPI 300") kodla başlıyor.
 */
const ONEKLER: { kesit: string; onek: string; kanit: string }[] = [
  { kesit: "NPL", onek: "KÖŞEBENT", kanit: "DEPO 'NPL 50x50x5 L=23500' → İŞ HAZ. 'Köşebent NPL 50x50x5'" },
  { kesit: "NPU", onek: "PROFİL", kanit: "DEPO 'NPU 80 L=225' → İŞ HAZ. 'Profil NPU 80'" },
  { kesit: "NPI", onek: "PROFİL", kanit: "İŞ HAZ. R15 'NPI 300' (öneksiz, kural dışı) ↔ 'Profil NPI 300'" },
];

function onekTamamla(s: string): { metin: string; degisti: boolean } {
  for (const o of ONEKLER) {
    if (s === o.kesit || s.startsWith(`${o.kesit} `)) {
      return { metin: `${o.onek} ${s}`, degisti: true };
    }
  }
  return { metin: s, degisti: false };
}

// ————————————————————————————————————————— 2. ÜRÜN AİLESİ KALIPLARI
//
// Terim sözlüğü sözcük sözcük çalışır; AİLE kuralları CÜMLEYİ yeniden dizer.
// Yalnız kalıbı GERÇEK veriyle doğrulanmış aileler burada: kalıbı bilinmeyen
// bir tanıma dokunulmaz ve olduğu gibi (yalnız biçimsel düzeltmelerle) kalır.

interface AileKurali {
  kod: string;
  /** Kalıp ham (biçimsel düzeltmelerden GEÇMİŞ, büyük harfli) tanıma uygulanır. */
  desen: RegExp;
  /** Eşleşme gruplarından standart tanımı kurar; `null` dönerse kural geçilir. */
  kur: (m: RegExpMatchArray) => string | null;
  kanit: string;
}

const AILELER: AileKurali[] = [
  // RULMAN — kullanıcının açıkça istediği kural (md. 9):
  // "RULMAN EKSENEL 51106 değil RULMAN 51106".
  //
  // Rulman kimliği KODUDUR; tür sıfatı (EKSENEL) ve ölçü (Ø90xØ50x23) o kodun
  // zaten söylediği şeyi tekrar eder ve iki yazımı iki ayrı kalem yapardı.
  // Sonek (-Z / -ZZ / -2RS) kimliğin PARÇASIDIR ve DÜŞÜRÜLMEZ: 6205 ile
  // 6205-Z farklı ürünlerdir ve farklı fiyattadır.
  {
    kod: "RULMAN",
    // "RULMAN [EKSENEL] [Ø..xØ..x..] 51106" / "RULMAN 6005 - Z" / "RULMAN 6213-Z"
    //
    // ADLANDIRILMIŞ GRUP KULLANILMAZ: tsconfig hedefi ES2017 ve `(?<ad>…)`
    // orada derlenmiyor. Konum numarası daha az okunur ama tek grup var.
    desen: /^RULMAN\b(?!\s+YATA)(.*)$/,
    kur: (m) => {
      const govde = m[1] ?? "";
      // Kod: 4–5 haneli sayı + isteğe bağlı sonek. Ölçü öbekleri (Ø ile
      // başlayan) elenir; kalan tek sayı koddur.
      const kodlar = [...govde.matchAll(/(?<![ØO\d,.])\b(\d{4,5})\s*-?\s*(2RS|ZZ|Z|N|C3)?\b/g)]
        .filter((k) => !/[Ø]/.test(govde.slice(Math.max(0, (k.index ?? 0) - 2), k.index ?? 0)));
      if (kodlar.length === 0) return null;
      // SON kod alınır: "RULMAN Ø125xØ70x31 22214" satırında ölçüler önce gelir.
      const son = kodlar[kodlar.length - 1];
      return `RULMAN ${son[1]}${son[2] ? `-${son[2]}` : ""}`;
    },
    kanit: "DEPO 'RULMAN EKSENEL 51106', 'RULMAN ∅90x∅50x23 22210', 'Rulman 6005 - Z'",
  },

  // RULMAN YATAĞI — kod SKF gösterimidir ve tireler boşluğa çevrilir.
  // "RULMAN SY-60-TF" → İŞ HAZ. 'Rulman Yatağı SY 60 TF'.
  {
    kod: "RULMAN_YATAGI",
    desen: /^RULMAN\s+(?:YATAĞI\s+)?(SY)\s*-?\s*(\d{2,3})\s*-?\s*([A-Z]{1,3})$/,
    kur: (m) => `RULMAN YATAĞI ${m[1]} ${m[2]} ${m[3]}`,
    kanit: "DEPO 'RULMAN SY-60-TF' → İŞ HAZ. 'Rulman Yatağı SY 60 TF'",
  },

  // KEÇE — ölçü üçlüsü iç×dış×kalınlık; İŞ HAZ. iki Ø işareti kullanır.
  // Üretici sonekleri (KK-T) düşer: keçe tipi bir marka gösterimidir ve aynı
  // ölçüdeki keçeyi iki kalem yapardı.
  // Ç/C ve Ğ/G İKİSİ DE kabul edilir çünkü terim sözlüğü buraya yetişemez:
  // "KECESİ_40X52X8" alt çizgi yüzünden TEK sözcüktür ve sözlük onu görmez
  // (testin yakaladığı ikinci hata). Aile kalıbı kendi toleransını taşımalıdır.
  {
    kod: "KECE",
    desen:
      /^(?:YA[ĞG]\s+)?KE[ÇC]ES[İI]\s*[-_]?\s*Ø?(\d+(?:,\d+)?)\s*[xX]\s*Ø?(\d+(?:,\d+)?)\s*[xX]\s*(\d+(?:,\d+)?)\b/,
    kur: (m) => `KEÇE Ø${m[1]}XØ${m[2]}X${m[3]}`,
    kanit: "DEPO 'YAG KECESİ - 50x62x7  KK-T' ve 'YAG KECESİ_40X52X8 KK-T'",
  },
  {
    kod: "KECE_DUZ",
    desen: /^KEÇE\s+Ø?(\d+(?:,\d+)?)\s*[xX]\s*Ø?(\d+(?:,\d+)?)\s*[xX]\s*(\d+(?:,\d+)?)\b/,
    kur: (m) => `KEÇE Ø${m[1]}XØ${m[2]}X${m[3]}`,
    kanit: "İŞ HAZ. 'Keçe Ø63xØ80x7' — iki Ø işaretli kalıp",
  },

  // KAMA — "KAMA 6x6x70 (A-TİP) DIN 6885" ve "A-TİP KAMA 8x7x90 DIN 6885"
  // aynı üründür. DIN numarası VARSA korunur, YOKSA EKLENMEZ (uydurma yasağı).
  //
  // DIN NUMARASI PARANTEZİN İÇİNDE DE OLABİLİR: gerçek veride üç yazım birden
  // geçiyor ve üçü de aynı kamadır —
  //   "A-TİP KAMA 14x9x160 DIN 6885"        (önek + dışarıda DIN)
  //   "KAMA 8x7x22 (A-TIP) DIN 6885"        (parantez + dışarıda DIN)
  //   "KAMA 25x14x110 (A-TİPİ DIN 6885)"    (parantezin İÇİNDE DIN)
  // Üçüncüsü ilk sürümde kaçmıştı ve gerçek havuzda ham hâliyle görünüyordu.
  {
    kod: "KAMA",
    desen:
      /^(?:A[\s-]*T[İI]P[İI]?\s+)?KAMA\s+(\d{1,2})\s*[xX]\s*(\d{1,2})\s*[xX]\s*(\d{1,4})\s*(?:\(\s*A[\s-]*T[İI]P[İI]?\s*(DIN\s*\d+)?\s*\))?\s*(DIN\s*\d+)?$/,
    kur: (m) => {
      const din = (m[4] || m[5] || "").replace(/DIN\s*/, "DIN ");
      return `A TİPİ KAMA ${m[1]}X${m[2]}X${m[3]}${din ? ` ${din}` : ""}`;
    },
    kanit: "DEPO 'KAMA 8x7x22 (A-TIP) DIN 6885' · 'KAMA 25x14x110 (A-TİPİ DIN 6885)'",
  },

  // KAUÇUK TAMPON — çap × boy, isteğe bağlı bağlantı metriği.
  {
    kod: "TAMPON",
    desen: /^KAUÇUK\s+TAMPON\s+Ø?(\d+(?:,\d+)?)\s*[xX]\s*(\d+(?:,\d+)?)\s*(M\d+)?$/,
    kur: (m) => `KAUÇUK TAMPON Ø${m[1]}X${m[2]}${m[3] ? ` ${m[3]}` : ""}`,
    kanit: "DEPO 'KAUÇUK TAMPON ∅30x20' → İŞ HAZ. 'Kauçuk Tampon Ø30x20'",
  },

  // KANCA — DIN 15401 numarası ve malzeme sınıfı harfi.
  // "KANCA DIN 15401-Nr 08 S" ve "KANCA DIN 15401-NR 8S" aynı kancadır;
  // baştaki sıfır düşer (İŞ HAZ. 'Kanca NR 2,5-S DIN 15401' kalıbı).
  {
    kod: "KANCA",
    desen: /^KANCA\s+DIN\s*15401\s*[-,]?\s*N[RO]\.?\s*0*(\d+(?:,\d+)?)\s*[-\s]?\s*([SMLTV])?$/,
    kur: (m) => `KANCA NR ${m[1]}${m[2] ? `-${m[2]}` : ""} DIN 15401`,
    kanit: "DEPO 'KANCA DIN 15401-Nr 08 S' → İŞ HAZ. 'Kanca NR 2,5-S DIN 15401'",
  },

  // LOADCELL — kapasite "T" ile yazılır; parantezli aralık ("1- 5 TON") üst
  // değere indirgenir çünkü sipariş edilen ürün odur.
  {
    kod: "LOADCELL",
    desen: /^LOADCELL\s+([A-Z0-9-]+)\s*(?:\(\s*[\d,]+\s*-\s*)?(\d+(?:,\d+)?)\s*(?:TON|T)\s*\)?$/,
    kur: (m) => `LOADCELL ${m[1]} ${m[2]}T`,
    kanit: "DEPO 'LOADCELL LPW-1 (1- 5 TON)' → İŞ HAZ. 'Loadcell LPW-1 5T'",
  },

  // LİMİT SİVİCİ — üretici kodu alt çizgilidir ve OLDUĞU GİBİ kalır; yalnız
  // ürün adı önüne yazılır.
  {
    kod: "LIMIT",
    desen: /^L[İI]M[İI]T[_\s]+(\d.*)$/,
    kur: (m) => `TAMBUR LİMİT SİVİÇ ${m[1].trim()}`,
    kanit: "DEPO 'LİMİT_51_67_DZC0Z_499P' → İŞ HAZ. 'Tambur Limit Siviç 51_67_DZC0Z_499P'",
  },

  // ARABACIK — feston kablo arabası. VS koduyla arasındaki boşluk kapanır,
  // konum bilgisi parantezde kalır (üç ayrı üründür: hareketli/öncü/sabit).
  {
    kod: "ARABACIK",
    desen: /^ARABACIK\s+VS\s*([A-Z0-9]+(?:[-/][A-Z0-9]+)*)\s*(?:\(\s*([A-ZÇĞİÖŞÜ]+)\s*\))?$/,
    kur: (m) => `ARABACIK VS${m[1].replace(/\//g, "-")}${m[2] ? ` (${m[2]})` : ""}`,
    kanit: "DEPO 'ARABACIK VS1028T3-86-4 (HAREKETLİ)' + İŞ HAZ. 'VS 1028T5-86/4'",
  },
];

// ——————————————————————————————————————————————————— biçimsel düzeltmeler

/** Çap simgesinin iki Unicode yazımı — kaynak veride ikisi de geçiyor. */
const CAP_YANLIS = /[∅⌀]/g;

/**
 * BOŞLUK: NBSP, sekme, çoklu boşluk ve kenar boşlukları.
 *
 * Kaynak veride 18 hücrede sondaki boşluk, 8 satırda gömülü çift boşluk var
 * ("BORU    Ø180 ( Ø195)/ Ø150x550"). Bunlar görünmez ve iki kez saklanan bir
 * kalem üretir; anahtar katlanmış olsa bile boşluk katlanmaz.
 */
function bosluk(s: string): string {
  return s.replace(/[   \t]/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** DIN normu ile numarası arasına TEK boşluk. "DIN933" → "DIN 933". */
function dinAyir(s: string): string {
  return s.replace(/\bDIN\s*(\d+)/g, "DIN $1");
}

/**
 * KAPLAMA: parantez kalkar ve bilgi SONA taşınır.
 *
 * İŞ HAZIRLAMA kalıbında kaplama her zaman son sözcüktür
 * (`<ürün> <ölçü> <DIN> <kaplama>`). Kaynakta parantez içindedir ve bazen
 * ortada durur. YENİ BİR KAPLAMA EKLENMEZ — yalnız yazılmış olan taşınır.
 */
function kaplama(s: string): { metin: string; degisti: boolean } {
  const m = s.match(/\(\s*(GALVAN[İI]ZL[İI])\s*\)/);
  if (!m) return { metin: s, degisti: false };
  const kalan = bosluk(s.replace(m[0], " "));
  return { metin: `${kalan} GALVANİZLİ`, degisti: true };
}

/**
 * ÖLÇÜ yazımı: çarpım işareti tek biçim, çevresinde boşluk yok, ondalık VİRGÜL.
 *
 * `L=` öneki DÜŞMEZ: "MİL Ø75x235" ile "BURÇ Ø80xØ50,4 L=66" farklı şeyler
 * söylüyor ve L uzunluğun adıdır. Yalnız çarpım işaretinin çevresi temizlenir.
 */
function olcu(s: string): string {
  return s
    // "Ø80 x Ø50,4" → "Ø80XØ50,4"; büyük X standart (tanımın tamamı büyük harf)
    .replace(/(\d)\s*[xX×*]\s*(?=[ØO\d])/g, "$1X")
    // "Ø 80" → "Ø80"
    .replace(/Ø\s+(?=\d)/g, "Ø")
    // "( Ø195)" → "(Ø195)"
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    // Ondalık NOKTA → VİRGÜL, yalnız sayı-sayı arasında: "0.18KW" → "0,18KW".
    // Model kodlarındaki noktaya (i44.66 çevrim oranı) DOKUNULUR mu? Evet —
    // İŞ HAZ. dosyası da oranı virgülle yazıyor ("NR 2,5-S") ve tek bir
    // ondalık yazımı olmadan aynı ürün iki kalem olurdu.
    .replace(/(\d)\.(\d)/g, "$1,$2");
}

/** Sözcük sözcük terim sözlüğü; en uzun eşleşme kazanır. */
function terimler(s: string): { metin: string; degisti: boolean } {
  const parcalar = s.split(" ");
  const cikti: string[] = [];
  let degisti = false;

  for (let i = 0; i < parcalar.length; ) {
    let eslesti = false;
    for (let n = Math.min(TERIM_EN_UZUN, parcalar.length - i); n >= 1; n--) {
      const oebek = parcalar.slice(i, i + n).join(" ");
      const kural = TERIM_HARITASI.get(trKatla(oebek));
      if (!kural) continue;
      if (oebek !== kural.yaz) degisti = true;
      cikti.push(kural.yaz);
      i += n;
      eslesti = true;
      break;
    }
    if (!eslesti) {
      cikti.push(parcalar[i]);
      i += 1;
    }
  }
  return { metin: cikti.join(" "), degisti };
}

// ————————————————————————————————————————————————————————— ana fonksiyon

/**
 * Ham tanımı standart satın alma tanımına çevirir.
 *
 * SIRA ÖNEMLİDİR ve şudur:
 *   1. biçim (boşluk · çap simgesi · ölçü)   — kalıp eşleşmesi için ön koşul
 *   2. BÜYÜK HARF                            — sözlük anahtarları büyük
 *   3. DIN ayırma + kaplama sona alma        — cümlenin iskeleti
 *   4. terim sözlüğü                         — sözcük düzeyi
 *   5. ürün ailesi kalıbı                    — cümle düzeyi, EN SON
 *
 * Aile kuralı en sonda çünkü girdisi TEMİZLENMİŞ metindir: "RULMAN EKSENEL
 * 51106" kalıbı, ham metindeki çift boşluk ya da ∅ işareti yüzünden
 * tutmayabilirdi.
 *
 * FONKSİYON DEĞİŞMEZDİR (idempotent): `f(f(x)) === f(x)`. Koruma testtedir —
 * değilse, kaydedilmiş bir tanım her okumada bir kez daha değişir ve fiyat
 * arşivi kendi kendine bölünürdü.
 */
export function normalizeTanim(raw: string | null | undefined): NormSonucu {
  const ham = bosluk(String(raw ?? ""));
  if (!ham) return { tanim: "", ham: "", kurallar: [], key: "" };

  const kurallar = new Set<NormKuralKodu>();
  let s = ham;

  // 1 — biçim
  const capsiz = s.replace(CAP_YANLIS, "Ø");
  if (capsiz !== s) kurallar.add("CAP");
  s = capsiz;

  const olculu = olcu(s);
  if (olculu !== s) kurallar.add("OLCU");
  s = bosluk(olculu);

  // 2 — büyük harf (tr-TR)
  const buyuk = trBuyuk(s);
  if (buyuk !== s) kurallar.add("BUYUK");
  s = buyuk;

  // 3 — DIN + kaplama
  const dinli = dinAyir(s);
  if (dinli !== s) kurallar.add("DIN");
  s = dinli;

  const kap = kaplama(s);
  if (kap.degisti) kurallar.add("KAPLAMA");
  s = kap.metin;

  // 4 — terim sözlüğü
  const ter = terimler(s);
  if (ter.degisti) {
    // Yazım düzeltmesi mi terim birleştirmesi mi? Kullanıcıya ikisini ayrı
    // söylemek daha dürüst; ayrım katlanmış hâlin aynı kalıp kalmadığıdır.
    kurallar.add(trKatla(ter.metin) === trKatla(s) ? "TR_HARF" : "TERIM");
  }
  s = ter.metin;

  const onek = onekTamamla(s);
  if (onek.degisti) kurallar.add("TERIM");
  s = onek.metin;

  // 5 — ürün ailesi
  for (const aile of AILELER) {
    const m = s.match(aile.desen);
    if (!m) continue;
    const yeni = aile.kur(m);
    if (!yeni) continue;
    const temiz = bosluk(yeni);
    if (temiz !== s) kurallar.add("AILE");
    s = temiz;
    break;
  }

  s = bosluk(s);
  if (s !== ham && !kurallar.size) kurallar.add("BOSLUK");
  if (bosluk(ham) !== ham) kurallar.add("BOSLUK");

  return { tanim: s, ham, kurallar: [...kurallar], key: trKatla(s) };
}

/** Yalnız anahtar isteyen çağrı yerleri için kısayol (fiyat arşivi, teklifler). */
export function normAnahtar(raw: string | null | undefined): string {
  return normalizeTanim(raw).key;
}

// ═══════════════════════════════════════════════════════ ANA GRUP DEFTERİ
//
// Kullanıcı kararı (md. 9): "0057-00-0700'ün 1 TON KANCA BLOĞU olduğunu
// anlamalıyız ve bunu … anlaşılabilirliği artırmak için kullanmalıyız."

/**
 * Parça kodundan ana grup ADAYLARI — en özelden en genele.
 *
 * "SON İKİ HANE 00" KURALI YANLIŞTIR ve bu ölçüldü: MTC'de 17 grubun 7'si
 * 00 ile bitmiyor (`0043-00-0801` ARABA ŞASİ, `0043-00-0850` HALAT KILAVUZU,
 * `0057-00-0510` ŞASİ). Doğru kural SON BLOĞU KIRPMAKTIR ve gerekirse birden
 * çok kez: `0043-00-0802-00-01-04` → `…-00-01` (TAMBUR FLANŞI) → `…-00`
 * (ara seviye, defterde YOK) → `0043-00-0802` (TAMBUR).
 *
 * İlk iki blok İŞ NUMARASIDIR ve grup adayı değildir; orada durulur.
 */
export function anaGrupAdaylari(partCode: string): string[] {
  const kod = (partCode ?? "").trim();
  if (!kod) return [];
  const bloklar = kod.split("-");
  const adaylar: string[] = [];
  for (let n = bloklar.length - 1; n >= 3; n--) {
    adaylar.push(bloklar.slice(0, n).join("-"));
  }
  return adaylar;
}

/**
 * Bilinen grup kodları arasından bu parçanın ana grubunu seçer.
 *
 * `bilinen` boşsa ÜÇ BLOKLU forma düşülür: `0043-00-0100-01` → `0043-00-0100`.
 * Bu bir tahmindir ve yalnız defter hiç kurulmamışken kullanılır; adı olmayan
 * bir kod, yanlış bir addan iyidir.
 */
export function anaGrupKodu(partCode: string, bilinen?: ReadonlySet<string>): string {
  const adaylar = anaGrupAdaylari(partCode);
  if (adaylar.length === 0) return "";
  if (bilinen && bilinen.size > 0) {
    for (const a of adaylar) if (bilinen.has(a)) return a;
    return "";
  }
  return adaylar[adaylar.length - 1];
}

/** Grup adı çıkarımının bir satırı — kaynağıyla birlikte. */
export interface GrupAdi {
  groupCode: string;
  name: string;
  /**
   * Adın nereden geldiği:
   *   `satir`   — grubun KENDİ defter satırı var, tanımı orada (ÜRÜN AĞACI)
   *   `baslik`  — alt parçaların montaj başlığı OYBİRLİĞİYLE aynı (DEPO)
   * Üçüncü bir kaynak YOKTUR: çelişen başlıklardan ad üretilmez.
   */
  kaynak: "satir" | "baslik";
}

interface GrupKaynagi {
  partCode: string;
  description: string;
  assemblyTitle: string;
  name: string;
}

/**
 * Defterden kod → ana grup adı çıkarır.
 *
 * İKİ KAYNAK, İKİSİ DE ÖLÇÜLDÜ:
 *
 * 1. GRUBUN KENDİ SATIRI (ÜRÜN AĞACI). Ürün ağacında `Part Number` grup
 *    kodunun kendisine eşit olan bir satır vardır ve `Description`ı grup
 *    adıdır: `0043-00-0600` → "15 TON KANCA BLOĞU". Bu OTORİTER kaynaktır.
 *
 * 2. ALT PARÇALARIN MONTAJ BAŞLIĞI (DEPO). Ürün ağacı yoksa (MONORAY'da yok)
 *    tek ipucu alt satırların `Title` sütunudur — `0057-00-0700`in altındaki
 *    17 satırın hepsi "1 TON KANCA BLOĞU" yazar.
 *
 *    AMA BU SÜTUN GÜVENİLMEZDİR: MTC'de 17 grubun 9'unda ürün ağacıyla
 *    ÇELİŞİYOR (`0043-00-0300`ün başlığı "ARABA YÜRÜTME GRUBU" yazıyor, gerçek
 *    adı "KÖPRÜ YÜRÜTME GRUBU"). Bu yüzden kural OYBİRLİĞİDİR: grubun bütün
 *    parçaları aynı başlığı söylüyorsa ad kabul edilir, tek bir satır bile
 *    ayrılıyorsa AD ÜRETİLMEZ. Yanlış bir grup adı, adsız bir gruptan çok daha
 *    pahalıdır — satınalmacı ona bakarak yanlış kaleme sipariş verir.
 */
export function grupAdlariCikar(
  parts: readonly {
    partCode: string;
    description: string;
    assemblyTitle: string;
    name: string;
  }[]
): GrupAdi[] {
  const kodlar = new Set(parts.map((p) => p.partCode).filter(Boolean));
  const satirlar = new Map<string, GrupKaynagi>();
  for (const p of parts) if (p.partCode) satirlar.set(p.partCode, p);

  // Bir kod ANA GRUPtur eğer başka bir parça onun altındaysa.
  const gruplar = new Set<string>();
  for (const p of parts) {
    for (const a of anaGrupAdaylari(p.partCode)) {
      if (kodlar.has(a) || a.split("-").length === 3) gruplar.add(a);
    }
  }

  const sonuc: GrupAdi[] = [];
  for (const grup of [...gruplar].sort()) {
    // 1 — grubun kendi satırı
    const kendi = satirlar.get(grup);
    const kendiAdi = kendi ? bosluk(kendi.description || kendi.name) : "";
    if (kendiAdi) {
      // GRUP ADI DA NORMALLEŞTİRİLİR. Ham hâlleri parça tanımları kadar
      // kirli: "RAY YURUME YOLU", "ELEKTRIK PANOSU", "TAMBUR SEHBASI",
      // "HALAT KLAVUZU (Ø325)". Bu adlar ekranda satın alma satırının yanında
      // görünecek (kullanıcı kararı, md. 9) — iki farklı yazımla görünmeleri
      // parça tanımlarındakiyle aynı sorunu üretirdi.
      sonuc.push({ groupCode: grup, name: normalizeTanim(kendiAdi).tanim, kaynak: "satir" });
      continue;
    }

    // 2 — alt parçaların montaj başlığı, OYBİRLİĞİ şartıyla
    const basliklar = new Set<string>();
    for (const p of parts) {
      if (p.partCode === grup || !p.partCode.startsWith(`${grup}-`)) continue;
      const b = bosluk(p.assemblyTitle);
      if (b) basliklar.add(trKatla(b));
    }
    if (basliklar.size !== 1) continue;

    const ornek = parts.find(
      (p) => p.partCode.startsWith(`${grup}-`) && bosluk(p.assemblyTitle)
    );
    if (ornek) {
      sonuc.push({
        groupCode: grup,
        name: normalizeTanim(ornek.assemblyTitle).tanim,
        kaynak: "baslik",
      });
    }
  }
  return sonuc;
}
