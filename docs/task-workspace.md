# Panel görev yönetimi

Panel Görevlerim, Ekip, Panolar ve Gelen kutusu alanlarından oluşur. Yeni görev için başlık yeterlidir; tarih, kişi, iş kodu, etiketler ve açıklama isteğe bağlıdır. Basılı tutma hızlı işlem menüsünü, sola kaydırma tarih seçimini açar. Sağa kaydırma arşivler; yaklaşık 10 saniyelik Geri al bildirimi ve sonrasında Arşiv görünümünden geri yükleme vardır. Masaüstünde üç nokta/sağ tık aynı işlemleri sunar. Gelen kutusunda kaydırma yalnız bildirimin okunma durumunu değiştirir.

Etiketler yeni görev formunda ve detayda eklenir; liste/pano kartında iki etiket ve kalan sayısı görünür. Teklif, Proje ve Satın Alma ortak başlangıç kategorileridir. Kişisel/ekip etiketleri eklenebilir; mevcut etiketlerin ad/renk/arşivi yetkili kullanıcı tarafından düzenlenir. Etiket seçicisindeki Arşiv etiketlerini göster seçeneğinden geri yüklenir. Filtrele içinde herhangi biri/tümü/etiketsiz seçimi kayıtlı görünümlere ve URL'ye taşınır. Grokbot kurulumu ve örnekler: [Görev etiketleri API rehberi](grokbot-task-tags.md).

## Gizlilik ve ekip

Görevlerim bir süzgeçtir. Hem sana atanmış ekip görevlerini hem yalnız sana özel kayıtlarını gösterir. Bana özel kayıtları Yönetici de okuyamaz. İş kodu eklemek özel görevi paylaşmaz. Başkasına yalnız ikinizin göreceği iş için Kişiye özel kapsamını seç; ekipçe görülecek iş için ekip panosunu kullan. Paylaşım eylemi yorumlar ve eklerin de ekibe açılacağını belirtir.

Yönetici, Yönetim → Ekipler'den ekip oluşturur, kişileri ekler ve ekip içi yetkiyi seçer. Kullanıcılar → Ekipler aynı üyelikleri düzenler. Pano oluştururken bu ekibi seç. Mevcut iş görevlerinin kurumsal görünürlüğü korunur; Yönetici ekip görevlerini görebilir. Müdür rolü ekip üyeliğinin yerine geçmez. Ayrıntılar: [Profil, geri bildirim ve ekip yönetimi](account-teams.md).

## Panolar, notlar ve hedefler

Pano türü varsayılan kayıt türüdür. Ayrıntılardan farklı tür seçilebilir; bu sayede bir hedefle o hedefe bağlı görevler aynı panoda tutulabilir. Görev detayında Hedef alanını kullan. Yüzde, arşivde olmayan bağlı görevlerin tamamlanmasından hesaplanır. Bağlı görev yoksa yüzde gösterilmez. Not, görev detayındaki Göreve dönüştür eylemiyle görev olabilir; içeriği ve bağlantısı korunur.

Liste ve Pano aynı kayıtları gösterir. Telefon panosunda durum seçerek sütunlar arasında geçilir. Sürüklemek zorunda olmadan durum seçicisiyle taşıma yapılır. Görevler ve panolar arşivlenebilir; Arşiv görünümünden geri alınabilir. Kalıcı silme bu görev arayüzünde bulunmaz.

## Yorumlar ve ekler

Görev ayrıntısında açıklama, yorumlar, geçmiş ve dosyalar bulunur. Ekler özel depolamadadır; indirme bağlantıları 60 saniye geçerlidir. En fazla 20 MB: PDF, JPEG, PNG, WebP, düz metin, DOCX ve XLSX. Dosya içeriğinin temel imzası ve sunucu boyut sınırı kontrol edilir. Tam antivirüs taraması yapılmaz. Kayıtlı eklerin kalıcı silinmesi bu ilk sürümde sunulmaz.

