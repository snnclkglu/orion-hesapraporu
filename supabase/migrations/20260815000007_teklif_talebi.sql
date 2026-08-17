-- TEKLİF TALEBİ — "birkaç firmadan aynı teklif" (kullanıcı kararı, 15.08.2026).
--
-- Kullanıcının cümlesi: *"Bu teklifler bölümde istediğim tekliflerin buraya
-- düşmesi. Birkaç firmadan aynı teklifi aldığımda burada görebileyim. Teklifin
-- üstüne tıkladığımda bir pop up açılsın ve hangi firma ne teklif verdi
-- görebileyim."*
--
-- ═══════════════════════════════════════ EKRANDAKİ "TEKLİF" BİR KAT YUKARI ÇIKTI
--
-- Bu sabah bir TEKLİF bir firmanın fiyat listesiydi (`purchase_quote_batches`,
-- `TK0007`). Cümledeki "aynı teklifi birkaç firmadan almak" başka bir şeyden
-- bahsediyor: satır olması gereken şey FİRMANIN CEVABI değil SORULAN SORUdur.
--
--   TT0003 · "SAC 12 X 1500 X 3000 S235JR + 2 kalem"
--     ├── TK0006  EAG DEMİR   38,00
--     ├── TK0007  RZK ÇELİK   37,50
--     └── TK0009  HAKAN SAC   42,50
--
-- PARTİ KALDIRILMADI ve kaldırılamazdı: fiyat arşivi, kazanan işareti ve iptal
-- damgası ona bağlı; ayrıca "hangi firma ne dedi" sorusunun cevabı odur. Talep
-- onun ÜSTÜNE bir kattır ve `on delete set null` taşır — talep silinse de
-- teklifler yaşar.
--
-- ═══════════════════════════════════════ EŞLEŞME İMZADAN, SORUDAN DEĞİL
--
-- Kullanıcıya "bu teklif hangi talebe ait" diye SORULMAZ: üç firmaya aynı
-- listeyi gönderip üç kez fiyat giriyor ve üçünün yan yana gelmesini bekliyor.
-- `signature` teklifin KALEM KÜMESİNİN kanonik metnidir (tekilleştirilmiş,
-- sıralanmış, `\n` ile birleşik) ve aynı küme aynı talebe düşer. Küme
-- tutmuyorsa (bir firma iki kaleme fiyat verdiyse) ayrı bir talep açılır ve
-- kullanıcı ekrandan BİRLEŞTİRİR — o düğmeyi zaten istedi ve elle eşleştirme,
-- her teklif girişine bir soru eklemekten ucuzdur.
--
-- Karşılığı TypeScript'tedir (`lib/purchasing/talep.ts:talepImzasi`). İki
-- tarafın ayrışması ZARARSIZDIR: eşleşmeyen bir imza yalnız yeni bir talep
-- açar, sessiz bir veri kaybı üretmez.

create sequence if not exists public.purchase_quote_request_code_seq;

create table if not exists public.purchase_quote_requests (
  id uuid primary key default gen_random_uuid(),

  -- KOD SAYAÇTAN GELİR (parti kodunun ve tedarikçi kodunun dersi): `max()+1`
  -- iki satınalmacıya aynı numarayı verirdi. Boşluk kabul edilmiştir — kod bir
  -- sıra numarası değil bir KİMLİKtir.
  code text not null
    default ('TT' || lpad(nextval('public.purchase_quote_request_code_seq')::text, 4, '0')),

  -- AD TÜRETİLİR AMA DONAR: talep açılırken kalemlerden yazılır
  -- (`talepBasligi`), sonra kullanıcı değiştirebilir. Her okumada yeniden
  -- türetilseydi kullanıcının verdiği ad bir sonraki teklifte silinirdi.
  title text not null default '',

  -- HANGİ HAVUZDAN AÇILDI. Hammadde ve ekipman aynı `match_key` uzayını
  -- paylaşır; kapsam olmadan her iki ekran ötekinin taleplerini de sayardı.
  scope text not null default 'hammadde',

  -- Kalem kümesinin kanonik metni — otomatik eşleşmenin tek dayanağı.
  signature text not null default '',

  status text not null default 'acik',
  note text not null default '',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_quote_requests_status_check check (status in ('acik', 'kapali'))
);

create unique index if not exists purchase_quote_requests_code_idx
  on public.purchase_quote_requests (code);

-- İmza uzun olabilir (kırk kalemlik bir talepte kilobaytlar): btree'nin satır
-- sınırına takılmamak için indeks HASH ÜZERİNDEDİR. Eşitlik dışında bir sorgu
-- da sorulmuyor.
create index if not exists purchase_quote_requests_sig_idx
  on public.purchase_quote_requests (scope, md5(signature));

