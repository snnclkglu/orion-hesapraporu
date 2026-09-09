# Hızlı seçim — ek fazların uygulama ve teslim kaydı

09.09.2026 · Seçim 1.1.0 · Hesap motoru 0.8.0 · Başlangıç `3ed89a4`

Kullanıcı ek fazları, commit ve push yapılmasını onayladı. Bu dosya [ikinci denetimden](HIZLI_OTOMATIK_SECIM_EK_FAZLAR.md) sonraki durumu anlatır. İlk uygulamanın tarihsel ölçümleri [ayrı belgede](HIZLI_OTOMATIK_SECIM_UYGULAMA.md) korunur.

## Fazların durumu

| Faz | Uygulanan yazılım | Kapanış sınırı |
|---|---|---|
| 10 — Teknik talep ve teklif bağı | Tek talep sözleşmesi; boş kritik girdiler; DIN kanca standardı/kilit çatışması; fren/aparat eşlemesi; eski kapasite/açıklık/hız aktarımının reddi; kopya ve yeni revizyonun bağımsız hesabı; yayımlanmış kaynaktan yeni taslak | B1, B2, B4 regresyonları kapandı. Kaynak olmadan mekanizma sınıfı veya imalat ölçüsü üretilmez. |
| 11 — Bağlı arama | Motor/redüktör/fren/kaplin ve mil/rulman/yatak zinciri aday elemeden önce sınanır. Kapasiteler ortak motordan alınır. Bilinmeyen kütle sıfır maliyet avantajı sağlamaz. | B3 kapandı. 20 redüktörlü sentetik tam tarama karşılaştırması uygun son beş adayı bulur. Arama sınırlıdır; küresel optimum kanıtı değildir. |
| 12 — Marka ve üretici | Ayrı kaldırma/yürütme frenleri ve motor/teker kaplinleri; aile filtreleri; kaynaklı DYF seri desteği; kasnak çapı eşleşmesi; açık motor gerilim/frekans sınırları; belgeli dış kontrol formu | Üretici verisi bulunmayan çalışma noktaları tamamlanmış sayılmaz. Disk servis freninin bağımsız fiziksel modeli açık kapsamdadır. |
| 13 — Ölçü ve kütle | Sürümlü aday serisi; küçültme/büyütme; teker/kanca milinde mutlak stok serisi; kilitler; ağırlık defteri ezmeleri/notları; dört turlu kütle döngüsü; kaynak ağırlık değişiminin denetimi | Seri imalat onayı değildir. Halat donanımı, fiziksel adetler, ray/aks yerleşimi ve eksik kütleler açık tasarım kabulleridir. Her aile için onaylı yerleşim profili çıkarılmış değildir. |
| 14 — Özel tipler | Portal, açık saha, ikinci kiriş, aparat, ikiz/çift tambur ve birlikte kaldırma için ayrı kapsam kontrolleri; seçim öncesi görünürlük; kaynaklı dış hesap kaydı | Portal ayakları, park ankrajı, devrilme ve ikinci kirişin ayrı burkulma modeli bu teslimde eklenmedi. Bu başlıkların tam mühendislik çıkış ölçütü kapanmadı. |
| 15 — Doğrulama ve performans | Regresyonlar, gerçek katalog matrisi, sunucu kayıt/rol testleri, gerçek DB testleri, mobil/masaüstü önizleme, iptal, salt okunur rapor, sürümlü filtreli katalog ve Git teslimi | Yazılım testleri bağımsız mühendis kabulü değildir. Oturumlu gerçek teklif akışının son kullanıcı kabulünü kullanıcı gerçekleştirecek. |

## Teknik talep ve revizyon politikası

- Kritik boş teklif değerleri `null` kalır; JSON kayıt/yükleme turu bunları 10 tonluk şablonla doldurmaz.
- DIN 15402 talebi o ürün ailesini zorunlu kılar. Kilitli DIN 15401 sessizce değiştirilmez. Özel aparatın yerine standart kanca seçilmez.
- Normalize talep değerleri ve parmak izi saklanır. Teklifte sonradan silinen talep temizlenir; baştan boş olup raporda tamamlanan alan yeniden açılınca kaybolmaz.
- Teklif ve kaynak hesabın kapasite/açıklık/hız/kanca/fren/ortam uyuşmazlığında geri aktarım durur. Farklı araba/köprü fren tipleri ortak alanda sessizce birleştirilmez.
- Teknik güncellemede manuel alanlar, alternatifler, notlar ve ağırlık defteri korunur. Teklif ve hesap snapshot'ları aynı SQL işleminde karşılaştırılır.
- Kopyada `calculationSource` derin kopyalanır; düzenlenebilir rapor ilk açılışta bağımsız oluşturulur. Yeni teklif revizyonu DB tetikleyicisiyle bağlı hesapları da atomik kopyalar. Eski inceleme onayı taşınmaz.
- Teklif bağlantıdaki belirli hesap revizyonunu okur; projedeki rastgele en son revizyonu kullanmaz. Yayımlanmış hesap değişmez; yeni taslak açılır ve bağlantı ilerler.
- Ağırlık defterinin kalıcı alanları da kaydedilmemiş değişiklik sayılır. Kayıt sırasında yapılan yeni düzenleme kaydedilmiş gibi gösterilmez.

