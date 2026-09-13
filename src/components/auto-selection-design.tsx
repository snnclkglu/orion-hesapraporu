"use client";

import { COMMON_REEVINGS } from "@/lib/calc/reeving";
import { RAILS, RAIL_FAMILIES, RAIL_FAMILY_LABELS, railCodesOfFamily, railFamilyOf } from "@/lib/calc/tables";
import { MODULE_LABELS, isHoistKey, isTravelKey } from "@/lib/calc/presentation/module-family";
import type { DesignInputs } from "@/lib/auto-selection/design-inputs";
import type { SelectionRequest } from "@/lib/auto-selection/types";

const control = "oc-tap w-full min-w-0 rounded-md border bg-background px-2.5 py-1.5 text-base pointer-fine:text-sm focus-visible:outline-2 focus-visible:outline-primary";
export function AutoSelectionDesign({ request, value, onChange }: { request: Pick<SelectionRequest, "active">; value: DesignInputs; onChange: (value: DesignInputs) => void }) {
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-sm font-semibold">2. Temel tasarım kararları</legend>
    <p className="text-sm text-muted-foreground">Bu değerler halat yükünü, tamburu, teker yüklerini ve tahrik gücünü birlikte belirler. Diğer ayrıntıları oluşan raporda düzenleyebilirsiniz.</p>
    <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {request.active.filter(isHoistKey).map(key => {
      const rig = value.reeving[key]; if (!rig) return null;
      const label = `${rig.drivenFalls}/${rig.totalFalls}`;
      const custom = !COMMON_REEVINGS.some(r => r.label === label);
      return <div key={key} className="min-w-0 space-y-2 rounded-lg border bg-muted/20 p-3"><label className="block space-y-1 text-sm"><span>{MODULE_LABELS[key]} · Halat donanımı</span><select className={control} value={label} onChange={event => { const [drivenFalls, totalFalls] = event.target.value.split("/").map(Number); onChange({ ...value, reeving: { ...value.reeving, [key]: { drivenFalls, totalFalls } } }); }}>
        {custom && <option value={label}>{label} · Rapordaki özel donanım</option>}
        {COMMON_REEVINGS.map(r => <option key={r.label} value={r.label}>{r.label} · {r.drivenFalls} tahrikli / {r.totalFalls} toplam kol</option>)}
      </select></label><p className="text-xs text-muted-foreground">İlk sayı tamburun çektiği, ikinci sayı yükü taşıyan toplam halat koludur. İkiz düzende her mekanizmanın, çift tamburda toplam düzenin donanımıdır.</p></div>;
    })}
    {request.active.filter(isTravelKey).map(key => {
      const travel = value.travel[key]; if (!travel) return null;
      const patch = (change: Partial<typeof travel>) => onChange({ ...value, travel: { ...value.travel, [key]: { ...travel, ...change } } });
      const family = railFamilyOf(travel.railCode);
      return <fieldset key={key} className="min-w-0 space-y-2 rounded-lg border bg-muted/20 p-3"><legend className="pr-1 text-sm font-medium">{MODULE_LABELS[key]}</legend><div className="grid min-w-0 grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1 text-sm"><span>Toplam teker</span><select className={control} value={travel.wheelCount} onChange={event => patch({ wheelCount: Number(event.target.value) })}>{[4, 8, 12, 16, 20, 24].map(n => <option key={n} value={n}>{n} teker</option>)}</select></label>
        <label className="min-w-0 space-y-1 text-sm"><span>Tahrik sayısı</span><input className={control} type="number" min={1} max={Math.min(16, travel.wheelCount)} step={1} value={Number.isFinite(travel.driveCount) ? travel.driveCount : ""} onChange={event => patch({ driveCount: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
        <label className="min-w-0 space-y-1 text-sm"><span>Ray ailesi</span><select className={control} value={family} onChange={event => patch({ railCode: railCodesOfFamily(event.target.value)[0] })}>{RAIL_FAMILIES.map(item => <option key={item} value={item}>{RAIL_FAMILY_LABELS[item]}</option>)}</select></label>
        <label className="min-w-0 space-y-1 text-sm"><span>Ray ölçüsü</span><select className={control} value={travel.railCode} onChange={event => patch({ railCode: event.target.value })}>{!RAILS[travel.railCode] && <option value={travel.railCode}>Ray seçin</option>}{railCodesOfFamily(family).map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      </div><p className="text-xs text-muted-foreground">Her tahrik bir tekeri sürer; motor adedi tahrik sayısına eşitlenir. Teker sertliği burada sorulmaz; rapordaki seçim korunur, boşsa 32–35 HRC firma kabulüyle başlar.</p></fieldset>;
    })}
    </div>
  </fieldset>;
}
