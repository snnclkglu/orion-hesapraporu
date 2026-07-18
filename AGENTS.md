<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ORION Hesap Raporu

Çift kirişli gezer köprülü vinç hesap raporu web uygulaması. Kaynak: "İSDEMİR - AMONYUM SÜLFAT VİNCİ Hesap Raporu V5.xlsx" (FEM 1.001 / DIN 15018 / CMAA 70). Mühendisler girdi + katalog seçimi yapar, sistem hesapları koşturur ve ✓/✗ kontrolleri gösterir; çıktı müşteriye teslim edilebilir PDF rapor + Excel listeleri. Revizyon arşivli, çok kullanıcılı (admin + mühendis).

## Stack

Next.js 16 (App Router, TS strict) · Tailwind v4 + shadcn/ui · Supabase (Postgres/Auth/RLS/Storage) · Zod · Vitest · @react-pdf/renderer · exceljs · Vercel. UI dili Türkçe; PDF rapor TR/EN başlıklı.

## Komutlar

- `npm run dev` — dev sunucu
- `npm test` — vitest (golden testler dahil)
- `npm run build` — production build
- Migration push: `npx supabase db push` (SUPABASE_ACCESS_TOKEN env ile; token asla commit etme)

## Mimari ilkeler

1. **Hesap motoru saftır**: `src/lib/calc/` altında DB/UI bağımlılığı olmayan saf TS fonksiyonları. `CalcInput` → `CalcResult` (tüm ara değerler + kontroller). Motor `ENGINE_VERSION` ile etiketlenir; her revizyon hangi sürümle hesaplandığını saklar.
2. **4 değer rolü** (Excel'den miras): `input` (kullanıcı girer) → `computed` (formül) → `selection` (mühendis katalogdan seçer) → `check` ({label, required, provided, operator, pass, standard}). UI bu döngüyü yansıtır: girdiler talebi üretir, mühendis seçer, kontroller yeşil/kırmızı.
3. **Excel sadakati**: Formül zinciri ve birimler (kg, kg/cm², Nm, m/min) Excel V5 ile birebir korunur. Golden testler `reference/excel-dump/*.txt` içindeki `VALUE=` alanlarına karşı ±0.1% toleransla çalışır; formül değişikliği = test kırılır.
4. **Revizyon = snapshot**: `revisions` tablosunda inputs/selections/results JSONB. `draft` düzenlenebilir, `issued` kilitli (DB trigger). Değişiklik yeni revizyon açar. Audit log insert-only.
5. **Parametrik modüller**: Ana/Yrd kaldırma = tek `hoistGroup` modülü; araba/köprü yürütme = tek `travelGroup` modülü (köprü varyantı: yaklaşma eksantrikliği, fren, 0.7 tampon faktörü).

## Excel kaynağındaki bilinen kusurlar (porta KOPYALANMAZ)

- `04-KANCA BLOĞU` §4.6 ve `09-BAŞKİRİŞ` yorulma blokları `#ref!` ile bozuk → `07-ANA KİRİŞ`'in çalışan DIN 15018 T17 mantığından (HLOOKUP+MATCH) yeniden yazılır; S235JR/S355JR malzeme girdisi eklenir.
- `06-KÖPRÜ!O160` boş `H156`'ya bakar (doğrusu `L156`) → düzeltildi olarak port edilir.
- `VERİ` sayfası ölü (#ref! kepçe geometrisi) → port edilmez.
- Köprü freni (6.6) Excel'de seçilmemiş → uygulamada seçim alanı vardır.

## Anahtar alan bilgisi

- `AnakaldırmaM` (Excel isimli aralık) = mekanizma sınıfı (M1–M8), tüm FEM katsayı lookup'larının anahtarı: halat Zp, tambur/makara H katsayısı.
- Kullanım sınıfı T0–T9 → gerekli rulman ömrü saat bandı (alt/üst).
- Kontrol idiyomu: Excel `IF(a>=b,"ü","û")` (Wingdings ✓/✗) → kodda boolean `pass`.
- KATSAYILAR sayfası → `cat_*` Supabase tabloları (seed migration'larda). Motor/redüktör/halat katalogları YOK — serbest giriş + kontrol; ileride katalog eklenecek.
- Redüktör çevrim oranı sapma toleransı: +5% / −10% (Excel `O182`).

## Dizin haritası

- `src/lib/calc/modules/` — hoistGroup, hookBlock, travelGroup, mainGirder, buckling, endCarriage, summary (her biri Excel'deki bir sayfaya karşılık)
- `src/lib/calc/coefficients.ts` — Excel IF zincirlerinin tablo lookup karşılıkları
- `src/lib/calc/__tests__/` — golden testler (fikstür: ana + yrd kaldırma)
- `supabase/migrations/` — şema + RLS + seed
- `reference/excel-dump/` — Excel hücre dökümleri (format: `HÜCRE<TAB>FORMULA<TAB>=formül<TAB>VALUE=değer` veya `HÜCRE<TAB>STATIC<TAB>değer`). DOKUNMA — golden test kaynağı.

## Güvenlik

- Token/secret asla commit edilmez; `.env*` gitignored. Service-role key sadece server tarafında.
- RLS: katalog tabloları herkese okuma / admin yazma; issued revizyon güncellenemez; audit_log insert-only.
- İlk admin: sinan@vigowood.com.
