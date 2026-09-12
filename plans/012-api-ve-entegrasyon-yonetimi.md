# 012 — Yönetim / API ve Entegrasyonlar

Tarih: 12.09.2026
Durum: Uygulama ve veritabanı geliştirildi; otomatik kontroller tamamlandı. Yayın ve fiziksel pilot durumu aşağıdaki uygulama kaydında izlenir.

## 1. Amaç ve önerilen yaklaşım

Yönetici, bir ajanın nereye bağlanacağını, hangi kullanıcı adına çalıştığını, hangi işlemleri yapabildiğini ve neden hata aldığını tek yerde görebilmeli. Geliştirici ise doğru uç noktayı, istek biçimini ve hata çözümünü ayrıca kaynak kodu okumadan bulabilmeli.

Yeni bölüm: **Yönetim → API ve Entegrasyonlar**, adres: `/admin/integrations`.

İki teslim dilimi önerilir:

1. **Görünürlük ve teşhis:** Mevcut yapılandırmadan güvenli özet, uç nokta kataloğu, bağlantı rehberi ve yetki kontrolü. Mevcut Grokbot bağlantısı değiştirilmez.
2. **Uygulama içinden yönetim:** Ajan izinleri, duraklatma, anahtar oluşturma ve yenileme Supabase üzerinden yönetilir. Böylece rutin ajan ayarları için Vercel ortam değişkeni düzenleme ve yeniden dağıtım gerekmez.

Yeni sunucu veya dış entegrasyon hizmeti gerekmez. Mevcut Next.js sunucu katmanı, Supabase ve Yönetim bileşenleri kullanılır. Bu panel Grokbot'un e-posta analizi mantığını geliştirmez; ORION'a erişimini yönetir.

## 2. Mevcut koddan doğrulanan durum

| Konu | Bugünkü durum | Plan üzerindeki etkisi |
| --- | --- | --- |
| Ortak bağlantı | `https://app.orioncranes.com/api/agent` | Ana bağlantı adresi tek tıkla kopyalanır. |
| Modüller | Teklif, görev ve E-posta Merkezi ajan uçları mevcut | İlk katalog bu üç modülü kapsar; uygulamanın tamamına erişim vaadi verilmez. |
| Ajan tanımı | `AGENT_API_CLIENTS`, isteğe bağlı `EMAIL_AGENT_CLIENTS`, eski tek-token desteği | Sunucu mevcut kaynakları okuyarak yalnız güvenli alanları gösterir. |
| Ek görev izinleri | `AGENT_TASK_SCOPE_GRANTS` mevcut token özetine görev izinleri ekler | Tanımlı izin ile etkin izin birlikte hesaplanır; ek iznin kaynağı görünür. |
| Kimlik | Token bir `actorId` profiline bağlı | API izni, profil rolü ve kayıt erişimi birlikte değerlendirilir. |
| Yönetim erişimi | `admin` / Yönetici; `manager` / Müdür ayrı rol | Yeni panel Yöneticiye açıktır; Müdüre otomatik erişim verilmez. |
| Görev gizliliği | Bana özel görev yalnız sahibine açık | API paneli görev gizliliğini aşan bir içerik görüntüleyicisine dönüşmez. |
| Dokümantasyon | Teklif/ortak rehber, görev OpenAPI dosyası, e-posta rehberi ayrı | Birleşik katalog yapılır; görev OpenAPI'si tüm modülleri kapsıyormuş gibi sunulmaz. |
| Hız sınırı | Ortak katmanda süreç belleği; görevlerde ayrıca veritabanı sınırı | Tek ve kesin küresel kota varmış gibi sayaç gösterilmez. |
| İşlem izi | Yetkilendirmeden sonra, işlemden önce audit kaydı | Mevcut audit kaydı başarı kanıtı değildir. |
| Hata gözlemi | Bazı erken 401/403/422 yanıtları ortak audit dışında | Güvenilir hata oranları için ayrıca sonuç ölçümü gerekir. |

