"""MD 20.1 s.9/8 görsel kontrolü: standart masif mil FR2 alt sınırları (kN)."""
import json
from pathlib import Path

# Boylar 4–18; H1 ve büyük gövdeler için sayısal kapasite yayımlanmamıştır.
values = {
 'H2':[10,13,13,18,18,10,28,35,35,112,112,85,135,135,135],
 'B2':[12,15,15,17,17,10,30,35,38,110,110,75,145,100,100],
 'H3':[None,18,18,26,26,18,40,50,50,150,150,120,185,185,190],
 'H4':[None,None,None,26,26,18,40,50,50,150,150,120,185,185,190],
 'B3':[9,18,18,26,26,18,40,50,50,150,150,120,185,185,190],
 'B4':[None,18,18,26,26,18,40,50,50,150,150,120,185,185,190],
}
source=Path('../catalog_data/reducers/flender_md20_1.json')
data=json.loads(source.read_text(encoding='utf-8'))
for item in data['items']:
 typ=item['model'].split('-')[0]; size=int(item['frame_size'])
 expected=values.get(typ,[None]*15)[size-4] if 4 <= size <= 18 else None
 assert item.get('permitted_radial_load_output_N') == (expected*1000 if expected else None), (typ,size)
note='MD 20.1 s.9/8: standart masif mil S, mil uzantısı ortasında kuvvet; düşeyden ±35°, f1 ≥ 1,2. Mil versiyonlarının en küçük FR2 değeri. H1 ve 19+ boylar üretici teyidi gerektirir; takviyeli yatak V tablosu kullanılmaz.'
rows=[]
for typ,items in values.items():
 for size,value in enumerate(items,4):
  if value is not None: rows.append(f"('{typ}-{size:02d}',{value})")
sql="""-- FLENDER: sayısal kaynak PDF s.9/8; N→kN dönüşümü tek kez yapılır.
with radial(model,kn) as (values
"""+',\n'.join(rows)+"""
)
update public.cat_equipment e set attrs = (e.attrs - 'allowed_radial_output_kn') ||
 jsonb_build_object('allowed_radial_output_kn',r.kn)
from radial r where e.kind='gearbox' and e.brand='FLENDER' and e.model=r.model;
update public.cat_equipment set attrs = attrs - 'allowed_radial_output_kn'
where kind='gearbox' and brand='FLENDER' and (model ~ '^H1-' or substring(model from '-([0-9]+)')::int >= 19);
update public.cat_equipment set attrs = attrs || jsonb_build_object(
 'series',case when model ~ '^H[1-4]-' then 'H' else attrs->>'series' end,
 'stage_type',split_part(model,'-',1), 'radial_load_basis',
"""+"'"+note.replace("'","''")+"');\n"
# Son UPDATE yalnız Flender redüktörlerini kapsar.
sql=sql[:-2]+"\nwhere kind='gearbox' and brand='FLENDER';\n"
rpc=Path('supabase/migrations/20260909000006_auto_selection_series.sql').read_text(encoding='utf-8')
rpc=rpc.replace("'series', attrs->'series',", "'series', attrs->'series', 'construction', attrs->'construction',")
rpc=rpc.replace("f->>'series' = e.attrs->>'series'", "f->>'series' = case when e.kind='rope' then e.attrs->>'construction' else e.attrs->>'series' end")
Path('supabase/migrations/20260911000005_catalog_series_and_radial_review.sql').write_text(sql+'\n'+rpc,encoding='utf-8')
print(f"{len(data['items'])} Flender satırı PDF alt sınırlarıyla uyumlu; {len(rows)} tip/boy doğrulandı.")
