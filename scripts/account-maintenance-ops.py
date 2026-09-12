"""Dar bakım anahtarı yalnız Supabase Vault/Edge içinde saklanır; geniş anahtar alınmaz."""
import json, secrets, ssl, sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError

sys.path.insert(0, str(Path('tmp/db-libs').resolve()))
import pg8000.native

env = {}
for file in ['.env.frankfurt', '.env.admin']:
 for line in Path(file).read_text(encoding='utf-8-sig').splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k, v = line.split('=', 1); env[k.strip()] = v.strip().strip('"').strip("'")
url = urlparse(Path('supabase/.temp/pooler-url').read_text().strip())
tls = ssl.create_default_context(cafile='tmp/supabase-ca.crt')
tls.verify_flags &= ~ssl.VERIFY_X509_STRICT
db = pg8000.native.Connection(user=unquote(url.username), password=env['SUPABASE_DB_PASSWORD'], host=url.hostname, port=url.port or 5432, database='postgres', ssl_context=tls, timeout=45)
mode = sys.argv[1] if len(sys.argv)>1 else 'inspect'
job_name = 'orion-account-media-maintenance'
secret_name = 'orion_account_maintenance_key'
endpoint = f"https://{env['SUPABASE_PROJECT_REF']}.supabase.co/functions/v1/account-maintenance"

def request_json(url, body, headers=None):
 req = Request(url, data=json.dumps(body).encode(), headers={'Content-Type':'application/json', **(headers or {})}, method='POST')
 try:
  with urlopen(req, timeout=120) as result:
   raw = result.read(); return json.loads(raw) if raw else None
 except HTTPError as error:
  raise RuntimeError(f'HTTP {error.code}') from None

def status():
 result = {'extensions': db.run("select extname from pg_extension where extname in ('pg_cron','pg_net','supabase_vault')"), 'cron_timezone': db.run("select current_setting('cron.timezone',true)")}
 if db.run("select to_regclass('cron.job')")[0][0]:
  result['job'] = db.run('select jobid,schedule,active from cron.job where jobname=:n', n=job_name)
 if db.run("select to_regclass('public.account_maintenance_runs')")[0][0]:
  result['runs'] = db.run('select started_at,mode,status,candidates,removed,failed,drafts,error_code from account_maintenance_runs order by started_at desc limit 5')
 result['candidate_counts'] = db.run("select x->>'bucket_id',count(*) from jsonb_array_elements(account_cleanup_candidates()) x group by 1")
 return result

try:
 if mode == 'inspect':
  print(json.dumps(status(),default=str))
 elif mode == 'configure':
  db.run('create extension if not exists pg_cron')
  db.run('create extension if not exists pg_net')
  if not db.run("select 1 from pg_extension where extname='supabase_vault'"): raise RuntimeError('Vault bulunamadı')
  timezone = db.run("select current_setting('cron.timezone',true)")[0][0]
  if timezone not in (None,'GMT','UTC','Etc/UTC'): raise RuntimeError('Zamanlayıcı saat dilimi ayrıca incelenmeli')
  jobs = db.run('select jobid from cron.job where jobname=:n', n=job_name)
  if jobs: db.run('select cron.alter_job(:id,active:=false)',id=jobs[0][0])
  # Yalnız bu bakımın anahtarı üretilir; hiçbir geniş proje anahtarı sorgulanmaz.
  narrow_key = secrets.token_hex(32)
  request_json(f"https://api.supabase.com/v1/projects/{env['SUPABASE_PROJECT_REF']}/secrets", [{'name':'ACCOUNT_MAINTENANCE_KEY','value':narrow_key}], {'Authorization':f"Bearer {env['SUPABASE_ACCESS_TOKEN']}"})
  existing = db.run('select id from vault.secrets where name=:n',n=secret_name)
  if existing: db.run('select vault.update_secret(:id,:value)',id=existing[0][0],value=narrow_key)
  else: db.run('select vault.create_secret(:value,:name)',value=narrow_key,name=secret_name)
  # İlk uzaktan çalışma kesinlikle silmesizdir. Başarısızsa zamanlama kapalı kalır.
  dry = request_json(endpoint, {'apply':False}, {'x-account-maintenance-key':narrow_key})
  if dry.get('mode')!='dry-run' or dry.get('removed')!=0 or dry.get('error'): raise RuntimeError('İlk rapor doğrulanamadı')
  command = "select net.http_post(url := '"+endpoint+"', headers := jsonb_build_object('Content-Type','application/json','x-account-maintenance-key',(select decrypted_secret from vault.decrypted_secrets where name='"+secret_name+"')), body := '{\"apply\":true}'::jsonb, timeout_milliseconds := 120000);"
  job = db.run('select cron.schedule(:name,:schedule,:command)',name=job_name,schedule='15 0 * * *',command=command)[0][0]
  db.run('select cron.alter_job(:id,active:=true)',id=job)
  print(json.dumps({'configured':True,'daily_turkey_time':'03:15','dry_run':dry,'status':status()},default=str))
 elif mode in ('pause','resume'):
  jobs = db.run('select jobid from cron.job where jobname=:n',n=job_name)
  if not jobs: raise RuntimeError('Bakım zamanlaması bulunamadı')
  if mode=='resume' and not db.run("select 1 from account_maintenance_runs where mode='dry-run' and status='completed' limit 1"): raise RuntimeError('Önce salt rapor doğrulanmalı')
  db.run('select cron.alter_job(:id,active:=:active)',id=jobs[0][0],active=mode=='resume')
  print(json.dumps({'active':mode=='resume'}))
 elif mode == 'dry-run':
  # Dar anahtarın kendisi bilgisayara alınmaz; çağrı Vault üzerinden veritabanında yapılır.
  request_id=db.run("select net.http_post(url:=:url,headers:=jsonb_build_object('Content-Type','application/json','x-account-maintenance-key',(select decrypted_secret from vault.decrypted_secrets where name=:name)),body:='{\"apply\":false}'::jsonb,timeout_milliseconds:=120000)",url=endpoint,name=secret_name)[0][0]
  print(json.dumps({'queued_read_only_request':request_id}))
 else: raise RuntimeError('Bilinmeyen işlem')
except Exception as error:
 # Sorgu parametreleri, HTTP gövdeleri ve kimlik bilgileri yazdırılmaz.
 print(json.dumps({'ok':False,'operation':mode,'error':str(error) if isinstance(error,RuntimeError) else type(error).__name__}))
 sys.exit(1)
finally:
 db.close()
