# Maliyet Çalışması

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/maliyet.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/offers/cost/**` · `src/app/(app)/offers/cost-*.ts` · `src/app/(app)/offers/[id]/costs/**` · `src/app/(app)/offers/[id]/cost-panel.tsx` · `src/lib/pdf/offer-cost.tsx` · `scripts/test-offer-cost-pdf.ts`

## MALIYET-1 — Maliyet TEKLİF PAYLOAD'INA GİRMEZ; ayrı tablo, ayrı zincir.

Kullanıcı isteği (17.08.2026): *"Teklifin içine girildiğinde teklif oluşturduğum
sayfa ikiye ayrılacak … İkinci sayfa maliyet sayfası."* Ayrılık ekranda bir
sekmedir ama VERİDE bir tablodur (`offer_cost_revisions`).

`offer_revisions.payload` içine bir `cost` bloğu eklemek daha az iş olurdu ve
iki şeyi birden bozardı:

1. **MÜŞTERİYE GİDEN BELGE ile maliyet aynı nesnede dururdu.** Teklif PDF'ini
   basan yolda tek bir gözden kaçma marjımızı müşteriye yazdırırdı ve koruma
   tek bir süzgeç fonksiyonunun doğruluğuna kalırdı. Ayrı tablo bunu YAPISAL
   olarak imkânsız kılar: teklif payload'ında maliyet diye bir alan yoktur, o
   yüzden `pdf/offer.tsx` onu basamaz.
2. **Yayımlanmış teklif revizyonu KİLİTLİDİR** (`guard_issued_offer_revision`).
   Maliyet ise teklif gönderildikten SONRA da güncellenir — tedarikçi fiyatı
   değişir, montaj keşfi netleşir. Aynı nesnede olsalardı maliyeti düzeltmek
   için müşteriye hiç gitmemiş bir R1 açmak gerekirdi.

Yetki AYRI SORULUR (`can_see_offer_costs` / `can_edit_offer_costs`): bugün
teklifle aynı kümedir (Yönetici · Müdür) ama maliyet KÂR MARJI taşır, yani
teklif fiyatından bir adım daha içerdedir. `offer_list` görünümüne maliyet
sütunu EKLENMEDİ; ayrı bir görünüm (`offer_cost_list`) vardır.

## MALIYET-2 — Revizyon zinciri AYRIDIR, bağı KAYITLIDIR.

Kullanıcı kararı (17.08.2026, iki seçenek arasından): maliyetin kendi
**M0/M1/M2** zinciri, kendi yayımı ve kendi kilidi vardır. Teklif R1'e geçtiğinde
maliyet M0'da kalabilir ve bu meşrudur — teklif metni değişip maliyeti
değişmeyen bir revizyon olağandır (bir not eklenmiştir, bir teslim süresi
düzeltilmiştir).

**R1'İN MALİYETİ M1 DEĞİLDİR** ve bu yüzden iki zincir aynı tabloda
gösterilmez: panelde ayrı tablolardır. `payload.sourceRevNo` hangi teklif
revizyonundan kurulduğunu söyler; editör ve panel bunu güncel teklif
revizyonuyla karşılaştırıp "maliyet geride kaldı" der. Sessiz bir ayrışma kâr
marjını yanlış gösterirdi.

Etiket **M**'dir, R değil: iki numaranın ekranda yan yana durduğu yerde tek
harf bütün belirsizliği kapatır.

## MALIYET-3 — Model bir TAHMİNDİR, bir hesap değildir.

`lib/offers/cost/model.ts` ağırlık ve mekanizma boyutlandırması üretir. Buradan
çıkan hiçbir sayı bir hesap raporuna girmez, bir kesit onaylamaz, bir motoru
yeterli ilan etmez.

**AGENTS.md md. 1 ("Excel'e bakarak kod yazma") ÇİĞNENMİYOR, KAPSAMI DIŞINDA
kalınıyor.** O kural HESAP MOTORU içindir (`lib/calc`): bir vincin FEM/DIN'e
göre yeterli olup olmadığı bir tabloya değil standardın maddesine dayanır.
Burada sorulan soru başkadır — "bu vinç kaç kilo gelir ve bize kaça mal olur" —
ve bunun kaynağı ancak firmanın kendi imalat geçmişidir. Teklif aşamasında
vincin tasarımı henüz YOKTUR; maliyet o tasarımı beklemeden fiyat verebilmek
içindir.

Kaynak: *"ÖRNEK ASTOR 32T × 30 m Portal Vinç Teklif Maliyet Çalışması V3"*.
Model onun sayılarını BİREBİR üretir ve `__tests__/model.test.ts` bunu ölçer.

## MALIYET-4 — Satır = MİKTAR × BİRİM FİYAT; miktar modelden, fiyat elden.

Kullanıcı kararı (17.08.2026): *"parametreler sayfası devre dışı değil aslında.
Maliyetlerin sabit tablo belli tablolar olması devre dışı. Geri kalan hesap
modeli yapısı ağırlık modeli yapısı vs kullanılabilir."*

Ayrım tam olarak şudur ve `params.ts`in başında yazılıdır:

- **DEVRE DIŞI:** fiyat aramalı tablolar — motor €, redüktör €, teker paketi €,
  sürücü €, kapasite skalaları, tambur baz €. Hiçbiri portlanmadı.
- **KULLANILIYOR:** ağırlık tabloları (teker grubu kg, tambur kg, şasi kg,
  kanca bloğu kg, redüktör kg), katalog serileri (motor/sürücü kW, teker Ø),
  kesit listesi ve bütün mühendislik katsayıları.

Ortalama fiyatla hesaplanan bir maliyet, teklifi verirken doğru görünüp iş
alındığında tutmayan türden bir sayıdır. Bir dahaki fazda fiyat arşivinden
öneri gelebilir; o zaman da öneri OLARAK gelmelidir, değer olarak değil.

**İKİ KAYNAK ASLA TOPLANMAZ** (Ücret Planı'nın kuralı): `qtySource` doluysa
miktar modelden okunur ve kutu salt okunur çizilir; `qtyManual` açıksa insan
yazar. Aynı satırda iki sayı yaşasaydı hangisinin geçerli olduğu ekrana
bakarak anlaşılamazdı.

## MALIYET-5 — ORAN TABANI PROJE MALİYETİDİR.

Kullanıcı tarifi: *"Sarf %2, finansman %2, sabit giderler %15. Toplam maliyete
oranı olacak."* Cümle iki farklı sayı üretebiliyordu ve fark gerçekti:

    proje × (1 + 0,19)  = 194.258 → 231.167 €      ← SEÇİLEN
    proje ÷ (1 − 0,19)  = 194.258 → 239.825 €      ← reddedildi

8.658 €'luk bir fark bir varsayıma bırakılamazdı; SORULDU ve proje maliyeti
tabanı seçildi (17.08.2026). Taban `totals.ts`te tek yerdedir ve
`totals.test.ts` kararı dondurur — sessizce değişirse her teklifin kâr marjı
kayar.

**Oranlı grubun KİPİ tektir**: `oran` kipinde satırlar hiç okunmaz, `kalem`
kipinde yüzde hiç okunmaz. İkisini toplamak aynı gideri iki kez saymanın en
kısa yoluydu.

## MALIYET-6 — Model katsayıları BELGEYE aittir, koda değil.

`payload.params` açılışta `COST_PARAM_DEFS`ten kopyalanır ve o andan sonra BU
maliyet çalışmasının sayılarıdır. Devralınan çalışma kitabında her iş için
kopya alınıp katsayılar o işe göre ayarlanıyordu ("V3: ayaklar -%10", "başkiriş
katsayısı iki katına"); model bunu olduğu gibi taşır.

Global bir defter (üçüncü bir tablo) yapılsaydı bugün değiştirilen bir katsayı
GEÇMİŞ bir maliyet çalışmasının rakamını da değiştirirdi — yayımlanmış bir
belgenin değişmezliği (MALIYET-2) sağlanamazdı. `withCostDefaults` eksik
katsayıyı koddaki varsayılanla doldurur ama YAZILI olanı ezmez.

## MALIYET-7 — Ezilen değer AŞAĞIYA AKAR.

`overrides` bir SONUÇ YAMASI DEĞİLDİR: `hesapla` her adımda `yaz()`ten geçer ve
ezilen değeri o noktadan itibaren kullanır. Ana kiriş ağırlığını elle düzelten
kullanıcı köşe yükünün, portal ayaklarının ve toplam ağırlığın da onunla
değişmesini bekler. Yama olsaydı ekranda düzelen sayı maliyette düzelmezdi.

**SIRA MODELİN KENDİSİDİR** (`model.ts` başındaki 12 adım) ve devralınan
çalışma kitabının bağımlılık ağacının topolojik sırasıdır. Bir örnek: köşe
yükü ana kirişi TAŞIR ama üst uç bağlantıyı taşımaz (o köşe yükünden türer),
teker yükü ise ikisini de taşır. İki toplam AYNI DEĞİLDİR ve karıştırmak
sessiz bir hatadır.

**EZİLEMEZ ALANLAR** yalnız başka bir girdinin tekrarı olanlardır (sınıf
katsayıları, teker adetleri, sehim oranı). Toplamlar EZİLEBİLİR — model bir
tahmindir ve gerçek ağırlığı bilen mühendis onu yazabilmelidir.

## MALIYET-8 — Devralınan "32T özel parametreleri" ARA DEĞERDİR.

Çalışma kitabında 32 tonluk vinç için ayrı bir parametre bloğu vardı: tambur
Ø 410, şasi 1.700 kg, kanca bloğu 970 kg, tambur ağırlığı 1.100 kg. Bu
sayıların TAMAMI genel tabloların 30–40 ve 30–50 satırları arasındaki DOĞRUSAL
ARA DEĞERLERİDİR — elle hesaplanıp yapıştırılmışlar.

Model enterpolasyonu kendi yaptığı için (`interpolate`) o blok bütünüyle
gereksizleşir ve 32 değil 33 tonluk bir vinçte de doğru sayı çıkar. "İlk ≥"
kullanılsaydı 32 tonluk bir vinç 50 tonluk satıra düşer ve kanca bloğu %78
fazla tartardı.

**KATALOG BOYLARINDA ENTERPOLASYON YAPILMAZ** (`firstAtLeast`): motor,
sürücü, teker ve redüktör bir katalog boyudur — 23,4 kW'lık motor satın
alınamaz. Ayrım kapasite eksenli AĞIRLIK tabloları ile ürün SERİLERİ
arasındadır.

## MALIYET-9 — Maliyet iskeleti TEKLİF KALEMİNDEN türer; şablon tablosu yoktur.

Kullanıcı isteği: *"her vinç grubu için nasıl teklif şablonum var ise benzer
bir maliyet şablonumu oluşturacağım."* Karşılığı bir tablo değil bir
TÜRETMEDİR (`costGroupKeysForOfferItem`): yardımcı kaldırması olan bir vinçte
maliyette de o grup açılır, çünkü teklif kalemi zaten `auxHoist` bölümü
taşıyor.

Ayrı bir `offer_cost_templates` defteri `offer_templates` ile er geç ayrışır ve
kullanıcıya aynı soruyu (hangi vinç tipi) ikinci kez sordururdu — TEKLIF-32'nin
tam tersi.

**TEKLİFTEN TAZELEME BİR EYLEMDİR**, kaydetmenin yan etkisi değil (TEKLIF-14'ün
"yalnız açılışta" kuralının aynı gerekçesi) ve EKLEYİCİDİR:

- Teklifte olup maliyette olmayan kalem AÇILIR.
- Başlık ve vinç tipi TAZELENİR.
- **BOŞ** girdiler teklifin satırlarından doldurulur; dolu olana DOKUNULMAZ.
- **Teklifte silinen kalemin maliyeti SİLİNMEZ**, `offerItemId` null olur.
  Silmek girilmiş bütün birim fiyatları götürürdü — her biri tedarikçiyle
  yapılmış bir görüşmedir.

## MALIYET-10 — Satırın teklifteki karşılığı SAKLANMAZ, okunur.

`offerRefValue` maliyet satırının defterdeki `offerRef`ini (grup + satır
anahtarı) çözer ve teklif belgesinden BASILAN değeri okur: maliyette
"Kaldırma Motoru" satırını fiyatlarken teklifte ne yazdığı (`GAMAK 30 kW 1500
d/dak`) yanında görünür.

Değer saklansaydı teklif düzeltildiğinde maliyetteki not eskisini göstermeye
devam ederdi ve iki belge sessizce ayrışırdı (TEKLIF-20'nin tek okuma noktası
kuralı). Bağ SATIRIN ANAHTARIYLA kurulur, metin benzerliğiyle değil (TEKLIF-7).

**KÖPRÜ İLE PORTAL EŞDEĞER SAYILIR** (`ESDEGER_GRUPLAR`): defter yürütme
satırlarını `bridge` altında tarif eder ama portal vinçte o grup `gantry`dir.
İki ayrı `offerRef` yazmak defteri iki katına çıkarır ve yeni bir satır
eklendiğinde birinde unutulurdu.

## MALIYET-11 — Fiyat satırındaki maliyet YÜKLÜ maliyettir.

Kullanıcı isteği: *"Teklif satırında tutarın soluna maliyet sütünü eklemek
istiyorum."* Sütun kalemin doğrudan maliyeti + proje geneli ve oranlı
grupların PAYINI gösterir (`loadedCostByOfferItem`). Yalnız doğrudanı
göstermek, sabit giderleri hiç taşımayan sahte bir kâr üretirdi.

Dağıtım bir TAHMİNDİR ve ekranda öyle söylenir; ama dağıtmamak daha kötüdür.

- **TOPLAM SATIRI SÜTUNU TOPLAMAZ**, maliyet belgesinin kendi toplamını okur:
  aynı kaleme bağlı iki fiyat satırı varsa sütunun toplamı o kalemi iki kez
  sayardı. Uygulama bunu sessizce bölmez — İKİ SATIR UYARILIR, çünkü hangi
  satırın maliyetin ne kadarını taşıdığı bir tahmin olurdu.
- **Serbest satırda (kalem bağı yok) maliyet YOKTUR** ve sıfır da yazılmaz;
  ekranda "—" görünür (değişmez md. 4).
- Kâr **İSKONTOLU** toplamdan hesaplanır (`effectiveTotal`): pazarlıkta
  konuşulan tutar odur.

**İKİ ORAN BİRDEN GÖSTERİLİR** (`costMargin`): "%25 kâr" cümlesi iki farklı
sayı anlatabilir — satışın %25'i mi, maliyetin %25'i mi. 194.258 € maliyet ve
259.010 € fiyatta biri %25, öteki %33'tür.

## MALIYET-12 — İç belge ÜÇ YERDE birden işaretlidir.

Maliyet PDF'i firma içinde kalır. Müşteriye gitmesi bu bölümde olabilecek en
pahalı hatadır, o yüzden ayrım tek bir yere bırakılmadı:

1. **Dosya adının SONUNDA** "İÇ BELGE" (`offerCostFileName`) — e-posta ekinde
   ad kısaltılsa bile ilk okunan yerde.
2. **Her sayfada damga** ("İÇ BELGE — MÜŞTERİYE VERİLMEZ"), `fixed` olarak.
3. **Altbilgi künyesinde** `… · MALİYET Mn · İÇ BELGE`.

Duman testi (`scripts/test-offer-cost-pdf.ts`) damganın SAYFA SAYFA varlığını
ölçer: bileşen ağacına bakmak bir sayfada düştüğünü göstermez.

**PDF UCU ÇERÇEVEYE AÇILMADI.** `next.config.ts`teki gevşetme yalnız teklif
PDF'ine verildi (TEKLIF-18) çünkü orada `<iframe>` önizlemesi var; iç belge
için ikinci bir gömülebilir adres açmanın karşılığı yok — önizleme yeni
sekmede açılır. Trace'e ayrı satır GEREKMEZ: `/offers/**` kalıbı maliyet
ucunu da kapsar.

**REVİZYON M0'DA DA YAZILIR** (teklifin `offerRevLabel` kuralının TERSİ):
teklifte R0 gizlenir çünkü müşteri "REV 00" görünce var olmamış bir düzeltme
geçmişi okur; maliyette asıl soru "bu hangi maliyet çalışması" olduğu için
numara her zaman görünür.

## MALIYET-13 — Eksik veri SIFIR SAYILMAZ, gerekçesi YAZILIR.

Modelin çalışamadığı dal `null` döner ve `CostModelResult.eksik` hangi
girdinin eksik olduğunu cümleyle söyler ("Kaldırma kapasitesi girilmedi —
mekanizma ve ağırlıklar hesaplanamadı"). Ekran ve PDF bunu basar.

Fiyatı ya da miktarı girilmemiş satır toplama GİRMEZ, toplamdan DÜŞER; hiç
tutarı olmayan bir grup `null` döner ve "—" görünür. Sıfır yazmak, maliyeti
henüz girilmemiş bir vinci bedava göstermenin en kısa yoluydu (değişmez md. 4).

**MODEL DEĞERİNİN YER TUTUCUSU BİR VERİ ÖRNEĞİ DEĞİLDİR.** SATIS-16 "yer
tutucu bir değer değildir" der ve haklıdır: uydurma bir örnek ("ör. 1500")
olmayan bir veri gösterir. Ezme kutusundaki gri sayı ise kutu boş bırakılırsa
GERÇEKTEN kullanılacak olan değerdir — yer tutucu değil, varsayılanın kendisi.

## MALIYET-14 — Fire yalnız İŞÇİLİĞE biner.

`w.steelWithFire` ayrı bir model anahtarıdır ve yalnız imalat işçiliği satırını
besler. Sac zaten fireli ölçüde satın alınır ve kesim artığı stoğa döner;
kaynak/işleme saati ise yeniden yapılan parça için ikinci kez harcanır.

Ayrı bir anahtar olmasının sebebi görünürlüktür: çarpan satırın arkasına
saklansaydı, işçilik miktarının neden çelik ağırlığından büyük olduğu ekrandan
okunamazdı.

**BOYA TOPLAM VİNÇ AĞIRLIĞINI okur** (`w.total`), hammadde/lazer/imalat ise
ÇELİK ağırlığını (`w.steel`). Ayrım gerçektir: boya araba mekanizmasının da
üstüne atılır, sac ise yalnız kaynaklı yapı için kesilir.

## MALIYET-15 — Yükseklik zinciri teklif editörünün AYNISIDIR.

`/offers/<id>/costs/<id>` adresinde "revisions" geçmez ama ekran davranışı
birebir aynıdır. `app-shell.tsx`teki `isFrame` ve `isRevisionScreen`
kalıplarına `\/costs\/[^/]+` eklendi; `OffersNav` orada da `null` döner.

Eklenmeseydi TEKLIF-17'de İKİ KEZ yaşanan hata birebir tekrarlanırdı: editör
1000 px'e büyür, `main` onu kırpar ve kaydırılacak bir kap hiç oluşmazdı.
Sayfa kökü `lg:flex-1` kullanır, `lg:h-full` DEĞİL — `PageHeader` kabuğun
şeridine portallanır ve çocuk sayısı bağlama göre değişir.

## MALIYET-16 — Teklifteki HIZ BİR ARALIKTIR; `trSayi` onu okuyamaz.

Teklif defteri hız satırını aralıkla tarif eder ("1-6", "20 - 30") ve
`lib/drawings`in `trSayi`si bir aralığı `null` sayar. Ölçüldü:

    trSayi("1-6")     → null
    trSayi("20 - 30") → null
    trSayi("4/1")     → 41        ← bölü işaretini siler, iki sayıyı birleştirir

Sonuç sessiz ve ağırdı: kaldırma hızı boş kalınca **kaldırma mekanizmasının
tamamı** hesaplanmıyordu (halat hızı → tahvil → motor momenti → hesap gücü →
SEÇİLEN MOTOR → sürücü). Ekranda yalnız "—" görünüyordu.

Okuyucu `oku.ts`tedir ve **AYRI BİR DOSYADIR** çünkü iki taraf da kullanır:
`payload.ts` girdileri doldururken, `compare.ts` şeridi çizerken. `compare.ts`
zaten `payload.ts`ten `travelGroupKey` alıyor; tersine bir bağ döngü kurardı.

**ARALIĞIN ÜST UCU ALINIR** (`costUpperBound`): "1-6 m/dk" yazan bir teklifte
vincin karşılaması gereken hız 6'dır. Alt ucu almak, kapasitesi yetmeyen bir
motoru "uygun" göstermenin en kısa yoluydu.

**HALAT DONANIMI TEKLİFTEN OKUNMAZ** (kullanıcı kararı 18.08.2026): *"Halat
donanımını otomatik katsayılardan seçilsin ancak müşteri dropdown da
değiştirebilsin."* Teklifteki "4/1" yazımını girdiye seed etmek, modelin
kapasite eşiklerinden çıkardığı öneriyi belgedeki bir metinle ezmek olurdu;
şerit ikisini zaten yan yana gösterir.

## MALIYET-17 — Alan defterinde ANAHTAR TEKİLDİR.

`ALAN_HARITASI` bir `Object.fromEntries`tir: aynı anahtar iki bölümde
tanımlanırsa **sessizce sonuncusu kazanır** ve satır ekranda da PDF'te de İKİ
KEZ çizilir. `c.deflectionLimit` bir süre hem KİRİŞ VE SEHİM hem SINIF
KATSAYILARI bölümündeydi ve iki tanım birbiriyle çelişiyordu (biri
düzenlenebilir, öteki salt okunur).

Sehim limiti KİRİŞ VE SEHİM bölümünde durur: okuyanın sorusu "kiriş yetiyor
mu"dur ve cevabı hemen altındaki SEHİM ORANI satırıdır. Duman testi
(`test-offer-cost-pdf.ts`) belgede **bir kez** geçtiğini sayar.

## MALIYET-18 — Her `qtySource` ve her `deps` anahtarının bir tanımı olmalıdır.

Tanımsız anahtar türetme pop-up'ında **ham hâliyle** basılır: `c.capacityT` on
ayrı alanın ara değer listesinde geçiyordu ve ekranda "c.capacityT" yazıyordu.

Bir değerin ekranda kendi SATIRI olması gerekmez ama ADI olmak zorundadır:
`BOLUMSUZ_ALANLAR` çizilmeyen ama defterde yaşayan tanımları taşır
(`c.capacityT`, `c.deflectionCm`, `c.one`). `costFieldDef` bölümlerin
BİRLEŞİMİNDEN okur; `COST_FIELD_KEYS` bütünlük testine açıktır.

**ARA DEĞERLER HESABIN BİRİMİNDEDİR.** `c.deflectionRatio`nun `deps`i bir süre
`c.deflectionMm` diyordu ve pop-up "3.000 cm ÷ 20,5 mm = 1.463" gösteriyordu —
okuyan tutturamazdı. Oran cm ÷ cm'dir; ekrana basılan milimetre ayrı bir
anahtardır (`c.deflectionMm = c.deflectionCm × 10`, kullanıcı isteği md. 7).

**`c.one` "modelden gelmiyor" DEĞİLDİR:** model onu sabit 1 üretir ve kutu tam
bu yüzden salt okunur çizilir. Pop-up metni bir süre tersini söylüyor,
kullanıcıyı boş yere kutuyu açmaya yönlendiriyordu.

## MALIYET-19 — Katalog boyu alanı HER ZAMAN açık bir seçicidir.

Kullanıcı isteği (18.08.2026, md. 1 ve 5): *"Halat donanımını otomatik
katsayılardan seçilsin ancak müşteri dropdown da değiştirebilsin … Teker
çaplarını vb özellikleri de isterse kullanıcı hesaplar kısmında
değiştirebilsin."* `choices` taşıyan alan (halat donanımı, tambur ⌀, teker ⌀,
motor kW, sürücü kW) asa düğmesi beklemeden bir `Select` olarak çizilir; seçim
`overrides`a yazılır ve **aşağıya akar**.

Serbest kutu OLMAMASININ sebebi yalnız görgü değildir: teker grubu ağırlığı
çapı tabloda ARAYARAK bulur (`WHEEL_TABLE.find`), listede olmayan bir çap
yazılsaydı ağırlık sessizce `null` düşer ve kilo maliyetten kaybolurdu.

**BELGEDEKİ DEĞER LİSTEDE YOKSA LİSTEYE EKLENİR.** Tambur çapı kapasiteye göre
ARA DEĞERLİDİR (32 tonda ⌀ 410) ve ham katalog listesi verilseydi hesabı olan
satır boş görünürdü. Aynı kural birimlerde de geçerlidir (`COST_UNITS`): eski
bir belgenin birimi, listeyi daralttık diye kaybolmamalıdır.

**SATIRIN İKİ TIKLAMA HEDEFİ AYRI ŞEYLER YAPAR:** ADA tıklamak "bu sayı nereden
geliyor" der (türetme pop-up'ı), SAYIYA tıklamak onu düzenler. Tek hedef
olsaydı ikisinden biri bir menünün arkasına düşerdi.

## MALIYET-20 — Ekran sırası MODEL SIRASI DEĞİLDİR.

`WEIGHT_SECTIONS` modelin hesap sırasındadır ve öyle kalır — PDF ve model onu
olduğu gibi kullanır. Ama okuyanın sorusu ters yöndedir: *"bu vinç kaç kilo"*
önce sorulur, kırılımı sonra. Kullanıcı isteği (18.08.2026): *"MALİYETE GİREN
AĞIRLIKLAR bölümünü de en üste alalım. Girdiler bölümünün sağına."*

Ekran bunu `AGIRLIK_OZET_KEY` ile yapar: özet bölümü listeden AYRILIR ve
girdilerin yanına konur, kalanı iki sütuna akar. Anahtar sabittir, çağrı
yerinde dize yazılmaz — bölüm anahtarı değişirse özet sessizce İKİ KEZ
çizilirdi.

**İKİ SÜTUN `columns` AKIŞIDIR, ızgara değil** (Ağırlıklar · Hesaplar ·
Katsayılar). Bölümlerin alan sayısı 2 ile 13 arasında değişir; iki sütunlu bir
ızgarada kısa bölümün yanında dev bir boşluk kalırdı. Her bölüm
`break-inside-avoid` taşır ki ortasından bölünmesin.

**FORMÜL ADIN YANINDADIR, ALTINDA DEĞİL** (kullanıcı isteği md. 1). Altına
yazmak satır yüksekliğini iki katına çıkarır ve iki sütunun kazandırdığı yeri
geri alırdı. Ad ÖNCELİKLİDİR (`shrink-0`): dar bir pencerede kırpılacak olan
formüldür, satırın adı değil — formül zaten `title`da ve pop-up'ta tam durur.

## MALIYET-21 — Sapma eşiği TEK YERDEDİR (`COST_DEVIATION_LIMIT`).

Şeridin başlığındaki "3 değer sapıyor" sayacı bir süre eşiği elle kopyalıyordu
(`> 0.05`). Eşik değişseydi başlıkla rozetler ayrışır, "3 değer sapıyor" yazan
bir başlığın altında üç yeşil rozet durabilirdi.

%5 bir katalog boyu farkının altındadır ve bir yuvarlamayı sapma saymaz; bir
teker boyu (⌀ 400 → 500) ya da bir motor kademesi (30 → 37 kW) eşiğin üstünde
kalır — sorulan sorunun tamamı budur: teklifte söz verilen ekipman hesaptan
çıkanla aynı mı.

**İSTENEN DEĞER TEKLİF BELGESİNDEN TAZE OKUNUR**, `item.inputs`tan DEĞİL.
Girdiler teklifin bir KOPYASIDIR ve elle düzeltilebilir; şerit onları okusaydı
belgeyi kendisiyle karşılaştırır ve sapmayı her zaman sıfır gösterirdi.

**RENK TEK TAŞIYICI DEĞİLDİR:** rozet yüzdeyi ve işaretini de yazar, yani renk
körü bir okuyucu ya da gri basılmış bir çıktı aynı bilgiyi okur.

## MALIYET-22 — Hammadde fiyatı satırda değil ŞERİTTE yaşar.

Kullanıcı isteği (18.08.2026, md. 12) ve ön tanımlı sekiz fiyat: sac 0,70 ·
profil 0,65 · kare ray 0,90 · A tipi ray 1,20 · kesim 0,05 · çelik imalat
işçiliği 0,90 · boya 0,08 · boya işçiliği 0,07 €/kg.

**RAY İKİYE AYRIDIR çünkü FİYATLARI İKİ KATI KADAR AYRIDIR** (0,90 ↔ 1,20).
Tek bir "Ray" satırı, kare ray kullanan bir vinçte %33 fazla, A tipi kullanan
bir vinçte %25 eksik maliyet çıkarırdı — ve hangisi olduğu ekrandan
okunamazdı. `rail` ANAHTARI KORUNDU (kare), `railA` eklendi: bir alan eklemek
eski belgedeki satırı yetim bırakmanın gerekçesi olamaz.

**BU BİR FİYAT ARAMALI TABLO DEĞİLDİR** (MALIYET-4 çiğnenmiyor). O kural
kapasiteye bakıp motorun kaç € olduğunu söyleyen tablolara karşıdır. Buradaki
sekiz sayı aranmaz, GÖRÜNÜR: şeritte, kutunun içinde, düzeltilmeyi bekleyerek
durur.

**İKİ KAYNAK ASLA TOPLANMAZ** (`linePrice`, `lineQty`nin ikizi): `priceSource`
doluysa fiyat şeritten okunur ve kutu salt okunur çizilir; `priceManual` açıksa
o satırda insan yazar ve şerit ona dokunmaz.

**VARSAYILAN YENİ BELGEYE UYGULANIR, TAŞIMAYA DEĞİL** (`withDefaultRates` ile
aynı ayrım): `emptyCostPayload` sekizini de kopyalar, `withCostDefaults`
kopyalamaz — orada bir varsayılan uygulamak kullanıcının bilerek boşalttığı
fiyatı geri getirmek olurdu.

**ŞERİT BELGEDE DE BASILIR.** Sekiz sayı maliyetin tabanıdır; iç belgede
görünmeselerdi "bu 194.258 € hangi sac fiyatıyla çıktı" sorusu cevapsız
kalırdı — ve o soru tam olarak altı ay sonra sorulur.

## MALIYET-23 — GÖTÜRÜ KİP satırları silmez, SAYMAZ.

Kullanıcı isteği (18.08.2026, md. 10): *"Elektrik Otomasyon fiyatında istersem
tek fiyat girebileyim. Bir tuş olsun."* Tedarikçi kimi zaman panoyu, sürücüyü
ve işçiliği TEK KALEMDE fiyatlar; o teklifi on üç satıra bölmek uydurma bir
dağılım üretirdi (değişmez md. 4).

**KİP BİR BAYRAKTIR, BİR TAŞIMA DEĞİL** (`CostGroup.lump`): satırlar ne silinir
ne `hidden` işaretlenir. Hangi satırların sayılacağını `costGroupLines` kipe
bakarak söyler ve toplam, ekran, belge üçü de o tek fonksiyondan geçer.
Gizleyerek geçmek daha kolaydı ve bir şeyi bozardı — kullanıcının KENDİ
gizlediği satırlar geri dönüşte açılır, yani bir düğmeye basmak başka bir
kararı sessizce silerdi.

**HER GRUPTA AÇIKTIR**, yalnız elektrikte değil: kullanıcı örneği elektrikti
ama sebep geneldir, tedarikçi yürütme grubunu da tek kalemde fiyatlayabilir.

**GÖTÜRÜ SATIR SİLİNEMEZ** (kipin taşıyıcısıdır) ve anahtarı grup anahtarından
türer (`gotur-electrical`), yani götürüye geçip geri dönen bir grup aynı satırı
bulur — girilen götürü fiyat her turda kaybolmaz.

**BELGEDE KİP YAZAR.** `printedCostPayload` götürü kipte kalem satırlarını
süzer; işaret olmasaydı okuyan on üç satırlık bir grubun neden tek satır
bastığını anlayamaz, "eksik basılmış" sanardı.

## MALIYET-24 — Ekran ile belge AYNI TÜRETMEDEN geçer.

Editör durumu her güncellemede `withCostDerived`ten geçer: model miktarları ve
şerit fiyatları satırlara YAZILI olur, toplamlar da öyle. Sunucudaki kaydetme
yolu (`saveOfferCostRevision`) aynı fonksiyonu çağırır.

Ekranda çözüp belgeye yazmamak daha az iş olurdu ve bir şeyi bozardı: hammadde
şeridinden sac fiyatını değiştiren kullanıcı grup toplamının değiştiğini görür
ama PROJE MALİYETİ satırı eski kalırdı — çünkü toplam (`costTotals`) saf
aritmetiktir, şeridi okumaz. İki farklı toplamın aynı ekranda dolaşması,
hangisinin belgeye gideceğini ekrana bakarak anlaşılmaz yapardı.

**EZİLEN DEĞER YARIM AKMAZ.** `c.sectionInertiaCm4` ezilince kesit de yeniden
seçilir: ataleti elle büyüten mühendisin sehimi düzeliyor ama kesit pop-up'ı ve
kg/m eski kesitte kalıyordu — ekran aynı anda iki farklı kiriş anlatıyordu.

## MALIYET-25 — Satır altı metin DİKEY BORÇTUR.

Kullanıcı isteği (18.08.2026, md. 8): *"Maliyetler sayfasında satırların
altında yazan yazıları satırların yanına kutuya yazalım. dikeyde yer
kaybetmeyelim. Daha çok satırı bir arada görebileyim. Yatayda yerimiz çok
zaten."* Ölçüldü: satır 84 px → 49 px.

Üç metnin üçü de ayrı bir yere gitti ve hiçbiri KAYBOLMADI:

- **"Teklifte: …"** kendi SÜTUNUNA taşındı (`xl`den itibaren görünür).
- **"Miktar: …"** türetme pop-up'ına girdi — zaten yalnız alanın ADINI
  söylüyordu, pop-up formülü ve ara değerleri de veriyor (md. 9).
- **Defterin `hint`i** satırın adının `title`ına ve pop-up'a bağlandı. Bu üçüncü
  adım ATLANMIŞTI ve gerçek bir kayıptı: "Profil ve Ray miktarı modelden
  gelmez" bilgisi ekrandan düşünce boş bir miktar hata gibi okunur.

**KIRILIM AYNI SAYFANIN ALTIDIR** ve üç özet blok YAN YANA durur: birleştirme
sayfayı üç ekran boyuna uzatsaydı kullanıcı kırılıma inmek için her seferinde
bütün maliyet tablosunu geçmek zorunda kalırdı.

**TABLO KENDİ KAYDIRMA KABINI SARMAZ.** `Table` zaten `.oc-scrollx
overflow-x-auto` bir kap çiziyor; ikinci bir sargı iç içe iki yatay kaydırıcı
ve üst üste iki kenar gölgesi demekti (MOBIL-14).

## MALIYET-26 — Kalem adları BÜYÜK HARF; ad bir TUTAR değildir.

Kullanıcı isteği (19.08.2026, md. 3). Defterdeki 53 satır adı, 8 grup başlığı ve
8 hammadde şeridi adı büyük yazıldı; ayrıca `payload.ts`in ad geçidi (`lineFromRaw`,
`groupFromRaw`, götürü satır) `adBuyuk`tan geçiriliyor, yani kayıtlı belgeler de
okunurken büyüyor.

**ESKİ ADLAR İÇİN MİGRATION YAZILMADI** ve bu bilinçli: `withCostDefaults` hem
okuma hem kaydetme yolunda koşar, ad geçitte büyür. Yayımlanmış bir M
revizyonunun satırı yeniden YAZILMAZ, yalnız görüntüsü büyür — **ad bir TUTAR
değildir**, MALIYET-2'nin değişmezliği rakamı korur, yazımı değil.

**BÜYÜTÜLMEYENLER:** `labels.ts`teki 81 MODEL alan adı (Ağırlıklar/Hesaplar
sayfaları) ve `compare.ts`teki sapma şeridi adları. Onlar kalem değil, mühendislik
değeridir.

## MALIYET-27 — Lazer/CNC kesim FİRELİ kilodan fiyatlanır.

Kullanıcı isteği (19.08.2026, md. 8): *"Maliyetler kısmında Lazer / CNC Kesim
maliyeti de Çelik + Fire ağırlığı gelmeli."* `laserCut` satırının `qtySource`u
`w.steel` → `w.steelWithFire`.

Gerekçe fiziktir: kesilen şey satın alınan sacdır, fire dahil. Sac (18.08) ve
kesim (19.08) artık fireli kiloyu okur; `w.total` yalnız BOYA'nın miktarıdır.
MALIYET-14'ün "fire yalnız işçiliğe biner" cümlesi bu iki kararla eskidi.

**GERİYE DÖNÜK TAŞIMA OKUMA YOLUNA YAZILMADI**: kaynağı okuma yolunda
değiştirmek yayımlanmış M revizyonlarının kesim satırını büyütür, `total_amount`
üretilmiş sütunu ise yalnız kaydetmede tazelendiği için ekran ile veritabanı
ayrışırdı. Bunun yerine TAZELEME yolu (`withDefterLines`) genişletildi: defterde
değişen `qtySource`/`priceSource` "Tekliften Tazele" ile gelir — ama yalnız
`qtyManual`/`priceManual` kapalıysa. Elle devralınmış bir miktar korunur.

## MALIYET-28 — BORVERK İŞLEME: kaldırma ve yürütme gruplarında.

Kullanıcı isteği (19.08.2026, md. 9). Teker göbeği ve kaldırma grubu
gövdelerinin büyük delik tezgâhında işlenmesi ayrı bir kalemdir ve bugüne kadar
"TALAŞLI İMALAT"ın içinde görünmez biçimde duruyordu.

Satır ana kaldırma, YARDIMCI kaldırma ve yürütme gruplarında açılır — yardımcıya
da girer çünkü iki liste tek fonksiyondan üretilir ve orada unutulan satır en geç
fark edilen eksikliktir. Birim "takım" × 1'dir, "saat" değil: kardeşi TALAŞLI
İMALAT öyle ve saat cinsinden bir miktarı model üretmiyor — uydurma bir saat
sayısı yazmak yasaktır (değişmez md. 4). Saatle fiyatlamak isteyen kullanıcı
miktarı elle devralabiliyor.

## MALIYET-29 — `costOverview`: belgenin TEK genel özeti.

Kullanıcı isteği (19.08.2026, md. 13): maliyet bugün kalem kalem çalışıyor;
kullanıcı ayrıca **tüm vinçleri + teklifin fiyat satırlarına elle yazdığı
maliyetleri + çelik ve toplam vinç ağırlıklarını** tek görünümde istiyor.

`costOverview(totals, offer, steelWeights)` (`cost/totals.ts`) saf çekirdektir;
ekran, PDF ve Excel ONU okur. İki yerde iki toplam dolaşırsa MALIYET-24'ün
anlattığı ayrışma kaçınılmazdır.

Özet planda olmayan bir alan da taşır: **`uncostedItems`** — maliyeti hiç
açılmamış bir teklif kalemi fiyat toplamına girip maliyet toplamına girmiyor ve
kârı olduğundan yüksek gösteriyordu. Özet onu saymaz ama SÖYLER.

## MALIYET-30 — İç belgede sütun yönü: `flex` bir kısayol değil, bir YÖN kararıdır.

Kullanıcı bildirimi (19.08.2026, md. 12): *"PDF indir tuşuna bastığımda inen pdf
belgede çakışma kaymalar var."* Belgede 36 yerde metin üst üste biniyordu.

Sebep tek satırdı: `S.etiket`teki `flex: 1`. Etiket bir SÜTUN kutusunun içinde
durur (altında "Teklifte: …", "elle girildi", "Miktar: …" notları) ve sütun
yönünde `flex: 1` yoga'da `flexBasis: 0` demektir — bu, **yüksekliği** sıfırlar:
etiket sıfır boyda ölçülür, altındaki not aynı taban çizgisine çizilir. Genişliği
zaten sarmalayan kutu veriyordu. Satır yönündeki kaplar için ayrı bir
`S.satirEtiket` stili vardır ve çıplak `flex: 1` dosyadan tamamen kaldırıldı.

Aynı turda: damga içerik ızgarasına hizalandı (kâğıdın 0,85 mm yanında
duruyordu), maliyet grupları ve oranlı gruplar SAYFA BÖLEBİLİR oldu (kullanıcının
serbest satırlarıyla sınırsız büyürler), ağırlık/hesap bölümleri ise bilerek
bölünmez kaldı (alan sayıları KODDA sabit, en kalabalığı ≈240 pt).

**Duman testi artık GEOMETRİ de ölçer** (`scripts/test-offer-cost-pdf.ts`): aynı
taban çizgisinde yatay örtüşen metin kutusu yok ve her kutu 62,4–549,9 pt içerik
sütununda. İki sav da bilerek bozularak sınandı.

## MALIYET-31 — Maliyet ekranı: Özet, iki sütun, Excel, girdi eşitlemesi.

Kullanıcının 19.08.2026 turu (md. 2, 6, 7, 11, 13).

**ÖZET İLK BÖLÜMDÜR** ve kalem seçici taşımaz: sorusu "bu vinç ne tutuyor"
değil, "bu teklif ne tutuyor". Bütün sayıları `costOverview`den okur (MALIYET-29)
— ekran tek bir toplamı bile kendi hesaplamaz.

**"MALİYETLER" İKİ SÜTUNA AYRILIR, EŞİK ÖLÇÜLMÜŞTÜR.** Satır tablosunun gerçek
en küçük genişliği tarayıcıda 781 px çıkıyordu; 1600 px'lik pencerede iki sütuna
bölününce sütuna 615 px kalıyor ve tablo KENDİ İÇİNDE yatay kaydırma açıyordu.
İki düzeltme birlikte yapıldı: eşik `2xl` (1536) yerine ölçülen `1800 px`, ve
Kalem sütununun `2xl:min-w-[18rem]` tabanı KALDIRILDI — `min-w` bir taban olduğu
için artan yeri sütun zaten alıyordu, o kural yalnız en küçük genişliği şişirip
geniş ekranda okunurluğu bozuyordu.

**GİRDİ EŞİTLEMESİ ÖNCE SÖYLER, SONRA UYGULAR** (`input-sync.ts`). Eksik olan
"hesap" değildi: ağırlıklar ve hesaplar zaten her tuş vuruşunda yeniden koşuyor.
Geride kalan GİRDİLERDİ — "Tekliften Tazele" yalnız BOŞ alanı doldurur ve doluyu
bilerek ezmez (MALIYET-9), o kural teklifteki açıklık gerçekten değiştiğinde ters
yönde ısırır. "Teklifle Eşitle" düğmesi farkları önce listeler ("Açıklık 30 →
28"), onaydan sonra uygular ve model ÇIKTISI ezmelerine (ana kiriş ağırlığı,
seçilen motor) HİÇ dokunmaz — biri belgeyle eşitleme, öteki mühendisin bilgisini
atma kararıdır.

**EXCEL PDF'İN YANINDADIR** ve aynı veriden üretilir ama başka bir soruya cevap
verir: PDF okunacak bir BELGEDİR (arşive girer, İÇ BELGE damgası taşır), Excel
üzerinde ÇALIŞILACAK bir çizelgedir — hücreler metin değil SAYIDIR, para birimi
hücrenin biçimindedir ve toplanabilir.

**GİRDİ IZGARASI HİZALIDIR** (`ALAN_IZGARASI` + `grid-rows-subgrid`): eskiden her
kutunun genişliği elle veriliyordu ("6.5rem", "9rem", "10rem") ve satır sonunda
artan yer son kutuya düşüyordu — ilk satırda sekiz, ikincisinde altı alan vardı
ve hiçbir sütun alt satırdakiyle hizalanmıyordu. Vinç Sınıfı seçicisi de aynı
ızgaranın hücresidir; kendi `w-24`ü ile çizilseydi komşularının rayına oturmazdı.

## MALIYET-32 — Maliyet şablonu GERÇEK açılış defteridir; özel kalem taşır.

Kullanıcı kararı (20.08.2026) MALIYET-9'daki tarihî “şablon tablosu yoktur”
kararını değiştirir. Etkin `offer_cost_templates` satırları hem **Yeni Maliyet**
açılışında hem açık **Tekliften Tazele** eyleminde okunur ve `withOfferSync`e
parametre verilir. Okuma başarısızsa sessizce varsayılana düşülmez; kullanıcıya
Türkçe hata döner. Aksi hâlde ekran bir şablon uyguladığını söylerken başka bir
belge kurardı.

İskelet üç karar taşır: açılacak gruplar (`groupKeys`), açılmayacak kod-defteri
satırları (`closedLines`) ve tipe özel elle fiyatlanan satırlar (`customLines`).
Özel satırın kalıcı anahtarı `sablon-<uuid>`, adı BÜYÜK, birimi `COST_UNITS`
listesindendir; **miktar ve birim fiyat boş açılır**, model/hammadde kaynağı
uydurulmaz. Aynı bölümde kod defteriyle veya başka bir özel satırla aynı ad
reddedilir.

Şablon tazelemesi EKLEYİCİDİR: yeni özel kalemi mevcut maliyet grubunun sonuna
ekler; şablondan kapatılan ya da kaldırılan hiçbir satırı kayıtlı maliyetten
silmez. Bu yüzden fiyat girilmiş bir satır, defter kararı sonradan değişti diye
kaybolmaz. Maliyet Şablonları ekranı telefonda vinç tipini tek seçiciden açar,
masaüstünde sabit sol defteri korur; kalemler kırmızı çip değil sarmalanan okunur
satırlardır ve 320 px'te yatay sayfa kaydırması üretmez.

## MALIYET-33 — Hammadde fiyatı global defterden SNAPSHOT alınır, canlı bağlanmaz.

Kullanıcı kararı (20.08.2026) MALIYET-22'nin “fiyat yalnız payload'da yaşar”
kararını genişletir: güncel açılış değeri artık `offer_cost_material_prices`
defterindedir; **yeni maliyet çalışması açılırken** sekiz fiyat payload'a
kopyalanır. Sonraki bütün hesaplar yine payload kopyasını okur ve kullanıcı o
teklif içinde fiyatı ayrıca değiştirebilir. Global defter değişince geçmiş
belge değişmez; sonraki maliyet revizyonu da önceki revizyonun snapshot'ını
taşır. Defter okunamazsa sessizce kod sabitine düşülmez, yeni maliyet açılmaz.

Tohum sırası ve değerleri: SAC 0,70; PROFİL 0,70; KARE RAY 0,90; A TİPİ RAY
1,10; KESİM 0,10; ÇELİK İMALAT İŞÇİLİĞİ 0,74; BOYA 0,08; BOYA İŞÇİLİĞİ
0,07 €/kg. Kod listesindeki değerler göç tohumu ile test/önizleme yedeğidir,
canlı teklifin gizli ikinci fiyat kaynağı değildir.

## MALIYET-34 — Paket toplamı yalnız paket sütununu toplar; sonuçlar tam sayıdır.

`CostOverview.packageTotal = Σ items.package`. Proje geneli ve oranlı giderler
bu hücreye GİRMEZ; onlar `documentTotal`ın parçasıdır. Özet tablosunun paket
toplamına belge toplamını yazmak, görünen satırların toplamını tutturulamayan
bir sütun üretmişti.

Maliyet ekranı, özeti, iç PDF ve Excel'in sonuç/tutar/ağırlık/yüzde hücreleri
ondalıksız görünür. Excel hücresi yine SAYIDIR (`#,##0`), metne çevrilmez.
Hammadde ve ona bağlı €/kg birim fiyatları bu kuralın bilinçli istisnasıdır:
0,74'ü tam sayıya biçimlemek 1 €, 0,08'i 0 € gösterir ve maliyeti anlaşılmaz
kılar. Manuel tutar kutuları odak dışındayken binlik ayırır (`10000` →
`10.000`).

## MALIYET-35 — Maliyet grubu yatay kaymaz; PROJE GENELİ de iki sütun ızgarasındadır.

Satır tablosu `table-fixed` ve yüzde sütunludur. “Teklifte” metni küçük iki
satıra sarar; miktar sütunu %13'tür ve model düğmesiyle birlikte daralmaz.
Tablo kabı yatay kaydırma açmaz. Bu, MALIYET-31'deki 781 px taban/1800 px eşik
kararını **değiştirir**: sabit ızgara gerçek tabanı kaldırdığı için iki sütun
1500 px'te güvenle açılır. PROJE GENELİ belge düzeyindeki veri olmaya devam
eder ama görsel olarak aynı iki sütun ızgarasına girer; tam genişlikte tek
başına uzamaz.

Birim DEĞERİ kanonik küçük yazımla saklanır (`adet`, `takım`, `kg`); sunumda
Türkçe başlık düzeni kullanılır (`Adet`, `Takım`, `Saat`, ama SI birimi `kg`
korunur). Böylece filtre/eşleşme tek değerde kalırken arayüz profesyonel yazılır.

## MALIYET-36 — Şablonun “Kalem Ekle” kapısı katalog + yeni kalemdir.

Dialog önce mevcut seçenekleri verir: o bölümde kapatılmış kod-defteri satırı
seçilirse yeniden açılır; kullanıcı kataloğundaki satır seçilirse özel satır
olarak eklenir; “Yeni Kalem Oluştur” ad + birim ister. Yeni özel kalem şablonla
birlikte `offer_cost_line_catalog`a yazılır ve sonradan şablondan kaldırılsa da
dropdown'da kalır. Göç öncesi şablon JSON'larında bulunan özel kalemler de
okuma sırasında kataloğa katılır; eski veri yeni listeye geçişte kaybolmaz.
