-- HESAP RAPORUNU YAYIMDAN GERİ ÇEKMEK İÇİN DAR TETİKLEYİCİ KAPISI.
--
-- Yayınlanmış revizyonun içeriği ve kimliği hâlâ değişmez. Yalnız bilinçli
-- `issued -> draft` geçişinde durum ile issued_at / issued_by damgaları
-- temizlenebilir. Arşiv PDF silinmez; uygulama işlemi audit_log'a yazar.
-- Silme koruması ve yayınlanmış revizyonda yalnız is_template değiştirebilme
-- davranışı korunur.

create or replace function public.guard_issued_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayınlanmış revizyon silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    -- GERİ ÇEKME: yalnız durum, yayım damgaları ve updated_at değişebilir.
    if new.status = 'draft'
       and new.issued_at is null
       and new.issued_by is null
       and (to_jsonb(new) - 'status' - 'issued_at' - 'issued_by' - 'updated_at')
           is not distinct from
           (to_jsonb(old) - 'status' - 'issued_at' - 'issued_by' - 'updated_at')
    then
      new.updated_at := now();
      return new;
    end if;

    -- Mevcut şablon yönetimi kapısı: başka hiçbir alan değişemez.
    if (to_jsonb(new) - 'is_template' - 'updated_at')
       is not distinct from (to_jsonb(old) - 'is_template' - 'updated_at')
    then
      new.updated_at := now();
      return new;
    end if;

    raise exception 'Yayınlanmış revizyon değiştirilemez; önce yayımdan geri çekin';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;
