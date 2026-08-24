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
const RAIL_BOX =
  "px-2 py-2 md:px-1 md:pt-1 md:pb-2.5 md:pointer-coarse:pt-2.5 md:pointer-coarse:pb-4";

const TAB = `h-auto min-h-11 min-w-0 flex-none justify-center rounded-none border border-border bg-card ${RAIL_BOX} text-center text-[13px] leading-tight font-medium whitespace-normal text-muted-foreground after:hidden hover:bg-muted hover:text-foreground data-active:border-primary data-active:bg-primary/[0.08] data-active:text-foreground data-active:shadow-[inset_0_-3px_0_var(--primary)] max-md:w-full md:min-h-0 md:justify-start md:border-0 md:border-b-2 md:border-transparent md:bg-transparent md:text-left md:text-[15px] md:leading-normal md:whitespace-nowrap md:hover:bg-transparent md:data-active:border-primary md:data-active:bg-transparent md:data-active:shadow-none`;

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
    // RAY KAYMAZ (kabuk kuralı 15): `.oc-scrollx` + `overflow-x-auto`
    // kalktı; dar ekranda iki sütunlu ızgaraya, masaüstünde saran raya döner —
    // gizli sekme kalmaz. Alt çizgi yine `border-b` DEĞİL iç
    // gölgedir (bkz. RAIL_BOX başlığı; MOBIL-14 dersinin kaynağı bu raydı):
    // aktif sekmenin kırmızı çizgisi negatif kenar boşluğu olmadan onun
    // üstüne oturur. Taşma kabı kalktığı için `overflow-y-hidden` emniyet
    // kemerine de gerek kalmadı — kaydırma çubuğu doğuracak bir kap yok.
    <div className="w-full shadow-[inset_0_-1px_0_var(--border)]">
      <TabsList
        variant="line"
        // Taban şerit yüksekliğini `group-data-horizontal/tabs:h-9` ile
        // veriyor; düz bir `h-auto` onu YENMEZ (aynı özgüllük, sıraya kalır).
        // Ezme AYNI belirteçle yazılır ki tailwind-merge çakışmayı görsün.
        // Telefon 320px'te iki, 360px üstünde üç sütunlu görünür kutular
        // kullanır; `md` üstünde iş akışı rayı yeniden yatay ve saran düzene
        // döner.
        className="grid h-auto w-full grid-cols-2 items-stretch gap-2 rounded-none p-0 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:pointer-coarse:h-auto min-[360px]:grid-cols-3 md:flex md:flex-wrap md:items-center md:gap-x-5 md:gap-y-0"
      >
        <TabsTrigger value="report" className={TAB}>
          <FileSpreadsheet className="size-4" />
          <span className="md:hidden">Hesap</span>
          <span className="hidden md:inline">Hesap Raporu</span>
          {revisionCount > 0 && <span className={COUNT}>{revisionCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="equipment" className={TAB}>
          <FileDown className="size-4" />
          <span className="md:hidden">Ekipman</span>
          <span className="hidden md:inline">Ekipman Listeleri</span>
          {equipmentCount > 0 && <span className={COUNT}>{equipmentCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="electrical" className={TAB}>
          <Zap className="size-4" />
          <span className="md:hidden">Elektrik</span>
          <span className="hidden md:inline">Elektrik Projesi</span>
          {electricalPartCount > 0 && <span className={COUNT}>{electricalPartCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="drawings" className={TAB}>
          <Ruler className="size-4" />
          <span className="md:hidden">Resimler</span>
          <span className="hidden md:inline">Teknik Resim Takibi</span>
          {drawingPlanCount > 0 && <span className={COUNT}>{drawingPlanCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="manual" className={TAB}>
          <BookOpen className="size-4" />
          <span className="md:hidden">El Kitabı</span>
          <span className="hidden md:inline">İşletme ve Bakım El Kitabı</span>
          {manualRevisionCount > 0 && <span className={COUNT}>{manualRevisionCount}</span>}
        </TabsTrigger>
      </TabsList>
    </div>
  );
}
