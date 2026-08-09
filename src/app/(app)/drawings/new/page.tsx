// Yükleme sihirbazı — sunucu kabuğu.
//
// Yetki BURADA sorulur: bölüm layout'unda kapı yok (okuma herkese açık) ama
// yükleme üç roldedir. Asıl engel yine RLS ve eylemin kendi kontrolüdür;
// buradaki yönlendirme kullanıcıya boş bir form yerine anlamlı bir yer
// göstermek içindir.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { FolderPicker } from "./folder-picker";

export default async function NewDrawingPackagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!canEditDrawings(profile?.role)) redirect("/drawings");

  return (
    <div className="grid gap-4">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/drawings" className="inline-flex items-center hover:underline">
          <ChevronLeft className="size-4" />
          Teknik Resimler
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Klasör Yükle</span>
      </nav>

      <FolderPicker />
    </div>
  );
}
