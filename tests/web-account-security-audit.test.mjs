import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Production account functions with an injected, memory-only provider. Never contacts Auth.
const source = stripTypeScriptTypes(await readFile(new URL("../lib/web-account.ts", import.meta.url), "utf8"));
const { sharedAuthConfig, handleAccountRequest, verifiedSharedAccount } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const origin = "https://lucid.example.invalid";
const environment = { LUCID_SHARED_AUTH_ENABLED: "true", LUCID_SHARED_EMAIL_ENABLED: "true", LUCID_SUPABASE_URL: "https://fixture.supabase.co", LUCID_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic" };
const user = (id = A) => ({ id, email: "synthetic@example.invalid", email_confirmed_at: new Date().toISOString() });
const session = (id = A) => ({ access_token: `synthetic-access-${id}`, refresh_token: `synthetic-refresh-${id}`, expires_in: 3600, user: user(id) });
function request(action = "status", { body, raw, headers = {}, method = action === "status" ? "GET" : "POST" } = {}) {
  return new Request(`${origin}/api/account/${action}`, { method, headers: { Origin: origin, "Content-Type": "application/json", ...headers }, ...(raw !== undefined ? { body: raw } : body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function provider(overrides = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (overrides[path]) return overrides[path](url, options);
    if (path === "/auth/v1/user") return Response.json(user());
    if (path === "/auth/v1/verify" || path === "/auth/v1/token") return Response.json(session());
    if (path === "/auth/v1/otp" || path === "/auth/v1/logout") return new Response(null, { status: 204 });
    throw new Error(`Unexpected synthetic provider path: ${path}`);
  };
  return { calls, fetch };
}
const cookieHeaders = { Cookie: "lucid-shared-access=expired; lucid-shared-refresh=one-use-synthetic-refresh" };
function applyCookies(jar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const [name, value] = cookie.split(";", 1)[0].split("=");
    if (cookie.includes("Max-Age=0")) jar.delete(name); else jar.set(name, value);
  }
}
function assertNoClearingCookies(response) {
  assert.ok(response.headers.getSetCookie().every((cookie) => !cookie.includes("Max-Age=0")), "A failed background response must not erase a later verified session");
}

test("a late failed refresh response cannot erase cookies from a successful concurrent restoration", async () => {
  let consumed = false;
  const p = provider({
    "/auth/v1/user": (_url, options) => options.headers.Authorization === `Bearer ${session().access_token}` ? Response.json(user()) : Response.json({ error: "expired" }, { status: 401 }),
    "/auth/v1/token": () => {
      if (consumed) return Response.json({ error: "synthetic one-use refresh already consumed" }, { status: 401 });
      consumed = true; return Response.json(session());
    },
  });
  const responses = await Promise.all([handleAccountRequest(request("status", { headers: cookieHeaders }), environment, "status", p.fetch), handleAccountRequest(request("status", { headers: cookieHeaders }), environment, "status", p.fetch)]);
  const success = responses.find((response) => response.status === 200), failure = responses.find((response) => response.status === 401);
  assert.ok(success); assert.ok(failure, "The fixture must exercise a real failed refresh response");
  assert.equal(success.headers.getSetCookie().length, 2);
  const jar = new Map(); applyCookies(jar, success); applyCookies(jar, failure);
  assert.equal(decodeURIComponent(jar.get("lucid-shared-access")), session().access_token);
  assert.equal(decodeURIComponent(jar.get("lucid-shared-refresh")), session().refresh_token);
  assertNoClearingCookies(failure);
});

test("failed status and verification preserve current cookies; explicit signout clears them", async () => {
  const rejected = provider({ "/auth/v1/user": () => Response.json({ error: "revoked" }, { status: 401 }), "/auth/v1/token": () => Response.json({ error: "revoked" }, { status: 401 }), "/auth/v1/verify": () => Response.json({ error: "bad code" }, { status: 401 }) });
  for (const action of ["status", "verify"]) {
    const response = await handleAccountRequest(request(action, { headers: cookieHeaders, ...(action === "verify" ? { body: { email: "synthetic@example.invalid", code: "123456" } } : {}) }), environment, action, rejected.fetch);
    assert.equal(response.status, 401); assertNoClearingCookies(response);
    assert.equal(response.headers.get("Cache-Control"), "no-store, private");
  }
  const signedOut = await handleAccountRequest(request("signout", { headers: cookieHeaders, body: {} }), environment, "signout", rejected.fetch);
  assert.equal(signedOut.status, 200);
  assert.equal(signedOut.headers.getSetCookie().length, 2);
  assert.ok(signedOut.headers.getSetCookie().every((cookie) => cookie.includes("Max-Age=0")));
});

test("arbitrary synthetic keys require the explicit test flag and an exact loopback host", () => {
  for (const url of ["https://provider.example.invalid", "https://localhost.example.invalid", "https://127.0.0.1.example.invalid"]) {
    assert.equal(sharedAuthConfig({ ...environment, LUCID_SHARED_ALLOW_LOCAL_TEST: "true", LUCID_SUPABASE_URL: url, LUCID_SUPABASE_PUBLISHABLE_KEY: "synthetic-only-key" }), null, url);
  }
  for (const url of ["http://localhost:4777", "http://127.0.0.1:4777", "http://[::1]:4777"]) {
    assert.equal(sharedAuthConfig({ ...environment, LUCID_SHARED_ALLOW_LOCAL_TEST: "true", LUCID_SUPABASE_URL: url, LUCID_SUPABASE_PUBLISHABLE_KEY: "synthetic-only-key" })?.url, url);
    assert.equal(sharedAuthConfig({ ...environment, LUCID_SUPABASE_URL: url, LUCID_SUPABASE_PUBLISHABLE_KEY: "synthetic-only-key" }), null);
  }
  const serviceRole = `a.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.c`;
  for (const key of ["sb_secret_synthetic", serviceRole]) assert.equal(sharedAuthConfig({ ...environment, LUCID_SHARED_ALLOW_LOCAL_TEST: "true", LUCID_SUPABASE_URL: "http://127.0.0.1:4777", LUCID_SUPABASE_PUBLISHABLE_KEY: key }), null);
});

test("cross-origin account mutations stop before provider calls even with expired cookies", async () => {
  const p = provider();
  for (const action of ["otp", "verify", "signout"]) {
    for (const headers of [{ Origin: "https://attacker.example.invalid" }, { "Sec-Fetch-Site": "cross-site" }]) {
      const response = await handleAccountRequest(request(action, { headers: { ...cookieHeaders, ...headers }, body: { email: "synthetic@example.invalid", code: "123456" } }), environment, action, p.fetch);
      assert.equal(response.status, 403, action); assertNoClearingCookies(response);
    }
  }
  assert.equal(p.calls.length, 0);
});

test("malformed and oversized account bodies are rejected before email or verification calls", async () => {
  const p = provider();
  const cases = [
    { raw: "{", status: 400 }, { raw: "null", status: 400 }, { raw: "[]", status: 400 },
    { raw: JSON.stringify({ email: "é".repeat(1100) }), status: 413 },
    { body: { email: "synthetic@example.invalid" }, headers: { "Content-Length": "2049" }, status: 413 },
    { body: { email: "bad\nemail@example.invalid" }, status: 400 },
  ];
  for (const { status, ...options } of cases) {
    const response = await handleAccountRequest(request("otp", options), environment, "otp", p.fetch);
    assert.equal(response.status, status); assertNoClearingCookies(response);
  }
  for (const code of [123456, "12345", "12345678901", "12345a"]) {
    const response = await handleAccountRequest(request("verify", { body: { email: "synthetic@example.invalid", code } }), environment, "verify", p.fetch);
    assert.equal(response.status, 400);
  }
  assert.equal(p.calls.length, 0);
});

test("bearer identity takes precedence over cookie identity without falling back to another account", async () => {
  const p = provider({ "/auth/v1/user": (_url, options) => options.headers.Authorization === "Bearer synthetic-bob" ? Response.json(user(B)) : Response.json({ error: "invalid bearer" }, { status: 401 }) });
  const account = await verifiedSharedAccount(request("status", { headers: { ...cookieHeaders, Authorization: "Bearer synthetic-bob", "oai-authenticated-user-id": A, "x-lucid-account-id": A } }), environment, p.fetch);
  assert.equal(account.identity, `supabase:${B}`); assert.deepEqual(account.cookies, []);
  await assert.rejects(verifiedSharedAccount(request("status", { headers: { ...cookieHeaders, Authorization: "Bearer invalid-synthetic" } }), environment, p.fetch), /no longer valid/);
  assert.equal(p.calls.filter((call) => new URL(call.url).pathname === "/auth/v1/token").length, 0, "Bearer failure must not silently refresh a different cookie account");
});

test("a refreshed provider user mismatch is rejected without issuing or clearing cookies", async () => {
  let reads = 0;
  const p = provider({ "/auth/v1/user": () => ++reads === 1 ? Response.json({ error: "expired" }, { status: 401 }) : Response.json(user(B)) });
  const response = await handleAccountRequest(request("status", { headers: cookieHeaders }), environment, "status", p.fetch);
  assert.equal(response.status, 401); assert.equal((await response.json()).identity, null);
  assert.deepEqual(response.headers.getSetCookie(), []);
});

test("malformed or failed provider responses expose no provider text, email, or tokens", async () => {
  const marker = "SYNTHETIC-PRIVATE-PROVIDER-DETAIL";
  const replies = [new Response(marker, { status: 200 }), Response.json({ access_token: marker, refresh_token: marker, expires_in: 0, user: user() }), Response.json({ internal: marker }, { status: 500 })];
  for (const reply of replies) {
    const p = provider({ "/auth/v1/verify": () => reply });
    const response = await handleAccountRequest(request("verify", { body: { email: "synthetic@example.invalid", code: "123456" } }), environment, "verify", p.fetch);
    assert.ok(response.status >= 400); assertNoClearingCookies(response);
    const body = JSON.stringify(await response.json());
    assert.ok(!body.includes(marker)); assert.ok(!body.includes("synthetic@example.invalid"));
    assert.equal(response.headers.get("Cache-Control"), "no-store, private");
  }
});

test("reauthentication OTP uses only the current verified account email and never creates another user", async () => {
  const p = provider();
  const response = await handleAccountRequest(request("reverify-otp", { headers: { Cookie: "lucid-shared-access=synthetic-current" }, body: { expectedIdentity: `supabase:${A}`, email: "attacker-selected@example.invalid" } }), environment, "reverify-otp", p.fetch);
  assert.equal(response.status, 200);
  const sent = p.calls.filter((call) => new URL(call.url).pathname === "/auth/v1/otp");
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0].options.body), { email: user().email, create_user: false });
  assertNoClearingCookies(response);
  const before = p.calls.length;
  const wrongScope = await handleAccountRequest(request("reverify-otp", { headers: { Cookie: "lucid-shared-access=synthetic-current" }, body: { expectedIdentity: `supabase:${B}` } }), environment, "reverify-otp", p.fetch);
  assert.equal(wrongScope.status, 409);
  assert.ok(p.calls.slice(before).every((call) => new URL(call.url).pathname === "/auth/v1/user"));
  const anonymous = await handleAccountRequest(request("reverify-otp", { body: { expectedIdentity: `supabase:${A}` } }), environment, "reverify-otp", p.fetch);
  assert.equal(anonymous.status, 401);
  assert.equal(p.calls.filter((call) => new URL(call.url).pathname === "/auth/v1/otp").length, 1);
});

