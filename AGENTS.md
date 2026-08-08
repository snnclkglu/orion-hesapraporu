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
- `npx tsx scripts/test-safety-brake-diagram.tsx` — emniyet freni şemasını altı
  yerleşim düzeninde SVG olarak üret (kaliper konumları + yazı çakışması)
- `python scripts/catalog-sheets.py [--verify] [--only <tür>]` — katalog
  sayfalarını kaynak PDF'lerden kes; `--verify` yalnız haritayı sınar
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

    **Kapsam sınırı:** bu bir ÖN BOYUTLANDIRMA ve KONTROLdür. Kapasite
    kontrolü gerçektir (hesaplanan yük ≤ katalog soğutma kapasitesi, üretici /
    engelleyici) ama nihai kapasite üreticinin proje bazlı teyidine tabidir.
    Tarihsel karşılaştırma `__tests__/climate-load.test.ts` sonundadır: TMS'in
    Erdemir E-House raporuna karşı iletim %1, hesaplanan yük %1 sapar; toplam
    %3,6 sapar (emniyet katsayısı %10 yerine %15) ve ışınım kalemi bilinçli
    olarak boştur.

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

    **Sayfa MARKA + MODEL ile bulunur; bölümün o kimliği SAKLIYOR olması
    gerekir.** Redüktör (2.3 / 5.5), yürütme freni (5.5b) ve tampon (5.8)
    eşlemelerinde kimlik tek bir birleşik `brand_model` alanındadır;
    `catalogIdentityFields` bunu `combinedField` olarak verir ve defter marka
    önekini kendisi ayıklar. Motor eşlemesinde ise MODEL alanı hiç yoktu —
    `motorModel` bu yüzden eklendi. Bu bağ koptuğunda hiçbir test kırılmaz,
    düğme sessizce pasif kalır: koruma `__tests__/catalog-sheets.test.ts`tedir.

    Kapsam: kaplin · rulman · rulman yatağı · fren · tampon · redüktör
    (Yılmaz + FLENDER) · motor · feston (Vasel + Conductix-Wampfler).
    Halat, kanca, makara, teker ve ray kataloglarının kaynak PDF'i workspace'te
    olmadığı için deftere giremez; TMS klima kataloğu ise yalnız web
    sayfalarından derlenmiştir. Feston kataloğunda süzgeç SERİ LİSTESİ yerine
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

    **Müşteri defteri** (`customers`) iş emrinden ayrıdır: iş emrindeki
    `customer_*` metin alanları basıldığı andaki bilginin FOTOĞRAFIDIR, defter
    sonradan güncellenince yayınlanmış iş emri değişmez.

    **İş durumu** `job_status` enum'udur (aktif · pasif · tamamlandı · arşiv);
    `projects.status` ile karıştırılmaz, etiket/renk `lib/job-status.ts`tedir.

15. **Roller yetki SORUSUYLA sorulur, listeyle değil.** `user_role` dört değer
    taşır: `admin` (Yönetici) · `manager` (Müdür) · `engineer` (Mühendis) ·
    `draftsman` (Teknik Ressam). Kod hiçbir yerde rol listesi karşılaştırmaz;
    `lib/roles.ts`teki `isAdminRole` / `canSeeSales` sorulur. Roller HİYERARŞİ
    DEĞİLDİR — müdür satış rakamlarını görür ama yönetim paneline giremez.
    Veritabanı karşılığı `is_admin()` ve `can_see_sales()` fonksiyonlarıdır;
    menüden gizlemek yalnız görgü kuralıdır, asıl engel RLS'tir.

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
- `src/app/(app)/sales/` — Satış Takibi (Yönetici + Müdür)
- `src/lib/diagrams/` — parametrik teknik resimler (saf veri modeli; web + PDF ortak)
- `src/lib/pdf/`, `src/lib/excel/` — rapor ve ekipman listesi çıktıları
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
