// Fiyat Arşivi — "bunu daha önce kaça almışız?"
//
// Kullanıcı kararı (md. 13): "Ürünlere teklifler ve fiyatlar girildikçe ileriye
// doğru ürün fiyatları oluşacak, böylece elimizde referans fiyatlarımız olacak.
// Örneğin RULMAN 6205-Z ürününü önceden kaça almışız, ne zaman almışız kolayca
// bulabilelim. Fiyatlar Euro olacak."
//
// ÜÇ KAYNAK, ÜÇÜ DE AYRI SAYILIR:
//   · TEKLİF   — istenen fiyat; alınmamış olabilir
//   · SİPARİŞ  — bu uygulamadan verilmiş, gerçekleşmiş alım
//   · DEVRALINAN — Excel'den gelen geçmiş fatura (4722 satır, SATIN-21)
// Tek listede karıştırmak, "kaça aldık" sorusuna "kaça teklif geldi" cevabını
// verirdi; sıralama ve "son alış" teklifleri DIŞARIDA bırakır.
//
// ————————————————————————————————————— SÜZGEÇ VE SAYFALAMA SUNUCUDA
//
// Ekran bir süre bütün arşivi (1675 kalem, 360 KB) istemciye gönderiyor ve
// orada süzüyordu; kullanıcı iki kez "yavaş" dedi ve ölçüm onu doğruladı —
// görünümün kendisi 54 ms, maliyet taşımaydı. Sayfa artık YALNIZ GÖRÜNEN 100
// satırı çeker (~58 KB) ve süzgeç `where` ile TÜM arşivde çalışır.
//
// DURUM ADRESTE DURUR (`searchParams`): aranan bir fiyatın bağlantısı
// paylaşılabilir, geri düğmesi çalışır ve sunucu bileşeni her istekte doğru
// dilimi kurar. İstemcide tutulan bir süzgeç bunların üçünü de kaybettirirdi.

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { loadArsivSecenekleri, loadFiyatDizini } from "../data";
import { PriceArchive } from "./price-archive";

/** Çoklu süzgeç adreste virgülle durur; boş değerler elenir. */
function liste(v: string | string[] | undefined): string[] {
  const ham = Array.isArray(v) ? v.join(",") : (v ?? "");
  return ham
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default async function PricesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const q = typeof sp.q === "string" ? sp.q : "";
  const isNumaralari = liste(sp.is);
  const kategoriler = liste(sp.kat);
  const tedarikciler = liste(sp.ted);
  const kaynaklar = liste(sp.kaynak);
  const sayfa = Math.max(1, Number(sp.sayfa) || 1);

  const [sonuc, secenekler, { data: kullanici }] = await Promise.all([
    loadFiyatDizini(supabase, {
      q,
      isNumaralari,
      kategoriler,
      tedarikciler,
      kaynaklar,
      sayfa,
    }),
    loadArsivSecenekleri(supabase),
    supabase.auth.getUser(),
  ]);

  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };

  return (
    <PriceArchive
      sonuc={sonuc}
      secenekler={secenekler}
      filtre={{ q, isNumaralari, kategoriler, tedarikciler, kaynaklar }}
      isAdmin={isAdminRole(profil?.role)}
    />
  );
}
