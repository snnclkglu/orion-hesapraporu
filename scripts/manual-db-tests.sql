-- Gerçek taslak üzerinde işlem içi prova; bütün değişiklikler geri alınır.
begin;
do $$
declare revision_id uuid := '355cf638-80d1-4294-8adf-a8bcf85c2027'; caught boolean;
begin
  update public.manual_revisions set payload=jsonb_set(jsonb_set(payload,'{v}','2'),'{designVersion}','2') where id=revision_id and status='draft';
  if not found then raise exception '0026 kontrol taslağı bulunamadı'; end if;
  caught:=false;
  begin update public.manual_revisions set payload=payload-'designVersion' where id=revision_id;
  exception when others then if sqlerrm like '%eski istemci%' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'Eski istemci koruması başarısız'; end if;
  caught:=false;
  begin update public.manual_revisions set status='issued' where id=revision_id;
  exception when others then if sqlerrm like '%arşivlenmeden%' then caught:=true; else raise; end if; end;
  if not caught then raise exception 'Arşivsiz yayım koruması başarısız'; end if;
end $$;
select 'PASS: eski istemci ve arşivsiz yayım reddedildi; prova geri alınıyor' as result;
rollback;
