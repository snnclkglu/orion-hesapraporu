// Paket genel bakışı: MONTAJ AĞACI + DOSYA GEZGİNİ.
//
// Ağaç `lib/diagrams` ile ÇİZİLMEZ (AGENTS md. 17): o katman `DiagramEl[]`
// üretir ve aynı model PDF'e basılır; burada gereken şey etkileşimli,
// girintili, kaydırılabilir bir HTML listesi.
//
// GİRİNTİ SINIRLIDIR (`min(level,4)`): kod altı segmente kadar iniyor
// (`0043-00-0802-00-02-06`) ve sınırsız girinti derin düğümleri telefonda
// ekranın dışına iterdi. Yazı KÜÇÜLTÜLMEZ — okunmayan bir ağaç ağaç değildir.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FILE_LIFECYCLE_LABELS } from "@/lib/drawings/types";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { loadFiles, loadPackage, loadParts, type FileRow, type PartRow } from "../data";
import { FileOpenButton } from "./file-open-button";

export default async function PackageOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const [parcalar, dosyalar] = await Promise.all([
    loadParts(supabase, id),
    loadFiles(supabase, id),
  ]);

  const dosyaKimlikYol = new Map(dosyalar.map((d) => [d.id, d]));

  // Ağaç: `parent_code` boş olanlar kök. Kodsuz satın alma satırları ağaca
  // GİRMEZ — onlar bir montajın altında durmaz, defterde durur.
  const kodlu = parcalar.filter((p) => p.part_code);
  const cocuklar = new Map<string, PartRow[]>();
  for (const p of kodlu) {
    const anahtar = p.parent_code || "";
    const liste = cocuklar.get(anahtar);
    if (liste) liste.push(p);
    else cocuklar.set(anahtar, [p]);
  }
  const kodKumesi = new Set(kodlu.map((p) => p.part_code));
  // Üstü defterde OLMAYAN düğüm de köktür: ağaç bir düğümü yutmamalı.
  const kokler = kodlu.filter((p) => !p.parent_code || !kodKumesi.has(p.parent_code));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="min-w-0 border bg-card">
        <header className="flex items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <h2 className="text-sm font-medium">Montaj Ağacı</h2>
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatNum(kodlu.length)} kodlu parça
          </span>
        </header>

        {kokler.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Defter henüz kurulmamış. Üstteki “Yeniden Eşleştir” ile kurabilirsiniz.
          </p>
        ) : (
          <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
            <ul className="min-w-[34rem] divide-y">
              {kokler.map((k) => (
                <Dugum
                  key={k.register_key}
                  part={k}
                  cocuklar={cocuklar}
                  seviye={0}
                  dosyaKimlikYol={dosyaKimlikYol}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <FileBrowser dosyalar={dosyalar} />
    </div>
  );
}

function Dugum({
  part,
  cocuklar,
  seviye,
  dosyaKimlikYol,
}: {
  part: PartRow;
  cocuklar: Map<string, PartRow[]>;
  seviye: number;
  dosyaKimlikYol: Map<string, FileRow>;
}) {
  const alt = cocuklar.get(part.part_code) ?? [];
  const dosyaVar = part.has_model || part.has_sheet || part.has_cut || part.has_3d;
  // İMALAT parçasının resminin olmaması insanın bakması gereken bir şeydir ve
  // raporu açmadan, ağaçta bir bakışta görünmelidir.
  const eksik = part.kind === "imalat" && !dosyaVar;
  const resim = part.sheet_file_id ? dosyaKimlikYol.get(part.sheet_file_id) : null;
  const kesim = part.cut_file_id ? dosyaKimlikYol.get(part.cut_file_id) : null;

  return (
    <li>
      <div
        className={
          "flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm" +
          (eksik ? " border-l-2 border-l-destructive bg-destructive/5" : "")
        }
        style={{ paddingLeft: `${1 + Math.min(seviye, 4) * 0.75}rem` }}
      >
        <span className="font-mono text-[12px] font-medium">{part.part_code}</span>
        <span className="min-w-0 flex-1 truncate text-foreground/80" title={part.description}>
          {part.description || part.name || part.assembly_title || "—"}
        </span>
        {part.qty != null && (
          <span className="font-mono text-[11px] text-muted-foreground">×{part.qty}</span>
        )}
        {part.material && (
          <span className="border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
            {part.material}
            {part.thickness_mm != null && ` ${formatNum(part.thickness_mm, 1)}mm`}
          </span>
        )}
        {part.weight_kg != null && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatNum(part.weight_kg, 1)} kg
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {resim && <FileOpenButton storagePath={resim.storage_path} label="RES" title={resim.file_name} />}
          {kesim && <FileOpenButton storagePath={kesim.storage_path} label="DXF" title={kesim.file_name} />}
          {part.has_3d && <span className="border px-1.5 font-mono text-[11px] text-muted-foreground">3D</span>}
          {eksik && (
            <span className="border border-destructive/40 bg-destructive/10 px-1.5 font-mono text-[11px] text-destructive">
              resim yok
            </span>
          )}
        </span>
      </div>

      {alt.length > 0 && (
        <ul className="divide-y border-t">
          {alt.map((c) => (
            <Dugum
              key={c.register_key}
              part={c}
              cocuklar={cocuklar}
              seviye={seviye + 1}
              dosyaKimlikYol={dosyaKimlikYol}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Dosya gezgini — GERÇEK klasör ağacına göre gruplu.
 *
 * MTC'nin `BARA AKIM ALMA KOLU`, `HALAT KLAVUZU`, `İSLEME RESİMLERİ` bölümleri
 * olduğu gibi görünür: ressamın kurduğu düzen sistemin uydurduğu bir düzene
 * çevrilmez, çünkü o düzen bir bilgi taşır.
 */
function FileBrowser({ dosyalar }: { dosyalar: FileRow[] }) {
  const canli = dosyalar.filter((d) => d.lifecycle === "canli");
  const digerleri = dosyalar.filter((d) => d.lifecycle !== "canli");

  const klasorler = new Map<string, FileRow[]>();
  for (const d of canli) {
    const k = d.folder || "(kök)";
    const liste = klasorler.get(k);
    if (liste) liste.push(d);
    else klasorler.set(k, [d]);
  }
  const sirali = [...klasorler.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));

  return (
    <section className="min-w-0 border bg-card">
      <header className="flex items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <h2 className="text-sm font-medium">Dosya Gezgini</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatNum(canli.length)} canlı · {formatNum(digerleri.length)} diğer
        </span>
      </header>

      <div className="max-h-[70vh] overflow-y-auto">
        {sirali.map(([klasor, liste]) => (
          <details key={klasor} className="border-b" open={sirali.length <= 4}>
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/40 pointer-coarse:py-2.5">
              <span className="font-mono text-[12px]">{klasor}</span>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {liste.length}
              </span>
            </summary>
            <ul className="divide-y border-t">
              {liste.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={d.file_name}>
                    {d.file_name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatBytes(d.size_bytes)}
                  </span>
                  <FileOpenButton storagePath={d.storage_path} label="Aç" title={d.rel_path} />
                </li>
              ))}
            </ul>
          </details>
        ))}

        {digerleri.length > 0 && (
          <details className="border-b">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/40 pointer-coarse:py-2.5">
              Süperse · kopya · hariç
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {digerleri.length}
              </span>
            </summary>
            <ul className="divide-y border-t">
              {digerleri.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={d.rel_path}>
                    {d.file_name}
                  </span>
                  <span className="border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                    {FILE_LIFECYCLE_LABELS[d.lifecycle]}
                  </span>
                  <FileOpenButton storagePath={d.storage_path} label="Aç" title={d.rel_path} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
