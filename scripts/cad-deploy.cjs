/* Yalnız cad-api fonksiyonunu hazırlar/dağıtır; proje secret anahtarları alınmaz. */
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const root='tmp/cad-api-package';fs.mkdirSync(root,{recursive:true});
fs.copyFileSync('supabase/functions/cad-api/index.js',`${root}/index.js`);
for(const name of ['service','contracts','history']) {
 const source=fs.readFileSync(`src/lib/cad/${name}.ts`,'utf8').replace('from "zod"','from "npm:zod@4.4.3"').replace('from "@/lib/roles"','from "./roles.js"').replace('from "./contracts"','from "./contracts.js"').replace('from "./history"','from "./history.js"');
 fs.writeFileSync(`${root}/${name}.js`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
}
const roles=fs.readFileSync('src/lib/roles.ts','utf8');const match=roles.match(/export function canProcessCad\([^]*?\n\}/);
if(!match)throw new Error('CAD yetki kaynağı bulunamadı.');
fs.writeFileSync(`${root}/roles.js`,ts.transpileModule(match[0],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
if(process.argv.includes('--prepare'))process.exit(0);
(async()=>{
 const env={};for(const file of ['.env.admin','.env.frankfurt'])for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
 const form=new FormData();form.set('metadata',JSON.stringify({name:'cad-api',entrypoint_path:'index.js',verify_jwt:false}));
 for(const name of ['index.js','service.js','contracts.js','history.js','roles.js'])form.append('file',new Blob([fs.readFileSync(path.join(root,name))],{type:'application/javascript'}),name);
 const dry=process.argv.includes('--check');
 const response=await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/functions/deploy?slug=cad-api${dry?'&bundleOnly=1':''}`,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`},body:form});
 if(!response.ok){console.error(`CAD fonksiyonu ${dry?'paket kontrolü':'dağıtımı'} başarısız: HTTP ${response.status}`);process.exitCode=1;return;}
 const result=await response.json();console.log(JSON.stringify({ok:true,mode:dry?'check':'deploy',slug:result.slug,status:result.status,version:result.version}));
})().catch(()=>{console.error('CAD fonksiyonu işlemi tamamlanamadı.');process.exitCode=1});
