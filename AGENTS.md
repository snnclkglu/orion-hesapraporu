<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ORION Hesap Raporu

Gezer köprülü vinç hesap raporu web uygulaması. Mühendisler girdi + katalog
seçimi yapar, sistem hesapları koşturur ve ✓/✗ kontrolleri gösterir; çıktı
müşteriye teslim edilebilir PDF rapor + ekipman listeleridir. Revizyon arşivli,
çok kullanıcılı (admin + mühendis).

## Temel ilke: hesap yöntemi standartlara dayanır, bir tabloya değil

Uygulama ilk sürümünde bir Excel dosyasından port edilmişti. **Bu bağımlılık
kaldırılmıştır.** Hesap motoru artık kendi yöntemini doğrudan standartlara
dayandırır:

- **FEM 1.001** (3rd Ed. Rev. 1998) — sınıflandırma, yükler, halat/tambur/
  makara/tekerlek/rulman seçimi, plaka burkulması
- **DIN 15018** — çelik yapı yorulması (Tablo 17/18, Tablo 2 dinamik katsayı)
- **DIN 15400 / 15401 / 15402** — kanca taşıma kapasiteleri
- **DIN 15061** — halat oluğu adımı
- **CMAA 70** — motor gücü, mil gerilmeleri, sehim sınırı

**Excel'e bakarak kod yazma.** Yeni bir hesap eklerken kaynak standardın
maddesidir. `reference/excel-dump/` ve `src/lib/calc/__tests__/legacy/`
yalnızca **tarihsel doğrulama fikstürüdür** — şartname değildir. Bir sayı
uyuşmuyorsa öncelik uygulamanın kendi yöntemindedir; sapma gerekçesiyle
birlikte belgelenir (bkz. `__tests__/legacy/README.md`).

## Stack

Next.js 16 (App Router, TS strict) · Tailwind v4 + shadcn/ui · Supabase
(Postgres/Auth/RLS/Storage) · Zod · Vitest · @react-pdf/renderer · exceljs ·
Vercel. **Arayüz, rapor ve kod yorumları tamamen Türkçedir**; tanımlayıcılar
(değişken/tip/alan adları) İngilizce lowerCamelCase.

## Komutlar

- `npm run dev` — dev sunucu
- `npm test` — vitest (mühendislik doğrulama + tarihsel karşılaştırma)
- `npm run build` — production build
- `npx tsx scripts/test-pdf.ts` — PDF raporu üç seviyede üret (duman testi)
- `npx tsx scripts/test-equipment.ts` — ekipman listesi duman testi
- Migration push: `npx supabase db push` (SUPABASE_ACCESS_TOKEN env ile; token asla commit etme)

## Mimari ilkeler

1. **Hesap motoru saftır.** `src/lib/calc/` altında DB/UI bağımlılığı olmayan
   saf TS fonksiyonları. `CalcInput` → `CalcResult`. Motor `ENGINE_VERSION` ile
   etiketlenir; her revizyon hangi sürümle hesaplandığını saklar.

2. **4 değer rolü.** `input` (kullanıcı girer) → `computed` (hesaplanır) →
   `selection` (mühendis katalogdan seçer) → `check` (kontrol). Arayüz bu
   döngüyü yansıtır: girdiler talebi üretir, mühendis seçer, kontroller ✓/✗.

3. **Semantik anahtarlar.** `ModuleResult.cells` haritasının anahtarı
   `<blok>.<büyüklük>` biçimindedir — tam 2 segment, İngilizce lowerCamelCase:
   `rope.load`, `drum.minDia`, `drumShaft.reactionGearbox`, `gearbox.requiredTorque`,
   `fatigue.combined`, `deflection.ratio`. Modül öneki anahtara konmaz (harita
   zaten modül başınadır). Anahtar asla `L19` gibi tablo adresi biçiminde olmaz.
   Araba ve köprü **aynı** anahtarları kullanır; varyanta özel satırlar sunum
   tarafında `variant` ile işaretlenir.

4. **Kontrol tipolojisi.** Her kontrol dayanağını ve ağırlığını taşır:
   - `kind`: `"standart"` (FEM/DIN/CMAA maddesi şart koşuyor) · `"uretici"`
     (katalog kriteri) · `"firma"` (tasarım kabulü) · `"bilgi"` (bilgilendirme)
   - `severity`: `"engelleyici"` (sağlanmadan yayınlanmamalı) · `"uyari"`
   Yardımcılar `types.ts`te: `checkKind`, `checkSeverity`, `isBlocking`,
   `blockingFailures`. Varsayılan en muhafazakâr olandır (standart/engelleyici).

