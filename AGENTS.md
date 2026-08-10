<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ORION Cranes — İş Yönetim Sistemi

Vinç işlerinin tek yerden takibi: iş emri → ürün → mühendislik → imalat → satış.
Uygulama bir HESAP RAPORU aracı olarak başladı ve adı bir süre onu taşıdı; bugün
hesap raporu bölümlerden BİRİDİR. Kapsam: iş emirleri (`/jobs`), hesap raporu
projeleri ve revizyon arşivi (`/projects`), **teknik resim paketleri**
(`/drawings` — ressamın klasörü olduğu gibi girer, md. 18), ekipman listeleri,
üretici katalogları (`/katalog`), atölye çalışma saatleri (`/worklog`) ve satış
takibi (`/sales`). Çok kullanıcılı, dört rollü.

Uygulamanın adı TEK YERDE tanımlıdır: `src/lib/app.ts` (`APP_NAME`,
`APP_TITLE`, `APP_TAGLINE`) — kabuk, giriş sayfası ve sekme başlığı oradan okur.

## Temel ilke: hesap yöntemi standartlara dayanır, bir tabloya değil

Uygulama ilk sürümünde bir Excel dosyasından port edilmişti. **Bu bağımlılık
kaldırılmıştır.** Hesap motoru artık kendi yöntemini doğrudan standartlara
dayandırır:

- **FEM 1.001** (3rd Ed. Rev. 1998) — sınıflandırma, yükler, halat/tambur/
  makara/tekerlek/rulman seçimi, plaka burkulması; **Kitapçık 9** ile
  güncellenen dinamik katsayı φ2 (md. 9.3) ve savrulma modeli (md. 9.4.1)
- **DIN 15018** — çelik yapı yorulması (Tablo 17/18, Tablo 2 dinamik katsayı)
- **DIN 15400 / 15401 / 15402** — kanca taşıma kapasiteleri
- **DIN 15061** — halat yivi adımı
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
- `npx tsx scripts/test-work-order.ts` — iş emri PDF'ini 1…16 kalemle üret
  (sayfa dengesi görsel kontrolü)
- `npx tsx scripts/test-work-log-excel.ts` — İş Takibi Excel çıktısını üret
  (sayfa yapısı, süzgeç, dondurulmuş başlık — duman testi)
- `npx tsx scripts/test-safety-brake-diagram.tsx` — emniyet freni şemasını altı
  yerleşim düzeninde SVG olarak üret (kaliper konumları + yazı çakışması)
- `python scripts/catalog-sheets.py [--verify] [--only <tür>]` — katalog
  sayfalarını kaynak PDF'lerden kes; `--verify` yalnız haritayı sınar
- `npx tsx scripts/test-drawings.ts` — iki gerçek teslim klasörünün içe
  aktarım raporunu bas (Teknik Resimler duman testi)
- `npx tsx scripts/test-drawings-register.ts` / `-outputs.ts` — parça defteri
  ve üç türev çalışma kitabını gerçekten üret ve geri oku
- `/dev/drawings-preview` — Teknik Resimler ekranlarının AUTH'SUZ görsel
  önizlemesi (yalnız development). Ekran değiştirdiysen ÖNCE orada bak
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
   - `plate-buckling.ts` — FEM 1.001 A-3.4 plaka burkulması çekirdeği: Euler
     referans gerilmesi, Kσ/Kτ (T.A.3.4.1), etkileşimli kritik gerilme σvcr.c,
     orantı sınırı ve ρ indirgemesi (T.A.3.4.2), emniyet katsayısı νv (md. 3.4).
     **σvcr.c bağıntısında karekök içi TOPLAMADIR** — standardın basılı
     metnindeki çarpma bir dizgi hatasıdır; FEM'in kendi çözümlü örneği
     (168 N/mm²) ve τ = 0 → σvcr.c = σvcr özdeşliği bunu kanıtlar.
   - `diagrams/chart.ts` — kartezyen grafik katmanı (eksen, "güzel sayı" tikleri,
     ızgara, eğri, çalışma noktası, kullanım oranı çubuğu). Şematik teknik
     resimlerden farklı olarak GERÇEK grafik çizen bölümler bunu kullanır.

   **Şema okunurluğu ÖLÇÜLÜR, gözle aranmaz.** Üst üste binen yazı bu projede
   defalarca ekran görüntüsüyle bildirildi; artık
   `diagrams/__tests__/legibility.guard.test.ts` bütün bölümlerin bütün
   diyagramlarını üretip üç şeyi sayar: etiket-etiket çakışması, ETİKETİN
   ÜSTÜNE sonradan çizilen dolu şekil (SVG boyama sırası belge sırasıdır) ve
   çerçeve dışına taşan etiket. `resolveTextOverlaps` yalnız METİN-METİN
   çakışmasını görür — yazının duvara/dolguya binmesini göremez, o yüzden
   şematik üreticiler etiket şeritlerini kendileri ayırır.

   Koruma İKİ FİKSTÜRLE koşar: V5 şablonunda kabin ve elektrik mahali KAPALIDIR
   (`electricalAccommodationType: "none"`) ve 11.x mahal şemaları hiç
   üretilmez — tam da onlar kapsam dışında kalıp gözden kaçmıştı. Testin ilk
   maddesi bu yüzden kapsamın kendisini de doğrular.
   - `presentation/module-access.ts` — modül girdi/sonuç/bağlam erişimi

11. **Teker yükleri yol kirişinin girdisidir.** `wheelLoads.ts` bir mekanizma
    değil TESLİM edilen kuvvet setini üretir: düşey teker yükleri, FEM
    Kitapçık 9 md. 9.3 dinamik katsayısı φ2, md. 9.4.1 savrulma kuvvetleri ve
    md. 2.2.3.1.1 boyuna kuvvetler. Girdilerinin neredeyse tamamı köprü
    yürütme bölümünden ve teknik özelliklerden OTOMATİK gelir
    (`wheelLoadDepsFrom`); mühendis yalnız teker düzeni ölçü zincirini ve
    kılavuzlama verilerini girer.

    **Teker düzeni:** vinç dört köşesinde EŞİT sayıda tekerle yürür → toplam
    adet dördün katıdır (4…24, `WHEEL_COUNT_OPTIONS`), köşe başına toplam/4,
    ray başına toplam/2 teker. Geometri BİR RAY için verilir (karşı ray
    aynıdır) ve ardışık teker eksenleri arası mesafelerle tanımlanır — teknik
    resimdeki ölçü zincirinin birebir karşılığı. Tekerler ön köşede `A1…Ak`,
    arka köşede `B1…Bk` kodunu taşır; savrulmadaki dᵢ uzaklıkları `A1`
    ekseninden ölçülür. Mesafeler `components/wheel-spacing-editor.tsx`
    görsel düzenleyicisinden yazılır (`AdapterSection.editor`).

    **Sapma (belgelenmiş):** µ' (yakın rayın yük payı) araba kolundan değil
    DÜŞEY TEKER YÜKLERİNDEN türetilir — köprünün kendi ağırlığı iki raya eşit
    dağıldığından (l−e)/l yük payına eşit değildir. Gerekçe modül başlığında.

