// EL KİTABININ ŞABLONU — bölüm ağacı ve STANDART METİNLER.
//
// KAYNAK: firmanın kendi teslim ettiği "185/40 Ton Kapasiteli Şarj Vinci
// Kullanma ve Bakım Kılavuzu" (Karçel A.Ş., 028.00-KBK01, 24.07.2026) —
// 14 ana bölüm, 40'tan fazla alt bölüm. Şablon o belgenin İSKELETİ ve
// PROJEDEN BAĞIMSIZ metinleridir.
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

import type {
  ManualAutoSource,
  ManualBlock,
  ManualNoteLevel,
  ManualSection,
} from "./types";

/**
 * ŞABLON SÜRÜMÜ. Artırıldığında var olan belgeler DEĞİŞMEZ — editör yalnız
 * "şablonda yeni bölümler var" der ve eklemeyi kullanıcı seçer. Belge
 * kullanıcınındır; bir güncelleme onun sildiği bölümü geri getiremez.
 */
export const MANUAL_TEMPLATE_VERSION = 1;

/** Şablon düğümü — `id`ler kopyalama anında üretilir, şablonda yoktur. */
export interface TemplateBlock {
  kind: ManualBlock["kind"];
  text?: string;
  margin?: string;
  items?: string[];
  ordered?: boolean;
  result?: string;
  level?: ManualNoteLevel;
  title?: string;
  source?: ManualAutoSource;
  emptyText?: string;
  head?: string[];
  rows?: string[][];
  caption?: string;
}

export interface TemplateSection {
  key: string;
  title: string;
  blocks?: TemplateBlock[];
  children?: TemplateSection[];
  appendix?: ManualSection["appendix"];
}

const p = (text: string, margin?: string): TemplateBlock => ({ kind: "text", text, margin });
const ul = (...items: string[]): TemplateBlock => ({ kind: "list", items });
const ol = (items: string[], result?: string): TemplateBlock => ({
  kind: "list",
  ordered: true,
  items,
  result,
});
const not = (level: ManualNoteLevel, text: string, title?: string): TemplateBlock => ({
  kind: "note",
  level,
  text,
  title,
});
const oto = (source: ManualAutoSource, emptyText?: string): TemplateBlock => ({
  kind: "auto",
  source,
  emptyText,
});

/**
 * DOLDURULACAK BOŞLUK.
 *
 * Vince özel bir metnin yerini tutar ve `text`i BOŞTUR — `placeholder` yasağı
 * (değişmez md. 5) tam olarak budur: örnek bir cümle yazsaydık kopyalanır ve
 * yanlış bir kılavuzla teslim edilirdi. Editörde başlık altında boş bir kutu
 * görünür, belgede hiç görünmez.
 */
const bosluk = (margin?: string): TemplateBlock => ({ kind: "text", text: "", margin });

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
        key: "notlar.gorseller",
        title: "Bu kılavuzda kullanılan görseller",
        blocks: [
          p(
            "Bu kılavuzda bulunan güvenlik noktaları bir adet piktogram ve uyarı kelimesi ile gösterilir. Uyarı kelimesi güvenlik riskinin boyutunu tanımlar."
          ),
          not("tehlike", "Kaçınılmadığı takdirde ölüm ya da ağır yaralanmaya yol açacak bir tehlikeyi belirtir."),
          not("uyari", "Kaçınılmadığı takdirde ölüm ya da ağır yaralanmaya yol açabilecek bir tehlikeyi belirtir."),
          not("onemli", "Makinede ya da çevresinde hasara yol açabilecek bir durumu belirtir."),
          not("bilgi", "Kullanımı kolaylaştıran ek bilgiyi belirtir."),
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
        key: "guvenlik.uyariIsaretleri",
        title: "Uyarı İşaretleri",
        blocks: [
          p(
            "Vinç üzerindeki tüm uyarı işaretlerini gözlemleyin ve talimatlara uyun. Ek olarak, vinç üzerinde aşağıdaki işaret bulunur:"
          ),
          not(
            "bilgi",
            "Bu ürün için geçerli ve CE sembolü gerektiren EU direktifleriyle uyumluluğu gösterir.",
            "CE İşareti"
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
      { key: "kullanim.limitSivicler", title: "Limit Siviçler", blocks: [bosluk()] },
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
        key: "yedek.elektrik",
        title: "Elektrik Malzeme Listesi",
        blocks: [oto("elektrikMalzeme", "Elektrik projesi yüklenmediği için malzeme listesi boş.")],
      },
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
