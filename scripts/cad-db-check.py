"""Yalnız CAD migration'ını test eder / uygular. Şirket verisi yazdırmaz."""
import hashlib
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
    '20260912120000_cad_processing.sql',
    '20260912120001_cad_export_integrity.sql',
)]
try:
    db.run('begin')
    for path in paths:
        source=path.read_text(encoding='utf-8-sig')
        version,name=path.stem.split('_',1)
        exists=db.run('select statements from supabase_migrations.schema_migrations where version=:v',v=version)
        if exists:
            saved=''.join(exists[0][0] or [])
            if saved != source:
                raise RuntimeError('Uygulanmış CAD migration kaynağı farklı; yeni migration gerekli.')
        elif mode=='verify':
            raise RuntimeError('CAD migration uygulanmamış: '+path.name)
        else:
            db.run(source)
            db.run('insert into supabase_migrations.schema_migrations(version,name,statements) values(:v,:n,:s)',v=version,n=name,s=[source])
    if mode=='test':
        db.run(Path('scripts/cad-db-tests.sql').read_text(encoding='utf-8-sig'))
        db.run('rollback')
        print('CAD şema, sekiz rol, RLS, cihaz/iş sahipliği, süre aşımı, iptal ve tekil aktarım testleri geçti. Test verisi geri alındı.')
    elif mode=='apply':
        db.run('commit')
        print('Yalnız CAD migration uygulandı: '+path.name)
    else:
        flags=db.run("select relname,relrowsecurity from pg_class where relname in ('cad_devices','cad_device_secrets','cad_jobs','cad_artifacts') order by relname")
        db.run('rollback')
        print('CAD RLS doğrulaması: '+str(flags))
finally:
    db.close()
