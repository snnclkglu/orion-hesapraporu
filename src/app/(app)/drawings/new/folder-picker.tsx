"use client";

// Klasör yükleme sihirbazı.
//
// NEDEN ZIP DEĞİL, DOĞRUDAN KLASÖR:
//   1. 200 MB'lık bir ZIP sunucuya ULAŞAMAZ. Server Action gövdesi 1 MB,
//      route handler gövdesi 4,5 MB. ZIP yolu "depoya at → sunucu 200 MB
//      indirsin → bellekte açsın → 454 nesneyi geri yüklesin" demek.
//   2. ZIP giriş adı kodlaması `İPTAL` için CANLI TEHLİKE: Windows Explorer
//      UTF-8 bayrağını tutarsız kurar, alternatif CP437 U+0130'u temsil
//      edemez. Bu veride `İPTAL` semantik bir işaret; bozulması modeli bozar.
//   3. Bayt gitmeden ÖN İNCELEME gösterilebilir — 454 dosyada bu artık bir
//      zorunluluk, ZIP akışı bunu yapamaz.
//
// AYRIŞTIRMA BURADA YALNIZ GÖSTERİM İÇİNDİR. Sunucuya giden şey yol, boyut ve
// imzadır; kaydı yazan `createPackage` aynı saf işlevleri KENDİSİ çağırır. Tek
// doğruluk kaynağı sunucudur.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseFile } from "@/lib/drawings/file-name";
import { folderCodeFromContents, parseFolderName } from "@/lib/drawings/folder-name";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { createPackage, finalizeUpload, reconcilePackage } from "../actions";

const BUCKET = "drawings";
/** Tarayıcı köken başına ~6 bağlantı verir; 4 metadata yazmalarına pay bırakır. */
const ESZAMANLI = 4;

interface SecilenDosya {
  file: File;
  relPath: string;
  checksum: string;
}

type Asama = "secim" | "imza" | "onizleme" | "yukleme" | "okuma" | "eslestirme";

