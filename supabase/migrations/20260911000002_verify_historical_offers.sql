-- Salt okunur kabul kontrolü: 2026 geçmiş teklif aktarımının tarih, durum ve
-- teklif/maliyet toplamları kaynak belgelerle aynı değilse migration düşer.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.offers o
  join public.offer_revisions r on r.offer_id = o.id and r.rev_no = 0
  join public.offer_cost_revisions c on c.offer_id = o.id and c.rev_no = 0
  where (o.issue_date, o.subject, r.total_amount, c.direct_amount, c.total_amount) in (
    (date '2026-05-15', 'SD-14 VİNCİ (50 MT KAPASİTELİ) MODERNİZASYON İŞİ', 260000, 154000, 169400),
    (date '2026-06-03', 'SD-11 NOLU VİNCİN SÜRÜCÜ VE OTOMASYON SİSTEMLERİNİN YENİLENMESİ', 258000, 118250, 137170),
    (date '2026-06-02', 'CT-1 150/35 MT VİNCİ MODERNİZASYONU', 686000, 440500, 484550),
    (date '2026-07-31', '130/40 MT CÜRUF POTASI TUMBA VİNCİ TEMİNİ', 2320000, 1554345, 1849670.55),
    (date '2026-08-29', 'CC16 VE CC17 50/10 MT VİNÇLERİ MODERNİZASYONU', 770000, 560900, 611381)
  )
    and o.issued_on = o.issue_date
    and o.status = 'sent'
    and r.status = 'issued'
    and c.status = 'issued';

  if v_count <> 5 then
    raise exception 'Geçmiş teklif kabul kontrolü başarısız: beklenen 5, bulunan %', v_count;
  end if;
end
$$;
