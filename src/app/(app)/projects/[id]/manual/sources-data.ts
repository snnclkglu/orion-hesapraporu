import "server-only";

// EL KİTABININ KAYNAKLARINI TOPLAR — çekirdeğin saf çözücüsünü besleyen tek
// sunucu adımı (`lib/manual/sources.ts`).
//
// DÖRT KAYNAK, TEK NESNE:
//   hesap raporu    → sınıflandırma · karakteristik · hız · ekipman listesi
//   elektrik projesi → malzeme listesi · sayfa dizini
//   Teknik Resim Takibi → resim listesi
//
// HANGİ REVİZYON OKUNUR: son YAYIMLANMIŞ revizyon; yoksa en son taslak.
// Kılavuz teslim edilen vinci anlatır ve teslim edilen hesap yayımlanmış
// olandır — ama henüz yayın yoksa taslak da bir şey söylemekten iyidir ve
// belge zaten taslak hâlindedir.
//
// BİÇİMLEYİCİ HESAP RAPORUNUNKİDİR (`fieldShownValue` · `fieldLabel` ·
// `toDisplayUnitLabel`): ikinci bir biçimleyici yazılsaydı raporda "Ø400 mm"
// olan değer el kitabında "400" olurdu ve iki belge aynı vinç için başka şey
// söylerdi.

import type { SupabaseClient } from "@supabase/supabase-js";
import { runCalc, type CalcInput } from "@/lib/calc/engine";
import { fieldLabel } from "@/lib/calc/fields";
import { toDisplayUnitLabel } from "@/lib/units";
import {
  altsFromRevision,
  calcInputFromRevision,
  hiddenSectionsFromRevision,
  type RevisionInputsJson,
  type RevisionSelectionsJson,
} from "@/lib/revision-load";
import { fieldShownValue, technicalSpecsForReport } from "@/lib/pdf/report";
import { buildEquipmentGroups } from "@/lib/excel/equipment";
import {
  loadCurrentElectricalDoc,
  loadElectricalParts,
} from "@/lib/electrical/data";
import { loadDrawingPlan, resolveProjectItemNo } from "@/lib/drawing-plan-data";
import { DRAWING_PLAN_STATUS_LABELS, fullDrawingNo } from "@/lib/drawing-plan";
import type {
  LabeledValue,
  ManualEquipmentRow,
  ManualSourceData,
} from "@/lib/manual/sources";

/**
 * Sınıflandırma tablosuna giren alanlar.
 *
 * Anahtarlar hesap motorunun kendi alan adlarıdır; liste burada durur çünkü
 * "hangi alan sınıflandırmadır" bir BELGE kararıdır, motorun değil. Motorda
 * olmayan bir anahtar sessizce düşer — alan adı değişirse tablo eksilir ama
 * yanlış değer basmaz.
 */
const SINIF_ALANLARI = [
  "structureClass",
  "hoistLoadClass",
  "hoistMechanismClass",
  "hoistUsageClass",
  "auxMechanismClass",
  "auxUsageClass",
  "mono1MechanismClass",
  "mono1UsageClass",
  "mono2MechanismClass",
  "mono2UsageClass",
  "trolleyMechanismClass",
  "trolleyUsageClass",
  "auxTrolleyMechanismClass",
  "auxTrolleyUsageClass",
  "mono1TrolleyMechanismClass",
  "mono1TrolleyUsageClass",
  "mono2TrolleyMechanismClass",
  "mono2TrolleyUsageClass",
  "bridgeMechanismClass",
  "bridgeUsageClass",
];

/** Hız çizelgesine giren alanlar — adı `Speed` ile biten her şey. */
const HIZ_DESENI = /speed/i;

function satirlar(
  defs: readonly { key: string; unit?: string }[],
  kaynak: Record<string, unknown>,
  specs: CalcInput["specs"],
  sec: (key: string) => boolean
): LabeledValue[] {
  const out: LabeledValue[] = [];
  for (const f of defs) {
    if (!sec(f.key)) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deger = fieldShownValue(f as any, kaynak);
    if (!deger || deger === "—") continue;
    const birim = toDisplayUnitLabel(f.unit);
    out.push({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: fieldLabel(f as any, specs),
      value: birim ? `${deger} ${birim}` : deger,
    });
  }
  return out;
}

