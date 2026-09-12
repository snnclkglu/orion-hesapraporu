# 014 — Panel görev etkileşimleri, etiketler ve anlaşılır detay

Tarih: 12 Eylül 2026. Durum: Plan hazır; uygulama, migration ve yayın bu çalışma kapsamında yapılmadı.

## 1. Hedef ve mevcut durum

Amaç: görevleri mobil/tablette az dokunuşla yönetmek, yanlış işlemleri geri alabilmek, renkli etiketlerle kullanıcı ve Grokbot üzerinden kategorize etmek, yeni görev penceresini görünür ekrana sığdırmak ve bütün cihazlarda görev detayını okunur hale getirmek.

Kod incelemesinde doğrulananlar:

- `task-workspace.tsx` Görevlerim, Ekip, Panolar ve Gelen bölümlerini; liste, pano ve hafta görünümlerini içeriyor. Ortak görev satırı üzerinden ilerlenebilir.
- Dört durum mevcut: Yapılacak, Devam ediyor, Beklemede, Tamamlandı. Arşiv ayrı bir alan; yeni durum olarak eklenmeyecek.
- Tamamlama işleminde Geri al var. Detaydaki görev arşivleme ve pano arşivlemede aynı bildirim akışı yok. Dokunarak basılı tutma/kaydırma davranışı mevcut bileşende yok.
- Görev modeli, oluşturma/güncelleme doğrulaması ve Agent görev route'unda etiket sözleşmesi yok. Mevcut katı şemaya doğrudan `tags` göndermek desteklenen bir işlem değil.
- Yeni görev `DialogContent mobileKeyboardSafe` kullanıyor. Ortak pencere, görünür ekran yardımcısı ve görev CSS'i birlikte konumu belirliyor. Yardımcı 767px altını ve kısa dokunmatik ekranları kapsıyor; normal yükseklikteki tablet bu özel korumaya girmiyor.
- Detay alanlarında şeffaf kenarlıklar, çoğunlukla hover ile görünür düzenleme sınırları var. Dosyalarda ve akış bölümlerinde bazı çizgi/ikonlar bulunuyor; fakat tüm detayda ortak bir görsel hiyerarşi yok.
- Plan 011 önceki mobil düzeltmeleri kaydediyor; fiziksel iPhone kabulü açık. Yeni hata bildirimi önceki otomatik testlerle kapatılmış sayılmayacak.

Bu inceleme kaynak koduna dayanır. Ekran dışına açılmanın kesin kök nedeni henüz tarayıcıda yeniden üretilmedi; CSS çakışması, görünür ekran konumu, tablet kırılımı ve kullanılan sürüm ilk fazda ayrı ayrı kontrol edilecek.

## 2. Dokunmatik hareket sözleşmesi

| Hareket | Sonuç | Yanlış işlem koruması |
| --- | --- | --- |
| Kısa dokunuş | Görev detayını aç | Hareket/uzun basma sonrası kalan tıklamayı engelle |
| Yaklaşık 450 ms basılı tut | Hızlı işlem menüsü | Tek başına veri değiştirmez |
| Sağa kaydırıp bırak | Görevi arşivle | Eşik öncesi önizleme; başarı sonrası Geri al |
| Sola kaydırıp bırak | Tarih/erteleme seçicisini aç | Tarih seçilene kadar kayıt değişmez |
| Dikey hareket | Listeyi kaydır | Uzun basma ve yatay işlem iptal edilir |

Sol hareket için öneri **Tarihi değiştir / Ertele**: Bugün, Yarın, Gelecek hafta, Tarih seç, Tarihi kaldır. Seçenekler uygulanacak tarihi de gösterir; Türkiye gün hesabını kullanır. Tarihi olmayan görevde başlık “Tarih belirle” olur. Böylece durum basılı tutmada, arşiv sağda, günlük planlama solda bulunur.

Hızlı menünün ilk grubu dört durumdur; seçili durum işaretlidir. Sonra Tarih, Sorumlu, Etiketler ve Öncelik; en altta Arşivle bulunur. Mobilde alt işlem paneli, tablette görünür ekrana sığan menü/panel; masaüstünde görünür üç nokta menüsü ve sağ tık aynı işlemleri sunar. Menüde ikon + Türkçe metin kullanılır.

Uygulama ayrıntıları:

