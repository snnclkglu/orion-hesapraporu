import { notFound } from "next/navigation";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { protectDrawingPdf } from "@/lib/pdf/drawing-viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") notFound();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([1191, 842]);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.08, 0.1, 0.14),
    borderWidth: 1,
  });
  page.drawRectangle({
    x: width - 365,
    y: 24,
    width: 341,
    height: 105,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.08, 0.1, 0.14),
    borderWidth: 1,
  });
  page.drawText("ORION CRANES - TECHNICAL DRAWING VIEWER FIXTURE", {
    x: width - 350,
    y: 98,
    size: 11,
    font: bold,
  });
  page.drawText("0057-00-0510-01 / REV 02", { x: width - 350, y: 75, size: 10, font });
  page.drawText("S235JR / t=15 mm / SCALE 1:5", { x: width - 350, y: 53, size: 9, font });

  page.drawRectangle({
    x: 250,
    y: 250,
    width: 690,
    height: 340,
    color: rgb(1, 1, 1),
    borderWidth: 4,
    borderColor: rgb(0.08, 0.1, 0.14),
  });
  for (const [x, y] of [
    [300, 300],
    [890, 300],
    [300, 540],
    [890, 540],
  ]) {
    page.drawCircle({ x, y, size: 24, borderWidth: 3 });
    page.drawLine({ start: { x: x - 34, y }, end: { x: x + 34, y }, thickness: 0.8 });
    page.drawLine({ start: { x, y: y - 34 }, end: { x, y: y + 34 }, thickness: 0.8 });
  }
  page.drawLine({ start: { x: 250, y: 640 }, end: { x: 940, y: 640 }, thickness: 0.8 });
  page.drawText("690", { x: 580, y: 650, size: 12, font });
  page.drawLine({ start: { x: 195, y: 250 }, end: { x: 195, y: 590 }, thickness: 0.8 });
  page.drawText("340", { x: 175, y: 405, size: 12, font, rotate: degrees(90) });
  page.drawText("PROTECTED VIEW - DIMENSIONS FOR UI QA ONLY", {
    x: 330,
    y: 190,
    size: 14,
    font: bold,
    color: rgb(0.35, 0.38, 0.43),
  });

  const source = await pdf.save();
  const bytes = await protectDrawingPdf(
    source,
    "muhendis@orioncranes.com",
    new Date("2026-08-20T10:35:00Z")
  );
  const response = new Uint8Array(bytes.byteLength);
  response.set(bytes);
  return new Response(response.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
    },
  });
}
