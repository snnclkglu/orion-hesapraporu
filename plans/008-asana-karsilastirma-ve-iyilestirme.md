# Asana karşılaştırması ve ORION görev modülü iyileştirme fazları

Tarih: 12 Eylül 2026. Durum: kaynak araştırması ve ekran karşılaştırmasından sonra S0 ve U1–U3 geliştirmeleri uygulandı. Güncel gerçekleşme ve kontrol sınırları aşağıdaki bölüm 7'dedir; ilk plan tablosu kararların geçmişini korur. Fiziksel cihaz, gerçek fotoğrafla kabul, bakım zamanlaması ve yayın kapıları [007](007-profil-ekip-uygulama-kontrol.md)'de açık kalır.

## Araştırmanın sınırı ve kanıt yöntemi

Asana'nın güncel resmi ürün sayfaları, iOS/Android yardım makaleleri, üretim sektöründeki müşteri örneği ve kullanıcı anlatımları incelendi. Resmi özellik sayfası uygulama içi tarayıcıda açıldı; diğer kamuya açık sayfalar ayrı tarayıcı oturumunda görüntülendi ve ekran kanıtları kaydedildi. Asana hesabı açılmadı, ücretli plan alınmadı, kullanıcının Asana verilerine erişilmedi.

Ekranlar Asana'nın bugün yayımladığı gerçek ürün görsellerinin tarayıcıda alınmış görüntüleridir. Pazarlama görseli ile yardım merkezindeki numaralı anlatım görseli ayrı etiketlenmiştir. Bunlar belirli bir hesaba dağıtılmış en yeni sürümün uçtan uca testi değildir; Asana'nın görselleri son sürümden daha eski olabilir. ORION ekranları mevcut gerçek bileşenlerin açıkça örnek verili önizlemesinden alındı; hayalî tasarım veya üretime yazılan test görevi değildir. Asana'da elle ölçülmüş dokunma sayısı, görev bitirme süresi veya kullanım yüzdesi uydurulmadı.

Kanıt klasörü: `artifacts/asana-reference-2026-09-12`. `sources.json` resmi URL, görsel URL/başlığı ve çekim zamanını; `orion-sources.json` bizim görünüm/ölçü/zaman bilgimizi içerir. [Görsel karşılaştırma](../docs/asana-ekran-karsilastirma.md).

## 1. Supabase açıklaması ve mevcut kurulum kapısı

Yeni bir gizli sunucu gerekmiyor. Dosyalar yine mevcut Supabase Storage'da saklanıyor. Tartışılan şey, uygulama sunucusunun kullanabileceği gizli ve geniş yetkili bir erişim anahtarıdır. Supabase, kullanıcı oturumu ve Storage RLS kurallarıyla dosya yüklemeyi destekler; service key ise bu kuralları atlar ve güvenilir sunucu tarafıyla sınırlı tutulmalıdır. Bu nedenle gizli anahtar dosya saklamanın evrensel şartı değildir. [Supabase Storage erişim denetimi](https://supabase.com/docs/guides/storage/security/access-control).

Yerel kaynakta iki farklı yol mevcut:

| Alan | Bugünkü yol | Sonuç |
| --- | --- | --- |
| Görev ekleri | `panel/workspace-actions.ts` içinde doğrulanmış kullanıcının `db.storage.upload` çağrısı | Kullanıcı/nesne yetkileri RLS ile uygulanır; genel sunucu anahtarı yükleme için kullanılmaz. |
| Yeni avatar/geri bildirim görselleri | `account/server.ts` içindeki `uploadPrivate` admin istemcisi kullanır; 006 migration doğrudan INSERT açmaz | Yalnız sunucunun yeniden kodladığı görselleri yükleme tercihi geniş anahtar bağımlılığı oluşturdu. |
| Avatar önizleme oran sınırı ve toplu bakım | Sunucuya özel RPC/istemci | Kullanıcı görsel yüklemesinden ayrı değerlendirilmesi gereken ek bağımlılıklar. |

Bu farklılık Supabase'in güvensiz olduğu anlamına gelmez. “Sunucuda çalışıyor” da tek başına “service key gerekir” demek değildir. Kullanıcı oturumuyla çalışan sunucu işlemleri de mümkündür. Mevcut yapı için güvenlik sonucu ancak bucket, RLS, kayıt yetkisi, içerik doğrulama ve bağlantı ömrü birlikte denetlenerek verilir.

