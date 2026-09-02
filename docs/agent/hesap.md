# Hesap motoru ve modüller

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/hesap.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/calc/**` · `src/lib/standards/**` · `src/lib/diagrams/**` · `src/lib/revision-*.ts` · `src/lib/crane-types.ts` · `src/app/(app)/projects/**`

## HESAP-1 — Hesap motoru saftır.

`src/lib/calc/` altında DB/UI bağımlılığı olmayan
saf TS fonksiyonları. `CalcInput` → `CalcResult`. Motor `ENGINE_VERSION` ile
etiketlenir; her revizyon hangi sürümle hesaplandığını saklar.

## HESAP-2 — 4 değer rolü.

`input` (kullanıcı girer) → `computed` (hesaplanır) →
`selection` (mühendis katalogdan seçer) → `check` (kontrol). Arayüz bu
döngüyü yansıtır: girdiler talebi üretir, mühendis seçer, kontroller ✓/✗.

## HESAP-3 — Semantik anahtarlar.

`ModuleResult.cells` haritasının anahtarı
`<blok>.<büyüklük>` biçimindedir — tam 2 segment, İngilizce lowerCamelCase:
`rope.load`, `drum.minDia`, `drumShaft.reactionGearbox`, `gearbox.requiredTorque`,
`fatigue.combined`, `deflection.ratio`. Modül öneki anahtara konmaz (harita
zaten modül başınadır). Anahtar asla `L19` gibi tablo adresi biçiminde olmaz.
Araba ve köprü **aynı** anahtarları kullanır; varyanta özel satırlar sunum
tarafında `variant` ile işaretlenir.

Motor seçimindeki `motorBrakeType` ortak seçenek listesi `MOTOR_BRAKE_OPTIONS`
üzerinden gelir: `Frensiz`, `Frenli 380 VAC`, `Frenli 220 VAC` ve
`Frenli 24 VDC`. Frenli seçimlerde bobin gerilimi ekipman sipariş metnine kayıpsız
taşınır; eski revizyonlardaki `Kendinden Frenli` değeri geriye dönük okunur.

## HESAP-4 — Kontrol tipolojisi.

Her kontrol dayanağını ve ağırlığını taşır:
- `kind`: `"standart"` (FEM/DIN/CMAA maddesi şart koşuyor) · `"uretici"`
  (katalog kriteri) · `"firma"` (tasarım kabulü) · `"bilgi"` (bilgilendirme)
- `severity`: `"engelleyici"` (sağlanmadan yayınlanmamalı) · `"uyari"`
Yardımcılar `types.ts`te: `checkKind`, `checkSeverity`, `isBlocking`,
`blockingFailures`. Varsayılan en muhafazakâr olandır (standart/engelleyici).

## HESAP-5 — Ortak hesap kütüphaneleri

— aynı fizik iki kez yazılmaz:
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
- `hook-standards.ts` — KANCA TANIMI (15401/15402/15407/15408), DIN 15407
  Tablo 1 ana ölçüleri ve tanım metninin kurulması (md. 8e)
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

## HESAP-11 — Teker yükleri yol kirişinin girdisidir.

Bölümün ÜSTÜ köprü yürütmedir (`MODULE_PARENT.wheelLoads = "bridge"`):
girdilerinin neredeyse tamamı oradan gelir ve köprü kapalıyken hiç
hesaplanmaz — açık bırakılsaydı rapora sonucu olmayan bir bölüm basılırdı
(bkz. HESAP-8f).

`wheelLoads.ts` bir mekanizma
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

**6.2 yeni iş otomatikleri:** kaldırma tahrik sınıfı `HD3`, teker çifti
düzeni bağımsız sabit/sabit `IFF` ve bağlı teker çifti adedi `p = 0` başlar.
Kaldırma sınıfı ana kaldırma mekanizma sınıfından türetilir: M1–M5 → HC1,
M6 → HC2, M7 → HC3, M8 → HC4. Sürünme hızı ana kaldırma hızının %10'udur.
Tek taraf kılavuz boşluğu köprü teker çapından kademeli gelir: ≤200 → 5 mm,
≤315 → 7,5 mm, ≤630 → 10 mm, ≤800 → 12,5 mm, üstü → 15 mm. Bu üç
türetilen alan (`hoistingClass`, `creepSpeedMpm`, `guideClearanceMm`) otomatik
açılır; anahtar kapatıldığında kullanıcı değeri korunur. Yeni `*Auto`
anahtarları `revision-load.ts/AUTO_FLAGS` içindedir; eski revizyonun elle
girilmiş değerini şablon sessizce ezmez.

**Sapma (belgelenmiş):** µ' (yakın rayın yük payı) araba kolundan değil
DÜŞEY TEKER YÜKLERİNDEN türetilir — köprünün kendi ağırlığı iki raya eşit
dağıldığından (l−e)/l yük payına eşit değildir. Gerekçe modül başlığında.

## HESAP-15 — Feston bir katalog ürünüdür, teknik özellik değil.

I-kiriş kablo
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

## HESAP-16 — Kabin ve elektrik odası kendi bölümüdür (11.x).

Teknik özelliklerde
yalnız VARLIK sorulur: kabin var mı, elektrik nerede duruyor (oda / pano),
o mahalde klima var mı. Ölçüler, izolasyon, KAPI ADEDİ, pano adedi ve
kurulu yedek düzeni modül girdisidir; klimanın kendisi TMS kataloğundan
seçilen bir üründür (`kind = "air_conditioner"`) — katalogdan seçim yalnız
hesap bölümlerinde yapılabildiği için bölüm ZORUNLUDUR. Eski revizyonların
`specs` altındaki ölçüleri `migrateCabin` ile taşınır; iklimlendirme SINIFI
("industrial" …) artık sorulmaz, "none" dışındaki her eski değer "klima
var" okunur.

## HESAP-17 — Mahal iklimlendirme yükü hesaplanır — `climate-load.ts`.

Çekirdek
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

## HESAP-5b — ALAN ÖBEKLERİ — girdi ızgarası kesitin parçalarına göre ayrılır.

`FieldDef.fieldGroup` taşıyan bölümler (ana kiriş 7.1) öbek öbek çizilir:
Ray · Üst Başlık · Ray Altı T Profil · Gövde · Alt Başlık · Geometri, sıra
RESMİN sırasıdır. Her öbeğin bir TON AÇISI vardır (`lib/calc/field-groups.ts`)
ve **aynı ton kesit çiziminde de kullanılır** — formdaki mavi öbekle
resimdeki mavi etiket aynı sacı gösterir. Ton VERİDEN, doygunluk/parlaklık
`globals.css` `.oc-fieldgroup` kuralından ve tema başına (`.oc-tag` ile aynı
sözleşme). Renk TEK TAŞIYICI DEĞİLDİR: öbek adı yazıyla da durur ve
etiketler SEMBOLLE BAŞLAR (`t2 · Üst İç Flanş Kalınlığı`) — sol kenarda
taranabilir bir sembol sütunu oluşur.

`FieldDef.visibleWhen(inputs)` `visible(specs)`ten AYRIDIR: o teknik
özellikleri okur, bu MODÜLÜN KENDİ girdilerini. Bir anahtarın açtığı
alanlarda kullanılır ve gizlenen alanın DEĞERİ KORUNUR.

## HESAP-6 — Standart referansları tıklanabilir.

`standards/registry.ts` FEM/DIN/CMAA
maddelerini tablo + bağıntı + açıklama olarak tutar; hesap satırındaki
`standard` alanı bu deftere çözülür ve arayüzde pop-up açar. Yeni bir
`standard: "..."` yazarsan deftere de ekle (aksi hâlde rozet ölü kalır).

## HESAP-7 — Revizyon = snapshot.

`revisions` tablosunda inputs/selections/results
JSONB. `draft` düzenlenebilir, `issued` kilitli (DB trigger). Kapatılan hesap
bölümleri `inputs.disabledModules` listesinde tutulur; girdileri korunur.
Motora yeni girdi eklendiğinde eski revizyonlar `revision-load.ts`teki
`withDefaults` sayesinde bozulmaz.

**ALT BÖLÜM GİZLENEBİLİR** (`inputs.hiddenSections`, kullanıcı kararı
16.08.2026: *"bazı vinçlerde bazı özellikler olmuyor veya müşteriye
göstermek istemiyorum"* — ör. araba yürütmede teker–redüktör kaplini yoksa
5.7 gizlenir). Anahtar `sectionHideKeyFor` iledir (`"trolley-5.7"` — not ve
alternatif anahtarlarıyla AYNI uzay, HAM bölüm id'si; köprüde görünen 6.8
değil 5.7). Kutucuk bölüm BAŞLIĞINDADIR; `disabledModules`tan farkı:
gizlenen bölüm HESABA GİRMEYE DEVAM EDER (motor bölüm sınırı bilmez), yalnız
sunumdan düşer — editör soluk gösterir, PDF raporu (bölüm + "Ana Ekipman
Seçimleri" + Kontrol Özeti), editör özet panosu/durum şeridi ve ekipman
listesi (ekran + Excel + PDF, alternatif satırlar dâhil) onu taşımaz.
Kontrol süzgeci `hiddenSectionCheckIds`tadır (module-adapters.ts) ve bölümün
kendi `checkSuffixes` bildiriminden çıkar; ekipman bağı ise bölüm tanımının
`equipmentSlugs` bildirimindedir (`*Sections.ts`) ve İKİ YÖNLÜ koruma
testine bağlıdır (`hidden-sections-equipment.test.ts`: bildirilen her slug
gerçekten üretilir + üretilen her satırın sahibi vardır — yeni ekipman
satırı eklerken bölümüne `equipmentSlugs` da eklenir). Gizleme kararı
revizyon karşılaştırmasında kendi satırıyla görünür (`revision-diff.ts`,
"Gizlenen Alt Bölümler").

**BÖLÜM NUMARASI BİR AD DEĞİL BİR SIRADIR — ÖNCEKİ KARAR TERSİNE ÇEVRİLDİ**
(`sectionDisplayNumbers`, module-adapters.ts; kullanıcı bildirimi
16.08.2026: *"bölümü gizlediğinde o numara gizleniyor, 3.6'dan devam
ediyor. Bu iyi değil, çünkü hesap raporu PDF'de arada eksik var
hissettirir."*). Eski kural "numaralar gizlemede YENİDEN DİZİLMEZ; kararlı
numara, atlanmış numaradan iyidir" idi ve yanlış tarafı seçiyordu: kararlı
numaranın okuyucusu YOKTUR — müşteriye giden PDF'te 3.5'ten 3.7'ye atlayan
bir dizi, olmayan bir bölümün eksik basıldığını söyler. Numara artık
RAPORDAKİ SIRADIR; rapordan düşen her bölüm kendinden sonrakileri bir öne
çeker. Üç sonucu vardır:
· **KOŞULLU BÖLÜM DE BOŞLUK BIRAKMAZ** (`visible(specs)` — tamponsuz
  arabada 5.8 yok, feston onun yerine geçer). Gizleme ile koşul aynı
  kapıdan geçer: ikisi de "bu bölüm basılmıyor" der.
· **HARF SONEKİ DÜŞER**: `5.5b` (köprü yürütme freni) ham id olarak KALIR —
  not, gizleme, alternatif ve çapa uzayları hep onunla çalışır — ama basılan
  numara sıradan bir sayıdır (6.6) ve sonrası kayar. Sonek bölümün sonradan
  araya girdiğini söyler; bu bir iç kayıttır, müşterinin okuduğu belgede
  yaması görünmemelidir.
· **YAYINLANMIŞ BİR REVİZYON YENİDEN BASILIRSA numaraları değişebilir.**
  Bedel açıkça kabul edildi: numara zaten snapshot'ta saklanmaz, mevcut
  modüllerden TÜRETİLİR (`moduleDisplayNumbers` ile aynı ruhta).
Numara ile SÜZGEÇ TEK YÜKLEMDEN okur (`sectionPrinted`, report.tsx): ayrı
yazılsalardı gizlenen bölüm süzülür ama numarasını harcamaya devam ederdi.
Editör gizli bölümü listede TUTAR (soluk, düzenlenebilir) ama numara yerine
TİRE basar (`HIDDEN_SECTION_NO`) — uydurma bir numara, ekrandaki diziyi
PDF'tekinden ayırırdı. Koruma `hidden-sections.test.ts`tedir ve son madde
bütün modülleri tarar: numara yinelenmez, üst düzey dizi 1'den başlayıp
birer birer artar.

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
- Bölüm rayı SOL KENARDA İNCE BİR ŞERİTTİR ve dokununca tabaka olarak açılır
  (MOBIL-29, HESAP-36). Eski dar/geniş kip ve `orion.editor.nav.collapsed`
  anahtarı 01.09.2026'da KALDIRILDI — ray artık her genişlikte varsayılan
  kapalıdır, o yüzden kalıcı bir tercihe de gerek kalmadı.
- **"Dar ray" ile "sol menü" KARIŞTIRILMAZ**: aşağıdaki 4,5 rem KABUĞUN sol
  menüsüdür (`SIDEBAR_W_COLLAPSED`, app-shell.tsx). Bölüm rayının genişliği
  1 rem'dir ve MOBIL-29'dadır.
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

## HESAP-8 — Vinç topolojisi.

Bir vinçte 1–4 kaldırma grubu olabilir: ana, yardımcı ve
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
disabled)` belirler ve ÜÇ KAPIYI TEK DÖNGÜDE uygular: kullanıcının
kapattıkları + vinç konfigürasyonunun izin verdikleri (`moduleAllowedByConfig`,
artık o da çekirdektedir) + ÜST bölümü açık olanlar (`MODULE_PARENT`). Zincir
`MODULE_ORDER` sırasında çözülür — üst bölüm alt bölümden önce gelir, tek geçiş
yeter. Eskiden elle yazılmış bir if merdiveniydi ve yeni bir bağ eklemek
merdivenin ortasına dokunmayı gerektiriyordu.

**KAPATILAMAYAN İKİ BÖLÜM VARDIR: ana kaldırma ve ana araba**
(`REQUIRED_MODULE_KEYS`). Köprü yürütme bir süre üçüncüsüydü; kural
19.08.2026'da kaldırıldı (bkz. HESAP-8f). Kapatılabilenlerin listesi
`MODULE_ORDER` eksi bu ikisi olarak TÜRETİLİR (`DISABLEABLE_MODULE_KEYS`) ve
ÜÇ KAPI DA ONU OKUR: editördeki kutucuk ızgarası (`OPTIONAL_MODULE_KEYS`),
kayda giden liste ve kayıttan geri okuyan süzgeç (`DISABLEABLE_MODULES`,
revision-load). Üç ayrı elle yazılmış liste vardı ve AYRIŞMIŞTI — "Teker
Yükleri" kutucuğu ekranda kapanıyor, kayda yazılıyor, sayfa yenilenince
tanınmadığı için sessizce geri açılıyordu (aynı boşluk `girder2` ve `cabin`
için de vardı).

**ÜST BÖLÜM BAĞININ ÖLÇÜTÜ TEKTİR: bu bölümün hesabı üst bölüm olmadan
koşabiliyor mu?** Koşamıyorsa bağ `MODULE_PARENT`a yazılır, aksi hâlde bölüm
bağımsızdır. Ana kiriş ve teker yükleri KÖPRÜNÜN SONUCUNU okur
(`girderDepsFor` köprü teker adedi/hızı/ivmelenmesi olmadan `undefined` döner,
teker yükleri hiç hesaplanmaz), o yüzden ikisinin de üstü köprüdür. Başkiriş
ve buruşma BİLEREK bağsızdır: başkiriş yalnız ana kaldırma yükünü ve köprü
ağırlığını okur, buruşma ana kiriş kapalıyken elle girilen panel ölçüleriyle
koşar — çalışan bir hesabı kullanıcının elinden almak için sebep yok.

**"GİRDİSİ VAR AMA SONUCU YOK" BİR TUZAKTIR ve testle kapalıdır**
(`__tests__/trolley-only.test.ts` son maddesi bütün tekil kapatma
kombinasyonlarını tarar). PDF raporu bölüm numaralarını "bu bölüm basılıyor
mu" yüklemine göre dizer (`modulePrintedIn`, report.tsx): girdisi olup sonucu
olmayan bir bölüm numarayı HARCAR, içindekilerde satır açar ama sayfası
basılmaz — müşteri belgede atlanmış numara ve hiçbir yere gitmeyen bir dizin
satırı görür. Yüklem ayrıca BASILACAK EN AZ BİR ALT BÖLÜM ister; bütün alt
bölümleri gizlenmiş bir modül başlığı basılıp altı boş kalan bir sayfa
üretiyordu.

## HESAP-8f — VİNÇ ARABASI RAPORU: köprüsüz iş.

(Kullanıcı kararı, 19.08.2026: *"Bazen yeni vinç istemiyor müşteri sadece eski
vincin arabası değişiyor."*) Vinç tipi listesine `"Vinç Arabası"` eklendi
(`lib/crane-types.ts`). O raporda köprü yürütme, teker yükleri, ana kirişler,
buruşma ve başkiriş bölümleri YOKTUR; kapatılan bölüm hesaba, PDF raporuna ve
ekipman listesine girmez, girdileri korunur.

**TİP MOTORA GİRMEZ — BAĞ YALNIZ BİR KERELİK V0 TOHUMUDUR.** HESAP-8b'nin kuralı
yerinde: `runCalc`, `activeModules` ve `loadRevision` `crane_type`ı hiç
görmez. `createRevision` tipi YALNIZ V0 doğarken okur ve `inputs
.disabledModules` listesine `TROLLEY_ONLY_DISABLED_MODULES`u ÖNERİ olarak
yazar (`applyCraneTypeRevisionPreset`); karar o andan sonra revizyonun kendi
verisidir, mühendis ilk ekranda geri açabilir ve tip sonradan değişse bile
mevcut revizyonlar etkilenmez. Aynı kapı Yer Vinci'nin sabit yürütme düzenini
ve açık tek/çift kirişli tiplerin kiriş düzenini de V0'a önerir; motorun gördüğü
yine yalnız teknik snapshot'tır. Tipin söylemediği şablon alanları EZİLMEZ,
kapalı liste BİRLEŞTİRİLİR.

**TOHUMLANMIŞ REVİZYON "BOŞ" DEĞİLDİR.** `disabledSet` bir revizyonun henüz
kaydedilip kaydedilmediğini artık `Object.keys(inputs).length` ile değil, bir
MODÜL ALANININ varlığıyla ölçer. Eski ölçütle `{ disabledModules: [...] }`
taşıyan tohum, "alan yok → bölüm kapalı" eski-kayıt kuralını tetikler ve
kapatmak istemediği bölümleri de kapatırdı. O eski-kayıt kuralının kapsamı
(`ABSENCE_MEANS_DISABLED`) ayrıca DONDURULMUŞTUR: yeni kapatılabilir anahtarlar
oraya EKLENMEZ, yoksa o alanı taşımayan her eski revizyonda bölüm sessizce
kapanır ve yayınlanmış bir raporun bölüm numaraları kayardı.

**Editördeki "Hesap Bölümleri" ızgarası öbeklidir** (`MODULE_TOGGLE_GROUPS`):
kaldırma zinciri · yürütme · taşıyıcı yapı · mahaller. Kapatılamayan bölüm de
listede DURUR (işaretli ve kilitli) — olmayan bir kutu "bu bölüm nerede"
sorusunu doğuruyordu. Kısayol `BRIDGE_SIDE_MODULE_KEYS` ile köprü tarafının
altısını birlikte açar/kapatır ve kaldırma gruplarına DOKUNMAZ.

**Teknik özellik alanı da bölüme bağlanabilir ve bağ TEK YÜKLEMDEN okunur**
(`specFieldVisibleForModules`, fields.ts): alanın kendi `requiresModule`u,
ait olduğu GRUBUN bağı (Köprü Yürütme grubu → `bridge`) ve bir girdiyi
PAYLAŞAN bölümler (`requiresAnyModule`). Editör ve PDF ayrı yazıldıkları
sürece kapatılan köprünün alanları ekrandan düşüyor ama rapora basılmaya
devam ediyordu.

**Sızıntılar aritmetikten de kapatıldı:** özet sayfasındaki toplam ağırlık
BASILAN satırlardan türer ve köprü ağırlığı basılmıyorsa satırın adı da
"Vinç Toplam Ağırlığı" değil "Toplam Ağırlık"tır — aksi hâlde müşteri
"araba + kanca ≠ toplam" farkından basılmayan bir kalem olduğunu çıkarırdı.
Ekipman listesinde boş grup bandı hiç basılmaz ve elle eklenmiş bir satır
kapalı bölümün başlığını DİRİLTMEZ (satır "Ek Ekipman" altında durur;
`absentModuleGroupNames`).

## HESAP-8g — YER VİNCİ: sabit kaldırma, yürütme ve köprü YOK.

Kullanıcı kararı (28.08.2026): teklif hesap raporlarında `"Yer Vinci"`,
zemine/kaideye sabit bir kaldırma grubu olarak modellenir. Ana araba,
yardımcı/monoray araba ve köprü yürütmesi yoktur; dolayısıyla teker yükleri,
ana kiriş takımları, buruşma ve başkiriş de rapora/ekipman listesine girmez.
Kalan çekirdek ana kaldırma + kanca bloğudur; yardımcı kaldırma ayrıca
açılırsa kendi kaldırma/kanca zinciri çalışabilir ama yürütme bölümü açılmaz.

**TİP YİNE MOTORA GİRMEZ.** `applyCraneTypeRevisionPreset`, yalnız V0 doğarken
revizyonun `specs.travelArrangement = "fixed"` teknik topoloji kararını ve
`GROUND_CRANE_DISABLED_MODULES` kapalı yapı kapsamını yazar. Motor bütün
yürütme ailesini `moduleAllowedByConfig` içinde bu teknik snapshot'tan düşürür.
Alanı taşımayan eski revizyonlar `traveling` okunur; yayınlanmış hesapların
kapsamı değişmez. Vinç tipi sonradan düzenlenirse mevcut revizyon geriye dönük
yeniden şekillendirilmez.

**DOSYADAN OLUŞTURMA AYNI KAPIDAN GEÇER.** Bu akış `createRevision` çağırmadığı
için AI aktarım ayrıştırıcısı V0 tohumunu `runCalc`ten önce uygular. Yer Vinci
yazan bir dosya gezer köprülü örneğin yürütme girdilerini bıraksa dahi bu
girdiler korunur ama aktif hesaba, sonuç snapshot'ına, PDF'ye ve ekipman
listesine giremez.

## HESAP-12 — Buruşma ana kirişin bir kontrolüdür, bağımsız bir modül değil.

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

## HESAP-8b — Köprü TEK, İKİ ya da DÖRT kirişli olabilir.

`specs.girderArrangement`
(`tek` | `iki` | `dort`) gerçek teknik karardır:

- `tek`: bir ana kiriş vardır. Köprü öz ağırlığının, araba ağırlığının ve
  kaldırma yükünün tamamı bu kirişe gelir; hareketli yük iki kirişe bölünmez.
- `iki`: klasik çift kirişli düzendir. Tek ana kiriş hesap bölümü iki özdeş
  kirişten birini boyutlandırır; araba ve kaldırma yükü iki kirişe paylaştırılır.
- `dort`: iki ayrı ikişer kirişli takım vardır. **Ana Kiriş - 1 ANA kaldırmayı,
  Ana Kiriş - 2 YARDIMCI kaldırmayı taşır** (kullanıcı kararı, 15.08.2026 —
  şarj / döküm vinci). Hareketli yük dört kirişin tamamına değil, kendi
  takımındaki iki kirişe dağılır.

Alanı taşımayan eski revizyon `iki` okunur; yayınlanmış çift kirişli sonuçlar
değişmez. VİNÇ TİPİ (`projects.crane_type`) motora girmez ve mevcut revizyonu
geriye dönük şekillendirmez. Yalnız açıkça `Tek Kirişli Gezer Köprülü Vinç`
veya `Çift Kirişli Gezer Köprülü Vinç` seçilmiş yeni bir projenin V0'ı
doğarken `applyCraneTypeRevisionPreset` bu teknik alana sırasıyla `tek` / `iki`
önerir. Karar o andan sonra revizyon snapshot'ının kendisidir.

Hangi kirişin neyi taşıdığı MODÜLÜN İÇİNDE DEĞİL bağlayıcıda kurulur
(`engine.girderDepsFor`): `computeMainGirder` artık `specs.mainCapacityT` /
`mainLiftSpeedMpm` okumaz, taşıdığı yükü `deps.hoistLoadKg` ve
`deps.liftSpeedMpm` ile alır. Köprü öz ağırlığı `deps.girdersInBridge`e
(1 / 2 / 4), araba ve kaldırma yükü ise `deps.liveLoadGirderCount`a
(1 / 2 / takım başına 2) bölünür. 7.2 rapor satırları toplam yükü ve bir
kirişe düşen payı AYRI gösterir; formül metni sabit `/2` yazmaz. Kontrol
kimlikleri modül anahtarını taşır
(`${which}.stress.case1`), sunum tarafı ise AYNI aileyi paylaşır — bölüm
tanımları, kontrol bağlantı haritası ve 7.x şemalarının tamamı ikinci
takımda kendiliğinden çalışır. **Buruşma BİRİNCİ takımdan beslenir** ve
tektir; ikinci takımın buruşması bilinçli olarak kapsam dışıdır.

Başlıklar teknik özelliklere göre çözülür (`adapterTitle` /
`moduleLabelFor`): tek takımda sade "Ana Kiriş", dört kirişlide
"Ana Kiriş - 1" / "Ana Kiriş - 2".

Teker yükleri 10.3 üstten görünüşü de `girdersInBridge(specs)` değerini okur;
tek kirişli raporda iki ana kiriş çizip hesapla resmi çeliştirmez.

## HESAP-8c — Ana kirişte ray altına T PROFİL konur

(büyük tonajlı vinçler). Anahtar
`railTProfile = "Var"` dört ölçüyü açar; anahtar kapalıyken ölçüler
KORUNUR ama kesite girmez.

**PROFİL KİRİŞİN ÜSTÜNE OTURMAZ, ÜST BÖLÜMÜNÜN İÇİNE GİRER** (kullanıcı
düzeltmesi, 15.08.2026): T'nin üst sacı ana kirişin üst sacıyla AYNI
SEVİYEDEDİR. Üç sonuç — kullanıcının kendi cümlesiyle *"t1 iptal, t2
kısalır, h3 kısalır, diğerleri değişmez"*:
  · RAY ALTI SACI (t1/b1) İPTALDİR; rayı T'nin üst sacı taşır.
  · ÜST İÇ FLANŞ (b2) T'nin genişliği kadar KESİLİR — iki plaka aynı
    düzlemdedir, üst üste binmez. Kesilmiş plakanın ağırlık merkezi artık
    b2/2 DEĞİLDİR ve kendi ataleti b2³t2/12 değildir; ikisi de tam
    hesaplanır.
  · ANA GÖVDE SACI (t3) T'nin yan sacı kadar KISALIR: h3' = h3 + t2 − t_T − h_T.
    Dış yan sac (t4) TAM BOY kalır ve TOPLAM YÜKSEKLİK DEĞİŞMEZ.

TAM KESİT HESABINA girer (alan, Cz/Cy, Iyy/Izz, W, ağırlık, sehim);
burulmaya GİRMEZ (açık kesit, Bredt akışı kutunun çeperinden geçer). Ray
altındaki gövde hattının kesme alanı iki parçanın toplamıdır (T yan sacı +
kısalmış ana gövde).

**b2, T PROFİLİN SAĞ UCUNDAN BAŞLAR** — T'nin solunda b2 parçası YOKTUR
ve o yandaki en dış lif T flanşının kendisidir (flanş b2'nin nominal sol
kenarını geçebilir; `modulusZBottom` bu yüzden `Cy − y_dış,sol` ile bölünür).

**KAYAN NOKTA UYARISI:** T profil YOKKEN kesit ifadeleri harfi harfine
eski hâlinde bırakılmıştır (`tp.present` dallanmaları). Matematiksel olarak
aynı olan ayrıştırılmış biçim son bitleri kaydırır ve tarihsel
karşılaştırma testi bunu görür.

## HESAP-8d — Kaldırma kirişi x · y · z ölçü zinciriyle tanımlıdır

(§4.6). Açıklık
L = x + y + z TÜRETİLİR; kiriş iki uçtan askıda, iki noktadan yüklüdür ve
`beam.ts` ile çözülür. KESİT 1 açıklık ortası (eğilme tepe), KESİT 2 mesnet
ile yük arası (kesme tepe); ikisinin de gerilmeleri hesaplanır ve kontrol
edilen değer ZARFtır. Eski model (a, b) bunun simetrik hâliydi ve
`migrateLiftingBeam` ile taşınır — simetrik askıda sonuçlar BİREBİR aynıdır.
Alan adları `mid`/`thick` KALDI (yeniden adlandırmak kayıtlı sac ölçülerini
şablona düşürürdü); değişen yalnız ekrandaki addır. Yorulma AYRI bölümdedir
(§4.7). Üç şema: görünüş · moment diyagramı · iki kesit (AYNI ölçekte).

## HESAP-8e — KANCA TANIMI BİR SEÇİMDİR ve kapasitenin nereden okunacağını O belirler

(§4.1, `lib/calc/hook-standards.ts`; kullanıcı kararı 16.08.2026:
*"Kanca bölümünde kanca tanımını seçebileceğim bölüm istiyorum. DIN 15401,
DIN 15402 ve DIN 15407 Lamel Kanca seçenekleri olsun"* + *"Tek lamel mi çift
lamel mi bilgisi de gerekir, bazı vinçlerde çift lamel oluyor"*). Dört tanım,
ikişerli iki çift:

    DIN 15401  tek ağızlı dövme kanca   ┐ kapasite DIN 15400 Tablo 3'ten
    DIN 15402  çift ağızlı dövme kanca  ┘ (kanca no + mukavemet sınıfı + grup)
    DIN 15407  tek ağızlı LAMEL kanca   ┐ kapasite tablonun KENDİ satırında
    DIN 15408  çift ağızlı LAMEL kanca  ┘ ("Tragfähigkeit t")

**LAMEL KANCADA MUKAVEMET SINIFI SORULMAZ** ve mekanizma grubu kapasiteyi
DEĞİŞTİRMEZ: sac perçinli kancanın satırı doğrudan "bu boy şu tonu kaldırır"
der. Kutu bu yüzden gizlenir — `FieldDef.visibleWhen` artık SEÇİM
ızgarasında da geçerlidir (kaynak modülün KENDİ seçimleri) ve süzgeç PDF
raporunda da uygulanır; basılmayan bir kutu, seçilmemiş bir kutu değil O
BÖLÜMÜN SORUSU OLMAYAN bir kutudur. (Girdi ızgarasının PDF süzgeci
DEĞİŞMEDİ.)

**KANCA NUMARASI TEK ALANDIR, listesi tanıma göre değişir**
(`FieldDef.optionsFrom` — `optionsFor`dan ayrıdır, o teknik özellikleri
okur, bu alanın KENDİ kayıt nesnesini). Dövme kancada DIN 15400 numarası
("10"), lamel kancada standardın kendi adlandırması ("63x150" → "63 × 150").
İki ayrı kutu, biri her zaman boş duran bir ekran demekti.

**DIN 15407 ANAHTARI KAPASİTE + AĞIZ YARIÇAPIDIR.** Tabloda 25 · 40 · 63 ·
100 · 160 · 250 t'nin İKİŞER satırı var ve ikisi farklı a₁ ile farklı
kancalardır; standart da kancayı tam bu yüzden "Lamellenhaken DIN 15407 —
63 × 150" diye adlandırır. Yalnız tonajla anahtarlamak altı satırı sessizce
düşürürdü. **VİNÇ KAPASİTESİ KANCANINKİ DEĞİLDİR** — tablonun son sütunu
("Tragfähigkeit der zugeordneten Gießkrane") kancanın takıldığı döküm
vincinin kapasitesidir ve kancanınkinin (R10 serisine oturtulmuş) İKİ
KATIDIR: pota iki kancaya asılır. İkisini karıştırmak kancayı iki kat büyük
seçtirir.

**ÖLÇÜLEN SAPMA:** g₁, a₁ = 250 satırında standardın taranmış sayfası **550**
yazar, kullanıcının elindeki yeniden dizilmiş tabloda 560 görünüyor. Kaynak
standardın kendi baskısı esas alındı ("hesap yöntemi standartlara dayanır,
bir tabloya değil"); diğer 219 hücre iki kaynakta da aynıdır.

**DIN 15408 TABLOSU YOKTUR ve UYDURULMAZ.** Standart seçilebilir (mühendis
kancanın çift ağızlı olduğunu rapora yazabilir), fakat kapasite elle girilemez.
Tabloda satır bulunmadığında otomatik kapasite 0 kalır, seçim uygunluk vermez ve
`hook.capacitySource` satırı bunu açıkça yazar.

**KANCA TAM TANIMI TÜRETİLİR** (`hookDesignationText` + `hookDesignationAuto`,
yiv boyunun `drumGrooveLengthAuto` düzeninin aynısı: anahtar GİRDİLERDE,
değer SEÇİMLERDE). Üç kutunun (tanım · numara · sınıf) elle tutarlı
tutulması, birinin ötekilerle çelişmesinin en kısa yoluydu. Anahtar
`revision-load` AUTO_FLAGS listesindedir → eski revizyonlarda kapalı sayılır
ve teslim edilmiş bir raporun kanca tanımı değişmez. Katalog eşlemesi artık
`hookDesignation` YAZMAZ (yazsa bir sonraki türetme turunda zaten
eziliyordu — çalışmayan bir eşleme, çalışıyor gibi durur).

**MAKARA ÇAPI TAMBURLA AYNI STANDART SERİDEN SEÇİLİR** (§4.2, kullanıcı
kararı 16.08.2026) ve **%2'LİK BİR İNİŞ TOLERANSI vardır**
(`SHEAVE_DIA_TOLERANCE_PCT`, FİRMA kabulü). Gerekçe kullanıcının kendi
örneğidir: D_min = H · d = 1008 mm çıkar, seride 1000 var ve sonraki basamak
1100'dür — 8 mm (%0,79) için bir boy büyüğe geçmek makarayı, yatağını, kanca
bloğunu ve arabayı büyütür. Üç kelepçe:
· Kontrol TOLERANSLI sınırla karşılaştırır (`sheave.minDiaAccepted`) ve
  bağlantı o satırı gösterir — ekranda "1000 ≥ 1008 → UYGUN" gibi kendi
  kendiyle çelişen bir satır çıkmaz.
· **%2'yi AŞAN eksiklik hâlâ ENGELLEYİCİdir**; tolerans "bir boy küçüğe
  kaçmayı" değil yalnız SERİYE OTURMAYI mümkün kılar (bir boy atlama ~%9).
· Tolerans GERÇEKTEN kullanıldığında sapma kendi satırıyla yazılır
  (`sheave.diaShortfall`, yalnız o hâlde görünür — FEM sınırının üstünde
  seçilmiş bir makarada "eksiklik −%9" bir yanlış alarmdır, md. 18/3).
Liste yine bir ÖNERİDİR (`allowCustom`): ara bir çap elle yazılabilir.
**Tolerans TAMBUR çapına UYGULANMADI** — orada böyle bir istek yok ve bir
emniyet sınırını istenmeden gevşetmek bu dosyanın en pahalı hatası olurdu.

## HESAP-9 — Ağırlıklar teknik özelliktir.

Ana araba, yardımcı araba ve köprü
ağırlıkları `TechnicalSpecs`te tutulur; yürütme, ana kiriş ve başkiriş
hesapları oradan okur. Modül girdisi olarak ağırlık sorulmaz.

**KÖPRÜ AĞIRLIĞINI BEŞ BÖLÜM OKUR** (`BRIDGE_WEIGHT_READER_KEYS`: köprü
yürütme · teker yükleri · ana kiriş 1–2 · başkiriş) ve kutu ancak BEŞİ DE
kapalıyken gizlenir (`requiresAnyModule`). Yalnız köprü yürütmeye
bağlansaydı, köprüsü kapatılıp başkirişi açık bırakılmış bir raporda hesaba
GİREN bir sayı ekrandan kaybolurdu. Aynı küme ekipman listesindeki teknik
ressam özetinin "Köprü ağırlığı" satırına da karar verir — iki yerde iki liste
yazılsaydı biri kutuyu gizlerken öteki satırı basmaya devam ederdi.

## HESAP-10 — Otomatik girdiler.

`derive.ts` bir "girdi"nin başka verilerden
hesaplanabildiği yerleri toplar: halat ağırlığı (metre ağırlığı × kol ×
yükseklik), kanca bloğu ağırlığı (kapasitenin %10'u), motor sıcaklık
faktörü (ortam sıcaklığı üst sınırı). Her biri `*Auto` anahtarıyla açılıp
kapatılır; anahtar açıkken alan salt-okunurdur ve editör türetilen değeri
girdiye YAZAR (motor, PDF ve Excel aynı sayıyı görür). Halat donanımı
seçildiğinde tahrikli/toplam kol sayıları da aynı mekanizmayla dolar.
Makara verimi artık seçim değil sabit firma kabulüdür
(`STANDARD_SHEAVE_EFFICIENCY`).

Yiv boyu imal edilebilir tam yiv adediyle üretilir: kesirli gerekli yiv sayısı
yukarı yuvarlanır, sonra `L = ceil(z) · hatve` uygulanır. `drumGrooveSpanAuto`
açıkken bir helisin boyu C'ye ve çift heliste E'ye yazılır. Redüktör ve tambur
kaplini servis katsayıları da FEM mekanizma sınıfından sırasıyla
`gearboxServiceFactorAuto` ve `drumCouplingServiceFactorAuto` ile türetilir.

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


Motor içi birimler kg, kg/cm², kg·cm, cm, mm, kN, kNm, Nm, kW, m/dak, d/dak.
**Sunum katmanı gerilmeleri MPa, momentleri Nm olarak gösterir** (`lib/units.ts`,
etiket bazlı dönüşüm). Rapor ve arayüzde kg/cm² görünmez.

## HESAP-18 — Ekipman listesi sürümü hesap raporu sürümünden türetilir.

Kullanıcı kararı (20.08.2026): proje detayında **Ekipman Listeleri**, Hesap
Raporu sekmesinin hemen yanında kendi sürüm defterini taşır. Ayrı bir ekipman
revizyon zinciri kurulmaz; `Ekipman Vn` doğrudan `Hesap Vn` girdileri ve
seçimlerinden üretilir. Liste her satırda bu bağı görünür yazar ve hem ekipman
listesine hem bağlı hesap raporuna bağlantı verir.

Hesap raporu editöründeki mevcut Ekipman Listesi bağlantısı KALIR. Proje
detayındaki defter sürümler arasında gezinme ve ilişkinin denetimi içindir;
hesap raporu içindeki bağlantı ise çalışılan revizyondan hızlı geçiştir. Bir
hesap revizyonu silinirse ona ait türetilmiş ekipman satırı da ayrıca kayıt
silmeden kendiliğinden listeden düşer.

## HESAP-19 — Kaldırma seçimlerinde geometrik ve katalog uyumu birebirdir.

Kullanıcı kararı (20.08.2026): tambur rulmanı katalog iç çapı, tambur milinin
D2 yatak/rulman oturma çapıyla **birebir** eşleşir. Eksik veya farklı çap
`bearing.bore` engelleyici kontrolünü düşürür. Makara rulmanı iç çapı da kanca
bloğu milinin D1 çapıyla birebir eşleşir; fark `sheaveBearing.bore` uyarısıdır
ve katalog seçim yerinde görünür.

Kanca kapasitesi seçim alanı değildir. Kanca standardı + numarası + malzeme
sınıfı + mekanizma sınıfından her değişimde yeniden hesaplanır; teknik
özellikteki kaldırma kapasitesiyle yan yana karşılaştırılır. Standart tablosunda
satır yoksa kullanıcı kapasite uyduramaz ve seçim uygun sayılmaz.

Kanca bloğu sunum sırası **Makaralar → Kanca Bloğu Mili → Makara Rulmanları**dır.
Ham bölüm kimlikleri 4.4/4.3 olarak korunur; yalnız gösterim sırası değişir ki
kayıtlı alternatifler ve katalog eşlemeleri bozulmasın. Mil geometrisi
simetriktir: `shaftSupportOffsetMm` ve `shaftSheaveOffsetsText` merkezden yalnız
bir tarafı tarif eder, karşı taraf motor tarafından aynalanır. Eski A/B/D
snapshotları `migrateHookShaftCenter` ile aynı açıklık ve yük konumlarına göçer.

Redüktör kataloğunda hedef tahvil oranı, **hesaplanan gerekli tork alt sınırı**
uygulandıktan sonra değerlendirilir. Seçim penceresi gerekli torku ve gerekli
çevrim oranını açıkça gösterir; torku sağlayan ürünler içinden hedef orana en
yakın **10 ürün** karşılaştırmaya bırakılır. Tablo aynı anda en çok 50 satır
çizer ve daha uzun sonuçları sayfalara böler.

## HESAP-20 — Kanca bloğu ve yürütme seçimleri gerçek mil geometrisine bağlıdır.

Kullanıcı kararı (20.08.2026): kanca bloğu askı sacları makara dizisinin
dışında olmak zorunda değildir. Merkezden verilen askı sacı ve makara eksenleri
aynalanır; ortak kiriş çözücüsüne askı sacları gerçek iç mesnet, dıştaki
makaralar da konsol yükü olarak verilir. Askı sacı ilk makaradan önce, sonra
veya iki makara arasında olabilir. Mil şeması aynı çözülmüş geometriyi kullanır.

Makara düzeni `Kapaklı ve Keçeli` / `Kapaksız` seçimidir. İlkinde DIN 3760
karşılığı keçe kodu, ikincisinde Z/ZZ/RS/2RS rulman kapak tipi tutulur; koşullu
değer Teknik Ressam Özeti'ne iner. Özette çap olan değerler `diameter` bayrağı
taşır ve ekran, Excel, PDF aynı `summaryRowValue` biçimleyicisiyle Ø basar.

Yürütme rulmanının katalog iç çapı teker mili çapıyla birebir eşleşir ve katalog
seçimi `bore_mm` facet'ine kilitlenir. Motor—redüktör kaplinini motor mili ile
redüktör giriş milinin büyüğü; teker—redüktör kaplinini teker mili ile redüktör
çıkış milinin büyüğü sınırlar. Yürütme redüktörü servis katsayısı M1–M4: 1,4;
M5: 1,5; M6: 1,6; M7: 1,9; M8: 2,1 olarak otomatik gelir ve anahtar kapatılırsa
elle girilen değer korunur.

Kauçuk ve hücresel tamponlarda tepe yavaşlama kontrolü eksenden bağımsız
engelleyicidir: hesaplanan `a_maks`, FEM sınırı 5 m/s²'yi aşarsa sonuç uygun
olamaz. Yeni tambur seçimleri St44, St52 ve St44/St52'dir; karışık imalatta
kaynak ve akma kontrollerinde zayıf malzeme belirleyicidir. S235/S355 yalnız
eski revizyon snapshot'larının yeniden hesaplanabilmesi için tipte korunur.

## HESAP-21 — Halat, kanca ve döner eleman adetleri tek mühendislik kaynağından gelir.

Kullanıcı kararı (22.08.2026): yeni kaldırma grupları standart olarak **Denge
Traversli** açılır; eski revizyonlarda alan yoksa tarihsel **Denge Makaralı**
düzen korunur. Tahrikli/toplam halat sayıları hazır donanımın tanımıdır ve
kutularında otomatik rozeti taşır. Kanca bloğu makara adedi `toplam halat / 2`,
makara rulmanı adedi `makara × 2`, yürütme rulmanı adedi `teker × teker başına
rulman` olarak türetilir. Makara adedi otomatiği kapatılarak elle değiştirilebilir.

Tek yiv halat boyu `z × π × D + 0,10 × h × (n_toplam / n_tahrik)`tir; ham toplam
boy bunun tahrikli halat sayısıyla çarpımıdır. Traversli düzende her yiv ayrı
halattır ve sağ/sol helis sipariş satırlarına bölünür. Denge makaralı düzende
iki yiv tek sürekli sağ helis halatta birleşir. Siparişte her ayrı halat parçası
yukarı tam metreye çıkarılır; otomatik toplam `parça adedi × ⌈ham toplam / parça
adedi⌉` olur. Kullanıcı otomatiği kapatıp toplam metreye elle müdahale edebilir.
Yiv Boyu ekranında helis, halat adedi ve toplam halat boyu üç ayrı kutudur;
açıklamalar kutu altında değil başlıktaki bilgi açılırında gösterilir. Ekran,
hesap raporu ve ekipman listesi aynı saf halat planını okur; metre veya helis
yönü çıktılarda yeniden hesaplanmaz.

DIN 15401/15402 kanca kapasitesi raporda ve ekipman listesinde aynı DIN 15400
Tablo 3 hücresinden okunur; snapshot'taki eski `hookCapacityKg` değeri satın alma
satırına kaynak olamaz. Katalogda SIBRE TE frenin model kodundaki Eldro tipi ile
APC-AT kaplinin D1 fren kasnağı çapı ayrı ürün nitelikleridir; görünen modelden
çap tahmin edilmez, katalog alanı seçime doğrudan eşlenir.

Uygulama içindeki hesap şemaları tema duyarlıdır: açık/koyu palet dönüşümü ortak
`DiagramSvg` web katmanında yapılır. Saf diyagram modeli ve PDF çizicisi baskı
hex'lerini korur; ekran teması için modeldeki renkleri değiştirmek veya PDF'yi
koyu palete geçirmek yasaktır.

## HESAP-22 — Çift tambur tek tahrik, iki simetrik halat grubu olarak çözülür.

Kullanıcı kararı (22.08.2026): `Çift Tambur`, ikiz donanımdan ayrı bir mekanik
düzendir. Ortadaki **tek redüktör** sağ ve sol iki simetrik tamburu sürer;
motor, redüktör ve fren tam mekanizma yüküyle hesaplanmaya devam eder. Halat
donanımı ikiye bölünür: 4/8 düzeni sağ ve solda 2/4, 4/16 düzeni sağ ve solda
2/8 olur. Tambur mili hesabında simetri nedeniyle yalnız bir tambur incelenir
ve o tambura gelen halat uçlarının yarısı kullanılır. Yeni işlerde tambur mili
malzemesi S355JR gelir; eski snapshot seçimi değiştirilmez.

Çift tamburun alt taşıyıcısı `Çift Kanca Bloğu` veya `Kaldırma Kirişi`dir. Çift
kanca bloğunda kapasite, blok ağırlığı, halat ağırlığı ve hareketli makara adedi
iki eşit bloğa bölünür; hesap bir bloğu yarım yükle boyutlandırır ve ekipman
listesi iki adet verir. Kaldırma kirişi seçiminde tek kiriş toplam yükle
hesaplanır. Kaldırma kirişi ve yorulma alt bölümleri çift kanca bloğu seçiminde;
kanca ve kanca rulmanı alt bölümleri kaldırma kirişi seçiminde uygulama, kontrol
özeti ve PDF raporundan birlikte düşer.

## HESAP-23 — Yürütme bölümü: yalnız köprüde sorulan girdi, iki kutulu ray, eşitlenen tahvil oranı, sınıftan gelen ivme.

Kullanıcı turu (23.08.2026), dört karar. Hepsi araba ve köprü yürütmesinde
ORTAKTIR; ayrı bir "köprü ekranı" yoktur.

**1 · YALNIZ TEK VARYANTTA SORULAN GİRDİ EKRANDAN DÜŞER.** Araba ve köprü aynı
alan listesini paylaşır, ama bazı büyüklükler yalnız köprü dalında hesaba
girer. *"Minimum araba yanaşması değerini alıyoruz ama kullanmıyoruz gibi
geldi bana … araba tekerlerinden çıkaralım."* Doğrudur: yanaşma, arabanın
köprü AÇIKLIĞI üzerindeki konumundan doğan bir eksantrikliktir; arabanın kendi
teker yükü dört tekere eşit paylaştırılır. Sahiplik `TRAVEL_INPUT_VARIANT`
haritasındadır (`presentation/travelFields.ts`) ve süzgeç sunum adaptöründeki
`inputDefs` üzerindedir — ekran ile PDF aynı listeyi okur, ayrışamazlar.
DEĞER SİLİNMEZ, yalnız sorulmaz: alan `TravelInputs`ta kalır, köprü hesabı ve
teker yükleri modülü onu okumaya devam eder. Aynı sınıftan olan
`bufferApproachM` (5.8) HENÜZ kapsam dışıdır; kaldırılacaksa haritaya bir
satır eklemek yeter.

**2 · RAY SEÇİMİ İKİ KUTULUDUR: önce AİLE, sonra ÖLÇÜ.** Defter
`calc/tables.ts`tedir ve her satır ailesini taşır (`RAIL_FAMILIES`:
`a` DIN 536 vinç rayı · `s` hafif/Vignole ray · `bar` kare-dikdörtgen dolu
çubuk). İkinci kutunun listesi `optionsFrom` ile birinciden türer; aile
değişince ölçü EN YAKIN BAŞ GENİŞLİĞİNE kayar (`syncRailCodeToFamily`) —
"S Tipi" yazıp "50x50" gösteren iki kutu, birbirini yalanlayan bir ekrandır.
Eski revizyonlarda aile alanı YOKTUR ve şablonunki miras bırakılmaz: kaydın
kendi kodundan çözülür (`migrateRailFamily` · `railFamilyOf`).
· S serisinde KÖŞE YARIÇAPI yayımlanmamıştır; elimizdeki çizelge yalnız baş
  genişliği C, taban B, yükseklik H ve gövde E verir. Uydurulmuş bir yarıçap
  yerine `radius: null` yazılır ve baş genişliği ETKİN genişlik sayılır
  (değişmez md. 4). Yarıçap belgelenirse tabloya yazmak yeter, etkin genişlik
  kendiliğinden daralır.
· S serisi TEK NORM DEĞİLDİR (DIN 5901 · DIN 17100 · NF A 45-310 · E1); bu
  yüzden baş genişliği metre ağırlığıyla birlikte sıralanmaz (S31, S30'dan
  ağır ama daha dar başlıdır). Ailenin ortak dilbilgisi tip numarasıdır:
  "S24" ≈ 24 kg/m. A serisinde tek standart olduğu için sıralama tutar.
· Metre ağırlığı A ve S'de tablodan, çubukta kesitten gelir (`railMassKgPerM`).
  Ana kirişin ölü yükü bunu okur; tanınmayan kod sessizce SIFIR ray payı
  demektir, bu yüzden kütlesiz ray satırı yazılmaz.

**3 · TAHVİL ORANI ÖNCE GEREKEN ORANA EŞİTLENİR, KUTU KIRMIZI DURUR.**
*"Eşitleme başta olmazsa yanlış tahvile göre yanlış motor seçiliyor."*
Gerçekleşen hız `V = (n_motor / i) · π · D` bağıntısıyla ORANDAN çıkar ve
gerekli güç doğrudan V ile büyür; oran gereken orandan uzaksa güç hesabı
baştan yanlış motoru seçtirir. `gearboxRatioAuto` açıkken türetme
(`deriveTravelInputs`) `i = n_motor / n_teker` değerini SEÇİMLERE yazar
(anahtar girdilerde durur — yiv boyunun düzeni) ve gerçekleşen hız anma
hızına oturur. Anahtar TEKER ÇAPI HER DEĞİŞTİĞİNDE yeniden kurulur
(`reArmGearboxRatioAuto`); katalogdan redüktör seçilince kendiliğinden kapanır
(`clearAutoFlagsForPickedSelections` — genel kural, alan adı sabitlenmez).
Anahtar açık kaldığı sürece 5.5 bölümü UYGUN DEĞİLDİR
(`${which}.gearbox.selected`, firma kabulü · engelleyici): sapma o hâlde
sıfırdır ve eski "Çevrim Oranı Sapması" uyarısı sessiz kalıyordu. Kutu
`AutoFieldState.tone: "danger"` ile KIRMIZI basar — mavi bir otomatik kutu
"tamam" derdi, oysa bu BEKLEYEN BİR KARARDIR.
Yeni iş şablonu bu yüzden 5.5'te "UYGUN DEĞİL" ile açılır; bedel bilinçlidir.

**4 · YÜRÜTME İVMESİ MEKANİZMA SINIFINDAN GELİR** (`travelAcceleration`,
`accelerationAuto`): M1–M4 0,12 · M5 0,13 · M6 0,15 · M7 0,2 · M8 0,25 m/s².
Eşleme hiçbir standartta normatif DEĞİLDİR — FEM 1.001 ve CMAA 70 ivmeyi
işletme koşullarına bırakır; bu bir firma kabulüdür ve anahtar kapatılıp elle
girilebilir. İvme iki yere birden girer: kalkış süresi `t = V / 60 / a` ve
CMAA 70 ivmelenme faktörü Ka.

**GÖSTERİLEN BASAMAKTA SIFIRA DÜŞEN SAYI EKSİ İŞARETLİ BASILMAZ.** Oran
eşitlendiğinde sapma −6·10⁻⁶ % çıkar ve `toLocaleString` bunu "-0 %" yazıyordu;
okuyucu olmayan bir sapmayı varmış gibi okur. Kural editördeki ve PDF'teki
`fmt` yardımcılarında AYNI biçimde durur.

## HESAP-24 — Tahrik adedi, ölçü onayı ve ana kiriş ön kontrolleri ortak hesap verisidir.

Kullanıcı kararı (23.08.2026): yeni hesap raporlarında araba ve köprü ivmeleri
otomatik açılır. Yürütmenin `Tahrik Sayısı` teker düzeninde sorulur; yeni işte
2 gelir ve 1/2/4/8/16 seçeneklidir. Otomatik yürütme motor sayısı bu değere
eşittir, fakat anahtar kapatılıp elle değiştirilebilir. Kaldırma motor sayısı
serbest sayı değildir; 1/2/4 seçenekli kutudur. Tahrik sayısı, motor başına
tahrikli teker adediyle çarpılarak toplam tahrikli tekeri verir; kullanıcı
motor sayısını elle değiştirdiğinde teker düzeni sessizce değişmez.

Teker yükleri 6.1 ve ana kiriş yükleri 7.2 bölümleri kullanıcı **Ölçü Onayı**
ister. Onay yoksa bölüm firma kabulü bakımından engelleyici biçimde uygun
değildir. Teker sayısı veya kılavuz geometrisi değiştiğinde 6.1; kaldırma
yüksekliği, teker aralıkları ya da 7.2 girdileri değiştiğinde 7.2 onayı yeniden
açılır. Kancanın en üst konumu kaldırma yüksekliğinden, köprü dingil açıklığı
6.1 teker aralıkları toplamından, teker basıncını taşıyan sac ise ana kiriş t3
gövde sacından otomatik türetilir; üçü de anahtarı kapatılarak elle değişebilir.
Bu onaylar yalnız UYGULAMA iş akışıdır: müşteri hesap raporunda “Kullanıcı
Ölçü Onayı” hesap satırı, firma onay kontrolü, “Diğer Kontroller” satırı veya
Kontrol Özeti girdisi olarak basılmaz. Hesap motorundaki engelleyici davranış
ve editördeki onay düğmesi korunur; süzgeç yalnız `pdf/report.tsx` sunumundadır.

Ana kiriş 7.8'de CMAA 70 §3.5.1 oranları normatif kontrol edilir: `L/h ≤ 25`
ve web plakaları arası net genişlik için `L/b ≤ 65`. Ekran açıklaması bu
tanımları, sınırları ve aşımın hangi kesit boyutuyla giderileceğini söyler.
FEM 1.001 A-2.2.3 elastik yapı titreşimlerinin ayrıntılı hesabının çoğu durumda
zor olduğunu belirtir; sayısal bir rezonans uzaklığı vermez. Bu nedenle
`T₁ = 2π√(δ/g)` ile bulunan doğal frekansın tambur frekansına uzaklığı için
%20 sınırı yalnız **ORION ön taraması / firma kabulü** olarak raporlanır,
FEM şartı diye etiketlenmez. 7.1 kesit şeması Iyy, alan, metre ağırlığı,
ağırlık merkezi ve `1,15 × açıklık × kg/m` yaklaşık ana kiriş ağırlığını;
7.8 şeması oranlarla iki frekansın ilişkisini uygulama ve PDF'de aynı veriyle
gösterir.

## HESAP-25 — Uygunluk Özeti şeridi: bölümün yargısı bölümün BAŞINDADIR.

Kullanıcı kararı (23.08.2026): tambur milinde denenen "İzin Verilen / Oluşan
Gerilmeler" şeridi *"kontrolü çok kolaylaştırıyor"* — bu yüzden SAYISAL YARGI
ÜRETEN HER bölüme konur. Kolaylığın kaynağı ayrıntı değil **tekdüze yerdir**:
mühendis "bu bölüm uygun mu?" sorusunun cevabını her bölümde AYNI noktada
bulur, satırların dibinde aramaz. Ayrıntılı hesap satırları ve onlara bağlı
kontroller (`check-anchors.ts`) aşağıda AYNEN kalır; şerit yalnız kararı
hızlandıran tekrardır ve hiçbir eşiği kendisi hesaplamaz — sayılar da
uygunluk da kontrolün kendi `pass` değerinden gelir.

Tanım TEK YERDEDİR: `module-adapters.ts` içindeki `*_HEADLINES` haritaları
(`AdapterHeadline`). Ekran (`HeadlineBand`/`HeadlineBadge`) ve PDF
(`HeadlineLine`) aynı haritayı okur — iki yüzey ayrışamaz.

**İKİ YERLEŞİM.** `band` girdilerle katalog seçimi ARASINA girer ve
bölümlerin geneli için budur. `catalog` ise rozetleri "Katalogdan Seç"
düğmesinin YANINA koyar; kararın kataloğa bakarken verildiği iki bölümde
kullanılır (2.1 halat emniyet katsayısı, 4.3 makara rulmanı).

**ŞERİDE GİRMEYENLER.** Şerit "hesaplanan ⟨işaret⟩ sınır" diye okunur; iki
sayısı olmayan kontrol orada bilgi vermez:
· ONAY / VARLIK kontrolleri — ölçü onayı (7.2 · 10.1), "tahvil oranı
  seçilmiş" (5.5), "fren boşluğu bandda" (2.8). Bunlar "0 ≥ 1" diye görünür;
  kararın kendisi zaten kutunun yanındadır.
· KAPSAM bilgilendirmeleri — "rüzgâr modellenmiyor" (8.2), "tepki yapıya
  aktarılmaz" (5.8), kılavuz kuvveti denge artığı (10.3).
· KABİN / ELEKTRİK ODASI (11.x) BÜTÜNÜYLE dışarıdadır: oradaki kontroller bir
  mühendislik yargısı değil KATALOG DURUMUDUR ("ürün seçilmiş mi", "katalogda
  sınır yayımlanmış mı"). Ürün seçilmemişken sınır 0'dır ve şerit
  "1,39 ≤ 0,00 kW" diye bağırırdı — olmayan bir hesap hatasını varmış gibi
  gösterirdi.

**ETİKETLER CİNSE GÖREDİR ve gerektiğinde SATIR BAŞINA ezilir**
(`AdapterHeadlineCheck.computedLabel` / `limitLabel`). Bir bölümün
kontrolleri her zaman aynı cinsten değildir — tamburda gövde gerilmesi
"Oluşan ≤ İzin verilen" iken çap kontrolü "Gereken ≤ Seçilen"dir; tek bir
etiket çifti dayatmak sayılardan birine YANLIŞ ad takmak olurdu. Üç aile:
· gerilme       → **Oluşan ≤ İzin verilen** · başlık "İzin Verilen / Oluşan Gerilmeler"
· kapasite/ölçü → **Gereken ≤ Seçilen** (hesaplanan taraf `required`)
· emniyet/ömür  → **Gerçekleşen ≥ Gereken** (hesaplanan taraf `provided`)

**BAŞLIK "KONTROL ÖZETİ" OLAMAZ** — o ad raporun sonundaki KONTROL DİZİNİNE
aittir ve yalnız detaylı raporda basılır (bkz. `belge.md`, rapor seviyeleri).
Aynı adı bölüm içinde de kullanmak iki ayrı şeyi tek adla anmak olurdu; şerit
"Uygunluk Özeti" adını taşır. Çakışmayı `report.smoke.test.tsx` belgenin
METNİNDEN ölçerek yakalar.

**ARALIĞIN İKİ UCU AYNIYSA ARALIK DEĞİLDİR** (`checkDisplay`): rulman iç çapı
kontrolü "60 … 60 mm" diye basılıyordu ve okuyucuyu iki farklı sınır arıyormuş
gibi bırakıyordu. Tek sınıra indirilir, bağıntı `=` olur. Gerçek aralıklarda
(çevrim oranı sapması) bağıntı işareti HİÇ basılmaz — "Sapma −77 % … Bant
−10 … 5 %" iki ayrı aralık okutur; sınır metni zaten "alt … üst" biçimindedir.

**KAPSAM KORUMASI** `__tests__/headlines.guard.test.ts`tedir ve üç şeyi birden
tutar: şerideki her sonek bölümün `checkSuffixes` bildiriminde vardır; sayısal
yargı üreten her bölümün şeridi vardır; şerit o bölümün BÜTÜN yargılarını
taşır. Sonuncusu önemlidir — eksik bir şerit, hepsi ✓ görünürken dışarıda
kalan bir kontrolü gizler ve özet YANILTIR. Yeni bir kontrol eklendiğinde test
kırılır ve mühendis onu şeride eklemeye (ya da gerekçesiyle muaf listesine
yazmaya) zorlanır.

## HESAP-26 — Ana kiriş ve teker yüklerinde her kutu kendi tasarım notunu taşır.

Kullanıcı kararı (23.08.2026): ana kiriş ve teker yükleri bölümlerindeki her
düzenlenebilir girdi/seçim kutusunun etiketinde `i` bilgi notu vardır. Not iki
kaynağı BİLEREK ayırır:

- **Standart dayanağı** yalnız FEM/DIN/CMAA maddesinin gerçekten söylediği
  tanımı, bağıntıyı veya sınırı açıklar.
- **Kod kullanımı** ORION modelinin değeri nereden otomatik getirdiğini, hangi
  bağıntıda kullandığını ve hangi durumda kullanıcının otomatiği kapatması
  gerektiğini açıklar.

Bir kesit yerleşimi veya firma kabulü standart hükmü gibi yazılmaz; kaynakta
olmayan bilgi uydurulmaz. Kapsam
`presentation/structuralFields.ts`teki `GIRDER_*_FIELDS` ile
`presentation/wheelLoadFields.ts`teki `WHEELLOAD_*_FIELDS` dizileridir ve
`field-info.guard.test.ts` bütün tanımların dolu not taşımasını korur.

Etiket metni ile `i` düğmesi TEK satır içi öbektir; simge etiketten kopup tek
başına alt satıra düşmez. Standart rozeti bu öbeğin dışındadır ve gerekirse bir
sonraki satıra geçebilir. Girdi üstleri `subgrid` ile aynı satır rayına oturur;
uzun etiket veya rozet komşu kutuyu aşağı kaydırmaz.

## HESAP-27 — Kasnak freni DIN ölçü resmiyle çizilir; ağırlık FREN + İTİCİDİR.

Kullanıcı kararı (23.08.2026): fren bölümünün (2.5 · 5.5b) başında katalogdan
seçilen kasnak freninin **DIN 15435 ölçü resmi** çizilir ve ölçüler seçime göre
CANLI değişir; fren adedinin yanında **toplam ağırlık** görünür.

Kasnak frenleri DIN tasarımıdır, bu yüzden ölçüler **markadan bağımsızdır**:
aynı kasnak çapı ve itici boyunda hangi üretici seçilirse seçilsin resim
aynıdır. Ölçü defteri `lib/calc/drum-brake.ts`tedir (SIBRE TE tablosu,
TE 2021_EN.pdf · 01_SIBRE_Brake-catalogue.pdf s.76-77) ve şemayı
`lib/diagrams/drumBrake.ts` çizer.

**ÖLÇÜLERİN İKİ SINIFI VARDIR.** A · B · H İTİCİ boyuna göre değişir; C · E ·
F · G · J · K · L · M · N · P · Q · R · d fren BOYUNUN ortak ölçüsüdür. D
ayrıca saklanmaz — DIN 15435'te tip numarası kasnak çapıdır (TE 315 → Ø315).
Ölçüler birbirine bağlıdır ve resim onlardan türetilir: E takımın sol ucundan,
G taban plakasının sol kenarından KASNAK EKSENİNE kadardır; plaka (E − G)
noktasında başlar, boyu C, kalınlığı N; eksen plaka üstünden L kadar
yukarıdadır; pabuç mafsalları eksenin iki yanında K uzaklıktadır. Planda
genişlikler iç içedir: F > P ≥ Q > J. Bu bağıntılar koruma testindedir —
şemanın bütün yerleşimi onlara dayanır.

**AĞIRLIK İKİ PARÇADIR VE TOPLANIR.** Üretici kataloğunun kg* sütunu İTİCİ
HARİÇTİR (tablonun kendi dipnotu: "kg without thruster"); itici ağırlığı Eldro
teknik değerler tablosundan gelir. Mühendisin istediği sayı ikisinin
TOPLAMIDIR — TE 315/50/6 → 50 + 23 = 73 kg. Katalog Ed 50 / Ed 80 / Ed 301
için ağırlığı ARALIK verir; TE frenlerinde kullanılan tipler 60 mm stroklu
olduğu için alt sınır esas alınır ama **üst sınır atılmaz**, ekranda aralık
olarak yazılır (uydurma tek sayı üretilmez — değişmez md. 4). EB (hidrolik)
itici kullanılmaz, seed'e girmez.

**ÖLÇÜSÜ BİLİNMEYEN FRENDE ŞEMA DA AĞIRLIK KUTUSU DA ÇIKMAZ.** TE 160 AYRI bir
ölçü resmidir (M1501 293 E-EN-2020-01, kompakt konsol): harfleri aynı anlamı
taşımaz ve katalogda ağırlık sütunu yoktur. Kaliperli/elektromanyetik fren,
elle yazılmış kod ve katalogda olmayan boy/itici birleşimi de `null` döner.
Yanlış ölçü resmi, hiç resim olmamasından kötüdür.

Model kodu ÜÇ yazımla gelir ve üçü de tanınır: **TE315/50/6** (üreticinin
sipariş düzeni), **TE 315 Ed 50/6** ve **TE 315 50/6** (eski revizyonlar),
marka önekli **SIBRE TE250 Ed 50/6**. Kimlik alanı bölüme göre değişir: kaldırmada ayrı
`brakeModel`, yürütmede birleşik `brakeBrand` ("MARKA MODEL" —
`catalog-mapping` 5.5b).

**AYNI SAYILAR İKİ YERDE YAŞAR** (defter + `cat_equipment`) ve bedeli
`calc/__tests__/drum-brake.test.ts` ile ödenir: test seed migration'ını OKUR ve
her satırı karşılaştırır (değişmez md. 8). Şemanın etiket çakışması ayrıca
ÖLÇÜLÜR — `legibility.guard.test.ts` yazı-yazı çakışmasını, `npx tsx
scripts/check-drum-brake-labels.ts` ise yazının ÇİZGİ üstüne binmesini (z-sırası
duyarlı) 23 fren boyunda sınar.

## HESAP-28 — Mühendislik mobilde kartlara katlanır; sayfa yatay kaymaz.

Kullanıcı kararı (23.08.2026): proje listesi, proje revizyonları, ekipman
sürümleri, elektrik listeleri, teknik resim arşivi, el kitabı revizyonları,
karşılaştırma ve işlem kaydı telefonda yatay tablo olarak bırakılmaz. Aynı
tablo işaretlemesi `oc-mobile-table` ile 768px altında başlıklı kartlara
katlanır; serbest metin ve birincil kimlik tam genişliktedir, durum/değer
alanları iki sütunda okunur, eylemler görünür kalır. Proje listesinde başlık
gizlendiği için sıralama filtre şeridindeki mobil seçimden; elektrik
kartlarında ise mobil sıralama seçimi ve yön düğmesinden yapılır.

Proje bölüm rayı telefonda iki sütun ve üç satırdır: kısa etiketler kullanılır,
El Kitabı son satırı kaplar. Bu, beş uzun sekmenin beş ayrı satır oluşturup
asıl içeriği ekranın altına itmesini engeller; sekme değerleri ve panelleri
değişmez.

Hesap editöründeki `SectionTable` sonuçları da karttır. Bölüm başlığının onay,
not, gizleme ve durum eylemleri telefonda kendi tam genişlik satırına sarılır;
kontrol sonucundaki UYGUN/UYGUN DEĞİL rozeti açıklamanın altına iner. Ekipman
satırında düzenlenen Ek Özellikler alanı tam genişliktedir; teknik ressam
özetleri aynı kart düzenini kullanır.

**İSTİSNALAR YALNIZ İÇERİK GEREKTİRİYORSA KAYAR:** ölçü şemaları, uzun
matematik formülleri ve el kitabının doğrudan düzenlenen değişken sütunlu
matrisi kendi `oc-scrollx` kabında yatay kayabilir. Bu iç kaplar `relative`dir
ve kaydırma ipucu taşır; belge/sayfa gövdesi hiçbir genişlikte kaymaz.

Koruma ölçümü `/dev/projects-preview`, `/dev/project-preview`,
`/dev/editor-preview`, `/dev/equipment-preview`, `/dev/manual-preview` ve
`/dev/double-drum-preview` rotalarında 320, 375, 768 ve 1280px genişliklerde
yapılır. Editör için yalnız ilk ekran yeterli değildir: 52 adımın tamamında
`document.scrollWidth === document.clientWidth` ve kart kabında iç taşma
olmadığı doğrulanır.

## HESAP-29 — Rulman markası bir bölümün değil VİNCİN kararıdır; sipariş kutuları şemayla anlatılır.

Kullanıcı kararı (24.08.2026).

**RULMAN MARKASI KUTULARI BİRBİRİNE BAĞLIDIR.** Atölye hangi markaları kabul
ediyorsa tambur, denge, makara, kanca ve teker rulmanlarının hepsi onları
kullanır; marka bölüm bölüm verilen bir karar değildir. Bağın tanımı
`calc/bearing-brand.ts`tedir (SAF): hangi seçim alanının hangi `*BrandAuto`
anahtarına bağlı olduğu ve yayılımın kuralı orada durur, state'i editör yazar.

- Anahtarı AÇIK bir kutuda marka değişirse yayılım anahtarı açık BÜTÜN kutulara
  gider — **başlatan bölüm dahil**: kaldırma grubunda iki kutu vardır (tambur +
  denge) ve başlatan bölümü atlamak ikincisini bağın dışında bırakırdı.
- Anahtarı KAPATILAN kutu bağdan çıkar ve kendi markasını tutar; yayılım ona
  dokunmaz.
- Anahtar yeniden AÇILIRSA kutudaki marka doluysa **ortak marka o olur** ve
  hepsine yayılır; boşsa kutu bağdaki markayı devralır.
- Anahtar burada "türetildi" DEĞİL **bağlı** demektir: kutu açıkken de
  seçilebilir (`AutoFieldState.linked`). Kilitlenseydi marka ancak bağ
  bozularak seçilebilirdi.
- Anahtarlar `revision-load.ts`teki `AUTO_FLAGS` listesindedir: eski
  revizyonlarda anahtar yoktur, markalar ELLE seçilmiştir ve yayınlanmış bir
  rapor ilk açılışta kendi kendini eşitleyemez.

Kanca (eksenel) rulmanının marka kutusu YOKTU; ekipman listesi bu yüzden marka
sütununa rulman TİPİNİ basıyordu ("Eksenel Bilyalı Rulman" bir marka değildir).
Kutu eklendi, tip teknik özellik metnine taşındı.

**HALAT DENGELEME BÖLÜMÜ ÖTEKİ RULMAN BÖLÜMLERİYLE AYNI YOLU KULLANIR.** Denge
rulmanı elle giriliyordu; artık katalogtan seçilir (`2.9` traversi ve `2.10`
makarası AYNI eşlemeyi paylaşır — iki bölüm de aynı NA/NNF rulmanı taşır).
Denge makarası çapı da serbest sayı değil, tambur ve kanca makarasıyla **aynı
standart seriden** açılır listedir (`DRUM_DIA_SERIES_MM`, `allowCustom`); atölyede
üçüncü bir çap dünyası açmak aynı imalata üçüncü bir kalıp demektir.

**SİPARİŞ KUTULARI ŞEMA TAŞIYABİLİR.** Motor bağlantı biçiminde B5 ile B14'ün
farkı flanşın çapı ve deliklerinin dişli olup olmadığıdır — yanlışını sipariş
etmek motoru redüktöre takılamaz hâle getirir. Alan tanımı `infoGuide` taşır;
bilgi açılırı metnin üstüne biçimin şemasını çizer ve seçili biçimi vurgular
(`components/field-guides.tsx`). Kodlar, IM karşılıkları (IEC 60034-7) ve
açıklamalar `fields.ts`teki sözlüklerden okunur — **alan tanımları saf kalır,
JSX içermez**. Şemada içi boş daire geçme deliği (FF), dolu daire dişli deliktir
(FT); büyük flanş ayak düzlemine kadar iner, zemini delmez.

Verim sınıfı listesi tek sınıflarla sınırlı değildir: bazı üreticiler gövdeyi
iki sınıf arasında bir bantta beyan eder ve sipariş metni de öyle yazılır, bu
yüzden **IE2/IE3** ve **IE3/IE4** de seçilebilir.

## HESAP-30 — Motor, fren, redüktör ve kaplin kutuları SİPARİŞİN sorusunu sorar; standart olan yazılmaz.

Kullanıcı kararı (24.08.2026). Bu kutuların hiçbiri hesabı değiştirmez — ekipman
listesine ve siparişe gider. Ortak kural: **STANDART OLAN DEĞER EKİPMAN
LİSTESİNE YAZILMAZ.** Standart zaten her siparişte geçerlidir; satıra yazmak
listeyi hiçbir şey söylemeyen tekrarlarla doldurur. Yalnız standart DIŞINDAKİ
seçim görünür, çünkü onu ayrıca sipariş etmek gerekir (`nonDefaultNote`).

**MOTOR** (kaldırma + yürütme): yalıtım sınıfı (IEC 60034-1 — B/F/H, standart
**F**), çalışma sınıfı (S1…S10, standart **S1**) ve sargı koruması
(PTC / 3PTC / PT100 / **Yok**). İlk ikisi standart rozetiyle tam tabloyu açar
(`IEC 60034-1 Yalıtım Sınıfı` ve `IEC 60034-1 Çalışma Sınıfı`). Yalıtım ve
çalışma sınıfı ekipman satırına HER ZAMAN yazılır — satıcı motoru bu ikisi
olmadan teklif edemez; PTC yalnız "Yok" değilken yazılır.

**FREN** (servis freni, kasnak ve disk): çoklu `brakeOptions` — üçü mekanik
yapı (içten/dıştan yaylı, elle açma kolu), beşi frenin üstündeki sensör (fren
açık/kapalı, balata aşınma/sıcaklık, tork).

**REDÜKTÖR**: çoklu `gearboxOptions` (Yok · yağ göstergesi · titreşim sensörü ·
sıcaklık sensörü). **MİL YÖNLERİ KUTUSU YÜRÜTMEDE YOKTUR** — yürütme redüktörü
teker miline sabit bir düzende oturur, yön bir sipariş sorusu değildir; kutu ve
ekipman satırındaki notu kaldırılmıştır. Kaldırmada kutu ve şeması durur.

**REDÜKTÖRÜN MARKASI MODEL ALANININ İÇİNDEDİR** ve ekipman listesinin marka
sütunu bu yüzden boş kalıyordu. Katalog eşlemesi redüktörü tek birleşik alandan
okur (`from: "brand_model"` → "Yılmaz Redüktör HT0823") çünkü marka adında
boşluk olan üründe metni ikiye bölmek sessizce yanlış eşleme üretir.
`gearboxIdentity` ayrıştırmayı TAHMİNLE YAPMAZ: metin yalnız BİLİNEN marka
adlarıyla karşılaştırılır, en uzun eşleşme kazanır ("Yılmaz Redüktör",
"Yılmaz"dan önce) ve eski kısa yazımlar kataloğun kendi adına çevrilir
(`YILMAZ` → `Yılmaz Redüktör`). Tanınmayan önek markaya SAYILMAZ — metin
olduğu gibi modelde kalır, marka boş görünür (md. 4).

**KAPLİN**: keçe tipi (**Standart O-Ring** / Keçeli) motor, tambur ve teker
kaplininde; tambur kaplininde ayrıca aşınma algılama (**Standart** /
İndikatörlü). İkisi de standart değerle açılır ve standartken listeye yazılmaz.

**MİL YÖNLERİ ŞEMASI ÜRETİCİNİN ÖLÇÜ RESMİNE GÖREDİR** (`Redüktör Yönleri.dxf`).
Fark süsleme değil GEOMETRİDİR: paralel milli redüktörde çıkış ve giriş mili
birbirine DİK DEĞİLDİR, ikisi de aynı yöne bakar ve yalnız gövdenin uzun ekseni
boyunca kaçıktır (çıkış üst üçte birde, giriş alta yakın). Gövde üst görünüşte
uzun kenarı millere dik duran bir dikdörtgendir; kontrol kapağı, cıvata halkası,
havalandırma tapası ve delikli bağlantı kulakları çizilir. Yön kodu bütün
figürü döndürür: çizim önce yerel çerçevede kurulur (çıkış sağa bakar), sonra
tek dönüşümle yerine oturur — dört yön için dört ayrı çizim bakımı yapılmaz.

**UYGUNLUK ŞERİDİNE GİRMEYEN ÜÇÜNCÜ TÜR: EŞLEŞME KONTROLÜ.** İki SEÇİLMİŞ
değerin aynı olup olmadığını soran kontroller (`brake.wheelModel`,
`motorCoupling.brakeWheelMatch`) `op: "range"` taşır ama alt ve üst sınırları
AYNIDIR; şeritte "250 ≤ 250 ≤ 250" diye görünürler — bir yargı değil totoloji.
Bunlar `BAND_DISI_SONEKLER`e girer. Modelin AYAR ARALIĞI (`brake.torqueModel`)
ise gerçek bir bant kontrolüdür ve şeritte durur.

**TAMPONUN SİPARİŞ ADEDİ HESABIN ADEDİ DEĞİLDİR.** "Kurulu Tampon Adedi"
kutusu hesabın sorusunu cevaplar — bir çarpmada yükü kaç tampon paylaşır
(KAT0170 s.6 yerleşimi, `activeBufferCountForImpact`). Vinç ise tamponu HER İKİ
UÇTA taşır ve bir uçtaki düzen ötekinde birebir tekrarlanır; ekipman listesi bu
yüzden `bufferOrderQty` = kurulu adet × 2 basar. Liste eskiden SABİT 2
yazıyordu, kutuda ne seçilirse seçilsin (kullanıcı bildirimi, 24.08.2026).
Çarpan saf tarafta tek yerdedir — Excel ve PDF aynı sayıyı okur.

## HESAP-31 — Teklif hesabı ayrı arşivdir, ayrı motor değildir.

Teklif aşamasında hızlı açılan hesap raporları da `projects` + `revisions`
snapshot zincirini, `RevisionEditor`, `runCalc`, hesap raporu PDF'i ve ekipman
çıktılarını **aynen** kullanır. İkinci bir hesap çekirdeği, teklif için
sadeleştirilmiş formül kopyası ya da teklif payload'ı içinde hesap bloğu yoktur.

Ayrım yalnız `projects.report_context` alanındadır:

- `engineering` — alınmış iş / Mühendislik arşivi (`/projects`),
- `offer` — teklif ön hesabı (`/offers/hesap-raporlari`).

Mevcut kayıtların varsayılanı `engineering`dir. Teklif bağlamı `job_id`
taşımaz; iş kazanıldığında teklif raporu sessizce Mühendislik'e taşınmaz.
Gerekirse Mühendislik bağlamında kopya açılır; iki revizyon zinciri ve iki
arşiv birbirinden ayrı kalır. Teklif detayında elektrik projesi, şartname,
teknik resim takibi ve el kitabı gösterilmez — bunlar alınmış işin teslim
katmanlarıdır. Hesap raporu ve ondan türeyen ekipman listesi ise ortaktır.

## HESAP-32 — Tambur rulmanı ve yatağı tamburun serbest ucuna göre sayılır.

Kaldırma tamburunu redüktör tarafı taşır; ayrı tambur rulmanı ve yatağı yalnız
serbest uçtadır. Bu nedenle standart tek tamburlu düzende rulman ve yatak
**1'er adet**, ortadaki tek redüktörün iki simetrik tamburu sürdüğü çift tambur
düzeninde **2'şer adet** ekipman listesine girer. Vinç ile yalnız vinç arabası
raporu arasında bu adet kuralı değişmez. İkiz donanım ise iki bağımsız hazır
ekipman setidir ve mevcut set çarpanını ayrıca uygular.

## HESAP-33 — Yürütme freni bütün yürütme eksenlerinde hesaplanır; teker sertliği seçilebilir.

Kullanıcı kararı (28.08.2026): Araba Yürütme, Köprü Yürütme ile aynı `5.5b`
Yürütme Freni bölümünü taşır. Kural ana, yardımcı ve monoray arabaları için de
aynıdır; yürütme ailesinin tek tanımı ayrıştırılmaz. Gereken fren torku her
bağımsız tahrikin motor/redüktör giriş torkunun fren emniyet katsayılı
değeridir (`T_f = T_g · k_f`). Bölüm, katalog seçimi, fren şeması, kontrol,
PDF hesap raporu, ana ekipman özeti ve ekipman listesinde bütün yürütme
varyantlarında birlikte görünür. Eski araba snapshot'larındaki hesap dışı `0`
katsayısı, yeni alan işareti yoksa yüklemede `1,6` değerine taşınır; seçim
yapılmamışsa kontrol yayın engelleyici olarak uygun değildir.

Tekerlek bölümünde `wheelDiaMm` alanının hemen ardından `wheelHardness` seçimi
gelir. Yeni ve eski işler `32-35 HRC` ile tamamlanır; seçenekler `Yok`,
`32-35 HRC`, `35-40 HRC`, `40-45 HRC`, `45-50 HRC`, `50-55 HRC`dir. `Yok`
uygulamada kutuyu erişilebilir bırakır fakat hesap raporundaki sertlik satırını,
ana ekipman özetindeki sertlik parçasını ve ekipman açıklamasındaki sertlik
metnini sessizce düşürür.

## HESAP-34 — Elektrik odası gerçek pano dizisiyle boyutlandırılır; otomatik kayıp değeri kaynağını gösterir.

Kullanıcı kararı (28.08.2026): `11.2 Elektrik Odası` içinde **Pano Adedi**
doğrudan seçilir ve her pano `1. Pano … n. Pano` olarak ayrı bir en satırı
taşır. Standart enler 400 / 500 / 600 / 700 / 800 / 1000 / 1200 mm'dir;
yeni satır `Yeni Pano Ekle` düğmesiyle 800 mm olarak açılır ve `panelCount`
aynı işlemde artırılır. Her pano kartındaki `Sil` düğmesi yalnız o satırı ve
ona ait eni kaldırır; kalan panoları 1…n olarak yeniden sıralar ve `panelCount`
değerini aynı işlemde azaltır. Son pano da silinebilir; boş durumda yeni pano
düğmesi ilk satırı yeniden 800 mm olarak kurar. Yükseklik
(1400 / 1600 / 1800 / 2000 mm) **ilk pano
satırından** seçilir ve bütün panolarda ortaktır; sonraki satırlar bu bağı açıkça
gösterir. Derinlik (400 / 600 / 700 mm) de bütün panolarda ortaktır. Her panonun
altında sabit **200 mm baza** vardır. Eski revizyonlarda bulunmayan alanlar
800 mm en, 1800 mm gövde yüksekliği ve 600 mm derinlikle tamamlanır; kayıtlı
`panelCount` korunur ve eksik en satırları 800 mm olur.

Oda yerleşimi iki görünüşlüdür ve ikisi aynı yatay sıradadır: **yan görünüş ön
görünüşün sağındadır**. Ön görünüş yalnız P1…Pn pano enlerini, ortak gövde
yüksekliğini ve bazayı çizer; oda kapısı bu şemada gösterilmez. Yan görünüş pano
derinliğini ve pano önünde kalan yürüme mesafesini ölçülendirir:

    L_pano = Σ pano enleri
    H_toplam = H_pano + 200 mm
    B_yürüme = B_oda − D_pano

Bu üç geometri oda uzunluğu, oda yüksekliği ve oda genişliğine karşı ayrı
uygunluk kontrolleridir. Kapı eni/yüksekliği artık elektrik odası girdisidir ve
şemada çizilmese de iletim alanına aynı gerçek ölçü girer; operatör kabininin
700 × 1900 mm kapı kabulü ve kendi kapı çizimi değişmez. Excel ekipman listesi
ile teknik çizim özeti aynı pano dizisi, baza, kapı ve yürüme ölçülerini okur.

**`0 kW` GÖSTERİM HATASININ KÖK NEDENİ:** hesap motoru otomatik pano kaybını
doğru türetiyor ve iklimlendirme hesabına veriyordu, fakat editör/PDF girdi
tablosu snapshot'ta saklanan elle-giriş alanını (`roomDeviceHeatKw`, çoğunlukla
0) basıyordu. Otomatik anahtar açıkken artık form ve rapor, motorun ürettiği
`drive.panelHeat` hücresini gösterir; snapshot'taki manuel değer EZİLMEZ ve
anahtar kapatılırsa yeniden kullanılabilir. Gösterim 0,001 kW'a yuvarlanır;
hesap hücresi tam hassasiyetini korur.

`Hesap ve Kontroller` altındaki cihaz dökümü her aktif tahrik grubu için motor
gücünü, adedi, motoru karşılayan en küçük ABB ACS880-104 ağır hizmet `P_Hd`
sınıfını, tek sürücü ve grup atık ısısını listeler. Ardından invertör kayıpları,
%80 yardımcı ekipman payı ve toplam üzerine uygulanan 0,6 eşzamanlılık ayrı
satırlardır. Böylece otomatik pano kayıp gücü yalnız sonuç değil, izlenebilir bir
seçim zinciridir; motor gücü katalog üst sınırını aşarsa son sınıf oransal
ölçeklenir ve bu durum seçim kaydında işaretlenir.

## HESAP-35 — Ağırlık dökümü bir DOĞRULAMADIR, bir hesap değildir.

Kullanıcı kararı (01.09.2026): teknik özelliklerdeki **Ağırlıklar** kutularının
yanında bir **Σ** düğmesi; açılan tek pencere vincin ağırlığını **bant → grup →
kalem** ağacında listeler ve TASARIMDAN ÖNCE girilen tahmini ağırlığı, rapor
ilerledikçe ortaya çıkan gerçek parçalarla karşılaştırır. Kullanıcının cümlesi:
*"bu ağırlıklar vincin tasarımında hesaplarda kullanılıyor… ana hedefim bu
pop-up'ta vincin tahmini girdiğim ağırlıklarını doğrulamak."*

**MOTOR DÖKÜMÜ HİÇ GÖRMEZ.** `runCalc` onu çağırmaz, hiçbir `AnyCheck` ondan
beslenir, hiçbir kesit onunla onaylanır. Çekirdek `src/lib/weights/` altındadır
ve SAFTIR; `lib/calc` onu tanımaz (koruma: `dokum.guard.test.ts`).

**MOTORA GİDEN TEK KAPI MÜHENDİSİN KENDİ EYLEMİDİR.** "Teknik özelliğe yaz"
düğmesi bant toplamını `specs.bridgeWeightT`e (ya da ilgili araba kutusuna)
yazar — bu, kutuya ELLE yazmakla aynı şeydir ve revizyon farkında görünür.
Otomatik yazma YOKTUR: **`AUTO_FLAGS`e yeni bir anahtar EKLENMEZ**, çünkü
`*Auto` deseni sürekli ve sessiz yazar; burada istenen tek, açık ve onaylı bir
karardır.

**MALIYET-3 ÇİĞNENMEZ.** O madde teklif maliyet MODELİNİ işaret eder ve ondan
çıkan bir sayının hesap raporuna girmesini yasaklar. Burada paylaşılan şey
model değil **DEFTER**dir: firma imalat geçmişinden gelen ağırlık tabloları
`offers/cost/params.ts`te KALIR ve `lib/weights/firma-tablolari.ts` TEK DİKİŞ
YERİNDEN yeniden dışa verir (kopyalanmaz — değişmez md. 8). `lib/weights`
hiçbir dosyası `offers/cost/model` içe aktarmaz.

**DÖRT KAYNAK, HER SATIRDA ROZETLİ.** `hesap` (kesitin kendi geometrisi) ·
`katalog` (üreticinin yayımladığı kilo) · `tahmin` (firma kabulü) · `elle`
(mühendisin o işe özel bilgisi). Güven soldan sağa azalır ve bir satır KARIŞIK
kaynaklıysa **EN ZAYIF HALKAYI** yazar: başkirişte kesit hesaptan gelse de boy
tahmin olduğu için rozet `Tahmin`tir.

**EKSİK KALEM SIFIR SAYILMAZ** (değişmez md. 4). Ağırlığı bilinmeyen satır
`null` gelir, GEREKÇESİNİ yazar ve toplamlar `≥` ile basılır. Katalogda ağırlık
yayımlanmayan üç tür (SKF rulman yatağı · TMS klima · Conductix/Vasel feston)
bilinçli boştur; uydurulmaz.

**DÖKÜMÜN KENDİSİ SAKLANMAZ**, her açılışta girdilerden, seçimlerden ve
sonuçlardan yeniden türetilir. Saklansaydı mühendis bir motoru değiştirdikten
sonra pencere eski ağırlığı göstermeye devam eder ve doğrulama aracı YANLIŞ
DOĞRULARDI. Revizyona giden tek şey türetilemeyen kısımdır:
`inputs.weightBreakdown` = `overrides` (elle verilen kilolar) · `notes` (neden
verildi) · `applied` ("teknik özelliğe yazıldı" izi ve kaynak karışımı).
Migration GEREKMEZ. `revision-diff` bunu sahte bir MODÜL sanmasın diye kendi
satırıyla ele alınır ("Ağırlık Dökümü — Elle Verilen Kalemler").

**ADET EZİLEMEZ.** Düzenlenebilen yalnız kilodur; adetin tek kaynağı ekipman
listesidir (HESAP-21). Grup TOPLAMI ezilebilir — o zaman kalemler listede
solgun kalır ama toplama girmez; silmek bilgi kaybı olurdu.

**KATALOG KALEMLERİ EKİPMAN SATIRLARINDAN OKUNUR**, ikinci bir liste yazılmaz:
`buildEquipmentGroups` kapalı bölümü, gizlenen alt bölümü, alternatifleri ve
adetleri zaten doğru üretir. Satır ağırlığı `EqRow.weightKg`tedir ve MERKEZÎ bir
çözücü doldurur (`agirlikCozucu`) — yirmi beş satır nesnesine ağırlık
serpiştirilmedi. İki yönlü kapsam koruması hem üretilen her slug'ın bir grubu
olduğunu hem defterdeki her slug'ın gerçekten üretildiğini ölçer.

**GİZLENEN ALT BÖLÜM VARSAYILAN OLARAK DÜŞER**, ekipman listesiyle aynı
davranış; grup dipnotu kaç satırın düştüğünü yazar. Pencerenin üstündeki
**"Gizli bölümleri de say"** anahtarı onları SOLGUN geri getirir — gizlemenin
iki gerekçesi vardır (HESAP-7) ve ikincisinde parça gerçekten vardır. Anahtar
bir GÖRÜNÜM tercihidir, revizyona yazılmaz; katlama durumu da öyle.

**SAPMA EŞİĞİ %10'DUR** (`AGIRLIK_SAPMA_SINIRI`) ve maliyet tarafındaki
`COST_DEVIATION_LIMIT` (%5) yeniden kullanılmaz: orada soru "teklifte söz
verilen ekipman hesaptan çıkanla aynı mı", burada "tasarım öncesi tahmin tuttu
mu"dur.

**KABİN VE ELEKTRİK ODASI KÖPRÜ BANDININ İÇİNDEDİR.** Köprünün üzerinde
dururlar; `bridgeWeightT`e yazılan sayı onları İÇERMEK ZORUNDADIR, çünkü ana
kirişin ölü yükü ve teker yükleri onları taşır. Her ARABA kendi bandını kurar
ve kendi kutusuyla karşılaştırılır; paylaşımlı yardımcı kaldırma ANA arabanın
bandındadır (`hoistTrolleyKey` — `HOIST_OF_TRAVEL`ün TERSİ, karıştırılmaz).

### 02.09.2026 turu — dokuz madde

**DÜĞME TEKTİR VE BÖLÜM BAŞLIĞINDADIR.** Beş ağırlık kutusunun yanındaki beş
yuvarlak Σ kaldırıldı (kullanıcı isteği: *"kutu şeklinde tek bir buton"*): beşi
de aynı pencereyi açıyordu, yani tek bir eylem beş eylem gibi görünüyordu — ve o
yuvarlak biçim alan etiketlerindeki "i" (bilgi) düğmesiyle birebir aynıydı.
Pencere artık hiçbir bandı öne almaz; `acilanBant` geçilmez, beş bant da açık
gelir. **Ağırlıklar** grubunun başlığı ayrıca ton açısı 240 (çelik mavisi) ile
renklenir (`SpecGroup.hue`); Orion Kırmızısı SEÇİLMEZ, o renk "kontrol
sağlanmadı" demektir.

**PENCERE TEK IZGARADIR: `[ağırlık] [ad] [durum] [rozet·eylem]`.** Ağırlık EN
SOLDA ve düzenlenebilir; "N kalem eksik" gibi metinler ağırlığın yanından
alınıp KENDİ SÜTUNUNA taşındı. Telefonda durum sütunu kapanır ve metin adın
ALTINA iner — dört gerçek sütun 375 px'te adı "T…" hâline getiriyordu. Başlık
satırlarının tamamı tıklanabilir (`grid-cols-subgrid` ile ana ızgaraya oturan
tek bir `<button>`); kalem satırının İKİ HEDEFİ korunur (ada tıkla = nereden
geldiği, sayıya tıkla = düzenle), çünkü satırı düğmeye çevirmek girdiyi yutardı.

**ÜÇ RENK KANALI, ÜÇÜ DE AYRI SÜTUNDA.** Bant başlığı bandın tonunu taşır;
ağırlık sütunu kilonun ISISINI (`.oc-amount`, taban = en ağır KALEM — grup ve
bant toplamları ısı ALMAZ, orada ölçek tavana yapışırdı); rozet kaynağın tonunu
ve ADINI taşır. Sapma şeridi tutuyorsa yeşil, aşıyorsa kırmızı zeminlidir.
Isı seviyesi `null` ise sınıf da verilmez — `.oc-amount` tanımsız `--oc-level`i
`0` okur ve bilinmeyeni "en soğuk" gösterirdi.

**PENCEREDEN ELLE SATIR AÇILABİLİR** (`AgirlikDokumuDurumu.serbest`). Ekipman
listesinin `EquipmentExtraRow`u DEĞİLDİR ve oraya yazılmaz: orası satın almaya
giden bir belge, burası bir tartıdır. Kimlik `serbest-` ÖN EKİ zorunludur ve
kelepçe İKİ yerdedir (`topla.ts` ve `revision-load.ts`) — ön eksiz bir kimlik
otomatik bir kalemin anahtarını ele geçirip ezmesini devralabilirdi. Bandı ya da
grubu olmayan satır bandı DİRİLTMEZ, düşer ve notlarda sayılır.

**PORTAL AYAKLARI KÖPRÜ BANDININDA AMA KUTUNUN DIŞINDA.** Kullanıcı ayakları
köprü grubunda istedi ve oradadırlar; ama `bridgeWeightT` kutusunu ana kiriş
(ölü yük payı) ve teker yükleri OKUR — ayak kirişi TAŞIR, kirişe BİNMEZ.
Grup `bantToplaminaGirmez` ile işaretlidir: `bant.kg`ye girmez, `bant.disKg`de
ayrıca toplanır, vincin TOPLAM ağırlığına girer. Ayak adedi künyeden gelir
(`gantryLegCount`: portal 4, yarı portal 2; tam eşitlik — `includes("PORTAL")`
"Yarı Portal"ı da yakalardı). **Künyenin dökümü beslemesi HESAP-8b'yi çiğnemez**:
o kural tipin `runCalc`/`activeModules`/`loadRevision`a girmesini yasaklar,
döküm ise motorun görmediği bir DOĞRULAMADIR. Ayak yüksekliği hesap
bölümlerinde sorulmaz; dökümün kendi girdisidir
(`AgirlikDokumuDurumu.ayakYuksekligiM`) ve girilmezse satır boş kalır.

**BAŞKİRİŞ HER ZAMAN GÖRÜNÜR.** Yeni işler «09 · Başkiriş» bölümü KAPALI açılır
ve grup bugüne dek hiç çizilmiyordu; `bridgeWeightT` ipucunun sözü
("başkirişler dâhil") tutulmuyordu. Bölüm açıkken kalem kesitten gelir,
kapalıyken köşe yükünden TAHMİN edilir (`endCarriageKgPerT`). **Anahtar iki
durumda da `bridge.endCarriage.beam`dir** — farklı olsaydı bölümü sonradan açan
mühendisin elle girdiği kilo sessizce koparadı.

**AĞIRLIK NEDEN YOK — CEVAP ÜÇE AYRILIR.** Eski tek cümle ("ürünü yeniden
seçin") ürün seçiliyken de basılıyor ve mühendisi olmayan bir işe gönderiyordu:
POLAT PCS, SEW R/X ve YILMAZ Planet redüktörlerinin motorsuz ağırlığı katalog
sayfasında HİÇ yayımlanmamıştır. Artık: slug bilinçli boşsa kendi cümlesi, ürün
seçiliyse "föyden elle girin", seçili değilse "önce ürünü seçin".

**DÖRT YENİ AĞIRLIK KAYNAĞI** (`imalatAgirligi`, `topla.ts`):
- `shaft` — kanca bloğu mili, kendi geometrisinden (π/4·d²·L·7,85). Silindir
  kabulüdür, kademe ve delikler düşülmez; gerekçe bunu söyler.
- `liftingBeam` — kaldırma kirişi, ARALIK olarak (alt uç ince kesit, üst uç
  kalın kesit metre ağırlığı × açıklık). Kesidin iki bölgesinin uzunluğu
  bölümde sorulmuyor; tek sayı uydurmak yerine iki uç verilir.
- `drumBearingHousing` — SKF SNL/SE gövde kütlesi (`lib/calc/bearing-housing.ts`),
  kaynak workspace kökündeki SKF PDF'idir (SKF verisi WEBDEN ÇEKİLMEZ).
  Katalogun kendi içinde çeliştiği dört gövdede aralık verilir.
- `balanceSheave` / `balanceLoadcell` — yayımlanmış boy tablosundan
  (`plate-sheave.ts`) ve Esit PLC ölçü resminden (`load-cell.ts`).
- `cabinAc` · `roomAc` · `panelAc` — klima kataloğu SERİ düzeyindedir, üretici
  ağırlığı ALT MODEL başına yayımlar; ağırlık bu yüzden HESAPLANAN ISI
  YÜKÜNDEN türetilir (`lib/weights/klima-agirlik.ts`) ve rozet `Tahmin`tir.
  Değerler üreticinin ürün sayfalarındandır ve `catalog_data`ya YAZILMAZ —
  oranın kuralı "basılı sayfada olmayan alan hiç yazılmaz".

**BESLEME FESTON DEĞİLSE SESSİZ KALINMAZ.** Bara, kablo zinciri ve kablo sarma
tamburunda ne ekipman satırı ne tahmin kalemi doğuyordu; hat ne listede ne
toplamda görünüyor ve eksik sayacına da katkı vermiyordu. Uydurma bir kg/m
yazılmaz; notlarda uyarı çıkar ve mühendis elle satır ekleyebilir.

**BAŞKİRİŞ BOYU MOTORA GİRDİ OLARAK EKLENMEDİ.** `EndCarriageInputs`e bir
`lengthMm` koymak her eski revizyona şablon varsayılanını sessizce verirdi ve
hiçbir kontrolün okumadığı bir sayı yapısal bir girdi gibi görünürdü. Boy
DEFTERDE türetilir: `L = teker aralığı + 2 · (katsayı × teker çapı)`.

**BÖLÜM 2.8 ARTIK EKİPMAN SATIRI ÜRETİR.** Tambur emniyet freni (SIBRE SHI)
uzun süre ne ekipman listesinde ne satın almada görünüyordu; kaliper ağırlığı
`safety-brake.ts` defterine eklendi ve `safety-brake.test.ts` tohum SQL'ini
okuyarak katalogla ayrışmayı engeller.

**ÇEKİRDEK ASLA FIRLATMAZ.** `runCalc` editörde bir `useMemo` içinde ve SSR
sırasında SUNUCUDA koşar; oradan erişilebilen tek bir tip hatası revizyon
sayfasını 500'e düşürür (KATALOG-13'ün ölçülmüş arızası). `agirlikDokumu` her
dalda `null` + gerekçe döner ve pencere yalnız AÇIKKEN hesaplanır.

**ÇIKTI YALNIZ UYGULAMA İÇİDİR** (kullanıcı kararı): PDF hesap raporu, ekipman
listesi ve Excel çıktıları DEĞİŞMEZ.

**Bilinçli kapsam dışı:** kaldırma kirişinin (çift tamburun kiriş seçeneği)
ağırlığı hesaplanmaz. Kesitin iki bölgesi (açıklık ortası ve mesnet) farklı
kalınlıktadır ve hangi bölgenin ne kadar sürdüğü sorulmuyor; bilerek düşük
çıkan bir tahmin, dürüst bir boşluktan kötüdür. Satır gerekçesiyle boş kalır.

## HESAP-36 — BÖLÜM RAYI MODÜL DÜZEYİNDEDİR; ADIM DÜZEYİ ARAMADADIR.

Kullanıcı kararı (01.09.2026, ayrıca soruldu ve doğrulandı): ray `01 · Teknik
Özellikler`, `02 · Ana Kaldırma`, … `07 · Ana Kiriş`, `Özet` satırlarını
listeler — **117 adımı değil, ~21 modülü**. Bir modüle dokunmak o modülün İLK
adımına götürür. Kaynak `NAV_GROUPS`tur; kapalı modüller de listelenir, çünkü
onları yeniden açmanın tek yolu kendi satırlarındaki ＋ düğmesidir.

**ADIM DÜZEYİ KAYBOLMAZ.** Adım adım gezinme yapışkan alt kumandadadır
(MOBIL-24: Geri/İleri) ve uzak bir adıma atlamanın yolu tabakadaki ARAMA
kutusudur: arama 117 adımın tamamına bakar ve DÜZ bir sonuç listesi döndürür
("gerilme" → `7.4 Gerilme Analizi`). Düz bir süzgeç ikinci bir düzey değildir.

**GİZLİ BÖLÜMÜN KONTROLÜ SAYILMAZ.** Satırın `n/m` rozeti modülün bölümlerinin
toplamıdır ve `sectionStatus` gizli bölümde `"none"` döner; gizli ya da kapalı
bir satırda kırmızı YAKILMAZ — rapora hiç girmeyen bir bölümün kalan kontrolü
sorun değildir.

**ADIM DÜZEYİ HER GENİŞLİKTE AÇILIR** (MOBIL-29, üçüncü tur): modül satırına
dokunmak o modülün adımlarını (`7.1 Kesit Özellikleri`, `7.4 Gerilme Analizi`…)
alt satır olarak açar, adıma dokunmak oraya götürür; gizli adım sayaç yerine
`gizli` yazar. Modül satırı GEZİNMEZ, yalnız açar — bu yüzden modülün ilk
adımına gitmek iki dokunuştur.

**TEK ADIMLI GRUP ÇOCUK ALMAZ VE GEZİNİLİR**: Teknik Özellikler ile Özet
grupsuz tek adımlardır; onlara çocuk vermek satırın kendini bir kez daha
yazması, açıcı yapmak ise gezilemez kılmak olurdu. Kimlikleri bu yüzden
`adim:<adım anahtarı>`dır — `aktifId` ile doğrudan eşleşir ve `rayaGit` onları
öteki adımlarla aynı dalda çözer. Çok adımlı grubun kimliği `group.key` kalır.

**KAPALI MODÜLÜN SATIRI AÇILMAZ**: `buildSteps` onun adımlarını hiç üretmediği
için dal boş olurdu. Satır listede DURUR (yalnız oradan geri açılır) ama
tıklamak sessizce hiçbir şey yapmaz.

**ARAMA `trKatla` İLE YAPILIR**, `toLocaleLowerCase("tr-TR")` ile değil: depodaki
gerçek Türkçe katlama odur ve `i ı İ I` ailesini tek harfe indirir.

## HESAP-37 — İklimlendirmenin tasarım noktası ARTIK GİRDİDİR; kabinin camı ölçüden türer.

Kullanıcı turu (02.09.2026, md. 2–14). Beş karar ve dört düzeltme.

**İÇ SICAKLIK MAHAL BAŞINA AYRIDIR.** `ROOM_DESIGN_TEMP_C` (25 °C) artık bir
YEDEKTİR: elektrik odası 23/24/25 (varsayılan **24**), operatör kabini
21/22/23/24 (varsayılan **23**) arasından seçilir. Sebebi ikisinin gereğinin
farklı olmasıdır — odada soru elektroniğin ömrü (IEC 61439-1 panoları 35 °C
24-saat ortalamasına göre doğrular), kabinde operatörün konforudur (ISO 7730 /
EN 16798-1 Kat. II yaz bandı 23–26 °C). Bir derece, iletimden taze havaya
kadar yükün HER kalemini birden oynatır. `roomTempC` verilmeyen her çağrı eski
sabiti kullanır, yani hiçbir eski revizyonun sayısı değişmez.

**KAPI ÖLÇÜSÜ TEK KUTUDUR** (`roomDoorSize`, "800x2000" biçiminde altı seçenek).
Genişlik ve yükseklik iki ayrı SAYI kutusuyken imal edilmeyen birleşimler
yazılabiliyordu; kapı bir üründür ve boyu defterlidir. **Eski iki alan tanımda
KALIR** ve `roomPanelLayout` tek kutu boşken onları okur; ayrıca `migrateCabin`
kayıtta alan yoksa tek kutuyu iki sayıdan KURAR — yoksa şablonun varsayılanı
mühendisin yazdığı 700 × 2.100'ü sessizce ezerdi.

**PANO ADEDİ VE DERİNLİĞİ ANA IZGARADA SORULMAZ.** Adet zaten pano oluşturma
kartındaki ekle/sil düğmelerinden yazılıyordu; ikinci bir kutu iki sayının
ayrışmasının davetiyesiydi. Derinlik de panoların tarif edildiği karta taşındı.
`panelCount` alanı DURUYOR: 11.3 Elektrik Panoları bölümünün kendi girdisidir ve
orada aynı zamanda SIZINTI KAPI ADEDİDİR — silinemez.

**KABİN CAM ALANI OTOMATİKTİR**: `A = 0,80 × yükseklik × (genişlik + uzunluk)`
(ön yüz tam, iki yanın yarısı; %80 çerçeve payı), bir ondalığa yuvarlanır.
`cabinGlazingAreaAuto` bayrağı `AUTO_FLAGS`tedir; anahtar kapatılınca son
türetilen değer kutuda kalır.

**CAM DEFTERİ BEŞ TİPLİDİR** ve `glazingKind()` artık BEYAZ LİSTE DEĞİLDİR
(`value in GLAZING`). Eski hâli üç değeri elle sayıyordu ve seçeneklere eklenen
yeni bir tip hesapta SESSİZCE "double" ile koşuyordu. Kurşungeçirmez cam İKİ
seçenektir ve aralarındaki fark 3,5 KATTIR: monolitik balistik lamine BR4
(U 4,5 · 80 kg/m²) tek camdan yalnız biraz iyidir; ısı yalıtımı ancak balistik
lamine + Low-E ısıcam birleşiminde sağlanır (BR4-NS, U 1,3 · 115 kg/m²).
Temperli ve lamine cam AYRI SEÇENEK DEĞİLDİR — EN 673'e göre U yalnız
kalınlığa, camın öz direncine ve yüzey yayınımına bağlıdır.

**DÜZELTİLEN DÖRT KUSUR:**
- `roomDeviceHeatAuto` ve `panelDeviceHeatAuto` `AUTO_FLAGS` listesinde YOKTU;
  bayrağı bulunmayan eski bir kayıtta şablondaki `true` miras kalıyor ve
  mühendisin elle girdiği pano kayıp gücü ilk açılışta SESSİZCE eziliyordu.
- Kabin cihaz ısısı yardım metni "…ve operatör" diyordu; kod operatörü AYRICA
  `occupantKw` olarak topluyor — metne uyan mühendis 130 W'ı ÇİFT sayardı.
- "Hesaplanan Isı Kazancı" formül satırı operatör kalemini yazmıyordu.
- Katalog kapasitesi **L35/L35** değeridir (DIN 3168 / EN 14511). Kontrol onu
  doğrudan kullanır ve ortama göre DÜŞÜRMEZ; ortam 40 °C'yi aşınca artık bir
  UYARI kontrolü çıkar. Düşürme YAPILMAZ: her üreticinin eğrisi farklıdır ve
  tek bir katsayı uydurmak yayımlanmamış bir kesinlik üretirdi (md. 4).

**BİLGİ NOTLARI KODUN YANINDA YAŞAR** (`presentation/cabinNotes.ts`): bölüm
başlığındaki «i» hesabın adımlarını, alan notları ise ışınım yükünün nasıl
kestirileceğini ve cam U değerlerinin kaynağını anlatır. Buradaki her katsayı
`climate-load.ts`teki gerçek değerdir; biri değişirse metin de değişmelidir —
metnin yalan söylemesi hiç olmamasından kötüdür.

## HESAP-38 — İklimlendirme şemasında ön ve yan görünüş AYNI ÖLÇEKTEDİR.

Kullanıcı bildirimi (02.09.2026, md. 4, 5, 13).

**İKİ GÖRÜNÜŞÜN YÜKSEKLİĞİ EŞİTTİR.** Ön ve yan kutular İKİ AYRI yükseklik
tavanına (168 ve 116 px) çarpıyordu: aynı 2,6 m'lik oda solda 154, sağda 104 px
çiziliyordu — 1,62 kat fark. Teknik resimde izdüşüm çizgileri ancak eşit
ölçekte hizalanır. `sideH = bh` ve duvar kalınlığı da ortaktır; genişlik
tavanına takılırsa YALNIZ GENİŞLİK kırpılır.

**PANO ETİKETİ ÖLÇÜLEREK YAZILIR.** Biçim `P1-600`e indi (8 karakterden 6'ya) ve
karar `textWidth` ile verilir, sabit bir px eşiğiyle değil; sığmayan etiket
ATILMAZ, numaraya KISALIR. Ölçüm payı 1,08'dir: ekranda yazı IBM Plex Mono
(genişlik tam), PDF'te DejaVu (orantılı) — ekranda sığan PDF'te taşabilir.

**PANOLARDAN SONRA BOYDA KALAN MESAFE ÇİZİLİR** ve sayı ÇİZİMDEN DEĞİL
HESAPTAN gelir (`roomPanelLayout.remainingLengthMm`): panolar sığmadığında şema
onları ölçekleyerek sığdırılmış gibi gösterir ve çizimden okunan boşluk yalan
söyler. Negatif değer mutlak değere ÇEVRİLMEZ; işaret bilginin kendisidir ve
etiket "SIĞMIYOR" yazar. `walkingClearanceMm` ile KARIŞTIRILMAZ — o, oda
GENİŞLİĞİ eksi pano DERİNLİĞİdir (yan görünüş), bu ise oda BOYU eksi pano
enleri toplamıdır (ön görünüş).

**ALT ETİKET ŞERİDİ ELLE KURULUR.** Dört etiket (kapı · cam · cihazlar ·
operatör) aynı taban çizgisine ayrı ayrı yazılıyor, toplam genişlikleri kutuya
sığmıyor ve çakışma çözücü ikisini 7,6 px aşağı itiyordu. Çözücü çakışmayı
ÇÖZMEZ, KAÇIRIR; doğru düzeltme yerleşimi ÖLÇMEKTİR. Etiketler artık toplanıp
tek (gerekirse kasıtlı iki) SABİT satır olarak basılır.

**ŞEMANIN ÖNİZLEMESİ VAR:** `/dev/climate-room-preview` — dört varyant (1, 3 ve
6 panolu oda ile kabin), auth'suz.
