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
(Karçel A.Ş., 028.00-KBK01) — 14 ana bölüm, 40'tan fazla alt bölüm. Şablon o
belgenin **iskeleti ve projeden bağımsız metinleridir**.

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

## KITAP-11 — Gövde İKİ SÜTUNDA akar; dağıtım VERİDİR, çizim değil.

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

**KAPAK, İÇİNDEKİLER VE EK KAPAKLARI AKIŞA GİRMEZ.** Kapak belgenin kimliğidir
(künye bloğu yine de iki sütunludur); içindekiler kendi iki sütununu kurar; ek
kapakları KENDİ YAPRAKLARINDA kalmak zorundadır (`pdfEkleriYerlestir`
sözleşmesi, KITAP-8).

**ÖLÇÜ YAKLAŞIKTIR VE BİLEREK FAZLA ÖLÇER** (`KAPASITE_PAYI` 0,94; teklifin
dersi). Fazla ölçmek sütunu erken kapatır, dipte bir parmak boşluk kalır. Eksik
ölçmek satırı sayfa dışına taşırır ve @react-pdf taşanı SESSİZCE kırpar — bir
bakım talimatının yarısının kaybolması, boş bir dipten kat kat kötüdür. Oranı
bilinmeyen görsel bu yüzden KARE varsayılır.

**KÂĞIT GERİ OKUNUR**: `python scripts/check-manual-layout.py <pdf> [başlıklar]`
taşmayı, kaybı ve doluluğu ölçer. Bileşen ağacına bakmak yerleşimi göstermez.

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
