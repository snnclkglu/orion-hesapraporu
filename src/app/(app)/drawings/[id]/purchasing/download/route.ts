// Satın alma talebi indirme — Excel ya da PDF, EKRANDAKİ SÜZGEÇLE.
//
// `POST`TUR, `GET` DEĞİL. Satın alma kalemlerinin anahtarı kodsuz satırlarda
// katlanmış TANIMDIR ("SATINALMA:YAYLI RONDELA M16 DIN127 (GALVANİZLİ)") ve
// seçili yüz kalem adres çubuğuna sığmaz — sunucu isteği reddeder ya da
// sessizce kırpar. Form gövdesi bu sınırı hiç görmez ve tarayıcı yanıtı yine
// indirir. Süzgeçsiz tam liste için `GET` de kabul edilir.
//
// SÜZGEÇ TANIMI `../../../filters.ts`TEDİR — ekranla aynı işlevler. İki yerde
// yazılsaydı indirilen dosya ile ekrandaki tablo sessizce ayrışırdı.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_NAME } from "@/lib/app";
import { docCode, downloadFileName } from "@/lib/pdf/doc-naming";
import { satinAlmaKategoriSirasi, satinAlmaListesi } from "@/lib/drawings/derive";
import {
  FALLBACK_STAGES,
  PURCHASE_STAGE_SLUG,
  RECEIVED_STAGE_SLUG,
  progressItemNo,
  purchaseStages,
  registerItemNo,
  type StageDef,
} from "@/lib/drawings/progress";
import { buildPurchasingWorkbook, type PurchasingSheetRow } from "@/lib/excel/drawing-purchasing";
import { renderPurchasingPdf, type PurchasingRowOut } from "@/lib/pdf/drawing-purchasing";
import { loadPackage, loadParts } from "../../../data";
import {
  ALL,
  matchesPurchase,
  sortPurchases,
  type PurchaseFilters,
  type PurchaseSortKey,
} from "../../../filters";
import { partToTurev } from "../../export/shared";

export const runtime = "nodejs";

const SIRALAMA_ANAHTARLARI: PurchaseSortKey[] = [
  "kategori",
  "tanim",
  "adet",
  "agirlik",
  "kod",
  "teslim",
  "durum",
];

const DURUM_ETIKETLERI: Record<string, string> = {
  bekliyor: "bekleyenler",
  alindi: "satın alınanlar",
  yolda: "yolda olanlar",
  teslim: "teslim alınanlar",
};

/** Künyeye ve dosya adına giren insan okunur süzgeç özeti. */
function suzgecMetni(f: PurchaseFilters, secimSayisi: number): string {
  if (secimSayisi > 0) return `yalnız seçili ${secimSayisi} kalem`;
  const parcalar = [
    f.query.trim() && `arama "${f.query.trim()}"`,
    f.sinif !== ALL && `kategori ${f.sinif}`,
    f.malzeme !== ALL && `malzeme ${f.malzeme}`,
    f.durum !== ALL && (DURUM_ETIKETLERI[f.durum] ?? f.durum),
  ].filter(Boolean);
  return parcalar.length ? parcalar.join(" · ") : "süzgeç yok (tüm kalemler)";
}

interface Girdi {
  f: PurchaseFilters;
  sira: PurchaseSortKey;
  ters: boolean;
  secim: Set<string>;
}

