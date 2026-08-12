"use client";

// Aylık maaş panosu.
//
// TASARIM ÖLÇÜTÜ: bir ayın maaşını yazmanın kaç adım sürdüğü. Devralınan
// Excel'de kullanıcının yaptığı iş "geçen ayın listesini kopyala, değişenleri
// düzelt, mesai saatlerini gir"di. Ekran bunu üç harekete indirir: bir düğme
// geçen ayı taşır, satırlar TABLODA düzenlenir (pencere açılmaz) ve mesai
// tutarı yazarken hesaplanır.
//
// SATIR TEK TEK KAYDEDİLİR, gün gibi topluca değil (İş Takibi'nin tersi):
// maaş kaydı denetim izi yazan bir işlemdir (`audit_log`) ve "bu ay kimin
// maaşını kim değiştirdi" sorusunun cevabı satır bazında anlamlıdır. Aynı
// anda birden çok satır kaydedilebildiği için kilit SATIR BAŞINADIR.
//
// SAYILAR METİN OLARAK TUTULUR ve yalnız kaydederken sayıya çevrilir
// (`parseNum`, projenin her yerdeki kalıbı): "45.000," yazarken alan
// boşalmaz, Türkçe klavyede ondalık ayıracı virgüldür.

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Copy,
  Download,
  Euro,
  Lock,
  Sigma,
  Timer,
  Unlock,
  Users,
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
import { StatCard } from "@/components/stat-card";
import { fmtNum, parseNum } from "@/lib/currency";
import { tagStyle } from "@/lib/tags";
import { degisimYuzde } from "@/lib/finance/fx";
import { categoryHue, categoryLabel, yonetimMi } from "@/lib/finance/personnel";
import {
  AYLIK_CALISMA_SAATI,
  aylikOdeme,
  donemOzeti,
  fazlaMesaiTutari,
  netCalismaSaati,
  periodLabel,
} from "@/lib/finance/payroll";
import { cn } from "@/lib/utils";
import { savePayroll, savePeriod } from "../actions";
import type {
  EmployeeRow,
  FxMonthlyRow,
  PayrollInput,
  PayrollRow,
  PeriodInput,
  PeriodRow,
} from "../schema";

// ————————————————————————————————————————————————————————————— yardımcılar

