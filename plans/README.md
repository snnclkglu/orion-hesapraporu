# Uygulama geliştirme planları

| Plan | Kapsam | Durum |
| --- | --- | --- |
| [004 — Panel görev yönetimi](004-panel-gorev-yonetimi.md) | Görev/ekip/pano ve güvenli Agent API | Çekirdek uygulandı; fiziksel cihaz ve yayın kabulü açık |
| [005 — Profilim, geri bildirim ve mobil kalite](005-profil-geri-bildirim-mobil-kalite.md) | Avatar, kişisel profil, Yönetim geri bildirimleri; mevcut Panel dahil mobil kabul fazları | Kod/şema ve Supabase görsel geçidi kuruldu; gerçek fotoğraf/cihaz kabulü ve yayın açık |
| [006 — Ekip yönetimi ve görev görünürlüğü](006-ekip-yonetimi-gorev-gorunurlugu.md) | Yönetim/Ekipler, aranabilir üyelik, ekip ve kişiye özel atama; ek mobil/yetki kontrol fazları | Uygulandı; otomatik kontroller geçti, fiziksel pilot/yayın açık |
| [007 — Uygulama ve kontrol kaydı](007-profil-ekip-uygulama-kontrol.md) | 005/006 faz sonuçları, kanıtlar, kurulum ve pilot kapanış adımları | Güncel teslim kaydı |
| [008 — Asana karşılaştırması ve iyileştirme](008-asana-karsilastirma-ve-iyilestirme.md) | Resmi web/mobil kanıtları; mobil filtre, kişisel görünüm, haftalık ajanda, tekrar, kontrol listesi ve beklenen görevler | S0/U1–U3 uygulandı; otomatik kontroller geçti, saha/pilot/yayın kapıları açık |
| [010 — Panel kalan fazlar ve yayın](010-panel-kalan-fazlar-ve-yayin.md) | Telefon erişimi, gerçek fotoğraf/geri bildirim, fiziksel mobil kabul, bakım, ekip pilotu ve yayın; aralarda kontrol fazları | Plan hazır; cihaz ve pilot bilgisi bekleniyor, teknik hazırlık bağımsız ilerleyebilir |
| [011 — Panel mobil sadeleştirme ve klavye](011-panel-mobil-sadelestirme-ve-klavye.md) | Gerçek iPhone bulguları: klavye, yatay taşma, dört sekmeli navigasyon, kompakt kartlar ve +90 telefon maskesi | Uygulandı; otomatik mobil ve SQL kontrolleri geçti, fiziksel iPhone kabulü açık |

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
