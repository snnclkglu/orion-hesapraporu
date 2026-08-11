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
// imzadır; kaydı yazan `addPackageFiles` aynı saf işlevleri KENDİSİ çağırır.
// Tek doğruluk kaynağı sunucudur.
//
// ————————————————————————————————————————— HATA BİR DAHA YUTULMAZ
//
// Bu ekranın düzeltilen kusuru şuydu: yükleme hatası yakalanıyor ama
// `error.message` ATILIYOR, sayaçlar hata dalının DIŞINDA artıyor ve başarı
// bildirimi KOŞULSUZ basılıyordu. Yani bütün baytlar reddedilse bile ekran
// "174/174 dosya · 107 MB" yazıp rapora atlıyordu. Üç kural artık değişmez:
//   1. Sayaç YALNIZ başarıda artar — ilerleme çubuğu denemeyi değil ULAŞANI
//      gösterir.
//   2. Sebep saklanır ve sunucuya gider (`upload_error`).
//   3. Eksik varsa RAPORA ATLANMAZ; önce bir özet ekranı çıkar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FolderUp, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseFile } from "@/lib/drawings/file-name";
import { folderNameFromContents, parseFolderName } from "@/lib/drawings/folder-name";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { contentTypeFor } from "@/lib/drawings/mime";
import {
  addPackageFiles,
  createPackage,
  finalizeUpload,
  findActivePackage,
  loadMissingUploads,
  reconcilePackage,
  sealPackageFiles,
  supersedePackage,
  verifyStorage,
} from "../actions";
import type { UploadTarget } from "../schema";

const BUCKET = "drawings";
/** Tarayıcı köken başına ~6 bağlantı verir; 4 metadata yazmalarına pay bırakır. */
const ESZAMANLI = 4;
/** Bir `addPackageFiles` çağrısının taşıyacağı satır sayısı (1 MB gövde sınırı). */
const SATIR_OBEGI = 500;
/** Başarısız bir yüklemenin toplam deneme sayısı (ilk deneme dâhil). */
const DENEME = 3;
/** Ofis hattı kabulü — tahmini süre için (bayt/sn). */
const TAHMINI_HIZ = 2_500_000;

interface SecilenDosya {
  file: File;
  relPath: string;
  checksum: string;
}

interface Basarisiz {
  relPath: string;
  message: string;
  status: number | null;
}

type Asama =
  | "secim"
  | "imza"
  | "onizleme"
  | "yukleme"
  | "dogrulama"
  | "okuma"
  | "eslestirme"
  | "ozet";

interface Sonuc {
  packageId: string;
  storedCount: number;
  expectedCount: number;
  skippedCount: number;
  storedBytes: number;
  missing: number;
  recognitionPct: number;
  devirOzeti: string;
}

/** Sihirbazın bulduğu, aynı (kalem, grup) için açık paket. */
interface AcikPaket {
  id: string;
  folderName: string;
  revNo: number;
  fileCount: number;
  partCount: number;
}