- İlk ayar olarak 10px hareket toleransı, yatay yönün dikeyden belirgin güçlü olması ve kart genişliğinin yaklaşık %30'u kadar bırakma eşiği kullanılır; dar/geniş kartlarda 72–120px aralığında sınırlandırılır. Bunlar cihaz kabulünde ayarlanacak başlangıç değerleridir.
- Basılı tutup yana çekme de aynı sözleşmeyi izler: menü açılmadan yatay niyet anlaşılırsa kaydırma; menü açıldıktan sonra aynı parmak bırakışı işlem seçmez.
- Etkileşim ekran genişliğine değil gerçek dokunma/pointer olayına bağlanır; geniş iPad ve fare bağlı tablet desteklenir.
- `pointercancel`, ikinci parmak, sayfa kaydırma ve ekran dönüşü hareketi iptal eder. Sayfa kenarındaki tarayıcı geri hareketi engellenmez.
- Düğme, bağlantı, metin alanı, seçim kutusu ve düzenlenebilir içerikten başlayan hareket görev kaydırması sayılmaz. Metin seçimi tüm sayfada kapatılmaz.
- Aynı anda yalnız bir satır açık kalır. Kayıt sürerken aynı görevde ikinci yazma başlatılmaz.
- `touch-action` ile doğal dikey kaydırma ve yakınlaştırma korunur. Azaltılmış hareket tercihinde uzun animasyon kullanılmaz; titreşim zorunlu değildir.
- Bütün işlemler görünür menüyle de yapılabilir. İlk kullanımda kısa açıklama sunulur; dokunma hedefi en az 44px kalır.

## 3. Arşiv ve geri alma

Arşiv silme değildir. Görev listeden çıkar; “Görev arşivlendi — Geri al” bildirimi yaklaşık 10 saniye görünür. Odak/üzerine gelme durumunda süre durur. Süre bitince Arşiv filtresinden geri yükleme her zaman erişilebilir kalır.

- Aynı yardımcı liste, pano, hafta, detay ve menüdeki arşivlemeye uygulanır. Panoyu arşivleme ayrı bir toplu bağlamdır; pano menüsünde kapsam açıklaması ve geri alma sunulur.
- Bildirim yalnız sunucu başarısından sonra çıkar. Hata halinde kart yerinde kalır, hata gösterilir. Arayüz erken kaldırma yaparsa başarısızlıkta kart ve sayılar geri konur.
- Geri al yalnız değişen alanları eski değerlerine döndürür; tüm eski görev kopyasını yazmaz. Dönen güncel sürüm ve ayrı işlem anahtarı kullanılır.
- Başka kullanıcı/Grokbot arada değiştirdiyse sürüm çakışması görünür olur; güncel kayıt okunur, sessiz ezme yapılmaz. Yetki kaybı ayrıca açıklanır.
- Arka arkaya arşivlenen görevlerin geri alma kayıtları karışmaz. Yenileme sonrası bildirim kaybolsa bile Arşiv yolu kalır.
- Arşiv görünümünde sağ hareket “Arşivden çıkar”dır. Normal tarih/durum yazmaları arşivden çıkarılana kadar sunulmaz.
- Tarih ve durum değişiklikleri de alan bazlı Geri al kullanır. Tamamlama geri alındığında tekrar sisteminin oluşturduğu sonraki görev otomatik silinmez; mevcut tekrar kuralı korunur ve kullanıcıya açıklanır.

## 4. Diğer Panel sayfalarına yayılım

| Alan | İyileştirme |
| --- | --- |
| Görevlerim; Bugün/Hafta/Gecikmiş | Ortak kaydırma/menü, renkli etiketler, etkin filtre özeti ve sonuç sayısı |
| Ekip | Aynı görev işlemleri; sorumlu ve ekip bilgisi; yalnız yetkili işlemler |
| Pano içi liste | Aynı kart ve işlemler; etiket filtresi, kaydırma sonrası filtre/sıra korunması |
| Kanban | Kart basılı tutma ve kaydırma; durum seçicisi korunur, hareketler sütun sürüklemeyle yarışmaz |
| Panolar ana ekranı | Pano kartında görünür menü; açma/düzenleme/arşiv ve geri alma. Görev hareketleri tüm panoyu yanlışlıkla arşivlemez |
| Notlar | Etiketler ve arşiv; hızlı menüde Göreve dönüştür. Anlamsız tamamlama/erteleme seçenekleri gösterilmez |
| Hedefler | Etiketler, bağlı görev ve ilerleme özeti; mevcut bağlantı ve tür değiştirme kısıtları korunur |
| Gelen | Kaydırma ile Okundu/Okunmadı, basılı tutmayla bildirimi/görevi açma. Bildirim hareketi bağlı görevi arşivlemez |
| Tamamlanan/Arşiv | Yeniden açma/Arşivden çıkar; boş sonuçta uygun geri dönüş eylemi |
| Kayıtlı görünümler | Etiket filtreleri kaydedilir; URL, yenileme ve sayfalama aynı sonucu korur |

Paylaşım, ekip üyeliği veya iş bağlantısı bir kaydırma hareketiyle değişmez. Görev satırları farklı sayfalarda kopyalanmaz; davranış ortak bileşende yaşar.

