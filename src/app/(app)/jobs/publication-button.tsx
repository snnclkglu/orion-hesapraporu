'use client';
import { useState,useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { publishJobOrder } from './publication-action';
import { Send } from 'lucide-react';
export function PublicationButton({jobId,published,dirty,editable}:{jobId:string;published:boolean;dirty:boolean;editable:boolean}){
  const [pending,start]=useTransition();const [message,setMessage]=useState('');
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{!published?'Henüz yayın kaydı yok':dirty?'Yayından sonra değişiklik var':'Güncel yayın kayıtlı'}</span>{editable&&<Button className="oc-tap" size="sm" disabled={pending||(published&&!dirty)} onClick={()=>start(async()=>{const result=await publishJobOrder(jobId);setMessage(result.error??'İş emri yayımlandı. Etkin e-posta kuralları işlenecek.');})}><Send className="size-3.5"/>{pending?'Yayımlanıyor…':published?'Revizyonu yayımla':'İş emrini yayımla'}</Button>}</div>{message&&<p role="status" className="max-w-lg text-sm">{message}</p>}</div>;
}
