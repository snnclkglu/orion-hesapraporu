# İşletme ve Bakım El Kitabı — yeniden tasarım ve kontrol planı

Tarih: 12.09.2026. Pilot: **0026-01 / ASTOR A.Ş.**

Bu belge kod, yerel referans PDF, mevcut PDF üretimi ve 0026-01'in salt okunur canlı veri incelemesine dayanır. Bu aşamada ürün kodu, şablonlar ve canlı kayıtlar değiştirilmedi. Aşağıdaki maddeler uygulama planıdır; tamamlanmış özellikler değildir.

## 1. Hedef ve tasarım kararı

El kitabını, operatörün ve bakım personelinin gerekli bilgiyi kolayca bulduğu; fotoğraf, şema, talimat ve çizelgelerin birbirini açıkladığı profesyonel bir teknik dokümana dönüştürmek.

Önerilen çözüm: mevcut proje, revizyon, kaynak ve ek altyapısını koruyarak **dokümanın görsel dilini, içerik bileşenlerini ve sayfalama düzenini yenilemek**. Editörü de bu yeni içerikleri kolay ekleyebilecek şekilde geliştirmek.

Standart işte kullanıcı büyük ölçüde hazır belgeyi kontrol eder. Ayrıntılı işte herhangi bir bölümün arasına fotoğraf, açıklama, işlem adımları veya tablo ekler. Her iş için bütün yapıyı yeniden düzenlemesi gerekmez.

Başarı ölçüsü yalnız sayfa sayısının azalması değildir: daha rahat okuma, doğru bölümde doğru görsel, hızlı bilgi bulma ve özelleştirmelerin kaybolmaması birlikte değerlendirilir.

## 2. İncelemenin kapsamı ve kanıtları

### 2.1 İncelenen katmanlar

| Katman | Başlıca dosyalar | İşlevi ve tasarıma etkisi |
|---|---|---|
| Alan kuralları | `AGENTS.md`, `docs/agent/elkitabi.md`, `docs/agent/belge.md` | Mevcut kullanıcı kararları, belge kimliği ve revizyon sözleşmeleri |
| Belge modeli | `src/lib/manual/types.ts`, `payload.ts`, `template.ts`, `template-kit.ts` | Bölüm ağacı, yedi blok türü, eski kayıt okuma, filtreleme ve numaralama |
| Düzenleme | `src/lib/manual/edit-ops.ts`, editörde `use-manual-doc.ts` | Saf ağaç işlemleri, blok kimlikleri, elle düzenlenen içerik |
| Kaynaklar | `src/lib/manual/sources.ts`, `autofill.ts`, proje altında `manual/sources-data.ts` | Canlı otomatik tablolar ile snapshot'a yazılan türetilmiş içeriğin ayrımı |
| Kapsam ve tekrar kullanım | `packages.ts`, `books-data.ts`, `maintenance-rules.ts`, `lubrication-rules.ts`, `admin/manual/*` | Paketler, kullanıcı sapmaları, bakım/yağlama defterleri, metin parçaları |
| Editör | `manual-editor.tsx`, `editor/tomar.tsx`, `block-view.tsx`, `inspector.tsx`, `document-map.tsx`, `slash-menu.tsx`, medya seçicileri | Harita, yerinde düzenleme, blok arası ekleme, kâğıt ve kapsam yüzleri |
| Sayfalama | `src/lib/manual/pdf-layout.ts` | İçeriği atomlara, sütunlara ve sayfalara dağıtan ortak çekirdek |
| Çizim | `src/lib/pdf/manual.tsx`, `src/components/manual/manual-paper.tsx` | Aynı sayfa planının PDF ve HTML çizicileri; stiller ayrı yerlerde |
| Teslim | `manual/actions.ts`, `[revId]/pdf/route.ts`, `src/lib/pdf/merge.ts` | Kaydetme, yayım, tablo dondurma, ek çözme, birleştirme ve bağlantılar |
| Doğrulama | `src/lib/manual/__tests__/*`, `scripts/test-manual-pdf.ts`, `scripts/check-manual-layout.py` | İçerik, geriye uyumluluk, düzenleme ve PDF kontrolleri |

Proje altındaki dosyaların kökü: `src/app/(app)/projects/[id]/manual/`.

### 2.2 Referans belge

Yerel `ÖRNEK Konecranes-KC-IPC-002-Crane-Operators-Manual.pdf` 112 fiziksel sayfa içeriyor. Ana kılavuzun kendi sayfa zinciri 75 sayfa; ardından ayrı dokümanlar geliyor. Karşılaştırmada fiziksel PDF sayfasıyla ek dokümanın yerel numarası karıştırılmamalı.

İçindekiler ve metin yapısı incelendi; özellikle fiziksel 12, 37, 44 ve 58. sayfalar görsel olarak değerlendirildi:

