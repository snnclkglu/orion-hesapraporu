# Panel ve profil — mobil düzeltme ve sadeleştirme planı

Tarih: 12 Eylül 2026. Durum: Uygulama ve otomatik kontrol fazları yürütüldü; fiziksel iPhone kabulü açık. Gerçekleşme kaydı bölüm 6'dadır.

Bu plan kullanıcının beş ekran görüntüsü ve yedi maddelik geri bildirimine dayanır. 010 planındaki fiziksel mobil kabulün devamıdır. Öncelik sırası: yazı yazmayı engelleyen klavye sorunu, taşmalar, navigasyon ve kart sadeleştirmesi, telefon girişi. Her uygulama fazından sonra kontrol kapısı vardır; başarısız kapı kapatılmadan ilgili iş tamamlandı sayılmaz.

## 1. Bulgular ve kararlar

| Kullanıcı gözlemi | İnceleme bulgusu | Karar |
| --- | --- | --- |
| Menü gereksiz — görsel 1 | Panel navigasyonunda `menu` görünümü ve modül kısayol listesi var. | Masaüstü ve mobil Panel'den Menü sekmesi ve içerik sayfası kaldırılacak. Uygulamanın genel bölüm erişimleri kontrol edilecek. |
| Klavye alanı kapatıyor — görseller 4–5 | Yeni görevde `autoFocus`; ortak Dialog'da mobil alt konum ve `85dvh` sınırı; görev detayında `100dvh` kuralı var. | Otomatik odak, görünür ekran yüksekliği, pencere konumu ve iç kaydırma birlikte düzeltilecek. Bunlar koddan saptanan risklerdir; gerçek cihazdaki kesin neden ölçümle ayrıştırılacak. |
| Kartlar büyük | Mobil kartta geniş boşluklar ve ayrı metadata/eylem alanları var. | Görsel yoğunluk azaltılacak; dokunma alanları küçültülmeyecek. |
| Yatay kaydırma istenmiyor | Mobil dönem şeridinde açıkça `nowrap` ve `overflow-x:auto` kullanılıyor. | Sekmeler ve içerik ekrana sığacak; taşmayı gizlemek çözüm kabul edilmeyecek. |
| Yaklaşan kalabalık | Dönem seçeneklerinde ayrı `upcoming` sekmesi bulunuyor. | Görünen sekmelerden kaldırılacak; eski bağlantılar ve API davranışı ayrıca korunacak. |
| Ekipleri yönet gereksiz | Kısayol mevcut kodda yalnız `role === "admin"` için gösteriliyor. | Panel'den kaldırılacak; Yönetim → Ekipler sayfası ve mevcut yetkileri korunacak. |
| Telefon biçimsiz — görsel 3 | Girdi yalnız `type="tel"`; sunucu şeması ve SQL uzunluk kontrolü yapıyor. | Sabit +90 öneki, biçimlendirme ve istemci/sunucu doğrulaması birlikte yapılacak. |
| Geri bildirim filtreleri bozuk — görsel 2 | Mobilde iki sütunlu filtre düzeni var; görüntüde tarih alanları hücre sınırını aşıyor, eylemler hizalanmıyor. | Dar ekranda form tek sütuna geçecek; tarih alanlarının kendi genişliği de sınırlandırılacak. |

Kullanıcının “Profilde fotoğraf çalışıyor” bildirimi, mevcut cihazdaki fotoğraf kullanımı için olumlu kabul kanıtıdır. Bu kayıt tüm fotoğraf hata senaryolarının veya geri bildirim gizliliğinin kabulü anlamına gelmez. Fotoğraf altyapısı bu planın yeniden geliştirme konusu değildir.

## 2. Hedef ekran düzeni

### Panel navigasyonu ve filtreler

