// ÜCRET BORDROSU — bir kişinin bir ayı.
//
// ═════════════════════════════════════════════════ BELGENİN YAPISI
// 4857 md. 37 ücret hesap pusulasını, 5510 sayılı kanun da SGK matrah ve
// primlerinin gösterilmesini şart koşar. Belge bu yüzden dört bloktur ve sıra
// pazarlığa kapalıdır:
//
//   1. İŞVEREN + ÇALIŞAN künyesi (SGK sicil, TC, işe giriş, gün sayısı)
//   2. KAZANÇLAR  — brüt kalemler, gün/saat ve birim ücretiyle → BRÜT TOPLAM
//   3. YASAL KESİNTİLER — matrahı ve ORANI görünür → KESİNTİ TOPLAMI
//   4. NET ÖDENEN + kümülatif gelir vergisi matrahı
//
// ORAN VE MATRAH SATIRDA GÖRÜNÜR. "Gelir vergisi: 12.480,15 ₺" tek başına
// doğrulanamaz bir sayıdır; çalışan matrahı ve dilimi görmeden pusulayı
// denetleyemez — pusulanın varlık sebebi tam olarak budur.
//
// ═══════════════════════════════════════ FİRMA NETTEN ANLAŞIYOR
// Kayıtta net ücret var; brüt `lib/personnel/bordro.ts` ile TÜRETİLİR
// (brütleştirme). Kalemlerin brüt karşılığı, net paylarıyla ORANTILI dağıtılır
// — net anlaşmalı sözleşmelerin standart gösterimi. Yuvarlama artığı ilk
// kaleme yazılır ki blok toplamı brüt toplamla BİREBİR tutsun; üç satırı ayrı
// ayrı yuvarlayıp toplamak bir kuruş sapma bırakır ve pusulayı elde kontrol
// eden kişi onu hata sanar.
//
// AVRO YOKTUR (kullanıcı kararı, 12.08.2026). Bordro yasal bir belgedir ve
// tek para birimi Türk lirasıdır; avro karşılığı yönetim raporlamasının işidir
// ve Özet ekranında durur.

import { Document, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, type CompanyInfo } from "./brand";
import { payslipDocCode, payslipPeriodLabel } from "./doc-naming";
import { AYLIK_CALISMA_SAATI } from "@/lib/personnel/payroll";
import type { BordroBreakdown, PayrollParams } from "@/lib/personnel/bordro";

const trUpper = (s: string) => s.toLocaleUpperCase("tr-TR");

function tl(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function say(v: number | null | undefined, basamak = 2): string {
  if (!v) return "—";
  return v.toLocaleString("tr-TR", { maximumFractionDigits: basamak });
}

function yuzde(v: number): string {
  return `%${(v * 100).toLocaleString("tr-TR", { maximumFractionDigits: 3 })}`;
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
  bankName: string;
  hireDate: string | null;
}

export interface PayslipPayroll {
  netSalary: number;
  overtimeHours50: number;
  overtimeHours100: number;
  overtimeAmount: number;
  bonus: number;
  perDiem: number;
  advance: number;
  deduction: number;
  workedDays: number;
  paidOn: string | null;
  note: string;
}

export interface PayslipProps {
  employee: PayslipEmployee;
  payroll: PayslipPayroll;
  /** `2026-08` */
  period: string;
  company: CompanyInfo;
  /** İşyeri SGK sicil numarası — rapor ayarlarından. */
  workplaceSgkNo?: string;
  /**
   * Yasal döküm. Dönemin parametreleri YOKSA `null` gelir ve belge kesinti
   * bloğunu HİÇ BASMAZ — uydurulmuş bir oran pusulayı olduğundan resmî
   * gösterirdi.
   */
  bordro: BordroBreakdown | null;
  params: PayrollParams | null;
}

// ————————————————————————————————————————————————————————————— parçalar

function Kunye({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 5, marginBottom: 2 }}>
      <Text
        style={{
          width: 88,
          fontFamily: FONTS.mono,
          fontSize: 6.8,
          letterSpacing: 0.5,
          color: BRAND.gray600,
        }}
      >
        {trUpper(etiket)}
      </Text>
      <Text style={{ flex: 1, fontSize: 8.2 }}>{deger || "—"}</Text>
    </View>
  );
}

