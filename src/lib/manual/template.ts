// EL KİTABININ ŞABLONU — bölüm ağacı ve STANDART METİNLER.
//
// KAYNAK: firmanın kendi teslim ettiği "185/40 Ton Kapasiteli Şarj Vinci
// Kullanma ve Bakım Kılavuzu" (Karçel A.Ş., 028.00-KBK01, 24.07.2026) —
// DÖRT ana bölüm ve 47 alt başlık. (Uzun süre "14 ana bölüm" yazıyordu; 14
// aslında DÖRDÜNCÜ bölümün alt bölüm sayısıdır — 4.1…4.14.) Şablon o belgenin
// İSKELETİ ve PROJEDEN BAĞIMSIZ metinleridir; kendi bölümlendirmesi kaynağın
// aynısı DEĞİLDİR — dokuz gövde bölümü + numarasız Ekler kapsayıcısı.
//
// ŞABLONA VİNCE ÖZEL HİÇBİR SAYI GİRMEZ (değişmez md. 4). "185T", "8 adet
// acil stop butonu", "Mevcut Şifre : 028", "192.168.221.23" — bunların hepsi
// O VİNCİN gerçeğidir ve başka bir vinçte yanlıştır. Bir şablonun içine
// kaçmış tek bir sayı, otuz kılavuz sonra kimsenin fark etmeyeceği bir yalan
// olur. Bu yüzden o bölümler BAŞLIK + BOŞ BLOK olarak doğar ve mühendis
// doldurur; doldurulmamış blok belgeye BASILMAZ.
//
// STANDART METİN DEĞİŞTİRİLEBİLİR: her blok `fromTemplate` ile doğar, kullanıcı
// dokununca `edited` açılır ve şablon onu bir daha ezmez (`types.ts` başlığı).
//
// MÜŞTERİNİN LİSTESİ EKLERDEDİR. Kardemir'in talep ettiği yedi başlık
// (mekanik hesap · mekanik proje · mekanik katalog · elektrik hesap ·
// elektrik proje · elektrik katalog · şartname) gövdeye YAZILMAZ, EK olarak
// bağlanır: hepsi zaten uygulamada duran birer PDF'tir ve gövdeye kopyalanan
// her sayfa bir gün kaynağıyla ayrışır.

import { bosluk, not, ol, oto, p, resim, tablo, ul } from "./template-kit";
import type { TemplateSection } from "./template-kit";

// Tipler ve kurucular `template-kit.ts`tedir ve BURADAN YENİDEN DIŞA
// AKTARILIR: `payload.ts` ve editör bugüne kadar onları bu dosyadan alıyordu,
// yol değiştirmek gereksiz bir kırılma olurdu.
export type { TemplateBlock, TemplateSection } from "./template-kit";

/**
 * ŞABLON SÜRÜMÜ. Artırıldığında var olan belgeler DEĞİŞMEZ — editör yalnız
 * "şablonda yeni bölümler var" der ve eklemeyi kullanıcı seçer. Belge
 * kullanıcınındır; bir güncelleme onun sildiği bölümü geri getiremez.
 */
// SÜRÜM 2 (30.08.2026): şablon on iki yeni bölümle büyüdü — vinç hareketleri,
// kumanda cihazları, ana parçalar, çalışma prensibi, ana kesici, acil stop,
// açıklık ölçümü, cıvatalı birleşimler, yağlama noktaları, gres sistemi,
// yedek parça siparişi ve servis, atık bertarafı, terminoloji, garanti.
// Kapsam haritası piyasadaki bir kılavuzdan OKUNDU ama METİN VE ŞEKİL
// ALINMADI (KITAP-13); metinler özgün yazıldı ve dayanakları kamuya açık
// standartlardır.
//
// SÜRÜM ARTIŞI VAR OLAN BELGELERİ DEĞİŞTİRMEZ (KITAP-4): editör yalnız
// "şablonda yeni bölümler var" der ve eklemeyi kullanıcı seçer. Belge
// kullanıcınındır; bir güncelleme onun sildiği bölümü geri getiremez.
export const MANUAL_TEMPLATE_VERSION = 2;

