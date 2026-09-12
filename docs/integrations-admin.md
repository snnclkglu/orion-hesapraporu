# Yönetim → API ve Entegrasyonlar

Adres: `/admin/integrations`. Yalnız Yönetici (`admin`) erişir; Müdür (`manager`) bu rol değildir. Sayfa verisi, indirme ve her değişiklik ayrı sunucu kontrolü yapar. Ajan anahtarı Yönetim sayfasına giriş yetkisi vermez.

## Mevcut Grokbot'u kullanma

1. Ajanlar bölümünde ilgili kaydı seçin. Görünen liste ek görev izinleri dahil etkin kapsamdır.
2. Ortam kaydı için **Yönetimi uygulamaya aktar** mevcut anahtarı, ajan kimliğini ve `actorId` profilini korur. Token yeniden oluşturulmaz; sunucu mevcut değerin yalnız SHA-256 özetini veritabanına kaydeder.
3. Aktarımdan sonra izinleri ve hız sınırını düzenleyebilir, ajanı duraklatabilirsiniz. Değişiklik özeti gösterilir; kaydettiğiniz ayar sonraki istekte uygulanır.
4. **Grokbot yönergesini kopyala** veya **Bağlantı paketi** ile adres, izinler, örnek test komutu ve sözleşmeleri alın. Paket token içermez. Gizli anahtar zaten Grokbot'ta varsa tekrar paylaşılmaz.
5. Grokbot kendi secret kaynağından token'ı kullanarak `GET /api/agent/me` çağırır. Bu uç yalnız kendisinin kimliğini, scope'larını ve API sürümünü döndürür. Ardından izinli görev context/liste okumaları yapılır.

Paneldeki **Ayarları kontrol et**, yapılandırmayı yeniden okur. Harici bearer isteği yapılmış gibi bağlantı başarısı üretmez. İstekler ekranı gerçek API yanıtlarını gösterir; eski audit kayıtları başarı oranına dönüştürülmez.

## Yeni ajan ve anahtar yenileme

Yeni ajan için önce Kullanıcılar bölümünde ayrı otomasyon profili hazırlayın; kişisel çalışan profili kullanmayın. Ajan kimliği sabittir. Profil rolü ve ekip/kayıt izinleri ayrıca uygulanır. Yeni bir scope vermek rol matrisini değiştirmez; bana özel görevler diğer profillere açılmaz.

Anahtar sunucuda 32 rastgele bayttan üretilir ve yalnız bir kez gösterilir. Veritabanında ham token bulunmaz. Anahtarı pencereyi kapatmadan güvenli secret kaynağına kaydedin. Belirsiz ağ hatasında yenilemeye otomatik tekrar uygulanmaz; kayıtları yenileyerek durumu inceleyin.

- **24 saat geçiş:** Eski anahtarlar en fazla 24 saat daha geçerlidir; daha erken bitişleri varsa uzatılmaz.
- **Hemen değiştir:** Eski anahtarların tamamı sona erer. Yeni anahtar dış ajana tanımlanana kadar bağlantı durur.
- **İptal et:** Seçili anahtar geri açılamaz. İptal izi korunur.
- **Duraklat:** Anahtarları silmeden ajanın erişimini durdurur; tekrar etkinleştirilebilir.

Sürüm kontrolü aynı ajan üzerinde eşzamanlı yönetim işlemlerinin birbirini ezmesini engeller. Yenileme ve anahtar kaydı aynı veritabanı işlemi içindedir.

## Yetki ve hata kontrolü

Etkin erişim = API scope'u ∩ profil rolü ∩ hedef kayıt/ekip eylem yetkisi.

403 için `scope_denied` gerekli API izninin eksik olduğunu, `profile_denied` profil rolünün uygun olmadığını gösterir. Diğer erişim reddi hedef işleme/kayda ilişkin olabilir. 404, kayıt yokluğu kadar ajana görünmeme anlamına da gelebilir; özel kaydın varlığı açıklanmaz.

