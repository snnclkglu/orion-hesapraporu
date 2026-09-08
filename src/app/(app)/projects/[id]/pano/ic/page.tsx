// PANO İÇ YERLEŞİMİ — bir panonun montaj plakası, kapağı ve cihaz listesi.
//
// AYRI SAYFA, KULLANICI KARARI (08.09.2026): "pano iç yerleşimleri de ayrı
// sayfa olsun." Ana ekranda bu bölüm en ağır parçaydı — her pano için bir
// plaka çizimi artı bir kapak çizimi — ve sayfayı ölçüsüzce uzatıyordu.
//
// DİNAMİK SEGMENT (`[kod]`) YERİNE SORGU (`?pano=LVD10`) kullanılır ve bunun
// iki ölçülmüş sebebi var: (1) pano kodu EPLAN'ın konum dizesinden gelir
// (`LVD1.1` gibi noktalı, `LVD10-A` gibi bölünmüş) ve yol parçası olarak
// güvenli değildir; (2) kullanıcının kaydetmediği ölçü denemeleri zaten
// sorguda taşınıyor (PANO-14) ve sayfa değişince kaybolmamalı. `svg/route.ts`
// de aynı `?pano=` sözleşmesini kullanıyor.
//
// Oturum kontrolü `(app)/layout.tsx`tedir; burada YETKİ ve VARLIK sınanır.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { icOlcekCoz } from "@/lib/diagrams/panoLayout";
import { loadPanoVerisi } from "../pano-data";
import { IcYerlesimView } from "./ic-view";

export default async function PanoIcPage({
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

  const istenen = Array.isArray(sorgu.pano) ? sorgu.pano[0] : sorgu.pano;

  return (
    <IcYerlesimView
      projectId={id}
      docNo={veri.project.docNo}
      projectName={veri.project.name}
      canEdit={canEditReports((profil as { role?: string } | null)?.role)}
      sonuc={veri.sonuc}
      istenenPano={istenen ?? ""}
      olcek={icOlcekCoz(sorgu.olcek)}
    />
  );
}
