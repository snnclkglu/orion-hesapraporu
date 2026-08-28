"use client";

// Elektrik odası — pano enleri düzenleyicisi.
//
// Pano adedi genel girdi ızgarasındadır. Bu bileşen adet kadar adlandırılmış
// satır üretir; ortak yükseklik ilk pano satırından, ortak derinlik ana girdi
// ızgarasından seçilir. Enler `roomPanelWidthsText` alanına pano sırasıyla
// noktalı virgül ayrımlı yazılır; hesap, çizim, PDF ve ekipman listesi aynı
// metni `roomPanelWidths` ile okur.

import {
  ROOM_PANEL_BASE_HEIGHT_MM,
  ROOM_PANEL_HEIGHT_OPTIONS_MM,
  ROOM_PANEL_WIDTH_OPTIONS_MM,
  roomPanelWidths,
} from "@/lib/calc/modules/cabin";
import { cn } from "@/lib/utils";

export interface RoomPanelWidthsEditorProps {
  panelCount: number;
  value: string;
  panelHeightMm: number;
  panelDepthMm: number;
  onChange: (next: string) => void;
  onHeightChange: (next: number) => void;
  onAddPanel: () => void;
  onRemovePanel: (index: number) => void;
  disabled?: boolean;
}

export function RoomPanelWidthsEditor({
  panelCount,
  value,
  panelHeightMm,
  panelDepthMm,
  onChange,
  onHeightChange,
  onAddPanel,
  onRemovePanel,
  disabled,
}: RoomPanelWidthsEditorProps) {
  const widths = roomPanelWidths(value, panelCount);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  const changeWidth = (index: number, raw: string) => {
    const next = [...widths];
    next[index] = Number(raw);
    onChange(next.join("; "));
  };

  return (
    <section className="grid gap-3 border bg-card/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="oc-kicker text-muted-foreground">Pano Yerleşimi</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Her pano eni ayrı seçilir. İlk panonun yüksekliği bütün yeni panolara uygulanır.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            Toplam {totalWidth.toLocaleString("tr-TR")} mm
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddPanel}
            className={cn(
              "oc-tap inline-flex h-9 items-center justify-center border border-primary/40 bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors",
              "hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              disabled && "pointer-events-none opacity-60"
            )}
          >
            <span aria-hidden className="mr-1.5 font-mono">＋</span>
            Yeni Pano Ekle
          </button>
        </div>
      </div>

      {widths.length === 0 ? (
        <p className="border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Henüz pano yok. İlk satırı oluşturmak için “Yeni Pano Ekle” düğmesini kullanın.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {widths.map((width, index) => {
            const widthId = `room-panel-width-${index}`;
            const heightId = `room-panel-height-${index}`;
            return (
              <div
                key={index}
                className="grid content-start gap-2 border bg-background px-3 py-2"
              >
                <div className="flex min-w-0 items-start justify-between gap-3 border-b pb-2">
                  <div className="min-w-0">
                    <span className="block font-mono text-sm font-semibold text-foreground">
                      {index + 1}. Pano
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {index === 0
                        ? `Seçilen yükseklik bütün panolarda ortak · D ${panelDepthMm} mm`
                        : `H ${panelHeightMm} mm (1. pano ile aynı) · ${ROOM_PANEL_BASE_HEIGHT_MM} mm baza · D ${panelDepthMm} mm`}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`${index + 1}. Panoyu Sil`}
                    title={`${index + 1}. panoyu sil`}
                    disabled={disabled}
                    onClick={() => onRemovePanel(index)}
                    className={cn(
                      "oc-tap inline-flex h-8 shrink-0 items-center justify-center border border-destructive/40 px-2 text-xs font-semibold text-destructive transition-colors",
                      "hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      disabled && "pointer-events-none opacity-60"
                    )}
                  >
                    <span aria-hidden className="mr-1 font-mono text-base leading-none">×</span>
                    Sil
                  </button>
                </div>
                <label htmlFor={widthId} className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
                  <span className="text-xs text-muted-foreground">Genişlik</span>
                  <span className="flex items-center gap-1.5">
                    <select
                      id={widthId}
                      aria-label={`${index + 1}. Pano Genişliği`}
                      disabled={disabled}
                      value={width}
                      onChange={(event) => changeWidth(index, event.target.value)}
                      className={cn(
                        "oc-tap h-9 min-w-0 flex-1 border bg-background px-2 text-right font-mono text-base tabular-nums",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pointer-fine:text-sm",
                        disabled && "opacity-60"
                      )}
                    >
                      {ROOM_PANEL_WIDTH_OPTIONS_MM.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <span className="font-mono text-[11px] text-muted-foreground">mm</span>
                  </span>
                </label>
                {index === 0 && (
                  <label htmlFor={heightId} className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3">
                    <span className="text-xs text-muted-foreground">Ortak Yükseklik</span>
                    <span className="flex items-center gap-1.5">
                      <select
                        id={heightId}
                        aria-label="1. Pano Yüksekliği"
                        disabled={disabled}
                        value={panelHeightMm}
                        onChange={(event) => onHeightChange(Number(event.target.value))}
                        className={cn(
                          "oc-tap h-9 min-w-0 flex-1 border bg-background px-2 text-right font-mono text-base tabular-nums",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pointer-fine:text-sm",
                          disabled && "opacity-60"
                        )}
                      >
                        {ROOM_PANEL_HEIGHT_OPTIONS_MM.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <span className="font-mono text-[11px] text-muted-foreground">mm</span>
                    </span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
