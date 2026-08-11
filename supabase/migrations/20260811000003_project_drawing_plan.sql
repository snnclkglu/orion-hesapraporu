-- TEKNİK RESİM TAKİBİ — mühendisin proje BAŞINDA yaptığı ana grup
-- numaralandırması.
--
-- NEDEN AYRI BİR DEFTER (ve neden `drawing_packages` DEĞİL):
-- `drawing_packages` ressamın TESLİM ETTİĞİ klasörden türer; kayıt ancak
-- resimler çizilip yüklendikten sonra doğar. Oysa numaralandırma projenin
-- BAŞINDA belirlenir: ressam çizime oturmadan önce mühendise "köprü yürütme
-- grubu kaç olacak?" diye sorar. İki defteri birleştirmek, henüz var olmayan
-- bir teslimi bekleyen bir soruya cevap veremezdi. Bu yüzden bu defter
-- Teknik Resimler modülüne HİÇ BAĞLANMAZ (kullanıcı kararı, 11.08.2026) —
-- ne yabancı anahtarla ne de metin eşlemesiyle.
--
-- KAPSAM BİLİNÇLİ OLARAK DAR: yalnız ANA GRUPLAR. Grup adedi, ağırlığı ve alt
-- parçaları BURADA SORULMAZ; onlara ressam çizerken karar verir ve sonuçları
-- zaten `drawing_parts`ta ölçülür. Buraya konsalardı mühendis proje başında
-- bilmediği sayıları uydurmak zorunda kalırdı.
--
-- NUMARA = <iş kalemi no>-<grup kodu>, ör. "0055-00-0100". Kalem numarası
-- BURADA SAKLANMAZ: `job_items.item_no` (yoksa `projects.doc_no`) zaten tek
-- kaynaktır ve `autoItemNos` ikinci kalem eklendiğinde onu kaydırır
-- (AGENTS md. 14). Kopyalansaydı o gün defterdeki numara sessizce eskirdi.
--
-- BANT SÜTUNU YOKTUR: kod aralığı bandın kendisidir (köprü 0100–1400, araba
-- 1500–2900, ekstra 3000+) ve firmanın kuralı budur. İkinci bir sütun aynı
-- gerçeği iki yerde tutup çelişebilirdi; bant koddan TÜRETİLİR
-- (`src/lib/drawing-plan.ts`).

create table if not exists public.project_drawing_plan (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Dört haneli grup kodu, metin: "0100". Sayı olsaydı baştaki sıfır kaybolur
  -- ve numara resim antedindeki yazımla ayrışırdı. Sıralama da metin olarak
  -- doğrudur — dört hane sabit olduğu için sözlük sırası sayısal sıradır.
  code text not null check (code ~ '^[0-9]{4}$'),
  name text not null default '',
  -- "Çizildi mi" — bu defterin var olma sebebi. Tek bir kutu bilinçlidir:
  -- ara durumlar (çiziliyor / kontrolde) teslim edilmiş paketin durumudur ve
  -- orası Teknik Resimler modülüdür.
  drawn boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  -- Aynı projede aynı grup kodu iki kez verilemez: numara resmin kimliğidir.
  unique (project_id, code)
);

alter table public.project_drawing_plan enable row level security;

-- OKUMA HERKESE: numarayı ressam, atölye ve satınalma da okur; numaralandırma
-- bir yetki değil ortak bir gerçektir (Teknik Resim Paketleri kartıyla aynı
-- gerekçe). YAZMA hesap raporu yazan rollerdedir — numarayı mühendis verir.
create policy "pdp_select" on public.project_drawing_plan
  for select to authenticated using (true);

create policy "pdp_insert" on public.project_drawing_plan
  for insert to authenticated with check (public.can_edit_reports());

create policy "pdp_update" on public.project_drawing_plan
  for update to authenticated
  using (public.can_edit_reports())
  with check (public.can_edit_reports());

create policy "pdp_delete" on public.project_drawing_plan
  for delete to authenticated using (public.can_edit_reports());

-- Proje başına toplu okuma: proje ekranı, ekipman paneli ve Excel/PDF çıktısı
-- aynı listeyi ister.
create index if not exists project_drawing_plan_project_idx
  on public.project_drawing_plan (project_id, code);

comment on table public.project_drawing_plan is
  'Teknik Resim Takibi: projenin ana grup numaralandırması (köprü 0100-1400, araba 1500-2900, ekstra 3000+). Teknik Resimler modülüne bağlı DEĞİLDİR.';
