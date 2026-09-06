// ÜRÜN ÖLÇÜ DEFTERİ — cihaz ölçülerinin denetlendiği ve girildiği ekran.
//
// Defter PROJEDEN BAĞIMSIZDIR (PANO-12): ölçü ürüne aittir ve bir kez
// girildiğinde bütün projelerde geçerlidir. Ama ekran bir PROJENİN içinden
// açılır, çünkü defteri dolduran kişinin sorusu şudur: "bu işte geçen hangi
// ürünün ölçüsü eksik?" Satırlar bu yüzden iki kaynağın birleşimidir —
// defterdeki kayıtlar ve bu projede geçen ürünler.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { loadCurrentElectricalDoc, loadElectricalParts } from "@/lib/electrical/data";
import { loadDeviceModels } from "@/lib/switchboard-data";
import { buildBook } from "@/lib/switchboard/book";
import { DefterView } from "./defter-view";

export default async function DefterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  const belge = await loadCurrentElectricalDoc(supabase, id);
  const [parcalar, modeller] = await Promise.all([
    belge ? loadElectricalParts(supabase, belge.id) : Promise.resolve([]),
    loadDeviceModels(supabase),
  ]);

  const rows = buildBook({ parts: parcalar, models: modeller });

  return (
    <DefterView
      projectId={id}
      docNo={String(project.doc_no ?? "")}
      projectName={String(project.name ?? "")}
      canEdit={canEditReports((profil as { role?: string } | null)?.role)}
      rows={rows}
      bookSize={modeller.length}
    />
  );
}
