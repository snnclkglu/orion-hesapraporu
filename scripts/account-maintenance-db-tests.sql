-- Yalnız geri alınan transaction içinde; gerçek Storage dosyası oluşturulmaz/silinmez.
do $$
declare a uuid; folder text; old_folder text; mixed_folder text; f uuid:=gen_random_uuid(); draft uuid:=gen_random_uuid(); empty_draft uuid:=gen_random_uuid(); live_draft uuid:=gen_random_uuid(); run jsonb; rid uuid; list jsonb; n integer;
begin
 select id into a from profiles where role<>'admin' limit 1;
 folder:=a||'/'||gen_random_uuid(); old_folder:=a||'/'||gen_random_uuid(); mixed_folder:=a||'/'||gen_random_uuid();
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 insert into storage.objects(bucket_id,name,created_at) values
  ('account-avatars',folder||'/64.webp',clock_timestamp()),('account-avatars',folder||'/256.webp',clock_timestamp()),
  ('account-avatars',old_folder||'/64.webp',now()-interval '26 hours'),('account-avatars',old_folder||'/256.webp',now()-interval '26 hours'),
  ('account-avatars',mixed_folder||'/64.webp',now()-interval '26 hours'),('account-avatars',mixed_folder||'/256.webp',clock_timestamp());
 update profiles set avatar_path=folder where id=a;
 update storage.objects set created_at=now()-interval '26 hours' where bucket_id='account-avatars' and name like folder||'/%';
 set local role authenticated;
 begin update profiles set avatar_path=mixed_folder where id=a; raise exception using errcode='Z0001',message='Eski küçük fotoğraf tekrar bağlandı'; exception when check_violation then null; end;
 begin perform account_maintenance_begin(true); raise exception using errcode='Z0001',message='Kullanıcı bakım başlattı'; exception when insufficient_privilege then null; end;
 reset role;
 insert into app_feedback(id,user_id,body,expected_files,created_at,submitted_at) values
  (f,a,'Kesinleşmiş geri alma kontrolü',1,now()-interval '30 hours',now()-interval '26 hours'),
  (draft,a,'Süresi dolmuş geri alma kontrolü',1,now()-interval '30 hours',null),
  (live_draft,a,'Güncel geri alma kontrolü',1,now()-interval '2 hours',null);
 insert into storage.objects(bucket_id,name,created_at)
 select 'feedback-images',a||'/'||x||'/0-'||gen_random_uuid()||'.webp',now()-interval '26 hours' from unnest(array[f,draft,live_draft]) x;
 insert into app_feedback_attachments(feedback_id,slot,object_path,name,bytes)
 select split_part(name,'/',2)::uuid,0,name,'Geri alınan kontrol',100 from storage.objects where bucket_id='feedback-images' and split_part(name,'/',2) in(f::text,draft::text,live_draft::text);
 list:=account_cleanup_candidates();
 if exists(select 1 from jsonb_array_elements(list) x where x->>'name' like folder||'/%' or x->>'name' like mixed_folder||'/%' or split_part(x->>'name','/',2) in(f::text,live_draft::text)) then raise exception 'Korunan dosya aday oldu'; end if;
 if (select count(*) from jsonb_array_elements(list) x where x->>'name' like old_folder||'/%')<>2 then raise exception 'Eski fotoğraf bulunmadı'; end if;
 if not exists(select 1 from jsonb_array_elements(list) x where split_part(x->>'name','/',2)=draft::text) then raise exception 'Eski taslak bulunmadı'; end if;
 -- Canlı bakım varsa bu test onun kiralamasını transaction dışında değiştirmez.
 update account_maintenance_lease set expires_at=null;
 run:=account_maintenance_begin(false); rid:=(run->>'run_id')::uuid;
 if not (account_maintenance_begin(true)->>'busy')::boolean then raise exception 'İkinci çalışma engellenmedi'; end if;
 begin perform account_maintenance_recheck(rid,'[]'); raise exception using errcode='Z0001',message='Salt rapor silmeye döndü'; exception when insufficient_privilege then null; end;
 perform account_maintenance_finish(rid,0,0,null);
 if not exists(select 1 from app_feedback where id=draft) then raise exception 'Salt rapor taslak sildi'; end if;
 run:=account_maintenance_begin(true); rid:=(run->>'run_id')::uuid;
 list:=account_maintenance_recheck(rid,jsonb_build_array(jsonb_build_object('bucket_id','account-avatars','name',folder||'/64.webp'),jsonb_build_object('bucket_id','account-avatars','name',old_folder||'/64.webp')));
 if jsonb_array_length(list)<>1 or list->0->>'name'<>old_folder||'/64.webp' then raise exception 'Yeniden kontrol hatalı'; end if;
 perform account_maintenance_finish(rid,0,1,'storage');
 if not exists(select 1 from app_feedback where id=draft) then raise exception 'Hata taslağı sildi'; end if;
 run:=account_maintenance_begin(true); rid:=(run->>'run_id')::uuid;
 insert into app_feedback(id,user_id,body,created_at) values(empty_draft,a,'Dosyasız geri alınan kontrol',now()-interval '30 hours');
 perform account_maintenance_finish(rid,0,0,null);
 if exists(select 1 from app_feedback where id=empty_draft) or not exists(select 1 from app_feedback where id=draft) or not exists(select 1 from app_feedback where id=f) or not exists(select 1 from app_feedback where id=live_draft) then raise exception 'Taslak temizleme sınırı bozuk'; end if;
 set local role authenticated;
 select count(*) into n from account_maintenance_runs;
 if n<>0 then raise exception 'Bakım raporu normal kullanıcıya açıldı'; end if;
 reset role;
end $$;
