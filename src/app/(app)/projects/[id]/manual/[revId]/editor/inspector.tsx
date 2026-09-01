"use client";

// MÜFETTİŞ — sağ panel, SEÇİLİ BLOĞUN ayarları.
//
// NEDEN AYRI PANEL: uyarı düzeyi, görsel genişliği ve otomatik tablo varyantı
// SEYREK dokunulan ama VARLIĞI bilinmesi gereken ayarlardır. Tomar'a
// gömülselerdi her blok bir ayar kutusuna dönüşür ve belge okunmaz olurdu;
// tamamen gizlenselerdi kullanıcı görselin sayfaya yayılabildiğini hiç
// öğrenmezdi.
//
// BLOK SEÇİLİ DEĞİLKEN BÖLÜMÜN kimliği gösterilir: kullanıcı belgenin
// neresinde olduğunu ve o bölümün kapsam içindeki yerini buradan görür.

import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MANUAL_AUTO_LABELS,
  MANUAL_EQUIPMENT_VARIANTS,
  MANUAL_EQUIPMENT_VARIANT_LABELS,
  MANUAL_NOTE_LABELS,
  MANUAL_NOTE_LEVELS,
  MANUAL_NOTE_MEANING,
  type ManualBlock,
  type ManualNoteLevel,
} from "@/lib/manual/types";
import type { NumberedSection } from "@/lib/manual/payload";

