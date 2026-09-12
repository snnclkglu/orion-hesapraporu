# Grokbot ile görev etiketleri

Sözleşme: [OpenAPI 1.2](task-api.openapi.json). Yeni uçlar bu uygulama sürümü
yayımlandığında kullanılabilir. Anahtarı yalnız Grokbot'un güvenli bağlantı
ayarında saklayın; görev açıklamasına veya bu belgeye yazmayın.

## İzinler

- `tasks:read`: görevler ve erişilebilir etiket kataloğu.
- `tasks:write`: görev oluşturma/güncelleme ve mevcut etiketleri göreve bağlama.
- `tasks:tags:manage`: ayrıca yeni etiket oluşturma, yetkili etiketin adını/rengini değiştirme veya arşivleme.
- İş/kişi/pano eşleştirmek için mevcut `tasks:context:read` kullanılabilir.

Yeni izin ajana otomatik verilmez. Yönetim → API ve Entegrasyonlar üzerinden
eklenebilir. Genel katalog yazması Yönetici profiline, kişisel etiket sahibine,
ekip etiketi oluşturma ekip yazma yetkisine; ekip etiketini düzenleme/arşivleme
ekip yönetim yetkisine bağlıdır. Ajan izni kayıt görünürlüğünü genişletmez.

## Grokbot'a verilecek talimat

ORION görevlerini Teklif, Proje ve Satın Alma etiketleriyle kategorize et.
Önce GET /api/agent/tasks/tags ile kataloğu oku. Etiket kimliklerini bu yanıttan al;
isimden kimlik üretme. Belirsiz sınıflandırmayı bana sor. Görevdeki mevcut etiketleri
koru: PATCH /api/agent/tasks/{id} isteğinde güncel version ve add_tag_ids kullan.
Yanlış belirli bir etiketi kaldırmak için remove_tag_ids kullan. Katalogda olmayan
kategori gerekiyorsa verilen yönetim izni kapsamında oluştur; aynı isim varsa
mevcut kaydı kullan. Her yazmada Idempotency-Key gönder; ağ tekrarında anahtarı ve
gövdeyi değiştirme. 409 sürüm çakışmasında güncel kaydı yeniden okuyup işlemi yeniden
değerlendir. İşlem sonunda kaydı okuyarak doğrula.

## İstekler

Başlıklar: `Authorization: Bearer <görev-ajanı-anahtarı>`; yazmalarda ayrıca
`Content-Type: application/json` ve `Idempotency-Key: <bu-işleme-özel-anahtar>`.
Örneklerin kimlik ve sürümlerini gerçek API yanıtından alın.

`GET /api/agent/tasks/tags?q=Teklif` yanıtı `tags`, `total`, `nextCursor` içerir.
Her etikette `id`, `name`, `color_hue`, `scope`, `team_id`, `owner_id`,
`archived_at`, `version`, `updated_at`, `can_edit` vardır. En fazla 50 kayıt;
sonraki sayfada aynı filtreler ve `cursor` kullanılır.

Yeni kişisel kategori — `POST /api/agent/tasks/tags`:

```json
{ "name": "Kalite Kontrol", "color_hue": 155, "scope": "personal" }
```

Ekip kategorisinde `scope: "team"` ve `team_id`; ortak katalogda `scope: "global"`.
Renkler: 300 mor, 250 mavi, 65 turuncu, 155 yeşil, 200 turkuaz, 20 kırmızı.
Ad 1–40 karakter, aynı kapsamda benzersiz ve Türkçe büyük harftir.

Mevcut etiketleri koruyarak ekle — `PATCH /api/agent/tasks/<görev-uuid>`:

```json
{ "version": 7, "add_tag_ids": ["<etiket-uuid>"] }
```

Belirli etiketleri çıkar:

```json
{ "version": 8, "remove_tag_ids": ["<etiket-uuid>"] }
```

