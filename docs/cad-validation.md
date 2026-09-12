# Çizim İşleme — kontrol ve teslim raporu

Tarih: 12 Eylül 2026. Hedef: HESAP RAPORU KOD / orion-hesapraporu.

## Kullanıcı kontrolü sonrası — dosya seçimi ve kalıcı bağlantı

AutoCAD hazırlık uyarısında dosya girdisinin disabled olması seçim penceresini
engelliyordu. Seçim bu koşuldan ayrıldı; işleme gönderme koşulu korundu.
Birden çok DWG ve alt klasörleriyle klasör seçimi eklendi. Her DWG ayrı iş,
seçim başına 30 dosya, dosya başına 100 MB; destek dosyaları aktarılmaz.
Yarım yüklemede tamamlananlar seçili listeden çıkar, kalanlar tekrar edilebilir.
Bağlantı bir kez kurulur; kayıtlı bilgisayarda yeniden kod formu katlanır ve
başarılı eşleştirmeden sonra kod ekrandan kalkar. Windows yardımcısı değişmedi.
Dosya ve klasör girdilerinin attention/autocad_missing/unpaired durumlarında
açık olması, gönderimin kilitli kalması ve klasör filtreleri otomatik sınandı.

## Teslim durumu

Kaynak motor kopyalandı; `/cad` web bölümü, yerel Windows yardımcısı, özel
depolama ve iş kuyruğu şeması, inceleme/onay ve Teknik Resimler aktarımı kodlandı.
İki CAD migration'ı mevcut Supabase projesine uygulandı. Başka modüllerin bekleyen
migration'ları çalıştırılmadı. Canlı Vercel yayını yapılmadı.

`cad-api` Supabase'de ACTIVE, dağıtım sürümü 2. Windows yardımcısı 1.0.1 özel
depoya yüklendi ve geri indirilen dosyanın hash'i doğrulandı. Dağıtım ve geçici
kayıt testleri kullanıcı tarafından ayrı ayrı açıkça onaylandı.

**Üretim web yayını yapılmadı.** Gerçek AutoCAD yerel pilotu ve canlı sentetik
API akışı ayrı ayrı geçti; gerçek kullanıcı tarayıcısı → yardımcı → AutoCAD →
Teknik Resimler tam akışı ve çok bilgisayarlı pilot henüz tamamlanmış sayılmıyor.
Test temizliğinde bir korumalı paket ve ona bağlı test hesabı yönetici kimliği
bekliyor. Aşağıdaki temizlik bölümünde kesin kapsam yazılıdır.

## Kanıt tablosu

