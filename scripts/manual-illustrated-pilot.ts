import fs from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { ManualPdf } from "../src/lib/pdf/manual";
import { illustrateManualContent } from "../src/lib/manual/illustrated-content";
import { allBlocks, withManualDefaults } from "../src/lib/manual/payload";
import { manualAssetsFor } from "../src/lib/manual/asset-bytes";
import { manualUsedAssetKeys, manualAssetRatios } from "../src/lib/manual/assets";
import { buildManualDocumentPlan } from "../src/lib/manual/document-plan";
import { pdfEkleriYerlestir } from "../src/lib/pdf/merge";
import { MANUAL_APPENDIX_LABELS, type ManualAppendixKind } from "../src/lib/manual/types";

async function main(){
  const out="tmp/manual-compare";
  const original=JSON.parse(fs.readFileSync(process.argv.includes("--installed")?"tmp/manual-compare/0026-installed.json":fs.existsSync("tmp/manual-compare/0026-current.json")?"tmp/manual-compare/0026-current.json":"tmp/manual-redesign/0026-pilot.json","utf8"));
  const payload=illustrateManualContent(withManualDefaults(original.payload));
  fs.writeFileSync(`${out}/0026-illustrated.json`,JSON.stringify({...original,payload},null,2));
  const props={payload,sources:original.sources,images:manualAssetsFor(manualUsedAssetKeys(allBlocks(payload.sections))),projectTitle:original.project.name,docCode:`ORC-BK-0026-01-R${String(original.revision.rev_no).padStart(2,"0")}`,docLine:"İŞLETME VE BAKIM EL KİTABI",bandLines:["GÖRSEL TASARIM ÇALIŞMASI · TEKNİK İNCELEME TASLAĞI"]};
  const plan=buildManualDocumentPlan({...props,ratios:manualAssetRatios()});
  fs.writeFileSync(`${out}/0026-illustrated-plan.json`,JSON.stringify({...plan,pageNumbers:Object.fromEntries(plan.pageNumbers)},null,2));
  const bytes=await renderToBuffer(ManualPdf(props));
  fs.writeFileSync(`${out}/0026-gorsel-el-kitabi.pdf`,bytes);
  const pdf=await PDFDocument.load(bytes), sample=await PDFDocument.create();
  const selected=[0,...["guide-crane","guide-lifting","guide-lift-steps","guide-hook"].map(id=>plan.pages.findIndex(page=>page.items.some(item=>item.kind==="text"&&item.id===id)||page.items.some(item=>item.kind==="media"&&item.media.diagramKey===`manual:${id.slice(6)}`)))].filter(n=>n>=0);
  for(const p of await sample.copyPages(pdf,[...new Set(selected)]))sample.addPage(p);
  fs.writeFileSync(`${out}/0026-ornek-sayfalar.pdf`,await sample.save());
  console.log(JSON.stringify({pages:plan.pages.length,bytes:bytes.length,samplePages:selected.map(n=>n+1),blocks:allBlocks(payload.sections).length}));
  // Yerleşim regresyonu: önceki doğrulanmış gerçek ekleri aynı birleştiricide
  // kullanır. Bu dosya canlı kaynakların tekrar indirildiği iddiasını taşımaz.
  if(process.argv.includes('--cached-appendices')){
    const manifest=JSON.parse(fs.readFileSync('tmp/manual-redesign/0026-manifest-full.json','utf8'));
    const parts=manifest.appendices as {kind:ManualAppendixKind;pages:number}[];
    const previous=await PDFDocument.load(fs.readFileSync('tmp/manual-redesign/0026-integrated-after-full.pdf'));
    let cursor=previous.getPageCount()-parts.reduce((n,p)=>n+p.pages+1,0);
    const appendices=[];
    for(const [i,part] of parts.entries()){
      cursor++;const file=await PDFDocument.create();
      for(const page of await file.copyPages(previous,Array.from({length:part.pages},(_,j)=>cursor+j)))file.addPage(page);
      cursor+=part.pages;
      appendices.push({ad:MANUAL_APPENDIX_LABELS[part.kind],bytes:await file.save(),sectionLabel:`EK-${String.fromCharCode(65+i)}`});
    }
    const fullProps={...props,includedAppendices:parts.map(p=>p.kind),appendixPageCounts:Object.fromEntries(parts.map(p=>[p.kind,p.pages])),deferFolio:true,bandLines:['YERLEŞİM KONTROLÜ · ÖNCEKİ ÇIKTININ EKLERİ · TEKNİK ŞARTNAME EKSİK']};
    const base=await renderToBuffer(ManualPdf(fullProps));
    const combined=await pdfEkleriYerlestir(base,appendices,{finalFolio:true});
    if(combined.atlananlar.length)throw new Error('Ek birleştirme denetimi başarısız.');
    fs.writeFileSync(`${out}/0026-ekli-yerlesim-kontrolu.pdf`,combined.bytes);
    console.log(JSON.stringify({appendices:combined.eklenen,appendixPages:combined.eklenenSayfa,totalPages:(await PDFDocument.load(combined.bytes)).getPageCount()}));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
