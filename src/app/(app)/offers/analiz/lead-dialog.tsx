"use client";

// BEKLENEN İŞ PENCERESİ — henüz verilmemiş ama verileceği bilinen iş.
//
// Kullanıcı isteği (17.08.2026): *"ben yakında hızlıca verebileceğim teklifi
// kısa bir satır olarak buraya ekleyebileyim. Henüz o teklifi vermemiş
// olabilirim ama vereceğimi biliyor oluyor bazı durumlarda."*
//
// FORM KISADIR ve bu bilinçlidir: kayıt bir NİYETTİR, bir belge değil. Teklif
// açmanın kendi ekranı var; burada sorulan altı şey "kim, ne, ne zaman, ne
// kadar, ne kadar yakın, not"tur. Zorunlu olan yalnız müşteri ve konudur —
// gerisi bilinmiyorsa BOŞ kalır, `0` ya da bugünün tarihi varsayılmaz
// (değişmez md. 4).
//
// MÜŞTERİ İKİ YOLDAN GELİR: defterden (`CustomerPicker`, iş emrinden
// devralınır) ya da serbest metin. Serbest metin teklifin kendisinde YASAKTIR
// (IS-14) ama beklenen iş çoğu zaman bir telefon görüşmesidir ve firmayı
// deftere yazacak bilgi henüz yoktur; gevşeme migration'da da gerekçelidir.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Trash2 } from "lucide-react";
import { CustomerPicker } from "@/app/(app)/jobs/customer-picker";
import type { CustomerOption } from "@/app/(app)/offers/data";
import { gunEkle } from "@/components/odeme-tarihi";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  currencyOf,
  parseNum,
  type Currency,
} from "@/lib/currency";
import { scoreHue, scoreLabel, type AnalizSatiri } from "@/lib/offers/analiz";
import { tagStyle } from "@/lib/tags";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import { createLead, deleteLead, updateLead } from "./actions";

/**
 * Ekrandaki satır — çekirdeğin `AnalizSatiri`si + YALNIZ DÜZENLEME İÇİN gereken
 * iki alan.
 *
 * `notes` ve `customerId` çekirdekte YOKTUR ve olmamalıdır: projeksiyon
 * matematiği ikisini de okumaz. Burada dururlar çünkü satır içi puan değişimi
 * beklenen işin TAMAMINI yazar (`updateLead`) — eksik alanla çağırmak, notu ve
 * defter bağını sessizce silerdi.
 */
export interface AnalizSatiriDetay extends AnalizSatiri {
  customerId: string | null;
  notes: string;
  /**
   * TEKLİFİN VERİLDİĞİ GÜN (`issued_on ?? issue_date`, yani
   * `effectiveOfferDate`) — çizelgenin sırası bundan okunur (md. 24).
   *
   * Beklenen iş satırında karşılığı YOKTUR ve `null`dur: henüz verilmemiş bir
   * teklifin verilme günü olmaz. Alan çekirdekte (`lib/offers/analiz.ts`)
   * DEĞİLDİR çünkü projeksiyon matematiği onu hiç okumaz — yalnız ekranın
   * dizilişi ilgilenir.
   */
  verilisTarihi: string | null;
}

/** `Select` boş dizeyi değer olarak kabul etmez; puansızlık ayrı bir anahtardır. */
export const PUANSIZ = "__puansiz__";