## 5. Renkli ve genişletilebilir etiketler

Başlangıç seçenekleri: **Teklif — mor**, **Proje — mavi**, **Satın Alma — turuncu**. Bunlar ilk katalogdur; eski görevler kendiliğinden tahmin edilerek etiketlenmez. Bir görev birden fazla etiket taşıyabilir.

Yerleşim:

- Yeni görev formunda, ek ayrıntıları açmadan erişilen Etiket ekle alanı.
- Görev detayında başlığın hemen altında renkli etiketler ve ekle düğmesi.
- Liste/pano/hafta kartında en fazla iki etiket ve kalanlar için “+N”; tamamı detayda erişilebilir.
- Aranabilir çoklu seçim; sonuç yoksa yetkili kullanıcı için “Yeni etiket oluştur”. Ad ve hazır renk paleti seçimi.
- Etiket yönetiminde ad/renk düzenleme ve arşivleme. Kullanılmış etiket kalıcı silinmez; arşivlenince geçmiş görevde görünür, yeni atamada seçilmez.
- Filtrede birden çok etiket, “Herhangi biri / Tümü” ve “Etiketsiz” seçenekleri. Filtre sunucuda sayfalama öncesi uygulanır.

Veri ve yetki önerisi:

- `task_tags`: kimlik, ad, normalize ad, renk tonu, kapsam (`global`, `team`, `personal`), ekip/sahip, arşiv damgası, sürüm ve zamanlar.
- `task_tag_links`: görev ve etiket ilişkisi; çift benzersizdir. Sorgu yönlerine uygun indeksler eklenir.
- Genel katalogdaki üç başlangıç etiketi herkesçe kullanılabilir; genel katalog düzenlemesi Yöneticiye aittir. Kullanıcı kişisel, yetkili ekip üyesi ekip kapsamlı etiket ekleyebilir; ortak kataloğu yeniden adlandırma/arşiv yetkisi ayrıca sınırlandırılır.
- Kişisel etiket yalnız sahibinin özel görevine, ekip etiketi aynı ekibin görevine atanır. Doğrudan/iş kapsamındaki görevlerde genel etiketler kullanılır; özel etiket adı başka kullanıcıya sızdırılmaz.
- Paylaşım/pano değişimi uyumsuz etiket varsa açıkça bildirilir; kullanıcı seçimi olmadan kapsam genişletilmez veya etiket silinmez. API bu durumu tanımlı hata ile döndürür.
- Aynı kapsamda normalize edilmiş ad benzersizdir. Türkçe ad kuralları ve `adBuyuk`/`trKatla` kullanımı mevcut uygulamayla tutarlı olur.
- Önerilen sınırlar: ad 1–40 karakter, görev başına en fazla 10 etiket. Serbest HEX yerine mevcut OKLCH ton paleti; açık/koyu temada metin kontrastı. Renk tek bilgi taşıyıcısı olmaz.
- Etiket ilişkisinin değişmesi görevin sürümünü ve `updated_at` değerini artırır; olay kaydında kullanıcı/ajan görünür. Tekrarlayan göreve geçerli etiketler kopyalanır.
- Katalog ad/renk değişikliği katalog sürümünü artırır; UI kataloğu yeniler. Grokbot katalog değişimini de ayrı olarak çekebilir.
- İlişki yazması görev oluşturma/güncelleme ile aynı transaction'da, mevcut `task_command` güvenlik/sürüm/tekrar mekanizması üzerinden yapılır. RLS ve sunucu aynı kapsam sınırını korur.

## 6. Grokbot API sözleşmesi — eklenecek

Aşağıdaki uçlar **önerilen yeni sözleşmedir; henüz mevcut değildir**. Var olan görev okuma/yazma ve kimlik doğrulama korunur.

| Uç | İşlev |
| --- | --- |
| `GET /api/agent/tasks/tags` | Yetkili katalog; arama, kapsam, arşiv, güncelleme zamanı ve sayfalama |
| `POST /api/agent/tasks/tags` | Ad, `color_hue` ve kapsam ile yeni etiket |
| `PATCH /api/agent/tasks/tags/{tagId}` | Sürümle ad/renk düzenleme veya arşivleme |
| `POST /api/agent/tasks` | İsteğe bağlı `tag_ids` ile görev ve etiketleri birlikte oluşturma |
| `PATCH /api/agent/tasks/{id}` | `tag_ids` ile tam listeyi değiştirme veya `add_tag_ids` / `remove_tag_ids` ile mevcut etiketleri koruyarak düzenleme |
| `GET /api/agent/tasks?tagIds=…&tagMatch=any` | Etikete göre görev arama; `all` ve `untagged=true` da desteklenir |

