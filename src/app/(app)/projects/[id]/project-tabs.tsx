// Proje detayının BÖLÜM RAYI — "Hesap Raporu" · "Teknik Resim Takibi" · ekipman
// listesi bağlantısı.
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

import { FileDown, FileSpreadsheet, Ruler } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Sekme tetikleyicisi.
 *
 * Taban `TabsTrigger` bir HAP çizer (`data-active:bg-background`) ve
 * yüksekliğini şeritten alır (`h-[calc(100%-1px)]`); ikisi de burada geri
 * alınır. `after:hidden`: `line` varyantının kendi alt çizgi çubuğu şeridin
 * `p-[3px]` iç boşluğuna göre konumlanır, iç boşluk sıfırlanınca çizgi bölüm
 * çizgisinin 3px altına düşerdi — çizgiyi tetikleyicinin KENDİ alt kenarı
 * çizer (`border-b-2`) ve `-mb-px` ile şeridin çizgisine tam oturur.
 */
const TAB =
  "h-auto flex-none -mb-px rounded-none border-0 border-b-2 border-transparent px-1 pt-1 pb-2.5 text-[15px] font-medium text-muted-foreground after:hidden hover:text-foreground data-active:border-primary data-active:text-foreground";

/** Sekmedeki sayaç rozeti — etiketin ağırlığını bozmayan ince bir sayı. */
const COUNT =
  "rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums text-muted-foreground";

export function ProjectTabsNav({
  revisionCount,
  drawingPlanCount,
  equipmentHref,
  equipmentLabel,
}: {
  revisionCount: number;
  drawingPlanCount: number;
  /** Son revizyonun ekipman listesi adresi; revizyon yoksa verilmez. */
  equipmentHref?: string;
  equipmentLabel?: string;
}) {
  return (
    <div className="oc-scrollx flex items-center gap-5 overflow-x-auto overscroll-x-contain border-b [--oc-scroll-bg:var(--background)]">
      <TabsList
        variant="line"
        // Taban şerit yüksekliğini `group-data-horizontal/tabs:h-9` ile
        // veriyor; düz bir `h-auto` onu YENMEZ (aynı özgüllük, sıraya kalır).
        // Ezme AYNI belirteçle yazılır ki tailwind-merge çakışmayı görsün.
        className="h-auto gap-5 rounded-none p-0 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:pointer-coarse:h-auto"
      >
        <TabsTrigger value="report" className={TAB}>
          <FileSpreadsheet className="size-4" />
          Hesap Raporu
          {revisionCount > 0 && <span className={COUNT}>{revisionCount}</span>}
        </TabsTrigger>
        <TabsTrigger value="drawings" className={TAB}>
          <Ruler className="size-4" />
          Teknik Resim Takibi
          {drawingPlanCount > 0 && <span className={COUNT}>{drawingPlanCount}</span>}
        </TabsTrigger>
      </TabsList>

      {/* Ekipman listesi bir PANEL DEĞİL ayrı bir adrestir; bu yüzden bağlantı
          `role="tablist"` kabının DIŞINDA, TabsList'in kardeşi olarak durur.
          Sekme gibi görünmesin diye sağa dayanır ve alt çizgi almaz. */}
      {equipmentHref && (
        <a
          href={equipmentHref}
          className="-mb-px ml-auto inline-flex min-h-9 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-1 pt-1 pb-2.5 text-[15px] font-medium whitespace-nowrap text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
        >
          <FileDown className="size-4" />
          {equipmentLabel}
        </a>
      )}
    </div>
  );
}
