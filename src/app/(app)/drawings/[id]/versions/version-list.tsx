// Sürüm zincirinin sunumu — TABLO DEĞİL BLOK LİSTE.
//
// AGENTS dokunmatik MOBIL-7 sütun önceliklendirmeyi TABLOLAR için tarif eder:
// sabit sütunlu bir listede hangi sütunun telefonda düşeceğine karar verilir.
// Burada öyle bir sütun yok — "+12 dosya · −3 dosya · 5 parça değişti" değişken
// uzunlukta bir CÜMLEDİR ve her genişlikte bir bloktur. Tabloya sokulsaydı
// telefonda ya kırpılır ya da satırı kabın iki katına çıkarırdı.
//
// SUNUCU BİLEŞENİDİR: ayrıntı `<details>` ile açılır, JavaScript gerekmez.
// 131 değişen parçalık bir farkı istemciye serileştirmenin bedeli, hiç
// kullanılmayabilecek bir açılır panel için fazla yüksekti.
//
// BAŞLIK ÖZETTİR, GÖVDE DÖKÜM DEĞİLDİR. MTC'de tek bir mühendislik kararı
// (ana kiriş 1 → 2) 131 değişen parça üretiyor ve bunun 24'ü tek bir montajın
// altında. Ham dökümü basmak raporu okunmaz yapar; gövde ilk satırları gösterip
// "ve n tane daha" der.

import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";
import {
  DIFF_FIELD_LABELS,
  diffOzetMetni,
  isNumericDiffField,
  type ChangedPart,
  type DiffFile,
  type PackageDiff,
  type PartFieldChange,
} from "@/lib/drawings/diff";
import {
  PACKAGE_STATUS_LABELS,
  formatBytes,
  formatDate,
  formatNum,
} from "@/lib/drawings/labels";
import type { DwgPackageStatus } from "@/lib/drawings/types";

/** Ayrıntıda en çok kaç satır basılır — gerisi "ve n tane daha" olur. */
const DOSYA_SINIRI = 8;
const PARCA_SINIRI = 12;

export interface VersionBlockData {
  id: string;
  revNo: number;
  status: DwgPackageStatus;
  folderName: string;
  createdAt: string;
  fileCount: number;
  partCount: number;
  bytesTotal: number;
  /** Şu an bakılan paket */
  bugunku: boolean;
  /** `supersedes_id` ile bağlı mı, yoksa yalnız (kalem, grup) kardeşi mi? */
  zincirBagli: boolean;
  /** Bir öncekine göre fark; en eski sürümde ve ölçülmeyenlerde null */
  fark: PackageDiff | null;
  /** Zincir sınırının dışında kaldığı için fark HESAPLANMADI */
  olculmedi: boolean;
}

function Cip({
  children,
  ton = "notr",
  title,
}: {
  children: React.ReactNode;
  ton?: "notr" | "vurgu" | "uyari";
  title?: string;
}) {
  const renk =
    ton === "vurgu"
      ? "border-primary/40 bg-primary/10 text-primary"
      : ton === "uyari"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span className={`border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ${renk}`} title={title}>
      {children}
    </span>
  );
}

/** Boş değer gösterimi — "" bir hücreyi görünmez yapar, tire yapmaz. */
function deger(c: PartFieldChange, yan: "eski" | "yeni"): string {
  if (isNumericDiffField(c.field)) {
    const n = yan === "eski" ? c.eskiNum : c.yeniNum;
    return n == null ? "—" : formatNum(n, 3);
  }
  const m = yan === "eski" ? c.eski : c.yeni;
  return m || "—";
}