Görev yanıtında `tag_ids`, katalogda kimlik/ad/renk/sürüm bulunur. Kimlik katalog üzerinden çözümlenir. Gönderilmeyen alan değişmez; `tag_ids: []` temizler. Tam liste ve ekle/çıkar kipleri aynı istekte kullanılamaz. Aynı kimlik hem ekle hem çıkar listesinde olamaz; `null` geçerli etiket listesi değildir. Etiketsiz filtresiyle etiket listesi birlikte gönderilirse doğrulama hatası döner.

Okuma `tasks:read`, göreve etiket atama `tasks:write`; katalog oluşturma/düzenleme için ayrıca dar `tasks:tags:manage` izni önerilir. Bu izin kayıt/kapsam yetkisinin yerine geçmez; mevcut Grokbot bağlantısına kendiliğinden verilmez. Plan 012'deki entegrasyon izin paneli/uç kataloğuyla birlikte güncellenir.

Grokbot'a teslim edilecek akış:

1. Kataloğu oku; isim yerine gerçek etiket kimliğini kullan.
2. Teklif/Proje/Satın Alma sınıflandırmasını belirle; belirsiz görevi tahminle değiştirme.
3. Görevin güncel sürümünü oku; `add_tag_ids` ile ekle. Mevcut diğer etiketleri koru.
4. Etiket yoksa katalog yönetim izniyle uygun kapsamda oluştur. Aynı ad çakışmasında var olan kaydı tekrar bul.
5. Yazmada `Idempotency-Key` kullan; ağ tekrarında aynı anahtar ve aynı gövdeyi gönder. Yeni mantıksal işlemde yeni anahtar kullan.
6. 409 sürüm çakışmasında görevi yeniden oku; yeni duruma göre işlemi yeniden değerlendir. 403 yetkiyi, 422 girdiyi, 429 bekleme süresini, 503 geçici hizmet sorununu ayrı ele al.
7. Kaydı tekrar okuyup etiketi doğrula. Toplu sınıflandırmada mevcut sayfalama ve hız sınırlarına uy.

Örnek ekleme gövdesi: `{ "version": 7, "add_tag_ids": ["<katalogdan-alınan-uuid>"] }`. Temsili sürüm ve kimlik gerçek kayıttan alınır. OpenAPI, kurulum rehberi, izin matrisi ve hata örnekleri birlikte teslim edilir. Mevcut Grokbot bağlantısının canlı durumu bu incelemede doğrulanmadı; eski dokümandaki kurulum durumu güncel kabul edilmez.

## 7. Yeni görev penceresinin düzeltilmesi

Öncelik P0: yeni görev açılışındaki taşma önce ele alınır.

1. `/dev/panel-preview` üzerinde gerçek formu bütün açılış düğmelerinden aç; listenin başında/ortasında/sonunda dene. Üretimde kullanılan sürümle yerel sürümün farkını kontrol et.
2. Pencere ve görünür ekran sınırlarını ilk açılış, odak, klavye aç/kapat, adres çubuğu değişimi ve yön dönüşünde ölç. Yalnız belgenin toplam genişliğini ölçmek yeterli değildir.
3. `DialogContent`, `mobile-form-viewport.*`, `.tw-create-dialog` ve `.tw-detail-dialog` arasındaki konum/translate/transform/yükseklik kurallarını incele; kanıtlanan çakışmayı gider. Üstüne yeni `!important` katmanları eklemek yerine Panel pencere varyantını açıklaştır.
4. Mobilde görünür ekrana bağlı form: sabit başlık/kapatma, tek kaydırılabilir içerik, erişilebilir alt eylemler. Kısa ekranda eylemler içerikle kayabilir; aktif alanın üstüne binmez. Tablet genişliğinde kenar paylı, sınırlı pencere; klavyeyle kalan yüksekliğe uyar.
5. Açılışta mobil/tablette metin odağı zorlanmaz. Yazılan taslak odak, yön dönüşü, etiket seçimi ve ağ hatasında korunur. Ekranı kapatmada kaydedilmemiş içerik varsa çıkış uyarısı sunulur.
6. Safe area, tarayıcı geri tuşu, odak dönüşü, iç içe seçici kapanışı ve alt gezinmeyle katman ilişkisi kontrol edilir.

Kabul: başlık/kapatma görünür; yazılan alan klavye altında kalmaz; bütün alanlar ve Kaydet erişilebilir; yatay taşma ve çift kaydırıcı yok; taslak kaybolmaz. Fiziksel iPhone/iPad kabulü emülasyondan ayrı raporlanır.

## 8. Kompakt ve anlaşılır görev detayı

Üstten alta bilgi sırası:

