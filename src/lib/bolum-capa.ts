"use client";

// ÇIPA GEZİNMESİ — bölüm rayının İKİNCİ kipi.
//
// `BolumRayi`nin ilk dört tüketicisi (hesap raporu · teklif · maliyet · el
// kitabı) ANAHTARLAMALI editörlerdir: aynı anda DOM'da tek bölüm vardır, o
// yüzden "bölüme git" bir durum değişimidir ve kaydırılacak bir çıpa yoktur.
//
// Uzun kaydırmalı sayfalarda (personel profili gibi) bütün bölümler aynı anda
// DOM'dadır ve "bölüme git" GERÇEK bir kaydırmadır. Bu dosya o farkı tek yerde
// kapatır; `BolumRayi` ikisini de bilmez, yalnız `aktifId` alır ve `onSec`
// çağırır.
//
// DEPODA BUNUN BAŞKA ÖRNEĞİ YOKTU: `IntersectionObserver` yalnız korumalı PDF
// görüntüleyicisinde (yaprak tembelliği), `scroll-margin` ise HİÇ kullanılmıyordu.
// İkisini de burada kurup tek noktada tutmak, bir sonraki uzun sayfanın kendi
// sürümünü yazmasını engeller.

import { useEffect, useState } from "react";
import { CAPA_ONEKI, capaKimligi } from "./bolum-capa-kimlik";

// Kimlik üreticisi SAF bir modüldedir (`bolum-capa-kimlik.ts`): sunucu
// bileşenleri de çıpa sarmalayıcısı basıyor ve `"use client"` sınırının
// ötesinden gelen bir işlevi sunucuda ÇAĞIRAMAZLAR. Buradan yeniden dışa
// verilir, yani çağrı yerleri değişmez.
export { CAPA_ONEKI, capaKimligi };

/**
 * Bölüme kaydır.
 *
 * Hedefin `.oc-capa` sınıfı olmalıdır: `scroll-margin-top` yoksa bölüm başlığı
 * YAPIŞKAN SAYFA BAŞLIĞININ ALTINA girer ve kullanıcı doğru yere geldiğini
 * göremez. Pay `--app-header-h`ten okunur, 48px varsayılmaz.
 *
 * GÖVDE KİLİDİ BEKLENİR — ölçülmüş hata (01.09.2026): ray tabakası açıkken
 * `useOverlay` `body { overflow: hidden }` yazar ve kilit dururken
 * `scrollIntoView` SESSİZCE hiçbir şey yapmaz. Seçim tabakayı kapatır ama
 * kilidin kalkması React'in pasif efekt temizliğine, yani boyamadan SONRAYA
 * kalır; kilidin gerçekten kalktığı an beklenir. Üst sınır, kilit bir şekilde
 * hiç kalkmazsa sonsuz döngü olmasın diyedir.
 *
 * BEKLEME `setTimeout` İLE, `requestAnimationFrame` İLE DEĞİL: sekme arka
 * planda ya da gizliyken rAF HİÇ ateşlenmez (aynı tuzak tarayıcı panelinde de
 * ölçüldü) ve kaydırma sessizce asılı kalırdı. `setTimeout` kısılır ama ateşler.
 */
export function capayaGit(id: string): void {
  let kalanDeneme = 20;
  const dene = () => {
    if (document.body.style.overflow === "hidden" && kalanDeneme-- > 0) {
      setTimeout(dene, 16);
      return;
    }
    document
      .getElementById(capaKimligi(id))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  setTimeout(dene, 0);
}

/**
 * Görünür bölümü izler ve rayın aktif satırını döndürür.
 *
 * İKİNCİ DÖNÜŞ DEĞERİ ELLE İŞARETLEMEK İÇİNDİR ve gerekliliği ölçülmüştür:
 * `IntersectionObserver` sekme arka planda ya da gizliyken HİÇ ateşlemez
 * (tarayıcı panelinde bağımsız bir gözcüyle doğrulandı). Gözcü tek kaynak
 * olsaydı kullanıcı bir bölüm seçtiğinde ray onu yakmayabilirdi. Seçim anında
 * elle işaretlemek doğru cevabı HEMEN verir; gözcü sonra kaydırmayı izleyip
 * inceltir.
 *
 * ÜST BANT DAR TUTULUR (`-20% … -70%`): ölçüt "ekranda görünüyor mu" değil,
 * "okuduğum yerde mi" olmalıdır. Tam kaplayan bir bant uzun bir bölümün
 * ardından gelen kısa bölümü de eşzamanlı işaretler ve ray iki satır arasında
 * titrer. Dar bantta her an tek bir bölüm aday olur.
 *
 * Bağımlılık `idler` DİZİSİ DEĞİL, birleştirilmiş METİNDİR: çağıran her
 * boyamada yeni bir dizi üretir ve dizi kimliğine bağlanan bir efekt gözcüyü
 * her boyamada söküp takardı.
 */
export function useAktifCapa(
  idler: readonly string[]
): [string | null, (id: string) => void] {
  const anahtar = idler.join("|");
  const [aktif, setAktif] = useState<string | null>(idler[0] ?? null);

  useEffect(() => {
    const liste = anahtar === "" ? [] : anahtar.split("|");
    const ogeler = liste
      .map((id) => document.getElementById(capaKimligi(id)))
      .filter((el): el is HTMLElement => el !== null);
    if (ogeler.length === 0) return;

    const gorunur = new Set<string>();
    const gozcu = new IntersectionObserver(
      (girdiler) => {
        for (const g of girdiler) {
          const id = g.target.id.slice(CAPA_ONEKI.length);
          if (g.isIntersecting) gorunur.add(id);
          else gorunur.delete(id);
        }
        // BELGE SIRASINDAKİ İLK aday seçilir: kullanıcı aşağı kaydırırken bir
        // sonraki bölüm banda girdiği anda değil, ÖNCEKİ banttan çıktığında
        // atlamalı — sıraya göre okumak bunu bedavaya verir.
        const ilk = liste.find((id) => gorunur.has(id));
        if (ilk) setAktif(ilk);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    for (const el of ogeler) gozcu.observe(el);
    return () => gozcu.disconnect();
  }, [anahtar]);

  return [aktif, setAktif];
}
