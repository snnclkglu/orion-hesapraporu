import Image from "next/image";
import { LinkIcon } from "lucide-react";

/*
 * MÜŞTERİ YÜZÜNÜN 404'Ü TÜRKÇEDİR.
 *
 * `(public)` grubu — vinç kimlik portalı, teknik resim paylaşımı, katalog —
 * dışarıya açıktır. Bir kök `not-found.tsx` hiç yoktu; QR'ı yanlış okuyan ya
 * da bağlantısı kapatılmış bir müşteri Next'in İNGİLİZCE varsayılan ekranını
 * görüyordu: markasız, dilsiz ve ne yapacağını söylemeyen bir sayfa.
 *
 * Burada iç uygulamaya BAĞLANTI VERİLMEZ. Müşteri bizim uygulamamızı görmemeli;
 * yapabileceği tek şey QR'ı yeniden okutmak veya bize yazmaktır.
 */
export default function PublicNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-3 py-10">
      <section className="w-full max-w-md border bg-card">
        <header className="border-b-4 border-primary bg-[#262626] px-6 py-6 text-[#F4F1EF]">
          <Image src="/brand/orion-logo-white.svg" alt="ORION CRANES" width={788} height={96} className="h-auto w-[200px] max-w-full" />
          <p className="mt-4 font-mono text-[10px] font-semibold tracking-[0.2em] text-white/60">
            GÜVENLİ MÜŞTERİ DOKÜMAN PORTALI
          </p>
        </header>
        <div className="p-5 sm:p-6">
          <div className="grid size-11 place-items-center border bg-muted text-primary">
            <LinkIcon className="size-5" />
          </div>
          <h1 className="mt-4 text-xl font-bold">Bağlantı bulunamadı</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Bu adres geçerli değil ya da paylaşım kapatılmış olabilir. Vincin üzerindeki
            QR kodunu yeniden okutmayı deneyin; kod okunmuyorsa plakadaki adresi ve kodu
            tarayıcıya elle yazabilirsiniz.
          </p>
          <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
            Sorun sürerse vinçle birlikte teslim edilen dokümanlardaki ORION iletişim
            adresine yazın ve plakadaki seri numarasını belirtin.
          </p>
        </div>
      </section>
    </main>
  );
}
