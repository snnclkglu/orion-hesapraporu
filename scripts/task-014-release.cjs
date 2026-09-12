/* Yayındaki 012 kaynak kopyası üzerine yalnız görev geliştirmelerini ekler. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const deployedCommit='ce4bc79df3c835cd47e066f9ccee7dab39e34f44';
const root=process.cwd(),baseline=path.resolve('tmp/integrations-release'),target=path.resolve('tmp',`task-014-release-${Date.now()}`);
if(!fs.existsSync(path.join(baseline,'src/app/(app)/admin/integrations/page.tsx')))throw Error('Doğrulanmış temel kaynak eksik');
fs.mkdirSync(target);
for(const dir of ['src','public','catalog-sheets','supabase','docs'])fs.cpSync(path.join(baseline,dir),path.join(target,dir),{recursive:true});
for(const file of ['.gitignore','package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','postcss.config.mjs','vercel.json','eslint.config.mjs','vitest.config.ts'])fs.copyFileSync(path.join(baseline,file),path.join(target,file));
const files=[
 'src/app/(app)/admin/admin-nav.tsx',
 'src/app/(app)/page.tsx','src/app/(app)/panel/task-workspace.tsx','src/app/(app)/panel/task-workspace.css',
 'src/app/api/agent/tasks/[[...segments]]/route.ts','src/app/api/agent/tasks/tasks-api.test.ts','src/app/dev/panel-preview/page.tsx',
 'src/components/account/task-action-menu.tsx','src/components/account/task-cancel-dialog.tsx','src/components/account/task-tag-picker.tsx','src/components/account/task-touch-surface.tsx','src/components/account/task-workflow.tsx',
 'src/components/ui/dialog.tsx','src/components/ui/mobile-form-viewport.ts','src/components/ui/mobile-form-viewport.css',
 'src/lib/tasks/model.ts','src/lib/tasks/service.ts','src/lib/tasks/service.test.ts','src/lib/tasks/tags.ts','src/lib/tasks/tags.test.ts',
 'src/lib/integrations/model.ts','src/lib/integrations/catalog.ts','src/lib/integrations/integrations.test.ts',
 'supabase/migrations/20260912200000_task_tags.sql','supabase/migrations/20260912210000_task_cancellation.sql',
 'docs/task-api.openapi.json','docs/task-workspace.md','docs/grokbot-task-tags.md'
];
// 012 yayınından sonra canlıya çıkan CAD ve alt gezinme commitleri korunur.
const preserved=execFileSync('git',['diff','--name-only','6a512dd',deployedCommit],{encoding:'utf8'}).trim().split('\n').filter(file=>file.startsWith('src/'));
for(const file of preserved){fs.mkdirSync(path.dirname(path.join(target,file)),{recursive:true});fs.writeFileSync(path.join(target,file),execFileSync('git',['show',`${deployedCommit}:${file}`]));}
// Görev değişiklikleri korunmuş canlı kaynakların üzerine gelir; alt bar entegrasyonu artık yayındadır.
for(const file of files){fs.mkdirSync(path.dirname(path.join(target,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(target,file));}
fs.mkdirSync(path.join(target,'.vercel'));fs.copyFileSync(path.join(root,'.vercel/project.json'),path.join(target,'.vercel/project.json'));
fs.copyFileSync(path.join(root,'.env.local'),path.join(target,'.env.local'));
fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
fs.writeFileSync(path.join(target,'.vercelignore'),'node_modules\n.next*\n.env*\n/supabase\nsrc/app/dev\n**/*.test.ts\n**/*.test.tsx\n**/__tests__\ndocs/**\n!docs/task-api.openapi.json\n');
const manifest={target,baseline,baseDeployment:'dpl_3A5MsQKdwLmqjbm1anrMacbLxAvu',deployedCommit,preserved,deployed:false,createdAt:new Date().toISOString(),files:[...new Set([...files,...preserved])].map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(target,file))).digest('hex')}))};
fs.mkdirSync('artifacts/task-014-release',{recursive:true});fs.writeFileSync('artifacts/task-014-release/source.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({target,overlayFiles:files.length}));
