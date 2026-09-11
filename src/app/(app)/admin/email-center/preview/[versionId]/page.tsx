import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminRole } from '@/lib/roles';
import { emailDetail, jobContext } from '@/lib/email-center/service';
import { renderTemplate } from '@/lib/email-center/render';
import { StandaloneEmailPreview } from '../../standalone-preview';
export default async function VersionPreview({params,searchParams}:{params:Promise<{versionId:string}>;searchParams:Promise<{jobId?:string}>}){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('role,full_name').eq('id',user.id).single();if(!isAdminRole(profile?.role))redirect('/');
  const {versionId}=await params;const {jobId}=await searchParams;
  const version=await emailDetail('version',versionId);const context=await jobContext(createAdminClient(),jobId);
  let payload;let message='';
  try{payload=renderTemplate(version.content,{...context,'recipient.name':profile?.full_name??''});}
  catch(error){message=error instanceof Error?error.message:'Önizleme hazırlanamadı.';}
  if(!payload)return <p role="alert" className="rounded-lg border p-4">{message} İşe ait alanlar için bağlantıya jobId ekleyin.</p>;
  return <StandaloneEmailPreview payload={payload} version={version.version}/>;
}