| Örnek | Tasarımda alınacak ilke |
|---|---|
| Sayfa 12: vinç genel görünüşü, numaralı parça işaretleri ve açıklama tablosu | Şema üzerindeki numara ile açıklama satırının doğrudan eşleşmesi |
| Sayfa 37: hareket görseli, kısa açıklama ve belirgin uyarı bantları | Talimatın yanında ilgili görsel ve uyarı |
| Sayfa 44: numara, açıklama ve görselden oluşan işlem satırı | Görsel ile metnin birlikte taşınabilen bir içerik birimi olması |
| Sayfa 58: görselli yağlama talimatları | Uzun paragraf yerine taranabilen görev satırları |

ORION kimliğiyle özgün bir görsel dil kurulacak. Referansın teknik içeriği 0026 için doğrulanmış talimat kabul edilmeyecek. Referanstaki geniş boşluklar gibi her tercih de aynen alınmayacak.

### 2.3 0026-01 canlı başlangıç durumu

| Alan | İncelemede görülen değer |
|---|---|
| Proje adı | 100 T X 14,85 M KAPASİTELİ ÇİFT KİRİŞLİ KÖPRÜLÜ TAVAN VİNCİ |
| Müşteri | ASTOR A.Ş. |
| El kitabı | V1, taslak |
| Şablon sürümü | 2 |
| Bölüm ağacı | 12 üst düzey düğüm; alt bölümlerle toplam 111 düğüm |
| Bloklar | 267: 141 metin, 47 liste, 45 uyarı, 12 tablo, 13 görsel, 9 otomatik tablo |
| Vektör şema | Bu snapshot'ta yok |
| Yüklenmiş görsel kaydı | Bu revizyon için yok; 13 görsel bloğu ile aynı şey değildir |
| İçerik işaretleri | 10 türetilmiş blok; 1 `edited` işaretli blok (`guvenlik.amac`) |
| Teslim paketi | Detaylı |
| Ek seçenekleri | Elektrik kataloğu ürün başına 2 sayfa; mekanik hesap Standardı kullanıcı tarafından seçilmiş |
| Görünür ekler | Mekanik hesap, elektrik projesi, elektrik katalogları, şartname |
| Gizli ekler | Mekanik proje, mekanik katalog, elektrik hesap |
| Hesap revizyonları | Revizyon 0 yayımlanmış; revizyon 1 taslak |

`edited` sayısı bütün kullanıcı değişikliklerinin sayısı olarak yorumlanmayacak. Göç kontrolü yalnız bu bayrağa bakmayacak; tüm bölüm, metin, sıra, görünürlük ve ek seçeneklerini karşılaştıracak.

Yerel iş emrinde 0026-01 açıklığı **15,50 m**; canlı proje başlığı ve kapak testindeki değer **14,85 m**. 0026-02 ise 30 m hol boylu yürüme yolu kalemi. Pilot el kitabı 0026-01'e bağlı tutulacak. Farkın nedeni bu incelemede kesinleştirilmedi; güncel onaylı teknik kaynakla karşılaştırılacak.

Kaynak adaptörü son yayımlanmış hesap revizyonunu tercih ediyor, yoksa son taslağı kullanıyor. Dolayısıyla 0026'da “en son düzenlenen hesap” ile “el kitabını besleyen hesap” aynı olmayabilir. Pilot veri fişinde kaynak revizyon açıkça yazılmalı.

Yerel elektrik katalog eşleme defteri 53 benzersiz ürün ve belgesi bulunamamış 2 özel konfigürasyon bildiriyor. Bu, yerel defterin bilgisi; canlı teslim paketinin eksiksiz olduğunun kanıtı değildir.

### 2.4 Çalıştırılan kontroller ve sınırları

- `node node_modules/vitest/vitest.mjs run src/lib/manual/__tests__`: **11 dosya, 168 test geçti**.
- Mevcut PDF betiği `--turet --sema --paket=tamTeknik` ile çalıştırıldı: **38 sayfa**, yaklaşık **975 KB**, 3 eklenmiş şema, 97 basılan bölüm.
- `check-manual-layout.py` bu çıktıda taşma bildirmedi. Başlık listesi parametresi verilmediğinden bu çalıştırma başlıkların tamamının korunmasını ayrıca kanıtlamaz.
- Test çıktısının 4, 8, 24 ve 32. sayfaları görsel olarak incelendi.
- Bu PDF, betiğin kendi örnek verileridir; **0026'nın canlı teslim PDF'i değildir**. Üretim uygulamasının tarayıcıda uçtan uca kullanımı ve 0026'nın gerçek tam paketinin indirilmesi bu aşamada yapılmadı.
- Yerel eski `tmp/manual-current.pdf` 0019 örnek verisi içerdiği için güncel 0026 belgesi kabul edilmedi.

İnceleme ara dosyaları `tmp/manual-redesign/` altında tutuldu; müşteri snapshot'ı kaynak kod fikstürü olarak commit edilmemeli. Uygulama testine alınacak veri ayrıca ayıklanmalı.

## 3. Mevcut yapının güçlü ve zayıf yanları

### Korunacak güçlü taraflar

