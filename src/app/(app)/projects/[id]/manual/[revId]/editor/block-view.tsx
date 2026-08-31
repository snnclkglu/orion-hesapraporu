"use client";

// BLOĞUN GÖRÜNÜMÜ VE YERİNDE DÜZENLEYİCİSİ.
//
// TOMAR BİR FORM DEĞİL, BİR BELGEDİR. Eski editörde her blok bir kart, her
// alan bir input'tu; kullanıcı yazdığı şeyin belgede nasıl görüneceğini ancak
// sağdaki kâğıda bakarak anlıyordu. Burada metin BASILI HÂLİNE BENZER
// tipografiyle ve doğrudan yerinde yazılır.
//
// TOMAR A4 SAYFALAMAZ ve bu bilinçlidir: "ne yazdığımı görüyorum" Tomar'ın
// işidir, "kaç sayfa tutuyor" Kâğıt modunun. İkisini birleştirmek, her tuşta
// bütün dağıtımı yeniden hesaplamak ve yazarken imlecin sayfa atlaması
// demekti.
//
// GİZLİ BLOK SOLGUN AMA DÜZENLENEBİLİR KALIR: gizlemek silmek değildir
// (KITAP-6).

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MANUAL_AUTO_LABELS, MANUAL_NOTE_LABELS } from "@/lib/manual/types";
import type { ManualBlock, ManualTable } from "@/lib/manual/types";
import { autoTableFor, type ManualSourceData } from "@/lib/manual/sources";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";
import type { OnizlemeGorsel } from "@/components/manual/manual-paper";
import { cn } from "@/lib/utils";

/**
 * KENDİ BOYUNU ALAN METİN ALANI.
 *
 * Sabit satırlı bir textarea, uzun bir bakım talimatını dört satırlık bir
 * pencereden okutur ve kullanıcı yazdığının tamamını göremez. Yükseklik her
 * değişimde içeriğe göre ayarlanır.
 */
function OtoMetin({
  value,
  onChange,
  readOnly,
  className,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      aria-label={ariaLabel}
      // YER TUTUCU VERİ ÖRNEĞİ TAŞIMAZ (değişmez md. 5): yalnız NE yazılacağını
      // söyleyen bir yönerge olabilir, örnek bir değer değil.
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={cn(
        "w-full resize-none border-0 bg-transparent p-0 text-[0.95rem] leading-relaxed",
        "focus-visible:outline-none focus-visible:ring-0",
        "placeholder:text-muted-foreground/60",
        readOnly && "cursor-default",
        className
      )}
    />
  );
}

