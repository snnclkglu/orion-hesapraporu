# ORION Agent API v1

Görev alanı `tasks:*` yetkileriyle aynı kapıdadır. Görev oluşturma, güncelleme,
yorum ve iş/pano eşleştirmesi için [Görev/Grokbot rehberini](task-workspace.md)
ve [OpenAPI sözleşmesini](task-api.openapi.json) kullanın. Bu scope'lar mevcut
ajanlara otomatik eklenmez; e-posta veya personel yetkisi sağlamaz.

E-posta yönetimi de bu kapının ayrı yetkileridir. Şablon, yayın, kural,
önizleme ve gönderim işlemleri için [E-posta Merkezi yönergesini](email-center-agent.md)
okuyun. Aşağıdaki yayımlama kısıtları Teklif modülüne aittir.

Bu kapı, harici agent'ların ORION'a kullanıcı tarayıcısı veya oturum çerezi
taklit etmeden bağlanması içindir. İlk açık modül Teklif'tir. Taslak oluşturma ve
düzenleme vardır; yayımlama, yayımdan geri çekme, silme, teklif kopyalama,
maliyet, imza ve PDF binary bilerek yoktur.

Production base URL:

```text
https://app.orioncranes.com/api/agent
```

## Kurulum

Uygulama ortamına tek bir gizli `AGENT_API_CLIENTS` değeri koyun. Değer, tek
satırlık geçerli JSON dizisidir:

```json
[
  {
    "id": "grok-offers",
    "name": "Grok Teklifçi",
    "token": "<en-az-32-karakterlik-rastgele-secret>",
    "actorId": "<uygulamadaki-agent-profilinin-uuid-si>",
    "scopes": ["offers:read", "offers:draft:write"],
    "rateLimitPerMinute": 60
  }
]
```

`actorId`, ORION'da ayrı bir agent profiline ait olmalıdır. Teklif scope'ları
için profil rolü Yönetici veya Müdür olmalıdır. Agent adına kişisel çalışan
profili kullanmayın; audit izinde insan ve otomasyon ayrışmalıdır.

Yeni bir agent aynı JSON dizisine farklı `id`, token, profil ve yalnız ihtiyaç
duyduğu scope'larla eklenir. Bir token'ı iki agent paylaşmaz. JSON hatalıysa API
güvenli biçimde 503 döner. Eski kurulumlar için `AGENT_API_TOKEN` ve
`AGENT_USER_ID` hâlâ çalışır; çoklu-agent kurulumu bunların yerine registry'yi
kullanmalıdır.

## Ortak istek sözleşmesi

### Mevcut gizli kaydı değiştirmeden görev kapsamı ekleme

Vercel'de geri okunamayan `AGENT_API_CLIENTS` kaydının tamamını yeniden
yazmak gerekmez. Sunucuya ayrı `AGENT_TASK_SCOPE_GRANTS` JSON dizisi verilebilir:

```json
[{"tokenSha256":"<mevcut-bearer-tokeninin-64-karakter-kucuk-harf-sha256-ozeti>","scopes":["tasks:context:read","tasks:read","tasks:write","tasks:comment"]}]
```

Özet, token'ın başında/sonunda boşluk veya satır sonu olmadan UTF-8 baytlarından
hesaplanır. Bu değer bearer token değildir ve kimlik doğrulamada kullanılamaz.
Yalnız mevcut kayıtla eşleşen token'ın görev kapsamlarını genişletir; ajan
kimliği, profil, teklif/e-posta izinleri, hız sınırı ve görev görünürlüğü değişmez.
Yeni ajan oluşturmaz. Görev dışı scope, tekrar veya bozuk JSON güvenli biçimde
503 üretir. Token yenilenirse özet de yenilenmelidir; aksi halde ek izin uygulanmaz.
Bu ayar `NEXT_PUBLIC_` veya `next.config` içine yazılmaz. Üretim ayarı değiştikten
sonra yeni dağıtım gerekir. Geri almak için yalnız ilgili ek izin kaydı kaldırılır
ve yeniden dağıtılır; asıl ajan kayıtları korunur. Canlı kabulde mevcut token ile
`GET /api/agent/tasks/context` ve `GET /api/agent/tasks` sınanır.

Her iş isteği şu başlığı taşır:

