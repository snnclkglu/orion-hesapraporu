import { PageHeader } from "@/components/page-header";
import { MATERIAL_PRICE_DEFAULTS } from "@/lib/offers/cost/registry";
import { createClient } from "@/lib/supabase/server";
import { loadCostMaterialPriceBook } from "../../cost-data";
import { MaterialPricesView } from "./material-prices-view";

export default async function OfferCostMaterialPricesPage() {
  const supabase = await createClient();
  const book = await loadCostMaterialPriceBook(supabase);
  const prices = book.error ? { ...MATERIAL_PRICE_DEFAULTS } : book.prices;

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="TEKLİF"
        title="Hammadde Fiyatları"
        hint="Yeni maliyet çalışmalarına kopyalanacak güncel birim fiyatlar."
        backHref="/offers/tanimlar"
        backLabel="Tanımlar"
      />
      {book.error ? (
        <p className="border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
          Hammadde fiyat defteri okunamadı. Veritabanı göçü uygulanmamış olabilir (
          <span className="font-mono">offer_cost_material_prices</span>).
        </p>
      ) : null}
      <MaterialPricesView prices={prices} />
    </div>
  );
}
