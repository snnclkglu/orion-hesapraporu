import { MaterialPricesView } from "@/app/(app)/offers/tanimlar/hammadde/material-prices-view";
import { MATERIAL_PRICE_DEFAULTS } from "@/lib/offers/cost/registry";

export default function MaterialPricesPreviewPage() {
  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-4">
      <h1 className="text-lg font-semibold">Hammadde Fiyatları — Önizleme</h1>
      <MaterialPricesView preview prices={{ ...MATERIAL_PRICE_DEFAULTS }} />
    </main>
  );
}
