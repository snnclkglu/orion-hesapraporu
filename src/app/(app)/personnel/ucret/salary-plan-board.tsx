"use client";

// Ücret Planı panosu — bir yılın ücret kararı tek ekranda kurulur.
//
// TASARIM ÖLÇÜTÜ: kırk kişiye yıl başı zammı yapmanın kaç adım sürdüğü.
// Kullanıcının anlattığı iş şu: "%5 10 15 20 25 veya kendi istediğim oranda
// kişilere zam verebileyim." Ekran bunu üç harekete indirir — kişileri seç,
// orana bas, kaydet. Seçim yapılmamışsa oran HERKESE uygulanır (en sık hâl).
//
// TABAN, ZAM ORANI VE YENİ ÜCRET AYNI SATIRDA VE ÇİFT YÖNLÜDÜR: kullanıcı ya
// oranı yazar (ücret hesaplanır) ya ücreti yazar (oran hesaplanır). Tek yönlü
// olsaydı "şu kişiyi 60.000'e çıkaralım" gibi son derece sıradan bir karar
// hesap makinesi gerektirirdi.
//
// EKRAN KENDİNİ YILDAN YILA GÜNCELLER — hiçbir yıl sabit yazılmaz. Taban her
// zaman "seçili yıldan bir önceki yılın ARALIK ayında geçerli ücret"tir
// (`yilBasiTabani`), sütun başlıkları da `yil`den türer. 2027 Ocak'ta sayfa
// açıldığında "2026 Sonu Ücret" / "2027 Net Ücret" olur; 2028'de aynısı 2027
// için işler. Yeni bir kod ya da migration gerekmez.
//
// SAYILAR METİN OLARAK TUTULUR ve yalnız kaydederken sayıya çevrilir
// (`parseNum`, projenin her yerdeki kalıbı).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Percent,
  Save,
  Sigma,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/stat-card";
import { ParaInput } from "@/components/para-input";
import { fmtNum, fmtTutar, parseNum } from "@/lib/currency";
import { tagStyle } from "@/lib/tags";
import { categoryHue, categoryLabel } from "@/lib/personnel/employee";
import { periodLabel } from "@/lib/personnel/payroll";
import {
  DEFAULT_ROUND_STEP,
  EN_ESKI_PLAN_YILI,
  RAISE_PRESETS,
  RAISE_REASON_LABELS,
  ROUND_STEPS,
  gecerliUcret,
  olcekTonu,
  yilBasiTabani,
  zamOrani,
  zamTonu,
  zamliUcret,
  type RaiseReason,
} from "@/lib/personnel/salary-plan";
import { cn } from "@/lib/utils";
import { applyRaiseBatch, deleteSalaryPlan, saveSalaryPlan } from "../actions";
import type { EmployeeRow, PayrollRow, SalaryPlanRow } from "../schema";

// ————————————————————————————————————————————————————————————— yardımcılar

/** Düzenlenebilir metin: binlik ayıraç YOK (yazarken bozulmasın), virgül var. */
const GIRDI_FMT = new Intl.NumberFormat("tr-TR", {
  useGrouping: false,
  maximumFractionDigits: 2,
});

function girdiMetni(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "" : GIRDI_FMT.format(v);
}

/** Oran metni — iki hane yeter; "%14,9997" bir karar değil bir artıktır. */
function oranMetni(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v)
    ? ""
    : GIRDI_FMT.format(Math.round(v * 100) / 100);
}

const AT_SM = "hidden sm:table-cell";
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

const HUCRE_INPUT =
  "h-8 px-2 text-right font-mono text-base tabular-nums pointer-coarse:h-10 pointer-fine:text-sm";

/** Satırın düzenlenen alanları — ikisi de metindir (bkz. dosya başlığı). */
interface Taslak {
  net: string;
  oran: string;
}

const AY_SECENEKLERI = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12",
];

