'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HtmlPreview } from './email-center';
export function StandaloneEmailPreview({payload,version}:{payload:{subject:string;html:string;text:string};version:number}){
  const [narrow,setNarrow]=useState(false);
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h1 className="text-xl font-semibold">{payload.subject}</h1><p className="text-sm text-muted-foreground">Şablon sürümü {version} · Bu önizleme e-posta göndermez.</p></div><div className="flex gap-2"><Button variant="outline" className="oc-tap" onClick={()=>setNarrow(!narrow)}>{narrow?'Geniş görünüm':'Dar görünüm'}</Button><Button asChild variant="outline" className="oc-tap"><Link href="/admin/email-center?tab=templates">Şablonlara dön</Link></Button></div></div><HtmlPreview html={payload.html} narrow={narrow}/><details><summary className="oc-tap cursor-pointer text-sm">Düz metin</summary><pre className="whitespace-pre-wrap break-words bg-muted p-3 text-sm">{payload.text}</pre></details></div>;
}
