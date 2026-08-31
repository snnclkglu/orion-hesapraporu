"use client";

// BELGE HARİTASI — sol panel.
//
// KITAP-19'un "sol ray yalnız ANA bölümleri gösterir" kararı GERİ ALINDI
// (kullanıcı kararı, 30.08.2026). O karar seksen beş satırlık düz bir ağacın
// çalışma yüzü olmadığını doğru tespit etmişti ama çözümü yanlıştı: alt
// bölümleri orta alandaki ikinci bir seçiciye taşımak, kullanıcıyı belgenin
// neresinde olduğunu iki ayrı listeden çıkarmaya zorluyordu.
//
// ÇÖZÜM AĞACI KISALTMAK DEĞİL, SÜZMEKTİR: ağaç bütün hâliyle durur; arama ve
// "yalnız eksikler" onu o anda yapılacak işe indirger. Ana bölümler
// katlanabilir ve seçili olanın yolu her zaman AÇIKTIR — kullanıcı aradığı
// bölümü kapalı bir dalın içinde kaybetmez.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { manualFillState } from "@/lib/manual/guide";
import { trKatla } from "@/lib/drawings/tr-text";
import { cn } from "@/lib/utils";
import type { NumberedSection } from "@/lib/manual/payload";

/** Bölümün doluluk noktası — renk değil ŞEKİL de taşır (renk körlüğü). */
function Nokta({ durum }: { durum: ReturnType<typeof manualFillState> }) {
  const stil: Record<string, string> = {
    dolu: "bg-primary",
    bos: "border border-muted-foreground/60 bg-transparent",
    gizli: "bg-muted-foreground/40",
    ek: "bg-muted-foreground/70",
  };
  const ad: Record<string, string> = {
    dolu: "Dolu",
    bos: "Boş — vince özel bilgi bekliyor",
    gizli: "Gizli — belgeye girmez",
    ek: "Ek",
  };
  return (
    <span
      aria-label={ad[durum]}
      title={ad[durum]}
      className={cn("mt-1.5 size-2 shrink-0 rounded-full", stil[durum])}
    />
  );
}

export function DocumentMap({
  numarali,
  seciliId,
  eksikKimlikleri,
  yazilabilir,
  onSec,
  onGizle,
}: {
  numarali: NumberedSection[];
  seciliId: string;
  eksikKimlikleri: Set<string>;
  yazilabilir: boolean;
  onSec: (id: string) => void;
  onGizle: (id: string) => void;
}) {
  const [arama, setArama] = useState("");
  const [yalnizEksik, setYalnizEksik] = useState(false);
  const [kapali, setKapali] = useState<Set<string>>(new Set());

  const katlanmisArama = trKatla(arama);

  /** Seçili bölümün kök atası — o dal her zaman açık kalır. */
  const seciliKok = useMemo(() => {
    const gez = (liste: NumberedSection[], kok: string): string | null => {
      for (const s of liste) {
        if (s.id === seciliId) return kok;
        const alt = gez(s.children, kok);
        if (alt) return alt;
      }
      return null;
    };
    for (const kok of numarali) {
      const bulundu = gez([kok], kok.id);
      if (bulundu) return bulundu;
    }
    return null;
  }, [numarali, seciliId]);

  /**
   * Süzülmüş ağaç. Bir bölüm ya KENDİSİ uyar ya da uyan bir çocuğu vardır —
   * ikincisi olmasaydı arama, aranan başlığın üst bölümlerini de gizler ve
   * kullanıcı sonucu bağlamsız görürdü.
   */
  const suz = (s: NumberedSection): NumberedSection | null => {
    const cocuklar = s.children.map(suz).filter((c): c is NumberedSection => c !== null);
    const adUyar = !katlanmisArama || trKatla(`${s.number} ${s.title}`).includes(katlanmisArama);
    const eksikUyar = !yalnizEksik || eksikKimlikleri.has(s.id);
    if ((adUyar && eksikUyar) || cocuklar.length > 0) return { ...s, children: cocuklar };
    return null;
  };
  const agac = numarali.map(suz).filter((s): s is NumberedSection => s !== null);

  const satir = (s: NumberedSection, derinlik: number) => {
    const secili = s.id === seciliId;
    const cocukVar = s.children.length > 0;
    // Arama açıkken dallar AÇIK gelir: kullanıcı sonucu görmek için ayrıca
    // dal açmak zorunda kalmamalı.
    const acik =
      Boolean(katlanmisArama) || yalnizEksik || !kapali.has(s.id) || seciliKok === s.id;
    const durum = manualFillState(s);

    return (
      <li key={s.id}>
        <div
          className={cn(
            "group flex items-start gap-1.5 border-l-2 pr-1 transition-colors",
            secili
              ? "border-l-primary bg-muted"
              : "border-l-transparent hover:bg-muted/60"
          )}
          style={{ paddingLeft: `${derinlik * 12 + 4}px` }}
        >
          {cocukVar ? (
            <button
              type="button"
              className="oc-tap mt-0.5 shrink-0 text-muted-foreground"
              aria-label={acik ? "Dalı kapat" : "Dalı aç"}
              aria-expanded={acik}
              onClick={() =>
                setKapali((k) => {
                  const y = new Set(k);
                  if (y.has(s.id)) y.delete(s.id);
                  else y.add(s.id);
                  return y;
                })
              }
            >
              {acik ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}

          <Nokta durum={durum} />

          <button
            type="button"
            onClick={() => onSec(s.id)}
            aria-current={secili ? "true" : undefined}
            className={cn(
              "oc-tap min-w-0 flex-1 py-1.5 text-left text-sm",
              s.hidden && "text-muted-foreground line-through decoration-muted-foreground/50",
              secili && "font-medium"
            )}
          >
            <span className="font-mono text-xs text-muted-foreground">{s.number || "—"}</span>{" "}
            {s.title}
          </button>

          {yazilabilir && !s.appendix ? (
            <button
              type="button"
              className="oc-tap mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              aria-label={s.hidden ? "Belgeye geri al" : "Belgeden gizle"}
              title={s.hidden ? "Belgeye geri al" : "Belgeden gizle"}
              onClick={() => onGizle(s.id)}
            >
              {s.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          ) : null}
        </div>

        {cocukVar && acik ? (
          <ul>{s.children.map((c) => satir(c, derinlik + 1))}</ul>
        ) : null}
      </li>
    );
  };

  const eksikSayisi = eksikKimlikleri.size;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Bölüm ara"
          aria-label="Bölüm ara"
          className="pl-7 pr-7"
        />
        {arama ? (
          <button
            type="button"
            className="oc-tap absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label="Aramayı temizle"
            onClick={() => setArama("")}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <Button
        variant={yalnizEksik ? "secondary" : "outline"}
        size="sm"
        className="oc-tap justify-start"
        aria-pressed={yalnizEksik}
        disabled={eksikSayisi === 0 && !yalnizEksik}
        onClick={() => setYalnizEksik((v) => !v)}
      >
        Yalnız eksikler{eksikSayisi > 0 ? ` (${eksikSayisi})` : ""}
      </Button>

      <nav aria-label="Belge haritası" className="min-h-0 flex-1 overflow-y-auto">
        {agac.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {yalnizEksik ? "Bekleyen vince özel bölüm yok." : "Aramaya uyan bölüm yok."}
          </p>
        ) : (
          <ul>{agac.map((s) => satir(s, 0))}</ul>
        )}
      </nav>
    </div>
  );
}