export function FolderPicker({ devamPackageId = "" }: { devamPackageId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [asama, setAsama] = useState<Asama>("secim");
  const [klasorAdi, setKlasorAdi] = useState("");
  const [dosyalar, setDosyalar] = useState<SecilenDosya[]>([]);
  const [kalemNo, setKalemNo] = useState("");
  const [ilerleme, setIlerleme] = useState({ yapilan: 0, toplam: 0, bayt: 0 });
  const [basarisiz, setBasarisiz] = useState<Basarisiz[]>([]);
  const [durumMetni, setDurumMetni] = useState("");
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  // Sürdürme kipi: paket ZATEN AÇIK, yalnız eksik baytlar gönderilecek.
  const [devam, setDevam] = useState<{
    folderName: string;
    targets: { relPath: string; fileId: string; storagePath: string }[];
  } | null>(null);

  // Süperse sorusu — yükleme başlamadan ÖNCE sorulur.
  const [acikPaket, setAcikPaket] = useState<AcikPaket | null>(null);
  const [supersedeKarari, setSupersedeKarari] = useState<"" | "revizyon" | "ayri">("");

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
  useEffect(() => {
    if (!devamPackageId) return;
    let iptal = false;
    void (async () => {
      const cevap = await loadMissingUploads({ packageId: devamPackageId });
      if (iptal) return;
      if (cevap.error) {
        toast.error(cevap.error);
        return;
      }
      setDevam({ folderName: cevap.folderName ?? "", targets: cevap.targets ?? [] });
      if ((cevap.targets ?? []).length === 0) {
        toast.success("Bu pakette depoya ulaşmamış dosya kalmamış.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [devamPackageId]);

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
    // Durum yazımı EFEKT GÖVDESİNDE DEĞİL geri çağrıdadır: senkron `setState`
    // zincirleme render tetikler (`react-hooks/set-state-in-effect`). Temizleme
    // de aynı yoldan geçer ki "grup boşaldı" hâli sıraya girsin.
    void (async () => {
      if (!grup || !kalem) {
        if (!iptal) setAcikPaket(null);
        return;
      }
      const cevap = await findActivePackage({ itemNo: kalem, groupCode: grup });
      if (!iptal) setAcikPaket(cevap.package ?? null);
    })();
    return () => {
      iptal = true;
    };
  }, [klasorTanima, devamPackageId]);

  async function dosyalariAl(hepsi: File[]) {
    // SESSİZ DÖNÜŞ YOK. Kullanıcı bir klasör seçtiyse ekranda bir şey olmalı;
    // "tıkladım, hiçbir şey olmadı" bu ekranın en kötü hâlidir ve bir kez
    // yaşandı (canlı FileList temizlenince seçim sıfırlanıyordu).
    if (hepsi.length === 0) {
      toast.error("Klasörden hiç dosya okunamadı. Boş bir klasör seçmiş olabilirsiniz.");
      return;
    }

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

    // SÜRDÜRME KİPİNDE İMZA HESAPLANMAZ. Satırlar zaten yazılı; eşleştirme
    // yola göre yapılır ve 107 MB'ı yeniden SHA-256'dan geçirmek dakikaları
    // hiçbir kazanç olmadan yakardı.
    if (devam) {
      const gerekli = new Map(devam.targets.map((t) => [t.relPath, t]));
      const secilen: SecilenDosya[] = [];
      for (const f of hepsi) {
        const tam = (f.webkitRelativePath || f.name).normalize("NFC");
        const rel = kok && tam.startsWith(`${kok}/`) ? tam.slice(kok.length + 1) : tam;
        if (gerekli.has(rel)) secilen.push({ file: f, relPath: rel, checksum: "" });
      }
      if (secilen.length === 0) {
        toast.error(
          "Seçilen klasörde bu paketin eksik dosyalarından hiçbiri bulunamadı. Doğru klasörü seçtiğinizden emin olun."
        );
        return;
      }
      if (secilen.length < devam.targets.length) {
        toast.warning(
          `${devam.targets.length} eksik dosyadan ${secilen.length} tanesi bu klasörde bulundu.`
        );
      }
      setDosyalar(secilen);
      setAsama("onizleme");
      return;
    }

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

  /** Depo hedeflerine baytları yazar; SEBEBİYLE birlikte sonucu döner. */
  const baytlariGonder = useCallback(
    async (hedefler: (UploadTarget & { file: File })[]) => {
      const supabase = createClient();
      const basarili: string[] = [];
      const dusen: (Basarisiz & { fileId: string })[] = [];
      let gidenBayt = 0;
      let bitti = 0;

      setIlerleme({ yapilan: 0, toplam: hedefler.length, bayt: 0 });

      let sonraki = 0;
      async function isci() {
        for (;;) {
          const i = sonraki++;
          if (i >= hedefler.length) return;
          const h = hedefler[i];

          // ATLANANLAR HİÇ GÖNDERİLMEZ (yedek dosya · bayt bayt kopya) ve
          // sayaçlara da girmezler: "gönderilmedi" ile "gönderilemedi" aynı
          // şey değildir ve karıştırılırsa doğrulama yanlış alarm üretir.
          if (h.skip) continue;

          const sonHata = await yukleTekrarli(supabase, h.storagePath, h.file);
          if (sonHata) {
            dusen.push({
              fileId: h.fileId,
              relPath: h.relPath,
              message: sonHata.message,
              status: sonHata.status,
            });
            // İLERLEME YALNIZ BAŞARIDA ARTAR. Eski kod sayaçları hata dalının
            // dışında artırıyordu ve ekran her bayt reddedilse bile
            // "174/174 · 107 MB" yazıyordu.
            console.error("[drawings] yükleme başarısız", h.relPath, sonHata);
          } else {
            basarili.push(h.fileId);
            gidenBayt += h.file.size;
          }

          bitti += 1;
          if (bitti % 5 === 0 || bitti === hedefler.length) {
            setIlerleme({ yapilan: basarili.length, toplam: hedefler.length, bayt: gidenBayt });
          }
        }
      }
      await Promise.all(Array.from({ length: ESZAMANLI }, isci));
      setIlerleme({ yapilan: basarili.length, toplam: hedefler.length, bayt: gidenBayt });
      return { basarili, dusen };
    },
    []
  );

  /**
   * İçe aktarma aşaması — `okunamayan[]` ARTIK OKUNUR.
   *
   * Route bu diziyi ilk günden beri döndürüyordu ama hiçbir çağıran ona
   * bakmıyordu: bozuk ya da indirilemeyen bir dosya sessizce atlanıyor,
   * kullanıcı "her şey okundu" sanıyordu.
   */
  const asamayiKostur = useCallback(
    async (
      packageId: string,
      asamaAdi: "excel" | "pdf" | "dxf",
      adet: number
    ): Promise<{ ok: boolean; toplam: number; okunamayan: { file: string; reason: string }[] }> => {
      let ofset = 0;
      let toplam = 0;
      const okunamayan: { file: string; reason: string }[] = [];
      for (let tur = 0; tur < 200; tur++) {
        const yanit = await fetch(
          `/drawings/${packageId}/import?asama=${asamaAdi}&ofset=${ofset}&adet=${adet}`,
          { method: "POST" }
        );
        if (!yanit.ok) return { ok: false, toplam, okunamayan };
        const cevap = (await yanit.json()) as {
          toplam: number;
          bos?: boolean;
          kalan: number;
          sonraki: number | null;
          okunamayan?: { file: string; reason: string }[];
        };
        toplam = cevap.toplam;
        if (cevap.okunamayan?.length) okunamayan.push(...cevap.okunamayan);
        if (cevap.toplam > 0) {
          setIlerleme({
            yapilan: cevap.toplam - cevap.kalan,
            toplam: cevap.toplam,
            bayt: 0,
          });
        }
        if (!cevap.kalan || cevap.sonraki == null) return { ok: true, toplam, okunamayan };
        ofset = cevap.sonraki;
      }
      return { ok: false, toplam, okunamayan };
    },
    []
  );

  function okunamayaniBildir(asamaAdi: string, liste: { file: string; reason: string }[]) {
    if (!liste.length) return;
    const ornek = liste
      .slice(0, 3)
      .map((o) => `${o.file.split("/").pop()} (${o.reason})`)
      .join(" · ");
    toast.error(
      `${asamaAdi}: ${liste.length} dosya okunamadı — ${ornek}${liste.length > 3 ? " …" : ""}`,
      { duration: Infinity, closeButton: true }
    );
  }

  /**
   * Yükleme akışının SARMALAYICISI — hiçbir hata ekranı kilitleyemez.
   *
   * `yukle()` içindeki sunucu eylemlerinin bir kısmı `{error}` DÖNMEZ,
   * FIRLATIR: `tumSayfalar` PostgREST hatasında `throw` eder ve `asamayiKostur`
   * ham `fetch` kullanır. 107 MB'lık bir yükleme on dakika sürerken ofis
   * hattının bir kez kopması yeterdi: `void yukle()` reddi yutuyor, `asama`
   * "okuma"da kalıyor, `calisiyor` sonsuza dek true oluyordu — dönen bir
   * spinner, tek bir toast yok, klasör girişi ve düğme kapalı. Kullanıcı
   * `packageId`yi bile öğrenemediği için "Eksikleri Yeniden Dene" bağlantısına
   * da ulaşamıyordu.
   *
   * Bu dosyanın başlığındaki söz ("hata bir daha yutulmaz") tam da burada
   * tutulur: en kötü durumda bile ekranda bir mesaj ve bir çıkış yolu kalır.
   */
  async function yukleGuvenli() {
    // Paket kimliği hata yolunda da lazım: ressamın elinde en azından
    // "Eksikleri Yeniden Dene" bağlantısı kalmalı.
    const kimlik = { packageId: devamPackageId };
    try {
      await yukle(kimlik);
    } catch (e) {
      const mesaj = e instanceof Error ? e.message : String(e);
      console.error("[drawings] yükleme akışı düştü", e);
      toast.error(`Yükleme yarıda kaldı: ${mesaj}`, { duration: Infinity, closeButton: true });
      if (kimlik.packageId) {
        // Paket açılmışsa özet ekranına düşülür; oradaki "Eksikleri Yeniden
        // Dene" düğmesi sürdürme kipine götürür ve İKİNCİ BİR PAKET AÇMAZ.
        setSonuc({
          packageId: kimlik.packageId,
          storedCount: 0,
          expectedCount: 0,
          skippedCount: 0,
          storedBytes: 0,
          missing: 0,
          recognitionPct: 0,
          devirOzeti: "",
        });
        setAsama("ozet");
      } else {
        setAsama("onizleme");
      }
    }
  }

  async function yukle(kimlik: { packageId: string }) {
    if (dosyalar.length === 0) return;
    setAsama("yukleme");
    setBasarisiz([]);

    // ————————————————————————————————————— 1. Paket ve dosya satırları
    let packageId = devamPackageId;
    let hedefler: (UploadTarget & { file: File })[] = [];

    // SÜRDÜRME KİPİ SESSİZCE "YENİ PAKET AÇ"A DÜŞMEZ.
    //
    // Akış `devam` STATE'ine bakıyordu, `devamPackageId` PROP'una değil:
    // `loadMissingUploads` hata dönerse ya da fırlatırsa `devam` null kalıyor,
    // amber şerit hiç çıkmıyor ve kullanıcı eksikleri tamamladığını sanırken
    // İKİNCİ BİR PAKET açıyordu.
    if (devamPackageId && !devam) {
      toast.error(
        "Eksik dosya listesi okunamadı; ikinci bir paket açmamak için yükleme başlatılmadı. Sayfayı yenileyip tekrar deneyin.",
        { duration: Infinity, closeButton: true }
      );
      setAsama("onizleme");
      return;
    }

    if (devam) {
      setDurumMetni("Eksik dosyalar hazırlanıyor…");
      const yolIle = new Map(devam.targets.map((t) => [t.relPath, t]));
      hedefler = dosyalar
        .map((d) => {
          const t = yolIle.get(d.relPath);
          return t
            ? { fileId: t.fileId, relPath: t.relPath, storagePath: t.storagePath, skip: false, file: d.file }
            : null;
        })
        .filter((x): x is UploadTarget & { file: File } => x !== null);
    } else {
      setDurumMetni("Paket kaydı açılıyor…");
      const kayit = await createPackage({
        folderName: klasorAdi,
        itemNoOverride: kalemNo.trim(),
        supersedesId: supersedeKarari === "revizyon" ? acikPaket?.id : undefined,
      });
      if (kayit.error || !kayit.packageId) {
        toast.error(kayit.error ?? "Paket kaydı açılamadı.");
        setAsama("onizleme");
        return;
      }
      packageId = kayit.packageId;
      // Kimliği HEMEN dışarı yaz: bundan sonraki her adım fırlatabilir ve
      // sarmalayıcının elinde bir kurtarma bağlantısı olmalı.
      kimlik.packageId = packageId;

      // SATIRLAR ÖBEK ÖBEK. Hepsi tek gövdede gitseydi 2000 dosyada ~340 KB,
      // 5000 dosyada ~850 KB ederdi ve Server Action gövde sınırı 1 MB'tır.
      const dosyaIle = new Map(dosyalar.map((d) => [d.relPath, d.file]));
      for (let i = 0; i < dosyalar.length; i += SATIR_OBEGI) {
        setDurumMetni(
          `Dosya kayıtları yazılıyor… ${Math.min(i + SATIR_OBEGI, dosyalar.length)}/${dosyalar.length}`
        );
        const obek = dosyalar.slice(i, i + SATIR_OBEGI);
        const cevap = await addPackageFiles({
          packageId,
          files: obek.map((d) => ({ relPath: d.relPath, size: d.file.size, checksum: d.checksum })),
        });
        if (cevap.error || !cevap.uploads) {
          toast.error(cevap.error ?? "Dosya kayıtları yazılamadı.", {
            duration: Infinity,
            closeButton: true,
          });
          setAsama("onizleme");
          return;
        }
        for (const u of cevap.uploads) {
          const f = dosyaIle.get(u.relPath);
          if (f) hedefler.push({ ...u, file: f });
        }
      }

      setDurumMetni("Klasör tanınıyor…");
      const muhur = await sealPackageFiles({ packageId });
      if (muhur.error) toast.warning(muhur.error);
    }

    // ————————————————————————————————————————————————— 2. Baytlar
    setDurumMetni("Dosyalar yükleniyor…");
    const { basarili, dusen } = await baytlariGonder(hedefler);
    setBasarisiz(dusen.map(({ relPath, message, status }) => ({ relPath, message, status })));

    // ——————————————————————————————— 3. Sonucu yaz, sonra GERÇEĞİ ÖLÇ
    const kapanis = await finalizeUpload({
      packageId,
      storedFileIds: basarili,
      failed: dusen.map((d) => ({
        fileId: d.fileId,
        message: d.status ? `${d.status} · ${d.message}` : d.message,
      })),
    });
    // DÖNÜŞ OKUNUR. Eski kod `await finalizeUpload(...)` yazıp sonucu hiç
    // kontrol etmiyordu; hata dönse bile ekran başarıya devam ediyordu.
    if (kapanis.error) {
      toast.error(kapanis.error, { duration: Infinity, closeButton: true });
    }

    setAsama("dogrulama");
    setDurumMetni("Depo doğrulanıyor…");
    const dogrulama = await verifyStorage({ packageId });
    if (dogrulama.error) {
      toast.error(dogrulama.error, { duration: Infinity, closeButton: true });
    }

    // ————————————————————————————————————————————————— 4. İçerik okuma
    //
    // SIRA ÖNEMLİ: defterin omurgası Excel'den kurulur; antet ve DXF kutusu
    // yalnız BOŞ ALANI doldurur. Ters sırada çalışsalardı antetteki anlık
    // ağırlık, ressamın onayladığı ürün ağacındakini ezerdi.
    //
    // İçerik aşamaları BAŞARISIZ OLABİLİR ve bu yüklemeyi bozmaz: paket zaten
    // açılmıştır, defter Excel'den kurulur, kullanıcı sonra "İçerikleri
    // Yeniden Oku" ile tamamlayabilir.
    setAsama("okuma");
    for (const [ad, anahtar, adet] of [
      ["Excel dosyaları okunuyor…", "excel", 10],
      ["Resim antetleri okunuyor…", "pdf", 20],
      ["Kesim dosyaları okunuyor…", "dxf", 25],
    ] as const) {
      setDurumMetni(ad);
      const cevap = await asamayiKostur(packageId, anahtar, adet);
      if (!cevap.ok) {
        toast.warning(`${anahtar.toUpperCase()} okuma tamamlanamadı; paket yine de açıldı.`);
      } else if (cevap.toplam === 0) {
        // BOŞ İŞ KÜMESİ BAŞARI DEĞİLDİR. Sunucu ikisine de `{kalan: 0}`
        // dönüyordu ve istemci "hiç dosya yoktu"yu "hepsi okundu" sanıyordu —
        // depoya hiç ulaşmamış bir paket tam olarak böyle sessiz kalırdı.
        toast.warning(`${anahtar.toUpperCase()}: okunacak dosya bulunamadı.`);
      }
      okunamayaniBildir(anahtar.toUpperCase(), cevap.okunamayan);
    }

    // ————————————————————————————————————————————————— 5. Defter
    setAsama("eslestirme");
    setDurumMetni("Defter kuruluyor…");
    const es = await reconcilePackage({ packageId });
    if (es.error) toast.error(es.error, { duration: Infinity, closeButton: true });

    // ———————————————————————— 6. Revizyonsa ESKİYİ ŞİMDİ düşür
    //
    // EN SONDA, çünkü yarıda kalan bir revizyon eski paketi düşürseydi atölye
    // bakacak resim bulamazdı. Süperse SİLMEK DEĞİLDİR: eski paket ve bütün
    // dosyaları durur, yalnız listede geri plana düşer.
    let devirOzeti = "";
    if (!devam && supersedeKarari === "revizyon" && acikPaket) {
      setDurumMetni("Üretim kayıtları yeni revizyona taşınıyor…");
      const devir = await supersedePackage({ packageId, supersedesId: acikPaket.id });
      if (devir.error) toast.error(devir.error, { duration: Infinity, closeButton: true });
      else devirOzeti = devir.summary ?? "";
    }

    const eksik = dogrulama.missing ?? dusen.length;
    setSonuc({
      packageId,
      storedCount: dogrulama.storedCount ?? 0,
      expectedCount: dogrulama.expectedCount ?? hedefler.length,
      skippedCount: dogrulama.skippedCount ?? 0,
      storedBytes: dogrulama.storedBytes ?? 0,
      missing: eksik,
      recognitionPct: es.recognitionPct ?? 0,
      devirOzeti,
    });

    // EKSİK VARSA RAPORA ATLANMAZ. Eski akış `router.push` ile bileşeni
    // unmount ediyordu ve tek uyarı satırı onunla birlikte yok oluyordu —
    // fonksiyondaki toast'sız tek hata dalı buydu, üstüne koşulsuz bir
    // `toast.success` basılıyordu.
    if (eksik > 0 || dusen.length > 0) {
      setAsama("ozet");
      toast.error(`${formatNum(eksik)} dosya depoya ulaşmadı. Ayrıntı aşağıda.`, {
        duration: Infinity,
        closeButton: true,
      });
      return;
    }

    toast.success(
      devirOzeti || `Paket açıldı — sistem %${es.recognitionPct ?? 0}'ini tanıdı.`
    );
    router.push(`/drawings/${packageId}/report`);
  }

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
              void dosyalariAl(secilenler);
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
              ofis hattında yaklaşık{" "}
              <strong>{sureMetni(gonderilecekBayt)}</strong>. Bu sekmeyi açık bırakın; kapatırsanız
              yükleme durur (kaldığı yerden sürdürülebilir).
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
                    onChange={(e) => setKalemNo(e.target.value)}
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
                  onClick={() => setSupersedeKarari("revizyon")}
                >
                  Yeni revizyon (önerilen)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={supersedeKarari === "ayri" ? "default" : "outline"}
                  onClick={() => setSupersedeKarari("ayri")}
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
            <Button onClick={() => void yukleGuvenli()} disabled={calisiyor || surumeHazir}>
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
                onClick={() => router.push(`/drawings/new?devam=${sonuc.packageId}`)}
              >
                Eksikleri Yeniden Dene
              </Button>
              <Button type="button" onClick={() => router.push(`/drawings/${sonuc.packageId}/report`)}>
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

/**
 * Tek dosyayı ÜÇ DENEMEYE kadar yükler; başarısızsa SEBEBİ döner.
 *
 * Bugüne kadar tek bir kopan bağlantı dosyayı kalıcı olarak kaybettiriyordu:
 * 454 dosyalık bir pakette bu neredeyse kaçınılmaz. Üstel bekleme, geçici bir
 * ağ dalgalanmasının bütün bir yüklemeyi eksik bırakmasını engeller.
 */
async function yukleTekrarli(
  supabase: ReturnType<typeof createClient>,
  hedef: string,
  dosya: File
): Promise<{ message: string; status: number | null } | null> {
  if (!hedef) return { message: "depo yolu üretilmedi", status: null };

  // TİP DOĞRU OLSUN DİYE BLOB. `upload` seçeneklerindeki `contentType`,
  // gövde bir `Blob`/`File` olduğunda storage-js'in FormData dalına düşer ve
  // YOK SAYILIR — bucket'taki her DXF `application/octet-stream` oluyordu.
  // `slice` kopya çıkarmaz, yalnız tipi olan yeni bir görünüm verir.
  const mime = contentTypeFor(dosya.name, dosya.type);
  const govde = dosya.slice(0, dosya.size, mime);

  let son: { message: string; status: number | null } = { message: "bilinmeyen hata", status: null };
  for (let deneme = 0; deneme < DENEME; deneme++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(hedef, govde, { upsert: true, contentType: mime });
    if (!error) return null;
    const durum = (error as { statusCode?: string | number }).statusCode;
    son = {
      message: error.message || "bilinmeyen hata",
      status: durum == null ? null : Number(durum) || null,
    };
    if (deneme < DENEME - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** deneme));
  }
  return son;
}

/** "yaklaşık 1 dk" · "yaklaşık 7 dk" */
function sureMetni(bayt: number): string {
  const sn = Math.round(bayt / TAHMINI_HIZ);
  if (sn < 60) return `${Math.max(1, sn)} sn`;
  return `${Math.round(sn / 60)} dk`;
}

/**
 * SHA-256 — kopya dosyaları bulmanın tek yolu.
 *
 * WebCrypto'da MD5 yok; kopya kararı için SHA-256 aynı sonucu verir. Bu imza
 * sayesinde BÜKÜM PDF'lerinin DWG altındakilerin aynısı olduğu ve — MTC'de
 * gerçekten olduğu gibi — İKİ FARKLI PARÇANIN aynı PDF'i taşıdığı görülür.
 * Aynı imza artık ikinci kez YÜKLENMEZ de: satır aslın yolunu gösterir.
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
