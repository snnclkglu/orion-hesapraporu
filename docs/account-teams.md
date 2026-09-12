# Profil, geri bildirim ve ekip yönetimi

## Kullanım

Zilin yanındaki yuvarlak simge Profilim'i açar. Fotoğraf ve geri bildirim kısayolları üsttedir. Ad soyad, telefon ve özel not ayrı kaydedilir; unvan, giriş e-postası, uygulama rolü ve ekip üyelikleri buradan değiştirilemez. Telefon/not yalnız sahibi ve Yönetici tarafından okunur. Fotoğraf isteğe bağlıdır; olmadığında baş harfler görünür.

JPEG, PNG, WebP ve HEIC fotoğraflar önce sunucuda yönü düzeltilip metadata kaldırılarak hazırlanır, sonra dairesel kırpma gösterilir. Yakınlaştırma ve yatay/dikey kaydırıcılar klavyeyle de çalışır. Sınır 10 MB/40 megapikseldir; son avatarlar 256 ve 64 piksel WebP'dir. HEIC çözücü yalnız sunucuda gerektiğinde yüklenir. Yeni kayıt tamamlanmadan eski fotoğraf referansı kaldırılmaz.

Profilim → Geri bildirim ile metin ve isteğe bağlı üç görsel gönderilir. Gönderilerim yalnız kişinin kendi kesinleşmiş kayıtlarını listeler. Yönetim → Geri Bildirimler ortak kuyruktur; metin/gönderen araması, tür, tarih, okunmamış ve arşiv filtreleri bulunur. Okundu/arşiv bilgisi iç yönetim bilgisidir; kullanıcıya destek bileti durumu olarak sunulmaz. Gönderi metni sonradan değiştirilmez. Yalnız uygulama içi bildirim oluşur; e-posta kuyruğuna yazılmaz.

Yönetim → Ekipler ad/açıklama, aramalı çoklu üye seçimi, ekip içi yetki, sahiplik devri ve arşivlemeyi sağlar. Kullanıcılar satırındaki Ekipler bağlantısı aynı üyelik komutlarını kullanır. Ekip adı uygulama yetkisi vermez; kişi birden fazla ekipte olabilir. Admin'in Türkçe adı Yönetici'dir; Müdür ayrı roldür ve tüm ekipleri görme yetkisi kazanmaz.

Panel'de seçilen ekip içinde hızlı eklenen görev Genel panosuna gider. Sorumlu yoksa ekip havuzunda kalır; üyeye atanırsa aynı kayıt Görevlerim'de de görünür. Üye çıkarılırken açık görevler devredilir veya atamasız bırakılır. Sahip çıkarılmadan önce sahiplik devredilir. Ekip arşivi geçmişi korur, yazmaları engeller.

## Görünürlük ve API

| Kapsam | Okuyabilenler |
| --- | --- |
| `private` / Bana özel | Yalnız oluşturan |
| `team` / Ekip | Ekip üyeleri ve Yönetici; yazma ekip düzeyine bağlı |
| `direct` / Kişiye özel | Oluşturan ve güncel sorumlu; diğer yöneticiler dahil hiç kimse |
| `job` / Eski iş görevi | Önceki iş modülünün oturumlu kullanıcı kapsamı |

`direct` görevde sorumlu zorunlu, pano/hedef boş, tür görev veya nottur. Yeniden atamayı gönderen yapar. Ekip dışından kişi ekip görevine atanamaz. İş kodu görünürlüğü değiştirmez. Ekip görevi özel kapsama çevrilmez; ayrı özel görev açılabilir. Ekibe taşıma, yorum ve dosyaların paylaşılacağını açıkça gösterir.

Mevcut Agent API `visibility: "direct"` kabul eder. `GET /api/agent/tasks?view=mine&sent=true` gönderilen özel görevleri; `view=team&unassigned=true` atamasız havuzunu süzer. Context yanıtında üyelikler de bulunur. Aynı erişim, sürüm ve tekrar anahtarı denetimleri geçerlidir. Ekip yönetimi Agent görev yazma kapsamına dahil değildir. Grokbot bağlantısı kurulmadı. [OpenAPI](task-api.openapi.json)

