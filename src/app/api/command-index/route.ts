// Komut paletinin arama defteri — panoyla ORTAK hit kurucusu
// (lib/panel-index.ts). Palet açıldığında BİR KEZ çekilir; süzme istemcide
// panelAra ile yapılır (panonun "her tuşta Frankfurt'a gidilmez" kuralı).

import { createClient } from "@/lib/supabase/server";
import { buildPanelHits } from "@/lib/panel-index";
import { isAdminRole, roleOf, visibleSections } from "@/lib/roles";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum gerekli", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = roleOf((profile as { role?: string } | null)?.role);

  const [isler, kalemler, musteriler, projeler, paketler, grupAdlari] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id, job_no, title, customer, status")
        .order("job_no", { ascending: false }),
      supabase.from("job_items").select("id, job_id, item_no, product_name"),
      supabase.from("customers").select("id, name, short_name"),
      supabase
        .from("projects")
        .select("id, name, doc_no, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("drawing_packages")
        .select("id, item_no, group_code, description"),
      supabase.from("drawing_group_names").select("group_code, name"),
    ]);

  const hits = buildPanelHits({
    jobs: (isler.data ?? []) as {
      id: string; job_no: string; title: string; customer: string; status: string;
    }[],
    items: (kalemler.data ?? []) as {
      id: string; job_id: string; item_no: string; product_name: string;
    }[],
    customers: (musteriler.data ?? []) as {
      id: string; name: string; short_name: string;
    }[],
    projects: (projeler.data ?? []) as {
      id: string; name: string; doc_no: string; status: string;
    }[],
    packages: (paketler.data ?? []) as {
      id: string; item_no: string; group_code: string; description: string;
    }[],
    groupNames: (grupAdlari.data ?? []) as { group_code: string; name: string }[],
    isAdmin: isAdminRole(role),
  });

  // Sayfa listesi menüyle TEK kaynaktan (visibleSections) — palet, menünün
  // göstermediği bir bölüme yol veremez.
  const sections = visibleSections(role)
    .filter((s) => s.href !== "/")
    .map((s) => ({ href: s.href, label: s.label }));

  return Response.json({ sections, hits });
}