export const MANUAL_TEMPLATE: TemplateSection[] = [
  // ————————————————————————————————————————————————— 1 Kullanıcı Notları
  {
    key: "notlar",
    title: "Kullanıcı Notları",
    children: [
      {
        key: "notlar.amac",
        title: "Dokümanın Amacı",
        blocks: [
          p("Bu kullanma talimatları:"),
          ul(
            "Bu makinenin kullanma prensiplerini ve bakım talimatlarını tanımlar,",
            "Güvenli ve verimli bir kullanım için önemli notlar içerir.",
            "Kullanım kılavuzunda tarif edilen yerler ve yönler operatörün vinç kullanma pozisyonuna göredir."
          ),
        ],
      },
      {
        key: "notlar.listeler",
        title: "Bu kılavuzda kullanılan listeler",
        blocks: [
          p(
            "Operatör tarafından sırasına sadık kalınarak uyulması gereken işlem listeleri numaralı olarak verilmiştir. Bu işlemlerin sonuçları ise okla belirtilmiştir. Örneğin:",
            "Talimatlar ve Sonuçları"
          ),
          ol(["Yapılacak işlem basamağı 1"], "Yapılacak işlemin beklenen sonucu"),
          p("Sıralamanın öneminin bulunmadığı maddeler aşağıdaki şekilde gösterilir:", "Listeler"),
          ul("Madde 1", "Madde 2"),
        ],
      },
      {
        key: "notlar.garanti",
        title: "Garantinin Kapsamı ve Hariç Tutmalar",
        blocks: [
          p(
            "Garanti, üreticinin teslim sözleşmesinde tanımlanan süre ve koşullarla sınırlıdır. Bu kılavuzdaki talimatlara uyulmaması garantiyi düşürür."
          ),
          p("Aşağıdaki durumlar garanti kapsamı DIŞINDADIR:"),
          ul(
            "Vincin kullanım amacı dışında ya da anma değerlerinin üzerinde çalıştırılması,",
            "Üreticinin yazılı onayı olmadan yapılan yapısal ya da elektriksel değişiklikler,",
            "Bakım çizelgesindeki işlemlerin yapılmaması ya da kayıt altına alınmaması,",
            "Orijinal olmayan ya da eşdeğerliği belgelenmemiş yedek parça kullanımı,",
            "Aşınma parçalarının olağan ömrünü tamamlaması (halat, balata, tekerlek bandajı, keçe)."
          ),
          not(
            "onemli",
            "Garanti kapsamındaki bir talep için bakım defterinin eksiksiz tutulmuş olması gerekir; kayıt yoksa bakımın yapıldığı gösterilemez."
          ),
        ],
      },
      {
        key: "notlar.gorseller",
        title: "Bu kılavuzda kullanılan uyarılar",
        blocks: [
          p(
            "Bu kılavuzdaki güvenlik noktaları bir piktogram ve bir uyarı kelimesiyle gösterilir. Uyarı kelimesi riskin BÜYÜKLÜĞÜNÜ, piktogram ise TÜRÜNÜ tanımlar. Basamaklar ISO 3864-2 ve ANSI Z535.4 ile uyumludur."
          ),
          resim("sinyalKelimeleri", "Uyarı düzeyleri, piktogramları ve anlamları", 78, true),
          not("tehlike", "Kaçınılmadığı takdirde ölüm ya da ağır yaralanmayla sonuçlanma ihtimali YÜKSEK olan bir durumu belirtir."),
          not("uyari", "Kaçınılmadığı takdirde ölüm ya da ağır yaralanmayla sonuçlanma ihtimali MEVCUT olan bir durumu belirtir."),
          not("dikkat", "Kaçınılmadığı takdirde küçük fiziksel yaralanmayla sonuçlanabilecek bir durumu belirtir."),
          not("onemli", "Özel bir fonksiyonun güvenli kullanımı için zorunlu adımları belirtir; uyulmaması makinede ya da çevresinde hasara yol açabilir."),
          not("not", "Kullanımı kolaylaştıran ek bilgiyi belirtir."),
        ],
      },
    ],
  },

  // ——————————————————————————————————— 2 Temel Güvenlik Notları ve Talimatları
  {
    key: "guvenlik",
    title: "Temel Güvenlik Notları ve Talimatları",
    children: [
      {
        key: "guvenlik.amac",
        title: "Kullanım Amacı",
        blocks: [
          // KAPASİTE VE KUMANDA BİÇİMİ VİNCE ÖZELDİR — şablonda yazmaz.
          bosluk(),
          p(
            "Vinç operatörü ve bakım personeli vinç kullanımı ve bakımı konusunda eğitimli olmalıdır."
          ),
          p(
            "Bu vinç, sadece vinç kullanımı konusunda bilgili ve vinçlerin kullanımından doğabilecek tehlikelerin bilincinde olan kişilerin kullanabileceği bir konuma kurulmalıdır."
          ),
          p("Vinç kullanımını gerçekleştirecek kişi, herhangi bir engeli olmayan yetişkin bir kimse olmalıdır."),
          p(
            "Vinç operatörleri, vinç hareketlerinin kontrolünü rahatlıkla gerçekleştirebilen, derinlik algısı gelişmiş kişiler olmalıdır."
          ),
          p(
            "Vinç çalışma alanının yakınında bulunan kişiler, vinçlerin kullanımından doğabilecek tehlikelerin bilincinde ve farkında olmalıdır."
          ),
          p("Genel olarak; aşağıdaki özellikleri haiz olmayan kişiler vinç kullanmamalıdır:"),
          ul(
            "Vinç kullanma talimatlarını okuyup anlayabilmek için gerekli dili bilmeyenler",
            "Cihazı kullanabilmek için yasa çerçevesinde belirlenen yaş sınırının altında ya da üstünde olanlar",
            "Görme ve duyma kaybı yaşayanlar",
            "Vincin güvenli kullanımını etkileyebilecek kalp problemi vb. sağlık sorunları olanlar",
            "Vinç üreticisinin sağladığı kullanma kılavuzunu okumamış olanlar",
            "Gerekli vinç kullanma eğitimini almamış olanlar",
            "Aldığı eğitimi pratiğe dökemeyen operatörler",
            "Kaldırma ekipmanları ve kuralları hakkında bilgisi olmayanlar"
          ),
          not(
            "onemli",
            "Bu makineyi sadece belirtilen kullanım amacıyla ve güvenlik kurallarını dikkate alarak kullanın! Ancak bu durumda makinenin güvenli kullanımı sağlanabilir!"
          ),
        ],
      },
      {
        key: "guvenlik.kotuyeKullanim",
        title: "Makul Öngörülebilir Kötüye Kullanım",
        blocks: [
          p("Bu vinç iskele olarak kullanmak için tasarlanmamıştır."),
          p("Bu vinç sıvı malzeme taşımak için tasarlanmamıştır."),
          p(
            "Bu vinç ve vincin uygulamaları insan çalışma alanı yukarısı veya çevresinde çalışacak şekilde tasarlanmamıştır. Emniyet için mesafe bırakılmalıdır."
          ),
          p(
            "Bu vinç insan taşımak için tasarlanmamıştır. Vincin çalışma esnasında sadece eğitimli servis personeli veya operatörü vincin üzerinde bulunabilir."
          ),
          p("Vinç, yük çekmek için tasarlanmamıştır."),
          p(
            "Üçüncü parti üreticilerinin yedek parça ve aşınma parçalarının kullanılması risklere neden olabilir. Sadece orijinal parça veya üretici tarafından sağlanan parçaları kullanın.",
            "Yedek parça ve aşınma parçaları"
          ),
          p(
            "Üretici, orijinal olmayan veya kendi üretimi olmayan yedek veya aşınma parçalarından kaynaklanan hasarlar için mesuliyet kabul etmez."
          ),
        ],
      },
      {
        key: "guvenlik.riskler",
        title: "Makine ile ilgili riskler",
        blocks: [
          p("Vincin kullanılması aşağıda belirtilen maddelere karşı risk teşkil eder:"),
          ul("Operatörün veya üçüncü bir kişinin hayat veya uzuv kaybı", "Vincin kendisi", "Diğer ekipmanlar"),
          p("Bu talimatlarda verilen bilgiler, vinci güvenli şekilde kullanmak için temeldir."),
          not(
            "onemli",
            "Kullanma ve bakım kılavuzunu her zaman vinç yakınında operatör ve bakım personelinin rahatlıkla ulaşabileceği bir konumda bulundurun."
          ),
        ],
      },
      {
        key: "guvenlik.artikYuk",
        title: "Artık Yük Riski",
        blocks: [
          not(
            "uyari",
            "Statik enerjinin tamamen boşalması, motor sürücüsünün enerjisinin kesildiği andan itibaren belirli bir süre alır. Bu süre kullanılan sürücünün kataloğunda verilmiştir.",
            "MOTOR SÜRÜCÜLERİNDE KALAN ARTIK ENERJİ"
          ),
          not(
            "tehlike",
            "Kapatılan ya da acil durum halinde kullanımı durdurulan makinede meydana gelebilecek mekanik, pnömatik veya elektriksel artık enerji ile silindir ve valflerdeki basınç durumu hassasiyetle gözlenmelidir."
          ),
          p(
            "Üreticinin belirttiği koruyucu önlemlere ilaveten, operatör tarafından da takip edilmesi ve uygulanması gereken artık enerjiden koruyucu güvenlik önlemleri bulunmaktadır. Personelin eğitimi esnasında artık enerji kaynaklı riskler ve alınması gereken önlemler vurgulanmalıdır."
          ),
        ],
      },
      {
        key: "guvenlik.operatorSorumluluk",
        title: "Operatörün sorumlulukları",
        blocks: [
          p("Vinç operatörü sadece aşağıdaki özellikleri haiz olan kişilerin cihazı kullanmasını takip etmekle yükümlüdür:"),
          ul(
            "Kaza önleme güvenliği ve iş güvenliği kurallarını bilen ve uygulayan,",
            "Gerekli eğitimi almış,",
            "Kullanım talimatlarını okumuş ve anlamış kişiler."
          ),
          p("EU directive 2007/30/EC ekipman kullanımı gereklilikleri sağlanmalıdır."),
        ],
      },
      {
        key: "guvenlik.personelSorumluluk",
        title: "Personelin sorumlulukları",
        blocks: [
          p("Vinç kullanımında görevli tüm personel işe başlamadan önce aşağıdaki kuralları takip etmelidir:"),
          ul(
            "Kaza önleme ve iş güvenliği kurallarını öğrenmek ve uygulamak,",
            "Bu kullanma kılavuzundaki güvenlik bölümünü okumak ve uygulamak."
          ),
        ],
      },
      {
        key: "guvenlik.nitelikler",
        title: "Personel nitelikleri",
        blocks: [
          {
            kind: "table",
            head: [
              "Personel Görev",
              "Özel eğitimli personel",
              "Eğitimli işletme personeli",
              "Alanında uzman eğitimli personel (mekanik/elektronik)",
            ],
            rows: [
              ["Taşıma", "X", "--", "--"],
              ["Devreye Alma", "X", "--", "--"],
              ["Sorun çözme ve tamirat", "X", "--", "X"],
              ["Alet değişimi", "X", "--", "X"],
              ["Kullanım", "X", "X", "--"],
              ["Bakım", "X", "--", "X"],
              ["İmha / geri dönüşüm", "X", "--", "--"],
            ],
          },
          p("İşaretler:  X = İzin verilen    -- = İzin verilmeyen"),
        ],
      },
      {
        key: "guvenlik.kkd",
        title: "Kişisel güvenlik ekipmanları",
        blocks: [
          p("Operatör aşağıdaki güvenlik ekipmanlarından kullanım yerine göre gerekli olanları bulundurmalıdır:"),
          ul(
            "Baret",
            "Güvenlik gözlüğü",
            "Koruyucu eldiven",
            "Yangına dayanıklı eldiven",
            "Güvenlik ayakkabıları",
            "Yangına dayanıklı önlük",
            "Cilt koruyucu"
          ),
        ],
      },
      {
        key: "guvenlik.ekipmanlar",
        title: "Güvenlik ekipmanları",
        blocks: [
          not(
            "onemli",
            "Makineyi sadece tüm güvenlik cihazlarının ve koruyucu ekipmanların mevcut ve fonksiyonel durumda olduğundan emin olduktan sonra çalıştırın!"
          ),
          // ACİL STOP KONUMLARI, İKAZ IŞIKLARI VE SESLİ UYARILAR VİNCE ÖZELDİR.
          bosluk("Acil Stop Butonları"),
          bosluk("İkaz Işıkları ve Sesli Uyarılar"),
          p("Arızalı güvenlik ekipmanları tehlikeli sonuçlar doğurabilir.", "Arızalı Güvenlik Ekipmanları"),
          p("Acil stop cihazları belirli aralıklarla kontrol edilmelidir. Test aralıkları:"),
          {
            kind: "table",
            head: ["Güvenlik Ekipmanı", "Test aralığı"],
            rows: [["Acil stop", "Her gün"]],
          },
        ],
      },
      {
        key: "guvenlik.dusmeKorumasi",
        title: "Yüksekte Çalışma ve Düşme Koruması",
        blocks: [
          p(
            "Vinç üzerindeki her çalışma yüksekte çalışmadır. Köprü yürüyüş yolu, araba üstü, kabin çatısı ve elektrik odası çatısı; korkuluk bulunsa dahi düşme riski taşıyan alanlardır."
          ),
          ul(
            "Vince yalnız yetkili ve yüksekte çalışma eğitimi almış personel çıkar.",
            "Tam vücut emniyet kemeri ve çift kancalı lanyard kullanılır; kanca yalnız bu amaç için tasarlanmış ankraj noktasına takılır.",
            "Ankraj noktası her kullanımdan önce gözle kontrol edilir; korkuluk, boru ve kablo tavası ankraj noktası DEĞİLDİR.",
            "Yürüyüş yolları, merdivenler ve platformlar yağ, gres, su ve malzemeden arındırılmış tutulur.",
            "El aletleri ve parçalar bağlanmadan yukarı çıkarılmaz; düşen bir anahtar aşağıdaki kişi için ölümcüldür.",
            "Rüzgârlı havada, buzlanmada ve yetersiz aydınlatmada vinç üzerinde çalışılmaz."
          ),
          not(
            "tehlike",
            "Vince çıkmadan ÖNCE ana şalter kapatılır, kilitlenir ve etiketlenir; komşu vinçler de durdurulur ya da aralarına mekanik durdurucu konur. Çalışan bir komşu vinç, üzerinde bulunduğunuz köprüye çarpabilir."
          ),
        ],
      },
      {
        key: "guvenlik.yangin",
        title: "Yangın Güvenliği",
        blocks: [
          p(
            "Vinç üzerindeki yangın riski üç kaynaktan doğar: elektrik panolarındaki arıza, hidrolik ve yağlama sistemindeki sızıntı ve altında yapılan sıcak işlem (kaynak, kesme, taşlama)."
          ),
          ul(
            "Elektrik odasında ve kabinde kuru kimyevi tozlu ya da CO2'li yangın söndürücü bulundurulur; söndürücülerin periyodik kontrol etiketi geçerli olmalıdır.",
            "Panolarda yangın hâlinde ana şalter kapatılmadan müdahale edilmez.",
            "Vinç üzerinde ve altında yapılacak sıcak işlem için yazılı izin alınır; kıvılcım siperi kullanılır ve iş bitiminden sonra alan en az yarım saat gözlenir.",
            "Yağ, gres ve solvent vinç üzerinde depolanmaz (bkz. Uyarı İşaretleri).",
            "Kablo kanalları ve pano içleri toz ve yağdan arındırılmış tutulur."
          ),
        ],
      },
      {
        key: "guvenlik.kimlikPlakalari",
        title: "Kimlik Plakaları ve Etiketler",
        blocks: [
          p(
            "Vincin kimliği üzerindeki plakalarda yazılıdır. Bu plakalar SÖKÜLMEZ, boyanmaz ve okunmaz hâle geldiğinde üreticiden yenisi istenir. Yedek parça talebinde ve teknik destek görüşmesinde plakadaki bilgiler esas alınır."
          ),
          ul(
            "Vinç kimlik plakası: üretici, seri numarası, üretim yılı, kaldırma kapasitesi, sınıflandırma ve CE işareti.",
            "Kanca ve kanca bloğu plakası: taşıma kapasitesi ve kanca numarası.",
            "Motor etiketleri: güç, devir, gerilim, akım, koruma sınıfı ve çalışma rejimi.",
            "Redüktör etiketleri: tip, çevrim oranı ve yağ miktarı.",
            "Kapasite yazısı: köprü kirişinde uzaktan okunabilecek büyüklükte."
          ),
          not(
            "onemli",
            "Vinç üzerinde okunan kaldırma kapasitesi, o vincin AŞILAMAZ sınırıdır. Kapasitenin bir kısmını kullanan bir kaldırma aracı (traversa, mıknatıs, kepçe) varsa net kaldırılabilir yük o kadar azalır."
          ),
        ],
      },
      {
        key: "guvenlik.anaKesici",
        title: "Ana Kesici ve Enerji Kesme",
        blocks: [
          p(
            "Ana kesici vincin bütün enerjisini kesen tek anahtardır. Bakım, muayene ve arıza giderme işlemlerine başlamadan önce ana kesici kapatılır ve KİLİTLENİR."
          ),
          ol(
            [
              "Kancayı yüksüz bırakın ve arabayı bakım konumuna alın.",
              "Ana kesiciyi kapalı konuma getirin.",
              "Kesiciyi asma kilitle kilitleyin ve üzerine çalışan kişinin adını taşıyan uyarı etiketini asın.",
              "Gerilim yokluğunu ölçerek doğrulayın.",
            ],
            "Vinç enerjisiz ve kilitli durumdadır; çalışma başlayabilir."
          ),
          not(
            "tehlike",
            "Kilitlemeden yapılan bir bakım, başka birinin vinci farkında olmadan devreye almasıyla sonuçlanabilir. Kilidi yalnız onu takan kişi açar."
          ),
          not(
            "onemli",
            "Ana kesici kapalıyken bile pano girişinde ve akım alma baralarında gerilim bulunabilir. Bara üzerinde çalışma bara şalterinin de kesilmesini gerektirir."
          ),
          bosluk("Ana kesicinin yeri"),
        ],
      },
      {
        key: "guvenlik.acilStop",
        title: "Acil Stop",
        blocks: [
          p(
            "Acil stop butonu tehlike anında bütün hareketleri durdurur ve frenleri devreye sokar. Olağan durdurma için KULLANILMAZ; olağan durdurma kumanda organının sıfır konumuyla yapılır."
          ),
          ul(
            "Butona basıldığında bütün hareketler durur ve enerji kesilir.",
            "Buton kilitlenir; çevrilerek serbest bırakılana kadar vinç yeniden çalıştırılamaz.",
            "Serbest bırakmak vinci ÇALIŞTIRMAZ — devreye alma işlemi baştan yapılır."
          ),
          not(
            "uyari",
            "Acil stop bir güvenlik fonksiyonudur ve haftalık olarak DENENİR. Denenmemiş bir acil stop, olmayan bir güvenlik önlemidir."
          ),
          bosluk("Acil stop butonlarının sayısı ve yerleri"),
        ],
      },
      {
        key: "guvenlik.uyariIsaretleri",
        title: "Uyarı İşaretleri",
        blocks: [
          p(
            "Vinç üzerindeki tüm uyarı işaretlerini gözlemleyin ve talimatlara uyun. Ek olarak, vinç üzerinde aşağıdaki işaret bulunur:"
          ),
          resim("ceIsareti", "CE işareti", 26, false),
          not(
            "not",
            "CE işareti, bu ürünün kendisi için geçerli ve CE sembolü gerektiren AB direktifleriyle (2006/42/AT Makine Emniyeti Yönetmeliği dâhil) uyumlu olduğunu gösterir.",
            "CE İşareti"
          ),
          p(
            "Vinç üzerindeki uyarı etiketleri okunmaz hâle geldiğinde ya da kaybolduğunda GECİKMEDEN yenilenir. Silinmiş bir etiket, hiç olmayan bir etiketten daha tehlikelidir: yerinde bir şey olduğunu bilen kimse onu okumaya çalışmaz.",
            "Etiketlerin bakımı"
          ),
          not("onemli", "Gres, yağ, tiner vb. malzemelerin vinç üzerinde saklanması, depolanması yasaktır."),
        ],
      },
    ],
  },

  // ————————————————————————————————————————————————————— 3 Makine Tanımı
  {
    key: "tanim",
    title: "Makine Tanımı",
    blocks: [
      p(
        "Bu bölüm, vinç tasarımı ve fonksiyonları hakkında bilgiler içerir. Bu bölümün vinç üzerinde okunması tavsiye edilir. Böylece makinenin kullanımı hakkında daha kolay bilgi sahibi olunacaktır."
      ),
    ],
    children: [
      { key: "tanim.kullanimAlanlari", title: "Kullanım Alanları", blocks: [bosluk()] },
      {
        key: "tanim.anaParcalar",
        title: "Vincin Ana Parçaları",
        blocks: [
          p(
            "Bu bölüm vincin ana gruplarını tanıtır. Kılavuzun geri kalanında geçen parça adları burada tanımlananlarla aynıdır."
          ),
          // ANA GRUP LİSTESİ EKİPMAN LİSTESİNDEN TÜRETİLİR (`autofill.ts`):
          // ikinci bir "ana parçalar" listesi tutmak ikisinin ayrışması demekti.
          bosluk(),
        ],
      },
      {
        key: "tanim.calismaPrensibi",
        title: "Vinç Nasıl Çalışır",
        blocks: [
          p(
            "Vinç üç temel hareketi birleştirerek yükü çalışma alanı içinde istenen noktaya taşır:"
          ),
          ul(
            "KALDIRMA — motor, redüktör ve tambur üzerinden çelik halatı sarar; yük kanca bloğuyla düşey olarak hareket eder.",
            "ARABA YÜRÜTME — kanca bloğunu taşıyan araba, ana kirişler üzerindeki ray boyunca yatay hareket eder.",
            "KÖPRÜ YÜRÜTME — bütün köprü, kren yolu rayları üzerinde bina eksenine göre hareket eder."
          ),
          p(
            "Her hareketin kendi motoru, redüktörü ve freni vardır. Frenler yay ile kapanır ve elektrik ile açılır: enerji kesildiğinde fren KENDİLİĞİNDEN kapanır ve yük tutulur."
          ),
          not(
            "not",
            "Hareketlerin sınırları limit şalterleriyle korunur. Limit şalteri bir işletme sınırıdır, bir durdurma yöntemi değildir; her seferinde limite dayanarak çalışmak donanımı yorar."
          ),
        ],
      },
      { key: "tanim.guvenliErisim", title: "Vince Güvenli Erişim", blocks: [bosluk()] },
      {
        key: "tanim.teknik",
        title: "Teknik Bilgiler",
        children: [
          {
            key: "tanim.teknik.siniflandirma",
            title: "Sınıflandırma",
            blocks: [oto("siniflandirma", "Hesap raporu bağlanmadığı için sınıflandırma tablosu boş.")],
          },
          {
            key: "tanim.teknik.karakteristik",
            title: "Karakteristik Özellikler",
            blocks: [oto("karakteristik")],
          },
          { key: "tanim.teknik.hiz", title: "Hızlar", blocks: [oto("hiz")] },
          {
            // `teknikResim` otomatik kaynağı kodda ve sunucu adaptöründe
            // vardı ama onu basan HİÇBİR BÖLÜM YOKTU (30.08.2026). Resim
            // listesi belgenin hangi paftalara dayandığını söyler ve
            // müşterinin arşivinde aradığını bulmasını sağlar.
            key: "tanim.teknik.resimler",
            title: "Teknik Resim Listesi",
            blocks: [
              oto("teknikResim", "Teknik Resim Takibi defteri boş; resim listesi basılmadı."),
            ],
          },
        ],
      },
    ],
  },

  // ————————————————————————————————————————————————————————— 4 Kullanım
  {
    key: "kullanim",
    title: "Kullanım",
    children: [
      { key: "kullanim.genel", title: "Genel", blocks: [bosluk()] },
      { key: "kullanim.kabin", title: "Operatör Kabini", blocks: [bosluk()] },
      { key: "kullanim.anaKesici", title: "Ana Kesiciyi Açmak", blocks: [bosluk()] },
      { key: "kullanim.devreyeAlmak", title: "Vinci Devreye Almak", blocks: [bosluk()] },
      {
        key: "kullanim.hareketler",
        title: "Vinç Hareketleri",
        blocks: [
          p(
            "Hareketler kumanda organının yönüne ve kademesine göre verilir. Her hareket, kumanda bırakıldığında kendiliğinden durur."
          ),
        ],
        children: [
          {
            key: "kullanim.hareketler.yurutme",
            title: "Yürütme Hareketleri",
            blocks: [
              p(
                "Köprü ve araba yürütmesi frekans dönüştürücü ile hızlandırılır ve yavaşlatılır. Ani yön değiştirmek yükü savurur ve yapıyı yorar."
              ),
              ol(
                [
                  "Hareket yönünde engel olmadığını gözle doğrulayın.",
                  "Kumanda organını yavaşça istenen yöne alın.",
                  "Hedefe yaklaşırken kademeyi düşürün ve organı sıfıra getirin.",
                ],
                "Hareket kontrollü biçimde durur ve yük salınımı sönümlenir."
              ),
              not(
                "dikkat",
                "Yürütme sırasında yükün altında ya da hareket yolunda kimsenin bulunmadığından emin olun; gerekiyorsa sesli uyarı verin."
              ),
            ],
          },
          {
            key: "kullanim.hareketler.limitler",
            title: "Hareket Limitleri",
            blocks: [
              p(
                "Her hareketin çalışma alanı limit şalterleriyle sınırlanmıştır. Limitler İŞLETME SINIRIDIR; tampona dayanmak bir durdurma yöntemi değildir."
              ),
              // Hangi limitin nerede olduğu VİNCE ÖZELDİR ve elektrik
              // projesinden okunur; şablon bir sayı vermez.
              bosluk("Limitlerin yeri ve etkisi"),
              not(
                "uyari",
                "Bir limit şalteri devre dışı bırakılmışsa vinç ÇALIŞTIRILMAZ. Arızalı limit, aşırı kaldırma ve tampona çarpma demektir."
              ),
            ],
          },
          {
            key: "kullanim.hareketler.kombinasyon",
            title: "Hareket Kombinasyonları",
            blocks: [
              p(
                "Kaldırma ile yürütme aynı anda verilebilir; ancak yükü kaldırırken yürütmeye başlamak salınımı büyütür."
              ),
              ul(
                "Yükü önce kancanın düşeyine alın, sonra kaldırın.",
                "Kaldırma tamamlanmadan yürütmeye başlamayın.",
                "İki kaldırma grubuyla ortak yük taşınıyorsa hızlar eşitlenmeden yürütme verilmez."
              ),
              not(
                "uyari",
                "Yükü yatay çekmek (sürükleme) için yürütme hareketi KULLANILMAZ; halat eğik çeker, tambur yivinden çıkabilir ve yapı hesaplanmamış bir yanal kuvvet görür."
              ),
            ],
          },
          {
            key: "kullanim.hareketler.firtinaKilidi",
            title: "Fırtına Kilidi ve Park Konumu",
            blocks: [
              p(
                "Açık sahada çalışan vinçlerde rüzgâr, vinci ray boyunca sürükleyebilir. Vardiya sonunda ve fırtına uyarısında vinç park konumuna alınır ve fırtına kilidi devreye sokulur."
              ),
              // Kilidin türü ve park noktası VİNCE ÖZELDİR: raylı kama,
              // pense tipi kilit ya da çapa olabilir.
              bosluk("Fırtına kilidinin türü ve park konumu"),
              not(
                "dikkat",
                "Fırtına kilidi devredeyken yürütme hareketi verilmez; kilit ve tahrik birbirine zarar verir."
              ),
            ],
          },
        ],
      },
      { key: "kullanim.limitSivicler", title: "Limit Siviçler", blocks: [bosluk()] },
      {
        key: "kullanim.kumandaCihazlari",
        title: "Kumanda Cihazları ve Yerleri",
        blocks: [
          p(
            "Vinç, donanımına göre kabinden, radyo kumandadan ya da askı kumandadan (pendant) kullanılır. Aynı anda YALNIZ BİR kumanda etkindir; seçim devre kilitlemesiyle korunur."
          ),
        ],
        children: [
          {
            key: "kullanim.kumandaCihazlari.radyo",
            title: "Radyo Kumanda",
            blocks: [
              p(
                "Radyo kumanda operatörün yükü yakından görebileceği bir konumdan çalışmasına izin verir."
              ),
              ul(
                "Kullanmadan önce pil durumunu ve acil stop butonunu denetleyin.",
                "Vericiyi başkasının erişemeyeceği biçimde taşıyın; başıboş bırakmayın.",
                "Vardiya sonunda vericiyi kapatın ve kilitli dolaba koyun."
              ),
              not(
                "uyari",
                "Radyo bağlantısı kesildiğinde vinç kendiliğinden durur. Bağlantı kesintisi tekrarlıyorsa vinç kullanılmaz ve arıza bildirilir."
              ),
              bosluk("Verici tipi ve kanal bilgisi"),
            ],
          },
          {
            key: "kullanim.kumandaCihazlari.pendant",
            title: "Askı Kumanda (Pendant)",
            blocks: [
              p(
                "Askı kumanda taşıyıcı halatıyla asılır; kablo taşıyıcıyı çekmek için KULLANILMAZ."
              ),
              ul(
                "Butonların üzerindeki yön işaretlerinin okunur olduğunu denetleyin.",
                "Kumandayı yürütme hareketiyle sürüklemeyin; operatör vinçle birlikte yürür.",
                "Kablo ve askı halatını ezilme ve kopmaya karşı gözle kontrol edin."
              ),
            ],
          },
          {
            key: "kullanim.kumandaCihazlari.hareketKumandalari",
            title: "Hareket Kumandaları",
            blocks: [
              p(
                "Her kumanda organı bir hareketi ve bir yönü verir. Kademe sayısı ve hız kademeleri vince özeldir."
              ),
              // Hangi kolun hangi ekseni verdiği KABİN KONSOLUNA bağlıdır ve
              // fotoğrafla birlikte doldurulur.
              bosluk("Kumanda organlarının dökümü"),
              not(
                "onemli",
                "Kumanda organının yönü OPERATÖRÜN KULLANMA POZİSYONUNA göredir. Kabin ters yöne bakıyorsa yönler değişmez; operatör buna göre alışmalıdır."
              ),
            ],
          },
          {
            key: "kullanim.kumandaCihazlari.islevselKontrol",
            title: "Acil Stop Basılıyken İşlevsel Kontroller",
            blocks: [
              p(
                "Vardiya başında, vinci hareket ettirmeden önce yapılan denetim. Acil stop BASILI tutulur; böylece hiçbir hareket verilemez."
              ),
              ol(
                [
                  "Ana kesiciyi açın ve acil stop butonunu basılı bırakın.",
                  "Kabin/kumanda aydınlatmasının ve gösterge lambalarının yandığını doğrulayın.",
                  "Uyarı kornasını deneyin.",
                  "Arıza ihbar ekranında bekleyen bir hata olup olmadığını okuyun.",
                  "Acil stop butonunu serbest bırakın ve devreye alma işlemini yapın.",
                ],
                "Vinç hareketsizken bütün gösterge ve uyarı düzenekleri denetlenmiş olur."
              ),
            ],
          },
        ],
      },
      { key: "kullanim.frenler", title: "Frenler", blocks: [bosluk()] },
      {
        key: "kullanim.gucKumanda",
        title: "Güç ve Kumanda Sistemi, Şematik Diyagram",
        blocks: [
          bosluk(),
          oto("elektrikSayfa", "Elektrik projesi yüklenmediği için sayfa dizini boş."),
        ],
      },
      { key: "kullanim.motorIzleme", title: "Motorların İzlenmesi, Durdurma (Stop) Fonksiyonu", blocks: [bosluk()] },
      { key: "kullanim.arizaIhbar", title: "Arıza İhbar", blocks: [bosluk()] },
      {
        key: "kullanim.gunlukKontrol",
        title: "Kullanım Öncesi Günlük Kontrol",
        blocks: [
          p(
            "Her vardiyanın başında, vinç yüklenmeden önce aşağıdaki kontroller yapılır. Kontrolde bir eksiklik bulunursa vinç ÇALIŞTIRILMAZ ve durum bakım sorumlusuna bildirilir."
          ),
          {
            kind: "table",
            head: ["Kontrol", "Nasıl", "Ölçüt"],
            rows: [
              ["Acil stop", "Butona basılır, vinç devreden çıkar", "Bütün hareketler durmalı"],
              ["Frenler", "Yüksüz kaldırma ve indirme, kumanda bırakılır", "Yük tutulmalı, kayma olmamalı"],
              ["Limit siviçleri", "Yavaş hızda üst ve alt limite yaklaşılır", "Hareket limitte durmalı"],
              ["Korna ve ikaz lambaları", "Pedal ve lamba test butonu", "Sesli ve görsel ikaz çalışmalı"],
              ["Kanca ve kanca bloğu", "Gözle", "Çatlak, deformasyon, emniyet mandalı"],
              ["Çelik halat", "Gözle, tambur ve makara çevresinde", "Kopuk tel, ezilme, düğümlenme yok"],
              ["Kumanda", "Her eksen kısa hareket", "Kumanda yönü hareket yönüyle aynı"],
              ["Çalışma alanı", "Gözle", "Yol açık, altta personel yok"],
            ],
            caption: "Kontrol sonuçları vardiya defterine işlenir.",
          },
          not(
            "uyari",
            "Fren, limit sivici ya da acil stop arızalı bir vinç kullanılmaz. Bu üç sistemin herhangi biri, tek başına yükün düşmesini önleyen son emniyettir."
          ),
        ],
      },
      {
        key: "kullanim.yukKurallari",
        title: "Yük Kaldırma Kuralları",
        blocks: [
          p(
            "Aşağıdaki kurallar vincin tipinden ve kapasitesinden bağımsız olarak her kaldırmada geçerlidir."
          ),
          ul(
            "Yük kaldırılmadan önce kancanın yükün AĞIRLIK MERKEZİNİN tam üzerinde olması sağlanır.",
            "Kaldırma başlangıcında yük yerden birkaç santim kaldırılıp beklenir; bağlantı, denge ve fren bu anda kontrol edilir.",
            "Yük yerden kesildikten sonra yalnız engellerin üzerinden geçecek yüksekliğe çıkarılır; gereksiz yükseklik savrulmayı büyütür.",
            "Yük insanların üzerinden GEÇİRİLMEZ; geçmesi zorunlu bir güzergâh varsa alan boşaltılır.",
            "Yük altında ve yük yolunda kimse durmaz; operatör yükü göremiyorsa sinyalci ile çalışılır.",
            "Yük askıda bırakılıp operatör kumandadan ayrılmaz.",
            "Kaldırma esnasında ani kalkış ve ani duruş yapılmaz."
          ),
          not("tehlike", "Aşağıdaki kullanımlar KESİNLİKLE YASAKTIR ve vincin devrilmesine, halatın kopmasına ya da yapının kalıcı hasarına yol açar:"),
          ul(
            "YAN ÇEKME: halat düşey değilken kaldırma. Halat düşey olmadan hiçbir yük kaldırılmaz.",
            "SÜRÜKLEME: yükü yatay olarak çekmek ya da yerdeki bir yükü vinçle sürüklemek.",
            "SÖKME ve KURTARMA: sıkışmış, donmuş ya da bağlı bir yükü vinçle koparmaya çalışmak.",
            "İNSAN TAŞIMA: kancaya, yüke ya da kaldırma aracına binmek.",
            "KAPASİTE AŞIMI: aşırı yük sistemini devre dışı bırakarak ya da deneyerek kaldırmak.",
            "ÇARPMA: yükü ya da kanca bloğunu yapıya, tampona veya başka bir vince çarptırmak."
          ),
        ],
      },
      {
        key: "kullanim.savrulma",
        title: "Yük Savrulmasının Önlenmesi",
        blocks: [
          p(
            "Askıdaki yük bir sarkaçtır: yürütme başlarken yük geride kalır, dururken öne savrulur. Savrulan yük hem çevresindekiler için tehlikedir hem de köprüye ve arabaya öngörülmemiş yatay kuvvet bindirir."
          ),
          ul(
            "Hızlanma ve yavaşlama KADEMELİ yapılır; kumanda kolu bir uçtan ötekine ani hareket ettirilmez.",
            "Yürütme sırasında kaldırma hareketi ile yürütme aynı anda ani biçimde değiştirilmez.",
            "Savrulma başladıysa kumandayla söndürülür: yük öne savrulurken kısa süre aynı yönde hareket verilir.",
            "Yük mümkün olan en alçak güvenli yükseklikte taşınır; halat boyu arttıkça sarkaç periyodu uzar ve genlik büyür.",
            "Yükün elle tutulup yönlendirilmesi gerekiyorsa halat ya da kılavuz ip kullanılır, yüke elle temas edilmez."
          ),
          not(
            "not",
            "Vinçte savrulma önleme (anti-sway) sistemi varsa devre dışı bırakılmaz. Sistem savrulmayı azaltır, ORTADAN KALDIRMAZ; yukarıdaki kurallar yine de geçerlidir."
          ),
        ],
      },
      {
        key: "kullanim.haberlesme",
        title: "El İşaretleri ve Haberleşme",
        blocks: [
          p(
            "Operatörün yükü ya da hedef noktayı göremediği her durumda bir SİNYALCİ görevlendirilir. Sinyalci bir kişidir ve operatör yalnız onun işaretlerini uygular; işaretin anlaşılmadığı ya da sinyalcinin gözden kaybolduğu anda hareket DURDURULUR."
          ),
          ul(
            "Sinyalci ayırt edici bir yelek giyer ve operatörün onu sürekli görebileceği bir yerde durur.",
            "Sinyalci yükün altında ve yük yolunda durmaz.",
            "Telsizle çalışılıyorsa kanal yalnız bu iş için kullanılır; her komut tekrarlanarak teyit edilir.",
            "\u201CDUR\u201D işaretini KİM VERİRSE VERSİN operatör derhal uygular; bu tek istisnadır."
          ),
          {
            kind: "table",
            head: ["İşaret", "Anlamı"],
            rows: [
              ["Kol yukarı, işaret parmağı yukarı, elle küçük daire", "Kaldır"],
              ["Kol aşağı, işaret parmağı aşağı, elle küçük daire", "İndir"],
              ["Kol yatay, avuç aşağı, el sabit", "Dur"],
              ["İki kol yatay, avuçlar aşağı, iki el sabit", "Acil dur"],
              ["Kol yatay ileri, avuç ileri, el ileri geri", "Yürüt (gösterilen yöne)"],
              ["Bir el yukarı, avuç ileri; öteki el yavaş hareket", "Yavaş hareket ettir"],
              ["İki el karın hizasında birleştirilir", "Operasyon bitti"],
            ],
            caption:
              "İşaretler ISO 16715 esas alınarak verilmiştir. Sahada başka bir işaret kümesi kullanılıyorsa operatör ve sinyalci vardiya öncesi mutabık kalır.",
          },
        ],
      },
      {
        key: "kullanim.kullanimSonrasi",
        title: "Kullanım Sonrası Güvenli Bırakma",
        blocks: [
          p("Vardiya sonunda ya da vinç uzun süre kullanılmayacaksa aşağıdaki adımlar uygulanır."),
          ol(
            [
              "Yük indirilir; kancada yük bırakılmaz.",
              "Kanca bloğu, geçiş yollarını ve altındaki çalışma alanını engellemeyecek bir yüksekliğe kaldırılır.",
              "Araba ve köprü, üzerinde çalışma yapılmayan park konumuna alınır.",
              "Kumanda sıfır konumuna getirilir ve vinç devre dışı bırakılır.",
              "Kabinden çıkılır, kapı kapatılır ve ana şalter kapatılır.",
            ],
            "Vinç güvenli park konumundadır ve enerjisiz kalmıştır."
          ),
          not(
            "onemli",
            "Açık havada çalışan vinçlerde vardiya sonunda RAY KISKACI (fırtına kilidi) devreye alınır. Fırtına kilidi devrede değilken bırakılan bir vinç, rüzgârla yürüyüp yol sonundaki tampona çarpabilir."
          ),
        ],
      },
      {
        key: "kullanim.emniyetTedbirleri",
        title: "Emniyet Tedbirleri",
        children: [
          {
            key: "kullanim.emniyetTedbirleri.gereksinimler",
            title: "Emniyet Gereksinimleri",
            blocks: [
              p(
                "Vinçlerin bakım sorumluluğu verilen nitelikli kişi veya kişiler kullanma bakım kılavuzundaki, ekipman kataloglarındaki ve ekipman üzerindeki uyarı bilgilerine uymalı ve aşağıdaki aktivitelere katılmış olmalıdır:"
              ),
              ul(
                "Emniyet standartlarına bağlı olarak ekipmanları aktif-deaktif etmek ve topraklamasını yapmak için gerekli eğitimi almış olmak,",
                "Emniyet standartları gereğince emniyet ekipmanlarını kullanabilmek için eğitim ve öğretim,",
                "İlk yardım eğitimi."
              ),
              p(
                "Kullanma talimatları ekipmanların detaylı bütün bilgilerini içermemekte, mümkün olabilecek bütün operasyon koşullarını ve bakım şartlarını tanımlamamaktadır. Operasyon talimatlarında gerekli detay bilginin bulunmadığı olağan dışı veya sıra dışı problemlerle karşılaşılması durumunda gerekli yardımın alınması için üretici firmanın ilgili ekibi ile temasa geçin."
              ),
              p(
                "Vincin hareket grupları enerjilendirilmeden emniyet uyarılarının uygun fonksiyonları kontrol edilmelidir. En azından aşağıdaki ekipmanların kontrolleri yapılmalıdır:",
                "Fonksiyonel Testler"
              ),
              ul(
                "Limit siviçler,",
                "Fren fonksiyonları,",
                "Acil durdurma,",
                "Alarm sinyal ekipmanları (acil stop butonuna basılı iken lamba test butonuna basarak sinyal lambalarının sağlam olup olmadığı kontrol edilmelidir)."
              ),
            ],
          },
        ],
      },
      {
        key: "kullanim.emniyetBakimSistemleri",
        title: "Vinç Emniyet ve Bakım Sistemleri",
        children: [
          { key: "kullanim.emniyetBakimSistemleri.tamburFreni", title: "Tambur Emniyet Freni", blocks: [bosluk()] },
          { key: "kullanim.emniyetBakimSistemleri.sensorIptal", title: "Sensörlerin Geçici İptal Edilmesi", blocks: [bosluk()] },
          { key: "kullanim.emniyetBakimSistemleri.sicaklik", title: "Sıcaklık İzleme Sistemi", blocks: [bosluk()] },
        ],
      },
      {
        key: "kullanim.halatKontrol",
        title: "Halatların Kontrolü",
        children: [
          {
            key: "kullanim.halatKontrol.kapsam",
            title: "Kapsam",
            blocks: [
              p(
                "Bu standart, hesaplamaları ve konstrüksiyonu DIN 15020 sayfa 1'de yer alan, servis halat sistemlerini kapsamaktadır."
              ),
            ],
          },
          {
            key: "kullanim.halatKontrol.amac",
            title: "Amaç",
            blocks: [
              p(
                "Bu standart, halat sistemlerindeki bakım ve onarım işlemlerinin düzgün yürütülmesi için gerekli bilgileri içerir. Amaç, kaldırma elemanlarının güvenli işleyişini ve halat sistemindeki elemanların (çelik halat, halat emniyeti, tamburlar, makaralar) servis ömürlerini korumaktır."
              ),
              p(
                "Çeşitli aşınmalara maruz kalan halatların ebadı, metal yorgunluğuna dayanacak şekilde ayarlanamaz. Kaldırma grubunun güvenli ve kazasız işleyişi, halat sisteminin bakım ve muayenesine verilen önemle doğru orantılıdır."
              ),
            ],
          },
          {
            key: "kullanim.halatKontrol.telHalat",
            title: "Tel Halat",
            children: [
              {
                key: "kullanim.halatKontrol.telHalat.kosullar",
                title: "Halat Donanımı Hazırlığı Öncesi Sağlanılması Gereken Koşullar",
                blocks: [
                  p(
                    "Halatlar paslı, hasarlı veya yoğun bir kir tabakasıyla kaplı olmamalıdır. Plastik kaplamalı veya muhafazalı halatlar kontrol edilemeyeceğinden kapsam dışıdır. DIN 15020 halat uzunluk toleransları göz önünde bulundurulmalıdır."
                  ),
                  p(
                    "Plastik kaplamalı halatların kullanımı bu tip uygulamalarda kazalara neden olacağından tavsiye edilmemektedir. Muayene standartlarına uymamasının yanı sıra, suyun halat içine sızıp buharlaşamaması sonucu halat paslanma tehlikesiyle karşı karşıyadır."
                  ),
                ],
              },
              {
                key: "kullanim.halatKontrol.telHalat.hazirlik",
                title: "Halat Donanımının Hazırlanışı",
                blocks: [
                  p(
                    "Halatları değiştirirken, yeni halatın eskisi ile aynı tip ve mukavemette olmasına dikkat edilmelidir. Halat sistemi, genellikle, eski donanıma sadık kalınarak yenilenir. Yeni halatın ankraj montajının eskisi gibi olması önemlidir. Şüpheli durumlarda, servis talimat, kural ve standartlarına başvurulmalıdır."
                  ),
                  p(
                    "Eğer gereken halat stoktaki malzemeden kesilmiş ise, halatın iki uçtan gevşemesini (uçları sarmak, kaynaklamak gibi önlemlerle) önlemek gereklidir."
                  ),
                  p(
                    "Tel halatın makaradan açılması ya da montajı esnasında burulmamasına özen gösterilmelidir. Aksi takdirde halatın yapısı bozulacak, dirsek ve düğümlenme olacaktır."
                  ),
                  p(
                    "Yeni halatın montajından önce halat çapının tambur yivi, makaralar ve denge makarasına uyup uymadığına dikkat edilmelidir."
                  ),
                  p(
                    "Çalıştırma işleminden önce halat donanımının, halatın tambur yivlerine ve makaralara yerleşiminin doğruluğu kontrol edilmelidir. Daha sonra halata hafif yükte (azami kapasitenin yüzde 10'u kadar) birkaç devir yaptırılmalıdır."
                  ),
                  p(
                    "Halat montajından sonra, halat sistemiyle bağlantılı çalışan bütün ekipmanların (denge kolu, limit şalterleri, aşırı yük koruma ekipmanları, güvenlik ekipmanları vb.) kontrolü yapılmalıdır."
                  ),
                  p("Halat soketinin bağlantısı aşağıda verilen şekilde yapılmalıdır:"),
                  resim("halatSoketi1", "Halat soketi bağlantısı", 78, false),
                  resim("halatSoketi2", "Halat soketi montaj adımı", 78, false),
                ],
              },
              {
                key: "kullanim.halatKontrol.telHalat.bakim",
                title: "Bakım",
                blocks: [
                  p(
                    "Tel halatlar, kaldırma elemanlarına, yapılan işe ve halatın tipine göre periyodik bakıma tabidir. Halat sistemlerinin bakımı DIN 15020'ye uygun olarak yapılmalıdır."
                  ),
                  p(
                    "Tel halatlar, çalışma koşullarına göre, özellikle de halatın burkulduğu yerlerden düzenli olarak yağlanmalıdır. Tel halatlarda kullanılan yağlar, diğerleri ile uyumlu olmalıdır. Sıvı yağ, halatın içine işleyebildiğinden gresten avantajlıdır."
                  ),
                  p("Yağlama aynı zamanda paslanma tehlikesini azaltıcı bir faktördür."),
                  p("Yoğun kirle kaplı tel halatın dış yüzeyi zaman zaman temizlenmelidir."),
                  p(
                    "Halatın yağlanması çalışma koşullarından ötürü mümkün olmuyor ise, halatın servis ömrünün belirtilenden kısa olacağı bilinmeli ve muayenesi ona göre yapılmalıdır."
                  ),
                ],
              },
              {
                key: "kullanim.halatKontrol.telHalat.muayene",
                title: "Muayene",
                blocks: [
                  p(
                    "Tel halat ve ankrajları, herhangi bir kusura karşı, günlük olarak gözle muayene edilmelidir. Tespit edilen herhangi bir kusur, sorumlu kişiye anında rapor edilmelidir."
                  ),
                  p(
                    "Halatların güvenli olup olmadığı, eğitimli ve uzman kişilerce düzenli aralıklarla muayene edilmelidir. Muayene aralıkları, arızanın zamanında tespiti için sabit tutulmalıdır. Yeni halatın montajını ve ilk kusurun gözlenmesini takip eden birkaç hafta için, muayene aralıkları normalinden daha kısa olmalıdır."
                  ),
                  p(
                    "Muayene sırasında, makaralardan, denge makarasından ve ankrajlardan geçen halat kesitine özellikle dikkat edilmelidir. Muayene sonuçları yazılı olarak kayıt altına alınmalıdır."
                  ),
                ],
              },
              {
                key: "kullanim.halatKontrol.telHalat.kriterler",
                title: "Muayene Kriterleri",
                blocks: [
                  p("Tel halatların güvenilirliği, aşağıdaki faktörlere göre belirlenir:"),
                  ul(
                    "a) Halattaki kırık tellerin tipi ve sayısı",
                    "b) Kırığın yeri",
                    "c) Kırıkların oluşma sıklığı",
                    "d) Halat çapının küçülmesi",
                    "e) Paslanma",
                    "f) Aşınma",
                    "g) Halat deformasyonu",
                    "h) Ortam sıcaklığının etkisi",
                    "i) Servis ömrü"
                  ),
                ],
              },
              {
                key: "kullanim.halatKontrol.telHalat.asinmaSinirlari",
                title: "Aşınma Sınırları",
                blocks: [
                  p(
                    "Kaldırma elemanlarının güvenli olarak çalışabilmesini sağlamak için, halatların zamanında yenilenmesi önemlidir. İlgili kıstaslar temel alınarak, halatın değiştirilmesini gerektiren aşınma limitleri aşağıda belirtilmiştir. Bu limitlerin üzerindeki kullanımlar hayati tehlike doğurabilir."
                  ),
                  p(
                    "Yapısal değişiklik sonucu halat çapı, nominal değerinin %10 ya da daha fazla altına inerse, halat hurdaya çıkarılmalıdır. Bu durum toleransları DIN 3055 ve DIN 3070 arasındaki standartlara uygun halatlar için geçerlidir.",
                    "Halat çapının küçülmesi"
                  ),
                  p(
                    "Paslanma genellikle halatların nemli ortamlarda ve uzun süre açıkta kullanılması sonucu ortaya çıkar. Halatların dış yüzeyindeki paslanmayı gözle görmek mümkündür, ancak iç paslanmayı tespit etmek oldukça zordur.",
                    "Paslanma"
                  ),
                  p(
                    "Halat çapı nominal değerinin %10 altına inerse, kopuk tel olup olmadığına bakılmaksızın halatı hurdaya çıkarmak gerekir."
                  ),
                  p(
                    "Renk değişikliği meydana gelecek şekilde aşırı ısıya maruz kalan halatlar hurdaya çıkarılmalıdır.",
                    "Isıya maruz kalma"
                  ),
                ],
              },
              {
                key: "kullanim.halatKontrol.telHalat.hasarGorunumleri",
                title: "Halat Hasar Görünümleri",
                blocks: [
                  p(
                    "Aşağıdaki şekiller, muayenede karşılaşılan tipik halat hasarlarını ve her birinde uygulanacak kararı gösterir. Şekiller DIN 15020 muayene kıstaslarına dayanır ve çelik halatlı her vinçte geçerlidir."
                  ),
                  resim("halatHasar1", "Halatın helis biçimi alması. \u201Cx\u201D biçiminde oluşan hasarın boyutu halat nominal çapının üçte biri kadar olduğunda halat DEĞİŞTİRİLİR.", 100, false),
                  resim("halatHasar2", "Dış tellerin iç tellere göre uzaması ya da gevşemesi. Bu hasar görülen halat HEMEN değiştirilir.", 100, false),
                  resim("halatHasar3", "Dış tellerin dolanarak düğüm olması. Bu hasar görülen halat değiştirilir.", 100, false),
                  resim("halatHasar4", "Dış tellerden birkaçının gevşemesi. Sebep paslanma ya da aşınma ise halat değiştirilir; değilse gevşek tel sayısı belirleyicidir.", 100, false),
                  resim("halatHasar5", "Tellerde çok kısa olmayan kalınlaşma bölgeleri. Problemin belirgin olduğu halatlar değiştirilir.", 100, false),
                  resim("halatHasar6", "Halat çapında bölgesel incelme. Önemli sayılabilecek incelmede halat değiştirilir.", 100, false),
                  resim("halatHasar7", "Halat üzerinden araç geçmesi vb. sonucu ezilme. Bu durumda halat değiştirilir.", 100, false),
                  resim("halatHasar8", "Halatta katlanma varken çekilmesi sonucu oluşan hasar. Bu hasarın görülmesi durumunda halat değiştirilir.", 100, false),
                  resim("halatHasar9", "Keskin büküm noktaları oluşmuş halat değiştirilir.", 100, false),
                  not(
                    "uyari",
                    "Yukarıdaki hasarlardan herhangi biri görülen halat, kalan tel kopması sayısına bakılmaksızın hizmet dışı bırakılır. Hasarlı bir halatla yapılan tek bir kaldırma, ölümle sonuçlanabilir."
                  ),
                ],
              },
            ],
          },
          {
            key: "kullanim.halatKontrol.tamburMakara",
            title: "Halat Tamburu, Makara ve Denge Makaraları",
            blocks: [
              p(
                "Halat tamburu, makara ve denge makaraları, en az 12 ayda bir ve her yeni halat montajından sonra belirtildiği şekilde kontrol edilmelidir. Bütün parçaların rulmanlarının kolay dönmesi sağlanmalıdır. Dönmeye mukavemet gösteren makaralarda aşınma olacak, buna bağlı olarak halatlar yıpranacak ve dengesiz yük dağılımı ortaya çıkacaktır."
              ),
              p(
                "Makaralardaki dönmeye karşı mukavemet problemi yağlama yapılarak çözülemiyor ise, makaraların tamiri ya da yenilenmesi gereklidir."
              ),
              p(
                "Ayrıca, nominal halat çapının yiv çapıyla uyumlu olup olmadığı da kontrol edilmelidir. Yiv çapı zamanla değişiklik gösterirse, tekrar işlenmeli ve eski ölçüsüne getirilmelidir. Yivlerde keskin köşelerin oluşması, halatta aşırı lokal stresler meydana getirecektir."
              ),
              p(
                "Kaynaklar, tamburlar ve makaralarda oluşacak yüzey çatlakları kontrol edilmelidir. Kaynaklarda yüzey çatlakları oluşmuş ise söz konusu parça tamir edilmeli veya değiştirilmelidir."
              ),
            ],
          },
        ],
      },
    ],
  },

  // ————————————————————————————————————————————— 5 Periyodik Muayene
  {
    key: "muayene",
    title: "Periyodik Muayene",
    blocks: [
      p(
        "Muayene, bakımdan AYRI bir iştir. Bakım vincin çalışır kalmasını sağlar; muayene ise vincin hâlâ GÜVENLİ olduğunu belgeler. İkisi farklı aralıklarla, farklı yetkinlikteki kişilerce yapılır ve muayene her defasında YAZILI olarak kaydedilir."
      ),
      not(
        "onemli",
        "Periyodik kontrol, ilgili iş ekipmanları mevzuatının ve ISO 9927-1'in gereğidir. Kaydı tutulmayan bir muayene, yapılmamış sayılır."
      ),
    ],
    children: [
      {
        key: "muayene.turleri",
        title: "Muayene Türleri ve Aralıkları",
        blocks: [
          {
            kind: "table",
            head: ["Muayene", "Ne zaman", "Kim"],
            rows: [
              ["Günlük gözle kontrol", "Her vardiya başında", "Operatör"],
              ["Sık aralıklı muayene", "Aylık", "Bakım teknisyeni"],
              ["Periyodik muayene", "Yılda en az bir kez", "Yetkili muayene personeli"],
              ["Özel muayene", "Aşırı yükleme, kaza ya da uzun duruş sonrası", "Yetkili muayene personeli"],
              ["Kabul muayenesi", "Devreye alma ve esaslı değişiklik sonrası", "Yetkili muayene personeli"],
            ],
            caption:
              "Ağır hizmet koşullarında (yüksek sıcaklık, tozlu ortam, sürekli çalışma) aralıklar KISALTILIR.",
          },
          p(
            "Vincin çalışma sınıfı ne kadar yüksekse muayene aralığı o kadar sık olmalıdır: sınıflandırması M8 olan bir vinç, aynı takvimle M4 bir vinçten çok daha fazla çevrim yapar.",
            "Sınıfa göre sıklık"
          ),
        ],
      },
      {
        key: "muayene.kapsam",
        title: "Muayene Kapsamı",
        blocks: [
          p("Periyodik muayenede en az aşağıdaki başlıklar incelenir ve sonuç kayda geçirilir:"),
          ul(
            "Çelik yapı: ana kiriş, başkiriş, araba şasisi ve bağlantıları; çatlak, kalıcı deformasyon, gevşemiş ya da eksik cıvata.",
            "Kaldırma grubu: tambur, makara, halat, kanca ve kanca bloğu.",
            "Frenler: balata kalınlığı, ayar, tutma kabiliyeti ve fren testi.",
            "Yürütme grupları: tekerlek, ray, tampon ve teker flanşı aşınması.",
            "Elektrik sistemi: koruma cihazları, topraklama, kablo ve akım alma sistemi.",
            "Emniyet sistemleri: limit siviçleri, aşırı yük sistemi, acil stop ve ikaz elemanları.",
            "Kaldırma araçları: traversa, sapan, mıknatıs ya da kepçe (varsa)."
          ),
        ],
      },
      {
        key: "muayene.kaynakliYapi",
        title: "Kaynaklı Yapının Muayenesi",
        blocks: [
          p(
            "Çelik yapıdaki hasar önce KAYNAKTA başlar. Gözle muayenede boya çatlağı, pas akıntısı ve boyada kabarma bir kaynak çatlağının ilk işareti olabilir; bu belirtilerin görüldüğü yerde boya sıyrılarak yüzey açılır."
          ),
          p(
            "Şüpheli bölgede penetrant ya da manyetik parçacık muayenesi uygulanır. Çatlak tespit edilirse vinç HİZMET DIŞI bırakılır ve onarım üretici onayıyla yapılır.",
            "Tahribatsız muayene"
          ),
          p("Ana kirişte en çok zorlanan ve öncelikle incelenmesi gereken bölgeler:"),
          ul(
            "Ana kiriş ile başkirişin birleşim bölgesi ve bu bölgedeki kaynaklar.",
            "Ray altı bölgesi ve ray bağlantı elemanları.",
            "Perde (diyafram) kaynakları, özellikle açıklık ortasına yakın olanlar.",
            "Üst ve alt başlık saclarının boyuna kaynakları.",
            "Kabin, platform ve makine sehpası askı bağlantıları.",
            "Tampon ve durdurucu bağlantı bölgeleri."
          ),
          not(
            "uyari",
            "Çelik yapıda tespit edilen bir çatlak KAYNAK YAPILARAK kapatılmaz. Çatlağın kökü temizlenmeden yapılan onarım, çatlağı görünmez kılar ama büyümesini durdurmaz."
          ),
        ],
      },
      {
        key: "muayene.kalanOmur",
        title: "Kalan Servis Ömrü",
        blocks: [
          p(
            "Vinç, tasarımında seçilen sınıflandırmaya karşılık gelen bir TEORİK ÇALIŞMA SÜRESİ için boyutlandırılmıştır. Bu süre çalışma saatiyle değil, kaldırılan yüklerin büyüklüğü ve sayısıyla tükenir: aynı saatte tam yükle çalışan bir vinç, yarı yükle çalışandan çok daha hızlı yaşlanır."
          ),
          ul(
            "Kalan ömrün takibi için çalışma saati sayacı ve — varsa — yük çevrim sayacı düzenli olarak okunur ve kaydedilir.",
            "Kayıt tutulmamışsa kalan ömür, kullanım koşulları üzerinden tahmin edilir; tahmin her zaman GÜVENLİ tarafta yapılır.",
            "Teorik çalışma süresinin sonuna yaklaşan vinçte genel bir revizyon (GO — genel bakım) gerekir.",
            "Revizyon yapılmadan çalışmaya devam edilmesi, taşıyıcı yapıda ve kaldırma grubunda yorulma kırığı riskini kabul etmek demektir."
          ),
          not(
            "onemli",
            "Kalan servis ömrü değerlendirmesi ISO 12482 ve FEM 9.755 esaslarına göre yapılır ve sonucu yazılı olarak kaydedilir. Değerlendirmeyi vincin sınıflandırmasını bilen bir mühendis yapar."
          ),
        ],
      },
      {
        key: "muayene.aciklikOlcumu",
        title: "Açıklık ve Köşegen Ölçümü",
        blocks: [
          p(
            "Köprünün açıklığı ve köşegenleri, tekerleklerin ray üzerinde düzgün yürümesini belirler. Açıklık sapması eğik aşınmaya, flanş yenmesine ve yürütme direncine yol açar."
          ),
          ol(
            [
              "Vinci düz ve temiz bir ray bölgesine alın, enerjiyi kesin.",
              "Ölçümü ray üst yüzeyi hizasında, tekerlek eksenlerinden yapın.",
              "Her iki başkirişte açıklığı ölçün ve köşegenleri karşılaştırın.",
              "Sonuçları önceki ölçümle birlikte muayene defterine yazın.",
            ],
            "Açıklık ve köşegen değerleri kayıt altına alınmış olur."
          ),
          not(
            "onemli",
            "Sapma sınırı vincin imalat toleransından gelir ve montaj raporunda yazılıdır. Sınır aşıldıysa vinç ayarlanmadan çalıştırılmaz."
          ),
          p(
            "Ölçüm sıcaklığı kaydedilir: çelik yapı ısı ile uzar ve yaz-kış ölçümleri doğrudan karşılaştırılamaz.",
            "Ölçüm sıcaklığı"
          ),
          bosluk("Bu vincin açıklık ve tolerans değerleri"),
        ],
      },
      {
        key: "muayene.kayit",
        title: "Muayene Defteri ve Belgeleme",
        blocks: [
          p(
            "Vince ait bir MUAYENE DEFTERİ tutulur ve vincin ömrü boyunca saklanır. Vinç el değiştirirse defter de birlikte devredilir."
          ),
          ul(
            "Her muayenenin tarihi, kapsamı, muayeneyi yapanın adı ve yetkisi.",
            "Tespit edilen eksiklikler ve bunların giderilme tarihi.",
            "Değiştirilen ana parçalar (halat, kanca, fren balatası, redüktör) ve değişim tarihi.",
            "Aşırı yükleme, çarpma ve kaza kayıtları.",
            "Esaslı değişiklikler ve bunlara ait onaylar.",
            "Çalışma saati / yük çevrimi okumaları."
          ),
          not(
            "not",
            "Eksikliği giderilen bir madde defterden SİLİNMEZ, karşısına giderilme tarihi yazılır. Defter vincin geçmişidir; geçmişin silinmesi kalan ömür değerlendirmesini imkânsız kılar."
          ),
        ],
      },
    ],
  },

  // —————————————————————————————————————————— 6 Bakım Güvenliği
  {
    key: "bakimGuvenlik",
    title: "Bakım Güvenliği",
    blocks: [
      p(
        "Vinçteki ölümlü kazaların önemli bir kısmı kullanım sırasında değil BAKIM sırasında olur: enerjisi kesilmemiş bir vinç, bakım yapan kişiyi habersiz yakalar."
      ),
    ],
    children: [
      {
        key: "bakimGuvenlik.oncesi",
        title: "Bakım Öncesi",
        blocks: [
          ol(
            [
              "Bakım yapılacağı, vinci kullanan bütün vardiyalara duyurulur.",
              "Yük indirilir, kanca bloğu güvenli konuma alınır.",
              "Vinç bakım konumuna götürülür; mümkünse yol sonundan uzak, altı boş bir bölgeye.",
              "Ana şalter kapatılır, KİLİTLENİR ve etiketlenir (kilitleme-etiketleme).",
              "Enerjinin gerçekten kesildiği ölçü aleti ile DOĞRULANIR.",
              "Sürücülerdeki artık enerjinin boşalması için katalogda verilen süre beklenir.",
              "Komşu vinçler durdurulur ya da araya mekanik durdurucu konur.",
              "Altta çalışma alanı varsa kapatılır ve işaretlenir.",
            ],
            "Vinç enerjisiz, hareketsiz ve başkasının devreye alamayacağı hâldedir."
          ),
          not(
            "tehlike",
            "KİLİDİ TAKAN KİŞİ AÇAR. Her bakım personeli kendi kilidini takar ve işi bitince kendi kilidini kaldırır. Başkasının kilidini açmak, o kişinin hâlâ vinç üzerinde olabileceğini yok saymaktır."
          ),
        ],
      },
      {
        key: "bakimGuvenlik.sirasinda",
        title: "Bakım Sırasında",
        blocks: [
          ul(
            "Sökülen parçalar düşmeyecek şekilde desteklenir; askıya alınan parça vinç kancasıyla tutulmaz.",
            "Yay yüklü elemanlar (fren yayları, tampon) boşaltılmadan sökülmez.",
            "Hidrolik sistemde basınç boşaltılmadan bağlantı açılmaz.",
            "Yalnız orijinal ya da üreticinin onayladığı yedek parça kullanılır.",
            "Sökülen emniyet elemanı (koruma sacı, korkuluk, kapak) iş biter bitmez yerine takılır.",
            "Ölçüm ya da ayar için enerji verilmesi gerekiyorsa bu bir İSTİSNADIR: alan boşaltılır, tek bir kişi kumandada durur ve iş bitince enerji yeniden kesilir."
          ),
        ],
      },
      {
        key: "bakimGuvenlik.sonrasi",
        title: "Bakım Sonrası",
        blocks: [
          ol(
            [
              "Alet, parça ve malzeme vinç üzerinden toplanır.",
              "Sökülen bütün koruyucular ve emniyet elemanları takılmış mı, kontrol edilir.",
              "Kilitler kaldırılır ve enerji verilir.",
              "Yüksüz fonksiyon testi yapılır: acil stop, limit siviçleri, frenler, ikaz elemanları.",
              "Fren ayarı değiştiyse yükle fren testi yapılır.",
              "Yapılan iş ve değiştirilen parçalar muayene defterine işlenir.",
            ],
            "Vinç kullanıma hazırdır ve yapılan iş kayda geçmiştir."
          ),
        ],
      },
      {
        key: "bakimGuvenlik.civata",
        title: "Cıvatalı Birleşimler ve Sıkma Momentleri",
        blocks: [
          p(
            "Ana kiriş–başkiriş birleşimi, yürütme grubu bağlantıları ve ray bağlantı elemanları ÖN GERİLMELİ cıvatalarla yapılır. Bu birleşimlerde yükü sürtünme taşır; cıvatanın kendisi kesmeye çalışmaz."
          ),
          ul(
            "Temas yüzeyleri boya, yağ, pas ve çapaktan arındırılmış olmalıdır.",
            "Sıkma, birleşimin ortasından kenarlara doğru ve birkaç kademede yapılır.",
            "Sıkma momenti KALİBRELİ bir tork anahtarıyla verilir ve kayda geçirilir.",
            "İlk çalıştırmadan sonra ve ilk periyodik muayenede momentler tekrar denetlenir."
          ),
          tablo(
            ["Birleşim", "Cıvata Sınıfı / Ölçü", "Sıkma Momenti", "Denetim Aralığı"],
            [],
            "Değerler üreticinin montaj raporundan ve cıvata üreticisinin kataloğundan alınır."
          ),
          not(
            "uyari",
            "Gevşemiş ya da yenilenmiş bir ön gerilmeli cıvata TEKRAR KULLANILMAZ. Bir kez ön gerilme almış cıvata plastik şekil değiştirmiş olabilir; yerine yenisi takılır."
          ),
          not(
            "onemli",
            "Sıkma momenti tablosu boş bırakıldıysa birleşim denetlenemez. Değerleri montaj raporundan alıp doldurun."
          ),
        ],
      },
      {
        key: "bakimGuvenlik.degisiklik",
        title: "Vinçte Değişiklik Yapılması",
        blocks: [
          not(
            "uyari",
            "Vincin taşıyıcı yapısında, kaldırma grubunda, emniyet sistemlerinde ya da kumanda yazılımında ÜRETİCİNİN YAZILI ONAYI OLMADAN değişiklik yapılamaz. Onaysız her değişiklik, uygunluk beyanını ve üreticinin sorumluluğunu geçersiz kılar."
          ),
          ul(
            "Kapasite artırımı, açıklık değişimi ve kiriş üzerinde delik açma esaslı değişikliktir.",
            "Emniyet sisteminin (aşırı yük, limit, acil stop) devre dışı bırakılması ya da köprülenmesi değişikliktir.",
            "Esaslı değişiklik sonrası KABUL MUAYENESİ yapılır ve belgelenir.",
            "Değişiklik, kılavuzun ilgili bölümlerine ve muayene defterine işlenir."
          ),
        ],
      },
    ],
  },

  // ——————————————————————————————————————————————————— 5 Bakım Takvimi
  {
    key: "bakim",
    title: "Bakım Takvimi",
    blocks: [
      not("onemli", "Bakım görevlerini aşağıdaki tabloda belirtilen aralıklarla gerçekleştirin."),
      p("Açıklamalar:"),
      {
        kind: "table",
        head: ["İnsan Gücü", "Zaman Dilimi", "Çalışma Durumu"],
        rows: [
          ["F = Montajcı", "d = Günlük", "R = Vincin akımı ana şalterde kesikken"],
          ["E = Elektrikçi", "w = Haftalık", "AR = Akım alma baraları ve vincin akımı, vinç ana şalteri ve bara şalterinden kesikken"],
          ["MA = Bakım Teknisyeni", "2w = İki haftada bir", "LR = Vinç çalışır durumdayken"],
          ["I = Denetmen", "m = Aylık", ""],
          ["", "2m = İki ayda bir", ""],
          ["", "y = Yılda bir", ""],
          ["", "2y = İki yılda bir", ""],
        ],
      },
      // BAKIM ÇİZELGESİNİN KENDİSİ VİNCE ÖZELDİR: kaynak belgede 235 satır ve
      // her satır o vincin grubuna bağlı. Şablon boş bir çizelge doğurur;
      // mühendis kendi satırlarını yazar ya da bir önceki kılavuzdan kopyalar.
      {
        kind: "table",
        head: ["No.", "Parça", "Görev", "Kişi", "Sıklık", "Çalışma Durumu"],
        rows: [],
      },
    ],
  },

  // ——————————————————————————————————————————————————————— 6 Yağlama
  {
    key: "yaglama",
    title: "Yağlama",
    blocks: [
      p(
        "Mekanik parçaların yağlanması, birbirleri ile uyumlu çalışmaları ve vincin ömrünün uzaması açısından önemlidir."
      ),
      p("Yağlama gerektiği gibi yapılmalı ve aşağıda açıklanan noktalara uyulmalıdır:"),
      ul(
        "Vincin her gün çalışmasından sonra yağ ve elemanlar kontrol edilmeli, eğer yağ yetersiz ise hemen eklenmelidir.",
        "Gres yağlama noktaları, iyi bir yağlamanın yapılabilmesi için yağlanmadan önce iyice temizlenmelidir.",
        "Eski yağ veya kirler, ince yağ gibi temizleyicilerle iyice yıkandıktan sonra, yeni yağ dişli çarkların dişlerine uygulanmalıdır.",
        "Kayar ve döner parçalar, her hafta temizlenmeli ve uygun şekilde yağlanmalıdır.",
        "Ara sıra rulman yuvaları açılmalı, temizlenip yeniden yağlanmalıdır. Rulman yuvasını yağlamak için gerekli olan yağ miktarı, yuva hacminin yaklaşık 1/4'ü ile 1/2'si kadardır.",
        "Yağın değiştirilmesinden önceki temizlik, ekipmanların ömrü açısından çok önemlidir.",
        "Fren kasnağı ve balataların yağlanmamasına dikkat edilmelidir.",
        "Yağların ilk değişimleri normalden önce yapılmalıdır."
      ),
      // YAĞ DEĞİŞİM SAATLERİ REDÜKTÖRE BAĞLIDIR — üreticinin kataloğundadır,
      // şablona sabit bir saat yazmak yanlış olurdu.
      bosluk("Yağ değişim aralıkları"),
      {
        kind: "table",
        head: ["No", "Yağlanacak Yer", "Shell", "Mobil", "B.P."],
        rows: [],
        caption: "Yağlama tablosu — kullanılan ekipmanın kataloğuna göre doldurulur.",
      },
    ],
    children: [
      {
        key: "yaglama.noktalar",
        title: "Makine Bazında Yağlama Noktaları",
        blocks: [
          p(
            "Yağlama noktaları mekanizma mekanizma gruplanır. Bir noktaya ulaşmak için koruma kapağı sökülüyorsa, kapak yerine takılmadan vinç devreye ALINMAZ."
          ),
          ul(
            "Kaldırma grubu: redüktör yağ seviyesi, tambur yatakları, kanca bloğu rulmanı, makara rulmanları.",
            "Araba ve köprü yürütme: redüktör yağ seviyesi, teker yatakları, kaplinler.",
            "Fren: mafsal ve pim noktaları — BALATAYA VE KASNAĞA YAĞ BULAŞTIRILMAZ.",
            "Çelik halat: halat yağıyla dıştan yağlanır."
          ),
          not(
            "dikkat",
            "Fren balatasına ya da kasnağına bulaşan yağ frenin tutma momentini düşürür. Bulaşma varsa balata değiştirilir; temizlemek yeterli değildir."
          ),
        ],
      },
      {
        key: "yaglama.gresSistemi",
        title: "Merkezi Gres Sistemi ve Katılaşma",
        blocks: [
          p(
            "Merkezi yağlama sistemi bulunan vinçlerde gres, pompadan dağıtıcı bloklara ve oradan noktalara basılır. Uzun duruşlarda ve düşük sıcaklıkta gres katılaşabilir; sistem basar ama gres ilerlemez."
          ),
          ol(
            [
              "Pompa haznesinde gres olduğunu ve karıştırıcı kanadın döndüğünü doğrulayın.",
              "Dağıtıcı bloktaki gösterge pimlerinin hareket ettiğini izleyin.",
              "Hareket etmeyen hatta boruyu blok çıkışından sökün ve elle gres basarak tıkanıklığı arayın.",
              "Tıkalı hattı temizleyin ya da değiştirin; noktaya elle gres basarak yağlamayı tamamlayın.",
            ],
            "Bütün gösterge pimleri hareket eder ve hatlar açıktır."
          ),
          not(
            "onemli",
            "Katılaşmış gresi çözmek için hattı ISITMAYIN. Gres ayrışır, yağ ile sabun fazı ayrılır ve yağlama özelliğini kaybeder."
          ),
        ],
      },
    ],
  },

  // ———————————————————————————————————— 7 Yedek Parça ve Sarf Listeleri
  {
    key: "yedek",
    title: "Yedek Parça Listeleri",
    blocks: [
      p(
        "Bu bölümdeki listeler hesap raporundan ve elektrik projesinden ÜRETİLİR; elle yazılmaz. Kaynak belgeler revize edildiğinde liste kendiliğinden tazelenir."
      ),
    ],
    children: [
      {
        key: "yedek.rulman",
        title: "Rulman Listesi",
        blocks: [oto("rulman", "Hesap raporu bağlanmadığı için rulman listesi boş.")],
      },
      {
        key: "yedek.halat",
        title: "Halat Listesi",
        blocks: [oto("halat", "Hesap raporu bağlanmadığı için halat listesi boş.")],
      },
      {
        key: "yedek.kece",
        title: "Yağ Keçesi Listesi",
        // KEÇE LİSTESİ BUGÜN UYGULAMADA YOKTUR: hesap motorunda keçe bir seçim
        // alanı değil. Bölüm elle doldurulur; uydurma bir liste ÜRETİLMEZ.
        blocks: [
          {
            kind: "table",
            head: ["Kullanıldığı Yer", "Tip", "Ölçü (d × D × b)", "Adet"],
            rows: [],
          },
        ],
      },
      {
        key: "yedek.ekipman",
        title: "Ekipman Listesi",
        blocks: [oto("ekipman", "Hesap raporu bağlanmadığı için ekipman listesi boş.")],
      },
      {
        key: "yedek.siparis",
        title: "Yedek Parça Siparişi",
        blocks: [
          p(
            "Yedek parça siparişinde aşağıdaki bilgiler eksiksiz verilir; eksik bilgiyle gelen bir talep yanlış parçayla sonuçlanır."
          ),
          ul(
            "Vincin seri numarası ve üretim yılı (kapak künyesinde),",
            "Belgenin doküman numarası ve revizyonu,",
            "Parçanın bu kılavuzdaki adı ve bulunduğu grup,",
            "Ekipman listesindeki marka ve model bilgisi,",
            "İstenen adet ve gerekiyorsa aciliyet."
          ),
          not(
            "onemli",
            "Orijinal olmayan bir parça, eşdeğerliği yazılı olarak belgelenmedikçe kullanılmaz. Kaldırma ve fren donanımında eşdeğerlik üreticinin onayını gerektirir."
          ),
        ],
      },
      {
        key: "yedek.servis",
        title: "Servis Hizmetleri",
        blocks: [
          p(
            "Periyodik muayene, genel revizyon ve kalan servis ömrü değerlendirmesi üreticinin servis ekibince yapılabilir."
          ),
          ul(
            "PERİYODİK MUAYENE — ISO 9927-1 kapsamında muayene ve raporlama.",
            "KALAN SERVİS ÖMRÜ DEĞERLENDİRMESİ — ISO 12482 / FEM 9.755 uyarınca kaldırma mekanizmasının kalan ömrünün hesaplanması.",
            "GENEL REVİZYON — servis ömrünü tamamlamış mekanizmanın sökülerek yenilenmesi.",
            "YEDEK PARÇA VE ARIZA DESTEĞİ."
          ),
          bosluk("Servis iletişim bilgileri"),
        ],
      },
      {
        key: "yedek.elektrik",
        title: "Elektrik Malzeme Özeti",
        blocks: [oto("elektrikMalzeme", "Elektrik projesi yüklenmediği için pano özeti boş.")],
      },
    ],
  },

  // ————————————————————————————————————— Atık Bertarafı ve Çevre
  {
    key: "atik",
    title: "Atık Bertarafı ve Çevre",
    blocks: [
      p(
        "Vincin bakımında ve ömrünü tamamlamasında ortaya çıkan atıklar yerel mevzuata göre ayrıştırılır ve yetkili kuruluşlara teslim edilir."
      ),
    ],
    children: [
      {
        key: "atik.bertaraf",
        title: "Bakım Atıkları",
        blocks: [
          ul(
            "ATIK YAĞ VE GRES — sızdırmaz kaplarda toplanır; kanalizasyona ve toprağa DÖKÜLMEZ.",
            "FREN BALATASI VE AŞINMA TOZU — solunmaması için ıslak temizlik yapılır, tehlikeli atık olarak toplanır.",
            "ÇELİK HALAT — yağlıdır; metal hurdasından ayrı toplanır.",
            "AKÜ, PİL VE ELEKTRONİK KART — tehlikeli atıktır, geri dönüşüm noktasına verilir.",
            "TEMİZLİK BEZİ VE EMİCİ MALZEME — yağ bulaşmışsa tehlikeli atıktır."
          ),
          not(
            "dikkat",
            "Yağ bulaşmış bez yığını kendiliğinden tutuşabilir. Kapalı metal kapta biriktirin ve vardiya sonunda boşaltın."
          ),
        ],
      },
      {
        key: "atik.cevre",
        title: "Ömrünü Tamamlayan Vinç",
        blocks: [
          p(
            "Sökümden önce vincin enerjisi kesilir, halatlar boşaltılır ve yaylı fren gibi enerji depolayan elemanlar güvenli biçimde serbest bırakılır."
          ),
          ul(
            "Çelik yapı ve mekanizmalar metal geri dönüşümüne verilir.",
            "Redüktör ve hidrolik gruplardaki yağ sökümden ÖNCE boşaltılır.",
            "Elektrik panosu, sürücüler ve kablolar elektronik atık olarak ayrıştırılır."
          ),
          not(
            "uyari",
            "Söküm, kaldırma işlerinde yetkin bir ekip tarafından ve bir söküm planına göre yapılır. Yaylı fren ve gergili halat, söküm sırasında beklenmedik enerji açığa çıkarır."
          ),
        ],
      },
    ],
  },

  // ————————————————————————————————————— Terminoloji ve Kısaltmalar
  {
    key: "sozluk",
    title: "Terminoloji ve Kısaltmalar",
    blocks: [
      p(
        "Bu kılavuzda geçen terimler aşağıdaki anlamlarda kullanılmıştır. Standart adları kaynak gösterimidir; tam metinleri ilgili standarttadır."
      ),
      tablo(
        ["Terim / Kısaltma", "Anlamı"],
        [
          ["Anma yükü", "Vincin taşımak üzere tasarlandığı en büyük yük."],
          ["Açıklık", "Kren yolu raylarının eksenleri arasındaki yatay uzaklık."],
          ["Kanca yüksekliği", "Kancanın en üst ve en alt konumu arasındaki düşey yol."],
          ["Kaldırma grubu (M)", "Mekanizmanın çalışma süresi ve yük kolektifine göre sınıfı (FEM 1.001)."],
          ["Yapı sınıfı (A)", "Çelik yapının yorulma bakımından sınıfı (FEM 1.001 / DIN 15018)."],
          ["SWP", "Kalan servis ömrü — tüketilmiş çalışma payı (ISO 12482 / FEM 9.755)."],
          ["Halat donanımı", "Tambur, makara ve kanca bloğu arasındaki halat geçiş düzeni."],
          ["Emniyet sarımı", "Kanca en altta iken tamburda kalması gereken en az sarım (DIN 15020)."],
          ["Limit şalteri", "Bir hareketin çalışma sınırını belirleyen elektriksel sınırlayıcı."],
          ["Tampon", "Hareketin sonunda çarpma enerjisini yutan eleman."],
          ["LOTO", "Enerji kesme ve kilitleme — bakım öncesi kilitleme/etiketleme yöntemi."],
          ["KKD", "Kişisel koruyucu donanım."],
        ],
        "Bakım çizelgesindeki insan gücü, zaman dilimi ve çalışma durumu kısaltmaları o bölümün kendi açıklama tablosundadır."
      ),
    ],
  },

  // ———————————————————————————————————————————————————————————— EKLER
  {
    key: "ekler",
    title: "Ekler",
    blocks: [
      p(
        "Aşağıdaki ekler bu kılavuzun ayrılmaz parçasıdır ve belgenin tam sürümünde bu bölümün ardından basılır."
      ),
    ],
    children: [
      { key: "ekler.mekanikHesap", title: "Mekanik Hesaplamalar", appendix: "mekanikHesap" },
      { key: "ekler.mekanikProje", title: "Mekanik Projeler", appendix: "mekanikProje" },
      { key: "ekler.mekanikKatalog", title: "Mekanik Ekipman Katalog Sayfaları", appendix: "mekanikKatalog" },
      { key: "ekler.elektrikHesap", title: "Elektrik Hesaplamaları", appendix: "elektrikHesap" },
      { key: "ekler.elektrikProje", title: "Elektrik Projeleri", appendix: "elektrikProje" },
      { key: "ekler.elektrikKatalog", title: "Elektrik Ekipman Katalog Sayfaları", appendix: "elektrikKatalog" },
      { key: "ekler.sartname", title: "Teknik Şartname", appendix: "sartname" },
    ],
  },
];