Vercel'in gizli değişkeni yönetim API'sinden geri vermemesi, uygulama sunucusunun kendi yapılandırmasını okuyamayacağı anlamına gelmez. İlk dilimde sunucuda ayrıştırılan kimlik, profil ve izin bilgileri kullanılabilir. Ham ortam değişkeni JSON'u ve token hiçbir zaman tarayıcıya gönderilmez.

İncelenen kaynaklar: `src/app/api/agent/_lib.ts`, `src/app/api/agent/tasks/[[...segments]]/route.ts`, `src/app/api/agent/email-center/route.ts`, `src/app/(app)/admin/layout.tsx`, `admin-nav.tsx`, `docs/agent-api.md`, `docs/task-workspace.md`, `docs/task-api.openapi.json`, `docs/email-center-agent.md`, `docs/agent/roller.md`, `docs/agent/arayuz.md`.

## 3. Ekran yapısı

### A. Genel bakış

- Bağlantı adresi, ortam ve API sürümü; adresi kopyala düğmesi.
- Ajan sayısı, yapılandırma kontrolünün sonucu ve kontrol zamanı.
- Bağlantı durumu açık ifadelerle: **Ayarlar geçerli**, **Gerçek istek bekleniyor**, **Son doğrulanmış istek başarılı**, **Hata var**. Ayar kontrolü tek başına yeşil bağlantı başarısı sayılmaz.
- Son hatalar ve ilgili ajana geçiş; ölçüm henüz yoksa “Henüz ölçüm yok”.
- “Bağlantı rehberini al” ve “Ajanları görüntüle” ana eylemleri.
- Üretim ve önizleme ortamı belirgin etiketlenir. Önizlemede üretim anahtarı önerilmez; veritabanı ortaklığı dahil ortam ayrımı yayın öncesi doğrulanır.

### B. Ajanlar ve erişim

Her ajan satırında ad, sabit kimlik, bağlı profil, rol, etkin modüller, yapılandırma kaynağı ve mevcutsa son istek zamanı gösterilir. Kaynağı ortam değişkeni olan kayıtlar ilk dilimde salt okunurdur; henüz desteklenmeyen duraklatma düğmesi gösterilmez.

Ajan detayında:

- Kullanılan profil ve ekip erişimine ilişkin güvenli özet; kişisel telefon/not veya görev içerikleri gösterilmez.
- İzinler Türkçe iş adlarıyla gruplanır. Teknik `scope` adı ayrıntıda kopyalanabilir.
- “Görevleri oku”, “Görev oluştur ve güncelle”, “Yorum ekle”, “İş/pano eşleştirme bilgilerini oku” ayrı seçeneklerdir.
- Teklif taslağı düzenleme ile görev yazma birbirinden bağımsızdır. E-posta gönderme ve yayınlama ayrı izinler olarak kalır.
- Etkin iznin kaynağı: ana tanım, ek görev izni veya ileride veritabanı kaydı.
- Anahtarın kendisi yerine kısa tanımlayıcı; ortam kaydında bilinmeyen oluşturulma tarihi boş gösterilir.
- İkinci dilimde: izin düzenleme, hız sınırı, duraklat/devam et, yeni anahtar ve iptal. Değişiklik kaydı kimin, neyi, ne zaman değiştirdiğini gösterir.

Bu ekran uygulama rollerinin yetki matrisini değiştirmez. Ajan scope'u vermek profilin veya görevin izinlerini genişletmez. Ajan kendi izinlerini değiştiremez.

### C. Uç noktalar

Modül ve işlem adına göre aranan bir katalog:

| Gösterilecek bilgi | Faydası |
| --- | --- |
| Türkçe işlem adı, HTTP yöntemi ve tam yol | Doğru adrese doğru yöntemle istek göndermek |
| Gerekli scope ve ek profil/kayıt koşulları | 403 nedenini anlamak |
| Zorunlu/isteğe bağlı alanlar ve veri tipleri | Eksik veya yanlış veri göndermemek |
| Parametreler, filtreler, sayfalama ve sınırlar | Büyük veriyi doğru okumak |
| Örnek istek ve anonim örnek yanıt | Hızlı entegrasyon |
| İşleme özel tekrar güvenliği ve sürüm kuralları | Çift görev veya yanlış güncelleme oluşturmamak |
| Olası hatalar ve çözüm adımları | Destek süresini kısaltmak |
| Sözleşme sürümü ve ilgili değişiklikler | Entegrasyonu güncel tutmak |