15. **Feston bir katalog ürünüdür, teknik özellik değil.** I-kiriş kablo
    taşıyıcı sistemi yürütme grubunun 5.9 bölümüdür: ürün `cat_equipment`
    kataloğundan seçilir (`kind = "festoon"`, Conductix-Wampfler + Vasel),
    taşıyıcı adedi / kablo paketi / loop yüksekliği modül GİRDİSİDİR, taşıyıcı
    başına yük ve hız sınırı KONTROLdür. Hareket mesafesi sorulmaz — arabada
    açıklık, köprüde yürüme yolu uzunluğudur (`travelFestoonDistanceM`).
    Katalogda hız limiti yayımlanmayan seride kontrol BİLGİLENDİRMEYE düşer;
    uygulama varsayımsal bir limit üretmez. Eski revizyonların
    `specs.<eksen>Festoon` verisi `migrateFestoon` ile modül girdilerine taşınır.

    **Satır = KABLO ARABASI PARÇA NUMARASI.** `cat_equipment.model` siparişe
    giden araba kodudur (Conductix `032252-250x160`, Vasel `VS2005A-CT80`);
    program/seri kodu `attrs.series` altındadır ve seçicinin ikinci süzgeç
    adımıdır (ilki kablo formu). Kaynak kataloglar seçimi böyle basar: aynı
    program içinde kablo mesnedi çapı dₐ, araba genişliği b₁ ve kablo paketi
    penceresi b₂ × s parça numarasına göre değişir. Eşlemede `festoonTrolleyCode`
    `from: "model"` taşır — katalog SAYFASI marka + model ile arandığından bu
    bağ zorunludur (`catalogIdentityFields`).

    **Kaynak ve doğrulama durumu ayrımı.** Conductix satırları (92) KAT0320-
    0003b-EN'in ürün tablolarından birebir gelir; yük ve hız katalogun program
    başlığında yayımlanmıştır. Vasel satırlarında (23) PARÇA KODLARI Cat.4b/52
    broşüründen birebirdir ama TAŞIYICI YÜKÜ ve HIZ broşürde YAYIMLANMAMIŞTIR:
    o iki alan üretici ürün sayfalarından gelir, satır `unverified: true`
    taşır ve `load_source` kaynağı yazar. Broşürde yalnız fotoğraf + katalog
    sayfa referansıyla verilen Vasel aileleri (2050/2060/2070, VS25-S2,
    VS26-S3, VS26-S4) parça kodu ve kablo formu TAŞIMAZ; `catalog_ref`
    mühendisi Cat.4b/52'nin ilgili sayfasına yönlendirir. Çelik araba parça
    numarasının sonundaki `/...` yürüyüş takımı kodudur (makara malzemesi +
    kiriş soneki) ve siparişte tamamlanır; model alanında taşınmaz.

16. **Kabin ve elektrik odası kendi bölümüdür (11.x).** Teknik özelliklerde
    yalnız VARLIK sorulur: kabin var mı, elektrik nerede duruyor (oda / pano),
    o mahalde klima var mı. Ölçüler, izolasyon, KAPI ADEDİ, pano adedi ve
    kurulu yedek düzeni modül girdisidir; klimanın kendisi TMS kataloğundan
    seçilen bir üründür (`kind = "air_conditioner"`) — katalogdan seçim yalnız
    hesap bölümlerinde yapılabildiği için bölüm ZORUNLUDUR. Eski revizyonların
    `specs` altındaki ölçüleri `migrateCabin` ile taşınır; iklimlendirme SINIFI
    ("industrial" …) artık sorulmaz, "none" dışındaki her eski değer "klima
    var" okunur.

17. **Mahal iklimlendirme yükü hesaplanır — `climate-load.ts`.** Çekirdek
    saftır ve üç mahal (kabin · elektrik odası · pano) aynı fonksiyondan
    geçer:

        Q = iletim + güneş + ışınım + cihaz ısısı + taze hava  ⟶  × (1 + emniyet)

    - **İletim**: U·A·ΔT, U değeri EN ISO 6946 (Rsi 0,13 · Rse 0,04). KAPILAR
      kendi U değeriyle ayrı hesaplanır ve panel alanından düşülür — kapı
      adedinin sorulma sebebi budur (aynı sayı sızıntıya da girer).
    - **λ SICAKLIKLA ARTAR.** Taş yününün beyan değeri 10 °C ortalama
      sıcaklıktadır; gerçek ortalama (dış+iç)/2'dir. 60 °C ortamda bu 41 °C
      eder ve λ ~%15 yükselir. Beyan değerini doğrudan kullanmak ısı geçişini
      o kadar EKSİK hesaplar — bu hata sessizdir, bu yüzden düzeltme
      çekirdektedir. Panel ekleri ve karkas için ayrıca %15 ısı köprüsü payı
      eklenir.
    - **Güneş** ayrı bir kalem DEĞİLDİR: ASHRAE güneş-hava (sol-air)
      sıcaklığıyla iletimin içine girer ve yalnız `installationEnvironment =
      "outdoor"` iken devrededir. Boya soğurma katsayısı α gerçek bir tasarım
      kaldıracıdır (açık renk çatı yükü belirgin düşürür).
    - **Işınım HESAPLANMAZ.** Çevredeki sıcak yüzeyden gelen yük görüş hattı
      ister; elektrik odası platform üzerindeyse ya da altında ısı kalkanı
      varsa yük ihmal edilebilir düzeye iner (parlak alüminyum kalkan net
      ışınımı ~%93 keser). Uygulama bunu bilemez: mühendis girer, girmezse
      kalem sıfırdır ve `kind:"bilgi"` bir kontrol raporda bunu açıkça söyler.
    - **Taze hava**: basınçlandırmayı (Δp = 4 Pa) ayakta tutan sızıntı
      debisinin TAM ENTALPİ farkı — duyulur ve gizli ayrı ayrı değil. Sıcak
      ortamda yükün büyük kısmı NEMDEN gelir; `ambientRelHumidityPct` bu
      yüzden bir teknik özelliktir.

    **Pano kayıp gücü motor güçlerinden türetilir (`drive-losses.ts`).**
    Mühendisten sürücü gücü İSTENMEZ: vinçte sürücü ağır hizmet sütunundan,
    yani motorun anma gücüne göre bir büyük gövdeden seçilir ve ABB ACS880
    katalogu her gövdenin "Heat dissipation" değerini yayımlar. Üstüne besleme
    ünitesi/trafo/PLC payı (%80) ve eşzamanlılık (0,6) uygulanır — vinç kesikli
    çalışır, bütün sürücüleri aynı anda tam yükte saymak klimayı gereksiz
    büyütürdü. `*Auto` anahtarı kapatılınca mühendis kendi listesini yazar.

    Sabit firma kabulleri çekirdektedir ve SORULMAZ: oda tasarım sıcaklığı
    25 °C / %50, Δp = 4 Pa, üfleme ΔT = 8 K, sızıntı açıklığı (kapı başına
    3 cm² + sabit 4 cm²), emniyet katsayısı %15.

    **KABİN BİR E-HOUSE DEĞİLDİR.** Operatör kabininde iki kalem daha vardır ve
    ikisi de yükü belirler:
    - **CAM** — kabini kabin yapan yüzey. Tek cam U = 5,7 W/m²K, panelin ~13
      katı; duvar alanından düşülür, kendi U'suyla hesaplanır ve açık havada
      güneşi g katsayısıyla DOĞRUDAN geçirir (iletim yoluyla değil). Açık
      havada bu kalem çoğu zaman cihaz ısısını da geçer.
    - **OPERATÖR** — 75 W duyulur + 55 W gizli (ASHRAE, oturur hafif iş). Asıl
      etkisi ısısı değil, **temiz hava gereğidir**: basınçlandırma sızıntısı
      yalnız fazla basıncı tutar, insanın hava ihtiyacı ondan bağımsız bir
      sağlık gereğidir (EN 16798-1 / ASHRAE 62.1). Kabinde taze hava debisi bu
      ikisinin BÜYÜĞÜdür ve kişi başı 5 L/s çoğu zaman kazanır. Kapı ölçüsü de
      ayrıdır (0,7 × 1,9 m); oda kapısı küçük bir kabinde duvarın dörtte birini
      kaplayıp iletimi gerçekdışı büyütürdü.

    Her iki bölüm de bir ŞEMA çizer (`diagrams/climateRoom.ts`): mahal kesiti
    (zarf · kapı · cam · operatör · cihazlar · klima, ısı okları) ve yük
    dağılımı çubuğu. Sayı tablosunun anlatamadığı şey hangi kalemin baskın
    olduğudur; "yalıtımı artırsam ne olur" sorusunun cevabı oradadır.

    **Kapsam sınırı:** bu bir ÖN BOYUTLANDIRMA ve KONTROLdür. Kapasite
    kontrolü gerçektir (hesaplanan yük ≤ katalog soğutma kapasitesi, üretici /
    engelleyici) ama nihai kapasite üreticinin proje bazlı teyidine tabidir.
    Tarihsel karşılaştırma `__tests__/climate-load.test.ts` sonundadır. TMS'in
    Erdemir E-HOUSE raporuna karşı iletim %1, hesaplanan yük %1 sapar; toplam
    %3,6 sapar (emniyet katsayısı %10 yerine %15) ve ışınım kalemi bilinçli
    olarak boştur. TMS'in Erdemir OPERATÖR KABİNİ raporu aynı E-House formuyla
    üretilmiştir ve cam / operatör / temiz hava kalemlerini hiç sormaz;
    uygulama bu üçünü hesaba kattığı için sonuç oradan %20'den fazla YÜKSEK
    çıkar — bu bir yuvarlama farkı değil, eksik kalemlerdir.

