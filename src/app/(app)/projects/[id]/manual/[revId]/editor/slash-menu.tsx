"use client";

// BLOK EKLEME MENÜSÜ — bloklar arasındaki "+" ve `/` komutu aynı menüyü açar.
//
// EKLEME BİR TIKTIR ve NEREYE ekleneceği bellidir: eski editörde blok her
// zaman bölümün SONUNA ekleniyordu ve araya blok koymak için ok düğmesiyle
// yukarı taşımak gerekiyordu. Burada menü iki blok ARASINDAN açılır ve blok
// tam oraya düşer.
//
// METİN PARÇALARI DEFTERİ AYNI MENÜDEDİR (kullanıcı kararı, 30.08.2026):
// sık kullanılan paragraf/uyarı bir kez kaydedilir ve buradan eklenir. Defter
// satırı belgeye KOPYALANIR — defter sonradan değişse teslim edilmiş kılavuz
// değişmez.

import { useState } from "react";
import {
  Image as ImageIcon,
  List,
  ListOrdered,
  Layers,
  Plus,
  Ruler,
  ScrollText,
  Sigma,
  Table2,
  TriangleAlert,
  Type,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ManualBlock } from "@/lib/manual/types";
import { yeniBlokId } from "./use-manual-doc";

export interface SnippetSecenegi {
  id: string;
  title: string;
  category: string;
  sectionHint: string;
  block: ManualBlock;
}

const TURLER: {
  ad: string;
  ipucu: string;
  ikon: typeof Type;
  yap: () => ManualBlock;
}[] = [
  {
    ad: "Paragraf",
    ipucu: "Düz metin; satır sonları korunur",
    ikon: Type,
    yap: () => ({ id: yeniBlokId(), kind: "text", text: "" }),
  },
  {
    ad: "Madde listesi",
    ipucu: "Sırası önemli olmayan maddeler",
    ikon: List,
    yap: () => ({ id: yeniBlokId(), kind: "list", items: [""] }),
  },
  {
    ad: "Numaralı liste",
    ipucu: "Sırayla yapılacak işlem adımları",
    ikon: ListOrdered,
    yap: () => ({ id: yeniBlokId(), kind: "list", ordered: true, items: [""] }),
  },
  {
    ad: "Uyarı kutusu",
    ipucu: "NOT · ÖNEMLİ · DİKKAT · UYARI · TEHLİKE",
    ikon: TriangleAlert,
    yap: () => ({ id: yeniBlokId(), kind: "note", level: "uyari", text: "" }),
  },
  {
    ad: "Tablo",
    ipucu: "Elle yazılan çizelge",
    ikon: Table2,
    yap: () => ({
      id: yeniBlokId(),
      kind: "table",
      table: { head: ["", ""], rows: [["", ""]] },
    }),
  },
];

