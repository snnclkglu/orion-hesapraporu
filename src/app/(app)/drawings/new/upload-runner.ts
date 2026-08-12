"use client";

// Yükleme AKIŞI — bileşenin değil MODÜLÜN işi.
//
// Buradaki her satır daha önce `folder-picker.tsx`in gövdesindeydi. Taşınma
// sebebi tek bir cümledir: **bir bileşen gezinmede sökülür, bir modül
// sökülmez.** Akış artık onu başlatan ekranın ömrüne bağlı değildir; kullanıcı
// yükleme sürerken İşler'e ya da Satın Alma'ya gidebilir, geri döndüğünde
// sihirbazı kaldığı yerde bulur (gerekçenin tamamı `upload-store.ts`te).
//
// Bileşenden GERİ ÇAĞRI ALMAZ. Eskiden akış `setState` ve `router.push`
// çağırıyordu; ikisi de sökülmüş bir ağaçta anlamsızdır. Yerine durum yazılır
// (`yuklemeYaz`) ve bitişte `tamamlananPaketId` işaretlenir — rapora gitme
// kararını, o an EKRANDA OLAN taraf verir.
//
// ————————————————————————————————— HATA BİR DAHA YUTULMAZ
//
// `folder-picker.tsx`in başlığındaki üç kural burada da geçerlidir ve
// taşınırken korunmuştur:
//   1. Sayaç YALNIZ başarıda artar — ilerleme denemeyi değil ULAŞANI gösterir.
//   2. Sebep saklanır ve sunucuya gider (`upload_error`).
//   3. Eksik varsa RAPORA ATLANMAZ; önce bir özet ekranı çıkar.

import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatNum } from "@/lib/drawings/labels";
import { contentTypeFor } from "@/lib/drawings/mime";
import {
  addPackageFiles,
  createPackage,
  finalizeUpload,
  reconcilePackage,
  sealPackageFiles,
  supersedePackage,
  verifyStorage,
} from "../actions";
import type { UploadTarget } from "../schema";
import {
  yuklemeDurumu,
  yuklemeYaz,
  type Basarisiz,
  type SecilenDosya,
} from "./upload-store";

const BUCKET = "drawings";
/** Tarayıcı köken başına ~6 bağlantı verir; 4 metadata yazmalarına pay bırakır. */
const ESZAMANLI = 4;
/** Bir `addPackageFiles` çağrısının taşıyacağı satır sayısı (1 MB gövde sınırı). */
const SATIR_OBEGI = 500;
/** Başarısız bir yüklemenin toplam deneme sayısı (ilk deneme dâhil). */
const DENEME = 3;

/**
 * SHA-256 — kopya dosyaları bulmanın tek yolu.
 *
 * WebCrypto'da MD5 yok; kopya kararı için SHA-256 aynı sonucu verir. Bu imza
 * sayesinde BÜKÜM PDF'lerinin DWG altındakilerin aynısı olduğu ve — MTC'de
 * gerçekten olduğu gibi — İKİ FARKLI PARÇANIN aynı PDF'i taşıdığı görülür.
 * Aynı imza artık ikinci kez YÜKLENMEZ de: satır aslın yolunu gösterir.
 */
export async function imzala(file: File): Promise<string> {
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

  let son: { message: string; status: number | null } = {
    message: "bilinmeyen hata",
    status: null,
  };
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

/** Depo hedeflerine baytları yazar; SEBEBİYLE birlikte sonucu döner. */
async function baytlariGonder(hedefler: (UploadTarget & { file: File })[]) {
  const supabase = createClient();
  const basarili: string[] = [];
  const dusen: (Basarisiz & { fileId: string })[] = [];
  let gidenBayt = 0;
  let bitti = 0;

  yuklemeYaz({ ilerleme: { yapilan: 0, toplam: hedefler.length, bayt: 0 } });

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
        yuklemeYaz({
          ilerleme: { yapilan: basarili.length, toplam: hedefler.length, bayt: gidenBayt },
        });
      }
    }
  }
  await Promise.all(Array.from({ length: ESZAMANLI }, isci));
  yuklemeYaz({ ilerleme: { yapilan: basarili.length, toplam: hedefler.length, bayt: gidenBayt } });
  return { basarili, dusen };
}

/**
 * İçe aktarma aşaması — `okunamayan[]` ARTIK OKUNUR.
 *
 * Route bu diziyi ilk günden beri döndürüyordu ama hiçbir çağıran ona
 * bakmıyordu: bozuk ya da indirilemeyen bir dosya sessizce atlanıyor,
 * kullanıcı "her şey okundu" sanıyordu.
 */
