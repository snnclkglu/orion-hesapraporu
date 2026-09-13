# Pano Yerleşimi

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir.
>
> **`scripts/agent-docs/split.ts --uygula` ÇALIŞTIRILMAZ.** O betik alan
> dosyalarını `AGENTS.md`i ayrıştırarak ÜRETİR; kök dosya bugün yalnız
> değişmezleri ve haritayı taşıyor, gövdeler oradan çıkmış durumda. Bugün
> `--uygula` demek on yedi alan dosyasını altı satırlık kütüğe indirmektir.
> Denetim salt okunur `npx tsx scripts/agent-docs/doctor.ts` iledir.

**Kapsam:** `src/lib/switchboard/**` (`layout/sirala.ts` · `layout/paketle.ts`
· `layout/coz.ts` · `layout/dizi.ts` — `layout.ts` yalnız dışa aktarır) ·
`src/lib/switchboard-data.ts` · `src/lib/diagrams/panoLayout.ts` ·
`src/lib/diagrams/svg.ts` · `src/lib/pdf/pano-layout.tsx` ·
`src/app/(app)/projects/[id]/pano/**` (`bolumler/` dört bölüm) ·
`scripts/test-switchboard-layout.ts` · `scripts/switchboard-live-dump.py` ·
`scripts/apply-migration.py`

**Plan ve ölçüm:** `docs/plans/PANO_YERLESIMI_IYILESTIRME_PLANI.md`
(12–13.09.2026; teşhis T1–T13, fazlar F0–F7, kontrol K0–K5).

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

**SERİ ADI KATEGORİDEN ÖNCE GELİR.** Ölçüldü: `PT 4-HESILED 24 (5X20)` bir
SİGORTALI KLEMENSTİR; taksonomi onu doğru biçimde "Sigortalar ve Sigorta
Yuvaları"na koyar ama fiziği klemenstir, modüler şalter değil. Kategoriye bakan
ilk sürüm onda kutup sayısı arıyor, bulamıyor ve 155 adet ürünü "ölçüsüz"
bırakıyordu. Seri adı (PT/UT/UK/ST) + kesit AÇIK BİR İŞARETTİR ve o ailede adım
kesite göre sabittir. `RBO` (cıvata bağlantılı) BİLEREK DIŞARIDADIR — adımı bu
tabloya uymaz, tahmin edilmez, deftere girer.

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

**ÖLÇÜM AİLESİ İKİYE AYRILIR** ve bu ölçülmüş bir hatadır (06.09.2026):
"Ölçüm ve Enstrümantasyon" hem PANO GÖSTERGESİNİ (96 × 96 kesitli ampermetre,
tarayıcı alarm cihazı) hem SAHA ELEMANINI (PT100 probu, yük hücresi, basınç
vericisi) taşır. İkisi de pano göstergesi sayılınca 0019 + 0026'da 52 PT100
probu, 20 rezistans termometresi ve 5 yük hücresi panoya girip **7,4 METRE
hayalet ray** yiyordu — hiçbiri panoda değil, motorun ve redüktörün üstünde.
Ayrım süreç bağlantısından ve prob gövdesinden okunur: `NPT`/`BSP` bir boru
dişidir ve pano kapağında işi yoktur.

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

**TEDARİKÇİSİ BOŞ SATIR DEFTERİ IŞKALAMAZ.** Ölçüldü (0019 + 0026): `PT 2,5`
klemensi malzeme listesinde İKİ kere geçiyor — 708 adedi "Phoenix Contact"
tedarikçisiyle, 262 adedi TEDARİKÇİSİ BOŞ. Anahtar üretici + tip numarasından
kurulduğu için ikisi ayrı kayıt olur ve deftere bir kez girilen ölçü parçaların
dörtte birini ıskalardı. Yedek arama tip numarasıyla yapılır ama YALNIZ TEK
EŞLEŞMEDE: aynı tip numarasını iki farklı üretici taşıyorsa hangisi olduğu
bilinmiyordur ve tahmin edilmez (değişmez md. 4).

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

## PANO-17 — Ölçü katalogdan OTOMATİK ÇEKİLMEZ; sayfada geçmek sahiplik değildir.

Ölçü defterini (PANO-12) 274 üretici PDF'inden toplu ayıklamak istendi ve
ölçüldü: **tip numarasının bir sayfada geçmesi, o sayfadaki ölçülerin ona ait
olduğu anlamına GELMEZ.**

Somut örnek (06.09.2026): `6SL3120-1TE23-0AC0` (SINAMICS S120 Motor Module)
`SIEMENS - SINAMICS S120 Booksize ve SIMOTICS Katalog D 21.4` belgesinin 164.
sayfasında geçiyor ve o sayfada eksiksiz bir `Dimensions · Width/Height/Depth`
tablosu var. Ama tablo **motor reaktörünündür**; sürücü orada yalnız "şu Motor
Module için uygundur" satırında adı geçen bir referanstır. Yakınlığa bakan bir
ayıklayıcı 178 × 153 × 88 mm'yi sürücüye yazardı ve o pano sahada 300 mm
eksik çıkardı.

Aynı belgede ölçüler bir de GÖVDE SINIFINA göre veriliyor (50 · 100 · 150 mm
booksize genişlikleri, s. 173/263/316) — sipariş numarasına göre değil. Yani
eşleme "sipariş no → ölçü" değil, "sipariş no → gövde sınıfı → ölçü"dür ve o
ara adım belgeden okunmadan kurulamaz.

Sonuç: ayıklama marka marka ve tablo tablo yapılır (`scripts/catalog-extract/`
deseni), sonucu insan doğrular ve deftere `source = 'elle'` ya da doğrulanmış
`'katalog'` olarak girer. `scripts/probe-device-dimensions.ts` bu işin
gözüdür: belgeyi taramaz, GÖSTERİR — tip numarasına, ölçü sözcüklerine ya da
sayfa numarasına göre metin katmanını döker. Otomatik yazma YOKTUR
(değişmez md. 4).

## PANO-18 — Defter ETKİ SIRASIYLA doldurulur; ekran o sırayı verir.

Defteri doldurmak 122 ürünlük bir iştir ve ürünler eşit değildir: 970 adet
geçen bir klemensin 1 mm'lik hatası panoyu bir metre büyütür, tek adet geçen
bir sinyal lambasının 10 mm'si hiçbir şeyi değiştirmez. Sıra bu yüzden
alfabetik değil **ETKİYE** göredir — o ürünün belirlediği toplam ray uzunluğu
(birim eni × adet).

**Ölçü Defteri kendi ekranıdır** (`/projects/[id]/pano/defter`, kullanıcı
isteği 06.09.2026) ve Elektrik Projesi sekmesinde "Pano Yerleşimi"nin yanındaki
düğmeden açılır. Ayrı olmasının sebebi: "şu ürünün ölçüsü girilmiş mi?" sorusu
bir pano şeması açmayı gerektirmemeli.

Ekran İKİ KAYNAĞIN BİRLEŞİMİDİR: defterdeki kayıtlar ve bu projede geçen
ürünler. Defter projeden bağımsızdır ama onu DOLDURAN kişi bir projenin
içindedir ve sorusu "bu işte hangi ürün eksik?"tir. Defterde olup projede
geçmeyen ürün de listelenir — mühendis başka bir işte girdiği ölçüyü buradan
denetler.

Süzgeç ve arama `lib/switchboard/book.ts` içindeki SAF fonksiyondan geçer;
ekranda ikinci bir kopyası yoktur (ELEKTRIK-11 ile aynı ilke). Arama
`trKatla`dan geçer — `İ`/`ı` tuzağı yüzünden ham `toUpperCase` bir markayı
aramada kaybettirirdi.

`scripts/switchboard-dimension-gap.ts` aynı sırayı komut satırında verir ve
marka dökümüyle birlikte basar: ayıklama turu marka marka yürür (PANO-17).

## PANO-19 — Kaçak KONTROL KARAKTERİ regex'i sessizce öldürür.

Ölçüldü (06.09.2026): `footprint.ts`teki klemens serisi regex'i hiç
eşleşmiyordu ve sebebi görünmezdi — kaynakta sözcük sınırı (`\b`) yerine
**gerçek bir BACKSPACE karakteri (0x08)** duruyordu. Dosyayı üreten betiğin
kaçış dizisi çözülmüş; düzenleyicide ve `sed` çıktısında doğru görünüyor,
`cat -A` ise `^H` gösteriyordu. Regex bir backspace arıyor, bulamıyor ve
155 adetlik ürün ailesi sessizce “ölçüsüz” kalıyordu.

Kaynak dosyaya kabuk ya da betik yoluyla regex yazıldıysa
`grep -n … | cat -A` ile denetlenir. Aynı tuzak besleme (0x0C), düşey sekme
(0x0B) ve zil (0x07) kaçışlarında da vardır; bu doküman da bir kez ona düştü.

## PANO-20 — Ayıklama AİLE AİLE yürür; her ölçü ÜÇ LENSLE çürütülmeye çalışılır.

Ölçü defterini doldurmak 54 aile, 122 ürün ve 274 üretici PDF'i demektir. Tur
üç kuralla yürür ve üçü de ölçülmüş bir sebebe dayanır.

**İŞ BİRİMİ ÜRÜN DEĞİL AİLEDİR.** Aynı ailenin ürünleri aynı katalogda ve çoğu
zaman AYNI TABLODA durur (Siemens `3RV`, Schneider `GV2`, Phoenix `PT`). Ürün
başına bir ajan, 850 sayfalık bir katalogu on kez açardı; aile başına bir ajan
bir kez açar ve sütun eşlemesini bir kez kurar. İş listesini
`scripts/switchboard-dimension-plan.ts` üretir: hangi ürün eksik ve o ürünü
hangi PDF kapsıyor.

