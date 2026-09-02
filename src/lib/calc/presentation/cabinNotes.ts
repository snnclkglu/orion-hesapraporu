// KABİN VE ELEKTRİK ODASI — BİLGİ NOTLARI.
//
// Kullanıcı isteği (02.09.2026, md. 6 ve md. 14): *"Girdiler ve tasarım
// kabulleri başlığının yanına «i» şeklinde bir sembolle bilgilendirme pop-up'ı
// yapalım ve bu hesabın nasıl yapıldığını detaylı, şematik ve açıklayıcı
// verelim. Kullanıcı anlasın, unutursa hatırlasın."*
//
// NEDEN AYRI DOSYA: metinler uzundur ve `cabinSections.ts` bir SUNUM
// TANIMIDIR — satırlar, formüller, kontroller. Notları oraya koymak, dosyayı
// okuyup bir satır arayan mühendisi üç ekran metnin içinden geçirirdi.
//
// SAYILAR KODDAN OKUNMAZ, KODLA BİRLİKTE YAZILIR: buradaki her katsayı
// `climate-load.ts` ve `modules/cabin.ts` içindeki gerçek değerdir. Biri
// değişirse buradaki cümle de değişmelidir — metnin yalan söylemesi, hiç
// olmamasından kötüdür.

/** Üç mahalde de ortak olan çekirdek adımlar. */
const ORTAK_YONTEM =
  "YÖNTEM — tek satır\n" +
  "  Q = (İletim + Güneş + Işınım + Cihaz Isısı + Operatör + Taze Hava) × 1,15\n" +
  "\n" +
  "1 · ZARF VE U DEĞERİ\n" +
  "Zarf alanı = 4 duvar + tavan + DÖŞEME. Döşeme de sayılır; güneş görmez ve " +
  "muhafazakâr olsun diye dış hava sıcaklığında kabul edilir.\n" +
  "Taş yününün ısıl iletkenliği SABİT ALINMAZ — beyan değeri 10 °C içindir, " +
  "yalıtımın gerçek ortalama sıcaklığı (T_dış + T_iç)/2'dir:\n" +
  "  λ(T) = 0,036 + 0,00017 × (T_ort − 10) [W/mK]\n" +
  "50 °C dışta λ beyandan ~%13 yüksek çıkar; beyan değerini doğrudan " +
  "kullanmak ısı geçişini o kadar EKSİK hesaplar.\n" +
  "  U = 1 / (0,13 + d/λ + 0,04) × 1,15\n" +
  "0,13 ve 0,04 iç/dış yüzey ısıl dirençleridir (EN ISO 6946); 1,15 çarpanı " +
  "panel ekleri ve çelik karkasın ısı köprüsü payıdır. Ölçülen: 100 mm → " +
  "U = 0,43 · 50 mm → U = 0,81 W/m²K. Kalınlığı ikiye katlamak U'yu tam " +
  "yarıya indirmez.\n" +
  "KAPI panel alanından DÜŞÜLÜR ve kendi U değeriyle (2,0 W/m²K, yalıtımlı " +
  "çelik kapı) hesaplanır; adet hem ısı geçişine hem sızıntıya girer.\n" +
  "\n" +
  "2 · GÜNEŞ — ayrı bir kalem değil, iletimin İÇİNDE\n" +
  "Yalnız teknik özelliklerde «açık hava» seçilmişse devreye girer. Güneş yükü " +
  "yüzeyin GÖRDÜĞÜ sıcaklığı yükseltmektir (ASHRAE güneş-hava / sol-air):\n" +
  "  T_sol = T_dış + α·I/h_o − ΔR/h_o\n" +
  "α = 0,5 (orta renk boya), I_çatı = 950, I_duvar = 350 W/m² (Türkiye, yaz " +
  "öğle saati), çatıda 4 K gökyüzü ışınım düzeltmesi. Bütün yüzeyler ÇATININ " +
  "tepe saatiyle değerlendirilir; her cepheyi kendi tepe saatiyle toplamak " +
  "aynı anda gerçekleşmeyen yükleri üst üste koyardı.\n" +
  "DİKKAT: dış yüzey taşınım katsayısı EN ISO 6946'nın 25 W/m²K'sı, gök " +
  "düzeltmesi ise ASHRAE'nin 17 W/m²K için kalibre edilmiş 4 K'sıdır. İkisi " +
  "aynı kaynaktan değildir ve çatı güneş yükünü İYİMSER gösterir. Açık havada, " +
  "koyu boyalı ve geniş çatılı bir mahalde bu kaleme pay bırakın.\n" +
  "\n" +
  "3 · IŞINIM — uygulama HESAPLAMAZ, siz girersiniz\n" +
  "Ayrıntı «Çevre Işınım Yükü» alanının kendi bilgi notundadır.\n" +
  "\n" +
  "4 · TAZE HAVA VE BASINÇLANDIRMA\n" +
  "Mahal 4 Pa fazla basınçta tutulur ki toz ve kirli hava içeri girmesin. Bu " +
  "basıncı ayakta tutan üfleme debisi, sızıntı deliklerinden kaçan debiye " +
  "eşittir:\n" +
  "  sızıntı alanı = kapı adedi × 3 cm² + 4 cm² sabit (kablo/kanal geçişleri)\n" +
  "  v = √(2·Δp/ρ_dış) → 50 °C'de ~2,7 m/s, 1 kapılı mahalde ~6,7 m³/h\n" +
  "Bu havanın yükü TAM ENTALPİ farkıyla alınır: Q = ṁ × (h_dış − h_iç), yani " +
  "duyulur VE gizli birlikte. 40 °C/%50 → 25 °C/%50 arasında Δh = 50,5 kJ/kg; " +
  "60 °C/%40'ta 149,6 kJ/kg — ÜÇ KAT. Sıcak ortamda taze havayı yalnız " +
  "sıcaklık farkıyla hesaplamak ciddi bir eksiktir.\n" +
  "SIZINTI MODELİ İYİMSERDİR: toplam 7 cm²'lik açıklık iyi sızdırılmış YENİ " +
  "bir mahal varsayar. Kapının sık açıldığı, kablo geçişleri köpüklenmemiş bir " +
  "yerde gerçek sızıntı bunun katlarıdır.\n" +
  "\n" +
  "5 · YOĞUŞMA VE ÜFLEME DEBİSİ\n" +
  "  m_su = ṁ_taze × (w_dış − w_iç) — drenaj hattını ve rekorunu unutmayın.\n" +
  "  V = Q / (ρ·cp·ΔT_üfleme), ΔT_üfleme = 8 K\n" +
  "Debi TOPLAM yükten DUYULUR bir formülle türetilir; gizli yük sıcaklık " +
  "farkıyla taşınmadığı için sonuç gerçekte gerekenden YÜKSEK çıkar. Üniteyi " +
  "debiye göre değil KAPASİTEYE göre seçin.\n" +
  "\n" +
  "6 · EMNİYET KATSAYISI\n" +
  "%15, üç mahalde de sabittir (firma kabulü): tozlu ortamda kondenser " +
  "kirlenmesi, filtre tıkanması ve ölçülemeyen kaçaklar içindir. Bir " +
  "standarttan gelmez ve ORTAM SICAKLIĞINA BAĞLI KAPASİTE DÜŞÜŞÜNÜN YERİNİ " +
  "TUTMAZ — ikisini birbirine mahsup etmeyin.\n" +
  "\n" +
  "7 · KATALOG KAPASİTESİ HANGİ NOKTADA?\n" +
  "Üretici kapasitesini L35/L35'te yayımlar (DIN 3168 / EN 14511: 35 °C ortam, " +
  "35 °C mahal içi). Uygulamanın kapasite kontrolü bu sayıyı DOĞRUDAN kullanır, " +
  "ortam sıcaklığına göre DÜŞÜRMEZ. Ölçülmüş örnek: L35/L35'te 0,52 kW veren " +
  "bir ünite L35/L50'de 0,32 kW verir — %38 düşüş. Ortam 40 °C'yi aşıyorsa " +
  "üreticinin kapasite eğrisinden gerçek değeri okuyun; kontrolün «geçti» " +
  "demesi yetmez. (Uygulama bunu ayrı bir uyarı kontrolüyle de hatırlatır.)\n" +
  "ORTAM SICAKLIĞI KONTROLÜ AYRI BİR ŞEYDİR: yalnız ünitenin o sıcaklıkta " +
  "ÇALIŞABİLDİĞİNİ söyler, ne kadar SOĞUTTUĞUNU değil.";

