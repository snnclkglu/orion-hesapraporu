import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/roles';
import { statusLabels } from '@/lib/email-center/model';
export default async function JobEmailHistory({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return null;
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();
  const {data:publications,error}=await db.from('job_publications').select('id,revision,published_at').eq('job_id',id).order('published_at',{ascending:false});
  const {data:deliveries}=isAdminRole(profile?.role)?await db.from('email_deliveries').select('id,recipient,status,created_at,mode,last_error').eq('job_id',id).order('created_at',{ascending:false}).limit(50):{data:[]};
  return <div className="space-y-5"><section className="rounded-xl border bg-card p-4"><h2 className="mb-3 font-semibold">İş emri yayınları</h2>{error?<p role="alert">Yayın kayıtları okunamadı.</p>:publications?.length?publications.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm last:border-0"><span>{p.revision?`Revizyon ${p.revision}`:'Revizyonsuz yayın'}</span><span className="text-muted-foreground">{new Date(p.published_at).toLocaleString('tr-TR')}</span></div>):<p className="text-sm text-muted-foreground">Bu iş emri için henüz yayın kaydı yok. Eski kayıtlar otomatik yayın sayılmaz.</p>}</section>
    {isAdminRole(profile?.role)&&<section className="space-y-3 rounded-xl border bg-card p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">E-posta geçmişi</h2><Link className="oc-tap text-sm text-primary underline" href={`/admin/email-center?tab=history&jobId=${id}`}>E-posta Merkezi’nde aç</Link></div>{deliveries?.length?deliveries.map(d=><div key={d.id} className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2"><p className="break-all">{d.recipient}{d.mode==='test'?' · Deneme':''}</p><p>{statusLabels[d.status]} · {new Date(d.created_at).toLocaleString('tr-TR')}</p>{d.last_error&&<p className="text-destructive sm:col-span-2">{d.last_error}</p>}</div>):<p className="text-sm text-muted-foreground">Bu iş için e-posta kaydı yok.</p>}</section>}
  </div>;
}