1. Projeye bağlı tek el kitabı ve revizyon zinciri.
2. Serbest bölüm/blok ekleme, taşıma, silme ve gizleme.
3. Şablon metinlerinin değiştirilebilir olması; toplu doldurmada elle yazılanın korunması.
4. Standart / Detaylı / Tam Teknik kapsamları, bağımsız ek seçenekleri ve kullanıcı sapmaları.
5. Hesap, elektrik, teknik resim ve katalog kaynaklarından içerik alınması.
6. Fotoğraf, şablon görseli, pafta, katalog sayfası ve vektör şema yolları.
7. Gövde PDF'i ile tam teslim paketinin ayrılması.
8. Kaydet düğmesi ve yerel kurtarma kopyası; editörün mevcut çalışma alışkanlığı.
9. Kâğıt önizlemesi ile PDF'in ortak sayfa dağıtımını kullanması.

### Yeniden tasarımın çözmesi gereken noktalar

| Bulgu | Kanıt / sonuç | Planlanan karşılık |
|---|---|---|
| Görsel ile açıklama ayrı bloklar | Modelde `image` ve `text` ayrı; görsel işaretleriyle açıklama satırları arasında yapılandırılmış bağ yok | Fotoğraflı açıklama ve numaralı şekil bileşenleri |
| Prosedür yalnız liste düzeyinde | `list.items` metin dizisi; liste sonunda tek `result` var | Adım başına açıklama/görsel ve gerektiğinde sonuç taşıyan prosedür |
| İki sütun ana varsayım | `manualAnaBolumSayfalari` tam genişliği kararlı `yedek` anahtarına özel veriyor | Bölüm numarasına değil içerik rolüne göre sayfa düzeni |
| Küçük tipografi | Gövde 8,5 pt; tablo 7,5 pt; dizin 6,3 pt'ye kadar küçülebiliyor | Daha rahat okunabilen, pilot baskıyla doğrulanacak ölçek |
| İçerik sayfa üzerinde kopabiliyor | Test s.24'te bakım açıklaması solda, sağ alan boş, geniş çizelge aşağıda; s.32'de yağlama tablosu iki sütuna bölünüyor | Bakım ve yağlamada tam genişlik, ilişkili öğeleri birlikte yerleştirme |
| Sayfa ölçümü yaklaşık | Metin uzunluğu × ortalama karakter katsayısı; başlık yüksekliği derinliğe göre sabit | Gerçek font ölçüsü, satır kırılımı ve çok satırlı başlık hesabı; PDF karşılaştırması |
| Uzun serbest içerik için zayıf durumlar | Bölünebilir atomlar ağırlıkla liste/tablo; çok uzun paragraf veya uyarı ayrı senaryo gerektiriyor | Uzun içerik için açık bölme ve devam kuralları |
| Standarta dönme sıraya bağlı | `blockRevertToTemplate` bölüm içi indeks ve türle eşleştiriyor | Kararlı şablon blok kimliği; araya ekleme sonrası yanlış metne dönmeyi önleyen test |
| Yeni blokların sessiz kaybı riski | `withManualDefaults` tanınmayan türleri düşürüyor; kaydetme de aynı okuyucudan geçiyor | Okuma/yazma sürüm anlaşması, desteklenmeyen sürümde kaydetmeyi engelleme |
| Tasarım sürümü ayrı değil | Payload ve şablon sürümü var; basım tasarımı sürümü yok | İçerik ve görsel tasarım sürümlerini ayırma |
| Yayım ve tekrar indirme aynı garanti değil | Tablolar donar; ek çözümünde `revisionId` kullanılmıyor, bazı kaynaklar güncel okunuyor | Kaynak manifestosu ve nihai gövde/tam PDF arşivi |
| Kalite kapısı sınırlı | Künye ve görünür boş şablon bloklarını denetliyor | Kırık görsel/atıf, desteklenmeyen blok ve seçilip bulunamayan ek kontrolleri |

## 4. Önerilen belge mimarisi

### 4.1 Okuma sırası

Aşağıdaki yapı yeni tasarım için öneridir. Eski ağacın topluca değiştirilmesi değildir; pilotta eski-yeni bölüm eşleme tablosu hazırlanacak.

