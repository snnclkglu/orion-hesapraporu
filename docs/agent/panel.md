# Açılış Panosu

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/panel.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/panel.ts` · `src/app/(app)/panel/**` · `src/app/(app)/page.tsx`

## PANEL-23 — AÇILIŞ PANOSU GİRİŞ SONRASI İLK EKRANDIR

(`/`, kullanıcı kararı
13.08.2026: *"login sonrası açılış sayfası yapalım … diğer sayfalara
geçişin yapılacağı bir giriş sayfası gibi kurgulansın"*). Adres KÖKTÜR;
giriş bir yönlendirme zinciri (`/` → `/panel` → …) kurmaz — her oturumda
fazladan bir gidiş-dönüş eder ve geri tuşunu kırardı. Sayfa `(app)`
grubundadır, yani kabuğu ve yetki kapısını diğer bölümlerle paylaşır.

**GİRİŞ ADRESİ TEK SABİTTİR: `LANDING_PATH`** (`lib/roles.ts`; kullanıcı
bildirimi 16.08.2026: *"uygulamaya girişin Panel sayfasından olmasını
istiyorum, mobilde ilk açılışta mühendislik sayfası geliyor"*). Adres ÜÇ
kapıda elle yazılıydı ve ikisi panodan önceki dünyada kalmıştı — proxy'nin
"oturumu var ama `/login`de" dalı ve kabuktaki MARKA bağlantısı `/projects`e
gidiyordu. Uygulamanın iki ayrı açılış adresi vardı; hangisinin çalıştığı
kullanıcının o anki çerez durumuna bağlıydı.

**HATA NEDEN TELEFONDA GÖRÜLDÜ:** giriş adımı orada çok daha sık
tekrarlanır ve giriş formu `router.replace` ile İSTEMCİ GEZİNMESİ
yapıyordu. O RSC isteği, `signInWithPassword`ün yazdığı çerezi bir an
ıskalayabilir: proxy isteği oturumsuz sayıp `/login`e döndürür, çerez
aradaki boşlukta yerine oturur ve ikinci turda kullanıcı "oturumu var ama
`/login`de" dalına düşerek panonun yanından geçip Mühendislik'e iner.
Yarısı hedefti, yarısı yarıştı; ikisi de kapatıldı — geçiş artık TAM SAYFA
yüklemesidir (`window.location.replace`, `replace` semantiği korunur ki
geri tuşu giriş formuna dönmesin).

Manifest `start_url`i zaten kökte (`/`); ana ekran kısayolu da panoya açar.
Koruma `roles.test.ts`tedir ve KAYNAK DOSYAYI okur (`terms.test.ts`
deseni): üç kapı da sabiti içe aktarmalı ve hiçbiri elle bir açılış adresi
yazmamalıdır — sabiti içe aktarmayan dosya, değişiklikten habersiz kalır.

**ARAMA SAYFANIN KAHRAMANIDIR.** Panonun sorusu "nereye gideceğim" değil
"hangi işe bakacağım"dır ve cevap çoğu zaman bir NUMARADIR (`0057`,
`0043-00-1000`, `ASTOR`). Bu yüzden arama bir köşe büyüteci değil ilk ve en
büyük öğedir; `Ctrl/⌘ K` ile her yerden odaklanır ve KISAYOL EKRANDA YAZAR
(görünmeyen kısayol, olmayan kısayoldur). PENCERE DEĞİLDİR: korunmuş bir
odağa ihtiyacı yok ve pencere arkasındaki panoyu kapatırdı.

**EŞLEŞME `trKatla` İLEDİR, `toLowerCase` DEĞİL.** Adlar BÜYÜK HARFLE
saklanıyor (md. 14), kullanıcı küçük yazıyor ve düz küçültme Türkçe'nin
noktalı/noktasız i ayrımını çözemez — "isdemir" yazan biri "İSDEMİR"i
bulamazdı. Tarayıcıda ölçüldü: `isdemir` · `ISDEMIR` · `İSDEMİR` üçü de
aynı satırı buluyor. Sorgu boşluklardan bölünür ve HER PARÇA TEK BİR
SATIRDA geçmek zorundadır; bu yüzden kalem satırının ipucuna müşteri de
yazılır, yoksa "astor pergel" hiçbir şey bulmazdı (bu da ölçüldü).

**PARÇA DEFTERİ ARAMAYA GİRMEZ** ve bu bilinçli bir sınırdır: defter
istemciye bütün olarak gider (süzme orada yapılır, her tuşta Frankfurt'a
gidilmez) ve bugün üç pakette 490 parça var — yirmi pakette on binleri
bulur, taşınamaz olurdu. Parçanın yerine ANA GRUP adları girer; atölyenin
aradığı zaten gruptur ve grup bulununca Parçalar ekranı bir tık uzaktadır.

**HİÇBİR SAYI UYDURULMAZ.** Sıfır sayan sinyal listeye GİRMEZ ("0 gecikme"
bir uyarı değil gürültüdür), okunamayan tablo panoyu DÜŞÜRMEZ (sayaç 0
olur), boş bölüm ne olduğunu yazar. Bildirim kutusu bir dönem BİLEREK
BOŞTU (defter yoktu, kutu yalan söylemiyordu); defter 17.08'de kuruldu ve
kutu artık GERÇEK satırları basar — aşağıdaki 17.08 bloğuna bak. Sinyaller
bildirim DEĞİLDİR: okunmaz, kapanmaz, birikmez; veriden türer ve sebebi
kalkınca kendiliğinden gider.

**YETKİ İKİ KEZ SORULUR.** RLS zaten keser ama kesilmiş bir sorgu BOŞ döner
ve ekranda "0 gecikme" gibi görünürdü — yani yokluk iyi haber sanılırdı.
Sorgu rol sorusundan geçmeden hiç çalışmaz ve o bölüm panoda hiç çizilmez.
Bölüm listesi `WORKSPACE_SECTIONS`ten okunur (menüyle TEK KAYNAK) ve pano
KENDİNİ listeden düşer.

**BÖLÜMLER KART IZGARASI DEĞİL DEFTER SATIRIDIR.** Eşit boyda
ikon+başlık+açıklama kartları bir sayfa yapısı değil bir dolgudur: sekiz
kart aynı ağırlıkta bağırır ve göz nereye bakacağını bilemez. Satır teknik
resmin antet tablosu gibidir ve CANLI BİR SAYI taşır ("62 iş · 4 aktif") —
o sayı ekranı bir başlatıcıdan bir duruma çevirir.

**TAKVIM IZGARASI YOK, YAKLAŞAN ŞERİDİ VAR** (kullanıcı kararı): bugünkü
veri yoğunluğunda ayın günlerinin çoğu boş kalırdı ve boş bir ızgara dolu
bir listeden az şey söyler. Şerit GEÇMİŞ tarihleri de alır — "termini üç
gün önce geçmiş", "yarın termin var"dan aciltir — ama pencere dar tutulur
(±30 gün): altı ay önce kapanmamış bir kayıt hatırlatma değil arşiv
sorunudur. Gün adı YALNIZ BİR HAFTA İÇİNDE kullanılır; "Perşembe" iki hafta
sonrası için de doğrudur ama okuyan onu BU haftanınki sanar.

**BUGÜN İSTANBUL SAATİYLEDİR** (`bugunIstanbul`). Vercel UTC'de koşar ve
`new Date().toISOString()` Türkiye'de gece 00:00–03:00 arasında bir önceki
günü verir; gecikme kıyası, "Bugün" bandı ve otuz günlük pencere o saatlerde
bir gün kayardı.

Çekirdek saftır ve testlidir (`lib/panel.ts` — eşleşme, sıralama, gün adı,
bantlama, sinyal süzgeci); okuma katmanı `(app)/panel/data.ts`, görünüm
`panel-view.tsx`, arama `panel-search.tsx`. Görünüm veriden AYRIDIR çünkü
`/dev/panel-preview` onu auth'suz basar ve iki kopya zamanla ayrışırdı.

**17.08.2026 — PANO NOTION-BENZERİ İŞ YÖNETİM MERKEZİNE BÜYÜDÜ** (kullanıcı
isteği: *"tüm kullanıcılara hitap edecek genel iyileştirmeler … Notion
gibi"*; dört tasarım kararı AskUserQuestion'la alındı: kişisel yapılacaklar
EVET, Son Hareketler TÜM ŞİRKET yalnız `job_events`, kişiselleştirme
KATLA+GİZLE, ödeme günleri ajandaya GİRMEZ). Yukarıdaki kararların HEPSİ
yerinde; üstüne gelenler:

- **AKIŞ MİMARİSİ:** kritik yol yalnız oturum+profil+tercihtir
  (`getSessionProfile` React `cache` ile İSTEK BAŞINA TEK profil sorgusu —
  kabuk ve sayfa aynı fonksiyonu çağırır). Her bölüm kendi Suspense
  sınırının arkasında kendi loader'ıyla akar (`panel/loaders.tsx`; veri
  `data.ts`te bölüm başına fonksiyon). Düşen bölüm `SectionError` basar —
  "okunamadı", "0 kayıt"tan AYRI bir hâldir ve yokluk iyi haber gibi
  gösterilmez. `(app)/loading.tsx` BİLEREK yok: bütün bölüm sayfalarını
  sarardı. Yerleşim ve bölüm sırası TEK dosyada: `panel-view.tsx` (veri-siz
  yuva çerçevesi; önizleme aynı yuvalara fikstür basar).
- **ARAMA DEFTERİ RSC YÜKÜNDEN ÇIKTI:** defter artık paylaşılan istemci
  deposundan gelir (`lib/command-index-store.ts`, `useSyncExternalStore`) —
  pano araması ve Ctrl+K paleti tek fetch'i paylaşır (`/api/command-index`),
  defter her ziyarette RSC'yle taşınmaz. Boşta (`requestIdleCallback`) ya da
  ilk odakta çekilir; hata durumu odakta YENİDEN dener.
- **BENİM GÜNÜM** bölgesi (`sections/my-day.tsx`): bana atanan açık görevler
  (kapatma MEVCUT `toggleTask` action'ından — ikinci yazma yolu açılmadı) +
  kişisel yapılacaklar + favoriler/son bakılanlar (recents cihazda kalır,
  sunucuya taşınmadı) + sana ait resimler. Bölge ızgarası loader'dadır:
  "hepsi boşsa çizilme" kararı veriyi gören yerde. ÖLÇÜLEN DERS: görev
  satırındaki iş bağlantısı tek başına 17px'ti — bağlantı artık başlık dâhil
  bütün gövdedir (39px), onay kutusu ayrı `.oc-tap-square`.
- **KİŞİSEL YAPILACAKLAR** (`user_todos`, migration 20260818000001):
  işe bağlanmaz, bildirim üretmez, olay yazmaz; RLS sahibine kelepçeli;
  durum = damga (`done_at`). Saf çekirdek `lib/todos.ts` (sıralama: tarih →
  sort → ad; tamamlananlar 7 günlük pencere). Vade menüden Bugün/Yarın
  kısayoluyla verilir — takvim penceresi açılmaz.
- **BİRLEŞİK AJANDA:** ±30 gün modeli DEĞİŞMEDİ, kaynaklar yediye çıktı
  (Termin·Sevk·Teslim·Görev·Yapılacak·İş Teslimi·Atölye Çıkışı — kanonik
  sıra `AGENDA_KINDS`). Tür çipleri YERELDİR (adrese yazılmaz — kişisel
  bakış) ve yalnız PENCEREDE kaydı olan türe çizilir; gün başına 6 kayıt,
  kırpma sessiz değil. ÖDEME GÜNLERİ BİLEREK DIŞARIDA (14.08 "ödendi takip
  etmeyelim" kararı arkadan dolanılmaz); `hr` belge vadesi zaten sinyal.
- **HIZLI EYLEMLER** (`lib/panel-actions.ts`): rol süzgeçli SALT BAĞLANTI
  çipleri; rol→küme `panel-actions.test.ts`te DONUK. Telefonda iki sütunlu
  ızgaradır, genişte sarar; hiçbir eylem yatay kaydırmanın arkasında kalmaz.
- **SON HAREKETLER:** kaynak yalnız `job_events` son 15; olay dili ORTAK
  sözlükte `lib/jobs/event-labels.ts` (akış sekmesiyle tek kaynak; bilinmeyen
  slug ekrana ham düşmez, "Değişiklik" der). Silinmiş işin satırı okunur ama
  bağlantısızdır.
- **BİLDİRİMLER GERÇEK:** panelde okunmamış-önce 8 satır + `/notifications`
  tam listesi (menüde yok; zilden ve panelden ulaşılır). Yazma yolu tekil
  (`notifications/actions.ts`); zilin 60 sn poll'u değişmedi. Zaman
  `tarihSaatIstanbul` iledir (`lib/format-time.ts`) — sunucu UTC'de üç saat
  geri yazardı.
- **KİŞİSELLEŞTİRME** (`user_panel_prefs`, migration 20260818000002):
  bölüm GİZLE (sorgusu hiç koşmaz) + KATLA (başlık çizilir, gövde
  yüklenmez; "Aç" tek tık). Tercih SUNUCUDADIR (cihazlar arası; `user_saved_
  views` deseni), sözleşme `lib/panel-prefs.ts` `{v:1,hidden,collapsed}` —
  bozuk/gelecek-sürümlü kayıt VARSAYILANA döner, panoyu asla düşüremez.
  `hizli` ve `yapilacak` yalnız gizlenir (katlamanın kazandıracağı yer yok).
  Kontrol yüzeyi BÖLÜM RAYIDIR (PANEL-24); üst şeritteki "Bölümler" menüsü
  01.09.2026'da kaldırıldı.
- Ölçüldü (dev önizleme, 375/768/1280 + koyu tema): `scrollWidth ===
  clientWidth` üç genişlikte de; 11px altı içerik metni yok; satır hedefleri
  telefonda ≥36px.

## Mobil düzen — 23.08.2026

Panel kabuğu `min-width: 0` ve gövde taşma koruması taşır. Hızlı eylemler ile
Yaklaşan tür süzgeçleri telefonda sarar; sayfa ve bölüm içinde yatay kaydırma
üretmez. Hızlı eylemlerin sırası ve rol süzgeci değişmemiştir.

## PANEL-24 — KONTROL YÜZEYİ BÖLÜM RAYIDIR; ÜST ŞERİTTEKİ MENÜ KALKTI.

01.09.2026: panoya bölüm rayı eklendi (MOBIL-29) ve üst şeritteki
`SectionsMenu` popover'ı KALDIRILDI. Sebep sayıdır: ikisi de aynı sekiz
kimliği listeliyordu, yani kullanıcının karşısında aynı listeyi gösteren iki
ayrı yüzey olurdu. Göz (gizle) ve katla düğmeleri ray satırının `sag` yuvasına
indi; yazma yolu (`setPanelSectionState` + `router.refresh()`) DEĞİŞMEDİ.

**ÇIPALAR SUSPENSE'İN DIŞINDADIR.** Yedi yuvanın altısı kendi Suspense sınırının
arkasında; kimlik bölümün kendi `<section>`üne konsaydı iskelet çizilirken o
düğüm HENÜZ OLMAZDI ve `getElementById` boş dönerdi. `panel-view.tsx` her
yuvayı sınırın DIŞINDA bir `<div id={capaKimligi(...)} class="oc-capa">` ile
sarar. `capaKimligi` SAF modülden gelir (`lib/bolum-capa-kimlik.ts`) çünkü
`PanelView` bir SUNUCU bileşenidir.

**GİZLİ BÖLÜM RAYDA KALIR AMA ÇIPASI YOKTUR.** Gizlenen bölümün sorgusu hiç
koşmuyor, yani DOM'da da yok; satır orada yalnız GERİ AÇMAK için durur ve
tıklamak sessizce hiçbir şey yapar. Rayın "git" anlamıyla tek çelişkisi budur
ve bilinçlidir — başka türlü gizlenen bir bölüm geri açılamazdı.

**`yapilacak`IN KENDİ YUVASI YOK**: "Benim Günüm"ün içinde çiziliyor. Rayda
kendi satırı vardır (gizlenebilir bir bölümdür) ama çıpası `gunum`u gösterir;
kendi kimliğine kaydırmak boşluğa atlamak olurdu.

**`prefs` VERİLMEYEN `PanelView` RAY BASMAZ VE ÇIPA KİMLİĞİ ÜRETMEZ.**
`/dev/panel-preview` iki `PanelView` bastığı için ikinci kopyada kimlikler
çakışırdı (`getElementById` hep ilkini bulur).

Panonun *"PENCERE DEĞİLDİR"* ilkesi korunur: ≥1440 px'te ray zaten modal
olmayan bir sütundur. 1440 altında tabaka modaldır ve bu bilinçli bir
istisnadır — gezinme açıkça istenen bir eylemdir, arama gibi sayfanın kendi
yüzeyi değil.