/** 11.2 — Elektrik Odası bilgi notu. */
export const ELEKTRIK_ODASI_NOTU =
  "ELEKTRİK ODASI ISI YÜKÜ — HESAP NASIL YAPILIYOR?\n" +
  "\n" +
  "Bu bir ÖN BOYUTLANDIRMA ve KONTROL hesabıdır. Bir üretici tablosunu taklit " +
  "etmez: zarf ısı geçişi EN ISO 6946, güneş yükü ASHRAE güneş-hava (sol-air) " +
  "yöntemi, taze hava psikrometrik entalpi farkıdır. Nihai kapasite üreticinin " +
  "proje bazlı teyidine tabidir.\n" +
  "\n" +
  ORTAK_YONTEM +
  "\n\n" +
  "ODAYA ÖZGÜ — CİHAZ ISISI (yükün %85–90'ı)\n" +
  "Anahtar «otomatik» iken pano kayıp gücü ayrıca sorulmaz; kaldırma ve " +
  "yürütme bölümlerinde SEÇTİĞİNİZ motorlardan türetilir:\n" +
  "  a) Her motor için ABB ACS880-104 (400 V) tablosunda motor gücünü " +
  "karşılayan en küçük AĞIR HİZMET (P_Hd) satırı seçilir — vinç tahrikinde " +
  "sürücü ağır hizmet sütunundan gelir.\n" +
  "  b) O satırın KATALOG atık ısısı × motor adedi toplanır (55 kW → 1,1 kW; " +
  "11 kW → 0,3 kW). Bunlar tahmin değil, katalogun kendi sütunudur.\n" +
  "  c) + %80 yardımcı pay: besleme ünitesi, trafo, PLC, UPS, aydınlatma. " +
  "Rejeneratif IGBT besleme tek başına ≈%4 kaybeder.\n" +
  "  d) × 0,6 eşzamanlılık: vinç kesikli çalışır, kaldırma dönerken yürütme " +
  "durur. Klima mahallin termal zaman sabiti üzerinden ORTALAMA kaybı görür.\n" +
  "Net sonuç kurulu tahrik gücünün ≈%2,2'sidir; Pfannenberg'in yayımlanmış " +
  "kuralı (%2–5, tipik %3) ile aynı banttadır. Anahtarı KAPATIRSANIZ elektrik " +
  "taşeronundan gelen gerçek listeyi yazarsınız.\n" +
  "Odanın klimasını zarf değil PANOLAR belirler: zarf kalemlerinde ±%20 hata " +
  "sonucu az, cihaz ısısında ±%20 hata çok değiştirir.\n" +
  "\n" +
  "ODADA İNSAN YOKTUR: kişi başı temiz hava gereği aranmaz, taze hava debisini " +
  "yalnız basınçlandırma belirler. (Kabinde bu böyle DEĞİLDİR.)\n" +
  "\n" +
  "DİKKAT\n" +
  "· FREN DİRENCİ HESABA GİRMEZ. Vinç yük indirirken rejenerasyon yapar ve " +
  "direnç üzerinden atılan tepe ısısı sürücü kayıplarının katlarıdır. Direnç " +
  "odanın İÇİNDEYSE otomatik anahtarı kapatıp cihaz ısısını elle girin.\n" +
  "· OTOMATİK PANO KAYBI SEÇİLMİŞ MOTORLARA BAĞLIDIR. Motor gücü sonradan " +
  "değişirse ısı yükü ve klima kontrolü sessizce değişir; klima seçimini " +
  "motorlar kesinleştikten sonra dondurun.\n" +
  "· İÇ SICAKLIK ARTIK SİZİN SEÇİMİNİZ (23/24/25 °C). IEC 61439-1 panoları " +
  "35 °C 24-saat ortalamasına göre doğrular; daha düşük bir hedef güvenli " +
  "taraftadır ama klimayı büyütür (elektrolitik kondansatör ömrü her 10 K " +
  "düşüşte yaklaşık ikiye katlanır).\n" +
  "· KIŞ HESAPLANMAZ. Dış mahalde pano ısıtıcısı ve yoğuşma önlemi bu hesabın " +
  "dışındadır; ayrı karar verin.\n" +
  "· YERLEŞİM KONTROLLERİ: pano dizisi oda boyuna sığıyor mu, pano + 200 mm " +
  "baza yüksekliği sığıyor mu, pano derinliğinden sonra yürüme mesafesi " +
  "kalıyor mu — üçü de ayrı kontrol satırıdır.";

