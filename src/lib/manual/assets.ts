// ŞABLON GÖRSELLERİNİN DEFTERİ — saf (dosya sistemi yok, yalnız tanım).
//
// İKİ TÜR GÖRSEL VARDIR VE İKİSİ AYRI YERDE YAŞAR:
//
//   ŞABLON VARLIĞI (`assetKey`) — her vinçte AYNI olan şey: uyarı
//     piktogramları, sinyal kelimesi çizelgesi, DIN 15020 halat hasar
//     şekilleri. Baytları REPODADIR (`public/manual-assets/`) ve şablondan doğan
//     her kılavuza HAZIR gelir (kullanıcı kararı, 19.08.2026: *"hazır gelsin,
//     değiştirmek istersek zaten değiştiririz"*).
//
//   YÜKLENEN GÖRSEL (`imageId`) — o vincin kendi fotoğrafı: kabin konsolu,
//     HMI ekranı, saha resmi. Baytları DEPODADIR (`manual-images` kovası) ve
//     revizyona bağlıdır.
//
// NEDEN VARLIK REPODA: on altı görsel her kılavuzda aynıdır. Depoya kopyalamak
// her yeni revizyonda 2 MB çoğaltmak ve şablon bir gün düzeltildiğinde eski
// kılavuzların eski şekli taşımaya devam etmesi demekti. Varlık koddur, kodla
// birlikte sürümlenir.
//
// ORAN DEFTERDEDİR VE ÖLÇÜLMÜŞTÜR. PDF yerleşimi (`pdf-layout.ts`) görselin
// yüksekliğini oranından hesaplar; dosyayı açıp ölçmek saf çekirdeği dosya
// sistemine bağlardı. Sayılar `scripts/` ile üretilmedi, dosyalardan OKUNDU —
// bir dosya değiştirilirse buradaki oran da elle güncellenir ve `assets.test.ts`
// ikisinin ayrışmasını yakalar.
//
// KAYNAK: firmanın kendi teslim ettiği 185/40T Şarj Vinci kılavuzu. Halat
// hasar şekilleri DIN 15020'nin muayene kıstaslarıdır ve her çelik halatlı
// vinçte geçerlidir.

/** Bir şablon görselinin tanımı. */
export interface ManualAsset {
  /** `payload` içindeki `assetKey` — kararlı kimlik, dosya adı DEĞİL. */
  key: string;
  /** `public/manual-assets/` altındaki dosya adı. */
  file: string;
  /** Ölçülmüş yükseklik/genişlik oranı. */
  ratio: number;
  /** Editörde ve belgede görünen ad. */
  label: string;
}

export const MANUAL_ASSETS: readonly ManualAsset[] = [
  {
    key: "sinyalKelimeleri",
    file: "sinyal-kelimeleri.png",
    ratio: 0.4463,
    label: "Uyarı düzeyleri ve piktogramlar",
  },
  { key: "uyariPiktogram", file: "uyari-piktogram.png", ratio: 0.8512, label: "Uyarı piktogramı" },
  { key: "onemliPiktogram", file: "onemli-piktogram.png", ratio: 1.0, label: "Önemli piktogramı" },
  { key: "bilgiPiktogram", file: "bilgi-piktogram.png", ratio: 1.5781, label: "Bilgi piktogramı" },
  { key: "ceIsareti", file: "ce-isareti.png", ratio: 0.7203, label: "CE işareti" },

  { key: "halatSoketi1", file: "halat-soketi-1.png", ratio: 0.6662, label: "Halat soketi bağlantısı" },
  { key: "halatSoketi2", file: "halat-soketi-2.png", ratio: 0.5732, label: "Halat soketi montaj adımı" },

  // HALAT HASAR ŞEKİLLERİ — sıra belgedeki sıradır ve muayene kıstaslarının
  // anlatım düzenini izler; alfabetik dizilseydi metinle şekil ayrışırdı.
  { key: "halatHasar1", file: "halat-hasar-1-helis.png", ratio: 0.2066, label: "Helis biçimi bozulma" },
  { key: "halatHasar2", file: "halat-hasar-2-tel-gevsemesi.png", ratio: 0.2952, label: "Dış tellerin gevşemesi" },
  { key: "halatHasar3", file: "halat-hasar-3-dugumlenme.png", ratio: 0.304, label: "Dış tellerin düğümlenmesi" },
  { key: "halatHasar4", file: "halat-hasar-4-tel-cikmasi.png", ratio: 0.4065, label: "Tek tel çıkması" },
  { key: "halatHasar5", file: "halat-hasar-5-kalinlasma.png", ratio: 0.2393, label: "Kalınlaşma bölgesi" },
  { key: "halatHasar6", file: "halat-hasar-6-incelme.png", ratio: 0.1926, label: "Bölgesel incelme" },
  { key: "halatHasar7", file: "halat-hasar-7-ezilme.png", ratio: 0.2058, label: "Ezilme (üzerinden geçme)" },
  { key: "halatHasar8", file: "halat-hasar-8-katlanma.png", ratio: 0.3836, label: "Katlanmışken çekme" },
  { key: "halatHasar9", file: "halat-hasar-9-keskin-bukum.png", ratio: 0.3553, label: "Keskin büküm" },
] as const;

/**
 * UYARI DÜZEYİ → PİKTOGRAM.
 *
 * Belgenin kendi açıklama çizelgesi (`sinyalKelimeleri`) bu üç piktogramı
 * gösteriyor; kutular onları TAŞIMASAYDI çizelge belgede hiç karşılığı
 * olmayan bir şey vaat etmiş olurdu. Üç düzey aynı sarı üçgeni paylaşır —
 * ISO 3864'te genel tehlike işareti tektir, ayrımı SİNYAL KELİMESİ yapar.
 */
export const MANUAL_NOTE_ASSET: Record<string, string> = {
  tehlike: "uyariPiktogram",
  uyari: "uyariPiktogram",
  dikkat: "uyariPiktogram",
  onemli: "onemliPiktogram",
  not: "bilgiPiktogram",
};

const HARITA = new Map(MANUAL_ASSETS.map((a) => [a.key, a]));

export function manualAsset(key: string): ManualAsset | null {
  return HARITA.get(key) ?? null;
}

/**
 * BELGENİN KULLANDIĞI BÜTÜN VARLIK ANAHTARLARI — TEK TANIM.
 *
 * İki kaynaktan gelir ve İKİSİ DE gereklidir: görsel bloklarının `assetKey`i
 * ve uyarı kutularının düzeyine karşılık gelen PİKTOGRAM. İkincisi unutuldu
 * ve ölçüldü — kutular piktogramsız basılıyordu çünkü yükleyici yalnız görsel
 * bloklarına bakıyordu. İndirme ucu ve duman testi artık aynı listeyi çağırır.
 */
export function manualUsedAssetKeys(blocks: readonly { kind: string; assetKey?: string; level?: string }[]): string[] {
  const out = new Set<string>();
  for (const b of blocks) {
    if (b.kind === "image" && b.assetKey) out.add(b.assetKey);
    if (b.kind === "note" && b.level) {
      const pikt = MANUAL_NOTE_ASSET[b.level];
      if (pikt) out.add(pikt);
    }
  }
  return [...out];
}

/** Şablon görsellerinin oran haritası — PDF yerleşimi bunu okur. */
export function manualAssetRatios(): Map<string, number> {
  return new Map(MANUAL_ASSETS.map((a) => [a.key, a.ratio]));
}
