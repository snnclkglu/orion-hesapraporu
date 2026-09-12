"use client";
import { CalendarDays, Check, Archive, Users, Flag, ArrowUpRight, Ban, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { statuses, priorities, weekDays, type Task, type TaskPatch, type Workspace } from "@/lib/tasks/model";
import { TaskTagPicker, type TagCommand } from "./task-tag-picker";

export function TaskActionMenu({task:t,mode,onClose,onOpen,onPatch,onArchive,onTagCommand,onCancel,onReactivate,data,today,busy,userId}: {
  task:Task|null; mode:"actions"|"date";onClose:()=>void;onOpen:(id:string)=>void;
  onPatch:(t:Task,fields:Omit<Partial<TaskPatch>,"id"|"version">)=>Promise<unknown>;
  onArchive:(t:Task)=>Promise<unknown>;onTagCommand:TagCommand;data:Workspace;today:string;busy:boolean;userId:string;
  onCancel:(t:Task)=>void;onReactivate:(t:Task)=>Promise<unknown>;
}) {
  const day=(n:number)=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const monday=weekDays(day(7))[0];
  const team=data.boards.find(b=>b.id===t?.board_id)?.team_id;
  const editable=!!t&&t.can_edit!==false&&!t.archived_at;
  return <Dialog open={!!t} onOpenChange={open=>{if(!open)onClose();}}><DialogContent mobileKeyboardSafe className="tw-action-dialog">
    <DialogTitle>{mode==="date"?(t?.due_date?"Tarih değiştir / Ertele":"Tarih belirle"):"Hızlı işlemler"}</DialogTitle>
    <DialogDescription className="tw-action-task-title">{t?.title}</DialogDescription>
    {t&&<>
      {mode==="actions"&&editable&&<>
        {t.kind!=="note"&&<section className="tw-action-section"><h3><Check size={16}/>Durum</h3><div className="tw-action-statuses">{Object.entries(statuses).map(([key,label])=><button type="button" className={`oc-tap status-${key}`} aria-pressed={t.status===key} key={key} disabled={busy} onClick={async()=>{if(await onPatch(t,{status:key as Task["status"]}))onClose();}}>{t.status===key&&<Check size={14}/>} {label}</button>)}</div></section>}
        <TaskTagPicker ids={t.tag_ids??[]} data={data} task={t} disabled={busy} onChange={ids=>onPatch(t,{tag_ids:ids})} onCommand={onTagCommand}/>
        <label className="tw-action-field"><Users size={16}/>Sorumlu<select aria-label="Hızlı sorumlu" value={t.assignee??""} disabled={busy||t.visibility==="private"||(t.visibility==="direct"&&t.created_by!==userId)} onChange={e=>void onPatch(t,{assignee:e.target.value||null})}>
          <option value="" disabled={t.visibility==="direct"}>Atanmamış</option>{data.people.filter(p=>p.id===t.assignee||t.visibility==="job"||t.visibility==="direct"||data.members.some(m=>m.team_id===team&&m.user_id===p.id)||data.teams.some(teamRow=>teamRow.id===team&&teamRow.owner_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select></label>
        <label className="tw-action-field"><Flag size={16}/>Öncelik<select aria-label="Hızlı öncelik" disabled={busy} value={t.priority} onChange={e=>void onPatch(t,{priority:e.target.value as Task["priority"]})}>{Object.entries(priorities).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        {t.kind==="note"&&<Button variant="outline" disabled={busy} onClick={()=>void onPatch(t,{kind:"task"})}>Göreve dönüştür</Button>}
      </>}
      {editable&&t.kind!=="note"&&<section className="tw-action-section"><h3><CalendarDays size={16}/>Tarih</h3><div className="tw-date-options">{[[today,"Bugün"],[day(1),"Yarın"],[monday,"Gelecek hafta"]].map(([value,label])=><Button key={value+label} type="button" variant="outline" disabled={busy} onClick={async()=>{if(await onPatch(t,{due_date:value}))onClose();}}>{label}<small>{new Date(`${value}T12:00:00Z`).toLocaleDateString("tr-TR",{day:"numeric",month:"short"})}</small></Button>)}</div>
        <label className="tw-action-field">Tarih seç<input aria-label="Hızlı tarih seç" type="date" disabled={busy} value={t.due_date??""} onChange={async e=>{if(await onPatch(t,{due_date:e.target.value||null}))onClose();}}/></label>
        {t.due_date&&<Button type="button" variant="ghost" disabled={busy} onClick={async()=>{if(await onPatch(t,{due_date:null}))onClose();}}>Tarihi kaldır</Button>}
      </section>}
      <div className="tw-action-footer"><Button type="button" variant="outline" onClick={()=>{onClose();onOpen(t.id);}}><ArrowUpRight size={16}/>Detayı aç</Button>{t.can_edit!==false&&!t.cancelled_at&&<Button type="button" variant="ghost" disabled={busy} onClick={async()=>{if(await onArchive(t))onClose();}}><Archive size={16}/>{t.archived_at?"Arşivden çıkar":"Arşivle"}</Button>}{t.can_cancel&&<Button type="button" variant={t.cancelled_at?"outline":"ghost"} disabled={busy} onClick={async()=>{if(t.cancelled_at){if(await onReactivate(t))onClose();}else{onClose();onCancel(t);}}}>{t.cancelled_at?<RotateCcw size={16}/>:<Ban size={16}/>}{t.cancelled_at?"Yeniden aç":"Görevi iptal et"}</Button>}</div>
    </>}
  </DialogContent></Dialog>;
}