13. **Katalog ürünü kullanım grubuna bağlıdır.** Bir redüktör ya kaldırma ya
    yürütme tahrikidir; `cat_equipment.attrs.application` (`kaldirma` |
    `yurutme`) bunu taşır. Bölümün katalog eşlemesindeki
    `lockedFacets` seçiciyi o gruba KİLİTLER (sunucu tarafında
    `attrs->>application`): 2.3 kaldırma redüktörü yürütme ürünü, 5.5 yürütme
    redüktörü kaldırma ürünü göstermez. Kilitli süzgeç adım listesinden çıkar,
    başlıkta rozet olur; kullanıcı değiştiremez.

    Katalog verisi `catalog_data/*.json` → `scripts/seed-catalog.ts` →
    migration yolunu izler. **Uygulanmış bir seed migration'ı düzenlenmez**;
    `--kinds <tür> --out <yeni_dosya>` ile o türü silip yeniden yazan bir
    yenileme migration'ı üretilir. YILMAZ redüktör kataloglarının PDF'ten
    çıkarımı `scripts/catalog-extract/` altındadır (yöntem ve doğrulama durumu
    kendi README'sinde).

    **Eşleme sessizce eksik doldurur:** `applyCatalogPick` katalogda karşılığı
    olmayan alanı atlar ve eski değer kalır. Engelleyici bir kontrolü besleyen
    alan (ör. `gearboxAllowedRadialKn`) bu yüzden koruma testine bağlıdır —
    `src/lib/__tests__/catalog-mapping.test.ts`.

    **Katalog SAYFASI ayrı bir yoldur.** Seçim tablosu ürünün sayılarını verir;
    mühendis çoğu zaman sayfanın kendisini de görmek ister (ölçü resmi, dipnot,
    üretici uyarısı). `scripts/catalog-sheets.py` kaynak PDF'ten sayfayı keser
    (`catalog-sheets/<tür>/*.webp`) ve `src/lib/catalog-sheets/manifest.json`
    defterini yazar; `Katalog Seçimi` başlığındaki **Katalog Sayfası** düğmesi
    bu deftere bakar.

    Sayfa iki yoldan bulunur: **elle** (`MANUAL` — kaplinler; ÖZGÜN kataloğu
    taranmış olduğu için tek yol budur) ve **otomatik** (`DISCOVER` — her ÜRÜN
    için, ürünün model kodu + sayısal alanlarının en çoğunu taşıyan sayfa
    seçilir). Tek bir kodun kataloğun her yerinde geçmesi sayfayı kazandırmaz;
    ürünün SATIRININ bulunduğu tablo sayfası kazanır. Eşiği geçemeyen ürüne
    sayfa YAZILMAZ. `--verify` haritayı dosya yazmadan sınar.

    Eşleme SERİ önekiyle değil MODEL koduyla yapılır ("A" serisi ile
    "ABC-V 260" karışırdı); tam eşleşme yoksa tasarım soneki atılmış temel koda
    düşülür ("22212" ↔ "22212 E"), o da yoksa sayfa AÇILMAZ — yakın bir sayfa
    göstermek yanlış ölçü tablosuna baktırırdı. Manifestteki model dizgileri
    `cat_equipment.model` ile BİREBİR aynıdır; seed'in model kurma kuralı
    değişirse betikteki `db_model` de değişmelidir.

    **Yalnız görüntü saklanır, PDF dilimi değil:** sayfa dilimi PDF'i kaynağın
    taranmış görüntüsünü olduğu gibi taşıdığı için dosya başına 200–800 KB
    tutuyordu; 260'ı aşkın sayfada depoyu şişirirdi. Dosyalar `public/` altında
    DEĞİLDİR: üretici kataloğu kimlik doğrulamalı `/api/catalog-sheet/...`
    ucundan sunulur.

    **Katalog sayfasının kendi adresi vardır: `/katalog?tur=…&marka=…&model=…`.**
    Ekipman listesinde EKİPMAN ADI bu adrese bağlanır — uygulamada yeni sekmede,
    Excel'de köprü olarak, standart PDF'te dış bağlantı olarak. Adres ÜRÜN
    KİMLİĞİNİ taşır, defterin iç kimliğini değil: `manifest.json` yeniden
    üretildiğinde sayfa kimlikleri değişebilir ama ürün kimliği değişmez, yani
    daha önce indirilmiş bir Excel'in bağlantısı ölü kalmaz. Adresi
    `catalogSheetPageUrl` üretir, listedeki eşlemeyi `buildCatalogSheetUrls`
    kurar; tur `__tests__/catalog-sheets.test.ts`te kapanır. Model hücresindeki
    bağlantı BAŞKA bir şeydir (yönetim panelinden girilen üretici datasheet'i).

    **Eşleme MARKA sütunundaki "-"yi marka SAYMAZ.** Ekipman listesi markası
    olmayan satıra "-" yazar; bu metin marka gibi ele alındığında kimliği tek
    birleşik "MARKA MODEL" alanında duran bölümlerin (redüktör 2.3/5.5, tampon
    5.8, yürütme freni 5.5b) HİÇBİRİ sayfa bulamıyordu — `<tür>|-|<model>`
    anahtarı tutmuyor, marka önekini modelden ayıklayan yol da `brand` dolu
    göründüğü için hiç çalışmıyordu (`realBrand`). Kimliği görünen sütunlarda
    OLMAYAN satır arama modelini `EqRow.catalogModel` ile ayrıca taşır.

    **Ekipman listesi PDF'i iki seviyelidir.** *Standart* liste bugünkü
    tablodur ve adı dış adrese bağlar. *Detaylı* liste (`?detay=1`) aynı
    tablonun arkasına ürünlerin katalog sayfalarını EKLER; ad artık belge
    içindeki o yaprağa gider (`Link src="#…"` + `View id="…"`). Ek sayfalar
    DİKEY basılır — kaynak taramalar dikeydir, yatay sayfada yüksekliğe
    sığdırmak ölçü tablosunu okunmaz yapardı. Görüntüler `.webp`tir ve react-pdf
    webp çözmez: dönüştürme `pdf/catalog-sheet-images.ts`te sharp ile yapılır
    (JPEG, 1400 px) ve PDF katmanına hazır tampon olarak girer. Aynı katalog
    sayfasına düşen iki ürün yaprağı iki kez bastırmaz, ikisi de aynı çapaya
    bağlanır (`CatalogSheetPage.keys` çoğuldur).

    **Sayfa MARKA + MODEL ile bulunur; bölümün o kimliği SAKLIYOR olması
    gerekir.** Redüktör (2.3 / 5.5), yürütme freni (5.5b) ve tampon (5.8)
    eşlemelerinde kimlik tek bir birleşik `brand_model` alanındadır;
    `catalogIdentityFields` bunu `combinedField` olarak verir ve defter marka
    önekini kendisi ayıklar. Motor eşlemesinde ise MODEL alanı hiç yoktu —
    `motorModel` bu yüzden eklendi. Bu bağ koptuğunda hiçbir test kırılmaz,
    düğme sessizce pasif kalır: koruma `__tests__/catalog-sheets.test.ts`tedir.

    Kapsam: kaplin · rulman · rulman yatağı · fren · tampon · redüktör
    (Yılmaz + FLENDER + POLAT + SEW) · motor (ABB, GAMAK, INNOMATICS, SEW) ·
    feston (Vasel + Conductix-Wampfler) · **halat** (CASAR, Haşçelik,
    OLIVEIRA, DIEPA). Kanca, makara, teker ve ray kataloglarının kaynak PDF'i
    workspace'te olmadığı için deftere giremez; TMS klima kataloğu ise yalnız
    web sayfalarından derlenmiştir. Halatta model kodu YOKTUR (seed onu
    ölçüden kurar: "Ø14 Eurolift IWRC 1960 MPa"), bu yüzden `db_model`
    halat türünde `meta.series`i de okur ve sayfa kanıtı model kodu yerine
    ÇAPTAN gelir. Feston kataloğunda süzgeç SERİ LİSTESİ yerine
    ALAN SÖZLÜĞÜ de olabilir (`{"series": [...], "cable_form": [...]}`): aynı
    program yassı ve yuvarlak kabloyu ayrı sayfada basar, seri kodu ikisinde
    de aynıdır. Workspace'teki FB0300-0005-E feston dosyası bir SORU FORMUDUR
    ve deftere GİRMEZ; ürün kataloğu KAT0320-0003-EN'dir.

    **Üçüncü yol — BAŞLIK TARAMASI (`HEADER_SCAN`).** Bazı kataloglar ölçü
    sayfalarını ürün ürün değil TİP + BOY ARALIĞI olarak basar ("Type H3 —
    Gear unit dimensions, three-stage, gear unit sizes 13 to 18"). Orada
    sayısal keşif çalışmaz, elle harita ise yüzlerce satır olurdu; sayfa
    BAŞLIĞI okunur ve aralığa düşen bütün boylar o sayfaya bağlanır. FLENDER
    MD 20.1 böyle haritalanır ve yalnız YATAY montaj bölümleri (böl. 4 ve 6)
    alınır — defter model başına tek sayfa seti tutar.

6. **Standart referansları tıklanabilir.** `standards/registry.ts` FEM/DIN/CMAA
   maddelerini tablo + bağıntı + açıklama olarak tutar; hesap satırındaki
   `standard` alanı bu deftere çözülür ve arayüzde pop-up açar. Yeni bir
   `standard: "..."` yazarsan deftere de ekle (aksi hâlde rozet ölü kalır).

14. **Hesap raporu İŞE değil İŞ KALEMİNE bağlanır.** Bir iş emri (`jobs`)
    birden çok ürün içerir (`job_items`); rapor bir ÜRÜNÜN hesabıdır, işin
    değil. Bağlantı `job_items.project_id`tedir; `projects.job_id` yalnız hızlı
    süzme içindir ve `assignProjectToJob` ikisini birlikte yazar. İş detayında
    her kalem satırı kendi raporunu gösterir; kaleme bağlanmamış raporlar ayrı
    listelenir ki eşleşmemiş kayıt gözden kaçmasın.

    **Kalem numarası kuralı** (`autoItemNos`, jobs/schema.ts): iş no `0075` ise
    TEK kalemli işte kalem `0075-00`, ÇOK kalemlide numaralar `0075-01`den
    başlar — yani ikinci kalem eklendiğinde ilk kalemin numarası da kayar.
    Otomatik anahtar kapatılınca elle yazılır (uygulamanın `*Auto` deseni).

    **DOKÜMAN NO = İŞ KALEMİ NUMARASI.** `projects.doc_no` bir kalem
    numarasıdır ve belge kodu ondan türer (`docCode`, pdf/doc-naming.ts):

        0055-01  →  ORC-HR-0055-01-R01
        0055-02  →  ORC-HR-0055-02-R01

    Alan serbest metin bırakıldığı için üç yazım birden dolaşıyordu: `0055`
    (kalemsiz — aynı işe ikinci kalem eklenince ikinci rapor benzersizlik
    kısıtına takılır ve kod hangi kaleme ait olduğunu söylemez), `0055-01`
    (doğru olan) ve `0055-HR-001` (şemanın ilk yorumundaki örnek; belge kodunda
    "HR" iki kez çıkıyordu). Yeni rapor penceresinde kalem seçiliyken alan
    SALT-OKUNURDUR ve altında üretilecek kodun canlı önizlemesi durur.
    ESKİ KAYITLAR DÖNÜŞTÜRÜLMEDİ (kullanıcı kararı): yayınlanmış raporların
    kodu teslim edilmiş PDF'lerle aynı kalmalıdır.

    **Müşteri defteri** (`customers`) iş emrinden ayrıdır: iş emrindeki
    `customer_*` metin alanları basıldığı andaki bilginin FOTOĞRAFIDIR, defter
    sonradan güncellenince yayınlanmış iş emri değişmez. Müşteri yalnız
    LİSTEDEN seçilir ya da "Yeni Müşteri" ile deftere yazılır — serbest metin
    girişi kaldırıldı, çünkü defter dışında ikinci bir müşteri listesi büyüyor
    ve kısaltma/renk gibi defter alanları o kayıtlara bağlanamıyordu. Yeni
    kayıtta zorunlu tek alan MÜŞTERİ ADIDIR; defter Yönetim → Müşteriler'den
    düzenlenir ve silinir (`jobs.customer_id` `on delete set null`, iş emri
    silinmez).

    **İş durumu** `job_status` enum'udur (aktif · pasif · tamamlandı · arşiv);
    `projects.status` ile karıştırılmaz, etiket/renk `lib/job-status.ts`tedir.

    **Liste ekranları KISALTMA ve RENK gösterir (`lib/tags.ts`).** Resmî unvan
    satırın yarısını yiyordu; İşler ve Satış Takibi artık `customers.short_name`
    ile müşterinin kendine özgü rengini gösterir, tam unvan `title` ile durur.
    Kısaltmanın otomatik değeri adın İLK KELİMESİDİR ve kullanıcı düzeltebilir.

    **Renk bir HEX değil AÇIDIR** (`customers.color_hue`, 0–359). Gerekçe: aynı
    hex açık ve koyu temada birden okunmaz. Veri yalnız OKLCH ton açısını
    taşır, doygunluk ve parlaklık `globals.css`teki `.oc-tag` kuralında ve tema
    başına ayrı verilir — "soft pastel" kuralı veriyle değil TANIMLA garanti
    edilir; kullanıcı tonu seçer, pastelliği bozamaz. Yeni müşteri var olan
    tonlardan EN UZAK boşluğu alır (`nextDistinctHue`); defterde karşılığı
    olmayan ad ise metinden türetilir (`hueFromText`), yani ekran hiçbir zaman
    renksiz kalmaz. Aynı mekanizma satış kapsamı etiketlerini de renklendirir.

15. **Roller yetki SORUSUYLA sorulur, listeyle değil.** `user_role` dört değer
    taşır: `admin` (Yönetici) · `manager` (Müdür) · `engineer` (Mühendis) ·
    `draftsman` (Teknik Ressam). Kod hiçbir yerde rol listesi karşılaştırmaz;
    `lib/roles.ts`teki `isAdminRole` / `canSeeSales` / `canEditReports` sorulur.
    Roller HİYERARŞİ DEĞİLDİR — müdür satış rakamlarını görür ama yönetim
    paneline giremez ve hesap raporu yazamaz; mühendis rapor yazar ve taslağını
    siler ama satış rakamını görmez. Veritabanı karşılığı `is_admin()`,
    `can_see_sales()` ve `can_edit_reports()` fonksiyonlarıdır; menüden
    gizlemek yalnız görgü kuralıdır, asıl engel RLS'tir. Rol kümeleri
    `lib/__tests__/roles.test.ts`te dondurulmuştur: bir yetkiyi genişleten,
    hangi rollerin etkilendiğini orada görür.

16. **Satış Takibi İŞ KALEMİNE bağlanır ve AYRI TABLODADIR.**
    `job_item_sales` (kapsam, termin/sevk, miktar, ağırlık, birim fiyat, para
    birimi, kur) yalnız Yönetici ve Müdür'e açıktır. Alanlar `job_items`
    üzerine konsaydı satır bütün olarak okunduğu için fiyatı ayıklamak sunum
    katmanına kalırdı; ayrı tabloda yetkiyi RLS'in kendisi keser.

    **Satırlar önceden ÜRETİLMEZ:** sayfa `job_items` ile sol birleştirme yapar,
    kayıt ilk fiyat girildiğinde `upsert` ile oluşur. Tetikleyiciyle satır
    açmak, iş emri güncellemesi `job_items`i tamamen yenilediği için boş kayıt
    bırakırdı.

    **Toplamlar TÜRETİLİR** (`generated always as stored`): toplam ağırlık,
    toplam fiyat ve avro karşılığı birim değerlerden çıkar — elle girilen bir
    toplam onlarla çelişebilirdi. **Kur satırın kendindedir** (1 avro kaç birim
    para eder): merkezî bir kur tablosundan okunsaydı sözleşme anındaki kur
    değiştiğinde geçmiş cironun avro karşılığı da değişirdi. Firma ciroyu
    AVRODA toplar; kuru girilmemiş satır toplama girmez ve sayfada ayrıca
    sayılır ki sessizce kaybolmasın.

    **Kapsam açılır listedir ama liste KAPALI DEĞİLDİR** (`SALE_SCOPES`,
    lib/tags.ts). Sabit seçenekler devralınan verideki gerçek kapsamlardan
    çıkarıldı; kayıttaki değer listede yoksa pencere onu KENDİ seçeneği olarak
    korur ve "Diğer" ile serbest metin yazılabilir. Aksi hâlde eski satırlardaki
    ayrıntılı kapsam metinleri ilk kaydetmede sessizce silinirdi. Her kapsam
    kendi pastel tonunu taşır (sık kullanılanlar sabit, diğerleri metinden).

17. **İş Takibi bir GÜN × KALEM × PARÇA × TÜR çizelgesidir.** `work_logs` bir
    satırda tarih, iş kalemi, parça, imalat türü, KİŞİ SAYISI ve saat tutar;
    `man_hours` türetilir. Kişiler İSİMLE tutulmaz — atölye kaydı baştan beri
    kişi sayısıyla tutuluyor ve her gün isim yazmak günlük girişi kullanılamaz
    yapardı. Yetki `can_see_work_log()` / `canSeeWorkLog` (Yönetici + Müdür);
    `canSeeSales` ile aynı kümeyi döndürür ama AYRI bir sorudur.

    **Kalem numarası METİN, bağlantı TÜREV.** Atölye çizelgesi sistemdeki
    numaralandırmayı beklemez: `item_no` her satırda durur, `job_item_id` ve
    `job_id` eşleştiği ölçüde dolar (önce kalem, sonra iş kökü, sonra boş).
    Eşleşmeyen kayıt DÜŞÜRÜLMEZ; ekranda ayrıca sayılır ve "Kalem Eşleştirme"
    ile bir numaranın bütün satırları tek işlemde bağlanır (`remapItemNo`).
    Devralınan veride 0020-00 numarasının 792 satırı böyle bağlanır.

    **Parça ve imalat türü DEFTERDEDİR** (`work_parts`, `work_categories`),
    serbest metin değildir: kaynak çizelgede aynı parça beş yazımla girilmişti
    ("Anakiriş"/"Ana Kiriş") ve serbest metinle parça bazında toplam ALINAMAZDI.
    Yeni parça günlük girişteki arama kutusundan tek adımda açılır; imalat
    türünün rengi `nextDistinctHue` ile verilir (yığılmış grafikte komşu
    dilimlerin ayrılabilirliğini veri değil KURAL garanti eder).

    **Günlük giriş TEKRARI hedefler.** Devralınan veride bir günün satırlarının
    %87'si bir önceki iş gününden aynen devam ediyor ve 381 günün 170'i bir
    öncekiyle birebir aynı. Ekran bunu iki harekete indirir: "Önceki günü
    kopyala" ve sık kullanılan (kalem · parça · tür) üçlülerini tek tıkla satır
    yapan şerit. Gün BİR BÜTÜN olarak kaydedilir (`saveWorkDay`): satırlar
    kimlikleriyle eşlenir, kalanlar güncellenir, silinenler silinir — günü silip
    yeniden yazmak `created_by`/`created_at` bilgisini yok ederdi.

    **Pano grafikleri `lib/diagrams` KULLANMAZ.** O katman `DiagramEl[]` üretir
    ve aynı model web + PDF'e basılır; kategorik ekseni, çubuk/dilim ilkeli ve
    etkileşimi yoktur, renkleri sabit hex'tir. `components/charts.tsx` düz
    HTML/CSS çubuk kullanır (SVG `viewBox` ile ölçeklenirken YAZILAR da ölçeklenir
    ve dar kolonda okunmaz); yay gerektiren tek grafik halkadır ve orada yazı
    yoktur. Seri rengi veriden yalnız TON AÇISI olarak gelir, L/C `globals.css`
    `.oc-series-*` kuralında ve tema başına verilir — grafikte elle hex yazılmaz.

    **Süzgeç tanımı TEKTİR** (`worklog/filters.ts`): Analiz ekranı, Kayıtlar
    ekranı ve Excel indirme ucu aynı `matchesFilters`'ı çağırır. Üçünde ayrı
    yazılsaydı indirilen dosya ile ekrandaki tablo sessizce ayrışırdı. İndirilen
    dosyanın adı tarih ve saat taşır (`downloadName`): aynı süzgeçle alınan iki
    dosya klasörde birbirini ezmez.

18. **Teknik Resimler HOŞGÖRÜLÜ ANLAR, biçim DAYATMAZ.** `/drawings` teknik
    ressamın klasörünü olduğu gibi alır, içindekini okur ve **neyi
    anlayamadığını söyler**. Kural şu ölçülmüş gerçekten çıktı: incelenen iki
    teslim klasörü birbirine benzemiyordu (`0057-00-0500 - MONORAY (1 TON)` —
    174 dosya, düz yapı, tireli ad ↔ `0043-00-0000_MTC PASLANMAZ` — 454 dosya,
    üç seviye iç içe, alt çizgili ad; 1 ↔ 7 Excel; 7/9/11/13/14 sütun).
    Üçüncüsü de benzemeyecek. **Bir ressamın klasörünü sistemin reddetmesi, o
    ressamın bir daha sistemi kullanmaması demektir.**

    Dört ilke, dördü de pazarlığa kapalı:

    1. **HİÇBİR KURAL BİR YÜKLEMEYİ ENGELLEMEZ.** Tanınmayan dosya reddedilmez —
       saklanır, "tanınmadı" diye listelenir, elle bağlanabilir ve o bağ
       `drawing_aliases`a yazılıp **hatırlanır**. Sistem kullanıldıkça
       hoşgörüsünü kaybetmeden daha çoğunu anlar.
    2. **`engelleyici` DİYE BİR BULGU DÜZEYİ YOKTUR** ve eklenmeyecek. Üç düzey
       vardır: `eksik · celiski · bilgi` (`lib/drawings/types.ts`). Hesap
       motorundaki `engelleyici`nin (md. 4) burada karşılığı OLAMAZ, çünkü
       yükleme her zaman başarılıdır; rapor yalnız insanın neye bakması
       gerektiğini söyler.
    3. **YANLIŞ ALARM BU MODÜLÜN EN BÜYÜK DÜŞMANIDIR.** Yeni bulgu eklemeden
       önce fikstüre karşı KAÇ KEZ tetiklendiğini ÖLÇ. Üç kural ölçülüp
       kesildi: `Testere` kalemlerinden resim beklemek (13 bulgunun 12'si
       yanlıştı), alt montajdan DXF beklemek, gevşek `GRUP_BOLUNMUS` (7 yanlış
       alarm). `ICERIK_OKUNMADI` ve `DOSYA_DEPODA_YOK` **paket başına TEK**
       bulgudur — dosya başına yazılsalardı MTC'de 270 ve 162 satır ederdi ve
       gerçek bulgular o gürültüde kaybolurdu. Sessizlik çoğu zaman doğruluktur.
    4. **RAPOR DİLİ SUÇLAMAZ.** "Standart dışı" değil "tanıyamadım"; "hatalı"
       değil "iki kaynak farklı söylüyor". Tanıma oranı ressamın notu değil
       **sistemin kavrayışıdır** — `recognitionClass`ta kırmızı yoktur.

    **Çekirdek SAFTIR** (`src/lib/drawings/`, DB/HTTP importu yok): `reconcile`
    bir anlık görüntü alır, defter + bulgu döndürür. Bu sayede kural
    değiştiğinde 200 MB'lık paket YENİDEN İNDİRİLMEDEN yeniden çalıştırılır
    (`RECONCILER_VERSION`, hesap motorundaki `ENGINE_VERSION` ile aynı ruhta).
    Tek regex yerine **sıralı tanıyıcı listesi** (`recognize.ts`); dosya adı
    `" - "` ile bölünüp her parça kendi başına sınıflandırılır, **sıra
    önemsenmez**. Excel sabit şemayla değil **sütun sözlüğüyle** okunur.

    **BEYAN İLE ÖLÇÜM AYRI DURUR.** `file_count`/`bytes_total` satırlardan,
    `stored_*`/`skipped_*` ise bucket'ın kendisinden gelir ve dördünü de tek
    bir yer yazar: `verifyStorage`. İkinci bir yazan eklenirse ekran
    "170/169 dosya depoda" gibi kendi kendiyle çelişen sayılar basar — bu bir
    kez yaşandı. **Atlanan dosya EKSİK DEĞİLDİR:** yedek dosyalar ve bayt bayt
    kopyalar bilerek yüklenmez (`upload_skipped`) ve onları "ulaşmamış" saymak
    doğrudan md. 3'ü çiğner. Bayt karşılaştırmasının paydası da
    `bytes_total − skipped_bytes`tir; ham toplamla karşılaştırmak hiçbir bayt
    kaybetmemiş pakette bile kalıcı olarak "15 MB eksik" gösterirdi.

    **İLERLEME PAKETE DEĞİL PARÇAYA BAĞLIDIR.** `drawing_parts` TÜRETİLMİŞTİR
    ve her eşleştirmede silinip yeniden kurulur; atölyenin "bu parça kesildi"
    kaydı o döngüde kaybolmamalıdır. Anahtar bu yüzden `(item_no, part_code,
    stage)` METNİDİR, `package_id`/`part_id` yalnız kolaylık bağıdır
    (`on delete set null`) — İş Takibi'nin dersinin (md. 17) birebir aynısı.
    Revizyonda kayıt **devrolur**; imalatı etkileyen bir değişiklik varsa
    (`MANUFACTURING_DIFF_FIELDS`: ölçü · malzeme · kalınlık · adet · kategori)
    `review_required` işareti alır. Tanım ya da ağırlık değişikliği işaret
    ÜRETMEZ: ağırlık türetilmiş bir sayıdır, tanım düzeltmesi kesilmiş parçayı
    yanlış yapmaz — ikisi de listeye girseydi her revizyonda her kayıt
    işaretlenir ve işaret anlamını yitirirdi. **İşaret bir SORUDUR ve onu
    yalnız insan kapatır** (`setReviewMark`); devir işaret KOYAR, KALDIRMAZ.

    **YIKICI İŞLEMDE SIRA "ÖNCE UCUZ OLANI KAYBET"TİR.** `deletePackage` önce
    satırı siler (yetki + `count` okunarak), ANCAK SONRA depo nesnelerini.
    Ters sıra bir kez yazıldı ve sessiz veri kaybı üretiyordu: depo RLS'i
    ressamı geçiriyor, tablo RLS'i geçirmiyordu — baytlar gidiyor, kayıtlar
    kalıyordu. Satır gidip depo temizliği yarıda kalırsa yetim nesne kalır ve
    bu GERİ ALINABİLİR bir hatadır. **KİM** silebilir sorusunu RLS,
    **NE** silinebilir sorusunu tetikleyici cevaplar (`guard_issued_revision`
    ile aynı ayrım): üretime girmiş paket silinemez, yerine revizyon yüklenir.

    Kalem numarası METİNDİR, bağlantı TÜREVDİR (md. 17 ile aynı kural).
    Bir işin BİRDEN ÇOK paketi olabilir — anahtar `(item_no, group_code)` ve
    **tekillik kısıtı bilinçli olarak YOKTUR**; aynı çift ikinci kez gelince
    veritabanı reddetmez, sihirbaz "öncekini süperse edeyim mi?" diye SORAR.
    Soru yalnız `group_code` DOLUYKEN sorulur: adı çözülemeyen iki paket boş
    grupla eşleşir ve grup grup çalışılan bir projede bu en sık karşılaşılacak
    yanlış alarm olurdu.

7. **Revizyon = snapshot.** `revisions` tablosunda inputs/selections/results
   JSONB. `draft` düzenlenebilir, `issued` kilitli (DB trigger). Kapatılan hesap
   bölümleri `inputs.disabledModules` listesinde tutulur; girdileri korunur.
   Motora yeni girdi eklendiğinde eski revizyonlar `revision-load.ts`teki
   `withDefaults` sayesinde bozulmaz.

   **Taslak revizyon SİLİNEBİLİR, yayınlanmış SİLİNEMEZ.** Yanlış açılmış ya da
   yanlış yönde ilerlemiş bir taslağı temizlemenin yolu yoktu. İki kural AYRI
   yerdedir ve karıştırılmaz: NEYİN silinebileceğini `guard_issued_revision`
   tetikleyicisi (DELETE dalı), KİMİN silebileceğini `revisions_delete`
   politikası söyler. Yetki `can_edit_reports()` — Yönetici + Mühendis; raporu
   açan mühendis kendi taslağını temizlemek için yöneticiyi beklememelidir
   (PROJEYİ silmek hâlâ yalnız yöneticidedir). `deleteRevision` yalnız
   anlaşılır hata mesajı ekler. `equipment_notes`/`equipment_extras` yabancı anahtarla gider, PDF
   arşivi yalnız YAYINDA yazıldığı için yetim dosya kalmaz. Silmeden sonra
   "Yeni Revizyon" KALAN SON revizyondan kopyalar (`createRevision` en büyük
   `rev_no`yu okur): V1 silinince açılan yeni V1 yeniden V0'dan türer.

   **Editör ekranında çalışma alanı kutsaldır.** Mühendis günün büyük kısmını
   burada geçirir; kalıcı kabuk öğeleri buna göre kısılmıştır:
   - Kontrol özeti + Kaydet editörün üstünde ayrı bir kart DEĞİLDİR; sayfa
     başlığına, PDF Rapor düğmesinin soluna taşınır. Başlık sunucu bileşeninde,
     durum ise istemci durumunda olduğu için bağ bir PORTALDIR
     (`EDITOR_STATUS_SLOT_ID`); yuva yoksa şerit yerinde çizilir. İlerleme
     çubuğu, motor sürümü ve "bu bölüm n/m" sayacı alt adım şeridine indi.
   - Bölüm rayı daraltılabilir (`orion.editor.nav.collapsed`); dar kipte
     gruplar kalkar, yalnız BÖLÜM NUMARALARI kalır, kontrolü kalan bölüm çipin
     köşesindeki kırmızı noktadan anlaşılır.
   - Sol menünün daralt/genişlet düğmesi MENÜNÜN İÇİNDEDİR. Üst şeritte de bir
     eşi var ama orada ikon tek başına durduğu için neyi daralttığı
     anlaşılmıyordu: denetim, denetlediği yüzeyin üzerinde durur.
   - **Sol menü revizyon ekranlarına girilince KENDİLİĞİNDEN DARALIR**
     (`isRevisionScreen`, app-shell.tsx — editör + ekipman paneli; yeni rapor
     oluşturmak da buraya yönlendirdiği için ayrı kural gerekmez). Daralma
     ZİYARETE ÖZELDİR: mühendis orada genişletebilir ama bu localStorage'daki
     kalıcı tercihe YAZILMAZ, yani revizyondan çıkınca normal sayfalar
     kullanıcının kendi tercihine döner ve revizyona her girişte menü yine
     daralır. Kalıcı yazılsaydı editörde bir kez genişletmek bütün uygulamanın
     tercihini değiştirirdi. Kural `isFrame`ten AYRIDIR: `isFrame` sabit
     çerçeve YERLEŞİMİNİ seçer ve alt sayfaları bilinçli dışarıda bırakır,
     daralma ise revizyonun tamamı boyunca sürer.
   - Dar ray 4,5rem'dir (`SIDEBAR_W_COLLAPSED`), 3,5rem değil: etiketsiz
     16px'lik ikonlar okunmuyordu, ikon 24px'e çıktı ve satır 44px'lik dokunma
     hedefi oldu. Dar kipte marka SEMBOLÜ basılır (`orion-symbol-white.svg`);
     lockup'ı `object-cover` ile kırpmak sembolün tam üstüne denk gelip logoyu
     yarıda kesiyordu.
   - "+ Bölüm Notu" düğmesi bölüm BAŞLIĞINDA, kontrol rozetinin solundadır.
     İçeriğin ilk satırında dururken her bölümde bir satır boyu yer yiyordu ve
     çoğu bölümde hiç kullanılmıyor. Not KUTUSU yalnız not açıkken görünür.

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

12. **Buruşma ana kirişin bir kontrolüdür, bağımsız bir modül değil.**
    `buckling.ts` panel ölçülerini ve kenar gerilmelerini ELLE SORMAZ:
    `bucklingDepsFrom` ana kirişin kesit geometrisinden ve 7.4 gerilme
    analizinden türetir (`autoFromGirder`). Paneller FEM A-3.4'ün tanımına
    göre "mesnetli kenarlar arasındaki açıklık"tır:
    - **Yan sac**: b = boyuna berkitme (köşebent) mesafesi, yoksa gövde
      yüksekliği h3 · a = perde aralığı · e = t3
    - **Üst sac**: b = gövde sacları arası NET açıklık · a = perde aralığı ·
      e = t2 · gerilme düzgün (ψ = +1, tablo durum 1)
    Kenar gerilmeleri iki uç lif arasında doğrusal enterpolasyonla bulunur ve
    γc arttırma katsayısını taşır; ana kiriş çekmeyi pozitif tuttuğu için
    işaret bir kez `bucklingDepsFrom` içinde ters çevrilir (buruşmada
    **basınç pozitiftir**). Başlığın gövdelerden taşan çıkmaları üç kenarından
    mesnetli olduğu için T.A.3.4.1'in kapsamı dışındadır ve kontrol edilmez.

    **Yükleme durumları:** Durum I ve Durum III hesaplanır (ana kiriş de bu
    ikisini hesaplar). Durum II rüzgâr yükü ister; rüzgâr uygulamanın hiçbir
    modülinde modellenmediğinden buruşmada da kapsam dışıdır ve raporda
    `kind:"bilgi"` bir kontrolle açıkça belirtilir — sessiz eksik bırakılmaz.

    **ψ:** ham değer −1'in altına inebilir (çekme baskın eğilme, T.A.3.4.1
    durum 3) ve Kσ bunu kendi dalıyla karşılar; νv ve etkileşim bağıntısı için
    ψ [−1, +1] aralığına kelepçelenir (md. 3.4). σ1 mutlak değere göre DEĞİL,
    **basınç yönüne göre** seçilir — mutlak değerle sıralamak çekme baskın
    panellerde kontrolü sessizce düşürür.

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

## Dokunmatik ve dar ekran ilkeleri

Uygulama atölyede ve sahada telefondan/tabletten de açılır. Aşağıdakiler
tek tek düzeltme değil, **her yeni ekranda uyulacak kurallardır**.

1. **Dokunma hedefi kırılımla değil `pointer-coarse:` ile büyür — ve KUTUYU
   BÜYÜTEREK değil `.oc-tap` ile.** Dar pencere ≠ dokunmatik; 1280px'lik bir
   tablet de parmakla kullanılır, 500px'e daraltılmış bir masaüstü penceresi de
   fareyle. Sorulacak soru "işaretleme aygıtı kaba mı"dır.

   Pay eskiden öğenin kendisini büyütüyordu (`pointer-coarse:h-10`): 32px'lik
   bir düğme telefonda 40px oluyordu. Hedef doğruydu ama görsel yoğunluk ile
   dokunma güvenilirliği AYNI ŞEY DEĞİL — atölyede telefondan bakınca ekran
   düğme duvarına dönüyordu. `globals.css`teki **`.oc-tap` / `.oc-tap-square`**
   görünmez bir `::after` katmanıyla hedefi **44px**'e tamamlar, kutu kendi
   boyunda kalır. Taban böylece gevşemez, 40px'ten 44px'e ÇIKAR.

   `Button` boyları, `SelectTrigger` ve elle yazılmış tıklanabilir öğeler
   (ham `<button>`, çip, rozet-düğme, ikon bağlantısı) bu sınıfı taşır.
   Menü/liste SATIRLARI (`SelectItem`, `DropdownMenuItem`, `CommandItem`)
   istisnadır: orada yükseklik zaten liste ritmidir, `pointer-coarse:py-*` ile
   büyümeye devam eder. Çağrı yerinde `h-8`/`h-7` gibi elle yükseklik YAZILMAZ —
   boy varyantın kendisinden gelir.

2. **Girdi yazısı dokunmatikte 16px'tir** (`text-base pointer-fine:text-sm`).
   iOS Safari 16px'ten küçük yazılı alana odaklanınca sayfayı KENDİLİĞİNDEN
   yakınlaştırır ve geri çıkmaz. Eski kural `md:text-sm` idi ve iPad portre
   (768px) tam o eşiğe düştüğü için tablette sorunu geri getiriyordu.
   **Bir çağrı yeri yazı boyutunu ezerse dokunmatik payını korumalıdır:**
   `text-xs` DEĞİL, `text-base pointer-fine:text-xs`.

3. **Yükseklik birimi `dvh`dir, `vh` değil.** Mobil tarayıcıda `vh` adres
   çubuğu gizliyken ölçülen BÜYÜK görünür alandır; `100vh` bir kutuyu her
   zaman ekranın altına taşırır ve `min-h-screen` kısa sayfalarda "hayalet
   kaydırma" üretir.

4. **Pencere yüksekliği görünür alana kelepçelidir.** `DialogContent` tabanı
   `max-h-[calc(100dvh-1.5rem)] overflow-y-auto` taşır. Bu olmadan `fixed` +
   `-translate-y-1/2` ile ortalanan uzun bir form hem üstten hem alttan
   ekranın dışında kalır ve KAYDIRILAMAZ — yani ilk alana da Kaydet düğmesine
   de erişilemez. Çağrı yerlerinde tekrar etme.

5. **`min-width`, `max-width`i yener.** Açılır kutulara verilen sabit
   `min-w-[26rem]` gibi değerler taban `max-w` kelepçesini delip ekranı
   taşırır. Kalıp: `min-w-[min(26rem,calc(100vw-1.5rem))]`.

6. **Geniş pencere tablette kenar boşluğu bırakır.** `sm:max-w-3xl` (768px)
   tam olarak tablet genişliğidir ve pencereyi ekranın tamamı yapar; kullanıcı
   pencerede mi sayfada mı olduğunu ayırt edemez. Kalıp:
   `sm:max-w-[min(48rem,calc(100%-2rem))]`.

7. **Tabloda sütun önceliklendirilir, kart markup'ı ÇOĞALTILMAZ.**
   `TableHead`/`TableCell` varsayılanı `whitespace-nowrap`tır; 8–10 sütunlu bir
   liste telefonda ekranın 2–4 katına çıkar. Düşük öncelikli sütunlara **hem
   `th` hem `td` üzerinde** `hidden md:table-cell` verilir, gizlenen bilgiden
   kritik olanı birincil hücrenin içinde `md:hidden` ikinci satır olur. İkinci
   bir kart markup'ı yazmak sıralama/seçim mantığını ikiye böler ve zamanla
   ayrışır.

8. **Yatay kaydırma varsa GÖRÜNMELİDİR.** Mobil tarayıcı kaydırma çubuğu
   çizmez; kullanıcı sağda sütun olduğunu bilmez. `globals.css`teki
   `.oc-scrollx` yardımcısı `background-attachment: local/scroll` ikilisiyle
   yalnız o yönde içerik varken kenar gölgesi gösterir, sona gelince söner
   (JS yok). Zemin rengi `--oc-scroll-bg` ile verilir, varsayılanı `--card`.

9. **Diyagram küçülmez, kaydırılır.** `DiagramSvg` `minWidth = diagram.width`
   taşır. Ölçü yazıları 7–9,5 tuval biriminde çizilir: 700 birimlik bir
   diyagram telefon sütununa sığdırılınca kot ~3,9 px'e iner ve bu resimler
   PDF'e giden modelin ta kendisidir — mühendis ekranda gördüğünü doğrulayamaz.

10. **Kart iç boşluğu telefonda bir kademe kısılır** (`--card-spacing`
    16px → ≥640px'te 24px). 375px'lik ekranda 48px'lik yatay dolgu içeriğin
    %14'ünü yiyordu.

11. **İçerik metninde 11px altına inilmez.** `text-[9px]`/`text-[10px]` yalnız
    salt dekoratif işaretlerde kabul edilebilir; sayısal rozetler ve etiketler
    en az `text-[11px]`dir.

12. **Sayfa eylemleri `lg` altında KENDİ SATIRINDADIR.** Üst şeride
    `shrink-0` bir eylem kümesi konmaz: küçülemeyen bir kutu 375px'lik ekranı
    kaçınılmaz olarak taşırır ve `position: sticky` YALNIZ DİKEY sabitlediği
    için sağa kaydırınca şeridin zemin bandı geride kalır — kullanıcının
    gördüğü şey "üst bar kayıyor"dur. Eylemler bu yüzden ayrı bir portal
    yuvasındadır (`APP_ACTIONS_SLOT_ID`): dar ekranda ikinci satıra iner ve
    `.oc-scrollx` ile yatay kayar, `lg` üstünde şeridin sağ ucuna döner. İki
    yuva da **tek** DOM örneğidir — aynı düğümleri iki yere portallamak
    `EDITOR_STATUS_SLOT_ID` gibi `getElementById` hedeflerini ikizler.

    Yuva `empty:hidden` taşır: eylemi olmayan sayfada satır hiç çizilmez.
    Bunun bir koşulu var — `:empty` `display:none` bir çocuğu da ÇOCUK sayar,
    yani yuvaya `hidden lg:inline` bir öğe konursa telefonda boş bir bant
    kalır. Bilgi rozetleri (yetki künyesi gibi) eylem değildir, sayfa gövdesine
    yazılır.

    Şeridin gerçek yüksekliği `--app-header-h`dedir (`AppShell` ölçer). Sabit
    48px varsayan hiçbir tüketici yazılmaz; `Toaster` payı bu değişkeni okur ve
    `mobileOffset` TEK BAŞINA yetmez — sonner'ın mobil kuralı
    `@media (max-width: 600px)` içindedir, 601–1023px'te `offset` geçerlidir.

13. **1280px altında her derin sayfa `backHref` verir.** Kırıntı yolu
    (`PageHeader.kicker`) yalnız `xl:inline`dir; altında geri oku onun yerini
    tutar, yoksa kullanıcıda hiçbir "yukarı" bağlantısı kalmaz. Sayfa kendi
    kırıntı satırını da çiziyorsa o satır `xl` altında gizlenir (ikisi
    yinelenmesin).

    **Bir ekranda YALNIZ BİR `PageHeader` olur.** İkisi aynı yuvaya yazar ve
    ikisi birden çizilir — iç içe düzenlerde başlığı yalnız tek bir katman
    basar. Sayfanın kendi büyük başlığı `h2`dir; `h1` üst şerittedir.

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

## Belge kimliği ve dosya adı

Marka altyapısı `pdf/brand.tsx`tedir ve TÜM belgeler onu paylaşır:

- **`BrandBand`** — ilk sayfanın üst bandı: solda lockup logo, sağda doküman
  kodu + revizyon/tarih, altında kömür kural. Müşteriye TESLİM EDİLEN her
  belgenin ilk sayfası markayı taşır; kırmızı omurga ve folio tek başına
  logonun yerini tutmaz. Hesap raporu kapağı ile ekipman listesinin ilk sayfası
  aynı bileşeni kullanır, ikisi aynı yüksekliğe oturur.
- **`CompanyBlock`** — sayfa dibindeki firma künyesi, folio satırının ÜSTÜNDE.
  İki sütundur: solda KİMLİK (firma adı gövde ailesinde + adres), sağda
  İLETİŞİM. Üç satır alt alta mono gri metin okunmuyordu — firma adı adresten
  ayrışmıyor, iletişim adresin devamı gibi duruyordu.

**Dosya adı tek yerdedir: `pdf/doc-naming.ts`.** Firma kuralı
**İŞ ADI - DOKÜMAN KODU - VERSİYON**, tamamı BÜYÜK HARF, sonda belgenin
türü/seviyesi:

    AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-HR-0055-R01 - V1 - DETAYLI.pdf
    AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-EQ-0055-R01 - V1 - EKİPMAN LİSTESİ - DETAYLI.pdf
    MUHTELİF VİNÇLER - 0075 - FR.11.02 - İŞ EMRİ.pdf

Büyük harf `tr-TR` ile yapılır (`toUpperCase()` "i"yi "I" yapar). Doküman kodu
`docCode(kind, docNo, revNo)` ile üretilir ve PDF'in kendi künyesiyle AYNI
fonksiyondan gelir — dosya adı ile belgenin içi ayrışamaz.

## Birimler

Motor içi birimler kg, kg/cm², kg·cm, cm, mm, kN, kNm, Nm, kW, m/dak, d/dak.
**Sunum katmanı gerilmeleri MPa, momentleri Nm olarak gösterir** (`lib/units.ts`,
etiket bazlı dönüşüm). Rapor ve arayüzde kg/cm² görünmez.

## Dizin haritası

- `src/lib/calc/` — hesap motoru (saf): `engine.ts`, `modules/`, `beam.ts`,
  `shaftStress.ts`, `reeving.ts`, `derive.ts`, `hook-table.ts`, `coefficients.ts`,
  `plate-buckling.ts`, `tables.ts`, `types.ts`
- `src/lib/calc/modules/` — kaldırma, kanca bloğu, yürütme, **teker yükleri**
  (`wheelLoads.ts` — yol kirişine aktarılan kuvvetler), ana kiriş, buruşma,
  başkiriş, kabin ve elektrik odası (`cabin.ts`)
- `src/lib/calc/climate-load.ts` — mahal iklimlendirme yükü çekirdeği
  (psikrometri + zarf ısı geçişi + güneş-hava sıcaklığı)
- `src/lib/calc/drive-losses.ts` — ABB ACS880 sürücü atık ısısı tablosu
- `src/lib/calc/presentation/` — sunum tanımları: bölümler, alan metadata'sı,
  kontrol bağlantıları, modül erişimi
- `src/lib/standards/` — standart kayıt defteri (tablolar + bağıntılar)
- `src/lib/roles.ts` — kullanıcı rolleri ve yetki soruları (`canSeeSales` vb.)
- `src/lib/currency.ts` — para birimleri, tr-TR sayı okuma/biçimleme
- `src/lib/tags.ts` + `src/components/tags.tsx` — pastel etiket dili (müşteri
  kısaltması/rengi, satış kapsamı); renk TANIMI `globals.css` `.oc-tag`
- `src/lib/use-stored-flag.ts` — tarayıcıda kalıcı aç/kapa tercihi
  (`useSyncExternalStore`; ilk boyamada doğru genişlik, hidrasyon uyumlu)
- `src/app/(app)/sales/` — Satış Takibi (Yönetici + Müdür)
- `src/app/(app)/worklog/` — İş Takibi (Yönetici + Müdür): günlük giriş ·
  `analysis/` grafik panosu · `records/` kayıt listesi · `export/` Excel ucu ·
  `filters.ts` üç ekranın ortak süzgeç tanımı
- `src/lib/drawings/` — Teknik Resimler ÇEKİRDEĞİ, **saf** (DB/HTTP yok):
  `recognize` · `folder-name` · `file-name` · `part-code` · `tr-text` ·
  `excel` · `reconcile` · `titleblock` · `dxf-header` · `derive` · `diff` ·
  `revision` · `progress` · `types` · `labels` · `mime` · `standard`
- `src/app/(app)/drawings/` — paket listesi, yükleme sihirbazı, montaj ağacı,
  dosya gezgini, parça defteri, içe aktarım raporu, sürümler, üretim durumu,
  aşama defteri; `[id]/import/` içerik okuma ucu (Node çalışma zamanı),
  `[id]/export/` türev çıktılar
- `docs/teknik-resim-adlandirma-onerileri.md` — ressama ÖNERİLER (Ö-1…Ö-9).
  Kural listesi DEĞİL kazanç listesidir; hiçbir madde bir yüklemeyi engellemez
  ve `lib/drawings/standard.ts` ile iki yönlü koruma testine bağlıdır
- `src/lib/work-log.ts` — İş Takibi sözlüğü + saf toplama/pivot/dönem çekirdeği
- `src/components/charts.tsx` — pano grafikleri (zaman serisi, sıralı çubuk,
  halka, ısı haritası, özet kartı); `lib/diagrams` ile KARIŞTIRILMAZ
- `src/components/combobox.tsx` — aranabilir tek seçimli liste (Türkçe süzgeç)
- `src/app/(app)/admin/customers/` — müşteri defteri yönetimi (kısaltma + renk)
- `src/app/(app)/katalog/` — katalog sayfası görüntüleyici; ekipman listesi,
  Excel ve PDF ekipman ADINDAN buraya bağlanır
- `src/app/dev/*-preview/` — auth'suz görsel önizleme sayfaları (yalnız
  development; production'da 404): kabuk, editör, işler, satış, ekipman listesi,
  **iş takibi** (`/dev/worklog-preview` — üç ekranı sahte veriyle üst üste basar)
- `src/lib/diagrams/` — parametrik teknik resimler (saf veri modeli; web + PDF ortak)
- `src/lib/pdf/`, `src/lib/excel/` — rapor, ekipman listesi ve iş takibi çıktıları
- `catalog-sheets/` — üretici katalog sayfalarının kesilmiş görüntüleri
  (üretilir; `public/` altında değildir, `/api/catalog-sheet/` ucundan sunulur)
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
