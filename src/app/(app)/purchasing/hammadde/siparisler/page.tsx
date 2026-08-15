// HAMMADDE SİPARİŞLERİ — sunucu kabuğu.
//
// Kullanıcı kararı (15.08.2026): *"Teklif sayfasına benzer bir sayfayı
// siparişler adında bir sayfa yapalım. Oluşan siparişler bu sayfaya düşsün …
// önceden sadece sipariş toplamını kontrol ediyordum. Yeni siparişlerde
// siparişe bastığımda içi de açılabilir."*
//
// ═══════════════════════════════════════ NEDEN /purchasing/siparisler YETMEDİ
//
// O ekran BÜTÜN siparişleri yönetir (rulman, motor, nakliye) ve sütun düzeni
// ticari akışa göredir: ödeme koşulu, avans, teslim işaretleri. Hammaddede
// sorulan şey farklıdır ve TEK BİR BÜYÜKLÜĞE bağlıdır: KİLO. "Bu ay kaç ton
// sac aldık, kilosu kaça geldi" sorusunun cevabı orada hiç yoktur.
//
// Sayfa AYNI DEFTERİ okur (`loadSiparisler`), ikinci bir sipariş tablosu
// açmaz — süzgeç ve sunum ayrıdır, gerçek tektir.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import { loadAlimlar } from "../alim-data";
import { OrdersView } from "./orders-view";

export default async function HammaddeSiparisleriPage() {
  const supabase = await createClient();
  const [{ data: kullanici }, veri] = await Promise.all([
    supabase.auth.getUser(),
    loadAlimlar(supabase),
  ]);
  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };

  return (
    <OrdersView siparisler={veri.siparisler} canWrite={canEditPurchasing(profil?.role)} />
  );
}
