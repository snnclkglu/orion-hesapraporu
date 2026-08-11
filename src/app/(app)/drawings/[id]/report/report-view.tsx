"use client";

// İçe aktarım raporunun gövdesi — arama ve "onaylananları gizle".
//
// BÖLÜMLER SABİT SIRALIDIR ve BOŞ BÖLÜM DE BASILIR: dönen kullanıcı nereye
// bakacağını bilmelidir ve bir bölümün yokluğu ile boş olması aynı şey
// değildir. Arama bölümleri gizlemez, yalnız içlerini süzer.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FINDING_SECTIONS, formatNum } from "@/lib/drawings/labels";
import type { FindingRow } from "../../data";
import { matchesFinding } from "../../filters";
import { SearchBox } from "../../sortable-head";
import { FindingRow as FindingSatiri } from "./finding-row";

export function ReportView({
  packageId,
  findings,
  ackedKeys,
  canWrite,
}: {
  packageId: string;
  findings: FindingRow[];
  ackedKeys: string[];
  canWrite: boolean;
}) {
  const [arama, setArama] = useState("");
  const [onaylananlariGizle, setOnaylananlariGizle] = useState(false);
  const onaylar = useMemo(() => new Set(ackedKeys), [ackedKeys]);

  const gorunen = useMemo(
    () =>
      findings.filter((b) => {
        if (onaylananlariGizle && onaylar.has(`${b.code}|${b.subject}`)) return false;
        return matchesFinding(b, arama);
      }),
    [findings, arama, onaylananlariGizle, onaylar]
  );

  return (
    <div className="grid gap-4">
      <div className="oc-scrollx flex flex-wrap items-center gap-2 border bg-card px-3 py-2 [--oc-scroll-bg:var(--card)]">
        <SearchBox
          value={arama}
          onChange={setArama}
          placeholder="Bulgu Kodu, Parça, Dosya Ara…"
          className="w-[min(22rem,calc(100vw-4rem))]"
        />
        <Button
          type="button"
          variant={onaylananlariGizle ? "default" : "outline"}
          size="xs"
          onClick={() => setOnaylananlariGizle((v) => !v)}
        >
          Onaylananları gizle
        </Button>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {gorunen.length === findings.length
            ? `${formatNum(findings.length)} bulgu`
            : `${formatNum(gorunen.length)} / ${formatNum(findings.length)} bulgu`}
        </span>
      </div>

      {FINDING_SECTIONS.map((bolum) => {
        const liste = gorunen.filter((b) => b.kind === bolum.kind);
        const toplam = findings.filter((b) => b.kind === bolum.kind).length;
        return (
          <section key={bolum.kind} className="border bg-card">
            <header className="border-b bg-muted/40 px-4 py-2.5">
              <h2 className="flex items-baseline gap-2 text-sm font-medium">
                {bolum.title}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {liste.length === toplam
                    ? formatNum(toplam)
                    : `${formatNum(liste.length)} / ${formatNum(toplam)}`}
                </span>
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{bolum.hint}</p>
            </header>

            {liste.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {toplam === 0 ? "Bu bölümde bir şey yok." : "Bu süzgeçle eşleşen bulgu yok."}
              </p>
            ) : (
              <ul className="divide-y">
                {liste.map((b) => (
                  <FindingSatiri
                    key={b.id}
                    packageId={packageId}
                    code={b.code}
                    kind={b.kind}
                    subject={b.subject}
                    title={b.title}
                    detail={b.detail}
                    hintId={b.hint_id}
                    acked={onaylar.has(`${b.code}|${b.subject}`)}
                    canWrite={canWrite}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
