// Adlandırma ÖNERİLERİ — kural listesi değil, kazanç listesi.
//
// Bu defterin `standards/registry.ts` ile aynı işi yaptığına dikkat: orada
// FEM/DIN maddeleri koda bağlanır, burada adlandırma önerileri. İkisinde de
// tehlike aynı: belgede yazan bir madde kodda karşılıksız kalırsa SESSİZCE
// süse döner. Koruma testi iki yönlü tutarlılığı sınar.
//
// DİL ÖNEMLİ. Her madde "şöyle yaparsan sistem şunu da anlar" der, "böyle
// yapmazsan hata verir" demez — çünkü vermez. Hiçbir öneri bir yüklemeyi
// engellemez; en kötü hâlde sistem daha azını anlar ve raporda öyle söyler.

export interface NamingHint {
  /** Kararlı kimlik — bulgular `hintId` ile buraya bağlanır. */
  id: string;
  /** Öneri, tek cümle. */
  title: string;
  /** Uyulursa sistemin KAZANDIĞI şey. */
  gain: string;
}

export const NAMING_HINTS: NamingHint[] = [
  {
    id: "Ö-1",
    title: "Klasör adı parça koduyla başlasın.",
    gain: "Paket iş kalemine kendiliğinden bağlanır; yoksa sihirbaz numarayı sorar.",
  },
  {
    id: "Ö-2",
    title: "Dosya adında parça kodu geçsin.",
    gain: "Dosya deftere ve montaj ağacına oturur; yoksa arşivde durur ve elle bağlanır.",
  },
  {
    id: "Ö-3",
    title: "DXF adında malzeme, kalınlık, kod ve adet bulunsun (sıra serbest).",
    gain: "Kesim listesi ve sac ihtiyacı hesabı kendiliğinden çıkar.",
  },
  {
    id: "Ö-4",
    title: "Her canlı .dwg'nin aynı adlı bir .pdf eşi olsun.",
    gain: "Üretime inen PDF'tir; eşi olmayan model imalatta görünmez.",
  },
  {
    id: "Ö-5",
    title: "İPTAL klasörü yalnız canlı bir adın eski sürümünü barındırsın.",
    gain: "Süperse zinciri doğru kurulur; aynı resim iki farklı içerikle canlı görünmez.",
  },
  {
    id: "Ö-6",
    title: "DXF klasörünün adı, içindeki dosyaların malzeme ve kalınlığıyla aynı olsun.",
    gain: "Çelişki bildirimi düşer. (Çelişkide dosya adı esas alınır, veri kaybolmaz.)",
  },
  {
    id: "Ö-7",
    title: "Excel adında tür (DEPO / ÜRÜN AĞACI), kod ve tarih bulunsun.",
    gain: "Hangi sürümün geçerli olduğu ve hangi kaleme ait olduğu belli olur.",
  },
  {
    id: "Ö-8",
    title: "Kesilecek her parçanın DXF'i pakette bulunsun; .bak yedekleri kalabilir.",
    gain: "Kesimciye eksiksiz paket çıkar. Yedek dosyalar zaten atlanıyor, temizlemeye gerek yok.",
  },
  {
    id: "Ö-9",
    title: "Üretilecek her parçanın bir resmi olsun.",
    gain: "İmalata resimsiz parça inmez. (Boya kesilen standart profil bunun dışındadır.)",
  },
];

export const NAMING_HINT_IDS = NAMING_HINTS.map((h) => h.id);

export function namingHint(id: string): NamingHint | undefined {
  return NAMING_HINTS.find((h) => h.id === id);
}
