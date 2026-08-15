// HAMMADDE ALIM ANALİZİ — sunucu kabuğu.
//
// Kullanıcı kararı (15.08.2026): *"Sonrasında yanına bir analiz sayfası yapıp
// ortalama fiyatların gidişatını da kontrol ediyorum."*
//
// ═══════════════════════════════════════ VERİ İSTEMCİYE BÜTÜN GİDER
//
// Sarf Analizi'nde öğrenilen ders (md. 21) tersine değil, ÖLÇÜYE göre
// uygulanır: orada 1675 kalem × ayrıntı = 360 KB taşınıyordu ve sunucuya
// alınması gerekti. Burada defter 447 devralınan satır + bir avuç sipariş
// satırıdır (~60 KB) ve ekranın altı süzgeci birbirine bağlıdır — her çipte
// sunucuya gitmek, sayfayı kullanılamaz yavaşlıkta yapardı. Defter büyürse
// (birkaç bin satır) süzme sunucuya taşınır; eşik burada yazılıdır.

import { createClient } from "@/lib/supabase/server";
import { loadAlimlar } from "../alim-data";
import { AnalysisView } from "./analysis-view";

export default async function AlimAnaliziPage() {
  const supabase = await createClient();
  const veri = await loadAlimlar(supabase);

  return (
    <AnalysisView
      satirlar={veri.satirlar}
      kiloDisiSatir={veri.kiloDisiSatir}
      siparisSayisi={veri.siparisler.filter((s) => !s.cancelledAt).length}
    />
  );
}
