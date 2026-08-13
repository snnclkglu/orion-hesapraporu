"use client";

// "Yeni Tedarikçi" — kod BOŞ bırakılabilir.
//
// Boş kod bir eksiklik değil bir SEÇİMdir: sırayı veritabanı verir
// (`purchase_supplier_code_seq`) ve elle yazılan bir numara er geç bir
// başkasıyla çakışırdı. Alan yine de açıktır — devralınan bir kod düzenine
// (firmanın kendi cari kodu) geçmek gerektiğinde uygulama yolu kapatmamalı.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createSupplier } from "../actions";
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
import { Textarea } from "@/components/ui/textarea";

const BOS = { name: "", code: "", active: true, note: "" };

export function NewSupplierButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BOS);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSupplier(form);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${form.name} deftere eklendi.`);
      setForm(BOS);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Yeni Tedarikçi
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[min(32rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>Yeni Tedarikçi</DialogTitle>
            <DialogDescription>
              Kod boş bırakılırsa sıradaki numara verilir (TD0001, TD0002…).
              Firma adı büyük harfe çevrilir ve aynı ad iki kez kaydedilemez.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <div className="grid gap-1.5">
                <Label htmlFor="yeni-firma-ad">Firma Adı</Label>
                <Input
                  id="yeni-firma-ad"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  maxLength={120}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="yeni-firma-kod">Kod (İsteğe Bağlı)</Label>
                <Input
                  id="yeni-firma-kod"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  maxLength={20}
                  placeholder="otomatik"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="yeni-firma-not">Not</Label>
              <Textarea
                id="yeni-firma-not"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={pending || form.name.trim().length < 2}>
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
