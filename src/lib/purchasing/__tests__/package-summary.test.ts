// Paket satın alma özeti — durum çıkarımı + FİYAT SIZINTISI KORUMASI.
//
// İkinci başlık bu dosyanın asıl sebebidir. Teknik Resimler ekranı mühendise
// ve ressama açıktır; Satın Alma modülü onlara AÇILMAYACAK (kullanıcı kararı,
// 12.08.2026). Aradaki tek geçit `drawing_purchase_summary(uuid)`
// fonksiyonudur ve o fonksiyonun sütun listesi bir güvenlik sınırıdır.
// Sınırın bir yorumla korunması yetmez: buradaki test migration dosyasını
// OKUR (`terms.test.ts` kalıbı) ve listede ticari bir sütun belirdiği gün
// kırılır.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  paketSatinAlmaOzeti,
  type OzetKalemi,
  type SiparisOzeti,
} from "../package-summary";

const BUGUN = "2026-08-12";

const kalem = (over: Partial<OzetKalemi> = {}): OzetKalemi => ({
  key: "SATINALMA:RULMAN 6205-Z",
  tanim: "RULMAN 6205-Z",
  sinif: "Rulman",
  malzeme: "",
  parcaKodu: "",
  adet: 10,
  ...over,
});

const ozet = (over: Partial<SiparisOzeti> = {}): SiparisOzeti => ({
  partKey: "SATINALMA:RULMAN 6205-Z",
  matchKey: "RULMAN 6205-Z",
  orderedQty: 10,
  receivedQty: 0,
  firstOrderedAt: "2026-07-01",
  nextDueAt: "2026-09-01",
  lastReceivedAt: null,
  orderCount: 1,
  openOrderCount: 1,
  ...over,
});

describe("durum çıkarımı", () => {
  it("sipariş kaydı da işareti de yoksa BEKLİYOR", () => {
    const s = paketSatinAlmaOzeti([kalem()], [], [], BUGUN).satirlar[0];
    expect(s.durum).toBe("bekliyor");
    expect(s.siparisAdedi).toBeNull();
    expect(s.termin).toBeNull();
  });

  it("sipariş var, teslim yok → SİPARİŞ VERİLDİ", () => {
    const s = paketSatinAlmaOzeti([kalem()], [ozet()], [], BUGUN).satirlar[0];
    expect(s.durum).toBe("siparis");
    expect(s.siparisTarihi).toBe("2026-07-01");
    expect(s.termin).toBe("2026-09-01");
  });

  it("bir kısmı geldiyse KISMİ — 'sipariş verildi'de kalmaz", () => {
    const s = paketSatinAlmaOzeti(
      [kalem()],
      [ozet({ receivedQty: 6 })],
      [],
      BUGUN
    ).satirlar[0];
    expect(s.durum).toBe("kismi");
  });

  it("TESLİM için İKİ TANIK ister: adet tamam VE açık sipariş yok", () => {
    // Adet tamam ama sipariş hâlâ açık — satınalmacı satırı güncellemiş,
    // siparişi kapatmamış. "Geldi" demek erken olurdu.
    const acik = paketSatinAlmaOzeti(
      [kalem()],
      [ozet({ receivedQty: 10, openOrderCount: 1 })],
      [],
      BUGUN
    ).satirlar[0];
    expect(acik.durum).toBe("kismi");

    const kapali = paketSatinAlmaOzeti(
      [kalem()],
      [ozet({ receivedQty: 10, openOrderCount: 0, lastReceivedAt: "2026-08-05" })],
      [],
      BUGUN
    ).satirlar[0];
    expect(kapali.durum).toBe("teslim");
  });

  it("adet yazılmadan kapanmış sipariş de TESLİMdir", () => {
    const s = paketSatinAlmaOzeti(
      [kalem()],
      [ozet({ receivedQty: 0, openOrderCount: 0, lastReceivedAt: "2026-08-05" })],
      [],
      BUGUN
    ).satirlar[0];
    expect(s.durum).toBe("teslim");
  });

  it("sipariş kaydı yok ama işaret varsa SİPARİŞ — ve bu AÇIKÇA söylenir", () => {
    const s = paketSatinAlmaOzeti(
      [kalem()],
      [],
      [{ key: "SATINALMA:RULMAN 6205-Z", doneAt: "2026-06-15" }],
      BUGUN
    ).satirlar[0];
    expect(s.durum).toBe("siparis");
    expect(s.yalnizIsaret).toBe(true);
    expect(s.siparisTarihi).toBe("2026-06-15");
  });
});