5. **Ortak hesap kütüphaneleri** — aynı fizik iki kez yazılmaz:
   - `beam.ts` — iki mesnetli kiriş statiği (reaksiyon, M(x), Mmaks, kesme)
   - `camber.ts` — sehim eğrisi ve ters sehim. **Üçü karıştırılmaz:** *sehim*
     yalnız canlı yükün (araba + nominal yük, darbe katsayısı YOK) çökmesidir
     ve L/δ ile kontrol edilir; *kesimde* verisi CMAA 70 md. 3.5.5.2 kamberidir
     (ölü yük sehimi + canlı yük sehiminin yarısı); *mesnette* verisi kesimde −
     ölü yük sehimi = canlı/2'dir ve atölye ölçüm kotudur. Kotlar açıklık
     ortasından başlayıp perde aralığınca verilir; perde kodları soldan sağa
     tekildir (M1 · P1…Pn · O · M2) ve perde ADEDİ de aynı ızgaradan okunur.
     Ölü yük kirişin KENDİ ağırlığıdır: kesit sacları + perdeler (kalınlık =
     en ince kutu sacı, ölçü = iç genişlik × iç yükseklik) + ray (DIN 536-1
     ya da kare çubuk kesitinden) + elle girilen ilave sabit yük. Başkiriş
     GİRMEZ — mesnet üzerinde durur, kirişi eğmez.
   - `shaftStress.ts` — mil gerilmeleri; bileşik (`vonMises`/`resultant`) ve
     kayma (`ortalama`/`maksimum`) kabulleri **açık parametredir**
   - `reeving.ts` — halat donanımının tek gerçek kaynağı (mekanik avantaj,
     halat verimi, kanca bloğu makara sayısı, rulman adedi)
   - `hook-table.ts` — DIN 15400 Tablo 3 (kanca no × malzeme sınıfı × grup)
   - `safety-brake.ts` — tambur emniyet freni: SIBRE SHI kaliper kataloğu
     (FA / hava aralığı, x ölçüsü, disk çapı sınırları) + tork ve minimum flanş
     çapı bağıntıları. Gereken moment BURADA hesaplanmaz; kaldırma modülünün
     `drum.torquePerDrum` hücresinden okunur. Emniyet freni bir vinç değil
     KALDIRMA GRUBU özelliğidir (`hasSafetyBrake`); bölüm 2.8 yalnız freni olan
     grupta görünür (`HoistSectionDef.visible`).
   - `presentation/module-access.ts` — modül girdi/sonuç/bağlam erişimi

6. **Standart referansları tıklanabilir.** `standards/registry.ts` FEM/DIN/CMAA
   maddelerini tablo + bağıntı + açıklama olarak tutar; hesap satırındaki
   `standard` alanı bu deftere çözülür ve arayüzde pop-up açar. Yeni bir
   `standard: "..."` yazarsan deftere de ekle (aksi hâlde rozet ölü kalır).

7. **Revizyon = snapshot.** `revisions` tablosunda inputs/selections/results
   JSONB. `draft` düzenlenebilir, `issued` kilitli (DB trigger). Kapatılan hesap
   bölümleri `inputs.disabledModules` listesinde tutulur; girdileri korunur.
   Motora yeni girdi eklendiğinde eski revizyonlar `revision-load.ts`teki
   `withDefaults` sayesinde bozulmaz.

8. **Vinç topolojisi.** Bir vinçte 1–4 kaldırma grubu olabilir: ana, yardımcı ve
   en çok iki monoray. **Her kaldırma grubunun kendi kanca bloğu ve kendi
   arabası vardır.** Yardımcı kaldırma ya ana arabanın üzerindedir
   (`specs.auxTrolleyMode = "shared"`) ya da kendi arabasındadır (`"separate"`).
   Köprü yürütme tektir.

   Anahtarlar `presentation/module-family.ts`te tek yerde tanımlıdır
   (`ModuleKey`, `MODULE_ORDER`, aile eşlemesi, `HOOKBLOCK_OF`, `HOIST_OF_*`).
   Aynı aile aynı hesabı ve aynı sunum tanımlarını paylaşır; varyant farkı
   yalnız `hoistSpecView` / `travelSpecView` ile teknik özelliklerden okunan
   alanlardadır. Yeni bir anahtar eklemek için `ModuleKey`, `FAMILY`,
   `MODULE_ORDER`, `CALC_FIELD` (revision-load), `MODULE_LABELS` ve
   `ADAPTER_FACTORY` yeterlidir — switch zinciri çoğaltılmaz.

   Hangi bölümün hesaba gireceğini `engine.ts`teki `activeModules(specs,
   disabled)` belirler: kullanıcının kapattıkları + vinç konfigürasyonunun izin
   verdikleri + üst bölümü açık olanlar. Ana kaldırma, ana araba ve köprü
   kapatılamaz.

