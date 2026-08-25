-- İş Listesi PDF'i uzun sevk adresini değil yalnız seçilen ülkeyi basar.
-- Mevcut işlerin tamamı Türkiye olduğundan geçmiş kayıtların güvenli ve
-- kullanıcının açıkça bildirdiği varsayılanı Türkiye'dir.
alter table public.jobs
  add column if not exists shipping_country text not null default 'Türkiye';

update public.jobs
set shipping_country = 'Türkiye'
where btrim(coalesce(shipping_country, '')) = '';

comment on column public.jobs.shipping_country is
  'Güncel İş Listesi PDF''inde Sevk Yeri sütununa basılan ülke adı; tam sevk adresi shipping_address alanında kalır.';
