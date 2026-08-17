# Hammadde Havuzu

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/hammadde.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/purchasing/hammadde/**` · `src/app/(app)/purchasing/hammadde/**` · `src/lib/pdf/nesting-plan.tsx` · `src/lib/diagrams/nesting.ts` · `scripts/gen-profile-sections.py` · `scripts/test-hammadde*.ts` · `scripts/test-alim-analizi.ts`

## HAM-24 — HAMMADDE HAVUZU EKİPMAN HAVUZUNUN SÜZGECİ DEĞİL, KARDEŞİDİR

(`/purchasing/hammadde`, kullanıcı kararı 15.08.2026: *"Satın alma bölümü
talep havuzuna ikiye ayırmak istiyorum … ilk kısım talep havuzunun ekipman
tarafı, ikinci kısım ise hammadde tarafı olmalı."*).

**DEFTER ARTIKSIZ ÜÇE BÖLÜNÜR** ve bu canlı veriyle ölçülür
(`scripts/test-hammadde-pool.ts`, 15.08.2026: 1399 = 512 ekipman + 778
imalat + 109 montaj):

    isPurchaseRow(p)                        → /purchasing        EKİPMAN
    !isPurchaseRow(p) && kind ≠ montaj      → hammadde ADAYI
    kind = montaj                           → hiçbir havuz (çocukları girer)

Hammadde var olan bölünmeye ÜÇÜNCÜ BİR KÜME EKLEMEZ: üretim kümesinin
üstünde tanımlı bir TÜREVdir. `purchasing/data.ts`teki
`.or("kind.eq.satinalma,part_code.eq.")` dizgisi harfi harfine korunur —
`purchasing-split.test.ts` onu KAYNAKTAN okuyor. Hammadde okuması bu yüzden
AYRI BİR DOSYADADIR (`purchasing/hammadde/data.ts`); aynı dosyaya ikinci
bir sorgu yazmak korumanın ya kendisini ya anlamını bozardı.

**ÇİFTE SAYIM DEĞİLDİR, İKİ FARKLI SORUDUR.** `SAC 15x375x1500` bir imalat
parçasıdır (atölye plazmada keser, `/progress`te takip edilir) ve aynı anda
bir malzeme ihtiyacıdır (kesileceği plaka satın alınır). Birim bile aynı
değil: üretimde ADET, hammaddede m² · metre · BOY · kilo.

**İKİ KATMANLI KİMLİK.** Havuzun satırı parça değil STOK KALEMİdir:
`SAC 15 MM S355JR` · `UPN 100 S235JR` · `RAY A65 S235JR` ·
`BORU Ø140/Ø90 S235JR` · `DOLU Ø90 CK45`. Anahtar `trKatla(stok adı)`dır ve
`purchase_quotes` · `purchase_order_lines` · `purchase_price_index` ile
AYNI `match_key` uzayındadır — teklif, sipariş ve fiyat arşivi hammadde
satırlarını EK KOD OLMADAN görür. **KALİTE ANAHTARIN PARÇASIDIR**: S235JR
ile S355JR aynı 8 mm'de bile aynı plaka değildir. `Steel, Mild` · `Generic`
· `-` bir kalite DEĞİLDİR (`kaliteAyikla`) ve stok adına yazılmaz; aksi
hâlde aynı sac iki kaleme bölünürdü.

**AYIKLAMA `tanimOlculeri`NİN İÇİNE KONMADI.** O fonksiyon bilerek
tutucudur (yalnız Ø okur) ve satın alma ekranının "İç/Dış Çap" sütunlarına
bir sac kalınlığı yazmamak için öyledir. Hammadde tam olarak onun okumadığı
yeri ister; iki sözleşmeyi tek fonksiyona sığdırmak `tanimOlculeri`nin
kapsamını sessizce genişletirdi (`firmaKabulleri`nin ayrı bir kapı olma
gerekçesinin aynısı). Çözücü `lib/purchasing/hammadde/cozumle.ts`tedir ve
SAFTIR.

**TANIMA SIRASI BİR ÖNCELİKTİR:** parantezli pay → kapsam kapısı → PROFİL
öneki → RAY → SAC → BORU → DOLU → DİĞER. `NPL 120x120x10 L=2150` üç ölçü
taşır ve önek okunmasaydı bir sac gibi görünürdü. Ölçüm (888 gerçek tanım,
üç teslim klasörü): 583 aday, 24'ü DİĞER — ve o 24'ün hepsi gerçekten
hammadde değil (kanca, kaplin, rulman, kauçuk, dişli, montaj adı).

**BEŞ SINIF + BİR TORBA** (`HAMMADDE_SINIFLARI`, ASCII: `PROFIL`/`DIGER` —
değer `check` kısıtında geçiyor). Kurallar kullanıcınındır: iki Ø = içi boş
(küçüğü iç, büyüğü dış) · tek Ø = dolu · `NPI ≡ IPN`, `NPU ≡ UPN` ·
`KARE DEMİR` bir dikdörtgen raydır · profil, ray ve korkuluk borusu 12 m boy
alınır · **parantez içi ölçü SATIN ALMAYA GİDEN ölçüdür**
(`TAMBUR BORUSU Ø405 ( Ø415)/ Ø358x1870 (1900)` → 415 / 358 / 1900).

**BOY OKUMADA `\bL` YETMEZ** ve bu gerçek bir tuzaktır: JavaScript'te `\w`
yalnız ASCII'dir, yani `PROFİL`in sonundaki `L` ile `İ` arasında bir sözcük
sınırı vardır. "DİKDÖRTGEN KUTU PROFİL 50x30x3 L=10500" tanımında naif kalıp
boyu **50** sanar. Kapı bu yüzden "önündeki karakter harf ya da rakam
olmayacak" biçiminde yazılır.

**METRE AĞIRLIĞI ÖNCE TABLODAN.** `Profiller.xls`ten üretilen 477 kesit
(`python scripts/gen-profile-sections.py` → `profil-kesitleri.ts`) ANMA
değeri verir; tabloda olmayan kesit (küçük köşebent, kutu profil, lama)
GEOMETRİDEN hesaplanır ve satır bunu SÖYLER (`agirlikKaynagi`, ekranda `*`).
Kaynak tablo UPN'de 100'den, IPN'de 120'den başlıyor; atölyenin kullandığı
UPN 60·65·80 ve IPN 80·100 **DIN 1026-1 / DIN 1025-1**'den elle eklenir
(`KUCUK_KESITLER`) çünkü gövde/flanş kalınlığı tanımda yazmaz ve
geometriden çıkarılamaz. Kesişim bir SINAMADIR: UPN 100 ve IPN 120 iki
kaynakta da aynı sayıyı söylüyor. A serisi ray kütleleri
`lib/calc/tables.ts:RAILS` ile ayrışmaz (test).

**ÖZKÜTLE 7,85 — AMA ÇELİK OLMAYAN SESSİZCE ÇELİK SAYILMAZ.** Kullanıcının
"hepsi 7,85" cümlesi HAMMADDELER içindi; canlı veride üç Kestamid parçası
var ve çelik özkütlesiyle yedi kat ağır çıkıyordu. Liste KISADIR ve yalnız
gerçek bir satırda görülmüş malzemeleri taşır; tanınmayan malzeme çelik
VARSAYILIR ve satır `celikVarsayildi` ile künyelenir.

**"KAÇ BOY" TOPLAM/12 DEĞİLDİR.** Hata hep AZ yöndedir: on tane 7 m'lik
parça 70 m eder (naif: 6 boy) ama her boya yalnız BİR parça sığar — cevap on
boydur. `boyaYerlestir` 1B FFD ile yerleştirir; standart boydan UZUN parça
hiçbir boya sığmaz, AYRICA sayılır ve ekranda "⚠ ekli" görünür — sessizce
bir boya sayılmaz.

**BİRİMLİ `QTY` BİR ADET DEĞİLDİR** — canlı veride ölçülmüş GERÇEK bir içe
aktarım hatası (15.08.2026). `Item QTY` sütunu olmayan sayfalarda
`reconcile` yedek olarak `QTY`yi okuyordu ve o sütun `Testere` satırlarında
TOPLAM KESİM BOYUdur: `NPL 120x120x10 L=6000` satırının adedi 24.000
yazılmıştı (gerçekte 4 adet × 6.000 mm) ve `Math.max` bunu kötüleştiriyordu.
Hammadde havuzu tek bir köşebent için **2.900 TON** gösteriyordu. İki yerde
birden düzeltildi: `reconcile` birimli değeri artık adet SAYMAZ (adet boş
kalır, 1 varsayılmaz) ve `adediCoz` gerçek adedi `toplam boy ÷ birim boy`
ile türetir — bölme %1 toleransla tam çıkmalıdır, çıkmazsa deftere dönülür.
Aynı turda `kalinlikTanimdan` tek sözcüklü ad varsayımını bıraktı: 25 GERÇEK
plaka kalınlık kazandı (`KAPAK-1 30x190x190`, `RULMAN YATAGI SAC
50x257x257`), 20 YANLIŞ kalınlık düştü (`NPL 50x50x5 L=530`in kalınlığı 50
değildir, kesit ölçüsüdür).

**SAC PLAKA YERLEŞİMİ SAKLANMAZ, HESAPLANIR**
(`/purchasing/hammadde/yerlesim`). `sacYerlesimi` saf ve DETERMİNİSTİKtir;
parametreler ADRESTE taşınır (seçim · pay · plaka · döndürme) ve plan her
açılışta yeniden çıkar — böylece paylaşılabilir bir bağlantıdır. Tabloya
konsaydı parçalar değiştiğinde sessizce eskir ve atölye eski plana bakarak
keserdi. Algoritma **MaxRects-BSSF**tir ve gerçek veriyle ölçüldü (1798 sac
parçası, 26 kalınlık grubu): yoğun gruplarda doluluk %84–92, toplam 143 ms.
Guillotine REDDEDİLDİ (firma PLAZMA ile kesiyor; kenardan kenara kesim
kısıtı fireyi büyütürdü), Shelf REDDEDİLDİ (%60'larda kalıyor — sac
parçalarının boyları 23 mm ile 11.990 mm arasında değişiyor).

**PAY MODELİ İKİ YÖNLÜDÜR** ve yarısı sessizce kaybolabilirdi: parça
parçaya EN AZ g, parça KENARA EN AZ g. Her parça `(w+g)×(h+g)`ye büyütülür,
kullanılabilir alan `(W−g)×(H−g)` sayılır ve parça kutusunun sol-alt
köşesinden `+g` kaydırılarak çizilir. "Parçayı büyüt, plakayı olduğu gibi
bırak" biçimindeki basit model KENAR PAYINI SIFIR bırakır ve kullanıcının
şartının yarısını çiğnerdi. `yerlesimiDenetle` sonucu ÖLÇER (kenar payı ·
parça arası pay · taşma) — algoritmanın kendi iddiasına inanılmaz.

**SIĞMAYAN PARÇA SESSİZCE DÜŞÜRÜLMEZ**: nedeniyle listelenir
(`sigmayanlar`). Numaralandırma çizim ile listede TEK KAYNAKTAN gelir
(`parcaNumaralari`) — iki yerde ayrı üretilselerdi resimdeki "7" ile
listedeki "7" bir gün farklı parçayı gösterirdi ve bu, atölyede yanlış sacın
kesilmesi demektir. Kesim listesi parçanın KENDİ ölçüsünü yazar, plakadaki
döndürülmüş hâlini değil (`kaynakEnMm`/`kaynakBoyMm`). Çizim
`lib/diagrams/` modelini kullanır (`charts.tsx` DEĞİL): kesim planı kağıtla
atölyeye gider ve o katman tek yazımla hem web hem PDF'e basar. 12 m'lik
plakada 50 mm'lik bir parçanın üstüne yazı sığmaz — sığmayan numara
ÇİZİLMEZ, parça listede durur.

**VERİTABANI YALNIZ İNSANIN KARARINI SAKLAR** (migration
`20260815000001_hammadde.sql`): `purchase_raw_meta` (sınıf taşıma · ad
düzeltme · stok boyu · hariç tutma · not) ve `purchase_raw_manual` (elle
açılan talep). Havuzun kendisi bir tablo DEĞİLDİR — `drawing_parts` her
eşleştirmede silinip yeniden kurulduğu için oraya yazılan bir hammadde
kararı da kaybolurdu. **DÜZELTME ANAHTARI ÇÖZÜCÜNÜN ÜRETTİĞİ ANAHTARDIR**,
taşındıktan sonraki değil: yenisiyle saklansaydı bir sonraki okumada satır
zaten yeni anahtarda olur, düzeltme bulunamaz ve satır eski sınıfına geri
düşerdi. Düzeltme GRUP BAŞINADIR — o gruba sonradan katılan parçalar kararı
kendiliğinden devralır; parça başına kayıt tutulsaydı aynı yanlışı yapan
yeni bir resim yüklendiğinde kullanıcı taşımayı yeniden yapardı.

**TÜR BİR SÜZGEÇ DEĞİL BİR KİPTİR.** Beş kategori çoklu süzgeç değil TEK
SEÇİMLİ bir çip şerididir, çünkü SÜTUN DÜZENİNİ o belirler: sacda kalınlık
ve m², profilde kesit · kg/m · metre · kaç boy, boruda dış/iç çap. Tek bir
tabloya üçünü birden koymak on iki boş sütun doğururdu. **Sütun sayısı ELLE
SAYILMAZ** — sütunlar bir diziden üretilir ve açılır ayrıntının `colSpan`ı
o dizinin uzunluğudur (ekipman tablosundaki `sutunSayisi` sabiti bir sütun
eklendiğinde sessizce kayıyor).

**TAZELEME LİSTESİNE İKİ YOL EKLENDİ** (`/purchasing/hammadde` ve
`…/yerlesim`) hem `purchasing/actions.ts:tazele()` hem
`drawings/actions.ts:satinAlmayiTazele()` içinde. Eklenmeseydi yeni
yüklenmiş bir paket hammadde ekranına "düşmemiş" görünürdü — ekipman
havuzunda 12.08.2026'da birebir yaşanmış hata.

Duman testleri: `npx tsx scripts/test-hammadde.ts` (gerçek Excel'lere karşı
dilbilgisi ölçümü — sınıf dağılımı, DİĞER'e düşenler, okunamayan ölçüler) ·
`npx tsx scripts/test-hammadde-pool.ts` (canlı veritabanı; bölünmenin
artıksızlığını da sayar) · `/dev/hammadde-preview` (auth'suz görsel
önizleme, GERÇEK 0053 satırlarıyla).

═══════════════════════════ İKİNCİ TUR (15.08.2026, 13 + 3 madde)

**SAC SİPARİŞİ PARÇA DEĞİL PLAKA SİPARİŞİDİR** — kullanıcı bir DESSAN
proforması gösterdi ve karar oradan çıktı: *"Sac siparişinde parçaların bir
önemi olmuyor; onların birleştiği plakaları sipariş ediyoruz aslında."*
Tedarikçinin satırı birebir şudur:

    10 X 1500 X 6000 | ST37 | Plaka Adet 5 | Plk-Adt/KG 707 | 3.537 KG | 0,690 USD

Üç sonuç: (a) sipariş kaleminin adı `plakaStokAdi` ile üretilir ve
havuzdaki `SAC 10 MM S355JR`den FARKLIDIR — o bir İHTİYAÇ, bu bir ÜRÜNdür
ve plaka ölçüsü ancak YERLEŞİM yapılınca bilinir; (b) TİCARİ MİKTAR
KİLODUR (`unit: "Kg"`), plaka adedi bir niteliktir ve satır notuna yazılır
— birim fiyat kilo fiyatıdır ve adet üzerinden bir sipariş tutarı otuz kat
şaşardı; (c) havuzdaki SAC satırının durum çipi sipariş penceresi değil
YERLEŞİM ekranını açar, toplu "Sipariş Aç" düğmesi sac seçiliyken pasifleşir
ve sebebini söyler.

**YERLEŞİM EKRANININ İLK CEVABI "ALINACAK PLAKALAR"DIR** (kullanıcı isteği:
*"bir veya birkaç projeyi seçtiğimde … bana üste hangi plakadan kaç adet
alınması gerektiğini özet olarak versin. Ben plaka enini seçerim, ona göre
özet değişir."*). Tablo proformanın sütun düzenindedir ve seçim/plaka
ayarıyla birlikte değişir — ikinci bir hesap değil, aynı planın okunuşudur.
Plaka enlerine **1000**, boylarına **3000** eklendi.

**YERLEŞİM KENDİ KENDİNİ DENETLER** (`yerlesimDenetimi`, kullanıcı kararı:
*"Nesting çok önemli, yanlış olursa yanlış malzeme siparişi vermemize yol
açabilir."*). Beş kontrol: parça sayımı · kalem adetleri · pay ve çakışma ·
plaka sınırı · alan dengesi. GEÇENLER DE EKRANDA GÖRÜNÜR ve PDF'e basılır —
yalnız hatayı basmak "kontrol edildi mi" sorusunu cevapsız bırakır ve
sessizlik bir güvence sanılır. Kontroller algoritmanın iddiasını değil
SONUCU ölçer.

**`dimV`NİN İMZASI `(els, x, y1, y2)`DİR.** Argümanlar bir süre `(y1, y2,
x)` sırasıyla veriliyordu ve dikey ölçü oku plakanın İÇİNE düşüyordu
(kullanıcı ekran görüntüsü). Etiket de sola alındı; sağa bakan varsayılan
onu plaka kenarına bindiriyordu. Sol kenar boşluğu 46 → 76 birim.

**TALAŞLI İMALAT PAYI** (kullanıcı kararı): *"Teknik ressamın kendi pay
vermediği parçalara da biz pay vereceğiz. Dolu ve boru malzemede %5 pay
olacak, minimum 2 mm olsun, küsüratlı sayıları düşük ise yukarı
yuvarlasın."* Üç kelepçe: (a) yalnız DOLU ve İŞLENECEK BORU (iki çaplı
burç/bilezik) alır — sac, profil, ray ve STANDART BORU kesilir, işlenmez
(*"DİKİŞLİ BORU Ø33 bu korkuluk borusu buna pay vermeye gerek yok"* — ayrım
YAPISALDIR: `Ø × et` yazımı bir katalog profilidir, ad araması değil);
(b) pay DIŞ ÇAPA ve BOYA uygulanır, İÇ ÇAPA DEĞİL — kanıt ressamın kendi
yazımıdır (`Ø405 ( Ø415)/ Ø358x1870 (1900)`: dış çap ve boy büyümüş, iç çap
aynı); (c) RESSAMIN PAYI OTOMATİĞİ YENER — onunki bir karar, bizimki bir
kural. Ağırlık ve kesit kodu PAYLI ölçüden hesaplanır (sipariş edilen çubuk
odur); resim ölçüsü kaybolmaz, açılır ayrıntıda kendi sütununda durur.

**TEKLİF KARŞILAŞTIRMA** (`/purchasing/hammadde/teklifler`, kullanıcı bir
çalışma dosyası gösterdi): satır kalem, SÜTUN GRUBU TEDARİKÇİ (birim fiyat ·
tutar · teslim), başlıkta vade, altta firma toplamları. Teklife iki alan
eklendi (`payment_term_days`, `lead_time_days`; migration 20260815000003)
çünkü *"hepsinin vadesi, teslim süresi, fiyatı vs farklı oluyor"* ve en ucuz
fiyat tek başına bir cevap değildir. `lead_time_days` GÜNDÜR: **0 = Hazır**,
`null` = tedarikçi söylemedi — serbest metin olsaydı ("2 hafta", "15-20
gün") teklifler sıralanamazdı.

Çekirdek üç şey hesaplar ve üçü de ekranda durur: satır satır en ucuz
(BÖLÜNMÜŞ siparişin tabanı), tek firmadan en ucuz, ve seçili dağılımın
bedeli. **TUTAR MİKTARLA ÇARPILIR, BİRİM FİYAT DEĞİL** — 360 kg'lık bir
kalemde 0,50 ₺ fark 180 ₺, 3.620 kg'lıkta 1.810 ₺ eder. **EKSİK TEKLİFLİ
FİRMA "tek firmadan en ucuz" YARIŞINA GİRMEZ** ve toplamı SOLUK basılır:
üç kalemin ikisine fiyat vermiş bir firmanın toplamı ötekilerle
karşılaştırılamaz. Sipariş FİRMAYA GÖRE BÖLÜNÜR — kullanıcı *"ya da bölüp
de sipariş de verebiliriz"* dedi ve `OrderDialog` tek tedarikçiye yazdığı
için iki firma iki ayrı sipariş kaydı olur. Fikstür kullanıcının kendi
sayılarıdır ve test onları birebir doğrular (266.240 · 261.165 · 298.685).

**İŞ SÜZGECİ İŞ NUMARASINDAN KURULUR, KALEM NUMARASINDAN DEĞİL** (kullanıcı
bildirimi: *"iş filtrelendiğinde tablo değişmiyor"*). Ölçüldü:
`drawing_packages.item_no` her zaman bir `job_items.item_no` DEĞİLDİR —
MONORAY paketi `0057-00` taşıyor ve o numarayla bir kalem satırı yok; o
paketin 35 kalemi süzgece hiç görünmüyordu. Süzgeç seçeneklerine SAYAÇ da
eklendi: sayısız bir listede kullanıcı "hiçbir şey değişmedi" der ve
haklıdır — değişimi ölçebileceği bir şey yoktur.

**OFİS KİLİT DOSYASI YÜKLEMEYİ DÜŞÜRMEZ** (kullanıcı ekran görüntüsü):
`~$1.0053-01-0000_URUN AGACI.xlsx` Excel'in belge açıkken yazdığı gizli
sahiplik dosyasıdır — uzantısı `.xlsx`tir ama içi zip değildir ve ExcelJS
"Can't find end of central directory" diyordu. Dosya REDDEDİLMEZ, YEDEK
sayılır (`file-name.ts`, md. 18/1) ve içerik okumasına girmez. Excel
aşamasının sorgusuna da `lifecycle <> 'haric'` süzgeci eklendi (PDF ve kesim
dallarında zaten vardı) ve daha önce yüklenmiş paketler için ad kuralı okuma
döngüsünde ikinci kez sorulur.

**HAVUZ TABLOSUNUN ÜSTÜNDE TOPLAM SATIRI VARDIR** (*"10 mm sac
filtrelediğimde kaç kg gerektiğini bana üste toplamalı"*). Toplam SÜZGECİ
İZLER — ekranda ne görünüyorsa onun toplamıdır; havuzun tamamının toplamı
ayrıca özet şeridindedir ve ikisi farklı sorulardır. ALTA DEĞİL ÜSTE konur:
satınalmacı süzgeci daraltıp sayıyı okuyor, iki yüz satırın dibine inmek
zorunda kalmak o hareketi kullanılamaz yapar.

**SATIR DÜZENLENEBİLİR VE EKİPMANA TAŞINABİLİR** (migration
20260815000002). Ad, kalite, adet, tür, stok boyu ve not `purchase_raw_meta`
üzerinden ezilir; ADET TÜRETİLENLE AYNIYSA YAZILMAZ, yoksa dondurulmuş bir
"40" ertesi hafta 60 parçaya çıkan bir işi 40'ta bırakırdı. *"Diğer kısmında
kaplin rulman gibi ekipmanları Ekipman tarafına taşıyabilmem lazım"* —
taşıma İKİ DEFTERE birden yazar (`to_equipment` hammaddeden düşürür,
`purchase_raw_equipment_keys` ekipman okumasına alır) çünkü iki havuz iki
ayrı anahtar uzayında yaşıyor. **KÜME BOŞKEN EKİPMAN EKRANI HİÇ EK SORGU
KOŞMAZ.**

**PARÇANIN PAFTASI SATIRDA AÇILIR**: açılır ayrıntıda her kesim parçasının
kendi resmi (`sheet_file_id`) ve bağlı olduğu montajın paftası ayrı
düğmelerdir. Montaj paftası ikinci bir sorgu değil AYNI DEFTERDEN çözülür —
montajın kendi satırı da bir parçadır. OLMAYAN DÜĞME ÇİZİLMEZ.

═══════════════════════════ ÜÇÜNCÜ TUR (15.08.2026, 13 madde + sipariş/analiz)

**KESİM PLANI PDF'İ AÇILMIYORDU VE SEBEBİ TEK BİR DİZGEYDİ.** `nesting-plan.tsx`
stilleri `fontFamily: "IBMPlexMono"` diyordu; `brand.tsx` o aileyi
**`PlexMono`** adıyla kaydediyor. @react-pdf tanımadığı aileyi sessizce
yedeklemez, ATAR (`Font family not registered`) — belge hiç üretilmiyor, uç
500 dönüyor ve kullanıcı yalnız "açılmıyor" görüyordu. Ad artık `FONTS`
sözlüğünden gelir (DejaVu yedeğiyle birlikte) ve koruma
`npx tsx scripts/test-nesting-plan.ts`tedir: belge GERÇEKTEN üretilir.

**PENCERE İÇİNDEKİ AÇILIR LİSTE TEKERLEKLE KAYMIYORDU** ve suç bizde
değildi: Radix `Dialog` açıkken `react-remove-scroll` sayfayı kilitler ve
bunu `document` üzerinde NON-PASSIVE bir `wheel` dinleyicisiyle yapar —
hedef kilitli kabın DIŞINDAYSA `preventDefault()`. `Popover` içeriği
`Portal` ile `body`ye taşındığı için tam olarak "dışarısı"dır; tıklama
çalışır, kaydırma çalışmaz. (`Select` düşmez: kendi kilidini yığının
üstüne koyar.) Çözüm dinleyiciyi kaldırmak değil OLAYI ONA ULAŞTIRMAMAKTIR
(`popover.tsx: kaydirmaKilidiniAs` → `stopPropagation`); `preventDefault`
çağrılmaz, tarayıcı kendi kaydırmasını yapar.

**TEKLİF ARTIK BİR PARTİDİR** (`purchase_quote_batches`, migration
20260815000004). Kullanıcı kararı: *"Her teklif aç dediğimde bu benzersiz
bir kodla takip edilebilsin … Her açtığım teklifi ayrı ayrı
değerlendirebileyim."* Parti BİR FİRMANIN BİR TEKLİFİDİR (`TK0001`,
sayaçtan) ve karşılaştırma matrisinin SÜTUNU artık odur — tedarikçi değil.
Fark gerçek: aynı firmadan iki hafta arayla alınmış iki teklif tek sütunda
eriyor ve hangisinin geçerli olduğu ekranda cevapsız kalıyordu.
· `purchase_quotes.batch_id` NULL OLABİLİR ve `on delete set null`
  taşır: parti bir KAPSAM künyesidir, kimlik değil — fiyat arşivi onu hiç
  bilmeden çalışır. Devralınan satırlara (tedarikçi, tarih) ikilisinden
  parti verildi.
· **İPTAL SİLME DEĞİLDİR** (siparişin kuralı): iptal edilmiş parti
  karşılaştırmaya, havuzun "en iyi fiyat" sütununa ve fiyat arşivine GİRMEZ
  (`loadTeklifler` süzer) ama defterde durur ve geri alınır. SİLME yalnız
  YÖNETİCİDE ve yalnız iptal edilmiş partide.
· **BİRLEŞTİRME AYNI FİRMA ŞARTINA BAĞLIDIR** ve bir kolaylık değil bir
  kelepçedir: iki firmayı tek partiye koymak "bir firmanın bir teklifi"
  tanımını bozar ve sütun kimin fiyatını gösterdiğini söyleyemez olurdu.
  Kaynak partiler silinmez, "TK0007 ile birleştirildi" damgası alır.
· Ekranın "Birleşik / Ayrı" düğmesi bir GÖRÜNÜM kararıdır ve veriye
  dokunmaz; veri düzeyinde birleştirme ayrı bir düğmedir.

**TOPLU TEKLİF TEK KAYITTA YAZILIR** (`saveBulkQuote`). Pencere satır satır
`saveQuote` çağırıyordu: on beş kalemde on beş gidiş-dönüş ve ortada
kesilirse YARIM bir teklif. Yazma düşerse açılan boş parti geri alınır —
kodu tüketilmiş ama satırı olmayan bir teklif, listede cevaplanamayan bir
soru olurdu. VADE ve TESLİM artık AÇILIR LİSTEDİR (`PAYMENT_TERMS` ile
ORTAK · `QUOTE_LEAD_TIMES`: Hemen · 1…6 · 8 hafta) ve teslim İKİ
KATMANLIDIR: üstteki seçim bütün satırlara uygulanır, satırın kendi kutusu
onu ezer. **SATIR DEĞERİ SUNUCUYA ÇÖZÜLMÜŞ GİDER** — `satır ?? parti` gibi
bir yedekleme, kullanıcının bilerek "Sorulmadı" yaptığı kalemi sessizce
partinin süresine döndürürdü; `null` iki şeyi birden anlatamaz.
Radix `Select.Item` BOŞ DEĞER KABUL ETMEZ: "sorulmadı" seçeneğinin değeri
`"yok"`tur, `""` değil.

**PARÇANIN ÖLÇÜSÜ DÜZELTİLEBİLİR — VE SAKLANAN ŞEY SAYI DEĞİL TANIMDIR**
(`purchase_raw_part_dims`, `lib/purchasing/hammadde/olcu-duzelt.ts`).
Kullanıcı kararı: *"en boy uzunluk ölçülerini düzenleyebilmek istiyorum …
hem parça ismi değişsin böylece. Değiştirdiğim kırmızı renkli olsun."*
Bu modülde ölçünün TEK KAYNAĞI TANIM METNİDİR (`cozumle.ts` sınıfı, kesit
kodunu, stok kalemini, metre ağırlığını hep ondan çıkarır); sayıyı ayrıca
saklamak ikinci bir gerçek üretir ve adı zaten değiştirmezdi. Düzeltme
tanımdaki DOĞRU JETONU değiştirir: alanlar YAZIM SIRASINDA, jetonlar soldan
sağa tüketilir ve **DEĞİŞMEYEN ALANIN JETONU DA TÜKETİLİR** — `SAC
10x100x100` tanımında yalnız boy değiştirildiğinde atlanan "en" jetonunu
bırakıyor ve boy ENİ değiştiriyordu (test yakaladı). `L=` yazımı varsa boy
jetonu ÖNCE oradan seçilir. Metinde karşılığı olmayan ölçü UYDURULMAZ,
"yazılamadı" diye söylenir. Düzenlenen ölçü RESİMDEKİDİR; pay (ressamınki
ya da firma kuralı) her okumada yeniden uygulanır.

**ÜST PAFTA ANA GRUBUNKİ DEĞİL, BİR ÜST MONTAJINKİDİR** (kullanıcı
düzeltmesi): *"11.1.1 için 11.1, 12.5 için 12."* Eski kod `parent_code`
bulunamayınca ANA GRUP koduna düşüyordu; üstelik defter sorgusu yalnız
İMALAT satırlarını okuduğu için montajın paftası o kümede hiç yoktu.
Resimler artık AYRI sorulur (montaj satırları dâhil) ve zincir YAKINDAN
UZAĞA yürünür (`ustPafta`); düğme hangi paftayı açtığını KODUYLA yazar.

**KESİM PLANININ ANTEDİ HER YAPRAKTA TEKRAR EDER** (kullanıcı bildirimi,
15.08.2026 — indirdiği belgeyi gösterdi: *"yerleşim ve antet doğru
değil"*). Belge beş yapraktı ve marka bandı YALNIZ İLK YAPRAKTAYDI; ikinci
yapraktan sonra kâğıtta ne belge adı, ne doküman kodu, ne sayfa numarası
kalıyordu. Kesim planı atölyeye kâğıtla gider, tezgâhta yapraklar dağılır
ve kimliksiz bir yaprak hangi işin hangi plakası olduğunu söyleyemez.
· Antet `BrandBand` DEĞİLDİR: o bileşen A4 DİKEY bir kapak bandıdır ve
  yatay sayfada logo ile kod arasında 800 pt boşluk bırakıyordu. Yerine
  teknik resim antedi gibi çalışan sabit bir şerit kondu (`Antet`, `fixed`):
  kimlik · belge adı · kapsam · doküman kodu · gün · **sayfa n/m**.
· Künye de sabittir (`Altbilgi`, `fixed`): `CompanyBlock` akışın SONUNA
  basılan bir imzadır ve beş yapraklık belgede yalnız son yaprağın
  ortasında görünüyordu.
· **`fixed` BİR TABLO BAŞLIĞI İÇİN KULLANILMAZ** ve bu ölçüldü: @react-pdf'te
  `fixed` öğe BÜTÜN yapraklarda tekrar eder, "tablo devam ettiği sürece"
  değil — kesim listesinin başlığı, liste bittikten sonra da yaprağın
  dibinde bir kez daha basılıyordu.

**ÇİZİM İKİ YÖNDEN BİRDEN KELEPÇELENİR.** `PdfDiagram` yalnız GENİŞLİK
alıyordu (760 pt) ve yüksekliği en/boy oranından çıkarıyordu. 12 m'lik
plakada bu doğrudur (oran ~0,21 → 160 pt); ama 2000×3000'lik neredeyse KARE
bir plakada oran 0,66'ya çıkar ve çizim 500 pt olur — A4 yatayın iç
yüksekliği 495 pt. Çizim sayfaya sığmıyor, `wrap={false}` kutusu bir sonraki
yaprağa atılıyor ve orada da taşıyordu; üstelik önceki yaprağın dibinde
160 pt'lik bir boşluk kalıyordu. Genişlik artık `min(en, maksYükseklik ÷
oran)`dır ve bir plaka çizimi içerik yüksekliğinin %45'ini geçemez: uzun
plakalar sayfa genişliğini kullanır ve İKİSİ BİR YAPRAĞA sığar, kare
plakalar yüksekliğe göre küçülür. Koruma `scripts/test-nesting-plan.ts`tedir
ve fikstür bilerek İKİ GRUPLUDUR (biri uzun, biri kare): antetin her
yaprakta tekrar ettiğini ancak çok yapraklı bir belgede ölçebilirsiniz.

**PLAKA TEKLİFİ, PLAKA SİPARİŞİNİN KARDEŞİDİR** (kullanıcı isteği,
15.08.2026: *"plaka siparişi aç tuşunun yanında plaka teklifi aç tuşu da
yapalım"*). İkisi de "Alınacak Plakalar" özetinden AYNI kalemleri alır ve
anahtar `trKatla(plakaStokAdi(...))`tır — teklif verilen plaka ile sipariş
edilen plaka aynı `match_key`i taşımasaydı alınan fiyat siparişte ve fiyat
arşivinde hiç görünmezdi. Teklif düğmesi siparişin SOLUNDADIR: iş akışında
önce fiyat sorulur.

**TEKLİF KARŞILAŞTIRMASI HAVUZ EŞLEŞMESİ ŞART KOŞMAZ.** Plaka teklifinin
anahtarı havuzda YOKTUR ve olmamalıdır (havuz `SAC 10 MM S355JR` bir
İHTİYAÇ, plaka `SAC 10 X 1500 X 6000 ST37` bir ÜRÜNdür); eşleşme şart
koşulduğu sürece kullanıcının yerleşim ekranından açtığı teklif
karşılaştırma sayfasında hiç görünmüyordu. Kalem künyesi artık havuz varsa
ondan, yoksa TEKLİFİN KENDİ `sample`ından okunur; sınıf stok adından
çözülür (`alimKategorisi`).

═══════════════════════════ DÖRDÜNCÜ TUR — "TEKLİFLER" (15.08.2026)

Kullanıcı bildirimi ve isteği tek cümlede: *"Plaka teklifi aç dediğimde
açılan pop-up'ta teklif detayları düzgün gelmiyor. Fiyat girdiğimde de
teklif karşılaştırma bölümüne düşmüyor, ancak tekliflere kaydedildi diye
uyarı geliyor. … Birkaç firmadan aynı teklifi aldığımda burada
görebileyim. Teklifin üstüne tıkladığımda bir pop up açılsın ve hangi firma
ne teklif verdi görebileyim. … teklifi düzenle, teklifi ayır, birleştir vb
özellikler de olmalı."*

**DÜZELTME BİR KAT AŞAĞIDAYDI VE ÖLÜ KOD BIRAKMIŞTI.** Yukarıdaki
"eşleşme şart koşmaz" kuralı SAYFADA uygulanmıştı ama SORGUDA değil:
`loadTeklifPartileri` teklifleri yalnız `in("match_key", havuzAnahtarlari)`
ile istiyordu ve plaka anahtarı orada olmadığı için satır daha
veritabanında eleniyordu — sayfanın yedeği hiç çalışmıyordu. Canlı veriyle
ölçüldü (15.08.2026): eski yol 1 satır, yeni yol 6 satır getiriyor ve
aradaki fark tam olarak kullanıcının girdiği iki plaka teklifidir (TK0006
`SAC 12 X 1500 X 3000 S235JR`, TK0007 `SAC 5 X 2000 X 12000 BDS`).
Okuma artık İKİ KÜMEYİ BİRLEŞTİRİR: anahtarı havuzda geçen satırlar ∪
kapsamı bu ekran olan PARTİLERİN satırları. Kapsam tek başına da yetmezdi:
devralınan kodsuz satırların partisi yoktur. **Süzgeçler tek bir `or(...)`
dizgisinde birleştirilmez** — PostgREST'in `or` sözdiziminde değerler metin
olarak gömülüdür ve `match_key` içinde virgül/parantez geçebilir; iki ayrı
sorgu + kimlikle tekilleştirme o riski hiç doğurmaz.

**DEVRALINAN PARTİNİN KAPSAMI 'hammadde' DEĞİL, BİLİNMİYOR.**
20260815000004 var olan bütün tekliflere parti verdi ve `scope`
varsayılanı 'hammadde' olduğu için hepsi hammadde damgası aldı; ölçüldü,
o partilerin ikisi de EKİPMAN teklifidir. 'ekipman' yazmak da bir tahmin
olurdu: üçüncü bir değer (`devralinan`) yazılır ve o partiler yalnız
KALEMİ bir havuzda karşılık bulduğunda görünür — anahtar hangi havuza
düşüyorsa oraya (migration 20260815000007).

**TEKLİF ARTIK BİR TALEPTİR** (`purchase_quote_requests`, `TT0001`).
"Aynı teklifi birkaç firmadan almak" cümlesi, ekranda satır olması gereken
şeyin FİRMANIN CEVABI değil SORULAN SORU olduğunu söylüyor. Parti
KALDIRILMADI (fiyat arşivi, kazanan işareti ve iptal damgası ona bağlı;
ayrıca "hangi firma ne dedi"nin cevabı odur) — talep onun ÜSTÜNE bir
kattır ve `on delete set null` taşır.
· **EŞLEŞME İMZADAN, SORUDAN DEĞİL**: talep, teklifin KALEM KÜMESİNİN
  kanonik metnidir (`lib/purchasing/talep.ts:talepImzasi`; SQL karşılığı
  migration'daki `string_agg(distinct … collate "C")`). Üç firmaya aynı
  listeyi gönderen kullanıcıya üç kez "bu hangi talep" diye sormak, her
  teklif girişine bir soru eklemek olurdu. İki tarafın imzası ayrışırsa
  ZARAR YOKTUR: yalnız yeni bir talep açılır ve kullanıcı birleştirir.
· **BİRLEŞTİR TALEP DÜZEYİNDE, AYNI FİRMA ŞARTI YOK** — parti
  birleştirmesindeki şart (`mergeQuoteBatches`) başka bir sorunun
  cevabıdır ve pencerenin içinde durur. **AYIR** (`splitQuoteBatch`) bir
  firmanın cevabını talebin dışına çıkarır; yeni talep `kapali` açılır,
  yoksa aynı imzalı bir sonraki teklif oraya geri düşer ve ayırma
  kendiliğinden geri alınırdı. Boşalan talep SİLİNİR.
· Ekran iki katmandır: LİSTE (`quotes-view.tsx` — hangi teklife bakacağım)
  ve PENCERE (`request-dialog.tsx` — ne kadar). Matris sayfanın gövdesinde
  dururken iki teklif yan yana okunamıyordu. Sekmenin adı da değişti:
  "Teklif Karşılaştırma" → **"Teklifler"**.

**TEKLİFTE MİKTAR ARTIK GÖRÜNÜR — VE İSTİSNANIN GEREKÇESİ YAZILIDIR.**
"Adet sorulmaz" kuralı *"adet zaten havuzda yazar"*a dayanıyordu ve
dayanak PLAKADA ÇÖKER: plakanın havuzda karşılığı yoktur, kilo yalnız
yerleşim yapıldıktan sonra bilinir. Pencere miktarı SORMAZ, geldiği
ekrandan (havuz satırı ya da kesim planı) taşır ve salt okunur bir künye
olarak gösterir; tutar ve toplam ondan çıkar (proforma: `3.537 KG × 0,690
USD`). Kayıtta `qty`/`unit` bir YEDEKtir: `teklifMiktari` havuz
konuşuyorsa havuzu okur — iki kaynak yine yoktur.

**MİKTAR KURALI ÜÇ EKRANDA AYRI YAZILMIŞTI VE AYRIŞMIŞTI**: havuz tablosu
`Math.ceil`, teklif karşılaştırması `Math.round` kullanıyordu ve aynı kalem
bir ekranda 361 kg, öbüründe 360 kg görünebiliyordu. Kural çekirdeğe indi
(`havuz.ts:stokMiktari`) ve YUKARI YUVARLAR — eksik sipariş verdiren bir
yuvarlama, fazladan bir kilodan pahalıdır.

**BURADAN VERİLEN PLAKA SİPARİŞİ PAKET İŞARETİ YAZMAZ ve bu SÖYLENİR.**
Pay listesi yalnız havuzda karşılığı olan kalemde doludur; bir plaka
onlarca parçanın kaynağıdır ve o bağ ancak kesim planı yapılırken bilinir
(yerleşim ekranı sipariş açarken onu yazar). Pencere satırın altında
uyarır — sessizlik burada bir güvence sanılırdı.

═══════════════════════════ SAC · PROFİL · RAY ALIM ANALİZİ (15.08.2026)

Kullanıcı bir çalışma dosyası verdi (*"Ben bunları exceldeki gibi takip
ediyordum"*) ve iki ekran istedi: **Siparişler** (`/purchasing/hammadde/
siparisler`) ve **Alım Analizi** (`…/analiz`).

**DEVRALINAN VERİ `purchase_orders`A YAZILMADI** (migration 20260815000005 +
üretilmiş 20260815000006, `scripts/generate-raw-purchase-import.mjs`).
Devralınan fiyat arşivinin birebir aynı gerekçesi: `purchase_orders` CANLI
BİR İŞ AKIŞIDIR ve 447 tarihsel alım oraya konsaydı modül ilk açılışta 447
"bekleyen sipariş" gösterirdi. `purchase_price_history` de değildir: bu soru
üç büyüklük daha ister — KİLO, KATEGORİ ve PLAKA ÖLÇÜSÜ.
**SAYILAR BİR SÖZLEŞMEDİR:** 447 satır (0 atlandı), 2024-03-26 → 2026-08-10,
13 tedarikçi, 1.056.196,12 kg, 34.793.600,83 ₺ · 886.288,19 $ ·
795.792,66 €. Kategori kırılımı SAC 898.747,32 · PROFİL 102.633,80 · RAY
54.815,00 kg ve bu üç sayı kullanıcının kendi "Özet" sayfasıyla birebir
aynıdır (`npx tsx scripts/test-alim-analizi.ts` yıl × kategori matrisinin
tamamını basar). Döviz karşılıkları GENERATED sütundur (TL ÷ o günün kuru)
ve dosyanın hazır sütunlarıyla satır satır karşılaştırıldı: 0 sapma.

**KAYNAĞIN KENDİ KATEGORİSİ ÇEVRİLMEZ.** Dosyada `BORU Ø34X3` satırının
kategorisi PROFİL yazıyor ve kullanıcı üç kovayla takip ediyor; uygulamanın
altı hammadde sınıfına yeniden sınıflandırmak, geçmiş seriyi kullanıcının
kendi defterinden farklı gösterirdi. CANLI sipariş satırları ise stok
ADINDAN sınıflanır (`alimKategorisi`) — `hammaddeCozumle` KULLANILMAZ: o
fonksiyon bir kesim parçasının üç ölçüsünü okur, burada okunan şey bir stok
kaleminin AİLESİDİR.

**TEDARİKÇİLER EŞLEŞTİRİLDİ, UYDURULMADI.** Dosyadaki 13 addan 12'si
defterde vardı; kısaltmalar ELLE eşlendi (`KARÇEL` → `KARÇEL KARDEMİR
ÇELİK`, `RZK ÇELİK` → `ARCELORMİTTAL RZK ÇELİK`, `TAŞ ÇELİK` → `TAŞÇELİK
DEMİR ÇELİK`, `FZK METAL` → `FZK TEKNİK METAL`, `ANKARA PROFİL BORU` → tam
unvan) çünkü otomatik bir benzerlik ölçüsü bunları ya kaçırır ya yanlış
firmaya bağlar. Yalnız `AĞIR HADDECİLİK` yeni açıldı (`WHERE NOT EXISTS`;
`ON CONFLICT DO NOTHING` TD sayacını tüketirdi).

**ORTALAMA AĞIRLIKLIDIR: TOPLAM ÷ KİLO** (`lib/purchasing/hammadde/
alim-analizi.ts`, saf + testli). Kullanıcının dosyasındaki "Birim Fiyat
(Ortalama)" sütunu ölçüldü ve aritmetik DEĞİL: 27.836,6467 € ÷ 38.777,01 kg
= 0,7178647 ve dosyanın yazdığı sayı tam olarak budur. Aritmetik ortalama 40
kiloluk bir boruyu 12 tonluk bir sac partisiyle eşit sayardı.

**YALNIZ KİLO KONUŞUR.** Sipariş satırının birimi "Boy" ya da "Adet" ise
kilosu BİLİNMEZ ve satır analize GİRMEZ; dışarıda kalanlar sayılır ve
ekranda yazar. İptal edilmiş sipariş de girmez — verilmemiş bir sipariş bir
alım değildir.

**İKİ GRAFİK, İKİ AYRI KURAL.** Fiyat eğrisi yalnız ALIM YAPILAN AYLARI
çizer (alım olmayan ayın ortalama fiyatı YOKTUR ve sıfır yazmak eğriyi
tabana çakardı); miktar eğrisi bütün ayları çizer, çünkü orada sıfır gerçek
bir cevaptır. Aylık ortalama alımın paydası GERÇEKTEN GEÇEN AYDIR (ilk
alımdan son alıma), takvim yılı değil.

**SİPARİŞLER EKRANI AYNI DEFTERİ OKUR** (`loadSiparisler`), ikinci bir
sipariş tablosu açmaz: süzgeç ve sunum ayrıdır, gerçek tektir. Hangi
siparişin "hammadde" olduğu SATIRIN ADINDAN okunur — havuz anahtarıyla
eşleştirme tam da en önemlilerini kaçırırdı, çünkü plaka siparişinin adı
havuzdakinden FARKLIDIR (`SAC 10 X 1500 X 6000 ST37` ↔ `SAC 10 MM S355JR`).

**VE ARTIK AYRI BİR EKRAN DA DEĞİLDİR** (kullanıcı kararı, 15.08.2026:
*"Hammadde bölümündeki siparişler sayfasını Satın Alma Siparişler
sayfasıyla birleştirsek. İki ayrı siparişler sayfası olmasa güzel olur. …
Siparişler sayfasının yapısını hem ekipman hem hammaddeye uygun planla.
Hammadde ve ekipman satırların arka planı farklı renk olsun, göze çarpsın.
Filtre olsun."*). `/purchasing/hammadde/siparisler` KALDIRILDI.
· Ayrı ekranın tek gerçek gerekçesi KİLOydu ("bu ay kaç ton sac aldık") ve
  gerekçe çürümedi, KARŞILANDI: kilo artık ortak ekranda özet kartında,
  satırda ve kalem detayında var; detay ayrıca TÜR · MARKA/KALİTE · TESLİM
  taşıyor (üçü de ekipmanda da anlamlıdır — bir rulmanın da markası ve
  kısmi teslimi olur). Geriye yalnız ikinci ekranın maliyeti kalmıştı:
  orada yazma yolu yoktu ve kullanıcı düzenlemek için öbür ekrana
  gönderiliyordu.
· **TÜR BİR SÜTUN DEĞİL, SATIRLARDAN TÜREVDİR** (`lib/purchasing/
  siparis-turu.ts`, saf + testli). Veritabanına "bu sipariş hammaddedir"
  diye bir alan AÇILMADI: kalemlerin ne olduğu adlarında yazıyor ve ikinci
  bir alan, düzeltilmiş bir kalem adından sonra sessizce yalan söylerdi.
· **KARMA ÜÇÜNCÜ BİR HÂLDİR, bir hata değil**: aynı firmadan hem ray hem
  cıvata alınır. Üçüncü değer olmasaydı o sipariş iki süzgecin birinde
  kaybolurdu; şimdi İKİSİNDE DE görünür (`turSuzgeciUyuyor`) — "bu ay ne
  kadar sac aldım" sorusunun cevabının parçasıdır.
· **SINIFLANDIRMA BİR GÖRÜNÜMDÜR, BİR KİLİT DEĞİL.** `alimKategorisi` ada
  bakar ve yanılabilir ("KARE SOMUN" profil kalıbına takılır); bedeli
  ölçülüdür ve kabul edilmiştir — yanlış sınıflanan sipariş yanlış RENKTE
  görünür, KAYBOLMAZ. Eski ekranda aynı yanılgı siparişi listeden tamamen
  düşürüyordu.
· **RENK TEK TAŞIYICI DEĞİLDİR**: satır zemini (`.oc-row-hue`, ton veriden
  / ayar `globals.css`ten — md. 14) türü bir bakışta verir, aynı bilgi
  tedarikçi hücresindeki `.oc-tag` çipinde YAZIYLA da durur.
· Hammadde rayındaki "Siparişler" sekmesi duruyor ama ortak ekrana
  `?tur=hammadde` ile girer — kapı duruyor, oda tek. Süzgeç bir BAŞLANGIÇtır,
  hapis değil: "Temizle" bütün defteri gösterir. Sekmenin aktifliği `href`ten
  DEĞİL ayrı bir `eslesme` alanından okunur; `usePathname` sorgu dizgisini
  taşımaz ve `startsWith("…?tur=…")` sessizce hep pasif bir sekme üretirdi.
· Görsel sınama: `/dev/siparisler-preview` (auth'suz, üç türü de basar —
  tek türlü bir fikstür ayrımın çalıştığını gösteremez).

Yazma yolu yine TEKTİR: düzenleme, iptal ve teslim alma `/purchasing/
siparisler`tedir (md. 18'in paket Satın Alma sekmesi dersi).
