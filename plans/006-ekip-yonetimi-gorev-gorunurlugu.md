# Ekip yönetimi ve görev görünürlüğü ek planı

Tarih: 12 Eylül 2026. Durum: ekip yönetimi, üyelik ve görev kapsamları uygulandı; veri/yetki ve otomatik mobil kontroller geçti. Fiziksel cihaz ve yayın kabulü açık. [007 — Uygulama ve kontrol kaydı](007-profil-ekip-uygulama-kontrol.md) güncel kanıtları içerir. [004 — Panel](004-panel-gorev-yonetimi.md) altyapısını kullanır ve [005 — Profilim, geri bildirim ve mobil kalite](005-profil-geri-bildirim-mobil-kalite.md) teslimine bağlanır.

## 1. Kaynak incelemesi: mevcut olan ve eklenecek olan

Bu tablo başlangıç kaynak/migration incelemesini korur. Uygulama sırasında canlı şema, rollback yetki testleri ve tarayıcı kontrolleri de yapıldı; sonuçlar 007'de kayıtlıdır.

| Alan | Mevcut durum | Ek iş |
| --- | --- | --- |
| Ekip oluşturma | Panel'de Ekip yönetimi penceresi; `team.create` | Yönetim'de ayrı, aranabilir Ekipler sayfası; oluşturma yetkisinin merkezileştirilmesi |
| Üyelik | `task_teams`, `task_team_members`; kişi birden fazla ekibe katılabilir | Kullanıcılar sayfasıyla ortak üyelik düzenleyici; ad/e-posta/rol ile arama |
| Üye seçimi | Ekip yönetiminde basit Üye ekle listesi | Mobil çoklu seçim, arama, seçili kişi özeti, sunucu sayfalaması |
| Görev atama | Hızlı atamada Kişi ara mevcut; sorumlu boş olabilir | Mevcut seçiciyi ekip üyeliğine göre süzme; görünürlük açıklaması |
| Ekip bağlantısı | Görev → pano → ekip; tek görev kaydı | Kullanıcıya önce ekip seçtirme; pano seçimini zorunlu bürokrasi olmaktan çıkarma |
| Ekip + kişi | Ekip görevi sorumlunun kişisel listesinde de bulunabilir | Aynı kimlik, durum, yorum ve eklerin iki görünümde tutarlı kabulü |
| Bana özel | `private` yalnız oluşturana açık; başkasına atanamaz | Kuralı koruma; başka kişiye ekipten gizli atama için ayrı kapsam |
| Yönetim menüsü | Kullanıcılar ve Yetkiler var; Ekipler yok | Kullanıcılar → Yetkiler → Ekipler sırasıyla yeni giriş |
| Tüm ekipleri görme | Uygulama `admin` rolü ekip erişim kontrolünde mevcut | Yönetim ekranında tüm ekipleri ve görev detaylarını kullanışlı sunma |

Kaynaklar: `src/lib/roles.ts`, `src/app/(app)/admin/layout.tsx`, `admin/admin-nav.tsx`, `admin/users/user-row.tsx`, `panel/task-workspace.tsx`, `src/lib/tasks/{model,service}.ts`, `supabase/migrations/20260912000001_task_workspace.sql` ve `20260912000004_task_integrity.sql`.

## 2. Roller ve üyelikler

**Uygulamada Admin ile Yönetici aynı roldür:** `admin` ekranda “Yönetici” görünür. `manager` ise “Müdür”dür ve mevcut Yönetim bölümüne erişemez. Bu plan Yönetici/Admin'i mevcut tek rol olarak kullanır. Müdür'e kendiliğinden tüm ekipleri görme veya Yönetim'e girme yetkisi eklemez; böyle bir genişleme istenirse ayrıca yetki matrisine işlenir. Yeni uygulama rolü açılmaz.

Uygulama rolü ile ekip üyeliği farklıdır. “Satın Alma Ekibi”ne katılmak uygulamanın satın alma yetkisini vermez; “Yönetim Ekibi” adı da Yönetici rolü vermez. Rol değişikliği kişiyi otomatik ekipten çıkarmaz veya başka ekibe taşımaz. Mevcut sekiz rol kişi aramasında filtre olarak kullanılabilir; ekip üyeliği açık seçimle kaydedilir.

