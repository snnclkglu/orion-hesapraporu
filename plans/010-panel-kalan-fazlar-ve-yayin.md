# Panel — kalan fazlar, gerçek mobil kabul ve yayın

Tarih: 12 Eylül 2026. Kullanıcı talebi: kalan fazları planla, kullanıcıdan gerekenleri netleştir, gerekli hazırlıkları yap.

Bu plan 007 ve 008'in açık kabul/yayın adımlarını birleştirir. Önceki geliştirmeler tekrar yapılmaz. 008'deki ilk plan tablosunun tarihsel durumlarından değil, bölüm 7'deki gerçekleşme kaydından devam edilir.

## Başlangıç durumu

- Profil, avatar, kişisel geri bildirim geçmişi ve Yönetim/Geri Bildirimler uygulandı.
- Ekip yönetimi, üyelik araması, ekip havuzu, kişiye özel görev ve mevcut rol sınırları uygulandı.
- Mobil filtreler, kayıtlı görünümler, hafta/geciken, tekrar, kontrol listeleri, beklenen görevler ve API altyapısı uygulandı.
- Supabase görsel geçidi kuruldu; yükleme için yerel geniş yetkili proje anahtarı alınmadı. AI/e-posta bağlantısı kullanıcıya ait.
- Önceki kontrolde 38 hedefli test, 56 ekran kontrolü, sekiz yeni görev akışı, yedi eski etkileşim ve üretim derlemesi geçti. Bunlar tarihli kanıttır; sonraki değişikliklerde ilgili kontroller yenilenir.
- Mevcut Vercel proje bağlantısı yerelde bulundu. Bunun bulunması son arayüzün yayımlandığını veya dağıtım oturumunun geçerli olduğunu kanıtlamaz.
- Açık işler: gerçek fotoğrafla uçtan uca kullanım; fiziksel mobil/erişilebilirlik; bakım zamanlaması; ekip pilotu; uyumlu arayüz yayını.

## Sıra ve sorumluluk

| Faz | İş | Sorumlu | Bağımlılık | Bitiş kanıtı |
| --- | --- | --- | --- | --- |
| K0 | Yayın adayı ve deneme ortamı | Ajan | Yok | Telefonda açılabilen, oturum korumalı adres ve sürüm kaydı |
| KK0 | Ortam / değişiklik kapsamı kontrolü | Ajan | K0 | Doğru proje, oturum, dosya geçidi ve sürüm uyumu |
| K1 | Gerçek fotoğraf ve geri bildirim kabulü | Kullanıcı + ajan | KK0 | Sahip ve yönetici hesaplarında doğrulanmış akış |
| KK1 | Görsel ve gizlilik kontrolü | Ajan | K1 | Hata/retry, erişim ve kayıt bütünlüğü sonuçları |
| K2 | Fiziksel mobil ve erişilebilirlik | Kullanıcı/pilot üyesi + ajan | KK0; görseller için K1 | Cihaz/tarayıcı bazlı kabul formu |
| KK2 | Mobil düzeltme ve tekrar | Ajan + aynı cihazı kullanan kişi | K2 | Sorunların aynı senaryoda kapatılması |
| K3 | Otomatik bakım hazırlığı | Ajan | KK0; K1 ile paralel | Sınırlı bakım işi, aday raporu, tekrar güvenliği |
| KK3 | Bakım güvenliği ve işletim | Ajan | K3 | Aktif/kesinleşmiş dosyalar korunmuş, çalıştırma kaydı |
| K4 | Küçük ekip pilotu | Kullanıcı + seçilen ekip üyesi | KK1, KK2 | Gerçek iş akışlarının kabulü ve kısa bulgu listesi |
| KK4 | Yayına hazır olma kontrolü | Ajan | KK3, K4 | Kritik açık yok; uyumlu geri dönüş ve son testler |
| K5 | Üretim arayüzünün yayını | Ajan | KK4 | Yayın adresi, sürüm ve yayın sonrası doğrulama |
| KK5 | Yayın sonrası kabul | Kullanıcı + ajan | K5 | Gerçek kullanımda giriş/görev/görsel/ekip doğrulaması |
| K6 | İleri özelliklerin seçimi | Kullanıcı + ajan | Pilot bulguları | Hangi özellik neden gerekli, kapsam ve ayrı kabul ölçütü |

