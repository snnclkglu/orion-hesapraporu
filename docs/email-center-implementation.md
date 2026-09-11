# E-posta Merkezi uygulama takibi

Kullanıcı bütün fazları 11.09.2026 tarihinde onayladı. Şablon ve kural yönetimi
Codex bağlantısından; önizleme, denetim ve gerektiğinde elle müdahale Yönetim
içinden yapılır. Gönderim mevcut şirket Vercel / Resend bağlantısını kullanır.

- [x] Yayın ve olay modeli, değişmez anlık kayıt, geçmişe gönderim yapmayan geçiş
- [x] HTML alan sözlüğü, güvenli derleme, şablon sürümleri
- [x] Ortak yönetim servisi, panel ve yetkili ajan uçları
- [x] Önizleme, alıcı açıklaması, tekil test, kurallar ve genel durdurma
- [x] Kalıcı olay/kuyruk, tekrar güvenliği, eski kuyruktan geçiş
- [x] İmzalı Resend teslim sonuçları ve gönderim geçmişi
- [x] İş emrinde yayınlama ve işe bağlı geçmiş
- [x] İşlev, yetki, eşzamanlılık ve dar ekran testleri
- [x] Canlı migration, dağıtım, webhook bağlantısı ve tekil teslim doğrulaması

Yeni iş emri kuralları kapalı başlar; alıcı rolü uydurulmaz. Önceden etkin
üç bildirim aynı alıcı kuralıyla korunur. Gerçek iş emri sırf test için
yayımlanmaz. Testler ayrı transaction içinde geri alınabilir veya açıkça test
gönderimi olarak kaydedilir.

## Doğrulama sonucu — 11.09.2026

- 15 test dosyasında 133 test geçti; TypeScript ve hedefli ESLint temiz.
- Üretim derlemesi geçti; şirket Vercel projesi main dalından otomatik yayımlıyor.
- 07/08 migration'ları uygulandı; yayın/düzenleme kilidi/tekillik/kuyruk/teslim sırası senaryoları uygulamadan önce ve sonra geri alınan transaction içinde geçti.
- Canlı panel, kaydedilmiş şablon önizlemesi, gerçek iş/alıcı önizlemesi ve işe bağlı yayın geçmişi açıldı. Dar ve geniş HTML görünümü kontrol edildi.
- Oturumsuz ajan erişimi 401; yönetim paneli ve panel API'si giriş ekranına yönleniyor.
- Codex bağlantısı ayrı EMAIL_AGENT_CLIENTS sırrıyla hazır; mevcut teklif ajanları korunuyor.
- Resend webhook etkin; 7 teslim olayı, doğrulanmış imza, gizli üretim anahtarı.
- Gerçek deneme: 749a2014-c2af-4ab3-a480-9c097c104762; Resend 9a84bcac-5af3-48d9-9683-11967d12f613. 11.09.2026 20:15 Türkiye saati; tek deneme, scolakoglu@orioncranes.com, delivered. İmzalı email.sent ve email.delivered olayları kayda geçti.
- Yeni ilk yayın/revizyon kuralları alıcılar belirlenene kadar kapalı; mevcut üç bildirim açık. Test için gerçek iş emri yayımlanmadı.
- Kullanım: Yönetim → E-posta Merkezi. Codex yönergesi docs/email-center-agent.md; günlük tasarım/kural değişikliği için yeniden kod dağıtımı gerekmez.
