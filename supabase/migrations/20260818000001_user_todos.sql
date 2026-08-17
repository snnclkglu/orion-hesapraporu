-- KİŞİSEL YAPILACAKLAR — işe bağlı olmayan, kişiye özel maddeler (panel).
--
-- `job_tasks` BUNU TAŞIYAMAZ: orada `job_id NOT NULL` ve bu bilinçli bir
-- kuraldır (görev işe bağlanır, md. 25). Kişisel madde ise kimseye
-- görünmeyen, işe bağlanmayan bir nottur — ayrı tablo, `user_saved_views`
-- deseninin (user_id + RLS kelepçesi) işidir.
--
-- DURUM = DAMGA (`done_at`), enum değil — `job_tasks` kuralının aynısı:
-- "tamamlandı mı" sorusunun cevabı bir zaman damgasıdır, üç değerli bir
-- durum makinesi değil.

create table if not exists public.user_todos (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles (id) on delete cascade,

  title text not null,
  note text not null default '',
  due_date date,
  done_at timestamptz,
  sort int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Panel açık maddeleri sırayla, ajanda vadeli açıkları tarihle sorar;
-- iki kısmi indeks tam bu iki soruyu sayar.
create index if not exists user_todos_open_idx
  on public.user_todos (user_id, sort) where done_at is null;
create index if not exists user_todos_due_idx
  on public.user_todos (user_id, due_date) where done_at is null;

drop trigger if exists touch_user_todos on public.user_todos;
create trigger touch_user_todos before update on public.user_todos
  for each row execute function public.touch_updated_at();

comment on table public.user_todos is
  'Kişisel yapılacaklar defteri (panel). Kimseyle paylaşılmaz: RLS her satırı '
  'sahibine kelepçeler. İşe bağlı görevler job_tasks''tadır; buradaki madde '
  'işe bağlanmaz, bildirim üretmez, olay defterine yazmaz.';

alter table public.user_todos enable row level security;

drop policy if exists user_todos_all on public.user_todos;

create policy user_todos_all on public.user_todos
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
