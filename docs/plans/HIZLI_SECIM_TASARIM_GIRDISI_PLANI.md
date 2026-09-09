# Hızlı seçim — kullanıcı geri bildirimi, 09.09.2026

Amaç: teknik talep + standart marka/seri + temel yerleşim kararından, ortak hesap motoruyla baştan sona düzenlenebilir hesap taslağı üretmek.

## Fazlar ve kabul ölçütleri

1. **Marka kimliği:** katalog ve marka defterlerinin mevcut verilerini büyük harfe dönüştür; sonraki yazımları da normalize et. Ürün kimlikleri/bağlantıları korunacak, aynı kimliğe düşen satırlar önceden denetlenecek. Eski katalog föyleri büyük harfli adla bulunacak.
2. **Başlangıç tercihleri:** ilk açılışta GAMAK; kaldırma/yürütme YILMAZ REDÜKTÖR; kaldırma freni SIBRE; yürütme freni DERELI; motor kaplini SIBRE; teker/tambur kaplini OZGUN; rulman SKF; halat HAŞÇELİK; tampon SIBRE. Kullanıcının sonraki değişiklikleri korunacak. Marka altında gerçek katalog serileri seçilecek; H/DR ve SIBRE APC-AT önerileri yalnız ilgili markada geçerli olacak.
3. **Temel tasarım girdileri:** her etkin kaldırmada halat donanımı; her etkin yürütmede toplam teker/tahrik sayısı ve ray ailesi/ölçüsü. Raporun mevcut değerleri başlangıç olarak okunacak. Donanım, ray ve adet değişimi ortak türetmelere girecek; geçersiz adet ve kilit çatışması işlemden önce bildirilecek.
4. **Sıralı hesap ve bağlantı:** halat → tambur/mil → rulman/yatak → motor/redüktör → fren/kaplin → kanca/makara → yürütme → yapı/elektrik → son bağlı kontroller. Yürütme redüktörünün katalogda motor akuple olarak tanımlanan girişinin (DR örneği) ayrı motor kaplini istemediği ortak modelde belirtilecek; flanş/adaptör uygunluğu ayrıca kaynakla doğrulanacak. Katalog serisi hesabın başında ve tüm bağlı aramada zorunlu filtre olacak.
5. **Taslak kabulleri ve açıklama:** kilidin neyi koruduğu kısa örnekle anlatılacak. Sertlik ve motor sipariş özellikleri mevcut firma varsayılanlarından tamamlanacak; bunlar üretici kapasitesi gibi sunulmayacak. Kullanıcının kararları seçim izinde saklanacak, iptal/değişmiş rapor taslağı bozmayacak.
6. **Doğrulama ve teslim:** marka dönüşümü ve tekrar yazım, katalog föyü eşleşmesi, seri kısıtı, DR bağlantısı, halat/teker/ray değişiminin fiziksel sonuçları, kayıt/yükleme ve mobil popup testleri. Gerçek katalogla standart tercihler çalıştırılacak; eksikler sayısal kontrolleri gizleyerek kapatılmayacak.

Mevcut seçim motoru zaten sırayla ortak hesabı çalıştırır; bu tur yeni bir hesap formülü katmanı oluşturmaz. Yeni tasarım kararları aynı rapor girdilerine uygulanır. Portal/rüzgâr/ankraj gibi önceki teslimde açık bırakılan bağımsız mühendislik modelleri bu kullanıcı geri bildiriminin yerine geçmez.

## Uygulanan akış

Altı faz uygulandı. Teknik Özellikler yanındaki **Hızlı otomatik seçim** düğmesi aynı mühendislik/teklif rapor editörünü açar:

