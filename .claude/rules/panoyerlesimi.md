---
paths:
  - "src/lib/switchboard/**"
  - "orion-hesapraporu/src/lib/switchboard/**"
  - "src/lib/switchboard-data.ts"
  - "orion-hesapraporu/src/lib/switchboard-data.ts"
  - "src/lib/diagrams/panoLayout.ts"
  - "orion-hesapraporu/src/lib/diagrams/panoLayout.ts"
  - "src/lib/diagrams/svg.ts"
  - "orion-hesapraporu/src/lib/diagrams/svg.ts"
  - "src/lib/pdf/pano-layout.tsx"
  - "orion-hesapraporu/src/lib/pdf/pano-layout.tsx"
  - "src/app/(app)/projects/[id]/pano/**"
  - "orion-hesapraporu/src/app/(app)/projects/[id]/pano/**"
  - "scripts/test-switchboard-layout.ts"
  - "orion-hesapraporu/scripts/test-switchboard-layout.ts"
---

# Pano Yerleşimi — kurallar `docs/agent/panoyerlesimi.md` dosyasındadır

Bu alanda **yazmadan önce** `docs/agent/panoyerlesimi.md` dosyasını OKU.
Elektrik projesinden pano boyutlandırma: gövde ızgarası, ray paketleme, bölge sırası, ölçü defteri, şema ve indirme.

Madde kimlikleri `PANO-N` biçimindedir; kod yorumlarındaki atıflar bu deftere gider.

**Uyarı:** `scripts/agent-docs/split.ts --uygula` bu depoda ÇALIŞTIRILMAZ — alan
dosyalarını `AGENTS.md`i ayrıştırarak üretir ve gövdeler kök dosyadan çıkmış
durumda. Denetim salt okunur `npx tsx scripts/agent-docs/doctor.ts` iledir.
