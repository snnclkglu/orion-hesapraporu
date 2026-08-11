"use client";

// İş Emri (FR.11.02) oluşturma/düzenleme formu. Tüm başlık alanları + müşteri
// bilgileri + iş bilgileri + kapsam + iş kalemleri (ürün/iş no/adet) + hazırlayan.
// createJob / updateJob action'larını çağırır.
//
// ÜÇ ALAN OTOMATİKTİR (uygulamanın genelindeki `*Auto` deseniyle aynı): anahtar
// açıkken alan salt-okunurdur ve türetilen değeri gösterir, kapatılınca elle
// yazılır.
//   · İş kalemi numaraları — iş nodan türetilir (tek kalem `-00`, çok kalem `-01`…)
//   · İş Bilgileri / Adet — kalem adetlerinin toplamı
//   · Hazırlayan unvanı   — seçilen kullanıcının profilinden

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { createJob, updateJob } from "./actions";
import { ContractUpload } from "./contract-upload";
import {
  CustomerPicker, NO_CUSTOMER, fieldsFromCustomer,
} from "./customer-picker";
import {
  autoItemNos, autoQuantityText,
  type CustomerOption, type JobInput, type JobItemInput,
} from "./schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";

/** Formun kullandığı kullanıcı kaydı (iş lideri / hazırlayan listeleri). */
export interface PersonOption {
  id: string;
  full_name: string;
  title: string;
}

export const EMPTY_JOB: JobInput = {
  job_no: "",
  title: "",
  customer: "",
  customer_id: null,
  work_order_date: "",
  customer_address: "",
  customer_tax_office: "",
  customer_tax_no: "",
  customer_phone: "",
  customer_fax: "",
  contract_exists: false,
  contract_date: "",
  contract_file_path: "",
  contract_file_name: "",
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

/** Serbest metin kişi alanı için "listede yok" seçeneği. */
const MANUAL_PERSON = "__manual__";

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Otomatik alan anahtarı — uygulamanın diğer editörlerindeki desenle aynı. */
function AutoToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    // Kutu 14px, etiket satırı ise 17px yüksekliğindeydi: parmakla vurulacak
    // hedef yoktu. Kutu 16px'e çıkar, tıklanabilir alanı etiketin kendisi
    // asgari 36px (dokunmatikte 40px) yüksekliğe yayar.
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-[11px] text-muted-foreground pointer-coarse:min-h-10">
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
  // 32px'lik adım düğmeleri parmakla vurulmuyordu; `pointer-coarse:` payı
  // üçünü birlikte 40px'e çıkarır (aksi hâlde kutu ile düğmeler ayrışır).
  return (
    <div className="flex items-center">
      <Button type="button" size="icon" variant="outline" className="size-8 shrink-0 rounded-r-none pointer-coarse:size-10" onClick={() => step(-1)}>
        <Minus className="size-3.5" />
      </Button>
      {/* YER TUTUCU YOK (kullanıcı kararı, 11.08.2026): grileşmiş bir "1"
          girilmiş bir değer sanılıyordu. Aynı yanılgı Satış Takibi'nde toplam
          fiyatın 0 çıkmasına yol açtı — orada yer tutucu "1" derken kutu
          gerçekte boştu. */}
      <Input
        className="h-8 w-full rounded-none border-x-0 text-center pointer-coarse:h-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button type="button" size="icon" variant="outline" className="size-8 shrink-0 rounded-l-none pointer-coarse:size-10" onClick={() => step(1)}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    // Kapsam kutuları yan yana dizildiğinde tıklama alanı yalnız 20px'ti;
    // etiket satırı asgari 36px (dokunmatikte 40px) yüksekliğe yayılır.
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm pointer-coarse:min-h-10">
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

/**
 * İş kalemi satırındaki tek alan. Mobilde alanlar alt alta iner ve her biri
 * kendi görünür etiketini taşır; `sm`den itibaren sarmalayıcı `contents` ile
 * çözülür, böylece alanlar üstteki başlık satırının ızgara sütunlarına oturur.
 */
function ItemField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1 sm:contents", className)}>
      <span className="text-[11px] font-medium text-muted-foreground sm:hidden">{label}</span>
      {children}
    </div>
  );
}

