# Hızlı otomatik seçim — ikinci denetim ve tamamlama fazları

Tarih: 09.09.2026 · Denetlenen: `3ed89a4` üzerine çalışma ağacındaki seçim 1.0.0 uygulaması

**Sonraki uygulama:** Aşağıdaki bulgular 1.0.0 denetiminin tarihsel kaydıdır. B1–B4 düzeltmeleri ve ek fazların gerçek kapanış sınırları [1.1.0 tamamlama kaydında](HIZLI_OTOMATIK_SECIM_TAMAMLAMA_DURUMU.md) yer alır. Denetim betiği artık düzeltmeleri assert ederek `gap-regressions-verified.json` üretir.

## Karar

**Ek çalışma gerekiyor.** Ortak editör, hesap motoru, kullanıcı tarafından başlatılan seçim, kayıt/iptal/geri alma ve teklif aktarımı altyapısı var. Ancak “yalnız teknik özellikler ve markaları vererek bütün bağlı ekipmanları güvenilir biçimde seçme” hedefi henüz tamamlanmış değil. Eksikler yalnız üretici belgesi bekleyen alanlardan oluşmuyor; bu denetimde yeniden üretilebilen yazılım hataları da bulundu.

Önceki [uygulama ve doğrulama kaydı](HIZLI_OTOMATIK_SECIM_UYGULAMA.md) testlerin o tarihte kapsadığı davranışları anlatır. Testlerin geçmesi aşağıdaki senaryoların doğrulandığı anlamına gelmez. Bu belge ilk plandaki açık çıkış ölçütlerini ve yeni bulunan hataları **10–15 numaralı altı tamamlama fazında** toplar; mevcut sistemi baştan yazmayı önermiyor.

## Denetim yöntemi ve kanıt sınırı

- Saf seçim, teknik özellik eşleme, teklif aktarımı, kopyalama, bağlı raporu açma/yükleme, SQL bağlantısı, fiziksel aile filtreleri ve mevcut kabul testleri incelendi.
- `scripts/audit-auto-selection-gaps.ts` çalıştırılarak aşağıdaki teklif, kopya, arama, boş girdi ve kanca senaryoları yeniden üretildi. Çıktı: `tmp/auto-selection/review-gaps.json`.
- Arama deneyindeki `AUDIT TEST / GB-*` ürünleri **sentetik test varyantlarıdır**. Gerçek bir üretici ürününün uygunluğu hakkında sonuç çıkarılmaz. Amaç, aynı geçerli kombinasyonun aday kümesine göre kaçırıldığını göstermektir.
- Teklif aktarımı ve kanca/arama sonuçları yerel fonksiyon çağrılarıyla doğrulandı. Kopya nesnesi yerelde doğrulandı; yeni revizyonun veritabanı bağlantısının kaybolması kod/SQL akışından tespit edildi. Bu turda oturumlu tarayıcı üzerinden canlı teklif kopyalama deneyi yapılmadı.
- Bu denetimde üretim davranışı değiştirilmedi; canlı veritabanına yazılmadı ve yayın yapılmadı. Önceki 97 başarılı testin tümü yeniden koşturulmadı; aşağıdaki yeni karşı örnekler çalıştırıldı.
- Denetim betiğinin kendi bağımlılıklarıyla TypeScript kontrolü geçti (`npx tsc --noEmit -p tmp/auto-selection/tsconfig.audit.json`). Genel `npx tsc --noEmit --incremental` kontrolünde `.next/types` ve `.next/dev/types` içindeki üretilmiş `/jobs/[id]` rota tanımları arasında üç hata kaldı. Bu nedenle bu tur için genel tip kontrolü başarılı denemez; tek ve güncel rota üretimiyle temiz doğrulama Faz 15'e dahildir. Bu hataların sebebinin otomatik seçim kodu olduğu gösterilmiş değildir.
- Yeni bir standart katsayısı veya hesap formülü eklenmedi. Bulgular kod davranışıyla ilgilidir. Açık normatif kapsamlar tamamlanırken kaynak standardın maddesi ve üretici çalışma koşulları ayrıca doğrulanmalıdır.

