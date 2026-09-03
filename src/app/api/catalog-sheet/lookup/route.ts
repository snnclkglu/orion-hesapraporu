// Editörde açık kalmış bir istemci yeni katalog manifestini henüz taşımıyorsa
// seçilen ürünün föyünü güncel sunucu manifestinden çözer. Yalnız manifestte
// zaten müşteriye açık olan katalog meta verisi döner; dosya yolu yine izin
// listeli `/api/catalog-sheet/...` ucundan sunulur.

import {
  catalogSheetImages,
  findCatalogSheet,
  type CatalogSheet,
} from "@/lib/catalog-sheets";

function first(search: URLSearchParams, key: string): string {
  return search.get(key)?.trim() ?? "";
}

function publicSheet(sheet: CatalogSheet): CatalogSheet {
  return { ...sheet, images: [...catalogSheetImages(sheet)] };
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const kind = first(search, "tur");
  const brand = first(search, "marka");
  const model = first(search, "model");
  const inputRpmRaw = first(search, "n1");

  if (!kind || !model || kind.length > 64 || brand.length > 160 || model.length > 320) {
    return Response.json({ error: "Geçersiz katalog kimliği" }, { status: 400 });
  }

  const inputRpm = inputRpmRaw ? Number(inputRpmRaw) : undefined;
  const sheet = findCatalogSheet(kind, brand || null, model, {
    inputRpm: Number.isFinite(inputRpm) ? inputRpm : undefined,
  });
  if (!sheet) {
    return Response.json(
      { error: "Katalog sayfası bulunamadı" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { sheet: publicSheet(sheet) },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    }
  );
}