function girdiOku(kaynak: { get(ad: string): string | null }): Girdi {
  const siraHam = (kaynak.get("sira") ?? "kategori") as PurchaseSortKey;
  return {
    f: {
      query: kaynak.get("q") ?? "",
      sinif: kaynak.get("kategori") || ALL,
      malzeme: kaynak.get("malzeme") || ALL,
      durum: kaynak.get("durum") || ALL,
    },
    sira: SIRALAMA_ANAHTARLARI.includes(siraHam) ? siraHam : "kategori",
    ters: kaynak.get("ters") === "1",
    // Seçim satır satır gelir; boş satırlar atılır.
    secim: new Set(
      (kaynak.get("secim") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  };
}

async function uret(request: NextRequest, id: string, girdi: Girdi): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const paket = await loadPackage(supabase, id);
  if (!paket) return NextResponse.json({ error: "Paket bulunamadı." }, { status: 404 });

  const bicim = new URL(request.url).searchParams.get("bicim") === "pdf" ? "pdf" : "xlsx";
  const parcalar = await loadParts(supabase, id);

  // ————————————————————————————————— kategori defteri (olmayabilir)
  const [{ data: duzeltmeSatirlari }, { data: kategoriSatirlari }] = await Promise.all([
    supabase.from("drawing_purchase_overrides").select("match_key, category"),
    supabase.from("drawing_purchase_categories").select("name, sort").eq("active", true).order("sort"),
  ]);
  const duzeltmeler = new Map(
    ((duzeltmeSatirlari ?? []) as { match_key: string; category: string }[]).map((r) => [
      r.match_key,
      r.category,
    ])
  );
  const ekKategoriler = ((kategoriSatirlari ?? []) as { name: string }[]).map((r) => r.name);
  const kategoriler = satinAlmaKategoriSirasi(ekKategoriler);

  const liste = satinAlmaListesi(parcalar.map(partToTurev), { duzeltmeler, ekKategoriler });

  // ————————————————————————————————— sipariş / teslim durumu
  const asamalar: StageDef[] = purchaseStages(FALLBACK_STAGES);
  const kalemNo = registerItemNo(
    parcalar.map((p) => ({ partCode: p.part_code ?? "" })),
    paket.item_no
  );
  const kalemler = [...new Set(liste.satirlar.map((s) => progressItemNo(s.key, kalemNo)))].filter(
    Boolean
  );

  const durumlar = new Map<string, { alindi: boolean; teslim: boolean; dueAt: string }>();
  if (kalemler.length > 0) {
    const oku = (alanlar: string) =>
      supabase
        .from("drawing_part_progress")
        .select(alanlar)
        .in("item_no", kalemler)
        .in(
          "stage",
          asamalar.map((s) => s.slug)
        );
    const ilk = await oku("part_code, stage, due_at");
    let data = ilk.data;
    // `due_at` sütunu henüz yoksa dar listeye düşülür (ekranla aynı kural).
    if (ilk.error) ({ data } = await oku("part_code, stage"));
    for (const r of (data ?? []) as unknown as {
      part_code: string;
      stage: string;
      due_at?: string | null;
    }[]) {
      const d = durumlar.get(r.part_code) ?? { alindi: false, teslim: false, dueAt: "" };
      if (r.stage === PURCHASE_STAGE_SLUG) {
        d.alindi = true;
        if (r.due_at) d.dueAt = r.due_at;
      }
      if (r.stage === RECEIVED_STAGE_SLUG) d.teslim = true;
      durumlar.set(r.part_code, d);
    }
  }

  // ————————————————————————————————— süzgeç + seçim
  const zenginler = liste.satirlar.map((s) => {
    const d = durumlar.get(s.key);
    return {
      ...s,
      alindi: d?.alindi ?? false,
      teslim: d?.teslim ?? false,
      dueAt: d?.dueAt ?? "",
    };
  });

  // SEÇİM VARSA SÜZGEÇ UYGULANMAZ: kullanıcı zaten tek tek seçmiştir ve
  // üstüne bir de süzgeç işletmek, seçtiği kalemleri sessizce düşürebilirdi.
  const secilenler =
    girdi.secim.size > 0
      ? zenginler.filter((s) => girdi.secim.has(s.key))
      : zenginler.filter((s) => matchesPurchase(s, girdi.f));

  const sirali = sortPurchases(secilenler, girdi.sira, girdi.ters, kategoriler);

  // ————————————————————————————————— künye
  const { data: profil } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const baslik = [paket.description || paket.folder_name, paket.capacity && `(${paket.capacity})`]
    .filter(Boolean)
    .join(" ");
  const paketKodu = [paket.item_no, paket.group_code].filter(Boolean).join("-") || "PAKET";
  const kod = docCode("TR", paketKodu, paket.rev_no);
  const filtreMetni = suzgecMetni(girdi.f, girdi.secim.size);

  const meta = {
    paketAdi: baslik,
    belgeKodu: kod,
    klasorAdi: paket.folder_name,
    kalemNo: paket.item_no,
    generatedAt: new Date().toLocaleString("tr-TR"),
    preparedBy: (profil?.full_name as string) || user.email || "—",
  };

  const dosyaAdi = downloadFileName([baslik, kod, "SATIN ALMA TALEBİ"], bicim);

  const govde =
    bicim === "pdf"
      ? await renderPurchasingPdf({
          rows: sirali.map(
            (s): PurchasingRowOut => ({
              sinif: s.sinif,
              tanim: s.tanim,
              adet: s.adet,
              malzeme: s.malzemeler.length > 1 ? s.malzemeler.join(" / ") : s.malzeme,
              toplamAgirlikKg: s.toplamAgirlikKg,
              parcaKodu: s.parcaKodu,
              dueAt: s.dueAt,
              alindi: s.alindi,
              teslim: s.teslim,
            })
          ),
          meta: {
            packageTitle: baslik,
            folderName: paket.folder_name,
            itemNo: paket.item_no,
            groupCode: paket.group_code,
            docCode: kod,
            generatedAt: meta.generatedAt,
            preparedBy: meta.preparedBy,
            filterText: filtreMetni,
          },
          company: { company: COMPANY_NAME, address: "Başkent OSB 1. Cadde No:20, Ankara" },
        })
      : Buffer.from(
          (await buildPurchasingWorkbook(
            sirali.map(
              (s): PurchasingSheetRow => ({
                sinif: s.sinif,
                tanim: s.tanim,
                adet: s.adet,
                malzeme: s.malzeme,
                malzemeler: s.malzemeler,
                toplamAgirlikKg: s.toplamAgirlikKg,
                parcaKodu: s.parcaKodu,
                sourceRows: s.sourceRows,
                kaynak: s.kaynak,
                alindi: s.alindi,
                teslim: s.teslim,
                dueAt: s.dueAt,
              })
            ),
            meta,
            filtreMetni
          ).xlsx.writeBuffer()) as ArrayBuffer
        );

  // Content-Disposition ÇİFT yazılır: Türkçe harf taşıyan ad `filename*` ile
  // gider, ASCII yedek eski istemciler içindir.
  const asciiAd = dosyaAdi.replace(/[^\x20-\x7E]/g, "_");
  return new NextResponse(new Uint8Array(govde), {
    headers: {
      "Content-Type":
        bicim === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiAd}"; filename*=UTF-8''${encodeURIComponent(dosyaAdi)}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await request.formData();
  return uret(request, id, girdiOku({ get: (ad) => (form.get(ad) as string | null) ?? null }));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  return uret(request, id, girdiOku({ get: (ad) => q.get(ad) }));
}
