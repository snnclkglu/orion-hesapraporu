"use client";

// 4 · ONAY VE ÇIKTI — denetim, pano dışı aygıtlar, indirme, onay.
//
// Denetim GEÇENLERİ de listeler (PANO-11): "hepsi geçti" cümlesi neyin
// denetlendiğini söylemez. Pano dışı aygıtlar (saha, ürünsüz) DOĞRU
// davranıştır; burada "eksik" gibi değil "beklenen" gibi durur. Onay, girdinin
// değişiklik izine bağlıdır (PANO-14): iz tutmuyorsa onay eskidi demektir.

import { Download, FileText, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { SwitchboardApproval } from "@/lib/switchboard-data";
import type { Unplaced } from "@/lib/switchboard/types";
import { KUYRUK_ACIKLAMA, KUYRUK_ADI, sayi } from "../parcalar";

const BEKLENEN_KOVALAR: Unplaced["reason"][] = ["saha", "urunsuz"];

export function OnayBolumu({
  projectId,
  canEdit,
  bekle,
  sonuc,
  onay,
  onayEskidi,
  arama,
  onOnayla,
  onOnayKaldir,
}: {
  projectId: string;
  canEdit: boolean;
  bekle: boolean;
  sonuc: ComputeResult;
  onay: SwitchboardApproval | null;
  onayEskidi: boolean;
  arama: string;
  onOnayla: () => void;
  onOnayKaldir: () => void;
}) {
  const hatali = sonuc.audits.filter((a) => !a.result.ok);
  const kovalar = BEKLENEN_KOVALAR.map((sebep) => ({
    sebep,
    liste: sonuc.unplaced.filter((u) => u.reason === sebep),
  })).filter((k) => k.liste.length > 0);
  const sorgu = arama ? `?${arama}` : "";
  const onayli = Boolean(onay && !onayEskidi);
  const onaylanabilir = hatali.length === 0 && sonuc.estimatedCount === 0;

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold">Onay</h2>
          {onayli && (
            <Badge variant="secondary">
              <ShieldCheck className="size-3" /> Onaylı
            </Badge>
          )}
          {onayEskidi && (
            <Badge variant="destructive">
              <TriangleAlert className="size-3" /> Onay eskidi
            </Badge>
          )}
          <span className="ml-auto font-mono text-[11px] text-muted-foreground" title="Girdinin değişiklik izi — onay buna bağlanır">
            değişiklik izi {sonuc.fingerprint}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {onay
            ? `${onayEskidi ? "Eski onay" : "Onay"} ${new Date(onay.approvedAt).toLocaleString("tr-TR")}${onay.note ? ` · ${onay.note}` : ""}`
            : "Bu yerleşim henüz onaylanmadı."}
          {!onaylanabilir &&
            " Onay için denetimin geçmesi ve tahmin ölçülü cihaz kalmaması gerekir."}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/pano/svg${sorgu}`}>
              <Download className="size-3.5" /> SVG
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/pano/pdf${sorgu}`}>
              <FileText className="size-3.5" /> PDF (imalatçıya)
            </a>
          </Button>
          {canEdit &&
            (onayli ? (
              <Button size="sm" variant="ghost" disabled={bekle} onClick={onOnayKaldir}>
                Onayı Kaldır
              </Button>
            ) : (
              <Button size="sm" disabled={bekle || !onaylanabilir} onClick={onOnayla} title={onaylanabilir ? "Bu planı onaylar" : "Denetim hatası ya da tahmin ölçü varken onaylanamaz"}>
                <ShieldCheck className="size-3.5" /> Onayla
              </Button>
            ))}
        </div>
        {onayEskidi && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            Onaydan sonra girdi değişti (elektrik projesi yeniden okundu ya da bir karar/ölçü
            değişti). İmalatçıya giden belge bu ekrandaki planla artık aynı olmayabilir — gözden
            geçirip yeniden onaylayın.
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="oc-kicker mb-2 text-foreground/80">
          Yerleşim denetimi — {sayi(sonuc.audits.length)} birim
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          {hatali.length === 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">hepsi geçti</span>
          ) : (
            <span className="text-destructive">{hatali.length} birimde hata var</span>
          )}
          . Denetim yerleştiriciden bağımsızdır; yalnız çıkan koordinatlara bakar.
        </p>
        <ul className="grid gap-2 text-sm">
          {sonuc.audits.map((a) => (
            <li key={a.code}>
              <span className="font-mono font-semibold">{a.code}</span>
              <ul className="ml-4 text-xs">
                {a.result.checks.map((c) => (
                  <li key={c.key} className={c.ok ? "text-muted-foreground" : "text-destructive"}>
                    {c.ok ? "✓" : "✗"} {c.label} — {c.detail}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {kovalar.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="oc-kicker mb-1 text-foreground/80">Panoya girmeyenler</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Bunlar eksik değil: vincin üstünde duran ya da malzeme satırı açılmamış aygıtlar. Sipariş
            listesinde yer alır, pano çiziminde almaz.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {kovalar.map(({ sebep, liste }) => (
              <div key={sebep} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{KUYRUK_ADI[sebep]}</span>
                  <Badge variant="outline">{sayi(liste.length)}</Badge>
                </div>
                <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{KUYRUK_ACIKLAMA[sebep]}</p>
                <ul className="grid gap-1 text-xs text-muted-foreground">
                  {liste.slice(0, 12).map((u, i) => (
                    <li key={`${u.device.key}-${i}`} className="truncate" title={u.note}>
                      <span className="font-mono">
                        {u.device.panelCode}-{u.device.label}
                      </span>{" "}
                      {u.device.supplier} {u.device.typeNo}
                    </li>
                  ))}
                  {liste.length > 12 && <li>… {sayi(liste.length - 12)} satır daha</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {sonuc.excluded.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pano sayılmayan konumlar (yerleşecek aygıtı yok):{" "}
          {sonuc.excluded.map((e) => `${e.code} (${e.devices})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
