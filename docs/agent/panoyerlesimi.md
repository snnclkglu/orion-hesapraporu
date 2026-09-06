# Pano Yerleşimi

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir.
>
> **`scripts/agent-docs/split.ts --uygula` ÇALIŞTIRILMAZ.** O betik alan
> dosyalarını `AGENTS.md`i ayrıştırarak ÜRETİR; kök dosya bugün yalnız
> değişmezleri ve haritayı taşıyor, gövdeler oradan çıkmış durumda. Bugün
> `--uygula` demek on yedi alan dosyasını altı satırlık kütüğe indirmektir.
> Denetim salt okunur `npx tsx scripts/agent-docs/doctor.ts` iledir.

**Kapsam:** `src/lib/switchboard/**` · `src/lib/switchboard-data.ts` ·
`src/lib/diagrams/panoLayout.ts` · `src/lib/diagrams/svg.ts` ·
`src/lib/pdf/pano-layout.tsx` · `src/app/(app)/projects/[id]/pano/**` ·
`scripts/test-switchboard-layout.ts`

**Ne yapar:** Elektrik projesinin okunmuş malzeme listesinden (`ELEKTRIK-5`,
aygıt etiketinin `+` parçası) panoları çıkarır, cihazları montaj plakasına
yerleştirir, sipariş edilebilir gövde ölçüsünü bulur, şemayı çizer ve
imalatçıya giden belgeyi üretir.

---

## PANO-1 — Gövde ölçüsü sipariş edilebilir bir IZGARADAN seçilir.

```
En        400 · 500 · 600 · 700 · 800 · 900 · 1000 · 1200
Yükseklik 1400 · 1600 · 1800 · 2000
Derinlik  200 · 250 · 300 · 400 · 500 · 600 · 700
Baza      200 · 250 · 300                      (öntanım 200)
Kapak     en < 600 → tek;  en ≥ 600 → seçilebilir, 600 üstünde öntanım çift
```

Bu bir tercih değil bir SINIRDIR: pano imalatçısı ara ölçü kesmez, ızgaradan
üretir. Ara bir en seçmek panoyu özel imalata çevirir ve hem fiyatı hem termini
değiştirir.

**1800 ÖNCELİKLİDİR AMA ZORUNLU DEĞİLDİR** (kullanıcı kararı, 06.09.2026):
*"1800 öncelikli seçsin ama hep 1800 seçmesin, bazen küçük bir işte 1400 de
yeterli olur; gereksiz büyük seçmeye gerek yok."* Otomatik arama küçükten
büyüğe gider (1400 → 1600 → 1800 → 2000) ama 1800'ün ALTI bir EŞİĞE bağlıdır;
ayrıntısı PANO-9'dadır. Ölçüldü (0019-00): oda dizisi 1800 çıkar, beş küçük
saha panosu 1400'de kalır — ilk sürüm ikisine de 1800 veriyordu.

**IZGARA İKİ YERDE YAŞIYOR.** `src/lib/calc/modules/cabin.ts` elektrik ODASI
hesabı için daha dar bir sürüm taşıyor (en'de 900 yok, derinlik yalnız
400/600/700, baza sabit 200). `sizes.ts` kanoniktir ve
`__tests__/sizes.guard.test.ts` cabin sabitlerinin ALT KÜME kaldığını GERÇEK
İÇE AKTARMAYLA sabitler (değişmez md. 8; sınır TS↔TS olduğu için metin okumak
değil import etmek doğrudur). Test ayrıca `DEFAULT_ROOM_PANEL_HEIGHT_MM = 1800`
ile tercih sırasının başının aynı olduğunu bilerek çiviler. İki ızgaranın
birleştirilmesi ayrı bir iştir.

## PANO-2 — Panolar YAN YANA dizilir; ortak yükseklik ve derinlik zorunludur.

Aynı dizideki bütün panolar aynı yüksekliği ve aynı derinliği taşır — en derin
panonun derinliği hepsinin derinliğidir. Aralarında boşluk YOKTUR (yan levhalar
ortaktır) ve dizinin toplam eni gözlerin toplamıdır. Baza dizinin altında tek
parça çizilir; kablo girişi bazadandır.

