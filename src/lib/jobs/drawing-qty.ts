/**
 * İş emrindeki serbest metin adedinden güvenli resim çarpanı üretir.
 *
 * Yalnız tek anlamlı "3", "3 Adet" ve "3 Takım" biçimleri okunur. "10+10"
 * ya da "90x2 180 m" gibi ifadelerden ilk sayıyı almak tehlikelidir; bu özel
 * durumlar 1 ile başlar ve kullanıcı Resim Çarpanı kartından düzeltir.
 */
export function defaultDrawingQty(quantityText: string | null | undefined): number {
  const match = /^\s*(\d+)\s*(?:adet|takım|takim)?\s*$/iu.exec(quantityText ?? "");
  if (!match) return 1;
  const qty = Number(match[1]);
  return Number.isInteger(qty) && qty >= 1 && qty <= 10_000 ? qty : 1;
}

/**
 * İş emri düzenlenirken otomatik çarpan yeni adedi izler; kullanıcının daha
 * önce yaptığı özel düzeltme ise korunur.
 */
export function drawingQtyAfterJobEdit(input: {
  previousQty: number | null | undefined;
  previousQuantityText: string | null | undefined;
  nextQuantityText: string | null | undefined;
}): number {
  const previousDefault = defaultDrawingQty(input.previousQuantityText);
  const wasAutomatic = input.previousQty == null || input.previousQty === previousDefault;
  return wasAutomatic
    ? defaultDrawingQty(input.nextQuantityText)
    : input.previousQty!;
}
