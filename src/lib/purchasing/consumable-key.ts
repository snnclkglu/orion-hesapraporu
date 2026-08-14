/**
 * Sarf malzeme tekillik anahtarı.
 *
 * Eski Excel'de aynı tanım; nokta, tire, parantez, `&`/`VE` ve harf kipi
 * farklarıyla birden çok kez yazılmış. Firma anahtarındaki aksan katlama burada
 * fazla agresif kalır; teknik malzeme adında harfleri koruyup yalnız yazım
 * işaretlerini katlarız. Import üreticisi ve canlı form aynı sözleşmeyi kullanır.
 */
export function consumableMatchKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLocaleUpperCase("tr-TR")
    .replace(/&/g, " VE ")
    // Çap işareti Excel'de aynı ölçü için bazen yazılmış, bazen atlanmış
    // (`Ø8MM` / `8MM`). Ölçü metinde kaldığı için işaret kimliği bölmemeli.
    .replace(/Ø/g, " ")
    .replace(/[’'`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
