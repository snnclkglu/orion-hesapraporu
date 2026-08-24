/** Teklif imzalarının ortak istemci/sunucu depo sözleşmesi. */
export const OFFER_SIGNATURE_BUCKET = "offer-signatures";
export const OFFER_SIGNATURE_MIME = "image/png";
export const MAX_OFFER_SIGNATURE_BYTES = 1024 * 1024;

/** Her yükleme benzersizdir; yayımlanmış revizyonun görseli sonradan değişmez. */
export function offerSignaturePath(
  offerId: string,
  revisionId: string,
  userId: string,
  uploadId: string
): string {
  return `${offerId}/${revisionId}/${userId}/${uploadId}.png`;
}
export function isOfferSignaturePath(
  offerId: string,
  revisionId: string,
  path: string
): boolean {
  const prefix = `${offerId}/${revisionId}/`;
  if (!offerId || !revisionId || !path.startsWith(prefix)) return false;
  const tail = path.slice(prefix.length);
  return /^[0-9a-fA-F-]{16,64}\/[0-9a-fA-F-]{16,64}\.png$/.test(tail);
}
