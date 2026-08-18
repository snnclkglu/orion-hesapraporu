-- KANCA NUMARASI METİNDİR — katalogdan SAYI olarak yazılmış kayıtları onarır.
--
-- `cat_equipment.attrs.hook_nr` JSONB'de sayıdır (kanca kataloğundaki 22
-- satırın hepsinde). "Katalogdan Seç" ham attr değerini olduğu gibi
-- `selections.<kancaBloğu>.hookNumber` alanına yazıyordu; alan ise DİZE bekler
-- (`HookBlockSelections.hookNumber`, seçenekleri `HOOK_NUMBERS`). Sonuç iki
-- arızaydı ve ikisi de sessizdi:
--
--   • `hookDesignationText` içindeki `sel.hookNumber?.trim()` sayıda
--     `TypeError` fırlatıyordu. `?.` burada KORUMAZ — değer null değil, yanlış
--     tipte. `runCalc` revizyon editöründe bir `useMemo` içinde koştuğu için
--     istisna SSR sırasında SUNUCUDA oluşuyor ve /projects/<id>/revisions/<id>
--     sayfası 500 dönüyordu (0019-00 V0, KARÇEL — kullanıcı bildirimi
--     18.08.2026).
--   • Seçim listesinin seçenekleri dizedir; sayı hiçbiriyle eşleşmez, yani
--     kutu boş görünür ve mühendis kancayı "seçilmemiş" sanar.
--
-- Yazma yolu `applyCatalogPick` içinde kapatıldı (değer artık alanın beyan
-- ettiği tipe zorlanır); bu migration ÖNCEDEN kaydedilmiş satırları onarır.
--
-- YAYINLANMIŞ REVİZYONA DOKUNULMAZ: `guard_issued_revision` içeriği kilitler
-- ve bir update bütün işlemi düşürürdü. Bugün etkilenen tek satır taslaktır
-- (0019-00 V0); kilitli bir satırda aynı veri bulunsaydı onarım orada değil,
-- yeni bir revizyonda yapılırdı.

do $$
declare
  hook_key text;
  fixed integer;
  total integer := 0;
begin
  foreach hook_key in array array[
    'hookBlock', 'auxHookBlock', 'mono1HookBlock', 'mono2HookBlock'
  ] loop
    update public.revisions
    set selections = jsonb_set(
      selections,
      array[hook_key, 'hookNumber'],
      -- `->>` sayıyı metne çevirir: 250 → '250', 2.5 → '2.5'.
      to_jsonb(selections -> hook_key ->> 'hookNumber')
    )
    where status = 'draft'
      and jsonb_typeof(selections -> hook_key -> 'hookNumber') = 'number';

    get diagnostics fixed = row_count;
    total := total + fixed;
  end loop;

  raise notice 'hookNumber metne çevrildi: % satır', total;
end $$;
