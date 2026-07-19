// Yönetim paneli ortak etiketler (TR) — server ve client bileşenler paylaşır.

export const EQUIPMENT_KINDS = [
  { value: "motor", label: "Motor" },
  { value: "gearbox", label: "Redüktör" },
  { value: "rope", label: "Halat" },
  { value: "brake", label: "Fren" },
  { value: "bearing", label: "Rulman" },
  { value: "wheel", label: "Teker" },
  { value: "buffer", label: "Tampon" },
  { value: "hook", label: "Kanca" },
  { value: "sheave", label: "Makara" },
  { value: "coupling", label: "Kaplin" },
  { value: "other", label: "Diğer" },
] as const;

export const KIND_LABELS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_KINDS.map((k) => [k.value, k.label])
);

export const COUPLING_TYPES = [
  { value: "drum", label: "Tambur Kaplini" },
  { value: "brake", label: "Fren Kaplini" },
  { value: "gear", label: "Dişli Kaplin" },
] as const;

export const COUPLING_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  COUPLING_TYPES.map((t) => [t.value, t.label])
);
