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
//
// ————————————————————————————————— LİSTE BİR YIĞIN DEĞİL, YOL KÜMESİDİR
//
// Pencerenin ilk sürümü aday listesini yalnız BÜYÜYEN bir yığın olarak
// görüyordu ve üç kusuru vardı; üçü de aynı kökten geliyordu — listenin
// kimliği YOKTU, dolayısıyla tek bir satır hakkında hiçbir şey söylenemiyordu:
//
//   1. Satır çıkarılamıyordu. 15 DXF seçip birinin yanlış olduğunu fark eden
//      ressamın tek çıkışı pencereyi kapatmaktı; o da doğru seçilmiş 14
//      dosyayı siliyordu. Üstelik pencerenin kendi uyarı metni "seçimden
//      çıkarın" diyor, kullanıcı olmayan bir düğmeyi arıyordu.
//   2. Yeniden seçmek satırı DEĞİŞTİRMİYOR, KOPYA ekliyordu. Aynı hedef yolu
//      üreten iki aday sunucuya kadar gidiyor ve kullanıcı sebebini ancak
//      Ekle'ye bastıktan SONRA öğreniyordu.
//   3. Çakışma kararı BÜTÜN ÖBEĞE veriliyordu: tek dosya çakışsa bile karar
//      hepsini bağlıyor, "Vazgeç" seçilince Ekle düğmesi tamamen kilitleniyordu
//      — kullanıcı ya hepsini süperse etmeyi kabul ediyor ya hiç ekleyemiyordu.
//
// Bugün liste bir YOL KÜMESİDİR: her satırın kalıcı bir kimliği, kendi çıkarma
// düğmesi ve çakışıyorsa KENDİ kararı vardır. Sunucuya yalnız gerçekten
// eklenecek satırlar gider.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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
  /**
   * Satırın kalıcı kimliği — dizin DEĞİL.
   *
   * Aradan satır çıkarılabildiği için dizin artık kimlik olamaz: React
   * anahtarı olarak kullanılsa çıkarılan satırın altındakilerin tamamı yeniden
   * eşlenir ve odak/kaydırma yerinden oynar. Sayaç yalnız bu pencere yaşarken
   * artar; kalıcı bir yerde saklanmadığı için benzersizliği oturum içinde
   * yeter.
   */
  id: number;
  file: File;
  /** Önerilen ya da kullanıcının düzelttiği hedef klasör ("" = kök). */
  klasor: string;
  /** Bu yol pakette zaten var mı? */
  cakisma: boolean;
  /**
   * Çakışan satırın kendi kararı.
   *
   * `yeniSurum` — eski satır İPTAL'e taşınıp süperse edilir (varsayılan; bu
   *   dosyanın açılış varsayımı "aynı yol = yeni sürüm"dür).
   * `vazgec` — bu satır SUNUCUYA HİÇ GİTMEZ. Listede kalır, çünkü karar tek
   *   tıkla geri alınabilmelidir; satırı anında silmek, düzeltilmek istenen
   *   "yanlış tık duvara çarpıyor" davranışının ta kendisiydi.
   *
   * Çakışmayan satırda bu alan OKUNMAZ (bkz. `gonderilecek`): kullanıcı
   * hedef klasörü değiştirip çakışmayı kaldırdığında satır kendiliğinden geri
   * gelir, ama çakışma geri gelirse eski "ekleme" kararı da geri gelir —
   * kararı sessizce süperse yönüne çevirmek en tehlikeli yön olurdu.
   */
  karar: "yeniSurum" | "vazgec";
}

