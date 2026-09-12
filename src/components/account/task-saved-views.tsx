"use client";
import { useEffect, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TaskFilters } from "@/lib/tasks/model";
import { savedTaskViews } from "@/app/(app)/panel/workspace-actions";
export function TaskSavedViews({
  filters,
  onApply,
  preview,
}: {
  filters: TaskFilters;
  onApply: (filters: TaskFilters) => void;
  preview: boolean;
}) {
  const [views, setViews] = useState<
      { id: string; name: string; filters: TaskFilters }[]
    >([]),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (preview || !open) return;
    let active = true;
    savedTaskViews("list")
      .then((r) => {
        if (active) {
          if (r.data) setViews(r.data);
          else toast.error(r.error);
        }
      })
      .catch(() => toast.error("Görünümler yüklenemedi"));
    return () => {
      active = false;
    };
  }, [preview, open]);
  return (
    <>
      <Button className="oc-tap" variant="ghost" onClick={() => setOpen(true)}>
        <Bookmark size={16} />
        Görünümler
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobileKeyboardSafe className="tw-filter-dialog">
          <DialogTitle>Kayıtlı görünümler</DialogTitle>
          <DialogDescription>
            Seçtiğiniz filtreleri size özel bir kısayol olarak saklayın.
          </DialogDescription>
          {views.map((v) => (
            <div className="tw-flow-add" key={v.id}>
              <Button
                variant="outline"
                className="grow"
                onClick={() => {
                  onApply(v.filters);
                  setOpen(false);
                }}
              >
                {v.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`${v.name}: görünümü sil`}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (preview)
                      setViews((all) => all.filter((i) => i.id !== v.id));
                    else {
                      const r = await savedTaskViews("delete", v.id);
                      if (r.data) setViews(r.data);
                      else toast.error(r.error);
                    }
                  } catch {
                    toast.error("Görünüm silinemedi");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {!views.length && <p>Henüz kayıtlı görünümünüz yok.</p>}
          <form
            className="tw-flow-add"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                if (preview)
                  setViews((all) => [
                    ...all.filter((v) => v.name !== name.trim()),
                    { id: crypto.randomUUID(), name: name.trim(), filters },
                  ]);
                else {
                  const r = await savedTaskViews("save", { name, filters });
                  if (!r.data) {
                    toast.error(r.error);
                    return;
                  }
                  setViews(r.data);
                }
                setName("");
                toast.success("Görünüm kaydedildi");
              } catch {
                toast.error("Görünüm kaydedilemedi");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input
              aria-label="Görünüm adı"
              placeholder="Görünüm adı"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button disabled={busy || !name.trim() || views.length >= 20}>
              Kaydet
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
