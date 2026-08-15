// Siparişler — açılmış siparişlerin defteri. TEK sipariş ekranı.
//
// Talep Havuzu "ne lazım" der; bu ekran "ne verdik" der. İkisi ayrı sayfadadır
// çünkü ayrı sorulardır: havuzda satır KALEMdir, burada satır SİPARİŞtir ve bir
// sipariş birden çok kalemi, birden çok projeyi taşır (md. 7).
//
// ═══════════════════════════ İKİNCİ SİPARİŞ EKRANI KALDIRILDI (15.08.2026)
//
// Kullanıcı kararı: *"Hammadde bölümündeki siparişler sayfasını Satın Alma
// Siparişler sayfasıyla birleştirsek. İki ayrı siparişler sayfası olmasa güzel
// olur. … Siparişler sayfasının yapısını hem ekipman hem hammaddeye uygun
// planla."*
//
// `/purchasing/hammadde/siparisler` ikinci bir defter DEĞİLDİ — aynı defterin
// süzülmüş bir okunuşuydu ve tek gerçek gerekçesi KİLOydu ("bu ay kaç ton sac
// aldık"). Gerekçe çürümedi, KARŞILANDI: kilo artık bu ekranda hem özet
// kartında hem satırda var, kalem detayı tür/kalite/teslim taşıyor ve TÜR bir
// süzgeç oldu. Geriye yalnız ikinci ekranın maliyeti kalmıştı — orada yazma
// yolu yoktu ve kullanıcı düzenlemek için buraya gönderiliyordu.
//
// Hammadde rayındaki sekme bu ekrana `?tur=hammadde` ile girer: kapı duruyor,
// oda tek.

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

const TURLER = ["hammadde", "ekipman", "karma"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const turHam = sp.tur;
  // ADRESTEKİ SÜZGEÇ SÜZÜLÜR: elle yazılmış bir `?tur=filan` sessizce boş bir
  // liste üretip ekranı boşaltırdı.
  const baslangicTurleri = (Array.isArray(turHam) ? turHam : turHam ? [turHam] : []).filter((t) =>
    TURLER.includes(t)
  );

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
      baslangicTurleri={baslangicTurleri}
      canWrite={yazabilir}
      isAdmin={yonetici}
    />
  );
}
