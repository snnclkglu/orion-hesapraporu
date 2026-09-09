# Hızlı otomatik seçim — katalog yeterlilik araştırması

Tarih: 08.09.2026. Kapsam: mevcut katalogların otomatik seçim motoruna uygunluğu; uygulama kodu değiştirilmedi. Bu not ana uygulama planını destekler.

## Ölçüm yöntemi ve sınırı

`../catalog_data` JSON dosyaları ve `scripts/seed-catalog.ts` incelendi. Seed betiğinin **SQL üretimi başlamadan önceki okuma/normalizasyon bölümü**, TypeScript derlenerek yalnız bellekte çalıştırıldı; dosya yazma ve veritabanı bağlantısı yapılmadı. Aşağıdaki sayılar bu sürümün **yerel seed çıktısının aday satırlarıdır**. Canlı Supabase'in satır sayısı, etkin ürünleri, son uygulanmış migration'ları veya admin değişiklikleri doğrulanmadı. Kullanıcının token'ı kullanılmadı.

Ham dosya sayısı ürün sayısı değildir: bazı dosyalar kuvvet matrisi/eğri gibi yardımcı tablolardır, bazı ürünler uygulama varyantlarına açılır, bazı eski dosyalar seed kapsamından çıkarılmıştır. `meta.item_count`, README ve `_version.json` açıklama metinleri yerine gerçek `items` dizileri ve çalışan seed dönüşümü sayıldı.

Dayanaklar: `AGENTS.md`, `docs/agent/katalog.md`, `scripts/catalog-extract/README.md`, mevcut JSON'lar, katalog eşleme ve picker kodu, ilgili hesap kontrolleri.

## Ölçülen aday hacmi

| Tür | Seed satırı | Marka/kapsam |
|---|---:|---|
| Motor | 480 | GAMAK 138; ABB 115; INNOMOTICS 100; SEW-EURODRIVE 49; ELK 78 |
| Redüktör | 62.427 | Yılmaz 32.533; FLENDER 12.256; SEW 17.000; Siemens 488; POLAT 150 |
| Halat | 7.079 | CASAR 1.213; DIEPA 3.177; DRAKO 99; Haşçelik 257; İzmit A.Ş. 1.861; OLIVEIRA 412; UNION 60 |
| Fren | 139 | SIBRE 96; GALVI NEWCOMEN 33; Dereli 10 |
| Kaplin | 588 | OZGUN 387; SIBRE 94; JAURE 107 |
| Rulman | 441 | SKF |
| Rulman yatağı | 28 | SKF SNL/SE uyumluluk kayıtları |
| Teker | 11 | Standart; üretici sipariş kataloğu değil |
| Makara | 13 | Standard kaynaklı makara ölçü tablosu |
| Kanca | 22 | DIN 15401 numara/ölçü kayıtları |
| Tampon | 151 | SIBRE 33; Conductix-Wampfler 107; üretici teyidi olmayan firma Excel'i 11 |
| Halat soketi | 21 | Van Beest |
| Yük hücresi | 18 | Esit 14; Kobastar 4 |

Redüktörlerin 31.759'u kaldırma, 30.668'i yürütme uygulama kaydıdır. Bunlar eşsiz fiziksel ürün adetleri değildir. Ham redüktör JSON'larında 56.299 satır bulunur; FLENDER'in 6.128 satırı seed'de iki uygulamaya açılır. Yılmaz K/Planet ve SEW X'in iki uygulama kayıtları ham veride zaten vardır.

Halatların 5.551 satırı `Vinç`, 1.528 satırı başka uygulamalardır. Manuel picker bu kullanım alanını kullanıcıya bırakır; otomatik kaldırma seçicisinin vinç dışı halatları varsayılan aday kümesine almaması gerekir (`src/lib/catalog-mapping.ts:509`).

Motor klasöründe 537 ham kayıt vardır; `sew_drn.json` içindeki eski 57 satır güncel seed listesine dahil değildir (`scripts/seed-catalog.ts:118`). Bu tek başına bir hata tespiti değildir: güncel SEW AC kapsamının yerine eski dosyayı otomatik eklemek doğru olmaz.

