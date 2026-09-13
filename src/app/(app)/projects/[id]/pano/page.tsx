// PANO YERLEŞİMİ — elektrik projesinden pano boyutlandırma ve şema.
//
// PLAN SAKLANMAZ: yerleşim burada, sunucuda, her açılışta yeniden hesaplanır
// (`purchasing/hammadde/yerlesim` ile aynı doktrin). Veritabanından gelen tek
// şey kullanıcının KARARLARIDIR — pano gövde seçimleri, aygıt düzeltmeleri,
// ürün ölçüleri ve onay.
//
// Oturum kontrolü `(app)/layout.tsx`tedir; burada YETKİ ve VARLIK sınanır.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { loadPanoVerisi } from "./pano-data";
import { PanoView } from "./pano-view";

export default async function PanoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sorgu = await searchParams;

  const veri = await loadPanoVerisi(id, sorgu);
  if (!veri) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <PanoView
      projectId={id}
      docNo={veri.project.docNo}
      projectName={veri.project.name}
      canEdit={canEditReports((profil as { role?: string } | null)?.role)}
      belgeVar={veri.belgeVar}
      belgeAdi={veri.belgeAdi}
      belgeRevizyon={veri.belgeRevizyon}
      okunduMu={veri.okunduMu}
      parcaSayisi={veri.parcaSayisi}
      sonuc={veri.sonuc}
      panoKararlari={veri.panoKararlari}
      aygitKararlari={veri.aygitKararlari}
      onay={veri.onay}
    />
  );
}