- Alt navigasyon dört bölümden oluşacak: **Görevlerim · Ekip · Panolar · Gelen**. Masaüstünde de Menü bulunmayacak.
- Profil, sağ üst avatardan açılmaya devam edecek. Yönetim/Ekipler erişimi yönetim bölümünde kalacak. Menü kaldırılmadan önce diğer modüllere mobil erişimin hâlâ mümkün olduğu doğrulanacak.
- Mobil dönem kısayolları **Tümü, Bugün, Bu hafta, Geciken** olacak; iki sütunlu, iki satırlı düzen kullanılarak yatay kaydırma kaldırılacak.
- **Tamamlanan ve Arşiv** seçeneklerine Filtrele içinden erişilecek. Seçim yapıldığında aktif filtre ekranda açıkça görünecek ve tek işlemle temizlenebilecek. Masaüstündeki seçenekler satıra sığmazsa alt satıra geçecek.
- Yaklaşan sekmesi kaldırılacak. Eski `period=upcoming` bağlantıları/kayıtlı görünümler aynı sorgu anlamını koruyacak; etkin seçim filtre özetinde gösterilecek ve temizlenebilecek. Sessizce Tümü veya Bu hafta'ya dönüştürülmeyecek. Agent API'deki dönem desteği kaldırılmayacak.
- Eski `view=menu` bağlantısı Görevlerim'e normalleştirilecek; boş sayfa veya geçersiz seçim oluşmayacak.
- Görsellerdeki “PANEL Panel” tekrarının kaynağı incelenip aynı bölüm adının gereksiz tekrarı temizlenecek. Başlık, arama ve eylemler dar ekranda birbirini sıkıştırmayacak.

### Kompakt görev kartı

- Tamamlama kontrolü, görev başlığı ve gerekli durum bilgisi ilk bakışta seçilecek.
- İş kodu (ör. 0065), termin ve öncelik ikinci bilgi satırında yer alacak; sığmadığında dikey akacak.
- Uzun başlık liste kartında en fazla iki satır gösterilebilecek; tam metin görev detayında ve erişilebilir adında korunacak.
- Her kartta tekrarlanan açıklayıcı etiketler ve gereksiz boşluklar azaltılacak. Boş metadata alanları yer kaplamayacak.
- Aynı içerikli mevcut kartlara göre yaklaşık %20–25 daha az yükseklik tasarım hedefidir; uzun içerikleri kırpmak için sabit yükseklik uygulanmayacak.
- Etkileşimli hedefler en az 44 × 44 piksel kalacak; hedefler üst üste binmeyecek. Form yazıları en az 16 piksel olacak.
- Mobil pano mevcut tek sütun/durum seçimi yaklaşımını koruyacak. Kolonlar arasında yatay sürükleme zorunluluğu oluşmayacak.

### Telefon alanı

- +90, alanın sabit öneki olarak hazır görünecek. Boş alanda birleşik görünüm **+90 (xxx) xxx xx xx** olacak; maske silik, alan etiketi kalıcı olacak.
- Alan isteğe bağlı kalacak: kullanıcı numara yazmazsa yalnız +90 kaydedilmeyecek, değer boş kalacak.
- On ulusal rakam girilecek; boşluk ve parantez otomatik düzenlenecek. Yapıştırılan +90, 0090 veya tek ulusal 0 öneki tanınıp aynı biçime getirilecek.
- Fazla/eksik rakam veya desteklenmeyen içerik açık hata verecek; rakamlar sessizce kesilip farklı bir numara kaydedilmeyecek.
- Yalnız cep telefonu istendiği belirtilmediğinden 5 ile başlama zorunluluğu getirilmeyecek. Biçim doğrulaması numaranın sahibini veya kullanımda olduğunu doğrulama iddiası taşımayacak.
- Geçerli yeni değerler +90 ve on rakam içeren ortak saklama biçimine dönüştürülecek. Mevcut değerler topluca değiştirilip silinmeyecek; değişmemiş eski numara diğer profil alanlarının kaydını engellemeyecek. Numara düzenlenirse yeni doğrulama uygulanacak.
- Kullanıcının açık maske talebi, depodaki genel örnek placeholder yasağının bu alan için istisnasıdır; maske gerçek veri sayılmayacak.

## 3. Uygulama ve kontrol fazları