## Öncelikli bulgular

### B1 — Teklif teknik özellikleri değişince eski hesap aktarılabiliyor · P1

Yerel örnekte teklif kapasitesi **25 t**, kaynak hesap kapasitesi **10 t** iken eski hesabın **7,5 kW** motor bilgisi teklif satırına aktarıldı. Kapasite farkına ilişkin bir aktarım engeli yoktu. Burada 7,5 kW'ın 25 t için yeterli/yetersiz olduğu ayrıca hesaplanmış değildir; hata, hesabın başka bir teknik talebe ait olmasının fark edilmemesidir.

`applyReportToOfferItem` kaynak girdilerinden ekipman satırlarını oluşturuyor; hedef teklifin güncel teknik talebiyle karşılaştırmıyor. Arayüzdeki kontrol kalem kimliği ve kaydedilmemiş hesap değişikliğine bakıyor; aynı kalemin kapasite/açıklık/hız değişikliği bu kontrolden geçiyor. `create_offer_item_calculation` mevcut bağ varsa yeni hazırlanmış teknik girdileri kullanmadan eski bağı döndürüyor. Bu nedenle yalnız aktarım düğmesini düzeltmek yeterli değil; yeniden açma da ele alınmalı.

Kaynaklar: `src/lib/auto-selection/offer-bridge.ts:98`, `src/components/offer-calculation.tsx:38`, `src/app/(app)/offers/calculation-actions.ts:22`, `supabase/migrations/20260908000011_auto_selection.sql:69`.

### B2 — Teknik tablodaki kanca tipi seçim şartına dönüşmüyor · P1

Teknik özelliklerde **DIN 15402 Çift Ağız Kanca** seçildi. Sonuçta modül standardı **DIN 15401**, seçilen ürün **DIN 15401 Nr 5** kaldı; kanca tipi uyuşmazlığına ilişkin madde üretilmedi.

Katalog uyumluluğu `specs.hookType` yerine modülün mevcut `selections.hookStandard` değerini esas alıyor. Yeni iş şablonu DIN 15401 içeriyor. Teknik özellikten başlayan bu akışta kullanıcının talebi modüle taşınmalı; çelişen kilitli/manuel alan varsa açık çatışma olarak gösterilmeli. Teknik talebe uygun katalog ürünü yoksa başka kanca standardına sessiz geçiş yapılmamalı.

Kaynaklar: `src/lib/auto-selection/compatibility.ts:11`, `src/lib/calc/defaults/hookBlock.ts:46`, `src/lib/calc/fields.ts:567`, `src/lib/calc/modules/hookBlock.ts:667`.

### B3 — Uygun kombinasyon bulunduğu hâlde arama “aday bulunamadı” diyebiliyor · P1

Deneyde ilk dört redüktörün giriş mili 100 mm, mevcut kaplinin üst sınırı 60 mm; beşinci redüktörün giriş mili 40 mm idi. Diğer hesap koşulları korunarak:

| Aday kümesi | Sonuç |
|---|---|
| 12 redüktör + aynı kaplin | GB-00 seçildi; motor kaplini seçilemedi |
| Yalnız GB-04 + aynı kaplin | GB-04 ve motor kaplini birlikte seçildi |

Motor/redüktör aşamasında en fazla 12 kabul toplanıyor, sonraki aşamaya yalnız dört dal taşınıyor. Kaplin aşaması başarısız olduğunda elenmiş redüktörlere dönülmüyor. Dolayısıyla mesele sadece küresel optimum garantisi olmaması değil: **mevcut uygun bir çözüm de kaçırılabiliyor**. Mesaj “uygun aday yok” ile “arama bu kapsamda tamamlanamadı” ayrımını yeterince yapmıyor.

