# ORION Proje Takip Sistemi — Yol Haritası (2026-07-19, Sinan'ın brief'i)

Kaynak dosyalar (repo dışında, `C:\Users\HP\Desktop\ORION\HESAP RAPORU KOD\`):
- `Orion Cranes Brand Identity/` (HTML marka kimliği + uploads içinde logolar) — UI/PDF branding kaynağı
- `Örnek Orion Teklif — vigowood — 12.07.2026.pdf` — kurumsal döküman görünüm örneği
- `catalog_data/` — YAPILANDIRILMIŞ katalog JSON'ları: motors (GAMAK 94 + ABB 98), ropes (hasçelik/izmit 6x36), brakes (sibre te/usb/shi, dereli), couplings (özgün b/j, jaure mt/tcbr), reducers (yilmaz dr/h, simogear), bearings (skf), hooks (din15401), rails, sheaves, wheels (FEM standart). `_version.json` sürümlü.
- `ÖRNEK 0057-00 - ASTOR-İş Emri_Muhtelif Vinçler.pdf` — iş emri formatı (bir iş emri = birden çok vinç)
- `FEM 1.001 3rd Edition.pdf` + `CMMA-specification-70.pdf` — hesapların ANA standart referansları; derinlemesine incelenecek, hesap satırlarında madde/tablo referansı verilecek

## Kesin kurallar (kullanıcı talimatı)
1. **Excel referansı YASAK**: UI/rapor/kod yorumlarında "Excel: L19", "Excel'de seçilmemiş", "V5 raporunda..." gibi ifadeler kaldırılacak. Excel yalnızca golden testlerin iç doğrulama fikstürü olarak kalır (reference/ klasörü + test dosyaları serbest; kullanıcıya görünen hiçbir yüzeyde Excel geçmeyecek). Hesap satırlarında referans = FEM 1.001 / CMAA 70 / DIN madde numaraları.
2. Rutin veri düzenlemeleri panelden; geliştirmeler kodla.

## Faz A — Hızlı düzeltmeler (öncelik)
- [x] UI'dan tüm Excel referanslarını kaldır (CalcRow'daki "Excel: X" rozetleri → standart referansı rozetine dönüşür; sections dosyalarındaki standard alanları korunur, excelRef gösterimi kapatılır; check/not metinlerindeki Excel/V5 ifadeleri temizlenir; travelSections'taki "Excel 6.6" gibi başlık notları temizlenir)
- [x] Teknik özellikler dropdown'ları:
  - Sıcaklık: min −40…0 (5°C adım), maks +40…+80 (5°C adım)
  - Kanca tipi: DIN 15401 Tekli Kanca, DIN 15402 Çift Ağız Kanca, Kaldırma Kirişi (Spreader), Polip, Mekanik Kepçe, Motorlu Kepçe, C Kancası, Diğer
  - Vinç tipi (proje/spec): Çift Kirişli Gezer Köprü Vinci, Tek Kirişli Gezer Köprü Vinci, Portal Vinç, Yarı Portal Vinç, Pergel Vinç, Alttan Askılı Vinç, Konsol Vinç (ileride hesap varyantları vinç tipine bağlanacak)
  - Donanım (reeving): 2/2, 2/4, 4/4, 4/8, 6/6, 8/8 dropdown (drivenFalls/totalFalls alanları korunuyor — ayrı ele alınacak)
  - Mil malzemesi, teker malzemesi, teker çapı (FEM serisi: 200,250,315,400,500,630,710,800,900,1000,1120,1250), tambur çapı serisi, ray tipi → dropdown
- [x] Navigasyon/genişlik düzeltmeleri: max-w-6xl kısıtı geniş ekranda dar kalıyor → tam genişlik + sihirbaz iki kolon oranı iyileştirme; bölüm navigasyonu arama/atlama; İleri/Geri sticky alt şerit.

## Faz B — Katalog dropdown sistemi
- [x] `catalog_data/*.json` → parser + Supabase `cat_equipment` seed (kind eşlemesi: motors→motor, reducers→gearbox, ropes→rope, brakes→brake, bearings→bearing, wheels→wheel, hooks→hook, couplings→coupling [cat_equipment'a ayrıca eklendi; mevcut cat_couplings korunuyor], rails→cat_rails (zaten seed'li), sheaves→sheave) — `scripts/seed-catalog.ts` → `supabase/migrations/20260719000005_catalog_seed.sql` (8732 ürün)
- [x] Şema: JSON şemaları incelendi, attrs jsonb'ye normalize edildi (snake_case teknik anahtarlar: power_kw, rpm, ratio, dia_mm, breaking_load_kn...); marka+model+attrs. `_version.json` sürümü app_settings `catalog_version` anahtarına.
- [x] Seçim UI: seçim alanı olan bölümlerde "Katalogdan Seç" combobox (arama, marka+model+ana özellik); seçilince ilgili selection alanları otomatik dolar (eşleme haritası: `src/lib/catalog-mapping.ts`). Manuel giriş mümkün kalır (katalog dışı ürün). Alternatif sistemiyle doğal entegre.
- [x] Yeni katalog ekleme akışı: JSON dosyası → `npx tsx scripts/seed-catalog.ts` ile seed migration üretimi (kod tarafı) + panelden tek tek ekleme (mevcut; makara/kaplin türleri panele eklendi).

## Faz C — Branding
- [x] `Orion Cranes Brand Identity/` HTML'lerini ve uploads/ logoları incele; renk/typografi/logoyu çıkar (Orion Kırmızısı #A41E1E, Kömür #262626, Kağıt/Gri nötr skalası; Archivo + IBM Plex Mono; logo SVG/PNG → `public/brand/`)
- [x] UI temasına uygula (sidebar logosu, renk paleti, font); login sayfası; PDF rapor kapağı/başlıklarına logo + kurumsal renkler (kırmızı omurga, kömür başlık çizgisi); Excel başlık dolgusu marka kırmızısı

## Faz D — Proje takip sistemine dönüşüm (iş emri modeli)
- Veri modeli: `jobs` (iş emri: 0057-00, müşteri, başlık) → `cranes` (iş içindeki vinçler; mevcut "project" kavramı vinç'e evrilir, doc_no şeması 00XX-YY) → her vinç için modüller: Hesap Raporu (mevcut revizyon sistemi), Ekipman Listesi (mevcut), Teknik Çizimler (yeni: çizim kaydı/dosya takibi), ileride: 3D, Malzeme Listeleri, Satınalma, Üretim.
- [x] Migration: jobs tablosu + projects.job_id; UI: İşler listesi → iş paneli (vinçler + durum kartları) → vinç paneli (hesap raporu / ekipman / çizimler sekmeleri) — `20260719000006_jobs.sql`; /jobs listesi + iş paneli ("Vinç Ekle" mevcut proje dialoguna job_id geçirir); proje sayfası sekmeli (Hesap Raporu | Teknik Çizimler | Ekipman Listesi indirme linki); bağımsız vinçler için /projects korunur (job_id null)
- [x] Teknik çizim takibi v1: drawing kayıtları (no, ad, kategori, revizyon, durum [taslak/kontrolde/onaylı], dosya linki — Google Drive URL alanı; ileride Storage upload). Google Drive klasör kategorizasyonu (0053-01-0100 KÖPRÜ YÜRÜTME GRUBU deseni) → drawing kategorileri app_settings `drawing_categories` öntanımlı listesi. Audit: job.create, drawing.create/update/delete.

## Faz E — Görsel/dinamik diyagramlar
- [x] Ana kiriş parametrik kesit çizimi (SVG, plaka girdilerinden canlı): kutu kesit, plaka etiketleri, tarafsız eksen; hesap bölümünde canlı güncellenir (`src/lib/diagrams/girderSection.ts` → sihirbaz 7.1)
- [x] Teker mili diyagramı (mesnetler, yükler, moment diyagramı) (`wheelShaft.ts` → 5.2/6.2)
- [x] Tambur/halat donanımı şeması; PDF rapora da girecek (react-pdf SVG desteğiyle) (`reeving.ts` → 2.1/3.1; PDF: `report.tsx` PdfDiagram — üreticiler saf, web+PDF ortak model `src/lib/diagrams/model.ts`)

## Faz F — FEM 1.001 + CMAA 70 derin inceleme
- [ ] İki PDF'i ajanlarla bölüm bölüm incele → `docs/standards/fem-1001-notes.md` + `cmaa-70-notes.md` (madde numaraları, tablolar, formüller — hesap satırlarının standard alanlarına doğru madde referansları girilecek)
- [ ] Ana kiriş vb. hesapları FEM 1.001'e göre derinleştir (mevcut motor korunur, referanslar/ek kontroller eklenir)

## Faz G — Rapor seviyeleri
- [x] PDF raporda "Detaylı / Standart / Özet" seçimi (revizyon sayfası "PDF Rapor" dropdown'u + `report?level=` query paramı): Özet = kapak+içindekiler+özet bölümü (kontroller dahil); Standart = + modül bölümleri (hesap satırlarında yalnız sonuç) + diyagramlar; Detaylı = tam rapor. Yayın arşivi (issueRevision) her zaman detaylı üretir. Ayrıca standart referans düzeltmeleri (calc-crossref §2 görüntü metinleri) uygulandı.

## Faz H — Rapor/hesap profesyonelleştirme (2026-07-20, Sinan geri bildirimi)
- [x] **Birimler**: tüm hesap/rapor yüzeylerinde gerilmeler MPa, momentler Nm (kg/cm², kg·cm kaldırıldı). Dönüşüm sunum katmanında (`src/lib/units.ts`, etiket bazlı: kg/cm²→MPa ×0,0980665, kg·cm→Nm, N/mm²→MPa relabel). Motor iç birimleri korunur → golden testler etkilenmez. Tambur/mil kaynağı izin gerilmesi girdileri MPa'ya taşındı (defaults+fields+hoistGroup check natif MPa).
- [x] **Profesyonel matematik dizgi**: formül dizesi → MathNode ağacı (`src/lib/math/formula.ts`, kesir/kök/üs/alt indis ayrıştırıcı) → web (`components/math/math-formula.tsx`, HTML/CSS) + PDF (`lib/pdf/pdf-math.tsx`, react-pdf View/Text flexbox). Sayısal yerine-koyma satırı kaldırıldı; tanımsal/koşullu formüller düz italik metne düşer. Golden korumalı (yalnız sunum).
- [x] **Katalog seçimi marka-önce modal**: `catalog-picker.tsx` iki adımlı (marka kartları → seçilen markanın kataloğu + arama). Karışık tek liste sorunu giderildi.
- [x] **Detaylı rapor**: "Kontrol Durumu — X kontrol, Y uygun değil" özet satırı kaldırıldı (→ sade "Kontroller").
- [x] **PDF footer branding**: firma + adres/telefon/e-posta/web (panelden `app_settings` report; DEFAULT_REPORT_SETTINGS + admin/settings formu). Marka kırmızısı firma satırı + iletişim satırı.
- [x] **PDF sayfa kaymaları**: bölüm/başlık `minPresenceAhead` + başlık-diyagram `wrap={false}` (öksüz başlık/kayma önlendi).
- [x] **Tambur diyagramı**: `lib/diagrams/drum.ts` (namlu, yanak, mil, yiv, D_d/D_min/halat Ø etiketleri) → sihirbaz+PDF 2.2.1/3.2.1. Teker mili moment etiketi Nm'ye çevrildi.
- [x] **Ekipman listesi**: sütunlar Ekipman | Marka | Model | Özellikler | Adet (marka/model ayrıldı, grup başlık satırı); müşteri dosyası (`scope=customer`, yalnız ekipman listesi) ile teknik ressam özeti ayrıldı; datasheet linki altyapısı (`cat_equipment.datasheet_url` migration + admin alanı + Excel Model hücresi köprüsü, kind|brand|model eşlemesi).
- [x] **Ekipman paneli** (doğrudan indirme yerine tablo görünümü): `/…/equipment` artık panel sayfası (sekmeli: Ekipman Listesi | Teknik Ressam Özeti). Otomatik satırlar salt-okunur; "Ek Ekipman / Özellikler" bölümünde serbest satır ekleme/silme + Kaydet (`equipment_extras` tablosu, `20260720000002` migration, revizyon kilidinden bağımsız). İndirme: Excel + PDF, Müşteri/Tam kapsam seçimi (`equipment/download` route, `format=xlsx|pdf&scope=`). Yeni ekipman PDF üreticisi (`lib/pdf/equipment-report.tsx`, marka kimlikli tablo + Model hücresi datasheet köprüsü). Model hücreleri panelde de tıklanır (harici link).
- [ ] **Sonraki**: EN rapor tam çevirisi (kullanıcı: önce TR, sonra EN); datasheet linkleri için seçim-anında URL yakalama (motor/halat gibi yalnız marka tutan bileşenler).

## Faz I — İş Emri (Work Order, FR.11.02) tam modeli (2026-07-20)
Kaynak: `ÖRNEK 0057-00 - ASTOR-İş Emri_Muhtelif Vinçler.pdf`.
- [x] **Veri modeli**: `jobs` genişletildi (tarih, form kodu, müşteri adres/vergi/telefon/faks, sözleşme var+tarih, atölye çıkış/teslim tarihleri, adet, iş lideri, kapsam jsonb, hazırlayan ad/unvan) + `job_items` tablosu (ürün adı → iş no → adet, sort, opsiyonel project_id) — `20260720000003_work_order.sql` (uygulandı).
- [x] **Yeni İş formu** (`/jobs/new`) ve **Düzenle** (`/jobs/[id]/edit`): tam FR.11.02 formu — başlık, iş kalemleri editörü (satır ekle/sil, iş no otomatik öneri), müşteri bilgileri, iş bilgileri, kapsam kutucukları, açıklamalar, hazırlayan. `job-form.tsx` + `createJob`/`updateJob` (kalem tam yenileme, proje bağlantısı item_no ile korunur).
- [x] **İş paneli** (`/jobs/[id]`): iş kalemleri tablosu + müşteri/iş bilgileri kartları + kapsam rozetleri + "İş Emri PDF" indir + "Düzenle".
- [x] **İş Emri PDF** (`lib/pdf/work-order.tsx` + `jobs/[id]/work-order` route): ASTOR dokümanının düzeni — başlık, kalem tablosu, müşteri/iş kutuları, kapsam ✓ kutucukları, açıklamalar, hazırlayan. Marka kimlikli. next.config font/logo trace `/jobs/**` eklendi.
- [x] **Rapor↔iş bağlama esnekliği**: `/projects` "Yeni Hesap Raporu" dialoguna opsiyonel iş seçimi (mevcut işe bağla → müşteri/doküman no ön-doldurulur, ya da "Bağımsız (işe atanmamış)" = deneme raporu). İş panelinden "Vinç Ekle" işe sabit bağlar (mevcut).

## Faz J — Sihirbaz kullanılabilirlik turu (2026-08-02, Sinan geri bildirimi)
- [x] **Kontroller formülün yanında**: bölüm sonundaki toplu "Kontroller" bloğu kaldırıldı; her kontrol ilgili hesap satırının hemen altında ✓/✗ şeridi olarak görünür. Bağlantı haritası `src/lib/calc/presentation/check-anchors.ts` (86/86 kontrol bağlı; eşleşmeyen kalırsa bölüm sonunda "Diğer Kontroller" bloğuna düşer). Aynı düzen PDF raporda da geçerli. Eksik olan "gereken mil çapı" satırları eklendi (2.7 L254, 5.6 O170/O184, 5.7 O182/O196).
- [x] **Yardımcı kaldırma koşullu**: modül kapalıyken teknik özelliklerde yrd. kapasite/yükseklik/hız alanları ve grubu hiç görünmez (`FieldDef.requiresModule`).
- [x] **İş ↔ hesap raporu bağlantısı**: "Yeni Hesap Raporu" dialogunda iş seçimi + **iş kalemi** seçimi (kalem seçilince doküman no ve rapor adı otomatik dolar; kalemin raporu varsa uyarı). Projeler listesine **İş No** sütunu eklendi.
- [x] **Hesap bölümü gizleme**: opsiyonel modül seti genişletildi (yrd. kaldırma, kanca bloğu, **ana kiriş, buruşma, başkiriş**); kenar çubuğunda her bölümün yanında ＋/－ düğmesi. Kapalı bölüm hesaba ve rapora girmez, numaralar yeniden dizilir. **Kapalı bölümün girdileri korunur** — kayıtta `inputs.disabledModules` listesi tutulur, veri silinmez (eski `null` yazımı da okunur). Karşılaştırma ekranı bölüm aç/kapa değişimini ayrı satırda gösterir.
- [x] **Gerilim dropdownları**: besleme gerilimi (380/400/415/440/460/480/690 V) ve kumanda gerilimi (24/48 VDC, 24/48/110/220 VAC) seçilir hâle geldi.
- [x] **Teknik özellikler yerleşimi**: alanlar 8 anlamlı gruba ayrıldı (Vinç Tanımı ve Sınıflandırma, Ana/Yardımcı Kaldırma, Araba/Köprü Yürütme, Frenler, Elektrik, Ortam Koşulları) ve masaüstünde 4 (xl) / 5 (2xl) kolona açılır.
- [x] **Otomatik girdiler** (`src/lib/calc/derive.ts`): halat ağırlığı = toplam halat × metre ağırlığı × kaldırma yüksekliği (yukarı 50 kg'ın katına yuvarlanır); makara verimi makara yataklama tipinden (rulmanlı 0,98 / yüksek verim 0,985 / burçlu 0,96). Alan başına "OTOMATİK" anahtarı — açıkken salt-okunur ve her değişimde yeniden hesaplanır, kapalıyken serbest. Metre ağırlığı katalogdan gelir (`weight_kg_per_m`). Yeni iş şablonunda ikisi de AÇIK (V5 golden fikstürü etkilenmez).
- [x] **Katalog seçimi kademeli filtre + tablo**: `catalog-picker.tsx` yeniden yazıldı — marka → türe özgü filtre adımları (halatta yapı → tel mukavemeti → öz tipi) → kapasite "en az" süzgeci → sonuç tablosu. Her adımda uyumlu değerler ürün adediyle listelenir. Yapılandırma `CATALOG_KINDS` (halat, motor, redüktör, fren, kaplin, rulman, teker, kanca, makara).
- [x] **Standart referans pop-up'ı**: `src/lib/standards/registry.ts` + `standard-ref-dialog.tsx`. Hesap satırı/kontrol üzerindeki her FEM/DIN/CMAA rozeti tıklanabilir; standardın tablosu, bağıntıları ve açıklaması açılır, vincin sınıfına karşılık gelen satır vurgulanır (ör. M6 → Zp 5,6). Eski `fem-table-dialog.tsx` + `fem-tables.ts` kaldırıldı.
- [x] **Tam Türkçe**: PDF rapor ve iş emrindeki İngilizce alt başlıklar/gloss'lar kaldırıldı; katalog türleri, `attrs` anahtarları ve kısa kodlar (FC/IWRC, drum/disc/em, gear/pin…) Türkçeleştirildi (`ATTR_LABELS`, `ATTR_VALUE_LABELS`); "(Spreader)", "(Magnet)" gibi ekler atıldı.

## Faz K — Tambur mili modeli (2026-08-02, Sinan'ın teknik resimleri)
- [x] **Yeni yükleme modeli**: tambur artık **A…G ölçü zinciriyle** tanımlanan iki mesnetli kiriştir — solda redüktör tarafı mesnet (Ra), sağda tambur yatağı (Rg). Yükler: her yiv bölgesindeki halat yükü T ve namlu ortasındaki tambur ağırlığı W. Halatlar yiv boyunca gezindiğinden **iki uç hâli** (dış uçlar / iç uçlar) ayrı çözülür; "En Kritik Konum" seçiliyken her mesnet KENDİ kritik hâliyle boyutlandırılır (zarf değeri — raporda iki hâl de ayrı satır olarak görünür, karışıklık olmaz). Girdi olarak sabit bir uç hâli de seçilebilir.
- [x] **Reaksiyonların doğru yere bağlanması**: redüktör radyal yük kontrolü **Ra**'yı, tambur yatağı rulman seçimi (statik emniyet + L10 ömür) **Rg**'yi kullanır. Önceden ikisi de Ra'dan besleniyordu.
- [x] **Mil gerilmeleri**: her iki uçta ayrı — M = R · (o taraftaki konsol A ya da G); eğilme **D1** kesitinde (σ = M/(π·D1³/32)), kesme **D2** yatak oturma kesitinde (τ = 1,33·R/(π·D2²/4)), bileşik σ = √(σ²+τ²). Yönetici taraf otomatik seçilir. Ayrı eğilme / kesme / bileşik kontrolleri (**CMAA 70 4.11.4.1**, standart pop-up'ı defterde). Tüm gerilmeler MPa, momentler Nm.
- [x] **Parametrik teknik resim** (`lib/diagrams/drumShaft.ts` → 2.2.3 / 3.2.3, web + PDF): redüktör bloğu, namlu, yanaklar, yiv bölgeleri, T ve W yük okları, Ra/Rg reaksiyon okları, halatın gezinme aralığı, D1/D2 etiketleri ve A…G ölçü zinciri.
- [x] **Geriye uyum**: `shaftDiaCm`/`shaftShearDiaCm` → `shaftD1Cm`/`shaftD2Cm`; eski a/b/c + moment kolu girdileri kaldırıldı. `revision-load.ts` artık kayıtta olmayan alanları şablondan tamamlıyor (`withDefaults`), böylece motora yeni girdi eklemek eski revizyonları bozmuyor. Simetrik varsayılan geometri (A=G=6, B=F=5, C=E=22, D=64 → L=130) eski formülle **birebir aynı** sonucu verdiğinden 700 hücrelik golden kapsamı olduğu gibi geçiyor.
- [x] **Yerleşim**: hesap satırları geniş ekranda (xl ve üzeri) **iki kolona** açılır — tek ekranda daha fazla hesap görünür.

## Faz L — Kanca ve kanca bloğu mili (2026-08-02, Sinan'ın DIN tablosu + teknik resimleri)
- [x] **DIN 15400 Tablo 3 koda alındı** (`lib/calc/hook-table.ts`): 30 kanca numarası × 5 malzeme mukavemet sınıfı (M<P<S<T<V) × 6 mekanizma grubu (1Bm…5m). Vincin FEM 1.001 sınıfı DIN 15020 grubuna çevrilir (M1–M4 → 1Bm, M5 → 1Am, M6 → 2m, M7 → 3m, M8 → 4m; standardın "1Bm'den hafif çalışma dikkate alınmaz" notu uygulanır). Kanca no + malzeme sınıfı seçilince **taşıma kapasitesi tablodan otomatik gelir**; kapasite ≥ kaldırılan yük kontrolü eklendi ve yükü taşıyan en küçük kanca numarası öneri olarak gösterilir. Tablonun tamamı **DIN 15400 rozetine tıklanınca pop-up** olarak açılır.
- [x] **Kanca bloğu mili donanıma göre modellendi**: makara sayısı **n = toplam halat / 2** (4 halat → 2, 8 → 4, 12 → 6) ve **her makara 2T** taşır. Ölçü zinciri teknik resimlerdeki gibi: **A** yan sac → ilk makara, **B** küme içi makara adımı, **D** iki küme arası orta boşluk (kanca sapı geçişi) → 2 makarada A|D|A, 4 makarada A|B|D|B|A, 6 makarada A|B|B|D|B|B|A. Mesnet reaksiyonları moment dengesinden, maksimum moment yük noktalarında aranarak bulunur. Eğilme **D1** kesitinde, kesme aynı çapta; ayrı eğilme / kesme / bileşik kontrolleri (**CMAA 70 4.11.4.1**).
- [x] **Dinamik teknik resim** (`lib/diagrams/hookBlockShaft.ts` → 4.4, web + PDF): makara sayısı değiştikçe **kendini yeniden çizer** — makaralar, makara başına rulman çiftleri, 2T yük okları, yan sac mesnetleri, Ra/Rb reaksiyonları, D1, A/B/D ölçü zinciri ve moment diyagramı.
- [x] **Rulman ↔ mil çapı bağı**: makara rulmanının iç çapı D1 ile eşleşmelidir — katalogdan `bore_mm` seçim alanına gelir ve eşleşme kontrolü yapılır.
- [x] **S355JR** hem tambur mili hem kanca bloğu mili malzeme listesine eklendi (EN 10025-2 Rm,min = 470 N/mm² → CMAA 70 4.11.4.1 σa = Rm/5 = 94 MPa, τa = σa/√3).
- [x] **Golden**: §4.4'ün 6 hücresi (L58/L59/L62/L65/L66/L67) bilinçli olarak yenilendi — Excel'in mil bloğu kendi içinde tutarsızdı (L58 "Ra" mesnet reaksiyonu yerine toplam yükü yazıyordu, moment ise tek makara varsayıyordu). Gerekçeli `SUPERSEDED_CELLS` listesiyle hariç tutuldu; sayfanın kalan ~47 sağlam hücresi karşılaştırılmaya devam ediyor.

## Notlar
- Hesap motoru golden testleri Excel fikstürlerine karşı çalışmaya devam eder (iç kalite güvencesi) — kullanıcıya görünen yüzeylerde Excel izi olmaz.
- V5 örneğinde tambur mili D1 = 6 cm ile eğilme/bileşik kontrolü **kalıyor** (115 MPa > 90 MPa, C30). Bu eski modelde de böyleydi; D1 ≈ 7 cm'de kontrol sağlanır.
- Kanca bloğu milinde makara sayısı arttıkça mil uzar; D1 = 6,5 cm 4+ makaralı bloklarda yetmez (4 makarada 139 MPa > 116 MPa). Beklenen davranış — çap büyütülmelidir.
- Vinç tipi hesap varyantları (portal/pergel/tek kirişli) büyük iş — önce spec alanı dropdown olur, hesap varyantları ayrı fazlarda.

## Faz M — Excel'den bağımsız hesap motoru (2026-08-02, Sinan'ın direktifi)

> "Excel başlangıç için bir örnekti. Bu sistemin altyapısı ve hesaplama modülü
> yöntemi tamamen Excel'den bağımsız kendine özgü olmalı."

- [x] **Semantik anahtar göçü.** `ModuleResult.cells` artık tablo hücre adresi değil `<blok>.<büyüklük>` biçiminde semantik anahtar taşır (ör. `rope.load`, `drumShaft.reactionGearbox`, `fatigue.combined`). Dört modül ailesinin tamamı taşındı: kaldırma 96 anahtar, kanca bloğu ~50, yürütme 65, yapısal 195.
- [x] **Motordan çıkarılanlar.** Wingdings tik hücreleri (`ü`/`û`) ve `tick()` yardımcısı, gösterim ikizleri, girdi yankıları — toplam ~90 hücre. Bunlar tablo sunumunun artığıydı; kontrol sonucu artık yalnız `Check.pass` alanında yaşıyor.
- [x] **`PI_EXCEL = 3,14159` silindi**, her yerde `Math.PI`. (~8e-7 göreli fark; tarihsel karşılaştırma toleransı 1e-6 → 1e-4'e gevşetildi ve gerekçesi test başlıklarına yazıldı.)
- [x] **Yürütme varyant birleştirmesi.** 89 adet çift adresli yazım (`put(arabaHücresi, köprüHücresi, …)`) tek semantik anahtara indi; sunum katmanındaki `bridgeCell` alanı ve adaptördeki varyant dallanması tamamen kalktı.
- [x] **Kontrol tipolojisi.** `nonExcel` bayrağı kaldırıldı; her kontrol artık `kind` (standart / üretici / firma / bilgi) ve `severity` (engelleyici / uyarı) taşıyor. Yayınlama yalnız engelleyici kırılmalara takılır; arayüz ve PDF dayanağı rozetle gösterir.
- [x] **Ortak hesap kütüphaneleri.** `beam.ts` (iki mesnetli kiriş statiği), `shaftStress.ts` (bileşik ve kayma kabulleri açık parametre), `reeving.ts` (halat donanımının tek kaynağı), `presentation/module-access.ts` (üç yerde tekrarlanan modül erişimi tek dosyada).
- [x] **Tarihsel doğrulama katmanı.** Excel karşılaştırması `src/lib/calc/__tests__/legacy/` altına taşındı: modül başına eşleme tabloları + gerekçeli `KAPSAM_DISI` / `SAPMA` sözlükleri. Her döküm hücresi dört kovadan birinde sınıflandırılmak zorunda; sınıflandırılmamış hücre testi kırar. Üretim kodunda Excel izi kalmadı.
- [x] **Bağlantı koruma testi.** `anchors.guard.test.ts`: her kontrol bağlantısının gerçek bir hesap satırını gösterdiğini, hiçbir kontrolün rapordan düşmediğini (94/94) ve ölü bağlantı olmadığını doğrular. Bu koruma göçten ÖNCE yazıldı.
- [x] **Mühendislik doğrulama testleri.** `engine.integration.test.ts` hücre karşılaştırmasından çıkarılıp motorun kendi tutarlılığına odaklandı: modüller arası zincir, NaN/Infinity taraması, kontrol değerlerinin sonluluğu, engelleyici kırılma kümesinin sabitlenmesi. Bu tarama gerçek bir hatayı yakaladı (aşağıda).

### Bu turda düzeltilen gerçek hatalar

- **Yürütme sınıf yönlendirmesi.** Araba/köprü tekerlek katsayısı c2 (FEM 1.001 4.2.4.1.5) ve rulman gerekli ömrü (4.2.1.1 + T.2.1.3.2) KALDIRMA mekanizmasının sınıfını okuyordu; artık her mekanizma kendi M ve T sınıfını kullanıyor. Referans işte tüm sınıflar M6/T6 olduğu için sayı değişmedi, regresyon testle kilitlendi.
- **Ana kirişin ivme zinciri kopuyordu.** Anahtar göçünden sonra `engine.ts` hâlâ eski hücre adreslerini okuyor, araba ivmelenme süresi 0 dönüyor ve ana kirişin tüm gerilme kontrolleri NaN'a düşüyordu. NaN taraması yakaladı, isimli değer okumasıyla düzeltildi.
- **Sürtünme katsayısı tablosu.** Eşitlik zinciriyle yazılmıştı; listede olmayan bir teker çapında (1000/1120/1250 mm) tüm motor hesabını NaN'a çeviriyordu. Kademe sınırlarına çevrildi.
- **γc elle giriliyordu.** FEM 1.001 T.2.3.4 bunu yapı sınıfından verir; `specs.structureClass` mevcut olmasına rağmen hiçbir modülde okunmuyordu. Artık türetiliyor (A6 → 1,14, mevcut değerle aynı).
- **Yük grubu iki yerde ayrı giriliyordu.** `specs.hoistLoadClass` ("H3/B4") zaten B bileşenini taşıyor; ana kirişte artık oradan türetiliyor.
- **Buruşma Kσ.** FEM A.3.4.1'in α ≤ 2/3 dalı `8,6·α²` ister, ilk portta `8,6/α²` yazılıydı ve "tabloya sadakat" gerekçesiyle korunuyordu. Standardın doğrusu uygulandı.
- **CMAA #74 4.5 → CMAA 70 4.11.4.1.** Mil gerilmelerinin atfı yanlıştı; doğrulanmış madde numarasıyla değiştirildi.

### Bilinçli sayısal sapmalar (mühendisin bilmesi gerekenler)

| Ne | Eski | Yeni | Etki |
|---|---|---|---|
| **Başkiriş kaldırma sınıfı** — `hoistClass` elle "H2" giriliyordu, teknik özellikler "H3/B4" diyordu (veri kendi içinde çelişkiliydi). Artık tek kaynaktan türetiliyor. | ψ = 1,354 | ψ = 1,531 | ψ ile çarpılan tüm statik gerilmeler **%13,1 arttı** (σ 905 → 1024, σbil 960 → 1086 kg/cm²). Kontrol yine sağlanıyor (kullanım %63 → %71). `hoistClassOverride` ile elle ezilebilir. |
| **Kanca bloğu ψ katsayıları** — k/l çifti DIN 15018 Tablo 2'nin H4 satırıydı, sınıf ise H3. | ψ = 1,708 | ψ = 1,531 | ψ **%10 düştü — EMNİYETSİZ yönde**. Etkilenen: kanca bloğu kirişi statik gerilmeleri. Tutarlılık adına yapıldı; kabul edilmezse `hoistLoadClass` H4 olarak düzeltilmeli. |
| **Dairesel kesitte tepe kayma oranı** | 1,33 | 4/3 (kesin) | +%0,25 (emniyetli yönde). Tambur mili τ 281,11 → 281,81 kg/cm². |
| **π sabiti** | 3,14159 | Math.PI | ~8e-7 göreli. |

### Kalan iş

- [ ] **Rapor belgesi yeniden yapılandırması** — Tasarım Esasları sayfası, otomatik standart eki (EK A), bölüm sonu sonuç kutusu, seçim gerekçesi alanı. Tasarımı ve veri kaynakları belirlendi (keşif turu raporu), uygulanmadı.
- [ ] **Tampon yürütme yükü tutarsızlığı** — arabada "gerekli güç", köprüde "seçilen motor gücü" alınıyor; doğrusu ikisinde de seçilen güç olmalı. Düzeltilirse araba tampon yükü ~2 kat artar, bu yüzden karar kullanıcıya bırakıldı.
- [ ] **Teker mili malzemesi** — izin gerilmeleri sabit "4140" tablosundan okunuyor, seçim alanı ise "42CrMo4" metni taşıyor. Alan bir listeye bağlanmalı.
- [ ] **Buruşma Yükleme Durumu II/III** — yalnız Durum I hesaplanıyor (kapsam eksikliği, calc-crossref §3.3).

---

## Faz N — Vinç topolojisi, ana kiriş gerilme analizi ve rapor akışı (2026-08-02)

> Sinan'ın 23 maddelik geri bildirimi. Ana eksen: bir vinçte birden çok kaldırma
> grubu olabilir ve her grubun kendi kanca bloğu ile arabası vardır; ana kirişin
> gerilme analizi izlenebilir hâle gelmeli.

### Topoloji (motor + sihirbaz)
- [x] **ModuleKey 8 → 16.** Kaldırma grupları: ana, yardımcı, monoray 1, monoray 2.
      Her birinin kanca bloğu (`hookBlock`, `auxHookBlock`, `mono1HookBlock`,
      `mono2HookBlock`) ve arabası (`trolley`, `auxTrolley`, `mono1Trolley`,
      `mono2Trolley`). Sıra ve aile eşlemesi `presentation/module-family.ts`te tek yerde.
- [x] **Vinç konfigürasyonu teknik özelliklerde.** `auxTrolleyMode`
      (ana araba üzerinde / ayrı araba) ve `monorailCount` (0–2) hesap bölümlerini
      otomatik açar; `engine.ts` `activeModules()` kullanıcı tercihi + konfigürasyon +
      üst bölüm bağımlılığını birleştirir.
- [x] **Kanca bloğu artık kapatılabilir** ve bağlı olduğu kaldırma grubunun sınıfı,
      hızı ve yüküyle hesaplanır (`computeHookBlock(specs, which, …)`).
- [x] **Ağırlıklar teknik özelliğe taşındı** — Ana Araba / Yardımcı Araba / Köprü.
      "Diğer ağırlıklar" kalktı, köprü tek toplam ağırlık taşıyor. Eski revizyonlar
      `revision-load.migrateWeights` ile taşınır (sessiz değer değişimi olmaz).
- [x] **Tahrikli teker sayısı** yürütme grubundan geliyor: motor adedi × motor başına
      teker (arabada 2 olabilir). Ana kiriş yatay yük hesabı bunu `deps`ten okur.

### Ana kiriş (07)
- [x] **Ray altı sacı b1 ray ekseninde** (`section.railCenterY = x + t3/2`) — kesitin
      ortasında değil. Cy, Izz, burulma kolu ve σ4/σ5/τ1/τ2 etkilendi.
- [x] **b6 Izz Steiner işaret hatası** düzeltildi.
- [x] **Gerilme analizi numaralandırıldı** (σ1…σ10, τ1…τ5); üst lif, ikincil gövde ve
      γc ara değerleri artık raporda görünür. Bölüm sonunda 36 satırlık **gerilme
      tablosu** (No / Gerilme / Etkidiği Yer / MPa / Durum I / Durum III / Dayanak).
- [x] **Gerilme konumları görseli** parametrik kutu kesitten türetiliyor; numaralı
      rozetler, tarafsız eksen, ray ekseni ve birleşim lejantı.
- [x] **FEM eşleşmeleri düzeltildi** — Booklet 4 mekanizma maddeleri yerine
      3.2.1.1 / 3.2.1.2 / 3.2.1.3, DIN 15018 Şekil 9, FEM 2.2.3.3. Defterde eksik
      olan maddeler eklendi (+ ISO 281, + CMAA 70 3.5.1, + FEM A.2.2.1).
- [x] **ψhA / ψhK otomatik** (FEM A.2.2.1); ölü `psiHK` girdisi artık köprü atalet
      yükünde gerçekten kullanılıyor.
- [x] **Yorulma gerilmeden besleniyor** — σy teker basıncından, τ,maks gerçek kayma
      gerilmesinden; σB malzemeden.
- [x] **Sehim mm.**
- [x] **Diyagram kırpılması genel çözümle giderildi** — `fitDiagram()` içerik
      sınırından yükseklik hesaplar; `select.ts`teki ölü hücre adresleri semantik
      anahtarlara çevrildi (moment diyagramı zaten hiç değer almıyordu).

### Kaldırma grubu ve arayüz
- [x] Halat donanımı listesi 1/2 … 4/32 (14 seçenek, yalnız rakam); seçim tahrikli ve
      toplam halat kutularını doldurur.
- [x] Kanca bloğu ağırlığı alanı **kanca/tutucu tipinin adıyla** görünür ve
      kapasitenin %10'u olarak otomatik gelir.
- [x] Motor sıcaklık faktörü ortam sıcaklığından otomatik (40→1 … 80→1,30).
- [x] Makara yataklama tipi seçimi kalktı; η = 0,985 firma standardı.
- [x] "Yiv adımı" → **Hatve p**.
- [x] Hesap değeri, satırına bağlı kontrol sağlanıyorsa yeşil, sağlanmıyorsa kırmızı.
- [x] Özet kontrol panosu masaüstünde iki sütun.
- [x] Tüm başlık ve alan etiketleri Türkçe Başlık Düzeni.

### Proje / iş emri akışı
- [x] Hesap raporu kopyalama (yeni doküman no + hedef iş), işe bağlama/çıkarma, silme
      (admin; yayınlanmış revizyon varsa engellenir ve gerekçe gösterilir).
- [x] İlk raporda buton "Hesap Raporu Oluştur", sonrasında "Yeni Revizyon".
- [x] Rapor oluşturma akışı iş detayından kaldırıldı; raporlar Projeler'den açılıp
      sonradan işe bağlanır.
- [x] PDF'lerde Türkçe büyük harf hatası giderildi (`toUpperCase` → `toLocaleUpperCase("tr-TR")`);
      iş emri tamamen Türkçe ve Başlık Düzeninde.

### Kalan iş
- [ ] `psi_h` için FEM Şekil A.2.2.1 eğrisinin β'ya bağlı ara değerleri sayısallaştırılmadı;
      türetme güvenli tarafta (µ ≤ 1 → 2) kalıyor.
- [x] Köprü ve başkiriş artık ÜZERİNDEKİ TÜM arabaların ağırlığını görüyor
      (`bridgeTrolleyWeightT`). Kabul: hepsi aynı anda en elverişsiz konumdadır —
      emniyetli taraf. **Mühendis onayı bekliyor**: bu kabul fazla muhafazakâr
      bulunursa arabalar konumlarına göre ayrı ayrı ağırlıklandırılmalı.
- [ ] Faz M'den devreden maddeler (rapor belgesi yeniden yapılandırması, tampon yürütme
      yükü, teker mili malzemesi, buruşma Durum II/III) hâlâ açık.

---

## Faz O — PDF hesap raporu görsel düzeni (2026-08-02)

> "PDF hesap raporlarında ciddi bir görsel düzenleme gerekiyor… hesaplanan ve
> izin verilen şeklinde kullanalım."

- [x] **Kontrol modeli açıldı.** `Check.computedSide` (ZORUNLU alan) hesaplanan
      değerin `provided` mı `required` mı olduğunu söyler — model iki sayıyı
      kapasite/talep diye tutuyordu, "hesaplanan" hangisi olduğu kontrolden
      kontrole değişiyor ve tahmin edilemiyordu. 58 kontrolün tamamı tek tek
      işaretlendi (49 `required`, 9 `provided`; 3 aralık kontrolü muaf).
      Ortak gösterim `checkDisplay()` ile üretilir: **HESAPLANAN x ≤ İZİN VERİLEN y**,
      hesaplanan değer kalın ve sonuca göre yeşil/kırmızı. Sihirbaz ve PDF aynı
      fonksiyonu kullanır; iki yerde farklı okunması imkânsızdır.
- [x] **Hesap adımları numaralandı.** Her satır bölüm numarasının devamı olan
      kalıcı bir adres taşır (`2.2.3.07`), solda mono şerit hâlinde. Satıra bağlı
      kontrol varsa sol kenar yeşil/kırmızı boyanır — uygunsuz adım sayfa
      tarandığında hemen görünür. Sonuç sağda çerçeveli kutuda, kalın mono.
- [x] **Bölüm başlıkları sayfa dibinde yalnız kalmıyor** — `SectionTag`
      (90 pt) ve `SubHead` (46 pt) `minPresenceAhead` taşır.
- [x] **Bölüm başlığında kontrol sayacı** (`5/6 UYGUN` rozeti).
- [x] **İçindekiler tıklanabilir ve sayfa numaralı.** Her satır `Link src="#..."`
      ile bölümün çapasına gider (PDF named destination). Sayfa numaraları İKİ
      GEÇİŞLİ render ile bulunur: birinci geçişte her bölümün başladığı sayfa
      toplanır, ikinci geçişte tabloya basılır.
- [x] **PDF'lerde İngilizce kalmadı** — "CONTENTS", "SUMMARY",
      "DESIGN CALCULATION REPORT", "EQUIPMENT LIST", "FABRICATION SUMMARY" ve
      `SectionTag`/`SubHead` İngilizce gloss parametreleri kaldırıldı.
- [x] `report.smoke.test.tsx` artık yapıyı da kilitliyor: iç bağlantıların ve
      adlandırılmış hedeflerin varlığı, her bölümün başlangıç sayfasının
      toplanabildiği ve sayfa sırasının bölüm sırasıyla arttığı.

---

## Faz P — Teker Yükleri (yol kirişine aktarılan kuvvetler)

Sinan'ın "Teker Yükleri Detaylı Hesap Örnek.xlsx" çalışması ve iki teknik resmi
(16 ve 8 tekerli düzen) temel alınarak yeni bir hesap bölümü eklendi. Excel yol
gösterici dokümandır; hesap yöntemi doğrudan FEM 1.001'den kurulmuştur.

### Kapsam

Motor: `src/lib/calc/modules/wheelLoads.ts` (ENGINE_VERSION 0.4.0).
Bölüm sırası: Köprü Yürütme'den hemen SONRA, taşıyıcı yapı bölümlerinden önce.

| Bölüm | İçerik | Dayanak |
|---|---|---|
| 10.1 | Vinç verileri ve teker düzeni (ölçü zinciri, teker kodları) | FEM 9.4.1.3 / 9.4.1.5 |
| 10.2 | Düşey teker yükleri + dinamik katsayı φ2 + tasarım yükü | FEM 9.3 (T.9.3.a/b), 2.3.1 |
| 10.3 | Savrulma: α, f, µ', h, ν, ξ, S ve teker başına Fy1/Fy2/Fx | FEM 9.4.1.3, T.9.4 |
| 10.4 | Boyuna kuvvetler + 1/30…1/4 bandı + tampon tepkisi | FEM 2.2.3.1.1, 2.2.3.4.1 |
| 10.5 | Yol kirişine aktarılan kuvvetler özeti (tablo + şema) | — |

### Otomasyon

Bölümün girdilerinin neredeyse tamamı OTOMATİKTİR (`wheelLoadDepsFrom`):
teker adedi, tahrikli teker, gerçekleşen yürütme hızı, ivme, araba yanaşması,
ray tipi ve tampon tepki kuvveti köprü yürütme bölümünden; kaldırma yükü ana
kaldırmadan; ağırlıklar ve açıklık teknik özelliklerden okunur. Mühendis yalnız
teker düzeni ölçü zincirini, kılavuz boşluğunu ve kaldırma sınıfını (HC/HD)
verir. Bağlı teker çifti adedi p tahrikli tekerlerden türetilir.

### Teker düzeni modeli

Vinç dört köşesinde EŞİT sayıda tekerle yürür: toplam adet dördün katıdır
(4 · 8 · 12 · 16 · 20 · 24 — `WHEEL_COUNT_OPTIONS`, Köprü Yürütme'de dropdown),
köşe başına toplam/4, ray başına toplam/2 teker. Geometri BİR RAY için,
ardışık teker eksenleri arası mesafelerle girilir (karşı ray aynıdır) —
teknik resimdeki ölçü zincirinin birebir karşılığı. Tekerler `A1…Ak` (ön köşe)
ve `B1…Bk` (arka köşe) kodunu taşır. Mesafeler `WheelSpacingEditor` görsel
düzenleyicisinden yazılır: rayı üstten çizen, her aralığa bir sayı kutusu koyan
ve teker adedi değişince kendini yeniden kuran bir bileşen
(`AdapterSection.editor = "wheelSpacing"`).

### Şemalar (üçü de parametrik ve dinamik)

Üçü de vincin GERÇEK SİLUETİNİ çizer (uçlarında daralan ana kiriş gövdesi,
başkirişler, tekerler, raylar, yol kirişi) — teknik resmin okunuşuyla aynı dil.
Ortak `drawCrane()` yardımcısı 10.2 ve 10.5'te aynı silueti üretir.

- **10.2** raylara dik görünüş: açıklık, araba yanaşması, Pmaks/Pmin okları.
  Bu görünüşte bir rayın bütün tekerleri üst üste düştüğü için TEK teker
  çizilir, adet etiketle verilir.
- **10.3** üstten görünüş: iki başkiriş + iki ana kiriş (plan silueti), teker
  düzeni ve kodları, kılavuz kuvveti S, teker başına enine kuvvet okları
  (uzunluk kuvvetle orantılı, işaret ok başının yönünde), anlık kayma kutbu ve
  tam ölçü zinciri. Savrulma, FEM F.9.4.d'deki gibi RAY DOĞRULTUSU ↔ HAREKET
  DOĞRULTUSU açısıyla gösterilir (gövdeyi eğerek değil — α birkaç mrad).
  Tuval genişliği GEOMETRİDEN çıkar: en dar teker aralığının ölçü etiketi
  sığacak kadar geniş olur, böylece köşe içi 1.000–1.500 mm aralıklarda bile
  ölçü zinciri eksiksiz basılır.
- **10.5** yük özeti: aynı vinç siluetinde BÜTÜN kuvvet bileşenleri. Boyuna
  kuvvet bu düzleme dik olduğundan ⊗ simgesiyle verilir; simgelerin anlamı
  alttaki lejantta yazar.

**Birim kuralı:** şemadaki her KUVVET değeri kN ile yazılır (birimsiz sayı
mühendis için anlam taşımaz). Ölçü zincirinde teknik resim kuralı geçerlidir —
kotlar çıplak sayı, birim zincirin başında bir kez ("ölçüler mm") ve toplam
ölçüde yazılır.

### Excel'e göre düzeltilen noktalar

1. **µ' (yakın rayın yük payı)** Excel'de araba kolu (l−e)/l = 0,9516 alınmıştı;
   bu bir YÜK PAYI değil kol oranıdır — köprünün kendi ağırlığı iki raya eşit
   dağılır. Doğrusu düşey teker yüklerinden çıkar (örnekte 0,771). Sonuç:
   kılavuz kuvveti S %9 ARTAR (301 → 329 kN), enine kuvvetin raylar arasındaki
   dağılımı düzelir (Excel uzak rayı 4,7 kat eksik hesaplıyordu). Toplam
   (Fy1+Fy2) değişmez.
2. **Ray başı genişliği** aşınma payında (αw) rayın ANMA genişliğidir; motorun
   `RAILS.headWidth` alanı teker basıncı için ETKİN genişliktir. Yeni
   `railNominalHeadWidthMm()` ile ayrıştırıldı.
3. **ξ (boyuna savrulma kuvveti)** Excel'de hesaplanıp hiç kullanılmıyordu;
   artık teker başına Fx olarak tabloya ve özete girer.
4. **Boyuna kuvvet bandı** (FEM 2.2.3.1.1: 1/30…1/4) Excel'de yoktu; tasarım
   kuvveti banda sıkıştırılır ve hangi sınırın belirlediği raporda yazar.
5. **φ2 uygulanmıyordu**; artık tasarım teker yükü φ2'yi YALNIZ kaldırma yüküne
   uygular (FEM 2.3.1: SG + ψ·SL + SH), ölü yükü büyütmez.
6. **Teker konumları** Excel'de 4 tekere sabitlenmişti ("2 tekerli sistemde B ve
   C'ye 0 girilir" gibi kırılgan bir kabulle); artık 4–24 teker parametriktir.
7. **Tampon tepkisi** (FEM 9.4.2 ile eşik 0,4 m/s) yol kirişi yüklerine taşındı.
8. **p (bağlı teker çifti)** Excel'de n'e sabitti; artık teker çifti düzeninden
   (CFF/IFF/CFM/IFM) ve tahrikli tekerlerden türetilir — bağımsız düzende
   tanım gereği 0'dır.

### Doğrulama

`__tests__/wheelLoads.test.ts` — 48 mühendislik testi: statik denge, ölçek
tutarlılığı (ağırlık ×2 → S ×2), sınıf duyarlılığı (HC1<HC2<HC3<HC4), teker
kuvvetleri toplamının kılavuz kuvvetine eşitliği (dört düzenin hepsinde),
kayma kutbunun ötesinde işaret dönmesi, FEM bandının sınır durumları, bozuk
girdide NaN üretmeme ve Sinan'ın iki teknik resminin birebir çözülmesi.
Excel karşılaştırması yalnız düşey yük ve φ2 bloklarında birebirdir
(Pmaks 27.948 kg, Pmin 8.302 kg, φ2 = 1,10567).

## Faz R2 — YILMAZ redüktör katalogları ve kullanım grubu (2026-08-06)

Sinan üç YILMAZ katalog PDF'ini workspace'e koydu: **DR ve M yürütme**, **H
kaldırma** grubu için. Üçü de çıkarılıp sisteme bağlandı.

### Kaynak seçimi: motorsuz (gear unit) tablolar

Kataloglarda iki güç–devir bölümü var: motorlu (belirli bir motorla eşleşmiş
kombinasyon) ve motorsuz (redüktörün kendi anma değerleri). Uygulama redüktör
ile motoru ayrı bölümlerde seçtiği için **motorsuz tablolar** kullanıldı —
anma momenti Ma, izin verilen radyal yükler Fqam/Fqem, ağırlık ve mil çapları
oradadır. Kataloğun tanımıyla (M kataloğu s.7) Ma, redüktörün fs=1 şartında
mekanik olarak taşıdığı momenttir; `gearbox.torque` kontrolünün karşılaştırdığı
büyüklük tam olarak budur.

Önceki çıkarım DR'yi **motorlu** sayfalardan almıştı (1796 satır motor+redüktör
kombinasyonu) ve H kataloğunun **B serisini tamamen kaçırmıştı**; ayrıca H
satırlarında ağırlık, servis faktörü ve mil çapı boştu (5654 satırın tamamında).

### Sonuç

| Katalog | Satır | Model | Kullanım grubu | Kaynak sayfa |
|---|---:|---:|---|---|
| D serisi | 579 | 46 | yürütme | s.252–262 |
| M / N serisi | 1.292 | 104 | yürütme | s.320–331 |
| H / B serisi | 5.407 | 90 | kaldırma | s.104–233 + s.416–505 |

Toplam 7.766 redüktör (SIMOGEAR 488 dahil 8.254 → seed'de 7.766 + diğer türler).
H/B'de her model beş giriş devri için ayrı basılıdır (n1 = 1400/900/750/450/300)
ve anma momenti devirle değiştiğinden beşi de alındı.

**Yeni alanlar:** `application` (kaldirma | yurutme), `allowed_radial_output_kn`
ve `allowed_radial_input_kn` (katalogda N/kN → kN), `input_shaft_mm`,
`hollow_bore_mm`, `shrinkdisc_bore_mm`, `thermal_power_kw` /
`thermal_power_fan_kw` (Pt1/Pt2, 20 °C), `stages`, `frame_size`,
`dimension_page`.

### Sisteme bağlanma

- [x] **Kullanım grubu kilitli süzgeç.** `SectionCatalogMapping.lockedFacets`
      eklendi: 2.3 kaldırma redüktörü yalnız `application=kaldirma`, 5.5 yürütme
      redüktörü yalnız `yurutme` görür. Süzgeç sunucuda uygulanır
      (`attrs->>application`), adım listesinden çıkarılır ve başlıkta rozet
      olarak gösterilir — mühendis kaldırma bölümünde yürütme redüktörü seçemez.
- [x] **İzin verilen radyal yük katalogdan doluyor.** `gearbox.radial`
      ENGELLEYİCİ bir kontroldü ama `gearboxAllowedRadialKn` katalogda hiç
      yoktu; "Katalogdan Seç" sonrası alan eski değerinde kalıyor ve kontrol
      yanlış veriyle ✓ verebiliyordu. Artık Fqam'den doluyor.
- [x] **Giriş mili çapı katalogdan doluyor** (`gearboxInputShaftMm` / yürütmede
      `gearboxInputShaftText`) — 2.6 motor kaplini mil çapını belirler. H/B
      serisinde aynı gövdede çevrim oranı bandına göre değişir, bandıyla eşlenir.
- [x] Redüktör tablosuna izin verilen radyal yük ve giriş mili sütunları;
      seçicide `application` ilk facet.
- [x] **Sessiz kırpma giderildi — sanılandan ağır bir kusurdu.** Seçici bir
      markanın satırlarını tek istekle çekiyordu. Asıl sınır istemcinin
      `.limit(5000)` değeri değil, **PostgREST'in `max_rows` ayarıdır: bu
      projede 1000** ve istemci limiti bunu AŞAMAZ. Yani seçici her zaman bir
      markanın yalnız ilk 1000 satırını gösteriyordu; ne hata, ne uyarı. Canlıda
      ölçüldü: kaldırma grubu 5.407 satırken marka kartı "1000 ürün" yazıyordu.
      Sorgular `range()` ile sayfalandı (kısa sayfa gelene kadar); marka
      adetleri de aynı yolla toplanıyor. Düzeltme sonrası kartlar 5.407 /
      1.871 / 488 gösteriyor. 20.000 satırlık emniyet tavanına dayanılırsa
      kullanıcı uyarılıyor.
- [x] Migration `20260806000001_gearbox_reseed.sql` — `delete … where kind =
      'gearbox'` + 7.766 satır. Uygulanmış seed dosyası düzenlenmedi;
      `seed-catalog.ts` artık `--kinds` / `--out` ile yenileme migration'ı üretir.
      **Uzak veritabanına uygulandı (2026-08-06).** Silinen 7.938 satırın tamamı
      seed kaynaklıydı (tek günde oluşmuş, not/datasheet/pasif kayıt yok) ve
      `cat_equipment`'a bakan yabancı anahtar yok — revizyonlar seçimi JSONB
      anlık görüntü olarak sakladığından kayıtlı raporlar etkilenmez.
- [x] Çıkarım betikleri `scripts/catalog-extract/` altında (README'de yöntem,
      kaynak sayfalar ve doğrulama durumu).
- [x] `src/lib/__tests__/catalog-mapping.test.ts` — 9 koruma testi. `attrs`
      anahtarı değişirse seçim sessizce eksik dolardı; test o sessizliği kırar.

### Açık kalan: V5 varsayılanı katalogla uyuşmuyor

`defaults.ts` ana kaldırma redüktörü `YILMAZ HT0823`, i = 52,57 için
**22 kNm / 60 kN / Ø120 mm / 775 kg** taşıyor. Kataloğun basılı değeri (s.110,
n1 = 1400) aynı model ve oran için **24 kNm / 154 kN / Ø130 mm / 620 kg**.
`main.gearbox.torque` kontrolü V5'te 22 < 22,07 kNm ile başarısızdı; katalog
değeriyle geçer. Varsayılanlar golden testlerin beklediği sonuçları belirlediği
için DEĞİŞTİRİLMEDİ — düzeltme kararı Sinan'ındır.

## Faz S — İş Takibi modülü (2026-08-09)

Sinan `ORION İŞ TAKİBİ.xlsx` çalışma kitabını workspace'e koydu: atölyede her
gün hangi işe kaç kişinin kaç saat çalıştığının kaydı. Bölüm sisteme alındı ve
kitabın tamamı aktarıldı.

### Kaynağın söyledikleri

| | |
|---|---|
| Satır | 1.751 (2025-04-21 … 2026-08-04) |
| Adam·saat | 35.712 |
| Farklı kalem no | 28 · parça 45 · imalat türü 6 · grup kodu 34 |
| Kayıt günü | 382 · gün başına ortalama 4,6 satır |

İki ölçüm modülün tasarımını belirledi:

1. **Bir günün satırlarının %87'si bir önceki iş gününden AYNEN devam ediyor**;
   381 günün 170'i bir öncekiyle birebir aynı. Kullanıcının yaptığı iş "dün ne
   yazdıysam onu tekrar yaz"dı. Ekran bu tekrarı iki harekete indirir: *Önceki
   günü kopyala* ve sık kullanılan (kalem · parça · tür) üçlülerini tek tıkla
   satır yapan şerit. Yeni satır yazmak yine mümkün ama İSTİSNA.
2. **Parça alanı serbest metindi ve aynı parça beş yazımla girilmişti**
   ("Anakiriş"/"Ana Kiriş", "Kaldrıma Kirşi"/"Kaldrıma Kirişi", "Monaray").
   Serbest metin bırakılsa parça bazında toplam ALINAMAZDI: parça ve imalat
   türü kendi defterlerine (`work_parts`, `work_categories`) alındı; yeni parça
   günlük girişteki arama kutusundan tek adımda açılır.

### Kalem eşleşmesi — devralınan verinin yarısı bağlantısız

Çizelgedeki "İş No" aslında KALEM numarasıdır (`job_items.item_no`). 28
numaradan 23'ü birebir eşleşti; 0021-00 / 0045-00 / 0057-00 yalnız İŞ düzeyinde
eşleşti (o işlerde kalemler `-01`den başlıyor) ve **0020-00 (792 satır, 18.162
adam·saat) ile 0061-00'in sistemde karşılığı YOK**. Aktarımda hiçbir satır
düşürülmedi: `item_no` metni her satırda durur, bağlantı türevdir.

Ekrandaki **Kalem Eşleştirme** kartı bu numaraları listeler ve bir numaranın
BÜTÜN satırlarını tek işlemde doğru kaleme bağlar (`remapItemNo`). 0020-00'ın
parça listesi (Anakiriş, Yardımcı Kiriş, Ekolayzer, Tambur 185T, 185MT Üst
Makara, "Şarj Vinci Akşam Mesai") 0019 no'lu KARÇEL 185/40 t şarj vincini
işaret ediyor ama bu bir TAHMİNDİR — kararı Sinan verecek, uygulama sessizce
birleştirmedi.

### Ne yapıldı

- [x] Şema `20260809000004_work_log.sql`: `work_logs` + `work_parts` +
      `work_categories` + `can_see_work_log()` + RLS (Yönetici · Müdür).
      `man_hours` türetilen sütundur; `hours` üst sınırı GENİŞtir çünkü
      devralınan kayıtta "3 kişi × 112 saat" gibi toplu iş satırları var.
- [x] Aktarım `20260809000005_import_work_log.sql`: 1.751 satır, tekrar
      çalıştırılabilir (gün + kalem + parça + tür + adam + saat aynıysa atlar).
      **Uzak veritabanına uygulandı (2026-08-09):** 1.751 kayıt / 35.712
      adam·saat, kaynakla birebir.
- [x] **Günlük Giriş** (`/worklog`): tarih gezinme, son 14 gün şeridi, önceki
      günü kopyala, sık kullanılan üçlüler, satır düzenleyici (kişi sayacı,
      grup kodu önerisi), Ctrl+S, kaydedilmemiş değişiklik uyarısı.
- [x] **Analiz** (`/worklog/analysis`): dört özet kartı (önceki döneme göre
      değişimle), yığılmış zaman serisi (günlük/haftalık/aylık × altı kırılım
      ekseni), sıralı kırılım (tıklanınca süzgece dönüşür), imalat türü halkası,
      aylık ısı haritası, çapraz tablo (satır/sütun seçilir, yer değiştirilir),
      dönem karşılaştırması (aynı uzunlukta önceki aralık).
- [x] **Kayıtlar** (`/worklog/records`): süzgeçli/sıralanabilir tablo, satır
      düzenleme penceresi, Kalem Eşleştirme kartı, kademeli yükleme.
- [x] **Excel indirme** (`/worklog/export`): beş sayfa (Kayıtlar · Aylık Özet ·
      İş Kalemi Özeti · Parça Özeti · Künye), marka kimlikli başlık, gerçek
      tarih hücreleri + otomatik süzgeç + dondurulmuş başlık. Dosya adı indirme
      TARİHİ VE SAATİNİ taşır: `ORION İş Takibi 09.08.2026 14-32.xlsx`.
- [x] Pano grafikleri `components/charts.tsx` — `lib/diagrams` KULLANILMADI
      (gerekçe AGENTS.md md. 17). Seri rengi ton açısıdır, L/C tema başına
      `globals.css` `.oc-series-*` / `.oc-heat` kurallarında.
- [x] `src/lib/__tests__/work-log.test.ts` — 28 test: pay toplamı, boş kovanın
      seriye girmesi, haftanın pazartesi başlaması, eşit uzunlukta önceki
      dönem, yerel takvim günü, dosya adı biçimi.
- [x] `/dev/worklog-preview` — üç ekranı sahte veriyle auth'suz basar.

### Açık kalan

- **0020-00 ve 0061-00 numaralarının hedefi.** Kalem Eşleştirme kartı hazır;
  hangi işe bağlanacağına Sinan karar verecek. Bağlanana kadar bu satırlar
  müşteri ve iş kırılımlarında "—" kovasındadır (toplamdan DÜŞMEZ).
- **Günlük kaydı kim giriyor?** Bölüm Yönetici + Müdür'e açıktır (istenen
  buydu). Kaydı atölyeden biri giriyorsa ya o kişiye Müdür rolü verilmeli ya da
  `user_role` enum'una beşinci bir rol (ör. atölye şefi) eklenip
  `canSeeWorkLog` genişletilmelidir — tek satırlık bir değişiklik.

## Faz T — Kimlik ve belge filigranı (2026-08-09)

Sinan: *"uygulamanın adını hesap raporu sistemi değil daha geniş bir tanım
yapalım"* + PDF'lere çapraz logo isteği.

- [x] **Ad: "İş Yönetim Sistemi"** (`src/lib/app.ts` — `APP_NAME` / `APP_TITLE`
      / `APP_TAGLINE` tek kaynak). Gerekçe: hesap raporu artık bölümlerden
      biridir; her kayıt bir İŞE bağlanır, bölüm adları da o dili konuşur
      (İşler · İş Takibi · Satış Takibi). Kabuk, giriş sayfası ve sekme başlığı
      aynı sabitten okur.
- [x] **Kenar çubuğundaki standart künyesi kaldırıldı** (FEM 1.001 · DIN 15018 ·
      CMAA 70 / "Çift kirişli gezer köprülü vinç"). Uygulama artık yalnız çift
      kirişli köprülü vinç hesabı değil; künye kalan üç bölümde yanlış bir
      kapsam sözü veriyordu.
- [x] **Giriş sayfası sadeleşti**: başlık + paragraf + üç maddelik standart
      listesi yerine TEK cümle. Giriş ekranı tanıtım sayfası değildir; oradaki
      kişi zaten şirkette çalışıyor.
- [x] **Başlık altı açıklamalar başlıkla aynı satıra alındı** (İşler, Projeler,
      Satış Takibi, Yönetim, İş Takibi) ve başlık `text-2xl` → `text-xl`, dış
      boşluk `gap-6` → `gap-4`. Kazanç sayfa başına ~40 px; bu ekranlarda asıl
      iş tabloların olduğu ALT bölümdedir.
- [x] **PDF filigranı** (`brand.tsx` → `Watermark`, `BrandPage` içinde `fixed`):
      çapraz (-45°) marka lockup'ı, opaklık 0,06, sayfa ortasında. Hesap raporu,
      ekipman listesi ve iş emri PDF'lerinin HER sayfasında çıkar — üçü de
      `BrandPage` kullanır. İçerikten ÖNCE çizilir (react-pdf boyama sırası
      belge sırasıdır), böylece dolgulu tablo hücreleri onu örter.
      Ölçüldü: sayfa pikselinin ~%1'i, ton (250,242,242) — kömür metnin yanında
      kontrastı 1,05:1, yani göz onu ancak arayınca görür.

### Açık kalan

- Üst şeritteki `FEM 1.001 · DIN 15018 · CMAA 70` yazısı DURUYOR. Projeler
  bölümünde doğru, İş Takibi ve Satış Takibi'nde konu dışı. Kaldırılsın mı,
  yoksa yalnız `/projects` altında mı gösterilsin — Sinan'ın kararı.

### Faz T eki — altbilgi tek çizgiye indi (2026-08-09)

Sinan: *"Ekipman listesinde bu şekilde çift footer çizgisi olmasa daha iyi olur.
PDF raporlarda da arada gereksiz bir boşluk var."*

Aynı kökten iki kusur: firma künyesi altbilginin İÇİNDE değil, AYRI bir katman
olarak duruyordu.

- **Ekipman listesi** künyeyi `fixed` bir katmanda sayfanın altına koyuyordu.
  Künyenin kendi ayırıcı çizgisi ile `BrandPage` altbilgisinin çizgisi ~8 mm
  arayla alt alta basılıyordu → **iki ince çizgi**.
- **Hesap raporu kapağı** künyeyi içerik akışının SONUNA koyuyordu. İçerik
  sayfanın alt payında biterken altbilgi en alta sabitlendiği için aralarında
  ~23 pt doldurulmamış bir şerit kalıyordu → **gereksiz boşluk**.

Çözüm tek yerde: `BrandPage` artık `company` alıyor ve künyeyi altbilginin ilk
satırı olarak basıyor. Çizgi künyenin üstünde TEK tanedir, doküman satırı kendi
çizgisini çizmez, aradaki mesafe `paddingTop: 4`e iner. Sayfanın alt payı da
künyenin varlığına göre `BrandPage` içinde ayarlanır — çağıranın elle pay
vermesi (ve unutması) gerekmez.

Ölçüldü (pymupdf): iki belgede de alt bölgede **tek** yatay çizgi, künye ile
doküman satırı arası **4,0 pt**.

**Ders — ölçerken dosya adını doğrula.** Bu turda uzun süre yanlış teşhis
kovalandı: dosya adı standardizasyonu çıktı adını `0055-HR-001-V5-ozet.pdf` →
`0055-01-V5-ozet.pdf` yapmıştı ve ölçüm betiği eski dosyayı okuyordu. Kapaktaki
"boşluk kapanmıyor" izlenimi tamamen bundandı; `.test-output/` ölçülmeden önce
temizlenmeli ya da dosya adı üretim çıktısından okunmalıdır.