export function Inspector({
  bolum,
  blok,
  yazilabilir,
  onBlokDegis,
  onBlokGizle,
  onBolumGizle,
}: {
  bolum: NumberedSection | null;
  blok: ManualBlock | null;
  yazilabilir: boolean;
  onBlokDegis: (f: (b: ManualBlock) => ManualBlock) => void;
  onBlokGizle: () => void;
  onBolumGizle: () => void;
}) {
  if (!bolum) {
    return <p className="text-sm text-muted-foreground">Bir bölüm seçin.</p>;
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* ————————————————————————————————————————————————— bölüm */}
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Bölüm</p>
        <p className="font-medium">
          <span className="font-mono text-xs text-muted-foreground">{bolum.number || "EK"}</span>{" "}
          {bolum.title}
        </p>
        {bolum.key ? (
          <code className="text-xs text-muted-foreground">{bolum.key}</code>
        ) : (
          <span className="text-xs text-muted-foreground">
            Serbest bölüm — kapsam paketi buna karışmaz.
          </span>
        )}
        {/* EK BÖLÜMÜ DE GİZLENEBİLİR (01.09.2026). Eski `!s.appendix`
            kapısı kullanıcının "tam teknikten projeleri çıkarayım"
            isteğini imkânsız kılıyordu; oysa çekirdek hazırdı —
            `manualAppendixOrder` `printedManual`ı okur, yani ek
            bölümünü gizlemek eki PDF'ten de düşürür (KITAP-6/8). */}
        {yazilabilir ? (
          <Button
            variant="outline"
            size="sm"
            className="oc-tap mt-1 justify-start"
            onClick={onBolumGizle}
          >
            {bolum.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {bolum.hidden ? "Belgeye geri al" : "Belgeden gizle"}
          </Button>
        ) : null}
        {bolum.hidden ? (
          <p className="text-xs text-muted-foreground">
            Gizli bölüm belgeye HİÇ girmez; içeriği ağaçta durur — gizlemek silmek değildir.
          </p>
        ) : null}
      </div>

      {/* ————————————————————————————————————————————————— blok */}
      {!blok ? (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Ayarlarını görmek için bir blok seçin.
        </p>
      ) : (
        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Blok</p>
            <Badge variant="outline" className="h-5 text-[11px]">
              {blok.kind}
            </Badge>
          </div>

          {blok.kind === "note" ? (
            <div className="flex flex-col gap-1">
              <Label>Uyarı düzeyi</Label>
              <Select
                value={blok.level}
                disabled={!yazilabilir}
                onValueChange={(v) =>
                  onBlokDegis((b) => ({ ...b, level: v as ManualNoteLevel }) as ManualBlock)
                }
              >
                <SelectTrigger className="oc-tap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_NOTE_LEVELS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {MANUAL_NOTE_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Düzeyin ANLAMI belgenin kendi açıklama çizelgesinden gelir;
                  burada ikinci kez tanımlanmaz, gösterilir. */}
              <p className="text-xs text-muted-foreground">{MANUAL_NOTE_MEANING[blok.level]}</p>
            </div>
          ) : null}

          {blok.kind === "image" ? (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="mf-genislik">Genişlik — %{blok.widthPct ?? 100}</Label>
                <input
                  id="mf-genislik"
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  disabled={!yazilabilir}
                  value={blok.widthPct ?? 100}
                  onChange={(e) =>
                    onBlokDegis((b) => ({ ...b, widthPct: Number(e.target.value) }) as ManualBlock)
                  }
                  className="h-6 w-full pointer-coarse:h-8"
                />
                {/*
                 * SÜRGÜ TEK BAŞINA DOKUNMATİK BİR DENETİM DEĞİLDİR: on dokuz
                 * kademeli bir kaydırıcıyı dar bir panelde parmakla isabet
                 * ettirmek neredeyse imkânsızdır ve `input type=range` yer
                 * değiştirilmiş bir öğe olduğu için `.oc-tap` genişleticisi de
                 * ona uygulanmaz. Ön ayarlar kesin ve tek dokunuşluk bir yol
                 * açar; sürgü ince ayar için yerinde kalır.
                 */}
                <div className="flex flex-wrap gap-1">
                  {[25, 50, 75, 100].map((deger) => (
                    <Button
                      key={deger}
                      type="button"
                      size="xs"
                      variant={(blok.widthPct ?? 100) === deger ? "secondary" : "outline"}
                      disabled={!yazilabilir}
                      aria-pressed={(blok.widthPct ?? 100) === deger}
                      onClick={() => onBlokDegis((b) => ({ ...b, widthPct: deger }) as ManualBlock)}
                    >
                      %{deger}
                    </Button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  disabled={!yazilabilir}
                  checked={blok.fullWidth === true}
                  onChange={(e) =>
                    onBlokDegis((b) => ({ ...b, fullWidth: e.target.checked }) as ManualBlock)
                  }
                />
                <span>
                  Sayfanın tamamına yay
                  <span className="block text-xs text-muted-foreground">
                    Sütun genişliği ile SAYFA genişliği ayrı sorulardır: bir şekil sütunun
                    tamamını isteyip sayfanın tamamını istemeyebilir.
                  </span>
                </span>
              </label>
            </>
          ) : null}

          {blok.kind === "auto" ? (
            <div className="flex flex-col gap-1">
              <Label>Kaynak</Label>
              <p className="text-xs text-muted-foreground">
                {MANUAL_AUTO_LABELS[blok.source]}
              </p>
              {blok.source === "ekipman" || blok.source === "rulman" || blok.source === "halat" ? (
                <>
                  <Label className="mt-2">Ayrıntı basamağı</Label>
                  <Select
                    value={
                      (MANUAL_EQUIPMENT_VARIANTS as readonly string[]).includes(blok.variant ?? "")
                        ? (blok.variant as string)
                        : "standart"
                    }
                    disabled={!yazilabilir}
                    onValueChange={(v) =>
                      onBlokDegis((b) => ({ ...b, variant: v }) as ManualBlock)
                    }
                  >
                    <SelectTrigger className="oc-tap">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_EQUIPMENT_VARIANTS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {MANUAL_EQUIPMENT_VARIANT_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Elle değiştirdiğinizde kapsam paketi bu ayarı bir daha ezmez. Sütun
                    ancak kaynakta veri varsa açılır.
                  </p>
                </>
              ) : null}
              {blok.frozen ? (
                <p className="text-xs text-muted-foreground">
                  Bu tablo YAYIMDA DONDURULDU; kaynak sonradan değişse belge değişmez.
                </p>
              ) : null}
            </div>
          ) : null}

          {blok.derived ? (
            <p className="text-xs text-muted-foreground">
              İçerik <code>{blok.derived}</code> kuralıyla bu vincin verisinden üretildi.
              {blok.edited ? " Siz düzenlediğiniz için toplu tazeleme bu bloğu atlar." : ""}
            </p>
          ) : null}

          {yazilabilir ? (
            <Button variant="outline" size="sm" className="oc-tap justify-start" onClick={onBlokGizle}>
              {blok.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {blok.hidden ? "Bloğu geri al" : "Bloğu gizle"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
