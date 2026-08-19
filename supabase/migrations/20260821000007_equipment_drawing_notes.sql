-- TEKNİK RESSAM ÖZETİNİN "NOTLAR" BÖLÜMÜ (kullanıcı isteği, 19.08.2026:
-- *"Mühendis ressama aktarmak istediği özel notları bu bölüme yazabilsin"*).
--
-- Ekipman listesindeki "Ek Özellikler" notu SATIR başınadır (`equipment_notes`,
-- anahtar `<modulKey>:<slug>`); bu ise BELGE başına tek bir serbest metindir:
-- çizim yapılırken bilinmesi gereken, hiçbir ölçünün yanına sığmayan şey
-- ("kabin merdiveni sol tarafta", "ray kaynağı montajda yapılacak").
--
-- NEDEN revisions.inputs/selections DEĞİL: `saveRevision` o sütunları BÜTÜN
-- OLARAK değiştirir; ekipman panelinden yazılan bir not, revizyon editöründeki
-- bir sonraki kaydetmede sessizce kaybolurdu. Ayrıca yayınlanmış revizyonda
-- `guard_issued_revision` her update'i reddeder — oysa ressam notu bir HESAP
-- DEĞERİ değil bir TESLİM katmanıdır ve yayınlanmış bir raporun ekine not
-- düşmek için revizyonu yeniden açmak gerekmemelidir. `equipment_notes` ve
-- `equipment_extras` da tam olarak bu gerekçeyle ayrı tablolardır ve trigger
-- onlara da uygulanmaz.
--
-- ANAHTAR (revision_id, note_key): bugün tek bir "genel" not var. Yarın
-- özetin bir BÖLÜMÜNE (tambur, kiriş kesiti) not düşmek istenirse aynı tablo
-- ikinci bir anahtarla karşılar; şema değişmez.
create table if not exists public.equipment_drawing_notes (
  revision_id uuid not null references public.revisions(id) on delete cascade,
  -- 'genel' = özetin en altındaki Notlar bölümü.
  note_key text not null default 'genel',
  note text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (revision_id, note_key)
);

alter table public.equipment_drawing_notes enable row level security;

-- RLS `equipment_notes` ile AYNI: revizyonu GÖREBİLEN okur ve yazar.
-- Görünürlüğün tek kaynağı `revisions` üzerindeki "revisions_select"
-- politikasıdır; buradaki EXISTS alt sorgusu ondan geçen satırları görür,
-- yani erişim kuralı tek yerde tanımlı kalır. (`equipment_extras`taki
-- `using (true)` deseni bilerek izlenmez — o daha eski ve daha kabadır.)
create policy "eqdn_select" on public.equipment_drawing_notes
  for select to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id));

create policy "eqdn_write" on public.equipment_drawing_notes
  for all to authenticated
  using (exists (select 1 from public.revisions r where r.id = revision_id))
  with check (exists (select 1 from public.revisions r where r.id = revision_id));

create index if not exists equipment_drawing_notes_revision_idx
  on public.equipment_drawing_notes (revision_id);

comment on table public.equipment_drawing_notes is
  'Teknik ressam özetinin Notlar bölümü. Teslim katmanıdır; guard_issued_revision uygulanmaz.';