```http
Authorization: Bearer <agent-token>
```

POST ve PUT gövdeleri `application/json` olmalıdır. POST işlemlerinde ağ
tekrarlarına karşı her mantıksal komuta özgü bir başlık gönderilmesi kuvvetle
önerilir:

```http
Idempotency-Key: <agentin-urettigi-benzersiz-komut-kimligi>
```

Aynı anahtar + aynı istek yeniden gelirse ilk JSON yanıtı aynı HTTP koduyla
döner ve `Idempotency-Replayed: true` başlığı eklenir. Aynı anahtar farklı
gövde veya yol için kullanılırsa 409'dur. Anahtar 8–128 görünür ASCII
karakterdir. Her doğrulanmış iş isteğinin yanıtında destek için `X-Request-Id`
bulunur.

Başarılı ve hatalı yanıtlar JSON'dur. Hata şekli değişmez:

```json
{ "error": "Türkçe mesaj" }
```

Başlıca kodlar: 401 token yok/yanlış; 403 scope ya da profil rolü yetersiz;
404 kayıt yok; 409 yayımlanmış revizyon/çakışma/tekrar çatışması; 422 UUID,
parametre veya JSON geçersiz; 429 oran sınırı; 503 kapı/audit/tekrar güvenliği
geçici olarak kullanılamıyor. Veritabanı mesajı, service-role key ve iç dosya
yolu yanıta çıkmaz.

## Scope'lar

| Scope | İzin verdiği işler |
| --- | --- |
| `offers:read` | Müşteri arama, teklif/revizyon, seçenek ve şablon okuma |
| `offers:draft:write` | Teklif + R0 açma, taslak revizyon açma/kaydetme, şablondan taslak kalem ekleme |

Bir route hem scope'u hem bağlı profilin ORION rolünü kontrol eder. Service-role
yalnız sunucudadır ve route listesinde olmayan bir eylemi agent'a açmaz.

## Uçlar

### Müşteri ara

`GET /customers?q=<metin>` — `offers:read`

En çok 20 defter eşleşmesi döner:

```json
{ "customers": [{ "id": "uuid", "name": "ACME SANAYİ" }] }
```

Teklif oluştururken serbest müşteri adı kabul edilmez; `customerId` bu UUID
olmalıdır.

### Teklif ve R0 taslağı oluştur

`POST /offers` — `offers:draft:write`

```json
{
  "customerId": "uuid",
  "subject": "32T GEZER KÖPRÜLÜ VİNÇ",
  "lang": "tr",
  "currency": "EUR",
  "issuerCustomerId": null
}
```

`lang` verilmezse `tr`, `currency` verilmezse `EUR`, `issuerCustomerId`
verilmezse `null` olur. Para birimi uygulamadaki güncel `CURRENCIES` listesine
tabidir. Konu uygulamanın Türkçe büyük-harf kuralıyla normalize edilir.

201:

```json
{
  "offerId": "uuid",
  "offerNo": "TETR-20260908-1",
  "revisionId": "uuid",
  "appUrl": "https://orion-hesapraporu.vercel.app/offers/uuid"
}
```

R0; arayüzle aynı firma, kapak, muhatap ve teklif varsayılanlarıyla açılır.

### Teklif özeti ve revizyonları

`GET /offers/:offerId` — `offers:read`

```json
{
  "offer": {
    "id": "uuid",
    "offerNo": "TETR-20260908-1",
    "customerId": "uuid",
    "customerName": "ACME SANAYİ",
    "subject": "32T GEZER KÖPRÜLÜ VİNÇ",
    "lang": "tr",
    "currency": "EUR",
    "status": "draft",
    "issueDate": "2026-09-08"
  },
  "revisions": [
    { "id": "uuid", "rev_no": 0, "label": "R0", "status": "draft", "total_amount": null }
  ]
}
```

### Revizyon snapshot'ını oku

`GET /offers/:offerId/revisions/:revisionId` — `offers:read`

```json
{ "payload": {}, "notes": "", "status": "draft", "rev_no": 0 }
```

`payload`, uygulamanın `withDefaults` işlemi uygulanmış tam snapshot'ıdır.
İmzacı adı/unvanı görünür; iç kullanıcı UUID'si, özel imza deposu yolu ve özgün
dosya adı güvenlik sınırında çıkarılır.

