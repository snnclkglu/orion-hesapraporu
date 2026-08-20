// Teknik resim PDF'inin GÖRÜNTÜLEME KOPYASI.
//
// Depodaki asıl dosya değişmez. Tarayıcıya giden geçici kopyanın her sayfasına
// oturum sahibinin kimliği basılır; ekran görüntüsü ya da ağ araçlarıyla
// alınmış bir kopya böylece anonim ve temiz bir asıl gibi dolaşamaz.

import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

function ascii(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

/** Filigranda basılan izlenebilir kimlik; standart Helvetica için ASCII'dir. */
export function drawingViewerMark(identity: string, viewedAt: Date): string {
  const who = ascii(identity).slice(0, 96) || "oturumlu-kullanici";
  const stamp = viewedAt.toISOString().slice(0, 16).replace("T", " ");
  return `ORION | ${who} | ${stamp} UTC`;
}

/**
 * PDF'in kişiye özel, filigranlı görüntüleme kopyasını üretir.
 *
 * Bu bir DRM iddiası değildir: ekranda görülebilen içerik ekran görüntüsüyle
 * kaydedilebilir. Güvenlik değeri, asıl depo URL'sini saklamak ve sızan
 * görüntüyü hangi oturumun açtığını görünür kılmaktır.
 */
export async function protectDrawingPdf(
  input: Uint8Array,
  identity: string,
  viewedAt = new Date()
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, { updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const mark = drawingViewerMark(identity, viewedAt);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(14, Math.min(28, width / 42));
    const markWidth = font.widthOfTextAtSize(mark, size);
    const x = Math.max(-markWidth * 0.08, (width - markWidth) / 2);

    // Üç iz, büyük paftada kırpılsa bile en az birinin görünmesini sağlar;
    // düşük opaklık teknik ölçü ve çizgilerin okunmasını korur.
    for (const ratio of [0.2, 0.5, 0.8]) {
      page.drawText(mark, {
        x,
        y: height * ratio,
        size,
        font,
        color: rgb(0.16, 0.18, 0.22),
        opacity: 0.11,
        rotate: degrees(28),
      });
    }

    // Çapraz iz kadraj dışında bırakılırsa kimlik yine sayfanın altında kalır.
    page.drawText(mark, {
      x: 10,
      y: 8,
      size: 6,
      font,
      color: rgb(0.16, 0.18, 0.22),
      opacity: 0.55,
    });
  }

  return pdf.save();
}