**İKİ AYRI DİZİ VARDIR.** Kodu `TB` ile başlayan panolar SAHA panolarıdır,
elektrik odasına girmez, ayrı dizide gösterilir ve ortak yükseklik/derinlik
kuralı KENDİ İÇİNDE işler. Odadaki derinliği duvara asılan bir klemens
kutusuna dayatmak onu gereksizce büyütürdü. Ön ek listesi ayardır
(`fieldPrefixes`, öntanım `TB`) ve her pano için elle `oda`/`saha`/`hariç`
seçilebilir.

**BOŞ KONUM PANO DEĞİLDİR.** Ölçüldü (0019-00): 26 konum kodunun 10'unda
yerleşecek tek bir aygıt yok — `LVD1.1`, `LVD2`, `LVD05` gibi kodlar çizimde
bir SAYFA BAŞLIĞIDIR, bir gövde değil. Hepsine 400 mm pano açmak diziyi
10.100 mm gösteriyordu. Gövde gereci (lamba, fan) tek başına da pano açmaz — o
gereç, cihazları başka bir kodla yazılmış panonun aksesuarıdır. Kullanıcı bir
konumu elle `oda`/`saha` işaretlerse boş da olsa açılır.

## PANO-3 — Montaj plakası gövdeden küçüktür; ray boyu ondan da kısadır.

```
plaka eni      = pano eni        − 2 × kenar payı        (öntanım 30 mm)
plaka boyu     = pano yüksekliği − üst payı − alt payı   (öntanım 50 / 50 mm)
ray boyu       = plaka eni − (dikey kanal × sayı) − 2 × kenar payı
```

Payların hiçbiri sabit DEĞİL AYARDIR ve `LayoutSettings` içinde yaşar: pano
markası değiştiğinde profil kalınlığı, menteşe payı ve kanal ölçüsü de değişir.
Bir panoyu ölçüsüne göre sipariş edip cihazın sığmadığını sahada öğrenmek tam
olarak bu payların tahmin edilmesinden doğar.

**DAR PANODA DİKEY KANAL BİR TANEDİR.** Ölçüldü: 400 mm gövdede plaka 340 mm;
iki yanda 60 mm kanal ve iki kenar payı düşülünce raya 170 mm kalıyordu —
panonun yarısı. Gerçek panolarda dikey kanal dar gövdede TEK yandan çekilir;
iki yanlı kanal, kablonun iki doğrultuda dolaştığı geniş gövdenin çözümüdür.
Sınır plaka enidir (< 500 mm → tek kanal), gövde eni değil.

## PANO-4 — Yerleşim RAY SATIRLARINDANDIR, serbest 2B paketleme değildir.

Sac plaka yerleşimi (`lib/purchasing/hammadde/nesting.ts`) MaxRects kullanır ve
doğrusu odur: parça plakada istediği yerde durabilir. **PANODA DURAMAZ.**
Modüler cihaz 35 mm'lik TS35 rayına oturur ve ray YATAYDIR; serbest bir
paketleyici bir kontaktörü iki rayın arasında havada bırakırdı. Raf (shelf)
paketleme burada %60'ta kalan bir uzlaşma değil, fiziksel gerçeğin kendisidir.

```
ray satırı yüksekliği = max(satırdaki cihaz yüksekliği) + ısı payı + kanal
cihazlar ray boyunca yan yana; toplam ≤ ray boyu
```

Kablo kanalı her ray satırının ALTINDADIR (öntanım 60 mm). Plakaya doğrudan
vidalanan cihaz (`plaka` montaj tipi) ray kullanmaz; kendi yüksekliğince blok
kaplar ve satır akışında sırasını korur.

**BÖLGE DEĞİŞİNCE YENİ RAY AÇILIR.** Bu bir yer tasarrufu değil okunurluk ve
kablolama kuralıdır: gerçek panoda bir ray tek işleve aittir ve kanal ondan
çıkar. Karışık bir rayda hangi kablonun nereye gittiği ancak şemadan bulunur —
panonun kapağını açan kişi onu okuyamaz.

`nesting.ts`ten alınan şey algoritma değil DİSİPLİNDİR: tam belirli sıralama,
payın parçaya eklenmesi, ölçülmüş bir üst sınır ve sonucu ayrı ölçen bir
denetçi.

