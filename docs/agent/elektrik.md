# Elektrik Projesi

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/elektrik.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/electrical/**` · `src/app/(app)/projects/[id]/electrical/**` · `scripts/test-electrical-read.ts`

## ELEKTRIK-1 — Elektrik projesi BİZİM belgemiz değildir; arşivlenir ve OKUNUR.

Çizim bürosu (bugün İnfeed Otomasyon) projeyi tek bir PDF olarak verir —
gerçek bir örnek 157 sayfa / 12 MB'tır. Uygulama onu **hesap raporu projesine**
bağlar (`/projects/[id]` içindeki **Elektrik Projesi** sekmesi, Hesap Raporu ile
Teknik Resim Takibi'nin ARASINDA; kullanıcı kararı 19.08.2026) ve içinden üç şey
ayıklar: **malzeme listesi**, **sayfa dizini**, **künye**.

Sebep tek cümledir: aynı bilgi bugün üç yere elle yazılıyor — ekipman
listesine, satın almaya ve el kitabının elektrik ekine. Elle kopyalanan her
tablo bir gün kaynağıyla ayrışır.

**REVİZYON YOK, YÜKLEME VAR.** Uygulama kendi revizyon zincirini kurmaz; çizim
bürosunun sürümlerini (`rev3`, `rev4`) saklar ve hangisinin geçerli olduğunu
`is_current` söyler (kısmi tekil indeks: projede yalnız BİR güncel sürüm).
Eskisi SİLİNMEZ — teslim edilmiş bir el kitabı hangi sürüme dayandığını
gösterebilmelidir. Sürüm etiketi dosya adından **önerilir**
(`suggestElectricalRevision`), bulunamazsa BOŞ kalır.

## ELEKTRIK-2 — Sütun sınırı BAŞLIKTAN çıkarılamaz; sütunu VERİNİN KENDİSİ söyler.

Ölçüldü (185/40T Şarj Vinci, 157 sayfa, 726 satır): malzeme listesinde **başlık
ORTALANMIŞ, veri SOLA DAYALIDIR**. "Designation" başlığı x=397'de başlıyor ama
altındaki metin x=281'de; başlığa en yakın sütunu seçen her kural o metni komşu
"Quantity" sütununa yazıyordu.

Sola dayalı bir tabloda sol kenarlar **kümelenir**: aynı sayfada
43 · 252 · 281 · 575 · 780 · 927 değerlerinin her biri 55–56 kez, gürültünün en
yükseği ise 4 kez geçiyor. Ayrım bir eşik meselesi değil, iki büyüklük
mertebesi.

Başlık yine de gereklidir: **kümeler sütunun NEREDE olduğunu söyler, başlık NE
olduğunu.** İkisi soldan sağa MONOTON eşlenir; sayılar tutmazsa dinamik
programlama en ucuz monoton eşleşmeyi seçer (boş kalan bir sütunun kümesi hiç
doğmaz ve düz sıra eşlemesi oradan itibaren kayardı).

**BİRLEŞTİRME EŞİĞİ YAZI YÜKSEKLİĞİNDEN GELİR**, sabit bir punto değil. Ölçüldü
(aynı belgenin 157. sayfası): **adet sütunu sola dayalı değildir** — tek haneli
"1" x=252'de, iki haneli "24" x=248'de başlıyor ve iki ayrı küme doğuruyordu.
Yedinci küme, altı başlıkla eşlemeyi bozup tek haneli bütün adetleri
düşürüyordu (34 satır). İki AYRI sütun bir satır yüksekliğinden daha yakın
olamaz — o boşluğa tek bir harf bile sığmaz.

**YOĞUNLUK SÜZGECİ ANCAK YETERİNCE SATIR VARSA ANLAMLIDIR** (≥ 8 veri satırı).
Basit bir vincin malzeme listesi gerçekten kısa olabilir; az satırda bütün
kümeler tutulur ve ayıklamayı monoton eşleme yapar.

## ELEKTRIK-3 — Sayfa dizini YER İMİ AĞACINDAN okunur, metinden değil.

EPLAN dışa aktarımı dört kök üretir: `Page tree` · **`Page list`** ·
`Device list` · `Device tree`. Dizin için doğru olan **Page list**tir: tam sayfa
adedince satır taşır ve her satır bir sayfaya birebir düşer
(`=185T+LVD01/12 Ana Besleme/ CU320 I/O Kontrol-1`).

Hedef çözümü (`getPageIndex`) YALNIZ o kökün çocukları için yapılır: ağacın
tamamı 11.400'den fazla düğüm taşıyor ve hepsini çözmek saniyeler sürerdi.
Hedef çözülemezse listedeki SIRAYA düşülür — dizin eksik değil, yalnız daha az
kesin olur.

## ELEKTRIK-4 — Adet `null` olabilir ve bu SIFIR DEĞİLDİR.

`electrical_parts.qty` nullable'dır. Okunamayan bir adet **bilinmiyordur**;
`0` ya da `1` varsayılmaz (değişmez md. 4). Ekranda `—`, Excel'de BOŞ hücre,
toplamalarda ise "hiçbiri okunamadıysa toplam `null`" kuralı geçerlidir
(`rollupBy` · `materialRows`).

## ELEKTRIK-5 — İki görünüm, tek kaynak: AYGIT ve MALZEME.

Ham liste **aygıt başınadır** (`=185T+LVD01-F31` bir satır, `-F32` başka bir
satır) ve öyle olmalıdır — elektrikçi panoda hangi klemensin hangi şalter
olduğunu oradan okur. Satın alma ve el kitabının yedek parça eki ise aynı
ürünün kaç adet geçtiğini sorar (`materialRows`: 726 satır → 187 malzeme).

Aygıt etiketi IEC 81346 ön ekleriyle üçe ayrılır (`=` tesis, `+` konum, `-`
aygıt) ve **konum ayrı bir sütundur**: panel dökümü ondan çıkar ve bir LIKE
taramasıyla üretilemez. Ayrıştırıcı SIRAYI değil ÖN EKİ okur — bazı dışa
aktarımlarda konum tesisten önce yazılıyor.

## ELEKTRIK-6 — Okuma yeniden çalıştırılabilir; satırlar YENİDEN ÜRETİLİR.

`/projects/[id]/electrical/import` ucu eski satırları SİLER ve yenilerini
yazar. Birleştirme yapılsaydı kaynakta silinmiş bir satır hayatta kalırdı.
Ayıklayıcı geliştikçe aynı belge yeniden okunabilmelidir — aksi hâlde bugünün
eksik okuması belgeye kalıcı olarak yapışırdı.

Parçalama YOK ve bu ölçülmüş bir karardır: teknik resim içtirmesinde 450 AYRI
DOSYA indiriliyor ve baskın maliyet indirmedir; burada tek dosya var ve metin
katmanı 20 sayfayı 155 ms'de okuyor (157 sayfa ≈ 2 s).

**AÇILAMAYAN DOSYA KAYDI DÜŞÜRMEZ**: kullanıcı belgeyi görebilmeli ve
indirebilmeli; yalnız ayıklama başarısızdır ve `meta.note` ile GÖRÜNÜR olur.
Malzeme listesi bulunamadıysa bu bir uyarı olarak kullanıcıya taşınır — boş bir
tablo "proje malzeme taşımıyor" diye okunurdu.

## ELEKTRIK-7 — Çekirdek saftır, adaptör ayrıdır.

`parts-list.ts` · `sheet-index.ts` · `title-block.ts` · `rollup.ts` yalnız veri
alır, veri verir (değişmez md. 7). `read-pdf.ts` onları `unpdf` ile besleyen
**tek** yerdir ve `nodejs` çalışma zamanı ister; route'un içine gömülmedi çünkü
iki yerden çağrılıyor (içtirme ucu ve `scripts/test-electrical-read.ts`).

`PdfSpan` şekli `drawings/titleblock.ts`teki `TextSpan` ile aynıdır ve bu KOPYA
bilinçlidir: iki çekirdek birbirini içe aktarmaz ve teknik resim anteti ile
elektrik projesi ayrı şablonlardır.

**KÜNYE ÇİZİM ANTEDİNDEN DEĞİL KAPAKTAN okunur.** Sayfanın sağ alt köşesindeki
ızgarada "İŞ NO", "PAFTA NO" ve "ÖLÇEK" hücreleri iç içedir; yanlış hücreyi
okumak belgeye başkasının iş numarasını yazdırırdı. Kapaktaki künye aynı bilgiyi
açık etiketlerle taşıyor. Şekil denetimi üçüncü koruma katmanıdır: "by (short
name)" etiketinin sağındaki ilk şey çizerin adı değil DÜZENLEME TARİHİdir, ve
tarih şekilli bir değer isim olamaz — alan boş kalır, PDF üstverisindeki
`Author` devreye girer.

## ELEKTRIK-8 — Sorgu SAYFALANIR; 1000 satır sessizce kesilmez.

`loadElectricalParts` `range` ile döngü kurar. PostgREST öntanımlı olarak 1000
satır döndürür ve gerçek bir projede 726 satır var — bir sonraki proje eşiği
aşınca liste SESSİZCE kesilir ve el kitabı eksik basardı.

## ELEKTRIK-10 — Tablo YATAYDA KAYMAZ, SIĞAR; uzun hücre KESİLİR.

Kullanıcı bildirimi (19.08.2026): satırlar üç sıraya sarıyor, tablo yatay
kayıyordu. Üç kural birlikte çalışır ve biri eksikse öteki ikisi işe yaramaz:

1. **`table-fixed` + YÜZDE genişlik.** Otomatik yerleşimde tarayıcı payı
   İÇERİĞE göre veriyordu: "5SL6210-7" taşıyan Tip No sütunu tablonun yarısını
   alıyor, 40 karakterlik Tanım üç satıra sarıyordu. Paylar içeriğin GERÇEK
   ölçüsünden seçildi (187 satır ölçüldü: tanım ~40, malzeme kodu ~22, tip no
   ~18, tedarikçi ~14 karakter).
2. **Her hücre `truncate`.** Satır boyu SABİT olur; bu bir estetik tercih
   değil — 726 satırlık bir listede göz ancak eşit yükseklikteki satırları
   tarayabilir.
3. **`title` HER hücrede**, kesilmiş olsun olmasın. Kesilip kesilmediğini
   ölçmek bir reflow ister ve 726 satırda o ölçüm sayfayı kilitler; kesilmemiş
   hücrede tooltip zararsızdır.

**TELEFONDA TABLO KATLANIR** (değişmez md. 10): `md` altında satır kart olur.
Yedi sütunu 375 pikselde göstermenin yolu yok; katlama, yatay kaydırmanın tek
dürüst alternatifidir. Kartta `truncate` YOKTUR — orada satır boyu eşitliği bir
değer taşımıyor, göz zaten tek sütunda ilerliyor.

Ölçüldü (`/dev/project-preview`, gerçek fikstürle): sayfa yatay kaymıyor, tablo
kabıyla aynı genişlikte, bütün satırlar 37 px, kesilen her hücrenin `title`ı
metnin tamamı.

## ELEKTRIK-11 — Süzgeç ve sıralama TEK TANIMDIR; Excel de onu çağırır.

`lib/electrical/filter.ts` saf çekirdektir ve İKİ yerden çağrılır: ekrandaki
tablo ve indirme ucu. İki kez yazılsaydı kullanıcı bir panoyu süzüp "Excel"e
basıyor ve eline BÜTÜN projeyi taşıyan bir dosya geçiyordu — malzeme
listesinde yapılabilecek en sinsi hata budur. Bağlantı süzgeci sorguya çevirir
(`filterToQuery`), uç aynı fonksiyonlarla süzer, dosya adı `SÜZÜLMÜŞ` eki
alır ve düğme de "Excel (süzülmüş)" der.

**MALZEME SATIRI ÖNCE DERLENİR, SONRA SÜZÜLÜR.** Ters sırada bir panoya
süzüldüğünde "Panolar" sütunu tek panoya inerdi ve o ürünün başka nerede
geçtiği kaybolurdu. Aynı sebeple çok panolu bir satır pano süzgecinde ELENMEZ.

**OKUNAMAYAN ADET HER İKİ YÖNDE DE SONDA kalır.** `null` ne büyüktür ne küçük;
bilinmiyordur (değişmez md. 4). Onu `0` sayıp başa almak, listeyi adete göre
sıralayan kullanıcıya sıfır adetli bir malzeme varmış gibi gösterirdi.

**ÖNTANIM SIRA BELGEDEKİ SIRADIR** (`sort` anahtarı). Elektrikçi listeyi
projenin kendi düzeninde okur; alfabetik bir öntanım onu belgeden koparırdı.
Karşılaştırma `localeCompare(…, "tr")` iledir — öntanımlı sıra "İ"yi "Z"den
sonraya atıyor ve tedarikçi listesi alfabetik görünmüyordu.

**GÖRÜNÜM RAYINDAKİ SAYAÇ TOPLAMDIR, süzülmüş değil**; süzülmüş adet süzgeç
şeridindedir (`FilterBar`). Süzgeci değiştirmek raydaki sayıyı oynatsaydı "kaç
malzeme var" sorusu cevapsız kalırdı.

## ELEKTRIK-9 — Şartname AYRI bir belgedir (`project_specs`).

`job_contracts` İŞ EMRİNE bağlı TİCARİ bir belgedir (bedel, vade, teslim);
şartname İŞ KALEMİNE bağlı TEKNİK bir belgedir ve bir işin iki kaleminin iki
ayrı şartnamesi olabilir.

Düğme proje detayının eylem şeridindedir ("Revizyonları Karşılaştır" ve "İşlem
Kaydı"nın yanında) ve **YOKSA KIRMIZIDIR** (kullanıcı isteği, 19.08.2026):
hesap raporu şartnameye cevap verir ve şartnamesiz bir proje EKSİKTİR. Yüklüyse
düğme sakinleşir ve belgeyi AÇAR — çözülmüş bir durum kalıcı bir alarm gibi
durmamalı.

**PDF OLMAYAN ŞARTNAME REDDEDİLMEZ.** Müşteri belgeyi bazen Word gönderiyor;
"yalnız PDF" demek onu sistemin dışında bırakırdı. O dosya `page_count = 0` ile
kaydedilir, saklanır ve açılır — yalnız el kitabının teslim paketine
birleştirilemez ve bu ölçülmüş bir işarettir, bir beyan değil.

## ELEKTRIK-12 — Katalog bağı PARÇA KAYDINA değil ÜRÜN KİMLİĞİNE bağlanır.

`electrical_parts` yeni EPLAN PDF'i okunduğunda silinip yeniden kurulur; satır
UUID'sine bağlanan belge ilk yeniden okumada kopardı. Katalog ürünü bu yüzden
normalize `supplier + typeNo` anahtarıyla kalıcıdır. Malzeme tablosu aynı
ürünün `technical` ve `catalog` birincil bağlarını ayrı küçük düğmelerle açar.

Belge özel Storage kovasındadır ve tarayıcıya imzalı depo adresi verilmez;
kimlik doğrulayan `/api/electrical-catalog/[documentId]` ucu PDF'i satır içi
aktarır. Telefon kartı da masaüstü tablosuyla aynı iki eylemi taşır.

## ELEKTRIK-13 — Malzeme kategorisi TÜRETİLİR; süzgeç ve Excel aynı sınıfı kullanır.

EPLAN malzeme listesinde güvenilir bir kategori sütunu yoktur. Kategori bu
yüzden veritabanında elle yazılan serbest bir metin değildir; tanım, tip no,
tedarikçi ve malzeme kodundan `lib/electrical/category.ts` içindeki SAF ve
sıralı kuralla türetilir. Veritabanı restore edilse veya PDF yeniden okunsa da
aynı ürün aynı sınıfa döner.

**TAKSONOMİ İŞE ÖZEL DEĞİLDİR.** Kuralda iş numarası, proje adı ya da tek bir
malzeme listesinin sıra numarası bulunmaz. Sınıflar satın alma ve bakımda
birlikte ele alınan işlevsel ailelerdir; ürünün kolu, kapağı veya yardımcı
kontağı mümkünse ana ekipmanıyla aynı aileye girer. Yeni projede tanınmayan bir
ürün çıktığında mevcut işlev ailesine açık ürün işareti eklenir; gerçekten yeni
bir işlev doğmuşsa üst taksonomi genişletilir. “Ölçüm ve Enstrümantasyon” ile
“Kamera ve Görüntüleme” bu nedenle ayrı üst ailelerdir; sensör ve endüstriyel
haberleşme sınıflarına zorla sıkıştırılmaz.

**ÖZGÜL KURAL GENELDEN ÖNCE GELİR.** Sensörlü pano lambası Aydınlatma,
motor PTC'si Motorlar, 3RV ise genel devre kesiciden önce Motor Koruma olarak
tanınır. Açık işaret taşımayan ürün “Diğer” kalır; bilinmeyeni tahmin edilen
bir doğrulukla başka sınıfa gizlemek yasaktır. Kategori seçenekleri tek
`ELECTRICAL_CATEGORIES` sözlüğünden, mevcut projede gerçekten geçen sınıflarla
kurulur.

Kategori süzgeci aygıt ve toplanmış malzeme görünümünde aynı saf fonksiyondan
geçer; `kategori` sorgu parametresiyle Excel'e taşınır. Malzeme ve aygıt Excel
sayfalarının ikisi de Kategori sütununu içerir.

Kapsam denetimi gerçek iki farklı proje ailesiyle yapılır: 0019-00'da 726 aygıt
satırından türeyen 165 benzersiz malzeme ve HABAŞ 50T'de 447 kayıt içinden
türetilen 122 benzersiz malzeme “Diğer” bırakmadan sınıflanır. Bu sıfır sayısı
gelecek belgelerde tahmin yetkisi vermez; “Diğer” her zaman yeni aile/kural için
görünür kalite kontrol kuyruğudur.

## ELEKTRIK-14 — EPLAN antedi MALZEME DEĞİLDİR; ürünsüz aygıt sipariş satırı olmaz.

Parts list sayfasının son ürün satırı EPLAN antedine 1–2 satır kadar yakındır.
Yalnız mesafeye bakılırsa `DATE NAME DRAW`, `SIGN`, `SHEET FORM` metinleri son
ürünün tanım/tip/kod alanına eklenir; `REVISION` da cihaz etiketi sanılır.
Okuyucu bu belirgin antet dizilerini satır devamı olmadan önce eler ve
`REVISION` etiketini ürün saymaz. Restore edilmiş eski kayıtlardaki antet
ekleri de okuma sınırında temizlenir; kullanıcının projeyi yeniden okutması
gerekmez.

Temizleme yalnız İngilizce antedi varsaymaz: Türkçe EPLAN çıktısındaki `TARİH
İSİM ÇİZEN`, `İMZA` ve `KAĞIT FORMU` dizileri de aynı sınırda temizlenir.
0019-00 restore verisinde bu işlem, antet bulaşmış satırların ayrı ürün anahtarı
oluşturmasını engelleyerek görünen benzersiz malzeme sayısını 175'ten gerçek
165'e indirmiştir.

EPLAN'da işlevi çizilmiş fakat ürün atanmamış aygıt olabilir: adet 0, tanım,
tip, tedarikçi ve malzeme kodu boştur. Bu kayıt Aygıt görünümünde korunur ama
“sipariş edilebilir” Malzeme görünümüne boş satır olarak girmez. HABAŞ 50T
fikstüründe bu iki kural 140 görünen kaydı 122 gerçek benzersiz malzemeye
indirmiştir; sayı kaynak PDF üzerinde ölçülmüştür.

## ELEKTRIK-15 — Kablo kimliği ürün AİLESİNDEN değil üretici MAKALE NUMARASINDAN gelir.

0019-00'ın kablo satırlarında tedarikçi alanı boş, tip no ise `JZ-600 / OZ-600`
gibi birden çok kesit ve varyantı kapsayan aile adıdır. Bu alanlarla kurulan
normal `supplier + typeNo` anahtarı 4G2,5 ile 4G16 kabloyu aynı ürün sanır.
`HELU.<makale no>` biçimindeki proje malzeme kodu burada güvenilir üretici
kimliğidir: katalog ürünü `HELUKABEL + <makale no>` anahtarıyla kaydedilir ve
yeniden okumalarda aynı bağı bulur. Başka üreticilerin normal kimlik kuralı
değişmez.

Kablo üst sınıfı `Kablolar`dır. HELUKABEL/IGUS malzeme kodları ile açık kontrol,
enerji zinciri, servo, enkoder ve bağlantı kablosu işaretleri bu sınıfa girer;
fiş, priz ve klemensler ayrı bağlantı ailesinde kalır. Bu ayrım yeni EPLAN
projelerinde de aynı saf sınıflandırıcıdan türetilir.

## ELEKTRIK-16 — Ekipman listesi TEKTİR; mekanik ve elektrik iki bölümüdür.

Hesap revizyonunun seçimlerinden gelen mekanik satırlar ile güncel elektrik
projesinin `materialRows` çıktısı aynı ekipman tablosunda birleşir. Sıra
**Mekanik Ekipmanlar → Elektrik Ekipmanları**dır; elektrik grupları
`ELECTRICAL_CATEGORIES` taksonomisinden gelir. Kullanıcı ekranda ve indirmede
Mekanik, Elektrik veya Tüm listeyi seçebilir; PDF ve Excel aynı bölüm
süzgecinden geçer.

**BOŞ BÖLÜM BASILMAZ.** Güncel elektrik projesi yoksa ya da okunmuş malzeme
satırı üretmemişse elektrik başlığı, boş tablo, sayaç ve dosya adı oluşmaz;
mevcut projeler yalnız Mekanik Ekipman Listesi olarak çalışmayı sürdürür. Tüm
liste istendiğinde tek bölüm kalmışsa belge kendine “Tüm” demez.

Elektrik satırındaki okunamayan adet ekranda/PDF'de `—`, Excel'de boş hücredir
(`ELEKTRIK-4`). Satır notu ve ek belgesi `electrical_parts.id`ye bağlanmaz:
yeniden okumada satırlar üretildiği için normalize ürün anahtarının kararlı,
action sözleşmesine uygun hash'i kullanılır. Teknik föy ekipman adına, ayrı tam
katalog varsa model hücresine bağlanır. Standart PDF'de bunlar dış bağlantıdır;
detaylı PDF'de doğrulanmış `technical` belge en çok 6 sayfalık EK-F olarak
belgenin içine alınır ve ekipman adı doğrudan o ekin ilk sayfasına gider.
Teknik eki olmayan satırın mevcut dış bağlantısı korunur; tam katalog uydurma
bir teknik föye dönüştürülmez.
