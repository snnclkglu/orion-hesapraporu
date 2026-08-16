"use client";

// HAMMADDE PENCERELERİ — satır düzeltme ve elle talep açma.
//
// İkisi de saf sunumdur: değeri `actions.ts`e yollar ve kapanır.
//
// DÜZELTME ANAHTARI DEĞİŞTİRMEZ: yalnız GÖRÜNEN sınıf, ad, stok boyu ve not
// ezilir. Teklif ve sipariş bağı `match_key` üzerinden kurulu ve o anahtar
// çözücünün ürettiği hâliyle sabit kalır (`purchase_item_meta` deseninin
// aynısı — md. 21).

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/combobox";
import { parseNum } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import type { HammaddeSatiri } from "@/lib/purchasing/hammadde/havuz";
import {
  CELIK_OZKUTLE_KG_MM3,
  HAMMADDE_ADLARI,
  HAMMADDE_SINIFLARI,
  STOK_BOYU_MM,
  type HammaddeSinifi,
} from "@/lib/purchasing/hammadde/siniflar";
import { PROFIL_KESITLERI } from "@/lib/purchasing/hammadde/profil-kesitleri";
import type { HammaddeOlcusu } from "@/lib/purchasing/hammadde/cozumle";
import {
  OLCU_ETIKETLERI,
  duzenlenebilirOlculer,
  tanimiOlcuyleYaz,
  type OlcuAlani,
} from "@/lib/purchasing/hammadde/olcu-duzelt";
import { TAM_BOY_PENCERE } from "../pencere";
import {
  createRawManual,
  deleteRawManual,
  moveRawToEquipment,
  saveRawMeta,
  saveRawPartDims,
} from "./actions";

// ═══════════════════════════════════════════════════ SATIR DÜZELTME