## PANO-5 — Modül genişliği 17,5 mm'nin katıdır; işaret yoksa TAHMİN YOKTUR.

Modüler cihazın eni ölçülmese bile kutup sayısından bilinir: 1 kutup = 17,5 mm,
3 kutup = 52,5 mm. `1+N` İKİ modüldür — nötr kutbu da yer kaplar ve tek modül
saymak bir dağıtım bankasında düzinelerce mm kaybettirirdi.

Kutup sayısı okunamıyorsa ölçü BOŞ kalır ve cihaz "ölçüsüz" kuyruğuna düşer.
Sürücünün, HMI'nin, kameranın ve trafonun ölçüsü ailesinden ÇIKARILAMAZ; onlar
bilerek boş bırakılır.

**KLEMENS GENİŞLİĞİ KESİTE BAĞLIDIR ve yerleşimi belirleyen asıl kalemdir.**
0019-00'da 726 aygıt satırının 1201 parçası Phoenix Contact'tır — panoların
büyük kısmı klemenstir. Bir klemensi 17,5 mm modül saymak LVD10'u üç kat
büyütürdü. Bilinen ölçüler: UT 2,5 → 5,2 · 4 → 6,2 · 6 → 8,2 · 10 → 10,2 ·
16 → 12,2 mm.

**ŞERİT AİLESİNDE ADET ENDİR.** `=185T+LVD10-X1` adet 200 ile TEK satırdır ama
panoda 200 klemens yer kaplar (1040 mm) ve hiçbir raya sığmaz — şerit alt raya
DEVAM EDER, gerçek panoda da ettiği gibi. Öteki ailelerde adet yedek/aksesuar
sayısıdır ve gövdeyi büyütmez.

## PANO-6 — Montaj tipi cihazın panoda NEREYE takıldığını söyler.

Kaynak, satın almanın ve bakımın zaten kullandığı 25'li `ELECTRICAL_CATEGORIES`
taksonomisidir (`ELEKTRIK-13`); yeni bir sınıflandırma sözlüğü AÇILMAZ.

| Montaj | Nerede | Kategoriler |
|---|---|---|
| `din` | Plakada raya | PLC/Uzak I/O · Şalterler · Sigortalar · Kontaktörler · Motor Koruma · Röleler · Güç Kaynakları · Ölçüm · Haberleşme · Fiş/Priz/Klemens |
| `plaka` | Doğrudan plakaya vidalı | Sürücüler ve Güç Elektroniği |
| `kapak` | Kapak kesiti | HMI · Kumanda Elemanları · Sinyal ve İkaz |
| `govde` | Gövde/kapak gereci | Pano İklimlendirme · Aydınlatma · Pano, Muhafaza ve Etiketleme |
| `saha` | **Pano DIŞI** | Motorlar · Fren · Sensörler · Enkoder · Limit Şalterleri · Kamera · Kablolar |

**`Diğer` MONTAJ TİPİ ÜRETMEZ.** Cihaz "sınıflanmamış" kuyruğunda görünür ve
tahmin edilmiş bir yere KONMAZ — `ELEKTRIK-13`ün açıkça yasakladığı şey budur.

**ÖZGÜL KURAL GENELDEN ÖNCE GELİR.** Ölçülen iki durum: (1) trafo ve reaktör
raya oturmaz — "Güç Kaynakları ve Trafolar" ailesinin anahtarlamalı güç kaynağı
DIN rayındadır ama aynı ailedeki kontrol trafosu onlarca kilo gelir ve doğrudan
plakaya vidalanır; ikisini aynı raya koymak rayı koparır. (2) Kapak kolu ile
kumanda edilen yük ayırıcı (`SIRCO`, `rotary handle`) giriş bandının EN
BAŞINDA durur.

Kullanıcının değiştirdiği montaj tipi ÜRÜNE yazılır (defter), aygıta değil:
aynı ürün bir sonraki projede de doğru yere gider.

## PANO-7 — Bölge sırası KALIN KABLOYU KISALTIR.

Yukarıdan aşağı: **giriş → güç → motor → kumanda → klemens**

