"use client";

// YENİ KALEM SİHİRBAZI — kaynak, kip, vinç tipi, ad.
//
// Kullanıcı bildirimi (17.08.2026): *"Kalem ekle deyip yeni vinç eklediğimde
// bölümler otomatik gelmedi. Şöyle olsun: Kalem ekle dediğinde hangi tür vinç
// ekleyeceğini sorsun ve bölümleri ona göre gelsin. Ayrıca o işte ilk yapılan
// vincin özellikleri ön tanımlı seçili olarak gelsin."*
//
// Boş bir kalem eklemek, kullanıcıya sekiz bölümü tek tek kurdurmak demekti.
// Şablon zaten teklif AÇILIRKEN sorulan şeydir; ikinci kalemde de aynı soruyu
// sormak hem tutarlı hem hızlıdır.
//
// KAYNAK ARTIK SEÇİLİR VE KİP ÜÇE ÇIKTI (kullanıcı isteği, 22.08.2026, md. 2:
// *"Teklife kalem ekle derken ilk kalemin marka tercihini kopyala tuşu var.
// Bunu geliştirmek istiyorum. Hem her istediğim kalemi seçip kopyalayabileyim.
// hem ister marka ve tercihleri, ister tüm kalemin aynısını direk
// kopyalayabileyim. Kalemler arasında dropdown seçebileyim."*)
//
// YENİ BİR KOPYALAMA ALGORİTMASI YAZILMADI: iki kip zaten vardı, ikisi de
// KİPSİZDİ. "Marka ve tercihler" `copySelections`tır (bugüne kadar yalnız
// `items[0]`dan çalışıyordu), "tamamı" ise kalem düzenleyicideki "Kalemi
// Kopyala" düğmesinin çağırdığı `copyItemInPayload`tır (bugüne kadar yalnız
// AÇIK OLAN kalemden). Bu pencere ikisini tek soruya indirir: hangi kalemden,
// ne kadarı.

