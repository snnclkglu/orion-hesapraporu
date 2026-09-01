"use client";

// KATLANABİLİR BÖLÜM — başlık + katlama oku + isteğe bağlı ton açısı.
//
// Gövdeler maliyet editöründen (`offers/[id]/costs/[costRevId]/cost-parts.tsx`)
// DEĞİŞMEDEN taşındı; o dosya bunları yeniden dışa verir, yani hiçbir çağrı yeri
// değişmedi. Taşımanın sebebi ikinci bir kullanıcının doğmasıdır (hesap
// raporundaki AĞIRLIK DÖKÜMÜ penceresi): aynı katlama davranışını ikinci kez
// yazmak, `cost-parts.tsx`in kendi başındaki "aynı şekil, ayrı sahip" uyarısının
// tarif ettiği ayrışmanın ta kendisi olurdu (değişmez md. 8). Rotalar arası
// `"use client"` içe aktarımı da böylece gerekmez.

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KATLAMA DENETİMİ — bir bölümün açık/kapalı olması.
 *
 * Kullanıcı isteği (18.08.2026, md. 6): *"PROJE MALİYETİ gibi ana bölümler ve
 * YÜRÜTME VE TEKER gibi alt bölümler bir butonla daraltılabilsin."*
 *
 * DURUM BELGEDE DEĞİL EKRANDA YAŞAR. Bir bölümün kapalı olması bir GÖRÜNÜM
 * tercihidir; maliyet belgesinin içeriği değildir. Belgeye yazılsaydı iki şey
 * olurdu: yayımlanmış (kilitli) bir maliyette bölüm katlanamazdı, ve bir
 * kullanıcının katladığı bölüm ötekinin ekranında da kapalı açılırdı.
 */
export interface Katlama {
  kapali: (anahtar: string) => boolean;
  degistir: (anahtar: string) => void;
}

/** Katlama okunu çizen düğme — ana bölümde ve alt grupta aynı şekil. */
export function KatlaDugmesi({
  kapali,
  onClick,
  baslikMetni,
}: {
  kapali: boolean;
  onClick: () => void;
  baslikMetni: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!kapali}
      title={kapali ? `${baslikMetni} — aç` : `${baslikMetni} — daralt`}
      aria-label={kapali ? `${baslikMetni} — aç` : `${baslikMetni} — daralt`}
      className="oc-tap-square inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronDown className={cn("size-4 transition-transform", kapali && "-rotate-90")} />
    </button>
  );
}

export function Bolum({
  baslik,
  aciklama,
  sag,
  ton,
  katlama,
  katlamaAnahtari,
  children,
}: {
  baslik: string;
  aciklama?: string;
  /** Başlığın sağındaki eylem ya da özet. */
  sag?: React.ReactNode;
  /**
   * BÖLÜM RENGİNİN TON AÇISI — verilmezse bölüm renksizdir.
   *
   * Kullanıcı isteği (22.08.2026, md. 13): *"başlıklarda bölümlerde AZ DA
   * OLSA renklendirme"*. "Az da olsa" ölçüdür: renk YALNIZ BAŞLIK ŞERİDİNE
   * verilir, bölümün gövdesine değil. PROJE MALİYETİ bölümü açıkken üç bin
   * piksel uzayabiliyor; zemini boyamak sayfayı renkli bir duvara çevirirdi
   * ve ayırt edicilik de tam orada kaybolurdu.
   *
   * Renk TEK TAŞIYICI DEĞİLDİR: başlık zaten YAZIYLA duruyor.
   */
  ton?: number;
  /** Verilirse başlık katlanabilir olur. */
  katlama?: Katlama;
  katlamaAnahtari?: string;
  children: React.ReactNode;
}) {
  const anahtar = katlamaAnahtari ?? baslik;
  const katlanir = katlama !== undefined;
  const kapali = katlanir && katlama.kapali(anahtar);
  const tonlu = ton !== undefined;
  const tonStili = tonlu ? ({ "--oc-hue": `${ton}` } as React.CSSProperties) : undefined;

  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <header
        className={cn(
          "flex flex-wrap items-start gap-2",
          tonlu && "oc-fieldgroup -mx-1 rounded-sm py-1.5 pr-2 pl-2"
        )}
        style={tonStili}
      >
        {katlanir ? (
          <KatlaDugmesi
            kapali={kapali}
            baslikMetni={baslik}
            onClick={() => katlama.degistir(anahtar)}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2
            className={cn("text-sm font-semibold tracking-wide", tonlu && "oc-fieldgroup-title")}
            style={tonStili}
          >
            {baslik}
          </h2>
          {/* AÇIKLAMA KAPALIYKEN GİZLENİR: katlamanın amacı dikey yer
              kazanmaktı; iki satırlık bir açıklama kalsaydı kazanç yarıya
              inerdi. Başlık ve SAĞDAKİ ÖZET (tutar) kalır — kapalı bir
              bölümün tutarı görünmeseydi katlamak bilgi kaybı olurdu. */}
          {aciklama && !kapali ? (
            <p className="text-xs text-muted-foreground">{aciklama}</p>
          ) : null}
        </div>
        {sag}
      </header>
      {kapali ? null : children}
    </section>
  );
}

export function MiniDugme({
  children,
  baslik,
  aktif,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  baslik: string;
  aktif?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={baslik}
      aria-label={baslik}
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "oc-tap-square inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
        aktif && "bg-muted font-medium text-foreground"
      )}
    >
      {children}
    </button>
  );
}