comment on table public.purchase_quote_requests is
  'SORULAN SORU: bir kalem kümesi için açılmış teklif. Firmaların cevapları '
  'purchase_quote_batches satırlarıdır; aynı kalem kümesi aynı talebe düşer.';

alter table public.purchase_quote_batches
  add column if not exists request_id uuid
    references public.purchase_quote_requests (id) on delete set null;

create index if not exists purchase_quote_batches_request_idx
  on public.purchase_quote_batches (request_id);

-- ═══════════════════════════════════════ DEVRALINAN PARTİNİN KAPSAMI BİLİNMİYOR
--
-- 20260815000004 var olan bütün tekliflere parti verdi ve `scope` sütununun
-- VARSAYILANI 'hammadde' olduğu için hepsi hammadde damgası aldı. Ölçüldü
-- (15.08.2026): o partilerin ikisi de EKİPMAN teklifidir ("ELEKTRİK MOTORU
-- 30KW"). Teklifler ekranı artık kapsamı da okuduğu için bu damga onları
-- hammadde listesine sokardı.
--
-- Doğru değer 'ekipman' DEĞİLDİR — bilinmiyor, ve bu modülde bilinmeyen
-- uydurulmaz (SATIN-21). Üçüncü bir değer yazılır: kapsamı bilinmeyen parti
-- yalnız KALEMİ havuzda karşılığı olduğunda görünür; anahtar hangi havuza
-- düşüyorsa oraya.
update public.purchase_quote_batches
set scope = 'devralinan'
where note = 'Parti kodu sonradan verildi (devralınan teklif).'
  and scope = 'hammadde';

-- ═══════════════════════════════════════ VAR OLAN PARTİLERE TALEP
--
-- Kodsuz bırakılsalardı ekran onları hiç gösteremezdi (liste artık talep
-- başınadır). Gruplama KALEM KÜMESİDİR — `saveBulkQuote`ın yaptığının aynısı.

with imzalar as (
  select
    b.id as batch_id,
    b.scope,
    coalesce(
      (
        select string_agg(k, E'\n' order by k)
        from (
          select distinct q.match_key collate "C" as k
          from public.purchase_quotes q
          where q.batch_id = b.id
        ) s
      ),
      ''
    ) as imza,
    (
      select min(q.sample) from public.purchase_quotes q where q.batch_id = b.id
    ) as ornek,
    (
      select count(distinct q.match_key) from public.purchase_quotes q where q.batch_id = b.id
    ) as kalem
  from public.purchase_quote_batches b
  where b.request_id is null
),
gruplar as (
  select scope, imza, min(ornek) as ornek, max(kalem) as kalem
  from imzalar
  group by scope, imza
),
yeni as (
  insert into public.purchase_quote_requests (scope, signature, title)
  select
    g.scope,
    g.imza,
    case
      when g.kalem > 1 then coalesce(g.ornek, '') || ' + ' || (g.kalem - 1) || ' kalem'
      else coalesce(g.ornek, 'Teklif')
    end
  from gruplar g
  returning id, scope, signature
)
update public.purchase_quote_batches b
set request_id = y.id
from imzalar i
join yeni y on y.scope = i.scope and y.signature = i.imza
where b.id = i.batch_id;

-- ═══════════════════════════════════════ updated_at

drop trigger if exists touch_purchase_quote_requests on public.purchase_quote_requests;
create trigger touch_purchase_quote_requests
  before update on public.purchase_quote_requests
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════ RLS
--
-- `purchase_*` kalıbı: teklif ticari bir veridir, "authenticated okur" DEĞİL.

alter table public.purchase_quote_requests enable row level security;

drop policy if exists purchase_quote_requests_select on public.purchase_quote_requests;
drop policy if exists purchase_quote_requests_insert on public.purchase_quote_requests;
drop policy if exists purchase_quote_requests_update on public.purchase_quote_requests;
drop policy if exists purchase_quote_requests_delete on public.purchase_quote_requests;

create policy purchase_quote_requests_select on public.purchase_quote_requests
  for select to authenticated using (public.can_see_purchasing());
create policy purchase_quote_requests_insert on public.purchase_quote_requests
  for insert to authenticated with check (public.can_edit_purchasing());
create policy purchase_quote_requests_update on public.purchase_quote_requests
  for update to authenticated
  using (public.can_edit_purchasing()) with check (public.can_edit_purchasing());
create policy purchase_quote_requests_delete on public.purchase_quote_requests
  for delete to authenticated using (public.can_edit_purchasing());