function BlokBasligi({ baslik }: { baslik: string }) {
  return (
    <View
      style={{
        backgroundColor: BRAND.ink,
        paddingVertical: 3,
        paddingHorizontal: 6,
        marginBottom: 4,
      }}
    >
      <Text style={{ fontFamily: FONTS.mono, fontSize: 7, letterSpacing: 1.1, color: BRAND.white }}>
        {trUpper(baslik)}
      </Text>
    </View>
  );
}

function TabloBasligi({ ilk, ikinci, ucuncu }: { ilk: string; ikinci: string; ucuncu: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 0.75,
        borderBottomColor: BRAND.line350,
        paddingBottom: 2,
        marginBottom: 1,
      }}
    >
      <Text style={{ flex: 1, fontFamily: FONTS.mono, fontSize: 6.5, color: BRAND.gray600 }}>
        {trUpper(ilk)}
      </Text>
      <Text
        style={{
          width: 104,
          textAlign: "right",
          fontFamily: FONTS.mono,
          fontSize: 6.5,
          color: BRAND.gray600,
        }}
      >
        {trUpper(ikinci)}
      </Text>
      <Text
        style={{
          width: 84,
          textAlign: "right",
          fontFamily: FONTS.mono,
          fontSize: 6.5,
          color: BRAND.gray600,
        }}
      >
        {trUpper(ucuncu)}
      </Text>
    </View>
  );
}

function Satir({
  ad,
  olcu,
  taban,
  tutar,
  koyu,
  ust,
  eksi,
}: {
  ad: string;
  /** Gün/saat ya da matrah — orta sütunun solu. */
  olcu?: string;
  /** Birim ücret ya da oran — orta sütunun sağı. */
  taban?: string;
  tutar: number | null;
  koyu?: boolean;
  ust?: boolean;
  eksi?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        paddingVertical: 2.2,
        borderTopWidth: ust ? 0.75 : 0,
        borderTopColor: BRAND.ink,
      }}
    >
      <Text style={{ flex: 1, fontSize: 8.2, fontWeight: koyu ? 700 : 400, paddingRight: 6 }}>
        {ad}
      </Text>
      <Text
        style={{
          width: 104,
          textAlign: "right",
          fontFamily: FONTS.mono,
          fontSize: 7.2,
          color: BRAND.gray600,
        }}
      >
        {[olcu, taban].filter(Boolean).join("  ×  ")}
      </Text>
      <Text
        style={{
          width: 84,
          textAlign: "right",
          fontFamily: FONTS.mono,
          fontSize: 8.2,
          fontWeight: koyu ? 700 : 400,
        }}
      >
        {eksi && tutar ? `−${tl(tutar)}` : tl(tutar)}
      </Text>
    </View>
  );
}

// ————————————————————————————————————————————————————————————————— belge

export function PayslipDocument(props: PayslipProps) {
  return (
    <Document
      title={`Orion Cranes — Ücret Bordrosu (${props.employee.fullName}, ${payslipPeriodLabel(props.period)})`}
      author="Orion Cranes"
      subject={payslipDocCode(props.period)}
    >
      <PayslipPage {...props} />
    </Document>
  );
}

export function renderPayslipPdf(props: PayslipProps): Promise<Buffer> {
  return renderToBuffer(<PayslipDocument {...props} />);
}

/**
 * ÇOK SAYFALI BORDRO — bir dönemin bütün çalışanları TEK belgede.
 *
 * Her kişi KENDİ SAYFASINDADIR (`BrandPage` her çağrıda yeni sayfa açar):
 * pusula kişiye imzalatılır, iki kişinin bordrosu aynı yaprağa basılamaz.
 */
