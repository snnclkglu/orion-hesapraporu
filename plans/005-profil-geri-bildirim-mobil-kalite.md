# Profilim, yönetim geri bildirimleri ve mobil kalite planı

Tarih: 12 Eylül 2026. Durum: uygulama ve veritabanı geliştirmesi yapıldı; otomatik kontroller geçti. Görsel yükleme sunucu yapılandırması, fiziksel cihaz kabulü ve arayüz yayını açık. Güncel faz/kanıt kaydı: [007 — Uygulama ve kontrol kaydı](007-profil-ekip-uygulama-kontrol.md). Aşağıdaki tasarım kararları başlangıç planını korur; gerçekleşme durumu 007'de izlenir.

Bu plan [004 — Panel görev yönetimi](004-panel-gorev-yonetimi.md) üzerine eklenir. Önceki Panel geliştirmesinin mobil kabul açıklarını kapatır; uygulama genelindeki üst şeride profil erişimi, kullanıcıya Profilim ve Yönetim'e Geri Bildirimler sayfası ekler. Mobil kalite, her fazın bitiş koşuludur.

12 Eylül ek kapsamı: [006 — Ekip yönetimi ve görev görünürlüğü](006-ekip-yonetimi-gorev-gorunurlugu.md). Mevcut ekip altyapısı korunarak Yönetim/Ekipler, Kullanıcılar'dan aranabilir üyelik yönetimi ve ekip/kişisel görev kapsamları uygulandı. E0 bu planın F0'ına, ekip önizlemeleri F1–K1'e bağlanır. Ekip ekranları ortak mobil ve yayın kabulüne dahildir.

## 1. Kullanıcının kesinleşen kararları

- Sağ üstte bildirim zilinin yanında küçük, yuvarlak kullanıcı fotoğrafı bulunacak.
- Fotoğrafa basınca doğrudan Profilim sayfası açılacak. Araya zorunlu bir hesap menüsü konmayacak.
- Kullanıcı fotoğrafını ve izin verilen kişisel bilgilerini düzenleyebilecek.
- Kullanıcı uygulama hakkında geri bildirim gönderebilecek ve kendi gönderilerini görebilecek.
- Yönetim bölümünde tüm geri bildirimleri listeleyen ayrı sayfa olacak.
- Kullanıcıya yanıtlaşma, destek bileti veya işleme alınma/çözülme takibi eklenmeyecek. Kullanıcının seçtiği kapsam: yalnız yöneticiye iletim ve gönderilen kayıtların görüntülenmesi.
- Hem mevcut Panel hem yeni sayfalar yüksek mobil kullanım kalitesiyle ele alınacak. Ekrana sığmak tek başına yeterli değil.

## 2. Mevcut durum ve yeniden kullanılacak altyapı

Bu bölüm başlangıçtaki yerel kaynak incelemesidir. Uygulama sırasında canlı şema ve migration kontrolleri yapıldı; fiziksel cihaz testi yapılmadı. Güncel sonuçlar 007'de ayrı kaydedildi.

| Bulgu | Kaynak | Uygulama kararı |
| --- | --- | --- |
| Üst kimlik satırı 48px; sağda tema ve bildirim denetimleri var | `src/components/app-shell.tsx` | Avatar aynı satıra eklenir; sayfa eylem şeridine karışmaz. Uzun başlık ve üç denetimin birlikte sığması test edilir. |
| Sol menü altında baş harfli kullanıcı kartı var | `app-shell.tsx` | Aynı avatar bileşeni ve Profilim bağlantısı burada da kullanılır. |
| Oturum profili istek başına tekilleştiriliyor; yalnız ad/rol okunuyor | `src/lib/profile.ts`, `(app)/layout.tsx` | Gerekli küçük avatar metadata'sı bu yoldan taşınır; her sayfada ikinci kullanıcı sorgu zinciri kurulmaz. |
| Mevcut `/admin/users/[id]` profili yöneticiye kullanım/olay analizi gösteriyor | `admin/users/[id]/user-profile-view.tsx` | Kişisel ayarlar için yeniden kullanılmaz; `/profile` ayrı yüzdür. Kullanım puanı ve personel verileri Profilim'e kopyalanmaz. |
| `profiles` ad, unvan, rol ve ilişkili kimlik verisini taşıyor | çekirdek/security/profile-email migrations | Kullanıcı kimliği aynı kalır; ikinci kullanıcı tablosu açılmaz. Alan görünürlüğü ayrı tasarlanır. |
| Profil satırları authenticated kullanıcılarca okunabiliyor; rol değişikliği trigger ile korunuyor | `20260718000001_core.sql`, `20260719000004_security.sql` | Özel telefon gibi alanlar bu geniş okunan satıra konmaz. Kendi satırını güncelleme yetkisi, her sütunu değiştirebilme anlamına gelmez. |
| Yönetici profil güncellemesi ad/unvan/rolü aynı action'da düzenliyor | `(app)/admin/actions.ts` | Kullanıcı öz-servisi ayrı, dar alan sözleşmesi kullanır; mevcut yönetici yolu korunur. |
| Giriş e-posta + parola; incelenen auth sayfa ağacında self-service güvenlik sayfası yok | `(auth)/login/page.tsx` | Parola değiştirme akışı ayrıca tasarlanır; çalışmayan güvenlik düğmesi konmaz. |
| Bildirim zili `notifications` okuyor; Panel Gelen kutusu `task_inbox` okuyor | `notification-bell.tsx`, `lib/tasks/**` | Yeni geri bildirim için mevcut global zil değerlendirilir. İki görev bildirim kaynağının mobil tutarlılığı denetlenir; kapsam dışı büyük bildirim yeniden yazımı yapılmaz. |
| Sunucuda `sharp` ve güvenli görsel normalleştirme örneği var | `lib/customers/logo-image.ts` | Görsel işleme ilkeleri yeniden kullanılır; müşteri logosunun yatay boyutları avatar için kullanılmaz. |
| Manifest standalone açılışı ve portre tercihine sahip | `src/app/manifest.ts` | Ana ekrana eklenmiş uygulama ayrıca test edilir. Yatay yön kullanımını gereksiz engelleyen karar pilotta yeniden değerlendirilir. |
| Ürün geri bildirim toplama ekranı bulunmadı | `src/app`, `src/components` taraması | Küçük bağımsız geri bildirim modülü kurulur. Otomatik seçim motorunun teknik feedback'i bununla karıştırılmaz. |

