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
import { orderVatTotals } from "@/lib/purchasing/vat";

type SarfOdeme = {
  payment_group_id: string; payment_due_at: string; payment_paid_at: string | null;
  supplier_name: string; document_no: string; currency: string; line_count: number;
  gross_amount: number; gross_amount_eur: number; item_names: string[] | null;
  net_amount: number | null; vat_amount: number | null;
};

/** Görünümün KDV sütunları olmayabilir (migration 20260814000004). */
const SARF_ALANLARI =
  "payment_group_id, payment_due_at, payment_paid_at, supplier_name, document_no, " +
  "currency, line_count, gross_amount, gross_amount_eur, item_names";

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
  // ZENGİN + DAR (md. 21): net/KDV sütunları görünüme sonradan eklendi ve
  // uygulanmamış bir ortamda onları istemek BÜTÜN sarf ödemelerini düşürürdü.
  const zenginSarf = await supabase
    .from("purchase_consumable_payment_schedule")
    .select(`${SARF_ALANLARI}, net_amount, net_amount_eur, vat_amount`)
    .order("payment_due_at", { ascending: true });
  const sarfData = zenginSarf.error
    ? (
        await supabase
          .from("purchase_consumable_payment_schedule")
          .select(SARF_ALANLARI)
          .order("payment_due_at", { ascending: true })
      ).data
    : zenginSarf.data;

  // ÖDEME SATIRLARI SUNUCUDA ÜRETİLİR. İstemcide üretilseydi Excel çıktısı ve
  // ekran iki ayrı yerde aynı bağıntıyı yazardı — Satış Takibi'nin dersi
  // (md. 16): ekran ile belge aynı yerden okur.
  const satirlar: OdemeSatiri[] = [];
  for (const s of siparisler) {
    // KASADAN ÇIKAN PARA KDV DAHİLDİR (kullanıcı kararı, 14.08.2026). Defter
    // tutarı ve bütün analizler net kalır (`unit_price`); bu ekran finansa
    // ÖDENECEĞİ söylüyor, maliyeti değil — sarf fişleri zaten böyle düşüyordu
    // ve siparişlerin ondan farklı davranması takvimi ikiye bölerdi.
    const toplamlar = orderVatTotals(s.satirlar);
    const toplam = toplamlar.gross;
    const avans = advanceAmount(toplam, s.advancePct, s.advanceAmount);
    const bakiye = Math.max(0, toplam - avans);
    /** Satırın KDV hariç/KDV kırılımı — ödeme payına ORANLA dağıtılır. */
    const kirilim = (pay: number) => ({
      net: toplam > 0 ? (toplamlar.net * pay) / toplam : 0,
      kdv: toplam > 0 ? (toplamlar.vat * pay) / toplam : 0,
    });

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
        tutarNet: kirilim(avans).net,
        tutarKdv: kirilim(avans).kdv,
        currency: s.currency,
        tutarEur: eurKarsiligi(avans, s.currency, s.fxRate),
        odendi: Boolean(s.advancePaidAt),
        odendiGun: s.advancePaidAt,
        kalemSayisi: s.satirlar.length,
        isler: [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))],
        source: "order",
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
        tutarNet: kirilim(bakiye).net,
        tutarKdv: kirilim(bakiye).kdv,
        currency: s.currency,
        tutarEur: eurKarsiligi(bakiye, s.currency, s.fxRate),
        odendi: Boolean(s.balancePaidAt),
        odendiGun: s.balancePaidAt,
        kalemSayisi: s.satirlar.length,
        isler: [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))],
        source: "order",
      });
    }
  }

  for (const row of (sarfData ?? []) as SarfOdeme[]) {
    satirlar.push({
      id: `sarf-${row.payment_group_id}`,
      orderId: row.payment_group_id,
      tur: "sarf",
      supplier: row.supplier_name,
      orderNo: row.document_no,
      gun: row.payment_due_at,
      tutar: Number(row.gross_amount),
      tutarNet: row.net_amount == null ? null : Number(row.net_amount),
      tutarKdv: row.vat_amount == null ? null : Number(row.vat_amount),
      currency: row.currency,
      tutarEur: Number(row.gross_amount_eur),
      odendi: Boolean(row.payment_paid_at),
      odendiGun: row.payment_paid_at,
      kalemSayisi: row.line_count,
      isler: row.item_names ?? [],
      source: "consumable",
    });
  }

  return <PaymentBoard satirlar={satirlar} canWrite={yazabilir} />;
}