export const PUANLAR = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/**
 * PUAN SEÇİCİ — 1–10, satır içinde de pencerede de aynı bileşen.
 *
 * Rozetin rengi `scoreHue`dan gelir (soğuk mavi → sıcak kırmızı); doygunluk ve
 * parlaklık `.oc-tag` kuralında, tema başına verilir. PUANSIZ SEÇENEK RENKSİZDİR
 * ve "—" ile yazılır: uydurma bir orta ton, verilmemiş bir kararı verilmiş gibi
 * gösterirdi.
 *
 * Renk TEK TAŞIYICI DEĞİLDİR: rozetin içinde sayı, listede ayrıca sözel
 * karşılığı ("Çok yakın") yazar.
 *
 * LİSTE `position="popper"` İLE AÇILIR — ve bu, aşağıdaki `SelectValue`
 * kararının ZORUNLU ikizidir (md. 23; kullanıcı: *"Puan dropdown'ı sol üstte
 * açılıyor. Mantıksız."*).
 *
 * Kabuğun varsayılanı `item-aligned`dır: Radix seçili öğeyi tetikleyicinin
 * ÜSTÜNE bindirmeye çalışır ve bunu yaparken konumu `Select.Value` düğümünün
 * dikdörtgeninden ölçer. Ölçüm `if (trigger && valueNode && …)` koşulunun
 * içindedir; `SelectValue` basılmadığı için `valueNode` boştur, koşul hiç
 * girmez ve `position: fixed` olan sarmalayıcıya `left`/`top` HİÇ yazılmaz —
 * kutu da portalın kökünde, ekranın sol üst köşesinde kalır.
 *
 * `popper` konumlandırması çapa olarak TETİKLEYİCİYİ alır, `valueNode`a
 * bakmaz; kutu her zaman seçicinin altında açılır ve çarpışma payı onu dar
 * sütunda taşırmaz.
 */
