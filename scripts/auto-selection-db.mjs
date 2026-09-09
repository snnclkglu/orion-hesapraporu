// Hızlı seçim veritabanı denetimi. Gizli bilgiler ortamdan veya mevcut env dosyalarından okunur.
import fs from 'node:fs';
for (const file of ['.env.local', '.env.frankfurt', '.env.admin']) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) throw new Error('Veritabanı bağlantı ayarları bulunamadı.');
const mode = process.argv[2] || 'inspect';
let query;
if (mode === 'inspect') query = `select kind, brand, count(*)::int as count,
 count(*) filter(where attrs ? 'thermal_power_kw')::int as thermal,
 count(*) filter(where attrs ? 'input_shaft_mm')::int as input_shaft
 from cat_equipment group by kind,brand order by kind,brand`;
else if (mode === 'catalog') query = `select id, kind, brand, model, attrs, datasheet_url
 from cat_equipment order by kind,brand,model,id`;
else if (mode === 'query') query = fs.readFileSync(process.argv[3], 'utf8');
else if (mode === 'migrate') {
  const path = process.argv[3];
  const match = /(?:^|[/\\])(\d{14})_([a-z0-9_]+)\.sql$/.exec(path ?? '');
  if (!match) throw new Error('Geçersiz migration dosyası.');
  const sql = fs.readFileSync(path, 'utf8');
  const quoted = value => "'" + value.replaceAll("'", "''") + "'";
  query = `begin; ${sql}\n insert into supabase_migrations.schema_migrations(version,name,statements) values (${quoted(match[1])},${quoted(match[2])},array[${quoted(sql)}]); commit;`;
}
else throw new Error('Bilinmeyen işlem.');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!response.ok) throw new Error(`Veritabanı isteği başarısız: HTTP ${response.status}`);
const result = await response.json();
if (mode === 'catalog') {
  fs.mkdirSync('tmp/auto-selection', { recursive: true });
  fs.writeFileSync('tmp/auto-selection/catalog.json', JSON.stringify(result));
  console.log(JSON.stringify({ rows: result.length, output: 'tmp/auto-selection/catalog.json' }));
} else console.log(JSON.stringify(result));
