// Parça defteri — sunucu kabuğu; tablo, süzgeç ve sıralama istemcide.
//
// KODSUZ SATIRLAR DA BURADADIR. Bir BOM'un satırlarının yarısında parça
// numarası yoktur (civata, segman, rulman, satın alınan üniteler); satın alma
// listesi tam olarak onlardan çıkacağı için düşürülmeleri modülün
// sebeplerinden birini yok ederdi.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadFiles, loadPackage, loadParts } from "../../data";
import { PartsTable } from "./parts-table";

export default async function PackagePartsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const [parcalar, dosyalar] = await Promise.all([
    loadParts(supabase, id),
    loadFiles(supabase, id),
  ]);

  if (parcalar.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
        <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
          [ DEFTER BOŞ ]
        </h2>
        <p className="max-w-sm text-sm text-foreground/70">
          Bu pakette okunabilen bir ürün ağacı bulunamadı. Dosyalar arşivde
          duruyor; Excel eklenip “Yeniden Eşleştir” çalıştırıldığında defter
          kurulur.
        </p>
      </div>
    );
  }

  return <PartsTable packageId={id} parts={parcalar} files={dosyalar} />;
}
