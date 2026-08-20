"use client";

// Paket eylemleri — "Yeniden Eşleştir", "İçerikleri Yeniden Oku",
// "Depoyu Doğrula" ve "Sil".
//
// AYRI MALİYET, AYRI DÜĞME — ve fark her birinin `title`ında yazılı:
//   "Yeniden Eşleştir"       depoya HİÇ dokunmaz, saniyenin altında biter
//   "Depoyu Doğrula"         yalnız LİSTELER, dosya indirmez; saniyeler sürer
//   "İçerikleri Yeniden Oku" her resmi ve DXF'i YENİDEN İNDİRİR, dakikalar sürer
// Tek düğmede birleşselerdi kullanıcı ucuz olanı pahalı sanıp hiç kullanmazdı.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpenCheck, CloudUpload, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { trKatla } from "@/lib/drawings/tr-text";
import { SILME_ONAY_SOZU } from "../schema";
import { deletePackage, reconcilePackage, verifyStorage } from "../actions";

export interface PackageActionsProps {
  packageId: string;
  folderName: string;
  /** Silme onayında NE KAYBEDİLECEĞİNİ sayıyla söylemek için. */
  storedCount: number;
  bytes: number;
  partCount: number;
  /** Üretime girmiş bir paket silinemez — düğme daha tıklanmadan söyler. */
  progressCount: number;
  missing: number;
}

