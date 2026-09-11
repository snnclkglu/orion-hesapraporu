"""Projenin mevcut bağlantısıyla sınırlı katalog/kimlik denetimi ve migration."""
import sys, json, ssl, re
from pathlib import Path
from urllib.parse import urlparse, unquote
sys.path.insert(0,str(Path('tmp/db-libs').resolve()))
import pg8000.native

env={}
for file in ['.env.frankfurt']:
 for line in Path(file).read_text(encoding='utf-8-sig').splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
url=urlparse(Path('supabase/.temp/pooler-url').read_text().strip())
db=pg8000.native.Connection(user=unquote(url.username),password=env['SUPABASE_DB_PASSWORD'],host=url.hostname,port=url.port or 5432,database='postgres',ssl_context=ssl.create_default_context(cafile='tmp/supabase-ca.crt'),timeout=30)
mode=sys.argv[1]
if mode=='inspect':
 result={
  'migrations':db.run("select version from supabase_migrations.schema_migrations where version >= '20260911000001' order by version"),
  'offer_reports':db.run("select count(*),count(*) filter(where doc_no like 'TEHR-%') from public.projects where report_context='offer'"),
  'flender':db.run("select model,attrs->>'allowed_radial_output_kn',attrs->>'series',count(*) from public.cat_equipment where brand='FLENDER' and kind='gearbox' group by 1,2,3 order by 1"),
 }
 Path('tmp/review-db-inspect.json').write_text(json.dumps(result,ensure_ascii=False,default=str),encoding='utf-8')
 print(json.dumps({'migrations':result['migrations'],'offer_reports':result['offer_reports'],'flender_groups':len(result['flender'])}))
elif mode=='migrate':
 p=Path(sys.argv[2]); match=re.fullmatch(r'(\d{14})_([a-z0-9_]+)\.sql',p.name); assert match
 assert p.parent==Path('supabase/migrations')
 sql=p.read_text(encoding='utf-8')
 db.run('begin')
 try:
  assert not db.run('select 1 from supabase_migrations.schema_migrations where version=:v',v=match[1]),'Zaten uygulanmış'
  db.run(sql)
  db.run('insert into supabase_migrations.schema_migrations(version,name,statements) values(:v,:n,:s)',v=match[1],n=match[2],s=[sql])
  db.run('commit'); print('Migration uygulandı: '+p.name)
 except:
  db.run('rollback'); raise
elif mode=='verify':
 db.run('begin')
 try:
  numbers=[]
  for _ in range(2):
   inserted=db.run("insert into public.projects(doc_no,name,customer,crane_type,report_context,created_by) select 'AUTO','NUMARA TESTİ',customer,crane_type,'offer',created_by from public.projects where report_context='offer' limit 1 returning id,doc_no")
   assert len(inserted)==1
   pid,no=inserted[0]; numbers.append(no)
   assert re.fullmatch(r'TEHR-\d{8}-[1-9]\d*',no)
   assert db.run("update public.projects set doc_no='DEĞİŞTİRME' where id=:id returning doc_no",id=pid)[0][0]==no
  assert numbers[0]!=numbers[1]
  print('Yeni kayıtlar benzersiz; güncelleme kimliği koruyor. Test kayıtları geri alındı.')
 finally: db.run('rollback')
 print(json.dumps({
  'numbers':db.run("select count(*), count(distinct doc_no), count(*) filter(where doc_no !~ '^TEHR-[0-9]{8}-[1-9][0-9]*$') from public.projects where report_context='offer'"),
  'flender_series':db.run("select attrs->>'series', count(*) from public.cat_equipment where brand='FLENDER' and kind='gearbox' group by 1"),
  'rope_manifest':db.run("select count(*) from jsonb_array_elements(public.auto_selection_catalog_manifest()) f where f->>'kind'='rope' and f->'attrs'->>'construction'='6x36 WS'")
 }))
elif mode=='rope-fixture':
 rows=db.run("select distinct on(brand) id,kind,brand,model,attrs,datasheet_url from public.cat_equipment where kind='rope' and brand in ('HAŞÇELİK','İZMİT A.Ş.') and attrs->>'construction'='6x36 WS' order by brand,model,id")
 assert len(rows)==2
 Path('src/lib/auto-selection/fixtures/catalog-standard-ropes.json').write_text(json.dumps([dict(zip(['id','kind','brand','model','attrs','datasheet_url'],r)) for r in rows],ensure_ascii=False,indent=2,default=str),encoding='utf-8')
 print('İki gerçek halat satırı önizleme fikstürüne alındı.')
else: raise ValueError('Bilinmeyen işlem')
db.close()
