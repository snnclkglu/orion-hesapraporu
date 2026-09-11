import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { prepareDeliveries } from './planner';
import { dbCheck } from './service';
import type { EmailEvent } from './model';

export function emailCenterEnabled() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED==='true' && process.env.VERCEL_ENV==='production' && !!process.env.RESEND_API_KEY;
}
/** Bildirim kaydının kimliği geçiş boyunca korunur; yeniden çağrı aynı olayı bulur. */
export async function captureNotificationEvents(rows:{id:string;user_id:string;title:string;href:string;kind?:string;job_id?:string|null;actor?:string;job_no?:string}[]) {
  if(!emailCenterEnabled()) return;
  const admin=createAdminClient();
  const row=rows[0];
  if(row) {
    if(!row.kind || !['gorev_atandi','bahsedildi','durum_degisti'].includes(row.kind)) return;
    const url=new URL(row.href,'https://app.orioncranes.com');
    if(url.origin!=='https://app.orioncranes.com' || !url.pathname.startsWith('/jobs/')) return;
    const {error}=await admin.rpc('email_capture_event',{p_source:`notification/${row.id}`,p_type:row.kind,p_job:row.job_id??null,
      p_actor:row.actor??null,p_targets:[...new Set(rows.map(r=>r.user_id).filter(Boolean))],p_context:{'notification.title':row.title,'job.number':row.job_no??'','links.job':url.href}});
    dbCheck(error);
  }
}
export async function processEmailCenter(limit=3) {
  if(!emailCenterEnabled()) return {processed:0,disabled:true};
  const deadline=Date.now()+35_000;
  const admin=createAdminClient();let processed=0;
  for(let index=0;index<limit && Date.now()<deadline-12_000;index++) {
    const {data,error}=await admin.rpc('email_claim_event');dbCheck(error);
    const event=(data as EmailEvent[]|null)?.[0];if(!event) break;
    try {
      const deliveries=prepareDeliveries(event);
      const {error}=await admin.rpc('email_finish_event',{p_id:event.id,p_attempt:event.attempts,p_deliveries:deliveries});dbCheck(error);
    } catch {
      const {error}=await admin.from('email_events').update({status:'pending',lease_until:null,last_error:'Olay hazırlanamadı; tekrar denenecek.'}).eq('id',event.id).eq('attempts',event.attempts);dbCheck(error);
    }
  }
  for(let index=0;index<limit && Date.now()<deadline-12_000;index++) {
    const {data,error}=await admin.rpc('email_claim_delivery');dbCheck(error);
    const row=data?.[0];if(!row) break;
    const update=async(values:Record<string,unknown>)=> {
      const {error}=await admin.from('email_deliveries').update(values).eq('id',row.id).eq('attempts',row.attempts).eq('status','processing');dbCheck(error);
    };
    try {
      const {data:settings,error:settingsError}=await admin.from('email_settings').select('paused,test_address').single();dbCheck(settingsError);
      if(!settings) throw new Error('Ayarlar bulunamadı.');
      let cancelled=settings.paused || (row.mode==='test' && settings.test_address.toLowerCase()!==row.recipient.toLowerCase());
      if(row.rule_id) {
        const {data:rule,error}=await admin.from('email_rules').select('mode').eq('id',row.rule_id).single();dbCheck(error);
        cancelled ||= !rule || rule.mode!==row.mode;
      }
      if(cancelled) { await update({status:'cancelled',lease_until:null,last_error:'Kural, deneme adresi veya genel gönderim ayarı değişti.'});continue; }
      if(row.mode==='live') {
        if(!row.user_id) { await update({status:'skipped',last_error:'Alıcı hesabı yok.',lease_until:null});continue; }
        const {data:auth,error}=await admin.auth.admin.getUserById(row.user_id);
        if(error && error.status!==404) throw new Error('Alıcı okunamadı.');
        const user=auth?.user;
        const banned=(user as {banned_until?:string}|null)?.banned_until;
        if(!user?.email_confirmed_at || user.email?.toLowerCase()!==row.recipient.toLowerCase() || (banned && Date.parse(banned)>Date.now())) {
          await update({status:'skipped',last_error:'Alıcı hesabı veya e-posta adresi değişmiş.',lease_until:null});continue;
        }
        const {data:suppressed,error:suppressionError}=await admin.from('email_deliveries').select('id').eq('recipient',row.recipient).in('status',['bounced','complained']).limit(1);dbCheck(suppressionError);
        if(suppressed?.length) { await update({status:'skipped',last_error:'Bu adres geri dönmüş veya istenmeyen bildirmiş.',lease_until:null});continue; }
      }
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':'application/json','Idempotency-Key':`email-center/${row.id}`},body:JSON.stringify(row.payload),signal:AbortSignal.timeout(10_000)});
      if(response.ok) {
        const result=await response.json();if(!result.id) throw new Error('Sağlayıcı kimliği yok.');
        await update({status:'sent',provider_id:result.id,sent_at:new Date().toISOString(),lease_until:null,last_error:null});
        const {error}=await admin.rpc('email_reconcile_delivery',{p_provider:result.id});dbCheck(error);
      } else {
        const retry=[409,429].includes(response.status)||response.status>=500;
        await update({status:retry&&row.attempts<8?'pending':'failed',lease_until:null,last_error:`Gönderim servisi: HTTP ${response.status}`,
          next_attempt_at:new Date(Date.now()+Math.min(60,2**row.attempts)*60_000).toISOString()});
      }
    } catch {
      await update({status:row.attempts<8?'pending':'failed',lease_until:null,last_error:'Gönderim sonucu alınamadı; aynı mesaj kimliğiyle tekrar denenecek.',
        next_attempt_at:new Date(Date.now()+Math.min(60,2**row.attempts)*60_000).toISOString()});
    }
    processed++;
    await new Promise(resolve=>setTimeout(resolve,600));
  }
  return {processed,disabled:false};
}