| İşlem | Yönetici / Admin | Diğer kullanıcı |
| --- | --- | --- |
| Ekip listesi ve detayları | Aktif/arşiv tüm ekipler | Yalnız üyesi olduğu ekipler |
| Ekip oluşturma, ad/açıklama, üyelik, sorumlu devri, arşiv | Yönetim üzerinden | Varsayılan olarak kapalı |
| Ekip görevi okuma | Tüm ekipler | Üyesi olduğu ekipler |
| Ekip görevi düzenleme | Tüm ekipler | Mevcut ekip içi yazma yetkisi varsa |
| Başkasının Bana özel görevi | Görmez | Görmez |
| Kişiye özel atama | Gönderense veya sorumluysa | Gönderense veya sorumluysa |

Mevcut ekip üyelik düzeyleri yeniden kullanılır: görüntüleme, düzenleme ve ekip sorumluluğu. Ekip sorumluluğu uygulamanın Müdür rolü değildir; arayüzde açıkça “Ekip sorumlusu” yazılır. Bu planda ekip yapısını değiştirmek Yönetici yetkisidir; ekip sorumlusu görevleri koordine eder. Mevcut sahibin veya ekip sorumlusunun üye düzenleyebildiği davranıştan bu modele geçiş **bilinçli bir yetki değişikliğidir**: yalnız düğmeler gizlenmez, RPC ve DB denetimleri de uyarlanır. Eski ekipler, sahipleri ve üyelik kayıtları korunur; geçiş raporunda değişen yetkiler belirtilir.

## 3. Ekranlar ve hızlı kullanım

### Yönetim → Ekipler

- `/admin/teams`: ekip adı arama; aktif/arşiv süzgeci; ekip adı, kısa açıklama, üye sayısı, açık/atamasız/gecikmiş görev sayıları. Masaüstünde kompakt liste, telefonda kartlar.
- `/admin/teams/new`: yalnız ekip adı zorunlu; açıklama ve üyeler isteğe bağlı. Yönetim Ekibi, Satın Alma Ekibi ve Mühendislik Ekibi kullanıcı örnekleridir; üretime otomatik eklenmez.
- `/admin/teams/[id]`: Görevler, Üyeler ve Ayarlar. Görev detayında mevcut Panel bileşeni kullanılır; ikinci görev düzenleyici yapılmaz. Panolar aynı ekip altında listelenir.
- Üye ekle: ad/e-posta araması, uygulama rolü filtresi, çoklu seçim, “Zaten üye” bilgisi, seçilen sayısı ve tek kaydet. Mevcut üyeler tekrar eklenmez. İsim benzerliğinde fotoğraf/baş harf ve e-posta ayırt etmeyi sağlar; özel telefon veya personel bilgileri gösterilmez.
- Türkçe arama mevcut katlama yardımcısını kullanır. Sorgular sayfalanır, eski arama yanıtı yeni sonucu ezmez. Tüm kullanıcı dizini veya ekip görevleri ilk açılışta indirilmez.

### Yönetim → Kullanıcılar

Kullanıcı satırı/detayında “Ekipler” özeti ve “Ekipleri düzenle” eylemi bulunur. Aynı ortak seçici ve aynı üyelik komutu kullanılır; iki sayfada ayrı kayıt veya ayrı yetki mantığı tutulmaz. Kullanıcı formundaki rol seçimi korunur. Üyelik kaydı başarısızken rol değişimi de başarısızmış gibi gösterilmez; işlemlerin kaydetme sınırları açık olur.

Profilim'de kişinin ekipleri bilgi olarak görünür. Kullanıcı kendi rolünü veya üyeliklerini profil üzerinden değiştiremez. Yetkili yönetici yönetim bağlantısıyla düzenleme ekranına geçer.

### Panel → Ekipler

