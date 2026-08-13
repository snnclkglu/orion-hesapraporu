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
//
// ————————————————————————————————————— 13.08.2026 kullanıcı kararları
//
//  • İZİN VE RAPOR SAATİ KİŞİ BAZINDA girilir: "personel birkaç gün
//    gelmediyse bunu sisteme girmek isterim … dönem ayarlarında değil."
//    İki sütun tabloya indi.
//  • "DÖNEM AYARLARI KISMINA GEREK KALMIYOR": kart kaldırıldı. İçindeki üç
//    şeyin biri (izin/rapor) satıra indi, kalan ikisi (kur künyesi, dönemi
//    kapat/sil) ay şeridine taşındı — ekranın üstünde iki kutu daha az.
//  • "6 KUTUYU TEK SATIRDA": özet kartları `dense` ve `xl:grid-cols-6`.
//  • "TUTARLARDA VİRGÜLDEN SONRAKİ KISIM GÖRÜNMESİN": ekrandaki her tutar
//    `fmtTutar`tan geçer. Kuruş gereken yer bordrodur, orada tam basılır.
//  • "NET MAAŞ 200000 SE 200.000 GİBİ YAZSIN": giriş kutusu odakta değilken
//    binlik ayıraçlı gösterir (`ParaInput`).
//  • "MAAŞ BÖLÜMÜNE ÜCRET PLANINDAN NET MAAŞ VERİSİ GELSİN": yeni açılan
//    satırın net maaşı `hr_salary_plan`ten ön-dolu gelir ve plandan sapan
//    satır ad hücresinde işaretlenir.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  FileText,
  Lock,
  Sigma,
  Timer,
  Trash2,
  Unlock,
  Users,
  Wallet,
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
import { ParaInput } from "@/components/para-input";
import { fmtNum, fmtTutar, parseNum } from "@/lib/currency";
import { tagStyle } from "@/lib/tags";
import { degisimYuzde } from "@/lib/fx/rates";
import { categoryHue, categoryLabel, yonetimMi } from "@/lib/personnel/employee";
import {
  AYLIK_CALISMA_SAATI,
  aylikOdeme,
  donemIzinRapor,
  donemOzeti,
  fazlaMesaiTutari,
  netCalismaSaati,
  periodLabel,
} from "@/lib/personnel/payroll";
import { gecerliUcret, planSapmasi } from "@/lib/personnel/salary-plan";
import { cn } from "@/lib/utils";
import { deletePeriod, ensurePeriodRates, savePayroll, savePeriod } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  EmployeeRow,
  FxMonthlyRow,
  PayrollInput,
  PayrollRow,
  PeriodInput,
  PeriodRow,
  SalaryPlanRow,
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
 *
 * KUR BİR TUTAR DEĞİLDİR: "virgülden sonrası görünmesin" kuralı (13.08.2026)
 * ödenen paralar içindir; bir kurun ondalığı onun BİLGİSİDİR ve atılırsa
 * 54,8231 ile 54,4900 aynı sayı gibi görünür.
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
 * alan Zod varsayılanına düşer. Bu ekranda düzenlenmeyen alanlar (bordronun
 * yasal kalemleri, ödeme tarihi, not) mevcut kayıttan olduğu gibi TAŞINIR —
 * aksi hâlde net maaşı düzeltmek onları sessizce sıfırlardı.
 */
function payrollGirdisi(
  employeeId: string,
  period: string,
  mevcut: PayrollRow | null,
  degerler: {
    netSalary: number;
    overtimeHours50: number;
    overtimeHours100: number;
    bonus: number;
    perDiem: number;
    advance: number;
    deduction: number;
    leaveHours: number;
    reportHours: number;
    workedDays: number;
  }
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
    paidOn: mevcut?.paidOn ?? "",
    note: mevcut?.note ?? "",
  };
}

/**
 * Para alanında SIFIR BİLGİ DEĞİLDİR (saat alanıyla aynı gerekçe): çalışanların
 * çoğunda prim ve avans yoktur ve tablo baştan aşağı "0" duvarına dönerdi.
 */
function paraMetni(v: number | null | undefined): string {
  return v && v > 0 ? girdiMetni(v) : "";
}

/**
 * Satırın düzenlenen alanları — hepsi metindir (bkz. dosya başlığı).
 *
 * PRİM, HARCİRAH, AVANS VE KESİNTİ BURADADIR (kullanıcı kararı, 12.08.2026).
 * Önce yalnız kişinin kendi sayfasından giriliyorlardı; ay kapatılırken kırk
 * kişinin sayfasını tek tek dolaşmak gerçek bir iş akışı değildi. Dördü de
 * AYIN OLGUSUDUR ve ay ekranında girilir. İZİN VE RAPOR SAATİ de 13.08.2026'da
 * aynı gerekçeyle buraya indi.
 */
interface RowDraft {
  net: string;
  ot50: string;
  ot100: string;
  prim: string;
  harcirah: string;
  avans: string;
  kesinti: string;
  izin: string;
  rapor: string;
  /** SGK gün sayısı — tam ay 30. */
  gun: string;
}

