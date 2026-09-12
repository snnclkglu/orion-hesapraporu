# Çizim İşleme

## CAD-1 — Yerel motor ve web sınırı

`/cad`, kaynağın kopyalandığı `desktop/cad/engine` ve `desktop/cad/worker.py`
üzerinden Windows'taki kullanıcının tam AutoCAD'ini kullanır. Kaynak pafta aracı
ayrı klasörde korunur; source-manifest.json başlangıç SHA-256 değerlerini tutar.
Hesap motoru, teknik resim planı ve satın alma otomatik değiştirilmez.

`contracts.ts` saftır. `server.ts` Vercel'deki dar bağlantı katmanıdır.
`service.ts` istek başına bağımlılıkları verilen sunucu iş kurallarıdır;
`supabase/functions/cad-api/index.js` Supabase ortamında çalışır. Web isteğinde
oturum getUser ile, cihaz isteğinde cihaza özel anahtar ile doğrulanır.
Edge verify_jwt=false yalnız farklı cihaz protokolünü kabul etmek içindir;
uygulama içi kimlik ve sahiplik kontrolü kaldırılmaz. Vercel'e yeni service-role
ortam değişkeni gerekmez. İşleme protokolü 1'dir;
uyumsuz yardımcı yeni iş alamaz. İlk sürüm dış referanssız tek DWG, 100 MB kaynak,
1000 pafta ve 2 MB yapısal sonuç sınırıyla çalışır. Kâğıt A3/AUTO; revizyon
varsayılanı tüm kopyaları incelemeye getirmektir. Seçim kullanıcıya aittir.

Web birden fazla dosya veya alt klasörleriyle klasör seçebilir; her DWG ayrı
iş olur. Bir seçim en fazla 30 DWG, dosya başına 100 MB. DWG olmayan dosyalar
seçime alınmaz ve sayıları gösterilir; Xref paketi desteği anlamına gelmez.
Dosya seçimi AutoCAD hazır değilken de açıktır; yalnız işleme gönderme hazır
cihaz ve çalışma onayı gerektirir. Yarım toplu yüklemede tamamlananlar listeden
çıkar, kalanlar ve aynı isteğin kimliği korunur; yeniden deneme kopya iş açmaz.

## CAD-2 — Yetki ve cihaz sahipliği

İşleme `canProcessCad` sorusuyla Yönetici/Mühendis/Teknik Ressam'a açıktır.
Eksik profil mühendis varsayılmaz. İş ve cihaz satırları yalnız sahibine açıktır;
onaylanan paketler mevcut Teknik Resimler erişim kuralına girer. Yönetici başka
kullanıcının cihazını kullanamaz. Tarayıcı cihazı kendi başına tespit ettiğini
iddia etmez; kullanıcı hedef bilgisayarı seçer.

Eşleştirme 256 bit kod, 10 dakika süre ve atomik tek kullanım taşır. Yardımcı
256 bit anahtarı kendisi üretir. Sunucuda hash, Windows'ta DPAPI saklanır.
Anahtar yalnız `/api/cad/worker` içindir; şifre veya service-role dağıtılmaz.
Eşleştirme bir kez yapılır; yardımcı sonraki açılışlarda DPAPI kaydını kullanır.
Bağlı bilgisayarda yeni kod formu "Başka bilgisayar bağla" altında tutulur;
eşleşen kod ekrandan kalkar. "Bağlantı kayıtlı" ile AutoCAD hazırlığı farklıdır.
Bu tek rota proxy'nin çerez yönlendirmesinden muaftır; diğer CAD rotaları muaf değildir.
RLS açıktır; tablo yazması istemcilere kapalı, RPC çalıştırması yalnız service_role'a açıktır.

## CAD-3 — İş, kesinti ve değişmez çıktı