export function PuanSecici({
  score,
  onChange,
  disabled,
  className,
}: {
  score: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const hue = scoreHue(score);
  return (
    <Select
      value={score === null ? PUANSIZ : String(score)}
      onValueChange={(v) => onChange(v === PUANSIZ ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Kazanma puanı"
        title={`Kazanma yakınlığı: ${scoreLabel(score)}`}
        className={cn("w-full min-w-0 justify-between", className)}
      >
        {/* `SelectValue` yerine denetimli değerin kendisi basılır: rozetin
            rengi puana bağlıdır ve Radix'in seçili öğeyi kopyalaması bu stili
            taşımıyordu. */}
        {hue === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className="oc-tag px-1.5 py-0.5 font-mono text-xs font-medium"
            style={tagStyle(hue)}
          >
            {score}
          </span>
        )}
      </SelectTrigger>
      <SelectContent position="popper" align="start" sideOffset={4} className="min-w-[11rem] p-1">
        <SelectItem value={PUANSIZ}>
          <span className="text-muted-foreground">— Puansız</span>
        </SelectItem>
        {PUANLAR.map((p) => (
          <SelectItem key={p} value={String(p)}>
            <span className="flex items-center gap-2">
              <span
                className="oc-tag px-1.5 py-0.5 font-mono text-xs font-medium"
                style={tagStyle(scoreHue(p) as number)}
              >
                {p}
              </span>
              <span className="text-muted-foreground">{scoreLabel(p)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ————————————————————————————————————————————————————— beklenen tarih

/**
 * GÜN TAM MI — `YYYY-MM-DD`, yılı 1000–9999 ve takvimde gerçekten var.
 *
 * Kullanıcı bildirimi (17.08.2026): *"Beklenen tarih girişinde yıl girişinde
 * hata var. Düzgün girilmiyor. İlk yıl sayısına bastığımda kaydediyor, 0002
 * gibi oluyor."*
 *
 * SEBEP: dolu bir `<input type="date">`te yıl bölmesine basılan İLK rakam
 * kutuyu boş bırakmaz, yılı `0002` yapar — yani değer "yarım" değil, TAM ve
 * biçimsel olarak geçerlidir. `onChange` o anda ateşler ve satır içi yazım
 * kaydı hemen götürür; kullanıcı "2026" yazmayı bitiremeden gün `0002-…`
 * olmuş olur.
 *
 * YIL ALT SINIRI KURALIN KENDİSİDİR: 1000'in altındaki bir yıl bu uygulamada
 * hiçbir zaman meşru bir beklenti değildir, ama yazarken MUTLAKA yolun üstünde
 * durur (2 → 20 → 202 → 2026). Sınır, "kullanıcı hâlâ yazıyor" ile "karar
 * verdi"yi ayıran tek dürüst işaret.
 *
 * TAKVİM KONTROLÜ AYRICA YAPILIR: `2026-02-31` biçime uyar ama gün yoktur;
 * UTC'ye çevirip geri okumak onu yakalar (`Date` böyle bir tarihi 3 Mart'a
 * taşır ve dizge artık eşleşmez).
 */
export function tarihKesin(deger: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deger);
  if (!m) return false;
  const yil = Number(m[1]);
  if (yil < 1000 || yil > 9999) return false;
  const d = new Date(`${deger}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === deger;
}

/**
 * HIZLI SEÇİM ARALIĞI — bugünden 1…12 hafta.
 *
 * Kullanıcı isteği (17.08.2026): *"Beklenen tarihte hızlı seçimler olsun. 1
 * haftadan 12 haftaya kadar."* Aralık birebir odur.
 *
 * SATIN ALMA'NIN `DELIVERY_WEEKS` LİSTESİ DEVRALINMADI ve bu bilinçlidir:
 * orada ölçülen şey tedarikçinin TERMİNİdir (1–8, 10, 12, 16, 20 hafta),
 * burada ölçülen şey müşterinin KARAR VERECEĞİ gündür. `QUOTE_LEAD_WEEKS`in
 * `DELIVERY_WEEKS`ten ayrı durma gerekçesinin aynısı: aynı diziyi iki anlama
 * birden koşmak, birinin uçları değiştiğinde ötekini sessizce kaydırır.
 */
const HIZLI_HAFTALAR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * BEKLENEN TARİH KUTUSU — satır içinde de pencerede de aynı bileşen.
 *
 * YARIM TARİH YUKARI VERİLMEZ: `onChange` yalnız değer TAM olduğunda (ya da
 * kutu boşaltıldığında `null` ile) çağrılır; arada kalan her şey kutunun kendi
 * yerel durumunda bekler. `OdemeTarihi` (`components/odeme-tarihi.tsx`) İKİNCİ
 * BİR SEÇİCİ OLARAK YAZILMADI, oradaki hızlı seçimler (bugün · dün · önceki iş
 * günü) GERİYE bakar ve ödeme gününün sorusunu sorar; buradaki soru ileriye
 * bakar. Ortak olan gün aritmetiği o dosyadan İTHAL EDİLİR (`gunEkle`), yeniden
 * yazılmaz.
 */
export function BeklenenTarih({
  value,
  bugun,
  onChange,
  disabled,
  className,
}: {
  value: string | null;
  /** Bugün SUNUCUDAN gelir; istemcide `new Date()` hidrasyon uyuşmazlığı açar. */
  bugun: string;
  /** YALNIZ tam ve geçerli bir günle — ya da boşaltmada `null` ile — çağrılır. */
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [acik, setAcik] = useState(false);
  /**
   * TASLAK kutunun kendi sözüdür; `null` = "yerel düzenleme yok, yukarıdan
   * geleni göster".
   *
   * Denetimli bir kutuda `value` her boyamada DOM'a geri yazılır. Yarım kalan
   * girişi yukarı vermediğimiz için `value` değişmez ve kullanıcının yazdığı
   * ara değer bir sonraki boyamada silinirdi — yani "kaydetmiyoruz" kararı,
   * kutuyu yazılamaz hâle getirirdi. Taslak o boşluğu kapatır ve SENKRONİZE
   * EDEN BİR EFEKT GEREKTİRMEZ (`odeme-tarihi.tsx`in dersi).
   */
  const [taslak, setTaslak] = useState<string | null>(null);
  const metin = taslak ?? value ?? "";

  function yazildi(ham: string) {
    setTaslak(ham);
    // BOŞ KUTU `null` ÜRETİR — `0` ya da yarım bir tarih değil (değişmez md. 4).
    if (ham === "") {
      onChange(null);
      return;
    }
    if (tarihKesin(ham)) onChange(ham);
  }

  /** Alandan çıkışta bir kez daha bakılır: yarım kalan giriş kaydedilmez, kutu son geçerli güne döner. */
  function ayrildi() {
    if (taslak !== null && taslak !== "" && !tarihKesin(taslak)) setTaslak(null);
  }

  function haftaSec(hafta: number) {
    const gun = gunEkle(bugun, hafta * 7);
    setTaslak(gun);
    onChange(gun);
    setAcik(false);
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* YER TUTUCU YOK (değişmez md. 5): boş kutu boş durur. */}
      <Input
        type="date"
        value={metin}
        disabled={disabled}
        aria-label="Beklenen tarih"
        onChange={(e) => yazildi(e.target.value)}
        onBlur={ayrildi}
        className="h-9 w-full min-w-0 font-mono"
      />
      <Popover open={acik} onOpenChange={setAcik}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled}
            title="Bugünden itibaren hafta seç"
            aria-label="Beklenen tarihi hafta olarak seç"
          >
            <CalendarClock className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(17rem,calc(100vw-1.5rem))] p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="mb-2 text-[12px] font-medium">Bugünden itibaren kaç hafta?</p>
          <div className="grid grid-cols-3 gap-2">
            {HIZLI_HAFTALAR.map((h) => {
              const gun = gunEkle(bugun, h * 7);
              return (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={metin === gun ? "default" : "outline"}
                  onClick={() => haftaSec(h)}
                  // Hesaplanan gün ipucunda yazar: hızlı seçim bir KISAYOLDUR,
                  // hangi tarihe bastığını gizlemez.
                  title={gun}
                >
                  {h} hafta
                </Button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-2 w-full text-muted-foreground"
            onClick={() => {
              setTaslak("");
              onChange(null);
              setAcik(false);
            }}
          >
            Tarihi kaldır
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Sayı METİN olarak tutulur: her tuş vuruşunda sayıya çevrilseydi kullanıcı
 *  "1.250.000,5" yazarken imleç ve ondalık virgül kaybolurdu (sale-dialog'un
 *  dersi). */
function sayiMetni(v: number | null): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function Alan({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LeadDialog({
  satir,
  customers,
  bugun,
  open,
  onOpenChange,
}: {
  /** `null` = yeni kayıt. Düzenleme ve silme aynı penceredendir. */
  satir: AnalizSatiriDetay | null;
  customers: readonly CustomerOption[];
  /** Hızlı hafta seçiminin saydığı gün — SUNUCUDAN iner (bkz. `BeklenenTarih`). */
  bugun: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Alanlar yalnız başlangıç değerinden dolar; senkronize eden bir efekt
  // YOKTUR — pencere satır seçilince monte edilir, kapanınca sökülür.
  const [customerId, setCustomerId] = useState<string | null>(satir?.customerId ?? null);
  const [customerName, setCustomerName] = useState(satir?.customerName ?? "");
  const [subject, setSubject] = useState(satir?.subject ?? "");
  const [expectedOn, setExpectedOn] = useState<string | null>(satir?.expectedOn ?? null);
  const [amount, setAmount] = useState(sayiMetni(satir?.amount ?? null));
  const [currency, setCurrency] = useState<Currency>(currencyOf(satir?.currency));
  const [score, setScore] = useState<number | null>(satir?.score ?? null);
  const [notes, setNotes] = useState(satir?.notes ?? "");

  const duzenleme = satir !== null;

  function kaydet() {
    const girdi = {
      customerId,
      customerName: customerName.trim(),
      subject: subject.trim(),
      // BOŞ TARİH `null`DIR, bugünün tarihi değil: tarihi bilinmeyen bir işi
      // bir döneme yerleştirmek projeksiyonu uydurulmuş bir varsayımla
      // şişirirdi (çekirdeğin `pencereyeGirer` kuralı). Yarım bir tarih zaten
      // buraya kadar gelemez — `BeklenenTarih` yalnız tam günü yukarı verir.
      expectedOn,
      amount: parseNum(amount),
      currency,
      winScore: score,
      notes: notes.trim(),
      active: satir?.active ?? true,
    };
    startTransition(async () => {
      const res = duzenleme ? await updateLead(satir.id, girdi) : await createLead(girdi);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(duzenleme ? "Beklenen iş güncellendi." : "Beklenen iş eklendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  function sil() {
    if (!satir) return;
    if (
      !window.confirm(
        `"${satir.subject || satir.customerName}" beklenen iş kaydı silinecek. Devam edilsin mi?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteLead(satir.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Beklenen iş silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${TAM_BOY_PENCERE} sm:max-w-[min(38rem,calc(100%-2rem))]`}>
        <DialogHeader>
          <DialogTitle>{duzenleme ? "Beklenen İşi Düzenle" : "Beklenen İş Ekle"}</DialogTitle>
          <DialogDescription>
            Henüz teklif verilmemiş ama verileceği bilinen iş. Projeksiyona
            teklifler gibi girer; teklife dönüştüğünde bu satır düşer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3">
            {/* `currentName` BOŞ GEÇİLİR: seçicinin "deftere bağlı değil"
                uyarısı iş emri içindir ve burada YANLIŞ olurdu — defterde
                olmayan firma bu ekranda meşru bir kayıttır. */}
            <CustomerPicker
              customers={[...customers]}
              value={customerId}
              currentName=""
              onPick={(c) => {
                setCustomerId(c?.id ?? null);
                if (c) setCustomerName(adBuyuk(c.name));
              }}
            />
            <Alan
              label="Defterde Olmayan Firma"
              hint="Firma henüz defterde değilse adını buraya yazın; listeden seçim yaparsanız bu alan defterdeki adla dolar."
            >
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(adBuyuk(e.target.value));
                  // Elle yazılan ad defter bağını KOPARIR: iki kaynak birden
                  // dolu kalsaydı hangisinin geçerli olduğu belirsizleşirdi.
                  setCustomerId(null);
                }}
              />
            </Alan>
          </div>

          <Alan label="Konu">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
          </Alan>

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan
              label="Beklenen Tarih"
              hint="Kararın beklendiği gün — dönem bundan okunur. Sağdaki takvimden bugünden itibaren hafta seçebilirsiniz."
            >
              <BeklenenTarih value={expectedOn} bugun={bugun} onChange={setExpectedOn} />
            </Alan>
            <Alan label="Kazanma Puanı" hint={`1–10 · ${scoreLabel(score)}`}>
              <PuanSecici score={score} onChange={setScore} className="h-10" />
            </Alan>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan label="Tutar">
              {/* YER TUTUCU YOK (değişmez md. 5): grileşmiş bir örnek sayı
                  girilmiş bir değer sanılıyordu. */}
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Alan>
            <Alan label="Para Birimi">
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-full">
                  <span>
                    {CURRENCY_SYMBOLS[currency]} {CURRENCY_LABELS[currency]}
                  </span>
                </SelectTrigger>
                {/* PUAN SEÇİCİYLE AYNI SEBEP (md. 23): burada da `SelectValue`
                    yerine denetimli değerin kendisi basılıyor, yani Radix'in
                    `item-aligned` ölçümü boşa düşer ve kutu ekranın sol üst
                    köşesinde açılırdı. */}
                <SelectContent position="popper" align="start" sideOffset={4} className="p-1">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_SYMBOLS[c]} {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Alan>
          </div>

          <Alan label="Not">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Alan>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {duzenleme && (
              <Button type="button" variant="ghost" onClick={sil} disabled={pending}>
                <Trash2 className="size-3.5" /> Sil
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={kaydet} disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
