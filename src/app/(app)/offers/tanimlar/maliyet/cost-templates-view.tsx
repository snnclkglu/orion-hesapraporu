"use client";

// VİNÇ TİPİ → MALİYET BÖLÜMLERİ VE KALEMLERİ.
// Şablon yeni maliyet kaleminin iskeletidir; "Tekliften Tazele" eksik
// satırları ekler ama hiçbir kayıtlı satırı silmez. Kod defterindeki kalemler
// açılıp kapatılır, tipe özel kalemlerse ad + birimle burada oluşturulur.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  resetOfferCostTemplate,
  saveOfferCostTemplate,
  setOfferCostTemplateActive,
  type CostTemplateResult,
} from "./actions";
import { trKatla } from "@/lib/drawings/tr-text";
import { adBuyuk, baslikDuzeni } from "@/lib/tr-text";
import {
  COST_GROUP_DEFS,
  COST_UNITS,
  GENERAL_GROUP_KEY,
  defaultCostSkeleton,
} from "@/lib/offers/cost/registry";
import type { CostTemplateLine, CostTemplateSkeleton } from "@/lib/offers/cost/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CostTemplateRow {
  id: string;
  crane_type: string;
  skeleton: CostTemplateSkeleton | null;
  sort: number;
  active: boolean;
}

export interface CostCatalogLine {
  label: string;
  unit: string;
}

/** PROJE GENELİ vinç tipine değil bütün maliyet belgesine aittir. */
const SECILEBILIR = COST_GROUP_DEFS.filter((g) => g.key !== GENERAL_GROUP_KEY);
const VARSAYILAN = defaultCostSkeleton();

interface TipDurumu {
  craneType: string;
  skeleton: CostTemplateSkeleton;
  ozel: boolean;
  aktif: boolean;
}

function gruplar(s: CostTemplateSkeleton): string[] {
  const secili = s.groupKeys?.length ? s.groupKeys : (VARSAYILAN.groupKeys ?? []);
  return SECILEBILIR.map((g) => g.key).filter((k) => secili.includes(k));
}

function kapali(s: CostTemplateSkeleton, groupKey: string): Set<string> {
  return new Set(s.closedLines?.[groupKey] ?? []);
}

function ozelKalemler(s: CostTemplateSkeleton, groupKey: string): CostTemplateLine[] {
  return s.customLines?.[groupKey] ?? [];
}

function kalemSayisi(s: CostTemplateSkeleton): number {
  return gruplar(s).reduce((toplam, key) => {
    const def = SECILEBILIR.find((g) => g.key === key);
    if (!def) return toplam;
    const kapatilan = kapali(s, key);
    return toplam + def.lines.filter((l) => !kapatilan.has(l.key)).length + ozelKalemler(s, key).length;
  }, 0);
}