test("same-account reverify validates the exact provider UUID before issuing refreshed cookies", async () => {
  const p = provider();
  const response = await handleAccountRequest(request("reverify", { headers: { Cookie: "lucid-shared-access=synthetic-current" }, body: { expectedIdentity: `supabase:${A}`, code: "123456", email: "attacker-selected@example.invalid" } }), environment, "reverify", p.fetch);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.identity, `supabase:${A}`); assert.equal(value.reverified, true);
  assert.ok(!JSON.stringify(value).includes(session().access_token)); assert.ok(!JSON.stringify(value).includes(session().refresh_token));
  assert.equal(response.headers.getSetCookie().length, 2);
  const verification = p.calls.find((call) => new URL(call.url).pathname === "/auth/v1/verify");
  assert.deepEqual(JSON.parse(verification.options.body), { email: user().email, token: "123456", type: "email" });
});

test("reauthentication cannot replace Alice with another UUID bearing the same email label", async () => {
  let reads = 0;
  const p = provider({ "/auth/v1/user": () => Response.json(user(++reads === 1 ? A : B)), "/auth/v1/verify": () => Response.json(session(B)) });
  const response = await handleAccountRequest(request("reverify", { headers: { Cookie: "lucid-shared-access=synthetic-current" }, body: { expectedIdentity: `supabase:${A}`, code: "123456" } }), environment, "reverify", p.fetch);
  assert.ok([401, 409].includes(response.status));
  assert.deepEqual(response.headers.getSetCookie(), []);
  assert.equal((await response.json()).identity, null);
  assert.ok(p.calls.every((call) => !new URL(call.url).pathname.startsWith("/functions/")));
});