export function FolderPicker() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [asama, setAsama] = useState<Asama>("secim");
  const [klasorAdi, setKlasorAdi] = useState("");
  const [dosyalar, setDosyalar] = useState<SecilenDosya[]>([]);
  const [kalemNo, setKalemNo] = useState("");
  const [ilerleme, setIlerleme] = useState({ yapilan: 0, toplam: 0, bayt: 0 });
  const [basarisiz, setBasarisiz] = useState<string[]>([]);
  const [durumMetni, setDurumMetni] = useState("");

  // `webkitdirectory` React'in JSX tiplemesinde yok; öznitelik olarak konur.
  // Spread ile `any` kaçırmaktansa ref üzerinden yazmak hem tip güvenli hem
  // de tarayıcı desteği olmayan yerde sessizce düz çoklu seçime düşer.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  const onizleme = useMemo(() => {
    if (dosyalar.length === 0) return null;
    const cozulmus = dosyalar.map((d) => parseFile({ relPath: d.relPath, size: d.file.size }));
    const kullanilir = cozulmus.filter((f) => f.lifecycle !== "haric");
    const rolSayisi = (rol: string) => kullanilir.filter((f) => f.role === rol).length;
    return {
      toplam: cozulmus.length,
      bayt: dosyalar.reduce((t, d) => t + d.file.size, 0),
      model: rolSayisi("model"),
      resim: rolSayisi("resim") + rolSayisi("bukum"),
      kesim: rolSayisi("kesim"),
      bom: rolSayisi("bom"),
      uc: rolSayisi("model3d"),
      haric: cozulmus.length - kullanilir.length,
      taninmayan: kullanilir.filter((f) => !f.recognizedBy).length,
    };
  }, [dosyalar]);

  const klasorTanima = useMemo(() => {
    if (!klasorAdi) return null;
    const dogrudan = parseFolderName(klasorAdi);
    if (dogrudan.value) return { by: dogrudan.by, itemNo: dogrudan.value.itemNo, ad: dogrudan.value.description };
    const icerikten = folderCodeFromContents(dosyalar.map((d) => d.relPath.split("/").pop() ?? ""));
    return icerikten
      ? { by: "klasor.icerikten", itemNo: icerikten.split("-").slice(0, 2).join("-"), ad: klasorAdi }
      : null;
  }, [klasorAdi, dosyalar]);

  async function dosyalariAl(list: FileList | null) {
    if (!list || list.length === 0) return;
    const hepsi = Array.from(list);

    // Kök klasör adı ilk parçadır. `webkitRelativePath` boşsa (iOS Safari)
    // klasör bilgisi hiç yoktur: yükleme YİNE yapılır, yalnız İPTAL/malzeme
    // klasörü gibi yola dayalı ipuçları okunamaz.
    const ilkYol = hepsi[0].webkitRelativePath ?? "";
    const kok = ilkYol.split("/")[0] ?? "";
    if (!ilkYol) {
      toast.warning(
        "Tarayıcı klasör yollarını vermedi. Dosyalar yüklenir ama İPTAL ve malzeme klasörü ipuçları okunamaz."
      );
    }
    setKlasorAdi(kok || "Adsız paket");

    setAsama("imza");
    setIlerleme({ yapilan: 0, toplam: hepsi.length, bayt: 0 });
    const secilen: SecilenDosya[] = [];
    for (let i = 0; i < hepsi.length; i++) {
      const f = hepsi[i];
      const tam = (f.webkitRelativePath || f.name).normalize("NFC");
      const rel = kok && tam.startsWith(`${kok}/`) ? tam.slice(kok.length + 1) : tam;
      secilen.push({ file: f, relPath: rel, checksum: await imzala(f) });
      if (i % 10 === 0 || i === hepsi.length - 1) {
        setIlerleme({ yapilan: i + 1, toplam: hepsi.length, bayt: 0 });
        // Tarayıcı 454 dosyalık döngüde donmasın; her onda bir nefes.
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    setDosyalar(secilen);
    setAsama("onizleme");
  }

  async function yukle() {
    if (dosyalar.length === 0) return;
    setAsama("yukleme");
    setBasarisiz([]);
    setDurumMetni("Paket kaydı açılıyor…");

    const kayit = await createPackage({
      folderName: klasorAdi,
      itemNoOverride: kalemNo.trim(),
      files: dosyalar.map((d) => ({
        relPath: d.relPath,
        size: d.file.size,
        checksum: d.checksum,
      })),
    });
    if (kayit.error || !kayit.packageId || !kayit.uploads) {
      toast.error(kayit.error ?? "Paket kaydı açılamadı.");
      setAsama("onizleme");
      return;
    }

    const packageId = kayit.packageId;
    const yolIle = new Map(kayit.uploads.map((u) => [u.relPath, u.storagePath]));
    const supabase = createClient();

    let gidenBayt = 0;
    let bitti = 0;
    const yuklenen: string[] = [];
    const hatalar: string[] = [];

    setDurumMetni("Dosyalar yükleniyor…");
    setIlerleme({ yapilan: 0, toplam: dosyalar.length, bayt: 0 });

    // Sınırlı eşzamanlılık: sıradan çeken ESZAMANLI adet işçi.
    let sonraki = 0;
    async function isci() {
      for (;;) {
        const i = sonraki++;
        if (i >= dosyalar.length) return;
        const d = dosyalar[i];
        const hedef = yolIle.get(d.relPath);
        if (!hedef) {
          hatalar.push(d.relPath);
          continue;
        }
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(hedef, d.file, { upsert: true, contentType: d.file.type || undefined });
        // BİR DOSYANIN HATASI YÜKLEMEYİ DURDURMAZ: 454 dosyalık bir paketi
        // ortasından kesmek, kullanıcıyı baştan başlamaya zorlardı.
        if (error) hatalar.push(d.relPath);
        else yuklenen.push(d.relPath);
        gidenBayt += d.file.size;
        bitti += 1;
        if (bitti % 5 === 0 || bitti === dosyalar.length) {
          setIlerleme({ yapilan: bitti, toplam: dosyalar.length, bayt: gidenBayt });
        }
      }
    }
    await Promise.all(Array.from({ length: ESZAMANLI }, isci));
    setIlerleme({ yapilan: bitti, toplam: dosyalar.length, bayt: gidenBayt });
    setBasarisiz(hatalar);

    await finalizeUpload({ packageId, storedPaths: yuklenen });

    // Excel okuma — parçalı uç, `kalan` sıfırlanana kadar döner.
    setAsama("okuma");
    setDurumMetni("Excel dosyaları okunuyor…");
    let ofset = 0;
    for (let tur = 0; tur < 50; tur++) {
      const yanit = await fetch(`/drawings/${packageId}/import?ofset=${ofset}&adet=10`, {
        method: "POST",
      });
      if (!yanit.ok) {
        toast.warning("Excel okuma tamamlanamadı; paket yine de açıldı.");
        break;
      }
      const sonuc = (await yanit.json()) as { kalan: number; sonraki: number | null };
      if (!sonuc.kalan || sonuc.sonraki == null) break;
      ofset = sonuc.sonraki;
    }

    setAsama("eslestirme");
    setDurumMetni("Defter kuruluyor…");
    const es = await reconcilePackage({ packageId });
    if (es.error) toast.error(es.error);
    else toast.success(`Paket açıldı — sistem %${es.recognitionPct ?? 0}'ini tanıdı.`);

    router.push(`/drawings/${packageId}/report`);
  }

  const calisiyor = asama === "yukleme" || asama === "okuma" || asama === "eslestirme";
  const yuzde =
    ilerleme.toplam > 0 ? Math.round((ilerleme.yapilan / ilerleme.toplam) * 100) : 0;

  return (
    <div className="grid gap-4">
      <section className="border bg-card p-4">
        <h2 className="text-sm font-medium">1 · Klasörü seçin</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Teknik ressamın klasörünü OLDUĞU GİBİ seçin — alt klasörleriyle
          birlikte. Yeniden adlandırmaya, temizlemeye ya da düzenlemeye gerek
          yok; sistem ne anlarsa onu yazar, anlayamadığını raporda söyler.
        </p>

        <label
          className={
            "mt-3 flex min-h-16 cursor-pointer flex-wrap items-center gap-2 border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5" +
            (calisiyor ? " pointer-events-none opacity-50" : "")
          }
        >
          <FolderUp className="size-5 shrink-0" />
          <span>
            {klasorAdi ? (
              <span className="font-mono text-foreground">{klasorAdi}</span>
            ) : (
              "Klasör seçmek için tıklayın"
            )}
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            disabled={calisiyor}
            onChange={(e) => {
              const l = e.target.files;
              e.target.value = "";
              void dosyalariAl(l);
            }}
          />
        </label>

        {asama === "imza" && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Dosyalar okunuyor ve imzalanıyor… {ilerleme.yapilan}/{ilerleme.toplam}
          </p>
        )}
      </section>

      {onizleme && (
        <section className="border bg-card p-4">
          <h2 className="text-sm font-medium">2 · Ön inceleme</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Henüz hiçbir bayt gönderilmedi. Aşağıdakiler doğru görünüyorsa
            yüklemeyi başlatın.
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Kutu k="Dosya" d={formatNum(onizleme.toplam)} alt={formatBytes(onizleme.bayt)} />
            <Kutu k="Model (DWG)" d={formatNum(onizleme.model)} />
            <Kutu k="Resim (PDF)" d={formatNum(onizleme.resim)} />
            <Kutu k="Kesim (DXF)" d={formatNum(onizleme.kesim)} />
            <Kutu k="Excel" d={formatNum(onizleme.bom)} />
            <Kutu k="3B model" d={formatNum(onizleme.uc)} />
            <Kutu
              k="Hariç"
              d={formatNum(onizleme.haric)}
              alt="yedek / çalışma dosyası"
            />
            <Kutu
              k="Tanınmayan"
              d={formatNum(onizleme.taninmayan)}
              alt="yine de yüklenecek"
            />
          </dl>

          <div className="mt-4 grid gap-2 border-t pt-3">
            <div className="text-[11px] text-muted-foreground">
              {klasorTanima ? (
                <>
                  Klasör adı çözüldü ({klasorTanima.by}) — kalem no{" "}
                  <span className="font-mono text-foreground">{klasorTanima.itemNo}</span>
                </>
              ) : (
                "Klasör adından kalem numarası çözülemedi. Yazarsanız paket işe bağlanır; boş bırakırsanız yine yüklenir ve listede “Eşleşmemiş” olarak durur."
              )}
            </div>
            {!klasorTanima && (
              <div className="grid max-w-xs gap-1.5">
                <Label htmlFor="kalemNo">Kalem numarası (isteğe bağlı)</Label>
                <Input
                  id="kalemNo"
                  value={kalemNo}
                  onChange={(e) => setKalemNo(e.target.value)}
                  placeholder="0057-00"
                  className="font-mono"
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => void yukle()} disabled={calisiyor}>
              {calisiyor ? <Loader2 className="size-4 animate-spin" /> : null}
              Yüklemeyi Başlat
            </Button>
          </div>
        </section>
      )}

      {calisiyor && (
        <section className="border bg-card p-4">
          <h2 className="text-sm font-medium">3 · {durumMetni}</h2>
          <div className="mt-3 h-2 w-full overflow-hidden bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${asama === "yukleme" ? yuzde : 100}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {asama === "yukleme"
              ? `${ilerleme.yapilan}/${ilerleme.toplam} dosya · ${formatBytes(ilerleme.bayt)}`
              : "Sunucu çalışıyor…"}
          </p>
          {basarisiz.length > 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {basarisiz.length} dosya yüklenemedi. Paket açıldıktan sonra
              “Eksik Dosyaları Yükle” ile tamamlayabilirsiniz.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Kutu({ k, d, alt }: { k: string; d: string; alt?: string }) {
  return (
    <div className="min-w-0">
      <dt className="oc-kicker text-muted-foreground">{k}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums">{d}</dd>
      {alt && <dd className="truncate text-[11px] text-muted-foreground">{alt}</dd>}
    </div>
  );
}

/**
 * SHA-256 — kopya dosyaları bulmanın tek yolu.
 *
 * WebCrypto'da MD5 yok; kopya kararı için SHA-256 aynı sonucu verir. Bu imza
 * sayesinde BÜKÜM PDF'lerinin DWG altındakilerin aynısı olduğu ve — MTC'de
 * gerçekten olduğu gibi — İKİ FARKLI PARÇANIN aynı PDF'i taşıdığı görülür.
 */
async function imzala(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // İmza alınamazsa kopya tespiti düşer ama YÜKLEME DÜŞMEZ.
    return "";
  }
}
