"use client";

// Satış listesi: süzgeçler + sıralanabilir tablo + müşteri kırılımı.
//
// Süzme ve toplama SUNUCUDA DEĞİL burada yapılır (iş emri listesiyle aynı
// gerekçe): satır sayısı yüzlerle ölçülür, tamamı tek istekte gelir ve
// süzgeç değiştikçe sayfa yeniden yüklenmez.
//
// TEK ORTAK BÜYÜKLÜK AVRODUR. Tablo satırı kendi para biriminde okunur ama
// toplamlar yalnız avro karşılığından çıkar; kuru girilmemiş satır toplama
// GİRMEZ ve bu durum sessiz kalmasın diye ayrıca sayılır.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, ChevronsUpDown, Coins, Package, Scale, X,
} from "lucide-react";
import { SaleDialog } from "./sale-dialog";
import { saleYear, type SaleRow } from "./schema";
import {
  CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, fmtCompactEur, fmtNum,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CustomerTag, ScopeTag } from "@/components/tags";
import { customerTag, scopeLabel } from "@/lib/tags";
import { cn } from "@/lib/utils";

const ALL = "__all__";
/** Fiyat durumu süzgeci — "hangi kalemin fiyatı girilmedi" en sık sorulan soru. */
const PRICED = "__priced__";
const UNPRICED = "__unpriced__";

/**
 * SÜTUN ÖNCELİKLENDİRME. Dokuz sütunun sabit genişlikleri 70,5rem eder; esnek
 * "Ürün" ile birlikte tablo 375px'lik ekranda kabın 3,9 KATINA çıkıyor ve para
 * sütunları en sağda kaldığı için telefonda hiç görünmüyordu. Telefonda yalnız
 * Kalem No · Ürün · Tutar kalır; düşen bilgilerin kritik olanı ürün hücresinin
 * ikinci satırına iner (kart markup'ı çoğaltılmaz).
 */
const AT_SM = "hidden sm:table-cell";
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

/**
 * ÜRÜN ADI KIRPILIR — sütun genişliği ürün adına göre BÜYÜYEMEZ.
 *
 * Kullanıcı bildirimi (12.08.2026): *"bazı işlerin ismi çok uzun olduğu için
 * sayfa yatayda sığmamış."* Sebep tek bir sınıftı: ürün hücresi `md` üstünde
 * `whitespace-nowrap` taşıyordu ve genişlik sınırı YOKTU. Tablo düzeni
 * `auto`dur, yani bir hücrenin en dar hâli metninin tamamı kadardır —
 * "CÜRUF POTA TUMBA TESİSİ 100/50 TON KÖPRÜLÜ VİNÇ" gibi bir ad tek başına
 * sütunu 30rem'e çıkarıyor ve tabloyu ekranın dışına itiyordu.
 *
 * ÇÖZÜM KAPSAYICIDA DEĞİL HÜCREDE: `max-width` taşıyan bir blok, hücrenin
 * "doğal" genişliğini de o değere kelepçeler. Kırpma `md`den başlar; telefonda
 * ad SARAR, çünkü orada kırpılan metni okutacak bir fare yoktur ve satırın
 * ikinci bilgi şeridi zaten oradadır.
 *
 * Sınır ekranla birlikte açılır: dar masaüstünde 16rem, geniş ekranda 34rem.
 * Tek bir sabit değer ya geniş ekranda yeri boşa harcar ya dar ekranda hâlâ
 * taşırdı. Tam ad `title` ile durur (kullanıcının istediği davranış).
 */
const URUN_GENISLIK =
  "md:max-w-[16rem] md:truncate lg:max-w-[20rem] xl:max-w-[26rem] 2xl:max-w-[34rem]";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

type SortKey =
  | "itemNo" | "productName" | "customer" | "scope"
  | "dueDate" | "shipmentDate" | "totalPrice" | "eurAmount" | "totalWeightKg";