| Bölüm | Okuyucunun sorusu | Başlıca içerik biçimi |
|---|---|---|
| Ön sayfalar | Bu belge hangi vinç ve revizyon için? | Kapak, ürün kimliği, belge kapsamı, içindekiler |
| 1. El kitabının kullanımı | Belgeyi nasıl okuyacağım? | Kısa rehber, işaret açıklamaları, sorumluluklar |
| 2. Güvenlik | Hangi risk ve önlemleri bilmeliyim? | Konu bazlı uyarılar, fotoğraflı işaretler, kısa tablolar |
| 3. Vinci tanıma | Parçalar, hareketler ve sınırlar nerede? | Numaralı genel görünüş, parça açıklamaları, teknik özet |
| 4. Kumanda ve işletme | Vinci nasıl kullanacağım? | Kumanda fotoğrafları, hareket şemaları, işlem adımları |
| 5. Kullanım öncesi ve sonrası kontroller | Neyi kontrol edeceğim? | Kısa kontrol listeleri ve ilgili bölüm bağlantıları |
| 6. Olağan dışı durumlar | Belirti görüldüğünde ne yapacağım? | Doğrulanmış belirti/eylem/yetki tabloları; teknik inceleme gerekli |
| 7. Bakım ve muayene | Hangi iş, kim tarafından, ne zaman? | Bakım güvenliği, takvim, ekipman bazlı görevler, kayıtlar |
| 8. Yağlama | Hangi nokta, hangi doğrulanmış ürün/yöntem? | Numaralı nokta şeması ve geniş çizelge |
| 9. Yedek parça ve servis | Hangi parça ve belgeye bakacağım? | Kaynaklı ekipman tablosu, sipariş bilgileri |
| 10. Çevre ve sözlük | Atıklar ve terimler nasıl ele alınır? | Kısa tablolar / gerektiğinde ayrı alt bölümler |
| Ekler | Hangi teknik belgeler teslim edildi? | Seçime bağlı ek dizini, ayraçlar ve kaynak PDF'ler |

Halat muayenesi gibi ayrıntılı bakım içeriği işletme akışını uzatmayacak şekilde bakım bölümünde konumlandırılabilir. Kullanım bölümünden kararlı bağlantıyla erişilir. Aynı güvenlik metninin iki ayrı kopyasını üretmek yerine ihtiyaç yerinde kısa hatırlatma ve atıf kullanılır.

### 4.2 Sayfa ailesi

Tek bir zorunlu iki sütun yerine sınırlı sayıda tutarlı düzen:

- **Anlatım:** geniş ana metin alanı, gerektiğinde dar kenar etiketi; kısa metinler.
- **Görselli açıklama:** solda veya sağda fotoğraf/şema, karşısında açıklama. Dar alanda görsel ve açıklama alt alta.
- **Prosedür:** numara, yapılacak işlem, gerekirse görsel ve beklenen sonuç; sırayla okunur.
- **Numaralı şekil:** büyük görsel, işaret numaraları ve bağlı açıklama listesi.
- **Çizelge:** tam genişlik; devam sayfalarında tekrarlanan başlık ve anlaşılır devam bilgisi.
- **Ek ayracı:** belge adı, kaynak/revizyon bilgisi ve gerçek kapsam; arkasına ilgili PDF.

Başlangıç tipografi hedefi: gövde 10–10,5 pt, tablolar yaklaşık 9 pt, altyazı 8,5–9 pt, dizin en az 9 pt. Bunlar prototip ölçüleridir; gerçek A4 baskı ve uzun Türkçe metinle kesinleştirilecek. Dizin sığmadığında yazıyı küçültmek yerine ek sayfa açılacak.

Ana bölüm yeni sayfadan başlama alışkanlığı korunacak. İki sütun kısa ve paralel bilgiler için kullanılabilecek. Bakım, yağlama, geniş teknik tablolar ve ayrıntılı prosedürlerde tam genişlik esas olacak. Filigran, renkli omurga ve bölüm sekmeleri metnin okunmasını etkilemeyecek biçimde sadeleştirilecek; ORION ve ortak firma kimliği korunacak.

Bu tercihler `KITAP-11` ve `KITAP-24`teki eski düzen kararlarının yeni tasarım kapsamında güncellenmesi anlamına gelir. Uygulama sırasında alan dokümanı ve onu koruyan testler birlikte güncellenecek.

### 4.3 Düzenlenebilir yeni içerikler

| Kullanıcıya görünen ad | İçeriği | Düzenleme davranışı |
|---|---|---|
| Fotoğraf + açıklama | Fotoğraf, başlık, açıklama, altyazı, yerleşim tercihi | Araya tek işlemle eklenir; birlikte taşınır |
| İşlem adımları | Kararlı kimlikli adımlar; metin, isteğe bağlı görsel/uyarı/sonuç | Adım ekleme, çıkarma, sıralama; numara otomatik |
| Numaralı şekil | Görsel/şema, normalize işaret koordinatları, açıklama satırları | İşaret numarası ile açıklama aynı kayıttan üretilir |
| Kontrol listesi | Kontrol maddeleri, açıklamalar, gerekirse kayıt alanları | Boş onay kutuları; yapılmış kontrol veya uygunluk otomatik varsayılmaz |

İlk prototipte ilk üç bileşen öncelikli. Kontrol listesi, mevcut numaralı listeyle yeterli olup olmadığı değerlendirildikten sonra ayrı tipe dönüşecek. Rastgele iç içe kolonlar ve sınırsız tasarım seçenekleri eklenmeyecek; teknik el kitabı için anlaşılır hazır düzenler sunulacak.

### 4.4 Editörün gündelik kullanımı

Mevcut Harita / Belge / Kâğıt yaklaşımı korunur. Kapsam, Künye, Kalite ve Kaynaklar işlevleri kaybolmaz.

Standart akış: projeden oluştur → mevcut kaynaklarla doldur → eksik bilgileri tamamla → kapsamı seç → kâğıdı kontrol et → kaydet / yayımla.

