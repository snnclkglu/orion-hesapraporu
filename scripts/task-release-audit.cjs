/* İçerikler ve ortam değerleri raporlanmaz; yalnız kaynak parmak izi tutulur. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const changed = [...new Set([...git('diff','--name-only','HEAD').split('\n'), ...git('ls-files','--others','--exclude-standard').split('\n')])];
const files = changed.filter(p => /^(src\/|supabase\/|scripts\/|docs\/|plans\/)/.test(p) || /^(package(-lock)?\.json|next\.config\.ts|tsconfig\.json)$/.test(p))
 .filter(p => /\.(tsx?|jsx?|cjs|mjs|py|sql|json|md|css)$/.test(p) && fs.existsSync(p))
 .map(p => ({ path:p, sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), area:/cad|cizim-isleme|coolicons/.test(p)?'separate-work':/account|feedback|teams|task|panel|asana|profil/.test(p)?'panel-account':'shared-review' }));
function readEnv(file) {
 const env={}; if(!fs.existsSync(file)) return env;
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,''); }
 return env;
}
const expected=readEnv('.env.frankfurt').SUPABASE_PROJECT_REF;
const matches=file => {const env=readEnv(file);try{return expected && env.NEXT_PUBLIC_SUPABASE_URL ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname===`${expected}.supabase.co` : null;}catch{return null;}};
const report={ generatedAt:new Date().toISOString(), gitHead:git('rev-parse','HEAD'), deployed:false, environment:{localMatchesSupabase:matches('.env.local'),savedProductionMatchesSupabase:matches('.vercel/.env.production.local')}, warning:'Dağıtılmış sürüm değildir. separate-work ve shared-review dosyaları yayın öncesi ayrıca incelenmelidir.', files };
fs.mkdirSync('artifacts/task-release',{recursive:true});
fs.writeFileSync('artifacts/task-release/source-manifest.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({files:files.length, separateWork:files.filter(f=>f.area==='separate-work').length, environment:report.environment}));
