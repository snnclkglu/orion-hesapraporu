"use client";

// TEKLİF PENCERESİ — kullanıcı kararı (md. 10):
//
//   "Firma 1, Firma 2, Firma 3 gibi alınan teklif fiyatları BASİTÇE sisteme
//    girilebilecek. Açılan butonda Firma ismi ve fiyatı girilecek."
//
// BASİTLİK BİR TASARIM KISITIDIR. Pencere iki alanla açılır (firma + fiyat);
// para birimi avrodur ve sorulmaz — TL seçilirse kur alanı BELİRİR.
//
// ADET SORULMAZ (kullanıcı kararı 12.08.2026, md. 3): teklif BİRİM FİYATtır ve
// adet zaten talep havuzunda yazar. İki yerde adet tutmak, ikisinin ayrışması
// demekti — hangisi doğru olurdu?
//
// GİRİLMİŞ TEKLİF DÜZENLENEBİLİR (md. 5). İlk sürümde satırlar yalnız
// seçilebiliyor ve silinebiliyordu; yanlış yazılmış bir fiyatı düzeltmenin tek
// yolu silip yeniden girmekti ve o zaman teklif TARİHİ de değişiyordu. Satır
// artık yerinde açılır: firma, fiyat, kur, tarih ve not düzenlenir.
//
// "TEKLİF ALINDI" AYRI BİR KUTU DEĞİLDİR: bir teklif girildiği anda kalem
// tekliflidir. İşaret ile veri ayrı tutulsaydı ikisi ayrışabilir ve ekran
// "alındı" derken listede fiyat görünmeyebilirdi.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CURRENCIES, CURRENCY_LABELS, currencyOf, fmtMoney, parseNum } from "@/lib/currency";
import { bugunISO, kurGerekli, tarihGoster } from "@/lib/purchasing/terms";
import { formatNum } from "@/lib/drawings/labels";
import { kurMetni, kurOnerisi, type GunlukKur } from "@/lib/purchasing/kur";
import { YeniFirma } from "@/components/yeni-firma";
import type { TeklifSatiri } from "./data";
import { chooseQuote, deleteQuote, saveQuote } from "./actions";

/** Formun tuttuğu ham metinler — girdi alanları metin taşır, sayı değil. */
interface Form {
  firma: string;
  fiyat: string;
  paraBirimi: string;
  kur: string;
  tarih: string;
  /** Ödeme vadesi GÜN — 0 peşindir. Karşılaştırma başlığına yazılır. */
  vade: string;
  /** Teslim süresi GÜN — 0 "Hazır", boş "söylenmedi". */
  teslim: string;
  not: string;
}

const BOS_FORM = (): Form => ({
  firma: "",
  fiyat: "",
  paraBirimi: "EUR",
  kur: "",
  tarih: bugunISO(),
  vade: "",
  teslim: "",
  not: "",
});

function formaCevir(t: TeklifSatiri): Form {
  return {
    firma: t.supplier,
    fiyat: String(t.unitPrice),
    paraBirimi: t.currency,
    kur: t.fxRate == null ? "" : String(t.fxRate),
    tarih: t.quotedAt,
    vade: t.paymentTermDays > 0 ? String(t.paymentTermDays) : "",
    teslim: t.leadTimeDays == null ? "" : String(t.leadTimeDays),
    not: t.note,
  };
}

