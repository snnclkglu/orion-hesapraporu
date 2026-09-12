/** Yalnız durağan, metadata taşımayan WebP kabul edilir; MIME adına güvenilmez. */
export function inspectWebp(bytes: Uint8Array, maxSide: number) {
  const fail = () => { throw new Error("Görsel güvenli WebP biçiminde değil."); };
  if (bytes.length < 20 || bytes.length > 10485760) return fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (n: number) => String.fromCharCode(...bytes.subarray(n, n + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP" || view.getUint32(4, true) !== bytes.length - 8) return fail();
  const seen = new Set<string>(); let width = 0, height = 0, canvasW = 0, canvasH = 0;
  for (let p = 12; p < bytes.length;) {
    if (p + 8 > bytes.length) return fail();
    const kind = tag(p), size = view.getUint32(p + 4, true), start = p + 8;
    if (start + size + (size % 2) > bytes.length || seen.has(kind)) return fail();
    seen.add(kind);
    if (kind === "VP8X") {
      if (p !== 12 || size !== 10 || (bytes[start] & ~16) !== 0) return fail();
      canvasW = 1 + bytes[start+4] + (bytes[start+5]<<8) + (bytes[start+6]<<16);
      canvasH = 1 + bytes[start+7] + (bytes[start+8]<<8) + (bytes[start+9]<<16);
    } else if (kind === "VP8 ") {
      if (size < 10 || width || bytes[start+3] !== 157 || bytes[start+4] !== 1 || bytes[start+5] !== 42) return fail();
      width = view.getUint16(start+6,true) & 16383; height = view.getUint16(start+8,true) & 16383;
    } else if (kind === "VP8L") {
      if (size < 5 || width || bytes[start] !== 47) return fail();
      const bits = view.getUint32(start+1,true);
      if (bits >>> 29) return fail();
      width = (bits & 16383) + 1; height = ((bits >>> 14) & 16383) + 1;
    } else if (kind === "ALPH") {
      if (!seen.has("VP8X") || width || size < 1) return fail();
    } else return fail();
    p = start + size + (size % 2);
  }
  if (!width || !height || width > maxSide || height > maxSide || (canvasW && (canvasW !== width || canvasH !== height))) return fail();
  return { width, height };
}
