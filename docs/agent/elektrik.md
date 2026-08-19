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
