"use client";

// Elektrik odası — pano enleri düzenleyicisi.
//
// Pano adedi genel girdi ızgarasındadır. Bu bileşen adet kadar adlandırılmış
// satır üretir; yükseklik ve derinlik oda panolarının ortak kararı olduğu için
// her satırda tekrarlanmaz. Enler `roomPanelWidthsText` alanına pano sırasıyla
// noktalı virgül ayrımlı yazılır; hesap, çizim, PDF ve ekipman listesi aynı
// metni `roomPanelWidths` ile okur.

import {
  ROOM_PANEL_BASE_HEIGHT_MM,
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
  disabled?: boolean;
}

export function RoomPanelWidthsEditor({
  panelCount,
  value,
  panelHeightMm,
  panelDepthMm,
  onChange,
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="oc-kicker text-muted-foreground">Pano Enleri</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Her pano ayrı seçilir; yükseklik ve derinlik bütün satırlarda ortaktır.
          </p>
        </div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          Toplam {totalWidth.toLocaleString("tr-TR")} mm
        </p>
      </div>

      {widths.length === 0 ? (
        <p className="border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Pano satırı oluşturmak için “Pano Adedi” alanına en az 1 girin.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {widths.map((width, index) => {
            const id = `room-panel-width-${index}`;
            return (
              <label
                key={index}
                htmlFor={id}
                className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-3 border bg-background px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-semibold text-foreground">
                    {index + 1}. Pano
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {panelHeightMm} + {ROOM_PANEL_BASE_HEIGHT_MM} mm baza · D {panelDepthMm} mm
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <select
                    id={id}
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
            );
          })}
        </div>
      )}
    </section>
  );
}
