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
import { Loader2, Trash2 } from "lucide-react";
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
import { createRawManual, deleteRawManual, saveRawMeta } from "./actions";

// ═══════════════════════════════════════════════════ SATIR DÜZELTME

export function RawMetaDialog({
  satir,
  onClose,
  onSaved,
}: {
  satir: HammaddeSatiri;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [tur, setTur] = useState<HammaddeSinifi>(satir.sinif);
  const [ad, setAd] = useState(satir.tanim);
  const [boy, setBoy] = useState(satir.stokBoyuMm == null ? "" : String(satir.stokBoyuMm));
  const [not, setNot] = useState(satir.not);

  const varsayilanBoy = STOK_BOYU_MM[tur];

  function kaydet() {
    basla(async () => {
      const sonuc = await saveRawMeta({
        keys: [satir.kaynakAnahtar],
        samples: [satir.tanim],
        // Sözlükle aynıysa düzeltme YAZILMAZ (boş dizge = kaldır): bir gün
        // sözlük iyileşirse bu satır da onunla birlikte iyileşsin.
        kind: tur === satir.sinif && !satir.sinifElle ? "" : tur,
        // Ad değişmediyse override yazma — türetilene dön.
        label: ad.trim() === satir.tanim.trim() ? "" : ad,
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
      <DialogContent className="sm:max-w-[min(34rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Hammadde Satırını Düzenle</DialogTitle>
          <DialogDescription>
            Düzeltme yalnız GÖRÜNENİ değiştirir; teklif ve sipariş bağı korunur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="hm-tur">Tür</Label>
            <Select value={tur} onValueChange={(v) => setTur(v as HammaddeSinifi)}>
              <SelectTrigger id="hm-tur">
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
            <p className="text-[11px] text-muted-foreground">
              Sözlüğün çıkardığı tür: <strong>{HAMMADDE_ADLARI[satir.sinif]}</strong>
              {satir.sinifElle && " (elle taşınmış)"}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="hm-ad">Stok Kalemi Adı</Label>
            <Input id="hm-ad" value={ad} onChange={(e) => setAd(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="hm-boy">Satın Alma Boyu (mm)</Label>
            <Input
              id="hm-boy"
              inputMode="numeric"
              value={boy}
              onChange={(e) => setBoy(e.target.value)}
              placeholder={varsayilanBoy == null ? "—" : String(varsayilanBoy)}
            />
            <p className="text-[11px] text-muted-foreground">
              Boş bırakılırsa varsayılan kullanılır
              {varsayilanBoy == null
                ? " (bu türde standart boy tanımlı değil)."
                : `: ${formatNum(varsayilanBoy)} mm.`}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="hm-not">Not</Label>
            <Input id="hm-not" value={not} onChange={(e) => setNot(e.target.value)} />
          </div>

          <p className="border bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
            {formatNum(satir.parcaSayisi)} parça · {formatNum(satir.parcaAdedi)} adet
            {satir.toplamAgirlikKg != null &&
              ` · ${formatNum(Math.round(satir.toplamAgirlikKg))} kg`}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <span className="flex gap-2">
            {satir.manualId ? (
              <Button type="button" variant="outline" onClick={manuelSil} disabled={calisiyor}>
                <Trash2 className="size-3.5" />
                Sil
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => haricTut(true)}
                disabled={calisiyor}
                title="Bu kalem hammadde havuzunda görünmesin"
              >
                Havuzdan Çıkar
              </Button>
            )}
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={kaydet} disabled={calisiyor}>
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
  onClose,
  onSaved,
}: {
  isler: { id: string; itemNos: string[]; label: string }[];
  qualities: string[];
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
      <DialogContent className="sm:max-w-[min(38rem,calc(100%-2rem))]">
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

          <div className="grid gap-1.5">
            <Label htmlFor="hmm-ad">Stok Kalemi Adı</Label>
            <Input
              id="hmm-ad"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              placeholder="SAC 15 MM S355JR"
            />
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
