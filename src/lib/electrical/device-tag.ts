// AYGIT ETİKETİ — `=185T+LVD01-F31` üçe ayrılır.
//
// IEC 81346 kimlik ön ekleri: `=` tesis (installation), `+` konum (location),
// `-` aygıt (device). Ayrımı yapmak bir süsleme değil: PANEL DÖKÜMÜ konumdan
// çıkar ("bu panoya hangi malzemeler giriyor") ve el kitabının elektrik eki
// bu dökümü basar.
//
// SIRA GARANTİ DEĞİLDİR. Bazı dışa aktarımlarda konum tesisten önce yazılır
// (`+LVD01=185T-F31`) ve bazılarında tesis hiç yoktur. Ayrıştırıcı bu yüzden
// sırayı değil ÖN EKİ okur.

import type { DeviceTag } from "./types";

const BOS: DeviceTag = { installation: "", location: "", device: "" };

/**
 * Etiketi üç parçaya ayırır.
 *
 * Tanınmayan bir dizge BOŞ döner — yarısı doğru bir ayrıştırma, panel
 * dökümüne uydurma bir pano açardı (değişmez md. 4).
 */
export function parseDeviceTag(raw: string | null | undefined): DeviceTag {
  const s = (raw ?? "").trim();
  if (!s) return BOS;

  const out = { ...BOS };
  // Ön ek görülene kadarki metin kimsenin değildir; ön eksiz bir etiket
  // (ör. `F31`) AYGIT sayılır — dışa aktarımların bir kısmı tek kademelidir.
  let i = 0;
  if (!/^[=+-]/.test(s)) {
    const j = s.search(/[=+]/);
    out.device = (j < 0 ? s : s.slice(0, j)).trim();
    i = j < 0 ? s.length : j;
  }

  while (i < s.length) {
    const mark = s[i];
    // Bir sonraki ön ek nerede başlıyor? `-` ancak KOD İÇİNDE değilse ayraçtır:
    // `3RV2011-1EA10` bir aygıt kodu değil bir tip numarasıdır ama etiket
    // alanında tire yalnız aygıt ön eki olarak geçer, o yüzden ilk tire yeter.
    let j = i + 1;
    while (j < s.length && !"=+-".includes(s[j])) j++;
    const val = s.slice(i + 1, j).trim();
    if (mark === "=") out.installation ||= val;
    else if (mark === "+") out.location ||= val;
    else out.device = out.device ? `${out.device}-${val}` : val;
    i = j;
  }
  return out;
}

/** Konumun görünen adı; boşsa "—" değil BOŞ döner (sunum katmanı karar verir). */
export function locationLabel(tag: DeviceTag): string {
  return tag.location ? `+${tag.location}` : "";
}
