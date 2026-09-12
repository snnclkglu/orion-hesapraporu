// Dosya adından veya istemcinin MIME beyanından bağımsız temel imza kontrolü.
export function attachmentSignatureMatches(
  mime: string,
  bytes: Uint8Array,
): boolean {
  const starts = (signature: number[]) =>
    signature.every((b, i) => bytes[i] === b);
  if (mime === "application/pdf") return starts([37, 80, 68, 70, 45]);
  if (mime === "image/jpeg") return starts([255, 216, 255]);
  if (mime === "image/png") return starts([137, 80, 78, 71, 13, 10, 26, 10]);
  if (mime === "image/webp")
    return (
      starts([82, 73, 70, 70]) &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  if (mime.startsWith("application/vnd.openxmlformats-officedocument."))
    return starts([80, 75, 3, 4]);
  if (mime === "text/plain") return !bytes.includes(0);
  return false;
}
