-- Haftalık görünümde veri aralığı sunucuda süzülür; sayfalama ve yetki korunur.
do $$ declare definition text; marker text:='when ''upcoming'' then t.due_date>today and t.status<>''done''';
begin
 definition:=pg_get_functiondef('public.task_snapshot(jsonb,uuid)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Görev sorgusu beklenen sürümde değil'; end if;
 definition:=replace(definition,marker,'when ''week'' then t.due_date>=date_trunc(''week'',today)::date and t.due_date<date_trunc(''week'',today)::date+7 '||marker);
 execute definition;
end $$;