Ray için ayrı durum vardır: `catalog_data/rails/standard.json` 12 kayıt taşırken **çalışan hesap motorunun** `RAILS` defteri 31 seçenektir: 7 A, 11 S, 13 kare/dikdörtgen çubuk (`src/lib/calc/tables.ts:92`). Seed ray JSON'unu kullanmaz (`scripts/seed-catalog.ts:14`). Örneğin A55 metre ağırlığı ham dosyada 31,2, çalışma defterinde 31,8 kg/m'dir. Yeni seçici mevcut motorun gerçek ray defterini kullanmalı; paralel üçüncü tablo yaratılmamalıdır. Ham dosyanın senkronizasyonu ayrı veri bakım işi olarak ele alınmalıdır.

## Katalog yeterlilik matrisi

Sayılar alanın null/boş olmadan mevcut olduğu satır sayısıdır; tek başına üretici doğrulaması veya bütün çalışma koşullarına uygunluk anlamına gelmez.

| Tür | Şu anda kullanılabilen veriler | Optimum seçimi sınırlayan boşluk | İlk uygulama kararı |
|---|---|---|---|
| Motor | Güç, gerçek yüklü devir, mil çapı 480/480; ağırlık 479/480; IP sınıfı 431/480 | Görev, gerilim, frekans, montaj tipi satırda normalize edilmemiş; koşullar bazı `meta.notes` metinlerinde. İnverter çalışma zarfı, düşük hız soğutması, kalkış/tepe momenti, atalet, saatlik start/frenleme sınırı ortak şemada yok | Kaynakla doğrulanmış çalışma zarfına sahip aileler; sınır dışı taleplerde otomatik seçimi tamamlanmış sayma |
| Redüktör | Tork 62.427/62.427; oran ve giriş devri 62.407/62.427; çıkış mili 20.113; giriş mili 18.923; radyal çıkış yükü 42.271; doğal termik güç 14.373; fanlı termik 11.715 | Tork değerinin rating temeli aileye göre değişir; montaj ve çıkış bağlantısı eksik; termik düzeltme/soğutma yöntemi her ailede yok; 20 SEW X..e/HC satırı yalnız oran aralığı | Aile bazlı `ratingBasis` ve montaj yetkinliği; oranı belli olmayan ürün kesin seçim olamaz; bilinmeyen şaftı eski varsayılandan alma |
| Fren | Tork 118/139; ayar min/max 85; kasnak/disk çapı 129; itici tipi 108 | SHI 21 satırında doğrudan tork yok: sıkma kuvveti ve disk geometrisi var. Dereli 10 satırında kasnak çapı yok. Termik frenleme işi/saat, çalışma sıklığı, aktüatör ve disk/kasnak varyant uyumu ortak sözleşmede eksik | Fren türü stratejileri ayrı olsun; tüm frenlere aynı tork alt limiti uygulanmasın; SIBRE TE gibi doğrulanmış ayar tablosu bulunan aileyle başla |
| Motor kaplini | Toplam kaplinlerde nominal tork 581/588, tepe tork 561, maksimum delik 588, minimum delik 310, sınır devir 385 | Minimum delik/devir birçok ailede yok; iki göbek ölçüsü tek `dmax` ile temsil ediliyor; şaft-kama-geçme, göbek boyu, eksenel/açısal kaçıklık ve termik elastomer sınırları eksik | Seçilen iki şaft için göbek uyumu ve devir doğrulanmalı; eksik kanıtı `dmax >= max(şaftlar)` ile tamamlandı sayma |
| Tambur kaplini | 50 drum/barrel satırının radyal kapasitesi var: OZGUN J 14, SIBRE ABC-V 15, JAURE TCBR 21 | Tork sütununun anlamı farklı; hız sınırları ve mil-göbek kapasitesi bütün ailelerde yok; servis faktörünün uygulandığı taraf üreticiye bağlı | Üretici yöntemi stratejisi şart; nominal/tepe torku sessizce birbirine dönüştürme |
| Rulman | 441/441 iç çap, C, C0, sınır devir | Tür/temas açısı/yük katsayıları, silindirik-koniklik, manşon, yatak genişliği ve yağlama koşulları grup uyumuna bağlanmalı. Yatak kataloğu sadece 28 eşleşme taşır | Ömür+statik+geometri+devir birlikte; uygun yatak/manşon bulunmaması açık eksik |
| Halat | Çap/kopma yükü 7.079; metre ağırlığı 7.039; dönmeye dirençli alanı 6.686; mukavemet 6.805 | Vinç dışı ürünler, bilinmeyen rotasyon, yapıya göre FEM katsayısı, çok katlı sarım/çap oranı ve uç bağlantısı uyumu | Vinç kullanım alanı ve topolojiye göre rotasyon kriteri zorunlu; bilinmeyen boolean değeri `false` sayma |
| Teker/ray | Çalışma motorunda FEM temas hesabı ve 31 ray seçeneği; 11 jenerik teker çapı | Jenerik teker kayıtlarında kaynak PDF boş ve `max_load_kN` yalnız özet değer; üretici/malzeme/sertlik/montaj seçeneğiyle bütünleşik katalog değil | Teker çapı-ray-kesit malzemesi-rulman geometrisini mevcut hesapla birlikte ara; jenerik kapasiteyi nihai üretici kanıtı sayma |
| Tampon | 151/151 enerji, strok, tepe kuvvet; SIBRE 33 ürünün kuvvet matrisi; 13 kauçuk ürünün doğrulanmış enerji/kuvvet eğrisi | 11 ürün `unverified`; her kauçuğa eğri yok; hidrolik iğne kodu ve tasarım kütlesi gerekir; doğrusal enerji yaklaşımı her ailede geçerli değil | Tipe özgü mevcut tampon hesabı; teyitsiz ürün otomatik kesin aday olamaz; eğrisiz üründe gerekli kontrol atlanamaz |

