// HAMMADDE HAVUZU — sunucu tarafı okuma katmanı.
//
// EKİPMAN HAVUZUNUN AYNADAKİ GÖRÜNTÜSÜ. `purchasing/data.ts` defterin SATIN
// ALMA yarısını okur (`kind = 'satinalma'` VEYA kodsuz satır); bu dosya tam
// olarak ÖTEKİ yarıyı okur — kodu olan imalat satırlarını. İkisi birlikte
// defteri artıksız böler ve hiçbir satır iki havuzda birden görünmez.
//
// ═════════════════════════════════════════════════ NEDEN AYRI DOSYA
//
// `purchasing/__tests__/purchasing-split.test.ts` `purchasing/data.ts`in
// KAYNAĞINI okuyup oradaki İLK `.or("…")` dizgisini `kind.eq.satinalma,
// part_code.eq.` ile karşılaştırıyor. Hammadde okumasını o dosyaya ikinci bir
// sorgu olarak yazmak korumanın ya kendisini ya anlamını bozardı. Ayrı dosya
// bir tercih değil, var olan bir korumanın gereğidir.
//
// SORGU DAR TUTULUR: yalnız CANLI paketlerin imalat satırları okunur ve
// sayfalama `tumSatirlar` ile yapılır (sıralamasız `range` satır kaybettirir —
// `purchasing/data.ts`in öğrendiği ders).

