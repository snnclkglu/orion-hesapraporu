export interface AxleHolderRow { fromExclusiveMm: number; toInclusiveMm: number; aMm: number; bMm: number; c1Mm: number; c2Mm: number; holeMm: number; hMm: number; bolt: string; fineBolt: string; massKg: number; }
export const AXLE_HOLDERS: readonly AxleHolderRow[] = [
  { fromExclusiveMm:16,toInclusiveMm:25,aMm:20,bMm:5,c1Mm:60,c2Mm:36,holeMm:9,hMm:10,bolt:"M8",fineBolt:"M8×1",massKg:.042 },
  { fromExclusiveMm:25,toInclusiveMm:40,aMm:25,bMm:6,c1Mm:80,c2Mm:50,holeMm:11,hMm:12,bolt:"M10",fineBolt:"M10×1",massKg:.085 },
  { fromExclusiveMm:40,toInclusiveMm:63,aMm:30,bMm:8,c1Mm:100,c2Mm:70,holeMm:13,hMm:16,bolt:"M12",fineBolt:"M12×1,5",massKg:.19 },
  { fromExclusiveMm:63,toInclusiveMm:100,aMm:40,bMm:10,c1Mm:140,c2Mm:100,holeMm:17,hMm:20,bolt:"M16",fineBolt:"M16×1,5",massKg:.4 },
  { fromExclusiveMm:100,toInclusiveMm:160,aMm:50,bMm:12,c1Mm:190,c2Mm:140,holeMm:21,hMm:25,bolt:"M20",fineBolt:"M20×1,5",massKg:.9 },
  { fromExclusiveMm:160,toInclusiveMm:250,aMm:60,bMm:16,c1Mm:250,c2Mm:200,holeMm:25,hMm:32,bolt:"M24",fineBolt:"M24×1,5",massKg:1.75 },
];
export function findAxleHolder(diameterMm: number) { return AXLE_HOLDERS.find((row)=>diameterMm>row.fromExclusiveMm&&diameterMm<=row.toInclusiveMm) ?? null; }