/** 11.1 — Operatör Kabini bilgi notu. */
export const OPERATOR_KABINI_NOTU =
  "OPERATÖR KABİNİ ISI YÜKÜ — HESAP NASIL YAPILIYOR?\n" +
  "\n" +
  "Kabin, elektrik odasıyla AYNI çekirdekten geçer: zarf, güneş, ışınım, taze " +
  "hava ve emniyet katsayısı bire bir aynıdır. Kabini ayıran ÜÇ kalem vardır — " +
  "içinde İNSAN vardır, büyük bir CAM yüzeyi taşır ve kapısı küçüktür.\n" +
  "\n" +
  ORTAK_YONTEM +
  "\n\n" +
  "KABİNE ÖZGÜ — 1 · CAM (kabini kabin yapan kalem)\n" +
  "Cam duvar alanından DÜŞÜLÜR; kalan panel alanı panelin U'suyla, cam kendi " +
  "U'suyla hesaplanır — aynı yüzey iki kez sayılmaz.\n" +
  "Camın İKİ AYRI YOLU vardır:\n" +
  "  a) İletim: U·A·ΔT — kapalı mahalde de vardır.\n" +
  "  b) Doğrudan güneş: g·A·I_duvar — yalnız açık havada; ısı iletimle değil " +
  "ışınımla cam düzleminden geçerek girer. 2,5 m² çift camda tek başına " +
  "0,75 × 2,5 × 350 ≈ 656 W.\n" +
  "Tek cam, 50 mm panelin 7 katı, 100 mm panelin 13 katı ısı geçirir. Ölçülen " +
  "aynı kabin açık havada: tek cam 2,70 · çift cam 2,42 · reflektif 1,94 kW — " +
  "reflektif kaplama toplamı %28 düşürür ve klimayı bir boy küçültür.\n" +
  "U ve g değerlerinin tamamı «Cam Tipi» alanının bilgi notundadır.\n" +
  "\n" +
  "2 · OPERATÖR — kişi başına 130 W\n" +
  "75 W duyulur + 55 W gizli. Kaynak: ASHRAE Handbook — Fundamentals, " +
  "«insanların verdiği ısı ve nem» tablosu, oturur / hafif iş satırı. Vinç " +
  "operatörü tam bu satırdır.\n" +
  "GİZLİ kısım terleme ve solunumdur: sıcaklık farkıyla görünmez, klimanın " +
  "alması gereken NEMDİR ve drenaja gider (kişi başına ~0,08 kg/h su).\n" +
  "«Operatör Adedi» İKİ şeyi birden belirler: bu 130 W ve aşağıdaki temiz " +
  "hava debisi.\n" +
  "\n" +
  "3 · TAZE HAVA — kabinin en büyük farkı ve en sık atlanan kalem\n" +
  "Kabinde debi İKİ gereğin BÜYÜĞÜDÜR:\n" +
  "  a) basınçlandırma sızıntısı (odadaki modelin aynısı, 1 kapıda ~6,7 m³/h),\n" +
  "  b) kişi başı temiz hava: 5 L/s = 18 m³/h·kişi.\n" +
  "1 operatörlü kabinde (b) kazanır ve yük yine tam entalpi farkından alınır. " +
  "Bu, kabin toplamının yaklaşık DÖRTTE BİRİDİR. E-house formunu kabine olduğu " +
  "gibi uygulayan hesaplarda en sık atlanan kalem budur: basınçlandırma " +
  "sızıntısı yalnız fazla basıncı tutar, İNSANIN havası ondan bağımsız bir " +
  "SAĞLIK gereğidir.\n" +
  "5 L/s'nin yeri: ASHRAE 62.1 ofis için 2,5 L/s·kişi + 0,3 L/s·m² ister — " +
  "5 m²/1 kişilik kabinde 4,0 L/s eder, yani 5 L/s bunu karşılar. EN 16798-1 " +
  "Kategori II ise ≈10,5 L/s ister; 5 L/s Kategori III bandındadır. Tam " +
  "vardiya çalışılan bir kabinde yükü ~0,13 kW artırıp 7 L/s'ye çıkmayı " +
  "değerlendirin.\n" +
  "\n" +
  "4 · CİHAZ ISISI — kabinde PANO KAYBI YOKTUR\n" +
  "Otomatik türetme çalışmaz; sayı doğrudan sizin girdinizdir. Varsayılan " +
  "0,3 kW'ın kalem dökümü [W]: LED aydınlatma 2×18 = 36 · ekran/HMI 40 · PLC " +
  "uzak G/Ç 25 · 24 V DC güç kaynağı kaybı 20 · kumanda trafosu + klemens " +
  "kutusu 30 · telsiz ve interkom 20 · kamera monitörü 25 · joystikler 2×5 = 10 " +
  "· cam sileceği ve defroster fanı (kesikli) 40 · koltuk fanı (kesikli) 50 → " +
  "sürekli ≈245 W, kesiklilerle tepe 300–350 W.\n" +
  "BU LİSTEYE OPERATÖRÜ EKLEMEYİN: operatör AYRI bir kalemdir ve toplama " +
  "zaten girer; sayıya onu da katmak yükü çift saydırır.\n" +
  "PC tabanlı büyük ekran, ikinci monitör, kabin buzdolabı ya da güçlü bir " +
  "defroster varsa 0,5–0,7 kW yazın.\n" +
  "\n" +
  "DİKKAT\n" +
  "· CAM ALANI OTOMATİKTİR ama ölçüyü doğrulayın: ön + yan + TABAN camı olan " +
  "bir haddehane kabininde otomatik değer az kalabilir. Anahtarı kapatıp " +
  "gerçek alanı yazabilirsiniz.\n" +
  "· AÇIK HAVA / KAPALI MAHAL seçimi kabinde klimayı neredeyse İKİYE KATLAR " +
  "(ölçülen örnekte 1,39 → 2,42 kW).\n" +
  "· İKİ OPERATÖRLÜ kabinde (operatör + eğitmen/bakımcı) adedi 2 yazın; " +
  "ölçülen örnekte yük 1,39 → 1,88 kW olur.\n" +
  "· YOĞUŞMA: üfleme havası kabinden 8 K soğuk kabul edilir. 25 °C/%50'lik bir " +
  "kabinin çiy noktası 13,9 °C olduğu için menfezde yoğuşma beklenmez; daha " +
  "soğuk üfleyen bir ünite seçilirse damlama ve drenaj kontrolünü ayrıca yapın.";