Motorların çalışma koşulları için kaynağın yapılandırılmış hale getirilmesi mümkündür: GAMAK `meta.notes` açıkça 400 V / 50 Hz / S1 / IP55 ve B3 ölçü föyü der (`../catalog_data/motors/gamak.json:10`); SEW AC 400 V / 50 Hz / S1 ve B3 yapraklarını belirtir (`../catalog_data/motors/sew_ac.json:9`). Bunların metinde bulunması, her kullanıcı koşuluna uygunluk anlamına gelmez. Örneğin B3 kaynak ölçüsü motor akuple redüktörün flanş adaptörünü kanıtlamaz.

### Redüktör markaları — boşlukların dağılımı

| Marka | Satır | Çıkış mili | Giriş mili | Çıkış radyal yük | Doğal termik güç | Ek durum |
|---|---:|---:|---:|---:|---:|---|
| Yılmaz | 32.533 | 7.857 | 6.699 | 32.531 | 5.399 | DT/DR/KT/KR giriş bağlantısı 3.418 satırda; K/Planet mil bilgileri büyük ölçüde yok |
| FLENDER | 12.256 | 12.256 | 12.224 | 8.192 | 8.974 | Yatay montaj bilgisi var; her ailede radyal kapasite yayımlanmamış |
| Siemens | 488 | 0 | 0 | 0 | 0 | Mevcut satırlar bağımsız şaft eşleşmesi için yeterli değil |
| POLAT | 150 | 0 | 0 | 0 | 0 | M4–M8 güç tabloları 150 satırda var; çıkış DIN 5480 spline/flanş, masif mil çapı beklemek yanlış |
| SEW | 17.000 | 0 | 0 | 1.548 | 0 | 20 HC satırında kesin oran da yok |

Bu tablo marka seçimini yasaklayan bir liste değildir; hangi montaj/topoloji için o markayla doğrulanmış otomatik çözüm üretilebildiğini belirleyen bir yeterlilik tablosudur. Kullanıcı marka tercih ettiğinde önce uygun yöntem/katalog zarfı aranmalı; çözüm yoksa marka sessizce değiştirilmemelidir.

## Mevcut picker neden doğrudan solver olamaz