export function PayslipBatchDocument({ items }: { items: readonly PayslipProps[] }) {
  const donem = items[0] ? payslipPeriodLabel(items[0].period) : "";
  return (
    <Document
      title={`Orion Cranes — Ücret Bordroları (${donem})`}
      author="Orion Cranes"
      subject={items[0] ? payslipDocCode(items[0].period) : "ORC-BR"}
    >
      {items.map((it, i) => (
        <PayslipPage key={`${it.employee.fullName}-${i}`} {...it} />
      ))}
    </Document>
  );
}

export function renderPayslipBatchPdf(items: readonly PayslipProps[]): Promise<Buffer> {
  return renderToBuffer(<PayslipBatchDocument items={items} />);
}

function PayslipPage({
  employee,
  payroll,
  period,
  company,
  workplaceSgkNo,
  bordro,
  params,
}: PayslipProps) {
  const donem = payslipPeriodLabel(period);
  const kod = payslipDocCode(period);

  // Bordro matrahına giren net kalemler.
  const netMesai = payroll.overtimeAmount;
  const netPrim = payroll.bonus;
  const netToplam = payroll.netSalary + netMesai + netPrim;

  // BRÜT DAĞITIMI net paylarıyla orantılıdır; artık İLK kaleme yazılır.
  const brutToplam = bordro?.gross ?? netToplam;
  const oran = netToplam > 0 ? brutToplam / netToplam : 0;
  const pay = (v: number) => Math.round(v * oran * 100) / 100;
  const brutMesai = pay(netMesai);
  const brutPrim = pay(netPrim);
  const brutNormal = Math.round((brutToplam - brutMesai - brutPrim) * 100) / 100;

  // Saat ücreti BRÜT üzerinden gösterilir: zam brüte uygulanır.
  const brutSaatUcreti = brutNormal / AYLIK_CALISMA_SAATI;

  // İki zamlı saati tek satırda toplamak birim ücreti gösterilemez yapardı;
  // brüt mesai, zam ağırlıklarına göre iki satıra bölünür.
  const agirlik50 = payroll.overtimeHours50 * 1.5;
  const agirlik100 = payroll.overtimeHours100 * 2;
  const agirlikToplam = agirlik50 + agirlik100;
  const brutMesai50 =
    agirlikToplam > 0 ? Math.round((brutMesai * agirlik50) / agirlikToplam * 100) / 100 : 0;
  const brutMesai100 = Math.round((brutMesai - brutMesai50) * 100) / 100;

  const netOdenen = netToplam + payroll.perDiem - payroll.advance - payroll.deduction;

  return (
    <BrandPage
      docLine={trUpper(`Orion Cranes · Ücret Bordrosu · ${donem}`)}
      docCode={kod}
      company={company}
    >
      <BrandBand
        docCode={kod}
        lines={[donem, payroll.paidOn ? `ÖDEME ${gun(payroll.paidOn)}` : ""].filter(Boolean)}
      />

      <Text style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3 }}>ÜCRET BORDROSU</Text>
      <Text style={{ fontSize: 8, color: BRAND.gray600, marginBottom: 10 }}>
        {donem} dönemi · 4857 sayılı İş Kanunu md. 37 ücret hesap pusulası
      </Text>

      {/* ——————————————————————————————————————— 1. İŞVEREN / ÇALIŞAN */}
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <BlokBasligi baslik="İşveren" />
          <Kunye etiket="Unvan" deger={company.company} />
          <Kunye etiket="Adres" deger={company.address} />
          {workplaceSgkNo ? <Kunye etiket="SGK İşyeri Sicil" deger={workplaceSgkNo} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <BlokBasligi baslik="Çalışan" />
          <Kunye etiket="Ad Soyad" deger={employee.fullName} />
          <Kunye etiket="TC Kimlik No" deger={employee.nationalId ?? ""} />
          <Kunye etiket="SGK Sicil No" deger={employee.sgkNo} />
          <Kunye etiket="Sicil No" deger={employee.employeeNo} />
          <Kunye etiket="Görev" deger={employee.title} />
          <Kunye etiket="İşe Giriş" deger={gun(employee.hireDate)} />
          <Kunye
            etiket="Banka / IBAN"
            deger={[employee.bankName, employee.iban].filter(Boolean).join(" · ")}
          />
        </View>
      </View>

      {/* ——————————————————————————————————————— çalışma bilgileri */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          backgroundColor: BRAND.paper100,
          paddingVertical: 5,
          paddingHorizontal: 8,
          marginBottom: 10,
        }}
      >
        {[
          ["SGK Gün", say(payroll.workedDays, 0)],
          ["Normal Çalışma", `${say(AYLIK_CALISMA_SAATI, 0)} saat`],
          ["Fazla Mesai %50", `${say(payroll.overtimeHours50)} saat`],
          ["Fazla Mesai %100", `${say(payroll.overtimeHours100)} saat`],
          ["Brüt Saat Ücreti", `${tl(brutSaatUcreti)} ₺`],
        ].map(([etiket, deger]) => (
          <View key={etiket}>
            <Text
              style={{
                fontFamily: FONTS.mono,
                fontSize: 6.3,
                letterSpacing: 0.5,
                color: BRAND.gray600,
              }}
            >
              {trUpper(etiket)}
            </Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 8.6, marginTop: 1.5 }}>{deger}</Text>
          </View>
        ))}
      </View>

      {/* ————————————————————————————————————————————— 2. KAZANÇLAR */}
      <View style={{ marginBottom: 9 }}>
        <BlokBasligi baslik="Kazançlar" />
        <TabloBasligi ilk="Açıklama" ikinci="Gün / Saat  ×  Birim" ucuncu="Brüt Tutar (₺)" />
        <Satir
          ad="Normal Çalışma"
          olcu={`${say(payroll.workedDays, 0)} gün`}
          taban={`${tl(brutSaatUcreti)} ₺/sa`}
          tutar={brutNormal}
        />
        {payroll.overtimeHours50 > 0 && (
          <Satir
            ad="Fazla Mesai (%50 zamlı)"
            olcu={`${say(payroll.overtimeHours50)} sa`}
            taban={`${tl(brutSaatUcreti * 1.5)} ₺/sa`}
            tutar={brutMesai50}
          />
        )}
        {payroll.overtimeHours100 > 0 && (
          <Satir
            ad="Fazla Mesai (%100 zamlı)"
            olcu={`${say(payroll.overtimeHours100)} sa`}
            taban={`${tl(brutSaatUcreti * 2)} ₺/sa`}
            tutar={brutMesai100}
          />
        )}
        {netPrim > 0 && <Satir ad="Prim / İkramiye" tutar={brutPrim} />}
        <Satir ad="BRÜT TOPLAM" tutar={brutToplam} koyu ust />
      </View>

      {/* ——————————————————————————————————— 3. YASAL KESİNTİLER */}
      {bordro && params ? (
        <View style={{ marginBottom: 9 }}>
          <BlokBasligi baslik="Yasal Kesintiler" />
          <TabloBasligi ilk="Açıklama" ikinci="Matrah  ×  Oran" ucuncu="Tutar (₺)" />
          <Satir
            ad="SGK İşçi Payı"
            olcu={`${tl(bordro.sgkBase)} ₺`}
            taban={yuzde(params.sgkEmployeeRate)}
            tutar={bordro.sgkEmployee}
          />
          <Satir
            ad="İşsizlik Sigortası (İşçi)"
            olcu={`${tl(bordro.sgkBase)} ₺`}
            taban={yuzde(params.unemploymentEmployeeRate)}
            tutar={bordro.unemploymentEmployee}
          />
          <Satir
            ad="Gelir Vergisi"
            olcu={`${tl(bordro.incomeTaxBase)} ₺`}
            taban={yuzde(bordro.appliedRate)}
            tutar={bordro.incomeTaxGross}
          />
          {bordro.incomeTaxExemption > 0 && (
            <Satir
              ad="      Asgari Ücret Gelir Vergisi İstisnası"
              tutar={bordro.incomeTaxExemption}
              eksi
            />
          )}
          <Satir
            ad="Damga Vergisi"
            olcu={`${tl(bordro.gross)} ₺`}
            taban={yuzde(params.stampTaxRate)}
            tutar={bordro.stampTaxGross}
          />
          {bordro.stampTaxExemption > 0 && (
            <Satir
              ad="      Asgari Ücret Damga Vergisi İstisnası"
              tutar={bordro.stampTaxExemption}
              eksi
            />
          )}
          <Satir ad="KESİNTİLER TOPLAMI" tutar={bordro.totalDeductions} koyu ust />
        </View>
      ) : (
        <View
          style={{ borderWidth: 0.75, borderColor: BRAND.line350, padding: 7, marginBottom: 9 }}
        >
          <Text style={{ fontSize: 7.6, color: BRAND.gray600 }}>
            {donem} dönemi için bordro parametreleri (asgari ücret, SGK tavanı, gelir vergisi
            dilimleri) tanımlı değil; yasal kesinti dökümü bu belgede gösterilemiyor.
          </Text>
        </View>
      )}

      {/* ————————————————————————————— 4. NETTEN MAHSUP + NET ÖDENEN */}
      {(payroll.perDiem > 0 || payroll.advance > 0 || payroll.deduction > 0) && (
        <View style={{ marginBottom: 9 }}>
          <BlokBasligi baslik="Diğer Ödeme ve Mahsuplar" />
          {payroll.perDiem > 0 && (
            <Satir ad="Harcirah (yasal sınır içinde vergiden müstesna)" tutar={payroll.perDiem} />
          )}
          {payroll.advance > 0 && <Satir ad="Avans Mahsubu" tutar={payroll.advance} eksi />}
          {payroll.deduction > 0 && <Satir ad="Diğer Kesinti" tutar={payroll.deduction} eksi />}
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: BRAND.paper100,
          borderLeftWidth: 3,
          borderLeftColor: BRAND.red,
          paddingVertical: 7,
          paddingHorizontal: 9,
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>NET ÖDENEN</Text>
        <Text style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 700 }}>
          {tl(netOdenen)} ₺
        </Text>
      </View>

      {/* KÜMÜLATİF MATRAH bordronun zorunlu künyesidir: gelir vergisi dilimi
          yılbaşından beri biriken matraha göre yükselir ve çalışan bir sonraki
          ayki kesintiyi ancak bu sayıyla öngörebilir. */}
      {bordro && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            borderTopWidth: 0.75,
            borderTopColor: BRAND.line300,
            paddingTop: 5,
            marginBottom: 12,
          }}
        >
          {[
            ["Kümülatif GV Matrahı", `${tl(bordro.cumulativeTaxBase)} ₺`],
            ["Uygulanan Dilim", yuzde(bordro.appliedRate)],
            ["SGK İşveren Payı", `${tl(bordro.sgkEmployer + bordro.unemploymentEmployer)} ₺`],
            ["İşverene Toplam Maliyet", `${tl(bordro.employerCost)} ₺`],
          ].map(([etiket, deger]) => (
            <View key={etiket}>
              <Text
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 6.3,
                  letterSpacing: 0.5,
                  color: BRAND.gray600,
                }}
              >
                {trUpper(etiket)}
              </Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 8.4, marginTop: 1.5 }}>{deger}</Text>
            </View>
          ))}
        </View>
      )}

      {payroll.note ? (
        <View style={{ marginBottom: 10 }}>
          <BlokBasligi baslik="Not" />
          <Text style={{ fontSize: 8.2 }}>{payroll.note}</Text>
        </View>
      ) : null}

      {/* ————————————————————————————————————————————————————————— imza */}
      <View style={{ flexDirection: "row", gap: 24, marginTop: 10 }}>
        {["İşveren / Yetkili", "Çalışan"].map((etiket) => (
          <View key={etiket} style={{ flex: 1 }}>
            <View style={{ height: 32 }} />
            <View style={{ height: 0.75, backgroundColor: BRAND.line350 }} />
            <Text
              style={{
                fontFamily: FONTS.mono,
                fontSize: 6.8,
                letterSpacing: 0.7,
                color: BRAND.gray600,
                marginTop: 3,
              }}
            >
              {trUpper(etiket)}
            </Text>
          </View>
        ))}
      </View>
    </BrandPage>
  );
}
