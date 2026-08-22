// Dosyalar — ressamın klasörünün olduğu gibi göründüğü ekran.
//
// GENEL BAKIŞTAN ÇIKARILDI ve kendi bölümü oldu. İkisi bir sayfada yan yana
// dururken 454 dosyalı bir pakette gezgin ağacı ekranın dışına itiyor, ağaç da
// gezginin yarısına sıkışıyordu: ikisi de tam genişlik isteyen listeler ve
// aynı anda ikisine birden bakılmıyor. Ayrılınca ağaç Genel Bakış'ta tek
// başına yayılır, gezgin burada.
//
// "Dosya Ekle" YETKİ KAPISININ ARKASINDA: karar sunucuda verilir, düğme
// yetkisi olmayana hiç render edilmez.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { loadFiles, loadPackage, loadParts } from "../../data";
import { AddFilesButton } from "../add-files";
import { FileBrowser } from "../file-browser";

export default async function PackageFilesPage({
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  // Yalnız aktif bağlantıların VARLIĞI istemciye gider; ham müşteri anahtarı
  // veritabanında zaten yoktur. Paylaşma yetkisi olmayana sorgu da düğme de
  // gösterilmez.
  const { data: shareRows } =
    yazabilir && dosyalar.length > 0
      ? await supabase
          .from("drawing_public_shares")
          .select("file_id")
          .in("file_id", dosyalar.map((d) => d.id))
          .is("revoked_at", null)
      : { data: null };

  return (
    <FileBrowser
      packageId={id}
      dosyalar={dosyalar}
      sharedFileIds={yazabilir ? (shareRows ?? []).map((row) => row.file_id as string) : undefined}
      ekle={
        yazabilir ? (
          <AddFilesButton
            packageId={id}
            // ÖNERİ PAKETİN GERÇEK AĞACINDAN KURULUR: uydurma bir yol açılmaz,
            // ressamın düzeni korunur.
            folders={dosyalar.map((d) => ({ folder: d.folder, role: d.role }))}
            mevcutYollar={dosyalar.map((d) => d.rel_path)}
            resimsizParca={parcalar.filter((p) => p.kind === "imalat" && !p.has_sheet).length}
          />
        ) : null
      }
    />
  );
}