- Giriş en üstte: ana şalterin kolu kapaktan kumanda edilir ve el/göz
  hizasında olmalıdır. Dağıtım şalter bankası da bu banttadır — gerçek panoda
  ana şalterin hemen altındaki sıra budur.
- Güç (sürücü, trafo) hemen altında: kalın besleme iletkeni en kısa yolu görür.
  Kalın iletkeni uzatmak hem pahalıdır hem kayıptır; ince kumanda kablosunu
  uzatmak ucuzdur. Sıra bu asimetriden çıkar, estetikten değil.
- Klemens en altta: saha kabloları bazadan girer, en kısa yol.

**ISI AYRI BİR KISITTIR, bölge sırasının parçası değildir.** Isı üreten cihazın
üstünde ve altında serbest yükseklik bırakılır (defterdeki
`clearance_top_mm`/`clearance_bottom_mm`, yoksa 100 mm) ve bu boşluk ray satırı
yüksekliğine eklenir.

**ISI PAYI HER CİHAZA VERİLMEZ.** Ray satırlarını zaten kablo kanalı ayırır;
ölçüldü — her şaltere 100 mm üst ve alt boşluk eklemek 0019'un LVD10'unda
4330 mm ray yüksekliği üretiyordu (plakada 1850 mm var) ve panoyu dört göze
böldürüyordu. Serbest yükseklik yalnız ısı üreten ekipmanın (`surucu` grubu ve
plaka montajlı her cihaz) şartıdır.

## PANO-8 — Paylar İKİ YÖNLÜDÜR; model plaka yerleşiminden gelir.

`nesting.ts`in ölçülmüş modeli izlenir: **payı cihaza ekle, kullanılabilir
alanı küçült.** "Parçayı büyüt, plakayı olduğu gibi bırak" biçimindeki basit
model KENAR PAYINI SIFIR bırakır ve şartın yarısını sessizce çiğner.

| Pay | Öntanım |
|---|---|
| Cihaz ↔ cihaz (aynı ray, aynı aile) | 0 mm — modüler cihaz yapışıktır |
| Cihaz ↔ cihaz (farklı aile) | 10 mm |
| Cihaz ↔ plaka kenarı | 25 mm |
| Ray satırları arası | kanal yüksekliği (60 mm) |
| Isı payı | defterden, yoksa 100 mm |
| Derinlikte arka pay | 40 mm; kapak cihazı ayrıca gövde derinliği + 20 mm ister |

## PANO-9 — En araması EN KÜÇÜĞÜ seçer; kilitli ölçü EZİLMEZ.

```
1. Ortak yükseklik: 1400 → 1600 → 1800 → 2000, küçükten büyüğe.
   1800'ÜN ALTI EŞİĞE BAĞLIDIR; üç şart birlikte aranır ve biri eksikse bir
   üst boya geçilir:
     a. bütün panolar sığmalı,
     b. doluluk payı korunmalı (`fillWarnRatio`, öntanım %80) — dolu bir
        panonun ilave yeri kalmaz ve bir sonraki revizyonda gövde değişir,
     c. HİÇBİR PANO BÖLÜNMEMELİ — yoksa yükseklikten kazanılan, EN'den iki
        kat geri verilir.
   1800 ve üstünde eşik aranmaz; oraya zaten sığmadığı için çıkılır.
   Kullanıcı bir yükseklik verdiyse aday tektir ve eşik hiç aranmaz.
   Hiçbir yükseklik sığdıramıyorsa en az pano bırakan seçilir ve sığmayan pano
   bölünür (PANO-10).
2. Her pano ayrı ayrı: ızgaradaki EN KÜÇÜK sığan en. Hiçbiri sığdıramıyorsa
   EN AZ SIĞMAYAN BIRAKAN seçilir ki ekran yine de bir şey gösterebilsin
   (`enIyiPlakaSecimi` ile aynı ilke).
3. Ortak derinlik: pano başına max(cihaz derinliği) + arka pay [+ kapak payı]
   → ızgaraya yukarı yuvarla → dizinin maksimumu hepsine ortak.
4. Kullanıcının elle seçtiği ölçü KİLİTLİDİR; arama o panoyu atlar, bölmez ve
   sığmıyorsa UYARI verir. Aksi hâlde verilen siparişle ekrandaki plan ayrışır.
```

