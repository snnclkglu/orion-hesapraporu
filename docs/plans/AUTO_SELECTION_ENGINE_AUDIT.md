# Hızlı otomatik seçim — hesap motoru inceleme notu

Tarih: 08.09.2026. Bu belge araştırma ve planlama içindir; uygulama kodu değiştirilmemiştir. İnceleme mevcut TS kaynaklarına dayanır. Standart inceleme notlarındaki tarihsel bulgular güncel hata kabul edilmemiştir.

## Karar

Yeni özellik, `runCalc` üstünde çalışan ayrı, saf ve deterministik bir **aday üretme + seçim + yeniden doğrulama** katmanı olmalıdır. Aynı hizmet mühendislik ve teklif editörüne hizmet vermelidir. Ekranda insan gibi tıklayan bir robot gerekmez; insanın karar sırası bağımlılık grafiği olarak kodlanmalıdır.

`runCalc` bugün verilen geometri ve katalog değerlerini hesaplayıp kontrol eder; optimum geometri ya da ürün aramaz. Teknik özellikleri yeni iş şablonunun üzerine yazıp `runCalc` çağırmak otomatik seçim değildir. Şablon birçok gerçek/eski ürün değeri içerir ve yeni teknik gereğe uygun olduğu anlamına gelmez.

“Optimum” ilk sürümde “desteklenen ürün havuzu, izin verilen markalar ve sürümlü tasarım kuralları içinde bütün zorunlu koşulları sağlayan, gerekçeli en iyi aday” anlamına gelmelidir. Küresel minimum maliyet veya eksiksiz mühendislik tasarımı iddiası için veri ve kontrol kapsamı bugün yeterli değildir.

## Mevcut mimari ve güçlü yeniden kullanım noktaları

| Konu | Mevcut kaynak ve çıkarım |
|---|---|
| Tek hesap motoru | `src/lib/calc/engine.ts:133`, `:165`, `:563`: `CalcInput` → `CalcResult`, motor sürümü `:118`. Formüller DB/UI içermez. |
| Topoloji | `engine.ts:355`, `:416`: `moduleAllowedByConfig` ve `activeModules`; `presentation/module-family.ts:80` modül sırası, `:213` üst bağı. Aynı yapı ana/yardımcı/monoray ailelerini kapsar. |
| Mevcut hesap sırası | `engine.ts:577–714`: kaldırmalar → kanca blokları → yürütmeler → teker yükleri → ana kiriş takımları → burkulma → başkiriş → kabin → elektrik. |
| Türetme motoru ayrı | `calc/derive.ts:352`, `:729`, `:872` alan türetmeleri; `module-adapters.ts:1902`, `:2176`, `:2200` saf state uygulayıcıları. Son dosya sayfa klasöründe yaşar. |
| Editörün son girdisi | `revision-editor.tsx:1594–1616`: tam snapshot bütün kapalı state'i korur; canlı hesap yalnız `activeSet` içindeki modülleri alır. `runCalc` çağrısı normalize edilmiş aktif girdi ister. |
| Otomatik alan korumaları | `module-adapters.ts:2052` teker çapı değişiminde oranı yeniden otomatiğe alır; `revision-editor.tsx:1850` katalogla gelen seçimin Auto anahtarını kapatır. |
| Hook seçimi hazır | `calc/hook-table.ts:148` en küçük yeterli dövme kanca; `hook-standards.ts:201` DIN 15407 satırı; `hookBlock.ts:676` önerilen kanca numarasını sonuçta üretir. |
| Yardımcı seçimler hazır | `load-cell.ts:79`, `wedge-socket.ts:58`, `safety-brake.ts:312`: loadcell, soket, hidrolik ünite. Katalog dışı kalınca davranışları ayrı değerlendirilmelidir. |
| Elektrikte çalışan örnek | `modules/electrical.ts:497`: marka/seri havuzunda motor gücü VE akımı sağlayan sürücü; `:467–495` kablo kesiti ve paralel hat önceliği; `:613–637` feston yerleşimi deterministik iyileştirmesi. |
| Katalog eşlemesi | `catalog-mapping.ts:1425`, `:1441` bölüm → ürün türü ve tipli seçim patch'i. UI filtrelerinin fiziksel uygunluk kontrolü yerine geçmediği unutulmamalı. |
| Alternatifler ve snapshot | `revision-load.ts:144–180`: bölüm bazlı en çok üç seçim kümesi ve etkin indeks mevcut. Tam bir otomatik adayın geometrisi/bağımlılıkları yalnız bu bölüm alternatifine sığmaz. |

