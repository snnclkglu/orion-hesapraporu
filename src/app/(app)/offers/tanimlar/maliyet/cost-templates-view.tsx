"use client";

// VİNÇ TİPİ → MALİYET BÖLÜMLERİ VE KALEMLERİ.
//
// EKRAN İKİ SÜTUNDUR: solda vinç tipleri, sağda seçilen tipin bölümleri ve her
// bölümün kalemleri. Tek sütunlu bir liste, "Tek Kirişli Vinçte ne geliyor"
// sorusunu ancak yüzlerce satır kaydırdıktan sonra cevaplardı — kullanıcının
// istediği tam olarak KONTROL KOLAYLIĞIYDI (md. 10).
//
// KALEM ADLARI DEFTERDEN OKUNUR (`COST_GROUP_DEFS`), veritabanından değil.
// Şablon yalnız ANAHTAR saklar; ad, birim ve miktar kaynağı kodun malıdır.
// Kopyalansaydı deftere yeni bir kalem eklendiğinde bu ekran eski adı gösterir
// ve iki yer sessizce ayrışırdı.
//
// KUTUCUK İŞARETİ "AÇIK" DEMEKTİR, "seçili" değil: kullanıcı bir kalemi
// listeden çıkardığında YAPTIĞI ŞEY onu KAPATMAKTIR. Kapatma kayıtlı maliyet
// çalışmalarına dokunmaz — fiyatı girilmiş bir satır belgesinde kalır; şablon
// yalnız YENİ açılan kalemin iskeletini ve "Tekliften Tazele"nin neyi
// ekleyeceğini belirler.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import {
  resetOfferCostTemplate,
  saveOfferCostTemplate,
  setOfferCostTemplateActive,
  type CostTemplateResult,
} from "./actions";
import { trKatla } from "@/lib/drawings/tr-text";
import {
  COST_GROUP_DEFS,
  GENERAL_GROUP_KEY,
  defaultCostSkeleton,
} from "@/lib/offers/cost/registry";
import type { CostTemplateSkeleton } from "@/lib/offers/cost/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export interface CostTemplateRow {
  id: string;
  crane_type: string;
  skeleton: CostTemplateSkeleton | null;
  sort: number;
  active: boolean;
}

/** PROJE GENELİ vinç tipine bağlanamaz: kaleme değil BELGEYE aittir. */
const SECILEBILIR = COST_GROUP_DEFS.filter((g) => g.key !== GENERAL_GROUP_KEY);

const VARSAYILAN = defaultCostSkeleton();

/** Bir tipin defterdeki hâli — kayıt yoksa varsayılan. */
interface TipDurumu {
  craneType: string;
  skeleton: CostTemplateSkeleton;
  /** Defterde kendi satırı var mı (yoksa varsayılan uygulanır). */
  ozel: boolean;
  /** Satır var ama pasifse: kararı durur, uygulanmaz. */
  aktif: boolean;
}

function gruplar(s: CostTemplateSkeleton): string[] {
  const secili = s.groupKeys?.length ? s.groupKeys : (VARSAYILAN.groupKeys ?? []);
  // Sıra DEFTERİN sırasıdır; kaydedilmiş dizinin sırası bir belge düzeni değil.
  return SECILEBILIR.map((g) => g.key).filter((k) => secili.includes(k));
}

function kapali(s: CostTemplateSkeleton, groupKey: string): Set<string> {
  return new Set(s.closedLines?.[groupKey] ?? []);
}

/** Tipte açılacak kalem sayısı — ekranın tek özetidir. */
function kalemSayisi(s: CostTemplateSkeleton): number {
  return gruplar(s).reduce((toplam, key) => {
    const def = SECILEBILIR.find((g) => g.key === key);
    if (!def) return toplam;
    const k = kapali(s, key);
    return toplam + def.lines.filter((l) => !k.has(l.key)).length;
  }, 0);
}