import type { SupabaseClient } from "@supabase/supabase-js";
import { tumSatirlar } from "../../drawings/data";
import {
  anaGrupAdaylari,
  anaGrupKodu,
  genelKompleAdi,
  genelKompleMu,
  normalizeTanim,
} from "@/lib/drawings/normalize";
import { drawingCarpani, type KalemAdedi } from "@/lib/purchasing/demand";
import {
  hammaddeHavuzu,
  ozetiKur,
  ozetle,
  type HammaddeHavuzu,
  type HammaddeKaynagi,
  type HammaddePaketi,
  type HammaddeSatiri,
} from "@/lib/purchasing/hammadde/havuz";
import { hammaddeSinifiMi, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { trKatla } from "@/lib/drawings/tr-text";

// ————————————————————————————————————————————————————————————— paketler

interface PaketSatiri {
  id: string;
  folder_name: string;
  item_no: string;
  job_id: string | null;
  job_item_id: string | null;
  group_code: string;
  description: string;
  jobs: {
    job_no: string;
    title: string;
    customer: string;
    customers: { short_name: string } | null;
  } | null;
}

const PAKET_ALANLARI =
  "id, folder_name, item_no, job_id, job_item_id, group_code, description, " +
  "jobs (job_no, title, customer, customers (short_name))";

/** Süperse paket havuza girmez (ekipman havuzuyla aynı kural). */
const CANLI_DURUMLAR = ["aktif", "yuklendi"];

// —————————————————————————————————————————————————————————— parça satırı

interface ParcaSatiri {
  package_id: string;
  part_code: string;
  parent_code: string;
  kind: string;
  name: string;
  description: string;
  assembly_title: string;
  material: string;
  category: string;
  qty: number | null;
  cut_length_mm: number | null;
}

/**
 * `category` SÜTUNU BURADA ZORUNLUDUR.
 *
 * Ekipman havuzu onu hiç okumuyor ve okumasına gerek de yok. Hammaddede ise
 * kesim yöntemi (`Plazma` · `Lazer` · `Makas`) bir parçanın PLAKADAN çıktığını
 * adından daha güvenilir söyler: `KAPAK-1 30x190x190` adında "sac" geçmez ama
 * kategorisi geçer.
 */
const PARCA_ALANLARI =
  "package_id, part_code, parent_code, kind, name, description, " +
  "assembly_title, material, category, qty, cut_length_mm";

/** İMALAT satırının tanımı — ekipman süzgecinin tam tersi. */
const IMALAT_TURLERI = ["imalat", "bilinmiyor"];

// ————————————————————————————————————————————————————————————— sonuç

export interface HammaddeVerisi {
  havuz: HammaddeHavuzu;
  paketler: { id: string; label: string; itemNo: string; jobNo: string; customer: string }[];
  /** Düzeltme defteri okunabildi mi (migration uygulandı mı)? */
  defterVar: boolean;
}

export async function loadHammaddeHavuzu(
  supabase: SupabaseClient,
  secenekler: { jobIds?: readonly string[] } = {}
): Promise<HammaddeVerisi> {
  // ————————————————————————————————— 1. canlı paketler
  let paketSorgu = supabase.from("drawing_packages").select(PAKET_ALANLARI);
  if (secenekler.jobIds && secenekler.jobIds.length > 0) {
    paketSorgu = paketSorgu.in("job_id", secenekler.jobIds as string[]);
  }
  const { data: paketVerisi } = await paketSorgu.in("status", CANLI_DURUMLAR).order("item_no");
  const paketSatirlari = (paketVerisi ?? []) as unknown as PaketSatiri[];

  // ————————————————————————————————— 2. iş kalemi adetleri (çarpan)
  //
  // ZENGİN + DAR (md. 21): `qty`/`shares_drawings_with` olmayabilir; sütunu
  // isteyen bir `select` bütün sorguyu düşürür ve havuz hiç görünmezdi.
  let kalemVerisi: unknown[] | null = null;
  let carpanSutunlariVar = true;
  {
    const zengin = await supabase
      .from("job_items")
      .select("id, item_no, product_name, qty, shares_drawings_with");
    if (zengin.error) {
      carpanSutunlariVar = false;
      kalemVerisi = (await supabase.from("job_items").select("id, item_no, product_name")).data;
    } else {
      kalemVerisi = zengin.data;
    }
  }
  const urunAdlari = new Map(
    ((kalemVerisi ?? []) as Record<string, unknown>[]).map((r) => [
      String(r.id),
      String(r.product_name ?? ""),
    ])
  );
  const kalemler: KalemAdedi[] = ((kalemVerisi ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    itemNo: String(r.item_no ?? ""),
    qty: carpanSutunlariVar && r.qty != null ? Number(r.qty) : null,
    sharesWith: carpanSutunlariVar ? ((r.shares_drawings_with as string | null) ?? null) : null,
  }));

  // ————————————————————————————————— 3. ana grup adı defteri
  const { data: grupVerisi } = await supabase
    .from("drawing_group_names")
    .select("group_code, name");
  const grupAdlari = new Map(
    ((grupVerisi ?? []) as { group_code: string; name: string }[]).map((g) => [g.group_code, g.name])
  );
  const bilinenGruplar = new Set(grupAdlari.keys());

  // ————————————————————————————————— 4. düzeltme defteri
  const defter = await supabase
    .from("purchase_raw_meta")
    .select("match_key, kind, label_override, stock_length_mm, excluded, note");
  const defterVar = !defter.error;
  const kayitlar = (defter.data ?? []) as {
    match_key: string;
    kind: string | null;
    label_override: string | null;
    stock_length_mm: number | null;
    excluded: boolean;
    note: string | null;
  }[];

  const sinifDuzeltmeleri = new Map<string, HammaddeSinifi>();
  const etiketDuzeltmeleri = new Map<string, string>();
  const notlar = new Map<string, string>();
  const haricler = new Set<string>();
  const stokBoylari = new Map<string, number>();
  for (const r of kayitlar) {
    if (r.kind && hammaddeSinifiMi(r.kind)) sinifDuzeltmeleri.set(r.match_key, r.kind);
    if (r.label_override?.trim()) etiketDuzeltmeleri.set(r.match_key, r.label_override.trim());
    if (r.note?.trim()) notlar.set(r.match_key, r.note.trim());
    if (r.excluded) haricler.add(r.match_key);
    if (r.stock_length_mm != null) stokBoylari.set(r.match_key, Number(r.stock_length_mm));
  }

  // ————————————————————————————————— 5. paket künyeleri + çarpanlar
  const havuzPaketleri: HammaddePaketi[] = [];
  const paketKunyeleri: HammaddeVerisi["paketler"] = [];
  const paketUrunAdlari = new Map<string, string>();

  for (const p of paketSatirlari) {
    paketUrunAdlari.set(
      p.id,
      (p.job_item_id ? urunAdlari.get(p.job_item_id) : "") || p.description || ""
    );
    const c = drawingCarpani(p.job_item_id, p.item_no, kalemler);
    const label =
      [p.group_code, p.description].filter(Boolean).join(" · ") || p.folder_name || p.item_no;
    paketKunyeleri.push({
      id: p.id,
      label,
      itemNo: p.item_no,
      jobNo: p.jobs?.job_no ?? "",
      customer: p.jobs?.customers?.short_name || p.jobs?.customer || "",
    });
    havuzPaketleri.push({
      packageId: p.id,
      label,
      itemNo: p.item_no,
      jobNo: p.jobs?.job_no ?? "",
      jobTitle: p.jobs?.title ?? "",
      customer: p.jobs?.customers?.short_name || p.jobs?.customer || "",
      carpan: c.carpan,
      carpanBelirsiz: c.belirsiz || !carpanSutunlariVar,
    });
  }

  // ————————————————————————————————— 6. imalat satırları
  const paketIdleri = paketSatirlari.map((p) => p.id);
  const kaynaklar: HammaddeKaynagi[] = [];
  if (paketIdleri.length > 0) {
    const ham = await tumSatirlar<ParcaSatiri>((bas, son) =>
      supabase
        .from("drawing_parts")
        .select(PARCA_ALANLARI)
        .in("package_id", paketIdleri)
        // `isPurchaseRow`un TERSİ: kodu OLAN, satın alma olmayan satır.
        .in("kind", IMALAT_TURLERI)
        .neq("part_code", "")
        // SIRALAMASIZ SAYFALAMA BİR HATADIR (ekipman havuzunun dersi).
        .order("id")
        .range(bas, son)
    );

    for (const r of ham) {
      const grupCoz = (kod: string): string => {
        const k = (kod ?? "").trim();
        if (!k) return "";
        if (bilinenGruplar.has(k)) return k;
        if (genelKompleMu(k)) return k;
        return anaGrupKodu(k, bilinenGruplar) || anaGrupAdaylari(k).find(genelKompleMu) || "";
      };
      const groupCode = grupCoz(r.part_code ?? "") || grupCoz(r.parent_code ?? "");
      const defterAdi = groupCode ? grupAdlari.get(groupCode) : undefined;
      const groupName =
        defterAdi ??
        (r.assembly_title
          ? normalizeTanim(r.assembly_title).tanim
          : genelKompleMu(groupCode)
            ? genelKompleAdi(paketUrunAdlari.get(r.package_id))
            : "");

      kaynaklar.push({
        packageId: r.package_id,
        // Anahtar parça KODUDUR: hammadde satırlarının hepsinin kodu vardır
        // (kodsuz olan zaten ekipman havuzuna gider).
        partKey: r.part_code,
        partCode: r.part_code,
        tanim: (r.description || r.name || "").trim(),
        malzeme: r.material ?? "",
        kategori: r.category ?? "",
        kind: r.kind ?? "",
        qty: r.qty,
        // KESİM BOYU BİR ADET KANITIDIR (`adediCoz`): `Item QTY` sütunu
        // olmayan sayfalarda defterin adedi boş kalır ama toplam boy durur.
        kesimBoyuMm: r.cut_length_mm == null ? null : Number(r.cut_length_mm),
        groupCode,
        groupName,
      });
    }
  }

  const havuz = hammaddeHavuzu(havuzPaketleri, kaynaklar, {
    sinifDuzeltmeleri,
    etiketDuzeltmeleri,
    notlar,
    haricler,
  });

  // ————————————————————————————————— 7. stok boyu düzeltmeleri
  //
  // Boy DEĞİŞİNCE "kaç boy" da değişir; sayı çekirdekte yeniden türetilir,
  // ekranda düzeltilmez (iki yerde hesaplanan bir sayı bir gün ayrışır).
  if (stokBoylari.size > 0) {
    for (const s of havuz.satirlar) {
      const boy = stokBoylari.get(s.kaynakAnahtar);
      if (boy == null) continue;
      s.stokBoyuMm = boy;
      ozetle(s);
    }
  }

  // ————————————————————————————————— 8. elle açılan talepler
  const manuel = await loadRawManual(supabase);
  if (manuel.length > 0) havuz.satirlar.push(...manuel);

  const son = ozetiKur(havuz.satirlar, havuz.kaynakSatiri);
  return { havuz: son, paketler: paketKunyeleri, defterVar };
}

