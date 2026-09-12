# Profil, geri bildirim, ekipler — uygulama ve kontrol kaydı

12 Eylül 2026. Yerel uygulama geliştirmesi yapıldı; dört yeni migration bağlı Supabase veritabanına uygulandı. Arayüz üretime dağıtılmadı. Bu kayıt bir toplu “tüm fazlar geçti” beyanı değildir: yapılandırma ve gerçek cihaz kapıları aşağıda açıkça ayrılmıştır.

## Uygulanan davranışlar

- Bildirim yanındaki 28px yuvarlak avatarın dokunma alanı 44px; üst şeritte denetimler için ayrı 44px alanlar. Sol kullanıcı kartı ve Panel alt Menü → Profilim bağlantısı.
- Profilim: ad soyad, özel telefon/not, fotoğraf, ekip özeti, tema, mevcut parola doğrulamalı parola değişimi, çıkış ve üstte geri bildirim kısayolları. Rol/unvan/e-posta/üyelik öz-serviste değiştirilemez.
- JPEG/PNG/WebP/HEIC işleme, yön düzeltme, metadata temizleme, 10 MB/40 MP sınırı, hareket/zoom ile kırpma, 256/64px WebP avatarlar. HEIC gerçek dosya ile sınandı. Canlı yükleme için eksik sunucu anahtarı halen gerekiyor.
- Geri bildirim: metin ve isteğe bağlı üç görsel; özel taslak → ekler → kesinleştirme. Kullanıcı kendi gönderilerini, Yönetim tüm kesinleşmiş gönderileri görür. Okundu/arşiv yöneticiye özeldir; uygulama içi bildirim oluşur, e-posta gönderilmez.
- Gönderim başlamadan önce geri bildirim metni kullanıcıya bağlı sessionStorage taslağıdır. Aynı sekmede geri getirilebilir; gönderim başlangıcında ve çıkışta temizlenir. Dosya/parola/özel profil alanları saklanmaz. Kesinleşmesi belirsiz gönderi yeni kimlikle otomatik tekrar oluşturulmaz.
- Profil ve geri bildirimde sayfa kapatma ve aynı sekmedeki bağlantılara basma uyarısı vardır. Tarayıcının geri tuşu/işletim sisteminin sekmeyi öldürmesi her durumda engellenmez; form belleği tam çevrimdışı senkronizasyon değildir.
- Yönetim → Ekipler: arama, aktif/arşiv liste, oluşturma, açıklama, ad/e-posta/rol araması, sayfalı çoklu üye seçimi, ekip düzeyi, devir ve arşiv. Kullanıcılar → Ekipler aynı üyelik komutunu kullanır.
- Kapsamlar: Bana özel, Kişiye özel, Ekip ve mevcut iş görevleri. Ekip görevi kişiye atanırsa tek kayıt iki listede görünür; atamasız ekip havuzu desteklenir. Kişiye özel görev yalnız gönderen/sorumluya açıktır. Üye çıkarılırken açık görevler devredilir veya atamasız bırakılır.
- Agent görev API'si yeni kapsam ve filtrelerle güncellendi; OpenAPI ve kullanım sözleşmesi yazıldı. Grokbot bağlantısı kurulmadı.

## 005 faz kaydı

