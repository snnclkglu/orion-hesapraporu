import { notFound } from "next/navigation";
import {
  CostTemplatesView,
  type CostTemplateRow,
} from "@/app/(app)/offers/tanimlar/maliyet/cost-templates-view";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

const CRANE_TYPES = [
  "ÇİFT KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ",
  "TEK KİRİŞLİ GEZER KÖPRÜLÜ VİNÇ",
  "MONORAY VİNÇ",
  "PORTAL VİNÇ",
  "YARI PORTAL VİNÇ",
  "KALDIRMA KİRİŞİ",
];

const TEMPLATES: CostTemplateRow[] = [
  {
    id: "preview-template",
    crane_type: CRANE_TYPES[0],
    sort: 0,
    active: true,
    skeleton: {
      groupKeys: ["fabrication", "steel", "hoist", "travel", "electrical", "assembly"],
      closedLines: { steel: ["railA"] },
      customLines: {
        steel: [
          {
            key: "sablon-12345678-abcd-4abc-8abc-1234567890ab",
            label: "GALVANİZ KAPLAMA",
            unit: "kg",
          },
        ],
      },
    },
  },
];

export default function CostTemplatesPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="grid min-h-dvh min-w-0 gap-4 p-4 lg:p-8">
      <PageHeader
        kicker="TEKLİF"
        title="Maliyet Şablonları"
        hint="Hangi vinç tipinde hangi maliyet bölümleri ve kalemleri açılır."
      />
      <CostTemplatesView preview craneTypes={CRANE_TYPES} templates={TEMPLATES} />
    </main>
  );
}
