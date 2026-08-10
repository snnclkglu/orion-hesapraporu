"use client";

// DOSYA EKLE — var olan pakete, klasörü yeniden yüklemeden.
//
// İhtiyaç gerçek: ressam sonradan tek bir resim çiziyor ya da bir resmin yeni
// sürümünü veriyor. Bugüne kadar tek yol BÜTÜN KLASÖRÜ yeniden yüklemekti
// (200 MB) ve o da ikinci bir paket açıyordu — hangisinin geçerli olduğunu
// hiçbir şey söylemiyordu.
//
// "Tek dosya" adı bir KOLAYLIKTIR: çoklu seçime de izin verilir, üç DXF birden
// atmak da aynı akıştır.
//
// AYNI YOL ZATEN VARSA BU BİR HATA DEĞİL YENİ SÜRÜMDÜR. `(package_id,
// rel_path)` tekil olduğu için çakışma kesin yakalanır; kullanıcı "eskisinin
// yerine geçsin" derse eski satır ressamın kendi sözlüğüyle (`İPTAL/`)
// arşivlenir ve BAYTLARI KALIR.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { parseFile } from "@/lib/drawings/file-name";
import { suggestFolder } from "@/lib/drawings/folder-name";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { contentTypeFor } from "@/lib/drawings/mime";
import { addPackageFiles, finalizeUpload, reconcilePackage, verifyStorage } from "../actions";

const BUCKET = "drawings";

export interface PackageFolderInfo {
  folder: string;
  role: string;
}

interface Aday {
  file: File;
  /** Önerilen ya da kullanıcının düzelttiği hedef klasör ("" = kök). */
  klasor: string;
  /** Bu yol pakette zaten var mı? */
  cakisma: boolean;
}

