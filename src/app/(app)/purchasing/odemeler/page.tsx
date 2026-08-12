// Ödeme Takvimi — "ne zaman ne kadar para çıkacak?"
//
// Kullanıcı kararı (md. 12): "… ödenecek ürünler vs kolayca anlaşılabilmeli ki
// FİNANSA BİLGİ VERİLSİN."
//
// Ekranın müşterisi satınalmacı değil FİNANStır ve onun sorusu tek bir sayıdır:
// bu ay kaç avro çıkacak. Bu yüzden satır SİPARİŞ değil ÖDEMEdir — bir
// siparişin avansı ile bakiyesi AYRI aylara düşer ve tek satırda gösterilemez.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import { loadSiparisler } from "../data";
import { PaymentBoard, type OdemeSatiri } from "./payment-board";
import { advanceAmount, avansGunu, eurKarsiligi, odemeGunu } from "@/lib/purchasing/terms";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditPurchasing(profil?.role);

  const siparisler = await loadSiparisler(supabase);

  // ÖDEME SATIRLARI SUNUCUDA ÜRETİLİR. İstemcide üretilseydi Excel çıktısı ve
  // ekran iki ayrı yerde aynı bağıntıyı yazardı — Satış Takibi'nin dersi
  // (md. 16): ekran ile belge aynı yerden okur.
  const satirlar: OdemeSatiri[] = [];
  for (const s of siparisler) {
    const toplam = s.satirlar.reduce((t, l) => t + l.qty * (l.unitPrice ?? 0), 0);
    const avans = advanceAmount(toplam, s.advancePct, s.advanceAmount);
    const bakiye = Math.max(0, toplam - avans);

    if (avans > 0) {
      satirlar.push({
        id: `${s.id}-avans`,
        orderId: s.id,
        tur: "avans",
        supplier: s.supplier,
        orderNo: s.orderNo,
        // AVANS SİPARİŞ GÜNÜNDE ÖDENİR — peşinatın tanımı budur, vadesi yoktur.
        gun: avansGunu(s),
        tutar: avans,
        currency: s.currency,
        tutarEur: eurKarsiligi(avans, s.currency, s.fxRate),
        odendi: Boolean(s.advancePaidAt),
        odendiGun: s.advancePaidAt,
        kalemSayisi: s.satirlar.length,
        isler: [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))],
      });
    }

    if (bakiye > 0) {
      satirlar.push({
        id: `${s.id}-bakiye`,
        orderId: s.id,
        tur: avans > 0 ? "bakiye" : "tamami",
        supplier: s.supplier,
        orderNo: s.orderNo,
        // ÖDEME GÜNÜ TESLİMDEN SAYILIR (kullanıcı kararı, md. 11). Mal
        // gelmediyse termin esas alınır; ikisi de yoksa gün YOKTUR ve satır
        // "tarihsiz" bandında görünür — sessizce bugüne düşmez.
        gun: odemeGunu(s),
        tutar: bakiye,
        currency: s.currency,
        tutarEur: eurKarsiligi(bakiye, s.currency, s.fxRate),
        odendi: Boolean(s.balancePaidAt),
        odendiGun: s.balancePaidAt,
        kalemSayisi: s.satirlar.length,
        isler: [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))],
      });
    }
  }

  return <PaymentBoard satirlar={satirlar} canWrite={yazabilir} />;
}
