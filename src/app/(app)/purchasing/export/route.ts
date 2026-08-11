// Talep havuzu Excel indirmesi — EKRANDAKİ süzgeçle.
//
// `POST`TUR, `GET` DEĞİL: havuz anahtarı normalleştirilmiş TANIMDIR
// ("CIVATA M16X120 DIN 931 GALVANİZLİ") ve iki yüz kalem adres çubuğuna
// sığmaz. Aynı gerekçe paket içi indirme ucunda da yazılı.
//
// DOSYA, SATIN ALMA EKİBİNİN BUGÜNKÜ ÇALIŞMA DOSYASINI TAKLİT EDER. Sütun
// düzeni İŞ HAZIRLAMA LİSTESİ'nden alınmıştır (İş Numarası · Kategori · Tanımı
// · Ana Miktar · …) çünkü ekip o düzene alışkın ve dosyayı tedarikçiyle
// paylaşıyor. Uydurulmuş bir düzen, aracı kullanılmaz yapardı.
//
// EKRAN İLE DOSYA AYNI YERDEN OKUR: liste `loadHavuz`tan gelir, ikinci bir
// sorgu yazılmaz (Satış Takibi'nin dersi, md. 16).

import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { canSeePurchasing, tagsOf } from "@/lib/roles";
import { autoWidth, styleHeaderRow, writeTitleBlock } from "@/lib/excel/brand";
import { loadHavuz, loadSiparisler, loadTeklifler } from "../data";

export const runtime = "nodejs";

/** Boş hücrede tire: "yazılmamış" ile "sıfır" ayırt edilebilmeli. */
const YOK = "—";

const SUTUNLAR = [
  "Kategori",
  "Tanımı",
  "Ana Grup",
  "İş Numarası",
  "Malzeme",
  "Gereken Adet",
  "Sipariş Edilen",
  "Kalan",
  "Toplam kg",
  "Teklif",
  "En İyi Fiyat (€)",
  "Tedarikçi",
];

export async function POST(request: NextRequest) {
  return uret(request);
}

/** Süzgeçsiz tam liste için `GET` de kabul edilir (bağlantıyla paylaşılabilir). */
export async function GET(request: NextRequest) {
  return uret(request);
}

