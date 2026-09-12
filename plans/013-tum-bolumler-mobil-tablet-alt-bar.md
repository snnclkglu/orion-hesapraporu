# 013 — Tüm bölümlerde mobil ve tablet alt barı

Tarih: 12.09.2026
Durum: **Uygulandı. Son doğrulama ve kontrol kanıtları aşağıda; fiziksel cihaz kabulü ayrı tutulur.**
Talep: Panelde beğenilen alt barın telefon ve tabletlerde bütün bölümlere yayılması; her bölümde 4 veya en fazla 5 kullanışlı öğe.

## 1. Önerinin özü

Panelin görsel dilini ortaklaştırıp alt barın içeriğini kullanıcının bulunduğu çalışma alanına göre belirleyelim. Bölüm ana sayfasında bölümün işleri; bir kayıt açıldığında o kaydın bölümleri; belge görüntülerken belge araçları öne çıksın. **Ekranda aynı anda tek alt bar** bulunsun.

Varsayılan dört öğe. Beşinci öğe, gerçekten ayrı ve önemli bir hedefi görünür tutuyorsa eklensin. Sırf sayı doldurmak için yeni işlev, favori sistemi, raporlama ekranı veya boş sekme üretilmesin.

Bu çalışma kod ve alan kuralları incelemesine dayanır. Gerçek kullanıcıların sekme tıklama sıklığı, canlı oturumları veya kullanım süreleri analiz edilmedi. Aşağıdaki öncelikler **iş akışına dayalı tasarım hipotezleridir**; kullanıcı yorumu ve fiziksel cihaz pilotuyla doğrulanacaktır. Mevcut kullanım ölçümü bölüm düzeyindedir; alt bar öğelerinin hangisinin daha sık kullanıldığını kanıtlamaz.

## 2. Mevcut yapıda tespit edilenler

| Tespit | Tasarıma etkisi |
| --- | --- |
| Ana menüde 12 çalışma alanı var: Panel, İşler, Teklif, Mühendislik, Teknik Araçlar, Teknik Resimler, Çizim İşleme, Satın Alma, İş Takibi, Satış Takibi, Personel, Yönetim. | Plan yalnız birkaç liste sayfasıyla sınırlı kalmamalı. |
| Panelin mevcut dört öğesi Görevlerim / Ekip / Panolar / Gelen. | İçerik ve sıra korunmalı. Menü veya Ekip Yönetimi yeniden buraya eklenmemeli. |
| Panelde alt konumlandırma şu anda 767px ve altında; 768px üzerindeki tabletler aynı alt barı almıyor. | Panelin kendisi de tablet kapsamına alınmalı. |
| Birçok bölüm `MobileRouteGrid` veya `MobileSectionGrid` ile üstte çok satırlı kutular kullanıyor. | Mobilde aynı hedeflerin üst kutuları ve alt bar birlikte gösterilmemeli. |
| Kabuk 1024px civarında masaüstü menüsünü açıyor; bazı bölüm geçişleri 768px, bazıları 1024px kullanıyor. | Yalnız `md:hidden` değişikliğiyle bütün tabletler kapsanamaz; ortak görünüm kuralı gerekir. |
| Satın Alma ile Hammadde, İşler ile iş ayrıntısı, Teklif ile maliyet editörü iç içe. | Alt bar sahipliği en özel çalışma alanına verilmeli. İki bar üst üste gelmemeli. |
| İş Takibi ve Satış Takibi üç ana rotalı; İşler ve Mühendislik ana ekranları esasen liste. | Dört ayrı navigasyon hedefi zorlamak yerine bazı alanlarda karma araç barı gerekli. |
| Katalog bağımsız katalog tarama uygulaması değil, ürün kimliğiyle açılan teknik sayfa görüntüleyicisi. | “Kategoriler / Favoriler / Geçmiş” gibi mevcut olmayan bölümler varsayılmamalı. |
| Pano Yerleşimi yerel sekme değişiminde yeniden sunucu hesabını özellikle önlüyor. | Ortak bar, her tıklamayı URL gezinmesine dönüştürmemeli. |
| Formlar, sabit çerçeveli editörler, alttaki görev oluştur düğmesi ve görünür ekran yüksekliğine uyan pencereler mevcut. | Alt bar yüksekliği, klavye ve kaydırma düzeni birlikte ele alınmalı. |

`docs/agent/arayuz.md` MOBIL-32, önceki kapsam için Panel barının diğer editörlere yayılmamasını söyler. Bu yeni kullanıcı talebi kapsamı açıkça genişletiyor. Uygulama aşamasında bu kural ve ilgili eski “mobilde ızgara kalır” kuralları yeni tasarımla uyumlu güncellenecek. Bu eski kapsam notu yeni talep için ek izin gerektirmez.

## 3. Tasarım dayanağı ve ORION'a uyarlama