export function CostTemplatesView({
  craneTypes,
  templates,
}: {
  /** `val.craneType` defterindeki etkin vinç tipleri. */
  craneTypes: string[];
  templates: CostTemplateRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [secili, setSecili] = useState<string | null>(craneTypes[0] ?? null);
  // YEREL TASLAK: kutucuk tıklandığı anda görünmelidir. Sunucu yanıtı
  // beklenip `router.refresh()` sonrasında çizilseydi, on üç kutucuklu bir
  // grupta her tık yarım saniye gecikirdi.
  const [yerel, setYerel] = useState<Record<string, CostTemplateSkeleton>>({});

  const satirlar = useMemo(() => {
    const map = new Map<string, CostTemplateRow>();
    for (const t of templates) map.set(trKatla(t.crane_type), t);
    return map;
  }, [templates]);

  // DEFTERDE OLUP TİP LİSTESİNDE OLMAYAN ŞABLON DA GÖRÜNÜR: teklif defterinden
  // pasife alınmış bir vinç tipinin şablonu ekrandan kaybolsaydı geri
  // açılamaz, "neden hâlâ uygulanıyor" sorusu cevapsız kalırdı.
  const tipler = useMemo(() => {
    const liste = [...craneTypes];
    const katlanmis = new Set(liste.map(trKatla));
    for (const t of templates) {
      if (!katlanmis.has(trKatla(t.crane_type))) liste.push(t.crane_type);
    }
    return liste;
  }, [craneTypes, templates]);

  function durum(craneType: string): TipDurumu {
    const anahtar = trKatla(craneType);
    const satir = satirlar.get(anahtar);
    const taslak = yerel[anahtar];
    return {
      craneType,
      skeleton: taslak ?? satir?.skeleton ?? VARSAYILAN,
      ozel: Boolean(satir),
      aktif: satir ? satir.active : true,
    };
  }

  function calistir(fn: () => Promise<CostTemplateResult>, basari?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (basari) toast.success(basari);
      router.refresh();
    });
  }

  /** Taslağı yereldeki hâline yazar ve deftere kaydeder. */
  function yaz(craneType: string, sonraki: CostTemplateSkeleton) {
    const anahtar = trKatla(craneType);
    setYerel((c) => ({ ...c, [anahtar]: sonraki }));
    calistir(() =>
      saveOfferCostTemplate({
        craneType,
        groupKeys: gruplar(sonraki),
        closedLines: sonraki.closedLines ?? {},
      })
    );
  }

  /** Yerel taslağı bırakır ki `router.refresh()` sonrası defterin hâli çizilsin. */
  function unut(craneType: string) {
    const anahtar = trKatla(craneType);
    setYerel((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== anahtar)));
  }

  if (tipler.length === 0) {
    return (
      <EmptyState
        title="VİNÇ TİPİ YOK"
        description="Teklif defterinde etkin bir vinç tipi bulunamadı. Önce Tanımlar → Defterler ekranından val.craneType listesini doldurun."
      />
    );
  }

  const acik = secili ? durum(secili) : null;

  return (
    <div className="grid gap-3">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Bir maliyet çalışması açıldığında teklif kaleminin vinç tipine göre BU bölümler ve
        kalemler kurulur. Buradaki değişiklik AÇILMIŞ maliyet çalışmalarına dokunmaz: bir
        kalemi kapatmak onu yeni belgelerde açmaz, kayıtlı belgelerden SİLMEZ.
      </p>

      {/* EKRAN BUGÜN NE OLDUĞUNU SÖYLER, NE OLACAĞINI DEĞİL. Şablonu okuyup
          maliyet çekirdeğine veren iki çağrı yeri henüz bağlanmamıştır:
          `offers/cost-actions.ts`teki `withOfferSync(...)` çağrıları (maliyet
          açılışı ve "Tekliften Tazele") şablon listesini dördüncü parametre
          olarak geçirmelidir; çekirdek tarafı (`costItemFromOfferItem`,
          `withOfferSync`) bunu ZATEN kabul ediyor. Bağlandığında bu uyarı
          silinir — yukarıdaki cümle o zaman doğru olur. Uyarıyı silmemek,
          ekranın kullanıcıya olmayan bir davranışı anlatması demekti. */}
      <p className="max-w-3xl border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-sm">
        <strong>HENÜZ UYGULANMIYOR.</strong> Bu ekran bugün hangi bölüm ve kalemlerin
        geldiğini GÖSTERİR ve kararınızı deftere yazar; maliyet çalışması açılırken
        uygulanması bir sonraki adımda bağlanacaktır.
      </p>

      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,16rem)_1fr] lg:items-start">
        <nav className="grid gap-0.5 rounded-lg border bg-card p-1" aria-label="Vinç tipleri">
          {tipler.map((tip) => {
            const d = durum(tip);
            const isaretli = secili === tip;
            return (
              <button
                key={tip}
                type="button"
                onClick={() => setSecili(tip)}
                aria-current={isaretli ? "true" : undefined}
                className={cn(
                  "oc-tap flex items-center justify-between gap-2 px-2 py-1.5 text-left text-sm transition-colors",
                  isaretli ? "bg-primary/10 font-medium text-foreground" : "hover:bg-muted"
                )}
              >
                <span className="min-w-0 truncate">{tip}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {d.ozel && !d.aktif ? "PASİF" : `${gruplar(d.skeleton).length}/${SECILEBILIR.length}`}
                </span>
              </button>
            );
          })}
        </nav>

        {acik && (
          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{acik.craneType}</h2>
                <p className="text-[12px] text-muted-foreground">
                  {gruplar(acik.skeleton).length} bölüm · {kalemSayisi(acik.skeleton)} kalem
                  {!acik.ozel && " · VARSAYILAN (defterde kendi satırı yok)"}
                  {acik.ozel && !acik.aktif && " · PASİF — bu tipte varsayılan uygulanır"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {acik.ozel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      unut(acik.craneType);
                      calistir(
                        () => setOfferCostTemplateActive(acik.craneType, !acik.aktif),
                        acik.aktif ? "Şablon pasife alındı." : "Şablon etkinleştirildi."
                      );
                    }}
                    title={
                      acik.aktif
                        ? "Pasife al — karar defterde kalır, bu tipte varsayılan uygulanır"
                        : "Etkinleştir — kaydedilmiş şablon yeniden uygulanır"
                    }
                  >
                    {acik.aktif ? "Pasife Al" : "Etkinleştir"}
                  </Button>
                )}
                {acik.ozel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      unut(acik.craneType);
                      calistir(
                        () => resetOfferCostTemplate(acik.craneType),
                        "Tip varsayılan kümeye döndü."
                      );
                    }}
                    title="Şablonu defterden kaldır — bu tip varsayılan bölüm kümesine döner"
                  >
                    <RotateCcw className="size-3.5" /> Varsayılana Dön
                  </Button>
                )}
              </div>
            </div>

            {SECILEBILIR.map((grup) => {
              const secililer = gruplar(acik.skeleton);
              const grupAcik = secililer.includes(grup.key);
              const kapatilan = kapali(acik.skeleton, grup.key);
              return (
                <section
                  key={grup.key}
                  className={cn(
                    "grid gap-2 rounded-lg border bg-card p-3",
                    !grupAcik && "bg-muted/30"
                  )}
                >
                  <label className="oc-tap flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={grupAcik}
                      disabled={pending}
                      onChange={(e) =>
                        yaz(acik.craneType, {
                          ...acik.skeleton,
                          groupKeys: e.target.checked
                            ? [...secililer, grup.key]
                            : secililer.filter((k) => k !== grup.key),
                        })
                      }
                      className="size-4 shrink-0"
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        !grupAcik && "text-muted-foreground"
                      )}
                    >
                      {grup.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {grup.lines.length - kapatilan.size}/{grup.lines.length} kalem
                    </span>
                  </label>

                  {grupAcik && (
                    // Sarmal küme: dar ekranda ikinci satıra iner, yatay
                    // kaydırma doğurmaz (MOBIL-15).
                    <div className="flex flex-wrap gap-1.5">
                      {grup.lines.map((satir) => {
                        const acikSatir = !kapatilan.has(satir.key);
                        return (
                          <label
                            key={satir.key}
                            title={satir.hint}
                            className={cn(
                              "oc-tap inline-flex cursor-pointer items-center gap-1.5 border px-2 py-1 text-[12px] transition-colors",
                              acikSatir
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:border-primary"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={acikSatir}
                              disabled={pending}
                              onChange={(e) => {
                                const sonraki = new Set(kapatilan);
                                if (e.target.checked) sonraki.delete(satir.key);
                                else sonraki.add(satir.key);
                                yaz(acik.craneType, {
                                  ...acik.skeleton,
                                  groupKeys: secililer,
                                  closedLines: {
                                    ...(acik.skeleton.closedLines ?? {}),
                                    [grup.key]: [...sonraki],
                                  },
                                });
                              }}
                              className="size-3.5"
                            />
                            {satir.label}
                            <span className="text-muted-foreground">{satir.unit}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            <p className="text-[12px] text-muted-foreground">
              PROJE GENELİ bölümü bu listede yoktur: dokümantasyon, fabrika testleri ve
              paketleme bir vince değil BELGEYE aittir — üç vinçlik bir teklifte bir kez
              yapılır. YARDIMCI KALDIRMA GRUBU işaretlenmemiş olsa da teklif kaleminde o
              bölüm varsa açılır; ikinci bir kaldırma mekanizmasının maliyeti bir şablon
              ayarı yüzünden sorulmadan geçilemez.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
