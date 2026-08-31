import "server-only";

// PARAMETRİK ŞEMA UCU — hesap motorunun diyagramlarını el kitabına taşır.
//
// KULLANICININ ŞİKÂYETİ "ÇOK METİN, AZ GÖRSEL"Dİ (30.08.2026). Oysa bu vincin
// halat donanımı, tambur, kanca bloğu, teker düzeni ve kiriş kesiti ŞEMASI
// zaten hesap raporunda çizilidir. İkinci bir çizim yapmak değil, olanı
// getirmek gerekiyordu.
//
// RASTERLENMEZ (KITAP-22). `Diagram` saf bir SVG veri modelidir; PDF ve ekran
// için iki çizici zaten vardır. Ölçüldü (30.08.2026): seksen şemanın en
// büyüğü 38 KB, ortalaması 10 KB — modeli snapshot'ta taşımak ucuzdur ve
// teslim belgesinde şema KESKİN kalır.
//
// DONMUŞ, CANLI DEĞİL: şema ekleme anında çözülür ve payload'a yazılır.
// Canlı olsaydı yayımlanmış bir kılavuz, hesap sonradan revize edilince
// sessizce başka bir şey söylerdi (KITAP-7'nin dersi).
//
//   GET  → o vinçte gerçekten ÜRETİLEN şemaların katalogu (model YOK, hafif)
//   POST → { key } ile tek şemanın çözülmüş modeli

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { runCalc } from "@/lib/calc/engine";
import {
  calcInputFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { MODULE_ADAPTERS } from "../../../revisions/[revId]/module-adapters";
import { diagramsForSection } from "@/lib/diagrams/select";
import type { Diagram } from "@/lib/diagrams/model";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SemaKaydi {
  key: string;
  baslik: string;
  modul: string;
  bolum: string;
}

/**
 * Projenin hesap girdisini çözer.
 *
 * HANGİ REVİZYON: `sources-data.ts` ile AYNI kural — son yayımlanmış, yoksa
 * en son taslak. İki yerde ayrı seçilseydi el kitabındaki tablo bir revizyonu,
 * şeması başka bir revizyonu anlatırdı.
 */
async function hesapGirdisi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  const { data } = await supabase
    .from("revisions")
    .select("id, rev_no, status, inputs, selections")
    .eq("project_id", projectId)
    .order("rev_no", { ascending: false });
  const liste = (data ?? []) as Record<string, unknown>[];
  const revizyon = liste.find((r) => r.status === "issued") ?? liste[0];
  if (!revizyon) return null;
  return calcInputFromRevision(
    revizyon.inputs as RevisionInputsJson | null,
    revizyon.selections as RevisionSelectionsJson | null
  );
}

/** O vinçte gerçekten üretilen şemaları dolaşır. */
function semalar(
  input: NonNullable<Awaited<ReturnType<typeof hesapGirdisi>>>
): { kayit: SemaKaydi; diagram: Diagram }[] {
  const result = runCalc(input);
  const out: { kayit: SemaKaydi; diagram: Diagram }[] = [];
  for (const adapter of MODULE_ADAPTERS) {
    const modulAdi = adapter.titleFor?.(input.specs) ?? adapter.title;
    for (const bolum of adapter.sections) {
      if (bolum.visible && !bolum.visible(input.specs)) continue;
      let ds: Diagram[] = [];
      try {
        ds = diagramsForSection(adapter.key, bolum.rawId, input, result);
      } catch {
        // BİR ŞEMANIN ÜRETİLEMEMESİ KATALOGU DÜŞÜRMEZ: eksik girdi çoğu
        // vinçte olağandır ve öteki şemalar yine seçilebilmelidir.
        continue;
      }
      ds.forEach((d, i) => {
        const key = `${adapter.key}:${bolum.rawId}${ds.length > 1 ? `#${i}` : ""}`;
        out.push({
          kayit: {
            key,
            baslik: bolum.title,
            modul: modulAdi,
            bolum: `${bolum.id} ${bolum.title}`,
          },
          diagram: d,
        });
      });
    }
  }
  return out;
}

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

  const input = await hesapGirdisi(izin.supabase, id);
  if (!input) {
    return NextResponse.json({
      semalar: [],
      not: "Bu projede hesap raporu revizyonu yok; şema üretilemez.",
    });
  }
  return NextResponse.json({ semalar: semalar(input).map((s) => s.kayit) });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const izin = await yetki();
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: 403 });
  const { id, revId } = await ctx.params;

  // ŞEMA YALNIZ TASLAĞA EKLENİR: gövde yayımda donar ve şema gövdenin
  // parçasıdır (KITAP-9'un aynı gerekçesi).
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
  if (!key) return NextResponse.json({ error: "Şema anahtarı gerekli." }, { status: 400 });

  const input = await hesapGirdisi(izin.supabase, id);
  if (!input) {
    return NextResponse.json({ error: "Hesap raporu revizyonu bulunamadı." }, { status: 404 });
  }

  const bulunan = semalar(input).find((s) => s.kayit.key === key);
  if (!bulunan) {
    return NextResponse.json({ error: "Şema bu vinçte üretilmiyor." }, { status: 404 });
  }

  const d = bulunan.diagram;
  return NextResponse.json({
    diagramKey: key,
    baslik: bulunan.kayit.baslik,
    diagram: {
      width: d.width,
      height: d.height,
      els: d.els,
      ...(d.x0 !== undefined ? { x0: d.x0 } : {}),
      ...(d.y0 !== undefined ? { y0: d.y0 } : {}),
    },
  });
}
