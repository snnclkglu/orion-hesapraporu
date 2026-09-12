/* Kurulu geçide yalnız yetkisiz istekler gönderir; dosya yazmaz. */
const fs=require('node:fs');
(async()=>{
 const text=fs.readFileSync('.env.frankfurt','utf8');const project=text.match(/^SUPABASE_PROJECT_REF\s*=\s*["']?([a-z0-9]+)/m)?.[1];if(!project)throw Error('Proje bulunamadı');
 const checks=[];
 for(const headers of [{},{Authorization:'Bearer invalid-session'}]){
  const r=await fetch(`https://${project}.supabase.co/functions/v1/account-media`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}'});
  checks.push({case:headers.Authorization?'invalid-session':'no-session',status:r.status});if(r.status!==401)throw Error('Yetkisiz istek reddedilmedi');
 }
 fs.mkdirSync('artifacts/task-workflow',{recursive:true});fs.writeFileSync('artifacts/task-workflow/media-probe.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
