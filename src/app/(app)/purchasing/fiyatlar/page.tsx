// Fiyat Arşivi — "bunu daha önce kaça almışız?"
//
// Kullanıcı kararı (md. 13): "Ürünlere teklifler ve fiyatlar girildikçe ileriye
// doğru ürün fiyatları oluşacak, böylece elimizde referans fiyatlarımız olacak.
// Örneğin RULMAN 6205-Z ürününü önceden kaça almışız, ne zaman almışız kolayca
// bulabilelim. Fiyatlar Euro olacak."
//
// ARŞİV İKİ KAYNAKTAN BESLENİR ve ikisi AYRI durur:
//   · TEKLİF  — istenen fiyat; alınmamış olabilir
//   · SİPARİŞ — ödenen fiyat; gerçekleşmiş olan budur
// Tek listede karıştırmak, "kaça aldık" sorusuna "kaça teklif geldi" cevabını
// verirdi. Satır ikisini ayrı sütunlarda gösterir; sıralama SİPARİŞ fiyatına
// göredir çünkü referans olan odur.
//
// ARŞİV PAKETTEN BAĞIMSIZDIR: anahtar normalleştirilmiş tanımdır ve paket
// silinse bile fiyat yaşar (`package_id` `on delete set null`). Bir kalemin
// bugün havuzda olmaması, geçen sene alınmadığı anlamına gelmez — bu yüzden
// ekran havuzu DEĞİL doğrudan teklif ve sipariş defterlerini okur.

import { createClient } from "@/lib/supabase/server";
import { loadGecmisOzetleri, loadSiparisler, loadTeklifler } from "../data";
import { isAdminRole } from "@/lib/roles";
import { PriceArchive, type FiyatKalemi, type FiyatOlayi } from "./price-archive";
import { eurKarsiligi } from "@/lib/purchasing/terms";

export default async function PricesPage() {
  const supabase = await createClient();

  const [teklifler, siparisler, gecmis, { data: kullanici }] = await Promise.all([
    loadTeklifler(supabase),
    loadSiparisler(supabase, { iptalDahil: true }),
    loadGecmisOzetleri(supabase),
    supabase.auth.getUser(),
  ]);

  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };

  const kalemler = new Map<string, FiyatKalemi>();

  function kalem(key: string, tanim: string): FiyatKalemi {
    const varOlan = kalemler.get(key);
    if (varOlan) {
      if (!varOlan.tanim && tanim) varOlan.tanim = tanim;
      return varOlan;
    }
    const yeni: FiyatKalemi = { key, tanim, olaylar: [] };
    kalemler.set(key, yeni);
    return yeni;
  }

  for (const t of teklifler) {
    kalem(t.matchKey, t.sample).olaylar.push({
      id: `t-${t.id}`,
      tur: "teklif",
      supplier: t.supplier,
      gun: t.quotedAt,
      birim: t.unitPrice,
      currency: t.currency,
      birimEur: t.unitPriceEur,
      adet: t.qty,
      secildi: t.chosen,
      iptal: false,
      itemNo: t.itemNo,
    });
  }

  for (const s of siparisler) {
    for (const l of s.satirlar) {
      if (l.unitPrice == null) continue;
      kalem(l.matchKey, l.sample).olaylar.push({
        id: `s-${l.id}`,
        tur: "siparis",
        supplier: s.supplier,
        gun: s.orderedAt,
        birim: l.unitPrice,
        currency: s.currency,
        birimEur: eurKarsiligi(l.unitPrice, s.currency, s.fxRate),
        adet: l.qty,
        secildi: false,
        // İPTAL EDİLEN SİPARİŞ ARŞİVDE KALIR ama işaretlidir: o gün o fiyata
        // anlaşılmıştı ve bu bir referanstır; ama "aldık" demek yanlış olurdu.
        iptal: Boolean(s.cancelledAt),
        itemNo: l.itemNo,
      });
    }
  }

  // ————————————————————————————————— DEVRALINAN KATMAN (üçüncü kaynak)
  //
  // ÖZET GELİR, OLAY DEĞİL. 4722 satırın tamamını istemciye göndermek 1,3 MB
  // ediyordu ve ekran satır başına yedi sayı gösteriyor; ayrıntı yalnız
  // kullanıcı satırı açtığında çekilir (`loadGecmisSatirlari`). Ölçüm ve
  // gerekçe: migration 20260813010003.
  for (const g of gecmis) {
    kalem(g.matchKey, g.sample).gecmis = g;
  }

  // Olaylar TARİHE göre yeniden eskiye: son fiyat en üstte, referans odur.
  const liste = [...kalemler.values()];
  for (const k of liste) k.olaylar.sort((a, b) => b.gun.localeCompare(a.gun));
  // SIRALAMA TARİHE GÖRE YENİDEN ESKİYE (kullanıcı kararı, 13.08.2026).
  // Alfabetik sıra arşivin sorusuna cevap vermiyordu: "en son ne aldık"
  // sorusunun cevabı listenin BAŞINDA olmalı. Olaylar zaten yeniden eskiye
  // sıralı, yani her kalemin ilk olayı onun EN SON hareketidir.
  liste.sort((a, b) => {
    const ax = a.olaylar[0]?.gun ?? "";
    const bx = b.olaylar[0]?.gun ?? "";
    return bx.localeCompare(ax) || a.tanim.localeCompare(b.tanim, "tr");
  });

  return <PriceArchive kalemler={liste} isAdmin={isAdminRole(profil?.role)} />;
}

export type { FiyatKalemi, FiyatOlayi };
