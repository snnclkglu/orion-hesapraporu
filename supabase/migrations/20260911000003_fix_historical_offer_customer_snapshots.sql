-- Geçmiş teklif aktarımında customer_id doğru müşteri kartına bağlandı, ancak
-- customer_name alanına kartın resmi adı yerine kısa adı yazıldı. Teklif
-- süzgeci snapshot metnini grupladığı için aynı müşteri iki kez görünüyordu.
-- Yalnız bu aktarımın beş teklifini müşteri kartındaki kanonik adla eşitler.
with aktarilan(issue_date, subject) as (
  values
    (date '2026-05-15', 'SD-14 VİNCİ (50 MT KAPASİTELİ) MODERNİZASYON İŞİ'),
    (date '2026-06-03', 'SD-11 NOLU VİNCİN SÜRÜCÜ VE OTOMASYON SİSTEMLERİNİN YENİLENMESİ'),
    (date '2026-06-02', 'CT-1 150/35 MT VİNCİ MODERNİZASYONU'),
    (date '2026-07-31', '130/40 MT CÜRUF POTASI TUMBA VİNCİ TEMİNİ'),
    (date '2026-08-29', 'CC16 VE CC17 50/10 MT VİNÇLERİ MODERNİZASYONU')
)
update public.offers o
set customer_name = c.name,
    updated_at = greatest(o.updated_at, now())
from public.customers c, aktarilan a
where o.customer_id = c.id
  and o.issue_date = a.issue_date
  and o.subject = a.subject
  and o.customer_name is distinct from c.name;

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from public.offers o
  join public.customers c on c.id = o.customer_id
  where (o.issue_date, o.subject) in (
    (date '2026-05-15', 'SD-14 VİNCİ (50 MT KAPASİTELİ) MODERNİZASYON İŞİ'),
    (date '2026-06-03', 'SD-11 NOLU VİNCİN SÜRÜCÜ VE OTOMASYON SİSTEMLERİNİN YENİLENMESİ'),
    (date '2026-06-02', 'CT-1 150/35 MT VİNCİ MODERNİZASYONU'),
    (date '2026-07-31', '130/40 MT CÜRUF POTASI TUMBA VİNCİ TEMİNİ'),
    (date '2026-08-29', 'CC16 VE CC17 50/10 MT VİNÇLERİ MODERNİZASYONU')
  )
    and o.customer_name is distinct from c.name;

  if v_bad <> 0 then
    raise exception 'Geçmiş teklif müşteri snapshot düzeltmesi başarısız: % kayıt eşleşmiyor', v_bad;
  end if;
end
$$;