| Kontrol | Sonuç | Kapsam / sınır |
|---|---|---|
| Kaynak bütünlüğü | Geçti | Manifestteki 22 dosyanın orijinal ve hedef kopya SHA-256 değerleri aynı. |
| Web regresyonu | Geçti | 17 dosyada toplam 440 Vitest testi; CAD, Teknik Resimler ve roller. |
| Yardımcı testleri | Geçti | 8 Python testi: dosya adları, HTTPS ve Storage hedefi, eksik/tekrar PDF, sonuç/hash, uyumlu Excel ve formülün metin olarak korunması. |
| Kopyalanan motor | Geçti | Mevcut 19 Python testi. |
| TypeScript | Geçti | Tüm uygulamada noEmit kontrolü. |
| ESLint | Geçti | Yeni CAD kütüphanesi, web sayfaları, cihaz rotası ve önizleme. |
| Üretim derlemesi | Geçti | Yerel Next.js üretim derlemesi; yayın anlamına gelmez. |
| Veritabanı kuralları | Geçti | Gerçek PostgreSQL üzerinde geri alınan test işlemi: sekiz rol, RLS, sahiplik, tek kullanım, iptal, eski deneme, süre aşımı, tek paket. |
| İş alma yarışı | Geçti | Canlı API'ye iki eşzamanlı istek: yalnız biri işi aldı. Çok bilgisayarlı yük testi ayrıca gerekli. |
| Masaüstü ve dar ekran | Geçti | Geliştirme önizlemesinde masaüstü ve 390px; malzeme araması, yatay taşma ve tarayıcı hataları kontrol edildi. |
| Windows paketleme | Geçti | Tek EXE üretildi; `--self-test` bağımlılık yükleme ve temel doğrulama ile sıfır kodla çıktı. |
| Gerçek AutoCAD / EXE | Geçti | AutoCAD 25.0s; 14 pafta, 49 malzeme, 14 ayrı PDF ve bir birleşik PDF. 47,5 saniye; sıfır motor hatası; kaynak hash sabit; AutoCAD sonunda hazır. |
| Excel uyumluluğu | Geçti | Gerçek pilotun 49 satırı mevcut Teknik Resimler okuyucusuyla okundu. Parça, açıklama, malzeme, adet, birim ağırlık ve kaynak pafta birebir aynı. |
| Edge çalışma ortamı | Geçti | Supabase paket kontrolü, dağıtım, oturumsuz/yanlış cihaz anahtarı reddi ve yerel web cihaz rotası. |
| Canlı sentetik akış | Geçti | İki kullanıcı; eşleştirme, tekrar kullanım reddi, imzalı dosya, claim yarışı, RLS, eksik PDF reddi, review, onay, tek paket, eksik aktarım reddi, helper indirme, cihaz iptali. |
| Gerçek uçtan uca iş | Kısmi | Gerçek AutoCAD yerelde; sunucu akışı yapay dosyalarla doğrulandı. Tarayıcıdaki tam aktarım/import/uzlaştırma pilotu yapılmadı. |

## Yardımcı paketi

- Dosya: `desktop/cad/dist/OrionCadYardimcisi.exe`
- Sürüm: 1.0.1, protokol: 1, Windows x64.
- Boyut: 42.770.829 bayt.
- SHA-256: `2b0dc9f8b71ac4145ea9aca3d176c0c504b244c9b7a4e9feb789c9e5eb9aa353`
- Kod imzalı değildir. Paket üretilmiş olması tüm Windows/AutoCAD sürümleriyle
  uyumluluk onayı değildir. Yeni derlemede hash değişirse bu kayıt yenilenir.

## Kurulum aktarımının somut kapsamı

`scripts/cad-deploy.cjs --prepare`, `tmp/cad-api-package/` içinde yalnız
`index.js`, `service.js`, `contracts.js`, `roles.js` üretir. Dağıtım bu dört
dosyayı mevcut Supabase projesindeki yeni `cad-api` fonksiyonuna gönderir.
Müşteri DWG/PDF dosyaları veya ortam dosyaları pakete konulmaz.

`scripts/cad-release.cjs --upload`, yukarıdaki tek EXE'yi özel kovadaki
`releases/1.0.1/OrionCadYardimcisi.exe` yoluna gönderir. Farklı içerikte mevcut
dosyanın üzerine yazmaz; indirdiği kopyanın SHA-256 değerini doğrular.
Bu iki ağ işlemi açık kullanıcı yetkisiyle tamamlandı. Önceki 1.0.0 paketi
ezilmedi; güncel indirme bağlantısı 1.0.1'i kullanır.

## Gerçek pilotta bulunan ve giderilen uyumsuzluklar

1. Birleşik PDF de çıktı klasöründeydi. Artık Teknik Resimler aktarımı yalnız
   sonuçta listelenen ayrı paftaları alır; birleşik dosya indirmelerde korunur.
2. Motorun malzeme raporu başlıkları mevcut BOM okuyucusuna uygun değildi;
   rapordaki Paftalar sayfası da fazladan BOM satırı sayılabilirdi. Yardımcı
   1.0.1 tek BOM sayfalı CAD_MALZEME.xlsx üretir. Orijinal rapor değişmez;
   aktarım uyumlu dosyayı kullanır. Adet ve ağırlık yeniden hesaplanmaz.
3. Kaynak DWG metni uyumlu Excel'de formül değil metin hücresi olarak yazılır.