## Teknik özellikler neden tek başına her tasarımı belirlemiyor?

`TechnicalSpecs` kapasite, hız, sınıf, açıklık, ortam, topoloji ve araba/köprü kütlelerini taşır (`types.ts:362–565`). Aşağıdaki geometri ve kabuller bu tabloda yoktur:

- Tamburun A…G zinciri, et kalınlığı, D1/D2 mil çapları, kaynak boğazları, sabit makara sayısı, halat donanımı, kademe verimi/adedi (`hoistGroup.ts:589–684`).
- Kanca bloğu askı/makara merkezleri, mil çapı; kaldırma kirişi için x/y/z ve iki ayrı kesit (`hookBlock.ts:190–272`).
- Teker adedi, tahrik adedi, mil/mesnet geometrisi, yanaşma mesafesi ve ivme (`travelGroup.ts:155–282`).
- Ana kirişin sac ölçüleri, teker/dingil aralıkları, ray kolu, perde aralığı, kaynak/çentik ve sehim kabulleri (`mainGirder.ts:187–325`).
- Başkiriş teker açıklığı, yük oturma konumu ve sac kesiti (`endCarriage.ts:67–83`).

Bu alanların her biri için “teknik özellikten türet”, “üründen al”, “ORION tasarım profiline göre sonlu aday üret”, “kullanıcı girdisi/kilidi gerekli” ya da “bu sürüm desteklemiyor” kararı verilmelidir. Bir değer yalnız eski şablonda var diye tasarım kararı sayılmamalıdır.

Yeni işte %10 kanca bloğu kütlesi firma kabulüdür (`derive.ts:166–180`); kepçe/mıknatıs gibi özel tutucularda gerçek kütle gerekir (`hoistGroup.ts:685–690`). İşletme sınıfı ve geometri kısıtları tonajdan tahmin edilmemelidir.

## Doğru seçim sırası ve zorunlu geri dönüşler

### 1. Kapsam, veri ve tasarım profili

Aktif modülleri mevcut topolojiden çıkar. Kullanıcının kapalı modüllerini ve mevcut kilitlerini koru. Teknik gereği, marka tercihlerini, mevcut katalog sürümünü ve tasarım profilini bir kez dondur. Kapasite/hız/sınıf/ortam/kütle/birim doğrulamasını yap. Sıfır, NaN, Infinity ve desteklenmeyen sınıf/konfigürasyonu aday aramasına sokma.

### 2. Kaldırma mekanizma paketi

1. İzinli donanım adayları: standart/ikiz/çift tambur ana topoloji kullanıcı kararından gelir; uygun halat kolu seçenekleri `COMMON_REEVINGS` üzerinden sınırlı aranır (`reeving.ts:213`). Donanım verimi ve adetler aynı kaynaktan türetilir.
2. Halat marka/yapı/öz/dayanım/çap adayları: FEM emniyet katsayısı ve MBL kontrolü (`hoistGroup.ts:1091–1127`). Seçilen metre kütlesi halat ağırlığını, o da halat yükünü tekrar değiştirir (`derive.ts:367–389`). Halat adayı kendi kütlesiyle yeniden hesaplanmalıdır.
3. Tambur çap serisi + malzeme + et kalınlığı + yiv ve imalat geometrisi: D/d, birleşik gerilme, tam yiv adedi, halat planı (`hoistGroup.ts:1129–1190`; çap seçenekleri `fields.ts:1286`). Çap büyümesi torku, devri, yiv boyunu, kütleyi ve yatağa gelen yükü birlikte değiştirir.
4. Tambur mili D1/D2, kaynaklar ve rulman/yatak paketi: gerçek A…G geometrisi ve iç/dış halat konumlarının zarfı (`hoistGroup.ts:1193–1340`); C/C0/ömür ve birebir D2 iç çapı (`:1495–1547`). Rulman katalog iç çapı sonlu mil çap adayları için kullanılabilir; D1/D2 ve yatak oturma geometrisi üretim profiliyle sınırlanır.
5. Motor + redüktör birlikte: tambur momenti, oran, gerçek motor devri, izinli çıkış radyal yükü, sıcaklık katsayısı, gerçek hız ve güç (`:1342–1346`, `:1549–1619`). Önce teorik oranla güç alt sınırı çıkar; gerçek motor–redüktör çifti seçildiğinde tam hesap tekrarlanır. İlk küçük motorun sonra seçilen oranda yeterli olduğu varsayılmaz.
6. Fren + motor kaplini birlikte: gereken moment, ayar aralığı, mil Dmax ve fren kasnağı eşliği (`:1626–1712`). Tek başına “yeterli fren Nm” yeterli değildir.
7. Tambur kaplini: tork + radyal kuvvet + redüktör çıkış/mil geometrisi (`:1718–1756`). Uygun kaplin yoksa redüktör/mil/tambur adayına dön.
8. Emniyet freni varsa kaliper, hava aralığı, disk çap/kalınlığı, montaj düzeni ve hidrolik ünite birlikte (`:1870–1968`). Denge traversi/makarası, rulman ve soket/loadcell gerekli veri kapsamıyla kapanır.

