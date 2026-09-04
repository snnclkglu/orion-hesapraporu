// Aktarım dosyasının kabul ettiği anahtarlar ↔ revizyon tipleri (TEKLIF-79).
//
// Değişmez 8 (AGENTS.md): bir kural iki yerde yaşıyorsa ayrışmayı bir test
// KAYNAK DOSYAYI okuyarak engeller. Burada kaynak, modül arayüzlerinin
// KENDİSİDİR: tip dosyaları TypeScript sözdizimiyle okunur (tip denetleyicisi
// yok — özellik adları yeter, hızlıdır) ve her özellik adı
// `transferAcceptedKeys()` ile karşılaştırılır. Tipe giren ama aktarımın
// tanımadığı bir alan dosyadan SESSİZCE düşerdi; bu test onu gürültüye çevirir.

import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { LEGACY_SPEC_KEYS, transferAcceptedKeys } from "@/lib/offer-report-transfer";
import { CALC_FIELD } from "@/lib/revision-load";
import { MODULE_ORDER, moduleFamily, type ModuleFamily } from "@/lib/calc/presentation/module-family";

function interfaceKeys(file: string, name: string): string[] {
  const text = readFileSync(path.resolve(process.cwd(), file), "utf8");
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement.members
        .filter(ts.isPropertySignature)
        .map((member) => (member.name as ts.Identifier).text);
    }
  }
  throw new Error(`${file}: interface ${name} bulunamadı`);
}

const MODULE_TYPES: Record<ModuleFamily, { file: string; inputs: string; selections?: string }> = {
  hoist: { file: "src/lib/calc/modules/hoistGroup.ts", inputs: "HoistInputs", selections: "HoistSelections" },
  hookBlock: { file: "src/lib/calc/modules/hookBlock.ts", inputs: "HookBlockInputs", selections: "HookBlockSelections" },
  travel: { file: "src/lib/calc/modules/travelGroup.ts", inputs: "TravelInputs", selections: "TravelSelections" },
  wheelLoads: { file: "src/lib/calc/modules/wheelLoads.ts", inputs: "WheelLoadInputs", selections: "WheelLoadSelections" },
  girder: { file: "src/lib/calc/modules/mainGirder.ts", inputs: "GirderInputs", selections: "GirderSelections" },
  buckling: { file: "src/lib/calc/modules/buckling.ts", inputs: "BucklingInputs" },
  endCarriage: { file: "src/lib/calc/modules/endCarriage.ts", inputs: "EndCarriageInputs", selections: "EndCarriageSelections" },
  cabin: { file: "src/lib/calc/modules/cabin.ts", inputs: "CabinInputs", selections: "CabinSelections" },
};

const missing = (typeKeys: string[], accepted: string[]) =>
  typeKeys.filter((key) => !accepted.includes(key));

describe("AI aktarım dosyası kapsamı ↔ revizyon tipleri", () => {
  const accepted = transferAcceptedKeys();

  it("teknik özelliklerin (eski göç anahtarları dışında) her alanı kabul edilir", () => {
    const typeKeys = interfaceKeys("src/lib/calc/types.ts", "TechnicalSpecs").filter(
      (key) => !LEGACY_SPEC_KEYS.includes(key)
    );
    expect(missing(typeKeys, accepted.specs)).toEqual([]);
    // Kabul edilen her anahtar tipte de vardır — bayat anahtar yok.
    const allSpecKeys = interfaceKeys("src/lib/calc/types.ts", "TechnicalSpecs");
    expect(missing(accepted.specs, allSpecKeys)).toEqual([]);
  });

  it("eski teknik özellik anahtarları gerçekten tipte duran göç alanlarıdır", () => {
    const allSpecKeys = interfaceKeys("src/lib/calc/types.ts", "TechnicalSpecs");
    expect(missing([...LEGACY_SPEC_KEYS], allSpecKeys)).toEqual([]);
  });

  for (const key of MODULE_ORDER) {
    const family = moduleFamily(key);
    const field = CALC_FIELD[key];
    const types = MODULE_TYPES[family];

    it(`${key} girdilerinin her alanı kabul edilir ve bayat anahtar yoktur`, () => {
      const typeKeys = interfaceKeys(types.file, types.inputs);
      const acceptedKeys = accepted.modules[field].inputs;
      expect(missing(typeKeys, acceptedKeys), "tipte var, aktarımda yok").toEqual([]);
      expect(missing(acceptedKeys, typeKeys), "aktarımda var, tipte yok").toEqual([]);
    });

    if (types.selections) {
      const selectionType = types.selections;
      it(`${key} seçimlerinin her alanı kabul edilir ve bayat anahtar yoktur`, () => {
        const typeKeys = interfaceKeys(types.file, selectionType);
        const acceptedKeys = accepted.modules[field].selections;
        expect(missing(typeKeys, acceptedKeys), "tipte var, aktarımda yok").toEqual([]);
        expect(missing(acceptedKeys, typeKeys), "aktarımda var, tipte yok").toEqual([]);
      });
    }
  }

  it("revizyon snapshot'ının üst düzey anahtarları eksiksiz taşınır", () => {
    const inputKeys = interfaceKeys("src/lib/revision-load.ts", "RevisionInputsJson");
    const selectionKeys = interfaceKeys("src/lib/revision-load.ts", "RevisionSelectionsJson");
    expect(missing(inputKeys, accepted.inputs)).toEqual([]);
    expect(missing(selectionKeys, accepted.selections)).toEqual([]);
  });
});
