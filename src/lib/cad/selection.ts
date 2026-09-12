import { MAX_SOURCE_BYTES, safeCadName } from "./contracts";
export const MAX_CAD_SELECTION = 30;
interface SourceFile { name: string; size: number; webkitRelativePath?: string }
export function selectCadFiles<T extends SourceFile>(files: readonly T[]): { files: T[]; ignored: number } {
  const drawings = files.filter(file => /\.dwg$/i.test(file.name));
  if (!drawings.length) throw new Error("Seçimde DWG bulunamadı. Bir DWG dosyası veya DWG içeren klasör seçin.");
  if (drawings.length > MAX_CAD_SELECTION) throw new Error("Bir defada en fazla 30 DWG seçebilirsiniz. Daha küçük bir klasör veya dosya grubu seçin.");
  for (const file of drawings) {
    if (!safeCadName(file.name)) throw new Error(`${file.name}: dosya adı desteklenmiyor.`);
    if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name}: dosya boş veya 100 MB sınırından büyük.`);
  }
  // Aynı adlı dosyalar farklı alt klasörlere ait olabilir; adla tekilleştirilmez.
  return { files: drawings, ignored: files.length - drawings.length };
}
