/* Yalnız dar bakım fonksiyonunun kaynağını mevcut Supabase projesine gönderir. */
const fs = require('node:fs');
(async () => {
  const source = fs.readFileSync('supabase/functions/account-maintenance/index.js');
  if (process.argv.includes('--prepare')) { console.log(JSON.stringify({ prepared: true, bytes: source.length })); return; }
  const env = {};
  for (const file of ['.env.admin', '.env.frankfurt']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  const check = process.argv.includes('--check');
  const form = new FormData();
  form.set('metadata', JSON.stringify({ name: 'account-maintenance', entrypoint_path: 'index.js', verify_jwt: false }));
  form.append('file', new Blob([source], { type: 'application/javascript' }), 'index.js');
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/functions/deploy?slug=account-maintenance${check ? '&bundleOnly=1' : ''}`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` }, body: form,
  });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  const result = await r.json();
  console.log(JSON.stringify({ ok: true, mode: check ? 'check' : 'deploy', slug: result.slug, status: result.status, version: result.version }));
})().catch(e => { console.error(`Bakım fonksiyonu hazırlanamadı: ${e.message}`); process.exitCode = 1; });
