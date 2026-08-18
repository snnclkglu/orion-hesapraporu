# Satış Takibi

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/satis.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/app/(app)/sales/**` · `src/lib/pdf/job-list.tsx`

## SATIS-16 — Satış Takibi İŞ KALEMİNE bağlanır ve AYRI TABLODADIR.

`job_item_sales` (kapsam, termin/sevk, miktar, ağırlık, birim fiyat, para
birimi, kur) yalnız Yönetici ve Müdür'e açıktır. Alanlar `job_items`
üzerine konsaydı satır bütün olarak okunduğu için fiyatı ayıklamak sunum
katmanına kalırdı; ayrı tabloda yetkiyi RLS'in kendisi keser.

**Satırlar önceden ÜRETİLMEZ:** sayfa `job_items` ile sol birleştirme yapar,
kayıt ilk fiyat girildiğinde `upsert` ile oluşur. Tetikleyiciyle satır
açmak, iş emri güncellemesi `job_items`i tamamen yenilediği için boş kayıt
bırakırdı.

**Toplamlar TÜRETİLİR** (`generated always as stored`): toplam ağırlık,
toplam fiyat ve avro karşılığı birim değerlerden çıkar — elle girilen bir
toplam onlarla çelişebilirdi. **Kur satırın kendindedir** (1 avro kaç birim
para eder): merkezî bir kur tablosundan okunsaydı sözleşme anındaki kur
değiştiğinde geçmiş cironun avro karşılığı da değişirdi. Firma ciroyu
AVRODA toplar; kuru girilmemiş satır toplama girmez ve sayfada ayrıca
sayılır ki sessizce kaybolmasın.

**KUR EKSİKKEN KAYIT YAPILMAZ** (kullanıcı kararı, 11.08.2026). Sayfada
bir süre "Kuru Eksik" adlı bir özet kartı vardı: olmaması gereken bir
durumun sayacıydı. Doğrusu o durumu hiç doğurmamaktır — kart kalktı, kural
`sale-dialog.tsx`in kaydetme yoluna taşındı ve fiyat girilmişse hem miktar
hem kur zorunludur. Kontrol yalnız FİYAT GİRİLMİŞSE çalışır: kapsam ya da
termin yazıp fiyatı sonraya bırakmak meşru bir kullanımdır.

**YER TUTUCU BİR DEĞER DEĞİLDİR.** Miktar kutusunun yer tutucusu "1"
yazıyor, kutu ise boştu; toplam `?? 0` ile okunduğu için kullanıcı birim
fiyatı giriyor ve toplam sessizce "0 €" kalıyordu (kullanıcı bildirimi,
11.08.2026). Üç şey birden düzeltildi ve üçü de kuraldır: veri örneği
taşıyan yer tutucular uygulamadan KALDIRILDI, boş miktar artık sıfır değil
`null` üretiyor (kutu "—" gösterir) ve yeni satırın miktarı GERÇEK bir
değer olarak 1'dir (`EMPTY_SALE`).

**TERMİN VE SEVK YERİ İŞ EMRİNDEN GELİR, SEVK TARİHİ GELMEZ** (kullanıcı
isteği, 18.08.2026: *"termin sevk tarihi sevk yeri bilgileri İş emrinden
gelsin"*). Pencere açılırken BOŞ alanlar iş emrinin `delivery_date` ve
`shipping_address` değerleriyle dolar (kaydedilmiş bir değer varsa o kazanır)
ve kutunun altında "İş emrindeki teslim tarihi" yazar — aynı bilgiyi ikinci kez
yazdırmanın anlamı yok.

**SEVK TARİHİ İSTİSNADIR ve gerekçesi bu sayfanın kendi kuralıdır:** alan "sevk
edildi" demektir ve girildiği anda işin bütün kalemleri sevk edilmişse iş durumu
kendiliğinden "Tamamlandı" olur. İş emrindeki ATÖLYE ÇIKIŞ tarihi ise bir
PLANDIR; kutuya sessizce düşseydi fiyat girmek için açılan bir pencere, henüz
imalattaki bir işi tamamlanmış gösterirdi. Plan tarihi tek tıkla alınabilen bir
ÖNERİ olarak durur ("İş emri planı: 20.11.2026 — uygula").

**MİRAS SATIRA YAZILMAZ, PENCEREYE DÜŞER.** Öneriler `SaleRow`da ayrı alanlardır
(`jobDeliveryDate` · `jobWorkshopExitDate` · `jobShippingAddress`); tablo ve
müşteriye giden İş Listesi bunları OKUMAZ. Okusaydı belge, kimsenin girmediği
bir termini teyit edilmiş gibi basardı — fiyatsızlık kuralının aynı mantığı.

**Kapsam açılır listedir ama liste KAPALI DEĞİLDİR** (`SALE_SCOPES`,
lib/tags.ts). Sabit seçenekler devralınan verideki gerçek kapsamlardan
çıkarıldı; kayıttaki değer listede yoksa pencere onu KENDİ seçeneği olarak
korur ve "Diğer" ile serbest metin yazılabilir. Aksi hâlde eski satırlardaki
ayrıntılı kapsam metinleri ilk kaydetmede sessizce silinirdi. Her kapsam
kendi pastel tonunu taşır (sık kullanılanlar sabit, diğerleri metinden).

**SÖZLEŞME PDF'İ BURADADIR, İŞLER'DE DEĞİL** (kullanıcı kararı, 18.08.2026).
İşler bölümü herkese açıldı ve sözleşme herkese açılmamalıydı; yükleme yeri
Satış Bilgisi penceresi, kayıt `job_contracts` tablosu, düğme ise listede ürün
adının hemen yanındaki dar sütundur.

**KAYIT İŞ EMRİ BAŞINADIR, kalem başına değil** (kullanıcının seçimi): bir
sözleşme işin tamamını kapsar ve dokuz kalemli bir işte aynı PDF'i dokuz kez
yüklemek gerekmez — aynı işin bütün satırları aynı düğmeyi gösterir ve pencere
bunu "İş emri 0057 için" diye SÖYLER. Anahtar `job_id`dir.

**GİZLİLİK ARAYÜZDE DEĞİL RLS'TEDİR.** Dosya `jobs` üzerinde bırakılıp yalnız
ekrandan gizlenseydi hiçbir şey gizlenmezdi: `jobs` herkese okunur, yani yol da
okunur ve imzalı bağlantı oradan üretilebilirdi. `job_contracts` ve `contracts`
bucket'ı `can_see_sales()` ile kesilir — imzalı bağlantı uygulama katmanındaki
rolü TAŞIMAZ, bu yüzden bucket'ın kendisi de kapatıldı (personel/teknik resim
kalıbı).

**SÖZLEŞME "KAYDET"İ BEKLEMEZ.** Yükleme anında yazılır ve pencereyi "Vazgeç"
ile kapatmak yüklenmiş bir PDF'i geri almaz: dosya iş emrine bağlıdır, o
satırın ticari kaydına değil. Kayıt tutmazsa ekrandaki iyimser değer GERİ
ALINIR — kullanıcı yüklenmiş sandığı bir dosyayla kalmamalıdır. Üzerine yazılan
eski nesne depodan silinir (yola ulaşacak ikinci bir kayıt yoktur).

**GÜNCEL İŞ LİSTESİ aynı satırlardan çıkar ama FİYATSIZDIR** (`sales/
is-listesi` ucu + `lib/pdf/job-list.tsx`). Teklif isteyen müşteri "başka
neler yaptınız" diye sorar; belge o sorunun cevabıdır ve teklif ekinde
rakip firmalara da ulaşabilir. Fiyatsızlık bir "unutmayalım" notu değil
TİP SEVİYESİNDE bir engeldir: `JobListRow` birim fiyat, tutar, para birimi
ve kur alanı TAŞIMAZ; koruma testi üretilen PDF'in METNİNİ de tarar
(`__tests__/job-list.test.tsx` — ham bayt değil, `unpdf` ile çözülmüş
metin; sıkıştırılmış akışlar rastgele "$" üretiyordu).

Sorgu ve eşleme `sales/data.ts`tedir: EKRAN İLE BELGE AYNI YERDEN OKUR.
İki sorgu yazılsaydı müşteriye giden liste ile ekrandaki tablo sessizce
ayrışırdı (İş Takibi'nde bir kez yaşandı, bkz. `worklog/filters.ts`).
Belge A4 YATAYdır ve TEK BİR ÇİZELGEDİR; sıra İŞ NUMARASINA GÖRE
BÜYÜKTEN KÜÇÜĞEDİR (en yeni iş üstte) ve yıl bantları bunun kendiliğinden
çıkan sonucudur. SIRALAMA BELGENİN İŞİDİR, indirme ucunun değil — iki
tüketici ayrı sıralarsa aynı belge iki düzende basılırdı. Müşteri
sütununda defterdeki KISALTMA görünür (resmî unvan yatay A4'te bile üç
satıra sarıyordu). Belgenin sürümü YOKTUR, DÖNEMİ vardır
(`ORC-IL-2026-08`): iş listesi bir projenin revizyonu değil firmanın o
ayki fotoğrafıdır.

**BELGE FİRMANIN TOPLAM İŞ HACMİNİ RAKAMLA AÇIKLAMAZ** (kullanıcı kararı,
12.08.2026). Sayfa başındaki ölçü şeridi ("88 iş kalemi · 23 müşteri ·
1.134 ton") ve sondaki "Müşteri Referansları" kapanış sayfası (müşteri
başına adet ve tonaj) ikisi de KALDIRILDI. Çizelgenin kendisi aynı bilgiyi
kanıtla verir; özetlemesi gerekmez. Koruma testi kapanış sayfasının geri
gelmediğini de doğrular.
