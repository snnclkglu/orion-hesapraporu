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
BOŞ; kısıt `jobs_revision_harf`, TS yarısı `revizyonHarfi`). **İLK YAYIN
REVİZYONSUZDUR** (kullanıcı düzeltmesi, 18.08.2026: *"ilk açılan iş emri
revizyonsuz başlar. Eğer revize edilirse Revizyon A olur."*) — boş harf
"bilinmiyor" değil BİR OLGUDUR: bu belge hiç revize edilmedi. Bu yüzden
`revizyonHarfi` geçersiz girdiyi de BOŞA düşürür, `A`ya değil; `ORC-IE-0063`
son eksiz basılır; künyede, dosya adında ve hub rozetinde "REV" ibaresi hiç
geçmez. Formda kutu "Revizyonsuz" YAZAR — `placeholder` DEĞİL, `value`nun
kendisi (md. 5). Düzenleme formunda
anahtar AÇIK başlar ve harf bir sonrakine ilerler (A → B → C); kapatılınca alan
KAYITLI harfe döner ve elle yazılır — yazım hatası düzeltmek bir revizyon
değildir ve harf harcamamalıdır. Hedef harf HER ZAMAN `initial`den türer, form
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

## IS-27 — İŞLER HERKESE AÇIK, YAZMA YÖNETİCİ VE MÜDÜRDE

(kullanıcı kararı, 18.08.2026: *"işler sayfasını tüm kullanıcılara açacağım.
Yönetici ve Müdür harici düzenleme ve yeni iş açamayacak sadece görüntüleme
yapacak."*) Soru `canEditJobs`tır (`lib/roles.ts`), veritabanı karşılığı
`can_edit_jobs()` ve RLS `jobs` INSERT/UPDATE'i onunla keser; silme daha dar
kalır (`is_admin()`). **MÜHENDİS BU YETKİYİ KAYBETTİ** ve bu bir gözden kaçma
değildir: iş emri ticari bir belgedir (müşteri künyesi, sözleşme, termin),
hesap raporu ise mühendisin ürünüdür ve `canEditReports` ondan bağımsız durur.

**KAPSAM İŞ EMRİNİN KENDİSİDİR, HUB'IN TAMAMI DEĞİL.** Görev, yorum, favori,
bildirim ve RESİM ÇARPANI herkese açık kalır; `job_items` yazma politikası da
DOKUNULMADI — mühendis raporu kaleme bağlar (`assignProjectToJob`), ressam
çarpanı yazar. Atölyenin ortak tahtasını kilitlemek, bölümü herkese açma
kararını boşa çıkarırdı (IS-25).

**KAPI ÜÇ YERDE DURUR ve üçü de gerekli:** RLS (asıl engel), server action'ın
başındaki `yazmaIzni` (hatayı TÜRKÇE söyler — ham `row-level security policy`
metni kullanıcıya arıza gibi görünür; ayrıca `updateJob` kalemleri silip
yeniden yazar ve o yol ayrı bir politikadan geçer) ve arayüz (düğmeyi hiç
çizmemek). Salt-okunur durum rozeti DEVRE DIŞI DÜĞME DEĞİLDİR: soluk bir
düğme "şu an olmaz" der ve tekrar denetir, rozet ise tıklanacak bir şey vaat
etmez. Form adresleri (`/jobs/new`, `/jobs/[id]/edit`) sessizce yönlendirmez,
NEDENİ SÖYLER — adres elle yazılmış olabilir.

**SÖZLEŞME DOSYASI İŞLER'DEN KALKTI** ve Satış Takibi'ne taşındı (aynı karar:
*"Sözleşmeyi de görmesinler istiyorum"*). `jobs.contract_file_path` /
`contract_file_name` sütunları DÜŞÜRÜLDÜ, kayıt `job_contracts` tablosuna
geçti ve hem tablo hem `contracts` bucket'ı `can_see_sales()` ile kesiliyor.
Yalnız arayüzden gizlemek YETMEZDİ: `jobs` herkese okunur, yani yol da okunur
ve imzalı bağlantı oradan üretilebilirdi. "Sözleşme var" ile sözleşme TARİHİ
iş emrinde KALDI — ikisi işin bilgisidir, belgenin kendisi değil. Ayrıntı:
`docs/agent/satis.md`.

**DÖNEM SÜZGECİNİN VARSAYILANI SON 12 AYDIR** (kullanıcı bildirimi,
18.08.2026: *"zaman gösteriminden bir şey anlaşılmıyor. Bizim işlerimiz
genelde aylar sürüyor … İlk açılışta geçmiş 12 ay gelsin. Takvim de aynı
şekilde."*). Takvim yılı bu iş için doğal bir pencere DEĞİLDİR: 2 Ocak'ta
açılan sayfa Aralık'ta biten işleri düşürüyordu. `SON_12_AY` bir yıl değil
KAYAN bir penceredir; alt sınırı `son12AyBaslangici` verir (UTC, ayın sonuna
kelepçeli) ve ÜST SINIRI YOKTUR — ileri tarihli bir iş emri düşmemelidir.
Pencere boşsa eski kurala (içinde bulunulan yıl → tümü) düşülür. `bugun`
süzgece PARAMETRE olarak girer, `new Date()` ile içeriden okunmaz: çekirdek
saftır ve ekran ile `/jobs/export` aynı günü kullanmak zorundadır.

**ZAMAN GÖRÜNÜMÜ AY EKSENLİDİR.** Eksikti olan ÖLÇEKTİ: çubuklar işaretsiz bir
çizgide yüzüyordu. `buildGantt` pencereyi AY SINIRINA yuvarlar ve `months` ile
ay ay böler; görünüm o dilimleri başlık ve ızgara çizgisi olarak basar, her
satır süresini AY cinsinden yazar (30,44 günlük sabit bölen — okunacak şey
"yaklaşık kaç ay", ayın kaç gün çektiği değil). Başlıklar dar ekranda SEYRELİR
(12 aylık pencerede hepsini basmak okunmaz bir şerit yapardı) ama İLK ay her
zaman basılır. Eksen hâlâ KAYDIRMAZ (md. 15).

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

## IS-28 — İş takvimi YIL ile açılır; ay ayrıntısına İNİLİR.

Kullanıcı kararı (20.08.2026): vinç işleri çoğu zaman uzun bir yıla yayılıyor.
Takvim görünümünün ilk yüzü bu yüzden içinde bulunulan yılın on iki ayıdır; her
ay toplam tarih sayısını ve Atölye Çıkış · Teslim · Görev · Termin · Sevk
kırılımını gösterir. Ay kartına basılınca masaüstünde ay ızgarası, telefonda
ajanda açılır; **Yıl görünümü** düğmesi geri döner. Dönem süzgecinin varsayılanı
olan kayan Son 12 Ay DEĞİŞMEDİ — liste/zaman penceresi ile takvimin GÖRSEL
ÖLÇEĞİ iki ayrı karardır.

Yeni iş emrinde **“Sözleşme var” sorulmaz**; güvenli varsayılan `false`tur.
Mevcut kaydı düzenleme ekranında bilgi korunur. İş Lideri'nin yanında aynı kişi
defterini kullanan **Proje Yöneticisi** seçicisi vardır ve belge fotoğrafı
mantığıyla `jobs.project_manager` alanına METİN yazılır: profil adı sonradan
değişse de basılmış iş emrinin künyesi değişmez. İş detayı ve İş Emri PDF'i bu
alanı gösterir. Bu karar IS-27'deki eski “Sözleşme var iş emrinde kaldı”
cümlesinin YENİ İŞ formu kısmını değiştirir; sözleşme tarihi korunur.

İşler üstündeki dört özet telefonda **tek satırlık mikro karttır**: ikon ve
ipucu gizlenir, dört sayı 320 px'te de aynı satırda kalır; tablet/masaüstünde
bilgi kademeli geri açılır. Takvim yıllık kartları telefonda iki sütundur ve
sayfa `documentElement.scrollWidth > clientWidth` üretmemelidir.

## İş detayı mobil düzeni — 23.08.2026

İş hub'ındaki Genel Bakış · Görevler · Akış · Bağlantılar rayı telefonda tek
bir bölüm seçicisidir; masaüstündeki adresler ve aktiflik kuralı aynıdır. İş
kalemleri, bağlı raporlar, bağlanan satışlar ve resim adet çizelgeleri `md`
altında `data-label` başlıklı kartlara katlanır. Düzenleme ve belge eylemleri
kartın içinde kalır; iş listesi ve hub gövdesi yatay sayfa taşması üretmez.

## IS-29 — Müşteri profili kimlikten ticari ilişkiye uzanır; puan açıklanabilir.

Yönetim → Müşteriler satırındaki **Profil** eylemi `/admin/customers/[id]`
sayfasını açar. Profil; firma künyesi, logo, adres/vergi/telefon, etkin/pasif
iletişim kişileri, teklifler, alınan işler ve mühendislik projelerini ayrı
gruplarda gösterir. Teklif tutarları kur dönüşümü yapılmadan para birimi
bazında ayrılır; EUR ile USD tek bir yanıltıcı toplamda birleştirilmez.

Projeler müşteri ADI benzerliğiyle bağlanmaz. Önce `jobs.customer_id` ile
müşterinin işleri bulunur, sonra yalnız bu işlerin `projects.job_id` kayıtları
alınır ve `report_context = engineering` ile teklif hesabı projeleri dışarıda
kalır. Benzer unvanlı iki müşteriyi karıştırmaktansa bağsız kaydı göstermemek
daha güvenlidir.

Müşteri ilişki puanı 100 üzerinden güncellik, son 12 ay teklif etkinliği,
sonuçlanmış teklif kazanım oranı, aktif iş sayısı ve kayıt bütünlüğünden oluşur.
Varsayılan ağırlıklar 25/20/25/20/10'dur; güncellik penceresi 365 gün, tam
teklif hedefi 6/yıl, aktif iş hedefi 2'dir. Yönetim → Profil Puanlama bunları
değiştirir ve ağırlık toplamını 100'e zorlar. Bütünlük adres, vergi dairesi,
vergi no, firma telefonu, logo, etkin kişi ve etkin kişi e-postasını sayar.
Puan finansal risk, ödeme davranışı veya müşteri memnuniyeti hükmü değildir;
ekran formülü ve eksik alanları açıkça söyler.

## IS-30 — Mühendislik ana defteri İŞ BAZINDA katlanır; doküman kalemde kalır.

Kullanıcı kararı (04.09.2026): *"Bir işte 10 tane kalem varsa mühendislik
sayfası giriş tablosu şişecek … kullanıcı ilk tablodan işe girsin sonra iç
sayfada dokümanlar listelensin."* Ana `/projects` defteri bu yüzden aynı
`projects.job_id` değerini taşıyan **iki veya daha fazla** hesap raporunu tek iş
satırına katlar. İşe bağlı yalnız bir doküman varsa satırın doküman no, proje,
revizyon, durum ve işlem davranışı ESKİSİYLE AYNIDIR. Bağımsız raporlar da
doğrudan satır olarak kalır. Teklif Hesap Raporları işe bağlanmadığından bu
katlamayı kullanmaz.

İş satırı `/projects/jobs/[jobId]` adresine açılır; içeride o işin bütün hesap
raporları ayrı satırlardır ve doküman numarasına göre sıralanır. Grup satırında
tek bir yapay V numarası veya durum UYDURULMAZ: son revizyonlar yayın/taslak
sayısı olarak, proje durumları aktif/arşiv sayısı olarak özetlenir. Arama iş no
ve başlığının yanında içerideki HER doküman no/ad/vinç tipini tarar. Yıl,
müşteri ve durum süzgeçlerinde grubun herhangi bir dokümanı eşleşiyorsa iş
satırı görünür; iç sayfa açıldığında yalnız eşleşen değil bütün dokümanlar
listelenir.

İç sayfadaki **Yeni Hesap Raporu** penceresi o işe sabittir; kullanıcı raporu
yanlışlıkla bağımsız ya da başka işe açamaz, yalnız iş kalemini seçer. Seçilen
kalemin `job_items.project_id` alanı proje oluşturulurken yazılır ve kalemin
gerçekten aynı işe ait olduğu INSERT'ten önce doğrulanır. Yalnız
`projects.job_id` yazmak yeterli değildir: iş gruplaması çalışsa bile İşler
detayındaki kalem → rapor bağı boş kalırdı.

Katlama `lib/project-list.ts` saf çekirdeğindedir ve testlidir. Veri şeması
değişmez: rapor hâlâ iş kaleminin belgesidir (IS-14); yeni katman yalnız ana
defterin yoğunluğunu azaltır. Ana ve iç tablo telefonda tek kolon karta,
tablette iki kolon karta katlanır ve yatay sayfa taşması üretmez.

## IS-31 — Mühendislik İŞ VERİSİNİ SEÇER, İşler ekranına geçmez.

Kullanıcı kararı (05.09.2026): *"Mühendislik bölümü kendine ait tabloları
olsun … işleri seçip hesap raporu açıp bağlayabilsin ama işler sayfasına
gidemesin."* Mühendislik iş emrini ve iş kalemini bir **bağlantı kaynağı**
olarak okumaya devam eder: yeni rapor penceresinde aktif iş seçilir, kalem
seçilir ve `projects.job_id` ile `job_items.project_id` birlikte yazılır;
mevcut rapor da aynı seçiciden başka bir kaleme bağlanabilir. Bu veri bağı
Mühendisliğin İşler arayüzüne geçiş vermesi anlamına gelmez.

`/projects` ağacındaki kullanıcıya görünen hiçbir iş numarası, geri oku,
kırıntı ya da eylem `/jobs` veya `/jobs/[id]` adresine bağlanmaz. Çok
dokümanlı iş satırı ve proje künyesindeki iş numarası yalnız Mühendisliğin
kendi `/projects/jobs/[jobId]` doküman defterine açılabilir; tek dokümanlı
satır doğrudan hesap raporu projesine açılır. Proje detayının geri oku
Mühendislik ana defterine döner. İş verisi güncellendiğinde hesap raporu
eşleşmesinin taze kalması için `/jobs/[id]` önbelleğini yenilemek bir
**sunucu veri işlemi**dir, kullanıcı gezinmesi değildir ve korunur.

## IS-32 — Tekliften iş emri TASLAKTIR; kaynak izi kalıcı ve fiyat dışıdır.

Tekliften iş emri oluşturma doğrudan sessiz kayıt açmaz: kullanıcı önce iş no,
başlık, müşteri fotoğrafı, kapsam ve iş kalemlerini normal İş Emri formunda
görür ve düzeltebilir. Tekliften gelen adaylar kaynak etiketi ve eşleme
uyarıları taşır; bu istemci yardımcı alanları `job_items` tablosuna yazılmaz.

Onayda iş ve kalemleri yazmak, teklifi bağlamak ve mühendislik devrini
oluşturmak tek Postgres işlemidir. Devir kalem kimliği olarak değişebilen
`job_items.id`ye dayanmaz; İşler düzenlemesi kalemleri silip yeniden kurabildiği
için `job_id + item_no` kullanır. İş kalemi numarası bu nedenle teklif dönüşüm
anında boş ve iş içinde yinelenen olamaz.

Tekliften alınan teslim/sevk bilgileri yalnız form ipucudur. Açık ve tek anlamlı
değilse iş tarihine çevrilmez. Nakliye/montaj kapsamı da ancak ilgili ticari
satır açıkça “dahil/Orion kapsamı” diyorsa önerilir; kullanıcı son sözü söyler.

## IS-33 — İşler tablosu içten kaymaz; sayfa başına 100 iş gösterir.

Kullanıcı kararı (05.09.2026): İşler'in tablo görünümündeki 70dvh kelepçesi ve
iç dikey kaydırıcı kaldırılmıştır; belge gövdesi doğal olarak kayar. Tablo kabı
yatay kaydırıcı da açmaz, mevcut kırılım öncelikleri uzun iş adını sararak
sayfaya sığdırır.

Yıl/müşteri/durum/arama süzgeçleri önce bütün iş defterine uygulanır, sıralama
sonucu da bütünde oluşur; yalnız çizilecek DOM satırları en son 100'lük sayfaya
ayrılır. Arama bu yüzden bütün sayfaları kapsar. Süzgeç değişince tablo yeniden
ilk sayfadan başlar; toplu “tümünü seç” açık sayfadaki en çok 100 işi seçer,
öteki sayfalardaki önceki seçimleri sessizce kaybetmez.