Katalog kaynak kodla kontrol edilen bir sözleşmeye dayanır; elle yazılmış ikinci bir scope listesi oluşturulmaz. Örnekler açıkça örnek olarak işaretlenir, gerçek müşteri/görev verileri kullanılmaz.

İlk kapsam: görev context/liste/detay/yazma/yorum işlemleri; müşteri, teklif seçenekleri, şablonları, taslak/revizyon/kalem işlemleri; e-posta komutları. Yöntem ve alanlar her route'tan doğrulanır. E-posta önizlemesi gibi POST ile çalışan okuma işlemleri yalnız yönteme bakılarak “yazma” sayılmaz.

CAD worker, Resend webhook ve zamanlanmış iç görevler ayrı bağlantı türleridir. Gerekiyorsa envanterde açıklanıp mevcut yönetim sayfalarına yönlendirilir; ortak Grokbot token'ıyla kullanılabilir gibi gösterilmez. Oturumla çalışan dahili API'ler otomatik olarak dış kataloğa açılmaz.

### D. Bağlantı kontrolü ve geliştirici paketi

İki ayrı eylem:

1. **Ayarları kontrol et:** Sunucuda yapılandırma, profil ve seçilen işlemin scope'u doğrulanır. Gerçek bearer isteği yapıldığı iddia edilmez.
2. **Test komutunu kopyala:** Geliştirici kendi güvenli token kaynağıyla salt okuma isteği gönderir. Sonuç ölçümü geldiğinde panel bunu doğrulanmış istek olarak gösterir.

Yeni, salt okunur `GET /api/agent/me` uç noktası önerilir: yalnız çağıran ajanın kimliği, API sürümü ve etkin scope'ları. Token doğrulamasını ve hız sınırını kullanır; başka ajanları, gizli değerleri veya görev içeriğini döndürmez. Bu uç henüz mevcut değildir, Faz 2 teslimidir.

Grokbot'a verilecek paket: temel adres, kimlik doğrulama biçimi, izin listesi, ilgili OpenAPI/rehber, kısa Türkçe görev yönergesi, ortam değişkeninden token okuyan örnek komutlar. Paket mevcut anahtarı içermez. Yazma işlemlerinde tekrar güvenliği, sürüm çakışması ve yetkisiz kaydı zorlamama davranışı açıklanır.

403 teşhis sırası: token doğrulandı mı → gerekli scope var mı → profil uygun mu → hedef kayıt/ekip eylemine izin var mı? Kayıt gizliliği nedeniyle 404 verilmesi gereken durumlarda kaydın varlığı açıklanmaz.

İlk sürümde panelden gerçek görev yaratıp silen veya gerçek e-posta gönderen otomatik test yoktur. Etkileşimli yazma denemeleri ihtiyaç oluşursa ayrı, örnek ortam ve gözden geçirilebilir içerikle planlanır.

### E. İstekler ve hatalar

Zaman, ajan, modül, yöntem, yol şablonu, yanıt kodu, süre ve istek kimliği gösterilir. Ajan/durum/tarih filtreleri ve sayfalama bulunur. Hata ayrıntısı teknik kodun yanında Türkçe neden ve önerilen adımı verir.

Token, Authorization başlığı, tam gövde, görev açıklaması, e-posta içeriği, kişisel verili sorgu dizgesi ve iç sistem hata yığını kaydedilmez. Yol `/tasks/:id` biçiminde tutulur. Idempotency yanıt önbelleği log ekranına veri kaynağı yapılmaz.

Başarı yüzdesi ve gecikme ölçümleri ancak sonuç kaydı devreye girdikten sonra gösterilir. Eski audit kayıtları “işlem girişimi” olarak tanımlanır; geçmişe dönük başarı oranı üretilmez.