/**
 * SÜTUN ÖNCELİKLENDİRME (AGENTS dokunmatik md. 7). Onbeş sütunun dokuzu giriş
 * alanıdır ve daraltılamaz; telefonda görev, ek ödemeler ve avro karşılığı
 * düşer, düşen bilginin kritik olanı ad hücresinin ikinci satırına iner.
 * İkinci bir kart markup'ı YAZILMAZ.
 */
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";
const AT_XL = "hidden xl:table-cell";
const AT_2XL = "hidden 2xl:table-cell";

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
  plans = [],
  canWrite,
}: {
  ay: string;
  bugunAy: string;
  employees: EmployeeRow[];
  payroll: PayrollRow[];
  previousPayroll: PayrollRow[];
  periods: PeriodRow[];
  fxMonthly: FxMonthlyRow[];
  /** Ücret planı — yeni satırın net maaşı buradan ön-dolu gelir. */
  plans?: SalaryPlanRow[];
  canWrite: boolean;
}) {
  const router = useRouter();

  const donem = useMemo(() => periods.find((p) => p.period === ay) ?? null, [periods, ay]);
  const ortalama = useMemo(() => fxMonthly.find((f) => f.period === ay) ?? null, [fxMonthly, ay]);

  const [taslaklar, setTaslaklar] = useState<Record<string, RowDraft>>({});
  /** Dönem silme onayı. */
  const [silOnay, setSilOnay] = useState(false);
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
  }

  const aralik = useMemo(() => ayAraligi(ay), [ay]);
  const kur = donem?.eurTryRate ?? null;
  /**
   * Dönem kurunun HANGİ GÜNDEN geldiği. Ay sonu kuru yazılırken o günün
   * tarihini ayrıca saklamıyoruz; ayın son yayın günü kur tablosundan
   * okunur ve ekranda künye olarak gösterilir — "54,8231" tek başına
   * doğrulanamaz, "31.07 · TCMB" doğrulanabilir.
   */
  const kurKaynagi = useMemo(() => {
    if (kur === null) return null;
    const ayKaydi = fxMonthly.find((f) => f.period === ay);
    return ayKaydi?.lastDay ?? null;
  }, [kur, fxMonthly, ay]);
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

  /** Bu ayda geçerli ücret kararı — kişi başına (ücret planından). */
  const planliUcret = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of employees) {
      const p = gecerliUcret(plans, e.id, ay);
      if (p && p.netSalary > 0) m.set(e.id, p.netSalary);
    }
    return m;
  }, [plans, employees, ay]);

  /** Tabloda görünen satırlar: maaş kaydı olanlar + elle açılanlar. */
  const satirlar = useMemo(() => {
    return employees
      .filter((e) => kayitlar.has(e.id) || acikSet.has(e.id))
      .map((e) => {
        const kayit = kayitlar.get(e.id) ?? null;
        const planNet = planliUcret.get(e.id) ?? null;
        const taslak: RowDraft = taslaklar[e.id] ?? {
          // YENİ SATIRIN NET MAAŞI ÜCRET PLANINDAN GELİR (kullanıcı kararı,
          // 13.08.2026). Kayıt varsa kayıt kazanır: ödenmiş bir ayı plandaki
          // kararla ezmek, olguyu kararla değiştirmek olurdu.
          net: girdiMetni(kayit?.netSalary ?? planNet ?? null),
          ot50: saatMetni(kayit?.overtimeHours50),
          ot100: saatMetni(kayit?.overtimeHours100),
          prim: paraMetni(kayit?.bonus),
          harcirah: paraMetni(kayit?.perDiem),
          avans: paraMetni(kayit?.advance),
          kesinti: paraMetni(kayit?.deduction),
          izin: saatMetni(kayit?.leaveHours),
          rapor: saatMetni(kayit?.reportHours),
          gun: girdiMetni(kayit?.workedDays ?? 30),
        };
        const net = parseNum(taslak.net);
        const s50 = parseNum(taslak.ot50) ?? 0;
        const s100 = parseNum(taslak.ot100) ?? 0;
        const prim = parseNum(taslak.prim) ?? 0;
        const harcirah = parseNum(taslak.harcirah) ?? 0;
        const avans = parseNum(taslak.avans) ?? 0;
        const kesinti = parseNum(taslak.kesinti) ?? 0;
        const izin = parseNum(taslak.izin) ?? 0;
        const rapor = parseNum(taslak.rapor) ?? 0;
        const gunSayisi = parseNum(taslak.gun) ?? 30;
        // Mesai tutarı ANINDA gösterilir: sunucudaki türetilmiş sütunla
        // (`hr_payroll.overtime_amount`) aynı bağıntının saf kopyası, kullanıcı
        // kaydetmeden önce görmelidir.
        const mesai = fazlaMesaiTutari(net, s50, s100);
        // Toplam TASLAKTAN hesaplanır, kayıttan değil: kullanıcı prim yazarken
        // toplamın anında değişmesi gerekir. Avans netten MAHSUPTUR ve
        // `aylikOdeme` onu bilmez — kesintiyle birlikte burada düşülür.
        const toplam =
          aylikOdeme({
            netSalary: net,
            overtimeAmount: mesai,
            bonus: prim,
            perDiem: harcirah,
            deduction: kesinti,
          }) - avans;
        return {
          emp: e,
          kayit,
          taslak,
          net,
          s50,
          s100,
          prim,
          harcirah,
          avans,
          kesinti,
          izin,
          rapor,
          gunSayisi,
          mesai,
          toplam,
          planNet,
          // PLANDAN SAPMA bir UYARIDIR, bir ENGEL değil: eksik gün, ücretsiz
          // izin ve ay ortası giriş meşru sapmalardır ve uygulama hangisi
          // olduğunu bilemez. Sayıyı gösterir, kararı insan verir.
          sapma: planSapmasi(planNet, net),
          avro: kur && kur > 0 ? toplam / kur : null,
        };
      })
      .sort(
        (a, b) =>
          a.emp.category.localeCompare(b.emp.category, "tr") ||
          a.emp.fullName.localeCompare(b.emp.fullName, "tr")
      );
  }, [employees, kayitlar, acikSet, taslaklar, kur, planliUcret]);

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
      // TASLAKTAN okunur, kayıttan değil: kullanıcı prim yazarken üstteki
      // kartların anında değişmesi gerekir.
      bonus: r.prim,
      perDiem: r.harcirah,
      deduction: r.kesinti,
      leaveHours: r.izin,
      reportHours: r.rapor,
    }));
    const genelToplam = sayilan.reduce((t, r) => t + r.toplam, 0);
    // İZİN/RAPOR TEK KAYNAKTAN: kişi satırlarında varsa onlar, hiç yoksa
    // devralınan ay değeri. İkisi asla TOPLANMAZ (`donemIzinRapor`).
    const izinRapor = donemIzinRapor(ozetGirdisi, donem);
    return {
      ozet: donemOzeti(ozetGirdisi),
      personel: donemOzeti(ozetGirdisi.filter((r) => !yonetimMi(r.category))),
      yonetim: donemOzeti(ozetGirdisi.filter((r) => yonetimMi(r.category))),
      s50: sayilan.reduce((t, r) => t + r.s50, 0),
      s100: sayilan.reduce((t, r) => t + r.s100, 0),
      prim: sayilan.reduce((t, r) => t + r.prim, 0),
      harcirah: sayilan.reduce((t, r) => t + r.harcirah, 0),
      avans: sayilan.reduce((t, r) => t + r.avans, 0),
      kesinti: sayilan.reduce((t, r) => t + r.kesinti, 0),
      izinRapor,
      // Genel toplam AVANSI da düşer; `donemOzeti` avansı bilmez.
      genelToplam,
      avro: kur && kur > 0 ? genelToplam / kur : null,
    };
  }, [satirlar, kur, donem]);

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

  /** Ücret planından doldurulabilecek satırlar — düğme basılmadan sayısı bilinir. */
  const plandanDolar = useMemo(
    () => eksikler.filter((e) => (planliUcret.get(e.id) ?? 0) > 0),
    [eksikler, planliUcret]
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
      router.replace(`/personnel/maas?ay=${yeni}`);
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

  /**
   * DÖNEM KURLARINI OTOMATİK TAMAMLA — ekran açıldığında bir kez.
   *
   * Kullanıcı kararı (12.08.2026): "Yeni ayın ilk gününde biri sisteme giriş
   * yaptığında sistem otomatik kur çeksin." Eylem İDEMPOTENTtir: yapacak iş
   * yoksa hiçbir şey yazmaz. `ref` ile bir kez çağrılır — `router.refresh()`
   * bileşeni yeniden boyar ve efekt bağımlılığa girseydi döngü olurdu.
   */
  const kurDenendi = useRef(false);
  useEffect(() => {
    if (!canWrite || kurDenendi.current) return;
    kurDenendi.current = true;
    void (async () => {
      const res = await ensurePeriodRates();
      if (res.error || res.yazilan.length === 0) return;
      const bu = res.yazilan.find((x) => x.period === ay);
      toast.success(
        bu
          ? `${periodLabel(bu.period)} kuru ${bu.date.slice(8, 10)}.${bu.date.slice(5, 7)} TCMB kurundan yazıldı.`
          : `${res.yazilan.length} dönemin kuru otomatik tamamlandı.`
      );
      router.refresh();
    })();
  }, [canWrite, ay, router]);

  function donemiSil() {
    startTransition(async () => {
      const res = await deletePeriod(ay);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSilOnay(false);
      toast.success(`${periodLabel(ay)} dönemi ve ${res.id ?? 0} maaş satırı silindi.`);
      router.refresh();
    });
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
        if (satir.s50 > 0 || satir.s100 > 0 || satir.izin > 0 || satir.rapor > 0) {
          toast.error("Önce net maaşı girin.");
        }
        return;
      }
      const mevcut = satir.kayit;
      if (
        mevcut &&
        mevcut.netSalary === net &&
        mevcut.overtimeHours50 === satir.s50 &&
        mevcut.overtimeHours100 === satir.s100 &&
        mevcut.bonus === satir.prim &&
        mevcut.perDiem === satir.harcirah &&
        mevcut.advance === satir.avans &&
        mevcut.deduction === satir.kesinti &&
        mevcut.leaveHours === satir.izin &&
        mevcut.reportHours === satir.rapor &&
        mevcut.workedDays === satir.gunSayisi
      ) {
        return; // değişmemiş satır denetim izine yazılmaz
      }

      setBusyRows((prev) => new Set(prev).add(id));
      const res = await savePayroll(
        payrollGirdisi(id, ay, mevcut, {
          netSalary: net,
          overtimeHours50: satir.s50,
          overtimeHours100: satir.s100,
          bonus: satir.prim,
          perDiem: satir.harcirah,
          advance: satir.avans,
          deduction: satir.kesinti,
          leaveHours: satir.izin,
          reportHours: satir.rapor,
          workedDays: satir.gunSayisi,
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
   * Toplu satır açma — net maaşı verilen kaynaktan alır.
   *
   * MESAİ, İZİN VE RAPOR SAATLERİ TAŞINMAZ: onlar ayın kendi olgusudur ve
   * geçen ayın saatlerini taşımak, düzeltilmediğinde yanlış bir ödeme
   * üretirdi. Prim, harcırah, avans ve kesinti de aynı sebeple sıfırdan başlar.
   */
  function topluAc(
    kaynak: { employeeId: string; netSalary: number }[],
    basariMesaji: (eklenen: number) => string
  ) {
    if (!yazilabilir || kaynak.length === 0) return;
    startTransition(async () => {
      let eklenen = 0;
      let hata = 0;
      // Sıralı yazılır: kırk satırı aynı anda göndermek hem denetim izini
      // karıştırır hem de tek bir hatayı görünmez kılardı.
      for (const p of kaynak) {
        const res = await savePayroll(
          payrollGirdisi(p.employeeId, ay, null, {
            netSalary: p.netSalary,
            overtimeHours50: 0,
            overtimeHours100: 0,
            bonus: 0,
            perDiem: 0,
            advance: 0,
            deduction: 0,
            leaveHours: 0,
            reportHours: 0,
            workedDays: 30,
          })
        );
        if (res.error) hata += 1;
        else eklenen += 1;
      }
      if (hata > 0) toast.error(`${hata} satır yazılamadı.`);
      if (eklenen > 0) toast.success(basariMesaji(eklenen));
      router.refresh();
    });
  }

  /** Dönem ayarları — bugün yalnız KAPANIŞ İŞARETİ (kur ve izin/rapor değil). */
  function donemiYaz(patch: Partial<PeriodInput>, basariMesaji: string) {
    if (!canWrite) return;
    const girdi: PeriodInput = {
      period: ay,
      // Kur ve izin/rapor alanları tip uyumu için taşınır; `savePeriod` üçüne
      // de DOKUNMAZ (bkz. actions.ts).
      eurTryRate: donem?.eurTryRate ?? null,
      usdTryRate: donem?.usdTryRate ?? null,
      leaveHours: donem?.leaveHours ?? 0,
      reportHours: donem?.reportHours ?? 0,
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
      toast.success(basariMesaji);
      router.refresh();
    });
  }

  function satirAc(id: string) {
    setAcilanlar((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setOdakId(id);
  }

  // ——————————————————————————————————————————————————————————————— sunum

  const kurSapmasi = kur && ortalama ? degisimYuzde(kur, ortalama.eurTry) : null;
  const netSaat = netCalismaSaati(
    toplamlar.ozet.normalHours,
    toplamlar.ozet.overtimeHours,
    toplamlar.izinRapor.leaveHours,
    toplamlar.izinRapor.reportHours
  );

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————————————————— ay şeridi
          "DÖNEM AYARLARI" KARTI KALDIRILDI (kullanıcı kararı, 13.08.2026):
          içindeki izin/rapor kutuları kişi satırına indi, geriye kalan kur
          künyesi ile dönem kapat/sil düğmeleri buraya taşındı. Ayrı bir kart
          artık tek bir okunur sayı ve iki düğme için ekranda ~120px yerdi. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2.5">
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
          {kapali && (
            <span className="oc-tag px-1.5 py-0.5 text-xs" style={tagStyle(0)}>
              Kapalı
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

        {/* KUR OKUNUR, GİRİLMEZ (kullanıcı kararı, 12.08.2026): ayın son yayın
            gününün TCMB kuru otomatik yazılır. Bir `Input` olsaydı
            "değiştirebilirim" derdi ve o söz tutulmazdı. */}
        <span
          className="flex items-center gap-1.5 border bg-background px-2 py-1 font-mono text-xs tabular-nums"
          title={
            kurKaynagi
              ? `${kurKaynagi} tarihli TCMB kuru — ödenmiş ayın avro karşılığı sonradan değişmez`
              : "Ay kapandığında TCMB'nin son yayın gününden otomatik yazılır"
          }
        >
          <Euro className="size-3.5 shrink-0 text-primary" aria-hidden />
          {kur === null ? (
            <span className="font-sans text-muted-foreground">
              {ay >= bugunAy ? "ay kapanınca yazılır" : "kur bekleniyor"}
            </span>
          ) : (
            <>
              <span className="font-semibold">{fmtKur(kur)} ₺</span>
              {kurKaynagi && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {kurKaynagi.slice(8, 10)}.{kurKaynagi.slice(5, 7)} · TCMB
                </span>
              )}
              {/* Ortalama BİLGİDİR: dönem kuru ay sonundan gelir, ortalamadan
                  değil. Yalnız gözle görülür bir ayrışma varsa basılır. */}
              {kurSapmasi !== null && Math.abs(kurSapmasi) >= 0.05 && (
                <span
                  className="text-[11px] font-normal text-muted-foreground"
                  title={`${periodLabel(ay)} ortalaması ${fmtKur(ortalama?.eurTry)} ₺ (${ortalama?.dayCount} yayın günü)`}
                >
                  ort. %{fmtNum(Math.abs(kurSapmasi), true)} {kurSapmasi > 0 ? "altında" : "üstünde"}
                </span>
              )}
            </>
          )}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
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
          {/* DÖNEMİ SİL — bir ayı baştan girmenin yolu satır satır silmek
              olmamalı (kullanıcı kararı, 12.08.2026). Kapalı dönem önce
              AÇILIR: kapatma işareti kazara silmeye karşı ilk kapıdır. */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-destructive"
            disabled={!canWrite || bekleyen || kapali || satirlar.length === 0}
            title={
              kapali
                ? "Kapalı dönem silinemez — önce dönemi açın"
                : `${periodLabel(ay)} dönemini ve maaş satırlarını siler`
            }
            onClick={() => setSilOnay(true)}
          >
            <Trash2 className="size-3.5" />
            Dönemi sil
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn("gap-1.5 text-xs", satirlar.length === 0 && "pointer-events-none opacity-50")}
          >
            {/* BORDROLARI İNDİR — dönemin bütün pusulaları TEK PDF, kişi başına
                bir sayfa (kullanıcı kararı, 12.08.2026). */}
            <a href={`/personnel/bordro?donem=${ay}&hepsi=1`}>
              <FileText className="size-3.5" /> Bordrolar
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <a href={`/personnel/export?ay=${ay}`}>
              <Download className="size-3.5" /> Excel
            </a>
          </Button>
        </div>
      </div>

      {/* ————————————————————————————— özet kartları — ALTISI TEK SATIRDA
          (kullanıcı kararı, 13.08.2026). `dense` dolguyu ve sayı boyunu bir
          kademe kısar; etiket, sayı ve ipucu üçü de yerinde kalır.

          KART İÇİ NOTLARDA HER SÖZCÜĞÜN BAŞ HARFİ BÜYÜKTÜR (kullanıcı kararı,
          13.08.2026). Metinler ELLE öyle yazılır, bir dönüştürücüden
          GEÇİRİLMEZ: notların içinde sayı, simge ve kısaltma var
          ("1 € = 54,8231 ₺", "%50: 12 · %100: 8") ve genel bir başlık düzeni
          onları da "düzeltmeye" kalkardı. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          dense
          label="Kişi"
          value={String(toplamlar.ozet.count)}
          hint={`${toplamlar.personel.count} Personel · ${toplamlar.yonetim.count} Yönetim`}
          icon={Users}
        />
        <StatCard
          dense
          label="Toplam Net Maaş"
          value={`${fmtTutar(toplamlar.ozet.netTotal)} ₺`}
          hint={`Kişi Başı Ort. ${fmtTutar(toplamlar.ozet.netAverage)} ₺`}
          icon={Banknote}
        />
        <StatCard
          dense
          label="Fazla Mesai Saati"
          value={fmtNum(toplamlar.ozet.overtimeHours)}
          hint={`%50: ${fmtNum(toplamlar.s50)} · %100: ${fmtNum(toplamlar.s100)}`}
          icon={Timer}
        />
        <StatCard
          dense
          label="Fazla Mesai Tutarı"
          value={`${fmtTutar(toplamlar.ozet.overtimeTotal)} ₺`}
          hint={
            toplamlar.ozet.overtimeHours > 0
              ? `Saat Başı ${fmtTutar(toplamlar.ozet.overtimeHourCost)} ₺`
              : "Bu Ay Mesai Girilmedi"
          }
          icon={Clock}
        />
        <StatCard
          dense
          label="Genel Toplam"
          value={`${fmtTutar(toplamlar.genelToplam)} ₺`}
          hint={`Personel ${fmtTutar(toplamlar.personel.grandTotal)} · Yönetim ${fmtTutar(toplamlar.yonetim.grandTotal)}`}
          icon={Sigma}
        />
        <StatCard
          dense
          label="Avro Karşılığı"
          value={toplamlar.avro === null ? "—" : `${fmtTutar(toplamlar.avro)} €`}
          hint={kur ? `1 € = ${fmtKur(kur)} ₺` : "Dönem Kuru Henüz Yazılmadı"}
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
            {/* ÜCRET PLANINDAN DOLDUR — kullanıcının asıl istediği yol
                (13.08.2026): net maaş yıl başında belirlenmiştir, ay ay
                kopyalanacak bir şey değildir. "Geçen ayı kopyala" ikinci
                sıraya düşer ama KALIR: planı olmayan kişide tek yol odur. */}
            {plandanDolar.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!yazilabilir || bekleyen}
                onClick={() =>
                  topluAc(
                    plandanDolar.map((e) => ({
                      employeeId: e.id,
                      netSalary: planliUcret.get(e.id) as number,
                    })),
                    (n) => `Ücret planından ${n} satır eklendi — mesai ve izin saatleri boş.`
                  )
                }
              >
                <Wallet className="size-3.5" />
                {bekleyen ? "Yazılıyor…" : `Ücret planından doldur (${plandanDolar.length})`}
              </Button>
            )}
            {kopyalanabilir.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!yazilabilir || bekleyen}
                onClick={() =>
                  topluAc(
                    kopyalanabilir.map((p) => ({
                      employeeId: p.employeeId,
                      netSalary: p.netSalary,
                    })),
                    (n) =>
                      `${periodLabel(ayKaydir(ay, -1))} listesinden ${n} satır eklendi — mesai ve izin saatleri boş.`
                  )
                }
              >
                <Copy className="size-3.5" />
                {bekleyen ? "Kopyalanıyor…" : `Geçen ayı kopyala (${kopyalanabilir.length})`}
              </Button>
            )}
          </div>

          {/* Kişiye dokununca satırı açılır — eksikliği görmekle doldurmak
              arasında ikinci bir ekran yoktur. */}
          <div className="flex flex-wrap gap-1.5">
            {eksikler.map((e) => {
              const plan = planliUcret.get(e.id) ?? null;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => satirAc(e.id)}
                  disabled={!yazilabilir}
                  title={
                    plan
                      ? `${e.title || categoryLabel(e.category)} — planlı ücret ${fmtTutar(plan)} ₺`
                      : `${e.title || categoryLabel(e.category)} — satırı aç`
                  }
                  className="oc-tap flex min-h-8 max-w-full items-center gap-1.5 border bg-background px-2 py-1 text-xs transition-colors disabled:opacity-50 hover:border-primary/50 hover:bg-primary/5"
                >
                  <span className="oc-tag-dot" style={tagStyle(categoryHue(e.category))} aria-hidden />
                  <span className="min-w-0 truncate">{e.fullName}</span>
                  {plan !== null && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {fmtTutar(plan)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-foreground/70">
            Bu liste o ay çalışan (çalışma dönemi ayla kesişen) ama maaş satırı olmayan kişilerdir.
            Devralınan kayıtta gerçekten böyle boşluklar vardı; ekran onları gizlemez, sorar.
          </p>
        </div>
      )}

      {/* ——————————————————————————————————————————————————————— tablo */}
      <div className="oc-scrollx overflow-x-auto rounded-lg border bg-card [--oc-scroll-bg:var(--card)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Ad Soyad</TableHead>
              <TableHead className={cn("w-[10rem]", AT_2XL)}>Görev</TableHead>
              <TableHead className={cn("w-[4.5rem] text-right", AT_2XL)}>SGK Gün</TableHead>
              <TableHead className="w-[8.5rem] text-right">Net Maaş (₺)</TableHead>
              <TableHead className="w-[5.5rem] text-right">%50 Saat</TableHead>
              <TableHead className="w-[5.5rem] text-right">%100 Saat</TableHead>
              <TableHead className="w-[8rem] text-right">Mesai Tutarı (₺)</TableHead>
              {/* İZİN VE RAPOR SAATİ ARTIK BURADA (kullanıcı kararı,
                  13.08.2026): "personel birkaç gün gelmediyse bunu kişi
                  bazında gireyim". Dönem ayarlarındaki iki kutu kalktı. */}
              <TableHead className={cn("w-[5.5rem] text-right", AT_MD)}>İzin (saat)</TableHead>
              <TableHead className={cn("w-[5.5rem] text-right", AT_MD)}>Rapor (saat)</TableHead>
              {/* DÖRT PARA SÜTUNU (kullanıcı kararı, 12.08.2026): ay
                  kapatılırken kırk kişinin profilini tek tek dolaşmak yerine
                  hepsi burada girilir. Dar ekranda düşerler ve ad hücresinin
                  altında özetlenirler. */}
              <TableHead className={cn("w-[6.5rem] text-right", AT_LG)}>Prim (₺)</TableHead>
              <TableHead className={cn("w-[6.5rem] text-right", AT_LG)}>Harcirah (₺)</TableHead>
              <TableHead className={cn("w-[6.5rem] text-right", AT_XL)}>Avans (₺)</TableHead>
              <TableHead className={cn("w-[6.5rem] text-right", AT_XL)}>Kesinti (₺)</TableHead>
              <TableHead className="w-[9rem] text-right">Toplam (₺)</TableHead>
              <TableHead className={cn("w-[8rem] text-right", AT_2XL)}>Avro Karşılığı</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {satirlar.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={15} className="py-10 text-center text-sm text-muted-foreground">
                  {periodLabel(ay)} için henüz maaş satırı yok. Yukarıdaki listeden bir kişiye
                  dokunun, ücret planından doldurun ya da geçen ayı kopyalayın.
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
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground 2xl:hidden">
                        <span className="2xl:hidden">
                          {r.emp.title || categoryLabel(r.emp.category)}
                        </span>
                        {(r.izin > 0 || r.rapor > 0) && (
                          <span className="font-mono tabular-nums md:hidden">
                            {" · "}
                            {[
                              r.izin > 0 ? `izin ${fmtNum(r.izin)} sa` : "",
                              r.rapor > 0 ? `rapor ${fmtNum(r.rapor)} sa` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        {(r.prim > 0 || r.harcirah > 0 || r.avans > 0 || r.kesinti > 0) && (
                          <span className="font-mono tabular-nums xl:hidden">
                            {" · "}
                            {[
                              r.prim > 0 ? `prim ${fmtTutar(r.prim)}` : "",
                              r.harcirah > 0 ? `harc. ${fmtTutar(r.harcirah)}` : "",
                              r.avans > 0 ? `avans −${fmtTutar(r.avans)}` : "",
                              r.kesinti > 0 ? `kes. −${fmtTutar(r.kesinti)}` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                        {r.avro !== null && (
                          <span className="font-mono tabular-nums">
                            {" · "}
                            {fmtTutar(r.avro)} €
                          </span>
                        )}
                      </span>
                      {/* PLANDAN SAPMA — bir uyarı, bir engel değil. */}
                      {r.sapma !== null && (
                        <span
                          className="mt-0.5 block font-mono text-[11px] font-normal text-amber-600 tabular-nums dark:text-amber-400"
                          title={`Ücret planında ${fmtTutar(r.planNet)} ₺ yazıyor. Eksik gün ya da ücretsiz izin varsa bu normaldir.`}
                        >
                          plan {fmtTutar(r.planNet)} ₺ ({r.sapma > 0 ? "+" : "−"}
                          {fmtTutar(Math.abs(r.sapma))})
                        </span>
                      )}
                    </TableCell>

                    <TableCell className={cn("text-muted-foreground", AT_2XL)}>
                      <span className="block max-w-[10rem] truncate" title={r.emp.title}>
                        {r.emp.title || "—"}
                      </span>
                    </TableCell>

                    <TableCell className={AT_2XL}>
                      <Input
                        value={r.taslak.gun}
                        onChange={(e) => setSatir(id, { gun: e.target.value }, r.taslak)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="numeric"
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        aria-label={`${r.emp.fullName} SGK gün sayısı`}
                      />
                    </TableCell>

                    <TableCell>
                      <ParaInput
                        value={r.taslak.net}
                        onChange={(v) => setSatir(id, { net: v }, r.taslak)}
                        disabled={!yazilabilir || busy}
                        autoFocus={odakId === id}
                        className={HUCRE_INPUT}
                        ariaLabel={`${r.emp.fullName} net maaş`}
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
                        fmtTutar(r.mesai)
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>

                    <TableCell className={AT_MD}>
                      <Input
                        value={r.taslak.izin}
                        onChange={(e) => setSatir(id, { izin: e.target.value }, r.taslak)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        aria-label={`${r.emp.fullName} izin saati`}
                        title="Kişinin bu aydaki izin saati — net çalışma saatinden düşülür"
                      />
                    </TableCell>

                    <TableCell className={AT_MD}>
                      <Input
                        value={r.taslak.rapor}
                        onChange={(e) => setSatir(id, { rapor: e.target.value }, r.taslak)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal"
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        aria-label={`${r.emp.fullName} raporlu saat`}
                        title="Kişinin bu aydaki raporlu (istirahat) saati"
                      />
                    </TableCell>

                    <TableCell className={AT_LG}>
                      <ParaInput
                        value={r.taslak.prim}
                        onChange={(v) => setSatir(id, { prim: v }, r.taslak)}
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        ariaLabel={`${r.emp.fullName} prim / ikramiye`}
                      />
                    </TableCell>

                    <TableCell className={AT_LG}>
                      <ParaInput
                        value={r.taslak.harcirah}
                        onChange={(v) => setSatir(id, { harcirah: v }, r.taslak)}
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        ariaLabel={`${r.emp.fullName} harcirah`}
                      />
                    </TableCell>

                    <TableCell className={AT_XL}>
                      <ParaInput
                        value={r.taslak.avans}
                        onChange={(v) => setSatir(id, { avans: v }, r.taslak)}
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        ariaLabel={`${r.emp.fullName} avans`}
                      />
                    </TableCell>

                    <TableCell className={AT_XL}>
                      <ParaInput
                        value={r.taslak.kesinti}
                        onChange={(v) => setSatir(id, { kesinti: v }, r.taslak)}
                        disabled={!yazilabilir || busy}
                        className={HUCRE_INPUT}
                        ariaLabel={`${r.emp.fullName} diğer kesinti`}
                      />
                    </TableCell>

                    <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                      {r.net === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        fmtTutar(r.toplam)
                      )}
                    </TableCell>

                    <TableCell
                      className={cn("text-right font-mono text-sm tabular-nums", AT_2XL)}
                    >
                      {r.avro === null ? (
                        <span className="text-muted-foreground/60">—</span>
                      ) : (
                        `${fmtTutar(r.avro)} €`
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
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground 2xl:hidden">
                    normal {fmtNum(toplamlar.ozet.normalHours)} saat
                  </span>
                </TableCell>
                <TableCell className={cn("text-muted-foreground", AT_2XL)}>
                  <span className="font-mono text-[11px] tabular-nums">
                    {toplamlar.ozet.count} × {AYLIK_CALISMA_SAATI} saat
                  </span>
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_2XL)} />
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtTutar(toplamlar.ozet.netTotal)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtNum(toplamlar.s50)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtNum(toplamlar.s100)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {fmtTutar(toplamlar.ozet.overtimeTotal)}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_MD)}>
                  {toplamlar.izinRapor.leaveHours > 0
                    ? fmtNum(toplamlar.izinRapor.leaveHours)
                    : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_MD)}>
                  {toplamlar.izinRapor.reportHours > 0
                    ? fmtNum(toplamlar.izinRapor.reportHours)
                    : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_LG)}>
                  {toplamlar.prim > 0 ? fmtTutar(toplamlar.prim) : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_LG)}>
                  {toplamlar.harcirah > 0 ? fmtTutar(toplamlar.harcirah) : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_XL)}>
                  {toplamlar.avans > 0 ? `−${fmtTutar(toplamlar.avans)}` : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_XL)}>
                  {toplamlar.kesinti > 0 ? `−${fmtTutar(toplamlar.kesinti)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                  {fmtTutar(toplamlar.genelToplam)}
                </TableCell>
                <TableCell className={cn("text-right font-mono text-sm tabular-nums", AT_2XL)}>
                  {toplamlar.avro === null ? "—" : `${fmtTutar(toplamlar.avro)} €`}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <div className="grid gap-1 text-[11px] text-muted-foreground">
        <p>
          Bütün alanlar doğrudan tabloda düzenlenir; satırdan çıktığınızda ya da Enter&apos;a
          bastığınızda kaydedilir. Mesai tutarı <span className="font-medium">hesaplanır</span> —
          aylık 225 saat (30 gün × 7,5) üzerinden saatlik ücret bulunur, %50 zamlı saat 1,5 %100
          zamlı saat 2 katıyla çarpılır (4857 sayılı İş Kanunu md. 41). Avans ve kesinti toplamdan
          düşülür; harcirah ve prim eklenir. Dar ekranda düşen sütunlar ad hücresinin altında
          özetlenir.
        </p>
        <p>
          <span className="font-medium">Net çalışma saati {fmtNum(netSaat)}</span> = normal{" "}
          {fmtNum(toplamlar.ozet.normalHours)} + mesai {fmtNum(toplamlar.ozet.overtimeHours)} − izin{" "}
          {fmtNum(toplamlar.izinRapor.leaveHours)} − rapor {fmtNum(toplamlar.izinRapor.reportHours)}.
          {toplamlar.izinRapor.devralinan && (
            <>
              {" "}
              <span className="text-amber-600 dark:text-amber-400">
                İzin ve rapor saatleri bu ay <strong>devralınan ay toplamından</strong> okundu (kişi
                bazlı giriş yok) — bir satıra saat yazdığınızda o toplam devre dışı kalır.
              </span>
            </>
          )}
        </p>
        <p>
          Dönem kuru <span className="font-medium">otomatiktir</span>: ay kapandığında TCMB&apos;nin
          o ayki <span className="font-medium">son yayın gününün</span> kuru yazılır ve orada{" "}
          <span className="font-medium">donar</span> — ödenmiş bir ayın avro karşılığı, kur tablosu
          sonradan tazelendiğinde değişmemelidir. Net maaş{" "}
          <Link href="/personnel/ucret" className="underline">
            Ücret Planı
          </Link>{" "}
          ekranında belirlenir; buradaki değer ondan gelir ve gerektiğinde düzeltilebilir.
          {!canWrite && " Yazma yetkiniz olmadığı için alanlar kapalıdır."}
        </p>
      </div>

      {/* DÖNEMİ SİL — geri alınamaz, sayı ONAY PENCERESİNDE görünür. */}
      {silOnay && (
        <Dialog open onOpenChange={(o) => !o && setSilOnay(false)}>
          <DialogContent className="sm:max-w-[min(30rem,calc(100%-2rem))]">
            <DialogHeader>
              <DialogTitle>{periodLabel(ay)} dönemi silinsin mi?</DialogTitle>
              <DialogDescription>
                Bu ayın <strong>{satirlar.length} maaş satırı</strong> ve dönem kaydı (kur, kapanış
                işareti) kalıcı olarak silinecek. Personel kayıtları, ücret planı ve diğer aylar
                etkilenmez. Bu işlem geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="oc-tap" onClick={() => setSilOnay(false)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                className="oc-tap"
                disabled={bekleyen}
                onClick={donemiSil}
              >
                {bekleyen ? "Siliniyor…" : "Dönemi sil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
