-- Ekipman kataloğuna üretici datasheet / katalog linki alanı.
-- Ekipman listesi Excel çıktısında Model hücresi bu URL ile köprülenir;
-- panelden (admin/equipment) girilir.
alter table public.cat_equipment
  add column if not exists datasheet_url text not null default '';
