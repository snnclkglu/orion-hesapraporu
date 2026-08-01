"use client";

// İş Emri (FR.11.02) oluşturma/düzenleme formu. Tüm başlık alanları + müşteri
// bilgileri + iş bilgileri + kapsam + iş kalemleri (ürün/iş no/adet) + hazırlayan.
// createJob / updateJob action'larını çağırır.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { createJob, updateJob } from "./actions";
import type { JobInput, JobItemInput } from "./schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const EMPTY_JOB: JobInput = {
  job_no: "",
  title: "",
  customer: "",
  work_order_date: "",
  customer_address: "",
  customer_tax_office: "",
  customer_tax_no: "",
  customer_phone: "",
  customer_fax: "",
  contract_exists: false,
  contract_date: "",
  workshop_exit_date: "",
  delivery_date: "",
  quantity_text: "",
  job_leader: "",
  prepared_by_name: "",
  prepared_by_title: "",
  scope: { proje: false, devreyeAlma: false, malzeme: false, nakliye: false, imalat: false, montaj: false },
  notes: "",
  items: [],
};

const SCOPE_LABELS: { key: keyof JobInput["scope"]; label: string }[] = [
  { key: "proje", label: "Proje" },
  { key: "devreyeAlma", label: "Devreye Alma" },
  { key: "malzeme", label: "Malzeme" },
  { key: "nakliye", label: "Nakliye" },
  { key: "imalat", label: "İmalat" },
  { key: "montaj", label: "Montaj" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

/** Bugünün tarihi (yerel) YYYY-MM-DD */
function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Adet +/- artırıcı — baştaki sayıyı adımlar, varsa metin ekini korur (ör. "3 Adet") */
function QtyStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = /^\s*(\d+)(.*)$/.exec(value ?? "");
  const num = m ? parseInt(m[1], 10) : 0;
  const suffix = m ? m[2] : "";
  const step = (delta: number) => onChange(`${Math.max(0, num + delta)}${suffix}`);
  return (
    <div className="flex items-center">
      <Button type="button" size="icon" variant="outline" className="size-8 shrink-0 rounded-r-none" onClick={() => step(-1)}>
        <Minus className="size-3.5" />
      </Button>
      <Input
        className="h-8 w-full rounded-none border-x-0 text-center"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="1"
      />
      <Button type="button" size="icon" variant="outline" className="size-8 shrink-0 rounded-l-none" onClick={() => step(1)}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
      {label}
    </label>
  );
}

export function JobForm({
  mode,
  initial,
  jobId,
}: {
  mode: "create" | "edit";
  initial: JobInput;
  jobId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<JobInput>(() =>
    mode === "create" && !initial.work_order_date
      ? { ...initial, work_order_date: todayISO() }
      : initial
  );
  const [pending, startTransition] = useTransition();

  function set<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setScope(key: keyof JobInput["scope"], value: boolean) {
    setForm((f) => ({ ...f, scope: { ...f.scope, [key]: value } }));
  }
  function setItem(i: number, patch: Partial<JobItemInput>) {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function nextItemNo(): string {
    const base = (form.job_no.split("-")[0] || "").trim();
    if (!base) return "";
    const n = form.items.length + 1;
    return `${base}-${String(n).padStart(2, "0")}`;
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { item_no: nextItemNo(), product_name: "", quantity: "1" }] }));
  }
  function removeItem(i: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = mode === "edit" && jobId
        ? await updateJob(jobId, form)
        : await createJob(form);
      // Başarıda action redirect eder; yalnız hata dönerse buraya düşer.
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {/* Başlık */}
      <Section title="İş Emri Başlığı">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="job_no">İş No</Label>
            <Input id="job_no" value={form.job_no} onChange={(e) => set("job_no", e.target.value)} placeholder="0057-00" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work_order_date">Tarih</Label>
            <Input id="work_order_date" type="date" value={form.work_order_date ?? ""} onChange={(e) => set("work_order_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="title">İşin Adı</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Muhtelif Vinçler" required />
          </div>
        </div>
      </Section>

      {/* İş Kalemleri */}
      <Section title="İş Kalemleri (Ürün Adı → İş Numarası)">
        {form.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz kalem yok. Her ürün/vinç için bir satır ekleyin (ör. 0057-01).
          </p>
        ) : (
          <div className="grid gap-2">
            <div className="grid grid-cols-[110px_1fr_116px_auto] gap-2 px-1 text-[11px] font-medium text-muted-foreground">
              <span>İş No</span><span>Ürün Adı</span><span className="text-center">Adet</span><span />
            </div>
            {form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[110px_1fr_116px_auto] items-center gap-2">
                <Input className="h-8 font-mono text-xs" value={it.item_no} onChange={(e) => setItem(i, { item_no: e.target.value })} placeholder="0057-01" />
                <Input className="h-8" value={it.product_name} onChange={(e) => setItem(i, { product_name: e.target.value })} placeholder="1 t x 19 m Tek Kirişli Köprülü Vinç" />
                <QtyStepper value={it.quantity} onChange={(v) => setItem(i, { quantity: v })} />
                <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => removeItem(i)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={addItem}>
          <Plus className="size-3.5" /> Kalem ekle
        </Button>
      </Section>

      {/* Müşteri Bilgileri */}
      <Section title="Müşteri Bilgileri">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="customer">Adı</Label>
            <Input id="customer" value={form.customer} onChange={(e) => set("customer", e.target.value)} placeholder="ASTOR A.Ş." required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_address">Adresi</Label>
            <Input id="customer_address" value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} placeholder="ASO 2. ve 3. OSB, Sincan/Ankara" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_tax_office">Vergi Dairesi</Label>
            <Input id="customer_tax_office" value={form.customer_tax_office} onChange={(e) => set("customer_tax_office", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_tax_no">Vergi No</Label>
            <Input id="customer_tax_no" value={form.customer_tax_no} onChange={(e) => set("customer_tax_no", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_phone">Telefon</Label>
            <Input id="customer_phone" value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} placeholder="+90 312 267 01 56" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_fax">Faks</Label>
            <Input id="customer_fax" value={form.customer_fax} onChange={(e) => set("customer_fax", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* İş Bilgileri + Kapsam */}
      <Section title="İş Bilgileri">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="contract_date">Sözleşme Tarihi</Label>
            <Input id="contract_date" type="date" value={form.contract_date ?? ""} onChange={(e) => set("contract_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="workshop_exit_date">Atölye Çıkış Tarihi</Label>
            <Input id="workshop_exit_date" type="date" value={form.workshop_exit_date ?? ""} onChange={(e) => set("workshop_exit_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="delivery_date">Teslim Tarihi</Label>
            <Input id="delivery_date" type="date" value={form.delivery_date ?? ""} onChange={(e) => set("delivery_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="quantity_text">Adet</Label>
            <Input id="quantity_text" value={form.quantity_text} onChange={(e) => set("quantity_text", e.target.value)} placeholder="Muhtelif" />
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="job_leader">İş Lideri</Label>
            <Input id="job_leader" value={form.job_leader} onChange={(e) => set("job_leader", e.target.value)} placeholder="Akif Ergüven" />
          </div>
          <div className="flex items-end pb-1.5">
            <Check checked={form.contract_exists} onChange={(v) => set("contract_exists", v)} label="Sözleşme var" />
          </div>
        </div>
        <div className="mt-4">
          <Label className="mb-2 block text-xs text-muted-foreground">Kapsam</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SCOPE_LABELS.map((s) => (
              <Check key={s.key} checked={form.scope[s.key]} onChange={(v) => setScope(s.key, v)} label={s.label} />
            ))}
          </div>
        </div>
      </Section>

      {/* Açıklamalar + Hazırlayan */}
      <Section title="Açıklamalar ve Hazırlayan">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Açıklamalar</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="0057-01: 3 Adet\n0057-02: 3 Adet ..." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="prepared_by_name">Hazırlayan — Adı Soyadı</Label>
              <Input id="prepared_by_name" value={form.prepared_by_name} onChange={(e) => set("prepared_by_name", e.target.value)} placeholder="Salih Ergüven" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="prepared_by_title">Unvanı</Label>
              <Input id="prepared_by_title" value={form.prepared_by_title} onChange={(e) => set("prepared_by_title", e.target.value)} placeholder="Genel Müdür" />
            </div>
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          <Save className="size-4" /> {pending ? "Kaydediliyor…" : mode === "edit" ? "Kaydet" : "İş Emrini Oluştur"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          İptal
        </Button>
      </div>
    </form>
  );
}
