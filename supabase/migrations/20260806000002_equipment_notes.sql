-- Ekipman listesi "Ek Özellikler" sütunu (madde 34).
--
-- Kullanıcı, otomatik üretilen her ekipman satırının yanına serbest bir
-- açıklama yazabilir. Bu veri NEDEN revizyonun inputs JSONB'sine yazılmaz:
-- `saveRevision` inputs alanını bütün olarak değiştirir (eziyor); ekipman
-- panelinden yazılan bir not, revizyon editöründeki bir sonraki kaydetmede
-- sessizce kaybolurdu. Bu yüzden equipment_extras gibi AYRI bir tablodur.
--
-- row_key: ekipman satırının kararlı kimliği, `<modulKey>:<slug>` biçiminde
-- (ör. "main:rope", "bridge:wheel", "hookBlock:hook"). Anahtar ETİKET
-- METNİNDEN TÜRETİLMEZ — etiketler başlık düzeninden (baslikDuzeni) geçer ve
-- değişebilir; anahtar ham slug'tan üretilir ki notlar satırdan kopmasın.
--
-- Kilit kararı: not bir HESAP DEĞERİ DEĞİL, teslim belgesine düşen bir
-- açıklamadır. Yayınlanmış (issued) revizyonun hesap snapshot'ı kilitlidir,
-- ancak ekipman listesi bir teslim katmanıdır; müşteriye giden listeye
-- "boyası müşteri tarafından belirlenecek" gibi bir not eklemek için revizyonu
-- yeniden açmak gerekmemelidir. Bu yüzden `guard_issued_revision` trigger'ı bu
-- tabloya UYGULANMAZ ve issued revizyonda da düzenlenebilir (equipment_extras
-- ile aynı ilke).
create table if not exists public.equipment_notes (
  revision_id uuid not null references public.revisions(id) on delete cascade,
  row_key text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (revision_id, row_key)
);

alter table public.equipment_notes enable row level security;

-- RLS: revizyonu GÖREBİLEN okur ve yazar. `revisions` üzerindeki
-- "revisions_select" politikası görünürlüğün tek kaynağıdır; buradaki EXISTS
-- alt sorgusu o politikadan geçen satırları görür, dolayısıyla erişim kuralı
-- tek yerde tanımlı kalır.
create policy "eqn_select" on public.equipment_notes
  for select to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id));

create policy "eqn_write" on public.equipment_notes
  for all to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id))
  with check (exists (select 1 from public.revisions r where r.id = revision_id));

-- Revizyon başına notların toplu okunması (panel + Excel/PDF çıktısı)
create index if not exists equipment_notes_revision_idx
  on public.equipment_notes (revision_id);
