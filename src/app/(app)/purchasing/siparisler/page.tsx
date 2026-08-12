// Siparişler — açılmış siparişlerin defteri.
//
// Talep Havuzu "ne lazım" der; bu ekran "ne verdik" der. İkisi ayrı sayfadadır
// çünkü ayrı sorulardır: havuzda satır KALEMdir, burada satır SİPARİŞtir ve bir
// sipariş birden çok kalemi, birden çok projeyi taşır (md. 7).

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import { loadSiparisler } from "../data";
import { OrdersView } from "./orders-view";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  const yazabilir = canEditPurchasing(profil?.role);

  // İPTAL EDİLENLER DE OKUNUR: ekran onları soluk gösterir. Sorgudan düşürmek,
  // "bu siparişi ben iptal etmiştim" diyen kullanıcının kaydını yok etmek olurdu.
  const siparisler = await loadSiparisler(supabase, { iptalDahil: true });

  return <OrdersView siparisler={siparisler} canWrite={yazabilir} />;
}