## 4. Ayarları uygulamadan yönetme mimarisi

### Veri modeli

- `agent_clients`: sabit ajan kimliği, ad, actor profili, durum, hız sınırı, yapılandırma sürümü ve yönetim zamanları.
- `agent_credentials`: ajan bağlantısı, token'ın kriptografik özeti, güvenli tanımlayıcı, oluşturulma/sona erme/iptal bilgileri. Bir ajan için kontrollü anahtar yenileme sırasında iki geçerli anahtar bulunabilir.
- Scope'lar mevcut izin sözlüğüne bağlı, doğrulanan veri olarak tutulur. Ayrı tablo veya dizi seçimi mevcut sorgu desenlerine göre yapılır; iki yetki kaynağı oluşturulmaz.
- `agent_config_events`: yönetim değişikliklerinin hassas veri içermeyen geçmişi.
- `agent_request_events`: sınırlı süre saklanan istek sonuçları; yönetim geçmişinden ayrı tutulur.

Yeni anahtar sunucuda en az 256 bit rastgelelik ile üretilir; yalnız oluşturulurken bir kez gösterilir, veritabanında SHA-256 özeti saklanır. Sonradan gösterme yerine yenileme kullanılır. Tek seferlik gösterim yanıtı önbelleğe alınmaz, analiz/log araçlarına düşmez. Yeni ajan ayrı otomasyon profiline bağlanır; mevcut profil bağı göç sırasında sessizce değiştirilmez.

Yönetim okuma ve yazmaları sunucuda Yönetici kontrolü yapar; veritabanı politikaları ve fonksiyon izinleri de bunu uygular. Yalnız menüyü gizlemek yeterli değildir. Genel `audit_log` için kaynak migration oturum açmış kullanıcılara okuma izni içeriyor; bu nedenle yeni operasyon kayıtları otomatik olarak buraya konmaz. Etkin RLS ayrıca doğrulanır.

### Mevcut token'ı koruyan geçiş

1. Sunucuda mevcut kaynaklar ayrıştırılır, etkin scope'lar ek görev izinleriyle birleştirilir.
2. Gizli değer içermeyen önizleme: aktarılacak kimlikler, profiller, izinler ve çakışmalar.
3. Mevcut token sunucuda özetlenerek aktarılır; token, `actorId`, ajan kimliği ve mevcut izinler korunur. Ajan kimliği değişmediği için audit ve tekrar güvenliği ilişkileri korunur.
4. Her ajan için tek yetkili kaynak belirlenir. Aktarılan ajan için veritabanı belirleyicidir; izin azaltımı veya anahtar iptali eski ortam tanımına geri düşerek aşılmaz.
5. Aktarılmış kayıt için veritabanı hatasında 503 verilir; eski daha geniş izne sessiz geri dönüş yapılmaz. Henüz aktarılmayan kayıtlar açıkça işaretlenmiş salt okunur eski kaynakta kalabilir.
6. Mevcut Grokbot anahtarıyla görev ve teklif okuma testleri yapılır. Görev yorum/yazma testleri izole test kayıtlarında yürütülür. Üretimde gereksiz veri oluşturulmaz.
7. Kabulden sonra kullanılmayan ortam tanımları kontrollü kaldırılır. Geri dönüş, iptal edilmiş anahtarları yeniden etkinleştiren eski sürüme dönüş değildir; geçiş uyumlu sürüm ve yapılandırma kullanılır.

Başlangıçta yetki iptalini geciktiren önbellek eklenmez; sonraki istekte yeni ayar uygulanır. Performans ölçülmeden Redis veya ayrı API gateway kurulmaz.

### Panelden değişebilen ve yayın gerektiren işler

