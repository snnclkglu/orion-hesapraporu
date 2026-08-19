-- TİCARİ SAYFANIN BAŞLIĞI "TESLİM VE ÖDEME ŞEKLİ" OLDU.
--
-- Kullanıcı isteği (19.08.2026, md. 16): fiyat tablosunun kendi başlığı yoktu
-- ("Tablonun başlığı yok gibi duruyor şuanda"). Fiyat artık sayfanın kendi
-- bölümüdür ve "FİYATLAR" başlığını taşır; sayfanın başlığından da "FİYAT"
-- sözcüğü çıktı.
--
-- SABİT (`registry.ts` TERMS_TITLE) YALNIZ YENİ TEKLİFLERE İŞLER: `emptyPayload`
-- metni açılışta payload'a KOPYALAR ve `withDefaults` kayıtlı değeri korur —
-- teslim edilmiş bir belgenin metnini değiştirmek yasaktır (TEKLIF-2). Bu
-- migration kayıtlı TASLAKLARI eşitler.
--
-- YAYIMLANMIŞ REVİZYONA DOKUNULMAZ. İki gerekçe:
--   1. `guard_issued_offer_revision` içeriği zaten kilitler ve bir update
--      bütün işlemi düşürürdü;
--   2. Müşterinin elindeki PDF o metni taşıyor. Belge her istekte payload'dan
--      yeniden üretiliyor; başlığı değiştirmek, gönderilmiş bir teklifin
--      yeniden indirilen kopyasını farklılaştırırdı.
--
-- ESKİ METİN AÇIKÇA EŞLENİR, körlemesine yazılmaz: kullanıcı başlığı kendi
-- eliyle değiştirdiyse (ileride düzenlenebilir olursa) o metin korunur.

do $$
declare
  duzeltilen integer;
begin
  update public.offer_revisions
  set payload = jsonb_set(payload, '{terms,title}', to_jsonb('TESLİM VE ÖDEME ŞEKLİ'::text))
  where status = 'draft'
    and payload -> 'terms' ->> 'title' = 'FİYAT, TESLİM VE ÖDEME ŞEKLİ';

  get diagnostics duzeltilen = row_count;
  raise notice 'ticari sayfa başlığı güncellendi: % taslak revizyon', duzeltilen;
end $$;
