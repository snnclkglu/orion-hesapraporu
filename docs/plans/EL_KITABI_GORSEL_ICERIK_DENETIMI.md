# El kitabı — görsel anlatım ve içerik denetimi

## Amaç ve kapsam

Kullanıcının R02 değerlendirmesi: belge fazla sade, metin ağırlıklı ve Konecranes örneğinden uzak. Önceki çalışmanın altyapısı korunarak gerçek şemalar, konuya göre sayfa düzenleri ve eksik içerikler eklenir. ORION kırmızı kimliği korunur. Genel vinç şeması daha sonra projeye özel görselle değiştirilebilir.

Referans: kullanıcı klasöründeki **Konecranes KC-IPC-002, 18.09.2018**. Dosya 112 PDF sayfasıdır: ilk 75 sayfa ana kılavuz, sonraki sayfalar cıvatalı birleşim ve tork doğrulama ekleridir. Referansın bütün sayfaları metin olarak incelendi; temsilî görsel sayfalar ayrıca render edilerek karşılaştırıldı. R01 kullanıcı PDF'i 35, R02 kullanıcı PDF'i 54 sayfadır. Sayfa sayısı başarı hedefi değildir.

Referans sayfa numaraları bu tablolarda PDF'in 1 tabanlı sıra numarasıdır. Metinler ve vektör çizimler özgün hazırlanmıştır; Konecranes logoları, resimleri, servis ürün adları ve modele özgü sayısal ayarlar uygulamaya aktarılmaz.

## Faz 1 — karşılaştırma matrisi

| Referans | Mevcut durum | Uygulanan değişiklik / karar |
|---|---|---|
| 1, kapak | R02 görselsiz, zayıf başlık, geniş boşluk | Büyük özgün vinç şeması, belirgin başlık, kırmızı omurga, teknik özet paneli |
| 2–3, içindekiler | Derin başlıklar üç yaprağı dolduruyor | Ana ve ikinci düzey başlıklarla daha kısa yönlendirme; tam ağaç editörde kalır |
| 4–7, giriş ve semboller | Amaç, garanti ve uyarılar mevcut | İş sırasına göre okuma rehberi; genel şema ile projeye özel talimatın ayrımı |
| 8–9, KKD ve düşme/yangın | Metin var, KKD anlatım görseli yok | Baş, yüz/göz, iş kıyafeti, el ve ayak koruması için genel figür |
| 10–11, izolasyon/acil stop | Metin ve işlem var; enerji kesilmesine ilişkin aşırı genelleme var | İki ayrı şema; enerjisizliği doğrulama ve yeniden başlatma ayrımı |
| 12–13, ana parçalar | Parça adları metinle anlatılıyor | Numaralı genel vinç şekli ve altı parçanın açıklama tablosu |
| 14–18, hareketler/limitler | Konular mevcut; hareket resmi yok | Üç hareketin oklarla gösterilmesi. Özel dönme, konumlama ve fırtına kilidi donanımı varsayılmaz |
| 19, emniyet işlevleri | Bilgiler dağınık | Donanım / görev / operatörün dikkat edeceği nokta tablosu; opsiyonel donanımlar açıkça koşullu |
| 20–23, kimlik plakaları | Metin var, etiketin görsel karşılığı yok | Değersiz genel plaka şeması; gerçek değerler etiketten alınır |
| 24–29, işletmeci / ortam / SWP | Sorumluluklar ve kalan ömür var; çalışma ortamı ayrımı zayıf | Çalışma koşulları ve sınırlarına ayrı bölüm. Referanstaki kapasite/sıcaklık/rüzgâr değerleri aktarılmaz |
| 30–33, operatör kontrolleri | Günlük kontrol tablosu var | Yük yolu şeması; pedal/test butonu varsayımı çıkarılır; fren kontrolü ifadesi düzeltilir |
| 34–35, bakım güvenliği | Bakım öncesi/sırası/sonrası mevcut | İzolasyon şemasıyla desteklenir; operatör ve yetkili personel görevleri ayrılır |
| 36–44, yük elleçleme/salınım | Kurallar mevcut ama çizim yok | Düşey/eğik kaldırma karşılaştırması, altı görselli işlem adımı, indirme ve salınım şekilleri |
| 45–47, iş sonu / haberleşme | Mevcut bölümler ve işaret varlıkları var | Korunur; yeniden başlatma ve enerji kesintisi ayrı konu olarak eklenir |
| 48–57, muayene | Otomatik bakım tabloları ve kaynak muayenesi mevcut | Kanca kontrol şekli, kontrol tablosu ve fotoğraf numaralı boş kayıt formu |
| 58–62, yağlama | Proje kaynaklarından türetilmiş yağlama bilgileri mevcut | Kaynak ilişkisi korunur. Referanstaki yağ türü, miktarı ve periyotlar kopyalanmaz |
| 63–69, kumandalar | Kabin/radyo/pendant bölümleri mevcut | Kumanda şeması genel acil stop ile sınırlı; gerçek tuş yerleşimi projeye özel kalır |
| 70–71, açıklık ve tork | Açıklık ölçümü / cıvatalı birleşim bölümleri var | İmalat-montaj değerleri ayrı üretici/proje talimatı olarak korunur |
| 72–75, atık/yedek/servis | Mevcut | ORION içeriği korunur; başka üreticinin servis paketleri eklenmez |
| 76–112, cıvata ekleri | Genel bakım kitabına otomatik eklenmiyor | Tork, ön germe, yüzey şartı ve deney yöntemi projeye özel teknik ekte doğrulanmalıdır |

