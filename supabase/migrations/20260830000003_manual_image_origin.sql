-- EL KİTABI GÖRSELİNİN KAYNAĞI.
--
-- Görsel artık DÖRT kaynaktan gelebilir (KITAP-22): dosya yükleme, panoya
-- yapıştırma, Teknik Resim Takibi'nden bir PAFTA ve bir üretici KATALOG
-- SAYFASI. Baytlar dördünde de aynı kapıdan geçer ve aynı biçimde yeniden
-- kodlanır; ama "bu resim neydi" sorusunun cevabı baytta yoktur.
--
-- NEDEN GEREKLİ: bir pafta revize edildiğinde hangi kılavuzların o paftanın
-- eski hâlini taşıdığı ancak burada yazılıysa bilinir. Dosya adına gömmek
-- (`0019-00-0100-s3.png`) bir ADLANDIRMA SÖZLEŞMESİ icat etmek olurdu ve
-- kullanıcı dosya adını değiştirdiğinde bağ sessizce kopardı.
--
-- NEDEN JSONB: kaynak türüne göre alanlar değişir (paftada paket + dosya +
-- sayfa, katalogda belge + sayfa). Dört türü dört sütun çiftiyle taşımak
-- tablonun çoğunu boş bırakırdı.
--
-- BOŞ NESNE "BİLİNMİYOR" DEMEKTİR ve bu geçerli bir durumdur: bu sütun
-- açılmadan önce yüklenmiş bütün görseller öyledir. `not null default '{}'`
-- ile eski satırlar okunur kalır — bir alanın yokluğu belgeyi düşürmemelidir
-- (KITAP-2'nin ilkesi).

alter table public.manual_images
  add column if not exists origin jsonb not null default '{}'::jsonb;

comment on column public.manual_images.origin is
  'Görselin kaynağı: {tur:"yukleme"|"pano"|"pafta"|"katalog", …}. Boş nesne = bilinmiyor (sütundan önceki kayıtlar).';
