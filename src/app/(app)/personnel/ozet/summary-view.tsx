"use client";

// Özet — devralınan Excel'in "Maaş Özet Tablo" + "Aylık Çalışma Saatleri"
// sayfalarının karşılığı.
//
// BU EKRAN HİÇBİR ŞEY SAKLAMAZ. Her sayı maaş satırlarından TÜRETİLİR
// (`donemOzeti`, `donemIzinRapor`, `netCalismaSaati`). Excel'de bu iki sayfa
// elle yapıştırılmış değerler taşıyordu ve BİRBİRLERİYLE ÇELİŞİYORDU (yedi ayda
// kişi sayısı tutmuyordu); ikinci bir özet tablosu tutmanın bedeli tam olarak
// budur.
//
// AVRO KARŞILIĞI DÖNEMİN KENDİ KURUYLA hesaplanır (`hr_periods.eur_try_rate`),
// bugünkü kurla değil: ödenmiş bir ayın avro karşılığı sonradan değişmemelidir
// (AGENTS SATIS-16). Kuru girilmemiş ay sıfır SAYILMAZ — hücre "—" olur ve satır
// bunu ayrıca söyler.
//
// ————————————————————————————————————— 13.08.2026 kullanıcı kararları
//
//  • "BU SAYFA YATAYDA SIĞSIN, KAYDIRMAK GEREKMESİN": tablo on üç sütundan
//    on ikiye indi, hepsi `text-xs` ve dar dolguda; ikisi (izin/rapor) tek bir
//    sütunda birleşti. Kaydırma kabı DURUYOR ama artık 1280px'de devreye
//    girmiyor — bir emniyet kemeri olarak kalır, bir gereklilik olarak değil.
//  • "BAŞLIKLARDA KAYMALAR VAR": başlık ile hücre artık AYNI TANIMDAN üretilir
//    (`SUTUNLAR`). Hizalama ve kırılım sınıfı sütunun kendindedir, iki ayrı
//    yerde yazılmadığı için ayrışamaz — kayma yapısal olarak imkânsız.
//  • "İLK AÇILDIĞINDA İÇİNDE BULUNDUĞUMUZ YIL GELSİN": varsayılan bu yıldır
//    (sunucu tarafında; bkz. `page.tsx`).
//  • "YILI SEÇTİĞİMDE O YIL ÖDEDİĞİM TOPLAMI VE AVRO KARŞILIĞINI GÖREYİM":
//    hem bir kart hem tablonun TOPLAM SATIRI.
//  • "TABLOLAR BAR DEĞİL ÇİZGİ OLSUN": `TimeLineChart`.
//  • "EN ALTTAKİ TABLONUN ALTINDA TOPLAMLAR OLSUN, YIL SEÇİLİNCE DEĞİŞSİN":
//    `TableFooter` — toplamlar tablodaki AYNI satırlardan çıkar, ikinci bir
//    hesap yolu yoktur.
//  • "TUTARLARDA VİRGÜLDEN SONRASI GÖRÜNMESİN": `fmtTutar`.

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Banknote, CalendarRange, Euro, Timer, Users } from "lucide-react";
import {
  AYLIK_CALISMA_SAATI,
  donemIzinRapor,
  donemOzeti,
  netCalismaSaati,
  periodLabel,
  type PayrollRowLike,
} from "@/lib/personnel/payroll";
import { categoryHue, categoryLabel, yonetimMi } from "@/lib/personnel/employee";
import { fmtNum, fmtTutar } from "@/lib/currency";
import { saatlikMaliyet } from "@/lib/personnel/bordro";
import { hueFromText } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartLegend, RankBars, StatCard, TimeLineChart,
  type ChartColumn, type ChartSeries, type RankItem,
} from "@/components/charts";
import type { EmployeeRow, FxMonthlyRow, PayrollRow, PeriodRow } from "../schema";

/**
 * ÖZET TABLOSUNDA ONDALIK YOKTUR (kullanıcı kararı, 12.08.2026; 13.08.2026'da
 * bütün ekranlara genişletildi).
 *
 * Tablo on iki sütunlu bir KARŞILAŞTIRMA ızgarasıdır; orada aranan şey "hangi
 * ay daha pahalıydı"dır, kuruş değil. Kuruş gereken yer bordrodur ve orada tam
 * basılır. Saat de aynı sebeple tam sayıdır — "216,50 saat izin" ile "217 saat
 * izin" aynı kararı verdirir.
 */
