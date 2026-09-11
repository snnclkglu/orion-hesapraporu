-- Teklif hesaplarının kimliği İstanbul gününe göre atomik üretilir.
create table public.offer_report_number_counters (
  issue_date date primary key,
  last_seq bigint not null check (last_seq > 0)
);
alter table public.offer_report_number_counters enable row level security;
revoke all on public.offer_report_number_counters from public, anon, authenticated;

-- Eski kimlik denetim defterinde kalır; yayımlanmış revizyon/PDF değişmez.
with numbered as (
  select id, doc_no, (created_at at time zone 'Europe/Istanbul')::date as day,
    row_number() over(partition by (created_at at time zone 'Europe/Istanbul')::date order by created_at,id) as seq
  from public.projects where report_context = 'offer'
), updated as (
  update public.projects p set doc_no = 'TEHR-' || to_char(n.day,'DDMMYYYY') || '-' || n.seq
  from numbered n where p.id = n.id
  returning p.id, n.doc_no as previous_doc_no, p.doc_no
)
insert into public.audit_log(project_id,action,detail)
select id,'project.offer_report_number',jsonb_build_object('previous_doc_no',previous_doc_no,'doc_no',doc_no) from updated;

insert into public.offer_report_number_counters(issue_date,last_seq)
select (created_at at time zone 'Europe/Istanbul')::date,count(*)
from public.projects where report_context='offer' group by 1;

create function public.assign_offer_report_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_day date := (clock_timestamp() at time zone 'Europe/Istanbul')::date;
  v_seq bigint;
begin
  if new.report_context <> 'offer' then return new; end if;
  if TG_OP = 'UPDATE' and old.report_context = 'offer' then
    new.doc_no := old.doc_no;
    return new;
  end if;
  loop
    insert into public.offer_report_number_counters(issue_date,last_seq) values(v_day,1)
    on conflict(issue_date) do update set last_seq = public.offer_report_number_counters.last_seq + 1
    returning last_seq into v_seq;
    new.doc_no := 'TEHR-' || to_char(v_day,'DDMMYYYY') || '-' || v_seq;
    exit when not exists(select 1 from public.projects where doc_no=new.doc_no);
  end loop;
  return new;
end;
$$;
revoke all on function public.assign_offer_report_number() from public,anon,authenticated;
create trigger assign_offer_report_number before insert or update of doc_no,report_context on public.projects
for each row execute function public.assign_offer_report_number();
