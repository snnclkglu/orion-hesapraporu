"use client";

// ZAMAN — işlerin başlangıç-bitiş aralıkları AY EKSENİ üzerinde.
//
// KULLANICI BİLDİRİMİ (18.08.2026): *"zaman gösteriminden bir şey
// anlaşılmıyor. Bizim işlerimiz genelde aylar sürüyor."* Haklıydı ve eksik
// olan şey ÖLÇEKTİ: çubuklar işaretsiz bir çizgide yüzüyor, iki uçta duran iki
// tarihten "bu iş hangi ay başlıyor, kaç ay sürüyor" okunamıyordu. Üç şey
// eklendi ve üçü de aynı soruya cevap verir:
//   · AY BAŞLIKLARI ve ay sınırlarında ızgara çizgileri (pencere ay sınırına
//     yuvarlanır — `buildGantt`),
//   · her satırda İŞİN SÜRESİ ay cinsinden,
//   · bugün imleci ve ayrı bir "bugün" başlığı.
//
// EKSEN YİNE KAYDIRMAZ (md. 15): çubuklar kap genişliğine ORANLANIR, yatay
// kaydırılan bir tuval yoktur. Dar ekranda ay başlıkları SEYRELİR — hepsini
// basmak 12 aylık pencerede okunmaz bir şerit üretirdi.
//
// Başlangıç = iş emri tarihi (yoksa kayıt); bitiş = teslim tarihi. Teslim
// tarihi girilmemiş iş "bugüne kadar" sürer ve AÇIK UÇLU işaretlenir —
// biten bir şey uydurulmaz. Başlangıcı da olmayan işler çizilmez, altta
// sayılır (sessiz düşürme yok).

