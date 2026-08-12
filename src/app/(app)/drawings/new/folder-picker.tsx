"use client";

// Klasör yükleme sihirbazı — AKIŞIN GÖRÜNTÜSÜ.
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
// imzadır; kaydı yazan `addPackageFiles` aynı saf işlevleri KENDİSİ çağırır.
// Tek doğruluk kaynağı sunucudur.
//
// ————————————————————————————————— BU BİLEŞEN ARTIK DURUM TUTMAZ
//
// Akışın tamamı `upload-runner.ts`te, durumu `upload-store.ts`te yaşar.
// Sebebi bir kullanıcı bildirimidir (12.08.2026): yükleme başladıktan sonra
// başka bir sayfaya geçmek yüklemeyi DURDURUYORDU, çünkü akış bu bileşenin
// gövdesindeydi ve gezinme bileşeni söküyordu. Şimdi bileşen yalnız bir
// GÖRÜNTÜDÜR: abone olur, çizer, düğmelere basıldığında modüle haber verir.
// Kullanıcı yükleme sürerken çıkabilir; geri döndüğünde sihirbazı kaldığı
// yerde bulur, çıkmasa bile ekranın altındaki gösterge işi izler.

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FolderUp, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseFile } from "@/lib/drawings/file-name";
import { folderNameFromContents, parseFolderName } from "@/lib/drawings/folder-name";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { findActivePackage, loadMissingUploads } from "../actions";
import { dosyalariSec, yuklemeyiBaslat } from "./upload-runner";
import { useYukleme, yuklemeDurumu, yuklemeSifirla, yuklemeYaz } from "./upload-store";

/** Ofis hattı kabulü — tahmini süre için (bayt/sn). */
const TAHMINI_HIZ = 2_500_000;

