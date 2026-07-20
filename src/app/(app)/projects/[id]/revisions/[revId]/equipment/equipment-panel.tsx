"use client";

// Ekipman listesi paneli (client) — sekmeli tablo görünümü + ek satır editörü +
// Excel/PDF indirme. Otomatik satırlar salt-okunur; "Ek Ekipman / Özellikler"
// bölümündeki satırlar düzenlenebilir/silinebilir ve kaydedilir.

import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, FileDown, FileSpreadsheet, Plus, Save, Trash2 } from "lucide-react";
import type { EqGroup, EquipmentExtraRow, SummarySection } from "@/lib/excel/equipment";
import { dsKey } from "@/lib/excel/equipment";
import { saveEquipmentExtras } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

type Scope = "customer" | "full";

const EMPTY: EquipmentExtraRow = {
  group: "Ek Ekipman", component: "", brand: "", model: "", spec: "", qty: "",
};

export function EquipmentPanel({
  projectId, revisionId, autoGroups, summary, initialExtras, datasheetUrls, locked,
}: {
  projectId: string;
  revisionId: string;
  autoGroups: EqGroup[];
  summary: SummarySection[];
  initialExtras: EquipmentExtraRow[];
  datasheetUrls: Record<string, string>;
  locked: boolean;
}) {
  const [extras, setExtras] = useState<EquipmentExtraRow[]>(initialExtras);
  const [scope, setScope] = useState<Scope>("customer");
  const [pending, startTransition] = useTransition();

  const dlBase = `/projects/${projectId}/revisions/${revisionId}/equipment/download`;
  const dl = (format: "xlsx" | "pdf") => `${dlBase}?format=${format}&scope=${scope}`;

  function setRow(i: number, patch: Partial<EquipmentExtraRow>) {
    setExtras((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setExtras((rows) => [...rows, { ...EMPTY }]);
  }
  function removeRow(i: number) {
    setExtras((rows) => rows.filter((_, idx) => idx !== i));
  }
  function save() {
    startTransition(async () => {
      const result = await saveEquipmentExtras(projectId, revisionId, extras);
      if (result?.error) toast.error(result.error);
      else toast.success("Ek satırlar kaydedildi");
    });
  }

  function ModelCell({ row }: { row: EqGroup["rows"][number] }) {
    const url = row.kind ? datasheetUrls[dsKey(row.kind, row.brand, row.model)] : undefined;
    if (url && row.model && row.model !== "-") {
      return (
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {row.model}
          <ExternalLink className="size-3" />
        </a>
      );
    }
    return <span>{row.model}</span>;
  }

  return (
    <div className="grid gap-4">
      {/* İndirme çubuğu */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <div className="text-sm font-medium">İndir:</div>
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => setScope("customer")}
            className={`px-3 py-1.5 text-xs ${scope === "customer" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Müşteri (yalnız liste)
          </button>
          <button
            type="button"
            onClick={() => setScope("full")}
            className={`px-3 py-1.5 text-xs ${scope === "full" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            + Teknik Özet
          </button>
        </div>
        <a href={dl("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted">
          <FileSpreadsheet className="size-3.5 text-emerald-600" />
          Excel indir
        </a>
        <a href={dl("pdf")} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted">
          <FileDown className="size-3.5 text-red-600" />
          PDF indir
        </a>
        <span className="ml-auto text-xs text-muted-foreground">
          {autoGroups.reduce((n, g) => n + g.rows.length, 0)} otomatik · {extras.length} ek satır
        </span>
      </div>

      <Tabs defaultValue="equipment">
        <TabsList>
          <TabsTrigger value="equipment">Ekipman Listesi</TabsTrigger>
          <TabsTrigger value="summary">Teknik Ressam Özeti</TabsTrigger>
        </TabsList>

        {/* ---- Ekipman Listesi ---- */}
        <TabsContent value="equipment" className="mt-3">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[20%]">Ekipman</TableHead>
                  <TableHead className="w-[13%]">Marka</TableHead>
                  <TableHead className="w-[16%]">Model</TableHead>
                  <TableHead>Özellikler</TableHead>
                  <TableHead className="w-[7%] text-center">Adet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoGroups.map((g) => (
                  <Fragment key={`g-${g.name}`}>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableCell colSpan={5} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                        {g.name}
                      </TableCell>
                    </TableRow>
                    {g.rows.map((r, i) => (
                      <TableRow key={`${g.name}-${i}`}>
                        <TableCell className="font-medium">{r.component}</TableCell>
                        <TableCell>{r.brand}</TableCell>
                        <TableCell><ModelCell row={r} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.spec}</TableCell>
                        <TableCell className="text-center tabular-nums">{String(r.qty)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Ek satır editörü */}
          <div className="mt-5 rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                Ek Ekipman / Özellikler
                {locked && (
                  <Badge variant="outline" className="text-[10px]">revizyon yayınlandı — ek satırlar serbest</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={addRow}>
                  <Plus className="size-3.5" /> Satır ekle
                </Button>
                <Button type="button" size="sm" onClick={save} disabled={pending}>
                  <Save className="size-3.5" /> {pending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            </div>
            {extras.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Ek satır yok. Müşteriye özel ekipman veya özellik eklemek için &quot;Satır ekle&quot;.
              </p>
            ) : (
              <div className="grid gap-2 p-3">
                <div className="grid grid-cols-[1fr_1fr_1fr_1.6fr_0.5fr_auto] gap-2 px-1 text-[11px] font-medium text-muted-foreground">
                  <span>Grup</span><span>Ekipman</span><span>Marka</span><span>Model / Özellik</span><span>Adet</span><span />
                </div>
                {extras.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1.6fr_0.5fr_auto] items-center gap-2">
                    <Input className="h-8" placeholder="Ek Ekipman" value={r.group} onChange={(e) => setRow(i, { group: e.target.value })} />
                    <Input className="h-8" placeholder="Ekipman" value={r.component} onChange={(e) => setRow(i, { component: e.target.value })} />
                    <Input className="h-8" placeholder="Marka" value={r.brand} onChange={(e) => setRow(i, { brand: e.target.value })} />
                    <Input className="h-8" placeholder="Model / özellik" value={r.spec || r.model} onChange={(e) => setRow(i, { spec: e.target.value })} />
                    <Input className="h-8" placeholder="1" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => removeRow(i)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---- Teknik Ressam Özeti ---- */}
        <TabsContent value="summary" className="mt-3">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Ölçü / Özellik</TableHead>
                  <TableHead className="w-[20%] text-right">Değer</TableHead>
                  <TableHead className="w-[14%] text-center">Birim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((sec) => (
                  <Fragment key={`s-${sec.name}`}>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableCell colSpan={3} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                        {sec.name}
                      </TableCell>
                    </TableRow>
                    {sec.rows.map((r, i) => (
                      <TableRow key={`${sec.name}-${i}`}>
                        <TableCell>{r.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{String(r.value)}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{r.unit ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Teknik ressam özeti dahili bir çıktıdır; müşteri dosyasına dahil edilmez.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
