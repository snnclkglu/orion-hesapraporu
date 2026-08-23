"use client";

// Günlük çizelge düzenleyicisi.
//
// GÜN BİR BÜTÜNDÜR. Satırlar tek tek değil, gün tek "Kaydet" ile yazılır:
// kullanıcı çizelgeyi kâğıt üzerinde nasıl dolduruyorsa öyle çalışır, her
// hücre değişiminde ağ isteği beklemez. Kaydedilmemiş değişiklik hem şeritte
// hem sekmeden ayrılırken uyarıyla bildirilir.
//
// SAYILAR METİN OLARAK TUTULUR ve yalnız kaydederken sayıya çevrilir
// (`parseNum`, projenin her yerdeki kalıbı): "8," yazarken alan boşalmaz,
// Türkçe klavyede ondalık ayıracı virgüldür.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Minus,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboOption } from "@/components/combobox";
import { CustomerTag } from "@/components/tags";
import { parseNum } from "@/lib/currency";
import { tagStyle } from "@/lib/tags";
import {
  fmtDateLong,
  fmtManHours,
  isWeekend,
  shiftDay,
  todayIso,
  type WorkCategory,
  type WorkJobOption,
  type WorkLogRow,
  type WorkPart,
} from "@/lib/work-log";
import { cn } from "@/lib/utils";
import { createWorkPart, saveWorkDay } from "./actions";
import type { RecentCombo } from "./data";

interface EditRow {
  /** Yerel anahtar — React listesi için; DB kimliği değildir */
  key: string;
  id: string | null;
  itemNo: string;
  partId: string;
  categoryId: string;
  partCode: string;
  people: string;
  hours: string;
  note: string;
}

let seq = 0;
function newKey(): string {
  seq += 1;
  return `r${seq}`;
}

/**
 * Çizelge sütun şablonu — başlık şeridi ve satırlar aynı ızgarayı paylaşır.
 *
 * YALNIZ `lg` ÜSTÜNDE: sekiz sütunun sabit genişlikleri tek başına 27,5rem
 * eder ve şablon 62rem'in altında kullanılamaz. Dar ekranda satır bu ızgaraya
 * girdiğinde HER GİRİŞ ALANI kaydırma kabının içinde kalıyor, kullanıcı
 * "yaz → sağa kaydır → yaz" döngüsüne giriyordu. Kırılım `md` değil `lg`:
 * kabuk sol menüyü yalnız `lg` üstünde gösterir, yani 768px tablet portre hâlâ
 * mobil düzendir ve orada ızgara 992px isteyip yine kaydırırdı.
 *
 * `lg` altında satır dört sıraya açılan bir karttır (`col-span-*` yerleşimi).
 */
const GRID_COLS =
  "lg:grid-cols-[minmax(0,2fr)_minmax(0,1.7fr)_minmax(0,1.4fr)_5.5rem_7.5rem_5.5rem_6rem_3rem]";

/** Kart düzeninde her alanın kendi başlığı olur (ızgara düzeninde başlık şeridi vardır). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block truncate text-[11px] text-muted-foreground lg:hidden">
      {children}
    </span>
  );
}

function toEditRow(r: WorkLogRow): EditRow {
  return {
    key: newKey(),
    id: r.id,
    itemNo: r.itemNo,
    partId: r.partId,
    categoryId: r.categoryId,
    partCode: r.partCode,
    people: String(r.people),
    hours: String(r.hours),
    note: r.note,
  };
}

/** Kaydedilmemiş değişiklik karşılaştırması — kimlik dışındaki tüm alanlar. */
function fingerprint(rows: readonly EditRow[]): string {
  return rows
    .map((r) =>
      [r.id ?? "", r.itemNo, r.partId, r.categoryId, r.partCode, r.people, r.hours, r.note].join("§")
    )
    .join("¶");
}

