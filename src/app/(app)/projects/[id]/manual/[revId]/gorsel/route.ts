// EL KİTABI GÖRSELİ — yükleme ucu.
//
// BAYTLAR BURADAN GEÇER ve bu, ötekilerin tersidir. Elektrik projesi (12 MB)
// ve şartname doğrudan depoya yükleniyor; görsel ise sunucudan geçer çünkü
// SUNUCU ONU YENİDEN KODLAR:
//
//   · "PNG" BİR BEYANDIR, KANIT DEĞİL (`customers/logo-image.ts` dersi):
//     `file.type` tarayıcıdan gelir ve uzantı bir şey ispat etmez.
//   · 16 bitlik, interlaced ya da paletli PNG react-pdf'in çözücüsünü
//     düşürür ve TEK bozuk görsel BÜTÜN kılavuzu 500'e çevirirdi.
//   · EN-BOY ORANI ÖLÇÜLÜR, beyan edilmez: yanlış bir oran PDF'te resmi ezer.
//
// Bir saha fotoğrafı birkaç megabayttır; `sharp` onu 1600 piksele indirir ve
// gövde sınırı sorun olmaz (route handler'ın gövde sınırı server action'ın
// 1 MB'ı değildir).

import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { MANUAL_IMAGE_BUCKET } from "@/lib/manual/data";

export const runtime = "nodejs";

/** Yeniden kodlanan görselin en fazla genişliği — A4 gövdesi 170 mm'dir. */
const HEDEF_GENISLIK = 1600;

/** Kabul edilen en büyük kenar — SIKIŞTIRMA BOMBASINA karşı (piksel sayar). */
const MAX_KENAR = 12000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id: projectId, revId } = await params;
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

  // GÖRSEL YALNIZ TASLAĞA EKLENİR: gövde yayımda donar ve resim gövdenin
  // parçasıdır (RLS de aynı şeyi söyler, buradaki mesajı okunur kılar).
  const { data: rev } = await supabase
    .from("manual_revisions")
    .select("id, status, manual_id, manuals:manual_id(project_id)")
    .eq("id", revId)
    .maybeSingle();
  if (!rev) return NextResponse.json({ error: "Revizyon bulunamadı." }, { status: 404 });
  if ((rev.manuals as unknown as { project_id?: string } | null)?.project_id !== projectId) {
    return NextResponse.json({ error: "Revizyon bu projeye ait değil." }, { status: 404 });
  }
  if (rev.status !== "draft") {
    return NextResponse.json(
      { error: "Yayımlanmış revizyona görsel eklenemez; yeni revizyon oluşturun." },
      { status: 409 }
    );
  }

  const form = await request.formData();
  const dosya = form.get("dosya");
  if (!(dosya instanceof File)) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }

  let png: Buffer;
  let width = 0;
  let height = 0;
  try {
    const ham = Buffer.from(await dosya.arrayBuffer());
    const olcu = await sharp(ham).metadata();
    if (!olcu.width || !olcu.height) {
      return NextResponse.json({ error: "Görsel okunamadı." }, { status: 422 });
    }
    if (olcu.width > MAX_KENAR || olcu.height > MAX_KENAR) {
      return NextResponse.json({ error: "Görsel çözünürlüğü çok yüksek." }, { status: 413 });
    }
    // 8 bit sRGB, interlaced OLMAYAN, PALETSİZ bir PNG olarak yeniden kodlanır.
    png = await sharp(ham)
      .resize({ width: Math.min(HEDEF_GENISLIK, olcu.width), withoutEnlargement: true })
      .png({ progressive: false, palette: false, compressionLevel: 9 })
      .toBuffer();
    const son = await sharp(png).metadata();
    width = son.width ?? 0;
    height = son.height ?? 0;
  } catch {
    return NextResponse.json({ error: "Görsel işlenemedi." }, { status: 422 });
  }

  const imageId = crypto.randomUUID();
  const yol = `${revId}/${imageId}.png`;
  const { error: yuklemeHatasi } = await supabase.storage
    .from(MANUAL_IMAGE_BUCKET)
    .upload(yol, png, { contentType: "image/png", upsert: false });
  if (yuklemeHatasi) {
    return NextResponse.json({ error: yuklemeHatasi.message }, { status: 500 });
  }

  const { error } = await supabase.from("manual_images").insert({
    id: imageId,
    revision_id: revId,
    file_name: dosya.name,
    storage_path: yol,
    width,
    height,
    size_bytes: png.byteLength,
    created_by: user.id,
  });
  if (error) {
    // Kayıt yazılamadıysa nesne temizlenir: sıra TERSTİR (önce depo, sonra
    // kayıt) çünkü HENÜZ KAYIT YOKTUR.
    await supabase.storage.from(MANUAL_IMAGE_BUCKET).remove([yol]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imageId, width, height });
}
