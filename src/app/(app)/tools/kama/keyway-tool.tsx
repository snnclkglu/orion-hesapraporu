"use client";

import { useMemo, useState } from "react";
import { KEYWAY_ROWS, findKeywayRows } from "@/lib/engineering-tools/keyways";
import { NumberField, parseMetricNumber } from "../number-field";

const format = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

export function KeywayTool() {
  const [diameter, setDiameter] = useState("");
  const numeric = parseMetricNumber(diameter);
  const rows = useMemo(() => numeric === undefined ? [] : findKeywayRows(numeric), [numeric]);

  return (
    <main className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <section className="grid h-fit gap-4 border bg-card p-4">
        <header><p className="oc-kicker text-muted-foreground">Mil çapından seçim</p><h2 className="text-lg font-semibold">Kama ölçüleri</h2></header>
        <NumberField id="keyway-diameter" label="Mil çapı" value={diameter} onChange={setDiameter} />
        <div aria-live="polite" className="min-h-32 border-l-4 border-primary bg-primary/[0.05] p-4">
          {numeric === undefined ? <p className="text-sm text-muted-foreground">Sonucu görmek için mil çapını girin.</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Bu çap kaynak tablodaki hiçbir aralığa girmiyor.</p> : <div className="grid gap-4">{rows.map((row) => <div key={`${row.shaftFromMm}-${row.shaftToMm}`} className="grid grid-cols-2 gap-3"><Metric label="Kama" value={`${format.format(row.keyWidthMm)} × ${format.format(row.keyHeightMm)} mm`} /><Metric label="Kanal genişliği W" value={`${format.format(row.keywayWidthMm)} mm`} /><Metric label="Kanal derinliği h" value={`${format.format(row.keywayDepthMm)} mm`} /><Metric label="Kaynak aralığı" value={`${row.shaftFromMm}–${row.shaftToMm} mm`} /></div>)}{rows.length > 1 && <p className="border-t pt-3 text-[12px] text-amber-700 dark:text-amber-300">Kaynak belge bu sınır ölçüsünü iki komşu satırda da veriyor. İmalat kararından önce seçilen standardı ayrıca doğrulayın.</p>}</div>}
        </div>
        <KeywayDiagram />
        <p className="text-[11px] leading-5 text-muted-foreground">Türkçe alan adları kullanıcının verdiği metrik tablodan çevrilmiştir. Belge bir standart numarası belirtmediği için sonuç standart adıyla etiketlenmez.</p>
      </section>

      <section className="overflow-hidden border bg-card">
        <div className="border-b px-4 py-3"><h2 className="font-semibold">Kaynak tablo</h2><p className="text-[12px] text-muted-foreground">Tüm ölçüler mm</p></div>
        <table className="oc-tablet-table oc-compact-mobile-table w-full text-sm">
          <thead className="bg-muted/45 text-left text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-2">Mil çapı</th><th className="px-3 py-2 text-right">Kanal W</th><th className="px-3 py-2 text-right">Kanal h</th><th className="px-3 py-2 text-right">Kama W × T</th></tr></thead>
          <tbody>{KEYWAY_ROWS.map((row) => <tr key={`${row.shaftFromMm}-${row.shaftToMm}`} className="border-t"><td data-label="Mil çapı" className="px-3 py-2 font-mono">{row.shaftFromMm}–{row.shaftToMm} mm</td><td data-label="Kanal W" className="px-3 py-2 text-right font-mono">{format.format(row.keywayWidthMm)}</td><td data-label="Kanal h" className="px-3 py-2 text-right font-mono">{format.format(row.keywayDepthMm)}</td><td data-label="Kama W × T" className="px-3 py-2 text-right font-mono">{format.format(row.keyWidthMm)} × {format.format(row.keyHeightMm)}</td></tr>)}</tbody>
        </table>
      </section>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string }) { return <div><span className="block text-[11px] text-muted-foreground">{label}</span><strong className="font-mono text-sm">{value}</strong></div>; }

function KeywayDiagram() {
  return <svg viewBox="0 0 280 150" className="h-auto w-full" role="img" aria-label="Kama ve kama kanalı ölçü şeması"><g fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground/75"><circle cx="82" cy="76" r="52" /><rect x="68" y="20" width="28" height="35" /><rect x="178" y="45" width="38" height="62" /><path d="M178 64h-45v24h45" /></g><g fill="currentColor" className="text-primary" fontFamily="monospace" fontSize="11"><text x="20" y="140">MİL + KANAL</text><text x="176" y="35">KAMA</text><text x="74" y="16">W</text><text x="104" y="46">h</text><text x="187" y="122">W</text><text x="220" y="79">T</text></g></svg>;
}