export function QuoteDialog({
  matchKey,
  tanim,
  teklifler,
  tedarikciler,
  sonKur,
  canWrite,
  onClose,
  onChanged,
}: {
  matchKey: string;
  tanim: string;
  teklifler: TeklifSatiri[];
  tedarikciler: string[];
  /** En son yayımlanmış günlük kur — kur kutusunun önerisi buradan gelir. */
  sonKur?: GunlukKur | null;
  canWrite: boolean;
  onClose: () => void;
  /** Pencere kapanınca listenin tazelenmesi için — kaydetmeler yereldir. */
  onChanged: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [liste, setListe] = useState(teklifler);
  const [yeni, setYeni] = useState<Form>(BOS_FORM);
  /** Düzenlenen satırın kimliği; `null` ise hiçbiri açık değil. */
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [duzenForm, setDuzenForm] = useState<Form>(BOS_FORM);
  const [degisti, setDegisti] = useState(false);

  function kapat() {
    if (degisti) onChanged();
    onClose();
  }

  function gecerliMi(f: Form): boolean {
    const fiyat = parseNum(f.fiyat);
    const kur = parseNum(f.kur);
    return (
      f.firma.trim().length > 0 &&
      fiyat != null &&
      fiyat >= 0 &&
      (!kurGerekli(f.paraBirimi) || (kur != null && kur > 0))
    );
  }

  function kaydet(f: Form, id?: string) {
    const fiyat = parseNum(f.fiyat);
    if (!gecerliMi(f) || fiyat == null) return;
    const kurLazim = kurGerekli(f.paraBirimi);
    const kur = kurLazim ? parseNum(f.kur) : 1;

    basla(async () => {
      const sonuc = await saveQuote({
        id,
        matchKey,
        sample: tanim,
        supplier: f.firma,
        unitPrice: fiyat,
        currency: currencyOf(f.paraBirimi),
        fxRate: kur,
        quotedAt: f.tarih,
        validUntil: "",
        // VADE GÜN GİRİLDİYSE ÖDEME BİÇİMİ "VADELİ"DİR: iki alanı ayrı
        // sormak, kullanıcıyı aynı gerçeği iki kez yazdırmak olurdu.
        paymentMethod: (parseNum(f.vade) ?? 0) > 0 ? "vadeli" : "pesin",
        paymentTermDays: Math.round(parseNum(f.vade) ?? 0),
        leadTimeDays: f.teslim.trim() === "" ? null : Math.round(parseNum(f.teslim) ?? 0),
        note: f.not,
        itemNo: "",
        packageId: null,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      setDegisti(true);
      toast.success(id ? "Teklif güncellendi." : "Teklif kaydedildi.");

      const satir: TeklifSatiri = {
        id: id ?? sonuc.id ?? `yeni-${liste.length}`,
        matchKey,
        sample: tanim,
        supplier: f.firma.toLocaleUpperCase("tr-TR"),
        unitPrice: fiyat,
        currency: currencyOf(f.paraBirimi),
        fxRate: kur,
        unitPriceEur: kur && kur > 0 ? fiyat / kur : null,
        qty: null,
        unit: "Adet",
        quotedAt: f.tarih,
        validUntil: null,
        chosen: id ? (liste.find((t) => t.id === id)?.chosen ?? false) : false,
        note: f.not,
        itemNo: "",
        paymentMethod: (parseNum(f.vade) ?? 0) > 0 ? "vadeli" : "pesin",
        paymentTermDays: Math.round(parseNum(f.vade) ?? 0),
        leadTimeDays: f.teslim.trim() === "" ? null : Math.round(parseNum(f.teslim) ?? 0),
      };

      // İYİMSER GÜNCELLEME: pencere kapanmadan liste değişir, satınalmacı üç
      // firmayı arka arkaya girer. Sunucudan yeniden okumak her firmada bir
      // bekleme olurdu ve "basitçe girilebilecek" kuralını bitirirdi.
      if (id) {
        setListe((o) => o.map((t) => (t.id === id ? satir : t)));
        setDuzenlenen(null);
      } else {
        setListe((o) => [satir, ...o]);
        setYeni(BOS_FORM());
      }
    });
  }

  function sec(id: string) {
    basla(async () => {
      const sonuc = await chooseQuote(id);
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      setDegisti(true);
      setListe((o) => o.map((t) => ({ ...t, chosen: t.id === id ? sonuc.ok === 1 : false })));
    });
  }

  function sil(id: string) {
    basla(async () => {
      const sonuc = await deleteQuote(id);
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      setDegisti(true);
      setListe((o) => o.filter((t) => t.id !== id));
      if (duzenlenen === id) setDuzenlenen(null);
    });
  }

  // En ucuz AVRO fiyatı — kuru olmayan teklif yarışa girmez (karşılaştırılamaz).
  const yarisanlar = liste.filter((t) => t.unitPriceEur != null);
  const enUcuz = yarisanlar.length
    ? Math.min(...yarisanlar.map((t) => t.unitPriceEur ?? Infinity))
    : null;

  return (
    <Dialog open onOpenChange={(o) => !o && kapat()}>
      <DialogContent className="sm:max-w-[min(46rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="text-base">Teklifler</DialogTitle>
          <DialogDescription className="text-[12px]">{tanim}</DialogDescription>
        </DialogHeader>

        {liste.length > 0 && (
          <div className="oc-scrollx border [--oc-scroll-bg:var(--card)]">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Firma</th>
                  <th className="px-2 py-1.5 text-right font-normal">Birim Fiyat</th>
                  <th className="px-2 py-1.5 text-right font-normal">Avro</th>
                  <th className="px-2 py-1.5 text-left font-normal">Tarih</th>
                  <th className="w-28 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {liste.map((t) =>
                  duzenlenen === t.id ? (
                    <tr key={t.id} className="border-t bg-muted/30">
                      <td colSpan={5} className="px-2 py-2">
                        <TeklifFormu
                          f={duzenForm}
                          onChange={setDuzenForm}
                          tedarikciler={tedarikciler}
                          sonKur={sonKur}
                          baslik="Teklifi düzenle"
                          gecerli={gecerliMi(duzenForm)}
                          calisiyor={calisiyor}
                          kaydetEtiketi="Güncelle"
                          onKaydet={() => kaydet(duzenForm, t.id)}
                          onVazgec={() => setDuzenlenen(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="flex items-center gap-1">
                          {t.chosen && (
                            <Check
                              className="size-3 text-emerald-600 dark:text-emerald-400"
                              aria-label="Seçildi"
                            />
                          )}
                          {t.supplier}
                        </span>
                        {t.note && (
                          <span className="block text-[11px] text-muted-foreground">{t.note}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {fmtMoney(t.unitPrice, t.currency)}
                      </td>
                      <td
                        className={
                          "px-2 py-1.5 text-right font-mono tabular-nums " +
                          (t.unitPriceEur != null && t.unitPriceEur === enUcuz
                            ? "font-semibold text-emerald-700 dark:text-emerald-400"
                            : "")
                        }
                      >
                        {/* KURU OLMAYAN TEKLİF karşılaştırılamaz ve öyle görünür:
                            sıfır yazmak onu en ucuz teklif yapardı. */}
                        {t.unitPriceEur == null ? (
                          <span className="text-amber-600 dark:text-amber-400" title="Kur girilmemiş">
                            kur yok
                          </span>
                        ) : (
                          fmtMoney(t.unitPriceEur, "EUR")
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {tarihGoster(t.quotedAt)}
                      </td>
                      <td className="px-2 py-1.5">
                        {canWrite && (
                          <span className="flex items-center justify-end gap-0.5">
                            <IkonDugme
                              onClick={() => sec(t.id)}
                              baslik={t.chosen ? "Seçimi kaldır" : "Kazanan teklif olarak seç"}
                              etkin={t.chosen}
                            >
                              <Check className="size-3.5" />
                            </IkonDugme>
                            <IkonDugme
                              onClick={() => {
                                setDuzenForm(formaCevir(t));
                                setDuzenlenen(t.id);
                              }}
                              baslik="Teklifi düzenle"
                            >
                              <Pencil className="size-3.5" />
                            </IkonDugme>
                            <IkonDugme onClick={() => sil(t.id)} baslik="Teklifi sil" yikici>
                              <Trash2 className="size-3.5" />
                            </IkonDugme>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {canWrite && duzenlenen === null && (
          <div className="border bg-muted/30 p-2">
            <TeklifFormu
              f={yeni}
              onChange={setYeni}
              tedarikciler={tedarikciler}
              sonKur={sonKur}
              baslik="Yeni Teklif"
              gecerli={gecerliMi(yeni)}
              calisiyor={calisiyor}
              kaydetEtiketi="Teklifi Ekle"
              onKaydet={() => kaydet(yeni)}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={kapat}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Teklif giriş formu — yeni kayıt ve düzenleme AYNI bileşeni kullanır.
 *
 * İki ayrı form yazılsaydı biri er geç ötekinden ayrışırdı: kur alanının ne
 * zaman görüneceği, hangi alanın zorunlu olduğu iki yerde tanımlanmış olurdu.
 */
function TeklifFormu({
  f,
  onChange,
  tedarikciler,
  sonKur,
  baslik,
  gecerli,
  calisiyor,
  kaydetEtiketi,
  onKaydet,
  onVazgec,
}: {
  f: Form;
  onChange: (f: Form) => void;
  tedarikciler: string[];
  sonKur?: GunlukKur | null;
  baslik: string;
  gecerli: boolean;
  calisiyor: boolean;
  kaydetEtiketi: string;
  onKaydet: () => void;
  onVazgec?: () => void;
}) {
  const kurLazim = kurGerekli(f.paraBirimi);
  const kurSayi = parseNum(f.kur);
  const set = (p: Partial<Form>) => onChange({ ...f, ...p });

  /**
   * PARA BİRİMİ DEĞİŞİNCE KUR DA DEĞİŞİR (kullanıcı kararı, 13.08.2026).
   *
   * Dolardan liraya geçilip kur alanı eski değerde kalsaydı, 1,08 (parite) bir
   * lira kuru gibi kaydedilir ve teklif otuz kat ucuz görünürdü. Alan bu yüzden
   * BİRLİKTE yazılır: yeni birimin önerisi neyse o gelir.
   */
  function paraBirimiSec(v: string) {
    const oneri = kurOnerisi(v, sonKur);
    set({ paraBirimi: v, kur: oneri ? kurMetni(oneri.kur) : "" });
  }

  const oneri = kurLazim ? kurOnerisi(f.paraBirimi, sonKur) : null;

  return (
    <div className="grid gap-2">
      <span className="oc-kicker text-muted-foreground">{baslik}</span>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-[10rem] flex-1 gap-1">
          <span className="text-[11px] text-muted-foreground">Firma</span>
          <span className="flex items-center gap-1">
            <Input
              value={f.firma}
              onChange={(e) => set({ firma: e.target.value })}
              list="tedarikci-listesi"
              placeholder="Firma"
              maxLength={120}
              className="h-9 flex-1 text-base pointer-fine:text-sm"
            />
            <YeniFirma ad={f.firma} tedarikciler={tedarikciler} />
          </span>
        </label>
        <label className="grid w-28 gap-1">
          <span className="text-[11px] text-muted-foreground">Birim fiyat</span>
          <Input
            value={f.fiyat}
            onChange={(e) => set({ fiyat: e.target.value })}
            inputMode="decimal"
            className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && gecerli) onKaydet();
            }}
          />
        </label>
        <label className="grid w-28 gap-1">
          <span className="text-[11px] text-muted-foreground">Para birimi</span>
          <Select value={f.paraBirimi} onValueChange={paraBirimiSec}>
            <SelectTrigger size="sm" className="text-base pointer-fine:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {/* KUR ALANI YALNIZ GEREKİNCE BELİRİR — avroda sorulmaz (hep 1). */}
        {kurLazim && (
          <label className="grid w-32 gap-1">
            <span className="text-[11px] text-muted-foreground">1 € = ?</span>
            <Input
              value={f.kur}
              onChange={(e) => set({ kur: e.target.value })}
              inputMode="decimal"
              placeholder="35,50"
              className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
            />
            {/* KAYNAK YAZILIR — kullanıcı kaç günlük bir kura baktığını görsün.
                Öneri bir KİLİT değil: kutu her zaman yazılabilir ve sözleşmedeki
                kur biliniyorsa o girilir. */}
            {oneri && (
              <button
                type="button"
                onClick={() => set({ kur: kurMetni(oneri.kur) })}
                title={`TCMB ${tarihGoster(oneri.gun)} — dokunmak kutuyu bu kurla doldurur`}
                className="text-left text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {tarihGoster(oneri.gun)} · {kurMetni(oneri.kur)}
                {oneri.yas > 3 ? ` (${formatNum(oneri.yas)} gün önce)` : ""}
              </button>
            )}
          </label>
        )}
        <label className="grid w-36 gap-1">
          <span className="text-[11px] text-muted-foreground">Teklif tarihi</span>
          <Input
            type="date"
            value={f.tarih}
            onChange={(e) => set({ tarih: e.target.value })}
            className="h-9 font-mono text-base pointer-fine:text-sm"
          />
        </label>
        {/* VADE VE TESLİM SÜRESİ (kullanıcı kararı, 15.08.2026): teklifleri
            yan yana koyarken en ucuz fiyat tek başına bir cevap değildir —
            90 gün vadeli ve hazır bir teklif, peşin ve 40 gün terminli bir
            tekliften pahalı görünse bile kazanabilir. */}
        <label className="grid w-28 gap-1">
          <span className="text-[11px] text-muted-foreground">Vade (gün)</span>
          <Input
            value={f.vade}
            onChange={(e) => set({ vade: e.target.value })}
            inputMode="numeric"
            placeholder="Peşin"
            className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
          />
        </label>
        <label className="grid w-32 gap-1">
          <span className="text-[11px] text-muted-foreground">Teslim (gün)</span>
          <Input
            value={f.teslim}
            onChange={(e) => set({ teslim: e.target.value })}
            inputMode="numeric"
            placeholder="Sorulmadı"
            title="0 yazarsanız “Hazır” görünür; boş bırakılırsa tedarikçi söylemedi demektir."
            className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-[12rem] flex-1 gap-1">
          <span className="text-[11px] text-muted-foreground">Not (isteğe bağlı)</span>
          <Input
            value={f.not}
            onChange={(e) => set({ not: e.target.value })}
            maxLength={500}
            className="h-9 text-base pointer-fine:text-sm"
          />
        </label>
        {onVazgec && (
          <Button type="button" variant="ghost" onClick={onVazgec} disabled={calisiyor}>
            <X className="size-3.5" />
            Vazgeç
          </Button>
        )}
        <Button type="button" onClick={onKaydet} disabled={!gecerli || calisiyor}>
          {calisiyor && <Loader2 className="size-4 animate-spin" />}
          {kaydetEtiketi}
        </Button>
      </div>
      {kurLazim && (kurSayi == null || kurSayi <= 0) && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Avro dışı fiyatta kur zorunludur — sistemde bütün fiyatlar avroda karşılaştırılır.
        </p>
      )}
      <datalist id="tedarikci-listesi">
        {tedarikciler.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

function IkonDugme({
  onClick,
  baslik,
  etkin,
  yikici,
  children,
}: {
  onClick: () => void;
  baslik: string;
  etkin?: boolean;
  yikici?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={baslik}
      aria-label={baslik}
      className={
        "grid size-7 place-items-center transition-colors pointer-coarse:size-9 " +
        (etkin
          ? "text-emerald-600 dark:text-emerald-400"
          : yikici
            ? "text-muted-foreground hover:text-destructive"
            : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}