1. **Başlık ve kimlik:** görev türü ikonu, okunur başlık, kapat/üç nokta; altında renkli etiketler.
2. **Durum özeti:** metinli durum rozeti, öncelik ve gecikme uyarısı. Kategori rengiyle durum rengi ayrı yerlerde kullanılır.
3. **Temel bilgiler:** kişi ikonu + Sorumlu; takvim + Termin; iş ikonu + İş kodu; pano ikonu + Pano. Her alanın etiketi, değeri ve düzenlenebilir sınırı görünürdür.
4. **Açıklama:** ayrı başlık ve hafif zemin; boşsa Açıklama ekle. Uzun içerik daraltılabilir ve tam metne ulaşılır.
5. **İş akışı:** Kontrol listesi ve ilerleme; tekrar ve beklenen görev özetleri. Veri varsa anlaşılır özet, düzenleme isteğinde ayrıntılar açılır.
6. **Dosyalar:** ikon, dosya adı/türü/boyutu ve ek sayısı; uzun ad taşmaz.
7. **Yorumlar / Geçmiş:** belirgin sekmeler, kullanıcı/ajan kimliği, zaman ve değişen alanın eski → yeni değeri. Yorum alanına hızlı erişim korunur.
8. **Paylaşım ve gelişmiş işlemler:** kilit/ekip ikonu ve mevcut erişim özeti; kapsam değişikliği ayrı bölümde. Arşiv görünür menüde bulunur.

Bölümler ince ayırıcı çizgi, ılımlı zemin farkı, tutarlı ikon ve boşluk ritmiyle ayrılır. Her alanı ayrı büyük karta dönüştürmeden yoğunluk sağlanır. Dokunmatik kullanıcı hover'a bağımlı kalmaz. Alan bazlı kayıt sonucu görünür; başlık/açıklama taslağının Kaydet davranışı açık olur.

Mobilde tam genişlikte tek sütun; yeterli alanda temel bilgiler iki sütun, 360px ve metin büyütmede tek sütun. Tablette kullanılabilir içerik genişliğine göre kenar paylı panel; masaüstünde yaklaşık 560–640px sağ detay paneli. Liste bağlamı, filtre ve kaydırma yeri korunur. 44px hedef ve dokunmatikte 16px giriş yazısı kompaktlık uğruna küçülmez.

## 9. Uygulama sırası ve kontrol kapıları

| Faz | İş | Bitiş ölçütü |
| --- | --- | --- |
| F0 — Başlangıç | Gerçek bileşen önizlemeleri; mevcut dal/sürüm; hata üretimi; plan 011/012/013 ile çakışma kontrolü | Taşma tekrar adımları ve önce görüntüleri; mevcut olmayan cihaz kanıtı açık |
| F1 — Pencere | Yeni görev taşması, klavye, tablet, taslak ve katman düzeltmesi | Oluşturma ve detay formu görünür alan testleri geçer |
| F2 — Detay | Bölüm hiyerarşisi, ikon/renk, kompakt bilgi alanları | Mobil/tablet/masaüstü açık/koyu görsel kontrol |
| F3 — Ortak işlemler | Hızlı menü, arşiv/geri al, tarih değiştirme; ardından dokunmatik hareket | Kaydırma/dikey kaydırma ayrımı; hata, sürüm ve geri alma kontrolleri |
| F4 — Etiket altyapısı | Şema, RLS, komutlar, filtre/sayfalama, tekrar ve olay kaydı | Yetki ve transaction testleri; eski görev/API uyumu |
| F5 — Etiket arayüzü/API | Katalog yönetimi, seçiciler, renkli kartlar, Grokbot uçları ve OpenAPI | UI ve API'den aynı kayıt; mevcut etiketleri koruyan ekleme |
| F6 — Yayılım | Ekip/pano/hafta/not/hedef/Gelen ve kayıtlı görünümler | Bağlama uygun işlemler; filtre ve geri dönüş korunur |
| F7 — Teslim | Regresyon, cihaz kabulü, geçiş/yayın ve doküman | Kanıtları olan sonuçlar; açık kalan fiziksel kontroller ayrı |

F4, F5'in önkoşuludur; görev hareketleri etiket yokken de çalışabilir. Plan 012'deki sürmekte olan entegrasyon değişiklikleri korunur. Plan 013 alt gezinme kapsamını yönetir; burada ikinci bir gezinme sistemi kurulmaz.

## 10. Doğrulama matrisi