import { useState } from "react";
import { Check, Plus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { copySelections, emptyItem, freeItem } from "@/lib/offers/payload";
import { GENERAL_GROUP_KEY, OFFER_GROUP_DEF_BY_KEY } from "@/lib/offers/registry";
import { defaultFreeItemTitle, defaultItemTitle, kalemBasligiBuyuk } from "@/lib/offers/title";
import type { OfferItem } from "@/lib/offers/types";
import { cn } from "@/lib/utils";
import type { OfferTemplateRow } from "@/app/(app)/offers/data";

/** Şablon yerine SERBEST kalem — `Select` boş string değere izin vermez. */
const SERBEST = "__serbest__";

/**
 * KOPYALAMA KİPİ — üç seçenek, tek soru.
 *
 * `yok` bir kip DEĞİL bir reddediştir ama listede durur: bugünkü onay kutusunun
 * kapalı hâli buydu ve seçenek listesinden düşseydi "hiçbir şey kopyalama"
 * demenin yolu kutuyu boş bırakmaktan geçerdi — üç durumlu bir kararı iki
 * durumlu bir kutuya sıkıştırmanın klasik bedeli.
 */
type Kip = "yok" | "secim" | "tam";

/** Kalem defterden kurulmuş bir VİNÇ mi, yoksa SERBEST bir kalem mi (TEKLIF-33). */
function serbestKalem(item: OfferItem): boolean {
  return !item.groups.some((g) => g.key === GENERAL_GROUP_KEY);
}

export function KalemEkleDialog({
  templates,
  items,
  sira,
  onClose,
  onEkle,
  onKalemiKopyala,
}: {
  templates: readonly OfferTemplateRow[];
  /** Teklifin BÜTÜN kalemleri — kaynak seçici bunlardan kurulur. */
  items: readonly OfferItem[];
  /** Kaçıncı kalem — varsayılan ad ("VİNÇ - 3") bundan kurulur. */
  sira: number;
  onClose: () => void;
  onEkle: (item: OfferItem) => void;
  /**
   * TAM KOPYA AYRI BİR GERİ ÇAĞIRMADIR ve bu zorunludur.
   *
   * Kipin sonucu tek bir `OfferItem` DEĞİLDİR: kopya kaynağın hemen ARDINA
   * girer ve kaleme bağlı FİYAT SATIRLARINI da getirir (TEKLIF-42) — yani
   * ürettiği şey bir kalem değil, payload'ın tamamına uygulanan bir
   * dönüşümdür. `onEkle`ye sıkıştırılsaydı ya fiyat satırları düşerdi ya da
   * kopya belgenin sonuna atılırdı.
   */
  onKalemiKopyala: (sourceId: string) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? SERBEST);
  const [baslik, setBaslik] = useState("");
  const [kaynakId, setKaynakId] = useState(items[0]?.id ?? "");
  // VARSAYILAN BUGÜNKÜ DAVRANIŞTIR: onay kutusu `true` başlıyordu, yani
  // "marka ve tercihleri kopyala". Kalem yoksa kopyalanacak bir şey de yok.
  const [kip, setKip] = useState<Kip>(items.length > 0 ? "secim" : "yok");

  const serbest = templateId === SERBEST;
  const sablon = templates.find((t) => t.id === templateId);
  const gruplar = sablon?.skeleton?.groupKeys ?? [];
  const varsayilanAd = serbest ? defaultFreeItemTitle(sira) : defaultItemTitle(sira);

  const kaynak = items.find((x) => x.id === kaynakId);
  // KAYNAĞI SERBEST OLAN "SEÇİM" KİPİ ÇALIŞMAZ ve bu ekranda SÖYLENİR.
  // `copySelections` defter satırlarını `key` ile eşler; serbest kalemin
  // defterde karşılığı olan satırı yoktur ve fonksiyon sessizce HİÇBİR ŞEY
  // taşımaz. Seçenek açık bırakılsaydı kullanıcı işaretli bir kutu görüp
  // hiçbir şeyin gelmediğini sanırdı — TEKLIF-33'ün HEDEF tarafındaki
  // kuralının KAYNAK tarafındaki aynası.
  const kaynakSerbest = kaynak ? serbestKalem(kaynak) : false;
  const secimKapali = !kaynak || kaynakSerbest || serbest;
  const tam = kip === "tam";

  function ekle() {
    // TAM KOPYA BU PENCEREDE BİTMEZ: payload dönüşümü çağırana aittir.
    if (tam && kaynak) {
      onKalemiKopyala(kaynak.id);
      return;
    }
    // AD YAZILMAMIŞSA "VİNÇ - n" ve başlık OTOMATİKTİR: kapasite ile vinç tipi
    // girildiğinde kendiliğinden "32/5T x 19,5m …" olur (`withAutoTitle`).
    // Yazılmışsa kullanıcının adı KALICIDIR — türetme onu ezmez.
    const yazilan = baslik.trim();
    let item = serbest
      ? freeItem(yazilan || varsayilanAd)
      : emptyItem(yazilan || varsayilanAd, gruplar.length ? gruplar : ["general"]);
    if (!serbest) item.craneType = sablon?.crane_type ?? "";
    // SERBEST KALEMİN BAŞLIĞI ELLE YAZILMIŞ SAYILIR: defter satırı olmadığı için
    // türetilecek bir kapasite de yoktur ve türetme onu boşa çıkarırdı.
    item.titleManual = serbest || yazilan !== "";
    // SEÇİM TAŞINIR, ÖLÇÜ TAŞINMAZ (`copySelections`): marka tercihleri bir
    // teklifin tamamında aynıdır, kapasite ve güçler her vince özeldir.
    if (kip === "secim" && !secimKapali && kaynak) item = copySelections(kaynak, item);
    onEkle(item);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* PENCERE KENDİ İÇİNDE KAYAR: iki seçici, iki kutu ve üç seçenekli kip
          grubu telefonun ekranından uzundur ve `dvh` kelepçesi olmadan alttaki
          "Ekle" düğmesi ekran dışında kalırdı (MOBIL-4). */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kalem Ekle</DialogTitle>
          <DialogDescription>
            Vinç tipini seçin; teknik bölümler ona göre kurulur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60dvh] gap-3 overflow-y-auto pr-1">
          {/* ————————————————————————————————— kaynak ve kip */}
          {items.length > 0 ? (
            <div className="grid gap-2 rounded-md border p-2.5">
              <div className="grid gap-1.5">
                <Label htmlFor="yeni_kalem_kaynak">Kaynak Kalem</Label>
                <Select value={kaynakId} onValueChange={setKaynakId}>
                  <SelectTrigger id="yeni_kalem_kaynak" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((x, i) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.title || `Kalem ${i + 1}`}
                        {x.hidden ? " (gizli)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* KİP BİR RADYO GRUBUDUR, üç onay kutusu değil: seçenekler
                  birbirini dışlar ve iki kutuyu birden işaretlemek anlamsızdır.
                  Görsel bugünkü kutunun aynısı kalır — değişen yalnız
                  semantik ve seçenek sayısı. */}
              <div role="radiogroup" aria-label="Kopyalama kipi" className="grid gap-0.5">
                <KipSecenegi
                  secili={kip === "yok"}
                  onSelect={() => setKip("yok")}
                  baslik="Kopyalama"
                  aciklama="Boş bir kalem açılır; bütün tercihler elle girilir."
                />
                <KipSecenegi
                  secili={kip === "secim"}
                  onSelect={() => setKip("secim")}
                  kapali={secimKapali}
                  baslik="Marka ve tercihlerini kopyala"
                  aciklama={
                    serbest
                      ? "Serbest kalemde taşınacak defter satırı yok."
                      : kaynakSerbest
                        ? "Kaynak serbest bir kalem; defterde karşılığı olan satırı yok."
                        : "Kapasite, açıklık, güç, devir, çap ve adet gibi ölçüler kopyalanmaz — onlar her vince özeldir."
                  }
                />
                <KipSecenegi
                  secili={tam}
                  onSelect={() => setKip("tam")}
                  baslik="Kalemin tamamını kopyala"
                  aciklama="Bölümler, ölçüler, gizli satırlar ve kaleme bağlı FİYAT SATIRLARI da gelir; teklif toplamı anında artar. Kopya kaynağın hemen ardına girer."
                />
              </div>
            </div>
          ) : null}

          {/* ————————————————————————————————— şablon ve ad */}
          <div className="grid gap-1.5">
            <Label htmlFor="yeni_kalem_sablon">Vinç Tipi / Şablon</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={tam}>
              <SelectTrigger id="yeni_kalem_sablon" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                {/*
                  SERBEST KALEM (kullanıcı isteği, 17.08.2026: *"yedek teklifi
                  verebilirim; yedek teklifinde teknik özellikleri kendim elle
                  girebileceğim bir yapı da isterim"*). Yedek parça, kabin
                  değişimi ya da bir revizyon işi vinç defterine sığmaz: satır
                  etiketleri de değerleri de o işe özeldir.
                */}
                <SelectItem value={SERBEST}>Serbest — teknik özellikleri elle gir</SelectItem>
              </SelectContent>
            </Select>
            {/* GİZLENMEZ, DEVRE DIŞI BIRAKILIR: kullanıcı neyin niçin
                sorulmadığını görmelidir. Kaybolan bir kutu, "bu ekran bozuk mu"
                sorusunu doğurur. */}
            {tam ? (
              <p className="text-xs text-muted-foreground">
                Bölümler ve vinç tipi <span className="font-medium">kaynak kalemden</span> gelir.
              </p>
            ) : serbest ? (
              <p className="text-xs text-muted-foreground">
                Tek bir <span className="font-medium">TEKNİK ÖZELLİKLER</span> bölümü kurulur;
                satır etiketlerini ve değerlerini kendiniz yazarsınız (yedek parça, kabin
                değişimi, revizyon işi…).
              </p>
            ) : gruplar.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Kurulacak bölümler:{" "}
                {gruplar.map((k) => OFFER_GROUP_DEF_BY_KEY[k]?.title ?? k).join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="yeni_kalem_baslik">Kalem Başlığı</Label>
            <Input
              id="yeni_kalem_baslik"
              value={baslik}
              disabled={tam}
              onChange={(e) => setBaslik(kalemBasligiBuyuk(e.target.value))}
              className="text-base pointer-fine:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {tam ? (
                <>
                  Kopyanın adı <span className="font-medium">{defaultItemTitle(sira)}</span> gibi
                  kurulur; kaynağın adı taşınmaz (belgede iki bölüm aynı başlığı taşırdı).
                </>
              ) : (
                <>
                  Boş bırakılırsa <span className="font-medium">{varsayilanAd}</span> adıyla açılır
                  {serbest ? "." : "; kapasite ve vinç tipi girildiğinde başlık kendiliğinden yazılır."}
                </>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={ekle} disabled={tam ? !kaynak : !sablon}>
            <Plus className="size-4" /> Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Kip listesinin bir satırı — görsel, bugünkü onay kutusunun aynısı. */
function KipSecenegi({
  secili,
  kapali,
  baslik,
  aciklama,
  onSelect,
}: {
  secili: boolean;
  kapali?: boolean;
  baslik: string;
  aciklama: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={secili}
      disabled={kapali}
      onClick={onSelect}
      className={cn(
        "oc-tap flex items-start gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted",
        kapali && "cursor-not-allowed opacity-50 hover:bg-transparent"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
          secili && !kapali
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40"
        )}
      >
        {secili && !kapali ? <Check className="size-3" /> : null}
      </span>
      <span>
        <span className="font-medium">{baslik}</span>
        <span className="block text-xs text-muted-foreground">{aciklama}</span>
      </span>
    </button>
  );
}
