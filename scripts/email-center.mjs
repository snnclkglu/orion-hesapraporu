// Codex'in şablon/kuralları kod dağıtımı olmadan yönetmesi için dar istemci.
import fs from 'node:fs';
if(fs.existsSync('.env.email-agent'))process.loadEnvFile('.env.email-agent');
const token=process.env.ORION_EMAIL_AGENT_TOKEN;
if(!token)throw new Error('E-posta ajanı bağlantı anahtarı bulunamadı.');
const base='https://app.orioncranes.com/api/agent/email-center';
const mode=process.argv[2]??'get';
const headers={Authorization:`Bearer ${token}`};
let url=base;let body;
if(mode==='command'){
  if(!process.argv[3]||!process.argv[4])throw new Error('Komut JSON dosyası ve benzersiz istek anahtarı gerekli.');
  body=fs.readFileSync(process.argv[3],'utf8');JSON.parse(body);
  headers['Content-Type']='application/json';headers['Idempotency-Key']=process.argv[4];
}else if(mode==='get'){
  const query=process.argv[3]??'';if(query && !query.startsWith('?'))throw new Error('Süzgeç ? ile başlamalı.');url+=query;
}else throw new Error('İşlem get veya command olmalı.');
const response=await fetch(url,{method:mode==='command'?'POST':'GET',headers,body,signal:AbortSignal.timeout(60000)});
const data=await response.json();
if(!response.ok){console.error(JSON.stringify({status:response.status,...data}));process.exit(1);}
console.log(JSON.stringify(data,null,2));
