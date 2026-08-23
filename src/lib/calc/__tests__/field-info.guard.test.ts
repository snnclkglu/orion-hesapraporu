import { describe, expect, it } from "vitest";

import {
  GIRDER_INPUT_FIELDS,
  GIRDER_SELECTION_FIELDS,
} from "../presentation/structuralFields";
import {
  WHEELLOAD_INPUT_FIELDS,
  WHEELLOAD_SELECTION_FIELDS,
} from "../presentation/wheelLoadFields";

describe("ana kiriş ve teker yükleri bilgi notları", () => {
  const groups = [
    ["Ana kiriş girdileri", GIRDER_INPUT_FIELDS],
    ["Ana kiriş seçimleri", GIRDER_SELECTION_FIELDS],
    ["Teker yükleri girdileri", WHEELLOAD_INPUT_FIELDS],
    ["Teker yükleri seçimleri", WHEELLOAD_SELECTION_FIELDS],
  ] as const;

  it.each(groups)("%s: her kutu kaynak veya kod kullanımını açıklar", (_name, fields) => {
    const missing = fields
      .filter((field) => !field.info?.trim())
      .map((field) => field.key);
    expect(missing).toEqual([]);

    for (const field of fields) {
      expect(field.info, field.key).toMatch(/Standart|Kod kullanımı|Kod kullanım|Standart\/kod ayrımı/);
    }
  });
});