### Taslak revizyonu kaydet

`PUT /offers/:offerId/revisions/:revisionId` — `offers:draft:write`

```json
{ "payload": { "...": "GET ile alınan tam snapshot" }, "notes": "isteğe bağlı" }
```

Bu bir parça güncelleme değildir: agent önce revizyonu GET eder, tam payload'ı
düzenler ve geri PUT eder. `notes` verilmezse mevcut nota dokunulmaz; boş metin
notu siler. Sunucu toplamı ve kalem künyesini yeniden hesaplar. Yalnız
`status=draft` yazılır. İmza/profil alanları bu scope'un dışında olduğu için
gövdede gönderilse bile yok sayılır ve sunucudaki mevcut değer korunur.
Yayımlanmış revizyonda 409:

```json
{ "error": "Yayımlanmış revizyon değiştirilemez; yeni bir revizyon oluşturun." }
```

Başarı: `{ "ok": true }`.

### Yeni taslak revizyon oluştur

`POST /offers/:offerId/revisions` — `offers:draft:write`

En yüksek revizyonun payload ve not snapshot'ını kopyalar.

201:

```json
{ "revisionId": "uuid", "rev_no": 1 }
```

### Teklif seçeneklerini oku

`GET /offer-options?listKey=<anahtar>` — `offers:read`

Etkin `offer_options` satırlarını sıralı döndürür. Örnek anahtarlar uygulama
defterinden gelir (`brand.motor`, `brand.drive`, `term.delivery` vb.); agent
marka, seri veya şart metni uydurmamalıdır.

```json
{
  "options": [
    {
      "id": "uuid",
      "list_key": "brand.motor",
      "value": "SEW",
      "parent_id": null,
      "sort": 10,
      "is_default": false,
      "note": ""
    }
  ]
}
```

### Kalem şablonlarını oku

`GET /offer-templates` — `offers:read`

```json
{
  "templates": [
    { "id": "uuid", "name": "Çift Kirişli", "crane_type": "GEZER KÖPRÜLÜ VİNÇ" }
  ]
}
```

### Şablondan taslak kalem ekle

`POST /offers/:offerId/revisions/:revisionId/items` — `offers:draft:write`

```json
{ "templateId": "uuid", "title": "VİNÇ - 1" }
```

`title` isteğe bağlıdır. Sunucu etkin şablonu okuyup arayüzdeki Kalem Ekle ile
aynı grup ve satırları kurar, taslağı ortak kayıt mantığından geçirir ve agent'ın
dolduracağı gerçek yapıyı döndürür:

```json
{ "itemId": "uuid", "item": { "id": "uuid", "groups": [] } }
```

Agent bundan sonra revizyonu tekrar GET edip yalnız dönen gerçek satır
anahtarlarına değer yazmalı, ardından tam snapshot'ı PUT etmelidir.

## Audit ve işletim

Her doğrulanmış GET/POST/PUT isteği asıl işe başlamadan `audit_log`a yazılır.
`actor` agent profil UUID'sidir; `detail` içinde `actor: "agent"`, `agent_id`,
`agent_name`, `scope`, `request_id`, HTTP yöntemi/yolu ve ilgili
teklif/revizyon kimlikleri bulunur. Audit yazılamazsa iş yapılmaz. CORS OPTIONS
ön uçuşu iş isteği değildir ve audit üretmez.

Oran sınırı varsayılan olarak agent kimliği + IP başına dakikada 60'tır ve
Vercel örneği belleğinde tutulur. Bu v1 için kaba kötüye kullanım freni,
dağıtık kesin kota değildir. Çok daha yüksek trafik veya dış müşterilere açılan
bir agent platformunda sayaç ortak bir rate-limit deposuna taşınmalıdır.

Deployment'ta `20260908000010_agent_api_idempotency.sql` migration'ı
uygulanmadan Idempotency-Key kullanan POST'lar güvenli biçimde 503 döner. Secret
eklendikten ve migration uygulandıktan sonra önce müşteri arama + test teklifi,
sonra şablondan kalem + GET/PUT, en son ORION'un Önizle ekranı ile belge kontrolü
yapılmalıdır. Test için açılan teklif yayımlanmamalıdır.