| İşlem | İkinci dilimde yöntem |
| --- | --- |
| Var olan ajanın scope'u, durumu, hız sınırı | Yönetimden kaydet; yeniden dağıtım gerekmez |
| Yeni anahtar, yenileme, iptal | Yönetimden kontrollü anahtar işlemi |
| Yeni modül veya yeni uç nokta | Kod, sözleşme, test ve yayın gerekir |
| Uygulama rollerinin yetki kuralları | Mevcut kodla tanımlı rol sistemi; bu panelden değişmez |
| Supabase/Vercel altyapı sırları | Mevcut dağıtım ortamında kalır; genel gizli ayar editörü yapılmaz |

## 5. Fazlar ve aradaki kontrol kapıları

### Faz 0 — Envanter ve sözleşme tabanı

Route/yöntem/scope/rol/tekrar güvenliği matrisi çıkarılır. Ajan kaynaklarının önceliği ve eski fallback davranışı belgelenir. Canlı yapılandırma ancak güvenli özet üzerinden karşılaştırılır. Yönetim ve mobil bileşenleri seçilir.

**K0:** Hiçbir gizli değer belgeye, ekran görüntüsüne veya Git'e girmemeli. Mevcut görev/teklif bağlantısı için başlangıç kabul kaydı alınmalı; bilinmeyen durum başarılı kabul edilmemeli.

### Faz 1 — Salt okunur yönetim paneli

Yeni Yönetim sayfası, gezinme bağlantısı, genel bakış ve ajan detayları geliştirilir. Sunucuya özel güvenli yapılandırma DTO'su oluşturulur. Bozuk yapılandırma, boş liste ve erişim reddi durumları tasarlanır. Tasarım ilk olarak `/dev/*-preview` fikstüründe incelenir.

**K1:** Yönetici erişir; Müdür ve diğer roller doğrudan URL ve veri çağrısıyla erişemez. HTML, ağ yanıtı ve istemci paketinde token/ham JSON yoktur. Ek görev izinleri dahil etkin scope'lar mevcut yetkilendirmeyle aynıdır.

### Faz 2 — Katalog, teşhis ve bağlantı paketi

Modül bazlı sözleşmeler bir araya getirilir; arama, kopyalama, OpenAPI/rehber indirme eklenir. `/me` ve salt okuma test yönergeleri tamamlanır. Ayar doğruluğu ile gerçek bağlantı ayrı gösterilir.

**K2:** Örnek yollar uygulamadaki handler'larla eşleşir. Eksik scope, geçersiz token, uygun olmayan profil ve görünmeyen kayıt ayrı senaryolarda doğrulanır. Grokbot'un kendi güvenli anahtarıyla `/me`, izinli `/tasks/context` ve `/tasks` okumaları kabul edilir. API ayarları rol veya özel görev gizliliğini aşmaz.

**İlk teslim:** Kullanılabilir bağlantı/izin/katalog paneli. Yönetici bu aşamada Vercel'e bakmadan mevcut erişimi anlayabilir; henüz panelden izin değiştiremez.

### Faz 3 — Ajan ve anahtar yönetimi

Veritabanı şeması/RLS, yönetim işlemleri, sürüm kontrollü kaydetme, anahtar yaşam döngüsü ve aktarım geliştirilir. Eşzamanlı düzenlemeler sessizce birbirini ezmez. İzin değişikliği önce/sonra özetiyle kaydedilir; e-posta gönderme gibi yüksek etkili kapsamlar ayrı açık seçim ister.

**K3:** Aynı eski token ve ajan kimliğiyle devam; mevcut teklif izinlerinin korunması; yalnız seçilen ajanın değişmesi; duraklatma, izin azaltımı, sona erme, yenileme ve iptalin sonraki istekte uygulanması test edilir. Eski env fallback, yinelenen kimlik ve veritabanı kesintisi iptali aşamaz. Anahtar yenileme geçiş süresi ve eski anahtarın son kullanım anı doğrulanır.

### Faz 4 — Sonuç ölçümü ve hata takibi

İstek kimliği yetkilendirme öncesinde üretilir. Kimlik doğrulama, erken gövde doğrulama, hız sınırı, işlem ve tekrar yanıtı dahil sonuç yolları kapsanır. Başarısız kimlikte saldırganın sunduğu ajan adı doğru kabul edilmez; bilinmeyen istekler sınırlı/toplu kayıtla tutulur. Başlangıç önerisi ayrıntıda 7 gün, günlük toplamlarda 30 gün; gerçek hacme göre ayarlanır.