İş alma cihaz satırı kilidi ve kuyruk satırı kilidi altında atomiktir. Bir cihazda
bir processing işi bulunabilir. Heartbeat 25 saniye; görünür çevrimiçi eşiği 90 saniye;
iş sahipliği 3 dakika. Heartbeat yalnız geçerli denemeyi uzatır. Eski deneme veya
iptal edilmiş iş sonuç yazamaz. Tekrarda yeni attempt_id üretilir.

Yükleme izni yalnız tek dosyaya, üzerine yazma kapalı verilmiştir. Kaynak SHA-256
yerelde doğrulanır. Sonuç JSON hash'i ve tüm çıktı boyutları sunucuda doğrulanır.
Pafta sayısı/PDF sayısı eşitliği, tekil PDF adları ve sıfır işlem hatası şarttır.
İşlem hatası, mevcut Teknik Resimler'in içerik bulgusu düzeyleriyle karıştırılmaz.

## CAD-4 — Kullanıcının AutoCAD oturumu korunur

Yardımcı kendiliğinden işlem başlatmaz; yerelde Kontrol et ve başlat gerekir.
Kaydedilmiş veya değiştirilmiş açık çizimler varsa yeni iş alınmaz. Yardımcı 1.0.2
yalnız DWGTITLED=0, DBMOD=0, boş model ve yalnız viewport içerebilen layout
koşullarını sağlayan başlangıç çiziminin açık kalmasına izin verir; onu kapatmaz.
Path başlangıç çiziminde de dolu olabilir, kayıt ölçütü değildir. COM okuması
başarısızsa iş alınmaz; kısa süreli RPC reddi sınırlı tekrar edilir. İş çocuğu
ve geçici DWG açma sarmalayıcısı aynı kontrolü tekrar eder.
Yalnız işin indirilmiş source.dwg kopyası açılır; beklenmeyen ActiveDocument
eşleştirmesi reddedilir. FILEDIA/CMDDIA/BACKGROUNDPLOT normal kapanışta geri yüklenir.
Zaman aşımında yalnız kendi Python alt süreci durdurulur; AutoCAD'e toplu taskkill,
Quit veya kullanıcının çizimini kaydet/kapat çağrısı gönderilmez. Timeout sonrası
AutoCAD'deki açık işlem çizimi ve ayarlar kullanıcı tarafından kontrol edilmelidir.

## CAD-5 — Aktarım ve kaynak izi

Onay açık kullanıcı işlemidir. Paket oluşturma CAD işi kilidi altında tekildir.
Yarım aktarım aynı pakette devam eder. Dosyalar Storage içinde kopyalanır;
DWG/PDF Vercel gövdesinden geçmez. Dosya kaydı, doğrulama, Excel/PDF içe aktarma
ve uzlaştırma mevcut Teknik Resimler akışını kullanır. Kaynak CAD işi/denemesi/araç
sürümü paket notundadır. Adetler bu modülde tekrar çarpılmaz.
Yardımcı 1.0.1 ayrıca tek BOM sayfalı CAD_MALZEME.xlsx üretir; başlıkları mevcut
Excel okuyucusuyla eşleşir. Kaynak rapor ve birleşik PDF indirmede korunur,
ancak aktarım yalnız sonuçta listelenen pafta PDF'leri ve CAD_MALZEME.xlsx'tir.
Eski yardımcıda uyumlu Excel eksikse malzemeli işin aktarımı açık hatayla durur.
Tamamlanan aktarım exported_at ile işaretlenir; tekrar aktarma mevcut paketi
gösterir, Teknik Resimler'de sonradan düzenlenmiş satırları yeniden içe aktarmaz.

## CAD-6 — Kabul ve işletim

Plan `plans/009-cizim-isleme-autocad.md`, test sonucu `docs/cad-validation.md`.
Önizleme `/dev/cad-preview`; production'da 404. Yardımcı dağıtımı ve imza durumu
`desktop/cad/README.md` içinde belirtilir. Canlı web yayını ile yerel kod teslimi
ayrı kontrol noktalarıdır. Eski engine/entegrasyon yardımcısı çalıştırılmaz.