**TEK ÜRÜNLÜK TEKNİK FÖY EN GÜVENİLİR KAYNAKTIR.** Dosya adında sipariş
numarası geçen belgede sayfadaki her şey o ürünündür ve PANO-17 tuzağı
doğmaz. Ana katalog en son denenir.

**HER ÖLÇÜ ÜÇ BAĞIMSIZ LENSLE ÇÜRÜTÜLMEYE ÇALIŞILIR** ve en az ikisini
geçemeyen ölçü deftere GİRMEZ:

| Lens | Sorusu |
|---|---|
| `sahiplik` | Sipariş numarası ölçü satırlarının ÜSTÜNDEKİ ürün satırında mı, yoksa “Suitable for” gibi bir referans satırında mı? Çok sütunlu tabloda değer o ürünün SÜTUNUNA mı denk geliyor? |
| `alinti` | İddia edilen alıntı belirtilen dosya ve sayfada BİREBİR var mı? Kaynaksız ölçü tek başına çürütme sebebidir. |
| `fizik` | Ölçü bu aile için makul mü? Ambalaj ölçüsü ve pano KESİM ölçüsü cihaz ölçüsü DEĞİLDİR. |

Oy gelmemişse iddia DÜŞER: doğrulanmamış bir ölçü defterde olgu olarak duramaz.

**SÜTUN EŞLEMESİ BAĞIMSIZ BİR KANITA DAYANMALIDIR.** Ölçüldü (D 21.3 s.194):
üç reaktörlü bir tabloda doğru sütun, yakınlıkla değil anma akımı satırıyla
bulundu — Siemens akımı sipariş numarasına gömüyor (`-0EE36-2` → 615 A,
`-0EE38-8` → 885 A, `-0EE41-4` → 1430 A) ve ikinci sütunun ağırlığı,
endüktansı, kaybı da 885 A'lik bir reaktörle tutarlı çıktı.

**TUR SÜRDÜRÜLEBİLİRDİR.** Oturum kotası bir turu yarıda kesebilir; tamamlanan
ajanlar önbellekten döner ve yalnız düşenler yeniden çalışır. Bu yüzden
ayıklama ile doğrulama AYNI turda ve ürün ürün bağımsız yürütülür — tek bir
bariyer, kotaya takılan bir ajanı bütün turun önünde bekletirdi.

**ÇIKTI DOĞRUDAN VERİTABANINA YAZILMAZ.** `scripts/seed-device-models.ts`
onaylı satırları migration'a çevirir; kaynak izi (belge · sayfa · birebir
alıntı · sahiplik kanıtı) `note` alanında kalır ve `source_document_id` katalog
defterine bağlanır. Çakışmada güncelleme yalnız `source <> 'elle'` satırlarda
çalışır: mühendisin kendi beyanı toplu bir turla değişmez (PANO-12).

## PANO-21 — ÇÜRÜTME AİLEYE YAYILIR; kademeli doğrulamanın kör noktası budur.

Ölçüldü (07.09.2026, 87 ölçü / 137 ajan): doğrulama kademeli yapıldı — ajanın
“kesin” dediği ve fizik taramasını geçen 62 ölçüye tek lens (sahiplik), şüpheli
25'ine üç lens. Sonuç: **11 çürütmenin HEPSİ üç lensli kovadan çıktı, tek
lensli kovadan hiç ret gelmedi.**

Bu, tek lensli ölçülerin daha iyi olduğunu göstermez. Yakalanan hataların çoğu
ALINTI lensinin işiydi ve o lens tek lensli ürünlerde hiç koşmadı:

- Siemens 5SL6 otomatlarında yükseklik/derinlik katalogda HİÇ YOK; 90/76
  değerleri başka sipariş numaralarının veri sayfalarından taşınmıştı. Üç
  varyant (5SL6204/5SL6325/5SL6332) üç lensten geçip çürütüldü; AYNI KUSURU
  taşıyan yedi kardeşi tek lensten geçip ONAYLANDI.
- Siemens 3RV2'de katalog derinliği 91 mm, ürün veri sayfası 97 mm. İki varyant
  çürütüldü, altı kardeşi geçti.

**KURAL: bir çürütmenin gerekçesi tek bir sayıyı değil KAYNAĞI hedef alıyorsa,
o gerekçe aynı kaynaktan okunan bütün kardeşleri bağlar.** Ret çıkan ailenin
onaylanmış üyeleri deftere GİRMEZ; karantinaya alınır ve eksik lensten geçirilir.

**OYU EKSİK KALAN ÜRÜN DE KARANTİNADADIR.** Oturum kotası bir doğrulayıcıyı
düşürdüğünde geri kalan oylar “çoğunluk” sayılmaz: üç lens için tasarlanmış bir
eşik, tek oyla karşılanmış gibi davranamaz.

Ölçülen sonuç: 76 onaylı üründen 14'ü karantinaya alındı, deftere 62 ürün
girdi (65 anahtar). Karantinadakiler dış kaynak izniyle yeniden ayıklandı.

## PANO-22 — Kapak cihazının ölçüsü GÖVDE değil KESİM + KOMŞU MESAFESİdir.

Ölçüldü (07.09.2026): Schneider XB4 buton ailesinin on ürünü “ölçüsü yok”
kuyruğunda duruyordu; ana katalog o satırlarda yalnız referans ve AĞIRLIK
veriyor. Ölçü kayıp değildi — YANLIŞ YERDE ARANIYORDU. Montaj föyü
(`BRU46063`) 2. sayfası kapak kesimini veriyor:

```
Panel cut-out : Ø 22,3   (delik)
Komsu mesafesi: 30 mm    (standart baslik)
                40 mm    (mantar baslik / acil stop, Ø 40 ve Ø 60 boslugu)
```

Kapakta yer kaplayan şey deliğin kendisi değil, **iki delik arasında bırakılması
gereken mesafedir**: yan yana iki buton 30 mm'den yakın olamaz. Bu yüzden kapak
cihazında

- EN ve YÜKSEKLİK — kesim + komşu mesafesi (22 mm delik için 30 mm, mantar
  başlıkta 40 mm),
- DERİNLİK — kapağın ARKASINDA kalan gövde derinliği (kontak blokları dâhil)

alınır. Gövdenin ön çapını en almak kapağı gereğinden dar hesaplatır; kesim
ölçüsünü derinlik sanmak da panoyu sığ bırakır.

Tahmin motorunun kumanda elemanları için kullandığı 30 x 30 değeri bu föyle
DOĞRULANMIŞTIR — yani orada bir tahmin değil, ölçülmüş bir standart vardır.

## PANO-23 — Sabitleme SIRAYI korur, KOORDİNATI değil.

> **13.09.2026:** sıra artık bir İNDEKS değil bir KOMŞULUKTUR
> (`anchor_device_key` + `anchor_side`, PANO-38). `order_in_rail` eski
> biçimdir: okunur, yazılmaz. Aşağıdaki gerekçe (koordinat donmaz) aynen
> geçerlidir.

Şemada bir aygıtı başka bir yere taşımak, onu o KOMŞULUĞA taşımaktır. Bırakılan
komşuluk saklanır, koordinat ise her yerleştirmede YENİDEN HESAPLANIR.

Sebep: koordinat donmuş olsaydı komşu bir cihazın eni değiştiğinde — bir ölçü
deftere girdiğinde, bir cihaz eklendiğinde, pano eni büyüdüğünde — sabitlenmiş
aygıt yerinde kalır ve komşusunun üstüne biner. Denetçi bunu `cakisma` olarak
yakalardı ama zararı çoktan olmuş olurdu: kullanıcı sabitlediği için doğru
sandığı bir plana bakıyor olurdu.

Uygulama: türetilmiş sıra (bölge → ana şalter → renk → doğal kod) önce
kurulur, sonra sabitlenmiş aygıtlar istedikleri indekse OTURTULUR ve gerisi
aradaki boşlukları sırayla doldurur. Aynı indeksi isteyen iki aygıt olursa
doğal kod sırası ayırır — belirsizlik bırakılmaz (PANO-11).

`pinned` bayrağı yerleşime taşınır: ekran rozet gösterir ve
“Yeniden Yerleştir” o satırı korur. Ray numarası (`rail_index`) saklanır ama
sıra baskındır; bir rayın kapasitesi cihazın oraya sığacağını garanti etmez ve
garanti ediyormuş gibi davranmak sahada yanlış pano ürettirir.

## PANO-24 — ALT AYGIT ana aygıtın içindedir; ayrı yer istemez.

`=100T+LVD0-U20-U15` bir aygıt değil, `-U20` sürücüsünün yuvasına takılan bir
karttır. IEC 81346'nın alt aygıt yazımıdır ve elektrik projesinde ayrı bir
malzeme satırı açar; panoda ise ayrı bir gövde AÇMAZ.

Kural: etiketi `<ana>-<alt>` biçiminde olan ve **ana aygıtı aynı listede
bulunan** satır, ana aygıtın kutusuna yutulur. Bu, `buildDeviceBoxes`in "aynı
etiketin ikinci satırı ölçüyü büyütmez" kuralının kardeşidir — orada kontaktör
ile yardımcı kontağı tek etikette, burada sürücü ile kartı iki etikette gelir.

ÖKSÜZ ALT AYGIT KENDİ KUTUSUDUR. Ölçüldü (0026-01): `-M36-1G12` enkoderi var
ama `-M36` motoru malzeme listesinde yok. Onu yutacak bir gövde olmadığı için
kendi başına durur ve saha kuyruğunda görünür — sessizce kaybolmaz.

Ölçülen kazanç: 0026'da dört sahte sürücü kartı kutusu düştü; her biri montaj
plakasında kendi yerini istiyordu.

