// ÜCRET PUSULASI (bordro) — bir kişinin bir ayı.
//
// ═══════════════════════════════════════════ BELGE NE SÖYLER, NE SÖYLEMEZ
// Bu belge SAKLANANI BASAR, hesaplamaz. Yasal brüt→net dönüşümü (SGK matrahı,
// kümülatif gelir vergisi dilimi, asgari ücret istisnası, damga vergisi) her
// yıl en az iki kez değişir; muhasebeden gelen gerçek rakamı uydurulmuş bir
// hesapla ezmek bordroyu yanlış yapardı. Belge bunu KENDİ ÜZERİNDE söyler ve
// yasal kesinti bloğu alanlar BOŞSA hiç çizilmez — boş bir vergi tablosu
// basmak belgeyi olduğundan resmî gösterirdi.
//
// HESAPLANAN TEK ŞEY FAZLA MESAİDİR ve o da 4857 md. 41'dir:
//     saat ücreti = net / 225 ·  %50 zamlı = ×1,5  ·  %100 zamlı = ×2
// Saat ücreti ve çarpan SATIRDA GÖRÜNÜR: bordronun anlaşılırlığı buradan
// gelir, "fazla mesai: 48.753,33 ₺" tek başına doğrulanamaz bir sayıdır.
//
// AVRO SATIRI DÖNEMİN KENDİ KURUYLA basılır ve kur girilmemişse SATIR HİÇ
// ÇIKMAZ — bugünkü kurla çevirmek, ödenmiş bir ayın karşılığını her
// yazdırmada değiştirirdi (AGENTS md. 16).

import { Document, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  BRAND,
  BrandBand,
  BrandPage,
  FONTS,
  type CompanyInfo,
} from "./brand";
import { payslipDocCode, payslipPeriodLabel } from "./doc-naming";
import { AYLIK_CALISMA_SAATI, saatlikUcret } from "@/lib/finance/payroll";

const trUpper = (s: string) => s.toLocaleUpperCase("tr-TR");

function tl(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Kur DÖRT HANE basılır. `tl()`nin iki hanesi bir tutar için doğrudur ama bir
 * kur için değildir: 50,1578 → "50,16" yazmak, pusuladaki avro karşılığını
 * kullanıcı elde doğrulamak istediğinde tutturamamasına yol açar.
 */
function kur(v: number): string {
  return v.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function saat(v: number | null | undefined): string {
  if (!v) return "—";
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

function gun(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export interface PayslipEmployee {
  fullName: string;
  employeeNo: string;
  nationalId: string | null;
  title: string;
  department: string;
  sgkNo: string;
  iban: string;
  /** İlk çalışma döneminin başlangıcı (kıdem başlangıcı). */
  hireDate: string | null;
}

export interface PayslipPayroll {
  netSalary: number;
  overtimeHours50: number;
  overtimeHours100: number;
  overtimeAmount: number;
  grossSalary: number | null;
  sgkEmployee: number | null;
  sgkEmployer: number | null;
  unemploymentEmployee: number | null;
  incomeTax: number | null;
  stampTax: number | null;
  bonus: number;
  perDiem: number;
  advance: number;
  deduction: number;
  paidOn: string | null;
  note: string;
}

export interface PayslipProps {
  employee: PayslipEmployee;
  payroll: PayslipPayroll;
  /** `2026-08` */
  period: string;
  /** Dönemin KENDİ kuru (1 € kaç ₺); girilmemişse null. */
  eurTryRate: number | null;
  company: CompanyInfo;
}

// ————————————————————————————————————————————————————————————— parçalar

/**
 * Künye satırı: etiket + değer.
 *
 * `textTransform: "uppercase"` KULLANILMAZ. react-pdf onu JavaScript'in
 * `toUpperCase()`ine çevirir ve o "i" harfini "I" yapar: "TC Kimlik No"
 * → "TC KIMLIK NO", "İşe Giriş" → "İŞE GIRIŞ". Uygulamanın her yerinde
 * geçerli olan kural burada da geçerlidir (`lib/tr-text.ts`); büyütme
 * `trUpper` ile ÇAĞRI YERİNDE yapılır.
 */
function Kunye({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 2.5 }}>
      <Text
        style={{
          width: 92,
          fontFamily: FONTS.mono,
          fontSize: 7,
          letterSpacing: 0.6,
          color: BRAND.gray600,
        }}
      >
        {trUpper(etiket)}
      </Text>
      <Text style={{ flex: 1, fontSize: 8.5 }}>{deger || "—"}</Text>
    </View>
  );
}

function BlokBasligi({ baslik }: { baslik: string }) {
  return (
    <View
      style={{
        backgroundColor: BRAND.ink,
        paddingVertical: 3.5,
        paddingHorizontal: 7,
        marginBottom: 5,
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.mono,
          fontSize: 7.5,
          letterSpacing: 1.2,
          color: BRAND.white,
        }}
      >
        {trUpper(baslik)}
      </Text>
    </View>
  );
}

function Satir({
  ad,
  aciklama,
  tutar,
  koyu,
  ust,
}: {
  ad: string;
  aciklama?: string;
  tutar: number | null;
  koyu?: boolean;
  ust?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 3,
        borderTopWidth: ust ? 0.75 : 0,
        borderTopColor: BRAND.line350,
      }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontSize: 8.5, fontWeight: koyu ? 700 : 400 }}>{ad}</Text>
        {aciklama ? (
          <Text style={{ fontSize: 7, color: BRAND.gray600, marginTop: 1 }}>{aciklama}</Text>
        ) : null}
      </View>
      <Text
        style={{
          width: 92,
          textAlign: "right",
          fontFamily: FONTS.mono,
          fontSize: 8.5,
          fontWeight: koyu ? 700 : 400,
        }}
      >
        {tl(tutar)} ₺
      </Text>
    </View>
  );
}

