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