## Sunucu ve bakım

Görsel yükleme, mevcut Supabase projesine kurulan `account-media` fonksiyonuna kullanıcının oturumuyla gider. Yerel uygulamaya geniş yetkili proje anahtarı almak gerekmez. Fonksiyon gerçek oturumu, kişinin dosya yolunu, taslak durumunu, oran sınırını ve metadata içermeyen statik WebP boyutlarını denetler; yalnız yeni nesne ekler. Supabase'in dahili Storage yazma anahtarı Supabase çalışma ortamında kalır. Avatar hazırlığı ve HEIC çözümü mevcut uygulama sunucusunda yapılır; ayrı sunucu kurulmaz. [Supabase fonksiyon ortamı](https://supabase.com/docs/guides/functions/secrets)

Toplu bakım görsel yüklemeden ayrı işletim yetkisidir. Yerel geniş anahtarlı eski bakım yolu kapatıldı. Yeni `account-maintenance` çalışanı Supabase içinde, yalnız kendi dar zamanlayıcı anahtarıyla çalışacak şekilde hazırlandı. 25 saatlik sınır, en fazla 500 nesne, tek çalışma kiralaması ve her gruptan önce referans kontrolü uygulanır. Profil fotoğrafının iki boyutu da yeni yüklenmiş olmalıdır; eski küçük boyut tekrar bağlanamaz. Kesinleşmiş gönderiler ve aktif avatarlar korunur. Veritabanı koruması uygulandı; Edge kurulumu ve zamanlama ayrı onay bekliyor. İşletim/durdurma adımları: `docs/account-maintenance.md`.

Görseller private bucket'larda tutulur. Okuma rotaları her istekte oturum ve kayıt yetkisini denetler, özel `no-store` yanıtı verir. Görev dosyalarının mevcut kısa süreli imzalı erişimi ayrı kalır. Daha önce indirilmiş dosya geri alınamaz.

Vercel'in 4,5 MB istek sınırı nedeniyle 3,5 MB üzerindeki profil/geri bildirim görselleri cihazda en fazla 1800px'e küçültülür. Tarayıcının açamadığı büyük HEIC için aynı paketin tarayıcı çözümleyicisi yalnız gerektiğinde yüklenir. Kaynak seçimi 10 MB / 40 megapiksel sınırındadır; sunucu küçültülen görseli yeniden doğrular ve metadata olmadan kodlar. Yeni sunucu, bucket veya genel yazma izni gerekmez. [Vercel istek sınırı](https://vercel.com/docs/functions/limitations#request-body-size)

## Doğrulama ve geri dönüş

- `scripts/task-db.py test`: migration, eski görev ve `account-db-tests.sql` authenticated rol senaryolarını tek transaction'da sınar; sonunda geri alır.
- `src/lib/account/*.test.ts`: alan sınırları, sahte görsel, EXIF/yön, ölçü ve HEIC. Gerçek HEIC testi `artifacts/account-mobile/example.heic` varsa çalışır; yoksa açıkça atlanır. [Örnek kaynağı](https://github.com/strukturag/libheif/blob/master/examples/example.heic)
- `scripts/account-mobile-check.cjs`: yedi genişlikte dört önizlemenin açık/koyu tema kontrolü; görüntü ve taşma raporu.
- `scripts/account-interaction-check.cjs`: mobil profil, kırpma, kişi seçimi, geri bildirim ve özel görev akışları; önizleme verisi kaydedilmez.

20260912000006–000009 geçişleri kullanıcı/görev kimliklerini korur. `direct` yazımı başladıktan sonra bu kapsamı bilmeyen eski arayüze körlemesine dönülmez. Gerekirse yeni yazım kapatılarak uyumlu sürüm dağıtılır; görev, gönderi veya dosya referansı silinmez. Fiziksel iOS/Android, VoiceOver/TalkBack ve saha performansı otomasyon görüntüleriyle tamamlandı sayılmaz.
