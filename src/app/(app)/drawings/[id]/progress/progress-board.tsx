"use client";

// Atölye tahtası — üretim durumunun girildiği ekran.
//
// ASIL KULLANICI ATÖLYEDE TELEFONDAN BAKIYOR. Bu ekran bir rapor değil bir
// GİRİŞ yüzeyidir: foreman elinde telefonla tezgâhın yanında durur ve "bunlar
// kesildi" der. Tasarımın tamamı o ana göre kurulmuştur:
//
// · Tek dokunuş bir aşamayı TAM işaretler. Adet, tarih ve not ikinci dokunuşun
//   arkasındadır — çoğu durumda parçanın tamamı birlikte kesilir ve her seferde
//   adet sormak ekranı kullanılamaz yapardı.
// · Gruplar VARSAYILAN OLARAK KAPALIDIR. 261 parça × 6 çip ~1000 DOM düğümü
//   eder; foreman zaten tek bir grupla çalışır ve onu açar.
// · SATIN ALMA BURADA DEĞİL. Kodsuz kalemler ve satın alma yapısındaki kodlu
//   satırlar `/purchasing`e taşındı, `satinalindi` çipi de bu tahtada yok
//   (`productionStages`): sipariş kaydı tezgâhın değil satınalmanın işidir.
// · Toplu işaretleme ŞART. 261 parçayı tek tek işaretlemek kullanılamaz bir
//   ekran olurdu; seçim + yapışkan şerit bunu tek harekete indirir.
// · Öneri kartı SUÇLAMAZ ve ipucunun bir kanıt olmadığını açıkça yazar.
//   Ressamın klasör adı bir delil değil, bir izdir.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tagStyle } from "@/lib/tags";
import { formatNum } from "@/lib/drawings/labels";
import { trKatla } from "@/lib/drawings/tr-text";
import {
  groupOwnPart,
  packageProgress,
  partProgress,
  type ProgressMark,
  type StageDef,
  type StageSuggestion,
  type TrackedPart,
} from "@/lib/drawings/progress";
import { setReviewMark } from "../../actions";
import { applyFolderSuggestion, markStage, setPartStage } from "./actions";

/** İşaret haritası: anahtar → aşama → işaretlenen adet (0 = adet girilmemiş). */
type Isaretler = Record<string, Record<string, number>>;

function isaretHaritasi(marks: readonly ProgressMark[]): Isaretler {
  const harita: Isaretler = {};
  for (const m of marks) {
    (harita[m.key] ??= {})[m.stage] = Number.isFinite(m.qtyDone) ? m.qtyDone : 0;
  }
  return harita;
}

function duzlestir(harita: Isaretler): ProgressMark[] {
  const liste: ProgressMark[] = [];
  for (const [key, asamalar] of Object.entries(harita)) {
    for (const [stage, qtyDone] of Object.entries(asamalar)) liste.push({ key, stage, qtyDone });
  }
  return liste;
}

