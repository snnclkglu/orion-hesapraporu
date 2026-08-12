"use client";

// Yükleme sihirbazının DURUMU — BİLEŞENİN DIŞINDA, modül düzeyinde.
//
// ————————————————————————————————— NEDEN REACT DURUMU DEĞİL
//
// Kullanıcı bildirimi (12.08.2026): *"klasörü yükle'ye bastıktan sonra
// kullanıcı sayfadan çıkarsa veya farklı sayfaya giderse yükleme duruyor."*
// Duruyordu ve sebebi tekti: bütün akış `FolderPicker`ın gövdesindeydi.
// Next.js istemci gezinmesi bileşeni SÖKER; sökülen bileşenin `setState`leri
// boşa düşer, ekran donar, `await` zinciri yarım kalır. Ressam 107 MB'lık bir
// yüklemenin ortasında iş listesine bakamıyordu.
//
// ÇÖZÜM: durumu ve akışı bileşenden bir kat YUKARI, modülün kendisine almak.
// Bir ES modülü sekme ömrü boyunca TEK KEZ değerlendirilir ve gezinmede
// sökülmez — `yuklemeyiBaslat` çağrıldıktan sonra akış, onu başlatan ekran
// kapansa bile sonuna kadar koşar. Bileşen artık bu durumun bir GÖRÜNTÜSÜDÜR:
// `useYukleme()` ile abone olur, geri döndüğünde kaldığı yeri bulur.
//
// SINIR AÇIKÇA SÖYLENİR: bu bir servis işçisi (service worker) değildir.
// Sekmenin kapanması ya da sayfanın YENİDEN YÜKLENMESİ akışı yine keser —
// `beforeunload` uyarısı tam da bu yüzden vardır (`upload-indicator.tsx`).
// Kesilen yükleme kaybolmaz: paket açılmıştır ve "Eksikleri Yükle" sürdürme
// kipi kaldığı yerden devam eder.
//
// DEPOLAMA YOK. Durum `localStorage`a yazılmaz: içinde canlı `File` tutamaçları
// var ve onlar serileştirilemez. Yeniden yüklenen bir sayfada saklanmış bir
// ilerleme çubuğu göstermek, arkasında hiçbir şey koşmadığı hâlde "sürüyor"
// demek olurdu — bu ekranın en pahalı hatası (bkz. folder-picker.tsx başlığı).

import { useSyncExternalStore } from "react";

export type Asama =
  | "secim"
  | "imza"
  | "onizleme"
  | "yukleme"
  | "dogrulama"
  | "okuma"
  | "eslestirme"
  | "ozet";

export interface SecilenDosya {
  file: File;
  relPath: string;
  checksum: string;
}

export interface Basarisiz {
  relPath: string;
  message: string;
  status: number | null;
}

export interface Sonuc {
  packageId: string;
  storedCount: number;
  expectedCount: number;
  skippedCount: number;
  storedBytes: number;
  missing: number;
  recognitionPct: number;
  devirOzeti: string;
}

/** Sihirbazın bulduğu, aynı (kalem, grup) için açık paket. */
export interface AcikPaket {
  id: string;
  folderName: string;
  revNo: number;
  fileCount: number;
  partCount: number;
}

export interface DevamKipi {
  folderName: string;
  targets: { relPath: string; fileId: string; storagePath: string }[];
}

export interface YuklemeDurumu {
  asama: Asama;
  klasorAdi: string;
  dosyalar: SecilenDosya[];
  kalemNo: string;
  /** `?devam=<id>` ile gelinen paket; boşsa yeni paket açılır. */
  devamPackageId: string;
  devam: DevamKipi | null;
  acikPaket: AcikPaket | null;
  supersedeKarari: "" | "revizyon" | "ayri";
  ilerleme: { yapilan: number; toplam: number; bayt: number };
  basarisiz: Basarisiz[];
  durumMetni: string;
  sonuc: Sonuc | null;
  /**
   * Akış GERÇEKTEN koşuyor mu?
   *
   * `asama`dan TÜRETİLMEZ: aşama adı ekranın hangi kutusunu çizeceğini söyler,
   * bu alan ise sekmenin başka bir sayfasında bir işin sürdüğünü söyler.
   * Göstergenin ve `beforeunload` uyarısının baktığı tek alan budur.
   */
  calisiyor: boolean;
  /** Akış eksiksiz bittiyse rapora gidilecek paket; aksi hâlde boş. */
  tamamlananPaketId: string;
}

export const BOS_YUKLEME: YuklemeDurumu = {
  asama: "secim",
  klasorAdi: "",
  dosyalar: [],
  kalemNo: "",
  devamPackageId: "",
  devam: null,
  acikPaket: null,
  supersedeKarari: "",
  ilerleme: { yapilan: 0, toplam: 0, bayt: 0 },
  basarisiz: [],
  durumMetni: "",
  sonuc: null,
  calisiyor: false,
  tamamlananPaketId: "",
};

let durum: YuklemeDurumu = BOS_YUKLEME;
const aboneler = new Set<() => void>();

export function yuklemeDurumu(): YuklemeDurumu {
  return durum;
}

function yayinla() {
  for (const f of [...aboneler]) f();
}

/**
 * Durumu günceller. YENİ NESNE ÜRETİR — `useSyncExternalStore` anlık
 * görüntüyü kimlikle karşılaştırır; yerinde değiştirmek yeniden çizim
 * tetiklemez ve ilerleme çubuğu sessizce donardı.
 */
export function yuklemeYaz(yama: Partial<YuklemeDurumu>) {
  durum = { ...durum, ...yama };
  yayinla();
}

/** Sihirbazı sıfırlar — `File` tutamaçları da bırakılır. */
export function yuklemeSifirla() {
  durum = BOS_YUKLEME;
  yayinla();
}

function aboneOl(f: () => void) {
  aboneler.add(f);
  return () => {
    aboneler.delete(f);
  };
}

/** Sunucu anlık görüntüsü SABİT olmalı; her çağrıda yeni nesne sonsuz döngüdür. */
function sunucuDurumu() {
  return BOS_YUKLEME;
}

export function useYukleme(): YuklemeDurumu {
  return useSyncExternalStore(aboneOl, yuklemeDurumu, sunucuDurumu);
}
