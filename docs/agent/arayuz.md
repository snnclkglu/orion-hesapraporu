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

## MOBIL-13 — 1280px altında her derin sayfa `backHref` verir.

Kırıntı yolu
(`PageHeader.kicker`) yalnız `xl:inline`dir; altında geri oku onun yerini
tutar, yoksa kullanıcıda hiçbir "yukarı" bağlantısı kalmaz. Sayfa kendi
kırıntı satırını da çiziyorsa o satır `xl` altında gizlenir (ikisi
yinelenmesin).

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
