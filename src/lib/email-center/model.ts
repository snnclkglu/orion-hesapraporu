import { z } from 'zod';
import { USER_ROLES } from '@/lib/roles';

export const eventLabels = {
  'job.published': 'İş emri ilk yayını', 'job.revised': 'İş emri revizyon yayını',
  gorev_atandi: 'Görev atandı', bahsedildi: 'Yorumda bahsedildi', durum_degisti: 'İş durumu değişti',
} as const;
export type EmailEventType = keyof typeof eventLabels;
export const eventTypes = Object.keys(eventLabels) as [EmailEventType, ...EmailEventType[]];
export const fieldLabels = {
  'recipient.name': 'Alıcının adı', 'job.number': 'İş numarası', 'job.title': 'İş başlığı',
  'job.customerName': 'Müşteri', 'job.deliveryDate': 'Teslim tarihi',
  'publication.revisionLabel': 'Revizyon etiketi', 'notification.title': 'Bildirim başlığı',
  'links.job': 'İlgili iş / görev bağlantısı',
} as const;
export type EmailField = keyof typeof fieldLabels;
export type EmailContext = Partial<Record<EmailField, string>>;
export const fields = Object.keys(fieldLabels) as [EmailField, ...EmailField[]];
export const contentSchema = z.object({
  subject: z.string().trim().min(1).max(400), preheader: z.string().max(300).default(''),
  html: z.string().min(1).max(150_000), text: z.string().min(1).max(30_000),
  requiredFields: z.array(z.enum(fields)).max(fields.length).default(['notification.title', 'links.job']),
}).strict();
export type TemplateContent = z.infer<typeof contentSchema>;
export const templateSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/), name: z.string().trim().min(2).max(120), content: contentSchema,
}).strict();
export const ruleSchema = z.object({
  id: z.uuid().optional(), revision: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(120), eventType: z.enum(eventTypes), templateId: z.uuid(),
  mode: z.enum(['off', 'test', 'live']), userIds: z.array(z.uuid()).max(200).default([]),
  roles: z.array(z.enum(USER_ROLES)).max(8).default([]), relatedRecipients: z.boolean().default(false),
  includeActor: z.boolean().default(false), priority: z.number().int().min(1).max(1000).default(100),
}).strict().superRefine((rule, ctx) => {
  if (rule.mode !== 'off' && !rule.userIds.length && !rule.roles.length && !rule.relatedRecipients)
    ctx.addIssue({ code: 'custom', message: 'Etkin kural için en az bir alıcı seçimi gerekli.' });
  if (rule.eventType.startsWith('job.') && rule.relatedRecipients)
    ctx.addIssue({ code: 'custom', message: 'İş emri yayınında alıcıları kullanıcı veya rol olarak seçin.' });
});
export type RuleInput = z.infer<typeof ruleSchema>;
export const statusLabels: Record<string, string> = {
  pending: 'Bekliyor', processing: 'Hazırlanıyor', sent: 'Gönderildi', delivered: 'Teslim edildi',
  delayed: 'Teslim gecikti', failed: 'Başarısız', bounced: 'Geri döndü', complained: 'İstenmeyen olarak bildirildi',
  skipped: 'Atlandı', cancelled: 'İptal edildi', done: 'Tamamlandı',
};
export const modeLabels = { off: 'Kapalı', test: 'Deneme', live: 'Canlı' } as const;
export interface Recipient { userId: string; name: string; email: string; reasons: string[] }
export interface RuleRow {
  id: string; name: string; event_type: EmailEventType; template_id: string;
  mode: 'off'|'test'|'live'; user_ids: string[]; roles: string[];
  related_recipients: boolean; include_actor: boolean; priority: number; revision: number;
}
export interface EventPlan {
  rule: RuleRow; versionId: string; content: TemplateContent; recipients: Recipient[]; testAddress: string;
}
export interface EmailEvent {
  id: string; event_type: EmailEventType; job_id: string|null; actor_id: string|null;
  context: EmailContext; plans: EventPlan[]; attempts: number;
}
export function ruleToRow(rule: RuleInput) {
  return { user_ids: rule.userIds, roles: rule.roles, related_recipients: rule.relatedRecipients, include_actor: rule.includeActor };
}
export function rowToRule(row: RuleRow): RuleInput {
  return ruleSchema.parse({ id: row.id, revision: row.revision, name: row.name, eventType: row.event_type,
    templateId: row.template_id, mode: row.mode, userIds: row.user_ids, roles: row.roles,
    relatedRecipients: row.related_recipients, includeActor: row.include_actor, priority: row.priority });
}