export function SalaryPlanBoard({
  yil,
  buYil,
  employees,
  plans,
  payroll,
  canWrite,
}: {
  yil: number;
  buYil: number;
  employees: EmployeeRow[];
  plans: SalaryPlanRow[];
  /** Yalnız TABAN ÖNERİSİ için: planı olmayan kişinin son ödenen maaşı. */
  payroll: PayrollRow[];
  canWrite: boolean;
}) {
  const router = useRouter();

  const [taslaklar, setTaslaklar] = useState<Record<string, Taslak>>({});
  const [secili, setSecili] = useState<Set<string>>(() => new Set());
  const [adim, setAdim] = useState<number>(DEFAULT_ROUND_STEP);
  const [serbestOran, setSerbestOran] = useState("");
  const [ayrilanlar, setAyrilanlar] = useState(false);
  const [araPencere, setAraPencere] = useState(false);
  const [bekleyen, startTransition] = useTransition();

  // YIL DEĞİŞİNCE taslaklar sıfırlanır. Bileşen adres değişiminde yeniden
  // KURULMAZ, aynı örnek yeni proplarla boyanır — sıfırlanmasaydı 2026 için
  // yazılan yarım bir sayı 2027 satırında görünürdü ("prop değişince durumu
  // ayarla" deseni; payroll-board ile aynı).
  const [kaynakYil, setKaynakYil] = useState(yil);
  if (kaynakYil !== yil) {
    setKaynakYil(yil);
    setTaslaklar({});
    setSecili(new Set());
    setSerbestOran("");
  }

  const donem = `${yil}-01`;
  // 2024'ten geriye gidilmez (kullanıcı kararı): devralınan maaş kaydı Mayıs
  // 2024'te başlar, öncesinde ne ücret kararı ne zam tabanı var.
  const geriGidilir = yil > EN_ESKI_PLAN_YILI;

  function goYil(y: number) {
    router.replace(`/personnel/ucret?yil=${y}`);
  }

  /** Kişinin PLANI YOKSA taban önerisi: hedef yıldan ÖNCEKİ son ödenen maaş. */
  const sonOdenen = useMemo(() => {
    const m = new Map<string, { period: string; net: number }>();
    for (const p of payroll) {
      if (p.period >= donem || !(p.netSalary > 0)) continue;
      const mevcut = m.get(p.employeeId);
      if (!mevcut || p.period > mevcut.period) {
        m.set(p.employeeId, { period: p.period, net: p.netSalary });
      }
    }
    return m;
  }, [payroll, donem]);

  /**
   * Yıl içi (ocak DIŞI) ayarlamalar — KİŞİ BAŞINA.
   *
   * AYRI BİR TABLO BÖLÜMÜ YOKTUR (kullanıcı kararı, 13.08.2026: "2026 Yıl İçi
   * Ayarlamaları bölümünü kaldıralım"). Ayarlama yılda bir iki kez olur ve
   * kendi başlığı, kendi sütun düzeni ve kendi boşluğu olan bir bölüm o
   * seyrekliğe göre çok yer kaplıyordu. Ama kayıt GÖRÜNMEZ OLAMAZ — yanlış
   * girilmiş bir ayarlamayı silmenin başka yolu kalmazdı; bu yüzden kişinin
   * KENDİ SATIRINDA küçük bir çip olarak durur.
   */
  const araKararlar = useMemo(() => {
    const m = new Map<string, SalaryPlanRow[]>();
    for (const p of plans) {
      if (!p.effectiveFrom.startsWith(`${yil}-`) || p.effectiveFrom.endsWith("-01")) continue;
      const liste = m.get(p.employeeId) ?? [];
      liste.push(p);
      m.set(p.employeeId, liste);
    }
    for (const liste of m.values()) liste.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    return m;
  }, [plans, yil]);

  const satirlar = useMemo(() => {
    return employees
      .filter((e) => ayrilanlar || e.active)
      .map((e) => {
        // Bu yılın OCAK kararı — varsa taslağın başlangıç değeridir.
        const mevcut =
          plans.find((p) => p.employeeId === e.id && p.effectiveFrom === donem) ?? null;

        // TABAN ÜÇ KAYNAKTAN, BU SIRAYLA — hepsi GERÇEK bir kayıttır:
        //  1. Bir önceki yılın ARALIK ayında geçerli ücret KARARI (kişi
        //     eylülde ara ayarlama aldıysa zam onun üstünedir).
        //  2. Hedef yıldan önce ÖDENMİŞ son maaş (plan defteri yenidir).
        //  3. Bu yılın kararının KENDİ kayıtlı tabanı (`previousNet`).
        const tabanPlan = yilBasiTabani(plans, e.id, yil);
        const odenen = sonOdenen.get(e.id) ?? null;
        const taban = tabanPlan?.netSalary ?? odenen?.net ?? mevcut?.previousNet ?? null;
        const tabanKaynak: "plan" | "maas" | "karar" | "yok" = tabanPlan
          ? "plan"
          : odenen
            ? "maas"
            : mevcut?.previousNet != null
              ? "karar"
              : "yok";

        // KULLANICI DOKUNDU MU? Taslak sözlüğüne yalnız gerçek bir düzenleme
        // (satır girişi ya da toplu zam) yazar; varsayılan değerler ORAYA
        // GİRMEZ. Fark önemli: aşağıdaki "sayfa 0 ile açılsın" kuralı yüzünden
        // her satır dolu görünür ve dokunulmuşluk sorulmasaydı ekran açılır
        // açılmaz "Kaydet (40)" yanardı — kullanıcı hiçbir karar vermemişken.
        const dokunuldu = taslaklar[e.id] !== undefined;

        /*
         * SAYFA "ZAM UYGULANMAMIŞ" AÇILIR (kullanıcı kararı, 13.08.2026).
         *
         * Kararı henüz verilmemiş satırda oran 0, yeni ücret ise TABANIN
         * KENDİSİDİR — yani ekran "bu yıl henüz zam yok" der ve kullanıcı
         * orana basınca hepsi birden hareket eder. Boş kutu bırakmak aynı şeyi
         * söylemiyordu: toplam kartı belirlenmemiş kişileri saymak zorunda
         * kalıyor, "0 mı yoksa henüz mü?" sorusu ekranda cevapsız duruyordu.
         *
         * KAYDEDİLMİŞ KARAR EZİLMEZ: orada gerçek oran görünür. 155.000
         * tabanının yanında 180.000 yazıp "%0" demek, ekranın kendisiyle
         * çelişmesi olurdu.
         */
        const taslak: Taslak =
          taslaklar[e.id] ??
          (mevcut
            ? {
                net: girdiMetni(mevcut.netSalary),
                oran: oranMetni(zamOrani(taban, mevcut.netSalary)),
              }
            : taban !== null
              ? { net: girdiMetni(taban), oran: "0" }
              : { net: "", oran: "" });

        const yeni = parseNum(taslak.net);
        const oran = zamOrani(taban, yeni);
        return {
          emp: e,
          taban,
          tabanKaynak,
          tabanDonem: tabanPlan?.effectiveFrom ?? odenen?.period ?? null,
          mevcut,
          ara: araKararlar.get(e.id) ?? [],
          taslak,
          yeni,
          oran,
          fark: taban !== null && yeni !== null ? yeni - taban : null,
          // Kaydedilecek mi? Kullanıcı DOKUNDU ve sonuç kayıtlı karardan farklı.
          degisti:
            dokunuldu && yeni !== null && yeni > 0 && (mevcut === null || mevcut.netSalary !== yeni),
        };
      })
      .sort(
        (a, b) =>
          a.emp.category.localeCompare(b.emp.category, "tr") ||
          a.emp.fullName.localeCompare(b.emp.fullName, "tr")
      );
  }, [employees, plans, taslaklar, yil, donem, sonOdenen, ayrilanlar, araKararlar]);

  /**
   * ÜCRET RENK ÖLÇEĞİNİN UÇLARI — LİSTEYE GÖRELİ (kullanıcı isteği,
   * 13.08.2026: "maaş fiyat büyüklüğüne göre fiyatta renklendirme olsun; az
   * kırmızı fazla yeşil").
   *
   * Mutlak bir eşik olamazdı: bu listede 33.000 ₺'lik bir yemekhane ücretiyle
   * 205.000 ₺'lik bir genel müdür ücreti yan yana duruyor ve sabit bir sınır
   * ya hepsini kırmızı ya hepsini yeşil yapardı. Uçlar EKRANDA GÖRÜNEN
   * satırlardan çıkar; ayrılanları açmak ölçeği yeniden gerer ve doğrusu budur
   * — renk "bu listede nerede duruyor" sorusunun cevabıdır.
   */
  const ucretAraligi = useMemo(() => {
    const degerler = satirlar
      .map((r) => r.yeni ?? r.taban)
      .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
    return degerler.length > 0
      ? { min: Math.min(...degerler), max: Math.max(...degerler) }
      : { min: 0, max: 0 };
  }, [satirlar]);

  const toplamlar = useMemo(() => {
    let tabanToplam = 0;
    let yeniToplam = 0;
    let oranli = 0;
    let oranToplam = 0;
    let kararli = 0;
    for (const r of satirlar) {
      if (r.taban !== null) tabanToplam += r.taban;
      // Ücreti henüz belirlenmemiş kişi YENİ TOPLAMDA tabanıyla sayılır:
      // "0" yazmak, henüz karar verilmemiş bir kişiyi "ücretsiz" göstermek
      // olurdu ve toplam farkı olduğundan büyük çıkardı.
      yeniToplam += r.yeni ?? r.taban ?? 0;
      if (r.mevcut !== null || r.degisti) kararli += 1;
      if (r.oran !== null) {
        oranli += 1;
        oranToplam += r.oran;
      }
    }
    return {
      tabanToplam,
      yeniToplam,
      fark: yeniToplam - tabanToplam,
      ortalamaOran: oranli > 0 ? oranToplam / oranli : null,
      kararli,
      kisi: satirlar.length,
      degisen: satirlar.filter((r) => r.degisti).length,
    };
  }, [satirlar]);

  // ————————————————————————————————————————————————————————————— yazma

  function setSatir(id: string, patch: Partial<Taslak>, mevcut: Taslak) {
    setTaslaklar((prev) => ({ ...prev, [id]: { ...mevcut, ...patch } }));
  }

  /** Oran yazıldı → ücret hesaplanır. */
  function oranYaz(r: (typeof satirlar)[number], ham: string) {
    const o = parseNum(ham);
    const net = r.taban !== null && o !== null ? zamliUcret(r.taban, o, adim) : null;
    setSatir(r.emp.id, { oran: ham, net: net === null ? r.taslak.net : girdiMetni(net) }, r.taslak);
  }

  /** Ücret yazıldı → oran hesaplanır. */
  function netYaz(r: (typeof satirlar)[number], ham: string) {
    const n = parseNum(ham);
    const o = zamOrani(r.taban, n);
    setSatir(r.emp.id, { net: ham, oran: o === null ? "" : oranMetni(o) }, r.taslak);
  }

  /**
   * TOPLU ZAM — seçili kişilere (seçim yoksa HERKESE) oranı uygular.
   *
   * "Seçim yoksa herkese" bilinçli: yıl başı zammı çoğu zaman bütün kadroya
   * aynı orandan verilir ve kırk kutuyu tek tek işaretletmek, düğmeyi
   * kullanılmaz yapardı. Ayrı davranan kişiler sonradan tek tek düzeltilir.
   */
  function toplu(oranYuzde: number) {
    const hedef = satirlar.filter((r) => (secili.size === 0 || secili.has(r.emp.id)) && r.taban !== null);
    if (hedef.length === 0) {
      toast.error("Zam uygulanacak kişi yok — tabanı olmayan kişiye oran verilemez.");
      return;
    }
    setTaslaklar((prev) => {
      const next = { ...prev };
      for (const r of hedef) {
        next[r.emp.id] = {
          oran: oranMetni(oranYuzde),
          net: girdiMetni(zamliUcret(r.taban, oranYuzde, adim)),
        };
      }
      return next;
    });
    toast.success(
      `${hedef.length} kişiye %${fmtNum(oranYuzde)} uygulandı — kaydetmeden yazılmaz.`
    );
  }

  function kaydet() {
    const degisenler = satirlar.filter((r) => r.degisti);
    if (degisenler.length === 0) {
      toast.error("Kaydedilecek değişiklik yok.");
      return;
    }
    startTransition(async () => {
      const res = await applyRaiseBatch({
        effectiveFrom: donem,
        reason: "yillik",
        note: "",
        rows: degisenler.map((r) => ({
          employeeId: r.emp.id,
          netSalary: r.yeni as number,
          previousNet: r.taban,
          raisePct: r.oran,
        })),
      });
      if (res.error && !res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.error) toast.error(res.error);
      setTaslaklar({});
      setSecili(new Set());
      toast.success(`${yil} yılı ücret planı — ${res.yazilan ?? 0} kişi kaydedildi.`);
      router.refresh();
    });
  }

  function araKarariSil(id: string, ad: string) {
    startTransition(async () => {
      const res = await deleteSalaryPlan(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${ad} — yıl içi ayarlama silindi.`);
      router.refresh();
    });
  }

  const yazilabilir = canWrite;

  return (
    <div className="grid gap-4">
      {/* ————————————————————————————————————————————————— yıl seçici */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goYil(yil - 1)}
            disabled={!geriGidilir}
            title={
              geriGidilir
                ? "Önceki yıl"
                : `${EN_ESKI_PLAN_YILI} defterin ilk yılıdır — devralınan maaş kaydı Mayıs ${EN_ESKI_PLAN_YILI}'te başlıyor`
            }
            aria-label="Önceki yıl"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goYil(yil + 1)}
            aria-label="Sonraki yıl"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Wallet className="size-4 shrink-0 text-primary" />
          <span className="font-mono text-sm font-semibold tabular-nums">{yil} Ücret Planı</span>
          {yil === buYil && (
            <span className="oc-kicker text-primary" aria-label="İçinde bulunulan yıl">
              Bu Yıl
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">
            · {periodLabel(donem)}&apos;dan itibaren geçerli
          </span>
        </div>

        {yil !== buYil && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => goYil(buYil)}>
            Bu yıla dön
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={ayrilanlar}
              onChange={(e) => setAyrilanlar(e.target.checked)}
              className="size-3.5 accent-[var(--primary)]"
            />
            Ayrılanları da göster
          </label>
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!yazilabilir || bekleyen || toplamlar.degisen === 0}
            onClick={kaydet}
          >
            <Save className="size-3.5" />
            {bekleyen
              ? "Kaydediliyor…"
              : toplamlar.degisen > 0
                ? `Kaydet (${toplamlar.degisen})`
                : "Kaydet"}
          </Button>
        </div>
      </div>

      {/* ——————————————————————————————————————————————— özet kartları
          Kart içi notlarda HER SÖZCÜĞÜN BAŞ HARFİ BÜYÜKTÜR (kullanıcı kararı,
          13.08.2026). Metinler elle öyle yazılır, bir dönüştürücüden
          geçirilmez: içlerinde sayı, simge ve kısaltma var. */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          dense
          label="Kişi"
          value={String(toplamlar.kisi)}
          hint={`${toplamlar.kararli} Kişinin Ücreti Belirlendi`}
          icon={Users}
        />
        <StatCard
          dense
          label={`${yil - 1} Sonu Toplam`}
          value={`${fmtTutar(toplamlar.tabanToplam)} ₺`}
          hint="Aylık Net Ücret Toplamı (Zam Tabanı)"
          icon={Sigma}
        />
        <StatCard
          dense
          label={`${yil} Toplam`}
          value={`${fmtTutar(toplamlar.yeniToplam)} ₺`}
          hint="Belirlenmemiş Kişiler Tabanıyla Sayıldı"
          icon={Wallet}
        />
        <StatCard
          dense
          label="Aylık Fark"
          value={`${toplamlar.fark >= 0 ? "+" : "−"}${fmtTutar(Math.abs(toplamlar.fark))} ₺`}
          hint={`Yıllık ${fmtTutar(Math.abs(toplamlar.fark) * 12)} ₺`}
          icon={TrendingUp}
        />
        <StatCard
          dense
          label="Ortalama Zam"
          value={toplamlar.ortalamaOran === null ? "—" : `%${fmtNum(toplamlar.ortalamaOran, true)}`}
          hint="Tabanı Olan Kişilerin Ortalaması"
          icon={Percent}
        />
      </div>

      {/* ——————————————————————————————————————————————— toplu zam şeridi */}
      <div className="grid gap-2.5 rounded-lg border bg-card px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="oc-kicker shrink-0 text-muted-foreground">Toplu Zam</span>
          {RAISE_PRESETS.map((o) => (
            <Button
              key={o}
              variant="outline"
              size="sm"
              className="oc-tap font-mono text-xs"
              disabled={!yazilabilir || bekleyen}
              onClick={() => toplu(o)}
            >
              %{o}
            </Button>
          ))}

          <div className="flex items-center gap-1.5">
            <Input
              value={serbestOran}
              onChange={(e) => setSerbestOran(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const o = parseNum(serbestOran);
                if (o !== null) toplu(o);
              }}
              inputMode="decimal"
              aria-label="Serbest zam oranı (%)"
              disabled={!yazilabilir || bekleyen}
              className="h-8 w-20 text-right font-mono text-base tabular-nums pointer-coarse:h-10 pointer-fine:text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="oc-tap text-xs"
              disabled={!yazilabilir || bekleyen || parseNum(serbestOran) === null}
              onClick={() => {
                const o = parseNum(serbestOran);
                if (o !== null) toplu(o);
              }}
            >
              % uygula
            </Button>
          </div>

          {/* YUVARLAMA İKİ SEÇENEKTİR (kullanıcı kararı, 13.08.2026). Önce
              beş vardı (1 · 10 · 100 · 500 · 1000); bugünkü maaş
              büyüklüklerinde yüz liralık basamak anlamsız bir hassasiyetti. */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Yuvarlama</span>
            {ROUND_STEPS.map((s) => (
              <Button
                key={s}
                variant={adim === s ? "secondary" : "outline"}
                size="sm"
                className="oc-tap font-mono text-[11px]"
                onClick={() => setAdim(s)}
                title={`Zam sonucunu ${fmtNum(s)} ₺'ye yuvarla`}
              >
                {fmtNum(s)}
              </Button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {secili.size > 0 ? `${secili.size} kişi seçili` : "seçim yok — herkese uygulanır"}
            </span>
            {secili.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSecili(new Set())}
              >
                Seçimi bırak
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={!yazilabilir || bekleyen}
              onClick={() => setAraPencere(true)}
            >
              <CalendarPlus className="size-3.5" /> Yıl içi ayarlama
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Sayfa <span className="font-medium">zam uygulanmamış</span> açılır: kararı verilmemiş
          satırlarda oran %0&apos;dır ve ücret tabanın kendisidir. Oran{" "}
          <span className="font-medium">tabanın üstüne</span> uygulanır ve sonuç seçilen adıma
          yuvarlanır. Hiçbir şey kaydedilmez — sayıları gözden geçirip{" "}
          <span className="font-medium">Kaydet</span>&apos;e basmanız gerekir. Bir kişiyi ayrı
          tutmak için satırındaki oranı ya da ücreti doğrudan yazın.
        </p>
      </div>

      {/* ——————————————————————————————————————————————————————— tablo
          Kap `overflow-hidden` DEĞİL `.oc-scrollx`: ara genişlikte taşma
          olursa görünür kayar (md. 8), kırpılıp kaybolmaz. Telefonda tablo
          zaten listeye katlanır (md. 15), kap orada hiç kaymaz. */}
      <Table
        className="oc-mobile-table oc-tablet-table"
        containerClassName="oc-mobile-table-wrap oc-tablet-table-wrap rounded-lg border bg-card"
      >
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-9">
                <input
                  type="checkbox"
                  aria-label="Tümünü seç"
                  checked={secili.size > 0 && secili.size === satirlar.length}
                  onChange={(e) =>
                    setSecili(e.target.checked ? new Set(satirlar.map((r) => r.emp.id)) : new Set())
                  }
                  className="size-3.5 accent-[var(--primary)]"
                />
              </TableHead>
              <TableHead>Ad Soyad</TableHead>
              <TableHead className={cn("w-[10rem]", AT_LG)}>Görev</TableHead>
              {/* TELEFONDA LİSTEYE KATLANIR (MOBIL-15): `sm` altında seçim + Ad
                  Soyad + yeni ücret kalır; taban ve oran ad hücresinin alt
                  satırına iner. Ücret kutusu çift yönlüdür, telefonda da
                  ücret yazılabilir — oran `sm`den itibaren döner. */}
              <TableHead className={cn("w-[9rem] text-right", AT_SM)}>
                {yil - 1} Sonu Ücret (₺)
              </TableHead>
              <TableHead className={cn("w-[6rem] text-right", AT_SM)}>Zam %</TableHead>
              <TableHead className="w-[9rem] text-right">{yil} Net Ücret (₺)</TableHead>
              <TableHead className={cn("w-[8rem] text-right", AT_MD)}>Fark (₺)</TableHead>
              <TableHead className={cn("w-[9rem]", AT_MD)}>Durum</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {satirlar.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} data-mobile-span="full" data-mobile-hide-label className="py-10 text-center text-sm text-muted-foreground">
                  Gösterilecek kişi yok. Ayrılmış personeli görmek için üstteki kutuyu işaretleyin.
                </TableCell>
              </TableRow>
            ) : (
              satirlar.map((r) => {
                const id = r.emp.id;
                return (
                  <TableRow key={id} className={cn(r.degisti && "bg-primary/[0.05]")}>
                    <TableCell data-label="Seç">
                      <input
                        type="checkbox"
                        aria-label={`${r.emp.fullName} seç`}
                        checked={secili.has(id)}
                        onChange={(e) =>
                          setSecili((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            return next;
                          })
                        }
                        className="size-3.5 accent-[var(--primary)]"
                      />
                    </TableCell>

                    {/* `break-words whitespace-normal`: alt satır ve ayarlama
                        çipleri uzayabilir, `nowrap` telefonda tabloyu iterdi. */}
                    <TableCell data-label="Ad Soyad" data-mobile-span="full" className="max-w-[22rem] font-medium break-words whitespace-normal">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="oc-tag-dot"
                          style={tagStyle(categoryHue(r.emp.category))}
                          title={categoryLabel(r.emp.category)}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{r.emp.fullName}</span>
                        {!r.emp.active && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            ayrıldı
                          </span>
                        )}
                      </span>
                      {/* Dar ekranda düşen sütunların kritik olanı burada durur —
                          ikinci bir kart markup'ı YAZILMAZ. */}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground lg:hidden">
                        {r.emp.title || categoryLabel(r.emp.category)}
                        {r.fark !== null && r.fark !== 0 && (
                          <span className="font-mono tabular-nums lg:hidden">
                            {" · "}
                            {r.fark >= 0 ? "+" : "−"}
                            {fmtTutar(Math.abs(r.fark))} ₺
                          </span>
                        )}
                        {/* TELEFON KATMANI (md. 15): gizlenen taban ve oran. */}
                        {r.taban !== null && (
                          <span className="font-mono tabular-nums lg:hidden">
                            {" · "}taban {fmtTutar(r.taban)} ₺
                            {r.oran !== null && ` · %${fmtNum(r.oran, true)}`}
                          </span>
                        )}
                      </span>
                      {/* YIL İÇİ AYARLAMA ÇİPİ — ayrı bölüm kalktı, kayıt
                          kişinin kendi satırına indi. Silme burada durur:
                          yanlış girilmiş bir ayarlamayı geri almanın başka
                          yolu olmamalı. */}
                      {r.ara.map((a) => (
                        <span
                          key={a.id}
                          className="mt-1 flex w-fit max-w-full items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-normal"
                          title={
                            a.note ||
                            `${periodLabel(a.effectiveFrom)}'dan itibaren geçerli yıl içi ayarlama`
                          }
                        >
                          <span className="font-mono tabular-nums">
                            {periodLabel(a.effectiveFrom)} → {fmtTutar(a.netSalary)} ₺
                            {a.raisePct !== null && ` (%${fmtNum(a.raisePct, true)})`}
                          </span>
                          {yazilabilir && (
                            <button
                              type="button"
                              onClick={() => araKarariSil(a.id, r.emp.fullName)}
                              disabled={bekleyen}
                              title="Yıl içi ayarlamayı sil"
                              aria-label={`${r.emp.fullName} ${periodLabel(a.effectiveFrom)} ayarlamasını sil`}
                              className="oc-tap shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </TableCell>

                    <TableCell data-label="Görev" className={cn("text-muted-foreground", AT_LG)}>
                      <span className="block max-w-[10rem] truncate" title={r.emp.title}>
                        {r.emp.title || "—"}
                      </span>
                    </TableCell>

                    {/* TABAN OKUNUR, GİRİLMEZ: geçen yılın ücreti bir karardır ve
                        o yılın planında durur. Buradan değiştirilebilseydi geçmiş
                        bir karar sessizce yeniden yazılırdı. */}
                    {/* Hücre sınıfı BAŞLIKLA AYNI kırılımı taşımak zorunda:
                        başlık AT_SM iken hücrenin görünür kalması telefonda
                        hem sütunları kaydırıyor hem tabloyu taşırıyordu. */}
                    <TableCell data-label={`${yil - 1} Sonu Ücret`} data-mobile-show className={cn("text-right font-mono text-sm tabular-nums", AT_SM)}>
                      {r.taban === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <span
                          title={
                            r.tabanKaynak === "plan"
                              ? `${periodLabel(r.tabanDonem ?? "")} ücret kararı`
                              : r.tabanKaynak === "maas"
                                ? `${periodLabel(r.tabanDonem ?? "")} ödenen maaş (ücret kararı yok)`
                                : `${yil} kararının kendi kayıtlı tabanı (öncesi için kayıt yok)`
                          }
                          className={cn(r.tabanKaynak !== "plan" && "text-foreground/70")}
                        >
                          {fmtTutar(r.taban)}
                        </span>
                      )}
                    </TableCell>

                    {/* ZAM ORANI BÜYÜKLÜĞÜNE GÖRE RENKLİDİR (kullanıcı isteği):
                        %0 kızıl, %25 yeşil. Ölçek MUTLAKtır — listeye göreli
                        olsaydı herkese %15 verilen bir yılda en düşük satır
                        kırmızı görünür ve "buna az verdim" diye yanlış bir şey
                        söylerdi. */}
                    <TableCell data-label="Zam %" data-mobile-show className={AT_SM}>
                      <Input
                        value={r.taslak.oran}
                        onChange={(e) => oranYaz(r, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        disabled={!yazilabilir || bekleyen || r.taban === null}
                        className={cn(
                          HUCRE_INPUT,
                          r.oran !== null && "oc-scale font-semibold"
                        )}
                        style={r.oran !== null ? { "--oc-hue": zamTonu(r.oran) } as React.CSSProperties : undefined}
                        aria-label={`${r.emp.fullName} zam oranı`}
                      />
                    </TableCell>

                    {/* ÜCRET BÜYÜKLÜĞÜNE GÖRE RENKLİDİR: ölçek listedeki en
                        düşük ve en yüksek ücret arasında gerilir. */}
                    <TableCell data-label={`${yil} Net Ücret`}>
                      <ParaInput
                        value={r.taslak.net}
                        onChange={(v) => netYaz(r, v)}
                        disabled={!yazilabilir || bekleyen}
                        className={cn(
                          HUCRE_INPUT,
                          r.yeni !== null && r.yeni > 0 && "oc-scale font-semibold"
                        )}
                        style={
                          r.yeni !== null && r.yeni > 0
                            ? ({
                                "--oc-hue": olcekTonu(r.yeni, ucretAraligi.min, ucretAraligi.max),
                              } as React.CSSProperties)
                            : undefined
                        }
                        ariaLabel={`${r.emp.fullName} ${yil} net ücreti`}
                      />
                    </TableCell>

                    <TableCell data-label="Fark" className={cn("text-right font-mono text-sm tabular-nums", AT_MD)}>
                      {r.fark === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : r.fark === 0 ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        <span className={r.fark > 0 ? "text-success" : "text-destructive"}>
                          {r.fark > 0 ? "+" : "−"}
                          {fmtTutar(Math.abs(r.fark))}
                        </span>
                      )}
                    </TableCell>

                    <TableCell data-label="Durum" className={cn("text-xs", AT_MD)}>
                      {r.degisti ? (
                        <span className="text-primary">kaydedilmedi</span>
                      ) : r.mevcut ? (
                        <span className="text-muted-foreground">
                          {RAISE_REASON_LABELS[r.mevcut.reason as RaiseReason] ?? r.mevcut.reason}
                        </span>
                      ) : r.taban === null ? (
                        <span className="text-muted-foreground/70">taban yok — ücreti yazın</span>
                      ) : (
                        <span className="text-muted-foreground/70">zam uygulanmadı</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>

          {satirlar.length > 0 && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell data-mobile-hidden />
                <TableCell data-label="Toplam" data-mobile-span="full" className="font-medium">{toplamlar.kisi} kişi</TableCell>
                <TableCell className={AT_LG} />
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_SM)}>
                  {fmtTutar(toplamlar.tabanToplam)}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_SM)}>
                  {toplamlar.ortalamaOran === null
                    ? "—"
                    : `%${fmtNum(toplamlar.ortalamaOran, true)}`}
                </TableCell>
                <TableCell data-label={`${yil} Net Ücret`} className="text-right font-mono text-sm font-semibold tabular-nums">
                  {fmtTutar(toplamlar.yeniToplam)}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_MD)}>
                  {toplamlar.fark === 0 ? (
                    "—"
                  ) : (
                    <>
                      {toplamlar.fark > 0 ? "+" : "−"}
                      {fmtTutar(Math.abs(toplamlar.fark))}
                    </>
                  )}
                </TableCell>
                <TableCell className={AT_MD} />
              </TableRow>
            </TableFooter>
          )}
      </Table>

      <p className="text-[11px] text-muted-foreground">
        Bu ekran <span className="font-medium">kararı</span> yazar, ödemeyi değil: kaydedilen ücret
        Maaş ekranında yeni satır açarken ön değer olarak gelir ve orada gerekirse
        düzeltilebilir. Ücret ve zam oranı <span className="font-medium">büyüklüklerine göre</span>{" "}
        renklenir (az kızıl, çok yeşil); ücret ölçeği listedeki en düşük ve en yüksek arasında,
        zam ölçeği %0 ile %25 arasında gerilir. Taban gri görünüyorsa o kişinin geçen yıl için
        ücret kararı yoktur ve sayı ödenen son maaştan ya da bu yılın kararının kendi kayıtlı
        tabanından okunmuştur; hangisi olduğunu hücrenin üstüne gelince görürsünüz.
        {!canWrite && " Yazma yetkiniz olmadığı için alanlar kapalıdır."}
      </p>

      {araPencere && (
        <AraAyarlamaDialog
          yil={yil}
          adim={adim}
          employees={employees.filter((e) => ayrilanlar || e.active)}
          plans={plans}
          sonOdenen={sonOdenen}
          onClose={() => setAraPencere(false)}
          onDone={() => {
            setAraPencere(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════ yıl içi ayarlama penceresi

/**
 * "Yıl içinde bazen nadiren ayarlama yapabilirim; düzenleme seçeneği olsun."
 *
 * NADİR OLDUĞU İÇİN PENCEREDE: yıl başı kararı bir TABLO işidir (kırk satır bir
 * arada), yıl içi ayarlama tek bir kişiye tek bir tarihte verilir. İkisini aynı
 * tabloya sıkıştırmak, her satıra bir tarih sütunu eklemek ve o sütunun %98'ini
 * boş bırakmak demekti. Sonuç kişinin satırında bir ÇİP olarak görünür.
 */
function AraAyarlamaDialog({
  yil,
  adim,
  employees,
  plans,
  sonOdenen,
  onClose,
  onDone,
}: {
  yil: number;
  adim: number;
  employees: EmployeeRow[];
  plans: SalaryPlanRow[];
  sonOdenen: ReadonlyMap<string, { period: string; net: number }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [ay, setAy] = useState("07");
  const [net, setNet] = useState("");
  const [oran, setOran] = useState("");
  const [not, setNot] = useState("");
  const [bekleyen, startTransition] = useTransition();

  const donem = `${yil}-${ay}`;
  // Taban, ayarlamanın yapıldığı aydan BİR ÖNCEKİ ayda geçerli ücrettir.
  const oncekiAy = ay === "01" ? `${yil - 1}-12` : `${yil}-${String(Number(ay) - 1).padStart(2, "0")}`;
  const tabanPlan = employeeId ? gecerliUcret(plans, employeeId, oncekiAy) : null;
  const taban = tabanPlan?.netSalary ?? (employeeId ? (sonOdenen.get(employeeId)?.net ?? null) : null);

  const sirali = useMemo(
    () => [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName, "tr")),
    [employees]
  );

  function kaydet() {
    const n = parseNum(net);
    if (!employeeId) {
      toast.error("Önce kişiyi seçin.");
      return;
    }
    if (n === null || n <= 0) {
      toast.error("Yeni net ücreti girin.");
      return;
    }
    startTransition(async () => {
      const res = await saveSalaryPlan({
        employeeId,
        effectiveFrom: donem,
        netSalary: n,
        previousNet: taban,
        raisePct: zamOrani(taban, n),
        reason: "ara",
        note: not,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${periodLabel(donem)} ayarlaması kaydedildi.`);
      onDone();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(34rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Yıl içi ücret ayarlaması</DialogTitle>
          <DialogDescription>
            Seçilen aydan itibaren geçerli olur ve bir sonraki karara kadar sürer. Yıl başı planı
            değişmez; kayıt kişinin satırında bir işaret olarak görünür.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="oc-kicker text-muted-foreground">Personel</span>
            <select
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setNet("");
                setOran("");
              }}
              className="h-10 w-full border bg-background px-2 text-base pointer-fine:text-sm"
            >
              <option value="">— seçin —</option>
              {sirali.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.active ? "" : " (ayrıldı)"}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="oc-kicker text-muted-foreground">Geçerlilik Ayı</span>
              <select
                value={ay}
                onChange={(e) => setAy(e.target.value)}
                className="h-10 w-full border bg-background px-2 text-base pointer-fine:text-sm"
              >
                {AY_SECENEKLERI.map((m) => (
                  <option key={m} value={m}>
                    {periodLabel(`${yil}-${m}`)}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-1">
              <span className="oc-kicker text-muted-foreground">Mevcut Ücret (₺)</span>
              <span className="flex h-10 items-center font-mono text-sm font-semibold tabular-nums">
                {taban === null ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    {employeeId ? "kayıt yok" : "kişi seçin"}
                  </span>
                ) : (
                  fmtTutar(taban)
                )}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="oc-kicker text-muted-foreground">Zam Oranı (%)</span>
              <Input
                value={oran}
                onChange={(e) => {
                  setOran(e.target.value);
                  const o = parseNum(e.target.value);
                  if (taban !== null && o !== null) setNet(girdiMetni(zamliUcret(taban, o, adim)));
                }}
                inputMode="decimal"
                disabled={taban === null}
                className="text-right font-mono tabular-nums"
              />
            </label>
            <div className="grid gap-1">
              <span className="oc-kicker text-muted-foreground">Yeni Net Ücret (₺)</span>
              <ParaInput
                value={net}
                onChange={(v) => {
                  setNet(v);
                  const o = zamOrani(taban, parseNum(v));
                  setOran(o === null ? "" : oranMetni(o));
                }}
                className="text-right font-mono tabular-nums"
                ariaLabel="Yeni net ücret"
              />
            </div>
          </div>

          <label className="grid gap-1">
            <span className="oc-kicker text-muted-foreground">Not</span>
            <Input value={not} onChange={(e) => setNot(e.target.value)} maxLength={300} />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" className="oc-tap" onClick={onClose}>
            Vazgeç
          </Button>
          <Button className="oc-tap" disabled={bekleyen} onClick={kaydet}>
            {bekleyen ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