| Faz | Gerçekleşme ve kontrol durumu |
| --- | --- |
| F0 | Kaynak, canlı şema, RLS ve görsel çalışma ortamı incelendi; eksik gizli sunucu anahtarı tespit edildi. |
| M1 | Panel telefon/tablet/masaüstü önizlemeleri ve seçili mobil akışlar denetlendi; tüm gerçek klavye/dosya senaryoları henüz sınanmadı. |
| F1 | Gerçek bileşenlerle profil, geri bildirim ve ekip önizlemeleri hazır; örnek veriler üretime yazılmıyor. |
| K1 | Yedi genişlik, açık/koyu tema; 56 taşma kontrolü geçti. Profil kısayolları yukarı alındı, üst şerit dokunma alanları ayrıldı. |
| F2 | Profil özel alanları, avatar ve geri bildirim tabloları/erişim kuralları uygulandı. |
| K2 | Authenticated DB rol/alan/özel kayıt/sürüm senaryoları geçti. Gerçek Storage yükleme çevrimi sunucu anahtarı nedeniyle açık. |
| F3 | Profil ve avatar kodları tamam; metin alanları çalışıyor. Canlı görsel yükleme ve kaldırma kabulü yapılandırmaya bağlı. |
| M2 | Görsel normalleştirme ve gerçek HEIC testi geçti; kırpma önizleme akışı geçti. Gerçek iOS/Android galeri ve sanal klavye açık. |
| F4 | Kullanıcı formu/liste/detay ve tekrar güvenli gönderim hazır. Ekli gönderimin canlı uçtan uca kabulü açık. |
| F5 | Yönetim listesi, filtreler, detay, okundu/arşiv ve zil sayacı uygulandı. |
| K3 | DB kesinleştirme, sürüm, erişim ve tekrar denetimleri geçti. Gerçek ağ kesintisi sırasında Storage/yükleme pilotu açık. |
| M3 | 44px/16px, dar kartlar, görünür seçimler, kapsam açıklamaları, alt menü ve taslak koruması uygulandı. Fiziksel klavye bulguları gelmeden tam kapanmaz. |
| M4 | Açık/koyu tema ve %200 kök metin boyutu genişlik kontrolü geçti; üretim derlemesi geçti. VoiceOver/TalkBack, ölçülmüş kontrast ve saha performansı açık. |
| K4 | Hedefli testler, lint ve derleme geçti. Genel testteki üç süre aşımı ilgili dosyaların seri tekrarında geçti. Tüm modüllerin fiziksel manuel kabulü açık. |
| F6 | Fiziksel iPhone/Android/tablet pilotu yapılmadı; cihaz/tarayıcı bilgisi kullanıcıdan istendi. |
| K5 | Rehber, geçiş/geri dönüş ve test kayıtları hazır. Görsel kurulum ve fiziksel kabul bitmeden yayın kapısı kapanmaz. |
| F7 | Dört şema geçişi uygulandı, 19 eski görev korundu. Arayüz yayını ve üretim izleme yapılmadı. |

## 006 faz kaydı

| Faz | Gerçekleşme ve kontrol durumu |
| --- | --- |
| E0 | Mevcut task_teams/task_team_members ve sekiz rol yeniden kullanıldı. Admin = Yönetici; manager = Müdür ayrımı korundu. |
| E1 | Liste/detay, kullanıcı üyelik ekranı, kişi seçici ve görev kapsamları uygulandı. |
| KE1 | Kapsam açıklamaları, ekip dışı atama denetimi, atamasız filtre ve aramada seçim koruması doğrulandı. |
| E2 | Varsayılan Genel pano, direct kapsam, üyelik/devir/arşiv sürüm ve işlem kilitleri uygulandı. |
| KE2 | Doğrudan DB/RPC yetki ve bütünlük testleri rollback ile geçti. Yönetim yetkisi yalnız UI düğmesine bağlı değil. |
| E3 | Yönetim/Ekipler, Kullanıcılar/Ekipler ve Profilim ekip özeti aynı kayıtları kullanıyor. |
| E4 | Özel atama, gönderdiklerim, atamasız havuz ve API sözleşmesi uygulandı; hedefli testler geçti. |
| ME1 | Yedi genişlikte ekip önizlemesi ve mobil arama/seçim akışı geçti. Fiziksel klavye, uzun gerçek dizin ve yavaş ağ pilotu açık. |
| KE3 | Otomatik kod/DB/önizleme kabulü geçti; tam ekip kabulü ortak fiziksel pilot ve yayın kapısına bağlı. |

## Kanıtlar