Ayrıntılı akış: ilgili bölümde iki içerik arasındaki `+` → “Fotoğraf + açıklama” veya “İşlem adımları” → medyayı seç → açıklamayı yaz → sayfa önizlemesinde kontrol et.

Yerleşim varsayılanı otomatik olacak. Kullanıcı yalnız gerektiğinde görsel tarafını, tam genişliği veya bölüm başlangıcını değiştirecek. Şablondan gelen, kaynaktan türetilen ve kullanıcı tarafından değiştirilmiş içerik editörde anlaşılır durum bilgisi taşıyacak; bu uygulama bilgileri müşteri PDF'ine basılmayacak.

Geri al / yinele, silme ve taşıma hatalarından dönüş için eklenmeli. Yerel kurtarma kopyası ve açık kaydetme modeli korunmalı. Kâğıt üretimi yazma imlecini taşımamalı; ağır önizleme hesapları geciktirilmeli ve yalnız gerekli alan güncellenmeli.

## 5. Teknik yaklaşım ve uyumluluk

### 5.1 Sürüm ve göç

- `templateVersion`: hazır içeriğin sürümü olarak kalır.
- `designVersion`: basım tasarımını seçer; alanı bulunmayan belgeler eski tasarımı kullanır.
- Yeni içerik sözleşmesi için v1 ve v2 okuyucu/yazıcı açıkça ayrılır. V2 kaydını eski okuyucudan geçirip eksik hâliyle kaydetmek yasaklanır.
- Önce iki sürümü okuyabilen sunucu ve istemci dağıtılır, sonra yeni tür üreten editör açılır.
- Geri dönüşte v2 kayıtları eski editörde yazılabilir açılmaz; uyumlu okuyucu veya salt okunur arşiv sunulur.
- 0026 dönüşümü önce yerel kopyada denenir; eski metinler, kimlikler, kullanıcı ekleri ve paket sapmaları için fark raporu çıkarılır. Canlı V1 topluca yeniden şablonlanmaz.
- Yeniden tasarıma geçmek, metinleri yeni şablonla değiştirmekten ayrı bir işlemdir. Sadece görünümü değiştirmek isteyen kullanıcı içerik göçüne zorlanmaz.
- `templateBlockKey` benzeri kararlı bir kaynak kimliği eklenir. Eski bloklarda eşleme belirsizse yanlış standarda dönmek yerine işlem uygulanmaz ve sebebi gösterilir.

### 5.2 Paylaşılan belge planı

Mevcut `pdf-layout.ts` yaklaşımı sürdürülür: filtrelenmiş içerik → numaralama/atıflar → ölçüm → sayfa planı → HTML ve PDF çizimi.

Önerilen dosya ayrımı:

| Yeni / değişecek parça | Sorumluluk |
|---|---|
| `src/lib/manual/design.ts` | Sürüm bazlı font, boşluk, sayfa ve tablo ölçüleri |
| `src/lib/manual/document-plan.ts` | Basılan bölüm/şekil kimlikleri, atıflar, düzen tercihleri ve belge planı |
| `src/lib/manual/layout/*` | Metin, işlem, şekil ve çizelge ölçümü/bölünmesi |
| `src/lib/manual/migrations/*` | V1 → V2 açık dönüşümü ve kayıpsızlık raporu |
| `src/lib/manual/validation.ts` | İçerik ve kaynak kalite bulguları; istemci/sunucu ortak |
| `src/lib/pdf/manual/*` | Eski ve yeni tasarım çizicileri; ortak kapak ve marka bileşenleriyle bağlantı |
| `src/components/manual/*` | Aynı planı kullanan kâğıt bileşenleri |
| `editor/*` | Yeni bileşenlerin yerinde düzenlenmesi, işaretleme ve geri alma |

Dosya isimleri uygulama sırasında mevcut bağımlılıklarla kesinleştirilebilir. Amaç PDF, önizleme ve ölçümün üç ayrı tasarım tanımı taşımamasıdır. Mevcut React-PDF motoruyla pilot yapılacak; motor değişimi ancak pilotun çözülemeyen somut ölçüm sorunu göstermesi hâlinde değerlendirilecek.

### 5.3 Sayfalama kuralları

- Başlık en az ilk anlamlı içerik parçasıyla birlikte taşınır; çok satırlı başlık ölçülür.
- Fotoğraf ve açıklama mümkünse birlikte kalır. Tek sayfadan uzunsa metin kontrollü devam eder; büyük grup bütünüyle bölünmez ilan edilmez.
- İşlem sırası değişmez; bölünürse adım numarası ve devam bilgisi korunur.
- Uyarı başlığı ile ilk metin parçası ayrılmaz. Sayfadan uzun uyarı ve paragraf için kırpılmayan devam düzeni bulunur.
- Şekil işaretleri görsel yeniden boyutlanınca yerinde kalır; görüntü kırpılırsa kaymış işaretler sessizce kabul edilmez.
- Tabloda sütun başlıkları tekrarlanır; satır parçalanması ve çok uzun tek hücre ayrıca ele alınır.
- Şekil, tablo ve bölüm atıfları sabit kimliğe bağlanır. Gizleme/sıralama sonrası numaralar yeniden hesaplanır; hedef yoksa kırık atıf kalite bulgusu olur.
- Dizin ve ek bağlantıları gerçek nihai sayfalardan hesaplanır.
- A3/yatay teknik ekin yönü ve çizim okunabilirliği korunur; gövde stilini zorla ek sayfasına uygulamak gerekmez.

