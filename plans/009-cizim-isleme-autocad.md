# Çizim İşleme — yerel AutoCAD entegrasyon planı

Tarih: 12 Eylül 2026. Kaynak: `Proje Ayıklama/pafta_araci`.
Hedef: `HESAP RAPORU KOD/orion-hesapraporu`. Kullanıcı talebi: aracı
kopyalamak, ayrı ve gelişebilir bir uygulama bölümü eklemek, her aşamayı kontrol etmek.

## Kararlar ve kapsam

- Orijinal araç korunur. Kaynak kod ve testler `desktop/cad/engine` altına kopyalanır;
  müşteri DWG'leri, üretilmiş PDF'ler, önbellekler ve kullanıcı ayarları taşınmaz.
- Bölüm `/cad`: Çizim İşleme. Web işleri yönetir, Windows yardımcısı kullanıcının
  AutoCAD'inde işler. Vercel'de AutoCAD çalıştırılmaz.
- İlk sürüm tek DWG ve sırayla işleme destekler. Birden fazla DWG seçimi ayrı işler
  oluşturabilir; Xref/paket taşıma ve farklı CAD motorları gelecek fazdır.
- İşleme yetkisi mevcut Teknik Resimler yazma kümesine dayanır: Yönetici, Mühendis,
  Teknik Ressam. Taslaklar ve cihazlar sahibine özeldir. Onaylanan çıktı mevcut
  Teknik Resimler üzerinden mevcut okuma yetkileriyle paylaşılır.
- AutoCAD varlığı kayıt defteriyle ön kontrolden geçer; çalışabilirlik ayrı sınanır.
  Windows + tam AutoCAD gerekir. Yardımcı yok / çevrimdışı / AutoCAD yok / hazır /
  meşgul / kontrol gerekiyor durumları ayrı sunulur.
- Bilgisayar adı kimlik değildir. UUID, kullanıcı ve tek kullanımlık eşleştirme
  ile ilişkilendirilir; kullanıcı işin hangi cihazda çalışacağını görür.
- Yardımcıya kullanıcı şifresi, Supabase service-role anahtarı verilmez. Cihaza
  özel iptal edilebilir anahtar yalnız cihaz uçlarında geçer; Windows DPAPI ile saklanır.
- Uzun iş bir HTTP isteğinin ömrüne bağlı değildir. İş sahipliği süreli ve atomiktir;
  deneme kimliği eski çalışmanın yeni sonucun üzerine yazmasını engeller.
- Kaynak ve çıktı yüklemeleri doğrudan özel Storage kovasına gider. İmzalı izinler
  tek nesneye aittir. Büyük DWG/PDF dosyaları Vercel üzerinden geçirilmez.
- Kullanıcı AutoCAD süreçleri topluca kapatılmaz, görünürlükleri değiştirilmez.
  Zaman aşımı ve belirsiz oturumda otomatik yeni iş başlatılmaz; yerel müdahale istenir.
- Tanınamayan bilgi uydurulmaz; onaylanmadan satın alma veya proje planı değiştirilmez.

## Faz 0 — Mevcut durum ve geri dönüş [tamamlandı]

1. Repo durumu, alan kuralları, Next.js yerel belgeleri, menü/yetki, Storage ve
   teknik resim aktarım sözleşmelerini incele.
2. Mevcut değiştirilmiş dosyaları kaydet; başka çalışmaların değişikliklerini koru.
3. Yalnız ilgili kaynakları kopyala; kopya dosyaların SHA-256 manifestini yaz.
4. Ortak dosya düzenlemelerinde beklenen önceki içerik kontrolü yap.

Kontrol K0: orijinal kaynak hash'leri değişmemiş; müşteri dosyası/secret taşınmamış;
hedef dışına yazma yok; önceden var olan değişiklikler korunmuş.

## Faz 1 — Sözleşme ve veritabanı [tamamlandı]

1. Cihaz, iş, çıktı kayıtları; durumlar, zamanlar, kaynak hash'i ve araç sürümü.
2. Kullanıcı bazlı okuma RLS; yazma dar sunucu işlemleriyle. Cihaz anahtarları okunamaz.
3. Atomik iş alma, lease, deneme kimliği, iptal, yeniden deneme, cihaz iptali.
4. Özel kova, benzersiz dosya yolları, boyut ve dosya adı kontrolleri.

Kontrol K1: migration önce geri alınan transaction içinde denenir; rol ve sahiplik
senaryoları gerçek SQL ile sınanır; yetkisiz kullanıcı/anonim erişim reddedilir;
iki cihaz aynı işi alamaz; eski deneme sonuç yazamaz.

## Faz 2 — Yerel yardımcı [kod, paket ve yerel gerçek AutoCAD pilotu tamamlandı]

1. Eşleştirme penceresi; uygulama adresi ve tek kullanımlık bağlantı kodu.
2. DPAPI saklama; cihaz durumu; açık oturumda çalışan yardımcı; tek örnek kilidi.
3. Kuyruk alma, kaynak indirme/hash kontrolü, ayrı Python iş süreci.
4. AutoCAD oturumunu koruma, güvenli çalışma kontrolü, süre aşımında durma.
5. Kalıcı yerel iş klasörü; ağ kesilince sonucu koruma; dosya yüklemeyi devam ettirme.
6. EXE paketleme ve kullanıcı kurulum kılavuzu.