**K4:** 401/403/422/429/503 ve beklenmeyen hata senaryoları ölçülür; hassas veri sızıntısı ve log hacmi kontrol edilir. Sonuç telemetrisi hatası mevcut işlemi gereksiz yere bozmaz; mevcut zorunlu audit başarısızlığında işlemi durdurma kuralı korunur. En iyi gayretle tutulan ölçümler eksiksiz muhasebe kaydı gibi sunulmaz.

### Faz 5 — Mobil, erişilebilirlik ve bütünleşik kabul

Mevcut `MobileRouteGrid` kullanılır. İç bölüm seçimi mobilde açılır seçim veya sığan satırlar olur; yatay kayan sekme eklenmez. Ajan ve istek tabloları kartlara dönüşür. Uzun URL/scope/kod satırları sarılır; kopyalanan özgün metin bozulmaz. Detaylar açılır alanlarda, filtreler tek kolonda sunulur.

**K5:** 320/360/375/390/430 px ve masaüstü; açık/koyu tema; uzun ad/URL; boş/yükleniyor/hata durumları. 44 px hedef, en az 16 px dokunmatik girdi, klavye ile kullanım ve odak geri dönüşü. Yeni form/diyaloglar mevcut mobil klavye güvenli desenini kullanır. Gerçek iPhone Safari ve ana ekran kullanımında arama, izin düzenleme ve kopyalama kabul edilir; emülasyon fiziksel klavye testi sayılmaz. Mevcut Panel/profil akışlarına regresyon kontrolü yapılır.

### Faz 6 — Yayın ve pilot

Önizleme ortamında göç ve geri dönüş provası; uygun birim/entegrasyon/RLS kontrolleri, tür/lint/build doğrulaması. Önce mevcut Grokbot kaydıyla pilot, ardından diğer ajanların kontrollü aktarımı. Yeni başlatılan bağlantılarda test ve üretim anahtarları ayrı tutulur.

**K6:** Eski anahtarın sürekliliği, görev/teklif sözleşmeleri, yetki azaltımı, rol engeli, fiziksel mobil kabul ve ölçüm doğruluğu kayıt altına alınır. Açık kabul maddeleri tamamlandı gibi işaretlenmez. Geliştirici rehberi gerçek yayımlanan adres ve sürümle güncellenir.

## 6. Öncelik ve kapsam sınırı

**Önce:** Etkin izinleri görünür yapmak, 403 teşhisi, kopyalanabilir bağlantı paketi ve uç nokta kataloğu.
**Ardından:** Mevcut token'ı bozmadan uygulama içinden izin/anahtar yönetimi.
**Sonra:** Güvenilir kullanım/hata ölçümü ve pilot verisine göre iyileştirme.

İlk kapsamda genel Vercel ortam editörü, tüm uygulamaya sınırsız “tam yetki”, panelden yeni API kodu oluşturma, otomatik canlı e-posta denemesi, ayrı geliştirici hesabı/rolü, OAuth platformu, faturalandırma veya yeni servis altyapısı yoktur. Somut ihtiyaç oluşursa ayrı faz olarak değerlendirilir.

Başarı ölçütü: Yönetici “Grokbot niye görev açamıyor?” sorusunda ajanı seçerek izin/profil durumunu anlayabilmeli; geliştirici bağlantı paketinden doğru isteği kurabilmeli; ikinci teslimden sonra rutin görev izni değişikliği Vercel düzenlemesi gerektirmemeli.


## 7. Uygulama ve kontrol kaydı — 12.09.2026