Yerel gerçek pilot çıktısı:
`C:/Users/HP/Downloads/Proje Ayıklama/integration-work/local-pilot/9ea2f04d-358f-4da5-88d3-1011f30f2def/`.
Kaynak DWG SHA-256:
`f57cdfdb35df34e7d14d5d40d31b8e581e1ad66effbd2c25e9867caf2d4ce822`.
PDF okuyucu birleşik dosyada tekrarlanan PageMode sözlüğü uyarıları verdi;
dosyalar okunabildi. PDF görsel kalite onayı ve ölçek bulguları kullanıcı
incelemesinin yerine geçmez. Müşteri DWG'si buluta yüklenmedi.

## Geçici test kayıtlarının temizliği

Test işi, çıktı kayıtları, özel depodaki yapay dosyalar, test cihazı/anahtarı ve
ikinci test hesabı kaldırıldı. Mevcut uygulamanın guard_approved_deletion koruması
paketin doğrudan silinmesini reddetti. Koruma devre dışı bırakılmadı.

Yalnız şu iki kayıt kaldı; kullanıcının yönetici e-posta kimliği bekleniyor:

- Paket: `6a4ee628-9698-4a9b-9e57-090de120a8b2` — CAD GEÇİCİ KABUL TESTİ.
- Bağlı test hesabı: `8e8a75c3-b9fb-47ad-be9a-3ea1600cc369`.

Temizlik, belirtilen yönetici adına mevcut request_deletion / approve_deletion_request
işlevleri üzerinden yalnız test paketini silmeli, ardından bağlı test hesabı
kaldırılmalıdır. Başka kullanıcı veya paket seçilmemelidir. Onay kaydı gerçek
yönetici kimliğiyle ilişkilendirilmeli; rastgele yönetici varsayılmamalıdır.
Test hesabını uzun süreli banlama önerisi otomatik denetim tarafından reddedildi
ve uygulanmadı; kapsamı daraltılmış, önceden onaylı temizlik adımları geçti.

## Pilot kabul sırası

1. CAD hizmetini dağıt; oturumsuz web ve geçersiz cihaz anahtarının reddini doğrula.
2. Yardımcıyı yükle; yetkili kullanıcının indirmesini ve hash değerini kontrol et.
3. Gerçek kullanıcı hesabında bir bilgisayar eşleştir; kodun ikinci farklı
   anahtarla kullanımının reddedildiğini doğrula.
4. AutoCAD kurulu olmayan ikinci bilgisayarda uyarıyı; açık kullanıcı çizimi
   bulunan bilgisayarda işin başlamadığını doğrula. Kullanıcının çizimini kapatma.
5. Kullanıcının uygun bulduğu, dış referans içermeyen küçük DWG ile ilk iş:
   orijinal hash sabit, doğru pafta/PDF sayısı, açılabilir PDF, doğru malzeme satırları.
6. Ağ kesintisi, webden iptal ve yardımcı yeniden başlatmayı ayrı dene. Yerel
   sonuçlar korunmalı; eski deneme yeni işin üzerine yazmamalı.
7. Onayla ve Teknik Resimler'e aktar. Eksik dosyada tamamlandı olmamalı. Aynı
   aktarımı yinele: tek paket kalmalı, sonradan düzenlenen satırlar korunmalı.
8. Bu pilot geçtikten sonra hedef AutoCAD sürümleri, kurum font/CTB ayarları ve
   daha büyük dosyalarla kapasite ölçümü yap. Sonra normal Vercel yayın sürecine geç.

## İlk sürümün bilinçli sınırları

Tam AutoCAD ve Windows etkileşimli oturumu gerekir; AutoCAD LT/macOS kapsam dışıdır.
İlk pilot dış referanssız tek DWG kullanır. Kaynak 100 MB, sonuç JSON 2 MB,
pafta 1000 ile sınırlıdır. AutoCAD işlem süresi 20 dakikadır. Yardımcı penceresi
açık kalır; bilgisayar kapanınca işlem devam etmez. Yeniden açılış eski işi
otomatik canlandırmaz; yeni deneme webden başlatılır.

