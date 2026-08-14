import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { loadSaleRows } from "../data";
import { CustomerRevenue } from "../customer-revenue";

// Yetki + ray `sales/layout.tsx`tedir.
export default async function SalesCiroPage() {
  const supabase = await createClient();
  const rows = await loadSaleRows(supabase);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Müşteri Bazında Ciro"
        hint="Satış Takibi'ndeki kalemlerin müşteri kırılımı — avro karşılığıyla"
      />
      <CustomerRevenue rows={rows} />
    </div>
  );
}
