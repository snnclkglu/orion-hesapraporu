"use client";

// PANO YERLEŞİMİ EKRANI.
//
// Şema salt görüntü DEĞİLDİR: bir cihaza tıklamak onu seçer ve sağdaki form o
// aygıtı düzenler. Sürükle-bırak yerine tıkla-seç seçildi çünkü uygulamada hiç
// pan/zoom altyapısı yok ve diyagramlar KÜÇÜLMEZ, kaydırılır (MOBIL-9);
// sürüklenen bir cihazın hedef rayı dar ekranda görünmezdi.
//
// ÖLÇÜ SEÇİCİLERİ ADRESE YAZAR, veritabanına değil: kullanıcı bir yüksekliği
// deneyip bakabilmeli ve denemesi bir karar sayılmamalıdır. Kalıcı olan tek
// şey "Onayla"dır.

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
import type { PanelLayout, PanelOverride, Unplaced } from "@/lib/switchboard/types";
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

const KUYRUK_ADI: Record<Unplaced["reason"], string> = {
  olcusuz: "Ölçüsü yok",
  siniflanmamis: "Sınıflanmamış",
  sigmadi: "Yerleşmedi",
  etiketsiz: "Etiketsiz satır",
  saha: "Pano dışı (saha)",
};

function sayi(v: number): string {
  return v.toLocaleString("tr-TR");
}