1. `src/lib/catalog-mapping.ts:541` ve devamında tür başına tek kapasite alt limiti, birkaç facet ve sıralama vardır. `src/components/catalog-picker.tsx:257` bu alt limiti uygular; `nearestCatalogRows` hedef orana en yakın **10** satırı bırakır (`src/lib/catalog-mapping.ts:796`). Bu, tahrik grubunun şaft/termik/fren/kaplin zincirinin birlikte uygun olmasını veya optimumluğu kanıtlamaz. On birinci aday bütün grubu kurtarabilir.
2. Picker önce marka bazındaki bütün kayıtları istemciye çeker; sayfa 1.000, üst sınır 50.000'dir (`src/components/catalog-picker.tsx:45`). Mevcut manuel bölüm kilitleri altında bu sınır ölçülen grupları taşır. Yeni solver tüm redüktörleri bir kerede aynı yoldan getirirse 62.427 satırın tamamını göremez. Aday sorgusu sunucuda daraltılmalı, sayfalama tamamlığı ve katalog sürümü kontrol edilmelidir.
3. `applyCatalogPick` boş alanı atlar (`src/lib/catalog-mapping.ts:1441`). Eski seçim nesnesine birleştirme, farklı ürünün şaft/radyal kapasitesini yeni modele taşıyabilir. Otomatik adım, sahibi olduğu alanları önce açıkça temizleyip yalnız yeni üründen/kanıtlı türetmeden dolduran atomik değiştirme işlemi kullanmalıdır.
4. `coerceCatalogValue` sayıyı `parseFloat` ile çözer; çözülemeyen değeri ham bırakır (`src/lib/catalog-mapping.ts:83`). Manuel tolerans davranışı sayısal solver için yeterli değildir. Strict adapter sonlu sayı, birim, fiziksel aralık ve alanın koşula uygunluğunu doğrulamalıdır. Ölçek dönüşümü `applyCatalogPick` içinde yalnız değer zaten sayıysa yapılır; string `"1000"` ile sayı `1000` aynı dönüşümü garanti etmez.
5. Eşlemeler birçok karar verisini seçimlere taşımıyor: kaldırma redüktörü oran/tork/şaft/radyal yükü alır, termik kapasiteyi ve M4–M8 güç sütunlarını almaz (`src/lib/catalog-mapping.ts:1000`). Kaplin maksimum deliğini alır, minimum delik ve sınır devri almaz (`src/lib/catalog-mapping.ts:1057`). Rulman sınır devri picker'da görünür ama standart seçim eşlemesine aktarılmaz (`src/lib/catalog-mapping.ts:975`). Solver kanıtı yalnız mevcut form alanlarıyla sınırlandırılmamalıdır.
6. Mevcut hesap kontrollerinin bazıları kullanıcı kararıyla uyarıdır: redüktör oran bandı, fren model ayar aralığı/kasnak çapı, fren-kaplin kasnağı eşleşmesi (`src/lib/calc/modules/hoistGroup.ts:1578`, `:1652`, `:1707`). Bunların uygulamadaki severity'sini topluca değiştirmek gerekmez; otomatik seçici kendi önerisinin bu uyumları sağlamasını hard koşul yapmalıdır.

## Kimlik, doğrulama ve izlenebilirlik sözleşmesi

`cat_equipment` serbest `attrs jsonb` ve UUID kullanıyor; yalnız `(kind, active, sort)` indeksi şemanın başlangıcında var (`supabase/migrations/20260719000002_admin.sql:23`). Marka+model satır kimliği olmaya yetmez:

- 480 motor = 425 farklı marka+model; 29 kod birden çok satırda, en fazla 4 güç varyantıyla bulunuyor.
- 62.427 redüktör = 998 farklı marka+model; 979 kod birden çok satırda, en fazla 290 varyantla bulunuyor.

Yeni seçici için önerilen kayıt:

- `catalogRowId`: o anki DB UUID'si; izleme amaçlı.
- `catalogVariantKey`: tür + normalize marka + gerçek model + ilgili varyant boyutları. Motor: güç/kutup/görev/gerilim/montaj. Redüktör: oran/giriş devri/uygulama/giriş-çıkış bağlantısı/montaj. Eksik varyant alanları tahmin edilmez.
- `catalogVersion` ve normalize satırın hash'i; seed yenilemesinde UUID değişse bile önceki rapor açıklanabilir.
- Seçimde kullanılan normalize değerlerin snapshot'ı, kaynak belge/sayfa/çıkarıcı sürümü, alanın `published | derived | unknown | disputed` niteliği.
- `ratingBasis`: nominal/tepe/ayar aralığı torku; referans giriş devri; katalog servis faktörü, ömür/sınıf, montaj ve soğutma koşulu.
- `applicability`: topoloji ve çalışma koşulları; `unsupportedReasonCodes`.

Kaynak bilgisi yalnız README'de kalmamalıdır. Seed `meta` bilgisinin çoğunu DB'ye taşımaz; redüktör `technical_page` alanını da bilerek siler (`scripts/seed-catalog.ts:211`). Katalog yaprağı manifesti görüntüleme için doğru bir bileşendir; solver'ın sayısal doğrulama kaydı onun yerine geçmez ve tersine görüntü bağlantısı da bütün kontrollerin yapıldığını kanıtlamaz.

