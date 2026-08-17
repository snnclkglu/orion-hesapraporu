// PANEL BÖLÜM TERCİHLERİ — saf çekirdek (config sözleşmesi).
//
// Kimlikler KARARLIDIR: yerleşim değişse de kullanıcının tercihi yaşar.
// Çözümleme `view-state.ts` sözleşmesiyle aynı ruhta: bilinmeyen alan
// SESSİZCE düşer, bozuk ya da gelecekten (v≠1) bir kayıt VARSAYILANA döner —
// tercih tablosundaki bir bozukluk açılış sayfasını asla düşüremez.

export const PANEL_SECTION_IDS = [
  "hizli",
  "gunum",
  "yapilacak",
  "alan",
  "sinyal",
  "ajanda",
  "bildirim",
  "akis",
] as const;

export type PanelSectionId = (typeof PANEL_SECTION_IDS)[number];

export const PANEL_SECTION_LABELS: Record<PanelSectionId, string> = {
  hizli: "Hızlı Eylemler",
  gunum: "Benim Günüm",
  yapilacak: "Yapılacaklarım",
  alan: "Çalışma Alanı",
  sinyal: "Dikkat İsteyenler",
  ajanda: "Yaklaşan",
  bildirim: "Bildirimler",
  akis: "Son Hareketler",
};

/**
 * Katlanabilir bölümler. `hizli` tek çip satırıdır (katlamanın kazandıracağı
 * yer yok), `yapilacak` Benim Günüm bölgesinin çeyreğidir ve giriş kutusudur —
 * ikisi de yalnız GİZLENEBİLİR.
 */
export const COLLAPSIBLE_SECTION_IDS: readonly PanelSectionId[] = [
  "gunum",
  "alan",
  "sinyal",
  "ajanda",
  "bildirim",
  "akis",
];

export interface PanelPrefs {
  hidden: PanelSectionId[];
  collapsed: PanelSectionId[];
}

export const VARSAYILAN_PANEL_PREFS: PanelPrefs = { hidden: [], collapsed: [] };

function idListesi(v: unknown): PanelSectionId[] {
  if (!Array.isArray(v)) return [];
  const gecerli = new Set<string>(PANEL_SECTION_IDS);
  return [...new Set(v.filter((x): x is PanelSectionId => typeof x === "string" && gecerli.has(x)))];
}

/** Veritabanındaki `config` → güvenli tercih nesnesi. */
export function configToPrefs(json: unknown): PanelPrefs {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return VARSAYILAN_PANEL_PREFS;
  }
  const o = json as Record<string, unknown>;
  // Boş nesne (hiç kayıt yazılmamış varsayılan) da geçerlidir; onun dışında
  // sürüm ŞARTTIR ve yalnız v:1 tanınır — gelecekteki bir sürümün kaydını
  // yarım anlamaktansa varsayılana dönmek güvenlidir.
  if (Object.keys(o).length === 0) return VARSAYILAN_PANEL_PREFS;
  if (o.v !== 1) return VARSAYILAN_PANEL_PREFS;
  const collapsed = idListesi(o.collapsed).filter((id) =>
    COLLAPSIBLE_SECTION_IDS.includes(id)
  );
  return { hidden: idListesi(o.hidden), collapsed };
}

/** Tercih nesnesi → veritabanına yazılacak sürümlü config. */
export function prefsToConfig(p: PanelPrefs): {
  v: 1;
  hidden: PanelSectionId[];
  collapsed: PanelSectionId[];
} {
  const temiz = configToPrefs({ v: 1, hidden: p.hidden, collapsed: p.collapsed });
  return { v: 1, hidden: temiz.hidden, collapsed: temiz.collapsed };
}
