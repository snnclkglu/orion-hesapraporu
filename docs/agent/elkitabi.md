# İşletme ve Bakım El Kitabı

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/elkitabi.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/manual/**` · `src/lib/pdf/manual.tsx` · `src/app/(app)/projects/[id]/manual/**` · `scripts/test-manual-pdf.ts`

## KITAP-1 — Belgenin adı **İŞLETME VE BAKIM EL KİTABI**dır.

Kullanıcı kararı (19.08.2026): müşteri "Kullanma ve Bakım Kılavuzu" değil bu adı
istiyor. Ad TEK YERDEDİR (`lib/manual/naming.ts` — `MANUAL_DOC_TITLE`,
`MANUAL_LABEL`) ki kapak, sekme, PDF künyesi ve dosya adı ayrışamasın;
`lib/app.ts`teki `APP_NAME` kuralının aynısı. Belge kodu `ORC-BK-<kalem>-R<nn>`
(`manualDocCode`) — `docCode`un imzası BOZULMADI, iş emri ve bordro gibi kendi
üreticisini taşır.

## KITAP-2 — Model TEKLİFİN İKİZİDİR: revizyon = snapshot.

`manual_revisions.payload` belgenin TAMAMIDIR: bölüm ağacı, bloklar, standart
metnin düzenlenmiş hâli, gizleme kararları, künye ve yayımda donmuş otomatik
tablolar. İlişkisel bölüm/blok tabloları seçilseydi her yeni revizyon yüzlerce
satır kopyalamak zorunda kalırdı (kaynak Word belgesinde bakım çizelgesi tek
başına 235 satır) ve yayımlanmış bir belgenin değişmezliği tek tetikleyiciyle
korunamazdı.

`guard_issued_manual_revision`, `guard_issued_revision` ve
`guard_issued_offer_revision`in ÜÇÜNCÜ ikizidir: **yayımlanmış revizyon
değiştirilemez ve silinemez.** Teslim edilmiş bir kılavuz vincin yanında
asılıdır; sonradan düzeltilirse operatör başka bir belgeye bakar.

Eski kayıtlar `withManualDefaults` ile bugüne taşınır: tanınmayan düğüm DÜŞER,
belge düşmez. Bir alanın bozulması yüzünden teslim edilmiş bir kılavuzun hiç
açılmaması en kötü sonuçtur.

`manuals` üst kaydı, son taslak revizyon kalıcı olarak silindiğinde yerinde
kalabilir. Bu geçerli boş durumda **Yeni Revizyon** hata vermez: güncel
şablondan, proje künyesi ve üst kaydın kapak başlığıyla yeniden `V1` açar. En
az bir revizyon varsa değişmez kural sürer ve son snapshot kopyalanır. Eylem,
`manualId` değerinin URL'deki projeye ait olduğunu yeni kayıt yazmadan önce
doğrular.

## KITAP-3 — El kitabı PROJEYE bağlıdır, işe değil.

Bir iş emrinde birden çok vinç olabilir (`job_items`) ve her vincin kendi
kılavuzu vardır; **proje = iş kalemi = bir vinç**. Hesap raporu, elektrik
projesi, şartname ve teknik resim defteri de aynı çapaya bağlıdır, yani el
kitabı beslendiği her kaynağa tek bir kimlikten ulaşır. `manuals_project_uidx`:
bir projede BİR el kitabı — ikinci bir kılavuz "hangisi teslim edildi" sorusunu
doğururdu, sürüm ayrımı REVİZYONUN işidir.

Ekran proje detayının **dördüncü sekmesidir** (Hesap Raporu · Elektrik Projesi ·
Teknik Resim Takibi · İşletme ve Bakım El Kitabı); editör hesap raporu
editörünün yanında kendi adresindedir (`/projects/[id]/manual/[revId]`).

**KAPAK BAŞLIĞI SNAPSHOT'TAN YA DA İŞ EMRİNDEN GELMEZ.** Hesap raporuyla aynı
güncel `projects.name` alanı kullanılır. Eski projelerde saklanan
`payload.coverTitle` yalnız geriye dönük yedektir; güncel proje adı varsa PDF
ve kâğıt önizlemesi onu basar. Editörde alan salt okunur gösterilir ki kullanıcı
teslim PDF'ini etkilemeyen eski bir başlığı düzenlediğini sanmasın.

## KITAP-4 — Standart metin bir ÖNTANIMDIR, bir kilit değil.

Kullanıcı isteği (19.08.2026): *"bazı başlıkların standart yazı olduğu ama
değişebildiği"*. Şablondan gelen her blok `fromTemplate` ile doğar; kullanıcı
dokununca `edited` açılır ve şablon onu BİR DAHA EZMEZ. Mühendislik motorundaki
`*Auto` anahtarının ve teklifteki `manual` bayrağının aynısıdır: makine önerir,
insan son sözü söyler. "Standarda Dön" düğmesi bloğu şablondaki karşılığına
geri alır (sıra + tür eşleşmesiyle; ikisi tutmuyorsa hiçbir şey yapmaz).

**ŞABLON SÜRÜMÜ ARTTIĞINDA VAR OLAN BELGELER DEĞİŞMEZ.** Belge kullanıcınındır;
bir güncelleme onun sildiği bölümü geri getiremez.

## KITAP-5 — ŞABLONA VİNCE ÖZEL HİÇBİR SAYI GİRMEZ.

Kaynak, firmanın kendi teslim ettiği 185/40 Ton Şarj Vinci kılavuzudur
(Karçel A.Ş., 028.00-KBK01) — DÖRT ana bölüm ve 47 alt başlık; uzun süre
"14 ana bölüm" diye yazılmıştı, oysa 14 dördüncü bölümün alt bölüm sayısıdır
(4.1…4.14). Şablon o belgenin **iskeleti ve projeden bağımsız metinleridir**
ve kendi bölümlendirmesi kaynağın aynısı değildir.

"185T", "8 adet acil stop butonu", "Mevcut Şifre : 028", "192.168.221.23" —
bunların hepsi O VİNCİN gerçeğidir ve başka bir vinçte yanlıştır. Bir şablonun
içine kaçmış tek bir sayı, otuz kılavuz sonra kimsenin fark etmeyeceği bir yalan
olur. O bölümler **başlık + BOŞ blok** olarak doğar (`bosluk()`), mühendis
doldurur, doldurulmamış blok belgeye BASILMAZ. Koruma testtedir
(`__tests__/payload.test.ts`, "ŞABLONDA VİNCE ÖZEL SAYI YOKTUR").

Aynı sebeple `yedek.kece` (yağ keçesi listesi) BOŞ bir tablodur: hesap
motorunda keçe bir seçim alanı değil ve uydurma bir liste ÜRETİLMEZ.

## KITAP-6 — Gizleme belgede İZ BIRAKMAZ ve SÜZGEÇ TEKTİR.

`printedManual` (`lib/manual/payload.ts`) tek süzgeçtir; ekran özeti, sekme
sayacı ve PDF onu birlikte çağırır. İki yerde yazılsaydı gizlenen bölüm ekrandan
düşer ama belgeye girmeye devam ederdi — bu bölümde olabilecek en pahalı hata
budur (TEKLIF-4'ün dersi).

Bir bölüm şu üç durumda düşer: kendisi gizliyse; ya da basılacak bloğu VE
basılacak çocuğu kalmadıysa VE bir EK bölümü değilse. Boş bir paragraf, satırsız
bir tablo ve kaydı bulunamayan bir görsel bloğu da basılmaz. Editörde gizlenen
öğe SOLGUN ama düzenlenebilir kalır: **gizlemek silmek değildir.**

**NUMARA SÜZGEÇTEN SONRA VERİLİR.** Gizlenen 3. bölümün ardından 4. bölüm
belgede 3 olur; aksi hâlde içindekiler "1, 2, 4" diye gider ve okuyan eksik bir
bölüm arardı. **Ekler AYRI ZİNCİRDİR** (`EK-A` · `EK-B` …): bir ek bölüm değil,
belgenin arkasına bağlanan başka bir belgedir.

## KITAP-7 — Otomatik tablo: taslakta CANLI, yayımda DONMUŞ.

`kind: "auto"` blokları hesap raporundan, elektrik projesinden ve Teknik Resim
Takibi'nden ÜRETİLİR (`lib/manual/sources.ts` — saf çözücü;
`manual/sources-data.ts` — sunucu adaptörü). El kitabının var olma sebebi budur:
sınıflandırma tablosu, ekipman listesi ve malzeme listesi zaten yazılıdır.

Taslakta her açılışta kaynaktan yeniden üretilir; **yayımda** çözülmüş tablo
`frozen`a yazılır (`issueManualRevision`; sıra önemlidir — önce dondur, sonra
`issued`, aksi hâlde tetikleyici ikinci yazmayı reddederdi). Aksi hâlde teslim
edilmiş bir kılavuz, kaynağı sonradan revize edilince sessizce başka bir şey
söylerdi. Yeni revizyon açılırken `frozen` ÇÖZÜLÜR — yeni sürüm bir taslaktır.

Biçimleyici hesap raporununkidir (`fieldShownValue` · `fieldLabel` ·
`toDisplayUnitLabel`): ikinci bir biçimleyici yazılsaydı raporda "Ø400 mm" olan
değer el kitabında "400" olurdu. Rulman ve halat listeleri ayrı bir kaynaktan
değil **ekipman listesinden süzülür** (ada göre) — ikinci bir liste tutmak
ikisinin ayrışması demekti.

## KITAP-8 — İki çıktı: GÖVDE ve TAM SÜRÜM.

Kullanıcı kararı (19.08.2026). Gövde ekranda okunan, onaya giden, hızlı üretilen
belgedir. Tam sürüm teslim paketidir ve 12 MB'lık elektrik projesiyle birlikte
yüz megabaytı bulabilir; her önizlemede o desteyi yeniden üretmek sunucunun süre
ve bellek tavanını zorlardı.

**EK KAPAKLARI SÖZLEŞMEDİR.** `pdfEkleriYerlestir` temel belgenin SON n
sayfasının, eklerle AYNI SIRADAKİ n kapak olmasını ister. Bu yüzden ek
kapsayıcısı kendi yaprağında, **her ek kapağı ayrı yaprakta** basılır. Sıra
`manualAppendixOrder(payload)` ile TEK yerden gelir; PDF de indirme ucu da onu
okur. İki yerde yazılsaydı bir ek yanlış kapağın altına düşer ve bunu ancak
belgeyi açan müşteri görürdü. Sözleşme `scripts/test-manual-pdf.ts` ile sınanır.

**BULUNAMAYAN EKİN KAPAĞI DA SİLİNİR.** Bir kapak bırakıp arkasını boş geçmek,
okuyana olmayan bir eki vaat etmek olurdu. Atlananlar yanıt başlığına yazılır
(`X-Atlanan-Ek`).

Bugün üç ek gerçekten bağlıdır: **elektrik projesi**, **şartname** (PDF ise) ve
**mekanik hesaplar** (yayımda `reports` kovasına arşivlenen hesap raporu PDF'i;
yol sözleşmesi `revisions/[revId]/actions.ts` ile aynıdır ve tabloda bir
`pdf_path` sütunu YOKTUR). Mekanik projeler, katalog sayfaları ve elektrik
hesapları uygulamada henüz tek bir dosya olarak durmuyor; bağlanana kadar
kapakları da düşer.

## KITAP-11 — Gövde İKİ SÜTUNDA akar; 9. bölüm tek sütundur; dağıtım VERİDİR, çizim değil.

Kullanıcı isteği (19.08.2026): *"PDF'te sayfayı bölebildiğin her yerde yatayda
ikiye böl, daha kompakt ve düzgün bir doküman istiyorum"* — örnek olarak
TEKLİF PDF'i verildi. `lib/manual/pdf-layout.ts`, `offers/pdf-layout.ts`in
kardeşidir ve ondan öğrendiklerini taşır.

Ölçüldü (kullanıcının indirdiği ORC-BK-0019-00-R01): tek sütunda her ana bölüm
kendi yaprağında başlıyordu ve sayfalar yarı boş kalıyordu — 6. sayfada 776,
8. sayfada 604 karakter. Şablon fikstüründe gövde **9 yapraktan 7'ye** indi ve
sayfa başına karakter 1.500–2.800'den 1.900–4.100'e çıktı.

**@react-pdf SAYFA kırar, SÜTUN kırmaz.** İki `View`in yan yana durması,
birincisi dolunca içeriğin ikincisine akmasını sağlamaz. Akışın nereye gideceği
bu yüzden çizimden ÖNCE karara bağlanır ve karar bir VERİDİR (`ManualBant`) —
çizerken verilen bir karar sınanamazdı.

**ATOM BÖLÜNMEZ.** Yerleşimin birimi başlık, paragraf, liste, kutu, tablo ya da
görseldir; yüksekliği çekirdekte ölçülür ve bir sütuna öyle yerleşir. Başlık
bir ATOMDUR, bir kap değil: bir bölümün gövdesi sütun sınırını geçebilir ve
başlığı kapsayan bir kutu bunu imkânsız kılardı.

**GENİŞ TABLO TAM GENİŞLİK BANDINA DÜŞER** (eşik: DÖRT sütun). Altı sütunlu
elektrik malzeme listesi 234 pt'lik bir sütuna sığmaz — her hücreye 39 pt kalır
ve "6ES7511-1AL03-0AB0" harf harf sarar. Tam genişlik atomu açık sütun bandını
KAPATIR ve kendi bandını açar; sıra korunur. Aynı kural görselde yüzde 55'tir.

**SIRA KORUNUR, DENGE ARANMAZ** (teklifin kuralı): bloklar önce sol sütunu,
sonra sağı, sonra yeni sayfayı doldurur. Sütunları eşitlemek için bölümleri
yeniden dizmek sayfayı düzgün ama belgeyi YANLIŞ yapardı.

**BAŞLIK YALNIZ BAŞINA SÜTUN DİBİNDE BIRAKILMAZ**: kendinden sonraki atomdan da
bir tutam yer ister, yoksa okuyan başlığı bir yerde gövdesini başka yerde
bulur.

**KAPAK, İÇİNDEKİLER, BELGE KİMLİĞİ VE EK KAPAKLARI AKIŞA GİRMEZ.** Kapak
hesap raporuyla aynı ortak bileşeni kullanır: son müşteri logosu, vinç
özellikleri ve beşli alt künye aynı kaynaklardan gelir. İçindekiler kendi iki
sütununu kurar. Eski revizyonların seri numarası/üretim yılı/üretici adresi
kaybolmasın diye bunlar kapaktan ayrılan **Belge Kimliği** ön sayfasında
korunur. Ek kapakları KENDİ YAPRAKLARINDA kalmak zorundadır
(`pdfEkleriYerlestir` sözleşmesi, KITAP-8).

**9. BÖLÜM TEK SÜTUN / TAM GENİŞLİKTİR** (kullanıcı kararı, 29.08.2026).
Bakım ve yedek parça çizelgelerinin bulunduğu bu bölümde sayfa ortasındaki
yatay iki sütun ayrımı ve orta ayırıcı çizgi basılmaz. Başlık, metin, liste ve
tabloların tamamı kullanılabilir gövde genişliğini alır; PDF ve kâğıt
önizlemesi aynı `manualAnaBolumSayfalari` dağıtıcısını okur.

**ÖLÇÜ YAKLAŞIKTIR VE BİLEREK FAZLA ÖLÇER** (`KAPASITE_PAYI` 0,94; teklifin
dersi). Fazla ölçmek sütunu erken kapatır, dipte bir parmak boşluk kalır. Eksik
ölçmek satırı sayfa dışına taşırır ve @react-pdf taşanı SESSİZCE kırpar — bir
bakım talimatının yarısının kaybolması, boş bir dipten kat kat kötüdür. Oranı
bilinmeyen görsel bu yüzden KARE varsayılır.

**KÂĞIT GERİ OKUNUR**: `python scripts/check-manual-layout.py <pdf> [başlıklar]`
taşmayı, kaybı ve doluluğu ölçer. Bileşen ağacına bakmak yerleşimi göstermez.

## KITAP-14 — Sayfalara BAKILARAK düzeltilen kusurlar.

Kullanıcı isteği (19.08.2026): *"çıktıları ve sayfaları kontrol et."* Metin
ölçmek yetmedi — sayfalar resme çevrilip GÖZLE incelendi ve altı kusur ancak
öyle görüldü. Hepsi düzeltildi; sayfa 26'dan **22'ye** indi, karakter/sayfa
ortalaması 1.456'dan **1.759**'a çıktı.

1. **Başlık numarası sarınca son satıra düşüyordu.** `alignItems: "baseline"`
   iki satırlık bir başlıkta "2"yi ikinci satırın soluna indiriyordu.
   `flex-start` + başlığa `flex: 1`.
2. **İçindekiler profesyonel bir navigasyon sayfasıdır.** İki kolonun ayrı
   Bölüm/Sayfa başlığı vardır; ana bölümler sol kırmızı çizgili nötr bantla,
   alt başlıklar kademeli numaralarla ayrılır. Eski uzayan lider çizgisi
   kaldırıldı; uzun başlık esnerken sayfa numarası sağda sabit kalır. Her satır
   gerçek PDF `GoTo` bağlantısıdır.
3. **Sayfa numarası dağıtımın SONUCUNDAN türetilir** (`bolumSayfalari`) —
   önceden bilinemez, çünkü bir bölümün hangi yaprağa düştüğü ancak bütün
   dağıtım bitince belli olur. Kapak, bütün dizin yaprakları ve Belge Kimliği
   sayfası ofsete katılır; ekler gövdeden sonra sırayla numaralanır.
4. **Tam genişlik kararı SÜTUN SAYARAK veriliyordu** ("dörtten fazla sütun").
   Yanlış: hücreleri kısa beş sütunlu bir ekipman listesi yarım sütunda rahat
   okunuyor, tam genişlikte tek satırlık bir tablo koca bir yaprağı kaplıyor
   ve BAŞLIĞINDAN KOPUYORDU (s. 16-17). Karar artık ÖLÇÜLÜR: tablo dar kapta
   %60'tan fazla uzuyorsa sıkışıyordur (`TAM_GENISLIK_SISME_ESIGI`).
5. **Başlık, kendinden sonraki TAM GENİŞLİK atomuyla yapışık değildi.**
   Artık öyle: tablo bu sayfaya sığmıyorsa başlığı da sığmıyor demektir.
6. **Kapaktaki kural çizgisi başlığa yapışıyordu** — `RuleRed`in kendi payı
   yok, çağıran verir.

## KITAP-15 — LİSTE VE TABLO SÜTUNLAR ARASINDA BÖLÜNÜR.

Bölünmeselerdi dokuz maddelik bir liste sütunun dibine sığmadığında oraya
koca bir boşluk bırakırdı (ölçüldü: sütunun dörtte biri). Teklif PDF'i aynı
sorunu `blokBol` ile çözüyor; `atomuBol` onun karşılığıdır.

- **DİLİM ASLINI DEĞİŞTİRMEZ**: `block` aynı nesnedir, dilime ait olan
  `items`/`rows`tur. Kopya bir blok üretilseydi iki dilim iki ayrı blok gibi
  görünür ve `id` bağı kopardı.
- **NUMARA KALDIĞI YERDEN SÜRER** (`itemOffset`): ikinci dilim "1." diye
  başlasaydı okuyan iki ayrı liste görürdü.
- **TABLO BAŞLIĞI HER DİLİMDE TEKRAR EDER**, altyazı yalnız SON dilimde —
  ortada duran bir altyazı tabloyu bitmiş gösterirdi. Sütun payları TAM
  tablodan hesaplanır, dilimden değil; yoksa iki dilim iki ayrı tablo gibi
  görünürdü.
- **BİR DİLİMDE EN AZ İKİ SATIR** bulunur ve **ARTAN TEK SATIR BIRAKILMAZ**
  (teklifin `EN_AZ_KUYRUK` kuralı).
- Yalnız üçten uzun liste ve tablolar bölünür; kısa olanı bölmek kazanç
  getirmez, okumayı bozar.

`KAPASITE_PAYI` 0,94'te KALDI ve bu denenerek karara bağlandı: 0,96 ve 0,97'de
belge yine 22 sayfa, 0,98'de 21 — ama geriye ~15 pt emniyet payı kalıyor. Bir
güvenlik kılavuzunda tek sayfa uğruna sessiz kırpılma riski alınmaz. Dipteki
boşluğun asıl sebebi bu pay değil BÖLÜNEMEYEN atomlardır (uyarı kutusu,
görsel).

## KITAP-16 — Uyarı kutusu PİKTOGRAM taşır.

Belgenin kendi açıklama çizelgesi (`sinyalKelimeleri`) sarı üçgen, mavi ünlem
ve mavi "i" gösteriyordu; kutular onları taşımasaydı çizelge belgede hiç
karşılığı olmayan bir şey vaat etmiş olurdu. Eşleme `MANUAL_NOTE_ASSET`tedir:
tehlike/uyarı/dikkat aynı üçgeni paylaşır — ISO 3864'te genel tehlike işareti
tektir, ayrımı SİNYAL KELİMESİ yapar.

Mavi "i" defterde yoktu; çizelge görselinden mavi piksellerin sınır kutusu
bulunarak kırpıldı (`bilgi-piktogram.png`).

**KULLANILAN VARLIKLARIN LİSTESİ TEK TANIMDIR** (`manualUsedAssetKeys`): görsel
bloklarının `assetKey`i VE uyarı kutularının piktogramı. İkincisi unutulmuştu
ve kutular piktogramsız basılıyordu — yükleyici yalnız görsel bloklarına
bakıyordu. İndirme ucu ve duman testi artık aynı listeyi çağırır.

## KITAP-12 — İki tür görsel: ŞABLON VARLIĞI ve YÜKLENEN GÖRSEL.

Kullanıcı kararı (19.08.2026): *"hazır gelsin, değiştirmek istersek zaten
değiştiririz."* Her vinçte AYNI olan görseller şablondan HAZIR gelir.

**ŞABLON VARLIĞI (`assetKey`)** — baytları REPODADIR
(`public/manual-assets/`), defteri `lib/manual/assets.ts`tedir: uyarı
piktogramları, sinyal kelimesi çizelgesi, CE işareti, halat soketi montajı ve
DIN 15020'nin dokuz halat hasar şekli. On beş dosya, her kılavuzda aynı.
Depoya kopyalansaydı her revizyonda 1,3 MB çoğaltılır ve şablon düzeltildiğinde
eski kılavuzlar eski şekli taşımaya devam ederdi. **Varlık koddur, kodla
sürümlenir.**

`public/` seçildi çünkü İKİ kullanıcısı var: sunucu PDF'e gömmek için diskten
okur, editör önizleme için `/manual-assets/…` adresinden çeker. `src/assets/`
altında ikinci bir kopya, bir dosya değiştiğinde ekranla belgenin ayrışması
demekti.

**YÜKLENEN GÖRSEL (`imageId`)** — o vincin kendi fotoğrafı: kabin konsolu, HMI
ekranı, saha resmi. `manual_images` + `manual-images` kovası, revizyona bağlı
(KITAP-9).

**ORAN DEFTERDEDİR VE TESTLE KİLİTLİDİR.** Yerleşim görselin yüksekliğini
oranından hesaplar; dosyayı açıp ölçmek saf çekirdeği dosya sistemine
bağlardı. `assets.test.ts` PNG başlığından gerçek en/boyu okuyup defterle
karşılaştırır (değişmez md. 8): eksik dosyada görsel hiç basılmaz, yanlış
oranda ise komşu içerik sayfadan taşar.

**DUMAN TESTİ VARLIKLARI İNDİRME UCU GİBİ YÜKLER.** Yüklemediği sürüm ölçüldü:
yerleşim dokuz halat şeklini ölçüp bir sayfa ayırıyor, çizim onları bulamayıp
hiç basmıyor ve ortaya BOMBOŞ bir yaprak çıkıyordu. `asset-bytes.ts` bu yüzden
`server-only` taşımaz (`pdf/brand.tsx` ile aynı karar).

## KITAP-13 — Uyarı düzeyi BEŞ basamaktır ve genel bölümler standarda dayanır.

Düzeyler `not · onemli · dikkat · uyari · tehlike` — ISO 3864-2 / ANSI Z535.4
basamakları ve firmanın kendi kılavuzunun çizelgesi. Dört basamakla
başlamıştık; "DİKKAT" eksikti ve onsuz küçük yaralanma riski ile ölüm riski
aynı kutuya giriyordu. Eski `bilgi` değeri `withManualDefaults`ta `not`a
taşınır — bir kılavuzu açılmaz yapmaktansa kutuyu bir basamak aşağı almak
doğrudur.

Şablon 2026-08-19'da genişletildi (kullanıcı isteği: piyasadaki iki kılavuz
örnek verildi). **O BELGELERDEN METİN YA DA ŞEKİL ALINMADI** — ikisi de telif
korumalıdır ve biri her sayfasında çoğaltmayı açıkça yasaklar. Örnekler yalnız
KAPSAM HARİTASI olarak okundu (bir kılavuzun hangi başlıkları taşıması
gerektiği); metinler özgün yazıldı ve dayanakları kamuya açık standartlardır:

- ISO 12480-1 — vinçlerin güvenli kullanımı, sorumluluklar, sinyalci
- ISO 16715 — el işaretleri
- ISO 9927-1 — muayene türleri ve aralıkları
- ISO 12482 · FEM 9.755 — kalan servis ömrü (SWP)
- ISO 3864-2 · ANSI Z535.4 — uyarı düzeyleri
- DIN 15020 — halat muayenesi ve hurdaya ayırma kıstasları

Eklenen bölümler: Yüksekte Çalışma ve Düşme Koruması · Yangın Güvenliği ·
Kimlik Plakaları · Kullanım Öncesi Günlük Kontrol · Yük Kaldırma Kuralları ·
Yük Savrulmasının Önlenmesi · El İşaretleri ve Haberleşme · Kullanım Sonrası
Güvenli Bırakma · **Periyodik Muayene** (türler, kapsam, kaynaklı yapı, kalan
ömür, muayene defteri) · **Bakım Güvenliği** (öncesi/sırasında/sonrası,
değişiklik yasağı). Basılan bölüm sayısı 50'den 70'e çıktı.

KITAP-5 GEÇERLİLİĞİNİ KORUR: eklenen metinlerin hiçbiri vince özel sayı
taşımaz ve `payload.test.ts`teki koruma bunu sınamaya devam eder.

## KITAP-9 — Görsel SUNUCUDAN GEÇER ve YENİDEN KODLANIR.

Elektrik projesi ve şartname doğrudan depoya yüklenir; görsel yüklemesi
(`manual/[revId]/gorsel`) bunun TERSİDİR ve sebebi üç katlıdır:

- "PNG" bir BEYANDIR, kanıt değil (`customers/logo-image.ts` dersi).
- 16 bitlik, interlaced ya da paletli bir PNG react-pdf'in çözücüsünü düşürür
  ve TEK bozuk görsel BÜTÜN kılavuzu 500'e çevirirdi. Baytlar `sharp` ile
  8 bit sRGB, interlaced olmayan, paletsiz bir PNG olarak yeniden kodlanır.
- **En-boy oranı ÖLÇÜLÜR, beyan edilmez**: yanlış bir oran PDF'te resmi ezer.

Görsel yalnız TASLAĞA eklenir (RLS de aynı şeyi söyler): gövde yayımda donar ve
resim gövdenin parçasıdır. Yeni revizyon açılırken kayıtlar **kimlikleri
korunarak** kopyalanır — `payload` içindeki `imageId` atıfları aynı kalmalı,
yoksa her resim bloğu boşa düşerdi.

## KITAP-10 — İstemciden gelen gövde OLDUĞU GİBİ yazılmaz.

`saveManualRevision` gelen JSON'u önce `withManualDefaults`tan geçirir. Serbest
biçimli bir gövdeyi doğrudan yazmak, bir hatanın (ya da kötü niyetin)
veritabanına okunamayan bir belge yazması demekti ve o kayıt bir daha açılmazdı.

Kaydetme AÇIKTIR, otomatik değil: arka planda dolaşan bir kaydedici hangi hâlin
kaydedildiğini belirsizleştirirdi. Kaydedilmemiş değişiklikle sayfadan çıkış
uyarır — bir kılavuzda yarım saatlik yazının sekme kapanınca kaybolması,
kullanıcının o ekrana bir daha güvenmemesi demektir.

**YEREL KURTARMA KOPYASI OTOMATİK KAYDETME DEĞİLDİR** (30.08.2026). Üç panelli
yüzde yerinde düzenleme kayıp riskini artırdığı için gövdenin bir kopyası
`localStorage`a, revizyon kimliğiyle anahtarlı olarak yazılır. VERİTABANINA
HİÇBİR ŞEY GİTMEZ: `Kaydet` tek yazma eylemi olarak kalır ve belirsizlik
doğmaz. Açılışta sunucudakinden yeni bir yerel kopya varsa editör SORAR
("Geri Yükle / Yoksay"); kaydetmede kopya silinir. Kopya bir sonraki tıkta
okunur — render sırasında `window` yoktur ve etkinin gövdesinde `setState`
çağırmak zincirleme render üretirdi.

## KITAP-17 — EK-F'ye TAM KATALOG değil TEKNİK FÖY girer.

Tam sürüm üretilirken `elektrikKatalog` eki güncel elektrik malzeme sırasından
çözülür. Her eşsiz kaynak/aralık için en çok **kapsam paketinin verdiği sayıda**
(öntanım **iki**, 30.08.2026 · KITAP-20) teknik sayfa alınır;
aynı föy birden çok üründe kullanılıyorsa `source_document_id + source_pages`
anahtarıyla bir kez basılır. Tam üretici kataloğu malzeme tablosundaki Katalog
düğmesinden erişilebilir kalır fakat yüzlerce sayfalık kataloğun tamamı EK-F'yi
şişirmez.

EK-F'nin başında iki sütunlu ve tıklanabilir bir dizin bulunur. Dizindeki
`F-nnn` numaraları EK-F içindeki yerel yaprağı, kitabın altbilgisindeki folio
ise birleşmiş belgenin gerçek `NN / TOPLAM` numarasını gösterir. Ek sayfaları
1600 px genişlikte, JPEG kalite 80 ile yeniden örneklenir; böylece teknik yazı
okunur kalırken taranmış/vektör katalogların teslim dosyasını yüzlerce MB'a
çıkarması önlenir.

Eksik veya bozuk tek föy bütün kitabı düşürmez. Geçerli föyler mevcut
`pdfEkleriYerlestir` hattında EK-F kapağının hemen arkasına birleşir; hiç
geçerli belge yoksa var olmayan içeriği vaat eden boş kapak korunmaz. Ek
yerleştirildikten sonra dizindeki adlandırılmış hedefler nihai sayfa
referanslarına çevrilir; kopyalama işlemi bağlantıları sessizce öldüremez.

## KITAP-18 — Proje rapor firması kimliği ORTAKTIR; el kitabına özel görseller SNAPSHOT'tır.

Kullanıcı kararı (29.08.2026): Hesap raporu ekranındaki
`projects.report_brand_customer_id` alanının kullanıcı adı **Rapor Firması**dır.
ORION işi bu firmayla birlikte yürütür; seçilen firma hesap raporu, ekipman
listesi ve işletme-bakım kitabında aynı ortak kimlik olarak kullanılır. ORION
logosu kapakta ve belgenin bütün üst bantlarında **solda sabittir**; rapor firması
ORION kimliğinin yerine geçmez. Kapakta ORION bandının altında rapor firmasının logo
ve adı, devam sayfalarında orta logo yuvası gösterilir. Rapor firması seçilmemişse
bu blok/yuva açılmaz.

**PROJE RAPOR FİRMASI BİRİNCİL, ELLE YÜKLENMİŞ LOGOLAR GERİYE DÖNÜK YEDEKTİR.**
Proje rapor firmasının adı ve normalize logosu PDF ucunda
`loadReportCoverIdentity` ile çözülür. Eski el kitaplarındaki
payload orta-logo kaydı, proje rapor firması
yoksa orta yuvada kullanılmaya devam eder; sağ-logo kaydı ek sağ logo olarak
korunur. Bu elle yüklenmiş kimliklerin baytları diğer vince özel görseller gibi
`manual_images` kaydı ve `manual-images` kovasında yaşar ve yeni revizyona
snapshot olarak kopyalanır.

`coverImageId` **kapak fotoğrafıdır**; rapor firması logosu değildir. Kapak fotoğrafı
belgenin kimlik alanının altında yer alır ve yokluğu kapağı bozmaz. Editör
görsel yükleme yanıtındaki sunucuda ölçülmüş `id`, genişlik ve yükseklik
satırını beklemeden yerel görsel listesine ekler; kullanıcı yüklediği fotoğrafı
veya logoyu aynı oturumda kapakta ve kâğıt önizlemesinde görür. Oran istemcinin
beyanından değil sunucunun yeniden kodladığı baytlardan gelir (KITAP-9).

**DAR EKRANDA İKİ AYRI ÇALIŞMA YÜZÜ VARDIR:** `Düzenle` ve `Kâğıt`. Telefon ve
dar tablette ikisi alt alta yığılmaz; kullanıcı açık bir geçişle form ile A4
önizleme arasında dolaşır. Geniş ekranda düzenleyici ve kâğıt birlikte
görülebilir. Geçiş görünümü değiştirir, kaydedilmemiş gövdeyi değiştirmez.

**YAYIM BİR KALİTE KAPISINDAN GEÇER.** Taslak; kapak künyesinin zorunlu kimlik
alanları tamamlanmadan veya şablonun vince özel doldurulması gereken görünür
boş blokları dururken yayımlanamaz. Gizlenmiş bölüm bilinçli bir kapsam
kararıdır ve eksik sayılmaz; standart metin ve otomatik tablo da vince özel boş
blok değildir. Kapı kullanıcıya eksikleri bölüm adıyla gösterir ve editörde o
bölüme götürür. Sunucu eylemi aynı denetimi yeniden yapar; yalnız istemci
engelinin aşılması yayıma izin vermez.

## KITAP-19 — Editör ÜÇ PANELLİ BİR BELGE YÜZÜDÜR; gövde eki vaat etmez.

Kullanıcı kararı (20.08.2026): seksen beş satırlık düz bölüm ağacı bir çalışma
yüzü değildir. **Bu tespit geçerlidir; çözümü 30.08.2026'da DEĞİŞTİRİLDİ**
(kullanıcı: *"şu anki arayüz bana hiç iyi gelmiyor"*). Eski karar — "sol ray
yalnız ana bölümleri gösterir, alt bölümler orta alandaki kısa seçicide açılır"
— GERİ ALINMIŞTIR: kullanıcıyı belgenin neresinde olduğunu iki ayrı listeden
çıkarmaya zorluyor ve belgeyi hâlâ bir FORM gibi gösteriyordu.

**AĞACI KISALTMAK DEĞİL, SÜZMEK.** Sol **Belge Haritası** ağacın TAMAMINI
gösterir; arama (`trKatla`) ve "yalnız eksikler" onu o anki işe indirger.
Seçili bölümün dalı her zaman açıktır — kullanıcı aradığı bölümü kapalı bir
dalın içinde kaybetmez.

**ORTA PANEL BİR FORM DEĞİL, BİR TOMARDIR.** Seçilen bölümün BÜTÜN alt ağacı
basılı belgeye benzer tipografiyle ve YERİNDE düzenlenebilir olarak akar; ana
bölümü seçmek bölümün tamamını açar. Tomar A4 SAYFALAMAZ ve bu bilinçlidir:
"ne yazdığımı görüyorum" Tomar'ın, "kaç yaprak tutuyor" Kâğıt modunun işidir.
İkisini birleştirmek her tuşta bütün dağıtımı hesaplamak ve yazarken imlecin
sayfa atlaması demekti.

**SAĞ PANEL MÜFETTİŞTİR** ve «Kâğıt» açıkken yerini A4 önizlemesine bırakır:
uyarı düzeyi, görsel genişliği ve otomatik tablo varyantı SEYREK dokunulan ama
varlığı bilinmesi gereken ayarlardır; Tomar'a gömülselerdi her blok bir ayar
kutusuna döner, tamamen gizlenselerdi kullanıcı görselin sayfaya
yayılabildiğini hiç öğrenmezdi.

**SEKMELER AYRI ÇALIŞMA YÜZLERİDİR:** İçerik · Kapsam · Künye · Kalite ·
Kaynaklar. Dar ekranda üç panel yığılmaz; kutu ızgaralı bir geçiş Harita /
Belge / Kâğıt arasında dolaştırır (değişmez md. 10).

**BLOK EKLEME İKİ BLOK ARASINDAN AÇILIR.** Eski şerit bloğu her zaman bölümün
SONUNA ekliyordu ve araya blok koymak ok düğmesiyle taşımayı gerektiriyordu.
Menü metin parçaları defterini de taşır (KITAP-21).

Editör boş bir başlık kapsayıcısıyla değil, yayıma engel olan ilk vince özel
işle açılır.
İlerleme yüzdesi standart metinleri tamamlanmış iş gibi saymaz; kalite kartı
yalnız eksik künye alanlarını ve doldurulması ya da bilinçli gizlenmesi gereken
vince özel bölümleri sayar. Künye ayrı bir çalışma yüzüdür; içerik formlarıyla
aynı uzun sayfada karışmaz.

**GÖVDE PDF'İ EK DEĞİLDİR.** Parametresiz çıktı kapak, içindekiler ve işletme
bölümlerinden oluşur; ek kapsayıcısı ile boş ayraç kapakları gövde dizinine ya
da sonuna basılmaz. Tam sürüm yalnız gerçekten bulunup doğrulanan ekleri,
onların kapsayıcısını ve ayraçlarını taşır. Bir ek yoksa belge var olmayan bir
içeriği vaat etmez. Birleştirme sözleşmesi değişmez: tam sürüm için üretilen
temel PDF'nin son n yaprağı, eklerle aynı sıradaki n ayraç kapağıdır.

**HER ANA BÖLÜM YENİ BİR SAYFADAN BAŞLAR** (kullanıcı kararı, 29.08.2026;
önceki “tek kesintisiz akış” kararı geri alınmıştır). Dağıtıcı her üst düzey
bölüm için temiz bir fiziksel yaprak açar; alt bölümler kendi ana bölümlerinin
akışında devam eder. 9. bölüm ayrıca KITAP-11 uyarınca tam genişliktir. Ekran
önizlemesi ve PDF aynı atom dağıtımını ve aynı içindekiler kapasitesini okur;
sayfa numarası iki yerde ayrı tahmin edilmez.

**ELEKTRİK MALZEMESİ KILAVUZDA KARAR ÖZETİDİR.** Yüzlerce aygıt satırı el
kitabında ikinci kez basılmaz. Kılavuz pano bazında proje satırı ve okunabilen
adet toplamını verir; ürün/aygıt düzeyindeki tam döküm elektrik projesindedir,
seçilen teknik föyler EK-F'dedir. Yayımlanmış revizyonun donmuş eski tablosu
değiştirilmez; yeni özet yalnız canlı taslak kaynağına uygulanır.

## KITAP-20 — KAPSAM bir DURUM değil, bir İŞLEMDİR; defter KODDADIR.

Kullanıcı kararı (30.08.2026): *"bir müşteriye projeleri vermeyebilirim
diğerine verebilirim. Bir müşteriye ekipman listesini detaylı kataloglu
veririm diğerine standart versiyonu, bir müşteriye hesap raporunu detaylı
veririm diğerine standart."* Bunun adı **TESLİM PAKETİDİR** ve üç basamağı
vardır: **Standart · Detaylı · Tam Teknik** (`lib/manual/packages.ts`).

**PAKET UYGULAMAK AĞACA YAZAR.** `applyManualPackage` bölümlerin
`section.hidden` alanını ve otomatik blokların `variant` alanını değiştirir;
`scope.sectionVisibility` gibi İKİNCİ BİR GÖRÜNÜRLÜK DEPOSU AÇMAZ. Açsaydı
KITAP-6 çiğnenirdi: gizlenen bölüm ekrandan düşer ama belgeye girmeye devam
ederdi — bu bölümde olabilecek en pahalı hata budur. `printedManual` TEK
süzgeç olarak kalır.

**EKİN BELGEYE GİRİP GİRMEYECEĞİ DE AYNI YOLDAN GEÇER.**
`manualAppendixOrder` zaten `printedManual`ı okur, yani ek bölümünü gizlemek
eki de düşürür. Bu yüzden paketin "ek seçimi" diye ayrı bir alanı YOKTUR ve
KITAP-8'in birleştirme sözleşmesine hiç dokunulmadı. `scope.appendixOptions`
yalnız **başka evi olmayan** ayarı taşır: ek girecekse hangi biçimde —
`mekanikHesap` için rapor seviyesi, `elektrikKatalog` için ürün başına föy
sayısı.

**DEFTER KODDADIR, VERİTABANINDA DEĞİL.** Paket şablonun `key`lerine atıf
yapar. Veritabanında dursaydı bir bölüm anahtarı yeniden adlandırıldığında
satırlar sessizce ölür ve hiçbir test bunu yakalayamazdı; kodda durunca tek bir
test her anahtarın `MANUAL_TEMPLATE`te gerçekten var olduğunu doğrular
(değişmez md. 8). Üç paket vardır, üç yüz değil — müşterisi olmayan bir yönetim
ekranı bir maliyettir.

**SAPMA KORUNUR VE KENDİ KENDİNİ ONARIR.** Paket uygulandıktan sonra bir
bölümün görünürlüğüne elle dokunulursa anahtarı `scope.keptSections`a girer ve
paket yeniden uygulandığında o bölüme DOKUNULMAZ; eylem `korunan` listesini
döndürür, arayüz "3 bölüm sizin kararınızla korundu" der. Bu KITAP-4'ün
(`edited`) kapsam düzeyindeki ikizidir: makine önerir, insan son sözü söyler.
Kullanıcı bölümü paketin dediği yere geri getirirse anahtar listeden ÇIKAR —
aksi hâlde bir kere dokunulan bölüm sonsuza dek paketin dışında kalırdı.
Görünürlüğü değiştiren TEK giriş `manualToggleSection`dır; ağacı çeviren ve
sapmayı yazan iki ayrı çağrı olsaydı sapma bir yerde kaydedilir bir yerde
kaydedilmezdi. "Paketi Baştan Uygula" (`sapmalariYokSay`) listeyi temizler ve
onay ister.

**PAKET BLOK SİLMEZ**, yalnız `hidden` yazar: gizlemek silmek değildir ve paket
değiştirmek geri alınabilir olmalıdır. Tam Teknik'ten Standart'a inip geri
dönmek belgeyi eski hâline getirir.

**ANAHTARI OLMAYAN BÖLÜME PAKET KARIŞMAZ.** Kullanıcının kendi eklediği serbest
bir bölümü paket gizleseydi, kullanıcı yazdığı şeyin nereye gittiğini bir daha
bilemezdi. Ek KAPSAYICISI da gizlenmez — bütün ekleri kapalıysa süzgeç onu
zaten düşürür, ayrıca gizlemek bir ek geri açıldığında kapsayıcının kapalı
kalması demekti.

**VARYANT BLOĞUN KENDİSİNDE YAŞAR** (`ManualAutoBlock.variant`), ayrı bir arama
tablosunda değil: çözücü `autoTableFor` zaten bloğu alıyor ve ikinci bir tablo,
bloğun kopyalandığı her yerde (yeni revizyon, metin parçası) ayrışması demekti.
Ekipman listesinde üç basamak vardır — `standart · detayli · kataloglu` — ve
**SÜTUN ANCAK VERİ VARSA AÇILIR**: kaynak teknik özelliği doldurmuyorsa o sütun
hiç basılmaz. Baştan sona boş bir sütun okuyana bir şey vaat edip vermemekti ve
dar sütundaki tabloyu gereksiz yere tam genişliğe iterdi (KITAP-11).

**ESKİ BELGELER SERBEST KAPSAMDADIR.** `scope` alanı olmayan bir payloadda
`packageKey` boş doğar ve boş kapsam ağaca HİÇBİR ŞEY yazmaz; hiçbir paket
geriye dönük uygulanmaz. Bu yüzden kapsam modeli eklendikten sonra da teslim
edilmiş bir kılavuz birebir aynı belgeyi basar. Kanıt bir testtedir:
`__tests__/payload-legacy.test.ts` donmuş bir v1 fikstürünü bugünün
okuyucusundan geçirip basılan iskeleti dondurulmuş listeyle karşılaştırır ve
BÜTÜN FAZLARDA koşar.

**PAKET ÖNERİLİR, DAYATILMAZ.** `suggestManualPackage(craneType)` yeni belgenin
başlangıç paketini seçer: şarj/pota/döküm/cüruf vinçleri Tam Teknik,
portal/konsol/pergel Detaylı, geri kalanı Standart. Karşılaştırma `trKatla` ile
yapılır — `/şarj/i` deseni "ŞARJ VİNCİ"yi BULMAZ (Türkçe ı/I tuzağı) ve bu
karşılaştırma hem sunucuda hem istemcide koşar.

## KITAP-21 — ÜÇÜNCÜ İÇERİK TÜRÜ: TÜRETİLMİŞ BLOK.

Kullanıcı isteği (30.08.2026): *"standart vinçleri neredeyse otomatik bir
işletme kılavuzu olsun."* Şablon vince özel bölümleri bilerek boş doğurur
(KITAP-5) ama o boşlukların ÇOĞUNUN kaynağı zaten uygulamadadır: gerilim hesap
raporunda, frenler ekipman listesinde, bakım çizelgesi ekipman listesi + kural
defterindedir. Belgede artık üç tür içerik yaşar:

| | Şablon metni | Otomatik tablo | **Türetilmiş blok** |
|---|---|---|---|
| İşaret | `fromTemplate` | `kind: "auto"` | **`derived: "<kuralId>"`** |
| Kaynağı | her vinçte aynı | uygulamanın verisi | bu vincin verisi |
| Yayımda | snapshot | `frozen`a donar | zaten somut |
| Geri alma | **Standarda Dön** | — | **Kaynaktan Tazele** |

**TÜRETİLMİŞ BLOK MATERYALİZEDİR, CANLI DEĞİL.** Üretildiği anda somut
metin/tablo olarak snapshot'a yazılır. Canlı olsaydı yayımda ayrıca
dondurulması gerekirdi; `frozen` yalnız `kind: "auto"` bloklarına aittir ve
`issueManualRevision` hiç değişmedi.

**`derived` İLE `fromTemplate` AYNI BLOKTA BULUNMAZ** ve bu testle kilitlidir.
İkisi birden olsaydı "Standarda Dön" ile "Kaynaktan Tazele" aynı bloğa iki
farklı geçmiş vaat ederdi.

**BOŞ ŞABLON YER TUTUCUSU DEVRALINIR.** Bir kuralın ilk uygulamasında bölümdeki
dokunulmamış `bosluk()` bloğu aynı türdense türetilmiş blok ONUN YERİNE geçer
ve kimliğini devralır. Aksi hâlde belgede biri hiç basılmayan iki blok kalır ve
kullanıcı hangisini dolduracağını bilemezdi.

**KAYNAK KÜÇÜLÜRSE BLOK DÜŞER.** Frenler ekipman listesinden çıktığında o
bölümün türetilmiş blokları da temizlenir — belge olmayan bir parçanın bakımını
anlatmaya devam edemez. Kaynağı düşen kural `null` döndürür ve `null` DA BİR
SONUÇTUR: eski bloklar yine temizlenir.

**`edited` KAZANIR ama TEKİL TAZELEME ONU BİLEREK YOK SAYAR.** Toplu "Kaynaktan
Doldur" dokunulmuş blokları atlar ve korunanı SAYAR; blok başındaki "Kaynaktan
Tazele" düğmesine basmak ise "benim düzenlemem gitsin, kaynağı geri getir"
demektir.

**BAKIM VE YAĞLAMA DEFTERLERİ İKİ KATMANLIDIR** (kullanıcı kararı, 30.08.2026).
KOD KATMANI (`maintenance-rules.ts`, `lubrication-rules.ts`) dayanağı bir
STANDART olan satırları taşır ve testle kilitlidir; PANEL KATMANI firmaya özel
satırları taşır, kod kuralının üzerine binebilir (`disabled` ile kapatabilir) ya
da yenisini ekler. Birleştirme TEK yerdedir (`mergeMaintenanceRules` /
`mergeLubricationPoints`) ve çekirdek DB OKUMAZ — defteri sunucu adaptörü okur
ve çekirdeğe geçirir (değişmez md. 7).

**DAYANAK STANDARDIN ADIDIR, MADDE NUMARASI DEĞİL.** Standartların baskıları
arasında madde numaraları kayar; uydurma bir "md. 5.2" atfı bir güvenlik
belgesinde doğrulanamayan bir otorite iddiası olurdu. `basis` alanı belgeye
BASILMAZ — defterde durur ve "her kod kuralının dayanağı doludur" testiyle
korunur.

**BAKIM ÇİZELGESİ ~40 KURALIN EKİPMAN LİSTESİYLE GENİŞLEMESİDİR.** Kaynak
belgedeki 235 satır elle taşınmıyor; desensiz kurallar (günlük kontrol, kaynaklı
yapı, acil stop) her vinçte basılır, desenli kurallar yalnız o vinçte KARŞILIĞI
OLAN ekipman için. Parça adı KAYNAKTAN gelir, kuralın genel adından değil: kural
"Rulman / yatak" der, vinçte o parça "Tambur rulman yatağı"dır ve bakımı yapacak
kişi listede o adı arar. **SEÇENEK SATIRLARI ÇİZELGEYE GİRMEZ** — alternatif
ekipman takılı değildir ve takılmamış bir redüktörün yağını değiştirmek diye bir
görev yoktur (`ManualEquipmentRow.alternative`).

**YAĞLAMA TABLOSUNUN İSKELETİ TÜRETİLİR, MARKA SÜTUNLARI BOŞ DOĞAR.** Hangi
noktaların yağlanacağı ekipman listesinde yazılıdır; hangi ÜRÜNÜN kullanılacağı
uygulamada YOKTUR ve "Shell Omala S2 G 220" yazmak uydurma veri olurdu (değişmez
md. 4). Köprü, tablonun üstüne düşen türetilmiş bir nottur ve yağ SINIFINI söyler
(ISO VG kademesi, NLGI kıvamı). **YAĞ KEÇESİ LİSTESİ TÜRETİLMEZ** — KITAP-5 bunu
açıkça yasaklar.

**DUMAN TESTİ TÜRETİMLE KOŞAR:**
`npx tsx scripts/test-manual-pdf.ts tmp/kitap.pdf --turet [--paket=<key>]`.
Türetimsiz belge 20 yaprak; ~200 satırlık bakım çizelgesiyle 29 yaprak olur ve
`atomuBol` asıl orada sınanır.

## KITAP-22 — GÖRSEL DÖRT KAYNAKTAN GELİR, İKİ YERDE DURUR.

Kullanıcı kararı (30.08.2026): kılavuzdaki görseller elle yüklenen fotoğraf,
**hesap motorunun şeması**, **Teknik Resim Takibi'nden bir pafta** ve
**üretici katalog sayfası** olabilir. Şikâyet "çok metin, az görsel"di; oysa
bu vincin halat donanımı, tamburu, kanca bloğu ve kiriş kesiti ZATEN çiziliydi
— ikinci bir çizim yapmak değil, olanı getirmek gerekiyordu.

**DÖRT KAYNAK, TEK KAPI.** Baytlar `lib/manual/image-intake.ts`ten geçer ve
KITAP-9'un üç kuralı dördünde de aynen işler ("PNG bir BEYANDIR", 8-bit sRGB
paletsiz yeniden kodlama, oranın ÖLÇÜLMESİ). Dört uç kendi kodlamasını
yazsaydı biri `sharp`ı atlar ve o kaynaktan gelen tek bozuk görsel bütün
kılavuzu 500'e çevirirdi.

**ŞEMA RASTERLENMEZ — VEKTÖR BLOKTUR** (`kind: "diagram"`). `Diagram` saf bir
SVG veri modelidir ve iki çizici zaten vardır: `lib/pdf/diagram.tsx` (PDF) ve
`components/diagrams/diagram-svg.tsx` (ekran). Karar ÖLÇÜLEREK verildi
(30.08.2026): seksen şemanın en büyüğü **38 KB**, ortalaması **10 KB**, hiçbiri
100 KB'ı geçmiyor — modeli snapshot'ta taşımak ucuzdur ve teslim belgesinde
şema KESKİN kalır. Oranı da kendi `width`/`height`ındadır; yerleşim dosyaya
bakmadan ölçer ve burada görseldeki "bilinmiyorsa kare varsayılır" TAHMİNİ
YOKTUR.

**ŞEMA DONMUŞ EKLENİR, CANLI DEĞİL** (KITAP-7'nin dersi): ekleme anında
çözülür ve payload'a yazılır. Canlı olsaydı yayımlanmış bir kılavuz, hesap
sonradan revize edilince sessizce başka bir şey söylerdi. Model DOĞRULANMAZ,
TAŞINIR: çizim modeline eklenen yeni bir eleman türü eski kılavuzları açılmaz
yapmamalıdır. Yalnız ÖLÇÜSÜ olmayan şema düşer — yüksekliği bilinmeyen bir atom
komşusunu sayfadan taşırırdı.

**KATALOG SAYFASI ZATEN GÖRÜNTÜDÜR** (`lib/catalog-sheets.ts`: "PDF dilimi
SAKLANMAZ"), bu yüzden orada da rasterleme yoktur. Liste defterin tamamından
değil BU VİNCİN EKİPMANINDAN süzülür; iki yüz altmış sayfayı olduğu gibi
göstermek, aradığını bulmayı imkânsız kılardı. Yol hem defterdeki izin
listesiyle hem de kök denetimiyle doğrulanır — uç bir dizin gezme yüzeyi açmaz.

**TEK RASTERLENEN KAYNAK PAFTADIR** ve 1600 px'tir — `catalog-appendix.ts` ile
aynı ölçü, aynı gerekçe. Vektör gömmek istenirdi ama @react-pdf yabancı bir PDF
sayfasını gövdeye alamaz; o iş `pdf-lib` birleştirmesinindir ve orası EKLERİN
yoludur (KITAP-8). Gövdeye giren tek yaprak için ek açmak, bir resmi göstermek
uğruna belgeye ayraç kapağı eklemek olurdu.

**GÖVDEDEKİ TEK YAPRAK, EKTEKİ BÜTÜN BELGEDEN AYRIDIR.** "Mekanik Projeler"
eki bütün paftaları teslim paketine bağlar, EK-F seçilmiş teknik föyleri
taşır; buradaki blok "genel montaj resmi 3. bölümde dursun" diyen mühendisin
ihtiyacıdır.

**KAYNAK KAYDEDİLİR** (`manual_images.origin`): "bu resim hangi paftanın
kaçıncı sayfası" sorusunun cevabı bir yıl sonra da gerekir — pafta revize
edildiğinde hangi kılavuzun tazelenmesi gerektiği ancak böyle bilinir. Dosya
adına gömmek bir adlandırma sözleşmesi icat etmek olurdu ve kullanıcı adı
değiştirdiğinde bağ sessizce kopardı. Boş nesne "bilinmiyor" demektir ve
sütundan önceki kayıtlar için geçerli bir durumdur. Kaynak, yeni revizyona
snapshot'la birlikte KOPYALANIR.

**İKİ TÜR DEĞİL ÜÇ DEĞİL — İKİ YER.** Şema payload'da yaşar (vektör model),
öteki üçü `manual_images` kaydı + `manual-images` kovasında. KITAP-12'nin
`assetKey`/`imageId` ayrımı bozulmaz; şema onlara rakip değil, ayrı bir blok
türüdür.
