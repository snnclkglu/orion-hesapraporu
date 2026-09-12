/* Mevcut yönetim yetkisiyle yalnız bu fonksiyonu dağıtır; hiçbir proje anahtarını almaz. */
const fs=require('node:fs');const ts=require('typescript');
const root='tmp/account-media-package';fs.mkdirSync(root,{recursive:true});
fs.copyFileSync('supabase/functions/account-media/index.js',`${root}/index.js`);
fs.writeFileSync(`${root}/webp.js`,ts.transpileModule(fs.readFileSync('src/lib/account/webp.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
if(process.argv.includes('--prepare'))process.exit(0);
(async()=>{
 const env={};for(const file of ['.env.admin','.env.frankfurt'])for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
 const form=new FormData();form.set('metadata',JSON.stringify({name:'account-media',entrypoint_path:'index.js',verify_jwt:true}));for(const name of ['index.js','webp.js'])form.append('file',new Blob([fs.readFileSync(`${root}/${name}`)],{type:'application/javascript'}),name);
 const dry=process.argv.includes('--check');
 const r=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/functions/deploy?slug=account-media${dry?'&bundleOnly=1':''}`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`},body:form});
 if(!r.ok){const detail=(await r.text()).replace(/sbp_[A-Za-z0-9]+/g,'[gizlendi]').slice(0,1200);console.error(`Fonksiyon ${dry?'paket kontrolü':'dağıtımı'} başarısız: HTTP ${r.status} ${detail}`);process.exitCode=1;return;}
 const result=await r.json();console.log(JSON.stringify({ok:true,mode:dry?'check':'deploy',slug:result.slug,status:result.status,version:result.version}));
})().catch(()=>{console.error('Fonksiyon dağıtımı tamamlanamadı.');process.exitCode=1});