export function DayEntry({
  date,
  rows: initialRows,
  previous,
  parts,
  categories,
  jobs,
  recent,
  codeHints,
  dailyTotals,
}: {
  date: string;
  rows: WorkLogRow[];
  previous: { date: string; rows: WorkLogRow[] } | null;
  parts: WorkPart[];
  categories: WorkCategory[];
  jobs: WorkJobOption[];
  recent: RecentCombo[];
  codeHints: Record<string, string>;
  dailyTotals: Record<string, number>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>(() => initialRows.map(toEditRow));
  const [saving, setSaving] = useState(false);
  /** Son kaydedilen hâlin parmak izi — "kaydedilmemiş değişiklik var mı" bundan çıkar. */
  const [baseline, setBaseline] = useState(() => fingerprint(initialRows.map(toEditRow)));

  // Sunucudan YENİ bir gün geldiğinde (tarih değişimi ya da kaydetme sonrası
  // yenileme) düzenleyici o günün verisine sıfırlanır.
  //
  // Bu bir EFEKT DEĞİL, "prop değişince durumu ayarla" desenidir: efektle
  // yazmak önce eski günü boyayıp sonra yenisiyle değiştirir (bir kare yanlış
  // çizelge görünür). React bu düzeltmeyi ekrana hiç basmadan yapar.
  const [source, setSource] = useState(initialRows);
  if (source !== initialRows) {
    const next = initialRows.map(toEditRow);
    setSource(initialRows);
    setRows(next);
    setBaseline(fingerprint(next));
  }

  const dirty = fingerprint(rows) !== baseline;

  // Sekmeden ayrılırken uyarı — bir günlük çizelgeyi yeniden yazmak pahalıdır.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const jobByNo = useMemo(() => new Map(jobs.map((j) => [j.itemNo, j])), [jobs]);

  const jobOptions: ComboOption[] = useMemo(
    () =>
      jobs.map((j) => ({
        value: j.itemNo,
        label: j.itemNo,
        hint: j.orphan
          ? "Sistemde iş kalemi yok — kayıt yine tutulur"
          : [j.productName, j.customerShort || j.customer].filter(Boolean).join(" · "),
        keywords: [j.productName, j.customer, j.customerShort ?? "", j.jobNo],
        hue: j.customerHue ?? undefined,
        badge: j.orphan ? "eşleşmemiş" : undefined,
      })),
    [jobs]
  );

  const partOptions: ComboOption[] = useMemo(
    () => parts.map((p) => ({ value: p.id, label: p.name })),
    [parts]
  );

  const setRow = useCallback((key: string, patch: Partial<EditRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  /** Kalem ya da parça değişince grup kodunu geçmişten öner. */
  const applyCodeHint = useCallback(
    (key: string, itemNo: string, partId: string, current: string) => {
      if (current.trim()) return;
      const hint = codeHints[`${itemNo}|${partId}`];
      if (hint) setRow(key, { partCode: hint });
    },
    [codeHints, setRow]
  );

  const addRow = useCallback(
    (seed?: Partial<EditRow>) => {
      const row: EditRow = {
        key: newKey(),
        id: null,
        itemNo: "",
        partId: "",
        // Varsayılan tür EN ÇOK KULLANILANDIR (defterin `sort` sırası kullanım
        // sıklığına göredir): satırların üçte ikisi çelik imalattır.
        categoryId: categories[0]?.id ?? "",
        partCode: "",
        people: "1",
        hours: "8",
        note: "",
        ...seed,
      };
      setRows((prev) => [...prev, row]);
    },
    [categories]
  );

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function copyPrevious() {
    if (!previous) return;
    setRows((prev) => [
      ...prev,
      ...previous.rows.map((r) => ({ ...toEditRow(r), id: null, key: newKey() })),
    ]);
    toast.success(`${previous.rows.length} satır kopyalandı — kaydetmeyi unutmayın.`);
  }

  function addFromCombo(c: RecentCombo) {
    addRow({
      itemNo: c.itemNo,
      partId: c.partId,
      categoryId: c.categoryId,
      partCode: c.partCode,
      people: String(c.people),
      hours: String(c.hours),
    });
  }

  async function addPart(name: string, rowKey: string) {
    const res = await createWorkPart(name);
    if (res.error || !res.part) {
      toast.error(res.error ?? "Parça eklenemedi");
      return;
    }
    // Yeni parça satıra hemen yazılır; listenin tazelenmesini beklemek
    // kullanıcıyı ortada bırakırdı.
    setRow(rowKey, { partId: res.part.id });
    toast.success(`"${res.part.name}" eklendi.`);
    router.refresh();
  }

  const totals = useMemo(() => {
    let manHours = 0;
    let people = 0;
    let invalid = 0;
    for (const r of rows) {
      const p = parseNum(r.people);
      const h = parseNum(r.hours);
      if (!r.itemNo || !r.partId || !r.categoryId || !p || !h || p <= 0 || h <= 0) {
        invalid += 1;
        continue;
      }
      manHours += p * h;
      people += p;
    }
    return { manHours, people, invalid };
  }, [rows]);

  const save = useCallback(async () => {
    if (saving) return;
    const payload = [];
    for (const r of rows) {
      const people = parseNum(r.people);
      const hours = parseNum(r.hours);
      if (!r.itemNo.trim()) return toast.error("Her satırda iş kalemi seçilmeli.");
      if (!r.partId) return toast.error("Her satırda parça seçilmeli.");
      if (!r.categoryId) return toast.error("Her satırda imalat türü seçilmeli.");
      if (!people || people <= 0) return toast.error("Kişi sayısı sıfırdan büyük olmalı.");
      if (!hours || hours <= 0) return toast.error("Saat sıfırdan büyük olmalı.");
      payload.push({
        id: r.id,
        itemNo: r.itemNo.trim(),
        partId: r.partId,
        categoryId: r.categoryId,
        partCode: r.partCode.trim(),
        people: Math.round(people),
        hours,
        note: r.note.trim(),
      });
    }

    setSaving(true);
    const res = await saveWorkDay({ date, rows: payload });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setBaseline(fingerprint(rows));
    toast.success(
      payload.length === 0 ? "Gün boşaltıldı." : `${payload.length} satır kaydedildi.`
    );
    router.refresh();
  }, [date, rows, router, saving]);

  // Ctrl/⌘ + S — çizelge ekranında en çok istenen kısayol.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  function goto(iso: string) {
    if (dirty && !window.confirm("Kaydedilmemiş değişiklikler var. Yine de gün değiştirilsin mi?"))
      return;
    router.push(`/worklog?tarih=${iso}`);
  }

  const today = todayIso();
  const recentDays = useMemo(() => {
    const out: { iso: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const iso = shiftDay(date, -i);
      out.push({ iso, total: dailyTotals[iso] ?? 0 });
    }
    return out;
  }, [date, dailyTotals]);
  const recentPeak = Math.max(1, ...recentDays.map((d) => d.total));

  return (
    <div className="grid gap-4">
      {/* Tarih gezinme + gün özeti */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goto(shiftDay(date, -1))}
            aria-label="Önceki gün"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goto(shiftDay(date, 1))}
            aria-label="Sonraki gün"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            <span className="font-mono text-sm font-semibold tabular-nums">
              {fmtDateLong(date)}
            </span>
            {date === today && (
              <span className="oc-kicker text-primary" aria-label="Bugün">
                Bugün
              </span>
            )}
            {isWeekend(date) && (
              <span className="font-mono text-[11px] text-muted-foreground">· hafta sonu</span>
            )}
          </div>
        </div>

        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && goto(e.target.value)}
          className="h-8 w-[10.5rem] pointer-coarse:h-10"
          aria-label="Tarih seç"
        />
        {date !== today && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => goto(today)}>
            Bugüne dön
          </Button>
        )}

        {/* İki özet bloğu + Kaydet'in min-content genişliği 330px'i geçiyordu:
            `ml-auto` ile sağa itildiklerinde 360px'lik ekranda şerit yatay
            taşıyordu. Telefonda blok kendi satırını alır ve yayılır. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:ml-auto sm:w-auto sm:flex-nowrap sm:justify-end">
          <div className="text-right leading-tight">
            <div className="oc-kicker text-muted-foreground">Gün Toplamı</div>
            <div className="font-mono text-lg font-semibold tabular-nums">
              {fmtManHours(totals.manHours)}{" "}
              <span className="text-xs font-normal text-muted-foreground">adam·saat</span>
            </div>
          </div>
          <div className="text-right leading-tight">
            <div className="oc-kicker text-muted-foreground">Kişi</div>
            <div className="font-mono text-lg font-semibold tabular-nums">{totals.people}</div>
          </div>
          <Button onClick={() => void save()} disabled={saving || !dirty} className="gap-2">
            {saving ? "Kaydediliyor…" : dirty ? "Kaydet" : "Kaydedildi"}
            {/* Kısayol rozeti telefonda düğmenin üçte birini yiyor, dokunmatikte
                de karşılığı yok. */}
            <span className="hidden font-mono text-[10px] opacity-70 md:inline">Ctrl+S</span>
          </Button>
        </div>
      </div>

      {/* Son 14 gün — kayıt sürekliliği tek bakışta görünür, atlanan gün
          göze batar. Tıklanınca o güne gidilir. */}
      <div className="min-w-0 rounded-lg border bg-card px-3 py-2">
        <span className="oc-kicker mb-2 block text-muted-foreground">Son 14 Gün</span>
        <div className="grid grid-cols-7 gap-1 sm:[grid-template-columns:repeat(14,minmax(0,1fr))]">
          {recentDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => goto(d.iso)}
              title={`${d.iso.slice(8)}.${d.iso.slice(5, 7)} · ${fmtManHours(d.total)} adam·saat`}
              className={cn(
                "group flex min-w-0 flex-col items-center gap-1",
                d.iso === date && "font-semibold"
              )}
            >
              <span className="flex h-8 w-full items-end justify-center bg-muted/60">
                <span
                  className={cn(
                    "w-full transition-colors",
                    d.iso === date ? "bg-primary" : "bg-primary/35 group-hover:bg-primary/60"
                  )}
                  style={{ height: `${Math.max((d.total / recentPeak) * 100, d.total > 0 ? 8 : 0)}%` }}
                />
              </span>
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  d.iso === date ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {d.iso.slice(8)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Önceki günü kopyala — gün boşken en büyük kaldıraç */}
      {previous && previous.rows.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 border px-3 py-2.5",
            rows.length === 0 ? "border-primary/40 bg-primary/5" : "bg-card"
          )}
        >
          <Copy className="size-4 shrink-0 text-primary" />
          <span className="text-sm">
            <span className="font-medium">{previous.date.slice(8)}.{previous.date.slice(5, 7)}</span>{" "}
            gününde <span className="font-mono tabular-nums">{previous.rows.length}</span> satır
            yazılmıştı.
            {rows.length === 0 && " Aynı çizelgeyle devam edin."}
          </span>
          <Button variant={rows.length === 0 ? "default" : "outline"} size="sm" onClick={copyPrevious}>
            Önceki günü kopyala
          </Button>
        </div>
      )}

      {/* Sık kullanılanlar — tek tıkla dolu satır */}
      {recent.length > 0 && (
        <div className="rounded-lg border bg-card px-3 py-2.5">
          {/* Etiket "SON kullanılan"dır, "sık" değil: sıralama önce TARİHE
              bakar (`loadRecentCombos`), sıklık yalnız eşitlikte devreye girer.
              Kurgunun tamamı "dünü tekrarla" üzerine oturduğu için doğru
              davranış budur; yanlış olan yalnız eski etiketti. */}
          <div className="oc-kicker mb-2 text-muted-foreground">Son Kullanılan · tek tıkla ekle</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((c) => (
              <button
                key={`${c.itemNo}|${c.partId}|${c.categoryId}`}
                type="button"
                onClick={() => addFromCombo(c)}
                title={`${c.itemNo} · ${c.partName} · ${c.categoryName} — son: ${c.people} kişi × ${c.hours} saat`}
                /* Ekranın en çok tıklanması hedeflenen kontrolü 24px yüksekti;
                   dokunmatikte tam boy verilir ve uzun parça adı çipi ekran
                   dışına taşırmaz. */
                className="flex min-h-9 max-w-full items-center gap-1.5 border bg-background px-2 py-1 text-xs transition-colors pointer-coarse:min-h-10 hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="oc-tag-dot" style={tagStyle(c.categoryHue)} aria-hidden />
                <span className="font-mono text-[11px] font-medium text-primary">{c.itemNo}</span>
                <span className="text-muted-foreground">·</span>
                <span className="min-w-0 truncate">{c.partName}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {c.people}×{fmtManHours(c.hours)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Çizelge
          BOŞ DURUM ve ALT TOPLAM ŞERİDİ kaydırma kabının DIŞINDADIR: içeride
          `min-w-[62rem]` onları da 992px'e geriyordu ve telefonda boş gün
          ekranında ortalanmış içerik görünür alanın dışında kalıyor, "Satır
          ekle" düğmesine ulaşılamıyordu. */}
      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
              [ BU GÜNE KAYIT YOK ]
            </h2>
            <p className="max-w-sm text-sm text-foreground/70">
              Önceki günü kopyalayın, sık kullanılan bir kalemi tıklayın ya da boş satır
              ekleyin.
            </p>
            <Button variant="outline" size="sm" onClick={() => addRow()} className="gap-1.5">
              <Plus className="size-3.5" /> Satır ekle
            </Button>
          </div>
        ) : (
          <div className="oc-scrollx overflow-x-auto overscroll-x-contain">
            <div className="lg:min-w-[62rem]">
              {/* Başlık şeridi yalnız ızgara düzeninde anlamlıdır; kart
                  düzeninde her alan kendi başlığını taşır. */}
              <div
                className={cn(
                  "hidden items-center gap-2 border-b bg-muted/50 px-3 py-2 lg:grid",
                  GRID_COLS
                )}
              >
                {["İş Kalemi", "Parça", "İmalat Türü", "Grup", "Adam", "Saat", "Adam·Saat", ""].map(
                  (h, i) => (
                    <span
                      key={h || `x${i}`}
                      className={cn(
                        "oc-kicker text-muted-foreground",
                        (i === 6) && "text-right"
                      )}
                    >
                      {h}
                    </span>
                  )
                )}
              </div>

              {rows.map((row) => {
                const people = parseNum(row.people) ?? 0;
                const hours = parseNum(row.hours) ?? 0;
                const job = jobByNo.get(row.itemNo);
                const cat = categoryById.get(row.categoryId);
                const incomplete =
                  !row.itemNo || !row.partId || !row.categoryId || people <= 0 || hours <= 0;
                return (
                  <div
                    key={row.key}
                    className={cn(
                      // Kart: dört sütun (kalem+sil · parça · tür+grup ·
                      // adam/saat/adam·saat). `lg` üstünde tek satırlık ızgara.
                      "grid grid-cols-4 gap-x-2 gap-y-2.5 border-b px-3 py-3 last:border-b-0 lg:items-center lg:gap-y-2 lg:py-1.5",
                      GRID_COLS,
                      incomplete && "bg-destructive/[0.04]"
                    )}
                  >
                    <div className="col-span-3 min-w-0 lg:col-span-1">
                      <FieldLabel>İş Kalemi</FieldLabel>
                      <Combobox
                        options={jobOptions}
                        value={row.itemNo || null}
                        onChange={(v) => {
                          setRow(row.key, { itemNo: v });
                          applyCodeHint(row.key, v, row.partId, row.partCode);
                        }}
                        placeholder="İş Kalemi"
                        searchPlaceholder="Kalem no, ürün veya müşteri…"
                        className="h-8 pointer-coarse:h-10"
                        contentClassName="min-w-[min(26rem,calc(100vw-1.5rem))]"
                        renderTrigger={(sel) =>
                          sel ? (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="font-mono text-xs font-medium text-primary">
                                {sel.label}
                              </span>
                              {job && !job.orphan && (
                                <CustomerTag
                                  name={job.customer}
                                  shortName={job.customerShort}
                                  hue={job.customerHue}
                                  className="shrink-0"
                                />
                              )}
                              <span className="truncate text-[11px] text-muted-foreground">
                                {job?.productName}
                              </span>
                            </span>
                          ) : (
                            "İş kalemi"
                          )
                        }
                      />
                    </div>

                    <div className="col-span-4 min-w-0 lg:col-span-1">
                      <FieldLabel>Parça</FieldLabel>
                      <Combobox
                        options={partOptions}
                        value={row.partId || null}
                        onChange={(v) => {
                          setRow(row.key, { partId: v });
                          applyCodeHint(row.key, row.itemNo, v, row.partCode);
                        }}
                        placeholder="Parça"
                        searchPlaceholder="Parça Ara…"
                        onCreate={(name) => addPart(name, row.key)}
                        createLabel="Yeni parça"
                        className="h-8 pointer-coarse:h-10"
                        renderTrigger={(sel) => sel?.label ?? "Parça"}
                      />
                    </div>

                    <div className="col-span-3 min-w-0 lg:col-span-1">
                      <FieldLabel>İmalat Türü</FieldLabel>
                      <Select
                        value={row.categoryId || undefined}
                        onValueChange={(v) => setRow(row.key, { categoryId: v })}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue placeholder="İmalat Türü" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="oc-tag-dot"
                                  style={tagStyle(c.colorHue)}
                                  aria-hidden
                                />
                                {c.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-1 min-w-0">
                      <FieldLabel>Grup</FieldLabel>
                      <Input
                        value={row.partCode}
                        onChange={(e) => setRow(row.key, { partCode: e.target.value })}
                                                title="Çizim grubu kodu — işe göre değişir, zorunlu değildir"
                        className="h-8 px-2 font-mono text-base pointer-coarse:h-10 pointer-fine:text-xs"
                      />
                    </div>

                    {/* Kişi sayacı: en sık yapılan düzeltme "bir kişi eksik/fazla"dır,
                        klavyeye dönmeden yapılabilmelidir. Dokunmatikte düğmeler
                        40px'e büyüdüğü için kutu da onlarla aynı boya çıkar. */}
                    <div className="col-span-2 min-w-0 lg:col-span-1">
                      <FieldLabel>Adam</FieldLabel>
                      <div className="flex items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="shrink-0 rounded-r-none"
                          onClick={() =>
                            setRow(row.key, { people: String(Math.max(1, Math.round(people) - 1)) })
                          }
                          aria-label="Kişi azalt"
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          value={row.people}
                          onChange={(e) => setRow(row.key, { people: e.target.value })}
                          inputMode="numeric"
                          className="h-8 min-w-0 flex-1 rounded-none border-x-0 px-1 text-center font-mono text-base tabular-nums pointer-coarse:h-10 pointer-fine:text-xs"
                          aria-label="Kişi sayısı"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="shrink-0 rounded-l-none"
                          onClick={() => setRow(row.key, { people: String(Math.round(people) + 1) })}
                          aria-label="Kişi artır"
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="col-span-1 min-w-0">
                      <FieldLabel>Saat</FieldLabel>
                      <Input
                        value={row.hours}
                        onChange={(e) => setRow(row.key, { hours: e.target.value })}
                        inputMode="decimal"
                        className="h-8 px-2 text-center font-mono text-base tabular-nums pointer-coarse:h-10 pointer-fine:text-xs"
                        aria-label="Saat"
                      />
                    </div>

                    <div className="col-span-1 min-w-0 text-right">
                      <FieldLabel>Adam·Saat</FieldLabel>
                      <span
                        className="block truncate font-mono text-sm font-medium tabular-nums"
                        title={cat ? `${cat.name}` : undefined}
                      >
                        {people > 0 && hours > 0 ? fmtManHours(people * hours) : "—"}
                      </span>
                    </div>

                    {/* Yıkıcı eylem: mobilde kartın sağ üst köşesine yerleşir
                        (`row-start-1`), komşu alanlarla karışmaz. */}
                    <div className="col-start-4 row-start-1 flex justify-end lg:col-start-auto lg:row-start-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRow(row.key)}
                        aria-label="Satırı sil"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t bg-muted/30 px-3 py-2">
            <Button variant="outline" size="sm" onClick={() => addRow()} className="gap-1.5">
              <Plus className="size-3.5" /> Satır ekle
            </Button>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {totals.invalid > 0 && (
                <span className="font-mono text-[11px] text-destructive">
                  {totals.invalid} satır eksik
                </span>
              )}
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                <span className="font-mono tabular-nums">{totals.people}</span> kişi
              </span>
              <span className="font-mono font-semibold tabular-nums">
                {fmtManHours(totals.manHours)} adam·saat
              </span>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Kişiler isimle değil SAYIYLA tutulur — atölye kaydı baştan beri böyle işliyor. Bir satır
        bir günün bir işe, bir parçaya ve bir imalat türüne ayrılan emeğidir; aynı parçaya iki
        farklı türde çalışıldıysa iki satır yazılır. Parça listesinde aradığınız yoksa arama
        kutusuna yazıp <span className="font-medium">&ldquo;Yeni parça&rdquo;</span> ile
        ekleyebilirsiniz.
      </p>
    </div>
  );
}
