"use client";
import { useState, type CSSProperties } from "react";
import { Tags, Plus, Check, Pencil, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tagHues, type TaskTag, compatibleTag } from "@/lib/tasks/tags";
import type { Workspace } from "@/lib/tasks/model";
import { trKatla } from "@/lib/drawings/tr-text";

export function TaskTagChips({ids, tags, limit = 10}: {ids: string[]; tags: TaskTag[]; limit?:number}) {
  return <span className="tw-tag-chips">{ids.slice(0,limit).map(id => {
    const tag = tags.find(t=>t.id===id);
    return tag ? <span key={id} className="tw-tag" style={{"--tag-hue":tag.color_hue} as CSSProperties}><Tags size={12}/>{tag.name}{tag.archived_at ? " · Arşiv" : ""}</span> : null;
  })}{ids.length>limit && <span className="tw-tag-more">+{ids.length-limit}</span>}</span>;
}
export type TagCommand = (operation:"tag.create"|"tag.update",input:unknown)=>Promise<{tag?:TaskTag}|null>;
export function TaskTagPicker({ids,data,task,disabled,onChange,onCommand}: {
  ids:string[]; data:Workspace; task:{visibility:string;created_by:string;board_id:string|null};disabled?:boolean;
  onChange:(ids:string[])=>void|Promise<unknown>;onCommand:TagCommand;
}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[editing,setEditing]=useState<TaskTag|null>(null),[adding,setAdding]=useState(false),[name,setName]=useState(""),[hue,setHue]=useState(300),[saving,setSaving]=useState(false);
  const tags=data.tags??[];
  const [showArchived,setShowArchived]=useState(false);
  const incompatible=tags.filter(t=>ids.includes(t.id)&&!compatibleTag(t,task,data.boards));
  const choices=tags.filter(t=>compatibleTag(t,task,data.boards)||ids.includes(t.id));
  const team=data.boards.find(b=>b.id===task.board_id)?.team_id;
  const role=data.people.find(p=>p.id===task.created_by)?.role;
  return <div className="tw-tag-field">
    <TaskTagChips ids={ids} tags={tags}/>
    {!!incompatible.length&&<p className="tw-tag-scope-warning">Paylaşım değişti. Kapsama uymayan etiketleri kaldırın: {incompatible.map(t=>t.name).join(", ")}.</p>}
    <Button type="button" variant="ghost" disabled={disabled} onClick={()=>setOpen(true)}><Tags size={15}/>Etiketler{!ids.length && " ekle"}</Button>
    <Dialog open={open} onOpenChange={(value)=>{if(!saving)setOpen(value);}}>
      <DialogContent mobileKeyboardSafe className="tw-tag-dialog">
        <DialogTitle>Görev etiketleri</DialogTitle><DialogDescription>Birden çok kategori seçebilirsin. En fazla 10 etiket.</DialogDescription>
        <input className="tw-tag-input" aria-label="Etiket ara" value={query} onChange={e=>setQuery(e.target.value)}/>
        <label className="tw-tag-archive-toggle"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Arşiv etiketlerini göster</label>
        <div className="tw-tag-options">{choices.filter(t=>(showArchived||!t.archived_at||ids.includes(t.id)) && trKatla(t.name).includes(trKatla(query))).map(t=><div key={t.id}>
          <button type="button" className="oc-tap" aria-pressed={ids.includes(t.id)} disabled={saving||(!ids.includes(t.id)&&(!!t.archived_at||ids.length>=10))} onClick={async()=>{setSaving(true);try{await onChange(ids.includes(t.id)?ids.filter(id=>id!==t.id):[...ids,t.id]);}finally{setSaving(false);}}}>
            <span className="tw-tag-check">{ids.includes(t.id)&&<Check size={16}/>}</span><TaskTagChips ids={[t.id]} tags={tags}/>
          </button>
          {t.can_edit && <button type="button" className="oc-tap-square" aria-label={`${t.name}: etiketi düzenle`} disabled={saving} onClick={()=>{setEditing(t);setAdding(false);setName(t.name);setHue(t.color_hue);}}><Pencil size={15}/></button>}
        </div>)}</div>
        {!adding&&!editing && <Button type="button" variant="outline" onClick={()=>{setAdding(true);setName(query);setHue(300);}}><Plus size={16}/>Yeni etiket oluştur</Button>}
        {(adding||editing)&&<div className="tw-tag-editor">
          <label>Etiket adı<input aria-label="Etiket adı" className="tw-tag-input" value={name} maxLength={40} onChange={e=>setName(e.target.value)}/></label>
          <div className="tw-tag-palette" role="group" aria-label="Etiket rengi">{tagHues.map((h,i)=><button type="button" key={h} aria-label={["Mor","Mavi","Turuncu","Yeşil","Turkuaz","Kırmızı"][i]} aria-pressed={hue===h} style={{"--tag-hue":h} as CSSProperties} onClick={()=>setHue(h)}>{hue===h&&<Check size={16}/>}</button>)}</div>
          {!editing&&<p className="tw-muted">{team?"Bu ekibin etiketi":task.visibility==="private"?"Yalnız sana özel etiket":role==="admin"?"Ortak katalog etiketi":"Bu kapsamda ortak etiket oluşturmak için yönetici yetkisi gerekir."}</p>}
          <div className="tw-tag-editor-actions"><Button type="button" disabled={saving||!name.trim()} onClick={async()=>{
            setSaving(true);try{const result=await onCommand(editing?"tag.update":"tag.create",editing?{id:editing.id,version:editing.version,name,color_hue:hue}:{name,color_hue:hue,scope:team?"team":task.visibility==="private"?"personal":"global",team_id:team??null});
              if(result?.tag){if(!editing&&ids.length<10)await onChange([...ids,result.tag.id]);setEditing(null);setAdding(false);setQuery("");}
            }finally{setSaving(false);}
          }}>Kaydet</Button><Button type="button" variant="ghost" disabled={saving} onClick={()=>{setEditing(null);setAdding(false);}}>Vazgeç</Button>
          {editing&&<Button type="button" variant="ghost" disabled={saving} onClick={async()=>{setSaving(true);try{const r=await onCommand("tag.update",{id:editing.id,version:editing.version,archived:!editing.archived_at});if(r){setEditing(null);}}finally{setSaving(false);}}}><Archive size={15}/>{editing.archived_at?"Arşivden çıkar":"Etiketi arşivle"}</Button>}</div>
        </div>}
        <Button type="button" variant="outline" disabled={saving} onClick={()=>setOpen(false)}>Bitti</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