/** Kullanıcı listesinden kişi seçimi — seçim adı (ve varsa unvanı) yazar. */
function PersonSelect({
  people,
  value,
  onPick,
  placeholder,
}: {
  people: PersonOption[];
  value: string;
  onPick: (person: PersonOption | null) => void;
  placeholder: string;
}) {
  const match = people.find((p) => p.full_name === value);
  return (
    <Select
      value={match?.id ?? MANUAL_PERSON}
      onValueChange={(id) => onPick(id === MANUAL_PERSON ? null : people.find((p) => p.id === id) ?? null)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={MANUAL_PERSON}>
          {value.trim() ? `Elle girilen: ${value}` : "Listede yok (elle gir)"}
        </SelectItem>
        {people.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.full_name}
            {p.title ? ` — ${p.title}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function JobForm({
  mode,
  initial,
  jobId,
  customers,
  people,
}: {
  mode: "create" | "edit";
  initial: JobInput;
  jobId?: string;
  customers: CustomerOption[];
  people: PersonOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<JobInput>(() =>
    mode === "create" && !initial.work_order_date
      ? { ...initial, work_order_date: todayISO() }
      : initial
  );
  const [pending, startTransition] = useTransition();

  // Otomatik anahtarlar. Düzenlemede, kayıtlı değerler zaten türetilenle
  // örtüşüyorsa açık başlar; mühendisin elle yazdığı numaralar/adet korunsun
  // diye örtüşmüyorsa kapalı başlar.
  const [autoNos, setAutoNos] = useState(() => {
    if (mode === "create") return true;
    const want = autoItemNos(initial.job_no, initial.items.length);
    return initial.items.every((it, i) => it.item_no === want[i]);
  });
  const [autoQty, setAutoQty] = useState(() => {
    if (mode === "create") return true;
    return initial.quantity_text === autoQuantityText(initial.items);
  });
  const [autoTitle, setAutoTitle] = useState(mode === "create");

  function set<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setScope(key: keyof JobInput["scope"], value: boolean) {
    setForm((f) => ({ ...f, scope: { ...f.scope, [key]: value } }));
  }
  function setItem(i: number, patch: Partial<JobItemInput>) {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { item_no: "", product_name: "", quantity: "1" }] }));
  }
  function removeItem(i: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }

  // --- otomatik türetmeler -------------------------------------------------
  // Kalem numaraları iş nodan ve kalem SAYISINDAN çıkar: ikinci kalem eklendiği
  // anda ilk kalemin numarası da -00'dan -01'e kayar (firma kuralı).
  const derivedNos = useMemo(
    () => autoItemNos(form.job_no, form.items.length),
    [form.job_no, form.items.length]
  );

  // Türetilen değerleri GİRDİYE yazar: motor, PDF ve liste aynı sayıyı görür.
  // Efekt yalnız gerçekten farklıysa yazar, aksi hâlde döngüye girerdi.
  const syncing = useRef(false);
  useEffect(() => {
    if (syncing.current) return;
    setForm((f) => {
      let next = f;
      if (autoNos) {
        const want = autoItemNos(f.job_no, f.items.length);
        if (f.items.some((it, i) => it.item_no !== want[i])) {
          next = { ...next, items: next.items.map((it, i) => ({ ...it, item_no: want[i] })) };
        }
      }
      if (autoTitle) {
        const person = people.find((p) => p.full_name === f.prepared_by_name);
        if (person && person.title && f.prepared_by_title !== person.title) {
          next = { ...next, prepared_by_title: person.title };
        }
      }
      if (autoQty) {
        const want = autoQuantityText(next.items);
        if (next.quantity_text !== want) next = { ...next, quantity_text: want };
      }
      return next === f ? f : next;
    });
  }, [autoNos, autoQty, autoTitle, form.job_no, form.items, form.prepared_by_name, people]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Müşteri alanı SALT-OKUNUR olduğu için tarayıcının `required` denetimi
    // onu atlar (salt-okunur alanlar kısıt denetimine girmez); seçim yapılmadan
    // gönderilirse hata ancak sunucudan dönerdi. Uyarı burada verilir.
    if (!form.customer.trim()) {
      toast.error("Önce listeden bir müşteri seçin (ya da Yeni Müşteri ile ekleyin).");
      return;
    }
    syncing.current = true;
    startTransition(async () => {
      const result = mode === "edit" && jobId
        ? await updateJob(jobId, form)
        : await createJob(form);
      // Başarıda action redirect eder; yalnız hata dönerse buraya düşer.
      syncing.current = false;
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {/* Başlık */}
      <Section title="İş Emri Başlığı">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Alan altına açıklama YAZILMAZ: satırdaki tek alanı uzatıp komşu
              alanları yukarı kaydırıyordu. Kalem numarasının iş nodan türediği
              zaten İş Kalemleri bölümünde yazılı. */}
          <div className="grid gap-1.5">
            <Label htmlFor="job_no">İş No</Label>
            <Input
              id="job_no"
              value={form.job_no}
              onChange={(e) => set("job_no", e.target.value)}
              className="font-mono"
              title="Yalnız iş numarası — kalem numaraları buradan türer"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="work_order_date">Tarih</Label>
            <Input id="work_order_date" type="date" value={form.work_order_date ?? ""} onChange={(e) => set("work_order_date", e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="title">İşin Adı</Label>
            {/* AD ALANLARI BÜYÜK HARFE ÇEVRİLİR (firma kuralı, `adBuyuk`);
                şema da aynı dönüşümü uygular, yani kayıt her yoldan aynı
                yazımla girer. */}
            <Input id="title" value={form.title} onChange={(e) => set("title", adBuyuk(e.target.value))} required />
          </div>
        </div>
      </Section>

      {/* İş Kalemleri */}
      <Section
        title="İş Kalemleri (Ürün Adı → İş Numarası)"
        action={
          <AutoToggle
            checked={autoNos}
            onChange={setAutoNos}
            label="Kalem numaralarını otomatik ver"
          />
        }
      >
        {form.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz kalem yok. İlk kalem{" "}
            <span className="font-mono">{derivedNos[0] || `${form.job_no || "0075"}-00`}</span>{" "}
            numarasını alır; ikinci kalem eklendiğinde numaralar{" "}
            <span className="font-mono">
              {(form.job_no.split("-")[0] || "0075")}-01
            </span>{" "}
            ve sonrasına kayar.
          </p>
        ) : (
          // Sabit sütunlu ızgara (120+116+silme düğmesi ≈ 280px) 360px'lik
          // telefonda "Ürün Adı"na 4px bırakıyordu. Mobilde alanlar alt alta
          // iner, her biri kendi etiketini taşır ve satırlar birbirinden
          // ayrılsın diye hafif bir çerçeveye girer; başlık satırı yalnız
          // ızgara düzeninde anlamlı olduğu için `sm` altında gizlenir.
          <div className="grid gap-2">
            <div className="hidden grid-cols-[120px_1fr_116px_auto] gap-3 px-1 text-[11px] font-medium text-muted-foreground sm:grid">
              <span>İş Kalemi No</span><span>Ürün Adı</span><span className="text-center">Adet</span><span />
            </div>
            {form.items.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 border bg-muted/20 p-2 sm:grid-cols-[120px_1fr_116px_auto] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0"
              >
                <ItemField label="İş Kalemi No">
                  <Input
                    // `text-xs` dokunmatikte 12px yapıyordu ve iOS alana
                    // odaklanınca sayfayı kendiliğinden yakınlaştırıyordu.
                    className={cn(
                      "h-8 font-mono text-base pointer-coarse:h-10 pointer-fine:text-xs",
                      autoNos && "bg-muted text-muted-foreground"
                    )}
                    value={it.item_no}
                    onChange={(e) => setItem(i, { item_no: e.target.value })}
                    readOnly={autoNos}
                    title={autoNos ? "Otomatik — değiştirmek için anahtarı kapatın" : undefined}
                  />
                </ItemField>
                <ItemField label="Ürün Adı">
                  <Input className="h-8 pointer-coarse:h-10" value={it.product_name} onChange={(e) => setItem(i, { product_name: adBuyuk(e.target.value) })} />
                </ItemField>
                {/* Silme düğmesi "+" adımının 8px yanındaydı; ızgara aralığı
                    12px'e, düğme dokunmatikte 40px'e çıkar. */}
                <div className="flex items-end gap-3 sm:contents">
                  <ItemField label="Adet" className="flex-1">
                    <QtyStepper value={it.quantity} onChange={(v) => setItem(i, { quantity: v })} />
                  </ItemField>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={() => removeItem(i)}>
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Kalemi sil</span>
                  </Button>
                </div>
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
        <div className="mb-3">
          <CustomerPicker
            customers={customers}
            value={form.customer_id}
            currentName={form.customer}
            onPick={(c) =>
              setForm((f) => (c ? { ...f, customer_id: c.id, ...fieldsFromCustomer(c) } : f))
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Ad SALT-OKUNURDUR: müşteri yalnız listeden seçilir ya da "Yeni
              Müşteri" ile deftere yazılır. Serbest metin bırakıldığı sürece
              defter dışında ikinci bir müşteri listesi büyüyordu. */}
          <div className="grid gap-1.5">
            <Label htmlFor="customer">Adı</Label>
            <Input
              id="customer"
              value={form.customer}
              readOnly
              className="bg-muted text-muted-foreground"
              placeholder="Listeden Müşteri Seçin"
              title="Müşteri adı defterden gelir — değiştirmek için listeden başka bir müşteri seçin"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_address">Adresi</Label>
            <Input id="customer_address" value={form.customer_address} onChange={(e) => set("customer_address", e.target.value)} />
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
            <Input id="customer_phone" value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer_fax">Faks</Label>
            <Input id="customer_fax" value={form.customer_fax} onChange={(e) => set("customer_fax", e.target.value)} />
          </div>
        </div>
        {/* AÇIKLAMA KALDIRILDI (kullanıcı kararı, 11.08.2026). Kuralın kendisi
            geçerliliğini koruyor — bu alanlar iş emrinin basıldığı andaki
            fotoğrafıdır ve düzenlenmeleri müşteri defterini değiştirmez
            (AGENTS md. 14) — ama her iş emri açılışında okunan iki satırlık bir
            hatırlatma olmaktan çıktı; yeri belgenin kendisi değil AGENTS'tir. */}
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
            {/* Negatif dikey boşluk: anahtarın büyütülmüş dokunma alanı etiket
                satırını 36px'e çıkarıp bu alanı komşu tarih alanlarının
                altına kaydırıyordu — hedef korunur, yerleşim korunur. */}
            <div className="-my-2 flex items-center justify-between gap-2">
              <Label htmlFor="quantity_text">Adet</Label>
              <AutoToggle checked={autoQty} onChange={setAutoQty} label="Otomatik" />
            </div>
            <Input
              id="quantity_text"
              value={form.quantity_text}
              onChange={(e) => set("quantity_text", e.target.value)}
              readOnly={autoQty}
              className={cn(autoQty && "bg-muted text-muted-foreground")}
              title={autoQty ? "Kalem adetlerinin toplamı — değiştirmek için anahtarı kapatın" : undefined}
            />
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label>İş Lideri</Label>
            <PersonSelect
              people={people}
              value={form.job_leader}
              placeholder="İş Lideri Seçin"
              onPick={(p) => set("job_leader", p ? p.full_name : "")}
            />
            {!people.some((p) => p.full_name === form.job_leader) && (
              <Input
                value={form.job_leader}
                onChange={(e) => set("job_leader", e.target.value)}
              />
            )}
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label>Sözleşme</Label>
            {/* Kutu 36px iken komşu tarih girişleri 40px'ti ve satır kayıyordu. */}
            <div className="flex h-10 items-center">
              <Check checked={form.contract_exists} onChange={(v) => set("contract_exists", v)} label="Sözleşme var" />
            </div>
          </div>
        </div>

        {/* Sözleşme dosyası — yalnız "var" işaretliyken görünür */}
        {form.contract_exists && (
          <div className="mt-3 grid gap-1.5">
            <Label>Sözleşme Dosyası (PDF)</Label>
            <ContractUpload
              path={form.contract_file_path}
              fileName={form.contract_file_name}
              onChange={({ path, fileName }) =>
                setForm((f) => ({ ...f, contract_file_path: path, contract_file_name: fileName }))
              }
            />
          </div>
        )}

        <div className="mt-4">
          <Label className="mb-2 block text-xs text-muted-foreground">Kapsam</Label>
          {/* Altı kutu tek satıra sarınca telefonda birbirine giriyordu;
              mobilde ikişerli ızgaraya girer, `sm`den itibaren eski dizilim. */}
          <div className="grid grid-cols-2 gap-x-4 sm:flex sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
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
            <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Hazırlayan — Adı Soyadı</Label>
              <PersonSelect
                people={people}
                value={form.prepared_by_name}
                placeholder="Hazırlayan Seçin"
                onPick={(p) =>
                  setForm((f) => ({
                    ...f,
                    prepared_by_name: p ? p.full_name : "",
                    // Unvan otomatikse seçilen kişinin profilinden gelir.
                    prepared_by_title: p && autoTitle ? p.title : f.prepared_by_title,
                  }))
                }
              />
              {!people.some((p) => p.full_name === form.prepared_by_name) && (
                <Input
                  value={form.prepared_by_name}
                  onChange={(e) => set("prepared_by_name", e.target.value)}
                />
              )}
            </div>
            <div className="grid gap-1.5">
              {/* Negatif dikey boşluk — "Adet" alanındakiyle aynı gerekçe. */}
              <div className="-my-2 flex items-center justify-between gap-2">
                <Label htmlFor="prepared_by_title">Unvanı</Label>
                <AutoToggle checked={autoTitle} onChange={setAutoTitle} label="Otomatik" />
              </div>
              <Input
                id="prepared_by_title"
                value={form.prepared_by_title}
                onChange={(e) => set("prepared_by_title", e.target.value)}
                readOnly={autoTitle}
                className={cn(autoTitle && "bg-muted text-muted-foreground")}
                title={autoTitle ? "Seçilen kullanıcının profilinden — değiştirmek için anahtarı kapatın" : undefined}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Form telefonda dört-beş ekran boyunda; Kaydet yalnız en altta kalınca
          kullanıcı her küçük düzeltmeden sonra sonuna kadar kaydırmak zorunda
          kalıyordu. Mobilde şerit alta yapışır, `sm`den itibaren eski akış.
          Negatif kenar boşluğu kabuğun `px-3` iç boşluğunu kenara taşır. */}
      <div className="sticky bottom-0 z-20 -mx-3 flex items-center gap-2 border-t bg-background px-3 py-3 sm:static sm:mx-0 sm:border-0 sm:p-0">
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

export { NO_CUSTOMER };
