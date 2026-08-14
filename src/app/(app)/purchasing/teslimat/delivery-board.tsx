"use client";

// Teslim takvimi panosu — aya ya da haftaya göre gruplanmış bekleyen sevkiyat.
//
// ÜÇ KARAR:
//
// 1. TERMİNİ OLMAYAN SİPARİŞ GİZLENMEZ, EN ÜSTE KONUR. Takvimden düşürmek onu
//    unutturur; oysa "ne zaman geleceği belli olmayan sipariş" satınalmacının
//    ilk çözmesi gereken şeydir.
//
// 2. GECİKMİŞLER AYRI BİR BANTTIR, geçmiş ayın içinde değil. Geçen ayın
//    kutusuna bakmak için kimse sayfayı yukarı kaydırmaz; gecikme bugünün
//    sorunudur ve bugünün üstünde durmalıdır.
//
// 3. TESLİM ALINANLAR LİSTEDEN DÜŞER. Ekranın sorusu "ne bekliyorum"dur;
//    gelmiş malı göstermek listeyi zamanla okunmaz yapardı. Geçmiş kayıt
//    Siparişler ekranındadır.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RankBars, TimeLineChart } from "@/components/charts";
import { fmtCompactEur, fmtCompactEur1, fmtMoney, parseNum } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import { bugunISO, eurKarsiligi, gunFarki, tarihGoster } from "@/lib/purchasing/terms";
import { donemlere, sirala, type Kip } from "@/lib/purchasing/summary";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";
import { CokluSuzgec } from "../filters";
import { Bant, KipSecici, PanoKabugu } from "../board-ui";
import type { Siparis } from "../data";
import { receiveOrderLines } from "../actions";

function tutar(s: Siparis): number {
  return s.satirlar.reduce((t, l) => t + l.qty * (l.unitPrice ?? 0), 0);
}

/** Siparişin genel teslim oranı — kalem adetlerinin ağırlıklı ortalaması. */
function teslimOrani(s: Siparis): number {
  const toplam = s.satirlar.reduce((t, l) => t + l.qty, 0);
  if (toplam <= 0) return 0;
  const alinan = s.satirlar.reduce((t, l) => t + Math.min(l.qty, l.receivedQty), 0);
  return Math.max(0, Math.min(1, alinan / toplam));
}

/** Teslim oranına göre KIRMIZI→YEŞİL renk (kullanıcı isteği, 14.08.2026). */
function oranRengi(oran: number): string {
  // 0 → 0° (kırmızı), 1 → 140° (yeşil). OKLCH sabit L/C ile okunur kalır.
  return `oklch(0.58 0.16 ${Math.round(oran * 140)})`;
}

function eur(s: Siparis): number {
  return eurKarsiligi(tutar(s), s.currency, s.fxRate) ?? 0;
}

function isNolari(s: Siparis): string[] {
  return [...new Set(s.satirlar.map((l) => l.itemNo).filter(Boolean))];
}

type Aciliyet = "gecikmis" | "yakin" | "planli" | "terminsiz";

const ACILIYET_ETIKET: Record<Aciliyet, string> = {
  gecikmis: "Gecikmiş",
  yakin: "14 gün içinde",
  planli: "Planlı",
  terminsiz: "Termin yok",
};

function aciliyeti(s: Siparis, bugun: string): Aciliyet {
  if (!s.dueAt) return "terminsiz";
  const k = gunFarki(s.dueAt, bugun) ?? 0;
  if (k < 0) return "gecikmis";
  if (k <= 14) return "yakin";
  return "planli";
}

interface Filtreler {
  query: string;
  tedarikciler: string[];
  isler: string[];
  aciliyet: string[];
}

const BOS: Filtreler = { query: "", tedarikciler: [], isler: [], aciliyet: [] };