export function ProgressBoard({
  packageId,
  stages,
  coded,
  groupNames,
  marks,
  suggestions,
  orphans,
  canWrite,
  ledgerMissing,
}: {
  packageId: string;
  /** Satın alma aşaması HARİÇ — o çip Satın Alma bölümündedir. */
  stages: StageDef[];
  /** Yalnız imalat/montaj parçaları; satın alınanlar kendi bölümünde. */
  coded: TrackedPart[];
  /**
   * Kısa grup kodu → ad ("0100" → "ANA KİRİŞ"). Defterden gelir
   * (`drawing_group_names`), burada ÜRETİLMEZ; adı çözülemeyen grup listede
   * hiç yoktur ve başlık yalnız kodunu gösterir.
   */
  groupNames: Record<string, string>;
  marks: ProgressMark[];
  suggestions: StageSuggestion[];
  orphans: ProgressMark[];
  canWrite: boolean;
  /** Aşama defteri tablosu henüz kurulmamış — yedek sözlükle çalışıyoruz. */
  ledgerMissing: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();

  // ————————————————————————————————— iyimser durum
  // Sunucu yanıtı beklenmeden çip boyanır; `router.refresh()` sonrası gelen
  // yeni prop imzası durumu yeniden kurar. İmza karşılaştırması olmadan her
  // yeniden çizim uçuştaki iyimser değişikliği geri alırdı.
  const sunucuImza = useMemo(
    () =>
      marks
        .map((m) => `${m.key}|${m.stage}|${m.qtyDone}`)
        .sort()
        .join(";"),
    [marks]
  );
  const [durum, setDurum] = useState<Isaretler>(() => isaretHaritasi(marks));
  const sonImza = useRef(sunucuImza);
  useEffect(() => {
    if (sonImza.current === sunucuImza) return;
    sonImza.current = sunucuImza;
    setDurum(isaretHaritasi(marks));
  }, [sunucuImza, marks]);

  const etkinIsaretler = useMemo(() => duzlestir(durum), [durum]);

  // Tarih ve not SUNUCUDAN gelir ve iyimser duruma girmez: onlar yalnız adet
  // penceresinden yazılır ve o pencere zaten `router.refresh()` ile kapanır.
  // İyimser haritada taşımak, tek dokunuşluk bir çip için üç alanı da kopyalamak
  // demekti ve ilk yazma hiçbirini bilmiyor.
  const ayrintilar = useMemo(() => {
    const h = new Map<string, { doneAt: string; note: string }>();
    for (const m of marks) {
      h.set(`${m.key}|${m.stage}`, { doneAt: m.doneAt ?? "", note: m.note ?? "" });
    }
    return h;
  }, [marks]);
  const isaretHarita = useMemo(() => {
    const h = new Map<string, ProgressMark[]>();
    for (const m of etkinIsaretler) {
      const l = h.get(m.key);
      if (l) l.push(m);
      else h.set(m.key, [m]);
    }
    return h;
  }, [etkinIsaretler]);

  const ozet = useMemo(
    () => packageProgress(coded, etkinIsaretler, stages),
    [coded, etkinIsaretler, stages]
  );

  // ————————————————————————————————— süzgeç
  const [arama, setArama] = useState("");
  const [yalnizBaslanmamis, setYalnizBaslanmamis] = useState(false);
  const [asamaSuzgeci, setAsamaSuzgeci] = useState("");

  const aramaAnahtari = arama.trim() ? trKatla(arama) : "";

  function suzgectenGecer(p: TrackedPart): boolean {
    if (aramaAnahtari) {
      const alan = trKatla(`${p.partCode} ${p.label} ${p.category} ${p.material}`);
      if (!alan.includes(aramaAnahtari)) return false;
    }
    const isaretli = isaretHarita.get(p.key) ?? [];
    if (yalnizBaslanmamis && isaretli.length > 0) return false;
    if (asamaSuzgeci && !isaretli.some((m) => m.stage === asamaSuzgeci)) return false;
    return true;
  }

  const suzulmusKodlu = useMemo(
    () => coded.filter(suzgectenGecer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coded, aramaAnahtari, yalnizBaslanmamis, asamaSuzgeci, isaretHarita]
  );

  const gruplar = useMemo(() => {
    const g = new Map<string, TrackedPart[]>();
    for (const p of suzulmusKodlu) {
      const liste = g.get(p.group);
      if (liste) liste.push(p);
      else g.set(p.group, [p]);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [suzulmusKodlu]);

  // ————————————————————————————————— açılır gruplar ve seçim
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [secili, setSecili] = useState<Set<string>>(new Set());

  function grupCevir(ad: string) {
    setAcik((o) => {
      const y = new Set(o);
      if (y.has(ad)) y.delete(ad);
      else y.add(ad);
      return y;
    });
  }

  function secimCevir(key: string) {
    setSecili((o) => {
      const y = new Set(o);
      if (y.has(key)) y.delete(key);
      else y.add(key);
      return y;
    });
  }

  function grupSec(parcalar: TrackedPart[], sec: boolean) {
    setSecili((o) => {
      const y = new Set(o);
      for (const p of parcalar) {
        if (sec) y.add(p.key);
        else y.delete(p.key);
      }
      return y;
    });
  }

  // ————————————————————————————————— yazma
  function yaz(
    anahtarlar: string[],
    stage: string,
    mode: "isaretle" | "kaldir",
    adetler?: Map<string, number | null>
  ) {
    if (!canWrite) return;
    if (anahtarlar.length === 0) return;

    // İyimser boyama: sunucu yanıtı beklenmeden çip yerine oturur.
    setDurum((o) => {
      const y: Isaretler = { ...o };
      for (const k of anahtarlar) {
        const asamalar = { ...(y[k] ?? {}) };
        if (mode === "kaldir") delete asamalar[stage];
        else asamalar[stage] = adetler?.get(k) ?? 0;
        y[k] = asamalar;
      }
      return y;
    });

    basla(async () => {
      const sonuc = await markStage({ packageId, stage, keys: anahtarlar, mode });
      if (sonuc.error) {
        toast.error(sonuc.error);
        setDurum(isaretHaritasi(marks));
        return;
      }
      const ad = stages.find((s) => s.slug === stage)?.name ?? stage;
      if (mode === "kaldir") toast.success(`${anahtarlar.length} parçadan "${ad}" işareti kaldırıldı.`);
      else if ((sonuc.ok ?? 0) === 0) toast.info("Hepsi zaten işaretliydi.");
      else toast.success(`${sonuc.ok} parça "${ad}" işaretlendi.`);
      router.refresh();
    });
  }

  function oneriyiUygula(o: StageSuggestion) {
    if (!canWrite) return;
    setDurum((eski) => {
      const y: Isaretler = { ...eski };
      for (const k of o.pending) {
        y[k] = { ...(y[k] ?? {}), [o.stage]: o.qtyByKey[k] ?? 0 };
      }
      return y;
    });
    basla(async () => {
      const sonuc = await applyFolderSuggestion({
        packageId,
        stage: o.stage,
        folderPath: o.folderPath,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        setDurum(isaretHaritasi(marks));
        return;
      }
      toast.success(`${sonuc.ok ?? 0} parça işaretlendi.`);
      router.refresh();
    });
  }

  // ————————————————————————————————— revizyon devri: gözden geçirilecekler
  //
  // Bir revizyonda parça değişince kaydı SİLMİYORUZ (belki hâlâ kullanılabilir)
  // ama "kesildi" demeyi sürdürmek de atölyeye yalan söylemek olurdu. Kayıt
  // devroluyor, işaretleniyor ve kararı insan veriyor.
  //
  // ŞERİT EN ÜSTTE ve tahtanın kendi durumundan BAĞIMSIZDIR: işaret sunucudan
  // gelir ve iyimser çip haritasına hiç girmez (`doneAt`/`note` ile aynı
  // gerekçe — tek dokunuşluk bir çip için üç alanı kopyalamak gerekirdi).
  const gozdenGecir = useMemo(
    () => marks.filter((m) => m.reviewRequired && m.id),
    [marks]
  );

  function isaretiKaldir(m: ProgressMark) {
    basla(async () => {
      const sonuc = await setReviewMark({
        packageId,
        progressId: m.id ?? "",
        reviewRequired: false,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else toast.success("Kayıt onaylandı.");
      router.refresh();
    });
  }

  function kaydiSifirla(m: ProgressMark) {
    basla(async () => {
      const sonuc = await markStage({ packageId, stage: m.stage, keys: [m.key], mode: "kaldir" });
      if (sonuc.error) toast.error(sonuc.error);
      else toast.success("İşaret kaldırıldı; parça yeniden üretilecek olarak duruyor.");
      router.refresh();
    });
  }

  // ————————————————————————————————— adet penceresi
  const [pencere, setPencere] = useState<{ part: TrackedPart; stage: StageDef } | null>(null);

  const asamaAdi = (slug: string) => stages.find((s) => s.slug === slug)?.name ?? slug;
  const seciliListe = [...secili];

  return (
    <div className="grid gap-3">
      {ledgerMissing && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Aşama defteri henüz kurulmamış — ekran yedek sözlükle çalışıyor.
          İşaretler kaydedilir; migration uygulandığında defterdeki adlar ve
          renkler devreye girer.
        </p>
      )}

      {/* GÖZDEN GEÇİRİLECEKLER EN ÜSTTE — özet şeridinin bile üstünde.
          Atölyenin bakması gereken tek acil şey budur: elindeki kayıt hâlâ
          geçerli mi? */}
      {gozdenGecir.length > 0 && (
        <section className="border border-amber-500/50 bg-amber-500/5">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
              Yeni revizyonda değişen parçalar ({gozdenGecir.length})
            </h2>
          </header>
          <p className="border-b px-3 py-2 text-[11px] text-muted-foreground">
            Bu parçalar yeni revizyonda <strong>imalatı etkileyecek biçimde</strong> değişti
            (ölçü · malzeme · kalınlık · adet · kategori). Kayıtlar KAYBOLMADI, taşındı — ama
            elinizdeki parça hâlâ geçerli mi, buna insan karar vermeli.
          </p>
          <ul className="divide-y">
            {gozdenGecir.map((m) => (
              <li
                key={m.id}
                className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[12px] font-medium">{m.key}</span>
                    <span className="border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
                      {asamaAdi(m.stage)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {m.reviewReason || "Parça yeni revizyonda değişti."}
                  </span>
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={calisiyor}
                      onClick={() => isaretiKaldir(m)}
                      title="Kayıt geçerli — işareti kaldır."
                    >
                      Onayla
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={calisiyor}
                      onClick={() => kaydiSifirla(m)}
                      title="Parça yeniden üretilecek — bu aşama işaretini kaldır."
                    >
                      Sıfırla
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SummaryStrip ozet={ozet} />

      {suggestions.length > 0 && (
        <ul className="grid gap-2">
          {suggestions.map((o) => (
            <SuggestionCard
              key={`${o.folderPath}|${o.stage}`}
              oneri={o}
              stageName={asamaAdi(o.stage)}
              canWrite={canWrite}
              calisiyor={calisiyor}
              onApply={() => oneriyiUygula(o)}
              onInspect={() => {
                setArama(o.folderCode);
                setAcik((a) => new Set(a).add(o.folderCode.split("-").slice(-1)[0] ?? ""));
              }}
            />
          ))}
        </ul>
      )}

      {/* ————————————————————————————————— süzgeç şeridi */}
      <div className="grid gap-2 border bg-card p-3">
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kod, Tanım, Kategori ya da Malzeme Ara…"
          className="h-9 font-mono text-base pointer-coarse:h-11 pointer-fine:text-sm"
          aria-label="Parça ara"
        />
        <div className="oc-scrollx flex flex-wrap items-center gap-1.5 [--oc-scroll-bg:var(--card)]">
          <FilterChip
            aktif={yalnizBaslanmamis}
            onClick={() => setYalnizBaslanmamis((v) => !v)}
            title="Hiç işareti olmayan parçalar"
          >
            Yalnız başlanmamış
          </FilterChip>
          {stages.map((s) => (
            <FilterChip
              key={s.slug}
              aktif={asamaSuzgeci === s.slug}
              hue={s.colorHue}
              onClick={() => setAsamaSuzgeci((v) => (v === s.slug ? "" : s.slug))}
              title={`${s.name} işaretli parçalar`}
            >
              {s.name}
            </FilterChip>
          ))}
          {(arama || yalnizBaslanmamis || asamaSuzgeci) && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setArama("");
                setYalnizBaslanmamis(false);
                setAsamaSuzgeci("");
              }}
            >
              Süzgeci temizle
            </Button>
          )}
        </div>
      </div>

      {/* ————————————————————————————————— gruplar */}
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] text-muted-foreground">
            {formatNum(suzulmusKodlu.length)} / {formatNum(coded.length)} Parça ·{" "}
            {formatNum(gruplar.length)} Grup
            {secili.size > 0 && ` · ${formatNum(secili.size)} Seçili`}
          </p>
          <span className="flex items-center gap-1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setAcik(new Set(gruplar.map(([ad]) => ad)))}
            >
              Tümünü aç
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setAcik(new Set())}>
              Kapat
            </Button>
          </span>
        </div>

        {gruplar.length === 0 && (
          <p className="border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Süzgece uyan parça yok.
          </p>
        )}

        {gruplar.map(([ad, parcalar]) => {
          const acikMi = acik.has(ad);
          const tamamlanan = parcalar.filter(
            (p) => (isaretHarita.get(p.key) ?? []).length > 0
          ).length;
          const hepsiSecili = parcalar.every((p) => secili.has(p.key));
          // BAŞLIK GRUBU AÇMADAN TANITIR (kullanıcı isteği, 13.08.2026).
          // Ad defterden gelir; yoksa grubun KENDİ defter satırının etiketine
          // düşülür — o zaten bir satır aşağıda, açılınca görünen metnin ta
          // kendisidir, yani uydurma değil AYNI kaynaktır. Adet de o satırdan
          // okunur (`groupOwnPart`) ve satır yoksa HİÇ BASILMAZ.
          const kendi = groupOwnPart(parcalar);
          const grupAdi = groupNames[ad] ?? kendi?.label ?? "";
          const grupAdedi = kendi?.qty ?? null;
          return (
            <section key={ad} className="border bg-card">
              <div className="flex items-center gap-1 border-b bg-muted/40 pr-2">
                {canWrite && (
                  <SecimKutusu
                    checked={hepsiSecili}
                    onChange={(v) => grupSec(parcalar, v)}
                    label={`${ad} grubunun tamamını seç`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => grupCevir(ad)}
                  aria-expanded={acikMi}
                  className="flex min-h-11 flex-1 items-center gap-2 px-2 text-left transition-colors pointer-coarse:min-h-12 hover:bg-muted/60"
                >
                  {acikMi ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="shrink-0 font-mono text-[13px] font-medium">{ad}</span>
                  {/* Ad ESNEK sütundur ve KIRPILIR: "ARABA GENEL GÖRÜNÜŞÜ" gibi
                      bir başlık telefonda sayaç ile ilerleme çubuğunu ekranın
                      dışına iterdi (Satış Takibi'nde öğrenilen kural). Tam ad
                      `title` ile durur. Ad yoksa kutu yine çizilir — boş
                      esneme, sayacı sağa iten şeydir. */}
                  <span
                    className="min-w-0 flex-1 truncate text-left text-[12px] text-foreground/80"
                    title={grupAdi || undefined}
                  >
                    {grupAdi}
                  </span>
                  {grupAdedi !== null && (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {formatNum(grupAdedi)} ad
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {formatNum(tamamlanan)}/{formatNum(parcalar.length)}
                  </span>
                  <span className="h-1.5 w-16 shrink-0 bg-muted" aria-hidden>
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${Math.round((tamamlanan / parcalar.length) * 100)}%` }}
                    />
                  </span>
                </button>
              </div>

              {acikMi && (
                <ul className="divide-y">
                  {parcalar.map((p) => (
                    <PartRow
                      key={p.key}
                      part={p}
                      stages={stages}
                      progress={partProgress(p, isaretHarita.get(p.key) ?? [], stages)}
                      ayrintilar={ayrintilar}
                      secili={secili.has(p.key)}
                      canWrite={canWrite}
                      onSelect={() => secimCevir(p.key)}
                      onToggleStage={(stage, isaretli) =>
                        yaz([p.key], stage, isaretli ? "kaldir" : "isaretle", new Map([[p.key, p.qty]]))
                      }
                      onDetail={(stage) => setPencere({ part: p, stage })}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* SATIN ALMA KALEMLERİ ARTIK BURADA DEĞİL.
          Kodsuz satırlar (civata, somun, segman, keçe) ve satın alma
          yapısındaki kodlu satırlar (motor, redüktör, halat) kendi bölümüne
          taşındı: `/drawings/<paket>/purchasing`. Sebep kullanıcının kendi
          cümlesiydi — "satın almacının tüm sacları görmesine gerek yok" ve
          "satın alındı işaretlemesi sadece satın alma bölümünden yapılsın".
          Aynı gerekçeyle `satinalindi` çipi de bu tahtanın aşama listesinde
          yoktur (`productionStages`, progress/page.tsx). */}

      {orphans.length > 0 && (
        <details className="border bg-card px-3 py-2">
          <summary className="cursor-pointer text-[12px] text-muted-foreground">
            Eşleşmeyen üretim kaydı ({formatNum(orphans.length)})
          </summary>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Bu işaretlerin anahtarı bugünkü defterde bulunamadı — büyük olasılıkla
            Excel’deki tanım düzeltilmiş. Kayıt DÜŞÜRÜLMEDİ; burada duruyor.
          </p>
          <ul className="mt-1 grid gap-0.5">
            {orphans.slice(0, 40).map((m) => (
              <li key={`${m.key}|${m.stage}`} className="truncate font-mono text-[11px]">
                {m.key} · {asamaAdi(m.stage)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ————————————————————————————————— yapışkan toplu şerit
          261 satırlık bir listede seçim yaparken toplu işlem düğmesine ulaşmak
          için sayfanın dibine inmek gerekmemeli. z-20 kabuğun üst şeridiyle
          (z-30) çakışmaz. */}
      {canWrite && secili.size > 0 && (
        <div className="sticky bottom-2 z-20 border bg-card p-2 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-medium">
              {formatNum(secili.size)} Parça Seçili
            </span>
            <Button type="button" size="xs" variant="ghost" onClick={() => setSecili(new Set())}>
              Seçimi bırak
            </Button>
            {calisiyor && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="oc-scrollx mt-2 flex flex-wrap items-center gap-1.5 [--oc-scroll-bg:var(--card)]">
            {stages.map((s) => (
              <button
                key={s.slug}
                type="button"
                disabled={calisiyor}
                onClick={() => {
                  const adetler = new Map(
                    coded.filter((p) => secili.has(p.key)).map((p) => [p.key, p.qty])
                  );
                  yaz(seciliListe, s.slug, "isaretle", adetler);
                }}
                style={tagStyle(s.colorHue)}
                className="oc-tag min-h-9 px-2 py-1 text-[12px] transition-opacity pointer-coarse:min-h-11 disabled:opacity-50"
              >
                {s.name}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {stages.map((s) => (
              <button
                key={`kaldir-${s.slug}`}
                type="button"
                disabled={calisiyor}
                onClick={() => yaz(seciliListe, s.slug, "kaldir")}
                title={`Seçili parçalardan "${s.name}" işaretini kaldır`}
                className="inline-flex min-h-9 items-center border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors pointer-coarse:min-h-11 hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
              >
                −{s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {pencere && (
        <DetailDialog
          key={`${pencere.part.key}|${pencere.stage.slug}`}
          packageId={packageId}
          part={pencere.part}
          stage={pencere.stage}
          mevcut={durum[pencere.part.key]?.[pencere.stage.slug]}
          mevcutTarih={ayrintilar.get(`${pencere.part.key}|${pencere.stage.slug}`)?.doneAt ?? ""}
          mevcutNot={ayrintilar.get(`${pencere.part.key}|${pencere.stage.slug}`)?.note ?? ""}
          onClose={() => setPencere(null)}
          onSaved={(adet) => {
            setDurum((o) => ({
              ...o,
              [pencere.part.key]: { ...(o[pencere.part.key] ?? {}), [pencere.stage.slug]: adet },
            }));
            setPencere(null);
            router.refresh();
          }}
          onCleared={() => {
            yaz([pencere.part.key], pencere.stage.slug, "kaldir");
            setPencere(null);
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ özet

function SummaryStrip({ ozet }: { ozet: ReturnType<typeof packageProgress> }) {
  const enBuyuk = Math.max(1, ...ozet.buckets.map((b) => b.parts), ozet.notStarted);
  return (
    <section className="border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Ulaşılan aşama</h2>
        <p className="font-mono text-[11px] text-muted-foreground">
          {formatNum(ozet.started)}/{formatNum(ozet.total)} Parçaya Dokunuldu · Montaja
          hazır %{Math.round(ozet.completedRatio * 100)}
        </p>
      </div>

      {/* ÇUBUKLAR AYNI TABANDAN KALKAR. Eskiden sütunlar `items-end` ile
          hizalanıyordu ve etiketi iki satıra sığan bir aşama ("Montaja hazır")
          bütün sütununu bir satır boyu YUKARI kaydırıyordu — çubuk komşusuyla
          aynı zeminde durmuyordu. Artık her sütun aynı yükseklikte: çubuk alanı
          sabit (`h-14`, çubuk içinden dibe yaslanır) ve etiket alanı iki satır
          alacak kadar sabit (`h-7`). */}
      {/* İSTİSNA (AGENTS md. 15): bu şerit bir ÇUBUK GRAFİĞİDİR — sütunlar
          sarılırsa karşılaştırma ekseni kırılır (kural 9'un HTML hâli);
          telefonda içte kayar ve `.oc-scrollx` gölgesi bunu söyler. */}
      <ul className="oc-scrollx mt-2 flex items-stretch gap-2 overflow-x-auto pb-1 [--oc-scroll-bg:var(--card)]">
        <li className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className="font-mono text-[12px] tabular-nums">{formatNum(ozet.notStarted)}</span>
          <span className="flex h-14 w-full items-end" aria-hidden>
            <span
              className="w-full bg-muted"
              style={{ height: `${Math.max(3, (ozet.notStarted / enBuyuk) * 56)}px` }}
            />
          </span>
          <span className="flex h-7 items-start text-center text-[11px] leading-tight text-muted-foreground">
            Başlanmadı
          </span>
        </li>
        {ozet.buckets.map((b) => (
          <li key={b.stage.slug} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="font-mono text-[12px] tabular-nums">{formatNum(b.parts)}</span>
            <span className="flex h-14 w-full items-end" aria-hidden>
              <span
                className="oc-series-bg w-full"
                style={{
                  ...tagStyle(b.stage.colorHue),
                  height: `${Math.max(3, (b.parts / enBuyuk) * 56)}px`,
                }}
              />
            </span>
            <span className="flex h-7 items-start text-center text-[11px] leading-tight text-muted-foreground">
              {b.stage.name}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[12px] text-muted-foreground">
        {ozet.bottleneck ? (
          <>
            Şu an en kalabalık aşama{" "}
            <strong className="font-medium text-foreground">{ozet.bottleneck.stage.name}</strong>:{" "}
            {formatNum(ozet.bottleneck.parts)} parça orada bekliyor.{" "}
            {formatNum(ozet.notStarted)} parçaya ise hiç dokunulmadı — o sayı bir
            darboğaz değil, henüz sıraya girmemiş iştir.
          </>
        ) : (
          <>Henüz hiçbir parça işaretlenmemiş.</>
        )}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ öneri

function SuggestionCard({
  oneri,
  stageName,
  canWrite,
  calisiyor,
  onApply,
  onInspect,
}: {
  oneri: StageSuggestion;
  stageName: string;
  canWrite: boolean;
  calisiyor: boolean;
  onApply: () => void;
  onInspect: () => void;
}) {
  return (
    <li className="border border-primary/30 bg-primary/[0.04] p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-mono text-[12px]">{oneri.folderPath}</span> klasöründeki{" "}
            <strong className="font-medium">{formatNum(oneri.keys.length)} parça</strong>{" "}
            <strong className="font-medium">{stageName.toLocaleLowerCase("tr-TR")}</strong> olabilir.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Klasör adında “{oneri.hintWord}” yazıyor. Bu bir kanıt değil bir ipucudur —
            hiçbir şey kendiliğinden işaretlenmedi. Klasörün kendi kodu{" "}
            <span className="font-mono">{oneri.folderCode || "—"}</span> öneriye
            girmedi; montaj kesilmez.
          </p>
          {oneri.alreadyMarked.length > 0 && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {formatNum(oneri.alreadyMarked.length)} tanesi zaten işaretli ·{" "}
              {formatNum(oneri.pending.length)} tanesi eklenecek
            </p>
          )}
          {oneri.qtyConflicts.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              {formatNum(oneri.qtyConflicts.length)} parçada dosya adındaki adet ile defter
              farklı; öneride defterin adedi kullanıldı.
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="xs" variant="outline" onClick={onInspect}>
          İncele
        </Button>
        {canWrite && oneri.pending.length > 0 && (
          <Button type="button" size="xs" onClick={onApply} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-3 animate-spin" />}
            {formatNum(oneri.pending.length)} parçayı işaretle
          </Button>
        )}
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ satır

function PartRow({
  part,
  stages,
  progress,
  ayrintilar,
  secili,
  canWrite,
  onSelect,
  onToggleStage,
  onDetail,
}: {
  part: TrackedPart;
  stages: StageDef[];
  progress: ReturnType<typeof partProgress>;
  /** `anahtar|aşama` → tarih + not; çipin başlığında görünür */
  ayrintilar: Map<string, { doneAt: string; note: string }>;
  secili: boolean;
  canWrite: boolean;
  onSelect: () => void;
  onToggleStage: (stage: string, isaretli: boolean) => void;
  onDetail: (stage: StageDef) => void;
}) {
  return (
    <li className={"flex items-start gap-1 px-1 py-2" + (secili ? " bg-primary/[0.05]" : "")}>
      {canWrite && (
        <SecimKutusu checked={secili} onChange={onSelect} label={`${part.label} satırını seç`} />
      )}

      <div className="min-w-0 flex-1 pr-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          {part.partCode && (
            <span className="font-mono text-[12px] font-medium">{part.partCode}</span>
          )}
          <span className="min-w-0 truncate text-[13px]" title={part.label}>
            {part.label}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {part.qty == null ? "adet ?" : `${formatNum(part.qty)} ad`}
            {part.sourceRows > 1 && ` · ${part.sourceRows} satır`}
          </span>
        </p>

        <div className="oc-scrollx mt-1 flex flex-wrap items-center gap-1 [--oc-scroll-bg:var(--card)]">
          {stages.map((s) => {
            const hal = progress.states[s.slug] ?? "yok";
            const adet = progress.qtyDone[s.slug] ?? 0;
            const isaretli = hal !== "yok";
            const ek = ayrintilar.get(`${part.key}|${s.slug}`);
            const ekMetin = [ek?.doneAt, ek?.note].filter(Boolean).join(" · ");
            return (
              <span key={s.slug} className="inline-flex">
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => onToggleStage(s.slug, isaretli)}
                  aria-pressed={isaretli}
                  title={
                    isaretli
                      ? `${s.name}${ekMetin ? ` — ${ekMetin}` : ""} — dokunmak işareti kaldırır`
                      : `${s.name} olarak işaretle`
                  }
                  style={isaretli ? tagStyle(s.colorHue) : undefined}
                  className={
                    "inline-flex min-h-8 items-center gap-1 px-1.5 text-[11px] transition-colors pointer-coarse:min-h-10 pointer-coarse:px-2 disabled:cursor-default " +
                    (isaretli
                      ? "oc-tag"
                      : "border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                  }
                >
                  {!isaretli && <span className="oc-tag-dot opacity-40" style={tagStyle(s.colorHue)} aria-hidden />}
                  {s.name}
                  {hal === "kismi" && (
                    <span className="font-mono tabular-nums">
                      {formatNum(adet)}/{formatNum(part.qty)}
                    </span>
                  )}
                </button>
                {canWrite && isaretli && (
                  <button
                    type="button"
                    onClick={() => onDetail(s)}
                    title={
                      ekMetin
                        ? `${s.name}: ${ekMetin} — düzenle`
                        : `${s.name} — adet, tarih ve not`
                    }
                    aria-label={`${s.name} ayrıntısı`}
                    className={
                      "inline-flex min-h-8 items-center border border-l-0 px-1 text-[11px] transition-colors pointer-coarse:min-h-10 hover:text-foreground " +
                      (ekMetin ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {ekMetin ? "•" : "…"}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ pencere

function DetailDialog({
  packageId,
  part,
  stage,
  mevcut,
  mevcutTarih,
  mevcutNot,
  onClose,
  onSaved,
  onCleared,
}: {
  packageId: string;
  part: TrackedPart;
  stage: StageDef;
  mevcut: number | undefined;
  mevcutTarih: string;
  mevcutNot: string;
  onClose: () => void;
  onSaved: (adet: number) => void;
  onCleared: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  // TABAN 1'DİR: sıfır "işaretli ama hiç yapılmamış" gibi belirsiz bir hâl
  // üretirdi. 1'in altına inmek işareti KALDIRIR.
  const [adet, setAdet] = useState(() => String(mevcut && mevcut > 0 ? mevcut : part.qty ?? 1));
  const [gun, setGun] = useState(mevcutTarih);
  const [not, setNot] = useState(mevcutNot);

  const sayi = Number(adet.replace(/[^\d]/g, "")) || 0;

  function kaydet() {
    if (sayi < 1) {
      onCleared();
      return;
    }
    basla(async () => {
      const sonuc = await setPartStage({
        packageId,
        stage: stage.slug,
        key: part.key,
        qtyDone: sayi,
        doneAt: gun,
        note: not,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Kaydedildi.");
        onSaved(sayi);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">{stage.name}</DialogTitle>
          <DialogDescription className="font-mono text-[12px]">
            {part.partCode || "satın alma kalemi"} · {part.label}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <span className="oc-kicker block text-muted-foreground">
              Yapılan adet {part.qty != null && `(toplam ${formatNum(part.qty)})`}
            </span>
            <div className="mt-1 flex items-stretch">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-10 w-10 rounded-none"
                onClick={() => setAdet(String(Math.max(0, sayi - 1)))}
                aria-label="Bir azalt"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                value={adet}
                onChange={(e) => setAdet(e.target.value)}
                inputMode="numeric"
                className="h-10 min-w-0 flex-1 rounded-none border-x-0 text-center font-mono text-base tabular-nums"
                aria-label="Yapılan adet"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-10 w-10 rounded-none"
                onClick={() => setAdet(String(sayi + 1))}
                aria-label="Bir artır"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {sayi < 1 && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sıfıra inmek işareti kaldırır.
              </p>
            )}
          </div>

          <div>
            <span className="oc-kicker block text-muted-foreground">Tarih (isteğe bağlı)</span>
            <Input
              type="date"
              value={gun}
              onChange={(e) => setGun(e.target.value)}
              className="mt-1 h-10 w-full font-mono text-base pointer-fine:text-sm"
            />
          </div>

          <div>
            <span className="oc-kicker block text-muted-foreground">Not (isteğe bağlı)</span>
            <Input
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={500}
              placeholder="Not"
              className="mt-1 h-10 w-full text-base pointer-fine:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            {sayi < 1 ? "İşareti kaldır" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ ufaklar

function FilterChip({
  aktif,
  hue,
  onClick,
  title,
  children,
}: {
  aktif: boolean;
  hue?: number;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={aktif}
      style={aktif && hue != null ? tagStyle(hue) : undefined}
      className={
        "inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap px-2 text-[12px] transition-colors pointer-coarse:min-h-10 " +
        (aktif
          ? hue != null
            ? "oc-tag"
            : "border border-primary bg-primary/10 text-foreground"
          : "border border-border text-muted-foreground hover:text-foreground")
      }
    >
      {!aktif && hue != null && (
        <span className="oc-tag-dot opacity-50" style={tagStyle(hue)} aria-hidden />
      )}
      {children}
    </button>
  );
}

/**
 * Seçim kutusu.
 *
 * `components/ui`da Checkbox YOKTUR ve bu faz onu eklemez (paylaşılan dizin).
 * Ham `<input type="checkbox">` 13px'lik bir hedeftir; 44px'lik bir `label`
 * içine sarmak dokunma hedefi kuralını karşılamanın en ucuz yoludur.
 */
function SecimKutusu({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      className="flex min-h-10 w-10 shrink-0 cursor-pointer items-center justify-center pointer-coarse:min-h-11 pointer-coarse:w-11"
      title={label}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
        aria-label={label}
      />
    </label>
  );
}