import { useMemo } from "react";
import Link from "next/link";
import { buildGantt, todayMarker } from "@/lib/jobs/gantt";
import { monthLabel } from "@/lib/jobs/calendar";
import { fmtJobDate } from "@/lib/jobs/filter";
import { jobStatusOf } from "@/lib/job-status";
import { customerTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import type { JobRow } from "./jobs-table";

/** Durum → çubuk rengi (durum noktalarıyla aynı dil; kırmızı yok). */
const BAR_RENGI: Record<string, string> = {
  active: "bg-success/70",
  passive: "bg-amber-500/60",
  completed: "bg-foreground/50",
  archived: "bg-muted-foreground/30",
};

function bugunISO(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** "2026-08" → "AĞU 26" — eksen başlığı dar olmak zorunda. */
function ayKisa(ay: string): string {
  const [tam, yil] = monthLabel(ay).split(" ");
  return `${(tam ?? "").slice(0, 3).toLocaleUpperCase("tr-TR")} ${(yil ?? "").slice(2)}`;
}

/** Süre metni: "5,9 ay" · uzun işlerde okunacak birim aydır, gün değil. */
function sureMetni(ay: number): string {
  if (ay < 1) return "<1 ay";
  return `${ay.toFixed(1).replace(".", ",")} ay`;
}

export function TimelineView({ rows }: { rows: JobRow[] }) {
  const bugun = bugunISO();

  const model = useMemo(
    () =>
      buildGantt(
        rows.map((r) => ({
          id: r.id,
          start: (r.work_order_date || r.created_at || "").slice(0, 10) || null,
          end: r.deliveryDate ?? null,
        })),
        bugun
      ),
    [rows, bugun]
  );

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const cizilmeyen = useMemo(
    () => rows.filter((r) => !model?.bars.some((b) => b.id === r.id)),
    [rows, model]
  );

  if (!model) {
    return (
      <p className="border bg-card px-3 py-6 text-sm text-muted-foreground">
        Süzgeçlere uyan işlerde çizilecek tarih aralığı yok.
      </p>
    );
  }

  const isaret = todayMarker(model, bugun);
  // Sıra KRONOLOJİK TERSTİR (en yeni üstte); yıl bandı bunun kendiliğinden
  // çıkan sonucudur.
  const sirali = [...model.bars].sort((a, b) => b.start.localeCompare(a.start));

  // AY BAŞLIKLARI SEYRELİR: 12 aylık pencerede her ayı basmak dar ekranda
  // okunmaz bir şerit yapardı. Adım pencere uzunluğundan çıkar ve İLK ay her
  // zaman basılır — eksenin nereden başladığı kaybolmamalıdır.
  const adim =
    model.months.length <= 8 ? 1 : model.months.length <= 18 ? 2 : 3;

  /** Satır ızgarası: ad sütunu + çizelge. İki yerde birebir aynı olmalı. */
  const IZGARA =
    "grid grid-cols-[minmax(7rem,12rem)_1fr] items-center gap-2 sm:grid-cols-[minmax(9rem,16rem)_1fr]";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {model.months.length} ay · {model.bars.length} iş
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-primary" /> Bugün
          <span className="ml-3 inline-block h-2 w-6 border border-dashed border-muted-foreground/60" />{" "}
          teslim tarihi girilmemiş
        </span>
      </div>

      <div className="grid gap-1 rounded-lg border bg-card p-3">
        {/* AY ŞERİDİ — çizelgenin ölçeği. Ad sütunu boş bırakılır ki başlıklar
            çubuklarla AYNI hizada dursun (yoksa eksen kayar ve okunan ay
            yanlış olur). */}
        <div className={cn(IZGARA, "sticky top-0 z-10 bg-card pb-1")}>
          <span className="oc-kicker text-muted-foreground">Dönem</span>
          <div className="relative h-4 min-w-0">
            {model.months.map((m, i) => (
              <span
                key={m.ay}
                className={cn(
                  "absolute top-0 border-l pl-1 text-[10px] tabular-nums",
                  i % adim === 0
                    ? "border-border text-muted-foreground"
                    : "border-border/40 text-transparent"
                )}
                style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
              >
                {i % adim === 0 ? ayKisa(m.ay) : ""}
              </span>
            ))}
          </div>
        </div>

        {sirali.map((b) => {
          const r = rowById.get(b.id);
          if (!r) return null;
          return (
            <div key={b.id} className={IZGARA}>
              <Link
                href={`/jobs/${r.id}`}
                className="min-w-0 py-0.5 hover:underline"
                title={r.title}
              >
                <span className="block truncate font-mono text-xs font-medium text-primary">
                  {r.job_no}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {customerTag({ name: r.customer, shortName: r.customerShort }).short}
                  {" · "}
                  {r.title}
                </span>
              </Link>
              <div className="relative h-6 min-w-0 bg-muted/30">
                {/* Ay ızgarası çubukların ALTINDA: satırdaki her çubuk kendi
                    ayına oturur ve okuyucu tarihe bakmadan hizalayabilir. */}
                {model.months.map((m) => (
                  <span
                    key={m.ay}
                    aria-hidden
                    className="absolute top-0 bottom-0 border-l border-border/40"
                    style={{ left: `${m.leftPct}%` }}
                  />
                ))}
                {isaret != null && (
                  <span
                    aria-hidden
                    className="absolute top-0 bottom-0 w-0.5 bg-primary/70"
                    style={{ left: `${isaret}%` }}
                  />
                )}
                <span
                  title={`${fmtJobDate(b.start)} → ${
                    b.openEnded ? "teslim tarihi yok" : fmtJobDate(b.end)
                  } · ${sureMetni(b.aySuresi)}`}
                  className={cn(
                    "absolute top-0.5 bottom-0.5 flex items-center overflow-hidden px-1",
                    BAR_RENGI[jobStatusOf(r.status)] ?? "bg-muted-foreground/40",
                    b.openEnded && "border border-dashed border-muted-foreground/60"
                  )}
                  style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                >
                  {/* SÜRE ÇUBUĞUN İÇİNDE — ama yalnız sığdığı zaman. Dar bir
                      çubuğa yazı basmak metni komşu çubukların üstüne taşırır;
                      taşan hâlinde bilgi zaten `title`dadır. */}
                  {b.widthPct >= 12 && (
                    <span className="truncate text-[10px] font-medium text-background tabular-nums">
                      {sureMetni(b.aySuresi)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {cizilmeyen.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {cizilmeyen.length} işin başlangıç tarihi yok — çizelgeye giremedi:
          {" "}
          {cizilmeyen.slice(0, 5).map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/jobs/${r.id}`} className="font-mono text-primary hover:underline">
                {r.job_no}
              </Link>
            </span>
          ))}
          {cizilmeyen.length > 5 && "…"}
        </p>
      )}
    </div>
  );
}
