// Paketin biyografisi — kim, ne zaman, ne yaptı.
//
// Sürüm blokları NE DEĞİŞTİĞİNİ anlatır; bu akış KİMİN DEĞİŞTİRDİĞİNİ. İkisi
// aynı ekranda durur çünkü "üretim kaydı taşındı" cümlesinin anlamı, ancak
// yanında hangi farkın olduğu görülünce tamamlanır.
//
// `audit_log` KULLANILMAZ: o tablo `project_id`/`revision_id` yabancı
// anahtarlarıyla hesap raporuna bağlıdır ve teknik resim paketi bambaşka bir
// tanedir. Zorlamak iki modülü birbirine düğümlerdi.

import { History } from "lucide-react";
import { formatNum } from "@/lib/drawings/labels";

export interface PackageEvent {
  id: string;
  event: string;
  at: string;
  actor: string;
  detail: Record<string, unknown>;
  /** Olayın ait olduğu sürümün numarası (paket silinmişse null). */
  revNo: number | null;
}

/** Olay adları Türkçeye burada çevrilir; veritabanı ASCII slug taşır. */
const OLAY_ADLARI: Record<string, string> = {
  olusturuldu: "Paket açıldı",
  revizyon: "Yeni revizyon",
  superse: "Süperse edildi",
  silindi: "Silindi",
  dogrulandi: "Depo doğrulandı",
  icerik_okundu: "İçerik okundu",
  eslestirildi: "Defter kuruldu",
  ilerleme_devri: "Üretim kaydı devri",
  dosya_eklendi: "Dosya eklendi",
};

/** Olayın rengi — YIKICI olanlar ayrışsın, gerisi sessiz kalsın. */
function olaySinifi(event: string): string {
  if (event === "silindi") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (event === "revizyon" || event === "ilerleme_devri") {
    return "border-primary/40 bg-primary/10 text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

function sayi(detail: Record<string, unknown>, anahtar: string): number | null {
  const v = detail[anahtar];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Olayın tek cümlelik özeti.
 *
 * Ham `jsonb` basılsaydı ekran okunmaz olurdu; her olay türü kendi anlamlı
 * sayısını söyler ve söyleyecek bir şeyi yoksa SUSAR.
 */
function ozet(o: PackageEvent): string {
  const d = o.detail;
  switch (o.event) {
    case "dogrulandi": {
      const stored = sayi(d, "stored_count");
      const beklenen = sayi(d, "expected");
      if (stored == null || beklenen == null) return "";
      const eksik = Math.max(0, beklenen - stored);
      const atlanan = sayi(d, "skipped") ?? 0;
      return [
        `${formatNum(stored)}/${formatNum(beklenen)} dosya depoda`,
        eksik > 0 ? `${formatNum(eksik)} ulaşmamış` : "",
        atlanan > 0 ? `${formatNum(atlanan)} atlandı` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "eslestirildi": {
      const parca = sayi(d, "parca");
      const tanima = sayi(d, "tanima");
      const depodaYok = sayi(d, "depoda_yok") ?? 0;
      return [
        parca == null ? "" : `${formatNum(parca)} parça`,
        tanima == null ? "" : `tanıma %${tanima}`,
        depodaYok > 0 ? `${formatNum(depodaYok)} dosya depoda yok` : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "ilerleme_devri":
      return typeof d.ozet === "string" ? d.ozet : "";
    case "revizyon": {
      const rev = sayi(d, "rev_no");
      return rev == null ? "" : `R${String(rev).padStart(2, "0")} bir öncekinin yerine geçti`;
    }
    case "silindi": {
      const dosya = sayi(d, "dosya");
      const nesne = sayi(d, "silinen_nesne");
      return [
        dosya == null ? "" : `${formatNum(dosya)} dosya kaydı`,
        nesne == null ? "" : `${formatNum(nesne)} depo nesnesi`,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return "";
  }
}

function zaman(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function EventTimeline({ olaylar }: { olaylar: PackageEvent[] }) {
  // HİÇ OLAY YOKSA HİÇ RENDER EDİLMEZ. Bu faz öncesinde yüklenmiş paketlerin
  // geçmişi yoktur ve boş bir "kayıt yok" kutusu, her açılışta okunması gereken
  // bir gürültüdür.
  if (olaylar.length === 0) return null;

  return (
    <section className="border bg-card">
      <header className="flex items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4 text-muted-foreground" />
          Denetim Akışı
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          son {formatNum(olaylar.length)} olay
        </span>
      </header>

      <ul className="divide-y">
        {olaylar.map((o) => {
          const metin = ozet(o);
          return (
            <li key={o.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2">
              <span
                className={`border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ${olaySinifi(o.event)}`}
              >
                {OLAY_ADLARI[o.event] ?? o.event}
              </span>
              {o.revNo != null && (
                <span className="font-mono text-[11px] text-muted-foreground">
                  R{String(o.revNo).padStart(2, "0")}
                </span>
              )}
              <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">{metin}</span>
              {o.actor && (
                <span className="text-[11px] text-muted-foreground/80">{o.actor}</span>
              )}
              <span className="font-mono text-[11px] text-muted-foreground/70">
                {zaman(o.at)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
