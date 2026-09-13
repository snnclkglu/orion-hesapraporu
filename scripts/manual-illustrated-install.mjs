// 0026 inceleme kopyası. Varsayılan yalnız transaction + rollback kontrolüdür.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
process.loadEnvFile('.env.frankfurt');
const cli=process.env.ORION_SUPABASE_CLI;
if(!cli)throw new Error('ORION_SUPABASE_CLI gerekli.');
const current=JSON.parse(fs.readFileSync('tmp/manual-compare/0026-current.json','utf8'));
const pilot=JSON.parse(fs.readFileSync('tmp/manual-compare/0026-illustrated.json','utf8'));
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const source=current.revision;
const label='Görsel anlatım · 0026 inceleme';
if(pilot.payload.contentEdition!==1)throw new Error('Görsel içerik paketi eksik.');
const sql=`do $install$
declare original public.manual_revisions; next_rev integer; next_payload jsonb;
begin
select * into original from public.manual_revisions where id=${quote(source.id)}::uuid for update;
if original.id is null or original.status<>'draft' then raise exception 'Kaynak taslak bulunamadı'; end if;
if original.payload<>${quote(JSON.stringify(source.payload))}::jsonb then raise exception 'Kaynak taslak değişti; çalışma yeniden alınmalı'; end if;
if exists(select 1 from public.manual_images where revision_id=original.id) then raise exception 'Görseller uygulamanın kopyalama akışıyla taşınmalı'; end if;
perform 1 from public.manuals where id=original.manual_id for update;
if not exists(select 1 from public.manual_revisions where manual_id=original.manual_id and label=${quote(label)}) then
select coalesce(max(rev_no),0)+1 into next_rev from public.manual_revisions where manual_id=original.manual_id;
next_payload:=${quote(JSON.stringify(pilot.payload))}::jsonb;
next_payload:=jsonb_set(next_payload,'{identity,customerRevision}',to_jsonb('R'||lpad(next_rev::text,2,'0')));
if next_payload#>>'{identity,customerDocNo}' like 'ORC-BK-0026-01-R%' then
next_payload:=jsonb_set(next_payload,'{identity,customerDocNo}',to_jsonb('ORC-BK-0026-01-R'||lpad(next_rev::text,2,'0')));end if;
next_payload:=jsonb_set(next_payload,'{identity,revisedOn}',to_jsonb(to_char(current_date,'DD.MM.YYYY')));
insert into public.manual_revisions(manual_id,rev_no,status,payload,label,notes)
values(original.manual_id,next_rev,'draft',next_payload,${quote(label)},'Genel şemalar ve içerik rehberi eklendi. Önceki taslak korunmuştur. Projeye özel görseller ve teknik doğrulama son kullanıcı incelemesindedir.');
end if;
${process.argv.includes('--commit')?'':"raise exception using errcode='Z0001',message='Kontrol tamam'; exception when sqlstate 'Z0001' then raise notice 'Kontroller geçti ve geri alındı';"}
end $install$;`;
fs.writeFileSync('tmp/manual-compare/install.sql',sql);
const uri=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim());uri.password=process.env.SUPABASE_DB_PASSWORD;
const result=spawnSync(cli,['db','query','--db-url',uri.href,'--file','tmp/manual-compare/install.sql','-o','json'],{encoding:'utf8'});
if(result.status){console.error(result.stderr.replaceAll(uri.href,'[bağlantı]').replaceAll(process.env.SUPABASE_DB_PASSWORD,'[gizli]'));process.exit(1);}
if(process.argv.includes('--commit')){
  const query=`select id,rev_no,status,label,payload->>'contentEdition' as content_edition from public.manual_revisions where manual_id=${quote(source.manual_id)}::uuid and label=${quote(label)};`;
  fs.writeFileSync('tmp/manual-compare/installed-readback.sql',query);
  const read=spawnSync(cli,['db','query','--db-url',uri.href,'--file','tmp/manual-compare/installed-readback.sql','-o','json'],{encoding:'utf8'});
  if(read.status)throw new Error('Kayıt işlemi tamamlandı; son okuma başarısız.');
  fs.writeFileSync('tmp/manual-compare/install-result.json',read.stdout);console.log(read.stdout);
}else console.log('Kontroller geçti; deneme kaydı geri alındı.');
