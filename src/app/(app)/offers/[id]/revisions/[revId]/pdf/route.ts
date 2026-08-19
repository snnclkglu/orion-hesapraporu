// TEKLİF PDF İNDİRME UCU.
// GET /offers/[id]/revisions/[revId]/pdf         -> attachment (indirme)
// GET /offers/[id]/revisions/[revId]/pdf?inline=1 -> inline (tarayıcı içi önizleme)
//
// BELGE HER İSTEKTE REVİZYONUN SNAPSHOT'INDAN ÜRETİLİR; hiçbir yerde
// saklanmaz. Yayımlanmış bir revizyonun payload'ı değişmediği için aynı adres
// aynı belgeyi verir, ama defter (marka listeleri, şablonlar) yarın değişse
// bile eski teklif olduğu gibi basılır — `withDefaults` payload'ı taşır,
// yeniden yorumlamaz.
//
// ÖNİZLEME AYRI BİR YOL DEĞİLDİR (kullanıcı isteği: pop-up önizleme): aynı uç
// yalnız `Content-Disposition`ı değiştirir. İkinci bir üretim yolu açılsaydı
// ekranda görülen belge ile indirilen belge sessizce ayrışabilirdi.

import { createClient } from "@/lib/supabase/server";
import { loadOfferRevision } from "@/app/(app)/offers/data";
import { renderOfferPdf } from "@/lib/pdf/offer";
import { offerFileName } from "@/lib/pdf/doc-naming";
import { getReportSettings } from "@/lib/settings";
import { loadCustomerLogo } from "@/lib/customers/logo";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum bulunamadı", { status: 401 });

  const loaded = await loadOfferRevision(supabase, id, revId);
  if (!loaded) return new Response("Teklif revizyonu bulunamadı", { status: 404 });
  const { offer, revision } = loaded;

  // Firma künyesi hesap raporuyla AYNI kaynaktan gelir (`app_settings.report`):
  // iki belgenin altbilgisinde farklı adres yazması, ikisini de şüpheli yapardı.
  //
  // MÜŞTERİ LOGOSU DA CANLI OKUNUR ve bu TEKLIF-15'in ("kapak bilgisi bir
  // FOTOĞRAFTIR") istisnasıdır — gerekçesi şudur: müşterinin ADRESİ ya da
  // VERGİ NUMARASI teklif anına ait bir OLGUDUR ve snapshot'ta donar; LOGO ise
  // bir olgu değil KİMLİKtir. Firma markasını yenilediğinde eski teklifin
  // yeniden indirilen kopyasında bugünkü markanın çıkması doğrudur; müşteriye
  // GÖNDERİLEN belge zaten `offers` kovasında olduğu gibi arşivlenmiştir.
  // Kararın maliyeti de sınırlıdır: logo, belgenin hiçbir sayısını değiştirmez.
  //
  // İKİ OKUMA PARALEL: ayrı beklenirse teklif indirmesi iki ağ turu boyu
  // gecikirdi. `loadCustomerLogo` HİÇBİR KOŞULDA FIRLATMAZ — logo inmezse
  // `null` döner ve belge logosuz basılır (bir logo yüzünden 500 dönmek kabul
  // edilemez).
  const [settings, customerLogo] = await Promise.all([
    getReportSettings(supabase),
    loadCustomerLogo(supabase, offer.customer_id),
  ]);
  const buffer = await renderOfferPdf({
    offer: {
      offerNo: offer.offer_no,
      revNo: revision.rev_no,
      issueDate: offer.issue_date,
      subject: offer.subject,
      customerName: offer.customer_name,
      currency: offer.currency,
    },
    payload: revision.payload,
    company: {
      company: settings.company,
      address: settings.address || settings.city,
      phone: settings.phone,
      email: settings.email,
      web: settings.web,
    },
    customerLogo,
    meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
  });

  const inline = new URL(req.url).searchParams.get("inline") === "1";
  // Dosya adı: İŞ ADI - TEKLİF NO - REV (bkz. pdf/doc-naming).
  // Türkçe karakterli ad: ASCII geri düşüş + RFC 5987 filename*.
  const filename = offerFileName(offer.subject, offer.offer_no, revision.rev_no);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      // Taslak revizyon her kaydetmede değişir; önbelleğe alınan bir teklif
      // müşteriye eski fiyatı gösterirdi.
      "Cache-Control": "no-store",
    },
  });
}
