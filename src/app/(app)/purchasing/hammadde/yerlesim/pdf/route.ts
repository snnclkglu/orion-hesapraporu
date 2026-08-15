// Kesim planı PDF ucu — EKRANDAKİ PLANIN AYNISI.
//
// `GET`tir ve parametreler adres çubuğundan gelir; ekranla AYNI parametreler
// AYNI saf fonksiyondan geçer, yani iki çıktı ayrışamaz. Talep PDF'inin
// `POST` olmasının sebebi anahtar listesinin uzunluğuydu (normalleştirilmiş
// tanımlar); burada anahtar bir stok adıdır ve seçim birkaç kalemdir.
//
// PLAN SAKLANMIYOR (md. 24) — belge her istendiğinde yeniden hesaplanır.
// Deterministik olduğu için aynı adres her zaman aynı kâğıdı verir.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { canSeePurchasing } from "@/lib/roles";
import { getReportSettings } from "@/lib/settings";
import { renderKesimPlaniPdf, type KesimPlaniGrubu } from "@/lib/pdf/nesting-plan";
import {
  enIyiPlakaSecimi,
  sacYerlesimi,
  yerlesimDenetimi,
  type YerlesimParcasi,
} from "@/lib/purchasing/hammadde/nesting";
import {
  KESIM_PAYLARI,
  PLAKA_BOYLARI,
  PLAKA_ENLERI,
  VARSAYILAN_KESIM_PAYI,
} from "@/lib/purchasing/hammadde/siniflar";
import { loadHammaddeHavuzu } from "../../data";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!canSeePurchasing((profil as { role?: string } | null)?.role)) {
    return new NextResponse("Yetkisiz", { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const secilenler = new Set(sp.getAll("k"));
  if (secilenler.size === 0) {
    return new NextResponse("Yerleştirilecek kalem seçilmedi.", { status: 400 });
  }

  const payHam = Number.parseInt(sp.get("pay") ?? "", 10);
  const pay = (KESIM_PAYLARI as readonly number[]).includes(payHam)
    ? payHam
    : VARSAYILAN_KESIM_PAYI;
  const enHam = Number.parseInt(sp.get("en") ?? "", 10);
  const en = (PLAKA_ENLERI as readonly number[]).includes(enHam) ? enHam : null;
  const boyHam = Number.parseInt(sp.get("boy") ?? "", 10);
  const boy = (PLAKA_BOYLARI as readonly number[]).includes(boyHam) ? boyHam : null;
  const dondur = sp.get("dondur") !== "0";

  const veri = await loadHammaddeHavuzu(supabase);
  const secili = veri.havuz.satirlar.filter(
    (s) => s.sinif === "SAC" && secilenler.has(s.key)
  );
  if (secili.length === 0) {
    return new NextResponse("Seçilen kalemler havuzda bulunamadı.", { status: 404 });
  }

  const adaylar = PLAKA_ENLERI.flatMap((e) => PLAKA_BOYLARI.map((b) => ({ enMm: e, boyMm: b })));
  const gruplar: KesimPlaniGrubu[] = [];

  for (const satir of secili) {
    const parcalar: YerlesimParcasi[] = [];
    let olcusuz = 0;
    for (const p of satir.parcalar) {
      if (p.enMm == null || p.boyMm == null || !p.adet || p.adet <= 0) {
        olcusuz++;
        continue;
      }
      parcalar.push({
        id: p.partKey || p.tanim,
        ad: p.tanim,
        enMm: p.enMm,
        boyMm: p.boyMm,
        adet: p.adet,
      });
    }
    if (parcalar.length === 0) continue;

    const kalinlik = satir.parcalar.find((p) => p.kalinlikMm != null)?.kalinlikMm ?? null;
    const ayar = { payMm: pay, dondur, kalinlikMm: kalinlik };
    let sonuc;
    try {
      sonuc =
        en && boy
          ? sacYerlesimi(parcalar, { enMm: en, boyMm: boy }, ayar)
          : enIyiPlakaSecimi(parcalar, adaylar, ayar);
    } catch {
      continue;
    }
    if (!sonuc || sonuc.plakalar.length === 0) continue;

    gruplar.push({
      tanim: satir.tanim,
      kalite: satir.kalite,
      kalinlikMm: kalinlik,
      sonuc,
      denetim: yerlesimDenetimi(parcalar, sonuc),
      olcusuzParca: olcusuz,
    });
  }

  if (gruplar.length === 0) {
    return new NextResponse("Yerleştirilebilir parça bulunamadı.", { status: 400 });
  }

  const ayarlar = await getReportSettings(supabase);
  const bugun = new Date().toLocaleDateString("tr-TR");
  const pdf = await renderKesimPlaniPdf({
    gruplar,
    meta: {
      docCode: `ORC-KP-${new Date().toISOString().slice(0, 10)}`,
      generatedAt: bugun,
      preparedBy: (profil as { full_name?: string } | null)?.full_name ?? "",
      scopeText:
        `${gruplar.length} sac kalemi · pay ${pay} mm · ` +
        `${en && boy ? `${en}×${boy} mm plaka` : "otomatik plaka"} · ` +
        `${dondur ? "döndürme serbest" : "yön sabit"}`,
    },
    company: {
      company: ayarlar.company,
      address: ayarlar.address ?? "",
      phone: ayarlar.phone,
      email: ayarlar.email,
      web: ayarlar.web,
    },
  });

  const ad = `${COMPANY_NAME} - SAC KESİM PLANI - ${bugun}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Cache-Control": "no-store",
    },
  });
}
