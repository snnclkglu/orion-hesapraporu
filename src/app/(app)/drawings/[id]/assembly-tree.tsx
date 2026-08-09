// Montaj ağacı — girintili, kaydırılabilir HTML listesi.
//
// `lib/diagrams` ile ÇİZİLMEZ (AGENTS md. 17): o katman `DiagramEl[]` üretir ve
// aynı model PDF'e basılır; burada gereken etkileşimli bir liste.
//
// GİRİNTİ SINIRLIDIR (`min(level,4)`): kod altı segmente kadar iniyor
// (`0043-00-0802-00-02-06`) ve sınırsız girinti derin düğümleri telefonda ekran
// dışına iterdi. Yazı KÜÇÜLTÜLMEZ — okunmayan bir ağaç ağaç değildir.
//
// Kendi dosyasında durur ki `/dev/drawings-preview` onu auth'suz basabilsin:
// bu ekranı her değişiklikte gerçek veriyle denemek zorunda kalmak, kusurların
// kullanıcıya ulaşmasına sebep oluyordu.

import { formatNum } from "@/lib/drawings/labels";
import type { FileRow, PartRow } from "../data";
import { FileOpenButton } from "./file-open-button";

export function AssemblyTree({
  parts,
  filesById,
}: {
  parts: PartRow[];
  filesById: Map<string, FileRow>;
}) {
  // Kodsuz satın alma satırları ağaca GİRMEZ — onlar bir montajın altında
  // durmaz, defterde durur.
  const kodlu = parts.filter((p) => p.part_code);
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
                dosyaKimlikYol={filesById}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
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

  // ANA GRUP SATIRI (0057-00-0500, 0057-00-0510 …) ayırt edici basılır.
  //
  // 121 parçalık bir ağaçta bütün kodlar aynı ağırlıkta olunca grup sınırları
  // kayboluyor ve göz nerede bir montajın bittiğini göremiyor. Girinti tek
  // başına yetmiyor çünkü dar ekranda 0,75rem'e sıkışıyor. Ayrım TİPOGRAFİYLE
  // yapılır: kod kalın, satır hafif zeminli ve üstünde bir çizgi — marka dili
  // gereği renk değil AĞIRLIK ve KURAL kullanılır.
  const anaGrup = seviye === 0;

  return (
    <li>
      <div
        className={
          "flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-sm" +
          (anaGrup ? " border-t border-t-border bg-muted/40" : "") +
          (eksik ? " border-l-2 border-l-destructive bg-destructive/5" : "")
        }
        style={{ paddingLeft: `${1 + Math.min(seviye, 4) * 0.75}rem` }}
      >
        <span
          className={
            anaGrup
              ? "font-mono text-[13px] font-bold tracking-tight"
              : "font-mono text-[12px] font-medium"
          }
        >
          {part.part_code}
        </span>
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
          {resim && (
            <FileOpenButton
              storagePath={resim.storage_path}
              fileName={resim.file_name}
              label="PDF"
              title={resim.file_name}
            />
          )}
          {kesim && (
            <FileOpenButton
              storagePath={kesim.storage_path}
              fileName={kesim.file_name}
              label="DXF"
              title={kesim.file_name}
            />
          )}
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
