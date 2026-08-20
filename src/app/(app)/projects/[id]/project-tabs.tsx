// Proje detayının BÖLÜM RAYI — "Hesap Raporu" · "Elektrik Projesi" ·
// "Ekipman Listeleri" · "Elektrik Projesi" · "Teknik Resim Takibi" ·
// "İşletme ve Bakım El Kitabı".
//
// SIRA İŞ AKIŞIDIR, bir düzen tercihi değil (kullanıcı kararı, 19.08.2026:
// *"Hesap Raporu ile Teknik Resim Takibi sayfasının arasına Elektrik Projesi
// bölümü"*): mekanik hesap biter → elektrik projesi gelir → resimler çizilir
// → hepsinden el kitabı derlenir. El kitabı en sondadır çünkü ötekilerin
// hepsinden beslenir.
//
// NEDEN KENDİ DOSYASINDA: eski hâlinde şerit gri bir hap kümesiydi ve
// "Teknik Çizimler" sekmesi künyenin altında gözden kaçıyordu (kullanıcı
// bildirimi, 11.08.2026). Yeni görünüm `PackageNav` ile aynı dili konuşur —
// alt çizgili ray, ikon, kalın etiket ve bölüm çizgisi. Dosya ayrı ki
// `/dev/project-preview` GERÇEK rayı bassın: markup önizlemeye kopyalansaydı
// iki düzen zamanla ayrışır ve önizleme yanlış güven verirdi (aynı gerekçe
// `project-header.tsx` başlığında da yazılı).
//
// `Tabs` KÖKÜ ÇAĞIRANDADIR: paneller (TabsContent) sayfanın kendisindedir ve
// ray onlarla aynı kökü paylaşmak zorundadır.

import { BookOpen, FileDown, FileSpreadsheet, Ruler, Zap } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Sekme tetikleyicisi.
 *
 * Taban `TabsTrigger` bir HAP çizer (`data-active:bg-background`) ve
 * yüksekliğini şeritten alır (`h-[calc(100%-1px)]`); ikisi de burada geri
 * alınır. `after:hidden`: `line` varyantının kendi alt çizgi çubuğu şeridin
 * `p-[3px]` iç boşluğuna göre konumlanır, iç boşluk sıfırlanınca çizgi bölüm
 * çizgisinin 3px altına düşerdi — çizgiyi tetikleyicinin KENDİ alt kenarı
 * çizer (`border-b-2`).
 *
 * HİÇBİR ÖĞE ŞERİDİN KUTUSUNDAN TAŞMAZ — ve bu bir yerleşim zarafeti değil,
 * bir HATA DÜZELTMESİDİR (kullanıcı bildirimi, 11.08.2026): şeridin sağ ucunda
 * "Ekipman Listesi (V1)"in yanında minik bir DİKEY KAYDIRMA OKU çıkıyordu.
 * Sebep iki katlıydı — (a) bağlantı `min-h-9` taşırken sekmeler dolgudan gelen
 * daha kısa bir boydaydı, (b) sekmeler `-mb-px` ile şeridin ALT ÇİZGİSİNİN
 * üzerine taşıyordu. CSS'te `overflow-x` görünürlükten çıkınca `overflow-y` de
 * `visible` KALAMAZ, kendiliğinden `auto` olur; tek piksellik bir taşma bile
 * gerçek bir kaydırma çubuğu doğurur.
 *
 * Çözüm taşmayı gidermektir, kırpmak değil: dikey ölçü iki öğede de tek bir
 * sabitten gelir (`RAIL_BOX`) ve şeridin alt çizgisi `border-b` yerine İÇ
 * GÖLGEDİR — gölge dolgu kutusunun içine boyanır, yani aktif sekmenin kırmızı
 * çizgisi negatif kenar boşluğuna gerek kalmadan onun tam üstüne oturur.
 */
const RAIL_BOX = "px-1 pt-1 pb-2.5 pointer-coarse:pt-2.5 pointer-coarse:pb-4";

const TAB = `h-auto flex-none rounded-none border-0 border-b-2 border-transparent ${RAIL_BOX} text-[15px] font-medium text-muted-foreground after:hidden hover:text-foreground data-active:border-primary data-active:text-foreground`;

/** Sekmedeki sayaç rozeti — etiketin ağırlığını bozmayan ince bir sayı. */
const COUNT =
  "rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums text-muted-foreground";

export function ProjectTabsNav({
  revisionCount,
  equipmentCount,
  electricalPartCount,
  drawingPlanCount,
  manualRevisionCount,
}: {
  revisionCount: number;
  /** Hesap raporu revizyonlarından türetilen ekipman listesi sürüm adedi. */
  equipmentCount: number;
  /** Okunmuş elektrik malzeme satırı adedi; okunmamışsa 0. */
  electricalPartCount: number;
  drawingPlanCount: number;
  /** El kitabı revizyon adedi; kitap açılmamışsa 0. */
  manualRevisionCount: number;
}) {
  return (
    // `items-end`: alt çizgili bir rayda hem sekmeler hem yanındaki bağlantı
    // şeridin ALT kenarına oturmalıdır; ortalanınca aktif sekmenin kırmızı
    // çizgisi bölüm çizgisinden kopardı.
    // RAY KAYMAZ, SARAR (kabuk kuralı 15; purchasing-nav ile aynı karar):
    // `.oc-scrollx` + `overflow-x-auto` kalktı, dar ekranda öğeler ikinci
    // satıra iner — gizli sekme kalmaz. Alt çizgi yine `border-b` DEĞİL iç
    // gölgedir (bkz. RAIL_BOX başlığı; MOBIL-14 dersinin kaynağı bu raydı):
    // aktif sekmenin kırmızı çizgisi negatif kenar boşluğu olmadan onun
    // üstüne oturur. Taşma kabı kalktığı için `overflow-y-hidden` emniyet
    // kemerine de gerek kalmadı — kaydırma çubuğu doğuracak bir kap yok.
    <div className="flex flex-wrap items-end gap-x-5 shadow-[inset_0_-1px_0_var(--border)]">
      <TabsList
        variant="line"
        // Taban şerit yüksekliğini `group-data-horizontal/tabs:h-9` ile
        // veriyor; düz bir `h-auto` onu YENMEZ (aynı özgüllük, sıraya kalır).
        // Ezme AYNI belirteçle yazılır ki tailwind-merge çakışmayı görsün.
        // `flex-wrap`: iki sekme çok dar ekranda tek satıra sığmazsa alt
        // satıra sarar, raya kaydırma çubuğu sokmaz.
        className="h-auto flex-wrap gap-x-5 rounded-none p-0 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:pointer-coarse:h-auto"
      >
        <TabsTrigger value="report" className={TAB}>
          <FileSpreadsheet className="size-4" />
          Hesap Raporu
          {revisionCount > 0 && <span className={COUNT}>{revisionCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="equipment" className={TAB}>
          <FileDown className="size-4" />
          Ekipman Listeleri
          {equipmentCount > 0 && <span className={COUNT}>{equipmentCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="electrical" className={TAB}>
          <Zap className="size-4" />
          Elektrik Projesi
          {electricalPartCount > 0 && <span className={COUNT}>{electricalPartCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="drawings" className={TAB}>
          <Ruler className="size-4" />
          Teknik Resim Takibi
          {drawingPlanCount > 0 && <span className={COUNT}>{drawingPlanCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="manual" className={TAB}>
          <BookOpen className="size-4" />
          İşletme ve Bakım El Kitabı
          {manualRevisionCount > 0 && <span className={COUNT}>{manualRevisionCount}</span>}
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