## PANO-25 — Sözlük, ÜZERİNDE ÇALIŞILAN İŞİN kelime dağarcığıyla ölçülür.

Sınıflandırma (`lib/electrical/category.ts`) 0019-00'ın Siemens/ABB yazımıyla
kuruldu ve orada kusursuz görünüyordu. Aynı kod 0026-01'e uygulandığında
ölçüldü (08.09.2026):

| | 0019-00 (Siemens/ABB) | 0026-01 (Schneider) |
|---|---|---|
| Benzersiz ürün | 184 | 54 |
| Sınıflanmamış (`Diğer`) | **1** | **22 · %41** |
| Sürücü (`plaka`) | 12 | **0** |

Kullanıcının ekranda gördüğü "Panoya girmeyen aygıtlar (50)" yığınının 35'i
buydu. Bir yerleştirme hatası değil, bir SÖZLÜK eksiğiydi — ve gerçek eksikler
(ölçüsü olmayan dört sürücü) o kalabalığın içinde görünmüyordu.

Ölçüt tek bir işte iyi çalışmak değil, YENİ BİR İŞİ TANIMAKTIR. Her yeni iş
için sınıflanmama oranı ölçülür; `switchboard/__tests__/is0026.guard.test.ts`
o işin gerçek malzeme satırlarını taşır ve yeni bir marka geldiğinde oraya o
işin satırları eklenir.

Aynı ilkenin ikinci yüzü OKUMADIR: "Automat. **two-pole** C 16 A" ile
"CIRCUIT BREAKER … **3POLE**" aynı cümledir. Kutup sayısını yalnız rakamla
arayan okuyucu 13 Acti9 otomatını ölçüsüz bırakıyordu; yazıyla yazılmış kutup
bir tahmin değil bir okumadır (PANO-5).

Üçüncü yüzü İŞARETİN NEREDE OLDUĞUDUR: `MATIS 4000`ün tanımı yalnız
"400-230V , 4kVA" diyor — ne "trafo" ne "transformer" geçiyor. **kVA bir
işarettir** (yalnız trafo ve UPS kVA ile anılır, anahtarlamalı güç kaynağı W
ile) ve 4 kVA'lık bir trafo o işaret okunmadığı için DIN rayına oturuyordu.

## PANO-26 — Aksesuar EN EKLER Mİ, bu AYRI bir sorudur.

Yardımcı kontak bloğu gövdenin YANINA takılıyorsa toplam eni büyütür, ÖNÜNE ya
da ÜSTÜNE takılıyorsa büyütmez. Katalog bunu söyler ve söylediği yerden okunur;
varsayılmaz.

Ölçüldü (0026-01, TeSys ve Acti9 katalogları):

- `A9A26904` (Acti9 iOF): montaj kuralları sayfası "à esquerda" (sola) diyor —
  9 mm takım enine EKLENİR.
- `GVAE11` (GV2/GV3): "Front mounting add-on contact blocks" — ene 0 ekler,
  derinliğe ~15 mm.
- `LAG8N113P` (P HARFLİ, "1st left or right"): dipnot açıkça *"Does not
  increase the contactor dimensions"*.
- `LAG8N113` (P HARFSİZ, "2nd left or right"): aynı katalog *"a' = a + 20 mm
  with additional auxiliary contact blocks on both sides (externally)"* diyor —
  yani YAN BAŞINA ~10 mm EKLER.

İki ürün tek bir harfle ayrılıyor ve biri ölçüyü büyütüyor, öteki büyütmüyor.

### UYGULAMA: kanıtı olan eklenir, olmayan eklenmez

`mount.ts` içindeki `aksesuarYonu` yalnız kataloğun AÇIKÇA söylediği iki aileyi
tanır — `A9A`/`iOF`/`iSD` yandan (`+en`), `GVAE` önden (`0`). Liste bilerek
DARDIR: `AUXILIARY CONTACT` gibi geniş bir işaret önden takılan blokları da
yakalar ve panoyu gereksizce genişletirdi. Kanıtı olmayan aksesuar `null` döner
ve eni değiştirmez (değişmez md. 4).

`buildDeviceBoxes` aynı etiketin ikinci satırını görünce yönü sorar; "yan" ise
aksesuarın KENDİ eni gövdeye eklenir. İki incelik:

- **Aksesuar ana aygıtın ölçü düzeltmesini ALMAZ.** `placementOverrides` aygıt
  anahtarına bağlıdır ve aksesuar da aynı anahtarı taşır; düzeltme ona da
  uygulansaydı kullanıcının yazdığı en İKİ KEZ sayılırdı.
- **Kaynak en zayıf halkaya göre verilir** (PANO-12): katalogdan gelen bir
  gövdeye tahmin edilmiş bir aksesuar eklenirse toplam TAHMİNDİR.

Ölçüldü (0026-01): iki Acti9 otomatı 36 → **45 mm** oldu; `LVD0-A` doluluğu
%72'den %74'e çıktı, gövde ızgarası değişmedi.

**`LAG8N113` BEKLİYOR.** Katalog "yan başına ~10 mm" diyor ama ürünün kendi
ölçüsü hiçbir kaynakta yok, ayrıca iki bloğun iki kontaktöre nasıl dağıldığı
belgeden çıkmıyor — projeye sorulacak. Ölçü olmadığı için bugün eklenen bir şey
de yok; kural yazılı, uygulaması veriye bağlı.

İkinci kural: **FİŞLİ RÖLE BİR TAKIMDIR.** Deftere giren ölçü röleyle soketin
BİRLİKTE kapladığı yerdir — en soketin eni, boy soket + röle. `RXG22BD` ve
`RGZE1S48M` satırları aynı takım ölçüsünü taşır ve `note` alanı bunu söyler.
Ölçüldü: sistem bu takımı 6,2 mm sanıyordu, gerçeği 15,8 mm — 23 adetlik bir
kalemde 220 mm ray farkı.

## PANO-27 — `yan`: pano yanına asılan ekipman ÇİZİLİR ama YERLEŞMEZ.

Siren, korna, ikaz kolonu, LED emniyet spotu ve projektör panonun içinde
değildir; vincin üstüne ya da panonun yanına asılır. Kullanıcının kendi
cümlesi (08.09.2026): *"şemada panoların yanında dursun, bunlar genelde sahada
oluyor ya da panonun yanına falan asılıyor."*

`saha`dan (motor, enkoder, limit şalteri, fren direnci) farkı ÇİZİLMESİDİR:
saha ekipmanı makinenin üstündedir ve pano çiziminde işi yoktur; `yan` ekipman
panonun görünür komşusudur.

Ölçülen hata (0026-01): 108 dB'lik bir siren, bir boru korna ve üç katlı bir
ikaz kolonu pano KAPAĞINA 30 × 30 mm delik olarak çiziliyordu — o ölçü
PANO-22'nin kapak KESİM standardıdır ve vincin üstündeki bir cihazda hiçbir
anlamı yok. Dört adet 160 W LED projektör ise "gövde gereci" sayıldığı için
**hiçbir yerde görünmüyordu**: ne çizimde, ne listede, ne kuyrukta.

Uygulama:

- Dizilim şemasında dizinin SAĞINDA, panolarla AYNI ÖLÇEKTE ayrı bir şerit;
  kesikli bir ayırıcı şeridi bir göz sanılmaktan korur.
- **Dizinin toplam en ölçüsüne GİRMEZ.** O sayı imalatçıya giden gövde enidir
  ve bir sirenle büyümez; yalnız çizim tuvali genişler.
- Ölçüsü bilinmeyen cihaz taralı bir YER TUTUCU kutuyla ve `?` ile çizilir.
  Tahmin ÜRETİLMEZ (değişmez md. 4) — kapak elemanlarının 30 × 30 kesim
  ölçüsü buraya UYGULANMAZ.
- Sipariş kapısını (PANO-12) KAPATMAZ: bir sirenin eni panonun gövdesini
  belirlemez.
- Tek başına yan ekipman taşıyan konum PANO AÇMAZ (PANO-2), ama o cihazlar
  dizinin şeridinde görünmeye devam eder.

Aynı görünürlük kuralı `govde` için de geçerlidir: fan, termostat ve pano
lambası hesaplanıyordu ve tipin kendi yorumu "listede durur" diyordu — böyle
bir liste HİÇBİR YERDE YOKTU. Artık iç yerleşim sayfasında listelenir.

Montaj tipi ÜÇ YERDE yaşıyor (TypeScript birliği, SQL kısıtı, iki Zod listesi)
ve ayrışmayı `mount.sql.guard.test.ts` migration dosyasını OKUYARAK engeller
(değişmez md. 8).

## PANO-28 — Şema ölçeği bir GÖRÜNÜM parametresidir; ayara ve parmak izine girmez.

İç yerleşim ölçeği seçilebilir (1:2 · 1:4 · 1:5, öntanım **1:4** — kullanıcı
1:2'yi fazla buldu) ve altyazıdaki "ölçek 1:N" ibaresi DEĞERDEN ÜRETİLİR. Elle
yazılmış bir ibare, ölçek değişince sessizce yalan söyler; nitekim söylüyordu.

**1:10 bilerek yoktur:** 85 mm'lik bir cihaz 8,5 çizim birimine iner ve
`h >= 10` eşiğinin altına düşer — o ölçekte hiçbir cihaz ne etiket ne numara
alır, PANO-13'ün "resim yerleşimi, liste kimliği" sözleşmesi iki yönden birden
kopar. 1:4'te de bazı cihazların yazısı sığmaz (tek kutuplu bir otomat 4,4
birime iner) ve altyazı bunu SAYIYLA söyler. Okunurluk tabanları çizim birimi
cinsindendir ve ÖLÇEKLE KÜÇÜLMEZ (MOBIL-9).

