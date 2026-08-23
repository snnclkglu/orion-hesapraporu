"use client";

// RESİM ÇARPANI KARTI — kullanıcı kararı (md. 6):
//
//   "Teknik Resimler kısmında adetler İş kaleminin adedi ile çarpılmalı. Bu
//    satın alma için de geçerli olacak. Teknik ressam projeyi 1 adede göre
//    çizer. Eğer aynı kalemden birden fazla ürün sipariş var ise bu adetle
//    proje çarpılmalı. Bazen iki kalem arasında çok çok az değişiklik oluyor,
//    örneğin montaj konumunun farklı olması gibi, biz yine yeni kalem olarak
//    açıyoruz. Ama üretimde iki için tek resim çiziyor. Bu durumu bir şekilde
//    sisteme nasıl girebiliriz. Kalemleri eşleştirme vb gibi bir özellik İşler
//    sayfasında yapılabilir."
//
// ═══════════════════════════════════════════ NEDEN İŞ EMRİ FORMUNDA DEĞİL
//
// İş emri formundaki "Adet" alanı SERBEST METİNdir ve öyle kalmalıdır: müşteriye
// giden belge "1 Takım" ya da "Muhtelif" yazar ve bu bir sayıya indirgenemez.
// Buradaki adet BAŞKA BİR ŞEYdir — imalat ve satın alma çarpanı. İkisini aynı
// alana sıkıştırmak, ya belgeyi ya çarpanı bozardı.
//
// Kart iki alanı YAN YANA koyar çünkü ikisi de tek bir soruya hizmet eder:
// "bu resimden kaç takım üretilecek?"

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Link2, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setItemQty, setItemShare } from "./drawing-qty-actions";

export interface KalemSatiri {
  id: string;
  itemNo: string;
  productName: string;
  /** İş emrindeki serbest metin ("1 Takım", "Muhtelif") — SALT OKUNUR. */
  quantityText: string;
  /** Sayısal adet; `null` = bilinmiyor. */
  qty: number | null;
  sharesWith: string | null;
}

/** Paylaşımsız kalemi anlatan seçenek değeri (boş dizge Radix'te yasak). */
const KENDI = "__kendi__";