### F0 — Sorunları yeniden üret ve başlangıç ölçümlerini kaydet

1. Çalışma ağacı, test edilen sürüm ve mevcut değişiklikler kaydedilecek; kapsam dışı çalışmalar korunacak.
2. İlgili `/dev/*-preview` ekranları önce incelenecek; ardından oturumlu gerçek akışlar kontrol edilecek.
3. Yeni görev, görev düzenleme, yorum, pano oluşturma, filtre, kayıtlı görünüm, profil ve geri bildirim formlarının odak/klavye davranışı listelenecek.
4. Pencere açılışı, klavye açık/kapalı, alanlar arası geçiş, ekran döndürme ve pencere kapatmada görünür yükseklik, odaklanan alan ve kaydırma konumu ölçülecek. Form içeriği ölçüm kayıtlarına alınmayacak.
5. Başlangıç ekranları, kart yüksekliği ve taşan elemanlar kaydedilecek. Kullanıcının kişisel bilgili ekran görüntüleri Git'e eklenmeyecek.

**K0 — Başlangıç kontrolü:** Her sorun için tekrar adımı, ilgili bileşen ve doğrulama yöntemi bulunmalı. Emülasyonda tekrar edilemeyen fiziksel klavye hatası “sorun yok” diye kapatılmamalı.

### F1 — iPhone klavyesi ve açılır form davranışı (en yüksek öncelik)

1. Mobilde form açılır açılmaz klavye çıkarmak yerine ilk odak pencere başlığına/uygun metin dışı elemana alınacak; kullanıcı alana dokunduğunda klavye açılacak. Masaüstü hızlı giriş korunacak. Radix'in varsayılan odak davranışı da ele alınacak; yalnız `autoFocus` silinmesiyle yetinilmeyecek.
2. Pencere görünür ekran alanına göre konumlandırılacak. `dvh` kuralları, gerektiğinde `visualViewport` yükseklik ve üst ofset ölçümüyle birlikte değerlendirilecek; sabit bir klavye yüksekliği varsayılmayacak.
3. Başlık/kapatma, kaydırılabilir form gövdesi ve kaydetme eylemi düzenlenecek. Çok kısa görünür alanda sabit eylem bölümü formu boğmayacak; eylemler dikey kaydırmayla erişilebilir kalacak.
4. Odaklanan alan ve imleç örtülüyorsa yalnız ilgili kaydırma bölgesi gerektiği kadar hareket ettirilecek. Sürekli sayfa zıplatma, odak döngüsü ve çift kaydırma önlenecek.
5. Modal açıkken alt navigasyon ve yeni görev düğmesi formun üzerine gelmeyecek. Klavye kapanınca, telefon döndürülünce veya pencere kapatılınca konum ve odak düzgün geri dönecek; taslak kaybolmayacak.
6. Ortak Dialog başka modüllerde de kullanıldığı için ilk çözüm Panel/hesap formlarına kontrollü uygulanacak. Ortak bileşen değişirse etkilenen diğer modüller de regresyon kapsamına alınacak.
7. Kullanıcı yakınlaştırması kapatılmayacak; klavyeyi zorla kapatmaya dayalı bir çözüm kullanılmayacak.

**K1 — Klavye kontrolü:** Fiziksel iPhone'da yeni görev başlığı, açıklama, yorum, profil telefonu/özel not ve geri bildirim metni yazılırken alan ve imleç görünür olmalı. Kaydet/kapat ulaşılabilir olmalı; alan değiştirme, uzun metin, klavyeyi kapatıp yeniden açma ve ekran döndürme taslağı kaybettirmemeli. Bu kapı yalnız WebKit emülasyonuyla geçilemez.

### F2 — Navigasyon, başlıklar ve yatay taşmanın kaldırılması

