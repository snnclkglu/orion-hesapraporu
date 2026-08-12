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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RankBars, TimeBarChart } from "@/components/charts";
import { fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import { bugunISO, eurKarsiligi, gunFarki, tarihGoster } from "@/lib/purchasing/terms";
import { donemlere, sirala, type Kip } from "@/lib/purchasing/summary";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";
import { CokluSuzgec } from "../filters";
import { Bant, KipSecici, PanoKabugu } from "../board-ui";
import type { Siparis } from "../data";
import { updateOrder } from "../actions";

function tutar(s: Siparis): number {
  return s.satirlar.reduce((t, l) => t + l.qty * (l.unitPrice ?? 0), 0);
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
  const [kip, setKip] = useState<Kip>("ay");
  const [pano, setPano] = useState(true);
  const [f, setF] = useState<Filtreler>(BOS);

  const bugun = bugunISO();
  // EKRANIN KAPSAMI: teslim alınmamış siparişler. "Ne bekliyorum" sorusu bu.
  const bekleyen = useMemo(() => siparisler.filter((s) => !s.receivedAt), [siparisler]);

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

  function teslimAl(s: Siparis) {
    if (!canWrite) return;
    updateOrder({ id: s.id, receivedAt: bugun }).then((sonuc) => {
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(`${s.supplier} siparişi teslim alındı.`);
        router.refresh();
      }
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
            <TimeBarChart
              columns={zamanSerisi}
              series={[
                { key: "yakin", label: "14 gün içinde", hue: 45 },
                { key: "planli", label: "Planlı", hue: 210 },
              ]}
              valueLabel="€"
              format={eurFmt}
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
            <SiparisSatiri key={s.id} s={s} bugun={bugun} canWrite={canWrite} onTeslim={teslimAl} />
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
            <SiparisSatiri key={s.id} s={s} bugun={bugun} canWrite={canWrite} onTeslim={teslimAl} />
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
              <SiparisSatiri key={s.id} s={s} bugun={bugun} canWrite={canWrite} onTeslim={teslimAl} />
            ))}
          </Bant>
        ))
      )}
    </div>
  );
}

function SiparisSatiri({
  s,
  bugun,
  canWrite,
  onTeslim,
}: {
  s: Siparis;
  bugun: string;
  canWrite: boolean;
  onTeslim: (s: Siparis) => void;
}) {
  const kalan = gunFarki(s.dueAt, bugun);
  const isler = isNolari(s);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 first:border-t-0">
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
        </span>
      </span>
      <span className="font-mono text-[12px] tabular-nums">{fmtMoney(tutar(s), s.currency)}</span>
      {canWrite && (
        <Button type="button" size="xs" variant="outline" onClick={() => onTeslim(s)}>
          Teslim Alındı
        </Button>
      )}
    </li>
  );
}
