import "server-only";

// PANO YERLEŞİM ŞEMASI UCU — el kitabına pano çizimini taşır.
//
// ═══════════════════════════════════════════════ NEDEN AYRI BİR UÇ
//
// Kardeşi (`../route.ts`) hesap motorunun diyagramlarını `diagrams/select.ts`
// üstünden sayar. Pano çizimleri oraya KAYDEDİLMEZ ve bu bir eksiklik değil
// yazılı bir karardır (PANO-16): `select.ts` hesap raporunun bölüm şemalarının
// defteridir ve bir pano yerleşiminin orada işi yoktur — kaydedilseydi şema
// hesap sihirbazının bölüm listesine de girerdi.
//
// Bu yüzden pano şemaları KENDİ ucundan gelir. Sözleşme kardeşiyle aynıdır
// (`{ key, baslik, modul, bolum }` katalogu + `{ key }` ile model), böylece
// aynı seçici bileşeni iki uca birden bakabilir.
//
// ═══════════════════════════════════════════════ DONMUŞ, CANLI DEĞİL
//
// KITAP-22 şemayı ekleme anında çözüp payload'a yazmayı şart koşar. Burada bu
// kural PANO-14 ile TAM ÖRTÜŞÜR: pano planı zaten saklanmıyor, her açılışta
// yeniden hesaplanıyor. Canlı bir bağ kurulsaydı teslim edilmiş bir kılavuz,
// elektrik projesi yeniden okunduğunda (ELEKTRIK-6: satırlar silinip yeniden
// üretilir) sessizce başka bir panoyu anlatırdı.
//
//   GET  → o projede gerçekten ÇİZİLEN pano şemalarının katalogu (model YOK)
//   POST → { key } ile tek şemanın çözülmüş modeli

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { panoSemaKatalogu } from "@/lib/diagrams/panoKitap";
import { semaGenisligiYuzdesi } from "@/lib/manual/pdf-layout";
import { loadPanoVerisi } from "../../../../pano/pano-data";

export const runtime = "nodejs";
export const maxDuration = 60;

async function yetki() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." as const };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditReports((profil as { role?: string } | null)?.role)) {
    return { error: "El kitabı düzenleme yetkiniz yok." as const };
  }
  return { supabase };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const izin = await yetki();
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: 403 });
  const { id } = await ctx.params;

  const veri = await loadPanoVerisi(id);
  if (!veri || !veri.belgeVar || !veri.okunduMu) {
    return NextResponse.json({
      semalar: [],
      not: "Bu projede okunmuş bir elektrik projesi yok; pano şeması üretilemez.",
    });
  }
  const liste = panoSemaKatalogu(veri.sonuc);
  if (liste.length === 0) {
    return NextResponse.json({
      semalar: [],
      not: "Elektrik projesinde pano açan aygıt bulunamadı.",
    });
  }
  return NextResponse.json({ semalar: liste.map((x) => x.kayit) });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const izin = await yetki();
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: 403 });
  const { id, revId } = await ctx.params;

  // ŞEMA YALNIZ TASLAĞA EKLENİR: gövde yayımda donar ve şema gövdenin
  // parçasıdır (kardeş ucun aynı gerekçesi, KITAP-9).
  const { data: rev } = await izin.supabase
    .from("manual_revisions")
    .select("status")
    .eq("id", revId)
    .maybeSingle();
  if ((rev as { status?: string } | null)?.status !== "draft") {
    return NextResponse.json({ error: "Yayımlanmış revizyona şema eklenemez." }, { status: 409 });
  }

  const govde = (await req.json().catch(() => null)) as { key?: string } | null;
  const key = String(govde?.key ?? "");
  if (!key) return NextResponse.json({ error: "Şema anahtarı boş." }, { status: 400 });

  const veri = await loadPanoVerisi(id);
  if (!veri) return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });

  const kayit = panoSemaKatalogu(veri.sonuc).find((x) => x.kayit.key === key);
  if (!kayit) return NextResponse.json({ error: "Şema bulunamadı." }, { status: 404 });

  const diagram = kayit.ciz();
  if (!diagram || diagram.els.length === 0) {
    return NextResponse.json({ error: "Şema çizilemedi." }, { status: 422 });
  }

  return NextResponse.json({
    diagramKey: key,
    baslik: kayit.kayit.baslik,
    // GENİŞLİK YÜZDESİ SUNUCUDA HESAPLANIR: uzun bir pano çizimi tam
    // genişlikte gövdeyi taşırıyordu (ölçüldü: 706 pt / 698 pt).
    widthPct: semaGenisligiYuzdesi(diagram),
    diagram: {
      width: diagram.width,
      height: diagram.height,
      els: diagram.els,
      ...(diagram.x0 !== undefined ? { x0: diagram.x0 } : {}),
      ...(diagram.y0 !== undefined ? { y0: diagram.y0 } : {}),
    },
  });
}
