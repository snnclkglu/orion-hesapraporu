"use client";

// UYARI ŞERİDİ — her bölümün üstünde, sistemin söylemek zorunda olduğu şeyler (PANO-40).
//
// Ölçüldü (0026, 12.09.2026): "Ray yüksekliği 2363 mm; plakada 1250 mm var"
// ve "En 1200 kilitli" uyarıları Panolar tablosunda bir `title` ipucunda
// ("1 uyarı") duruyordu; Özet'te hiçbir şey yoktu. Kullanıcı taşan panoyu
// gördü ama sebebinin kendi kilidi olduğunu göremedi. Uyarı, kullanıcının
// baktığı yerde açık metin olarak durur; ipucu bir uyarı yeri değildir.

import Link from "next/link";
import { TriangleAlert, Lock, Ruler, ShieldAlert, Pin } from "lucide-react";
import type { ComputeResult } from "@/lib/switchboard/compute";
import { sayi } from "../parcalar";

export interface UyariSatiri {
  tur: "tasma" | "kilit" | "olcu" | "onay" | "sabitleme" | "siniflama";
  metin: string;
  /** Kullanıcıyı çözüme götüren bölüm. */
  bolum: "girdi" | "panolar" | "kararlar" | "onay";
}

/** Sonuçtan uyarı satırlarını türetir — saf, sınanabilir. */
export function uyarilariTuret(sonuc: ComputeResult, onayEskidi: boolean, projectId: string): UyariSatiri[] {
  const satirlar: UyariSatiri[] = [];
  const panolar = [...sonuc.room, ...sonuc.field];

  for (const p of panolar) {
    const tasma = p.warnings.find((w) => w.includes("plakada"));
    const kilit = p.warnings.find((w) => w.includes("kilitli"));
    if (tasma && kilit) {
      satirlar.push({
        tur: "kilit",
        metin: `${p.code} ${sayi(p.widthMm)} mm kilidiyle sığmıyor (${tasma.replace("Ray yüksekliği ", "ray yığını ")}). Kilidi kaldırın ya da daha yüksek gövde seçin.`,
        bolum: "kararlar",
      });
    } else if (tasma) {
      satirlar.push({
        tur: "tasma",
        metin: `${p.code} plakaya sığmıyor: ${tasma}`,
        bolum: "panolar",
      });
    }
    for (const w of p.warnings.filter((x) => x.includes("sabitlemesi uygulanamadı"))) {
      satirlar.push({ tur: "sabitleme", metin: `${p.code}: ${w}`, bolum: "kararlar" });
    }
  }

  const olcusuz = sonuc.unplaced.filter((u) => u.reason === "olcusuz").length;
  if (olcusuz > 0) {
    satirlar.push({
      tur: "olcu",
      metin: `${sayi(olcusuz)} cihazın ölçüsü bilinmiyor; pano eni ve derinliği EKSİK hesaplandı.`,
      bolum: "girdi",
    });
  }
  if (sonuc.estimatedCount > 0) {
    satirlar.push({
      tur: "olcu",
      metin: `${sayi(sonuc.estimatedCount)} cihazın ölçüsü tahmin — sipariş verilemez, Ölçü Defteri'nden doğrulanmalı.`,
      bolum: "girdi",
    });
  }
  const siniflanmamis = sonuc.unplaced.filter((u) => u.reason === "siniflanmamis").length;
  if (siniflanmamis > 0) {
    satirlar.push({
      tur: "siniflama",
      metin: `${sayi(siniflanmamis)} ürün tanınmadı; montaj tipi tahmin edilmedi.`,
      bolum: "girdi",
    });
  }
  if (onayEskidi) {
    satirlar.push({
      tur: "onay",
      metin: "Onaydan sonra girdi değişti; imalatçıya giden belge bu planla aynı olmayabilir.",
      bolum: "onay",
    });
  }
  void projectId;
  return satirlar;
}

const IKON = {
  tasma: TriangleAlert,
  kilit: Lock,
  olcu: Ruler,
  onay: ShieldAlert,
  sabitleme: Pin,
  siniflama: TriangleAlert,
} as const;

export function UyariSeridi({
  satirlar,
  onBolum,
}: {
  satirlar: UyariSatiri[];
  onBolum: (b: UyariSatiri["bolum"]) => void;
}) {
  if (satirlar.length === 0) return null;
  return (
    <ul
      aria-label="Uyarılar"
      className="grid gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
    >
      {satirlar.map((u, i) => {
        const Ikon = IKON[u.tur];
        return (
          <li key={`${u.tur}-${i}`} className="flex items-start gap-2">
            <Ikon className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{u.metin}</span>
            <button
              type="button"
              className="oc-tap shrink-0 underline decoration-dotted underline-offset-2"
              onClick={() => onBolum(u.bolum)}
            >
              {BOLUM_ADI[u.bolum]} →
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const BOLUM_ADI = {
  girdi: "Girdi",
  panolar: "Panolar",
  kararlar: "Kararlar",
  onay: "Onay ve çıktı",
} as const;

/** Girdi bölümünün "Ölçü Defteri" bağı — iki yerde aynı adres. */
export function defterAdresi(projectId: string): string {
  return `/projects/${projectId}/pano/defter`;
}

export function DefterBagi({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  return <Link href={defterAdresi(projectId)}>{children}</Link>;
}
