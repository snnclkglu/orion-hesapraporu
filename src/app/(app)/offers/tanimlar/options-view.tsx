"use client";

// TEKLİF DEFTERİ — liste liste madde düzenleyicisi.
//
// DÜZENLEME YERİNDEDİR, PENCEREDE DEĞİL (görev şablonu defterinin kuralı):
// burada yapılan işlerin neredeyse tamamı "bir markanın yazımını düzelt" ya da
// "bu maddeyi listeden düşür"dür; her biri için pencere açtırmak en sık işi üç
// tıka çıkarırdı. Kutunun değeri `defaultValue` + `key` iledir, efektle senkron
// DEĞİL — sunucudan gelen satır değişince kutu kimliği de değişir ve React onu
// kendiliğinden tazeler.
//
// SİLME İSTİSNADIR ve onay ister: pasife almak defterle geçmiş arasındaki bağı
// korur, silmek koparır (yayınlanmış teklif değişmez ama listenin neden o hâle
// geldiği okunamaz olur).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, ChevronRight, Plus, Star, Trash2 } from "lucide-react";
import {
  createOfferOption,
  deleteOfferOption,
  moveOfferOption,
  updateOfferOption,
} from "./actions";
import type { OfferOptionRow } from "../data";
import { offerValueUpper } from "@/lib/offers/options";
import { offerListGroup, offerListLabel } from "@/lib/offers/registry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ObekAnahtari = ReturnType<typeof offerListGroup>;

/** Öbek başlıkları — sıra defterin okunma sırasıdır: önce marka, sonra metin. */
const OBEKLER: { key: ObekAnahtari; baslik: string; aciklama: string }[] = [
  {
    key: "marka",
    baslik: "Markalar",
    aciklama: "Bileşen markaları ve markaya bağlı tip/seriler.",
  },
  {
    key: "teknik",
    baslik: "Teknik Değerler",
    aciklama: "Teklifin teknik satırlarında önerilen değerler.",
  },
  {
    key: "ticari",
    baslik: "Ticari Şartlar",
    aciklama: "Geçerlilik, teslim, nakliye, ödeme ve kapsam metinleri.",
  },
  {
    key: "kapak",
    baslik: "Kapak Metinleri",
    aciklama: "Belgenin ilk sayfasındaki hitap ve giriş paragrafı.",
  },
];

interface SilmeIstegi {
  id: string;
  value: string;
  cocukSayisi: number;
}

