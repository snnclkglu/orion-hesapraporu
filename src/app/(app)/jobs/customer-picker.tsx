"use client";

// Müşteri seçimi — defterden seç, yoksa pop-up ile hemen kaydet.
//
// Müşteri bilgileri şimdiye kadar her iş emrine elle yazılıyordu; aynı müşteri
// her seferinde yeniden girildiği için yazım farkları oluşuyor ve müşteri
// filtresi güvenilir çalışmıyordu. Artık defterden seçilir: seçim, iş emrinin
// adres/vergi/telefon alanlarını da doldurur.
//
// Alanlar seçimden SONRA da düzenlenebilir kalır — iş emri, basıldığı andaki
// bilgilerin fotoğrafıdır; defterdeki sonraki değişiklik eski işi bozmaz.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";
import { createCustomer } from "./actions";
import type { CustomerOption } from "./schema";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/** Deftere bağlı olmayan (elle yazılmış) müşteri. */
export const NO_CUSTOMER = "__manual__";

export interface CustomerFields {
  customer: string;
  customer_address: string;
  customer_tax_office: string;
  customer_tax_no: string;
  customer_phone: string;
  customer_fax: string;
}

/** Defter kaydını iş emri alanlarına çevirir. */
export function fieldsFromCustomer(c: CustomerOption): CustomerFields {
  return {
    customer: c.name,
    customer_address: c.address ?? "",
    customer_tax_office: c.tax_office ?? "",
    customer_tax_no: c.tax_no ?? "",
    customer_phone: c.phone ?? "",
    customer_fax: c.fax ?? "",
  };
}

const EMPTY_NEW = {
  name: "", address: "", tax_office: "", tax_no: "", phone: "", fax: "", notes: "",
};

function NewCustomerDialog({
  open,
  onOpenChange,
  onCreated,
  initialName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: CustomerOption) => void;
  initialName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ ...EMPTY_NEW, name: initialName ?? "" });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCustomer(form);
      if (res.error || !res.customer) {
        toast.error(res.error ?? "Müşteri kaydedilemedi.");
        return;
      }
      toast.success(`${res.customer.name} deftere kaydedildi.`);
      onCreated(res.customer);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni Müşteri Kaydı</DialogTitle>
          <DialogDescription>
            Müşteri deftere kaydedilir ve bu iş emrine seçilir. Sonraki işlerde
            listeden seçmeniz yeterli olacak.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="new_customer_name">Müşteri Adı</Label>
            <Input
              id="new_customer_name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="İSKENDERUN DEMİR VE ÇELİK A.Ş."
              autoFocus
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new_customer_address">Adresi</Label>
            <Input
              id="new_customer_address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Karşı Mahalle Şehit Yüzbaşı Ali Oğuz Bulvarı No:1 Payas/Hatay"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new_customer_tax_office">Vergi Dairesi</Label>
              <Input
                id="new_customer_tax_office"
                value={form.tax_office}
                onChange={(e) => set("tax_office", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new_customer_tax_no">Vergi No</Label>
              <Input
                id="new_customer_tax_no"
                value={form.tax_no}
                onChange={(e) => set("tax_no", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new_customer_phone">Telefon</Label>
              <Input
                id="new_customer_phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+90 326 758 40 40"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new_customer_fax">Faks</Label>
              <Input
                id="new_customer_fax"
                value={form.fax}
                onChange={(e) => set("fax", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> {pending ? "Kaydediliyor…" : "Kaydet ve Seç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerPicker({
  customers,
  value,
  currentName,
  onPick,
}: {
  customers: CustomerOption[];
  /** Seçili defter kaydının id'si (yoksa NO_CUSTOMER) */
  value: string | null;
  /** Formdaki müşteri adı — defterde yoksa "elle girilmiş" seçeneğinde gösterilir */
  currentName: string;
  onPick: (customer: CustomerOption | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [list, setList] = useState(customers);

  const sorted = useMemo(
    () => [...list].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [list]
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid min-w-[240px] flex-1 gap-1.5">
        <Label>Müşteri (Defterden Seç)</Label>
        <Select
          value={value ?? NO_CUSTOMER}
          onValueChange={(id) => {
            if (id === NO_CUSTOMER) {
              onPick(null);
              return;
            }
            const picked = sorted.find((c) => c.id === id);
            if (picked) onPick(picked);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Müşteri seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CUSTOMER}>
              {currentName.trim() ? `Elle girilen: ${currentName}` : "Defter dışı (elle gir)"}
            </SelectItem>
            {sorted.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" onClick={() => setCreating(true)}>
        <UserPlus className="size-4" /> Yeni Müşteri
      </Button>

      {creating && (
        <NewCustomerDialog
          open
          onOpenChange={(o) => !o && setCreating(false)}
          initialName={value === null ? currentName : ""}
          onCreated={(c) => {
            setList((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]));
            onPick(c);
          }}
        />
      )}
    </div>
  );
}
