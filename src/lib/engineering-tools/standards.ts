export interface TechnicalSource {
  id: string;
  title: string;
  edition: string;
  kind: "standard" | "manufacturer" | "user-document" | "calculation";
  url?: string;
  note?: string;
}

export const TECHNICAL_SOURCES = {
  keyway: { id: "keyway-user", title: "Keyway and Key Size Dimensions", edition: "Kullanıcı belgesi", kind: "user-document" },
  fits: { id: "jis-b-0401", title: "JIS B 0401", edition: "1999", kind: "standard", note: "Kullanıcının sağladığı tablo kapsamı" },
  iso286: { id: "iso-286", title: "ISO 286-1 / ISO 286-2", edition: "2010 + Cor.1:2013", kind: "standard", url: "https://www.iso.org/standard/54915.html" },
  beket: { id: "beket-pad", title: "Beket Crane Rail Pad", edition: "Kullanıcı kataloğu", kind: "manufacturer" },
  crapex: { id: "crapex", title: "Crapex ray krapoları", edition: "10.09.2026 erişimi", kind: "manufacturer", url: "https://www.crapex.com.tr/urunler" },
  suptex: { id: "suptex-dmk", title: "SUPTEX DMK Keçe Ölçüleri", edition: "DMK-mm 2013", kind: "manufacturer" },
  din15058: { id: "din-15058", title: "DIN 15058 - Hebezeuge; Achshalter", edition: "1974-08", kind: "standard", url: "https://www.dinmedia.de/en/standard/din-15058/649750" },
  iso273: { id: "iso-273", title: "ISO 273 - Geçiş delikleri", edition: "1979, 2024'te teyit edildi", kind: "standard", url: "https://www.iso.org/standard/4183.html" },
  torque: { id: "torque-reference", title: "VDI 2230 yaklaşımı / ISO 16047 kapsamı", edition: "Referans ön boyutlandırma", kind: "calculation", url: "https://www.iso.org/standard/27788.html" },
  eurocodeBolts: { id: "en-1993-1-8", title: "EN 1993-1-8", edition: "2005 Tablo 3.3 ön seçim; 2024 baskısı ayrıca doğrulanmalı", kind: "standard", url: "https://www.dinmedia.de/en/standard/din-en-1993-1-8/378329080" },
  circlips: { id: "din-471-472", title: "DIN 471 / DIN 472", edition: "Üretici tabloları; 2026 baskısı doğrulanmalı", kind: "manufacturer", url: "https://www.dinmedia.de/en/standard/din-471/399916408" },
  access: { id: "access-safety", title: "EN ISO 14122 / EN 13586 / EN ISO 13857", edition: "2016 / 2026 / 2019", kind: "standard", url: "https://www.iso.org/standard/61282.html" },
} as const satisfies Record<string, TechnicalSource>;
