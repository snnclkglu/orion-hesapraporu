"use client";

// Rapor satırı — onaylama ve tanınmayanı elle bağlama.
//
// TABLO DEĞİL BLOK. AGENTS'ın "sütun önceliklendir, kart markup'ı çoğaltma"
// kuralı TABLOLAR hakkındadır: orada aynı veriyi iki kez yazmak sıralama
// mantığını ikiye böler. Bulgu ise değişken uzunlukta bir metindir ve HER
// GENİŞLİKTE bloktur — tek markup, kopya yok.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findingChipClass } from "@/lib/drawings/labels";
import type { FindingKind } from "@/lib/drawings/types";
import { ackFinding, bindAlias } from "../../actions";

export function FindingRow({
  packageId,
  code,
  kind,
  subject,
  title,
  detail,
  hintId,
  acked,
  canWrite,
}: {
  packageId: string;
  code: string;
  kind: FindingKind;
  subject: string;
  title: string;
  detail: string;
  hintId: string;
  acked: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [kod, setKod] = useState("");

  function onayla() {
    basla(async () => {
      const sonuc = await ackFinding({ packageId, code, subject });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Onaylandı.");
        router.refresh();
      }
    });
  }

  function bagla() {
    const hedef = kod.trim();
    if (!hedef) {
      toast.error("Bağlanacak parça kodunu yazın.");
      return;
    }
    basla(async () => {
      const sonuc = await bindAlias({ packageId, scope: "dosya", pattern: subject, resolvesTo: hedef });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Bağlandı ve hatırlandı — sonraki pakette kendiliğinden çözülecek.");
        router.refresh();
      }
    });
  }

  return (
    <li className={"grid gap-1.5 px-4 py-3" + (acked ? " opacity-55" : "")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`border px-1.5 py-0.5 font-mono text-[11px] uppercase ${findingChipClass(kind)}`}>
          {code}
        </span>
        {hintId && (
          <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {hintId}
          </span>
        )}
        {acked && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Check className="size-3" /> onaylandı
          </span>
        )}
      </div>

      <p className="text-sm">{title}</p>
      {detail && <p className="text-[12px] text-muted-foreground">{detail}</p>}
      {subject && (
        <p className="truncate font-mono text-[11px] text-muted-foreground/80" title={subject}>
          {subject}
        </p>
      )}

      {canWrite && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {code === "TANINMADI" && (
            <>
              <Input
                value={kod}
                onChange={(e) => setKod(e.target.value)}
                className="h-8 w-[min(16rem,calc(100vw-4rem))] font-mono"
              />
              <Button type="button" size="xs" variant="outline" onClick={bagla} disabled={calisiyor}>
                {calisiyor ? <Loader2 className="size-3 animate-spin" /> : null}
                Bu koda bağla
              </Button>
            </>
          )}
          {!acked && (
            <Button type="button" size="xs" variant="ghost" onClick={onayla} disabled={calisiyor}>
              Onayla
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