function ParcaSatiri({ c }: { c: ChangedPart }) {
  const ad = c.yeni.partCode || c.yeni.description || c.key;
  return (
    <li className="grid gap-0.5 py-1.5">
      <span className="font-mono text-[11px] font-medium break-all">{ad}</span>
      <span className="grid gap-0.5">
        {c.changes.map((x) => (
          <span key={x.field} className="text-[11px] text-muted-foreground">
            <span className="text-foreground/80">{DIFF_FIELD_LABELS[x.field]}:</span>{" "}
            <span className="line-through decoration-muted-foreground/50">{deger(x, "eski")}</span>
            <ArrowRight className="mx-1 inline size-3 align-[-1px]" aria-hidden />
            <span className="text-foreground">{deger(x, "yeni")}</span>
          </span>
        ))}
      </span>
    </li>
  );
}

function DosyaListesi({
  baslik,
  dosyalar,
}: {
  baslik: string;
  dosyalar: { relPath: string; not?: string }[];
}) {
  if (!dosyalar.length) return null;
  const gosterilen = dosyalar.slice(0, DOSYA_SINIRI);
  return (
    <div className="grid gap-1">
      <p className="oc-kicker text-muted-foreground">
        {baslik} ({formatNum(dosyalar.length)})
      </p>
      <ul className="grid gap-0.5">
        {gosterilen.map((d) => (
          <li key={d.relPath} className="font-mono text-[11px] break-all text-muted-foreground">
            {d.relPath}
            {d.not && <span className="ml-1 text-foreground/70">{d.not}</span>}
          </li>
        ))}
      </ul>
      {dosyalar.length > gosterilen.length && (
        <p className="text-[11px] text-muted-foreground">
          ve {formatNum(dosyalar.length - gosterilen.length)} tane daha
        </p>
      )}
    </div>
  );
}

