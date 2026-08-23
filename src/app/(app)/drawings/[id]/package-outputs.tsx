"use client";

// Çıktılar menüsü — klasörün üç tüketicisine giden dosyalar.
//
// YETKİ KAPISININ DIŞINDADIR ve bu bilinçlidir. `PackageActions` (Yeniden
// Eşleştir · Sil) `canEditDrawings` ile sarılıdır çünkü paketi DEĞİŞTİRİR.
// Çıktı almak ise okumadır: satınalmaya listeyi indiren kişi ile paketi
// düzelten kişi aynı olmak zorunda değil, ve müdürün fiyat çalışması için
// satın alma listesine erişememesi anlamsız olurdu. Bu yüzden ayrı bir
// bileşen — `PackageActions`ın içine konsaydı salt-okunur kullanıcıdan
// SESSİZCE gizlenirdi.
//
// Bağlantılar düz `<a>`: indirme uçları belge döndürür, istemci gezinmesi
// değil. `next/link` burada tarayıcının indirme davranışını bozardı.

import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PackageOutputs({ packageId }: { packageId: string }) {
  const kok = `/drawings/${packageId}/export`;
  const gruplar: { baslik: string; ogeler: { href: string; ad: string; ipucu: string }[] }[] = [
    {
      baslik: "Satınalmaya",
      ogeler: [
        {
          href: `${kok}/purchasing`,
          ad: "Satın Alma Listesi (Excel)",
          ipucu: "Satın alınacaklar · sac ihtiyacı · testere kesim · künye",
        },
      ],
    },
    {
      baslik: "Kesimciye",
      ogeler: [
        {
          href: `${kok}/cutting`,
          ad: "Kesim Listesi (Excel)",
          ipucu: "Malzeme × kalınlık başına sayfa",
        },
      ],
    },
    {
      baslik: "Üretime",
      ogeler: [
        {
          href: `${kok}/production`,
          ad: "İmalat Resim Listesi (Excel)",
          ipucu: "Ağaç sıralı, adet ve ağırlıkla",
        },
        // İKİ AYRI MALİYET, İKİ AYRI İPUCU. Yukarıdaki Excel tek sorgudan
        // saniyeler içinde çıkar; bu uç aynı listenin RESİMLERİNİ depodan tek
        // tek indirip birleştirir (MTC ölçüsü: 171 dosya, ~100 MB). Kullanıcı
        // bunu TIKLAMADAN ÖNCE bilmelidir — bağlantı düz `<a>` olduğu için
        // tarayıcıda hiçbir ilerleme göstergesi yok, sabırsız kullanıcı bir
        // şey olmadığını sanıp üst üste tıklar.
        {
          href: `${kok}/production-pdf`,
          ad: "İmalat Resimleri (Birleşik PDF)",
          ipucu: "Baskıya hazır tek dosya · yüzlerce resim iner, dakikalar sürebilir",
        },
      ],
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Download className="size-3.5" />
          Çıktılar
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[min(20rem,calc(100vw-1.5rem))]">
        {gruplar.map((g, i) => (
          <div key={g.baslik}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="oc-kicker text-muted-foreground">
              {g.baslik}
            </DropdownMenuLabel>
            {g.ogeler.map((o) => (
              <DropdownMenuItem key={o.href} asChild>
                {o.href.endsWith("production-pdf") ? (
                  <PdfDownloadLink
                    href={o.href}
                    shareTitle="İmalat Resimleri"
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="text-sm">{o.ad}</span>
                    <span className="text-[11px] text-muted-foreground">{o.ipucu}</span>
                  </PdfDownloadLink>
                ) : (
                  <a href={o.href} className="flex flex-col items-start gap-0.5">
                    <span className="text-sm">{o.ad}</span>
                    <span className="text-[11px] text-muted-foreground">{o.ipucu}</span>
                  </a>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