function TabloDuzenleyici({
  table,
  readOnly,
  onDegis,
}: {
  table: ManualTable;
  readOnly: boolean;
  onDegis: (t: ManualTable) => void;
}) {
  const sutun = Math.max(table.head.length, 1);

  return (
    <div className="oc-scrollx">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i} className="border p-0 align-top">
                <Input
                  value={h}
                  readOnly={readOnly}
                  aria-label={`Sütun ${i + 1} başlığı`}
                  className="h-8 rounded-none border-0 bg-muted/60 text-xs font-medium"
                  onChange={(e) => {
                    const head = [...table.head];
                    head[i] = e.target.value;
                    onDegis({ ...table, head });
                  }}
                />
              </th>
            ))}
            {!readOnly ? <th className="w-8 border bg-muted/60" /> : null}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri}>
              {Array.from({ length: sutun }).map((_, ci) => (
                <td key={ci} className="border p-0 align-top">
                  <Input
                    value={r[ci] ?? ""}
                    readOnly={readOnly}
                    aria-label={`Satır ${ri + 1} sütun ${ci + 1}`}
                    className="h-8 rounded-none border-0 text-xs"
                    onChange={(e) => {
                      const rows = table.rows.map((x) => [...x]);
                      while (rows[ri].length < sutun) rows[ri].push("");
                      rows[ri][ci] = e.target.value;
                      onDegis({ ...table, rows });
                    }}
                  />
                </td>
              ))}
              {!readOnly ? (
                <td className="border p-0 text-center align-middle">
                  <button
                    type="button"
                    className="oc-tap p-1 text-muted-foreground"
                    aria-label={`${ri + 1}. satırı sil`}
                    onClick={() =>
                      onDegis({ ...table, rows: table.rows.filter((_, i) => i !== ri) })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly ? (
        <div className="mt-1 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="oc-tap"
            onClick={() =>
              onDegis({ ...table, rows: [...table.rows, Array(sutun).fill("")] })
            }
          >
            <Plus className="size-3.5" /> Satır
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="oc-tap"
            onClick={() =>
              onDegis({
                ...table,
                head: [...table.head, ""],
                rows: table.rows.map((r) => [...r, ""]),
              })
            }
          >
            <Plus className="size-3.5" /> Sütun
          </Button>
          {table.head.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              className="oc-tap text-muted-foreground"
              onClick={() =>
                onDegis({
                  ...table,
                  head: table.head.slice(0, -1),
                  rows: table.rows.map((r) => r.slice(0, -1)),
                })
              }
            >
              Son sütunu kaldır
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Otomatik ve donmuş tabloların salt okunur önizlemesi. */
function TabloOnizleme({ table }: { table: ManualTable }) {
  if (table.rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Kaynak boş — bu tablo belgeye BASILMAZ.
      </p>
    );
  }
  return (
    <div className="oc-scrollx">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i} className="border bg-muted/60 px-1.5 py-1 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, 12).map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className="border px-1.5 py-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 12 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {`… ${table.rows.length} satırın ilk 12'si gösteriliyor; belgede tamamı basılır.`}
        </p>
      ) : null}
    </div>
  );
}

export function BlockView({
  blok,
  readOnly,
  sources,
  gorseller,
  onDegis,
}: {
  blok: ManualBlock;
  readOnly: boolean;
  sources: ManualSourceData;
  gorseller: ReadonlyMap<string, OnizlemeGorsel>;
  onDegis: (f: (b: ManualBlock) => ManualBlock) => void;
}) {
  switch (blok.kind) {
    case "text":
      return (
        <div className="flex flex-col gap-1">
          {blok.margin !== undefined || !readOnly ? (
            <Input
              value={blok.margin ?? ""}
              readOnly={readOnly}
              aria-label="Kenar notu"
              placeholder="Kenar notu (isteğe bağlı)"
              className="h-7 max-w-56 border-dashed text-xs"
              onChange={(e) =>
                onDegis((b) => ({ ...b, margin: e.target.value || undefined }) as ManualBlock)
              }
            />
          ) : null}
          <OtoMetin
            ariaLabel="Paragraf"
            value={blok.text}
            readOnly={readOnly}
            placeholder="Bu bölümün metnini yazın"
            onChange={(v) => onDegis((b) => ({ ...b, text: v }) as ManualBlock)}
          />
        </div>
      );

    case "list":
      return (
        <div className="flex flex-col gap-1.5">
          {blok.items.map((m, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1 w-5 shrink-0 text-right text-xs text-muted-foreground">
                {blok.ordered ? `${i + 1}.` : "•"}
              </span>
              <OtoMetin
                ariaLabel={`${i + 1}. madde`}
                value={m}
                readOnly={readOnly}
                onChange={(v) =>
                  onDegis((b) => {
                    if (b.kind !== "list") return b;
                    const items = [...b.items];
                    items[i] = v;
                    return { ...b, items };
                  })
                }
              />
              {!readOnly ? (
                <button
                  type="button"
                  className="oc-tap shrink-0 text-muted-foreground"
                  aria-label={`${i + 1}. maddeyi sil`}
                  onClick={() =>
                    onDegis((b) =>
                      b.kind === "list" ? { ...b, items: b.items.filter((_, x) => x !== i) } : b
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly ? (
            <Button
              variant="ghost"
              size="sm"
              className="oc-tap self-start text-muted-foreground"
              onClick={() =>
                onDegis((b) => (b.kind === "list" ? { ...b, items: [...b.items, ""] } : b))
              }
            >
              <Plus className="size-3.5" /> Madde
            </Button>
          ) : null}
          {blok.result !== undefined || !readOnly ? (
            <div className="flex items-start gap-2 border-l-2 border-primary/40 pl-2">
              <span className="mt-0.5 text-xs text-muted-foreground">→</span>
              <OtoMetin
                ariaLabel="Sonuç satırı"
                value={blok.result ?? ""}
                readOnly={readOnly}
                placeholder="Beklenen sonuç (isteğe bağlı)"
                onChange={(v) =>
                  onDegis((b) => ({ ...b, result: v || undefined }) as ManualBlock)
                }
              />
            </div>
          ) : null}
        </div>
      );

    case "note":
      return (
        <div className="border-l-4 border-primary/70 bg-muted/40 p-2">
          <p className="text-xs font-semibold tracking-wide text-primary">
            {blok.title?.trim() || MANUAL_NOTE_LABELS[blok.level]}
          </p>
          <OtoMetin
            ariaLabel="Uyarı metni"
            value={blok.text}
            readOnly={readOnly}
            placeholder="Uyarının metnini yazın"
            onChange={(v) => onDegis((b) => ({ ...b, text: v }) as ManualBlock)}
          />
        </div>
      );

    case "table":
      return (
        <div className="flex flex-col gap-1">
          <TabloDuzenleyici
            table={blok.table}
            readOnly={readOnly}
            onDegis={(t) => onDegis((b) => ({ ...b, table: t }) as ManualBlock)}
          />
          <Input
            value={blok.table.caption ?? ""}
            readOnly={readOnly}
            aria-label="Tablo altyazısı"
            placeholder="Altyazı (isteğe bağlı)"
            className="h-7 border-dashed text-xs"
            onChange={(e) =>
              onDegis((b) =>
                b.kind === "table"
                  ? { ...b, table: { ...b.table, caption: e.target.value || undefined } }
                  : b
              )
            }
          />
        </div>
      );

    case "image": {
      const g = gorseller.get(blok.assetKey ?? blok.imageId ?? "");
      return (
        <figure className="flex flex-col gap-1">
          {g ? (
            <span
              className="relative block w-full max-w-md bg-muted"
              style={{ aspectRatio: `1 / ${g.oran}`, width: `${blok.widthPct ?? 100}%` }}
            >
              <Image
                src={g.url}
                alt={blok.caption ?? "Belge görseli"}
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-contain"
                unoptimized
              />
            </span>
          ) : (
            <p className="border border-dashed p-3 text-sm text-muted-foreground">
              Görselin kaydı bulunamadı — bu blok belgeye BASILMAZ.
            </p>
          )}
          <Input
            value={blok.caption ?? ""}
            readOnly={readOnly}
            aria-label="Görsel altyazısı"
            placeholder="Altyazı (isteğe bağlı)"
            className="h-7 max-w-md border-dashed text-xs"
            onChange={(e) =>
              onDegis((b) => ({ ...b, caption: e.target.value || undefined }) as ManualBlock)
            }
          />
        </figure>
      );
    }

    case "diagram":
      return (
        <figure className="flex flex-col gap-1">
          <span className="block max-w-md" style={{ width: `${blok.widthPct ?? 100}%` }}>
            <DiagramSvg diagram={blok.diagram as unknown as Diagram} className="w-full" themeAware />
          </span>
          <Input
            value={blok.caption ?? ""}
            readOnly={readOnly}
            aria-label="Şema altyazısı"
            placeholder="Altyazı (isteğe bağlı)"
            className="h-7 max-w-md border-dashed text-xs"
            onChange={(e) =>
              onDegis((b) => ({ ...b, caption: e.target.value || undefined }) as ManualBlock)
            }
          />
          <p className="text-xs text-muted-foreground">
            Hesap motorundan alınan şema · <code>{blok.diagramKey}</code>
          </p>
        </figure>
      );

    case "auto": {
      // TASLAKTA CANLI, YAYIMDA DONMUŞ (KITAP-7): burada da aynı çözücü
      // çağrılır, ikinci bir biçimleyici yazılmaz.
      const tablo = autoTableFor(blok, sources);
      return (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Kaynak: {MANUAL_AUTO_LABELS[blok.source]}
            {blok.frozen ? " · YAYIMDA DONDURULDU" : " · taslakta canlı"}
            {blok.variant ? ` · ${blok.variant}` : ""}
          </p>
          <TabloOnizleme table={tablo} />
        </div>
      );
    }
  }
}
