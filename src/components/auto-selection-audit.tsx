import type { SelectionTrace } from "@/lib/auto-selection/types";
import { MODULE_LABELS } from "@/lib/calc/presentation/module-family";

const REASONS: Record<string, string> = { motorData: "Motor katalog verisi eksik", gearboxData: "Redüktör katalog verisi eksik", motorSupply: "Motor besleme koşulu", motorSpeedClass: "1500 dev/dak sınıfı dışında", motorPower: "Motor gücü yetersiz", ratioSpeed: "Tahvil / hareket hızı", referenceRpm: "Referans giriş devri", torque: "Çıkış momenti", radial: "Radyal yük", finalChecks: "Bağlı hesap / gerçek hız", thermal: "Termik kapasite", dependencies: "Fren / kaplin bağlantıları", budget: "Arama sınırı" };
/** Aynı işlemde yapılan otomatik denetim; kullanıcıdan yeni bir işlem istemez. */
export function AutoSelectionAudit({ trace }: { trace: SelectionTrace }) {
  if (!trace.audit) return null;
  const audit = trace.audit;
  return <details className="rounded-md border p-3"><summary className="oc-tap cursor-pointer text-sm font-medium">Otomatik son kontrol · {audit.attempts.length} tur · {audit.resolved} sorun giderildi</summary>
    <p className="py-2 text-sm text-muted-foreground">{audit.remaining ? `${audit.remaining} hesap, kütle veya bağlı seçim sorunu kaldı.` : "Son denetimde sayısal hesap, kütle çelişkisi veya eksik tahrik zinciri bulunmadı."} Eksik katalog bilgileri ve üretici teyitleri ayrıca listelenir. Bu kayıt seçim anına aittir.</p>
    <ol className="space-y-2 text-sm">{audit.attempts.map(attempt => <li key={attempt.iteration}><span className="font-medium">{attempt.iteration}. tur · {attempt.reason}</span><p>{attempt.explanation}</p></li>)}</ol>
    {!!trace.diagnostics?.length && <details className="pt-3"><summary className="oc-tap cursor-pointer text-sm">Motor ve redüktör adaylarının değerlendirmesi</summary><ul className="space-y-3 pt-2 text-sm">{trace.diagnostics.map(scan => <li key={`${scan.module}.${scan.section}`}><p className="font-medium">{MODULE_LABELS[scan.module]} · {scan.motors} motor / {scan.gearboxes} redüktör</p><p>{Object.entries(scan.rejected).map(([reason, count]) => `${REASONS[reason] ?? reason}: ${count}`).join(" · ")}</p><p className="text-muted-foreground">Sayılar arama boyunca değerlendirilen denemelerdir; aynı ürün farklı bağlı kombinasyonlarda tekrar denenebilir.</p></li>)}</ul></details>}
  </details>;
}
