import { MANUAL_DESIGN as D, MANUAL_CONTENT_WIDTH as W, manualTextLines } from "./design";
import { flattenManual, numberManual, printedManual } from "./payload";
import { autoTableFor, type ManualSourceData } from "./sources";
import { MANUAL_NOTE_LABELS, type ManualBlock, type ManualDiagramModel, type ManualMediaRef, type ManualPayload, type ManualTable, type ManualAppendixKind } from "./types";
import { BRAND } from "../pdf/palette";
import { MANUAL_DOC_TITLE } from "./naming";
import type { ManualNoteLevel } from "./types";

type Box = { x: number; y: number; w: number; h: number };
export type ManualDraw =
  | (Box & { kind: "text"; text: string; size: number; bold?: boolean; color?: string; target?: string; id?: string })
  | (Box & { kind: "rect"; color: string })
  | (Box & { kind: "media"; media: ManualMediaRef })
  | (Box & { kind: "marker"; label: string })
  | (Box & { kind: "safetyMark"; level: ManualNoteLevel });
export interface ManualDocumentPage { title: string; items: ManualDraw[]; sectionId?: string; role: "cover" | "contents" | "identity" | "body" | "appendix" }
export interface ManualDocumentPlan { pages: ManualDocumentPage[]; pageNumbers: Map<string, number>; bodyOffset: number; bodyCount: number; totalPages: number }
export interface ManualPlanInput {
  payload: ManualPayload; sources: ManualSourceData; ratios?: ReadonlyMap<string, number>;
  projectTitle?: string; docCode?: string; bandLines?: readonly string[];
  centerLogoKey?: string; rightLogoKey?: string; endCustomerLogoKey?: string;
  coverMeta?: { preparedBy: string; checkedBy: string; date: string; revision: string; customer: string };
  includedAppendices?: readonly ManualAppendixKind[];
  appendixPageCounts?: Partial<Record<ManualAppendixKind, number>>;
}