export function DeliveryBoard({
  siparisler,
  canWrite,
}: {
  siparisler: Siparis[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [, basla] = useTransition();
  const [kip, setKip] = useState<Kip>("ay");
  // PANO KAPALI AÇILIR (kullanıcı kararı, 14.08.2026).
  const [pano, setPano] = useState(false);
  const [f, setF] = useState<Filtreler>(BOS);
  const [acik, setAcik] = useState<Set<string>>(new Set());

  const bugun = bugunISO();
  // EKRANIN KAPSAMI: teslim alınmamış siparişler. "Ne bekliyorum" sorusu bu.
  const bekleyen = useMemo(() => siparisler.filter((s) => !s.receivedAt), [siparisler]);
  // TESLİM ALINANLAR ayrı bir bantta altta durur (kullanıcı isteği,
  // 14.08.2026): tamamı teslim alınınca sipariş bekleyenden düşer ama gözden
  // kaybolmamalı — en son teslim üstte.
  const teslimAlinanlar = useMemo(
    () =>
      siparisler
        .filter((s) => s.receivedAt)
        .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "")),
    [siparisler]
  );

  const secenekler = useMemo(() => {
    const say = (fn: (s: Siparis) => string[]) => {
      const m = new Map<string, number>();
      for (const s of bekleyen) for (const v of fn(s)) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const ted = say((s) => [s.supplier]);
    const is = say(isNolari);
    const ac = say((s) => [aciliyeti(s, bugun)]);
    return {
      tedarikciler: [...ted.keys()]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((v) => ({ value: v, label: v, count: ted.get(v) })),
      isler: [...is.keys()]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((v) => ({ value: v, label: v, count: is.get(v) })),
      aciliyet: (["gecikmis", "yakin", "planli", "terminsiz"] as Aciliyet[])
        .filter((a) => ac.has(a))
        .map((a) => ({ value: a, label: ACILIYET_ETIKET[a], count: ac.get(a) })),
    };
  }, [bekleyen, bugun]);

  const gorunen = useMemo(() => {
    const q = f.query.trim().toLocaleLowerCase("tr-TR");
    const ted = new Set(f.tedarikciler);
    const is = new Set(f.isler);
    const ac = new Set(f.aciliyet);
    return bekleyen.filter((s) => {
      if (ted.size > 0 && !ted.has(s.supplier)) return false;
      if (is.size > 0 && !isNolari(s).some((n) => is.has(n))) return false;
      if (ac.size > 0 && !ac.has(aciliyeti(s, bugun))) return false;
      if (!q) return true;
      return [s.supplier, s.orderNo, ...s.satirlar.map((l) => `${l.sample} ${l.itemNo}`)]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(q);
    });
  }, [bekleyen, f, bugun]);

  const { gecikmis, terminsiz, kutular } = useMemo(() => {
    const gecikmis = gorunen
      .filter((s) => aciliyeti(s, bugun) === "gecikmis")
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
    const gelecek = gorunen.filter((s) => s.dueAt && (gunFarki(s.dueAt, bugun) ?? 0) >= 0);
    const { kutular, tarihsiz } = donemlere(gelecek, (s) => s.dueAt, eur, kip);
    return {
      gecikmis,
      terminsiz: gorunen.filter((s) => !s.dueAt).concat(tarihsiz),
      kutular,
    };
  }, [gorunen, kip, bugun]);

  function teslimGonder(
    s: Siparis,
    updates: { lineId: string; receivedQty: number }[],
    mesaj: string
  ) {
    if (!canWrite || updates.length === 0) return;
    basla(async () => {
      const sonuc = await receiveOrderLines({ orderId: s.id, updates });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(mesaj);
        router.refresh();
      }
    });
  }

  /** Bütün kalemleri sipariş adediyle teslim al — sipariş listeden düşer. */
  function tumunuTeslimAl(s: Siparis) {
    teslimGonder(
      s,
      s.satirlar.map((l) => ({ lineId: l.id, receivedQty: l.qty })),
      `${s.supplier} siparişi tamamen teslim alındı.`
    );
  }

  /** Tek bir kalemin teslim adedini yaz. */
  function satirTeslim(s: Siparis, lineId: string, deger: string) {
    const adet = parseNum(deger) ?? 0;
    teslimGonder(s, [{ lineId, receivedQty: adet }], "Teslim güncellendi.");
  }

  /** Teslimi geri al: bütün satırları sıfırla — sipariş bekleyene döner. */
  function teslimGeriAl(s: Siparis) {
    teslimGonder(
      s,
      s.satirlar.map((l) => ({ lineId: l.id, receivedQty: 0 })),
      `${s.supplier} teslimi geri alındı.`
    );
  }

  function genislet(id: string) {
    setAcik((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  const eurFmt = (v: number) => fmtMoney(v, "EUR");
  const bekleyenEur = gorunen.reduce((t, s) => t + eur(s), 0);

  const zamanSerisi = useMemo(
    () =>
      kutular.map((k) => ({
        key: k.donem.key,
        label: k.donem.label,
        total: k.toplam,
        parts: {
          yakin: k.kayitlar
            .filter((s) => aciliyeti(s, bugun) === "yakin")
            .reduce((t, s) => t + eur(s), 0),
          planli: k.kayitlar
            .filter((s) => aciliyeti(s, bugun) === "planli")
            .reduce((t, s) => t + eur(s), 0),
        },
      })),
    [kutular, bugun]
  );

  const tedarikciCubuklari = useMemo(
    () => sirala(gorunen, (s) => s.supplier, eur, { ipucu: (_a, l) => `${l.length} sipariş` }),
    [gorunen]
  );

  return (
    <div className="grid gap-3">
      <section className="flex flex-wrap items-center gap-4 border bg-card p-3">
        <div>
          <span className="oc-kicker block text-muted-foreground">Teslim Bekleyen</span>
          <span className="block font-mono text-lg tabular-nums">
            {formatNum(gorunen.length)} sipariş · {fmtMoney(bekleyenEur, "EUR")}
          </span>
        </div>
        {gecikmis.length > 0 && (
          <div>
            <span className="oc-kicker block text-muted-foreground">Gecikmiş</span>
            <span className="block font-mono text-lg text-destructive tabular-nums">
              {formatNum(gecikmis.length)}
            </span>
          </div>
        )}
        {terminsiz.length > 0 && (
          <div>
            <span className="oc-kicker block text-muted-foreground">Termini Yok</span>
            <span className="block font-mono text-lg text-amber-700 tabular-nums dark:text-amber-400">
              {formatNum(terminsiz.length)}
            </span>
          </div>
        )}
        <span className="ml-auto flex items-center gap-2">
          <KipSecici kip={kip} onChange={setKip} />
          <Button
            type="button"
            size="xs"
            variant={pano ? "default" : "outline"}
            onClick={() => setPano((p) => !p)}
          >
            <BarChart3 className="size-3" />
            Pano
          </Button>
        </span>
      </section>

      {pano && gorunen.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <PanoKabugu baslik="Teslim Akışı" alt={`${zamanSerisi.length} dönem`}>
            <TimeLineChart
              columns={zamanSerisi}
              series={[
                { key: "yakin", label: "14 gün içinde", hue: 45 },
                { key: "planli", label: "Planlı", hue: 210 },
              ]}
              valueLabel="€"
              format={fmtCompactEur}
              valueLabels
              valueFormat={fmtCompactEur1}
              height={180}
            />
          </PanoKabugu>
          <PanoKabugu baslik="Tedarikçi Dağılımı" alt={`${tedarikciCubuklari.length} tedarikçi`}>
            <RankBars
              items={tedarikciCubuklari}
              limit={8}
              valueLabel="€"
              format={eurFmt}
              emptyText="Bekleyen sevkiyat yok"
              onSelect={(k) =>
                setF((s) => ({
                  ...s,
                  tedarikciler: s.tedarikciler.includes(k)
                    ? s.tedarikciler.filter((x) => x !== k)
                    : [...s.tedarikciler, k],
                }))
              }
              selected={f.tedarikciler.length === 1 ? f.tedarikciler[0] : null}
            />
          </PanoKabugu>
        </div>
      )}

      <FilterBar
        gorunen={gorunen.length}
        toplam={bekleyen.length}
        temiz={JSON.stringify(f) === JSON.stringify(BOS)}
        onTemizle={() => setF(BOS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Tedarikçi, Sipariş No, Kalem Ara…"
          className="w-[min(18rem,calc(100vw-4rem))]"
        />
        <CokluSuzgec
          baslik="Tedarikçi"
          secenekler={secenekler.tedarikciler}
          secili={f.tedarikciler}
          onChange={(v) => setF((s) => ({ ...s, tedarikciler: v }))}
        />
        <CokluSuzgec
          baslik="İş"
          secenekler={secenekler.isler}
          secili={f.isler}
          onChange={(v) => setF((s) => ({ ...s, isler: v }))}
        />
        <CokluSuzgec
          baslik="Aciliyet"
          secenekler={secenekler.aciliyet}
          secili={f.aciliyet}
          onChange={(v) => setF((s) => ({ ...s, aciliyet: v }))}
        />
      </FilterBar>

      {gecikmis.length > 0 && (
        <Bant
          baslik="Gecikmiş"
          renk="kirmizi"
          alt={`${formatNum(gecikmis.length)} sipariş · ${fmtMoney(
            gecikmis.reduce((t, s) => t + eur(s), 0),
            "EUR"
          )}`}
        >
          {gecikmis.map((s) => (
            <SiparisSatiri
              key={s.id}
              s={s}
              bugun={bugun}
              canWrite={canWrite}
              genis={acik.has(s.id)}
              onToggle={() => genislet(s.id)}
              onTumTeslim={() => tumunuTeslimAl(s)}
              onSatirTeslim={(lineId, deger) => satirTeslim(s, lineId, deger)}
            />
          ))}
        </Bant>
      )}

      {terminsiz.length > 0 && (
        <Bant
          baslik="Termini Girilmemiş"
          renk="sari"
          alt={`${formatNum(terminsiz.length)} sipariş — ne zaman geleceği bilinmiyor`}
        >
          {terminsiz.map((s) => (
            <SiparisSatiri
              key={s.id}
              s={s}
              bugun={bugun}
              canWrite={canWrite}
              genis={acik.has(s.id)}
              onToggle={() => genislet(s.id)}
              onTumTeslim={() => tumunuTeslimAl(s)}
              onSatirTeslim={(lineId, deger) => satirTeslim(s, lineId, deger)}
            />
          ))}
        </Bant>
      )}

      {kutular.length === 0 && gecikmis.length === 0 && terminsiz.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {bekleyen.length === 0
              ? "Teslim bekleyen sipariş yok. Sipariş açıldığında ve termin girildiğinde burada görünür."
              : "Bu süzgeçle eşleşen sevkiyat yok."}
          </p>
        </div>
      ) : (
        kutular.map((k) => (
          <Bant
            key={k.donem.key}
            baslik={k.donem.label}
            alt={`${formatNum(k.kayitlar.length)} sipariş · ${fmtMoney(k.toplam, "EUR")}`}
          >
            {k.kayitlar.map((s) => (
              <SiparisSatiri
              key={s.id}
              s={s}
              bugun={bugun}
              canWrite={canWrite}
              genis={acik.has(s.id)}
              onToggle={() => genislet(s.id)}
              onTumTeslim={() => tumunuTeslimAl(s)}
              onSatirTeslim={(lineId, deger) => satirTeslim(s, lineId, deger)}
            />
            ))}
          </Bant>
        ))
      )}

      {/* TESLİM ALINANLAR — en altta, ayrı bant (kullanıcı isteği). Geri Al ile
          yanlış işaret düzeltilir; sipariş yeniden bekleyene döner. */}
      {teslimAlinanlar.length > 0 && (
        <Bant
          baslik="Teslim Alınanlar"
          alt={`${formatNum(teslimAlinanlar.length)} sipariş`}
        >
          {teslimAlinanlar.map((s) => {
            const isler = isNolari(s);
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 first:border-t-0"
              >
                <span className="min-w-[7rem] font-mono text-[12px] whitespace-nowrap text-emerald-700 dark:text-emerald-400">
                  {tarihGoster(s.receivedAt)} ✓
                </span>
                <span className="min-w-0 flex-1 text-[13px]">
                  <span className="font-medium">{s.supplier}</span>
                  {s.orderNo && (
                    <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                      {s.orderNo}
                    </span>
                  )}
                  <span className="block font-mono text-[11px] text-muted-foreground">
                    {formatNum(s.satirlar.length)} kalem
                    {isler.length > 0 &&
                      ` · ${isler.slice(0, 4).join(", ")}${isler.length > 4 ? "…" : ""}`}
                  </span>
                </span>
                <span className="font-mono text-[12px] tabular-nums">
                  {fmtMoney(tutar(s), s.currency)}
                </span>
                {canWrite && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => teslimGeriAl(s)}
                  >
                    Geri Al
                  </Button>
                )}
              </li>
            );
          })}
        </Bant>
      )}
    </div>
  );
}

