# Belge kimliği, PDF ve Excel

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/belge.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/pdf/**` · `src/lib/excel/**` · `src/lib/product-portal/**` · `src/components/customer-portal/**` · `src/app/(app)/projects/[id]/product-portal/**` · `src/app/(public)/paylas/vinc/**` · `scripts/check-pdf-layout.py`


Marka altyapısı `pdf/brand.tsx`tedir ve TÜM belgeler onu paylaşır:

- **`BrandBand`** — ilk sayfanın üst bandı: solda lockup logo, sağda doküman
  kodu + revizyon/tarih, altında kömür kural. Müşteriye TESLİM EDİLEN her
  belgenin ilk sayfası markayı taşır; kırmızı omurga ve folio tek başına
  logonun yerini tutmaz. Hesap raporu kapağı ile ekipman listesinin ilk sayfası
  aynı bileşeni kullanır, ikisi aynı yüksekliğe oturur.
- **Ortak kimlik bloğu** — proje üzerinde seçilen **Rapor Firması**nın
  logo ve adını ORION bandının altında gösterir. Hesap raporu kapağı,
  ekipman listesinin ilk yaprağı ve işletme-bakım kitabı kapağı aynı bileşeni
  kullanır. İç sayfalarda aynı logo `PageHeader`ın sağ yuvasına veya el kitabı
  `BrandBand`ının orta yuvasına iner; ORION kimliğinin yerine geçmez.
- **`CompanyBlock`** — sayfa dibindeki firma künyesi, folio satırının ÜSTÜNDE.
  İki sütundur: solda KİMLİK (firma adı gövde ailesinde + adres), sağda
  İLETİŞİM. Üç satır alt alta mono gri metin okunmuyordu — firma adı adresten
  ayrışmıyor, iletişim adresin devamı gibi duruyordu.

  **AYIRICI ÇİZGİ KÜNYENİN ALTINDADIR, ÜSTÜNDE DEĞİL** (kullanıcı bildirimi,
  12.08.2026: *"ilk sayfa footer bana hâlâ karmaşık geliyor"*). Çizgi üstteyken
  künye ile folio satırı tek bir üç satırlık gri yığın gibi okunuyor, adresin
  nerede bitip doküman satırının nerede başladığı seçilemiyordu. Çizgi araya
  alınınca iki bölge ayrışır: üstte FİRMA kimliği, altta BELGE kimliği. Çizgi
  hâlâ TEKTİR — künye yokken aynı çizgiyi folio satırının kendisi çizer.

  **KAPAKTA MARKA ADI BİR KEZ GEÇER.** Altbilgi doküman satırı normalde
  `ORION CRANES · HESAP RAPORU · REV 05 · 2026`tır ve diğer sayfalarda markayı
  taşıyan tek satır odur. Kapakta ise künye hemen üstündedir; önek orada
  düşürülür (`coverDocLineFor`), yoksa aynı ad altbilgide iki kez yazılırdı.

  **HESAP RAPORU GİZLİLİK SATIRI KAPAK HARİÇ HER YAPRAKTADIR.** Çok küçük tek
  satır uyarı metni sabittir: `ORİON VİNÇ SAN. TİC. LTD. ŞTİ. MÜLKİYETİDİR ·
  GİZLİDİR · İZİNSİZ KOPYALANAMAZ VE ÜÇÜNCÜ KİŞİLERLE PAYLAŞILAMAZ.` Kapakta
  basılmaz; tek bir iç sayfa ayrı paylaşılsa da sahiplik ve gizlilik bilgisi
  sayfanın üzerinde kalır (`REPORT_FOOTER_NOTICE`).
- **`StripeField`** — kılavuzun 135° ÇAPRAZ ŞERİT ALANI, altı grafik aygıtından
  biri. Kömür bir zemini düz bırakmak yerine dokulandırır; kontrast bilerek çok
  düşüktür (`#2F2E2C` ⟷ `#262626` ≈ 1,05:1) ve üzerindeki metni etkilemez.
  **SVG'DİR:** @react-pdf `repeating-linear-gradient` bilmez, döndürülmüş
  kutulardan şerit kurmak her şeridi ayrı bir yerleşim düğümü yapardı ve SVG
  kendi görüntü alanına kırpar. Ölçü kılavuzun CSS'idir: dik yönde 9 pt şerit /
  18 pt periyot; 45°'lik çizgide x karşılığı √2 katıdır.
- **`BRAND_LOGO_PAPER` / `BRAND_LOGO_INK` / `BRAND_SYMBOL_INK`** — kağıt renkli
  lockup, kömür lockup ve kömür monogram; `scripts/make-icons.ts` ÜRETİR
  (@react-pdf `Image` yalnız raster okur, SVG veremeyiz). Tam renkli lockup
  kömür zeminde okunmaz, kağıt üzerinde ise ikinci bir kırmızı lekesidir —
  teklifin iç sayfalarında kırmızı kicker ve kurala ayrılmıştır. **Oran PNG
  başlığından okunur** (`pngOrani`), elle yazılmaz: sabit bir oran, görsel
  yeniden üretildiğinde sessizce logoyu esnetirdi.

### `BrandPage`in iki opt-in kipi

- **`bleed`** — kapak gibi TAM KANAMA yapraklar. İçerik payı sıfırlanır (payı
  bölgeler kendi içinde verir), **kırmızı omurga içerikten SONRA çizilir**
  (boyama sırası akış sırasıdır; kenardan kenara bir bant, önce çizilmiş
  omurganın üstünü örterdi) ve **filigran basılmaz** (kömür bant + lockup +
  omurga markayı zaten taşır). Altbilgi tam kanamada da marjdadır: sayfanın
  payı sıfırlansa bile folio yerini değiştirmez.
- **`brandFooter`** — doküman satırı kömür ve yarı kalın, folionun önünde 5 pt
  kırmızı kare, (verilirse) doküman satırının ÜSTÜNE gri künye satırı.
  Bugün YALNIZ TEKLİF kullanır (TEKLIF-50); hesap raporu, iş emri, bordro ve
  ekipman listesi bugünkü altbilgisiyle kalır. Teklifin kapak dilini bütün
  belgelere yaymak AYRI bir karardır ve yerleşim denetçilerini birlikte
  götürür.

### Hesap raporunun üç seviyesi ve özel teker yükleri çıktısı

`ReportLevel` yalnız ayrıntı düzeyi değil BÖLÜM KAPSAMI da seçer (kullanıcı
kararı, 12.08.2026):

| | Özet | Standart | Detaylı |
|---|---|---|---|
| Kapak + Özet bölümü | ✓ | ✓ | ✓ |
| İçindekiler | — | ✓ | ✓ |
| Hesap bölümleri | — | ✓ (yalnız sonuç) | ✓ (formüllerle) |
| Kontrol Özeti | — | — | ✓ |
| Ek — Kaynaklar | — | ✓ | ✓ |
| Gizlilik koşulları | — | KISA | TAM |

**TEKER YÜKLERİ**, bu üç seviyeden birinin yeni adı değildir; müşterinin hesap
öncesinde yalnız ray yüklerini istediği durumlar için PDF Rapor menüsünün EN
ALTINDA duran özel bir çıktıdır (`ReportLevel = "teker_yukleri"`). Kapaktan
sonra yalnız mevcut **Teker Yükleri** modülünü, formülleri ve şemalarıyla basar.
İçindekiler, Özet Hesap Raporu, diğer hesap modülleri, Kontrol Özeti, Ek —
Kaynaklar ve Gizlilik/Kullanım Koşulları bu dosyaya girmez. İç yaprakların sabit
tek satırlık mülkiyet uyarısı korunur; tek bir yaprak ayrı gönderildiğinde belge
kimliğini kaybetmemelidir. Kapakta ve iç sayfa altbilgisinde belge adı **TEKER
YÜKLERİ RAPORU**dur. Bu bağımsız dosya tam rapordaki dinamik bölüm numarasını
miras almaz; `BÖLÜM 01 · TEKER YÜKLERİ` ile başlar ve alt bölümleri `1.1`,
`1.2`… olarak sürer. İlk alt bölümün özel çıktıdaki adı **TEKER YÜKÜ GİRDİLERİ
VE TEKER DÜZENİ**dir; tam rapordaki “Vinç Verileri ve Teker Düzeni” adı özel
dosyaya taşınmaz. Dosya adının son parçası `TEKER YÜKLERİ.pdf` olur.

**Kontrol Özeti bir DİZİNdir**, bir liste değil: her satırın solunda kontrolün
dayandığı hesabın SAYFA NUMARASI durur ve o numara tıklanabilir. O hesap yalnız
detaylı raporda tam basıldığı için dizin başka seviyede kendi kaynağını
gösteremezdi; standart raporda satır içi kontroller zaten bölümlerinde durur.
Aynı sebeple içindekiler de o satırı yalnız detaylıda listeler — basılmayan bir
bölümün sayfa numarası "—" kalır ve bağlantı hiçbir yere gitmezdi.

**GİZLİLİK VE KULLANIM KOŞULLARI Ek'in ALTINDADIR, ayrı bir yaprak değil**
(kullanıcı kararı: *"Ek ve bu yazı 1 sayfayı geçmesin"*). Metin kaynak
listesinden daha küçük (6,5pt) ve daha silik basılır — aynı ağırlıkta dizilseydi
belgenin son sözü mühendislik değil hukuk metni olurdu. Metin bir HUKUKÎ
BEYANdır: sözcükleri kullanıcı yazmıştır ve düzenlenmez; standart raporun kısa
sürümü hiçbir koşulu GEVŞETMEZ, aynı koşulları daha az sözcükle söyler. Hukukî
metinde ticari ad değil TÜZEL KİŞİ adı geçer (`LEGAL_ENTITY`).

Üç kural da PDF'in METNİNDEN ölçülerek korunur
(`__tests__/report.smoke.test.tsx` — "rapor seviyeleri" bloğu): bileşen ağacına
bakmak, seviyenin gerçekten belgeye yansıdığını göstermez. Yerleşim denetçisi
(`scripts/check-pdf-layout.py`) özet raporda içindekiler ARAMAZ; ayrımı dosya
adından değil belgenin kendisinden okur (`has_module_sections`).

**HESAP RAPORUNUN HER İÇ YAPRAĞINDA TEK SATIRLIK BELGE UYARISI VARDIR.**
`BrandPage.footerNotice` ile mevcut altbilgi satırının altında 4,5pt basılır;
kapakta kesinlikle gösterilmez. Uyarı sabit altbilginin parçasıdır, bu nedenle
bir hesap bölümü fiziksel olarak devam yaprağına bölündüğünde de kendiliğinden
tekrarlanır. Metin `REPORT_FOOTER_NOTICE` sabitinden gelir; sayfa türleri kendi
kopyalarını yazmaz.

**HESAP RAPORLARINDAKİ SATIR TABLOLARI BÜYÜK HARFTİR.** Özet, standart ve
detaylı hesap raporlarının teknik özellik, girdi, tasarım kabulü ve katalog
seçim satırları ile Teknik Ressam Özeti'nin ilk teknik özellik yaprağı aynı
`FieldTable` bileşeninden geçer. Etiketler ve metinsel değerler `tr-TR` ile
dönüştürülür; sayısal değerler ve `kW`, `m/s`, `mm` gibi teknik birim simgeleri
dönüştürülmez. Özet sayfasındaki “Ana Ekipman Seçimleri” satırları ve rapor
kapağındaki künye tablosu da aynı büyük harf kuralını taşır. Ekipman listesi
PDF'inin künye ve ekipman satırları da bu yardımcıyı kullanır; kaynak katalog
verisinin harf biçimi değiştirilmez.

**SEÇİLMEYEN DEĞER SATIR AÇMAZ.** Boş, `—`, “Seçim yapılmadı” veya “Seçilmedi”
olan katalog seçimi satırı rapora basılmaz. Yürütme freni seçilmemişse hem özet
hesap raporundan hem ekipman listesinden düşer; boş bir karar satırı bırakmaz.

**TEKNİK ÖZELLİK SIRASI BELGE KARARIDIR:** genel bilgiler → ana/yardımcı/
monoray kaldırma grupları → ana/yardımcı/monoray araba yürütme grupları →
köprü yürütme → ortak frenler. Başlık bandı eklenmez; anlamlı sıra satırların
kendisinden okunur. “Kaldırma Donanımı” belirsiz etiketi kullanılmaz; grup adı
etikettedir (`Ana Kaldırma Donanımı`, `Yardımcı Kaldırma Donanımı` …) ve
değer halat donanımını da taşır (`Çift Tambur - 4/16`). Aynı sıralı/zengin
kaynak el kitabının sınıflandırma, karakteristik ve hız tablolarını besler.

**KAPAK KÜNYESİ VİNÇ TİPİYLE BAŞLAR.** Proje başlığının altındaki ikinci bir
serbest “Portal Vinç” satırı yoktur; `VİNÇ TİPİ` künye tablosunda kapasitenin
üstündeki ilk satırdır ve değeri büyük harfle basılır.

**Dosya adı tek yerdedir: `pdf/doc-naming.ts`.** Firma kuralı
**İŞ ADI - DOKÜMAN KODU - VERSİYON**, tamamı BÜYÜK HARF, sonda belgenin
türü/seviyesi:

    AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-HR-0055-R01 - V1 - DETAYLI.pdf
    AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-EQ-0055-R01 - V1 - EKİPMAN LİSTESİ - DETAYLI.pdf
    MUHTELİF VİNÇLER - 0075 - FR.11.02 - İŞ EMRİ.pdf

Büyük harf `tr-TR` ile yapılır (`toUpperCase()` "i"yi "I" yapar). Doküman kodu
`docCode(kind, docNo, revNo)` ile üretilir ve PDF'in kendi künyesiyle AYNI
fonksiyondan gelir — dosya adı ile belgenin içi ayrışamaz.

### Teknik Ressam Özeti — ressamın belgesi

Ekipman listesi PDF'i `scope = "full"` iken bir EKİPMAN DÖKÜMÜ değil bir
ÇİZİM PAKETİdir (kullanıcı isteği, 19.08.2026). Beş yaprak grubu, bu sırayla:

1. **Ortak Marka Kapağı** — hesap raporuyla aynı bileşendir: ORION bandı,
   Rapor Firması, son müşteri logosu, güncel proje adı, vinç yeri, vinç
   özellikleri ve alttaki Müşteri/Tarih/Hazırlayan/Kontrol/Revizyon satırı.
   Yatay A4'te vinç özellikleri iki eşit kolona bölünür.
2. **Bölüm Dizini** — bütün ekipman gruplarını sıra numarası aralığıyla tek
   yatay yaprakta verir. Grup sayısı arttığında iki kolona bölünür; her satır
   PDF içi bağlantıyla tablo bandına gider.
3. **Teknik Özellikler** — hesap raporunun özet sayfasındaki tablonun
   KENDİSİ. Veri `summarySpecsForReport`, çizen bileşen `FieldTable`; ikisi de
   `pdf/report.tsx`ten dışa açıktır. İkinci bir tablo yazılsaydı iki belge bir
   gün farklı alan basardı ve ressam hangisinin güncel olduğunu bilemezdi.
   Kapatılan bölümlerin alanları burada da düşer (`specFieldVisibleForModules`).
4. **Ekipman Listesi** — bütün bölümlerde kesintisiz sıra numarası kullanır;
   çift numaralı satırlar soluk gri zeminlidir. PDF, ekran ve Excel aynı
   sırayı taşır. Ekipman/Marka/Özellikler alanları genişletilmiş, Ek
   Özellikler daraltılmıştır; Ek Belge yalnız kompakt `EK` göstergesidir.
5. **Teknik Ressam Özeti** — ölçü çizelgeleri + şemalar + Notlar.

**HER GRUP AYRI BİR `BrandPage`TİR, `break` DEĞİL.** Ekipman tablosunun başlığı
`fixed`tir ve aynı sayfa bileşeninin BÜTÜN yapraklarında tekrar eder; özet
`break` ile aynı bileşenin içindeyken "Ekipman · Marka · Model" şeridi ölçü
çizelgelerinin de tepesinde çıkıyordu. `BrandBand` belgede BİR KEZ, ortak marka
kapağında durur; devam yapraklarında ORION metni ve rapor firması logosu
`PageHeader` içinde aynı satırda tekrarlanır.

**RAPOR FİRMASI KİMLİĞİ ÜÇ PDF'TE TEK KAYNAKTIR.** `projects.report_brand_customer_id`
arayüzde **Rapor Firması** olarak adlandırılır. `loadReportCoverIdentity`
seçili firmanın adını ve normalize edilmiş logosunu yükler; hesap raporu,
ekipman listesi ve işletme-bakım kitabı bu aynı kimliği kullanır. Seçim yoksa
ortak kimlik bloğu/logo yuvası açılmaz; ORION bandı tek başına kalır.

**ÖZET YATAY VE İKİ SÜTUNLUDUR.** Sayfa zaten yataydı; tek sütunda etiket ile
değer kâğıdın iki ucuna düşüyor ve aradaki boşluk satırı okunmaz yapıyordu.
Izgara `wrap={false}`tir (satır yönlü bir kap sayfaya bölünemez; react-pdf
bölünmeye zorlanınca satırları ezip üst üste bindirir), bu yüzden satırlar
ÖNCEDEN öbeklenir — `SUM_ROWS_PER_BLOCK` = 20 (iki sütun × 10 satır ≈ 130 pt).
Uzun bir çizelge (tambur, kamber kotları) yaprak sınırında kendi öbeğinden
devam eder. Excel'de aynı sayfa artık YATAY basılır; ekipman sayfası zaten
öyleydi.

**ŞEMA BÖLÜMÜN İÇİNDEDİR.** `SummarySection.diagram` hesap raporundaki AYNI
üreticiden gelir (`diagramsForSection`) — ekrandaki, hesap raporundaki ve
ressam özetindeki resim ayrışamaz; o fark yanlış kesilmiş bir sac demektir.
Başlık şemasıyla birlikte taşınır (`wrap={false}`), yoksa resmin hangi bölüme
ait olduğu anlaşılmaz. **Excel şema BASMAZ** (ExcelJS yalnız raster alır,
diyagramlar vektördür ve hücre ızgarasına oturmaz); bölüm atlanmaz, yerine
"Şema — yalnız PDF ve ekran" satırı basılır — sessiz bir boşluk "unutulmuş"
okunurdu.

**SATIRIN AÇIKLAMASI ETİKETİN ALTINDADIR** (`SummaryRow.note`), dördüncü bir
sütun AÇILMAZ: Excel'de sütun sayısı bant genişliği, filtre aralığı, merge ve
kenarlık döngüsü olmak üzere beş ayrı yere gömülüdür ve biri unutulursa
sessizce bozulur. Excel'de açıklama etiket hücresine `—` ile eklenir.

**NOTLAR EN SONDADIR** (`kind: "notes"`): mühendisin ressama yazdığı serbest
metin, satır sonları korunarak. Kaynağı `equipment_drawing_notes` tablosudur —
revizyon snapshot'ı DEĞİL, çünkü `saveRevision` `inputs`u bütün olarak eziyor
ve yayınlanmış revizyonda `guard_issued_revision` her yazmayı reddediyor; not
ise bir hesap değeri değil TESLİM katmanıdır (`equipment_notes` ile aynı
gerekçe) ve yeni revizyona `copyDrawingNotes` ile taşınır.

**STANDART VE DETAYLI LİSTE AYNI PAKETİ TAŞIR.** `detay=1` yalnız katalog
sayfası eklerini ve belge içi bağlantı hedefini değiştirir; teknik özellik
yaprağı, şemalar ve notlar `scope`a bağlıdır. Müşteri kapsamında (`scope
= "customer"`) üçü de hiç basılmaz.

**ÇEVİRİCİ TEKTİR: `pdf/diagram.tsx`.** `DiagramEl` → react-pdf SVG çevirisi
bir süre iki yerde yazılıydı ve ikinci kopya sessizce eksikti (`circle` dalı
yoktu — halat kesiti, makara ve grafik çalışma noktası kayboluyordu; `bold` ve
çizgi ucu da yok sayılıyordu). `PdfDiagram` İKİ YÖNDEN kelepçelenir
(`maxWidth` + `maxHeight`): yalnız genişlik verilirse kareye yakın bir çizim
yaprağı taşırır ve `wrap={false}` kutusu bir sonrakine atlayıp orada da taşar.

**MOBİLDE “PDF İNDİR” GÖRÜNTÜLEYİCİYE YÖNLENDİRMEZ.** Üretilen uygulama
belgeleri `PdfDownloadLink` / `PdfDownloadForm` üzerinden aynı kaynaklı blob
olarak alınır ve gerçek dosya adıyla İndirilenler/Dosyalar'a bırakılır.
Telefon dosya paylaşımını destekliyorsa indirme bildirimi `Paylaş` eylemini
açar. Bağlantının gerçek `href`/form `action` değeri korunur; JavaScript
yoksa sunucunun `Content-Disposition: attachment` davranışı yedektir. Bu
sözleşme teklif, maliyet, hesap raporu, ekipman listesi, kılavuz, iş emri,
bordro, satın alma talebi/siparişi, hammadde/kesim planı ve üretilen teknik
resim paketleri için ortaktır. Korumalı ASIL teknik resim görüntüleyicisi bu
kurala girmez; RESIM-21'in indirme/yazdırma kısıtı değişmez.

**KULLANICI VE MÜŞTERİ PROFİLLERİNİN PDF KARŞILIĞI VARDIR.** Profil başlığındaki
küçük **PDF İndir** eylemi, admin yetkisini uçta yeniden doğrulayan Node route'a
gider. Belge `pdf/profile-report.tsx`te `BrandPage`, `BrandBand`, onaylı logo,
Archivo/Plex Mono, kırmızı omurga, firma künyesi ve folio ile üretilir;
`next.config.ts` `/admin/**` için font/marka varlıklarını Vercel trace'ine alır.

Ekran ve PDF aynı saf analiz çekirdeğini çağırır; puan ya da oran ikinci kez
yazılmaz. Kullanıcı belgesi aktif süre/bölüm/cihaz/oturum/denetim izini ve
mahremiyet sınırını; müşteri belgesi künye/puan/para birimi toplamı/teklif/iş/
proje/kişi gruplarını taşır. Uzun teklif listesi otomatik adsız devam yaprağına
bırakılmaz: 15 satırlık markalı `BrandPage` parçalarına bölünür, her yaprakta
başlık ve künye korunur.

## Vinç kimlik plakası ve müşteri doküman portalı

**PROJE BELGE PAKETİDİR, ÜNİTE FİZİKSEL VİNÇTİR.** Bir proje/iş kalemi hesap
raporu, ekipman listesi, elektrik projesi ve el kitabı gibi ortak teslim
belgelerini taşır. Aynı vinçten iki veya daha fazla üretildiğinde belgeler
çoğaltılmaz; `crane_units` kayıtları `A`, `B`, `C` son ekleriyle ayrı seri
numarası, ayrı QR kimliği, ayrı parola ve ayrı oturum taşır. Paket revizyonu
ortaktır; hangi fiziksel vincin eriştiği denetim izinde üniteden okunur.

**OTOMASYON BİR ÖNERİDİR, YAYIM MÜHENDİS KARARIDIR.** `data-server.ts` proje,
iş kalemi, yayımlanmış hesap/el kitabı revizyonu, elektrik projesi, şartname ve
teknik resim paketlerinden kimlik alanlarını ve belge adaylarını çözer. Taslak
her kaynak yenilemesinde güncellenebilir; alan bazlı override, gizleme, başlık,
klasör, sıra ve erişim kipi kullanıcıya aittir. “Kaynağa dön” yalnız seçilen
override'ı kaldırır. Müşteri hiçbir taslağı görmez; yalnız açıkça yayımlanmış
paketi görür.

**YAYIMLANMIŞ PAKET SNAPSHOT'TIR.** `product_portal_revisions` ve ona bağlı
`product_portal_files` yayımdan sonra değiştirilemez. Yayım anında seçilen her
PDF `customer-portal` özel kovasına maddi bir kopya olarak konur; kaynak rapor
sonradan değişse bile sahadaki QR'ın R01 paketi sessizce değişmez. Değişiklik
yeni `Rnn` paketidir. Portalda her zaman son yayımlanmış paket gösterilir.

**QR YALNIZ KALICI KISA URL TAŞIR.** Parola, müşteri adı ve belge adresleri QR
içine yazılmaz. Plaka basıldıktan sonra içerik değişebilir ama URL ve alan adı
kalır. `public_code` tahmin edilmesi zor bir yönlendirme kimliğidir; gerçek
yetkilendirme ünite parolası, DB tabanlı deneme sınırı ve 12 saatlik HttpOnly
oturumla yapılır. Parola açık metin saklanmaz; scrypt özeti saklanır ve yeni
parola üretildiğinde eski oturumlar kapanır.

**PLAKA TEK GEOMETRİDEN ÇIKAR.** Varsayılan ölçü `240 × 160 mm`dir. Yönetim
önizlemesi ve baskıya giden SVG aynı `buildNameplateSvg` fonksiyonudur; ekran
CSS'i SVG'yi yalnız orantılı küçültür, fiziksel `mm` ölçüsünü değiştirmez. Onaylı
beyaz ORION SVG logosu, Archivo/Plex Mono, arduvaz zemin, kağıt rengi metin ve
siyah/beyaz `Q` hata düzeltmeli QR kullanılır. QR kare kalır ve dört modül
sessiz alan taşır. Montaj deliği ölçüsü üretim kararıdır; açıkça verilmeden
çizilmez.

**MÜŞTERİ PORTALI İÇ UYGULAMANIN KABUĞU DEĞİLDİR.** `/paylas/vinc/[code]`
oturumsuz route grubundadır, `noindex` taşır ve yalnız yayımlanmış DTO'yu
gösterir. Admin/mühendis önizlemesi de aynı `CustomerPortalView` bileşenidir;
iframe veya ikinci bir yaklaşık tasarım yoktur. Portal metadatası ve özel
depo nesneleri normal authenticated kullanıcıya açılmaz; public route yalnız
server-side service-role veri katmanından, oturum + dosya allowlist'i
doğrulandıktan sonra okur.

**“GÖRÜNTÜLE” DRM DEĞİLDİR.** `view_watermarked` PDF'i ham dosya bağlantısı
vermeden canvas üzerinde, seri/oturum/tarih filigranıyla gösterir; indirme ve
yazdırma düğmesini kaldırır ama ekran görüntüsünü teknik olarak engelleyemez.
Yasal veya teslim gereği indirilebilir belgeler (özellikle el kitabı) açıkça
`download` kipinde yayımlanır. Erişim kipi dosya bazındadır ve yayım snapshot'ına
donar.
