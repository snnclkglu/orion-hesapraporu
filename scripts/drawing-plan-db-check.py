"""Yalnız Teknik resim migration'ını test eder / uygular. Şirket verisi yazdırmaz."""
from pathlib import Path
import ssl
import sys
from urllib.parse import urlparse, unquote
import pg8000.native

mode = sys.argv[1] if len(sys.argv)>1 else 'test'
if mode not in ('test', 'apply', 'verify'):
    raise SystemExit('Kip: test | apply | verify')
env = {}
for filename in ('.env.local','.env.frankfurt'):
    path=Path(filename)
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key,value=line.split('=',1);env[key.strip()]=value.strip().strip('"').strip("'")
parsed=urlparse(Path('supabase/.temp/pooler-url').read_text().strip())
ca=Path('tmp/supabase-ca.crt')
tls=ssl.create_default_context(cafile=str(ca) if ca.exists() else None)
tls.verify_flags &= ~ssl.VERIFY_X509_STRICT
db=pg8000.native.Connection(user=unquote(parsed.username),password=env['SUPABASE_DB_PASSWORD'],host=parsed.hostname,port=parsed.port or 5432,database='postgres',ssl_context=tls,timeout=60)
paths=[Path('supabase/migrations/'+name) for name in (
    '20260912233000_drawing_plan_automation.sql',
)]
try:
    db.run('begin')
    core_snapshot = "select md5(coalesce(string_agg(concat_ws('|',id::text,project_id::text,code,name,status,drawn_by::text,note), E'\\n' order by id),'')) from project_drawing_plan"
    before = db.run(core_snapshot)
    for path in paths:
        source=path.read_text(encoding='utf-8-sig')
        version,name=path.stem.split('_',1)
        exists=db.run('select statements from supabase_migrations.schema_migrations where version=:v',v=version)
        if exists:
            saved=''.join(exists[0][0] or [])
            if saved != source:
                raise RuntimeError('Uygulanmış Teknik resim migration kaynağı farklı; yeni migration gerekli.')
        elif mode=='verify':
            raise RuntimeError('Teknik resim migration uygulanmamış: '+path.name)
        else:
            db.run(source)
            db.run('insert into supabase_migrations.schema_migrations(version,name,statements) values(:v,:n,:s)',v=version,n=name,s=[source])
    if mode=='test':
        db.run(Path('scripts/drawing-plan-db-tests.sql').read_text(encoding='utf-8-sig'))
        db.run('rollback')
        print('Teknik resim şeması, RLS, numara takası, sürüm çatışması, döngü ve geri alma testleri geçti. Test verisi geri alındı.')
    elif mode=='apply':
        if db.run(core_snapshot) != before:
            raise RuntimeError('Mevcut resim verisi değişti; işlem geri alınacak.')
        db.run('commit')
        print('Yalnız Teknik resim migration uygulandı: '+path.name)
    else:
        flags=db.run("select relname,relrowsecurity from pg_class where relname in ('project_drawing_plan','project_drawing_plan_state') order by relname")
        db.run('rollback')
        print('Teknik resim RLS doğrulaması: '+str(flags))
finally:
    db.close()
