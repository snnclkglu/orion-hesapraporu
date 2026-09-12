"use client";
import { useState, type ReactNode } from "react";
import { SectionBottomBar } from "./section-bottom-bar";
import { BottomToolPanel, openBottomTool } from "./bottom-bar-tools";
import { Button } from "./ui/button";

export function CatalogBottomTools({ children, pages, downloadUrl }: { children: ReactNode; pages: number; downloadUrl: string }) {
  const [scale, setScale] = useState(100);
  const [fit, setFit] = useState(false);
  return <div className={fit ? "oc-catalog-fit" : ""} style={{ "--catalog-scale": `${scale}%` } as React.CSSProperties}>
    <SectionBottomBar label="Katalog" priority={50} items={[
      {id:"pages",label:"Sayfalar",icon:"file",onSelect:()=>openBottomTool("catalog-pages")},
      {id:"zoom",label:"Yakınlaştır",icon:"zoom",onSelect:()=>openBottomTool("catalog-zoom")},
      {id:"fit",label:"Sığdır",icon:"grid",active:fit,onSelect:()=>{setFit(true);setScale(100);}},
      {id:"pdf",label:"PDF indir",icon:"file",action:true,onSelect:()=>window.location.assign(downloadUrl)},
    ]} />
    <BottomToolPanel desktop={false} id="catalog-pages" title="Katalog sayfaları"><div className="grid grid-cols-4 gap-2">{Array.from({length:pages},(_,i)=><Button key={i} variant="outline" onClick={()=>document.getElementById(`catalog-page-${i}`)?.scrollIntoView({block:"start"})}>{i+1}</Button>)}</div></BottomToolPanel>
    <BottomToolPanel desktop={false} id="catalog-zoom" title="Yakınlaştır"><label className="grid gap-2">Görünüm %{scale}<input className="min-h-11" type="range" min="100" max="250" step="25" value={scale} onChange={event=>{setFit(true);setScale(Number(event.target.value));}} /></label><Button variant="outline" onClick={()=>setFit(false)}>Doğal boyut</Button></BottomToolPanel>
    {children}
  </div>;
}