/** Ekipman gruplarını el kitabının satır şekline indirger. */
function ekipmanSatirlari(
  groups: readonly { name: string; rows: readonly { component: string; brand: string; model: string; qty: number | string }[] }[]
): ManualEquipmentRow[] {
  const out: ManualEquipmentRow[] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      out.push({
        component: r.component,
        // Ekipman listesinde bilinmeyen alan "-" ile basılıyor; el kitabında
        // BOŞ kalır — "-" bir değer gibi okunuyordu.
        brand: r.brand === "-" ? "" : r.brand,
        model: r.model === "-" ? "" : r.model,
        qty: r.qty === 0 || r.qty === "-" ? "" : String(r.qty),
        group: g.name,
      });
    }
  }
  return out;
}

export async function buildManualSourceData(
  supabase: SupabaseClient,
  projectId: string
): Promise<ManualSourceData> {
  const veri: ManualSourceData = {};

  // ————————————————————————————————————————————————— hesap raporu
  const { data: revizyonlar } = await supabase
    .from("revisions")
    .select("id, rev_no, status, inputs, selections")
    .eq("project_id", projectId)
    .order("rev_no", { ascending: false });
  const liste = (revizyonlar ?? []) as Record<string, unknown>[];
  const revizyon = liste.find((r) => r.status === "issued") ?? liste[0];

  if (revizyon) {
    const calcInput = calcInputFromRevision(
      revizyon.inputs as RevisionInputsJson | null,
      revizyon.selections as RevisionSelectionsJson | null
    );
    // `runCalc` ÇAĞRILIR ama sonucu doğrudan basılmaz: motorun türettiği
    // alanlar (sınıf, hız) `specs`e geri işlendiği için tablo girdiden okunur.
    // Yine de çağrılır çünkü motor eksik girdiyi burada yakalar ve boş bir
    // tablo, hatalı bir tablodan iyidir.
    runCalc(calcInput);

    // Raporla AYNI sıralı ve zenginleştirilmiş belge yüzü: kaldırma donanımı
    // hücresi halat donanımını da taşır (örn. “Çift Tambur - 4/16”).
    const { defs, source: kaynak } = technicalSpecsForReport(calcInput);
    const sinifKumesi = new Set(SINIF_ALANLARI);

    veri.classes = satirlar(defs, kaynak, calcInput.specs, (k) => sinifKumesi.has(k));
    veri.speeds = satirlar(defs, kaynak, calcInput.specs, (k) => HIZ_DESENI.test(k));
    // KARAKTERİSTİK = GERİ KALANI. Üç tablo aynı alan listesini paylaşır ve
    // hiçbir alan iki tabloda birden görünmez; ayrı ayrı seçilmiş üç liste
    // tutmak, motora eklenen yeni bir alanın hiçbirine düşmemesi demekti.
    veri.characteristics = satirlar(
      defs,
      kaynak,
      calcInput.specs,
      (k) => !sinifKumesi.has(k) && !HIZ_DESENI.test(k)
    );

    const alts = altsFromRevision(revizyon.selections as RevisionSelectionsJson | null);
    const gizli = hiddenSectionsFromRevision(revizyon.inputs as RevisionInputsJson | null);
    veri.equipment = ekipmanSatirlari(
      buildEquipmentGroups(calcInput, undefined, alts, undefined, gizli)
    );
  }

  // ————————————————————————————————————————————— elektrik projesi
  const elektrik = await loadCurrentElectricalDoc(supabase, projectId);
  if (elektrik) {
    veri.electricalSheets = elektrik.sheets;
    veri.electricalParts = await loadElectricalParts(supabase, elektrik.id);
  }

  // ————————————————————————————————————————— Teknik Resim Takibi
  const { data: proje } = await supabase
    .from("projects")
    .select("doc_no")
    .eq("id", projectId)
    .maybeSingle();
  const itemNo = await resolveProjectItemNo(supabase, projectId, String(proje?.doc_no ?? ""));
  const plan = await loadDrawingPlan(supabase, projectId);
  veri.drawings = plan.map((r) => ({
    no: fullDrawingNo(itemNo, r.code),
    name: r.name,
    status: DRAWING_PLAN_STATUS_LABELS[r.status] ?? r.status,
  }));

  return veri;
}
