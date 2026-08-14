"use client";

// Tedarikçi defteri satırı — düzenleme penceresi + pasife çekme + silme.
//
// PASİF BİR SİLME DEĞİL BİR İŞARETTİR (`purchase_suppliers.active`, 13.08.2026
// migration'ının kuralı): devralınan 285 kaydın içinde banka, otel ve kargo da
// var ve onları silmek geçmiş fiyat satırlarının kaynağını kopartırdı. Pencere
// bu yüzden silmeden önce pasifi ÖNERİR.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteSupplier, updateSupplier } from "../actions";
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

export interface SupplierAdminRow {
  id: string;
  name: string;
  code: string;
  active: boolean;
  note: string;
  /** Bu adla açılmış sipariş sayısı — bağ değil KULLANIM İZİ. */
  orderCount: number;
  quoteCount: number;
  /** `supplier_id` ile bağlı sarf gideri sayısı. */
  consumableCount: number;
}

function EditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: SupplierAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: row.name,
    code: row.code,
    active: row.active,
    note: row.note,
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSupplier(row.id, form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tedarikçi güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(36rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Tedarikçi Kaydı</DialogTitle>
          <DialogDescription>
            Ad düzeltmesi yayınlanmış siparişleri DEĞİŞTİRMEZ: sipariş ve teklif
            satırları firmanın o günkü adını metin olarak taşır. Kod ise
            siparişin numarasında yaşar — değiştirilirse eski numaralar eski
            koduyla kalır.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="grid gap-1.5">
              <Label htmlFor={`ad-${row.id}`}>Firma Adı</Label>
              <Input
                id={`ad-${row.id}`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                maxLength={120}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`kod-${row.id}`}>Kod</Label>
              <Input
                id={`kod-${row.id}`}
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                maxLength={20}
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`not-${row.id}`}>Not</Label>
            <Textarea
              id={`not-${row.id}`}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              maxLength={500}
            />
          </div>

          <label className="flex items-start gap-2 border bg-muted/30 p-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="mt-0.5 size-4"
            />
            <span>
              Öneri listesinde görünsün
              <span className="block text-[12px] text-muted-foreground">
                Kapatıldığında firma defterde kalır ama teklif ve sipariş
                pencerelerinin listesinde çıkmaz.
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
  row: SupplierAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const kullanim = row.orderCount + row.quoteCount + row.consumableCount;

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSupplier(row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tedarikçi defterden silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tedarikçiyi Sil</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{row.name}</span> ({row.code}) defterden
            silinecek.
            {kullanim > 0 && (
              <>
                {" "}
                Bu firmaya bağlı {row.orderCount} sipariş, {row.quoteCount} teklif ve {" "}
                {row.consumableCount} sarf gideri kayıtlı; onlar SİLİNMEZ. Sarf giderlerinde
                firma adı snapshot olarak kalır, tedarikçi bağı düşer. Kaydı ve bağı korumak
                için silmek yerine <em>pasife</em> çekin.
              </>
            )}{" "}
            Bu işlem geri alınamaz.
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

export function SupplierRow({ row }: { row: SupplierAdminRow }) {
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
          {/* Dar ekranda gizlenen sütunların özeti (md. 7). */}
          <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
            {[
              `${row.orderCount} sipariş`,
              `${row.quoteCount} teklif`,
              `${row.consumableCount} sarf`,
              row.note || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
          {row.orderCount || "—"}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
          {row.quoteCount || "—"}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
          {row.consumableCount || "—"}
        </TableCell>
        <TableCell className="hidden text-sm whitespace-normal text-muted-foreground md:table-cell">
          {row.note || "—"}
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-2">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              aria-label="Düzenle"
              title="Düzenle"
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirming(true)}
              aria-label="Sil"
              title="Sil"
            >
              <Trash2 />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {editing && <EditDialog row={row} open onOpenChange={(o) => !o && setEditing(false)} />}
      {confirming && (
        <DeleteDialog row={row} open onOpenChange={(o) => !o && setConfirming(false)} />
      )}
    </>
  );
}
