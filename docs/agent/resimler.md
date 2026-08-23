# Teknik Resimler

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/resimler.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/drawings/**` · `src/lib/drawing-plan.ts` · `src/lib/drawing-plan-data.ts` · `src/lib/drawings.ts` · `src/app/(app)/drawings/**` · `scripts/test-drawings*.ts` · `scripts/test-normalize.ts`

## RESIM-20 — Teknik Resim Takibi PLANDIR, teslim değil.

`project_drawing_plan`
mühendisin proje BAŞINDA verdiği ana grup numaralandırmasıdır ve
`/drawings` modülüne HİÇ BAĞLANMAZ (kullanıcı kararı): `drawing_packages`
ressamın teslim ettiğinden doğar, bu defter teslimden aylar önce yazılır.
Proje sayfasındaki sekme bu yüzden üç katmanlıdır ve sıra ZAMAN SIRASIDIR —
plan → doğrulanmış paketler → kapanmış eski Drive defteri.

Numara `<iş kalemi no>-<grup kodu>`dur (`0055-00-0100`). Bant kuralı
firmanındır ve TEK yerdedir (`lib/drawing-plan.ts`): köprü 0100–1400,
**ANA ARABA 1500–2200, YARDIMCI ARABA 2300–2900**, ekstra 3000–3900.
**Bant bir sütun DEĞİL koddan türeyen bir sonuçtur.** Vinçte iki araba
olabilir ve ikisinin resimleri ressam için ayrı iki takımdır; aradaki
2201–2299 boşluğu bilinçlidir. **ADIM 100'DÜR** (kullanıcı kararı,
11.08.2026) — bir süre 50 idi çünkü devralınan antedlerde ara numara vardı
(`0019-00-0950`); firma numaralandırmayı yüzlüklere sabitledi. Ara numara
YASAK DEĞİLDİR: yazılmış bir "0950" kendi bandında görünmeye devam eder ve
seçicide kendi seçeneği olarak korunur, yalnız yeni numara olarak
önerilmez. Kalem numarası deftere KOPYALANMAZ; `job_items.item_no` tek
kaynaktır ve `autoItemNos` onu kaydırabilir (md. 14).

**DURUM BİR KUTU DEĞİL BİR ETİKETTİR ve yüzde ondan TÜRETİLİR.** İlk
sürümde tek bir `drawn` boolean'ı vardı; gerekçesi "ara durumlar teslim
edilmiş paketin durumudur" idi ve YANLIŞTI — paket teslim edilene kadar
`drawing_packages` hiçbir şey bilmez, o aylar boyunca "bu grup ne durumda?"
sorusunun tek cevabı bu defterdir. Beş değer: `bekliyor · ciziliyor ·
revize · kontrol · cizildi` ve her birinin bir AĞIRLIĞI var (0 · 50 · 60 ·
80 · 100, TAM SAYI — ondalık ağırlıklarda 0,5 + 0,8 kayan noktada dört
gruplu bir defterde yüzdeyi bir puan kaydırıyordu). Liste `check` kısıtıyla
kapalıdır: serbest metin bir sayıya çevrilemezdi. `drawn` sütunu DÜŞÜRÜLDÜ,
yanında bırakılmadı. **%100 yalnız her satır "Çizildi" iken çıkar** —
50 çizilmiş grubun yanındaki tek kontrol satırı %99,6 eder ve yuvarlama
bitmemiş bir işi bitmiş gösterirdi; `drawingPlanProgress` orada %99'da
kelepçeler.

Ekran OTOMATİK DOLDURMAZ (karar mühendisin). **Grup adı alanı SERBEST
METİN kutusudur** (`components/editable-combobox.tsx`), açılır liste değil:
ekstra gruplarda (kepçe, mıknatıs, müşteriye özel aparat) hazır listenin
karşılığı çoğu zaman yoktur ve `Combobox`ta listede olmayan bir ad ancak
arama kutusuna yazıp "+ Ekle" satırına basarak giriliyordu — iki adım, ve
kutunun yazılabilir olduğu ilk bakışta görünmüyordu. Öneriler satırın
KENDİ BANDINDAN başlar. Grup adedi ve ağırlık SORULMAZ — onlara ressam
çizerken karar verir. Defter Teknik Ressam Özeti'nin sonuna basılır
(panel + Excel + PDF) ama `CalcInput`a GİRMEZ: snapshot'a gömülseydi proje
başında verilmiş karar her revizyonda donardı.

**ÇİZEN BİR BAĞDIR, SERBEST METİN DEĞİL** (`drawn_by` → `profiles.id`,
kullanıcı kararı 12.08.2026: *"Not bölümünün soluna, çizen teknik ressamı
dropdown seçebileyim. Ressam ve Mühendis rolündekiler listelensin. Önce
ressamlar."*). Ad metin olarak yazılsaydı aynı kişi "Alkım", "Alkım
Kelleci" ve "A. Kelleci" olarak üç ayrı kişi gibi görünür ve "bu kişi neler
çiziyor" sorusu hiç cevaplanamazdı (md. 17'deki parça adı dersinin aynısı).
Kişi silinirse alan BOŞALIR, satır silinmez (`on delete set null`).

**ROL SÜZGECİ VERİTABANINDA DEĞİL** (`lib/roles.ts:DRAWING_AUTHOR_ROLES`,
sıra dâhil): hangi rollerin listeleneceği bir SUNUM kararıdır ve zamanla
değişir. `check (role in ...)` gibi bir kısıt konsaydı, bir kişinin rolü
değiştiğinde ONUN GEÇMİŞTE ÇİZDİĞİ satırlar da geçersiz olurdu — oysa o
resimleri gerçekten o çizdi. Aynı sebeple seçici, listeden düşmüş bir kişiyi
"Listede Değil" başlığı altında SEÇENEK OLARAK KORUR; korumasaydı dolu bir
alan ekranda boş görünür ve kullanıcı üzerine yazardı. Ad hem kimlikle
birlikte taşınır (`drawnByName`) çünkü salt-okunur kipin elinde kişi listesi
olmayabilir. Sütun ekipman listesi ÇIKTILARINA (Excel/PDF) BASILMAZ — o
belgeler "hangi numara" sorusunu cevaplar, "kim çizdi" sorusunu değil.

**Sayfa MARKA + MODEL ile bulunur; bölümün o kimliği SAKLIYOR olması
gerekir.** Redüktör (2.3 / 5.5), yürütme freni (5.5b) ve tampon (5.8)
eşlemelerinde kimlik tek bir birleşik `brand_model` alanındadır;
`catalogIdentityFields` bunu `combinedField` olarak verir ve defter marka
önekini kendisi ayıklar. Motor eşlemesinde ise MODEL alanı hiç yoktu —
`motorModel` bu yüzden eklendi. Bu bağ koptuğunda hiçbir test kırılmaz,
düğme sessizce pasif kalır: koruma `__tests__/catalog-sheets.test.ts`tedir.

Kapsam: kaplin · rulman · rulman yatağı · fren · tampon · redüktör
(Yılmaz + FLENDER + POLAT + SEW) · motor (ABB, GAMAK, INNOMOTICS, SEW) ·
feston (Vasel + Conductix-Wampfler) · **halat** (CASAR, Haşçelik,
OLIVEIRA, DIEPA). Kanca, makara, teker ve ray kataloglarının kaynak PDF'i
workspace'te olmadığı için deftere giremez; TMS klima kataloğu ise yalnız
web sayfalarından derlenmiştir. Halatta model kodu YOKTUR (seed onu
ölçüden kurar: "Ø14 Eurolift IWRC 1960 MPa"), bu yüzden `db_model`
halat türünde `meta.series`i de okur ve sayfa kanıtı model kodu yerine
ÇAPTAN gelir. Feston kataloğunda süzgeç SERİ LİSTESİ yerine
ALAN SÖZLÜĞÜ de olabilir (`{"series": [...], "cable_form": [...]}`): aynı
program yassı ve yuvarlak kabloyu ayrı sayfada basar, seri kodu ikisinde
de aynıdır. Workspace'teki FB0300-0005-E feston dosyası bir SORU FORMUDUR
ve deftere GİRMEZ; ürün kataloğu KAT0320-0003-EN'dir.

**Üçüncü yol — BAŞLIK TARAMASI (`HEADER_SCAN`).** Bazı kataloglar ölçü
sayfalarını ürün ürün değil TİP + BOY ARALIĞI olarak basar ("Type H3 —
Gear unit dimensions, three-stage, gear unit sizes 13 to 18"). Orada
sayısal keşif çalışmaz, elle harita ise yüzlerce satır olurdu; sayfa
BAŞLIĞI okunur ve aralığa düşen bütün boylar o sayfaya bağlanır. FLENDER
MD 20.1 böyle haritalanır ve yalnız YATAY montaj bölümleri (böl. 4 ve 6)
alınır — defter model başına tek sayfa seti tutar.

## RESIM-18 — Teknik Resimler HOŞGÖRÜLÜ ANLAR, biçim DAYATMAZ.

`/drawings` teknik
ressamın klasörünü olduğu gibi alır, içindekini okur ve **neyi
anlayamadığını söyler**. Kural şu ölçülmüş gerçekten çıktı: incelenen iki
teslim klasörü birbirine benzemiyordu (`0057-00-0500 - MONORAY (1 TON)` —
174 dosya, düz yapı, tireli ad ↔ `0043-00-0000_MTC PASLANMAZ` — 454 dosya,
üç seviye iç içe, alt çizgili ad; 1 ↔ 7 Excel; 7/9/11/13/14 sütun).
Üçüncüsü de benzemeyecek. **Bir ressamın klasörünü sistemin reddetmesi, o
ressamın bir daha sistemi kullanmaması demektir.**

Dört ilke, dördü de pazarlığa kapalı:

1. **HİÇBİR KURAL BİR YÜKLEMEYİ ENGELLEMEZ.** Tanınmayan dosya reddedilmez —
   saklanır, "tanınmadı" diye listelenir, elle bağlanabilir ve o bağ
   `drawing_aliases`a yazılıp **hatırlanır**. Sistem kullanıldıkça
   hoşgörüsünü kaybetmeden daha çoğunu anlar.
2. **`engelleyici` DİYE BİR BULGU DÜZEYİ YOKTUR** ve eklenmeyecek. Üç düzey
   vardır: `eksik · celiski · bilgi` (`lib/drawings/types.ts`). Hesap
   motorundaki `engelleyici`nin (md. 4) burada karşılığı OLAMAZ, çünkü
   yükleme her zaman başarılıdır; rapor yalnız insanın neye bakması
   gerektiğini söyler.
3. **YANLIŞ ALARM BU MODÜLÜN EN BÜYÜK DÜŞMANIDIR.** Yeni bulgu eklemeden
   önce fikstüre karşı KAÇ KEZ tetiklendiğini ÖLÇ. Üç kural ölçülüp
   kesildi: `Testere` kalemlerinden resim beklemek (13 bulgunun 12'si
   yanlıştı), alt montajdan DXF beklemek, gevşek `GRUP_BOLUNMUS` (7 yanlış
   alarm). `ICERIK_OKUNMADI` ve `DOSYA_DEPODA_YOK` **paket başına TEK**
   bulgudur — dosya başına yazılsalardı MTC'de 270 ve 162 satır ederdi ve
   gerçek bulgular o gürültüde kaybolurdu. Sessizlik çoğu zaman doğruluktur.
4. **RAPOR DİLİ SUÇLAMAZ.** "Standart dışı" değil "tanıyamadım"; "hatalı"
   değil "iki kaynak farklı söylüyor". Tanıma oranı ressamın notu değil
   **sistemin kavrayışıdır** — `recognitionClass`ta kırmızı yoktur.

**Çekirdek SAFTIR** (`src/lib/drawings/`, DB/HTTP importu yok): `reconcile`
bir anlık görüntü alır, defter + bulgu döndürür. Bu sayede kural
değiştiğinde 200 MB'lık paket YENİDEN İNDİRİLMEDEN yeniden çalıştırılır
(`RECONCILER_VERSION`, hesap motorundaki `ENGINE_VERSION` ile aynı ruhta).
Tek regex yerine **sıralı tanıyıcı listesi** (`recognize.ts`); dosya adı
`" - "` ile bölünüp her parça kendi başına sınıflandırılır, **sıra
önemsenmez**. Excel sabit şemayla değil **sütun sözlüğüyle** okunur.

**YÜKLEME AKIŞI BİLEŞENDE DEĞİL MODÜLDE YAŞAR** (kullanıcı bildirimi,
12.08.2026: *"klasörü yükle'ye bastıktan sonra kullanıcı sayfadan çıkarsa
yükleme duruyor"*). Duruyordu, çünkü akış `folder-picker.tsx`in
gövdesindeydi ve istemci gezinmesi bileşeni SÖKER. Durum ve akış bir kat
yukarı alındı: `new/upload-store.ts` (modül düzeyinde `useSyncExternalStore`
deposu) + `new/upload-runner.ts` (akışın kendisi). Bir ES modülü sekme ömrü
boyunca tek kez değerlendirilir ve gezinmede sökülmez; bileşen artık o
durumun bir GÖRÜNTÜSÜDÜR ve geri dönüldüğünde kaldığı yeri bulur.
Üç kural bunun parçasıdır:
- **YÖNLENDİRMEYİ AKIŞ YAPMAZ.** Biten yükleme yalnız `tamamlananPaketId`
  yazar; rapora gitme kararını "o an ekranda olan taraf" verir. Başka bir
  sayfadaki kullanıcıyı rapora atmak arka planda çalışmanın anlamını
  götürürdü.
- **GÖRÜNMEYEN İŞ OLMAYAN İŞTİR.** `new/upload-indicator.tsx` kabuğun
  içindedir (`AppShell`), sihirbazın kendi sayfasında çizilmez ve iş yokken
  hiçbir şey basmaz. `beforeunload` uyarısı da oradadır.
- **SINIR AÇIKÇA SÖYLENİR:** bu bir servis işçisi değildir — sekmeyi
  kapatmak ya da sayfayı YENİLEMEK akışı yine keser. Kesilen yükleme
  kaybolmaz; paket açılmıştır ve "Eksikleri Yükle" sürdürme kipi kaldığı
  yerden devam eder. Durum `localStorage`a YAZILMAZ: içinde canlı `File`
  tutamaçları var ve arkasında hiçbir şey koşmayan bir ilerleme çubuğu
  göstermek bu ekranın en pahalı hatasıdır.

**BEYAN İLE ÖLÇÜM AYRI DURUR.** `file_count`/`bytes_total` satırlardan,
`stored_*`/`skipped_*` ise bucket'ın kendisinden gelir ve dördünü de tek
bir yer yazar: `verifyStorage`. İkinci bir yazan eklenirse ekran
"170/169 dosya depoda" gibi kendi kendiyle çelişen sayılar basar — bu bir
kez yaşandı. **Atlanan dosya EKSİK DEĞİLDİR:** yedek dosyalar ve bayt bayt
kopyalar bilerek yüklenmez (`upload_skipped`) ve onları "ulaşmamış" saymak
doğrudan md. 3'ü çiğner. Bayt karşılaştırmasının paydası da
`bytes_total − skipped_bytes`tir; ham toplamla karşılaştırmak hiçbir bayt
kaybetmemiş pakette bile kalıcı olarak "15 MB eksik" gösterirdi.

**İLERLEME PAKETE DEĞİL PARÇAYA BAĞLIDIR.** `drawing_parts` TÜRETİLMİŞTİR
ve her eşleştirmede silinip yeniden kurulur; atölyenin "bu parça kesildi"
kaydı o döngüde kaybolmamalıdır. Anahtar bu yüzden `(item_no, part_code,
stage)` METNİDİR, `package_id`/`part_id` yalnız kolaylık bağıdır
(`on delete set null`) — İş Takibi'nin dersinin (md. 17) birebir aynısı.
Revizyonda kayıt **devrolur**; imalatı etkileyen bir değişiklik varsa
(`MANUFACTURING_DIFF_FIELDS`: ölçü · malzeme · kalınlık · adet · kategori)
`review_required` işareti alır. Tanım ya da ağırlık değişikliği işaret
ÜRETMEZ: ağırlık türetilmiş bir sayıdır, tanım düzeltmesi kesilmiş parçayı
yanlış yapmaz — ikisi de listeye girseydi her revizyonda her kayıt
işaretlenir ve işaret anlamını yitirirdi. **İşaret bir SORUDUR ve onu
yalnız insan kapatır** (`setReviewMark`); devir işaret KOYAR, KALDIRMAZ.

**ATÖLYE TAHTASININ GRUP BAŞLIĞI GRUBU AÇMADAN TANITIR** (kullanıcı
isteği, 13.08.2026: *"0000 0/2 gibi yazan ana yerin yanına o projenin
ismini de yazalım … açmadan da görmek isterim, hem ismini hem adedini."*).
Başlık yalnız kodu gösteriyordu ve gruplar varsayılan olarak KAPALI
olduğundan foreman hangi grubu açacağını anlamak için tek tek açıp
kapatıyordu.

**AD YENİDEN ÇIKARILMAZ, DEFTERDEN OKUNUR** (`drawing_group_names`). Kural
`grupAdlariCikar`dadır ve eşleştirmede bir kez çalışır; burada ikinci bir
çıkarım yazmak, satın alma havuzunun gösterdiği adla atölye tahtasının
gösterdiği adın bir gün ayrışması demekti — üstelik defter elle düzeltmeyi
de taşır (`manual`) ve ekran onu görmezden gelemez. **ADI KODUN KENDİSİ
OLAN satır DÜŞÜRÜLÜR**: defter adı çözemediğinde kodu yazıyor ve başlıkta
aynı kodu iki kez basmak bilgi değil gürültüdür.

**ADET GRUBUN KENDİ DEFTER SATIRINDAN OKUNUR** (`groupOwnPart` — kodu alt
segment TAŞIMAYAN satır, `0043-00-1000`). O satır ürün ağacında montajın
kendisidir ve `qty`si "kaç takım imal edilecek" sorusunun cevabıdır. Satır
yoksa adet HİÇ BASILMAZ; alt parçalardan bir adet türetilmez — uydurulmuş
bir "1 ad", boş bir alandan çok daha pahalıdır. (İlk yazımda "ürün ağacı
olmayan MONORAY'da bu satır yoktur" diye bir varsayım vardı ve fikstür onu
ÇÜRÜTTÜ: sekiz grubun sekizinde de var.)

Ad ESNEK sütundur ve KIRPILIR (Satış Takibi'nde öğrenilen kural, dar ekran
md. 7): "ARABA GENEL GÖRÜNÜŞÜ" gibi bir başlık telefonda sayacı ve ilerleme
çubuğunu ekranın dışına iterdi.

**SATIN ALMA İLE ÜRETİM AYRI EKRANLARDIR VE DEFTERİ ARTIKSIZ BÖLER.**
Satın alınan kalemler (`kind = "satinalma"` ya da parça numarası olmayan
satırlar) `/purchasing`te, imalat ve montaj parçaları `/progress`te durur.
Bölme kuralı TEK yerdedir — `isPurchaseRow` — ve `derive.ts`teki
`satinAlmaListesi` ile birebir aynıdır; bir satır iki ekranda birden ya da
hiçbirinde görünemez. Kural ÜÇÜNCÜ bir yerde daha yaşıyor ve orası
ayrışabilir: havuz sorgusunun `or("kind.eq.satinalma,part_code.eq.")`
dizgisi. `part_code = ''` ile `!partCode.trim()` aynı şey DEĞİLDİR;
ayrışmayı `purchasing/__tests__/purchasing-split.test.ts` dosyanın
KAYNAĞINI okuyarak engeller (`terms.test.ts` deseninin aynısı). Atıf bir
süre vardı ama dosya yoktu — boşta duran bir atıf, olmayan bir korumadır.

**KODSUZ SATIRIN KAZANAN SAYFASI GRUP BAŞINADIR, PAKET BAŞINA DEĞİL**
(ölçüldü, 13.08.2026 — kullanıcı bildirimi: *"yüklediğim proje Satın Alma
modülüne gitmiyor"*). `bomBirlestir` kodsuz satırları (civata, segman,
rulman — satın alma listesinin ta kendisi) tek bir sayfadan alır ve
gerekçesi doğrudur: aynı grubun ÜRÜN AĞACI ile DEPO sayfaları örtüşür,
ikisini toplamak aynı cıvatayı iki kez saydırırdı. Ama örtüşme AYNI
GRUBUN iki sayfası arasındadır; kural bütün pakette tek bir sayfa seçince
BAŞKA GRUPLARIN Excel'i bütünüyle düşüyordu. MTC'de ölçüm: düşen 76
satırın 67'si kazananla aynı gruptandı (54'ü kazanan sayfada birebir
duruyor — kural orada haklı), 9'u başka gruplardandı ve **hiçbiri kazanan
sayfada yoktu**. Ressam grup grup Excel verdiğinde — firmanın
numaralandırması tam olarak bunu teşvik ediyor — paketin satın alma
listesi tek bir gruba iniyordu. Beraberlikte ÜRÜN AĞACI kazanır (`oncelik`
zaten bunu söylüyor); kazananı girdi sırasına bırakmak kararı rastlantıya
bırakırdı.

**KODSUZ SATIRIN GRUBU ÜRÜN AĞACININ `Item` YOLUNDAN ÇÖZÜLÜR**
(kullanıcı bildirimi, 13.08.2026: *"Depo excelde bazı parçaların hangi
gruba ait olduğu görülmüyor. Satın alma bunların hangi grup içerisinde
olduğunu görmek istiyor."*). Ölçüldü ve doğru: DEPO'nun 67 kodsuz
satırının YALNIZ BİRİNDE `Title` dolu. ÜRÜN AĞACI ise satırın yerini
`Item` sütununda taşır ("3.14" → "3" → `0043-00-0300 KÖPRÜ YÜRÜTME
GRUBU`) ve canlı veride 96 satın alma satırının 89'unda bu yol var.
`derive.ts` bunu zaten çözüyordu ama YALNIZ KENDİ İÇİNDE (`kaynakIzi`);
`drawing_parts.parent_code`a yazılmadığı için Parçalar ekranı, paketin
Satın Alma sekmesi ve `/purchasing` havuzu üçü de grubu göremiyordu.
Çözüm artık DEFTERE yazılır — tek kaynak, üç tüketici.

**ÜRÜN AĞACININ KÖKÜNDEKİ SATIN ALMA SATIRI PAKETİN KENDİ GRUBUNA AİTTİR.**
MTC'de altı satır böyle (grupları birbirine bağlayan cıvata, somun,
rondela, kauçuk tampon) ve gerçekten bir alt montajın altında değiller.

**ÜRÜN AĞACI YOKSA HİÇBİR ŞEY OLMAZ** (kullanıcı şartı: *"Eğer ürün ağacı
yoksa yine sistem kilitlenmesin, DEPO exceline göre devam etsin."*).
`itemPathVar` false ise blok hiç çalışmaz; MONORAY ve PERGEL paketleri
bugün tam olarak öyle çalışıyor. Havuzun grup zinciri de iki koda bakar —
önce satırın KENDİ kodu, sonra ağaçtaki üstü (`purchasing/data.ts`).

**"SATIN ALINIYOR" DEĞERİ DE İKİ DİLLİDİR** (`SATIN_ALMA_YAPISI`).
`excel.ts`teki başlık sözlüğü `bomStructure` için `BOM STRUCTURE · YAPI ·
TÜR` kabul ediyordu ama değer karşılaştırması yalnız İngilizce
`PURCHASED`ı tanıyordu. Bu asimetri sessiz ve pahalıydı: Türkçe arayüzle
verilmiş bir listede sütun OKUNUYOR, değeri TANINMIYOR, satır `imalat`a
düşüyor ve parça numarası dolu olduğu için `part_code = ''` kapısından da
geçemiyordu — kalem Satın Alma'da hiç görünmeyip atölye tahtasına
çıkıyordu. Liste UYDURMA DEĞİL ÇEVİRİDİR: her giriş `Purchased` ile
birebir aynı şeyi söyler. Anlamı GENİŞLETEN bir değer (ör. SolidWorks'ün
`Toolbox`u) gerçek bir teslim klasöründe görülmeden girmez. **`satinalindi` aşamasının çipi atölye tahtasında
YOKTUR** (`productionStages`): sipariş kaydı tezgâhın değil satınalmanın
işidir ve foreman'ın onu işaretleyebilmesi kimin ne zaman sipariş verdiğini
belirsizleştirirdi. Bu bir YETKİ engeli değil bir SORUMLULUK ayrımıdır —
ikisinin de yazma yetkisi aynı `can_edit_drawings()`tir.

**PAKETİN "SATIN ALMA" SEKMESİ BİR EKRAN DEĞİL BİR PENCEREDİR** (kullanıcı
kararı, 12.08.2026 — sekmenin kaldırılmasından SONRA gelen ikinci karar).
Kaldırılan şey bir İŞLEM ekranıydı ve gerekçesi duruyor: iki YAZAN ekran
"hangisi doğru" sorusunu doğururdu. Geri gelen şey salt okunurdur:
*"Mühendis ya da ressam bu ekipman satın alınmış mı diye bakabilsin ve
teslim süresini görebilsin. Fiyat ve kimden alındığı gibi bilgilere gerek
yok."* Mühendis ve ressam `/purchasing` bölümünü GÖRMÜYOR; bu soruyu bugüne
kadar telefonla soruyorlardı. Sayfada tek bir düğme, form ya da server
action yoktur — yazan taraf hâlâ tektir.

**FİYAT GİZLENMEZ, HİÇ GETİRİLMEZ.** `purchase_orders` okuması
`can_see_purchasing()`e kapalıdır ve öyle kalır. Aradaki tek geçit
`drawing_purchase_summary(uuid)` fonksiyonudur (migration 20260812140000):
`security definer`dır — evin `security_invoker = true` görünüm kuralının
BİLİNÇLİ istisnası, çünkü invoker bir görünüm mühendise hiçbir şey
gösteremezdi. İstisnayı güvenli kılan şey, geçirilen şeyin bir TABLO değil
adı tek tek yazılmış bir PROJEKSİYON olmasıdır: adet, sipariş günü, termin,
teslim. **Güvenlik sınırı fonksiyonun `returns table` listesidir** ve orada
para, tedarikçi, kur ya da ödeme koşulu geçmez; kural migration dosyasını
OKUYAN bir koruma testine bağlıdır (`purchasing/__tests__/package-summary.test.ts`).
`anon` çağıramaz; kapı teknik resim okumasının kapısıyla aynıdır
(`authenticated`).

**DURUM İKİ TANIKLI OKUNUR** (`lib/purchasing/package-summary.ts`): "teslim
alındı" demek için hem adedin tamamlanmış hem açık siparişin kalmamış
olması gerekir. Yalnız adede bakmak, satırı güncelleyip siparişi
kapatmayan bir hâlde "geldi" derdi; yalnız kapanışa bakmak kısmi teslimi
yutardı. **GECİKME YALNIZ AÇIK TERMİNDE ANLAMLIDIR** — teslim alınmış bir
kalemin geçmiş termini bir gecikme değil bir geçmiştir ve kırmızıya
boyanması md. 18/3'ün yasakladığı yanlış alarmın ta kendisidir.

**Satın alma KATEGORİSİ tanımdan okunur** (`satinAlmaSinifi`, on beş ürün
ailesi). Sipariş tedarikçi başına verilir; "satın alma ünitesi" diye tek bir
torba satınalmacıya hiçbir şey söylemiyordu. Sözlük iki kanıta dayanır: iki
gerçek teslim klasörünün 145 satın alma satırı ve eski ORION App'in
"MalzemeGrupları" defteri. Anahtar SÖZCÜK ÖN EKİdir (Türkçe iyelik eki:
`SEGMAN` → `SEGMANI`); ön ekin fazla geniş kaldığı yerde TAM sözcük aranır
(`KANCA` ön ek olsaydı "ÇEKME YAYI IKI UCU KANCALI" bir kaldırma aksesuarı
olurdu). Sıra önceliktir: Redüktör Motor'dan önce gelir (motorlu redüktör
redüktör tedarikçisinden alınır), Bağlantı Elemanı en sondadır ("RULMAN
YATAĞI SOMUNU" bir rulman kalemidir). Yeni anahtar ancak GERÇEK bir satır
gösterebilirse girer; eşleşmeyenin "Diğer"de durması yanlış kategoriye
girmesinden iyidir. Dağılım `derive.test.ts`te dondurulmuştur.

**YIKICI İŞLEMDE SIRA "ÖNCE UCUZ OLANI KAYBET"TİR.** `deletePackage` önce
satırı siler (yetki + `count` okunarak), ANCAK SONRA depo nesnelerini.
Ters sıra bir kez yazıldı ve sessiz veri kaybı üretiyordu: depo RLS'i
ressamı geçiriyor, tablo RLS'i geçirmiyordu — baytlar gidiyor, kayıtlar
kalıyordu. Satır gidip depo temizliği yarıda kalırsa yetim nesne kalır ve
bu GERİ ALINABİLİR bir hatadır. **KİM** silebilir sorusunu RLS,
**NE** silinebilir sorusunu tetikleyici cevaplar (`guard_issued_revision`
ile aynı ayrım): üretime girmiş paket silinemez, yerine revizyon yüklenir.

**ONAY KUTUSUNA PAKET ADI DEĞİL "ONAY" YAZILIR** (kullanıcı bildirimi,
12.08.2026). Adın tamamını yazdırmak yanlış taraftaydı: gerçek adlar
(`0054-00-0000 - 75Ton KAPASİTELİ KALDIRMA KİRİŞİ`) uzun, karışık harfli ve
Türkçe İ/I ayrımı taşıyor; kopyalanamadığı için elle yazılıyor, elle
yazılınca tutmuyordu. Onayın işi kararı YAVAŞLATMAKtır, imla sınavı yapmak
değil. Beklenen dizgi TEK yerdedir (`SILME_ONAY_SOZU`, drawings/schema.ts)
ve iki kapı da (ekran + `deletePackage`) aynı `trKatla` ile karşılaştırır.

**SATIN ALMA KAYDI ÜRETİM KAYDI DEĞİLDİR.** Silme koruması bir süre bütün
`drawing_part_progress`i saydı ve satınalmacı tek bir civatayı "satın
alındı" işaretleyince paket kalıcı olarak kilitleniyor, pencere de "atölye
1 üretim kaydı yazmış" diyordu — atölye hiçbir şey yazmamıştı. Kuralın
gerekçesi "atölye o RESİMLERE bakarak iş yaptı"dır; sipariş vermek o
değildir. Üstelik satın alma kaydı anahtarını parça kodundan değil
KATLANMIŞ TANIMDAN alır ve `package_id` `on delete set null` taşır: paket
silinse de "bu somun alındı" bilgisi yaşar, yeni yükleme onu yeniden bulur.
Tetikleyici (`20260811000002`) ve ekrandaki sayaç aynı listeyi
(`PURCHASE_STAGE_SLUGS`) dışarıda bırakır; ikisinin ayrışmasını
`progress.test.ts` migration dosyasını okuyarak engeller.

Kalem numarası METİNDİR, bağlantı TÜREVDİR (md. 17 ile aynı kural).
Bir işin BİRDEN ÇOK paketi olabilir — anahtar `(item_no, group_code)` ve
**tekillik kısıtı bilinçli olarak YOKTUR**; aynı çift ikinci kez gelince
veritabanı reddetmez, sihirbaz "öncekini süperse edeyim mi?" diye SORAR.
Soru yalnız `group_code` DOLUYKEN sorulur: adı çözülemeyen iki paket boş
grupla eşleşir ve grup grup çalışılan bir projede bu en sık karşılaşılacak
yanlış alarm olurdu.

## RESIM-21 — PDF açılır; asıl dosya bağlantısı paylaşılmaz.

Teknik resim PDF'i Supabase'in imzalı adresine yönlendirilmez. Düğme kararlı
`/drawing-viewer/<paket>/<dosya>` adresini açar; içerik ucu her istekte oturumu
ve `drawing_files.package_id` bağını RLS üzerinden yeniden doğrular. Tarayıcıya
imzalı depo URL'si dönmez; PDF içeriği filigranlandıktan sonra
`private, no-store` yanıtlanır. Kopyalanan görüntüleyici adresi oturumu olmayan
kişide çalışmaz.

**GÖRÜNTÜLENEN ASIL DEĞİL KİŞİYE ÖZEL KOPYADIR** (kullanıcı isteği,
20.08.2026: *"açılsın ama kolayca paylaşılıp herkesin eline geçmesin"*).
Sunucu depodaki PDF'i değiştirmeden, geçici kopyanın HER sayfasına oturum
e-postası + UTC zamanı basar. Parolalı/bozuk dosyada filigransız asla geri
dönülmez; görüntüleme açıkça hata verir. Ekran PDF.js ile tuvale çizilir:
tarayıcının PDF indirme/yazdırma araç çubuğu yoktur, `Ctrl/Cmd+S`,
`Ctrl/Cmd+P`, sağ tık ve yazdırma görünümü kapalıdır.

**MÜŞTERİ PAYLAŞIMI AYRI BİR KAPIDIR** (kullanıcı açıklaması, 20.08.2026:
*"müşterinin üyeliği olmayacak; katalog ya da proje ana paftasını açtırmak
isterim"*). Teknik Resimler → Dosyalar ekranındaki `Müşteri linki` yalnız
seçilen PDF için 256 bitlik opak anahtar üretir. `drawing_public_shares` ham
anahtar yerine SHA-256 özetini, dosya kapsamını, oluşturanı ve iptal durumunu
tutar. Ekipman listesine bağlanması seçilirse bearer yol ayrıca revizyon RLS'i
altındaki `equipment_customer_drawing_links`te saklanır; anon bu tabloyu
doğrudan okuyamaz. Bucket private kalır. `/paylas/resim/<token>` üyelik
istemez ama başka pakete/dosyaya geçiş vermez; içerik her istekte aktif kaydı
yeniden doğrular, filigranlı kopya üretir ve `no-store` döner. `Linki yenile`
eskisini kapatır; kapatma düğmesi dolaşımdaki linki anında 404'e çevirir.

**MÜŞTERİ GÖRÜNTÜLEYİCİSİ TABLETTE EKRANI KULLANIR.** Paylaşım kabuğu sabit
bir `vh` tahminiyle PDF alanını kısaltmaz; başlıkların ardından kalan `dvh`
yüksekliği belgeye verilir. Araç çubuğundaki Tam Ekran düğmesi kullanıcı
dokunuşuyla tarayıcının Fullscreen API'sini açar. Bunu belge dışı öğeler için
desteklemeyen tabletlerde aynı düğme görünür alanı kaplayan uygulama içi kipe
düşer; çıkış düğmesi ve Escape iki kipte de belgeyi normal yerine döndürür.

Ekipman listesi revizyonunda seçilen yol
`equipment_customer_drawing_links`te saklanır. Standart PDF ve Excel başlığı
`Proje Ana Paftasını Aç` bağlantısını taşır. Katalog sayfaları ise üretici
belgesi olduğu için token üretmez; `/paylas/katalog?...` yalnız seçilen
manifest yaprağını üyelik olmadan gösterir.

**BU DRM DEĞİLDİR.** Ekranda okunabilen belge ekran görüntüsüyle veya uzman
bir kullanıcı tarafından ağ yanıtından kaydedilebilir. Kuralın güvenlik değeri
asıl depo adresini vermemek, müşteri linkini tek dosyayla sınırlamak, istenince
iptal etmek ve alınan kopyaya görünür iz bırakmaktır. Arayüzde indirme/yazdırma
düğmesi olmaması kolay paylaşımı azaltır; mutlak kopya engeli vaat edilmez.

**TEKNİK RESİM DEFTERLERİ TELEFON VE TABLETTE İŞLEM KARTIDIR.** Paket listesi,
parça defteri ve paket satın alma özeti 1024 px altında `oc-tablet-table` ile
katlanır. Paket/talep adı tam genişlikte; dosya, durum ve işlem hedefleri aynı
kartta kalır. Ürün ağacı ile üretim panosu zaten doğal dikey listedir.
Yerleşim çizimi, montaj ağacı ve karşılaştırma gibi uzamsal içerikler kart
değildir; yalnız kendi kontrollü alanlarında kayar. Paket çıktısı olarak
üretilen birleşik PDF ve parça defteri PDF'i mobil indirme/paylaşma akışını
kullanır; korumalı asıl resimler indirilmez.
