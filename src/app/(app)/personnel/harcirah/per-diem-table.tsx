"use client";

// Harcirah tarifesi — dönemlere göre gruplanmış tablo.
//
// GRUP BİR DÖNEMDİR (`validFrom`) ve sıra ZAMAN SIRASIDIR: en yeni tarife
// üstte ve AÇIK gelir, eskiler kapalı durur. Günlük iş "bugün ne veriyoruz"
// sorusudur; geçmiş dönemler bir arşivdir ve arşiv her açılışta ekranı
// doldurmamalıdır.
//
// AVRO KARŞILIĞI TÜRETİLİR VE KAYNAĞI YAZILIR. Tek bir güne bakan spot kur
// yerine tarifenin YÜRÜRLÜKTE OLDUĞU AYLARIN ortalaması kullanılır — bir
// tarife bir güne değil bir döneme aittir. Aylık ortalamaların DÜZ ortalaması
// alınmaz: ayların yayın günü sayısı eşit değildir (tatiller, yarım kalan ay)
// ve gün sayısıyla ağırlıklandırmak, günlük gözlemlerin ortalamasıyla
// birebir aynı sayıyı verir.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { deletePerDiem, savePerDiem } from "../actions";
import type { FxMonthlyRow, PerDiemRow } from "../schema";
import { periodLabel } from "@/lib/personnel/payroll";
import { fmtNum, parseNum } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EditableCombobox } from "@/components/editable-combobox";
import { cn } from "@/lib/utils";

