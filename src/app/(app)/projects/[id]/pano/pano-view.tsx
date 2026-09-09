"use client";

// PANO YERLEŞİMİ EKRANI — üst bar ve beş bölüm.
//
// Ekran sekiz yığılmış bölümdü ve şemalar yüzünden çok uzundu; kullanıcı
// (08.09.2026) "sayfa aşağı doğru gitmesin, daha çok sayfa içinde bölümler
// olsun" dedi. Bölümler: Özet · Dizilim · Panolar · Denetim · Aygıt kuyruğu.
// İÇ YERLEŞİM AYRI SAYFADADIR (`pano/ic`) — aynı isteğin ikinci yarısı.
//
// ÖLÇÜ SEÇİCİLERİ ADRESE YAZAR, veritabanına değil: kullanıcı bir yüksekliği
// deneyip bakabilmeli ve denemesi bir karar sayılmamalıdır. Kalıcı olan tek
// şey "Onayla"dır (PANO-14).

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CircleAlert,
  Download,
  FileText,
  LayoutGrid,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  TriangleAlert,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import { panoDizilimDiagram } from "@/lib/diagrams/panoLayout";
import {
  PANEL_BASE_HEIGHTS_MM,
  PANEL_DEPTHS_MM,
  PANEL_HEIGHTS_MM,
  PANEL_WIDTHS_MM,
} from "@/lib/switchboard/sizes";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { PanelOverride, Unplaced } from "@/lib/switchboard/types";
import type { SwitchboardApproval } from "@/lib/switchboard-data";
import {
  approveLayout,
  resetPlacements,
  saveLayoutSettings,
  savePanel,
  unlockPanel,
  withdrawApproval,
} from "./actions";
import { PanoBolumBari, type PanoBolumu } from "./pano-bolum-bari";
import {
  Baslik,
  KUYRUK_ACIKLAMA,
  KUYRUK_ADI,
  KUYRUK_SIRASI,
  KUYRUK_SORUN,
  OlcuDiyalogu,
  OlcuGrubu,
  Secici,
  SemaKabi,
  sayi,
} from "./parcalar";

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
  // SEKME YEREL DURUMDUR, ADRESTE DEĞİL — gerekçe `pano-bolum-bari.tsx`te.
  const [bolum, setBolum] = useState<PanoBolumu>("ozet");

  const panolar = useMemo(() => [...sonuc.room, ...sonuc.field], [sonuc]);
  const kararMap = useMemo(
    () => new Map(panoKararlari.map((p) => [p.code, p])),
    [panoKararlari]
  );

  // ONAY ESKİDİ Mİ? Plan saklanmadığı için "neyi onayladım" sorusunun cevabı
  // parmak izidir; tutmuyorsa kullanıcı eski bir belgeye göre sipariş vermesin.
  const onayEskidi = Boolean(onay && onay.inputFingerprint !== sonuc.fingerprint);

  // ÖNEM SIRASI, İLK GÖRÜLME SIRASI DEĞİL: gerçek eksikler önce (PANO-30).
  const kuyruklar = useMemo(() => {
    const m = new Map<Unplaced["reason"], Unplaced[]>();
    for (const sebep of KUYRUK_SIRASI) {
      const liste = sonuc.unplaced.filter((u) => u.reason === sebep);
      if (liste.length > 0) m.set(sebep, liste);
    }
    // SIRALAMADA UNUTULAN SEBEP KAYBOLMAZ. Yeni bir `UnplacedReason` eklenip
    // sıraya yazılmazsa o kuyruk ekrandan silinirdi — bir aygıtın sessizce
    // kaybolması, bu modülün en çok kaçındığı şeydir (PANO-10).
    for (const u of sonuc.unplaced) {
      if (!m.has(u.reason)) {
        m.set(u.reason, sonuc.unplaced.filter((x) => x.reason === u.reason));
      }
    }
    return m;
  }, [sonuc.unplaced]);

  const hataliDenetim = sonuc.audits.filter((a) => !a.result.ok);

  /** İç yerleşim sayfasının sorgusu: seçili pano + kullanıcının denemeleri. */
  function icSorgusu(kod: string): string {
    const p = new URLSearchParams(arama.toString());
    p.set("pano", kod);
    return p.toString();
  }

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

      <PanoBolumBari
        bolum={bolum}
        onBolum={setBolum}
        sayaclar={{
          panolar: panolar.length,
          denetim: hataliDenetim.length,
          kuyruk: sonuc.unplaced.length,
        }}
        icHref={
          panolar.length
            ? `/projects/${projectId}/pano/ic?${icSorgusu(panolar[0].code)}`
            : null
        }
      />

      {bolum === "ozet" && (
        <>
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

          {/* İKİ DİZİ, İKİ AYRI ÖLÇÜ GRUBU (kullanıcı kararı 08.09.2026):
              "oda panosu ile saha pano ölçüleri birbirine bağlı değil, tamamen
              ayrı." Boş dizinin grubu GÖSTERİLMEZ — var olmayan bir panonun
              ölçüsünü sormak, kâğıda basılan yanlış sayının ekrandaki hâlidir. */}
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            {sonuc.roomSize.panelCount > 0 && (
              <OlcuGrubu
                baslik="Elektrik odası"
                onek="oda"
                tercih={sonuc.settings.room}
                cozulen={sonuc.roomSize}
                onChange={adresYaz}
              />
            )}
            {sonuc.fieldSize.panelCount > 0 && (
              <OlcuGrubu
                baslik="Saha panoları"
                onek="saha"
                tercih={sonuc.settings.field}
                cozulen={sonuc.fieldSize}
                onChange={adresYaz}
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* ÖLÇÜ SEÇİMİ ONAYDAN BAĞIMSIZ KAYDEDİLİR (PANO-34).
              Düğme HER ZAMAN durur: ekrandaki ölçü ne ise o kaydedilir. Yalnız
              adreste deneme varken göstermek, bir seçimi "Otomatik"e geri
              çevirip kaydetmeyi imkânsız kılardı — geri alma da bir karardır. */}
          {canEdit && (
            <Button
              size="sm"
              disabled={bekle}
              onClick={() =>
                void calistir(
                  () =>
                    saveLayoutSettings(projectId, {
                      room: sonuc.settings.room,
                      field: sonuc.settings.field,
                    }),
                  "Ölçü tercihleri kaydedildi. Onay varsa parmak izi değiştiği için eskir."
                )
              }
              title="Yükseklik / derinlik / baza seçimini projeye kaydeder. Onaylamaz."
            >
              <Save className="size-3.5" /> Ölçüleri Kaydet
            </Button>
          )}
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
          {/* ÖLÇÜ DEFTERİ BURADAN DA AÇILIR: kuyrukta ölçüsüz bir cihaz gören
              kullanıcı, defteri doldurmak için elektrik kartına geri dönmek
              zorunda kalmamalı. Sayaç düğmenin üstündedir — kaç ürünün
              beklediği düğmeye basmadan görünür. */}
          <Button size="sm" variant="outline" asChild>
            <Link href={`/projects/${projectId}/pano/defter`}>
              <BookOpen className="size-3.5" /> Ölçü Defteri
              {sonuc.estimatedCount > 0 && (
                <span className="ml-1 rounded bg-amber-500/15 px-1 font-mono text-[10px] text-amber-700 dark:text-amber-400">
                  {sayi(sonuc.estimatedCount)}
                </span>
              )}
            </Link>
          </Button>
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
        </>
      )}

      {bolum === "dizilim" && (
        <>
      {/* ————————————————————————————————————— dizilim şemaları */}
      {sonuc.room.length > 0 && (
        <SemaKabi>
          <DiagramSvg
            diagram={panoDizilimDiagram({
              panels: sonuc.room,
              baslik: "Pano dizilimi",
              not: `${sonuc.room.length} göz · ön görünüş · panolar bitişik`,
              yanCihazlar: sonuc.roomSideDevices,
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
              yanCihazlar: sonuc.fieldSideDevices,
            })}
            themeAware
          />
        </SemaKabi>
      )}
        </>
      )}

      {bolum === "panolar" && (
        <>
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
                      ""
                    }`}
                  >
                    <td className="truncate px-3 py-2" data-label="Kod">
                      {/* PANO KODU İÇ YERLEŞİM SAYFASINA GÖTÜRÜR. Deneme
                          ölçüleri (`?odaYukseklik=` …) sorguda taşınır: aksi
                          hâlde kullanıcının kaydetmediği denemesi sayfa
                          değişince sessizce geri alınırdı. */}
                      <Link
                        href={`/projects/${projectId}/pano/ic?${icSorgusu(p.code)}`}
                        className="oc-tap font-mono font-semibold underline decoration-dotted underline-offset-4 hover:decoration-solid"
                      >
                        {p.code}
                        {/* ALT ÇİZGİ KALICIDIR. Yalnız `hover:underline` iken
                            dokunmatikte hiçbir işaret yoktu ve kullanıcı iç
                            yerleşim sayfasını bulamadı (09.09.2026). */}
                        <span aria-hidden className="ml-1 text-xs font-sans">
                          →
                        </span>
                      </Link>
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
              derinlik {sayi(sonuc.roomSize.depthMm ?? 0)} mm · baza{" "}
              {sayi(sonuc.settings.room.baseMm)} mm.{" "}
            </>
          )}
          {/* SAHADA ORTAK YÜKSEKLİK YOKTUR (PANO-33). "Ortak yükseklik 800 mm"
              yazmak, alınmamış bir kararı bildirmek olurdu: kutuların boyu
              300'den 1400'e kadar ayrı ayrı seçilir, ortak olan yalnız
              derinliktir. */}
          {sonuc.fieldSize.panelCount > 0 && (
            <>
              Saha dizisi:{" "}
              {sonuc.fieldSize.sharedHeight
                ? `ortak yükseklik ${sayi(sonuc.fieldSize.heightMm ?? 0)} mm`
                : `yükseklik kutu başına (en yüksek ${sayi(sonuc.fieldSize.heightMm ?? 0)} mm)`}{" "}
              · ortak derinlik {sayi(sonuc.fieldSize.depthMm ?? 0)} mm · baza{" "}
              {sayi(sonuc.settings.field.baseMm)} mm.{" "}
            </>
          )}
          Elle seçilen bir ölçü KİLİTLENİR ve “Yeniden Yerleştir” onu ezmez.
        </p>
      </section>
        </>
      )}

      {bolum === "denetim" && (
        <>
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
        </>
      )}

      {bolum === "kuyruk" && (
        <>
      {/* ————————————————————————————————————— kuyruklar */}
      {sonuc.unplaced.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="oc-kicker mb-3 text-foreground/80">
            Panoya girmeyen aygıtlar ({sayi(sonuc.unplaced.length)})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {[...kuyruklar.entries()].map(([sebep, liste]) => (
              <div
                key={sebep}
                className={`rounded-md border p-3 ${
                  KUYRUK_SORUN[sebep] ? "border-amber-500/40 bg-amber-500/5" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{KUYRUK_ADI[sebep]}</span>
                  <Badge variant={KUYRUK_SORUN[sebep] ? "destructive" : "outline"}>
                    {sayi(liste.length)}
                  </Badge>
                </div>
                {/* HER KUYRUĞUN GEREKÇESİ YAZILIR. "Panoya girmeyen aygıtlar"
                    beş ayrı şeyi topluyordu ve kullanıcı buna bakınca "modül
                    eksik" gördü; oysa çoğu satır DOĞRU davranıştır. */}
                <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                  {KUYRUK_ACIKLAMA[sebep]}
                </p>
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
        </>
      )}

    </main>
  );
}
