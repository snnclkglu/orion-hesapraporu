// Teslim Takvimi — "ne zaman ne geliyor?"
//
// Kullanıcı kararı (md. 12): "Aylara veya haftalara göre teslim alınacak
// ürünler … kolayca anlaşılabilmeli."
//
// Ekran SİPARİŞ başına bir satır gösterir, kalem başına değil: tedarikçi bir
// sevkiyat yapar ve atölyenin beklediği o sevkiyattır. Kalemler satırın
// içindedir.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import { loadSiparisler } from "../data";
import { DeliveryBoard } from "./delivery-board";

export default async function DeliveryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditPurchasing(profil?.role);

  // İPTAL EDİLENLER TAKVİME GİRMEZ: beklenmeyen bir sevkiyat, takvimin
  // güvenilirliğini bitirir.
  const siparisler = await loadSiparisler(supabase);

  return <DeliveryBoard siparisler={siparisler} canWrite={yazabilir} />;
}
