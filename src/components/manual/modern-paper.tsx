"use client";
import React, { useMemo } from "react";
import localFont from "next/font/local";
const manualFont=localFont({src:[{path:"../../assets/fonts/Archivo-Regular.ttf",weight:"400"},{path:"../../assets/fonts/Archivo-Bold.ttf",weight:"700"}]});
import { buildManualDocumentPlan, type ManualDraw } from "@/lib/manual/document-plan";
import { MANUAL_DESIGN as D } from "@/lib/manual/design";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";
import type { ManualPaperProps } from "./manual-paper";
import { markForLevel } from "@/lib/manual/marks";

const pt=(value:number)=>`calc(${value} * 100cqw / ${D.width})`;
export function ModernManualPaper(props:ManualPaperProps){
  const logos=props.payload.partnerLogos;
  const center=props.firmaLogolari?.get(logos.centerCustomerId??"")??props.projeFirmaLogosu??props.gorseller.get(logos.centerImageId??"");
  const right=props.firmaLogolari?.get(logos.rightCustomerId??"")??props.gorseller.get(logos.rightImageId??"");
  const plan=useMemo(()=>buildManualDocumentPlan({...props,centerLogoKey:center?"__center":undefined,rightLogoKey:right?"__right":undefined,ratios:new Map([...props.gorseller].map(([id,g])=>[id,g.oran]))}),[props,center,right]);
  const draw=(item:ManualDraw,index:number)=>{
    const box:React.CSSProperties={position:"absolute",left:pt(item.x),top:pt(item.y),width:pt(item.w),height:pt(item.h)};
    if(item.kind==="rect")return <div key={index} style={{...box,background:item.color}}/>;
    if(item.kind==="safetyMark"){
      const mark=markForLevel(item.level);
      return <svg key={index} style={box} viewBox={`0 0 ${mark.vb.w} ${mark.vb.h}`} aria-label={item.level}>{mark.parts.map((p,i)=>p.t==="polygon"?<polygon key={i} points={p.points} fill={p.fill}/>:p.t==="path"?<path key={i} d={p.d} fill={p.fill}/>:p.t==="circle"?<circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill}/>:<rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill}/>)}</svg>;
    }
    if(item.kind==="text"){
      const style={...box,fontSize:pt(item.size),fontWeight:item.bold?700:400,color:item.color??D.ink,lineHeight:1.35,whiteSpace:"pre" as const};
      return item.target?<a key={index} href={`#manual-${item.target}`} style={style}>{item.text}</a>:<div key={index} id={item.id?`manual-${item.id}`:undefined} style={style}>{item.text}</div>;
    }
    if(item.kind==="marker")return <div key={index} style={{...box,borderRadius:"50%",background:D.red,color:"white",fontSize:pt(10),fontWeight:700,display:"grid",placeItems:"center"}}>{item.label}</div>;
    if(item.media.diagram)return <div key={index} style={box}><DiagramSvg diagram={item.media.diagram as Diagram}/></div>;
    const key=item.media.assetKey;
    const url=key==="__center"?center?.url:key==="__right"?right?.url:item.media.assetKey==="__orion"?"/brand/orion-logo.png":props.gorseller.get(item.media.imageId||item.media.assetKey||"")?.url;
    // eslint-disable-next-line @next/next/no-img-element -- Önizleme kendi A4 koordinatlarını kullanır.
    return url?<img key={index} src={url} alt="" style={{...box,objectFit:"contain"}}/>:null;
  };
  return <div className="grid gap-5" data-manual-design="2">
    {plan.pages.map((page,index)=><section key={index} id={`oc-yaprak-${index+1}`} aria-label={`${index+1}. sayfa: ${page.title}`} data-manual-page={index+1} style={{containerType:"inline-size",position:"relative",aspectRatio:`${D.width}/${D.height}`,background:"white",color:D.ink,fontFamily:manualFont.style.fontFamily,boxShadow:"0 1px 6px #0002",outline:page.sectionId===props.vurguId?`2px solid ${D.red}`:undefined}}>{page.items.map(draw)}</section>)}
  </div>;
}
