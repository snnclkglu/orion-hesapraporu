// EL KİTABINA GİDEN PANO ŞEMALARININ KATALOGU — saf, DB/HTTP'siz.
//
// El kitabı şema seçicisi bir KATALOG ister (anahtar + başlık) ve seçilince
// tek bir MODEL. Bu ayrım hesap şemalarında ölçüldü: seksen şemanın modelini
// birden indirmek açılışta bir megabayt taşımak demekti.
//
// LİSTE GERÇEKTEN ÇİZİLENLERDİR. Boş bir dizinin dizilim şeması ya da kapak
// elemanı olmayan bir panonun kapak görünüşü listeye HİÇ girmez — kullanıcıya
// seçebileceğini sanıp boş dönen bir satır göstermek, hiç göstermemekten
// kötüdür.
//
// KATALOG SAF TUTULUR ki sınanabilsin: uç dosyası `server-only`dir ve içine
// yazılan bir mantık hiçbir testten geçemezdi.

import type { LayoutResult } from "@/lib/switchboard/types";
import type { Diagram } from "./model";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
  panoKapakDiagram,
  type IcOlcek,
} from "./panoLayout";

/** El kitabı seçicisinin beklediği hafif kayıt (hesap şemalarıyla aynı biçim). */
export interface PanoSemaKaydi {
  key: string;
  baslik: string;
  modul: string;
  bolum: string;
}

export interface PanoSemaGirdisi {
  kayit: PanoSemaKaydi;
  /** Modeli ÇÖZER — yalnız seçilen şema için çağrılır. */
  ciz: () => Diagram | null;
}

/**
 * EL KİTABINA GİDEN ÖLÇEK 1:4'tür.
 *
 * Kılavuzu okuyan bakımcı panonun tamamını bir sayfada görmek ister. Ayrıca
 * kâğıttaki oran zaten modelin ölçeği değildir (PANO-28: `PdfDiagram` çizimi
 * sayfaya yeniden sığdırır), o yüzden model ölçeği burada yalnız AYRINTI
 * YOĞUNLUĞUNU belirler.
 */
export const KITAP_OLCEGI: IcOlcek = 4;

/** Bu işte çizilebilen pano şemalarının katalogu. */
export function panoSemaKatalogu(sonuc: LayoutResult): PanoSemaGirdisi[] {
  const out: PanoSemaGirdisi[] = [];

  if (sonuc.room.length > 0) {
    out.push({
      kayit: {
        key: "pano:oda",
        baslik: "Elektrik odası pano dizilimi",
        modul: "Pano Yerleşimi",
        bolum: `${sonuc.room.length} göz · ön görünüş`,
      },
      ciz: () =>
        panoDizilimDiagram({
          panels: sonuc.room,
          baslik: "Elektrik odası pano dizilimi",
          not: `${sonuc.room.length} göz · ön görünüş · panolar bitişik`,
          yanCihazlar: sonuc.roomSideDevices,
        }),
    });
  }

  if (sonuc.field.length > 0) {
    out.push({
      kayit: {
        key: "pano:saha",
        baslik: "Saha panoları dizilimi",
        modul: "Pano Yerleşimi",
        bolum: `${sonuc.field.length} göz · elektrik odasına girmez`,
      },
      ciz: () =>
        panoDizilimDiagram({
          panels: sonuc.field,
          baslik: "Saha panoları",
          not: `${sonuc.field.length} göz · elektrik odasına girmez`,
          yanCihazlar: sonuc.fieldSideDevices,
        }),
    });
  }

  for (const p of [...sonuc.room, ...sonuc.field]) {
    if (p.placements.length > 0) {
      out.push({
        kayit: {
          key: `pano:ic:${p.code}`,
          baslik: `${p.code} iç yerleşimi`,
          modul: "Pano Yerleşimi",
          bolum: `${p.widthMm}×${p.heightMm}×${p.depthMm} mm · ${p.placements.length} cihaz`,
        },
        ciz: () =>
          panoIcYerlesimDiagram({
            panel: p,
            settings: sonuc.settings,
            olcek: KITAP_OLCEGI,
          }),
      });
    }
    // BOŞ KAPAK ÇİZİLMEZ: `panoKapakDiagram` zaten `null` döner ve boş bir
    // kapak resmi bilgi taşımaz; listeye de girmemeli.
    if (p.doorPlacements.length > 0) {
      out.push({
        kayit: {
          key: `pano:kapak:${p.code}`,
          baslik: `${p.code} kapak görünüşü`,
          modul: "Pano Yerleşimi",
          bolum: `${p.doorPlacements.length} kapak elemanı`,
        },
        ciz: () =>
          panoKapakDiagram({ panel: p, settings: sonuc.settings, olcek: KITAP_OLCEGI }),
      });
    }
  }

  return out;
}
