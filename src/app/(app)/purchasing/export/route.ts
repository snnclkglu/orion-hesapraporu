// Talep havuzu indirmesi — EXCEL ya da PDF, EKRANDAKİ SÜZGEÇLE.
//
// Kullanıcı kararı (md. 7): "Herhangi bir arama filtreleme yaptığımda o filtreye
// göre excel ve pdf insin. Eğer seçim yaparsam sadece o ürünler excel ve pdf
// insin."
//
// KAPSAMI İSTEMCİ SÖYLER, SUNUCU YENİDEN HESAPLAMAZ. Ekranda hangi satırların
// göründüğünü yalnız istemci bilir (çoklu süzgeç + arama + seçim); sunucuda
// aynı mantığı ikinci kez yazmak, iki listenin sessizce ayrışması demekti —
// Satış Takibi'nde öğrenilen ders (md. 16). İstemci ANAHTAR LİSTESİ gönderir.
//
// `POST`TUR, `GET` DEĞİL: havuz anahtarı normalleştirilmiş TANIMDIR
// ("CIVATA M16X120 DIN 931 GALVANİZLİ") ve iki yüz kalem adres çubuğuna sığmaz.
//
// SIRALAMA İSTEMCİDEN GELEN LİSTENİN SIRASIDIR: kullanıcı ekranı ağırlığa göre
// sıraladıysa belge de öyle inmelidir.

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { canSeePurchasing, tagsOf } from "@/lib/roles";
import { autoWidth, styleHeaderRow, writeTitleBlock } from "@/lib/excel/brand";
import { getReportSettings } from "@/lib/settings";
import { renderPurchaseRequestPdf, type PurchaseRequestRow } from "@/lib/pdf/purchase-request";
import { loadHavuz, loadSiparisler, loadTeklifler } from "../data";
import type { TalepSatiri } from "@/lib/purchasing/demand";

export const runtime = "nodejs";

/** Boş hücrede tire: "yazılmamış" ile "sıfır" ayırt edilebilmeli. */
const YOK = "—";

/** İŞ HAZIRLAMA LİSTESİ'nin sütun düzeni — ekip belgeyi bu düzende okuyor. */
const SUTUNLAR = [
  "İş Numarası",
  "Resim Numarası",
  "Kullanıldığı Yer",
  "Kategori",
  "Tanımı",
  "Kalite",
  "İç Çap (mm)",
  "Dış Çap (mm)",
  "Boy (mm)",
  "Ana Miktar",
  "Birimi",
  "Sipariş Edilen",
  "Kalan",
  "Ağırlık (Kg)",
  "Teklif",
  "En İyi Fiyat (€)",
  "Tedarikçi",
  "Not",
  "Sipariş Verildi mi?",
];

export async function POST(request: NextRequest) {
  return uret(request);
}

/** Süzgeçsiz tam liste için `GET` de kabul edilir (bağlantıyla paylaşılabilir). */
export async function GET(request: NextRequest) {
  return uret(request);
}

interface Hazir {
  satir: TalepSatiri;
  siparisEdilen: number;
  kalan: number;
  teklifSayisi: number;
  enIyiEur: number | null;
  enIyiTedarikci: string;
  durum: string;
}