Mevcut dosyalarda veri-kalite istisnaları da var: SEW R97'nin altı radyal kapasitesi sıfır; CASAR Alphalift Ø25,4'ün iki metre ağırlığı sıfır. Sıfırın her alanda aynı anlamı yoktur: bazı kaplin minimum deliklerinin 0 olması ham/deliksiz teslimi ifade edebilir. Strict adapter alan semantiğine göre kabul etmelidir; bütün sıfırları topluca silmek veya hepsini geçerli saymak yanlış olur. Bu not kaynak değerlerini değiştirmez; otomatik seçim kapsamına alınmadan önce kaynağa karşı incelenmesi gereken satırları işaretler.

### Kaynaklar çatıştığında öncelik

README tarihsel katmanlar içerir. `scripts/catalog-extract/README.md:224` JAURE/TCBR PDF'lerinin bulunmadığını söyler; güncel `../catalog_data/couplings/jaure_tcbr_barrel.json:10` ise 21 TCBR kaydının 08.08'de sağlanan PDF'e karşı doğrulandığını ve sahte devir sütununun kaldırıldığını belgeler. Aynı şekilde eski rulman adedi 320 iken güncel dosya 441 satırdır.

Karar sırası: geçerli kaynak standart/üretici tablosu + güncel çıkarım/koruma testi → güncel ürün dosyası ve aktif seed dönüşümü → uygulanmış migration/DB ölçümü → tarihsel açıklama. Çatışma kapatılmadan hatalı eski açıklamadan otomasyon kuralı üretilmemelidir. TCBR dosyası açıklaması nominal/tepe aynı derken satırlarda yalnız `nominal_torque_Nm` vardır; solver bunu üreticiye özel rating temeliyle anlamlandırmalı, sessiz bir genel fallback yazmamalıdır.

## Hard koşullar ve tercih puanı

Hard koşullar sıralamadan önce uygulanır: kullanıcı marka kilidi; aktif/verisi doğrulanmış kayıt; uygun uygulama ve topoloji; gerekli tork/güç/radyal kapasite; oran ve gerçekleşen hız sınırı; iki şaftın montaj uyumu; fren-kaplin disk/kasnak uyumu; hız/termik/görev koşulları; rulman ömrü/statik güvenlik/geometri; halat yapısı ve çap oranları; tampon enerji/kuvvet/strok ve üreticiye özgü sipariş parametreleri. Hard sınırların sayısal değerleri standart, üretici veya açık firma politikasıyla kaynaklanır; bu rapor yeni katsayı önermez.

Eksik hard alan için sonuç `unknown` olmalıdır. `unknown` kontrolü geçmiş sayılmaz. O aday otomatik kesin seçimden çıkarılır; bütün adaylar aynı veriden eleniyorsa ilgili bölüm `üretici teyidi / mühendis girdisi gerekli` olarak açık bırakılır. Desteklenen bağımsız bölümler önerilebilir, fakat tüm rapor başarıyla tamamlandı denmez. Manuel düzenleme ve kontrollü kabul yolu korunur.

Tercih puanı yalnız hard koşulları geçen adayları sıralar. İlk politika: açık marka tercihi, izin verilen hız sapmasının küçüklüğü, makul kapasite fazlası, standart seri ve aynı projede parça ortaklığı, sonra boyut/ağırlık. Bunlar kullanıcı/şirket önceliği olarak sürümlenmeli; daha büyük ekipmanın her zaman daha güvenli veya daha iyi olduğu varsayılmamalıdır. Rulmanda bir boy büyümek kapasiteyi her zaman artırmaz; güncel SKF serileri E → CC/W33 geçişinde bunu gösterir (`../catalog_data/_version.json`, rulman kaynak notları).

Fiyat/termin/tedarik verisi bu incelenen mekanik katalog aday şemasında yoktur. Bu veri bağlanana kadar sonuç “en ucuz” diye sunulamaz. “Optimum”, sürümlü firma politikası ve doğrulanmış aday kümesi içinde en iyi geçerli kombinasyon olarak tanımlanmalıdır. Motor çıkarımı bile aynı güç/kutup için önceden en yüksek IE ve seçilmiş gövdeyi tuttuğundan (`../catalog_data/motors/gamak.json:10`, `../catalog_data/motors/sew_ac.json:10`) üretici evreninin tamamı aranıyor değildir.

Motor-redüktör-fren-kaplin birlikte değerlendirilir; yalnız motor kW'sını küçültüp sonra sıradaki ürünü zorla uydurmak optimum sistem seçimi değildir. İlk geçerli çözüm tutulabilir, fakat daha iyi adaylar bounded aramayla karşılaştırılır. Arama kesilirse “kanıtlı optimum” değil “bulunan en iyi geçerli öneri” durumu ve tarama kapsamı kaydedilir.

