-- BÜTÇESEL TEKLİF + ANALİZ VARSAYILANLARI.
--
-- Bütçesel teklif, müşterinin yatırım bütçesi oluşturmasına yarayan ön
-- çalışmadır; gerçek bir alım fırsatı sayılmaz. Durum enum'unda yaşar ki liste,
-- etiket ve revizyon zinciri olağan teklif akışını kullansın. Analizden çıkarma
-- uygulamanın saf çekirdeğinde yapılır.

alter type public.offer_status add value if not exists 'budgetary';

-- Yeni kaydın analiz alanları boş kalmasın. BEFORE INSERT tetikleyicisi hem
-- uygulama yolunu hem de güvenilir toplu/veri aktarım yollarını kapsar; kullanıcı
-- daha sonra iki alanı da elle değiştirebilir.
create or replace function public.default_offer_analysis_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.win_score is null then
    new.win_score := 5;
  end if;
  if new.expected_on is null then
    new.expected_on := (new.issue_date + interval '1 month')::date;
  end if;
  return new;
end;
$$;

drop trigger if exists default_offer_analysis_fields on public.offers;
create trigger default_offer_analysis_fields
  before insert on public.offers
  for each row execute function public.default_offer_analysis_fields();

-- Geçmiş teklifler: yalnız BOŞ alanlar tamamlanır; kullanıcının verdiği puan ve
-- tarih hiçbir zaman değiştirilmez.
update public.offers
set
  win_score = coalesce(win_score, 5),
  expected_on = coalesce(expected_on, (issue_date + interval '1 month')::date)
where win_score is null or expected_on is null;

comment on column public.offers.win_score is
  'Kazanma yakınlığı 1–10. Yeni teklifte varsayılan 5; kullanıcı değiştirebilir.';
comment on column public.offers.expected_on is
  'Kararın beklendiği tarih. Yeni teklifte teklif tarihinden bir ay sonrası; kullanıcı değiştirebilir.';