export function DrawingQtyCard({
  jobId,
  kalemler,
  /** Sütunlar kurulmuş mu (20260812 migration'ı uygulandı mı)? */
  hazir,
}: {
  jobId: string;
  kalemler: KalemSatiri[];
  hazir: boolean;
}) {
  if (kalemler.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2">
        <span className="text-sm font-semibold">Resim Çarpanı</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {kalemler.filter((k) => k.qty != null).length}/{kalemler.length} adet girilmiş
        </span>
      </div>

      <p className="border-b px-4 py-2 text-xs text-muted-foreground">
        Teknik ressam <strong>bir adede göre</strong> çizer. Buradaki adet, teknik resim ve
        satın alma listelerindeki miktarları çarpar. İki kalem aynı resimleri kullanıyorsa
        (ör. yalnız montaj konumu farklıysa) birini diğerine bağlayın — resim tek, adet
        <strong> ikisinin toplamı</strong> olur.
      </p>

      {!hazir && (
        <p className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Bu özellik için veritabanı migration&apos;ı henüz uygulanmamış. Alanlar salt-okunur.
        </p>
      )}

      <Table className="oc-mobile-table" containerClassName="oc-mobile-table-wrap">
        <TableHeader>
          {/* TELEFONDA TABLO LİSTEYE KATLANIR (kabuk kuralı 15): sabit genişlikli
              kalem no + Resimleri sütunları `sm` altında Ürün Adı hücresinin alt
              satırlarına iner; ekranda Ürün Adı ve Adet kalır, tablo yatay kaymaz. */}
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="hidden w-[8.5rem] sm:table-cell">İş Kalemi No</TableHead>
            <TableHead>Ürün Adı</TableHead>
            <TableHead className="hidden w-[7rem] md:table-cell">İş Emrinde</TableHead>
            <TableHead className="w-[8rem]">Adet</TableHead>
            <TableHead className="hidden w-[16rem] sm:table-cell">Resimleri</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {kalemler.map((k) => (
            <Satir key={k.id} jobId={jobId} k={k} kalemler={kalemler} hazir={hazir} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Satir({
  jobId,
  k,
  kalemler,
  hazir,
}: {
  jobId: string;
  k: KalemSatiri;
  kalemler: KalemSatiri[];
  hazir: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [adet, setAdet] = useState(k.qty == null ? "" : String(k.qty));

  const degisti = (k.qty == null ? "" : String(k.qty)) !== adet.trim();

  // Bu kalemi işaret eden kalemler — çarpan onların adediyle büyür.
  const odunc = kalemler.filter((o) => o.sharesWith === k.id);
  const tasiyici = k.sharesWith ? kalemler.find((o) => o.id === k.sharesWith) : null;

  // HEDEF SEÇENEKLERİ DARALTILIR: zincir yasaktır (bkz. `guard_item_share`).
  // Kendisini işaret eden kalemler olan bir satır TAŞIYICIdır ve ödünç alan
  // olamaz; ödünç alan bir kalem de hedef olamaz.
  const hedefler = kalemler.filter(
    (o) => o.id !== k.id && !o.sharesWith && !kalemler.some((x) => x.sharesWith === o.id && x.id === k.id)
  );
  const hedefSecilebilir = odunc.length === 0;

  function kaydetAdet() {
    const temiz = adet.trim();
    const sayi = temiz === "" ? null : Number(temiz.replace(/[^\d]/g, ""));
    if (temiz !== "" && (!Number.isFinite(sayi) || (sayi ?? 0) < 1)) {
      toast.error("Adet en az 1 olmalı; boş bırakmak “bilinmiyor” demektir.");
      return;
    }
    basla(async () => {
      const sonuc = await setItemQty(jobId, { itemId: k.id, qty: sayi });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Adet kaydedildi.");
        router.refresh();
      }
    });
  }

  function paylas(deger: string) {
    const hedef = deger === KENDI ? null : deger;
    basla(async () => {
      const sonuc = await setItemShare(jobId, { itemId: k.id, targetId: hedef });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success(hedef ? "Kalem eşleştirildi." : "Eşleştirme kaldırıldı.");
        router.refresh();
      }
    });
  }

  // TOPLAM ÇARPAN — taşıyıcı satırda gösterilir; ödünç alanda gösterilmez
  // çünkü orada bir çarpan YOKTUR (resim taşıyıcıda yaşar).
  const toplam =
    odunc.length > 0
      ? [k, ...odunc].reduce((t, o) => t + (o.qty ?? 1), 0)
      : null;

  // RESİMLERİ ALANI İKİ YERDE GÖRÜNÜR — masaüstünde kendi sütununda, telefonda
  // Ürün Adı hücresinin alt satırında — ama TEK yerde kurulur (kabuk kuralı 15,
  // Talep Havuzu'ndaki `TeklifDugmesi` deseni): iki yazım, birinde düzeltilen
  // davranışın ötekinde eski kalması demekti.
  const resimleri = tasiyici ? (
    <span className="flex flex-wrap items-center gap-1 text-[12px]">
      <Link2 className="size-3 shrink-0 text-muted-foreground" />
      <span className="font-mono">{tasiyici.itemNo || "—"}</span>
      <span className="text-muted-foreground">kaleminden</span>
      {hazir && (
        <button
          type="button"
          onClick={() => paylas(KENDI)}
          disabled={calisiyor}
          title="Eşleştirmeyi kaldır"
          className="oc-tap-square grid size-6 place-items-center text-muted-foreground transition-colors hover:text-destructive"
        >
          <Link2Off className="size-3" />
        </button>
      )}
    </span>
  ) : odunc.length > 0 ? (
    <span className="text-[12px]">
      <span className="text-muted-foreground">Kendi resimleri · </span>
      <span className="font-mono">{odunc.map((o) => o.itemNo || "?").join(", ")}</span>
      <span className="text-muted-foreground"> de kullanıyor</span>
    </span>
  ) : hedefSecilebilir && hedefler.length > 0 && hazir ? (
    <Select value={KENDI} onValueChange={paylas}>
      <SelectTrigger size="sm" className="w-full text-base pointer-fine:text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={KENDI}>Kendi resimleri</SelectItem>
        {hedefler.map((h) => (
          <SelectItem key={h.id} value={h.id}>
            {h.itemNo || "—"} kaleminin resimleri
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <span className="text-[12px] text-muted-foreground">Kendi resimleri</span>
  );

  return (
    <TableRow>
      <TableCell data-label="İş Kalemi No" className="hidden font-mono text-sm text-primary sm:table-cell">
        {k.itemNo || "—"}
      </TableCell>
      <TableCell data-label="Ürün Adı" data-mobile-span="full" className="font-medium break-words whitespace-normal">
        {k.productName}
        {/* Telefonda gizlenen sütunların karşılığı: kalem no (`sm` altı) ve
            iş emrindeki serbest metin adet (`md` altı) alt satıra iner. */}
        <span className="mt-0.5 block font-mono text-[11px] font-normal text-primary sm:hidden">
          {k.itemNo || "—"}
        </span>
        {k.quantityText && (
          <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted-foreground md:hidden">
            İş emrinde {k.quantityText}
          </span>
        )}
        <span className="mt-1 block sm:hidden">{resimleri}</span>
      </TableCell>
      <TableCell data-label="İş Emrinde" className="hidden font-mono text-[12px] text-muted-foreground md:table-cell">
        {k.quantityText || "—"}
      </TableCell>

      <TableCell data-label="Adet">
        <span className="flex items-center gap-1">
          <Input
            value={adet}
            onChange={(e) => setAdet(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") kaydetAdet();
            }}
            inputMode="numeric"
            disabled={!hazir}
            placeholder="—"
            className="h-8 w-16 text-center font-mono text-base tabular-nums pointer-fine:text-sm"
            aria-label={`${k.itemNo} adedi`}
          />
          {degisti && hazir && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={kaydetAdet}
              disabled={calisiyor}
              aria-label="Adedi kaydet"
            >
              {calisiyor ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            </Button>
          )}
        </span>
        {k.qty == null && (
          <span
            className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-400"
            title="Satın alma listesinde çarpan 1 kabul edilir"
          >
            belirsiz
          </span>
        )}
        {toplam != null && (
          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
            çarpan {toplam}
          </span>
        )}
      </TableCell>

      <TableCell data-label="Resimleri" className="hidden sm:table-cell">{resimleri}</TableCell>
    </TableRow>
  );
}