### 5.4 Teslim paketinin korunması

`printedManual` görünürlüğün tek kaynağı; `manualAppendixOrder` ek sırasının tek kaynağı olarak kalır. Yeni düzen bu kararları tekrar tutan ikinci bir görünürlük modeli açmaz.

Yeni yayımlarda kaynak manifestosu tutulması önerilir: kaynak revizyon/dosya kimliği, seçilen sayfalar, ek türü ve sırası, rapor seviyesi, sayfa sayısı ve dosya özeti. Nihai gövde PDF'i ve tam PDF, ilgili el kitabı revizyonuna bağlı arşivlenir. Tekrar indirme bu arşivi verir.

Bu, bugünkü güncel proje başlığını ve firma kimliğini yeniden okuma davranışının yayımlanmış belgelerde nasıl işleyeceğinin de açıkça kararlaştırılmasını gerektirir. Öneri: taslakta güncel kimlik, yeni yayımda donmuş teslim kimliği. Eski teslimin arşivi yoksa geçmişteki gerçek çıktının birebir yeniden elde edildiği iddia edilmez.

Arşiv üretiminde yarım durum engellenir: aday dosyaları üret/doğrula → kaynak değişmediğini kontrol et → dosya referansları ve payload ile yayımı tutarlı biçimde tamamla. Hata durumunda kayıt taslak kalır; yeniden deneme aynı çıktıları çoğaltmaz. Gerekli DB alanları ve RLS değişiklikleri bu fazda ayrı migration olarak ele alınır.

“Seçildi fakat bulunamadı” ile “kapsam dışı” ayrı gösterilir. Önizleme için kısmi çıktı alınabilir; eksik bir seçili ekin tam teslimde fark edilmeden atlanması engellenir. Kullanıcı eki açıkça kapsamdan çıkarabilir.

## 6. Fazlar ve aradaki kontrol kapıları

Faz bitişi, yalnız kodun derlenmesi değildir. Her fazın somut çıktısı ve geçiş ölçütü aşağıdadır.

### Faz 0 — 0026 temel kaydı ve karşılaştırma seti

**İşler:** V1 snapshot'ı, bağlı kaynak revizyonları, gerçek gövde/tam PDF, kaynak belge listesi ve görsel envanterini kaydet. Mevcut kullanıcı değişikliklerini ve ek seçimlerini referanslaştır. 15,50 / 14,85 farkını onaylı teknik kaynakla araştır. Mevcut çalışma ağacındaki diğer işleri ayrıştır.

**Çıktı:** 0026 başlangıç fişi, eski PDF'ler, kaynak/eksik listesi ve karşılaştırma ölçüleri.

**K0:** Pilot kalemin 0026-01 olduğu, hangi hesap revizyonunun kullanıldığı ve hangi verilerin henüz kesinleşmediği açık. Gerçek teslim paketi ile test fikstürü birbirine karıştırılmıyor. İnceleme bu fazın veri envanteri ve kod/test kısmını tamamladı; gerçek PDF/tarayıcı kontrolü kaldı.

### Faz 1 — Bilgi mimarisi ve görsel sistem

**İşler:** Eski-yeni bölüm eşlemesini hazırla. Sayfa ailesi, font ölçüsü, uyarı bandı, şema/altyazı ve tablo dilini tasarla. 0026 için gerekli fotoğraf/pafta/kumanda kaynağını belirle; bulunmayan görselleri eksik olarak kaydet.

**Çıktı:** Bölüm haritası, tasarım ölçüleri ve pilot sayfa listesi.

**K1:** Hiçbir mevcut içerik veya ek seçeneği karşılıksız kalmıyor. Standart işi hazırlayan kullanıcıya gereksiz yerleşim kararı yüklenmiyor. Yeni tasarımda gerekli proje bilgileri uydurulmuyor.

### Faz 2 — Temsilî sayfa prototipi

**İşler:** Tam modüle yaymadan 8 temsilî sayfa oluştur: kapak; dizin; numaralı vinç tanıtımı; güvenlik/uyarı; kumanda fotoğrafı ve açıklama; işletme adımları; bakım/yağlama çizelgesi; ek ayracı. Gerçek kaynak bulunmayan görsel müşteri belgesine hazırmış gibi sunulmaz.

**Çıktı:** Eski-yeni karşılaştırmalı pilot PDF ve kâğıt önizlemesi.

**K2 — tasarım değerlendirmesi:** A4 %100 ölçekte ve basılı örnekte yazı, şekil ve açıklamalar okunabilir. Örnek belgedeki şematik anlatım hissi sağlanıyor. Yön, tüm uygulama tamamlandıktan sonra değil bu küçük set üzerinden kullanıcıyla değerlendiriliyor.

