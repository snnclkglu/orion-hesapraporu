// Hammadde havuzu indirmesi — EXCEL ya da PDF, EKRANDAKİ SÜZGEÇLE.
//
// Ekipman tarafının (`purchasing/export/route.ts`) kardeşi ve aynı üç kuralı
// izler: kapsamı İSTEMCİ söyler (anahtar listesi), `POST`tur (anahtar bir
// TANIMdır ve adres çubuğuna sığmaz), sıra istemciden gelir.
//
// AYRI BİR UÇ OLMASININ SEBEBİ SÜTUNLARDIR: hammaddede "İç Çap / Dış Çap /
// Boy" yerine kalınlık, kesit, metre ve KAÇ BOY vardır. Aynı uca ikinci bir
// dal koymak, iki farklı belgeyi tek bir sütun listesine sıkıştırmak olurdu.

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { canSeePurchasing } from "@/lib/roles";
import { autoWidth, styleHeaderRow, writeTitleBlock } from "@/lib/excel/brand";
import { getReportSettings } from "@/lib/settings";
import { renderPurchaseRequestPdf, type PurchaseRequestRow } from "@/lib/pdf/purchase-request";
import { HAMMADDE_ADLARI } from "@/lib/purchasing/hammadde/siniflar";
import { loadSiparisler, loadTeklifler } from "../../data";
import { loadHammaddeHavuzu } from "../data";

export const runtime = "nodejs";

/** Boş hücrede tire: "yazılmamış" ile "sıfır" ayırt edilebilmeli. */
const YOK = "—";

const SUTUNLAR = [
  "İş Numarası",
  "Tür",
  "Stok Kalemi",
  "Kesit",
  "Kalite",
  "Kalınlık (mm)",
  "Toplam m²",
  "kg/m",
  "Toplam m",
  "Stok Boyu (mm)",
  "Kaç Boy",
  "Parça Adedi",
  "Ağırlık (Kg)",
  "Sipariş Edilen",
  "En İyi Fiyat (€)",
  "Tedarikçi",
  "Kullanıldığı Yer",
  "Not",
  "Durum",
];

export async function POST(request: NextRequest) {
  return uret(request);
}

export async function GET(request: NextRequest) {
  return uret(request);
}

