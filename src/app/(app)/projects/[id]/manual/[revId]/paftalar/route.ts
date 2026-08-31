import "server-only";

// PAFTA UCU — Teknik Resim Takibi'ndeki bir montaj resmini el kitabına taşır.
//
// TEK RASTERLENEN KAYNAK BURASIDIR. Şema vektör modeldir, katalog sayfası
// zaten görüntüdür; pafta ise PDF'tir ve gövdeye bir GÖRSEL olarak girer.
// Vektör olarak gömmek istenirdi ama @react-pdf yabancı bir PDF sayfasını
// gövdeye alamaz — o iş `pdf-lib` birleştirmesinindir ve orası EKLERİN yoludur
// (KITAP-8). Gövdeye giren tek yaprak için ek açmak, bir resmi göstermek uğruna
// belgeye ayraç kapağı eklemek olurdu.
//
// EK-B'DEN AYRIDIR: "Mekanik Projeler" eki bütün paftaları teslim paketine
// bağlar; burası "genel montaj resmi 3. bölümde dursun" diyen mühendisin
// ihtiyacıdır.
//
// 1600 px, `catalog-appendix.ts` ile AYNI ÖLÇÜ: ince teknik yazı okunur kalır
// ve tek yaprak yüz megabayta çıkmaz.

import { NextResponse } from "next/server";
import { renderPageAsImage } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { manualImageIntake, manualYazmaIzni } from "@/lib/manual/image-intake";

export const runtime = "nodejs";
export const maxDuration = 120;

const DRAWINGS_BUCKET = "drawings";

/** Rasterleme genişliği — ek üretimiyle aynı sayı, aynı gerekçe. */
const HEDEF_PX = 1600;

interface PaftaKaydi {
  id: string;
  ad: string;
  paket: string;
  paketId: string;
  storagePath: string;
}

async function paftalar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<PaftaKaydi[]> {
  const { data: paketler } = await supabase
    .from("drawing_packages")
    .select("id, folder_name, rev_no, status")
    .eq("project_id", projectId)
    .neq("status", "superse")
    .order("rev_no", { ascending: false });

  const paketKimlikleri = (paketler ?? []).map((p) => String(p.id));
  if (paketKimlikleri.length === 0) return [];

  // YALNIZ CANLI VE DEPODA OLAN PDF'LER: ölü bir kaydı listelemek, kullanıcıyı
  // açılmayacak bir dosyaya göndermekti.
  const { data: dosyalar } = await supabase
    .from("drawing_files")
    .select("id, package_id, file_name, storage_path, stored")
    .in("package_id", paketKimlikleri)
    .eq("stored", true)
    .eq("lifecycle", "canli")
    .ilike("file_name", "%.pdf")
    .order("file_name", { ascending: true });

  return (dosyalar ?? []).map((d) => {
    const paket = (paketler ?? []).find((p) => p.id === d.package_id);
    return {
      id: String(d.id),
      ad: String(d.file_name).replace(/\.pdf$/i, ""),
      paket: paket
        ? `${String(paket.folder_name)} · R${String(paket.rev_no).padStart(2, "0")}`
        : "Teknik resim paketi",
      paketId: String(d.package_id),
      storagePath: String(d.storage_path),
    };
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await ctx.params;
  const supabase = await createClient();
  const izin = await manualYazmaIzni(supabase, id, revId);
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: izin.status });

  // DEPO YOLU İSTEMCİYE GİTMEZ: seçim kimlikle yapılır ve baytı sunucu okur.
  const liste = await paftalar(supabase, id);
  return NextResponse.json({
    paftalar: liste.map((p) => ({ id: p.id, ad: p.ad, paket: p.paket, paketId: p.paketId })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await ctx.params;
  const supabase = await createClient();
  const izin = await manualYazmaIzni(supabase, id, revId);
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: izin.status });

  const govde = (await req.json().catch(() => null)) as
    | { dosyaId?: string; sayfa?: number }
    | null;
  const dosyaId = String(govde?.dosyaId ?? "");
  const sayfa = Math.max(1, Number(govde?.sayfa ?? 1));
  if (!dosyaId) return NextResponse.json({ error: "Pafta kimliği gerekli." }, { status: 400 });

  const pafta = (await paftalar(supabase, id)).find((p) => p.id === dosyaId);
  if (!pafta) {
    return NextResponse.json({ error: "Pafta bu projede bulunamadı." }, { status: 404 });
  }

  const { data: indirilen, error: indirmeHatasi } = await supabase.storage
    .from(DRAWINGS_BUCKET)
    .download(pafta.storagePath);
  if (indirmeHatasi || !indirilen) {
    return NextResponse.json(
      { error: indirmeHatasi?.message ?? "Pafta dosyası okunamadı." },
      { status: 404 }
    );
  }

  let png: Uint8Array;
  try {
    // Kopya verilmezse PDF.js worker'ı kaynak ArrayBuffer'ı ayırabilir
    // (`catalog-appendix.ts`in aynı dersi).
    png = new Uint8Array(
      await renderPageAsImage(new Uint8Array(await indirilen.arrayBuffer()), sayfa, {
        canvasImport: () => import("@napi-rs/canvas"),
        width: HEDEF_PX,
      })
    );
  } catch (hata) {
    return NextResponse.json(
      {
        error: `Pafta sayfası çizilemedi: ${
          hata instanceof Error ? hata.message : "bilinmeyen hata"
        }`,
      },
      { status: 422 }
    );
  }

  const sonuc = await manualImageIntake(
    supabase,
    revId,
    izin.userId,
    png,
    `${pafta.ad} s.${sayfa}.png`,
    { tur: "pafta", paketId: pafta.paketId, dosyaId: pafta.id, sayfa, ad: pafta.ad }
  );
  if ("error" in sonuc) return NextResponse.json({ error: sonuc.error }, { status: sonuc.status });
  return NextResponse.json({ image: sonuc.image, baslik: `${pafta.ad} (s. ${sayfa})` });
}
