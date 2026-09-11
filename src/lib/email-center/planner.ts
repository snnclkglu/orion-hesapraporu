import { renderTemplate } from './render';
import type { EmailEvent, EventPlan } from './model';

/** Aynı olay + adres bir mesajdır. Birden çok kuralda küçük öncelik değeri kazanır. */
export function prepareDeliveries(event: EmailEvent) {
  const chosen = new Map<string, { plan: EventPlan; recipient: EventPlan['recipients'][number]; reasons: string[] }>();
  for (const plan of [...event.plans].sort((a,b)=>a.rule.priority-b.rule.priority || a.rule.id.localeCompare(b.rule.id))) {
    if (plan.rule.mode==='off' || !plan.recipients.length) continue;
    const recipients=plan.rule.mode==='test'
      ? [{userId:'',name:'Deneme alıcısı',email:plan.testAddress,reasons:plan.recipients.map(r=>`${r.name} <${r.email}> — ${r.reasons.join(', ')}`)}]
      : plan.recipients;
    for (const recipient of recipients) {
      const key=recipient.email.trim().toLowerCase();
      if (!key) continue;
      const reasons=[`Kural: ${plan.rule.name}`, ...recipient.reasons];
      const previous=chosen.get(key);
      if (previous) previous.reasons.push(...reasons);
      else chosen.set(key,{plan,recipient,reasons});
    }
  }
  return [...chosen.entries()].map(([email,{plan,recipient,reasons}])=> {
    const base={ruleId:plan.rule.id,versionId:plan.versionId,jobId:event.job_id,
      userId:plan.rule.mode==='test'?null:recipient.userId,recipient:email,name:recipient.name,
      reasons:[...new Set(reasons)],mode:plan.rule.mode};
    try {
      const payload=renderTemplate(plan.content,{...event.context,'recipient.name':recipient.name});
      if (plan.rule.mode==='test') {
        payload.subject=`[DENEME] ${payload.subject}`;
        // Gerçek alıcı bilgisi düz metin karşılığında ve panelde bulunur; HTML içine kaçırılmadan eklenmez.
        payload.text+=`\n\nGerçek alıcılar:\n${reasons.join('\n')}`;
      }
      return {...base,payload:{...payload,to:[email]},status:'pending',error:null};
    } catch(error) {
      return {...base,payload:{},status:'failed',error:error instanceof Error?error.message:'Şablon hazırlanamadı.'};
    }
  });
}