1. Firma markaları ilk açılışta seçilir. Son çalıştırmadaki kullanıcı marka/seri tercihi bu tarayıcıda saklanır. Marka değişince o markanın varsayılan serisi gelir; kullanıcı tüm uygun serilerden arama seçeneğini de kullanabilir.
2. Hızlı pencere her etkin kaldırmanın halat donanımını ve her etkin yürütmenin teker/tahrik adedini, ray ailesini ve ölçüsünü mevcut rapordan okur. İkiz ve çift tamburlu düzenlerde donanımın neyi ifade ettiği açıklanır.
3. Başlatmadan önce eksik/geçersiz donanım, ray, adet ve kilit çelişkileri denetlenir. Tahrik adedi motor adedine eşitlenir ve her motor bir teker sürer. Motor grubu kilitliyken adedi değiştiren bir karar uygulanmaz. Tasarım değişince teker yükü/ana kiriş ölçü teyitleri sıfırlanır.
4. Katalog özeti gerçek seri ve giriş bağlantısını taşır. Redüktör indirmesi marka + uygulama + seriyle sınırlandırılır. Ortak aday seçici tüm ekipmanlarda marka/seri koşulunu yeniden uygular; uygun ürün yoksa tercih sessizce gevşetilmez.
5. Seçici ortak hesap motorunda halat, tambur/mil/rulman, tahrik grubu, fren/kaplin, kanca/makara, yürütme ve etkin yapı bölümlerini sırayla değerlendirir. Bir motoru seçip bağlı redüktör/kaplin uyumsuzluğunu görmezden gelmez: bağlı adayları birlikte sınar. Ölçü önerisi açıksa tambur, miller ve desteklenen kesit adayları da hesapla aranır. Son turda kütle ve bağlı kontroller tekrar hesaplanır; etkin elektrik modülü aynı motor seçimlerini okur.
6. Sonuç bir defada düzenlenebilir taslağa uygulanır. Pencereyi çalıştırmadan kapatmak raporu değiştirmez. Sonucu uygulamak raporu kendiliğinden kaydetmez; kullanıcı düzenleyip kaydeder. Marka/seri ve tasarım kararları `autoSelection` 1.2.0 izinde, güncel hesap motoru 0.8.1 ile saklanır. Önceki iz sürümleri okunabilir.

## DR bağlantısı ve firma kabulleri

DR kataloğunda giriş mili çapının boş olması her zaman eksik katalog anlamına gelmez: `input_configuration = Motor akuple` gerçek bağlantı türüdür. Yalnız yürütme redüktöründe bu bilgi varsa harici motor kaplini aranmaz. Aynı karar motor kontrolleri, editör, PDF ve ekipman listesinde ortak yardımcıdan okunur. Motor, redüktör, fren ve teker kontrolleri devam eder. Mil girişli başka redüktör seçilirse kaplin bölümü ve kontrolleri geri gelir; yeni katalog satırında bağlantı boşsa eski akuple kararı temizlenir.

IEC flanşı, adaptör ve montaj uyumu üretici belgesiyle doğrulanacak ayrı not olarak kalır. Boş motor sipariş alanları mevcut firma başlangıç değerleriyle tamamlanır (F, S1, termal koruma seçimi; boş montaj alanında akuple yürütmede B5, diğerlerinde B3). Dolu kullanıcı değeri veya kilit ezilmez. Teker sertliği popup'ta sorulmaz; mevcut değer korunur, boşsa 32–35 HRC gelir. Bu değerler üreticinin doğrulanmış kapasitesi olarak sunulmaz.

## Veritabanı ve marka dönüşümü

`20260909000005_brand_uppercase.sql` ve `20260909000006_auto_selection_series.sql` Supabase'e uygulandı. Katalogdaki 71.539 satırın kimlikleri ve sayısı korundu. Kaplinlerin önceden var olan aynı model/farklı kapasite varyantları birleştirilmedi. `cat_equipment.brand`, `cat_couplings.brand`, elektrik belgesi üreticisi ve teklif marka defteri büyük harfe çevrildi; tetikleyiciler sonraki yazımları da normalize eder.

