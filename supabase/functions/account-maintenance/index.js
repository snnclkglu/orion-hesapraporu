import { createClient } from 'npm:@supabase/supabase-js@2.110.7';

// Kullanıcı yükleme geçidinden ayrıdır. Yalnız zamanlayıcının dar anahtarı kabul edilir.
Deno.serve(async (request) => {
  const reply = (status, body) => Response.json(body, { status });
  if (request.method !== 'POST') return reply(405, { error: 'method' });
  const expected = Deno.env.get('ACCOUNT_MAINTENANCE_KEY');
  const supplied = request.headers.get('x-account-maintenance-key') || '';
  if (!expected || !/^[a-f0-9]{64}$/.test(supplied)) return reply(401, { error: 'auth' });
  let mismatch = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (mismatch !== 0) return reply(401, { error: 'auth' });
  let apply = false;
  try {
    const reader = request.body?.getReader();
    let body = '', bytes = 0;
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 512) { await reader.cancel(); return reply(413, { error: 'body' }); }
        body += decoder.decode(part.value, { stream: true });
      }
      body += decoder.decode();
    }
    const input = JSON.parse(body || '{}');
    if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(k => k !== 'apply') || (input.apply !== undefined && typeof input.apply !== 'boolean')) return reply(400, { error: 'body' });
    apply = input.apply === true;
  } catch { return reply(400, { error: 'body' }); }
  // Her dış istek sınırlıdır; geciken çağrı yeni silme başlatamaz.
  const start = Date.now();
  const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
  let runId, candidates = 0, removed = 0, failed = 0, errorCode = null;
  try {
    const begin = await db.rpc('account_maintenance_begin', { p_apply: apply });
    if (begin.error || !begin.data) return reply(503, { error: 'begin' });
    if (begin.data.busy) return reply(409, { error: 'busy' });
    runId = begin.data.run_id;
    const items = begin.data.items;
    if (!Array.isArray(items) || items.length > 500) throw new Error('invalid_candidates');
    candidates = items.length;
    if (apply) {
      for (const bucket of ['account-avatars', 'feedback-images']) {
        const group = items.filter(item => item.bucket_id === bucket);
        for (let i = 0; i < group.length; i += 50) {
          if (Date.now() - start > 80000) throw new Error('deadline');
          const checked = await db.rpc('account_maintenance_recheck', { p_run: runId, p_items: group.slice(i, i + 50) });
          if (checked.error || !Array.isArray(checked.data)) throw new Error('recheck');
          const paths = checked.data.filter(item => item.bucket_id === bucket).map(item => item.name);
          if (!paths.length) continue;
          if (Date.now() - start > 80000) throw new Error('deadline');
          const result = await db.storage.from(bucket).remove(paths);
          if (result.error) { failed += paths.length; throw new Error('storage'); }
          if (!Array.isArray(result.data) || result.data.length > paths.length) throw new Error('storage');
          removed += result.data.length;
        }
      }
    }
  } catch (error) {
    // İç hata, yol veya anahtar loglanmaz; dar hata kodları tutulur.
    errorCode = ['invalid_candidates', 'deadline', 'recheck', 'storage'].includes(error?.message) ? error.message : 'request';
  }
  if (!runId) return reply(503, { error: 'begin' });
  try {
    const finish = await db.rpc('account_maintenance_finish', { p_run: runId, p_removed: removed, p_failed: failed, p_error: errorCode });
    if (finish.error) return reply(503, { error: 'finish', runId });
  } catch { return reply(503, { error: 'finish', runId }); }
  return reply(errorCode ? 503 : 200, { runId, mode: apply ? 'apply' : 'dry-run', candidates, removed, failed, error: errorCode });
});
