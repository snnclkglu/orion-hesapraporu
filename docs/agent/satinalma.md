# Satın Alma

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/satinalma.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/purchasing/*.ts` · `src/app/(app)/purchasing/*.ts` · `src/app/(app)/purchasing/*.tsx` · `src/app/(app)/purchasing/siparisler/**` · `src/app/(app)/purchasing/teslimat/**` · `src/app/(app)/purchasing/fiyatlar/**` · `src/app/(app)/purchasing/sarf/**` · `src/app/(app)/purchasing/export/**` · `src/app/(app)/admin/suppliers/**` · `src/app/(app)/admin/consumables/**`

## SATIN-21 — SATIN ALMA PAKETİN ÜSTÜNDE BİR KATMANDIR

(`/purchasing`, kullanıcı
kararı 12.08.2026). `/drawings/[id]/purchasing` bir PAKETİN satın alma
yüzüdür ve öyle kalır; bu modül ise satınalmacının gerçekte yaptığı işi
modeller: *"projeleri tek tek ele almıyor, birden fazla projenin siparişini
bir arada biriktirip veriyor."*

**ANAHTAR PAKET DEĞİL TANIMDIR.** Havuz, teklif, sipariş ve fiyat arşivi
`normAnahtar(tanım)` ile anahtarlanır — `drawing_purchase_overrides` ile
BİREBİR aynı dilbilgisi. İki ayrı anahtar şeması, kategori düzeltmesi ile
fiyat geçmişini birbirinden habersiz bırakırdı. `package_id`/`item_no`
satırda durur ama BAĞ DEĞİL BAĞLAMdır (`on delete set null`): paket silinse
de "bu rulman şu tarihte şu fiyata alındı" bilgisi yaşamalıdır.

**ADETLER İŞ KALEMİ ADEDİYLE ÇARPILIR** (`drawingCarpani`). Ressam BİR
ürün için çizer; iş emrinde üç adet varsa üç katı alınır. `job_items.qty`
SAYISALdır ve `quantity` METNİNDEN AYRIDIR: metin iş emri PDF'ine olduğu
gibi basılır ("1 Takım", "Muhtelif") ve bir sayıya indirgenemez — ölçüldü,
74 kalemin 21'i boş, ikisi "Muhtelif", biri "90x2 180 m". `qty` NULL
YAPILABİLİR ve `null` "BİLİNMİYOR" demektir; 1 varsayılmaz çünkü sessiz bir
varsayım, üç adetlik bir işi bir adet sipariş ettirmenin en kolay yoludur.
Ekran belirsizliği AÇIKÇA yazar. İki kalem tek resim takımı paylaşıyorsa
(`shares_drawings_with`) çarpan ikisinin TOPLAMIdır; zincir ve döngü
`guard_item_share` tetikleyicisiyle kesilir. Bağ `updateJob`ın sil-yaz
yolunda `item_no` METNİ üzerinden korunur (proje bağlantısıyla aynı kalıp).

**TANIM NORMALLEŞTİRİLİR — UYDURULMAZ** (`lib/drawings/normalize.ts`).
Kullanıcının talimatı nettir: *"uydurma bir veri girmeyeceğiz, sadece olan
hataları düzeltip standart bir formata çevirmiş olacağız."* Bu yüzden
DIN'i olmayan kamaya DIN 6885, bilinmeyen bir kaleme malzeme EKLENMEZ.

**FİRMA KABULLERİ AYRI BİR KAPIDIR** (`firmaKabulleri`, kullanıcı kararı
13.08.2026). Yukarıdaki kuralın TEK istisnası ve ayrı bir fonksiyonda
durmasının sebebi tam da bu: `normalizeTanim`ın sözleşmesi bozulmasın ve
"bu değer nereden geldi" sorusu cevaplanabilsin (`FirmaKuralKodu`).
Üç kabul, üçü de bir tahmin değil firmanın her siparişte aynı olan
tercihi:
- *"Cıvata ve somunda eğer belirtilmemişse her zaman galvanizli olarak
  sonuna ekle. Bazılarında var bazılarında unutulabiliyor. Ama her zaman
  galvanizli alıyoruz."*
- *"Cıvatanın kalitesi yoksa otomatik 8.8, somunun kalitesi yoksa
  otomatik 8."* — sayısal ham değer (10.9) EZİLMEZ, yalnız BOŞ doldurulur.
- *"Yaylı rondelaların malzemesi her zaman YAY ÇELİĞİ olsun."* Tek EZEN
  kural budur ve kullanıcı açıkça istedi.

EŞLEŞME TANIMIN BAŞINDANDIR, sözcük arayarak değil: fikstürdeki
`KANCA SOMUNU Ø55 L=30` bir kanca parçasıdır ve "SOMUN" arayan bir kural
ona galvaniz eklerdi (`RULMAN YATAĞI SOMUNU` dersinin aynısı). Kabuller
DEFTERE yazılır (`reconcile`), sunum katmanında hesaplanmaz — Parçalar,
paketin Satın Alma sekmesi ve havuz aynı satırı okur ve üçünde farklı bir
tanım görmek "hangisi doğru" sorusunu doğururdu. **Bedeli açıkça kabul
edildi:** kodsuz satırın ilerleme anahtarı katlanmış TANIMDIR, yani
galvaniz eki alan bir kalemin eski "satın alındı" işareti yetim kalır
(`orphanMarks` gösterir). Karşılığında galvanizli ve galvanizsiz yazılmış
AYNI cıvata artık TEK kalemdir — ölçüldü: MTC'de 78 kalem 74'e indi.

**`xxxx-xx-0000` ADI ÜRÜNÜN ADINI TAŞIR** (`genelKompleAdi`, kullanıcı
kararı 13.08.2026): *"bu tarz numaralar bizim için her zaman o iş
kaleminin ÜRÜN ADI + GENEL KOMPLE olarak adlandırılır."* Sebep listede
görünür: satınalmacı birden çok projenin kalemini bir arada görüyor ve yan
yana duran üç "GENEL KOMPLE" satırı hangisinin hangi vince ait olduğunu
söylemez. Ad `job_items.product_name`den gelir, yoksa klasörün kendi
açıklamasına (`MTC PASLANMAZ`) düşülür, o da yoksa sade hâli yazılır. Sözlükteki her kural iki gerçek teslim klasörünün 317 ham tanımına
ya da satın alma ekibinin 178 satırlık İŞ HAZIRLAMA LİSTESİ dosyasına
dayanır; kanıtsız kural girmez — yanlış birleştirme (iki farklı ürünün tek
kaleme düşmesi), ayrı kalmaktan çok daha pahalıdır. Kullanıcının açık örneği
kuralın özetidir: **"RULMAN EKSENEL 51106" değil "RULMAN 51106"**; sonek
(`-Z`, `-ZZ`) ise kimliğin PARÇASIDIR ve düşürülmez. Fonksiyon
DEĞİŞMEZDİR (`f(f(x)) === f(x)`) ve bu bir testle korunur — değilse
saklanmış bir tanım her okumada bir kez daha değişir ve fiyat arşivi kendi
kendine bölünür. Tanımlar BÜYÜK HARFLE saklanır (`adBuyuk` kuralı, md. 14).

**ANA GRUP ADI İKİ KAYNAKTAN, ÜÇÜNCÜSÜ YOK.** (a) grubun KENDİ defter
satırı varsa tanımı ad olur (ürün ağacı; otoriter), (b) yoksa alt
parçaların montaj başlığı OYBİRLİĞİYLE aynıysa o kullanılır. Başlıklar
çelişiyorsa AD ÜRETİLMEZ: MTC'de 17 grubun 9'unda DEPO'nun `Title` sütunu
ürün ağacıyla çelişiyor ve yanlış bir grup adı, adsız bir gruptan çok daha
pahalıdır. **"Son iki hane 00" kuralı YANLIŞTIR** — MTC'de 17 grubun 7'si
00 ile bitmiyor (`0043-00-0801` ARABA ŞASİ); doğru kural son bloğu
KIRPMAKTIR, gerekirse birden çok kez. Satın alma satırlarının ÇOĞUNUN KODU
YOKTUR (MONORAY 50/55, MTC 86/90), o yüzden havuzda grup adı çoğunlukla
parçanın `assembly_title` alanından gelir.

**ÜÇÜNCÜ BASAMAK BİR FİRMA SÖZLEŞMESİDİR, TAHMİN DEĞİL** (kullanıcı kararı,
12.08.2026): `xxxx-xx-0000` her zaman **GENEL KOMPLE**'dir. "Ad
uydurulmaz" ilkesi kaynağı BELİRSİZ adları yasaklar, firmanın kendi
numaralandırma sözleşmesini değil — DEPO Excel'i o grubu adlandıramadığında
kod ekranda adsız kalıyordu. Kural EN SONDADIR (`genelKompleMu` /
`GENEL_KOMPLE_ADI`, normalize.ts): iki gerçek kaynaktan biri konuşuyorsa o
kazanır. Kalıp ÜÇ BLOKLUDUR — daha derin bir kodun `0000`'ı bir genel
komple değil alt montajın kendi sayısıdır. Havuz kuralı defterden BAĞIMSIZ
okur (`purchasing/data.ts`): eski paketler yeniden eşleştirme beklemeden
grubunu gösterir.

**HAVUZ `/drawings` EYLEMLERİNDEN TAZELENİR.** `/purchasing` ayrı bir tablo
tutmaz; beş ekranı da `drawing_packages` + `drawing_parts` üzerinden
türetir. Bu yüzden `drawings/actions.ts`teki paket/defter değiştiren her
eylem `satinAlmayiTazele()` çağırır — yoksa yeni yüklenmiş bir paket
satınalmacıya "düşmemiş" görünüyordu (kullanıcı bildirimi, 12.08.2026).
Ters yön zaten vardı (`purchasing/actions.ts` → `/drawings/<id>/purchasing`);
bu, o simetrinin eksik yarısıdır. **Havuza yalnız `yuklendi`/`aktif`
paketler girer**: yarım kalmış (`yukleniyor`) bir paketten sipariş verilmez.

**ÖDEME GÜNÜ TESLİMDEN SAYILIR, SİPARİŞ TARİHİNDEN DEĞİL** (kullanıcı
kararı): `coalesce(received_at, due_at) + payment_term_days`. Kural İKİ
yerde yaşar — `lib/purchasing/terms.ts` (ekran + Excel) ve
`purchase_order_totals` görünümü (SQL) — ve ikisinin ayrışmasını
`terms.test.ts` migration dosyasını OKUYARAK engeller. Avans ise SİPARİŞ
GÜNÜNDE çıkar; peşinatın tanımı budur. Ödeme biçimi ile vade GÜNÜ ayrı
sütunlardır: "Peşin"/"Kredi Kartı" bir biçim, "30 gün" bir vadedir ve tek
alanda tutulsalardı ödeme günü hesaplanamazdı ("kredi kartı kaç gün eder?").

**PARA HER YERDE AVRODA GÖRÜNÜR** (md. 16 ile aynı sözleşme): `fx_rate`
= 1 avro kaç birim eder, avro satırında 1'dir, karşılık TÜRETİLİR ve kur
SATIRIN KENDİNDEDİR. Kuru olmayan fiyat `null` üretir — SIFIR DEĞİL: sıfır
"bedava" derdi ve en ucuz teklif olarak kazanırdı. Kur eksikken KAYIT
YAPILMAZ (Zod şemasında, ekranda bir uyarı olarak değil).

**SİPARİŞ VERMEK İKİ ŞEY YAZAR:** ticari kayıt (`purchase_orders` +
`_lines`) ve paket ekranındaki `satinalindi` İŞARETİ. İkincisi olmasaydı
satınalmacı havuzdan sipariş verir, paketin Satın Alma sekmesi hâlâ
"bekliyor" gösterirdi — atölye o ekrana bakıyor. Ters yön geçerli DEĞİLDİR:
paket ekranından işaretlemek bir sipariş kaydı ÜRETMEZ (orası hızlı bir
işaret, burası ticari kayıt). RLS bu yüzden aşama düzeyinde ayrılır:
satınalmacı yalnız `satinalindi`/`teslim_alindi` yazabilir, "kesildi"
yazamaz — atölye de "satın alındı" işaretleyemez (md. 18'in kuralı).

**TABLO SATIN ALMA EKİBİNİN SÜTUN DÜZENİNDEDİR** (kullanıcı kararı
12.08.2026): İŞ HAZIRLAMA LİSTESİ'nin sırası birebir taşınır — İş Numarası
· Resim Numarası · Kullanıldığı Yer · Kategori · Tanımı · Kalite · İç/Dış
Çap · Boy · Miktar · Ağırlık · Not · Sipariş durumu. Düzen bir zevk değil
bir ALIŞKANLIKtır; uydurulmuş bir sıra aracı kullanılmaz yapardı. Havuzun
Excel'den FAZLASI (Sipariş · Kalan · Teklif sütunları ve bir satırın çok
projeli olabilmesi) modülün var oluş sebebidir.

**İÇ/DIŞ ÇAP VE BOY TANIMDAN AYIKLANIR** (`tanimOlculeri`) ve kural
TUTUCUDUR: yalnız Ø taşıyan tanımlar okunur, iki Ø varsa küçüğü iç
büyüğü dıştır, `L=`/`L` boydur. Ø yoksa HİÇBİR ŞEY yazılmaz — "SAC
15x240x285" bir dikdörtgendir, "M16" bir diş ölçüsüdür. Emin olunamayan
ölçü boş kalır; yanlış bir çap, boş bir çaptan çok daha pahalıdır.

**"RESİM NUMARASI" SÜTUNUNA GERÇEK KOD GİRER, HER METİN DEĞİL.** Canlı
veride ölçüldü: `drawing_parts.part_code` satın alma satırlarında çoğu
zaman kod değil tedarikçi kodudur ("RULMAN 6022 - Z", "28X16X80"). İçe
aktarım onları olduğu gibi taşır ve doğrusu budur (md. 18/1); ama o sütunun
başlığı "Resim Numarası"dır ve orada bir rulman kodu görmek satınalmacıyı
olmayan bir resmi aramaya iter. `parsePartCode` süzer ve EN AZ BİR ALT
SEGMENT şart koşar (`0057-00` bir kalem numarasıdır, resim numarası değil).
Süzgeç 186 kalemin 105'ini 32'ye indirdi — düşenlerin hiçbiri kod değildi.

**DURUM ÇİPİ BİR DÜĞMEDİR** (kullanıcı kararı): "Bekliyor" ya da "Teklif
alındı" üzerine basınca o kalem için sipariş penceresi açılır. Satınalmacının
en sık yaptığı hareket budur; önce kalemi seçip sonra şeritteki düğmeye
gitmek iki fazladan adımdı.

**AÇILIŞ SÜZGECİ `BOS` DEĞİLDİR** (kullanıcı kararı, 13.08.2026): havuz
"Bekliyor + Teklif Alındı" ile açılır (`ACILIS`), çünkü ekranın sorusu
"bugün ne sipariş etmeliyim". "Temizle" yine HEPSİNİ gösterir — açılış bir
öneridir, bir hapis değil. Teklif ve Sipariş sütunları zemin rengi taşır ve
renk UYDURULMAZ, `DurumCipi`den alınır (teklif SKY, sipariş EMERALD): aynı
kavramı iki ayrı dille anlatmak, rengin bilgi taşımasını bitirirdi.

**ÖDEME GÜNÜ SORULUR, VARSAYILMAZ** (`components/odeme-tarihi.tsx`,
kullanıcı kararı 13.08.2026). "Avans ödendi" ve "Bakiye ödendi" sessizce
bugünü yazıyordu; ödeme günü bu uygulamada türetilmiş bir sayı değil bir
OLGUdur (`terms.ts` vade, takvim ve dönem gruplamasını ondan çıkarır) ve
dekont çoğu zaman bir iki gün geriden gelir. Popover üç hızlı seçim (bugün ·
dün · önceki İŞ GÜNÜ — havale cuma çıkar, pazartesi sorulur) ve serbest
tarih verir. **İŞARETLİ ÇİPE DOKUNMAK DA AYNI PENCEREYİ AÇAR**: yanlış günü
düzeltmenin yolu "kaldır + yeniden işaretle" olmamalı. **ÖDEME TAKVİMİNDE DE
GERİ ALINIR** (kullanıcı bildirimi): aynı veriyi yazan iki ekranın biri
kapıyı açık bırakıp diğerinin kilitlemesi bir tasarım değil bir eksiklikti.

**KUR OTOMATİK GELİR, KİLİT DEĞİL** (`lib/purchasing/kur.ts`, kullanıcı
kararı 13.08.2026). Personel bölümünün çektiği `fx_rate_daily` teklif ve
sipariş pencerelerine referans olur: **en son YAYIN gününün** kuru gelir
(TCMB hafta sonu yayın yapmaz, "bugünün kuru" her gün yoktur) ve kutunun
altında günü yazar. **DÖNÜŞÜM ŞART**: `fx_rate_daily` TL cinsinden tutar,
satın almanın sözleşmesi ise "1 avro kaç BİRİM eder" — dolar için
`eur_try / usd_try`. İkisi karıştırılırsa dolarlık bir teklif otuz kat ucuz
görünür ve yarışı kazanır. **PARA BİRİMİ DEĞİŞİNCE KUR DA DEĞİŞİR**; alan
eski değerde kalsaydı parite bir lira kuru gibi kaydedilirdi.

**TEDARİKÇİ DEFTERİ AÇILDI — ÖNCEKİ KARAR TERSİNE ÇEVRİLDİ**
(`purchase_suppliers`, migration 20260813010001, kullanıcı kararı
13.08.2026). 12.08.2026'da bilerek açılmamıştı ("üçüncü bir yönetim ekranı
teklif girmeyi yavaşlatırdı"); eski gerekçe ÇÜRÜMEDİ, KARŞILANDI: yeni firma
teklif/sipariş penceresinin İÇİNDEN yazılır (`ensureSupplier`), ayrı ekran
şart değildir. Kazanç ölçülü — öneri listesi eskiden yalnız DAHA ÖNCE TEKLİF
GİRİLMİŞ firmaları biliyordu, şimdi devralınan 285 firmayı da biliyor.
**AD HÂLÂ `supplier` METNİNDE DURUR**, yabancı anahtara çevrilmez (md. 14'ün
müşteri fotoğrafı kuralı): defter düzeltilince yayınlanmış sipariş
değişmemeli. Tedarikçi olmayan devralınan kayıtlar (banka, otel, kargo)
SİLİNMEZ, `active = false` ile öneriden düşer.

**DEFTERİN YERİ YÖNETİM, KAPISI SATIN ALMA** (`/admin/suppliers`, migration
20260813010004, kullanıcı kararı 13.08.2026: *"Satın Alma bölümündeki
tedarikçileri Yönetim bölümüne Tedarikçiler adında bir sayfa ekleyerek
oraya taşıyalım. Her tedarikçiye benzersiz bir kod verelim. TD ile
başlayabilir."*). İki şey ayrıdır ve karıştırılmaz: listeyi DÜZENLEMEK
(ad düzeltme, kod verme, pasife çekme) bir yönetim işidir ve ekran admin'e
kapalıdır; YENİ FİRMA AÇMAK ise akışın içinde kalır. Yukarıdaki gerekçe
böylece hâlâ ayaktadır — satınalmacı yönetim ekranına gönderilmez.

**KOD BİR ETİKET DEĞİL, SİPARİŞ NUMARASININ KÖKÜDÜR.** `TD0007` firmaya bir
kez verilir; sipariş numarası ondan türer (`TD0007-01`, `lib/purchasing/
order-no.ts`, saf + testli). Numara ÖNERİdir, dayatma değil: kullanıcı
kutuya dokunduğu anda öneri susar (`*Auto` deseni) ve elle yazdığı numara
korunur. Sıra MEVCUT NUMARALARDAN okunur, kayıt sayısından değil — iptal
edilmiş bir siparişin numarası yeniden kullanılmaz. Çakışma İKİ yerde
sorulur (ekran + `createOrder`/`editOrder`): iki satınalmacı aynı dakikada
sipariş açarsa ekranın listesi ikisine de aynı numarayı önerirdi.
**KOD SIRA SAYACINDAN GELİR** (`purchase_supplier_code_seq`), `max()+1`den
değil; `ensureSupplier` de bu yüzden `upsert` değil ÖNCE OKUR SONRA YAZAR —
çakışan bir upsert sayacı tüketir ve defter birkaç haftada boşluklarla
dolardı. **VERİTABANINDA `unique` KISIT YOKTUR** sipariş numarasında:
devralınan kayıtlar arasında çakışma olabilir ve bir `unique` indeks
migration'ın kendisini düşürürdü.

**YENİ TEDARİKÇİ ADI KENDİLİĞİNDEN DEFTERE GİRER** (kullanıcı kararı:
*"Sipariş Aç bölümüne yeni bir tedarikçi ismi girilirse, otomatik yeni bir
tedarikçi açılsın."*). Eskiden alanın yanında ayrı bir "+" bileşeni vardı ve
BASILMASI gerekiyordu; bu kullanılmayan eski bileşen kaldırıldı. Teklif ve
sipariş pencereleri yeni firmayı artık kendi alanlarının içinden kaydeder. Sipariş
penceresinde kayıt alandan ÇIKILDIĞINDA yapılır, çünkü kod hemen gerekir —
sipariş numarası ondan türüyor.

**DEVRALINAN FİYAT ARŞİVİ ÜÇÜNCÜ BİR KAYNAKTIR** (`purchase_price_history`,
4722 satır, 2024-03…2026-12). `purchase_orders`a YAZILMADI ve bu bilinçli:
o tablo canlı bir iş akışıdır (Siparişler, ödeme ve teslim takvimi, gecikme
rozetleri) ve 5083 devralınan fatura oraya konsaydı modül ilk açılışta
kullanılamaz olurdu. Fiyat Arşivi üç kaynağı AYRI gösterir — teklif ·
sipariş · devralınan — çünkü uygulamanın kendi kaydıyla dışarıdan gelen bir
fatura aynı güvende değildir. Kaynak dosyanın 5083 satırının 361'i
aktarılmadı (357 tanımsız, 4 fiyatsız) ve sayı migration'ın başında yazar:
tanımı olmayan satırın fiyat arşivinde karşılığı olamaz. **SİLME YALNIZ
YÖNETİCİDE ve yalnız DEVRALINAN satırda** (kullanıcı kararı): teklif ve
siparişin kendi silme yolu var, tek düğmenin üç defteri birden silmesi
kullanıcının neyi kaybettiğini bilmemesi demekti.

**FİYAT ARŞİVİNDE SÜZGEÇ SUNUCUDADIR, DURUM ADRESTE** (`purchase_price_index`
görünümü, migration 20260813010005). Kullanıcı iki kez "yavaş" dedi ve
ölçüm ikisinde de aynı yeri gösterdi: görünümün KENDİSİ 54 ms; maliyet
1675 kalemin (360 KB) her ziyarette taşınıp istemcide süzülmesiydi —
ekranda 100 satır var. Üç kaynak artık SQL'de birleşir, sayfa yalnız
görünen dilimi çeker (~58 KB) ve arama `where` ile TÜM arşivde çalışır.
Kullanıcının şartı ("arama ve filtreyi tüm sayfalar için yapsın")
GEVŞEMEDİ, gerçek anlamını kazandı: artık istemciye hiç gelmemiş
satırlarda da arıyor. Ayrıntı satırları YALNIZ açılan kalem için istenir
(`loadArsivOlaylari`) — 1675 kalemin 1674'ünün ayrıntısı hiç açılmıyor.

**SAYFALAMA TEK BAŞINA YETMEZ** ve bu ders pahalıya öğrenildi: ilk turda
yalnız DOM sınırlandı (100 satır çizilir), veri yine tamamen gidiyordu.
Bir listede "kasıyor" denince sorulacak ilk soru "kaç satır çiziliyor"
değil **"kaç bayt taşınıyor"**dur.

ARAMA GECİKTİRİLİR (350 ms), SÜZGEÇ GECİKMEZ: açılır süzgeçte tıklama
zaten nihai bir karardır. Sıralama SQL'dedir (`son_hareket desc`) ve
beraberliği anahtar bozar — sayfalar arasında satır atlanmaz/yinelenmez.
Serbest arama ürün ve tedarikçinin yanında **iş numarasını** da kapsar;
`is` adres parametresi aynı bağlamı çoklu **İş Numarası** süzgeci olarak
uygular. Seçenekler bütün İşler defterinden değil, yalnız fiyat arşivinde
gerçekten karşılığı olan numaralardan gelir; fiyatı olmayan bir iş seçilip
yanıltıcı bir boş liste üretilmez.
Sıralamanın istemcide kalması bir kez gerçek bir hata üretti: geçmiş
kalemlerinin olay dizisi boşalınca hepsi `gun=""` ile eşitlenip alfabetik
sıralandı ve listenin başına devralınan satırı OLMAYAN kalemler düştü —
yönetici silme düğmesini bu yüzden hiç göremedi.

**SARF GİDERİ PROJE SİPARİŞİ DEĞİLDİR** (`purchase_consumable_expenses`,
migration 20260814000001, kullanıcı kararı 14.08.2026). Fabrikanın Atölye
ve Ofis ihtiyaçları herhangi bir işe/pakete bağlanmaz; bu yüzden
`purchase_orders`a yazılmaz, teslim/ödeme takviminde sahte bekleyen sipariş
üretmez. Satın Alma rayında Fiyat Arşivi'nin sağında üç ayrı adres yaşar:
`/purchasing/sarf` hızlı giriş · `/purchasing/sarf/kayitlar` sunucu
araması/sıralaması · `/purchasing/sarf/analiz` EUR pano ve matris. Giriş,
kayıt ve analiz tek dev bileşene yığılmaz.

**SARF YAZMA KÜMESİ GENEL SATIN ALMADAN DAHA DARDIR.** Görme yetkisi
Yönetici · Satın Alma · Planlama (`canSeeConsumableExpenses` /
`can_see_consumable_expenses()`); ekleme, düzenleme ve silme yalnız
Yönetici · Satın Alma (`canEditConsumableExpenses` /
`can_edit_consumable_expenses()`). Planlama kayıtları ve analizi salt
okunur görür. UI düğmesini gizlemek güvenlik değildir; aynı küme RLS'te
sabitlenir ve `roles.test.ts`te korunur.

**SARF MALZEME DEFTERİNİN YERİ YÖNETİM, KAPISI HIZLI GİRİŞTİR**
(`/admin/consumables`, `purchase_consumable_items`). Kod sequence'ten
değişmez `SM0001` biçiminde gelir. Yönetici ad/grup/birim/not/aktifliği
yönetir; Yönetici ve Satın Alma, hızlı girişte aradığı malzeme yoksa küçük
pencerede ad + grup + varsayılan birimle onu anında açar ve yeni satır
otomatik seçilir. Kullanılmış malzeme silinmez (`ON DELETE RESTRICT`),
pasife alınır. Kanonik seçim `Combobox`tur; serbest metin
`EditableCombobox` analitiği aynı malzemenin yazım varyantlarına bölerdi.

**MALZEME TEKİLLİĞİ `consumableMatchKey` İLE ÜRETİLİR** (`lib/purchasing/
consumable-key.ts`): NFKC → tr-TR büyük → `&` = `VE` → apostrof,
noktalama/boşluk ve opsiyonel `Ø` çap işareti katlama. Genel `trKatla`
burada tek başına yeterli değildir; 1364 satırlık kaynakta aynı malzemeyi
noktalama varyantlarıyla bölerdi. Import üreticisi ve canlı oluşturma aynı
fonksiyonu byte-for-byte izler; iki ayrı normalleştirme sözlüğü tutulmaz.

**SARF PARA SÖZLEŞMESİ SATIRDA DONAR.** Kullanıcı TRY/EUR/USD girebilir;
`fx_rate` yine “1 EUR kaç ilgili para birimi”dir, EUR satırında tam 1'dir
ve `amount_eur = amount / fx_rate` generated kolondur. Geri tarihli sarf
kaydında “en son kur” değil, `expense_date` gününden eski/eşit en yakın
`fx_rate_daily` yayını önerilir; kullanıcı değiştirirse `fx_source=manual`
olur. Farklı birimler (Adet · Kg · Litre · Metre…) TOPLANMAZ; ana tablo,
grafik ve anomali matrisi yalnız dondurulmuş **Aylık Tutar (€)** üzerinden
karşılaştırılır.

**SARF KDV'Sİ SUNUM HESABIDIR, DEFTER TUTARI DEĞİLDİR** (kullanıcı kararı
14.08.2026). Hızlı girişte birim fiyat ve satır tutarı KDV HARİÇTİR; satır
oranı varsayılan %20, seçenekleri %10 ve %1'dir. KDV ile KDV dahil tutar
fatura kontrolü için satırda ve alt toplamda hesaplanır fakat action
payload'ına girmez: `amount`, `amount_eur`, kayıt listesi ve bütün analizler
daima KDV hariç kalır. Bu ayrım ileride sessizce vergi dahil analize
çevrilmez (`lib/purchasing/vat.ts` — 14.08.2026'da sipariş tarafıyla ORTAK
hâle geldi ve %0 oranı eklendi).

**SARF BÖLÜMÜ OLUŞTURULABİLİR SEÇİMDİR.** Excel J sütunundaki 16 gerçek
bölüm başlangıç sözlüğüdür; canlı giderlerdeki yeni bölüm adları da listeye
katılır. Kullanıcı aradığı bölüm yoksa aynı `Combobox` içinde yazar, anında
seçer ve gider kaydıyla kalıcı hale getirir. Ayrı bir zorunlu master/FK
kurulmaz; eski kayıtlardaki bölüm snapshot'ı korunur.

**AYLIK KIRMIZI HÜCRE GRUBUN KENDİ GEÇMİŞİNE GÖREDİR** (`lib/purchasing/
consumables.ts`, saf + testli). Hücre HARİÇ diğer pozitif ve gelecek
olmayan aylardan en az üçü varsa, tutar onların ortalamasının `>1,5×`
üstünde kırmızı; `>2×` üstünde güçlü kırmızıdır. Tam eşikler alarm değildir.
Renk tek taşıyıcı olmaz, hücre `▲` ve oran ipucu da taşır. İçinde bulunulan
yıl varsayılandır; bu yıl/önceki yıl/iki yıl önce/Tümü hızlı seçilir. Tümü
görünümünde 36 aylık matris yerine grup × yıl matrisi kullanılır.

**SARF EXCEL AKTARIMI KAYIP VERMEDEN, KAYNAK SATIR İZİYLE YAPILIR**
(`20260814000002_import_consumable_expenses.sql`, üretici
`scripts/generate-consumable-import.mjs`). `SARF GİDERLER ESKİ VERİ.xlsx`
içindeki 07.03.2024–06.08.2026 tarihli **1364 satırın tamamı** aktarılır;
iş benzerliğine göre dedupe yapılmaz. Beş mükerrer çift silinmez,
`duplicate_candidate` işareti taşır. C sütunu tarih gerçeğidir; A/B dönem
uyumsuzlukları raw JSON ve `period_mismatch` olarak kalır. 101 boş Tanım
için uydurma SM kaydı açılmaz (`item_id NULL`, `blank_item`); iki boş Cari
aynı biçimde `blank_supplier` kalır. Her import satırı `source_ref` ile
tektir, ham A–Z değerleri immutable `legacy_payload`ta korunur.

**DEVREDİLEN SARF SAYILARI BİR SÖZLEŞMEDİR:** 97 kanonik tedarikçi adayı,
751 kanonik malzeme tanımı, 1364 gider satırı; kaynak toplamı
5.156.297,55 ₺ / 118.577,65 €'dur. Tedarikçi insert'i `ON CONFLICT DO
NOTHING` kullanmaz: çakışan aday bile TD sequence'ini tüketir. Önce
`WHERE NOT EXISTS(match_key)` sorulur. Aynı nedenle SM tanımları
deterministik kodlanır ve generator ikinci çalışmada byte-identical çıktı
vermelidir.

**SÜZGEÇLER ÇOKLU SEÇİMLİDİR ve ÇIKTIYA GEÇER.** `CokluSuzgec` `Select`
değil `DropdownMenu` kullanır çünkü Radix `Select` tek değerlidir ve çoklu
seçimde liste her tıklamada kapanırdı. Excel ve PDF ekranda GÖRÜNEN listeyi
indirir; seçim varsa yalnız seçilenleri. Kapsamı İSTEMCİ söyler (anahtar
listesi olarak), sunucu yeniden hesaplamaz — iki listenin ayrışmaması
ancak böyle garanti edilir (md. 16'nın dersi).

**KDV SİPARİŞTE DE SATIRDADIR — VE TEK BİR SÖZLÜK VARDIR**
(`lib/purchasing/vat.ts`, migration 20260814000004, kullanıcı kararı
14.08.2026: *"Sipariş açma bölümüne de Sarf Gideri Gir bölümüyle aynı
mantıkla kdv ekleyelim. 20 10 1 ve 0 % kdv olsun. Kullanıcı hep kdv hariç
fiyat girer, kdv otomatik gelir. Fiyat arşivi vb diğer grafiklerde her zaman
kdv hariç fiyat üzerinden gösterim yapılır."*). Oran BAŞLIKTA DEĞİL SATIRDA
durur: tek bir siparişte %20'lik bir rulman ile %1'lik bir kalem yan yana
olabilir. Liste sarf ile ORTAKTIR (%0 sarfa da açıldı) — iki ayrı liste,
aynı modülde aynı soruya iki cevap demekti; ayrışmayı `__tests__/vat.test.ts`
migration'ı OKUYARAK engeller.

**NET DEFTER, BRÜT KASA.** `unit_price` KDV HARİÇTİR ve fiyat arşivi,
tedarikçi dağılımı, sipariş akışı, sarf panosu — hepsi onu okur (KDV mahsup
edilen bir vergidir, maliyet karşılaştırmasına girmez). KDV DAHİL tutar
yalnız iki yerde çıkar: fatura kontrolü (pencere) ve **Ödeme Takvimi**;
orada satır "net + KDV" kırılımını da yazar. **AVANS DA KDV DAHİL TUTARDAN**
hesaplanır — tedarikçi peşinatı faturanın tamamı üzerinden ister. Sipariş
satırlarının `vat_rate` varsayılanı %20'dir ve GERİYE de işler: KDV kavramı
yokken girilmiş fiyatlar zaten KDV hariç yazılmıştı.

**SİPARİŞ PENCERESİ SARF GİRİŞİNİN GÖRSEL YAPISINI ALDI** (kullanıcı
kararı, 14.08.2026). Tedarikçi alanı `datalist` taşıyan bir metin kutusuydu
ve tarayıcıya bırakılmış bir öneri Türkçe katlamayı bilmiyor ("isdemir"
yazan "İSDEMİR"i bulamıyordu), TD kodunu göstermiyor ve dokunmatikte
açılmıyordu; artık `Combobox`tur ve yeni firma yine oradan deftere girer.
Alanlar etiketli bölümlere ayrıldı ve **HIZLI TERMİN** eklendi
(`DELIVERY_WEEKS` — sarfla ORTAK liste, kullanıcının istediği 10/12/16/20
hafta dâhil). Hafta seçiliyken sipariş tarihi değişirse termin ONA GÖRE
kayar: "altı hafta sonra" bir tarih değil bir mesafedir.

**14.08.2026 TURU — SİPARİŞ/TESLİM/HAVUZ AKIŞI DÜZENLENDİ.** Kullanıcının
21 maddelik listesi. Kalıcı kararlar:
- **ÖDEME TAKVİMİ KALDIRILDI** (md. 15): sayfa + nav sekmesi silindi,
  "ödendi bilgisi takip etmeyelim". Siparişler ekranındaki Teslim / Avans /
  Bakiye ödendi çipleri de gitti (md. 13) — Siparişler'de yalnız Düzenle +
  İptal kaldı. Ödeme sütunları DB'de duruyor ama UI'da okunmuyor.
- **TESLİM ARTIK KALEM BAZINDA** (md. 14, Teslim Takvimi): sipariş satırı
  açılıp Kalem·İş·Adet (FİYATSIZ) gösterir; tamamı ya da satır satır teslim
  alınır (`receiveOrderLines`), `received_at` TÜRETİLİR (bütün satırlar
  dolduğunda bugüne yazılır, biri eksikse temizlenir), %oran kırmızı→yeşil
  (`oranRengi`, OKLCH açı).
- **İPTAL GERİ ALINIR + YÖNETİCİ SİLER** (md. 8/9): `reopenOrder` iptal
  damgasını temizleyip paket işaretlerini yeniden yazar; `deleteOrder`
  yalnız yönetici + iptal edilmiş kayıtta.
- **SİPARİŞ ONAYI PDF'i** (md. 6/11): `lib/pdf/order-confirmation.tsx`,
  A4 DİKEY, fiyatlı (talep PDF'i fiyatsız); künye/süzgeç notu YOK.
  `/purchasing/siparisler/[id]/pdf` GET, satırdaki bağlantıdan iner.
- **SATIN ALMA PDF'LERİ DİKEY** (md. 12): talep PDF'i yatay→dikey, sütun
  10→8, satır `wrap` ile uzun yazıda büyür (iç içe geçmez), çok sayfalı.
- **SÖZLÜ İSKONTO** (md. 4): Sipariş Aç'ta KDV Hariç Tutar düzenlenebilir;
  yeni hedefe göre birim fiyatlar oranlanır (`iskontoUygula`). Toplam tek
  sütun (avro ikincil). Çift scroll kaldırıldı, KDV başlığı opaklaştı (md.
  3/5). Pano Siparişler/Teslim'de KAPALI açılır (md. 7).
- **TOPLU TEKLİF** (md. 2): havuzdan çoklu seçim → `BulkQuoteDialog`, tek
  tedarikçi + satır satır birim fiyat.
- **HAVUZ SATIR DÜZELTME + MANUEL TALEP** (md. 1/21, migration
  20260814000006). Düzeltme SNAPSHOT DEĞİL GÖRÜNÜM: `match_key` sabittir,
  yalnız `purchase_item_meta.label_override`/`qty_override` ile görünen
  tanım/adet ezilir — teklif/sipariş/fiyat arşivi bağı bozulmaz. Manuel
  talep `purchase_manual_demands`ta durur, türetilmiş havuza EK satır olarak
  katılır (`loadManualDemands`, `manualId` taşır) ve `drawing_parts`a
  dokunmaz; özet override/manuel sonrası `havuzOzetiniTazele` ile yeniden
  türetilir (çekirdek `demand.ts` DEĞİŞMEDİ). "Yeni Talep" düğmesi PDF'in
  yanında.

**TEKLİFTE ADET SORULMAZ** (kullanıcı kararı): teklif BİRİM FİYATtır ve
adet zaten havuzda yazar; iki yerde adet tutmak "hangisi doğru" sorusunu
doğururdu. Girilmiş teklif YERİNDE DÜZENLENİR — silip yeniden girmek teklif
TARİHİNİ de değiştiriyordu.

**VERİLMİŞ SİPARİŞ DÜZENLENEBİLİR — ÖNCEKİ KARAR TERSİNE ÇEVRİLDİ**
(`editOrder` + `siparisler/order-edit-dialog.tsx`, kullanıcı kararı
13.08.2026: *"Siparişler sayfasında önceden girilen sipariş
düzenlenebilsin."*). Eski kural "yanlış sipariş İPTAL edilir, yenisi
açılır" idi ve riski doğru okuyordu — satırları değiştirmek, onlara bağlı
teslim ve ödeme kayıtlarını sessizce geçersizleştirebilir. Ama iptal +
yeniden açmak yanlış yazılmış TEK bir birim fiyat için çok pahalıydı:
numara yanıyor, teslim ve ödeme işaretleri baştan giriliyordu. Risk
KAPATILDI, yok sayılmadı:
  · Satır KİMLİĞİYLE güncellenir (`upsert`, silip-yazma yok) ve yüke
    `received_qty` HİÇ GİRMEZ — kısmi teslim almış bir siparişte fiyat
    düzeltmek, gelen malı "gelmedi" yapmamalı.
  · ÇIKARILAN satırın paket işareti geri alınır
    (`anahtarIsaretleriniKaldir`, iptal yolunun aynısı).
  · YENİ KALEM EKLENMEZ: kalemin paket/iş kalemi/pay bağları yalnız Talep
    Havuzu'nda bilinir. Ek kalem için yeni sipariş.
  · Numara çakışması siparişin KENDİSİ hariç sorulur.
Ekranda İKİ yazma yolu vardır ve karıştırılmaz: ÇİPLER tek bir olguyu
işaretler (teslim · avans · bakiye · termin), DÜZENLE penceresi kaydın
tamamını yeniden yazar.

**TERMİN SONRADAN GİRİLİR VE DEĞİŞTİRİLİR** (kullanıcı kararı 13.08.2026).
Sipariş termin olmadan açılabilir (şemada zaten öyleydi) ama Siparişler
ekranında yazacak bir yer yoktu. Termin hücresi artık bir KUTUdur, ayrı bir
pencere değil — satınalmacının en sık yaptığı düzeltme budur ("tedarikçi
iki hafta gecikeceğini söyledi") ve pencere açtırmak onu üç tıka çıkarırdı
(durum çipi kuralının aynısı). Kutunun değeri `key` ile tazelenir, bir
`useEffect` ile DEĞİL: projede `react-hooks/set-state-in-effect` kapalıdır
ve efektle senkronizasyon basamaklı boyama üretir.

**HALKA GRAFİK ORANLI ŞERİDE DÖNDÜ** (`SplitBar`, kullanıcı bildirimi
13.08.2026: *"durum kırılımında yuvarlak pasta şeklinde olan grafik yapısı
mantıklı değil"* — aynısı Ödeme Takvimi'nin avans/bakiye kırılımı için).
Gerekçe ölçülebilir: halka AÇI okutur ve göz açıyı uzunluktan çok daha kötü
karşılaştırır — iki yakın dilimde grafiğin kendisi hiçbir şey söylemiyor,
cevap yandaki sayıdan okunuyordu. Üstelik sipariş durumları bir AŞAMA
SIRASIDIR (bekliyor → teslim → ödendi) ve çemberin başı sonu yoktur.
`DonutChart` KALDIRILMADI: İş Takibi'nde payların toplamı gerçekten bir
bütündür ve orada sıra yoktur.

**ZAMAN SERİSİ PANOLARI ÇUBUK DEĞİL ÇİZGİDİR** (kullanıcı kararı,
14.08.2026: *"Siparişler, teslim takvimi ve ödeme takvimindeki grafikleri
de benzer yapıya çevirelim"* — Sarf Analizi'nin çizgi grafiğine). Sipariş
Akışı, Teslim Akışı ve Nakit Çıkış Planı `TimeBarChart` yerine
`TimeLineChart` kullanır. `TimeBarChart` KALDIRILMADI: İş Takibi analizi ve
Personel kur ekranı hâlâ YIĞILMIŞ çubuk ister (dilimlerin üst üste binip
toplamı vermesi orada asıl bilgidir); satın alma panolarında ise okunan şey
eğimdir.

**NOKTA DEĞERİ EĞRİNİN ÜSTÜNE YAZILIR** (`TimeLineChart valueLabels`,
kullanıcı kararı 14.08.2026: *"grafik üstüne değeri yazalım, virgülden
sonra 1 basamak olsun"*). Biçim `fmtCompactEur1`dir — kısaltma eksenle
aynı ama ondalık HER ZAMAN tek basamaktır (eksen 2 haneye açılır, etiket
tek basamağa iner ki on iki ay yan yana okunsun). Etiket YALNIZ TEK SERİ
GÖRÜNÜRKEN çizilir: iki eğrinin değerleri üst üste binince okunmaz bir
yığın olur, o yüzden `valueLabels` bütün panolara güvenle geçilir ve
ödeme/teslim gibi iki serili kartlarda ancak kullanıcı efsaneden birini
kapatınca belirir. Etiket [0, height] içinde kalır (tepedeki nokta değerini
ALTINA alır): `overflow-x` veren kaydırma kabı `overflow-y`yi de auto'ya
çevirdiğinden (dokunmatik md. 14) tuval dışına taşan bir yazı yalancı bir
dikey kaydırma doğururdu.

**SARF ANALİZİNDE MALZEME BOYUTU** (`materialBreakdown` +
`materialDrilldownAggregate`, kullanıcı kararı 14.08.2026: *"En çok
kullanılan sarf malzemelerini listeleyelim; bir malzeme seçip seyrinin
grafiğini de görebileyim"*). Grup matrisinin altında bir sıralama tablosu
(ilk 25, kalanı seçicide) ve seçilen malzemenin aylık kullanım seyri +
tedarikçi kırılımı durur. `malzeme` adres parametresiyle taşınır
(tedarikçi seçicisinin aynısı) — grafik sunucuda üretildiği için seçim
paylaşılabilir bir bağlantıdır. Malzeme ve tedarikçi drilldown'ları ORTAK
`commonDrilldown` iskeletini paylaşır (dense aylık seri + ilk/son tarih +
en güncel etiket); yalnız ikinci boyutları farklıdır (tedarikçi →
grup+malzeme, malzeme → grup+tedarikçi). İskeleti iki kez yazmak, birinde
düzeltilen bir tarih hatasının ötekinde kalması demekti.

**PENCERE KUTULARININ ADI "Baş Harfler Büyük"tür** (kullanıcı kararı,
13.08.2026 — Sipariş Aç ve Siparişi Düzenle): "Sipariş No", "Sipariş
Tarihi", "Birim Fiyat", "Para Birimi". Metinler ELLE öyle yazılır, bir
dönüştürücüden geçirilmez (Personel özet kartlarının kuralı): aralarında
simge ve kısaltma var ("1 € = ?", "Avans %"). Sipariş Aç penceresinin ALT
BAŞLIĞI da kaldırıldı ("7 kalem · tek tedarikçi. Kalemler birden çok işe
gidiyor…"): doğru ama kullanıcının hiçbir kararını değiştirmeyen bir
dipnottu. `DialogDescription` yine de basılır, `sr-only` olarak — Radix
`aria-describedby` bağını arar.

**VERİTABANI SÜTUNU OLMAYABİLİR VARSAYIMI HER OKUMADA GEÇERLİDİR.**
`tags`, `qty`, `shares_drawings_with`, `due_at`, `purchase_suppliers.code`
— hepsi ZENGİN sorgu + DAR yedek kalıbıyla okunur. Bir sütunun eksikliği
yüzünden BÜTÜN sayfayı kaybetmek, eksikliğin kendisinden çok daha pahalıdır.

**İKİ MIGRATION AYNI SÜRÜM NUMARASINI TAŞIYAMAZ** (13.08.2026'da ölçüldü).
`20260813000001` iki dosyaya birden verilmişti (personel ücret planı +
satın alma tedarikçi defteri); ikisi ayrı oturumlarda yazıldığı için
çakışma yerelde görünmedi. `db push` uzak veritabanında patladı —
`schema_migrations` birincil anahtarı SÜRÜMdür ve ikinci dosya
"duplicate key" verdi. Uygulanmamış satın alma bloğu bu yüzden
`20260813010001…010005` olarak yeniden numaralandı (göreli SIRA korunarak:
`import_price_history` kendinden önceki tablolara yazıyor). Kural: yeni
migration eklerken `ls supabase/migrations` ile aynı gün başka bir dosyanın
aynı damgayı taşımadığı DOĞRULANIR.

**SATIN ALMA SATIRI TELEFON VE TABLETTE BÜTÜN BİR İŞLEM KARTIDIR** (kullanıcı
kararı, 23.08.2026). Ekipman Talep Havuzu ile ortak Siparişler tablosu 1024 px
altında yatay kaymaz; seçim/genişletme, kalem veya tedarikçi künyesi, miktar,
termin, fiyat ve Durum/Düzenle işlemleri aynı kartta görünür. Masaüstü tablo
işaretlemesi korunur (`oc-tablet-table`); ikinci bir mobil veri ağacı yoktur.
Teklif karşılaştırma matrisi ve zaman grafikleri bu kuralın istisnasıdır ve
kendi görünür kaydırma kabında kalır. Talep, sipariş onayı, hammadde ve kesim
planı PDF'leri gerçek dosya olarak indirilir ve destekleyen telefonda yerel
paylaşım menüsüne verilir.