| Faz | Sonuç | Kanıt / açık kabul |
| --- | --- | --- |
| 0 | Tamamlandı | Ortak API, yönetici sınırı, ayrı CAD/webhook/cron envanteri; gizli değerler görüntülenmedi. |
| 1 | Tamamlandı | Yönetim paneli, salt okunur ortam kayıtları ve güvenli veri özeti. Menü bağlantısı eklendi. |
| 2 | Tamamlandı | `/me`, görev sözleşmesinden katalog, ortak e-posta komut izinleri, indirilebilir JSON rehber/şema paketi. |
| 3 | Tamamlandı | Kimliği koruyan aktarım, sürüm kontrolü, yeni/yenilenen/iptal edilen anahtar ve duraklatma. İki Supabase migrationı uygulandı. |
| 4 | Tamamlandı | Erken hata dahil istek kimliği, sabit hata nedenleri, içeriksiz sonuç ölçümü; 7/30 günlük kayıt ve saatlik temizlik. |
| 5 | Otomatik kabul geçti | Chromium ve WebKit için 84'er kontrol: yedi genişlik, beş bölüm, iki tema, ayrıntı ve form penceresi. Gerçek iPhone klavyesi ayrıca açık. |
| 6 | Yayın tamamlandı; pilot aktarım onayı açık | Vercel READY; canlı Yönetim ve indirme kontrolü geçti. Mevcut Grokbot kaydının aktarımı otomatik onay denetimince durduruldu; kullanıcıya somut onay sorusu gönderildi. |

SQL testleri gerçek Supabase üzerinde geri alınan transaction'da çalıştı:
rol engeli, kimlik/token sürekliliği, izin azaltımı, eski sürüm reddi,
duraklatma, 24 saat ve anında anahtar yenileme, iptal/fallback engeli,
kimliksiz istek örneklemesi ve sunucuya özel tablo/RPC izinleri doğrulandı.

Önizleme ekran görüntüleri ve mobil sonuçlar yerel `artifacts/integrations-*`
dizinlerindedir; Git'e kişisel ekran görüntüsü eklenmez. Kullanım yönergesi:
`docs/integrations-admin.md`.

Kapsam kararı: indirilen paket görev OpenAPI'si ile teklif/e-posta girdi
şemalarını bir araya getirir. Bütün modüller için henüz tek bir birleşik
OpenAPI oluşturulduğu iddia edilmez. Mevcut ajanı uygulama yönetimine aktarmak
ayrı ve gözden geçirilebilir bir eylemdir; paneli yayınlamak tek başına izin
veya anahtar değişikliği yapmaz.


### Canlı yayın kabulü

- Yayın: `dpl_EMAFDRsZwLme9PXQB8rnvrnLaMjf`, Vercel `READY`.
- Adres: `https://app.orioncranes.com/admin/integrations`.
- Bağımsız kaynak kopyasında 52 test, kod denetimi, TypeScript ve üretim
  derlemesi geçti. Vercel'in kendi Turbopack üretim derlemesi de geçti.
- Chromium 84, WebKit 84 mobil/görsel kontrol geçti. Üretilen 436 istemci
  JavaScript dosyasında sunucu ayar/secret değişkenlerinin referansı bulunmadı.
- Canlı Yönetim sayfası iki mevcut ajanı ve Grokbot'un iki teklif/dört görev
  iznini gösterdi; ham anahtar görüntülenmedi. Bağlantı paketi indirildi.
- Canlı anahtarsız `/me` ve `/tasks`: 401 ve istek kimliği; oturumsuz Yönetim
  ve paket: girişe yönlendirme; anahtarsız bakım: 403. Geçersiz e-posta JSON'u
  422 ve istek kimliği üretti. Bu deneme kayıtları İstekler ekranında görüldü.
- Mevcut Grokbot kaydını aktaran onay düğmesi otomatik güvenlik denetimi
  tarafından, eylem anında açık kullanıcı onayı eksikliği gerekçesiyle
  reddedildi. Kullanıcıya aktarım onayı soruldu. Bu işlem başka bir yoldan
  denenmedi; mevcut token, actorId ve kapsamlar ortam kaydında korundu.
- Fiziksel iPhone klavyesi ve Grokbot'un kendi secret kaynağıyla gerçek
  yetkili okuma çağrısı ayrı kabul maddeleri olarak açık tutulur.
