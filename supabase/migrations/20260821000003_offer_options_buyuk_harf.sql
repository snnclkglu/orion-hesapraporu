-- TEKLİF DEFTERİ — MADDE METİNLERİ BÜYÜK HARFE ÇEVRİLİR (kullanıcı kararı,
-- 19.08.2026)
--
--   "Tanımlar defterler kısmındaki yazıları BÜYÜK HARFE ÇEVİR. Kapsam Dışı
--    İşler, Notlar ve Kapak Metinleri, Vinç Sınıfı HARİÇ."
--
-- DÖNÜŞÜM VERİDE YAPILIR, GÖSTERİMDE DEĞİL. Defterden seçilen değer teklif
-- payload'ına METİN olarak girer ve PDF onu olduğu gibi basar; ekranı CSS ile
-- büyütmek belgeyi hiç değiştirmez ve ekran belgenin yalanını söylerdi. Aynı
-- kural yazma yolunda da uygulanır (`offerValueUpper`, `src/lib/offers/
-- options.ts`) — yalnız veriyi düzeltseydik bir sonraki elle eklenen madde
-- yine küçük harfle gelirdi, yalnız yazma yolunu kapatsaydık devralınan ~150
-- madde karışık kalırdı.
--
-- YAYIMLANMIŞ TEKLİFLER DEĞİŞMEZ. Revizyon bir SNAPSHOT'tır; bu göç
-- `offer_options` defterini düzeltir, `offer_revisions.payload` içindeki
-- donmuş metinleri DEĞİL. Açık taslakların satırları eski yazımı taşımaya
-- devam eder (bilerek: taslak da olsa bir belgenin metnini arkadan
-- değiştirmek, kullanıcının görmediği bir düzenlemedir).
--
-- `match_key` GÜNCELLENMEZ ÇÜNKÜ DEĞİŞMİYOR. Katlama (`trKatla`) i ailesinin
-- dördünü tek harfe indirip aksanları ASCII'ye düşürür, yani büyütme altında
-- değişmezdir: kısmi tekillik indeksleri (`offer_options_root_uidx` /
-- `_child_uidx`) bu göçle tetiklenmez, marka→seri bağı kopmaz.

-- ─────────────────────────────────────────── Türkçe farkında büyük harf
--
-- `upper()` TEK BAŞINA YETMEZ: Postgres'in büyütmesi Türkçe farkında değildir
-- ve "iş" → "IS" yapar. Önce Türkçe'ye özgü küçük harfler karşılıklarıyla
-- DEĞİŞTİRİLİR (i→İ, ı→I), sonra `upper()` geri kalan ASCII'yi büyütür.
-- Böylece sonuç veritabanının collation'ından bağımsızdır.
--
-- Fonksiyonlar GEÇİCİDİR: bu dosyanın sonunda düşürülürler. Kalıcı bir yardımcı
-- bırakmak, aynı kuralın üçüncü bir kopyasını (TS + burası + şema) doğururdu.
create or replace function public.gecici_tr_buyuk(t text) returns text
language sql immutable strict as $$
  select upper(translate(t, 'iıçğöşü', 'İIÇĞÖŞÜ'))
$$;

-- ÖLÇÜ VE BİRİM KORUNARAK BÜYÜT (`teknikDegerBuyuk` ikizi).
--
-- Defter maddeleri belgeye TEKNİK DEĞER olarak girer ve ölçü ile birim
-- taşırlar: "400 VAC 50 Hz", "Ø16 6x36 Halat 1960 N/mm2", "Q x 1,1", "St52",
-- "40x30 Ray". Düz bir büyütme bunları "50 HZ", "6X36", "N/MM2", "Q X 1,1",
-- "ST52" yapar — SI birimleri büyük/küçük DUYARLIDIR ve bu, müşteriye giden
-- teknik şartnamede yazım hatasıdır.
--
-- Kural sözcük sözcüktür ve TS tarafındaki `teknikDegerBuyuk` ile birebir
-- aynıdır (src/lib/offers/buyuk.ts): rakam taşıyan sözcük, eğik çizgili
-- birleşik birim ("d/dak", "N/mm2"), çarpım işareti "x", tamamı küçük harfli
-- birim ("m", "kg", "mm"), zaten büyük yazılmış sözcük ve içinde büyük harf
-- taşıyan KISA birim ("kW", "kVA") olduğu gibi kalır. Kalanlar Türkçe büyür;
-- Türk alfabesinde bulunmayan q/w/x ile "ph"/"sch"/"ck" öbeklerini taşıyan
-- sözcük yabancı sayılıp yerelsiz büyür.
create or replace function public.gecici_teknik_buyuk(t text) returns text
language plpgsql immutable strict as $fn$
declare
  parca text;
  cekirdek text;
  harfler text;
  sonuc text := '';