İlk sürüm 1800'de sığmayan TEK bir pano yüzünden bütün diziyi 2000'e
çıkarıyordu — üstelik o pano 2000'de de sığmıyordu (ölçüldü). Ölçü sığmayan
pano SAYISIDIR.

## PANO-10 — Sığmayan pano BÖLÜNÜR, gizlenmez.

Bölme sınırı BÖLGE SINIRIDIR, cihazın ortası değil: bir gözde giriş ve güç,
ötekinde kumanda ve klemens durur. Bir bölgeyi ikiye kesmek aynı işlevin
kablosunu iki gövde arasında gezdirirdi.

**TEK BÖLGE DE BÖLÜNEBİLMELİDİR** ve bu ölçülmüş bir durumdur: 0019'un
LVD10'unda 195 parçanın neredeyse tamamı klemenstir, yani tek bölge. Bölme
yalnız bölge sınırında yapılsaydı özyineleme ilerlemez ve pano hiçbir zaman
sığmazdı. Tek bölgede sınır aygıt sırasının ORTASIDIR; sıra doğal kod sırası
olduğu için `-X1…-X20` ile `-X21…-X40` ayrılır, aynı şeridin ortasından
kesilmez.

**GÖZLER SIRAYLA HARFLENİR** (`LVD10-A`, `-B`, `-C`). Özyineleme
`LVD10-B-A-A` gibi adlar üretiyordu; o ad kaç turda bölündüğünü anlatır ama
panonun üstüne yapıştırılacak etiket odur ve elektrikçi onu okuyamaz.

Yerleşemeyen cihaz sessizce düşmez: "yerleşmedi" kuyruğunda sebebiyle durur
(ölçüsüz · sınıflanmamış · sığmadı · etiketsiz · saha).

## PANO-11 — Yerleştirme DETERMİNİSTİKTİR ve SONUCU AYRI BİR DENETÇİ ÖLÇER.

Aynı girdi iki kez yerleştirildiğinde aynı plan çıkar; yoksa ekrandaki resim
ile imalatçıya giden çıktı ayrışır. Sıralama tam belirlidir (bölge → ana şalter
→ renk grubu → doğal aygıt kodu → belge sırası) ve hiçbir yerde rastgelelik
yoktur. **Doğal sıra şarttır:** `F2`, `F10`dan önce gelir; alfabetik sıra
şemadaki numaranın anlamını yok ederdi.

`audit.ts` algoritmanın İDDİASINI değil SONUCU ölçer ve yerleştiriciyi hiç
bilmez; yalnız çıkan koordinatlara bakar. Gerekçesi `nesting.ts`teki
kardeşiyle aynıdır ve orada ölçülmüştür: yerleştirme kodunda bir işaret hatası
(`+pay` yerine `−pay`) SESSİZDİR ve ancak atölyede görünür. Denetimler: ray
kapasitesi, plaka dışına taşma, aynı raydaki çakışma, ray dizilimi, plaka
yüksekliği, kanal payı, kapak/plaka yüzü ayrımı, gövde derinliği, her aygıtın
tam bir kez yerleşmesi.

**GEÇEN DENETİMLER DE LİSTELENİR** — ekranda ve kâğıtta. Yalnız hataları
göstermek "denetim çalıştı mı" sorusunu cevapsız bırakır.

## PANO-12 — Tahmin edilmiş ölçü GÖRÜNÜR; defter yalnız OLGU tutar.

Ölçü üç kaynaktan gelir ve sıra tersine çevrilemez: kullanıcının o aygıta
yazdığı düzeltme → ürün ölçü defteri (`electrical_device_models`) → kural
tabanlı tahmin. Üçü de veremezse ölçü BOŞ kalır (değişmez md. 4).

**KAYNAK EN ZAYIF HALKAYA GÖRE VERİLİR.** Eni defterden, boyu tahminden gelen
bir cihaz "tahmin"dir; aksi hâlde sipariş sayacı onu doğrulanmış sayar ve gövde
ölçüsü yanlış çıkar.

