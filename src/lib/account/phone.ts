/** Türkiye telefonu biçim kontrolü; sahiplik veya hat doğrulaması yapmaz. */
export const phoneError = "Telefonu +90 ve 10 rakam olarak girin.";
export function normalizePhone(value: string): string | null {
  const text = value.trim();
  if (!text) return "";
  if (!/^[+0-9() .-]+$/.test(text)) return null;
  let digits = text.replace(/[() .-]/g, "");
  if (digits.startsWith("+90")) digits = digits.slice(3);
  else if (digits.startsWith("0090")) digits = digits.slice(4);
  else if (digits.length === 11 && digits.startsWith("0"))
    digits = digits.slice(1);
  if (!/^[1-9][0-9]{9}$/.test(digits)) return null;
  return `+90${digits}`;
}
export function phoneDisplay(value: string): string {
  const normalized = normalizePhone(value);
  if (!normalized) return value;
  const digits = normalized.slice(3);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}