export function FolderPicker({ devamPackageId = "" }: { devamPackageId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const durum = useYukleme();
  const {
    asama,
    klasorAdi,
    dosyalar,
    kalemNo,
    devam,
    acikPaket,
    supersedeKarari,
    ilerleme,
    basarisiz,
    durumMetni,
    sonuc,
  } = durum;

  // `webkitdirectory` React'in JSX tiplemesinde yok; öznitelik olarak konur.
  // Spread ile `any` kaçırmaktansa ref üzerinden yazmak hem tip güvenli hem
  // de tarayıcı desteği olmayan yerde sessizce düz çoklu seçime düşer.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  // SÜRDÜRME KİPİ. `resume-card` yıllardır `?devam=<id>` adresine gönderiyordu
  // ama parametre HİÇBİR YERDE OKUNMUYORDU: düğme boş bir sihirbaza gidiyor ve
  // aynı klasör seçilince İKİNCİ BİR PAKET açılıyordu. Söz verilen davranış
  // buydu; artık gerçekten yapılıyor.
  //
  // ARKA PLANDAKİ İŞ EZİLMEZ: sayfaya bir yükleme sürerken dönülmüş olabilir
  // ve o durumu sıfırlamak, süren akışın altındaki zemini çekmek olurdu.
  useEffect(() => {
    const mevcut = yuklemeDurumu();
    if (mevcut.calisiyor) return;
    if (mevcut.devamPackageId === devamPackageId) return;

    // Durum yazımı EFEKT GÖVDESİNDE DEĞİL geri çağrıdadır: senkron yazma
    // zincirleme render tetikler (`react-hooks/set-state-in-effect` ile aynı
    // gerekçe). Temizleme de aynı yoldan geçer.
    let iptal = false;
    void (async () => {
      if (!devamPackageId) {
        if (!iptal) yuklemeSifirla();
        return;
      }
      yuklemeYaz({ devamPackageId, devam: null });
      const cevap = await loadMissingUploads({ packageId: devamPackageId });
      if (iptal) return;
      if (cevap.error) {
        toast.error(cevap.error);
        return;
      }
      yuklemeYaz({
        devam: { folderName: cevap.folderName ?? "", targets: cevap.targets ?? [] },
      });
      if ((cevap.targets ?? []).length === 0) {
        toast.success("Bu pakette depoya ulaşmamış dosya kalmamış.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [devamPackageId]);

  /**
   * EKSİKSİZ BİTEN YÜKLEME RAPORA GİDER — ama yalnız sihirbaz EKRANDAYSA.
   *
   * Yönlendirmeyi akışın kendisi yapmıyor (bkz. `upload-runner.ts` sonu):
   * kullanıcı yükleme sürerken Satın Alma'ya geçmiş olabilir ve onu oradan
   * koparıp rapora atmak arka planda çalışmanın anlamını götürürdü. Karar bu
   * yüzden burada, yani "ekranda olan taraf"tadır.
   */
  useEffect(() => {
    if (!durum.tamamlananPaketId) return;
    const hedef = durum.tamamlananPaketId;
    yuklemeSifirla();
    router.push(`/drawings/${hedef}/report`);
  }, [durum.tamamlananPaketId, router]);

  const onizleme = useMemo(() => {
    if (dosyalar.length === 0) return null;
    const cozulmus = dosyalar.map((d) => parseFile({ relPath: d.relPath, size: d.file.size }));
    const kullanilir = cozulmus.filter((f) => f.lifecycle !== "haric");
    const rolSayisi = (rol: string) => kullanilir.filter((f) => f.role === rol).length;
    // Bayt bayt kopyalar da yüklenmeyecek; ön inceleme bunu SÖYLEMELİ, yoksa
    // "174 dosya seçtim, 169 gitti" sayısı sonradan sürpriz olur.
    const imzalar = new Set<string>();
    let kopya = 0;
    for (const d of dosyalar) {
      if (!d.checksum) continue;
      if (imzalar.has(d.checksum)) kopya++;
      else imzalar.add(d.checksum);
    }
    const haric = cozulmus.length - kullanilir.length;
    return {
      toplam: cozulmus.length,
      bayt: dosyalar.reduce((t, d) => t + d.file.size, 0),
      model: rolSayisi("model"),
      resim: rolSayisi("resim") + rolSayisi("bukum"),
      kesim: rolSayisi("kesim"),
      bom: rolSayisi("bom"),
      uc: rolSayisi("model3d"),
      haric,
      kopya,
      atlanacak: haric + kopya,
      taninmayan: kullanilir.filter((f) => !f.recognizedBy).length,
    };
  }, [dosyalar]);

  /**
   * Klasör kimliği — SUNUCUNUN ÇÖZDÜĞÜNÜN AYNISI.
   *
   * Burada `folderCodeFromContents`in çıktısını elle bölmek gerçek bir hataydı:
   * `split("-")[2]` grubu İLK SEGMENTE kırpıyordu ve gerçek veride çok
   * segmentli gruplar var (`0043-00-0802-00-02-06` → grup `0802-00`). Sunucu
   * `parsePartCode` ile `segments.join("-")` yazdığı için ikisi ayrışıyor,
   * `findActivePackage` boş dönüyor ve SÜPERSE SORUSU HİÇ SORULMUYORDU —
   * yani aynı (kalem, grup) için ikinci bir aktif paket açılıyordu.
   * Aynı saf işlevi çağırmak bu ayrışmayı tanımdan siler.
   */
  const klasorTanima = useMemo(() => {
    if (!klasorAdi) return null;
    let tanima = parseFolderName(klasorAdi);
    if (!tanima.value) {
      tanima = folderNameFromContents(
        klasorAdi,
        dosyalar.map((d) => d.relPath.split("/").pop() ?? "")
      );
    }
    if (!tanima.value) return null;
    return {
      by: tanima.by,
      itemNo: tanima.value.itemNo,
      group: tanima.value.group,
      ad: tanima.value.description,
    };
  }, [klasorAdi, dosyalar]);

  /**
   * Aynı (kalem, grup) için açık bir paket var mı?
   *
   * GRUP BOŞKEN HİÇ SORULMAZ. Klasör adı çözülemeyen paketler `group_code = ""`
   * ile kaydedilir; boş grubu sorgulamak birbiriyle hiç ilgisi olmayan iki
   * tanınmamış paketi eşleştirir ve grup grup çalışılan bir projede bu en sık
   * karşılaşılacak yanlış alarm olurdu.
   */
  useEffect(() => {
    if (devamPackageId) return;
    const grup = klasorTanima?.group?.trim() ?? "";
    const kalem = klasorTanima?.itemNo?.trim() ?? "";
    let iptal = false;
    void (async () => {
      if (!grup || !kalem) {
        if (!iptal) yuklemeYaz({ acikPaket: null });
        return;
      }
      const cevap = await findActivePackage({ itemNo: kalem, groupCode: grup });
      if (!iptal) yuklemeYaz({ acikPaket: cevap.package ?? null });
    })();
    return () => {
      iptal = true;
    };
  }, [klasorTanima, devamPackageId]);

  const calisiyor =
    asama === "yukleme" || asama === "dogrulama" || asama === "okuma" || asama === "eslestirme";
  const yuzde = ilerleme.toplam > 0 ? Math.round((ilerleme.yapilan / ilerleme.toplam) * 100) : 0;
  const gonderilecek = onizleme ? onizleme.toplam - (devam ? 0 : onizleme.atlanacak) : 0;
  const gonderilecekBayt = onizleme?.bayt ?? 0;
  const surumeHazir = !devam && Boolean(acikPaket) && supersedeKarari === "";

  return (
    <div className="grid gap-4">
      {devam && (
        <section className="border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            Eksikleri Tamamlama
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="font-mono text-foreground">{devam.folderName}</span> paketinin{" "}
            <strong>{formatNum(devam.targets.length)} dosyası</strong> depoya ulaşmamış. Aynı
            klasörü seçin — <strong>yeni bir paket açılmaz</strong>, yalnız eksik dosyalar
            gönderilir.
          </p>
        </section>
      )}

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
              // ÖNCE KOPYALA, SONRA TEMİZLE. `e.target.files` CANLI bir
              // `FileList`tir: `value = ""` onu yerinde boşaltır ve elde
              // tutulan referans sıfır elemanlı kalır — seçim sessizce
              // kaybolur. (`File` nesneleri hayatta kalır, liste kalmaz;
              // `contract-upload.tsx` tek dosya aldığı için bu tuzağa
              // düşmüyor.) Temizleme, aynı klasörü ikinci kez seçmenin
              // `change` olayını yeniden tetiklemesi için gerekli.
              const secilenler = Array.from(e.target.files ?? []);
              e.target.value = "";
              void dosyalariSec(secilenler);
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

      {/* ÖZET AÇIKKEN ÖN İNCELEME KAPANIR.
          Aksi hâlde kırmızı özet kartının hemen üstünde "Yüklemeyi Başlat"
          etkin kalıyordu: "tekrar deneyeyim" diyen kullanıcı aynı klasör için
          TAM BİR İKİNCİ PAKET açıyor ve 107 MB'ı yeniden gönderiyordu — yani
          sürdürme kipinin çözmek için eklendiği kusurun ta kendisi. Doğru
          eylem ("Eksikleri Yeniden Dene") özet kartındadır. */}
      {onizleme && asama !== "ozet" && (
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
              k="Atlanacak"
              d={formatNum(onizleme.atlanacak)}
              alt={`${onizleme.haric} yedek · ${onizleme.kopya} kopya`}
            />
            <Kutu
              k="Tanınmayan"
              d={formatNum(onizleme.taninmayan)}
              alt="yine de yüklenecek"
            />
          </dl>

          {/* ATLANANLAR BİR KAYIP DEĞİL. Deftere bilerek almadığımız bir yedek
              dosyayı depoya yollamak tutarsızlıktı; bayt bayt aynı dosyayı iki
              kez yollamak da gereksiz. Kazanç yer değil HIZ: her istek bir
              başarısızlık fırsatıdır. */}
          {!devam && onizleme.atlanacak > 0 && (
            <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
              {formatNum(onizleme.atlanacak)} dosya yüklenmeyecek: {onizleme.haric} yedek/çalışma
              dosyası deftere zaten girmiyor, {onizleme.kopya} dosya da bayt bayt bir başkasının
              aynısı (o dosya tek kopyayla açılır). Kayıtları yine tutulur.
            </p>
          )}

          {!devam && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {formatNum(gonderilecek)} dosya · {formatBytes(gonderilecekBayt)} gönderilecek —
              ofis hattında yaklaşık <strong>{sureMetni(gonderilecekBayt)}</strong>.{" "}
              <strong>Başka sayfalara geçebilirsiniz</strong>: yükleme arka planda sürer ve ekranın
              altındaki göstergeden izlenir. Yalnız <strong>bu sekmeyi kapatmayın</strong> ya da
              sayfayı yenilemeyin (kaldığı yerden sürdürülebilir).
            </p>
          )}

          {!devam && (
            <div className="mt-4 grid gap-2 border-t pt-3">
              <div className="text-[11px] text-muted-foreground">
                {klasorTanima ? (
                  <>
                    Klasör adı çözüldü ({klasorTanima.by}) — kalem no{" "}
                    <span className="font-mono text-foreground">{klasorTanima.itemNo}</span>
                    {klasorTanima.group && (
                      <>
                        {" "}
                        · grup <span className="font-mono text-foreground">{klasorTanima.group}</span>
                      </>
                    )}
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
                    onChange={(e) => yuklemeYaz({ kalemNo: e.target.value })}
                    className="font-mono"
                  />
                </div>
              )}
            </div>
          )}

          {/* SÜPERSE SORUSU — yükleme başlamadan. Aynı (kalem, grup) için açık
              bir paket varsa üç seçenek vardır ve hiçbiri "sil" değildir:
              yanlış yükleme için doğru araç REVİZYONDUR, geçmişi yok etmez. */}
          {acikPaket && !devam && (
            <div className="mt-4 border border-amber-500/40 bg-amber-500/5 p-3">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
                Bu kalem ve grup için zaten bir paket var
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-mono text-foreground">{acikPaket.folderName}</span> — R
                {String(acikPaket.revNo).padStart(2, "0")} ·{" "}
                {formatNum(acikPaket.fileCount)} dosya · {formatNum(acikPaket.partCount)} parça.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={supersedeKarari === "revizyon" ? "default" : "outline"}
                  onClick={() => yuklemeYaz({ supersedeKarari: "revizyon" })}
                >
                  Yeni revizyon (önerilen)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={supersedeKarari === "ayri" ? "default" : "outline"}
                  onClick={() => yuklemeYaz({ supersedeKarari: "ayri" })}
                >
                  İkisi ayrı dursun
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {supersedeKarari === "revizyon"
                  ? "Eski paket ve dosyaları DURUR, yalnız listede geri plana düşer. Atölyenin üretim kayıtları yeni revizyona taşınır; değişen parçalar “gözden geçirilmeli” işareti alır."
                  : supersedeKarari === "ayri"
                    ? "İki paket birbirinden bağımsız durur. Hangisinin geçerli olduğunu sistem söylemez."
                    : "Devam etmek için birini seçin."}
              </p>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button onClick={() => void yuklemeyiBaslat()} disabled={calisiyor || surumeHazir}>
              {calisiyor ? <Loader2 className="size-4 animate-spin" /> : null}
              {devam ? "Eksikleri Yükle" : "Yüklemeyi Başlat"}
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
              ? `${ilerleme.yapilan}/${ilerleme.toplam} dosya depoda · ${formatBytes(ilerleme.bayt)}`
              : "Sunucu çalışıyor…"}
          </p>
          {basarisiz.length > 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {formatNum(basarisiz.length)} dosya yüklenemedi — sebepleri yükleme bitince
              listelenecek.
            </p>
          )}
        </section>
      )}

      {asama === "ozet" && sonuc && (
        <section className="border border-destructive/40 bg-card">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4 text-destructive" />
              Yükleme tamamlandı ama eksik var
            </h2>
          </header>

          <div className="grid gap-3 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Kutu
                k="Depoda"
                d={`${formatNum(sonuc.storedCount)}/${formatNum(sonuc.expectedCount)}`}
                alt={formatBytes(sonuc.storedBytes)}
              />
              <Kutu k="Ulaşmayan" d={formatNum(sonuc.missing)} alt="yeniden denenebilir" />
              <Kutu k="Atlanan" d={formatNum(sonuc.skippedCount)} alt="yedek + kopya" />
              <Kutu k="Tanıma" d={`%${sonuc.recognitionPct}`} />
            </dl>

            {basarisiz.length > 0 && (
              <div className="border">
                <p className="border-b bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                  Ulaşmayan dosyalar ve <strong>sebepleri</strong> — bu bilgi eskiden
                  atılıyordu ve “neden ulaşmadı” sorusu cevapsız kalıyordu.
                </p>
                <ul className="max-h-64 divide-y overflow-y-auto">
                  {basarisiz.slice(0, 50).map((b) => (
                    <li key={b.relPath} className="grid gap-0.5 px-3 py-1.5">
                      <span className="truncate font-mono text-[11px]" title={b.relPath}>
                        {b.relPath}
                      </span>
                      <span className="text-[11px] text-destructive">
                        {b.status ? `${b.status} · ` : ""}
                        {b.message || "sebep bildirilmedi"}
                      </span>
                    </li>
                  ))}
                </ul>
                {basarisiz.length > 50 && (
                  <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                    … ve {formatNum(basarisiz.length - 50)} dosya daha.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // ÖNCE SIFIRLA: sürdürme kipi kurulumu `devamPackageId`
                  // değişimine bakıyor ve eski turun özeti elde kalırsa
                  // "Eksikleri Yükle" ekranı kırmızı kartın altında açılırdı.
                  const hedef = sonuc.packageId;
                  yuklemeSifirla();
                  router.push(`/drawings/new?devam=${hedef}`);
                }}
              >
                Eksikleri Yeniden Dene
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const hedef = sonuc.packageId;
                  yuklemeSifirla();
                  router.push(`/drawings/${hedef}/report`);
                }}
              >
                <CheckCircle2 className="size-4" />
                Rapora Git
              </Button>
            </div>
          </div>
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

/** "yaklaşık 1 dk" · "yaklaşık 7 dk" */
function sureMetni(bayt: number): string {
  const sn = Math.round(bayt / TAHMINI_HIZ);
  if (sn < 60) return `${Math.max(1, sn)} sn`;
  return `${Math.round(sn / 60)} dk`;
}