**TAHMİN VERİTABANINA YAZILMAZ.** `electrical_device_models` olgu tablosudur;
`source` yalnız `katalog` ya da `elle` olabilir. Tahmin çalışma anında üretilir,
bellekte `dimSource: "tahmin"` taşır ve şemada TARALI çizilir. Kullanıcı bir
tahmini onayladığında deftere `elle` olarak girer — bu ayrı bir iddiadır.

Ölçü ÜRÜNE yapışır, satıra değil: anahtar `electricalCatalogLookupKey`tir
(`ELEKTRIK-12` ile aynı normalleştirici; ikincisini yazmak aynı fiziksel ürünü
iki kayda bölerdi). Bir kez girilen ölçü bütün projelerde geçerlidir.

Sipariş verilebilirlik ölçüsü TEK SAYIDIR: ölçüsü doğrulanmamış aygıt sayısı
sıfır olmalıdır. Ekran bu sayacı sürekli gösterir ve sıfır değilse kırmızıdır.

**ÖLÇÜSÜZ CİHAZ VARSA PANO BUNU SÖYLER.** Sürücüsü ölçülmemiş bir pano 250 mm
derinlik gösterir; o panoyu sipariş etmek sahada 400 mm eksik bırakırdı. Uyarı
pano satırındadır, kuyrukta değil.

## PANO-13 — Şema SİYAH BEYAZ da okunur; renk İKİNCİ kanaldır.

Belge imalatçıya basılı gider. Her cihaz ayrıca etiket ya da numara taşır,
tahmin taramayla ayrılır, bölge sınırı çizgiyle belirtilir. Renk tek başına
hiçbir bilgiyi taşımaz.

**DOKUZ RENK, 25 KATEGORİ DEĞİL.** Göz bir şemada ancak sekiz-dokuz dolguyu
ayırır. Renk `mount.ts`teki İŞLEV GRUBUNA verilir (giriş · sürücü ·
anahtarlama · kumanda · otomasyon · besleme · klemens · iklim · diğer), 25
kategoriye değil.

**PALET ÜÇ DURAKTA BİRDEN YAŞAR ve üçü de zorunludur:**

1. `lib/diagrams/panoLayout.ts` — BASKI hex'i (PDF bunu basar). `DCOL`
   genişletilmez: o, 25 diyagram modülünün ortak mürekkep/kâğıt sözlüğüdür.
2. `components/diagrams/diagram-svg.tsx` → `THEME_PAINT` eşlemesi. Arama
   `THEME_PAINT[hex] ?? paint`tir: **kaydedilmemiş bir hex SESSİZCE ham geçer**
   ve koyu temada açık pastel kalır. `climateRoom.ts`in `#F2C94C`/`#E2A05A`
   renkleri bugün tam olarak bunu yapıyor; emsalin bu yarısı kopyalanmaz.
3. `app/globals.css` — açık temada değer baskı hex'inin AYNISI, koyu temada
   `color-mix(in oklab, …, var(--card))`. Ton açısı sabit, açıklık/doygunluk
   tema başına (değişmez md. 6).

`__tests__/panoLayout.palette.test.ts` üçünü birden sabitler.

**ETİKET SIĞMIYORSA NUMARA, O DA SIĞMIYORSA HİÇBİR ŞEY.** 17,5 mm'lik bir
şalter 1:2 ölçekte 8,75 birim eder ve üstüne "F31" yazmak imkânsızdır. Çözüm
`nesting.ts`teki ile aynıdır: ÇİZİM YERLEŞİMİ, LİSTE KİMLİĞİ anlatır.
Uydurulmuş bir yazı okunmaz bir yazıdan iyi değildir.

**ETİKETLER `fixed: true` TAŞIR.** `fitDiagram` çakışma çözücüyü koşulsuz
çalıştırır; cihazın kendi kutusundaki etiket sabitlenmezse çözücü onu cihazın
üstünden iter.

## PANO-14 — PLAN SAKLANMAZ; girdi, kararlar ve ONAY saklanır.

`purchasing/hammadde/yerlesim` doktrini burada da geçerlidir ve `ELEKTRIK-6`
ile birleşir: `electrical_parts` her yeniden okumada SİLİNİP üretilir. Plan bir
tabloya konsaydı belge yeniden okunduğunda sessizce eskirdi ve imalatçı eski
plana bakarak gövde keserdi.