Gelen kutusu atama ve yorum olaylarını gösterir. Yetkisini kaybettiğin görevin bildirimi de görünmez. Ajan değişiklikleri geçmişte ajan kimliğiyle ayrılır. Eski kişisel kayıtlarda olmayan geçmiş uydurulmaz.

## Grokbot bağlantısı

Mevcut [Agent API kurulumu](agent-api.md) kullanılır. Yeni ajan için ayrı profil, ayrı token ve yalnız gerekli scope'lar tanımlanır:

`tasks:read`, `tasks:write`, `tasks:comment`, `tasks:context:read`.

Bu geliştirme gerçek Grokbot tokenı üretmez ve mevcut ajanlara yeni izin vermez. Görev scope'ları e-posta, teklif, satış veya personel erişimi sağlamaz. Aynı profilin erişemediği göreve ajan da erişemez. Ajan özel görev oluşturursa kayıt ajan profiline özeldir; insanlara atamak için erişilebilir ekip panosu kullanılmalıdır.

Teslim ortamında Agent API istemci kaydı henüz tanımlı değildir. Yerel HTTP kontrolü bu nedenle `503 Agent API yapılandırılmamış` yanıtı verdi; görev route'u çalışır fakat harici erişim açılmaz. Bağlantı aşamasında rehberdeki `AGENT_API_CLIENTS` ayarına görev ajanını ekleyip uygulamayı yeniden başlatın/dağıtın. Bu ayar tarayıcıya yazılmaz.

Makine tarafından okunabilir sözleşme: [OpenAPI 3.1](task-api.openapi.json).

Üretim uçları, bu kodun uygulama ortamına dağıtılmasından sonra geçerlidir. Yerelde aynı yollar `http://localhost:3000/api/agent` altındadır.

### İş ve pano bul

`GET /api/agent/tasks/context?q=0065`

Yanıttaki `jobs` içinden tam `job_no` eşleşmesini ve `boards` içinden yetkili ekip panosunu seç. Eşleşme belirsizse tahmin etme. Kod string olarak tutulur. Kullanıcı kimliklerini `people` içinden al; sunucu seçilen kişinin panoya erişimini ayrıca denetler.

### Görev oluştur

```http
POST /api/agent/tasks
Authorization: Bearer <görev-ajanı-tokenı>
Content-Type: application/json
Idempotency-Key: mail-account-message-task-1

{
  "title": "Müşterinin teknik notlarını değerlendir",
  "note": "İlgili teknik notları kontrol et ve sonucu yorumda paylaş.",
  "visibility": "team",
  "board_id": "<yetkili-pano-uuid>",
  "job_id": "<0065-işinin-uuid>",
  "assignee": "<atanabilir-kişi-uuid>",
  "source_ref": "mail/hesap/mesaj/gorev-1"
}
```

Köşeli işaretli alanlar gerçek kayıtlarla değiştirilir. Yanıtta `task.id` ve `task.version` bulunur. Aynı e-postada ikinci görev için farklı kaynak alt kimliği kullanılır. Kaynak referansı ajan profili içinde benzersizdir. Yinelenen kaynak için 409 alınırsa `GET /tasks?sourceRef=...` ile mevcut kayıt bulunabilir.

### Görevi güncelle

```http
PATCH /api/agent/tasks/<görev-uuid>
Authorization: Bearer <görev-ajanı-tokenı>
Content-Type: application/json
Idempotency-Key: mail-account-message-update-1

{ "version": 1, "status": "doing", "priority": "high" }
```

Gönderilmeyen alan değişmez; izin verilen alanlarda `null` değeri temizleme anlamına gelir. Her güncelleme beklenen sürümü taşır. Başkası değiştirmişse 409 döner; yeni kaydı oku ve değişikliği yeniden değerlendir. Aynı ağ isteğini tekrarlarken anahtarı ve gövdeyi değiştirme. Başarılı tekrar `Idempotency-Replayed: true` başlığı taşır; değişiklik ve yanıt aynı veritabanı transaction'ında saklanır.

