// HIZLI EYLEMLER — panelin kısayol şeridi, SAF TANIM.
//
// Her eylem yalnız bir BAĞLANTIDIR: panelden pencere/dialog açılmaz, yazma
// yolları tekil kalır (md. 21/25 dersleri — ikinci bir giriş formu zamanla
// aslından ayrışır). Görünürlük rol SORUSUYLA verilir (rol listesiyle değil),
// `WORKSPACE_SECTIONS` ile aynı dil.

import {
  canEditConsumableExpenses,
  canEditDrawings,
  canEditReports,
  canSeePersonnel,
  canSeePurchasing,
  canSeeWorkLog,
} from "@/lib/roles";
import type { BrandIconName } from "@/components/brand-icon";

export interface PanelAction {
  href: string;
  label: string;
  icon: BrandIconName;
  /** Verilmezse eylem HERKESE görünür. */
  visible?: (role: string) => boolean;
}

export const PANEL_ACTIONS: readonly PanelAction[] = [
  { href: "/jobs/new", label: "Yeni İş", icon: "bolt" },
  { href: "/jobs?view=pano", label: "Görev Panosu", icon: "bolt" },
  { href: "/projects", label: "Hesap Raporları", icon: "panel", visible: canEditReports },
  { href: "/drawings/new", label: "Resim Yükle", icon: "blueprint", visible: canEditDrawings },
  { href: "/purchasing", label: "Talep Havuzu", icon: "cart", visible: canSeePurchasing },
  { href: "/purchasing/sarf", label: "Sarf Girişi", icon: "cart", visible: canEditConsumableExpenses },
  { href: "/worklog", label: "Günlük Giriş", icon: "timesheet", visible: canSeeWorkLog },
  { href: "/personnel/maas", label: "Maaş", icon: "wallet", visible: canSeePersonnel },
];

export function visiblePanelActions(role: string): PanelAction[] {
  return PANEL_ACTIONS.filter((a) => !a.visible || a.visible(role));
}