[Android'in resmi gezinme rehberi](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns) aynı hiyerarşide 3–5 hedefi, gezinme ile işlem düğmelerinin ayrılmasını ve önemli tek bir oluşturma eylemini destekliyor. Aynı rehber geniş ekranlarda yan gezinmeyi öneriyor. Dolayısıyla “bütün modern uygulamalar tablette alt bar kullanır” genellemesi doğru değil.

ORION kararı: Kullanıcının telefon ve tablette aynı alt erişim alışkanlığını sürdürme talebine göre tabletlerde de alt bar sunulacak. Geniş tablette beş düğmeyi ekranın iki ucuna dağıtmak yerine, alt zemin içinde ortalanmış ve erişilebilir genişlikte bir grup kullanılacak. Bunun ergonomisi fiziksel tablette ayrıca sınanacak.

[Apple'ın sekme çubuğu rehberi](https://developer.apple.com/design/human-interface-guidelines/tab-bars) ikonla beraber metin etiketi kullanımını destekliyor. ORION'da da yalnız ikonlu bar önerilmiyor. Buradaki ürün kararları, bu kaynakların ORION'a uygulanmasıdır; kaynaklarda ORION'un bölüm seçimleri bulunmaz.

### Üç davranış, tek görsel aile

1. **Gezinme:** Ekipman, Siparişler, Maaş gibi bir sayfa veya içerik bölümü açar. Açık hedef belirgin seçili görünür.
2. **Araç:** Ara, Filtrele, İş Listesi gibi bir kontrol açar. Dokununca seçili sayfa izlenimi yaratmaz. Açık pencere durumu ayrı belirtilir.
3. **Görüntüleyici araçları:** Sayfalar, Yakınlaştır, İndir gibi belgeyi incelemeyi kolaylaştırır. Navigasyon sekmesi olarak sunulmaz.

“Diğer” yalnız bulunulan bölümün kalan hedeflerini ve ikincil işlemlerini açar. Genel uygulama menüsünün kopyası değildir. İçinde **Bölümler** ve **İşlemler** ayrılır; bir alt menünün içine bir alt menü daha açılmaz. İkincil hedefe en fazla iki dokunuşta ulaşılır. Diğer içindeki bir sayfa açıksa bar bu aidiyeti gösterir; sayfa başlığında gerçek bölüm adı bulunur.

Genel bölüm değiştirme, mevcut üst menüden yapılmaya devam eder. Panelin barına Menü eklenmez. İleride ihtiyaç görülürse üstteki bölüm adı aynı genel menüyü açan daha belirgin bir giriş olabilir; ayrı menü veri kaynağı kurulmaz.

## 4. Ana bölümlerin önerilen alt barları

Tabloda soldan sağa gösterim sırası verilmiştir. **Araç** olarak belirtilen öğeler sekme değildir.

| Bölüm | Önerilen öğeler | Sayı | Gerekçe ve Diğer içeriği |
| --- | --- | --- | --- |
| Panel | **Görevlerim · Ekip · Panolar · Gelen** | 4 | Beğenilen yapı korunur. Görev ekleme barın üstünde tek ana eylem olarak kalır. Gelen rozeti görev alanına aittir; genel bildirim ziliyle birleştirilmez. |
| İşler | **İşler · Ara · Filtrele · Diğer** | 4 | Telefonda ilk ihtiyaç doğru işi bulmaktır. Ara ve Filtrele araçtır. Diğer: mevcut görünüm seçenekleri, arşiv/durum erişimi ve yetkili kullanıcıda Yeni İş. Yeni bir genel görev/takvim ekranı icat edilmez. |
| Teklif | **Teklifler · Hesaplar · Analiz · Diğer** | 4 | Görüşmede teklife ulaşma, teklif hesabına bakma ve teklif durumunu değerlendirme. Hesaplar yalnız `/offers/hesap-raporlari` kapsamıdır. Diğer: Tanımlar, Maliyet Şablonları, Hammadde Fiyatları. Yeni teklif mevcut oluşturma akışını açar. |
| Mühendislik | **Projeler · Ara · Filtrele · Diğer** | 4 | Doğru işin/projenin raporuna ulaşma öncelikli. Ara/Filtrele araçtır. Diğer: mevcut liste seçenekleri ve yetkiye göre yeni proje. Arşiv mevcut durum süzgecinden yönetilir; ikinci arşiv veri modeli oluşturulmaz. |
| Teknik Araçlar | **Ağırlık · Profiller · Kama · Tolerans · Tümü** | 5 | Sahada tekrar kullanılabilecek dört hesap/başvuru aracı doğrudan erişilir. Tümü mevcut `/tools` dizinidir; Raylar, Cıvata, Segman, Keçe, Aks tutucu ve Erişim dahil bütün araçları gösterir. Bu dörtlünün kullanım sıklığı henüz ölçülmedi. |
| Teknik Resimler | **Paketler · Ara · Filtrele · Diğer** | 4 | Atölyede doğru işin doğru paketini hızlı bulma. Diğer: `/drawings/stages` üretim aşamaları ve yetkiye göre Klasör Yükle. Paket içi Parçalar ve Üretim, bir paket seçildikten sonra öne çıkar. |
| Çizim İşleme | **İşlemler · Hazırla · Sonuçlar · Bağlantı** | 4 | Mevcut tek sayfanın dört çalışma bölümü ayrılır. İşlemler geçmiş/liste; Hazırla dosya ve ayar formu; Sonuçlar seçilmiş işlemin incelemesi; Bağlantı hedef bilgisayarın durumu. Yeni arka uç gerektirmez; görünüm ayrıştırması gerekir. |
| Satın Alma | **Ekipman · Hammadde · Siparişler · Teslim · Diğer** | 5 | Talep → sipariş → teslim zinciri tek dokunuşta. Teslim mevcut teslim takvimidir. Diğer: Fiyat Arşivi ve Sarf alanına giriş; mevcut ilgili yardımcı bağlantılar yalnız erişim izinleriyle gösterilir. |
| İş Takibi | **Günlük · Kayıtlar · Analiz · Dönem** | 4 | Günlük kayıt, geçmiş kontrolü ve adam·saat analizi. Dönem bir araçtır: Günlük'te gün seçer; Kayıtlar/Analiz'de tarih aralığını düzenler. Seçilen kapsam pencerenin başlığında açıkça yazılır. Mevcut tarih/süzgeç mantığı kullanılır. |
| Satış Takibi | **Satış · Faturalar · Ciro · İş Listesi** | 4 | Ticari liste, fatura ve müşteri cirosu ayrı hedefler. İş Listesi, mevcut fiyatsız referans belgesinin yıl/çıktı seçicisini açan araçtır. Dokununca doğrudan indirme veya gönderme başlamaz. |
| Personel | **Personel · Maaş · Harcirah · Özet · Diğer** | 5 | Kişi bulma, dönem maaşı, saha giderleri ve toplam kontrolü. Diğer: Ücret Planı, Kurlar. Yalnız yöneticinin varsayımsal ihtiyacına göre personel erişimleri genişletilmez. |
| Yönetim | **Kullanıcı · Ekipler · Yetkiler · Geri Bildirim · Diğer** | 5 | Kullanıcı/ekip erişim yönetimi ve gelen geri bildirimlerin değerlendirilmesi. Geri Bildirim iki satırlı etiket olabilir; genel bildirim merkeziyle karıştırılmamalı. Diğer tüm yönetim hedeflerini gruplar. |

Yönetim için kesin metin önerisi **Kullanıcı / Ekipler / Yetkiler / Geri Bildirim / Diğer**. Beş öğeli barda iki satır etiket desteği bunun için de gereklidir. Diğer grupları: Operasyon (e-posta, silme onayları), Defterler (müşteri, tedarikçi, sarf), Teknik (ekipman, kaplin, ray, standart ve kalite), Şablon/Ayar (görev, el kitabı, rapor ve profil puanlama). Uygulama anındaki gerçek Yönetim kayıt listesi tamamıyla eşleştirilir; bu planla eşzamanlı eklenebilecek yeni yönetim hedefleri ayrıca envantere alınır.

### Ana listelerde neden Ara ve Filtrele var?

İşler, Mühendislik ve Teknik Resimler ana ekranlarında dört doğal eş düzey sayfa bulunmuyor. “Aktif / Arşiv / Favori / Son Kullanılan” şeklinde bir bar, liste süzgeçlerini uygulamanın ana mimarisine dönüştürür ve mevcut olmayan kalıcı özellikler gerektirebilir. Önerilen karma bar, mevcut listeyi ve kontrollerini başparmak erişimine taşır.

Ara, o bölümdeki aramayı açar; bütün uygulamayı aramaz. Filtrele mevcut koşulları gösterir, uygulamadan listeyi değiştirmez. Uygula/Tümünü temizle belirgindir; iptal mevcut süzgeci korur. Etkin filtre sayısı küçük rozetle, koşullar içerikte kısa metinle gösterilebilir.

## 5. Kayıt ayrıntıları ve uzman çalışma alanları

Alt bar **açık kayıt bağlamında** değişebilir; aynı kaydın içinde sık kullanılan öğelerin sırası kendiliğinden değişmez. Üst başlık iş numarasını/proje adını, belge ekranı revizyonunu korur. Üst geri oku gerçek üst kayda döner.

| Açık çalışma alanı | Alt bar | Kalan hedefler ve davranış |
| --- | --- | --- |
| İş ayrıntısı `/jobs/[id]` | **Özet · Görevler · Akış · Bağlantılar · Diğer** | Mevcut Genel Bakış, görevler, olay akışı ve bağlantılar. Diğer: Teklif Dokümanı ve Yayın/Bildirimler; yalnız yetkili işlemler. Teklif erişim koşulu korunur. |
| Teklif ayrıntısı `/offers/[id]` | **Özet · Revizyon · Maliyet · Diğer** | Mevcut teklif ayrıntısındaki bölümlere erişim. Revizyon/maliyet birden fazlaysa kayıt seçtirir; sessizce yanlış sürüm açılmaz. Diğer: mevcut iş emrine dönüşüm ve belge işlemleri. Eksik çalışma “henüz oluşturulmamış” durumuyla gösterilir. |
| Teklif metni editörü | **Kapak · Kalemler · Fiyat · Şartlar · Diğer** | Kalemler seçilmiş teklifteki kalem dizinini açar; her vinç ayrı alt bar öğesi olmaz. Şartlar altında Ticari/Genel şartlar; Diğer altında Test Yükü, Notlar, Kapsam Dışı ve mevcut belge işlemleri. Gizli bölümü yeniden açma yolu korunur. Bu gruplama yeni sunum işidir. |
| Maliyet editörü | **Özet · Ağırlık · Hesap · Maliyet · Diğer** | Mevcut altı bölümden dördü doğrudan; Katsayılar ve Notlar Diğer'de. Seçili vinç/kalem korunur. İç maliyet belgesi ile müşteri teklif belgesi birbirine karıştırılmaz. |
| Mühendislik proje ayrıntısı | **Hesap · Ekipman · Elektrik · Resimler · Diğer** | Mevcut proje sekmeleri. Diğer: İşletme ve Bakım El Kitabı, yetkili kullanıcıda Vinç Kimliği, mevcut diğer proje işlemleri. Elektrik içindeki pano araçları elektrik bağlamında açılır. |
| Teklif hesap projesi ayrıntısı | **Hesap · Ekipman · Ara · Diğer** | Bu ekran mevcut `compact` bağlamını korur: Mühendislikteki elektrik/resim/el kitabı sekmeleri buraya eklenmez. Ara mevcut revizyon listesinin aramasına erişim sağlar; bugün yoksa yerel liste araması küçük ek sunum işi olarak yazılır. Diğer mevcut proje/revizyon işlemleridir. |
| Hesap raporu editörü | **Veriler · Bölümler · Kontrol · Ekipman · Diğer** | Veriler teknik özellikler; Bölümler mevcut modül/bölüm ağacı; Kontrol mevcut Özet/Kontrol Panosu; Ekipman aynı revizyonun listesi. Diğer rapor ve mevcut revizyon işlemleri. Modül ekle/çıkar ve bölüm notları kaybolmaz. |
| Ekipman listesi | **Liste · Ara · Gruplar · Belgeler** | Aynı revizyonun ekipmanını bulma, gruba geçme ve mevcut çıktı/katalog seçenekleri. Katalog erişimi satırdaki ürüne bağlıdır; seçim yokken rastgele ürün açılmaz. Gruplar ve Belgeler erişim yüzeyi olarak düzenlenir. |
| Teknik resim paketi | **Dosyalar · Parçalar · Üretim · Sürümler · Diğer** | Atölyede çizime bakma, parçayı bulma, ilerlemeyi ve sürümü kontrol etme önceliklidir. Diğer: Genel Bakış, paketin Satın Alma özeti, İçe Aktarım Raporu. Paket Genel Bakış'ından giriş korunur; o sayfa açıkken Diğer aidiyeti gösterilir. |
| Hammadde | **Havuz · Yerleşim · Teklifler · Siparişler · Diğer** | Diğer: Alım Analizi ve Satın Alma ana alanına dönüş. Hammadde sipariş bağlantısı mevcut `?tur=hammadde` bilgisini taşır. Bu filtreyle siparişe geçildiğinde Hammadde barı korunur; Genel Satın Alma'ya açık dönüş vardır. |
| Sarf | **Giriş · Kayıtlar · Analiz · Diğer** | Üç mevcut sarf sayfası. Diğer: mevcut yardımcı işlemler ve Satın Alma ana alanına dönüş. Yetkisiz kullanıcıya Yönetim defteri bağlantısı üretilmez. |
| Personel ayrıntısı | **Kimlik · Dönemler · Maaş · Dosyalar** | Mevcut dört bölümün doğrudan karşılığı. Maaş kişinin geçmişidir; genel personel maaş tablosuna atlamaz. Uzun sayfada mevcut çapa davranışı kullanılır. |
| İşletme ve Bakım El Kitabı | **İçerik · Kapsam · Künye · Kontrol · Diğer** | Mevcut İçerik/Kapsam/Künye/Kalite/Kaynak yapısı temel alınır; Kontrol mevcut Kalite alanıdır. Diğer: Kaynaklar, önizleme ve mevcut çıktı seçenekleri. İçerik içinde bölüm ağacı ile yazı/sayfa görünümü korunur. Harita/editör/önizleme için ikinci sabit alt bar eklenmez. |
| Pano Yerleşimi | **Özet · Dizilim · Panolar · İç Yerleşim · Diğer** | İç yerleşim daha önce özellikle görünür istenmiş: doğrudan erişimde kalır. Diğer: Denetim, Aygıt Kuyruğu, ölçü defteri ve mevcut çıktılar. Pano yoksa İç Yerleşim açıklayıcı boş durum açar; beşlinin konumu değişmez. |
| Pano İç Yerleşimi | **Panolar · Yerleşim · Denetim · Diğer** | Seçili pano ve ölçek korunur. Panolar pano seçicisini; Yerleşim çizimi; Denetim mevcut sonuç/bulgulara erişimi açar. Diğer mevcut liste/çıktı araçları ve üst yerleşime dönüş. Ayrı denetim sunumu yoksa mevcut sonuçların görünüm gruplaması gerekir; yeni mühendislik hesabı değildir. |

### Elektrik Projesi hakkında özel karar

Elektrik Projesi bugün proje ayrıntısında bir kart/sekme olarak çalışıyor; bağımsız `/electrical` ana bölümü varsayılmamalı. Bu aşamada **proje alt barı korunur**. Malzeme / Aygıt / Sayfalar mevcut elektrik içeriğinin yerel seçicisidir. Bunlar ikinci sabit bar yapılmaz. Elektrik için bağımsız tam ekran çalışma alanı istenirse daha sonra **Malzeme / Aygıtlar / Sayfalar / Pano / Diğer** değerlendirilebilir; ilk uygulamanın zorunlu koşulu değildir.

### Teknik resimlerde öncelik dengesi

Sürümler'i ilk beşe almak bilinçli bir öneri: telefonda doğru revizyonu görmek, paket künyesini tekrar okumaktan daha değerli olabilir. Satın alma çalışanları paket özetiyle çok çalışıyorsa **Sürümler ↔ Satın Alma** değişimi kullanıcı yorumuna açık. İlk sürümde role göre kendi kendine değişen bir sıra kurulmayacak.

## 6. Profil, bildirim, belgeler ve formlar

| Alan | Öneri | Kapsam |
| --- | --- | --- |
| Profilim | **Bilgiler · Fotoğraf · Ekipler · Diğer** | Mevcut kişisel bilgi/fotoğraf/ekip alanlarına erişim. Diğer: görünüm ve geri bildirimler. Profil fotoğrafı ve telefon akışları korunur. |
| Kişisel geri bildirimler | **Kayıtlar · Yeni · Profilim · Diğer** | Yeni mevcut formu açar; göndermez. Diğer: Panel ve genel bildirimlere dönüş. Yönetim geri bildirim ekranı bu kişisel barı devralmaz. |
| Genel bildirimler | **Bildirimler · Panel · Profilim · Diğer** | Bildirim merkezi ilk hedef. Diğer mevcut bildirim işlemlerini gösterir; Panel/Gelen ile veri birleştirme yapılmaz. Bu yardımcı bar ana modüllere yayılmaz. |
| Korumalı çizim görüntüleyici | **Sayfalar · Yakınlaştır · Dosyalar · Diğer** | Görüntüleyici araç barı. Dosyalar aynı paketin dosyaları; Diğer yetkili mevcut çıktı/açma ve pakete dönüş seçenekleri. Bulunmayan not ekleme/işaretleme özelliği vaat edilmez. |
| Katalog sayfası | **Sayfalar · Yakınlaştır · İndir · Diğer** | Ürün teknik sayfası araç barı. Diğer mevcut Yeni Sekmede Aç ve güvenli kaynak ekrana dönüş. Tek sayfada Sayfalar “1/1” bilgisini gösterir. Kaynak dönüş bilgisi yoksa mevcut Mühendisliğe dönüş kullanılabilir. |

**Form kuralı:** Yeni İş, iş düzenleme, paket yükleme, yeni ekip, kullanıcı düzenleme gibi formlar bulundukları bölümün barını devralır. Ayrı dört yapay form adımı üretilmez. Kaydet/İptal formun kendi erişilebilir eylemleridir. Formdan bar aracılığıyla ayrılma mevcut taslak/kayıt korumasından geçer. Klavye açıkken bar geçici gizlenebilir; form eylemlerinin erişimi korunur.

**Diğer alt sayfaların sahipliği:** Mühendislikte `/projects/jobs/[jobId]` iş bazlı proje listesidir ve Mühendislik liste barını; `/projects/[id]/compare` ve `/audit` proje ayrıntısı barını devralır. Karşılaştırma ve denetim, proje barının Diğer listesinde açıkça yer alır. Teklifin iş emri hazırlama sayfası teklif ayrıntısı barını ve form korumasını kullanır. Yönetim kullanıcı/ekip ayrıntıları Yönetim barını; geri bildirim ayrıntıları açıldıkları kişisel veya yönetim bağlamını korur. Pano ölçü defteri Pano barının Diğer alanına aittir. Yeni alt rota eklendiğinde otomatik rastgele ana bar seçilmez; sahiplik envanterine eklenir.

**Tam ekran belge kuralı:** Çizim veya PDF açıkken bölüm barının yerine dört araçlı görüntüleyici barı gelir. Tam ekran inceleme kipinde bilinçli gizleme/açma olabilir; keşfedilebilir geri dönüş ve araçları yeniden açma yolu bulunur. Normal listelerde kaydırırken bar kendiliğinden kaybolmaz.

**Kapsam sınırı:** Giriş ekranı, halka açık müşteri paylaşım bağlantıları, `/paylas/*`, API ve belge indirme uçları, yönetilen hata sayfaları dört öğeli iç uygulama barı almaz. Oturum açmadan iç uygulama bölümlerini açığa çıkarmaz. `/dev/*-preview` sayfaları ise temsil ettikleri gerçek ekranın barını gösterir.

## 7. Telefon ve tablet düzen sözleşmesi

### Telefon

- Bir satırda eşit genişlikli dört veya beş öğe; yatay kaydırma yok.
- İkon ve etiket birlikte. Simgeler mevcut ikon sisteminden; yeni elle çizilmiş takım yok.
- Başlangıç ölçüsü: 64–72px içerik yüksekliği + cihazın alt güvenli alanı. Nihai ölçü Panel görünümü ve fiziksel testle belirlenir.
- En az 44px bağımsız dokunma hedefi. Komşu hedeflerin görünmez payları çakışmaz.
- Etiket 11px altına inmez; tercihen 12px. Uzun etiket en fazla iki satır. Yazı büyütmede yükseklik artabilir; içeriğin alt payı bu yüksekliği izler.
- Panelin sakin yüzeyi, ince üst sınırı ve aktif rengi korunur. Yeni büyük gölge, cam efekti veya ayrı renk sistemi kurulmaz.

### Tablet

- Dikey ve yatay kullanımda aynı öğeler, aynı sıra, aynı anlam.
- Geniş yüzeyde alt grubun başlangıç üst genişliği 640px; uygun görülürse 720px'e kadar denenebilir. Barın zemin bandı ekranı kaplar; tıklama grubu ortalanır.
- Sadece genişliğe bakıp “1024px oldu, barı kaldır” yapılmaz. Dar pencere, dokunmatik kullanım ve kullanıcının görünüm tercihi birlikte ele alınır.
- Başlangıç otomatik kuralı: 1024px altında kompakt alt düzen; 1024–1366px arasında dokunmatik ağırlıklı kullanımda tablet düzeni; geniş masaüstünde mevcut düzen. Eşikler test başlangıcıdır.
- Donanım klavyesi/trackpad bağlanan iPad yanlışlıkla masaüstüne geçebilir; `pointer` tek başına cihaz türünü kanıtlamaz. Bu yüzden Görünüm altında **Otomatik / Alt bar / Masaüstü** kullanıcı tercihi planlanır. Tercih cihazın yerel görünüm ayarıdır, sunucu rolü değildir.
- Hibrit bilgisayarda `any-pointer: coarse` tek başına yeterli sayılmaz. Elle Alt bar seçimi geniş dokunmatik ekranı da kapsar. Kullanıcının tabletteki tercihi yön değiştirince korunur.
- Tablet kipinde aynı bölümün üst kutuları/yan bölüm rayı gizlenir; genel uygulama menüsü tek erişim olarak kalır. Masaüstü tercihi mevcut yan menü ve editör rayını korur.

### Klavye, pencere ve içerik payı

- Barın gerçek yüksekliği ortak `--app-bottom-bar-h` değişkeniyle ölçülür. İçerik, son satır, yapışkan toplam, sayfalama ve sabit eylem düğmeleri bu değeri kullanır.
- Form odağı tek başına “sanal klavye açıldı” sayılmaz. Görünür alan küçülmesi ve mevcut `mobileKeyboardSafe` deneyimi değerlendirilir; donanım klavyesinde bar gereksiz kaybolmaz.
- Sanal klavye açıkken normal alt gezinme gizlenir; klavye kapanınca geri gelir. Filtre/form penceresi görünür yüksekliğe sığar. Arama kutusuna odak bilinçli Ara dokunuşuyla verilebilir; yalnız sayfa açıldı diye klavye açılmaz.
- Normal bir pencere açıkken arka bar etkin değildir. Pencere kapandığında odak açan düğmeye döner. Tek ana kaydırma sahibi korunur.
- Paneldeki mevcut 83px düğme ofseti ve 150px alt dolgu ortak ölçüye geçirilirken yeni pay iki kere eklenmez.
- Bildirim mesajı, görev oluştur düğmesi ve Kaydet eylemi barın veya birbirinin üzerine binmez.

## 8. Davranış ve yetki sözleşmesi

1. Bir ekranda bir bar sahibi: yardımcı görüntüleyici → özel editör → kayıt ayrıntısı → alt alan → ana bölüm önceliği.
2. `/offers/hesap-raporlari` ile `/projects` aynı motoru kullansa da ayrı iş bağlamlarıdır. Dönüş adresi ve bar kapsamı korunur.
3. Adres eşleşmesi en özel rotadan başlar. Hammadde siparişleri gibi sorgu tabanlı bağlamlarda yalnız `pathname` yetmez.
4. Link sayfaya gider; düğme yerel görünüm/araç açar. Linklere sahte tab rolleri, araçlara `aria-current` verilmez. Gerçek yerel sekmeler seçili panel ilişkisini ve klavye hareketini korur.
5. Bar değişimi form verisini sıfırlamaz. Alt bölümden dönünce seçili kalem/revizyon, filtre, sayfa ve liste konumu uygun kapsamda korunur.
6. Kaydedilmemiş veriyle ayrılmada Kaydet / Değişiklikleri Bırak / Kal akışı yalnız gerçek değişiklik varsa devreye girer. Kayıt başarısız olursa sayfadan çıkılmaz. Salt okunur ekranda gereksiz uyarı yoktur.
7. Mobilde ayrı bir ikinci form veya liste mantığı kurulmaz. Aynı durum ve eylemler yeni girişlerden kullanılır; aynı DOM kimliğine sahip çift portal oluşturulmaz.
8. Pano görünüm seçimi mevcut yerel durum sözleşmesini korur; sekme seçimi yerleşim hesabını tekrar koşturmaz. Genel URL politikası tüm editörlere zorlanmaz.
9. `canSee…` / `canEdit…` fonksiyonları kullanılır. Görme yetkisi olmayan hedef, adı ve rozetiyle dahi sunulmaz. Sunucu yetkisi de korunur.
10. Yetki değişimi dışında bar sırası kendiliğinden değişmez. Veri yoksa sekme kaybolmak yerine açıklayıcı boş durum gösterir. Yetkili rol için 4–5 öğeli bileşim önceden tanımlanır; boşluğu doldurmak için yetkisiz hedef eklenmez.
11. Rozet yalnız anlamlı bekleyen durumlar için. Toplam kayıt sayıları her sekmeye taşınmaz. Rozet için alt barın her hedefe ayrı sorgu atması önlenir.
12. Gönder, sipariş oluştur, yayımla, onayla ve sil gibi işlemler alt bara doğrudan tek dokunuşlu komut olarak taşınmaz; mevcut inceleme/form akışı açılır.

## 9. Uygulama mimarisi ve iş büyüklüğü

### Ortak temel

Önerilen parçalar: `SectionBottomBar` görsel bileşeni, `SectionMoreSheet` kalan hedefler yüzeyi, bölüm tanımları ve bar sahipliğini yöneten kabuk bağlantısı. İsimler uygulamada netleştirilebilir; henüz oluşturulmadılar.

Tanım her öğe için sabit kimlik, etiket, ikon, hedef türü, aktiflik eşleşmesi ve mevcut yetki sorusunu taşır. Sayfaya özel callback'ler sayfanın denetiminde kalır. Ağır editör modülleri genel uygulama kabuğuna import edilmez. Ortak bar uğruna bütün uygulama tek büyük istemci bileşenine dönüştürülmez.

Mevcut `MobileRouteGrid`/`MobileSectionGrid` çağrıları bir anda küresel değiştirilmez: yalnız içerikteki kart ızgarası olarak kullanılan yerlerin de yanlışlıkla bara dönüşmesi önlenir. Her bölüm uyarlanır. Masaüstüyle mobil, aynı hedef tanımlarını paylaşabilir; eşzamanlı görünür iki gezinti üretilmez.

### Mevcut işlevlerin taşınması

Panel, Satın Alma, Hammadde, Sarf, Personel, maliyet editörü ve iş ayrıntısı için ana iş, var olan hedeflerin seçilmesi ve yerleştirilmesidir. İş Takibi Dönem aracı, satış belgesi seçicisi ve Diğer pencereleri mevcut eylemlerin yeni erişim noktalarıdır.

### İlave sunum işi gereken yerler

- Çizim İşleme tek sayfasının dört çalışma görünümüne ayrılması; devam eden işlem ve dosya seçimi kaybolmadan geçiş.
- İşler/Mühendislik/Teknik Resimler arama ve filtrelerinin ortak klavye güvenli pencereye bağlanması.
- Teklif metninde çok sayıda kalemin Kalemler dizininde, şartların tek grupta sunulması.
- Ekipman ve görüntüleyicilerde dört araçlı yüzey; mevcut olmayan yakınlaştırma kumandası gerekiyorsa görüntüleyici sunumunda eklenmesi.
- Üçüncü taraf/yerleşik PDF görüntüleyici sınırlarının denetlenmesi: tarayıcının yerleşik PDF kumandaları kontrol edilemiyorsa bar mevcut desteklenen işlemlerle kurulmalı, çalışmayan yakınlaştırma düğmesi sunulmamalı.
- Teklif hesap projesinde revizyon araması bugün yoksa yalnız eldeki listenin yerel araması.
- Tablet görünüm tercihi ve ortak alt boşluk/klavye yönetimi.

İlk kapsamda yeni veri tabanı tablosu, favori altyapısı, bildirim altyapısı, hesap yöntemi veya yeni rapor üretim motoru gerekmiyor. Uygulamada yeni veri gerektiren bir ihtiyaç çıkarsa bu tasarım taşıma işinden ayrı kaydedilir.

## 10. Fazlar ve her fazın çıkış koşulu

| Faz | İş | Tamamlanma koşulu |
| --- | --- | --- |
| 0 — Karar ve envanter | Bu tablolara kullanıcı yorumları işlenir; bütün gerçek rota/yerel panel/yetki varyantları listelenir. | Her ekranın bar sahibi ve dört/beş öğesi belli; hiçbir erişilebilir hedef kayıp değil. |
| 1 — Ortak temel | Tek bar, Diğer, gerçek alt ölçü, tablet görünüm tercihi, odak/klavye davranışı. Panel ve Satın Alma ile pilot. | Telefon, tablet ve masaüstü geçişlerinde çift bar/taşma yok; Panelin dört öğesi aynı. |
| 2 — Operasyon | Hammadde/Sarf, Personel, İş Takibi, Satış. | Tarih, tür, kayıt ve filtre bağlamı korunuyor; son satır ve Kaydet erişiliyor. |
| 3 — Kayıt bulma ve takip | İşler/iş ayrıntısı, Mühendislik listesi/proje ayrıntısı, Teknik Resimler/paket. | Listeden kayda ve geri dönüş kayıpsız; sürüm ve yetki kapsamı doğru. |
| 4 — Editörler | Teklif, teklif hesabı, maliyet, hesap raporu, ekipman, el kitabı, pano. | Taslak korunuyor, belge ve revizyon karışmıyor, yerel sekme geçişleri pahalı sunucu işlemi başlatmıyor. |
| 5 — Yardımcı alanlar | Teknik Araçlar, CAD, Yönetim, Profil/geri bildirim, bildirim merkezi, görüntüleyiciler. | Eksik bölüm yok; yardımcı ekrandan kaynak bağlama dönüş güvenilir. |
| 6 — Kabul | Gerçek cihaz pilotu, erişilebilirlik, eski bağlantılar, masaüstü regresyonu. | Aşağıdaki kabul listesi kanıtlarıyla kapanır; eksik fiziksel test yapılmış sayılmaz. |

Pilot olarak Panel + Satın Alma özellikle uygun: biri beğenilen dört öğeli referans, diğeri gerçek beş hedefli ve alt alanlı karmaşık iş akışı. Uzman editörler ortak temel doğrulandıktan sonra taşınır. Takvim günü tahmini bu aşamada verilmez; fazlar somut çıktı üzerinden takip edilir.

## 11. Doğrulama planı

### Görsel boyutlar ve cihazlar

- Telefon: 320, 360, 375/390 ve 430 CSS piksel; ayrıca kısa yatay ekran.
- Tablet: 768, 820/834, 1024, 1180 ve 1366 CSS piksel; bölünmüş pencere ve yön değişimi.
- Masaüstü: 1280, 1440, 1920; normal ve dar menü, sabit çerçeveli editörler.
- iPhone Safari ve ana ekrana eklenmiş uygulama; Android Chrome; iPad Safari dokunma ve donanım klavyesi/trackpad; Android tablet erişilebildiğinde.
- Açık/koyu tema, büyütülmüş metin, azaltılmış hareket, klavye ve ekran okuyucu.

### Kullanıcı işi üzerinden kabul senaryoları

| Senaryo | Beklenen sonuç |
| --- | --- |
| İşler'de ara → işi aç → görevler → geri dön | Arama, süzgeç ve liste konumu korunur; başka işin görevleri açılmaz. |
| Hammadde → Siparişler → ayrıntı → geri | `tur=hammadde` ve alt alan aidiyeti korunur. |
| Pakette parça bul → çizim aç → sürümü kontrol et | Parça/paket bağlamı ve dönüş noktası korunur; çizim barı paket barıyla çakışmaz. |
| Günlük iş takibinde satır değiştir → Analiz'e dokun | Kaydedilmemiş değişiklik korunur; başarısız kayıttan sonra gezinilmez. |
| Personel maaşında dönem seç → Harcirah → geri | Her görünümün dönemi anlaşılır; farkında olmadan başka aya veri yazılmaz. |
| Hesap raporu bölüm değiştir → Kontrol → Ekipman → geri | Aynı revizyon açılır; girişler ve hesap bağlamı korunur. |
| Teklif hesabından ekipmana gir → üst kayda dön | Mühendislik projesine değil aynı teklif hesap projesine döner. |
| Pano Dizilim → Panolar → İç Yerleşim | Yerel sekmede yeniden yerleşim çözümü yok; iç yerleşimde seçili pano ve deneme ayarları doğru. |
| CAD'de dosya seç → Sonuçlar → Hazırla | Dosya seçimi ve form ayarları korunur; gezinme işlem başlatmaz. |
| Uzun sayfanın en altına kaydır | Son kayıt, sayfalama, toplam ve işlemler barın altında kalmaz. |
| Klavyeyi aç/kapat, ekranı döndür | Bar geri gelir; pencere ve Kaydet görünür alanda kalır; sayfa yana taşmaz. |
| Yetkisi sınırlı rolle doğrudan URL aç | Menü ve sunucu aynı erişimi uygular; gizli başlık/rozet sızmaz. |

### Ölçülebilir çıkış koşulları

1. Desteklenen her iç ekranın normal kipinde 4 veya 5 öğe ve tek alt bar; açıklanan klavye/modal/tam ekran istisnaları kayıtlı.
2. Dört/beş öğe yana kaymadan sığar; 44px dokunma hedefleri çakışmaz; etiketler okunur.
3. Birincil hedef en fazla bir, Diğer içindeki hedef en fazla iki dokunuş uzaklıkta.
4. Mobil/tablet kipinde aynı hedefleri tekrarlayan üst ızgara veya ikinci sabit bar yok.
5. Son içerik ve eylemler görünür; gerçek tabloların ana sayfa genişliği taşmaz. Teknik çizim/matris istisnaları kendi kaplarında kalır.
6. Taslak/kayıt/sürüm/iş kalemi kaybı yok; geri ve ileri gezinme doğru.
7. Yerel görünüm seçimi gereksiz veri çağrısı veya mühendislik hesabı başlatmıyor.
8. Yetki testleri ve doğrudan bağlantı kontrolleri geçiyor; aktif hedef doğru.
9. Masaüstü editör yüksekliği, yan menü ve belge çıktıları etkilenmiyor.

Otomatik kontroller: rota sahipliği, öğe sayısı, aktiflik, yetki ve bağlam eşleşmesi gibi davranış testleri; ilgili mevcut mobil kontrol betikleri; değişen dosyalarda tür/lint ve gerekli derleme kontrolleri. Görsel kabul gerçek bileşenleri kullanan `/dev/*-preview` üzerinden yapılır. Sadece sınıf adını sınayan veya aynı listeyi başka dosyaya kopyalayan testler yazılmaz. Tarayıcı emülasyonu fiziksel klavye/Safari kabulünün yerine geçmez.

Pilot gözlemi bölüm başına birkaç gerçek işle ölçülebilir: işi bulmak için gereken dokunuş, kaybolan bağlam, yanlış dokunma, üst menüye dönme ihtiyacı. Varsayımsal “%30 hızlanma” hedefi verilmez. Yeni ayrıntılı kullanım takibi bu çalışmaya kendiliğinden eklenmez.

## 12. Gözden geçirmede öncelikli kararlar

- Teknik Resimler paketinde **Sürümler** mi, **Satın Alma** mı daha sık elde olmalı? Başlangıç önerisi Sürümler.
- Personel'de **Harcirah** mı, **Ücret Planı** mı doğrudan durmalı? Başlangıç önerisi Harcirah.
- Teknik Araçlar'da **Kama** mı, **Cıvata** mı ilk beşe girmeli? Başlangıç önerisi Kama; sahadaki kullanıma göre değişebilir.
- Yönetim'de **Yetkiler** mi, **Silme Onayları** mı görünür öncelik olmalı? Başlangıç önerisi Yetkiler; bekleyen onaylar Diğer'de anlamlı rozetle bulunabilir.
- Mühendislik proje ayrıntısında **Resimler** mi, **El Kitabı** mı doğrudan görünmeli? Başlangıç önerisi Resimler.
- İşler/Mühendislik/Paket listelerinde Ara ve Filtrele içeren dört araçlı yaklaşım uygun mu? Başlangıç önerisi mevcut işlevleri kullanan bu yapı; yeni sayfalar gerekmez.

Bu maddeler zorunlu onay kapıları değil, bölüm yorumlarını somutlaştırmak için seçeneklerdir. Kullanıcı bütün bölümleri tek seferde kararlaştırmak zorunda değildir. Uygulama istendiğinde en son yorumlar esas alınır.

## 13. İncelemede başvurulan yerel kaynaklar

- `AGENTS.md`; `docs/agent/arayuz.md`, `docs/agent/roller.md`, `docs/agent/worklog.md`, `docs/agent/satinalma.md`, `docs/agent/cad.md` ve alan/dizin haritaları.
- `src/lib/roles.ts`: ana bölümler ve erişim soruları. `src/lib/usage.ts`: mevcut ölçümün bölüm düzeyindeki kapsamı.
- `src/components/app-shell.tsx`, `src/components/mobile-nav-grid.tsx`: kabuk, kırılımlar ve mevcut mobil gezinme.
- `src/app/(app)/panel/task-workspace.tsx`, `task-workspace.css`: dört hedef, mobil bar, oluşturma düğmesi ve alt boşluk.
- Bölüm `*-nav.tsx` dosyaları: purchasing, hammadde, personnel, worklog, sales, tools, offers, admin; iş ayrıntısı `job-nav.tsx`, paket `package-nav.tsx`.
- Proje `project-page-view.tsx`, `project-tabs.tsx`; hesap `revision-editor.tsx`; teklif `offer-editor.tsx`; maliyet `cost-editor.tsx`; el kitabı `manual-editor.tsx`; pano `pano-bolum-bari.tsx`.
- CAD `workspace.tsx`, katalog `page.tsx`, personel `employee-profile.tsx`, profil `account-view.tsx`, satış `job-list-button.tsx`.
- `plans/011-panel-mobil-sadelestirme-ve-klavye.md`: önceki Panel çalışmasının kapsamı.

Yukarıdaki bölüm tasarım dayanağıdır. Kullanıcının tümünü uygulama onayından sonraki gerçekleşen değişiklikler ve kontrol sonuçları aşağıdadır.


## 14. Uygulama kaydı ve kontrol fazları

Tarih: 12.09.2026. Kullanıcı bütün fazları uygulama yetkisi verdi. Bu çalışma için
Supabase erişimi, yeni tablo/migrasyon veya üretim yayını gerekmedi.

| Faz | Gerçekleşen iş | Kontrol |
| --- | --- | --- |
| 0 | Rotalar, mevcut yerel sekmeler, üst raylar ve yetkiler incelendi. | Mevcut rol defteri esas alındı; sekiz rol testleri korundu. |
| 1 | Kökte tek bar, sahiplik önceliği, Diğer, ölçülen alt boşluk ve görünüm tercihi. | Panel/Satın Alma pilotu; penceredeki yatay kayma düzeltildi. |
| 2 | Hammadde, sarf, personel, günlük/dönem, satış ve iş listesi belgesi. | Tarih/filtre araçları var olan denetimleri kullanıyor; yeni kopya form yok. |
| 3 | İş/proje/paket listelerinde Ara/Filtrele; iş, proje ve paket ayrıntıları. | Proje/paket süzgeçleri sekme belleğinde; İşler URL durumu korunuyor. |
| 4 | Teklif, hesap, maliyet, ekipman, el kitabı ve pano barları. | Kaydetmeden ayrılma, kayıt hatası, bölüm pencereleri ve yerel seçimler sınandı. |
| 5 | Teknik Araçlar, CAD, yönetim, profil, geri bildirim, bildirim ve belge araçları. | Gerçek bileşenleri kullanan ek önizleme; ana menü/özel alt alan tek bar sahipliği. |
| 6 | Yazılım ve tarayıcı kabulü. | Aşağıdaki kanıtlar; fiziksel Safari/PWA/ekran okuyucu testi yapılmış sayılmaz. |

### Son ürün kararları

- Telefon/tablet otomatik eşiği plandaki 1024/1366 kuralıdır; düğme grubu en fazla
  640px genişlikte ortalanır. Yazı büyütülürse yüksekliği yeniden ölçülür.
- Canlı liste filtreleri mevcut davranışla anında uygulanır, kapatınca korunur.
  Geri bildirimin GET süzgeci mevcut **Süz** eylemini kullanır; ikinci filtre motoru yoktur.
- Teklif hesap projesinde yalnız iki yerel içerik vardır. **Hesap · Ekipman ·
  Projeler · Teklifler** dört erişim sağlar. Proje dönüşü teklif hesabı kapsamındadır.
- Ana ekranı olmayan yardımcı/form rotaları bölüm, Panel, Bildirimler ve Profil
  kısa yollarını kullanır; özel ekran kaydı bu güvence barından önceliklidir.
- Hesap/teklif iç içe düzenlenirken gömülü ön hesap barı kaydolmaz. Düzenleme
  penceresi kendi mevcut kaydetme/kapatma kontrolünü korur.
- El kitabında belge haritası, belge/kâğıt yüzü ve Kaydet **Diğer** içindedir.
  Hesapta Geri/İleri kumandası normal içerik akışında veya editör çerçevesindedir.
- CAD görünümleri DOM'da kalır; görünüm değiştirmek dosya seçimini veya ayarları
  sıfırlamaz, işlem başlatmaz. İşlem seçmek sonuç yüzünü açar.
- Ekipmanda arama, liste satırlarının marka/model/özellik ve grup metnini süzer.
  Gruplar mekanik/elektrik kapsamını değiştirir; belge indirme seçenekleri var olan
  aynı bağlantı ve kapsam seçimlerinden gelir.
- Pano olmadığında İç Yerleşim yerine boş bir hedef eklenmez; kalan üç bölüm ve
  Diğer toplam dört erişim oluşturur. Yerleşim olduğunda beş erişim vardır.
- Satış İş Listesi penceresinde tüm işler veya istenen yıl seçilir; mevcut PDF
  ucu kullanılır. Korumalı teknik resimde indirme/yazdırma yetkisi eklenmez.

### Doğrulama kanıtları

- `src/lib/bottom-bar.test.ts`: dokunmatik/masaüstü tercihi, tam/alt rota, sorgu
  bağlamı ve bar sahipliği için 3 davranış testi.
- Rol ve maliyet girdi senkronizasyonu testleriyle birlikte **56 test geçti**.
- `artifacts/alt-bar-check-results.json`: **19 ekran × 4 genişlik = 76 kontrol**;
  390/820/1180 dokunmatik, 1440 masaüstü. Tek bar, 4–5 hedef, 44px hedef ölçüsü,
  yatay taşma ve masaüstünde barın kalkması kontrol edildi.
- `artifacts/alt-bar-fixtures.json`: **10 gerçek bölüm/ayrıntı bileşeni × 4 genişlik
  = 40 kontrol**; ayrıca uygulama yan menüsünün doğru görünümü kontrol edildi.
- `artifacts/alt-bar-interactions.json`: kayıt başarısızlığında kalma ve metni
  koruma, başarılı kayıtta geçiş, hesap dizini, ekipman arama durumu, CAD görünümü,
  profil çapaları ve görünüm tercihi geçti.
- `artifacts/alt-bar-extra-results.json`: el kitabı haritası/kâğıt ve teklif kalem
  dizini 390/1180/1366'da geçti; görünür alan küçülmesiyle klavye gizleme/geri
  getirme sınandı. Bu, fiziksel klavye/Safari testi değildir.
- `artifacts/alt-bar-edge-results.json`: 320/360/430/768/1024 ve fareli 1280/1920;
  büyütülmüş etiket, koyu tema, azaltılmış hareket, Escape sonrası odak, yazdırma.

İlk turdaki Teknik Resimler ve Hammadde önizlemeleri bölüm menüsünü içermiyordu.
Kontrol gerçek `PackagesTable`/`HammaddeNav` bileşenlerine taşındı ve yeniden geçti.
İlk soğuk önizleme yüklemesindeki kısa bekleme sınırı da yükseltildi. Başarısız
ilk tur sonuçları son başarılı turun yerine kanıt olarak kullanılmadı.

Fiziksel iPhone/iPad Safari, ana ekrana eklenmiş uygulama ve ekran okuyucu pilotu
bu ortamda yapılamadı. Kimlik doğrulamalı gerçek kayıtlarda yazma/silme/üretim
belgesi gönderme denemesi yapılmadı; taslak geçişi geliştirme fikstürüyle sınandı.

- `artifacts/alt-bar-content-results.json`: 390/1180'da İşler, hesap, ekipman,
  günlük kayıt ve maliyet ekranlarının son görünür eylemi barın üstünde kaldı;
  projelerde arama → başka ekran → geri dönüşte arama korundu. Bu kontrolde iş
  formunun yapışkan Kaydet/İptal satırı için eksik alt ofset bulundu ve düzeltildi.
  Hesap adım kumandası ikinci yapışkan bar olmaktan çıkarıldı; yükleme bildirimi
  de ölçülen alt bar yüksekliğini kullanır.

### Derleme ve kod kontrolü

- Değiştirilen arayüz dosyaları ve yeni ortak bileşenler hata düzeyinde lint kontrolünden geçti.
- Üretim derlemesi başarılı: derleme, TypeScript ve 156 statik sayfanın üretimi tamamlandı.
  İlk denemede mevcut Google Fonts dosyaları ağ kısıtı nedeniyle alınamadı; yalnız
  derleme için verilen ağ erişimiyle tekrarlandı ve geçti. Yazı tipi veya yayın
  yapılandırması bu nedenle değiştirilmedi.
- Maliyet ve el kitabı kaydı sürerken yeni düzenleme oluşmuşsa başarılı eski kayıt
  yeni taslağı temizlemez; alt bar geçişi durur ve yeni değişikliklerin kaydı istenir.