## Faz 2 — bilgi yapısı

Kullanıcının mevcut bölüm ve blok kimlikleri değiştirilmez. Yeni yük alma ve indirme bölümleri yük kurallarının hemen ardına, enerji kesintisi bölümü iş sonu bölümünün ardına girer. Kanca muayenesi muayene altında, emniyet işlevleri ve ortam sınırları makine tanımında yer alır. Mevcut gizleme, ek sırası ve kapsam seçimleri korunur.

## Faz 3–4 — çizimler ve örnek sayfalar

`illustrations.ts` aynı saf `Diagram` modelini hem tarayıcıda hem PDF'de kullanır. Model snapshot'a yazılır; sonradan kütüphane değişikliği mevcut içerik çizimini değiştirmez. Ana şekil numaraları `figure.markers` içinde düzenlenebilir. Kullanıcı fotoğraf yüklediğinde aynı bloğun şemasını değiştirebilir. Editörün görsel seçicisinde şema kütüphanesi de bulunur.

Beş temsilî sayfa: kapak, numaralı ana parçalar, düşey/eğik kaldırma, altı görselli işlem adımı, kanca kontrolü. Bunlar ayrı bir statik maket değil, gerçek ortak sayfa planından üretilir.

## Faz 5 — içerik değişikliklerinin sınırı

Yalnız `fromTemplate && !edited` olan standart bloklarda şu eski ifadeler düzeltilir:

- Ana kesicinin bütün enerji kaynaklarını tek başına ayırdığı genellemesi.
- Acil stopun enerji izolasyonu sağladığı varsayımı ve her butonun çevrilerek açıldığı iddiası.
- Kaynaksız haftalık acil stop test sıklığı.
- Her vinçte pedal / test butonu bulunduğu varsayımı.
- Yüksüz fren denemesinde “yük tutulmalı” ifadesi.
- Fren, limit ve acil stopun tek başına yük düşmesini önleyen eşdeğer sistemler olduğu ifadesi.
- Eğitim koşulu olmadan verilen salınım giderme manevrası.

Elle değiştirilmiş metinler korunur; yeni bir içerik paketi bu metinleri ezmez. Bakım aralıkları, torklar, halat/kanca reddetme sınırları, rüzgâr/sıcaklık sınırları ve özel kurtarma yöntemi bu çalışmada yeni sayılarla doldurulmaz.

