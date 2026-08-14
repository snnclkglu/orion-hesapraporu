import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadInvoiceCustomers, loadLatestFx, loadSalesInvoices } from "./data";
import { InvoicesView } from "./invoices-view";

// Yetki + ray `sales/layout.tsx`tedir.
export default async function SalesInvoicesPage() {
  const supabase = await createClient();
  const [invoices, customers, fx, jobs] = await Promise.all([
    loadSalesInvoices(supabase),
    loadInvoiceCustomers(supabase),
    loadLatestFx(supabase),
    supabase.from("jobs").select("job_no, title, job_items (item_no)").order("job_no", { ascending: false }),
  ]);

  // İŞ NO DROPDOWN'I İŞLER'DEN (kullanıcı isteği): her iş kaleminin numarası,
  // işin adı ipucuyla. Numarasıyla tekilleştirilir.
  const seen = new Set<string>();
  const isSecenekleri: { value: string; label: string }[] = [];
  for (const j of (jobs.data ?? []) as {
    job_no: string;
    title: string;
    job_items: { item_no: string }[] | null;
  }[]) {
    for (const it of j.job_items ?? []) {
      const n = (it.item_no ?? "").trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      isSecenekleri.push({ value: n, label: `${n} · ${j.job_no} ${j.title}` });
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Satış Faturaları"
        hint="Kesilen faturaların takibi — manuel giriş ve devralınan veri; ciro avroda toplanır"
      />
      <InvoicesView invoices={invoices} customers={customers} isSecenekleri={isSecenekleri} fx={fx} />
    </div>
  );
}
