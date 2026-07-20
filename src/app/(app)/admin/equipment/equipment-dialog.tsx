"use client";

// Ekipman ekle/düzenle dialogu + silme butonu.
// attrs jsonb alanı serbest anahtar-değer satırları olarak düzenlenir;
// sayısal görünen değerler sayı olarak kaydedilir.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createEquipment, updateEquipment, deleteEquipment, type EquipmentInput,
} from "../actions";
import { EQUIPMENT_KINDS } from "../labels";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface EquipmentRow {
  id: string;
  kind: string;
  brand: string;
  model: string;
  attrs: Record<string, unknown>;
  notes: string;
  datasheet_url?: string;
  active: boolean;
  sort: number;
}

type AttrRow = { key: string; value: string };

function attrsToRows(attrs: Record<string, unknown>): AttrRow[] {
  return Object.entries(attrs ?? {}).map(([key, value]) => ({ key, value: String(value) }));
}

function rowsToAttrs(rows: AttrRow[]): Record<string, string | number> {
  const attrs: Record<string, string | number> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    const value = row.value.trim();
    const num = Number(value.replace(",", "."));
    attrs[key] = value !== "" && Number.isFinite(num) ? num : value;
  }
  return attrs;
}

export function EquipmentDialog({
  item,
  defaultKind,
}: {
  item?: EquipmentRow;
  defaultKind?: string;
}) {
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState(item?.kind ?? defaultKind ?? "motor");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [model, setModel] = useState(item?.model ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [datasheetUrl, setDatasheetUrl] = useState(item?.datasheet_url ?? "");
  const [active, setActive] = useState(item?.active ?? true);
  const [sort, setSort] = useState(String(item?.sort ?? 0));
  const [attrRows, setAttrRows] = useState<AttrRow[]>(
    item ? attrsToRows(item.attrs) : []
  );

  function resetForCreate() {
    setKind(defaultKind ?? "motor");
    setBrand("");
    setModel("");
    setNotes("");
    setDatasheetUrl("");
    setActive(true);
    setSort("0");
    setAttrRows([]);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !isEdit) resetForCreate();
    if (next && isEdit && item) {
      setKind(item.kind);
      setBrand(item.brand);
      setModel(item.model);
      setNotes(item.notes);
      setDatasheetUrl(item.datasheet_url ?? "");
      setActive(item.active);
      setSort(String(item.sort));
      setAttrRows(attrsToRows(item.attrs));
    }
  }

  function setAttrRow(i: number, patch: Partial<AttrRow>) {
    setAttrRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: EquipmentInput = {
      kind: kind as EquipmentInput["kind"],
      brand: brand.trim(),
      model: model.trim(),
      notes: notes.trim(),
      datasheet_url: datasheetUrl.trim(),
      active,
      sort: parseInt(sort, 10) || 0,
      attrs: rowsToAttrs(attrRows),
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateEquipment(item!.id, input)
        : await createEquipment(input);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(isEdit ? "Ekipman güncellendi" : "Ekipman eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="outline">Düzenle</Button>
        ) : (
          <Button>Yeni Ekipman</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ekipmanı Düzenle" : "Yeni Ekipman"}</DialogTitle>
          <DialogDescription>
            Katalog kaydı; özellikler tipe göre serbest anahtar-değer alanlarıdır
            (ör. power_kw, ratio, dia_mm).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tip</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Durum</Label>
              <Select value={active ? "1" : "0"} onValueChange={(v) => setActive(v === "1")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Aktif</SelectItem>
                  <SelectItem value="0">Pasif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="eq-brand">Marka</Label>
              <Input id="eq-brand" value={brand} onChange={(e) => setBrand(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eq-model">Model</Label>
              <Input id="eq-model" value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <div className="grid gap-2">
              <Label htmlFor="eq-notes">Notlar</Label>
              <Input id="eq-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eq-sort">Sıra</Label>
              <Input
                id="eq-sort" type="number" value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="eq-datasheet">Katalog / Datasheet linki</Label>
            <Input
              id="eq-datasheet" type="url" inputMode="url"
              placeholder="https://üretici.com/…/urun.pdf"
              value={datasheetUrl}
              onChange={(e) => setDatasheetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ekipman listesi Excel&apos;inde Model hücresi bu adrese köprülenir.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Özellikler (attrs)</Label>
              <Button
                type="button" size="sm" variant="ghost"
                onClick={() => setAttrRows((rows) => [...rows, { key: "", value: "" }])}
              >
                + Satır ekle
              </Button>
            </div>
            {attrRows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Özellik yok. &quot;Satır ekle&quot; ile anahtar-değer çifti ekleyin.
              </p>
            )}
            {attrRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  placeholder="anahtar (ör. power_kw)"
                  value={row.key}
                  onChange={(e) => setAttrRow(i, { key: e.target.value })}
                />
                <Input
                  placeholder="değer"
                  value={row.value}
                  onChange={(e) => setAttrRow(i, { value: e.target.value })}
                />
                <Button
                  type="button" size="sm" variant="ghost"
                  onClick={() => setAttrRows((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  Sil
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor..." : isEdit ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEquipmentButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`"${name}" katalogdan silinecek. Emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteEquipment(id);
      if (result?.error) toast.error(result.error);
      else toast.success("Ekipman silindi");
    });
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={handleDelete}>
      Sil
    </Button>
  );
}
