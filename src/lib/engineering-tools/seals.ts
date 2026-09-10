import seals from "@/data/engineering-tools/suptex-seals.json";

export interface SealRow { code: string; shaftDiameter: string; housingDiameter: string; height: string; type: string; material: string; msa: string; }
export const SUPTEX_SEALS = seals as SealRow[];

const trFold = (value: string) => value.toLocaleLowerCase("tr-TR").replaceAll(",", ".");
export function searchSeals(query: string, material: string, limit = 80): SealRow[] {
  const folded = trFold(query.trim());
  return SUPTEX_SEALS.filter((row) => {
    if (material && row.material !== material) return false;
    if (!folded) return true;
    return [row.code, row.shaftDiameter, row.housingDiameter, row.height, row.type, row.material, row.msa].some((value) => trFold(value).includes(folded));
  }).slice(0, limit);
}

export const SEAL_MATERIALS = [...new Set(SUPTEX_SEALS.map((row) => row.material).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