## Üretici verisi

| Ekipman | Otomatik kontrol | Kaynak eksikse kalan kontrol |
|---|---|---|
| Motor | Güç/devir/mil, açık katalog gerilimi/frekansı, gerçek çalışma hızı | Görev çevrimi, saatlik kalkış, sürücü/montaj, ortam koşulları |
| Redüktör | Çalışma noktası, oran, çıkış torku, radyal yük, miller; varsa termik güç | Projeye uygun termik kapasite, montaj/yağlama ve çevrim |
| Kasnaklı fren | Fiziksel aile, tork, kasnak çapı ve kaplindeki aynı çap/seçenek | Duruş enerjisi, çevrim, balata/ortam ve itici beslemesi |
| DYF freni | Yay baskılı/enerjiyle açılan seri kimliği ve katalog torku | Gerçek montaj, bobin gerilimi, açma zamanı, çevrim/ısıl enerji |
| Kaplin | Tork, azami/asgari göbek, mil çapları, mevcut azami devir ve tamburda radyal yük | Eksik devir, göbek/kaçıklık ve imalat bağlantısı |
| Rulman/yatak | Ortak motorun ömür/yük kontrolleri, tam oturma çapı, marka/yatak uyumu | Yerleşim ve imalat teyidi |

1.1.0 kontrol kaydı kaynak adı, sayfa/model/revizyon, yöntem ve sonuç ister. Termik güç ve kaplin devri için ayrıca hesabın gereken değerine ulaşan doğru birimli sayısal sınır gerekir. Hatalı değer/birim veya eski hesap hash'i geçersizdir. Kontrol eden kullanıcı sunucuda atanır. Önceki 1.0.0 kayıtları eski sözleşmesiyle okunur. Hiçbir metin girişi başarısız sayısal hesap veya ölçü teyidini geçerli yapmaz.

Yeniden incelenen kaynaklar:

