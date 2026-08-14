"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteConsumableItem,
  updateConsumableItem,
  type ConsumableItemInput,
} from "../actions";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const CONSUMABLE_UNIT_SUGGESTIONS = [
  "Adet",
  "Kg",
  "M³",
  "Metre",
  "Gün",
  "Litre",
  "Takım",
  "Koli",
  "Kutu",
  "Paket",
] as const;

export interface ConsumableAdminRow {
  id: string;
  code: string;
  name: string;
  groupName: string;
  defaultUnit: string;
  active: boolean;
  note: string;
  purchaseCount: number;
  lastPurchaseAt: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? day + "." + month + "." + year : value;
}

function EditDialog({
  row,
  groups,
  open,
  onOpenChange,
}: {
  row: ConsumableAdminRow;
  groups: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ConsumableItemInput>({
    name: row.name,
    groupName: row.groupName,
    defaultUnit: row.defaultUnit,
    active: row.active,
    note: row.note,
  });
  const groupListId = "sarf-gruplar-" + row.id;
  const unitListId = "sarf-birimler-" + row.id;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateConsumableItem(row.id, form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarf malzeme güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(40rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Sarf Malzeme Kaydı</DialogTitle>
          <DialogDescription>
            SM kodu tarihsel giderlerin kalıcı kimliğidir ve değiştirilemez. Ad veya grup
            düzeltmesi eski gider snapshotlarını yeniden yazmaz.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
            <div className="grid gap-1.5">
              <Label htmlFor={"sarf-kod-" + row.id}>Kod</Label>
              <Input
                id={"sarf-kod-" + row.id}
                value={row.code}
                readOnly
                aria-readonly="true"
                className="bg-muted font-mono text-muted-foreground"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={"sarf-ad-" + row.id}>Malzeme Adı</Label>
              <Input
                id={"sarf-ad-" + row.id}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                maxLength={200}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="grid gap-1.5">
              <Label htmlFor={"sarf-grup-" + row.id}>Grup</Label>
              <Input
                id={"sarf-grup-" + row.id}
                list={groupListId}
                value={form.groupName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, groupName: event.target.value }))
                }
                required
                maxLength={120}
              />
              <datalist id={groupListId}>
                {groups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={"sarf-birim-" + row.id}>Varsayılan Birim</Label>
              <Input
                id={"sarf-birim-" + row.id}
                list={unitListId}
                value={form.defaultUnit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, defaultUnit: event.target.value }))
                }
                required
                maxLength={30}
              />
              <datalist id={unitListId}>
                {CONSUMABLE_UNIT_SUGGESTIONS.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={"sarf-not-" + row.id}>Not</Label>
            <Textarea
              id={"sarf-not-" + row.id}
              value={form.note}
              onChange={(event) =>
                setForm((current) => ({ ...current, note: event.target.value }))
              }
              rows={2}
              maxLength={500}
            />
          </div>

          <label className="flex items-start gap-2 border bg-muted/30 p-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.checked }))
              }
              className="mt-0.5 size-4"
            />
            <span>
              Sarf seçicilerinde görünsün
              <span className="block text-[12px] text-muted-foreground">
                Pasife alındığında eski giderler korunur, yeni giriş dropdown&apos;ından düşer.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  row,
  open,
  onOpenChange,
}: {
  row: ConsumableAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteConsumableItem(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sarf malzeme defterden silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sarf Malzemeyi Sil</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{row.name}</span> ({row.code}) defterden silinecek.{" "}
            {row.purchaseCount > 0 ? (
              <>
                Bu malzemeye bağlı {row.purchaseCount} sarf gideri var; veritabanı silmeye izin
                vermez. Kaydı düzenleyip <em>pasife alın</em>.
              </>
            ) : (
              <>Malzeme hiçbir sarf giderinde kullanılmamış. Bu işlem geri alınamaz.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Siliniyor…" : "Kalıcı Olarak Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConsumableRow({ row, groups }: { row: ConsumableAdminRow; groups: string[] }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <TableRow className={row.active ? undefined : "opacity-60"}>
        <TableCell className="font-mono text-sm">{row.code || "—"}</TableCell>
        <TableCell className="font-medium whitespace-normal">
          {row.name}
          {!row.active && (
            <span className="ml-1.5 border border-dashed px-1 text-[10px] font-normal text-muted-foreground">
              Pasif
            </span>
          )}
          <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
            {[
              row.groupName,
              row.defaultUnit,
              row.purchaseCount + " kayıt",
              formatDate(row.lastPurchaseAt),
            ]
              .filter((value) => value && value !== "—")
              .join(" · ")}
          </div>
          {row.note && (
            <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-muted-foreground xl:hidden">
              {row.note}
            </div>
          )}
        </TableCell>
        <TableCell className="hidden whitespace-normal text-sm text-muted-foreground lg:table-cell">
          {row.groupName || "—"}
        </TableCell>
        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
          {row.defaultUnit || "—"}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
          {row.purchaseCount || "—"}
        </TableCell>
        <TableCell className="hidden text-sm tabular-nums text-muted-foreground lg:table-cell">
          {formatDate(row.lastPurchaseAt)}
        </TableCell>
        <TableCell className="hidden max-w-[18rem] truncate text-sm text-muted-foreground xl:table-cell">
          {row.note || "—"}
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              aria-label={row.name + " kaydını düzenle"}
              title="Düzenle"
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirming(true)}
              aria-label={row.name + " kaydını sil"}
              title="Sil"
            >
              <Trash2 />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {editing && (
        <EditDialog
          row={row}
          groups={groups}
          open
          onOpenChange={(next) => !next && setEditing(false)}
        />
      )}
      {confirming && (
        <DeleteDialog row={row} open onOpenChange={(next) => !next && setConfirming(false)} />
      )}
    </>
  );
}