Çift tamburda aynı adı taşıyan sayıların fiziksel anlamı sabitlenmeli: `hoistGroup.ts:1207` bir tamburun mili için yükü böler; `:1345` ayrıca `drumCount` böleni kullanır. Mevcut çift tambur testleri korunarak bütün otomatik adaylarda mekanizma toplamı, fiziksel adet ve hesap başına pay aynı sözleşmeyle üretilmelidir. Aday araması `drumCount`, `motorDivisor` gibi bölücülerle gereken gücü yapay azaltamaz.

### 3. Kanca bloğu paketi

Kanca standardı/malzeme sınıfı → en küçük yeterli kanca → halata uygun makara çapı → donanıma uygun makara adedi → gerçek askı/makara merkezleri → mil → iç çapı eş rulman + C/C0/ömür → kanca rulmanı sırası izlenir. Mil ve rulman sonlu eş aday olarak denenebilir. DIN 15408 tablosu eksikken otomatik kapasite üretilmez; mevcut kapasite kontrolü zaten 0 ile başarısız olur (`hookBlock.ts:670–707`).

Kaldırma kirişi/çift kanca bloğu görünürlük koşulları motor ve raporun mevcut kuralından okunmalı; gizli kalan alt taşıyıcı tasarımı otomasyonun tamamlanmış ürün listesine girmemelidir.

### 4. Araba ve köprü yürütme paketi

Teker/tahrik adedi ve izinli ray ailesi → teker çapı/malzeme/yüzey basıncı → mil geometrisi ve rulman → motor–redüktör aday çiftleri → fren/kaplinler → tampon/feston.

- Teker yüzey basıncı kütle, ray baş genişliği, çap, hız katsayısı ve mekanizma sınıfına bağlıdır (`travelGroup.ts:864–916`). Tek başına teker çapı sıralaması optimum değildir.
- Gereken güç **gerçekleşen** hızı kullanır (`:1068–1099`); gerçek hız motor devri, oran ve çapla oluşur. Çap değişince editör oranı tekrar geçici otomatiğe alır (`module-adapters.ts:2052`). Aday deneme aynı kuralı uygulamalıdır.
- Gerçek redüktör seçilmediyse `gearbox.selected` engelleyicidir (`travelGroup.ts:1120–1133`). Çözücü yalnız bayrağı kapatarak bu kontrolü geçiremez; katalog kimliği ve gerçek oran kanıtı gerekir.
- Motor/redüktör/teker milleri ile kaplin Dmax birlikte kontrol edilir (`:1169–1233`). Eksik mil değeri bazı yollarda 0'a düşürüldüğünden bağımsız veri tamlığı kapısı gerekir.
- Ana/ayrı yardımcı/monoray arabaların kütle ve yükleri köprü yürütmeye doğru aktarılmalı (`engine.ts:231–273`). Aynı arabadaki yardımcı yüklerin eşzamanlılığı tasarım profilinde açık olmalıdır; hesap modülü mevcut yükleme senaryolarının ötesini kendiliğinden kapsamaz.