export function AddFilesButton({
  packageId,
  folders,
  mevcutYollar,
  /** Kapanabilecek "resimsiz parça" bulgusu sayısı — kazanç görünür olsun. */
  resimsizParca,
}: {
  packageId: string;
  folders: PackageFolderInfo[];
  mevcutYollar: string[];
  resimsizParca: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [acik, setAcik] = useState(false);
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [cakismaKarari, setCakismaKarari] = useState<"yeniSurum" | "vazgec">("yeniSurum");
  const [calisiyor, setCalisiyor] = useState(false);

  const varOlanYollar = useMemo(() => new Set(mevcutYollar), [mevcutYollar]);
  const klasorSecenekleri = useMemo(
    () => [...new Set(folders.map((f) => f.folder))].sort((a, b) => a.localeCompare(b, "tr")),
    [folders]
  );

  function yolOf(a: Aday): string {
    const ad = a.file.name.normalize("NFC");
    return a.klasor ? `${a.klasor}/${ad}` : ad;
  }

  function dosyalariAl(secilenler: File[]) {
    if (secilenler.length === 0) return;
    const yeni = secilenler.map((file) => {
      // ÖNERİ AYNI TANIYICILARDAN GELİR. Dosya adı zaten malzemeyi ve
      // kalınlığı söylüyor; hedef klasörü sormak, sistemin bildiği bir şeyi
      // kullanıcıya sordurmak olurdu.
      const cozulmus = parseFile({ relPath: file.name, size: file.size });
      const klasor = suggestFolder(cozulmus, folders);
      const yol = klasor ? `${klasor}/${file.name.normalize("NFC")}` : file.name.normalize("NFC");
      return { file, klasor, cakisma: varOlanYollar.has(yol) };
    });
    setAdaylar((s) => [...s, ...yeni]);
  }

  function klasoruDegistir(i: number, klasor: string) {
    setAdaylar((s) =>
      s.map((a, j) => {
        if (j !== i) return a;
        const ad = a.file.name.normalize("NFC");
        const yol = klasor ? `${klasor}/${ad}` : ad;
        return { ...a, klasor, cakisma: varOlanYollar.has(yol) };
      })
    );
  }

  const cakisanlar = adaylar.filter((a) => a.cakisma);
  const engelli = cakisanlar.length > 0 && cakismaKarari === "vazgec";

  async function ekle() {
    if (adaylar.length === 0) return;
    setCalisiyor(true);
    try {
      const cevap = await addPackageFiles({
        packageId,
        files: adaylar.map((a) => ({ relPath: yolOf(a), size: a.file.size, checksum: "" })),
        onConflict: cakisanlar.length > 0 ? "yeniSurum" : "hata",
      });
      if (cevap.error || !cevap.uploads) {
        toast.error(cevap.error ?? "Dosya kayıtları yazılamadı.", {
          duration: Infinity,
          closeButton: true,
        });
        return;
      }

      const dosyaIle = new Map(adaylar.map((a) => [yolOf(a), a.file]));
      const basarili: string[] = [];
      const dusen: { fileId: string; message: string }[] = [];
      const supabase = createClient();

      for (const u of cevap.uploads) {
        const f = dosyaIle.get(u.relPath);
        if (!f || u.skip) continue;
        const mime = contentTypeFor(f.name, f.type);
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(u.storagePath, f.slice(0, f.size, mime), { upsert: true, contentType: mime });
        if (error) dusen.push({ fileId: u.fileId, message: error.message });
        else basarili.push(u.fileId);
      }

      const kapanis = await finalizeUpload({ packageId, storedFileIds: basarili, failed: dusen });
      if (kapanis.error) toast.error(kapanis.error, { duration: Infinity, closeButton: true });

      await verifyStorage({ packageId });

      // EŞLEŞTİRME UCUZDUR (saniyenin altında) ve depoya hiç dokunmaz; eklenen
      // dosyanın deftere oturması için tam yeri burasıdır.
      const es = await reconcilePackage({ packageId });
      if (es.error) {
        toast.error(es.error, { duration: Infinity, closeButton: true });
        return;
      }

      if (dusen.length > 0) {
        toast.error(
          `${formatNum(dusen.length)} dosya depoya ulaşmadı: ${dusen[0].message}`,
          { duration: Infinity, closeButton: true }
        );
      } else {
        // KAZANÇ GÖRÜNÜR OLSUN. Modülün amacı kusuru bulmak değil,
        // kapatılmasını kolaylaştırmaktır.
        toast.success(
          `${formatNum(basarili.length)} dosya eklendi — defter yenilendi, tanıma %${es.recognitionPct ?? 0}.`
        );
      }
      setAcik(false);
      setAdaylar([]);
      router.refresh();
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setAdaylar([]);
          setCakismaKarari("yeniSurum");
          setAcik(true);
        }}
      >
        <FilePlus2 className="size-3.5" />
        Dosya Ekle
      </Button>

      {acik && (
        <Dialog open onOpenChange={(o) => !o && !calisiyor && setAcik(false)}>
          <DialogContent className="sm:max-w-[min(42rem,calc(100%-2rem))]">
            <DialogHeader>
              <DialogTitle>Pakete Dosya Ekle</DialogTitle>
              <DialogDescription>
                Yeni bir paket AÇILMAZ. Hedef klasör dosya adından tahmin edilir; yanlışsa
                değiştirebilirsiniz — liste yalnız bu pakette VAR OLAN klasörleri gösterir.
                {resimsizParca > 0 && (
                  <> Bu pakette {formatNum(resimsizParca)} parça resimsiz görünüyor.</>
                )}
              </DialogDescription>
            </DialogHeader>

            <label className="flex min-h-14 cursor-pointer flex-wrap items-center gap-2 border border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
              <FilePlus2 className="size-4 shrink-0" />
              <span>Dosya seçmek için tıklayın (çoklu seçim yapılabilir)</span>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                disabled={calisiyor}
                onChange={(e) => {
                  const secilenler = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  dosyalariAl(secilenler);
                }}
              />
            </label>

            {adaylar.length > 0 && (
              <ul className="max-h-72 divide-y overflow-y-auto border">
                {adaylar.map((a, i) => (
                  <li key={`${a.file.name}-${i}`} className="grid gap-1.5 px-3 py-2">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
                        {a.file.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatBytes(a.file.size)}
                      </span>
                      {a.cakisma && (
                        <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                          bu yol zaten var
                        </span>
                      )}
                    </span>
                    <span className="grid gap-1 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-2">
                      <Label
                        htmlFor={`klasor-${i}`}
                        className="text-[11px] text-muted-foreground"
                      >
                        Hedef klasör
                      </Label>
                      <select
                        id={`klasor-${i}`}
                        value={a.klasor}
                        onChange={(e) => klasoruDegistir(i, e.target.value)}
                        disabled={calisiyor}
                        className="min-h-9 w-full border bg-background px-2 font-mono text-base pointer-fine:text-xs"
                      >
                        <option value="">(kök)</option>
                        {klasorSecenekleri.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground/70">
                      → {yolOf(a)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {cakisanlar.length > 0 && (
              <div className="border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-[12px]">
                  {formatNum(cakisanlar.length)} dosyanın yolu pakette zaten var. Bu bir hata
                  değil, büyük olasılıkla <strong>yeni bir sürüm</strong>.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={cakismaKarari === "yeniSurum" ? "default" : "outline"}
                    onClick={() => setCakismaKarari("yeniSurum")}
                  >
                    Eskisinin yerine geçsin
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={cakismaKarari === "vazgec" ? "default" : "outline"}
                    onClick={() => setCakismaKarari("vazgec")}
                  >
                    Vazgeç
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {cakismaKarari === "yeniSurum"
                    ? "Eski satır İPTAL klasörüne taşınıp süperse edilir — BAYTLARI SİLİNMEZ, gezginde “Süperse · kopya · hariç” katında durur."
                    : "Çakışan dosyalar için önce hedef klasörü değiştirin ya da seçimden çıkarın."}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={calisiyor}
                onClick={() => setAcik(false)}
              >
                Vazgeç
              </Button>
              <Button
                type="button"
                disabled={calisiyor || adaylar.length === 0 || engelli}
                onClick={() => void ekle()}
              >
                {calisiyor && <Loader2 className="size-4 animate-spin" />}
                {calisiyor ? "Ekleniyor…" : `Ekle (${formatNum(adaylar.length)})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