K0 ve K3 hazırlıkları cihaz yanıtı beklemeden ilerleyebilir. Fiziksel cihaz görmeden K2 tamamlandı sayılmaz. Faz başına kesin süre vaat edilmez; K4 için başlangıç önerisi iki iş günüdür, yeterli gerçek senaryo oluşmadıysa pilot uzatılır.

## K0 — Yayın adayı ve telefondan erişim

1. Çalışma klasöründeki Panel/profil/ekip değişiklikleri ve diğer eşzamanlı çalışmalar ayrıştırılır; mevcut kullanıcı değişiklikleri geri alınmaz.
2. Denenecek sürümün kapsamı kaydedilir. Aynı klasördeki başka çalışmalar fark edilmeden yayına taşınmaz; gerekiyorsa ayrı yayın hazırlığı yapılır.
3. Mevcut Vercel projesinin dağıtım durumu, hedef adresleri ve oturum koruması salt okunur incelenir. Geçerli erişim varsa yeniden anahtar istenmez.
4. Telefonda kullanılabilecek deneme adresi hazırlanır. Telefonun `localhost:3000` adresi bu bilgisayarı göstermez; kullanıcıya çalışmayacak bir yerel adres verilmez.
5. İlk görsel/yerleşim denemesinde önizleme verisi ile gerçek verinin ayrımı açık tutulur. Gerçek hesapla kabul için ilgili oturum ve kayıt sınırları ayrıca doğrulanır.
6. Görsel geçidi, özel bucket'lar ve uygulama ayarları aynı Supabase projesini göstermelidir. Gizli anahtar değerleri rapora veya sohbete yazılmaz.

**KK0:** URL telefondan açılmalı; oturumsuz erişim gerekli yerde girişe gitmeli; doğru kullanıcı/rol görünmeli; test edilen sürüm bilinmeli. Ortam kurulumu için henüz yeni hizmet veya sunucu satın alma ihtiyacı tespit edilmedi.

## K1 — Gerçek fotoğraf ve geri bildirim

Kullanıcı fotoğrafını doğrudan Profilim ekranından seçer; sohbet üzerinden göndermesi gerekmez. Gerçek olmayan üretim profili, ekip veya geri bildirim metni ajan tarafından uydurulmaz.

| Senaryo | Beklenen sonuç |
| --- | --- |
| Galeriden fotoğraf seç, kırp ve kaydet | Önizleme ile kaydedilen fotoğraf aynı; yön doğru; hata açık |
| Sayfayı yenile / çıkıp tekrar gir | Fotoğraf kalır; sağ üst küçük avatar ve Profilim tutarlı |
| Fotoğrafı değiştir | Yeni kayıt kesinleşmeden eski fotoğraf kaybolmaz |
| Fotoğrafı kaldır | Profilde baş harfler görünür; aktif referans doğru temizlenir |
| İzin verilmeyen veya sınırı aşan dosya | Kullanıcı anlaşılır hata görür; profil bozulmaz |
| Yükleme sırasında bağlantı kes | Kaydetme durumu doğru; yeniden deneme ikinci gönderi üretmez |
| Kullanıcı gerçek bir gözlemi görsel ekleyerek gönderir | Kendi Gönderilerim listesinde bir kayıt oluşur |
| Yönetici aynı gönderiyi açar | Yönetim/Geri Bildirimler listesinde içerik/ek görünür |
| Başka normal kullanıcı aynı kaydı arar/açar | Başkasının gönderisi ve eki görünmez |

**KK1:** Dosyanın yalnız yüklenmiş olması başarı sayılmaz; profil/geri bildirim kaydına bağlanması ve yetkili kişide açılması doğrulanır. Kesinleşmiş geri bildirim metni/eki değiştirilmez. Pilot kaydı yönetime gerçek kullanım geri bildirimi olarak gönderilir; gönderme eylemini kullanıcı yapar.

## K2 — Fiziksel mobil kabul

