// FEM 1.001 referans katsayı tabloları — hesap girdilerindeki katsayıların
// yanındaki "FEM" düğmesiyle açılan pop-up bu verileri gösterir; girilen değere
// karşılık gelen sütun vurgulanır. Değerler FEM 1.001 3rd Edition'dan birebir.

export interface FemTableColumn {
  header: string; // sınıf etiketi (A6, M6...)
  value: string;  // katsayı değeri (tr biçimi, alandaki değerle eşleşir)
}

export interface FemTable {
  code: string;         // "FEM 1.001 T.2.3.4"
  title: string;
  columnHeader: string; // sütun başlığı ("Vinç grubu")
  rowLabel: string;     // satır etiketi ("γC")
  columns: FemTableColumn[];
  note?: string;
}

export const FEM_TABLES: Record<string, FemTable> = {
  // Table T.2.3.4 — Amplifying coefficient γC (appliance group A1–A8)
  gammaC: {
    code: "FEM 1.001 T.2.3.4",
    title: "Yük arttırma katsayısı γC",
    columnHeader: "Vinç grubu",
    rowLabel: "γC",
    columns: [
      { header: "A1", value: "1,00" }, { header: "A2", value: "1,02" },
      { header: "A3", value: "1,05" }, { header: "A4", value: "1,08" },
      { header: "A5", value: "1,11" }, { header: "A6", value: "1,14" },
      { header: "A7", value: "1,17" }, { header: "A8", value: "1,20" },
    ],
    note:
      "γC, vincin grup sınıflandırmasına (A1–A8) bağlıdır. Yükleme durumu I/II/III'te " +
      "tüm yükler γC·(SG + ψ·SL + SH) biçiminde bu katsayıyla çarpılır (FEM 1.001 §2.3).",
  },
  // Table T.2.6 — Amplifying coefficient γm (mechanism group M1–M8)
  gammaM: {
    code: "FEM 1.001 T.2.6",
    title: "Mekanizma arttırma katsayısı γm",
    columnHeader: "Mekanizma grubu",
    rowLabel: "γm",
    columns: [
      { header: "M1", value: "1,00" }, { header: "M2", value: "1,04" },
      { header: "M3", value: "1,08" }, { header: "M4", value: "1,12" },
      { header: "M5", value: "1,16" }, { header: "M6", value: "1,20" },
      { header: "M7", value: "1,25" }, { header: "M8", value: "1,30" },
    ],
    note:
      "γm, mekanizmanın grup sınıflandırmasına (M1–M8) bağlıdır (FEM 1.001 §2.6, T.2.6).",
  },
  // 2.2.2.1.1 — Dynamic coefficient ψ = 1 + ξ·VL (bilgi kartı; sürekli formül)
  psi: {
    code: "FEM 1.001 §2.2.2.1.1",
    title: "Dinamik katsayı ψ = 1 + ξ·V_L",
    columnHeader: "Vinç tipi",
    rowLabel: "ξ",
    columns: [
      { header: "Köprü/gezer vinç", value: "0,6" },
      { header: "Pergel (jib) vinç", value: "0,3" },
    ],
    note:
      "ψ = 1 + ξ·V_L (V_L: kaldırma hızı m/s). ξ köprü/gezer vinçlerde 0,6; pergel " +
      "vinçlerde 0,3. ψ hiçbir durumda 1,15'ten küçük alınmaz (FEM 1.001 §2.2.2.1.1).",
  },
};

/** Değere (sayısal) en yakın sütunu bulur — pop-up vurgusu için. */
export function activeFemColumn(table: FemTable, value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return -1;
  let best = -1;
  let bestDiff = Infinity;
  table.columns.forEach((c, i) => {
    const v = parseFloat(c.value.replace(",", "."));
    const d = Math.abs(v - value);
    if (d < bestDiff && d < 0.005) { bestDiff = d; best = i; }
  });
  return best;
}

/** Sütun başlığına göre eşleşen sütunu bulur (ör. "M6", "A6"). */
export function femColumnByHeader(table: FemTable, header: string | undefined): number {
  if (!header) return -1;
  return table.columns.findIndex((c) => c.header === header.trim());
}
