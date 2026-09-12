-- Tamamlanmış paket aktarımı sonraki tıklamada yeniden içe alınmaz.
alter table public.cad_jobs add column exported_at timestamptz;
