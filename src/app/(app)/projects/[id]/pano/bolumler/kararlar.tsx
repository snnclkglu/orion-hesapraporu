"use client";

// 3 · KARARLAR — kullanıcının verdiği her şey, tek listede, geri alınabilir (PANO-40).
//
// Ölçüldü (0026, 12.09.2026): canlıda üç pano kilidi ve iki aygıt sabitlemesi
// vardı; hiçbir ekran bunları bir arada göstermiyordu. Taşan panonun sebebi
// kullanıcının kendi kararlarıydı ve kullanıcı bunu göremiyordu. İkisi de
// bölünmüş göz kodlarına (`LVD0-A`) yazılmış UYKUDA kararlardı — bugünkü
// dizide karşılığı yok, ama LVD0 kilidi kalkınca 1000+1000 dayatacaklardı.
//
// Her satırın "Kaldır"ı vardır. "Yeniden Yerleştir" de buradadır: ne sildiğini
// yazar (sabitlenmemiş aygıt düzeltmeleri), ne koruduğunu yazar (kilitler ve
// sabitlemeler).

import { Lock, Pin, RefreshCw, Ruler, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComputeResult } from "@/lib/switchboard/compute";
import { MOUNT_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import type { PanelOverride, PlacementOverride } from "@/lib/switchboard/types";
import { sayi } from "../parcalar";

export interface KararSayimi {
  pano: number;
  aygit: number;
  ayar: number;
  uykuda: number;
}

export function kararlariSay(
  panoKararlari: PanelOverride[],
  aygitKararlari: PlacementOverride[],
  sonuc: ComputeResult
): KararSayimi {
  const kodlar = new Set([...sonuc.room, ...sonuc.field].map((p) => p.code));
  const uykuda = panoKararlari.filter((k) => !kodlar.has(k.code)).length;
  const ayar = [sonuc.settings.room, sonuc.settings.field].reduce(
    (t, d) => t + (d.heightMm !== null ? 1 : 0) + (d.depthMm !== null ? 1 : 0),
    0
  );
  return { pano: panoKararlari.length, aygit: aygitKararlari.length, ayar, uykuda };
}

export function KararlarBolumu({
  canEdit,
  bekle,
  sonuc,
  panoKararlari,
  aygitKararlari,
  onPanoSil,
  onAygitSil,
  onYenidenYerlestir,
}: {
  canEdit: boolean;
  bekle: boolean;
  sonuc: ComputeResult;
  panoKararlari: PanelOverride[];
  aygitKararlari: PlacementOverride[];
  onPanoSil: (code: string) => void;
  onAygitSil: (deviceKey: string) => void;
  onYenidenYerlestir: () => void;
}) {
  const kodlar = new Set([...sonuc.room, ...sonuc.field].map((p) => p.code));
  const aygitlar = new Map(sonuc.devices.map((d) => [d.key, d]));
  const say = kararlariSay(panoKararlari, aygitKararlari, sonuc);
  const serbestDuzeltme = aygitKararlari.filter((k) => !k.pinned).length;

  const ayarSatirlari: string[] = [];
  for (const [ad, d] of [
    ["Elektrik odası", sonuc.settings.room],
    ["Saha panoları", sonuc.settings.field],
  ] as const) {
    if (d.heightMm !== null) ayarSatirlari.push(`${ad}: yükseklik ${sayi(d.heightMm)} mm`);
    if (d.depthMm !== null) ayarSatirlari.push(`${ad}: derinlik ${sayi(d.depthMm)} mm`);
  }

  const hicKararYok = say.pano === 0 && say.aygit === 0 && say.ayar === 0;

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Verdiğiniz kararlar</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Sistem yerleşimi her açılışta yeniden hesaplar; kalıcı olan yalnız bu listedir. Bir karar
              sonucu bozuyorsa buradan kaldırılır.
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              disabled={bekle || serbestDuzeltme === 0}
              onClick={onYenidenYerlestir}
              title={
                serbestDuzeltme === 0
                  ? "Silinecek serbest düzeltme yok"
                  : `${sayi(serbestDuzeltme)} sabitlenmemiş aygıt düzeltmesini siler; kilitler ve sabitlemeler korunur.`
              }
            >
              <RefreshCw className="size-3.5" /> Yeniden Yerleştir
              {serbestDuzeltme > 0 && (
                <Badge variant="outline" className="ml-1 px-1 py-0 font-mono text-[10px]">
                  {sayi(serbestDuzeltme)}
                </Badge>
              )}
            </Button>
          )}
        </div>
        {hicKararYok && (
          <p className="mt-3 text-sm text-muted-foreground">
            Karar yok — her şey sistemin bulduğu gibi. Panolar bölümünde bir en seçmek, iç yerleşimde
            bir cihazı sürüklemek ya da ölçü tercihi kaydetmek burada listelenir.
          </p>
        )}
      </section>

      {ayarSatirlari.length > 0 && (
        <section className="rounded-lg border bg-card">
          <h3 className="oc-kicker border-b px-4 py-3 text-foreground/80">
            <Ruler className="mr-1 inline size-3.5" /> Ölçü tercihleri ({sayi(ayarSatirlari.length)})
          </h3>
          <ul className="grid gap-1 p-4 text-sm">
            {ayarSatirlari.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Panolar bölümündeki seçiciden “Otomatik”e çevirip “Ölçüleri Kaydet” ile geri alınır.
          </p>
        </section>
      )}

      {panoKararlari.length > 0 && (
        <section className="rounded-lg border bg-card">
          <h3 className="oc-kicker border-b px-4 py-3 text-foreground/80">
            <Lock className="mr-1 inline size-3.5" /> Pano kararları ({sayi(panoKararlari.length)})
            {say.uykuda > 0 && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                {sayi(say.uykuda)} uykuda
              </Badge>
            )}
          </h3>
          <ul className="grid gap-2 p-4 text-sm">
            {panoKararlari.map((k) => {
              const uykuda = !kodlar.has(k.code);
              const parcalar: string[] = [];
              if (k.kind) parcalar.push(`tür: ${k.kind === "oda" ? "Oda" : k.kind === "saha" ? "Saha" : "Pano değil"}`);
              if (k.widthLocked && k.widthMm !== null) parcalar.push(`en ${sayi(k.widthMm)} mm kilitli`);
              if (k.heightLocked && k.heightMm !== null) parcalar.push(`yükseklik ${sayi(k.heightMm)} mm kilitli`);
              if (k.depthLocked && k.depthMm !== null) parcalar.push(`derinlik ${sayi(k.depthMm)} mm kilitli`);
              if (k.doorConfig) parcalar.push(`kapak: ${k.doorConfig === "cift" ? "çift" : "tek"}`);
              if (k.baseMm !== null) parcalar.push(`baza ${sayi(k.baseMm)} mm`);
              if (k.name) parcalar.push(`ad: ${k.name}`);
              if (k.orderIndex !== null) parcalar.push(`sıra ${k.orderIndex}`);
              return (
                <li key={k.code} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{k.code}</span>
                  {uykuda && (
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      title="Bu kod bugünkü dizide yok (bölünmüş gözün eski adı olabilir). Karar uykuda; kod yeniden doğarsa uygulanır."
                    >
                      uykuda
                    </Badge>
                  )}
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {parcalar.length ? parcalar.join(" · ") : "boş karar"}
                  </span>
                  {canEdit && (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={bekle}
                      onClick={() => onPanoSil(k.code)}
                      title="Bu panonun bütün kararlarını siler"
                    >
                      <Trash2 className="size-3" /> Kaldır
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {aygitKararlari.length > 0 && (
        <section className="rounded-lg border bg-card">
          <h3 className="oc-kicker border-b px-4 py-3 text-foreground/80">
            <Pin className="mr-1 inline size-3.5" /> Aygıt kararları ({sayi(aygitKararlari.length)})
          </h3>
          <ul className="grid gap-2 p-4 text-sm">
            {aygitKararlari.map((k) => {
              const d = aygitlar.get(k.deviceKey);
              const etiket = d?.label ?? k.deviceKey.split("|").pop() ?? k.deviceKey;
              const pano = d?.panelCode ?? k.deviceKey.split("|")[1] ?? "";
              const komsuEtiket = k.anchorDeviceKey
                ? (aygitlar.get(k.anchorDeviceKey)?.label ?? k.anchorDeviceKey.split("|").pop())
                : null;
              const parcalar: string[] = [];
              if (k.anchorDeviceKey && k.anchorSide) {
                parcalar.push(`sıra: ${komsuEtiket}${k.anchorSide === "once" ? "'in önüne" : "'in sonrasına"}`);
              } else if (k.orderInRail !== null) {
                parcalar.push(`sıra ${k.orderInRail} (eski biçim)`);
              }
              if (k.panelCode) parcalar.push(`pano: ${k.panelCode}`);
              if (k.mountType) parcalar.push(`montaj: ${MOUNT_LABEL[k.mountType]}`);
              if (k.zone) parcalar.push(`bölge: ${ZONE_LABEL[k.zone]}`);
              if (k.widthMm !== null || k.heightMm !== null || k.depthMm !== null) {
                parcalar.push(
                  `ölçü ${k.widthMm ?? "—"} × ${k.heightMm ?? "—"} × ${k.depthMm ?? "—"} mm`
                );
              }
              const uyari = [...sonuc.room, ...sonuc.field]
                .flatMap((p) => p.warnings)
                .find((w) => w.startsWith(`${etiket} sabitlemesi uygulanamadı`));
              return (
                <li key={k.deviceKey} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">
                    {pano}-{etiket}
                  </span>
                  {k.pinned ? (
                    <Badge variant="secondary" className="text-[10px]">
                      <Pin className="size-2.5" /> sabit
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      düzeltme
                    </Badge>
                  )}
                  {!d && (
                    <Badge variant="outline" className="text-[10px]" title="Bu aygıt bugünkü malzeme listesinde yok.">
                      uykuda
                    </Badge>
                  )}
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {parcalar.length ? parcalar.join(" · ") : "boş karar"}
                    {uyari && <span className="ml-2 text-destructive">— {uyari.split(": ")[1] ?? uyari}</span>}
                  </span>
                  {canEdit && (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={bekle}
                      onClick={() => onAygitSil(k.deviceKey)}
                      title="Bu aygıtın bütün kararlarını siler"
                    >
                      <Trash2 className="size-3" /> Kaldır
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            <Zap className="mr-1 inline size-3" />
            Sabitleme SIRAYI korur, koordinatı değil: komşusunun eni değişince cihaz da kayar.
          </p>
        </section>
      )}
    </div>
  );
}
