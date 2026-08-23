# Personel

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/personel.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/personnel/**` · `src/lib/fx/**` · `src/app/(app)/personnel/**` · `src/app/api/cron/fx/**` · `scripts/test-payroll-docs.ts` · `scripts/test-fx-source.ts`

## PERSONEL-22 — PERSONEL: KİŞİ BİR SATIR DEĞİL, DÖNEMLERİ OLAN BİR KAYITTIR

(`/personnel`, kullanıcı kararı 12.08.2026). Bölüm Yönetici + Müdür'e
açıktır (`can_see_personnel()` / `canSeePersonnel`) ve altı ekrandır:
Personel · Maaş · Özet · Harcirah · Kurlar · **Ücret Planı**. İlk beşinin
sırası İŞ AKIŞIDIR; **Ücret Planı en sağdadır ve bu SIKLIK sıralamasıdır**
(kullanıcı kararı, 13.08.2026: *"bu sayfa çok az kullanılacak"*). Bir gün
önce Maaş'tan ÖNCE konmuştu çünkü maaş satırı net ücreti ondan okur; bağ
hâlâ doğru ama ray, günlük işi en yakın tutmalıdır — ücret planı yılda bir
açılır, Maaş her ay. Kaynak devralınan "ORİON - Personel ve Maaş Listesi"
Excel'idir (46 kişi · 27 ay · 566 maaş satırı).

**BÖLÜMÜN ADI ÖNCE "FİNANS"TI ve aynı gün değişti.** Kullanıcının
gerekçesi: *"Finans'ta farklı şeyler yaparız; bu bölüm tamamen personelle
ilgili oldu."* Değişiklik ekranla sınırlı KALMADI — `/finance` adresi ve
`fin_` tablo öneki ileride açılacak gerçek finans bölümüne ayrıldı
(`hr_*`), çünkü o gün geldiğinde `fin_payroll` ile `fin_cari` yan yana
durur ve hangisinin hangi bölüme ait olduğu okunmazdı. **Kur tabloları
ikisine de ait değildir** (`fx_rate_daily` / `fx_rate_monthly`): kur kamuya
açık REFERANS veridir, bir bölümün malı değil.

**Giriş/çıkış tarihi künyede DEĞİL `hr_employment`tadır.** Devralınan
veride bir kişi aynı TC ile İKİ KEZ çalışmış (FURKAN AYTEKİN: 2025-01→04 ve
2026-03→06). Tarihler künyede olsaydı ya kişi ikizlenir ve kıdem bölünürdü
ya da ilk dönem kaybolurdu. Kıdem BÜTÜN dönemlerin toplamıdır; aynı anda
en fazla bir dönem AÇIK olabilir (kısmi tekil indeks). İşten ayrılan kişi
SİLİNMEZ, dönemi KAPANIR — ve ayrılanlar AYRI BİR EKRANDA DEĞİL aynı
listede, "Ayrıldı" rozetiyle durur (Mühendislik'teki arşiv kuralı).
**Maaş kaydı olan personel silinemez**: silme `cascade` ile ödenmiş ayların
kaydını da götürürdü.

**FAZLA MESAİ TÜRETİLİR, GİRİLMEZ.** 4857 md. 41:

    tutar = net / 225 × (saat%50 × 1,5 + saat%100 × 2)

225 aylık normal çalışma saatidir (30 × 7,5) ve TEK yerdedir
(`AYLIK_CALISMA_SAATI`). Bağıntı devralınan 566 satırın TAMAMINDA sıfır
sapmayla doğrulandı, bu yüzden `hr_payroll.overtime_amount`
`generated always as … stored` olabildi. Aynı bağıntı bir kez
TypeScript'te (`fazlaMesaiTutari` — kullanıcı kaydetmeden önce görsün) bir
kez Postgres'te yazılıdır; ikisinin ayrışmasını
`lib/personnel/__tests__/payroll.test.ts` engeller.

**AYIN KURU SATIRIN KENDİNDEDİR** (`hr_periods.eur_try_rate`), merkezî kur
tablosundan OKUNMAZ — md. 16'nın (`job_item_sales.fx_rate`) birebir aynı
gerekçesi: tablo tazelendiğinde geçmiş ayların avro karşılığı da değişirdi.

**AMA KULLANICIYA SORULMAZ** (kullanıcı kararı, 12.08.2026): *"Kur
mevzusunu otomatikleştirmeliyiz, kullanıcıdan almak istemiyorum."* Ay
kapandığında `ensurePeriodRates` o ayın **son YAYIN gününün** TCMB kurunu
yazar ve orada donar. "Son gün" takvimin 31'i DEĞİLDİR: ay hafta sonu ya
da resmî tatille bitiyorsa o günün kuru yoktur ve bir öncekine düşülür.
Eylem Maaş ekranı açıldığında bir kez çalışır, İDEMPOTENTtir ve
**YAZILMIŞ KURU EZMEZ** (`is("eur_try_rate", null)` süzgeci) — devralınan
27 ayın Excel'den gelen kuru bu yüzden yerinde kalır. İÇİNDE BULUNULAN AY
ATLANIR: ay bitmeden "ay sonu kuru" diye bir şey yoktur. Aylık ortalama
artık yalnız KARŞILAŞTIRMA için gösterilir.

Devralınan 27 ayın kuru da **ortalama değildi** (ay sonu spot kuru; 2025
Mart'ta fark %7,8) — olduğu gibi korundu.

**İZİN VE RAPOR SAATİ ARTIK KİŞİ BAZINDADIR** (`hr_payroll.leave_hours` /
`report_hours`, kullanıcı kararı 13.08.2026: *"personel birkaç gün
gelmediyse bunu sisteme girmek isterim; dönem ayarlarında değil kişi
bazında gireyim"*). Bir süre ay düzeyindeydi (`hr_periods`) çünkü firma da
öyle tutuyordu; bu, o kararın söylediği "ayrı faz"dır.

**DÖNEM SÜTUNLARI DÜŞÜRÜLMEDİ** ve bu, `drawn`/`profiles.tags`
düşürülmelerinin İSTİSNASIDIR: orada iki kaynak da AYNI soruyu
cevaplıyordu ve biri boştu; burada eski sütunda GERÇEK VERİ var —
devralınan 27 ayın izin/rapor saatleri Excel'den ay düzeyinde geldi ve
kişilere DAĞITILAMAZ (md. 21'in "uydurma veri girmeyeceğiz" kuralı).
Ayrışma riski TEK BİR KURALLA kapanır ve kural saf çekirdektedir
(`payroll.ts → donemIzinRapor`): bir ayda kişi satırlarında saat VARSA
yalnız onlar sayılır, HİÇ YOKSA devralınan ay değeri okunur ve
`devralinan: true` ile künyelenir. **İKİ KAYNAK ASLA TOPLANMAZ** — toplama
net çalışma saatini iki kat düşürür ve saatlik maliyeti (teklif
fiyatlandırmasının girdisi) sessizce şişirirdi. Ekran, Excel ve özet aynı
fonksiyonu çağırır; koruma `__tests__/payroll.test.ts`tedir.

**ÜCRET PLANI KARARDIR, MAAŞ SATIRI OLGUDUR** (`hr_salary_plan`,
`/personnel/ucret` — kullanıcı kararı 13.08.2026: *"biz yıl başında zam
yapıyoruz; kişinin net maaşının 50 bin TL olduğu belirleniyor, sonra kişi
yıl boyunca o maaşı alıyor"*). Bir satır "şu tarihten itibaren bu kişinin
net ücreti şudur" der ve BİTİŞ TAŞIMAZ — bir sonraki satır bitirir; iki
uçlu aralık "boşluk mu var, çakışma mı var" diye cevaplanamaz bir soru
doğururdu. Ayrı tablo olmasının üç gerekçesi: karar İLERİ tarihli olabilir
(aralıkta 2027 zammı girilir, ocak maaşı henüz yoktur), ay ortasında işe
girenin maaş satırı eksik gündür ama ücreti tamdır, ve zammın TABANI ile
ORANI iki maaş satırının farkından geri hesaplanamaz (araya prim, eksik gün
ve düzeltmeler girer).

Zam tabanı **bir önceki yılın ARALIK ayında geçerli ücrettir**, yılın
ortalaması ya da ocak ücreti değil: eylülde ara ayarlama almış kişide fark
gerçek paradır. Taban üç kaynaktan bu sırayla okunur ve üçü de gerçek bir
kayıttır — önceki yılın kararı → hedef yıldan önce ödenmiş son maaş → bu
yılın kararının kendi kayıtlı `previous_net`i. **ORAN EKRANDA YÜZDE (15),
VERİTABANINDA KESİRDİR (0,15)**; dönüşüm yalnız iki yerdedir
(`loadSalaryPlan` okurken, `oranKesre` yazarken) ve çekirdeğin tamamı yüzde
konuşur — kayması sessizdir, çünkü sonuç hâlâ makul görünür.
Yuvarlama **500 ya da 1000 ₺**'dir (kullanıcı kararı 13.08.2026; önce beş
seçenek ve 100 varsayılanı vardı, sayı devralınan 566 satırın yüzlüğe
yuvarlı olmasından okunmuştu — kullanıcı ölçeği kendi kararıyla büyüttü).
"Yuvarlama yok" seçeneği de kalktı: ham çarpım (53.675) bir ücret kararı
değil bir ara sonuçtur. Defter migration'da UYDURULMADI, ödenmiş maaş
satırlarından türetildi — net maaşın DEĞİŞTİĞİ her ay bir karar satırıdır.

**EKRAN "ZAM UYGULANMAMIŞ" AÇILIR** (kullanıcı kararı, 13.08.2026): kararı
verilmemiş satırda oran %0, yeni ücret TABANIN KENDİSİDİR. Boş kutu aynı
şeyi söylemiyordu — toplam kartı belirlenmemiş kişiyi saymak zorunda
kalıyor, "0 mı yoksa henüz mü?" ekranda cevapsız duruyordu. Kaydedilmiş bir
karar EZİLMEZ (155.000 tabanının yanında 180.000 yazıp "%0" demek ekranın
kendisiyle çelişmesi olurdu). Kaydet düğmesi **DOKUNULMUŞLUĞA** bakar
(`taslaklar[id] !== undefined`), değere değil: yoksa varsayılanlar yüzünden
ekran açılır açılmaz "Kaydet (40)" yanardı.

**YIL İÇİ AYARLAMANIN AYRI BİR TABLO BÖLÜMÜ YOKTUR** (kullanıcı kararı,
13.08.2026): yılda bir iki kez olan bir kayıt için kendi başlığı ve sütun
düzeni olan bir bölüm çok yer kaplıyordu. Kayıt kişinin KENDİ SATIRINDA bir
çip olarak durur ve silme oradadır — görünmez olsaydı yanlış girilmiş bir
ayarlamayı geri almanın yolu kalmazdı.

**DEFTER 2024'TEN GERİYE GİTMEZ** (`EN_ESKI_PLAN_YILI`): devralınan maaş
kaydı Mayıs 2024'te başlar, öncesinde ne karar ne taban vardır ve boş bir
yıl, olmayan bir yıldan çok daha kafa karıştırıcıdır. Kelepçe İKİ YERDEdir
— düğme (pasif) ve sunucu (`Math.max`): ok kapalıyken bile `?yil=2019` elle
yazılabilir.

**ÜCRET VE ZAM ORANI BÜYÜKLÜĞÜNE GÖRE RENKLENİR** (kullanıcı isteği,
13.08.2026: *"az kırmızı fazla yeşil"*). Renk yine HEX DEĞİL AÇIDIR
(`olcekTonu` → 25° kızıl … 145° yeşil); doygunluk ve parlaklık
`globals.css` `.oc-scale` kuralında ve tema başına verilir. **İki ölçeğin
dayanağı AYRIDIR ve bu kasıtlıdır:** ücret ölçeği LİSTEYE GÖRELİdir (aynı
listede 33.000 ₺ yemekhane ile 205.000 ₺ genel müdür yan yana; sabit bir
eşik hepsini tek renge boyardı), zam ölçeği MUTLAKtır (%0–%25) — göreli
olsaydı herkese %15 verilen bir yılda en düşük satır kırmızı görünür ve
"buna az verdim" diye yanlış bir şey söylerdi.

Maaş ekranı yeni satır açarken net ücreti buradan okur ve **plandan sapmayı
bir UYARI olarak** gösterir, bir engel olarak değil: eksik gün, ücretsiz
izin ve ay ortası giriş meşru sapmalardır ve uygulama hangisi olduğunu
bilemez.

**EKRAN KENDİNİ YILDAN YILA GÜNCELLER** — hiçbir yıl sabit yazılmaz. Taban
her zaman "seçili yıldan bir önceki yılın ARALIK ayında geçerli ücret"tir
ve sütun başlıkları `yil`den türer; 2027'de "2026 Sonu / 2027 Net" olur.
Yıl içi ayarlama bir SONRAKİ yılın tabanına doğal olarak devrolur (temmuzda
95.000'e çıkan kişinin ertesi yıl tabanı 95.000'dir, ocak kararı 85.000
değil). `/dev/personnel-preview` bu durumu AYRI BİR FİKSTÜRLE gösterir
("Taze Yıl 2027"): kuralın kendisi ancak kararı olmayan bir yılda görünür.

**EXCEL'İN KENDİ İKİ SAYFASI ÇELİŞİYORDU** ve çözüm üçüncü bir sayı değil,
BOŞLUĞU GÖSTERMEKTİR. "Maaş Özet Tablo"daki kişi sayısı elle yapıştırılmış
bir değerdi ve "Aylık Çalışma Saatleri" ile yedi ayda uyuşmuyordu; sebebi
maaş satırı GİRİLMEMİŞ çalışanlardı. Uygulama sayıyı maaş satırlarından
üretir (tek kaynak) ve o ay çalışıyor görünüp maaşı olmayan kişiyi Maaş
ekranında AYRICA sayar.

**ÖZLÜK DOSYASI KATALOG YAPRAĞI DEĞİLDİR.** `personnel` bucket'ının
politikası `drawings` düzeyindedir — okuma dahil dördü de
`can_see_personnel()`ten geçer, `equipment-attachments` gibi "authenticated
okur" DEĞİL. Gerekçe: `createSignedUrl` bir kez üretildikten sonra 120
saniye oturumsuz açılabilir ve uygulama katmanındaki rolü taşımaz; bir
sağlık raporunda bu fark gerçek bir sızıntıdır. Aynı sebeple imzalı
bağlantı İSTEMCİDE değil SUNUCUDA üretilir (`signDocumentUrl`) ve denetim
izine yazılır. Baytlar yine server action'dan GEÇMEZ (md. 19 kuralı),
sayfa sayısı yine ÖLÇÜLÜR. **Süreli belgeler** (İSG eğitimi 6331 md. 17,
periyodik muayene md. 15, operatör/kaynakçı belgesi) `expires_on` taşır ve
süresi dolan belge ENGELLEYİCİ DEĞİL bir HATIRLATMAdır.

**BORDRO GERÇEK BİR ÜCRET HESAP PUSULASIDIR** (4857 md. 37) ve dört
bloktur: işveren+çalışan künyesi → KAZANÇLAR (brüt, gün/saat × birim) →
YASAL KESİNTİLER (matrah × oran) → NET ÖDENEN + kümülatif matrah.
**ORAN VE MATRAH SATIRDA GÖRÜNÜR**: "gelir vergisi 25.850,82 ₺" tek başına
doğrulanamaz bir sayıdır ve pusulanın varlık sebebi denetlenebilirliktir.

**FİRMA NETTEN ANLAŞIYOR, BORDRO BRÜTTEN BAŞLAR.** Brüt `bordro.ts` ile
TÜRETİLİR (brütleştirme) ve bu düz bir çarpma değildir — gelir vergisi
kümülatif matraha, matrah brüte, brüt de nete bağlıdır. Kapalı çözüm
yoktur; `brutBul` İKİLİ ARAMA ile çözer (net brüte göre kesin artandır,
yani daima yakınsar; Newton dilim sınırında güvenilmez). Kalemlerin brüt
karşılığı net paylarıyla ORANTILI dağıtılır ve yuvarlama artığı İLK kaleme
yazılır — üç satırı ayrı yuvarlayıp toplamak bir kuruş sapma bırakır ve
pusulayı elde kontrol eden kişi onu hata sanar.

**YASAL PARAMETRELER KODA GÖMÜLMEZ, VERİDİR** (`hr_payroll_params`,
yıl yıl). Asgari ücret, SGK tavanı, dilimler ve istisnalar her yıl değişir;
koda yazılsaydı her ocakta bir dağıtım gerekir ve eski bir bordroyu
yeniden basmak onu YENİ oranlarla basardı. **Parametresi olmayan dönemde
hesap YAPILMAZ**: çekirdek `null` döner, belge kesinti bloğunu hiç çizmez
ve nedenini yazar — uydurulmuş bir oran pusulayı olduğundan resmî
gösterirdi.

2026 satırının doğruluğu ÇAPRAZ SINANMIŞTIR: brüt asgari ücret (33.030)
girildiğinde çıkan net, ilan edilen net asgari ücretin (28.075,50) TA
KENDİSİDİR. Bu tek sınama SGK oranını, işsizlik oranını, vergi dilimini ve
iki istisnayı AYNI ANDA doğrular (`__tests__/bordro.test.ts`).

**BORDRODA AVRO YOKTUR** (kullanıcı kararı, 12.08.2026): yasal belgenin
tek para birimi Türk lirasıdır. Avro karşılığı yönetim raporlamasının
işidir ve Özet ekranında durur.

**DÖNEM SİLİNEBİLİR** ama kapalı dönem önce AÇILIR: bir ayı baştan girmenin
yolu satır satır silmek olmamalı, kapatma işareti de kazara silmeye karşı
ilk kapı olmalı. **BORDROLARI İNDİR** dönemin bütün pusulalarını tek PDF'te
verir, kişi başına bir sayfa (pusula kişiye imzalatılır).

**PRİM · HARCİRAH · AVANS · KESİNTİ MAAŞ EKRANINDA GİRİLİR** (kullanıcı
kararı, 12.08.2026). Önce yalnız kişinin profilindeydiler; ay kapatılırken
kırk kişinin sayfasını tek tek dolaşmak gerçek bir iş akışı değildi.
Harcirah ve avans bordro MATRAHINA GİRMEZ: harcirah masraf karşılığıdır
(GVK md. 24), avans zaten ödenmiş ücretin mahsubudur.

**EKRANDAKİ TUTARLARDA ONDALIK YOKTUR** (`fmtTutar`; kullanıcı kararı
12.08.2026'da özet tablosu için, 13.08.2026'da bütün bölüme genişletildi:
*"sayfalarda tutarlarda virgülden sonraki kısımlar görünmesin"*). Bir maaş
listesinde aranan "kim ne kadar aldı"dır; ",00" her sütunu üç karakter
genişletiyor ve on iki sütunlu bir tabloyu ekranın dışına itiyordu.
**KURUŞ GEREKEN YER BORDRODUR** ve orada tam basılır — pusula 4857 md.
37'ye göre denetlenebilir olmalıdır. İki İSTİSNA vardır ve ikisi de
tutar değildir: **KUR** (54,8231 ile 54,4900 aynı sayı gibi görünürdü) ve
**SAATLİK MALİYET** (12–15 € bandında kuruş gerçek bir farktır — "14 €"
ile "14,80 €" arasında teklif fiyatında %6 var).

**ÖZET KARTLARININ İÇ NOTLARINDA HER SÖZCÜĞÜN BAŞ HARFİ BÜYÜKTÜR**
(kullanıcı kararı, 13.08.2026). Metinler ELLE öyle yazılır, `baslikDuzeni`
gibi bir dönüştürücüden GEÇİRİLMEZ: notların içinde sayı, simge ve kısaltma
var ("1 € = 54,8231 ₺", "%50: 12 · %100: 8", "Kişi Başı Ort.") ve genel bir
başlık düzeni onları da "düzeltmeye" kalkardı.

**ÖZET TABLOSU YATAYDA SIĞAR** (kullanıcı kararı, 13.08.2026) ve başlık
hizası YAPISAL olarak korunur: sütun tanımı TEKTİR (`SUTUNLAR`), başlık ·
hücre · toplam üçü de aynı `cls`/hizalamayı ondan okur. Eskiden hizalama ve
kırılım sınıfı otuz dokuz yerde elle yazılıyordu; biri şaşınca sütun
kayıyor, dar ekranda başlık ile hücre farklı kırılımda düşüp tablo
tamamen kayıyordu. **TOPLAM SATIRI** tablodaki AYNI satırlardan çıkar, yani
yıl süzgeciyle kendiliğinden değişir; kişi sayısı TOPLANMAZ, ORTALANIR
(aynı kişi her ay yeniden sayılırdı) ve avro AY AY, her ayın kendi kuruyla
çevrilip toplanır. **VARSAYILAN YIL İÇİNDE BULUNULAN YILDIR**; "Tümü" artık
açık bir seçimdir (`yil=tumu`), çünkü boş adres varsayılanı seçemezdi.

**ÖZET GRAFİKLERİ ÇİZGİDİR, ÇUBUK DEĞİL** (`TimeLineChart`, kullanıcı
kararı 13.08.2026). Ayrı bir bileşendir: çubuk YIĞILIR (dilimler üst üste,
toplam görünür), çizgi YIĞILMAZ — her seri kendi eğrisidir. SVG orada
meşrudur ama yalnız EĞRİ için (`preserveAspectRatio="none"` +
`vectorEffect="non-scaling-stroke"`); grafiğin içinde HİÇ YAZI YOKTUR,
eksen etiketleri HTML'dedir — dosya başlığındaki "SVG'de yazı ölçeklenir"
kuralı böylece çiğnenmez. Nokta işaretleri de HTML'dedir (gerilmiş tuvalde
daire elips olurdu) ve kap 3px yatay dolgu taşır: uçtaki yarım nokta
`scrollWidth`i büyütüp kaydırma gölgesini yalancı yakıyordu.

**SAATLİK MALİYET (€)** kartı ve sütunu
teklif fiyatlandırmasının girdisidir; payda NET ÇALIŞMA SAATİDİR
(normal + mesai − izin − rapor), "kişi × 225" değil — ödenen para izinli
geçen saate de dağılır ve 225'e bölmek maliyeti olduğundan DÜŞÜK
gösterirdi.

**KURLAR: kaynak TCMB, ölçüm gün gün.** Ayrıntı `docs/personel-kur-kaynagi.md`
(kaynak seçiminin gerekçesi, ECB yedeği, cron kurulumu). Üç kural burada
da tekrarlanır çünkü sessizce yanlış yazılabilirler:
`avg(EUR/USD) ≠ avg(EUR/TRY)/avg(USD/TRY)` (parite gün gün ortalanır) ·
yayın yapılmayan günün kuru YOKTUR, sıfır değildir · ortalamanın kaç
günden çıktığı (`day_count`) bir künyedir, gizlenmez.

## Mobil düzen — 23.08.2026

Altı personel ekranı telefonda tek bölüm seçicisinden açılır. Personel listesi,
çalışma dönemleri, maaş geçmişi, belgeler, harcırah, kur ve özet çizelgeleri
mobil kartlara katlanır. Ücret Planı ile Aylık Maaş'ta masaüstünde kırılıma
göre gizlenen bütün doğrudan giriş alanları telefonda `data-mobile-show` ile
geri açılır: SGK günü, net ücret, iki mesai saati, izin, rapor, prim, harcırah,
avans ve kesinti aynı kişi kartından düzenlenir. Yatay tablo kaydırması yoktur;
yalnız gerçek zaman serisi grafikleri kendi veri yoğunluğu sınırını korur.
