# Üretici katalogları ve katalog sayfaları

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/katalog.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/catalog-mapping.ts` · `src/lib/catalog-sheets.ts` · `src/lib/catalog-sheets/**` · `src/lib/equipment-attachments.ts` · `src/app/(app)/katalog/**` · `src/app/api/catalog-sheet/**` · `src/components/catalog-*.tsx` · `scripts/catalog-sheets.py` · `scripts/seed-catalog.ts`

## KATALOG-13 — Katalog ürünü kullanım grubuna bağlıdır.

Bir redüktör ya kaldırma ya
yürütme tahrikidir; `cat_equipment.attrs.application` (`kaldirma` |
`yurutme`) bunu taşır. Bölümün katalog eşlemesindeki
`lockedFacets` seçiciyi o gruba KİLİTLER (sunucu tarafında
`attrs->>application`): 2.3 kaldırma redüktörü yürütme ürünü, 5.5 yürütme
redüktörü kaldırma ürünü göstermez. Kilitli süzgeç adım listesinden çıkar,
başlıkta rozet olur; kullanıcı değiştiremez.

Katalog verisi `catalog_data/*.json` → `scripts/seed-catalog.ts` →
migration yolunu izler. **Uygulanmış bir seed migration'ı düzenlenmez**;
`--kinds <tür> --out <yeni_dosya>` ile o türü silip yeniden yazan bir
yenileme migration'ı üretilir. YILMAZ redüktör kataloglarının PDF'ten
çıkarımı `scripts/catalog-extract/` altındadır (yöntem ve doğrulama durumu
kendi README'sinde).

**Eşleme sessizce eksik doldurur:** `applyCatalogPick` katalogda karşılığı
olmayan alanı atlar ve eski değer kalır. Engelleyici bir kontrolü besleyen
alan (ör. `gearboxAllowedRadialKn`) bu yüzden koruma testine bağlıdır —
`src/lib/__tests__/catalog-mapping.test.ts`.

**KATALOG DEĞERİ ALANIN TİPİNE ZORLANIR — ham `attrs` değeri yazılmaz.**
`cat_equipment.attrs` serbest biçimli JSONB'dir; aynı nitelik bir üründe sayı,
başkasında dize olabilir. `applyCatalogPick` bu yüzden bölümün SEÇİM
ızgarasının alan tanımlarını da alır (`targetFields` — editör
`section.selectionDefs`i geçirir) ve değeri alanın beyan ettiği tipe çevirir:
`type: "number"` ya da `numeric: true` → sayı, aksi hâlde dize. Elle giriş yolu
bu zorlamayı zaten yapıyordu (`def.numeric ? parseFloat(...) : raw`); katalog
yolu yapmıyordu ve **iki yol aynı alana farklı tipte yazıyordu**.

Ölçülen sonuç (kullanıcı bildirimi 18.08.2026, 0019-00 V0 / KARÇEL): kanca
kataloğunda `hook_nr` SAYIdır, `hookNumber` ise dize alanıdır. Ham `250`
yazıldığında `hookDesignationText` içindeki `sel.hookNumber?.trim()`
`TypeError` fırlatıyordu — `?.` burada KORUMAZ, değer null değil yanlış
tipte — ve `runCalc` editörde bir `useMemo` içinde koştuğu için istisna **SSR
sırasında sunucuda** oluşup revizyon sayfasını 500'e düşürüyordu. İkinci ve
daha sessiz arıza: seçim listesinin seçenekleri dizedir, sayı hiçbiriyle
eşleşmez ve kutu "seçilmemiş" görünür. Alan tanımı verilmezse değer
DOKUNULMADAN geçer: bilinmeyen bir hedefe tip uydurmak ham değeri bırakmaktan
kötüdür. Önceden kaydedilmiş satırların onarımı
`supabase/migrations/20260820000002_hook_number_text.sql`tedir.

**Katalog SAYFASI ayrı bir yoldur.** Seçim tablosu ürünün sayılarını verir;
mühendis çoğu zaman sayfanın kendisini de görmek ister (ölçü resmi, dipnot,
üretici uyarısı). `scripts/catalog-sheets.py` kaynak PDF'ten sayfayı keser
(`catalog-sheets/<tür>/*.webp`) ve `src/lib/catalog-sheets/manifest.json`
defterini yazar; `Katalog Seçimi` başlığındaki **Katalog Sayfası** düğmesi
bu deftere bakar.

Sayfa iki yoldan bulunur: **elle** (`MANUAL` — üretici detay föyleri, kesin
SKF SNL/SE sayfa çiftleri, halat ve yük hücresi föyleri; ÖZGÜN kataloğu
taranmış olduğu için onda tek yol budur) ve **otomatik** (`DISCOVER` — her
ÜRÜN için ya çıkarıcının yazdığı doğrulanmış `technical_page` /
`dimension_page` alanları kullanılır ya da ürünün model kodu + sayısal
alanlarının en çoğunu taşıyan sayfa seçilir). Tek bir kodun kataloğun her
yerinde geçmesi sayfayı kazandırmaz; ürünün SATIRININ bulunduğu tablo sayfası
kazanır. Eşiği geçemeyen ürüne sayfa YAZILMAZ. `--verify` haritayı dosya
yazmadan sınar.

**Bir ürün föyü birden çok kaynak yaprağı taşıyabilir.** GAMAK 2026, ELK ve
SEW-EURODRIVE AC motorlarında performans tablosu + ürüne ait B3 motor ölçü
föyü; Yılmaz DT/DR, KT/KR
ve M'de performans tablosu + modele ait ölçü sayfası; Yılmaz H'de iki ardışık
performans yaprağı + ölçü sayfası tek manifest kaydıdır. SIBRE USB'de ürün
sayfasına BS fren diski yaprağı, SHI'da model yaprağına ortak teknik-veri
yaprağı eklenir. Aynı kaynak yaprak dosyada yalnız bir kez saklanır.

**SEW AC motor kimliği tip kodu + güç satırıdır.** 2014 tarihli
`SEW_AC motor.pdf` içinden yalnız 400 V, 50 Hz, S1 standart DRS (IE1), DRE
(IE2) ve DRP (IE3) motorları alınır; verim değeri basılmayan DT56/DR63,
kutup değiştiren, tork/servo ve MOVI-SWITCH/MOVIMOT aileleri aynı seçiciye
karıştırılmaz. Aynı tip kodu birden çok güçle yayımlanabildiğinden çıkarıcı
ağırlık tablosunu `(model, güç)` ile eşler. Her ürün fiziksel s.96-108'deki
performans sayfasını ve s.203-301 arasındaki kendi B3 ölçü föyünü taşır.
Büyük DRP gövdelerinin katalogda IEC kasa genelinden farklı basılan mil
çapları model bazında korunur (DRP250M4 60 mm, DRP280S4 65 mm,
DRP315K/S4 70 mm); komşu DRS/DRE satırına kopyalanmaz.

**Yılmaz giriş bağlantısı ürün kimliğinin parçasıdır.** DT/KT `Motorsuz mil
girişli`, DR/KR `Motor akuple` satırlarıdır; mekanik performans satırı aynı
gövdeden gelir ama model ve ölçü sayfası farklıdır. Seçicide `series`
DT/DR/KT/KR olarak ayrı değer taşır, `input_configuration` tabloda açıkça
görünür. H serisinde aynı model beş giriş devri bloğunda tekrar ettiği için
yalnız modelle arama yeterli değildir: çıkarıcı PDF'i okurken kesin
`technical_page` değerini yazar, manifest `inputRpm` taşır ve açık adres
`n1=…` parametresiyle doğru bloğa döner. Katalog `n1` değeri gerçek motor
devrine yuvarlanmaz.

**HALAT DEFTERİ YALNIZ VİNÇ HALATI TAŞIMAZ.** Aynı üreticilerin asansör
(askı · regülatör · denge), madencilik, sondaj, balıkçılık ve taş kesme
halatları da defterdedir — 66 üründen 31'i vinç halatıdır. Bu yüzden her halat
satırı `attrs.typical_application` taşır (`Vinç` · `Asansör` · `Madencilik` ·
`Sondaj` · `Balıkçılık` · `Platform` · `Taş kesme`) ve o alan seçicinin **İLK
süzgeç adımıdır**. Kaynağı `catalog_data/ropes/*.json` dosyalarının
`meta.typical_application` alanıdır; seed onu satırlara dağıtır. Adım
redüktördeki gibi KİLİTLİ DEĞİLDİR — mühendis bilerek başka bir alanın halatını
da seçebilir — ama kilitsizlik, bir asansör askı halatının vinç kaldırma
halatıyla aynı listede ayırt edilmeden durmasını gerektirmez: alan aynı zamanda
sonuç tablosunda bir sütundur.

**Halatın görünen modeli katalog kimliği değildir.** Ekipman satırında satın
alma için `6X36 WS SAĞ HELİS` / `SOL HELİS` görünür; üretici katalog ürünü ise
`Ø20 6x36 WS IWRC 1960 MPa` biçimindedir. Katalogdan seçim birebir modeli
`ropeCatalogModel` alanında revizyona taşır. Bu alanı taşımayan eski
revizyonlarda ekipman katmanı yalnız basılı standart sınıflar için çap +
konstrüksiyon + öz + kg/mm²→MPa ters tablosundan aday kurar ve aday manifestte
birebir bulunursa kullanır; yakın ürün tahmini yapmaz.

**Resmi PDF indirilemiyorsa üretici sayfası arşivi istisnadır.** Esit PLC'nin
tekil çizim bağlantıları giriş ekranına bağlı olduğundan erişim aşılmaz;
üreticinin kamuya açık PLC ürün sayfasının arşivlenmiş ilk yaprağı kullanılır.
Kobastar LPW1 ise üreticinin resmi iki sayfalık föyüdür. Uydurma teknik belge
üretilmez.

Eşleme SERİ önekiyle değil MODEL koduyla yapılır ("A" serisi ile
"ABC-V 260" karışırdı); tam eşleşme yoksa tasarım soneki atılmış temel koda
düşülür ("22212" ↔ "22212 E"), o da yoksa sayfa AÇILMAZ — yakın bir sayfa
göstermek yanlış ölçü tablosuna baktırırdı. Manifestteki model dizgileri
`cat_equipment.model` ile BİREBİR aynıdır; seed'in model kurma kuralı
değişirse betikteki `db_model` de değişmelidir.

**Yalnız görüntü saklanır, PDF dilimi değil:** sayfa dilimi PDF'i kaynağın
taranmış görüntüsünü olduğu gibi taşıdığı için dosya başına 200–800 KB
tutuyordu; 260'ı aşkın sayfada depoyu şişirirdi. Dosyalar `public/` altında
DEĞİLDİR: `/api/catalog-sheet/...` ucu yolu manifest izin listesinde birebir
doğrular. Uç müşteri bağlantısı için oturum istemez ama manifest dışındaki bir
dosyayı ya da dizini hiçbir zaman sunmaz.

**Katalog sayfasının müşteriye açık adresi vardır:
`/paylas/katalog?tur=…&marka=…&model=…&n1=…`.**
Ekipman listesinde EKİPMAN ADI bu adrese bağlanır — uygulamada yeni sekmede,
Excel'de köprü olarak, standart PDF'te dış bağlantı olarak. Müşteri üyeliği
gerekmez; açık sayfa yalnız seçilen üretici yaprağını gösterir, uygulama
menülerini ya da başka kataloglarda gezinme yolu vermez. Adres ÜRÜN KİMLİĞİNİ
taşır, defterin iç kimliğini değil (`n1` yalnız H gibi devir varyantlı
ürünlerde yazılır): `manifest.json` yeniden
üretildiğinde sayfa kimlikleri değişebilir ama ürün kimliği değişmez, yani
daha önce indirilmiş bir Excel'in bağlantısı ölü kalmaz. Adresi
`catalogSheetPageUrl` üretir, listedeki eşlemeyi `buildCatalogSheetUrls`
kurar; tur `__tests__/catalog-sheets.test.ts`te kapanır. Model hücresindeki
bağlantı BAŞKA bir şeydir (yönetim panelinden girilen üretici datasheet'i).
Ekran, Excel, standart PDF ve detaylı PDF'nin sözlük anahtarı
`rowCatalogSheetKey` ile TEK YERDE ve `catalogModel` üzerinden kurulur; H
serisinin `n1` parçasını çağrı yerlerinden birinin unutması düğmeyi sessizce
etkisiz bırakamaz. Görünen model anahtar değildir: ana ve yardımcı kaldırmanın
ikisi de `6X36 WS SAĞ HELİS` yazarken çapları farklı olabilir; gerçek katalog
modeli kullanılmazsa yardımcı satır ana halatın URL'sini alır.

**Eşleme MARKA sütunundaki "-"yi marka SAYMAZ.** Ekipman listesi markası
olmayan satıra "-" yazar; bu metin marka gibi ele alındığında kimliği tek
birleşik "MARKA MODEL" alanında duran bölümlerin (redüktör 2.3/5.5, tampon
5.8, yürütme freni 5.5b) HİÇBİRİ sayfa bulamıyordu — `<tür>|-|<model>`
anahtarı tutmuyor, marka önekini modelden ayıklayan yol da `brand` dolu
göründüğü için hiç çalışmıyordu (`realBrand`). Kimliği görünen sütunlarda
OLMAYAN satır arama modelini `EqRow.catalogModel` ile ayrıca taşır.

**Ekipman listesi PDF'i iki seviyelidir.** *Standart* liste bugünkü
tablodur ve adı dış adrese bağlar. *Detaylı* liste (`?detay=1`) aynı
tablonun arkasına ürünlerin katalog sayfalarını EKLER; ad artık belge
içindeki o yaprağa gider (`Link src="#…"` + `View id="…"`). Görüntüler
`.webp`tir ve react-pdf webp çözmez: dönüştürme
`pdf/catalog-sheet-images.ts`te sharp ile yapılır (JPEG, 1400 px) ve PDF
katmanına hazır tampon olarak girer. Aynı katalog sayfasına düşen iki ürün
yaprağı iki kez bastırmaz, ikisi de aynı çapaya bağlanır
(`CatalogSheetPage.keys` çoğuldur).

Detaylı PDF'deki katalog destesi manifest sırasını değil **ekipman listesinin
grup + satır sırasını** izler. Sayfayı paylaşan iki ürün tek yaprağa
tekilleştirilir; yaprağın yeri ilk geçtiği ekipman satırıdır. Böylece halat,
rulman, redüktör, motor, fren ve kaplin föyleri tablodaki okuma sırasıyla gelir.

**Ek yaprağın YÖNÜ ölçülür, varsayılmaz.** Sayfalar bir süre HEPSİ dikey
basıldı ("kaynak taramalar dikeydir"); varsayım yanlıştı — çok sütunlu boy
tabloları yatay basılır ve dikey A4'e sığdırılınca ölçü tablosu okunmaz
oluyordu. `orientation` sharp'ın DÖNÜŞTÜRME SONRASI ölçüsünden gelir
(EXIF döndürmesi dahil), eşik 1,05'tir. Görüntüye ayrıca sayfa yönüne göre
`maxHeight` verilir; yoksa yatay yaprak sayfayı taşırıp ikiye bölünür.

**`id={undefined}`, `id` VERMEMEKLE AYNI ŞEY DEĞİLDİR.** @react-pdf
`'id' in props` diye bakar ve tanımsız değeri de bir hedef sayıp belgeye
"undefined" adlı bir adlandırılmış hedef yazar. Çapasız yaprakta alan
KOŞULLU SPREAD ile hiç verilmez.

**GRUP SARMALAYICI KUTUYA KONMAZ** (kullanıcı bildirimi, 12.08.2026 — ilk
sayfa boş çıkıyordu). Tablo grubunun TAMAMINI saran bir `View`e
`minPresenceAhead` konduğunda @react-pdf, grup sayfaya SIĞSA BİLE
bitişinden sonra istenen boşluk kalmıyorsa bloğu bütünüyle sonraki yaprağa
atar; ilk sayfada yalnız marka bandı, künye ve tablo başlığı kalır. Aynı
tuzak hesap raporunda bir kez yaşanmış ve `report.tsx`te belgelenmişti;
ekipman listesi de artık aynı yapıyı kullanır — grup başlığı İLK SATIRIYLA
tek bir `wrap={false}` kutudadır, kalan satırlar düz kardeş olarak akar.
Koşul dar olduğu için (grup, sayfanın son ~30pt'sinde bitiyorsa) koruma
testi tek fikstürle değil GRUP BOYUNU TARAYARAK koşar
(`__tests__/equipment-report.test.tsx`).

## KATALOG-19 — "Ek Belge" mühendisin kendi katalog yaprağıdır.

Defter
(`manifest.json`) yalnız kaynak PDF'i workspace'te olan üreticileri kapsar;
kanca, makara, teker, ray ve müşteriye özel imalatın sayfası orada YOKTUR.
`equipment_attachments` bir PDF'i ekipman SATIRINA bağlar — anahtar
`equipment_notes` ile birebir aynıdır (`<modulKey>:<slug>`).

- **Baytlar server action'dan GEÇMEZ:** dosyayı tarayıcı doğrudan depoya
  yükler (`folder-picker.tsx` deseni), action yalnız kaydı yazar. Action
  gövdesinin varsayılan sınırı 1 MB'tır ve taranmış bir yaprak bunu aşar.
- **Sayfa adedi BEYAN DEĞİL ÖLÇÜMdür** (`verifyStorage` ile aynı ilke):
  action dosyayı depodan indirip pdf-lib ile açar ve sayar. Açılamayan
  dosya kayda GİRMEZ, yüklenen nesne silinir.
- **Yeni revizyona KOPYALANIR** (satır + depo nesnesi). Paylaşılsaydı eski
  revizyonun eki yenisinden silinince kaybolurdu; teslim edilmiş bir
  listenin eki sonradan değişmemelidir.
- Silme sırası "önce ucuz olanı kaybet": önce satır, sonra depo nesnesi.

**PDF'te KAPAK + `pdfEkleriYerlestir`.** react-pdf var olan bir PDF'i
okuyamaz, pdf-lib ise Türkçe başlık basamaz (gömülü fontlar WinAnsi). Bu
yüzden react-pdf her ek için bir kapak yaprağı basar, pdf-lib gerçek
sayfaları o kapağın hemen ardına koyar. **Temel belge YERİNDE açılır, yeni
bir belgeye KOPYALANMAZ** — `pdfBirlestir` gibi kopyalayan bir yol
`/Root /Names /Dests` ağacını taşımaz ve bütün iç bağlantılar sessizce
ölür. Okunamayan ekin KAPAĞI DA silinir: belge var olmayan sayfa vaat etmez.

## KATALOG-20 — Elektrik kataloğu ÖZGÜN BELGE + DOĞRULANMIŞ FÖY olarak saklanır.

Tam üretici kataloğu kaybolmaz; `catalog` bağıyla özgün PDF olarak saklanır.
Müşteriye gösterilen `technical` belge ise ya doğrudan kısa resmi föy ya da
uzun katalogdan çıkarılmış doğrulanmış `technical_extract`tir.
Çıkarım kaydı `source_document_id` ile özgün belgeyi ve 1 tabanlı
`source_pages` ile fiziksel sayfaları taşır; böylece her yaprağın kaynağı
denetlenebilir.

İşletme ve bakım kitabının EK-F üretiminde her eşsiz kaynak/aralığın en çok ilk
iki sayfası kullanılır ve aynı kaynak/aralık tekrar basılmaz. Bu teslim sınırı
veritabanındaki özgün föyü ya da tam kataloğu kırpmaz; Malzeme Listesi'ndeki
Teknik Föy ve Katalog düğmeleri özgün belgeleri açmayı sürdürür.

Uzun katalogda kısa/genel bir metin eşleşmesi yeterli değildir. Tam normalize
sipariş kodu ve teknik içerik birlikte doğrulanır; indeks sayfası ürün sayfası
sayılmaz. Tam kod bulunamayan, yalnız aile/muadil belge taşıyan ürün teknik föy
olarak bağlanmaz. 0019'un denetlenmiş aralıkları içe aktarma betiğinde açıktır;
yanlış belge göstermek yerine düğmenin boş kalması tercih edilir.

**Uygulamanın ürettiği özet/kaynak kartı teknik föy DEĞİLDİR ve PDF olarak
üretilmez, depolanmaz, ürüne bağlanmaz.** Üreticinin doğrudan kısa föyü yoksa
yalnız resmi katalog/kılavuzdan ilgili fiziksel sayfalar kesilir; kaynak belge ve
sayfa numaraları kayda yazılır. Resmi PDF bulunamayan istisnada üreticinin kendi
ürün sayfasının doğrudan arşivi kaynak olabilir. Üretici içeriği de yoksa teknik
föy düğmesi boş kalır; proje satırından türetilmiş metinle belge uydurulmaz.

## KATALOG-21 — HELUKABEL tam katalogdur; makale föyleri denetlenmiş fiziksel kesitlerdir.

`HELUKABEL - Hareketli Kablo Kataloğu 2019 (TR).pdf` 471 sayfalık özgün
`catalog` belgesidir ve büyük nesne sınırı nedeniyle depoda parçalı tutulabilir;
kullanıcıya açılırken yine tek PDF olarak birleştirilir. 0019-00'daki 21
`HELU.<makale no>` kodunun her biri katalog sipariş tablosunda doğrulanmıştır.

Teknik düğmeye tam 471 sayfalık katalog veya otomatik arama sonucu bağlanmaz.
JZ-500, JZ-600, F-CY-JZ, TRONIC-CY, SUPER-PAAR-TRONIC, TOPFLEX, TOPSERV,
TOPGEBER, ROBOFLEX ve PVC yassı aileleri için ürün açıklaması ile tam makale
satırını birlikte taşıyan denetlenmiş 1-2 fiziksel sayfa `technical_extract`
olarak kaydedilir. Aynı fiziksel aralığı paylaşan farklı makaleler de ürün
kimliği ve bağı bakımından ayrı kalır; her kayıtta ortak kaynak belge ile gerçek
sayfa aralığı açıkça izlenir.
