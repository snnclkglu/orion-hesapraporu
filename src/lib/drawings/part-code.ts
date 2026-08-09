// Parça kodu — teknik resim paketinin BİRİNCİL ANAHTARI.
//
// DXF dosyalarının 34'ünde/35'inde hiçbir metin varlığı yoktur ve her şey
// katman `0`dadır: dosyanın içi parçanın kim olduğunu SÖYLEMEZ. Kimlik yalnız
// dosya adındadır. Bu yüzden kod çözümleme bu modülün en çok güvenilen
// parçasıdır ve saf, testli ve hoşgörülü olmak zorundadır.
//
// Kodun dilbilgisi:
//
//     0057 - 00 - 0500 - 00 - 01 - 03
//     iş     ek   grup   ————— alt düzeyler —————
//     └── kalem no ──┘
//
// Segment sayısı SABİT DEĞİLDİR: iki gerçek pakette 3'ten 6'ya kadar her
// derinlik görüldü (`0057-00-0500` … `0043-00-0802-00-02-06`). Bir üst sınır
// koymak, ressamın bir gün yedinci düzeyi açmasıyla modülü kör ederdi.

/** Kod gövdesi: 4–5 haneli iş no + 2 haneli ek + en az bir alt segment. */
const KOD_TAM = /^(\d{4,5})-(\d{2})((?:-\d+)*)$/;

/** Metnin İÇİNDE kod aramak için (dosya adı serbest metinle karışık olabilir). */
const KOD_ARA = /(\d{4,5}-\d{2}(?:-\d+)+)/;

export interface PartCode {
  /** Normalize edilmiş tam kod: "0057-00-0600-00-01-03" */
  code: string;
  /** İş no, 4 haneye normalize: "0057" */
  job: string;
  /** Kalem eki: "00" */
  suffix: string;
  /** Kalem numarası: "0057-00" */
  itemNo: string;
  /** Kalemden sonraki segmentler: ["0600","00","01","03"] */
  segments: string[];
  /** Kalemden sonraki derinlik. `0057-00` → 0, `0057-00-0500` → 1 */
  level: number;
  /** Ham girdi normalize edilirken düzeltildi mi (ör. beş haneli iş öneki)? */
  normalized: boolean;
}

/**
 * İş numarasını dört haneye getirir.
 *
 * Gerçek bir dosyada `00057-00-0700-02` yazıyordu — 174 dosyanın içinde tek
 * bir fazladan sıfır. Bunu reddetmek o parçayı kesim listesinden düşürürdü;
 * düzeltmek ise tek satır. Ressamın bir kez kaydırdığı parmağı, imalatta
 * eksik parça olmamalı.
 */
function jobNormalize(raw: string): string {
  const kirpik = raw.replace(/^0+(?=\d{4}$)/, "");
  return kirpik.length >= 4 ? kirpik : kirpik.padStart(4, "0");
}

/** Tam bir parça kodunu çözer. Kod değilse `null` — bu bir hata değildir. */
export function parsePartCode(raw: string | null | undefined): PartCode | null {
  if (!raw) return null;
  const m = raw.trim().match(KOD_TAM);
  if (!m) return null;

  const [, jobRaw, suffix, kuyruk] = m;
  const job = jobNormalize(jobRaw);
  const segments = kuyruk ? kuyruk.slice(1).split("-") : [];
  const itemNo = `${job}-${suffix}`;

  return {
    code: segments.length ? `${itemNo}-${segments.join("-")}` : itemNo,
    job,
    suffix,
    itemNo,
    segments,
    level: segments.length,
    normalized: job !== jobRaw,
  };
}

/**
 * Serbest metnin içinde kod arar (dosya adı, klasör adı, Excel dosya adı).
 *
 * En az bir alt segment ŞART koşulur: yoksa `31.07.2026` gibi bir tarih ya da
 * `1.0043` gibi bir revizyon öneki kod sanılırdı. Kalem numarasının kendisi
 * (`0057-00`) bir parça kodu DEĞİLDİR ve burada da bulunmaz.
 */
