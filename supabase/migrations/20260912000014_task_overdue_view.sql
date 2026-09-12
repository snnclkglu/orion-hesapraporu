-- Gecikenler, bugünün görevlerinden ayrı bir kişisel görünüm olabilir.
do $$ declare definition text; marker text:='when ''today'' then';
begin
 definition:=pg_get_functiondef('public.task_snapshot(jsonb,uuid)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Görev sorgusu beklenen sürümde değil'; end if;
 execute replace(definition,marker,'when ''overdue'' then t.due_date<today and t.status<>''done'' '||marker);
end $$;