async function uret(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Oturum bulunamadı.", { status: 401 });

  const zengin = await supabase
    .from("profiles")
    .select("role, tags")
    .eq("id", user.id)
    .maybeSingle();
  const profil = zengin.error
    ? (await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()).data
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

  // Seçim/süzgeç ANAHTAR LİSTESİ olarak gelir: hangi satırların ekranda
  // göründüğünü istemci bilir, sunucu o listeyi yeniden hesaplamaz.
  let secilenler: string[] = [];
  if (request.method === "POST") {
    const form = await request.formData();
    secilenler = String(form.get("anahtarlar") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const veri = await loadHavuz(supabase);
  const anahtarKumesi = new Set(secilenler);
  const satirlar =
    anahtarKumesi.size > 0
      ? veri.havuz.satirlar.filter((s) => anahtarKumesi.has(s.key))
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
  const enIyi = new Map<string, { eur: number; supplier: string; sayi: number }>();
  for (const t of teklifler) {
    const mevcut = enIyi.get(t.matchKey);
    const sayi = (mevcut?.sayi ?? 0) + 1;
    // Kuru olmayan teklif YARIŞA GİRMEZ (karşılaştırılamaz); yalnız sayılır.
    if (t.unitPriceEur == null) {
      enIyi.set(t.matchKey, { eur: mevcut?.eur ?? Infinity, supplier: mevcut?.supplier ?? "", sayi });
      continue;
    }
    if (!mevcut || t.unitPriceEur < mevcut.eur) {
      enIyi.set(t.matchKey, { eur: t.unitPriceEur, supplier: t.supplier, sayi });
    } else {
      enIyi.set(t.matchKey, { ...mevcut, sayi });
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME;
  const ws = wb.addWorksheet("Talep Havuzu", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 0 }],
  });

  const bugun = new Date().toLocaleDateString("tr-TR");
  const basSatir = writeTitleBlock(ws, "SATIN ALMA TALEP HAVUZU", SUTUNLAR.length, {
    prefix: COMPANY_NAME,
    meta: [
      bugun,
      `${satirlar.length} kalem`,
      `${veri.havuz.paketSayisi} paket`,
      veri.havuz.cokIsliKalem > 0 ? `${veri.havuz.cokIsliKalem} kalem çok projeli` : "",
      veri.havuz.belirsizKalem > 0 ? `${veri.havuz.belirsizKalem} kalemde adet belirsiz` : "",
    ],
  });

  const baslik = ws.getRow(basSatir);
  SUTUNLAR.forEach((s, i) => (baslik.getCell(i + 1).value = s));
  styleHeaderRow(baslik, SUTUNLAR.length);

  // Dondurulmuş başlık: 200 satırlık listede sütun adları ekrandan çıkmamalı.
  ws.views = [{ state: "frozen", ySplit: basSatir }];
  ws.autoFilter = {
    from: { row: basSatir, column: 1 },
    to: { row: basSatir + satirlar.length, column: SUTUNLAR.length },
  };

  let r = basSatir;
  for (const s of satirlar) {
    r += 1;
    const row = ws.getRow(r);
    const sip = siparisAdet.get(s.key) ?? 0;
    const teklif = enIyi.get(s.key);
    const isler = [...new Set(s.paylar.map((p) => p.itemNo).filter(Boolean))];

    row.getCell(1).value = s.sinif;
    row.getCell(2).value = s.tanim;
    row.getCell(3).value = s.anaGruplar.join(" · ") || YOK;
    row.getCell(4).value = isler.join(", ") || YOK;
    // ÇELİŞKİ GİZLENMEZ: iki malzeme yazıldıysa ikisi de basılır (paket
    // Excel'iyle aynı kural).
    row.getCell(5).value = s.malzemeler.length > 1 ? s.malzemeler.join(" / ") : s.malzeme || YOK;
    row.getCell(6).value = s.adet ?? YOK;
    row.getCell(7).value = sip > 0 ? sip : YOK;
    row.getCell(8).value = s.adet == null ? YOK : Math.max(0, s.adet - sip);
    row.getCell(9).value = s.toplamAgirlikKg == null ? YOK : Number(s.toplamAgirlikKg.toFixed(2));
    row.getCell(10).value = teklif?.sayi ?? 0;
    row.getCell(11).value =
      teklif && Number.isFinite(teklif.eur) ? Number(teklif.eur.toFixed(2)) : YOK;
    row.getCell(12).value = teklif?.supplier || YOK;

    for (const c of [6, 7, 8, 9, 10, 11]) {
      row.getCell(c).alignment = { horizontal: "right" };
    }
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  // ADEDİ BELİRSİZ SATIR AYRICA YAZILIR. Excel'i açan kişi ekrandaki uyarıyı
  // görmez; dosyanın kendisi söylemelidir, yoksa varsayılan çarpanla üretilmiş
  // bir sayı kesin bilgi gibi okunur.
  if (veri.havuz.belirsizKalem > 0) {
    r += 2;
    const not = ws.getRow(r);
    ws.mergeCells(`A${r}:${String.fromCharCode(64 + SUTUNLAR.length)}${r}`);
    not.getCell(1).value =
      `UYARI: ${veri.havuz.belirsizKalem} kalemde iş kalemi adedi girilmemiş; ` +
      `çarpan 1 kabul edilmiştir. Doğru adet için İşler → iş kalemi → Adet alanını doldurun.`;
    not.getCell(1).font = { italic: true, size: 9 };
  }

  autoWidth(ws);

  const buf = await wb.xlsx.writeBuffer();
  const ad = `${COMPANY_NAME} - SATIN ALMA TALEP HAVUZU - ${bugun.replace(/\./g, ".")}.xlsx`;
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Cache-Control": "no-store",
    },
  });
}
