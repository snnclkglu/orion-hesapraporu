"use client";

// Personel profili — kişinin BÜTÜN künyesi, çalışma dönemleri ve maaş geçmişi.
//
// KÜNYE İLE DÖNEM AYRI ŞEYLERDİR (şemadaki ayrımın ekrandaki karşılığı): kişi
// işten çıkarken künyesi değişmez, DÖNEMİ kapanır. Bu yüzden "Sil" ile "Dönemi
// Kapat" bu ekranda birbirinden uzakta durur ve dönem kartı ne yapılması
// gerektiğini kendi başlığında yazar — silmek, ödenmiş bir ayın kaydını da
// götürürdü.
//
// Maaş satırlarının AVRO karşılığı DÖNEMİN kurundan çıkar (`hr_periods`),
// merkezî bir kur tablosundan değil: tablo tazelendiğinde geçmiş ayların
// karşılığı da değişirdi. Kuru girilmemiş ay SIFIR göstermez, "kur girilmemiş"
// der — sıfır bir cevaptır, burada cevap yoktur.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { deleteEmployee, deleteEmployment, saveEmployee, saveEmployment } from "../actions";
import type {
  DocumentRow,
  EmployeeInput,
  EmployeeRow,
  EmploymentRow,
  PayrollRow,
  PeriodRow,
} from "../schema";
import { DocumentsPanel } from "./documents-panel";
import {
  BLOOD_TYPES,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DEPARTMENTS,
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  EXIT_REASONS,
  EXIT_REASON_LABELS,
  GENDER_LABELS,
  GENDERS,
  JOB_TITLES,
  MARITAL_LABELS,
  MARITAL_STATUSES,
  PERSONNEL_CATEGORIES,
  WORK_MODE_LABELS,
  WORK_MODES,
  categoryHue,
  categoryLabel,
  ibanBiciminde,
  tcKimlikGecerliMi,
  type ContractType,
  type EducationLevel,
  type Gender,
  type MaritalStatus,
  type WorkMode,
} from "@/lib/personnel/employee";
import {
  aylikOdeme,
  hizmetGunu,
  hizmetSuresiMetni,
  periodLabel,
  yas,
} from "@/lib/personnel/payroll";
import { CURRENCY_SYMBOLS, fmtNum, parseNum } from "@/lib/currency";
import { adBuyuk } from "@/lib/tr-text";
import { tagStyle } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EditableCombobox } from "@/components/editable-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import { BolumRayi, type BolumOgesi } from "@/components/bolum-rayi";
import { capaKimligi, capayaGit, useAktifCapa } from "@/lib/bolum-capa";

/** Sütun önceliği (AGENTS MOBIL-7): kart markup'ı ÇOĞALTILMAZ, sütun düşer. */
const AT_SM = "hidden sm:table-cell";
const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

/**
 * "Belirtilmedi" ara değeri.
 *
 * Zod `secim()` boş dizgiyi `null`a çevirir ama Radix `Select` value=""
 * KABUL ETMEZ — boş değer yer tutucuyu göstermek için ayrılmıştır. Seçimi
 * geri boşaltabilmek için listede kendi satırı olmalı.
 */
const YOK = "__yok__";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/**
 * KAPALI listelerin (`z.enum` / `secim`) devralınmış bir değeri reddetmesini
 * pencerede önceden karşılar: alan boşa düşer, kullanıcı Kaydet'te anlaşılmaz
 * bir "Geçersiz seçim" hatası almaz. AÇIK listeler (kategori, görev,
 * departman) bunun DIŞINDADIR — orada kayıttaki değer kendi seçeneği olarak
 * korunur (`personnel.ts` başlığındaki kural).
 */
function listedeMi(list: readonly string[], value: string | null | undefined): string {
  const s = (value ?? "").trim();
  return s && list.includes(s) ? s : "";
}

/** Künye satırı — boş alan "—" gösterir, uydurma bir varsayılan değil. */
function Alan({
  label,
  children,
  className,
}: {
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const bos = children === null || children === undefined || children === "";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="oc-kicker text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm break-words">
        {bos ? <span className="text-muted-foreground/60">—</span> : children}
      </dd>
    </div>
  );
}