Kaynaklar: `src/lib/auto-selection/solver.ts:19`, `:274`, `:300`, `:301`.

### B4 — Teklif kopyalama ve yeni revizyonun hesap bağı tamamlanmamış · P1

`copyOfferItem` kalem kimliğini yeniliyor fakat `calculationSource` eski kaynak bilgileriyle taşınıyor. Yerel deneyde kaynak nesnesi bile aynı referanstı. Bu nesne paylaşımı tek başına eski verinin değiştiğinin kanıtı değildir; asıl problem kaynak geçmişiyle düzenlenebilir bağlantının ayrılmamasıdır.

Canlı bağ `(offer_revision_id, item_id)` ile tutuluyor ve aynı anahtarla yükleniyor. Kalem/müşteri kopyası veya yeni teklif revizyonu için karşılık gelen bağ oluşturma adımı mevcut akışlara eklenmemiş. Kopyada kaynak hesap bilgisi görünürken “Hesaptan teknik bilgileri güncelle” yeni kimlikle bağı bulamayabilir. Yeni hızlı rapor açılması ise önceki hesabın manuel seçimlerini devralmak yerine tekliften yeni şablon oluşturabilir.

Yeni revizyonun fiilî kayıt yolu `createOfferRevisionDraft`, son teklifin `payload` alanını yeni satıra kopyalıyor; hesap bağı oluşturmuyor. Kabul testi bu yolu kapsamalı; `copyPayloadForRevision` yardımcı fonksiyonuna tek başına test yazmak yeterli değildir. Tarihsel kaynak snapshot'ı, düzenlenebilir hesap bağı ve güncelleme için seçilen hesap revizyonu ayrı kavramlar olmalı. Yükleme bugün bağlantıdaki revizyon yerine projenin en son revizyonunu okuyor; bu davranışın da açık bir sürüm politikası gerekli.

Kaynaklar: `src/lib/offers/copy.ts:40`, `:105`, `:170`; `src/app/(app)/offers/mutations.ts:326`; `src/app/(app)/offers/calculation-actions.ts:46`; `supabase/migrations/20260908000011_auto_selection.sql:31`.

## Hedefi eksik bırakan diğer alanlar

