// TARİH+SAAT — İSTANBUL SAATİYLE, çalıştığı yerin saatiyle değil.
//
// Bildirim satırları hem sunucuda (panel bölümü, /notifications) hem
// istemcide (zil) basılır. Sunucu UTC'de koşar: `timeZone` verilmeyen bir
// `toLocaleString` orada üç saat geri yazardı ve aynı satır zilde başka,
// panelde başka bir saat gösterirdi. Tek biçimlendirici, tek dilim.

export function tarihSaatIstanbul(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      });
}
