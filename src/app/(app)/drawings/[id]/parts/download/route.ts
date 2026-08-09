// Parça defteri indirme — Excel ya da PDF.
//
// SÜZGEÇ EKRANDAN GELİR (`?q=&tur=&kategori=&malzeme=&dosya=&sira=&ters=`) ve
// `../../filters.ts`teki AYNI işlevlerden geçer. Tanım iki yerde yazılsaydı
// indirilen dosya ile ekrandaki tablo sessizce ayrışırdı — İş Takibi'nde bir
// kez yaşanmış ve `worklog/filters.ts`in başında anlatılan hata budur.
//
// Dosya adı firma kuralındadır (`pdf/doc-naming.ts`): İŞ ADI - DOKÜMAN KODU -
// TÜR, tamamı tr-TR büyük harf.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { docCode, downloadFileName } from "@/lib/pdf/doc-naming";
import { PART_KIND_LABELS } from "@/lib/drawings/types";
import { buildRegisterWorkbook, type RegisterPartOut } from "@/lib/excel/drawing-register";
import { renderRegisterPdf } from "@/lib/pdf/drawing-register";
import { loadPackage, loadParts } from "../../../data";
import { ALL, matchesPart, sortParts, type PartFilters, type PartSortKey } from "../../../filters";

export const runtime = "nodejs";

const SIRALAMA_ANAHTARLARI: PartSortKey[] = [
  "kod",
  "tanim",
  "adet",
  "malzeme",
  "kalinlik",
  "kategori",
  "agirlik",
];

/** Künyeye ve dosya adına giren insan okunur süzgeç özeti. */
function suzgecMetni(f: PartFilters): string {
  const parcalar = [
    f.query.trim() && `arama "${f.query.trim()}"`,
    f.kind !== ALL && `tür ${PART_KIND_LABELS[f.kind as keyof typeof PART_KIND_LABELS] ?? f.kind}`,
    f.category !== ALL && `kategori ${f.category}`,
    f.material !== ALL && `malzeme ${f.material}`,
    f.dosya !== ALL &&
      `dosya ${{ resimli: "resmi olan", resimsiz: "hiç dosyası olmayan", kesimli: "kesim dosyası olan" }[f.dosya] ?? f.dosya}`,
  ].filter(Boolean);
  return parcalar.length ? parcalar.join(" · ") : "süzgeç yok (tüm satırlar)";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const paket = await loadPackage(supabase, id);
  if (!paket) return NextResponse.json({ error: "Paket bulunamadı." }, { status: 404 });

  const u = new URL(request.url);
  const bicim = u.searchParams.get("bicim") === "pdf" ? "pdf" : "xlsx";

  const f: PartFilters = {
    query: u.searchParams.get("q") ?? "",
    kind: u.searchParams.get("tur") ?? ALL,
    category: u.searchParams.get("kategori") ?? ALL,
    material: u.searchParams.get("malzeme") ?? ALL,
    dosya: u.searchParams.get("dosya") ?? ALL,
  };
  const siraHam = (u.searchParams.get("sira") ?? "kod") as PartSortKey;
  const sira = SIRALAMA_ANAHTARLARI.includes(siraHam) ? siraHam : "kod";
  const ters = u.searchParams.get("ters") === "1";

  const hepsi = await loadParts(supabase, id);
  const secili = sortParts(hepsi.filter((p) => matchesPart(p, f)), sira, ters);

  const parts: RegisterPartOut[] = secili.map((p) => ({
    partCode: p.part_code,
    description: p.description || p.name || "",
    assemblyTitle: p.assembly_title,
    kindLabel: PART_KIND_LABELS[p.kind],
    material: p.material,
    category: p.category,
    qty: p.qty,
    cutLengthMm: p.cut_length_mm == null ? null : Number(p.cut_length_mm),
    thicknessMm: p.thickness_mm == null ? null : Number(p.thickness_mm),
    weightKg: p.weight_kg == null ? null : Number(p.weight_kg),
    hasModel: p.has_model,
    hasSheet: p.has_sheet,
    hasCut: p.has_cut,
    isMontaj: p.kind === "montaj",
  }));

  const { data: profil } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const baslik = [paket.description || paket.folder_name, paket.capacity && `(${paket.capacity})`]
    .filter(Boolean)
    .join(" ");
  // Doküman no KLASÖR KODUDUR (kalem + grup): bir işin birden çok resim
  // paketi olabilir ve ikisi de aynı kaleme bağlıdır, ayırt eden grup kodudur.
  const paketKodu = [paket.item_no, paket.group_code].filter(Boolean).join("-") || "PAKET";
  const kod = docCode("TR", paketKodu, paket.rev_no);

  const meta = {
    packageTitle: baslik,
    folderName: paket.folder_name,
    itemNo: paket.item_no,
    groupCode: paket.group_code,
    docCode: kod,
    filterText: suzgecMetni(f),
    generatedAt: new Date().toLocaleString("tr-TR"),
    preparedBy: (profil?.full_name as string) || user.email || "—",
    recognitionPct: paket.recognition_pct,
  };

  const dosyaAdi = downloadFileName([baslik, kod, "PARÇA DEFTERİ"], bicim);

  const govde =
    bicim === "pdf"
      ? await renderRegisterPdf({
          parts,
          meta,
          company: { company: COMPANY_NAME, address: "Başkent OSB 1. Cadde No:20, Ankara" },
        })
      : Buffer.from(
          (await buildRegisterWorkbook(parts, meta).xlsx.writeBuffer()) as ArrayBuffer
        );

  // Content-Disposition ÇİFT yazılır: Türkçe harf taşıyan ad `filename*` ile
  // gider, ASCII yedek eski istemciler içindir (worklog/export/route.ts kalıbı).
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(govde), {
    headers: {
      "Content-Type":
        bicim === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
    },
  });
}
