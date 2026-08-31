import "server-only";

// KATALOG SAYFASI UCU — üretici teknik föyünü el kitabına görsel olarak taşır.
//
// KATALOG SAYFALARI ZATEN SAYFA GÖRÜNTÜSÜDÜR (`lib/catalog-sheets.ts`:
// "PDF dilimi SAKLANMAZ"). Bu yüzden burada RASTERLEME YOKTUR: bayt olduğu
// gibi alınır ve ortak kapıdan geçirilir. İkinci bir dönüştürme, defterin
// zaten ödediği bedeli tekrar ödemekti.
//
// LİSTE BU VİNCİN EKİPMANINDAN SÜZÜLÜR, defterin tamamından değil: iki yüz
// altmış sayfalık bir defteri kullanıcıya olduğu gibi göstermek, aradığını
// bulmasını imkânsız kılardı. Ekipman listesinde karşılığı olmayan föy
// listede HİÇ görünmez.
//
// EK-F'DEN AYRIDIR (KITAP-17): EK-F teslim paketine eklenen ayrı bir PDF'tir;
// burası GÖVDEYE giren tek bir sayfadır — "kanca bloğu montaj şeması gövdede
// dursun" diyen mühendisin ihtiyacı.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runCalc } from "@/lib/calc/engine";
import {
  altsFromRevision,
  calcInputFromRevision,
  hiddenSectionsFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { buildEquipmentGroups } from "@/lib/excel/equipment";
import { catalogSheetFiles, catalogSheetUrl, findCatalogSheet } from "@/lib/catalog-sheets";
import { manualImageIntake, manualYazmaIzni } from "@/lib/manual/image-intake";

export const runtime = "nodejs";
export const maxDuration = 60;

interface FoyKaydi {
  id: string;
  baslik: string;
  ekipman: string;
  kaynak: string;
  sayfalar: number;
  /** Defterdeki göreli görüntü yolları. */
  images: string[];
}

async function foyler(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
): Promise<FoyKaydi[]> {
  const { data } = await supabase
    .from("revisions")
    .select("id, rev_no, status, inputs, selections")
    .eq("project_id", projectId)
    .order("rev_no", { ascending: false });
  const liste = (data ?? []) as Record<string, unknown>[];
  const revizyon = liste.find((r) => r.status === "issued") ?? liste[0];
  if (!revizyon) return [];

  const input = calcInputFromRevision(
    revizyon.inputs as RevisionInputsJson | null,
    revizyon.selections as RevisionSelectionsJson | null
  );
  runCalc(input);
  const alts = altsFromRevision(revizyon.selections as RevisionSelectionsJson | null);
  const gizli = hiddenSectionsFromRevision(revizyon.inputs as RevisionInputsJson | null);
  const gruplar = buildEquipmentGroups(input, undefined, alts, undefined, gizli);

  const out: FoyKaydi[] = [];
  const gorulen = new Set<string>();
  for (const g of gruplar) {
    for (const r of g.rows) {
      if (!r.kind) continue;
      const foy = findCatalogSheet(r.kind, r.brand, r.catalogModel ?? r.model, {
        inputRpm: r.catalogInputRpm ?? null,
      });
      if (!foy || foy.images.length === 0) continue;
      // AYNI FÖY BİR KEZ: aynı redüktör dört modülde geçiyorsa listede dört
      // kez görünmesi kullanıcıya bir şey söylemez.
      if (gorulen.has(foy.id)) continue;
      gorulen.add(foy.id);
      out.push({
        id: foy.id,
        baslik: foy.title,
        ekipman: `${g.name} · ${r.component}`,
        kaynak: `${foy.source} · ${foy.printedPages}`,
        sayfalar: foy.images.length,
        images: foy.images,
      });
    }
  }
  return out;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; revId: string }> }
) {
  const { id, revId } = await ctx.params;
  const supabase = await createClient();
  const izin = await manualYazmaIzni(supabase, id, revId);
  if ("error" in izin) return NextResponse.json({ error: izin.error }, { status: izin.status });

  const liste = await foyler(supabase, id);
  return NextResponse.json({
    foyler: liste.map(({ images, ...k }) => ({ ...k, sayfalar: images.length })),
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
    | { foyId?: string; sayfa?: number }
    | null;
  const foyId = String(govde?.foyId ?? "");
  const sayfa = Math.max(1, Number(govde?.sayfa ?? 1));
  if (!foyId) return NextResponse.json({ error: "Föy kimliği gerekli." }, { status: 400 });

  const foy = (await foyler(supabase, id)).find((f) => f.id === foyId);
  if (!foy) {
    return NextResponse.json({ error: "Föy bu vincin ekipmanında yok." }, { status: 404 });
  }
  const goreli = foy.images[sayfa - 1];
  if (!goreli) return NextResponse.json({ error: "Sayfa yok." }, { status: 404 });

  // DİZİN GEZME YÜZEYİ AÇILMAZ: yol DEFTERDE olmalı.
  if (!catalogSheetFiles().has(goreli)) {
    return NextResponse.json({ error: "Sayfa defterde yok." }, { status: 404 });
  }

  // BAYT DİSKTEN OKUNMAZ, VAR OLAN UÇTAN ALINIR.
  //
  // `readFile(join(process.cwd(), "catalog-sheets", …))` yazıldığında Next'in
  // dosya izleyicisi dizini ÇÖZEMEDİĞİ için TAMAMINI bu fonksiyona gömüyordu:
  // ölçüldü (31.08.2026), fonksiyon 182 MB'a çıkıyor ve Vercel'in 250 MB'lık
  // fonksiyon bütçesini `/projects/**` altındaki öteki uçlarla birlikte
  // zorluyordu (`next.config.ts`teki "Hobby function bütçesi" notu aynı
  // derdin izi).
  //
  // Katalog ağacını ZATEN taşıyan bir fonksiyon var: `/api/catalog-sheet`
  // (`outputFileTracingIncludes` ile elle eklenmiş). Bayt oradan alınır; bu uç
  // küçük kalır ve 176 MB'lık ağaç ikinci kez paketlenmez. Bedeli tek bir iç
  // ağ turudur.
  const kaynakAdres = new URL(catalogSheetUrl(goreli), new URL(req.url).origin);
  const yanit = await fetch(kaynakAdres);
  if (!yanit.ok) {
    return NextResponse.json({ error: "Katalog sayfası okunamadı." }, { status: 404 });
  }
  const bytes = new Uint8Array(await yanit.arrayBuffer());

  const sonuc = await manualImageIntake(
    supabase,
    revId,
    izin.userId,
    bytes,
    `${foy.baslik} s.${sayfa}.png`,
    { tur: "katalog", belgeId: foy.id, sayfa, ad: foy.baslik }
  );
  if ("error" in sonuc) return NextResponse.json({ error: sonuc.error }, { status: sonuc.status });
  return NextResponse.json({ image: sonuc.image, baslik: `${foy.baslik} (s. ${sayfa})` });
}