1. Menü sekmesi/içeriği kaldırılacak, dört bölümlü alt navigasyon dengelenecek ve eski URL davranışı uygulanacak.
2. Ekipleri yönet Panel kısayolu kaldırılacak. Yönetim sayfası ve sunucu yetki kontrolleri korunacak. `admin` uygulamada Yönetici; `manager` ayrı Müdür rolüdür; roller birbirinin yerine kullanılmayacak.
3. Dönem kısayolları yukarıdaki yeni düzene geçirilecek; Tamamlanan/Arşiv filtreleri erişilebilir kalacak.
4. Geri bildirim filtreleri mobilde tek sütuna alınacak. Tarih girdileri ve iç sarmalayıcılar sütun genişliğine uyacak; Süz/Temizle eylemleri sığdığı ölçüde iki sütun, dar durumda alt alta yerleşecek.
5. Arama, görünüm seçicileri, ekip seçimi, uzun ekip/pano adları, görev detayları, dosya adları, yorum bağlantıları ve haftalık ajanda denetlenecek. Uzun içerik kırılacak veya uygun dikey düzene geçecek.
6. Birbiriyle yarışan mobil CSS kuralları düzenlenecek; yalnız en sona yeni override eklemek veya `overflow-x:hidden` ile içeriği kesmek yeterli sayılmayacak.

**K2 — Yerleşim ve yetki kontrolü:** Sayfa ve alt bileşenlerde yatay kaydırma gerekmemeli; hiçbir tarih alanı, düğme veya başlık komşusuyla çakışmamalı. Eski Menü/Yaklaşan bağlantıları ve kayıtlı görünümler denenmeli. Yönetici yönetimden ekip düzenleyebilmeli; yetkisiz kullanıcı doğrudan adrese/API'ye giderek erişememeli. Kişiye özel görevlerin görünürlüğü değişmemeli.

### F3 — Kartların ve mobil görsel yoğunluğun düzenlenmesi

1. Kart boşlukları, başlık satır yüksekliği ve metadata yerleşimi hedef tasarıma göre düzenlenecek.
2. Birincil tamamlama işlemi kolay kalacak; ikincil eylemler görev detayında erişilebilir olacak.
3. Tekrarlanan başlıklar ve boş alanlar temizlenecek. Renk, öncelik ve gecikme anlamları mevcut tasarım değişkenleriyle korunacak.
4. Boş liste, uzun başlık, kodsuz görev, atanmamış ekip görevi, yüksek öncelik, geciken ve tamamlanan görev örnekleri mevcut test/önizleme verisiyle değerlendirilecek.

**K3 — Görsel kontrol:** Aynı içerikle önce/sonra karşılaştırılmalı; kompakt görünüm okunurluğu azaltmamalı. Dokunma hedefleri ölçülmeli, yanlışlıkla görev açma/tamamlama çakışması olmamalı. Açık/koyu temada durumlar anlaşılır kalmalı.

### F4 — Telefon maskesi ve tutarlı kayıt doğrulaması

1. Saf telefon normalleştirme/doğrulama yardımcıları ve profil girdi davranışı hazırlanacak.
2. İmleç konumu, rakam silme, seçili metni değiştirme, ortadan düzenleme, yapıştırma ve mobil telefon klavyesi desteklenecek; `autocomplete="tel"` davranışı kontrol edilecek.
3. Profil sunucu eylemi ve Zod şeması aynı kurala bağlanacak. Doğrudan kayıt yolunun istemci doğrulamasını atlamaması için mevcut SQL kayıt fonksiyonu da incelenecek.
4. SQL değişikliği gerekiyorsa yeni ve çakışmayan migration hazırlanacak; uygulanmış migration düzenlenmeyecek. Eski değerlerin korunması ve değişmeden kaydı açıkça ele alınacak.
5. Hata telefon alanının yanında gösterilecek; diğer girilmiş profil bilgileri korunacak. Fotoğraf yükleme akışına yalnız regresyon kontrolü yapılacak.

**K4 — Veri kontrolü:** Boş, on rakamlı, +90/0090/0 önekli yapıştırma; eksik, fazla, harfli ve farklı ülke önekli girişler; eski biçimsiz numarayla diğer profil alanını kaydetme; numarayı tamamen temizleme sınanmalı. Geçersiz yeni numara sunucuya doğrudan gönderilince de reddedilmeli. TS/SQL kuralları kaynak tutarlılığı testiyle ayrışmamalı. Üretime uydurma profil/telefon kaydı girilmemeli.