Ölçek `LayoutSettings`e KONMAZ. Ayar nesnesi parmak izine giriyor (PANO-14) ve
onay kaydında saklanıyor; ölçeği oraya koymak, çizim ölçeğini değiştirmeyi
ONAYI GEÇERSİZ KILAN bir olay yapardı.

**Kâğıttaki oran modelin ölçeği DEĞİLDİR.** `PdfDiagram` çizimi sayfaya
yeniden sığdırır: 400 × 2000 mm'lik bir pano 1:2 modelde ~520 × 1090 birimken
kâğıtta ~298 birime iner, yani basılan oran ~1:10'dur. Bu yüzden PDF ölçek
ibaresi BASMAZ ve model ölçeği orada yalnız ayrıntı yoğunluğunu belirler.

Kapak görünüşü de ölçek İDDİA ETMEZ: kapak elemanları sabit 90 mm'lik bir
ızgaraya diziliyor (gerçek kesim yerleri değil) ve küçük semboller görünür
kalsın diye taban ölçülerle çiziliyor. O çizim bir yerleşim KROKİSİDİR.

## PANO-29 — Şema TIKLANABİLİR; vuruş kutuları çizimin KENDİ geçişinden gelir.

Şemada bir cihaza basınca kimlik kartı açılır: aygıt kodu, tanım, ürün,
kategori, montaj yeri, ölçü ve ÖLÇÜ KAYNAĞI (tahminse kehribar — o satır
sipariş edilemez, PANO-12).

Vuruş kutuları (`panoIcYerlesim().kutular`) çizim döngüsünün İÇİNDE toplanır.
İkinci bir geometri geçişi yazılmaz: `pdf/diagram.tsx`in başındaki uyarı aynı
hatanın bedelini anlatıyor — iki paralel uygulama bir gün ayrışır ve baloncuk
YANLIŞ cihazı anlatır. Bir test her yerleşimin tam bir kutusu olduğunu, kutu
anahtarının `panoNumaralari` anahtarıyla aynı olduğunu ve kutuların çizilen
dikdörtgenlerle örtüştüğünü sabitler.

Kimlik `Placement`ta DEĞİL `DeviceBox`tadır: yerleşim yalnız geometridir ve
bölünmüş bir klemens şeridi aynı kimliği onlarca dilimde taşırdı. Bütün aygıt
kutuları sonuçta bir kez taşınır (`LayoutResult.devices`).

`Diagram` modeli SAF KALIR. Elemanlara kimlik ya da olay eklemek, 25 modülün
ve üç çeviricinin paylaştığı bir yeri tek ekran için kirletirdi; bunun yerine
`DiagramSvg` isteğe bağlı bir `overlay` alır ve çağıran kendi saydam
dikdörtgenini AYNI `viewBox` içine koyar. `role` o zaman `img`den `group`a
döner — `img` çocukları ekran okuyucuya kapatır ve etkileşim katmanını
erişilemez yapardı.