Yerel çıktılar ve bulut dosyaları otomatik temizlenmez. İleri sürümde saklama
politikası, kota takibi, imzalı/otomatik yardımcı güncellemesi, Xref paketleme,
AutoCAD sürüm matrisi ve ekip paylaşımı ayrıca ele alınmalıdır.

Zaman aşımında yalnız yardımcı alt süreci durdurulur. AutoCAD'deki geçici iş
çizimi ve FILEDIA/CMDDIA/BACKGROUNDPLOT ayarları elle kontrol gerektirebilir.
Bu durum başarı olarak gösterilmez.

## 12 Eylül 2026 — Yardımcı 1.0.2 / boş başlangıç çizimi

AutoCAD açılışta Drawing1 oluşturuyordu; önceki tüm açık belgeleri reddeden
kontrol kendi açtığı oturumu da durduruyordu. Artık adsız, değiştirilmemiş,
modeli boş ve layoutlarında yalnız viewport bulunan başlangıç belgesi açık
kalabilir. Yardımcı bu belgeyi kapatmaz. Kayıtlı, düzenlenmiş, içerikli veya
COM üzerinden güvenle okunamayan belgeler işlemi engeller. Ön kontrol ve
gerçek DWG açma anında aynı koruma çalışır. Geçici RPC reddi sınırlı tekrar edilir.

- Yardımcı: 12 test geçti; CAD web kuralları: 32 test geçti.
- Yeni EXE --self-test: 0; 22 kaynak motor dosyasının hash değerleri değişmedi.
- Gerçek AutoCAD 2025 (25.0s): boş Drawing1 açıkken hazır; örnek DWG'nin
  geçici kopyası 77 saniyede 14 pafta, 49 malzeme satırı ve 14 başarılı pafta
  PDF'i üretti. Birleşik PDF dahil 15 PDF / 28 sayfa okunabildi, hata sayısı 0.
- Orijinal DWG hash değeri değişmedi; işlem sonrası yeniden hazır. Buluta
  örnek DWG gönderilmedi. İlk pilot çağrısındaki göreli dosya yolu test
  betiğinde mutlak yola çevrilerek tekrarlandı; üretim işleri mutlak yol kullanır.
- AutoCAD PDF'lerinin PageMode yinelenme uyarıları ölümcül değil; tüm sayfalar okunabildi.
- Kullanıcı mevcut 1.0.1 yardımcısını kapatıp webden 1.0.2 indirmeli. Aynı
  Windows hesabının DPAPI bağlantı kaydı korunur; yeniden eşleştirme gerekmez.

## 12 Eylül 2026 — Yardımcı 1.0.3 / yeniden eşleştirme

Eski cihaz kaydı olan yardımcı yeni kodu denemeden engelliyordu. Pair akışı
eski iş parçacıklarını durdurup yeni kodu doğrular, başarılı yanıttan sonra
kaydı değiştirir. Hatalı kodda kayıt korunur; eski süreçler sonlanmışsa kayıtlı
bağlantı duraklatılmış olarak yeniden açılır. İşler/çıktılar silinmez.
15 yardımcı testi geçti: yeniden bağlantı sırası, başarısız kodda kayıt koruma,
aktif iş engeli ve eski iş parçacıklarını bekleme dahil. AutoCAD motoru değişmedi.

## 12 Eylül 2026 — Yardımcı 1.0.4 / ardışık pafta baskısı

Kullanıcının KANCA BLOĞU iş günlüğünde ilk PDF başarılı, kalan 16 pafta
RPC -2147418111 nedeniyle başarısızdı. Aynı yerel kaynak dosyanın ayrı kopyası
yeni EXE ile AutoCAD 2025 üzerinde test edildi: 84,2 saniye, 17/17 başarılı
pafta, 45 malzeme satırı, sıfır işlem hatası. Birleşik dahil 18 PDF / 34 sayfa
okundu. Kaynak SHA-256 b05cc68ca295bf35707484793d7e65d929cfa66f679e84b4f326ce4670718566
değişmedi. Bulut iş kaydı ve orijinal dosya değiştirilmedi; işlem sonrası hazır.
18 yardımcı testi ve EXE self-test geçti. Kaynak motor değiştirilmedi.
0063-00-0804 antet/çerçeve ölçek farkı bulgusu korunuyor; bu baskı hatası değildir.
Yeni sürümde başarısız iş mesajı varsa üretilen pafta sayısını da belirtir.

