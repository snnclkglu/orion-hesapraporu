/* Vercel erişimini resmi araç sağlar; uygulama kullanıcı oturumu kullanılmaz. */
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
process.on('uncaughtException',()=>{console.error('Deneme HTTP kontrolü tamamlanamadı; ham yanıtlar güvenlik için yazdırılmadı.');process.exit(1);});
const deployment=process.argv[2];
if(!/^https:\/\/orion-hesapraporu-[a-z0-9]+-scolakoglu-9449s-projects\.vercel\.app$/.test(deployment||''))throw Error('Deneme adresini kontrol edin');
const cli='C:/Users/HP/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js';
const expected=fs.readFileSync('.env.frankfurt','utf8').match(/^SUPABASE_PROJECT_REF\s*=\s*["']?([a-z0-9]+)/m)?.[1];
const results=[];
for(const route of ['/','/profile','/admin/feedback','/api/agent/tasks','/manifest.webmanifest']){
 const output=execFileSync(process.execPath,[cli,'curl',route,'--deployment',deployment,'--','--silent','--dump-header','-','--output','NUL'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000});
 const status=Number([...output.matchAll(/HTTP\/[\d.]+\s+(\d+)/g)].at(-1)?.[1]);
 const location=output.match(/^location:\s*(.+)$/im)?.[1].trim();
 const csp=output.match(/^content-security-policy:\s*(.+)$/im)?.[1]||'';
 let agentNotConfigured=false;
 if(route==='/api/agent/tasks'&&status===503){
  const body=execFileSync(process.execPath,[cli,'curl',route,'--deployment',deployment,'--','--silent'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000});
  agentNotConfigured=JSON.parse(body).error==='Agent API yapılandırılmamış.';
 }
 results.push({route,status,...(route==='/api/agent/tasks'?{agentNotConfigured}:{}),...(location?{loginRedirect:/\/login(?:\?|$)/.test(location)}:{}),...(csp?{correctSupabase:csp.includes(`https://${expected}.supabase.co`)}:{})});
}
const good=results.slice(0,3).every(r=>[302,303,307,308].includes(r.status)&&r.loginRedirect)&&(results[3].status===401||results[3].agentNotConfigured)&&results[4].status===200&&results.some(r=>r.correctSupabase===true)&&!results.some(r=>r.correctSupabase===false);
fs.writeFileSync('artifacts/task-release/preview-http-checks.json',JSON.stringify({deployment,createdAt:new Date().toISOString(),applicationSession:false,good,results},null,2));
console.log(JSON.stringify({good,results}));if(!good)process.exitCode=1;
