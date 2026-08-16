// İşler görünüm durumu — adres sözleşmesinin TEK tanım yeri.
//
// /jobs tek sayfadır ve görünümü (tablo · pano · takvim · zaman) ile bütün
// süzgeç/sıralama durumunu ADRESTE taşır (Satın Alma'nın adres-suzgec kalıbı):
// filtrelenmiş bir görünümün bağlantısı paylaşılabilir ve yenilemede
// kaybolmaz. Excel indirme ucu da aynı adresi okur — ekran ile çıktı tek
// sözleşmeden geçer.
//
// VARSAYILAN ADRESE YAZILMAZ: boş adres "varsayılan görünüm" demektir ve
// kayıtlı görünümler (kullanıcının açılış tercihi) tam bu boşluğa uygulanır.
// Kayıtlı görünüm bu durumun adlandırılmış bir FOTOĞRAFIDIR; sözleşme bu
// yüzden SÜRÜMLÜDÜR ({v:1}) ve bilinmeyen alanı sessizce düşürür — ileride
// eklenen bir alan eski kaydı bozmaz.
//
// YIL AYRIKSI DAVRANIR: parametre yokken varsayılan "içinde bulunulan yıl"dır
// ama o yıl boşsa liste boş kalmasın diye "tümü"ne düşülür (İşler'in eski
// kuralı). Bu çözüm VERİYE baktığı için parse'ta değil `resolveYear`dadır;
// "tumu" ise Personel özetindeki gibi AÇIK bir seçimdir — boş adres
// varsayılanı seçemezdi.

import { z } from "zod";

export const JOB_VIEWS = ["tablo", "pano", "takvim", "zaman"] as const;
export type JobView = (typeof JOB_VIEWS)[number];

export const JOB_SORT_KEYS = [
  "job_no",
  "title",
  "customer",
  "itemCount",
  "craneCount",
  "date",
  "status",
] as const;
export type JobSortKey = (typeof JOB_SORT_KEYS)[number];

export const JOB_GROUPS = ["durum", "musteri", "lider", "yil"] as const;
export type JobGroup = (typeof JOB_GROUPS)[number];

export interface JobSort {
  key: JobSortKey;
  desc: boolean;
}

/** Varsayılan sıralama: iş no kronolojik artar, en büyük numara en yeni iştir. */
export const DEFAULT_JOB_SORT: JobSort = { key: "job_no", desc: true };

export interface JobsViewState {
  view: JobView;
  /** undefined = veriye göre varsayılan (bkz. `resolveYear`). "tumu" = hepsi. */
  yil: string | undefined;
  /** Müşteri TAM UNVAN listesi (satırdaki alanla eşleşmek zorunda). */
  musteri: string[];
  durum: string[];
  q: string;
  sirala: JobSort;
  /** Yalnız pano görünümü: gruplama boyutu. */
  grup: JobGroup;
  /** Yalnız takvim görünümü: "YYYY-MM". undefined = içinde bulunulan ay. */
  ay: string | undefined;
}

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `URLSearchParams` ile Next'in `ReadonlyURLSearchParams`ının ortak yüzü. */
export interface ParamsLike {
  get(name: string): string | null;
}

function parseList(v: string | null): string[] {
  // Değerler virgülle dizilir — adres-suzgec.ts ile aynı sözleşme.
  return v ? v.split(",").filter(Boolean) : [];
}

export function parseJobSort(v: string | null): JobSort {
  if (!v) return DEFAULT_JOB_SORT;
  const [key, dir] = v.split(".");
  if (!JOB_SORT_KEYS.includes(key as JobSortKey)) return DEFAULT_JOB_SORT;
  return { key: key as JobSortKey, desc: dir !== "asc" };
}

export function serializeJobSort(sort: JobSort): string | undefined {
  if (sort.key === DEFAULT_JOB_SORT.key && sort.desc === DEFAULT_JOB_SORT.desc)
    return undefined;
  return `${sort.key}.${sort.desc ? "desc" : "asc"}`;
}