### Faz 3 — İçerik modeli ve geriye uyum

**İşler:** Yeni bileşen sözleşmeleri, kararlı şablon/görsel işaret kimlikleri, sürüm okuma/yazma ve dönüşüm kodunu ekle. Kaydetme, silme, kopyalama, görsel referansı toplama ve snippet akışlarını yeni türlere genişlet.

**Çıktı:** Çift sürüm desteği ve 0026 kopyası üzerinde dönüşüm raporu.

**K3 — veri kaybı kapısı:** Mevcut 267 bloktaki metin ve kararlar korunuyor; hedeflenen birleştirmeler kimlik eşleme raporuyla izleniyor. Kaydet/aç ve yeni revizyon döngüleri görsel bağlantısı kaybetmiyor. Eski sürüm yeni içeriği düşürerek kaydedemiyor. Kullanıcının mekanik hesap seviyesi seçimi korunuyor.

### Faz 4 — Sayfalama ve iki çizici

**İşler:** Ölçüleri ortaklaştır; yeni bileşenleri ölç, böl ve yerleştir. Uzun metin, uzun uyarı, tek satırdan büyük tablo hücresi, portre fotoğraf ve farklı oranlı şemaları işle. Dizin, devam bilgileri ve atıfları üret.

**Çıktı:** Ortak belge planından üretilen HTML önizleme ve PDF.

**K4 — sayfa bütünlüğü:** Kırpılan metin, üst üste binen içerik, yalnız kalan başlık ve yanlış numaralı şekil yok. PDF ve kâğıtta aynı içerik sırası/sayfa hedefleri var. Otomatik denetimden sonra tüm pilot sayfalar görsel olarak inceleniyor. Font ölçümü ile gerçek çizim farkı kabul sınırlarıyla kaydediliyor.

### Faz 5 — Editör akışı

**İşler:** Blok arası menüye yeni bileşenleri ekle; fotoğraf/açıklama, adım ve işaret düzenleyicisini kur. Yerleşim ayarlarını sade tut; geri al/yinele ekle; yerel kurtarma ve kaydetme davranışını koru. Mevcut `/dev/manual-preview` sayfasını yeni fikstürlerle genişlet.

**Çıktı:** Standart ve ayrıntılı belge hazırlama akışları.

**K5 — kullanım kontrolü:** Kullanıcı bir fotoğraf ve açıklamayı istediği araya ekleyebiliyor; taşıma/silme sonrası geri alabiliyor; standart metnin yalnız bir kısmını değiştirip diğerlerini koruyabiliyor. 375, 768, 1024 ve 1440 px genişliklerde; klavye ve dokunmatik kullanımda içerik kaybı veya erişilemeyen temel işlem yok.

### Faz 6 — Şablon ve 0026 içerik düzenlemesi

**İşler:** Pilot vinç için mevcut kaynaklardan genel görünüş, kumanda tanıtımı ve uygun şemaları yerleştir. Uzun metinleri anlam kaybı olmadan uygun bileşenlere dönüştür. Bakım ve yağlama görevlerini daha anlaşılır grupla. Diğer vinçlere ait sistemlerin uygulanabilirliğini kontrol et.

**Çıktı:** Yeni tasarımlı 0026 değerlendirme taslağı; kaynak/eksik listesi.

**K6 — içerik kontrolü:** Fotoğraf ve numaralı parça açıklaması gerçek donanıma uyuyor. Çalışma sınırları, işlem sıraları, bakım aralıkları ve yağlama bilgileri ilgili teknik sorumlu tarafından kaynaklarıyla doğrulanıyor. Görsel düzenleme teknik hükmü değiştirmiyor. `edited` ve serbest içerikler toplu şablon güncellemesiyle ezilmiyor.

### Faz 7 — Ekler, yayım ve arşiv

**İşler:** Yeni tasarımı mevcut birleştirme hattına bağla. Ek manifestosu ve yeni yayımlar için donmuş çıktı politikasını uygula. Kapsam seçeneklerini, eksik belge bildirimini, ek dizinlerini ve nihai folioyu doğrula.

**Çıktı:** Aynı 0026 taslağının gövdesi ve farklı kapsamlarla tam paketleri; gerekli arşiv/migration değişiklikleri.

**K7 — teslim kontrolü:** Her seçili ek doğru ayracın arkasında. Gizli ek yok. Dizin bağlantıları doğru. Kaynak güncellendiğinde yeni yayımlanmış el kitabının arşiv çıktısı değişmiyor. Yarım üretim yayımlanmış kayıt oluşturmuyor. Eski revizyonlar değiştirilemiyor.

### Faz 8 — Uçtan uca kabul ve yaygınlaştırma

**İşler:** 0026 üzerinden standart hazırlama ve ayrıntılı düzenleme senaryolarını baştan sona çalıştır. İkinci küçük vinç ve çok uzun özel iş fikstürüyle aşırı özelleşme kontrolü yap. Gereken test/lint/typecheck/build kontrollerini çalıştır; tüm son PDF'leri incele; alan dokümantasyonunu güncelle.