Kullanıcı tercihi: **önce iPhone + Safari**. Model/iOS sürümü bekleniyor. Safari motoruyla otomatik kontroller ön hazırlıktır; fiziksel iPhone kabulünün yerine geçmez. Android + Chrome ikinci sırada, tablet varsa eklenir. Bir platform henüz yoksa o satır açık kalır.

Her cihazda model, işletim sistemi, tarayıcı sürümü, tarih ve denenen sürüm/adres kaydedilir.

1. **Gezinme:** alt bar, sağ üst avatar, geri hareketi, görevden listeye dönüş; tarayıcı çubukları açık/kapalı.
2. **Hızlı görev:** başlıkla ekleme, iş kodu seçimi, kişiye atama, tarih, tek dokunuşla tamamlama ve geri alma.
3. **Klavye:** uzun başlık/yorum, tarih ve kişi seçicisi; odak kaybı, gereksiz yakınlaştırma, görünmeyen kaydetme düğmesi olmamalı.
4. **Liste:** filtre alt paneli, kayıtlı görünüm, hafta/geciken, uzun kişi/ekip adı, sıfır sonuç ve sayfalama.
5. **Görev detayı:** kontrol adımı, tekrar, beklenen görev, yorum ve ek; son eylem alt bar veya klavye altında kalmamalı.
6. **Profil/geri bildirim:** galeri, kırpma, gönderme, geri dönüşte taslak ve hata mesajı.
7. **Ağ:** yavaş bağlantı, kısa kesinti ve geri dönüş; başarı olmuş gibi davranmama, aynı yazmayı çoğaltmama.
8. **Erişilebilirlik:** büyük metin, açık/koyu tema, VoiceOver/TalkBack ile ad/rol/durum, mantıklı odak sırası ve modal kapanışı.
9. **Yön ve güvenli alan:** dikey/yatay; çentik, alt hareket çubuğu ve ana ekrandan açılış mümkünse ayrıca denenir.

**KK2:** Veri kaybı, özel verinin açılması, kaydetmenin engellenmesi, ana içerikte yatay taşma veya erişilemeyen temel eylem yayın öncesi düzeltilir. Kozmetik bulgular somut ekran/etkiyle sıralanır. Dokunma hedefi ve okunabilirlik yalnız ekran görüntüsünden kabul edilmez.

## K3 — Supabase içinde sınırlı bakım

Amaç, eski referans dışı yüklemelerin gereksiz depolama tüketmesini önlemektir. Kullanıcının içerik saklama süresini değiştiren toplu silme projesi değildir.

1. Mevcut aday sorgusu salt okunur incelenir; sadece sayı/yaş/bucket dağılımı raporlanır.
2. Yeni geniş anahtar indirmeden, mevcut Supabase ortamında çalışacak sınırlı bakım yolu hazırlanır. Otomatik iş ile kullanıcı görsel yükleme geçidi ayrı tutulur.
3. İlk çalışma yalnız aday raporu üretir. Silme, mevcut 25 saat ve referans kuralları testlerle doğrulanınca etkinleştirilir.
4. İş başına en fazla 500 nesne; aynı anda ikinci çalışma engellenir; başarısız iş yeniden denenebilir.
5. Aktif avatar, kesinleşmiş gönderi eki ve süresi dolmamış taslak korunur. Seçim ile silme arasındaki yarışlar ayrıca sınanır.
6. Dosya silinmeden taslak satırı silinmez. Storage API kullanılır; Storage tablosundan kör satır silme yapılmaz.
7. Başlangıç önerisi günlük bir bakım çalışmasıdır. Kesin saat mevcut Supabase zamanlayıcı ve işletim koşulları doğrulanınca belirlenir.
8. Çalışma zamanı, aday/silinen/başarısız sayısı kaydedilir; görsel içerikleri ve anahtarlar loglanmaz. Hata görünür olur; iş kolayca durdurulabilir.

**KK3:** Referanslı kayıtların korunduğu, kesintide tutarlı kaldığı ve ikinci çalışmanın zarar vermediği gösterilmelidir. Yeni fonksiyon kurulumu sırasında erişim engeli çıkarsa somut hazırlanan işlem ve engel kullanıcıya açıklanır; eski anahtar talebi tekrar edilmez.

