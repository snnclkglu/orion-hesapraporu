"use client";

// TALEP HAVUZU — MANUEL EKLEME (SATIN-21) ve SATIR DÜZELTME (md. 1) pencereleri.
//
// İkisi de saf sunum: değeri `actions.ts`e yollar, kapanır. Anahtar (match_key)
// düzeltmede DEĞİŞMEZ — yalnız görünen tanım/adet override edilir; teklif ve
// sipariş bağı korunur.

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
import { Combobox, type ComboOption } from "@/components/combobox";
import { parseNum } from "@/lib/currency";
import { CONSUMABLE_UNITS } from "@/lib/purchasing/units";
import { createManualDemand, deleteManualDemand, saveDemandOverride } from "./actions";
import { TAM_BOY_PENCERE } from "@/components/pencere";

export function ManualDemandDialog({
  kategoriler,
  qualities,
  tanimlar = [],
  isSecenekleri = [],
  onClose,
  onSaved,
}: {
  kategoriler: string[];
  qualities: string[];
  /** Havuzdaki mevcut tanımlar — dropdown önerisi (md. 4). */
  tanimlar?: string[];
  /** İş kalemi numaraları (İşler bölümünden) — İş No seçimi (md. 4). */
  isSecenekleri?: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [tanim, setTanim] = useState("");
  const [kategori, setKategori] = useState(kategoriler[0] ?? "Diğer");
  const [isNo, setIsNo] = useState("");
  const [adet, setAdet] = useState("");
  const [birim, setBirim] = useState("ADET");
  const [agirlik, setAgirlik] = useState("");
  const [kalite, setKalite] = useState("");
  const [not, setNot] = useState("");

  // KG SEÇİLİRSE MİKTAR = AĞIRLIK (md. 5): kg cinsinden alınan bir kalemde adet
  // ile ağırlık aynı sayıdır; kullanıcı miktarı girer, ağırlık ondan gelir.
  const kgMi = birim === "KG";
  const gorunenAgirlik = kgMi ? adet : agirlik;

  const tanimSecenekleri: ComboOption[] = [
    ...new Set([...tanimlar, tanim].filter(Boolean)),
  ].map((t) => ({ value: t, label: t }));
  const kaliteSecenekleri: ComboOption[] = qualities.map((q) => ({ value: q, label: q }));
  const birimSecenekleri: ComboOption[] = [
    ...new Set([...CONSUMABLE_UNITS, birim].filter(Boolean)),
  ].map((u) => ({ value: u, label: u }));

  function kaydet() {
    if (tanim.trim().length === 0) {
      toast.error("Tanım gerekli.");
      return;
    }
    basla(async () => {
      const sonuc = await createManualDemand({
        sample: tanim,
        category: kategori,
        itemNo: isNo,
        quantity: parseNum(adet),
        unit: birim,
        weightKg: parseNum(gorunenAgirlik),
        quality: kalite,
        note: not,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Talep havuzuna eklendi.");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`sm:max-w-[min(44rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle className="text-base">Yeni Talep Ekle</DialogTitle>
          <DialogDescription className="text-[12px]">
            Teknik resimden gelmeyen bir kalemi elle havuza ekler. Teklif ve sipariş bu satır
            için de açılabilir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Tanımı</Label>
            {/* TANIM DROPDOWN (md. 4): önceki tanımları listeler; yeni tanım
                yazılabilir ("+ Yeni tanım"). */}
            <Combobox
              options={tanimSecenekleri}
              value={tanim || null}
              onChange={setTanim}
              onCreate={(name) => setTanim(name.trim())}
              createLabel="Yeni tanım"
              placeholder="Tanım seçin veya yazın"
              searchPlaceholder="Tanım ara veya yaz…"
              className="text-base pointer-fine:text-sm"
              contentClassName="w-[min(38rem,calc(100vw-1.5rem))]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select value={kategori} onValueChange={setKategori}>
                <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kategoriler.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>İş No (İsteğe Bağlı)</Label>
              {/* İŞ NO İŞLER BÖLÜMÜNDEN (md. 4): kalem bazında seçilir ya da
                  boş bırakılır (ortak alım). Serbest yazım da açık. */}
              <Combobox
                options={isSecenekleri}
                value={isNo || null}
                onChange={setIsNo}
                onCreate={(name) => setIsNo(name.trim())}
                createLabel="Elle iş no"
                placeholder="Seçin veya boş bırakın"
                searchPlaceholder="İş / kalem no ara…"
                className="text-base pointer-fine:text-sm"
                contentClassName="w-[min(30rem,calc(100vw-1.5rem))]"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Marka/Kalite</Label>
              <Combobox
                options={kaliteSecenekleri}
                value={kalite || null}
                onChange={setKalite}
                onCreate={(name) => setKalite(name.trim().toLocaleUpperCase("tr-TR"))}
                createLabel="Yeni marka/kalite"
                placeholder="—"
                searchPlaceholder="Marka/Kalite…"
                className="text-base pointer-fine:text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mt-adet">Miktar</Label>
              <Input
                id="mt-adet"
                value={adet}
                onChange={(e) => setAdet(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                className="text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Birim</Label>
              <Combobox
                options={birimSecenekleri}
                value={birim || null}
                onChange={setBirim}
                onCreate={(name) => setBirim(name.trim().toLocaleUpperCase("tr-TR"))}
                createLabel="Yeni birim"
                placeholder="Birim"
                searchPlaceholder="Birim…"
                className="text-base pointer-fine:text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mt-agirlik">Ağırlık (Kg)</Label>
              <Input
                id="mt-agirlik"
                value={gorunenAgirlik}
                onChange={(e) => setAgirlik(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                disabled={kgMi}
                title={kgMi ? "Birim KG — ağırlık miktarla eşittir" : undefined}
                className="text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mt-not">Not (İsteğe Bağlı)</Label>
            <Input
              id="mt-not"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={500}
              className="text-base pointer-fine:text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={calisiyor || tanim.trim().length === 0}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Havuza Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RowOverrideDialog({
  satirKey,
  tanim,
  adet,
  kategori,
  not,
  manualId,
  kategoriler,
  onClose,
  onSaved,
}: {
  satirKey: string;
  tanim: string;
  adet: number | null;
  kategori: string;
  not: string;
  /** Dolu ise bu satır MANUEL bir taleptir; silinebilir. */
  manualId?: string;
  kategoriler: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [yeniTanim, setYeniTanim] = useState(tanim);
  const [yeniAdet, setYeniAdet] = useState(adet == null ? "" : String(adet));
  const [yeniKategori, setYeniKategori] = useState(kategori);
  const [yeniNot, setYeniNot] = useState(not);

  function kaydet() {
    basla(async () => {
      const sonuc = await saveDemandOverride({
        key: satirKey,
        sample: tanim,
        // Değişmediyse override yazmayalım: aynıysa boş bırak (türetilene dön).
        label: yeniTanim.trim() === tanim.trim() ? "" : yeniTanim,
        qty: parseNum(yeniAdet),
        category: yeniKategori,
        note: yeniNot,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Satır güncellendi.");
      onSaved();
    });
  }

  function sil() {
    if (!manualId) return;
    basla(async () => {
      const sonuc = await deleteManualDemand(manualId);
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Manuel talep silindi.");
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`sm:max-w-[min(38rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <DialogTitle className="text-base">Talebi Düzenle</DialogTitle>
          <DialogDescription className="text-[12px]">
            Otomatik çekilen tanım ya da adet yanlışsa buradan düzeltin. Fiyat arşivi bağı
            değişmez; yalnız havuzda görünen değerler güncellenir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ro-tanim">Tanımı</Label>
            <Input
              id="ro-tanim"
              value={yeniTanim}
              onChange={(e) => setYeniTanim(e.target.value)}
              maxLength={300}
              className="text-base pointer-fine:text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ro-adet">Miktar</Label>
              <Input
                id="ro-adet"
                value={yeniAdet}
                onChange={(e) => setYeniAdet(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                className="text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select value={yeniKategori || "Diğer"} onValueChange={setYeniKategori}>
                <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kategoriler.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ro-not">Not</Label>
            <Input
              id="ro-not"
              value={yeniNot}
              onChange={(e) => setYeniNot(e.target.value)}
              maxLength={500}
              className="text-base pointer-fine:text-sm"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {manualId ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={sil} disabled={calisiyor}>
              <Trash2 className="size-4" /> Talebi Sil
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={kaydet} disabled={calisiyor}>
              {calisiyor && <Loader2 className="size-4 animate-spin" />}
              Kaydet
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
