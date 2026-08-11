-- TEKNİK RESİM TAKİBİ — "çizildi mi" kutusu yerine DURUM etiketi.
--
-- İlk sürümde tek bir boolean vardı (`drawn`) ve gerekçesi "ara durumlar
-- teslim edilmiş paketin durumudur, orası Teknik Resimler modülüdür" idi.
-- Kullanımda görüldü ki bu doğru değil: paket teslim edilene kadar
-- `drawing_packages` hiçbir şey bilmiyor ve o aylar boyunca "bu grup ne
-- durumda?" sorusunun tek cevabı bu defter. Kullanıcı kararı (11.08.2026):
-- Bekliyor · Çiziliyor · Revize Ediliyor · Kontrol Ediliyor · Çizildi.
--
-- `drawn` SÜTUNU DÜŞÜRÜLÜR, saklanmaz. İki alanı birlikte tutmak aynı gerçeği
-- iki yere yazmak olurdu; biri güncellenip diğeri unutulduğunda hangisinin
-- doğru olduğu belirsizleşirdi (bant sütununun hiç açılmama gerekçesiyle aynı).
-- Yüzde de bu tek sütundan hesaplanır (`drawingPlanProgress`).
--
-- KONTROL KISITI LİSTEYİ KAPATIR: yüzde durum ağırlıklarından çıkar, yani
-- serbest metin bir sayıya çevrilemezdi. Yeni bir durum eklemek hem burayı hem
-- `src/lib/drawing-plan.ts`teki `DRAWING_PLAN_STATUSES` listesini değiştirmeyi
-- gerektirir — bilinçli bir sürtünmedir.

alter table public.project_drawing_plan
  add column if not exists status text not null default 'bekliyor';

-- Devralınan satırlar: işaretlenmiş olan "Çizildi", kalanı "Bekliyor".
update public.project_drawing_plan
   set status = case when drawn then 'cizildi' else 'bekliyor' end
 where status = 'bekliyor';

alter table public.project_drawing_plan
  drop constraint if exists project_drawing_plan_status_check;

alter table public.project_drawing_plan
  add constraint project_drawing_plan_status_check
  check (status in ('bekliyor', 'ciziliyor', 'revize', 'kontrol', 'cizildi'));

alter table public.project_drawing_plan drop column if exists drawn;

comment on column public.project_drawing_plan.status is
  'Ana grubun çizim durumu: bekliyor | ciziliyor | revize | kontrol | cizildi. Proje tamamlanma yüzdesi bu sütunun ağırlıklarından TÜRETİLİR (src/lib/drawing-plan.ts).';

comment on table public.project_drawing_plan is
  'Teknik Resim Takibi: projenin ana grup numaralandırması ve çizim durumu (köprü 0100-1400, ana araba 1500-2200, yardımcı araba 2300-2900, ekstra 3000+). Teknik Resimler modülüne bağlı DEĞİLDİR.';
