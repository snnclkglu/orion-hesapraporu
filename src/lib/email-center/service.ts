import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { templateSchema, ruleSchema, ruleToRow, eventLabels, fieldLabels, type EmailContext, type Recipient, type RuleInput } from './model';
import { renderTemplate, validateTemplate, defaultContent } from './render';

export interface EmailActor { id: string; source: string }
export class EmailCenterError extends Error {
  constructor(message: string, public status=422) { super(message); }
}
export function dbCheck(error: {message?:string}|null) {
  if(error) throw new EmailCenterError(error.message?.includes('değişmiş') ? 'Kayıt başka bir işlemde değişmiş. Yenileyin.' : 'E-posta kaydı işlenemedi.',503);
}
export const commandSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('template.save'),data:templateSchema}),
  z.object({action:z.literal('template.publish'),data:z.object({templateId:z.uuid(),versionId:z.uuid()}).strict()}),
  z.object({action:z.literal('rule.save'),data:ruleSchema}),
  z.object({action:z.literal('settings.save'),data:z.object({paused:z.boolean(),testAddress:z.email().max(254)}).strict()}),
  z.object({action:z.literal('preview'),data:z.object({versionId:z.uuid(),jobId:z.uuid().optional(),rule:ruleSchema.optional(),relatedUserIds:z.array(z.uuid()).max(200).default([]),actorId:z.uuid().optional()}).strict()}),
  z.object({action:z.literal('test.send'),data:z.object({versionId:z.uuid(),jobId:z.uuid().optional(),requestId:z.uuid()}).strict()}),
  z.object({action:z.literal('delivery.retry'),data:z.object({deliveryId:z.uuid()}).strict()}),
  z.object({action:z.literal('delivery.resend'),data:z.object({deliveryId:z.uuid(),requestId:z.uuid()}).strict()}),
]);
export type EmailCommand=z.infer<typeof commandSchema>;

