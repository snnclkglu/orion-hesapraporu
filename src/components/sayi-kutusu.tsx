"use client";

// SAYI KUTUSU — yazarken VİRGÜL HAYATTA KALIR, dururken BİNLİK AYIRAÇ görünür.
//
// Kullanıcı bildirimi (19.08.2026, md. 1): *"Fiyat bölümündeki kutular 304000
// gösteriyor, 304.000 göstersin."* İstek kozmetik görünür ama aynı kutuda
// ölçülmüş İKİ ayrı veri hatasının üstünde durur ve ikisini birden kapatır:
//
//   1. VİRGÜL SİLİNMESİ — kontrollü kutunun gidiş-dönüşü "0," adımını yutar
//      ("0," → 0 → "0"), yani 0,7 yazmaya çalışan kullanıcı 7 giriyordu. Ölçüm
//      maliyet ekranında yapıldı (18.08.2026); teklif tarafındaki kutular ham
//      `<Input>` olduğu için hata orada duruyordu.
//   2. GRUPLU METNE YAZMA — kutu "304.000" gösterirken sona '5' yazılırsa metin
//      "304.0005" olur ve `parseNum` onu 304,0005 okur (nokta ancak ardında TAM
//      ÜÇ hane varsa binliktir). Ayıracın yalnız odak dışında basılması bu
//      yüzden bir zevk değil, doğruluk şartıdır.
//
// BİLEŞEN ORTAKTIR ve `src/components` altındadır: aynı kutu bugün teklif ve
// maliyet ekranlarında yaşıyor, iki kopya zamanla ayrışır — odak davranışı gibi
// ince bir kural yalnız birinde düzeltilirse fark sessizdir (`cost-parts.tsx`
// başındaki "aynı şekil, ayrı sahip" notunun uyardığı ayrışma).
//
// BİÇİMLEYİCİ İKİNCİ KEZ YAZILMAZ: ayıraç `ParaInput`ın `gosterimMetni`sinden,
// çözümleme `parseNum`dan gelir. Üçüncü bir yerel çözümleyici yazmanın bedeli
// TEKLIF-37'de ölçüldü — "12.44 metre" künyeye 1244 diye düşmüştü.

import { useState } from "react";
import { gosterimMetni } from "@/components/para-input";
import { Input } from "@/components/ui/input";
import { parseNum } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Boş kutu `null` üretir, `0` DEĞİL (SATIS-16). */
export function sayiVeyaNull(raw: string): number | null {
  return parseNum(raw);
}

/** Sayının KANONİK yazımı: tr-TR ondalık ayracı korunur ("19,5"). */
export function kutuMetni(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(v).replace(".", ",");
}

/**
 * Kutuda GÖRÜNEN metin — bileşenin bütün karar mantığı burada, saf.
 *
 * ÜÇ HÂL VARDIR ve üçü de ayrı bir soruya cevap verir:
 *   · TASLAK VARSA yazılan aynen görünür. "0," geçerli bir yazım ADIMIDIR ama
 *     geçerli bir sayı değildir; kutu yazılanı, ebeveyn çözümlenmiş sayıyı alır.
 *   · ODAKTAYSA kanonik (ayıraçsız) yazım görünür — gruplu metnin içine yazmak
 *     çöp üretir (yukarıdaki 2. hata).
 *   · ODAK DIŞINDA `binlik` istenmişse ayıraç basılır.
 */
export function kutuGosterimi(
  value: number | null | undefined,
  {
    taslak = null,
    odakta = false,
    binlik = false,
  }: { taslak?: string | null; odakta?: boolean; binlik?: boolean } = {}
): string {
  if (taslak !== null) return taslak;
  const kanonik = kutuMetni(value);
  return binlik && !odakta ? gosterimMetni(kanonik) : kanonik;
}

/**
 * DIŞARIDAN GELEN DEĞER TASLAĞI DÜŞÜRÜR MÜ?
 *
 * "Tekliften Tazele", asa düğmesi ya da iskontonun birim fiyatlara yansıtılması
 * kutuyu değiştirdiğinde taslak onu maskelememelidir.
 *
 * BOŞ TASLAK DÜŞÜRÜLMEZ ve bu kelepçeli alanların tek çaresidir: kimi çağrı
 * yeri boşu bir varsayılana çeker (`v ?? 2`), kapı yalnız "taslağın sayısı ≠
 * gelen değer" deseydi kutuyu silip yeniden yazmak imkânsızlaşırdı — silinen
 * kutu kendini varsayılanla geri doldurur, yazılan hane onun SONUNA eklenirdi.
 */
export function taslakDusmeli(
  taslak: string | null,
  value: number | null | undefined
): boolean {
  if (taslak === null || taslak.trim() === "") return false;
  return sayiVeyaNull(taslak) !== (value ?? null);
}

export function SayiKutusu({
  value,
  onChange,
  binlik,
  className,
  onFocus,
  onBlur,
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  /**
   * Binlik ayıraç YALNIZ TUTAR kutularında açılır (birim fiyat, maliyet,
   * iskontolu toplam). Adet ve yüzde kutularında kapalıdır: "1.000 adet"
   * yazımı doğru ama gereksiz gürültüdür, yüzde ise hiçbir zaman binlik olmaz.
   */
  binlik?: boolean;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [taslak, setTaslak] = useState<string | null>(null);
  const [odakta, setOdakta] = useState(false);

  // Çizim sırasında sınanır — React'in "türetilmiş durum" kalıbı.
  if (taslakDusmeli(taslak, value)) setTaslak(null);

  return (
    <Input
      {...rest}
      inputMode="decimal"
      value={kutuGosterimi(value, { taslak, odakta, binlik })}
      onChange={(e) => {
        // YAPIŞTIRMA DA BURADAN GEÇER: "1.234.567" ve "1.234,50" gibi gruplu
        // metinleri `parseNum` doğru okur, çözemediğini `null` yapar ve yazılan
        // metin taslakta durmaya devam eder (kullanıcı yazdığını görür).
        setTaslak(e.target.value);
        onChange(sayiVeyaNull(e.target.value));
      }}
      onFocus={(e) => {
        setOdakta(true);
        // Ayıraç düştüğü an metin kısalır ve imlecin durduğu yer anlamını
        // yitirir; seçmek bu sıçramayı GÖRÜNÜR bir davranışa çevirir. Yalnız
        // gruplu kutularda yapılır — ötekilerde metin hiç değişmez ve
        // hepsini seçmek, ortasına tıklayıp düzeltmeyi engellerdi.
        if (binlik) e.currentTarget.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setTaslak(null);
        setOdakta(false);
        onBlur?.(e);
      }}
      className={cn("text-base pointer-fine:text-sm", className)}
    />
  );
}
