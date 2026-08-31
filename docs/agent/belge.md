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

## BELGE-6 — QR'ın yazılı yedeği zorunludur.

Plaka sahada on yıl durur; kod
kirlenir, çizilir, boya alır. Kodun ve adresin insan-okunur hâli QR'ın altında
basılır. QR modülü `QR_MODULE_MIN_MM` altına inerse yerleşim uyarı verir.

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
