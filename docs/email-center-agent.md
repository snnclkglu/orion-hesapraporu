# Codex ile E-posta Merkezi

## Önce oku

Bu yönerge `Yönetim → E-posta Merkezi` ile aynı servisleri kullanan ajan
bağlantısı içindir. Yeni şablon/kural için uygulama kodunu veya migration'ı
değiştirme; aşağıdaki API'yi kullan. Yeni bir olay veya veri alanı gerekiyorsa
`src/lib/email-center/model.ts`, olay üreticisi ve testleri birlikte değiştir.

Üretim adresi: `https://app.orioncranes.com/api/agent/email-center`.
Yerel yardımcı: `node scripts/email-center.mjs get` ve
`node scripts/email-center.mjs command <komut.json> <benzersiz-istek-anahtarı>`.
Kimlik bilgileri `.env.email-agent` dosyasında veya ortam değişkenlerindedir;
dosyayı okuma çıktısına, komuta, loga veya Git'e yazdırma.

## Çalışma düzeni

1. GET ile olay/alan sözlüğünü, şablonları, sürümleri ve kuralları oku.
2. Aynı amacı taşıyan kural varsa onu güncelle; sırf görev yeniden açıldı diye
   ikinci kural/şablon oluşturma. Sabit şablon kimliği `slug` alanıdır.
3. HTML, konu, kısa özet, düz metin ve zorunlu alanları hazırla.
4. `template.save` ile yeni taslak sürümü oluştur. Mevcut sürümler değişmez.
5. Dönen `previewUrl` sayfasını uygulamada aç. Gerçek iş seçmek için `?jobId=<id>`
   ekle. Taslak kayıt/önizleme e-posta göndermez.
6. Kullanıcının talimatı kapsamında `test.send` ile ayarlardaki deneme adresine
   gönder. Alıcıyı payload içinde serbestçe veremezsin.
7. `template.publish` seçili sürümü yayına alır. Eski bir sürümü yayımlamak geri
   dönüş işlemidir. Kuyruktaki mesajlar kendi kayıtlı sürümlerinde kalır.
8. `rule.save` ile kuralı kaydet; mevcut kuralda dönen `revision` değerini gönder.
   Çakışma varsa güncel kaydı yeniden oku. Kapalı kural açılınca geçmiş taranmaz.
9. GET ile gönderim sonucunu doğrula. `sent` kabul, `delivered` alıcı sunucusuna
   teslim demektir; okunduğu söylenmez.

Kullanıcının mevcut talimatını izle. Tasarım isteğini kendi başına canlı
gönderim isteği sayma. Kullanıcı yayımlama/etkinleştirme/gönderime zaten izin
vermişse aynı izni tekrar isteme.

## Yetkiler

`EMAIL_AGENT_CLIENTS`, mevcut `AGENT_API_CLIENTS` kaydına eklenen ayrı gizli
JSON dizisidir. Teklif ajanlarının yetkileri genişlemez. Her kayıt mevcut
kayıt biçimini kullanır: id, name, token, actorId, scopes, rateLimitPerMinute.
E-posta scope'larının tamamı ayrıca Yönetici profilini gerektirir.

| Scope | İşlem |
|---|---|
| email:read | Liste, ayrıntı, önizleme |
| email:draft:write | Şablon taslağı kaydı |
| email:publish | Şablon yayını, kural ve ayarlar |
| email:test:send | Yalnız yapılandırılmış deneme adresine gönderim |
| email:send | Başarısız gönderimi deneme / teslim edilmiş mesajı tekrar gönderme |

Her istekte Bearer kimliği, yazma POST'larında `Idempotency-Key` gereklidir.
Ağ yanıtı belirsizse AYNI gövde ve AYNI anahtarla tekrar dene; yeni anahtar
üretmek belirsiz bir gönderimi tekrar oluşturabilir. `test.send` ve
`delivery.resend` gövdesindeki `requestId` de aynı kalmalıdır.
İnsan profili işlem sahibi olsa da `source=agent:<id>` ve ajan denetim kaydı
otomasyonu panel işleminden ayırır. Bu uygulamadaki e-posta bağlantısı,
kullanıcının yetkilendirdiği Yönetici adına ve ayrı ajan kimliğiyle çalışır.

## API

