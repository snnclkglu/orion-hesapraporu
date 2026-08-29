-- Kullanıcı ve müşteri profil puanları yönetimden değiştirilen, açıklanabilir
-- bileşenlere ayrılır. app_settings mevcut yönetici yazma / kimliği doğrulanmış
-- okuma politikalarını devralır; yeni bir yetki yüzeyi açılmaz.

insert into public.app_settings (key, value)
values (
  'profile_scoring',
  '{
    "user": {
      "recencyWeight": 35,
      "consistencyWeight": 35,
      "engagementWeight": 30,
      "activeDaysTarget": 12,
      "activeHoursTarget": 10
    },
    "customer": {
      "recencyWeight": 25,
      "offerActivityWeight": 20,
      "conversionWeight": 25,
      "activeWorkWeight": 20,
      "completenessWeight": 10,
      "recencyWindowDays": 365,
      "annualOfferTarget": 6,
      "activeJobTarget": 2
    }
  }'::jsonb
)
on conflict (key) do nothing;
