// EL KİTABI GÖRSELİ — dosya yükleme ucu.
//
// BAYTLAR BURADAN GEÇER ve bu, ötekilerin tersidir. Elektrik projesi (12 MB)
// ve şartname doğrudan depoya yükleniyor; görsel ise sunucudan geçer çünkü
// SUNUCU ONU YENİDEN KODLAR. Gerekçenin tamamı ve yeniden kodlamanın kendisi
// ortak kapıdadır (`lib/manual/image-intake.ts`, KITAP-9 · KITAP-22) — dört
// kaynak (dosya, pano, pafta, katalog sayfası) aynı yoldan geçsin diye.
//
// Bir saha fotoğrafı birkaç megabayttır; `sharp` onu 1600 piksele indirir ve
// gövde sınırı sorun olmaz (route handler'ın gövde sınırı server action'ın
// 1 MB'ı değildir).

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { manualImageIntake, manualYazmaIzni } from "@/lib/manual/image-intake";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; revId: string }> }
) {
  const { id: projectId, revId } = await params;
  const supabase = await createClient();

  const izin = await manualYazmaIzni(supabase, projectId, revId);
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: izin.status });

  const form = await request.formData();
  const dosya = form.get("dosya");
  if (!(dosya instanceof File)) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }
  // PANODAN GELEN GÖRSELİN ADI YOKTUR: tarayıcı ona "image.png" der ve
  // kaynağı ayırt etmek için istemci bunu bildirir.
  const pano = form.get("pano") === "1";

  const sonuc = await manualImageIntake(
    supabase,
    revId,
    izin.userId,
    new Uint8Array(await dosya.arrayBuffer()),
    dosya.name || (pano ? "pano-goruntusu.png" : "gorsel.png"),
    { tur: pano ? "pano" : "yukleme" }
  );
  if ("error" in sonuc) return NextResponse.json({ error: sonuc.error }, { status: sonuc.status });
  return NextResponse.json({ image: sonuc.image });
}