async function versionById(admin:SupabaseClient,id:string) {
  const {data,error}=await admin.from('email_template_versions').select('*').eq('id',id).single();
  dbCheck(error); if(!data) throw new EmailCenterError('Şablon sürümü bulunamadı.',404); return data;
}
export async function jobContext(admin:SupabaseClient,id?:string):Promise<EmailContext> {
  if(!id) return {'notification.title':'E-posta bağlantısı denemesi','links.job':'https://app.orioncranes.com/jobs'};
  const {data,error}=await admin.from('jobs').select('job_no,title,customer,delivery_date,revision').eq('id',id).single();
  dbCheck(error); if(!data) throw new EmailCenterError('İş bulunamadı.',404);
  return {'job.number':data.job_no,'job.title':data.title,'job.customerName':data.customer,
    'job.deliveryDate':data.delivery_date?new Intl.DateTimeFormat('tr-TR',{timeZone:'UTC'}).format(new Date(data.delivery_date)):'',
    'publication.revisionLabel':data.revision?`Revizyon ${data.revision}`:'Revizyonsuz',
    'notification.title':'İş emri yayımlandı','links.job':`https://app.orioncranes.com/jobs/${id}`};
}
export async function resolveRecipients(admin:SupabaseClient,rule:RuleInput,actorId:string,targets:string[]) {
  const {data,error}=await admin.rpc('email_resolve_recipients',{p_rule:ruleToRow(rule),p_actor:actorId,p_targets:targets});
  dbCheck(error); return (data??[]) as Recipient[];
}
export async function emailCenterData(admin=createAdminClient(),filters:{jobId?:string;status?:string;query?:string;page?:number}={}) {
  const page=Math.max(0,filters.page??0);
  let deliveries=admin.from('email_deliveries').select('id,event_id,rule_id,template_version_id,job_id,recipient,recipient_name,reasons,mode,status,attempts,last_error,provider_id,created_at,sent_at,resend_of',{count:'exact'}).order('created_at',{ascending:false});
  if(filters.jobId) deliveries=deliveries.eq('job_id',filters.jobId);
  if(filters.status) deliveries=deliveries.eq('status',filters.status);
  if(filters.query) deliveries=deliveries.ilike('recipient',`%${filters.query.replace(/[%_]/g,'')}%`);
  const results=await Promise.all([
    admin.from('email_settings').select('*').single(),
    admin.from('email_templates').select('*').order('name'),
    admin.from('email_template_versions').select('id,template_id,version,created_at,source').order('version',{ascending:false}),
    admin.from('email_rules').select('*').order('priority').order('name'),
    deliveries.range(page*30,page*30+29),
    admin.from('profiles').select('id,full_name,role').order('full_name'),
    admin.from('jobs').select('id,job_no,title').order('job_no',{ascending:false}).limit(500),
    admin.from('email_events').select('id,event_type,job_id,status,last_error,created_at').order('created_at',{ascending:false}).limit(30),
    admin.from('email_audit').select('id,action,entity_id,source,created_at,before_value,after_value').order('created_at',{ascending:false}).limit(30),
  ]);
  results.forEach(result=>dbCheck(result.error));
  return {settings:results[0].data,templates:results[1].data??[],versions:results[2].data??[],rules:results[3].data??[],
    deliveries:results[4].data??[],total:results[4].count??0,people:results[5].data??[],jobs:results[6].data??[],
    events:results[7].data??[],audit:results[8].data??[],page,
    connection:{sending:!!process.env.RESEND_API_KEY,webhook:!!process.env.RESEND_WEBHOOK_SECRET,production:process.env.VERCEL_ENV==='production'},
    catalog:{events:eventLabels,fields:fieldLabels},defaultContent};
}
export async function emailDetail(kind:'version'|'delivery',id:string,admin=createAdminClient()) {
  const {data,error}=await admin.from(kind==='version'?'email_template_versions':'email_deliveries').select('*').eq('id',id).single();
  dbCheck(error); return data;
}
export async function executeEmailCommand(raw:unknown,actor:EmailActor,admin=createAdminClient()) {
  const parsed=commandSchema.safeParse(raw);
  if(!parsed.success) throw new EmailCenterError(parsed.error.issues.map(i=>i.message).join(' · '));
  const command=parsed.data;
  if(['test.send','delivery.retry','delivery.resend'].includes(command.action) && process.env.VERCEL_ENV!=='production')
    throw new EmailCenterError('Gerçek e-posta gönderimi yalnız canlı uygulamada kullanılabilir.');
  if(command.action==='template.save') {
    command.data.content=validateTemplate(command.data.content);
  }
  if(command.action==='template.publish') {
    const version=await versionById(admin,command.data.versionId);
    if(version.template_id!==command.data.templateId) throw new EmailCenterError('Sürüm başka şablona ait.');
    validateTemplate(version.content);
  }
  if(command.action==='rule.save' && command.data.mode!=='off') {
    const {data,error}=await admin.from('email_templates').select('published_version_id').eq('id',command.data.templateId).single();
    dbCheck(error); if(!data?.published_version_id) throw new EmailCenterError('Önce şablon sürümünü yayımlayın.');
    const recipients=command.data.userIds;
    if(recipients.length) {
      const {data:users,error}=await admin.from('profiles').select('id').in('id',recipients);dbCheck(error);
      if(new Set(recipients).size!==users?.length) throw new EmailCenterError('Alıcı seçiminde bulunamayan veya tekrarlanan kullanıcı var.');
    }
  }
  if(['template.save','template.publish','rule.save','settings.save'].includes(command.action)) {
    const {data,error}=await admin.rpc('email_manage',{p_action:command.action,p_data:command.data,p_actor:actor.id,p_source:actor.source});
    dbCheck(error); return command.action==='template.save'?{...data,previewUrl:`/admin/email-center/preview/${data.id}`}:data;
  }
  if(command.action==='preview' || command.action==='test.send') {
    const version=await versionById(admin,command.data.versionId);
    const context=await jobContext(admin,command.data.jobId);
    const {data:settings,error}=await admin.from('email_settings').select('*').single();dbCheck(error);
    let recipients:Recipient[]=[];
    if(command.action==='preview' && command.data.rule) {
      if(command.data.rule.templateId!==version.template_id) throw new EmailCenterError('Önizleme sürümü seçilen kuralın şablonuna ait değil.');
      recipients=await resolveRecipients(admin,command.data.rule,command.data.actorId??actor.id,command.data.relatedUserIds);
      context['notification.title']=eventLabels[command.data.rule.eventType];
    }
    const payload=renderTemplate(version.content,{...context,'recipient.name':recipients[0]?.name??'Deneme alıcısı'});
    if(command.action==='preview') return {payload,recipients,context,testAddress:settings.test_address,versionId:version.id};
    if(settings.paused) throw new EmailCenterError('Gönderimler durdurulmuş. Önce ayarlardan açın.');
    const delivery={id:command.data.requestId,template_version_id:version.id,job_id:command.data.jobId??null,
      recipient:settings.test_address.toLowerCase(),recipient_name:'Deneme alıcısı',mode:'test',
      reasons:[`Deneme gönderimi · ${actor.source}`],payload:{...payload,subject:`[DENEME] ${payload.subject}`,to:[settings.test_address.toLowerCase()]}};
    const {data,error:deliveryError}=await admin.rpc('email_manual_delivery',{p_delivery:delivery,p_actor:actor.id,p_source:actor.source});dbCheck(deliveryError);return data;
  }
  if(command.action!=='delivery.retry' && command.action!=='delivery.resend') throw new EmailCenterError('Bilinmeyen işlem.');
  const {data,error}=await admin.rpc('email_delivery_action',{p_action:command.action,p_id:command.data.deliveryId,
    p_new_id:command.action==='delivery.resend'?command.data.requestId:null,p_actor:actor.id,p_source:actor.source});
  dbCheck(error); return data;
}
