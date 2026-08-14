import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadInvoiceCustomers, loadLatestFx, loadSalesInvoices } from "./data";
import { InvoicesView } from "./invoices-view";

// Yetki + ray `sales/layout.tsx`tedir.
export default async function SalesInvoicesPage() {
  const supabase = await createClient();
  const [invoices, customers, fx] = await Promise.all([
    loadSalesInvoices(supabase),
    loadInvoiceCustomers(supabase),
    loadLatestFx(supabase),
  ]);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Satış Faturaları"
        hint="Kesilen faturaların takibi — manuel giriş ve devralınan veri; ciro avroda toplanır"
      />
      <InvoicesView invoices={invoices} customers={customers} fx={fx} />
    </div>
  );
}
