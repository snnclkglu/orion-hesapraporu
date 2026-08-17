// Görev Şablonu — İşler'deki "Şablondan Ekle"nin kaynağı.
//
// Defter BOŞ BAŞLAR: hazır madde uydurulmaz (SATIN-21); firmanın gerçek
// kontrol listesi neyse onu yönetici yazar. Boş durum bunu açıkça söyler.

import { createClient } from "@/lib/supabase/server";
import { TemplatesView, type TemplateRow } from "./templates-view";

export default async function TaskTemplatesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_task_templates")
    .select("id, title, sort, active")
    .order("sort", { ascending: true });

  const rows: TemplateRow[] = ((data ?? []) as {
    id: string;
    title: string;
    sort: number;
    active: boolean;
  }[]).map((r) => ({ id: r.id, title: r.title, active: r.active }));

  return <TemplatesView templates={rows} />;
}
