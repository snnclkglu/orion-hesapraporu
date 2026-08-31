"use client";

// BELGENİN TEK DEĞİŞTİRME KAPISI.
//
// Bütün ağaç işlemleri buradan geçer ve hepsi `lib/manual/edit-ops.ts`teki SAF
// fonksiyonları çağırır. Bileşenler kendi başlarına `sections`a dokunmaz:
// dokunsalardı aynı işlem (blok taşıma) ok düğmesinde bir, sürüklemede başka
// türlü davranırdı ve ikisi bir gün ayrışırdı (değişmez md. 8).
//
// KAYDETME BURADA DEĞİL. Bu kanca yalnız YEREL gövdeyi değiştirir ve `kirli`
// bayrağını açar; veritabanına yazan tek yer `Kaydet` düğmesidir (KITAP-10).

import { useCallback, useMemo, useState } from "react";
import {
  blockAppend,
  blockInsertAt,
  blockMove,
  blockRemove,
  blockReorder,
  blockRevertToTemplate,
  blockUpdate,
  sectionFind,
  sectionMove,
  sectionRename,
  sectionReorder,
  type Yon,
} from "@/lib/manual/edit-ops";
import {
  applyManualPackage,
  manualSetAppendixOption,
  manualToggleSection,
} from "@/lib/manual/packages";
import { flattenManual, numberManual } from "@/lib/manual/payload";
import type {
  ManualAppendixKind,
  ManualBlock,
  ManualPackageKey,
  ManualPayload,
} from "@/lib/manual/types";

export interface ManualDoc {
  payload: ManualPayload;
  kirli: boolean;
  /** Numaralanmış ağaç ve düzleştirilmiş hâli — bütün paneller bunu okur. */
  numarali: ReturnType<typeof numberManual>;
  duz: ReturnType<typeof flattenManual>;

  seciliBolumId: string;
  seciliBlokId: string | null;
  bolumSec: (id: string) => void;
  blokSec: (id: string | null) => void;

  /** Sunucudan gelen gövdeyi (türetim sonucu) benimser. */
  govdeyiBenimse: (p: ManualPayload, kirliYap?: boolean) => void;
  temizle: () => void;

  bolumBaslik: (id: string, v: string) => void;
  bolumGizle: (id: string) => void;
  bolumTasi: (id: string, yon: Yon) => void;
  bolumSirala: (id: string, hedefParentId: string | null, index: number) => void;

  blokGuncelle: (bolumId: string, blokId: string, f: (b: ManualBlock) => ManualBlock) => void;
  blokEkle: (bolumId: string, index: number, blok: ManualBlock) => void;
  blokSonaEkle: (bolumId: string, blok: ManualBlock) => void;
  blokSil: (bolumId: string, blokId: string) => void;
  blokTasi: (bolumId: string, blokId: string, yon: Yon) => void;
  blokSirala: (bolumId: string, blokId: string, index: number) => void;
  blokGizle: (bolumId: string, blokId: string) => void;
  standardaDon: (bolumId: string, blokId: string) => void;

  paketUygula: (key: ManualPackageKey, bastan?: boolean) => { korunan: string[]; degisen: number };
  ekSecenegi: (kind: ManualAppendixKind, option: string) => void;
}