/** Adresi okur; tanınmayan her değer VARSAYILANA düşer, asla fırlatmaz. */
export function readJobsViewState(params: ParamsLike): JobsViewState {
  const view = params.get("view");
  const yil = params.get("yil");
  const grup = params.get("grup");
  const ay = params.get("ay");
  return {
    view: JOB_VIEWS.includes(view as JobView) ? (view as JobView) : "tablo",
    yil: yil === "tumu" || YEAR_RE.test(yil ?? "") ? (yil as string) : undefined,
    musteri: parseList(params.get("musteri")),
    durum: parseList(params.get("durum")),
    q: params.get("q") ?? "",
    sirala: parseJobSort(params.get("sirala")),
    grup: JOB_GROUPS.includes(grup as JobGroup) ? (grup as JobGroup) : "durum",
    ay: MONTH_RE.test(ay ?? "") ? (ay as string) : undefined,
  };
}

/**
 * Durumu `adreseYaz` sözleşmesine çevirir: varsayılan değer `undefined`dır ve
 * adresten SİLİNİR — adres yalnız varsayılandan sapanı taşır.
 */
export function writeJobsViewState(
  state: JobsViewState
): Record<string, string | undefined> {
  return {
    view: state.view === "tablo" ? undefined : state.view,
    yil: state.yil,
    musteri: state.musteri.length ? state.musteri.join(",") : undefined,
    durum: state.durum.length ? state.durum.join(",") : undefined,
    q: state.q.trim() ? state.q : undefined,
    sirala: serializeJobSort(state.sirala),
    grup: state.grup === "durum" ? undefined : state.grup,
    ay: state.ay,
  };
}

/**
 * Yıl süzgecinin veriye göre çözülmüş hâli: seçim varsa o; yoksa içinde
 * bulunulan yıl — o yıl defterde hiç yoksa "tumu" (boş liste göstermemek için).
 */
export function resolveYear(
  yil: string | undefined,
  years: readonly string[],
  thisYear: string
): string {
  if (yil) return yil;
  return years.includes(thisYear) ? thisYear : "tumu";
}

// ─────────────────────────────────────────────── kayıtlı görünüm sözleşmesi

/**
 * Kayıtlı görünümün `config` gövdesi (v1). `ay` bilinçli olarak DIŞARIDADIR:
 * "Ağustos 2026" bir tercih değil bir andır; kayıtlı görünüm hep bugünün
 * ayında açılmalıdır.
 */
export const savedViewConfigSchema = z.object({
  v: z.literal(1),
  view: z.enum(JOB_VIEWS).default("tablo"),
  yil: z
    .string()
    .regex(/^(tumu|\d{4})$/)
    .optional(),
  musteri: z.array(z.string()).default([]),
  durum: z.array(z.string()).default([]),
  q: z.string().default(""),
  sirala: z
    .object({ key: z.enum(JOB_SORT_KEYS), desc: z.boolean() })
    .default(DEFAULT_JOB_SORT),
  grup: z.enum(JOB_GROUPS).default("durum"),
});

export type SavedViewConfig = z.infer<typeof savedViewConfigSchema>;

export function stateToConfig(state: JobsViewState): SavedViewConfig {
  return {
    v: 1,
    view: state.view,
    yil: state.yil,
    musteri: state.musteri,
    durum: state.durum,
    q: state.q,
    sirala: state.sirala,
    grup: state.grup,
  };
}

/** Kayıtlı `config`i duruma çevirir; şemadan geçmeyen kayıt `null` döner. */
export function configToState(raw: unknown): JobsViewState | null {
  const parsed = savedViewConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    view: c.view,
    yil: c.yil,
    musteri: c.musteri,
    durum: c.durum,
    q: c.q,
    sirala: c.sirala,
    grup: c.grup,
    ay: undefined,
  };
}
