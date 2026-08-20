/**
 * Açık adresin bir üst sayfası. Özel iş akışları `PageHeader.backHref` ile bu
 * varsayılanı ezer; sıradan alt sayfalarda URL ağacı doğru üst sayfadır.
 */
export function parentPagePath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
}
