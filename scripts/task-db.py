"""Görev alanı şemasını önce geri alınan transaction içinde doğrular."""
import sys, ssl, json, time
from pathlib import Path
from urllib.parse import urlparse, unquote
sys.path.insert(0,str(Path('tmp/db-libs').resolve()))
import pg8000.native
env={}
for line in Path('.env.frankfurt').read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);env[k.strip()]=v.strip().strip('"').strip("'")
url=urlparse(Path('supabase/.temp/pooler-url').read_text().strip())
tls=ssl.create_default_context(cafile='tmp/supabase-ca.crt')
tls.verify_flags &= ~ssl.VERIFY_X509_STRICT  # Yerel Supabase CA zinciri; isim ve zincir doğrulaması korunur.
db=pg8000.native.Connection(user=unquote(url.username),password=env['SUPABASE_DB_PASSWORD'],host=url.hostname,port=url.port or 5432,database='postgres',ssl_context=tls,timeout=45)
mode=sys.argv[1]
files=sorted(Path('supabase/migrations').glob('20260912*_task_*.sql'))
if mode=='inspect':
 print(json.dumps({'counts':db.run("select 'job_tasks',count(*) from job_tasks union all select 'user_todos',count(*) from user_todos"),'versions':db.run("select version from supabase_migrations.schema_migrations order by version desc limit 5")},default=str))
elif mode in ('test','migrate','benchmark'):
 db.run('begin')
 try:
  for p in files:
   version,name=p.stem.split('_',1)
   if db.run('select 1 from supabase_migrations.schema_migrations where version=:v',v=version): continue
   db.run(p.read_text(encoding='utf-8'))
   db.run('insert into supabase_migrations.schema_migrations(version,name,statements) values(:v,:n,:s)',v=version,n=name,s=[p.read_text(encoding='utf-8')])
  if mode in ('test','benchmark'):
   db.run(Path('scripts/task-db-tests.sql').read_text(encoding='utf-8'))
   db.run(Path('scripts/account-db-tests.sql').read_text(encoding='utf-8'))
   db.run(Path('scripts/task-workflow-db-tests.sql').read_text(encoding='utf-8'))
   db.run(Path('scripts/account-maintenance-db-tests.sql').read_text(encoding='utf-8'))
   if mode=='benchmark':
    actor=db.run("select id from profiles where role='admin' limit 1")[0][0]
    db.run("select set_config('request.jwt.claim.sub',:a,true),set_config('request.jwt.claim.role','authenticated',true)",a=str(actor))
    db.run("insert into job_tasks(title,created_by,assignee,visibility) select 'Yük doğrulama '||i,:a,:a,'private' from generate_series(1,10000) i",a=actor)
    start=time.perf_counter()
    result=db.run("select task_snapshot('{\"q\":\"Yük doğrulama\",\"view\":\"mine\"}',:a)",a=actor)[0][0]
    elapsed=round((time.perf_counter()-start)*1000)
    assert result['total']==10000 and len(result['tasks'])==50
    print(json.dumps({'test_records':10000,'page_size':50,'snapshot_ms':elapsed}))
   db.run('rollback'); print('Şema, geçiş ve görev senaryoları geçti; test değişiklikleri geri alındı.')
  else:
   db.run('commit');print('Görev migrationları uygulandı: '+', '.join(p.name for p in files))
 except:
  db.run('rollback');raise
db.close()