/** Yeni blok kimliği — belgedeki kimliklerle çakışmaz. */
export function yeniBlokId(): string {
  return `y${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function useManualDoc(
  ilkPayload: ManualPayload,
  ilkSecili: string
): ManualDoc {
  const [payload, setPayload] = useState<ManualPayload>(ilkPayload);
  const [kirli, setKirli] = useState(false);
  const [seciliBolumId, setSeciliBolumId] = useState(ilkSecili);
  const [seciliBlokId, setSeciliBlokId] = useState<string | null>(null);

  const numarali = useMemo(() => numberManual(payload.sections), [payload.sections]);
  const duz = useMemo(() => flattenManual(numarali), [numarali]);

  const yaz = useCallback((f: (p: ManualPayload) => ManualPayload) => {
    setPayload((p) => f(p));
    setKirli(true);
  }, []);

  /** Ağaç işlemlerinin ortak sarmalayıcısı. */
  const agac = useCallback(
    (f: (s: ManualPayload["sections"]) => ManualPayload["sections"]) =>
      yaz((p) => ({ ...p, sections: f(p.sections) })),
    [yaz]
  );

  const bolumSec = useCallback((id: string) => {
    setSeciliBolumId(id);
    // Bölüm değişince blok seçimi düşer: müfettişte başka bölümün bloğunun
    // ayarlarını göstermek, kullanıcının yanlış bloğu düzenlemesi demekti.
    setSeciliBlokId(null);
  }, []);

  const blokGuncelle = useCallback(
    (bolumId: string, blokId: string, f: (b: ManualBlock) => ManualBlock) => {
      // HER DÜZENLEME `edited` AÇAR: şablon tazelemesi ve kaynaktan toplu
      // doldurma kullanıcının yazdığını bir daha ezmez (KITAP-4 · KITAP-21).
      agac((s) => blockUpdate(s, bolumId, blokId, (b) => ({ ...f(b), edited: true })));
    },
    [agac]
  );

  return {
    payload,
    kirli,
    numarali,
    duz,
    seciliBolumId,
    seciliBlokId,
    bolumSec,
    blokSec: setSeciliBlokId,

    govdeyiBenimse: useCallback((p: ManualPayload, kirliYap = true) => {
      setPayload(p);
      if (kirliYap) setKirli(true);
    }, []),
    temizle: useCallback(() => setKirli(false), []),

    bolumBaslik: useCallback(
      (id, v) => agac((s) => sectionRename(s, id, v)),
      [agac]
    ),
    // GİZLEME KAPSAM SAPMASINI DA YAZAR (KITAP-20): görünürlüğü değiştiren tek
    // giriş budur; ağacı çeviren ve sapmayı kaydeden iki ayrı çağrı olsaydı
    // sapma bir yerde kaydedilir bir yerde kaydedilmezdi.
    bolumGizle: useCallback((id) => yaz((p) => manualToggleSection(p, id)), [yaz]),
    bolumTasi: useCallback((id, yon) => agac((s) => sectionMove(s, id, yon)), [agac]),
    bolumSirala: useCallback(
      (id, hedefParentId, index) => agac((s) => sectionReorder(s, id, hedefParentId, index)),
      [agac]
    ),

    blokGuncelle,
    blokEkle: useCallback(
      (bolumId, index, blok) => agac((s) => blockInsertAt(s, bolumId, index, blok)),
      [agac]
    ),
    blokSonaEkle: useCallback(
      (bolumId, blok) => agac((s) => blockAppend(s, bolumId, blok)),
      [agac]
    ),
    blokSil: useCallback(
      (bolumId, blokId) => {
        agac((s) => blockRemove(s, bolumId, blokId));
        setSeciliBlokId((v) => (v === blokId ? null : v));
      },
      [agac]
    ),
    blokTasi: useCallback(
      (bolumId, blokId, yon) => agac((s) => blockMove(s, bolumId, blokId, yon)),
      [agac]
    ),
    blokSirala: useCallback(
      (bolumId, blokId, index) => agac((s) => blockReorder(s, bolumId, blokId, index)),
      [agac]
    ),
    // GİZLEMEK `edited` AÇMAZ: kapsam kararıdır, içerik düzenlemesi değil.
    // Açsaydı gizlenen bir standart blok "Standarda Dön"ü kaybederdi.
    blokGizle: useCallback(
      (bolumId, blokId) =>
        agac((s) => blockUpdate(s, bolumId, blokId, (b) => ({ ...b, hidden: !b.hidden }))),
      [agac]
    ),
    standardaDon: useCallback(
      (bolumId, blokId) => agac((s) => blockRevertToTemplate(s, bolumId, blokId)),
      [agac]
    ),

    paketUygula: useCallback(
      (key: ManualPackageKey, bastan = false) => {
        // Saf çekirdek saat okumaz; uygulama anını ÇAĞIRAN verir.
        const sonuc = applyManualPackage(payload, key, {
          at: new Date().toISOString(),
          sapmalariYokSay: bastan,
        });
        setPayload(sonuc.payload);
        setKirli(true);
        return { korunan: sonuc.korunan, degisen: sonuc.degisen };
      },
      [payload]
    ),
    ekSecenegi: useCallback(
      (kind: ManualAppendixKind, option: string) =>
        yaz((p) => manualSetAppendixOption(p, kind, option)),
      [yaz]
    ),
  };
}

/** Bölümü kimliğiyle bulur — panellerin ortak yardımcısı. */
export function bolumBul(payload: ManualPayload, id: string) {
  return sectionFind(payload.sections, id);
}