Türkçe karakterli marka dönüşümü `kimlikBuyuk` ile SQL'de aynıdır: YILMAZ REDÜKTÖR ve HAŞÇELİK; ASCII marka DERELI. Model kodları değiştirilmez. Yönetici girişleri, yeni katalog seçimleri ve yerel sürücü marka listeleri de aynı yazımı kullanır. Eski karma harfli sürücü tercihi aynı ürünü bulur. Yayımlanmış belge snapshot'ları tarihsel içerik olarak korunur.

`scripts/verify-brand-uppercase.sql` gerçek DB'de işlem içinde doğrulandı: mevcut dört kaynakta dönüşüm, yeni insert/update normalizasyonu, eski harfli marka + DR seri filtresi, olmayan seride sıfır sonuç, anonim RPC yasağı. Test ürünü geri alındı; kalıcı test ürünü veya işi eklenmedi.

## Doğrulama sonuçları

- Gerçek katalog senaryosu: GAMAK / YILMAZ H–DR / SIBRE APC-AT, ana araba 4 teker–2 tahrik–70×40, köprü 8 teker–4 tahrik–A120. Son ölçüm: **2,86 saniye, 2.086 hesap değerlendirmesi, 27 ekipman kararı**. Bu süre yerel hesap süresidir; ilk katalog indirmesi dahil değildir. Ana kaldırma/kanca/araba/köprü senaryosunda başarısız sayısal kontrol yok; 16 eksik üretici/veri notu ve 6 inceleme notu açık kaldı. Yapı ve tüm vinç tipleri için imalat onayı anlamına gelmez.
- Özellik/API/kayıt testleri dahil son regresyon grubu **224/224 geçti**; dokuz gerçek katalog senaryosu dahil. Halat kolu değişiminin halat yüküne, teker adedinin teker yüküne ve rayın temas genişliğine etkisi ölçüldü. Kilit, kaynak hash'i, iz kayıt/yükleme, motor varsayılanları, eski marka/föy eşleşmesi ve DR→mil girişli geçiş sınandı.
- Genel paket: 254 dosya çalıştırıldı; ilk çalışmada 3.852 geçti, 8 beklenti başarısız, 1 test atlandı. Sekiz beklenti düzeltildi ve ilgili dosyaların tüm testleri yukarıdaki 224/224 tekrarında geçti. Bunların üçü önceki sürümden kalan tambur mili ayrı çizelgesi, gerçekleşen hız başlığı ve yayımlanmayan ESIT PL/PLI ağırlığı beklentileriydi; üretim hesabı bu testleri geçirmek için değiştirilmedi.
- PDF render kontrolleri genel pakette geçti. Yeni DR testi akuple arabanın motor kaplin bölümünün basılmadığını; redüktör, teker kaplini ve mil girişli köprünün motor kaplin bölümünün korunduğunu doğruladı.
- Tarayıcı: 1280×900 ve 390×844, yatay taşma yok. Standart marka/seriler, donanım/ray/adet değişikliği, 27 seçimin taslağa uygulanması, yeniden açmada korunması ve işlem başlatmadan kapatmanın taslağı değiştirmemesi doğrulandı. Tarayıcı hata kaydı yok. Önizleme gerçek editörü ve 46 gerçek katalog satırını kullanır; DB'ye kayıt yapmaz.
- TypeScript geçti. Değişen kaynaklarda ESLint: 0 hata, ekipman listesindeki önceden var olan iki kullanılmayan değişken uyarısı. Belge denetleyicisi: hata yok, mevcut 10 yol/ifade uyarısı.
- `npm run build` geçti; üretim derlemesi ve Next.js TypeScript aşaması tamamlandı. İlk denemedeki Google Fonts ağ erişimi engeli, ağ erişimli tekrar ile çözüldü.

Kalan üretici ve ölçü notları kullanıcıya görünür. Seçici, doğrulanmamış veri veya uygun olmayan sayısal sonucu tamamlanmış saymaz; kullanıcı aynı taslakta düzeltmeye devam eder. Firma vinç tiplerine göre onaylı tasarım profilleri ve eksik üretici verileri sonraki iyileştirmelerdir; bu turdaki altı arayüz/akış gereksinimi için engel değildir.