/**
 * Işınım yükü bilgi notu — üç mahalde de aynı (kullanıcı isteği, md. 8 ve 12).
 *
 * Kullanıcının sorusu birebir şuydu: *"örneğin 4 metre uzaklıkta
 * 1000×2000×6000 mm boyutlarında 600 °C sıcak kütük var diyebilir mi? Bunun
 * ışınım yükünü nasıl hesaplayacak veya tahmin edecek?"* — cevabı da örnekle
 * birlikte burada.
 */
export const ISINIM_NOTU =
  "ÇEVRE IŞINIM YÜKÜ — NE GİRECEKSİNİZ?\n" +
  "\n" +
  "DİKKAT — BU ALAN CEPHEYE DÜŞEN IŞINIMI DEĞİL, CEPHEDEN İÇERİ GEÇEN KISMI " +
  "İSTER. Girilen değer hesaba doğrudan bir yük olarak eklenir (emniyet " +
  "katsayısı sonradan çarpılır). Düşen ışınımı yazarsanız yük katlarca şişer.\n" +
  "\n" +
  "NE ZAMAN GİRİLİR\n" +
  "Mahal kızgın bir yüzeyi (pota, kızgın slab/kütük, fırın ağzı, döküm hattı) " +
  "DOĞRUDAN görüyorsa. Arada platform, duvar ya da ısı kalkanı varsa BOŞ " +
  "BIRAKIN — ışınım görüş hattı ister. Boş bırakılırsa 0 alınır ve rapora " +
  "«Çevre Işınım Yükü Girilmedi, Hesaba Katılmadı» bilgi kontrolü düşer; " +
  "sessizce yutulmaz.\n" +
  "\n" +
  "NASIL KESTİRİLİR\n" +
  "  q″ = ε · σ · F · (T_kaynak⁴ − T_yüzey⁴)     [W/m²]\n" +
  "  σ = 5,67·10⁻⁸ W/m²K⁴ · sıcaklıklar KELVİN\n" +
  "  ε = ε_kaynak × α_yüzey (oksitli sıcak çelik 0,80 × boyalı sac 0,90 ≈ 0,72)\n" +
  "  F = görüş faktörü — kaynağın cepheden görünen KATI AÇI payı\n" +
  "Cepheye düşen toplam = q″ × cephe alanı. İçeri GEÇEN kısım cephenin " +
  "yapısına bağlıdır: cam ısınıp iletir ve kısa dalgayı kısmen geçirir, " +
  "yalıtımlı panel neredeyse hiçbir şey geçirmez.\n" +
  "\n" +
  "GÖRÜŞ FAKTÖRÜ — SIK YAPILAN HATA\n" +
  "Noktasal kaynak yaklaşımı F ≈ A/(π·r²)'dir; PAYDA 4π DEĞİLDİR. Yayan düz " +
  "bir yüzey enerjisini yarım küreye kosinüs ağırlıklı verir ve integrali " +
  "π'dir — 4π kullanmak yükü tam DÖRT KAT eksik gösterir.\n" +
  "Bu yaklaşım ancak mesafe kaynağın en büyük boyutunun ~2 katıysa güvenilir " +
  "(o noktada %6 hata). Daha yakında fazla verir: r/D = 0,67'de %48, " +
  "r/D = 0,33'te %167 fazla.\n" +
  "Karşılıklı iki dikdörtgen için ölçülmüş değerler (2,5 × 2,4 m cephe ↔ " +
  "6 × 2 m görünen kaynak yüzü, merkezli):\n" +
  "  2 m → F = 0,357 · 4 m → 0,161 · 6 m → 0,087 · 8 m → 0,053\n" +
  "\n" +
  "ÖRNEK — 4 m uzaklıkta 600 °C sıcak kütük\n" +
  "Kütük 1.000 × 2.000 × 6.000 mm; cepheye dönük yüzü 2 × 6 m = 12 m². Kabin " +
  "cephesi 2,5 × 2,4 m = 6 m². Yarısı cam (3 m² tek cam), yarısı 100 mm " +
  "yalıtımlı panel.\n" +
  "  σ·(873 K⁴ − 318 K⁴) = 32,4 kW/m²\n" +
  "  q″ = 0,72 × 0,161 × 32.400 ≈ 3.760 W/m²  (yaz öğle güneşinin DÖRT KATI)\n" +
  "  cepheye DÜŞEN = 3,76 × 6 ≈ 22,5 kW\n" +
  "  içeri GEÇEN ≈ 3,5 kW   ← BU ALANA YAZILACAK SAYI\n" +
  "Geçenin 3,3 kW'ı CAMDAN gelir. Aynı cephe camsız olsaydı 0,30 kW olurdu.\n" +
  "\n" +
  "KESTİRME TABLO — cepheden İÇERİ GEÇEN [kW]\n" +
  "(2,5 × 2,4 m cephe, yarısı tek cam; kaynak görünen yüz 2 × 6 m, ε = 0,72)\n" +
  "  Kaynak       2 m     4 m     6 m     8 m\n" +
  "   400 °C      2,5     1,1     0,6     0,4\n" +
  "   600 °C      7,8     3,5     1,9     1,2\n" +
  "   800 °C     19       8,5     4,6     2,8\n" +
  "  1000 °C     39      17,6     9,5     5,8\n" +
  "  1200 °C     72      32      17,5    10,7\n" +
  "Cephenin tamamı yalıtımlı panelse bu sayıları ~%10'una, tamamı camsa ~2 " +
  "katına alın. Cephe kaynağa tam dönük değilse cos(θ) ile çarpın.\n" +
  "\n" +
  "ÖNCE KALKAN, SONRA KLİMA\n" +
  "Cephe önüne konan TEK parlak alüminyum ısı kalkanı (ε ≈ 0,05, iki yüzü) " +
  "ışınımı ~30 kat keser: yukarıdaki 3,5 kW → 0,13 kW. Metalurji vinçlerinde " +
  "standart uygulama budur. 4 m'de 600 °C bir kütüğü kalkansız görmek " +
  "savunulabilir bir tasarım değildir; bu bir klima sorunundan önce bir CAM ve " +
  "KALKAN sorunudur.";

