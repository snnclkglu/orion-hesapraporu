"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteQuality, updateQuality, type QualityInput } from "../actions";
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

export interface QualityAdminRow {
  id: string;
  name: string;
  active: boolean;
}

function EditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: QualityAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<QualityInput>({ name: row.name, active: row.active });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateQuality(row.id, form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marka/Kalite güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(32rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Marka/Kalite Kaydı</DialogTitle>
          <DialogDescription>
            Ad düzeltmesi yayınlanmış sipariş ve sarf giderlerini yeniden yazmaz; değer
            satırın kendi metninde dondurulmuştur.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={"kalite-ad-" + row.id}>Marka/Kalite</Label>
            <Input
              id={"kalite-ad-" + row.id}
              value={form.name}
              onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
              required
              maxLength={120}
              autoFocus
            />
          </div>
          <label className="flex items-start gap-2 border bg-muted/30 p-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((c) => ({ ...c, active: event.target.checked }))}
              className="mt-0.5 size-4"
            />
            <span>
              Seçicilerde görünsün
              <span className="block text-[12px] text-muted-foreground">
                Pasife alındığında eski kayıtlar korunur, yeni girişte önerilmez.
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
  row: QualityAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteQuality(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marka/Kalite defterden silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marka/Kaliteyi Sil</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{row.name}</span> öneri listesinden silinecek.
            Yayınlanmış sipariş ve sarf giderleri DEĞİŞMEZ. İşlem geri alınamaz.
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

export function QualityRow({ row }: { row: QualityAdminRow }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <TableRow className={row.active ? undefined : "opacity-60"}>
        <TableCell className="font-medium whitespace-normal">
          {row.name}
          {!row.active && (
            <span className="ml-1.5 border border-dashed px-1 text-[10px] font-normal text-muted-foreground">
              Pasif
            </span>
          )}
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
        <EditDialog row={row} open onOpenChange={(next) => !next && setEditing(false)} />
      )}
      {confirming && (
        <DeleteDialog row={row} open onOpenChange={(next) => !next && setConfirming(false)} />
      )}
    </>
  );
}
