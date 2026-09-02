# Belge kimliği, PDF ve Excel

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/belge.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/pdf/**` · `src/lib/excel/**` · `src/lib/product-portal/**` · `src/components/customer-portal/**` · `src/app/(app)/projects/[id]/product-portal/**` · `src/app/(public)/paylas/resim/**` · `scripts/check-pdf-layout.py`


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

### Hesap raporunun dört seviyesi ve özel teker yükleri çıktısı

`ReportLevel` yalnız ayrıntı düzeyi değil BÖLÜM KAPSAMI da seçer (kullanıcı
kararı, 12.08.2026; dördüncü seviye 02.09.2026):

| | Özet | Basit (Kompakt) | Standart | Detaylı |
|---|---|---|---|---|
| Kapak + Özet bölümü | ✓ | ✓ | ✓ | ✓ |
| İçindekiler | — | — | ✓ | ✓ |
| Hesap bölümleri | — | ✓ (iki sütunlu KART; planlı satırlar) | ✓ (yalnız sonuç) | ✓ (formüllerle) |
| Şemalar | — | — | ✓ | ✓ |
| Kontrol Özeti | — | — | — | ✓ |
| Ek — Kaynaklar | — | — | ✓ | ✓ |
| Gizlilik koşulları | — | KISA, son hesap sayfasının dibinde | KISA (Ek'te) | TAM (Ek'te) |

**BASİT SEVİYE MÜŞTERİYE "KOMPAKT" DİYE GİDER** (kullanıcı kararı, 02.09.2026:
*"Müşteri tabi basit olarak bilmeyecek."*). Uygulama içinde — PDF Rapor
menüsü, vinç kimliği belge seçimi, el kitabı ek ayarı — seviyenin adı
"Basit"tir; dosya adı (`REPORT_LEVEL_LABELS.basit = "Kompakt"`), portal belge
başlığı (`PORTAL_REPORT_TITLE_LABELS`) ve belgenin kendisi "basit" sözcüğünü
taşımaz. Kapakta ve altbilgide belge adı her seviyede olduğu gibi **HESAP
RAPORU**dur; seviye adı belgeye hiç yazılmaz.

**KOMPAKT RAPORUN HESAP SAYFALARI TEK AKIŞTIR, İKİ SÜTUNDUR.** Bütün modüller
tek `BrandPage`de ("HESAP SONUÇLARI" anteti) art arda akar; her modül koyu
bölüm bandıyla (`SectionTag`, `12/13 UYGUN` sayacıyla) başlar ve alt bölümleri
yarım sütunluk KARTLARDIR: numara + ad, ürün satırı (özet sayfasındaki "Ana
Ekipman Seçimleri" satırının KENDİSİ — iki yerde iki ayrı biçimleyici aynı
motoru farklı yazardı), planla seçilmiş girdi/seçim/sonuç satırları ve
kontroller (`✓ Tork kapasitesi · CMAA 70 … 22,07 kNm ≤ 22 kNm`).
**KARTTA UYGUNLUK ROZETİ YOKTUR** (kullanıcı kararı, 02.09.2026: *"alt
bölümlerde 3/3 uygun yazıları olmasın; sadece ana bölümdeki 14/14 uygun görünse
yeter"*); kartın yargısını sol kenar rengi ve ✓/✗ satırları taşır.
**EK YOKTUR:** Kaynaklar ve Standartlar basılmaz, KISA gizlilik metni hesap
akışının SON parçası olarak son kartın altına girer (`LegalTermsBlock dense`,
sığmazsa bütün hâlde sonraki yaprağa geçer — hukukî beyan yarım basılamaz).
Hangi satırın basılacağı `pdf/report-compact.ts`teki PLANDAN gelir — genel bir
kural rastgele sonuç üretiyordu; seçim mühendislik yargısıdır ve
`report-compact.test.ts` her anahtarın adaptörde var olduğunu doğrular.
Planı olmayan bölüm ürün satırı + kontrollerle basılır. Bilgilendirme
(`kind: "bilgi"`) kontrolleri ve onay/varlık kontrollerinin sayıları basılmaz.

**KARTLAR SAYFAYA BÖLÜNMEZ, BLOKLAR HÂLİNDE TAŞINIR.** react-pdf satır yönlü bir
kabı sayfa sınırında bölemez; iki uzun sütunu yan yana akıtmak bu yüzden
yasaktır. Kartlar yükseklik TAHMİNİYLE (`estimateCompactCardHeight`) küçük
bloklara paketlenir (`packCompactBlocks`: dengeli bölme, sırayı koruyan iki
sütun, bölüm bandıyla taşınan küçük ilk blok, geniş kart kendi bloğu) ve her
blok `wrap={false}`tir. Tahmin bilerek üstten verilir; taşmayı
`check-pdf-layout.py` ölçer. Sayfa doluluğu V5'te ortalama %88 (ölçüldü,
02.09.2026); bir bloğun sığmadığı sayfa dibinde en çok bir blok kadar boşluk
kalır ve bu kabul edilmiş bedeldir.

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

Kurallar PDF'in METNİNDEN ölçülerek korunur
(`__tests__/report.smoke.test.tsx` — "rapor seviyeleri" bloğu): bileşen ağacına
bakmak, seviyenin gerçekten belgeye yansıdığını göstermez. Yerleşim denetçisi
(`scripts/check-pdf-layout.py`) özet ve kompakt raporda içindekiler ARAMAZ;
ayrımı dosya adından değil belgenin kendisinden okur (`has_module_sections` —
kompakt rapor "BÖLÜM nn" anteti basmadığı için o kapıdan geçmez).

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
yeni `Rnn` paketidir. Yanlış yayımda snapshot silinmez: `current_revision_id`
geri çekilir, bütün ünite erişimleri kapatılır ve oturumlar iptal edilir.
Arşivdeki dosyaları hazır bir `issued` sürüm aynı işaretçiye yeniden bağlanarak
geri alınabilir; ünite erişimini yeniden açmak ayrıca bilinçli bir operatör
kararıdır. Yeni taslak en yeni arşivi değil, önce aktif sürümü kopyalar.

**QR YALNIZ KALICI KISA URL TAŞIR.** Parola, müşteri adı ve belge adresleri QR
içine yazılmaz. Plaka basıldıktan sonra içerik değişebilir ama URL ve alan adı
kalır. Origin, şirket web adresinden türetilmez; sunucudaki
`CUSTOMER_PORTAL_ORIGIN` (ve Vercel üretim adresi/istek hostu yedeği) ile bu
uygulamanın dış portalına bağlanır. `public_code` tahmin edilmesi zor bir yönlendirme kimliğidir; gerçek
yetkilendirme ünite parolası, DB tabanlı deneme sınırı ve 12 saatlik HttpOnly
oturumla yapılır. Parola açık metin saklanmaz; scrypt özeti saklanır ve yeni
parola üretildiğinde eski oturumlar kapanır. QR hazırlık kutusu aktif paket,
parola ve ünite erişimini ayrı ayrı gösterir; bu üçü tamamlanmadan plaka
bağlantısı müşteri erişimine hazır sayılmaz.

**PLAKA TEK GEOMETRİDEN ÇIKAR.** Varsayılan ölçü `240 × 160 mm`dir. Yönetim
önizlemesi ve baskıya giden self-contained SVG `createNameplateLayout`
geometrisini kullanır; istemcide oluşturulan tek sayfalık vektör PDF de aynı
geometriyi tam fiziksel `mm` sayfa ölçüsüne çizer. Ekran CSS'i yalnız orantılı
küçültür. Plaka marka kılavuzundaki kömür (`ink`), kâğıt ve ORION kırmızısı
omurgayı; onaylı beyaz ORION logosunu ve Archivo/Plex Mono yazılarını kullanır.
Son müşteri kimliği (`projects.end_customer_id`) varsa normalize edilmiş
müşteri logosu başlık bandına gelir, yoksa müşteri adı yedektir. Uzun ürün adı
kesilmez veya üç nokta yapılmaz: gerçek baskı genişliğine göre dengeli iki
satıra bölünür; iki satıra da sığmıyorsa baskıdan önce açık uyarı gösterilir.
Siyah/beyaz QR `Q` hata düzeltmeli, kare ve dört modül sessiz alanlıdır. Montaj
deliği ölçüsü üretim kararıdır; açıkça verilmeden çizilmez.

**BELGE TÜRÜ VE KLASÖR KONTROLLÜ SÖZLÜKTÜR.** Hesap raporunda `Özet`,
`Standart`, `Detaylı` ve `Teker Yükleri`; ekipman listesinde `Standart` ve
`Detaylı` kullanıcı tarafından seçilir. Seçim yayım sırasında mevcut PDF
uçlarından maddileştirilir; kaynak revizyon yenilenince otomatik başlık ve
revizyon etiketi güncellenir, elle değiştirilmiş başlık korunur. Klasör serbest
metin değildir: dropdown, anahtar/başlık/sıra üçlüsünü birlikte değiştirir.
Hesap raporları, ekipman listeleri, işletme-bakım, elektrik projeleri, proje
belgeleri, teknik resimler ve diğer belgeler tek sözlükten gelir.

**MÜŞTERİ PORTALI İÇ UYGULAMANIN KABUĞU DEĞİLDİR.** `/paylas/vinc/[code]`
oturumsuz route grubundadır, `noindex` taşır ve yalnız yayımlanmış DTO'yu
gösterir. Admin/mühendis önizlemesi de aynı `CustomerPortalView` bileşenidir;
iframe veya ikinci bir yaklaşık tasarım yoktur. Portal metadatası ve özel
depo nesneleri normal authenticated kullanıcıya açılmaz; public route yalnız
server-side service-role veri katmanından, oturum + dosya allowlist'i
doğrulandıktan sonra okur.

Yönetim sayfasında müşteri yüzü uzun bir alt panel değildir; geniş bir dialog
içinde açılır. Taslak ve yayındaki snapshot aynı dialogda değiştirilebilir ve
seçili A/B/C ünitesinin seri numarasıyla gösterilir.

**PORTAL YENİ SUNUCU FONKSİYONU EKLEMEZ.** Vercel Hobby dağıtımı en fazla 12
function kabul eder ve uygulamanın mevcut fonksiyon + proxy bütçesi doludur.
Vinç portalının HTML yüzü `next.config.ts` rewrite'ıyla zaten var olan
`/paylas/resim/[token]` müşteri paylaşım fonksiyonunda; giriş, content ve indir
işlemleri de var olan `/paylas/resim/[token]/content` fonksiyonunda çalışır. QR
ve tarayıcı yine temiz `/paylas/vinc/[code]` adresini görür. Portal işlemleri
ayrı `route.ts` dosyalarına, portal listesi veya belge görüntüleyici ayrı
`page.tsx`lere bölünmez. İsim plakası SVG/PDF çıktısı da ayrı sunucu ucu açmaz:
yönetim sayfasına gömülen aynı saf geometri, logo ve font verileri tarayıcıda
dinamik istemci parçasıyla Blob olarak üretilir. Böylece baskı dosyası
self-contained kalırken dağıtım bütçesi
aşılmaz. İşlem ayrımı mevcut content ucu içinde HTTP yöntemi ve rewrite'ın
eklediği kesin `portal`/`action` sorgularıyla, belge seçimi sayfada
`?belge=<uuid>` ile yapılır; her ikisi de aynı oturum/allowlist denetimini
çağırır.

**YAYIM ACTION'I PDF ROUTE MODÜLÜ IMPORT ETMEZ.** Ekipman listesi ve el kitabı
snapshot'ı, kullanıcının oturum çereziyle aynı origin'deki mevcut auth'lu PDF
uçlarına `fetch` edilerek alınır. Bu bir kod tekrarını önleme ayrıntısından daha
fazlasıdır: route modülünü `materialize-server.ts` içine doğrudan import etmek
canvas, katalog ve react-pdf bağımlılıklarını proje sayfasının Server Action
trace'ine taşır; Vercel'in yaklaşık 225 MiB fonksiyon gruplama eşiğini aşarak
Hobby dağıtımını gereksiz ek lambdalara böler. Canlıda hedef origin güvenilir
`VERCEL_URL`den, yerelde istek hostundan kurulur; çerez başka origin'e
gönderilmez.

**“GÖRÜNTÜLE” DRM DEĞİLDİR.** `view_watermarked` PDF'i ham dosya bağlantısı
vermeden canvas üzerinde, seri/oturum/tarih filigranıyla gösterir; indirme ve
yazdırma düğmesini kaldırır ama ekran görüntüsünü teknik olarak engelleyemez.
Yasal veya teslim gereği indirilebilir belgeler (özellikle el kitabı) açıkça
`download` kipinde yayımlanır. Erişim kipi dosya bazındadır ve yayım snapshot'ına
donar.

## Vinç kimlik plakası — yasal içerik ve baskı geometrisi

## BELGE-1 — Plaka yasal bir isim plakasıdır, teknik künye değil.

2006/42/AT Ek I md. 1.7.3 makinenin üzerinde şunları ister: imalatçının ticari
unvanı ve TAM ADRESİ, CE işareti, makine tanımı, SERİ VEYA TİP TANIMLAMASI,
seri numarası ve İMALATIN TAMAMLANDIĞI YIL. Kaldırma makinesinde md. 4.3.3
azami çalışma yükünün "belirgin" işaretlenmesini de ister. İlk sürüm bunların
hiçbirini taşımıyordu. `manufacturerAddress`, `machineModel` ve `mass` alanları
bu yüzden eklendi; DB karşılıkları yoktur çünkü payload JSONB'dir ve
`withProductPortalDefaults` eksik anahtarı boş dizeye indirir.

## BELGE-2 — Yasal alanlar gizlenemez.

`NAMEPLATE_TOGGLE_FIELDS` yalnız
isteğe bağlı satırları taşır; `NAMEPLATE_MANDATORY_FIELDS` anahtar SUNMAZ ve
`visibleValue` gizleme isteğini bu alanlarda yok sayar. Anahtarı sunmak, bir gün
birinin yasal bir satırı kapatması demekti.

## BELGE-3 — CE işareti bir beyandır.

`plate.ceMark` varsayılan AÇIKTIR ama
kapatılabilir: uygunluk değerlendirmesi tamamlanmamış bir makineye CE basmak,
eksik bir plakadan çok daha ağır bir hatadır. İşaret 765/2008/AT oranlarında
VEKTÖR olarak çizilir (raster kazımada bozulur) ve 5 mm altına inerse yerleşim
uyarı üretir.

## BELGE-4 — Ölçü değiştirmek tasarımı yeniden akıtmaktır.

Yerleşim artık
gerçek mm kutusundan hesaplanır; eski `scale = min(w/240, h/160)` orantılı
küçültmesi bütün yazıları birlikte küçültüyor ve 3:2 dışındaki ölçüde çizimi
mektup kutusuna düşürüyordu. Yazı tabanları okunabilirlik eşiğiyle AYNIDIR
(`READABLE_MIN_MM`); yazı o sınırın altına inmez, onun yerine "satırlar
sığmıyor" denir. `NAMEPLATE_SIZE_PRESETS` yalnız zorunlu bloğu okunur taşıyan
ölçüleri sunar — 120 × 80 mm bilerek listede yoktur.

## BELGE-5 — Harf aralığı konumla verilir.

@react-pdf'in yerleşim motoru
`letterSpacing`i OKUMAZ, SVG okur; iki çıktı sessizce ayrışıyordu. Aralıklı
yazılar `trackedGlyphs` ile karakter karakter konumlanır ve iki çizici de aynı
x dizisini basar.

## BELGE-6 — QR'ın yazılı yedeği zorunludur; yedek KODDUR, adres değil.

Plaka sahada on yıl durur; kod kirlenir, çizilir, boya alır. **16 haneli KODUN**
insan-okunur hâli QR'ın altında basılır ve zorunludur. QR modülü
`QR_MODULE_MIN_MM` altına inerse yerleşim uyarı verir.

**ADRES SATIRI KALDIRILDI** (kullanıcı kararı, 02.09.2026): *"…/qr/XXXX linkine
gerek yok, kullanıcı bunu yazarak giremez zaten, QR'la girsin."* Doğrudur —
otuz iki karakterlik bir adresi telefona elle yazmak gerçekçi bir kurtarma yolu
değildir; kod ise kısadır ve portalın arama kutusuna girer. Yedeğin kendisi
kalkmadı, BİÇİMİ değişti. Adres satırını geri koymayın.

## BELGE-6b — Plakanın alt bandı yalnız YASAL künyeyi taşır; CE QR'ın altındadır.

Bandın 20 mm'lik hâli 160 mm'lik bir plakanın %14'ünü yiyordu ve CE de onun
içindeydi (kullanıcı bildirimi, 02.09.2026: *"alttaki CE ve firma bilgisi
gereksiz yer kaplıyor"*). Bant 11 mm'ye indi, CE **QR'ın altına** taşındı ve
konumu `qr` geometrisinden türetilir.

**ÜÇ SATIR SİLİNEMEZ:** imalatçının ticari unvanı, TAM ADRESİ ve imal yılı
2006/42/AT Ek I md. 1.7.3 gereği plakada BULUNMAK ZORUNDADIR (BELGE-1). "Yer
kaplıyor" isteği bandın İNCELMESİYLE karşılanır, satırların silinmesiyle değil.

## BELGE-6c — Plaka HER ÖLÇÜDE tek sayfadır ve çizim sayfadan 0,05 pt kısadır.

`<Svg>` react-pdf'te sayfa bölünemez bir düğümdür. Yerleşim sayfanın
yüksekliğini JS `double`ıyla, düğümün kutusunu yoga'nın `float32`iyle tutar;
`mm(140)` float32'de YUKARI, `mm(160)` AŞAĞI yuvarlanır — yani hangi ölçünün
ikinci sayfa doğuracağı saf kayan nokta tesadüfüdür (ölçüldü: 240×160 tek,
200×140 ve 160×110 İKİ sayfa). `<Page wrap={false}>` sayfalamayı atlar **ama
sayfa kutusunun yüksekliğini de sıfırlar** (`getPageCount` 1, `getHeight()` 0);
kullanılmaz. Çözüm `SAYFA_EPSILON_PT = 0.05`: float32'nin bu büyüklükteki bağıl
hatası ~3·10⁻⁵ pt'dir, epsilon bin kat pay bırakır ve görsel karşılığı
0,018 mm'dir. **Sayfa sayısı testi üç hazır ölçüde de koşar** — tek ölçü sınamak
bu hatayı iki hafta sessiz bırakmıştı.

## BELGE-7 — Plakaya kazınan adres `/qr/<kod>`tir.

İki sebeple: portalın iç
yolu (`/paylas/vinc/...`) bir gün değişebilir ama basılmış plaka sökülemez; ve
11 karakter kısalık, aynı alanda daha büyük QR modülü demektir. Adres KALICI
olmalıdır — `CUSTOMER_PORTAL_ORIGIN` tanımlı değilse ve adres istek başlığından
türetilmişse plaka indirmesi KAPALIDIR, yoksa `localhost` adresli bir plaka
fabrikaya gidebilirdi.

## BELGE-8 — Tarayıcıda PDF üretimi CSP ister.

Plaka uygulamanın tek istemci
tarafı belgesidir. `worker-src 'self' blob:` (alfa kanallı marka PNG'si →
pdfkit `splitAlphaChannel` → fflate blob worker) ve `connect-src … data:`
(yoga-layout WASM) olmadan üretim NE ÇÖZÜLÜR NE REDDEDİLİR: düğme sonsuza kadar
"Hazırlanıyor"da kalır ve `catch` hiç çalışmaz. `nameplate-pdf.tsx` bu yüzden
zaman aşımı taşır. Plaka fontları `public/fonts/` altındadır ve `proxy.ts`
matcher'ı font uzantılarını MUAF TUTAR — muafiyet olmadan `.ttf` isteği giriş
sayfasının HTML'ini **200** ile döndürüyor, fontkit "Unknown font format" diyor
ve indirilen SVG'ye font yerine giriş sayfası gömülüyordu.

## Müşteri portalı erişimi

## BELGE-9 — Kilit kendini uzatmaz.

`consume_product_portal_login_attempt`
kilitliyken sayacı ARTIRMAZ ve `locked_until`e dokunmaz. Eski hâl her denemede
15 dakika ileri atıyordu: parolasını yanlış hatırlayan müşteri, denemeye devam
ederek kilidi kendi eliyle sonsuza uzatıyordu. Başarılı girişte hem istemci hem
PORTAL kovası sıfırlanır — tek bir yabancının denemeleri gerçek müşteriyi
kilitlemesin.

## BELGE-10 — Kilit ile yanlış parola aynı şey değildir.

Giriş ucu sebebi
`?hata=parola|kilit|yayin` ile taşır; sayfa üçünü ayrı anlatır. Kilitli olduğunu
bilmeyen müşteri denemeye devam eder.

## BELGE-11 — Gizlenen alan portalda da görünmez.

`hiddenFields` yalnız plaka
tarafından okunuyordu; `loadCustomerPortalDto` ve önizleme DTO'su da uygular.
Gizleme bir karardır ve iki yüzde de geçerlidir.

## BELGE-12 — Filigranlı belge adres çubuğundan açılamaz.

`Sec-Fetch-Dest`
üst gezinmeyi (`document`) görüntüleyicinin `fetch`inden (`empty`) ayırır; ham
PDF baytı yalnız görüntüleyiciye gider. Bu bir DRM DEĞİLDİR (kullanıcı kararı,
30.08.2026: sayfa görüntüsüne çevirme yok) — kapatılan şey kolay yoldur.
Reddedilen her belge erişimi `document_denied` olarak denetim defterine yazılır.

## BELGE-13 — Kapak künye tablosunun sütunu KELEPÇELİDİR; `flex: 1` yalnız yatay kapakta doğrudur.

Kullanıcı bildirimi (01.09.2026): *"bakım kitapçığı kapağında tabloda sorun
var."* Kusur `SharedReportCover`daydı, yani ÜÇ belgede birden: hesap raporu,
ekipman listesi ve işletme-bakım el kitabı aynı satırı basıyor.

İki ayrı hata üst üste binmişti ve ikisi de ÖLÇÜLEREK bulundu:

1. **Sütun kapsayıcısı ana eksende sıfır yükseklikten başlıyordu.** Dikey
   kapakta kapsayıcı SÜTUN yönlüdür; oradaki `flex: 1` "eşit genişlik" değil
   `flexBasis: 0` demektir ve kapsayıcının belirli bir yüksekliği olmadığı için
   sütun büyüyemiyordu. Satırlar paylarına kadar eziliyor (satır aralığı
   12,75 pt = 6 + 6 pay + 0,75 çizgi, içerik SIFIR), 16,9 pt'lik değer yazısı
   kendi satırından 6,75 pt yukarı taşıp bir ÜSTTEKİ ayırıcı çizgiyi kesiyordu.
2. **`alignItems: "baseline"` kullanılmıştı.** 7 pt etiket ile 13 pt değeri
   baseline'da hizalamak yerleşimin enine ölçüsünü çökertiyor; KITAP-14 md. 1'in
   aynı dersi. Kenar hizası (`flex-end`) + etikete küçük bir pay.

Ayrıca iki `Text` de esnemiyordu (yoga'da `flexShrink` öntanımı 0'dır): "ÇİFT
KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ" gibi uzun bir değer satırın sağından TAŞIYORDU.
Etiket kendi genişliğinde kalır, değer kalanı alır ve gerekirse SARAR.

## BELGE-14 — CE işareti EŞ MERKEZLİ bir halkadır ve yolun içinde HAM SAYI KALMAZ.

Kullanıcı bildirimi (01.09.2026): *"sol altta CE işareti koymaya çalışmışız ama
olmamış."* `ceMarkPath` bütün koordinatları ölçekliyor ama YAY YARIÇAPLARINI
ham bırakıyordu (`A50 50 …`). viewBox birimi mm olduğu için 10 mm'lik bir
işarette 50 mm yarıçap isteniyor; SVG büyük yarıçapı KÜÇÜLTMEZ, `large-arc=1`
ile ~356°'lik dev bir yay çizer. Ekrandaki kocaman siyah hilal ve veri
tablosunun etiket sütununu ezen "kalın çizgi" bundandı.

İkinci hata geometrikti: uç noktalar elle yazılmıştı ve çemberin üzerinde
DEĞİLDİ, yani iki yay eş merkezli çıkmıyor ve halkanın eti yer yer 16 yerine
23 birime çıkıyordu. Yol artık MERKEZDEN kurulur: dış yarıçap 50, iç yarıçap
34, ağız yarı-açısı 40° ve uç noktalar `cx + r·cosθ` ile TÜRETİLİR. Koruma
testtedir: yolun içindeki her sayı plaka kutusunda kalır ve yarıçapların hiçbiri
işaretin yüksekliğini aşamaz.

## BELGE-15 — Aralıklı yazıda BOŞLUK da bir karakterdir.

`trackedGlyphs` her karakter için `estimatedTextWidth`i çağırıyordu; o
fonksiyonun mono dalı önce `normalized()` uyguluyor ve tek karakterlik `" "`
için `trim()` sonucu BOŞ dize dönüyordu — yani boşluğun ilerlemesi SIFIRDI.
Ölçüldü: 3 mm puntoda harf arası 0,33 mm, kelime arası 0,66 mm; "TEKNİK
DOKÜMANLAR" bitişik okunuyordu. Mono yüzde bütün karakterler aynı genişliktedir
ve ilerleme artık doğrudan `size × MONO_ILERLEME`dir. Hata İKİ ÇİZİCİDE DE
aynıydı — tek kaynak, tutarlı biçimde yanlış.

## BELGE-16 — Plaka satırının yüksekliğini DEĞER puntosu belirler.

Satır adımı yalnız kalan boşluğa bölünüyor, çakışma denetimi ise ETİKET
puntosuna (2,75 mm) göre yapılıyordu; oysa satırın gerçek yüksekliğini büyük
olan DEĞER (4,2 mm'ye kadar) belirler. Gerçekçi bir 240×160 plakada adım
3,84 mm çıkıyor, yani SATIR ADIMI YAZIDAN KÜÇÜK oluyor ve her satırın saç
çizgisi bir alttaki rakamı 1,57 mm kesiyordu. Kullanıcının "tablo bozuk"
dediği şey buydu.

Değer puntosu artık İKİ KAPIDAN geçer — genişlik (en uzun değer sütuna sığmalı)
ve YÜKSEKLİK (n satır kalan boşluğa sığmalı) — ve BİR KEZ seçilir: her satır
kendi puntosunu seçseydi aynı sütun kendi içinde dalgalanırdı. Ayırıcı çizginin
konumu (`NameplateRow.ruleY`) YERLEŞİMDEN gelir; iki çizici onu ayrı ayrı
hesaplarsa biri gün gelip kayar. Etiket sütununun genişliği de sabit oran değil
EN UZUN ETİKETİN ölçüsüdür.

**`Math.max(5, …)` UYARIYI ÖLDÜRÜYORDU.** CE yüksekliği önce 5 mm'ye
kelepçelenip sonra `< 5` diye sınanıyordu; koşul matematiksel olarak
imkânsızdı ve BELGE-3'ün "5 mm altına inerse yerleşim uyarı üretir" güvencesi
pratikte YOKTU. Doğal yükseklik AYRI ölçülür, kelepçe sonra uygulanır ve fark
kullanıcıya söylenir.

## BELGE-17 — `plate.ceMark` ve `plate.monochrome` ŞEMADA olmalıdır, yoksa hiç kaydedilmez.

Zod bilinmeyen anahtarı SESSİZCE ATAR. Kart `plate.ceMark`i gönderiyordu ama
`saveSchema.plate` onu tanımıyordu; doğrulamadan sonra anahtar yok oluyor ve
`plate: data.plate` eksik nesneyi yazıyordu. İkinci kayıp okuma yolundaydı:
`withProductPortalDefaults` plate nesnesini sıfırdan kurarken yalnız dört
anahtarı kopyalıyordu. Sonuç: kullanıcı "CE İşareti" onayını kapatıp kaydetse
bile sayfa yenilenince işaret geri geliyordu — BELGE-3'ün "kapatılabilir olması
şarttır" kuralı hiç çalışmıyordu. Bir ayarın kalıcı olması için YAZMA ve OKUMA
yollarının İKİSİ birden onu tanımalıdır.

## BELGE-18 — Yayım alt-isteği KULLANICININ ADRESİNE gider ve yönlendirmeyi İZLEMEZ.

Kullanıcı bildirimi (01.09.2026): *"Yayımla dediğimde ekipman listesi PDF
olarak üretilemedi diyor."* Mesaj kök nedeni SİLİYORDU: koşulu "yanıt 2xx ama
içerik PDF değil"dir ve ekipman ucu böyle bir yanıt ÜRETEMEZ (başarılı yolu her
zaman `application/pdf`, başarısız yolları 401/404). Yani yanıt route'tan
GELMEMİŞTİ.

İki kaynak bulundu ve ikisi de kapatıldı:

- **Origin koşulsuz `VERCEL_URL`den kuruluyordu.** O, kullanıcının tarayıcıdaki
  alan adı değil DAĞITIMA ÖZEL host'tur; takım hesaplarında Vercel'in dağıtım
  koruması (SSO) arkasındadır ve alt-istek uygulamaya hiç ulaşmadan 200 ile bir
  HTML duvarı alır. Çerez de o host'a ait değildir. Sıra terse çevrildi: önce
  isteğin kendi host'u, yalnız o yoksa üretim adresi. `?.trim()` yerine
  `|| undefined`: boş dizge nullish DEĞİLDİR ve `https://` gibi geçersiz bir
  origin üretiyordu. Protokol de hosttan tahmin edilmez — `next dev` düz HTTP
  dinler ve `x-forwarded-proto` göndermez.
- **`fetch` yönlendirmeyi izliyordu.** `proxy.ts` oturumsuz sayılan isteği
  `/login`e 307'ler; varsayılan `redirect: "follow"` ile giriş sayfasının HTML'i
  **200** ile dönüyordu — `.ttf` tuzağının (BELGE-8) aynısı: bir yönlendirme
  değil, YANLIŞ İÇERİKLİ BİR BAŞARI. Alt-istekler artık `redirect: "manual"`
  ile atılır, 3xx açık bir "oturum taşınamadı" hatası üretir ve mesaj durumu,
  içerik türünü ve hedefi taşır. Oturum çerezi hiç okunamıyorsa yayım daha
  başlamadan durur.

Üçüncü bir "2xx ama PDF değil" kapısı ekipman ucundaydı: `format` tanınmayan
ya da eksik olduğunda SESSİZCE xlsx'e düşüyordu. Artık 400 döner.

## BELGE-19 — VİNÇ KİMLİĞİ DAR EKRANDA BEŞ BÖLÜMDÜR.

Kullanıcı kararı (01.09.2026): yönetim kartı tek sayfada 17 kimlik alanı, 10
onay kutusu, plaka önizlemesi, üç portal metni ve belge listesini taşıyor —
telefonda metrelerce bir kaydırma. `lg` altında bölümler
**Üniteler · Kimlik · Plaka · Belgeler · Portal** olarak ayrılır ve
`MobileSectionGrid` ile değiştirilir (MOBIL-21: gezinme açılır listenin
arkasına saklanmaz). Masaüstünde hepsi birden görünür; **markup
ÇOĞALTILMAZ** (MOBIL-7/15), aynı düğümler koşullu sınıfla gizlenir.

**DOKÜMAN SATIRI BİR OPERASYON SATIRIDIR ve 1024 px'te SAYFAYI TAŞIRIYORDU.**
Ölçüldü: iz minimumları 220 + 430 px + "Dahil" çipi + durum/sil kümesi ≈ 890 px,
gerçek kap 703 px (MOBIL-16) → ~220 px taşma. Dört sütun `xl`e ertelenir;
`lg`de seçim öbeği daralır ve içindeki üç seçim alt alta iner. Satır `<Table>`
DEĞİLDİR, bu yüzden `oc-tablet-table` uygulanamaz — kelepçe ızgara izlerinde
verilir.

Plaka önizlemesi `2xl` yerine `xl`den itibaren yan sütuna geçer: 1024–1535
aralığında her şey alt alta yığılıyor ve plaka belgenin metrelerce altında
kalıyordu.

## BELGE-20 — VİNÇ KİMLİĞİ RAYI İKİ KİPLİDİR: DAR EKRANDA SEÇİM, GENİŞTE ÇIPA.

01.09.2026: Vinç Kimliği kartına bölüm rayı eklendi (MOBIL-29). Kart bir rota
DEĞİL, `/projects/<id>` sayfasının bir sekmesidir; belge kayar, kap `max-w-6xl`.

**AYNI SAYFADA RAYIN HER İKİ KİPİ DE GEREKİR** ve sebebi `bolumSinifi`dir:
`lg` ALTINDA yalnız seçili bölüm DOM'dadır, yani "bölüme git" bir DURUM
değişimidir (`setBolum`); `lg` ÜSTÜNDE beş bölüm birden basılır ve aynı eylem
gerçek bir KAYDIRMADIR (`capayaGit` + `useAktifCapa`). Ray ikisini de yapar.

**RAY KARTIN KÖKÜNÜN YANINA KONUR, ANA IZGARANIN İÇİNE DEĞİL.** `dokumanlar`
bölümü o ızgaranın dışındadır ve ızgarayı saran `<section>` `relative
overflow-hidden` taşır: ray oraya konsaydı hem beşinci bölümü kapsamaz hem de
kırpılırdı. Kök esnek satır `items-start` ALMAZ (MOBIL-31).

**TELEFONDA `MobileSectionGrid` KALIR** — beş hedef MOBIL-21'in sekiz sınırının
altındadır. **Erken dönüş dalında (workspace yokken) ray basılmaz**: bölüm yok.
