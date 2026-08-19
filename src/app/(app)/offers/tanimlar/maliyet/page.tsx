// MALİYET ŞABLONLARI — hangi vinç tipinde hangi maliyet bölümleri ve kalemleri
// açılır.
//
// Kullanıcı isteği (19.08.2026, md. 10): *"Maliyet bölümüne hangi grup vinçte
// örneğin Tek Kirişli Vinçte, maliyet bölümlerinin ve o bölümlerin içinde hangi
// kalemlerin geldiğini gösteren, bunlara ekleme yapabileceğim bir sayfa yapsak.
// Kontrolü daha kolay olur."*
//
// AYRI SAYFADIR, "Tanımlar"ın üçüncü sekmesi DEĞİL: defter ekranı satır satır
// bir liste, bu ekran ise iki sütunlu bir eşleme tablosudur (solda tip, sağda
// sekiz bölüm ve elli üç kalem). Aynı sekme şeridinin altına sıkıştırılsaydı
// kendi adresine bağlanamaz ve "şu tipte ne geliyor" sorusuna doğrudan link
// verilemezdi.
//
// YETKİ KAPISI BURADA TEKRARLANMAZ: bölüm kabuğu (`offers/layout.tsx`) görme
// yetkisini zaten sorar; asıl engel RLS'tir (`can_see_offer_costs`, ROL-15).
//
// VİNÇ TİPLERİ TEKLİF DEFTERİNDEN GELİR (`val.craneType`), buraya ikinci bir
// liste yazılmaz: teklifte seçilebilen her tipin burada bir karşılığı olmak
// zorundadır, yoksa şablonu hiç açılamayan bir tip kalırdı.

import { createClient } from "@/lib/supabase/server";
import { loadOfferOptions } from "../../data";
import { PageHeader } from "@/components/page-header";
import { CostTemplatesView, type CostTemplateRow } from "./cost-templates-view";

export default async function OfferCostTemplatesPage() {
  const supabase = await createClient();

  // ŞABLONLAR PASİFİYLE BİRLİKTE OKUNUR: defter, uygulanmayanı da göstermek
  // zorundadır — göstermeseydi pasife alınan bir şablon ekrandan tamamen
  // kaybolur ve geri açılamazdı (`tanimlar/page.tsx`teki aynı gerekçe).
  const [rows, { data: sablonlar, error: sablonHatasi }] = await Promise.all([
    loadOfferOptions(supabase),
    supabase
      .from("offer_cost_templates")
      .select("id, crane_type, skeleton, sort, active")
      .order("sort", { ascending: true })
      .order("crane_type", { ascending: true }),
  ]);

  const templates = (sablonlar ?? []) as CostTemplateRow[];

  const craneTypes = rows
    .filter((r) => r.list_key === "val.craneType" && r.active && !r.parent_id)
    .map((r) => r.value);

  return (
    <div className="grid gap-4">
      <PageHeader
        kicker="TEKLİF"
        title="Maliyet Şablonları"
        hint="Hangi vinç tipinde hangi maliyet bölümleri ve kalemleri açılır."
        backHref="/offers/tanimlar"
        backLabel="Tanımlar"
      />

      {sablonHatasi && (
        <p className="border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
          Şablon defteri okunamadı. Veritabanı göçü uygulanmamış olabilir (
          <span className="font-mono">offer_cost_templates</span>).
        </p>
      )}

      <CostTemplatesView craneTypes={craneTypes} templates={templates} />
    </div>
  );
}
