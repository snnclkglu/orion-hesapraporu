"use client";

// Kalem Eşleştirme — kayıttaki numaranın sistemdeki karşılığı yoksa.
//
// NEDEN GEREKLİ: atölye çizelgesi sistemdeki numaralandırmayı beklemez. 0020-00
// numarasına 792 satır yazılmış ama sistemde 0020 no'lu bir iş yok; bu satırlar
// müşteri ve iş kırılımlarına giremez ve toplamın yarısı "eşleşmemiş" kalır.
// Satır satır düzeltmek 792 tıklamadır — burada numaranın TAMAMI tek işlemde
// bağlanır.
//
// METNİ KORUMA SEÇENEĞİ bilinçlidir: bazı firmalar atölyenin kendi numarasını
// kayıtta görmek ister. Kapalıyken yalnız bağlantı kurulur, `item_no` metni
// olduğu gibi kalır.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/combobox";
import { fmtManHours, type WorkJobOption, type WorkLogRow } from "@/lib/work-log";
import { remapItemNo } from "../actions";

interface Unmatched {
  itemNo: string;
  records: number;
  manHours: number;
  firstDate: string;
  lastDate: string;
}

export function ItemRemapCard({ rows, jobs }: { rows: WorkLogRow[]; jobs: WorkJobOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Record<string, string>>({});
  const [rewrite, setRewrite] = useState(true);

  const unmatched = useMemo(() => {
    const map = new Map<string, Unmatched>();
    for (const r of rows) {
      if (r.jobItemId) continue;
      const key = r.itemNo || "—";
      const cur =
        map.get(key) ??
        ({ itemNo: key, records: 0, manHours: 0, firstDate: r.date, lastDate: r.date } as Unmatched);
      cur.records += 1;
      cur.manHours += r.manHours;
      if (r.date < cur.firstDate) cur.firstDate = r.date;
      if (r.date > cur.lastDate) cur.lastDate = r.date;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.manHours - a.manHours);
  }, [rows]);

  const options: ComboOption[] = useMemo(
    () =>
      jobs
        .filter((j) => j.jobItemId)
        .map((j) => ({
          value: j.jobItemId!,
          label: j.itemNo,
          hint: [j.productName, j.customerShort || j.customer].filter(Boolean).join(" · "),
          keywords: [j.productName, j.customer, j.customerShort ?? "", j.jobNo],
          hue: j.customerHue ?? undefined,
        })),
    [jobs]
  );

  if (unmatched.length === 0) return null;

  function apply(itemNo: string) {
    const jobItemId = target[itemNo];
    if (!jobItemId) {
      toast.error("Önce hedef iş kalemini seçin.");
      return;
    }
    startTransition(async () => {
      const res = await remapItemNo({ fromItemNo: itemNo, jobItemId, rewriteItemNo: rewrite });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.affected ?? 0} kayıt bağlandı.`);
      router.refresh();
    });
  }

  const totalRecords = unmatched.reduce((s, u) => s + u.records, 0);
  const totalHours = unmatched.reduce((s, u) => s + u.manHours, 0);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4 shrink-0 text-destructive" />
          <span className="oc-kicker text-foreground/80">Kalem Eşleştirme</span>
          <span className="text-[11px] text-muted-foreground">
            · {totalRecords} kayıt · {fmtManHours(totalHours)} adam·saat bir işe bağlı değil
          </span>
        </div>
        <label className="flex min-h-9 items-center gap-2 text-[11px] text-muted-foreground pointer-coarse:min-h-10">
          <input
            type="checkbox"
            checked={rewrite}
            onChange={(e) => setRewrite(e.target.checked)}
            className="size-4 shrink-0 accent-[var(--primary)]"
          />
          Kayıttaki numarayı da hedefin numarasına çevir
        </label>
      </div>

      {/* Dört sabit sütun 360px'te bilgi metnini yok ediyor, hedef seçicisini
          ~30px'e indiriyor ve ekranı işlevsiz bırakıyordu: telefonda numara +
          özet üstte, seçici ile "Bağla" altta durur. */}
      <div className="grid gap-3 px-4 py-3 sm:gap-2">
        {unmatched.map((u) => (
          <div
            key={u.itemNo}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-destructive/15 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[7rem_1fr_minmax(0,18rem)_auto] sm:border-b-0 sm:pb-0"
          >
            <span className="col-span-2 font-mono text-sm font-medium text-destructive sm:col-span-1">
              {u.itemNo}
            </span>
            <span className="col-span-2 truncate text-[11px] text-muted-foreground sm:col-span-1">
              {u.records} kayıt · {fmtManHours(u.manHours)} adam·saat ·{" "}
              {u.firstDate.slice(0, 7)} – {u.lastDate.slice(0, 7)}
            </span>
            <Combobox
              options={options}
              value={target[u.itemNo] ?? null}
              onChange={(v) => setTarget((t) => ({ ...t, [u.itemNo]: v }))}
              placeholder="Hedef iş kalemi seçin"
              searchPlaceholder="Kalem no, ürün veya müşteri…"
              className="h-8 pointer-coarse:h-10"
              contentClassName="min-w-[min(24rem,calc(100vw-1.5rem))]"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={pending || !target[u.itemNo]}
              onClick={() => apply(u.itemNo)}
            >
              <Link2 className="size-3.5" /> Bağla
            </Button>
          </div>
        ))}
      </div>

      <p className="border-t border-destructive/20 px-4 py-2 text-[11px] text-muted-foreground">
        Bu numaraların sistemde bir iş kalemi karşılığı yok; kayıtlar korunur ama müşteri ve iş
        kırılımlarında &ldquo;—&rdquo; olarak görünür. Doğru kalemi seçip
        &ldquo;Bağla&rdquo;dığınızda o numaraya yazılmış BÜTÜN kayıtlar tek işlemde bağlanır.
      </p>
    </div>
  );
}
