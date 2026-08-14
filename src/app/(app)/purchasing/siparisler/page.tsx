// Siparişler — açılmış siparişlerin defteri.
//
// Talep Havuzu "ne lazım" der; bu ekran "ne verdik" der. İkisi ayrı sayfadadır
// çünkü ayrı sorulardır: havuzda satır KALEMdir, burada satır SİPARİŞtir ve bir
// sipariş birden çok kalemi, birden çok projeyi taşır (md. 7).

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing, isAdminRole } from "@/lib/roles";
import {
  loadQualities,
  loadSiparisNolari,
  loadSiparisler,
  loadSonKur,
  loadTedarikciDefteri,
  loadTedarikciler,
} from "../data";
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
  // YÖNETİCİ İPTAL EDİLEN SİPARİŞİ SİLEBİLİR (kullanıcı kararı, 14.08.2026):
  // "denemeler yapıyoruz, gerekiyor". Silme yalnız yönetici + yalnız iptal
  // edilmiş sipariş.
  const yonetici = isAdminRole(profil?.role);

  // İPTAL EDİLENLER DE OKUNUR: ekran onları soluk gösterir. Sorgudan düşürmek,
  // "bu siparişi ben iptal etmiştim" diyen kullanıcının kaydını yok etmek olurdu.
  //
  // DÜZENLEME PENCERESİ HAVUZUN VERİSİNİ İSTER (tedarikçi listesi, firma
  // defteri, kullanılmış numaralar, günlük kur): sipariş açan pencere ile aynı
  // alanları yazıyor ve ikisinin farklı bir öneri üretmesi, aynı kaydın iki
  // ekranda iki kural izlemesi demek olurdu.
  const [siparisler, tedarikciler, defter, siparisNolari, sonKur, qualities] = await Promise.all([
    loadSiparisler(supabase, { iptalDahil: true }),
    loadTedarikciler(supabase),
    loadTedarikciDefteri(supabase),
    loadSiparisNolari(supabase),
    loadSonKur(supabase),
    loadQualities(supabase),
  ]);

  return (
    <OrdersView
      siparisler={siparisler}
      tedarikciler={tedarikciler}
      defter={defter}
      siparisNolari={siparisNolari}
      sonKur={sonKur}
      qualities={qualities}
      canWrite={yazabilir}
      isAdmin={yonetici}
    />
  );
}
