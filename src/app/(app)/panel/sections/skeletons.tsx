// İSKELETLER — Suspense sınırlarının yer tutucuları.
//
// Yükseklikler SABİTTİR ve gerçek bölümün tipik boyuna yakındır: içerik
// gelince sayfa zıplamaz (CLS). Başlık GERÇEKTİR — kullanıcı neyin
// yüklendiğini iskelet aşamasında da bilir; yanıp sönen tek şey gövdedir.

import { Baslik } from "./section-frame";

export function SectionSkeleton({
  baslik,
  rows = 4,
  satir = "h-12",
}: {
  baslik: string;
  rows?: number;
  /** Satır yüksekliği sınıfı — bölümün gerçek satır ritmine uydurulur. */
  satir?: string;
}) {
  return (
    <section aria-hidden>
      <Baslik>{baslik}</Baslik>
      <div className="grid gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${satir} animate-pulse border bg-muted/40`} />
        ))}
      </div>
    </section>
  );
}
