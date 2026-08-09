// Pastel etiket bileşenleri — müşteri adı ve satış kapsamı.
//
// Renk mantığı `lib/tags.ts`te, renk TANIMI `globals.css`teki `.oc-tag`
// kuralındadır (bkz. oradaki gerekçe). Burası yalnız ikisini birleştirir.

import { cn } from "@/lib/utils";
import { customerTag, scopeHue, scopeLabel, tagStyle } from "@/lib/tags";

/**
 * Müşteri etiketi: kısaltma + kendine özgü pastel renk.
 *
 * Tam unvan `title` ile durur — kısaltma ekranı toparlar ama hangi firma
 * olduğunu doğrulamak isteyen kullanıcı üzerine gelince tamamını görür.
 */
export function CustomerTag({
  name,
  shortName,
  hue,
  className,
}: {
  name: string;
  shortName?: string | null;
  hue?: number | null;
  className?: string;
}) {
  const tag = customerTag({ name, shortName, hue });
  if (!tag.full) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      title={tag.full}
      style={tagStyle(tag.hue)}
      className={cn("oc-tag max-w-full truncate px-1.5 py-0.5 text-xs font-medium", className)}
    >
      {tag.short}
    </span>
  );
}

/** Satış kapsamı etiketi — kapsam metnine bağlı sabit pastel ton. */
export function ScopeTag({ scope, className }: { scope: string; className?: string }) {
  const text = (scope ?? "").trim();
  if (!text) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      title={text}
      style={tagStyle(scopeHue(text))}
      className={cn("oc-tag max-w-full truncate px-1.5 py-0.5 text-xs", className)}
    >
      {scopeLabel(text)}
    </span>
  );
}