export function PanoView({
  projectId,
  docNo,
  projectName,
  canEdit,
  belgeVar,
  belgeAdi,
  belgeRevizyon,
  okunduMu,
  parcaSayisi,
  sonuc,
  panoKararlari,
  onay,
}: {
  projectId: string;
  docNo: string;
  projectName: string;
  canEdit: boolean;
  belgeVar: boolean;
  belgeAdi: string;
  belgeRevizyon: string;
  okunduMu: boolean;
  parcaSayisi: number;
  sonuc: ComputeResult;
  panoKararlari: PanelOverride[];
  onay: SwitchboardApproval | null;
}) {
  const router = useRouter();
  const arama = useSearchParams();
  const [bekle, basla] = useTransition();
  const [secilenPano, setSecilenPano] = useState<string>(
    sonuc.room[0]?.code ?? sonuc.field[0]?.code ?? ""
  );
  const [secilenAygit, setSecilenAygit] = useState<string>("");

  const panolar = useMemo(() => [...sonuc.room, ...sonuc.field], [sonuc]);
  const aktif = panolar.find((p) => p.code === secilenPano) ?? panolar[0] ?? null;
  const kararMap = useMemo(
    () => new Map(panoKararlari.map((p) => [p.code, p])),
    [panoKararlari]
  );

  // ONAY ESKİDİ Mİ? Plan saklanmadığı için "neyi onayladım" sorusunun cevabı
  // parmak izidir; tutmuyorsa kullanıcı eski bir belgeye göre sipariş vermesin.
  const onayEskidi = Boolean(onay && onay.inputFingerprint !== sonuc.fingerprint);

  const kuyruklar = useMemo(() => {
    const m = new Map<Unplaced["reason"], Unplaced[]>();
    for (const u of sonuc.unplaced) {
      const l = m.get(u.reason);
      if (l) l.push(u);
      else m.set(u.reason, [u]);
    }
    return m;
  }, [sonuc.unplaced]);

  const hataliDenetim = sonuc.audits.filter((a) => !a.result.ok);

  function adresYaz(anahtar: string, deger: string) {
    const p = new URLSearchParams(arama.toString());
    if (deger) p.set(anahtar, deger);
    else p.delete(anahtar);
    basla(() => router.replace(`?${p.toString()}`, { scroll: false }));
  }

  async function calistir(is: () => Promise<{ ok: true } | { error: string }>, basarili: string) {
    const sonuc = await is();
    if ("error" in sonuc) toast.error(sonuc.error);
    else {
      toast.success(basarili);
      router.refresh();
    }
  }

  const bitti = () => router.refresh();

  if (!belgeVar || !okunduMu || parcaSayisi === 0) {
    return (
      <main className="grid gap-4 p-4 md:p-6">
        <Baslik docNo={docNo} projectName={projectName} projectId={projectId} />
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {!belgeVar
            ? "Bu projeye henüz elektrik projesi yüklenmemiş. Pano yerleşimi, EPLAN malzeme listesinden üretilir."
            : !okunduMu
              ? "Elektrik projesi yüklü ama okunmamış. Elektrik Projesi sekmesinden “Yeniden Oku” deyin."
              : "Elektrik projesinde malzeme satırı bulunamadı; yerleşecek aygıt yok."}
        </div>
      </main>
    );
  }

  return (
    <main className="grid gap-5 p-4 md:p-6">
      <Baslik docNo={docNo} projectName={projectName} projectId={projectId} />

      {/* ————————————————————————————————————— özet şeridi */}
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">
                {sonuc.room.length} oda panosu · {sonuc.field.length} saha panosu
              </h2>
              {belgeRevizyon && (
                <Badge variant="outline" className="font-mono uppercase">
                  {belgeRevizyon}
                </Badge>
              )}
              {onay && !onayEskidi && (
                <Badge variant="secondary">
                  <ShieldCheck className="size-3" /> Onaylı
                </Badge>
              )}
              {onayEskidi && (
                <Badge variant="destructive">
                  <TriangleAlert className="size-3" /> Onay eskidi
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {belgeAdi} · {sayi(parcaSayisi)} aygıt satırı · toplam en{" "}
              {sayi(sonuc.room.reduce((t, p) => t + p.widthMm, 0))} mm (oda)
              {sonuc.field.length > 0 &&
                ` · ${sayi(sonuc.field.reduce((t, p) => t + p.widthMm, 0))} mm (saha)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OlcuSecici
              etiket="Yükseklik"
              deger={sonuc.settings.heightMm}
              cozulen={sonuc.roomSize.heightMm ?? sonuc.fieldSize.heightMm}
              secenekler={PANEL_HEIGHTS_MM}
              onChange={(v) => adresYaz("yukseklik", v)}
            />
            <OlcuSecici
              etiket="Derinlik"
              deger={sonuc.settings.depthMm}
              cozulen={sonuc.roomSize.depthMm ?? sonuc.fieldSize.depthMm}
              secenekler={PANEL_DEPTHS_MM}
              onChange={(v) => adresYaz("derinlik", v)}
            />
            <OlcuSecici
              etiket="Baza"
              deger={sonuc.settings.baseMm}
              secenekler={PANEL_BASE_HEIGHTS_MM}
              onChange={(v) => adresYaz("baza", v)}
              zorunlu
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              disabled={bekle}
              onClick={() =>
                void calistir(() => resetPlacements(projectId), "Yerleşim yeniden kuruldu.")
              }
              title="Aygıt düzeltmelerini bırakır; sabitlenmiş satırlar ve pano gövde seçimleri korunur."
            >
              <RefreshCw className="size-3.5" /> Yeniden Yerleştir
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/pano/svg${arama.toString() ? `?${arama}` : ""}`}>
              <Download className="size-3.5" /> SVG
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/pano/pdf${arama.toString() ? `?${arama}` : ""}`}>
              <FileText className="size-3.5" /> PDF
            </a>
          </Button>

          {canEdit &&
            (onay && !onayEskidi ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={bekle}
                onClick={() => void calistir(() => withdrawApproval(projectId), "Onay kaldırıldı.")}
              >
                Onayı Kaldır
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={bekle}
                onClick={() =>
                  void calistir(
                    () => approveLayout(projectId, sonuc.fingerprint, sonuc.settings),
                    "Yerleşim onaylandı."
                  )
                }
              >
                <ShieldCheck className="size-3.5" /> Onayla
              </Button>
            ))}

          <span className="ml-auto flex items-center gap-2 text-xs">
            <span
              className={
                sonuc.estimatedCount > 0
                  ? "font-semibold text-destructive"
                  : "text-muted-foreground"
              }
            >
              Ölçüsü doğrulanmamış: {sayi(sonuc.estimatedCount)} aygıt
            </span>
          </span>
        </div>

        {onayEskidi && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            Onaydan sonra girdi değişti (elektrik projesi yeniden okundu ya da bir ölçü
            düzeltildi). İmalatçıya giden belge bu ekrandaki planla artık aynı olmayabilir —
            yeniden gözden geçirip onaylayın.
          </p>
        )}
        {sonuc.estimatedCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Bu ölçüler kural tabanlı TAHMİNDİR ve şemada taralı çizilir. Sipariş vermeden önce
            bu sayının sıfıra inmesi gerekir.
          </p>
        )}
      </section>

      {/* ————————————————————————————————————— dizilim şemaları */}
      {sonuc.room.length > 0 && (
        <SemaKabi>
          <DiagramSvg
            diagram={panoDizilimDiagram({
              panels: sonuc.room,
              baslik: "Elektrik odası pano dizilimi",
              not: `${sonuc.room.length} göz · ön görünüş · panolar bitişik`,
            })}
            themeAware
          />
        </SemaKabi>
      )}
      {sonuc.field.length > 0 && (
        <SemaKabi>
          <DiagramSvg
            diagram={panoDizilimDiagram({
              panels: sonuc.field,
              baslik: "Saha panoları",
              not: `${sonuc.field.length} göz · elektrik odasına girmez`,
            })}
            themeAware
          />
        </SemaKabi>
      )}

      {/* ————————————————————————————————————— pano listesi */}
      <section className="rounded-lg border bg-card">
        <h3 className="oc-kicker border-b px-4 py-3 text-foreground/80">Panolar</h3>
        <div className="overflow-hidden">
          <table className="oc-tablet-table w-full table-fixed text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-[16%] px-3 py-2">Kod</th>
                <th className="w-[10%] px-3 py-2">Tür</th>
                <th className="w-[12%] px-3 py-2">En</th>
                <th className="w-[10%] px-3 py-2">Kapak</th>
                <th className="w-[10%] px-3 py-2">Ray</th>
                <th className="w-[10%] px-3 py-2">Cihaz</th>
                <th className="w-[10%] px-3 py-2">Doluluk</th>
                <th className="w-[22%] px-3 py-2">Uyarı</th>
              </tr>
            </thead>
            <tbody>
              {panolar.map((p) => {
                const karar = kararMap.get(p.code);
                return (
                  <tr
                    key={p.code}
                    className={`border-b last:border-0 ${
                      p.code === aktif?.code ? "bg-muted/40" : ""
                    }`}
                  >
                    <td className="truncate px-3 py-2" data-label="Kod">
                      <button
                        type="button"
                        className="oc-tap font-mono font-semibold underline-offset-2 hover:underline"
                        onClick={() => setSecilenPano(p.code)}
                      >
                        {p.code}
                      </button>
                      {p.splitOf && (
                        <span className="ml-1 text-xs text-muted-foreground">({p.splitOf})</span>
                      )}
                    </td>
                    <td className="px-3 py-2" data-label="Tür">
                      <Secici
                        deger={p.kind}
                        secenekler={[
                          ["oda", "Oda"],
                          ["saha", "Saha"],
                          ["haric", "Pano değil"],
                        ]}
                        etiket={`${p.code} türü`}
                        pasif={!canEdit || bekle}
                        onChange={(v) =>
                          void calistir(
                            () =>
                              savePanel({
                                projectId,
                                code: p.code,
                                name: karar?.name ?? "",
                                kind: v as "oda" | "saha" | "haric",
                                widthMm: karar?.widthMm ?? null,
                                heightMm: karar?.heightMm ?? null,
                                depthMm: karar?.depthMm ?? null,
                                baseMm: karar?.baseMm ?? null,
                                doorConfig: karar?.doorConfig ?? null,
                                orderIndex: karar?.orderIndex ?? null,
                                note: karar?.note ?? "",
                              }),
                            "Pano türü değişti."
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2" data-label="En">
                      <div className="flex items-center gap-1">
                        <Secici
                          deger={p.widthLocked ? String(p.widthMm) : ""}
                          bosEtiket={`${sayi(p.widthMm)} (otomatik)`}
                          secenekler={PANEL_WIDTHS_MM.map((w) => [String(w), `${sayi(w)} mm`])}
                          etiket={`${p.code} eni`}
                          pasif={!canEdit || bekle}
                          onChange={(v) =>
                            void calistir(
                              () =>
                                savePanel({
                                  projectId,
                                  code: p.code,
                                  name: karar?.name ?? "",
                                  kind: karar?.kind ?? null,
                                  widthMm: v ? Number(v) : null,
                                  heightMm: karar?.heightMm ?? null,
                                  depthMm: karar?.depthMm ?? null,
                                  baseMm: karar?.baseMm ?? null,
                                  doorConfig: karar?.doorConfig ?? null,
                                  orderIndex: karar?.orderIndex ?? null,
                                  note: karar?.note ?? "",
                                }),
                              "Pano eni değişti."
                            )
                          }
                        />
                        {p.widthLocked && canEdit && (
                          <button
                            type="button"
                            title="Kilidi kaldır — eni sistem seçsin"
                            className="oc-tap-square text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              void calistir(
                                () => unlockPanel(projectId, p.code),
                                "Gövde kilidi kaldırıldı."
                              )
                            }
                          >
                            <Lock className="size-3.5" />
                          </button>
                        )}
                        {!p.widthLocked && (
                          <Unlock className="size-3.5 shrink-0 text-muted-foreground/50" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2" data-label="Kapak">
                      <Secici
                        deger={p.doorConfig}
                        secenekler={[
                          ["tek", "Tek"],
                          ["cift", "Çift"],
                        ]}
                        etiket={`${p.code} kapağı`}
                        pasif={!canEdit || bekle || p.widthMm < 600}
                        onChange={(v) =>
                          void calistir(
                            () =>
                              savePanel({
                                projectId,
                                code: p.code,
                                name: karar?.name ?? "",
                                kind: karar?.kind ?? null,
                                widthMm: karar?.widthMm ?? null,
                                heightMm: karar?.heightMm ?? null,
                                depthMm: karar?.depthMm ?? null,
                                baseMm: karar?.baseMm ?? null,
                                doorConfig: v as "tek" | "cift",
                                orderIndex: karar?.orderIndex ?? null,
                                note: karar?.note ?? "",
                              }),
                            "Kapak seçimi değişti."
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums" data-label="Ray">
                      {p.rails.length}
                    </td>
                    <td className="px-3 py-2 tabular-nums" data-label="Cihaz">
                      {p.placements.length + p.doorPlacements.length}
                    </td>
                    <td className="px-3 py-2 tabular-nums" data-label="Doluluk">
                      %{Math.round(p.fillRatio * 100)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground" data-label="Uyarı">
                      {p.warnings.length === 0 ? (
                        "—"
                      ) : (
                        <span title={p.warnings.join("\n")} className="text-amber-600">
                          <CircleAlert className="mr-1 inline size-3" />
                          {p.warnings.length} uyarı
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* HER DİZİ KENDİ ÖLÇÜSÜNÜ BASAR: saha panoları elektrik odasına
            girmez ve ortak yükseklik/derinliği kendi içlerinde uzlaştırır
            (PANO-2). Tek sayı basmak, yalnız saha panosu olan bir projede hiç
            var olmayan bir odanın ölçüsünü gösteriyordu. */}
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {sonuc.roomSize.panelCount > 0 && (
            <>
              Oda dizisi: ortak yükseklik {sayi(sonuc.roomSize.heightMm ?? 0)} mm · ortak
              derinlik {sayi(sonuc.roomSize.depthMm ?? 0)} mm.{" "}
            </>
          )}
          {sonuc.fieldSize.panelCount > 0 && (
            <>
              Saha dizisi: ortak yükseklik {sayi(sonuc.fieldSize.heightMm ?? 0)} mm · ortak
              derinlik {sayi(sonuc.fieldSize.depthMm ?? 0)} mm.{" "}
            </>
          )}
          Baza {sayi(sonuc.settings.baseMm)} mm. Elle seçilen bir ölçü KİLİTLENİR ve
          “Yeniden Yerleştir” onu ezmez.
        </p>
      </section>

      {/* ————————————————————————————————————— seçili pano */}
      {aktif && (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="oc-kicker text-foreground/80">{aktif.code} iç yerleşimi</h3>
            <span className="text-xs text-muted-foreground">
              {sayi(aktif.widthMm)} × {sayi(aktif.heightMm)} × {sayi(aktif.depthMm)} mm ·{" "}
              {aktif.rails.length} ray · doluluk %{Math.round(aktif.fillRatio * 100)}
            </span>
          </div>

          {aktif.warnings.length > 0 && (
            <ul className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              {aktif.warnings.map((u) => (
                <li key={u}>· {u}</li>
              ))}
            </ul>
          )}

          <SemaKabi>
            <DiagramSvg
              diagram={panoIcYerlesimDiagram({ panel: aktif, settings: sonuc.settings })}
              themeAware
            />
          </SemaKabi>

          <KapakSemasi panel={aktif} settings={sonuc.settings} />

          {canEdit && secilenAygit && (
            <AygitFormu
              projectId={projectId}
              panel={aktif}
              deviceKey={secilenAygit}
              panolar={panolar}
              onBitti={bitti}
            />
          )}

          <CihazListesi
            panel={aktif}
            secilen={secilenAygit}
            onSec={setSecilenAygit}
          />
        </section>
      )}

      {/* ————————————————————————————————————— denetim */}
      <section className="rounded-lg border bg-card p-4">
        <h3 className="oc-kicker mb-2 text-foreground/80">Yerleşim denetimi</h3>
        {/* GEÇENLER DE LİSTELENİR (PANO-11). "Hepsi geçti" cümlesi neyin
            denetlendiğini söylemez; bir belgede denetimin değeri hangi
            soruların sorulduğunun görünmesindedir. */}
        <p className="mb-3 text-xs text-muted-foreground">
          {sonuc.audits.length} birim denetlendi ·{" "}
          {hataliDenetim.length === 0 ? (
            <span className="text-emerald-600 dark:text-emerald-400">hepsi geçti</span>
          ) : (
            <span className="text-destructive">{hataliDenetim.length} birimde hata var</span>
          )}
          . Denetim yerleştiriciden bağımsızdır ve yalnız çıkan koordinatlara bakar.
        </p>
        <ul className="grid gap-2 text-sm">
          {sonuc.audits.map((a) => (
            <li key={a.code}>
              <span className="font-mono font-semibold">{a.code}</span>
              <ul className="ml-4 text-xs">
                {a.result.checks.map((c) => (
                  <li
                    key={c.key}
                    className={c.ok ? "text-muted-foreground" : "text-destructive"}
                  >
                    {c.ok ? "✓" : "✗"} {c.label} — {c.detail}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* ————————————————————————————————————— kuyruklar */}
      {sonuc.unplaced.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="oc-kicker mb-3 text-foreground/80">
            Panoya girmeyen aygıtlar ({sayi(sonuc.unplaced.length)})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {[...kuyruklar.entries()].map(([sebep, liste]) => (
              <div key={sebep} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{KUYRUK_ADI[sebep]}</span>
                  <Badge variant="outline">{sayi(liste.length)}</Badge>
                </div>
                <ul className="grid gap-1 text-xs text-muted-foreground">
                  {liste.slice(0, 12).map((u, i) => (
                    <li
                      key={`${u.device.key}-${i}`}
                      className="flex items-center gap-2"
                      title={u.note}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-mono">
                          {u.device.panelCode}-{u.device.label}
                        </span>{" "}
                        {u.device.supplier} {u.device.typeNo}
                      </span>
                      {canEdit && u.device.typeNo && (
                        <OlcuDiyalogu projectId={projectId} device={u.device} onBitti={bitti} />
                      )}
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
    </main>
  );
}

// ═══════════════════════════════════════════════════════ küçük parçalar

function Baslik({
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

function SemaKabi({ children }: { children: React.ReactNode }) {
  return (
    <div className="oc-diagram-theme oc-scrollx overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
      {children}
    </div>
  );
}

function KapakSemasi({
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

function OlcuSecici({
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

function Secici({
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
function CihazListesi({
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
function OlcuDiyalogu({
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
function AygitFormu({
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
