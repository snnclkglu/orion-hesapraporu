-- Silme koruması: SATIN ALMA KAYDI ÜRETİM KAYDI DEĞİLDİR.
--
-- 20260810000003 "üretime girmiş paket silinemez" kuralını koydu ve gerekçesi
-- şuydu: "Atölye o resimlere bakarak iş yaptıysa paket bir TASLAK değil ARŞİV
-- BELGESİDİR." Doğru bir kural, ama sayımı `drawing_part_progress`in TAMAMINI
-- kapsıyordu ve o tablo satın alma zincirini de taşıyor.
--
-- Sonuç sahada görüldü: satınalmacı tek bir civatayı "satın alındı"
-- işaretleyince paket kalıcı olarak silinemez oluyor ve pencere "atölye 1
-- üretim kaydı yazmış" diyor. ATÖLYE HİÇBİR ŞEY YAZMADI. Yanlış yüklenmiş bir
-- klasör, yalnızca cıvatası sipariş edildi diye arşiv belgesine dönüşüyordu ve
-- kullanıcının elinde onu temizlemenin hiçbir yolu kalmıyordu.
--
-- Ayrım zaten mimaride var (`productionStages` / `purchaseStages`,
-- lib/drawings/progress.ts): satın alma ekranı ile atölye tahtası defteri
-- artıksız böler. Bu migration aynı ayrımı veritabanı tarafına taşır.
--
-- SATIN ALMA KAYDI ZATEN PAKETİ HAYATTA TUTMAK ZORUNDA DEĞİL: anahtarı parça
-- koduna değil KATLANMIŞ TANIMA bağlıdır ("SATINALMA:SOMUN M16 DIN934") ve
-- `package_id` `on delete set null` taşır. Paket silinse de "bu somun alındı"
-- bilgisi yaşar ve yeni yükleme onu yeniden bulur — kaybedilen bir şey yoktur.
--
-- MEVCUT MIGRATION DEĞİŞTİRİLMEZ; kural burada yeniden tanımlanır.

-- Satın alma zincirinin slug'ları — `PURCHASE_STAGE_SLUGS` ile BİREBİR aynı
-- olmalıdır. İkisi ayrışırsa hiçbir test kırılmaz ve kural sessizce yanlış
-- çalışır; koruma `__tests__/progress.test.ts` içinde, migration dosyasını
-- okuyarak yapılır (aşama defteri korumasının aynı deseni).
create or replace function public.guard_drawing_package_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kayit int;
  satin_alma_asamalari text[] := array['satinalindi','teslim_alindi'];
begin
  select count(*) into kayit
  from public.drawing_part_progress p
  where (p.qty_done > 0 or p.done_at is not null)
    -- ÜRETİM AŞAMASI ŞARTI: sipariş ve teslim kaydı paketi kilitlemez.
    and not (p.stage = any (satin_alma_asamalari))
    and (
      p.package_id = old.id
      or (
        old.item_no <> ''
        and p.item_no = old.item_no
        and exists (
          select 1 from public.drawing_parts d
          where d.package_id = old.id and d.part_code = p.part_code
        )
      )
    );

  if kayit > 0 then
    raise exception
      'Bu paket üretime girmiş (% üretim kaydı). Silinemez; yerine yeni revizyon yükleyin.',
      kayit;
  end if;

  return old;
end;
$$;

comment on function public.guard_drawing_package_delete() is
  'Üretime girmiş paket silinemez. SATIN ALMA ZİNCİRİ SAYILMAZ (satinalindi · '
  'teslim_alindi): sipariş vermek, atölyenin o resimlere bakarak iş yapması '
  'değildir ve satın alma kaydı anahtarını tanımdan aldığı için paketin '
  'silinmesiyle kaybolmaz.';