const SORT_VALUE: Record<SortKey, (r: SaleRow) => string | number> = {
  itemNo: (r) => r.itemNo,
  productName: (r) => r.productName,
  // Sıralama GÖRÜNEN ada göredir (bkz. jobs-table'daki aynı gerekçe).
  customer: (r) => customerTag({ name: r.customer, shortName: r.customerShort }).short,
  scope: (r) => r.sale.scope,
  dueDate: (r) => r.sale.due_date ?? "",
  shipmentDate: (r) => r.sale.shipment_date ?? "",
  totalPrice: (r) => r.totalPrice ?? -1,
  eurAmount: (r) => r.eurAmount ?? -1,
  totalWeightKg: (r) => r.totalWeightKg ?? -1,
};

/**
 * Özet kartı.
 *
 * `tone="warn"` VARYANTI KALKTI: tek kullanıcısı "Kuru Eksik" kartıydı ve o
 * kart, olmaması gereken bir durumun sayacıydı (kullanıcı kararı, 11.08.2026).
 * Kur artık kayıt anında zorunludur (`sale-dialog.tsx`), yani sayılacak bir
 * eksik kalmıyor.
 */
function StatCard({
  label, value, hint, icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <div className="oc-kicker text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {hint && <div className="mt-0.5 truncate text-[11px] text-foreground/70">{hint}</div>}
      </div>
    </div>
  );
}

