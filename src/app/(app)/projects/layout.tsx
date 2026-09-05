import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { canSeeEngineering } from "@/lib/roles";

/**
 * Mühendislik sunucu kapısı. Menüden gizlemek tek başına güvenlik değildir;
 * kullanıcı doğrudan `/projects/...` adresi yazsa da yalnız Yönetici, Müdür ve
 * Mühendis içeri girer. Veri katmanındaki karşılığı `can_see_engineering()`
 * RLS politikasıdır.
 */
export default async function EngineeringLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getSessionProfile();
  if (!profile || !canSeeEngineering(profile.role)) redirect("/jobs");
  return children;
}
