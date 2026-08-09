// Paket genel bakışı: MONTAJ AĞACI + DOSYA GEZGİNİ.
//
// İkisi de kendi dosyasında; bu sayfa yalnız veriyi çeker ve yerleştirir.
// Ayrım `/dev/drawings-preview`in ikisini de auth'suz basabilmesi için:
// her değişikliği gerçek bir yüklemeyle denemek zorunda kalmak, kusurların
// kullanıcıya ulaşmasına sebep oluyordu.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadFiles, loadPackage, loadParts } from "../data";
import { AssemblyTree } from "./assembly-tree";
import { FileBrowser } from "./file-browser";

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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <AssemblyTree parts={parcalar} filesById={new Map(dosyalar.map((d) => [d.id, d]))} />
      <FileBrowser dosyalar={dosyalar} />
    </div>
  );
}