Veritabanı yalnız kullanıcının KARARLARINI taşır: pano gövde seçimleri
(`switchboard_panels`), aygıt düzeltmeleri (`switchboard_placements`, yalnız
SAPMALAR), ürün ölçüleri (`electrical_device_models`) ve onay
(`switchboard_approvals`). Yerleşim her açılışta yeniden hesaplanır.

**KARARLAR BELGEYE DEĞİL PROJEYE BAĞLANIR** (`projects(id)`): rev3 → rev4 yeni
bir `electrical_projects` satırıdır ve kararlar belgeye bağlansaydı çizim
bürosunun her yeni sürümünde bütün pano boyutlandırması kaybolurdu.

**ANAHTAR AYGIT ETİKETİDİR:** `installation|location|device` (normalize).
`electrical_parts.id` yeniden okumada üretilir; ürün anahtarı ise aynı tipteki
on iki kontaktörü (`-K1…-K12`) tek satır sayar ama onlar on iki ayrı kutudur.
`device` parçası boş olan satır YERLEŞİM YUVASI AÇMAZ — `sort`tan anahtar
türetmek yeniden okumada kayardı ve düzeltme yanlış aygıta yapışırdı.

**ONAY BİR PARMAK İZİNE BAĞLIDIR.** Plan saklanmadığı için "neyi onayladım"
sorusunun cevabı girdinin kararlı hash'idir. Girdi değişince ekranda ve PDF
altbilgisinde "onay eskidi" görünür. Donmuş belge, indirilen SVG/PDF dosyasının
KENDİSİDİR ve üstünde tarih ile parmak izi yazar.

**"YENİDEN YERLEŞTİR" BİR YAZMA DEĞİL BİR SİLME İŞLEMİDİR:** aygıt
düzeltmelerini bırakır. `pinned` satırlar ve pano gövde seçimleri KORUNUR —
onlar bilerek verilmiş kararlardır ve bir düğme onları silmemelidir.

Kaydedilmemiş denemeler ADRESTE taşınır (`?yukseklik=2000&derinlik=500`):
kullanıcı bir ölçüyü deneyip bakabilir, sayfa paylaşılabilir bir bağlantı
olarak kalır ve hiçbir şey yazılmaz.

## PANO-15 — İndirilen dosya KENDİ BAŞINA YETER.

SVG pano imalatçısına gider; orada `var(--oc-diagram-ink)` diye bir şey yoktur.
`diagramToSvg` tema değişkeni değil BASKI hex'i yazar
(`product-portal/nameplate.ts` ile aynı kural) ve beyaz bir zemin basar.

`diagramToSvg` üçüncü bir çeviricidir ve `pdf/diagram.tsx`in başındaki
ölçülmüş tuzağı DERLEME ZAMANINDA kapatır: `switch (el.kind)` tüketicidir ve
`default` dalında `const _tam: never = el` durur. `DiagramEl`e yeni bir tür
eklendiğinde bu dosya derlenmez ve kimse eksik bir SVG indiremez. Bir test de
her `kind` için çıktıda ilgili etiketi arar.

PDF `PdfDiagram`ı `lib/pdf/diagram.tsx`ten alır — `report.tsx`ten DEĞİL; o
dosyanın dar bağımlılık yüzeyi bilinçlidir. Kareye yakın çizimde `maxWidth` ve
`maxHeight` BİRLİKTE verilir, yoksa `wrap={false}` çizimi sonraki sayfaya iter
ve orada da taşar (ölçülmüş hata, 15.08.2026).

## PANO-16 — Yeni çizim `select.ts`e KAYDEDİLMEZ.

`lib/diagrams/select.ts` hesap raporu sihirbazının BÖLÜM diyagramlarını
yönlendirir (`diagramForSection`). Pano şeması bir hesap bölümü değildir ve
`nesting.ts` gibi doğrudan çağrılır — `nesting-view.tsx` ile
`pdf/nesting-plan.tsx` onu `select.ts`e uğramadan içe aktarır. Oraya kaydetmek
şemayı sihirbazın ve el kitabı şema seçicisinin listesine sokardı; orada bir
pano yerleşiminin işi yoktur.
