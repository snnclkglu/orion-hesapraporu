// TEKLİF · TANIMLAR — teklifin bütün açılır listelerinin ve şablonlarının defteri.
//
// YETKİ KAPISI BURADA TEKRARLANMAZ: bölüm kabuğu (`offers/layout.tsx`) görme
// yetkisini zaten sorar ve yetkisizi geri yollar; asıl engel RLS'tir (ROL-15).
// İkinci bir kapı yazmak, yetkinin iki yerden sorulması demekti.
//
// DEFTERİN TAMAMI TEK OKUMADA GELİR (`loadOfferOptions`): liste başına sorgu
// atılsaydı bu sayfa elli sorguyla açılırdı. Ekran ile teklif editörü AYNI
// fonksiyonu çağırır — iki sorgu yazılsaydı defterde gördüğünüz ile teklifte
// önerilen sessizce ayrışırdı.

import { createClient } from "@/lib/supabase/server";
import { loadOfferOptions, type OfferTemplateRow } from "../data";
import { allOfferListKeys } from "@/lib/offers/registry";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OptionsView } from "./options-view";
import { TemplatesView } from "./templates-view";

export default async function OfferDefinitionsPage() {
  const supabase = await createClient();

  // ŞABLONLAR BURADA AYRICA SORULUR, `loadOfferTemplates` ile DEĞİL: o okuma
  // yalnız ETKİN şablonları verir (teklif açarken doğrusu odur). Defter pasif
  // olanı da göstermek zorundadır — göstermeseydi pasife alınan bir şablon
  // ekrandan tamamen kaybolur ve geri açılamazdı.
  const [rows, { data: sablonlar, error: sablonHatasi }] = await Promise.all([
    loadOfferOptions(supabase),
    supabase
      .from("offer_templates")
      .select("id, name, crane_type, skeleton, sort, active")
      .order("sort", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const templates = (sablonlar ?? []) as OfferTemplateRow[];

  // Vinç tipi önerileri şablon ekranına DEFTERDEN gider: aynı liste teklifin
  // "Vinç Tipi" satırını da besler, iki ayrı öneri kümesi olmaz.
  const craneTypes = rows
    .filter((r) => r.list_key === "val.craneType" && r.active && !r.parent_id)
    .map((r) => r.value);

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="TEKLİF"
        title="Tanımlar"
        hint="Tekliflerde önerilen markaların, tip/serilerin, teknik değerlerin ve ticari şart metinlerinin tek defteri."
        backHref="/offers"
        backLabel="Teklifler"
      />

      {sablonHatasi && (
        <p className="border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
          Şablon defteri okunamadı. Veritabanı göçü uygulanmamış olabilir (
          <span className="font-mono">offer_templates</span>).
        </p>
      )}

      <Tabs defaultValue="defterler">
        <TabsList>
          <TabsTrigger value="defterler">Defterler</TabsTrigger>
          <TabsTrigger value="sablonlar">Şablonlar</TabsTrigger>
        </TabsList>

        <TabsContent value="defterler">
          <OptionsView rows={rows} listKeys={allOfferListKeys()} />
        </TabsContent>

        <TabsContent value="sablonlar">
          <TemplatesView templates={templates} craneTypes={craneTypes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
