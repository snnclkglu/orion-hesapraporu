import { it, expect } from "vitest";
import { attachmentSignatureMatches } from "./files";
it("PDF kılığındaki HTML dosyasını reddeder", () => {
  expect(
    attachmentSignatureMatches(
      "application/pdf",
      new TextEncoder().encode("<html>"),
    ),
  ).toBe(false);
  expect(
    attachmentSignatureMatches(
      "application/pdf",
      new TextEncoder().encode("%PDF-1.7"),
    ),
  ).toBe(true);
});
it("bilinmeyen tür ve ikili metin dosyasını reddeder", () => {
  expect(
    attachmentSignatureMatches("image/svg+xml", new Uint8Array([60])),
  ).toBe(false);
  expect(
    attachmentSignatureMatches("text/plain", new Uint8Array([65, 0, 66])),
  ).toBe(false);
});