### 5. Taşıyıcı yapı ve kütle dış çevrimi

Teker yükleri/ölçü zinciri → ana kiriş kesit adayları → statik, yorulma, sehim, oran ve burkulma → başkiriş → kütle bütçesi → yürütme/tampon/yapının yeniden hesabı.

İlk otomatik ekipman sürümünde teknik özellikteki araba/köprü kütleleri kullanıcı girdisi olarak sabitlenmelidir. Daha sonra onaylı kesit ve imalat profilleriyle ayrı bir sınırlı kütle iterasyonu eklenebilir. Bütün geometri boyutlarını sınırsız büyütmek optimizasyon değildir; yükseklik/genişlik, sac serileri, kaynak erişimi, baş mesafesi, yanaşma ve servis boşlukları aday alanını sınırlamalıdır.

Mevcut ağırlık dökümü hesap motoruna sürekli otomatik yazmaz; kullanıcının “Teknik özelliğe yaz” işlemiyle girer (`docs/agent/hesap.md:1364–1382`). Maliyet modelinden çıkan tahminlerin hesap girdisi yapılmaması kuralı korunmalıdır. Bu yeni özellik için kütle önerisi ancak tek seferlik inceleme/uygulama kararında, tahmin/hesap/katalog/elle kaynak payları korunarak yapılmalıdır. Eksik kalemli `≥` toplam, kesin kütle sayılmamalıdır.

Kütle iterasyonu için üst adım sayısı ve süre sınırı, aday kimliği döngü tespiti, yakınsama toleransı, tam yeniden doğrulama ve yakınsamadı sonucu gerekir. Gerilme/yorulma/kütle her boyutta tekdüze davranmaz; bir yönde kalınlaştırıp ilk yeşilde durma algoritması yeterli değildir.

## Otomatik seçim öncesi kapatılması gereken veri ve kontrol boşlukları

| Bulgu | Kanıt | Otomasyondaki önlem |
|---|---|---|
| `allPass` tamlık göstermiyor | `engine.ts:714`: yalnız üretilmiş `allChecks.every(c.pass)`; boş liste de true olur. | Beklenen aktif modül/karar/kontrol kapsamı ayrı manifestten denetlenir. `feasible`, `incomplete`, `infeasible`, `unsupported`, `cancelled` ayrılır. |
| Eksik denge verisi kontrolü yok edebiliyor | `hoistGroup.ts:1784–1808`, `:1810–1824`, `:1829–1842`, `:1847–1857`: ürün/değer varsa kontrol ekleniyor. | Kullanılması gereken ama verisi olmayan bileşen eksik karar üretmeli; “rulman yok” gibi kasıtlı yokluk ayrı durum olmalı. |
| Türetme uyarıları checks dışında | `derive.ts:367–377`, `:768–797`; `revision-editor.tsx:1591`: ayrıca gösteriliyor. | İlgili adayın girdisi türetilemediyse eski değerle devam etme; tamlık hatası yap. |
| Katalog patch'i eksik attr'ı atlıyor; editör eski seçime ekliyor | `catalog-mapping.ts:1441–1464`, `revision-editor.tsx:3212–3216`; tampon/yatak için özel temizlik var. | Ürün tarafından sahip olunan alanları tek işlemde değiştir. Eksik yeni ürün niteliği eski ürün kapasitesini/milini/kütlesini miras alamaz. |
| Donanım doğrulayıcı motor yoluna bağlı değil | `reeving.ts:129` var; `computeHoistGroup` yalnız `deriveReeving` çağırıyor (`hoistGroup.ts:1091–1093`); aramada doğrulayıcı yalnız testlerde kullanılıyor. | Aday girişinde `validateReeving` çağır ve hata bulgularını durdur. |
| Katalog yakınlık filtresi global uygunluk değil | `catalog-mapping.ts:796`; `catalog-picker.tsx:257–272`: tork alt filtresi sonra en yakın oranlar. | İlk 10 satırı bütün havuz sanma. Uygunluk filtrelerini saf aday servisinde çalıştır; bütün sert koşulları sonra motorla doğrula. |
| Gizlemek, modülü kapatmak değildir | `revision-load.ts:77–83`; `revision-editor.tsx:1653` görünür kontrol filtresi. | Optimizasyon kapsamı fiziksel/aktif modüllerden gelir. Kontrol gizleyerek başarı üretme. Sunum tercihini koru. |
| Manuel ölçü onayları gerçek engelleyici | `mainGirder.ts:796–809`; `docs/agent/hesap.md:961–970`. | Sistem kullanıcı adına `measurementsConfirmed`/`loadMeasurementsConfirmed` true yazmaz. Taslak “hesaplandı, ölçü onayı bekliyor” olabilir. |
| Uyarı ile otomatik seçim uygunluğu farklı | Makara rulmanı iç çap eşliği `hookBlock.ts:889–896` uyarı; oran sapmaları da uyarı. | Otomatik seçim politikası bu fiziksel uyumsuzlukları kendi sert koşulu yapabilir; mevcut raporun tarihsel severity'sini sessiz değiştirme. |
| Kısmi hesap kapsamı | `engine.ts:661–665` burkulma yalnız birinci ana kiriş; `docs/agent/hesap.md:1693–1726` elektrik ön hesabının sınırları. | Destek matrisi göster; ikinci kiriş burkulmasını veya nihai elektrik projesini tamamlanmış sayma. |
| Katalog nitelikleri mevcut kontrolden geniş | `catalog-mapping.ts:172` termik güç adı var; `gearboxCatalogInputRpm` hesap formülünde kullanılmıyor, seçim künyesi; motor duty/yalıtım sipariş alanları. | Motor termik görev/başlama sayısı, redüktör termik güç/devir tablosu, fren dinamik enerji ve montaj uyumu için kontrol veya “manuel üretici doğrulaması gerekli” statüsü tanımla. Salt kW/tork kontrolü tam ürün uygunluğu değildir. |

