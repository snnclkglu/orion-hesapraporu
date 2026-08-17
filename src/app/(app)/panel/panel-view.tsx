// AÇILIŞ PANOSUNUN YERLEŞİM ÇERÇEVESİ — sunucu bileşeni, VERİ ÇEKMEZ.
//
// İki tüketicisi var: gerçek sayfa (`(app)/page.tsx`, bölümleri Suspense'li
// yükleyicilerle doldurur) ve auth'suz görsel önizleme (`/dev/panel-preview`,
// aynı yuvalara fikstürlü bölüm görünümlerini basar). Bölüm SIRASI ve iki
// sütunlu bölgeler YALNIZ burada tanımlıdır — yerleşim tartışması tek dosyada
// yapılır.
//
// Bölüm gövdeleri `sections/` altındadır ve hepsi props ile beslenir; veri
// çekme işi `loaders.tsx`tedir. Bu ayrım sayesinde bir bölümün sorgusu
// yavaşsa yalnız o bölümün iskeleti bekler, sayfanın kalanı akar.

import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { roleLabel } from "@/lib/roles";

/** Uzun tarih: "13 Ağustos 2026, Çarşamba". */
function uzunTarih(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long",
      });
}

/**
 * Bölüm yuvaları — her biri bir `ReactNode`dur (gerçek sayfada Suspense'li
 * yükleyici, önizlemede fikstürlü görünüm). Faz planındaki kararlı bölüm
 * kimlikleriyle adlandırılır; henüz kurulmamış fazların yuvaları opsiyoneldir.
 */
export interface PanelSlots {
  /** Hızlı eylem çipleri (Faz 6) */
  hizli?: React.ReactNode;
  /**
   * Benim Günüm bölgesi — görevlerim, yapılacaklar, favoriler/son bakılanlar
   * ve sana ait resimler. Kendi ızgara sarmalayıcısını KENDİSİ getirir
   * (`MyDayRegion`): "hepsi boşsa hiç çizilme" kararı veriyi gören yerde.
   */
  gunum?: React.ReactNode;
  /** Çalışma Alanı defter satırları (tercihle gizlenebilir) */
  alan?: React.ReactNode;
  /** Dikkat İsteyenler */
  sinyal?: React.ReactNode;
  /** Yaklaşan şeridi */
  ajanda?: React.ReactNode;
  /** Bildirimler */
  bildirim?: React.ReactNode;
  /** Son Hareketler (Faz 6) */
  akis?: React.ReactNode;
}

export function PanelView({
  role,
  displayName,
  today,
  search,
  sections,
  araclar,
}: {
  role: string;
  displayName: string;
  /** "YYYY-MM-DD" — İstanbul saatiyle (bkz. `bugunIstanbul`) */
  today: string;
  /** Kahraman arama kutusu — sayfanın akışında durur, pencere değil. */
  search: React.ReactNode;
  sections: PanelSlots;
  /** Üst şeride giden sayfa araçları (ör. Bölümler menüsü) — veri sayfadan. */
  araclar?: React.ReactNode;
}) {
  // Ad tek sözcüğe iner: "Sinan Çolakoğlu, iyi çalışmalar" bir selam değil bir
  // künyedir. Boş isimde selam hiç basılmaz, uydurma bir "Kullanıcı" yazılmaz.
  const ilkAd = displayName.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="grid gap-8 pb-4">
      {/* Üst şeridin kimlik alanı — PageHeader veri almaz, çerçeve veri-siz
          kalır (dev önizlemede yerinde çizilir). Araçlar (Bölümler menüsü)
          sayfadan yuvaya gelir; eylem satırı dar ekranda kendi satırındadır. */}
      <PageHeader title="Panel" hint="Arama, bugünün işi ve yaklaşan tarihler">
        {araclar}
      </PageHeader>

      {/* ————————————————————————————————————— selam + arama */}
      <header className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {ilkAd ? `İyi çalışmalar, ${ilkAd}` : "İyi çalışmalar"}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {uzunTarih(today)} · <span className="text-foreground/70">{roleLabel(role)}</span>
          </p>
        </div>
        {search}
      </header>

      {/* ————————————————————————————————————— hızlı eylemler */}
      {sections.hizli}

      {/* ————————————————————————————————————— benim günüm */}
      {sections.gunum}

      {/* ————————————————————————————————————— bölümler */}
      {sections.alan}

      {/* ————————————————————————————————————— dikkat + yaklaşan */}
      {(sections.sinyal || sections.ajanda) && (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          {sections.sinyal}
          {sections.ajanda}
        </div>
      )}

      {/* ————————————————————————————————————— bildirim + akış */}
      {(sections.bildirim || sections.akis) && (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          {sections.bildirim}
          {sections.akis}
        </div>
      )}

      {/* Takvim ızgarası bilinçli olarak YOK: bugünkü veri yoğunluğunda ayın
          günlerinin çoğu boş kalırdı ve boş bir ızgara, dolu bir listeden çok
          daha az şey söyler. Kullanıcı kararı: yaklaşan şeridi. */}
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        Yaklaşan listesi otuz günlük penceredir; tarihlerin tamamı ilgili bölümün kendi
        ekranındadır.
      </p>
    </div>
  );
}