## K4 — Küçük ekip pilotu

Başlangıç için kullanıcı + bir gerçek ekip üyesi yeterlidir; erişim sınırı kontrolünde ekip dışından ikinci normal kullanıcı gerekebilir. Uygulama rolleri deneme kolaylığı için yükseltilmez.

- Kullanıcının belirttiği gerçek iş koduyla bir gerçek görev yürütülür.
- Ekip havuzundaki atamasız iş üyeye atanır; aynı kayıt ekipte ve kişinin Görevlerim ekranında görünür.
- Kişiye özel iş ekipte görünmez; ekip dışındaki normal kullanıcı erişemez.
- Açıklama, yorum, dosya, tarih ve tamamlama akışı kullanılır.
- Gerçekten tekrar eden bir iş varsa tekrar kuralı denenir; deneme uğruna sahte iş üretilmez.
- Bir bekleme ilişkisi ve uygun bir kontrol listesi gerçek işte kullanılır.
- Kullanıcı zorlandığı noktayı uygulamanın kendi geri bildirim alanından yönetime iletir.

**KK4:** Sonradan düzeltilecek belirsiz kayıtlar yerine her bulgu için senaryo, beklenen/gerçek sonuç, önem ve tekrar sonucu kaydedilir. Yeni zorunlu veri yükü, gereksiz tıklama ve ekran anlaşılabilirliği ayrıca değerlendirilir. Son değişikliklerle ilgili testler ve üretim derlemesi yenilenir.

## K5 — Yayın ve geri dönüş

1. KK4'te doğrulanan sürüm mevcut yayın ortamına alınır; üretim adresi ve sürüm kaydı tutulur.
2. Yeni şema zaten uygulanmış olduğu için, özel görev kapsamını ve yeni alanları okuyabilen uyumlu sürüm kullanılır.
3. Giriş, kişisel/ekip listesi, görev yazma, fotoğraf/ek ve yönetim geri bildirim erişimi doğrulanır.
4. Sorunda önce etkili yeni işlem durdurulur veya uyumlu önceki arayüz sürümüne dönülür. Şema/gerçek görev/geçmiş silme geri dönüş yöntemi değildir.
5. **KK5:** kullanıcı günlük akışı doğrular; yayın sırasında yeni hata varsa aynı sürümde yeniden üretilip düzeltilir. Sürekli izleme kurulmuş gibi söz verilmez; gerekiyorsa izleme mekanizması ayrıca kurulur.

## K6 — İleri özellikler için karar

| Aday | Eklemek için gerekli kanıt | İlk kapsam |
| --- | --- | --- |
| Gerçek alt görev | Aynı işte farklı sorumlu/termin gereken adımlar | Üst görev ilişkisi; görünürlük mirası ve ilerleme kuralları |
| Ajandadan hızlı tarih değiştirme | Pilot kullanıcıları tarih değiştirmede zorlanıyor | Mobilde erişilebilir tarih eylemi; masaüstünde sürükleme isteğe bağlı |
| Çevrimdışı taslak | Sahada bağlantı sık kesiliyor | Önce cihazda güvenli, kullanıcıya bağlı taslak; sürüm çakışması ve çıkışta temizleme |
| Kapasite görünümü | İş süreleri/kapasite verisi gerçekten tutuluyor | Görev adedini çalışma saati varsaymadan ölçüm |
| Çoklu pano | Aynı işin birkaç panoda tek kayıt olarak görünmesi gerekli | Kopyalama yerine ilişki; en dar erişim sınırı açıkça tasarlanır |

Bu adaylar mevcut sürümün kabulünü engellemez. Grokbot/e-posta analizini ajan geliştirmeyecek; kullanıcı bağlantısına API sözleşmesi ve güvenli deneme senaryolarıyla destek verilecek.

## Kullanıcıdan gerekenler

**Şimdi:** kullanılabilecek telefon modeli/tarayıcı; pilot kişi/ekip ve varsa gerçek iş kodu. Bunlar kısa metinle bildirilebilir. Diğer cihaz yoksa mevcut cihazla başlanır; eksik platform açık kaydedilir.

