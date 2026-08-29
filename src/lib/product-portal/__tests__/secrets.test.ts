import { describe, expect, it } from "vitest";
import {
  hashPortalPassword,
  newPortalPassword,
  newPublicCode,
  verifyPortalPassword,
} from "../secrets";

describe("müşteri portalı sırları", () => {
  it("QR için iç kimlik taşımayan 16 karakterlik kod üretir", () => {
    const codes = new Set(Array.from({ length: 100 }, () => newPublicCode()));
    expect(codes.size).toBe(100);
    for (const code of codes) expect(code).toMatch(/^[A-Z0-9]{16}$/);
  });

  it("parolayı scrypt ile saltlı özetler ve yalnız doğru parolayı kabul eder", async () => {
    const password = newPortalPassword();
    expect(password).toMatch(/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/);
    const first = await hashPortalPassword(password);
    const second = await hashPortalPassword(password);
    expect(first.saltHex).not.toBe(second.saltHex);
    expect(first.hashHex).not.toBe(second.hashHex);
    expect(await verifyPortalPassword(password, first.saltHex, first.hashHex)).toBe(true);
    expect(await verifyPortalPassword(`${password}x`, first.saltHex, first.hashHex)).toBe(false);
  });
});