- 320/360/390/430px telefon; 768/820/1024px tablet; 1280/1440px masaüstü. Portre/yatay; açık/koyu; %200 metin; azaltılmış hareket.
- Chromium ve WebKit önizlemesi; ayrıca gerçek iPhone Safari ve iPad Safari. Android Chrome ve kullanılan PWA varsa gerçek kullanım kabulü.
- Tek dokunma, uzun basma, kısa/uzun yatay hareket, çapraz/dikey hareket, yarıda bırakma, listeyi hızlı kaydırma, ikinci parmak, tekrar tıklama, kenardan geri hareketi.
- Arşiv → Geri al; arşiv listesi → geri yükle; peş peşe farklı görev arşivi; ağ kesintisi; yanıttan önce yenileme; araya giren Grokbot güncellemesi; yetki kaybı.
- Tekrar eden görevi tamamla/geri al/yeniden tamamla; beklenen görev engeli; hedef ilerlemesi ve sayaçlar.
- Etiket oluştur/yeniden adlandır/renk değiştir/arşivle; mükerrer Türkçe ad; yanlış kapsam; arşiv etiketi atama; 10 etiket sınırı; uzun ad; veri sızıntısı denemeleri.
- Etiketli/etiketsiz ve any/all filtreleri; 50'den fazla görevde sayfalama/toplam; URL yenileme; kayıtlı görünüm; `updatedSince` ile ilişki değişikliğini yakalama.
- API'de gerçek yetki ayrımı, aynı isteğin tekrarı, 409 çakışması, kısmi etiket güncellemesi ve görev+etiket atomikliği. Başarısız etikette yarım görev bırakılmaması.
- Yeni görevde tüm ayrıntılar/kişi/etiket seçicisi açıkken klavye ve dönüş; detayda uzun açıklama, çok dosya/yorum, boş alanlar, salt okunur kayıt.

Mevcut mobil kontrol betikleri genişletilir; hedefli model/API/SQL testleri, TypeScript, ilgili lint ve üretim derlemesi çalıştırılır. SQL doğrulaması geri alınan test transaction'larında yapılır; üretime örnek görev bırakılmaz. Sonuçlar planın gerçekleşme bölümüne işlenir; bu plan yazılırken test çalıştırılmış sayılmaz.

## 11. Dosya kapsamı ve geçiş

- `src/app/(app)/panel/task-workspace.tsx`, `task-workspace.css`: ortak satır, liste ve detay entegrasyonu; büyüyen bileşenden menü/etiket/detay bölümleri ayrılır.
- `src/components/account/`: görev seçicileri, akış ve kayıtlı görünüm entegrasyonu; yeni ortak hareket/etiket bileşenleri.
- `src/components/ui/dialog.tsx`, `mobile-form-viewport.ts`, `mobile-form-viewport.css`: kanıtlanan pencere düzeltmesi; ortak davranış değişirse diğer modül Dialog'ları da kontrol edilir.
- `src/lib/tasks/model.ts`, `service.ts`, görev sunucu eylemleri: şema, filtre, kapsam, sürüm ve komut sözleşmesi.
- `src/app/api/agent/tasks/[[...segments]]/route.ts`: yeni katalog yolları, ayrıştırma ve izinler. Mevcut iki segment sınırı bilinçli genişletilir; `tags` görev kimliği gibi yorumlanmaz.
- Yeni benzersiz zaman damgalı `supabase/migrations/` dosyaları; mevcut migration'lar değiştirilmez. Agent izin tanımları ve entegrasyon kataloğuyla uyum sağlanır.
- `docs/task-api.openapi.json`, `docs/task-workspace.md`, ilgili alan kuralları ve mobil/API/SQL kontrolleri güncellenir.

Geçiş eklemeli olur: eski görevler boş etiketle geçerli kalır; önce şema/komut, sonra API/UI. Yayın sonrası oluşturma, etiketleme, arşiv/geri alma ve mobil form kısa kontrolü yapılır. Sorunda yeni hareket/etiket arayüzü kapatılarak eski menü işlemleri sürdürülebilir; geri dönüşte etiket tabloları ve kullanıcı verileri silinmez.

Teslim: düzeltilmiş yeni görev formu, yenilenmiş detay, tutarlı dokunmatik işlemler, geri alınabilir arşiv, yönetilebilir renkli etiketler, belgeli Grokbot API ve cihaz bazlı kontrol raporu.
## 12. Uygulama kaydı — 12.09.2026

### Kullanıcının ek kararı: kontrollü iptal

Kullanıcı açıkça **“İptal et” ve “İptal edilenler”; neden ve işlem geçmişi korunsun** seçeneğini seçti. Kalıcı görev silme eklenmedi. İptal 3–500 karakter neden ve güncel sürüm ister. Kişisel/kişiye özel görevde oluşturan; ekip görevinde ekip sahibi/yöneticisi veya sistem yöneticisi; iş görevinde sistem yöneticisi yetkilidir. Atama tek başına iptal yetkisi vermez. Geri açma önceki arşiv durumunu geri getirir. Bekleme/hedef bağlantıları düzenlenmeden bağlı görev iptal edilemez.

