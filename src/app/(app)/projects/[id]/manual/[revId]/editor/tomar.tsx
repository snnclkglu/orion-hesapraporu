"use client";

// TOMAR — orta panel, belgenin sürekli çalışma yüzü.
//
// SEÇİLEN BÖLÜMÜN BÜTÜN ALT AĞACI GÖRÜNÜR. Eski editör bir seferde tek bir
// yaprak bölüm gösteriyordu; "4 Kullanım"ı açan kullanıcı on dört alt bölümü
// tek tek dolaşmak zorundaydı ve aralarındaki bağı hiç görmüyordu. Burada ana
// bölümü seçmek BÖLÜMÜN TAMAMINI açar; bir alt bölümü seçmek yalnız onu.
//
// SAYFALAMA YOK: "kaç yaprak tutuyor" Kâğıt modunun işidir (KITAP-19'un
// "ekran ve PDF aynı dağıtımı okur" kuralı orada geçerlidir). Tomar'ın işi
// "ne yazdığımı görüyorum"dur.

import { Fragment } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RotateCcw,
  Sigma,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { manualSectionGuide } from "@/lib/manual/guide";
import type { ManualBlock, ManualSection } from "@/lib/manual/types";
import type { ManualSourceData } from "@/lib/manual/sources";
import type { NumberedSection } from "@/lib/manual/payload";
import type { OnizlemeGorsel } from "@/components/manual/manual-paper";
import { cn } from "@/lib/utils";
import { BlockView } from "./block-view";
import { SlashMenu, type SnippetSecenegi } from "./slash-menu";

/** Başlık ölçüsü derinlikten gelir — belgedeki hiyerarşinin aynısı. */
const BASLIK_STILI: Record<number, string> = {
  1: "text-xl font-semibold",
  2: "text-base font-semibold",
  3: "text-sm font-semibold",
  4: "text-sm font-medium uppercase tracking-wide",
};

export interface TomarEylemleri {
  onBolumSec: (id: string) => void;
  onBaslik: (id: string, v: string) => void;
  onBolumGizle: (id: string) => void;
  onBlokSec: (id: string | null) => void;
  onBlokDegis: (bolumId: string, blokId: string, f: (b: ManualBlock) => ManualBlock) => void;
  onBlokEkle: (bolumId: string, index: number, blok: ManualBlock) => void;
  onBlokSil: (bolumId: string, blokId: string) => void;
  onBlokTasi: (bolumId: string, blokId: string, yon: "yukari" | "asagi") => void;
  onBlokGizle: (bolumId: string, blokId: string) => void;
  onStandardaDon: (bolumId: string, blokId: string) => void;
  onKaynaktanTazele: (bolumId: string, blokId: string) => void;
  onDeftereKaydet: (bolum: ManualSection, blok: ManualBlock) => void;
  onGorselEkle: (bolumId: string, index: number) => void;
  onSemaEkle: (bolumId: string, index: number) => void;
  onPaftaEkle: (bolumId: string, index: number) => void;
  onKatalogEkle: (bolumId: string, index: number) => void;
}

function BlokRozeti({ blok }: { blok: ManualBlock }) {
  if (blok.derived) {
    return (
      <Badge variant="secondary" className="h-5 text-[11px]">
        {blok.edited ? "Kaynaktan · düzenlendi" : "Kaynaktan üretildi"}
      </Badge>
    );
  }
  if (blok.fromTemplate) {
    return (
      <Badge variant="outline" className="h-5 text-[11px]">
        {blok.edited ? "Standarttan ayrıldı" : "Standart metin"}
      </Badge>
    );
  }
  return null;
}

