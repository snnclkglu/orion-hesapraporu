-- Kullanıcı termini değiştirirse aylık tekrarın günü de yeni tercihe uyar.
-- Otomatik sonraki kayıt INSERT olduğu için Şubat kısalması özgün günü kaybettirmez.
do $$ declare definition text; marker text:='if tg_op=''UPDATE'' then';
begin
 definition:=pg_get_functiondef('public.task_flow_guard()'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Akış koruması beklenen sürümde değil'; end if;
 execute replace(definition,marker,marker||E'\n if new.due_date is distinct from old.due_date and new.recurrence->>''mode''=''monthly'' and new.due_date is not null then new.recurrence:=new.recurrence||jsonb_build_object(''day'',extract(day from new.due_date)::int); end if;');
end $$;