export function PackageActions({
  packageId,
  folderName,
  storedCount,
  bytes,
  partCount,
  progressCount,
  missing,
}: PackageActionsProps) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [silmeAcik, setSilmeAcik] = useState(false);
  const [onayAdi, setOnayAdi] = useState("");

  function yenidenEslestir() {
    basla(async () => {
      const sonuc = await reconcilePackage({ packageId });
      if (sonuc.error) toast.error(sonuc.error);
      else if (sonuc.missing) {
        toast.warning(
          `Defter kuruldu ama ${formatNum(sonuc.missing)} dosya depoda yok — tanıma %${sonuc.recognitionPct ?? 0}.`
        );
      } else toast.success(`Defter yeniden kuruldu — tanıma %${sonuc.recognitionPct ?? 0}.`);
      router.refresh();
    });
  }

  /**
   * Depoyu doğrula — "bayt ulaştı mı" sorusunun TEK YETKİLİ CEVABI.
   *
   * Bucket'ı listeler ve `stored` alanını GERÇEĞE göre yazar. Öncesinde bu alan
   * istemcinin beyanından yazılıyordu: sihirbaz "hata almadım" dediği için
   * `true` oluyordu ve hiçbir şey bunu bir daha sorgulamıyordu.
   */
  function depoyuDogrula() {
    basla(async () => {
      const sonuc = await verifyStorage({ packageId });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      const eksik = sonuc.missing ?? 0;
      const atlanan = sonuc.skippedCount ?? 0;
      const kuyruk = atlanan > 0 ? ` · ${formatNum(atlanan)} dosya atlandı` : "";
      if (eksik > 0) {
        toast.error(
          `${formatNum(eksik)} dosya depoda YOK. ${formatNum(sonuc.storedCount ?? 0)}/${formatNum(sonuc.expectedCount ?? 0)} dosya · ${formatBytes(sonuc.storedBytes ?? 0)}${kuyruk}`,
          { duration: Infinity, closeButton: true }
        );
      } else {
        toast.success(
          `Depo doğrulandı — ${formatNum(sonuc.storedCount ?? 0)}/${formatNum(sonuc.expectedCount ?? 0)} dosya · ${formatBytes(sonuc.storedBytes ?? 0)}${kuyruk}`
        );
      }
      router.refresh();
    });
  }

  /**
   * İçerikleri yeniden oku — PAHALI YOL.
   *
   * "Yeniden Eşleştir"den farkı budur ve düğme metni bunu söylemeli: bu işlem
   * her resmi ve her DXF'i DEPODAN YENİDEN İNDİRİR (bir pakette 270 dosya, ~200
   * MB olabilir). Yalnız içerik okuyucuları değiştiğinde ya da ilk yüklemede
   * okuma yarıda kaldığında gerekir.
   */
  function icerikleriOku() {
    basla(async () => {
      for (const asama of ["pdf", "dxf"] as const) {
        let ofset = 0;
        const okunamayan: { file: string; reason: string }[] = [];
        for (let tur = 0; tur < 200; tur++) {
          const yanit = await fetch(
            `/drawings/${packageId}/import?asama=${asama}&ofset=${ofset}&adet=${asama === "pdf" ? 20 : 25}`,
            { method: "POST" }
          );
          if (!yanit.ok) {
            toast.error(`${asama.toUpperCase()} okuma tamamlanamadı.`);
            return;
          }
          const sonuc = (await yanit.json()) as {
            toplam: number;
            kalan: number;
            sonraki: number | null;
            okunamayan?: { file: string; reason: string }[];
          };
          if (sonuc.okunamayan?.length) okunamayan.push(...sonuc.okunamayan);
          // BOŞ İŞ KÜMESİ BAŞARI DEĞİLDİR. Okunacak hiç dosya yoksa bu bir
          // sonuç değil bir DURUMDUR ve söylenmelidir; sessizce "okundu"
          // demek, depoya hiç ulaşmamış bir paketi başarılı göstermekti.
          if (sonuc.toplam === 0) {
            toast.warning(
              `${asama.toUpperCase()}: okunacak dosya bulunamadı (depoda olan resim/kesim dosyası yok).`
            );
            break;
          }
          if (!sonuc.kalan || sonuc.sonraki == null) break;
          ofset = sonuc.sonraki;
        }
        if (okunamayan.length) {
          const ornek = okunamayan
            .slice(0, 3)
            .map((o) => `${o.file.split("/").pop()} (${o.reason})`)
            .join(" · ");
          toast.error(
            `${asama.toUpperCase()}: ${okunamayan.length} dosya okunamadı — ${ornek}${okunamayan.length > 3 ? " …" : ""}`,
            { duration: Infinity, closeButton: true }
          );
        }
      }
      const es = await reconcilePackage({ packageId });
      if (es.error) toast.error(es.error);
      else toast.success("İçerikler okundu ve defter yenilendi.");
      router.refresh();
    });
  }

  function sil() {
    basla(async () => {
      const sonuc = await deletePackage({ packageId, confirmName: onayAdi });
      if (sonuc.error) {
        toast.error(sonuc.error, { duration: Infinity, closeButton: true });
        return;
      }
      toast.success("Paket için silme talebi Yönetici onayına gönderildi.");
      setSilmeAcik(false);
    });
  }

  // ÜRETİME GİRMİŞ PAKET SİLİNEMEZ ve bu düğmeden anlaşılmalı. Kural asıl olarak
  // veritabanı tetikleyicisindedir (`guard_drawing_package_delete`); buradaki
  // kilit yalnız kullanıcıyı boşuna uğraştırmamak içindir — proje silmedeki
  // `blocked` kalıbının aynısı.
  const kilitli = progressCount > 0;
  // ONAY TEK SÖZCÜKTÜR, paket adı DEĞİL (kullanıcı bildirimi, 12.08.2026).
  // Gerekçe `SILME_ONAY_SOZU`nun tanımında; karşılaştırma sunucudakiyle AYNI
  // yardımcıdan geçer (`trKatla`) ki iki kapı aynı dizgiyi kabul etsin.
  const onayUyuyor = trKatla(onayAdi).trim() === trKatla(SILME_ONAY_SOZU);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={yenidenEslestir}
        disabled={calisiyor}
        title="Dosyalar yeniden indirilmez; yalnız defter ve bulgular yeniden kurulur."
      >
        {calisiyor ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        Yeniden Eşleştir
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={depoyuDogrula}
        disabled={calisiyor}
        title="Bucket'ı listeler ve hangi dosyanın gerçekten orada olduğunu yazar. Dosya indirmez."
      >
        {calisiyor ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
        Depoyu Doğrula
      </Button>

      {missing > 0 && (
        <Button asChild size="sm" variant="outline" className="border-destructive/40 text-destructive">
          <Link href={`/drawings/new?devam=${packageId}`}>
            <CloudUpload className="size-3.5" />
            Eksikleri Yükle ({formatNum(missing)})
          </Link>
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={icerikleriOku}
        disabled={calisiyor}
        title="Her resmi ve DXF'i depodan YENİDEN İNDİRİR — pakette yüzlerce dosya varsa dakikalar sürebilir."
      >
        {calisiyor ? <Loader2 className="size-3.5 animate-spin" /> : <BookOpenCheck className="size-3.5" />}
        İçerikleri Yeniden Oku
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => {
          setOnayAdi("");
          setSilmeAcik(true);
        }}
        disabled={calisiyor}
        title={
          kilitli
            ? "Bu paket üretime girmiş; silinemez."
            : "Paketi, defterini ve bütün depo dosyalarını siler."
        }
      >
        <Trash2 className="size-3.5" />
        Sil
      </Button>

      {silmeAcik && (
        <Dialog open onOpenChange={(o) => !o && setSilmeAcik(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Paketi Sil</DialogTitle>
              <DialogDescription asChild>
                <div className="grid gap-2">
                  {kilitli ? (
                    <p>
                      Bu paket <strong>üretime girmiş</strong>: atölye {formatNum(progressCount)}{" "}
                      üretim kaydı yazmış. Üretime girmiş bir paket bir taslak değil{" "}
                      <strong>arşiv belgesidir</strong> ve silinemez. Yerine{" "}
                      <strong>yeni revizyon</strong> yükleyin — dosyalar yenilenir, atölyenin
                      kaydı korunur.
                    </p>
                  ) : (
                    <>
                      <p>
                        <strong>{formatNum(storedCount)} depo dosyası</strong> (
                        {formatBytes(bytes)}), <strong>{formatNum(partCount)} parça defteri
                        kaydı</strong> ve paketin bütün bulguları için kalıcı silme talebi oluşturulacak.
                      </p>
                      <p>
                        Yanlış bir klasör yüklediyseniz silmek yerine{" "}
                        <strong>yeni revizyon</strong> yüklemeyi düşünün: geçmişi yok etmez.
                      </p>
                      <p>Paket, Yönetici onaylayana kadar değişmeden kalır.</p>
                    </>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            {!kilitli && (
              <div className="grid gap-1.5">
                <Label htmlFor="silOnay">
                  Onaylamak için kutuya{" "}
                  <span className="font-mono text-foreground">{SILME_ONAY_SOZU}</span> yazın:
                </Label>
                <Input
                  id="silOnay"
                  value={onayAdi}
                  onChange={(e) => setOnayAdi(e.target.value)}
                  className="font-mono"
                  autoComplete="off"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onayUyuyor && !calisiyor) sil();
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Silinecek paket:{" "}
                  <span className="font-mono text-foreground">{folderName}</span>
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSilmeAcik(false)}>
                Vazgeç
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={calisiyor || kilitli || !onayUyuyor}
                onClick={sil}
              >
                {calisiyor ? "Gönderiliyor…" : "Silme Talebi Gönder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
