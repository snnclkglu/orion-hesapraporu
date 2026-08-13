"use client";

// ÖDEME GÜNÜ SORULUR, VARSAYILMAZ.
//
// Kullanıcı kararı (13.08.2026): *"Siparişler sayfasında bakiye ödendiye
// basıldığında tarih sorsun. Hızlı seçimler olsun. Bugün dün gibi. Tarihi de
// girilebilsin. Aynı şekilde avans ödendi butonunda da aynı özellik olsun."*
//
// Düğmeler bugüne kadar SESSİZCE bugünü yazıyordu. Ödeme günü bu uygulamada
// türetilmiş bir sayı değil bir OLGUdur — ödeme takvimi, vade hesabı ve
// dönem gruplaması hep ona bakar (`terms.ts`). Muhasebeden gelen dekont çoğu
// zaman bir iki gün geriden geliyor; "bugün" varsayımı o farkı sessizce
// kaydediyordu ve kullanıcı yanlışı ancak takvimde görebiliyordu.
//
// POPOVER, DIALOG DEĞİL: bu bir form değil TEK bir alan. Ekranı karartan bir
// pencere, satır satır ilerleyen bir çipe göre fazla ağır bir jesttir ve
// listedeki yerini kaybettirirdi.
//
// HIZLI SEÇİM BİR KISAYOLDUR, TEK YOL DEĞİL. Üç düğme (bugün · dün · önceki
// iş günü) vakaların çoğunu tek dokunuşla kapatır; tarih kutusu her zaman
// açıktır ve istenen günü yazmayı engellemez.

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Yerel gün — `toISOString()` UTC'ye kayar ve akşam saatlerinde dünü yazar. */
export function bugunISO(): string {
  const d = new Date();
  const yerel = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return yerel.toISOString().slice(0, 10);
}

export function gunEkle(iso: string, gun: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

/**
 * Bir önceki İŞ GÜNÜ — cumartesi/pazar atlanır.
 *
 * Havale cuma çıkar, pazartesi sorulur: "dün" o gün pazar olur ve bankada
 * karşılığı olmayan bir tarih yazılırdı.
 */
function oncekiIsGunu(iso: string): string {
  let g = gunEkle(iso, -1);
  for (let i = 0; i < 7; i++) {
    const gun = new Date(`${g}T00:00:00Z`).getUTCDay();
    if (gun !== 0 && gun !== 6) return g;
    g = gunEkle(g, -1);
  }
  return g;
}

export interface OdemeTarihiProps {
  /** Popover'ı açan öğe — çipin kendisi. */
  children: ReactNode;
  /** Başlık: "Bakiye ödendi" gibi. */
  baslik: string;
  /** Seçilen günle çağrılır (ISO). */
  onSec: (tarih: string) => void;
  /** Düzenleme kipinde mevcut değer. */
  varsayilan?: string;
  /** Verilirse "Kaldır" düğmesi çıkar ve işareti siler. */
  onKaldir?: () => void;
}

export function OdemeTarihi({ children, baslik, onSec, varsayilan, onKaldir }: OdemeTarihiProps) {
  const [acik, setAcik] = useState(false);
  const [tarih, setTarih] = useState(varsayilan || bugunISO());

  /**
   * Pencere her açılışta BUGÜNDEN başlar (ya da kayıtlı günden).
   *
   * SIFIRLAMA `useEffect`TE DEĞİL AÇILIŞ OLAYINDA yapılır: efekt içinde
   * `setState` çağırmak zincirleme boyama üretir ve React Compiler bunu bir
   * hata olarak işaretler. Olay zaten tam olarak "açıldı" anını biliyor —
   * efekt o bilgiyi bir tur gecikmeyle taklit ediyordu.
   */
  function acikligiDegistir(yeni: boolean) {
    if (yeni) setTarih(varsayilan || bugunISO());
    setAcik(yeni);
  }

  const bugun = bugunISO();
  const hizli: { etiket: string; gun: string }[] = [
    { etiket: "Bugün", gun: bugun },
    { etiket: "Dün", gun: gunEkle(bugun, -1) },
    { etiket: "Önceki iş günü", gun: oncekiIsGunu(bugun) },
  ];

  return (
    <Popover open={acik} onOpenChange={acikligiDegistir}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(17rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="mb-2 text-[12px] font-medium">{baslik} — hangi gün?</p>

        <div className="mb-2 flex flex-wrap gap-1">
          {hizli.map((h) => (
            <Button
              key={h.etiket}
              type="button"
              size="xs"
              variant={tarih === h.gun ? "default" : "outline"}
              onClick={() => setTarih(h.gun)}
              // Aynı güne denk gelen iki seçenek (pazartesi: dün = pazar,
              // önceki iş günü = cuma) ayrı ayrı durur; hangi düşüncenin
              // seçildiği kullanıcının kendi kararıdır.
              title={h.gun}
            >
              {h.etiket}
            </Button>
          ))}
        </div>

        <Input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="mb-3 font-mono"
          aria-label={`${baslik} tarihi`}
        />

        <div className="flex items-center justify-between gap-2">
          {onKaldir ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                onKaldir();
                setAcik(false);
              }}
            >
              Kaldır
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button type="button" size="xs" variant="outline" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={!tarih}
              onClick={() => {
                onSec(tarih);
                setAcik(false);
              }}
            >
              Kaydet
            </Button>
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
