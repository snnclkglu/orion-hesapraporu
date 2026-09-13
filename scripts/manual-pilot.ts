// 0026'nın salt okunur denetim kaydından yeni tasarım örneği üretir.
import fs from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { withManualDefaults, allBlocks } from "../src/lib/manual/payload";
import { modernizeManualContent } from "../src/lib/manual/rich-content";
import { ManualPdf } from "../src/lib/pdf/manual";
import { manualAssetsFor } from "../src/lib/manual/asset-bytes";
import { manualUsedAssetKeys, manualAssetRatios } from "../src/lib/manual/assets";
import { buildManualDocumentPlan } from "../src/lib/manual/document-plan";
import { calcInputFromRevision } from "../src/lib/revision-load";
import { runCalc } from "../src/lib/calc/engine";
import { diagramsForSection } from "../src/lib/diagrams/select";
import { sectionUpdate } from "../src/lib/manual/edit-ops";
import type { ManualSection } from "../src/lib/manual/types";

async function main() {
  const path="tmp/manual-redesign", live=JSON.parse(fs.readFileSync(`${path}/0026-live.json`,"utf8"));
  let payload=modernizeManualContent(withManualDefaults(live.revision.payload));
  const calc=[...live.calculations].filter(r=>r.status==="issued").sort((a,b)=>b.rev_no-a.rev_no)[0];
  if(calc){
    const input=calcInputFromRevision(calc.inputs,calc.selections), result=runCalc(input);
    const diagram=diagramsForSection("main","2.1",input,result)[0];
    const find=(sections:ManualSection[]):ManualSection|undefined=>{for(const s of sections){if(s.key==="tanim.anaParcalar")return s;const child=find(s.children);if(child)return child;}};
    const section=find(payload.sections);
    if(diagram && section)payload={...payload,sections:sectionUpdate(payload.sections,section.id,s=>({...s,blocks:[...s.blocks,{id:"pilot-0026-reeving",kind:"diagram",diagramKey:"main:2.1",diagram:{...diagram,els:diagram.els as unknown[]},caption:`Halat donanımı şeması · 0026 hesap raporu R${String(calc.rev_no).padStart(2,"0")} kaynağından. Ölçekli imalat resmi değildir.`}]}))};
  }
  fs.writeFileSync(`${path}/0026-pilot.json`,JSON.stringify({...live,payload},null,2));
  const props={payload,sources:live.sources,images:manualAssetsFor(manualUsedAssetKeys(allBlocks(payload.sections))),projectTitle:live.project.name,docCode:"ORC-BK-0026-01-R02",docLine:"ORION CRANES · İŞLETME VE BAKIM EL KİTABI",bandLines:["V2 · İNCELEME TASLAĞI"]};
  const plan=buildManualDocumentPlan({...props,ratios:manualAssetRatios()});
  fs.writeFileSync(`${path}/0026-plan.json`,JSON.stringify({...plan,pageNumbers:Object.fromEntries(plan.pageNumbers)},null,2));
  const pdf=await renderToBuffer(ManualPdf(props));fs.writeFileSync(`${path}/0026-after-body.pdf`,pdf);
  console.log(JSON.stringify({pages:plan.pages.length,bytes:pdf.length,blocks:allBlocks(payload.sections).length,output:`${path}/0026-after-body.pdf`}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
