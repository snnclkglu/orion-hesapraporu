"use client";
import { useState } from "react";
import { Ban } from "lucide-react";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {Task} from "@/lib/tasks/model";
export function TaskCancelDialog({task,onClose,onConfirm,busy}:{task:Task|null;onClose:()=>void;onConfirm:(task:Task,reason:string)=>Promise<boolean>;busy:boolean}){
 const [reason,setReason]=useState("");
 return <Dialog open={!!task} onOpenChange={open=>{if(!open&&!busy){onClose();setReason("");}}}><DialogContent mobileKeyboardSafe className="tw-cancel-dialog">
  <DialogTitle><Ban size={18}/> Görevi iptal et</DialogTitle>
  <DialogDescription>{task?.title}</DialogDescription>
  <p className="tw-muted">Görev tamamlanmış sayılmadan İptal edilenler bölümüne taşınır. Kayıt, yorumlar ve dosyalar korunur. İptal eden kişi, zaman ve neden geçmişe kaydedilir.</p>
  <label className="tw-cancel-reason">İptal nedeni<textarea aria-label="İptal nedeni" rows={3} minLength={3} maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
  <div className="tw-action-footer"><Button variant="outline" disabled={busy} onClick={()=>{onClose();setReason("");}}>Vazgeç</Button><Button variant="destructive" disabled={busy||reason.trim().length<3} onClick={async()=>{if(task&&await onConfirm(task,reason.trim())){setReason("");onClose();}}}>İptal et ve kaydet</Button></div>
 </DialogContent></Dialog>;
}
