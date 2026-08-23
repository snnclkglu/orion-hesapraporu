/**
 * Content-Disposition içinden kullanıcıya gösterilecek gerçek dosya adını
 * okur. Sunucu uçları Türkçe ad için RFC 5987 `filename*`, eski tarayıcılar
 * için ASCII `filename` taşır; öncelik her zaman eksiksiz UTF-8 addadır.
 */
export function fileNameFromDisposition(
  disposition: string | null,
  fallback = "belge.pdf"
): string {
  if (!disposition) return safeDownloadName(fallback);

  const encoded = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return safeDownloadName(decodeURIComponent(stripQuotes(encoded.trim())));
    } catch {
      // Bozuk yüzde kodu varsa aşağıdaki ASCII ada düşülür.
    }
  }

  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(disposition)?.[1];
  if (quoted) return safeDownloadName(quoted);

  const plain = /filename\s*=\s*([^;]+)/i.exec(disposition)?.[1];
  return safeDownloadName(plain ? stripQuotes(plain.trim()) : fallback);
}

/** Yol parçalarını ve denetim karakterlerini dosya adından çıkarır. */
export function safeDownloadName(value: string): string {
  const cleaned = value
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return cleaned || "belge.pdf";
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}