export function Tomar({
  kok,
  seciliBlokId,
  yazilabilir,
  sources,
  gorseller,
  parcalar,
  eylem,
}: {
  /** Gösterilecek alt ağacın kökü (numaralanmış). */
  kok: NumberedSection;
  seciliBlokId: string | null;
  yazilabilir: boolean;
  sources: ManualSourceData;
  gorseller: ReadonlyMap<string, OnizlemeGorsel>;
  parcalar: readonly SnippetSecenegi[];
  eylem: TomarEylemleri;
}) {
  const bolumYaz = (s: NumberedSection) => {
    const rehber = manualSectionGuide(s);
    const bosluk = s.blocks.length === 0;

    return (
      <section
        key={s.id}
        id={`tomar-${s.id}`}
        className={cn("flex flex-col gap-2", s.hidden && "opacity-55")}
      >
        {/* ————————————————————————————————————————————— başlık */}
        <div className="group flex items-start gap-2 pt-2">
          <span className="mt-1 shrink-0 font-mono text-xs text-muted-foreground">
            {s.number || "EK"}
          </span>
          <input
            value={s.title}
            readOnly={!yazilabilir}
            aria-label={`${s.number} başlığı`}
            onFocus={() => eylem.onBolumSec(s.id)}
            onChange={(e) => eylem.onBaslik(s.id, e.target.value)}
            className={cn(
              "min-w-0 flex-1 border-0 bg-transparent p-0 focus-visible:outline-none",
              BASLIK_STILI[Math.min(s.depth, 4)],
              s.hidden && "line-through decoration-muted-foreground/50"
            )}
          />
          {yazilabilir && !s.appendix ? (
            <button
              type="button"
              className="oc-tap mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              aria-label={s.hidden ? "Belgeye geri al" : "Belgeden gizle"}
              onClick={() => eylem.onBolumGizle(s.id)}
            >
              {s.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          ) : null}
        </div>

        {/* Rehber yalnız BOŞ bölümde görünür: dolu bir bölümde ne yapılacağını
            söylemek, kullanıcının zaten yaptığı işi tekrar anlatmaktır. */}
        {bosluk || rehber.tone === "doldur" ? (
          <p className="border-l-2 border-muted-foreground/30 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
            {rehber.text}
            {rehber.note ? <span className="mt-1 block font-medium">{rehber.note}</span> : null}
          </p>
        ) : null}

        {/* ————————————————————————————————————————————— bloklar */}
        {s.appendix ? (
          <p className="border border-dashed p-3 text-xs text-muted-foreground">
            {"Bu bir EK'tir. Gövdede yalnız ayraç kapağı basılır; belgenin kendisi «Tam Sürüm» indirilirken kapağın ardına eklenir."}
          </p>
        ) : (
          <>
            {yazilabilir ? (
              <SlashMenu
                parcalar={parcalar}
                bolumKey={s.key}
                etiket="Başa blok ekle"
                tetikSinifi="opacity-0 focus-within:opacity-100 hover:opacity-100 pointer-coarse:opacity-100"
                gorselEkle={() => eylem.onGorselEkle(s.id, 0)}
                semaEkle={() => eylem.onSemaEkle(s.id, 0)}
                paftaEkle={() => eylem.onPaftaEkle(s.id, 0)}
                katalogEkle={() => eylem.onKatalogEkle(s.id, 0)}
                onEkle={(b) => eylem.onBlokEkle(s.id, 0, b)}
              />
            ) : null}

            {s.blocks.map((b, i) => {
              const secili = b.id === seciliBlokId;
              return (
                <Fragment key={b.id}>
                  <div
                    className={cn(
                      "group relative border-l-2 pl-3 transition-colors",
                      secili ? "border-l-primary" : "border-l-transparent hover:border-l-border",
                      b.hidden && "opacity-55"
                    )}
                    onFocusCapture={() => {
                      eylem.onBolumSec(s.id);
                      eylem.onBlokSec(b.id);
                    }}
                    onClick={() => eylem.onBlokSec(b.id)}
                  >
                    <div className="mb-1 flex items-center gap-1">
                      <BlokRozeti blok={b} />
                      {b.hidden ? (
                        <Badge variant="outline" className="h-5 text-[11px]">
                          Gizli
                        </Badge>
                      ) : null}
                      {yazilabilir ? (
                        <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
                          {b.derived ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="oc-tap size-7"
                              aria-label="Kaynaktan tazele"
                              title="Kaynaktan tazele — düzenlemeniz gider, kaynak geri gelir"
                              onClick={() => eylem.onKaynaktanTazele(s.id, b.id)}
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          ) : null}
                          {b.fromTemplate && b.edited ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="oc-tap size-7"
                              aria-label="Standarda dön"
                              title="Standarda dön"
                              onClick={() => eylem.onStandardaDon(s.id, b.id)}
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="oc-tap size-7"
                            aria-label="Deftere kaydet"
                            title="Bu bloğu metin parçaları defterine kaydet"
                            onClick={() => eylem.onDeftereKaydet(s, b)}
                          >
                            <Sigma className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="oc-tap size-7"
                            aria-label="Yukarı taşı"
                            disabled={i === 0}
                            onClick={() => eylem.onBlokTasi(s.id, b.id, "yukari")}
                          >
                            <ChevronUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="oc-tap size-7"
                            aria-label="Aşağı taşı"
                            disabled={i === s.blocks.length - 1}
                            onClick={() => eylem.onBlokTasi(s.id, b.id, "asagi")}
                          >
                            <ChevronDown className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="oc-tap size-7"
                            aria-label={b.hidden ? "Belgeye geri al" : "Belgeden gizle"}
                            onClick={() => eylem.onBlokGizle(s.id, b.id)}
                          >
                            {b.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="oc-tap size-7 text-destructive"
                            aria-label="Bloğu sil"
                            onClick={() => eylem.onBlokSil(s.id, b.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </span>
                      ) : null}
                    </div>

                    <BlockView
                      blok={b}
                      readOnly={!yazilabilir}
                      sources={sources}
                      gorseller={gorseller}
                      onDegis={(f) => eylem.onBlokDegis(s.id, b.id, f)}
                    />
                  </div>

                  {yazilabilir ? (
                    <SlashMenu
                      parcalar={parcalar}
                      bolumKey={s.key}
                      etiket="Blok ekle"
                      tetikSinifi="opacity-0 focus-within:opacity-100 hover:opacity-100 pointer-coarse:opacity-100"
                      gorselEkle={() => eylem.onGorselEkle(s.id, i + 1)}
                      semaEkle={() => eylem.onSemaEkle(s.id, i + 1)}
                      paftaEkle={() => eylem.onPaftaEkle(s.id, i + 1)}
                      katalogEkle={() => eylem.onKatalogEkle(s.id, i + 1)}
                      onEkle={(nb) => eylem.onBlokEkle(s.id, i + 1, nb)}
                    />
                  ) : null}
                </Fragment>
              );
            })}
          </>
        )}

        {s.children.map(bolumYaz)}
      </section>
    );
  };

  return <div className="flex flex-col gap-4">{bolumYaz(kok)}</div>;
}
