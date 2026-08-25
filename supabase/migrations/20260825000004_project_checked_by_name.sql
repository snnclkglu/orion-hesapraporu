-- Kontrol eden kişi kullanıcı listesinden seçilebilir veya rapora basılacak
-- isim serbestçe yazılabilir. UUID, seçimin kullanıcı kaydıyla ilişkisini;
-- metin ise dış kontrolör gibi yönetim kullanıcısı olmayan kişiyi korur.

alter table public.projects
  add column if not exists checked_by_name text not null default '';

update public.projects p
set checked_by_name = coalesce(pr.full_name, '')
from public.profiles pr
where p.checked_by = pr.id
  and p.checked_by_name = '';