describe("gecikme YANLIŞ ALARM ÜRETMEZ", () => {
  it("termini geçmiş ve gelmemişse gün sayılır", () => {
    const s = paketSatinAlmaOzeti(
      [kalem()],
      [ozet({ nextDueAt: "2026-08-02" })],
      [],
      BUGUN
    ).satirlar[0];
    expect(s.gecikmeGun).toBe(10);
  });

  it("teslim alınmış kalemin geçmiş termini GECİKME DEĞİLDİR", () => {
    const s = paketSatinAlmaOzeti(
      [kalem()],
      [
        ozet({
          nextDueAt: "2026-08-02",
          receivedQty: 10,
          openOrderCount: 0,
          lastReceivedAt: "2026-08-10",
        }),
      ],
      [],
      BUGUN
    ).satirlar[0];
    expect(s.gecikmeGun).toBe(0);
  });

  it("termini gelmemiş kalemde gecikme sıfırdır", () => {
    const s = paketSatinAlmaOzeti([kalem()], [ozet()], [], BUGUN).satirlar[0];
    expect(s.gecikmeGun).toBe(0);
  });
});

describe("eşleşme iki anahtardan", () => {
  it("`part_key` tutmuyorsa katlanmış TANIM ile bulunur", () => {
    // Paket yeniden eşleştirildiğinde `part_key` değişebilir; sipariş
    // kaydının kimliği tanımdır.
    const s = paketSatinAlmaOzeti(
      [kalem({ key: "RULMAN 6205-Z" })],
      [ozet({ partKey: "ESKI-ANAHTAR" })],
      [],
      BUGUN
    ).satirlar[0];
    expect(s.durum).toBe("siparis");
    expect(s.siparisAdedi).toBe(10);
  });
});

describe("özet sayaçları", () => {
  it("kalemleri duruma göre sayar ve en yakın AÇIK termini verir", () => {
    const o = paketSatinAlmaOzeti(
      [
        kalem({ key: "a", tanim: "A" }),
        kalem({ key: "b", tanim: "B" }),
        kalem({ key: "c", tanim: "C" }),
      ],
      [
        ozet({ partKey: "b", matchKey: "B", nextDueAt: "2026-10-01" }),
        ozet({
          partKey: "c",
          matchKey: "C",
          nextDueAt: "2026-09-01",
          receivedQty: 10,
          openOrderCount: 0,
          lastReceivedAt: "2026-08-01",
        }),
      ],
      [],
      BUGUN
    );
    expect(o.toplam).toBe(3);
    expect(o.bekleyen).toBe(1);
    expect(o.siparisVerilen).toBe(1);
    expect(o.teslimAlinan).toBe(1);
    // Teslim alınmış kalemin termini "en yakın açık termin" değildir.
    expect(o.enYakinTermin).toBe("2026-10-01");
  });
});

describe("SIZINTI KORUMASI — geçit ticari sütun taşımaz", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260812140000_drawing_purchase_summary.sql"),
    "utf8"
  );

  /** `returns table ( … )` bloğu: geçidin sütun listesi, yani güvenlik sınırı. */
  const imza = (() => {
    const bas = migration.indexOf("returns table (");
    const son = migration.indexOf(")", migration.indexOf("open_order_count"));
    return migration.slice(bas, son).toLowerCase();
  })();

  it.each([
    "unit_price",
    "supplier",
    "currency",
    "fx_rate",
    "payment_method",
    "payment_term",
    "advance",
    "total_amount",
    "amount",
    "price",
  ])("`%s` DÖNMEZ", (yasak) => {
    expect(imza).not.toContain(yasak);
  });

  it("beklenen sütunları döner", () => {
    for (const alan of [
      "part_key",
      "match_key",
      "ordered_qty",
      "received_qty",
      "first_ordered_at",
      "next_due_at",
      "last_received_at",
      "order_count",
      "open_order_count",
    ]) {
      expect(imza).toContain(alan);
    }
  });

  it("iptal edilmiş sipariş özete GİRMEZ", () => {
    expect(migration).toContain("o.cancelled_at is null");
  });

  it("`anon` çağıramaz, `authenticated` çağırır", () => {
    expect(migration).toMatch(/revoke execute on function[\s\S]*from public/i);
    expect(migration).toMatch(/revoke execute on function[\s\S]*from anon/i);
    expect(migration).toMatch(/grant execute on function[\s\S]*to authenticated/i);
  });
});