- Üst çalışma klasöründeki `FEM 1.001 3rd Edition.pdf`: Kitapçık 2 yükler, §2.2.4.1 rüzgâr ve Kitapçık 6 stabilite. Saha rüzgâr basıncı/aparat alanı uydurulmadı.
- `SIBRE DETAY KATALOGLAR/TE 2021_EN.pdf`: sayfa üzerinde **M9001000E-EN-2008-02** bulunuyor; dosya adı belge revizyonu sayılmadı. DIN 15435, sürtünme koşulu, kasnak/tork ve itici hariç ağırlık dipnotu görsel olarak kontrol edildi. [SIBRE resmi belgeleri](https://www.sibre.de/downloads/).
- `ZKES 2021_EN.pdf`: bağlantı/delik, ağırlık ve ataletin konfigürasyona bağlılığı incelendi; bilinmeyen kaplin devri eklenmedi.
- `catalog_data/brakes/dereli_dyf_em.json` seri künyesi, [Dereli resmi ürün bilgileri](https://derelifren.com.tr/) ve [teknik tavsiyeleri](https://derelifren.com.tr/teknik-bilgiler/genel-bilgiler-ve-tavsiyeler). Genel seri bilgisi proje montaj/ısıl onayı yerine geçmez.
- `catalog_data/motors/sew_ac.json`: 19290411/EN 10/2014 künyesi ve nominal koşullar. Genel künye bütün modellere rastgele yeni kapasite alanları olarak yazılmadı.

## Kabul matrisi ve performans

Gerçek katalog **71.539 satır**. Süreler ağ indirmesini içermez; cihazdan bağımsız garanti değildir. [Makine tarafından okunabilir özet](HIZLI_OTOMATIK_SECIM_KABUL_MATRISI.json).

| Senaryo | Arama | Değerlendirme | Seçim | Engelleyici kontrol |
|---|---:|---:|---:|---:|
| 10 t / 20 m / M6, manyetik | 5,71 sn | 5.224 | 29 | 2 ölçü teyidi |
| 10 t / 20 m / M6, Eldro | 5,61 sn | 5.240 | 29 | 2 ölçü teyidi |
| 3,2 t / 12 m / M4 | 5,56 sn | 4.237 | 29 | 2 ölçü teyidi |
| 25 t / 25 m / M7 | 6,25 sn | 7.105 | 29 | 2 ölçü teyidi |
| 50 t / 30 m / M8, DIN 15402 | 7,55 sn | 12.958 | 25 | 8; eksik sonuç korunur |
| GAMAK tercihi | 4,12 sn | 3.244 | 29 | 2 ölçü teyidi |
| İkiz donanım | 4,60 sn | 5.224 | 29 | 2 + ayrı çalışma senaryosu |
| Açık portal | 4,52 sn | 5.224 | 29 | 2 + yapı/rüzgâr kapsamı |

Sekiz çalışmada arama bütçesi dolmadı. Kütle/üretici koşulları eksik sonuçlar `incomplete` kaldı; sayısal geçiş mühendis onayı sayılmadı.

Popup ürün satırlarını indirmez: **102 aile, 9.649 bayt** DB özeti. Başlatılınca gerekli tür/marka/uygulama satırları yüklenir. Kaldırmada FLENDER, yürütmede Yılmaz seçimi 62.427 redüktör yerine ilgili **20.916** satırı kapsar. Son iki filtre/sürüm önbelleğe alınır; kullanımda yetki/sürüm yeniden denetlenir. Eksik, yinelenen veya sürümü karışık aktarım saklanmaz. API `private, no-store` kullanır. Gerçek mobil bağlantıda soğuk ağ süresi henüz ölçülmedi.

- Özellik/API/kayıt kontrolleri: **68/68 geçti**, sekiz gerçek katalog senaryosu dahil.
- Regresyonlar: eski teklif talebi, kanca, 20 redüktörlü tam tarama, kopya izolasyonu, boş girdiler, yanlış fren/kaplin kasnağı, termik sınır, mutlak mil serisi ve tekrar kararlılığı, ağırlık ezmeleri.
- Supabase: gerçek rol/RLS ile `BEGIN/ROLLBACK` içinde tekrar açma, teklif/hesap çakışması, teknik güncelleme, manuel alan/not, kopya, yeni teklif revizyonu, yayımlanmış kaynaktan taslak, yetkisiz rol ve anonim RPC. Kalıcı test işi/ürünü oluşturulmadı.
- Tarayıcı: popup → worker → taslağa uygulama → düzenlemeye dönüş; iptal taslağı korur; 390 × 844 ve 1280 × 900; salt okunur raporda düğme yok; tarayıcı hata kaydı yok.

## Veritabanı ve geri dönüş

Önceki iki migration korunarak bu turda `20260909000002`, `20260909000003`, `20260909000004` uygulandı. Uygulanmış dosyalar değiştirilmedi. Son ikisi katalog okuma RPC'leridir. Yaşam döngüsü migration'ı bağımsız hesap kopyaları ve yalnız bağlantının `revision_id` sütununa güncelleme izni ekler. Tetikleyici fonksiyonuna doğrudan kullanıcı/anon çağrısı kapalıdır.

`AUTO_SELECTION_ENABLED=false` yeni katalog işlemlerini kapatır; mevcut rapor ve manuel editör kullanılabilir. Geri dönüş veri silmeyi gerektirmez.

## Açık mühendislik kabulü

Bu teslim bütün vinç tipleri için otomatik imalat onayı değildir. Somut dış bağımlılıklar: model/çalışma noktasına özel termik ve montaj verileri, eksik ürün kütleleri, firma onaylı donanım/aks/ray profilleri, portal/rüzgâr/ankraj ve ikinci kiriş hesapları, bağımsız mühendis referansı. Belge/değer olmadan tamamlanmış işaretlenmediler. Kullanıcı mevcut raporda düzenleme yapıp kaynaklarını kaydedebilir.

## Teslim doğrulamaları

- `npm run build`: geçti; üretim derlemesi ve Next.js TypeScript aşaması tamamlandı. Çakışan eski `.next/dev/types` / `.next/types` dosyaları yalnız depo içindeki üretilmiş dizinlerden temizlendi.
- `npx tsc --noEmit --pretty false`: geçti.
- Son revizyon karşılaştırma kontrolü: üretici belgesinin sayısal sınırı değiştiğinde aynı sonuç notuyla da fark görünür. İlgili iki test dosyası 16/16 geçti; son değişiklikten sonra TypeScript kontrolü tekrar geçti.
- Seçim/API/kayıt testleri: 68/68 geçti. Son genel `npm test`: 3.837 geçti, 4 başarısız, 9 atlandı. Üç kalıcı eski hata `excel/drawing-summary.test.ts` içindeki iki başlık beklentisi ve `weights/dokum.test.ts` içindeki Esit ağırlık beklentisidir; önceki denetimde temiz başlangıç revizyonunda da görülmüşlerdi.
- Dördüncü genel test hatası, eşzamanlı derleme altında `pdf/offer.test.tsx` için 5 saniyelik süre aşımıydı. Dosya tek başına tekrar çalıştırıldı: 41/41 geçti. Genel paket tamamen yeşil diye sunulmuyor.
- Yeni seçim, API, teklif hesap eylemi ve bileşenlerinin ESLint kontrolü geçti. Belge denetleyicisi: hata yok, mevcut 10 yol/ifade uyarısı.
- `git diff --check` geçti. Kaynak, script, belge ve migration dosyalarında gerçek PAT/API token desenleri bulunmadı. `.env` ve yerel katalog/test çıktıları commit kapsamına alınmaz.
- Teslim dalı `main`; `origin/main` ile başlangıç farkı 0/0. Commit ve push kullanıcı tarafından açıkça onaylandı; kesin teslim commit'i Git geçmişinde ve son yanıtta belirtilir.
