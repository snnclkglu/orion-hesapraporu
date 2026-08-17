-- GARANTİ SÜRESİ DEFTERİ — 1…5 yıl, varsayılan 2 YIL.
--
-- Kullanıcı kararı (17.08.2026): *"Garanti süresi dropdown 1 2 3 4 5 yıl olsun.
-- Standart 2 yıl olarak gelsin."*
--
-- TEKLIF-6'daki "term.warranty BOŞTUR" saptaması bir GÖZLEMDİ, bir kural değil:
-- devralınan on dört teklifin hiçbirinde garanti maddesi yoktu ve o yüzden bir
-- süre uydurmak yasaktı (değişmez md. 4). Artık uydurma değil — firmanın kendi
-- politikası kullanıcı tarafından SÖYLENDİ, kaynak beyandır. Değerler koda
-- gömülmez, deftere yazılır ki Tanımlar sayfasından değişebilsin.
--
-- `match_key` TypeScript'teki `trKatla` ile aynı kuralı taşır (büyük harf +
-- Türkçe katlama): "1 YIL" … "5 YIL". Postgres'in `upper()`ı Türkçe farkında
-- olmadığı için anahtar burada ELLE yazılır (TEKLIF-6).
--
-- VARSAYILAN TEK OLMALIDIR: aynı listede iki `is_default` olursa `defaultsOf`
-- hangisini alacağını rastgele seçer. Bu yüzden önce listenin tamamındaki
-- işaret kaldırılır, sonra yalnız "2 Yıl" işaretlenir.

insert into public.offer_options (list_key, value, match_key, sort, is_default) values
  ('term.warranty', '1 Yıl', '1 YIL', 10, false),
  ('term.warranty', '2 Yıl', '2 YIL', 20, true),
  ('term.warranty', '3 Yıl', '3 YIL', 30, false),
  ('term.warranty', '4 Yıl', '4 YIL', 40, false),
  ('term.warranty', '5 Yıl', '5 YIL', 50, false)
on conflict do nothing;

update public.offer_options
set is_default = (match_key = '2 YIL')
where list_key = 'term.warranty';