async function uret(request: NextRequest) {
  const bicim = request.nextUrl.searchParams.get("bicim") === "pdf" ? "pdf" : "xlsx";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profil } = user
    ? await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!canSeePurchasing((profil as { role?: string } | null)?.role)) {
    return new NextResponse("Yetkisiz", { status: 403 });
  }

  const form = request.method === "POST" ? await request.formData() : null;
  const secilenler = String(form?.get("anahtarlar") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const suzgecMetni = String(form?.get("suzgec") ?? "tümü");

  const veri = await loadHammaddeHavuzu(supabase);
  const harita = new Map(veri.havuz.satirlar.map((s) => [s.key, s]));
  // TANINMAYAN ANAHTAR SESSİZCE DÜŞER: havuz istemcinin listeyi aldığı andan
  // beri değişmiş olabilir ve eksik bir satır, indirmeyi tamamen kaybetmekten
  // iyidir. Belgedeki kalem sayısı zaten künyeye yazılır.
  const satirlar =
    secilenler.length > 0
      ? secilenler.map((k) => harita.get(k)).filter((s) => s != null)
      : veri.havuz.satirlar;

  const anahtarlar = satirlar.map((s) => s.key);
  const [teklifler, siparisler] = await Promise.all([
    anahtarlar.length > 0 ? loadTeklifler(supabase, anahtarlar) : Promise.resolve([]),
    loadSiparisler(supabase),
  ]);

  const siparisAdetleri = new Map<string, number>();
  for (const s of siparisler) {
    for (const l of s.satirlar) {
      siparisAdetleri.set(l.matchKey, (siparisAdetleri.get(l.matchKey) ?? 0) + l.qty);
    }
  }
  const enIyiTeklif = new Map<string, { eur: number | null; supplier: string; sayi: number }>();
  for (const t of teklifler) {
    const m = enIyiTeklif.get(t.matchKey);
    const daha = m == null || (t.unitPriceEur != null && (m.eur == null || t.unitPriceEur < m.eur));
    enIyiTeklif.set(t.matchKey, {
      eur: daha ? t.unitPriceEur : (m?.eur ?? null),
      supplier: daha ? t.supplier : (m?.supplier ?? ""),
      sayi: (m?.sayi ?? 0) + 1,
    });
  }

  const hazir = satirlar.map((satir) => {
    const siparisEdilen = siparisAdetleri.get(satir.key) ?? 0;
    const t = enIyiTeklif.get(satir.key);
    const gereken =
      satir.boyAdedi ?? (Math.ceil(satir.toplamAgirlikKg ?? 0) || satir.parcaAdedi);
    const durum =
      gereken > 0 && siparisEdilen >= gereken
        ? "Sipariş edildi"
        : siparisEdilen > 0
          ? "Kısmi sipariş"
          : (t?.sayi ?? 0) > 0
            ? "Teklif alındı"
            : "Bekliyor";
    return { satir, siparisEdilen, gereken, teklif: t, durum };
  });

  const kapsam =
    secilenler.length > 0
      ? `Seçili ${hazir.length} kalem`
      : `Süzgeçli liste — ${hazir.length} kalem`;
  const bugun = new Date().toLocaleDateString("tr-TR");
  const hazirlayan = (profil as { full_name?: string } | null)?.full_name ?? "";

  // ————————————————————————————————————————————————————————————— PDF
  if (bicim === "pdf") {
    const ayarlar = await getReportSettings(supabase);
    // BELGE FİYATSIZDIR (`purchase-request.tsx` tip düzeyinde engelliyor):
    // talep belgesi tedarikçiye gider ve elimizdeki en iyi fiyatı göstermez.
    const rows: PurchaseRequestRow[] = hazir.map((h) => ({
      sinif: HAMMADDE_ADLARI[h.satir.sinif],
      tanim: h.satir.tanim,
      isNolari: [...new Set(h.satir.paylar.map((p) => p.itemNo).filter(Boolean))],
      parcaKodlari: h.satir.kesitKodu ? [h.satir.kesitKodu] : [],
      kullanildigiYer: [...new Set(h.satir.parcalar.map((p) => p.groupName).filter(Boolean))].join(
        " · "
      ),
      malzeme: h.satir.kalite,
      // SİPARİŞ EDİLECEK MİKTAR: boy sayılabiliyorsa BOY, yoksa ağırlık.
      adet: h.satir.boyAdedi ?? (h.satir.toplamAgirlikKg == null ? null : Math.ceil(h.satir.toplamAgirlikKg)),
      birim: h.satir.boyAdedi != null ? "Boy" : h.satir.toplamAgirlikKg != null ? "Kg" : "Adet",
      toplamAgirlikKg: h.satir.toplamAgirlikKg,
      not: h.satir.not,
    }));

    const pdf = await renderPurchaseRequestPdf({
      rows,
      meta: {
        docCode: `ORC-HM-${new Date().toISOString().slice(0, 10)}`,
        generatedAt: bugun,
        preparedBy: hazirlayan,
        filterText: suzgecMetni,
        scopeText: kapsam,
      },
      company: {
        company: ayarlar.company,
        address: ayarlar.address ?? "",
        phone: ayarlar.phone,
        email: ayarlar.email,
        web: ayarlar.web,
      },
    });

    const ad = `${COMPANY_NAME} - HAMMADDE TALEBİ - ${bugun}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ————————————————————————————————————————————————————————————— EXCEL
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  const ws = wb.addWorksheet("Hammadde Havuzu", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const basSatir = writeTitleBlock(ws, "HAMMADDE TALEP HAVUZU", SUTUNLAR.length, {
    prefix: COMPANY_NAME,
    meta: [
      bugun,
      kapsam,
      `Süzgeç: ${suzgecMetni}`,
      veri.havuz.belirsizKalem > 0 ? `${veri.havuz.belirsizKalem} kalemde adet belirsiz` : "",
      hazirlayan && `Hazırlayan: ${hazirlayan}`,
    ],
  });

  const baslik = ws.getRow(basSatir);
  SUTUNLAR.forEach((s, i) => (baslik.getCell(i + 1).value = s));
  styleHeaderRow(baslik, SUTUNLAR.length);

  ws.views = [{ state: "frozen", ySplit: basSatir }];
  ws.autoFilter = {
    from: { row: basSatir, column: 1 },
    to: { row: basSatir + hazir.length, column: SUTUNLAR.length },
  };

  let r = basSatir;
  for (const h of hazir) {
    r += 1;
    const row = ws.getRow(r);
    const s = h.satir;
    const isler = [...new Set(s.paylar.map((p) => p.itemNo).filter(Boolean))];
    const kalinlik = s.parcalar.find((p) => p.kalinlikMm != null)?.kalinlikMm ?? null;

    row.getCell(1).value = isler.join(", ") || YOK;
    row.getCell(2).value = HAMMADDE_ADLARI[s.sinif];
    row.getCell(3).value = s.tanim;
    row.getCell(4).value = s.kesitKodu || YOK;
    row.getCell(5).value = s.kalite || YOK;
    row.getCell(6).value = kalinlik ?? YOK;
    row.getCell(7).value = s.toplamAlanMm2 == null ? YOK : Number((s.toplamAlanMm2 / 1e6).toFixed(2));
    // METRE AĞIRLIĞININ KAYNAĞI YAZILIR: tablodan mı geldi, geometriden mi
    // hesaplandı — satın alma tonaj üzerinden pazarlık ediyor ve %1'lik bir
    // farkın nereden geldiğini bilmeli.
    row.getCell(8).value =
      s.kgPerM == null
        ? YOK
        : `${s.kgPerM.toFixed(2)}${s.agirlikKaynagi === "geometri" ? " (hesap)" : ""}`;
    row.getCell(9).value = s.toplamBoyMm == null ? YOK : Number((s.toplamBoyMm / 1000).toFixed(2));
    row.getCell(10).value = s.stokBoyuMm ?? YOK;
    row.getCell(11).value =
      s.boyAdedi == null ? YOK : s.boyuAsanParca > 0 ? `${s.boyAdedi} (+${s.boyuAsanParca} uzun)` : s.boyAdedi;
    row.getCell(12).value = s.parcaAdedi || YOK;
    row.getCell(13).value = s.toplamAgirlikKg == null ? YOK : Number(s.toplamAgirlikKg.toFixed(2));
    row.getCell(14).value = h.siparisEdilen > 0 ? h.siparisEdilen : YOK;
    row.getCell(15).value = h.teklif?.eur == null ? YOK : Number(h.teklif.eur.toFixed(2));
    row.getCell(16).value = h.teklif?.supplier || YOK;
    row.getCell(17).value =
      [...new Set(s.parcalar.map((p) => p.groupName).filter(Boolean))].join(" · ") || YOK;
    row.getCell(18).value = [s.not, ...s.eksikler].filter(Boolean).join(" · ") || YOK;
    row.getCell(19).value = h.durum;

    for (const c of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
      row.getCell(c).alignment = { horizontal: "right" };
    }
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
  }

  // KESİM LİSTESİ AYRI BİR SAYFADIR: satınalmacı stok kalemine bakar, atölye
  // parçaya. İkisini tek sayfaya koymak, sipariş satırlarının arasına yüzlerce
  // kesim satırı sokmak olurdu.
  const ws2 = wb.addWorksheet("Kesim Listesi", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const KESIM_SUTUNLARI = [
    "Stok Kalemi",
    "Parça",
    "İş Kalemi",
    "Kullanıldığı Yer",
    "Kalınlık",
    "En",
    "Boy",
    "Ø Dış",
    "Ø İç",
    "Resimde",
    "× Adet",
    "Gereken",
    "Birim kg",
  ];
  const bas2 = writeTitleBlock(ws2, "KESİM LİSTESİ", KESIM_SUTUNLARI.length, {
    prefix: COMPANY_NAME,
    meta: [bugun, kapsam],
  });
  const b2 = ws2.getRow(bas2);
  KESIM_SUTUNLARI.forEach((s, i) => (b2.getCell(i + 1).value = s));
  styleHeaderRow(b2, KESIM_SUTUNLARI.length);
  ws2.views = [{ state: "frozen", ySplit: bas2 }];

  let r2 = bas2;
  for (const h of hazir) {
    for (const p of h.satir.parcalar) {
      r2 += 1;
      const row = ws2.getRow(r2);
      row.getCell(1).value = h.satir.tanim;
      row.getCell(2).value = p.tanim;
      row.getCell(3).value = p.itemNo || YOK;
      row.getCell(4).value = p.groupName || YOK;
      row.getCell(5).value = p.kalinlikMm ?? YOK;
      row.getCell(6).value = p.enMm ?? YOK;
      row.getCell(7).value = p.boyMm ?? YOK;
      row.getCell(8).value = p.disCapMm ?? YOK;
      row.getCell(9).value = p.icCapMm ?? YOK;
      row.getCell(10).value = p.birimAdet ?? YOK;
      row.getCell(11).value = p.carpan;
      row.getCell(12).value = p.adet ?? YOK;
      row.getCell(13).value = p.birimAgirlikKg == null ? YOK : Number(p.birimAgirlikKg.toFixed(3));
      for (const c of [5, 6, 7, 8, 9, 10, 11, 12, 13]) {
        row.getCell(c).alignment = { horizontal: "right" };
      }
    }
  }

  if (veri.havuz.belirsizKalem > 0) {
    r += 2;
    const not = ws.getRow(r);
    not.getCell(1).value =
      `UYARI: ${veri.havuz.belirsizKalem} kalemde iş kalemi adedi girilmemiş; ` +
      `çarpan 1 kabul edilmiştir. Doğru adet için İşler → iş kalemi → Resim Çarpanı kartını doldurun.`;
    not.getCell(1).font = { italic: true, size: 9 };
  }

  autoWidth(ws);
  autoWidth(ws2);

  const buf = await wb.xlsx.writeBuffer();
  const ad = `${COMPANY_NAME} - HAMMADDE TALEP HAVUZU - ${bugun}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Cache-Control": "no-store",
    },
  });
}