**Deneme adresi hazır olduğunda:** kullanıcı Profilim'de kendi seçtiği fotoğrafı yükler ve gerçekten karşılaştığı bir gözlemi geri bildirim olarak gönderir. Fotoğrafın veya şifrenin sohbete gönderilmesi gerekmez.

**Yayın öncesinde:** pilotta gözlenen bir engel olup olmadığı ve varsa işin kesilmemesi gereken saatler bildirilir. Yeni teknik erişim gereksinimi ortaya çıkarsa önce mevcut bağlantı denenir; kullanıcıdan yalnız eksik olan bilgi istenir.

## Kabul kaydı şablonu

| Tarih / sürüm | Cihaz / tarayıcı | Kullanım senaryosu | Beklenen | Gözlenen | Sonuç | Düzeltme / tekrar |
| --- | --- | --- | --- | --- | --- | --- |
| Henüz test edilmedi | Kullanıcı yanıtı bekleniyor | K1–K2 senaryoları | Yukarıdaki ölçütler | Ölçülmedi | Açık | — |

Bu turda yapılan: kalan faz envanteri, mevcut yayın bağlantısının varlık kontrolü, sıra/bağımlılık/kabul ölçütleri ve kullanıcı ihtiyaçlarının hazırlanması. Canlı bakım, yeni dağıtım ve fiziksel test bu plan yazımı sırasında yapılmadı.

### iPhone ön hazırlığı — kullanıcı yönlendirmesi sonrası

Safari/WebKit test motoru projenin geçici araç klasörüne kuruldu. `node scripts/task-workflow-mobile-check.cjs --webkit` ile 375/390/430px × açık/koyu tema = altı görev akışı geçti: filtre, görünüm kaydetme, haftalık ajanda, kontrol listesi, tekrar ayarı ve yorum erişimi. Konsol hatası ve ana içerik taşması saptanmadı. Üretimde olmayan geliştirme araçlarının düğmesi testte gizlendi; uygulama hataları yakalanmaya devam etti.

Kanıt: `artifacts/task-workflow-webkit/mobile-checks.json` ve aynı klasördeki ekran görüntüleri. Bu, Windows üzerinde çalışan WebKit ön kontrolüdür; fiziksel iPhone, gerçek iOS Safari, galeri ve klavye kabulü **değildir**. K2 açık kalır. Test senaryosu Safari motoruna göre ayrı çıktı üretir; önceki Chromium kanıtları korunur.

## Uygulama kaydı — 12 Eylül 2026, kalan fazların uygulanması

| Faz | Gerçekleşen | Açık kalan |
| --- | --- | --- |
| K0 / KK0 | Kaynak değişiklik envanteri ve parmak izleri çıkarıldı. Yerel uygulamanın doğru Supabase projesini kullandığı doğrulandı. Vercel proje bağlantısı ve oturumu kontrol edildi. | Vercel oturumu yetkisiz; kullanıcıdan bu bilgisayarda giriş istendi. Telefon deneme URL'si henüz yayımlanmadı. Kayıtlı üretim ortam dosyasındaki değer doğrulanabilir olmadığından üretim ortamı uyumu iddia edilmedi. |
| K1 / KK1 | Fotoğraf kırpma ve form akışları Windows WebKit önizlemesinde doğrulandı; veritabanı sahip/yönetici erişim testleri geçti. | Kullanıcının kendi fotoğrafı, gerçek gönderi ve farklı hesaplarda uçtan uca kabul. |
| K2 / KK2 | Profil, geri bildirim, ekip ve Panel için 375/390/430/844px × iki tema = 32 ekran kontrolü geçti. 844×390 yatay görünüm dahil. Yedi etkileşim; kırpma, üye arama, gönderi formu, kişiye özel görev ve %200 metin testi geçti. | Fiziksel iPhone/Safari, gerçek galeri/klavye/VoiceOver. Cihaz modeli/iOS bekleniyor. |
| K3 | Ayrı dar Edge çalışanı, kurulum/işletim betikleri, 15 dakikalık tek çalışma kiralaması, 50'lik yeniden kontrol, hata kayıtları ve Yönetim/Geri Bildirimler durum alanı hazırlandı. `20260912000015` veritabanına uygulandı. | Fonksiyon kaynağı gönderimi otomatik onay denetimince durduruldu; bu ayrı kaynak/hedef için açık onay istendi. Edge dağıtımı ve günlük zamanlama **yapılmadı**. |
| KK3 | Sekiz çalışan testi; aktif avatar, karışık yaşlı iki boyut, kesinleşmiş/güncel/eski taslak, yetki, tekrar ve kiralama DB kontrolleri geçti. Test transaction'ı geri alındı. Canlı aday sorgusu sıfır döndü. | Kurulum sonrası gerçek silmesiz uzaktan çalıştırma ve zamanlayıcının sonucu. |
| K4 / KK4 | iPhone kabul ve pilot adımları, yayın engeli ölçütleri ve uyumlu geri dönüş hazırlandı. | Gerçek pilot üye/iş kodu, cihaz kabulü ve pilot bulguları. |
| K5 / KK5 | Son arayüzün izole üretim derlemesi geçti; kaynak envanteri yayından ayrı tutuldu. | Pilot kabulünden sonra yayın ve gerçek kullanım doğrulaması. |
| K6 | Önceki koşullu seçenekler korunuyor. | Pilot ihtiyacı olmadan yeni veri alanları/alt görev/kapasite özellikleri eklenmedi. |