`task_cancellation_events`, aktör/ajan, zaman, neden ve önceki görev kopyasını eklemeli geçmişte korur. Bu geçmiş güncellenemez/silinemez. Kişisel kayıt görünürlüğü korunur; paylaşılan işlem diğer yetkili yöneticilerin Gelen bölümüne düşer. Ajan için ayrı `tasks:cancel` izni ve `/tasks/{id}/cancel`, `/tasks/{id}/reactivate` uçları eklendi. Mevcut Grokbot izinleri otomatik genişletilmedi.

### Tamamlanan geliştirmeler

- Ortak görev satırında 450 ms basılı tutma, sağa arşiv, sola tarih/ertele; üç nokta ile aynı işlemler. Dikey kaydırma, kısa hareket, çoklu parmak ve kenardan gezinme korunur. Arşiv ve tarih/durum değişikliklerinde 10 saniyelik Geri al, güncel sürümle yalnız ilgili alanı geri yükler.
- Ekip/pano/hafta/not/hedef satırları ortak bileşeni kullanır. Pano kartında aç/arşiv; Gelen satırında okundu/okunmadı ve geri al bulunur.
- TEKLİF/PROJE/SATIN ALMA başlangıç etiketleri; 6 renk, çoklu seçim, yeni kategori, ad/renk düzenleme ve katalog arşivi. Kişisel/ekip/genel kapsam, 10 etiket sınırı, Türkçe ad benzersizliği, any/all/etiketsiz filtreleri, URL/kayıtlı görünüm, kısmi ekle/çıkar ve tekrar eden göreve aktarım uygulandı.
- Yeni görev penceresinin ilk açılışındaki taşma tekrar üretildi: genel CSS geçişi viewport koordinatlarını animasyonla değiştiriyordu. Konum geçişi kaldırıldı; telefon/tablet görünür alanı ve klavye yüksekliği kullanılır. Mobil/tablette otomatik metin odağı zorlanmaz, kaydedilmemiş taslakta çıkış uyarısı vardır.
- Detayda ikonlu başlıklar, ayırıcılar, etiket/durum/öncelik özeti, iki sütunlu temel alanlar, dar ekranda tek sütun, açılır iş/hedef/paylaşım ayrıntıları, ayrı açıklama/yorum/geçmiş alanları eklendi.
- OpenAPI 1.3 ve `docs/grokbot-task-tags.md` hazır. Katalog için `tasks:tags:manage`, iptal için `tasks:cancel` ayrı izinlerdir. Normal etiket atama `tasks:write` kullanır.

### Doğrulama kanıtları

- 49 model/servis/API/entegrasyon testi geçti. İlgili ESLint kontrolü ve tüm uygulamanın üretim derlemesi geçti.
- Chromium ve WebKit: 320/360/390/430/768/820/1024/1280/1440 px, açık/koyu, yeni görev ve detay sınırları, 390/820 klavye alanı/taslak, hareketler, etiket oluşturma/atama, iptal nedeni/geçmişi/yeniden açma: her motorda 21 kontrol grubu. Kanıtlar `artifacts/task-014-chromium` ve `artifacts/task-014-webkit`.
- Chromium mevcut panel/profil/ekip/geri bildirim regresyonu: 77 kontrol geçti. WebKit'te ortak geliştirme sunucusunun başka önizlemeye yönlendirmesi ayrı bağımsız paket kontrolü gerektirdi; geçmediği koşul geçmişe başarılı yazılmadı.
- WebKit'te önizleme `PageHeader` bileşeninin istemcide sonradan yerinde çizilmesi ilk otomatik tıklamayı kaydırıyordu. Testte başlığın görünmesi beklenerek sayfanın hazır olması doğrulandı; gerçek üretim kabuğunun portal davranışı değiştirilmedi.
- SQL: etiket kapsamı, benzersizlik, atomiklik, sürüm/tekrar anahtarı, arşiv/tekrar, aktör sahteciliği; iptal yetkisi, zorunlu neden, değiştirilemez geçmiş, kişisel kayıt gizliliği, güncelleme engeli, yeniden açma ve önceki arşiv durumu geçti. Test işlemleri geri alındı.
- `20260912200000_task_tags.sql` ve `20260912210000_task_cancellation.sql` Supabase'e uygulandı; migration kayıtları tekrar okundu. Mevcut görevler silinmedi, test kayıtları kalıcı bırakılmadı.

Fiziksel iPhone/iPad/Android klavyesi ve PWA, gerçek %200 sistem metni ve Grokbot'un kendi ortamından yetkili çağrı bu otomatik kanıtların yerine geçmez; saha kabulü açık tutulur.
### Bağımsız yayın paketi ve onay kapısı