export function SlashMenu({
  disabled,
  parcalar,
  bolumKey,
  gorselEkle,
  semaEkle,
  paftaEkle,
  katalogEkle,
  onEkle,
  tetikSinifi,
  etiket = "Blok ekle",
}: {
  disabled?: boolean;
  parcalar: readonly SnippetSecenegi[];
  /** Seçili bölümün şablon anahtarı — defter önerisi buna göre sıralanır. */
  bolumKey?: string;
  /** Görsel ekleme akışını açar (dosya seçici). */
  gorselEkle?: () => void;
  /** Hesap motorunun şema seçicisini açar. */
  semaEkle?: () => void;
  /** Teknik Resim Takibi'nden pafta seçicisini açar. */
  paftaEkle?: () => void;
  /** Üretici katalog sayfası seçicisini açar. */
  katalogEkle?: () => void;
  onEkle: (blok: ManualBlock) => void;
  tetikSinifi?: string;
  etiket?: string;
}) {
  const [acik, setAcik] = useState(false);

  // BÖLÜME UYAN PARÇALAR ÖNCE: yüzlerce parçalı bir defterde aradığını
  // listenin dibinde aramak, defteri hiç kullanmamak demekti.
  const sirali = [...parcalar].sort((a, b) => {
    const au = a.sectionHint && a.sectionHint === bolumKey ? 0 : 1;
    const bu = b.sectionHint && b.sectionHint === bolumKey ? 0 : 1;
    return au - bu || a.title.localeCompare(b.title, "tr");
  });

  return (
    <Popover open={acik} onOpenChange={setAcik}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={etiket}
          title={etiket}
          className={cn(
            "oc-tap inline-flex items-center gap-1 text-xs text-muted-foreground",
            "hover:text-foreground disabled:opacity-40",
            tetikSinifi,
            // Çağıran `opacity-0` ile gizlese bile dokunmatikte GÖRÜNÜR:
            // parmakla kullanılan ekranda `hover` diye bir şey yoktur ve
            // "blok ekle" bu bileşenin TEK giriş yoludur. Garanti burada
            // durur, çağrı yerinde değil.
            "pointer-coarse:opacity-100"
          )}
        >
          <Plus className="size-3.5" /> {etiket}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Blok türü veya defter parçası ara" />
          <CommandList>
            <CommandEmpty>Eşleşen bir şey yok.</CommandEmpty>
            <CommandGroup heading="Blok">
              {TURLER.map((t) => (
                <CommandItem
                  key={t.ad}
                  value={`${t.ad} ${t.ipucu}`}
                  onSelect={() => {
                    onEkle(t.yap());
                    setAcik(false);
                  }}
                >
                  <t.ikon className="size-4" />
                  <span className="flex flex-col">
                    <span>{t.ad}</span>
                    <span className="text-xs text-muted-foreground">{t.ipucu}</span>
                  </span>
                </CommandItem>
              ))}
              {gorselEkle ? (
                <CommandItem
                  value="Görsel fotoğraf resim"
                  onSelect={() => {
                    gorselEkle();
                    setAcik(false);
                  }}
                >
                  <ImageIcon className="size-4" />
                  <span className="flex flex-col">
                    <span>Görsel</span>
                    <span className="text-xs text-muted-foreground">
                      Fotoğraf ya da çizim yükle
                    </span>
                  </span>
                </CommandItem>
              ) : null}
              {semaEkle ? (
                <CommandItem
                  value="Şema diyagram hesap çizim"
                  onSelect={() => {
                    semaEkle();
                    setAcik(false);
                  }}
                >
                  <Ruler className="size-4" />
                  <span className="flex flex-col">
                    <span>Şema (hesaptan)</span>
                    <span className="text-xs text-muted-foreground">
                      Halat donanımı, tambur, teker düzeni, kesit…
                    </span>
                  </span>
                </CommandItem>
              ) : null}
              {paftaEkle ? (
                <CommandItem
                  value="Pafta teknik resim montaj"
                  onSelect={() => {
                    paftaEkle();
                    setAcik(false);
                  }}
                >
                  <Layers className="size-4" />
                  <span className="flex flex-col">
                    <span>Pafta (teknik resimden)</span>
                    <span className="text-xs text-muted-foreground">
                      Montaj resminin bir yaprağı
                    </span>
                  </span>
                </CommandItem>
              ) : null}
              {katalogEkle ? (
                <CommandItem
                  value="Katalog sayfası föy üretici"
                  onSelect={() => {
                    katalogEkle();
                    setAcik(false);
                  }}
                >
                  <ScrollText className="size-4" />
                  <span className="flex flex-col">
                    <span>Katalog sayfası</span>
                    <span className="text-xs text-muted-foreground">
                      Bu vincin ekipmanına bağlı teknik föy
                    </span>
                  </span>
                </CommandItem>
              ) : null}
            </CommandGroup>

            {sirali.length > 0 ? (
              <CommandGroup heading="Defterden ekle">
                {sirali.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.title} ${p.category}`}
                    onSelect={() => {
                      // KOPYALANIR: yeni kimlik alır, `fromTemplate`/`derived`
                      // taşımaz — sıradan bir kullanıcı bloğudur.
                      onEkle({ ...p.block, id: yeniBlokId() });
                      setAcik(false);
                    }}
                  >
                    <Sigma className="size-4" />
                    <span className="flex flex-col">
                      <span>{p.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.category || p.block.kind}
                        {p.sectionHint === bolumKey ? " · bu bölüm için" : ""}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
