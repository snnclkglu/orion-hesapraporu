import Link from "next/link";
import { BarChart3, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { canEditConsumableExpenses } from "@/lib/roles";
import { ExpenseEntry } from "./expense-entry";
import { RecentExpenses } from "./recent-expenses";
import { loadConsumableCatalogs, loadRecentConsumableExpenses } from "./data";

export default async function ConsumableEntryPage() {
  const supabase = await createClient();
  const [{ data: auth }, catalogs, recent] = await Promise.all([
    supabase.auth.getUser(),
    loadConsumableCatalogs(supabase),
    loadRecentConsumableExpenses(supabase),
  ]);
  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  const canEdit = canEditConsumableExpenses(profile?.role);

  return (
    <div className="grid gap-5">
      {canEdit ? (
        <ExpenseEntry
          initialItems={catalogs.items}
          initialSuppliers={catalogs.suppliers}
          groups={catalogs.groups}
        />
      ) : (
        <div className="flex items-start gap-3 border bg-muted/30 p-4">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Sarf kayıtları salt okunur</h2>
            <p className="text-sm text-muted-foreground">
              Planlama bu defteri ve analizleri görebilir. Yeni kayıt, düzenleme ve silme yalnız
              Yönetici ile Satın Alma rolündedir.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/purchasing/sarf/analiz">
            <BarChart3 /> Sarf Analizine Git
          </Link>
        </Button>
      </div>
      <RecentExpenses rows={recent} />
    </div>
  );
}