Teknik karşı kontrol için birincil kaynak: [OSHA 1910.179](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.179), özellikle (l) bakım ve (n) işletme uygulamaları. Bu kaynak Türkiye için mevzuat uygunluğu beyanı olarak kullanılmaz. [Konecranes yük kontrol özellikleri](https://www.konecranes.com/sites/default/files/2024-04/brochure_smart_features_2024.pdf) opsiyonel işlevlerin ürüne bağlı olduğu ayrımını destekler. Genel içerik geliştirmede esas ayrıntılı karşılaştırma kaynağı kullanıcının verdiği KC-IPC-002'dir.

## Faz 6 — entegrasyon ve veri koruma

- Yeni belgeler görsel içerik paketiyle oluşturulur.
- Mevcut taslakta “Görsel anlatımı ve içerik rehberini ekle” işlemi kullanılır.
- `contentEdition: 1` uygulanan paketi belirtir. Aynı paket tekrar çalıştırılmaz; kullanıcı sildiği içerikleri geri bulmaz.
- İşlem geri alınabilir. Kapsam ve ek seçenekleri değişmez.
- `media`, `figure`, `procedure` mevcut kayıt ve arşiv sözleşmesinde kalır; yeni blok türü gerekmez.
- Yayımlanmış PDF'ler mevcut değişmez arşivden indirilmeye devam eder.

## Faz 7 — yerleşim kontrolleri

Görsel kutulara PDF çizicisinin gerçek genişlik/yükseklik sınırları verildi; eski çizici varsayılan 468 pt genişlikle küçük kutudan taşıyabiliyordu. Kısa uyarılar parçalanmaz; başlık ve ilk görsel için birlikte yer ayrılır. İşlem adımının şeması ve metni aynı satırda kalır. Uzun açıklama ve tablolar için devam akışı korunur. Künye satır aralıkları küçültülerek birkaç alan için ikinci sayfa oluşması önlenir.

## Faz 8 — doğrulama kayıtları

Kontrol araçları: `illustrated.test.tsx`, mevcut el kitabı testleri, TypeScript, ESLint, `manual-illustrated-pilot.ts`, `check-manual-plan.py`, gerçek PDF sayfa renderleri ve `/dev/manual-preview` tarayıcı kontrolü.

Güncel çıktı ve test sayıları çalışmanın son kontrol kaydında belirtilir. Projeye özel boş alanlar tamamlanmış sayılmaz. Eksik teknik şartname kaynağı ve doğrulanmamış özel donanım bilgileri teslim incelemesinde görünür kalır.

### Uygulama kontrol sonucu

- Güncel R02 veritabanından salt okunur alındı; önceki 268 blok kimliği korundu, paket uygulandıktan sonra 290 blok var. Yedi konu bölümü eklendi.
- Gövde: 61 A4 sayfa. Beş temsilî sayfa ayrıca üretildi. Künye tek, gövde içindekileri iki sayfa.
- PDF metin/koordinat kontrolü: eksik plan satırı 0, sayfa dışına taşan karakter 0.
- 14 el kitabı test dosyası / 186 test geçti. TypeScript ve ESLint temiz. Üretim derlemesi geçti.
- Tarayıcıda numaralı şekil açıklaması değiştirme, hazır şema değiştirme ve geri alma doğrulandı. A4 önizlemede ana parçalar şekli ve numaraları incelendi.
- Kaynak taslak değişimi ve görüntü kopyalama gereksinimini denetleyen yeni revizyon kurulumu transaction + rollback ile doğrulandı; test kalıcı kayıt bırakmadı.
- Ekli yerleşim kontrolü üç gerçek ek / 161 ek sayfası ile yapıldı. Kaynak, önceki doğrulanmış çıktıdaki eklerdir; yönetim API anahtarı bu oturumda 401 verdiği için bu kontrol yeni indirme olarak raporlanmaz. Revizyon için mevcut doğrudan veritabanı bağlantısı çalışır.

Son teknik inceleme kapsamında halen proje mühendisliğine bağlı olanlar: 24 boş proje alanı, seçili teknik şartnamenin kaynak dosyası, genel vinç/kanca şemasının vince özel görselle değiştirilmesi ve projeye özel işletme/bakım sınırları. Bunlar örnek üreticinin değerleriyle doldurulmadı.