| Alan | Mevcut durum | Kapatılması gereken boşluk |
|---|---|---|
| Zorunlu teknik girdi | Eksik teklif değerleri için uyarı var; şablon değerleri korunuyor. Boş teklif kapasitesi deneyde 10 t oldu. Ön kontrol pozitif sayıyı kabul ediyor. | Kullanıcı girdisi, kaynak belge, firma kabulü ve teyit edilmemiş şablon ayrı izlenmeli. Kritik eksik girdi yalnız uyarıyla gerçek talep sayılmamalı. |
| Ölçü optimizasyonu | Mil ve kiriş adayları ağırlıkla mevcut ölçünün büyütülmüş katları. Tambur çapı için ayrı seri var. | Küçük kapasiteye dönüldüğünde uygun daha küçük kesitler de aranmalı. Geometri şablondan bağımsız, onaylı imalat ailesinden kurulmalı. |
| Donanım düzeni | Halat donanımı, fiziksel adetler, teker/ray ve aks düzeni çoğunlukla mevcut tasarım girdisi. | Teknik talepten uygun donanım/teker/yerleşim alternatiflerini üreten sınırlı, onaylı tasarım profilleri gerekli. |
| Kütle döngüsü | En fazla dört tur; eksik döküm varsa teknik özellikteki kütle korunuyor ve eksik bildiriliyor. | Korunan kütle otomatik doğrulanmış üst sınır değildir. Tam kaynaklı ürün/yapı kütlesi ve tahmin aralığının hesaba etkisi tamamlanmalı. Kullanıcının ağırlık defteri ezmeleriyle seçim tutarlı olmalı. |
| Fren ailesi | Kaldırma servis freninin aday filtresi yalnız kasnaklı (`drum`) ve kasnak çapı olan satırları alıyor. | Manyetik/diski desteklemek yalnız yeni katalog satırı eklemekle çözülmez; fiziksel montaj ve hesap zinciri de uyarlanmalı. |
| Marka popup'ı | Kaldırma/yürütme için ortak fren; motor/teker için ortak kaplin markası var. Çoğu marka listesi yalnız ürün türüne bakıyor. | Göreve göre ayrı markalar, fiziksel aileye göre uygun seçenekler ve seçilen markanın eksik verisinin erken gösterimi gerekli. |
| Üretici uygunluğu | Motor görev çevrimi/montajı, redüktör termik koşulları, bazı kaplin devir ve bağlantı verileri eksik. | Model/çalışma noktası bazında kaynaklı teknik veri, uygunluk koşulu ve belge sürümü gerekli. Satır sayısı bu verilerin tamamlığını göstermiyor. |
| İnceleme notları | Eksik veya destek dışı maddelerin kapanması güncel girdiye bağlı en az 12 karakterlik notla ifade edilebiliyor. | Metin uzunluğu teknik doğrulama değildir. Dış hesap/üretici doğrulaması gereken maddeler belge, değer/birim, revizyon ve kontrol eden kişiyle yapılandırılmalı. Sayısal başarısızlık notla geçerli sayılmama kuralı korunmalı. |
| Özel kapsam | Portal, açık saha, ikinci kiriş ve özel aparat için eksik kapsam açıkça bildiriliyor. | Bu tiplerin tam otomatik sonucu için bağımsız yapı/yük modeli ve kabul dosyası gerekli. Desteklenen aile için kabul ile bütün tiplerin kabulü ayrı izlenmeli. |
| Kabul testleri | Gerçek katalog testi aynı 10 t / 20 m / M6 girdisinde iki fren tercihi kullanıyor. İki sonuç da `incomplete`. | Farklı tonaj, hız, sınıf, standart, topoloji ve hata durumlarında beklenen seçim/uygunluk sonucu sınanmalı. Bağımsız mühendis referansı gerekli. |
| Performans | Yaklaşık 34,7 MB katalog; iki pilotta yalnız hesap/arama 6,9–8,1 saniye. | İlk katalog indirme ve popup açılışı dahil süre, mobil bellek ve soğuk/sıcak kullanım ölçülmeli. Filtreli/sürümlü veri yükleme gerekli. |

İlgili kod: `offer-bridge.ts`, `preflight.ts`, `solver.ts:126`, `solver.ts:181`, `orchestrator.ts`, `types.ts:8`, `src/components/auto-selection-dialog.tsx:109`, `trace.ts:56`, `scope.ts`, `__tests__/catalog-validation.test.ts` (belirtilmeyen klasör: `src/lib/auto-selection/`).

## Faz 10 — Teknik girdi ve teklif/hesap tutarlılığı

**Öncelik: P1.** Önce B1, B2 ve B4 kapatılmalı. İlk planın 2, 5 ve 6. fazlarını tamamlar.

Yapılacaklar:

