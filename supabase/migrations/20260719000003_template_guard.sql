-- Yayınlanmış revizyon kilidi güncellemesi: içerik değişmeden yalnızca
-- is_template işaretinin değiştirilmesine izin verilir (şablon yönetimi).

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
    -- Sadece is_template (ve updated_at) değişiyorsa izin ver
    if (to_jsonb(new) - 'is_template' - 'updated_at')
       is distinct from (to_jsonb(old) - 'is_template' - 'updated_at') then
      raise exception 'Yayınlanmış revizyon değiştirilemez; yeni revizyon oluşturun';
    end if;
    new.updated_at := now();
    return new;
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;