**S0 — En az yetkiyle yükleme kararı (açık kontrol):** mevcut görev yüklemesiyle yeni görsel yolunu karşılaştır; oturumla yükleme seçeneğinde yalnız kişinin kendi yeni nesnesine yazma, başkasının yoluna erişememe, kesinleşmiş eki değiştirememe, aktif avatarı rastgele silememe kurallarını prova et. Sunucudaki normalleştirmenin doğrudan Storage çağrısıyla atlanması ayrıca çözülmeli; sadece MIME adı kontrolü metadata temizliğinin garantisi değildir. Önizleme oran sınırı aktörü oturumdan almalı; toplu bakım ayrı işletim yetkisi olarak kalmalı. Testler geçmeden RLS gevşetilmez veya mevcut yol değiştirilmez. Geniş anahtarla çalışma seçilirse önceki açık onay gereksinimi devam eder; bu soru onay sayılmadı ve anahtar alınmadı.

## 2. Özellik karşılaştırması

“Mevcut” kodda bulunduğunu gösterir; fiziksel cihaz veya üretim kabulünün tamamlandığını göstermez.

| Alan | Asana'da doğrulanan | ORION'da mevcut | Bize uygun karar |
| --- | --- | --- | --- |
| Günlük kişisel çalışma | My Tasks, bölümler, filtreli/kaydedilmiş görünümler. [Kaynak](https://asana.com/features/project-management/my-tasks) | Görevlerim, Bugün/Yaklaşan, kişi/durum/öncelik ve URL filtreleri | Önce “Bugün / Bu hafta / Geciken” görünürlüğü ve kaydedilmiş filtre kısayolları. Mevcut filtreleri yeniden kurma. |
| Liste ve pano | Aynı işi liste/pano/takvim/zaman çizelgesinde görme. [Kaynak](https://asana.com/features/project-management/project-views) | Liste ve durum panosu; mobilde durum seçimi | İlk ek görünüm haftalık ajanda; tam Gantt daha sonra gerçek ihtiyaçla. |
| Görev detayı | Sorumlu, tarih, açıklama, ek, alt görev ve bağımlılık. [Kaynak](https://asana.com/features/project-management/tasks) | Sorumlu, termin, iş kodu, durum/öncelik, açıklama, yorum/geçmiş/ek | Mobil alanları sıkıştır; yorum erişimini yukarı taşı. Alt görev ve bağımlılık ayrı veri fazı olsun. |
| Tekrarlayan iş | Tamamlandığında sonraki örneği oluşturan tekrar; yorumlar kopyalanmaz. [Kaynak](https://help.asana.com/s/article/scheduling-tasks-using-start-dates-due-dates-and-times) | Tekrar kuralı yok | Haftalık plan, düzenli kontrol ve takip için öncelikli. Takvime bağlı ile tamamlamaya bağlı tekrar açık ayrılmalı. |
| Aynı görevin farklı bağlamları | Bir görev birden fazla projeye eklenebilir. [Kaynak](https://asana.com/features/project-management/tasks) | Tek pano; aynı ekip görevi ekipte ve sorumlunun listesinde görünür | Bugünkü iki listede görünmeyi gerçek çoklu pano ile karıştırma. Çoklu pano ancak ekipler arası ihtiyaç kanıtlanırsa. |
| İş bağlantısı | Genel amaçlı projeler ve özelleştirilebilir alanlar. [Kaynak](https://asana.com/features) | Mevcut ORION işiyle `job_id` bağı ve 0065 kodu | Avantajımızı koru: iş, teknik çizim, satın alma bağlamına mevcut kayıt üzerinden erişim. İkinci proje defteri kurma. |
| Ekip yetkileri | Ekip ve erişim denetimleri. [Kaynak](https://asana.com/features) | Sekiz mevcut rol; Yönetici tüm ekipler, diğer kullanıcı kendi ekipleri; özel görev sınırları | Rol matrisi korunmalı. Müdür kendiliğinden Yönetici yetkisi almamalı. |
| Bildirimle iş yapma | Gelen kutusunda filtre, okundu/arşiv ve yorumdan eylem. [Kaynak](https://asana.com/features/project-management/inbox) | Atama/yorum/bahsetme olayları; görevden ayrı global zil | Tekrarlanan olayları azalt; bildirimden doğrudan ilgili yorum/göreve git; sonradan hatırla. |
| Otomasyon/şablon | Tetikleyici–eylem kuralları ve tekrar kullanılabilir şablonlar. [Kaynak](https://asana.com/features/workflow-automation/rules) | Genel görev kural motoru/şablon kütüphanesi yok; API var | Önce üç basit tarif; kapsamlı görsel otomasyon editörü kurma. |
| Ekip yükü | Workload ile ekip kapasitesi değerlendirmesi örneği. [Kaynak](https://forum.asana.com/t/how-asana-s-product-team-uses-asana/131307) | Ekipte açık/atamasız/gecikmiş sayıları | İlk adım kişi bazında açık/gecikmiş liste; görev sayısını çalışma saati veya performans puanı gibi sunma. |
| Mobil | Yerel uygulamalarda hızlı oluşturma, alt gezinme ve çevrimdışı değişiklik senkronizasyonu. [Android](https://help.asana.com/s/article/android-basics), [iOS](https://help.asana.com/s/article/asana-for-ios) | Mobil web, beşli alt gezinme, hızlı ekle, geri bildirim metin taslağı | Klavye ve yeniden bağlanma önce; tam çevrimdışı görev kuyruğu ayrı ve daha büyük faz. |
| AI | Resmi sitede AI özellikleri var. [Kaynak](https://asana.com/features) | Yetkili ve tekrar güvenli Agent görev API altyapısı | Grokbot/e-posta analizi kullanıcı sorumluluğunda; burada yeni AI ürünü yapılmayacak. |

Asana'nın bazı gelişmiş özellikleri aboneliğe göre değişir. Karşılaştırma “hepsi ücretsiz” veya fiyat avantajı iddiası içermez.

## 3. Gerçek ekranlardan çıkan UI/UX bulguları

1. **Liste üstü yoğunluk:** ORION'un 390×900 önizlemesinde başlık, arama ve filtreler görevlere ayrılan alanı azaltıyor. Asana Android yardım görseli daha doğrudan görev/bölüm alanına odaklanıyor. ORION önizleme bandı ek yük oluşturduğu için piksel bazında birebir performans puanı çıkarılmadı. Öneri: arama + aktif filtre özeti; ikincil filtreler 44px “Filtrele” düğmesinin alt panelinde. Masaüstündeki filtreler korunur.
2. **Günlük bölümler:** Asana örneğinde yeni atanmış/bugün/sonra bölümleri görsel taramayı kolaylaştırıyor. ORION'da dönem filtreleri zaten var. Yeni tablo açmadan mevcut görevleri Bugün, Geciken ve Sonraki işler biçiminde gruplandırma prototipi yapılmalı.
3. **Hızlı oluşturma:** resmi iOS görüntüsünde alt panel ve klavyenin hemen üstünde kısa alan araçları var. Bizde de alt panel var; kapsam ve pano alanları daha fazla dikey yer tutuyor. Seçili ekip/pano güvenli özet olarak gösterilip değişiklik isteğe bağlı açılabilir. Görünürlük bilgisi asla gizlenmez.
4. **Detay ve yorum:** iOS örneğinde sorumlu/tarih aynı satırda, yorum girişi alt tarafta erişilebilir. ORION detayında alanlar tek tek uzun satırlarda; açıklama, hedef ve iş seçimi yorumları aşağı itiyor. İlk görünümde başlık, sorumlu+tarih, durum+öncelik, iş kodu; “Diğer ayrıntılar” altında hedef/taşıma. Yorumlara görünür sekme/eylem. Metin uzadığında kırpmadan açılabilmeli.
5. **Alt gezinme:** Asana yardım ekranında Home/My Tasks/Inbox/Search/Account; ORION'da Görevlerim/Ekip/Panolar/Gelen/Menü var. İsimleri körlemesine eşitleme; ekip kullanımı bizim için temel. Menü'deki Profilim ve üst avatar zaten mevcut. Global arama ancak kullanıcı senaryosu gerektirirse alt bar sırasını değiştirir.
6. **Durum/öncelik:** Asana renk ve kısa etiket kullanıyor; ORION'da da mevcut. Renk sayısını çoğaltmak yerine tutarlı anlam, okunur kontrast ve “Gecikmiş” gibi metin desteği korunmalı.

## 4. Kullanıcıların sevdiği özelliklere özel inceleme

Temsilî kullanım telemetrisi veya bütün kullanıcıları kapsayan bir sıralama bulunmadı. Aşağıdakiler “en çok kullanılan ilk beş” değildir; gerçek kullanım anlatımlarından çıkan ve ORION ihtiyacıyla kesişen adaylardır.

| Kanıt | Anlatılan değer | Güven sınırı / bizim kararımız |
| --- | --- | --- |
| Asana ürün ekibi ve forum katılımcıları: pano, bağımlılık, kapasite, otomasyon ve çoklu projede tek görev. [6 Ağustos 2021](https://forum.asana.com/t/how-asana-s-product-team-uses-asana/131307) | İşin hangi aşamada ve neyi beklediğinin görünmesi; tıklama yükünün azalması | Eski, küçük ve Asana topluluğuna ait örneklem. Güncel özellik mevcudiyeti resmi sayfalardan ayrıca doğrulandı. |
| Küçük ekipler başlığındaki ajans proje yöneticisi otomasyonları özellikle beğeniyor; başka katılımcılar kayıt güncelleme alışkanlığının zorluğunu anlatıyor. [Kullanıcı tartışması](https://www.reddit.com/r/Asana/comments/1ns1z1n/how_do_small_teams_really_use_tools_like_asana/) | İnceleme/takip tekrarının azalması; veri girişinin alışkanlık gerektirmesi | Kimliği bağımsız doğrulanmamış kullanıcı anlatımı. Ek alan yükünü artırmamayı destekleyen bir sinyal; genellenmiş ölçüm değil. |
| Viessmann üretim örneğinde kurallar, formlar ve portföyler öne çıkarılıyor. [Resmi müşteri örneği](https://asana.com/case-study/viessmann) | Bölümler arası koordinasyon, talepler ve ürün geliştirme | Satıcı tarafından yayımlanmış başarı öyküsü; ORION için aynı sonuç garantisi değil. Mevcut satın alma/iş süreçleri tekrar kurulmaz. |

Özel inceleme önceliği: günlük görünüm, tekrar/şablon, basit alt işler, bekleme bağlantısı, bildirimden eylem. Çoklu pano ve ayrıntılı kapasite ekranları ikinci sırada kalır; izin ve veri giriş maliyeti daha yüksektir.

## 5. Fazlar ve kontrol kapıları

| Faz | Çıktı | Kontrol / geçiş koşulu | Durum |
| --- | --- | --- | --- |
| A0 — Kaynak ve mevcut ürün envanteri | Resmi kaynaklar, kodda var/yok matrisi, Supabase yol farkı | Kaynak iddiası ile öneri ayrıldı; var olan işlev tekrar planlanmadı | Yapıldı |
| A1 — Ekran kanıtı | Asana web, Android ve iOS görselleri; ORION 390/1440 liste/ekle/detay | URL/tarih/köken kayıtlı; animasyon bitişi; örnek veri etiketli | Yapıldı |
| KA1 — Karşılaştırma doğruluğu | Görsel ve kaynak çapraz kontrolü | Native/web farkı, eski yardım görseli, plan katmanı, popülerlik sınırı açık | Yapıldı |
| A2 — Kullanım değeri | Yukarıdaki ayrı kullanıcı kanıt tablosu | Yalnız beğeni sayısına göre karar yok; iş yükünü azaltan kullanım örneği var | İlk masa başı inceleme yapıldı; ekip pilotu açık |
| S0 — Dosya yükleme yetkisi | İki yöntemin sınırlı yetki/içerik/bakım kararı | Üç farklı kullanıcıyla çapraz okuma/yazma negatif testleri; mevcut kesinleşmiş ek korunur | Açık; anahtar talebi otomatik onay kabul edilmez |
| U1 — Mobil sadeleştirme | Filtre alt paneli, kompakt detay, görünür yorum, güvenli hızlı oluşturma | 320/390px, klavye, uzun ad, alt güvenli alan, Tab/Escape, açık/koyu tema | Planlandı |
| KU1 — Günlük kullanım kontrolü | Aynı görev senaryolarının önce/sonra ölçümü | Başarı oranı düşmez, ek zorunlu veri girişi yok; kritik örtüşme/silinen taslak yok | U1 sonrası |
| U2 — Günlük plan ve tekrar | Kaydedilmiş görünümler, haftalık ajanda, tekrar kuralı, isteğe bağlı kısa kontrol listesi | Tekrarda çift görev yok; Türkiye saati ve ay sonu; kapsam/iş kodu korunur; kontrol listesi tam alt görev gibi sunulmaz | Planlandı |
| KU2 — Veri/API kontrolü | Yetki, sürüm, yeniden deneme, arşiv, tekrar ve eski istemci testleri | İşlem geri alma ve API alanları uyumlu; örnek üretim kaydı yok | U2 sonrası |
| U3 — Koordinasyon | “Şunu bekliyor” bağı, bildirimden eylem, görev şablonu ve sınırlı otomasyon tarifleri | Gizli görev adı sızmaz; döngü bağı ve bildirim fırtınası yok; AI bağlantısı gerekmez | Planlandı |
| KU3 — Değer ve karmaşıklık kontrolü | Mühendislik ve satın alma günlük senaryoları | Kullanılmayan ayar kaldırılır/ertelenir; mevcut satın alma onay mekanizması çoğaltılmaz | U3 sonrası |
| U4 — Koşullu gelişmiş özellikler | Gerçek alt görev, kişi yükü, çoklu pano, tam offline kuyruk için ayrı karar | Her özellikte açık kullanıcı ihtiyacı ve yetki modeli; görev sayısı = süre varsayımı yok | Doğrudan uygulama listesi değil; ihtiyaç bekler |
| M5/K5 — Gerçek mobil pilot ve yayın | Küçük iPhone, Android, tablet; ekran okuyucu, ağ kesintisi; saha ölçümleri | 007'nin açık kapıları kapanmış, kritik hata yok; uyumlu yayın/geri dönüş hazır | Açık |

Bu fazlar otomatik olarak her Asana özelliğini ORION'a ekleme kararı değildir. Önce U1, sonra düşük veri giriş yüküyle U2; U3'ün her tarifi ayrı doğrulanır. Mevcut teslimin dosya yükleme ve gerçek cihaz kontrolleri yeni özellik uğruna ötelenmez.

### U2 tekrar kuralının açık kararları

- “Her pazartesi” ile “tamamlandıktan 7 gün sonra” farklıdır. Kullanıcı bunu tarih seçicisinde açık görür.
- Gün/ay sınırı, son iş günü, gecikmiş örnek, tamamlamayı geri alma, ekibin arşivi ve üyenin ayrılması test edilir.
- Varsayılan yalnız bir sonraki örnek; mükerrer üretimi tekrar kimliği engeller. Yeni örnek eski görevin tamamlanma geçmişini değiştirmez.
- Yorumlar otomatik kopyalanmaz; eklerin ve kontrol listesinin taşınması açık şablon kararıdır. Eski hassas ek yeni bir ekibe sessizce açılmaz.

### U3 için ilk üç otomasyon adayı

1. Termin yaklaşınca uygulama içinde tek hatırlatma; sessiz saat ve kullanıcı tercihi.
2. “Çizim kontrolü” şablonunda kısa kontrol adımları, sorumlu ve iş kodu bağlamı; yeni zorunlu alan yok.
3. Ön koşul tamamlandığında bekleyen işin sorumlusuna tek bildirim. Görevi otomatik tamamlamaz veya terminini sessizce değiştirmez.

### Önce/sonra ölçüm senaryoları

Görev oluşturma → 0065 bağlama → ekip üyesine atama → yarına tarih → yorum → tamamla/geri al; atamasız ekip görevini sahiplenme; özel görevin diğer kullanıcıda görünmemesi; filtreyi kaydet ve geri dön; ağ gidince yeniden deneme. Her kullanıcı için dokunma, süre, hatalı seçim ve yardım gereksinimi kaydedilir. Hedef: başlıkla görev ekleme en fazla iki eylem (metin girişi hariç), listeden tamamla tek eylem, listeden tarih değişimi iki eylem. Bunlar tasarım hedefidir; Asana'da ölçülmüş değerler değildir.

## 6. Kısa karar

ORION'un avantajı mevcut iş kayıtları, Türkçe terimler ve rol/ekip yapısıyla bütünleşmesi. Asana'nın belirgin avantajı günlük planlama esnekliği, tekrar/alt iş/bağımlılık olgunluğu ve native mobil sürekliliği. Öncelik, daha fazla ayar eklemekten önce günlük ekranları hızlandırmak; sonra tekrar, şablon ve koordinasyon yükünü azaltmak.

## 7. Uygulama kaydı — 12 Eylül 2026

| Faz | Uygulanan | Kontrol ve sınır |
| --- | --- | --- |
| S0 | Kullanıcı onayıyla mevcut Supabase projesinde `account-media` ACTIVE v1. Oturum, kendi yoluna yeni yazma, taslak/slot, oran sınırı, metadata içermeyen statik WebP boyut kontrolü. 010 migration uygulandı. | Canlı yetkisiz istekler 401. Fonksiyonun gerçek kaynak koduyla normal yükleme, başka yol/bucket, kesinleşmiş gönderi, yanlış boyut ve oran sınırı birim testleri geçti. Gerçek kullanıcının seçtiği fotoğrafla uçtan uca kabul henüz yapılmadı. Yerel gizli proje anahtarı indirilmedi. |
| U1 | Mobil filtre alt paneli; tarih sekmeleri tek satır; kompakt detay alanları; doğrudan yorumlara gitme. | 320px'te sıkışma ve önizleme kapsayıcısının genişlemesi saptanıp düzeltildi. 320/390/768/1440px etkileşim testleri geçti. |
| KU1 | Gerçek önizleme bileşenleriyle filtre, kayıtlı görünüm, haftalık ajanda, kontrol adımı, tekrar ve yorum erişimi. | `artifacts/task-workflow/mobile-checks.json`; kullanıcıya ait canlı kayıt yazılmadı. İnsan dokunma/süre ölçümü ve fiziksel klavye pilotu açık. |
| U2 | En fazla 20 kişisel görünüm; Türkiye tarihine göre pazartesi–pazar ajanda; en fazla 30 kontrol adımı; haftalık/aylık veya tamamlanmadan sonra gün tabanlı tekrar. | 011–012 migration uygulandı. Ay sonu çapası, artık yıl, yeniden tamamlama ve tek sonraki kayıt doğrulandı. Ajanda yüklenen/toplam sayısını gösterir ve mevcut sayfalamayı kullanır. |
| KU2 | Aynı atomik komutta sürüm, tekrar anahtarı, kontrol listesi ve tekrar doğrulaması. `GET/PATCH /api/agent/tasks/{id}/workflow`; OpenAPI 1.1. | Geri alınan DB testleri: döngü, ön koşul, eski `done_at` tamamlama yolu, özel erişim ve bildirim tekrarı. Hedefli API/model/görsel testleri. Grokbot veya e-posta bağlantısı kurulmadı. |
| U3 | Aynı paylaşım kapsamındaki en fazla 10 beklenen görev; çizim kontrolü/iş teslimi kontrol listesi şablonları; okundu/okunmadı eylemi; termin hatırlatma tercihi ve sessiz saatler. | Döngü ve eşzamanlı akış değişimi işlem kilidiyle korunur. Göreve hazır bildirimi kullanıcı/görev için tekildir. Termin hatırlatması uygulama verisi yenilenirken üretilir; arka plan push/cron olarak sunulmaz. |
| KU3 | Şablon mevcut iş kodu/sorumluyu değiştirmez; satın alma onay sürecine yeni mekanizma eklenmedi. Özel bağlantı adı erişimsiz kişiye dönmez. | Yeni zorunlu form alanı yok. Şablon/tekrar kullanımı isteğe bağlı. İnsanlarla saha değeri değerlendirmesi henüz yapılmadı. |
| U4 | Gerçek alt görev, çoklu pano, kapasite ve tam çevrimdışı kuyruk eklenmedi. | İlk plandaki koşullu karar korunuyor; iş yükü süre verisi ve erişim modeli ihtiyacı netleşmeden çoğaltılmaz. |
| M5/K5 | Otomatik mobil kontrol ve görsel kanıt üretildi. | Gerçek iPhone/Android, VoiceOver/TalkBack, canlı fotoğraf/geri bildirim kabulü, zamanlanmış bakım ve arayüzün üretim yayını açık. |

### Kullanım kararları

- Aylık tekrar termin gününü korur; ayda o gün yoksa ay sonuna iner, sonraki ay özgün güne döner. Geciken haftalık/aylık görev, eski termininden bir aralık ileri gider; atlanan bütün dönemler topluca oluşturulmaz. Resmî tatil/son iş günü takvimi eklenmedi.
- Tekrarda yalnız bir sonraki görev açılır. Başlık, açıklama, iş/pano, sorumlu ve kontrol adımları taşınır; adımlar sıfırlanır. Yorum, dosya, bekleme bağlantıları ve kaynak tekrar anahtarı kopyalanmaz.
- Pano arşivlenmişse veya eski sahibin yazma erişimi kalmamışsa sonraki tekrar oluşturulmaz; eski görevin tamamlanması korunur. Sonraki kayıt görünmüyorsa detayda erişim/arşiv kontrolü hatırlatılır.
- Kontrol listesi gerçek alt görev değildir; ayrı sorumlu/termin alanları taşımaz. Görev sayısı çalışma saati veya kişi kapasitesi sayılmaz.
- Aktif avatarı ya da kesinleşmiş eki kullanıcı geçidinden silme/üzerine yazma yolu yoktur. Referans dışı eski nesneler için bakım ayrı ve hâlâ zamanlanmayı bekleyen işletim işidir.

Yeni ekranlar: `artifacts/task-workflow/list-320.png`, `filters-320.png`, `week-390.png`, `workflow-390.png`. Önceki Asana ekran kanıtları değiştirilmedi: [görsel karşılaştırma](../docs/asana-ekran-karsilastirma.md).

### Son kontrol kaydı

- 010–014 görev migrationları mevcut Supabase projesine uygulandı. 013, kullanıcının aylık termin gününü değiştirmesini; 014, Bugün'den ayrı Geciken görünümünü tamamlar. Geri alınan testler geçti; son canlı sayımda `job_tasks=19`, `user_todos=19`.
- 38 hedefli model/API/görsel testi geçti: `artifacts/task-workflow/targeted-tests.json`. Fonksiyon kaynak kodunun kabul/ret testleri bu sayıya dahildir; canlı gerçek fotoğraf kabulü değildir.
- 320/390/768/1440px × açık/koyu tema: sekiz yeni görev akışı geçti, tarayıcı konsol hatası ve yatay taşma yok. `artifacts/task-workflow/mobile-checks.json`.
- Önceki profil/geri bildirim/ekip/Panel: yedi genişlik × dört sayfa × iki tema = 56 ekran kontrolü geçti; yedi mobil kullanım senaryosu tekrar geçti. `artifacts/account-mobile/report.json` ve `interaction-report.json`.
- Hedefli ESLint sıfır hata/uyarı; TypeScript ve bağımsız üretim derlemesi geçti. Aynı projede başka derlemeler çalıştığı için `ORION_ISOLATED_BUILD=1` ile `.next-task-check` çıktısı kullanıldı; normal çıktı `.next` olarak kalır. Kanıt: `artifacts/task-workflow/build-isolated.log` ve `lint.log`.
- 10.000 geçici görevde ilk 50 kayıt sorgusu 286 ms; bütün test yazmaları geri alındı. Tek sunucu sorgusu ölçümüdür, telefon performansı veya saha kabulü değildir. `artifacts/task-workflow/database-checks.json`.
- Tam uygulama regresyon paketinin eski sonuçları 007'de korunur; bu turda tüm paket yeniden çalıştırılmış gibi raporlanmaz. Kullanıcı fotoğrafı, fiziksel cihaz, bakım zamanlaması ve üretim arayüzü yayını tamamlandı sayılmaz.