### Yorum ve değişiklik çekme

`POST /tasks/<id>/comments` gövdesi: `{ "body": "Kontrol tamamlandı.", "mentions": ["<kişi-uuid>"] }`. Aynı tekrar anahtarı kuralı geçerlidir. Yetkisi olmayan kişiye bahsetme bildirimi gönderilmez.

`GET /tasks` varsayılan olarak ajanın okuyabildiği özel ve paylaşılan kayıtları listeler; istenirse `view=mine` veya `view=team` ile daraltılır. `GET /tasks?updatedSince=<ISO-UTC-zamanı>` görev alanları değişen ve arşivlenen kayıtları da döndürür. Yorum/ek defterleri ayrı okunur. `nextCursor` varsa sonraki isteğe aynen ekle; aynı süzgeçleri koru. En fazla 50 kayıt/sayfa. Eşzamanlı değişiklikler için sonraki taramada küçük bir zaman örtüşmesi kullanıp `id + version` ile tekilleştir. İlk sürüm webhook veya e-posta tarayıcısı içermez.

## Geçiş ve işletim

`job_tasks` ortak görev kaynağıdır. 19 eski kişisel kayıt kimlikleri korunarak buraya taşındı; `user_todos_legacy` salt okunur yedektir. `user_todos` eski Panel yazılımları için güvenli, güncellenebilir görünüm; eski silme isteği arşivleme yapar. İş hub'ı aynı görev tablosunu kullanır.

Beş geçiş uygulandı: `20260912000001_task_workspace.sql`, `20260912000002_task_queries.sql`, `20260912000003_task_search.sql`, `20260912000004_task_integrity.sql`, `20260912000005_task_goal_integrity.sql`. `python scripts/task-db.py test` değişiklikleri transaction içinde deneyip geri alır; `migrate` yalnız uygulanmamış sürümleri uygular. Betik bu çalışma ortamının mevcut `.env.frankfurt`, Supabase bağlantı dosyası, `tmp/db-libs` içindeki pg8000 ve doğrulanmış CA dosyasını kullanır. Başka makinede bu yerel bağımlılıklar ayrıca hazırlanmalıdır. Bağlantı bilgileri loglanmaz.

Geri dönüşte eski kişisel görünüm yeni veriyi okumaya devam eder. `user_todos_legacy` tablosunu geri adlandırmak yeni görevleri kaybettirebilir; bu bir geri dönüş yöntemi değildir. Şema geri dönüşü gerekirse önce yeni kayıtlar dışa aktarılır ve bakım penceresinde doğrulanmış eşleme uygulanır.

Fiziksel iOS/Android cihaz kontrolü ve gerçek Grokbot bağlantısı ayrıca yapılmalıdır. Tarayıcı emülasyonu gerçek cihaz testi olarak raporlanmaz. Bildirim geçmişi son 50, görev olay geçmişi son 100 kayıtla sınırlıdır. Tam çevrimdışı çalışma ve native mobil uygulama kapsam dışıdır.

Arayüzde bir metin taslağı açıkken görev değişirse güncel metin karşılaştırma alanında gösterilir. Kullanıcı gözden geçirip kendi taslağını kullanmayı seçer; eski sürüm sessizce ezilmez. Ağ yanıtı kaybolduğunda aynı form isteği aynı tekrar anahtarıyla denenir. Sekme yenilenmeden taslak korunur; tam çevrimdışı veya tarayıcı kapanması sonrası taslak geri yükleme sunulmaz.

Görev geçmişi/yorum/ek ilişkileri kalıcı iş silmede de korunur. Böyle bir işi silmeden önce bağlı görevlerin iş/pano bağlantıları düzenlenmelidir; günlük kullanımda görev ve pano arşivi tercih edilir. Bağlı görevler varken hedefin türü veya kapsamı değiştirilemez.