Mevcut mobil alt navigasyonun ekip girişi kullanılır; yeni alt sekmelerle bar kalabalıklaştırılmaz. Kullanıcı kendi ekiplerini, Yönetici tüm ekipleri seçebilir. Ekip seçimi ardından açık görevler; “Atanmamış”, “Bana atanan”, durum, termin ve iş kodu süzgeçleri gelir. Ekip adı ve iş kodu farklı bilgiler olarak görünür. Yönetici için ekip ayarına bağlantı vardır; standart kullanıcı için yönetim eylemi gösterilmez.

Ekip içinde hızlı ekle o ekibi hazır seçer; başlıkla kaydetmek mümkündür. Mevcut pano ilişkisini korumak için ekibin tek bir varsayılan “Genel” panosu bulunur. Yeni ekipte atomik oluşturulur; mevcut ekiplere geçişte açıkça belirlenir, eşzamanlı talepler ikinci varsayılan pano açamaz. İsteyen pano değiştirir. Bir görev ilk teslimde tek ekibe ve en fazla bir sorumluya bağlıdır; çok ekipli ortak görev, çoklu sorumlu ve hiyerarşik alt ekipler eklenmez.

## 4. Görev kapsamı: kimin ekranında görünür?

| Kullanıcı seçimi | Ekip | Sorumlu | Görünen yer ve kişiler |
| --- | --- | --- | --- |
| Bana özel | Yok | Kendisi veya boş | Yalnız oluşturanın kişisel alanı |
| Ekibe | Seçili | Boş | Ekibin görev havuzu; ekip üyeleri ve Yönetici |
| Ekibe ve kişiye | Seçili | Ekip üyesi | Aynı görev hem ekipte hem sorumlunun Görevlerim listesinde; ekip üyeleri ve Yönetici okuyabilir |
| Kişiye özel ata | Yok | Seçili kişi | Oluşturan ve sorumlu; ekip listelerinde görünmez, diğer Yönetici kullanıcılar da okuyamaz |

“Kişiye özel ata” bu talep için önerilen **yeni** kapsamdır; mevcut `private` davranışı değildir. Arayüzde kaydetmeden önce “Yalnız siz ve seçtiğiniz kişi görebilir” açıklaması bulunur. Oluşturan gönderdiği kayıtları kişisel alanda “Gönderdiklerim” süzgeciyle takip eder; sorumlu kendi görevlerinde görür. İlk kapsamta iki katılımcı da durum, açıklama, yorum ve eklerde çalışabilir; yeniden atama veya paylaşım kapsamını değiştirme yalnız oluşturandadır. Ekip görevinin sorumlusunu değiştirmek ekip yazma yetkisi gerektirir.

Ekip dışı bir kişiyi ekip görevine atamak reddedilir; atama kişiyi sessizce üye yapmaz. Yönetici üyeyi ayrı, açık işlemle ekleyebilir. “Görev bana atandı” bilgisi tek başına başka bir ekibi görme hakkı sağlamaz.

Kapsamın özelden ekibe açılması bütün mevcut yorum ve eklerin de paylaşılacağı anlamına gelir; kullanıcıya bu somut sonuç gösterilir. Bir ekip görevini özel hale getirmek geçmiş erişimi geri alamaz; ilk teslimde bu dönüşüm desteklenmez, ayrı özel görev açılabilir. Ekipler arası taşıma yetki kontrolü ve paylaşılacak geçmiş özetiyle yapılır. Hedef/alt görev ilişkileri kapsamlar arası gizli başlık sızdıramaz; uyumsuz ilişkide işlem açık hatayla durur.

0065 gibi iş kodu bağımsız ilişkidir; kod seçimi görevi ekibe ya da bütün şirkete açmaz. Aynı kaydın kimliği, yorumları, geçmişi, dosyaları ve tamamlanma durumu tüm yetkili görünümlerde ortaktır. Görünümler için görev kopyası oluşturulmaz.

## 5. Üyelik değişikliği, arşiv ve mevcut veriler

