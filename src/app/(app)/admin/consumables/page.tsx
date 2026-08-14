// Sarf Malzemeleri ana defteri — SM kodu, varsayılan grup/birim ve kullanım izi.
//
// Kayıt sayısı ve son alım MASTER'a yazılmaz: ikisi gider olaylarından türeyen
// bilgidir. Böylece gider silindiğinde veya tarihi düzeltildiğinde ikinci bir
// sayaç/son-tarih gerçeği bayat kalmaz.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConsumableRow, type ConsumableAdminRow } from "./consumable-row";
import { NewConsumableButton } from "./new-consumable-button";

type UsageRow = { id: string; item_id: string | null; expense_date: string };

async function loadConsumableUsage(
  supabase: SupabaseClient
): Promise<{ rows: UsageRow[]; error: string | null }> {
  const rows: UsageRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("purchase_consumable_expenses")
      .select("id, item_id, expense_date")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return { rows, error: error.message };
    const page = (data ?? []) as UsageRow[];
    rows.push(...page);
    if (page.length < 1000) return { rows, error: null };
  }
}

export default async function AdminConsumablesPage() {
  const supabase = await createClient();
  const [itemsResult, usageResult] = await Promise.all([
    supabase
      .from("purchase_consumable_items")
      .select("id, code, name, group_name, default_unit, active, note")
      .order("code", { ascending: true }),
    loadConsumableUsage(supabase),
  ]);

  const usage = new Map<string, { count: number; lastPurchaseAt: string | null }>();
  for (const row of usageResult.rows) {
    if (!row.item_id) continue;
    const current = usage.get(row.item_id) ?? { count: 0, lastPurchaseAt: null };
    current.count += 1;
    if (!current.lastPurchaseAt || row.expense_date > current.lastPurchaseAt) {
      current.lastPurchaseAt = row.expense_date;
    }
    usage.set(row.item_id, current);
  }

  const rows: ConsumableAdminRow[] = (
    (itemsResult.data ?? []) as {
      id: string;
      code: string;
      name: string;
      group_name: string | null;
      default_unit: string | null;
      active: boolean;
      note: string | null;
    }[]
  ).map((item) => {
    const itemUsage = usage.get(item.id);
    return {
      id: item.id,
      code: item.code ?? "",
      name: item.name ?? "",
      groupName: item.group_name ?? "",
      defaultUnit: item.default_unit ?? "Adet",
      active: item.active !== false,
      note: item.note ?? "",
      purchaseCount: itemUsage?.count ?? 0,
      lastPurchaseAt: itemUsage?.lastPurchaseAt ?? null,
    };
  });
  const groups = [...new Set(rows.map((row) => row.groupName).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "tr")
  );
  const passiveCount = rows.filter((row) => !row.active).length;
  const purchaseCount = rows.reduce((sum, row) => sum + row.purchaseCount, 0);
  const loadError = itemsResult.error?.message ?? usageResult.error;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sarf Malzemeleri</h2>
          <p className="text-sm text-muted-foreground">
            Fabrikanın proje dışı ihtiyaçlarında kullanılan malzeme defteri. SM kodu kalıcıdır;
            ad, grup ve varsayılan birim buradan yönetilir. Kullanımdaki kayıt silinmez, pasife
            alınır.
          </p>
        </div>
        <NewConsumableButton groups={groups} />
      </div>

      {loadError && (
        <p className="border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
          Sarf malzeme defteri veya kullanım bilgileri okunamadı. Veritabanı göçü uygulanmamış
          olabilir (<span className="font-mono">purchase_consumable_items</span>).
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          {/* Telefonda kod · ad · eylemler kalır; gizlenen alanlar adın altındaki
              özet satırına iner. Yönetim rayı açıkken masaüstü genişliği de korunur. */}
          <TableHeader>
            <TableRow>
              <TableHead className="w-[7rem]">Kod</TableHead>
              <TableHead>Malzeme Adı</TableHead>
              <TableHead className="hidden lg:table-cell lg:w-[11rem]">Grup</TableHead>
              <TableHead className="hidden md:table-cell md:w-[6rem]">Birim</TableHead>
              <TableHead className="hidden text-right md:table-cell md:w-[5rem]">Kayıt</TableHead>
              <TableHead className="hidden lg:table-cell lg:w-[7rem]">Son Alım</TableHead>
              <TableHead className="hidden xl:table-cell xl:w-[18%]">Not</TableHead>
              <TableHead className="w-[6rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ConsumableRow key={row.id} row={row} groups={groups} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Defterde sarf malzeme yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {rows.length} malzeme
        {passiveCount > 0 ? (
          <>
            {" "}
            · {passiveCount} pasif
          </>
        ) : null}{" "}
        · bu malzemelere bağlı {purchaseCount} sarf gideri. Yeni malzeme Satın
        Alma&apos;daki hızlı giriş penceresinden de açılabilir; SM kodunu veritabanı verir.
      </p>
    </div>
  );
}
