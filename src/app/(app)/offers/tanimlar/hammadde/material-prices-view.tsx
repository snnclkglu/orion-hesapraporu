"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { MATERIAL_PRICE_DEFS } from "@/lib/offers/cost/registry";
import { saveCostMaterialPrices } from "./actions";

export function MaterialPricesView({
  prices,
  preview = false,
}: {
  prices: Record<string, number | null>;
  preview?: boolean;
}) {
  const [draft, setDraft] = useState(prices);
  const [pending, startTransition] = useTransition();

  function kaydet() {
    if (preview) return void toast.info("Önizlemede veritabanına yazılmaz.");
    startTransition(async () => {
      const result = await saveCostMaterialPrices({ prices: draft });
      if (result.error) return void toast.error(result.error);
      toast.success("Hammadde fiyatları kaydedildi.");
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 border bg-card p-3 text-sm sm:grid-cols-3">
        <p className="text-muted-foreground">
          <strong className="block text-foreground">Yeni maliyet</strong>
          Bu defterin o andaki kopyasıyla açılır.
        </p>
        <p className="text-muted-foreground">
          <strong className="block text-foreground">Teklif içi değişiklik</strong>
          Yalnız o maliyet çalışmasını etkiler.
        </p>
        <p className="text-muted-foreground">
          <strong className="block text-foreground">Geçmiş belgeler</strong>
          Defter değişince yeniden hesaplanmaz.
        </p>
      </div>

      <section className="grid gap-3 border bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">GÜNCEL BİRİM FİYATLAR</h2>
          <p className="text-xs text-muted-foreground">
            Değerler Avro/kg cinsindedir. Boş bırakılan fiyat yeni maliyette “—” olarak görünür.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          {MATERIAL_PRICE_DEFS.map((def) => (
            <div key={def.key} className="grid min-w-0 gap-1.5">
              <label htmlFor={`global-material-${def.key}`} className="text-xs font-medium">
                {def.label} <span className="text-muted-foreground">[€/kg]</span>
              </label>
              <SayiKutusu
                id={`global-material-${def.key}`}
                value={draft[def.key] ?? null}
                disabled={pending}
                onChange={(value) => setDraft((current) => ({ ...current, [def.key]: value }))}
                className="h-10 text-right font-mono"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={kaydet} disabled={pending} className="oc-tap">
          <Save className="size-4" /> {pending ? "Kaydediliyor…" : "Fiyatları Kaydet"}
        </Button>
      </div>
    </div>
  );
}
