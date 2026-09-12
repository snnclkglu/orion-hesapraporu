/* Deneme dağıtımına yalnız uygulamanın çalışma dosyaları girer; yerel sırlar ve Edge kaynakları girmez. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const git = (...args) => execFileSync('git', args, { encoding:'utf8', stdio:['ignore','pipe','ignore'] });
const baselineArg=process.argv.find(x=>x.startsWith('--baseline='))?.slice(11);
const baseline=baselineArg?path.resolve(root,baselineArg):null;
if(baseline&&!baseline.startsWith(path.resolve(root,'tmp')+path.sep))throw Error('Temel paket çalışma klasöründe olmalı');
function walk(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name),prefix+entry.name+'/'):[prefix+entry.name]);}
const overlay=['src/lib/account/image-transport.ts','src/types/libheif.d.ts','src/components/account/account-view.tsx','src/components/account/feedback-form.tsx'];
const files = [...new Set(baseline?[...walk(baseline),...overlay]:[...git('ls-files','-z').split('\0'), ...git('ls-files','--others','--exclude-standard','-z').split('\0')])]
 .filter(p => p === 'docs/task-api.openapi.json' || /^(src\/|public\/|catalog-sheets\/)/.test(p) || /^(package(-lock)?\.json|next\.config\.ts|tsconfig\.json|postcss\.config\.mjs|vercel\.json)$/.test(p))
 .filter(p => !/(^|\/)(__tests__|__fixtures__|fixtures)(\/|$)|\.test\.[cm]?[jt]sx?$|^src\/app\/dev\//.test(p));
const target=path.resolve('tmp',`panel-preview-${Date.now()}`);
fs.mkdirSync(target,{recursive:false});
let bytes=0;
const entries=[];
for(const file of files){
 const source=path.resolve(baseline&&!overlay.includes(file)?baseline:root,file), destination=path.resolve(target,file);
 if(!source.startsWith(root+path.sep)||!destination.startsWith(target+path.sep))throw Error('Geçersiz yol');
 if(!fs.existsSync(source))continue;
 if(!fs.lstatSync(source).isFile())throw Error('Yalnız normal dosyalar paketlenebilir');
 const data=fs.readFileSync(source); bytes+=data.length;
 fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);
 entries.push({path:file,sha256:crypto.createHash('sha256').update(data).digest('hex')});
}
fs.mkdirSync(path.join(target,'.vercel'));fs.copyFileSync('.vercel/project.json',path.join(target,'.vercel/project.json'));
fs.writeFileSync(path.join(target,'.vercelignore'),'node_modules\n.next\n.next-task-check\n.env*\n');
const manifest={target,baseline,overlay:baseline?overlay:null,createdAt:new Date().toISOString(),gitHead:git('rev-parse','HEAD').trim(),files:entries,bytes,production:false};
fs.mkdirSync('artifacts/task-release',{recursive:true});
fs.writeFileSync('artifacts/task-release/preview-package.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({target,files:entries.length,megabytes:Math.round(bytes/1024/1024),gitHead:manifest.gitHead}));
