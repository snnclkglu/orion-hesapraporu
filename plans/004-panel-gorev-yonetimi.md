# Panel → ORION görev ve iş yönetimi

Ek plan: [005 — Profilim, geri bildirim ve mobil kalite](005-profil-geri-bildirim-mobil-kalite.md). Önceki Panel'in açık mobil kabul kontrolleri bu planın mevcut ürün denetimine dahildir; avatar ve geri bildirim geliştirmesi ayrıca fazlandırılır.

Tarih: 12 Eylül 2026. Durum: çekirdek ürün, mobil arayüz, veri geçişi ve görev API'si uygulandı. Üretim arayüz dağıtımı, gerçek cihaz ve kullanıcı pilotu henüz yapılmadı. Gerçekleşen kararlar ve kontrol kanıtları en sondaki **13. Uygulama kaydı** bölümündedir; önceki bölümler başlangıç tasarımının gerekçelerini korur.

Bu çalışma mevcut Panel'i mobil öncelikli bir görev yönetimi alanına dönüştürür. Asana'nın görev odaklı yaklaşımı referanstır; görsel kimlik ve iş bağlamı ORION'a aittir. Grokbot bağlantısı, e-posta okuma ve AI karar mekanizması kullanıcı tarafından yapılacaktır. Bizim kapsamımız görev ürünü, güvenli API, sözleşme, örnek istekler ve entegrasyon testleridir.

## 1. İncelemenin sonucu

| Mevcut yapı | Kaynak | Tasarıma etkisi |
| --- | --- | --- |
| Next.js 16.2.10, React 19, TypeScript, Tailwind v4, Radix/shadcn, Supabase | `package.json` | Yeni uygulama veya ayrı backend kurulmayacak. |
| Panel girişte doğrudan `/` adresinde açılıyor | `src/app/(app)/page.tsx`, `docs/agent/panel.md` | Kök giriş ve `LANDING_PATH` korunacak. `panel/` bileşen klasörü bugün ayrı `/panel` sayfası değil. |
| Panel parçalara ayrılmış ve bağımsız yükleniyor | `panel/panel-view.tsx`, `panel/loaders.tsx` | Veri ve görünüm ayrımı, bağımsız hata/yükleme sınırları korunacak. |
| İş görevleri: başlık, not, sorumlu, termin, tamamlanma | `20260817000002_job_tasks_comments.sql` | Mevcut veriler taşınacak; tek görev kaynağına geçilecek. |
| Kişisel yapılacaklar ayrı ve yalnız sahibine açık | `20260818000001_user_todos.sql` | Birleştirme kişisel kayıtları ekibe veya yöneticiye açmayacak. |
| Yorumlar işe bağlı; belirli bir göreve bağlı değil | `job_comments`, `jobs/hub-schema.ts` | Görev yorumları ayrı ilişkilendirilecek; geçmiş iş yorumları görevlere rastgele dağıtılmayacak. |
| Panel'deki iş görevi satırı kullanıcıyı işin görevler sekmesine götürüyor | `panel/sections/my-tasks.tsx` | Yeni detay doğrudan görevde açılacak; iş sayfasına gitmek isteğe bağlı olacak. |
| Sekiz uygulama rolü ve yetki fonksiyonları var | `src/lib/roles.ts`, `docs/agent/roller.md` | Rol sistemine paralel yeni bir rol hiyerarşisi kurulmayacak. |
| İncelenen kaynaklarda görev ekibi/üyelik modeli bulunamadı | `src`, `supabase/migrations` taraması | Küçük bir ekip ve üyelik modeli gerekli; canlı şema kontrolünde doğrulanacak. |
| Bildirimler, favoriler, olay izi ve e-posta bildirim altyapısı mevcut | ilgili migrations, `src/lib/jobs`, `src/lib/email` | Yeni bildirim merkezi mevcut defterle uyumlu genişletilecek. |
| Agent API zaten token, scope, profil kontrolü, idempotency ve audit içeriyor | `src/app/api/agent/_lib.ts`, `docs/agent-api.md` | Görev uçları aynı API kapısına eklenecek. |
| Agent isteklerinde service-role istemcisi kullanılıyor | `src/app/api/agent/_lib.ts` | Scope kontrolü tek başına yeterli değil; her kayıtta erişim ayrıca doğrulanacak. |
| Mevcut hız sınırı süreç belleğinde | `src/app/api/agent/_lib.ts` | Çoklu sunucu için kalıcı/ortak sınır gerekiyor. |
| Archivo, IBM Plex Mono, OKLCH, açık/koyu tema, 44px dokunma standardı var | `DESIGN.md`, `globals.css`, `docs/agent/arayuz.md` | Mevcut kimlik ve bileşenler kullanılacak; görev alanının hiyerarşisi yeniden tasarlanacak. |

İlk tespitler yerel kod ve migration kaynaklarına dayanıyordu. Uygulama sırasında canlı şema kontrol edildi: 0 iş görevi ve 19 kişisel kayıt bulundu; kişisel kayıtlar kimlikleri ve içerikleri korunarak ortak kaynağa taşındı. Görsel Asana incelemesi yayımlanan resmi ekran görüntülerine dayanır; oturum açılmış Asana hesabında etkileşim testi yapılmadı.

### Değişmesi gereken eski ürün kuralları

Eski belgelerdeki “Panel'den görev açılmaz”, “görev mutlaka işe bağlıdır”, “durum yalnız açık/kapalıdır” ve “arama sayfanın ana öğesidir” kararları bu yeni kullanıcı talebiyle güncellenecek. Bunlar yeni tasarımın önünde onay engeli değildir. Yeni kararlar `docs/agent/panel.md` ve `docs/agent/isler.md` içine işlenecek. Türkçe metin, veri gizliliği, dokunma alanı ve mevcut iş modüllerinin yetkileri korunacak.

## 2. Asana araştırması ve ORION'a uyarlama

