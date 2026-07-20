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
- [x] **Tambur diyagramı**: `lib/diagrams/drum.ts` (namlu, yanak, mil, oluk, D_d/D_min/halat Ø etiketleri) → sihirbaz+PDF 2.2.1/3.2.1. Teker mili moment etiketi Nm'ye çevrildi.
- [x] **Ekipman listesi**: sütunlar Ekipman | Marka | Model | Özellikler | Adet (marka/model ayrıldı, grup başlık satırı); müşteri dosyası (`?scope=customer`, yalnız ekipman listesi) ile teknik ressam özeti ayrıldı; datasheet linki altyapısı (`cat_equipment.datasheet_url` migration + admin alanı + Excel Model hücresi köprüsü, kind|brand|model eşlemesi).
- [ ] **Sonraki**: EN rapor tam çevirisi (kullanıcı: önce TR, sonra EN); datasheet linkleri için seçim-anında URL yakalama (motor/halat gibi yalnız marka tutan bileşenler); ekipman listesine özel satır/özellik ekleme editörü (revizyon şeması + UI).

## Notlar
- Hesap motoru golden testleri Excel fikstürlerine karşı çalışmaya devam eder (iç kalite güvencesi) — kullanıcıya görünen yüzeylerde Excel izi olmaz.
- Vinç tipi hesap varyantları (portal/pergel/tek kirişli) büyük iş — önce spec alanı dropdown olur, hesap varyantları ayrı fazlarda.
