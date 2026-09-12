import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizePhone, phoneDisplay } from "./phone";
import { profileUpdateSchema } from "./model";

export const phoneCases: [string, string | null][] = [
  ["", ""],
  ["   ", ""],
  ["2121234567", "+902121234567"],
  ["0212 123 45 67", "+902121234567"],
  ["+90 (212) 123 45 67", "+902121234567"],
  ["00902121234567", "+902121234567"],
  ["+90", null],
  ["212123456", null],
  ["21212345678", null],
  ["+442121234567", null],
  ["212abc1234567", null],
  ["++902121234567", null],
  ["0000000000", null],
  ["(212) 123-45-67", "+902121234567"],
];
describe("Profil telefonu", () => {
  it.each(phoneCases)("%s normalleştirilir", (value, expected) =>
    expect(normalizePhone(value)).toBe(expected),
  );
  it("ekran maskesi veri değildir", () => {
    expect(phoneDisplay("+902121234567")).toBe("(212) 123 45 67");
    expect(phoneDisplay("")).toBe("");
    expect(normalizePhone("(xxx) xxx xx xx")).toBeNull();
  });
  it("eski biçimsiz numara yalnız DB'deki değer değişmeden korunur", () => {
    const schema = profileUpdateSchema("eski numara");
    const base = { name: "Kullanıcı", note: "", version: 1 };
    expect(schema.parse({ ...base, phone: "eski numara" }).phone).toBe(
      "eski numara",
    );
    expect(schema.safeParse({ ...base, phone: "başka yanlış" }).success).toBe(
      false,
    );
    expect(schema.parse({ ...base, phone: "" }).phone).toBe("");
    expect(schema.parse({ ...base, phone: "0212 123 45 67" }).phone).toBe(
      "+902121234567",
    );
  });
  it("SQL ve istemci aynı numara uzunluğu, önek ve boş değer kurallarını taşır", () => {
    const sql = readFileSync(
      "supabase/migrations/20260912160000_task_phone_validation.sql",
      "utf8",
    );
    expect(sql).toContain("^[1-9][0-9]{9}$");
    expect(sql).toContain("left(value,3)='+90'");
    expect(sql).toContain("left(value,4)='0090'");
    expect(sql).toContain("length(value)=11");
    expect(sql).toContain("if value='' then return ''");
    expect(sql).toContain("p_phone=coalesce(previous_phone,'')");
    expect(sql).toContain("for update");
  });
});
