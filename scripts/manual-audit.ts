import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { renderManualResponse } from '../src/lib/manual/export-server';
import { buildManualSourceData } from '../src/app/(app)/projects/[id]/manual/sources-data';
import { applyManualIdentitySuggestion, resolveManualIdentity } from '../src/lib/manual/identity-server';
for (const file of ['.env.local','.env.frankfurt','.env.admin']) if(fs.existsSync(file)) process.loadEnvFile(file);
async function main(){
 const ref=process.env.SUPABASE_PROJECT_REF;
 let key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
 if(!key){const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}});if(!r.ok) throw Error(`Anahtar erişimi: ${r.status}`);key=(await r.json()).find((k:{name:string;api_key:string})=>k.name==='service_role')?.api_key;}
 if(!key || !ref) throw Error('Bağlantı ayarları eksik');
 const db=createClient(`https://${ref}.supabase.co`,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const projectId='fc45b0dd-ccb4-42bd-b581-416f75283066',revId=process.env.MANUAL_AUDIT_REV || '355cf638-80d1-4294-8adf-a8bcf85c2027';
 const out='tmp/manual-redesign';fs.mkdirSync(out,{recursive:true});
 const sources=await buildManualSourceData(db,projectId);
 const {data:revision,error}=await db.from('manual_revisions').select('*').eq('id',revId).single();if(error)throw error;
 const {data:project}=await db.from('projects').select('id,doc_no,name,customer,crane_type').eq('id',projectId).single();
 const {data:calculations}=await db.from('revisions').select('id,rev_no,status,inputs,selections').eq('project_id',projectId);
 fs.writeFileSync(`${out}/0026-live.json`,JSON.stringify({project,revision,sources,calculations},null,2));
 if(process.argv.includes('--install-pilot')) {
   const pilot=JSON.parse(fs.readFileSync(`${out}/0026-pilot.json`,'utf8'));
   if(JSON.stringify(pilot.revision.payload)!==JSON.stringify(revision.payload))throw Error('Kaynak taslak değişti; pilot yeniden üretilmeli.');
   const {count}=await db.from('manual_images').select('id',{head:true,count:'exact'}).eq('revision_id',revId);
   if(count!==0)throw Error('Kaynak görseller eklendi; uygulamanın görsel kopyalama akışı kullanılmalı.');
   const {data:existing}=await db.from('manual_revisions').select('id,rev_no').eq('manual_id',revision.manual_id).eq('label','Şematik tasarım · 0026 inceleme').maybeSingle();
   if(existing){console.log(JSON.stringify({pilot:existing,alreadyExists:true}));return;}
   const {data:last}=await db.from('manual_revisions').select('rev_no').eq('manual_id',revision.manual_id).order('rev_no',{ascending:false}).limit(1).single();
   const revNo=Number(last?.rev_no??1)+1;
   const identity=await resolveManualIdentity(db,projectId,revNo);
   pilot.payload.identity=applyManualIdentitySuggestion(pilot.payload.identity,identity.values).identity;
   const {data:created,error:createError}=await db.from('manual_revisions').insert({manual_id:revision.manual_id,rev_no:revNo,status:'draft',payload:pilot.payload,label:'Şematik tasarım · 0026 inceleme',notes:'Yeni tasarım inceleme kopyası. Önceki revizyonun metinleri ve ek seçimleri korunmuştur. Teknik şartname kaynak dosyası eksiktir; son kullanıcı incelemesi beklenir.'}).select('id,rev_no').single();
   if(createError)throw createError;
   fs.writeFileSync(`${out}/0026-installed.json`,JSON.stringify(created));console.log(JSON.stringify({pilot:created}));return;
 }
 console.log(JSON.stringify({project:project?.name,coverSpecs:sources.coverSpecs,equipment:sources.equipment?.length,drawings:sources.drawings?.length,electricalParts:sources.electricalParts?.length}));
 if(process.argv.includes('--data-only'))return;
 for(const full of [false,true]){const start=Date.now(); const r=await renderManualResponse(db,projectId,revId,full,process.argv.includes("--pilot")?{payloadOverride:JSON.parse(fs.readFileSync(`${out}/0026-pilot.json`,"utf8")).payload,onManifest:m=>fs.writeFileSync(`${out}/0026-manifest-${full?"full":"body"}.json`,JSON.stringify(m,null,2))}:{});if(!r.ok) throw Error(await r.text()); const bytes=Buffer.from(await r.arrayBuffer());const name=`${out}/0026-${process.env.MANUAL_AUDIT_TAG || (process.argv.includes('--pilot')?'integrated-after':'before')}-${full?'full':'body'}.pdf`;fs.writeFileSync(name,bytes);console.log(JSON.stringify({name,bytes:bytes.length,ms:Date.now()-start,omitted:r.headers.get('X-Atlanan-Ek'),details:decodeURIComponent(r.headers.get('X-Atlanan-Ek-Ayrinti')||'')}));}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
