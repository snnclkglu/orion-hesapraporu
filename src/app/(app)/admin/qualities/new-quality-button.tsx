"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createQuality, type QualityInput } from "../actions";
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

const EMPTY_FORM: QualityInput = { name: "", active: true };

export function NewQualityButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<QualityInput>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next && !pending) setForm(EMPTY_FORM);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createQuality(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(form.name + " marka/kalite defterine eklendi.");
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Yeni Marka/Kalite
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-[min(30rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>Yeni Marka/Kalite</DialogTitle>
            <DialogDescription>
              Değer BÜYÜK HARFE çevrilerek saklanır. Aynı değer tekrar girilirse tekillik
              anahtarı ikinci kaydı engeller.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="yeni-kalite-ad">Marka/Kalite</Label>
              <Input
                id="yeni-kalite-ad"
                value={form.name}
                onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
                required
                maxLength={120}
                autoFocus
                placeholder="Örn. FAG, S275JR, HYUNDAI"
              />
            </div>
            <label className="flex items-start gap-2 border bg-muted/30 p-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((c) => ({ ...c, active: event.target.checked }))}
                className="mt-0.5 size-4"
              />
              <span>Seçicilerde görünsün</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => changeOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={pending || form.name.trim().length < 1}>
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
