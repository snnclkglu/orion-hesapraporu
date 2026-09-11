import { describe,it,expect } from 'vitest';
import { defaultContent,renderTemplate,validateTemplate } from './render';
import { prepareDeliveries } from './planner';
import { ruleSchema,type EmailEvent,type EventPlan } from './model';
import { eventTypes } from './model';
import { readFileSync } from 'node:fs';
const context={'notification.title':'Ölçü & görev <img src=x>', 'links.job':'https://app.orioncranes.com/jobs/abc', 'recipient.name':'ÇAĞRI'};
describe('E-posta şablon sözleşmesi',()=>{
  it('Veritabanı ve uygulama aynı olay sözlüğünü kullanır',()=>{
    const sql=readFileSync('supabase/migrations/20260911000007_email_center.sql','utf8');
    const values=sql.match(/event_type in \(([^)]+)\)/)?.[1].match(/'([^']+)'/g)?.map(value=>value.slice(1,-1));
    expect(values?.sort()).toEqual([...eventTypes].sort());
  });
  it('Türkçe metni korur, değişken HTML çalıştıramaz ve boş termin satırı gizlenir',()=>{
    const mail=renderTemplate(defaultContent,context);
    expect(mail.html).toContain('Ölçü &amp; görev &lt;img');expect(mail.html).not.toContain('Teslim tarihi:');
    expect(mail.text).toContain('ÇAĞRI');expect(mail.html).not.toContain('<img src=x');
  });
  it('Koşul içindeki alanı yalnız değer varsa basar',()=>{
    expect(renderTemplate(defaultContent,{...context,'job.deliveryDate':'30.09.2026'}).html).toContain('30.09.2026');
  });
  it.each(['{{process.env.KEY}}','{{{notification.title}}}','{{#if job.number}}kapanmadı','{{/if}}'])('Hatalı dili reddeder: %s',subject=>{
    expect(()=>validateTemplate({...defaultContent,subject})).toThrow();
  });
  it.each(['<script>alert(1)</script>','<svg onload="alert(1)"></svg>','<img src=x onerror="alert(1)">','<style>body{display:none}</style>'])('Çalıştırılabilir HTML kabul etmez',html=>{
    expect(()=>validateTemplate({...defaultContent,html})).toThrow();
  });
  it('Bilinmeyen zorunlu alanı ve eksik değeri reddeder',()=>{
    expect(()=>renderTemplate(defaultContent,{})).toThrow('Zorunlu alan eksik');
    expect(()=>validateTemplate({...defaultContent,requiredFields:['finance.total']})).toThrow();
  });
  it('Dış bağlantı ve CSS ağ çağrısını temizler',()=>{
    const mail=renderTemplate({...defaultContent,html:'<a href="https://evil.example">Dış</a><p style="background:url(https://evil.example);color:red">Metin</p>'},context);
    expect(mail.html).not.toContain('evil.example');expect(mail.html).toContain('color:red');
  });
  it('Başlık enjeksiyonunu temizler ve uygulama dışı değişken bağlantısını reddeder',()=>{
    expect(renderTemplate(defaultContent,{...context,'notification.title':'test\r\nBcc: example'}).subject).not.toMatch(/[\r\n]/);
    expect(()=>renderTemplate(defaultContent,{...context,'links.job':'https://evil.example/jobs'})).toThrow();
  });
});
function plan(id:string,priority=100,mode:'test'|'live'='live'):EventPlan{
  return {rule:{id,name:id,event_type:'job.published',template_id:'template',mode,user_ids:[],roles:[],related_recipients:false,include_actor:false,priority,revision:1},
    versionId:id,content:defaultContent,testAddress:'test@example.com',recipients:[{userId:'u1',name:'Alıcı',email:'USER@example.com',reasons:['Planlama']}]};
}
function event(plans:EventPlan[]):EmailEvent{return {id:'event',event_type:'job.published',job_id:'job',actor_id:'actor',context,plans,attempts:1};}
describe('Alıcı ve sürüm planı',()=>{
  it('İki kural aynı alıcıyı seçtiğinde öncelikli şablonla bir mesaj oluşturur',()=>{
    const deliveries=prepareDeliveries(event([plan('second',100),plan('first',10)]));
    expect(deliveries).toHaveLength(1);expect(deliveries[0].versionId).toBe('first');
    expect(deliveries[0].reasons).toContain('Kural: second');
    expect(deliveries[0].recipient).toBe('user@example.com');
  });
  it('Deneme gerçek alıcıya gitmez ve gerçek alıcı açıklamasını taşır',()=>{
    const delivery=prepareDeliveries(event([plan('test',1,'test')]))[0];
    expect(delivery.recipient).toBe('test@example.com');expect(delivery.userId).toBeNull();
    expect(delivery.payload).toHaveProperty('to',['test@example.com']);expect(delivery.payload).toHaveProperty('subject',expect.stringContaining('[DENEME]'));
  });
  it('Alıcısı olmayan kural deneme mesajı da üretmez',()=>{
    expect(prepareDeliveries(event([{...plan('test',1,'test'),recipients:[]}]))).toEqual([]);
  });
  it('Eksik veri diğer alıcıları kaybettirmeden başarısız gönderim kaydı oluşturur',()=>{
    const broken=plan('broken');broken.content={...defaultContent,requiredFields:['job.customerName']};
    const delivery=prepareDeliveries(event([broken]))[0];expect(delivery.status).toBe('failed');expect(delivery.error).toContain('job.customerName');
  });
  it('Alıcısız canlı kural ve yayın olayında hayali ilgili kişi seçimi reddedilir',()=>{
    const rule={name:'Kural',eventType:'job.published',templateId:'11111111-1111-4111-8111-111111111111',mode:'live'};
    expect(ruleSchema.safeParse(rule).success).toBe(false);
    expect(ruleSchema.safeParse({...rule,relatedRecipients:true}).success).toBe(false);
  });
});