// ═══════════════════════════════════════════════ elle açılan hammadde talebi

interface ManuelSatir {
  id: string;
  match_key: string;
  sample: string;
  kind: string;
  item_no: string;
  section_code: string;
  quality: string;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  outer_dia_mm: number | null;
  inner_dia_mm: number | null;
  qty: number | null;
  unit: string;
  weight_kg: number | null;
  note: string;
}

/**
 * Elle açılan talepler havuza EK SATIR olarak katılır.
 *
 * `drawing_parts`a DOKUNULMAZ: bu satırların hiçbir teknik resmi yoktur ve
 * bir sonraki eşleştirmede silinip yeniden kurulacak bir tabloya yazmak onları
 * kaybetmek olurdu (`purchase_manual_demands` deseninin aynısı).
 */
export async function loadRawManual(supabase: SupabaseClient): Promise<HammaddeSatiri[]> {
  const { data, error } = await supabase
    .from("purchase_raw_manual")
    .select(
      "id, match_key, sample, kind, item_no, section_code, quality, thickness_mm, width_mm, " +
        "length_mm, outer_dia_mm, inner_dia_mm, qty, unit, weight_kg, note"
    )
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) return [];

  return ((data ?? []) as unknown as ManuelSatir[]).map((m) => {
    const sinif: HammaddeSinifi = hammaddeSinifiMi(m.kind) ? m.kind : "DIGER";
    const adet = m.qty != null ? Number(m.qty) : null;
    const agirlik = m.weight_kg != null ? Number(m.weight_kg) : null;
    const boy = m.length_mm != null ? Number(m.length_mm) : null;
    const satir: HammaddeSatiri = {
      key: m.match_key,
      kaynakAnahtar: m.match_key,
      tanim: m.sample,
      sinif,
      kesitKodu: m.section_code,
      kalite: m.quality,
      kgPerM: null,
      agirlikKaynagi: agirlik == null ? "yok" : "geometri",
      celikVarsayildi: true,
      parcaSayisi: 1,
      parcaAdedi: adet ?? 0,
      toplamBoyMm: boy != null && adet != null ? boy * adet : boy,
      boyAdedi: null,
      boyuAsanParca: 0,
      stokBoyuMm: null,
      toplamAlanMm2: null,
      toplamAgirlikKg: agirlik,
      parcalar: [
        {
          packageId: "",
          partKey: `MANUEL:${m.id}`,
          partCode: "",
          tanim: m.sample,
          itemNo: m.item_no,
          jobNo: "",
          customer: "",
          groupName: "Elle açılan talep",
          birimAdet: adet,
          carpan: 1,
          adet,
          kalinlikMm: m.thickness_mm != null ? Number(m.thickness_mm) : null,
          enMm: m.width_mm != null ? Number(m.width_mm) : null,
          boyMm: boy,
          disCapMm: m.outer_dia_mm != null ? Number(m.outer_dia_mm) : null,
          icCapMm: m.inner_dia_mm != null ? Number(m.inner_dia_mm) : null,
          birimAgirlikKg: agirlik != null && adet ? agirlik / adet : null,
          payUygulandi: false,
          eksikler: [],
        },
      ],
      paylar: m.item_no
        ? [
            {
              packageId: "",
              packageLabel: "Elle açılan talep",
              itemNo: m.item_no,
              jobNo: "",
              jobTitle: "",
              customer: "",
              parcaAdedi: adet ?? 0,
              boyMm: boy,
              agirlikKg: agirlik,
            },
          ]
        : [],
      isSayisi: m.item_no ? 1 : 0,
      carpanBelirsiz: false,
      eksikler: [],
      payUygulandi: false,
      not: m.note ?? "",
      manualId: m.id,
    };
    return satir;
  });
}

/** Stok kalemi adından anahtar — action'lar ve okuma AYNI yolu kullanır. */
export function stokAnahtarla(tanim: string): { key: string; tanim: string } {
  const temiz = tanim.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
  return { key: trKatla(temiz), tanim: temiz };
}
