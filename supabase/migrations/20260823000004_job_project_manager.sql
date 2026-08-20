-- İŞ EMRİ PROJE YÖNETİCİSİ — İş Lideri ile aynı kullanıcı defterinden seçilir.
--
-- Metin olarak saklanır: iş emri, basıldığı andaki kişi adının FOTOĞRAFIDIR.
-- Profil adı sonradan değişse de yayımlanmış iş emrinin künyesi değişmemelidir;
-- `job_leader` da aynı nedenle profil kimliği değil metin taşır.
alter table public.jobs
  add column if not exists project_manager text not null default '';

comment on column public.jobs.project_manager is
  'İş emrindeki proje yöneticisi adı; profil defterinden seçilir, belge fotoğrafı olarak metin saklanır.';
