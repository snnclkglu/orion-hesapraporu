// İŞ DURUMU — sevk tarihinden türeyen otomatik geçişin KURALI.
//
// Kullanıcı kararı (13.08.2026): *"Satış Takibi sayfasında bir işe sevk
// tarihi girildiyse İşler sayfasında otomatik olarak durum tamamlandı olarak
// değiştirilsin. Ama İşler sayfasında yine kullanıcı isterse manuel müdahale
// yapabilsin."*
//
// Bu iki cümle bir arada ancak "otomatik kural yalnız VARSAYILAN durumu
// değiştirir" diye okunursa çelişmez; testler o okumayı dondurur.

import { describe, expect, it } from "vitest";
import {
  JOB_STATUSES,
  allItemsShipped,
  autoCompletesOnShipment,
  jobStatusLabel,
  jobStatusOf,
} from "../job-status";

const sevkli = (tarih: string | null) => ({ shipmentDate: tarih });

describe("allItemsShipped", () => {
  it("BÜTÜN kalemler sevk edildiyse doğrudur", () => {
    expect(allItemsShipped([sevkli("2026-03-01")])).toBe(true);
    expect(allItemsShipped([sevkli("2026-03-01"), sevkli("2026-04-12")])).toBe(true);
  });

  it("TEK BİR kalem eksikse yanlıştır — kural «herhangi biri» DEĞİL", () => {
    // Dokuz kalemli "MUHTELİF VİNÇLER" işinde ilk vincin sevki işi bitirmez;
    // atölye kalan sekizini imal ediyordur.
    expect(allItemsShipped([sevkli("2026-03-01"), sevkli(null)])).toBe(false);
    expect(
      allItemsShipped([...Array(8).fill(sevkli("2026-03-01")), sevkli(null)])
    ).toBe(false);
  });

  it("KALEMSİZ iş sevk edilmiş SAYILMAZ", () => {
    // `[].every(...)` doğru döner; kelepçe olmasaydı kalemleri henüz
    // girilmemiş yeni bir iş açılır açılmaz "Tamamlandı" olurdu.
    expect(allItemsShipped([])).toBe(false);
  });

  it("ticari kaydı olmayan kalem de sevk edilmemiştir", () => {
    // `job_item_sales` satırları önceden üretilmez (AGENTS md. 16): kaydı
    // olmayan kalem çağırana `null` olarak gelir.
    expect(allItemsShipped([sevkli(null), sevkli(null)])).toBe(false);
  });
});

describe("autoCompletesOnShipment — manuel müdahale güvencesi", () => {
  it("YALNIZ varsayılan durum (Aktif) otomatik değişir", () => {
    expect(JOB_STATUSES.filter(autoCompletesOnShipment)).toEqual(["active"]);
  });

  it("insan kararı olan üç durum KORUNUR", () => {
    // Beklemeye alınmış bir işi sevk tarihi yüzünden "tamamlandı" yapmak,
    // kullanıcının az önce verdiği kararı ezmek olurdu. Arşiv ve Tamamlandı da
    // aynı sebeple dokunulmazdır (ikincisi zaten hedefin kendisi).
    expect(autoCompletesOnShipment("passive")).toBe(false);
    expect(autoCompletesOnShipment("completed")).toBe(false);
    expect(autoCompletesOnShipment("archived")).toBe(false);
  });

  it("bilinmeyen değer VARSAYILANA düşer ve otomatiğe açıktır", () => {
    // `jobStatusOf` bilinmeyeni "active" sayar; kural onunla tutarlı olmalıdır,
    // yoksa bozuk bir satır otomatik akışın dışında sessizce kalırdı.
    expect(jobStatusOf("bilinmeyen")).toBe("active");
    expect(autoCompletesOnShipment("bilinmeyen")).toBe(true);
    expect(autoCompletesOnShipment(null)).toBe(true);
  });
});

describe("durum sözlüğü", () => {
  it("etiketler Türkçedir", () => {
    expect(jobStatusLabel("active")).toBe("Aktif");
    expect(jobStatusLabel("completed")).toBe("Tamamlandı");
  });
});
