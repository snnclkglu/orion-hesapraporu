"use client";

// "Güncel İş Listesi" — sayfa başlığının EYLEM yuvasındaki tek düğme.
//
// Belge müşteriye teklif ekinde gider ve FİYAT TAŞIMAZ; düğme bu yüzden
// Satış Takibi'nde durmasına rağmen ticari bir çıktı değil bir REFERANS
// çıktısıdır (bkz. `lib/pdf/job-list.tsx`).
//
// Bağlantılar düz `<a>`: uç bir belge döndürür, istemci gezinmesi değil.
// `next/link` burada tarayıcının indirme davranışını bozardı.
//
// YIL SÜZGECİ AÇILIR LİSTEDEDİR ve liste büyüdükçe kendiliğinden uzar.
// Bugün 88 kalem tek belgeye sığıyor; birkaç yüz kalemde müşteri çoğu zaman
// son iki yılı ister ve o gün yeni bir düğme gerekmeyecek.

import { ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function JobListButton({ years = [] }: { years?: string[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FileText className="size-3.5" />
          İş Listesi (PDF)
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[min(19rem,calc(100vw-1.5rem))]">
        <DropdownMenuLabel className="oc-kicker text-muted-foreground">
          Müşteriye Verilecek Referans Listesi
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href="/sales/is-listesi" className="flex flex-col items-start gap-0.5">
            <span className="text-sm">Tüm İşler</span>
            <span className="text-[11px] text-muted-foreground">
              Yıllara ayrılmış çizelge + müşteri referansları · fiyat yok
            </span>
          </a>
        </DropdownMenuItem>
        {years.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="oc-kicker text-muted-foreground">
              Yalnız Bir Yıl
            </DropdownMenuLabel>
            {years.map((y) => (
              <DropdownMenuItem key={y} asChild>
                <a href={`/sales/is-listesi?yil=${y}`}>
                  <span className="text-sm">{y} yılı işleri</span>
                </a>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