/**
 * TESLİM SATIRI — açılır kalem detayı (kullanıcı kararı, 14.08.2026):
 * *"Teslim takviminde sipariş iç detayı gibi açılsın, FİYAT OLMASIN, sadece
 * Kalem · İş · Adet. Tamamını ya da kalem bazında teslim al; kalem bazında
 * %kaçı teslim alındığı küçük yazsın ve %oranına göre kırmızıdan yeşile
 * renklensin."*
 *
 * Fiyat başlıkta (özet) durur ama AÇILAN DETAYDA YOKTUR: teslim bir miktar
 * hareketidir, para değil.
 */
function SiparisSatiri({
  s,
  bugun,
  canWrite,
  genis,
  onToggle,
  onTumTeslim,
  onSatirTeslim,
}: {
  s: Siparis;
  bugun: string;
  canWrite: boolean;
  genis: boolean;
  onToggle: () => void;
  onTumTeslim: () => void;
  onSatirTeslim: (lineId: string, deger: string) => void;
}) {
  const kalan = gunFarki(s.dueAt, bugun);
  const isler = isNolari(s);
  const oran = teslimOrani(s);
  const kismi = oran > 0 && oran < 1;

  return (
    <li className="border-t first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={genis}
          aria-label={genis ? "Kalemleri gizle" : "Kalemleri göster"}
          className="grid size-6 shrink-0 place-items-center text-muted-foreground pointer-coarse:size-9 hover:text-foreground"
        >
          {genis ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <span className="min-w-[8rem] font-mono text-[12px] whitespace-nowrap">
          {s.dueAt ? tarihGoster(s.dueAt) : <span className="text-muted-foreground">termin yok</span>}
          {kalan != null && (
            <span
              className={
                "ml-1.5 " +
                (kalan < 0
                  ? "text-destructive"
                  : kalan <= 14
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground")
              }
            >
              {kalan < 0 ? `${Math.abs(kalan)} gün geçti` : `${kalan} gün`}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <span className="font-medium">{s.supplier}</span>
          {s.orderNo && (
            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{s.orderNo}</span>
          )}
          <span className="block font-mono text-[11px] text-muted-foreground">
            {formatNum(s.satirlar.length)} kalem
            {isler.length > 0 && ` · ${isler.slice(0, 4).join(", ")}${isler.length > 4 ? "…" : ""}`}
            {kismi && (
              <span className="ml-1.5" style={{ color: oranRengi(oran) }}>
                · %{Math.round(oran * 100)} teslim
              </span>
            )}
          </span>
        </span>
        <span className="font-mono text-[12px] tabular-nums">{fmtMoney(tutar(s), s.currency)}</span>
        {canWrite && (
          <Button type="button" size="xs" variant="outline" onClick={onTumTeslim}>
            Tamamını Teslim Al
          </Button>
        )}
      </div>

      {genis && (
        <div className="oc-scrollx border-t bg-muted/20 px-3 py-2 [--oc-scroll-bg:var(--muted)]">
          <table className="w-full text-[12px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 text-left font-normal">Kalem</th>
                <th className="py-1 pr-3 text-left font-normal">İş</th>
                <th className="py-1 pr-3 text-right font-normal">Adet</th>
                <th className="py-1 pr-3 text-right font-normal">Teslim</th>
                <th className="py-1 text-right font-normal">%</th>
              </tr>
            </thead>
            <tbody>
              {s.satirlar.map((l) => {
                const satirOran = l.qty > 0 ? Math.min(1, l.receivedQty / l.qty) : 0;
                const satirTam = l.qty > 0 && l.receivedQty >= l.qty;
                return (
                  <tr key={l.id} className="border-t border-border/50">
                    <td className="py-1 pr-3">{l.sample}</td>
                    <td className="py-1 pr-3 font-mono text-muted-foreground">{l.itemNo || "—"}</td>
                    <td className="py-1 pr-3 text-right font-mono tabular-nums">{formatNum(l.qty)}</td>
                    <td className="py-1 pr-3 text-right">
                      {/* TESLİM = BUTON, kutu DEĞİL (kullanıcı bildirimi,
                          14.08.2026: "sadece kutu açmışız içine yazı yazılıyor,
                          bu şekilde olmasın; buton olsun, tekrar bastığında
                          iptal"). Satır bazında teslim İKİLİdir: al → sipariş
                          adedi, tekrar bas → sıfır. */}
                      {canWrite ? (
                        satirTam ? (
                          <button
                            type="button"
                            onClick={() => onSatirTeslim(l.id, "0")}
                            title="Teslimi geri al"
                            className="inline-flex min-h-7 items-center gap-1 border border-emerald-600/40 bg-emerald-600/10 px-1.5 text-[11px] whitespace-nowrap text-emerald-700 transition-colors hover:border-emerald-600/70 pointer-coarse:min-h-9 dark:text-emerald-400"
                          >
                            Teslim Alındı ✓
                          </button>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => onSatirTeslim(l.id, String(l.qty))}
                          >
                            Teslim Al
                          </Button>
                        )
                      ) : (
                        <span className="font-mono tabular-nums">{formatNum(l.receivedQty)}</span>
                      )}
                    </td>
                    <td
                      className="py-1 text-right font-mono font-medium tabular-nums"
                      style={{ color: oranRengi(satirOran) }}
                    >
                      %{Math.round(satirOran * 100)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}
