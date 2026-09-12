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
files=sorted(Path('supabase/migrations').glob('2026091218*_agent_*.sql'))
db.run('begin')
try:
 for p in files:
  version,name=p.stem.split('_',1)
  if db.run('select 1 from supabase_migrations.schema_migrations where version=:v',v=version): continue
  sql=p.read_text(encoding='utf-8')
  db.run(sql)
  db.run('insert into supabase_migrations.schema_migrations(version,name,statements) values(:v,:n,:s)',v=version,n=name,s=[sql])
 if mode=='test':
  db.run(Path('scripts/integrations-db-tests.sql').read_text(encoding='utf-8'))
  db.run('rollback');print('API yönetim şeması ve güvenlik testleri geçti; bütün test değişiklikleri geri alındı.')
 elif mode=='migrate':
  db.run('commit');print('API yönetim migrationları uygulandı.')
 else:
  db.run('rollback');raise ValueError('test veya migrate seçin')
except:
 db.run('rollback');raise
finally: db.close()