function FarkAyrintisi({ fark }: { fark: PackageDiff }) {
  const yol = (f: DiffFile) => ({ relPath: f.relPath });
  const parcalar = fark.degisenParcalar.slice(0, PARCA_SINIRI);
  const alanlar = Object.entries(fark.ozet.alanSayaci).filter(([, n]) => n > 0);

  return (
    <div className="grid gap-3 border-t bg-muted/20 px-3 py-3">
      <DosyaListesi baslik="Yeni dosya" dosyalar={fark.yeniDosyalar.map(yol)} />
      <DosyaListesi baslik="Silinen dosya" dosyalar={fark.silinenDosyalar.map(yol)} />
      <DosyaListesi
        baslik="İçeriği değişen dosya"
        dosyalar={fark.degisenDosyalar.map((c) => ({
          relPath: c.yeni.relPath,
          // Boyut farkı ayrı bir bilgidir: "içerik değişti" ile "6 KB büyüdü"
          // ressam için aynı şey değil.
          not: [
            c.renamed ? `← ${c.eski.relPath.split("/").pop()}` : "",
            c.sizeDelta ? `${c.sizeDelta > 0 ? "+" : "−"}${formatBytes(Math.abs(c.sizeDelta))}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />

      {(fark.yeniParcalar.length > 0 || fark.silinenParcalar.length > 0) && (
        <div className="grid gap-1">
          <p className="oc-kicker text-muted-foreground">Parça defteri</p>
          <p className="text-[11px] text-muted-foreground">
            {formatNum(fark.yeniParcalar.length)} yeni ·{" "}
            {formatNum(fark.silinenParcalar.length)} listeden düşmüş
          </p>
          <ul className="grid gap-0.5">
            {fark.yeniParcalar.slice(0, PARCA_SINIRI).map((p) => (
              <li key={p.registerKey} className="font-mono text-[11px] break-all text-muted-foreground">
                + {p.partCode || p.description}
              </li>
            ))}
          </ul>
          {fark.yeniParcalar.length > PARCA_SINIRI && (
            <p className="text-[11px] text-muted-foreground">
              ve {formatNum(fark.yeniParcalar.length - PARCA_SINIRI)} tane daha
            </p>
          )}
        </div>
      )}

      {fark.degisenParcalar.length > 0 && (
        <div className="grid gap-1">
          <p className="oc-kicker text-muted-foreground">
            Değişen parça ({formatNum(fark.degisenParcalar.length)})
          </p>
          <p className="flex flex-wrap gap-1">
            {alanlar.map(([alan, n]) => (
              <Cip key={alan}>
                {DIFF_FIELD_LABELS[alan as keyof typeof DIFF_FIELD_LABELS]} {formatNum(n)}
              </Cip>
            ))}
          </p>
          <ul className="divide-y">
            {parcalar.map((c) => (
              <ParcaSatiri key={c.key} c={c} />
            ))}
          </ul>
          {fark.degisenParcalar.length > parcalar.length && (
            <p className="text-[11px] text-muted-foreground">
              ve {formatNum(fark.degisenParcalar.length - parcalar.length)} parça daha —
              tek bir montaj kararı yüzü aşan satır üretebilir; tamamı Parça Defteri&apos;ndedir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function VersionList({ surumler }: { surumler: VersionBlockData[] }) {
  if (surumler.length <= 1) {
    return (
      <section className="border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="size-4 text-primary" />
          Tek sürüm
        </h2>
        <p className="mt-1 max-w-prose text-[12px] text-muted-foreground">
          Bu paketin başka bir sürümü yok. Aynı iş kalemi ve grup için yeni bir
          klasör yüklendiğinde sihirbaz &quot;öncekini süperse edeyim mi?&quot;
          diye sorar; bağlanan sürümler burada zincir olarak görünür ve aradaki
          fark satır satır çıkar.
        </p>
      </section>
    );
  }

  return (
    <ol className="grid gap-3">
      {surumler.map((s, i) => (
        <li key={s.id}>
          <article
            className={`border bg-card ${s.bugunku ? "border-primary/60" : ""}`}
            aria-current={s.bugunku ? "true" : undefined}
          >
            <header className="grid gap-1.5 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-sm font-semibold">R{s.revNo}</span>
                <Cip ton={s.status === "aktif" ? "vurgu" : "notr"}>
                  {PACKAGE_STATUS_LABELS[s.status]}
                </Cip>
                {s.bugunku ? (
                  <Cip ton="vurgu">bu sürüm</Cip>
                ) : (
                  <Link
                    href={`/drawings/${s.id}`}
                    className="border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground pointer-coarse:px-2 pointer-coarse:py-1"
                  >
                    aç
                  </Link>
                )}
                {!s.zincirBagli && (
                  <Cip
                    ton="uyari"
                    title="Aynı kalem ve grup için ikinci bir paket; süperse bağı kurulmamış. Bu meşru olabilir — aynı grubun iki ayrı teslimi olabilir."
                  >
                    bağlanmamış ikiz
                  </Cip>
                )}
              </div>

              <p className="font-mono text-[11px] text-muted-foreground">
                {[
                  formatDate(s.createdAt),
                  `${formatNum(s.fileCount)} dosya`,
                  `${formatNum(s.partCount)} parça`,
                  formatBytes(Number(s.bytesTotal ?? 0)),
                ].join(" · ")}
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground/70" title={s.folderName}>
                {s.folderName}
              </p>

              {/* Fark satırı — bir öncekiyle karşılaştırma. */}
              {i < surumler.length - 1 && (
                <p className="mt-0.5 text-[12px]">
                  {s.olculmedi ? (
                    <span className="text-muted-foreground">
                      Önceki sürüme göre fark hesaplanmadı — zincirin bu kadar gerisi
                      istek başına okunmuyor.
                    </span>
                  ) : s.fark ? (
                    <span className={s.fark.ozet.bos ? "text-muted-foreground" : "text-foreground"}>
                      Önceki sürüme göre: {diffOzetMetni(s.fark.ozet)}
                    </span>
                  ) : null}
                </p>
              )}
            </header>

            {s.fark && !s.fark.ozet.bos && (
              <details className="group">
                <summary className="cursor-pointer border-t px-3 py-2 text-[12px] text-muted-foreground transition-colors select-none hover:text-foreground pointer-coarse:py-2.5">
                  Ayrıntı
                </summary>
                <FarkAyrintisi fark={s.fark} />
              </details>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}
