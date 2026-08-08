-- İş emri aktarımında (20260808000004) 0048 · 0053 · 0054 no'lu LITEC
-- işlerinin KAPSAM kutuları boş okunmuştu.
--
-- Sebep: bu üç emirde onay kutuları dolgulu dikdörtgen olarak DEĞİL, çerçeve
-- + gömülü GÖRÜNTÜ olarak basılmış; dolgu rengine bakan okuma hepsini
-- işaretsiz saymıştı. Kutular basılı sayfada render edilip iç renkleri
-- ölçülerek yeniden okundu (basılı belgeyle gözle doğrulandı).

update public.jobs set scope = '{"proje": false, "devreyeAlma": false, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}'::jsonb where job_no = '0048';
update public.jobs set scope = '{"proje": true, "devreyeAlma": true, "malzeme": true, "nakliye": true, "imalat": true, "montaj": true}'::jsonb where job_no = '0053';
update public.jobs set scope = '{"proje": true, "devreyeAlma": false, "malzeme": true, "nakliye": false, "imalat": true, "montaj": false}'::jsonb where job_no = '0054';
