"use client";

// Müşteri seçimi — LİSTEDEN seç, listede yoksa pop-up ile hemen kaydet.
//
// Müşteri bilgileri şimdiye kadar her iş emrine elle yazılıyordu; aynı müşteri
// her seferinde yeniden girildiği için yazım farkları oluşuyor ve müşteri
// filtresi güvenilir çalışmıyordu. Artık listeden seçilir: seçim, iş emrinin
// adres/vergi/telefon alanlarını da doldurur.
//
// ELLE MÜŞTERİ GİRİŞİ YOKTUR. Serbest metin bırakıldığı sürece defter dışında
// ikinci bir müşteri listesi büyümeye devam ediyordu (aynı firma "ASTOR A.Ş."
// ve "Astor Enerji" olarak iki satır); kısaltma ve renk gibi defter alanları da
// o kayıtlara bağlanamıyordu. Listede olmayan müşteri "Yeni Müşteri" ile
// deftere yazılır — tek zorunlu alan MÜŞTERİ ADIDIR.
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
import { CustomerTag } from "@/components/tags";
import { autoShortName } from "@/lib/tags";

/** Henüz müşteri seçilmemiş satır — Select boş string değere izin vermez. */
export const NO_CUSTOMER = "__none__";

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
  name: "", short_name: "", address: "", tax_office: "", tax_no: "", phone: "", fax: "", notes: "",
};

export function NewCustomerDialog({
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
  /**
   * Kısaltma adın ilk kelimesinden OTOMATİK dolar ama kullanıcı kutuya yazar
   * yazmaz anahtar kapanır: elle yazılmış kısaltma, ad düzeltilince ezilmemeli.
   *
   * Otomatik değer bir EFEKTLE state'e yazılmaz, boyama sırasında TÜRETİLİR;
   * aksi hâlde her tuş vuruşu ikinci bir boyama turu açardı.
   */
  const [autoShort, setAutoShort] = useState(true);
  const shortName = autoShort ? autoShortName(form.name) : form.short_name;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createCustomer({ ...form, short_name: shortName });
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
            Müşteri deftere kaydedilir ve bu iş emrine seçilir. Yalnız
            <span className="font-medium"> Müşteri Adı </span>
            zorunludur; diğer alanlar sonradan Yönetim → Müşteriler ekranından
            tamamlanabilir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
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
              <Label htmlFor="new_customer_short">Kısaltma</Label>
              <Input
                id="new_customer_short"
                value={shortName}
                onChange={(e) => {
                  setAutoShort(false);
                  set("short_name", e.target.value);
                }}
                placeholder="İSDEMİR"
                title="İşler ve Satış Takibi listelerinde bu ad görünür"
              />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Kısaltma adın ilk kelimesinden gelir; listeler bu adı gösterir ve
            müşteriye kendine özgü bir renk atanır.
          </p>
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
  /** Seçili defter kaydının id'si (henüz seçilmediyse null) */
  value: string | null;
  /** Formdaki müşteri adı — defterde karşılığı yoksa uyarı satırında gösterilir */
  currentName: string;
  onPick: (customer: CustomerOption | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [list, setList] = useState(customers);

  const sorted = useMemo(
    () => [...list].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [list]
  );

  // Eski iş emirlerinde müşteri deftere bağlanmamış olabilir (elle yazılmış).
  // Kayıt bozulmasın diye ad korunur; kullanıcı düzenlerken listeden eşini
  // seçmeye ya da deftere eklemeye yönlendirilir.
  const unlinked = value === null && currentName.trim() !== "";

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-[240px] flex-1 gap-1.5">
          <Label>Müşteri (Liste&apos;den Seç)</Label>
          <Select
            value={value ?? NO_CUSTOMER}
            onValueChange={(id) => {
              if (id === NO_CUSTOMER) return;
              const picked = sorted.find((c) => c.id === id);
              if (picked) onPick(picked);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Müşteri seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CUSTOMER} disabled>
                {unlinked ? `Deftere bağlı değil: ${currentName}` : "Müşteri seçin"}
              </SelectItem>
              {sorted.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <CustomerTag name={c.name} shortName={c.short_name} hue={c.color_hue} />
                    <span className="min-w-0 truncate text-muted-foreground">{c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" /> Yeni Müşteri
        </Button>
      </div>

      {unlinked && (
        <p className="text-[11px] text-destructive">
          Bu iş emrindeki müşteri müşteri defterine bağlı değil. Listeden eşini
          seçin ya da &quot;Yeni Müşteri&quot; ile deftere ekleyin.
        </p>
      )}

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
