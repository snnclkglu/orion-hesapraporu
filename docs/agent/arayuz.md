# Dokunmatik ve dar ekran

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/arayuz.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/components/**` · `src/app/globals.css` · `src/app/(app)/layout.tsx`


Uygulama atölyede ve sahada telefondan/tabletten de açılır. Aşağıdakiler
tek tek düzeltme değil, **her yeni ekranda uyulacak kurallardır**.

## MOBIL-1 — Dokunma hedefi kırılımla değil `pointer-coarse:` ile büyür — ve KUTUYU

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

## MOBIL-2 — Girdi yazısı dokunmatikte 16px'tir

(`text-base pointer-fine:text-sm`).
iOS Safari 16px'ten küçük yazılı alana odaklanınca sayfayı KENDİLİĞİNDEN
yakınlaştırır ve geri çıkmaz. Eski kural `md:text-sm` idi ve iPad portre
(768px) tam o eşiğe düştüğü için tablette sorunu geri getiriyordu.
**Bir çağrı yeri yazı boyutunu ezerse dokunmatik payını korumalıdır:**
`text-xs` DEĞİL, `text-base pointer-fine:text-xs`.

## MOBIL-3 — Yükseklik birimi `dvh`dir, `vh` değil.

Mobil tarayıcıda `vh` adres
çubuğu gizliyken ölçülen BÜYÜK görünür alandır; `100vh` bir kutuyu her
zaman ekranın altına taşırır ve `min-h-screen` kısa sayfalarda "hayalet
kaydırma" üretir.

## MOBIL-4 — Pencere yüksekliği görünür alana kelepçelidir.

`DialogContent` tabanı
`max-h-[calc(100dvh-1.5rem)] overflow-y-auto` taşır. Bu olmadan `fixed` +
`-translate-y-1/2` ile ortalanan uzun bir form hem üstten hem alttan
ekranın dışında kalır ve KAYDIRILAMAZ — yani ilk alana da Kaydet düğmesine
de erişilemez. Çağrı yerlerinde tekrar etme.

## MOBIL-5 — `min-width`, `max-width`i yener.

Açılır kutulara verilen sabit
`min-w-[26rem]` gibi değerler taban `max-w` kelepçesini delip ekranı
taşırır. Kalıp: `min-w-[min(26rem,calc(100vw-1.5rem))]`.

## MOBIL-6 — Geniş pencere tablette kenar boşluğu bırakır.

`sm:max-w-3xl` (768px)
tam olarak tablet genişliğidir ve pencereyi ekranın tamamı yapar; kullanıcı
pencerede mi sayfada mı olduğunu ayırt edemez. Kalıp:
`sm:max-w-[min(48rem,calc(100%-2rem))]`.

## MOBIL-7 — Tabloda sütun önceliklendirilir, kart markup'ı ÇOĞALTILMAZ.

`TableHead`/`TableCell` varsayılanı `whitespace-nowrap`tır; 8–10 sütunlu bir
liste telefonda ekranın 2–4 katına çıkar. Düşük öncelikli sütunlara **hem
`th` hem `td` üzerinde** `hidden md:table-cell` verilir, gizlenen bilgiden
kritik olanı birincil hücrenin içinde `md:hidden` ikinci satır olur. İkinci
bir kart markup'ı yazmak sıralama/seçim mantığını ikiye böler ve zamanla
ayrışır.

**SÜTUN GİZLEMEK YETMEZ: ESNEK SÜTUN KELEPÇELENİR** (kullanıcı bildirimi,
12.08.2026 — Satış Takibi). Tablo düzeni `auto`dur ve bir hücrenin EN DAR
hâli metninin tamamı kadardır; `whitespace-nowrap` taşıyan genişlik sınırsız
bir sütun, tek bir uzun kayıt yüzünden tabloyu ekranın dışına iter. Ürün adı
gibi UZUNLUĞU VERİDEN GELEN her sütun bu yüzden `max-width` + `truncate`
taşır ve tam metni `title` ile verir. `max-w-full` bu işi GÖRMEZ — kabın
kendisi zaten büyüyor. Sınır tek bir sabit değil kırılım kırılım açılır
(`md:max-w-[16rem] … 2xl:max-w-[34rem]`): tek değer ya geniş ekranda yeri
boşa harcar ya dar ekranda hâlâ taşırır. Kırpma `md`den başlar; telefonda
metin SARAR, çünkü orada kırpılmış metni okutacak bir fare yoktur.

## MOBIL-8 — Yatay kaydırma varsa GÖRÜNMELİDİR.

Mobil tarayıcı kaydırma çubuğu
çizmez; kullanıcı sağda sütun olduğunu bilmez. `globals.css`teki
`.oc-scrollx` yardımcısı `background-attachment: local/scroll` ikilisiyle
yalnız o yönde içerik varken kenar gölgesi gösterir, sona gelince söner
(JS yok). Zemin rengi `--oc-scroll-bg` ile verilir, varsayılanı `--card`.

## MOBIL-9 — Diyagram küçülmez, kaydırılır.

`DiagramSvg` `minWidth = diagram.width`
taşır. Ölçü yazıları 7–9,5 tuval biriminde çizilir: 700 birimlik bir
diyagram telefon sütununa sığdırılınca kot ~3,9 px'e iner ve bu resimler
PDF'e giden modelin ta kendisidir — mühendis ekranda gördüğünü doğrulayamaz.

## MOBIL-10 — Kart iç boşluğu telefonda bir kademe kısılır

(`--card-spacing`
16px → ≥640px'te 24px). 375px'lik ekranda 48px'lik yatay dolgu içeriğin
%14'ünü yiyordu.

## MOBIL-11 — İçerik metninde 11px altına inilmez.

`text-[9px]`/`text-[10px]` yalnız
salt dekoratif işaretlerde kabul edilebilir; sayısal rozetler ve etiketler
en az `text-[11px]`dir.

## MOBIL-12 — Sayfa eylemleri `lg` altında KENDİ SATIRINDADIR.

Üst şeride
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

## MOBIL-13 — Her sayfanın görünür bir üst sayfa dönüşü vardır.

`PageHeader`, açık URL'nin son parçasını çıkararak varsayılan üst adresi üretir;
`/personnel/…` Personel'e, ana bölüm de Panel'e döner. URL ağacı gerçek iş
hiyerarşisi değilse (hesap revizyonu → proje gibi) sayfa açıkça `backHref`
verir. Geri oku bütün ekran genişliklerinde görünür: kırıntı yolu bağlamı,
ok ise eylemi taşır. Sayfa kendi kırıntı satırını da çiziyorsa o satır `xl`
altında gizlenir (ikisi yinelenmesin).

**Bir ekranda YALNIZ BİR `PageHeader` olur.** İkisi aynı yuvaya yazar ve
ikisi birden çizilir — iç içe düzenlerde başlığı yalnız tek bir katman
basar. Sayfanın kendi büyük başlığı `h2`dir; `h1` üst şerittedir.

## MOBIL-14 — `overflow-x` veren kap `overflow-y`yi de kaybeder.

CSS'te bir eksende
görünürlükten çıkan taşma diğerini `visible` bırakamaz, kendiliğinden
`auto` olur. Yani `.oc-scrollx` gibi yatay kayan bir şeritte TEK PİKSELLİK
dikey taşma gerçek bir dikey kaydırma çubuğu doğurur — Windows'ta ok
düğmeleriyle birlikte, ve kullanıcı onu bir arıza olarak bildirir (proje
sekme rayı, 11.08.2026).

İki kaynağı vardı ve ikisi de kuraldır: (a) aynı şeritteki öğeler dikey
ölçüyü TEK bir sabitten almalıdır (`min-h-9` taşıyan bir bağlantı ile
dolgudan boy alan bir sekme aynı satırda duramaz), (b) alt çizgiyi `-mb-px`
ile ezmek yerine `border-b`yi İÇ GÖLGEYE çevirin
(`shadow-[inset_0_-1px_0_var(--border)]`) — gölge dolgu kutusunun içine
boyandığı için aktif sekmenin çizgisi negatif kenar boşluğu olmadan onun
üstüne oturur. `overflow-y-hidden` bir çözüm değil emniyet kemeridir:
taşmayı kırpar, sebebini gidermez ve `.oc-tap` gibi kutu dışına taşan
dokunma katmanlarını da keser.

## MOBIL-15 — Telefonda ANA TABLO yatay kaymaz — listeye katlanır

(kullanıcı kararı,
16.08.2026: *"mobilde yatayda kaydırma olmasın; uygulama gibi
davranmasını isterim"*; Satın Alma'da uygulandı, yeni ekranlar da uyar).
Kural 7'nin uç hâlidir ve kart markup'ı yine ÇOĞALTILMAZ: `sm` altında
yalnız birincil sütun + durum/tutar kalır, kritik bilgi birincil hücrede
`sm:hidden` alt satırlara iner. İki yerde okunan öğe (teklif düğmesi, iş
no özeti) TEK değişkende/bileşende kurulur — iki yazım, birinde düzeltilen
etiketin ötekinde kalması demektir. `.oc-scrollx` kabı KALIR (tablet ara
genişlikleri hâlâ taşabilir; kural 8 orada geçerlidir). Ölçüt: 375px'te
kabın `scrollWidth === clientWidth`. İstisnalar gerekçelidir: diyagramlar
(kural 9), grafikler, yetki matrisi ve teklif karşılaştırma matrisi gibi
doğası yatay artefaktlar içte kaymaya devam eder.

İki CSS tuzağı ÖLÇÜLDÜ (16.08.2026) ve katlama yaparken bilinmek zorunda:
- `truncate`/`whitespace-nowrap` bir tablo sütununun MIN-CONTENT genişliğini
  TAM metne kilitler; `break-words` (`overflow-wrap: break-word`) bunu
  KÜÇÜLTMEZ. Telefonda daralması gereken serbest metin hücresi
  `whitespace-normal` + `max-sm:[overflow-wrap:anywhere]` taşır — ve
  `TableCell` varsayılanı nowrap olduğundan sınıf HÜCRENİN KENDİSİNE
  yazılır, yalnız içteki span'a değil (miras kalan nowrap çip satırını
  yine kilitliyordu).
- Kırılım sınıfı başlıkta değişen sütunun HÜCRESİ ve TOPLAM/altbilgi
  hücresi de AYNI sınıfı taşımalıdır; ayrışırsa telefonda sütunlar kayar
  ve tablo taşar (ücret planında yaşandı). Sarmalı süzgeç şeritlerinde iç
  gruplar da `flex-wrap` olmalı — dış kap sararken `shrink-0` tek parça
  küme sayfayı yine taşırır.

## MOBIL-16 — Tablo yatayda SIĞAR: esnek sütun kelepçelenir, sabit sütun çivilenir

Kullanıcı bildirimi (20.08.2026, Mühendislik listesi): *"listede isimlerin çok
uzun olma problemini çözer misin… satır yüksekliği ve sütun genişlikleri bu
kadar büyümesin… tablo her zaman yatayda sayfaya sığsın, yatay kaydırma
olmasın."* Kural 7'yi (esnek sütun kelepçelenir) tamamlar; ölçümler
`/dev/projects-preview` üzerinde gerçek satırlarla alındı.

**`max-width` bir tablo hücresinde TAVAN DEĞİL TABANDIR.** Ölçüldü: `td`ye
`max-width: 384px` verilen sütun 1920px'lik ekranda 525px'e kadar BÜYÜDÜ, ama
1024px'lik ekranda 384px'in altına inmedi. Yani değer sütunun içsel EN DAR
hâlini belirler; geniş ekranda sütun yine artan yeri alır ve metin o genişliğe
kadar okunur. İki sonucu vardır:
- Kelepçe **kırılım kırılım açılmak zorunda değildir** — tek ve DAR bir değer
  yeter (kural 7'deki `md:…2xl:` merdiveni, kelepçe içteki bir `span`a
  yazıldığında gerekir; orada blok gerçekten tavan olur ve geniş ekranda ad boş
  yerin ortasında erkenden kesilir).
- Kelepçe **hücrede**, kırpma **içteki blokta** durur. Blok hücrenin o anki
  genişliğinin tamamını kullanır, kelepçe ise sütunun tabanını verir.

**SABİT İÇERİKLİ SÜTUN `w-px` İLE ÇİVİLENİR.** Artan yer bütün sütunlara
oransal dağılır: kelepçeli sütunlar dolduktan sonra "0063" taşıyan İş No sütunu
1920px'te 83px'ten 114px'e şişiyor ve o yeri proje adından çalıyordu. `w-px`
içeriğin min-content'inin altına inemez — sütun en dar hâline oturur, artan yer
esnek sütunlara kalır.

**EN DAR KAP HER KIRILIMDA AYNI DEĞİL — `lg`, `md`den DARDIR.** Kenar çubuğu
(`hidden lg:flex`, 15rem) tam 1024px'te belirir ve içeriği bir anda daraltır:

| pencere | kap | not |
|---|---|---|
| 375px | 351px | kenar çubuğu yok |
| 768px | 736px | kenar çubuğu yok |
| **1024px** | **703px** | kenar çubuğu belirdi, kap **daraldı** |
| 1280px | 962px | |
| 1920px | 1602px | |

Sütun sayısını `lg`de artırmak bu yüzden TERS TEPER. Mühendislik listesinde
sekiz sütunun yalnız BAŞLIKLARI 674px tutuyor; 1024px'te veriye 29px kalıyordu.
Müşteri ve Vinç Tipi bu yüzden `lg`de değil `xl`de açılır. Yeni sütun eklerken
sınanacak pencere 1024'tür, 1920 değil.

**ÖLÇÜT** (kural 15'in genişletilmişi): kabın `scrollWidth === clientWidth`i
375 · 320 · 640 · 767 · 1023 · 1279 · 1535 · 1920'de sağlanır ve `md` üstünde
bütün satırlar AYNI yükseklikte olur (Mühendislik'te 49px). Satır boyunu tek bir
`min-h-9` bile bozar — dokunma payı kural 1'e göre `.oc-tap` ile verilir.

## MOBIL-17 — Sidebar daralınca bölüm ikonları büyümez.

Kullanıcı kararı (20.08.2026): sol menünün geniş ve dar hâli yalnız yerleşimi
değiştirir; bölüm ikonlarının ölçüsü iki hâlde de **16 × 16 px** kalır. Etiketin
gizlenmesi ikonu büyütme gerekçesi değildir; büyüyen ikonlar görsel ritmi bozup
dar menüyü ayrı bir ikon takımı gibi gösteriyordu. Daralt/genişlet düğmesinin
ikonu da aynı ölçü sözleşmesine uyar.

## MOBIL-18 — KIRPAN KAP AYNI ZAMANDA KAPSAYICI BLOK OLMALIDIR (`relative`).

Kullanıcı bildirimi (22.08.2026, md. 11): *"Maliyetler sayfasında kayma var.
Hem çift scrol var hâlâ. Hem de ana scrol aşağı çektiğinde sayfa bozuluyor."*

Kök neden ÖLÇÜLDÜ ve şaşırtıcıdır: `overflow: hidden` (ya da `auto`) KONUMLANMIŞ
bir çocuğu ancak o çocuğun KAPSAYICI BLOĞU ise kırpar. Maliyet sayfasındaki
satır tablosu her grupta bir `sr-only` metin taşıyordu ("Birim fiyatlar €
cinsindendir") ve Tailwind'in `sr-only`si `position: absolute`tur. Kaydırma
kabı da, `main` de KONUMSUZ olduğu için o `span`ların kapsayıcı bloğu
BAŞLANGIÇ KAPSAYICI BLOĞUYDU: kırpmadan kaçıyor, sayfayı kendi statik
konumlarına kadar uzatıyorlardı.

Ölçüm (1920 × 960, çerçeve kipi, Maliyetler bölümü):

    düzeltmeden önce : html.scrollHeight 3246 · belge 2286 px kayıyor · 2 kaydırıcı
    düzeltmeden sonra: html.scrollHeight  960 · belge  0 px kayıyor · 1 kaydırıcı

Boşlukta hiçbir şey ÇİZİLMİYORDU — "aşağı çekince sayfa bozuluyor" tam olarak
budur. Düzeltme iki katmanlıdır: kaydırma kaplarına (`cost-editor`,
`offer-editor`, `revision-editor`) ve kabuğun `main`ine `relative`. İkincisi
yapısal bir güvencedir: yarın eklenecek başka bir konumlanmış çocuk da orada
kırpılır.

**Kural:** `overflow-hidden`/`overflow-y-auto` veren her kap `relative` de
almalıdır. Aksi hâlde kırpma bir DİLEKTİR, garanti değil.

## MOBIL-19 — TABLET OPERASYON TABLOSU DA KARTTIR; MATRİS DEĞİLDİR.

Kullanıcı kararı (23.08.2026): mobilde uygulanan düzenli işlem yüzeyi tablet
görünümüne ve bütün ana bölümlere de taşınır. 768–1023 px aralığında seçme,
genişletme, düzenleme veya durum değiştirme taşıyan satırlar
`oc-tablet-table` ile karta katlanır; satırın adı ile eylemi aynı görünümde
kalır ve iç yatay kaydırma kullanılmaz. `data-label`, `data-mobile-span` ve
tek tablo işaretlemesi korunur; ayrı bir tablet bileşeni yazılmaz.

Bu kural gerçek matrisleri, dönem eksenli karşılaştırmaları, grafikleri ve
teknik çizimleri kapsamaz. Bunlar genişlik bilgisini kaybedemez; kendi
`oc-scrollx` kabında ve görünür kenar ipucuyla kayar. Sayfanın kendisi hiçbir
koşulda yatay kaymaz.

## MOBIL-20 — MOBİL MENÜ AÇICI BİR MARKA DÜĞMESİDİR.

Kullanıcı kararı (24.08.2026): dar ekranda uygulamanın ana gezinmesini açan
üst-sol düğme nötr hamburger değildir; **Orion kırmızısı** yüzey üzerinde
**beyaz Orion sembolü** taşır. Renk elle HEX yazılmaz, koyu temada mercana
açılmayan menü marka değişkenleri `bg-sidebar-primary` ve
`text-sidebar-primary-foreground` üzerinden okunur. Sembol mevcut vektör
varlıktan (`/brand/orion-symbol-white.svg`) gelir; yeniden çizilmez.

Görsel kutu 40 × 40 px ve köşelidir; `.oc-tap-square` kaba işaretleyicide
dokunma hedefini 44 × 44 px'e tamamlar. Sembol dekoratiftir (`alt=""` /
`aria-hidden`), düğmenin erişilebilir adı hâlâ eylemi söyler: “Menüyü aç”.

## MOBIL-21 — BÖLÜM İÇİ GEZİNME AÇILIR LİSTE DEĞİL, GÖRÜNÜR KUTU IZGARASIDIR.

Kullanıcı kararı (24.08.2026): mobilde sayfa ya da editör bölümü değiştiren
seçimler bir açılır listenin arkasına saklanmaz. Bütün hedefler aynı anda
görünen, yan yana kutulardır; sayfa gezinmesi `MobileRouteGrid`, aynı editör
içindeki panel seçimi `MobileSectionGrid` ile kurulur. Aktif kutu kırmızı
çerçeve, hafif kırmızı zemin ve iç alt çizgiyle belirginleşir. Rota bağlantısı
ve panel düğmesi `aria-current="page"` taşır.

Izgara 320–359 px'te iki sütundur. Beş-altı hedef 360 px'ten itibaren üç
sütun × iki satıra yerleşir; daha yoğun Yönetim, Satın Alma ve Teklif
gezintileri gereken kadar doğal satır açar. Kutular en az 44 px yüksekliğinde,
metinleri ortalı ve kırılabilir olur. Yatay kaydırma ve `whitespace-nowrap`
kullanılmaz. `md` ve üstünde mevcut masaüstü rayları korunabilir; Yönetim
rayının masaüstü eşiği `lg`dir.

**KUTU IZGARASI PANEL SEÇİMİNİNDİR, BELGENİN BÖLÜMLERİNİN DEĞİL.** Kural
hedeflerin hepsi bir ekranda görünebildiği sürece geçerlidir: SEKİZ ya da daha
az çalışma yüzü (Harita · Belge · Kâğıt gibi) `MobileSectionGrid`te kalır ve bu
bir istisna değil kuralın TANIMIDIR. Bir BELGENİN bölümleri buna girmez —
yirmi bir modülü ya da yüz on yedi adımı yan yana kutuya dizmek ızgarayı
ekranın iki katı yapar ve kullanıcı içeriğe ulaşmak için her seferinde onu
geçmek zorunda kalır; kuralın kaçındığı gizlenmenin daha kötüsü budur (hesap
editöründe ölçüldü: başlık + arama + liste ≈ 350 px). Sekizden çok bölümü olan
belge ekranı BÖLÜM RAYINI kullanır (MOBIL-29).

Ray bir AÇILIR LİSTE DEĞİLDİR ve fark ölçülebilirdir: açılır kutu kapalıyken
HİÇBİR bilgi taşımaz; ray kapalıyken de sayfanın sol kenarında sürekli görünür,
kaç bölüm olduğunu, kaçıncısında bulunulduğunu ve hangisinde kontrol kaldığını
çentikleriyle söyler.

Bu kural yalnız **adres/panel gezinmesine** aittir. Yıl, müşteri, para birimi,
durum, malzeme gibi veri ya da süzgeç seçen `Select` alanları açılır liste
olarak kalır; onları kutu ızgarasına çevirmek bilgi mimarisini bozar.

## MOBIL-22 — TABLO SÜZGEÇLERİ TELEFONDA ÜÇLÜ IZGARADIR.

Kullanıcı kararı (24.08.2026): tablo süzgeçleri 360–375 px telefonda yatayda
üç kutu taşır; arama alanı gerektiğinde üç sütunun tamamını kaplar. Ortak
`FilterBar` çocuklarına mobilde `min-width: 0` ve tam hücre genişliği verir.
`SelectValue` ile çoklu süzgeç etiketi dar hücreyi büyütmez; tek satırda
üç noktayla kırpılır ve tam metin seçenek listesinde kalır. Süzgeç yüzeyi
sayfaya yatay kaydırma ekleyemez.

## MOBIL-23 — ÖZET VE OPERASYON KARTLARI BİLGİYİ KAYBETMEDEN YOĞUNLAŞIR.

Mühendislik, Teknik Resimler ve Satış'ın üst özetleri telefonda tek sıradır.
`StatCard.responsiveCompact` mobilde ikonu ve ikincil ipucunu kaldırır, etiketi
ve değeri üç noktayla sınırlar; `sm` üstünde normal kart ritmi geri gelir.
Operasyon tablolarında `oc-compact-mobile-table`, satın alma tablolarında ek
olarak `oc-purchasing-table` kullanılır. Bu sınıflar hücreyi silmez; yalnız
kart dolgusu, satır aralığı ve etiket boyunu azaltır.

## MOBIL-24 — HESAP EDİTÖRÜNÜN ALT ÇUBUĞU TEK SATIRLIK KUMANDADIR.

Hesap raporu editöründe telefon alt çubuğu ekranın altında yapışkan kalır ve
tek sırada Önceki · bölüm seçici · Kaydet · Sonraki denetimlerini taşır. Bölüm
seçici BÖLÜM RAYININ tabakasını açar (MOBIL-29); ayrı bir gezinme kopyası
oluşturmaz. 01.09.2026'ya kadar bu bir ALT tabakaydı ve yalnız `lg` altında
vardı; artık her genişlikte aynı soldan açılan tabakadır — düğmenin `lg`
üstünde etkisizleştiren `pointer-events-none` sınıfı da o yüzden kalktı.
İlerleme çizgisi kumandaların üst kenarındaki 2 px banttır. Dar ekranda geri ve
ileri metni saklanır ama erişilebilir adları korunur; çubuk yatay kaymaz.

## MOBIL-25 — PDF PAYLAŞIMININ VARSAYILANI GERÇEK DOSYADIR.

Mobil PDF bağlantısı belgeyi önce `application/pdf` türünde gerçek bir `File`
olarak indirir. Paylaş eylemi yalnız tarayıcı `navigator.canShare({ files })`
ile bu dosyayı açıkça kabul ediyorsa gösterilir ve “PDF Paylaş” diye adlandırılır.
Yalnız `navigator.share` bulunması dosya desteği sayılmaz; aksi hâlde bazı
WebView'lar `files` alanını atıp açık sayfanın bağlantısını gönderebilir.

## MOBIL-26 — ÇOK PANELLİ EDİTÖRDE SABİT SÜTUN TOPLAMI `lg` KABINA SIĞMALIDIR.

Kullanıcı bildirimi (01.09.2026) ve ölçüm: El Kitabı editörü
`lg:grid-cols-[280px_minmax(0,1fr)_320px]` veriyordu. Kenar çubuğu (15 rem) tam
1024 px'te belirir ve MOBIL-16'nın tablosuna göre içerik kabını **703 px**'e
indirir; 280 + 320 + 32 px boşluk = 632 px SABİT ayrıldığı için belgenin
kendisine **71 px** kalıyordu. Yani panel sayısını `lg`de artırmak MOBIL-16'nın
"sütun sayısını `lg`de artırmak ters teper" maddesinin editör hâlidir.

**Üç panel `xl`den (1280 px) başlar.** `lg` iki sütundur (ağaç + belge) ve
üçüncü panel oradan bir TABAKAYA iner. Ölçüt: 1024 px'lik gerçek kapta
(703 px) orta sütun ≥ 380 px. Düzeltmeden sonra ölçülen: **447 px**.

**PANELİ `hidden` İLE SAKLAMAK ÇÖZÜM DEĞİLDİR.** Soru CSS'le sorulamaz çünkü
cevabı yerleşim değil MONTAJ değiştirir: aynı ağır paneli (A4 önizlemesi yirmi
yaprak çizer) iki yere birden basıp birini gizlemek bedeli iki katına çıkarır.
Kırılım JS'te sorulur — `lib/use-breakpoint.ts` (`useIsWide`, `useIsDesktop`);
sunucuda ve ilk karede DAR düzen varsayılır, hidrasyon uyumludur.

## MOBIL-27 — BELGE ÖNİZLEMESİ KÜÇÜLMEZ, KAYDIRILIR.

MOBIL-9'un (diyagram) belge karşılığıdır. `ManualPaper` A4'ü
`containerType: inline-size` + `cqw` ile kabın genişliğine ORANTILI çizer:
360 px'lik bir sütunda 8,5 pt'lik gövde yazısı ~5 px'e iner. Bu yaprak PDF'e
giden dağıtımın TA KENDİSİDİR (KITAP-19) — mühendis ekranda okuyamadığı bir
şeyi doğrulayamaz. Dar ekranda okunur bir taban genişlik çivilenir
(`min-w-[40rem]`) ve kap `.oc-scrollx` ile yatayda kayar.

**KAYDIRMA KABI YÜKSEKLİK ALMAK ZORUNDADIR.** `PaperPanel`in kaydırıcısı
`flex-1 overflow-y-auto` taşıyordu ama kök `grid content-start` olduğu için
IZGARA ÇOCUĞUNDA `flex-1` etkisizdir: kap hiç yükseklik almıyor, `scrollTo`
sessizce hiçbir şey yapmıyordu — "seçili bölümün yaprağına git" davranışı dar
ekranda HİÇ çalışmadı. Kök esnek sütundur ve ÇAĞIRAN kaba açık bir `max-h`
verir.

## MOBIL-28 — `.oc-tap` GİRDİDE ÇALIŞMAZ; ORADA HEDEF GERÇEK YÜKSEKLİKTİR.

`<input>`, `<textarea>` ve `<select>` YER DEĞİŞTİRİLMİŞ öğelerdir ve
`::before`/`::after` ÜRETMEZLER — görünmez 44 px genişletici hiç çizilmez.
MOBIL-1 zaten yalnız düğme, çip, rozet-düğme ve ikon bağlantısını sayar.
Girdide dokunma payı GERÇEK yükseklikle verilir; `h-8 pointer-coarse:h-10`
gibi bir kademe DOĞRUDUR ve MOBIL-1 ihlali DEĞİLDİR. Aynı sebeple
`<input type="range">` tek başına dokunmatik bir denetim sayılmaz: yanına ön
ayar düğmeleri konur.

**`.oc-tap-square` YAN YANA İKON DÜĞMELERDE KOMŞUNUN DOKUNUŞUNU YUTAR.**
`.oc-tap` yalnız dikey büyür (`left:0;right:0`), kare sürüm iki eksende de
büyür: 24–28 px'lik düğmeler 2 px boşlukla dizilince 44 px'lik hedefler üst
üste biner. Çözüm düğmeyi küçültmek değil SAYISINI azaltmaktır — seyrek
kullanılanlar bir `DropdownMenu` altına iner (el kitabında blok şeridi yedi
düğmeden üçe indi).

**`.oc-scrollx` TEK BAŞINA KAYDIRMAZ**: yalnız kenar ipucunu çizer ve
(MOBIL-18 gereği) kapsayıcı blok olur. Kap `overflow-x-auto` almazsa içerik
taşar ve SAYFAYI iter.

## MOBIL-29 — BÖLÜM RAYI: ÜÇ KİPLİ TEK LİSTE (ŞERİT · TABAKA · SABİT SÜTUN).

Ortak bileşen `src/components/bolum-rayi.tsx` (`BolumRayi`); hesap raporu,
teklif, maliyet, el kitabı, personel profili, Vinç Kimliği ve açılış panosunun
bölüm gezinmesi ONDAN gelir. Dört ayrı kopyanın (13rem'lik teklif sütunu,
11rem'lik maliyet sütunu, hesap raporunun gömülü rayı, el kitabının belge
haritası) yerine geçti.

| genişlik | kapalı | açık |
|---|---|---|
| <1440 px | 1 rem şerit | TABAKA — `absolute` + örtü + `useOverlay`, modaldır |
| ≥1440 px | 1 rem şerit | SABİT SÜTUN — akışta, 17,5 rem, örtü YOK, modal DEĞİL |

**AYNI LİSTE İKİ KEZ MONTE EDİLMEZ** (MOBIL-26): sabit sütun ile tabaka aynı
düğümdür, yalnız konumu ve genişliği değişir. Kırılım JS'te sorulur
(`useRaySabitlenebilir`, `lib/use-breakpoint.ts`), `hidden` sınıfıyla değil.

**EŞİK 1440'TIR, 1280 DEĞİL.** El kitabı `xl`de üçüncü paneli de basıyor
(19 rem). 1280'deki 962 px'lik kapta 260 px'lik sabit bir ray belgeye
962 − 260 − 304 − 32 = **366 px** bırakırdı ve MOBIL-26'nın ≥380 px ölçütü
düşerdi. Ölçülen: 1440'ta el kitabının belge sütunu **745 px**. Sayı iki yerde
yazılıdır — `RAY_DOCK_MQ` ve CSS'teki karşılığı; ayrışırlarsa sütun CSS'te
açılıp JS'te kapalı sanılır.

**TERCİH "DARALTILDI" OLARAK SAKLANIR, "AÇIK" OLARAK DEĞİL**
(`orion.<alan>.ray.daraltildi`). `useStoredFlag`in sunucu anlık görüntüsü
`false`tur ve geniş ekran varsayılanı AÇIKtır; ters isimlendirilseydi ilk kare
her seferinde yanlış çizilirdi. Anahtar verilmeyen sayfa hiçbir genişlikte
sabitlenmez.

**ALT BAŞLIKLAR YALNIZ SABİT SÜTUNDA** (`BolumOgesi.cocuklar`). Dar ekranda
kullanıcının kararı değişmedi (01.09.2026): *"bölüm + alt başlık olmasın,
sadece bölüm olsun. çok alt başlık var, çok yer kaplıyor."* Şerit çentikleri ve
tabaka listesi TEK DÜZEYDİR. Alt düzey kaybolmaz, ARAMAYA da taşınır: arama
sonucu düz bir listedir (`arama.sonuclar`), ikinci bir düzey değil.

Sabit sütundaki grup davranışı eski raydan birebir gelir: bir grup **açıktır**
ancak `!gizli && (arama var || aktif satır o grupta || elle açıldı)`; yani
**bulunduğun grup her zaman açıktır ve onu kapatmak etkisizdir**. Ok ile ad AYRI
düğmelerdir — ok açar/kapatır, ad bölümün kendisine götürür. Grup açıklığı
KALICI DEĞİLDİR. Girinti `ml-3.5 border-l border-border/70 pl-2`.

**DURUM RENKLE DEĞİL GEOMETRİYLE ANLATILIR.** `--primary` (oklch 0.467 0.17 27)
ile `--destructive` (0.516 0.167 26) BİR DERECE arayla aynı kırmızıdır
(globals.css); 16 px'lik bir çentikte ayırt edilemezler. Üç genişlik kademesi
kullanılır — aktif tam genişlik **ve iki kat boy**, uyarı 2/3, nötr 1/3 — yani
aktifi ayıran BOYDUR, renk yalnız uyarıyı griden ayırır.

**ÇENTİKLER AYRI DOKUNMA HEDEFİ DEĞİLDİR.** Yirmi bir çentik 700 px'lik bir
şeritte ~30 px'e denk gelir ve `.oc-tap` üst üste dizili kardeşlerde komşunun
dokunuşunu yutar (MOBIL-28). Şeridin TAMAMI tek düğmedir; çentikler
`aria-hidden`dır ve bilgi düğmenin `aria-label`ındadır ("Hesap bölümleri —
7/21: Ana Kiriş").

**GENİŞLİK SATIR İÇİNDE VE ÜÇ EKSENDE VERİLİR** (`width`/`minWidth`/`maxWidth`,
kabuğun kenar çubuğunun kalıbı). İki sebebi var: `globals.css` bütün kaplara
`min-width: 0` veriyor, ve Tailwind'in keyfi değeri (`w-[17.5rem]`) burada
ÜRETİLMİYORDU — sınıf yazılıydı ama hesaplanan genişlik 16 px kalıyordu.

**GENİŞLİK GEÇİŞİ YOKTUR.** Şerit ↔ sütun AYRIK bir durum değişimidir. Geçiş
denendi ve animasyon karesi ateşlemeyen bağlamlarda (arka plan sekmesi, gizli
panel) genişlik BAŞLANGIÇ değerinde asılı kalıyor, sütun 16 px çizilip içeriğin
üstüne biniyordu. Marka dili de ekran yüzeylerinden animasyonu zaten sökmüştü.

**RAY NEGATİF KENAR BOŞLUĞU TAŞIMAZ.** Sayfa kabukları dolgusuzdur; `-ml-6`
şeridi padding kutusunun dışına atar ve kırpılır.

**ŞERİT DAR EKRANDA `fixed`, GENİŞ EKRANDA `sticky`.** Dar ekranda kabuk kenar
çubuğu yoktur ve şerit ekranın gerçek kenarına oturmalıdır; akıştaki 1 rem'lik
sütun yerini korur ki içerik şeridin altına kaymasın. Geniş ekranda `fixed`
üçünün üstüne binerdi: revizyon ekranlarında kabuk menüsü zaten 4,5 rem'lik dar
bir raydır, uygulamada `sticky left-0` ile çivilenmiş tablo sütunları vardır ve
sabit çerçeve rotalarında `main` `lg:overflow-hidden`dır.

**TABAKA KAPALIYKEN BASILMAZ.** Eski ray kapalı listeyi `translate-y-full` ile
ayakta tutuyor, 117 görünmez düğmeyi Tab sırasından çıkarmak için `inert`
yazmak zorunda kalıyordu. Davranış (gövde kilidi · Esc · odak tuzağı · odağı
geri verme) `useOverlay`den gelir; Radix `Dialog` KULLANILMAZ. **Sabit sütun
modal DEĞİLDİR**: örtü yok, gövde kilidi yok, Esc kapatmaz.

**İKİNCİL EYLEM SATIRDA KALIR** (`BolumOgesi.sag`): teklifin göz düğmesi,
hesabın modül ＋/－ anahtarı, panonun gizle/katla ikilisi. Kapalı bir bölümü
yalnız kendi satırından geri açabilirsin.

**ÇIPA KİPİ AYRIDIR** (`lib/bolum-capa.ts`). Anahtarlamalı editörlerde seçim
bir durum değişimidir; uzun kaydırmalı sayfalarda (personel profili, açılış
panosu, Vinç Kimliği `lg` üstünde) gerçek bir kaydırmadır. Hedef `.oc-capa`
taşır — `scroll-margin-top: calc(var(--app-header-h) + 0.75rem)`, 48 px
VARSAYILMAZ. Üç ölçülmüş tuzak: (1) tabaka kapanırken `useOverlay`in gövde
kilidi hâlâ duruyorsa `scrollIntoView` SESSİZCE hiçbir şey yapmaz; (2) bekleme
`setTimeout` iledir, `requestAnimationFrame` ile DEĞİL — sekme arka planda ya da
gizliyken rAF ve `IntersectionObserver` HİÇ ateşlemez; (3) aynı sebeple seçilen
bölüm ELLE de işaretlenir (`useAktifCapa`in ikinci dönüş değeri). Kimlik
üreticisi SAF bir modüldedir (`lib/bolum-capa-kimlik.ts`) çünkü sunucu
bileşenleri de çıpa sarmalayıcısı basıyor ve `"use client"` sınırının
ötesindeki bir işlevi çağıramazlar.

## MOBIL-30 — SAYFA KABUĞU `overflow-x-clip` KULLANIR, `overflow-x-hidden` DEĞİL.

MOBIL-14'ün doğrudan sonucu ve ölçülmüş bedeli: `overflow-x: hidden` verilen kap
`overflow-y`yi de `auto` yapar, yani bir KAYDIRMA KABI olur. Sayfa kabuklarının
yüksekliği `auto` olduğu için o kap hiç kaymaz — ve içindeki hiçbir `sticky`
çocuk YAPIŞMAZ. Aynı kapta ölçülen üst konum: `visible` → 48 px · **`hidden` →
−496 px** · `clip` → 48 px. Hesaplanan `overflow-y`: `hidden` altında `auto`,
`clip` altında `visible`.

`clip` yatay kırpmayı (MOBIL-15'in güvenlik kemeri) aynen sürdürür ama kaydırma
kabı YARATMAZ. On üç sayfa kabuğu (`admin` · `jobs` · `jobs/[id]` · `offers` ·
`panel` · `personnel` · `projects` · `projects/[id]` · `audit` · `compare` ·
`revisions/[revId]` · `sales` · `worklog`) ve kabuğu taklit eden iki
`/dev/*-preview` bu yüzden `clip`e geçirildi.

**TABLO VE PENCERE İÇİ `overflow-x-hidden` DOKUNULMAZ** — oralarda kırpma
bilinçlidir ve yapışkan bir çocuk yoktur (`offers-table`, `analiz-view`,
`lines-view`, `electrical-table`, `new-project-dialog`, `ui/select`,
`ui/dropdown-menu`, `ui/command`).

## MOBIL-31 — YAPIŞKAN ÖĞENİN SARMALAYICISI ESNEK SATIRDA `stretch` OLMALIDIR.

`position: sticky` yalnız SARMALAYICISININ kutusu içinde yol alabilir. Esnek bir
satırda `items-start` verilirse sarmalayıcı yapışkan çocuğun boyunda kalır, yol
sıfır olur ve yapışma SESSİZCE ölür — hata görünmez, öğe yalnız içerikle birlikte
kayıp gider.

Ölçüm (personel profilinin bölüm rayı, 1280 px): `items-start` ile sarmalayıcı
**752 px** (= yapışkan kutunun boyu), kaydırınca şeridin üstü 956 → **−544**.
Varsayılan `stretch` ile sarmalayıcı **1655 px**, üst 48'de kalıyor.

Kural: bölüm rayını (ya da başka bir `sticky` sütunu) taşıyan esnek satır
`items-start`/`items-center` ALMAZ. Dikey hizalama gerekiyorsa yapışkan olmayan
kardeşe `self-start` verilir, satırın tamamına değil.
