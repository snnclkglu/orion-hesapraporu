// Elektrik listesi süzgeci ve sıralamasının birim testleri.
//
// EN PAHALI HATA SÜZGECİN İKİ YERDE AYRIŞMASIDIR: kullanıcı bir panoyu süzüp
// Excel'e basıyor ve eline başka satırlar geçiyor. Bu yüzden süzgeç tek
// tanımdır ve testi burada durur; ekran ile indirme ucu ikisi de bu
// fonksiyonları çağırır.

import { describe, expect, it } from "vitest";
import {
  BOS_SUZGEC,
  filterFromParams,
  filterMaterials,
  filterParts,
  filterToQuery,
  materialSortFromParams,
  partSortFromParams,
  sortMaterials,
  sortParts,
  suzgecTemizMi,
} from "../filter";
import { materialRows } from "../rollup";
import type { ElectricalPart } from "../types";

function part(over: Partial<ElectricalPart> & { deviceTag: string }): ElectricalPart {
  return {
    installation: "1T",
    location: "A",
    device: "F1",
    qty: 1,
    designation: "",
    typeNo: "",
    supplier: "",
    partNo: "",
    page: 1,
    ...over,
  };
}

const PARTS: ElectricalPart[] = [
  part({ deviceTag: "=1T+A-F1", location: "A", qty: 2, designation: "SİGORTA 10A", typeNo: "T1", supplier: "Siemens", partNo: "SIE.T1", page: 5 }),
  part({ deviceTag: "=1T+B-F2", location: "B", qty: 3, designation: "SİGORTA 16A", typeNo: "T1", supplier: "Siemens", partNo: "SIE.T1", page: 7 }),
  part({ deviceTag: "=1T+B-K1", location: "B", qty: null, designation: "KONTAKTÖR", typeNo: "T2", supplier: "Schneider Electric", partNo: "SE.T2", page: 3 }),
  part({ deviceTag: "=1T+C-X1", location: "C", qty: 24, designation: "KLEMENS", typeNo: "T3", supplier: "Phoenix Contact", partNo: "PXC.T3", page: 9 }),
];

describe("filterParts", () => {
  it("süzgeçsiz bütün satırları verir", () => {
    expect(filterParts(PARTS, BOS_SUZGEC)).toHaveLength(4);
  });

  it("panoya göre süzer", () => {
    expect(filterParts(PARTS, { ...BOS_SUZGEC, location: "B" }).map((p) => p.deviceTag)).toEqual([
      "=1T+B-F2",
      "=1T+B-K1",
    ]);
  });

  it("tedarikçiye göre süzer — tam eşleşme", () => {
    const r = filterParts(PARTS, { ...BOS_SUZGEC, supplier: "Siemens" });
    expect(r).toHaveLength(2);
    // "Schneider Electric" içinde "Electric" geçse de tedarikçi süzgeci
    // İÇEREN değil EŞİT arar; aksi hâlde açılır listeden seçilen bir ad
    // başka bir firmayı da getirirdi.
    expect(filterParts(PARTS, { ...BOS_SUZGEC, supplier: "Electric" })).toHaveLength(0);
  });

  it("türetilmiş kategoriye göre aygıtları süzer", () => {
    const r = filterParts(PARTS, { ...BOS_SUZGEC, category: "Kontaktörler" });
    expect(r.map((p) => p.deviceTag)).toEqual(["=1T+B-K1"]);
  });

  it("arama TÜRKÇE katlanır: büyük harfle yazılan küçük harfli satırı bulur", () => {
    expect(filterParts(PARTS, { ...BOS_SUZGEC, q: "sigorta" })).toHaveLength(2);
    expect(filterParts(PARTS, { ...BOS_SUZGEC, q: "SİGORTA" })).toHaveLength(2);
    expect(filterParts(PARTS, { ...BOS_SUZGEC, q: "kontaktör" })).toHaveLength(1);
  });

  it("arama malzeme kodunda ve aygıt etiketinde de çalışır", () => {
    expect(filterParts(PARTS, { ...BOS_SUZGEC, q: "pxc" })).toHaveLength(1);
    expect(filterParts(PARTS, { ...BOS_SUZGEC, q: "+C-X1" })).toHaveLength(1);
  });

  it("süzgeçler VE ile birleşir", () => {
    expect(
      filterParts(PARTS, { location: "B", supplier: "Siemens", category: "", q: "16A" })
    ).toHaveLength(1);
  });
});

