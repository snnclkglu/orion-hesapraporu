"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface WonOfferOption {
  id: string;
  offerNo: string;
  customerName: string;
  subject: string;
}

/**
 * Yeni İş sayfasındaki ikinci giriş kapısı. Seçim tam teklif ekranına gitmez;
 * mevcut güvenli dönüşüm sayfasına gider ve orada yayımlanmış revizyon,
 * kalemler, tarihler ve kapsam kullanıcıya kontrol ettirilir.
 */
export function WonOfferPicker({ offers }: { offers: WonOfferOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState("");

  return (
    <section className="grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <Trophy className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Kazanılan Tekliften Oluştur</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            İş emrine bağlanmamış kazanılmış teklifi seçin. Müşteri, teknik
            kalemler ve termin önerileri sonraki ekranda otomatik hazırlanır.
          </p>
        </div>
      </div>

      {offers.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full sm:flex-1" aria-label="Kazanılan teklif seç">
              <SelectValue placeholder="Kazanılan teklif seçin" />
            </SelectTrigger>
            <SelectContent>
              {offers.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>
                  {offer.offerNo} · {offer.customerName} · {offer.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => router.push(`/offers/${selected}/work-order`)}
          >
            Taslağı Hazırla <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          İş emrine bağlanmamış, yayımlanmış bir kazanılmış teklif bulunmuyor.
        </p>
      )}
    </section>
  );
}
