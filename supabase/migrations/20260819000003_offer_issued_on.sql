-- TEKLİF TAKİBİ — YAYIN TARİHİ (kullanıcı isteği, 17.08.2026:
-- *"teklif yayınlandığında teklifin tarihi o tarih olur yani teklif verdiğim
-- tarih. Bu tarihten kaç gün hafta geçtiyse yanında yazsın … çok süre geçtiyse
-- müşteriyi arıyorum takip ediyorum."*)
--
-- NEDEN AYRI SÜTUN, NEDEN `issue_date` DEĞİŞTİRİLMEDİ:
--
-- `issue_date` TEKLİF NUMARASININ KENDİSİDİR. `TETR-20260817-1` içindeki tarih
-- odur ve `offers_seq_uidx (lang, issue_date, seq)` tekilliği ona dayanır.
-- Yayımda o alanı bugüne çekmek iki şeyi birden kırardı: numara ile içindeki
-- tarih ayrışırdı, ve ayrı günlerde açılıp AYNI gün yayımlanan iki teklif aynı
-- (gün, sıra) çiftine düşüp yayımı bir benzersizlik hatasıyla düşürürdü.
--
-- NUMARA DA YENİDEN ÜRETİLMEDİ ve gerekçesi kullanıcının kendi isteğidir:
-- "PDF İndir" düğmesi YAYIMDAN AYRIDIR, yani taslak belge müşteriye
-- gidebiliyor. Gönderilmiş bir belgenin numarasını sonradan değiştirmek,
-- müşterinin elindeki kâğıtla sistemi ayrıştırırdı.
--
-- Sonuç: numara AÇILIŞ gününü, `issued_on` GÖNDERİM gününü söyler. Takip
-- sayacı, süzgeçler ve sıralama ikincisinden okur; belgenin kapağındaki "Tarih"
-- de odur.
--
-- HER YAYIMDA TAZELENİR, yalnız ilkinde değil: revizyon göndermek müşteriyle
-- konuşmayı yeniden başlatır ve takip sayacı "en son ne zaman bir şey
-- gönderdim" sorusunu cevaplar.

alter table public.offers
  add column if not exists issued_on date;

comment on column public.offers.issued_on is
  'Teklifin müşteriye GÖNDERİLDİĞİ tarih (son yayımlanan revizyonun günü). Numaradaki tarihten AYRIDIR.';

create index if not exists offers_issued_on_idx
  on public.offers (issued_on desc nulls last);

-- Görünüm yeni sütunu taşımalı; `create or replace view` sütun EKLEMEYE izin
-- verir ama sıra korunmalıdır — bu yüzden tanım bütünüyle yeniden yazılır.
drop view if exists public.offer_list;

create view public.offer_list
with (security_invoker = true) as
select
  o.id,
  o.offer_no,
  o.lang,
  o.issue_date,
  o.issued_on,
  o.seq,
  o.customer_id,
  o.customer_name,
  o.subject,
  o.status,
  o.currency,
  o.job_id,
  o.created_by,
  o.created_at,
  o.updated_at,
  r.id            as latest_revision_id,
  r.rev_no        as latest_rev_no,
  r.status        as latest_rev_status,
  r.total_amount  as latest_total,
  r.updated_at    as latest_updated_at,
  coalesce(jsonb_path_query_array(r.payload, '$.items[*].craneType'), '[]'::jsonb) as crane_types,
  coalesce(jsonb_path_query_array(r.payload, '$.items[*].capacityT'), '[]'::jsonb) as capacities_t,
  coalesce(jsonb_array_length(r.payload -> 'items'), 0) as item_count
from public.offers o
left join lateral (
  select ov.*
  from public.offer_revisions ov
  where ov.offer_id = o.id
  order by ov.rev_no desc
  limit 1
) r on true;

comment on view public.offer_list is
  'Teklif listesi: defter satırı + GÜNCEL revizyonun özeti (tutar, vinç tipi, tonaj). Süzgeçler ve takip sayacı buradan okur.';