Buradaki “boşluk” ifadesi mevcut manuel iş akışının bütün raporlarının yanlış olduğu iddiası değildir. Mühendisin bugün elle tamamladığı/yorumladığı bilgi otomatik seçiciye açık kurala dönüştürülmeden kesin uygunluk verilemeyeceğini gösterir.

## Önerilen çekirdek sözleşmeler

- `AutoSelectionRequest`: başlangıç snapshot özeti/hash'i, teknik özellikler, etkin kapsam, katı marka izinleri ile tercih sırası, tasarım profili/sürümü, kilitler, katalog snapshot kimliği, hesap motoru sürümü.
- `SelectionDecision`: modül/karar anahtarı, ürün kimliği ve attr snapshot'ı veya geometri profili, giriş bağımlılıkları, neden seçildi, elenen adayların nedenleri, gerekli/seçilen değerler, kullanım oranları, veri eksikleri, kaynak/güven türü.
- `AutoSelectionProposal`: sonlu adaylardan en iyi çözüm, en fazla birkaç karşılaştırma alternatifi, alan bazlı önce/sonra değişikliği, eksik/başarısız/manuel inceleme listeleri, son `CalcResult`, süre ve arama kapsamı.
- `applyProposal`: mevcut snapshot hash'i aynıysa atomik state uygulaması; farklıysa yeniden çözüm. Uygulama öncesi tek adımlık geri alma snapshot'ı. Sonuç uygulamak revizyon yayınlamak değildir.

Eski `*Auto` anahtarları türetilen alanın kaynağını belirler; bütün katalog seçiminin “mühendis kilidi” sayılmaz. Ürün/kesit düzeyinde ayrı kilit ve kaynak meta verisi gerekir. Kaynağı bilinmeyen eski snapshot seçimleri varsayılan korunmalı; yeni işte şablon seçimleri “başlangıç örneği” olarak işaretlenmelidir. Kullanıcının sonradan değiştirdiği ürün/kesit ve tasarım kabulleri bir sonraki hızlı çalıştırmada korunmalıdır.

Aday sıralaması önce tüm sert fiziksel koşullar ve veri tamlığı, sonra marka/kilit/ölçü kısıtları, sonra sürümlü ORION hedefi olmalıdır. Gerçek ve karşılaştırılabilir fiyat yoksa “en ucuz” denmemeli; gereksiz büyük kapasite, kütle, boyut ve bakım/parça ortaklığı gibi açıklanabilir ölçütler kullanılmalıdır. Bilinmeyen fiyat veya kütle 0 sayılmamalıdır. Eşitlikler kararlı ürün kimliği ile çözülmelidir.

