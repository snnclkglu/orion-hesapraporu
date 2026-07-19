"use client";

// Ray ekle/düzenle dialogu + silme butonu. Kod birincil anahtar olduğundan
// düzenlemede değiştirilemez.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createRail, updateRail, deleteRail, type RailInput } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RailRow {
  code: string;
  radius: number | null;
  head_width: number;
  sort: number;
}

export function RailDialog({ item }: { item?: RailRow }) {
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [code, setCode] = useState(item?.code ?? "");
  const [radius, setRadius] = useState(item?.radius != null ? String(item.radius) : "");
  const [headWidth, setHeadWidth] = useState(item ? String(item.head_width) : "");
  const [sort, setSort] = useState(String(item?.sort ?? 0));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setCode(item?.code ?? "");
    setRadius(item?.radius != null ? String(item.radius) : "");
    setHeadWidth(item ? String(item.head_width) : "");
    setSort(String(item?.sort ?? 0));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input: RailInput = {
      code: code.trim(),
      radius: radius.trim() === "" ? null : Number(radius.replace(",", ".")),
      head_width: Number(headWidth.replace(",", ".")),
      sort: parseInt(sort, 10) || 0,
    };
    startTransition(async () => {
      const result = isEdit ? await updateRail(item!.code, input) : await createRail(input);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(isEdit ? "Ray güncellendi" : "Ray eklendi");
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
          <Button>Yeni Ray</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Ray: ${item?.code}` : "Yeni Ray"}</DialogTitle>
          <DialogDescription>
            Baş yarıçapı sadece A tipi (yuvarlak başlı) raylarda doldurulur.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rail-code">Kod</Label>
              <Input
                id="rail-code" value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="A75 veya 50x50"
                required disabled={isEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rail-sort">Sıra</Label>
              <Input
                id="rail-sort" type="number" value={sort}
                onChange={(e) => setSort(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rail-radius">Baş yarıçapı [mm]</Label>
              <Input
                id="rail-radius" type="number" step="any" min="0"
                value={radius} onChange={(e) => setRadius(e.target.value)}
                placeholder="kare rayda boş"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rail-head">Temas genişliği [mm]</Label>
              <Input
                id="rail-head" type="number" step="any" min="0"
                value={headWidth} onChange={(e) => setHeadWidth(e.target.value)} required
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

export function DeleteRailButton({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`"${code}" rayı silinecek. Emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteRail(code);
      if (result?.error) toast.error(result.error);
      else toast.success("Ray silindi");
    });
  }

  return (
    <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={handleDelete}>
      Sil
    </Button>
  );
}
