-- YAYIMDAN GERİ ÇEKME İÇİN TETİKLEYİCİYE DAR BİR KAPI.
--
-- Kullanıcı bildirimi (17.08.2026): *"Yayınlanan bir teklifi geri çekme
-- özelliği olsun. 'Yayınlanmış teklif revizyonu değiştirilemez; yeni revizyon
-- oluşturun' uyarısı veriyor. Yanlışlıkla eklemiş olabilir."*
--
-- ÖZELLİK ZATEN YAZILMIŞTI ama HİÇ ÇALIŞMIYORDU: `unlockOfferRevision`
-- (actions.ts) ve panelin "Geri Çek" düğmesi yerinde duruyor, yetki Yönetici'ye
-- kelepçelenmiş — ama işlem bir UPDATE'tir ve `guard_issued_offer_revision`
-- `old.status = 'issued'` gördüğü ANDA, yeni satıra hiç bakmadan exception
-- atıyordu. Yani düğme, kullanıcıya tetikleyicinin ham metnini gösteriyordu.
-- Belirti "yetki yok" gibi okunuyordu, sebep ise koruma kuralının kendisiydi.
--
-- KAPI DAR AÇILIR: yayımlanmış bir satırda YALNIZ durumun `draft`a dönmesine ve
-- yayım damgalarının boşalmasına izin verilir. Belgenin kendisi (`payload`),
-- numarası (`rev_no`), etiketi, notu, sahibi ve bağlı olduğu teklif AYNI
-- kalmalıdır. Böylece "yayımlanmış belge değişmez" kuralı korunur: teslim
-- edilmiş bir teklifin metnini tek bir UPDATE ile değiştirmek hâlâ imkânsızdır,
-- ama BİLİNÇLİ bir geri çekme yapılabilir. Düzenleme ondan sonra normal
-- yolundan, taslak bir revizyon üzerinde yapılır.
--
-- Kapıyı "durum değişiyorsa serbest" diye açmak yetmezdi: aynı UPDATE payload'ı
-- da taşıyabilir ve o zaman geri çekme, belgeyi sessizce değiştirmenin yolu
-- olurdu. Bu yüzden koşul ALANLARIN AYNI KALMASI üzerine kuruludur, işlemin
-- adına değil — SQL bir niyet okuyamaz, yalnız satırı karşılaştırabilir.
--
-- SİLME KURALI DEĞİŞMEZ: yayımlanmış revizyon hâlâ silinemez. Geri çekilen
-- revizyonun arşivdeki PDF'i de silinmez (TEKLIF-24) — müşterinin elindeki
-- kâğıdın karşılığı arşivde durmaya devam eder.

create or replace function public.guard_issued_offer_revision()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'issued' then
      raise exception 'Yayınlanmış teklif revizyonu silinemez';
    end if;
    return old;
  end if;

  if old.status = 'issued' then
    -- GERİ ÇEKME (issued → draft): yalnız durum ve yayım damgaları değişir.
    if new.status = 'draft'
       and new.issued_at is null
       and new.issued_by is null
       and new.offer_id   = old.offer_id
       and new.rev_no     = old.rev_no
       and new.label      = old.label
       and new.notes      = old.notes
       and new.payload    = old.payload
       and new.created_by = old.created_by
    then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'Yayınlanmış teklif revizyonu değiştirilemez; yeni revizyon oluşturun';
  end if;

  if new.status = 'issued' and old.status = 'draft' then
    new.issued_at := now();
    new.issued_by := (select auth.uid());
  end if;

  new.updated_at := now();
  return new;
end;
$$;