12 Eylül 2026 tarihinde resmi yardım içerikleri ve web/mobil ekran görüntüleri incelendi. Kaynakların erişilebilir olması her görselin en son uygulama sürümünü temsil ettiği anlamına gelmez; özellikle eski forum görselleri güncel referans olarak kullanılmadı.

| Gözlem | ORION kararı |
| --- | --- |
| Web'de görev listesi ile sağdaki ayrıntı birlikte görülebiliyor. | Masaüstünde liste bağlamını koruyan detay paneli. |
| Mobilde ana hedeflere alttan erişiliyor; yeni görev eylemi el altında. | Beş hedefli sabit alt navigasyon ve ayrı “Yeni görev” düğmesi. |
| Tamamlama kontrolü doğrudan satırda bulunuyor. | Tek dokunuşla tamamla, kısa süreli geri al. |
| Başlık, sorumlu ve tarih taranabilir bir sırada sunuluyor. | Başlık birincil; iş kodu, tarih, kişi ve durum ikincil. |
| Aynı görev farklı görünümlerde kullanılabiliyor. | Liste/pano görünümü aynı kayıtları gösterir; görev çoğaltılmaz. |
| Detayda açıklama ve iletişim bir arada. | Açıklama, yorum, ek ve geçmiş tek görev detayında. |

Kaynaklar:

