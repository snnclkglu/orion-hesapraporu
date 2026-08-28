# Teklif

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/teklif.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/offers/**` · `src/app/(app)/offers/**` · `src/lib/pdf/offer.tsx` · `scripts/gen-offer-seed.ts` · `scripts/test-offer-pdf.ts`

## TEKLIF-1 — Teklif MÜŞTERİYE GİDEN belgedir; `purchase_quotes` ile karıştırılmaz.

`purchase_quotes` TEDARİKÇİNİN bize verdiği tekliftir (içeri gelen fiyat);
`offers` BİZİM müşteriye verdiğimiz tekliftir (dışarı giden fiyat). İkisi aynı
kelimeyi taşır ama aynı gerçeği söylemez: birinde tedarikçi defteri ve KDV'li
alım tutarı, ötekinde müşteri defteri, revizyon ve teslim edilmiş bir BELGE
vardır. Bu yüzden önek `offer_`dır ve bölüm `/offers` adresindedir.

Yetki `can_see_offers()` / `can_edit_offers()` — **Yönetici · Müdür** (kullanıcı
kararı, 17.08.2026). Satış Takibi ile aynı küme ama AYRI soru. **Mühendis
burada YOKTUR ve bu bir gözden kaçma değildir:** teklif müşteri fiyatı taşır ve
mühendis bugün satış rakamını da görmüyor. Bölümü mühendise açmak AYRI bir
karardır; `roles.test.ts`teki donmuş küme onunla birlikte güncellenir.

## TEKLIF-2 — Revizyon = SNAPSHOT (mühendislikle aynı model).

`offer_revisions.payload` belgenin TAMAMIDIR: kapak, kalemler, gruplar,
satırlar, ticari şartlar, fiyat satırları, notlar, kapsam dışı maddeleri ve
gizleme kararları. İlişkisel alt tablolar (kalem/satır/fiyat) seçilseydi her
yeni revizyon yüzlerce satır kopyalamak zorunda kalır ve yayımlanmış bir
belgenin değişmezliği tek tetikleyiciyle korunamazdı.

`guard_issued_offer_revision` `guard_issued_revision`in ikizidir: **yayımlanmış
revizyon değiştirilemez ve silinemez**. NEYİN korunduğunu tetikleyici, KİMİN
silebileceğini RLS politikası söyler. Yayımda PDF `offers` kovasına arşivlenir;
arşivleme hatası YAYIMI GERİ ALMAZ (yayım bir karardır, arşiv bir kolaylıktır).

Eski kayıtlar `withDefaults` ile bugüne taşınır (`revision-load.ts` deseni):
eksik alan varsayılanla dolar, motora yeni alan eklendiğinde eski teklifler
bozulmaz.

## TEKLIF-3 — Numara AÇILIŞ gününü, `issued_on` GÖNDERİM gününü söyler.

`TETR-20260817-1` = `TE` + belge dili (`TR`/`EN`) + yıl ay gün + o günün kaçıncı
teklifi. Numara `offers.issue_date`ten türer ve tekillik
`offers_seq_uidx (lang, issue_date, seq)` iledir. Sıra ÖNERİDİR, kilit değil:
çakışan insert 23505 ile düşer, çağıran bir artırıp yeniden dener
(`order-no.ts` ile aynı ruh).

**YAYIMDA `issue_date` DEĞİŞTİRİLMEZ**, `issued_on` yazılır (kullanıcı isteği:
*"teklif yayınlandığında teklifin tarihi o tarih olur"*). Gerekçe iki katlıdır:
numaranın içindeki tarih onunla ayrışırdı, ve ayrı günlerde açılıp AYNI gün
yayımlanan iki teklif aynı (gün, sıra) çiftine düşüp yayımı bir benzersizlik
hatasıyla düşürürdü. **Numara da yeniden üretilmez**, çünkü "PDF İndir" düğmesi
yayımdan AYRIDIR ve taslak belge müşteriye gidebiliyor; gönderilmiş bir belgenin
numarasını sonradan değiştirmek müşterinin elindeki kâğıtla sistemi ayrıştırırdı.

Ekranda, süzgeçte ve sıralamada okunan tarih `effectiveOfferDate` =
`issued_on ?? issue_date`tir. **REVİZYON NUMARANIN İÇİNE İLİŞTİRİLMEZ**
(`offerRevLabel`): devralınan dosyalarda üç ayrı yazım dolaşıyordu ve bir
tanesinde revizyon yalnız dosya adında kalıp belgede hiç görünmüyordu.
R0'ın revizyon etiketi YOKTUR — ilk teklif bir revizyon değildir.

## TEKLIF-4 — Gizleme belgede İZ BIRAKMAZ.

Kullanıcı kararı (17.08.2026): gizlenen satır, grup ya da kalem müşteriye giden
PDF'e **hiç girmez**; boşluk, tire ya da "gizlendi" işareti kalmaz. Bütün
satırları gizlenmiş bir grup BAŞLIĞIYLA BİRLİKTE düşer — yoksa belgede boş bir
`ELEKTRİK SİSTEMİ :` başlığı kalır ve müşteri orada bir şeyin eksildiğini okur.
**DEĞERSİZ SATIR DA BASILMAZ**: `Motor : ` diye biten bir satır bilgi değil
kusurdur.

**SÜZGEÇ TEKTİR** (`printedPayload`, `lib/offers/payload.ts`) ve PDF ile ekran
özeti onu birlikte çağırır. İki yerde yazılsaydı gizlenen satır ekrandan düşer
ama belgeye girmeye devam ederdi — bu bölümde olabilecek en pahalı hata budur.
Editörde satır SOLGUN ama düzenlenebilir kalır ve verisi korunur: gizlemek
silmek değildir.

## TEKLIF-5 — Satır bir DEĞER taşır; parçalardan derlenir, elle ezilebilir.

`OfferRow.parts` doldurulduğunda `value` `composeValue` ile DERLENİR
(`GAMAK 22 kW 1500 d/dak, Encoderli, F/S3, IP55, IE3`); `manual` açıkken
derleme değeri BİR DAHA EZMEZ (kullanıcı isteği: *"istersem elle hızlı
değiştirebilme özelliğim olsun"*). Mühendislik motorundaki `*Auto` anahtarının
aynısıdır: makine önerir, insan son sözü söyler.

Ayıraç kuralı belgelerden çıkarıldı: gövde parçaları BOŞLUKLA, `comma`
işaretinden sonrası VİRGÜLLE bağlanır ve boş parça ayıracıyla birlikte düşer.
**MARKA ETİKETİN İÇİNE GÖMÜLMEZ** — devralınan belgelerde iki stil karışıyordu
(`Motor (GAMAK) :` ve `Motor : GAMAK …`); marka bir DEĞERDİR ve ancak alan
olduğunda süzülebilir, defterden seçilebilir, ileride katalogdan gelebilir.

`value` VERİDİR, sunumda hesaplanan bir şey değil: kaydetme yolu onu yazar.
Böylece belge kendi kendine yeter — defter yarın değişse yayımlanmış teklif
aynı kalır.

## TEKLIF-6 — Defter TEK tablodur ve listeler KAPALI DEĞİLDİR.

`offer_options` bütün açılır listelerin kaynağıdır; ayrımı `list_key` yapar
(`brand.motor` · `series.gearbox` · `term.deliveryTime` · `val.reeving` …).
Marka defteri ile ticari şart defteri aynı tabloda yaşar çünkü ikisi de aynı
soruyu sorar: "bu alanda hangi değerler önerilsin". `parent_id` KADEMELİ
listeler içindir (marka → tip/seri) ve derinlik BİRDİR.

Tekillik `match_key` = `trKatla(value)` üzerinden ve İKİ KISMİ indeksle
kurulur (kök maddeler liste içinde, çocuklar ebeveyni içinde). **Anahtar
TypeScript'te hesaplanır, SQL'de DEĞİL** — Postgres'in `upper()`ı Türkçe
farkında değildir; seed bu yüzden `scripts/gen-offer-seed.ts` ile ÜRETİLİR ve
üretilen migration elle düzenlenmez.

Kullanıcı listede olmayan bir değeri yazıp teklifini kaydedebilir;
`ensureOfferOption` yalnız bir dahaki sefere listede çıkmasını sağlar
(`YeniFirma` bileşeninin kuralı: **kayıt, teklifin ŞARTI değildir**).

**SEED'DE UYDURULMUŞ DEĞER YOKTUR** (değişmez md. 4): 247 madde firmanın
2026'da verdiği on dört teklifin metninden ve uygulamanın kendi
katalog/sabit defterlerinden geldi. Bu yüzden bazı listeler tek maddelik,
`term.warranty` ise BOŞTUR — devralınan tekliflerin hiçbirinde garanti maddesi
yok ve bir garanti süresi uydurmak teklifte yapılabilecek en pahalı hatadır.

## TEKLIF-7 — Fiyat satırı kaleme KİMLİKLE bağlanır.

Devralınan tekliflerde teknik bölüm ile fiyat satırı yalnız BAŞLIK METNİYLE
eşleşiyordu; 22 vinçlik bir belgede bir satırın tonajı yanlış yazılmıştı ve
hata ancak müşteri sorunca görüldü. `OfferPriceLine.itemId` kalıcı bir
kimliktir. Kalem silinirse fiyat satırı YETİM KALMAZ, bağı kopar ve serbest
satıra döner — silinseydi girilen fiyat sessizce kaybolurdu.

**`inTotal: false` gerçek bir ihtiyaçtır**: devralınan bir teklifte günlük
ücretli süpervizörlük satırı bilerek toplama katılmamıştı. Satırı silmek
bilgiyi, toplama katmak rakamı bozardı. Belgede dipnotla işaretlenir.

**TOPLAM TÜRETİLİR** (`offerTotal`) ve payload'a yazılır;
`offer_revisions.total_amount` üretilmiş sütunu onu okur, liste ekranı belgeyi
açmadan tutarı görür. **KDV cümlesi TEK bayraktan türer** (`vatNote`):
devralınan belgelerde aynı sayfada hem "KDV Dahil ödeme şekli" hem "fiyatlara
KDV dahil değildir" yazıyordu.

## TEKLIF-8 — Liste bir TAKİP ekranıdır.

Kullanıcı kararı (17.08.2026): *"tekliflerin listelendiği sayfayı bir teklif
takibi sayfası olarak kullanmak istiyorum."*

- **Takip sayacı** (`lib/offers/takip.ts`): gönderimden bu yana 14 güne kadar
  GÜN, sonrası HAFTA (aşağı yuvarlanır). Renk sarıdan (75°) kırmızıya (20°)
  60 günde iner. Sayaç YALNIZ gönderilmiş ve sonuçlanmamış tekliflerde
  görünür — kazanılmış bir teklifin üstündeki "8 hafta" uyarı değil gürültüdür.
- **Sıra en son gönderilenden başlar** (`effectiveOfferDate` desc).
- **Satır rengi MÜŞTERİNİNDİR** (`customers.color_hue`, defterde yoksa metinden
  türetilir) — renk TEK TAŞIYICI değildir, aynı bilgi müşteri çipinde yazıyla
  da durur.
- **Süzgeç kuralı TEKTİR** (`lib/offers/filter.ts`): tablo, özet şeridi ve
  seçenek listeleri aynı fonksiyonlardan geçer. Süzgeç boyutları (vinç tipi,
  tonaj) `offer_list` GÖRÜNÜMÜNDEN türetilir — tabloya kopyalanmadıkları için
  belgeden ayrışamazlar. Kaynak, kalem KÜNYESİDİR (`items[*].craneType` /
  `capacityT`), basılan metin değil: `30.000 kg / 5.000 kg` satırından tonaj
  ayrıştırmak bir tahmin olurdu.

**KOPYALAMA YENİ BİR TEKLİF ÜRETİR** (`copyPayloadForCustomer`): teknik içerik
ve fiyatlar taşınır, MUHATABA ait her şey (ad, bölüm, telefon, müşteri
referansı, hitap) BOŞALIR. Bu, fark edilmesi en zor hatadır çünkü belge geri
kalan her yerinde doğru görünür. Kimlikler yenilenir ama fiyat–kalem BAĞI
haritayla taşınır.

## TEKLIF-9 — "PDF İndir" ile "PDF İndir ve Yayımla" AYRI düğmelerdir.

Kullanıcı kararı (17.08.2026). Ayrım gerçek bir işe karşılık gelir: birincisi
belgeyi ÜRETİR ve hiçbir şeyi değiştirmez (taslak kontrolü, iç görüş, müşteriye
ön bilgi); ikincisi revizyonu KİLİTLER, arşive yazar ve gönderim tarihini bugüne
çeker. Tek düğmede birleştirmek her önizleme denemesini bir yayıma çevirirdi.

Sıra ÖNEMLİDİR: önce yayım, sonra indirme. Tersi olsaydı yayım hatasında
kullanıcının elinde yayımlanmamış bir belgenin PDF'i kalır ve o belge
"gönderildi" sanılırdı.

**ÖNİZLEME BİR PENCEREDİR**, indirme değil: aynı uç `?inline=1` ile çağrılır ve
belge çerçeve içinde açılır — dosya indirilenler klasörünü kirletmez.

## TEKLIF-10 — Analiz: iki kaynak, tek çizelge.

`offers.win_score` (1–10) VERİLMİŞ bir teklifin kazanılma yakınlığıdır;
`offer_leads` ise HENÜZ VERİLMEMİŞ, verileceği bilinen iştir. İkincisi teklif
DEĞİLDİR — numarası, belgesi, revizyonu yoktur ve `offers`a boş kayıt açmak
teklif numarası zincirini var olmayan belgelerle doldururdu.

Projeksiyonun tamamı tek çarpımdır: **ağırlıklı tutar = tutar × puan/10**.
Bilerek böyle basittir — puan zaten kullanıcının takdiridir, üstüne bir olasılık
modeli koymak uydurma bir kesinlik üretirdi. Puanı ya da tutarı OLMAYAN satır
projeksiyona GİRMEZ (eksik veriyi sıfır saymak toplamı sessizce küçültür).
Beklenen tarihi olmayan satır "Tümü" dışındaki pencerelere girmez ve ayrıca
sayılır. Teklife dönüşmüş beklenen iş satırı SİLİNMEZ (tahminin ne kadar
tuttuğunu ancak geçmiş gösterir) ama `tekilSatirlar` ile analizden düşer —
yoksa aynı iş iki kez sayılırdı.

Puan rengi soğuk (240°) → sıcak (25°) iner; **puansız satır RENKSİZDİR** —
uydurma bir orta değer, kullanıcının vermediği bir kararı vermiş gibi
gösterirdi.

## TEKLIF-12 — SAHTE GRUP ANAHTARLARI: `__terms` ve `__testLoad`.

Test yükü ve ticari şartlar bir vinç KALEMİNİN içinde değil belgenin kendi
gövdesinde durur, yani bir `OfferGroup`ları yoktur — ama satırları yine de
defterden tanınmalıdır. `offerRowDef` bu iki anahtarı ayrıca çözer
(`TERMS_GROUP_KEY` · `TEST_LOAD_GROUP_KEY`) ve çözüm TEMBELDİR (`switch`):
`TERM_ROW_DEFS` fonksiyonun ALTINDA tanımlıdır, modül düzeyinde bir eşleme
nesnesi `const` zaman-ölü-bölgesine düşerdi.

**BAĞ BİR SÜRE YOKTU VE İKİ BELİRTİYİ BİRDEN DOĞURDU** (kullanıcı bildirimi,
17.08.2026): `offerRowDef("__terms", …)` `undefined` döndüğü için ticari şart
satırlarının hiçbiri açılır liste çizmiyor, düz metin kutusuna düşüyordu; aynı
sebeple test yükü ve geçerlilik süresi defterdeki varsayılanlarla da
dolmuyordu. İki belirti, tek kök. Koruma `offers.test.ts`tedir ve iki yönlüdür:
her ticari/test satırı defterden ÇÖZÜLMELİ, ve her ticari satır bir listeye ya
da parçaya bağlı OLMALIDIR (düz kutu kalmaz).

## TEKLIF-13 — Satırın ÜÇ kipi vardır; kip defterdeki tanımdan çıkar.

`def.parts` dolu → **PARÇALI** · `def.list` dolu, parçası yok → **LİSTELİ** ·
ikisi de yok → **SERBEST**. Defterin büyük çoğunluğu LİSTELİdir (ticari şartlar,
kanca, ray, boya, vinç sınıfı, halat donanımı…). Kip yalnız parça sayısına
bakarsa listeli satırlar sessizce düz kutuya düşer — TEKLIF-12'deki hatanın
görünen yüzü buydu. `manual` her üç kipi de serbest metne çevirir ve derleme
onu ezmez.

## TEKLIF-14 — Varsayılanlar DEFTERDEN gelir ve yalnız AÇILIŞTA uygulanır.

`applyDefaults` (payload.ts) `offer_options.is_default` işaretli değerleri boş
alanlara yazar: test yükü (`Q x 1,1` / `Q x 1,25`), teklif geçerlilik süresi ve
giriş paragrafı. Değerler koda gömülmez; Tanımlar sayfasından değiştirilir.

Doldurma **YALNIZ BOŞ ALANA** ve **YALNIZ `createOffer`da** yapılır: her
kaydetmede yeniden uygulansaydı kullanıcının bilerek sildiği bir satır geri
gelirdi. Defterde varsayılanı olmayan alan BOŞ kalır (değişmez md. 4).

**TEST YÜKÜ ORANLARI BELGELERDEN ALINDI**: dinamik `Q x 1,1`, statik
`Q x 1,25` — on dört teklifin on dördünde böyle ve TS 10116 ile de bu yönde.
Kullanıcı bir kez tersini söyledi ("statik %110 dinamik %125"); kendi
belgeleri esas alındı ve durum kendisine bildirildi.

## TEKLIF-15 — Muhatap MÜŞTERİ DEFTERİNDEN gelir (`customer_contacts`).

Bir müşterinin birden çok iletişim kişisi olabilir ve teklifte kişi adı geçer
(kullanıcı isteği, 17.08.2026). Defter `/admin/customers` ekranındadır; teklif
onu YALNIZ OKUR. `createOffer` **birincil** kişiyi kapağa yazar
(`suggestedContact` → `coverFieldsFromContact`) ve hitap cümlesini kurar;
editördeki seçiciyle değiştirilir.

**HİTAPTA ADDAN CİNSİYET ÇIKARILMAZ** (`greetingFor`): ek defterden seçilir
(`cover.honorific`). Tahmin etmek, kapağın en görünür satırında yanlış bir
hitap üretirdi; boş bırakmak ise aynı cümleyi her teklifte yazdırırdı.
Kapağa yazılan bilgi FOTOĞRAFTIR — defter sonradan düzeltilince teslim edilmiş
teklif değişmez (müşteri adıyla aynı kural).

## TEKLIF-16 — Notlar ve kapsam dışı TİK ATILARAK seçilir.

Kullanıcı isteği: *"hazır şablonlar yap, ben tik atarak seçebileyim, istersem
kendim ekleyebileyim, eklediğim de kayıt altına alınsın."* Üç bölge:
defter (tik kutusu) · belgeye özel maddeler (defterde karşılığı olmayanlar,
ayrı ve kesik çerçeveli) · ekleme (yazılan madde belgeye girer; "deftere de
ekle" onu kalıcı yapar — deftere yazmak belgeye eklemenin ŞARTI DEĞİLDİR).

**GÜNCELLEME FONKSİYONELDİR** (`guncelleIle`): iki tik aynı boyama turunda
gelirse ikincisi birincisini geri almamalıdır. Ölçüldü (17.08.2026): art arda
iki madde işaretlendiğinde yalnız sonuncusu kalıyordu. Bir belge editöründe bu,
kullanıcının girdiğini kaybetmesi demektir.

## TEKLIF-17 — Yükseklik zinciri KESİNTİSİZDİR; en zayıf halka BÖLÜM KABIDIR.

Kabuk `/…/revisions/…` adreslerini SABİT ÇERÇEVE sayar (`isFrame`,
app-shell.tsx) ve `lg` üstünde `main`e `overflow-hidden` verir; editör kendi
kaydırma kabını kurabilmek için kesintisiz bir yükseklik ister:

    kabuk gövdesi → içerik sütunu → main → iç kap → #icerik
      → **offers/layout.tsx**  → sayfa kökü → editör → bölüm gövdesi

**HATA İKİ KEZ ARANDI ve ikisinde de zincirin BAŞKA bir halkasında sanıldı.**
Gerçek kırılma `offers/layout.tsx`teydi: bölüm kabı düz `grid gap-4` idi, yani
AUTO yükseklikti. Sayfa kökündeki `lg:h-full` yüzde-yüzünü `auto`dan alıp yine
`auto` oluyor, editör 1044 px'e büyüyor ve 566 px'lik `main` onu KIRPIYORDU —
kaydırılacak bir kap hiç oluşmuyordu.

`/projects/[id]/revisions/[revId]` bu hatayı hiç yaşamadı çünkü **Mühendislik'in
bölüm layout'u YOKTUR**; zincirde o halka hiç bulunmuyor.

Kap `flex-col`dur, `grid` değil: `OffersNav` revizyon ekranında `null` döner ve
`grid-rows` çocuk sayısına bağlıdır. Aynı sebeple sayfa kökü ve editör
`lg:flex-1` kullanır, `lg:h-full` değil — `PageHeader` kabuğun şeridine
PORTALLANIR ve sayfada HİÇ DOM düğümü bırakmaz, yani çocuk sayısı bağlama göre
değişir.

**ÖNİZLEME BENZERİNİ DEĞİL GERÇEĞİ KURAR** (`/dev/offer-editor-preview`):
kabuğun ata zinciri, başlık portal yuvaları ve bölüm kabı orada birebir
basılır. İlk iki düzeltme tam da bu yüzden önizlemede "çalıştı" ama gerçek
sayfada çalışmadı — önizleme kırılan halkayı hiç içermiyordu.

## TEKLIF-18 — PDF ucu ÇERÇEVEYE AÇIK tek adrestir.

Uygulamanın tabanı `X-Frame-Options: DENY` + `frame-ancestors 'none'`; bu,
AYNI KÖKENDEN gömmeyi de engeller ve önizleme penceresindeki `<iframe>` boş bir
"belge açılamadı" ikonu gösteriyordu. Gevşetme YALNIZ
`/offers/:id/revisions/:revId/pdf` adresindedir ve yalnız `'self'`e kadardır
(next.config.ts). Genel başlığı `SAMEORIGIN`a çekmek daha kısa olurdu ama
bütün ekranları gömülebilir yapardı.

**PDF ÜRETEN HER BÖLÜM `outputFileTracingIncludes`E EKLENİR.** `pdf/brand.tsx`
fontları ve logoyu `path.join(process.cwd(), …)` ile okur; bu yol çalışma
anında kurulur, Next'in çözümleyicisi göremez ve Vercel paketine dosyaları
koymaz — belge yerelde üretilir, canlıda ENOENT ile düşer. `/offers/**`
eklenirken `/purchasing/**`, `/sales/**` ve `/drawings/**` de eksikti; üçü de
eklendi.

## TEKLIF-11 — Belgenin yapısı firmanın kendi tekliflerinden çıkarıldı.

Kaynak: 2026'da verilen on dört teklifin tamamı okundu. Sıra sabittir ve
`lib/pdf/offer.tsx` onu basar: **kapak (KİMDEN/KİME künyesi, hitap, giriş,
imzalar) → kalem başına teknik sayfalar → TEST YÜKÜ → FİYAT, TESLİM VE ÖDEME
ŞEKLİ + ödeme planı → fiyat tablosu → NOTLAR → KAPSAM DIŞI İŞLER.**

Devralınan belgelere göre üç düzeltme yapıldı ve üçü de kuraldır:
- **Altbilgi künyesi** her sayfada (`TETR-… · REV nn · KONU`) — eski belgelerde
  iç sayfalar bağlamsızdı.
- **Fiyat tablosu TEK ŞEMA** (`No · Tanımı · Adet · Birim Fiyat · Toplam`) —
  eski belgelerde dokuz farklı sütun düzeni dolaşıyordu.
- **KDV çelişkisi giderildi** (tek bayrak, iki cümle ondan türer).

Duman testi `npx tsx scripts/test-offer-pdf.ts`: üç fikstür (sade · gizlemeli ·
sekiz kalemli) üretilir ve `unpdf` ile METNİ geri okunur — gizlenen satırın
belgede olmadığı, toplamın satırlarla tuttuğu ve altbilgi künyesinin her sayfada
bulunduğu orada ölçülür. Bileşen ağacına bakmak bunların hiçbirini göstermez.

## TEKLIF-19 — Ayıraç PARÇANIN kararıdır, yapışkan bir kip değil.

`composeValue` bir süre "ilk virgülden sonrası hep virgül" kipindeydi ve iki
parçası virgül-boşluk sırasıyla dizilen satırları yazamıyordu: çalışma ortamı
satırı `Kapalı Alan, -10 / +40 º C` olmalıyken `Kapalı Alan, -10, / +40 º C`
çıkıyordu. `comma` artık parça başına sorulur; mevcut bütün satırların yazımı
AYNEN korunur çünkü orada zaten kuyruğun tamamı işaretlidir.

## TEKLIF-20 — Kalem künyesi TEKNİK SATIRLARDAN türetilir.

Kapasite ve açıklık YALNIZ GENEL ÖZELLİKLER'de sorulur (kullanıcı isteği,
17.08.2026: *"aynı bilgiyi iki defa alıyoruz"*). Teklif listesindeki tonaj ve
vinç tipi süzgeçlerini besleyen `capacityT` / `spanM` / `craneType` alanları
kaydetme yolunda `itemFactsFromRows` ile o satırlardan çıkarılır. İki yerde
yaşayan bir sayının ayrışma ihtimali böylece ortadan kalkar; okunamayan değer
`null` kalır, UYDURULMAZ.

## TEKLIF-21 — SEÇİM taşınır, ÖLÇÜ taşınmaz.

Yeni kalem eklerken önce vinç tipi sorulur (şablon bölümleri kurar) ve ilk
kalemin tercihleri ön tanımlı gelir (`copySelections`). Taşınan şey MARKA, TİP,
MALZEME, STANDART ve KONTROL tercihleridir; kapasite, açıklık, güç, devir, çap
ve adet TAŞINMAZ — ikincisini kopyalamak, ikinci vincin ölçülerini birincininkiyle
doldurup kullanıcıya sessizce yanlış bir belge hazırlatırdı. GENEL ÖZELLİKLER
grubu bütünüyle dışarıdadır.

## TEKLIF-22 — Satır KAPSAMI: varsayılan görünmez, istisna görünür.

`OfferRow.scope` `orion` (varsayılan) ya da `customer`dır. Belgede yalnız
`customer` iz bırakır (` (Müşteri Kapsamında)`); `orion` HİÇBİR ŞEY yazmaz —
bir teklifte satırların neredeyse tamamı zaten bizim kapsamımızdadır ve her
satıra yazmak belgeyi okunmaz yapardı.

## TEKLIF-23 — Ödeme planı YÜZDE + AÇIKLAMA; toplam gösterilir, ZORLANMAZ.

Satır `percent` ve `desc`ten derlenir (`paymentLineText`). Ekran yüzde toplamını
ve "%100 oldu / olmadı"yı söyler ama kaydetmeyi ENGELLEMEZ: kullanıcı planı
yazarken ara adımlarda toplam kaçınılmaz olarak 100'den farklıdır ve engel onu
düzenlerken kilitlerdi. **Yüzdesiz satır meşrudur** — devralınan tekliflerde
"Montaj Sonrası Kalan Nakit" gibi satırlar var; onlar toplama girmez ve ayrıca
sayılır.

## TEKLIF-24 — Yayımlanmışı YALNIZ Yönetici geri çeker; KAPI TETİKLEYİCİDEDİR.

`unlockOfferRevision` durumu `issued`tan `draft`a çeker; kilit KALKMAZ, bir
KAPI açılır — düzenleme sonrasında normal yolundan yapılır. Fark önemlidir:
yanlışlıkla bir düzenleme değil, BİLİNÇLİ bir geri çekme gerekir. İşlem denetim
defterine yazılır (`offer.revision_unlock`) ve **arşivdeki PDF SİLİNMEZ** —
müşterinin elindeki kâğıdın karşılığı arşivde durmaya devam eder. `issued_on`
geri alınmaz: teklif gerçekten gönderildiyse takip sayacı o günü saymalıdır.

**ÖZELLİK YAZILMIŞ AMA HİÇ ÇALIŞMAMIŞTI** (kullanıcı bildirimi, 17.08.2026:
*"yayınlanan bir teklifi geri çekme özelliği olsun … 'Yayınlanmış teklif
revizyonu değiştirilemez' uyarısı veriyor"*). Düğme, yetki ve action yerinde
duruyordu; `guard_issued_offer_revision` ise `old.status = 'issued'` gördüğü ANDA
yeni satıra hiç bakmadan düşürüyordu — geri çekme de bir UPDATE'tir. Belirti
"yetki yok" gibi okunuyordu, sebep korumanın kendisiydi.

Kapı `20260819000009_offer_revision_unlock` ile DAR açıldı: yayımlanmış satırda
yalnız `status='draft'` + `issued_at/issued_by = null` geçer ve `offer_id`,
`rev_no`, `label`, `notes`, `payload`, `created_by` **aynı kalmak zorundadır**.
Koşul işlemin ADINA değil ALANLARIN AYNILIĞINA bakar — SQL bir niyet okuyamaz.
"Durum değişiyorsa serbest" demek yetmezdi: aynı UPDATE payload'ı da taşıyabilir
ve geri çekme, teslim edilmiş bir belgeyi sessizce değiştirmenin yolu olurdu.
Silme kuralı DEĞİŞMEDİ. `unlockOfferRevision`in yazdığı alan kümesi tetikleyicinin
sorduğu kümedir; oraya bir alan daha eklemek özelliği sessizce çalışmaz yapar.

## TEKLIF-25 — Radix `Select`te `SelectValue` YOKSA `position="popper"` ŞARTTIR.

Puan seçicisi ekranın sol üstünde açılıyordu. Sebep z-index değil: bu depodaki
`ui/select.tsx` varsayılanı `item-aligned`dır ve Radix o kipte konumu ancak
`valueNode` varsa hesaplar — `valueNode`u yalnız `<SelectValue>` kurar. Kendi
rozetini basan seçicilerde (`lead-dialog.tsx`) o düğüm hiç doğmuyor, kap
`position: fixed` alıyor ama konum özelliklerini hiç almıyor ve viewport'un
sol üstüne düşüyordu.
`<SelectValue>` KULLANMAYAN her `SelectContent` `position="popper"` almalıdır.

## TEKLIF-27 — KONU BELGENİN, BAŞLIK KALEMİN adıdır.

Kullanıcı isteği (17.08.2026): *"Girdiğim teklif konusu ekleyeceğim vinç ile aynı
olmayabilir. Konu Kapak bölümüne gelsin, ilk vinç Vinç - 1 olarak gelsin; ben
Kalem Başlığından zaten düzenlerim."*

`createOffer` konuyu kalem adı olarak KULLANMAZ; ilk kalem `defaultItemTitle(1)`
= **VİNÇ - 1** ile açılır ve "İlk Kalemin Adı" alanı Yeni Teklif penceresinden
KALDIRILDI. Konu üç vinçlik bir belgenin adıdır ("YENİ FABRİKA VİNÇ
TEKLİFLERİ"); onu ilk vince takmak, kullanıcının her teklifte sildiği bir başlık
üretirdi. **Şablon seçildiyse vinç tipi GENEL ÖZELLİKLER satırına da yazılır**
(`withCraneType`) — kaynak `offer_templates.crane_type`tir, uydurma değildir
(değişmez md. 4) ve aynı soruyu iki kez sormaz. Şablonsuz teklif de artık TEK
KALEMLE açılır: kalemsiz bir teklif, bölüm rayında hiçbir şey göstermiyordu.

## TEKLIF-28 — Kalem başlığı TÜRETİLİR: `kapasite × aks + tip`.

Kullanıcı isteği (17.08.2026): *"Kalem başlığını da otomatize edelim hata olmasın.
Ana Kaldırma / Yardımcı Kaldırma (varsa) x Aks + Vinç Tipi olarak otomatik
gelsin. İstersem düzenleyebileyim."*

Biçim UYDURULMADI, devralınan on dört teklifin bölüm başlıklarından çıkarıldı ve
kullanıcının tarifiyle birebir tutuyor: `32/5T x 19.5m ÇİFT KİRİŞ GEZER KÖPRÜLÜ
VİNÇ` · `32T x 30m ÇİFT KİRİŞ TAM PORTAL VİNÇ` · `20T ÇİFT KİRİŞ GEZER KÖPRÜLÜ
VİNÇ` (açıklıksız) · `3T MONORAY VİNÇ`. **"AKS" = KÖPRÜ AÇIKLIĞI**; pergelde
`Bom Açıklığı` okunur, çünkü bir kalemde yalnız biri doludur.

- **Kaynak GENEL ÖZELLİKLER satırlarıdır** (`generalRowPart` / `generalRowValue`,
  registry) — kalem künyesiyle AYNI okuma noktası (TEKLIF-20).
- **Sayı yeniden biçimlenmez**: kullanıcı "19,5" yazdıysa başlıkta "19,5" durur.
  Türetme bir OKUMADIR, bir hesap değil.
- **Bulunmayan parça sessizce düşer** — "20T x m" gibi yarım bir başlık oluşmaz.
- **`titleManual` başlığı kilitler** (satırdaki `manual`ın ikizi): elle yazılan
  ad, sonraki kapasite düzeltmesinde SESSİZCE geri alınmaz; asa düğmesi
  otomatiğe döndürür.
- **`adBuyuk` BURADA KULLANILMAZ** — `kalemBasligiBuyuk` rakam içeren sözcüğü
  ("19,5m", "32/5T") ve çarpım işaretini ("x") olduğu gibi bırakır. Düz büyütme
  belgelerin yazımını `X 19,5M` yapardı. Değişmez md. 3 AD alanları içindir;
  kalem başlığı ölçü taşıyan bir BELGE BAŞLIĞIDIR.
- Türetme YALNIZ editörde çalışır (`withAutoTitle`, `ItemEditor.degistir`);
  `withDefaults` onu ÇAĞIRMAZ — o yol yayımlanmış revizyonun PDF'ini de üretir ve
  teslim edilmiş bir belgenin başlığını değiştirmek yasaktır (TEKLIF-2).

## TEKLIF-29 — Türetilen parça: sürücünün TOPLAM GÜCÜ.

Kullanıcı isteği (17.08.2026): *"Sürücü toplam güç, Güç x adet otomatik yazsın."*
Defter satırı toplamı zaten basıyordu ama sayıyı İNSAN yazıyordu; 18,5 kW'lık
dört sürücünün toplamını elle çarpmak, belgenin kendi içinde tutarlı GÖRÜNÜP
yalnız müşteri hesapladığında ortaya çıkan türden bir hatadır.

Kip defterde bir ETİKETTİR (`OfferPartDef.derived: "powerTotal"`), hesap
`derivedParts` (compose.ts) içindedir ve kutu ekranda SALT OKUNUR çizilir —
"(otomatik)" etiketiyle, çünkü sebebi görünmeyen kilitli bir alan bozuk gelir.
**ADET 1 İSE TOPLAM YAZILMAZ** (defterin kendi kuralı: aynı sayı iki kez
geçmez); güç ya da adet okunamıyorsa toplam BOŞALIR (değişmez md. 4). Hesap
kaydetme yoluna değil `setParts`e bağlıdır: ekranın belgeden farklı bir şey
göstermesi bu bölümde kabul edilemez. `withDefaults` yine türetme YAPMAZ — eski
bir belgenin metnini geri okurken değiştirmek TEKLIF-2'yi çiğnerdi.

## TEKLIF-30 — Kalemin bölümleri KENDİLİĞİNDEN açılır: yardımcı kaldırma ve İKİNCİ ARABA.

Kullanıcı istekleri (17.08.2026): *"Yardımcı Kaldırmaya tonaj girersem altta
yardımcı kaldırma adında bölüm açılsın"* · *"Tek arabalı veya çift arabalı olarak
seçenek olsun; çift arabalı işaretlersem Vinç Arabası - 2 olarak yeni bölüm
açılsın, diğeri de bu durumda Vinç Arabası - 1 olsun."*

- **TETİK BOŞTAN DOLUYA GEÇİŞTİR**, "dolu olması" değil (`ItemEditor.degistir`):
  sonrası olsaydı kullanıcının bilerek kaldırdığı bölüm her tuş vuruşunda geri
  gelirdi.
- **Yerleştirme defter sırasınadır** (`withGroup`): yardımcı kaldırma KALDIRMA
  GRUBU'nun ardına, ikinci araba arabanın ardına girer. Sona eklenseydi belgede
  elektrik sisteminden sonra basılırdı. Mevcut grupların sırasına DOKUNULMAZ —
  kullanıcının elle taşıdığı düzen korunur.
- **ARABA SAYISI AYRI BİR ALANDA SAKLANMAZ**, `auxTrolley` bölümünün
  VARLIĞINDAN okunur (`trolleyCount`). Ayrı bir alan iki yazıcı doğururdu ve
  ekran belgeyle çelişirdi (TEKLIF-20'nin gerekçesi).
- **TEKE DÖNÜŞ VERİ SİLMEZ** (`setTrolleyCount`): ikinci arabanın satırlarına bir
  şey girilmişse bölüm KORUNUR ve kullanıcıya söylenir; boşsa kaldırılır (boş
  başlık belgede bir eksiklik izlenimi bırakır). Yanlış tıklanan bir seçicinin
  doldurulmuş bir bölümü götürmesi, bu editörde olabilecek en pahalı davranıştır.
- **Başlık "YARDIMCI" DEĞİL "- 2"DİR**: iki araba çoğunlukla eşittir ve
  "yardımcı" ikincisini küçük gösterirdi. Yardımcı KALDIRMA gerçekten
  yardımcıdır, adı öyle kalır. Kullanıcının KENDİ yazdığı bölüm başlığı ezilmez
  (`ARABA_VARSAYILAN_BASLIKLARI`) — başlık belgeye aittir (`OfferRow.label`
  kuralı).

## TEKLIF-31 — Bir ekipman İKİ MARKAYLA teklif edilebilir: "SEW/FLENDER".

Kullanıcı isteği (17.08.2026): *"Ekipmanlara ekstra marka ekleme özelliği olsun;
örneğin redüktör Yılmaz Redüktör ve Flender olarak ikisini belirtebileyim.
Bunun gibi diğer ekipmanlarda da istersem ekleyebileyim."*

İhtiyaç firmanın belgelerinde ZATEN VARDI: `Motor : SIEMENS/ABB 110 kW` ·
"Redüktör : SEW/FLENDER" · `Motor : ELK/GAMAK 30 kW` · `Güç Kaynağı : Omron /
Phoenix`. Yani "iki marka birden" bir istisna değil, teklifin normal yazımıdır.

- **DEĞER YİNE TEK METİNDİR**, dizi değil (`lib/offers/multi.ts`): `composeValue`,
  PDF, `printedRows` ve karşılaştırma hiç değişmez ve yayımlanmış payload bir
  ŞEKİL değişikliği yaşamaz — dizi olsaydı `withDefaults` teslim edilmiş
  belgeleri yeni şekle taşımak zorunda kalırdı (TEKLIF-2). Çokluk yalnız EKRANIN
  kipidir.
- **AYIRAÇ BOŞLUKSUZDUR** (`/`). Belgelerde iki yazım var; marka satırın
  BAŞINDA durup ardından boşlukla bağlanan parçalar geldiği için "SIEMENS / ABB
  110 kW" okunduğunda ABB ile 110 kW'ın aynı öbeğe ait olup olmadığı belirsizleşir.
- **ÇOKLUK YALNIZ MARKA LİSTELERİNDEDİR** (`isMultiValueList`: `brand.*`) ve
  kural anahtarın önekinden çıkar — bugünkü ve yarınki bütün marka alanları
  kendiliğinden çok markalı olur. Ölçü listeleri TEKTİR: "Ø400 / Ø500" bir
  tekerlek çapı değil iki farklı tekerlektir.
- **DEFTERE "SEW/FLENDER" YAZILMAZ**: "deftere ekle" düğmesi MADDE BAŞINA durur,
  çünkü defterde iki marka vardır, birleşik bir ad yoktur.
- **KADEMELİ LİSTE İLK MARKAYA BAKAR** (`firstMulti`): marka "SEW/FLENDER"
  olduğunda defterde o adla madde yoktur ve seri listesi bomboş kalırdı.
- Boş kutu değere GİRMEZ (`splitMulti` boş dilimi düşürür) — belgeye "SEW/"
  girmesin diye; bu yüzden "marka ekle" düğmesinin açtığı kutu YEREL bir
  durumdur ve yalnız yazılınca değere katılır.

## TEKLIF-32 — ŞABLON KALEMİN sorusudur, belgenin değil.

Kullanıcı isteği (17.08.2026): *"Şablon seçimini teklifi oluştururken değil de
kalem eklerken yapsak daha iyi olur. Teklif ilk boş olarak gelsin, ben kalem
eklerken hangi şablona göre geldiğini orada seçeyim. Çünkü bir teklif
içerisinde hem tek kirişli hem çift kirişli hem portal olabilir; 3 4 farklı
şablon kullanmak gerekebilir."*

Yeni Teklif penceresinde ŞABLON ALANI YOKTUR ve `newOfferSchema`da `templateId`
de yoktur; `createOffer` `payload.items = []` ile açar. Bir teklif düzeyinde
şablon sormak, çok ürünlü belgeyi tek bir vinç tipine bağlamak olurdu (ASTOR'un
"Yeni Fabrika" teklifinde bir çift kirişli, bir tek kirişli ve iki monoray var).
Kalemsiz teklif artık OLAĞANDIR: editör boş belgeyi bir yazıyla karşılar ve
"Kalem Ekle" düğmesini gösterir — boşluk kendi başına bir şey söylemez.
TEKLIF-27'deki "ilk kalem VİNÇ - 1" kuralı KALKMADI, yeri değişti: adı artık
`KalemEkleDialog` verir (`defaultItemTitle(sira)`), vinç tipi ve bölümler orada
seçilen şablondan gelir.

## TEKLIF-33 — SERBEST KALEM: teknik özellikler elle yazılır.

Kullanıcı isteği (17.08.2026): *"Yedek teklifi verebilirim. Yedek teklifinde
teknik özellikleri kendim elle girebileceğim bir yapı da isterim."*

Kalem Ekle'deki şablon listesinde **Serbest** seçeneği vardır (`freeItem`): tek
bir `TEKNİK ÖZELLİKLER` bölümü ve üç BOŞ serbest satır kurulur; etiketi de
değeri de insan yazar. Yedek parça, kabin değişimi ya da revizyon işi vinç
defterine SIĞMAZ — orada "Kaldırma Hızı" ve "Halat Donanımı" satırları var,
burada "Redüktör Gövdesi" gibi o işe özel satırlar olacak.

- **Adı "VİNÇ - n" DEĞİL "KALEM - n"dir** (`defaultFreeItemTitle`): serbest
  kalem bir vinç olmayabilir ve ona vinç demek belgede yanlış bir başlık üretir.
- **Başlığı ELLE YAZILMIŞ sayılır** (`titleManual: true`): türetilecek bir
  kapasite satırı yoktur, türetme onu boşa çıkarırdı.
- **Boş satır belgeye girmez** (`rowHasValue`), o yüzden üç satırla açmak
  bedava: kullanıcı önce "Serbest Satır" düğmesini aramak zorunda kalmaz.
- Tercih kopyalama (`copySelections`) serbest kalemde ÇALIŞMAZ ve kutusu hiç
  görünmez — taşınacak bir defter satırı yok.

## TEKLIF-34 — ADET BİR İSE YAZILMAZ; fren İSTİSNADIR.

Devralınan on dört teklifte tek motor `Motor : GAMAK 22 kW 1500 d/dak` diye
yazılıyor, `1 x 22 kW` diye DEĞİL: yazılmayan adet zaten birdir. Çift marka
eklendiğinde bu kusur göze battı (`GAMAK/ELK/ABB 1 x 30 kW`) ve kullanıcı
bildirdi. Kip defterde bir bayraktır (`OfferPartDef.hideWhenOne`) ve MOTOR ile
SÜRÜCÜ adedinde açıktır.

**FREN SATIRI BİLEREK İŞARETSİZDİR**: belgelerde `SIBRE Kasnak Fren x 1 Adet`
yazımı geçiyor (İDÇ teklifi) — orada adet, İKİNCİ BİR FRENİN OLMADIĞINI söyleyen
bir bilgidir. Kural genel bir "1'i sil" kuralı değil, alan alan verilmiş bir
karardır ve kaynağı belgelerin kendi yazımıdır.

## TEKLIF-35 — İSKONTOLU TOPLAM: tutar saklanır, oran türetilir.

Kullanıcı isteği (17.08.2026): *"Fiyat kısmının en sonuna iskontolu toplam fiyat
girebileceğim bir kısım olsun. İstersem birim fiyatları da o oranda düşürsün,
yuvarlama yapsın ama toplam tutsun."*

`OfferPricing.discountTotal` MÜŞTERİNİN ÖDEYECEĞİ tutardır. **Oran değil TUTAR
saklanır**: pazarlıkta konuşulan şey "şu fiyata verelim"dir; yüzde saklanıp
yuvarlanmış bir tutar basılsaydı belgedeki iki sayı çelişirdi. `null` = iskonto
kararı hiç verilmedi (sıfır DEĞİL).

- **TAKİP EDİLEN TUTAR İSKONTOLUDUR** (`effectiveTotal` → `withTotal` →
  `offer_revisions.total_amount`): liste ekranı, analiz ve üst şerit müşterinin
  ödeyeceği rakamı gösterir.
- **İKİ AYRI EYLEM**: tutarı yazmak belgeye `İSKONTO` + `İSKONTOLU TOPLAM`
  satırları ekler (müşteri iskontoyu görür); "Birim fiyatlara yansıt" düğmesi
  satırları ölçekler. İkincisi geri alınamaz bir düzenlemedir, o yüzden kutuya
  yazmanın YAN ETKİSİ değil kendi düğmesidir.
- **YUVARLAMA + BİREBİR TOPLAM** (`applyDiscountToLines`): birim fiyatlar oranla
  çarpılıp TAM SAYIYA yuvarlanır, yuvarlamadan doğan artık EN BÜYÜK TUTARLI
  satıra bindirilir. Artığı bütün satırlara dağıtmak hepsini kuruşlu yapardı.
  Firmanın bütün tekliflerinde birim fiyatlar tam sayıdır (55.900 €).
- **Σ (toplama girmeyen) ve GİZLİ satır ölçeklenmez**: biri toplamın dışındadır
  (günlük süpervizörlük ücreti), öteki belgede yoktur.
- **BELGEDE İSKONTO SATIRI YALNIZ FARK VARSA basılır**: birim fiyatlara
  yansıtıldıysa tablo zaten iskontoludur ve ayrıca yazmak aynı sayıyı iki kez
  basmak, üstüne ikinci bir indirim vaat etmek gibi okunurdu.

## TEKLIF-36 — Kapak künyesindeki BOŞ SATIR hiç basılmaz.

Kullanıcı isteği (17.08.2026): *"Kapak kısmında var ise müşteri teklif referans
numarasını gireceğim bir kutucuk olsun. Varsa girerim yoksa PDF'e yansımasın."*
Alan `cover.customerRef` olarak zaten vardı; kutunun adı **Müşteri Teklif
Referans No** yapıldı. Basılmama ayrı bir bayrakla DEĞİL, künyenin kuruluş
kuralıyla sağlanır (`dolu()`, pdf/offer.tsx): boş değerli satır künyeye hiç
girmez — aynı kural bölüm, telefon ve unvan için de geçerlidir.

**KİMDEN SEÇİMİ E-POSTAYI DA YAZAR** (kullanıcı bildirimi: *"seçilen kişinin
ismi ve ünvanı geliyor ancak maili gelmiyor"*): `loadOfferAuthors` artık
`profiles.email`i okur (`OfferAuthor.email`) ve seçim onu kapağa geçirir — ama
YALNIZ VARSA; defterde adresi olmayan bir kullanıcıda mevcut değeri boşaltmak,
kapaktaki tek iletişim satırını silmek olurdu.

## TEKLIF-37 — Garanti: 1–5 yıl, VARSAYILAN 2 YIL.

Kullanıcı kararı (17.08.2026): *"Garanti süresi dropdown 1 2 3 4 5 yıl olsun,
standart 2 yıl olarak gelsin."* Migration `20260819000010_offer_warranty_options`.

TEKLIF-6'daki "`term.warranty` BOŞTUR" saptaması bir GÖZLEMDİ, bir kural değil:
devralınan tekliflerde garanti maddesi yoktu ve o yüzden bir süre uydurmak
yasaktı (değişmez md. 4). Artık uydurma yok — kaynak firmanın kendi beyanıdır.
Değer koda gömülmez, deftere yazılır; Tanımlar sayfasından değişir ve yeni
tekliflere `applyDefaults` ile gelir. **Listede varsayılan TEK olmalıdır**, o
yüzden migration önce bütün işaretleri kaldırıp yalnız "2 Yıl"ı işaretler.

**TESLİM SÜRESİ ETİKETİNDE BİRİM YAZMAZ** (aynı tur): "En Az (hafta)" yazıp
altta "Ay" seçtirmek, iki ayrı şey söyleyen bir form demekti. Birim TEK yerde
sorulur; liste adı da `Teslim Süresi Sayıları`dır.

## TEKLIF-26 — Yarım tarih KAYDEDİLMEZ.

`<input type="date">` her tuş vuruşunda `onChange` yayar; yılın ilk hanesi
yazılır yazılmaz `0002-…` gibi geçerli BİÇİMLİ ama anlamsız bir tarih
kaydediliyordu. Kutu yarım değeri KENDİ yerel durumunda tutar ve yukarı yalnız
tam, gerçek ve yıl ≥ 1000 olan bir tarih verir; boş değer `null` üretir. Aynı
kelepçe sunucu tarafındaki Zod şemasında da vardır ve iki yerin ayrışmasını bir
test kaynak dosyayı okuyarak engeller (`terms.test.ts` deseni).

## TEKLIF-33 — Teknik sayfa İKİ SÜTUNDUR; sayfalama ÇİZİMDEN AYRIDIR.

Kullanıcı isteği (18.08.2026): *"Teklif pdf inde sayfayı ikiye bölen çiftli bir
yapıya geçmek istiyorum … Notlar ve kapsam dışı işler de yan yana bölük olursa
güzel olur."*

Hangi grubun hangi sütuna ve hangi sayfaya düşeceğini **saf bir modül**
hesaplar (`lib/offers/pdf-layout.ts`); `pdf/offer.tsx` yalnız çizer. Ayrım
görgü değil ÖLÇÜLEBİLİRLİKTİR: hesap çizimin içinde olsaydı sütun düzenini
sınamanın tek yolu PDF üretip metnini geri okumak olurdu. Modül React/DB
görmez ve `pdf-layout.test.ts` ile doğrudan sınanır.

**KAZANÇ PUNTODAN DEĞİL, ETİKET SÜTUNUNUN KALKMASINDAN GELİR.** Tek sütunda
`ETIKET_GENISLIK = 148 pt` sabit bir etiket alanı vardı. HABAŞ fikstürü
(6 grup / 57 satır) tek sütunda 908 pt = **2 sayfa**; çift sütunda puntoya hiç
dokunmadan 893 pt = **1 sayfa**. Uzun değerlerin etiketleri kısadır (`Motor`,
`Redüktör`, `Fren`), o yüzden 234,78 pt'lik sütuna 57 satırın 56'sı tek satırda
sığar.

**SIRA KORUNUR; DENGELEME (bin packing) YAPILMAZ.** Bloklar sırayla sol sütunu
doldurur, dolunca sağa, o da dolunca yeni sayfaya geçer. Serbest dengeleme
ÇELİK'i KÖPRÜ'nün üstüne atıyordu — sayfa düzgün, belge YANLIŞ olurdu; müşteri
teknik sayfayı yukarıdan aşağıya, soldan sağa okur (`registry.ts`: "Sıra
BELGENİN SIRASIDIR").

**TAHMİN BİLEREK FAZLA ÖLÇER** (karakter katsayısı 0,52; gerçek bant
0,485–0,52) ve kapasite %94 ile kelepçelenir. Hata yönü SEÇİLMİŞTİR: fazla
ölçmek sütunu erken kapatır (boşluk kalır), az ölçmek satırı sayfa dışına
taşırır. Aynı sebeple sütun `View`i `wrap={false}` TAŞIMAZ — tahmin yanılırsa
react-pdf içeriği KIRPAR ve müşteriye giden belgede sessiz veri kaybı olur;
açık bırakılınca taşan blok bir sonraki sayfaya iner (çirkin ama eksiksiz).

**SIĞMAYAN GRUP BÖLÜNÜR, BAŞLIĞI TEKRAR EDİLİR** (`… (devamı)`) — fiyat
tablosunun `fixed` başlık satırıyla aynı ilke. `EN_AZ_KUYRUK = 2`: bir blok,
altında en az iki satır sığmayan konuma yerleştirilmez.

**SAYFA BAŞLIĞI O SAYFADAKİ GRUPLARIN KISA ADIDIR** ("GENEL · KALDIRMA ·
ARABA"). Kısaltmalar defterde YAZILIDIR (`OFFER_GROUP_SHORT`), ek atarak
türetilmez: "VİNÇ ARABASI" → "ARABA" bir ek kuralıyla çıkmaz (ilk kelime
"VİNÇ"tir, son kelimenin eki atılınca "ARABAS" olur). Kalemin adı sayfanın
sağ üst KÜNYESİNDEDİR ve kutusu kelepçelidir (`width: 150`) — esnek satırda
genişlik verilmezse büyük başlık bütün yeri alır ve künye ortasından kırpılır.

## TEKLIF-34 — GENEL ŞARTLAR: numara VERİ DEĞİLDİR.

Kullanıcı isteği (18.08.2026): *"Teklifin son sayfasına daha küçük ve biraz
silik bir yazı ile genel şartlar yazsın … bazılarını açıp kapatabileyim …
Madde numaraları da buna göre düzelsin."*

**`OfferTextLine` YETMEZ; `OfferGeneralTerm` ayrıdır** (`{id, key, title,
body, hidden}`): madde HEM BAŞLIK HEM GÖVDE taşır ve belgede farklı dizilir;
defterden gelen madde ile kullanıcının yazdığı ANAHTARLA ayrışır (500
karakterlik bir paragrafta metinle eşleşme kırılgandır — notlarda meşrudur,
çünkü orada madde tek cümledir).

**NUMARA SAKLANMAZ, SÜZGEÇTEN SONRA TÜRETİLİR** (`printedGeneralTerms`).
Gizlenen madde numarasını da götürür ve kalanlar 1'den kesintisiz sayılır;
numara veriye yazılsaydı bir maddeyi kapatmak belgede "3." diye bir boşluk
bırakır, müşteri orada silinmiş bir şart arardı. Editör AYNI numarayı
gösterir — ekran ile belge tek kaynaktan sayar.

**DEFTER `registry.ts`TE SABİTTİR, `offer_options`A GİRMEZ.** O tablonun
satırı tek bir `value`dur ve tekillik yalnız onun üstünden kurulur; gövde,
tekillik kuralının hiç göremediği bir alan olurdu. Ayrıca Tanımlar ekranı kısa
satırlar basar ve 667 karakterlik bir hukuk paragrafı o ekranı bozar. Dahası
bu bir DEĞER ÖNERİSİ değil HUKUKÎ BEYANDIR — `docs/agent/belge.md` aynı ayrımı
hesap raporunun gizlilik metni için zaten kurmuştur. **Kaçış kapısı yazılıdır:**
deploy'suz düzenleme gerekirse doğru yer `offer_options` değil ayrı bir
`offer_general_terms` tablosudur; sorun tablo değil satırın ŞEKLİDİR.

**TAŞIMA VARSAYILAN UYGULAMAZ** (TEKLIF-14 / MALIYET-22 ayrımı): eski bir
teklifte genel şartlar hiç yoktu ve taşıma onları sessizce eklerse yayımlanmış
bir belgenin metni değişmiş olur. Yeni belge hepsini AÇIK taşır
(`emptyPayload`); eski belgeye editördeki açık bir eylem getirir
(`withDefaultGeneralTerms` — "Defterden Getir").

**BELGEDE KÜÇÜK VE SİLİKTİR** (6,6 pt gövde, `gray600`): belgenin geri kalanı
8 pt / `ink`tir. Şartlar okunabilir ama öne çıkmaz — hukukî bir ek olduğu
tipografiden anlaşılır. TEK SÜTUNDUR: 6,6 pt'de 235 pt genişlik satır başına
~38 karakter demektir ve hukukî bir paragraf o genişlikte okunmaz.

## TEKLIF-35 — Teklif KONUSU kapaktan düzenlenir; dosya adı onu okur.

Kullanıcı isteği (18.08.2026): *"KAPAK bölümünde teklif Konusunu
düzenleyebilmeliyim. PDF ismi de oradan çeksin."* Konu bugüne kadar yalnız
teklif AÇILIRKEN soruluyordu; oysa kapsam çalışırken netleşir.

**KONU BELGENİN DEĞİL TEKLİFİN ALANIDIR** (`offers.subject`), revizyonun
payload'ında durmaz: liste, dosya adı, altbilgi künyesi ve maliyet belgesinin
adı hep onu okur. Payload'a taşınsaydı her revizyon başka bir konu taşıyabilir
ve teklif listesi hangisini göstereceğini bilemezdi. Bu yüzden payload'la
birlikte DEĞİL, kendi eylemiyle kaydedilir (`updateOfferSubject`) ve kaydetme
ODAK ÇIKINCA olur — her tuşta sunucuya gitmek yazarken on beş istek demekti.

**YAYIMLANMIŞ REVİZYON ENGEL DEĞİLDİR:** kilit REVİZYONUN metnine aittir, konu
ise teklifin künyesidir ve bir yazım hatası düzeltilebilmelidir.

`updateOfferDetails`ten AYRIDIR: o eylem müşteriyi, durumu ve para birimini de
ister ve hepsini birden yazar; kapaktaki kutu yalnız konuyu değiştirir.
Ötekileri de göndermek, editörde bulunmayan alanları bir varsayılanla ezmenin
yolu olurdu.

## TEKLIF-36 — SERBEST fiyat satırının maliyeti ELLE girilir.

Kullanıcı isteği (18.08.2026): *"Teklif fiyat kısmında serbest eklediğim
satırların maliyetini tabloda kendim girebileyim."*

MALIYET-11 serbest satırda maliyeti "—" gösteriyordu ve gerekçesi doğruydu:
maliyet belgesinde o satırın karşılığı YOKTUR, uydurma bir sayı sahte bir kâr
üretirdi. Ama İNSANIN yazdığı sayı uydurma değildir — nakliye, mobil vinç
kirası ya da bir ara ürünün alış fiyatı tam olarak bilinen şeylerdir.

**İKİ KAYNAK ASLA TOPLANMAZ:** satır bir kaleme bağlıysa maliyet BELGEDEN
okunur ve kutu hiç çizilmez; bağ yoksa kutu çizilir ve belge hiç okunmaz.

**TOPLAM SATIRI** maliyet belgesinin kendi toplamına YALNIZ serbest satırların
elle maliyetini ekler. Sütunu toplamak, aynı kaleme bağlı iki satırda o kalemi
iki kez sayardı (MALIYET-11); serbest satırları hiç eklememek ise girilmiş bir
gideri kâr hesabından düşürürdü. Kâr şeridi de bu toplamdan hesaplanır.

**MÜŞTERİYE GİTMEZ.** Alan teklif payload'ında yaşar ama `printedPayload` onu
belgeye basılan hâlden DÜŞÜRÜR — teklif PDF'inde maliyet diye bir sütun yoktur
ve olmamalıdır (MALIYET-1'in yapısal ayrımı). Koruma tek bir bileşenin
dikkatine bırakılmaz.

## TEKLIF-37 — Sayı çözümleyicisi TEKTİR (`parseNum`); nokta her zaman binlik değildir.

Kullanıcı bildirimi (18.08.2026): *"Teklif kısmında köprü açıklığında 12.44
metre girmek istiyorum."* Üç ayrı yerde üç yerel çözümleyici vardı ve üçü de
bütün noktaları siliyordu: `itemFactsFromRows` künyeye **1244 m** yazıyordu.
Sessizdi, çünkü belgeye BASILAN metin ("12.44 m") doğru kalıyor; bozulan yalnız
TÜRETİLEN sayı oluyordu — teklif listesindeki süzgeç ve maliyetin açıklık
girdisi yüz kat şişiyordu.

`parseNum` ayrımı YAZIMDAN okur: virgül varsa nokta binliktir ("1.500,25"),
yoksa nokta ancak **ardında tam üç hane** varsa binliktir ("1.500" → 1500).
"12.44" hiçbir Türkçe yazımda 1244 değildir; 1244 "1.244" diye yazılır.

## TEKLIF-38 — Teknik satır BÜYÜK HARF basılır; BİRİM ve ÖLÇÜ korunur.

Kullanıcı isteği (19.08.2026, md. 18): *"Teklifteki Özellikleri yazılarının ve
detaylarının tamamı büyük harf olsa daha profesyonel durur."*

**DÖNÜŞÜM SUNUM KATMANINDADIR, VERİDE DEĞİL.** `row.value` kullanıcının yazdığı
metindir ve teklif ekranında, analizde, maliyet eşleşmesinde aynen kullanılır;
büyütmeyi payload'a yazmak aynı bilgiyi iki yazımla saklamak olurdu.

**DÜZ BİR BÜYÜTME ÜÇ ŞEYİ BOZAR**, üçü de mühendislik belgesinde yazım hatası:
Türkçe "i" (`toUpperCase` "VINÇ" yapar), SI birimleri (**kW ≠ KW**, "m" metre
iken "M" mega öneki) ve ölçü/kod yazımı ("Ø20 6x36", "12.44m", "35-42 HRC").
`offers/buyuk.ts` `teknikDegerBuyuk` bu yüzden SÖZCÜK SÖZCÜK çalışır: rakam
taşıyan sözcük, eğik çizgili birleşik birim ("d/dak"), çarpım işareti "x",
tamamı küçük harfli birim ("m", "kg") ve zaten büyük yazılmış sözcük olduğu
gibi kalır. Kalanlar Türkçe büyür; **Türk alfabesinde q/w/x yoktur** ve
"ph"/"sch"/"ck" öbekleri geçmez — bu izleri taşıyan sözcük marka sayılıp
yerelsiz büyür ("Schneider" → SCHNEIDER, "Freni" → FRENİ).

**YALNIZ TEKNİK SATIRLAR BÜYÜR.** Ticari şartlar bir CÜMLEDİR ("Vinçlerin
yerine montajı ve devreye alınması dahildir.") ve büyük harfle bağırır.

**ÖLÇÜ DE DEĞİŞTİ:** büyük harf Archivo'da belirgin geniştir (fontkit ile on
gerçek etiket ölçüldü: 0,482 → 0,618). `pdf-layout.ts` `ETIKET_KATSAYI` 0,46'dan
**0,62**'ye çıkarıldı. Eski katsayı bırakılsaydı modül etiketi %28 dar sanar ve
iki ayrı yerden EKSİK ölçerdi — eksik ölçmek @react-pdf'in taşan satırı sessizce
kırpması demektir.

**METİN KATMANI TUZAĞI:** kapsam eki (`(Müşteri Kapsamında)`) mono dizilen
değerin içinde bir `Text`ti ve aile verilmediği için mono'yu miras alıyordu;
@react-pdf'in ürettiği alt kümede mono'nun ToUnicode eşlemesi büyük "I"yı "F"ye
bağladı ve belgeden kopyalanan metin "KAPSAMFNDA" çıktı. **Çizim doğruydu, METİN
KATMANI yanlıştı** — müşteri belgede arama yapsa bulamazdı. Ek artık sans
dizilir; duman testinde "KAPALI ALAN" savı bu tuzağın bekçisidir.

## TEKLIF-39 — Kapağın başlığı teklifin KONUSUDUR.

Kullanıcı isteği (19.08.2026, md. 20): *"En üstte büyük sadece TEKLİF yazacağına
konu en üstte verilebilir. Konu zaten teklifin içeriğini anlatıyor."*

- Büyük başlık `offer.subject`tir; konu zaten "… TEKLİFİ" diyebildiği için
  üstünde ikinci bir "TEKLİF" kicker'ı YOKTUR. Konu boşsa başlık "TEKLİF"e
  düşer — adsız bir kapak, yanlış adlandırılmış bir kapaktan da kötüdür.
- **PUNTO KADEMELİDİR** (22 / 17 / 14): konu uzunluğu teklifden teklife değişir
  ve @react-pdf'te `maxLines`/`textOverflow` YOKTUR, yani kırpma seçeneği de yok.
- **ÜNVAN KENDİ SATIRIDIR**: eskiden adın altında etiketsiz, girintili bir alt
  satırdı ve künyenin ızgarasına tutunmadığı için havada duruyordu.
- **LOGOLAR**: KİMDEN ve KİME artık iki ayrı karttır. İki kartta da 34 pt'lik
  sabit logo yuvası bulunur; müşteri logosu yoksa yuvanın zemini boş kalır ama
  metinlerin başlangıcı ve kart yüksekliği DEĞİŞMEZ. Değişken oranlı müşteri
  logolarının normalleştirilmesi TEKLIF-43'tedir.
- **ÜST BİLGİ** `REFERANS NO · …` ve `TARİH · …` etiketlerini açıkça taşır;
  tarih ve referans KİMDEN kartında tekrar edilmez. E-posta etiketi kurumsal
  yazımla `E-posta`dır.
- **FİRMA TANITIMI** imzaların altında ve sayfanın alt bölgesindedir (md. 22).
  Mutlak koordinatla sabitlenmez; kalan alanı alan esnek boşluk bloğu tanıtımı
  aşağı iter, uzun bir giriş geldiğinde daralır ve iki metnin üst üste binmesini
  engeller. Metin `registry.ts` `COMPANY_PROFILE` sabitindedir — defter
  kullanıcının seçtiği KISA değerleri taşır, bu ise firmanın BEYANIDIR. Duman
  testi kapağın TEK sayfa kaldığını savlar.

## TEKLIF-40 — Ticari sayfa İKİ SÜTUNDUR; fiyat tablosunun kendi başlığı vardır.

Kullanıcı isteği (19.08.2026, md. 15 ve 16). Sayfanın başlığı `terms.title`dır
ve metinden "FİYAT" sözcüğü ÇIKTI ("TESLİM VE ÖDEME ŞEKLİ"): fiyat artık
sayfanın kendi bölümüdür ve "FİYATLAR" başlığını taşır — kullanıcının bildirdiği
*"tablonun başlığı yok gibi duruyor"* tam olarak buydu.

- Solda TESLİM ŞARTLARI (ve varsa TEST YÜKÜ), sağda ÖDEME. **Sağ sütun boşsa tek
  sütuna dönülür** — yarısı boş bir sayfa, bölünmüş bir sayfadan kötü okunur.
- **ÖDEME KALEMİ KUTUDUR**, girintili küçük satır değil: oran solda ve büyük.
  Devralınan düzende teklifin en çok bakılan iki rakamı (yüzdeler) sayfanın en
  silik yerindeydi. Oran METİNDEN okunur ("%40 Avans…"), ayrı bir alandan değil
  — veriye ikinci bir gerçek açmak, kullanıcının yazdığı metinle çelişebilirdi.
- **NOTLAR da madde işaretli** (md. 17), kapsam dışı işler gibi.
- Bütün bölüm başlıkları TEK biçimdir (şerit + harf aralıklı ad): teknik öbekler,
  teslim, ödeme, test yükü, fiyatlar, notlar, kapsam dışı. Devralınan düzende
  ticari sayfanın başlıkları kalın kırmızı ve iki noktalıydı, teknik sayfanınki
  şeritliydi; aynı belgenin iki yaprağı iki ayrı belgeden çıkmış gibi duruyordu.
- **Sayfa başlığının altındaki öbek dizini KALDIRILDI** (md. 19). `OfferPdfSayfa.
  basliklar` alanı veride DURUR (testler onu sınar) ama artık basılmaz.

## TEKLIF-41 — Defter maddesi BÜYÜK HARF saklanır; beş liste MUAFTIR.

Kullanıcı isteği (19.08.2026, md. 4): *"Tanımlar defterler kısmındaki yazıları
büyük harfe çevir. Kapsam Dışı işler, Notlar ve Kapak Metinleri, Vinç Sınıfı
hariç."*

Muaf küme `OFFER_LIST_KEEP_CASE` (`offers/options.ts`) — `term.exclusion`,
`term.note`, `cover.honorific`, `cover.intro`, `val.craneClass`. Her biri
büyütmenin metni BOZDUĞU yerdir: ilk ikisi tam cümledir, sonraki ikisi kapak
metnidir ("Sayın … Bey," → "BEY,"), sonuncusu bir STANDART gösterimidir ("FEM
1Am" → "FEM 1AM" standarda aykırı).

**Dönüşüm VERİDE yapılır** (`offerValueUpper`): değer teklif payload'ına metin
olarak girer ve PDF onu basar; ekranı CSS ile büyütmek belgeyi değiştirmez ve
ekran belgenin yalanını söylerdi. Yazma yolu iki yerdedir ve İKİSİ DE kapatıldı
— Tanımlar ekranı (`tanimlar/actions.ts`) ve editörün "deftere ekle" kapısı
(`offers/actions.ts` `ensureOfferOption`); yalnız biri kapatılsaydı defter iki
yazıma bölünürdü. Devralınan maddeler tek seferlik bir göçle düzeltilir ve göçün
SQL'i `teknikDegerBuyuk`ün ikizidir (birim ve ölçü orada da korunur; iki taraf
ayrışırsa göç, uygulamanın yazmayacağı bir yazım üretir).

**MARKA LİSTELERİ AYRI DALDADIR** (`kimlikBuyuk`): "Siemens" → SIEMENS,
"Üntel" → ÜNTEL. Kabul edilen sınır, ASCII yazılan Türkçe bir markanın noktasız
büyümesidir ("Dereli" → DERELI); kullanıcı maddeyi noktalı yazdığında kip
Türkçeye döner ve düzeltme kalıcıdır.

## TEKLIF-42 — Kalem kopyası: kimlikler yenilenir, kopya kaynağın ARDINA girer.

Kullanıcı isteği (19.08.2026, md. 5): *"Buna çok benzer aynı teklif içerisinde
başka bir vinç var… o vinci tamamen kopyalamak isterim. Hızlıca birkaç
özelliğini değiştirip düzenlerim."*

`copyItemInPayload(payload, itemId)` (`offers/copy.ts`) — kalem, grupları ve
satırlarıyla kopyalanır; **her kimlik yenilenir**. Eski `id` kalsaydı fiyat
satırının `itemId` bağı iki kaleme birden bağlanır ve toplam bozulurdu.

- **AD `defaultItemTitle` İLE ÜRETİLİR** ("VİNÇ - 4"), kaynağın adı TAŞINMAZ:
  aynı ad belgede iki bölüm başlığı ve fiyat tablosunda iki aynı açıklama
  üretirdi (TEKLIF-7'nin dersi). " - 2" gibi bir ek ise yer tutucu olurdu —
  müşteri onu vincin adı sanardı.
- **FİYAT SATIRLARI DA KOPYALANIR.** Asimetri belirleyicidir: YANLIŞ fiyat
  görünür ve düzeltilir, EKSİK satır belgede hiç görünmez — teklif olduğundan
  ucuza gider ve hata ancak sipariş alındıktan sonra anlaşılır. Toplamın anında
  artması gizlenmez, bildirimde SÖYLENİR.
- **KOPYA KAYNAĞIN HEMEN ARDINA GİRER**, sona değil: belge kalem sırasıyla
  basılır ve editörde kalemleri yeniden sıralamanın yolu yoktur; yerleştirme bir
  kolaylık değil, tek şanstır.

## TEKLIF-43 — Müşteri logosu: canlı okunur, yoksa belge bozulmaz.

Kullanıcı isteği (19.08.2026, md. 21). `customers.logo_path` + Storage;
teklif PDF ucu dosyayı indirip `customerLogo` **buffer**ı olarak geçirir
(çekirdek DB/HTTP görmez, değişmez md. 7).

**LOGO CANLI OKUNUR, ADRES/VERGİ BİLGİSİ OKUNMAZ.** TEKLIF-15 kapağa yazılan
bilginin FOTOĞRAF olduğunu söyler: defter yarın düzeltilince yayımlanmış bir
teklifin yeniden üretilen PDF'i değişmemelidir. Marka bir OLGU değil KİMLİKTİR —
firmanın bugünkü logosu, dünkü teklifte de onun logosudur.

**İNDİRME HATASI BELGEYİ DÜŞÜRMEZ:** logo alınamazsa `null` geçilir ve teklif
logosuz basılır. Bir müşteri logosu yüzünden teklif PDF'inin 500 dönmesi kabul
edilemez.

**ORAN VE TUVAL NORMALLEŞİR (20.08.2026):** yatay, kare ve dikey logo aynı
fiziksel yuvaya ham tuvaliyle verilemez. Dosyanın kenarındaki saydam veya
beyaz dış boşluk görünür sınıra kadar kırpılır; renkli kurumsal zemin ise
korunur. Görünür içerik oranı bozulmadan 840 × 180 px iç alana sığdırılır ve
30 px güvenli payla 900 × 240 px saydam standart tuvalin ortasına alınır.
PDF'de bu tuval 120 × 32 pt çizilir. Böylece kaynak dosyanın rastlantısal
boşluğu, çözünürlüğü veya en-boy oranı logonun konumunu değiştiremez.

Normalleştirme hem yükleme anında hem PDF için canlı indirme sonrasında
yapılır. İkinci geçiş BİLEREKTİR: bu kuraldan önce yüklenen ASTOR gibi geniş
boşluklu eski logolar da yeniden yükleme istemeden düzelir. Kaynak en büyük
kenarda 6000 px ile sınırlıdır; 16 bit, paletli ve interlaced PNG'ler sRGB 8 bit,
paletsiz ve progressive olmayan PNG'ye çevrilir. Boş/bozuk dosya yine `null`
olur; logo yuvası boş kalırken künye düzeni korunur.

## TEKLIF-44 — Teklif sayfalarının görsel hiyerarşisi sabittir.

Kullanıcı isteği (20.08.2026): teknik değerlerin iç içe girmemesi, özellik adı
ile değerinin ayırt edilmesi, ticari ana başlıkların ve fiyat tablosunun daha
güçlü görünmesi.

- Teknik satır iki SABİT sütundur: etiket %34, aralık 10 pt, değer kalan alan.
  Değer ikinci satıra geçtiğinde etiketin altına değil kendi sütununa sarılır;
  çizim ve `pdf-layout.ts` ölçümü aynı genişliği kullanır.
- Etiket Archivo Medium ve gri, değer IBM Plex Mono Medium ve koyu renktir.
  Renk farkı yalnız dekor değil, tanım/veri ayrımıdır.
- `TESLİM VE ÖDEME ŞEKLİ` 18 pt; `TESLİM ŞARTLARI` ile `ÖDEME` diğer küçük
  şerit başlıklarından daha büyüktür.
- Fiyat satırlarının tanımı, opsiyon eki ve adet/birim hücresi Türkçe büyük
  harfle basılır; sayı ve para gösterimi değişmez.

## TEKLIF-45 — Fiyat sırası iki seviyelidir ve seçimlidir.

Kullanıcı kararı (20.08.2026): bir vinç ana satırı `1`, ona bağlı yürüme yolu,
bara ve benzeri satırlar isteğe bağlı `1.1`, `1.2` olabilir; bağ seçilmezse
satır normal ana sıra olur ve sonraki vinç `2` diye devam eder.

Bağ `OfferPriceLine.parentLineId` ile satır KİMLİĞİNE kurulur, basılmış sıra
metni saklanmaz. Yalnız daha önce gelen bir ANA satır ebeveyn olabilir ve
katman sayısı ikidir. Silinmiş, daha sonra gelen veya kendisi alt satır olan
bir ebeveyn bağı ana satıra yükseltilir. Editör ve PDF aynı
`priceLineNumbers` çekirdeğini okur; teklif başka müşteriye veya kalem aynı
teklif içinde kopyalanırken fiyat satırı kimlikleriyle ebeveyn bağı da yeniden
eşlenir.

Teslim şartları ve test yükü satırları da teknik büyük-harf sunumundan geçer;
ölçü/SI birimleri korunur. Ödeme kutularının açıklaması Türkçe büyük harftir
(`%50 AVANS SİPARİŞ İLE NAKİT`). Bu bir sunum kararıdır, kullanıcının payload
metni değiştirilmez.
## TEKLIF-46 — Kapak İKİ BÖLGEDİR: kömür bant + kağıt bölge.

Kullanıcı tasarımı (Claude Design, 22.08.2026 — `Teklif Kapak.dc.html`). Kapak
artık marjlı bir metin sayfası değil, kenardan kenara boyanan bir YAPRAKTIR
(`BrandPage bleed`): üstte kömür bir bant, altında kağıt bir bölge, ikisinin de
üzerinden geçen kırmızı omurga.

**Kömür bant** — 135° çapraz şerit dokusu, kağıt renkli lockup, sağda
`REFERANS NO · … / REV nn · TARİH · …`, altında kırmızı kural; sonra kırmızı
çubuk + MERCAN kicker, teklifin KONUSU 33 pt'ye kadar, müşterinin adı ve
İÇİNDEKİLER. **Kağıt bölge** — KİMDEN/KİME künyesi, hitap ve giriş, (varsa)
imzalar, firmanın beyanı ve İŞ KOLLARIMIZ ızgarası.

Ölçüler tasarımdan ÇEVRİLDİ, yeniden uydurulmadı: tasarım CSS px'te
çalışıyordu ve 210 mm'lik bir sayfada 1 px = 0,75 pt'tir. mm cinsinden verilen
paylar (16 üst / 16 dış / 13 alt / 22 iç) sayfanın kendi marjlarıyla zaten
aynıydı — bant ile kağıt bölge tek bir ızgarayı paylaşır.

**TAM KANAMADA OMURGA EN SONDA ÇİZİLİR** (`brand.tsx`): boyama sırası akış
sırasıdır ve kenardan kenara bir bant, önce çizilmiş omurganın üstünü örterdi.
Aynı sebeple kapakta ÇAPRAZ FİLİGRAN BASILMAZ: kömür bant, lockup ve omurga
markayı zaten taşır, %6 opaklıklı ikinci bir işaret orada gürültü olurdu.

**ŞERİT DOKUSU SVG'DİR VE KUTU ONU KIRPAR.** @react-pdf
`repeating-linear-gradient` bilmez; döndürülmüş kutulardan şerit kurmak her
şeridi ayrı bir yerleşim düğümü yapardı. Doku mutlak konumludur, bandın
kesebileceğinden büyük verilir ve kap `overflow: "hidden"` ile fazlasını atar —
bant içeriğiyle büyüdüğü için sabit ölçülü bir doku başka türlü yetişemezdi.
Ölçü kılavuzun kendi CSS'idir: dik yönde 12 px şerit / 24 px periyot (9 pt /
18 pt); 45°'lik bir çizgide aynı periyodun x karşılığı √2 katıdır.

**KAĞIT LOCKUP VE KÖMÜR MONOGRAM ÜRETİLİR** (`scripts/make-icons.ts`):
`orion-logo-paper.png` ve `orion-symbol-ink.png`. Tam renkli lockup kömür
zeminde okunmaz (kırmızı kilit gömülür, "CRANES" grisi kaybolur); beyaz kartın
köşesi ise kelime markasını değil YALNIZ monogramı ister — firma adı zaten
kartın içinde yazılıdır. Oran dosyanın PNG başlığından OKUNUR (`pngOrani`),
elle yazılmaz: sabit bir oran, görsel yeniden üretildiğinde sessizce logoyu
esnetirdi.

## TEKLIF-47 — Kapak künyesi ETİKETSİZDİR; iki taraf TEK kutunun içindedir.

TEKLIF-39'un "Adı ve Soyadı : … / Ünvan : …" etiketli satırları KALKTI
(kullanıcı tasarımı, 22.08.2026). Kart artık bir iletişim bloğudur: mono
etiket (`KİMDEN` / `KİME`) ve marka aynı satırda, altında kurumun adı, sonra
`Ad Soyad · Ünvan`, ince bir çizgiden sonra telefon ve e-posta. Etiket, bir
iletişim satırını ikinci kez adlandırmaktı.

**İKİ TARAF TEK KUTUDADIR**, aralarındaki oluk kaldırıldı: kutu tek olunca iki
taraf aynı yüksekliğe kendiliğinden oturur ve künye bir "kart çifti" değil bir
MUHATAP ÇİZELGESİ gibi okunur.

**BOŞ ALAN HİÇ ÇİZİLMEZ** (TEKLIF-36 devam ediyor): ünvanı olmayan kişide
ayıraç da düşer, telefonu olmayan muhatapta iletişim bloğu hiç açılmaz.
**MÜŞTERİ REFERANSI KİME TARAFINDADIR** (`MÜŞTERİ REF · 6000294866`):
müşterinin kendi talep/sipariş numarasıdır, bizim künyemizin değil.

**LOGO YUVASI SABİT YÜKSEKLİKTEDİR (32 pt)** — müşteri logosunun
normalleştirilmiş tuvali (120 × 32 pt, TEKLIF-43) oraya oturur; logo olsa da
olmasa da iki hücrenin metni aynı taban çizgisinden başlar.

## TEKLIF-48 — İÇİNDEKİLER belgeden çıkar; sayfa numarası ÖLÇÜLÜR.

Kapak üç kutuluk bir dizin taşır: bölümün sayfa aralığı (mono, ilki mercan) ve
adı. **Liste belgenin KENDİSİNDEN türer** — basılmayan bölüm listelenmez
(kalemsiz teklifte "Teknik Özellikler" yoktur, şart maddesi kalmamışsa "Genel
Şartlar" yoktur). Ayrı bir liste tutulsaydı gizlenen bir bölüm kapakta durmaya
devam ederdi.

**SAYFA NUMARASI İKİ GEÇİŞLE ÖĞRENİLİR** (`renderOfferPdf`): bir bölümün kaç
yaprak tuttuğu önceden bilinemez — teknik sayfa sayısını `pdf-layout` hesaplar
ama ticari sayfa da genel şartlar da içeriğine göre taşabilir. Birinci geçişte
her bölümün açıldığı ve kapandığı yaprak `Sonda` ile toplanır (hesap raporunun
`SectionProbe` reçetesi), ikincisi numaralarla basar. Numara bilinmiyorsa
`S. —` yazılır; UYDURULMAZ — tahmin edilen bir sayfa numarası müşteriyi olmayan
bir yaprağa gönderirdi.

**BÖLÜM ADI TEK KAYNAKTIR** (`OFFER_SECTIONS`): aynı metin hem içindekiler
kartına hem sayfanın kicker'ına gider (kicker `trUpper` ile büyür). Genel
şartların kendi başlığı defterdedir (`GENERAL_TERMS_TITLE`, BÜYÜK HARF); kartta
başlık yazımı durur ve ikisinin ayrışmasını bir test engeller (değişmez md. 8).

**KAPAK KİCKER'I DA BELGEDEN ÇIKAR**: teknik yaprağı olan teklif "TEKNİK VE
TİCARİ TEKLİF"tir, yalnız fiyat ve şart taşıyan teklif "TİCARİ TEKLİF".
Kapakta belgede olmayan bir bölüm vaat edilmez.

## TEKLIF-49 — Kapak TEK SAYFADIR; sıkışması ÖLÇÜLEREK seçilir.

Tasarımın nefes payları, uzun içerik yığıldığında taşıyordu: dört satırlık bir
konu + künyede saran bir müşteri unvanı ("… İSTİHSAL ENDÜSTRİSİ A.Ş.") + uzun
ünvan/bölüm satırları + iki imzacı. @react-pdf taşan bloğu sessizce ikinci bir
yaprağa atıyor ve müşteriye ALTBİLGİDEN İBARET boş bir sayfa gidiyordu.

Payları içeriğin uzunluğuna bakarak tahmin etmek yerine **belge ölçülür**:
`renderOfferPdf` zaten iki geçiş yapıyor ve ilk bölümün açıldığı yaprak
kapağın kaç sayfa tuttuğunu söylüyor. İki değilse kademe artar ve yerleşim
yeniden koşar (`KapakYogunlugu`):

- `0` — tasarımın kendi payları.
- `1` — bölge araları kısalır (bant içi, içindekiler, hitap, iş kolu satırı).
- `2` — İŞ KOLLARI ızgarası düşer; tasarımın kendi anahtarıdır
  (`showBusinessLines`) ve kapağın en uzun, en az kritik bloğudur — firmanın
  BEYANI kalır, listesi düşer.

**KISALAN ŞEY BOŞLUKTUR, PUNTO DEĞİL**: metni küçültmek belgeyi okunmaz yapar,
aralığı kısmak yalnız daha yoğun gösterir.

**KAPAĞIN SONUNA KONAN BİR SONDA BU SORUYU CEVAPLAMIYORDU** ve bu, bir kez
denenip düşen yoldur: taşan blok kağıdın dışına çizilir ama sıfır yükseklikli
düğüm hâlâ birinci yaprakta yerleşmiş sayılır, sonda "1" bildirir. Bir sonraki
bölümün nerede AÇILDIĞI ise ölçülen bir olgudur.

Olağan teklif yine İKİ GEÇİŞTİR — kapak taşmazsa döngü ilk turda biter.

## TEKLIF-50 — İç sayfaların başlığı ve altbilgisi kapakla AYNI DİLİ konuşur.

Kullanıcı isteği (22.08.2026): *"teklifin sadece kapağını değil, alt
sayfalarındaki header ve footer'ı da ayarla, genel yapı tutarlı olsun."*

**SAYFA BAŞLIĞI** (`SayfaBasi`, belgenin bütün iç yaprakları): kırmızı çubuk +
mono kicker solda, doküman künyesi (`TETR-… · REV nn`) sağda, altında sayfanın
büyük başlığı ve bölgeyi kapatan KÖMÜR kural. Kapaktaki aynı anatominin kağıt
ölçeğidir; kılavuz kuralı kömür zeminde kırmızıya çevirir, kağıtta kömür
bırakır.

Büyük başlık kendi satırını bütünüyle kullanır (18.08.2026 çakışma tuzağı hâlâ
geçerlidir); künye KİCKER satırındadır ve ikisi de kısa mono metinlerdir.

**YÜKSEKLİK BÜTÇESİ KORUNDU.** Blok ~43 pt'tir ve `PDF_SUTUN_KAPASITE` o payı
düşer. Kural eklenirken kicker–ad arası ve blok altı kısaldı; kural bedavaya
gelmedi ama sütun kapasitesinden de bir pt almadı. Buraya dokunan herkes aynı
hesabı yeniden yapmak zorundadır — bir teknik sayfa 1 pt yüzünden ikiye
bölünür.

**ALTBİLGİ** (`BrandPage brandFooter`, opt-in): doküman satırı KÖMÜR ve yarı
kalın, folionun önünde 5 pt'lik kırmızı kare. Satır markayla açılır —
`ORION CRANES · TETR-20260127-1 · REV 02 · 27.01.2026 · KONU` — çünkü müşteri
belgenin bir yaprağını tek başına fotoğraflasa bile kimin, hangi teklifinin,
hangi revizyonunun, hangi işi olduğu okunabilmelidir. **KAPAKTA KONU DÜŞER**:
konu zaten sayfanın 33 pt'lik başlığıdır (hesap raporunun `coverDocLineFor`
kuralıyla aynı gerekçe).

**FİRMA KÜNYESİ DOKÜMAN SATIRININ ÜSTÜNDEDİR**, altında değil — tasarımda sıra
terstir ve bu bilinçli bir sapmadır: oradaki adres kısaltılmıştı, firmanın
TESCİLLİ adresi telefon, e-posta ve web ile birlikte içerik genişliğinin
TAMAMINI ister ve künye TEK SATIR kalmak zorundadır. Yanına folio konulunca ya
künye sarıyor ya folio kağıdın dışına taşıyordu; ikisi de ölçüldü. Sıra tersine
dönünce folio doküman satırıyla kalır ve **sayfa numarasının kağıt dibine
uzaklığı künyeli kapakta da künyesiz iç sayfada da AYNIDIR.**

Altbilgi kipi OPT-IN'dir: hesap raporu, iş emri, bordro ve ekipman listesi
bugünkü altbilgisiyle kalır. Teklifin dilini bütün belgelere yaymak AYRI bir
karardır ve yerleşim denetçilerini birlikte götürür.

## TEKLIF-51 — İŞ KOLLARIMIZ bir CÜMLE değil, madde madde listedir.

`COMPANY_PROFILE.products` (` · ` ile bağlanmış üç satırlık gri bir dizi)
kaldırıldı; yerine `lines` dizisi geldi ve kapakta iki sütunlu, 7 px kırmızı
kare madde işaretli bir ızgara olarak basılır. Eski yazımda okur hiçbir iş
kolunu seçemiyordu.

**SIRA SATIR YÖNÜNDEDİR** (1|2 / 3|4 …), sütun yönünde değil: `flexWrap` ile
kurulan ızgara tasarımdaki okuma sırasını korur. Liste sabittir ve teklife göre
değişmez — defter kullanıcının seçtiği KISA değerleri taşır, bu ise firmanın
BEYANIDIR.
## TEKLIF-52 — Ticari sayfa: BAŞLIK + BEYAZ KUTU çiftleri.

Kullanıcı tasarımı (Claude Design, 22.08.2026 — `Teklif Ticari Sartlar.dc.html`).
Sayfanın dört bölgesi vardır ve her biri bir **3 pt şerit + mono etiket + beyaz
kutu** üçlüsüdür:

1. **TESLİM ŞARTLARI** (sol, geniş sütun; şerit KIRMIZI) — etiket/değer
   çizelgesi. Etiket mono ve gri, değer sans ve koyu: renk farkı dekor değil,
   TANIM/VERİ ayrımıdır (TEKLIF-44'ün teknik satırdaki kuralı).
2. **ÖDEME PLANI** (sağ sütun; şerit kömür) — her taksitin sol kenarında 3 pt
   omuz, İLK taksitinki KIRMIZI: plan bir SIRADIR ve gözün nereden başlayacağı
   belli olmalıdır. Oran satır metninden okunur (TEKLIF-40'ın kuralı sürüyor).
3. **TEST YÜKÜ** (ödeme planının altında) — etiket solda, değer mono ve sağda.
4. **FİYATLAR** (tam genişlik; şerit KIRMIZI) — sağında `PARA BİRİMİ · EUR`.

Devralınan düzende bunlar çıplak `Etiket : Değer` satırlarıydı ve sayfanın
neresinin nerede bittiği ancak punto farkından okunuyordu.

**SAYFA BAŞINA TEK VURGU** korunur: teslim şartları ve fiyatlar kırmızı açılır,
ödeme planı ile test yükü kömür. Hepsi kırmızı olsaydı vurgu vurgu olmaktan
çıkardı.

**ÖDEME PLANININ GİRİŞ CÜMLESİ BASILMAZ** (TEKLIF-56).

**NOTLAR VE KAPSAM DIŞI İŞLER SAYFANIN DİBİNDEDİR**, yan yana ve kare madde
işaretli: notlarda KIRMIZI, kapsam dışında GRİ. Biri teklifin kendi sözü, öteki
teklifin DIŞINDA kalanların listesidir ve okurun ikisini karıştırmaması gerekir.
Yerini esnek boşluk verir; mutlak konum kullanılmaz — uzun bir liste geldiğinde
boşluk kendiliğinden kapanır.

**ÖDENECEK RAKAM KÖMÜR ŞERİTTEDİR** ve tablonun en büyük yazısıdır (14,25 pt
mono); ara toplamlar (TOPLAM, İSKONTO) onun üstünde açık zeminde durur. Şeritte
KDV rozeti (`vatBadge`) vardır ve tablonun altındaki cümleyle (`vatNote`) AYNI
BAYRAKTAN türer — ikisi çelişemez.

**MARKA SATIRI** (`SayfaBasi marka`): solda KÖMÜR lockup, sağda iki satırlık
doküman künyesi, altında KIRMIZI kural. Ticari şartlar ve genel şartlar
sayfaları bunu taşır. **TEKNİK SAYFALAR TAŞIMAZ ve bu bir tutarsızlık değil bir
ÖLÇÜDÜR:** lockup satırı ~40 pt yer yer ve o pay `PDF_SUTUN_KAPASITE`den gider;
ölçüldüğünde ASTOR portal vincinin gövdesi tek yaprakta durmuyor, ikiye
bölünüyordu. Teknik sayfada kimlik satırı KİCKER'IN İÇİNE iner (çubuk + kicker
solda, künye tek satır sağda) ve aynı kırmızı kural onu kapatır — anatomi aynı,
yoğunluk farklı. Marka kapakta, ticari sayfada ve altbilginin her satırında
zaten vardır.

**KÖMÜR LOCKUP DA ÜRETİLİR** (`orion-logo-ink.png`, `scripts/make-icons.ts`):
tam renkli sürüm bu yaprakta ikinci bir kırmızı lekesi olurdu — kırmızı burada
kicker ve kurala ayrılmıştır.

## TEKLIF-53 — Kalem bazında TESLİM SÜRESİ sütunu (opsiyonel).

Kullanıcı isteği (22.08.2026): *"Fiyat tablosunda Adet'in soluna Teslim Süresi
sütunu açılsın. Sütun başlığında hafta ya da ay belirtilsin. Sütunda 6-7 gibi
yazacak, dar bir sütun olsun. Bu opsiyonel olacak; bazen kalem bazında teslim
süresi vermem gerekiyor."*

- **AÇMA KARARI TEKLİFİNDİR**, satırın değil: `pricing.leadTimeUnit`
  (`"hafta" | "ay" | null`). `null` sütunun KAPALI olduğunu söyler — sıfır ya
  da boş bir birim değil. Kapalıyken ticari şartlardaki TEK teslim süresi
  geçerlidir ve boş bir sütun müşteriye "burada bir şey eksik" diye okunurdu.
- **BİRİM SÜTUN BAŞLIĞINDADIR** (`TESLİM (HAFTA)`), satırda değil: her satıra
  "hafta" yazmak dar bir sütunu okunmaz yapardı ve zaten tek birim geçerlidir.
- **DEĞER SAYI DEĞİL METİNDİR** (`OfferPriceLine.leadTime`): yazılan şey çoğu
  zaman bir ARALIKTIR ("6-7") ve tek bir sayı alanı onu taşıyamaz; iki alan
  (en az / en çok) açmak da dar sütunu iki kutuya bölerdi.
- **SÜTUN KAPALIYKEN DEĞER KORUNUR AMA BASILMAZ**: kullanıcı sütunu kapatıp
  yeniden açtığında yazdıkları yerinde durur. Değeri girilmemiş satırın hücresi
  BOŞ kalır — `0` ya da `—` yazılmaz (değişmezler md. 4 ve 5).
- **BİRİM LİSTESİ DEFTERDE DEĞİL KODDA KAPALIDIR** (`LEAD_TIME_UNITS`): bunlar
  bir kullanıcı tercihi değil, sütun başlığının iki olası yazımıdır. Defterdeki
  `val.deliveryUnit` ticari şartların teslim süresi CÜMLESİNİ kurar; o listeye
  yeni bir madde eklemek bu sütunu bozmamalıdır.

Editörde tuş sütunu AÇAR ve birimi o anda seçtirir; birimi sonradan soran ikinci
bir kutu, sütunu birimsiz açık bırakabilirdi. Sütun ekranda da ADET'İN SOLUNDA
durur — ekranla kâğıt ayrışsaydı kullanıcı hangi kutuya ne yazdığını belgeden
doğrulayamazdı.

## TEKLIF-54 — Fiyat tablosu ON İKİ SATIRDAN sonra KENDİ yaprağına geçer.

Kullanıcı kararı (22.08.2026): *"Fiyatlar tablosunda 12 satıra kadar bu dizayn
uygulanabiliyor. Eğer 12 satırın üstünde bir fiyat kalemi varsa fiyat tablosu
ayrı sayfaya geçsin. Tablo ikiye bölünmesin."*

Eşik (`FIYAT_SATIR_ESIGI = 12`) SAYFANIN KENDİ ÖLÇÜSÜNDEN gelir: ticari sayfada
başlık (~95 pt), teslim/ödeme bloğu (~135 pt), notlar ve kapsam dışı işler
(~90 pt) ve altbilgi payı düşüldüğünde tabloya ~300 pt kalır; bir satır ~22
pt'dir. On üçüncü satır tabloyu notların üstüne bindirir ya da @react-pdf
tabloyu ikiye böler.

Tablo kendi yaprağına geçtiğinde **içindekilerde de kendi satırını açar**
(`OFFER_SECTIONS.fiyat`): müşteri kapakta "Fiyatlar"ı arar ve o yaprak artık
ticari sayfa değildir. Yaprakta "FİYATLAR" sayfanın büyük başlığıdır; şeritte
ikinci kez yazılmaz, orada yalnız para birimi kalır.

**KENDİ YAPRAĞI DA SONSUZ DEĞİLDİR.** Marka satırlı bir sayfaya ~19 fiyat
satırı sığar; daha uzun bir tablo yine bölünür ve bunun alternatifi YOKTUR —
`wrap={false}` verilseydi @react-pdf tabloyu kırpardı, yani müşteriye giden
belgede sessiz veri kaybı olurdu. Bölünen tabloda sütun başlığı `fixed` olduğu
için her yaprakta tekrar eder.
## TEKLIF-55 — Fiyat satırının boyu SATIR SAYISINA göre açılır.

Kullanıcı isteği (22.08.2026): *"Fiyatlar tablosu satır genişliklerini dinamik
yapabilir miyiz. 12 satır varsa 20 yükseklik, 4 satır varsa 30 yükseklik olsun…
az satır varken satırların sıkışık görünmesi mantıklı değil."*

Dört satırlık bir tablo, on iki satırlık bir tablonun sıkılığıyla dizildiğinde
sayfanın ortasında küçük ve ezik duruyordu. `FIYAT_SATIR_BOYU`: **4 satır →
30 pt, 12 satır → 20 pt**, arası DOĞRUSAL, iki uçta kelepçeli (üç satırlık bir
tablo dörtlükten daha havalı olmaz, on beşlik on ikiden daha sıkı olmaz).

**ÖLÇEKLENEN ŞEY PAYDIR, PUNTO DEĞİL**: metni büyütmek tabloyu bir başlığa
çevirirdi; payı açmak yalnız nefes verir. Üst sınır TEKLIF-54'ün eşiğiyle aynı
yerdedir (12) — o sayıdan sonra tablo zaten kendi yaprağına geçer ve orada sıkı
satır DAHA ÇOK satır, yani tablonun ikiye bölünme ihtimalinin azalması demektir.

**YER YOKSA SIKIŞIR VE BU DA ÖLÇÜLÜR.** Uzun ticari şartlar + dört taksitlik
plan + uzun not/kapsam listeleri üst üste geldiğinde açılan pay ticari sayfayı
taşırıyordu. `renderOfferPdf` bölümün açıldığı ve kapandığı yaprağı
karşılaştırır (`bas:ticari` / `son:ticari`); taşma varsa satırlar en sıkı
boylarına iner ve yerleşim yeniden koşar (`compactPrices`). Kapağın sıkışma
kademesiyle aynı döngüdedir; kural tek cümleyle şudur: **yer varken geniş, yer
yokken sıkı.**

Kendi yaprağındaki tablo hiç sıkışmaz — orada yer sorunu yoktur.

**SIKIŞTIRMA DA YETMEZSE TABLO KENDİ YAPRAĞINA SÜRÜLÜR** (`priceOwnPage`,
TEKLIF-65): kalem bazında iskonto basıldığında hücreler iki katmanlıdır ve satır
payı en aza indiğinde bile tablo eski boyuna dönmez.

## TEKLIF-56 — Ödeme planının GİRİŞ CÜMLESİ belgeye basılmaz.

Kullanıcı isteği (22.08.2026). Defterden gelen `payment` satırı ("Ödeme şekli
aşağıda belirtilen şekildedir.") kutunun altında gri bir cümle olarak
duruyordu ve hemen üstündeki **ÖDEME PLANI** başlığının söylediğini ikinci kez
söylüyordu.

Satır **payload'da durmaya devam eder** (defterin alanıdır ve kullanıcı onu
düzenleyebilir); yalnız belgede yeri yoktur. Bunun ardından `odemeVar` da
değişti: blok artık YALNIZ PLANIN KENDİSİNE bakar (`terms.paymentLines`), yoksa
planı olmayan bir teklifte boş bir kutu açılırdı.

## TEKLIF-57 — Muhatabın E-POSTASI kapağa girer; seçim KİMLİK DEĞİŞTİRMEDİR.

Kullanıcı isteği (22.08.2026, md. 1): *"Müşteriler sayfasında kişi e-postası
alıyoruz. Ancak teklifte Kime kısmında e-posta yeri yok. otomatik gelsin.
Teklif pdf'e de ekleyelim."*

`OfferCover.toEmail` — `fromEmail`in ikizidir ve **ayrı bir alandır**: telefonla
e-posta tek satırda taşınsaydı kapak künyesi ikisini ayıramaz, yalnız biri
bilinen bir muhatapta ayıraç boşta kalırdı (TEKLIF-36).

- **Defterden seçim KOŞULSUZ yazar** (`coverFieldsFromContact`). KİMDEN
  tarafındaki *"varsa yaz"* kalıbı burada geçerli DEĞİLDİR: KİME'de kişi
  seçmek bir kimlik değiştirmedir ve A kişisinden B'ye geçerken B'nin e-postası
  boşsa A'nınki kalmamalıdır.
- **Kopyalamada BOŞALIR** (`copyPayloadForCustomer`). Bu bir gizlilik
  kuralıdır: `toName` ve `toPhone` boşalırken e-posta kalsaydı, önceki firmanın
  satın alma müdürünün adresi yeni müşteriye giden belgede dururdu.
- Kapakta **telefonun altında, MÜŞTERİ REF'in üstünde** basılır; boşsa hiç
  basılmaz (TEKLIF-36 kuruluş kuralı, ayrı bir bayrak gerekmez).
- Biçim doğrulaması **yapılmaz**: defterde duran mevcut adresleri geriye dönük
  reddetmek, kaydı düzeltilene kadar teklif açılamaz hâle getirirdi.

## TEKLIF-58 — Kalem ekleme ÜÇ KİPLİDİR; KAYNAK SEÇİLİR.

Kullanıcı isteği (22.08.2026, md. 2): *"Teklife kalem ekle derken ilk kalemin
marka tercihini kopyala tuşu var. Bunu geliştirmek istiyorum. Hem her istediğim
kalemi seçip kopyalayabileyim. hem ister marka ve tercihleri, ister tüm kalemin
aynısını direk kopyalayabileyim. Kalemler arasında dropdown seçebileyim."*

YENİ BİR KOPYALAMA ALGORİTMASI YAZILMADI. İki kip zaten vardı ve ikisi de
KİPSİZDİ: "marka ve tercihler" `copySelections`tı ve yalnız `items[0]`dan
çalışıyordu; "tamamı" ise kalem düzenleyicideki **Kalemi Kopyala** düğmesinin
çağırdığı `copyItemInPayload`tı ve yalnız AÇIK OLAN kalemden. Pencere ikisini
tek soruya indirir: hangi kalemden, ne kadarı.

- **Kip bir RADYO GRUBUDUR** (yok · seçim · tam): seçenekler birbirini dışlar.
- **"Tam" kipinde şablon ve başlık kutuları DEVRE DIŞIDIR, gizlenmez**:
  kullanıcı neyin niçin sorulmadığını görmelidir. Bölümler, ölçüler ve ad
  kaynaktan gelir.
- **"Tam" kipi kaleme bağlı FİYAT SATIRLARINI da getirir** ve kopya kaynağın
  ARDINA girer (TEKLIF-42). İkisi de seçeneğin alt açıklamasında YAZILIDIR,
  yalnız bildirimde değil — toplam anında artar.
- **KAYNAĞI SERBEST OLAN "seçim" kipi KAPALIDIR.** `copySelections` defter
  satırlarını `key` ile eşler; serbest kalemin defterde karşılığı yoktur ve
  fonksiyon sessizce hiçbir şey taşımaz. TEKLIF-33'ün HEDEF tarafındaki
  kuralının KAYNAK tarafındaki aynası.
- **Sınıflandırma DEFTERDEN DEĞİL `OLCU_PARCALARI` kümesinden çıkar** ve bu
  bilinçlidir: `power`, `rpm` ve `dia` LİSTELİDİR ama birer ÖLÇÜDÜR; `list`
  alanına bakan bir kural ikinci vincin motor gücünü birincininkiyle
  doldururdu. Kural iki yerde yaşadığı için `__tests__/olcu-parcalari.test.ts`
  ikisini birden okur (değişmez md. 8).

## TEKLIF-59 — Defterden ÇIKAN satır EMEKLİYE AYRILIR, silinmez.

Kullanıcı isteği (22.08.2026): *"kalem içerisinde vinç tipini iki kere
alıyoruz. Genel özelliklerdeki vinç tipini iptal edelim"* (md. 3) ve *"Köprü
grubunda Yürüme Yolu Rayı'nı iptal edelim. Köprü rayı zaten yeterli."* (md. 5)

Bir satırı defterden silmek YENİ kalemleri temizler, ESKİLERİ temizlemez:
`withDefaults` tanınmayan satırı KORUR (kendi gerekçesi orada yazılı — bir
taşıma fonksiyonu veri silmez) ve kullanıcı kaldırılmasını istediği satırı
açtığı her eski teklifte yeniden görürdü.

**ÇÖZÜM SİLMEK DEĞİL EMEKLİYE AYIRMAK** (`RETIRED_ROW_KEYS`): satır kayıtta
olduğu gibi kalır, OKUMA yolunda süzülür. Fark önemlidir çünkü yayımlanmış bir
teklif KİLİTLİDİR ve müşteriye giden kâğıdın karşılığı `offer-pdf` kovasında
ARŞİVLİDİR — belgenin gerçeği dosyadadır, payload onun yeniden üretilebilir
kopyasıdır.

- **DEĞERİ OLAN SATIR SESSİZCE KAYBOLMAZ**: `craneType` satırının değeri, kalem
  künyesindeki alan boşsa oraya TAŞINIR (`emekliVincTipi`).
- **KÖPRÜ SATIRLARI İKİ GRUPTA yaşar** (`bridge` ve `gantry` aynı satır
  kümesini paylaşır); ikisi de yazılır, yoksa portalde satır durmaya devam
  ederdi. Kullanıcı kararı (22.08.2026): ikisinden de kalkar.
- **VİNÇ TİPİ ARTIK TEK YERDE SORULUR** — kalem künyesi. `composeItemTitle`
  onu satırdan değil künyeden alır (`withAutoTitle`), `itemFactsFromRows` da
  yalnız ölçü türetir.
- **`val.craneType` `STANDALONE_LIST_KEYS`e YAZILIR.** Liste anahtarları satır
  tanımlarından TÜRETİLİR; satır emekliye ayrılınca anahtar türetmeden düştü ve
  sonuç sessizdi: dropdown'lar veritabanından `list_key` ile süzdüğü için
  çalışmaya devam etti, kaybolan yalnız **Tanımlar → Defterler**deki "Vinç
  Tipleri" kartıydı — yani listeyi düzenlemenin tek yolu. Bir test bunu
  çivileyerek tutar.

## TEKLIF-60 — Defterde ŞEKİL değişirse eski değer ELLE YAZILMIŞ sayılır.

Kullanıcı isteği (22.08.2026, md. 4): *"genel özelliklerde yürüme yolu diye
aldığımız bilgi Yürüme Yolu Uzunluğu ve metre cinsinden olacak."*

`runway` satırı SERBEST METİNKEN PARÇALIYA döndü (sayı + `" m"`). Kayıtlarda o
satırın değeri hâlâ serbest bir cümledir ("A55 Ray, 96 m") ve parçası YOKTUR;
`withComposedValue` parçalardan derleyip BOŞ yazardı — taşıma, kullanıcının
yazdığını silerdi.

Kural genel yazıldı (`parcalarDegeriKaybediyor`): defterdeki parçalar satırın
KAYITLI değerini üretemiyorsa satır `manual` sayılır. `manual` satırın kendi
kaçış yoludur ("elle yazılmış değer kutsaldır") ve tam olarak bu duruma yarar:
kullanıcı metnini görmeye devam eder, asa düğmesiyle parçalı yazıma geçmek
İSTERSE geçer. Değeri parçalardan aynen çıkan satır etkilenmez.

## TEKLIF-61 — Teklif PDF'inin adı HER ZAMAN "ORİON VİNÇ" ile başlar.

Kullanıcı isteği (22.08.2026): *"Konu ne olursa olsun inen teklif pdf
isimlendirmesi ORİON VİNÇ - KONU şeklinde olsun."*

Kullanıcı bunu bugüne kadar KONUNUN İÇİNE elle yazıyordu; yazmayı unuttuğu
teklifte müşterinin indirdiği dosya kimden geldiğini söylemiyordu — müşterinin
indirilenler klasöründe on tedarikçinin teklifi yan yana durur.

- **ÖNEK İKİ KEZ YAZILMAZ**: konu zaten önekle başlıyorsa (`trKatla` ile
  karşılaştırılır) önek ve ardındaki ayraç düşürülür.
- **NUMARA VE REVİZYON DÜŞMEDİ** ve bu bir gerekliliktir: yayımlanan PDF
  `offer-pdf` kovasına `${offerId}/${dosyaAdı}` yoluyla arşivlenir. Ad yalnız
  önek ve konudan kursaydı aynı teklifin R1 ve R2 revizyonları AYNI dosya adını
  taşır ve ikincisi birincinin üstüne yazardı.

## TEKLIF-62 — Liste ve analiz çizelgesi YATAY KAYMAZ; KONU üç noktayla kesilir.

Kullanıcı bildirimi (22.08.2026): *"teklifler sayfasında yatayda kaydırma
olmasın. geniş olduğunda Konu ve Kapsam yazılar uzunsa belli bir uzunluktan
sonra ... üç nokta olarak görünsün."* ve aynı gün analiz sayfası için aynısı.

Tablo `auto` düzendeyken uzun bir KONU metni bütün çizelgeyi ekranın dışına
itiyordu: `max-w-[22rem]` yalnız o hücreye TAVAN koyuyor, geri kalan yedi
sütunun `whitespace-nowrap`ı tabanı yukarı çekiyordu. Çözüm MOBIL-16'nın
kendisidir — `table-fixed` + yüzde genişlikler + `!overflow-x-hidden` — ve
esnek sütunlar `truncate` olur.

`line-clamp-2` YERİNE `truncate`: iki satıra sarma, satır yüksekliğini içeriğe
göre değiştiriyordu. Tam metin `title`da durur, satır hep aynı boydadır.
Yüzdelerin toplamı 100'dür ve değiştiren kişi toplamı korumalıdır.

## TEKLIF-63 — Teklif satırında İPTAL ve SİLME; ikisi AYRI şeydir.

Kullanıcı isteği (22.08.2026): *"teklif bazen iptal edilebiliyor. satırda silme
ve iptal özelliği olsun."*

- **İPTAL bir DURUMDUR** (`cancelled`). Kayıt yerinde kalır; gelecek yıl "geçen
  sene bu müşteriye ne vermiştik" sorusunun cevabı odur. Tek tıkla geri alınır.
  Eylem `updateOfferStatus`tur ve `updateOfferDetails`ten AYRIDIR: o eylem
  müşteriyi, konuyu ve para birimini de yazar; liste satırında bunların hiçbiri
  yoktur ve hepsini göndermek, ekranda bulunmayan alanları bir varsayılanla
  ezmek olurdu (`updateOfferSubject`in aynı gerekçesi).
- **SİLME kalıcıdır ve DOĞRUDAN YAPILMAZ**: uygulamanın kendi onay
  mekanizmasından geçer (`request_deletion` → Yönetim → Silme Talepleri). Kayıt,
  Yönetici onaylayana kadar değişmeden kalır. Yayımlanmış revizyonu olan teklifi
  sunucu zaten reddeder — müşterinin elindeki bir belgenin izi silinemez.

Üç eylem (kopyala · iptal · sil) TEK MENÜDEDİR: üç küçük ikonu yan yana dizmek
`w-[4%]`lik hücreye sığmaz ve çöp kutusu ikonunun "sil" mi "iptal" mi olduğu
ancak tıklandığında anlaşılırdı.

## TEKLIF-64 — İskonto ORANLA da girilir; küsurat YUKARI yuvarlanır ve GÖRÜNÜR.

Kullanıcı isteği (22.08.2026): *"teklif fiyat bölümünde iskonto girdiğim yer
vardı. buraya oranlı olarak da iskonto yapabilme seçeneğini getirelim. Ama
küsüratlı olduğunda yukarı yuvarlama yapsın."* ve *"yapılan iskonto görünsün
istiyorum. Mevcut fiyat üstü çizili küçük yazabilir. Yeni iskontolu fiyat
yerine yazabilir."*

- **SAKLANAN ŞEY YİNE TUTARDIR, oran değil.** Oran bir HESAP GİRDİSİDİR:
  kullanıcı "%5" der, uygulama tutarı yazar. Oranı da saklamak, satır fiyatları
  değiştiğinde ikisinin çelişmesi demekti — hangisinin geçerli olduğu ekrana
  bakarak anlaşılamazdı (`discountPercent` bugüne kadar bilerek TÜRETİLMİŞTİ).
- **YUKARI YUVARLANIR ÇÜNKÜ YÖN BİR KARARDIR.** 642.016,65 €'yu aşağı
  yuvarlamak, müşteriye söylenenden fazla indirim yapmak olurdu. TAM SAYIYA
  yuvarlanır, kuruşa değil: kuruş pazarlıkta konuşulmayan bir hassasiyettir.
- **İSKONTO GÖRÜNÜR**: eski toplam ÜSTÜ ÇİZİLİ ve bir kademe küçük, ödenecek
  rakam onun yerinde. Ekran ve PDF aynı dili konuşur. İskonto satırı YİNE
  KALIR — üstü çizili rakam "ne kadar indirim yapıldı" sorusunu ancak çıkarma
  yaparak cevaplar, satır doğrudan söyler.
- Oran **0 ile 100 arasında** olmalıdır; dışında hesap yapılmaz ve uydurma bir
  tutar yazılmaz (değişmez md. 4).

## TEKLIF-65 — İskonto KALEM BAZINDA da görünür; sütunun toplamı belgeyi TUTAR.

Kullanıcı isteği (22.08.2026): *"%15 iskonto uyguladığımda en altta yazıyor iyi.
Ama kalem bazında da üstünü çizip yazmalı. Çünkü kalem bazı en son
faturalandırılacak, kalem fiyatları da önemli. Normal fiyatın üstünü çizsin,
biraz fontu küçültsün, altına iskontolu fiyat yazsın."*

TEKLIF-64 iskontoyu yalnız TOPLAM şeridinde gösteriyordu. Fatura ise satır satır
kesilir: müşterinin ödeyeceği kalem fiyatı belgede yazmıyorsa, iskonto
uygulanmış bir teklifte hiçbir satırın gerçek fiyatı belli değildir.

- **HÜCRE İKİ KATMANLIDIR**: üstte ham fiyat (üstü çizili, bir kademe küçük ve
  silik), ALTINDA ödenecek olan. BİRİM FİYAT ve TOPLAM FİYAT sütunlarının
  ikisinde de. Sıra kullanıcının kendi tarifidir ve okuma yönüyle uyumludur —
  göz son gördüğü rakamı geçerli sayar.
- **RAKAMLAR UYDURULMAZ**: `discountedLines` onları `applyDiscountToLines` ile,
  yani "birim fiyatlara yansıt" düğmesinin YAZDIĞI sayılarla üretir. Birim
  fiyatlar tam sayıya yuvarlanır, yuvarlamadan doğan artık en büyük satıra biner
  ve **basılan kalem tutarlarının toplamı İSKONTOLU TOPLAM'ı birebir tutar.**
  İki yol ayrışsaydı düğmeye basmak belgedeki rakamları değiştirirdi.
- **SATIRLAR DEĞİŞMEZ, YALNIZ GÖSTERİLİR.** Kayıtta duran birim fiyat hamdır ve
  iskonto tek bir yerde (`discountTotal`) yaşamaya devam eder — TEKLIF-35'in
  "tutar saklanır, oran türetilir" gerekçesi burada da geçerlidir.
- **ÜSTÜ ÇİZİLEN SATIR KÜMESİ, TOPLAMI TUTAN KÜMEDİR**: gizli satır belgede
  yoktur, `inTotal: false` satır (süpervizörlük) zaten toplamın dışındadır,
  fiyatsız satıra dokunulmaz. Süzgeç TEK tanımdır (`iskontoluSatirMi`) ve hem
  ölçekleme hem gösterim onu okur.
- **BİRİM FİYATLARA YANSITILMIŞ teklifte hiçbir üstü çizili rakam basılmaz**:
  tablodaki fiyatlar zaten iskontoludur ve üstlerini çizmek aynı indirimi ikinci
  kez vaat etmek olurdu (TEKLIF-35'in ayrı satır basmama gerekçesiyle aynı).
- **EKRAN BELGEYLE AYNI SAYIYI GÖSTERİR**: editörün TUTAR hücresi de iki
  katmanlıdır ve birim fiyat kutusunun ALTINDA "belgede 223.145 €" yazar. Kutuda
  ham fiyat durur — düzenlenen değerin yeri orasıdır ve iskontoyu oraya yazmak
  kullanıcının kendi girdisini bozardı.

**SATIR BOYU HESABA KATILIR, ÖLÇÜM SON SÖZÜ SÖYLER.** İki katmanlı hücre satırı
~7 pt uzatır; `fiyatSatirPayi` iskontolu tabloda metin yüksekliğini o kadar
büyük sayar ve payı `FIYAT_PAY_EN_AZ`ta kelepçeler (TEKLIF-55). Bu bile
yetmediğinde — uzun ticari şartlar + dolu not/kapsam listeleri — `renderOfferPdf`
ticari sayfanın taştığını ÖLÇER ve sırayla iki şey dener: önce satırları
sıkıştırır (`compactPrices`), sonra tabloyu bütün hâlde KENDİ YAPRAĞINA sürer
(`priceOwnPage`). Satır sayısı eşiğin (12) altında olsa bile: eşik satır
SAYISINI ölçer, taşmayı ise sayfanın kendisi bilir. Tabloyu taşımak,
@react-pdf'in onu notların üstünde ikiye bölmesinden iyidir (TEKLIF-54).

## TEKLIF-66 — Mobil teklif akışında YATAY KAYDIRMA YOKTUR; çizelge KARTA dönüşür.

Kullanıcı kararı (23.08.2026): teklif bölümündeki bütün işlemler telefondan
kolayca yapılabilmeli ve bölümün hiçbir ekranında yatay kaydırma olmamalıdır.

- Teklif ve maliyet editörünün bölüm rayı telefonda **tek seçicidir**. Uzun
  kalem başlıklarını yatay bir şeritte aratmaz; masaüstü sol rayı korunur.
- Düzenlenebilir fiyat ve maliyet çizelgeleri sütun GİZLEMEZ. Aynı `table`
  işaretlemesi `md` altında `data-label` başlıklı, iki sütunlu kartlara katlanır;
  tanım/kalem ve eylem hücreleri tam genişliktir. Ayrı mobil bileşen yazılmaz,
  dolayısıyla kaydetme ve toplam mantığı iki işaretlemeye bölünmez.
- Teklif/maliyet revizyon zincirleri de kartlara katlanır; belge eylemleri tam
  genişlikli son bölgededir. Maliyet özetinde karar için gerekli beş alan
  (kalem, adet, maliyet, kâr, tahmini satış) kartta kalır; ayrıntı sütunları
  masaüstünde görünür.
- Bölüm layout'u `min-w-0 max-w-full overflow-x-hidden` ile son emniyet
  kemerini taşır. Bu kelepçe, erişilemeyen içeriği kırpmak için değil; yukarıdaki
  katlama kurallarından sonra üçüncü taraf/açılır içerik yüzünden belgenin
  genişlemesini engellemek içindir.

Ölçüt: `/dev/offers-preview`, `/dev/offer-editor-preview`,
`/dev/offer-cost-preview/costs/demo` ve `/dev/cost-templates-preview` 320 ve
375 px'te `documentElement.scrollWidth === clientWidth` verir; teklif/maliyet
bölümünde `overflow-x: auto|scroll` taşıyan görünür kap bulunmaz.

## TEKLIF-67 — Teklif Hesap Raporları teklif listesi ile analiz arasındadır.

`/offers/hesap-raporlari`, bölüm rayında **Teklifler → Teklif Hesap Raporları
→ Analiz** sırasındadır. Amaç, henüz işe dönüşmemiş bir teklif için hesap
raporunu hemen açmak ve Mühendislik listesini teklif ön çalışmalarıyla
karıştırmamaktır.

Bu sayfa yeni bir hesap ürünü değildir. Liste ve gezinme teklif bağlamındadır;
hesap formu, revizyon snapshot'ı, hesap motoru, PDF ve ekipman çıktısı
Mühendislik'in bileşenleridir (HESAP-31). Veri ayrımı
`projects.report_context = 'offer'` süzgeciyle yapılır. Teklif raporu iş emrine
bağlanmaz ve teklif detayında alınmış işe ait teslim sekmeleri (şartname,
elektrik projesi, teknik resim ve el kitabı) açılmaz.

Görsel ölçüt `/dev/offer-reports-preview`dir. Liste Mühendislik tablosunun
aynısını kullanır ama İş No sütununu göstermez; telefonda aynı kart katlama
kuralını korur.

## TEKLIF-68 — Güvenlik seçimleri, bölüm görünürlüğü ve hazırlayan firma teklif snapshot'ıdır.

Kullanıcı kararı (26.08.2026): Elektrik Sisteminin ardında hızlı seçilen
**Güvenlik Özellikleri** bölümü bulunur; seçeneklerin tamamı yeni kalemde BOŞ
başlar. Satırlar açılır kutu değil `Seç / Seçili` düğmesidir. Elektrik
grubundaki emekli **Kiriş Boyu Elektrik** satırının yerini PLC (Siemens
S7-1200, S7-1500) ve hemen altındaki HMI Panel (Siemens MTP Serisi, 7", 9",
11") alır. Eski `girderPower` değeri PLC adıyla yeniden etiketlenmez; okuma
yolunda emekliye ayrılır. Eski taslakta Elektrik grubu varsa eksik PLC/HMI ve
boş Güvenlik grubu eklenir. Boş satırlar `printedPayload` süzgecinde düştüğü
için yayımlanmış eski belgenin metni değişmez.

Teklif editörünün ana bölümleri (Kapak, her kalem, Test Yükü, Ticari Şartlar,
Fiyat, Notlar, Kapsam Dışı ve Genel Şartlar) raydaki göz düğmesiyle ayrı ayrı
gizlenir. Gizleme **veriyi silmez**; `hiddenSections` yalnız statik bölüm
anahtarlarını taşır, kapak/test/kalem kendi eski bayraklarını korur. PDF'de tek
karar noktası yine `printedPayload`dır. Gizli bölümün metni kadar sayfası,
başlığı, boşluğu ve İçindekiler satırı da düşer; PDF bileşeninde ikinci bir
gizli anahtar listesi tutulmaz. Eski payload'da `hiddenSections` boş kabul
edilir, dolayısıyla geçmiş belge kendiliğinden bölüm kaybetmez.

Yeni Teklif penceresindeki **Teklifi Hazırlayan Firma** varsayılan olarak
ORION VİNÇ'tir; müşteri defterindeki bir partner seçilirse unvan, adres,
telefon, faks ve vergi bilgileri ilk revizyonun `issuer` snapshot'ına yazılır.
Partner seçimi PDF'in bütün marka yüzeylerine birlikte uygulanır: kapak ve
KİMDEN künyesi, sayfa lockup/filigranı, altbilgi, metadata, firma tanıtımı,
dosya adı ve Genel Şartlardaki firma adı. Partner logosu canlı kimlik olarak
müşteri defterinden okunabilir; logo yoksa ORION logosuna geri düşülmez.
Partner teklifinde ORION kullanıcısının e-posta adresi de KİMDEN künyesine
sızmaz. Unvan/adres/vergi metni ise snapshot'tır ve sonradan defter değişince
teslim edilmiş teklif değişmez.

Müşteri logosu `offers.customer_id`ye körlemesine bağlanmaz. Kimliğin güncel
müşteri adı teklifin `customer_name` snapshot'ıyla doğrulanır; uyuşmazsa yalnız
TAM resmî unvan eşleşmesi kullanılır. Benzer/prefix eşleşmesi yasaktır:
KARDEMİR A.Ş. ile KARDEMİR ÇH iki ayrı kimliktir. Depodaki logo yolu da mutlaka
seçilen müşteri kimliğinin klasöründe olmalıdır; yanlış logo yerine logosuz
PDF tercih edilir.

## TEKLIF-69 — Teknik yaprak başlığı hazırlayan firma logosunu, altbilgi güvenli folio alanını taşır.

Kullanıcı kararı (26.08.2026): teklifin yalnız **teknik özellikler**
yapraklarında sağ üstteki teklif numarası kaldırılır; onun yerinde Teklifi
Hazırlayan Firma'nın logosu basılır. Kapak değişmez. Ticari şartlar, ayrı fiyat
yaprağı ve genel şartlar kendi iki satırlı referans künyesini korur. ORION
teklifinde yerleşik kömür logo, partner teklifinde indirilen partner logosu
kullanılır; seçili partnerin logosu yoksa ORION'a geri düşülmez. Teknik logo
akış dışındadır: başlık yüksekliğini ve teknik sütun sayfalamasını değiştirmez.

Markalı altbilgide doküman satırı ile folio aynı esnek metin kutusunu paylaşmaz.
Folio sağda sabit ve ayrılmış bir güvenli alandadır; uzun hazırlayan firma adı
veya teklif konusu kalan genişlikte ayraçlardan doğal olarak ikinci satıra
geçer. Bu kural `BrandPage` üzerinden kapak dahil teklifin her fiziksel
yaprağında uygulanır; hiçbir metin sayfa numarasının alanına giremez.

Kullanıcı kararı (27.08.2026): teknik başlıktaki partner logosunun **görünür
gövdesi** önceki ölçüye göre %25 büyür ve görünür sağ kenarı alttaki kırmızı
kuralın sağ ucuna hizalanır. Standart 900×240 merkezli tuval kapak ve diğer
marka yüzeylerinde korunur; teknik başlık için ondan ayrı, sıkı bir türev
üretilir. Opak beyaz zeminli logolarda (KARÇEL) beyaza yakın zemin bu türevde
saydama çevrilip görünür sınıra kırpılır; böylece PDF rasterleştiricisinin
beyaz dikdörtgen kenarında ürettiği gri saç çizgisi basılmaz.

## TEKLIF-70 — Liste takibi, teklif künyesi ve maliyet özeti aynı karar sayılarını taşır.

Kullanıcı kararı (27.08.2026): iptal edilmiş teklif satırı arşiv ve teklif
adedinde kalır, **Toplam (Avro)** tutarına girmez. Özet kartlarında sayıların
altındaki açıklama satırları kaldırılır; başlık ve sayı tek başına yeterlidir.

`Gönderildi` durumundaki teklifin takip başlangıcı `issued_on`dur. Eski bir
kayıtta bu tarih boşsa `issue_date` kullanılır; böylece yalnız durum seçilerek
gönderilmiş HABAŞ gibi kayıtlar Bekleyen kartına ve gün/hafta sayacına girer.
Yeni bir teklif elle `Gönderildi` yapılırken boş `issued_on`, teklif tarihiyle
veritabanına da yazılır. Açık bir gönderim tarihi hiçbir zaman ezilmez.

Teklif satırının üç nokta menüsünde **Düzenle** bulunur. Pencere müşteri,
konu, durum ve para birimini değiştirir; teknik özellik/fiyat içeriğini taşıyan
revizyon gövdesine dokunmaz. Müşteri yine defterden seçilir ve akış içinden
yeni müşteri açılabilir.

Teklif detayındaki maliyet revizyonu satırı veritabanının yalnız vinç
kalemlerinden türettiği `direct_amount/total_amount` sütunlarını basmaz. Özet
sayfasının tek çekirdeği (`costOverview`) üzerinden **Teklif Tutarı, Toplam
Maliyet ve Kâr** gösterilir; serbest fiyat satırlarının maliyeti de dahildir.

Özet altındaki **BEŞ ANA BAŞLIK** ile **ANA KALEM KIRILIMI**, üstteki TEKLİF VE
KÂR bloğunun toplamıyla tutar. Kırılımı girilen serbest fiyat satırı ilgili
imalat/proje/oran başlığına eklenir. Yalnız tek maliyet kutusu kullanılmışsa
kategori uydurulmaz; **DİĞER SATIR MALİYETLERİ** olarak açıkça gösterilir. Ana
kalem kırılımı vinç grupları, oranlı giderler ve serbest fiyat satırlarını tek
listede toplar; payın tabanı toplam maliyettir.

## TEKLIF-71 — Kaldırma kapasitesi PDF'de büyük ve kalın basılır.

Kullanıcı kararı (27.08.2026): teknik özelliklerde `capacity` satırının değeri
uygulamada hangi harf büyüklüğüyle yazılırsa yazılsın PDF'de Türkçe kuralla
tamamen büyük basılır (`15 TON / 5 TON`) ve diğer teknik değerlerden daha kalın
dizilir. Bu yalnız kapasite satırının sunum kuralıdır; payload değiştirilmez.
Diğer teknik değerlerde `kW`, `mm`, `Hz` gibi anlamı harf büyüklüğüne bağlı
mühendislik birimlerini koruyan mevcut kural devam eder.

## TEKLIF-72 — Teklif hesap raporu AI aracı dosyası GİRDİ taşır; sonucu motor yeniden üretir.

Kullanıcı kararı (28.08.2026): mevcut bir teklif hesap raporu revizyonunun
girdileri JSON olarak indirilir; yerel AI agent bu örneği ve yeni teknik
şartnameyi inceleyip aynı biçimde yeni bir dosya üretir. Teklif Hesap
Raporları > Yeni Hesap Raporu penceresinin en altındaki **Dosya ile Oluştur**
alanı bu dosyadan proje künyesiyle birlikte V0 taslağını açar.

Biçimin kararlı kimliği `orion-offer-calculation-report`, sürümü `1`dir
(`lib/offer-report-transfer.ts`). Dosya üç katman taşır:

- `project`: doküman no, rapor/vinç adı, müşteri, vinç tipi ve yeri;
- `revision.inputs` + `revision.selections`: güncel editörün eksiksiz
  snapshot'ı; kapalı/gizli bölüm kararları da korunur;
- `fieldGuide`: her kullanıcı alanının Türkçe etiketi, tipi, birimi ve
  varsa izin verilen makine değerleri. Bu rehber AI içindir; içe aktarım
  ona güvenmez, güncel kodun alan tiplerini kullanır.

**`revision.results` YOKTUR ve kabul edilmez.** Dosya sonuç snapshot'ı değil
girdi aracıdır. İçe aktarım yabancı anahtarları atar, bilinen alanlarda
sayı/metin/doğru-yanlış tipini yoluyla birlikte doğrular ve `runCalc`i
sunucuda yeniden koşturur. Böylece AI'ın uydurduğu bir uygunluk sonucu ya da
eski motorun hesabı DB'ye giremez. Dosya en fazla 900 KB'dir; tehlikeli nesne
anahtarları, aşırı derinlik ve sonlu olmayan sayılar daha şemaya gelmeden
reddedilir.

AI'a yazılan talimat da dosyanın içindedir: şartnamede açıkça bulunan
değer değiştirilir; bulunmayan değer uydurulmaz veya silinmez, örnek değer
korunur ve teyit yolu `reviewNotes` listesine yazılır. Bu liste ve kaynak
revizyon, yeni snapshot'ın `fileImport` künyesinde ve audit ayrıntısında
saklanır.

Proje + V0 revizyonu iki ayrı ağ işlemi değildir.
`create_offer_report_from_file` ikisini ve `project.createFromFile` audit
kaydını tek Postgres işleminde oluşturur; revizyon düşerse yetim proje
kalmaz. Fonksiyon teklif yazma yetkisini kendi içinde de sorar ve bağlamı
daima `offer`, iş bağını daima `null` yazar. Müşteri/logo UUID'leri taşınmaz:
dosya kurumlar arasında taşınabilir kalır, rapor markası ve logo yeni
projede bilinçli olarak seçilir.
