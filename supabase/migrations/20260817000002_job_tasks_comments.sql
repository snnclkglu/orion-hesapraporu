-- İŞ GÖREVLERİ + YORUMLAR + GÖREV ŞABLONU — iş hub'ının işbirliği katmanı.
--
-- ÇOCUK KAYITLAR İŞE BAĞLANIR, KALEME DEĞİL: `updateJob` kalemleri silip
-- yeniden yazar (actions.ts) ve `job_items.id`ye bağlanan her kayıt ilk
-- düzenlemede yetim kalırdı. Kalem bağlamı `item_no` METNİYLE taşınır
-- (WORKLOG-17 "numara METİN, bağlantı TÜREV" kuralının aynısı).
--
-- GÖREVİN DURUMU BİR ENUM DEĞİL `done_at` DAMGASIDIR: görev bir yapılacaktır
-- ve iki hâli vardır (açık · kapalı); beş değerli bir akış uydurmak
-- `project_drawing_plan`ın gerekçesini taşımaz — orada ara durumlar aylarca
-- süren çizim işinin GERÇEĞİYDİ, bir yapılacak maddesinde ise "yarım görev"
-- diye bir olgu yok.

-- ─────────────────────────────────────────────────────────────── job_tasks

create table if not exists public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,

  -- Kalem bağlamı İSTEĞE BAĞLI ve METİNDİR; kalem yeniden yazılınca görev
  -- yerinde kalır, bağ görüntüde numarayla kurulur.
  item_no text not null default '',

  title text not null,
  note text not null default '',

  -- `drawn_by` kalıbı (20260812150001): kişi silinirse alan BOŞALIR, görev
  -- silinmez. Rol süzgeci VERİTABANINDA DEĞİL sunumda (RESIM-20 gerekçesi).
  assignee uuid references public.profiles (id) on delete set null,
  due_date date,
  sort int not null default 0,

  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,

  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_tasks_job_idx on public.job_tasks (job_id, sort);
-- "Bana atanan açık görevler" panelin ve İşler şeridinin sorusudur; kapalı
-- görevler o soruya hiç girmez — kısmi indeks tam bunu sayar.
create index if not exists job_tasks_assignee_open_idx
  on public.job_tasks (assignee) where done_at is null;
create index if not exists job_tasks_due_open_idx
  on public.job_tasks (due_date) where done_at is null;

drop trigger if exists touch_job_tasks on public.job_tasks;
create trigger touch_job_tasks before update on public.job_tasks
  for each row execute function public.touch_updated_at();

comment on table public.job_tasks is
  'İşe bağlı yapılacaklar. job_items.id''ye BAĞLANMAZ (updateJob kalemleri '
  'silip yeniden yazar); kalem bağlamı item_no metnidir. Durum done_at '
  'damgasıdır: açık/kapalı — ara durum yok.';

alter table public.job_tasks enable row level security;

drop policy if exists job_tasks_select on public.job_tasks;
drop policy if exists job_tasks_insert on public.job_tasks;
drop policy if exists job_tasks_update on public.job_tasks;
drop policy if exists job_tasks_delete on public.job_tasks;

-- /jobs herkese açıktır; görev açma/kapatma/atama da öyle (job_items düzeyi).
-- SİLME yalnız açan ya da yönetici: başkasının görevini kapatmak meşru bir
-- iş akışıdır, silmek değildir.
create policy job_tasks_select on public.job_tasks
  for select to authenticated using (true);
create policy job_tasks_insert on public.job_tasks
  for insert to authenticated with check (created_by = auth.uid());
create policy job_tasks_update on public.job_tasks
  for update to authenticated using (true) with check (true);
create policy job_tasks_delete on public.job_tasks
  for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- ───────────────────────────────────────────────────────────── job_comments

create table if not exists public.job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,

  -- Gövde DÜZ METİNDİR ve `@AD SOYAD` yazımını olduğu gibi taşır; anılan
  -- kişilerin KİMLİKLERİ ayrı sütundadır. `@[uuid]` gibi bir işaretleme
  -- dışa aktarımda ve bildirimde okunmaz olurdu; ad değişirse gövde eski
  -- yazımı korur (fotoğraf), kimlik dizisi gerçeği söyler.
  body text not null,
  mentions uuid[] not null default '{}',

  author uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists job_comments_job_idx
  on public.job_comments (job_id, created_at desc);

comment on table public.job_comments is
  'İş yorumları. Gövde düz metin (@AD SOYAD dahil); anılan kimlikler '
  'mentions uuid[] sütununda. Akış sekmesi yorumları olaylarla BİRLEŞİK '
  'kronolojide basar.';

alter table public.job_comments enable row level security;

drop policy if exists job_comments_select on public.job_comments;
drop policy if exists job_comments_insert on public.job_comments;
drop policy if exists job_comments_update on public.job_comments;
drop policy if exists job_comments_delete on public.job_comments;

create policy job_comments_select on public.job_comments
  for select to authenticated using (true);
create policy job_comments_insert on public.job_comments
  for insert to authenticated with check (author = auth.uid());
-- Yorum yalnız SAHİBİNCE düzenlenir; yönetici silebilir ama başkasının
-- sözünü DEĞİŞTİREMEZ — düzenlenmiş bir yorum hâlâ imzasını taşır.
create policy job_comments_update on public.job_comments
  for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy job_comments_delete on public.job_comments
  for delete to authenticated using (author = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────────────── job_task_templates

-- GÖREV ŞABLONU (kullanıcı onayı 16.08.2026): standart iş akışı kontrol
-- listesi tek tıkla işe eklenir. Defter YÖNETİCİNİNDİR (/admin/task-templates)
-- ve BOŞ BAŞLAR — hazır madde uydurulmaz (SATIN-21 "uydurma veri girmeyeceğiz");
-- firmanın gerçek kontrol listesi neyse onu yönetici yazar.

create table if not exists public.job_task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists job_task_templates_sort_idx
  on public.job_task_templates (sort) where active;

alter table public.job_task_templates enable row level security;

drop policy if exists job_task_templates_select on public.job_task_templates;
drop policy if exists job_task_templates_write on public.job_task_templates;

create policy job_task_templates_select on public.job_task_templates
  for select to authenticated using (true);
create policy job_task_templates_write on public.job_task_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