### F5 — Birleşik regresyon ve gerçek cihaz kabulü

1. İlgili birim testleri, etkileşim kontrolleri, tip/lint denetimi ve üretim derlemesi çalıştırılacak. Kozmetik değişiklikleri aynalayan gereksiz testler eklenmeyecek; telefon verisi ve klavye/yerleşim davranışı hedeflenecek.
2. Mevcut mobil otomasyon yalnız belge genişliğini ölçmekle kalmayacak: filtre hücreleri, tarih alanları, düğmeler ve modal içerik sınırları da denetlenecek. Belgenin taşmaması hücrelerin çakışmadığını kanıtlamaz.
3. Gerçek iPhone Safari'de K1 akışları ve kullanıcının ekran görüntülerindeki senaryolar yeniden uygulanacak. Ana ekrana eklenmiş uygulama kullanılıyorsa o görünüm de ayrıca kontrol edilecek.
4. Profil fotoğrafı, geri bildirim gönderimi/geçmişi, Yönetim geri bildirim listesi, ekip havuzu, kişisel görev, atama ve tamamlama regresyondan geçirilecek.
5. Sonuçlar sürüm, cihaz/tarayıcı, senaryo ve geçti/kaldı/bekliyor bilgisiyle kaydedilecek. Önceki sürüm testleri yeni sürümün kanıtı sayılmayacak.

**K5 — Yayın kapısı:** Klavye arkasında kalan alan, erişilemeyen kaydetme, yatay taşma, kaybolan taslak veya yetki hatası varsa yayın adayı tamamlandı sayılmayacak. Fiziksel iPhone erişimi yoksa bu kabul açık olarak raporlanacak; simülasyon sonucu gerçek cihaz sonucu diye sunulmayacak.

### F6 — Teslim ve yayın sonrası kontrol

1. Bu planın gerçekleşme kaydı, ilgili arayüz kuralları ve kontrol sonuçları güncellenecek.
2. Değişiklikler gözden geçirilip kabul edilen sürüm kaydedilecek; yayın sırasında veritabanı/arayüz uyumu ve geri dönüş yolu kontrol edilecek.
3. Git/yayın işlemleri mevcut kullanıcı yetkilendirmesi kapsamında, doğrulanan değişikliklerle yürütülecek; yalnız bu plan hazırlanırken uygulama yayını yapılmayacak.
4. Yayımlanan sürümde oturum açma, görev oluşturma, mobil form odağı, profil ve filtreler yeniden kontrol edilecek.

**K6 — Kapanış:** Kullanıcının yedi maddesi ayrı ayrı karşılanmış veya açık kalan gerekçesiyle raporlanmış olmalı; “mobil uyumlu” şeklinde toplu ve kanıtsız kapanış yapılmamalı.

## 4. Kontrol matrisi

| Boyut/ortam | Temel kontrol |
| --- | --- |
| 320 ve 360 piksel | En dar yerleşim; düğme, başlık, tarih ve kart sınırları |
| 375, 390 ve 430 piksel | iPhone boyutlarında tüm Panel/profil/geri bildirim akışları |
| Fiziksel iPhone Safari | Gerçek klavye, yardımcı giriş çubuğu, otomatik doldurma, tarayıcı çubukları ve odak |
| Yaklaşık 844 × 390 yatay | Kısa yükseklikte modal, kaydetme/kapatma ve yön değiştirme |
| 768/820 piksel tablet | Mobil/masaüstü kırılımı ve form düzeni |
| 1440 piksel masaüstü | Menü kaldırılması, hızlı görev girişi ve Dialog regresyonu |
| Açık/koyu tema; %200 metin büyütme | Okunurluk, yeniden akış ve kesilmeyen eylemler |
| Yönetici, Müdür ve normal ekip üyesi | Mevcut rol sınırları, ekip ve kişisel görev görünürlüğü |

