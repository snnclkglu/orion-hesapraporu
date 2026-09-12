-- Eski telefonlar yerinde korunur; yeni/değişen değerler tek biçimde saklanır.
create or replace function public.account_normalize_phone(p_phone text) returns text
language plpgsql immutable set search_path=public as $$
declare value text := btrim(p_phone);
begin
 if value is null then return null; end if;
 if value='' then return ''; end if;
 if value !~ '^[+0-9() .-]+$' then return null; end if;
 value:=regexp_replace(value,'[() .-]','','g');
 if left(value,3)='+90' then value:=substr(value,4);
 elsif left(value,4)='0090' then value:=substr(value,5);
 elsif length(value)=11 and left(value,1)='0' then value:=substr(value,2);
 end if;
 if value !~ '^[1-9][0-9]{9}$' then return null; end if;
 return '+90'||value;
end $$;
revoke all on function public.account_normalize_phone(text) from public,anon,authenticated;

create or replace function public.account_save(p_name text,p_phone text,p_note text,p_version integer)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer; previous_phone text; normalized text;
begin
 if auth.uid() is null or p_name is null or p_phone is null or p_note is null or
 length(trim(p_name)) not between 1 and 120 or length(p_phone)>40 or length(p_note)>500
 then raise exception 'Bilgileri kontrol edin' using errcode='23514'; end if;
 -- Profil sürümü ve özel ayrıntı aynı kullanıcı kilidi altında değerlendirilir.
 perform 1 from profiles where id=auth.uid() and account_version=p_version for update;
 if not found then raise exception 'Profil değişti; yenileyin' using errcode='40001'; end if;
 select phone into previous_phone from profile_private_details where user_id=auth.uid();
 if p_phone=coalesce(previous_phone,'') then normalized:=p_phone;
 else normalized:=account_normalize_phone(p_phone);
 end if;
 if normalized is null then raise exception 'Telefonu +90 ve 10 rakam olarak girin.' using errcode='23514'; end if;
 update profiles set full_name=p_name where id=auth.uid() returning account_version into n;
 insert into profile_private_details values(auth.uid(),normalized,p_note)
 on conflict(user_id) do update set phone=excluded.phone,note=excluded.note;
 return n;
end $$;
revoke all on function public.account_save(text,text,text,integer) from public,anon;
grant execute on function public.account_save(text,text,text,integer) to authenticated;
