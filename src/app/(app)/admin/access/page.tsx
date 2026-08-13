// YETKİ IZGARASI — veri katmanı.
//
// Sayfa yalnız kişileri okur; ızgarayı `AccessGrid` çizer. Ayrım bilinçlidir:
// görünümü auth'suz önizleme de basıyor (`/dev/access-preview`) ve dokuz
// sütunlu bir tabloyu yalnız gerçek oturumla sınayabilmek, telefonda nasıl
// davrandığını hiç görmemek demekti.

import { createClient } from "@/lib/supabase/server";
import { AccessGrid, type AccessPerson } from "./access-grid";

export default async function AdminAccessPage() {
  const supabase = await createClient();

  const { data: profiller } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("full_name");

  const kisiler: AccessPerson[] = (profiller ?? []).map((p) => ({
    id: p.id,
    ad: p.full_name || p.email || "—",
    rol: p.role ?? "",
  }));

  return <AccessGrid kisiler={kisiler} />;
}
