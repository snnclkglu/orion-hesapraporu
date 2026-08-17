-- İKİ ARABALI VİNÇ ŞABLONU + YARDIMCI ARABA BÖLÜMÜ.
--
-- Kullanıcı bildirimi (17.08.2026): *"Ana kaldırma yanında yardımcı kaldırma da
-- olabilir. Vinçte bir araba veya 2 araba olabilir. Mühendislik bölümünde bu
-- detaylar var."*
--
-- Mühendislik motorunda karşılıkları `aux` (yardımcı kaldırma) ve `auxTrolley`
-- (ikinci araba). Teklif defterinde de AYRI bölümlerdir: ikinci arabanın kendi
-- motoru, redüktörü, freni, sürücüsü, tekerleği ve hızı vardır — tek bölüme
-- sıkıştırmak iki farklı ürünü aynı satırda anlatmak olurdu.
--
-- ŞABLON İSKELETİ YALNIZ GRUP ANAHTARLARINI taşır; satırlar `registry.ts`ten
-- kurulur (seed'in kuralı). Bu yüzden yeni bir bölüm eklendiğinde şablonlar
-- eskimez.

insert into public.offer_templates (name, match_key, crane_type, skeleton, sort) values
  (
    'Çift Kirişli Vinç — İki Arabalı',
    'CIFT KIRISLI VINC — IKI ARABALI',
    'Çift Kirişli Gezer Köprülü Vinç',
    '{"groupKeys":["general","mainHoist","trolley","auxHoist","auxTrolley","bridge","steel","electrical"]}'::jsonb,
    25
  ),
  (
    'Şarj / Döküm Vinci',
    'SARJ / DOKUM VINCI',
    'Şarj / Döküm Vinci',
    '{"groupKeys":["general","mainHoist","trolley","auxHoist","auxTrolley","bridge","steel","electrical"]}'::jsonb,
    26
  )
on conflict do nothing;

-- Mevcut "Yardımcı Kaldırmalı" şablonu tek arabalıdır ve ÖYLE KALIR: yardımcı
-- kaldırma çoğu vinçte AYNI arabanın üzerindedir. İki araba ayrı bir üründür ve
-- ayrı şablonu vardır — birini ötekine katmak, tek arabalı vinç teklifi yazan
-- kullanıcıya her seferinde silmesi gereken bir bölüm getirirdi.