## 5. Beklenen dosya kapsamı

- `src/app/(app)/panel/task-workspace.tsx` ve `task-workspace.css`: navigasyon, dönemler, kısayollar, kartlar ve görev formları.
- `src/components/ui/dialog.tsx`: yalnız gerekli ortak pencere davranışı; kapsam genişlerse ek regresyon.
- `src/components/account/responsive-task-filters.tsx` ve kayıtlı görünüm bileşenleri: filtre erişimi ve mobil pencereler.
- `src/components/account/account-view.tsx`, `feedback-list.tsx`, `account.css`: telefon alanı ve geri bildirim yerleşimi.
- `src/lib/tasks/model.ts`: görünüm/URL uyumluluğu; API dönem sözleşmesini yanlışlıkla daraltmama.
- `src/lib/account/model.ts`, profil sunucu eylemi ve gerekirse yeni Supabase migration: telefon kayıt doğrulaması.
- İlgili mobil kontrol betikleri, telefon testleri ve `docs/agent/arayuz.md`: ölçülebilir doğrulama ve kalıcı kural kaydı.

Bu planı uygulamaya hazırlamak için kullanıcıdan yeni token, hizmet veya dosya gerekmiyor. Fiziksel iPhone'daki son klavye kabulünde cihaz üzerinde tekrar kontrol gerekecek; geliştirme ve otomasyon bu adım beklenmeden ilerleyebilir.

## 6. Gerçekleşme ve kontrol kaydı — 12 Eylül 2026

| Faz | Gerçekleşen | Kontrol durumu |
| --- | --- | --- |
| F0 / K0 | Gerçek bileşen önizlemeleri ve beş kullanıcı görüntüsü incelendi. Önceki kontrolün 56 belge genişliği ölçümü geçtiği halde yatay dönem şeridini yakalamadığı görüldü. | Başlangıç tamamlandı; yeni kontrol alt bileşenleri de ölçüyor. |
| F1 / K1 | Panel Dialog'ları görünür ekran yüksekliği/üst ofsetiyle sınırlandı. Mobil otomatik metin odağı kaldırıldı. Profil/geri bildirim odak görünürlüğü eklendi. Hızlı kişi/tarih seçicisi mobilde Dialog kullanıyor. | Küçültülmüş görünür alan, yeni görev ve yorum taslağı WebKit'te geçti. İlk yorum kontrolü hatayı yakaladı; Safari'nin sonraki odak kaydırmasına karşı sınırlı, kullanıcı hareketinde iptal edilen düzeltmeyle tekrar geçti. Fiziksel klavye kabulü açık. |
| F2 / K2 | Menü ve Ekipleri yönet kısayolu kaldırıldı; dört alt sekme, 2×2 dönemler, arşiv/tamamlanan filtresi, eski URL uyumu, tek sütun geri bildirim filtreleri uygulandı. | 320–1440 aralığında belge ve hücre taşmaları ölçüldü. Eski Menü → Görevlerim, Yaklaşan → aynı filtre + görünür özet geçişi sınandı. Yetki RPC'leri değiştirilmedi; görev/ekip SQL regresyonu geçti. |
| F3 / K3 | Kartlar sıkılaştırıldı; mobilde termin metadata satırına taşındı, yinelenen pano etiketi kaldırıldı. Sorumlu hedefi 44px kaldı, başlık iki satırla sınırlı ve tam erişilebilir adı korundu. Panel başlık tekrarı kabukta yalnız Panel için giderildi. | Açık/koyu ekran görüntüleri incelendi. Sabit kart yüksekliği veya yatay içerik kesme kullanılmadı. |
| F4 / K4 | +90 öneki, boş maske, imleci zorlamayan yazma ve odaktan çıkışta biçimlendirme eklendi. İstemci/sunucu/SQL yeni numarayı doğruluyor; değişmeyen eski numara korunuyor. | Telefon birim/SQL kontrolleri geçti. `20260912160000_task_phone_validation.sql` uygulandı; toplu telefon dönüşümü yapılmadı. |
| F5 / K5 | Mobil regresyon betiği genişletildi; WebKit akışlarında filtre, görünüm, hafta, kontrol listesi, tekrar ve yorum sınandı. Fotoğraf dahil eski yedi etkileşim akışı geçti. | Fiziksel iPhone/Safari ve varsa ana ekran uygulaması kabulü hâlâ kullanıcı cihazında yapılmalı. Otomasyon gerçek klavye testi diye raporlanmaz. |
| F6 / K6 | Teslim belgeleri ve arayüz kuralları güncellendi. | Derleme/yayın sonucu teslim mesajında ve aşağıdaki yayın kaydında belirtilir; fiziksel kabul açık kalır. |