begin
  for parca in
    select (regexp_matches(t, '\S+|\s+', 'g'))[1]
  loop
    -- boşluk öbeği: olduğu gibi (çift boşluk sessizce tek boşluğa inmesin)
    if parca ~ '^\s' then sonuc := sonuc || parca; continue; end if;
    -- harf taşımıyor ("Ø20", "-10", "/", "º") ya da rakam taşıyor (ölçü/kod)
    if parca !~ '[[:alpha:]]' or parca ~ '[0-9]' then sonuc := sonuc || parca; continue; end if;
    -- eğik çizgili birleşik birim ("d/dak")
    if position('/' in parca) > 0 then sonuc := sonuc || parca; continue; end if;
    -- çarpım işareti
    if parca in ('x', '×') then sonuc := sonuc || parca; continue; end if;

    cekirdek := regexp_replace(regexp_replace(parca, '^[^[:alnum:]°º²³/]+', ''), '[^[:alnum:]°º²³/]+$', '');
    -- YAZIMI KORUNAN BİRİMLER — TS'teki `KORUNAN_BIRIMLER`in ikizi. İkinci öbek
    -- (Hz, Nm, Pa, Wh…) baş harfi büyük olduğu için "içeride büyük harf"
    -- kuralına takılmaz; bu göçün provası "400 VAC 50 Hz" satırında tam o
    -- boşluğu gösterdi ve hertz "HZ" oluyordu.
    if cekirdek in (
      'm','mm','cm','km','m²','m³','kg','g','gr','t','ton','bar','sn',
      'Hz','kHz','MHz','Nm','kNm','Pa','kPa','MPa','VA','kVA','Wh','kWh','Ah','mAh','dB'
    ) then
      sonuc := sonuc || parca; continue;
    end if;

    harfler := regexp_replace(parca, '[^[:alpha:]]', '', 'g');
    -- zaten büyük ("HRC", "GAMAK")
    if harfler = public.gecici_tr_buyuk(harfler) then sonuc := sonuc || parca; continue; end if;
    -- içinde büyük harf taşıyan KISA birim ("kW", "kVA", "kNm")
    if length(harfler) <= 4 and substring(harfler from 2) ~ '[[:upper:]]' then
      sonuc := sonuc || parca; continue;
    end if;

    if parca ~* '[qwx]|ph|sch|ck' then
      sonuc := sonuc || upper(parca);
    else
      sonuc := sonuc || public.gecici_tr_buyuk(parca);
    end if;
  end loop;
  return sonuc;
end
$fn$;

-- MARKA AYRI BÜYÜR (`kimlikBuyuk` ikizi). Marka bir Türkçe ad değil bir firma
-- kimliğidir: Türkçe kuralıyla büyütülünce "Schneider" → "SCHNEİDER" olur ve
-- defterde zaten "SCHNEIDER" yazan kardeş maddeyle iki ayrı yazıma bölünür.
-- Ayrım metnin KENDİSİNDEN okunur — Türkçe'ye özgü harf taşıyorsa metin
-- Türkçedir ("Üntel" → "ÜNTEL"), taşımıyorsa yabancıdır
-- ("Conductix-Wampfler" → "CONDUCTIX-WAMPFLER").
create or replace function public.gecici_kimlik_buyuk(t text) returns text
language sql immutable strict as $$
  select case
    when t ~ '[şŞğĞıİçÇöÖüÜ]' then public.gecici_tr_buyuk(t)
    else upper(t)
  end
$$;

-- ──────────────────────────────────────────────────── 1. Defter maddeleri
--
-- MUAF LİSTELER — büyütmenin metni BOZDUĞU yerler:
--   term.exclusion / term.note   → tam cümlelerdir, büyütülünce bağırma olur
--   cover.honorific / cover.intro → kapak hitabı ("Sayın … Bey,") ve giriş
--                                   paragrafı; "Kapak Metinleri" bir liste
--                                   değil bir ÖBEKTİR, ikisi de muaftır
--   val.craneClass                → "FEM 1Am / ISO M4" bir standart
--                                   gösterimidir; "FEM 1AM" standarda aykırı
--
-- Aynı küme TS tarafında `OFFER_LIST_KEEP_CASE`tir ve ayrışmayı bir test bu
-- dosyayı OKUYARAK engeller (değişmez md. 8).
update public.offer_options o
set value = public.gecici_teknik_buyuk(o.value)
where o.list_key not like 'brand.%'
  and o.list_key not in ('term.exclusion', 'term.note', 'cover.honorific', 'cover.intro', 'val.craneClass')
  and o.value is distinct from public.gecici_teknik_buyuk(o.value);

-- Marka listeleri yukarıdaki muaf kümeyle KESİŞMEZ (hiçbiri `brand.` ile
-- başlamaz), o yüzden burada muafiyet süzgeci tekrarlanmaz.
update public.offer_options o
set value = public.gecici_kimlik_buyuk(o.value)
where o.list_key like 'brand.%'
  and o.value is distinct from public.gecici_kimlik_buyuk(o.value);

-- ────────────────────────────────────────────── 2. Şablonun vinç tipi
--
-- ŞABLON UNUTULURSA DEFTER YALAN SÖYLER. `offer_templates.crane_type` serbest
-- metindir ama önerileri `val.craneType` defterinden alır ve `withCraneType`
-- onu yeni teklifin "Vinç Tipi" SATIRINA kopyalar. Defteri büyütüp şablonu
-- bırakırsak, o şablondan açılan teklif hâlâ "Çift Kirişli Gezer Köprülü Vinç"
-- basar — yani belge, defterin söylediğinden başka bir şey söyler.
--
-- ŞABLONUN ADI (`name`) DOKUNULMAZ: o bir ekran etiketidir, belgeye girmez.
update public.offer_templates t
set crane_type = public.gecici_teknik_buyuk(t.crane_type)
where t.crane_type <> ''
  and t.crane_type is distinct from public.gecici_teknik_buyuk(t.crane_type);

-- ──────────────────────────────────────────────────── geçici yardımcılar
drop function public.gecici_kimlik_buyuk(text);
drop function public.gecici_teknik_buyuk(text);
drop function public.gecici_tr_buyuk(text);