function SortHead({
  label, sortKey, active, dir, onSort, className, align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          // Düğme başlık hücresinin TAMAMINI kaplar (eskiden ~21px'ti):
          // sıralama, dar ekranda tabloyu kullanılabilir kılan tek araçtır.
          "-mx-2 -my-2 flex h-10 w-full items-center gap-1 rounded px-2 py-2 hover:text-foreground",
          align === "right" && "justify-end",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className={cn("size-3 shrink-0", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

export function SalesTable({ rows }: { rows: SaleRow[] }) {
  const [year, setYear] = useState(ALL);
  const [customer, setCustomer] = useState(ALL);
  const [scope, setScope] = useState(ALL);
  const [currency, setCurrency] = useState(ALL);
  const [priceState, setPriceState] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "itemNo",
    dir: "desc",
  });
  const [editing, setEditing] = useState<SaleRow | null>(null);

  const years = useMemo(() => {
    const set = new Set(rows.map(saleYear).filter(Boolean));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  // Süzgeç DEĞERİ tam unvan, ETİKETİ kısaltmadır (İşler listesiyle aynı düzen).
  const customers = useMemo(() => {
    const byName = new Map<string, SaleRow>();
    for (const r of rows) {
      const name = r.customer.trim();
      if (name && !byName.has(name)) byName.set(name, r);
    }
    return [...byName.entries()]
      .map(([name, r]) => ({ name, short: r.customerShort, hue: r.customerHue }))
      .sort((a, b) =>
        customerTag({ name: a.name, shortName: a.short }).short.localeCompare(
          customerTag({ name: b.name, shortName: b.short }).short,
          "tr"
        )
      );
  }, [rows]);

  /** Kapsam süzgeci — veride geçen kapsamlar (etiket kırpılmış, değer tam metin). */
  const scopes = useMemo(() => {
    const set = new Set(rows.map((r) => r.sale.scope.trim()).filter(Boolean));
    return [...set].sort((a, b) => scopeLabel(a).localeCompare(scopeLabel(b), "tr"));
  }, [rows]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : {
            key,
            dir:
              key === "productName" || key === "customer" || key === "scope" ? "asc" : "desc",
          }
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const out = rows.filter((r) => {
      if (year !== ALL && saleYear(r) !== year) return false;
      if (customer !== ALL && r.customer.trim() !== customer) return false;
      if (scope !== ALL && r.sale.scope.trim() !== scope) return false;
      if (currency !== ALL && r.sale.currency !== currency) return false;
      if (priceState === PRICED && r.sale.unit_price === null) return false;
      if (priceState === UNPRICED && r.sale.unit_price !== null) return false;
      if (q && ![r.itemNo, r.productName, r.customer, r.customerShort ?? "", r.sale.scope]
        .join(" ").toLocaleLowerCase("tr").includes(q)) return false;
      return true;
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return out.sort((a, b) => {
      const va = SORT_VALUE[sort.key](a);
      const vb = SORT_VALUE[sort.key](b);
      const c =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "tr", { numeric: true });
      return sign * c;
    });
  }, [rows, year, customer, scope, currency, priceState, query, sort]);

  // Özetler süzgeçten GEÇEN satırlardan çıkar: "2025 · ASTOR" seçildiğinde
  // kartlar o kesitin cirosunu gösterir.
  const summary = useMemo(() => {
    let eur = 0;
    let weight = 0;
    let priced = 0;
    const byCustomer = new Map<
      string,
      { eur: number; count: number; short: string | null; hue: number | null }
    >();
    for (const r of filtered) {
      if (r.sale.unit_price !== null) priced += 1;
      weight += r.totalWeightKg ?? 0;
      if (r.eurAmount !== null) {
        eur += r.eurAmount;
        const key = r.customer.trim() || "—";
        const cur = byCustomer.get(key) ?? {
          eur: 0, count: 0, short: r.customerShort ?? null, hue: r.customerHue ?? null,
        };
        byCustomer.set(key, { ...cur, eur: cur.eur + r.eurAmount, count: cur.count + 1 });
      }
    }
    return {
      eur,
      weight,
      priced,
      byCustomer: [...byCustomer.entries()].sort((a, b) => b[1].eur - a[1].eur),
    };
  }, [filtered]);

  const activeFilters =
    (year !== ALL ? 1 : 0) + (customer !== ALL ? 1 : 0) + (scope !== ALL ? 1 : 0) +
    (currency !== ALL ? 1 : 0) + (priceState !== ALL ? 1 : 0) + (query.trim() ? 1 : 0);

  function clearFilters() {
    setYear(ALL);
    setCustomer(ALL);
    setScope(ALL);
    setCurrency(ALL);
    setPriceState(ALL);
    setQuery("");
  }

  return (
    <div className="grid gap-4">
      {/* ÜÇ KART, dört değil: "Kuru Eksik" kaldırıldı (madde 22). Dördüncü bir
          kutuyu doldurmak için ölçü uydurulmadı — sayılacak yeni bir şey yok. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Ciro (Avro)"
          value={fmtCompactEur(summary.eur)}
          hint={`${summary.byCustomer.length} Müşteri`}
          icon={Coins}
        />
        <StatCard
          label="Fiyatlanan Kalem"
          value={`${summary.priced} / ${filtered.length}`}
          hint={
            filtered.length - summary.priced > 0
              ? `${filtered.length - summary.priced} Kalemin Fiyatı Girilmedi`
              : "Tamamı Fiyatlandı"
          }
          icon={Package}
        />
        <StatCard
          label="Toplam Ağırlık"
          value={`${fmtNum(Math.round(summary.weight))} kg`}
          hint="Süzgeçten Geçen Kalemler"
          icon={Scale}
        />
      </div>

      {/* Süzgeçler — beş sabit genişlikli tetikleyici 820px istiyordu; telefonda
          ikişerli ızgara, `sm` üstünde eski sarmalı şerit. */}
      <div className="grid grid-cols-2 items-center gap-2 rounded-lg border bg-card px-3 py-2 sm:flex sm:flex-wrap">
        <span className="oc-kicker col-span-2 text-muted-foreground sm:mr-1">Filtre</span>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger size="sm" className="w-full sm:w-[120px]">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Yıllar</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger size="sm" className="w-full sm:w-[190px]">
            <SelectValue placeholder="Müşteri" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Müşteriler</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                <CustomerTag name={c.name} shortName={c.short} hue={c.hue} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger size="sm" className="w-full sm:w-[200px]">
            <SelectValue placeholder="Kapsam" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Kapsamlar</SelectItem>
            {scopes.map((sc) => (
              <SelectItem key={sc} value={sc}>
                <ScopeTag scope={sc} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger size="sm" className="w-full sm:w-[150px]">
            <SelectValue placeholder="Para Birimi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tüm Para Birimleri</SelectItem>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priceState} onValueChange={setPriceState}>
          <SelectTrigger size="sm" className="w-full sm:w-[160px]">
            <SelectValue placeholder="Fiyat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Fiyat Farketmez</SelectItem>
            <SelectItem value={PRICED}>Fiyatı Girilmiş</SelectItem>
            <SelectItem value={UNPRICED}>Fiyatı Girilmemiş</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kalem No, Ürün, Müşteri veya Kapsam Ara…"
          className="col-span-2 h-8 w-full flex-1 pointer-coarse:h-10 sm:col-span-1 sm:w-auto sm:min-w-[200px]"
        />

        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:contents">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {filtered.length} / {rows.length}
          </span>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
              <X className="size-3.5" /> Temizle
            </Button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground md:hidden">
        → Ayrıntı için satıra dokunun; tabloyu yana da kaydırabilirsiniz.
      </p>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <SortHead label="Kalem No" sortKey="itemNo" className="w-[6rem] md:w-[7rem]"
                active={sort.key === "itemNo"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Ürün" sortKey="productName"
                active={sort.key === "productName"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Müşteri" sortKey="customer" className={cn("w-[10rem]", AT_MD)}
                active={sort.key === "customer"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Kapsam" sortKey="scope" className={cn("w-[15rem]", AT_LG)}
                active={sort.key === "scope"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Termin" sortKey="dueDate" className={cn("w-[6.5rem]", AT_MD)}
                active={sort.key === "dueDate"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Sevk" sortKey="shipmentDate" className={cn("w-[6.5rem]", AT_LG)}
                active={sort.key === "shipmentDate"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Ağırlık" sortKey="totalWeightKg" className={cn("w-[7rem]", AT_LG)} align="right"
                active={sort.key === "totalWeightKg"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Tutar" sortKey="totalPrice" className="w-[7.5rem] md:w-[9rem]" align="right"
                active={sort.key === "totalPrice"} dir={sort.dir} onSort={toggleSort} />
              <SortHead label="Avro Karşılığı" sortKey="eurAmount" className={cn("w-[9.5rem]", AT_SM)} align="right"
                active={sort.key === "eurAmount"} dir={sort.dir} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Süzgeçlere uyan kalem yok — bir filtreyi temizleyip tekrar deneyin.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.itemId}
                  className="cursor-pointer"
                  onClick={() => setEditing(r)}
                >
                  <TableCell className="align-top font-mono text-sm font-medium text-primary md:align-middle">
                    {r.itemNo || "—"}
                  </TableCell>
                  <TableCell className="font-medium whitespace-normal md:whitespace-nowrap">
                    <span className={cn("block", URUN_GENISLIK)} title={r.productName}>
                      {r.productName}
                    </span>
                    {/* Telefonda düşen sütunların kritik olanları burada durur. */}
                    <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground md:hidden">
                      {[
                        customerTag({ name: r.customer, shortName: r.customerShort }).short,
                        r.sale.scope.trim() ? scopeLabel(r.sale.scope) : "",
                        r.sale.due_date ? `termin ${fmtDate(r.sale.due_date)}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {r.eurAmount !== null && (
                        <span className="sm:hidden">
                          {" · "}
                          <span className="font-mono tabular-nums">{fmtNum(r.eurAmount)} €</span>
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className={AT_MD}>
                    <CustomerTag
                      name={r.customer}
                      shortName={r.customerShort}
                      hue={r.customerHue}
                    />
                  </TableCell>
                  <TableCell className={AT_LG}>
                    {/* Kapsam da başlıktaki 15rem'e kelepçelenir: `scopeLabel`
                        metni 46 karakterde kesiyor ama 46 karakter de ~18rem
                        eder ve sütun sessizce başlığından geniş çıkardı.
                        Kırpmayı etiketin İÇİNDEKİ span yapar (bkz. tags.tsx),
                        tam metin `title` ile durur. */}
                    <ScopeTag scope={r.sale.scope} className="max-w-[15rem]" />
                  </TableCell>
                  <TableCell
                    className={cn("font-mono text-sm tabular-nums text-muted-foreground", AT_MD)}
                  >
                    {fmtDate(r.sale.due_date)}
                  </TableCell>
                  <TableCell
                    className={cn("font-mono text-sm tabular-nums text-muted-foreground", AT_LG)}
                  >
                    {fmtDate(r.sale.shipment_date)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-sm tabular-nums text-muted-foreground",
                      AT_LG
                    )}
                  >
                    {r.totalWeightKg ? fmtNum(r.totalWeightKg) : "—"}
                  </TableCell>
                  <TableCell className="text-right align-top font-mono text-sm tabular-nums md:align-middle">
                    {r.sale.unit_price === null ? (
                      <span className="text-muted-foreground/60">Fiyat Yok</span>
                    ) : (
                      <>
                        {fmtNum(r.totalPrice)}{" "}
                        <span className="text-muted-foreground">
                          {CURRENCY_SYMBOLS[r.sale.currency]}
                        </span>
                      </>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn("text-right font-mono text-sm font-medium tabular-nums", AT_SM)}
                  >
                    {r.eurAmount === null ? (
                      r.sale.unit_price === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <span className="text-destructive">Kur Yok</span>
                      )
                    ) : (
                      `${fmtNum(r.eurAmount)} €`
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Müşteri kırılımı — Excel'deki "Satış Toplamları" sayfasının karşılığı */}
      {summary.byCustomer.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
            <span className="oc-kicker text-muted-foreground">Müşteri Bazında Ciro</span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {fmtNum(summary.eur)} €
            </span>
          </div>
          <Table>
            <TableHeader>
              {/* Beş sütun telefonda 400px'i geçiyordu; sıra no, kalem sayısı ve
                  pay çubuğu ikincil bilgidir. */}
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn("w-10 text-right", AT_SM)}>#</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead className={cn("w-[6rem] text-right", AT_SM)}>Kalem</TableHead>
                <TableHead className="w-[10rem] text-right">Ciro (Avro)</TableHead>
                <TableHead className={cn("w-[24%]", AT_MD)}>Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byCustomer.map(([name, v], i) => {
                const share = summary.eur > 0 ? v.eur / summary.eur : 0;
                return (
                  <TableRow key={name} className="hover:bg-transparent">
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs tabular-nums text-muted-foreground",
                        AT_SM
                      )}
                    >
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <CustomerTag name={name} shortName={v.short} hue={v.hue} />
                      <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-muted-foreground sm:hidden">
                        {v.count} kalem · %{fmtNum(share * 100)}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-sm tabular-nums text-muted-foreground",
                        AT_SM
                      )}
                    >
                      {v.count}
                    </TableCell>
                    <TableCell className="text-right align-top font-mono text-sm tabular-nums sm:align-middle">
                      {fmtNum(v.eur)} €
                    </TableCell>
                    <TableCell className={AT_MD}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(share * 100, 0.5)}%` }}
                          />
                        </div>
                        <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                          %{fmtNum(share * 100)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Satırlar iş emirlerinden gelir; yeni bir iş açtığınızda kalemleri burada
        kendiliğinden listelenir. Bir satıra tıklayarak fiyat bilgisini
        girebilirsiniz. İş emrini düzenlemek için{" "}
        <Link href="/jobs" className="underline underline-offset-2">İşler</Link> bölümüne gidin.
      </p>

      {editing && (
        <SaleDialog
          row={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}
