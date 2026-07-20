-- Ekipman listesine kullanıcı tarafından eklenen ek satırlar/özellikler.
-- Hesap snapshot'ından (revisions.selections) türeyen otomatik listeye ek
-- olarak, panelden serbest satırlar eklenir. Revizyon kilidinden bağımsızdır
-- (ekipman listesi bir teslim katmanıdır, hesap snapshot'ı değil).
create table if not exists public.equipment_extras (
  revision_id uuid primary key references public.revisions(id) on delete cascade,
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.equipment_extras enable row level security;

create policy "eqx_select" on public.equipment_extras
  for select to authenticated using (true);
create policy "eqx_write" on public.equipment_extras
  for all to authenticated using (true) with check (true);
