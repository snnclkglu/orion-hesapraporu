"use client";

import { useState } from "react";
import {
  BOLT_ROWS,
  calculateBoltTorque,
  eurocodeMinimumSpacing,
  recommendBoltLength,
} from "@/lib/engineering-tools/bolts";
import { NumberField, parseMetricNumber } from "../number-field";

const fmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

export function BoltTool() {
  const [code, setCode] = useState("M16");
  const [friction, setFriction] = useState("0,14");
  const [grip, setGrip] = useState("30");
  const [washers, setWashers] = useState<0 | 1 | 2>(2);
  const row = BOLT_ROWS.find((item) => item.designation === code)!;
  const mu = parseMetricNumber(friction);
  const gripMm = parseMetricNumber(grip);
  const validMu = typeof mu === "number" && mu >= 0.06 && mu <= 0.3;
  const torques = validMu
    ? {
        g88: calculateBoltTorque(row, "8.8", mu),
        g109: calculateBoltTorque(row, "10.9", mu),
      }
    : null;
  const length =
    typeof gripMm === "number" && gripMm > 0
      ? recommendBoltLength(row, gripMm, washers)
      : null;
  const spacing = eurocodeMinimumSpacing(row.clearanceMm.medium);

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-sm">
            Cıvata
            <select className="h-10 border bg-background px-3" value={code} onChange={(event) => setCode(event.target.value)}>
              {BOLT_ROWS.map((item) => <option key={item.designation}>{item.designation}</option>)}
            </select>
          </label>
          <NumberField id="bolt-friction" label="Sürtünme katsayısı μ" value={friction} onChange={setFriction} unit="" />
          <NumberField id="bolt-grip" label="Sıkıştırılan kalınlık" value={grip} onChange={setGrip} />
          <label className="grid gap-1 text-sm">
            Pul adedi
            <select className="h-10 border bg-background px-3" value={washers} onChange={(event) => setWashers(Number(event.target.value) as 0 | 1 | 2)}>
              <option value={0}>0</option><option value={1}>1</option><option value={2}>2</option>
            </select>
          </label>
        </div>
        {!validMu ? <p className="text-sm text-destructive">Sürtünme katsayısını 0,06 ile 0,30 arasında girin.</p> : null}
        {typeof gripMm === "number" && gripMm <= 0 ? <p className="text-sm text-destructive">Sıkıştırılan kalınlık sıfırdan büyük olmalıdır.</p> : null}
      </section>

      <section className="border bg-card">
        <div className="border-b p-4"><h3 className="font-semibold">{row.designation} hızlı başvuru satırı</h3></div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4 lg:grid-cols-7">
          <Metric label="Hatve" value={`${row.pitchMm} mm`} />
          <Metric label="Kılavuz matkabı" value={`${row.tapDrillMm} mm`} />
          <Metric label="Gerilme kesiti As" value={`${row.stressAreaMm2} mm²`} />
          <Metric label="ISO 273 ince" value={`${row.clearanceMm.fine} mm`} />
          <Metric label="ISO 273 orta" value={`${row.clearanceMm.medium} mm`} />
          <Metric label="ISO 273 kaba" value={`${row.clearanceMm.coarse} mm`} />
          <Metric label="Anahtar ağzı" value={`${row.wrenchMm} mm`} />
          <Metric label="DIN 974-1 yuva Ø" value={row.socketCounterboreMm ? `${row.socketCounterboreMm} mm` : "—"} />
          <Metric label="ISO 4032 somun h" value={`${row.nutHeightMm} mm`} />
          <Metric label="Pul iç × dış × t" value={`${row.washer.innerMm} × ${row.washer.outerMm} × ${row.washer.thicknessMm} mm`} />
          <Metric label="8.8 tork / ön yük" value={torques ? `${fmt.format(torques.g88.torqueNm)} Nm / ${fmt.format(torques.g88.preloadKn)} kN` : "—"} />
          <Metric label="10.9 tork / ön yük" value={torques ? `${fmt.format(torques.g109.torqueNm)} Nm / ${fmt.format(torques.g109.preloadKn)} kN` : "—"} />
          <Metric label="Önerilen boy" value={length?.recommendedMm ? `${code}×${length.recommendedMm}` : "—"} />
          <Metric label="Gerekli en az boy" value={length ? `${fmt.format(length.requiredMm)} mm` : "—"} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="border bg-card p-4">
          <h3 className="font-semibold">EN 1993-1-8 bağlantı levhası ön seçimi</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">Orta seri yuvarlak delik d₀ = {row.clearanceMm.medium} mm için 2005 Tablo 3.3 katsayıları</p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="e1 uç mesafesi" value={`≥ ${fmt.format(spacing.e1Mm)} mm`} />
            <Metric label="e2 kenar mesafesi" value={`≥ ${fmt.format(spacing.e2Mm)} mm`} />
            <Metric label="p1 yük doğrultusu" value={`≥ ${fmt.format(spacing.p1Mm)} mm`} />
            <Metric label="p2 enine aralık" value={`≥ ${fmt.format(spacing.p2Mm)} mm`} />
          </dl>
          <BoltSpacingDiagram />
        </div>
        <div className="border bg-card p-4">
          <h3 className="font-semibold">EN 14399 HV takım notu</h3>
          {row.diameterMm >= 12 && row.diameterMm <= 36 ? (
            <div className="mt-3 border-l-4 border-primary bg-primary/5 p-3">
              <strong>{row.designation} çapı HV takım aralığındadır.</strong>
              <p className="mt-1 text-sm text-muted-foreground">10.9/10 cıvata-somun takımı ve uyumlu EN 14399 rondelaları birlikte seçilir. Boy önerisi yalnız ön seçimdir; üretici kavrama boyu tablosuyla doğrulanır.</p>
            </div>
          ) : <p className="mt-3 text-sm text-muted-foreground">Bu çap EN 14399 HV takımının M12–M36 kapsamı dışında.</p>}
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">Tork hesabı hedef akma dayanımının %70’i ve aynı diş/baş altı sürtünmesi kabulüyle referans değer verir. Kaplama, yağlama, sıkma yöntemi ve takım saçılımı proje hesabında ayrıca belirlenir.</p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-card p-3"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-sm font-semibold">{value}</dd></div>;
}

function BoltSpacingDiagram() {
  return (
    <svg viewBox="0 0 420 190" className="mt-4 w-full border bg-background" role="img" aria-label="Cıvata uç, kenar ve aralık ölçüleri">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="40" y="25" width="340" height="140" /><circle cx="120" cy="75" r="12" /><circle cx="230" cy="75" r="12" /><circle cx="120" cy="130" r="12" /><circle cx="230" cy="130" r="12" /><path d="M40 14H120M120 14H230M28 25V75M28 75V130" />
      </g>
      <g fill="currentColor" fontSize="12"><text x="72" y="12">e1</text><text x="170" y="12">p1</text><text x="8" y="55">e2</text><text x="8" y="108">p2</text></g>
    </svg>
  );
}