export function RawMetaDialog({
  satir,
  qualities = [],
  onClose,
  onSaved,
}: {
  satir: HammaddeSatiri;
  /** Marka/kalite öneri listesi — ekipman tarafıyla ORTAK defter. */
  qualities?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [tur, setTur] = useState<HammaddeSinifi>(satir.sinif);
  const [ad, setAd] = useState(satir.tanim);
  const [kalite, setKalite] = useState(satir.kalite);
  const [adet, setAdet] = useState(satir.parcaAdedi > 0 ? String(satir.parcaAdedi) : "");
  const [boy, setBoy] = useState(satir.stokBoyuMm == null ? "" : String(satir.stokBoyuMm));
  const [not, setNot] = useState(satir.not);

  const varsayilanBoy = STOK_BOYU_MM[tur];
  const turetilen = satir.turetilenAdet ?? satir.parcaAdedi;

  function kaydet() {
    basla(async () => {
      const yeniAdet = parseNum(adet);
      const sonuc = await saveRawMeta({
        keys: [satir.kaynakAnahtar],
        samples: [satir.tanim],
        // Sözlükle aynıysa düzeltme YAZILMAZ (boş dizge = kaldır): bir gün
        // sözlük iyileşirse bu satır da onunla birlikte iyileşsin.
        kind: tur === satir.sinif && !satir.sinifElle ? "" : tur,
        // Ad değişmediyse override yazma — türetilene dön.
        label: ad.trim() === satir.tanim.trim() ? "" : ad,
        quality: kalite.trim() === satir.kalite.trim() && !satir.kaliteElle ? "" : kalite,
        // ADET TÜRETİLENLE AYNIYSA EZİLMEZ: paket yeniden yüklendiğinde sayı
        // kendiliğinden güncellensin. Dondurulmuş bir "40", ertesi hafta 60
        // parçaya çıkan bir işi 40'ta bırakırdı.
        qty: yeniAdet == null || yeniAdet === turetilen ? 0 : yeniAdet,
        note: not,
        stockLengthMm: parseNum(boy) ?? 0,
        excluded: null,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Satır güncellendi.");
      onSaved();
    });
  }

  /**
   * EKİPMANA TAŞI — satır hammadde değil, satın alınan bir üründür.
   *
   * Kullanıcı isteği: *"Diğer kısmında kaplin rulman gibi ekipmanları benim
   * Ekipman tarafına taşıyabilmem lazım."* Kaplin ve rulman Excel'de PARÇA
   * KODU taşıdığı için bölme kuralı onları üretim tarafına yolluyor; karar
   * insanındır ve iki havuzda birden geçerlidir.
   */
  function ekipmanaTasi(tasi: boolean) {
    basla(async () => {
      const sonuc = await moveRawToEquipment({
        key: satir.kaynakAnahtar,
        sample: satir.tanim,
        hamTanimlar: [...new Set(satir.parcalar.map((p) => p.tanim).filter(Boolean))],
        tasi,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(
        tasi ? "Kalem Ekipman havuzuna taşındı." : "Kalem hammadde havuzuna geri alındı."
      );
      onSaved();
    });
  }

  function haricTut(deger: boolean) {
    basla(async () => {
      const sonuc = await saveRawMeta({
        keys: [satir.kaynakAnahtar],
        samples: [satir.tanim],
        kind: null,
        label: null,
        note: null,
        stockLengthMm: null,
        excluded: deger,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(deger ? "Kalem havuzdan çıkarıldı." : "Kalem havuza geri alındı.");
        onSaved();
      }
    });
  }

  function manuelSil() {
    if (!satir.manualId) return;
    basla(async () => {
      const sonuc = await deleteRawManual(satir.manualId!);
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Elle açılan talep silindi.");
        onSaved();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onClose()}>
      {/* ══════════════════════════════════ HİZA DÜZELTMESİ (15.08.2026)
          Kullanıcı bildirimi: *"Hammadde Satırını Düzenle adlı pop-up'ta
          kaymalar var."* Üç sebebi vardı ve üçü de burada kapanır:

          1. `Combobox` bir DÜĞMEdir, `Input` bir ALANdır ve taban yükseklikleri
             farklıdır — yan yana konduklarında biri ötekinden alçak duruyordu.
             İkisi de artık `h-10` verir.
          2. Yardımcı satırlar (`Resimlerden türetilen…`) yalnız BİR sütunun
             altındaydı; ızgara satırı o yüzden asimetrik büyüyordu. Yardımcı
             metinler artık kendi sabit satırlarındadır.
          3. Altbilgideki `sm:justify-between` dört düğmeyi iki kümeye bölüyor,
             dar pencerede kümeler ayrı satırlara düşüp hizayı bozuyordu.
             Yıkıcı/taşıyıcı eylemler kendi bölümüne alındı; altbilgide yalnız
             Vazgeç + Kaydet kaldı. */}
      <DialogContent className={`sm:max-w-[min(40rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle>Hammadde Satırını Düzenle</DialogTitle>
          <DialogDescription>
            Düzeltme yalnız GÖRÜNENİ değiştirir; teklif ve sipariş bağı korunur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="hm-ad">Stok Kalemi Adı</Label>
              <Input
                id="hm-ad"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="hm-tur">Tür</Label>
              <Select value={tur} onValueChange={(v) => setTur(v as HammaddeSinifi)}>
                <SelectTrigger id="hm-tur" className="h-10! w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAMMADDE_SINIFLARI.map((s) => (
                    <SelectItem key={s} value={s}>
                      {HAMMADDE_ADLARI[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-muted-foreground">
            Sözlüğün çıkardığı tür: <strong>{HAMMADDE_ADLARI[satir.sinif]}</strong>
            {satir.sinifElle && " (elle taşınmış)"}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid content-start gap-1.5">
              <Label>Kalite</Label>
              <Combobox
                options={qualities.map((q) => ({ value: q, label: q }))}
                value={kalite || null}
                onChange={setKalite}
                onCreate={(v) => setKalite(v)}
                placeholder="S235JR…"
                createLabel="Ekle"
                className="h-10"
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="hm-adet">Adet</Label>
              <Input
                id="hm-adet"
                inputMode="numeric"
                value={adet}
                onChange={(e) => setAdet(e.target.value)}
                className="h-10 text-right font-mono tabular-nums"
              />
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="hm-boy">Satın Alma Boyu (mm)</Label>
              <Input
                id="hm-boy"
                inputMode="numeric"
                value={boy}
                onChange={(e) => setBoy(e.target.value)}
                placeholder={varsayilanBoy == null ? "—" : String(varsayilanBoy)}
                className="h-10 text-right font-mono tabular-nums"
              />
            </div>
          </div>
          <p className="-mt-1 grid gap-0.5 text-[11px] text-muted-foreground">
            <span>
              Resimlerden türetilen adet: <strong>{formatNum(turetilen)}</strong>
              {satir.adetElle && " · şu an elle ezilmiş"}
            </span>
            <span>
              Boy boş bırakılırsa varsayılan kullanılır
              {varsayilanBoy == null
                ? " (bu türde standart boy tanımlı değil)."
                : `: ${formatNum(varsayilanBoy)} mm.`}
            </span>
          </p>

          <div className="grid gap-1.5">
            <Label htmlFor="hm-not">Not</Label>
            <Input
              id="hm-not"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              className="h-10"
            />
          </div>

          <p className="border bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
            {formatNum(satir.parcaSayisi)} parça · {formatNum(satir.parcaAdedi)} adet
            {satir.toplamAgirlikKg != null &&
              ` · ${formatNum(Math.round(satir.toplamAgirlikKg))} kg`}
          </p>

          {/* YIKICI VE TAŞIYICI EYLEMLER KENDİ BÖLÜMÜNDE: altbilgide dört düğme
              yan yana durduğunda dar pencerede kümeler ayrı satırlara düşüyor
              ve "Kaydet" bir yıkıcı düğmenin yanında kalıyordu. */}
          <div className="grid gap-2 border border-dashed px-3 py-2">
            <p className="oc-kicker text-[10px] text-muted-foreground">Bu Satır İçin</p>
            <div className="flex flex-wrap gap-2">
              {satir.manualId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={manuelSil}
                  disabled={calisiyor}
                >
                  <Trash2 className="size-3.5" />
                  Talebi Sil
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => ekipmanaTasi(true)}
                    disabled={calisiyor}
                    title="Bu kalem bir hammadde değil, satın alınan bir ürün"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    Ekipmana Taşı
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => haricTut(true)}
                    disabled={calisiyor}
                    title="Bu kalem hammadde havuzunda görünmesin"
                  >
                    Havuzdan Çıkar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor}>
            {calisiyor && <Loader2 className="size-3.5 animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════ PARÇA ÖLÇÜSÜ DÜZELTME

/**
 * BİR KESİM PARÇASININ ÖLÇÜSÜNÜ (VE ADINI) DEĞİŞTİRİR.
 *
 * Kullanıcı kararı (15.08.2026): *"Hammadde havuzuna düşen kalemlerin en boy
 * uzunluk ölçülerini düzenleyebilmek istiyorum … hem parça ismi değişsin
 * böylece."*
 *
 * DÜZENLENEN ŞEY RESİMDEKİ ÖLÇÜDÜR, satın alma ölçüsü değil: metinde yazan
 * sayı odur ve pay (ressamınki ya da firma kuralı) onun üstüne HER OKUMADA
 * yeniden uygulanır. Pencere ikisini birden gösterir — düzeltilen Ø90'ın yine
 * Ø95 sipariş edileceği ekranda görünmelidir.
 *
 * ÖNİZLEME KAYDETMEDEN ÖNCE GELİR: yeni tanım (yani parçanın yeni adı) canlı
 * yazılır. Ad bir yan etki değil, düzeltmenin KENDİSİdir.
 */
export function RawPartDimsDialog({
  parca,
  sinif,
  onClose,
  onSaved,
}: {
  parca: {
    /** `parcaOlcuAnahtari(itemNo, partCode)` — çağıran üretir. */
    anahtar: string;
    tanim: string;
    hamTanim: string;
    olcuElle: boolean;
    kalinlikMm: number | null;
    enMm: number | null;
    boyMm: number | null;
    disCapMm: number | null;
    icCapMm: number | null;
    resimDisCapMm: number | null;
    resimBoyMm: number | null;
  };
  sinif: HammaddeSinifi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();

  /** Resimdeki ölçü — pay UYGULANMAMIŞ hâl; metinde yazan sayılar bunlar. */
  const mevcut: HammaddeOlcusu = {
    kalinlikMm: parca.kalinlikMm,
    enMm: parca.enMm,
    boyMm: parca.resimBoyMm ?? parca.boyMm,
    disCapMm: parca.resimDisCapMm ?? parca.disCapMm,
    icCapMm: parca.icCapMm,
  };

  const alanlar = duzenlenebilirOlculer(sinif, mevcut);
  const [degerler, setDegerler] = useState<Record<string, string>>(() =>
    Object.fromEntries(alanlar.map((a) => [a, mevcut[a] == null ? "" : String(mevcut[a])]))
  );

  const yeni: Partial<Record<OlcuAlani, number | null>> = Object.fromEntries(
    alanlar.map((a) => [a, parseNum(degerler[a] ?? "")])
  );
  const sonuc = tanimiOlcuyleYaz(parca.tanim, sinif, mevcut, yeni);
  const degisti = sonuc.tanim.trim() !== parca.tanim.trim();

  function kaydet(geriAl = false) {
    basla(async () => {
      const cevap = await saveRawPartDims({
        partKey: parca.anahtar,
        sample: parca.hamTanim,
        label: geriAl ? "" : sonuc.tanim,
      });
      if (cevap.error) {
        toast.error(cevap.error);
        return;
      }
      toast.success(geriAl ? "Ölçü düzeltmesi kaldırıldı." : "Parça ölçüsü güncellendi.");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onClose()}>
      <DialogContent className={`sm:max-w-[min(38rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle>Parça Ölçüsünü Düzelt</DialogTitle>
          <DialogDescription>
            Ölçü değişince parçanın ADI da değişir; satır havuzda kırmızı görünür.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {alanlar.length === 0 ? (
            <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
              Bu parçanın tanımından okunabilen bir ölçü yok, bu yüzden düzeltilecek bir sayı da
              yok. Adı doğrudan düzeltmek için stok kalemi satırını kullanın.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {alanlar.map((a) => (
                <div key={a} className="grid content-start gap-1.5">
                  <Label htmlFor={`po-${a}`}>{OLCU_ETIKETLERI[a]}</Label>
                  <Input
                    id={`po-${a}`}
                    inputMode="decimal"
                    value={degerler[a] ?? ""}
                    onChange={(e) => setDegerler((o) => ({ ...o, [a]: e.target.value }))}
                    className="h-10 text-right font-mono tabular-nums"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Resimde: {mevcut[a] == null ? "—" : formatNum(mevcut[a] as number, 1)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {sonuc.yazilamayan.length > 0 && (
            <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
              Şu ölçünün tanımda karşılığı bulunamadı ve yazılamadı:{" "}
              {sonuc.yazilamayan.map((a) => OLCU_ETIKETLERI[a]).join(", ")}. Tanımı elle düzeltmek
              gerekir.
            </p>
          )}

          <div className="grid gap-1 border bg-muted/40 px-3 py-2 font-mono text-[12px]">
            <span className="oc-kicker text-[10px] text-muted-foreground">Yeni Parça Adı</span>
            <span className={degisti ? "font-medium text-destructive" : "text-muted-foreground"}>
              {sonuc.tanim}
            </span>
            {(degisti || parca.olcuElle) && (
              <span className="text-[11px] text-muted-foreground line-through">
                {parca.hamTanim}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <span>
            {parca.olcuElle && (
              <Button
                type="button"
                variant="outline"
                onClick={() => kaydet(true)}
                disabled={calisiyor}
                title="Ressamın yazdığı ölçüye geri dön"
              >
                <RotateCcw className="size-3.5" />
                Düzeltmeyi Kaldır
              </Button>
            )}
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => kaydet(false)} disabled={calisiyor || !degisti}>
              {calisiyor && <Loader2 className="size-3.5 animate-spin" />}
              Kaydet
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════ ELLE HAMMADDE TALEBİ

/** Türe göre hangi ölçü alanları sorulur — boş alan SORULMAZ, gösterilmez. */
const ALANLAR: Record<HammaddeSinifi, ("kalinlik" | "en" | "boy" | "dis" | "ic")[]> = {
  SAC: ["kalinlik", "en", "boy"],
  PROFIL: ["boy"],
  RAY: ["boy"],
  DOLU: ["dis", "boy"],
  BORU: ["dis", "ic", "boy"],
  DIGER: ["boy"],
};

const ETIKET: Record<string, string> = {
  kalinlik: "Kalınlık (mm)",
  en: "En (mm)",
  boy: "Boy (mm)",
  dis: "Ø Dış (mm)",
  ic: "Ø İç (mm)",
};

export function RawManualDialog({
  isler,
  qualities,
  stokAdlari = [],
  onClose,
  onSaved,
}: {
  isler: { id: string; itemNos: string[]; label: string }[];
  qualities: string[];
  /**
   * HAVUZDA HÂLİHAZIRDA BULUNAN STOK KALEMİ ADLARI.
   *
   * Kullanıcı isteği (15.08.2026): *"Stok kalemi adı öncekiler dropdown gelsin.
   * Kullanıcı isterse hemen orada yeni ekleyebilsin."* Liste bir defter değil,
   * HAVUZUN KENDİSİDİR: ikinci bir ad defteri tutmak, elle açılan talebin
   * adının türetilmiş satırın adından ayrışmasının en kısa yoluydu — ve
   * ayrışırlarsa aynı malzeme havuzda iki satır olurdu.
   */
  stokAdlari?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [tur, setTur] = useState<HammaddeSinifi>("SAC");
  const [ad, setAd] = useState("");
  const [kesit, setKesit] = useState("");
  const [kalite, setKalite] = useState("");
  const [isNo, setIsNo] = useState("");
  const [adet, setAdet] = useState("1");
  const [not, setNot] = useState("");
  const [olcu, setOlcu] = useState<Record<string, string>>({});

  const kesitSecenekleri = PROFIL_KESITLERI.map((k) => ({
    value: k.kod,
    label: k.kod,
    hint: `${k.kgPerM} kg/m`,
  }));
  const isSecenekleri = isler.flatMap((j) =>
    j.itemNos.map((n) => ({ value: n, label: `${n} · ${j.label}` }))
  );

  const s = (k: string) => parseNum(olcu[k] ?? "");
  const adetSayi = parseNum(adet);

  /**
   * AĞIRLIK CANLI HESAPLANIR VE GÖSTERİLİR.
   *
   * Kullanıcı bir sac girerken kaç kilo ettiğini kaydetmeden önce görmelidir:
   * yanlış girilmiş bir sıfır ancak orada fark edilir. Hesap kaydedilen değeri
   * ÜRETİR — ekranda bir sayı, kayıtta başka bir sayı olmaz.
   */
  const agirlik = (() => {
    const n = adetSayi ?? 0;
    if (n <= 0) return null;
    const r = CELIK_OZKUTLE_KG_MM3;
    if (tur === "SAC") {
      const t = s("kalinlik");
      const e = s("en");
      const b = s("boy");
      return t && e && b ? t * e * b * r * n : null;
    }
    if (tur === "DOLU") {
      const d = s("dis");
      const b = s("boy");
      return d && b ? (Math.PI / 4) * d * d * b * r * n : null;
    }
    if (tur === "BORU") {
      const d = s("dis");
      const i = s("ic");
      const b = s("boy");
      return d && i && b && d > i ? (Math.PI / 4) * (d * d - i * i) * b * r * n : null;
    }
    if ((tur === "PROFIL" || tur === "RAY") && kesit) {
      const k = PROFIL_KESITLERI.find((x) => x.kod === kesit);
      const b = s("boy");
      return k && b ? (k.kgPerM * b * n) / 1000 : null;
    }
    return null;
  })();

  function kaydet() {
    basla(async () => {
      const sonuc = await createRawManual({
        sample: ad,
        kind: tur,
        itemNo: isNo,
        sectionCode: kesit,
        quality: kalite,
        thicknessMm: s("kalinlik"),
        widthMm: s("en"),
        lengthMm: s("boy"),
        outerDiaMm: s("dis"),
        innerDiaMm: s("ic"),
        qty: adetSayi,
        unit: "Adet",
        weightKg: agirlik == null ? null : Math.round(agirlik * 1000) / 1000,
        note: not,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Hammadde talebi açıldı.");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(a) => !a && onClose()}>
      <DialogContent className={`sm:max-w-[min(38rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle>Yeni Hammadde Talebi</DialogTitle>
          <DialogDescription>
            Hiçbir teknik resimden gelmeyen malzeme ihtiyacı — havuza ek satır olarak katılır.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="hmm-tur">Tür</Label>
              <Select value={tur} onValueChange={(v) => setTur(v as HammaddeSinifi)}>
                <SelectTrigger id="hmm-tur">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HAMMADDE_SINIFLARI.map((x) => (
                    <SelectItem key={x} value={x}>
                      {HAMMADDE_ADLARI[x]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hmm-kalite">Kalite</Label>
              <Combobox
                options={qualities.map((q) => ({ value: q, label: q }))}
                value={kalite || null}
                onChange={setKalite}
                onCreate={(v) => setKalite(v)}
                placeholder="S235JR…"
                createLabel="Ekle"
              />
            </div>
          </div>

          {/* STOK KALEMİ ADI ÖNCE LİSTEDEN SEÇİLİR (15.08.2026). Serbest metin
              kutusu aynı malzemeyi iki ayrı satıra bölüyordu ("SAC 20 MM
              S355JR" ile "SAC 20MM S355JR" ayrı anahtarlardır); `Combobox`
              önce havuzdaki adı önerir, aradığı yoksa kullanıcı yazdığı adı
              "+ Yeni stok kalemi" ile aynı yerde açar. */}
          <div className="grid gap-1.5">
            <Label>Stok Kalemi Adı</Label>
            <Combobox
              options={stokAdlari.map((s) => ({ value: s, label: s }))}
              value={ad || null}
              onChange={setAd}
              onCreate={(v) => setAd(v.toLocaleUpperCase("tr-TR"))}
              placeholder="SAC 15 MM S355JR"
              searchPlaceholder="Stok kalemi ara…"
              createLabel="Yeni stok kalemi"
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Listedeki bir adı seçerseniz talep o stok kalemiyle BİRLEŞİR; yeni bir ad
              yazarsanız kendi satırı açılır.
            </p>
          </div>

          {(tur === "PROFIL" || tur === "RAY") && (
            <div className="grid gap-1.5">
              <Label>Kesit</Label>
              <Combobox
                options={kesitSecenekleri}
                value={kesit || null}
                onChange={setKesit}
                onCreate={(v) => setKesit(v)}
                placeholder="UPN 100 · IPN 280 · L 100 x 100 x 8…"
                searchPlaceholder="Kesit ara…"
                createLabel="Kendi kesitim"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            {ALANLAR[tur].map((k) => (
              <div key={k} className="grid gap-1.5">
                <Label htmlFor={`hmm-${k}`}>{ETIKET[k]}</Label>
                <Input
                  id={`hmm-${k}`}
                  inputMode="decimal"
                  value={olcu[k] ?? ""}
                  onChange={(e) => setOlcu((o) => ({ ...o, [k]: e.target.value }))}
                />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label htmlFor="hmm-adet">Adet</Label>
              <Input
                id="hmm-adet"
                inputMode="numeric"
                value={adet}
                onChange={(e) => setAdet(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>İş No</Label>
              <Combobox
                options={isSecenekleri}
                value={isNo || null}
                onChange={setIsNo}
                placeholder="Bağlanmasın"
                searchPlaceholder="İş kalemi ara…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hmm-not">Not</Label>
              <Input id="hmm-not" value={not} onChange={(e) => setNot(e.target.value)} />
            </div>
          </div>

          <p className="border bg-muted/40 px-2 py-1.5 font-mono text-[12px]">
            {agirlik == null ? (
              <span className="text-muted-foreground">
                Ağırlık ölçülerden hesaplanır — eksik ölçüde boş kalır.
              </span>
            ) : (
              <>
                Hesaplanan ağırlık: <strong>{formatNum(agirlik, 1)} kg</strong>
                <span className="ml-2 text-muted-foreground">(7,85 g/cm³)</span>
              </>
            )}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor || ad.trim().length < 2}>
            {calisiyor && <Loader2 className="size-3.5 animate-spin" />}
            Talebi Aç
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
