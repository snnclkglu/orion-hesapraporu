"use client";

// Teknik çizim ekle/düzenle dialogu + silme butonu.
// Kategoriler app_settings 'drawing_categories' listesinden server'da okunup
// prop olarak gelir; dosya alanı Google Drive linkidir.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createDrawing, updateDrawing, deleteDrawing, type DrawingInput,
} from "../actions";
import { DRAWING_STATUSES, type DrawingStatus } from "@/lib/drawings";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface DrawingRow {
  id: string;
  drawing_no: string;
  title: string;
  category: string;
  revision: string;
  status: DrawingStatus;
  file_url: string;
  notes: string;
}

export function DrawingDialog({
  projectId,
  categories,
  drawing,
}: {
  projectId: string;
  categories: string[];
  /** Doluysa düzenleme modu */
  drawing?: DrawingRow;
}) {
  const isEdit = Boolean(drawing);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(drawing?.category ?? "DİĞER");
  const [status, setStatus] = useState<DrawingStatus>(drawing?.status ?? "draft");
  // Kayıtlı kategori öntanım listesinden çıkarılmışsa seçenek olarak korunur.
  const categoryOptions = categories.includes(category)
    ? categories
    : [category, ...categories];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: DrawingInput = {
      drawing_no: String(fd.get("drawing_no") ?? ""),
      title: String(fd.get("title") ?? ""),
      category,
      revision: String(fd.get("revision") ?? "A"),
      status,
      file_url: String(fd.get("file_url") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateDrawing(drawing!.id, projectId, input)
        : await createDrawing(projectId, input);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(isEdit ? "Çizim güncellendi" : "Çizim eklendi");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="ghost">Düzenle</Button>
        ) : (
          <Button size="sm">Yeni Çizim</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Çizimi Düzenle" : "Yeni Teknik Çizim"}</DialogTitle>
          <DialogDescription>
            Çizim kaydı; dosya Google Drive linki olarak takip edilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="drawing_no">Çizim No</Label>
              <Input
                id="drawing_no"
                name="drawing_no"
                placeholder="0053-01-0100"
                defaultValue={drawing?.drawing_no}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revision">Revizyon</Label>
              <Input
                id="revision"
                name="revision"
                className="w-20"
                defaultValue={drawing?.revision ?? "A"}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Çizim Adı</Label>
            <Input
              id="title"
              name="title"
              placeholder="Köprü Yürütme Grubu Komple"
              defaultValue={drawing?.title}
              required
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Durum</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as DrawingStatus)}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRAWING_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="file_url">Dosya Linki (Google Drive)</Label>
            <Input
              id="file_url"
              name="file_url"
              type="url"
              placeholder="https://drive.google.com/..."
              defaultValue={drawing?.file_url}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notlar</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="opsiyonel"
              defaultValue={drawing?.notes}
            />
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

export function DeleteDrawingButton({
  drawingId,
  projectId,
  drawingNo,
}: {
  drawingId: string;
  projectId: string;
  drawingNo: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`"${drawingNo}" çizim kaydı silinecek. Emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteDrawing(drawingId, projectId);
      if (result?.error) toast.error(result.error);
      else toast.success("Çizim silindi");
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive"
      disabled={pending}
      onClick={handleDelete}
    >
      Sil
    </Button>
  );
}
