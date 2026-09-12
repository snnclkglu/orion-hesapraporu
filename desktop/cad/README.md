# ORION Çizim İşleme Yardımcısı

Bu yardımcı web uygulamasından gelen işi kullanıcının Windows bilgisayarındaki
tam AutoCAD'de işler. AutoCAD LT ve macOS desteklenmez. Çalışan kaynak motorun
kopyası `engine/` altındadır; orijinal araç değiştirilmez.

## Kullanıcı kurulumu

Bu adımlar CAD sunucu hizmeti ve yardımcı dağıtım paketi yüklendikten sonra
geçerlidir. Yerel kod teslimi tek başına canlı web özelliğini etkinleştirmez.

1. Web uygulamasında Çizim İşleme → Yardımcıyı indir.
2. Yardımcıyı Windows'ta açın; web uygulamasından bilgisayar adıyla bağlantı kodu üretin.
3. Uygulamanın ana HTTPS adresini ve 10 dakika geçerli bağlantı kodunu yardımcıya girin.
4. AutoCAD'deki gerçek çizimleri kaydedip kapatın; AutoCAD açık kalabilir. Yardımcı hazır durumu otomatik izler. AutoCAD kapalıysa Kontrol et ve başlat ile açın.
5. Webde hazır görünen bilgisayarı seçip DWG gönderin. İş boyunca AutoCAD'i kullanmayın.

Pencere açık kalmalıdır; küçültülebilir. Windows servisi olarak çalıştırmayın:
AutoCAD etkileşimli kullanıcı oturumuna ihtiyaç duyar. Görev Zamanlayıcı kullanılacaksa
yalnız kullanıcının oturumu açıkken çalıştırma seçilir; ilk sürüm yine yerel başlatma ister.

## Dosyalar ve bağlantı

Bağlantı anahtarı `%LOCALAPPDATA%/OrionCad/connection.dat` içinde Windows DPAPI ile
korunur. Dosya başka bilgisayara kopyalanarak kullanılamaz. Bağlantıyı iptal etmek
için webde Bilgisayar bağlantısı → Bağlantıyı kaldır kullanılır. Yeniden eşleştirmede
yeni iş alımını durdurun, işin bitmesini bekleyin ve webden aldığınız yeni kodla
Bilgisayarı bağla düğmesini kullanın. 1.0.3 eski bağlantıyı durdurup kaydı
başarılı eşleşmeden sonra değiştirir; dosya silmek gerekmez.

İşler `%LOCALAPPDATA%/OrionCad/jobs/<iş>/<deneme>/` altındadır. Kaynak kopyası,
engine.log, JSON ve PDF'ler saklanır. Ağ hatasında dosyalar silinmez. İş
tamamlandıktan sonra disk temizliğini kullanıcı yapar; otomatik saklama politikası
bu sürümün kapsamı dışındadır. Uygulama beklenmedik kapandıysa eski lease tekrar
canlandırılmaz; yerel sonuçlar korunur, webden yeni deneme başlatılır.

## Kontrol gereken durumlar

- Yardımcı yok: kurulup eşleştirilmeli; bu durum AutoCAD yok demek değildir.
- AutoCAD yok: tam AutoCAD kurulumu / COM kaydı kontrol edilir.
- AutoCAD başlangıç veya giriş ekranında: AutoCAD'i kullanıcı açıp tamamlar.
- Açık çizim: kaydedip kapatın. Yardımcı çiziminizi zorla kapatmaz.
- Süre aşımı: yalnız yardımcı alt süreci durur; AutoCAD açık kalabilir. İş çizimini
  ve FILEDIA/CMDDIA/BACKGROUNDPLOT ayarlarını kontrol edip sonra yeniden başlatın.
- Eksik PDF / tanınamayan antet: yerel tanı dosyaları incelenir; başarı varsayılmaz.
- Xref, özel font/CTB: ilk pilot kendi içinde tamamlanmış DWG kullanır.

## Geliştirici