export function CostTemplatesView({
  craneTypes,
  templates,
  catalog = [],
  preview = false,
}: {
  craneTypes: string[];
  templates: CostTemplateRow[];
  catalog?: CostCatalogLine[];
  /** Yalnız `/dev` görsel önizlemesinde veritabanına yazmayı kapatır. */
  preview?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [secili, setSecili] = useState<string | null>(craneTypes[0] ?? templates[0]?.crane_type ?? null);
  const [yerel, setYerel] = useState<Record<string, CostTemplateSkeleton>>({});
  const [eklemeGrubu, setEklemeGrubu] = useState<string | null>(null);
  const [eklenecek, setEklenecek] = useState("__new__");
  const [yeniAd, setYeniAd] = useState("");
  const [yeniBirim, setYeniBirim] = useState<(typeof COST_UNITS)[number]>("adet");

  const satirlar = useMemo(() => {
    const map = new Map<string, CostTemplateRow>();
    for (const t of templates) map.set(trKatla(t.crane_type), t);
    return map;
  }, [templates]);

  /** Defterde kalmış pasif tipler de görünür; aksi hâlde geri açılamazlardı. */
  const tipler = useMemo(() => {
    const liste = [...craneTypes];
    const katlanmis = new Set(liste.map(trKatla));
    for (const t of templates) if (!katlanmis.has(trKatla(t.crane_type))) liste.push(t.crane_type);
    return liste;
  }, [craneTypes, templates]);

  // VERİTABANI KATALOĞU + eski şablonlarda zaten bulunan özel kalemler.
  // Göçten önce yazılmış bir kalem de yeniden seçim listesinde kaybolmaz.
  const katalog = useMemo(() => {
    const map = new Map<string, CostCatalogLine>();
    for (const line of catalog) map.set(trKatla(line.label), line);
    for (const template of templates) {
      for (const lines of Object.values(template.skeleton?.customLines ?? {})) {
        for (const line of lines) map.set(trKatla(line.label), { label: line.label, unit: line.unit });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "tr-TR"));
  }, [catalog, templates]);

  function durum(craneType: string): TipDurumu {
    const anahtar = trKatla(craneType);
    const satir = satirlar.get(anahtar);
    return {
      craneType,
      skeleton: yerel[anahtar] ?? satir?.skeleton ?? VARSAYILAN,
      ozel: Boolean(satir),
      aktif: satir ? satir.active : true,
    };
  }

  function calistir(fn: () => Promise<CostTemplateResult>, basari?: string) {
    if (preview) return;
    startTransition(async () => {
      const res = await fn();
      if (res?.error) return void toast.error(res.error);
      if (basari) toast.success(basari);
      router.refresh();
    });
  }

  /** Yerel geri bildirim anlıktır; aynı iskelet ardından deftere yazılır. */
  function yaz(craneType: string, sonraki: CostTemplateSkeleton) {
    const anahtar = trKatla(craneType);
    setYerel((c) => ({ ...c, [anahtar]: sonraki }));
    if (preview) return;
    calistir(() => saveOfferCostTemplate({
      craneType,
      groupKeys: gruplar(sonraki),
      closedLines: sonraki.closedLines ?? {},
      customLines: sonraki.customLines ?? {},
    }));
  }

  function unut(craneType: string) {
    const anahtar = trKatla(craneType);
    setYerel((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== anahtar)));
  }

  const acik = secili ? durum(secili) : null;
  const eklemeGrupDef = SECILEBILIR.find((g) => g.key === eklemeGrubu);

  const eklemeSecenekleri = useMemo(() => {
    if (!acik || !eklemeGrupDef) return [];
    const mevcut = new Set([
      ...eklemeGrupDef.lines
        .filter((line) => !kapali(acik.skeleton, eklemeGrupDef.key).has(line.key))
        .map((line) => trKatla(line.label)),
      ...ozelKalemler(acik.skeleton, eklemeGrupDef.key).map((line) => trKatla(line.label)),
    ]);
    return [
      ...eklemeGrupDef.lines
        .filter((line) => kapali(acik.skeleton, eklemeGrupDef.key).has(line.key))
        .map((line) => ({ id: `def:${line.key}`, label: line.label, unit: line.unit, fixed: true })),
      ...katalog
        .filter((line) => !mevcut.has(trKatla(line.label)))
        .map((line, index) => ({
          id: `catalog:${index}`,
          label: line.label,
          unit: line.unit,
          fixed: false,
        })),
    ];
  }, [acik, eklemeGrupDef, katalog]);

  if (tipler.length === 0) {
    return <EmptyState title="VİNÇ TİPİ YOK" description="Teklif defterinde etkin bir vinç tipi bulunamadı. Önce Tanımlar → Defterler ekranından val.craneType listesini doldurun." />;
  }

  function eklemePenceresiniKapat() {
    setEklemeGrubu(null);
    setEklenecek("__new__");
    setYeniAd("");
    setYeniBirim("adet");
  }

  function ozelKalemEkle() {
    if (!acik || !eklemeGrubu) return;
    if (eklenecek.startsWith("def:")) {
      const lineKey = eklenecek.slice(4);
      const closedLines = { ...(acik.skeleton.closedLines ?? {}) };
      closedLines[eklemeGrubu] = (closedLines[eklemeGrubu] ?? []).filter(
        (key) => key !== lineKey
      );
      if (closedLines[eklemeGrubu].length === 0) delete closedLines[eklemeGrubu];
      yaz(acik.craneType, { ...acik.skeleton, closedLines });
      eklemePenceresiniKapat();
      return void toast.success("Mevcut kalem şablonda yeniden açıldı.");
    }

    const katalogSatiri = eklemeSecenekleri.find((line) => line.id === eklenecek);
    const ad = adBuyuk((katalogSatiri?.label ?? yeniAd).trim());
    const birim = (katalogSatiri?.unit ?? yeniBirim) as (typeof COST_UNITS)[number];
    if (ad.length < 2) return void toast.error("Kalem adı gerekli.");
    const grup = SECILEBILIR.find((g) => g.key === eklemeGrubu);
    const mevcutAdlar = [
      ...(grup?.lines.map((l) => l.label) ?? []),
      ...ozelKalemler(acik.skeleton, eklemeGrubu).map((l) => l.label),
    ].map(trKatla);
    if (mevcutAdlar.includes(trKatla(ad))) return void toast.error("Bu bölümde aynı adlı bir kalem zaten var.");
    const satir: CostTemplateLine = {
      key: `sablon-${crypto.randomUUID()}`,
      label: ad,
      unit: birim,
    };
    yaz(acik.craneType, {
      ...acik.skeleton,
      customLines: {
        ...(acik.skeleton.customLines ?? {}),
        [eklemeGrubu]: [...ozelKalemler(acik.skeleton, eklemeGrubu), satir],
      },
    });
    eklemePenceresiniKapat();
    toast.success("Kalem şablona eklendi.");
  }

  function ozelKalemSil(groupKey: string, lineKey: string) {
    if (!acik) return;
    const kalan = ozelKalemler(acik.skeleton, groupKey).filter((l) => l.key !== lineKey);
    const customLines = { ...(acik.skeleton.customLines ?? {}) };
    if (kalan.length) customLines[groupKey] = kalan;
    else delete customLines[groupKey];
    yaz(acik.craneType, { ...acik.skeleton, customLines });
    toast.success("Kalem şablondan kaldırıldı; kayıtlı maliyetler değişmedi.");
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid gap-2 border bg-card p-3 text-sm sm:grid-cols-3">
        <p className="text-muted-foreground"><strong className="block text-foreground">Yeni maliyet</strong>Etkin bölüm ve kalemlerle kurulur.</p>
        <p className="text-muted-foreground"><strong className="block text-foreground">Tekliften Tazele</strong>Sonradan eklenen kalemleri tamamlar.</p>
        <p className="text-muted-foreground"><strong className="block text-foreground">Kayıtlı belgeler</strong>Şablondan kalem silinince değişmez.</p>
      </div>

      {/* Telefonda uzun sol menü yerine tek seçici; masaüstünde karşılaştırma
          hızını koruyan sabit tip listesi. İkisi aynı `secili` durumunu taşır. */}
      <div className="lg:hidden">
        <Label htmlFor="cost-template-type" className="mb-1.5 block">Vinç Tipi</Label>
        <Select value={secili ?? undefined} onValueChange={setSecili}>
          <SelectTrigger id="cost-template-type" className="w-full min-w-0"><SelectValue placeholder="Vinç tipi seçin" /></SelectTrigger>
          <SelectContent>{tipler.map((tip) => <SelectItem key={tip} value={tip}>{tip}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(12rem,16rem)_1fr] lg:items-start">
        <nav className="sticky top-16 hidden max-h-[calc(100dvh-5rem)] gap-0.5 overflow-y-auto border bg-card p-1 lg:grid" aria-label="Vinç tipleri">
          {tipler.map((tip) => {
            const d = durum(tip);
            const isaretli = secili === tip;
            return (
              <button key={tip} type="button" onClick={() => setSecili(tip)} aria-current={isaretli ? "true" : undefined} className={cn("oc-tap flex min-w-0 items-center justify-between gap-2 px-2 py-1.5 text-left text-sm transition-colors", isaretli ? "bg-primary/10 font-medium text-foreground" : "hover:bg-muted")}>
                <span className="min-w-0 break-words">{tip}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{d.ozel && !d.aktif ? "PASİF" : `${gruplar(d.skeleton).length}/${SECILEBILIR.length}`}</span>
              </button>
            );
          })}
        </nav>

        {acik && (
          <section className="grid min-w-0 gap-3">
            <div className="flex min-w-0 flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-base font-semibold">{acik.craneType}</h2>
                <p className="text-[12px] text-muted-foreground">{gruplar(acik.skeleton).length} bölüm · {kalemSayisi(acik.skeleton)} kalem{!acik.ozel && " · VARSAYILAN"}{acik.ozel && !acik.aktif && " · PASİF — varsayılan uygulanır"}</p>
              </div>
              {acik.ozel && (
                <div className="flex min-w-0 flex-wrap gap-1 sm:justify-end">
                  <Button type="button" variant="ghost" size="sm" disabled={pending || preview} onClick={() => { unut(acik.craneType); calistir(() => setOfferCostTemplateActive(acik.craneType, !acik.aktif), acik.aktif ? "Şablon pasife alındı." : "Şablon etkinleştirildi."); }}>{acik.aktif ? "Pasife Al" : "Etkinleştir"}</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={pending || preview} onClick={() => { unut(acik.craneType); calistir(() => resetOfferCostTemplate(acik.craneType), "Tip varsayılan kümeye döndü."); }}><RotateCcw className="size-3.5" /> Varsayılana Dön</Button>
                </div>
              )}
            </div>

            {SECILEBILIR.map((grup) => {
              const secililer = gruplar(acik.skeleton);
              const grupAcik = secililer.includes(grup.key);
              const kapatilan = kapali(acik.skeleton, grup.key);
              const ozeller = ozelKalemler(acik.skeleton, grup.key);
              const acikSayi = grup.lines.length - kapatilan.size + ozeller.length;
              const toplamSayi = grup.lines.length + ozeller.length;
              return (
                <section key={grup.key} className={cn("grid min-w-0 gap-3 border bg-card p-3", !grupAcik && "bg-muted/25")}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <label className="oc-tap flex min-w-0 cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={grupAcik} disabled={pending} onChange={(e) => {
                        if (!e.target.checked && secililer.length === 1) return void toast.error("En az bir bölüm açık kalmalı.");
                        yaz(acik.craneType, { ...acik.skeleton, groupKeys: e.target.checked ? [...secililer, grup.key] : secililer.filter((k) => k !== grup.key) });
                      }} className="size-4 shrink-0" />
                      <span className={cn("min-w-0 break-words text-sm font-semibold", !grupAcik && "text-muted-foreground")}>{grup.title}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{acikSayi}/{toplamSayi}</span>
                    </label>
                    {grupAcik && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setEklemeGrubu(grup.key)}><Plus className="size-3.5" /> Kalem Ekle</Button>}
                  </div>

                  {grupAcik && (
                    <div className="grid min-w-0 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {grup.lines.map((satir) => {
                        const acikSatir = !kapatilan.has(satir.key);
                        return (
                          <label key={satir.key} title={satir.hint} className={cn("oc-tap flex min-w-0 cursor-pointer items-center gap-2 border px-2.5 py-1.5 text-[12px] transition-colors", acikSatir ? "bg-background" : "bg-muted/30 text-muted-foreground")}>
                            <input type="checkbox" checked={acikSatir} disabled={pending} onChange={(e) => {
                              const sonraki = new Set(kapatilan);
                              if (e.target.checked) sonraki.delete(satir.key); else sonraki.add(satir.key);
                              yaz(acik.craneType, { ...acik.skeleton, groupKeys: secililer, closedLines: { ...(acik.skeleton.closedLines ?? {}), [grup.key]: [...sonraki] } });
                            }} className="size-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 break-words">{satir.label}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">{baslikDuzeni(satir.unit)}</span>
                          </label>
                        );
                      })}
                      {ozeller.map((satir) => (
                        <div key={satir.key} className="flex min-w-0 items-center gap-2 border border-primary/35 bg-primary/[0.05] px-2.5 py-1.5 text-[12px]">
                          <span className="min-w-0 flex-1 break-words">{satir.label}<span className="ml-1.5 text-[10px] font-medium text-primary">ÖZEL</span></span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{baslikDuzeni(satir.unit)}</span>
                          <Button type="button" variant="ghost" size="icon-sm" disabled={pending} onClick={() => ozelKalemSil(grup.key, satir.key)} aria-label={`${satir.label} kalemini şablondan kaldır`} title="Şablondan kaldır — kayıtlı maliyet belgeleri değişmez"><Trash2 className="size-3.5" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <p className="text-[12px] text-muted-foreground">PROJE GENELİ bir vince değil belgeye aittir; bu yüzden burada yer almaz. YARDIMCI KALDIRMA, teklif kaleminde gerçekten varsa şablonda kapalı olsa da açılır.</p>
          </section>
        )}
      </div>

      <Dialog open={Boolean(eklemeGrubu)} onOpenChange={(open) => { if (!open) eklemePenceresiniKapat(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Şablona Kalem Ekle</DialogTitle>
            <DialogDescription>{eklemeGrupDef?.title} bölümünde yeni maliyet açılırken miktarı ve birim fiyatı elle girilecek bir satır oluşturur.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="template-line-choice">Kalem</Label>
              <Select value={eklenecek} onValueChange={setEklenecek}>
                <SelectTrigger id="template-line-choice" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">Yeni Kalem Oluştur</SelectItem>
                  {eklemeSecenekleri.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.label} · {baslikDuzeni(line.unit)}{line.fixed ? " · Kapalı" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {eklenecek === "__new__" ? (
              <>
                <div className="grid gap-1.5"><Label htmlFor="template-line-name">Yeni Kalem Adı</Label><Input id="template-line-name" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="Kalem adı" autoFocus /></div>
                <div className="grid gap-1.5">
                  <Label htmlFor="template-line-unit">Birim</Label>
                  <Select value={yeniBirim} onValueChange={(v) => setYeniBirim(v as typeof yeniBirim)}>
                    <SelectTrigger id="template-line-unit" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{COST_UNITS.map((unit) => <SelectItem key={unit} value={unit}>{baslikDuzeni(unit)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={eklemePenceresiniKapat}>Vazgeç</Button>
            <Button type="button" onClick={ozelKalemEkle} disabled={pending || (eklenecek === "__new__" && yeniAd.trim().length < 2)}><Plus className="size-4" /> Kalem Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
