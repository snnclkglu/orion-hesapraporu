-- Doküman no kuralı: DOKÜMAN NO = İŞ KALEMİ NUMARASI.
--
-- Hesap raporu işe değil İŞ KALEMİNE bağlıdır (bkz. AGENTS.md md. 14): bir iş
-- emrindeki `0055-01` ve `0055-02` kalemleri İKİ AYRI rapordur. Doküman no o
-- kalemin numarasıdır ve belge kodu bundan türer:
--
--     0055-01  →  ORC-HR-0055-01-R01
--     0055-02  →  ORC-HR-0055-02-R01
--
-- Alan serbest metin bırakıldığı için üç ayrı yazım birden dolaşıyordu:
-- `0055` (kalemsiz — ikinci kalem eklenince benzersizlik kısıtına takılır ve
-- kod hangi kaleme ait olduğunu söylemez), `0055-01` (yeni rapor penceresinin
-- otomatik doldurduğu, DOĞRU olan) ve `0055-HR-001` (bu sütunun ilk yorumunda
-- örnek verilen; belge kodunda "HR" iki kez çıkıyordu). Kural artık şemada
-- yazılı ve yeni rapor penceresinde kalem seçiliyken alan SALT-OKUNUR.
--
-- MEVCUT KAYITLAR DEĞİŞTİRİLMEZ (kullanıcı kararı): yayınlanmış raporların
-- doküman kodu sabit kalmalı, teslim edilmiş PDF'lerle sistemdeki kod
-- ayrışmamalıdır. Kural yalnız bundan sonra açılan raporlara uygulanır.

comment on column public.projects.doc_no is
  'Doküman no = iş kalemi numarası (ör. 0055-01). Belge kodu ORC-HR-<doc_no>-R<rev> olarak türer. Benzersizdir. Eski kayıtlarda kalemsiz (0055) değerler bulunabilir; bilinçli olarak dönüştürülmemiştir.';