// ————————————————————————————————————————————————————————————————— belge

export function PayslipDocument(props: PayslipProps) {
  const { period } = props;
  return (
    <Document
      title={`Orion Cranes — Ücret Pusulası (${props.employee.fullName}, ${payslipPeriodLabel(period)})`}
      author="Orion Cranes"
      subject={payslipDocCode(period)}
    >
      <PayslipPage {...props} />
    </Document>
  );
}

export function renderPayslipPdf(props: PayslipProps): Promise<Buffer> {
  return renderToBuffer(<PayslipDocument {...props} />);
}

function PayslipPage({
  employee,
  payroll,
  period,
  eurTryRate,
  company,
}: PayslipProps) {
  const donem = payslipPeriodLabel(period);
  const kod = payslipDocCode(period);
  const saatUcreti = saatlikUcret(payroll.netSalary);

  const mesai50 = saatUcreti * payroll.overtimeHours50 * 1.5;
  const mesai100 = saatUcreti * payroll.overtimeHours100 * 2;

  const kazanc =
    payroll.netSalary + payroll.overtimeAmount + payroll.bonus + payroll.perDiem;
  const kesinti = payroll.advance + payroll.deduction;
  const odenen = kazanc - kesinti;

  // YASAL KESİNTİ BLOĞU YALNIZ VERİ VARSA ÇİZİLİR.
  const yasal = [
    { ad: "SGK İşçi Payı", v: payroll.sgkEmployee },
    { ad: "İşsizlik Sigortası (İşçi)", v: payroll.unemploymentEmployee },
    { ad: "Gelir Vergisi", v: payroll.incomeTax },
    { ad: "Damga Vergisi", v: payroll.stampTax },
    { ad: "SGK İşveren Payı", v: payroll.sgkEmployer },
  ].filter((x) => x.v !== null && x.v !== undefined && Number.isFinite(x.v));
  const yasalVar = yasal.length > 0 || (payroll.grossSalary ?? 0) > 0;

  return (
    <BrandPage
      docLine={trUpper(`Orion Cranes · Ücret Pusulası · ${donem}`)}
      docCode={kod}
      company={company}
    >
      <BrandBand docCode={kod} lines={[donem, payroll.paidOn ? `ÖDEME ${gun(payroll.paidOn)}` : ""].filter(Boolean)} />

      <Text
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.3,
          marginBottom: 2,
        }}
      >
        ÜCRET PUSULASI
      </Text>
      <Text style={{ fontSize: 8.5, color: BRAND.gray600, marginBottom: 12 }}>
        {donem} dönemi
      </Text>

      {/* ———————————————————————————————————————————— işveren / çalışan */}
      <View style={{ flexDirection: "row", gap: 18, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <BlokBasligi baslik="İşveren" />
          <Kunye etiket="Unvan" deger={company.company} />
          <Kunye etiket="Adres" deger={company.address} />
        </View>
        <View style={{ flex: 1 }}>
          <BlokBasligi baslik="Çalışan" />
          <Kunye etiket="Ad Soyad" deger={employee.fullName} />
          <Kunye etiket="TC Kimlik No" deger={employee.nationalId ?? ""} />
          <Kunye etiket="Sicil No" deger={employee.employeeNo} />
          <Kunye etiket="Görev" deger={employee.title} />
          <Kunye etiket="İşe Giriş" deger={gun(employee.hireDate)} />
          <Kunye etiket="SGK No" deger={employee.sgkNo} />
          <Kunye etiket="IBAN" deger={employee.iban} />
        </View>
      </View>

      {/* —————————————————————————————————————————————————————— kazançlar */}
      <View style={{ marginBottom: 10 }}>
        <BlokBasligi baslik="Kazançlar" />
        <Satir ad="Net Maaş" aciklama={`${AYLIK_CALISMA_SAATI} saat/ay · saat ücreti ${tl(saatUcreti)} ₺`} tutar={payroll.netSalary} />
        {payroll.overtimeHours50 > 0 && (
          <Satir
            ad="Fazla Mesai (%50 zamlı)"
            aciklama={`${saat(payroll.overtimeHours50)} saat × ${tl(saatUcreti)} ₺ × 1,5`}
            tutar={mesai50}
          />
        )}
        {payroll.overtimeHours100 > 0 && (
          <Satir
            ad="Fazla Mesai (%100 zamlı)"
            aciklama={`${saat(payroll.overtimeHours100)} saat × ${tl(saatUcreti)} ₺ × 2`}
            tutar={mesai100}
          />
        )}
        {payroll.bonus > 0 && <Satir ad="Prim / İkramiye" tutar={payroll.bonus} />}
        {payroll.perDiem > 0 && <Satir ad="Harcirah" tutar={payroll.perDiem} />}
        <Satir ad="Kazançlar Toplamı" tutar={kazanc} koyu ust />
      </View>

      {/* —————————————————————————————————————————————————————— kesintiler */}
      {kesinti > 0 && (
        <View style={{ marginBottom: 10 }}>
          <BlokBasligi baslik="Kesintiler" />
          {payroll.advance > 0 && <Satir ad="Avans" tutar={payroll.advance} />}
          {payroll.deduction > 0 && <Satir ad="Diğer Kesinti" tutar={payroll.deduction} />}
          <Satir ad="Kesintiler Toplamı" tutar={kesinti} koyu ust />
        </View>
      )}

      {/* ————————————————————————————— yasal kesintiler (YALNIZ VERİ VARSA) */}
      {yasalVar && (
        <View style={{ marginBottom: 10 }}>
          <BlokBasligi baslik="Yasal Bilgiler" />
          {(payroll.grossSalary ?? 0) > 0 && (
            <Satir ad="Brüt Ücret" tutar={payroll.grossSalary} />
          )}
          {yasal.map((x) => (
            <Satir key={x.ad} ad={x.ad} tutar={x.v as number} />
          ))}
          <Text style={{ fontSize: 7, color: BRAND.gray600, marginTop: 4 }}>
            Bu bölümdeki rakamlar muhasebe kayıtlarından girilmiştir; uygulama yasal
            brüt→net hesabı yapmaz.
          </Text>
        </View>
      )}

      {/* ————————————————————————————————————————————————————————— ödenen */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: BRAND.paper100,
          borderLeftWidth: 3,
          borderLeftColor: BRAND.red,
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginBottom: 6,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>ÖDENEN TUTAR</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700 }}>
          {tl(odenen)} ₺
        </Text>
      </View>

      {/* AVRO SATIRI — kur yoksa HİÇ BASILMAZ. */}
      {eurTryRate && eurTryRate > 0 ? (
        <Text style={{ fontSize: 8, color: BRAND.gray600, marginBottom: 12 }}>
          Avro karşılığı {tl(odenen / eurTryRate)} € — dönem kuru 1 € = {kur(eurTryRate)} ₺ ({donem}).
        </Text>
      ) : (
        <View style={{ marginBottom: 12 }} />
      )}

      {payroll.note ? (
        <View style={{ marginBottom: 12 }}>
          <BlokBasligi baslik="Not" />
          <Text style={{ fontSize: 8.5 }}>{payroll.note}</Text>
        </View>
      ) : null}

      {/* ————————————————————————————————————————————————————————— imza */}
      <View style={{ flexDirection: "row", gap: 24, marginTop: 18 }}>
        {["İşveren / Yetkili", "Çalışan"].map((etiket) => (
          <View key={etiket} style={{ flex: 1 }}>
            <View style={{ height: 34 }} />
            <View style={{ height: 0.75, backgroundColor: BRAND.line350 }} />
            <Text
              style={{
                fontFamily: FONTS.mono,
                fontSize: 7,
                letterSpacing: 0.8,
                color: BRAND.gray600,
                marginTop: 3,
              }}
            >
              {trUpper(etiket)}
            </Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 7, color: BRAND.gray500, marginTop: 16 }}>
        Bu belge bir ÖN BİLGİ pusulasıdır; yasal bordro muhasebe kayıtlarından üretilir.
        Fazla mesai tutarı 4857 sayılı İş Kanunu md. 41 uyarınca saat ücretinin %50 ve
        %100 zamlı karşılıklarıyla hesaplanmıştır.
      </Text>
    </BrandPage>
  );
}
