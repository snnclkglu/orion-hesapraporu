"use client";

// PANO EKRANLARININ ORTAK PARCALARI.
//
// Pano yerlesimi iki sayfaya ayrildi: dizilim/ozet/denetim ana sayfada, ic
// yerlesim ayri sayfada (kullanici karari 08.09.2026). Ikisi de ayni cihaz
// listesini, ayni olcu diyalogunu ve ayni sema kabini kullaniyor.
//
// PARCALAR KOPYALANMAZ, PAYLASILIR: iki kopya, olcu diyalogunun birinde
// duzeltilip otekinde unutuldugu gun ayrisirdi ve kullanici hangi ekrandan
// girdigine gore baska bir davranis gorurdu.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleAlert,
  Download,
  FileText,
  Lock,
  Pin,
  RefreshCw,
  Ruler,
  ShieldCheck,
  TriangleAlert,
  Unlock,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SayiKutusu } from "@/components/sayi-kutusu";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
  panoKapakDiagram,
  panoNumaralari,
} from "@/lib/diagrams/panoLayout";
import { COLOR_GROUP_LABEL, MOUNT_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import {
  PANEL_BASE_HEIGHTS_MM,
  PANEL_DEPTHS_MM,
  PANEL_HEIGHTS_MM,
  PANEL_WIDTHS_MM,
} from "@/lib/switchboard/sizes";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type {
  LineupPrefs,
  LineupSize,
  PanelLayout,
  PanelOverride,
  Unplaced,
} from "@/lib/switchboard/types";
import type { SwitchboardApproval } from "@/lib/switchboard-data";
import {
  approveLayout,
  resetPlacements,
  saveDeviceModel,
  savePlacement,
  savePanel,
  unlockPanel,
  withdrawApproval,
} from "./actions";

/**
 * KUYRUK GEREKÇESİYLE SIRALANIR (PANO-30).
 *
 * "Panoya girmeyen aygıtlar" beş ayrı şeyi tek başlık altında topluyordu ve
 * kullanıcı buna bakınca "modül eksik" gördü (08.09.2026). Oysa çoğu satır
 * DOĞRU davranıştır — bir motor panoya girmez — ve gerçek eksik (ölçüsü
 * olmayan sürücü) o kalabalığın içinde kayboluyordu.
 *
 * Sıra bir önem sırasıdır: önce SORUN, sonra beklenen.
 */
export const KUYRUK_SIRASI: readonly Unplaced["reason"][] = [
  "olcusuz",
  "sigmadi",
  "siniflanmamis",
  "etiketsiz",
  "saha",
  "urunsuz",
];

/** Bu kuyruk bir EKSİK mi, yoksa beklenen bir sonuç mu? */
export const KUYRUK_SORUN: Record<Unplaced["reason"], boolean> = {
  olcusuz: true,
  sigmadi: true,
  siniflanmamis: true,
  etiketsiz: true,
  saha: false,
  urunsuz: false,
};

/** Her kuyruğun tek cümlelik gerekçesi — kullanıcı ne yapacağını bilsin. */
export const KUYRUK_ACIKLAMA: Record<Unplaced["reason"], string> = {
  olcusuz:
    "Bu cihazların ölçüsü bilinmiyor; panonun eni ve derinliği EKSİK hesaplandı. Ölçü Defteri'nden girilmeli.",
  sigmadi:
    "Bu cihazlar boş bir raya bile sığmadı; pano eni yetmiyor ya da cihaz ölçüsü yanlış.",
  siniflanmamis:
    "Ürün tanınmadı, montaj tipi TAHMİN EDİLMEDİ. Sınıflandırma sözlüğü bu ürünü öğrenmeli.",
  etiketsiz: "Aygıt etiketi okunamadı; elektrik projesindeki satır kontrol edilmeli.",
  saha:
    "DOĞRU: bunlar panonun içinde değil — motor, enkoder, limit şalteri, fren direnci. Vincin üstünde durur.",
  urunsuz:
    "Aygıt etiketi var ama malzeme satırında ürün yok. Bir hata değil, elektrik projesindeki bir boşluk.",
};

export const KUYRUK_ADI: Record<Unplaced["reason"], string> = {
  olcusuz: "Ölçüsü yok",
  siniflanmamis: "Sınıflanmamış",
  sigmadi: "Yerleşmedi",
  etiketsiz: "Etiketsiz satır",
  urunsuz: "Ürünsüz satır",
  saha: "Pano dışı (saha)",
};

export function sayi(v: number): string {
  return v.toLocaleString("tr-TR");
}
export function Baslik({
  docNo,
  projectName,
  projectId,
}: {
  docNo: string;
  projectName: string;
  projectId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" variant="ghost" asChild>
        <Link href={`/projects/${projectId}`}>
          <ArrowLeft className="size-3.5" /> Projeye dön
        </Link>
      </Button>
      <h1 className="text-lg font-semibold">
        Pano Yerleşimi
        <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
          {docNo} {projectName}
        </span>
      </h1>
    </div>
  );
}

export function SemaKabi({ children }: { children: React.ReactNode }) {
  return (
    <div className="oc-diagram-theme oc-scrollx overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
      {children}
    </div>
  );
}

export function KapakSemasi({
  panel,
  settings,
}: {
  panel: PanelLayout;
  settings: ComputeResult["settings"];
}) {
  const d = panoKapakDiagram({ panel, settings });
  if (!d) return null;
  return (
    <SemaKabi>
      <DiagramSvg diagram={d} themeAware />
    </SemaKabi>
  );
}

/**
 * BİR DİZİNİN ölçü grubu — yükseklik · derinlik · baza.
 *
 * Adres anahtarları önekle ayrılır (`odaYukseklik`, `sahaYukseklik`): tek bir
 * `yukseklik` anahtarı iki diziye birden yazıyordu ve kullanıcı odayı 2000'e
 * çektiğinde duvara asılan saha kutusu da 2000 oluyordu.
 */
export function OlcuGrubu({
  baslik,
  onek,
  tercih,
  cozulen,
  onChange,
}: {
  baslik: string;
  onek: "oda" | "saha";
  tercih: LineupPrefs;
  cozulen: LineupSize;
  onChange: (anahtar: string, deger: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="oc-kicker text-[10px] text-muted-foreground">{baslik}</span>
      <div className="flex flex-wrap items-center gap-2">
        <OlcuSecici
          etiket="Yükseklik"
          deger={tercih.heightMm}
          cozulen={cozulen.heightMm}
          secenekler={PANEL_HEIGHTS_MM}
          onChange={(v) => onChange(`${onek}Yukseklik`, v)}
        />
        <OlcuSecici
          etiket="Derinlik"
          deger={tercih.depthMm}
          cozulen={cozulen.depthMm}
          secenekler={PANEL_DEPTHS_MM}
          onChange={(v) => onChange(`${onek}Derinlik`, v)}
        />
        <OlcuSecici
          etiket="Baza"
          deger={tercih.baseMm}
          secenekler={PANEL_BASE_HEIGHTS_MM}
          onChange={(v) => onChange(`${onek}Baza`, v)}
          zorunlu
        />
      </div>
    </div>
  );
}

export function OlcuSecici({
  etiket,
  deger,
  secenekler,
  onChange,
  zorunlu,
  cozulen,
}: {
  etiket: string;
  deger: number | null;
  secenekler: readonly number[];
  onChange: (v: string) => void;
  zorunlu?: boolean;
  /** Kullanıcı seçmediyse aramanın bulduğu ölçü — yalnız gösterim. */
  cozulen?: number | null;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {etiket}
      <select
        value={deger === null ? "" : String(deger)}
        onChange={(e) => onChange(e.target.value)}
        className="oc-tap h-9 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
        aria-label={etiket}
      >
        {/* KARAR ≠ OLGU: kutu kullanıcının SEÇİMİNİ gösterir, sistemin
            bulduğunu değil. İkisi ayrışmasın diye bulunan ölçü "Otomatik"in
            yanında parantez içinde durur. */}
        {!zorunlu && <option value="">{cozulen ? `Otomatik (${sayi(cozulen)} mm)` : "Otomatik"}</option>}
        {secenekler.map((v) => (
          <option key={v} value={v}>
            {sayi(v)} mm
          </option>
        ))}
      </select>
    </label>
  );
}

export function Secici({
  deger,
  secenekler,
  etiket,
  pasif,
  bosEtiket = "Otomatik",
  onChange,
}: {
  deger: string | null;
  secenekler: [string, string][];
  etiket: string;
  pasif?: boolean;
  bosEtiket?: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={deger ?? ""}
      disabled={pasif}
      onChange={(e) => onChange(e.target.value)}
      aria-label={etiket}
      className="oc-tap h-9 w-full max-w-36 rounded-md border bg-background px-2 text-base disabled:opacity-50 pointer-fine:text-sm"
    >
      <option value="">{bosEtiket}</option>
      {secenekler.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/**
 * Şemadaki numaranın karşılığı — 17,5 mm'lik bir cihazın üstüne etiket sığmaz
 * ve gerçek yerleşim yazılımları da böyle yapar: RESİM YERLEŞİMİ, LİSTE
 * KİMLİĞİ anlatır.
 */
export function CihazListesi({
  panel,
  secilen,
  onSec,
}: {
  panel: PanelLayout;
  secilen: string;
  onSec: (k: string) => void;
}) {
  const numaralar = panoNumaralari(panel);
  const sirali = [...panel.placements].sort(
    (a, b) => a.railIndex - b.railIndex || a.xMm - b.xMm
  );

  return (
    <div className="rounded-lg border bg-card">
      <h3 className="oc-kicker border-b px-4 py-3 text-foreground/80">
        {panel.code} cihaz listesi ({sirali.length})
      </h3>
      <table className="oc-tablet-table w-full table-fixed text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-[8%] px-3 py-2">No</th>
            <th className="w-[14%] px-3 py-2">Aygıt</th>
            <th className="w-[16%] px-3 py-2">Bölge</th>
            <th className="w-[12%] px-3 py-2">Ray</th>
            <th className="w-[20%] px-3 py-2">Ölçü (mm)</th>
            <th className="w-[16%] px-3 py-2">Kaynak</th>
            <th className="w-[14%] px-3 py-2">Grup</th>
          </tr>
        </thead>
        <tbody>
          {sirali.map((y) => {
            const no = numaralar.get(`${y.deviceKey}#${y.railIndex}#${Math.round(y.xMm)}`);
            const secili = y.deviceKey === secilen;
            return (
              <tr
                key={`${y.deviceKey}-${y.railIndex}-${Math.round(y.xMm)}`}
                className={`cursor-pointer border-b last:border-0 hover:bg-muted/40 ${
                  secili ? "bg-muted/60" : ""
                }`}
                onClick={() => onSec(y.deviceKey)}
              >
                <td className="px-3 py-1.5 tabular-nums text-muted-foreground" data-label="No">
                  {no ?? "—"}
                </td>
                <td className="truncate px-3 py-1.5 font-mono" data-label="Aygıt" title={y.label}>
                  {y.label}
                </td>
                <td className="truncate px-3 py-1.5" data-label="Bölge">
                  {ZONE_LABEL[y.zone]}
                </td>
                <td className="px-3 py-1.5 tabular-nums" data-label="Ray">
                  {y.railIndex + 1} · {MOUNT_LABEL[y.mountType]}
                </td>
                <td className="px-3 py-1.5 tabular-nums" data-label="Ölçü (mm)">
                  {Math.round(y.widthMm)} × {Math.round(y.heightMm)} × {Math.round(y.depthMm)}
                  {y.unitCount > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">({y.unitCount}×)</span>
                  )}
                </td>
                <td className="px-3 py-1.5" data-label="Kaynak">
                  {y.dimSource === "tahmin" ? (
                    <Badge variant="outline" className="border-amber-500/60 text-amber-600">
                      tahmin
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{y.dimSource}</span>
                  )}
                </td>
                <td className="truncate px-3 py-1.5" data-label="Grup">
                  {/* Renk kutucuğu TEMA DEĞİŞKENİNDEN gelir, hex'ten değil
                      (değişmez md. 6): şemadaki dolgu koyu temada dönüyor,
                      listedeki kutucuk dönmezse ikisi ayrışırdı. */}
                  <span
                    className="oc-diagram-theme mr-1.5 inline-block size-2.5 rounded-[2px] align-middle"
                    style={{ backgroundColor: `var(--oc-diagram-kat-${y.colorGroup})` }}
                  />
                  <span className="text-xs">{COLOR_GROUP_LABEL[y.colorGroup]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ÜRÜN ÖLÇÜSÜ GİRME — kuyruktan tek tıkla, ve DEFTERE yazar.
 *
 * Ölçü aygıta değil ÜRÜNE aittir (PANO-12): aynı Siemens şalteri bir sonraki
 * projede de aynı yeri kaplar. Bir kez girilen ölçü bütün projelerde
 * geçerlidir ve o projenin tahmin sayacını da düşürür.
 *
 * `source` daima `elle`dir — bu bir tahminin onaylanması DEĞİL, ayrı bir
 * iddiadır. Boş bırakılan kutu `null` üretir, `0` değil (değişmez md. 4/5).
 */
export function OlcuDiyalogu({
  projectId,
  device,
  onBitti,
}: {
  projectId: string;
  device: Unplaced["device"];
  onBitti: () => void;
}) {
  const [acik, setAcik] = useState(false);
  const [en, setEn] = useState<number | null>(device.widthMm);
  const [boy, setBoy] = useState<number | null>(device.heightMm);
  const [derinlik, setDerinlik] = useState<number | null>(device.depthMm);
  const [bekle, setBekle] = useState(false);

  async function kaydet() {
    setBekle(true);
    const sonuc = await saveDeviceModel({
      projectId,
      supplier: device.supplier || "—",
      typeNo: device.typeNo,
      widthMm: en,
      heightMm: boy,
      depthMm: derinlik,
      mountType: device.mountType,
      zone: device.zone,
      note: "",
    });
    setBekle(false);
    if ("error" in sonuc) {
      toast.error(sonuc.error);
      return;
    }
    toast.success("Ölçü deftere yazıldı; bütün projelerde geçerli.");
    setAcik(false);
    onBitti();
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button size="xs" variant="outline" className="shrink-0">
          <Ruler className="size-3" /> Ölçü
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ürün ölçüsü</DialogTitle>
          <DialogDescription>
            {device.supplier} {device.typeNo} — ölçü ÜRÜNE yazılır, bu projeye değil;
            bir sonraki işte de kullanılır.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{device.designation || "—"}</p>

        <div className="grid grid-cols-3 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            En (mm)
            <SayiKutusu value={en} onChange={setEn} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Yükseklik (mm)
            <SayiKutusu value={boy} onChange={setBoy} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Derinlik (mm)
            <SayiKutusu value={derinlik} onChange={setDerinlik} />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          Boş bırakılan kutu “bilinmiyor” demektir, sıfır değil. Üç ölçü de girilmeden
          cihaz panoya yerleşmez.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAcik(false)} disabled={bekle}>
            Vazgeç
          </Button>
          <Button onClick={() => void kaydet()} disabled={bekle}>
            Deftere Yaz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * AYGIT DÜZELTMESİ — seçili cihazın montaj tipi, bölgesi ve panosu.
 *
 * Düzeltme AYGITA yazılır (`switchboard_placements`), ürüne değil: aynı tipteki
 * on iki kontaktörden yalnız biri başka panoya alınabilir. `pinned` işaretli
 * satırı “Yeniden Yerleştir” KORUR.
 */
export function AygitFormu({
  projectId,
  panel,
  deviceKey,
  panolar,
  onBitti,
}: {
  projectId: string;
  panel: PanelLayout;
  deviceKey: string;
  panolar: PanelLayout[];
  onBitti: () => void;
}) {
  const yerlesim = panel.placements.find((p) => p.deviceKey === deviceKey);
  const [bekle, setBekle] = useState(false);
  if (!yerlesim) return null;

  async function yaz(alan: Partial<Parameters<typeof savePlacement>[0]>) {
    setBekle(true);
    const sonuc = await savePlacement({
      projectId,
      deviceKey,
      panelCode: yerlesim!.panelCode,
      mountType: yerlesim!.mountType,
      zone: yerlesim!.zone,
      pinned: false,
      note: "",
      ...alan,
    });
    setBekle(false);
    if ("error" in sonuc) toast.error(sonuc.error);
    else {
      toast.success("Aygıt düzeltmesi kaydedildi.");
      onBitti();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3 text-xs">
      <span className="font-mono text-sm font-semibold">{yerlesim.label}</span>
      <label className="grid gap-1 text-muted-foreground">
        Pano
        <Secici
          deger={yerlesim.panelCode}
          bosEtiket="Değiştirme"
          secenekler={panolar.map((p) => [p.code, p.code])}
          etiket="Aygıtın panosu"
          pasif={bekle}
          onChange={(v) => void yaz({ panelCode: v || null })}
        />
      </label>
      <label className="grid gap-1 text-muted-foreground">
        Montaj
        <Secici
          deger={yerlesim.mountType}
          bosEtiket="Otomatik"
          secenekler={(Object.keys(MOUNT_LABEL) as (keyof typeof MOUNT_LABEL)[]).map((k) => [
            k,
            MOUNT_LABEL[k],
          ])}
          etiket="Montaj tipi"
          pasif={bekle}
          onChange={(v) =>
            void yaz({ mountType: (v || null) as Parameters<typeof savePlacement>[0]["mountType"] })
          }
        />
      </label>
      <label className="grid gap-1 text-muted-foreground">
        Bölge
        <Secici
          deger={yerlesim.zone}
          bosEtiket="Otomatik"
          secenekler={(Object.keys(ZONE_LABEL) as (keyof typeof ZONE_LABEL)[]).map((k) => [
            k,
            ZONE_LABEL[k],
          ])}
          etiket="Bölge"
          pasif={bekle}
          onChange={(v) =>
            void yaz({ zone: (v || null) as Parameters<typeof savePlacement>[0]["zone"] })
          }
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={bekle}
        onClick={() => void yaz({ pinned: true })}
        title="Sabitlenen satırı “Yeniden Yerleştir” korur."
      >
        <Pin className="size-3.5" /> Sabitle
      </Button>
    </div>
  );
}