export function OptionsView({
  rows,
  listKeys,
}: {
  rows: OfferOptionRow[];
  /** Defterin TAMAMI (`allOfferListKeys`) — maddesi olmayan liste de görünür. */
  listKeys: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [silinecek, setSilinecek] = useState<SilmeIstegi | null>(null);

  function calistir(fn: () => Promise<{ error?: string }>, basari?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (basari) toast.success(basari);
      router.refresh();
    });
  }

  const { kartlar, cocukListesi, kokler, cocuklar } = useMemo(() => {
    // KADEMELİ LİSTE KENDİ KARTINI ALMAZ. `series.gearbox` maddeleri bir markanın
    // ÇOCUKLARIDIR; ayrı bir kartta gösterilseydi hangi serinin hangi markaya ait
    // olduğu ekranda hiç görünmezdi. Eşleşme anahtarın SONEKİNDEN çözülür
    // (`series.gearbox` ↔ `brand.gearbox`) — elle bir tablo yazmak, defterde yeni
    // bir kademeli alan açıldığında sessizce bayatlardı.
    const esleme = new Map<string, string>();
    const kartlar: string[] = [];
    for (const key of listKeys) {
      if (key.startsWith("series.")) {
        const marka = "brand." + key.slice("series.".length);
        if (listKeys.includes(marka)) {
          esleme.set(marka, key);
          continue;
        }
      }
      kartlar.push(key);
    }

    const kokler = new Map<string, OfferOptionRow[]>();
    const cocuklar = new Map<string, OfferOptionRow[]>();
    for (const row of rows) {
      const hedef = row.parent_id ? cocuklar : kokler;
      const anahtar = row.parent_id ?? row.list_key;
      const mevcut = hedef.get(anahtar);
      if (mevcut) mevcut.push(row);
      else hedef.set(anahtar, [row]);
    }

    return { kartlar, cocukListesi: esleme, kokler, cocuklar };
  }, [rows, listKeys]);

  const maddeSayisi = rows.length;
  const pasifSayisi = rows.filter((r) => !r.active).length;

  return (
    <div className="grid gap-6">
      {OBEKLER.map((obek) => {
        const anahtarlar = kartlar.filter((k) => offerListGroup(k) === obek.key);
        if (anahtarlar.length === 0) return null;
        return (
          <section key={obek.key} className="grid gap-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">{obek.baslik}</h2>
              <p className="text-sm text-muted-foreground">{obek.aciklama}</p>
            </div>
            {/* Kart genişliği 2xl'e kadar iki sütunda kalır: satırda kutu +
                beş eylem var, üç sütun onları 300px'e sıkıştırırdı. */}
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {anahtarlar.map((listKey) => (
                <ListeKarti
                  key={listKey}
                  listKey={listKey}
                  cocukAnahtar={cocukListesi.get(listKey)}
                  maddeler={kokler.get(listKey) ?? []}
                  cocuklar={cocuklar}
                  pending={pending}
                  calistir={calistir}
                  onSil={setSilinecek}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-[12px] text-muted-foreground">
        {kartlar.length} liste · {maddeSayisi} madde
        {pasifSayisi > 0 ? ` · ${pasifSayisi} pasif` : ""}. Pasif madde defterde kalır, yeni
        teklifin açılır listesinde görünmez.
      </p>

      {silinecek && (
        <SilmeOnayi
          istek={silinecek}
          pending={pending}
          onVazgec={() => setSilinecek(null)}
          onOnayla={() => {
            const id = silinecek.id;
            setSilinecek(null);
            calistir(() => deleteOfferOption(id), "Madde defterden silindi.");
          }}
        />
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————— kart

function ListeKarti({
  listKey,
  cocukAnahtar,
  maddeler,
  cocuklar,
  pending,
  calistir,
  onSil,
}: {
  listKey: string;
  /** Bu markanın tip/seri listesi (`series.*`); kademesiz listede yok. */
  cocukAnahtar?: string;
  maddeler: OfferOptionRow[];
  cocuklar: Map<string, OfferOptionRow[]>;
  pending: boolean;
  calistir: (fn: () => Promise<{ error?: string }>, basari?: string) => void;
  onSil: (istek: SilmeIstegi) => void;
}) {
  return (
    <section className="flex flex-col rounded-lg border bg-card">
      <header className="flex items-baseline justify-between gap-2 border-b px-3 py-2">
        {/* ANAHTARIN KENDİSİ EKRANDA GEÇMEZ (yetki ekranının kuralı, ROL-15):
            `brand.motor` bir iç addır ve defteri okuyan kişiye hiçbir şey
            anlatmaz. */}
        <h3 className="text-sm font-semibold tracking-tight">{offerListLabel(listKey)}</h3>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {maddeler.length}
        </span>
      </header>

      {maddeler.length === 0 ? (
        <div className="p-3">
          {/* MADDESİZ LİSTE DE GÖRÜNÜR: hangi listenin doldurulmayı beklediği
              ancak böyle okunur. Bazıları BİLEREK boştur — "Garanti" listesi
              boştur çünkü devralınan tekliflerin hiçbirinde garanti maddesi
              yok ve bir süre uydurmak teklifte yapılabilecek en pahalı hatadır
              (değişmez md. 4). */}
          <EmptyState
            title="MADDE YOK"
            description="Bu liste henüz doldurulmadı. Uydurulmuş bir değer eklemek yerine gerçek bir teklifte geçen metni yazın."
            className="border-0 px-3 py-6"
          />
        </div>
      ) : (
        <ul className="divide-y">
          {maddeler.map((madde, i) => (
            <MaddeSatiri
              key={madde.id}
              madde={madde}
              ilk={i === 0}
              son={i === maddeler.length - 1}
              cocukAnahtar={cocukAnahtar}
              cocuklari={cocuklar.get(madde.id) ?? []}
              pending={pending}
              calistir={calistir}
              onSil={onSil}
            />
          ))}
        </ul>
      )}

      <div className="mt-auto border-t p-2">
        <MaddeEkle
          listKey={listKey}
          parentId={null}
          etiket="Madde Ekle"
          pending={pending}
          calistir={calistir}
        />
      </div>
    </section>
  );
}

// ———————————————————————————————————————————————————————————— satır

function MaddeSatiri({
  madde,
  ilk,
  son,
  cocukAnahtar,
  cocuklari,
  pending,
  calistir,
  onSil,
}: {
  madde: OfferOptionRow;
  ilk: boolean;
  son: boolean;
  cocukAnahtar?: string;
  cocuklari: OfferOptionRow[];
  pending: boolean;
  calistir: (fn: () => Promise<{ error?: string }>, basari?: string) => void;
  onSil: (istek: SilmeIstegi) => void;
}) {
  const [acik, setAcik] = useState(false);

  /** Satırın tamamı yazılır: tek alan güncelleyen bir action, `note` gibi
   *  ekranda görünmeyen alanları her düzenlemede sıfırlardı. */
  function yaz(degisiklik: Partial<{ value: string; active: boolean; isDefault: boolean }>) {
    calistir(() =>
      updateOfferOption(madde.id, {
        value: madde.value,
        active: madde.active,
        isDefault: madde.is_default,
        note: madde.note,
        ...degisiklik,
      })
    );
  }

  return (
    <li className={cn(!madde.active && "bg-muted/30")}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="flex shrink-0 flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={pending || ilk}
            onClick={() => calistir(() => moveOfferOption(madde.id, -1))}
            aria-label="Yukarı taşı"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={pending || son}
            onClick={() => calistir(() => moveOfferOption(madde.id, 1))}
            aria-label="Aşağı taşı"
          >
            <ArrowDown className="size-3.5" />
          </Button>
        </span>

        {cocukAnahtar && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setAcik((a) => !a)}
            aria-expanded={acik}
            aria-label={madde.value + " tip / serileri"}
            title="Tip / seriler"
          >
            <ChevronRight className={cn("size-4 transition-transform", acik && "rotate-90")} />
          </Button>
        )}

        <Input
          key={`${madde.id}-${madde.value}`}
          defaultValue={madde.value}
          maxLength={200}
          aria-label="Madde metni"
          onBlur={(e) => {
            // BÜYÜTME onBlur'DA, onChange'DE DEĞİL. Kutu `defaultValue` + `key`
            // ile kontrolsüzdür (dosya başındaki karar); her tuşta değeri
            // yeniden yazmak imleci metnin sonuna atardı. Sunucu dönünce `key`
            // değişir ve React kutuyu büyük hâliyle kendiliğinden tazeler.
            // Muaf listelerde `offerValueUpper` metni olduğu gibi döndürür.
            const v = offerValueUpper(madde.list_key, e.target.value.trim());
            if (v && v !== madde.value) yaz({ value: v });
          }}
          className={cn(
            "h-8 min-w-0 flex-1",
            !madde.active && "text-muted-foreground line-through"
          )}
        />

        {cocukAnahtar && cocuklari.length > 0 && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {cocuklari.length}
          </span>
        )}

        {/* VARSAYILAN: yeni teklif açılınca kendiliğinden seçilen madde. Liste
            başına BİR tanedir; yazma yolu kardeşleri düşürür. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => yaz({ isDefault: !madde.is_default, active: true })}
          aria-pressed={madde.is_default}
          aria-label={madde.is_default ? "Varsayılanı kaldır" : "Varsayılan yap"}
          title={
            madde.is_default
              ? "Varsayılan — yeni teklifte hazır gelir"
              : "Varsayılan yap"
          }
        >
          <Star
            className={cn("size-4", madde.is_default ? "fill-primary text-primary" : "text-muted-foreground")}
          />
        </Button>

        <button
          type="button"
          disabled={pending}
          onClick={() => yaz({ active: !madde.active, isDefault: madde.active ? false : madde.is_default })}
          aria-pressed={madde.active}
          aria-label={madde.active ? "Pasife al" : "Etkinleştir"}
          title={
            madde.active
              ? "Etkin — teklifte önerilir; tıklayınca pasife düşer"
              : "Pasif — defterde kalır, teklifte önerilmez"
          }
          className={cn(
            "oc-tap-square grid size-5 shrink-0 place-items-center border transition-colors",
            madde.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent hover:border-primary"
          )}
        >
          <Check className="size-3.5" />
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() =>
            onSil({ id: madde.id, value: madde.value, cocukSayisi: cocuklari.length })
          }
          aria-label={madde.value + " maddesini sil"}
          title="Sil"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>

      {acik && cocukAnahtar && (
        // Kademe İÇERİDE yaşar: markanın serileri onun altında, girintili.
        <div className="border-t bg-muted/20 py-1 pl-6">
          {cocuklari.length === 0 ? (
            <p className="px-2 py-1 text-[12px] text-muted-foreground">
              Bu markanın tip / serisi defterde yok.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cocuklari.map((cocuk, i) => (
                <MaddeSatiri
                  key={cocuk.id}
                  madde={cocuk}
                  ilk={i === 0}
                  son={i === cocuklari.length - 1}
                  cocuklari={[]}
                  pending={pending}
                  calistir={calistir}
                  onSil={onSil}
                />
              ))}
            </ul>
          )}
          <div className="px-2 pt-1">
            <MaddeEkle
              listKey={cocukAnahtar}
              parentId={madde.id}
              etiket="Tip / Seri Ekle"
              pending={pending}
              calistir={calistir}
            />
          </div>
        </div>
      )}
    </li>
  );
}

// ————————————————————————————————————————————————————— yeni madde

function MaddeEkle({
  listKey,
  parentId,
  etiket,
  pending,
  calistir,
}: {
  listKey: string;
  parentId: string | null;
  etiket: string;
  pending: boolean;
  calistir: (fn: () => Promise<{ error?: string }>, basari?: string) => void;
}) {
  const [deger, setDeger] = useState("");

  function ekle() {
    const v = deger.trim();
    if (!v) return;
    setDeger("");
    calistir(() => createOfferOption({ listKey, parentId, value: v }));
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={deger}
        // YAZARKEN BÜYÜR (ad alanlarının kuralı, değişmez md. 3): kutu
        // kontrollü olduğu için imleç sorunu yoktur ve kullanıcı maddenin
        // deftere hangi yazımla gireceğini yazarken görür. Kip `listKey`ten
        // çıkar — muaf bir listede kutu dokunulmadan kalır.
        onChange={(e) => setDeger(offerValueUpper(listKey, e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            ekle();
          }
        }}
        maxLength={200}
        aria-label={etiket}
        className="h-8 min-w-0 flex-1"
      />
      <Button type="button" size="sm" variant="outline" onClick={ekle} disabled={pending || !deger.trim()}>
        <Plus className="size-3.5" />
        {etiket}
      </Button>
    </div>
  );
}

// ———————————————————————————————————————————————————————— silme onayı

function SilmeOnayi({
  istek,
  pending,
  onVazgec,
  onOnayla,
}: {
  istek: SilmeIstegi;
  pending: boolean;
  onVazgec: () => void;
  onOnayla: () => void;
}) {
  return (
    <Dialog open onOpenChange={(next) => !next && onVazgec()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Maddeyi Sil</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{istek.value}</span> defterden silinecek.
            {istek.cocukSayisi > 0 ? (
              <> Bu markaya bağlı {istek.cocukSayisi} tip / seri de birlikte gider.</>
            ) : null}{" "}
            Yayınlanmış teklifler DEĞİŞMEZ — değer belgede metin olarak dondurulmuştur. Geçmişi
            olan bir madde için doğru eylem silmek değil <em>pasife almaktır</em>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onVazgec}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onOnayla}>
            {pending ? "Siliniyor…" : "Kalıcı Olarak Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