Her ölçülen istekte `X-Request-Id` üretilir. Görev mutasyonlarında zorunlu tekrar anahtarı ve güncel kayıt sürümü kullanılır. E-posta POST komutlarında önizleme dışında tekrar anahtarı zorunludur. Teklif POST uçlarında mevcut isteğe bağlı tekrar güvenliği korunur; PUT aynı mekanizmayı kullanmaz.

## Veri ve çalışma sınırları

`agent_clients`, `agent_credentials`, `agent_config_events`, `agent_request_events`, `agent_request_daily` tabloları istemci rollerine açık değildir. Sunucuya özel RPC'ler hizmet rolüyle çağrılır; yönetim RPC'si yöneticiyi ayrıca doğrular.

Aktarılmış bir ajan için veritabanı tek yetkili kaynaktır. İzin azaltma, iptal, sona erme veya veritabanı hatası eski ortam tanımına geri düşmez. Ortam tanımı okunamasa da doğrulanabilen veritabanı ajanları çalışabilir. Yalnız yanlış anahtar ile eksik yapılandırma farklı hata durumlarıdır.

**Geri dönüş sınırı:** Ajan aktarımı veya anahtar iptali başladıktan sonra yalnız eski env kapısını kullanan uygulama sürümüne dönülmez; eski sırları yeniden kabul edebilir. Geri dönüş sürümü `agent_resolve` kontrolünü korumalıdır. İlk yayın kayıtları aktarmadan salt okunur pilot olarak kullanılabilir.

İstek ayrıntıları 7 gün, günlük özetler 30 gün için tasarlanmıştır. Saatlik `/api/cron/agent-maintenance` mevcut `CRON_SECRET` ile sınırlı partiler halinde temizlik yapar. Yoğun birikimde silme sonraki çalışmaya devam eder. Yönetim değişiklik geçmişi bu temizlikten etkilenmez.

Ölçüm en iyi gayretle tutulur; sonuç yazımı için 1,5 saniye üst sınır vardır. Hatası iş sonucunu değiştirmez. Mevcut zorunlu audit başarısızlığı ise işlemi başlamadan durdurur. Süre alanı sonuç ölçümünün yazılmasından önceki işlem süresidir. Kimliksiz istekler dakikada yol/durum başına örneklenir; günlük toplamlar bu nedenle kesin trafik/faturalandırma sayacı değildir.

Loglarda başlıklar, token, token özeti, tam URL/sorgu, görev açıklaması, müşteri adı veya e-posta gövdesi tutulmaz. Yol kimlikleri `:id` olarak özetlenir. Genel audit tablosu veya tekrar yanıtı önbelleği yeni hata ekranının veri kaynağı değildir.

## Geliştirme ve kabul

- Önizleme: `/dev/integrations-preview`, yalnız development ortamında. Örnek bilgiler kullanır; sunucu değişikliği veya anahtar üretimi yapmaz.
- API ve yönetim testleri: `npx vitest run src/lib/integrations src/app/api/agent 'src/app/(app)/admin/integrations/download/route.test.ts'`.
- SQL: Mevcut Python çalışma ortamıyla `scripts/integrations-db.py test` (geri alır), ardından `migrate` (kurar). Sırlar yereldeki mevcut ortam dosyasından okunur; çıktıya yazılmaz.
- Mobil: `node scripts/integrations-mobile-check.cjs`, Safari motoru için `--webkit`. Ayrı sunucu için `INTEGRATION_TEST_URL` ayarlanabilir.
- Gerçek iPhone Safari/ana ekran klavyesi ve Grokbot'un kendi anahtarıyla gerçek bağlantı kabulü ayrıca kaydedilir. Tarayıcı emülasyonu bunların yerine geçmez.

İlk katalog görev OpenAPI sözleşmesini, teklif route'larını ve e-posta komut izinlerini kullanır. İndirilen JSON paketi görev OpenAPI'sini, teklif/e-posta Zod girdi şemalarını ve rehberleri içerir; tüm modüllerin tek bir birleşik OpenAPI dosyası olduğu iddia edilmez. Yeni endpoint geliştirmek hâlâ kod, test ve yayın gerektirir.