- Üye çıkarılırken açık görevleri sayılır; Yönetici “Ekibin atamasız havuzuna bırak” veya “Başka üyeye aktar” seçer. Üyelik ve açık görev atamaları tek işlemde değişir. Tamamlanmış görevlerin geçmiş sorumlusu korunabilir; eski sorumluya okuma hakkı sağlamaz.
- Ekip sahibi çıkarılacaksa önce sahiplik devredilir. Mevcut `owner_id` erişim istisnası dikkate alınır; üyelik satırını silmek sahibin erişimini kesmiş sayılmaz. Ekip sorumlusuz bırakılmadan devir yapılır.
- Yeni boş ekipte oluşturan Yönetici başlangıç sahibidir; diğer ekip üyelerini kendi adına seçmez. Kullanıcılar birden çok ekibe katılabilir; ekibe aynı kişi iki kez kaydolamaz.
- Üyelik kaldırılınca arama, görev detayı, yorum, ek, olay, bildirim ve API erişimi sonraki istekte yeniden değerlendirilir. Önceden indirilmiş dosya geri alınamaz; mevcut imzalı dosya bağlantısının kısa geçerlilik sınırı test raporunda belirtilir. İstemci önbelleği değişimi yansıtır, yetkisiz geçmiş içerik tekrar sunulmaz.
- Kişiye özel görev yeniden atandığında eski sorumlu erişimini kaybeder; oluşturan erişimi korur. Eski bildirim bağlantısı içerik sızdırmaz. Bildirim önizlemeleri de bu sınıra uyar.
- Arşivlenen ekip geçmişiyle korunur. Yeni görev/üyelik/görev değişikliği kapatılır; geri açma ve sahiplik gibi kurtarma işlemleri Yöneticiye açıktır. Açık görev sayısı arşiv öncesi gösterilir. İlk teslimde kalıcı ekip silme yoktur.
- Eski `visibility='job'` görevleri mevcut iş modülü uyumluluğu nedeniyle oturum açan kullanıcılara geniş görünür. Bunlar ekip göreviymiş gibi raporlanmaz. Yeni ekip/özel görevler bu kapsama otomatik dönüştürülmez. Eski iş görevlerinin topluca ekiplere taşınması ayrı, somut eşleştirme incelemesidir; iş kodundan veya personel rolünden üyelik tahmin edilmez. Görev kimlikleri ve eski kişisel kayıtlar korunur.

## 6. Veri, yetki ve gelecekteki API kullanımı

Mevcut Supabase/Auth/RLS, görev komutları ve tablolar kullanılır. Ekip açıklaması/arşiv durumu, varsayılan pano ilişkisi ve gerekiyorsa değişiklik sürümü eklenir. Yeni ekip/personel dizini kurulmaz. Ekip oluşturma, ad değişikliği, üye ekleme/çıkarma, devir ve arşiv için aktör, zaman ve izinli değişen alanları kaydeden olay geçmişi tutulur; sonradan değiştirilemez.

Kişiye özel atama için mevcut `private` kapsamını genişletmek yerine ayrı `direct` kapsamı önerilir. Uygulama öncesi E0'da mevcut constraint/trigger/RPC/snapshot bağımlılıkları çıkarılır. Okuma, yazma ve yeniden paylaşma izinleri ayrı doğrulanır. Liste sayıları, arama, bildirim, yorum, geçmiş, Storage ve iş hub'ı aynı erişim kuralını izler. Ekip seçilmeden `direct` içine ekip panosu veya başka kapsamdan hedef enjekte etmek reddedilir.

Grokbot bağlantısı kullanıcıya aittir. Bu iş yalnız altyapı sözleşmesini günceller: yetkili ekipleri/panoları ve atanabilir kişileri çözümleme, görünürlük açıkça seçerek görev oluşturma/güncelleme, geçersiz ekip-kişi eşleşmesinde anlaşılır hata, tekrar güvenliği ve sürüm çakışması. İş kodu erişim anahtarı değildir. Mevcut API erişim kapsamları ve kullanıcı adına çalıştırma sınırı korunur; ekip yönetimi uçları görev yazma iznine otomatik dahil edilmez. Yönetim API'sine ihtiyaç yoksa yeni bir dış yönetim uç noktası açılmaz. `direct` yeni değerinin istemci uyumluluğu test edilir, OpenAPI ve kullanım belgesi güncellenir. Gerçek anahtar veya bağlantı oluşturulmaz.

