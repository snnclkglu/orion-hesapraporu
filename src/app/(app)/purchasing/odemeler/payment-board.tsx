"use client";

// Ödeme takvimi panosu — finansa verilecek nakit çıkış planı.
//
// SATIR BİR ÖDEMEDİR, BİR SİPARİŞ DEĞİL: avans sipariş gününde, bakiye teslim +
// vade gününde çıkar ve ikisi farklı aylara düşer. Tek satırda göstermek, ayın
// toplamını yanlış yapardı — bu ekranın tek işi o toplamı doğru vermektir.
//
// TOPLAMLAR AVRODADIR ve kuru olmayan satır toplama GİRMEZ; ayrıca sayılır.
// Satış Takibi'nde öğrenilen kural (md. 16): kuru eksik satır sessizce
// kaybolmamalı.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RankBars, SplitBar, TimeLineChart } from "@/components/charts";
import { fmtCompactEur, fmtCompactEur1, fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import { bugunISO, gunFarki, tarihGoster } from "@/lib/purchasing/terms";
import { donemlere, sirala, type Kip } from "@/lib/purchasing/summary";
import { hueFromText } from "@/lib/tags";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";
import { CokluSuzgec } from "../filters";
import { Bant, KipSecici, PanoKabugu } from "../board-ui";
import { updateOrder } from "../actions";
import { updateConsumablePaymentPaidAt } from "../sarf/actions";
import { OdemeTarihi } from "@/components/odeme-tarihi";

export interface OdemeSatiri {
  id: string;
  orderId: string;
  tur: "avans" | "bakiye" | "tamami" | "sarf";
  source: "order" | "consumable";
  supplier: string;
  orderNo: string;
  /** Ödeme günü; hesaplanamıyorsa `null` (termin de teslim de yok). */
  gun: string | null;
  /**
   * ÖDENECEK tutar — KDV DAHİL (kullanıcı kararı, 14.08.2026).
   *
   * Bu ekranın müşterisi finanstır ve sorusu "kasadan ne çıkacak"tır; KDV o
   * paranın parçasıdır. Maliyet sorusunun cevabı `tutarNet`tir ve bütün
   * analizler (fiyat arşivi, tedarikçi dağılımı, sarf panosu) onu okur.
   */
  tutar: number;
  /** KDV hariç karşılığı; kaynak sütunu yoksa `null` (uydurulmaz). */
  tutarNet: number | null;
  /** Ödemenin içindeki KDV; kaynak sütunu yoksa `null`. */
  tutarKdv: number | null;
  currency: string;
  tutarEur: number | null;
  odendi: boolean;
  odendiGun: string | null;
  kalemSayisi: number;
  isler: string[];
}

const TUR_ETIKET: Record<OdemeSatiri["tur"], string> = {
  avans: "Avans",
  bakiye: "Bakiye",
  tamami: "Tamamı",
  sarf: "Sarf Gideri",
};

interface Filtreler {
  query: string;
  tedarikciler: string[];
  turler: string[];
  isler: string[];
}

const BOS: Filtreler = { query: "", tedarikciler: [], turler: [], isler: [] };

export function PaymentBoard({
  satirlar,
  canWrite,
}: {
  satirlar: OdemeSatiri[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [kip, setKip] = useState<Kip>("ay");
  const [odenenler, setOdenenler] = useState(false);
  const [pano, setPano] = useState(true);
  const [f, setF] = useState<Filtreler>(BOS);

  const bugun = bugunISO();
  const kapsam = useMemo(
    () => satirlar.filter((s) => odenenler || !s.odendi),
    [satirlar, odenenler]
  );

  const secenekler = useMemo(() => {
    const say = (fn: (s: OdemeSatiri) => string[]) => {
      const m = new Map<string, number>();
      for (const s of kapsam) for (const v of fn(s)) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const ted = say((s) => [s.supplier]);
    const tur = say((s) => [s.tur]);
    const is = say((s) => s.isler);
    return {
      tedarikciler: [...ted.keys()]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((v) => ({ value: v, label: v, count: ted.get(v) })),
      turler: (["avans", "bakiye", "tamami", "sarf"] as OdemeSatiri["tur"][])
        .filter((t) => tur.has(t))
        .map((t) => ({ value: t, label: TUR_ETIKET[t], count: tur.get(t) })),
      isler: [...is.keys()]
        .sort((a, b) => a.localeCompare(b, "tr"))
        .map((v) => ({ value: v, label: v, count: is.get(v) })),
    };
  }, [kapsam]);

  const gorunen = useMemo(() => {
    const q = f.query.trim().toLocaleLowerCase("tr-TR");
    const ted = new Set(f.tedarikciler);
    const tur = new Set(f.turler);
    const is = new Set(f.isler);
    return kapsam.filter((s) => {
      if (ted.size > 0 && !ted.has(s.supplier)) return false;
      if (tur.size > 0 && !tur.has(s.tur)) return false;
      if (is.size > 0 && !s.isler.some((n) => is.has(n))) return false;
      if (!q) return true;
      return [s.supplier, s.orderNo, ...s.isler]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(q);
    });
  }, [kapsam, f]);

  const { tarihsiz, gecikmis, kutular, toplamEur, kursuz } = useMemo(() => {
    const tarihsiz = gorunen.filter((s) => !s.gun);
    const gecikmis = gorunen
      .filter((s) => s.gun && !s.odendi && (gunFarki(s.gun, bugun) ?? 0) < 0)
      .sort((a, b) => (a.gun ?? "").localeCompare(b.gun ?? ""));
    const gelecek = gorunen.filter(
      (s) => s.gun && (s.odendi || (gunFarki(s.gun, bugun) ?? 0) >= 0)
    );
    const { kutular } = donemlere(gelecek, (s) => s.gun, (s) => s.tutarEur ?? 0, kip);
    return {
      tarihsiz,
      gecikmis,
      kutular,
      toplamEur: gorunen.filter((s) => !s.odendi).reduce((t, s) => t + (s.tutarEur ?? 0), 0),
      kursuz: gorunen.filter((s) => s.tutarEur == null).length,
    };
  }, [gorunen, kip, bugun]);

  /**
   * Ödeme işaretini YAZAR ya da KALDIRIR.
   *
   * Kullanıcı bildirimi (13.08.2026): *"Ödeme takviminde ödendiye basıldığında
   * geri alınmıyor. Yanlışlıkla basabilir kullanıcı. Tekrar bastığında iptal
   * edilsin."* Haklı ve tek yönlü olması bir tasarım kararı değil bir
   * eksiklikti: Siparişler ekranında aynı işaret baştan beri geri alınabiliyor
   * (`orders-view.tsx`), takvimde alınamıyordu — aynı veriyi yazan iki ekranın
   * biri kapıyı açık bırakıp diğeri kilitliyordu.
   *
   * `tarih` boş dizgi ise alan TEMİZLENİR (`updateOrder`ın kuralı).
   */
  function odemeYaz(s: OdemeSatiri, tarih: string) {
    if (!canWrite) return;
    if (s.source === "consumable") {
      updateConsumablePaymentPaidAt({ paymentGroupId: s.orderId, paidAt: tarih }).then((sonuc) => {
        if (sonuc.error) toast.error(sonuc.error);
        else {
          toast.success(tarih ? `${s.supplier} · Sarf gideri ödendi.` : `${s.supplier} · Sarf ödeme işareti kaldırıldı.`);
          router.refresh();
        }
      });
      return;
    }
    const alan = s.tur === "avans" ? { advancePaidAt: tarih } : { balancePaidAt: tarih };
    updateOrder({ id: s.orderId, ...alan }).then((sonuc) => {
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(
          tarih
            ? `${s.supplier} · ${TUR_ETIKET[s.tur]} ödendi.`
            : `${s.supplier} · ${TUR_ETIKET[s.tur]} ödeme işareti kaldırıldı.`
        );
        router.refresh();
      }
    });
  }

  const eurFmt = (v: number) => fmtMoney(v, "EUR");

  const zamanSerisi = useMemo(
    () =>
      kutular.map((k) => ({
        key: k.donem.key,
        label: k.donem.label,
        total: k.toplam,
        parts: {
          avans: k.kayitlar
            .filter((s) => s.tur === "avans")
            .reduce((t, s) => t + (s.tutarEur ?? 0), 0),
          bakiye: k.kayitlar
            .filter((s) => s.tur !== "avans")
            .reduce((t, s) => t + (s.tutarEur ?? 0), 0),
        },
      })),
    [kutular]
  );

  const tedarikciCubuklari = useMemo(
    () =>
      sirala(
        gorunen.filter((s) => !s.odendi),
        (s) => s.supplier,
        (s) => s.tutarEur ?? 0,
        { ipucu: (_a, l) => `${l.length} ödeme` }
      ),
    [gorunen]
  );

  const turSeridi = useMemo(() => {
    const acik = gorunen.filter((s) => !s.odendi);
    const toplam = acik.reduce((t, s) => t + (s.tutarEur ?? 0), 0);
    return (["avans", "bakiye", "tamami", "sarf"] as OdemeSatiri["tur"][])
      .map((t) => {
        const grup = acik.filter((s) => s.tur === t);
        const value = grup.reduce((x, s) => x + (s.tutarEur ?? 0), 0);
        return {
          key: t,
          label: TUR_ETIKET[t],
          hue: hueFromText(t),
          value,
          share: toplam > 0 ? value / toplam : 0,
          records: grup.length,
        };
      })
      .filter((x) => x.value > 0);
  }, [gorunen]);

  return (
    <div className="grid gap-3">
      <section className="flex flex-wrap items-center gap-4 border bg-card p-3">
        <div>
          <span className="oc-kicker block text-muted-foreground">Ödenecek Toplam (KDV Dahil)</span>
          <span className="block font-mono text-lg tabular-nums">{fmtMoney(toplamEur, "EUR")}</span>
        </div>
        {gecikmis.length > 0 && (
          <div>
            <span className="oc-kicker block text-muted-foreground">Vadesi Geçmiş</span>
            <span className="block font-mono text-lg text-destructive tabular-nums">
              {fmtMoney(
                gecikmis.reduce((t, s) => t + (s.tutarEur ?? 0), 0),
                "EUR"
              )}
            </span>
          </div>
        )}
        {kursuz > 0 && (
          <div title="Kuru girilmemiş ödeme avro toplamına giremez">
            <span className="oc-kicker block text-muted-foreground">Kuru Eksik</span>
            <span className="block font-mono text-lg text-amber-700 tabular-nums dark:text-amber-400">
              {formatNum(kursuz)}
            </span>
          </div>
        )}
        <span className="ml-auto flex items-center gap-2">
          <KipSecici kip={kip} onChange={setKip} />
          <Button
            type="button"
            size="xs"
            variant={odenenler ? "default" : "outline"}
            onClick={() => setOdenenler((o) => !o)}
          >
            Ödenenler
          </Button>
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
          <PanoKabugu baslik="Nakit Çıkış Planı" alt={`${zamanSerisi.length} dönem`}>
            <TimeLineChart
              columns={zamanSerisi}
              series={[
                { key: "avans", label: "Avans", hue: 30 },
                { key: "bakiye", label: "Bakiye", hue: 210 },
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
              emptyText="Ödenecek yok"
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
          {/* AVANS VE BAKİYE BİR BÜTÜNÜN İKİ PARÇASIDIR ve toplamları
              "ödenecek"tir — ama iki dilimli bir halka, iki sayıyı yan yana
              yazmaktan fazlasını söylemiyordu (kullanıcı bildirimi,
              13.08.2026). Şerit oranı doğrudan uzunlukla verir ve kartın
              genişliğini kullanır. */}
          {turSeridi.length > 0 && (
            <PanoKabugu baslik="Avans / Bakiye" alt="ödenmemiş" className="lg:col-span-2">
              <SplitBar
                items={turSeridi}
                format={eurFmt}
                valueLabel="€"
                emptyText="Ödenecek yok"
                toplamEtiketi="Ödenecek"
              />
            </PanoKabugu>
          )}
        </div>
      )}

      <FilterBar
        gorunen={gorunen.length}
        toplam={kapsam.length}
        temiz={JSON.stringify(f) === JSON.stringify(BOS)}
        onTemizle={() => setF(BOS)}
      >
        <SearchBox
          value={f.query}
          onChange={(v) => setF((s) => ({ ...s, query: v }))}
          placeholder="Tedarikçi, Sipariş No, İş Ara…"
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
          baslik="Tür"
          secenekler={secenekler.turler}
          secili={f.turler}
          onChange={(v) => setF((s) => ({ ...s, turler: v }))}
        />
      </FilterBar>

      {gecikmis.length > 0 && (
        <Bant
          baslik="Vadesi Geçmiş"
          renk="kirmizi"
          alt={`${formatNum(gecikmis.length)} ödeme · ${fmtMoney(
            gecikmis.reduce((t, s) => t + (s.tutarEur ?? 0), 0),
            "EUR"
          )}`}
        >
          {gecikmis.map((s) => (
            <Satir key={s.id} s={s} bugun={bugun} canWrite={canWrite} onOde={odemeYaz} />
          ))}
        </Bant>
      )}

      {tarihsiz.length > 0 && (
        <Bant
          baslik="Ödeme Günü Belirsiz"
          renk="sari"
          alt={`${formatNum(tarihsiz.length)} ödeme — termin ya da teslim tarihi girilmemiş`}
        >
          {tarihsiz.map((s) => (
            <Satir key={s.id} s={s} bugun={bugun} canWrite={canWrite} onOde={odemeYaz} />
          ))}
        </Bant>
      )}

      {kutular.length === 0 && gecikmis.length === 0 && tarihsiz.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {satirlar.length === 0
              ? "Planlanmış ödeme yok. Sipariş açıldığında avans ve bakiye ödemeleri buraya düşer."
              : "Bu süzgeçle eşleşen ödeme yok."}
          </p>
        </div>
      ) : (
        kutular.map((k) => (
          <Bant
            key={k.donem.key}
            baslik={k.donem.label}
            alt={`${formatNum(k.kayitlar.length)} ödeme · ${fmtMoney(k.toplam, "EUR")}`}
          >
            {k.kayitlar.map((s) => (
              <Satir key={s.id} s={s} bugun={bugun} canWrite={canWrite} onOde={odemeYaz} />
            ))}
          </Bant>
        ))
      )}
    </div>
  );
}

function Satir({
  s,
  bugun,
  canWrite,
  onOde,
}: {
  s: OdemeSatiri;
  bugun: string;
  canWrite: boolean;
  onOde: (s: OdemeSatiri, tarih: string) => void;
}) {
  const kalan = gunFarki(s.gun, bugun);
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 first:border-t-0 ${s.source === "consumable" ? "bg-sky-500/[0.07] dark:bg-sky-400/[0.08]" : ""}`}>
      <span className="min-w-[8rem] font-mono text-[12px] whitespace-nowrap">
        {s.gun ? tarihGoster(s.gun) : <span className="text-muted-foreground">tarih yok</span>}
        {kalan != null && !s.odendi && (
          <span
            className={
              "ml-1.5 " +
              (kalan < 0
                ? "text-destructive"
                : kalan <= 7
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground")
            }
          >
            {kalan < 0 ? `${Math.abs(kalan)} gün geçti` : `${kalan} gün`}
          </span>
        )}
      </span>

      <span className="inline-flex min-h-6 items-center border border-dashed px-1.5 text-[11px] text-muted-foreground">
        {TUR_ETIKET[s.tur]}
      </span>

      <span className="min-w-0 flex-1 text-[13px]">
        <span className="font-medium">{s.supplier}</span>
        {s.orderNo && (
          <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{s.orderNo}</span>
        )}
        <span className="block font-mono text-[11px] text-muted-foreground">
          {formatNum(s.kalemSayisi)} kalem
          {s.isler.length > 0 && ` · ${s.isler.slice(0, 4).join(", ")}${s.isler.length > 4 ? "…" : ""}`}
        </span>
      </span>

      <span className="text-right font-mono text-[12px] tabular-nums">
        {fmtMoney(s.tutar, s.currency)}
        {/* KDV KIRILIMI SATIRDA GÖRÜNÜR (kullanıcı kararı, 14.08.2026): büyük
            sayı ödenecek paradır, altındaki satır onun neresinin vergi
            olduğunu söyler. Kaynak sütunu yoksa hiçbir şey yazılmaz —
            uydurulmuş bir kırılım, boş bir alandan pahalıdır. */}
        {s.tutarNet != null && s.tutarKdv != null && (
          <span className="block text-[11px] text-muted-foreground">
            net {fmtMoney(s.tutarNet, s.currency)} + KDV {fmtMoney(s.tutarKdv, s.currency)}
          </span>
        )}
        {s.tutarEur == null ? (
          <span className="block text-[11px] text-amber-700 dark:text-amber-400">kur yok</span>
        ) : (
          s.currency !== "EUR" && (
            <span className="block text-[11px] text-muted-foreground">
              {fmtMoney(s.tutarEur, "EUR")}
            </span>
          )
        )}
      </span>

      {/* İŞARET GERİ ALINABİLİR ve GÜNÜ SORULUR — Siparişler ekranındaki
          davranışın aynısı. Salt-okunur kullanıcı yalnız sonucu görür. */}
      {canWrite ? (
        <OdemeTarihi
          baslik={TUR_ETIKET[s.tur]}
          varsayilan={s.odendiGun ?? undefined}
          onSec={(t) => onOde(s, t)}
          onKaldir={s.odendi ? () => onOde(s, "") : undefined}
        >
          {s.odendi ? (
            <button
              type="button"
              title="Ödeme gününü düzelt ya da işareti kaldır"
              className="inline-flex min-h-7 items-center border border-emerald-600/40 bg-emerald-600/10 px-1.5 text-[11px] whitespace-nowrap text-emerald-700 transition-colors hover:border-emerald-600/70 dark:text-emerald-400"
            >
              Ödendi {s.odendiGun ? `· ${tarihGoster(s.odendiGun)}` : ""}
            </button>
          ) : (
            <Button type="button" size="xs" variant="outline">
              Ödendi
            </Button>
          )}
        </OdemeTarihi>
      ) : (
        s.odendi && (
          <span className="inline-flex min-h-7 items-center border border-emerald-600/40 bg-emerald-600/10 px-1.5 text-[11px] whitespace-nowrap text-emerald-700 dark:text-emerald-400">
            Ödendi {s.odendiGun ? `· ${tarihGoster(s.odendiGun)}` : ""}
          </span>
        )
      )}
    </li>
  );
}
