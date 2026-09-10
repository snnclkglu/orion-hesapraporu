import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("UI/UX iş akışı korumaları", () => {
  it("Satın Alma filtre sonucunu 50 satırlık sayfalara böler ve seçimi açık kapsamla yürütür", () => {
    const source = read("src/app/(app)/purchasing/demand-table.tsx");

    expect(source).toContain("const PAGE_SIZE = 50");
    expect(source.indexOf("const gorunen = useMemo")).toBeLessThan(
      source.indexOf("const sayfaSatirlari = gorunen.slice")
    );
    expect(source).toContain("sayfaSatirlari.map((g)");
    expect(source).toContain("total={gorunen.length}");
    expect(source).toContain("Bu sayfadaki kalemlerin tamamını seç");
    expect(source).toContain("Filtre Sonucundaki");
    expect(source).not.toContain("gorunen.map((g) => (\n                <Satir");
  });

  it("bildirim hatasını boş liste gibi göstermez ve yeniden deneme sunar", () => {
    const bell = read("src/components/notification-bell.tsx");
    const page = read("src/app/(app)/notifications/page.tsx");

    expect(bell).toContain('status: "error"');
    expect(bell).toContain('kind="error"');
    expect(bell).toContain("Tekrar Dene");
    expect(page).toContain("Bildirimler yüklenemedi");
    expect(page).toContain("RetryNotificationsButton");
  });

  it("komut paleti ağ hatasını yüzeyi kapatmadan yeniden deneyebilir", () => {
    const source = read("src/components/command-palette.tsx");

    expect(source).toContain("Arama defteri yüklenemedi.");
    expect(source).toContain("onClick={ensureCommandIndex}");
    expect(source).toContain("sonuc.toplam.toLocaleString");
  });

  it("revizyon editörü kaydetme durumunu ve uygun olmayan kontrol turunu görünür tutar", () => {
    const source = read(
      "src/app/(app)/projects/[id]/revisions/[revId]/revision-editor.tsx"
    );

    expect(source).toContain("Kaydedilmemiş değişiklikler");
    expect(source).toContain("function goToNextProblem()");
    expect(source).toContain("Uygun Olmayanlar");
    expect(source).toContain("Sonraki Uygun Olmayan");
  });

  it("kayıtlı İşler görünümünün etkin hâli erişilebilir olarak işaretlenir", () => {
    const source = read("src/app/(app)/jobs/views-menu.tsx");

    expect(source).toContain("const currentKey = gorunumAnahtari");
    expect(source).toContain("aria-pressed={etkin}");
    expect(source).toContain('etkin && "border-primary');
  });
});