Kontrol K2: açık kullanıcı çizimi korunur; tüm AutoCAD süreçlerini öldürme yok;
geçersiz dosya yolu/URL kabul edilmez; sonuç dosyası tek başına başarı sayılmaz;
eksik PDF/boş pafta/kısmi hata tespit edilir; ağ hatasında çıktı kaybolmaz.

## Faz 3 — Web modülü [kod ve görsel kontrol tamamlandı]

1. Menü ve yetki matrisi; sayfa başlığı mevcut kabuğa uyar.
2. Cihaz eşleştirme, bağlantı iptali, durum ve yeniden kontrol yönlendirmesi.
3. DWG seçimi, açık cihaz seçimi, baskı tercihleri ve kontrollü çalışma açıklaması.
4. Doğrudan Storage yükleme, kaynak doğrulama, kuyruğa alma.
5. İş geçmişi, canlı durum yenileme, yeniden deneme, iptal.
6. Sonuç ekranı: PDF bağlantıları, malzeme satırları, tanı/uyarılar ve kaynak bilgisi.

Kontrol K3: boş/hata/çevrimdışı/meşgul durumları, klavye ve 390px dar ekran;
yenilemede işler kaybolmaz; tarayıcı kapanışının yüklemeyi kesebileceği açıkça yazılır;
iş başladıktan sonra gezinme işlemi durdurmaz.

## Faz 4 — Teknik Resimler aktarımı [kod ve SQL kontrolü tamamlandı; pilot bekliyor]

1. Kullanıcı incelemesi ve açık onay; hedef paket adı ve iş kalemi seçimi.
2. Mevcut yükleme/tanıma sözleşmesi üzerinden PDF ve malzeme listesi aktarımı.
3. Aktarımın tekrar edilmesi kopya paket üretmez; yarım aktarım devam ettirilebilir.
4. Kaynak iş ve paket bağı saklanır. Satın alma ve teknik resim planı otomatik değişmez.

Kontrol K4: aynı onay iki kez verilince tek paket; eksik dosyada başarı yok;
adet/ağırlık değerleri yeniden çarpılmaz; mevcut teknik resim akışı ve testleri korunur.

## Faz 5 — Güvenlik ve kesinti kontrolleri [otomatik kontroller geçti; canlı senaryolar bekliyor]

1. Süresi geçmiş eşleştirme, iptal edilmiş cihaz, rol değişimi ve başka kullanıcı işi.
2. Aynı cihazda iki yardımcı, eşzamanlı iş alma, eski lease, eski sonuç teslimi.
3. Dosya boyutu, yol aşımı, desteklenmeyen uzantı, hash uyuşmazlığı, bozuk sonuç JSON.
4. İptal ve tamamlanma yarışı, yükleme kesintisi, AutoCAD hata penceresi.

Kontrol K5: kontrol sonuçları test raporuna yazılır; çalıştırılmayan senaryo geçti sayılmaz.

## Faz 6 — Bütünleşik doğrulama [yerel ve canlı API kontrolleri geçti; tam tarayıcı pilotu bekliyor]

1. TypeScript, hedefli ESLint, ilgili Vitest ve Python testleri.
2. Üretim derlemesi; mevcut hatalar ile yeni değişiklik kaynaklı hataları ayır.
3. Geliştirme önizlemesini masaüstü/dar ekranda görsel incele.
4. Migration testini geçtikten sonra yalnız yeni migration'ı uygula; diğer bekleyen
   migration'ları bu iş kapsamında çalıştırma.
5. Ortam izin veriyorsa gerçek DWG ile yardımcı → kuyruk → çıktı → web akışını doğrula.
   Açık kullanıcı çizimi varsa müdahale etme; gerçek test sınırını ayrıca kaydet.

Kontrol K6: kaynak DWG hash'i sabit; beklenen pafta/PDF sayısı; sonuç linkleri;
uygulama ve yardımcı sürüm uyumu; elde edilemeyen dış ortam kontrolleri açıkça raporlanır.

## Faz 7 — Teslim ve işletim [yerel teslim hazır; canlı kabul bekliyor]

1. Alan kuralları, manifest/harita, kurulum ve sorun giderme belgesi.
2. Yapılan işler, test kanıtları, sınırlamalar ve kalan pilot kontrolleri.
3. Kaynak kopyasının bütünlüğünü yeniden kontrol et.
4. Web üretim yayını, imzalı dağıtım ve çok bilgisayarlı pilot durumunu ayrı belirt.
   Yerel entegrasyonu tamamlamak canlı web sürümünün yayımlandığı anlamına gelmez.

Kontrol K7: çalışmayan özellik çalışıyor diye sunulmaz; teslim dosyaları ve yeni
bölümün adresi açıkça belirtilir. Kullanıcı talebi dışında başka modüller değiştirilmez.


## Gerçekleşen kontroller ve kalan kapı

Ayrıntılı kanıt ve pilot sırası: docs/cad-validation.md. 440 web testi, 27 Python testi, kod denetimleri ve yerel üretim derlemesi geçti. İki CAD migration uygulandı. Kaynak 22 dosya hash ile doğrulandı. Supabase CAD hizmeti sürüm 2 ve yardımcı 1.0.1 açık onayla yayımlandı. Canlı sentetik API testi ve yerel gerçek AutoCAD pilotu geçti (14 pafta, 49 malzeme). İki pilot henüz tek gerçek kullanıcı akışında birleştirilmedi. Bir test paketi ve bağlı test hesabının mevcut silme mekanizmasıyla temizliği için yönetici kimliği bekleniyor. Vercel yayını yapılmadı.