/** Adayın üreteceği hedef yol. Saf — satırdan başka hiçbir şeye bakmaz. */
function yolOf(a: Aday): string {
  const ad = a.file.name.normalize("NFC");
  return a.klasor ? `${a.klasor}/${ad}` : ad;
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
  const [acik, setAcik] = useState(false);
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [sonrakiId, setSonrakiId] = useState(1);
  const [calisiyor, setCalisiyor] = useState(false);

  const varOlanYollar = useMemo(() => new Set(mevcutYollar), [mevcutYollar]);
  const klasorSecenekleri = useMemo(
    () => [...new Set(folders.map((f) => f.folder))].sort((a, b) => a.localeCompare(b, "tr")),
    [folders]
  );

  // AYNI YOLU ÜRETEN İKİNCİ ADAY LİSTEYE ALINMAZ.
  //
  // İki seçenek vardı: (a) almamak, (b) alıp "bu seçimde zaten var" diye
  // işaretleyip Ekle'yi engellemek. Seçim ALMAMAK yönünde, çünkü bu anda iki
  // satır BİRBİRİNİN AYNIDIR — aynı dosya adı aynı öneriye düşer, yani ikinci
  // satır sıfır bilgi taşır ve kullanıcının yapabileceği tek şey onu geri
  // silmektir. Kendi kendine düzelmesi mümkün olmayan bir satırı listeye
  // koyup sonra Ekle'yi kilitlemek, düzeltmeye çalıştığımız hastalığın
  // kendisidir.
  //
  // Reddedilen dosya SESSİZCE düşmez: adıyla söylenir. "Atlanan ≠ eksik"
  // kuralı burada da geçerli — kullanıcı 15 seçip 13 satır gördüğünde sebebini
  // aramak zorunda kalmamalıdır.
  //
  // Bu aynı zamanda 2. kusuru kökten kapatır: aynı dosyayı yeniden seçmek
  // artık KOPYA üretmez, hiçbir şey olmaz.
  //
  // Kullanıcının hedef klasörü ELLE değiştirerek ürettiği çakışma ayrı bir
  // durumdur ve orada reddetmek anlamsızdır (geri sıçrayan bir açılır kutu
  // kimseye bir şey anlatmaz); o durum satırda işaretlenir, aşağıya bakınız.
  function dosyalariAl(secilenler: File[]) {
    if (secilenler.length === 0) return;
    const yollar = new Set(adaylar.map(yolOf));
    const yeni: Aday[] = [];
    const yinelenen: string[] = [];
    let id = sonrakiId;

    for (const file of secilenler) {
      // ÖNERİ AYNI TANIYICILARDAN GELİR. Dosya adı zaten malzemeyi ve
      // kalınlığı söylüyor; hedef klasörü sormak, sistemin bildiği bir şeyi
      // kullanıcıya sordurmak olurdu.
      const cozulmus = parseFile({ relPath: file.name, size: file.size });
      const klasor = suggestFolder(cozulmus, folders);
      const yol = klasor ? `${klasor}/${file.name.normalize("NFC")}` : file.name.normalize("NFC");
      if (yollar.has(yol)) {
        yinelenen.push(yol);
        continue;
      }
      yollar.add(yol);
      yeni.push({ id: id++, file, klasor, cakisma: varOlanYollar.has(yol), karar: "yeniSurum" });
    }

    if (yeni.length > 0) {
      setAdaylar((s) => [...s, ...yeni]);
      setSonrakiId(id);
    }
    if (yinelenen.length > 0) {
      toast.info(
        yinelenen.length === 1
          ? `Bu hedef yol listede zaten var, ikinci kez eklenmedi: ${yinelenen[0]}`
          : `${formatNum(yinelenen.length)} dosya listeye alınmadı — hedef yolları listede zaten var (ör. ${yinelenen[0]}).`
      );
    }
  }

  function klasoruDegistir(id: number, klasor: string) {
    setAdaylar((s) =>
      s.map((a) => {
        if (a.id !== id) return a;
        const ad = a.file.name.normalize("NFC");
        const yol = klasor ? `${klasor}/${ad}` : ad;
        return { ...a, klasor, cakisma: varOlanYollar.has(yol) };
      })
    );
  }

  function kararVer(id: number, karar: Aday["karar"]) {
    setAdaylar((s) => s.map((a) => (a.id === id ? { ...a, karar } : a)));
  }

  function adayiCikar(id: number) {
    setAdaylar((s) => s.filter((a) => a.id !== id));
  }

  const cakisanlar = adaylar.filter((a) => a.cakisma);

  /** SUNUCUYA GERÇEKTEN GİDECEK satırlar — "ekleme" denen çakışmalar düşer. */
  const gonderilecek = useMemo(
    () => adaylar.filter((a) => !(a.cakisma && a.karar === "vazgec")),
    [adaylar]
  );
  const dusurulen = adaylar.length - gonderilecek.length;

  // ELLE ÜRETİLMİŞ YOL ÇAKIŞMASI. Seçim anında engellenemeyen tek durum:
  // kullanıcı iki satırın hedef klasörünü aynı yola getirmiş. Sayım yalnız
  // GÖNDERİLECEK satırlar üzerinden yapılır — gönderilmeyen bir satırın
  // yolu sunucuda hiçbir şeye çarpmaz, onu da saymak yanlış alarm olurdu.
  const yinelenenYollar = useMemo(() => {
    const sayim = new Map<string, number>();
    for (const a of gonderilecek) {
      const yol = yolOf(a);
      sayim.set(yol, (sayim.get(yol) ?? 0) + 1);
    }
    return new Set([...sayim].filter(([, n]) => n > 1).map(([yol]) => yol));
  }, [gonderilecek]);

  const engelli = yinelenenYollar.size > 0;

  async function ekle() {
    if (gonderilecek.length === 0 || engelli) return;
    setCalisiyor(true);
    try {
      const cevap = await addPackageFiles({
        packageId,
        files: gonderilecek.map((a) => ({ relPath: yolOf(a), size: a.file.size, checksum: "" })),
        // SUNUCU SÖZLEŞMESİ ÖBEK DÜZEYİNDEDİR, karar ise satır düzeyinde.
        // İkisi şöyle uzlaşır: "ekleme" denen satırlar listeden düştüğü için
        // sunucunun çakışma dalına yalnız kullanıcının AÇIKÇA "yerine geçsin"
        // dediği satırlar girebilir.
        //
        // Hiç çakışma görünmüyorsa bilinçli olarak `hata` gönderilir:
        // `mevcutYollar` sayfa basıldığı andaki fotoğraftır ve bu arada başka
        // biri aynı yolu yazmış olabilir. `yeniSurum` göndermek o resmi
        // sessizce İPTAL'e taşırdı; `hata` ise kullanıcıyı durdurur.
        onConflict: gonderilecek.some((a) => a.cakisma) ? "yeniSurum" : "hata",
      });
      if (cevap.error || !cevap.uploads) {
        toast.error(cevap.error ?? "Dosya kayıtları yazılamadı.", {
          duration: Infinity,
          closeButton: true,
        });
        return;
      }

      const dosyaIle = new Map(gonderilecek.map((a) => [yolOf(a), a.file]));
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
        // kapatılmasını kolaylaştırmaktır. Kullanıcının eklememeyi seçtiği
        // dosyalar da ayrıca sayılır: karar onun olsa bile sonuç sessiz
        // kalmamalıdır.
        toast.success(
          `${formatNum(basarili.length)} dosya eklendi — defter yenilendi, tanıma %${es.recognitionPct ?? 0}.` +
            (dusurulen > 0 ? ` ${formatNum(dusurulen)} dosya isteğinizle eklenmedi.` : "")
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

            {/* BOŞ LİSTE KENDİNİ SÖYLER. Hem hiç seçilmemiş hem "hepsi
                çıkarıldı" hâli buraya düşer; ikisini ayırmak için ayrı bir
                durum tutmaya değmez, çünkü kullanıcıya söylenecek şey aynı. */}
            {adaylar.length === 0 && (
              <p className="border border-dashed px-3 py-4 text-center text-[12px] text-muted-foreground">
                Listede dosya yok. Yukarıdan bir ya da daha çok dosya seçin.
              </p>
            )}

            {cakisanlar.length > 0 && (
              <div className="border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-[12px]">
                  {formatNum(cakisanlar.length)} dosyanın yolu pakette zaten var. Bu bir hata
                  değil, büyük olasılıkla <strong>yeni bir sürüm</strong> — kararı{" "}
                  <strong>her satır kendi verir</strong>.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  “Eskisinin yerine geçsin” eski satırı İPTAL klasörüne taşıyıp süperse eder —
                  BAYTLARI SİLİNMEZ, gezginde “Süperse · kopya · hariç” katında durur. “Bu
                  dosyayı ekleme” yalnız o satırı gönderimden düşürür; hedef klasörü
                  değiştirmek de çakışmayı kaldırır.
                </p>
              </div>
            )}

            {adaylar.length > 0 && (
              <ul className="max-h-72 divide-y overflow-y-auto border">
                {adaylar.map((a) => {
                  const yol = yolOf(a);
                  const gonderilir = !(a.cakisma && a.karar === "vazgec");
                  const yinelendi = gonderilir && yinelenenYollar.has(yol);
                  return (
                    <li
                      key={a.id}
                      className={cn("grid gap-1.5 px-3 py-2", !gonderilir && "opacity-60")}
                    >
                      {/* Ad küçülür, boyut ve ÇIKAR küçülmez: 375px'te taşan
                          şey her zaman en uzun olan dosya adıdır. */}
                      <span className="flex items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate font-mono text-[12px]"
                          title={a.file.name}
                        >
                          {a.file.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {formatBytes(a.file.size)}
                        </span>
                        {/* Dokunma payı `.oc-tap-square`tan gelir (Button
                            `icon-sm` varyantı taşır) — kutu 32px kalır,
                            parmağın bulduğu alan 44px olur. */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="-my-1 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={calisiyor}
                          aria-label={`${a.file.name} dosyasını seçimden çıkar`}
                          title="Seçimden çıkar"
                          onClick={() => adayiCikar(a.id)}
                        >
                          <X />
                        </Button>
                      </span>

                      {(a.cakisma || yinelendi || !gonderilir) && (
                        <span className="flex flex-wrap gap-1.5">
                          {a.cakisma && (
                            <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
                              bu yol pakette zaten var
                            </span>
                          )}
                          {yinelendi && (
                            <span className="border border-destructive/40 bg-destructive/10 px-1.5 font-mono text-[11px] text-destructive">
                              bu seçimde zaten var
                            </span>
                          )}
                          {!gonderilir && (
                            <span className="border px-1.5 font-mono text-[11px] text-muted-foreground">
                              eklenmeyecek
                            </span>
                          )}
                        </span>
                      )}

                      <span className="grid gap-1 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-2">
                        <Label
                          htmlFor={`klasor-${a.id}`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Hedef klasör
                        </Label>
                        <select
                          id={`klasor-${a.id}`}
                          value={a.klasor}
                          onChange={(e) => klasoruDegistir(a.id, e.target.value)}
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

                      <span
                        className={cn(
                          "truncate font-mono text-[11px] text-muted-foreground/70",
                          !gonderilir && "line-through"
                        )}
                      >
                        → {yol}
                      </span>

                      {/* ÇAKIŞMA KARARI SATIRIN KENDİSİNDE. Tek bir çakışmanın
                          bütün öbeği kilitlemesinin sebebi kararın öbeğe ait
                          olmasıydı; karar satıra inince 14 doğru dosya 1 yanlış
                          dosyayı beklemez. */}
                      {a.cakisma && (
                        <span className="flex flex-wrap gap-1.5 pt-0.5">
                          <Button
                            type="button"
                            size="xs"
                            variant={a.karar === "yeniSurum" ? "default" : "outline"}
                            aria-pressed={a.karar === "yeniSurum"}
                            disabled={calisiyor}
                            onClick={() => kararVer(a.id, "yeniSurum")}
                          >
                            Eskisinin yerine geçsin
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant={a.karar === "vazgec" ? "default" : "outline"}
                            aria-pressed={a.karar === "vazgec"}
                            disabled={calisiyor}
                            onClick={() => kararVer(a.id, "vazgec")}
                          >
                            Bu dosyayı ekleme
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {engelli && (
              <p className="border border-destructive/40 bg-destructive/10 p-3 text-[12px] text-destructive">
                {formatNum(yinelenenYollar.size)} hedef yolu birden çok satır üretiyor. Aynı yol
                tek bir dosyaya aittir: işaretli satırların hedef klasörünü değiştirin ya da
                fazlasını seçimden çıkarın.
              </p>
            )}

            {!engelli && adaylar.length > 0 && gonderilecek.length === 0 && (
              <p className="border border-dashed p-3 text-[12px] text-muted-foreground">
                Listedeki dosyaların tümü “eklenmeyecek” işaretli. En az birinde “Eskisinin
                yerine geçsin” seçin ya da hedef klasörünü değiştirin.
              </p>
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
                disabled={calisiyor || gonderilecek.length === 0 || engelli}
                onClick={() => void ekle()}
              >
                {calisiyor && <Loader2 className="size-4 animate-spin" />}
                {calisiyor ? "Ekleniyor…" : `Ekle (${formatNum(gonderilecek.length)})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