### Önceki Panel geliştirmesinin kabul durumu

Uygulananlar: görev/ekip/pano/not/hedef, mobil alt navigasyon, hızlı ekleme, satırdan tarih/kişi, tamamlama/geri alma, detay, yorum/geçmiş/ek, arşiv, güvenli görev API'si. Önceki teslimde 19 kayıt korundu, beş migration uygulandı. Arayüz üretime dağıtılmamıştı.

Önceki kanıt: 360/390px telefon, 768px tablet ve 1440px masaüstü tarayıcı kontrolleri; seçili akışlarda yatay taşma görülmedi. Hedefli 182 test ve üretim derlemesi geçti. 10.000 geçici görevde 50 kayıt sorgusu tek ölçümde 417 ms oldu.

Bu sonuçlar fiziksel iPhone/Android, sanal klavye, ekran okuyucu, açık tema veya üretim Core Web Vitals başarısı değildir. Bu plan o açıkları yeniden kontrol listesine alır. Veritabanı sorgu süresi mobil ekranın açılma süresi olarak sunulmaz.

## 3. Bilgi mimarisi ve gezinme

| Yol | Erişim | İçerik |
| --- | --- | --- |
| `/profile` | Oturum açmış kullanıcı | Kendi profil özeti, fotoğraf, iletişim, tercihler, güvenlik ve geri bildirim bağlantıları |
| `/profile/feedback/new` | Oturum açmış kullanıcı | Yeni geri bildirim formu |
| `/profile/feedback` | Oturum açmış kullanıcı | Yalnız kendi gönderileri |
| `/profile/feedback/[id]` | Gönderen | Gönderdiği metin, tarih ve ekler; yönetici iç işlemleri gösterilmez |
| `/admin/feedback` | Yönetici | Tüm gönderiler, arama/süzgeç, okunmamış işareti, arşiv |
| `/admin/feedback/[id]` | Yönetici | Tam içerik, gönderen bilgisi, ekler, yönetim eylemleri |

Yollar önerilen kesin uygulama sözleşmesidir; geliştirme başında çakışma kontrolü yapılır. Ekran adları tamamen Türkçe olur.

Avatar → Profilim bir dokunuştur. Profilim'den Geri bildirim gönder ve Gönderdiğim geri bildirimler doğrudan görünür. Panel Menü'de Profilim kısa yolu bulunur; böylece telefonda başparmakla alttan da ulaşılır. Panel'in beşli alt navigasyonu korunur, altıncı ikon eklenmez. Profil ve yönetim sayfalarına yanlış aktif sekmeli Panel barı yayılmaz; bu sayfaların görünür geri bağlantısı bulunur.

Geri dönüş önceki sayfanın süzgeçlerini ve kaydırma konumunu korur. Doğrudan açılan profil sayfasında güvenli varsayılan dönüş Panel'dir. Dış URL'ye keyfi `returnTo` yönlendirmesi yapılmaz.

## 4. Sağ üst avatar tasarımı

- Görsel çap başlangıcı 28px; dar ekranda gerekirse 26px. Fotoğraf gerçekten daireseldir; en-boy oranı bozulmaz.
- Etkileşim alanı en az 44×44 CSS px. Zil ve avatarın görünmez hedefleri birbirinin üzerine binmez. Küçük görünen fotoğraf küçük dokunma hedefi anlamına gelmez.
- Yerleşim: sayfa kimliği → esnek boşluk → tema → bildirim → avatar. 320px stres testinde tema tercihi Profilim'den erişilirken üst şeritteki tema denetimi gizlenebilir; zil ve avatar küçültülmez.
- Fotoğraf yoksa Türkçe harflerle baş harfler; ad da yoksa nötr kişi simgesi. Kırık resim simgesi gösterilmez. Fotoğraf yüklenirken kutunun ölçüsü değişmez.
- Bağlantının erişilebilir adı “Profilim”; klavyede görünür odak halkası. İkonun anlamı yalnız tooltip'e bağlı olmaz.
- Yükleme sonrası üst şerit, sol menü ve profil özeti yeni fotoğrafı gösterir; görev listelerindeki avatar geçişi aynı güvenli bileşenle yapılır ve toplu yükleme maliyeti ölçülür.
- Dikkat dağıtan çevrimiçi noktası, profil tamamlama yüzdesi, zorunlu fotoğraf veya benzeri ek veri giriş baskısı eklenmez.