1. Teknik talebin normalize edilmiş tek sözleşmesini kur: kapasite, açıklık, hızlar, sınıflar, kanca/fren tipi, çalışma ortamı ve fiziksel düzen. Kaynak, teyit ve kilit durumunu alan bazında taşı.
2. Teknik tablodan modül seçim şartlarına açık eşleme yap; kanca standardı gibi birden fazla yerde bulunan tanımlarda öncelik ve çatışma davranışını belirle.
3. Tekliften rapora ilk aktarımın teknik snapshot/hash bilgisini sakla. Yeniden açarken ve geri aktarırken güncel talebi karşılaştır. Teknik farkta eski ekipmanı otomatik geçerli sayma; farkı gösterip yalnız ilgili girdileri güncelleyen yeniden hesap akışı kur. Kullanıcı manuel rapor düzenlemelerini koru.
4. Kalem/müşteri kopyası ve yeni revizyon için bağımsız düzenlenebilir hesap oluştur veya ilk düzenlemede kopyala. Tarihsel kaynağı koru; yeni bağlantıyı işlem içinde kur. Eski/yayımlanmış hesap değişmesin. “En son hesap” ve “teklife aktarılan hesap” açıkça ayrı gösterilsin.
5. Kritik boş girdiyle gerçek talep sanılan şablon hesabını önle. Firma varsayımı varsa görünür, sürümlü ve açık kabul olarak taşı; kullanıcı yalnız gerekli eksikleri tamamlasın.

Çıkış ölçütleri:

- 10 t hesap, 25 t güncel teklif için teknik uyumsuzluk çözülmeden ekipman kaynağı olamaz; hız/açıklık/sınıf değişiklikleri de kapsanır.
- DIN 15402 talebi DIN 15401 ürünle tamamlanamaz. Kilitli çelişki görünürdür; uygun ürün yokluğu yanlış aile seçimiyle kapatılmaz.
- Kopyalanan kalem ve yeni teklif revizyonu kendi hesabını açar, kaydeder ve aktarır. Kaynak raporun manuel seçimleri korunur; eski revizyon değişmez.
- Eksik kritik teknik özellik, sessiz şablon değeriyle “tamam” sayılmaz. Geriye dönük kayıt geçişi ve rol/RLS davranışı testlidir.

## Faz 11 — Bağımlılıkları geri besleyen uygunluk araması

**Öncelik: P1.** B3'ü ve ilk planın 2–4. fazlarındaki arama sınırını kapatır.

Yapılacaklar:

1. Motor–redüktör–fren–kaplin ile mil–rulman–yatak bağlantılarını aday elemeden önce birlikte kontrol et. Aynı fiziksel koşulun farklı yerlerde ayrı formüllerini üretme; hesap motoru ve üretici koşulları tek kaynak olarak kalsın.
2. Sonraki aşama başarısızsa ilişkili önceki kararlara geri dön. Aramayı kontrollü genişlet; süre/değerlendirme sınırı ve iptal korunmalı. Bütün eski dalları körlemesine yeniden hesaplamak yerine başarısızlık nedenini kullan.
3. Önce tam teknik uygunluk, ardından gereksiz güç/boyut/kütle artışını azaltan açık sıralama kullan. Ağırlık/fiyat verisi yoksa sıfır maliyet avantajı verme. Firma tercihi ile standart zorunluluğunu ayrı tut.
4. “Uygun çözüm bulundu”, “katalog/veri yetersiz”, “bu kısıtlarla çözüm yok” ve “arama sınırda kesildi” sonuçlarını ayır. Son iki durum aynı kesinlikte sunulmasın.

Çıkış ölçütleri:

- GB-04 karşı örneğinde geçerli çift geniş katalog içinde de bulunur.
- Küçük, tamamen taranabilir test kataloglarında referans tam taramayla aynı uygunluk sonucu; aynı amaç için beklenen sıralama elde edilir.
- Katalog sırası değişimi, sınır kapasite, kilitli ürün, eksik bağlantı ve arama bütçesi test edilir. Hiçbir başarısız son kontrol “tam uygun” olarak işaretlenmez.

## Faz 12 — Üretici verisi, fiziksel aileler ve marka tercihleri

**Öncelik: P1.** İlk planın 1, 3, 4 ve 5. fazlarını tamamlar.

Yapılacaklar:

