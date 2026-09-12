/* Gerçek CAD API kabul testi. Yalnız oluşturduğu geçici hesap/kayıtları temizler. */
const fs = require('node:fs');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { PDFDocument } = require('pdf-lib');
const assert = require('node:assert/strict');
const sha = x => createHash('sha256').update(x).digest('hex');
const env = {};
for (const file of ['.env.admin', '.env.frankfurt', '.env.local']) for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if(m) env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const users=[], devices=[], jobs=[], packages=[], objects=[];
let admin;
const pass = label => console.log('GEÇTİ: '+label);
const checked = async promise => { const r=await promise; if(r.error) throw new Error(r.error.message); return r.data; };
async function run() {
  const keyResponse=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys`,{headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`}});
  assert(keyResponse.ok,'Dağıtım erişimi'); const keys=await keyResponse.json();
  const url=env.NEXT_PUBLIC_SUPABASE_URL;
  admin=createClient(url,keys.find(k=>k.name==='service_role').api_key,{auth:{persistSession:false,autoRefreshToken:false}});
  async function call(kind,action,data={},token=null,expected=200,local=false) {
    const response=await fetch(local?'http://localhost:3000/api/cad/worker':url+'/functions/v1/cad-api',{
      method:'POST',headers:{'Content-Type':'application/json',apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify(local?{action,data}:{kind,action,data}),signal:AbortSignal.timeout(65000),
    });
    const result=await response.json();
    assert.equal(response.status,expected,`${kind}/${action}: ${JSON.stringify(result)}`); return result;
  }
  await call('web','snapshot',{},null,401);
  await call('worker','claim',{},'invalid',401);
  await call('worker','claim',{},null,401,true);
  pass('Edge ve yerel web cihaz rotası yetkisiz isteği reddediyor');
  if (process.argv.includes('--readonly')) return;
  if (!process.argv.includes('--temporary-records')) throw new Error('Geçici kayıt testi açık onayla --temporary-records gerektirir. Paket temizliği uygulama yönetici kimliği gerektirir.');
  const clients=[];
  for(let i=0;i<2;i++) {
    const email=`cad-acceptance-${randomUUID()}@example.invalid`,password=randomBytes(32).toString('hex');
    const created=await checked(admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'CAD GEÇİCİ KABUL TESTİ'}}));
    users.push(created.user.id);
    const client=createClient(url,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const login=await checked(client.auth.signInWithPassword({email,password}));
    clients.push({client,token:login.session.access_token});
  }
  const web=(action,data={},expected=200)=>call('web',action,data,clients[0].token,expected);
  const pair=await web('pair',{name:'CAD GEÇİCİ TEST PC'});devices.push(pair.deviceId);
  const token=randomBytes(32).toString('hex');
  const worker=(action,data={},expected=200)=>call('worker',action,data,token,expected,true);
  await worker('pair',{code:pair.code,token});
  await worker('pair',{code:pair.code,token});
  await worker('pair',{code:pair.code,token:randomBytes(32).toString('hex')},401);
  pass('Eşleştirme, yanıt kaybında aynı anahtarla tekrar ve farklı anahtar reddi');
  const heartbeat={state:'ready',autocadVersion:'TEST',helperVersion:'1.0.0',protocol:1,message:'Sentetik API testi; AutoCAD çalıştırılmaz.'};
  await worker('heartbeat',heartbeat);
  const id=randomUUID();jobs.push(id);
  const source=Buffer.from('CAD API ACCEPTANCE - NOT AN AUTOCAD DRAWING');
  const created=await web('create',{id,deviceId:pair.deviceId,name:'CAD_KABUL_TESTI.dwg',size:source.length,sha256:sha(source),options:{paper:'A3',duplicates:'hepsi'},acknowledged:true});
  objects.push(created.upload.path);
  await checked(clients[0].client.storage.from('cad-private').uploadToSignedUrl(created.upload.path,created.upload.token,source,{contentType:'application/octet-stream'}));
  await web('queue',{jobId:id});
  const claims=await Promise.all([worker('claim'),worker('claim')]);
  assert.equal(claims.filter(c=>c.job).length,1);const job=claims.find(c=>c.job).job;
  const downloaded=await fetch(job.downloadUrl);assert.equal(sha(Buffer.from(await downloaded.arrayBuffer())),sha(source));
  pass('İmzalı kaynak yükleme/indirme ve gerçek eşzamanlı iki istekte tek iş alma');
  const other=await checked(clients[1].client.from('cad_jobs').select('id').eq('id',id));assert.equal(other.length,0);
  await call('web','cancel',{jobId:id},clients[1].token,404);
  await worker('complete',{jobId:id,attemptId:randomUUID()},409);
  pass('İkinci kullanıcı RLS ve eski deneme reddi');
  const pdf=await PDFDocument.create();pdf.addPage().drawText('CAD API ACCEPTANCE TEST');const pdfBytes=Buffer.from(await pdf.save());
  const result={arac_surum:'acceptance-test',ozet:{cizim:1,pafta:1,malzeme_satiri:0,pdf_basarili:1,hata:0},paftalar:[{pdf:'CAD_TEST.pdf'}],malzeme:[],tanilar:[]};
  const base={jobId:id,attemptId:job.attempt_id};
  const pdfTarget=await worker('artifact',{...base,name:'CAD_TEST.pdf',kind:'pdf',size:pdfBytes.length,sha256:sha(pdfBytes)});objects.push(pdfTarget.upload.path);
  const resultBytes=Buffer.from(JSON.stringify(result));
  const resultTarget=await worker('artifact',{...base,name:'result.json',kind:'result',size:resultBytes.length,sha256:sha(resultBytes)});objects.push(resultTarget.upload.path);
  // Yardımcıdaki gerçek PUT protokolü; dosyalar bitmeden tamamlanma reddedilmeli.
  for(const [target,bytes,type] of [[resultTarget,resultBytes,'application/json']]) {
    const uploaded=await fetch(target.upload.signedUrl,{method:'PUT',headers:{'Content-Type':type},body:bytes});assert(uploaded.ok,'Sonuç yüklemesi');
  }
  await worker('complete',base,409);
  const uploaded=await fetch(pdfTarget.upload.signedUrl,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:pdfBytes});assert(uploaded.ok,'PDF yüklemesi');
  await worker('complete',base);await worker('complete',base);
  const snapshot=await web('snapshot',{jobId:id});assert.equal(snapshot.selected.status,'review');
  const pdfLink=await web('file',{jobId:id,artifactId:pdfTarget.artifactId});
  assert.equal(sha(Buffer.from(await (await fetch(pdfLink.url)).arrayBuffer())),sha(pdfBytes));
  pass('Eksik PDF reddi, çıktı bütünlüğü, tamamlanma tekrarı ve sahipli indirme');
  await web('export_start',{jobId:id,folderName:'CAD GEÇİCİ KABUL TESTİ',itemId:null},400);
  await web('approve',{jobId:id});
  const first=await web('export_start',{jobId:id,folderName:'CAD GEÇİCİ KABUL TESTİ',itemId:null});packages.push(first.packageId);
  const second=await web('export_start',{jobId:id,folderName:'CAD GEÇİCİ KABUL TESTİ',itemId:null});assert.equal(first.packageId,second.packageId);
  await web('export_validate',{jobId:id},400);
  pass('Onay zorunluluğu, tek Teknik Resimler paketi, eksik aktarım reddi');
  const helper=await web('helper');const head=await fetch(helper.url,{method:'HEAD'});assert(head.ok);assert.equal(Number(head.headers.get('content-length')),fs.statSync('desktop/cad/dist/OrionCadYardimcisi.exe').size);
  await web('revoke',{deviceId:pair.deviceId});await worker('claim',{},403);
  pass('Yardımcı indirme bağlantısı ve cihaz iptali');
}
async function cleanup() {
  if(!admin)return;
  if(!users.length && !devices.length && !jobs.length && !packages.length && !objects.length) return;
  if(objects.length)await checked(admin.storage.from('cad-private').remove(objects));
  if(jobs.length) { await checked(admin.from('cad_artifacts').delete().in('job_id',jobs)); await checked(admin.from('cad_jobs').delete().in('id',jobs)); }
  if(packages.length)await checked(admin.from('drawing_packages').delete().in('id',packages));
  if(devices.length){await checked(admin.from('cad_device_secrets').delete().in('device_id',devices));await checked(admin.from('cad_devices').delete().in('id',devices));}
  for(const id of users)await checked(admin.auth.admin.deleteUser(id));
  console.log('TEMİZLENDİ: yalnız bu çalışmanın geçici hesapları, işleri, cihazları ve dosyaları.');
}
run().catch(e=>{console.error('KABUL HATASI: '+e.message);process.exitCode=1}).finally(async()=>{try{await cleanup()}catch(e){console.error('TEMİZLİK HATASI: '+e.message);console.error(JSON.stringify({users,devices,jobs,packages,objects}));process.exitCode=1;}});
