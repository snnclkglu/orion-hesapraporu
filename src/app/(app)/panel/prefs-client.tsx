"use client";

// Panel tercihlerinin İSTEMCİ kontrolleri: "Bölümler" menüsü (göster/gizle +
// katla) ve katlı bölümün "Aç" düğmesi. Yazma tek action'dan geçer
// (`setPanelSectionState`); tercih sunucudadır, cihazlar arası aynıdır.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  COLLAPSIBLE_SECTION_IDS,
  PANEL_SECTION_IDS,
  PANEL_SECTION_LABELS,
  type PanelPrefs,
  type PanelSectionId,
} from "@/lib/panel-prefs";
import { setPanelSectionState } from "./prefs-actions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function useDegistir() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function degistir(
    id: PanelSectionId,
    degisiklik: { hidden?: boolean; collapsed?: boolean }
  ) {
    startTransition(async () => {
      const res = await setPanelSectionState(id, degisiklik);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }
  return { pending, degistir };
}

/** Katlı bölümün başlığındaki tek düğme — bir tıkla geri açılır. */
export function SectionExpandButton({ id }: { id: PanelSectionId }) {
  const { pending, degistir } = useDegistir();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => degistir(id, { collapsed: false })}
      aria-label={`Bölümü aç: ${PANEL_SECTION_LABELS[id]}`}
      className="oc-tap flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
    >
      Aç
      <ChevronDown className="size-3.5" aria-hidden />
    </button>
  );
}

/** Kare işaret — ev dilindeki onay kutusu (task-list ile aynı). */
function KareIsaret({ isaretli }: { isaretli: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-4 shrink-0 place-items-center border transition-colors",
        isaretli
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border"
      )}
    >
      {isaretli && <Check className="size-3" />}
    </span>
  );
}

export function SectionsMenu({ prefs }: { prefs: PanelPrefs }) {
  const { pending, degistir } = useDegistir();
  const hidden = new Set(prefs.hidden);
  const collapsed = new Set(prefs.collapsed);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="oc-tap flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[12px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Bölümler
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
        <header className="border-b px-3 py-2">
          <span className="oc-kicker text-muted-foreground">Panel Bölümleri</span>
        </header>
        <ul className="divide-y">
          {PANEL_SECTION_IDS.map((id) => {
            const gizli = hidden.has(id);
            const katli = collapsed.has(id);
            const katlanabilir = COLLAPSIBLE_SECTION_IDS.includes(id);
            return (
              <li key={id} className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => degistir(id, { hidden: !gizli })}
                  aria-pressed={!gizli}
                  className="oc-tap flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm"
                >
                  <KareIsaret isaretli={!gizli} />
                  <span
                    className={cn(
                      "min-w-0 truncate",
                      gizli && "text-muted-foreground line-through"
                    )}
                  >
                    {PANEL_SECTION_LABELS[id]}
                  </span>
                </button>
                {katlanabilir && !gizli && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => degistir(id, { collapsed: !katli })}
                    aria-pressed={katli}
                    className={cn(
                      "oc-tap shrink-0 border px-1.5 py-0.5 font-mono text-[11px] transition-colors",
                      katli
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary hover:text-foreground"
                    )}
                  >
                    Katlı
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          Tercih hesabınıza kaydedilir; her cihazda aynı görünür.
        </p>
      </PopoverContent>
    </Popover>
  );
}
