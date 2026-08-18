// OLAY → TÜRKÇE CÜMLE — TEK SÖZLÜK, İKİ TÜKETİCİ.
//
// İş akış sekmesi (`jobs/akis-view.tsx`) ve panelin Son Hareketler bölümü
// aynı olay defterini basar; sözlük ikisinde ayrı yazılsaydı zamanla ayrışırdı
// (`panel-index.ts` dersinin aynısı). Veritabanı ASCII slug taşır, ekran dili
// yalnız burada üretilir.

import { JOB_STATUS_LABELS, jobStatusOf } from "@/lib/job-status";

export const OLAY_ADLARI: Record<string, string> = {
  olusturuldu: "İş açıldı",
  guncellendi: "İş emri güncellendi",
  revize: "İş emri revize edildi",
  durum: "Durum değişti",
  durum_oto: "Kendiliğinden tamamlandı",
  silindi: "Silindi",
  gorev_acildi: "Görev açıldı",
  gorev_kapandi: "Görev kapandı",
  gorev_atandi: "Görev atandı",
  yorum: "Yorum",
  carpan: "Resim çarpanı",
};

/**
 * Olayın ekran adı. BİLİNMEYEN SLUG HAM DÜŞMEZ: yeni bir olay türü eklenmiş
 * ve sözlük güncellenmemişse ekranda `gorev_x` gibi bir kod değil sakin bir
 * "Değişiklik" görünür — kod adı ekranda geçmez kuralı (md. 15).
 */
export function olayAdi(event: string): string {
  return OLAY_ADLARI[event] ?? "Değişiklik";
}

/** Olayın rengi — YIKICI olanlar ayrışsın, gerisi sessiz kalsın. */
export function olaySinifi(event: string): string {
  if (event === "silindi") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  // Revizyon da vurgulanır: belgenin kimliği değişmiştir ve akışta "güncellendi"
  // satırlarının arasında kaybolmamalıdır.
  if (event === "durum" || event === "durum_oto" || event === "revize") {
    return "border-primary/40 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

function durumAdi(v: unknown): string {
  return typeof v === "string" && v ? JOB_STATUS_LABELS[jobStatusOf(v)] : "—";
}

export interface JobEventLike {
  event: string;
  detail: Record<string, unknown>;
}

/**
 * Olayın tek cümlelik özeti. Ham `jsonb` basılsaydı ekran okunmaz olurdu;
 * her olay türü kendi anlamlı cümlesini söyler, söyleyecek şeyi yoksa SUSAR.
 */
export function olayOzeti(o: JobEventLike): string {
  const d = o.detail;
  switch (o.event) {
    case "olusturuldu": {
      const kalem = typeof d.kalem === "number" ? d.kalem : null;
      return kalem == null ? "" : `${kalem} kalemle açıldı`;
    }
    case "guncellendi": {
      const kalem = typeof d.kalem === "number" ? d.kalem : null;
      return kalem == null ? "" : `${kalem} kalem`;
    }
    case "revize": {
      const from = typeof d.from === "string" ? d.from : "";
      const to = typeof d.to === "string" ? d.to : "";
      return from && to ? `Revizyon ${from} → ${to}` : "";
    }
    case "durum":
      return `${durumAdi(d.from)} → ${durumAdi(d.to)}`;
    case "durum_oto":
      return "Bütün kalemlerin sevk tarihi girildi → Tamamlandı";
    case "gorev_acildi":
    case "gorev_kapandi":
    case "gorev_atandi":
      return typeof d.title === "string" ? d.title : "";
    case "yorum":
      return typeof d.ozet === "string" ? d.ozet : "";
    default:
      return "";
  }
}