- [Asana web gezinme ve görev ayrıntısı](https://help.asana.com/s/article/navigating-asana)
- [Görev alanları ve tamamlama davranışı](https://help.asana.com/s/article/task-fields)
- [Mobil uygulama, görevlerim ve gelen kutusu](https://help.asana.com/s/article/getting-started-with-asana-s-mobile-app)
- [Android temel kullanım](https://help.asana.com/s/article/android-basics?language=en_US)
- [Görsel olarak incelenen resmi Android ekranı](https://assets.asana.biz/m/71845968041651e8/original/productui-helpcenter-mobile-androidbasics-001-en-us-jpeg.jpeg)
- [Görsel olarak incelenen resmi web liste ve ayrıntı ekranı](https://assets.asana.biz/transform/7bc6fd4f-aaf6-4f5f-b121-4adbb2dda1fc/productui-helpcenter-tasks-text-formatting-in-asana-008-en-us.png)

## 3. Ürün yapısı

### Görevlerim — varsayılan açılış

Panel doğrudan kişinin işine açılır. Üstte kısa başlık, arama ve yeni görev eylemi; altında Bugün, Yaklaşan, Tümü, Tamamlanan süzgeçleri bulunur. Bugün görünümü gecikenleri ayrı grupta, bugünkü işleri altında gösterir. Tarihsiz görevler Tümü içinde kaybolmadan erişilir. İlk kullanımda boş ekran açıklaması ve “İlk görevini oluştur” eylemi görünür.

“Görevlerim” bir görünümün adıdır; gizlilik türü değildir. Hem ekipten bana atanmış işleri hem bana özel görevleri gösterir. “Bana özel” kayıtlar kilit ve metinle belirtilir. Tarih veya kişi bilgisi boşsa uydurma değer yazılmaz.

### Ekip

Kişi/ekip seçimi, durum, termin, öncelik ve iş kodu süzgeçleri. Başlangıçta kişi bazlı liste; yanında açık, geciken ve bekleyen iş sayıları. Yönetici kendi görevlerinden çıkmadan ekip görünümüne geçer. Mühendisin işi, sorumlusu ve termini tek bakışta anlaşılır.

Görev sayısı performans puanı veya kapasite yüzdesi değildir. Süre tahmini toplamak zorunlu olmayacak. Üyelik bir kez yönetilir; her görevde ekip ve kişi bilgisini tekrar tekrar doldurmak gerekmez.

### Panolar

Kullanıcı “Görev listesi”, “Notlar” veya “Hedefler” türünde alan açabilir. Görünürlük açıkça “Bana özel” veya “Ekip” olarak seçilir. Paylaşılan alanda editör ve görüntüleyici ayrımı bulunur.

Görev alanlarında Liste ve Pano görünümleri vardır. Masaüstü panosu duruma göre sütunlanır. Mobilde varsayılan liste; Pano seçilirse durum seçiciyle tek sütun gösterilir. Telefonun ana ekranında yatay sürükleme zorunlu olmaz. İlk sürümde bir görev tek ana panoya aittir; Görevlerim, Ekip ve iş sayfası aynı görevi sorgulayarak gösterir.

Notlar başlık ve içerikle tutulur; zorunlu termin veya tamamlama kutusu taşımaz. “Göreve dönüştür” başlığı/açıklamayı ve kaynak bağlantısını korur. Hedefler başlık, açıklama, sorumlu, isteğe bağlı hedef tarihi ve bağlı görevler taşır. İlerleme bağlı görevlerin tamamlanma oranından hesaplanır; bağlı görev yoksa yüzde uydurulmaz. İç içe OKR hiyerarşisi kurulmaz.

### Gelen kutusu

Atamalar, bahsetmeler ve takip edilen görevlerdeki anlamlı değişiklikler. Okunmadı/Tümü süzgeci, okundu işaretleme ve göreve doğrudan erişim. Sistem geçmişi ile kişiye gönderilen bildirim ayrıdır. Kendi yaptığım sıradan değişiklikler bana yeni bildirim üretmez; aynı olaydan tekrar bildirim oluşmaz.

### Diğer bölümlere erişim

Masaüstünde ORION ana menüsü korunur; Panel'in içinde tek kompakt gezinme alanı olur. İki geniş sol menü yan yana eklenmez. Mobil alt navigasyon: **Görevlerim · Ekip · Panolar · Gelen · Menü**. Görünür ekran başlığı “Gelen kutusu”dur. Menü mevcut yetkili ORION bölümlerine ve hesaba açılır; arama üstte erişilebilir kalır.

Alt navigasyon yalnız Panel görev alanında çalışır; rapor editöründeki mevcut alt kumandayla çakışmaz. Yeni görev, sekme yerine çubuğun üstünde tek eylemdir. Klavye ve detay ekranında sabit öğeler yazı alanını örtmez; geri dönüşte liste konumu ve filtre korunur.

## 4. Hızlı etkileşim sözleşmesi

| İşlem | Tasarım | Ölçülebilir hedef |
| --- | --- | --- |
| Kişisel görev aç | Yeni görev → başlık → Ekle | Metin yazımı hariç 2 dokunuş; tek zorunlu alan başlık |
| Tamamla | Satırdaki tamamla kontrolü | 1 dokunuş; yeniden açma/geri alma mümkün |
| Tarih ver | Tarih çipi → Bugün/Yarın/Tarih seç | Hazır seçenek için 2 dokunuş |
| Kişiye ata | Kişi çipi → kişi seç | Liste görünürse 2 dokunuş; arama gerekiyorsa metin girişi eklenir |
| Öncelik/durum değiştir | İlgili çip → seçenek | 2 dokunuş |
| İş bağla | İş çipi → kod ara → seç | `0065` başındaki sıfırları korur; iş sayfasına yönlenmez |
| Yorum yaz | Detay → yorum → Gönder | Bir alanda yazım; ayrı form sayfası yok |
| Ek yükle | Ataç → sistem dosya/fotoğraf seçicisi | Yükleme ilerlemesi ve yeniden deneme görünür |

Yeni görevde seçili pano/iş bağlamı önceden doldurulur ve görünürdür. Kişisel görünümde varsayılan sorumlu kişinin kendisi; ekipte sorumlu seçilmemişse “Atanmamış”. Tarih ve öncelik zorunlu değildir. “Normal öncelik” sessizce uydurulmaz; başlangıç değeri “Öncelik yok”tur.

Görev detayında başlık, tamamlanma, sorumlu, termin, öncelik, durum, iş kodu ve paylaşım bilgisi üst bölümde; açıklama, ekler ve iletişim aşağıdadır. Masaüstü yan panel, mobil tam ekran kullanır. Yorumlar varsayılan akış; Geçmiş görünümünde kim/ne zaman/ne değiştirdi bilgisi bulunur. Başlık/açıklama düzenlemede kaydediliyor, kaydedildi ve başarısız durumları anlaşılır olur. Hata halinde yazılan metin korunur.

Paylaşım kapsamı değişikliği sıradan alan düzenlemesinden farklıdır: kişisel görevi ekip panosuna taşıyan kişi kimin göreceğini görür ve paylaşma eylemiyle tamamlar. İş kodu eklemek tek başına özel görevi paylaşmaz. Özel görevden kişiye atama önce açık bir paylaşım kapsamı gerektirir.

Durumlar: **Yapılacak, Devam ediyor, Beklemede, Tamamlandı**. Öncelikler: **Yok, Düşük, Orta, Yüksek, Acil**. Gecikme bir durum değildir; tarih ve tamamlanmadan türetilir. Böylece görev aynı anda Devam ediyor ve Gecikmiş olabilir. Yeniden açma önceki açık duruma döner; bilinmiyorsa Yapılacak olur.

## 5. Görsel ve mobil tasarım kuralları

- Sıcak nötr sayfa zemini, sakin yüzeyler, ince ayırıcılar ve ORION ana eylem rengi. Renkler mevcut tema tokenları üzerinden, açık/koyu temada birlikte tanımlanır.
- Yapılacak nötr, Devam ediyor mavi, Beklemede amber, Tamamlandı yeşil. Acil öncelik ve gecikme metin/ikonla ayrışır; yalnız kırmızı renk üzerinden anlam taşınmaz.
- Görev başlığı normal cümle düzeninde; müşteri/iş adı mevcut Türkçe büyük harf kuralıyla. İş kodunda mevcut mono yazı; görev metinlerinde mevcut sans yazı.
- Mobil görev başlığı yaklaşık 15–16px, ikincil bilgi 12–13px; giriş alanları en az 16px. Uzun başlık sarar, tüm satır tek satıra sıkıştırılmaz.
- Görev kartında en fazla iki bilgi satırı ve gerektiğinde kısa rozet grubu. Açıklama ve geçmiş listeye taşınmaz. Kart duvarı yerine iş listesi ağırlıklı hiyerarşi.
- Kullanıcı adı yoksa uydurma kişi/fotoğraf yok. Avatar varsa baş harf; tam isim erişilebilir etikette ve detayda.
- 44px dokunma hedefleri birbirinin alanına taşmaz. Tamamlama ve detay açma hedefleri ayrıdır. Klavye odağı görünür, ekran okuyucu etiketleri Türkçe.
- Telefon güvenli alt boşluğu, `dvh`, klavye açılması ve Android geri davranışı ele alınır. Detayı URL ile açmak, sayfayı yenilemek ve geri dönmek aynı kaydı korur.
- Sürükle-bırak masaüstünde kolaylık; durum menüsü ve klavye alternatifi zorunlu. Telefonda uzun basmak temel işlem olmayacak.
- Azaltılmış hareket tercihi korunur. Görsel geri bildirim hızlıdır; veri gerçekten kaydedilmeden kalıcı başarı iddiası olmaz. Hata halinde iyimser değişiklik geri alınır.
- Ağ yoksa kaydedilmediği açıkça belirtilir ve mevcut form metni korunur. İlk sürüm tam çevrimdışı senkronizasyon veya yerel veritabanı vaat etmez.

## 6. Veri ve yetki tasarımı

Önerilen hedef: tek `tasks` modeli ve tek sunucu iş servisi. `job_tasks` ile `user_todos` kalıcı olarak ayrı geliştirilmez. Yeni tabloya kontrollü geçiş tercih edilir; geniş mevcut RLS'nin kişisel kayıtlara taşınması engellenir.

| Varlık | Temel amaç |
| --- | --- |
| `tasks` | Başlık, açıklama, sorumlu, durum, öncelik, termin, iş, pano, görünürlük, sahip, tamamlanma, sürüm ve arşiv bilgisi |
| `task_teams`, `task_team_members` | Ekip, ekip üyeliği ve ekip yöneticisi ilişkisi |
| `task_boards`, `task_board_members` | Alan türü, kapsam ve editör/görüntüleyici üyelikleri |
| `task_comments` | Göreve ait yorum ve bahsetmeler; yazar ve düzenlenme izi |
| `task_attachments` | Göreve bağlı özel depolama nesnesi veya yetkili ORION belge bağlantısı |
| `task_events` | Eklemeli geçmiş; insan/ajan kimliği, olay, değişen alanlar, zaman, istek kimliği |
| `task_notes`, `task_goals`, `task_goal_links` | Not/hedef özelliklerini görev alanını gereksiz null alanlarla doldurmadan sağlamak |
| `task_external_refs` | Ajan kaynak referansı ve yinelenen e-postadan görev çoğalmasını önleyen benzersizlik |

Adlar uygulama fazında kesinleştirilecek; var olan eşdeğer tablo/servis doğrulanırsa yeniden kullanılacak. Ayrı mikroservis, genel amaçlı iş akışı motoru veya organizasyon ağacı kurulmayacak.

İş bağlantısı `jobs.id` ile gerçek kayda yapılır; ekrandaki kod `job_no` metninden gelir. `0065` sayıya çevrilmez. `projects` hesap raporu projeleridir; görev panosu bunlarla karıştırılmaz. Gerektiğinde mevcut proje/belgeye destekleyici bağlantı verilir. Kalem bağlamı mevcut `job_id + item_no` kuralını izler; yeniden üretilebilen `job_items.id` üzerine kalıcı görev bağı kurulmaz.

Termin ilk sürümde İstanbul gününe göre `date`; audit zamanları UTC anıdır. Tamamlanma durumu ve `done_at/done_by` aynı atomik işlemde değişir. Veritabanı kısıtı tutarsız “tamamlandı ama zaman yok” kayıtlarını engeller. Değişiklikler artan sürümle korunur; eski sürümle yazma 409 döner. Kimlik, sahiplik ve olay aktörü istemci gövdesinden güvenilerek alınmaz.

### Önerilen görünürlük ve yazma sınırı

| Kapsam | Okuma | Yazma |
| --- | --- | --- |
| Bana özel | Yalnız sahibi | Yalnız sahibi |
| Ekip panosu | Yetkili ekip/pano üyeleri; ilgili ekip yöneticisi; kurumsal görevler için Yönetici | Editör üyeler, ilgili ekip yöneticisi ve Yönetici |
| Görüntüleyici üyelik | İzin verilen paylaşılan kayıtlar | Görev düzenleme yok; yorum izni ayrı açık tanım |
| Eski iş görevi | Mevcut iş görünürlüğüyle uyumlu kurumsal kapsam | Mevcut iş görevi işbirliği yetkisi geçişte korunur |
| Ajan | Scope ∩ ajan profil yetkisi ∩ kayıt/pano/ekip kapsamı | Aynı kesişim ve eylem yetkisi |

Müdür rolü otomatik olarak bütün ekiplerin yöneticisi sayılmaz; ekip ilişkisi gerekir. Yönetici ekip mühendislerinin kurumsal görevlerini görebilir; çalışanın bana özel kaydını sırf rolü nedeniyle göremez. Eski kayıtların görünürlüğü sessizce daraltılmaz/genişletilmez. Yeni görevin kapsamı oluşturulduğu bağlama göre görünür biçimde seçilir.

RLS listede, detayda, yorumda, ekte ve aramada aynı kapsamı uygular. Agent service-role kullandığından paylaşılan sunucu servisi aynı yetkiyi açıkça doğrular. Bir görev UUID'sini bilmek erişim sağlamaz. Üyelikten çıkarılan kişiye bildirim içeriğinden veya önceden oluşmuş arama sonucundan bilgi sızmaz; eski bildirim metinlerinin erişim kaybı davranışı da tasarlanır.

## 7. Dosyalar ve iletişim

Dosyalar görev destekleyicisidir. İlk sürümde fotoğraf, PDF ve seçilmiş ofis dosyaları için boyut/tür sınırı belirlenir; örnek başlangıç hedefi 20 MB/dosya, gerçek altyapı sınırı kontrol edilerek kesinleştirilir. Sınırsız yükleme yoktur. Yeni doküman yönetim sistemi, klasör ağacı ve sürümleme kurulmaz.

Supabase private bucket, görev yetkisi kontrolü ve kısa ömürlü erişim bağlantıları kullanılır. Yükleme yetkisi yalnız ilgili görev ve nesne yolu içindir. Dosya adı temizlenir, tür/boyut sunucuda doğrulanır; HTML/SVG gibi aktif içerik uygulama içinde çalıştırılmaz. Mevcut ORION belgesi bağlandığında kaynak belgenin yetkisi ayrıca korunur.

Yükleme → doğrulama → görev ekini kesinleştirme akışı yarım kalmış nesneleri temizler. Silme mevcut belge silme/onay düzenine bağlanır; günlük görev düzenlemelerine bu bürokrasi taşınmaz. Görev ve pano için ilk tercih arşivle/geri yükle; kalıcı silme ayrı mevcut politika kapsamında kalır.

Yorum, geçmiş ve bildirim üretimi ortak servis üzerinden olur. Görev değişikliği ile olay kaydı atomik; bildirim dağıtımı tekrar güvenli olay/outbox hattı üzerinden. Eski geniş bildirim yazma politikasının güncel karşılığı kontrol edilerek yeni görev bildirimleri yetkili sunucu yoluyla sınırlandırılır. E-posta gönderme bağlantısı bu projenin teslim koşulu değildir.

## 8. Grokbot için API sözleşmesi

Mevcut `/api/agent` kapısının sürüm 1 sözleşmesi genişletildi. Aşağıdaki yollar yerel uygulamada mevcuttur; üretim URL'sinde kullanılmaları uygulama dağıtımına bağlıdır. Kesin sözleşme `docs/task-api.openapi.json` dosyasındadır.

| Uç | Kullanım |
| --- | --- |
| `GET /tasks` | Kişi, iş, pano, durum, termin, değişim zamanı ve cursor ile görev listele |
| `GET /tasks/{id}` | Yetkili görev ayrıntısı ve sürümü |
| `POST /tasks` | Görev oluştur |
| `PATCH /tasks/{id}` | İzin verilen alanları sürüm kontrolüyle güncelle; tamamla/yeniden aç |
| `GET /tasks/{id}/comments`, `POST /tasks/{id}/comments` | Yorum oku/ekle |
| `GET /tasks/{id}/events` | Geçmiş oku |
| `GET /tasks/context?q=0065` | Yetkili panolar/ekipler, kişi kimlikleri ve iş kodu araması; atama uygunluğu yazmada yeniden denetlenir |

Scope önerisi: `tasks:read`, `tasks:write`, `tasks:comment`, `tasks:context:read`. Dosya API'si daha sonra ayrı kapsamla açılabilir; ilk Grokbot gereksinimi için zorunlu değildir. Görev yetkisi e-posta, teklif, personel veya satış yetkisi vermez. Mevcut istemciler yeni scope'ları otomatik kazanmaz.

Entegrasyon sözleşmesinin zorunlu parçaları:

1. Her ajan ayrı kimlik/token ve sınırlı profil/kapsam kullanır. Token tarayıcıya veya loglara çıkmaz. İptal/rotasyon mevcut kayıt mekanizmasıyla belgelenir.
2. Görev yazma isteklerinde `Idempotency-Key` zorunludur. Aynı anahtar/gövde aynı yanıt; farklı gövde 409. Mevcut tekrar güvenliğinin işlem tamamlanıp yanıt kaybolduğu pencereyi kapsadığı doğrulanır; gerekirse mutation ve sonuç kaydı tek transaction'a alınır.
3. Kaynak tekilliği ayrıca korunur: ajan/sağlayıcı/hesap/mesaj/referans içindeki görev anahtarı. Tek e-postadan birden fazla görev oluşturmak desteklenir; mesaj kimliği tek başına bütün görevleri birleştirmez.
4. Güncellemede beklenen `version` veya `If-Match` zorunlu; insanın son değişikliği sessizce ezilmez. Gönderilmeyen alan değişmez, açık `null` yalnız izin verilen alanı temizler.
5. E-posta kaynağı için yalnız opak referans ve isteğe bağlı güvenli bağlantı saklanır. Ham posta ve ekleri görev sistemine zorunlu kopyalanmaz. Kaynak URL'si sunucu tarafından otomatik indirilmez.
6. İş eşleşmesi yoksa 422 veya ilişkisiz görev; yanlış işe tahminle bağlama yapılmaz. Sorumlu ve pano kimlikleri de kapsam içinde doğrulanır.
7. Audit aktörü gerçek agent kimliği ve profilidir. Kullanıcı ekranında “Grokbot tarafından eklendi/güncellendi” ve zaman görünür; kaynak bilgisi yetkisiz kişiye sızmaz.
8. Kalıcı ortak hız sınırı, gövde/alan/sayfalama sınırları ve indeksli sorgular. Hız sınırı altyapısı yokken sessizce sınırsız erişime düşülmez.
9. Mevcut JSON hata yapısı geriye uyumlu korunur; ek hata kodu ve alan hataları eklenebilir. 401/403/404/409/422/429/503, `X-Request-Id`, tekrar davranışı ve yeniden deneme kuralları belgelenir. `PATCH`, izin verilen metot/başlık listesine eklenir.
10. Sayfalama kararlı `(updated_at,id)` sırası kullanır. Değişiklik çekmede arşivlenen kayıtlar da görünür; kayıtlar sessizce kaybolmaz. İlk teslimde webhook yerine sorgulama yeterlidir.

Teslim: OpenAPI belgesi, secretsiz istek örnekleri, bağlanma yönergesi ve sahte ajanla uçtan uca test. Grokbot'u çalıştırmak, e-postayı yorumlamak, prompt yazmak veya gerçek hesap tokenı üretmek bu çalışmanın parçası değildir.

## 9. Veri geçişi ve geri dönüş

1. Uygulanmış migration listesi, görev/kişisel madde sayıları, null/yetim ilişkiler ve güncel RLS çıkarılır. Gerçek içerik gereksiz loglanmaz.
2. Yeni tablolar ve indeksler eklenir; eski kayıtlar silinmez. Test ortamında yetki ve geçiş provası yapılır.
3. İş görevleri kimlikleri mümkünse korunarak, kişisel maddeler sahip ve gizliliği korunarak taşınır. Kimlik çakışması varsa açık `legacy_source + legacy_id` eşleme tablosu kullanılır. Başlık, not, tarih, sıralama, sorumlu ve tamamlanma damgaları karşılaştırılır.
4. İş yorumları işte kalır. Uydurma görev geçmişi oluşturulmaz; yalnız “Eski sistemden aktarıldı” olayı ve bilinen tarihler kullanılır.
5. Panel ve `/jobs/[id]/gorevler` aynı görev servisine geçirilir. Eski şablon ekleme/tamamlama/atama yolları da envantere dahil edilir. Eski iş bağlantıları çalışır; artık göreve doğrudan bağlantı eklenir.
6. Son aktarımda kısa yazma duraklaması veya doğrulanmış delta yakalama seçilir. Varsayılan kısa bakım penceresi: son fark aktar → sayıları doğrula → tüm yazma yollarını değiştir → yazmayı aç. Uzun süreli çift yazma kurulmaz.
7. Geçiş sonrası eski tablolar salt okunur arşivdir. Eski yazma RPC/action yolları kapatılır. Veri kaynağı tekleşir.
8. Pilot geri dönüşü öncelikle arayüz bayrağıyla eski uyumluluk görünümüne yapılır; bu görünüm de yeni görev verisini okur. Yeni yazıları kaybederek eski veritabanına dönüş yapılmaz. Veritabanı geri dönüşü gerekiyorsa bakım penceresi, değişiklik dışa aktarımı ve prova edilmiş geri eşleme gerekir.
9. Eski tabloların kalıcı kaldırılması bu ilk yayının koşulu değildir. Yeni veri karşılaştırması, yedek/geri yükleme provası ve kullanım doğrulaması sonrasında ayrı bakım işidir.

## 10. Fazlar ve aradaki kontrol kapıları

Her fazın çıktısı ve kanıtı bu belgede güncellenir. “Kod yazıldı” tamamlanma sayılmaz. Kontrol kapısı başarısızsa ilgili faz düzeltilir; hata sonraki faza devredilip tamamlandı işaretlenmez. Kontrol kapıları rutin teknik/UX doğrulamalardır; her kapıda kullanıcıdan tekrar izin istemek anlamına gelmez.

| Faz | İş ve somut çıktı | Bağımlılık | Bitiş koşulu |
| --- | --- | --- | --- |
| F0 — Keşif | Kod haritası, Asana referansları, mevcut/önerilen yapı, canlı şema inceleme listesi | — | Yerel araştırma tamamlandı; canlı veri maddeleri açıkça ayrıldı |
| F1 — UX prototipi | Gerçek bileşenlerle Görevlerim, hızlı ekleme, Ekip, Pano ve görev detayının etkileşimli önizlemesi | F0 | 360/390px mobil ve masaüstü akışları incelenebilir |
| K1 — UX kontrolü | Günlük 5 senaryoda tıklama sayısı, okunabilirlik, mobil klavye ve geri dönüş incelemesi | F1 | Büyük kullanılabilirlik sorunu yok; akış ve bilgi hiyerarşisi net |
| F2 — Veri/yetki temeli | Görev/ekip/pano şeması, RLS, sürüm ve olay yapısı, ortak servis, migration provası | K1 | Kişisel/ekip/kurumsal sınırlar DB ve serviste aynı |
| K2 — Güvenlik ve geçiş kontrolü | Gerçek test kimlikleriyle RLS matrisi; aktarım karşılaştırması; API servis yetki testi | F2 | Yetkisiz okuma/yazma yok; sayılar ve gizlilik birebir |
| F3 — Günlük görev işlemleri | Görevlerim, hızlı oluştur/düzenle/ata/tarih/öncelik/tamamla, iş arama, detay URL'si | K2 | Mobil çekirdek akışları uçtan uca kaydediyor ve geri alınabiliyor |
| K3 — Mobil kontrol | Küçük telefon, tablet, klavye, dokunma, yavaş ağ, hata ve geri tuşu | F3 | Kaybolan metin, yatay taşma, kapalı kalan eylem yok |
| F4 — Ekip ve panolar | Üyelik, kişi görünümü, liste/pano, notlar, hedefler ve arşiv | K3 | Yönetici ekip görevlerini görüyor; özel görevler gizli; görünümler tutarlı |
| F5 — İşbirliği | Görev yorumları, bahsetmeler, geçmiş, ekler ve gelen kutusu | F4 | İnsan/ajan işlemleri izlenebilir; ek yetkisi göreve bağlı |
| K4 — Ürün bütünlüğü | İş sayfası ↔ Panel tutarlılığı; not/hedef akışı; üyelik kaybı ve dosya erişimi | F5 | Çift görev, çift bildirim veya erişim sızıntısı yok |
| F6 — Agent API | Görev uçları, kalıcı hız sınırı, idempotency, çakışma kontrolü, OpenAPI ve örnekler | K4 | Grokbot olmadan bağımsız test istemcisi oluşturup güncelleyebiliyor |
| K5 — API dayanıklılık kontrolü | Tekrar/eşzamanlılık, farklı scope, iptal tokenı, yanlış iş, hata ve süre aşımı testleri | F6 | Tekrar istek görev çoğaltmıyor; insan güncellemesi ezilmiyor |
| F7 — Pilot ve geçiş | Yedek, son veri aktarımı, seçili kullanıcılarla pilot, izleme ve geri dönüş provası | K5 | Kritik hata yok; veri eşitliği ve geri dönüş kanıtlı |
| K6 — Son kabul | Mobil/masaüstü görseller, regresyon, erişilebilirlik, performans, yönergeler | F7 | Tüm zorunlu senaryolar geçti; bilinen sınırlamalar kayıtlı |

Fazların gerçekleşen durumu ve tamamlanmamış dış ortam kontrolleri 13. bölümde kaydedilmiştir. Teknik doğrulama ile gerçek kullanıcı kabulü birbirinin yerine geçmez.

### Faz bazlı dosya alanları

- F1/F3: `src/app/(app)/page.tsx`, `src/app/(app)/panel/**`, `src/app/dev/panel-preview/**`, gerektiğinde `app-shell.tsx` ve Panel'e sınırlı tema stilleri.
- F2/F4: `supabase/migrations/**`, `src/lib/tasks/**` (saf alan kuralları), ayrı sunucu görev servisi ve Zod şemaları; `roles.ts` ve rol eşleşme testleri.
- F3/F7: iş hub'ının görev bileşenleri ve mevcut yazma yolları. İş emri düzenleme yetkisi genişlemez.
- F5: mevcut bildirim yardımcıları, görev eklerinin Storage politikaları ve geçmiş servisi.
- F6: `src/app/api/agent/_lib.ts`, görev/context route'ları, API testleri, `docs/agent-api.md` ve yeni görev API sözleşmesi.
- F7/K6: `docs/agent/panel.md`, `isler.md`, `roller.md`, `arayuz.md`, gerekiyorsa `DESIGN.md`; yeni kararlar mevcut kurallarla tutarlı kaydedilir.

## 11. Kabul senaryoları ve doğrulama

| Senaryo | Beklenen sonuç |
| --- | --- |
| Mühendis telefonda görev açar | Yalnız başlıkla kayıt oluşur; seçili kapsam görünür |
| Yönetici `0065` için mühendise görev atar | Ekip ve ilgili kişinin Görevlerim listesinde aynı kimlik görünür |
| Görev Panel'de tamamlanır | İş sayfası/pano/hedef ilerlemesi aynı sonucu gösterir |
| Kullanıcı özel görev açar | Başka mühendis, ekip yöneticisi ve Yönetici içerik/API/ek üzerinden okuyamaz |
| Termin bugün/geçmiş/tarihsizdir | İstanbul gününe göre doğru gruplama; gece yarısı hatası yok |
| Görev paylaşımı değişir | Yeni görünürlük açık; eski erişim kaldırılınca yorum/ek/arama/bildirim de tutarlı |
| İki kişi aynı görevi düzenler | Eski sürüm yazması reddedilir, kullanıcı metni korunur |
| Telefon bağlantısı kopar | Başarısız değişiklik anlaşılır; kayıt varmış gibi kalmaz |
| Dosya yüklemesi yarıda kesilir | Ek tamamlanmış görünmez; yeniden deneme ve yetim nesne temizliği işler |
| Agent aynı e-postayı yeniden işler | Aynı referans için görev çoğalmaz; bir e-postadaki farklı görevler birleşmez |
| Agent yanlış scope veya pano gönderir | Yetkisiz işlem reddedilir; service-role üzerinden geçemez |
| Agent geçersiz iş kodu gönderir | Sessiz yanlış eşleşme olmaz |
| Eski veri taşınır | Kayıt sayısı, sahiplik, tarihler, metinler ve gizlilik korunur |
| Pano arşivlenip geri alınır | Görevler kaybolmaz; bağlantılar tanımlı davranır |

Doğrulama yöntemleri: saf kural testleri; ayrı kullanıcı kimlikleriyle gerçek veritabanında geri alınan transaction'larla RLS testleri; servis/API entegrasyon testleri; migration kuru çalıştırma ve alan bazlı karşılaştırma; `/dev/panel-preview` görsel kontrolü; tarayıcı akışları; ilgili tip/lint/build ve mevcut Panel/rol/iş/ajan regresyonları. Kod yazmadan önce kurulu Next.js sürümünün yerel rehberi okundu. Çalıştırılan kontroller ve sınırları 13. bölümde kayıtlıdır.

Hedef cihazlar: 360/390/430px telefon, 768px tablet, 1280/1440px masaüstü; açık/koyu tema; dokunmatik ve klavye. iOS Safari ve Android Chrome gerçek cihaz kontrolü ayrıca yapılır; Chromium emülasyonu bunların yerine geçti sayılmaz. Görsel örnekler yalnız açıkça test fikstürü olarak önizlemede; üretime uydurma görev veya ekip eklenmez.

Performans hedefleri: ilk sayfa en fazla 50 görev, sunucu filtreleme ve cursor sayfalama; 10.000 görevli test verisinde sorgu planı kontrolü. Mobil hedefler LCP ≤2,5 sn, INP ≤200ms, CLS ≤0,1; test ortamı/ağ profili raporlanır. Etkileşim geri bildirimi yaklaşık 100ms içinde; kayıt isteği gecikmesi ayrıca ölçülür. Realtime yalnız gerekli aktif görünümde, yetki ve sorgu yükü ölçülerek; odak dönüşünde yenileme temel davranıştır. Bu değerler mevcut uygulama için ölçülmüş sonuç değil, geliştirme kabul hedefidir.

## 12. Kapsam sınırı ve teslim

İlk tamamlanmış teslim; kişisel/ekip görevleri, liste/pano, notlar/hedefler, hızlı mobil işlemler, iş kodu, yorum/geçmiş/ekler, bildirim görünümü, güvenli görev API'si ve kontrollü veri geçişini içerir.

Gantt, karmaşık bağımlılık motoru, iç içe alt görev ağacı, otomasyon tasarımcısı, gelişmiş kapasite planlama, tam çevrimdışı senkronizasyon, ayrı native mobil uygulama ve doküman arşiv ürünü bu ilk kapsamda yoktur. Takvim görünümü ancak liste/pano ve mobil akışlar yeterince iyi olduktan sonra ek ihtiyaç olarak değerlendirilir. AI modeli, e-posta analizi ve Grokbot kurulumu kullanıcıya aittir.

Son teslim kanıtları: çalışan ekranlar; mobil/masaüstü kontrol sonuçları; veri karşılaştırma raporu; yetki/API test sonuçları; OpenAPI ve örnek istekler; kullanıcı yönergesi; rollout/geri dönüş kaydı ve açık kalan sınırlamalar. Faz durumu ancak ilgili kanıt üretildiğinde tamamlandı olarak işaretlenir.

## 13. Uygulama kaydı — 12 Eylül 2026

### Gerçekleşen yapı

- Ayrı bir uygulama veya ikinci görev deposu kurulmadı. `job_tasks` genişletildi. 19 `user_todos` kaydı aynı kimlikle taşındı; eski istemci aynı adı taşıyan güvenli görünüm üzerinden ortak tabloya yazar. Eski silme çağrısı arşivler. `user_todos_legacy` yedek olarak kaldı.
- `/` doğrudan yeni görev alanını açar. Görevlerim, Ekip, Panolar, Gelen ve Menü; mobil sabit alt gezinme, masaüstü sekmeler; görev detayına URL ile doğrudan erişim bulunur.
- Başlık yeterli hızlı oluşturma; isteğe bağlı kişi, tarih, öncelik, iş kodu, açıklama; satırdan tarih/kişi, tamamla/geri al; arama, süzgeç, sayfalama, arşiv/geri alma uygulandı.
- Görev/not/hedef aynı kayıt modelidir. Pano türü oluşturma varsayılanıdır; aynı panoda hedef ve bağlı görevleri tutmak mümkündür. Hedef oranı bağlı görevlerden hesaplanır. Bağlı görevler varken hedefin kapsamını bozacak taşıma reddedilir.
- Dört sütunlu pano ve liste aynı kayıtları kullanır. Mobilde bir sütun seçilir. Sürükle-bırak eklenmedi; durum seçicisi hem klavye hem dokunmayla çalışır.
- Yorumlar, kişi bahsetmeleri, aktörlü önce/sonra geçmişi, özel dosya ekleri ve görev bildirimleri eklendi. Görev gelen kutusu ayrı küçük `task_inbox` defteridir; yeni bir e-posta dağıtım sistemi kurulmadı.
- Ortak komut RPC'sinde kayıt yetkisi, sürüm kontrolü, olay ve tekrar güvenliği atomiktir. Agent API mevcut token/scope kapısını kullanır; çoklu sunucu için kalıcı hız sayacı eklendi. E-posta okuma ve Grokbot bağlantısı yoktur.
- Dosya sınırı 20 MB; metadata ve temel içerik imzası denetlenir. Başarısız kesinleştirmede yüklenen nesne temizlenir. Tam antivirüs, yarıda kalan istemciler için zamanlanmış nesne temizliği ve ek silme arayüzü bu teslimde yoktur.
- Canlı şemaya beş migration uygulandı: `20260912000001`–`20260912000005`. Arayüz kodu yereldedir; Vercel dağıtımı yapılmadı. Ayrı kullanıcı feature flag'i kurulmadı; eski istemci için veri uyumluluğu sağlandı.

### Faz ve kontrol durumu

| Faz / kontrol | Gerçekleşen sonuç |
| --- | --- |
| F0 | Kod, tasarım, Asana görselleri, canlı şema ve veri sayıları incelendi. |
| F1 / K1 | Gerçek bileşenle development önizlemesi yapıldı. Hızlı ekle/tamamla/geri al/yorum tarayıcıda denendi. Fiziksel mobil klavye testi açık. |
| F2 / K2 | RLS, ekip üyeliği, özel kayıt, aktör taklidi, sürüm, tekrar ve aktarım testleri gerçek DB'de rollback ile geçti. |
| F3 / K3 | Günlük işlemler, URL ve odak dönüşünde yenileme uygulandı. 360/390px telefon, 768px tablet, 1440px masaüstü görselleri incelendi; yatay taşma görülmedi. Fiziksel cihaz/yavaş ağ laboratuvarı açık. |
| F4 / F5 | Ekip/pano/not/hedef/arşiv, yorum/bahsetme/geçmiş/ek/gelen kutusu uygulandı. |
| K4 | Eski kişisel istemcinin ekle/tamamla/sil→arşiv yolu gerçek authenticated rolüyle geçti. İş hub'ı ortak kaynağı okur; iş sayaçları arşiv/not/hedefi açık görev saymaz. |
| F6 / K5 | Görev uçları, OpenAPI, scope testleri, kalıcı sınır, tekrar anahtarı ve sürüm reddi doğrulandı. HTTP route testlerinde API kapısı mock'lanır; gerçek RLS/transaction ayrı DB testidir. Gerçek Grokbot tokenıyla dış istemci testi yapılmadı. |
| F7 | Veri geçişi tamamlandı; kullanıcı pilotu ve arayüzün üretime dağıtılması açık. Veriyi eski tabloya geri taşıma provası yapılmadı; geri dönüş ilkesi belgeye işlendi. |
| K6 | Üretim derlemesi ve ilgili kontroller geçti. Genel paketteki süre aşımı testleri ayrı çalıştırmada geçti. Fiziksel cihaz, ekran okuyucu tam taraması, açık tema görsel kontrolü ve Core Web Vitals ölçümü ayrıca yapılmalı. |

### Ölçümler ve doğrulama sınırı

10.000 geçici görevde 50 kayıt + toplam sayısı sorgusu ilk ölçümde 7.306 ms idi. Ayrıntı/erişim/hedef hesapları sayfalama sonrasına alındı; aynı senaryo 417 ms verdi. Test verisi transaction sonunda geri alındı. Bu tek uzak bağlantı ölçümüdür; üretim p95, LCP veya gerçek cihaz hızı değildir.

Genel test paketi: 267 dosya geçti, 3 dosyadaki 8 test 5 saniyelik süre sınırını aştı; aynı anda derleme çalışıyordu. Bu 3 dosya tek işçiyle yeniden çalıştırıldığında 56 testin tamamı geçti. 2 dosya/10 test paket tarafından atlandı. Son görev/iş/rol/ajan/satış regresyonunda 17 dosyada 182 test geçti. Değişen kaynakların ESLint kontrolü temiz; üretim derlemesi geçti.

Kalıcı iş silmede görev yorum/geçmiş/ek bağlantıları veritabanı tarafından korunur; bağlı görevler taşınmadan bu kayıtlar zincirleme silinmez. Günlük görev yönetiminde arşiv kullanılır.

Kullanım ve Grokbot rehberi: `docs/task-workspace.md`. Makine sözleşmesi: `docs/task-api.openapi.json`.

Yerel HTTP kapısı mevcut Agent API istemci yapılandırması bulunmadığından güvenli `503` döndürdü. Token açma/Grokbot bağlantısı kullanıcının sonraki adımıdır. Doküman denetçisi hata bulmadı; mevcut diğer alanlarda 14 yol/harita uyarısı raporladı. Son geri tuşu kontrolünde görev ayrıntısı kapandı ve liste URL'si korundu.