44px bu ürünün mevcut hedefidir; WCAG 2.2 AA minimum hedef ölçüsü olan 24px ile karıştırılmaz. Komşu hedeflerin aralığı da denetlenir. [W3C hedef boyutu açıklaması](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## 5. Profilim içeriği ve alan yetkileri

Mobilde tek kolon: üstte 72–80px fotoğraf, ad ve rol; altında kısa bölüm kartları. Çok uzun ve tek Kaydet düğmesine bağlı form yapılmaz. Kişisel bilgiler ile güvenlik eylemleri ayrı kaydedilir. Geri bildirim erişimi profilin ilk ekranında görünür.

| Alan / bölüm | Davranış | Görünürlük / kaynak |
| --- | --- | --- |
| Fotoğraf | Ekle, değiştir, kırp, kaldır; isteğe bağlı | Uygulama içi kimlik; oturum açmış kullanıcılar |
| Ad soyad | Kullanıcı düzenleyebilir; boş olamaz, mevcut Türkçe ad normalleştirme kuralı uygulanır | Mevcut `profiles.full_name`; görev/yorum atfı |
| Giriş e-postası | Gösterilir, sıradan metin alanı gibi değiştirilemez | Supabase Auth asıl kaynaktır; profil kopyası bağımsız güncellenmez |
| Unvan ve uygulama rolü | Görünür, kişisel sayfada salt okunur | Yönetici tarafından yönetilen mevcut alanlar |
| Ekipler | Üyelik listesi; kişi kendine yetki veya üyelik ekleyemez | Mevcut görev ekipleri |
| Telefon | İsteğe bağlı, açıklaması net; varsayılan olarak ekip rehberine açılmaz | Sahip + Yönetici erişimli özel detay kaydı |
| Kısa kişisel not | İsteğe bağlı, en fazla 500 karakter; özel not olarak açık etiketli | Sahip + Yönetici; genel biyografi gibi sunulmaz |
| Görünüm | Açık / koyu / sistem; mevcut tema mekanizmasıyla aynı tercih | İkinci bağımsız tema ayarı yaratılmaz; cihaz kapsamı belirtilir |
| Güvenlik | Parola değiştir, oturumu kapat | Mevcut Supabase Auth; ayrı onaylı güvenlik akışı |
| Geri bildirim | Gönder ve kendi kayıtlarını gör | Ürün geri bildirim modülü |

Telefon/not alanları zorunlu olmaz. Doğum tarihi, adres, kimlik numarası, maaş, özlük belgeleri ve çalışma performansı Profilim kapsamına alınmaz. Standart profil görünümü adına personel modülü çoğaltılmaz.

Ad değişikliğinin teklif/rapor imzaları, yorum aktörleri ve mevcut kullanıcı yönetimi üzerindeki etkisi önce haritalanır. Yayımlanmış belge snapshot'ları geçmişteki adı korumalıdır; mevcut ekranda gösterilen güncel adla belge geçmişi birbirine karıştırılmaz.

Parola değişiminde mevcut doğrulama/yeniden kimlik doğrulama ve Supabase proje ayarları incelenir; gerektirdiği adımlar uygulanır. Parola sunucu loglarına, analitiğe veya profil tablosuna yazılmaz. Şifremi unuttum/e-posta değiştirme/MFA/cihaz oturum listesi, yalnız altyapı ve ayrı akışları tamamlanırsa sonraki sürüme alınır; bu ilk teslimde çalışmayan seçenek gösterilmez. Kullanıcı silme mevcut kurumsal hesap yönetiminde kalır.

Yeni bildirim tercihleri yalnız gönderen altyapı bu tercihi gerçekten uygulayabiliyorsa eklenir. İlk sürümde tüm bildirimleri kapattığını iddia eden işlevsiz bir anahtar bulunmaz. Görev terminlerinin İstanbul günü hesabı profil tercihi nedeniyle sessizce değişmez.

## 6. Fotoğraf yükleme ve mobil dosya deneyimi

Akış: Fotoğrafı değiştir → cihaz seçicisi → dairesel kırpma önizlemesi → Kullan → kaydedildi. Fotoğraf kaldırma eski baş harf görünümüne döner. Kaydet başarısızsa eski fotoğraf kalır ve seçilen yeni fotoğraf yeniden denenebilir.

1. Cihazın fotoğraf seçicisi kullanılır; kamera zorunlu açılmaz. Fotoğraf çek seçeneği yalnız desteklenen cihazlarda sunulur. İzin reddi veya seçiciden vazgeçme hata alarmı üretmez.
2. Başlangıç sınırı 10 MB ve 40 megapiksel; sunucu gerçek formatı/ölçüleri denetler. JPEG, PNG, WebP desteklenir. HEIC/HEIF, iPhone pilotunda **ayrı teslim maddesidir**: kullanılan dağıtım runtime'ında dönüştürme ispatlanır veya güvenli, gerektiğinde yüklenen dönüştürücü eklenir. Uzantı kabul edilip sonradan sessiz hata verilmez.
3. Kırpma dairesel maske içinde gösterilir. Sürükleme yanında Yakınlaştır/Azalt ve Ortala kontrolleri bulunur. İki parmak hareketi tek yöntem olmaz. İstemcinin kırpma koordinatları sunucuda sınırlandırılır.
4. Sunucu görseli yeniden kodlar, yön bilgisini uygular, EXIF/konum metadata'sını kaldırır. İlk hedef 256×256 ana avatar ve 64×64 küçük sürüm; küçük sürüm için yaklaşık 20 KB, ana için yaklaşık 100 KB bütçe. Gerçek kalite ölçümüyle kesinleştirilir.
5. Eski fotoğraf yeni nesne yüklenip profil referansı başarıyla değişmeden silinmez. DB ile Storage'ın tek transaction olmadığı dikkate alınır: başarısızlıkta yeni nesne temizliği, geciken temizlik için tekrar çalıştırılabilir bakım işi gerekir.
6. Her yükleme farklı sürümlü yoldur; eski cache yeni fotoğrafı gizlemez. Sahipli yol kontrolü DB/Storage seviyesinde yapılır; dışarıdan rastgele avatar URL'si kabul edilmez.
7. Avatarlar public bucket'a açılmaz. Oturum kontrollü görsel yolu veya kısa ömürlü imzalı adres kullanılır; özel cache ve imza yenileme davranışı test edilir. Hesap/rol bilgisi fotoğraf URL'sine yazılmaz.

Mevcut `sharp` altyapısı yeniden kullanılır. Supabase Storage erişim sınırı yalnız arayüzde gizleme ile değil RLS ile uygulanır. [Supabase Storage erişim kontrolü](https://supabase.com/docs/guides/storage/security/access-control)

## 7. Geri bildirim ürünü

### Kullanıcı akışı

Formda tek zorunlu içerik “Geri bildirimin”. Başlangıç türü Genel; kullanıcı isterse Hata / Öneri / Diğer seçer. Ayrı zorunlu konu, öncelik, ekip, proje veya puan istenmez. Metin sınırı başlangıçta 4.000 karakterdir.

İsteğe bağlı en fazla üç ekran görüntüsü, her biri en fazla 10 MB. PDF/doküman arşivi ilk kapsamda yoktur. Ekte küçük önizleme, kaldırma, ilerleme ve yeniden deneme bulunur. Gönderimden önce hangi eklerin gideceği bellidir.

İlgili bölüm isteğe bağlı seçilir. Kullanıcı “Bu ekranla ilgili” seçtiğinde yalnız izinli bölüm/route şablonu alınır; tam URL, sorgu parametreleri, görev metinleri, e-posta veya sayfanın ekran görüntüsü kendiliğinden toplanmaz. Uygulama sürümü ve genel cihaz sınıfı gibi teknik bağlam alınacaksa formda gösterilir; işaret edilmeden geniş teşhis kaydı toplanmaz.

Gönder sonrası sunucu kayıt kimliği ve “Geri bildirimin yönetime iletildi” sonucu gösterilir. Bu ifade kaydın yönetim listesine yazıldığı anlamına gelir; bir yöneticinin okuduğu iddia edilmez. İstemci UUID tekrar anahtarıyla çift dokunma ve kaybolan ağ yanıtı aynı kaydı ikinci kez üretmez.

Ekli gönderide iki aşamalı akış: özel taslak kaydı → sahipli görsel yüklemeleri → tek kesinleştirme. Yönetim yalnız kesinleşmiş gönderiyi görür; bildirim bir kez üretilir. Bir ek başarısızsa “Yeniden dene” veya açıkça “Bu eki kaldırıp gönder” seçilir; ek sessizce düşürülmez. Yarım taslak/nesne temizliği için 24 saatlik başlangıç bakım politikası test edilir.

Gönderdiğim geri bildirimler: en yeni üstte, tarih, tür, kısa metin ve ek işareti; 20 kayıt/sayfa. Ayrıntıda gönderilen metnin tamamı ve ekler bulunur. Yönetici notu, okuma bilgisi veya iç arşivleme kullanıcıya durum takibi olarak sunulmaz. Gönderilmiş içerik bu sürümde düzenlenmez; yeni geri bildirim gönderilebilir. Kullanıcıların birbirlerinin gönderilerini görebildiği genel yorum panosu yoktur.

### Yönetim → Geri Bildirimler

- Yönetim menüsünde bağımsız “Geri Bildirimler” girişi; yeni kayıt sayacı. Mevcut Yönetici yetki kontrolü kullanılır, Müdür'e otomatik erişim açılmaz.
- Masaüstünde okunabilir tablo: yeni işareti, gönderen, tür, metin özeti, ilgili bölüm, tarih, ek sayısı.
- Mobilde aynı kayıtlar kart/listedir: gönderen ve tarih üstte; 2–3 satır özet; tür ve ek göstergesi. Yatay tablo zorunluluğu yoktur.
- Türkçe arama ve tür/gönderen/tarih/okunmamış/arşiv süzgeçleri sunucuda uygulanır. İlk sayfa 25 kayıt; fazladan yükleme/sayfalama sınırı bellidir.
- Ayrıntı masaüstünde sağ panel olarak açılabilir; mobilde tam sayfa. Doğrudan URL vardır; geri dönüş liste süzgecini korur.
- İç yönetim eylemleri yalnız “Okundu işaretle”, “Okunmadı işaretle”, “Arşivle”, “Arşivden çıkar”. Bunlar destek iş akışı değildir. Arşiv kullanıcıdaki gönderi geçmişini silmez.
- Ortak yönetim kuyruğu kullanılır: okundu durumu ve okuyan/yapan yönetici kaydedilir; her yönetici için ayrı iş takip sistemi kurulmaz. Zildeki kişisel okunma ile kuyruğun ortak okunma durumu farklıdır ve birbirini gizlice değiştirmez.
- Gönderi metni yönetici tarafından değiştirilmez. Yanıtlama, e-posta gönderme, AI analizi ve otomatik görev üretimi bu sürümde yoktur.
- Uygulama içi global bildirim yalnız Yönetici profillerine gider. Başlık içerik dökmez; “Yeni geri bildirim” ve yetkili yönetim bağlantısı yeterlidir. Mevcut e-posta dağıtıcısının yan etkileri incelenir; bu olay için otomatik e-posta gönderimi açılmaz.

## 8. Veri ve güvenlik tasarımı

Kesin migration DDL'i canlı şema kontrolünden sonra yazılır. Şimdiki öneri:

| Yapı | Amaç / erişim |
| --- | --- |
| `profiles` sınırlı genişletme | Avatar referansı/sürümü; mevcut ad/rol/unvan. Geniş okuma politikasına özel iletişim verisi eklenmez. |
| `profile_private_details` | Kullanıcı başına tek kayıt; telefon/özel not. Sahip + Yönetici okur, kullanıcı kendi izinli alanını düzenler. |
| `app_feedback` | Gönderen, tür, içerik, bölüm, taslak/gönderilme zamanları, ortak yönetim okundu/arşiv alanları, sürüm/tekrar kimliği. |
| `app_feedback_attachments` | Sahipli taslağa/gönderiye bağlı nesne yolu, gerçek tür/boyut; kullanıcı ve Yönetici kayıt yetkisiyle okur. |
| `app_feedback_events` | Oluşturma ve yönetim eylemlerinin değiştirilemez aktör/zaman izi; kullanıcıya yönetim olay defteri açılmaz. |
| Ayrı private bucket'lar | Avatar ve geri bildirim görsellerinin farklı yaşam döngüsü/erişim sınırları. |

Profil öz-servis sözleşmesi ad, fotoğraf ve özel detay alanlarını açıkça izinli listeyle kabul eder. İstekten kullanıcı kimliği/rol/unvan/e-posta/created_at atanamaz; aktör doğrulanmış oturumdan gelir. Mevcut rol guard'ı ve yönetici güncelleme yolu korunur; gerekli alan koruması DB'de de uygulanır. Eşzamanlı kullanıcı/yönetici düzenlemesi sürümle çakışma verir ve taslak korunur.

Geri bildirimin göndereni sunucu belirler. Kullanıcı yönetim alanlarını yazamaz, başka kullanıcının taslağını/ekini okuyamaz veya gönderemez. Yetki detay URL'sinde, sunucu action'ında, RPC'de, aramada, listede ve Storage'da aynı şekilde uygulanır. Kullanıcıdan bildirim alıcısı listesi alınmaz.

Yeni kayıt ve kesinleştirme için DB tabanlı makul hız/kota sınırı uygulanır; yalnız tarayıcıdaki disabled düğmesine güvenilmez. Başlangıç önerisi kullanıcı başına saatte 10 kesinleşmiş gönderi; pilotta gerçek kullanım ölçülerek ayarlanır. Tekrar anahtarı aynı içerikte aynı sonucu verir; değiştirilmiş içerikte çakışma döner.

Auth kullanıcısı ile uygulama profili ayrı kaynaklardır; özellikle e-posta değişikliği sıradan profil UPDATE'ine bağlanmaz. [Supabase kullanıcı verisi modeli](https://supabase.com/docs/guides/auth/managing-user-data)

Grokbot görev scope'ları profil özel bilgilerine veya geri bildirimlere erişim sağlamaz. Yeni harici geri bildirim API'si bu planın gereği değildir. Kayıtlar kalıcı silinmeden arşivlenir; uzun vadeli saklama/hesap silme politikası mevcut kurumsal yönetimle birlikte kararlaştırılır, rastgele otomatik içerik silme eklenmez.

## 9. Mobil kalite programı — mevcut Panel dahil

### 9.1 — Mevcut ürünün mobil envanteri

Panel'de Görevlerim/Ekip/Panolar/Gelen/Menü, liste/pano, hızlı oluşturma, tarih/kişi seçiciler, tüm detay alanları, yorum/bahsetme, ek yükleme, hedef bağı, arşiv ve geri alma ayrı akış satırlarıyla kaydedilir. Her satırda cihaz, tema, giriş biçimi, adımlar, beklenen/gerçek sonuç ve kanıt bulunur.

Uygulama genelinde üst şerit, hamburger, Yönetim gezinmesi, iş hub'ı ve birer uzun liste/uzun form/rapor editörü örneği taranır. İşler, Mühendislik, Teknik Resimler, Satın Alma ve erişilebilir rolün diğer modüllerinde avatar eklenmesinden kaynaklanan regresyon aranır. Bu, tüm modülleri yeniden tasarlama işi değildir; bulunan kritik mobil erişim sorunları düzeltme listesine alınır.

### 9.2 — Yerleşim ve tek elle kullanım

- 320px dar stres testi; 360, 390/393, 430px telefon; 768/820px tablet; 1280/1440px masaüstü. Kesin cihaz CSS genişlikleri test raporuna yazılır.
- Dikey/yatay yön; kısa ekran yüksekliği; adres çubuğu açık/kapalı; standalone/PWA; çentik ve alt güvenli alan.
- Gövde yatay kaymaz. Teknik çizim/PDF gibi iki boyutlu belgeler yalnız kendi açıkça belirtilen önizleme alanında kayabilir. Büyük yazıda sıradan form/listeler yeniden akar. [W3C Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html)
- Gerçek dokunma alanları ölçülür. Sadece `pointer:coarse` veya CSS sınıfının varlığı yeterli kanıt değildir; üst üste binen görünmez hedefler, alttaki satırı örten Yeni görev düğmesi ve kesilen popover'lar aranır.
- Panel süzgeçleri dar ekranda “Filtrele” düğmesiyle kısa alt sayfada toplanır; seçili filtre sayısı ve temizleme görünür. Gün seçimi ve temel liste/pano erişimi hızlı kalır. Bu değişiklik prototipte mevcut düzenle görev süresi üzerinden karşılaştırılır.
- Hızlı ekleme başlık + gönder ile çalışır. Atama ve tarih için tüm detay sayfasını açmak gerekmez. Dokunma alternatifleri varken sürükleme zorunlu tutulmaz.
- Alt gezinme, toast, sabit kaydet ve klavye için ortak katman/örtüşme kuralları hazırlanır. Birden fazla tam ekran katman üst üste açılmaz.

### 9.3 — Sanal klavye, taslak ve ağ dayanıklılığı

`dvh` kullanımı tek başına klavye çözümü kabul edilmez; sanal klavye davranışı tarayıcıya göre ayrıca sınanır. `VisualViewport` veya ek ölçüm yalnız gözlenen probleme gerekiyorsa eklenir; yaygın bir global resize hack'i kurulmaz. [web.dev viewport açıklaması](https://web.dev/blog/viewport-units)

Başlık/yorum/profil/geri bildirim alanında klavye açıkken aktif satır ve gönder/kaydet erişilebilir kalır. Kullanıcının odak konumu zorla değiştirilmez. Mobil metin alanları en az 16px; büyütme devre dışı bırakılmaz. Çok satırlı yazı, Türkçe klavye, otomatik düzeltme, tarih seçici, galeriye gidip geri gelme ve yön değişimi test edilir.

Gönderim sürerken ikinci dokunma, 500 yanıtı, 3–10 saniye gecikme, yanıtın kaybolması, oturumun dolması ve ağın tamamen kesilmesi ayrı testlerdir. Kaydedilmediği halde başarı gösterilmez. Aynı istek yeniden denendiğinde kayıt çoğalmaz. Güncelleme çakışmasında güncel metin ve kullanıcının taslağı karşılaştırılabilir.

Mevcut Panel taslakları hata sonrası komponent belleğinde korunuyor. Ek fazda aynı sekmede sayfadan çıkma/geri gelme davranışı netleştirilir: kaydedilmemiş formda uyarı, uygun küçük metin taslakları için kullanıcıya bağlı session saklama, gönderim/çıkışta temizlik. Fotoğraf baytları, parolalar ve özel sayfa içerikleri genel localStorage'a dökülmez. Mobil işletim sisteminin sekmeyi öldürmesine karşı tam çevrimdışı senkronizasyon taahhüt edilmez; kalan sınır açıkça test raporuna yazılır.

### 9.4 — Erişilebilirlik ve görsel kalite

Açık, koyu ve sistem teması; uzun Türkçe isimler; fotoğrafsız/kırık avatar; çok uzun geri bildirim; %200 metin büyütme; klavye/Tab/Escape; VoiceOver ve TalkBack kontrol edilir. Normal metinde 4,5:1, büyük metin ve ilgili grafik/denetimlerde 3:1 kontrast hedeflenir. Renk tek bilgi taşıyıcısı olmaz.

Modal açılış/kapanış odağı, hata alanına erişim, yükleme/başarı mesajlarının ekran okuyucu duyurusu ve yapışkan öğelerin odaklanan alanı kapatmaması doğrulanır. Kırpma hareketinin düğme alternatifi vardır. Erişilebilirlik otomasyonu manuel ekran okuyucu testinin yerine geçmez. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### 9.5 — Performans

Üretim derlemesiyle ölçüm yapılır; development modu ölçüm kabulü değildir. Test cihazı, tarayıcı sürümü, CPU/ağ profili, soğuk/sıcak cache ve örnek sayısı kaydedilir. Mobil öncelikli akışlarda LCP ≤2,5s, CLS ≤0,1 ve yeterli saha verisinde p75 INP ≤200ms hedeflenir. Bu değerler henüz ölçülmüş sonuç değildir; laboratuvar etkileşim süreleri saha INP'si diye adlandırılmaz. [web.dev INP](https://web.dev/articles/inp)

Fotoğraf kırpma/dönüştürme kodu profil açılışında değil fotoğraf düzenleyici açıldığında yüklenir. Üst şerit yalnız küçük avatarı çeker; listedeki kullanıcı fotoğrafları gereksiz tekrar istek üretmez. Geri bildirim listesi eklerin tam dosyasını indirmez. Sunucu araması ve sayfalama kullanılır; sürekli polling/tüm veriyi çekme eklenmez.

10.000 görev ve 10.000 geri bildirim gibi sentetik yük verisi ayrı test ortamında veya rollback transaction'ında kullanılır; üretime sahte kullanıcı gönderisi eklenmez. İlk sayfa sorguları ve yeni avatarın mevcut Panel açılışına getirdiği ilave süre/bayt ayrı ölçülür. Önceki 417ms tek ölçüm yalnız karşılaştırma başlangıcıdır.

## 10. Fazlar ve kontrol kapıları

Kontrol kapıları teknik/ürün doğrulamasıdır; her kapı tekrar kullanıcı izni isteme aşaması değildir. Başarısız koşul çözülmeden sonraki faza “geçti” yazılmaz. Fiziksel cihaz yoksa o kontrol açık kalır; emülasyonla tamamlandı sayılmaz.

| Faz | İş / çıktı | Bağımlılık | Çıkış koşulu |
| --- | --- | --- | --- |
| F0 — Başlangıç doğrulaması | Canlı profil şeması, RLS, Auth ayarları, görsel runtime'ı; mevcut Panel mobil envanteri | Bu plan | Kaynak haritası ve mevcut mobil açıklar kanıtlı; veri değişmedi |
| M1 — Mevcut Panel mobil denetimi | 9. bölümdeki tüm Panel akışları; kritik bulgu listesi | F0 | Gözlenen sorun ile test edilmemiş varsayım ayrıldı |
| F1 — Ortak UX prototipi | Avatar/Profilim/fotoğraf/geri bildirim/yönetim mobil ve geniş ekran önizlemeleri | M1 | Gerçek bileşenler; fikstür olduğu açık; küçük ekranda incelenebilir |
| K1 — Akış kontrolü | Tek elle erişim, adım sayıları, 320/360/390px, uzun metin, üst bar | F1 | Avatar hedefi çakışmıyor; temel eylemler bulunabilir; ana gövde taşmıyor |
| F2 — Profil veri/yetki temeli | İzinli alanlar, özel bilgiler, avatar Storage, migration provası | K1 | Kullanıcı rol/unvan/başka profil verisini taklit edemiyor; yönetici yolu çalışıyor |
| K2 — Profil güvenlik kontrolü | Doğrudan authenticated DB/Storage, sahte form alanı, cache ve ad değişikliği regresyonu | F2 | Yetki matrisi ve mevcut belgelerin korunması doğrulandı |
| F3 — Profil ve avatar | Üst şerit/sol menü, kişisel sayfa, güvenli görsel ve tercih/parola akışları | K2 | Düzenleme ve fotoğraf işlemleri uçtan uca çalışıyor; hata taslağı koruyor |
| M2 — Fotoğraf/klavye kontrolü | iOS/Android galeri, HEIC, kırpma, yön, klavye; Panel formlarıyla ortak katmanlar | F3 | Desteklenen mobil fotoğraf yolu çalışıyor; kaydet/gönder kapanmıyor |
| F4 — Kullanıcı geri bildirimi | Taslak/ek/kesinleştirme, tekrar güvenliği, kendi liste/detayı | M2 | Gönderi bir kez kaydoluyor; başka kullanıcı gönderisi/eki görünmüyor |
| F5 — Yönetim geri bildirimleri | Menü, responsive liste, süzgeç/detay, okundu/arşiv, uygulama içi bildirim | F4 | Yönetici tüm gönderileri, kullanıcı yalnız kendi gönderilerini görüyor |
| K3 — Geri bildirim bütünlüğü | Çok yönetici, yetki kaybı, başarısız ek, çift gönderim, yeni kayıt ve sayaç | F5 | Eksik ek sessizce kaybolmuyor; bildirim/oluşturma tekrarlanmıyor; e-posta yan etkisi yok |
| M3 — Mobil düzeltme fazı | M1–M2 ve yeni ekran bulgularını kapatma; ekip ekranları dahil filtre/katman/geri dönüş iyileştirmeleri | K3 ve 006/KE3 | Eski Panel ve yeni ekranlarda kritik/yüksek mobil hata kalmadı |
| M4 — Erişilebilirlik/performance | Temalar, büyütme, VoiceOver/TalkBack, üretim derlemesi ve ağ/CPU ölçümü | M3 | Ölçümlü rapor; başarısız hedef için düzeltme ve yeniden ölçüm |
| K4 — Genel regresyon | Üst şerit etkilenen tüm modüller, rol matrisi, eski görevler, giriş/çıkış, iş hub'ı | M4 | Mevcut yetkiler ve iş akışları korunuyor; ilgili test/type/lint/build geçiyor |
| F6 — Fiziksel cihaz pilotu | En az bir küçük iPhone, bir Android, bir tablet; gerçek günlük senaryolar | K4 | İşletim sistemi/tarayıcı/sürüm ve sonuçlar kayıtlı; akışı durduran sorun yok |
| K5 — Yayın kabulü | Son ekranlar, migration/geri dönüş kaydı, kullanıcı rehberi, açık kalanlar | F6 | Zorunlu kabul maddeleri tamam; dağıtım ve geri dönüş somut |
| F7 — Kontrollü yayın | Şema önce, doğrulama, arayüz dağıtımı, kısa izleme | K5 | Eski avatarı olmayan kullanıcı çalışıyor; gönderiler korunuyor; kritik hata yok |

Fazların gerçekleşme durumu 007'de kayıtlıdır. Kodları hazır olan sonraki fazlar, önceki fiziksel cihaz veya sunucu kurulum kapısının geçtiği anlamına gelmez. Takvim uğruna cihaz kontrolleri kaldırılmaz.

## 11. Zorunlu kabul senaryoları

| No | Senaryo | Başarı ölçütü |
| --- | --- | --- |
| A01 | Küçük ekranda zil ile avatar yan yana | Her ikisi ayrı 44px hedef; yanlış komşu tıklaması yok |
| A02 | Avatar → Profilim → geri | Bir dokunuşla profil; önceki ekran/süzgeç korunur |
| A03 | Fotoğraf yok veya yüklenemiyor | Sabit ölçüde baş harf/kişi simgesi; kayma/kırık görsel yok |
| A04 | Telefondan portre/yan fotoğraf ve HEIC | Doğru yön, anlaşılır kırpma, desteklenen dönüşüm; sessiz hata yok |
| A05 | Fotoğraf yükleme başarısız | Eski avatar korunur; yeni seçim yeniden denenebilir |
| A06 | Ad/telefon değiştir; başka cihazda aç | Doğru alan kalıcı; özel telefon genel profil/context yanıtına sızmaz |
| A07 | İstekle role/title/user_id taklit et | Sunucu ve DB reddeder; mevcut yönetici değişimi korunur |
| A08 | Klavye açıkken uzun görev/yorum/geri bildirim | Aktif alan ve kaydet/gönder erişilebilir; gövde yatay kaymaz |
| A09 | Hızlı görev oluştur/tamamla/geri al | Önceki Panel akışları yeni kabukla aynı veya daha az işlemle çalışır |
| A10 | Ekip görevi ata/tarih değiştir/iş kodu ara | Tek elle seçiciler kullanılır; görevin kişisel/ekip sınırı değişmez |
| A11 | Geri bildirimi yalnız metinle gönder | Kayıt kimliği oluşur; kendi listesinde ve yönetimde aynı içerik görünür |
| A12 | Çift dokun, yanıtı kaybet, yeniden gönder | Tek kesinleşmiş kayıt, tek olay/bildirim; metin kaybolmaz |
| A13 | Üç ekten biri başarısız | Yeniden dene veya açıkça eki kaldır; eksik gönderi sessizce tamamlanmaz |
| A14 | Kullanıcı başka geri bildirim UUID'sini/ek yolunu ister | Okuma/yazma reddedilir; yönetici kapsamı ayrı doğrulanır |
| A15 | Yönetici telefonda gönderi arayıp açar | Kaydırmalı geniş tablo gerekmez; geri dönüş filtreyi korur |
| A16 | Yönetici arşivler | Yönetim arşivine geçer; kullanıcının gönderi geçmişi kaybolmaz |
| A17 | Açık/koyu tema, %200 metin, ekran okuyucu | Anlam, odak ve eylemler korunur; kırpma/ikon işlevleri erişilebilir |
| A18 | Ana ekrana eklenmiş uygulama, yön değişimi | Üst/alt güvenli alanlar ve geri bağlantısı işler; içerik kapanmaz |
| A19 | Oturum dolar/çıkış ve başka kullanıcı girişi | Önceki kullanıcının özel taslağı/bildirimi/iletişim bilgisi görünmez |
| A20 | Avatar/görseller yavaş ağda yüklenir | Panel kullanılabilir kalır; ölçümde belirlenen performans bütçesi sağlanır |

Her senaryonun raporu: sürüm/commit, cihaz/OS/tarayıcı, tema, ağ/CPU, adımlar, beklenen/gerçek sonuç, ekran kaydı veya görüntü, hata kimliği ve yeniden test sonucu. Hassas gerçek içerik kanıtlara taşınmaz; açıkça işaretli test fikstürü kullanılır.

## 12. Dosya alanları ve uygulama sırası

Mevcut alanlar: `src/components/app-shell.tsx`, `src/lib/profile.ts`, `(app)/layout.tsx`, `src/lib/roles.ts`, `components/notification-bell.tsx`, `(app)/admin/admin-nav.tsx`, `(app)/panel/task-workspace.tsx` ve CSS, `src/app/manifest.ts`. Yeni alanlar: `(app)/profile/**`, `(app)/admin/feedback/**`, `src/lib/account/**`, `src/lib/feedback/**`, ortak kullanıcı avatarı ve görsel sunucu modülü.

Önizlemeler: `/dev/account-preview` ve `/dev/feedback-preview`; mevcut `/dev/panel-preview` regresyonu. `/dev/user-profile-preview` yönetici analiz ekranına aittir, yeni Profilim ile karıştırılmaz. Önizlemeler gerçek sunum bileşenlerini kullanır; uydurma üretim kaydı oluşturmaz.

Saf şema/kurallar React veya DB'den ayrılır; server action/RPC ve görsel işleme ayrı kalır. Profil ile geri bildirim için tek dev bileşen yazılmaz. Uygun mevcut Radix/shadcn parçaları kullanılır; yeni tasarım kütüphanesi veya ayrı backend kurulmaz.

Migration öncesi benzersiz damga ve canlı şema kontrolü, test ortamında prova, erişim matrisi ve geri dönüş kaydı gerekir. Önce nullable/uyumlu alanlar ve tablolar eklenir; eski kullanıcılar avatar olmadan çalışır. Yeni arayüz doğrulama sonrası dağıtılır. Geri dönüş önce arayüz sürümüdür; yeni gönderi ve fotoğraf referansları silinmez. Storage temizliği yalnız referans dışı nesnelere uygulanır.

Teslim çıktıları: çalışan özellikler, mevcut Panel mobil düzeltmeleri, gerçek cihaz raporu, erişim/test/performance kanıtları, yeni ekranların Türkçe kullanıcı rehberi ve güncellenmiş `docs/agent/panel.md`, `roller.md`, `arayuz.md`. Grokbot bağlantısı ve AI entegrasyonu ayrı sorumluluk olarak kalır.

## 13. Kapsam dışında tutulanlar

Sosyal profil, herkese açık geri bildirim duvarı, kullanıcılar arası mesaj, destek bileti/yanıt sistemi, otomatik görev üretme, AI yorum analizi, puan/yıldız anketi, avatar zorunluluğu, gelişmiş personel dosyası, tam çevrimdışı senkronizasyon ve native mobil uygulama bu ilk ek teslimin gereği değildir.

Mobil taramanın açacağı kritik kusurlar uygulanacak düzeltmelerdir. Yeni büyük işlev fikirleri mobil kaliteyi geciktirmemesi için ayrı backlog'da tutulur. Bu planın kabulü “ekranlar güzel görünüyor” ile değil, yukarıdaki günlük kullanım ve güvenlik senaryolarının kanıtlı başarısıyla yapılır.
