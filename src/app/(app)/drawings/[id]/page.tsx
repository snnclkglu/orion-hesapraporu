// Paket genel bakışı: MONTAJ AĞACI.
//
// DOSYA GEZGİNİ BURADAN ÇIKTI (bkz. `files/page.tsx`). İkisi yan yana
// dururken ikisi de yarım genişlikte kalıyordu; oysa ağaç altı segmentli
// kodlarla (`0043-00-0802-00-02-06`) yatayda yer ister ve gezginin dosya
// adları da öyle. Genel Bakış artık tek bir soruya cevap veriyor: bu paketin
// içinde ne var?
//
// Ağaç kendi dosyasındadır ki `/dev/drawings-preview` onu auth'suz basabilsin:
// her değişikliği gerçek bir yüklemeyle denemek zorunda kalmak, kusurların
// kullanıcıya ulaşmasına sebep oluyordu.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadFiles, loadPackage, loadParts } from "../data";
import { AssemblyTree } from "./assembly-tree";

export default async function PackageOverviewPage({
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

  // Ağaç ARTIK İSTEMCİDEDİR (katlanır oldu) ve prop'ları RSC yükünde taşınır:
  // dosyadan yalnız üç alan geçer, `meta` dâhil bütün satırı telefona indirmek
  // 454 dosyalı bir pakette yüzlerce KB olurdu.
  return (
    <AssemblyTree
      parts={parcalar}
      files={dosyalar.map((d) => ({
        id: d.id,
        storage_path: d.storage_path,
        file_name: d.file_name,
      }))}
    />
  );
}