GET `/` liste döndürür. İsteğe bağlı `status`, `q` (alıcı), `jobId`, `page`
(sıfır tabanlı; sayfa 30 kayıt) süzgeçleri vardır.
GET `?detail=version&id=<id>` HTML dahil sürümü;
GET `?detail=delivery&id=<id>` gönderilen anlık içeriği ve teslim zamanlarını döndürür.

POST gövdesi `{ "action": "...", "data": { ... } }` biçimindedir.

| action | data alanları |
|---|---|
| template.save | slug, name, content |
| template.publish | templateId, versionId |
| rule.save | id/revision (düzenlemede), name, eventType, templateId, mode, userIds, roles, relatedRecipients, includeActor, priority |
| preview | versionId, jobId (isteğe bağlı), rule (isteğe bağlı), relatedUserIds (olay örneği), actorId (önizlemedeki işlemi yapan) |
| test.send | versionId, jobId (isteğe bağlı), requestId (UUID) |
| settings.save | paused, testAddress |
| delivery.retry | deliveryId |
| delivery.resend | deliveryId, requestId (UUID) |

`content`: subject, preheader, html, text, requiredFields dizisi.
`mode`: off, test, live. Gönderim zamanı ilk sürümde hemen.
Rol adları uygulamanın sekiz rol anahtarıdır. Aynı olayda aynı alıcıya bir mesaj
gider; küçük `priority`, eşitse sabit kural kimliği önceliklidir. Diğer seçim
nedenleri de kayda eklenir. Deneme modunda gerçek alıcılar düz metinde ve
panelde gösterilir, yalnız deneme adresine gönderilir.

## HTML sözleşmesi

Değişkenler `{{job.number}}` biçimindedir. İsteğe bağlı satırlar
`{{#if job.deliveryDate}}...{{job.deliveryDate}}...{{/if}}` ile gizlenebilir.
İç içe koşullar desteklenir; JavaScript, keyfi ifade, döngü ve üçlü süslü
parantez yoktur. Alanlar GET yanıtındaki sözlükten seçilir.

E-posta istemcileri için tablo düzeni ve satır içi stiller kullan. Script,
iframe, form, SVG, harici CSS ve style etiketi kabul edilmez. Metin değerleri
kaçırılır. Bağlantılar yalnız uygulama alanına; görseller yalnız ORION alanlarına
izinlidir. Önizleme ayrıca boş sandbox ve içerik güvenliği politikası içindedir.
Mobilde sabit genişlikli büyük tablolar kullanma. Outlook görünümünü gerçek
deneme e-postasıyla doğrula; tarayıcı önizlemesini bütün istemcilerde aynı
görünüm garantisi olarak sunma.

## Olay ve geçiş kuralları

- İlk yayın `job.published`, sonraki yayın `job.revised` olur.
- Yayın `publish_job_order` ile iş kaydından transaction içinde üretilir.
  Aynı revizyon ve aynı fotoğraf tekrar yayın oluşturmaz; değişmiş aynı
  revizyon reddedilir. Tamamlanmamış iş düzenlemesi yayımlanamaz.
- Eski iş emirleri geriye dönük yayımlanmaz; ilk yayın kuralları kapalı başlar.
- Atama, anma ve durum bildirimleri mevcut alıcılarla canlı kalır.
- Eski `notification_email_outbox` yalnız kalan mesajları boşaltır; yeni
  yazımlar `email_events`e gider. İkisine aynı mesaj yazılmaz.
- Genel durdurma bekleyenleri iptal eder; devam ettirmek eski mesajları açmaz.
  Sağlayıcıya aktarılmış mesaj geri alınamaz.
- Kuyrukta içerik, sürüm, gerçek alıcı, kural ve seçim nedenleri sabitlenir.
- Sırası değişen ve tekrarlanan webhook olayları teslim durumunu geriletmez.

## Doğrulama

`npm test -- src/lib/email-center src/lib/email src/app/api/webhooks/resend`
şablon, alıcı ve teslim imzasını sınar. `scripts/test-email-center-db.mjs`
şema kurulmadan önce; `--installed` uygulandıktan sonra çalışır. Bütün yayın,
kuyruk ve teslim denemeleri alt transaction içinde geri alınır; gerçek mesaj
göndermez. Gerçek test yalnız açık `test.send` işlemidir.