**Çıktı:** Kabul raporu, sürüm notu, dönüşüm ve geri dönüş yönergesi.

**K8:** Aşağıdaki matris tamamlanmış, veri kaybı yok, kullanıcı pilotun okunabilirliğini ve düzenleme akışını değerlendirmiş. Yeni tasarım önce pilot/yeni taslaklarda açılır; eski belgeler kendiliğinden dönüştürülmez. Genel dağıtımdan önce v2 kayıtları koruyan geri dönüş yolu denenir.

## 7. Kabul matrisi

| Senaryo | Beklenen sonuç |
|---|---|
| Eski v1 belgeyi aç / kaydet / yeniden aç | İçerik, sıra, kimlik ve görünürlük korunur |
| Standart blok arasına fotoğraf + açıklama ekle | Doğru yerde görünür; birlikte taşınır; komşu metni bozmaz |
| Araya blok ekledikten sonra standarda dön | Doğru kaynak blok geri gelir; aynı türdeki komşu blokla karışmaz |
| Uzun, çok görselli prosedür | Adım sırası ve metin tamdır; sayfalar arası devam anlaşılır |
| Şekil ölçekle / görsel değiştir | İşaret-açıklama bağı korunur veya yeniden yerleştirme gerektiği gösterilir |
| Başka bölüme taşı / gizle / geri göster | İçerik korunur; numaralar ve atıflar güncellenir |
| Tam Teknik → Standart → geri | Kullanıcının korunmuş kararları ve serbest eklemeleri kaybolmaz |
| Kaynaktan toplu doldur | Elle değiştirilmiş metin korunur; değişenler/korunanlar anlaşılır |
| 200+ satır bakım ve geniş yağlama çizelgesi | Başlıklar tekrarlanır; tablo okunur; satır/metin kaybı yok |
| Bozuk/eksik görsel ve PDF eki | Dosya adı/bölümüyle anlaşılır bulgu; sessiz eksik teslim yok |
| Ekler kapalı / tek ek / seçili ekler / tümü | Doğru gövde, sıra, ayraç, dizin ve toplam sayfa |
| Kaynak belge revize edilir | Taslağın kaynağı anlaşılır; arşivlenmiş yeni yayım değişmez |
| Kaydetmeden sekme kapanır | Yerel kurtarma çalışır; sunucuya kaydedilmiş gibi gösterilmez |
| Yeni revizyon açılır | Görseller ve içerik kopyalanır; önceki yayım değişmez |
| Eski istemci yeni sürümü açar | Desteklenmeyen veriyi silerek kaydedemez |
| 375 px telefon / tablet / masaüstü | Ekleme, kaydetme, kapsam ve önizleme erişilebilir |

Mevcut testler her ilgili fazda korunur. Yeni testler yalnız JSX düzenini tekrar eden kontroller yerine içerik kaybı, sürüm geçişi, sayfalama ve gerçek kullanıcı işlemlerini doğrular. PDF denetçisi yatay taşma, üst üste binme, görsel kırpılması ve atıf doğruluğunu da kapsayacak şekilde genişletilmeli; mevcut “taşma yok” sonucu tek başına kabul sayılmamalı.

Performans eşiği Faz 0'da gerçek 0026 gövde ve tam paket süreleri ölçülerek sayısallaştırılacak. Sayfa sayısı, dosya boyutu, oluşturma süresi ve düzenleme tepkisi aynı veriyle karşılaştırılacak. Bugünkü 38 sayfalık test çıktısı hedef sayfa sayısı değildir.

## 8. Uygulama sırası ve kapsam sınırı

Bağımlılık sırası: **K0 → bilgi mimarisi → küçük görsel prototip/K2 → sürüm ve veri modeli/K3 → sayfalama/K4 → editör/K5 → 0026 içerik/K6 → teslim/K7 → uçtan uca kabul/K8**.

İlk somut uygulama paketi Faz 0'ın kalan gerçek PDF kontrolü ile Faz 1–2 olmalı. Böylece görsel yön 8 temsilî sayfada değerlendirilir; bütün şablonun dönüştürülmesi bundan sonra gelir.

Hesap motorunun yeniden yazılması, genel katalog/teknik resim modülünün yeniden tasarlanması, 3D sahne geliştirilmesi veya bütün uygulamanın editör altyapısının değiştirilmesi bu planın kapsamı değildir. İlgili kaynak modüllere yalnız el kitabı entegrasyonu gerektirdiği ölçüde dokunulur.

Plan için temel teknik riskler: eski okuyucuda yeni blok kaybı, kaynakla bağını kaybeden görsel işaretleri, HTML/PDF ölçü ayrışması ve yayımlanmış paketin güncel kaynaklarla değişmesi. Her biri yukarıdaki ayrı kontrol kapısıyla ele alınır; yalnız görsel stil değişikliğiyle tamamlanmış sayılmaz.