/** `2026-08` → bir ay ileri/geri (`ayKaydir("2026-01", -1)` → `2025-12`). */
function ayKaydir(ay: string, adim: number): string {
  const [y, a] = ay.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1 + adim, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Ayın ilk ve son günü — çalışma dönemi kesişimi bu iki günle sorulur. */
function ayAraligi(ay: string): { ilk: string; son: string } {
  const [y, a] = ay.split("-").map(Number);
  const sonGun = new Date(Date.UTC(y, a, 0)).getUTCDate();
  return { ilk: `${ay}-01`, son: `${ay}-${String(sonGun).padStart(2, "0")}` };
}

/**
 * Kişi o ay çalışıyor muydu?
 *
 * Dönem ile ay KESİŞİYORSA evet: ayın 20'sinde işe giren de, 3'ünde çıkan da o
 * ay çalışmıştır ve maaşı vardır. Açık dönem (`endDate === null`) sürüyor
 * demektir, yani kesişim için tek şart girişin ay bitmeden olmasıdır.
 */
function calisiyorMu(emp: EmployeeRow, ilk: string, son: string): boolean {
  return emp.employment.some((d) => d.startDate <= son && (d.endDate === null || d.endDate >= ilk));
}

/**
 * Kur DÖRT HANEDİR (`FX_PAIRS.digits`) — `fmtNum` en çok iki hane basar ve
 * önerilen 54,8231'i 54,82 gösterirdi. Kullanıcının onayladığı sayı ile
 * kaydedilen sayı aynı görünmelidir.
 */
const KUR_FMT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function fmtKur(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : KUR_FMT.format(v);
}

/**
 * Sayıyı DÜZENLENEBİLİR metne çevirir: binlik ayıracı yoktur (kullanıcı
 * yazarken kendi kendine bozulmasın), ondalık ayıracı virgüldür.
 */
const GIRDI_FMT = new Intl.NumberFormat("tr-TR", {
  useGrouping: false,
  maximumFractionDigits: 4,
});

function girdiMetni(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "" : GIRDI_FMT.format(v);
}

/**
 * Saat alanında SIFIR BİLGİ DEĞİLDİR: çalışanların çoğunda mesai yoktur ve
 * tablo baştan aşağı "0" duvarına dönerdi. Boş hücre "mesai yok" der.
 */
function saatMetni(v: number | null | undefined): string {
  return v && v > 0 ? girdiMetni(v) : "";
}

/**
 * `savePayroll` bir UPSERT'tir ve satırın BÜTÜN sütunlarını yazar; gönderilmeyen
 * alan Zod varsayılanına düşer. Prim, harcırah, avans, kesinti, bordro kalemleri
 * ve ödeme tarihi bu ekranda düzenlenmez ama satırda VARDIR — mevcut kayıttan
 * olduğu gibi taşınmasalardı net maaşı düzeltmek onları sessizce sıfırlardı.
 */
function payrollGirdisi(
  employeeId: string,
  period: string,
  mevcut: PayrollRow | null,
  degerler: { netSalary: number; overtimeHours50: number; overtimeHours100: number }
): PayrollInput {
  return {
    employeeId,
    period,
    ...degerler,
    grossSalary: mevcut?.grossSalary ?? null,
    sgkEmployee: mevcut?.sgkEmployee ?? null,
    sgkEmployer: mevcut?.sgkEmployer ?? null,
    unemploymentEmployee: mevcut?.unemploymentEmployee ?? null,
    incomeTax: mevcut?.incomeTax ?? null,
    stampTax: mevcut?.stampTax ?? null,
    bonus: mevcut?.bonus ?? 0,
    perDiem: mevcut?.perDiem ?? 0,
    advance: mevcut?.advance ?? 0,
    deduction: mevcut?.deduction ?? 0,
    paidOn: mevcut?.paidOn ?? "",
    note: mevcut?.note ?? "",
  };
}

/** Satırın düzenlenen üç alanı — hepsi metindir (bkz. dosya başlığı). */
interface RowDraft {
  net: string;
  ot50: string;
  ot100: string;
}

/** Dönem şeridinin düzenlenen alanları. */
interface PeriodDraft {
  kur: string;
  izin: string;
  rapor: string;
}

/**
 * SÜTUN ÖNCELİKLENDİRME (AGENTS dokunmatik md. 7). Sekiz sütunun üçü giriş
 * alanıdır ve daraltılamaz; telefonda görev ve avro karşılığı düşer, düşen
 * bilgi ad hücresinin ikinci satırına iner. İkinci bir kart markup'ı YAZILMAZ.
 */
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

/** Satır içi sayı alanı — tabloda yoğunluk, parmakta tam boy. */
const HUCRE_INPUT =
  "h-8 px-2 text-right font-mono text-base tabular-nums pointer-coarse:h-10 pointer-fine:text-sm";

export function PayrollBoard({
  ay,
  bugunAy,
  employees,
  payroll,
  previousPayroll,
  periods,
  fxMonthly,
  canWrite,
}: {
  ay: string;
  bugunAy: string;
  employees: EmployeeRow[];
  payroll: PayrollRow[];
  previousPayroll: PayrollRow[];
  periods: PeriodRow[];
  fxMonthly: FxMonthlyRow[];
  canWrite: boolean;
}) {
  const router = useRouter();

  const donem = useMemo(() => periods.find((p) => p.period === ay) ?? null, [periods, ay]);
  const ortalama = useMemo(() => fxMonthly.find((f) => f.period === ay) ?? null, [fxMonthly, ay]);

  const [taslaklar, setTaslaklar] = useState<Record<string, RowDraft>>({});
  const [donemTaslak, setDonemTaslak] = useState<PeriodDraft>(() => ({
    kur: girdiMetni(donem?.eurTryRate ?? null),
    izin: saatMetni(donem?.leaveHours),
    rapor: saatMetni(donem?.reportHours),
  }));
  /** Elle açılan (maaşı henüz girilmemiş) satırlar. */
  const [acilanlar, setAcilanlar] = useState<string[]>([]);
  const [odakId, setOdakId] = useState<string | null>(null);
  /** Satır başına kilit: aynı anda birden çok satır kaydedilebilir. */
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set());
  /** Kaydedilmiş satırın kısa süreli işareti. */
  const [isaretli, setIsaretli] = useState<Set<string>>(() => new Set());
  // `useTransition` yalnız TEK SEFERLİK toplu işlemlerdedir; satır kaydında tek
  // bir `isPending` bayrağı hangi satırın yazıldığını söyleyemezdi.
  const [bekleyen, startTransition] = useTransition();

  // AY DEĞİŞTİĞİNDE taslaklar sıfırlanır. Bileşen adres değişiminde yeniden
  // KURULMAZ, aynı örnek yeni proplarla boyanır — sıfırlanmasaydı Temmuz'da
  // yazılan yarım bir sayı Ağustos satırında görünürdü. Bu bir EFEKT değil,
  // "prop değişince durumu ayarla" desenidir: React düzeltmeyi ekrana hiç
  // basmadan yapar (worklog/day-entry ile aynı kalıp).
  const [kaynakAy, setKaynakAy] = useState(ay);
  if (kaynakAy !== ay) {
    setKaynakAy(ay);
    setTaslaklar({});
    setAcilanlar([]);
    setOdakId(null);
    setIsaretli(new Set());
    setDonemTaslak({
      kur: girdiMetni(donem?.eurTryRate ?? null),
      izin: saatMetni(donem?.leaveHours),
      rapor: saatMetni(donem?.reportHours),
    });
  }

  const aralik = useMemo(() => ayAraligi(ay), [ay]);
  const kur = donem?.eurTryRate ?? null;
  const kapali = donem?.closed ?? false;
  // KAPALI DÖNEM bir SUNUCU KİLİDİ DEĞİLDİR (`savePayroll` bunu sormaz); ekran
  // yazmayı kapatır ki ödenmiş bir ay yanlışlıkla değişmesin. Gerçekten
  // değiştirmek gerekiyorsa dönem AÇILIR — karar görünür olur.
  const yazilabilir = canWrite && !kapali;

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const kayitlar = useMemo(
    () => new Map(payroll.map((p) => [p.employeeId, p])),
    [payroll]
  );

  const acikSet = useMemo(() => new Set(acilanlar), [acilanlar]);

  /** Tabloda görünen satırlar: maaş kaydı olanlar + elle açılanlar. */
  const satirlar = useMemo(() => {
    return employees
      .filter((e) => kayitlar.has(e.id) || acikSet.has(e.id))
      .map((e) => {
        const kayit = kayitlar.get(e.id) ?? null;
        const taslak: RowDraft = taslaklar[e.id] ?? {
          net: girdiMetni(kayit?.netSalary ?? null),
          ot50: saatMetni(kayit?.overtimeHours50),
          ot100: saatMetni(kayit?.overtimeHours100),
        };
        const net = parseNum(taslak.net);
        const s50 = parseNum(taslak.ot50) ?? 0;
        const s100 = parseNum(taslak.ot100) ?? 0;
        // Mesai tutarı ANINDA gösterilir: sunucudaki türetilmiş sütunla
        // (`fin_payroll.overtime_amount`) aynı bağıntının saf kopyası, kullanıcı
        // kaydetmeden önce görmelidir.
        const mesai = fazlaMesaiTutari(net, s50, s100);
        const toplam = aylikOdeme({
          netSalary: net,
          overtimeAmount: mesai,
          bonus: kayit?.bonus ?? 0,
          perDiem: kayit?.perDiem ?? 0,
          deduction: kayit?.deduction ?? 0,
        });
        return {
          emp: e,
          kayit,
          taslak,
          net,
          s50,
          s100,
          mesai,
          toplam,
          avro: kur && kur > 0 ? toplam / kur : null,
        };
      })
      .sort(
        (a, b) =>
          a.emp.category.localeCompare(b.emp.category, "tr") ||
          a.emp.fullName.localeCompare(b.emp.fullName, "tr")
      );
  }, [employees, kayitlar, acikSet, taslaklar, kur]);

  /** Toplamlar TASLAKTAN çıkar: kullanıcı yazarken kartlar da hareket eder. */
  const toplamlar = useMemo(() => {
    // Açılmış ama hâlâ boş bir satır kişi sayısını şişirmesin: yalnız kaydı
    // olan ya da net maaşı girilmiş satırlar sayılır.
    const sayilan = satirlar.filter((r) => r.kayit !== null || (r.net ?? 0) > 0);
    const ozetGirdisi = sayilan.map((r) => ({
      employeeId: r.emp.id,
      category: r.emp.category,
      netSalary: r.net,
      overtimeHours50: r.s50,
      overtimeHours100: r.s100,
      overtimeAmount: r.mesai,
      bonus: r.kayit?.bonus ?? 0,
      perDiem: r.kayit?.perDiem ?? 0,
      deduction: r.kayit?.deduction ?? 0,
    }));
    return {
      ozet: donemOzeti(ozetGirdisi),
      personel: donemOzeti(ozetGirdisi.filter((r) => !yonetimMi(r.category))),
      yonetim: donemOzeti(ozetGirdisi.filter((r) => yonetimMi(r.category))),
      s50: sayilan.reduce((t, r) => t + r.s50, 0),
      s100: sayilan.reduce((t, r) => t + r.s100, 0),
      avro:
        kur && kur > 0
          ? sayilan.reduce((t, r) => t + r.toplam, 0) / kur
          : null,
    };
  }, [satirlar, kur]);

  /**
   * MAAŞI GİRİLMEMİŞ ÇALIŞANLAR.
   *
   * Devralınan Excel'de gerçekten olan bir boşluktur (personel listesi ile maaş
   * sayfası çelişiyordu) ve GİZLENMEZ: bir kişinin maaşının yazılmamış olması
   * ya bir eksiklik ya da bir kayıttır, ikisi de görünmelidir.
   */
  const eksikler = useMemo(
    () =>
      employees.filter(
        (e) =>
          !kayitlar.has(e.id) &&
          !acikSet.has(e.id) &&
          calisiyorMu(e, aralik.ilk, aralik.son)
      ),
    [employees, kayitlar, acikSet, aralik]
  );

  /** Geçen aydan taşınabilecek satırlar — düğme basılmadan önce sayısı bilinir. */
  const kopyalanabilir = useMemo(
    () =>
      previousPayroll.filter((p) => {
        if (kayitlar.has(p.employeeId)) return false; // var olan satır EZİLMEZ
        if (!(p.netSalary > 0)) return false;
        const emp = employeeById.get(p.employeeId);
        return emp ? calisiyorMu(emp, aralik.ilk, aralik.son) : false;
      }),
    [previousPayroll, kayitlar, employeeById, aralik]
  );

  // ————————————————————————————————————————————————————————————— gezinme

  const goAy = useCallback(
    (yeni: string) => {
      // Seçim ADRESTE durur (paylaşılabilir olsun); `replace` tarayıcı geçmişini
      // ay ay şişirmez.
      router.replace(`/finance/maas?ay=${yeni}`);
    },
    [router]
  );

  // ————————————————————————————————————————————————————————————— yazma

  function setSatir(id: string, patch: Partial<RowDraft>, mevcut: RowDraft) {
    setTaslaklar((prev) => ({ ...prev, [id]: { ...mevcut, ...patch } }));
  }

  function isaretle(id: string) {
    setIsaretli((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setIsaretli((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  }

  const satiriKaydet = useCallback(
    async (satir: (typeof satirlar)[number]) => {
      const id = satir.emp.id;
      // Yeniden girişi kesen kilit: alan alan çıkışta iki kez tetiklenebilir.
      if (!yazilabilir || busyRows.has(id)) return;

      const net = parseNum(satir.taslak.net);
      if (net === null) {
        // Net maaş olmadan satır yazılamaz (şema zorunlu kılar). Boş bir satırı
        // dokunmadan bırakmak normaldir; saat girilmişse kullanıcı uyarılır.
        if (satir.s50 > 0 || satir.s100 > 0) toast.error("Önce net maaşı girin.");
        return;
      }
      const mevcut = satir.kayit;
      if (
        mevcut &&
        mevcut.netSalary === net &&
        mevcut.overtimeHours50 === satir.s50 &&
        mevcut.overtimeHours100 === satir.s100
      ) {
        return; // değişmemiş satır denetim izine yazılmaz
      }

      setBusyRows((prev) => new Set(prev).add(id));
      const res = await savePayroll(
        payrollGirdisi(id, ay, mevcut, {
          netSalary: net,
          overtimeHours50: satir.s50,
          overtimeHours100: satir.s100,
        })
      );
      setBusyRows((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }
      isaretle(id);
      toast.success(`${satir.emp.fullName} — ${periodLabel(ay)} kaydedildi.`);
      router.refresh();
    },
    [ay, busyRows, router, yazilabilir]
  );

  /**
   * GEÇEN AYI KOPYALA — net maaşları taşır.
   *
   * MESAİ SAATLERİ KOPYALANMAZ: onlar ayın kendi olgusudur ve geçen ayın
   * saatlerini taşımak, düzeltilmediğinde yanlış bir ödeme üretirdi. Prim,
   * harcırah, avans ve kesinti de aynı sebeple sıfırdan başlar.
   */
  function geceniKopyala() {
    if (!yazilabilir || kopyalanabilir.length === 0) return;
    const onceki = ayKaydir(ay, -1);
    startTransition(async () => {
      let eklenen = 0;
      let hata = 0;
      // Sıralı yazılır: kırk satırı aynı anda göndermek hem denetim izini
      // karıştırır hem de tek bir hatayı görünmez kılardı.
      for (const p of kopyalanabilir) {
        const res = await savePayroll(
          payrollGirdisi(p.employeeId, ay, null, {
            netSalary: p.netSalary,
            overtimeHours50: 0,
            overtimeHours100: 0,
          })
        );
        if (res.error) hata += 1;
        else eklenen += 1;
      }
      if (hata > 0) toast.error(`${hata} satır yazılamadı.`);
      if (eklenen > 0) {
        toast.success(
          `${periodLabel(onceki)} listesinden ${eklenen} satır eklendi — mesai saatleri boş bırakıldı.`
        );
      }
      router.refresh();
    });
  }

  /** Dönem ayarları — kur, izin/rapor saatleri ve kapanış tek satırda yazılır. */
  function donemiYaz(patch: Partial<PeriodInput>, basariMesaji: string) {
    if (!canWrite) return;
    const girdi: PeriodInput = {
      period: ay,
      eurTryRate: parseNum(donemTaslak.kur),
      // Dolar kuru bu ekranda sorulmaz ama satırda VARDIR; taşınmasaydı maaş
      // ekranından yapılan her kayıt onu siler.
      usdTryRate: donem?.usdTryRate ?? null,
      leaveHours: parseNum(donemTaslak.izin) ?? 0,
      reportHours: parseNum(donemTaslak.rapor) ?? 0,
      closed: kapali,
      note: donem?.note ?? "",
      ...patch,
    };
    startTransition(async () => {
      const res = await savePeriod(girdi);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDonemTaslak({
        kur: girdiMetni(girdi.eurTryRate ?? null),
        izin: saatMetni(girdi.leaveHours),
        rapor: saatMetni(girdi.reportHours),
      });
      toast.success(basariMesaji);
      router.refresh();
    });
  }

  function satirAc(id: string) {
    setAcilanlar((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setOdakId(id);
  }

  // ——————————————————————————————————————————————————————————————— sunum

  const kurSapmasi =
    kur && ortalama ? degisimYuzde(kur, ortalama.eurTry) : null;
  const netSaat = netCalismaSaati(
    toplamlar.ozet.normalHours,
    toplamlar.ozet.overtimeHours,
    donem?.leaveHours ?? 0,
    donem?.reportHours ?? 0
  );

  return (
    <div className="grid gap-4">
      {/* ————————————————————————————————————————————————— ay seçici */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goAy(ayKaydir(ay, -1))}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => goAy(ayKaydir(ay, 1))}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Banknote className="size-4 shrink-0 text-primary" />
          <span className="font-mono text-sm font-semibold tabular-nums">{periodLabel(ay)}</span>
          {ay === bugunAy && (
            <span className="oc-kicker text-primary" aria-label="İçinde bulunulan ay">
              Bu Ay
            </span>
          )}
        </div>

        <Input
          type="month"
          value={ay}
          onChange={(e) => e.target.value && goAy(e.target.value)}
          className="w-[10.5rem]"
          aria-label="Ay seç"
        />
        {ay !== bugunAy && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => goAy(bugunAy)}>
            Bu aya dön
          </Button>
        )}

        <div className="ml-auto">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <a href={`/finance/export?ay=${ay}`}>
              <Download className="size-3.5" /> Excel indir
            </a>
          </Button>
        </div>
      </div>

      {/* ——————————————————————————————————————————————— dönem şeridi */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="size-4 shrink-0 text-primary" />
            <span className="oc-kicker text-foreground/80">Dönem Ayarları</span>
            {kapali && (
              <span className="oc-tag px-1.5 py-0.5 text-xs" style={tagStyle(0)}>
                Kapalı
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!canWrite || bekleyen}
            onClick={() =>
              donemiYaz(
                { closed: !kapali },
                kapali ? `${periodLabel(ay)} yeniden açıldı.` : `${periodLabel(ay)} kapatıldı.`
              )
            }
          >
            {kapali ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
            {kapali ? "Dönemi aç" : "Dönemi kapat"}
          </Button>
        </div>

        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1">
            <span className="oc-kicker text-muted-foreground">Avro Kuru (₺)</span>
            <Input
              value={donemTaslak.kur}
              onChange={(e) => setDonemTaslak((p) => ({ ...p, kur: e.target.value }))}
              onBlur={() => {
                if (parseNum(donemTaslak.kur) !== (donem?.eurTryRate ?? null)) {
                  donemiYaz({}, `${periodLabel(ay)} kuru kaydedildi.`);
                }
              }}
              inputMode="decimal"
              disabled={!yazilabilir || bekleyen}
              className="font-mono tabular-nums"
              aria-label="Dönemin avro kuru"
            />
          </label>
          <label className="grid gap-1">
            <span className="oc-kicker text-muted-foreground">İzin Saati</span>
            <Input
              value={donemTaslak.izin}
              onChange={(e) => setDonemTaslak((p) => ({ ...p, izin: e.target.value }))}
              onBlur={() => {
                if ((parseNum(donemTaslak.izin) ?? 0) !== (donem?.leaveHours ?? 0)) {
                  donemiYaz({}, `${periodLabel(ay)} izin saati kaydedildi.`);
                }
              }}
              inputMode="decimal"
              disabled={!yazilabilir || bekleyen}
              className="font-mono tabular-nums"
              aria-label="Ayın toplam izin saati"
            />
          </label>
          <label className="grid gap-1">
            <span className="oc-kicker text-muted-foreground">Rapor Saati</span>
            <Input
              value={donemTaslak.rapor}
              onChange={(e) => setDonemTaslak((p) => ({ ...p, rapor: e.target.value }))}
              onBlur={() => {
                if ((parseNum(donemTaslak.rapor) ?? 0) !== (donem?.reportHours ?? 0)) {
                  donemiYaz({}, `${periodLabel(ay)} rapor saati kaydedildi.`);
                }
              }}
              inputMode="decimal"
              disabled={!yazilabilir || bekleyen}
              className="font-mono tabular-nums"
              aria-label="Ayın toplam rapor saati"
            />
          </label>
          <div className="grid gap-1">
            <span className="oc-kicker text-muted-foreground">Net Çalışma Saati</span>
            <span
              className="flex h-10 items-center font-mono text-sm font-semibold tabular-nums"
              title="Normal + fazla mesai − izin − rapor"
            >
              {fmtNum(netSaat)}
            </span>
          </div>
        </div>

        {/* Ortalama ÖNERİDİR — kur girilmişse fark yalnız bilgi olarak durur. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5">
          {ortalama ? (
            <>
              <span className="text-sm">
                {periodLabel(ay)} ortalaması{" "}
                <span className="font-mono font-semibold tabular-nums">
                  {fmtKur(ortalama.eurTry)} ₺
                </span>{" "}
                <span className="text-muted-foreground">({ortalama.dayCount} gün)</span>
              </span>
              {kur === null ? (
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={!yazilabilir || bekleyen}
                  onClick={() =>
                    donemiYaz(
                      { eurTryRate: ortalama.eurTry },
                      `${periodLabel(ay)} kuru ortalamadan yazıldı.`
                    )
                  }
                >
                  Kullan
                </Button>
              ) : (
                kurSapmasi !== null &&
                Math.abs(kurSapmasi) >= 0.05 && (
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    dönem kuru ortalamadan %{fmtNum(Math.abs(kurSapmasi), true)}{" "}
                    {kurSapmasi > 0 ? "yüksek" : "düşük"}
                  </span>
                )
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Bu ay için günlük kur kaydı yok — Kurlar sekmesinden tazeleyebilirsiniz.
            </span>
          )}
        </div>

        <p className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
          Dönem kuru <span className="font-medium">satırın kendindedir ve DONAR</span>: ödenmiş bir
          ayın avro karşılığı, kur tablosu sonradan tazelendiğinde değişmemelidir. Yukarıdaki
          ortalama yalnız bir <span className="font-medium">öneridir</span> — hangi kurun
          kullanılacağına siz karar verirsiniz, ekran kendiliğinden yazmaz. İzin ve rapor saatleri
          ay düzeyinde tutulur (kişi başına değil); firma bugün de öyle tutuyor.
        </p>
      </div>

      {/* ————————————————————————————————————————————————— özet kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Kişi"
          value={String(toplamlar.ozet.count)}
          hint={`${toplamlar.personel.count} personel · ${toplamlar.yonetim.count} yönetim`}
          icon={Users}
        />
        <StatCard
          label="Toplam Net Maaş"
          value={`${fmtNum(toplamlar.ozet.netTotal, true)} ₺`}
          hint={`kişi başı ort. ${fmtNum(toplamlar.ozet.netAverage, true)} ₺`}
          icon={Banknote}
        />
        <StatCard
          label="Fazla Mesai Saati"
          value={fmtNum(toplamlar.ozet.overtimeHours)}
          hint={`%50: ${fmtNum(toplamlar.s50)} · %100: ${fmtNum(toplamlar.s100)} · normal ${fmtNum(toplamlar.ozet.normalHours)}`}
          icon={Timer}
        />
        <StatCard
          label="Fazla Mesai Tutarı"
          value={`${fmtNum(toplamlar.ozet.overtimeTotal, true)} ₺`}
          hint={
            toplamlar.ozet.overtimeHours > 0
              ? `saat başı ${fmtNum(toplamlar.ozet.overtimeHourCost, true)} ₺`
              : "bu ay mesai girilmedi"
          }
          icon={Clock}
        />
        <StatCard
          label="Genel Toplam"
          value={`${fmtNum(toplamlar.ozet.grandTotal, true)} ₺`}
          hint={`personel ${fmtNum(toplamlar.personel.grandTotal, true)} · yönetim ${fmtNum(toplamlar.yonetim.grandTotal, true)}`}
          icon={Sigma}
        />
        <StatCard
          label="Avro Karşılığı"
          value={toplamlar.avro === null ? "—" : `${fmtNum(toplamlar.avro, true)} €`}
          hint={kur ? `1 € = ${fmtKur(kur)} ₺` : "dönem kuru girilmedi"}
          icon={Euro}
        />
      </div>

      {/* ——————————————————————————— maaşı girilmemiş çalışanlar bandı */}
      {eksikler.length > 0 && (
        <div className="grid gap-2.5 border border-primary/40 bg-primary/5 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CircleAlert className="size-4 shrink-0 text-primary" />
            <span className="text-sm">
              Bu ay maaşı girilmemiş:{" "}
              <span className="font-mono font-semibold tabular-nums">{eksikler.length}</span> kişi
            </span>
            {kopyalanabilir.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!yazilabilir || bekleyen}
                onClick={geceniKopyala}
              >
                <Copy className="size-3.5" />
                {bekleyen
                  ? "Kopyalanıyor…"
                  : `Geçen ayı kopyala (${kopyalanabilir.length} satır)`}
              </Button>
            )}
          </div>

          {/* Kişiye dokununca satırı açılır — eksikliği görmekle doldurmak
              arasında ikinci bir ekran yoktur. */}
          <div className="flex flex-wrap gap-1.5">
            {eksikler.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => satirAc(e.id)}
                disabled={!yazilabilir}
                title={`${e.title || categoryLabel(e.category)} — satırı aç`}
                className="oc-tap flex min-h-8 max-w-full items-center gap-1.5 border bg-background px-2 py-1 text-xs transition-colors disabled:opacity-50 hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="oc-tag-dot" style={tagStyle(categoryHue(e.category))} aria-hidden />
                <span className="min-w-0 truncate">{e.fullName}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-foreground/70">
            Bu liste o ay çalışan (çalışma dönemi ayla kesişen) ama maaş satırı olmayan kişilerdir.
            Devralınan kayıtta gerçekten böyle boşluklar vardı; ekran onları gizlemez, sorar.
          </p>
        </div>
      )}

      {/* ——————————————————————————————————————————————————————— tablo */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Ad Soyad</TableHead>
              <TableHead className={cn("w-[11rem]", AT_MD)}>Görev</TableHead>
              <TableHead className="w-[8.5rem] text-right">Net Maaş (₺)</TableHead>
              <TableHead className="w-[6rem] text-right">%50 Saat</TableHead>
              <TableHead className="w-[6rem] text-right">%100 Saat</TableHead>
              <TableHead className="w-[8.5rem] text-right">Mesai Tutarı (₺)</TableHead>
              <TableHead className="w-[9rem] text-right">Toplam (₺)</TableHead>
              <TableHead className={cn("w-[8.5rem] text-right", AT_LG)}>Avro Karşılığı</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {satirlar.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {periodLabel(ay)} için henüz maaş satırı yok. Yukarıdaki listeden bir kişiye
                  dokunun ya da geçen ayı kopyalayın.
                </TableCell>
              </TableRow>
            ) : (
              satirlar.map((r) => {
                const id = r.emp.id;
                const busy = busyRows.has(id);
                return (
                  <TableRow
                    key={id}
                    // SATIR ODAKTAN ÇIKINCA kaydedilir: alan alan değil, satırın
                    // tamamı. `relatedTarget` hâlâ satırın içindeyse kullanıcı
                    // yalnız net maaştan mesai saatine geçmiştir — o an yazmak
                    // aynı satırı üç kez denetim izine düşürürdü.
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        void satiriKaydet(r);
                      }
                    }}
                    className={cn(r.kayit === null && "bg-primary/[0.04]")}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="oc-tag-dot"
                          style={tagStyle(categoryHue(r.emp.category))}
                          title={categoryLabel(r.emp.category)}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{r.emp.fullName}</span>
                        {busy && (
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            kaydediliyor…
                          </span>
                        )}
                        {!busy && isaretli.has(id) && (
                          <Check className="size-3.5 shrink-0 text-success" aria-label="Kaydedildi" />
                        )}
                      </span>
                      {/* Telefonda düşen sütunların kritik olanı burada durur —
                          ikinci bir kart markup'ı YAZILMAZ. */}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground lg:hidden">
                        <span className="md:hidden">
                          {r.emp.title || categoryLabel(r.emp.category)}
                          {r.avro !== null ? " · " : ""}
                        </span>
                        {r.avro !== null && (
                          <span className="font-mono tabular-nums">
                            {fmtNum(r.avro, true)} €
                          </span>
                        )}
                      </span>
                    </TableCell>

                    <TableCell className={cn("text-muted-foreground", AT_MD)}>
                      <span className="block max-w-[11rem] truncate" title={r.emp.title}>
                        {r.emp.title || "—"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={r.taslak.net}
                        onChange={(e) => setSatir(id, { net: e.target.value }, r.taslak)}
                        // Enter satırı ODAKTAN ÇIKARIR; kaydetme yolu tektir.
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        disabled={!yazilabilir || busy}
                        autoFocus={odakId === id}
                        className={HUCRE_INPUT}
                        aria-label={`${r.emp.fullName} net maaş`}
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        value={r.taslak.ot50}
                        onChange={(e) => setSatir(id, { ot50: e.target.value }, r.taslak)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        aria-label={`${r.emp.fullName} %50 zamlı fazla mesai saati`}
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        value={r.taslak.ot100}
                        onChange={(e) => setSatir(id, { ot100: e.target.value }, r.taslak)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        aria-label={`${r.emp.fullName} %100 zamlı fazla mesai saati`}
                      />
                    </TableCell>

                    {/* Türetilmiş sütun: net / 225 × (saat₅₀ × 1,5 + saat₁₀₀ × 2).
                        Elle girilseydi saatlerle çelişebilirdi. */}
                    <TableCell
                      className="text-right font-mono text-sm tabular-nums"
                      title="Net maaş ÷ 225 saat × (%50 saat × 1,5 + %100 saat × 2)"
                    >
                      {r.mesai > 0 ? (
                        fmtNum(r.mesai, true)
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                      {r.net === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        fmtNum(r.toplam, true)
                      )}
                    </TableCell>

                    <TableCell
                      className={cn("text-right font-mono text-sm tabular-nums", AT_LG)}
                    >
                      {r.avro === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        `${fmtNum(r.avro, true)} €`
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
                <TableCell className="font-medium">
                  {toplamlar.ozet.count} kişi
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground md:hidden">
                    normal {fmtNum(toplamlar.ozet.normalHours)} saat
                  </span>
                </TableCell>
                <TableCell className={cn("text-muted-foreground", AT_MD)}>
                  <span className="font-mono text-[11px] tabular-nums">
                    {toplamlar.ozet.count} × {AYLIK_CALISMA_SAATI} saat
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtNum(toplamlar.ozet.netTotal, true)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtNum(toplamlar.s50)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtNum(toplamlar.s100)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtNum(toplamlar.ozet.overtimeTotal, true)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                  {fmtNum(toplamlar.ozet.grandTotal, true)}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_LG)}>
                  {toplamlar.avro === null ? "—" : `${fmtNum(toplamlar.avro, true)} €`}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Net maaş ve mesai saatleri doğrudan tabloda düzenlenir; satırdan çıktığınızda ya da
        Enter&apos;a bastığınızda kaydedilir. Mesai tutarı{" "}
        <span className="font-medium">hesaplanır</span> — aylık 225 saat (30 gün × 7,5) üzerinden
        saatlik ücret bulunur, %50 zamlı saat 1,5 %100 zamlı saat 2 katıyla çarpılır (4857 sayılı
        İş Kanunu md. 41). Prim, harcırah, avans ve kesinti kalemleri kişinin kendi sayfasından
        girilir ve buradaki toplama dâhildir.
        {!canWrite && " Yazma yetkiniz olmadığı için alanlar kapalıdır."}
      </p>
    </div>
  );
}
