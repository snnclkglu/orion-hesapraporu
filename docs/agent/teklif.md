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
