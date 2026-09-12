/* Anahtarsız yayın kontrolü; görev veya kullanıcı verisi oluşturmaz/değiştirmez. */
const fs=require('node:fs');
const base=process.argv[2];
if(!base||!/^https:\/\/(app\.orioncranes\.com|orion-hesapraporu-[a-z0-9]+-scolakoglu-9449s-projects\.vercel\.app)$/.test(base))throw Error('Beklenen ORION yayın adresi gerekli');
(async()=>{
 const checks=[];
 for(const route of ['/login','/','/admin/integrations','/api/agent/tasks/tags','/api/agent/tasks?period=cancelled']){
  const response=await fetch(base+route,{redirect:'manual'}),type=response.headers.get('content-type')??'';
  const status=response.status,location=response.headers.get('location');
  const ok=route==='/login'?status===200:route.startsWith('/api/')?status===401&&type.includes('application/json'):status>=300&&status<400&&!!location?.includes('/login');
  checks.push({route,status,ok,requestId:response.headers.get('x-request-id')});
 }
 const report={base,checkedAt:new Date().toISOString(),checks,passed:checks.every(c=>c.ok)};
 fs.mkdirSync('artifacts/task-014-release',{recursive:true});fs.writeFileSync('artifacts/task-014-release/http-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
