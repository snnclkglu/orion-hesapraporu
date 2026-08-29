import "server-only";

import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PASSWORD_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PUBLIC_CODE_LENGTH = 16;
const PASSWORD_GROUPS = 3;
const PASSWORD_GROUP_LENGTH = 5;

function randomFromAlphabet(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

/** 80 bitlik kalıcı plaka kimliği; UUID veya proje id'si QR'a sızmaz. */
export function newPublicCode(): string {
  return randomFromAlphabet(CODE_ALPHABET, PUBLIC_CODE_LENGTH);
}

/** İnsan tarafından aktarılabilir, yaklaşık 87 bitlik tek-seferlik parola. */
export function newPortalPassword(): string {
  return Array.from({ length: PASSWORD_GROUPS }, () =>
    randomFromAlphabet(PASSWORD_ALPHABET, PASSWORD_GROUP_LENGTH)
  ).join("-");
}

function passwordBytes(password: string): Buffer {
  const bytes = Buffer.from(password.normalize("NFKC"), "utf8");
  if (bytes.byteLength < 8 || bytes.byteLength > 128) {
    throw new Error("Parola 8–128 bayt uzunluğunda olmalıdır.");
  }
  return bytes;
}

function derive(password: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function hashPortalPassword(
  password: string
): Promise<{ saltHex: string; hashHex: string }> {
  const salt = randomBytes(16);
  const hash = await derive(passwordBytes(password), salt);
  return { saltHex: salt.toString("hex"), hashHex: hash.toString("hex") };
}

export async function verifyPortalPassword(
  password: string,
  saltHex: string,
  expectedHashHex: string
): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(expectedHashHex)) return false;
  let bytes: Buffer;
  try {
    bytes = passwordBytes(password);
  } catch {
    return false;
  }
  const actual = await derive(bytes, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, Buffer.from(expectedHashHex, "hex"));
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