Hedef TEK bir saydam dikdörtgendir, cihaz başına bir tane değil: en kalabalık
panoda 659 düğüm demekti ve o düğümlerin çoğu 1,3 birimlik klemenslerdir —
üst üste binen dokunma hedefleri (MOBIL-28'in ölçülmüş hatası). Nokta sınaması
hoşgörülüdür (~4 birim), yoksa ince cihaz parmakla hiç tıklanamaz.

## PANO-30 — Ekran BÖLÜMLERE ayrılır; sekme YEREL durumdur.

Pano ekranı sekiz yığılmış bölümdü ve şemalar yüzünden çok uzundu. Kullanıcı
(08.09.2026): *"pano yerleşimi sayfasına bir üst bar yapalım, sayfa aşağı
doğru gitmesin, daha çok sayfa içinde bölümler olsun. Pano iç yerleşimleri de
ayrı sayfa olsun."*

Beş bölüm: **Özet · Dizilim · Panolar · Denetim · Aygıt kuyruğu**. İç yerleşim
ve kapak görünüşü ayrı sayfadadır: `pano/ic?pano=LVD10`.

**Dinamik segment (`pano/[kod]`) KULLANILMAZ.** İki sebep: pano kodu EPLAN'ın
konum dizesinden gelir (`LVD1.1` noktalı, `LVD10-A` bölünmüş) ve yol parçası
olarak güvenli değildir; ayrıca kullanıcının kaydetmediği ölçü denemeleri
zaten sorguda taşınıyor (PANO-14) ve sayfa değişince kaybolmamalı.
`svg/route.ts` de aynı `?pano=` sözleşmesini kullanıyor.

**SEKME DURUMU ADRESE YAZILMAZ.** `page.tsx` `searchParams` okuyor ve her
sorgu değişikliği sunucu render'ını yeniden koşturur — dört Supabase turu artı
bütün yerleşim araması. Bir sekmeye basmak bir GÖRÜNÜM değişikliğidir; bedeli
yeniden çözüm olmamalı. Deneme ölçüleri ve ölçek adreste kalır, çünkü onlar
gerçekten yeniden çözüm gerektirir.

**KUYRUK GEREKÇESİYLE AYRILIR.** "Panoya girmeyen aygıtlar" beş ayrı şeyi tek
başlık altında topluyordu: gerçekten sahada olan motor (doğru), ölçüsü
bilinmediği için düşen cihaz (gerçek eksik), sınıflanmamış ürün, etiketsiz
satır, ürünsüz satır. Kullanıcı buna bakınca "modül eksik" görüyor, oysa çoğu
doğru davranış — ve gerçek eksik o yığının içinde kayboluyordu.

Ürünsüz satır (tedarikçi, tip ve parça numarası BOŞ) artık kendi kovasındadır:
bu bir hata değil, malzeme listesindeki bir BOŞLUKTUR. Ölçüldü (0026-01):
`-Y64`…`-Y75` fren bobinleri redüktörle geliyor ve elektrik projesinde malzeme
satırı açılmamış; altı satır "Sınıflanmamış" kuyruğunu kirletiyordu.

## PANO-31 — Sürükle-bırak SIRA yazar, pano kodu YAZMAZ.

> **13.09.2026:** bırakılan yer artık `anchor_device_key` + `anchor_side`
> olarak yazılır (PANO-38); `order_in_rail` eski biçimdir.

Şemada bir aygıtı sürüklemek onu bir KOMŞULUĞA taşımaktır (PANO-23). Bırakılan
komşuluk `switchboard_placements` satırına yazılır ve satır `pinned` olur.

**Temel yarım bağlıydı:** `order_in_rail` ve `rail_index` sütunları okunuyordu
(`switchboard-data.ts`), yerleştirici onları dinliyordu (`sirala`, PANO-23) —
ama HİÇBİR KOD ONLARA YAZMIYORDU. Okuyan ve uygulayan taraf vardı, yazan taraf
yoktu.

### `savePlacement` KULLANILMAZ; `movePlacement` ayrı bir eylemdir

`savePlacement`in şemasında `widthMm`/`heightMm`/`depthMm` alanları
`.default(null)` taşıyor. Yalnız sıra göndermek, kullanıcının o aygıta ELLE
yazdığı ölçüyü SİLERDİ. Bir cihazı şemada sağa kaydırmak, ölçüsünü
unutturmamalı.

### PANO KODUNA DOKUNULMAZ — ölçülmüş tuzak

Bölünmüş bir gözün kodu (`LVD0-D`) gerçek bir konum değil, bölücünün ÜRETTİĞİ
bir addır (PANO-10). Onu bir yerleşim düzeltmesi olarak yazmak aygıtı var
olmayan bir panoya taşır.

Ölçüldü (0026-01, 08.09.2026): tek bir sürüklemeden sonra dizide **aynı kodlu
ikinci bir göz** belirdi ve toplam en **2.500 mm'den 2.900 mm'ye** çıktı —
imalatçı fazladan bir gövde keserdi. Aygıtı BAŞKA bir panoya taşımak ayrı bir
iştir ve `savePlacement` üstünden yapılır.

### SIRA ÇİZİM SIRASINDAN TÜRETİLİR

Yerleştirici plaka aygıtlarını `sirala()` sırasıyla tüketiyor ve şemaya ray ray,
soldan sağa basıyor. Yani ÇİZİMDEKİ SIRA, sabitlemenin indekslediği sıranın ta
kendisidir; ikinci bir hesap yazmak ikisini ayrıştırırdı (PANO-29'un aynı
ilkesi). Bölünmüş bir klemens şeridi birden çok dilim üretir; sıra AYGIT
sırasıdır, dilim sırası değil — ilk görüldüğü yer sayılır.

**Off-by-one saf bir işlevde yaşar** (`birakmaIndeksi`): taşınan aygıt listeden
çıkacağı için, hedef indeks onun eski yerinden SONRAYSA bir azaltılmalıdır.
Azaltılmazsa cihaz her sürüklemede bir adım geride kalır ve kullanıcı "tuttu
ama tam oraya gitmedi" diye ikinci kez sürükler. Bir React bileşeninin içinde
yaşasaydı hiç sınanamazdı; mutasyon denemesiyle iki testin de bu hatayı
yakaladığı doğrulandı.

### DOKUNMATİKTE SÜRÜKLEME YOK, ve bu bilinçli

Şema kabı yatay kaydırılıyor (MOBIL-9: diyagramlar küçülmez, kaydırılır).
Parmakla sürüklemeyi yakalamak o kaydırmayı öldürürdü ve 2.500 mm'lik bir
diziyi telefonda sürükleyerek düzenlemek zaten gerçek bir iş akışı değil.
Dokunmatik ve KLAVYE yolu, bilgi baloncuğundaki "öne al / arkaya al"
düğmeleridir — sürükleme tek yol olsaydı klavyeyle hiç erişilemezdi.

### SABİTLEME GERİ ALINABİLİR

`unpinPlacement` sırayı sisteme geri verir; ölçü düzeltmesi varsa DURUR.
Sabitleyip geri alamamak bir tuzaktır: "Yeniden Yerleştir" sabitlenmiş satırı
bilerek KORUR (PANO-14) ve yanlış yere taşınan bir cihazın dönüşü kalmazdı.

### BÖLGE SINIRI AŞILABİLİR

Kullanıcı bir kumanda rölesini giriş bandının ortasına sürükleyebilir.
Yerleştirici bunu ENGELLEMEZ — mühendis kendi panosunu bilir — ama bölge
değişince yeni ray açar (PANO-4) ve sonuç ÇİZİMDE görünür: giriş · kumanda ·
giriş, üç ray. Sessizce reddetmek ya da rayları karıştırmak, ikisi de yanlış
olurdu; denetim yine geçer.

## PANO-32 — Pano şeması EL KİTABINA kendi ucundan girer, DONMUŞ olarak.

İşletme ve Bakım El Kitabı'na pano dizilimi, iç yerleşim ve kapak görünüşü
eklenebilir. Şema `kind: "diagram"` bloğu olarak girer — vektördür, teslim
PDF'inde keskin kalır ve rasterlenmez (KITAP-22).

### AYRI UÇ, AYNI SEÇİCİ

El kitabının şema seçicisi hesap motorunun diyagramlarını `diagrams/select.ts`
defterinden sayar. Pano çizimleri oraya KAYDEDİLMEZ ve bu yazılı bir karardır
(PANO-16): `select.ts` hesap raporunun bölüm şemalarının defteridir ve bir pano
yerleşiminin orada işi yoktur — kaydedilseydi şema hesap sihirbazının bölüm
listesine de girerdi.

Bu yüzden pano şemaları **kendi ucundan** gelir (`semalar/pano`), ama
sözleşmesi kardeşiyle birebir aynıdır (`{key, baslik, modul, bolum}` katalogu +
`{key}` ile model). Aynı seçici bileşeni iki uca birden bakar; iki ayrı seçici
yazmak, birinde düzeltilen bir davranışın ötekinde unutulmasına açık kapı
bırakırdı.

Katalog SAF bir modüldedir (`diagrams/panoKitap.ts`), uç dosyasında değil: uç
`server-only`dir ve içine yazılan bir mantık hiçbir testten geçemezdi.

### DONMUŞ, CANLI DEĞİL — ve bu iki kural ÖRTÜŞÜR

KITAP-22 şemayı ekleme anında çözüp payload'a yazmayı şart koşar. Burada o
kural PANO-14 ile tam örtüşür: pano planı zaten saklanmıyor, her açılışta
yeniden hesaplanıyor. Canlı bir bağ kurulsaydı teslim edilmiş bir kılavuz,
elektrik projesi yeniden okunduğunda (ELEKTRIK-6: satırlar silinip yeniden
üretilir) sessizce başka bir panoyu anlatırdı.

### LİSTEDE GÖRÜNEN HER ŞEMA ÇİZİLEBİLMELİ

Boş bir dizinin dizilim şeması, kapak elemanı olmayan bir panonun kapak
görünüşü ve yerleşimi olmayan bir gövdenin iç görünüşü listeye HİÇ girmez.
Seçilebilir görünüp boş dönen bir satır, hiç göstermemekten kötüdür.

### KİTAP ÖLÇEĞİ 1:4

Kılavuzu okuyan bakımcı panonun tamamını bir sayfada görmek ister. 1:5'e
düşürmek de bir seçenekti ve REDDEDİLDİ: o ölçekte cihazların etiketi düşer
(PANO-28) ve okuyan hangi cihazın nerede olduğunu göremezdi.

### GENİŞLİK YÜZDESİ SUNUCUDA HESAPLANIR — ölçülmüş taşma

`pdf/diagram.tsx`in başındaki uyarı bir hatayı anlatıyor: uzun bir çizime
yalnız genişlik verilirse `wrap={false}` onu bir sonraki sayfaya iter ve orada
da taşar. Görsel bloklar bunu bugüne kadar yaşamadı çünkü hesap şemaları geniş
ve alçaktır.

**Pano şemaları değil.** Ölçüldü (08.09.2026): 2.000 mm'lik dar bir panonun
kapak görünüşü 1:4'te tam genişlikte **706 pt** yer istiyor, el kitabı gövdesi
ise **698 pt** — sekiz punto taşıyordu ve kimse fark etmezdi.

Bu yüzden şema eklenirken `semaGenisligiYuzdesi` oranı sığdıran en büyük
yüzdeyi hesaplar (o çizimde %95) ve blok o yüzdeyle kurulur. Sığan şema
GEREKSİZ KÜÇÜLTÜLMEZ: dizilim şeması geniş ve alçaktır, %100 kalır. Hesap
gerçek yerleşim ölçücüsünü (`blokOlcusu`) kullanan bir testle çivilenmiştir —
altyazı ve görsel payı da yüksekliğe girer ve ikinci bir formül yazmak ikisini
ayrıştırırdı.

## PANO-33 — Saha kutusu KENDİ ızgarasını ve KENDİ ölçüsünü alır.

Kullanıcının verdiği saha ızgarası (09.09.2026): yükseklik **300 · 400 · 500 ·
600 · 700 · 800 · 900 · 1000 · 1200 · 1400**, en **400 · 500 · 600 · 700 ·
800**, derinlik **200 · 250 · 300 · 350 · 400**. Odanınkiyle ortak yalnız en
tarafıdır; 350 mm derinlik yalnız sahada, 1600/1800/2000 yalnız odada vardır.

`LineupGrid` bunu taşır (`sizes.ts`) ve `solveLineup`a GİRDİDİR — çözücü hangi
diziyi çözdüğünü bilmez, çağıran ızgarayı da tercihi de birlikte verir
(`SolveAllInput.prefs` ile aynı gerekçe).

**ORTAK YÜKSEKLİK YALNIZ ODADADIR.** PANO-2 dizideki gözlerin ortak boy ve
ortak derinlik paylaşmasını istiyordu; gerekçesi yan yana dizilen gövdelerin
üst hizasıdır. Saha kutuları dizi DEĞİLDİR: her biri ayrı bir duvara, ayağa ya
da makinenin üstüne asılır ve hizalanacak bir komşusu yoktur. Ölçüldü
(09.09.2026): ortak boy dayatıldığı için bütün saha kutuları odanın EN KÜÇÜK
boyunu, 1400 mm'yi alıyordu ve %18…%53 doluydu — 0019'un `TBW`sinde 1250 mm'lik
plakada 220 mm ray vardı. `sharedHeight: false` iken her pano TEK GÖZLÜ BİR
DİZİ olarak çözülür ve sonuçlar birleştirilir; ayrı bir arama kodu yazılmaz,
bölme/harfleme/kilit/denetim olduğu gibi çalışır.

**ORTAK DERİNLİK HER İKİ DİZİDE DE KORUNUR.** Kullanıcıya sorulan yalnız
yükseklikti; derinlik kablo kanalı ve montaj plakası siparişini bağlar.

**1800 EŞİĞİ YALNIZ ODANINDIR** (`preferredHeightMm`). O eşik "küçük iş küçük
gövde alsın ama sıkışan iş tıkıştırılmasın" kuralıydı (PANO-9) ve 300 mm'lik
bir klemens kutusunda karşılığı yoktur.

**TEK KUTUDA ÖLÇÜT ALANDIR, BOY DEĞİL.** Diziyi çözerken önce boy küçültülür,
çünkü boy bütün gözlerde ortaktır ve her göz ondan pay alır. Tek kutuda böyle
bir ortaklık yoktur ve "önce en alçağı" ölçütü ölçüldüğü gibi ters teper:
0019'un `TB3`ü 500 mm boy uğruna 800 mm'ye genişliyordu (0,40 m²), oysa
400 × 600 (0,24 m²) aynı üç cihazı alıyor ve duvara asılan bir kutuda asıl
sıkıntı olan GENİŞLİK yarıya iniyor. Bu yüzden ortak boy yokken bütün boylar
denenir ve ÖN YÜZ ALANI en küçük olan seçilir; eşitlikte alçak olan kazanır.

**TEK KUTUDA KİLİT TABAN DEĞİL KİLİTTİR.** Dizide bir panonun kilitlediği boy
ancak "bundan alçak olamaz" diyebilir, çünkü gözler aynı boyu paylaşmak
zorundadır. Ortak boy yokken böyle bir zorunluluk yoktur: kullanıcı o kutuyu
600 mm istediyse 600 mm alır.

**ÇİZİM DE BUNU BİLİR.** Dizilim şeması `panels[0].heightMm` okuyordu ve beş
kutunun beşini de birincinin boyunda çiziyordu. Gözler artık ORTAK ZEMİNE —
bazanın üstüne — oturur, üst hizaları serbesttir; her gözün kendi boyu en
ölçüsünün altına yazılır ve dikey ölçü zinciri "en yüksek" der. Baza kullanıcı
kararıyla sahada da vardır ("oda gibi baza olsun", 09.09.2026).

**EKRAN VE PDF "KUTU BAŞINA" YAZAR.** `LineupSize.sharedHeight` false iken
`heightMm` en yüksek gözünkidir ve tek başına bir sipariş kararı DEĞİLDİR;
"ortak yükseklik 800 mm" yazmak, alınmamış bir kararı bildirmek olurdu.

**AYAR EKRANINDAKİ SEÇENEK LİSTESİ DE DİZİYE GÖREDİR.** Odanın ızgarasını saha
kutusuna göstermek, sipariş edilemeyecek bir ölçüyü seçtirirdi. Adresten gelen
ızgara dışı değer sessizce yok sayılır; `savePanel` ise İKİ IZGARANIN
BİRLEŞİMİNE bakar, çünkü o eylem panonun oda mı saha mı olduğunu bilmez ve işi
yalnız hiçbir imalatçının kesmediği bir ara ölçüyü reddetmektir.

## PANO-34 — Ayar ONAYDAN BAĞIMSIZ saklanır; onay yine parmak izine bağlıdır.

Yükseklik/derinlik/baza seçimi 09.09.2026'ya kadar yalnız İKİ yerde yaşıyordu:
adres çubuğunda (deneme) ve `switchboard_approvals.settings` içinde. Yani "2000
mm istiyorum ama henüz onaylamıyorum" demek mümkün değildi — kullanıcı bir ölçü
seçip sayfayı yeniliyor ve seçimi sessizce kayboluyordu.

`switchboard_settings` bu boşluğu kapatır. **Ayarı kaydetmek ONAYLAMAK
DEĞİLDİR.** Ayar girdinin parçası olduğu için kaydedilen ayar parmak izini
değiştirir ve varsa onay kendiliğinden eskir (PANO-14) — istenen davranış
budur: gövde ölçüsü değişmiş bir planı eski onayla imalata göndermek, bu modülün
baştan beri engellediği şeydir.

**AYAR ÜÇ KATMANDIR**, en güçlüsü üstte:

1. **Adresteki deneme** — kaydedilmemiş, paylaşılabilir, yenilemede kaybolur.
2. **Kaydedilmiş ayar** (`switchboard_settings`) — onaydan bağımsız yaşar.
3. **Onay anındaki ayar** — yalnız ESKİ projeler için yedek; onay tablosu
   08.09.2026 öncesinde tek kalıcı yerdi ve o satırlar kaybolmamalı.

Kaydet düğmesi HER ZAMAN durur, yalnız adreste deneme varken değil: bir seçimi
"Otomatik"e geri çevirip kaydetmek de bir karardır.

**PLAN YİNE SAKLANMAZ.** Burada duran şey plan değil, kullanıcının SİPARİŞ
TERCİHİDİR — girdi sınıfındandır, çıktı değil.

## PANO-35 — Kart, belge okunur okunmaz PANO ÖZETİNİ gösterir.

Brief "sistem her elektrik projesi yüklemesinden sonra yerleşimi çalıştırsın"
diyor. Plan SAKLANMADIĞI için (PANO-14) "çalıştırmak" kalıcı bir şey üretmez;
kullanıcının gerçekten istediği HABERDAR OLMAKTIR. Elektrik Projesi kartı tek
satırlık bir özet basar: kaç oda + kaç saha panosu, oda dizisinin toplam eni,
ölçüsü doğrulanmamış aygıt sayısı, yerleşemeyen aygıt sayısı, düşen denetim
sayısı. Sorun varsa satır kehribar olur ve pano sayfasına bağlanır.

**ÖZET AYNI SAF ÇEKİRDEKTEN GELİR** (`computeSwitchboardLayout`) ve GERÇEK ölçü
defteriyle hesaplanır. İkinci bir "hızlı hesap" yazmak kartla sayfanın
ayrışmasının en kısa yoludur (değişmez md. 8); defter olmadan hesaplamak ise
"ölçüsüz 0 aygıt" derdi ve olmayan bir güveni bildirirdi (değişmez md. 4).

**"EKSİK" DAR TANIMLIDIR:** `olcusuz` + `sigmadi` + `siniflanmamis`. `saha` bir
eksik değil bir KARARDIR (pano dışı ekipman), `urunsuz` ise malzeme listesinin
boşluğudur; ikisini de kırmızı saymak gerçek eksiği gölgelerdi (PANO-10).

## PANO-36 — MODELLENMEYENLER: bu modülün HESAPLAMADIĞI şeyler.

Bir kural defterinin en tehlikeli boşluğu, yokluğu YAZILMAMIŞ olandır. Bu
modülü okuyan biri bugüne kadar panonun ağırlığının hesaplanmadığını hiçbir
yerden öğrenemiyordu. Aşağıdakiler BİLEREK kapsam dışıdır ve bir gün
isteniyorsa AYRI birer iştir:

- **Ağırlık** — ne gövde sacı, ne cihazlar, ne toplam. Kaldırma ve taşıma
  hesabı yapılamaz.
- **Bara ve bara hücresi** — ana bara kesiti, mesnet aralığı, kısa devre
  kuvveti, bara hücresi ayrımı. Bugün ana şalter yalnız bir kutudur.
- **IP koruma sınıfı** — oda panosu ile duvara asılan saha kutusunun IP'si
  gerçekte farklıdır; hiçbiri seçilmiyor.
- **Klemens numaralandırma ve klemens planı** — klemensler yerleşiyor ama
  numaralanmıyor; imalatçıya giden bir klemens planı yok.
- **Kablo giriş detayı** — rakor tipi/çapı/adedi, giriş sacı, bükülme yarıçapı.
  Baza yalnız "kablo girişi buradandır" diye çiziliyor.
- **Topraklama** — topraklama barası, kapak topraklama örgüsü, PE kesiti.
- **Havalandırma ve ısı yükü** — cihazların kaybı, fan/filtre seçimi, iç
  sıcaklık. `defaultClearanceMm` bir ısı hesabı DEĞİLDİR.
- **Kaldırma kulakları · pano birleştirme donanımı · etiket/gravür listesi.**
- **Kapak kesim koordinatları** — kapak yerleşimi 90 mm'lik bir KROKİ
  ızgarasıdır (PANO-22) ve çizim bunu kendi altyazısında söyler. Sığmayan aygıt
  ARTIK SESSİZCE DÜŞMÜYOR: `sigmadi` kuyruğuna girer ve panonun kendi uyarısına
  yazılır (PANO-10).

Bir de dürüstlük notu: **bütün pay değerleri uygulamanın kendi seçimidir**
(`railDuctMm 60`, `defaultClearanceMm 100`, `backGapMm 40`, `plateSideMm 30`,
`edgeGapMm 25`, `familyGapMm 10`, `fillWarnRatio 0,8` …). Bir standarttan
gelmiyorlar; `sizes.ts` bunu söylüyor ama defter söylemiyordu. Hepsinin
ekrandan görülebilir ve düzeltilebilir olmasının sebebi budur.

## PANO-37 — DOKUZ MADDELİK YERLEŞİM TURU (kullanıcı, 09.09.2026)

Kullanıcı uygulamadan bir pano şemasına baktı ve dokuz madde yazdı. Hepsi
ölçülebilir birer kusura denk düşüyordu; hepsinin gerekçesi burada.

### 1 · Trafo pano ZEMİNİNE oturur, yerleşime girmez

*"Trafo pano içerisinde yere konuyor, bundan dolayı pano yerleşiminde
gösterilmesin."* Yeni bir montaj tipi açıldı: **`zemin`**. `govde` kovasına
atılmadı çünkü o kova "gövde gereci"dir (pano lambası, fan, etiket) — 4 kVA'lık
bir kontrol trafosunu aksesuar gibi listelemek panoyu kuran kişiye yanlış bir
şey söylerdi. **Reaktör, şok bobini ve şebeke filtresi `plaka` olarak KALIR**;
zemine konan yalnız trafodur.

### 2 · Klemensler görünmüyordu — çünkü PLAKANIN DIŞINA taşmışlardı

Klemensler her zaman yerleştiriliyordu (0019'un `LVD10`unda 220 adet), ama ray
yığını montaj plakasının kapasitesini aşınca çizim onları plakanın ALTINA
basıyordu. Sebep 5. maddedir; giderilmesi de oradadır.

### 3 · Sürücüler EN ÜSTTE

`ZONE_ORDER` `giris`ten değil `guc`tan başlar. PANO-7'nin ilk gerekçesi "kalın
besleme iletkeni kısalsın"dı; kullanıcının gerekçesi de fizikseldir: sürücü
panonun en derin, en ağır ve en çok ısıtan cihazıdır — üstte durunca soğutma
havası üstünden çıkar ve altındaki bütün motor/kumanda bandına kablosu kısa
yoldan iner.

### 4 · Telsiz kumanda panonun DIŞINDA

*"Radio Control Receiver-Transmitter pano dışında olur, içerisine
yerleştirme."* Ölçüldü: 0026'nın `LVD0`sunda `ELFATEK ESX_MID 602`
(170 × 320 × 120 mm) montaj plakasında yer kaplıyordu. Alıcı direğe ya da
kabine, verici operatörün eline gider.

**İŞARET DAR TUTULUR** (PANO-25): çıplak `REMOTE` ya da `RECEIVER` yazılamaz —
0019'daki "REMOTE SWITCH 1S AC230V 16A" (`5TT4101-0`) bir darbe akım rölesidir
ve panoda kalmalıdır.

### 5 · BÖLGE ARTIK RAY AÇMAZ — mümkün olduğunca sıkı

*"Gruplandırmaya gerek yok, yan yana koyulabilir; mümkün olduğunca sığdırmaya
çalışacağız."*

İlk sürüm bölge değişince yeni ray açıyordu ("bir ray tek işleve aittir"). Beş
bölge beş ray demekti ve her rayın sağında metrelerce boşluk kalıyordu; bir
bölgede tek cihaz varsa o cihaz 1010 mm'lik bir rayı tek başına işgal ediyordu.
Yığın plakayı aşınca da klemensler dışarı taşıyordu (2. madde).

Bugün:

- **Bölge sırası KORUNUR** — cihazlar hâlâ güç → giriş → motor → kumanda →
  klemens sırasında dizilir; o sıra bir RAY SINIRI değildir.
- **DIN ile PLAKA ayrı kalır.** Bu bir gruplama değil FİZİKTİR: raya oturan
  cihaz 35 mm'lik profilin üstündedir, plakaya vidalanan cihaz plakanın
  kendisindedir.
- **İLK SIĞAN RAY (first-fit).** Cihaz o anki rayın sonuna sığmıyorsa ÖNCEKİ
  raylara bakılır. Koşul dardır: cihaz ancak o rayın MEVCUT yüksekliğini
  büyütmüyorsa oraya konur — büyütseydi altındaki bütün rayların yeri kayardı
  ve kullanıcının gördüğü sıra her yerleştirmede zıplardı.
- **İKİ GEÇİŞ.** Önce cihazlar raylara dağıtılır, sonra ray yükseklikleri ve y
  konumları hesaplanır. Tek geçişte yapılamaz: bir raya sonradan cihaz
  eklenebildiği için rayın yüksekliği ancak dağıtım bittiğinde kesinleşir.

**ÖLÇÜLDÜ (09.09.2026):**

| | Önce | Sonra |
|---|---|---|
| 0026 `LVD0` | 4 göz · **2.600 mm** | 2 göz · **1.700 mm** |
| 0019 oda dizisi | 22 göz · **12.000 mm** | 19 göz · **11.100 mm** |
| Plakadan taşan pano | vardı | **yok** |

`LVD1.1`, `LVD1.2` ve `LVD2` artık bölünmüyor.

### 6 · Kapak yerleşimi ÇİZİLMEZ

*"Kapak görünüşü olmasına gerek yok; kapak üzerinde veya pano içerisinde priz,
aydınlatma, buton vs ekipmanlar yerleşimde olmaz ve kapakta da görünmesine
gerek yok."*

`kapagaDiz` ve `panoKapakDiagram` KALDIRILDI; `doorPlacements` her zaman boştur
(alan tipte duruyor, bir gün geri istenirse bütün tüketiciler boş listeyi zaten
doğru karşılıyor). `doorGapMm` ayarı da yerinde: kapak derinliği artık gövde
derinliğine girmiyor ve bu 0019'un saha kutularını 250 → 200 mm'ye indirdi.

**SINIFLANDIRMA KORUNUR.** `kapak` montaj tipi hâlâ atanıyor çünkü cihazın
kapağa takıldığı DOĞRU bir bilgidir; cihaz `bodyDevices` listesinde "Kapak
(çizilmez)" etiketiyle görünür. Denetim de yön değiştirdi: "kapağa yerleşti mi"
değil, **"listede duruyor mu"** (PANO-10 — bir aygıt sessizce kaybolamaz).

### 7 · Dizilim başlığı ve pano yanı

Başlık *"Elektrik odası pano dizilimi"* → **"Pano dizilimi"**.

*"Pano yanı ekipmanlarından sadece direnç gösterilsin; aydınlatma ve diğer saha
ekipmanlara gerek yok."* 08.09.2026'daki karar tersine döndü:

| | 08.09 | 09.09 |
|---|---|---|
| Fren direnci | `saha` | **`yan`** |
| Siren · korna · ikaz kolonu · projektör | `yan` | **`saha`** |

Gerekçe somut: 75 kW'lık bir direnç kafesi elektrik odasında panonun bitişiğinde
gerçekten yer kaplar ve yerleşimi planlayan kişi onu görmelidir; siren ve
projektör ise vincin üstündedir. Ölçüldü: yan şerit bir siren, dört projektör
ve üç ikaz kolonuyla doluyor ve asıl bakılacak şeyi — dizinin kendisini —
bastırıyordu. **Kaybolmazlar:** `saha` kuyruğunda sebebiyle görünürler.

### 8 · Taşma GÖRÜNÜR OLDU

*"Bazı şeyler dışarda duruyor ama panoya sığmış gibi görünüyor."* Kök sebep 5.
maddeydi ve giderildi; ama çizim de artık susmuyor: ray yığını plakanın
kapasitesini aşarsa **plaka sınırı** kesikli bir çizgiyle basılır, taşan raylar
uyarı renginde çerçevelenir ve altyazı *"sınırın altındaki raylar bu gövdeye
sığmıyor"* der.

### 9 · Dikey kanal TEK ve HEP SOLDA

*"Kablo geçişlerinde dikey olanlar ya sağda ya solda olur; tek tarafta olsun,
seçime gerek yok, hep solda olsun."* `sideDuctCount` kaldırıldı, yerine sabit
`SIDE_DUCT_COUNT = 1`. Eski kural plaka eni 500 mm'yi aşınca İKİ kanal açıyordu
ve geniş gövdede raydan 40 mm'yi sessizce yiyordu.

### DEFTERDEKİ MONTAJ TİPİ KURALI EZER — ve bu bir tuzaktır

Montaj tipi iki kaynaktan gelebilir ve sıra şudur (`panels.ts`):

```
override?.mountType ?? model?.mountType ?? kural.mountType
```

Defter kuralı EZER ve bu bilinçlidir: defter, o ürün için ÖLÇÜLMÜŞ bir beyandır.
Ama sonucu şudur — **sınıflandırma kuralı değiştiğinde defterdeki eski satır
sessizce kazanır.** 09.09.2026'da tam bu oldu: kural değişti, ekranda hiçbir şey
değişmedi. Beş ikaz/aydınlatma ürünü, trafo ve telsiz kumanda bir migration ile
düzeltildi (`20260909000011`). **Bir sınıflandırma kuralını değiştiren herkes
`electrical_device_models.mount_type` sütununa da bakmak zorundadır.**

## PANO-38 — Sıra bir KOMŞULUKTUR, indeks değil; tür sınırı aşılmaz.

Sabitleme `anchor_device_key` + `anchor_side` (`once` / `sonra`) taşır: "U30,
U20'nin sonrasına". Komşu anahtarı ekranda ve çözücüde AYNI anlama gelir;
hiçbir listeyi saymaz.

**Ölçülmüş kusur (0026-01, 12.09.2026):** ekran sırayı ÇİZİM sırasından,
çözücü `sirala()` sırasından türetiyordu. PANO-37 md. 5'in first-fit'i
cihazları önceki raylara taşıdığı gün iki liste ayrıştı. Kullanıcı sürücüyü bir
şalterin yanına bıraktı; yazılan 15. indeks çözücüde giriş şalterlerinin
ortasıydı, orada yeni bir plaka rayı açıldı (806 mm), pano 2313/1250 mm ile
taştı. Aynı gün canlıda `T14` ve `U30` ikisi de indeks 15'i istiyordu.

Uygulama (`layout/sirala.ts`):
- Türetilmiş sıra (bölge → ana şalter → renk → doğal kod) kurulur. **Bölgesi
  boş aygıt `kumanda` sayılır**; `indexOf(null) = -1` onu en öne alıyordu ve
  0026'da bölgesiz bir termostat (`S162`) ilk DIN rayını panonun EN ÜSTÜNDE
  açıyordu — "sürücüler en üstte" fiilen bozuktu.
- Eski biçim (`order_in_rail`) okunur ama KENDİ TÜRÜNÜN listesinde sayılır:
  plaka sürücüsü DIN şalterlerinin arasına düşemez.
- Komşuya bağlı sabitlemeler doğal kod sırasıyla, üç geçişte uygulanır
  (zincirler için). Komşusu panoda olmayan ya da FARKLI TÜRDEN (DIN ↔ plaka)
  olan sabitleme UYGULANMAZ ve panonun `warnings` listesine
  "`X` sabitlemesi uygulanamadı: …" yazılır; Kararlar bölümü aynı satırda
  gösterir.
- Sabitlenmiş aygıt geriye (önceki rayların boşluğuna) bakmaz: komşusunun
  yanına yazıldı, oradan kaçmamalı.
- Çözücü nihai sırayı `PanelLayout.order` olarak verir; ekran sürükleme
  hedefini BU listeden okur (`birakmaHedefi`, saf).

Eylem: `movePlacement` komşu + yön alır, `order_in_rail`i sıfırlar; DIN ↔
plaka bırakma ekranda `toast` ile reddedilir (kullanıcı kararı S3, Plan). Tip
değişikliği aygıt formundan yapılır. Migration `20260913043000_switchboard_anchor`.

## PANO-39 — SÜTUNLU YERLEŞİM: uzun plaka cihazının yanındaki cep DIN rayı alır.

Plaka, tam enli BANTLARIN dikey yığınıdır. Plaka bandında cihazlar BOYCA
BÜYÜKTEN KÜÇÜĞE sola dizilir; en uzun cihazın yanında, kısa cihazların üstünde
kalan dikdörtgen bir CEPtir ve o cebe DIN rayları açılır. Ray yine yataydır
(PANO-4 korunur), yalnız eni cebin enidir; solunda `columnGapMm` (öntanım
50 mm) sütun payı vardır — kablo iniş yolu ve soğuma. Bandın sağında kalan boş
en de bir ceptir.

**Ölçüldü (0026-01):** 922 mm'lik 90 kW sürücü tam enli bir satır açıyordu;
yanındaki üç 546 mm'lik sürücünün altında 0,28 m² ölü alan kalıyordu ve bütün
kumanda rayları o boşluğa sığarken pano ikiye bölünüp fazladan 400 mm göz
açılıyordu.

| 0026-01 oda dizisi | Önce | Sonra |
|---|---|---|
| Göz | 2 (1200 + 400) | **1 (1200 × 1800)** |
| Ölü alan | 1,05 m² | **0,71 m²** |
| Denetim | geçti | geçti |

| 0019-00 (gerileme) | Önce | Sonra |
|---|---|---|
| Oda dizisi | 19 göz · 11.100 mm | 19 göz · **11.000 mm** |
| Saha dizisi | 5 göz · 2.100 mm | 5 göz · 2.100 mm |

Kurallar (`layout/paketle.ts`):
- **Önce plaka, sonra DIN.** Sütunlu kipte plaka cihazlarının tamamı önce
  bantlara dağıtılır; cebin geometrisi bandın cihazlarından türer. İlk deneme
  bandı "donduruyordu" ve ana şalter `Q12`, `F14`ten sonra sıralandığı için
  panonun dibinde yeni bant açıyordu.
- **Plaka cihazı en az BÜYÜYEN banda gider** (önce büyütmeyen, yoksa en az
  büyüten). DIN cihazı için eski kural durur: etkin ray, sonra geriye
  büyütmeyen ray, sonra cep, sonra tam enli yeni ray.
- Cep rayı `minRailMm` (200 mm) altında açılmaz; cebin dibini aşacak büyüme
  reddedilir ve yeni ray açılır.
- `Rail.xMm` ve `Rail.pocketOf` çizim ve denetim için taşınır; `Rail.zone`
  raydaki BASKIN bölgedir (en çok en kaplayan).
- **Anahtar:** `columnsEnabled` (öntanım açık). Kapalıyken eski raf modeli
  bit-aynı çalışır — gerileme bu anahtarla ölçülür (`sutun.test.ts`).
- **Denetçi 2B'dir:** herhangi iki cihaz kesişemez (aynı ray şartı kalktı);
  raylar birbirine binemez, ama cep rayı kendi bandının dikdörtgeniyle
  kesişir — bu tasarımdır ve `pocketOf` ile muaf tutulur. Yığın yüksekliği
  toplam değil EN ALT rayın alt kenarıdır.
- Kuyruğa düşen aygıt (ölçüsüz, sığmadı) eksiksizlik denetiminin beklenen
  kümesine GİRMEZ: sessizce kayıp değildir, sebebiyle listededir. Eskiden
  her ölçüsüz cihaz denetimi kırmızıya boyuyordu.

## PANO-40 — Kararlar GÖRÜNÜR ve geri alınabilir; uykuda karar silinir.

Kullanıcının verdiği her şey tek listede durur (ana sayfa 3. bölüm): pano
kararları (tür/kilit/kapak), aygıt kararları (sabitleme, düzeltme, ölçü), ölçü
tercihleri. Her satırın "Kaldır"ı vardır (`removePanelDecision`,
`removePlacementDecision`). "Yeniden Yerleştir" buradadır ve kaç serbest
düzeltmeyi sileceğini yazar; kilit ve sabitlemeleri korur.

**Ölçüldü (0026, 12.09.2026):** canlıda `LVD0` 1200 kilidi, `LVD0-A`/`LVD0-B`
1000 kilitleri ve iki sabitleme vardı; hiçbir ekran bunları bir arada
göstermiyordu. Taşan panonun sebebi kullanıcının kendi kararlarıydı ve
kullanıcı bunu göremiyordu. `LVD0-A`/`-B` bölünmüş gözün ESKİ kodlarıydı —
bugünkü dizide karşılığı yok ama LVD0 kilidi kalkınca 1000+1000 dayatacaktı.
Böyle karar **uykuda** rozetiyle listelenir (bölünmüş gözün kapağı seçilebilir
diye yazılması serbest, Plan S2) ve buradan silinir.

Uyarılar da görünürdür: her bölümün üstündeki şerit (`uyarilariTuret`, saf)
taşan panoyu, kilitli-sığmayan panoyu, ölçüsüz/tahmin cihazı, uygulanamayan
sabitlemeyi ve eskimiş onayı açık metinle yazar ve ilgili bölüme götürür.
Pano kartında uyarı AÇIK METİNDİR; `title` ipucu bir uyarı yeri değildir.

Ekran dört bölümdür ve bir İŞ AKIŞIDIR: **1 · Girdi** (belge, ölçü defteri
eksikleri, tanınmayan ürün) → **2 · Panolar** (dizilim, kartlar, ölçü
tercihleri) → **3 · Kararlar** → **4 · Onay ve çıktı** (denetim — geçenler
dahil —, panoya girmeyenler, SVG/PDF, onay ve değişiklik izi). "Aygıt
kuyruğu" adı kalktı: sorun kovaları Girdi'de, beklenen kovalar (saha,
ürünsüz) Onay'da. "Parmak izi" ekranda "değişiklik izi"dir.

## PANO-41 — Kilitli en sığmıyorsa EN BÜYÜK boy seçilir, pano bölünmez.

Kilitli en bir karardır ve sistem onu ezmez (PANO-9); kilitli pano bölünmez
(kullanıcı kararı S1). Hiçbir boyda sığmıyorsa `yukseklikSec` "daha az pano
bırakan" kıyasında EŞİTLİKTE BÜYÜK boyu tutar. Eski `<` kıyası ilk adayı
(1400) tutuyordu; ölçüldü (0026): 2000'de 1760/1850 ile sığan pano ekranda
1400'de 2313/1250 taşıyor görünüyordu. Uyarı şeridi "kilidi kaldır ya da
daha yüksek gövde seç" der ve Kararlar bölümüne götürür.

## ÖLÇÜM — gerçek iki iş (08.09.2026)

Modülün var oluş sebebi iki işte birden ölçüldü. Sayılar
`npx tsx scripts/test-switchboard-layout.ts .tmp/electrical-parts-all.json --is <no> --defter .tmp/device-models.json`
çıktısındandır.

### 0026-01 — 100 T tavan vinci · 144 malzeme satırı · 54 benzersiz ürün

| | Sözlük ve defter ÖNCESİ | SONRASI |
|---|---|---|
| Oda dizisi | 1 göz · **500 × 1600 × 300** mm | 4 göz · toplam **2.600** mm · **1800 × 400** |
| Saha dizisi | 1 göz · 400 × 1400 × 200 | değişmedi (artık AYRI çözülüyor) |
| Sınıflanmamış ürün | 22 / 54 (%41) | **0** |
| Kuyruk | 50 | **27** (21 saha · 6 ürünsüz · **0 gerçek eksik**) |
| Ölçüsü doğrulanmamış aygıt | 38 | **1** |
| Denetim | 1 / 4 başarısız | **0 / 7 başarısız** |

Derinliği belirleyen kalem 90 kW'lık `ATV930D90N4`: **325,5 mm** derinlik +
40 mm arka pay + 20 mm kapak payı = 385,5 mm, yani 300 mm gövde YETMİYOR.
Eni belirleyen üç kalem: aynı sürücünün 290 mm eni (400 mm gövdeye sığmaz),
`LC1G185KUEN` TeSys Giga kontaktörünün **107,7 mm**'si (tahmin 45 mm diyordu)
ve 23 adet RXG2 röle takımının **15,8 mm**'si (tahmin 6,2 mm diyordu — tek
başına 220 mm ray farkı).

