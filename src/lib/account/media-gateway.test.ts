import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import sharp from "sharp";
import { inspectWebp } from "./webp";
const user = "10000000-0000-4000-8000-000000000001",
  folder = "20000000-0000-4000-8000-000000000001";
function gateway({
  submitted = false,
  allowed = true,
  authenticated = true,
} = {}) {
  let handler!: (request: Request) => Promise<Response>;
  const upload = vi.fn().mockResolvedValue({ error: null });
  const table = {
    select: () => table,
    eq: () => table,
    single: async () => ({
      data: {
        id: folder,
        user_id: user,
        submitted_at: submitted ? new Date().toISOString() : null,
        expected_files: 1,
        created_at: new Date().toISOString(),
      },
    }),
  };
  const db = {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: user } : null },
      }),
    },
    rpc: async () => ({ data: allowed }),
    from: () => table,
    storage: { from: () => ({ upload }) },
  };
  const source = readFileSync(
    "supabase/functions/account-media/index.js",
    "utf8",
  ).replace(/^import .*;$/gm, "");
  runInNewContext(source, {
    Response,
    Uint8Array,
    TextDecoder,
    atob,
    Date,
    inspectWebp,
    createClient: () => db,
    Deno: {
      env: { get: () => "test-only" },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  });
  return {
    upload,
    send: async (bucket: string, path: string, image: Buffer) =>
      handler(
        new Request("https://test.invalid", {
          method: "POST",
          headers: { Authorization: "Bearer test-session" },
          body: JSON.stringify({
            bucket,
            path,
            image: image.toString("base64"),
          }),
        }),
      ),
  };
}
async function avatar() {
  return sharp({
    create: { width: 64, height: 64, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer();
}
it("kullanıcının doğru boyutlu yeni avatarını yalnız ekleme olarak kabul eder", async () => {
  const g = gateway(),
    bytes = await avatar();
  const r = await g.send("account-avatars", `${user}/${folder}/64.webp`, bytes);
  expect(r.status).toBe(200);
  expect(g.upload).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Uint8Array),
    { contentType: "image/webp", upsert: false },
  );
});
it("başkasının yolu, yabancı bucket, geçersiz oturum ve oran sınırı yükleme yapamaz", async () => {
  const bytes = await avatar();
  for (const [g, bucket, path, status] of [
    [gateway(), "account-avatars", `${folder}/${folder}/64.webp`, 403],
    [gateway(), "other-bucket", `${user}/${folder}/64.webp`, 422],
    [
      gateway({ authenticated: false }),
      "account-avatars",
      `${user}/${folder}/64.webp`,
      401,
    ],
    [
      gateway({ allowed: false }),
      "account-avatars",
      `${user}/${folder}/64.webp`,
      429,
    ],
  ] as const) {
    expect((await g.send(bucket, path, bytes)).status).toBe(status);
    expect(g.upload).not.toHaveBeenCalled();
  }
});
it("kesinleşmiş gönderi, fazla ek sırası ve yanlış avatar boyutu reddedilir", async () => {
  const bytes = await avatar();
  for (const [g, bucket, path, status] of [
    [
      gateway({ submitted: true }),
      "feedback-images",
      `${user}/${folder}/0-${folder}.webp`,
      403,
    ],
    [gateway(), "feedback-images", `${user}/${folder}/1-${folder}.webp`, 403],
    [gateway(), "account-avatars", `${user}/${folder}/256.webp`, 422],
  ] as const) {
    expect((await g.send(bucket, path, bytes)).status).toBe(status);
    expect(g.upload).not.toHaveBeenCalled();
  }
});
