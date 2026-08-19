// MALİYET ÇALIŞMASI EXCEL UCU — İÇ BELGE.
// GET /offers/[id]/costs/[costRevId]/excel -> .xlsx indirir
//
// KOMŞUSUNUN (pdf/route.ts) İKİZİDİR ve bilerek satır satır aynı desendedir:
// oturum kontrolü, teklif ve maliyet revizyonunun okunması, teklifin GÜNCEL
// revizyonunun karşılaştırma için alınması, künye ayarları ve dosya adı. İki
// uç aynı belgeyi iki biçimde verir; veriyi farklı yollardan okusalardı aynı
// maliyet çalışması iki dosyada iki türlü görünebilirdi.
//
// `?inline=1` YOKTUR: bir çalışma kitabının tarayıcı önizlemesi yoktur, uç her
// zaman indirtir. Çerçeveye de açılmaz (PDF ucuyla aynı gerekçe, MALIYET-12):
// iç belge için gömülebilir bir adres açmanın karşılığı yok.
//
// YETKİ BURADA SORULMAZ, RLS'te YAŞAR: uç yalnız oturumu kontrol eder, satır
// yetkisi `can_see_offer_costs()` ile gelir. Servis-rol istemcisi KULLANILMAZ —
// kullanılsaydı maliyeti görmemesi gereken rol dosyayı indirebilirdi.
//
// `runtime = "nodejs"` ZORUNLUDUR: exceljs node akışlarını ve zlib'i kullanır,
// edge çalışma zamanında düşer.

import { createClient } from "@/lib/supabase/server";
import { loadOfferCostRevision } from "@/app/(app)/offers/cost-data";
import { loadOffer, loadOfferRevision } from "@/app/(app)/offers/data";
import { buildOfferCostWorkbook } from "@/lib/xlsx/offer-cost";
import { offerCostFileName } from "@/lib/pdf/doc-naming";
import { emptyPayload } from "@/lib/offers/payload";
import { getReportSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; costRevId: string }> }
) {
  const { id, costRevId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Oturum bulunamadı", { status: 401 });

  const kayit = await loadOffer(supabase, id);
  if (!kayit) return new Response("Teklif bulunamadı", { status: 404 });
  const { offer, revisions } = kayit;

  const cost = await loadOfferCostRevision(supabase, id, costRevId, offer.currency);
  if (!cost) return new Response("Maliyet revizyonu bulunamadı", { status: 404 });

  // TEKLİFİN GÜNCEL REVİZYONU okunur — kâr karşılaştırması, satırların teknik
  // karşılığı ve fiyat satırlarının elle maliyetleri ondan gelir. Teklifin hiç
  // revizyonu yoksa boş belge kullanılır ve maliyet yine basılır: fiyatsız bir
  // maliyet çalışması meşrudur (önce maliyet, sonra fiyat).
  const guncel = revisions[0];
  const teklif = guncel
    ? (await loadOfferRevision(supabase, id, guncel.id))?.revision.payload ??
      emptyPayload(offer.currency)
    : emptyPayload(offer.currency);

  const settings = await getReportSettings(supabase);
  const wb = buildOfferCostWorkbook({
    offer: {
      offerNo: offer.offer_no,
      subject: offer.subject,
      customerName: offer.customer_name,
      currency: offer.currency,
      offerRevNo: guncel?.rev_no ?? null,
    },
    costRevNo: cost.rev_no,
    payload: cost.payload,
    offerPayload: teklif,
    company: { company: settings.company },
    meta: { generatedAt: new Date().toLocaleDateString("tr-TR") },
  });

  // AD TEK KAYNAKTAN GELİR, PARÇALARI BURADA YENİDEN YAZILMAZ.
  // `offerCostFileName` uzantıyı sabit `pdf` veriyor; parçaları burada
  // tekrarlamak (iş adı · teklif no · MALİYET Mn · İÇ BELGE) iki belgenin
  // adının sessizce ayrışması demekti — oysa "İÇ BELGE" damgasının adın SONUNDA
  // durması MALIYET-12'nin birinci işaretidir.
  const filename = offerCostFileName(offer.subject, offer.offer_no, cost.rev_no).replace(
    /\.pdf$/,
    ".xlsx"
  );
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");

  const raw = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(raw as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      // Taslak maliyet her kaydetmede değişir; önbelleğe alınmış bir dosya
      // yönetime eski kâr marjını gösterirdi.
      "Cache-Control": "no-store",
    },
  });
}
