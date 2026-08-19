// ELEKTRİK PROJESİNİ OKUMA UCU — PDF'ten malzeme listesi, künye ve dizin.
//
// NEDEN ROUTE HANDLER, SERVER ACTION DEĞİL: `unpdf` Node çalışma zamanı ister
// ve iş uzundur (157 sayfa, ~2 s). Route handler evin ağır Node işleri için
// zaten kullandığı yol (`drawings/[id]/import/route.ts`).
//
// PARÇALAMA YOK ve bu ölçülmüş bir karardır: teknik resim içtirmesinde 450
// AYRI DOSYA indiriliyor ve baskın maliyet indirmedir; burada tek dosya var,
// metin katmanı 20 sayfayı 155 ms'de okuyor. Tek istek yeter.
//
// OKUMA YENİDEN ÇALIŞTIRILABİLİR: eski satırlar silinir, yenileri yazılır.
// Ayıklayıcı geliştikçe aynı belge yeniden okunabilmelidir — aksi hâlde
// bugünün eksik okuması belgeye kalıcı olarak yapışırdı.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { ELECTRICAL_BUCKET } from "@/lib/electrical/data";
import { readElectricalPdf } from "@/lib/electrical/read-pdf";

export const runtime = "nodejs";
/** 157 sayfalık bir belge ~2 s'de okunuyor; tavan cömert ama sonsuz değil. */
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const docId = request.nextUrl.searchParams.get("belge") ?? "";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditReports((profil as { role?: string } | null)?.role)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { data: belge } = await supabase
    .from("electrical_projects")
    .select("id, storage_path")
    .eq("id", docId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!belge) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

  const { data: dosya, error: indirmeHatasi } = await supabase.storage
    .from(ELECTRICAL_BUCKET)
    .download(String(belge.storage_path));
  if (indirmeHatasi || !dosya) {
    return NextResponse.json({ error: "Dosya depodan indirilemedi." }, { status: 502 });
  }

  let okuma;
  try {
    okuma = await readElectricalPdf(new Uint8Array(await dosya.arrayBuffer()));
  } catch (e) {
    // AÇILAMAYAN DOSYA KAYDI DÜŞÜRMEZ: kullanıcı belgeyi görebilmeli ve
    // indirebilmeli; yalnız ayıklama başarısızdır ve bu görünür olur.
    const mesaj = e instanceof Error ? e.message : "bilinmeyen hata";
    await supabase
      .from("electrical_projects")
      .update({ meta: { v: 1, note: `OKUNAMADI: ${mesaj}` }, parsed_at: new Date().toISOString() })
      .eq("id", docId);
    return NextResponse.json({ error: `PDF okunamadı: ${mesaj}` }, { status: 422 });
  }

  // ÖNCE ESKİ SATIRLAR: yeniden okuma bir GÜNCELLEME değil bir YENİDEN
  // ÜRETİMDİR; birleştirme, kaynakta silinmiş bir satırı hayatta bırakırdı.
  await supabase.from("electrical_parts").delete().eq("electrical_project_id", docId);

  // Toplu yazma parçalanır: 726 satırlık tek bir insert gövdesi PostgREST'in
  // istek sınırını zorlar ve hata mesajı satırı göstermez.
  const PARCA = 500;
  for (let i = 0; i < okuma.parts.length; i += PARCA) {
    const dilim = okuma.parts.slice(i, i + PARCA).map((p, k) => ({
      electrical_project_id: docId,
      sort: i + k,
      device_tag: p.deviceTag,
      installation: p.installation,
      location: p.location,
      device: p.device,
      qty: p.qty,
      designation: p.designation,
      type_no: p.typeNo,
      supplier: p.supplier,
      part_no: p.partNo,
      page: p.page,
    }));
    const { error } = await supabase.from("electrical_parts").insert(dilim);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: metaHatasi } = await supabase
    .from("electrical_projects")
    .update({
      page_count: okuma.pageCount,
      // `parts` META'YA GİRMEZ — satırlar kendi tablosundadır ve JSONB'de bir
      // kopyası olsaydı ikisi bir gün ayrışırdı.
      meta: {
        v: okuma.v,
        readAt: okuma.readAt,
        titleBlock: okuma.titleBlock,
        sheets: okuma.sheets,
        partsPages: okuma.partsPages,
        note: okuma.note,
        partCount: okuma.parts.length,
      },
      parsed_at: new Date().toISOString(),
    })
    .eq("id", docId);
  if (metaHatasi) return NextResponse.json({ error: metaHatasi.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    pageCount: okuma.pageCount,
    partCount: okuma.parts.length,
    sheetCount: okuma.sheets.length,
    note: okuma.note,
  });
}
