// Siparişler — açılmış siparişlerin defteri.
//
// Talep Havuzu "ne lazım" der; bu ekran "ne verdik" der. İkisi ayrı sayfadadır
// çünkü ayrı sorulardır: havuzda satır KALEMdir, burada satır SİPARİŞtir ve bir
// sipariş birden çok kalemi, birden çok projeyi taşır (md. 7).

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing, tagsOf } from "@/lib/roles";
import { loadSiparisler } from "../data";
import { OrdersView } from "./orders-view";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const zengin = user
    ? await supabase.from("profiles").select("role, tags").eq("id", user.id).maybeSingle()
    : { data: null, error: null };
  const profil = zengin.error
    ? (await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle()).data
    : zengin.data;

  const yazabilir = canEditPurchasing({
    role: (profil as { role?: string } | null)?.role ?? "",
    tags: tagsOf((profil as { tags?: string[] } | null)?.tags),
  });

  // İPTAL EDİLENLER DE OKUNUR: ekran onları soluk gösterir. Sorgudan düşürmek,
  // "bu siparişi ben iptal etmiştim" diyen kullanıcının kaydını yok etmek olurdu.
  const siparisler = await loadSiparisler(supabase, { iptalDahil: true });

  return <OrdersView siparisler={siparisler} canWrite={yazabilir} />;
}
