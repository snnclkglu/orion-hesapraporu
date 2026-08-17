// Ekipman katalogu (cat_equipment) CRUD — tip filtresi + ekle/düzenle/sil.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { attrLabel, attrValueLabel } from "@/lib/catalog-mapping";
import { cn } from "@/lib/utils";
import { EQUIPMENT_KINDS, KIND_LABELS } from "../labels";
import { EquipmentDialog, DeleteEquipmentButton, type EquipmentRow } from "./equipment-dialog";

export default async function AdminEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const activeKind = EQUIPMENT_KINDS.some((k) => k.value === kind) ? kind! : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("cat_equipment")
    .select("id, kind, brand, model, attrs, notes, datasheet_url, active, sort")
    .order("kind")
    .order("sort")
    .order("brand");
  if (activeKind) query = query.eq("kind", activeKind);
  const { data: items } = await query;

  return (
    <div className="grid gap-4">
      {/* `flex-wrap` yoksa açıklama ~200px'e sıkışıp 5 satıra iniyordu. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Ekipman Katalogu</h2>
          <p className="text-sm text-muted-foreground">
            Motor, redüktör, halat vb. satın alma/seçim katalogu. Özellikler serbest
            anahtar-değer alanlarıdır.
          </p>
        </div>
        <EquipmentDialog defaultKind={activeKind} />
      </div>

      {/* ŞERİT KAYMAZ, SARAR (kullanıcı kararı, 16.08.2026 — kabuk kuralı 15,
          purchasing-nav deseni). Bir süre tek satırlık kaydırılabilir şeritti
          ("12 çip telefonda 4 satır oluyordu" gerekçesiyle); karar görünürlüğü
          seçti — bütün çipler her an görünür, gizli çip kalmaz. */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/admin/equipment"
          className={cn(
            // Ham `<a>`: dokunma payı elle verilir (sözleşme §2).
            "flex min-h-9 shrink-0 items-center rounded-md border px-2.5 text-sm pointer-coarse:min-h-10",
            !activeKind ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          Tümü
        </Link>
        {EQUIPMENT_KINDS.map((k) => (
          <Link
            key={k.value}
            href={`/admin/equipment?kind=${k.value}`}
            className={cn(
              "flex min-h-9 shrink-0 items-center rounded-md border px-2.5 text-sm pointer-coarse:min-h-10",
              activeKind === k.value
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {k.label}
          </Link>
        ))}
      </div>

      {/* "Tabloyu yana kaydırın" ipucu kalktı: telefonda tablo artık listeye
          katlanıyor, kaydıracak bir şey kalmadı (ROL-15). Ara genişliklerde
          olası taşmayı `Table`ın kendi `.oc-scrollx` gölgesi gösterir. */}
      <div className="rounded-lg border">
        {/* Yüzlerce satırlık katalog: kap `md` üstünde 70dvh'ye kelepçeli,
            başlık yapışkan (oc-table-clamp + oc-sticky-head sözleşmesi). */}
        <Table containerClassName="oc-table-clamp">
          <TableHeader className="oc-sticky-head">
            <TableRow>
              {/* Dar ekranda tip ve durum markanın altındaki ikinci satıra
                  iner; özellikler serbest metindir ve yarım kesilmiş hâli
                  hiç göstermemekten kötüdür (sözleşme §8). */}
              <TableHead className="hidden md:table-cell">Tip</TableHead>
              <TableHead>Marka</TableHead>
              {/* Telefonda tablo listeye katlanır (MOBIL-15): model kendi sütunu
                  yerine markanın altına iner — marka + model + eylemler 375px'i
                  taşırıyordu. */}
              <TableHead className="hidden sm:table-cell">Model</TableHead>
              <TableHead className="hidden lg:table-cell">Özellikler</TableHead>
              <TableHead className="hidden md:table-cell">Durum</TableHead>
              <TableHead className="w-36" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((item) => {
              const attrsText =
                Object.entries((item.attrs ?? {}) as Record<string, unknown>)
                  .map(([k, v]) => `${attrLabel(k)}: ${attrValueLabel(k, v)}`)
                  .join(" · ") || "—";
              const kindText = KIND_LABELS[item.kind] ?? item.kind;
              return (
                <TableRow key={item.id}>
                  <TableCell className="hidden text-sm md:table-cell">{kindText}</TableCell>
                  <TableCell className="font-medium break-words whitespace-normal">
                    {item.brand}
                    {/* Telefon katmanı: gizlenen Model buraya iner (md. 15). */}
                    <div className="mt-0.5 font-mono text-[12px] font-normal sm:hidden">
                      {item.model}
                    </div>
                    <div className="mt-0.5 text-[11px] font-normal text-muted-foreground md:hidden">
                      {kindText} · {item.active ? "aktif" : "pasif"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{item.model}</TableCell>
                  {/* `max-w-64` doğrudan `td` üzerinde ETKİSİZDİ (otomatik tablo
                      yerleşiminde `td` max-width'i yok sayar): uzun `attrs`
                      metni tabloyu birkaç ekran genişletiyordu. Sınır blok bir
                      iç öğeye taşındı. */}
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    <span className="block max-w-64 truncate" title={attrsText}>
                      {attrsText}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={item.active ? "outline" : "secondary"}>
                      {item.active ? "aktif" : "pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <EquipmentDialog item={item as EquipmentRow} />
                      <DeleteEquipmentButton id={item.id} name={`${item.brand} ${item.model}`} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {(items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {activeKind
                    ? `${KIND_LABELS[activeKind]} kaydı yok. "Yeni Ekipman" ile ekleyin.`
                    : 'Katalog boş. "Yeni Ekipman" ile ekleyin.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
