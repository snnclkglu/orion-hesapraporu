import { describe, expect, it } from "vitest";
import { allBlocks, manualFromTemplate, withManualDefaults } from "../payload";
import { illustrateManualContent } from "../illustrated-content";
import { MANUAL_ILLUSTRATIONS, manualIllustration } from "../illustrations";
import { buildManualDocumentPlan } from "../document-plan";
import { blockMedia } from "../rich-content";
import { manualContentIssues } from "../quality";
import { renderToBuffer } from "@react-pdf/renderer";
import { ManualPdf } from "../../pdf/manual";
import { extractText } from "unpdf";

describe("Görsel anlatım paketi",()=>{
  it("kimlikleri ve elle değiştirilen içeriği korur; tekrar uygulanmaz",()=>{
    const old=manualFromTemplate({product:"VİNÇ"});old.sections[0].hidden=true;
    old.sections[1].children[0].blocks.push({id:"my-block",kind:"text",text:"ÖZEL TALİMAT",edited:true});
    const next=illustrateManualContent(old),ids=new Set(allBlocks(next.sections).map(b=>b.id));
    expect(allBlocks(old.sections).every(b=>ids.has(b.id))).toBe(true);
    expect(allBlocks(next.sections).find(b=>b.id==="my-block")).toEqual(allBlocks(old.sections).find(b=>b.id==="my-block"));
    expect(next.sections[0].hidden).toBe(true);expect(next.scope).toEqual(old.scope);
    expect(illustrateManualContent(next)).toBe(next);
    expect(withManualDefaults(next)).toEqual(next);
    expect(ids.size).toBe(allBlocks(next.sections).length);
  });
  it("çizim, işlem ve açıklamalar kayıt sonrasında korunur",()=>{
    const next=withManualDefaults(illustrateManualContent(manualFromTemplate({})));
    const drawings=allBlocks(next.sections).flatMap(blockMedia).filter(m=>m.diagramKey?.startsWith("manual:"));
    expect(drawings.length).toBeGreaterThanOrEqual(17);
    expect(drawings.every(m=>m.diagram!.els.length>0)).toBe(true);
    expect(manualContentIssues(next).filter(i=>i.blockId.startsWith("guide-"))).toEqual([]);
  });
  it("genel şemalar saf ve sayısal proje değerlerinden bağımsızdır",()=>{
    for(const key of Object.keys(MANUAL_ILLUSTRATIONS) as (keyof typeof MANUAL_ILLUSTRATIONS)[]){
      const diagram=manualIllustration(key);expect(diagram).toEqual(manualIllustration(key));
      expect(diagram.els.length).toBeGreaterThan(0);
      for(const el of diagram.els)for(const value of Object.values(el))if(typeof value==="number")expect(Number.isFinite(value)).toBe(true);
    }
  });
  it("genel kontrol talimatı donanım ve enerji izolasyonu varsaymaz",()=>{
    const text=JSON.stringify(illustrateManualContent(manualFromTemplate({})));
    expect(text).not.toContain("Pedal ve lamba test butonu");
    expect(text).not.toContain("Ana kesici vincin bütün enerjisini kesen tek anahtardır");
    expect(text).not.toContain("Bu üç sistemin herhangi biri, tek başına yükün düşmesini");
    expect(text).toContain("diğer beslemeler");
  });
  it("uzun fotoğraf açıklaması, tablo ve kısa uyarı sayfa alanından taşmaz",()=>{
    const p=illustrateManualContent(manualFromTemplate({}));
    p.sections=[{id:"long",title:"Uzun içerik",children:[],blocks:[{id:"photo",kind:"media",title:"Fotoğraf",side:"right",text:"Açıklama uzunluğu değişebilir. ".repeat(200),media:{diagram:manualIllustration("hook")}}, {id:"table",kind:"table",table:{head:["Kontrol","Açıklama"],rows:Array.from({length:40},()=>["A", "Uzun kontrol açıklaması. ".repeat(8)])}},{id:"note",kind:"note",level:"not",text:"TEK PARÇA KALAN UYARI"}]}];
    const plan=buildManualDocumentPlan({payload:p,sources:{}});
    for(const page of plan.pages.filter(p=>p.role==="body"))for(const item of page.items.filter(i=>i.x>=44&&i.y>=92&&i.y<790))expect(item.y+item.h).toBeLessThanOrEqual(790);
  });
  it("küçük şemalar PDF'de gerçek boyutta çizilir ve altlarındaki metin kaybolmaz",async()=>{
    const p=illustrateManualContent(manualFromTemplate({}));
    p.sections=p.sections.filter(s=>s.key==="kullanim").map(s=>({...s,blocks:[],children:s.children.filter(c=>c.key==="kullanim.kaldirmaSirasi")}));
    const bytes=await renderToBuffer(ManualPdf({payload:p,sources:{},images:[],docCode:"TEST",docLine:"TEST"}));
    const {text}=await extractText(new Uint8Array(bytes),{mergePages:true});
    expect(text).toContain("Her kaldırmada uygulanacak sıra");expect(text).toContain("çözmeyin");
  },20000);
});
