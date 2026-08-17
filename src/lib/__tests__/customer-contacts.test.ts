// MÜŞTERİ İLETİŞİM KİŞİLERİ — çekirdek kuralları.
//
// Sınanan şey, teklif kapağının EN GÖRÜNÜR satırının nereden dolduğudur:
// yanlış bir muhatap adı belgenin başında durur ve müşteri onu ilk okur.

import { describe, expect, it } from "vitest";
import {
  activeContacts,
  coverFieldsFromContact,
  suggestedContact,
  type CustomerContact,
} from "../customer-contacts";

function kisi(over: Partial<CustomerContact> & Pick<CustomerContact, "id" | "name">): CustomerContact {
  return {
    customerId: "c1",
    title: "",
    department: "",
    phone: "",
    email: "",
    note: "",
    isPrimary: false,
    active: true,
    sort: 0,
    ...over,
  };
}

describe("activeContacts", () => {
  it("pasif kişi listeye girmez — defterden düşmek silinmek değildir", () => {
    const liste = [kisi({ id: "1", name: "A" }), kisi({ id: "2", name: "B", active: false })];
    expect(activeContacts(liste).map((k) => k.id)).toEqual(["1"]);
  });
});

describe("suggestedContact", () => {
  it("BİRİNCİL kişi önerilir, sırası sonda olsa bile", () => {
    const liste = [
      kisi({ id: "1", name: "A", sort: 10 }),
      kisi({ id: "2", name: "B", sort: 20, isPrimary: true }),
    ];
    expect(suggestedContact(liste)?.id).toBe("2");
  });

  it("birincil yoksa sıradaki İLK etkin kişi önerilir", () => {
    const liste = [
      kisi({ id: "1", name: "A", sort: 20 }),
      kisi({ id: "2", name: "B", sort: 10 }),
    ];
    expect(suggestedContact(liste)?.id).toBe("2");
  });

  it("pasif birincil ÖNERİLMEZ — defterden düşürülmüş bir kişi kapağa yazılamaz", () => {
    const liste = [
      kisi({ id: "1", name: "A", sort: 20 }),
      kisi({ id: "2", name: "B", sort: 10, isPrimary: true, active: false }),
    ];
    expect(suggestedContact(liste)?.id).toBe("1");
  });

  it("kişi yoksa null — uydurma bir muhatap üretilmez", () => {
    expect(suggestedContact([])).toBeNull();
    expect(suggestedContact([kisi({ id: "1", name: "A", active: false })])).toBeNull();
  });
});

describe("coverFieldsFromContact", () => {
  it("kapağın KİME bloğunu doldurur", () => {
    const k = kisi({
      id: "1",
      name: "ALİCAN ERASLAN",
      department: "Satın Alma Departmanı",
      phone: "+90 216 453 67 51",
    });
    expect(coverFieldsFromContact(k)).toEqual({
      toName: "ALİCAN ERASLAN",
      toDept: "Satın Alma Departmanı",
      toPhone: "+90 216 453 67 51",
    });
  });

  it("kişi yoksa alanlar BOŞ döner — yer tutucu bir değer değildir", () => {
    expect(coverFieldsFromContact(null)).toEqual({ toName: "", toDept: "", toPhone: "" });
  });
});