/** Sayfa planı çizimden önce tamamlanır. Her satırın koordinatı iki çizicide de aynıdır. */
export function buildManualDocumentPlan(input: ManualPlanInput): ManualDocumentPlan {
  const { payload, sources } = input;
  const title = input.projectTitle || payload.coverTitle;
  const source = printedManual(payload);
  const included = new Set(input.includedAppendices ?? []);
  const sections = numberManual(source.sections.map(s => ({ ...s, children: s.children.filter(c => !c.appendix || included.has(c.appendix)) })).filter(s => !s.children.some(c => c.appendix) && s.key !== "ekler"));
  const flat = flattenManual(sections);
  const appendixSections = flattenManual(numberManual(source.sections)).filter(s => s.appendix && included.has(s.appendix));
  const refs = new Map(flat.map(s => [s.id, `${s.number} ${s.title}`]));
  const resolve = (text: string) => text.replace(/\[\[([^\]]+)\]\]/g, (_, id: string) => refs.get(id) ? `bkz. ${refs.get(id)}` : "[atıf hedefi bulunamadı]");
  const bodies: ManualDocumentPage[] = [];
  let page: ManualDocumentPage = { title: "", role: "body", items: [] };
  let y: number = D.top;
  let currentTitle = "", currentId = "";
  const newPage = () => { page = { title: currentTitle, sectionId: currentId, role: "body", items: [] }; bodies.push(page); y = D.top; };
  const ensure = (h: number) => { if(y + h > D.bottom && page.items.length) newPage(); };
  const rect = (x: number, top: number, w: number, h: number, color: string) => page.items.push({ kind: "rect", x, y: top, w, h, color });
  const lineAt = (text: string, x: number, top: number, w: number, size = D.body as number, bold = false, color: string = D.ink, id?: string) => page.items.push({ kind: "text", text, x, y: top, w, h: size * 1.35, size, bold, color, ...(id ? {id} : {}) });
  const para = (raw: string, opts: { size?: number; bold?: boolean; color?: string; x?: number; width?: number; prefix?: string } = {}) => {
    if(!raw.trim()) return;
    const size = opts.size ?? D.body, x = opts.x ?? D.left, width = opts.width ?? W;
    const lines = manualTextLines(resolve(raw), width, size, opts.bold), lh = size * 1.43;
    if(lines.length<=5)ensure(lines.length*lh+2);
    for(let i=0; i<lines.length; i++) { ensure((i===0||i===lines.length-2?Math.min(2,lines.length-i):1)*lh + 2); if(i === 0 && opts.prefix) lineAt(opts.prefix, D.left, y, 25, size, true, D.red); lineAt(lines[i], x, y, width, size, opts.bold, opts.color); y += lh; }
    y += 6;
  };
  const heading = (text: string, depth = 2, id?: string) => {
    const size = depth === 1 ? 23 : depth === 2 ? 15 : 12;
    const lines = manualTextLines(text, W, size, true);
    ensure(lines.length * size * 1.25 + 52);
    y += depth === 1 ? 2 : 13;
    lines.forEach((line,i) => { lineAt(line,D.left,y,W,size,true,depth === 1 ? D.ink : D.red,i===0?id:undefined);y+=size*1.25; });
    y += depth === 1 ? 19 : 10;
  };
  const mediaSize = (media: ManualMediaRef, width: number, maxHeight: number) => {
    const d=media.diagram, ratio=d ? d.height/d.width : input.ratios?.get(media.imageId || media.assetKey || "") ?? 0.7;
    const h=Math.min(maxHeight, width * ratio), w=h/ratio;
    return {w,h};
  };
  const putMedia = (media: ManualMediaRef, x: number, top: number, width: number, maxHeight=240) => {
    const size=mediaSize(media,width,maxHeight);
    page.items.push({kind:"media",media,x:x+(width-size.w)/2,y:top,...size});return size;
  };
  const table = (data: ManualTable) => {
    if(!data.rows.length) return;
    const count=Math.max(data.head.length,...data.rows.map(r=>r.length),1);
    // Uzun açıklama sütununa daha fazla alan, kısa kodlara okunabilir asgari genişlik.
    const weights=Array.from({length:count},(_,i)=>Math.max(5, Math.min(45,Math.max(data.head[i]?.length??0,...data.rows.map(r=>r[i]?.length??0)))));
    const total=weights.reduce((a,b)=>a+b,0), min=Math.min(count>6?35:44,W/count);
    const widths=weights.map(w=>min+(W-min*count)*w/total);
    const headerLines=data.head.map((s,i)=>manualTextLines(s,widths[i]-12,D.table,true));
    const hh=Math.max(1,...headerLines.map(l=>l.length))*D.tableLine+14;
    const header=()=>{ensure(hh+30);rect(D.left,y,W,hh,BRAND.paper150);let x=D.left;headerLines.forEach((ls,i)=>{ls.forEach((s,j)=>lineAt(s,x+6,y+6+j*D.tableLine,widths[i]-12,D.table,true));x+=widths[i];});y+=hh;};
    header();
    for(const row of data.rows) {
      const lines=Array.from({length:count},(_,i)=>manualTextLines(resolve(row[i]??""),widths[i]-12,D.table));
      let offset=0;const length=Math.max(1,...lines.map(ls=>ls.length));
      const rowHeight=length*D.tableLine+12;
      if(rowHeight<=D.bottom-D.top-hh && y+rowHeight>D.bottom){newPage();header();}
      while(offset<length){
        if(y+27>D.bottom){newPage();header();}
        const n=Math.max(1,Math.min(length-offset,Math.floor((D.bottom-y-12)/D.tableLine)));
        const h=n*D.tableLine+12;let x=D.left;
        lines.forEach((ls,i)=>{ls.slice(offset,offset+n).forEach((s,j)=>lineAt(s,x+6,y+5+j*D.tableLine,widths[i]-12,D.table));x+=widths[i];});
        rect(D.left,y+h-1,W,0.5,BRAND.line300);y+=h;offset+=n;
        if(offset<length){newPage();header();}
      }
    }
    y+=9;if(data.caption)para(data.caption,{size:D.caption,color:D.muted});
  };
  const block = (b: ManualBlock) => {
    switch(b.kind){
      case "text": if(b.margin)para(b.margin,{size:9,bold:true,color:D.red});para(b.text);break;
      case "list": b.items.filter(i=>i.trim()).forEach((item,i)=>para(item,{x:D.left+26,width:W-26,prefix:b.ordered?`${i+1}.`:"•"}));if(b.result)para(`→ ${b.result}`,{bold:true});break;
      case "note": {
        const lines=manualTextLines(resolve([b.title,b.text].filter(Boolean).join("\n")),W-116,D.body);
        const label=b.title ? `${MANUAL_NOTE_LABELS[b.level]} · ${b.title}` : MANUAL_NOTE_LABELS[b.level];
        let offset=0;
        do {
          ensure(75);
          const n=Math.max(1,Math.min(lines.length-offset,Math.floor((D.bottom-y-26)/D.line)));
          const h=Math.max(65,n*D.line+22), color=b.level==="not"||b.level==="onemli"?BRAND.steel:D.red;
          rect(D.left,y,W,h,BRAND.paper100);rect(D.left,y,4,h,color);
          page.items.push({kind:"safetyMark",level:b.level,x:D.left+13,y:y+8,w:26,h:22});
          manualTextLines(MANUAL_NOTE_LABELS[b.level],75,9,true).forEach((s,i)=>lineAt(s,D.left+13,y+34+i*12,85,9,true,color));
          lines.slice(offset,offset+n).forEach((s,i)=>lineAt(s,D.left+105,y+10+i*D.line,W-116,D.body));
          if(!lines.length)lineAt(label,D.left+105,y+10,W-116,D.body,true);
          y+=h+10;offset+=n;if(offset<lines.length)newPage();
        }while(offset<lines.length);
        break;
      }
      case "auto": {const t=autoTableFor(b,sources);if(t.rows.length)table(t);else if(b.emptyText)para(b.emptyText);break;}
      case "table": table(b.table);break;
      case "diagram":
      case "image": {const width=b.kind==="image"?W*(b.widthPct??100)/100:W;const size=mediaSize(b,width,285);ensure(size.h+40);putMedia(b,D.left+(W-width)/2,y,width,285);y+=size.h+8;if(b.caption)para(b.caption,{size:D.caption,color:D.muted});y+=8;break;}
      case "media": {
        if(b.title)heading(b.title,3,b.id);
        if(b.side==="top") {const size=mediaSize(b.media,W,270);ensure(size.h+35);putMedia(b.media,D.left,y,W,270);y+=size.h+10;para(b.text);}
        else {
          const mw=W*0.4,tw=W-mw-20,size=mediaSize(b.media,mw,220),lines=manualTextLines(resolve(b.text),tw);
          ensure(Math.max(size.h, Math.min(lines.length,9)*D.line)+12);
          const start=y, mx=b.side==="left"?D.left:D.left+tw+20,tx=b.side==="left"?D.left+mw+20:D.left;
          putMedia(b.media,mx,start,mw,220);
          const n=Math.max(0,Math.min(lines.length,Math.floor((D.bottom-start-12)/D.line)));
          lines.slice(0,n).forEach((s,i)=>lineAt(s,tx,start+i*D.line,tw));
          y=start+Math.max(size.h,n*D.line)+10;
          if(n<lines.length)para(lines.slice(n).join(" "));
        }
        if(b.caption)para(b.caption,{size:D.caption,color:D.muted});break;
      }
      case "procedure": {
        if(b.title)heading(b.title,3,b.id);
        b.steps.forEach((step,i)=>{
          ensure(65);rect(D.left,y,26,26,BRAND.red);lineAt(String(i+1),D.left+8,y+4,20,12,true,BRAND.white);
          const lines=manualTextLines(resolve(step.text),W-42);
          const startY=y;
          for(const line of lines){ensure(D.line+2);lineAt(line,D.left+42,y,W-42);y+=D.line;}if(y===startY)y+=26;else if(lines.length===1)y+=11;y+=10;
          if(step.media){const size=mediaSize(step.media,W-42,190);ensure(size.h+20);putMedia(step.media,D.left+42,y,W-42,190);y+=size.h+10;}
          if(step.result)para(`→ ${step.result}`,{x:D.left+42,width:W-42,bold:true,size:10});
          y+=8;
        });break;
      }
      case "figure": {
        if(b.title)heading(b.title,3,b.id);
        const size=mediaSize(b.media,W,330);ensure(size.h+35);const drawn=putMedia(b.media,D.left,y,W,330),x=D.left+(W-drawn.w)/2;
        b.markers.forEach((m,i)=>page.items.push({kind:"marker",label:String(i+1),x:x+m.x*drawn.w-10,y:y+m.y*drawn.h-10,w:20,h:20}));y+=size.h+12;
        if(b.caption)para(b.caption,{size:D.caption,color:D.muted});
        if(b.markers.length)table({head:["No","Parça / nokta","Açıklama"],rows:b.markers.map((m,i)=>[String(i+1),m.label,m.text])});break;
      }
    }
  };
  const visit = (list: typeof sections) => {
    for(const section of list){heading(`${section.number}  ${section.title}`,section.depth,section.id);section.blocks.forEach(block);visit(section.children);}
  };
  for(const section of sections){currentTitle=section.title;currentId=section.id;newPage();visit([section]);}

  const tocItems=[...flat,...appendixSections];
  const tocRows=tocItems.map(s=>({s,lines:manualTextLines(`${s.number}  ${s.title}`,W-48-(s.depth-1)*10,9.5,s.depth===1)}));
  const tocGroups: typeof tocRows[]=[[]];let tocHeight=0;
  for(const row of tocRows){const h=row.lines.length*14+5;if(tocHeight+h>600){tocGroups.push([]);tocHeight=0;}tocGroups.at(-1)!.push(row);tocHeight+=h;}
  const offset=2+tocGroups.length,pageNumbers=new Map<string,number>();
  bodies.forEach((p,i)=>p.items.forEach(item=>{if(item.kind==="text" && item.id)pageNumbers.set(item.id,offset+i+1);}));
  let nextAppendix=offset+bodies.length+1;
  appendixSections.forEach(s=>{pageNumbers.set(s.id,nextAppendix);nextAppendix+=1+(input.appendixPageCounts?.[s.appendix!]??0);});

  const fixedPage=(role: ManualDocumentPage["role"],label:string)=>({role,title:label,items:[] as ManualDraw[]});
  const addText=(p:ManualDocumentPage,text:string,x:number,top:number,w:number,size:number,bold=false,color:string=D.ink,target?:string)=>{
    const lines=manualTextLines(text,w,size,bold);lines.forEach((s,i)=>p.items.push({kind:"text",text:s,x,y:top+i*size*1.4,w,h:size*1.4,size,bold,color,target}));return lines.length*size*1.4;
  };
  const cover=fixedPage("cover","Belge kapağı");
  cover.items.push({kind:"rect",x:0,y:0,w:D.width,h:12,color:BRAND.red});
  cover.items.push({kind:"media",x:D.left,y:52,w:178,h:22,media:{assetKey:"__orion"}});
  addText(cover,"ORION CRANES / TEKNİK DOKÜMANTASYON",D.left,104,W,9,true,D.muted);
  let cy=153;
  cy+=addText(cover,payload.docTitle || MANUAL_DOC_TITLE,D.left,cy,W,30,true)+22;
  cy+=addText(cover,title,D.left,cy,W,17,true)+16;
  cy+=addText(cover,payload.identity.customer,D.left,cy,W,11,false,D.muted)+22;
  if(payload.coverImageId){const size=mediaSize({imageId:payload.coverImageId},W,150);cover.items.push({kind:"media",x:D.left+(W-size.w)/2,y:cy,...size,media:{imageId:payload.coverImageId}});cy+=size.h+16;}
  const specs=(sources.coverSpecs??[]).slice(0,8);
  const specHeight=Math.ceil(specs.length/2)*43;
  // Uzun kapakta teknik özet künye sayfasında devam eder.
  const coverSpecsFit=cy+specHeight<=754;
  (coverSpecsFit?specs:[]).forEach((s,i)=>{const x=D.left+(i%2)*(W/2+6),top=cy+Math.floor(i/2)*43;addText(cover,s.label,x,top,W/2-16,8.5,true,D.muted);addText(cover,s.value,x,top+14,W/2-16,10.5,true);});
  const identity=fixedPage("identity","Belge kimliği");let iy=D.top;
  iy+=addText(identity,"BELGE KİMLİĞİ",D.left,iy,W,22,true)+24;
  const pairs=[["Doküman",input.docCode??""],["Ürün",payload.identity.product],["Seri numarası",payload.identity.serialNo],["Üretim yılı",payload.identity.productionYear],["Müşteri",payload.identity.customer],["Saha",payload.identity.site],["Üretici",payload.identity.manufacturer],["Üretici adresi",payload.identity.manufacturerAddress],["Müşteri doküman no",payload.identity.customerDocNo],["Müşteri revizyonu",payload.identity.customerRevision],["Hazırlanma tarihi",payload.identity.preparedOn],["Revizyon tarihi",payload.identity.revisedOn],["Hazırlayan",input.coverMeta?.preparedBy??""],["Kontrol eden",input.coverMeta?.checkedBy??""],["Belge revizyonu",input.coverMeta?.revision??""],["Telif",payload.identity.copyright],...(sources.coverSpecs??[]).map(s=>[s.label,s.value])];
  const identities:ManualDocumentPage[]=[identity];let ip=identity;
  for(const [label,value] of pairs.filter(([,v])=>v.trim())){const lines=manualTextLines(value,W-145,10.5),height=Math.max(26,lines.length*15+12);if(iy+height>D.bottom){ip=fixedPage("identity","Belge kimliği · devam");identities.push(ip);iy=D.top;}addText(ip,label,D.left,iy,132,9,true,D.muted);addText(ip,value,D.left+145,iy,W-145,10.5);iy+=height;}
  // Normal künye tek sayfa. Çok uzun kullanıcı adresinde ofseti doğru tutar.
  const extraIdentity=identities.length-1;if(extraIdentity){for(const [key,n] of pageNumbers)pageNumbers.set(key,n+extraIdentity);}
  const toc=tocGroups.map((rows,index)=>{const p=fixedPage("contents","İçindekiler");let ty=D.top;ty+=addText(p,index?"İÇİNDEKİLER · DEVAM":"İÇİNDEKİLER",D.left,ty,W,22,true)+24;for(const {s,lines} of rows){const h=lines.length*14+5;const x=D.left+(s.depth-1)*10;lines.forEach((text,j)=>p.items.push({kind:"text",text,x,y:ty+j*14,w:W-48-(s.depth-1)*10,h:14,size:9.5,bold:s.depth===1,color:s.depth===1?D.red:D.ink,target:s.id}));addText(p,String(pageNumbers.get(s.id)??""),D.left+W-28,ty,28,9.5,true,D.muted,s.id);ty+=h;}return p;});
  const appendix=appendixSections.map((s)=>{const p=fixedPage("appendix",s.title);p.items.push({kind:"text",text:s.number,id:s.id,x:D.left,y:150,w:W,h:50,size:36,bold:true,color:D.red});addText(p,s.title,D.left,222,W,24,true);addText(p,"Bu ekin belgeleri sonraki sayfalarda yer alır.",D.left,318,W,11);return p;});
  const pages=[cover,...toc,...identities,...bodies,...appendix];
  const totalPages=pages.length+Object.values(input.appendixPageCounts??{}).reduce((a,b)=>a+(b??0),0);
  pages.forEach((p,i)=>{
    if(i){p.items.unshift({kind:"media",x:D.left,y:29,w:137,h:17,media:{assetKey:"__orion"}});addText(p,input.docCode??"",335,30,216,8.5,true,D.muted);addText(p,p.title,D.left,57,W,8.5,false,D.muted);p.items.push({kind:"rect",x:D.left,y:75,w:W,h:1,color:BRAND.red});}
    for(const [key,x,w] of [[input.centerLogoKey,244,106],[input.rightLogoKey,424,127]] as const){if(key)p.items.push({kind:"media",x,y:i?26:50,w,h:i?24:28,media:{assetKey:key}});}
    if(!i && input.endCustomerLogoKey)p.items.push({kind:"media",x:424,y:88,w:127,h:30,media:{assetKey:input.endCustomerLogoKey}});
    p.items.push({kind:"rect",x:D.left,y:792,w:W,h:0.5,color:BRAND.line300});
    addText(p,input.docCode??"",D.left,803,260,8,false,D.muted);
    addText(p,input.bandLines?.join(" · ") || payload.identity.revisedOn || payload.identity.preparedOn, D.left,817,420,7.5,false,D.muted);
    addText(p,`${i+1} / ${totalPages}`,D.left+W-60,803,60,8.5,true,D.muted);
  });
  return {pages,pageNumbers,bodyOffset:offset+extraIdentity,bodyCount:bodies.length,totalPages};
}

export function diagramFromMedia(media: ManualMediaRef): ManualDiagramModel | undefined { return media.diagram; }