1. Desteklenecek üretici/aileler için gerekli alan matrisi çıkar. Önce gerçek kullanımda seçilecek modellerin görev çevrimi, termik kapasite, giriş devri, bağlantı ölçüleri, azami devir ve kütlelerini kaynak belgesiyle tamamla. Geçerli çalışma koşulunu tek nominal sayıya indirgeme.
2. Kaldırma ve yürütme fren ailelerini ayrı değerlendir; montaj, açma/kapama çevrimi ve gereken dinamik/ısıl kontrolleri kaynaklarına göre ekle. Katalogda bulunan ama motorun desteklemediği aileyi kullanılabilir gibi sunma.
3. Popup'ta kaldırma/yürütme freni ve motor/teker kaplini tercihlerini ayır. Uygun aile/uygulama filtreleri ve önceden görülebilen veri eksikleri ekle.
4. Eksik üretici koşullarını yapılandırılmış dış doğrulamayla tamamla. Serbest metin notunu belge/değer doğrulamasının yerine kullanma.

Çıkış ölçütleri:

- Pilot olarak desteklenen her fiziksel aile için eksiksiz kaynaklı en az bir uyumlu ekipman zinciri ve alternatif markayla tekrar testi vardır.
- Birbirinden farklı kaldırma/yürütme fren markaları seçilebilir. Seçilen tip/model aynı fiziksel zincirle hesaplanır.
- Belgesi eksik ürün “otomatik doğrulandı” durumuna geçmez; katalog güncellemesi ilgili önbellek ve kabul kanıtını doğru geçersizleştirir.

## Faz 13 — Teknik özelliklerden tasarım profili ve tam kütle

**Öncelik: P1, başlangıçtaki tam hedef için zorunlu.** İlk planın 4 ve 7. fazlarını tamamlar.

Yapılacaklar:

1. Onaylı vinç ailesi profilleri kur: halat donanımı, tambur/makara düzeni, teker/ray seçenekleri, aks geometrisi, izin verilen sac/mil/kiriş serileri ve bağlantı sınırları.
2. Adayları mevcut büyük ölçüyü sürekli çarpmak yerine bu profillerden üret. Küçültme ve büyütme aynı zorunlu kontrollerden geçsin; kullanıcının kilidi bozulmasın.
3. Ürün + yapı + yardımcı donanım kütlesini kaynak/tahmin aralığıyla birleştir; ağırlık defteri ezmelerini kaybetme. Eksik toplamı kesin tasarım kütlesi yapma.
4. Kütle → teker yükü → tahrik → kesit → kütle döngüsünün yakınsama ölçütünü tanımla. Belirsizlik ve döngü kesilmesi sonuca taşınsın.

Çıkış ölçütleri:

- Desteklenen ailede yeni boş rapora yalnız gerekli teknik özellikler ve markalar verilerek geometri/ekipman taslağı oluşturulur; şablon kütlelerine gizli bağımlılık kalmaz.
- Kapasite azaltma ve artırma senaryolarında uygun ölçü adayları değerlendirilir; küçülmeye fiziksel bir sınır engelse gerekçe gösterilir.
- Kütle defteri, teker yükleri, seçilen tahrikler ve son yapısal hesap aynı son taslağa aittir. Tekrar çalıştırma kararlı sonuç üretir.

## Faz 14 — Özel vinç tipleri ve yük durumları

**Öncelik: o tipin destek sözü veriliyorsa P1; sınırlı pilot dışında P2.** İlk planın 0 ve 8. fazlarını tamamlar.

Portal/yarı portal, açık saha, ikinci kiriş, ikiz/çift tambur, yardımcı kaldırma ve özel aparat için hangi yük durumunun hangi modülde doğrulandığı yazılı matrisle kurulmalı. Portal ayakları/stabilite, rüzgâr, ankraj, devrilme, ayrı burkulma ve birlikte çalışma senaryoları kendi kaynak ve bağımsız referanslarıyla tamamlanmalı. Bir ekipman grubunun seçilebilmesi, bütün vinç tipinin onaylandığı anlamına gelmemeli.

