import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), getUserById: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  rpc: mocks.rpc, auth: { admin: { getUserById: mocks.getUserById } },
  from: () => ({ update: (values: unknown) => {
    mocks.update(values);
    const query = { eq: () => query, then: (resolve: (value: unknown) => void) => resolve({ error: null }) };
    return query;
  } }),
}) }));
import { processNotificationEmails } from "./notifications";

describe('E-posta teslim kuyruğu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('EMAIL_NOTIFICATIONS_ENABLED', 'true');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 'test-only');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.rpc.mockResolvedValue({ data: [{ id: 'n1', user_id: 'u1', title: 'Görev', href: '/jobs', attempts: 1, payload: null }], error: null });
    mocks.getUserById.mockResolvedValue({ data: { user: { email: 'user@example.com', email_confirmed_at: '2026-01-01' } }, error: null });
  });
  it('Önizleme ortamında gerçek e-posta göndermez', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await processNotificationEmails(1)).toEqual({ processed: 0, disabled: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('Sağlayıcı isteğinden önce gövdeyi saklar ve sabit tekrar anahtarı kullanır', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'resend-1' }) });
    await processNotificationEmails(1);
    expect(mocks.update.mock.calls[0][0]).toHaveProperty('payload.to', ['user@example.com']);
    expect(mocks.fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('notification/n1');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', provider_id: 'resend-1' }));
  });
  it('Hız sınırında gönderildi demez; yeniden denemeye bırakır', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 429 });
    await processNotificationEmails(1);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', last_error: 'resend_http_429' }));
  });
  it('Doğrulanmamış alıcıya göndermez', async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: { email: 'user@example.com' } }, error: null });
    await processNotificationEmails(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }));
  });
  it('Önceki denemeden sonra değişmiş adrese göndermez', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: 'n1', user_id: 'u1', attempts: 2, payload: { to: ['old@example.com'] } }], error: null });
    await processNotificationEmails(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped', last_error: 'recipient_changed' }));
  });
});