/** Pencere alanı (satış penceresiyle aynı düzen). */
function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * BÖLÜM RAYININ SATIRLARI — TEK DÜZEY, dört bölüm.
 *
 * Sayısı sekizin altında olduğu için MOBIL-21 telefonda kutu ızgarası
 * ister; buradaki sorun SAYI DEĞİL MESAFEDİR — maaş geçmişi tablosu tek
 * başına yüzlerce satır olabiliyor ve özlük dosyalarına inmek ekranlarca
 * kaydırma demek. Ray bu yüzden her genişlikte durur.
 */
const PROFIL_BOLUMLERI: BolumOgesi[] = [
  { id: "kimlik", baslik: "Kimlik Kartı" },
  { id: "donem", baslik: "Çalışma Dönemleri" },
  { id: "maas", baslik: "Maaş Geçmişi" },
  { id: "ozluk", baslik: "Özlük Dosyaları" },
];

/** Kancanın bağımlılığı — dizi her boyamada yeniden üretilmesin. */
const PROFIL_KIMLIKLERI = PROFIL_BOLUMLERI.map((b) => b.id);

/** Pencere içindeki mantıklı öbek — Kimlik · İletişim · İstihdam · Banka · Not. */
function Bolum({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h4 className="oc-kicker border-b pb-1.5 text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════ profil

export function EmployeeProfile({
  employee,
  payroll,
  documents,
  periods,
  bugun,
  canWrite,
}: {
  employee: EmployeeRow;
  payroll: PayrollRow[];
  documents: DocumentRow[];
  periods: PeriodRow[];
  bugun: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duzenle, setDuzenle] = useState(false);
  /** Düzenlenen çalışma dönemi; `null` = pencere kapalı. */
  const [donem, setDonem] = useState<EmploymentRow | "yeni" | null>(null);

  const yasi = yas(employee.birthDate, bugun);
  const tcSupheli = Boolean(employee.nationalId) && !tcKimlikGecerliMi(employee.nationalId);
  const acikDonem = employee.employment.some((e) => !e.endDate);

  // Kur DÖNEMİN kendi kaydından okunur; harita tek kez kurulur.
  const kurlar = useMemo(
    () => new Map(periods.map((p) => [p.period, p.eurTryRate])),
    [periods]
  );

  function sil() {
    if (
      !window.confirm(
        `${employee.fullName} için kalıcı silme talebi Yönetici onayına gönderilecek. İşten ayrıldıysa silmek yerine çalışma dönemini kapatın. Devam edilsin mi?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteEmployee(employee.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Silme talebi Yönetici onayına gönderildi.");
    });
  }

  function donemSil(row: EmploymentRow) {
    if (!window.confirm("Bu çalışma dönemi silinecek. Devam edilsin mi?")) return;
    startTransition(async () => {
      const res = await deleteEmployment(row.id, employee.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Çalışma dönemi silindi.");
      router.refresh();
    });
  }

  /** Okunan bölüm — ray hangi çentiği yakacağını buradan öğrenir. */
  const [aktifBolum, bolumIsaretle] = useAktifCapa(PROFIL_KIMLIKLERI);

  return (
    // RAY + İÇERİK. Profil 1251 satırlık TEK BİR KAYDIRMADIR ve bugüne
    // kadar hiçbir bölüm gezinmesi yoktu: dört bölümün arası ekranlarca
    // uzakta. Ray burada ÇIPA kipindedir (lib/bolum-capa.ts) — bölümlerin
    // hepsi aynı anda DOM'dadır, seçim bir durum değil bir kaydırmadır.
    //
    // `items-start` YAZILMAZ (MOBIL-31). Yazılmıştı ve rayın yapışmasını
    // SESSİZCE öldürüyordu: hizalama `start` olunca ray sütunu yapışkan
    // kutusunun boyunda (752px) kalıyor, yani yapışacak yol sıfır oluyordu.
    // 1280px'te ölçüldü: kaydırınca şeridin üstü 956 → −544'e gidiyordu.
    // Varsayılan `stretch` ile sarmalayıcı 1655px olur ve ray 48'e yapışır.
    <div className="flex min-w-0 gap-2 lg:gap-4">
      <BolumRayi
        etiket="Profil bölümleri"
        depoAnahtari="orion.personel.ray.daraltildi"
        ogeler={PROFIL_BOLUMLERI}
        aktifId={aktifBolum}
        onSec={(id) => {
          // Önce ELLE işaretle, sonra kaydır: kaydırma gözcüsü sekme arka
          // plandayken ateşlemiyor ve ray seçilen bölümü yakmayabiliyordu.
          bolumIsaretle(id);
          capayaGit(id);
        }}
      />
      <div className="grid min-w-0 flex-1 gap-4">
      {/* ══════════════════════════════════════════════════ 1) kimlik kartı */}
      <section id={capaKimligi("kimlik")} className="oc-capa border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={tagStyle(categoryHue(employee.category))}
                className="oc-tag px-1.5 py-0.5 text-xs font-medium"
                title={employee.category}
              >
                <span className="truncate">{categoryLabel(employee.category)}</span>
              </span>
              <span
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[11px]",
                  employee.active
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {employee.active ? "ÇALIŞIYOR" : "AYRILDI"}
              </span>
            </div>
            {/* Sayfanın büyük başlığı `h2`dir; `h1` üst şerittedir. */}
            <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight">
              {employee.fullName}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[employee.title, employee.department].filter(Boolean).join(" · ") ||
                "Görev ve departman girilmemiş"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDuzenle(true)}
              disabled={!canWrite}
            >
              <Pencil className="size-3.5" /> Düzenle
            </Button>
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={sil}
                disabled={pending}
              >
                <Trash2 className="size-3.5" /> Sil
              </Button>
            )}
          </div>
        </div>

        <dl className="grid gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          <Alan label="Sicil No">
            {employee.employeeNo && (
              <span className="font-mono tabular-nums">{employee.employeeNo}</span>
            )}
          </Alan>
          <Alan label="TC Kimlik No">
            {employee.nationalId && (
              <>
                <span className="font-mono tabular-nums">{employee.nationalId}</span>
                {/* UYARI, ENGEL DEĞİL: yabancı uyruklu personelin numarası
                    NVİ algoritmasını geçmez ve o kişi de kaydedilebilmelidir. */}
                {tcSupheli && (
                  <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-400">
                    Numara doğrulama algoritmasını geçmiyor — yabancı uyruklu
                    personelde olağandır.
                  </span>
                )}
              </>
            )}
          </Alan>
          <Alan label="Kıdem">
            {employee.serviceDays > 0 ? (
              <>
                {hizmetSuresiMetni(employee.serviceDays)}{" "}
                <span className="text-muted-foreground">
                  ({fmtNum(employee.serviceDays)} gün)
                </span>
              </>
            ) : null}
          </Alan>

          <Alan label="Doğum Tarihi">
            {employee.birthDate && (
              <>
                {fmtDate(employee.birthDate)}
                {yasi !== null && (
                  <span className="text-muted-foreground"> · {yasi} yaşında</span>
                )}
              </>
            )}
          </Alan>
          <Alan label="Doğum Yeri">{employee.birthPlace}</Alan>
          <Alan label="Cinsiyet">
            {employee.gender ? GENDER_LABELS[employee.gender as Gender] ?? employee.gender : null}
          </Alan>

          <Alan label="Medeni Hâl">
            {employee.maritalStatus
              ? MARITAL_LABELS[employee.maritalStatus as MaritalStatus] ?? employee.maritalStatus
              : null}
          </Alan>
          <Alan label="Çocuk Sayısı">
            <span className="font-mono tabular-nums">{employee.childCount}</span>
          </Alan>
          <Alan label="Kan Grubu">{employee.bloodType}</Alan>

          <Alan label="Öğrenim">
            {employee.education
              ? EDUCATION_LABELS[employee.education as EducationLevel] ?? employee.education
              : null}
          </Alan>
          <Alan label="Askerlik">{employee.militaryStatus}</Alan>
          <Alan label="Engel Derecesi">
            {employee.disabilityDegree ? `${employee.disabilityDegree}. derece` : null}
          </Alan>

          <Alan label="Telefon">{employee.phone}</Alan>
          <Alan label="E-posta">{employee.email}</Alan>
          <Alan label="İl">{employee.city}</Alan>

          <Alan label="Adres" className="sm:col-span-2 lg:col-span-3">
            {employee.address}
          </Alan>

          <Alan label="Acil Durumda Aranacak">{employee.emergencyContact}</Alan>
          <Alan label="Acil Durum Telefonu">{employee.emergencyPhone}</Alan>
          <Alan label="SGK No">
            {employee.sgkNo && (
              <span className="font-mono tabular-nums">{employee.sgkNo}</span>
            )}
          </Alan>

          <Alan label="Sözleşme Türü">
            {CONTRACT_TYPE_LABELS[employee.contractType as ContractType] ?? employee.contractType}
          </Alan>
          <Alan label="Çalışma Şekli">
            {WORK_MODE_LABELS[employee.workMode as WorkMode] ?? employee.workMode}
          </Alan>
          <Alan label="Yıllık İzin Hakkı">
            <span className="font-mono tabular-nums">{employee.annualLeaveDays}</span> gün
          </Alan>

          <Alan label="Banka">{employee.bankName}</Alan>
          <Alan label="IBAN" className="sm:col-span-2">
            {employee.iban && (
              <span className="font-mono tabular-nums">{ibanBiciminde(employee.iban)}</span>
            )}
          </Alan>

          <Alan label="Not" className="sm:col-span-2 lg:col-span-3">
            {employee.notes && <span className="whitespace-pre-wrap">{employee.notes}</span>}
          </Alan>
        </dl>
      </section>

      {/* ═════════════════════════════════════════════ 3) çalışma dönemleri */}
      <section id={capaKimligi("donem")} className="oc-capa border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <h3 className="text-sm font-medium">Çalışma Dönemleri</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDonem("yeni")}
            disabled={!canWrite}
          >
            <Plus className="size-3.5" /> Dönem Ekle
          </Button>
        </header>

        {/* Kural ekranda da YAZILIDIR: kullanıcı "ayrıldı" ile "silindi"yi
            karıştırdığında kaybedilen şey maaş geçmişidir. */}
        <p className="border-b bg-muted/30 px-4 py-2 text-[12px] text-foreground/70">
          İşten ayrılan personel <strong>silinmez</strong>, dönemi{" "}
          <strong>kapatılır</strong>: çıkış tarihi girildiğinde kişi listede
          &quot;Ayrıldı&quot; görünür, maaş geçmişi ve özlük dosyası yerinde kalır.
          Aynı anda yalnız bir açık dönem olabilir; kişi geri döndüğünde ikinci bir
          dönem açılır ve kıdem ikisinin toplamıdır.
        </p>

        <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[7.5rem]">Giriş</TableHead>
              <TableHead className="w-[7.5rem]">Çıkış</TableHead>
              <TableHead className={cn("w-[10rem]", AT_MD)}>Ayrılma Nedeni</TableHead>
              <TableHead className="w-[8rem] text-right">Süre</TableHead>
              <TableHead className={AT_LG}>Not</TableHead>
              <TableHead className="w-[6.5rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {employee.employment.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} data-mobile-span="full" data-mobile-hide-label className="py-8 text-center text-sm text-muted-foreground">
                  Çalışma dönemi girilmemiş — işe giriş tarihini eklemek için
                  &quot;Dönem Ekle&quot;yi kullanın.
                </TableCell>
              </TableRow>
            ) : (
              employee.employment.map((d) => (
                <TableRow key={d.id}>
                  <TableCell data-label="Giriş" className="align-top font-mono text-sm tabular-nums md:align-middle">
                    {fmtDate(d.startDate)}
                    {/* `md` altında düşen ayrılma nedeni birincil hücreye iner. */}
                    {d.exitReason && (
                      <span className="mt-0.5 block font-sans text-[11px] text-muted-foreground md:hidden">
                        {EXIT_REASON_LABELS[d.exitReason as keyof typeof EXIT_REASON_LABELS] ??
                          d.exitReason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell data-label="Çıkış" className="align-top font-mono text-sm tabular-nums md:align-middle">
                    {d.endDate ? (
                      fmtDate(d.endDate)
                    ) : (
                      <span className="font-sans text-primary">Açık</span>
                    )}
                  </TableCell>
                  <TableCell data-label="Ayrılma Nedeni" className={cn("text-sm text-muted-foreground", AT_MD)}>
                    {d.exitReason
                      ? EXIT_REASON_LABELS[d.exitReason as keyof typeof EXIT_REASON_LABELS] ??
                        d.exitReason
                      : "—"}
                  </TableCell>
                  <TableCell data-label="Süre" className="text-right align-top text-sm md:align-middle">
                    {hizmetSuresiMetni(hizmetGunu(d.startDate, d.endDate, bugun))}
                  </TableCell>
                  <TableCell
                    data-label="Not"
                    className={cn("text-sm whitespace-normal text-muted-foreground", AT_LG)}
                  >
                    {d.note || "—"}
                  </TableCell>
                  <TableCell data-label="İşlemler" data-mobile-span="full">
                    {canWrite && (
                      <div data-mobile-actions className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Dönemi düzenle"
                          onClick={() => setDonem(d)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label="Dönemi sil"
                          onClick={() => donemSil(d)}
                          disabled={pending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      {/* ═══════════════════════════════════════════════ 4) maaş geçmişi */}
      <section id={capaKimligi("maas")} className="oc-capa border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <h3 className="text-sm font-medium">Maaş Geçmişi</h3>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {fmtNum(payroll.length)} ay
          </span>
        </header>

        <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[9rem]">Dönem</TableHead>
              <TableHead className="w-[8.5rem] text-right">
                Net Maaş {CURRENCY_SYMBOLS.TRY}
              </TableHead>
              <TableHead className={cn("w-[5.5rem] text-right", AT_MD)}>%50 sa</TableHead>
              <TableHead className={cn("w-[5.5rem] text-right", AT_MD)}>%100 sa</TableHead>
              <TableHead className={cn("w-[8.5rem] text-right", AT_LG)}>
                Mesai {CURRENCY_SYMBOLS.TRY}
              </TableHead>
              <TableHead className="w-[9rem] text-right">
                Toplam {CURRENCY_SYMBOLS.TRY}
              </TableHead>
              <TableHead className={cn("w-[9rem] text-right", AT_SM)}>
                Avro Karşılığı
              </TableHead>
              <TableHead className="w-[6.5rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payroll.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} data-mobile-span="full" data-mobile-hide-label className="py-8 text-center text-sm text-muted-foreground">
                  Bu personelin maaş kaydı yok. Aylık girişler Maaş ekranından yapılır.
                </TableCell>
              </TableRow>
            ) : (
              payroll.map((r) => {
                const toplam = aylikOdeme(r);
                const kur = kurlar.get(r.period) ?? null;
                // KUR YOKSA SIFIR YAZILMAZ: sıfır "bedava" derdi.
                const avro = kur && kur > 0 ? toplam / kur : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell data-label="Dönem" data-mobile-span="full" className="align-top font-medium whitespace-normal md:align-middle md:whitespace-nowrap">
                      {periodLabel(r.period)}
                      {/* `md`/`sm` altında düşen sütunların kritik olanları */}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground md:hidden">
                        {[
                          r.overtimeHours50 > 0 ? `%50 ${fmtNum(r.overtimeHours50)} sa` : "",
                          r.overtimeHours100 > 0 ? `%100 ${fmtNum(r.overtimeHours100)} sa` : "",
                          r.overtimeAmount > 0
                            ? `mesai ${fmtNum(r.overtimeAmount, true)} ${CURRENCY_SYMBOLS.TRY}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "fazla mesai yok"}
                        <span className="sm:hidden">
                          {" · "}
                          {avro === null ? (
                            "kur girilmemiş"
                          ) : (
                            <span className="font-mono tabular-nums">
                              {fmtNum(avro, true)} {CURRENCY_SYMBOLS.EUR}
                            </span>
                          )}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell data-label="Net Maaş" className="text-right align-top font-mono text-sm tabular-nums md:align-middle">
                      {fmtNum(r.netSalary, true)}
                    </TableCell>
                    <TableCell
                      data-label="%50 Saat"
                      className={cn(
                        "text-right font-mono text-sm tabular-nums text-muted-foreground",
                        AT_MD
                      )}
                    >
                      {r.overtimeHours50 > 0 ? fmtNum(r.overtimeHours50) : "—"}
                    </TableCell>
                    <TableCell
                      data-label="%100 Saat"
                      className={cn(
                        "text-right font-mono text-sm tabular-nums text-muted-foreground",
                        AT_MD
                      )}
                    >
                      {r.overtimeHours100 > 0 ? fmtNum(r.overtimeHours100) : "—"}
                    </TableCell>
                    <TableCell
                      data-label="Mesai"
                      className={cn(
                        "text-right font-mono text-sm tabular-nums text-muted-foreground",
                        AT_LG
                      )}
                    >
                      {r.overtimeAmount > 0 ? fmtNum(r.overtimeAmount, true) : "—"}
                    </TableCell>
                    <TableCell data-label="Toplam" className="text-right align-top font-mono text-sm font-medium tabular-nums md:align-middle">
                      {fmtNum(toplam, true)}
                    </TableCell>
                    <TableCell
                      data-label="Avro Karşılığı"
                      className={cn("text-right font-mono text-sm tabular-nums", AT_SM)}
                    >
                      {avro === null ? (
                        <span className="font-sans text-[11px] text-muted-foreground">
                          Kur Girilmemiş
                        </span>
                      ) : (
                        `${fmtNum(avro, true)} ${CURRENCY_SYMBOLS.EUR}`
                      )}
                    </TableCell>
                    <TableCell data-label="Bordro" data-mobile-span="full" className="text-right">
                      {/* Bordro AYRI BİR BELGEDİR ve yeni sekmede açılır:
                          kullanıcı listedeki yerini kaybetmesin. */}
                      <PdfDownloadLink
                        href={`/personnel/bordro?kisi=${employee.id}&donem=${r.period}`}
                        shareTitle={`${employee.fullName} ${r.period} Bordrosu`}
                        className="oc-tap inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" /> Bordro
                      </PdfDownloadLink>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>

      {/* ═══════════════════════════════════════════════ 5) özlük dosyaları */}
      <div id={capaKimligi("ozluk")} className="oc-capa">
        <DocumentsPanel
          employeeId={employee.id}
          documents={documents}
          bugun={bugun}
          canWrite={canWrite}
        />
      </div>

      {/* Pencereler KOŞULLU MONTE edilir: her açılış taze bir bileşendir, alan
          değerlerini senkronize eden bir efekte gerek kalmaz (sale-dialog). */}
      {duzenle && (
        <EmployeeDialog employee={employee} onClose={() => setDuzenle(false)} />
      )}
      {donem && (
        <EmploymentDialog
          employeeId={employee.id}
          row={donem === "yeni" ? null : donem}
          acikDonemVar={acikDonem}
          onClose={() => setDonem(null)}
        />
      )}
    </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════ 2) düzenleme penceresi

/** `EmployeeRow` → pencere girdisi. */
function rowToInput(e: EmployeeRow): EmployeeInput {
  return {
    fullName: e.fullName,
    employeeNo: e.employeeNo,
    category: e.category,
    title: e.title,
    department: e.department,
    nationalId: e.nationalId ?? "",
    birthDate: e.birthDate ?? "",
    birthPlace: e.birthPlace,
    gender: listedeMi(GENDERS, e.gender),
    maritalStatus: listedeMi(MARITAL_STATUSES, e.maritalStatus),
    childCount: e.childCount,
    bloodType: e.bloodType,
    education: listedeMi(EDUCATION_LEVELS, e.education),
    militaryStatus: e.militaryStatus,
    disabilityDegree: e.disabilityDegree,
    phone: e.phone,
    email: e.email,
    address: e.address,
    city: e.city,
    emergencyContact: e.emergencyContact,
    emergencyPhone: e.emergencyPhone,
    contractType: (listedeMi(CONTRACT_TYPES, e.contractType) || "belirsiz") as ContractType,
    workMode: (listedeMi(WORK_MODES, e.workMode) || "tam") as WorkMode,
    sgkNo: e.sgkNo,
    annualLeaveDays: e.annualLeaveDays,
    bankName: e.bankName,
    iban: e.iban,
    notes: e.notes,
  };
}

function EmployeeDialog({
  employee,
  onClose,
}: {
  employee: EmployeeRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<EmployeeInput>(() => rowToInput(employee));

  /**
   * Sayısal alanlar METİN olarak tutulur (satış penceresiyle aynı gerekçe):
   * her tuş vuruşunda sayıya çevrilseydi imleç ve ondalık ayıraç kaybolurdu.
   * BOŞ ALAN BİR DEĞER DEĞİLDİR — `undefined` gider ve şemanın varsayılanı
   * (çocuk 0, yıllık izin 14 gün) yürürlüğe girer.
   */
  const [cocukMetni, setCocukMetni] = useState(String(employee.childCount));
  const [izinMetni, setIzinMetni] = useState(String(employee.annualLeaveDays));

  function set<K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Kategori listesi KAPALI DEĞİLDİR: devralınan kayıttaki bir değer listede
  // yoksa kendi seçeneği olarak korunur, ilk kaydetmede silinmez.
  const kategoriler = useMemo(() => {
    const mevcut = (form.category ?? "").trim();
    return mevcut && !(PERSONNEL_CATEGORIES as readonly string[]).includes(mevcut)
      ? [mevcut, ...PERSONNEL_CATEGORIES]
      : [...PERSONNEL_CATEGORIES];
  }, [form.category]);

  const tcSupheli = Boolean((form.nationalId ?? "").trim()) &&
    !tcKimlikGecerliMi(form.nationalId ?? "");

  function kaydet() {
    startTransition(async () => {
      const res = await saveEmployee(employee.id, {
        ...form,
        childCount: parseNum(cocukMetni) ?? undefined,
        annualLeaveDays: parseNum(izinMetni) ?? undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Personel künyesi kaydedildi.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Geniş pencere tablette kenar boşluğu bırakır (AGENTS MOBIL-6).
          Yükseklik kelepçesi `DialogContent` tabanındadır, tekrar edilmez. */}
      <DialogContent className={`sm:max-w-[min(48rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle>Personel Künyesi</DialogTitle>
          <DialogDescription>
            Çalışma dönemleri burada değil kendi kartında düzenlenir: künye kişiye
            aittir, dönem bir olaydır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Bolum title="Kimlik">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ad Soyad" hint="Ad alanları büyük harfle saklanır.">
                {/* Dönüşüm İKİ YERDE: burada (kullanıcı anında görsün) ve Zod
                    şemasında (kayıt hangi kapıdan girerse girsin öyle olsun). */}
                <Input
                  value={form.fullName}
                  onChange={(e) => set("fullName", adBuyuk(e.target.value))}
                  autoFocus
                />
              </Field>
              <Field label="Sicil No">
                <Input
                  value={form.employeeNo ?? ""}
                  onChange={(e) => set("employeeNo", e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Kategori">
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Kategori Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {kategoriler.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Görev">
                <EditableCombobox
                  options={JOB_TITLES}
                  value={form.title ?? ""}
                  onChange={(v) => set("title", v)}
                  uppercase
                  aria-label="Görev"
                />
              </Field>
              <Field label="Departman">
                <EditableCombobox
                  options={DEPARTMENTS}
                  value={form.department ?? ""}
                  onChange={(v) => set("department", v)}
                  uppercase
                  aria-label="Departman"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="TC Kimlik No"
                hint={
                  tcSupheli ? (
                    <span className="text-amber-700 dark:text-amber-400">
                      Doğrulama algoritmasını geçmiyor. Kayıt engellenmez —
                      yabancı uyruklu personelin numarası bu sınamayı geçmez.
                    </span>
                  ) : undefined
                }
              >
                <Input
                  inputMode="numeric"
                  maxLength={20}
                  value={form.nationalId ?? ""}
                  onChange={(e) => set("nationalId", e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field label="Doğum Tarihi">
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                />
              </Field>
              <Field label="Doğum Yeri">
                <Input
                  value={form.birthPlace ?? ""}
                  onChange={(e) => set("birthPlace", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Cinsiyet">
                <Select
                  value={form.gender}
                  onValueChange={(v) => set("gender", v === YOK ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Belirtilmedi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={YOK}>Belirtilmedi</SelectItem>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABELS[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Medeni Hâl">
                <Select
                  value={form.maritalStatus}
                  onValueChange={(v) => set("maritalStatus", v === YOK ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Belirtilmedi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={YOK}>Belirtilmedi</SelectItem>
                    {MARITAL_STATUSES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MARITAL_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Çocuk Sayısı">
                {/* YER TUTUCU YOK: grileşmiş bir örnek sayı girilmiş bir değer
                    sanılıyordu (satış penceresindeki ders). */}
                <Input
                  inputMode="numeric"
                  value={cocukMetni}
                  onChange={(e) => setCocukMetni(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field label="Kan Grubu" hint="Acil müdahale kaydı.">
                <Select
                  value={form.bloodType ?? ""}
                  onValueChange={(v) => set("bloodType", v === YOK ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Belirtilmedi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={YOK}>Belirtilmedi</SelectItem>
                    {BLOOD_TYPES.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Öğrenim">
                <Select
                  value={form.education}
                  onValueChange={(v) => set("education", v === YOK ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Belirtilmedi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={YOK}>Belirtilmedi</SelectItem>
                    {EDUCATION_LEVELS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {EDUCATION_LABELS[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Askerlik Durumu">
                <Input
                  value={form.militaryStatus ?? ""}
                  onChange={(e) => set("militaryStatus", e.target.value)}
                />
              </Field>
              <Field label="Engel Derecesi">
                <Select
                  value={form.disabilityDegree ? String(form.disabilityDegree) : ""}
                  onValueChange={(v) =>
                    set("disabilityDegree", v === YOK ? null : Number(v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Yok" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={YOK}>Yok</SelectItem>
                    <SelectItem value="1">1. derece</SelectItem>
                    <SelectItem value="2">2. derece</SelectItem>
                    <SelectItem value="3">3. derece</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Bolum>

          <Bolum title="İletişim">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Telefon">
                <Input
                  inputMode="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="E-posta">
                <Input
                  inputMode="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="İl">
                <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
            <Field label="Adres">
              <Textarea
                rows={2}
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Acil Durumda Aranacak Kişi">
                <Input
                  value={form.emergencyContact ?? ""}
                  onChange={(e) => set("emergencyContact", e.target.value)}
                />
              </Field>
              <Field label="Acil Durum Telefonu">
                <Input
                  inputMode="tel"
                  value={form.emergencyPhone ?? ""}
                  onChange={(e) => set("emergencyPhone", e.target.value)}
                />
              </Field>
            </div>
          </Bolum>

          <Bolum title="İstihdam">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Sözleşme Türü">
                <Select
                  value={form.contractType ?? "belirsiz"}
                  onValueChange={(v) => set("contractType", v as ContractType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONTRACT_TYPE_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Çalışma Şekli">
                <Select
                  value={form.workMode ?? "tam"}
                  onValueChange={(v) => set("workMode", v as WorkMode)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_MODES.map((w) => (
                      <SelectItem key={w} value={w}>
                        {WORK_MODE_LABELS[w]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="SGK No">
                <Input
                  value={form.sgkNo ?? ""}
                  onChange={(e) => set("sgkNo", e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
              <Field label="Yıllık İzin (gün)" hint="Boş bırakılırsa 14 gün sayılır.">
                <Input
                  inputMode="numeric"
                  value={izinMetni}
                  onChange={(e) => setIzinMetni(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>
          </Bolum>

          <Bolum title="Banka">
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <Field label="Banka">
                <Input
                  value={form.bankName ?? ""}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </Field>
              <Field
                label="IBAN"
                hint={
                  (form.iban ?? "").trim() ? (
                    <span className="font-mono tabular-nums">
                      {ibanBiciminde(form.iban ?? "")}
                    </span>
                  ) : undefined
                }
              >
                {/* Boşluklar ve küçük harf ŞEMADA temizlenir; kullanıcı
                    istediği gibi yazabilsin diye kutu ham metni tutar. */}
                <Input
                  value={form.iban ?? ""}
                  onChange={(e) => set("iban", e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>
          </Bolum>

          <Bolum title="Not">
            <Field label="Serbest Not">
              <Textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </Bolum>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════ çalışma dönemi penceresi

function EmploymentDialog({
  employeeId,
  row,
  acikDonemVar,
  onClose,
}: {
  employeeId: string;
  row: EmploymentRow | null;
  /** Kişinin açık bir dönemi var mı — yeni dönemde uyarı metni için. */
  acikDonemVar: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(row?.startDate ?? "");
  const [endDate, setEndDate] = useState(row?.endDate ?? "");
  const [exitReason, setExitReason] = useState(listedeMi(EXIT_REASONS, row?.exitReason));
  const [note, setNote] = useState(row?.note ?? "");

  // Bu pencere yeni bir AÇIK dönem açmaya çalışıyor mu? Engel değil, uyarı:
  // asıl kural veritabanındaki `hr_employment_open_key` tekil indeksidir ve
  // hatayı sunucu döndürür (arayüz kopyası zamanla ayrışabilir).
  const ikinciAcik = !row && acikDonemVar && !endDate;

  function kaydet() {
    startTransition(async () => {
      const res = await saveEmployment({
        id: row?.id,
        employeeId,
        startDate,
        endDate,
        exitReason,
        note,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(row ? "Çalışma dönemi güncellendi." : "Çalışma dönemi eklendi.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Çalışma Dönemi" : "Yeni Çalışma Dönemi"}</DialogTitle>
          <DialogDescription>
            Çıkış tarihi boş bırakılan dönem AÇIKTIR: kişi bugün çalışıyor demektir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="İşe Giriş Tarihi">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Çıkış Tarihi" hint="Boş bırakılırsa dönem açık kalır.">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Ayrılma Nedeni"
            hint="Yalnız çıkış tarihi girildiğinde anlamlıdır."
          >
            <Select
              value={exitReason}
              onValueChange={(v) => setExitReason(v === YOK ? "" : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Belirtilmedi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={YOK}>Belirtilmedi</SelectItem>
                {EXIT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {EXIT_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Not">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {ikinciAcik && (
            <p className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span>
                Bu personelin zaten açık bir dönemi var. İkinci bir açık dönem
                kaydedilemez — önce eskisine çıkış tarihi girin ya da bu döneme
                bir çıkış tarihi yazın.
              </span>
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
