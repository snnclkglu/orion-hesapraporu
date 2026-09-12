-- Hedef taşınırken bağlı görevlerin kapsamı sessizce bozulamaz.
create function public.task_goal_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from job_tasks child where child.goal_id=old.id and (
   new.kind<>'goal' or child.visibility<>new.visibility or child.board_id is distinct from new.board_id
 )) then raise exception 'Önce hedefe bağlı görevlerin bağlantılarını düzenleyin' using errcode='23514'; end if;
 return new;
end $$;
create trigger task_goal_guard before update of kind,visibility,board_id on public.job_tasks for each row execute function public.task_goal_guard();

-- Bozuk yollar UUID dönüşümüne hiç ulaşmaz; diğer depolama alanlarını etkilemez.
drop policy task_file_insert on storage.objects;
drop policy task_file_read on storage.objects;
drop policy task_file_cleanup on storage.objects;
create policy task_file_insert on storage.objects for insert to authenticated with check(
 bucket_id='task-attachments' and split_part(name,'/',2)=auth.uid()::text and task_access(case when bucket_id='task-attachments' and split_part(name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then split_part(name,'/',1)::uuid end,auth.uid(),true));
create policy task_file_read on storage.objects for select to authenticated using(
 bucket_id='task-attachments' and task_access(case when bucket_id='task-attachments' and split_part(name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then split_part(name,'/',1)::uuid end,auth.uid()));
create policy task_file_cleanup on storage.objects for delete to authenticated using(
 bucket_id='task-attachments' and split_part(name,'/',2)=auth.uid()::text and task_access(case when bucket_id='task-attachments' and split_part(name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then split_part(name,'/',1)::uuid end,auth.uid(),true) and not exists(select 1 from task_attachments where object_path=name));