### Yapılan düzeltmeler

- Yeni profil fotoğrafının iki boyutu da son bir saatte yüklenmiş olmalı. Eski küçük fotoğrafın yeni büyük fotoğrafla tekrar bağlanması engellendi. Aynı klasörde yeni dosya varsa bakım eski kardeş dosyayı da korur.
- Eski yerel geniş anahtarlı bakım komutu kapatıldı. Yeni çalışan Supabase içinde çalışır; yalnız bakım için üretilen dar anahtar Edge/Vault'ta saklanacak şekilde hazırlandı.
- Önizleme profil kaydı gereksiz sunucu yenilemesi yapmıyor. Safari etkileşim betikleri sayfa etkileşime hazır olduktan sonra form dolduruyor; üretim davranışı test beklemeleriyle değiştirilmedi.
- Yönetici son bakım zamanı/sayılarını görebiliyor; hata veya gecikme uyarısı ayrı, geri bildirim listesi kullanılabilir kalıyor. Bu arayüz henüz üretime dağıtılmadı.

### Güncel kanıtlar

- `artifacts/task-release/targeted-tests.json`: görev/API/hesap alanlarında **46 test geçti**, başarısız yok.
- `artifacts/account-mobile-webkit/report.json`: **32 ekran kontrolü**, taşma/sayfa hatası yok. Aynı klasörde güncel ekran görüntüleri.
- `artifacts/account-mobile-webkit/interaction-report.json`: **yedi önizleme etkileşimi**, sayfa hatası yok. Gerçek fotoğraf kaydı/gönderim değildir.
- `scripts/task-db.py test`: görev, hesap, akış ve bakım şeması/erişim testleri geçti; tüm test yazmaları geri alındı.
- `artifacts/task-release/build.log`: izole üretim derlemesi başarılı. İlk sınırlı ağ denemesi Google Fonts indirmesinde durdu; ağ erişimiyle yeniden çalıştırma geçti.
- Değişen arayüz/test dosyalarında ESLint geçti; `git diff --check` hata vermedi (satır sonu uyarıları var).
- Son canlı okumada `job_tasks=19`, uyumluluk `user_todos=19`; bakım adayı yok. Bakım dosya silmedi.
- `artifacts/task-release/source-manifest.json`: yerel kaynak özeti; dağıtım kanıtı değildir. CAD gibi diğer eşzamanlı değişiklikler ayrıca işaretlendi; otomatik olarak üretime taşınmadı.

İşletim: `docs/account-maintenance.md`. Kullanıcıyla uygulanacak kısa cihaz/pilot formu: `docs/panel-iphone-kabul.md`.

