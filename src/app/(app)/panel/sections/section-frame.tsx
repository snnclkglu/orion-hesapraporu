// BÖLÜM ÇERÇEVESİ — panonun başlık, boş durum ve hata durumu TEK dilde.
//
// Eskiden üç bölüm üç ayrı boş-durum biçimi kullanıyordu; artık hepsi
// `PanelEmpty`den geçer. `SectionError` yeni bir hâldir: bir bölümün sorgusu
// düştüğünde bölüm "0 kayıt" gibi görünmez (yokluk iyi haber sanılırdı —
// AGENTS md. 23 kural 5), okunamadığını SÖYLER.

import { TriangleAlert } from "lucide-react";

/** Bölüm başlığı — bu dilin kicker'ı, altında kırmızı kural. */
export function Baslik({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="oc-kicker text-muted-foreground">{children}</h2>
      <span className="oc-rule-red mt-2 block" aria-hidden />
    </div>
  );
}

/** Boş durum — kesikli çerçeve, açıklayıcı düz cümle. Uydurma örnek yok. */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed px-4 py-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Bölüm okunamadı — loader'ın `catch` kolu bunu basar.
 *
 * KEHRİBAR, KIRMIZI DEĞİL: kırmızı bu uygulamada "kontrol sağlanmadı" demektir
 * (AGENTS md. 4); okunamayan bir bölüm bir mühendislik kontrolü değil geçici
 * bir okuma sorunudur.
 */
export function SectionError({ baslik }: { baslik: string }) {
  return (
    <section>
      <Baslik>{baslik}</Baslik>
      <p className="flex items-start gap-3 border border-dashed px-4 py-6 text-sm text-muted-foreground">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <span>
          Bu bölüm şu anda okunamadı — gösterilen bir sayı yok. Sayfayı
          yenileyin; sorun sürerse yöneticinize haber verin.
        </span>
      </p>
    </section>
  );
}