export function findPartCode(text: string | null | undefined): PartCode | null {
  if (!text) return null;
  const m = text.match(KOD_ARA);
  return m ? parsePartCode(m[1]) : null;
}

/**
 * Üst kodu: son segment atılır.
 *
 * `0057-00-0500` gibi birinci düzey bir kodun üstü kalem numarasıdır, yani
 * paketin KÖKÜdür — parça değildir ve `""` döner. Ağaç kurulurken kökü parça
 * sanmak, defterde var olmayan bir satıra bağlanmak demektir.
 */
export function parentCode(code: string | PartCode | null | undefined): string {
  const p = typeof code === "string" ? parsePartCode(code) : code ?? null;
  if (!p || p.level <= 1) return "";
  return `${p.itemNo}-${p.segments.slice(0, -1).join("-")}`;
}

/** Kökten koda kadar üst zinciri (kökten yaprağa sıralı, kodun kendisi hariç). */
export function ancestorCodes(code: string | PartCode): string[] {
  const p = typeof code === "string" ? parsePartCode(code) : code;
  if (!p) return [];
  const zincir: string[] = [];
  for (let i = 1; i < p.segments.length; i++) {
    zincir.push(`${p.itemNo}-${p.segments.slice(0, i).join("-")}`);
  }
  return zincir;
}

/** Kalem numarası ("0057-00"). Kod çözülemezse `""`. */
export function itemNoOf(code: string | null | undefined): string {
  return parsePartCode(code ?? "")?.itemNo ?? findPartCode(code)?.itemNo ?? "";
}

/** İş kökü ("0057"). `job_items` eşleşmezse `jobs` bu numarayla aranır. */
export function jobRootOf(itemNo: string | null | undefined): string {
  if (!itemNo) return "";
  const bas = itemNo.trim().split("-")[0] ?? "";
  return bas ? jobNormalize(bas) : "";
}

/**
 * Kod sıralaması — segment segment SAYISAL karşılaştırma.
 *
 * Düz metin sıralaması `-10`u `-2`den önce koyar ve parça defteri ressamın
 * numaralandırmasıyla ilgisiz bir sırayla açılır. Ağaçta da liste de aynı
 * karşılaştırmayı kullanır.
 */
export function comparePartCodes(a: string, b: string): number {
  const pa = parsePartCode(a);
  const pb = parsePartCode(b);
  if (!pa || !pb) return a.localeCompare(b, "tr");
  if (pa.itemNo !== pb.itemNo) return pa.itemNo.localeCompare(pb.itemNo, "tr");
  const n = Math.max(pa.segments.length, pb.segments.length);
  for (let i = 0; i < n; i++) {
    const x = pa.segments[i];
    const y = pb.segments[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const d = Number(x) - Number(y);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * ÜRÜN AĞACI Excel'inin "Item" sütunu ("1", "1.2", "6.9.1.1").
 *
 * Bu, Inventor'ın montaj yapısının KENDİSİdir — koddan türetilen ağaçtan daha
 * doğrudur, çünkü kod bir adlandırma geleneği, bu ise modelin gerçeği. İkisi
 * çeliştiğinde ağaç bundan kurulur.
 */
export function parseItemPath(raw: string | null | undefined): number[] | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!/^\d+(\.\d+)*$/.test(s)) return null;
  return s.split(".").map(Number);
}

/** `item_path` üstü: "6.9.1.1" → "6.9.1". Kök ("6") için `""`. */
export function parentItemPath(raw: string | null | undefined): string {
  const yol = parseItemPath(raw);
  if (!yol || yol.length <= 1) return "";
  return yol.slice(0, -1).join(".");
}

/** `item_path` sıralaması — düz metin "1.10"u "1.2"den önce koyardı. */
export function compareItemPaths(a: string, b: string): number {
  const pa = parseItemPath(a) ?? [];
  const pb = parseItemPath(b) ?? [];
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x !== y) return x - y;
  }
  return 0;
}
