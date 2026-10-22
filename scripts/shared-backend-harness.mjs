/** Isolated test protocol server backed by real PostgreSQL. Auth/PostgREST HTTP are fixtures. */
import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createSharedPostgresFixture } from './shared-postgres-fixture.mjs';

export const SYNTHETIC_LEARNERS = Object.freeze({
  alice: { id: '11111111-1111-4111-8111-111111111111', email: 'lucid-alice@example.invalid' },
  bob: { id: '22222222-2222-4222-8222-222222222222', email: 'lucid-bob@example.invalid' },
});
export const SYNTHETIC_PUBLIC_KEY = 'sb_publishable_lucid_ephemeral_test';

export async function createSyntheticSharedBackend({ postgres, handlers = {}, port = 0 } = {}) {
  if (!postgres) throw new Error('A disposable real PostgreSQL fixture is required');
  for (const user of Object.values(SYNTHETIC_LEARNERS)) await postgres.query('insert into auth.users(id,aud,role,email,created_at,updated_at) values($1,$2,$3,$4,now(),now()) on conflict do nothing', [user.id, 'authenticated', 'authenticated', user.email]);
  const secret = randomBytes(32), issued = new Map(), refreshes = new Map();
  const controls = { offline: false, disconnectAfterSave: false, holdStateGETResponses: false };
  const heldResponses = [], heldWaiters = [];
  const requests = [], errors = [];
  let queue = Promise.resolve(), origin;
  const sign = (encoded) => createHmac('sha256', secret).update(encoded).digest('base64url');
  const mint = (user, duration = 3600) => {
    const iat = Math.floor(Date.now() / 1000), nonce = randomUUID();
    const claims = { sub: user.id, aud: 'authenticated', role: 'authenticated', iss: `${origin}/auth/v1`, iat, exp: iat + duration, nonce };
    const encoded = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
    const token = `${encoded}.${sign(encoded)}`, refresh = randomUUID();
    issued.set(nonce, { user, revoked: false }); refreshes.set(refresh, user);
    return { access_token: token, refresh_token: refresh, expires_in: duration, expires_at: iat + duration, user: { ...user, email_confirmed_at: new Date().toISOString() } };
  };
  const authenticate = (request) => {
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw Object.assign(new Error('Sign in required'), { status: 401 });
    try {
      const [header, payload, signature] = token.split('.'), expected = sign(`${header}.${payload}`);
      if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error('Invalid signature');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
      const algorithm = JSON.parse(Buffer.from(header, 'base64url').toString()).alg;
      const session = issued.get(claims.nonce);
      if (algorithm !== 'HS256' || claims.aud !== 'authenticated' || claims.role !== 'authenticated' || claims.iss !== `${origin}/auth/v1` || claims.exp <= Date.now() / 1000 || !session || session.revoked || claims.sub !== session.user.id) throw new Error('Invalid session');
      return { user: session.user, claims };
    } catch { throw Object.assign(new Error('Session expired'), { status: 401 }); }
  };
  const asActor = (id, operation) => {
    const pending = queue.then(async () => {
      await postgres.exec('begin; set local role authenticated;');
      try {
        await postgres.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
        const result = await operation();
        await postgres.exec('commit');
        return result;
      } catch (error) { await postgres.exec('rollback'); throw error; }
    });
    queue = pending.catch(() => {}); return pending;
  };
  const json = (response, value, status = 200) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, origin);
    try {
      let bytes = '';
      for await (const chunk of request) { bytes += chunk; if (Buffer.byteLength(bytes) > 2100000) throw Object.assign(new Error('Too large'), { status: 413 }); }
      requests.push({ method: request.method, path: url.pathname }); // Never record credentials or learner text.
      if (url.pathname.startsWith('/api/')) {
        const handler = handlers[url.pathname]?.[request.method];
        if (!handler) return json(response, { error: 'Unknown route' }, 404);
        const result = await handler(new Request(url, { method: request.method, headers: request.headers, ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: bytes }) }));
        if (url.pathname === '/api/state' && request.method === 'GET' && controls.holdStateGETResponses) {
          const hold = new Promise((release) => heldResponses.push(release));
          for (const ready of heldWaiters.splice(0)) ready();
          await hold;
        }
        const headers = Object.fromEntries(result.headers);
        const cookies = result.headers.getSetCookie(); if (cookies.length) headers['set-cookie'] = cookies;
        response.writeHead(result.status, headers); response.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (controls.offline) return json(response, { code: 'unavailable' }, 503);
      if (request.headers.apikey !== SYNTHETIC_PUBLIC_KEY) return json(response, { code: 'invalid_public_key' }, 401);
      const body = bytes ? JSON.parse(bytes) : {};
      if (url.pathname === '/auth/v1/otp') {
        if (!Object.values(SYNTHETIC_LEARNERS).some((user) => user.email === body.email)) return json(response, { code: 'synthetic_users_only' }, 400);
        return json(response, { sent: true }); // No email is sent.
      }
      if (url.pathname === '/auth/v1/verify') {
        const user = Object.values(SYNTHETIC_LEARNERS).find((user) => user.email === body.email);
        if (!user || body.token !== '123456') return json(response, { code: 'otp_expired' }, 403);
        return json(response, mint(user));
      }
      if (url.pathname === '/auth/v1/token') {
        const user = refreshes.get(body.refresh_token);
        if (!user) return json(response, { code: 'refresh_token_not_found' }, 400);
        refreshes.delete(body.refresh_token); return json(response, mint(user));
      }
      const verified = authenticate(request);
      if (url.pathname === '/auth/v1/user') return json(response, { ...verified.user, email_confirmed_at: new Date().toISOString() });
      if (url.pathname === '/auth/v1/logout') {
        issued.get(verified.claims.nonce).revoked = true;
        for (const [key, user] of refreshes) if (user.id === verified.user.id) refreshes.delete(key);
        return json(response, {});
      }
      if (url.pathname === '/rest/v1/lucid_state' && request.method === 'GET') {
        const requested = url.searchParams.get('user_id')?.replace(/^eq\./, '') ?? verified.user.id;
        const rows = await asActor(verified.user.id, async () => (await postgres.query('select revision, state from public.lucid_state where user_id=$1', [requested])).rows);
        return json(response, rows.map((row) => ({ ...row, revision: Number(row.revision) })));
      }
      if (url.pathname === '/rest/v1/rpc/lucid_save_state' && request.method === 'POST') {
        const saved = await asActor(verified.user.id, async () => (await postgres.query('select public.lucid_save_state($1,$2::jsonb) as revision', [body.expected_revision, JSON.stringify(body.new_state)])).rows[0].revision);
        if (controls.disconnectAfterSave) { controls.disconnectAfterSave = false; response.destroy(); return; }
        return json(response, Number(saved));
      }
      return json(response, { error: 'Unknown fixture endpoint' }, 404);
    } catch (error) {
      errors.push({ path: url.pathname, code: error.code ?? 'fixture_error', message: String(error.message).slice(0, 500) });
      const status = /^PT[0-9]{3}$/.test(error.code ?? '') ? Number(error.code.slice(2)) : error.status ?? (error instanceof SyntaxError ? 400 : 500);
      return json(response, { code: error.code ?? 'fixture_error', error: status < 500 ? error.message : 'Fixture operation failed' }, status);
    }
  });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveListen); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, controls, requests, errors, handlers,
    mint: (name, duration) => mint(SYNTHETIC_LEARNERS[name], duration),
    queryAs: asActor,
    waitForHeldResponse() { return heldResponses.length ? Promise.resolve() : new Promise((ready) => heldWaiters.push(ready)); },
    releaseHeldResponses() { controls.holdStateGETResponses = false; for (const release of heldResponses.splice(0)) release(); },
    async close() { controls.holdStateGETResponses = false; for (const release of heldResponses.splice(0)) release(); await queue; await new Promise((done, reject) => server.close((error) => error ? reject(error) : done())); },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const postgres = await createSharedPostgresFixture();
  const backend = await createSyntheticSharedBackend({ postgres, port: Number(process.env.LUCID_TEST_BACKEND_PORT ?? 4777) });
  console.log(`Synthetic Auth/PostgREST protocol fixture + real ${postgres.engine}; ${backend.origin}; no email sent.`);
  const close = async () => { await backend.close(); await postgres.close(); process.exit(); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
