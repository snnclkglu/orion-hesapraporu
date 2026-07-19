"use client";

// Kaplin ekle/düzenle dialogu + silme butonu.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCoupling, updateCoupling, deleteCoupling, type CouplingInput,
} from "../actions";
import { COUPLING_TYPES } from "../labels";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface CouplingRow {
  id: number;
  coupling_type: string;
  brand: string;
  series: string;
  model: string;
  dmax: number;
  t_nominal: number;
  radial_load: number | null;
  sort: number;
}

function parseNum(value: string): number {
  return Number(value.replace(",", "."));
}

export function CouplingDialog({
  item,
  defaultType,
}: {
  item?: CouplingRow;
  defaultType?: string;
}) {
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState(item?.coupling_type ?? defaultType ?? "drum");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [series, setSeries] = useState(item?.series ?? "");
  const [model, setModel] = useState(item?.model ?? "");
  const [dmax, setDmax] = useState(item ? String(item.dmax) : "");
  const [tNominal, setTNominal] = useState(item ? String(item.t_nominal) : "");
  const [radialLoad, setRadialLoad] = useState(
    item?.radial_load != null ? String(item.radial_load) : ""
  );
  const [sort, setSort] = useState(String(item?.sort ?? 0));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    if (isEdit && item) {
      setType(item.coupling_type);
      setBrand(item.brand);
      setSeries(item.series);
      setModel(item.model);
      setDmax(String(item.dmax));
      setTNominal(String(item.t_nominal));
      setRadialLoad(item.radial_load != null ? String(item.radial_load) : "");
      setSort(String(item.sort));
    } else {
      setType(defaultType ?? "drum");
      setBrand(""); setSeries(""); setModel("");
      setDmax(""); setTNominal(""); setRadialLoad(""); setSort("0");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: CouplingInput = {
      coupling_type: type as CouplingInput["coupling_type"],
      brand: brand.trim(),
      series: series.trim(),
      model: model.trim(),
      dmax: parseNum(dmax),
      t_nominal: parseNum(tNominal),
      radial_load: radialLoad.trim() === "" ? null : parseNum(radialLoad),
      sort: parseInt(sort, 10) || 0,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateCoupling(item!.id, input)
        : await createCoupling(input);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(isEdit ? "Kaplin güncellendi" : "Kaplin eklendi");
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
          <Button>Yeni Kaplin</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Kaplini Düzenle" : "Yeni Kaplin"}</DialogTitle>
          <DialogDescription>
            Radyal yük sadece tambur kaplinleri için doldurulur; diğerlerinde boş bırakın.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tip</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUPLING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cp-brand">Marka</Label>
              <Input id="cp-brand" value={brand} onChange={(e) => setBrand(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cp-series">Seri</Label>
              <Input id="cp-series" value={series} onChange={(e) => setSeries(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cp-model">Model</Label>
              <Input id="cp-model" value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cp-dmax">Maks. delik çapı dmax [mm]</Label>
              <Input
                id="cp-dmax" type="number" step="any" min="0"
                value={dmax} onChange={(e) => setDmax(e.target.value)} required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cp-tnom">Nominal tork [Nm]</Label>
              <Input
                id="cp-tnom" type="number" step="any" min="0"
                value={tNominal} onChange={(e) => setTNominal(e.target.value)} required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cp-radial">Radyal yük [N] (opsiyonel)</Label>
              <Input
                id="cp-radial" type="number" step="any" min="0"
                value={radialLoad} onChange={(e) => setRadialLoad(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cp-sort">Sıra</Label>
              <Input
                id="cp-sort" type="number" value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </div>
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

export function DeleteCouplingButton({ id, name }: { id: number; name: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`"${name}" katalogdan silinecek. Emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteCoupling(id);
      if (result?.error) toast.error(result.error);
      else toast.success("Kaplin silindi");
    });
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={handleDelete}>
      Sil
    </Button>
  );
}
