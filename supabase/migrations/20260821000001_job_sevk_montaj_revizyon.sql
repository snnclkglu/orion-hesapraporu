-- İş emri: SEVK/MONTAJ ADRESİ + REVİZYON HARFİ (kullanıcı isteği, 18.08.2026)
--
-- Sevk ve montaj adresi MÜŞTERİ ADRESİNDEN AYRIDIR: `customer_address` iş
-- emrinin basıldığı andaki müşteri künyesidir (fatura adresi), vinç ise çoğu
-- zaman başka bir tesise gider. İkisi ayrı sütundur çünkü sevk ile montaj da
-- birbirinden ayrılabilir; formda montaj varsayılan olarak sevkin AYNISIDIR ve
-- kullanıcı isterse ayırır.
--
-- DEVRALINAN SATIRLAR BOŞ KALIR — `customer_address`ten kopyalanmaz. Nereye
-- sevk edildiği bilinmiyorsa boş durur (AGENTS md. 4: uydurma veri girilmez);
-- yanlış bir sevk adresi, boş bir alandan pahalıdır.
--
-- Revizyon harfi belgenin kimliğine girer (`ORC-IE-0063-RA`). Varsayılan 'A':
-- ilk yayın da bir revizyondur ve devralınan 63 iş emri A sayılır.
alter table public.jobs
  add column if not exists shipping_address text not null default '',
  add column if not exists assembly_address text not null default '',
  add column if not exists revision text not null default 'A';

-- Harf kümesi SQL'de de kelepçelenir. Kural TypeScript'te `revizyonHarfi`tedir
-- (lib/jobs/is-emri.ts); iki yerde yaşayan bir kuralın ayrışmaması için ikinci
-- yarısı buradadır (AGENTS md. 8). 'AA' sonrası için üç harfe kadar izin verilir.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jobs_revision_harf'
  ) then
    alter table public.jobs
      add constraint jobs_revision_harf check (revision ~ '^[A-Z]{1,3}$');
  end if;
end
$$;
