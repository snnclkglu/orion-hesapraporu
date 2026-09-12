# iPhone kabul ve küçük ekip pilotu

Durum: gerçek cihaz testi başlamadı. Windows WebKit otomasyonu iOS Safari veya gerçek galeri/klavye kabulü sayılmaz.

## Başlamadan

Deneme adresi: https://orion-hesapraporu-qhtzqm7e6-scolakoglu-9449s-projects.vercel.app . QR kodu `artifacts/task-release/iphone-preview-qr.png` dosyasındadır. Vercel hesap sorarsa aynı Vercel hesabınızla devam edin; ardından ORION hesabınızla giriş yapın. Bu adres mevcut Supabase verilerini kullanır; gerçek görev değişiklikleri gerçek kayıtlara yazılır. `localhost:3000` telefonun kendisini gösterdiğinden deneme adresi olarak kullanılmaz. Şifre veya fotoğrafı sohbete göndermeyin.

Kayıt alanları: tarih, iPhone modeli, iOS sürümü, Safari sürümü, denenen adres/sürüm. Henüz bilinmeyen alanlar boş bırakılır. Ekran görüntüsü paylaşılacaksa görev/kişi/yorum gibi özel içerikler kapatılır.

## 1 — Günlük görev akışı

1. Görevlerim'de gerçek bir işiniz için yalnız başlıkla görev açın. Gerekmeyen alanları boş bırakın.
2. Görevi açın; varsa gerçek iş kodunu, sorumluyu ve tarihi seçin. Klavye açıkken kaydetmeye ulaşabildiğinizi kontrol edin.
3. Açıklama ve gerçek bir yorum ekleyin. Ayrıntıdan listeye dönüp aynı kaydın göründüğünü doğrulayın.
4. Tamamlayın ve gerektiğinde geri alın. İşlem sürerken ikinci dokunuşun kopya oluşturmaması gerekir.
5. Ekip havuzu ve kişisel listenin aynı görev kaydını gösterdiğini kontrol edin. Kişiye özel görev ekip listesine düşmemelidir.

## 2 — Fotoğraf ve geri bildirim

1. Sağ üstteki küçük fotoğrafa dokunarak Profilim'i açın. Kendi seçtiğiniz galeri fotoğrafını yükleyin; iPhone fotoğrafı HEIC ise aynı akışı deneyin.
2. Yakınlaştırma/yatay/dikey kaydırıcılarla kırpın, kaydedin. Fotoğrafın yönü ve görünümü doğru olmalı.
3. Sayfayı yenileyin. Profilim ve sağ üst avatar tutarlı olmalı. Değiştirme/kaldırmayı yalnız gerçekten istiyorsanız deneyin.
4. Karşılaştığınız gerçek bir gözlemi geri bildirim formundan gönderin. İsterseniz ilgili ekran görüntüsünü ekleyin.
5. Gönderilerim'de tek kayıt görünmeli. Yönetici Yönetim → Geri Bildirimler'den aynı kaydı açabilmeli. Başka normal kullanıcı kaydı ve ekini görememeli.

## 3 — iPhone'a özgü kontroller

| Kontrol | Kabul ölçütü |
| --- | --- |
| Safari alt/üst çubukları | Açılıp kapanırken içerik ve alt gezinme kullanılabilir |
| Klavye | Yorum, başlık ve seçicilerde odak kaybolmaz; düğmeler erişilir |
| Galeri | Fotoğraf seçimi/kırpma hatası açık anlatılır; eski kayıt kaybolmaz |
| Dikey/yatay | Ana içerik yatay taşmaz; çentik ve hareket çubuğu düğmeleri örtmez |
| Büyük metin | Temel eylemler kaybolmaz, metinler üst üste binmez |
| VoiceOver | Düğme adları anlaşılır; görev durumu sesle anlaşılır; modal odak sırası doğru |
| Kısa bağlantı kesintisi | Başarısız yazma başarı gibi gösterilmez; yeniden deneme çoğaltmaz |
| Açık/koyu tema | Durum/öncelik yalnız renk farkıyla anlatılmaz |

Bağlantı kesintisi denemesinde kritik bir gerçek işi tehlikeye atmayın; henüz gönderilmemiş, kaybolması iş akışını etkilemeyecek bir taslakla ilerleyin. Bu uygulama için çevrimdışı çalışma desteği vaat edilmiyor.

## 4 — Pilot ve yayın kapısı

Kullanıcı + bir gerçek ekip üyesiyle başlanır. Gerçek iş kodu ve pilot üye henüz seçilmedi. Gerekirse erişim sınırı için ekip dışı normal kullanıcı kontrol eder; deneme amacıyla rol yükseltilmez. Gerçek görevde atama, tarih, yorum, ek ve tamamlama kullanılır. Gerekiyorsa kontrol listesi/tekrar/beklenen görev eklenir; özellikleri doldurmak için sahte görev açılmaz.

Her sorun için: senaryo, beklenen, görülen, önem, düzeltilen sürüm, aynı cihazda tekrar sonucu yazılır. Veri kaybı, özel veriye yetkisiz erişim, kayıt yapamama veya temel eyleme ulaşamama varsa yayın kapısı kapanır. Uygun önceki arayüze dönüş planı şema veya kullanıcı verisi silmeyi içermez.

| Tarih / sürüm | Cihaz | Senaryo | Gözlenen | Durum |
| --- | --- | --- | --- | --- |
| Henüz ölçülmedi | iPhone bilgisi bekleniyor | Fiziksel kabul | Ölçülmedi | Açık |

Sonuçları kısa metinle iletmeniz yeterli: cihaz/iOS, çalışmayan adım ve gördüğünüz durum. Kontroller bitmeden gerçek iPhone kabulü ve üretim yayını tamamlandı sayılmaz.