Son uygulama ve kontrol kaydı: [Faz planı, bölüm 13](../plans/004-panel-gorev-yonetimi.md#13-uygulama-kaydı--12-eylül-2026).

## Günlük akış ekleri

Filtrele düğmesi telefonda alt panel açar. Görünümler ile mevcut filtreler kullanıcıya özel kaydedilir (en fazla 20); Bu hafta, Türkiye tarihine göre pazartesi–pazar ajandasını açar. Sayfalanmış kayıtlarda yüklenen/toplam sayısı görünür; Diğer görevleri yükle aynı filtrelerle devam eder.

Görev detayında isteğe bağlı kontrol listesi (30 adım), çizim kontrolü/iş teslimi şablonları, tekrar ve Şunu bekliyor alanları bulunur. Tekrar haftalık, aylık veya tamamlandıktan sonra gün tabanlıdır. Ay sonu korunur; yalnız bir sonraki görev oluşturulur. Tamamlamayı geri alıp yeniden yapmak ikinci bir sonraki kayıt üretmez. Yorumlar ve ekler kopyalanmaz. Arşiv veya sahibin erişim kaybı yeni tekrar oluşturulmasını durdurabilir.

Beklenen görev aynı paylaşım kapsamında olmalıdır. Özel/doğrudan görevlerde sahip ve sorumlu da aynı olmalıdır; iş görevlerinde iş kaydı aynı kalır. Döngü yasaktır. Ön koşul tamamlanmadan tamamlama, eski görev istemcisinde de engellenir. Bağlantılı görevlerin paylaşımını değiştirmeden önce bağlantılar kaldırılır; ekip içi sorumlu değişimi mümkündür.

Gelen kutusunda okundu/okunmadı işaretlenebilir ve görev açılabilir. Hatırlatma tercihleri termin uyarısını ve sessiz saatleri yönetir. Hatırlatıcı uygulama verisi yenilenirken çalışır; kapalı uygulamaya push bildirimi vaat etmez. Aynı kullanıcı/görev/termin için tek kayıt; görevin hazır olması bildirimi kullanıcı/görev için tek kayıt üretir.

`GET /api/agent/tasks/{id}/workflow` akışı okur. `PATCH` sürüm ve Idempotency-Key ile `checklist`, `recurrence` ve/veya `waiting_for` değiştirir. Yazma `tasks:write`, okuma `tasks:read` kapsamındadır; kayıt yetkisi ayrıca doğrulanır. Grokbot bağlantısını kullanıcı kuracaktır. [OpenAPI 1.1](task-api.openapi.json) · [Uygulama/kontrol kaydı](../plans/008-asana-karsilastirma-ve-iyilestirme.md#7-uygulama-kaydı--12-eylül-2026).
## Kontrollü iptal

Yanlış açılmış görevde hızlı işlemler veya detaydan **Görevi iptal et** seçilir. En az 3 karakter neden zorunludur. Görev **İptal edilenler** filtresine taşınır; tamamlanmış sayılmaz ve kalıcı silinmez. Kim, ne zaman, hangi nedenle iptal etti ve sonradan kim yeniden açtı bilgileri detayda ayrı geçmiş bölümünde korunur. İptal kaydı önceki görev içeriğinin kopyasını da saklar; kayıtlar kullanıcılar tarafından güncellenemez veya silinemez.

Kişisel/kişiye özel görevde oluşturan, ekip görevinde ekip sahibi/yöneticisi veya sistem yöneticisi, iş görevinde sistem yöneticisi iptal edebilir. Atama tek başına iptal yetkisi vermez. Paylaşılan görev işlemleri diğer yetkili yöneticilerin Gelen bölümünde görünür. İptal kaydı tekrar açılabilir; önceki arşiv durumu korunur. İptal için kaydırma kısayolu yoktur; neden ekranındaki açık işlem düğmesi kullanılır.
