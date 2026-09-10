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
        <KeywayDiagram widthMm={rows[0]?.keyWidthMm} heightMm={rows[0]?.keyHeightMm} depthMm={rows[0]?.keywayDepthMm} />
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

function KeywayDiagram({ widthMm, heightMm, depthMm }: { widthMm?: number; heightMm?: number; depthMm?: number }) {
  const label = (value?: number) => value === undefined ? "—" : format.format(value);
  return <div className="oc-scrollx overflow-x-auto border bg-background p-2"><svg viewBox="0 0 760 250" className="h-auto min-w-[720px] w-full" role="img" aria-label="Mil, göbek ve kama için üç görünüşlü ölçü şeması">
    <defs><pattern id="keyway-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" className="stroke-primary" strokeWidth="2" /></pattern><marker id="keyway-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L7,3.5 L0,7 z" className="fill-foreground" /></marker></defs>
    <g fill="none" stroke="currentColor" strokeWidth="1.7" className="text-foreground/80">
      <path d="M20 118 Q36 96 52 118 H264 Q280 96 296 118 V166 Q280 188 264 166 H52 Q36 188 20 166Z" />
      <path d="M72 75H244V118H72Z" fill="url(#keyway-hatch)" className="stroke-primary" />
      <rect x="118" y="75" width="78" height="43" className="fill-background" />
      <rect x="118" y="84" width="78" height="34" className="fill-muted stroke-foreground" />
      <circle cx="390" cy="140" r="74" /><rect x="370" y="66" width="40" height="50" className="fill-muted" />
      <path d="M370 66v50h40V66" /><path d="M316 140h148M390 66v148" strokeDasharray="5 5" className="stroke-muted-foreground" />
      <path d="M525 156 Q570 120 615 156V220H525Z" fill="url(#keyway-hatch)" className="stroke-primary" />
      <rect x="562" y="84" width="40" height="72" className="fill-muted stroke-foreground" />
      <path d="M562 84v72h40V84" />
      <g markerStart="url(#keyway-arrow)" markerEnd="url(#keyway-arrow)"><path d="M562 65H602"/><path d="M485 66V214"/><path d="M630 84V156"/><path d="M650 156V214"/></g>
    </g>
    <g fill="currentColor" fontFamily="monospace" fontSize="12" className="text-foreground"><text x="28" y="28">BOY KESİTİ</text><text x="335" y="28">MİL ALIN GÖRÜNÜŞÜ</text><text x="555" y="28">KAMA KESİTİ</text><text x="575" y="58">b = {label(widthMm)} mm</text><text x="467" y="145" transform="rotate(-90 467 145)">d</text><text x="616" y="124">t1 = {label(depthMm)}</text><text x="658" y="188">t2</text><text x="544" y="238">h = {label(heightMm)} mm</text><text x="106" y="211">Kama</text><text x="208" y="211">Göbek kesiti</text></g>
    <g fill="currentColor" fontSize="11" className="text-muted-foreground"><text x="326" y="232">d−t1 / d+t2 kotları imalat resminde birlikte kontrol edilir.</text></g>
  </svg></div>;
}