### Kanıtlar ve uygulama kararları

- `scripts/panel-mobile-revision-check.cjs`: dokuz ekran genişliği × dört ekran × iki tema = 72 yerleşim kontrolü; beş mobil akış grubu ile 77 kayıt. Ek olarak 390px'te eski URL, yorum görünürlüğü ve kişi seçimi sınanır.
- `artifacts/panel-revision-webkit/`: önceki başarısız yorum senaryosu düzeltildikten sonraki rapor ve ekranlar. `comment-visible-viewport.png` gerçek klavye fotoğrafı değil, görünür alanın programatik küçültülmesidir.
- `scripts/account-interaction-check.cjs --webkit`: profil, fotoğraf kırpma, ekip arama/seçim, geri bildirim, kişiye özel görev, gönderen listesi ve büyütülmüş metin akışları geçti.
- `scripts/task-workflow-mobile-check.cjs --webkit`: 375/390/430 × iki tema altında filtre, kayıtlı görünüm, hafta, kontrol listesi, tekrar ve yorum kontrolleri geçti.
- `scripts/task-db.py test`: mevcut görev, hesap, bakım ve yeni telefon senaryoları aynı geri alınan transaction içinde geçti. Eski testteki üç rakamlı telefon örneği yeni kurala uygun kontrollü test değeriyle değiştirildi; üretimde test kaydı bırakılmadı.
- Genel uygulama gezinmesi, üstteki marka düğmesiyle erişilebilir kalır. Kaldırılan Menü, Panel'in beşinci sekmesidir.
- Mobilde karttaki termin metni görev detayından düzenlenir; bu sayede sağ kenarda iki büyük eylem satırı oluşmaz. Masaüstü hızlı tarih seçimi korunur.
- Kullanıcının fotoğrafın çalıştığı bildirimi korunmuştur. Görsel yükleme hizmetleri ve Grokbot yetki ayarları bu düzenlemede değiştirilmedi.

### Fiziksel kabulde kalan kısa liste

Son otomatik sonuç: **64 test / 11 dosya**, Chromium ve WebKit'te **77 + 77 mobil kontrol kaydı**, iki motorda yedi eski etkileşim akışı, WebKit'te altı görev akışı grubu, hedefli ESLint ve TypeScript denetimi geçti. Üretim derlemesi 150 statik sayfa üretimiyle tamamlandı. İlk derlemedeki Google Fonts ağ engeli, izinli ağla yeniden çalıştırıldığında giderildi. SQL migrationı uygulanmış durumda. Ekran görüntüsü/raporlar `artifacts/` altında yereldir ve Git'e eklenmez.

1. Yeni görev aç: klavye kendiliğinden açılmamalı; başlığa dokunup yazarken alan görünmeli.
2. Detayda yorum, açıklama ve kişi araması yaz; klavye açıkken dikey kaydırmayla eylemlere ulaş.
3. Klavyeyi kapat/aç ve telefonu döndür; taslak ve odak konumu korunmalı.
4. Geri bildirim tarihleri aynı hücre içinde kalmalı; Panel'de yatay kaydırma gerekmemeli.
5. Telefonu yapıştır, ortasından düzenle, sil ve kaydet; boş alan yalnız +90 kaydetmemeli.

Bu maddeler fiziksel cihazda doğrulanmadan bütün kabul kapıları kapatılmış sayılmaz.
