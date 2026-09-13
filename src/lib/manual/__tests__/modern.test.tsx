import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { extractText } from "unpdf";
import { manualFromTemplate, withManualDefaults, allBlocks } from "../payload";
import { modernizeManualContent, manualWriteError } from "../rich-content";
import { buildManualDocumentPlan } from "../document-plan";
import { manualHistory } from "../history";
import { ManualPdf } from "../../pdf/manual";
import { manualContentIssues } from "../quality";
import { blockInsertAt, blockMove, blockRevertToTemplate } from "../edit-ops";
import type { ManualBlock } from "../types";

const fixture = () => modernizeManualContent({...manualFromTemplate({customer:"TEST",product:"TEST"}),sections:[{id:"section",key:"test",title:"Temel Güvenlik Notları ve Talimatları",blocks:[],children:[]}]});
describe("Şematik el kitabı",()=>{
  it("eski belge geçişinde kimlikleri, kapsamı ve kullanıcı metnini korur",()=>{
    const old=manualFromTemplate({customer:"TEST"});old.sections[0].blocks=[{id:"custom",kind:"text",text:"ÖZEL İŞ DETAYI",edited:true}];
    const next=modernizeManualContent(old);
    expect(next.scope).toEqual(old.scope);expect(next.identity).toEqual(old.identity);
    expect(allBlocks(next.sections).map(b=>b.id)).toEqual(allBlocks(old.sections).map(b=>b.id));
    expect(next.sections[0].blocks).toEqual(old.sections[0].blocks);
    expect(withManualDefaults(next)).toEqual(next);
  });
  it("araya blok ekleyip taşıdıktan sonra doğru standarda döner",()=>{
    const old=manualFromTemplate({});const section=old.sections[0].children[0];const original=section.blocks[0];
    let tree=blockInsertAt(old.sections,section.id,0,{id:"custom",kind:"text",text:"KORU"});
    tree=blockMove(tree,section.id,original.id,"asagi");
    const restored=blockRevertToTemplate(tree,section.id,original.id);
    expect(allBlocks(restored).find(b=>b.id==="custom")).toMatchObject({text:"KORU"});
    expect(allBlocks(restored).find(b=>b.id===original.id)).toMatchObject(original);
  });
  it("yeni türlerin kayıt döngüsü ve sürüm koruması",()=>{
    const p=fixture();p.sections[0].blocks=[{id:"p",kind:"procedure",title:"İşlem",steps:[{id:"s",text:"Adım",media:{assetKey:"ceIsareti"}}]},{id:"f",kind:"figure",title:"Şekil",media:{imageId:"photo"},markers:[{id:"m",x:0.2,y:0.7,label:"A",text:"Açıklama"}]},{id:"m",kind:"media",title:"",text:"Açıklama",side:"left",media:{assetKey:"ceIsareti"}}];
    expect(withManualDefaults(p).sections[0].blocks).toEqual(p.sections[0].blocks);
    expect(manualWriteError({...p,v:3})).toBeTruthy();expect(manualWriteError({...p,v:1})).toBeTruthy();expect(manualWriteError(p)).toBeNull();
  });
  it("gizleme silme ve birleşik içeriği geri alıp yeniden uygular",()=>{
    const p=fixture();let state={past:[],present:p,future:[]} as Parameters<typeof manualHistory>[0];
    state=manualHistory(state,{type:"set",value:{...p,sections:[]}});state=manualHistory(state,{type:"undo"});expect(state.present).toEqual(p);
    state=manualHistory(state,{type:"redo"});expect(state.present.sections).toEqual([]);
    state=manualHistory(state,{type:"set",value:p});expect(state.future).toEqual([]);
  });
  it("uzun tablo satırlarını böler, başlık tekrar eder, içerik alanından taşmaz",()=>{
    const p=fixture();p.sections[0].blocks=[{id:"t",kind:"table",table:{head:["Kod","Açıklama"],rows:[["A", "Çok uzun bakım açıklaması. ".repeat(260)]]}},{id:"n",kind:"note",level:"uyari",text:"Uyarı metni. ".repeat(500)}];
    const plan=buildManualDocumentPlan({payload:p,sources:{}});const body=plan.pages.filter(p=>p.role==="body");expect(body.length).toBeGreaterThan(2);
    expect(body.filter(p=>p.items.some(i=>i.kind==="text"&&i.text==="Kod")).length).toBeGreaterThan(1);
    for(const page of body)for(const i of page.items.filter(i=>i.y>=92&&i.y<792)){expect(i.y+i.h).toBeLessThanOrEqual(782);expect(i.x+i.w).toBeLessThanOrEqual(552);}
  });
  it("eksik görsel ve gizli atıf hedefini yayım öncesinde yakalar",()=>{
    const p=fixture();p.sections[0].blocks=[{id:"m",kind:"media",title:"",text:"[[missing]]",side:"right",media:{imageId:"absent"}}];
    expect(manualContentIssues(p,new Set())).toHaveLength(2);
    p.sections[0].hidden=true;expect(manualContentIssues(p,new Set())).toEqual([]);
  });
  it("tablo satırlarının JSON köşeli parantezlerini atıf sanmaz",()=>{
    const p=fixture();p.sections[0].blocks=[{id:"t",kind:"table",table:{head:["A","B"],rows:[["Acil stop","Her gün"]]}}];
    expect(manualContentIssues(p)).toEqual([]);
  });
  it("gerçek PDF sayfası A4 kalır; bölüm başlığı, uyarı seviyesi ve son metin basılır",async()=>{
    const p=fixture();p.sections[0].blocks=[{id:"n",kind:"note",level:"onemli",text:"Kontrol cümlesi"},{id:"z",kind:"text",text:"SON KONTROL SATIRI"}] satisfies ManualBlock[];
    const bytes=await renderToBuffer(ManualPdf({payload:p,sources:{},images:[],docCode:"TEST-R02",docLine:"TEST"}));
    const pdf=await PDFDocument.load(bytes);for(const page of pdf.getPages()){expect(page.getHeight()).toBeCloseTo(841.89,1);expect(page.getWidth()).toBeCloseTo(595.28,1);}
    const text=await extractText(new Uint8Array(bytes),{mergePages:true});
    expect(text.text).toContain("Temel Güvenlik Notları ve Talimatları");expect(text.text).toContain("ÖNEMLİ");expect(text.text).toContain("SON KONTROL SATIRI");
  },15000);
});
