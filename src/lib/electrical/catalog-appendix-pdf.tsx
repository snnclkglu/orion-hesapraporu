import { Document, Link, Text, View } from "@react-pdf/renderer";
import { BRAND, BrandBand, BrandPage, FONTS, PAGE, RuleRed, T, mm } from "@/lib/pdf/brand";

/** EK-F içindeki tek katalog/teknik föy grubu. */
export interface ElectricalCatalogAppendixEntry {
  anchor: string;
  label: string;
  pageCount: number;
}

/** Kaynak PDF sayfasının markalı yaprak içinde çizileceği güvenli kutu. */
export const CATALOG_PAGE_BOX = {
  x: PAGE.contentLeft,
  y: mm(20),
  width: 595.28 - PAGE.contentLeft - PAGE.marginOuter,
  height: 841.89 - mm(20) - (PAGE.marginTop + 52),
} as const;

const INDEX_PER_PAGE = 42;

export function catalogAppendixIndexPageCount(entryCount: number): number {
  return Math.max(1, Math.ceil(entryCount / INDEX_PER_PAGE));
}

export function ElectricalCatalogAppendixPdf({
  entries,
}: {
  entries: readonly ElectricalCatalogAppendixEntry[];
}) {
  const indexPageCount = catalogAppendixIndexPageCount(entries.length);
  const startPages: number[] = [];
  let cursor = indexPageCount + 1;
  for (const entry of entries) {
    startPages.push(cursor);
    cursor += entry.pageCount;
  }

  const indexPages = Array.from({ length: indexPageCount }, (_, i) =>
    entries.slice(i * INDEX_PER_PAGE, (i + 1) * INDEX_PER_PAGE)
  );

  return (
    <Document
      title="EK-F Elektrik Ekipman Katalog Sayfaları"
      author="ORION Cranes"
      subject="Elektrik malzeme listesine bağlı teknik katalog sayfaları"
    >
      {indexPages.map((pageEntries, pageIndex) => {
        const half = Math.ceil(pageEntries.length / 2);
        return (
          <BrandPage
            key={`index-${pageIndex}`}
            docLine="ORION CRANES · ELEKTRİK EKİPMAN KATALOG SAYFALARI"
            docCode="EK-F"
            hidePageNumber
          >
            <BrandBand
              docCode="EK-F"
              lines={[`DİZİN ${pageIndex + 1} / ${indexPageCount}`]}
              manualHeight={40}
              marginBottom={8}
            />
            <Text style={{ fontSize: 15, fontWeight: 800 }}>ELEKTRİK EKİPMAN KATALOG SAYFALARI</Text>
            <View style={{ marginTop: 5 }}><RuleRed width={54} /></View>
            <Text style={{ ...T.caption, marginTop: 6, marginBottom: 8 }}>
              Satıra tıklayarak ilgili teknik sayfaya geçebilirsiniz. Aynı teknik sayfa birden çok
              üründe kullanılıyorsa yalnız bir kez basılır.
            </Text>
            <View style={{ flexDirection: "row", gap: 18 }}>
              {[pageEntries.slice(0, half), pageEntries.slice(half)].map((column, columnIndex) => (
                <View key={columnIndex} style={{ width: (595.28 - PAGE.contentLeft - PAGE.marginOuter - 18) / 2 }}>
                  {column.map((entry) => {
                    const globalIndex = entries.indexOf(entry);
                    const start = startPages[globalIndex];
                    const end = start + entry.pageCount - 1;
                    return (
                      <Link
                        key={entry.anchor}
                        src={`#${entry.anchor}`}
                        style={{
                          minHeight: 18,
                          paddingVertical: 3,
                          borderBottomWidth: 0.35,
                          borderBottomColor: BRAND.hairline,
                          flexDirection: "row",
                          textDecoration: "none",
                          color: BRAND.ink,
                        }}
                      >
                        <Text style={{ width: 24, fontFamily: FONTS.mono, fontSize: 7, color: BRAND.red }}>
                          {String(globalIndex + 1).padStart(3, "0")}
                        </Text>
                        <Text style={{ flex: 1, fontSize: 7.2, lineHeight: 1.25 }}>{entry.label}</Text>
                        <Text style={{ width: 42, textAlign: "right", fontFamily: FONTS.mono, fontSize: 7, color: BRAND.gray600 }}>
                          {start === end
                            ? `F-${String(start).padStart(3, "0")}`
                            : `F-${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}`}
                        </Text>
                      </Link>
                    );
                  })}
                </View>
              ))}
              <View
                style={{
                  position: "absolute",
                  left: (595.28 - PAGE.contentLeft - PAGE.marginOuter) / 2,
                  top: 0,
                  bottom: 0,
                  width: 0.45,
                  backgroundColor: BRAND.line300,
                }}
              />
            </View>
          </BrandPage>
        );
      })}

      {entries.flatMap((entry, entryIndex) =>
        Array.from({ length: entry.pageCount }, (_, pageIndex) => (
          <BrandPage
            key={`${entry.anchor}-${pageIndex}`}
            docLine="ORION CRANES · ELEKTRİK EKİPMAN KATALOG SAYFALARI"
            docCode="EK-F"
            hidePageNumber
          >
            {pageIndex === 0 ? <View id={entry.anchor} style={{ height: 0 }} /> : null}
            <BrandBand
              docCode={`EK-F · ${String(entryIndex + 1).padStart(3, "0")}`}
              lines={[`${pageIndex + 1} / ${entry.pageCount}`]}
              manualHeight={40}
              marginBottom={8}
            />
          </BrandPage>
        ))
      )}
    </Document>
  );
}