## 7. Ek fazlar ve kontrol kapıları

005'in profil/geri bildirim fazları korunur. E0, 005/F0 ile birlikte ele alınır; E1 önizlemeleri 005/F1–K1 kontrolüne dahil edilir. Ekip uygulama ve güvenlik fazları 005/M3'ten önce tamamlanır; bütün yeni akışlar ortak M4, K4, fiziksel cihaz F6 ve yayın kabulüne girer. Bunlar kontrol aşamalarıdır; her fazda tekrar kullanıcı onayı isteme süreci değildir.

| Faz | Çalışma | Bağımlılık | Çıkış koşulu |
| --- | --- | --- | --- |
| E0 — Mevcut ekip ve yetki envanteri | Canlı şema ile kaynak uyumu; eski sahip/üyelik ve job kapsamı; yeni alan bağımlılıkları | 005/F0 | Mevcut/yeni davranış ayrıldı; veri korunacak geçiş listesi hazır |
| E1 — Ekip UX tasarımı | Yönetim listesi/detayı, Kullanıcılar seçicisi, Panel kapsam seçimi; gerçek bileşenlerle önizleme | E0 | 360/390px ve masaüstünde görev ve üyelik akışları incelenebilir |
| KE1 — Anlaşılabilirlik kontrolü | Rol/ekip farkı, dört görev kapsamı, uzun isimler, seçili ekip, atamasız havuz | E1, 005/K1 | Kullanıcı kaydetmeden kimlerin göreceğini anlayabilir; zorunlu alan artışı yok |
| E2 — Veri ve erişim | Yönetim yetkisi, direkt görev kapsamı, varsayılan pano, üyelik/devir/arşiv komutları | KE1 | Migration provası, eski kimlikler ve erişim sınırları korunuyor |
| KE2 — Yetki ve bütünlük kontrolü | Doğrudan RPC/DB/Storage, kapsam sahteciliği, eşzamanlı üyelik/atama | E2 | Yetkisiz okuma/yazma ve yarım aktarım yok; eski private/job ayrımı doğru |
| E3 — Yönetim ve Kullanıcılar | Ekipler ekranları, ortak arama/çoklu seçim, profil üyelik özeti | KE2 | İki yönetim girişinde aynı üyelik ve yetki kaynağı çalışıyor |
| E4 — Görev ve API akışları | Ekip/kişi/özel atama, gönderdiklerim, mevcut hızlı seçiciler, API belge ve testleri | E3 | Tek görev iki görünümde tutarlı; eski API ve iş hub'ı akışları geçiyor |
| ME1 — Mobil ekip denetimi | Arama klavyesi, uzun kişi listesi, geri dönüş, yavaş ağ, çoklu seçim | E4 | 44px hedef/16px girdi; 320px stres dahil taşma ve örtülen kaydet yok |
| KE3 — Ekip kabulü | Aşağıdaki senaryolar; olay/bildirim/önbellek; dokümanlar | ME1 | Kritik/yüksek bulgu kalmadı; 005/M3 ve genel regresyona hazır |

Mobilde ekip ayrıntısı tam sayfa, kişi seçimi klavyeyle çalışabilen alt panel veya tam ekran seçicidir. Seçilen kişiler arama değişince kaybolmaz. Kaydet alanı klavye ve güvenli alanın altında kalmaz. Görevden geri dönünce ekip, süzgeç ve liste konumu korunur. Dokunarak tüm eylemler yapılabilir; hover veya sürükleme gerektirmez. Arama sonucu, seçili kişi sayısı ve hata ekran okuyucuya bildirilir.

## 8. Zorunlu kabul senaryoları

