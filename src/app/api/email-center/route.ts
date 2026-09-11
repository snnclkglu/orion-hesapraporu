import { after } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/roles';
import { EmailCenterError, emailCenterData, emailDetail, executeEmailCommand } from '@/lib/email-center/service';
import { processEmailCenter } from '@/lib/email-center/worker';

export const runtime='nodejs';
export const maxDuration=60;
async function actor() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user) throw new EmailCenterError('Oturum gerekli.',401);
  const {data}=await db.from('profiles').select('role').eq('id',user.id).single();
  if(!isAdminRole(data?.role)) throw new EmailCenterError('Yönetici yetkisi gerekli.',403);
  return {id:user.id,source:'panel'};
}
function failure(error:unknown) {
  return Response.json({error:error instanceof Error?error.message:'İşlem tamamlanamadı.'},{status:error instanceof EmailCenterError?error.status:422,headers:{'Cache-Control':'no-store'}});
}
export async function GET(request:Request) {
  try {
    await actor();const params=new URL(request.url).searchParams;
    const detail=params.get('detail');const id=params.get('id');
    if(detail && ['version','delivery'].includes(detail) && z.uuid().safeParse(id).success)
      return Response.json(await emailDetail(detail as 'version'|'delivery',id!),{headers:{'Cache-Control':'no-store'}});
    return Response.json(await emailCenterData(undefined,{jobId:params.get('jobId')??undefined,status:params.get('status')??undefined,
      query:params.get('q')?.slice(0,254),page:Math.max(0,Math.min(10000,Number(params.get('page'))||0))}),{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return failure(error); }
}
export async function POST(request:Request) {
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin) throw new EmailCenterError('Geçersiz istek kaynağı.',403);
    const principal=await actor();
    if(Number(request.headers.get('content-length'))>200_000) throw new EmailCenterError('İçerik çok büyük.');
    const text=await request.text();if(Buffer.byteLength(text)>200_000) throw new EmailCenterError('İçerik çok büyük.');
    const command=JSON.parse(text);
    const result=await executeEmailCommand(command,principal);
    if(['test.send','delivery.retry','delivery.resend'].includes(command.action))
      after(async()=>{try{await processEmailCenter(1);}catch{console.error('E-posta kuyruğu sonraki çalışmaya bırakıldı.');}});
    return Response.json({result},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return failure(error); }
}
