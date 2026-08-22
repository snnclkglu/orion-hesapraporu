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

**TİP MOTORA GİRMEZ — TEK İSTİSNA BİR KERELİK TOHUMDUR.** HESAP-8b'nin kuralı
yerinde: `runCalc`, `activeModules` ve `loadRevision` `crane_type`ı hiç
görmez. `createRevision` tipi YALNIZ V0 doğarken okur ve `inputs
.disabledModules` listesine `TROLLEY_ONLY_DISABLED_MODULES`u ÖNERİ olarak
yazar (`craneTypePresetInputs`); karar o andan sonra revizyonun kendi
verisidir, mühendis ilk ekranda geri açabilir ve tip sonradan değişse bile
mevcut revizyonlar etkilenmez. Şablondan kopyalanan snapshot EZİLMEZ, kapalı
liste BİRLEŞTİRİLİR.

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

## HESAP-8b — Köprü İKİ ya da DÖRT kirişli olabilir.

`specs.girderArrangement`
(`iki` | `dort`) ikinci bir ana kiriş bölümü açar: **Ana Kiriş - 1 ANA
kaldırmayı, Ana Kiriş - 2 YARDIMCI kaldırmayı taşır** (kullanıcı kararı,
15.08.2026 — şarj / döküm vinci). VİNÇ TİPİ (`projects.crane_type`) bu
kararı VERMEZ: tip bir künye alanıdır ve motora hiç girmez; bütün topoloji
kararları teknik özelliklerdedir. (Tek istisna "Vinç Arabası" tipinin İLK
revizyona yazdığı bir kerelik tohumdur — kural değil öneri, bkz. HESAP-8f.)

Hangi kirişin neyi taşıdığı MODÜLÜN İÇİNDE DEĞİL bağlayıcıda kurulur
(`engine.girderDepsFor`): `computeMainGirder` artık `specs.mainCapacityT` /
`mainLiftSpeedMpm` okumaz, taşıdığı yükü `deps.hoistLoadKg` ve
`deps.liftSpeedMpm` ile alır. Köprü öz ağırlığı `deps.girdersInBridge`e (2
ya da 4) bölünür. Kontrol kimlikleri modül anahtarını taşır
(`${which}.stress.case1`), sunum tarafı ise AYNI aileyi paylaşır — bölüm
tanımları, kontrol bağlantı haritası ve 7.x şemalarının tamamı ikinci
takımda kendiliğinden çalışır. **Buruşma BİRİNCİ takımdan beslenir** ve
tektir; ikinci takımın buruşması bilinçli olarak kapsam dışıdır.

Başlıklar teknik özelliklere göre çözülür (`adapterTitle` /
`moduleLabelFor`): tek takımda sade "Ana Kiriş", dört kirişlide
"Ana Kiriş - 1" / "Ana Kiriş - 2".

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

Redüktör kataloğunda hedef tahvil oranı, tork/facet filtrelerinden sonra
uygulanır; katalogda birebir hedef yoksa en yakın bir alt ve bir üst oran aynı
anda bırakılır. Aynı oranı taşıyan farklı modeller saklanır.

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

Tek yiv halat boyu `z × π × D + 0,10 × h × (n_toplam / n_tahrik)`tir; toplam
boy bunun tahrikli halat sayısıyla çarpımıdır. Traversli düzende her yiv ayrı
halattır ve sağ/sol helis sipariş satırlarına bölünür. Denge makaralı düzende
iki yiv tek sürekli sağ helis halatta birleşir. Ekrandaki şema, yiv boyunun
yanındaki canlı boy özeti, hesap raporu ve ekipman listesi aynı saf halat planını
okur; metre veya helis yönü çıktılarda yeniden hesaplanmaz.

DIN 15401/15402 kanca kapasitesi raporda ve ekipman listesinde aynı DIN 15400
Tablo 3 hücresinden okunur; snapshot'taki eski `hookCapacityKg` değeri satın alma
satırına kaynak olamaz. Katalogda SIBRE TE frenin model kodundaki Eldro tipi ile
APC-AT kaplinin D1 fren kasnağı çapı ayrı ürün nitelikleridir; görünen modelden
çap tahmin edilmez, katalog alanı seçime doğrudan eşlenir.

Uygulama içindeki hesap şemaları tema duyarlıdır: açık/koyu palet dönüşümü ortak
`DiagramSvg` web katmanında yapılır. Saf diyagram modeli ve PDF çizicisi baskı
hex'lerini korur; ekran teması için modeldeki renkleri değiştirmek veya PDF'yi
koyu palete geçirmek yasaktır.