async function uret(request: NextRequest) {
  const bicim = request.nextUrl.searchParams.get("bicim") === "pdf" ? "pdf" : "xlsx";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Oturum bulunamadı.", { status: 401 });

  const zengin = await supabase
    .from("profiles")
    .select("role, tags, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const profil = zengin.error
    ? (await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle())
        .data
    : zengin.data;

  // YETKİ BURADA DA SORULUR. RLS zaten keser ama boş bir Excel indirmek,
  // "yetkiniz yok" demekten çok daha kafa karıştırıcıdır.
  if (
    !canSeePurchasing({
      role: (profil as { role?: string } | null)?.role ?? "",
      tags: tagsOf((profil as { tags?: string[] } | null)?.tags),
    })
  ) {
    return new NextResponse("Bu bölüm için yetkiniz yok.", { status: 403 });
  }

  let secilenler: string[] = [];
  let suzgecMetni = "tümü";
  if (request.method === "POST") {
    const form = await request.formData();
    secilenler = String(form.get("anahtarlar") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    suzgecMetni = String(form.get("suzgec") ?? "").trim() || "tümü";
  }

  const veri = await loadHavuz(supabase);
  // SIRA İSTEMCİDEN GELİR: anahtar listesinin sırası ekranın sırasıdır.
  const havuzHaritasi = new Map(veri.havuz.satirlar.map((s) => [s.key, s]));
  const satirlar =
    secilenler.length > 0
      ? secilenler.map((k) => havuzHaritasi.get(k)).filter((s): s is TalepSatiri => Boolean(s))
      : veri.havuz.satirlar;

  const [teklifler, siparisler] = await Promise.all([
    loadTeklifler(
      supabase,
      satirlar.map((s) => s.key)
    ),
    loadSiparisler(supabase),
  ]);

  const siparisAdet = new Map<string, number>();
  for (const s of siparisler) {
    for (const l of s.satirlar) {
      siparisAdet.set(l.matchKey, (siparisAdet.get(l.matchKey) ?? 0) + l.qty);
    }
  }
  const teklifHaritasi = new Map<string, { sayi: number; eur: number | null; supplier: string }>();
  for (const t of teklifler) {
    const m = teklifHaritasi.get(t.matchKey) ?? { sayi: 0, eur: null, supplier: "" };
    m.sayi += 1;
    // Seçilmiş teklif kazanır; yoksa en ucuz AVRO. Kuru olmayan yarışa girmez.
    const dahaIyi =
      t.unitPriceEur != null && (m.eur == null || t.unitPriceEur < m.eur || t.chosen);
    if (dahaIyi) {
      m.eur = t.unitPriceEur;
      m.supplier = t.supplier;
    }
    teklifHaritasi.set(t.matchKey, m);
  }

  const hazir: Hazir[] = satirlar.map((satir) => {
    const siparisEdilen = siparisAdet.get(satir.key) ?? 0;
    const t = teklifHaritasi.get(satir.key);
    const kalan = satir.adet == null ? 0 : Math.max(0, satir.adet - siparisEdilen);
    const durum =
      satir.adet != null && satir.adet > 0 && siparisEdilen >= satir.adet
        ? "Sipariş edildi"
        : siparisEdilen > 0
          ? "Kısmi sipariş"
          : (t?.sayi ?? 0) > 0
            ? "Teklif alındı"
            : "Bekliyor";
    return {
      satir,
      siparisEdilen,
      kalan,
      teklifSayisi: t?.sayi ?? 0,
      enIyiEur: t?.eur ?? null,
      enIyiTedarikci: t?.supplier ?? "",
      durum,
    };
  });

  const kapsam =
    secilenler.length > 0
      ? `Seçili ${hazir.length} kalem`
      : `Süzgeçli liste — ${hazir.length} kalem`;
  const bugun = new Date().toLocaleDateString("tr-TR");
  const hazirlayan = (profil as { full_name?: string } | null)?.full_name ?? "";

  if (bicim === "pdf") {
    const ayarlar = await getReportSettings(supabase);
    const rows: PurchaseRequestRow[] = hazir.map((h) => ({
      sinif: h.satir.sinif,
      tanim: h.satir.tanim,
      isNolari: [...new Set(h.satir.paylar.map((p) => p.itemNo).filter(Boolean))],
      parcaKodlari: h.satir.parcaKodlari,
      kullanildigiYer: h.satir.anaGruplar.join(" · "),
      malzeme: h.satir.malzemeler.length > 1 ? h.satir.malzemeler.join(" / ") : h.satir.malzeme,
      // SİPARİŞ EDİLECEK ADET: kalan varsa o, yoksa gereken. Tedarikçiye zaten
      // aldığımız adedi sormak, iki kez sipariş vermenin ilk adımıdır.
      adet: h.kalan > 0 ? h.kalan : h.satir.adet,
      birim: h.satir.birim,
      toplamAgirlikKg: h.satir.toplamAgirlikKg,
      not: h.satir.not,
    }));

    const pdf = await renderPurchaseRequestPdf({
      rows,
      meta: {
        docCode: `ORC-SA-${new Date().toISOString().slice(0, 10)}`,
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

    const ad = `${COMPANY_NAME} - SATIN ALMA TALEBİ - ${bugun}.pdf`;
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
  const ws = wb.addWorksheet("Talep Havuzu", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const basSatir = writeTitleBlock(ws, "SATIN ALMA TALEP HAVUZU", SUTUNLAR.length, {
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

  // Dondurulmuş başlık: 200 satırlık listede sütun adları ekrandan çıkmamalı.
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

    row.getCell(1).value = isler.join(", ") || YOK;
    row.getCell(2).value = s.parcaKodlari.join(", ") || YOK;
    row.getCell(3).value = s.anaGruplar.join(" · ") || YOK;
    row.getCell(4).value = s.sinif;
    row.getCell(5).value = s.tanim;
    // ÇELİŞKİ GİZLENMEZ: iki malzeme yazıldıysa ikisi de basılır.
    row.getCell(6).value = s.malzemeler.length > 1 ? s.malzemeler.join(" / ") : s.malzeme || YOK;
    row.getCell(7).value = s.olculer.icCapMm ?? YOK;
    row.getCell(8).value = s.olculer.disCapMm ?? YOK;
    row.getCell(9).value = s.olculer.boyMm ?? YOK;
    row.getCell(10).value = s.adet ?? YOK;
    row.getCell(11).value = s.birim;
    row.getCell(12).value = h.siparisEdilen > 0 ? h.siparisEdilen : YOK;
    row.getCell(13).value = s.adet == null ? YOK : h.kalan;
    row.getCell(14).value = s.toplamAgirlikKg == null ? YOK : Number(s.toplamAgirlikKg.toFixed(2));
    row.getCell(15).value = h.teklifSayisi || YOK;
    row.getCell(16).value = h.enIyiEur == null ? YOK : Number(h.enIyiEur.toFixed(2));
    row.getCell(17).value = h.enIyiTedarikci || YOK;
    row.getCell(18).value = s.not || YOK;
    row.getCell(19).value = h.durum;

    for (const c of [7, 8, 9, 10, 12, 13, 14, 15, 16]) {
      row.getCell(c).alignment = { horizontal: "right" };
    }
    row.getCell(5).alignment = { wrapText: true, vertical: "top" };
  }

  // ADEDİ BELİRSİZ SATIR AYRICA YAZILIR: Excel'i açan kişi ekrandaki uyarıyı
  // görmez; dosyanın kendisi söylemelidir, yoksa varsayılan çarpanla üretilmiş
  // bir sayı kesin bilgi gibi okunur.
  if (veri.havuz.belirsizKalem > 0) {
    r += 2;
    const not = ws.getRow(r);
    not.getCell(1).value =
      `UYARI: ${veri.havuz.belirsizKalem} kalemde iş kalemi adedi girilmemiş; ` +
      `çarpan 1 kabul edilmiştir. Doğru adet için İşler → iş kalemi → Resim Çarpanı kartını doldurun.`;
    not.getCell(1).font = { italic: true, size: 9 };
  }

  autoWidth(ws);

  const buf = await wb.xlsx.writeBuffer();
  const ad = `${COMPANY_NAME} - SATIN ALMA TALEP HAVUZU - ${bugun}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Cache-Control": "no-store",
    },
  });
}