## 12 Eylül 2026 — İşlem geçmişi filtreleri ve yazdırma

36 CAD testi ve TypeScript kontrolü geçti. Filtre/sahiplik birlikteliği,
100'den eski sayfaya erişim, tarih sınırı, özel arama karakterleri, güncel
deneme PDF'si ve başarısız/eksik birleşik çıktı reddi test edildi. Tarayıcı
önizlemesinde filtreler, sayfalama ve tamamlanan DWG satırındaki birleşik PDF
bağlantısı doğrulandı. Fiziksel yazıcıya çıktı gönderilmedi. Yardımcı sürümü
1.0.4 olarak kalır; yeniden indirme gerekmez.

## 12 Eylül 2026 — Sekmeler, otomatik hazırlık ve teknik baskı / 1.0.5

- Yeni işlem, işlem geçmişi, sonuçlar ve bilgisayarlar ayrı sekmelerde.
  Tarayıcı önizlemesinde yazarken arama (2 → 1 kayıt), geçen ay (0 kayıt),
  temizleme (2 kayıt), ay/tarih alanlarının birlikte değişmesi ve sonuç sekmesine
  geçiş doğrulandı. Dosya/klasör seçimi ayrı düğmelerle ve DWG sürükleme alanıyla sunulur.
- Kaldırılmış cihazlar sunucuda filtrelenir; eski işler silinmez. Türkiye tarih
  sınırları, artık yıl ve önceki yıl/ay kısayolları dahil 37 CAD testi geçti.
- Yardımcı kayıtlı bağlantıyla otomatik izlemeye başlar. Hazırlık geçici olarak
  engellendiğinde izleme sürer; durum değişikliği heartbeat beklemeden bildirilir.
  Elle duraklatma, yeniden eşleştirme ve gerçek kullanıcı çizimlerini koruma
  dahil 20 yardımcı testi geçti. Web görünürken yenileme 5 saniyedir.
- ACI 7 siyah 0.35 mm, diğer indeks renkler siyah 0.13 mm. ezdxf float32
  eşitlik araması tekrar indeks ürettiği için standart 27 CTB indeksi kullanılır.
  İlk görsel kontrolde yakalanan aşırı kalın ölçüler bu düzeltmeyle giderildi.
- PDFSHX COM değişkeni VT_I2 ile 2 yapılır (eski sürümde 0). Başlangıç değeri
  normal kapanışta geri yüklenir. Yalnız açılan geçici DWG kopyası kapatılır.
- Son dağıtım EXE'si AutoCAD 2025'te KANCA BLOĞU kopyasını 200.2 saniyede
  17/17 pafta ve 45 malzeme satırıyla tamamladı. Birleşik PDF dahil tüm çıktılarda
  AutoCAD SHX yorum sayısı 0. Örnek pafta render edilerek ana/yardımcı çizgi
  ayrımı ve yazı okunaklılığı incelendi. Orijinal kaynak hash değişmedi.
  Önceki iki denemede kullanıcı AutoCAD'i kapattığını bildirdi; bunlar başarı
  sayılmadı ve kullanıcı oturumu açık bıraktıktan sonra yeniden test edildi.
- EXE self-test 0; 22 kaynak motor dosyası değişmedi. Ayrılmış yayın kodunun
  Next.js üretim derlemesi ve TypeScript kontrolü geçti. Mevcut libheif-js
  dinamik require uyarısı CAD değişikliğinden bağımsız olarak sürüyor.
- Fiziksel yazıcı testi yapılmadı. Eski bulut PDF'leri değiştirilmez; yeni baskı
  görünümü için eski DWG yeniden işlenir. Kullanıcı eski yardımcıyı kapatıp
  1.0.5 indirmelidir; DPAPI bağlantı kaydı korunur.
