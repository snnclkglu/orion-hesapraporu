"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import type { Diagram } from "@/lib/diagrams/model";
import type { ManualBlock, ManualMediaRef, ManualFigureBlock } from "@/lib/manual/types";
import type { OnizlemeGorsel } from "./manual-paper";
import { MANUAL_ILLUSTRATIONS, manualIllustration, type ManualIllustrationKey } from "@/lib/manual/illustrations";
import { manualAsset } from "@/lib/manual/assets";

type Rich = Extract<ManualBlock,{kind:"media"|"figure"|"procedure"}>;
const newId=()=>crypto.randomUUID();
export function RichBlockEditor({block,readOnly,images,onChange,onUpload}:{block:Rich;readOnly:boolean;images:ReadonlyMap<string,OnizlemeGorsel>;onChange:(block:ManualBlock)=>void;onUpload?:(file:File)=>Promise<ManualMediaRef|null>}){
  const [busy,setBusy]=useState(false);
  const mediaInput=(media:ManualMediaRef,change:(media:ManualMediaRef)=>void,markers?:ManualFigureBlock["markers"])=> <div className="grid gap-2">
    {!readOnly && <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Görsel kaynağı" className="h-11 min-w-0 max-w-full rounded border bg-background px-2 text-base" value={media.diagramKey?.startsWith("manual:")?media.diagramKey:media.imageId||media.assetKey||""} onChange={e=>{const key=e.target.value;if(key.startsWith("manual:")){const type=key.slice(7) as ManualIllustrationKey;change({diagram:manualIllustration(type),diagramKey:key});}else change(manualAsset(key)?{assetKey:key}:{imageId:key});}}>
        <option value="">Görsel seçin</option><optgroup label="Şematik anlatımlar">{Object.entries(MANUAL_ILLUSTRATIONS).map(([key,label])=><option key={key} value={`manual:${key}`}>{label}</option>)}</optgroup>{[...images.keys()].map((id,i)=><option key={id} value={id}>{manualAsset(id)?.label||`Yüklenen görsel ${i+1}`}</option>)}
      </select>
      {onUpload && <label className="inline-flex min-h-11 cursor-pointer items-center rounded border px-3 text-sm">{busy?"Yükleniyor…":"Fotoğraf yükle"}<input aria-label="Fotoğraf yükle" type="file" accept="image/*" className="sr-only" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);try{const ref=await onUpload(file);if(ref)change(ref);}finally{setBusy(false);e.target.value="";}}}/></label>}
    </div>}
    {media.diagram?<div className="relative"><DiagramSvg diagram={media.diagram as Diagram}/>{markers?.map((m,i)=><span key={m.id} className="pointer-events-none absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" style={{left:`${m.x*100}%`,top:`${m.y*100}%`}}>{i+1}</span>)}</div>:images.get(media.imageId||media.assetKey||"")?.url?
      // eslint-disable-next-line @next/next/no-img-element -- Kullanıcının seçtiği görselin oranını koruyan editör yüzü.
      <div className="relative mx-auto w-fit max-w-full"><img src={images.get(media.imageId||media.assetKey||"")!.url} alt="Seçili görsel" className="max-h-72 max-w-full object-contain"/>{markers?.map((m,i)=><span key={m.id} className="pointer-events-none absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow" style={{left:`${m.x*100}%`,top:`${m.y*100}%`}}>{i+1}</span>)}</div>:<p className="text-sm text-muted-foreground">Bu içerik için bir görsel seçebilirsiniz.</p>}
  </div>;
  return <div className="grid gap-4 rounded-lg border bg-background p-4" data-rich-block={block.kind}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{block.kind==="media"?"FOTOĞRAF + AÇIKLAMA":block.kind==="procedure"?"İŞLEM ADIMLARI":"NUMARALI ŞEKİL"}</span>
      {block.kind==="media"&&!readOnly&&<select aria-label="Görsel yerleşimi" className="h-11 rounded border bg-background px-2 text-base" value={block.side} onChange={e=>onChange({...block,side:e.target.value as "left"|"right"|"top"})}><option value="right">Görsel sağda</option><option value="left">Görsel solda</option><option value="top">Görsel üstte</option></select>}
    </div>
    <Input aria-label="İçerik başlığı" value={block.title} readOnly={readOnly} placeholder="Başlık" onChange={e=>onChange({...block,title:e.target.value})}/>
    {block.kind==="media"&&<><div className={block.side==="top"?"grid gap-4":"grid gap-4 min-[1100px]:grid-cols-2"}>{mediaInput(block.media,media=>onChange({...block,media}))}<Textarea aria-label="Fotoğraf açıklaması" value={block.text} readOnly={readOnly} placeholder="Açıklama" onChange={e=>onChange({...block,text:e.target.value})}/></div><Input aria-label="Görsel altyazısı" value={block.caption||""} readOnly={readOnly} placeholder="Altyazı" onChange={e=>onChange({...block,caption:e.target.value})}/></>}
    {block.kind==="procedure"&&<>{block.steps.map((step,i)=><div key={step.id} className="grid gap-2 border-t pt-3"><div className="flex flex-wrap items-center gap-2"><strong className="mr-auto text-sm">Adım {i+1}</strong>{!readOnly&&<><Button variant="outline" size="sm" disabled={!i} onClick={()=>{const steps=[...block.steps];[steps[i-1],steps[i]]=[steps[i],steps[i-1]];onChange({...block,steps});}}>Yukarı</Button><Button variant="outline" size="sm" onClick={()=>onChange({...block,steps:block.steps.filter(s=>s.id!==step.id)})}>Adımı sil</Button></>}</div><Textarea aria-label={`Adım ${i+1} açıklaması`} readOnly={readOnly} value={step.text} onChange={e=>onChange({...block,steps:block.steps.map(s=>s.id===step.id?{...s,text:e.target.value}:s)})}/><Input aria-label={`Adım ${i+1} beklenen sonuç`} readOnly={readOnly} value={step.result||""} placeholder="Beklenen sonuç (isteğe bağlı)" onChange={e=>onChange({...block,steps:block.steps.map(s=>s.id===step.id?{...s,result:e.target.value}:s)})}/>{mediaInput(step.media??{},media=>onChange({...block,steps:block.steps.map(s=>s.id===step.id?{...s,media}:s)}))}</div>)}{!readOnly&&<Button variant="outline" onClick={()=>onChange({...block,steps:[...block.steps,{id:newId(),text:""}]})}>Adım ekle</Button>}</>}
    {block.kind==="figure"&&<>
      {mediaInput(block.media,media=>onChange({...block,media}),block.markers)}
      <p className="text-sm text-muted-foreground">İşaretler görselin sol üst köşesine göre yüzdeyle yerleşir. Önizlemede numaralarını kontrol edin. Görseli değiştirirseniz konumları yeniden kontrol edin.</p>
      {block.markers.map((m,i)=><div key={m.id} className="grid gap-2 border-t pt-3"><div className="flex items-center gap-2"><strong className="mr-auto">{i+1}</strong>{!readOnly&&<Button variant="ghost" size="sm" onClick={()=>onChange({...block,markers:block.markers.filter(a=>a.id!==m.id)})}>İşareti sil</Button>}</div><Input aria-label={`İşaret ${i+1} adı`} readOnly={readOnly} value={m.label} placeholder="Parça / nokta adı" onChange={e=>onChange({...block,markers:block.markers.map(a=>a.id===m.id?{...a,label:e.target.value}:a)})}/><Textarea aria-label={`İşaret ${i+1} açıklaması`} readOnly={readOnly} value={m.text} onChange={e=>onChange({...block,markers:block.markers.map(a=>a.id===m.id?{...a,text:e.target.value}:a)})}/><div className="flex gap-3">{(["x","y"] as const).map(axis=><label key={axis} className="grid gap-1 text-xs">{axis==="x"?"Soldan (%)":"Üstten (%)"}<Input type="number" min={0} max={100} aria-label={`İşaret ${i+1} ${axis}`} readOnly={readOnly} value={Math.round(m[axis]*100)} onChange={e=>onChange({...block,markers:block.markers.map(a=>a.id===m.id?{...a,[axis]:Math.min(1,Math.max(0,Number(e.target.value)/100))}:a)})}/></label>)}</div></div>)}
      {!readOnly&&<Button variant="outline" onClick={()=>onChange({...block,markers:[...block.markers,{id:newId(),x:0.5,y:0.5,label:"",text:""}]})}>Numaralı işaret ekle</Button>}
      <Input aria-label="Şekil altyazısı" readOnly={readOnly} value={block.caption||""} placeholder="Altyazı" onChange={e=>onChange({...block,caption:e.target.value})}/>
    </>}
  </div>;
}
