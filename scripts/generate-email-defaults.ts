// Standart HTML ile SQL başlangıç kaydı tek kaynaktan üretilir.
import { writeFileSync } from 'node:fs';
import { defaultContent } from '../src/lib/email-center/render';
const content=JSON.stringify(defaultContent).replaceAll("'","''");
const sql=`-- scripts/generate-email-defaults.ts tarafından üretilir.
do $$ declare tid uuid; vid uuid; begin
  insert into public.email_templates(slug,name) values('orion-bildirim','ORION Bildirimi') returning id into tid;
  insert into public.email_template_versions(template_id,version,content,source) values(tid,1,'${content}'::jsonb,'kurulum') returning id into vid;
  update public.email_templates set published_version_id=vid where id=tid;
  insert into public.email_rules(name,event_type,template_id,mode,related_recipients) values
    ('Görev atama','gorev_atandi',tid,'live',true),
    ('Yorumda bahsetme','bahsedildi',tid,'live',true),
    ('İş durumu değişikliği','durum_degisti',tid,'live',true),
    ('İş emri ilk yayını','job.published',tid,'off',false),
    ('İş emri revizyon yayını','job.revised',tid,'off',false);
end $$;
`;
writeFileSync('supabase/migrations/20260911000008_email_center_defaults.sql',sql);
