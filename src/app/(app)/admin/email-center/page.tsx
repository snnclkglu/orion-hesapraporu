import { EmailCenter } from './email-center';
import { emailCenterData } from '@/lib/email-center/service';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/roles';
import { redirect } from 'next/navigation';
export default async function EmailCenterPage({searchParams}:{searchParams:Promise<{tab?:string;jobId?:string}>}){
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();if(!isAdminRole(profile?.role))redirect('/');
  const query=await searchParams;
  return <EmailCenter initial={await emailCenterData(undefined,{jobId:query.jobId})} initialTab={query.tab} initialJobId={query.jobId} />;
}
