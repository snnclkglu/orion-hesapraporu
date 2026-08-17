"use client";

// BİNLİK AYIRAÇLI PARA KUTUSU.
//
// Kullanıcı kararı (13.08.2026): "Net maaş 200000 se örneğin 200.000 gibi
// yazsın" · "Kutu içi değerler 250000 gibi değil 250.000 gibi görünsün."
//
// AYIRAÇ YALNIZ ODAK DIŞINDA BASILIR. Yazarken de basmak iki şeyi birden
// bozardı: metin her tuşta yeniden kurulduğu için imleç sona sıçrar, ve
// "200.0" gibi yarım bir sayı ayıraçlanınca kullanıcının yazdığından başka bir
// sayı görünür. Kutunun DEĞERİ değişmez — yalnız GÖRÜNÜŞÜ değişir; dışarı hep
// ham metin gider ve `parseNum` onu okur.
//
// BİLEŞEN ORTAKTIR, iki ekranda ayrı ayrı yazılmaz: Maaş panosunda dokuz, Ücret
// Planı'nda iki kutu bunu kullanıyor ve iki kopya zamanla ayrışırdı — odak
// davranışı gibi ince bir kural yalnız birinde düzeltilirse fark sessizdir.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { parseNum } from "@/lib/currency";

/**
 * Ondalık ancak GERÇEKTEN varsa basılır: her satıra ",00" yazmak kullanıcının
 * kaldırılmasını istediği gürültünün ta kendisiydi, ama var olan bir kuruşu
 * gizlemek DÜZENLENEBİLİR bir kutuda yalan olurdu.
 */
const GOSTER_FMT = new Intl.NumberFormat("tr-TR", {
  useGrouping: true,
  maximumFractionDigits: 2,
});

export function gosterimMetni(ham: string): string {
  const n = parseNum(ham);
  // Çözülemeyen metin OLDUĞU GİBİ kalır: kullanıcı "45.000," yazmış olabilir
  // ve onu silmek, yazmayı imkânsız kılardı.
  return n === null ? ham : GOSTER_FMT.format(n);
}

export function ParaInput({
  value,
  onChange,
  disabled,
  ariaLabel,
  autoFocus,
  title,
  className,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  autoFocus?: boolean;
  title?: string;
  className?: string;
  /**
   * Ölçek rengi buradan geçer (`--oc-hue`): sınıf `globals.css`te, ton veride.
   * Doğrudan `color` verilmesi için DEĞİLDİR — hex yazmak, aynı rengin açık ve
   * koyu temada birden okunmaması demektir (AGENTS IS-14).
   */
  style?: React.CSSProperties;
}) {
  const [odakta, setOdakta] = useState(false);
  return (
    <Input
      value={odakta ? value : gosterimMetni(value)}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setOdakta(true)}
      onBlur={() => setOdakta(false)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      inputMode="decimal"
      disabled={disabled}
      autoFocus={autoFocus}
      title={title}
      className={className}
      style={style}
      aria-label={ariaLabel}
    />
  );
}