**Eski sayılarla sipariş edilseydi 500 mm'lik bir gövde alınacaktı; iş 2.500
mm istiyor.**

Ölçüsü hâlâ bilinmeyen tek ürün EAE'nin pano armatürü (`51041`): üreticinin
2022 ve 2025 baskıları, canlı ürün sayfası ve doküman veritabanının tamamı
tarandı; kesit ölçüsü hiçbirinde yok. Karşıt kanıt da toplandı — aynı sayfadaki
komşu ürünün ölçülü çizimi VAR, yani EAE ölçüsü olan ürüne çizim koyuyor.
Uydurulmadı (değişmez md. 4) ve gövde gereci olduğu için panonun ölçüsünü
etkilemiyor.

Üç ürün ikinci turda kapandı ve ikisi ölçülmüş bir yanlışı düzeltti:
`OCS-CU01` (**83 × 110 × 44** mm) üreticinin canlı sitesinde 404 veren ama
arşivde duran kendi broşüründen çıktı ve **TBM panosunun 96 × 96 varsayımını
çürüttü**; `BC1-1403-7420`in flanşı **85 × 85** (kare) çıktı ve önceki turun
"kare değil" ölçümü, föydeki çizimin düşeyde %14 gerilmiş olduğu gösterilerek
düzeltildi.