/**
 * Kabin cihaz ısısı bilgi notu — 0,3 kW varsayılanının kalem dökümü.
 *
 * Kullanıcı sorusu (md. 12): *"Kabin içi ısıyı neye göre 0,3 alıyoruz, bunun
 * açıklaması var mı?"* — dökümü buradadır ve toplamı gerçekten 0,3 kW eder.
 */
export const KABIN_CIHAZ_ISISI_NOTU =
  "KABİN İÇİ ISI — 0,3 kW NEREDEN GELİYOR?\n" +
  "\n" +
  "Kabinde PANO KAYBI YOKTUR; otomatik türetme çalışmaz ve sayı doğrudan sizin " +
  "girdinizdir. Varsayılan 0,3 kW'ın kalem dökümü [W]:\n" +
  "  · LED kabin aydınlatması        2 × 18 = 36\n" +
  "  · Operatör ekranı / HMI (10–15\")     40\n" +
  "  · PLC uzak G/Ç düğümü                 25\n" +
  "  · 24 V DC güç kaynağı kaybı           20\n" +
  "  · Kumanda trafosu + klemens kutusu    30\n" +
  "  · Telsiz ve interkom                  20\n" +
  "  · Kamera monitörü (CCTV)              25\n" +
  "  · Master kollar / joystikler   2 × 5 = 10\n" +
  "  · Cam sileceği + defroster (kesikli)  40\n" +
  "  · Koltuk fanı (kesikli)               50\n" +
  "  → sürekli ≈ 245 W · kesiklilerle tepe 300–350 W\n" +
  "Yalın bir kumanda kabini için 0,3 kW savunulabilir bir kabuldür.\n" +
  "\n" +
  "OPERATÖRÜ BU SAYIYA EKLEMEYİN. Operatör AYRI bir kalemdir (kişi başına " +
  "75 W duyulur + 55 W gizli) ve toplama zaten giriyor; buraya da katarsanız " +
  "130 W'ı çift saymış olursunuz — ölçülen bir kabinde bu, toplamın %11'idir.\n" +
  "\n" +
  "NE ZAMAN ARTIRILIR: PC tabanlı büyük ekran, ikinci monitör, kabin " +
  "buzdolabı / su ısıtıcısı ya da güçlü bir defroster varsa 0,5–0,7 kW yazın.";