describe("sortParts", () => {
  it("öntanım BELGEDEKİ sıradır ve diziyi bozmaz", () => {
    expect(sortParts(PARTS, "sort", false).map((p) => p.deviceTag)).toEqual(
      PARTS.map((p) => p.deviceTag)
    );
    expect(sortParts(PARTS, "sort", true)[0].deviceTag).toBe("=1T+C-X1");
  });

  it("OKUNAMAYAN ADET HER İKİ YÖNDE DE SONDA kalır", () => {
    // `null` ne büyüktür ne küçük; bilinmiyordur (değişmez md. 4). Onu `0`
    // sayıp başa almak, sıfır adetli bir malzeme varmış gibi gösterirdi.
    expect(sortParts(PARTS, "qty", false).at(-1)?.qty).toBeNull();
    expect(sortParts(PARTS, "qty", true).at(-1)?.qty).toBeNull();
  });

  it("adete göre artan ve azalan sıralar", () => {
    expect(sortParts(PARTS, "qty", false).map((p) => p.qty)).toEqual([2, 3, 24, null]);
    expect(sortParts(PARTS, "qty", true).map((p) => p.qty)).toEqual([24, 3, 2, null]);
  });

  it("metni TÜRKÇE harf sırasıyla sıralar", () => {
    const tr = sortParts(
      [
        part({ deviceTag: "a", supplier: "Zeta" }),
        part({ deviceTag: "b", supplier: "İnfeed" }),
        part({ deviceTag: "c", supplier: "Ada" }),
      ],
      "supplier",
      false
    ).map((p) => p.supplier);
    // Öntanımlı sıra "İ"yi "Z"den sonraya atıyordu; `localeCompare(…, "tr")`
    // onu "I" ile "J" arasına koyar.
    expect(tr).toEqual(["Ada", "İnfeed", "Zeta"]);
  });

  it("sıralama kaynağı DEĞİŞTİRMEZ", () => {
    const once = PARTS.map((p) => p.deviceTag);
    sortParts(PARTS, "qty", true);
    expect(PARTS.map((p) => p.deviceTag)).toEqual(once);
  });
});

describe("filterMaterials", () => {
  const ROWS = materialRows(PARTS);

  it("aynı ürünü tek satıra indirir", () => {
    expect(ROWS).toHaveLength(3);
  });

  it("ÇOK PANOLU satır pano süzgecinde ELENMEZ", () => {
    // SIE.T1 hem +A hem +B'de geçiyor; "bu panoda hangi malzemeler var"
    // sorusunun cevabı o satırı içerir.
    const r = filterMaterials(ROWS, { ...BOS_SUZGEC, location: "A" });
    expect(r.map((m) => m.partNo)).toEqual(["SIE.T1"]);
    expect(r[0].locations).toEqual(["A", "B"]);
  });

  it("kategori malzeme süzgecinde ve serbest aramada çalışır", () => {
    expect(
      filterMaterials(ROWS, { ...BOS_SUZGEC, category: "Sigortalar ve Sigorta Yuvaları" })
        .map((m) => m.partNo)
    ).toEqual(["SIE.T1"]);
    expect(filterMaterials(ROWS, { ...BOS_SUZGEC, q: "sigorta yuvaları" })).toHaveLength(1);
  });

  it("adet toplamı korunur ve sıralanabilir", () => {
    expect(sortMaterials(ROWS, "qty", true)[0].qty).toBe(24);
    expect(sortMaterials(ROWS, "qty", false).at(-1)?.qty).toBeNull();
  });
});

describe("sorgu dönüşümü", () => {
  it("boş alan parametre AÇMAZ", () => {
    expect(filterToQuery(BOS_SUZGEC)).toBe("");
    expect(suzgecTemizMi(BOS_SUZGEC)).toBe(true);
  });

  it("gidiş-dönüş aynı süzgeci verir", () => {
    const f = {
      location: "LVD10",
      supplier: "Siemens",
      category: "Sigortalar ve Sigorta Yuvaları",
      q: "sigorta",
    };
    const geri = filterFromParams(new URLSearchParams(filterToQuery(f).slice(1)));
    expect(geri).toEqual(f);
    expect(suzgecTemizMi(f)).toBe(false);
  });

  it("tanınmayan sıralama anahtarı belge sırasına düşer", () => {
    expect(partSortFromParams(new URLSearchParams("sirala=uydurma"))).toEqual({
      key: "sort",
      desc: false,
    });
    expect(materialSortFromParams(new URLSearchParams("sirala=partNo&yon=desc"))).toEqual({
      key: "partNo",
      desc: true,
    });
  });
});