### 0019-00 — 185/40 T şarj vinci · 1.107 malzeme satırı · 184 benzersiz ürün

| | Değer |
|---|---|
| Oda dizisi | 22 göz · **2000 × 600** mm |
| Saha dizisi | 5 göz · **1400 × 250** mm (artık odadan BAĞIMSIZ) |
| Sınıflanmamış ürün | 1 (yalnız ürünsüz satırlar) |
| Kuyruk | 512 — **494'ü gerçekten saha** (motor, kablo, enkoder, PT100) |

0019 bu turda bir GERİLEME KORUMASI olarak kullanıldı: sözlük 0026 için
genişletilirken 0019'un dağılımı satır satır karşılaştırıldı ve değişmedi. Tek
denenen ve GERİ ALINAN ek `STAY PUT` oldu — 0019'un `XB4BD21` kapak seçici
şalteri de "2-position stay put" diyor ve o terim mandallı/yaylı ayrımıdır,
sınır şalteri işareti değil (PANO-25).


## Mobil ve tablet alt erişimi — Plan 013

12.09.2026 kullanıcı onayıyla bu alan ortak alt barı kullanır: **Özet · Dizilim · Panolar · İç Yerleşim · Diğer; iç yerleşimde Panolar · Yerleşim · Denetim · Diğer**.
Önceki mobil üst ızgara/yan ray kapsam notları için güncel kural
`arayuz.md` MOBIL-35’tir. Masaüstü düzeni korunur; yerel durum, mevcut yetkiler
ve kayıt yolları aynı kalır. Kontrol kanıtları Plan 013’te tutulur.