## Katalog işleri için faz önerisi

1. **Veri sözleşmesi ve tekrar üretilebilir sayım:** tür bazlı strict normalize adapter; varyant kimliği; birim ve rating temeli; yerel/DB sayı-hash karşılaştırması; eksik alan matrisi. Ray ve standart boyutların gerçek çalışma defteri tek kaynak olur. Kabul: hiçbir ürün başka varyantın değerini veya eski seçimin kapasitesini devralmaz; string/number kaynaklar aynı kanonik değeri üretir; bilinmeyen değer uygunluk sağlamaz.
2. **Sınırlı ailelerde yöntem doğrulaması:** mühendis tarafından seçilen temsilî Yılmaz/FLENDER tahrik, standart motor, SIBRE TE/OZGUN/SIBRE kaplin, SKF rulman kombinasyonlarıyla pilot. Kapsam marka adına değil aile+bağlantı+rating yeterliliğine dayanır. Kabul: her hard koşulun girdisi, kaynağı, hesabı, sonucu ve elenme nedeni görülebilir. Termik/montaj kanıtı olmayan aile bitmiş seçim üretmez.
3. **Birlikte aday arama ve performans:** server'da marka/uygulama/numerik aralık ön elemesi; adayları küçük gruplar halinde alma; tamlık bayrağı; saf hesap motoruna aday snapshot'ı; kararlı eşitlik bozucu; sınırlı geri arama. Kabul: 62.427 redüktör veri kümesinde tek sayfalama eksikliği yanlış “ürün yok” üretemez; en yakın 10 oranın tamamı uyumsuzken daha uzaktaki geçerli aday bulunur; aynı snapshot/politika aynı sonucu verir.
4. **Kapsam genişletme:** motor termik/inverter görev zarfı; flanş/adaptör/spline; üreticiye özgü redüktör sınıf/ömür yöntemleri; SHI disk frenleri; kaplin iki göbek ve devir; tampon eğri/iğne kodu. Kabul: her yeni aile kaynağıyla örneklenir, hesaplanan emniyet koşulları ve montaj birlikte sınanır; eski pilot senaryoların sonucu ancak gerekçeli politika/katalog sürümüyle değişir.

## Zorunlu kabul senaryoları

- Marka tercihiyle hiç uygun ürün yok: marka değişmeden açıklanan neden ve uygun alternatif politika; sessiz fallback yok.
- Çıkış torku yeterli, şaft/radyal/termik bilgi eksik redüktör: tamamlandı görünmez.
- Gerçek motor devri 1.465 d/dak: 1.500'e yuvarlanmadan oran, hız ve güç tutarlı hesaplanır.
- Aynı motor kodu farklı güçte veya aynı redüktör modeli farklı oran/n1'de: doğru varyant ve kaynağı snapshot'ta korunur.
- Yeni katalog ürünü eski seçimde dolu olup yeni üründe olmayan şaft/radyal alanını temizler; eski değer uygunluk sağlamaz.
- POLAT spline çıkışı veya DR/KR motor akuple giriş: bağımsız mil/kaplin topolojisi otomatik taklit edilmez.
- Fren torku yeterli fakat kasnak çapı, ayar aralığı veya kaplin devir sınırı uyumsuz: kombinasyon elenir.
- Rulman en büyük C'ye göre seçilmez: uygun iç çap, koniklik/manşon, ömür, statik kapasite, hız ve yatak birlikte sağlanır.
- Kaldırma halatı adaylarına asansör/mining halatı karışmaz; zorunlu dönmeye dirençli koşulunda bilinmeyen alan geçmez.
- Kauçuk eğrisi yanlış konik modele bağlanmaz; üretici teyitsiz tampon otomatik nihai aday olmaz.
- Yeni katalog yayını açık editörde eski sonuçla karışmaz; uygulama öncesi sürüm/snapshot kontrolü çalışır.
- Ağ hatası, sayfa sınırı veya zaman bütçesi bitmesi `uygun ürün bulunamadı` ile karıştırılmaz; farklı sonuç kodları vardır.

Bu araştırmada katalog kaynakları ve mevcut kod okunmuş, miktarlar yerel dosyalardan ölçülmüştür. Yeni mühendislik formülü veya standart uygunluk kararı uygulamaya eklenmemiştir.
