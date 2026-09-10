import type { WeightShape } from "@/lib/engineering-tools/weight";

export function WeightDiagram({ shape }: { shape: WeightShape }) {
  return (
    <svg viewBox="0 0 260 150" className="h-auto w-full max-w-72" role="img" aria-label="Seçilen parçanın ölçü şeması">
      <g fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground/75">
        {shape === "plate" && <rect x="45" y="38" width="170" height="75" />}
        {shape === "disc" && <circle cx="130" cy="75" r="48" />}
        {shape === "ring" && <><circle cx="130" cy="75" r="50" /><circle cx="130" cy="75" r="25" /></>}
        {shape === "roundBar" && <><ellipse cx="72" cy="75" rx="35" ry="47" /><path d="M72 28h110c19 0 35 21 35 47s-16 47-35 47H72" /><ellipse cx="182" cy="75" rx="35" ry="47" /></>}
        {shape === "pipe" && <><ellipse cx="72" cy="75" rx="36" ry="48" /><ellipse cx="72" cy="75" rx="20" ry="32" /><path d="M72 27h108c20 0 36 22 36 48s-16 48-36 48H72" /><ellipse cx="180" cy="75" rx="36" ry="48" /><ellipse cx="180" cy="75" rx="20" ry="32" /></>}
        {shape === "rectTube" && <><rect x="35" y="35" width="80" height="80" /><rect x="50" y="50" width="50" height="50" /><path d="M115 35l110 20v80l-110-20zM100 50l95 17v50l-95-17" /></>}
      </g>
      <g fill="currentColor" className="text-primary" fontSize="11" fontFamily="monospace">
        {shape === "plate" && <><text x="118" y="132">EN</text><text x="18" y="78">BOY</text><text x="98" y="30">KALINLIK</text></>}
        {(shape === "disc" || shape === "roundBar") && <text x="105" y="80">Ø ÇAP</text>}
        {shape === "ring" && <><text x="94" y="20">Ø DIŞ</text><text x="112" y="79">Ø İÇ</text></>}
        {shape === "pipe" && <><text x="46" y="20">Ø DIŞ</text><text x="51" y="79">ET</text><text x="143" y="143">BOY</text></>}
        {shape === "rectTube" && <><text x="55" y="28">EN</text><text x="7" y="79">YÜK.</text><text x="57" y="79">ET</text><text x="172" y="145">BOY</text></>}
      </g>
    </svg>
  );
}