`artifacts/task-014-release/source.json` yalnız görev değişiklikleri için kaynak parmak izlerini tutar. Kaynak tabanı, daha önce yayınlanan entegrasyon paketi ve inceleme sırasında canlıya çıkan `917a0e819bf3aaf51796646a9bb01947203f8045` CAD commitidir. Bu CAD commitinin çalışma dosyaları korunmuştur. Henüz yayın kapsamında olmayan 013 alt barı paket kopyasından ayrıldı; ana çalışma ağacındaki 013 değişikliklerine dokunulmadı. Son canlı dağıtım kimliği `dpl_3coXThKhEWRgy1mn5twPrR1wdRb6` olarak doğrulandı.

Paketin 49 kod/API testi, ilgili kod denetimi ve üretim derlemesi geçti. Kaynak kodunu gönderme komutu **otomatik onay denetimi tarafından reddedildi**: Vercel hedefine özel kaynak kodu aktarımı ve üretim dağıtımı için kullanıcıdan hedefe özel açık onay istendi. `--skip-domain` ile alan adı değiştirmeden hazırlama komutu da bu denetime takıldı. Alternatif bir aktarım yolu denenmedi. Paket Vercel'e yüklenmedi, canlı adres değiştirilmedi; Supabase'e uygulanmış eklemeli şema çalışır durumda kaldı. Kullanıcıya hazırlanan paketin Vercel'e gönderilip `app.orioncranes.com` üzerinde yayınlanması için açık onay sorulacak.
### Son bağımsız paket kontrolü

- `artifacts/task-014-release/chromium/report.json` ve `webkit/report.json`: her motorda 21 kontrol grubu, hata yok.
- `chromium-rotation/report.json` ve `webkit-rotation/report.json`: her motorda ek 4 grup; pointercancel, ikinci parmakla hareketin iptali ve 390×900 → 820×390 dönüşünde taslağın korunması geçti. Bu kontroller fiziksel cihaz klavyesi iddiası taşımaz.
- Bağımsız kopyada eksik `.gitignore`, geliştirme sırasında oluşan derleme dosyalarının CSS taramasına girmesine yol açtı; paket tarifine mevcut `.gitignore` eklendi ve yalnız o paketin üretilmiş geliştirme önbelleği temizlendi. Uygulama kaynak stilinde rastgele hata bastırma yapılmadı. Son tarayıcı kontrolleri bu düzeltmeden sonra geçti.
- Yerel sırlar, bağımlılıklar, derleme çıktıları, testler, geliştirme sayfaları ve Supabase kaynakları yayın yüklemesinden dışlanır; içe aktarılan `docs/task-api.openapi.json` pakette açıkça korunur. Vercel aktarımı hâlâ yapılmadı; onay engeli sürüyor.
### Canlı yayın tamamlandı — 12.09.2026 22:15

Kullanıcı hazırlanan paketin Vercel'e aktarılıp `app.orioncranes.com` üzerinde yayınlanmasını **“ONAYLIYORUM”** mesajıyla açıkça onayladı. Önceki onay engeli bu mesajla çözüldü.

Onaydan sonra canlı sürümün `ce4bc79df3c835cd47e066f9ccee7dab39e34f44` alt gezinme commitine geçtiği görüldü. Paket bu canlı commitin üzerine güncellendi; alt menüler, CAD değişiklikleri ve API/Entegrasyonlar bağlantısı korundu. Son paket 49 test ve TypeScript kontrolünden geçti.

İlk Vercel denemesinde kök Supabase klasörünü dışlayan kuralın `src/lib/supabase` bağlantı kodunu da dışladığı saptandı. Kural `/supabase` olarak köke sabitlendi; başarısız deneme canlıya alınmadı. Düzeltilen paketin Vercel üretim derlemesi geçti.

- Yayın: `dpl_2CPBnL9PqCJHmFN346ENrCoNbwQC`, durum **READY**.
- Canlı adres: `https://app.orioncranes.com`.
- Canlı alan adına geçişten hemen önce önceki dağıtım kimliği tekrar doğrulandı; başka bir yayının üstüne yanlışlıkla geri dönüş yapılmadı.
- Korumalı önizleme: giriş 200, uygulama anahtarı olmayan etiket API isteği 401.
- Canlı alan adı: giriş 200; oturumsuz panel ve Yönetim girişe 307 yönlendirme; etiket ve iptal edilen görevler API'si anahtarsız 401 ve istek kimliği. Beş erişim kontrolü geçti.
- Kanıtlar: `artifacts/task-014-release/source.json`, `http-check.json`. Mevcut kullanıcı görevleri üzerinde deneme iptali/etiketleme yapılmadı; fiziksel cihaz ve Grokbot'un kendi ortamından yetkili çağrı kabulü ayrı kalır.
