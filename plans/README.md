# Uygulama geliştirme planları

- [013 — Tüm bölümlerde mobil ve tablet alt barı](013-tum-bolumler-mobil-tablet-alt-bar.md) — 12 ana bölüm, kayıt ayrıntıları ve editörler için 4–5 öğeli bar önerileri; tablet/klavye davranışı, uygulama fazları ve kabul ölçütleri. Uygulandı; bölüm bazlı barlar, kayıt koruması ve mobil/tablet kontrol kanıtları planın uygulama kaydında.

| Plan | Kapsam | Durum |
| --- | --- | --- |
| [004 — Panel görev yönetimi](004-panel-gorev-yonetimi.md) | Görev/ekip/pano ve güvenli Agent API | Çekirdek uygulandı; fiziksel cihaz ve yayın kabulü açık |
| [005 — Profilim, geri bildirim ve mobil kalite](005-profil-geri-bildirim-mobil-kalite.md) | Avatar, kişisel profil, Yönetim geri bildirimleri; mevcut Panel dahil mobil kabul fazları | Kod/şema ve Supabase görsel geçidi kuruldu; gerçek fotoğraf/cihaz kabulü ve yayın açık |
| [006 — Ekip yönetimi ve görev görünürlüğü](006-ekip-yonetimi-gorev-gorunurlugu.md) | Yönetim/Ekipler, aranabilir üyelik, ekip ve kişiye özel atama; ek mobil/yetki kontrol fazları | Uygulandı; otomatik kontroller geçti, fiziksel pilot/yayın açık |
| [007 — Uygulama ve kontrol kaydı](007-profil-ekip-uygulama-kontrol.md) | 005/006 faz sonuçları, kanıtlar, kurulum ve pilot kapanış adımları | Güncel teslim kaydı |
| [008 — Asana karşılaştırması ve iyileştirme](008-asana-karsilastirma-ve-iyilestirme.md) | Resmi web/mobil kanıtları; mobil filtre, kişisel görünüm, haftalık ajanda, tekrar, kontrol listesi ve beklenen görevler | S0/U1–U3 uygulandı; otomatik kontroller geçti, saha/pilot/yayın kapıları açık |
| [010 — Panel kalan fazlar ve yayın](010-panel-kalan-fazlar-ve-yayin.md) | Telefon erişimi, gerçek fotoğraf/geri bildirim, fiziksel mobil kabul, bakım, ekip pilotu ve yayın; aralarda kontrol fazları | Plan hazır; cihaz ve pilot bilgisi bekleniyor, teknik hazırlık bağımsız ilerleyebilir |
| [011 — Panel mobil sadeleştirme ve klavye](011-panel-mobil-sadelestirme-ve-klavye.md) | Gerçek iPhone bulguları: klavye, yatay taşma, dört sekmeli navigasyon, kompakt kartlar ve +90 telefon maskesi | Uygulandı; otomatik mobil ve SQL kontrolleri geçti, fiziksel iPhone kabulü açık |
| [014 — Görev etkileşimleri, etiketler ve detay](014-panel-gorev-etkilesimleri-etiketler-ve-detay.md) | Basılı tutma/kaydırma, geri alınabilir arşiv, renkli etiketler ve Grokbot API, mobil pencere, anlaşılır detay ve denetimli iptal | Kod ve Supabase şeması uygulandı; Chromium/WebKit, SQL, 49 kod/API testi ve derleme geçti; kullanıcı onayıyla canlıda yayınlandı; canlı erişim kontrolleri geçti, fiziksel cihaz/Grokbot saha kabulü açık |

## API ve entegrasyon yönetimi

| Plan | Kapsam | Durum |
| --- | --- | --- |
| [012 — API ve Entegrasyonlar](012-api-ve-entegrasyon-yonetimi.md) | Yönetim bağlantı/izin paneli, uç nokta kataloğu, Grokbot teşhisi, mevcut token'ı koruyan anahtar yönetimi, istek ölçümü ve mobil kontrol fazları | Uygulandı ve canlıda yayınlandı; otomatik kontroller geçti, Grokbot aktarım onayı ve fiziksel pilot açık |

## Animation plans

These plans record the ORION motion baseline before source edits. Execute them in order because the first removes unbounded transitions, the second establishes the accessibility fallback, and the third removes remaining layout-bound motion.

| # | Plan | Severity | Status | Dependency |
| --- | --- | --- | --- | --- |
| 001 | Bound control transitions | HIGH | DONE | — |
| 002 | Honor reduced motion | MEDIUM | DONE | 001 |
| 003 | Remove layout-bound motion | HIGH | DONE | 001, 002 |

## Recommended order

1. `001-bound-control-transitions.md`
2. `002-honor-reduced-motion.md`
3. `003-remove-layout-motion.md`

After implementation, run the motion review against the diff, the Impeccable detector against changed UI files, and the repository's type/lint checks. Mark a plan `DONE` only after both mechanical and visual verification pass.

- [009 — Çizim İşleme / yerel AutoCAD](009-cizim-isleme-autocad.md) — kontrollü entegrasyon ve kabul aşamaları.
