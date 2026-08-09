"use client";

// Müşteri defteri satırı — düzenleme penceresi + silme.
//
// Satır içi düzenleme (kullanıcı listesindeki gibi) burada yetmez: müşterinin
// dokuz alanı var ve tablo satırına sığmaz. Satıra tıklamak düzenleme
// penceresini açar; tabloda yalnız listelerde görünen alanlar (kısaltma, renk,
// unvan, vergi/iletişim özeti) durur.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCustomer, updateCustomer } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CustomerTag } from "@/components/tags";
import { autoShortName, normalizeHue, tagStyle } from "@/lib/tags";

export interface CustomerAdminRow {
  id: string;
  name: string;
  short_name: string;
  color_hue: number;
  address: string;
  tax_office: string;
  tax_no: string;
  phone: string;
  fax: string;
  notes: string;
  jobCount: number;
}

/**
 * Renk seçici — 24 eşit aralıklı ton.
 *
 * Serbest bir renk kutusu (`input[type=color]`) yerine ton ızgarası: veri zaten
 * AÇI saklıyor ve pastel doygunluk sunum katmanında sabit. Kullanıcı tonu
 * seçer, "soft pastel" kuralını bozamaz (bkz. lib/tags.ts).
 */
function HuePicker({ value, onChange }: { value: number; onChange: (hue: number) => void }) {
  const hues = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    // 28px'lik kutular 4px aralıkla parmakla ayırt edilemiyordu: yanlış ton
    // seçmek bir dokunuş meselesiydi. Ham `<button>` olduğu için dokunma payı
    // burada elle verilir (Button/Select tabanı ortak katmanda düzeltildi).
    <div className="flex flex-wrap gap-1.5">
      {hues.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          aria-label={`Ton ${h}`}
          aria-pressed={normalizeHue(value) === h}
          title={`Ton ${h}°`}
          style={tagStyle(h)}
          className={
            "oc-tag size-9 justify-center pointer-coarse:size-10 " +
            (normalizeHue(value) === h ? "ring-2 ring-foreground/60" : "hover:opacity-80")
          }
        >
          {normalizeHue(value) === h ? "✓" : ""}
        </button>
      ))}
    </div>
  );
}

function EditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: CustomerAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: row.name,
    short_name: row.short_name,
    color_hue: row.color_hue,
    address: row.address,
    tax_office: row.tax_office,
    tax_no: row.tax_no,
    phone: row.phone,
    fax: row.fax,
    notes: row.notes,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateCustomer(row.id, form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Müşteri güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Dikey kaydırma ve yükseklik sınırı artık `DialogContent` tabanından
          gelir. Genişlik `min(...)` ile verilir: düz `sm:max-w-2xl` (672px)
          640px'lik pencerede taban `max-w-[calc(100%-1.5rem)]` sınırını ezip
          ekranı taşırıyordu. */}
      <DialogContent className="sm:max-w-[min(42rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Müşteri Kaydı</DialogTitle>
          <DialogDescription>
            Kısaltma ve renk yalnız EKRAN içindir; yayınlanmış iş emirlerindeki
            unvan ve adres bilgileri bu kayıttan bağımsızdır ve değişmez.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="grid gap-1.5">
              <Label htmlFor={`name-${row.id}`}>Müşteri Adı (resmî unvan)</Label>
              <Input
                id={`name-${row.id}`}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`short-${row.id}`}>Kısaltma</Label>
              <Input
                id={`short-${row.id}`}
                value={form.short_name}
                onChange={(e) => set("short_name", e.target.value)}
                placeholder={autoShortName(form.name)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Renk</Label>
            <div className="flex flex-wrap items-center gap-3">
              <CustomerTag
                name={form.name}
                shortName={form.short_name}
                hue={form.color_hue}
                className="px-2 py-1 text-sm"
              />
              <HuePicker value={form.color_hue} onChange={(h) => set("color_hue", h)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`address-${row.id}`}>Adresi</Label>
            <Input
              id={`address-${row.id}`}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`vd-${row.id}`}>Vergi Dairesi</Label>
              <Input
                id={`vd-${row.id}`}
                value={form.tax_office}
                onChange={(e) => set("tax_office", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`vn-${row.id}`}>Vergi No</Label>
              <Input
                id={`vn-${row.id}`}
                value={form.tax_no}
                onChange={(e) => set("tax_no", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`tel-${row.id}`}>Telefon</Label>
              <Input
                id={`tel-${row.id}`}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`faks-${row.id}`}>Faks</Label>
              <Input
                id={`faks-${row.id}`}
                value={form.fax}
                onChange={(e) => set("fax", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`not-${row.id}`}>Not</Label>
            <Textarea
              id={`not-${row.id}`}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </div>
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
  row: CustomerAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCustomer(row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Müşteri defterden silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Müşteriyi Sil</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{row.name}</span> defterden silinecek.
            {row.jobCount > 0 && (
              <>
                {" "}
                Bu müşteriye bağlı {row.jobCount} iş emri SİLİNMEZ; iş emrindeki
                unvan ve adres olduğu gibi kalır ama listelerde kısaltma ve renk
                gösterilemez.
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

export function CustomerRow({ row }: { row: CustomerAdminRow }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>
          <CustomerTag name={row.name} shortName={row.short_name} hue={row.color_hue} />
        </TableCell>
        <TableCell className="font-medium whitespace-normal">
          {row.name}
          {/* Dar ekranda gizlenen üç sütunun özeti — sütun kaybolduğunda bilgi
              de kaybolmasın (sözleşme §6.2). */}
          <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
            {[
              row.tax_office || row.tax_no ? `${row.tax_office} ${row.tax_no}`.trim() : null,
              row.phone || null,
              `${row.jobCount} iş`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </TableCell>
        <TableCell className="hidden text-sm whitespace-normal text-muted-foreground md:table-cell">
          {row.tax_office || row.tax_no ? `${row.tax_office} ${row.tax_no}`.trim() : "—"}
        </TableCell>
        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
          {row.phone || "—"}
        </TableCell>
        <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
          {row.jobCount}
        </TableCell>
        <TableCell>
          {/* Yıkıcı ve yıkıcı olmayan eylem yan yana duruyor: `gap-1` (4px)
              parmakla yanlış düğmeye basmayı kolaylaştırıyordu. Boy ortak
              katmanın `icon-sm` varyantından gelir (dokunmatikte 40px). */}
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
