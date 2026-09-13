"use client";

// 2 · PANOLAR — dizilim şeması, pano kartları, ölçü tercihleri.
//
// Eski Panolar tablosu uyarıyı bir ipucuna ("1 uyarı") saklıyordu ve iç
// yerleşime giden tek kapı pano koduydu. Kartta uyarı AÇIK METİNDİR ve her
// kartın kendi "İç yerleşim" düğmesi vardır. Tür/en/kapak seçicileri karttan
// yapılır; seçilen en KİLİTLENİR ve Kararlar bölümünde görünür (PANO-9 · PANO-40).

import Link from "next/link";
import { ArrowRight, CircleAlert, Lock, Save, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import { panoDizilimDiagram } from "@/lib/diagrams/panoLayout";
import { PANEL_WIDTHS_MM } from "@/lib/switchboard/sizes";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { PanelLayout, PanelOverride } from "@/lib/switchboard/types";
import { OlcuGrubu, Secici, SemaKabi, panoKarariYuku, sayi } from "../parcalar";

export function PanolarBolumu({
  projectId,
  canEdit,
  bekle,
  sonuc,
  kararMap,
  arama,
  onAdres,
  onKaydetOlcu,
  onPanoKarari,
  onKilitKaldir,
}: {
  projectId: string;
  canEdit: boolean;
  bekle: boolean;
  sonuc: ComputeResult;
  kararMap: Map<string, PanelOverride>;
  arama: string;
  onAdres: (anahtar: string, deger: string) => void;
  onKaydetOlcu: () => void;
  onPanoKarari: (yuk: ReturnType<typeof panoKarariYuku>, mesaj: string) => void;
  onKilitKaldir: (code: string) => void;
}) {
  const panolar = [...sonuc.room, ...sonuc.field];

  function icAdresi(kod: string): string {
    const p = new URLSearchParams(arama);
    p.set("pano", kod);
    return `/projects/${projectId}/pano/ic?${p.toString()}`;
  }

  return (
    <div className="grid gap-4">
      {/* ——————————————————————————— ölçü tercihleri */}
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {sonuc.room.length} oda panosu · {sonuc.field.length} saha panosu
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Toplam en {sayi(sonuc.room.reduce((t, p) => t + p.widthMm, 0))} mm (oda)
              {sonuc.field.length > 0 &&
                ` · ${sayi(sonuc.field.reduce((t, p) => t + p.widthMm, 0))} mm (saha)`}
              . Yükseklik, derinlik ve baza dizinin ortak kararıdır; “Otomatik” sistemin bulduğunu gösterir.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            {sonuc.roomSize.panelCount > 0 && (
              <OlcuGrubu
                baslik="Elektrik odası"
                onek="oda"
                tercih={sonuc.settings.room}
                cozulen={sonuc.roomSize}
                onChange={onAdres}
              />
            )}
            {sonuc.fieldSize.panelCount > 0 && (
              <OlcuGrubu
                baslik="Saha panoları"
                onek="saha"
                tercih={sonuc.settings.field}
                cozulen={sonuc.fieldSize}
                onChange={onAdres}
              />
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                disabled={bekle}
                onClick={onKaydetOlcu}
                title="Yükseklik / derinlik / baza seçimini projeye kaydeder. Onaylamaz."
                className="self-end"
              >
                <Save className="size-3.5" /> Ölçüleri Kaydet
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ——————————————————————————— dizilim şemaları */}
      {sonuc.room.length > 0 && (
        <SemaKabi>
          <DiagramSvg
            diagram={panoDizilimDiagram({
              panels: sonuc.room,
              baslik: "Pano dizilimi",
              not: `${sonuc.room.length} göz · ön görünüş · panolar bitişik`,
              yanCihazlar: sonuc.roomSideDevices,
            })}
            themeAware
          />
        </SemaKabi>
      )}
      {sonuc.field.length > 0 && (
        <SemaKabi>
          <DiagramSvg
            diagram={panoDizilimDiagram({
              panels: sonuc.field,
              baslik: "Saha panoları",
              not: `${sonuc.field.length} göz · elektrik odasına girmez`,
              yanCihazlar: sonuc.fieldSideDevices,
            })}
            themeAware
          />
        </SemaKabi>
      )}

      {/* ——————————————————————————— pano kartları */}
      <section className="grid gap-3 md:grid-cols-2">
        {panolar.map((p) => (
          <PanoKarti
            key={p.code}
            p={p}
            karar={kararMap.get(p.code)}
            canEdit={canEdit}
            bekle={bekle}
            icAdresi={icAdresi(p.code)}
            onPanoKarari={onPanoKarari}
            onKilitKaldir={onKilitKaldir}
          />
        ))}
      </section>
      <p className="text-xs text-muted-foreground">
        Elle seçilen bir en KİLİTLENİR: “Yeniden Yerleştir” onu ezmez, kilitli pano bölünmez.
        Kilitler Kararlar bölümünde listelenir ve oradan kaldırılır.
      </p>
    </div>
  );
}

function PanoKarti({
  p,
  karar,
  canEdit,
  bekle,
  icAdresi,
  onPanoKarari,
  onKilitKaldir,
}: {
  p: PanelLayout;
  karar: PanelOverride | undefined;
  canEdit: boolean;
  bekle: boolean;
  icAdresi: string;
  onPanoKarari: (yuk: ReturnType<typeof panoKarariYuku>, mesaj: string) => void;
  onKilitKaldir: (code: string) => void;
}) {
  const tasiyor = p.warnings.some((w) => w.includes("plakada"));
  return (
    <article
      className={`rounded-lg border bg-card p-4 ${tasiyor ? "border-destructive/50" : ""}`}
      aria-label={`${p.code} panosu`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-semibold">{p.code}</span>
          {p.splitOf && (
            <Badge variant="outline" className="text-[10px]">
              {p.splitOf} bölündü
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {p.kind === "saha" ? "Saha" : "Oda"}
          </Badge>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={icAdresi}>
            İç yerleşim <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <p className="mt-1 font-mono text-sm">
        {sayi(p.widthMm)} × {sayi(p.heightMm)} × {sayi(p.depthMm)} mm
        <span className="ml-2 text-xs text-muted-foreground">
          baza {sayi(p.baseMm)} · {p.doorConfig === "cift" ? "çift kapak" : "tek kapak"}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {p.rails.length} ray · {p.placements.length} cihaz plakada · {p.bodyDevices.length + p.sideDevices.length} gövde/yan ·
        ray kullanımı %{Math.round(p.fillRatio * 100)}
      </p>

      {p.warnings.length > 0 && (
        <ul className="mt-2 grid gap-0.5 text-xs text-amber-700 dark:text-amber-400">
          {p.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-3 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
        <label className="grid gap-1 text-muted-foreground">
          Tür
          <Secici
            deger={p.kind}
            secenekler={[
              ["oda", "Oda"],
              ["saha", "Saha"],
              ["haric", "Pano değil"],
            ]}
            etiket={`${p.code} türü`}
            pasif={!canEdit || bekle}
            onChange={(v) =>
              onPanoKarari(
                panoKarariYuku(p.code, karar, { kind: (v || null) as "oda" | "saha" | "haric" | null }),
                "Pano türü değişti."
              )
            }
          />
        </label>
        <label className="grid gap-1 text-muted-foreground">
          En
          <div className="flex items-center gap-1">
            <Secici
              deger={p.widthLocked ? String(p.widthMm) : ""}
              bosEtiket={`${sayi(p.widthMm)} (otomatik)`}
              secenekler={PANEL_WIDTHS_MM.map((w) => [String(w), `${sayi(w)} mm`])}
              etiket={`${p.code} eni`}
              pasif={!canEdit || bekle}
              onChange={(v) =>
                onPanoKarari(
                  panoKarariYuku(p.code, karar, { widthMm: v ? Number(v) : null }),
                  v ? "Pano eni kilitlendi." : "Pano eni serbest bırakıldı."
                )
              }
            />
            {p.widthLocked && canEdit ? (
              <button
                type="button"
                title="Kilidi kaldır — eni sistem seçsin"
                className="oc-tap-square text-muted-foreground hover:text-foreground"
                onClick={() => onKilitKaldir(p.code)}
              >
                <Lock className="size-3.5" />
              </button>
            ) : (
              <Unlock className="size-3.5 shrink-0 text-muted-foreground/50" />
            )}
          </div>
        </label>
        <label className="grid gap-1 text-muted-foreground">
          Kapak
          <Secici
            deger={p.doorConfig}
            secenekler={[
              ["tek", "Tek"],
              ["cift", "Çift"],
            ]}
            etiket={`${p.code} kapağı`}
            pasif={!canEdit || bekle || p.widthMm < 600}
            onChange={(v) =>
              onPanoKarari(
                panoKarariYuku(p.code, karar, { doorConfig: (v || null) as "tek" | "cift" | null }),
                "Kapak seçimi değişti."
              )
            }
          />
        </label>
      </div>
    </article>
  );
}
