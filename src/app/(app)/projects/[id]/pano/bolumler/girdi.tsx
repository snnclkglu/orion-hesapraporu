"use client";

// 1 · GİRDİ — belge, ölçü defteri eksikleri, tanınmayan ürünler.
//
// Kullanıcının ilk sorusu "sistem neyi biliyor, neyi bilmiyor?"dur. Eski
// ekran bunu Özet'in yarısına ve "Aygıt kuyruğu"nun altı kovasına
// dağıtıyordu; kullanıcı kuyruğa bakınca "modül eksik" gördü (08.09.2026).
// Burada yalnız SORUN olan kovalar durur (ölçüsüz, sınıflanmamış, etiketsiz);
// beklenen davranış olan saha/ürünsüz listeleri Onay bölümündedir.

import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { Unplaced } from "@/lib/switchboard/types";
import { KUYRUK_ACIKLAMA, KUYRUK_ADI, OlcuDiyalogu, sayi } from "../parcalar";
import { DefterBagi } from "./uyari-seridi";

const SORUN_KOVALARI: Unplaced["reason"][] = ["olcusuz", "siniflanmamis", "etiketsiz", "sigmadi"];

export function GirdiBolumu({
  projectId,
  canEdit,
  belgeAdi,
  belgeRevizyon,
  parcaSayisi,
  sonuc,
  onBitti,
}: {
  projectId: string;
  canEdit: boolean;
  belgeAdi: string;
  belgeRevizyon: string;
  parcaSayisi: number;
  sonuc: ComputeResult;
  onBitti: () => void;
}) {
  const kovalar = SORUN_KOVALARI.map((sebep) => ({
    sebep,
    liste: sonuc.unplaced.filter((u) => u.reason === sebep),
  })).filter((k) => k.liste.length > 0);

  const plakaya = [...sonuc.room, ...sonuc.field].reduce((t, p) => t + p.placements.length, 0);
  const govde = [...sonuc.room, ...sonuc.field].reduce(
    (t, p) => t + p.bodyDevices.length + p.sideDevices.length,
    0
  );
  const saha = sonuc.unplaced.filter((u) => u.reason === "saha").length;
  const urunsuz = sonuc.unplaced.filter((u) => u.reason === "urunsuz").length;

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">
          {belgeAdi || "Elektrik projesi"}
          {belgeRevizyon && (
            <Badge variant="outline" className="ml-2 font-mono uppercase">
              {belgeRevizyon}
            </Badge>
          )}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {sayi(parcaSayisi)} malzeme satırı · {sayi(sonuc.devices.length)} aygıt
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <dt className="text-muted-foreground">Plakaya yerleşen</dt>
          <dd className="tabular-nums">{sayi(plakaya)}</dd>
          <dt className="text-muted-foreground">Gövde ve pano yanı</dt>
          <dd className="tabular-nums">{sayi(govde)}</dd>
          <dt className="text-muted-foreground">Pano dışı (saha)</dt>
          <dd className="tabular-nums">{sayi(saha)}</dd>
          <dt className="text-muted-foreground">Ürünsüz satır</dt>
          <dd className="tabular-nums">{sayi(urunsuz)}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <DefterBagi projectId={projectId}>
              <BookOpen className="size-3.5" /> Ölçü Defteri
              {sonuc.estimatedCount > 0 && (
                <span className="ml-1 rounded bg-amber-500/15 px-1 font-mono text-[10px] text-amber-700 dark:text-amber-400">
                  {sayi(sonuc.estimatedCount)}
                </span>
              )}
            </DefterBagi>
          </Button>
          <span
            className={
              sonuc.estimatedCount > 0 ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"
            }
          >
            Ölçüsü doğrulanmamış: {sayi(sonuc.estimatedCount)} aygıt
            {sonuc.estimatedCount > 0 && " — şemada taralı çizilir; sipariş için sıfıra inmeli"}
          </span>
        </div>
      </section>

      {kovalar.length === 0 ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
          Girdi tam: her aygıtın ölçüsü ve montaj tipi biliniyor. Sonraki adım Panolar.
        </p>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {kovalar.map(({ sebep, liste }) => (
            <div key={sebep} className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{KUYRUK_ADI[sebep]}</span>
                <Badge variant="destructive">{sayi(liste.length)}</Badge>
              </div>
              <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                {KUYRUK_ACIKLAMA[sebep]}
              </p>
              <ul className="grid gap-1 text-xs text-muted-foreground">
                {liste.slice(0, 12).map((u, i) => (
                  <li key={`${u.device.key}-${i}`} className="flex items-center gap-2" title={u.note}>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono">
                        {u.device.panelCode}-{u.device.label}
                      </span>{" "}
                      {u.device.supplier} {u.device.typeNo}
                    </span>
                    {canEdit && u.device.typeNo && (
                      <OlcuDiyalogu projectId={projectId} device={u.device} onBitti={onBitti} />
                    )}
                  </li>
                ))}
                {liste.length > 12 && <li>… {sayi(liste.length - 12)} satır daha</li>}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
