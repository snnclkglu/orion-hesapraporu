-- TEKNİK RESİM TAKİBİ — grubu ÇİZEN kişi (kullanıcı kararı, 12.08.2026).
--
-- İstek aynen: *"Not bölümünün soluna, çizen teknik ressamı dropdown
-- seçebileyim. Ressam ve Mühendis rolündekiler listelensin. Önce ressamlar."*
--
-- Defter bugüne kadar "hangi grup, hangi numara, ne durumda" diyordu; KİM
-- sorusunu hiç sormuyordu ve cevabı yalnız mühendisin aklındaydı. Beş gruplu
-- bir projede bu yönetilebilir, yirmi gruplu bir projede değil.
--
-- NEDEN SERBEST METİN DEĞİL BİR BAĞ: ad metin olarak yazılsaydı aynı kişi
-- "Alkım", "Alkım Kelleci" ve "A. Kelleci" olarak üç ayrı kişi gibi
-- görünürdü — İş Takibi'ndeki parça adlarının serbest metin bırakılıp beş
-- yazımla girilme hikâyesinin aynısı (AGENTS md. 17). Bağ `profiles`adır;
-- kişi listesi zaten orada ve rol de orada duruyor.
--
-- `on delete set null`: işten ayrılan birinin profili silinirse SATIR
-- SİLİNMEZ, yalnız çizen alanı boşalır. `cascade` bir kişiyi silmenin bütün
-- numaralandırmayı götürmesi olurdu.
--
-- ROL SÜZGECİ BURADA DEĞİL: hangi rollerin listeleneceği bir SUNUM kararıdır
-- (`lib/roles.ts:DRAWING_AUTHOR_ROLES`) ve zamanla değişebilir. Veritabanına
-- `check (role in ...)` gibi bir kısıt konsaydı, bir kişinin rolü
-- değiştiğinde ONUN GEÇMİŞTE ÇİZDİĞİ satırlar da geçersiz olurdu — oysa o
-- resimleri gerçekten o çizdi.

alter table public.project_drawing_plan
  add column if not exists drawn_by uuid references public.profiles (id) on delete set null;

comment on column public.project_drawing_plan.drawn_by is
  'Grubu ÇİZEN kişi (profiles.id). Seçici Teknik Ressam ve Mühendis rollerini '
  'listeler (lib/roles.ts:DRAWING_AUTHOR_ROLES) ama kısıt VERİTABANINDA '
  'DEĞİLDİR: kişinin rolü sonradan değişse de geçmişte çizdiği satır geçerli '
  'kalmalıdır. Kişi silinirse alan boşalır, satır silinmez.';

-- "Bu kişi neler çiziyor?" sorusu bir kişinin bütün projelerdeki satırlarını
-- ister; proje bazlı mevcut indeks bunu karşılamaz. Kısmi indeks: satırların
-- çoğu uzun süre atanmamış kalır.
create index if not exists project_drawing_plan_drawn_by_idx
  on public.project_drawing_plan (drawn_by)
  where drawn_by is not null;