Arama UI sayfa sırasından bağımsız karar düğümleriyle yürümeli; motor–redüktör, fren–kaplin, mil–rulman gibi döngülü küçük kümeler paket halinde çözülmeli. Ön filtre, sınırlı geri izleme/aday sayısı, memoization ve değişen bağımlılığa göre yeniden hesaplama uygundur. Arama daraltılmışsa sonuç “taranan adaylar arasında” en iyi olarak raporlanmalıdır.

## Faz önerisi ve kabul kapıları

1. **Envanter ve tasarım sözleşmesi:** her input/selection/check için kaynak, birim, bağımlılık, sonlu aday alanı, onay ve destek matrisi. Kabul: hiçbir otomatik yazılacak alan sahipsiz değil; ilk desteklenen standart çift kirişli gezer vinç zarfı açık.
2. **Saf hazırlama/uygulama ve tamlık:** `withDerivedModules`, katalog ürün değiştirme, Auto kapatma, ölçü onayı geçersizleştirme, topoloji ve girdi hazırlama React dışındaki ortak saf katmana taşınır. Kabul: manuel editör/PDF/teklif aynı girdiden aynı sonuç; eksik attrs, yanlış tür, NaN ve boş kontrol listesi başarı sayılmıyor.
3. **Ekipman çözücü, sabit geometri/kütle:** ana kaldırma ve yürütmenin motor–redüktör–fren–kaplin paketleri, kanca ve uygun veri bulunan rulmanlar; eksik geometriyi tamamladığını iddia etmeden öneri. Kabul: referans mühendis seçimleriyle karşılaştırma, her seçimin tüm bağımlıları yeniden hesaplanmış.
4. **Halat/tambur/mil/makara/teker geometrisi:** onaylı ölçü serileri ve imalat profilleriyle sonlu aday araması, paket geri izleme, bütün mekanizma kontrolleri. Kabul: tolerans sınırları, büyük/küçük yük ve hızlar, marka havuzu boşluğu, uyumsuz mil/kasnak ve donanım kütle çevrimi testleri.
5. **Yapı ve kontrollü kütle önerisi:** kesit, ana kiriş/başkiriş, burkulma ve ağırlık geri beslemesi; yakınsama ve eksik ağırlık kontrolü. Kabul: güç/kütle/kesit döngüsü kararlı; ölçü onayı bekliyor durumu korunuyor; maliyet modelinden fiziksel girdi sızmıyor.
6. **Ortak kullanıcı akışı:** Teknik Özellikler yanında “Hızlı otomatik seçim”; markalar + dar gelişmiş tasarım tercihleri; “Hesap raporunu oluştur”; ilerleme/iptal; önerinin tek işlemde taslağa uygulanması, geriye alma ve düzenleme/kilitler. Mühendislik ve teklif aynı bileşeni/hizmeti kullanır. Kabul: aynı request aynı ürün ve sayıları veriyor; katalog/başlangıç verisi değişirse eski öneri uygulanmıyor.
7. **Kapsam genişletme ve üretim doğrulaması:** ayrı yardımcı/monoray, tek/dört kiriş, çift tambur/ikiz, özel kanca/tutucu, tampon/elektrik/kabin; her biri ayrı destek kapısından geçer. Kabul: mühendis onaylı örnekler, bağımsız el hesabı ve negatif testler; desteklenmeyen düzenler dürüstçe ayrılıyor.

Test tasarımı: mevcut fizik testleri ve golden karşılaştırmalar korunur; yeni çözücü için aynı girdinin deterministik tekrarı, katalog sırası değişmezliği, bütün seçilen ürün niteliklerinin aynı satırdan gelmesi, teknik özellik değişince bağımlı seçimin yeniden değerlendirilmesi, kilit koruma/çelişki bildirimi, iptal/geri alma, marka dışına kaçmama, eksik veriyle başarı üretmeme, gerçek hız–güç geri beslemesi, no-solution ve yakınsamama senaryoları önceliklidir. Kalınlık veya kapasite büyümesinin her çıktıyı tek yönlü değiştirdiği varsayımı test olarak yazılmamalıdır.
