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
import { BolumRayi, type BolumOgesi } from "@/components/bolum-rayi";
import { capayaGit, useAktifCapa } from "@/lib/bolum-capa";
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

/**
 * PANONUN BÖLÜM RAYI — hem gezinme hem tercih yüzeyi (PANEL-24).
 *
 * 01.09.2026'ya kadar üst şeritte ayrı bir "Bölümler" menüsü (`SectionsMenu`,
 * aşağıda) vardı ve aynı sekiz kimliği listeliyordu. Ray gelince kullanıcının
 * karşısında AYNI listeyi gösteren iki yüzey olurdu; kullanıcı kararı: ray
 * menüyü yutar. Göz ve "Katlı" düğmeleri satırın sağ yuvasına indi, yazma yolu
 * (`setPanelSectionState`) hiç değişmedi.
 *
 * GİZLİ BÖLÜM RAYDA KALIR ama ÇIPASI YOKTUR: gizlenen bölümün sorgusu hiç
 * koşmuyor, yani DOM'da da yok. Satır orada yalnız GERİ AÇMAK için durur —
 * rayın "git" anlamıyla tek çelişkisi budur ve bilinçlidir; başka türlü
 * gizlenen bir bölüm geri açılamazdı.
 */
export function PanelRail({ prefs }: { prefs: PanelPrefs }) {
  const { pending, degistir } = useDegistir();
  const gizliKume = new Set(prefs.hidden);
  const katliKume = new Set(prefs.collapsed);

  /**
   * `yapilacak`ın kendi yuvası yok — "Benim Günüm"ün içinde çiziliyor. Rayda
   * kendi satırı VARDIR (gizlenebilir bir bölümdür) ama çıpası `gunum`u
   * gösterir; kendi kimliğine kaydırmak boşluğa atlamak olurdu.
   */
  const capaHedefi = (id: PanelSectionId): PanelSectionId =>
    id === "yapilacak" ? "gunum" : id;

  const gorunurKimlikler = PANEL_SECTION_IDS.filter((id) => !gizliKume.has(id)).map(capaHedefi);
  const [okunan, isaretle] = useAktifCapa(gorunurKimlikler);

  const ogeler: BolumOgesi[] = PANEL_SECTION_IDS.map((id) => {
    const gizli = gizliKume.has(id);
    const katli = katliKume.has(id);
    const katlanabilir = COLLAPSIBLE_SECTION_IDS.includes(id);
    return {
      id,
      baslik: PANEL_SECTION_LABELS[id],
      gizli,
      rozet: gizli ? "gizli" : katli ? "katlı" : undefined,
      sag: (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => degistir(id, { hidden: !gizli })}
            aria-pressed={!gizli}
            aria-label={`${PANEL_SECTION_LABELS[id]}: ${gizli ? "panoda göster" : "panodan gizle"}`}
            title={gizli ? "Panoda göster" : "Panodan gizle — sorgusu hiç koşmaz"}
            className="oc-tap-square grid size-6 shrink-0 place-items-center transition-colors hover:bg-muted"
          >
            <KareIsaret isaretli={!gizli} />
          </button>
          {katlanabilir && !gizli ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => degistir(id, { collapsed: !katli })}
              aria-pressed={katli}
              aria-label={`${PANEL_SECTION_LABELS[id]}: ${katli ? "gövdeyi aç" : "gövdeyi katla"}`}
              title={katli ? "Gövdeyi aç" : "Gövdeyi katla — başlık kalır, veri yüklenmez"}
              className={cn(
                "oc-tap-square grid size-6 shrink-0 place-items-center border font-mono text-[10px] transition-colors",
                katli
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              ▾
            </button>
          ) : (
            <span aria-hidden className="size-6 shrink-0" />
          )}
        </span>
      ),
    };
  });

  return (
    <BolumRayi
      etiket="Pano bölümleri"
      depoAnahtari="orion.pano.ray.daraltildi"
      ogeler={ogeler}
      aktifId={okunan}
      onSec={(id) => {
        // Gizli bölümün DOM'da karşılığı yok: satır yalnız kutusuyla geri
        // açılır, tıklamak sessizce hiçbir şey yapar.
        if (gizliKume.has(id as PanelSectionId)) return;
        const hedef = capaHedefi(id as PanelSectionId);
        isaretle(hedef);
        capayaGit(hedef);
      }}
    />
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