/** Sütun önceliği — beş sütun 375px'te tabloyu kabın iki katına çıkarıyor. */
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Bir gün öncesi — bir dönemin son günü, bir sonrakinin arifesidir. */
function gunOnce(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** `2026-01` → `2025-12`. Kur penceresinin son ayını kurar. */
function oncekiAy(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m <= 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

interface KurOzeti {
  /** 1 avro kaç TL — pencere içindeki bütün yayın günlerinin ortalaması. */
  eurTry: number;
  /** Ortalamaya giren yayın günü sayısı (beyan değil, sayım). */
  days: number;
  firstPeriod: string;
  lastPeriod: string;
}

/**
 * Bir ay penceresinin ağırlıklı kur ortalaması.
 *
 * Ağırlık `dayCount`tur: aylık ortalama zaten o ayın günlerinin ortalamasıdır,
 * gün sayısıyla çarpıp toplam güne bölmek pencerenin GÜNLÜK ortalamasını verir.
 * Kur yayımlanmamış ay pencereden sessizce düşer; hiç ay kalmazsa `null` döner
 * ve ekran sayı UYDURMAZ.
 */
function kurOzeti(fx: readonly FxMonthlyRow[], ilkAy: string, sonAy: string): KurOzeti | null {
  let agirlik = 0;
  let toplam = 0;
  let ilk = "";
  let son = "";
  for (const m of fx) {
    if (m.period < ilkAy || m.period > sonAy) continue;
    if (!(m.eurTry > 0) || m.dayCount <= 0) continue;
    toplam += m.eurTry * m.dayCount;
    agirlik += m.dayCount;
    if (!ilk || m.period < ilk) ilk = m.period;
    if (!son || m.period > son) son = m.period;
  }
  return agirlik > 0
    ? { eurTry: toplam / agirlik, days: agirlik, firstPeriod: ilk, lastPeriod: son }
    : null;
}

function kurCumlesi(kur: KurOzeti): string {
  const aralik =
    kur.firstPeriod === kur.lastPeriod
      ? periodLabel(kur.firstPeriod)
      : `${periodLabel(kur.firstPeriod)} – ${periodLabel(kur.lastPeriod)}`;
  return `Avro karşılığı ${aralik} ortalama kuruyla: 1 € = ${fmtNum(kur.eurTry, true)} ₺ (${kur.days} yayın günü)`;
}

type Durum = "gecmis" | "guncel" | "ileride";

interface Grup {
  validFrom: string;
  /** Kaynaktaki dönem etiketi ("2025/1.DÖNEM"); boşsa tarihten kurulur. */
  label: string;
  rows: PerDiemRow[];
  /** Yürürlüğün son günü; açık uçlu dönemde `null`. */
  until: string | null;
  durum: Durum;
  kur: KurOzeti | null;
}

export function PerDiemTable({
  rows,
  fx,
  bugun,
  canWrite,
}: {
  rows: PerDiemRow[];
  fx: FxMonthlyRow[];
  bugun: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** Açık dönemler; başlangıç değeri aşağıda GÜNCEL olandır. */
  const [acik, setAcik] = useState<Set<string> | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<PerDiemRow | null>(null);
  const [yeni, setYeni] = useState<{ validFrom: string; periodLabel: string; sort: number } | null>(
    null
  );

  const gruplar = useMemo<Grup[]>(() => {
    // `loadPerDiem` satırları valid_from DESC + sort ASC verir; grup içi sıra
    // buradan gelir, yeniden sıralanmaz.
    const harita = new Map<string, PerDiemRow[]>();
    for (const r of rows) {
      const liste = harita.get(r.validFrom) ?? [];
      liste.push(r);
      harita.set(r.validFrom, liste);
    }
    const tarihler = [...harita.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    // GÜNCEL: bugünü geçmemiş EN YENİ tarife. Yürürlüğe girmemiş bir tarife
    // (ilerideki zam) girilebilir ve o "güncel" değildir — ekran ikisini
    // ayırmazsa saha bugün olmayan bir ücreti bugünün ücreti sanır.
    const guncel = tarihler.find((t) => t <= bugun) ?? null;

    return tarihler.map((t, i) => {
      const sonraki = i > 0 ? tarihler[i - 1] : null;
      const grupRows = harita.get(t) ?? [];
      // Kur penceresi: tarifenin başladığı aydan, bir sonraki tarifenin
      // başladığı aydan ÖNCEKİ aya kadar. Tarifeler ayın 1'inde yürürlüğe
      // girer; ay ortasında başlayan bir tarife olsaydı bölünen ay YENİ
      // tarifeye bırakılır — yarım ayı iki tarifeye birden yazmaktansa.
      const sonAy = sonraki ? oncekiAy(sonraki.slice(0, 7)) : bugun.slice(0, 7);
      const ilkAy = t.slice(0, 7);
      return {
        validFrom: t,
        label: grupRows.find((r) => r.periodLabel)?.periodLabel || periodLabel(ilkAy),
        rows: grupRows,
        until: sonraki ? gunOnce(sonraki) : null,
        durum: t > bugun ? "ileride" : t === guncel ? "guncel" : "gecmis",
        kur: ilkAy <= sonAy ? kurOzeti(fx, ilkAy, sonAy) : null,
      };
    });
  }, [rows, fx, bugun]);

  // İlk oturuşta yalnız GÜNCEL dönem açıktır; kullanıcı bir grubu açtığında
  // seçim tümüyle onun eline geçer (`acik` artık null değildir).
  const acikKume = useMemo(() => {
    if (acik) return acik;
    const varsayilan = gruplar.find((g) => g.durum === "guncel") ?? gruplar[0];
    return new Set(varsayilan ? [varsayilan.validFrom] : []);
  }, [acik, gruplar]);

  function toggle(validFrom: string) {
    const next = new Set(acikKume);
    if (next.has(validFrom)) next.delete(validFrom);
    else next.add(validFrom);
    setAcik(next);
  }

  /** Öneri listeleri — kayıtta geçen gerçek değerler, uydurulmuş liste değil. */
  const roleOptions = useMemo(
    () => [...new Set(rows.map((r) => r.roleLabel.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "tr")
    ),
    [rows]
  );
  const periodOptions = useMemo(
    () => [...new Set(rows.map((r) => r.periodLabel.trim()).filter(Boolean))].sort((a, b) =>
      b.localeCompare(a, "tr")
    ),
    [rows]
  );

  function sil(row: PerDiemRow) {
    if (
      !window.confirm(
        `"${row.roleLabel}" satırı ${fmtDate(row.validFrom)} tarifesinden silinecek. Devam edilsin mi?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deletePerDiem(row.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tarife satırı silindi.");
      router.refresh();
    });
  }

  /** Yeni satırın sırası: grubun son sırasının 10 fazlası (kaynaktaki adım). */
  function sonrakiSira(validFrom: string): number {
    const grup = gruplar.find((g) => g.validFrom === validFrom);
    return (grup?.rows.reduce((m, r) => Math.max(m, r.sort), 0) ?? 0) + 10;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="min-w-0">
          <span className="oc-kicker text-muted-foreground">Yurtiçi Harcirah Tarifesi</span>
          <p className="mt-1 text-[11px] text-foreground/70">
            Ücret değişince eski dönem silinmez, yeni bir dönem açılır — geçmiş
            bir şantiyeye bakıldığında o günkü tarife görünür.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setYeni({
              // Yeni dönem BUGÜNÜN AYININ 1'inde başlar: tarife ay ortasında
              // değişmiyor ve bu bir yer tutucu değil, düzeltilebilir gerçek
              // bir değerdir.
              validFrom: `${bugun.slice(0, 7)}-01`,
              periodLabel: bugun.slice(0, 4),
              sort: 10,
            })
          }
          disabled={!canWrite}
          title={canWrite ? undefined : "Tarife girmek için yetkiniz yok"}
        >
          <Plus className="size-3.5" /> Yeni Dönem
        </Button>
      </div>

      {gruplar.map((g) => {
        const open = acikKume.has(g.validFrom);
        return (
          <div key={g.validFrom} className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/40 px-3 py-2">
              <button
                type="button"
                onClick={() => toggle(g.validFrom)}
                aria-expanded={open}
                className="oc-tap flex min-w-0 items-center gap-2 text-left transition-colors hover:text-primary"
              >
                {open ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="oc-kicker truncate">{g.label}</span>
              </button>

              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {fmtDate(g.validFrom)} → {g.until ? fmtDate(g.until) : "sürüyor"}
              </span>

              {g.durum === "guncel" && <Badge>Güncel</Badge>}
              {g.durum === "ileride" && (
                <Badge variant="outline" title="Yürürlük tarihi henüz gelmedi">
                  Yürürlüğe Girecek
                </Badge>
              )}

              <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {g.rows.length} sınıf
              </span>

              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs"
                onClick={() =>
                  setYeni({
                    validFrom: g.validFrom,
                    periodLabel: g.rows.find((r) => r.periodLabel)?.periodLabel ?? "",
                    sort: sonrakiSira(g.validFrom),
                  })
                }
                disabled={!canWrite}
                title={canWrite ? undefined : "Tarife girmek için yetkiniz yok"}
              >
                <Plus className="size-3.5" /> Sınıf
              </Button>

              {/* Kurun kaynağı BAŞLIĞIN İÇİNDE söylenir: çevrilmiş bir sayının
                  hangi kurla üretildiği görünmüyorsa o sayı bir iddiadır. */}
              <p className="basis-full text-[11px] text-muted-foreground">
                {g.kur
                  ? kurCumlesi(g.kur)
                  : "Bu dönem için kayıtlı günlük kur yok — avro karşılığı üretilmedi."}
              </p>
            </div>

            {open && (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Personel Sınıfı</TableHead>
                    <TableHead className="w-[8rem] text-right md:w-[10rem]">Günlük (₺)</TableHead>
                    <TableHead className={cn("w-[10rem] text-right", AT_MD)}>
                      Avro Karşılığı
                    </TableHead>
                    <TableHead className={AT_LG}>Not</TableHead>
                    <TableHead className="w-[5.5rem] text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.rows.map((r) => {
                    const avro = g.kur ? r.dailyTry / g.kur.eurTry : null;
                    return (
                      <TableRow key={r.id} className="hover:bg-transparent">
                        <TableCell className="font-medium whitespace-normal">
                          {r.roleLabel}
                          {/* Gizlenen sütunların mobil karşılığı — ikinci bir
                              kart markup'ı yazılmaz. */}
                          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground md:hidden">
                            {avro === null ? "avro karşılığı yok" : `${fmtNum(avro, true)} €`}
                            {r.note ? ` · ${r.note}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right align-top font-mono text-sm tabular-nums md:align-middle">
                          {fmtNum(r.dailyTry, true)} <span className="text-muted-foreground">₺</span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm tabular-nums text-muted-foreground",
                            AT_MD
                          )}
                        >
                          {avro === null ? "—" : `${fmtNum(avro, true)} €`}
                        </TableCell>
                        <TableCell className={cn("whitespace-normal text-muted-foreground", AT_LG)}>
                          {r.note || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => setDuzenlenen(r)}
                              disabled={!canWrite || pending}
                              title="Düzenle"
                            >
                              <Pencil className="size-3.5" />
                              <span className="sr-only">Düzenle</span>
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => sil(r)}
                              disabled={!canWrite || pending}
                              title="Sil"
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Sil</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        );
      })}

      {(duzenlenen || yeni) && (
        <PerDiemDialog
          row={duzenlenen}
          preset={yeni}
          roleOptions={roleOptions}
          periodOptions={periodOptions}
          open
          onOpenChange={(o) => {
            if (o) return;
            setDuzenlenen(null);
            setYeni(null);
          }}
        />
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————— pencere

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Sayısal alanlar METİN tutulur: her tuşta sayıya çevrilseydi virgül kaybolurdu. */
function numText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function PerDiemDialog({
  row,
  preset,
  roleOptions,
  periodOptions,
  open,
  onOpenChange,
}: {
  row: PerDiemRow | null;
  preset: { validFrom: string; periodLabel: string; sort: number } | null;
  roleOptions: string[];
  periodOptions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Alanlar yalnız başlangıç değerinden dolar; senkronize eden efekt YOKTUR —
  // pencere satır seçilince monte edilir, kapanınca sökülür.
  const [validFrom, setValidFrom] = useState(row?.validFrom ?? preset?.validFrom ?? "");
  const [label, setLabel] = useState(row?.periodLabel ?? preset?.periodLabel ?? "");
  const [roleLabel, setRoleLabel] = useState(row?.roleLabel ?? "");
  const [dailyTry, setDailyTry] = useState(numText(row?.dailyTry));
  const [sort, setSort] = useState(numText(row?.sort ?? preset?.sort ?? 0));
  const [note, setNote] = useState(row?.note ?? "");

  function kaydet() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
      toast.error("Geçerlilik tarihi gerekli — tarife bu tarihten itibaren yürürlüğe girer.");
      return;
    }
    if (roleLabel.trim().length < 2) {
      toast.error("Personel sınıfı gerekli.");
      return;
    }
    const gunluk = parseNum(dailyTry);
    // BOŞ ALAN SIFIR DEĞİLDİR: sıfır "bedava" der ve girilmiş bir ücret gibi
    // kaydedilirdi. Cevabın olmadığı yerde kayıt yapılmaz.
    if (gunluk === null) {
      toast.error("Günlük ücret girilmeden tarife kaydedilemez.");
      return;
    }
    startTransition(async () => {
      const res = await savePerDiem({
        id: row?.id,
        validFrom,
        periodLabel: label.trim(),
        roleLabel: roleLabel.trim(),
        dailyTry: gunluk,
        sort: Math.round(parseNum(sort) ?? 0),
        note: note.trim(),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(row ? "Tarife satırı güncellendi." : "Tarife satırı eklendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(48rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>{row ? "Tarife Satırını Düzenle" : "Harcirah Tarifesi"}</DialogTitle>
          <DialogDescription>
            Bir satır bir personel sınıfının günlük ücretidir. Ücret değiştiğinde
            bu satır düzeltilmez; yeni bir geçerlilik tarihiyle yeni bir dönem
            açılır ve eski dönem olduğu gibi kalır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Geçerlilik Başlangıcı" hint="Tarife bu tarihten itibaren geçerlidir">
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </Field>
            <Field label="Dönem Etiketi" hint="Ekranda görünen ad — ör. 2026/1.DÖNEM">
              <EditableCombobox
                options={periodOptions}
                value={label}
                onChange={setLabel}
                aria-label="Dönem etiketi"
                emptyText="Öneri yok — yazdığınız etiket kullanılır"
              />
            </Field>
          </div>

          <Field label="Personel Sınıfı" hint="Ör. Şantiye Formeni · Usta, Kaynakçı · Diğer Tüm Personeller">
            <EditableCombobox
              options={roleOptions}
              value={roleLabel}
              onChange={setRoleLabel}
              aria-label="Personel sınıfı"
              emptyText="Öneri yok — yazdığınız sınıf kullanılır"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Günlük Ücret (₺)">
              {/* YER TUTUCU YOK: grileşmiş bir örnek sayı girilmiş bir değer
                  sanılıyor ve boş alan sessizce kaydediliyordu. */}
              <Input
                inputMode="decimal"
                value={dailyTry}
                onChange={(e) => setDailyTry(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Sıra" hint="Dönem içindeki satır sırası; küçük olan üstte durur">
              <Input
                inputMode="numeric"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
          </div>

          <Field label="Not">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