function tam(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("tr-TR");
}

/** İki ondalıklı avro — saatlik maliyet TEK İSTİSNADIR (bkz. sütun notu). */
function eur2(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// AT_SM: telefonda gizlenen sütunlar (AGENTS md. 15 — tablo yatay kaymaz).
// Telefonda kalan küme Dönem · Toplam ₺ · Toplam €'dur: özetin sorusu "o ay
// toplam ne ödedik"tir ve kırılım sütunları geniş ekranın işidir. Katlama
// SUTUNLAR yapısının KENDİ `cls` alanından yapılır — başlık, hücre ve toplam
// üçlüsünün hizası ancak böyle bozulmadan kalır (dosyanın tepesindeki kural).
const AT_SM = "hidden sm:table-cell";
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";
const AT_XL = "hidden xl:table-cell";

/** Kapsam ekseni — özet PERSONEL ve YÖNETİM olarak ayrılır (Excel'deki gibi). */
const SERI: ChartSeries[] = [
  { key: "personel", label: "Personel", hue: 210 },
  { key: "yonetim", label: "Yönetim", hue: 25 },
];

interface AySatiri {
  period: string;
  personel: ReturnType<typeof donemOzeti>;
  yonetim: ReturnType<typeof donemOzeti>;
  toplam: ReturnType<typeof donemOzeti>;
  /** Ayın izin/rapor saati — kişi satırlarından, yoksa devralınan ay değeri. */
  leaveHours: number;
  reportHours: number;
  devralinanSaat: boolean;
  /** Dönemin KENDİ kuru; girilmemişse null (sıfır DEĞİL). */
  rate: number | null;
}

/**
 * BİR KİŞİNİN SAATLİK MALİYETİ (€) — kullanıcı isteği (12.08.2026):
 * "fabrikanın 1 kişinin saatlik ücretini Euro olarak görmek isteriz."
 *
 * PAYDA NET ÇALIŞMA SAATİDİR (normal + fazla mesai − izin − rapor), "kişi ×
 * 225" değil: ödenen para izinli geçen saate de dağılır ve 225'e bölmek
 * maliyeti olduğundan DÜŞÜK gösterirdi. Ölçülen büyüklük ÖDENEN NETtir —
 * işverenin SGK payı dâhil gerçek yükü bordro parametrelerine bağlıdır ve
 * bütün geçmiş aylar için hesaplanamaz; kart bunu adında söyler.
 */
function saatlikEur(a: AySatiri, kapsamli: (x: AySatiri) => ReturnType<typeof donemOzeti>) {
  const o = kapsamli(a);
  const saat = netCalismaSaati(
    o.normalHours,
    o.overtimeHours,
    // KAPSAM SÜZGECİ AÇIKKEN izin/rapor da o kapsamdan gelir: 13.08.2026'dan
    // beri iki saat de KİŞİ satırındadır, yani kapsama bölünebilir. Devralınan
    // aylarda (ay düzeyi değer) bölünemez ve orada bütün kadronun saati
    // kullanılır — sayı yine karşılaştırılabilir kalır.
    a.devralinanSaat ? a.leaveHours : o.leaveHours,
    a.devralinanSaat ? a.reportHours : o.reportHours
  );
  return saatlikMaliyet(o.grandTotal, saat, a.rate, "net");
}

// ═══════════════════════════════════════════════════════════════ sütun tanımı

/**
 * TABLO SÜTUNLARI TEK BİR TANIMDAN ÜRETİLİR — başlık da, hücre de, toplam da.
 *
 * KULLANICI BİLDİRİMİ (13.08.2026): "Özet sayfasında tablolarda başlıklarda
 * kaymalar var, düzelt." Sebep yapısaldı: hizalama (`text-right`) ve kırılım
 * sınıfı (`hidden lg:table-cell`) başlıkta bir kez, hücrede bir kez daha elle
 * yazılıyordu. On üç sütun × üç satır türü (başlık/hücre/toplam) = otuz dokuz
 * yerde aynı iki sınıfı doğru yazmak gerekiyordu ve biri şaşınca sütun kayıyor,
 * dar ekranda ise başlık ile hücre farklı kırılımda düşüp tablo tamamen
 * kayıyordu.
 *
 * Artık sınıf SÜTUNUN KENDİNDE durur ve üç satır türü de onu okur: kayma
 * mümkün değil, çünkü yazılacak ikinci bir yer yok.
 */
interface Sutun {
  key: string;
  label: string;
  /** Kırılım sınıfı — başlık, hücre ve toplam hücresine BİRLİKTE uygulanır. */
  cls?: string;
  /** Sola hizalı tek sütun dönemdir; kalanların hepsi sayıdır. */
  sol?: boolean;
  hucre: (a: AySatiri, o: ReturnType<typeof donemOzeti>) => React.ReactNode;
  /** Toplam satırı — yoksa hücre boş kalır (ortalamaların toplamı yoktur). */
  alt?: (t: Toplamlar) => React.ReactNode;
}

interface Toplamlar {
  ay: number;
  kisi: number;
  netTotal: number;
  grandTotal: number;
  eur: number;
  kursuzAy: number;
  overtimeHours: number;
  overtimeTotal: number;
  leaveHours: number;
  reportHours: number;
  normalHours: number;
  netHours: number;
}

export function SummaryView({
  employees,
  payroll,
  periods,
  year,
  scope,
  canWrite,
}: {
  employees: EmployeeRow[];
  payroll: PayrollRow[];
  periods: PeriodRow[];
  /**
   * AYLIK ORTALAMA KURLAR — sayfa yükler ama ÖZET KULLANMAZ.
   *
   * Bilerek: buradaki avro karşılığı DÖNEMİN KENDİ kuruyla
   * (`hr_periods.eur_try_rate`) hesaplanır, ortalamayla değil. Ortalamaya
   * düşmek "kuru girilmemiş ay"ı sessizce doldurur ve ödenmiş bir ayın avro
   * karşılığı kur tablosu her tazelendiğinde değişirdi (AGENTS SATIS-16).
   * Eksik kur GİZLENMEZ, satırda "kur yok" diye görünür.
   */
  fx?: FxMonthlyRow[];
  /** `null` = tüm yıllar. Varsayılan İÇİNDE BULUNULAN YILDIR (bkz. page.tsx). */
  year: string | null;
  scope: "personel" | "yonetim" | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function suzgecYaz(anahtar: string, deger: string) {
    const q = new URLSearchParams(params?.toString() ?? "");
    if (deger) q.set(anahtar, deger);
    else q.delete(anahtar);
    router.replace(q.toString() ? `/personnel/ozet?${q}` : "/personnel/ozet", { scroll: false });
  }

  const kategoriHarita = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.category);
    return m;
  }, [employees]);

  const donemHarita = useMemo(() => {
    const m = new Map<string, PeriodRow>();
    for (const p of periods) m.set(p.period, p);
    return m;
  }, [periods]);

  /** Verideki yıllar — süzgeç listesi veriden çıkar, sabit yazılmaz. */
  const yillar = useMemo(
    () => [...new Set(payroll.map((p) => p.period.slice(0, 4)))].sort().reverse(),
    [payroll]
  );

  const aylar = useMemo<AySatiri[]>(() => {
    const gruplar = new Map<string, PayrollRow[]>();
    for (const p of payroll) {
      if (year && p.period.slice(0, 4) !== year) continue;
      const liste = gruplar.get(p.period) ?? [];
      liste.push(p);
      gruplar.set(p.period, liste);
    }
    const out: AySatiri[] = [];
    for (const [period, liste] of gruplar) {
      const ile = (f: (r: PayrollRow) => boolean): PayrollRowLike[] =>
        liste.filter(f).map((r) => ({ ...r, category: kategoriHarita.get(r.employeeId) ?? "" }));
      const yonetimSatirlari = ile((r) => yonetimMi(kategoriHarita.get(r.employeeId)));
      const personelSatirlari = ile((r) => !yonetimMi(kategoriHarita.get(r.employeeId)));
      const hepsi = ile(() => true);
      const d = donemHarita.get(period);
      // İZİN/RAPOR TEK KAYNAKTAN: kişi satırlarında varsa onlar, hiç yoksa
      // devralınan ay değeri. İkisi asla TOPLANMAZ.
      const saat = donemIzinRapor(hepsi, d);
      out.push({
        period,
        personel: donemOzeti(personelSatirlari),
        yonetim: donemOzeti(yonetimSatirlari),
        toplam: donemOzeti(hepsi),
        leaveHours: saat.leaveHours,
        reportHours: saat.reportHours,
        devralinanSaat: saat.devralinan,
        rate: d?.eurTryRate ?? null,
      });
    }
    out.sort((a, b) => (a.period < b.period ? 1 : -1));
    return out;
  }, [payroll, year, kategoriHarita, donemHarita]);

  /** Kapsam süzgeci UYGULANMIŞ satır — tablo ve kartlar bunu okur. */
  function kapsamli(a: AySatiri) {
    if (scope === "personel") return a.personel;
    if (scope === "yonetim") return a.yonetim;
    return a.toplam;
  }

  // ————————————————————————————————————————————————————————————— grafikler

  /** Çizgi grafikler AYLARI ESKİDEN YENİYE okur; tablo tersine sıralıdır. */
  const artan = useMemo(() => [...aylar].reverse(), [aylar]);

  const sutunlar = useMemo<ChartColumn[]>(
    () =>
      artan.map((a) => ({
        key: a.period,
        label: kisaAy(a.period),
        total: a.toplam.grandTotal,
        parts: { personel: a.personel.grandTotal, yonetim: a.yonetim.grandTotal },
      })),
    [artan]
  );

  const mesaiSutunlari = useMemo<ChartColumn[]>(
    () =>
      artan.map((a) => ({
        key: a.period,
        label: kisaAy(a.period),
        total: a.toplam.overtimeHours,
        parts: { personel: a.personel.overtimeHours, yonetim: a.yonetim.overtimeHours },
      })),
    [artan]
  );

  const kisiSutunlari = useMemo<ChartColumn[]>(
    () =>
      artan.map((a) => ({
        key: a.period,
        label: kisaAy(a.period),
        total: a.toplam.count,
        parts: { personel: a.personel.count, yonetim: a.yonetim.count },
      })),
    [artan]
  );

  /** Görev dağılımı — bugün AKTİF çalışanlar üzerinden. */
  const gorevDagilimi = useMemo<RankItem[]>(() => {
    const say = new Map<string, number>();
    for (const e of employees) {
      if (!e.active) continue;
      const ad = e.title || "—";
      say.set(ad, (say.get(ad) ?? 0) + 1);
    }
    const toplam = [...say.values()].reduce((a, b) => a + b, 0) || 1;
    return [...say.entries()]
      .map(([label, value]) => ({
        key: label,
        label,
        hue: hueFromText(label),
        value,
        share: value / toplam,
      }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  const kategoriDagilimi = useMemo<RankItem[]>(() => {
    const say = new Map<string, number>();
    for (const e of employees) {
      if (!e.active) continue;
      say.set(e.category, (say.get(e.category) ?? 0) + 1);
    }
    const toplam = [...say.values()].reduce((a, b) => a + b, 0) || 1;
    return [...say.entries()]
      .map(([k, value]) => ({
        key: k,
        label: categoryLabel(k),
        hue: categoryHue(k),
        value,
        share: value / toplam,
      }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  // ————————————————————————————————————————————————————————————— toplamlar

  /**
   * SEÇİLİ DÖNEMİN TOPLAMI — kart ve tablo dibi AYNI hesabı okur.
   *
   * Kullanıcı isteği (13.08.2026): "Yılı seçtiğimde o yıl ödediğim toplam
   * maaşı görebileyim; euro karşılığını da göreyim." Sayı iki yerde
   * görünüyor ama BİR KEZ hesaplanıyor — iki yerde ayrı hesaplansaydı
   * kırpma/yuvarlama farkı yüzünden kartla tablonun dibi ayrışabilirdi.
   *
   * AVRO AY AY ÇEVRİLİR ve toplanır, toplam TL bugünkü kurla bölünmez: her ay
   * kendi kuruyla ödendi ve yıllık bir "ortalama kur" o ayların hiçbirinde
   * geçerli değildi. Kuru olmayan ay avro toplamına GİRMEZ ve ayrıca sayılır.
   */
  const toplamlar = useMemo<Toplamlar>(() => {
    let kisi = 0;
    let netTotal = 0;
    let grandTotal = 0;
    let eur = 0;
    let kursuzAy = 0;
    let overtimeHours = 0;
    let overtimeTotal = 0;
    let leaveHours = 0;
    let reportHours = 0;
    let normalHours = 0;
    for (const a of aylar) {
      const o = kapsamli(a);
      kisi += o.count;
      netTotal += o.netTotal;
      grandTotal += o.grandTotal;
      overtimeHours += o.overtimeHours;
      overtimeTotal += o.overtimeTotal;
      normalHours += o.normalHours;
      leaveHours += a.leaveHours;
      reportHours += a.reportHours;
      if (a.rate && a.rate > 0) eur += o.grandTotal / a.rate;
      else if (o.grandTotal > 0) kursuzAy += 1;
    }
    return {
      ay: aylar.length,
      kisi,
      netTotal,
      grandTotal,
      eur,
      kursuzAy,
      overtimeHours,
      overtimeTotal,
      leaveHours,
      reportHours,
      normalHours,
      netHours: netCalismaSaati(normalHours, overtimeHours, leaveHours, reportHours),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aylar, scope]);

  const sonAy = aylar[0];
  const oncekiAy = aylar[1];
  const sonAySaatlik = sonAy ? saatlikEur(sonAy, kapsamli) : null;
  const oncekiSaatlik = oncekiAy ? saatlikEur(oncekiAy, kapsamli) : null;
  const aktifSayisi = employees.filter((e) => e.active).length;
  const donemAdi = year ?? "Tüm Yıllar";
  const eksikKur = aylar.filter((a) => !a.rate && kapsamli(a).grandTotal > 0).length;

  // ═════════════════════════════════════════════════════════ sütunlar
  const SUTUNLAR: Sutun[] = [
    {
      key: "donem",
      label: "Dönem",
      sol: true,
      hucre: (a, o) => (
        <>
          <Link href={`/personnel/maas?ay=${a.period}`} className="hover:underline">
            {periodLabel(a.period)}
          </Link>
          {!a.rate && o.grandTotal > 0 && (
            <span
              className="ml-1.5 text-[11px] text-amber-600 dark:text-amber-400"
              title="Bu ayın avro kuru girilmemiş; avro sütunu boş kalır"
            >
              kur yok
            </span>
          )}
        </>
      ),
      alt: (t) => `${t.ay} ay`,
    },
    {
      key: "kisi",
      label: "Kişi",
      cls: AT_SM,
      hucre: (_a, o) => o.count,
      // KİŞİ SAYISI TOPLANMAZ, ORTALANIR: on iki ayın kişi sayısını toplamak
      // "252 kişi" gibi anlamsız bir sayı üretirdi — aynı kişi her ay yeniden
      // sayılır. Aranan şey "kadro ortalama kaç kişiydi"dir.
      alt: (t) => (t.ay > 0 ? `ort. ${Math.round(t.kisi / t.ay)}` : "—"),
    },
    {
      key: "net",
      label: "Ödenen Net (₺)",
      cls: AT_SM,
      hucre: (_a, o) => fmtTutar(o.netTotal),
      alt: (t) => fmtTutar(t.netTotal),
    },
    {
      key: "fmSaat",
      label: "FM Saati",
      cls: AT_SM,
      hucre: (_a, o) => tam(o.overtimeHours),
      alt: (t) => tam(t.overtimeHours),
    },
    {
      key: "fmTutar",
      label: "FM Ödemesi (₺)",
      cls: AT_MD,
      hucre: (_a, o) => fmtTutar(o.overtimeTotal),
      alt: (t) => fmtTutar(t.overtimeTotal),
    },
    {
      key: "toplamTl",
      label: "Toplam Ödeme (₺)",
      hucre: (_a, o) => <span className="font-medium">{fmtTutar(o.grandTotal)}</span>,
      alt: (t) => <span className="font-semibold">{fmtTutar(t.grandTotal)}</span>,
    },
    {
      key: "toplamEur",
      label: "Toplam Ödeme (€)",
      hucre: (a, o) => (a.rate ? fmtTutar(o.grandTotal / a.rate) : "—"),
      alt: (t) => <span className="font-semibold">{fmtTutar(t.eur)}</span>,
    },
    {
      key: "ortalama",
      label: "Kişi Başı Ort. (₺)",
      cls: AT_LG,
      hucre: (_a, o) => fmtTutar(o.netAverage),
      // Ortalamaların toplamı yoktur; dip hücre BÜTÜN DÖNEMİN ortalamasıdır.
      alt: (t) => (t.kisi > 0 ? fmtTutar(t.netTotal / t.kisi) : "—"),
    },
    {
      key: "izin",
      label: "İzin (sa)",
      cls: AT_XL,
      hucre: (a) => (
        <span className={cn(a.devralinanSaat && "text-muted-foreground")}>
          {a.leaveHours ? tam(a.leaveHours) : "—"}
        </span>
      ),
      alt: (t) => (t.leaveHours ? tam(t.leaveHours) : "—"),
    },
    {
      key: "rapor",
      label: "Rapor (sa)",
      cls: AT_XL,
      hucre: (a) => (
        <span className={cn(a.devralinanSaat && "text-muted-foreground")}>
          {a.reportHours ? tam(a.reportHours) : "—"}
        </span>
      ),
      alt: (t) => (t.reportHours ? tam(t.reportHours) : "—"),
    },
    {
      key: "netSaat",
      label: "Net Çalışma Saati",
      cls: AT_LG,
      hucre: (a) =>
        tam(
          netCalismaSaati(
            a.toplam.normalHours,
            a.toplam.overtimeHours,
            a.leaveHours,
            a.reportHours
          )
        ),
      alt: (t) => tam(t.netHours),
    },
    {
      key: "saatlik",
      // TEK ONDALIKLI SÜTUN: saatlik maliyet 12–15 € bandındadır ve orada
      // kuruş GERÇEK bir farktır — "14 €" ile "14,80 €" arasında teklif
      // fiyatında %6 var. "Ondalık yok" kuralı büyük tutarlar içindir.
      label: "Saatlik Maliyet (€)",
      cls: AT_MD,
      hucre: (a) => eur2(saatlikEur(a, kapsamli)?.eur),
      alt: () => null,
    },
  ];

  return (
    <div className="grid gap-3">
      {/* ÖZET KARTLARI */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* KART İÇİ NOTLARDA HER SÖZCÜĞÜN BAŞ HARFİ BÜYÜKTÜR (kullanıcı
            kararı, 13.08.2026). Metinler ELLE öyle yazılır, bir dönüştürücüden
            geçirilmez: notların içinde sayı, simge ve kısaltma var. */}
        <StatCard
          label="Aktif Çalışan"
          value={String(aktifSayisi)}
          hint="Bugün Açık Çalışma Dönemi Olan"
          icon={Users}
        />
        {/* SEÇİLİ YILIN TOPLAMI — kullanıcı isteği (13.08.2026). Avro
            karşılığı ipucunda değil ana satırın hemen altında durur; iki sayı
            da aynı sorunun cevabıdır. */}
        <StatCard
          label={`${donemAdi} Toplam Ödeme`}
          value={`${fmtTutar(toplamlar.grandTotal)} ₺`}
          hint={
            toplamlar.kursuzAy > 0
              ? `${fmtTutar(toplamlar.eur)} € · ${toplamlar.kursuzAy} Ayın Kuru Yok`
              : `${fmtTutar(toplamlar.eur)} € · ${toplamlar.ay} Ay`
          }
          icon={CalendarRange}
          tone={toplamlar.kursuzAy > 0 ? "warn" : undefined}
        />
        <StatCard
          label={sonAy ? `${periodLabel(sonAy.period)} Ödeme` : "Son Ay"}
          value={sonAy ? `${fmtTutar(kapsamli(sonAy).grandTotal)} ₺` : "—"}
          hint={
            sonAy?.rate
              ? `${fmtTutar(kapsamli(sonAy).grandTotal / sonAy.rate)} € · Kur ${fmtNum(sonAy.rate, true)}`
              : "Dönem Kuru Girilmemiş"
          }
          icon={Banknote}
          delta={
            sonAy && oncekiAy && kapsamli(oncekiAy).grandTotal > 0
              ? kapsamli(sonAy).grandTotal / kapsamli(oncekiAy).grandTotal - 1
              : null
          }
        />
        <StatCard
          label={`${donemAdi} Fazla Mesai`}
          value={`${tam(toplamlar.overtimeHours)} saat`}
          hint={`${fmtTutar(toplamlar.overtimeTotal)} ₺`}
          icon={Timer}
        />
        {/* SAATLİK MALİYET — bu bölümün en çok bakılan tek sayısı olacak:
            teklif fiyatlandırmasında adam·saat maliyeti buradan okunur. */}
        <StatCard
          label="Saatlik Maliyet (€)"
          value={sonAySaatlik?.eur != null ? `${eur2(sonAySaatlik.eur)} €` : "—"}
          hint={
            sonAySaatlik
              ? `${sonAy ? periodLabel(sonAy.period) : ""} · ${tam(sonAySaatlik.try)} ₺/sa · ${tam(sonAySaatlik.hours)} Net Saat`
              : "Dönem Kuru Girilmemiş"
          }
          icon={Euro}
          tone={sonAySaatlik?.eur == null ? "warn" : undefined}
          delta={
            sonAySaatlik?.eur != null && oncekiSaatlik?.eur != null && oncekiSaatlik.eur > 0
              ? sonAySaatlik.eur / oncekiSaatlik.eur - 1
              : null
          }
        />
      </div>

      {/* SÜZGEÇLER */}
      <div className="oc-scrollx flex flex-wrap items-center gap-2 overflow-x-auto border bg-card p-2 [--oc-scroll-bg:var(--card)]">
        <span className="oc-kicker shrink-0 text-muted-foreground">Yıl</span>
        {/* "TÜMÜ" ARTIK AÇIK BİR SEÇİMDİR, VARSAYILAN DEĞİL (13.08.2026):
            varsayılan içinde bulunulan yıldır ve adreste `yil=tumu` yazmak
            bütün yılları geri getirir. Boş bırakmak varsayılanı seçemezdi —
            "süzgeç yok" ile "bu yıl" aynı adres olurdu. */}
        <Button
          size="sm"
          variant={year ? "outline" : "secondary"}
          className="oc-tap"
          onClick={() => suzgecYaz("yil", "tumu")}
        >
          Tümü
        </Button>
        {yillar.map((y) => (
          <Button
            key={y}
            size="sm"
            variant={year === y ? "secondary" : "outline"}
            className="oc-tap"
            onClick={() => suzgecYaz("yil", year === y ? "tumu" : y)}
          >
            {y}
          </Button>
        ))}

        <span className="oc-kicker ml-2 shrink-0 text-muted-foreground">Kapsam</span>
        {(
          [
            ["", "Tümü"],
            ["personel", "Personel"],
            ["yonetim", "Yönetim"],
          ] as const
        ).map(([deger, etiket]) => (
          <Button
            key={etiket}
            size="sm"
            variant={(scope ?? "") === deger ? "secondary" : "outline"}
            className="oc-tap"
            onClick={() => suzgecYaz("kapsam", deger)}
          >
            {etiket}
          </Button>
        ))}
      </div>

      {/* GRAFİKLER — ÇİZGİ (kullanıcı kararı, 13.08.2026). */}
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="border bg-card p-3">
          <div className="oc-kicker mb-2 text-muted-foreground">Aylık Toplam Ödeme (₺)</div>
          <ChartLegend series={SERI} className="mb-2" />
          <TimeLineChart columns={sutunlar} series={SERI} valueLabel="₺" height={190} format={tam} />
        </div>
        <div className="border bg-card p-3">
          <div className="oc-kicker mb-2 text-muted-foreground">Aylık Fazla Mesai (saat)</div>
          <TimeLineChart
            columns={mesaiSutunlari}
            series={SERI}
            valueLabel="saat"
            height={190}
            format={tam}
          />
        </div>
        <div className="border bg-card p-3">
          <div className="oc-kicker mb-2 text-muted-foreground">Kişi Sayısı Seyri</div>
          <TimeLineChart
            columns={kisiSutunlari}
            series={SERI}
            valueLabel="kişi"
            height={190}
            format={tam}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:gap-3">
          <div className="border bg-card p-3">
            <div className="oc-kicker mb-2 text-muted-foreground">Kategori Dağılımı (aktif)</div>
            <RankBars items={kategoriDagilimi} valueLabel="kişi" emptyText="Aktif çalışan yok" />
          </div>
          <div className="border bg-card p-3">
            <div className="oc-kicker mb-2 text-muted-foreground">Görev Dağılımı (aktif)</div>
            <RankBars items={gorevDagilimi} limit={8} valueLabel="kişi" emptyText="Aktif çalışan yok" />
          </div>
        </div>
      </div>

      {/* AY AY TABLO — başlık, hücre ve toplam AYNI `SUTUNLAR` tanımından. */}
      <div className="oc-scrollx overflow-x-auto border bg-card [--oc-scroll-bg:var(--card)]">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              {SUTUNLAR.map((s) => (
                <TableHead
                  key={s.key}
                  // Telefonda başlık SARABİLİR: "Toplam Ödeme (₺)" gibi nowrap
                  // başlıklar 375px'te tabloyu birkaç piksel taşırıyordu.
                  className={cn(
                    s.cls,
                    !s.sol && "text-right",
                    "text-[11px] max-sm:whitespace-normal"
                  )}
                >
                  {s.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {aylar.map((a) => {
              const o = kapsamli(a);
              return (
                <TableRow key={a.period} className="hover:bg-muted/40">
                  {SUTUNLAR.map((s) => (
                    <TableCell
                      key={s.key}
                      className={cn(
                        s.cls,
                        s.sol
                          ? "font-medium"
                          : "text-right font-mono tabular-nums"
                      )}
                    >
                      {s.hucre(a, o)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>

          {/* TOPLAM SATIRI — kullanıcı isteği (13.08.2026): "En alttaki
              tablonun altında toplamlar olsun; dinamik, yıl seçildiğinde de
              değişsin." Toplam TABLODAKİ AYNI SATIRLARDAN çıkar, ikinci bir
              hesap yolu yoktur — yıl süzgeci değişince kendiliğinden değişir. */}
          {aylar.length > 0 && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                {SUTUNLAR.map((s) => (
                  <TableCell
                    key={s.key}
                    className={cn(
                      s.cls,
                      s.sol ? "font-medium" : "text-right font-mono tabular-nums"
                    )}
                  >
                    {s.alt ? s.alt(toplamlar) : null}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* KAPSAM NOTU — eksikliği gizlemek yerine söylemek. */}
      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>
          Toplam satırı <strong>{donemAdi}</strong> için{" "}
          <strong>{toplamlar.ay} ayın</strong> toplamıdır ve süzgeçle birlikte değişir. Kişi
          sayısı toplanmaz, <strong>ortalanır</strong> — aynı kişi her ay yeniden sayılırdı. Avro
          karşılığı ay ay, her ayın <strong>kendi kuruyla</strong> çevrilip toplanır; yıllık tek
          bir kur o ayların hiçbirinde geçerli değildi.
        </p>
        <p>
          Çalışma saati kişi başına {AYLIK_CALISMA_SAATI} saat/ay kabulüyle hesaplanır
          (30 gün × 7,5 saat). Net çalışma saati = normal + fazla mesai − izin − rapor. İzin ve
          rapor saatleri artık <strong>kişi bazında</strong> girilir (Maaş ekranı); gri görünen
          hücreler kişi girişi olmayan ve <strong>devralınan ay toplamından</strong> okunan
          aylardır.
        </p>
        <p>
          Devralınan kayıt <strong>Mayıs 2024</strong>&apos;te başlar. Şubat–Nisan 2024
          Excel&apos;in özet sayfasında bir toplam olarak vardı ama kişi kırılımı kaynakta
          yoktu; uydurulmuş bir dağıtım yazmak yerine aktarılmadı.
        </p>
        {eksikKur > 0 && (
          <p className="text-amber-600 dark:text-amber-400">
            {eksikKur} ayın avro kuru girilmemiş — o ayların avro sütunu boştur ve avro toplamına
            girmezler.{" "}
            {canWrite && (
              <Link href="/personnel/kurlar" className="underline">
                Kurlar ekranından depoyu tazeleyebilirsiniz.
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * `2026-08` → "Ağu 26". Çizgi grafikte X etiketi ~40px'lik bir sütuna sığmalı;
 * "Ağustos 2026" (≈78px) komşusuyla çakışıyordu.
 */
const KISA_AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function kisaAy(period: string): string {
  const [y, m] = period.split("-");
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${KISA_AY[i]} ${y.slice(2)}` : period;
}