| No | Senaryo | Beklenen |
| --- | --- | --- |
| E-A01 | Yönetici ekip oluşturur, aynı isteği tekrarlar | Tek ekip ve tek varsayılan pano |
| E-A02 | Ad/e-posta/rol aramasıyla çoklu üye seçer | Türkçe arama doğru; seçilenler korunur, mükerrer üyelik olmaz |
| E-A03 | Kullanıcılar'dan üyelik değiştirir, Ekipler'i açar | Aynı sonuç; uygulama rolü değişmez |
| E-A04 | İki ekip üyesi olmayan kullanıcı detay adresini/API'yi dener | İlgisiz ekip ve içerik/sayılar görünmez |
| E-A05 | Yönetici tüm ekipleri, ayrı Müdür kullanıcısı kendi ekiplerini açar | Mevcut uygulama rol ayrımı korunur |
| E-A06 | Ekibe sorumlusuz görev açar, sonra üyeye atar | Havuzdan kişisel listede görünmeye geçer; aynı kimlik ve geçmiş |
| E-A07 | Kişisel listede ekip görevini tamamlar | Ekipte de tamamlanır; geri alma iki yerde tutarlı |
| E-A08 | Başka ekipten kişiye atama isteği gönderir | Sunucu reddeder; otomatik üyelik oluşmaz |
| E-A09 | Kendine özel ve kişiye özel görevleri farklı kullanıcılar sorgular | Yalnız kapsamın katılımcıları okur; Yöneticiye örtük özel erişim yok |
| E-A10 | Kişiye özel görev açar/yeniden atar | Gönderen ve güncel sorumlu görür; eski sorumlu bildirim/ek üzerinden erişemez |
| E-A11 | İş kodu ekler, özel görevi iş hub'ından arar | Kod paylaşımı değiştirmez; yetkisiz başlık/yorum sızmaz |
| E-A12 | Açık işi olan üyeyi çıkarır, sahibi devreder | Atamalar ve üyelik atomik; sahip erişimi yanlışlıkla kalmaz |
| E-A13 | Üye çıkarma ile aynı anda görev atama/güncelleme | Son durumda geçersiz açık atama veya yetkisiz yazma yok |
| E-A14 | Ekip arşivler/geri açar | Geçmiş korunur; arşivde yazma engeli, geri açmada tutarlılık |
| E-A15 | Özel görevi ekip ile paylaşır | Tüm yorum/eklerin paylaşılacağı açık; ilişkili hedeflerin izinleri geçerli |
| E-A16 | Mobilde uzun isim, %200 metin, klavye, koyu/açık tema | Hedefler erişilebilir; taşma, kapanan eylem veya kaybolan seçim yok |
| E-A17 | Yanıt kaybı/çift dokunma ve çakışan yönetici işlemi | Tek işlem; anlaşılır çakışma; seçim/taslak korunur |
| E-A18 | Eski görevler ve mevcut API istemcisi | Kimlikler, geçmiş, private/job sınırı ve mevcut akışlar korunur |

005'in fiziksel iOS/Android/tablet kontrollerine özellikle kişi seçimi, ekip değiştirme, atamasız görevi üstlenme ve direkt görev gönderme eklenir. Emülasyon fiziksel cihaz kabulünün yerine yazılmaz. Sentetik ekip/kullanıcı/görevler yalnız izole test veya geri alınan işlemde kullanılır.

## 9. Teslim ve geçiş

Yeni arayüzden önce uyumlu şema ve izinler test ortamında doğrulanır. Canlı geçişte kullanıcı/ekip/görev kimlikleri korunur; mevcut ekip yapılandırma yetkisi değişimi belgelenir. Yeni `direct` görev yazımı devreye girdikten sonra eski sürüme dönüşün bu kayıtları güvenle okuyabilmesi ayrıca sınanır; yalnız ön yüzü geri almak otomatik güvenli kabul edilmez. Gerekirse yeni yazım kapatılır ve veriyi koruyan uyumluluk düzeltmesi uygulanır; kayıtlar silinmez.

Teslim: çalışan ekranlar, üyelik/görev erişim matrisi, migration ve geri dönüş kaydı, mobil test kanıtları, API sözleşmesi, Türkçe kullanıcı rehberi; `docs/agent/panel.md`, `roller.md`, `arayuz.md` ve görev API belgeleri güncellenir. Yayına hazır sayılmak için 005'in genel ve fiziksel cihaz kabulü de tamamlanmalıdır.
