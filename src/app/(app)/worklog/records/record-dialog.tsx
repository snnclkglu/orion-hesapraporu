"use client";

// Tek kayıt düzenleme penceresi.
//
// Günlük Giriş bir GÜNÜ düzenler; burada tek bir SATIR düzenlenir — yanlış
// güne yazılmış bir kayıt ancak burada doğru güne taşınabilir (giriş ekranı
// tarihi satırın değil sayfanın özelliğidir).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboOption } from "@/components/combobox";
import { parseNum } from "@/lib/currency";
import { tagStyle } from "@/lib/tags";
import {
  fmtManHours,
  type WorkCategory,
  type WorkJobOption,
  type WorkLogRow,
  type WorkPart,
} from "@/lib/work-log";
import { deleteWorkLog, updateWorkLog } from "../actions";

export function RecordDialog({
  row,
  parts,
  categories,
  jobs,
  open,
  onOpenChange,
}: {
  row: WorkLogRow;
  parts: WorkPart[];
  categories: WorkCategory[];
  jobs: WorkJobOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [date, setDate] = useState(row.date);
  const [itemNo, setItemNo] = useState(row.itemNo);
  const [partId, setPartId] = useState(row.partId);
  const [categoryId, setCategoryId] = useState(row.categoryId);
  const [partCode, setPartCode] = useState(row.partCode);
  const [people, setPeople] = useState(String(row.people));
  const [hours, setHours] = useState(String(row.hours));
  const [note, setNote] = useState(row.note);

  const jobOptions: ComboOption[] = jobs.map((j) => ({
    value: j.itemNo,
    label: j.itemNo,
    hint: j.orphan
      ? "Sistemde iş kalemi yok"
      : [j.productName, j.customerShort || j.customer].filter(Boolean).join(" · "),
    keywords: [j.productName, j.customer, j.customerShort ?? "", j.jobNo],
    hue: j.customerHue ?? undefined,
    badge: j.orphan ? "eşleşmemiş" : undefined,
  }));

  const p = parseNum(people) ?? 0;
  const h = parseNum(hours) ?? 0;

  function save() {
    startTransition(async () => {
      const res = await updateWorkLog(row.id, {
        id: row.id,
        date,
        itemNo,
        partId,
        categoryId,
        partCode,
        people: Math.round(p),
        hours: h,
        note,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Kayıt güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteWorkLog(row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Kayıt silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Çalışma Kaydı</DialogTitle>
          <DialogDescription>
            Bir günün bir işe, bir parçaya ve bir imalat türüne ayrılan emeği.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wl-date">Tarih</Label>
            <Input id="wl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label>İş Kalemi</Label>
            <Combobox
              options={jobOptions}
              value={itemNo || null}
              onChange={setItemNo}
              placeholder="İş kalemi"
              searchPlaceholder="Kalem no, ürün veya müşteri…"
              contentClassName="min-w-[24rem]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Parça</Label>
            <Combobox
              options={parts.map((x) => ({ value: x.id, label: x.name }))}
              value={partId || null}
              onChange={setPartId}
              placeholder="Parça"
              searchPlaceholder="Parça ara…"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>İmalat Türü</Label>
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="İmalat türü" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="oc-tag-dot" style={tagStyle(c.colorHue)} aria-hidden />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="wl-code">Grup Kodu</Label>
            <Input
              id="wl-code"
              value={partCode}
              onChange={(e) => setPartCode(e.target.value)}
              placeholder="0200"
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-3 items-end gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="wl-people">Adam</Label>
              <Input
                id="wl-people"
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                inputMode="numeric"
                className="text-center font-mono tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-hours">Saat</Label>
              <Input
                id="wl-hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                inputMode="decimal"
                className="text-center font-mono tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Adam·Saat</Label>
              <div className="flex h-10 items-center justify-center border bg-muted/40 font-mono text-sm font-semibold tabular-nums">
                {p > 0 && h > 0 ? fmtManHours(p * h) : "—"}
              </div>
            </div>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="wl-note">Not</Label>
            <Input
              id="wl-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="İsteğe bağlı"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive">Kayıt silinsin mi?</span>
                <Button variant="destructive" size="sm" onClick={remove} disabled={pending}>
                  Evet, sil
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Vazgeç
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
              >
                <Trash2 className="size-3.5" /> Sil
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Kapat
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
