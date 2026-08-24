-- Teklif aşamasındaki hesap raporlarını Mühendislik arşivinden ayırır.
--
-- Hesap motoru, projects/revisions snapshot zinciri ve PDF üretimi aynıdır;
-- report_context yalnız kaydın ait olduğu iş akışını belirtir. Mevcut bütün
-- kayıtlar mühendislik bağlamında kalır. Teklif raporu alınmış bir işe
-- bağlanamaz; kazanılan iş için Mühendislik arşivinde ayrı kayıt açılır.

alter table public.projects
  add column if not exists report_context text not null default 'engineering';

alter table public.projects
  drop constraint if exists projects_report_context_check;
alter table public.projects
  add constraint projects_report_context_check
  check (report_context in ('engineering', 'offer'));

alter table public.projects
  drop constraint if exists projects_offer_context_job_check;
alter table public.projects
  add constraint projects_offer_context_job_check
  check (report_context <> 'offer' or job_id is null);

create index if not exists projects_report_context_created_idx
  on public.projects (report_context, created_at desc);

comment on column public.projects.report_context is
  'Hesap motorundan bağımsız iş akışı ayrımı: engineering=Mühendislik, offer=Teklif Hesap Raporları.';