9. **Ağırlıklar teknik özelliktir.** Ana araba, yardımcı araba ve köprü
   ağırlıkları `TechnicalSpecs`te tutulur; yürütme, ana kiriş ve başkiriş
   hesapları oradan okur. Modül girdisi olarak ağırlık sorulmaz.

10. **Otomatik girdiler.** `derive.ts` bir "girdi"nin başka verilerden
    hesaplanabildiği yerleri toplar: halat ağırlığı (metre ağırlığı × kol ×
    yükseklik), kanca bloğu ağırlığı (kapasitenin %10'u), motor sıcaklık
    faktörü (ortam sıcaklığı üst sınırı). Her biri `*Auto` anahtarıyla açılıp
    kapatılır; anahtar açıkken alan salt-okunurdur ve editör türetilen değeri
    girdiye YAZAR (motor, PDF ve Excel aynı sayıyı görür). Halat donanımı
    seçildiğinde tahrikli/toplam kol sayıları da aynı mekanizmayla dolar.
    Makara verimi artık seçim değil sabit firma kabulüdür
    (`STANDARD_SHEAVE_EFFICIENCY`).

## Yeni bir hesap eklerken

1. **Standardın maddesini bul** ve `docs/standards/` altındaki inceleme
   notlarına bak. Excel dökümüne bakma.
2. **Saf fonksiyon yaz** — `src/lib/calc/` altında, yan etkisiz.
3. **Semantik anahtar ver** (`<blok>.<büyüklük>`) ve `cells`e yaz.
4. **Kontrol ekle**: `kind` + `severity` + `standard` alanlarını doldur.
5. **Standart defterine** maddeyi ekle (`standards/registry.ts`).
6. **Mühendislik doğrulama testi yaz** — denge, ölçek tutarlılığı, sınıf
   duyarlılığı, sınır durumları. Excel'e karşı DEĞİL, fiziğe karşı.
7. **Kontrolü satırına bağla**: `presentation/check-anchors.ts`.
   `__tests__/anchors.guard.test.ts` bağlantının gerçek bir satırı gösterdiğini
   ve hiçbir kontrolün rapordan düşmediğini doğrular.

## Birimler

Motor içi birimler kg, kg/cm², kg·cm, cm, mm, kN, kNm, Nm, kW, m/dak, d/dak.
**Sunum katmanı gerilmeleri MPa, momentleri Nm olarak gösterir** (`lib/units.ts`,
etiket bazlı dönüşüm). Rapor ve arayüzde kg/cm² görünmez.

## Dizin haritası

- `src/lib/calc/` — hesap motoru (saf): `engine.ts`, `modules/`, `beam.ts`,
  `shaftStress.ts`, `reeving.ts`, `derive.ts`, `hook-table.ts`, `coefficients.ts`,
  `tables.ts`, `types.ts`
- `src/lib/calc/presentation/` — sunum tanımları: bölümler, alan metadata'sı,
  kontrol bağlantıları, modül erişimi
- `src/lib/standards/` — standart kayıt defteri (tablolar + bağıntılar)
- `src/lib/diagrams/` — parametrik teknik resimler (saf veri modeli; web + PDF ortak)
- `src/lib/pdf/`, `src/lib/excel/` — rapor ve ekipman listesi çıktıları
- `src/lib/calc/__tests__/` — mühendislik doğrulama + bağlantı koruma testleri
- `src/lib/calc/__tests__/legacy/` — **tarihsel** karşılaştırma katmanı
  (eşleme tabloları + gerekçeli kapsam dışı/sapma sözlükleri). Şartname değil.
- `reference/excel-dump/` — ilk portun kaynak dökümü. DOKUNMA; yalnız tarihsel
  karşılaştırma okur. Yeni hesap için kaynak DEĞİLDİR.
- `supabase/migrations/` — şema + RLS + seed
- `docs/standards/` — FEM 1.001 / CMAA 70 inceleme notları + çapraz referans

## Güvenlik

- Token/secret asla commit edilmez; `.env*` gitignored. Service-role key sadece
  server tarafında.
- RLS: katalog tabloları herkese okuma / admin yazma; issued revizyon
  güncellenemez; audit_log insert-only.
- Admin bootstrap e-postaları: scolakoglu@orioncranes.com, sinan@vigowood.com
  (`handle_new_user` trigger'ı).
