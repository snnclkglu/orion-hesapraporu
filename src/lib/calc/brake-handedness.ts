/** Sağ/sol düzeni sipariş bilgisidir; fren torku hesabını değiştirmez. */
export function directionalBrake(type: string | undefined): boolean {
  return /eldro|disk|disc|kasnak/i.test(type ?? "");
}
export function brakeHandednessOptions(count: number): readonly string[] {
  if (count === 1) return ["Sağ", "Sol"];
  if (count === 2) return ["1 sağ 1 sol", "2 sağ", "2 sol"];
  if (count === 4) return ["2 sağ 2 sol", "4 sağ", "4 sol"];
  return [];
}
export function resolvedBrakeHandedness(count: number, value?: string): string {
  const options = brakeHandednessOptions(count);
  return value && options.includes(value) ? value : count === 1 ? "" : options[0] ?? "";
}
export function brakeHandednessNote(type: string | undefined, count: number, value?: string): string {
  const resolved = directionalBrake(type) ? resolvedBrakeHandedness(count, value) : "";
  return resolved ? `, ${resolved}` : "";
}