- `20260912000006_task_account_feedback.sql`–`20260912000009_task_account_maintenance.sql`: önce rollback prova, ardından canlı uygulama; son kontrolde job_tasks = 19 ve user_todos = 19.
- `scripts/task-db.py test`: eski görev ve yeni profil/geri bildirim/ekip erişim senaryoları transaction sonunda geri alındı. Gerçek kullanıcı profili veya örnek ekip oluşturularak UI testi yapılmadı.
- `artifacts/account-mobile/targeted-final.json`: 28/28 test, sıfır başarısız/atlanmış; gerçek HEIC dahil.
- Genel regresyon: 274 dosyada 270 geçti, 2 dosyada toplam 3 süre aşımı, 2 dosya atlandı; 4.001 test geçti, 10 atlandı. İlgili iki dosya aynı süre sınırıyla seri tekrarlandı: `regression-retry.json`, 47/47 geçti. Tüm paketin ikinci toplu koşusu yapılmadı.
- `build-final.log`: son üretim derlemesi ve TypeScript geçti. Son değişen hesap/ekip/görev alanlarının ESLint kontrolü sıfır hata/uyarıyla geçti.
- Doküman denetimi: 469 yol, 111 kural kapsamı, 1.719 atıf; hata yok, mevcut diğer belgelerde 14 uyarı.
- `report.json`: 320/360/390/430/768/820/1440px × dört önizleme × iki tema = 56; taşma ve sayfa hatası yok. Görüntüler aynı klasörde.
- `interaction-report.json`: profil kaydetme, fotoğraf seçme/kırpma, kişi aramada seçimi koruma, geri bildirim, özel görev oluşturma, gönderen listesi, %200 metin genişliği — yedi akış geçti. Bunlar önizleme kontrolüdür; canlı dosya yüklemesi veya OS erişilebilirlik sertifikası değildir.
- Oturumlu gerçek Profilim ve Yönetim/Ekipler sayfaları salt okunur açıldı; doğru kimlik/rol alanları ve mevcut boş ekip durumu görüntülendi.

## Kalan kapıları kapatma sırası

1. **12.09.2026 güncellemesi — anahtar bekleme kapısı kaldırıldı.** Kullanıcı `account-media` fonksiyonunun mevcut Supabase projesine kurulmasını açıkça onayladı. Fonksiyon ACTIVE v1 olarak kuruldu; uygulama görselleri kullanıcı oturumuyla buraya gönderir. Geniş proje anahtarı yerel ayara alınmadı. Önceki `reveal=true` talebi uygulanmadı ve artık beklenmiyor. Eski anahtar indirme yardımcı betiği kaldırıldı. Canlı geçit oturumsuz/geçersiz istekleri 401 ile reddetti; gerçek kullanıcı fotoğrafıyla uçtan uca kabul aşağıdaki ayrı kapıdır.
2. Kurulum sonrası kullanıcı tarafından seçilen gerçek fotoğrafla yükle/değiştir/kaldır; ekli geri bildirimi tek kez gönder, sahip/yönetici erişimini ve eksik yükleme tekrarını sınama. Sunucu testleri bu uçtan uca kontrolün yerine geçmez.
3. Bakım komutunu önce salt okunur aday kontrolünde sınama; referans dışı 25 saatlik nesne temizliğini dağıtım ortamının zamanlayıcısına bağlama. Canlı bakım çalıştırılmadı ve zamanlama bağlanmadı.
4. Küçük iPhone–Safari, Android–Chrome ve tablet ile gerçek klavye, galeri, yön değiştirme, ana ekrandan açma, VoiceOver/TalkBack; görev/profil/geri bildirim/ekip akışlarını cihaz ve sürüm bilgisiyle kaydetme.
5. Üretim benzeri ağ/CPU ve gerçek veriyle performans/erişilebilirlik ölçümü; bulgu varsa düzeltme ve aynı senaryonun tekrarı.
6. K5 kabulünden sonra uyumlu arayüz sürümünü yayınlama; erişim, gönderim ve eski kayıtları izleme. Otomatik schema silme veya yeni direct görevleri tanımayan eski sürüme kör geri dönüş yok.

[Kullanıcı ve işletim rehberi](../docs/account-teams.md) · [Görev API sözleşmesi](../docs/task-api.openapi.json)