**Sıradaki gerekli iki adım:** Vercel hesabında yerel oturumun açılması; yeni bakım fonksiyonunun mevcut Supabase projesine kurulumu ve günlük sınırlı bakım için bekleyen onayın yanıtlanması. Fotoğraf/şifre/anahtar sohbete istenmedi. Bu iki yanıt beklenirken bağımsız yerel hazırlık ve kontroller tamamlandı; fiziksel kabul veya yeni dağıtım yapılmış gibi gösterilmedi.

## Vercel bağlantısı ve iPhone deneme yayını — 12 Eylül, sonraki uygulama

Kullanıcı tarayıcıdaki resmi Vercel CLI bağlantısını onayladı. Mevcut `orion-hesapraporu` projesine erişim doğrulandı; yeni proje açılmadı. **K0'ın deneme yayını adımı tamamlandı.** Fiziksel telefon kabulü hâlâ kullanıcıyla yapılacak.

Güncel deneme adresi: https://orion-hesapraporu-qhtzqm7e6-scolakoglu-9449s-projects.vercel.app

- Dağıtım: `dpl_HBVR2yJuzGnGdJ64YFZatvFhDYjQ`, Vercel durumu **Ready**, hedef **Preview**. Üretim adresi değiştirilmedi.
- Paket: `artifacts/task-release/preview-package.json`. İlk başarılı paketin sabit kopyası üzerine yalnız dört fotoğraf aktarım dosyası eklenmiştir. Eşzamanlı CAD değişikliği ikinci adayda tip hatası oluşturduğu için o aday kullanılmadı; çalışma klasöründeki CAD koduna müdahale edilmedi.
- Paket yalnız uygulama kaynakları ve gerekli statik/katalog varlıklarını içerir. Ortam dosyaları, testler ve Supabase Edge kaynakları gönderilmedi. Bakım fonksiyonu kurulumu için bekleyen onay bu Vercel giriş onayıyla birleştirilmedi.
- Tarayıcıda gerçek yayın açıldı ve ORION giriş ekranı görüldü. Panel/Profilim/Yönetim oturumsuz isteği girişe yönlendiriyor; yayın güvenlik başlığındaki Supabase hedefi mevcut projeyle eşleşiyor. Kısayol manifesti erişilebilir.
- Ajan uçları bu deneme ortamında `Agent API yapılandırılmamış.` yanıtıyla kapalıdır; Grokbot bağlantısı kullanıcı tarafından daha sonra yapılandırılacaktır. Bu bir başarılı ajan yazma testi değildir.

### Büyük iPhone fotoğrafı düzeltmesi

Vercel'in [4,5 MB istek sınırı](https://vercel.com/docs/functions/limitations#request-body-size) nedeniyle ham 10 MB görseli Server Action'a vermek yeterli değildi; Next'in gövde sınırını artırmak barındırma sınırını kaldırmaz. 3,5 MB üstü profil/geri bildirim görselleri artık cihazda en fazla 1800px'e küçültülüyor. Tarayıcının açamadığı büyük HEIC için mevcut libheif paketinin tarayıcı sürümü dinamik yükleniyor. Sunucu yeniden doğrulama/kodlama ve mevcut Supabase geçidi korunuyor.

`scripts/account-large-image-check.cjs` Chromium ve Windows WebKit'te geçti: 7.214.032 bayt PNG yaklaşık 1,26 MB'a; 4.718.114 bayt HEIC 320.080 bayta küçüldü. Fotoğraf kırpma/kullanma akışı da denendi. HEIC örneği geçerli bir `free` kutusuyla büyük dosya senaryosuna genişletildi; üretim profili veya depo dosyası oluşturulmadı. Kanıtlar: `large-images-chromium.json`, `large-images-webkit.json`, `build-image-transport.log` (hepsi `artifacts/task-release/` içinde).

Kullanıcı için QR: `artifacts/task-release/iphone-preview-qr.png`. Sıradaki adım bu adresi iPhone Safari'de açıp ORION hesabıyla giriş yapmak, Profilim fotoğraf ve günlük görev akışlarını denemek. Vercel koruması hesap isterse aynı Vercel hesabıyla giriş yapılır. Gerçek görev/kayıtlar mevcut Supabase verisidir; önizleme adresi ayrı bir sahte veri tabanı anlamına gelmez.
