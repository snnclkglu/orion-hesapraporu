// PANO YERLEŞİMİ PDF UCU — EKRANDAKİ PLANIN AYNISI.
//
// `GET`tir ve ölçü parametreleri adres çubuğundan gelir; ekran ile uç AYNI saf
// fonksiyondan geçer (`loadPanoVerisi`), yani iki çıktı ayrışamaz. Plan
// saklanmıyor: belge her istendiğinde yeniden hesaplanır ve deterministik
// olduğu için aynı adres her zaman aynı kâğıdı verir.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { getReportSettings } from "@/lib/settings";
import { renderPanoLayoutPdf } from "@/lib/pdf/pano-layout";
import { loadPanoVerisi } from "../pano-data";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sorgu = Object.fromEntries(request.nextUrl.searchParams.entries());

  const veri = await loadPanoVerisi(id, sorgu);
  if (!veri) return new NextResponse("Proje bulunamadı.", { status: 404 });
  if (!veri.belgeVar || veri.parcaSayisi === 0) {
    return new NextResponse("Bu projede okunmuş bir elektrik projesi yok.", { status: 409 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  const ayarlar = await getReportSettings(supabase);
  const bugun = new Date().toLocaleDateString("tr-TR");

  const pdf = await renderPanoLayoutPdf({
    sonuc: veri.sonuc,
    meta: {
      docCode: `${veri.project.docNo || "ORION"} · PANO`,
      generatedAt: bugun,
      preparedBy: (profil as { full_name?: string } | null)?.full_name ?? "",
      scopeText: `${veri.project.docNo} ${veri.project.name}${
        veri.project.customer ? ` · ${veri.project.customer}` : ""
      }`,
      sourceText: `elektrik projesi ${veri.belgeRevizyon || veri.belgeAdi} · ${
        veri.parcaSayisi
      } aygıt satırı`,
      fingerprint: veri.sonuc.fingerprint,
      approvedText: veri.onay
        ? veri.onay.inputFingerprint === veri.sonuc.fingerprint
          ? `Onaylı (${new Date(veri.onay.approvedAt).toLocaleDateString("tr-TR")}).`
          : "ONAY ESKİDİ: onaydan sonra girdi değişti."
        : "Henüz onaylanmadı.",
    },
    company: {
      company: ayarlar.company,
      address: ayarlar.address ?? "",
      phone: ayarlar.phone,
      email: ayarlar.email,
      web: ayarlar.web,
    },
  });

  const ad = `${COMPANY_NAME} - PANO YERLEŞİMİ - ${veri.project.docNo || ""} - ${bugun}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Cache-Control": "no-store",
    },
  });
}
