-- task-db.py test transaction'ı içinde çalışır; gerçek profilde kalıcı yazma yoktur.
do $$
declare item record; actor uuid; profile_name text; revision integer; changed integer;
begin
 for item in select * from (values
 ('',''),('   ',''),('2121234567','+902121234567'),('0212 123 45 67','+902121234567'),
 ('+90 (212) 123 45 67','+902121234567'),('00902121234567','+902121234567'),
 ('+90',null),('212123456',null),('21212345678',null),('+442121234567',null),
 ('212abc1234567',null),('++902121234567',null),('0000000000',null),('(212) 123-45-67','+902121234567')
 ) as cases(input,expected) loop
   if account_normalize_phone(item.input) is distinct from item.expected then raise exception 'Telefon normalleştirme testi başarısız'; end if;
 end loop;
 select id,full_name,account_version into actor,profile_name,revision from profiles where role='admin' limit 1;
 if actor is null then raise exception 'Test için mevcut profil gerekli'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 insert into profile_private_details(user_id,phone,note) values(actor,'eski numara','')
 on conflict(user_id) do update set phone=excluded.phone;
 changed:=account_save(profile_name,'eski numara','',revision);
 begin
   perform account_save(profile_name,'212123456789','',changed);
   raise exception 'Geçersiz yeni numara kabul edildi';
 exception when check_violation then null;
 end;
 changed:=account_save(profile_name,'0212 123 45 67','',changed);
 if (select phone from profile_private_details where user_id=actor)<>'+902121234567' then raise exception 'Kanonik kayıt hatalı'; end if;
 changed:=account_save(profile_name,'','',changed);
 if (select phone from profile_private_details where user_id=actor)<>'' then raise exception 'Telefon temizlenemedi'; end if;
end $$;