Çıkış ölçütü: Desteklenen her tip için tanımlı kapsam, kaynak maddeleri, bağımsız beklenen sonuçlar ve başarısız sınır örnekleri mevcut. Kapsam dışı tipte kısmi ekipman önerisi açık kalır; genel “tam rapor” sonucu üretilmez.

## Faz 15 — Bağımsız kabul, uçtan uca test ve kontrollü yayın

**Öncelik: P1 yayın koşulu.** İlk planın 9. fazını tamamlar. Testler diğer fazlarla birlikte yazılmalı; hepsi sona bırakılmamalı.

Kabul matrisi en az şu bağımsız boyutları kapsamalı:

- Firmanın gerçek aralığında düşük/orta/yüksek kapasite ve açıklık; farklı kaldırma/yürütme hızları; farklı mekanizma ve kullanım sınıfları.
- Tek/çift ağızlı kanca; desteklenen fren/kaplin aileleri; farklı marka birleşimleri; birden fazla mekanizma ve fiziksel adet düzeni.
- Eksik ürün, eksik üretici verisi, sınır tork/devir/mil, imkânsız bağlantı, bütün ürünler kilitli, yeniden çalıştırma ve teknik özellik değişikliği.
- Mühendislikte oluştur → seç → elle düzelt → kaydet → yeniden aç → JSON/PDF; teklifte oluştur → aktar → kapasite değiştir → yeniden hesapla → kopyala → yeni revizyon → maliyete aktar.
- İptal, eşzamanlı sekme/kayıt, oturum/yetki değişikliği, katalog sürümü değişimi, yayımlanmış rapor ve manuel/ticari ezme koruması.

Yalnız “bir ürün seçildi” testi yeterli değil. Beklenen marka/aile/ölçü, gerçek hız, güç/tork, tam bağlantı uygunluğu, son kontroller ve eksik durumların doğru sınıflandırılması doğrulanmalı. Mühendis tarafından bağımsız hesaplanmış gerçek referanslar, aynı motorun kendi sonucunu tekrar kontrol eden yazılım testlerinden ayrı tutulmalı.

Performans için ilk popup açılışını ve ağ indirmesini de ölç. Marka/aile manifesti, filtreli katalog snapshot'ı ve gerekli alanların yüklenmesiyle ilk indirmeyi azalt. Soğuk/sıcak kullanım, iptal gecikmesi, bellek ve düşük donanım sonuçlarını raporla; tek pilot süresini genel garantiye çevirme.

Çıkış ölçütleri: B1–B4 regresyonları kapalı; desteklenen pilot ailelerde tamlık ve bağımsız mühendis kabulü var; oturumlu iki iş akışı uçtan uca geçti; ölçülen performans hedefleri karşılandı. Ardından aile bazında açılabilen özellik anahtarıyla pilot yayın, geri dönüş yolu ve eksik seçim/manuel düzeltme ölçümleri uygulanır. Önceki çalışma kapsamında Vercel yayını yapılmamış olması bu kapının zaten geçildiği anlamına gelmez.

## Uygulama sırası ve bitiş tanımı

Önce **Faz 10**, ardından birbirini besleyen **11 ve 12**, sonra **13**. **14**, desteklenecek özel ailelerin kapsamına göre ayrı kapanır. **15'in testleri** her fazda ilerler; yayın kabulü en son tamamlanır.

Standart bir pilot ailede kullanıcı hedefi, **10–13 ve o aileye ait 15. faz kabulü kapanınca** karşılanmış sayılabilir. Bütün vinç tipleri hedefleniyorsa 14 de zorunludur. Yalnız düğmenin çalışması, katalogdan çok sayıda satır seçilmesi veya derlemenin başarılı olması bitiş ölçütü değildir.

Denetimin somut çıktıları bu belge, eski durum belgelerine bağlantı ve yerel yeniden üretim betiğidir. Yukarıdaki düzeltmeler bu denetim turunda uygulanmış gibi değerlendirilmemelidir.
