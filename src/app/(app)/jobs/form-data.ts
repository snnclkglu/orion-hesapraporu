// İş emri formunun beslendiği listeler: müşteri defteri + kullanıcılar.
// Yeni iş ve düzenleme sayfalarının ikisi de aynı sorguyu kullanır.

import { createClient } from "@/lib/supabase/server";
import type { PersonOption } from "./job-form";
import { CUSTOMER_COLUMNS, type CustomerOption } from "./schema";

export async function loadJobFormData(): Promise<{
  customers: CustomerOption[];
  people: PersonOption[];
}> {
  const supabase = await createClient();
  const [{ data: customers }, { data: profiles }] = await Promise.all([
    supabase
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .order("name", { ascending: true }),
    // İş lideri ve hazırlayan listeleri uygulama kullanıcılarından gelir;
    // adı girilmemiş profiller listede işe yaramaz.
    supabase
      .from("profiles")
      .select("id, full_name, title")
      .neq("full_name", "")
      .order("full_name", { ascending: true }),
  ]);

  return {
    customers: (customers ?? []) as CustomerOption[],
    people: (profiles ?? []).map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string) ?? "",
      title: (p.title as string) ?? "",
    })),
  };
}
