import React from "react";
import { Document, Page, View, Text, Image, Link } from "@react-pdf/renderer";
import { BRAND_LOGO, FONTS } from "./brand";
import { PdfDiagram } from "./diagram";
import type { Diagram } from "../diagrams/model";
import type { ManualPdfProps } from "./manual";
import { buildManualDocumentPlan, type ManualDraw } from "../manual/document-plan";
import { MANUAL_DESIGN as D } from "../manual/design";
import { manualAssetRatios } from "../manual/assets";
import { ManualNotIsareti } from "./manual-marks";

export function ModernManualPdf(props: ManualPdfProps) {
  const ratios=manualAssetRatios();props.images.forEach(i=>ratios.set(i.id,i.height/i.width));
  const plan=buildManualDocumentPlan({...props,ratios,centerLogoKey:props.partner?.logo?"__center":props.payload.partnerLogos.centerImageId,rightLogoKey:props.rightPartnerLogo?"__right":props.payload.partnerLogos.rightImageId,endCustomerLogoKey:props.endCustomerLogo?"__end":undefined,sources:{...props.sources,coverSpecs:[...(props.coverSpecs??props.sources.coverSpecs??[])]}});
  const images=new Map(props.images.map(i=>[i.id,i.bytes]));images.set("__orion",BRAND_LOGO);
  if(props.partner?.logo)images.set("__center",props.partner.logo);
  if(props.rightPartnerLogo)images.set("__right",props.rightPartnerLogo);
  if(props.endCustomerLogo)images.set("__end",props.endCustomerLogo);
  const draw=(item:ManualDraw,index:number)=>{
    const box={position:"absolute" as const,left:item.x,top:item.y,width:item.w,height:item.h};
    if(item.kind==="rect")return <View key={index} style={{...box,backgroundColor:item.color}} />;
    if(item.kind==="safetyMark")return <View key={index} style={box}><ManualNotIsareti level={item.level} boy={item.h}/></View>;
    if(item.kind==="text"){
      if(props.deferFolio && item.y===803 && item.x>450)return null;
      // Yoga'nın kesirli punto yuvarlaması satırı görünmez kılmasın. Satır
      // konumları planda sabit; kutudaki pay başka içeriği aşağı itmez.
      const style={...box,height:item.h+8,fontFamily:FONTS.sans,fontSize:item.size,fontWeight:item.bold?700:400,color:item.color??D.ink,lineHeight:1.35};
      return item.target ? <Link key={index} src={`#${item.target}`} style={style}>{item.text}</Link> : <Text key={index} id={item.id} style={style} wrap={false}>{item.text}</Text>;
    }
    if(item.kind==="marker")return <View key={index} style={{...box,borderRadius:10,backgroundColor:D.red,alignItems:"center",justifyContent:"center"}}><Text style={{fontFamily:FONTS.sans,fontSize:10,fontWeight:700,color:"white"}}>{item.label}</Text></View>;
    if(item.media.diagram)return <View key={index} style={box}><PdfDiagram diagram={item.media.diagram as Diagram} /></View>;
    const bytes=images.get(item.media.imageId||item.media.assetKey||"");
    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image DOM öğesi değildir.
    return bytes?<Image key={index} src={bytes} style={{...box,objectFit:"contain"}} />:null;
  };
  return <Document title={props.payload.docTitle} author="ORION CRANES" subject={props.docCode}>
    {plan.pages.map((page,index)=><Page key={index} size={{width:D.width,height:D.height}} wrap={false} style={{height:D.height,minHeight:D.height,backgroundColor:"white"}}>{page.items.map(draw)}</Page>)}
  </Document>;
}