Tüm listeyi bilinçli değiştirmek için `tag_ids`; hepsini temizlemek için `[]`.
`tag_ids` ve ekle/çıkar alanları aynı istekte kullanılamaz; `null` geçersizdir.
Bir görev en fazla 10 benzersiz etiket taşır. Yeni görev `POST /api/agent/tasks`
isteğinde de `tag_ids` kullanılabilir; görev ve etiketler birlikte kaydedilir.

Katalog düzenle — `PATCH /api/agent/tasks/tags/<etiket-uuid>`:

```json
{ "version": 1, "name": "Teklif Takibi", "color_hue": 300 }
```

Arşivle: `{"version":2,"archived":true}`. Yeni sürümle `archived:false` geri yükler.
Eski görev ilişkileri korunur; yeni atama engellenir. `GET /tasks/tags?archived=true`
arşiv etiketlerini de gösterir.

## Filtre ve eşitleme

- `GET /api/agent/tasks?tagIds=<uuid1>,<uuid2>&tagMatch=any`: herhangi biri.
- `tagMatch=all`: seçilenlerin tümü.
- `untagged=true`: yalnız etiketsizler; `tagIds` ile birlikte kullanılamaz.
- Görev etiket değişikliği görev sürümünü ve `updated_at` değerini artırır;
  mevcut `GET /tasks?updatedSince=...` akışıyla çekilir.
- Katalog adı/renk değişikliğini ayrıca `GET /tasks/tags?updatedSince=<ISO-zaman>`
  ile çekin. Arşivleri de içerir. Sınırda küçük zaman örtüşmesi kullanıp kimlik+sürümle tekilleştirin.

Kişisel etiket yalnız sahibinin özel görevine; ekip etiketi aynı ekibin görevine;
genel etiket tüm yetkili görevlere atanır. Uyuşmayan paylaşım değişikliği 422 döndürür;
etiketi sessizce silmez/paylaşmaz. Arşiv etiketleri bir sonraki tekrar görevine kopyalanmaz.

401 anahtar; 403 izin/kapsam; 409 sürüm, mükerrer ad veya tekrar anahtarı;
422 alan; 429 `Retry-After`; 503 geçici erişim sorunudur. Başarılı tekrar
`Idempotency-Replayed: true` taşır. Ağ hatasında yeni anahtarla körlemesine tekrar yapmayın.
# Görev iptali ve yeniden açma

Görevler kalıcı olarak silinmez. Yanlış açılan görevi `POST /tasks/{id}/cancel` ile `{ "version": 7, "reason": "Yanlışlıkla ikinci kez açıldı" }` göndererek iptal edin. Önce görevden gerçek kimliği ve güncel sürümü okuyun. İptal nedeni 3–500 karakterdir. `Idempotency-Key` zorunludur.

Bu işlem için **ayrıca `tasks:cancel` izni** gerekir; `tasks:write` tek başına yeterli değildir. Kişisel ve kişiye özel görevleri oluşturan kişi; ekip görevlerini ekip sahibi/yöneticisi veya sistem yöneticisi; iş görevlerini sistem yöneticisi iptal edebilir. Görevin atanmış kişisi olmak iptal yetkisi vermez. Ajan, bağlı kullanıcı profilinin yetkilerini aşamaz.

`GET /tasks?period=cancelled` iptal edilenleri listeler. `POST /tasks/{id}/reactivate` için yalnız güncel `{ "version": 8 }` gönderilir. Eski arşiv durumu geri gelir; önceden arşivlenmiş bir görev yeniden açıldığında arşivde kalır. Görev detayındaki `cancellations`, işlem yapan kullanıcı/ajan, zaman, neden ve iptal/yeniden açma geçmişini içerir. Bu geçmiş kullanıcı/API üzerinden değiştirilemez. `updatedSince` eşitlemesinde iptal kayıtları da gelir; bunları yerel aktif listenizden çıkarın.

Bağlı görevleri veya bekleme bağlantıları olan kayıtta 422 döner; bağlantıları kullanıcıyla değerlendirerek düzenleyin. Ajanın rutin sınıflandırması için iptal izni vermek gerekmez. İptal işlemini yalnız açık kullanıcı isteğiyle çalıştırın.
