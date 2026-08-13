// Tedarikçi defteri yönetimi — liste + ekle / düzenle / sil.
//
// Kullanıcı kararı (13.08.2026): defter Satın Alma'nın içinden Yönetim'e
// taşındı ve her firma bir KOD aldı (`TD0001`). Kod bir etiket değil, sipariş
// numarasının kökü: Sipariş Aç penceresi numarayı ondan üretir.
//
// EKRAN SAYAR AMA BAĞLAMAZ: "kaç sipariş / kaç teklif" sütunu `supplier`
// METNİNİ katlayarak eşleştirir, yabancı anahtarla değil (md. 21 — yayınlanmış
// sipariş defter düzeltilince değişmemeli). Sayı bu yüzden bir bağ değil bir
// KULLANIM İZİdir ve silme uyarısı ona dayanır.

import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trKatla } from "@/lib/drawings/tr-text";
import { SupplierRow, type SupplierAdminRow } from "./supplier-row";
import { NewSupplierButton } from "./new-supplier-button";

export default async function AdminSuppliersPage() {
  const supabase = await createClient();

  const [{ data: suppliers, error }, { data: orders }, { data: quotes }] = await Promise.all([
    supabase
      .from("purchase_suppliers")
      .select("id, name, code, active, note")
      .order("code", { ascending: true }),
    supabase.from("purchase_orders").select("supplier"),
    supabase.from("purchase_quotes").select("supplier"),
  ]);

  const say = (satirlar: { supplier: string | null }[] | null, hedef: Map<string, number>) => {
    for (const r of satirlar ?? []) {
      const k = trKatla((r.supplier ?? "").trim());
      if (!k) continue;
      hedef.set(k, (hedef.get(k) ?? 0) + 1);
    }
  };
  const siparisSayaci = new Map<string, number>();
  const teklifSayaci = new Map<string, number>();
  say(orders as { supplier: string | null }[] | null, siparisSayaci);
  say(quotes as { supplier: string | null }[] | null, teklifSayaci);

  const rows: SupplierAdminRow[] = (
    (suppliers ?? []) as { id: string; name: string; code: string | null; active: boolean; note: string | null }[]
  ).map((s) => {
    const anahtar = trKatla(s.name ?? "");
    return {
      id: s.id,
      name: s.name ?? "",
      code: s.code ?? "",
      active: s.active !== false,
      note: s.note ?? "",
      orderCount: siparisSayaci.get(anahtar) ?? 0,
      quoteCount: teklifSayaci.get(anahtar) ?? 0,
    };
  });

  const pasif = rows.filter((r) => !r.active).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tedarikçiler</h2>
          <p className="text-sm text-muted-foreground">
            Satın alma firmalarının defteri. Kod bir kez verilir ve sipariş
            numarasının kökü olur (<span className="font-mono">TD0007-01</span>).
            Pasife çekilen firma öneri listesinden düşer, kaydı durur.
          </p>
        </div>
        <NewSupplierButton />
      </div>

      {error && (
        <p className="border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
          Tedarikçi defteri okunamadı. Veritabanı göçü uygulanmamış olabilir
          (<span className="font-mono">purchase_suppliers</span>).
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          {/* SÜTUN ÖNCELİKLENDİRME (md. 7): dar ekranda kod · ad · eylemler
              kalır; kullanım sayıları ve not adın altına iner. */}
          <TableHeader>
            <TableRow>
              <TableHead className="w-[7rem]">Kod</TableHead>
              <TableHead>Firma Adı</TableHead>
              <TableHead className="hidden text-right md:table-cell md:w-[6rem]">Sipariş</TableHead>
              <TableHead className="hidden text-right md:table-cell md:w-[6rem]">Teklif</TableHead>
              <TableHead className="hidden md:table-cell md:w-[22%]">Not</TableHead>
              <TableHead className="md:w-[6rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <SupplierRow key={row.id} row={row} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Defterde tedarikçi yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[12px] text-muted-foreground">
        {rows.length} firma{pasif > 0 ? ` · ${pasif} pasif` : ""}. Yeni firma
        Satın Alma&apos;daki teklif ve sipariş pencerelerinden de açılabilir; kodu
        veritabanı verir.
      </p>
    </div>
  );
}
