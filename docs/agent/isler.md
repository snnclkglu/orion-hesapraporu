# İşler ve iş kalemleri

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/isler.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/jobs/**` · `src/lib/job-items.ts` · `src/lib/job-status.ts` · `src/lib/tags.ts` · `src/app/(app)/jobs/**` · `src/app/(app)/admin/customers/**` · `src/components/command-palette.tsx` · `src/lib/panel-index.ts`

## IS-25 — İŞLER BİR HUB'DIR

(kullanıcı kararı, 16.08.2026: *"İşler sayfasını
Notion gibi gelişmiş bir iş yönetim programına çevirmek istiyorum …
tüm kullanıcılara hitap edecek genel iyileştirmeler"* — kapsamın tamamı
ve dört tasarım kararı onaylandı). Dokuz fazda kuruldu; kalıcı kurallar:

**GÖRÜNÜM DURUMU ADRESTEDİR ve sözleşme TEK yerdedir**
(`lib/jobs/view-state.ts`): `/jobs?view=tablo|pano|takvim|zaman` +
`yil/musteri/durum/q/sirala/grup/ay`. Varsayılan adrese YAZILMAZ (boş
adres = varsayılan görünüm; kayıtlı açılış görünümü tam o boşluğa
uygulanır ve parametreli girişi ASLA ezmez). SÜZGEÇ KURALI da tektir
(`lib/jobs/filter.ts`): tablo, pano, takvim, zaman ve `/jobs/export`
Excel ucu AYNI fonksiyondan süzer (İş Takibi'nin worklog/filters dersi).
Arama `trKatla` iledir ve parça parça eşleşir; yazım ANINDA süzer,
adrese 350 ms gecikmeyle yazar.

**ÇOCUK KAYITLAR İŞE BAĞLANIR, KALEME DEĞİL:** `updateJob` kalemleri
silip yeniden yazar; `job_items.id`ye bağlanan her yeni kayıt ilk
düzenlemede yetim kalırdı. Görev/yorum/olay/favori `jobs.id` taşır,
kalem bağlamı `item_no` METNİDİR (md. 17'nin kuralı).

**İŞİN BİYOGRAFİSİ `job_events`TİR** (drawing_package_events'in ikizi;
20260817000001): `audit_log`da job_id sütunu yok ve iş olayları jsonb
içinde sorgulanamıyordu. audit yazımları KALDIRILMADI — iki defter iki
ayrı soruyu cevaplar. Olay yazımı asıl kaydı ASLA bloklamaz (hata
yutulur). Akış sekmesi olay + yorumu TEK kronolojide basar; "yorum"
OLAYI akışta ayrıca basılmaz (yorumun kendisi satır olarak durur).

**GÖREVİN DURUMU `done_at` DAMGASIDIR**, enum değil: yapılacakta "yarım"
diye bir olgu yok. Atanan `drawn_by` kalıbıdır (set null). Şablon defteri
(`job_task_templates`, /admin/task-templates) BOŞ BAŞLAR — hazır madde
uydurulmaz. YORUM gövdesi düz metindir, `@AD SOYAD` içinde durur;
anılan kimlikler KAYIT ANINDA SON METİNDEN çıkarılır (`lib/jobs/
mentions.ts`) — composer'ın eklediği liste değil.

**BİLDİRİM SİNYAL DEĞİLDİR** (md. 23'ün beklediği defter;
20260817000003): kişiye yazılır, okunur, kapanır. Fan-out kuralı SAF
çekirdektedir (`lib/jobs/notify.ts`, testli): atama→atanan; anma→
anılanlar; durum→favorileyenler ∪ açık görev sahipleri; işlemi yapan
HARİÇ. Favori listesi sahibine kapalıdır; fan-out DAR bir security
definer geçitten okur (`job_favorite_user_ids` — drawing_purchase_summary
kalıbı). Zil 60 sn'de bir İSTEMCİDEN sayar (realtime bilerek yok);
"Tümünü okundu say" 90 günden eski OKUNMUŞU fırsatçı siler — okunmamış
asla silinmez.

**PANO YENİ BİR "AŞAMA" ALANI AÇMAZ:** sütun boyutu var olan alanlardan
türetilir (durum/müşteri/lider/yıl) ve SÜRÜKLEME YALNIZ DURUMDADIR —
bırakma `setJobStatus`un kendisidir, yeni bir yazma yolu değil. Durum
sütunlarının dördü de HEP görünür (boş sütun karta hedefdir); öteki
boyutlarda boş grup düşer ve adsızlık torbası ("Atanmamış") EN SONDADIR.
dnd-kit `DndContext`e SABİT `id` verilir — sayaç kimliği hidrasyonda
uyuşmuyordu. Telefonda pano dikey açılır gruplara katlanır (md. 15);
kart markup'ı TEKTİR.

**TAKVİM İZGARASI BURADA VARDIR** (md. 23 panonun kararıydı; İşler'inkini
kullanıcı açıkça istedi) ama telefonda AJANDAYA katlanır. ZAMAN görünümü
EKSEN KAYDIRMAZ: pencere süzülmüş işlerin min-maks aralığıdır, çubuklar
orana çevrilir; teslim tarihi olmayan iş "bugüne kadar" sürer ve AÇIK
UÇLU (kesik çerçeve) işaretlenir — bitiş uydurulmaz. Tarihsiz işler
sessizce düşmez, altta sayılır.

**Ctrl/⌘+K'NİN SAHİBİ KOMUT PALETİDİR** (`components/command-palette`);
Panel'in satır içi araması kutu olarak kaldı, kısayol rozetini devretti.
Hit üretimi ORTAK çekirdeğe çıkarıldı (`lib/panel-index.ts`) — pano ile
palet ayrışamaz. Defter palet İLK açıldığında bir kez çekilir
(`/api/command-index`), süzme istemcide `panelAra` iledir; cmdk'nın
kendi süzgeci KAPALIDIR (slug değerli maddeleri kendisi elerdi).

**TOPLU İŞLEM TEKLİ YOLUN GÖVDESİNDEN GEÇER** (`bulkSetJobStatus` →
`durumYazVeBildir`): olay, denetim ve bildirim iş başına yazılır — toplu
bir UPDATE üçünü de sessizce atlardı; N ayrı yazım bilinçli bedeldir.
Seçim kutuları `sm` üstündedir; yapışkan bar
`env(safe-area-inset-bottom)` taşır (uygulamada İLK kullanım).

**KOYU TEMA YALNIZ BİR ANAHTARDI:** palet globals.css'te ilk günden
tanımlıydı; ThemeProvider (`attribute="class"`) + üst bar anahtarı
eklendi. `<html suppressHydrationWarning>` zorunlu; tetik ikonu iki
ikonun `.dark` ile seçilen çiftidir — JS beklenmez, hidrasyon şaşmaz.

**DİĞER KALICI AYRINTILAR:** iş kopyalama `/jobs/new?kaynak=<id>` —
kalem/kapsam/müşteri kopyalanır, İŞ NO ve TARİHLER BOŞ kalır (eski
tarihi taşımak yanlış termin yazdırmanın en kısa yolu) ve sözleşme PDF'i
kopyalanmaz. Detay `(hub)` rota grubudur: form (`/edit`, `/new`) kabuğun
ve sekmelerin DIŞINDA, dar düzende kalır. `isWide` `/jobs/[id]` alt
ağacını kapsar (edit/new hariç). Liste sorgusu sayımları `count`
embed'iyle alır (fiyat arşivi dersi). Son bakılanlar `localStorage`dadır
(cihaza özel kolaylık; okuma `useSyncExternalStore`). Excel dökümünde
kısaltmanın YANINA resmî unvan da basılır — dosya firma dışına gider.

## IS-26 — İŞ EMRİ YAYIMLANDIKTAN SONRA REVİZE EDİLİR

(kullanıcı isteği, 18.08.2026: *"Yeni iş açarken son girilen iş numarasında son
işten bir büyük sayı … Atölye çıkış tarihi ve teslim tarihine 1 2 3 4 5 6 7 8 ay
veya hafta olarak hızlı seçebileyim … Sevk Adresi ve Montaj Adresi kutu olsun …
İş Emri Başlığında Revizyon Numarası olsun. A B C D olarak yapsın."*)
Dört kuralın SAF çekirdeği tektir: `lib/jobs/is-emri.ts` (testli).

**İŞ NO ÖNERİLİR, DAYATILMAZ** (`sonrakiIsNo`). Defterdeki en büyük numaranın
bir fazlası yeni iş emri formunda HAZIR gelir ve kullanıcı değiştirebilir.
Numara serbest metindir ve devralınan kayıtlar son ek taşır (`0043-00-0000`):
KÖK okunur (ilk tire öncesi, `autoItemNos` ile aynı okuma). DOLGU GENİŞLİĞİ
VERİDEN çıkar — sabit `4` yazılsaydı beş haneye geçildiği gün öneri geriye
düşerdi. Hesap SUNUCUDADIR (`jobs/new/page.tsx`); defteri istemciye göndermenin
anlamı yok. İş KOPYALAMADA da öneri geçerlidir: kaynağın numarası taşınmaz.

**HIZLI TERMİN AYI TAŞIRMAZ** (`tarihEkle`). Atölye çıkış ve teslim tarihi
"işe başlamadan N hafta/ay sonra" diye konuşulur; iki alanın da yanında 1…8
adımlı bir menü durur ve menü SEÇENEĞİN SONUCUNU YAZAR ("4 hafta · 15.09.2026")
— kullanıcı hangi güne düştüğünü görmeden hafta ile ay arasında seçemez. Sayım
TABANDAN yapılır (iş emri tarihi, o da boşsa bugün) ve menü tabanı başlığında
söyler. Hesap UTC'DEDİR (yaz saati geçişinde gün kaymasın) ve AY EKLEMESİ AYIN
SONUNA KELEPÇELENİR: 31.01 + 1 ay = 28.02, 03.03 değil.

**SEVK VE MONTAJ ADRESİ MÜŞTERİ ADRESİNDEN AYRIDIR.** `customer_address` iş
emrinin basıldığı andaki müşteri künyesidir (fatura adresi); vinç çoğu zaman
başka bir tesise gider. İki ayrı sütundur çünkü sevk ile montaj da ayrılabilir;
formda montaj VARSAYILAN OLARAK sevkin aynısıdır (`*Auto` deseni) ve anahtar
düzenlemede ancak iki adres GERÇEKTEN aynıysa açık başlar — ayrılmış bir montaj
adresi ilk kaydetmede sevkin üzerine yazılmamalıdır. Adresler BÜYÜK HARFE
ÇEVRİLMEZ: md. 3 AD alanlarını kapsar, `customer_address` de çevrilmiyor.
Devralınan 63 satır BOŞ bırakıldı — `customer_address`ten kopyalamak uydurma
veri olurdu (md. 4). İş kopyalamada adres KOPYALANIR (tarihlerin tersine):
tekrarlayan siparişte değişen şey termin, değişmeyen şey teslim yeridir.

**REVİZYON HARFTİR ve BELGENİN KİMLİĞİNE GİRER** (`jobs.revision`, varsayılan
`A`; kısıt `jobs_revision_harf`, TS yarısı `revizyonHarfi`). Düzenleme formunda
anahtar AÇIK başlar ve harf bir sonrakine ilerler (A → B → C); kapatılınca alan
KAYITLI harfe döner ve elle yazılır — yazım hatası düzeltmek bir revizyon
değildir ve `B`yi harcamamalıdır. Hedef harf HER ZAMAN `initial`den türer, form
durumundan değil: aksi hâlde tek düzenleme her turda bir harf daha ilerlerdi.
Z'den sonra başa DÖNÜLMEZ (`AA`), çünkü aynı kimlik iki belgeye verilemez.
Belge kodu `workOrderDocCode` iledir (`ORC-IE-0063-RB`) — `docCode` imzası
BOZULMADI, o revizyonu SAYI olarak ister. Harf `A`da da basılır (teklifin
`offerRevLabel` kuralının tersi): iş emri iç bir belgedir ve atölyedeki soru
"elimdeki kâğıt hangi revizyon"dur; aynı gerekçeyle dosya adına da girer.
Revizyon AYRI BİR OLAYDIR (`revize`), "güncellendi" değil: harf değiştiyse işin
biyografisinde ayrı satır olarak durur.

**SAYFA DENGESİ BİR YERDEN ÖDENİR.** Sevk/montaj bloğu PDF'e eklendiğinde
ölçüldü: 2 · 5 · 10 · 12 kalemli emirler ikinci sayfaya taştı. `itemScale`
artık adresin varlığını da alır ve payı açıklama kutusundan, bölüm
aralıklarından ve satır iç boşluğundan kısar — atölyeye giden formun tek yaprak
kalması, el yazısı için ayrılan boşluktan önemlidir. Ölçüm `npx tsx
scripts/test-work-order.ts` iledir (1…16 kalem).

**`EMPTY_JOB` BİR İSTEMCİ MODÜLÜNDE DURAMAZ** (18.08.2026, `/dev/jobs-preview`
yakaladı). Sabit `job-form.tsx`teydi ve iki SUNUCU bileşeni onu oradan içe
aktarıp YAYIYORDU (`{ ...EMPTY_JOB }`). RSC grafiğinde bir istemci modülünün
dışa aktarımı gerçek değer değil bir REFERANSTIR: bütün olarak prop geçirmek
çalışır, yaymak alanların hiçbirini getirmez — form `scope`suz monte oluyor ve
"Cannot read properties of undefined (reading 'proje')" ile patlıyordu. İş
KOPYALAMA (`?kaynak=`) bu yüzden zaten kırıktı. Sabit `schema.ts`e taşındı.

## IS-14 — Hesap raporu İŞE değil İŞ KALEMİNE bağlanır.

Bir iş emri (`jobs`)
birden çok ürün içerir (`job_items`); rapor bir ÜRÜNÜN hesabıdır, işin
değil. Bağlantı `job_items.project_id`tedir; `projects.job_id` yalnız hızlı
süzme içindir ve `assignProjectToJob` ikisini birlikte yazar. İş detayında
her kalem satırı kendi raporunu gösterir; kaleme bağlanmamış raporlar ayrı
listelenir ki eşleşmemiş kayıt gözden kaçmasın.

**Kalem numarası kuralı** (`autoItemNos`, jobs/schema.ts): iş no `0075` ise
TEK kalemli işte kalem `0075-00`, ÇOK kalemlide numaralar `0075-01`den
başlar — yani ikinci kalem eklendiğinde ilk kalemin numarası da kayar.
Otomatik anahtar kapatılınca elle yazılır (uygulamanın `*Auto` deseni).

**DOKÜMAN NO = İŞ KALEMİ NUMARASI.** `projects.doc_no` bir kalem
numarasıdır ve belge kodu ondan türer (`docCode`, pdf/doc-naming.ts):

    0055-01  →  ORC-HR-0055-01-R01
    0055-02  →  ORC-HR-0055-02-R01

Alan serbest metin bırakıldığı için üç yazım birden dolaşıyordu: `0055`
(kalemsiz — aynı işe ikinci kalem eklenince ikinci rapor benzersizlik
kısıtına takılır ve kod hangi kaleme ait olduğunu söylemez), `0055-01`
(doğru olan) ve `0055-HR-001` (şemanın ilk yorumundaki örnek; belge kodunda
"HR" iki kez çıkıyordu). Yeni rapor penceresinde kalem seçiliyken alan
SALT-OKUNURDUR ve altında üretilecek kodun canlı önizlemesi durur.
ESKİ KAYITLAR DÖNÜŞTÜRÜLMEDİ (kullanıcı kararı): yayınlanmış raporların
kodu teslim edilmiş PDF'lerle aynı kalmalıdır.

**AD ALANLARI BÜYÜK HARFLE SAKLANIR** (kullanıcı kararı, 11.08.2026):
proje / rapor adı, iş adı, ürün adı ve müşteri adı. Dönüşüm `adBuyuk`
(`lib/tr-text.ts`, `toLocaleUpperCase("tr-TR")`) ile İKİ YERDE birden
yapılır — kullanıcı yazarken (anında görsün) ve Zod şemasında (kayıt hangi
kapıdan girerse girsin öyle olsun). Tek yerde yapılsaydı aynı ad iki
yazımla saklanır, listede "Amonyum Sülfat" ile "AMONYUM SÜLFAT" iki ayrı
satır gibi sıralanır ve dosya adı (`pdf/doc-naming.ts`, zaten BÜYÜK basar)
ile ekran ayrışırdı. `toUpperCase()` KULLANILMAZ: "i" harfini "I" yapar.

**DEVRALINAN SATIRLAR DA ÇEVRİLDİ** (12.08.2026, `20260812120000`): kural
yalnız formdan geçen kayıtlara işliyordu, iki büyük içe aktarımın satırları
(55 iş emri + 88 iş kalemi) kaynak dosyanın yazımını taşıyordu. Dönüşüm
SQL'DE YAPILMAZ — Postgres'in `upper()`'ı Türkçe farkında değildir
("İSDEMİR" → "ISDEMIR"); değerler `adBuyuk` ile hesaplanıp migration'a tek
tek yazılır. Bedeli kabul edilmiştir: "10 t x 21,70 m" → "10 T X 21,70 M"
(birimler de büyür). `baslikDuzeni` bunu GERİ ALAMAZ — o yardımcı
küçük→başlık yönünde çalışır ve tümü büyük sözcüğü kısaltma sayıp korur.

**EKİPMAN LİSTESİNDE MARKA VE MODEL DE BÜYÜKTÜR** (kullanıcı kararı,
12.08.2026) ama dönüşüm `adBuyuk` DEĞİL **`kimlikBuyuk`**tur. Ekipman adı
ve özellikler bir cümledir ve "Baş Harfler Büyük" kalır (md. 33); marka ile
model ise ürünün KİMLİĞİDİR ve siparişe o yazımla geçer. Ayrı bir yardımcı
gerekliydi çünkü listedeki markaların çoğu YABANCIDIR: Türkçe büyütme
"Conductix-Wampfler"i "CONDUCTİX-WAMPFLER" yapıyordu, düz `toUpperCase()`
ise "Haşçelik"i "HAŞÇELIK" yapardı. `kimlikBuyuk` kararı metnin kendisinden
verir — Türkçe'ye özgü harf (ş ğ ı İ ç ö ü) taşıyorsa tr-TR, taşımıyorsa
yerelsiz büyütür. Katalog eşlemeleri bundan ETKİLENMEZ: `dsKey` tr-küçük,
katalog defterinin `norm`u aksansız büyük harfe indirger.

**Müşteri defteri** (`customers`) iş emrinden ayrıdır: iş emrindeki
`customer_*` metin alanları basıldığı andaki bilginin FOTOĞRAFIDIR, defter
sonradan güncellenince yayınlanmış iş emri değişmez. Müşteri yalnız
LİSTEDEN seçilir ya da "Yeni Müşteri" ile deftere yazılır — serbest metin
girişi kaldırıldı, çünkü defter dışında ikinci bir müşteri listesi büyüyor
ve kısaltma/renk gibi defter alanları o kayıtlara bağlanamıyordu. Yeni
kayıtta zorunlu tek alan MÜŞTERİ ADIDIR; defter Yönetim → Müşteriler'den
düzenlenir ve silinir (`jobs.customer_id` `on delete set null`, iş emri
silinmez).

**SEVK TARİHİ GİRİLİNCE İŞ KENDİLİĞİNDEN "TAMAMLANDI" OLUR** (kullanıcı
kararı, 13.08.2026). Kural saf çekirdektedir (`lib/job-status.ts`) ve iki
yarısı vardır:

- **HEPSİ, herhangi biri DEĞİL** (`allItemsShipped`): işin BÜTÜN
  kalemlerinin sevk tarihi girilmiş olmalıdır. Fark yalnız çok kalemli
  işlerde görünür (canlı defterde 62 işin 11'i; en büyüğü dokuz kalemli
  "MUHTELİF VİNÇLER") ve orada ilk vincin sevki işi bitirmez. Kalemsiz iş
  sevk edilmiş SAYILMAZ — `[].every` doğru döner ve kelepçe olmasaydı yeni
  açılan her iş anında "Tamamlandı" olurdu.
- **YALNIZ VARSAYILAN DURUM DEĞİŞİR** (`autoCompletesOnShipment`): geçiş
  sadece `active`ten yapılır. Kullanıcının istediği *"manuel müdahale"*
  güvencesi budur ve AYRI BİR "elle ayarlandı" SÜTUNUNA GEREK BIRAKMAZ:
  `active` sütunun varsayılanıdır ("kimse bir şey söylemedi"), Pasif ·
  Tamamlandı · Arşiv ise üçü de bir insan kararıdır. Beklemeye alınmış bir
  işi sevk tarihi yüzünden tamamlamak, kullanıcının az önce verdiği kararı
  ezmek olurdu.

Etki `saveSale`tedir, TETİKLEYİCİDE DEĞİL: kural iki tablonun kesişiminden
okunur ve `jobs`a yazar, bunu SQL'de yapmak `security definer` bir yol
açmayı gerektirirdi. Bedeli yazılıdır — doğrudan SQL ile girilen bir sevk
tarihi durumu değiştirmez. Yalnız sevk tarihinin YENİ girildiği kaydetmede
çalışır: fiyat düzeltmek için açılan bir pencere, kullanıcının elle Aktif'e
çektiği bir işi yeniden tamamlamamalıdır. **SESSİZ DEĞİLDİR** — denetim
izine `job.status.auto` yazılır ve pencere ayrı bir bildirimle söyler;
başka bir sayfadaki bir kaydın sessizce değişmesi, kullanıcının onu bir
arıza olarak bildirmesinin en kısa yoludur.

**İş durumu** `job_status` enum'udur (aktif · pasif · tamamlandı · arşiv);
`projects.status` ile karıştırılmaz, etiket/renk `lib/job-status.ts`tedir.

**Liste ekranları KISALTMA ve RENK gösterir (`lib/tags.ts`).** Resmî unvan
satırın yarısını yiyordu; İşler ve Satış Takibi artık `customers.short_name`
ile müşterinin kendine özgü rengini gösterir, tam unvan `title` ile durur.
Kısaltmanın otomatik değeri adın İLK KELİMESİDİR ve kullanıcı düzeltebilir.

**Renk bir HEX değil AÇIDIR** (`customers.color_hue`, 0–359). Gerekçe: aynı
hex açık ve koyu temada birden okunmaz. Veri yalnız OKLCH ton açısını
taşır, doygunluk ve parlaklık `globals.css`teki `.oc-tag` kuralında ve tema
başına ayrı verilir — "soft pastel" kuralı veriyle değil TANIMLA garanti
edilir; kullanıcı tonu seçer, pastelliği bozamaz. Yeni müşteri var olan
tonlardan EN UZAK boşluğu alır (`nextDistinctHue`); defterde karşılığı
olmayan ad ise metinden türetilir (`hueFromText`), yani ekran hiçbir zaman
renksiz kalmaz. Aynı mekanizma satış kapsamı etiketlerini de renklendirir.