Python 3.12 x64 ve `requirements.txt` kullanılır. `build.ps1` dağıtılabilir EXE'yi
`dist/` altına üretir. Kaynak testleri `python -m unittest discover -s tests` ile çalışır.
Engine testleri ayrıca kendi klasöründe çalıştırılır. EXE `--self-test` paketleme
duman testi içindir; gerçek AutoCAD PDF kabul testinin yerine geçmez.

Dağıtım dosyası kod imzalama sertifikası olmadan üretilebilir; Windows SmartScreen
kurulumda yayıncı doğrulama uyarısı gösterebilir. Kurum içi pilot için hash doğrulaması
yapılır; geniş dağıtımda kurumun kod imzalama sertifikasıyla imzalanmalıdır.

## Sunucu kurulumu ve yayın sırası

1. Yalnız `20260912120000_cad_processing.sql` ve
   `20260912120001_cad_export_integrity.sql` uygulanır. Test/doğrulama aracı
   `scripts/cad-db-check.py` başka modül migration'larını çalıştırmaz.
2. `node scripts/cad-deploy.cjs --prepare` dört Edge dosyasını yerelde hazırlar.
   `--check` dahi Supabase'e kaynak yükler; açık dağıtım yetkisi olmadan çalıştırılmaz.
   Yetki sonrasında `node scripts/cad-deploy.cjs` yalnız `cad-api` dağıtır.
3. `node scripts/cad-release.cjs --prepare` EXE hash'ini gösterir. Yetki sonrası
   `--upload` özel `cad-private/releases/1.0.5/` yoluna yükler ve indirdiği kopyanın
   hash'ini doğrular. Yönetici anahtarı geçici olarak bellekte kullanılır;
   istemciye, EXE'ye veya dosyaya konulmaz. Var olan farklı sürüm ezilmez.
4. Web uygulaması normal Vercel yayın sürecinden geçirilir. Bu depo başka
   çalışmaları da içerdiği için bu modülü eklemek tüm bekleyen değişiklikleri
   otomatik yayımlama yetkisi olarak kullanılmaz.
5. Gerçek kullanıcı hesabıyla eşleştirme, küçük bir DWG, inceleme/onay ve
   Teknik Resimler'e aktarım pilotu yapılır. Sonra diğer AutoCAD sürümleri denenir.

## Yardımcı 1.0.2 güncellemesi

Eski yardımcıyı kapatıp webden yeni EXE indirin. Aynı Windows hesabında bağlantı
kaydı korunur; yeniden kod gerekmez. Değiştirilmemiş ve içeriksiz Drawing1
sekmesi açık kalabilir. Gerçek çizimlerinizi kaydedip kapattıktan sonra Kontrol
et ve başlat kullanın. Yardımcı hiçbir kullanıcı sekmesini kapatmaz.

## Yardımcı 1.0.4

Paftalar arasında AutoCAD hazır olana kadar bekler; geçici meşgul yanıtlarında
baskı erişimini sınırlı tekrar eder. Eski yardımcıyı kapatıp yeni EXE indirin.
Mevcut bağlantı korunur. Kontrol et ve başlat sonrasında webde hatalı işi
Yeniden dene ile çalıştırabilirsiniz.

## Yardımcı 1.0.5

Kayıtlı bağlantıyla otomatik hazırlık takibi ve durum değişiminde anında bildirim.
AutoCAD oturumunu işler arasında kapatmak gerekmez; gerçek kullanıcı çizimi
açıkken iş alınmaz. Elle duraklatma ve işlem hatası sonrasında Kontrol et ve
başlat gerekir. Güncellemede eski yardımcıyı kapatıp yeni EXE indirin; bağlantı korunur.

Teknik baskı: ACI 7 siyah 0.35 mm, diğer indeks renkler siyah 0.13 mm. Beyaz
yazı ve ölçüler de aynı renk kuralına tabidir; TrueColor ve STB kullanan çizimler
ayrıca uyumluluk kontrolü gerektirir. CTB üretmek için geliştiricide ezdxf 1.4.4
kurulu olmalı: create_plot_styles.py. Çalışan EXE bu pakete ihtiyaç duymaz.
SHX yorumları yeni PDF çıktısında önlenir; eski sonuçlar için DWG yeniden işlenir.
