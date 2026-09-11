'use server';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { processEmailCenter, emailCenterEnabled } from '@/lib/email-center/worker';
import { z } from 'zod';
export async function publishJobOrder(jobId:string):Promise<{id?:string;error?:string}>{
  if(!z.uuid().safeParse(jobId).success)return {error:'Geçersiz iş kimliği.'};
  if(!emailCenterEnabled())return {error:'İş emri yayını yalnız canlı uygulamada kullanılabilir.'};
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return {error:'Oturum gerekli.'};
  const {data,error}=await db.rpc('publish_job_order',{p_job:jobId});
  if(error)return {error:error.message};
  revalidatePath(`/jobs/${jobId}`);
  after(async()=>{try{await processEmailCenter(1);}catch{console.error('Yayın e-postası sonraki çalışmaya bırakıldı.');}});
  return {id:data};
}
