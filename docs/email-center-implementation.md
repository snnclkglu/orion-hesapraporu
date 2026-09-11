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
- [ ] Canlı dağıtım, webhook bağlantısı ve tekil teslim doğrulaması (migration uygulandı)

Yeni iş emri kuralları kapalı başlar; alıcı rolü uydurulmaz. Önceden etkin
üç bildirim aynı alıcı kuralıyla korunur. Gerçek iş emri sırf test için
yayımlanmaz. Testler ayrı transaction içinde geri alınabilir veya açıkça test
gönderimi olarak kaydedilir.
