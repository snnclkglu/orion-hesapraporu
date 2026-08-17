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