async function asamayiKostur(
  packageId: string,
  asamaAdi: "excel" | "pdf" | "dxf",
  adet: number
): Promise<{ ok: boolean; toplam: number; okunamayan: { file: string; reason: string }[] }> {
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
      yuklemeYaz({
        ilerleme: { yapilan: cevap.toplam - cevap.kalan, toplam: cevap.toplam, bayt: 0 },
      });
    }
    if (!cevap.kalan || cevap.sonraki == null) return { ok: true, toplam, okunamayan };
    ofset = cevap.sonraki;
  }
  return { ok: false, toplam, okunamayan };
}

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
 * Klasör seçimi ve İMZALAMA — bu da modülde durur.
 *
 * 454 dosyanın SHA-256'sı dakikalar sürebilir ve o sırada da gezinilebilmeli.
 * `calisiyor` imzalama boyunca da açıktır: gösterge onu "hazırlanıyor" diye
 * yazar ve sekmeyi kapatma uyarısı burada da devrededir — imza kaybolursa
 * kopya tespiti ve dolayısıyla gönderilecek dosya kümesi değişirdi.
 */
export async function dosyalariSec(hepsi: File[]): Promise<void> {
  // SESSİZ DÖNÜŞ YOK. Kullanıcı bir klasör seçtiyse ekranda bir şey olmalı;
  // "tıkladım, hiçbir şey olmadı" bu ekranın en kötü hâlidir ve bir kez
  // yaşandı (canlı FileList temizlenince seçim sıfırlanıyordu).
  if (hepsi.length === 0) {
    toast.error("Klasörden hiç dosya okunamadı. Boş bir klasör seçmiş olabilirsiniz.");
    return;
  }
  if (yuklemeDurumu().calisiyor) {
    toast.warning("Bir yükleme sürüyor; bitmesini bekleyin.");
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
  // Yeni bir klasör seçmek ÖNCEKİ TURU SİLER: eski özet kartı ve hata listesi
  // ekranda kalsaydı, hangi klasöre ait olduğu belirsiz olurdu.
  yuklemeYaz({
    klasorAdi: kok || "Adsız paket",
    sonuc: null,
    basarisiz: [],
    tamamlananPaketId: "",
  });

  const devam = yuklemeDurumu().devam;

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
    yuklemeYaz({ dosyalar: secilen, asama: "onizleme" });
    return;
  }

  yuklemeYaz({
    asama: "imza",
    calisiyor: true,
    ilerleme: { yapilan: 0, toplam: hepsi.length, bayt: 0 },
  });
  try {
    const secilen: SecilenDosya[] = [];
    for (let i = 0; i < hepsi.length; i++) {
      const f = hepsi[i];
      const tam = (f.webkitRelativePath || f.name).normalize("NFC");
      const rel = kok && tam.startsWith(`${kok}/`) ? tam.slice(kok.length + 1) : tam;
      secilen.push({ file: f, relPath: rel, checksum: await imzala(f) });
      if (i % 10 === 0 || i === hepsi.length - 1) {
        yuklemeYaz({ ilerleme: { yapilan: i + 1, toplam: hepsi.length, bayt: 0 } });
        // Tarayıcı 454 dosyalık döngüde donmasın; her onda bir nefes.
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    yuklemeYaz({ dosyalar: secilen, asama: "onizleme" });
  } finally {
    yuklemeYaz({ calisiyor: false });
  }
}

/**
 * Akışın SARMALAYICISI — hiçbir hata ekranı (ya da modülü) kilitleyemez.
 *
 * `yukle()` içindeki sunucu eylemlerinin bir kısmı `{error}` DÖNMEZ, FIRLATIR:
 * `tumSayfalar` PostgREST hatasında `throw` eder ve `asamayiKostur` ham `fetch`
 * kullanır. 107 MB'lık bir yükleme on dakika sürerken ofis hattının bir kez
 * kopması yeterdi: reddi yutan bir çağrı `calisiyor`u sonsuza dek true
 * bırakırdı — dönen bir gösterge, tek bir toast yok, çıkış yolu yok.
 *
 * ÇİFT BAŞLATMA KAPISI DA BURADADIR: modül düzeyinde bir akış, bileşen
 * sökülüp yeniden kurulduğunda ikinci kez tetiklenebilir ve aynı klasör iki
 * paket açardı. `calisiyor` bunu tanımdan siler.
 */
export async function yuklemeyiBaslat(): Promise<void> {
  const bas = yuklemeDurumu();
  if (bas.calisiyor) return;
  if (bas.dosyalar.length === 0) return;

  const kimlik = { packageId: bas.devamPackageId };
  yuklemeYaz({ calisiyor: true, tamamlananPaketId: "" });
  try {
    await yukle(kimlik);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    console.error("[drawings] yükleme akışı düştü", e);
    toast.error(`Yükleme yarıda kaldı: ${mesaj}`, { duration: Infinity, closeButton: true });
    if (kimlik.packageId) {
      // Paket açılmışsa özet ekranına düşülür; oradaki "Eksikleri Yeniden
      // Dene" düğmesi sürdürme kipine götürür ve İKİNCİ BİR PAKET AÇMAZ.
      yuklemeYaz({
        asama: "ozet",
        sonuc: {
          packageId: kimlik.packageId,
          storedCount: 0,
          expectedCount: 0,
          skippedCount: 0,
          storedBytes: 0,
          missing: 0,
          recognitionPct: 0,
          devirOzeti: "",
        },
      });
    } else {
      yuklemeYaz({ asama: "onizleme" });
    }
  } finally {
    yuklemeYaz({ calisiyor: false });
  }
}

async function yukle(kimlik: { packageId: string }) {
  const d = yuklemeDurumu();
  yuklemeYaz({ asama: "yukleme", basarisiz: [] });

  // ————————————————————————————————————— 1. Paket ve dosya satırları
  let packageId = d.devamPackageId;
  let hedefler: (UploadTarget & { file: File })[] = [];

  // SÜRDÜRME KİPİ SESSİZCE "YENİ PAKET AÇ"A DÜŞMEZ.
  //
  // Akış `devam` verisine bakıyordu, `devamPackageId`ye değil:
  // `loadMissingUploads` hata dönerse ya da fırlatırsa `devam` null kalıyor,
  // amber şerit hiç çıkmıyor ve kullanıcı eksikleri tamamladığını sanırken
  // İKİNCİ BİR PAKET açıyordu.
  if (d.devamPackageId && !d.devam) {
    toast.error(
      "Eksik dosya listesi okunamadı; ikinci bir paket açmamak için yükleme başlatılmadı. Sayfayı yenileyip tekrar deneyin.",
      { duration: Infinity, closeButton: true }
    );
    yuklemeYaz({ asama: "onizleme" });
    return;
  }

  if (d.devam) {
    yuklemeYaz({ durumMetni: "Eksik dosyalar hazırlanıyor…" });
    const yolIle = new Map(d.devam.targets.map((t) => [t.relPath, t]));
    hedefler = d.dosyalar
      .map((s) => {
        const t = yolIle.get(s.relPath);
        return t
          ? {
              fileId: t.fileId,
              relPath: t.relPath,
              storagePath: t.storagePath,
              skip: false,
              file: s.file,
            }
          : null;
      })
      .filter((x): x is UploadTarget & { file: File } => x !== null);
  } else {
    yuklemeYaz({ durumMetni: "Paket kaydı açılıyor…" });
    const kayit = await createPackage({
      folderName: d.klasorAdi,
      itemNoOverride: d.kalemNo.trim(),
      supersedesId: d.supersedeKarari === "revizyon" ? d.acikPaket?.id : undefined,
    });
    if (kayit.error || !kayit.packageId) {
      toast.error(kayit.error ?? "Paket kaydı açılamadı.");
      yuklemeYaz({ asama: "onizleme" });
      return;
    }
    packageId = kayit.packageId;
    // Kimliği HEMEN dışarı yaz: bundan sonraki her adım fırlatabilir ve
    // sarmalayıcının elinde bir kurtarma bağlantısı olmalı.
    kimlik.packageId = packageId;

    // SATIRLAR ÖBEK ÖBEK. Hepsi tek gövdede gitseydi 2000 dosyada ~340 KB,
    // 5000 dosyada ~850 KB ederdi ve Server Action gövde sınırı 1 MB'tır.
    const dosyaIle = new Map(d.dosyalar.map((s) => [s.relPath, s.file]));
    for (let i = 0; i < d.dosyalar.length; i += SATIR_OBEGI) {
      yuklemeYaz({
        durumMetni: `Dosya kayıtları yazılıyor… ${Math.min(i + SATIR_OBEGI, d.dosyalar.length)}/${d.dosyalar.length}`,
      });
      const obek = d.dosyalar.slice(i, i + SATIR_OBEGI);
      const cevap = await addPackageFiles({
        packageId,
        files: obek.map((s) => ({
          relPath: s.relPath,
          size: s.file.size,
          checksum: s.checksum,
        })),
      });
      if (cevap.error || !cevap.uploads) {
        toast.error(cevap.error ?? "Dosya kayıtları yazılamadı.", {
          duration: Infinity,
          closeButton: true,
        });
        yuklemeYaz({ asama: "onizleme" });
        return;
      }
      for (const u of cevap.uploads) {
        const f = dosyaIle.get(u.relPath);
        if (f) hedefler.push({ ...u, file: f });
      }
    }

    yuklemeYaz({ durumMetni: "Klasör tanınıyor…" });
    const muhur = await sealPackageFiles({ packageId });
    if (muhur.error) toast.warning(muhur.error);
  }

  // ————————————————————————————————————————————————— 2. Baytlar
  yuklemeYaz({ durumMetni: "Dosyalar yükleniyor…" });
  const { basarili, dusen } = await baytlariGonder(hedefler);
  yuklemeYaz({
    basarisiz: dusen.map(({ relPath, message, status }) => ({ relPath, message, status })),
  });

  // ——————————————————————————————— 3. Sonucu yaz, sonra GERÇEĞİ ÖLÇ
  const kapanis = await finalizeUpload({
    packageId,
    storedFileIds: basarili,
    failed: dusen.map((x) => ({
      fileId: x.fileId,
      message: x.status ? `${x.status} · ${x.message}` : x.message,
    })),
  });
  // DÖNÜŞ OKUNUR. Eski kod `await finalizeUpload(...)` yazıp sonucu hiç
  // kontrol etmiyordu; hata dönse bile ekran başarıya devam ediyordu.
  if (kapanis.error) {
    toast.error(kapanis.error, { duration: Infinity, closeButton: true });
  }

  yuklemeYaz({ asama: "dogrulama", durumMetni: "Depo doğrulanıyor…" });
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
  yuklemeYaz({ asama: "okuma" });
  for (const [ad, anahtar, adet] of [
    ["Excel dosyaları okunuyor…", "excel", 10],
    ["Resim antetleri okunuyor…", "pdf", 20],
    ["Kesim dosyaları okunuyor…", "dxf", 25],
  ] as const) {
    yuklemeYaz({ durumMetni: ad });
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
  yuklemeYaz({ asama: "eslestirme", durumMetni: "Defter kuruluyor…" });
  const es = await reconcilePackage({ packageId });
  if (es.error) toast.error(es.error, { duration: Infinity, closeButton: true });

  // ———————————————————————— 6. Revizyonsa ESKİYİ ŞİMDİ düşür
  //
  // EN SONDA, çünkü yarıda kalan bir revizyon eski paketi düşürseydi atölye
  // bakacak resim bulamazdı. Süperse SİLMEK DEĞİLDİR: eski paket ve bütün
  // dosyaları durur, yalnız listede geri plana düşer.
  let devirOzeti = "";
  if (!d.devam && d.supersedeKarari === "revizyon" && d.acikPaket) {
    yuklemeYaz({ durumMetni: "Üretim kayıtları yeni revizyona taşınıyor…" });
    const devir = await supersedePackage({ packageId, supersedesId: d.acikPaket.id });
    if (devir.error) toast.error(devir.error, { duration: Infinity, closeButton: true });
    else devirOzeti = devir.summary ?? "";
  }

  const eksik = dogrulama.missing ?? dusen.length;
  yuklemeYaz({
    sonuc: {
      packageId,
      storedCount: dogrulama.storedCount ?? 0,
      expectedCount: dogrulama.expectedCount ?? hedefler.length,
      skippedCount: dogrulama.skippedCount ?? 0,
      storedBytes: dogrulama.storedBytes ?? 0,
      missing: eksik,
      recognitionPct: es.recognitionPct ?? 0,
      devirOzeti,
    },
  });

  // EKSİK VARSA RAPORA ATLANMAZ. Özet ekranı çıkar ve `tamamlananPaketId`
  // BOŞ kalır — yani hiçbir taraf sessizce rapora yönlendirmez.
  if (eksik > 0 || dusen.length > 0) {
    yuklemeYaz({ asama: "ozet" });
    toast.error(`${formatNum(eksik)} dosya depoya ulaşmadı. Ayrıntı aşağıda.`, {
      duration: Infinity,
      closeButton: true,
    });
    return;
  }

  toast.success(devirOzeti || `Paket açıldı — sistem %${es.recognitionPct ?? 0}'ini tanıdı.`);
  // YÖNLENDİRMEYİ AKIŞ YAPMAZ. Kullanıcı yükleme sürerken başka bir sayfaya
  // geçmiş olabilir; onu oradan koparıp rapora atmak, arka planda çalışmanın
  // bütün anlamını götürürdü. Akış yalnız "bitti, hedef bu" der; sihirbaz
  // ekrandaysa gider, değilse gösterge bir bağlantı sunar.
  yuklemeYaz({ asama: "ozet", tamamlananPaketId: packageId });
}
