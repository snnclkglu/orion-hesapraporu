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
