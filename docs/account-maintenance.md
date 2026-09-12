# Profil ve geri bildirim görsellerinin bakımı

## Kurallar

Bakım yalnız `account-avatars` ve `feedback-images` alanlarındadır. En az 25 saatlik, referans dışı görseller adaydır; çalışma en fazla 500 nesne seçer. Aktif avatarlar, kesinleşmiş gönderiler ve süresi dolmamış taslaklar korunur. Aynı avatar klasöründe yeni bir boyut varsa eski boyut da korunur. Profilin yeni fotoğrafa bağlanması iki boyutun da son bir saatte yüklenmesini gerektirir. Eski dosya seçimden sonra tekrar aktif hale getirilemez.

`account-maintenance` ayrı Edge Function'dır. Normal kullanıcı oturumu veya görsel yükleme geçidi bakım çalıştıramaz. Geniş proje anahtarı yerelde aranmaz veya indirilmez; Supabase'in kendi sunucu ortamındaki anahtar kullanılır. Yeni, yalnız bakıma özel anahtar Supabase Edge ortamında ve Vault'ta saklanır. JWT geçidi bu fonksiyonda kapalıdır; bunun yerine her istekte dar bakım anahtarı doğrulanır. Eksik/yanlış anahtar 401 alır.

Tek çalışma kiralaması 15 dakikadır. Çalışan 80 saniyeden sonra yeni dosya grubu başlatmaz; dış çağrılar 15 saniyede zaman aşımına uğrar. Her 50 dosyadan önce adaylık yeniden kontrol edilir. Dosyalar Storage API ile kaldırılır; Storage tablolarından doğrudan satır silinmez. Hata olursa sonraki gruplar durur ve taslak satırı temizleme çalışmaz. Başarılı çalışmada yalnız dosyası kalmamış eski taslaklar silinir. Ağ cevabı kaybolursa bir sonraki iş kalan adaylarla devam eder; sayılar başarılı API cevaplarını gösterir, belirsiz silmeler başarı diye yazılmaz.

## İşletim

Önce `python scripts/account-maintenance-ops.py inspect` ile durum/aday sayıları okunur. `node scripts/account-maintenance-deploy.cjs --prepare` yerel kaynağı kontrol eder; `--check` dahi kaynak kodunu Supabase'e gönderir ve kurulum onayı kapsamındadır. Onaydan sonra aynı betik parametresiz fonksiyonu dağıtır.

`python scripts/account-maintenance-ops.py configure` yalnız kendi bakım işini durdurur, dar anahtarını yeniler, Edge/Vault'a kaydeder ve ilk çalışmayı **silmesiz** doğrular. Bu kontrol başarısızsa zamanlama kapalı kalır. Başarılıysa `orion-account-media-maintenance` günlük `00:15 UTC / 03:15 Türkiye` olarak etkinleştirilir. Cron saat dilimi farklıysa otomatik kurulum durur. Başka cron işlerine dokunulmaz.

- Durum: `python scripts/account-maintenance-ops.py inspect`
- Durdurma: `python scripts/account-maintenance-ops.py pause`
- Yeniden açma: `python scripts/account-maintenance-ops.py resume`
- Silmesiz uzaktan deneme: `python scripts/account-maintenance-ops.py dry-run`; sonrasında `inspect` ile tamamlandığı doğrulanır.

Yönetim → Geri Bildirimler altında son çalışma zamanı ve aday/temizlenen/başarısız sayıları görünür. Bilgi okunamıyorsa geri bildirim listesi kullanılmaya devam eder. 27 saati aşan çalışma aralığı veya süresi aşılmış çalışma uyarı verir. Bu ekran bir bildirim/e-posta izleme servisi değildir. Fonksiyona ulaşmadan başarısız çağrılarda Supabase Cron/pg_net kayıtları incelenir; kuyruğa alınmak başarılı bakım kanıtı değildir.

Eski `account-maintenance.cjs` üzerinden yerel geniş anahtarlı silme yolu kapalıdır. Geri dönüş için zamanlama durdurulur; profil/görev/geri bildirim verileri veya uygulanmış şema silinmez.

## Kontrol kanıtı

`src/lib/account/maintenance-worker.test.ts`: yetkisiz istek, gövde sınırı, varsayılan silmesiz çalışma, tek çalışan, 50'lik gruplar, yeniden kontrol, Storage hatasında durma ve kayıt hatası.

`scripts/account-maintenance-db-tests.sql`: gerçek kimliklerle geri alınan transaction; aktif/karışık yaşlı avatar, kesinleşmiş/güncel/eski taslak, kullanıcı erişimi, kiralama, yeniden kontrol ve dosyası kalan taslağın korunması. Hiçbir gerçek dosya yüklenmez veya silinmez.

Kaynaklar: [Supabase zamanlanmış fonksiyonlar](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase sunucu ortamı ve sırlar](https://supabase.com/docs/guides/functions/secrets). Canlı kurulum durumu `plans/010-panel-kalan-fazlar-ve-yayin.md` içinde tutulur.
