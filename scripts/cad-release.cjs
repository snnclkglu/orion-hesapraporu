/* --prepare yalnız yerel hash. --upload açık dağıtım yetkisi gerektirir. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const file = 'desktop/cad/dist/OrionCadYardimcisi.exe';
const object = 'releases/1.0.1/OrionCadYardimcisi.exe';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const bytes = fs.readFileSync(file);
  if (bytes.length > 100 * 1024 * 1024) throw new Error('Yardımcı kova boyut sınırını aşıyor.');
  const sha256 = hash(bytes);
  if (!process.argv.includes('--upload')) { console.log(JSON.stringify({ file, size: bytes.length, sha256 })); return; }
  const env = {};
  for (const file of ['.env.admin', '.env.frankfurt']) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  // Yönetici anahtarı yalnız bu işlemin belleğindedir; dosyaya/günlüğe yazılmaz.
  const response = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/api-keys`, { headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` } });
  if (!response.ok) throw new Error('Dağıtım yetkisi alınamadı: HTTP ' + response.status);
  const keys = await response.json();
  const key = keys.find(k => k.name === 'service_role')?.api_key;
  if (!key) throw new Error('Dağıtım için sunucu anahtarı bulunamadı.');
  const db = createClient(`https://${env.SUPABASE_PROJECT_REF}.supabase.co`, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = db.storage.from('cad-private');
  const existing = await bucket.info(object);
  if (existing.error) {
    const result = await bucket.upload(object, bytes, { contentType: 'application/octet-stream', upsert: false });
    if (result.error) throw new Error('Yardımcı paketi yüklenemedi.');
  }
  const downloaded = await bucket.download(object);
  if (downloaded.error || !downloaded.data || hash(Buffer.from(await downloaded.data.arrayBuffer())) !== sha256) throw new Error('Dağıtım hash değeri farklı; mevcut sürümün üzerine yazılmadı.');
  console.log(JSON.stringify({ uploaded: true, object, size: bytes.length, sha256 }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
