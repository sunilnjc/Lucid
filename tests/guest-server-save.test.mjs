import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const moduleURL = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const source = async (path) => stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), "utf8"));
const professionalURL = moduleURL(await source("../lib/professional-content.ts"));
const expressionURL = moduleURL(await source("../lib/expression-content.ts"));
const idiomURL = moduleURL(await source("../lib/daily-idioms.ts"));
const dailyURL = moduleURL((await source("../lib/daily-vocabulary-state.ts"))
  .replace('from "./professional-content"', `from "${professionalURL}"`)
  .replace('from "./daily-idioms"', `from "${idiomURL}"`));
const stateURL = moduleURL((await source("../lib/web-learning-state.ts"))
  .replace('from "./daily-vocabulary-state"', `from "${dailyURL}"`));
const sharedURL = moduleURL((await source("../lib/shared-learning-state.ts"))
  .replace('from "./professional-content"', `from "${professionalURL}"`)
  .replace('from "./expression-content"', `from "${expressionURL}"`)
  .replace('from "./web-learning-state"', `from "${stateURL}"`));
const accountURL = moduleURL(await source("../lib/web-account.ts"));
const { validateSharedCloudState } = await import(sharedURL);
const { prepareWebState } = await import(stateURL);

const origin = "https://lucid.example.test";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const configured = { LUCID_SHARED_AUTH_ENABLED: "true", LUCID_SHARED_EMAIL_ENABLED: "true", LUCID_SUPABASE_URL: "https://fixture.supabase.co", LUCID_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic" };
const environment = {};
const controls = { environment };
globalThis.__lucidGuestSaveGate = controls;
const route = await import(moduleURL((await source("../app/api/state/route.ts"))
  .replace('import { eq } from "drizzle-orm";', 'const eq=(field,value)=>({field,value});')
  .replace('import { env } from "cloudflare:workers";', 'const env=globalThis.__lucidGuestSaveGate.environment;')
  .replace('from "@/lib/web-account"', `from "${accountURL}"`)
  .replace('from "@/lib/shared-learning-state"', `from "${sharedURL}"`)
  .replace('from "@/lib/web-learning-state"', `from "${stateURL}"`)
  .replace('import { getDb, initializeDatabase } from "@/db";', 'const initializeDatabase=async()=>{globalThis.__lucidGuestSaveGate.dbInitializations++;};const getDb=()=>{globalThis.__lucidGuestSaveGate.dbReads++;return globalThis.__lucidGuestSaveGate.db;};')
  .replace('import { learnerState } from "@/db/schema";', 'const learnerState={userKey:"userKey"};')));

function nativeState() {
  return { schemaVersion: 2, introducedWordIds: [], progressByWordId: {}, sessions: [], favouriteWordIds: [], completedWordIdsToday: [], currentWordIds: [], settings: { notificationsEnabled: false, reminderHour: 9, reminderMinute: 0, speechRate: 0.46 }, reviewPromptMilestone: 0 };
}
function reset() {
  for (const key of Object.keys(environment)) delete environment[key];
  Object.assign(environment, configured);
  Object.assign(controls, { authMode: "valid", calls: [], rpcCalls: [], row: null, dbInitializations: 0, dbReads: 0, legacyRows: new Map() });
  controls.db = { query: { learnerState: { async findFirst({ where }) { return controls.legacyRows.get(where.value); } } } };
}
async function provider(url, options = {}) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, configured.LUCID_SUPABASE_URL, "only the synthetic provider is callable");
  controls.calls.push({ url, options });
  if (parsed.pathname === "/auth/v1/user") {
    if (controls.authMode === "offline") throw new Error("synthetic network unavailable");
    if (controls.authMode === "revoked") return Response.json({ error: "revoked" }, { status: 401 });
    assert.equal(options.headers.Authorization, "Bearer synthetic-a");
    return Response.json({ id: A, email: "learner-a@example.test", email_confirmed_at: "2026-10-22T00:00:00Z" });
  }
  if (parsed.pathname === "/rest/v1/rpc/lucid_save_state") {
    const body = JSON.parse(options.body);
    controls.rpcCalls.push(body);
    if (body.expected_revision !== (controls.row?.revision ?? 0)) return Response.json({ error: "conflict" }, { status: 409 });
    controls.row = { revision: body.expected_revision + 1, state: structuredClone(body.new_state) };
    return Response.json(controls.row.revision);
  }
  if (parsed.pathname === "/rest/v1/lucid_state") {
    assert.equal(parsed.searchParams.get("user_id"), `eq.${A}`, "the server scopes reads to the provider UUID");
    return Response.json(controls.row ? [controls.row] : []);
  }
  throw new Error("Unexpected synthetic provider endpoint");
}
async function withProvider(run) {
  const previous = globalThis.fetch;
  reset(); globalThis.fetch = provider;
  try { await run(); } finally { globalThis.fetch = previous; }
}
function request(body = {}, headers = {}, authenticated = false) {
  return new Request(`${origin}/api/state`, { method: "PUT", headers: { origin, "content-type": "application/json", ...(authenticated ? { cookie: "lucid-shared-access=synthetic-a" } : {}), ...headers }, body: JSON.stringify(body) });
}
function forbidBodyRead(request) {
  let reads = 0;
  Object.defineProperty(request, "text", { value: async () => { reads++; throw new Error("request body must not be read"); } });
  return () => reads;
}

test("guest and forged legacy headers cannot reach durable storage or body parsing", async () => withProvider(async () => {
  for (const headers of [{}, { "x-lucid-device-id": "device-123456" }, { "oai-authenticated-user-id": "previous-sites-user" }, { "x-lucid-device-id": "device-123456", "oai-authenticated-user-id": "previous-sites-user", "x-lucid-state-source": "legacy", "content-length": "999999999" }]) {
    const incoming = request({ scopeKey: `supabase:${A}`, state: {}, sharedState: nativeState() }, headers);
    const bodyReads = forbidBodyRead(incoming);
    const response = await route.PUT(incoming);
    assert.equal(response.status, 401);
    const value = await response.json();
    assert.equal(value.requiresSignIn, true); assert.equal(value.guestSessionOnly, true);
    assert.match(value.error, /Sign in to save/);
    assert.equal(response.headers.get("cache-control"), "no-store, private");
    assert.equal(bodyReads(), 0);
  }
  assert.equal(controls.dbInitializations, 0); assert.equal(controls.dbReads, 0); assert.equal(controls.calls.length, 0);
}));

test("disabled, revoked and unavailable account service cannot fall back to a durable guest write", async () => withProvider(async () => {
  for (const [mode, expected] of [["disabled", 503], ["revoked", 401], ["offline", 503]]) {
    controls.authMode = mode;
    environment.LUCID_SHARED_AUTH_ENABLED = mode === "disabled" ? "false" : "true";
    const incoming = request({ scopeKey: "device:device-123456", state: {} }, { "x-lucid-device-id": "device-123456" }, true);
    const bodyReads = forbidBodyRead(incoming);
    assert.equal((await route.PUT(incoming)).status, expected);
    assert.equal(bodyReads(), 0);
  }
  assert.equal(controls.dbInitializations, 0); assert.equal(controls.rpcCalls.length, 0);
}));

test("disabled public auth and historical Sites trust never authorize a guest save", async () => withProvider(async () => {
  for (const auth of ["true", "false"]) {
    environment.LUCID_SHARED_AUTH_ENABLED = auth;
    environment.LUCID_TRUST_SITES_IDENTITY = "true";
    const incoming = request({}, { "oai-authenticated-user-id": "previous-sites-user", "x-lucid-device-id": "device-123456" });
    const bodyReads = forbidBodyRead(incoming);
    assert.equal((await route.PUT(incoming)).status, 401); assert.equal(bodyReads(), 0);
  }
  assert.equal(controls.calls.length, 0); assert.equal(controls.dbInitializations, 0); assert.equal(controls.dbReads, 0);
}));

test("same-origin protection applies before provider or storage access, including guest-shaped requests", async () => withProvider(async () => {
  for (const authenticated of [false, true]) {
    for (const headers of [{ origin: "https://attacker.example.test" }, { "sec-fetch-site": "cross-site" }]) {
      const incoming = request({}, headers, authenticated); const bodyReads = forbidBodyRead(incoming);
      assert.equal((await route.PUT(incoming)).status, 403); assert.equal(bodyReads(), 0);
    }
  }
  assert.equal(controls.calls.length, 0); assert.equal(controls.dbInitializations, 0);
}));

test("verified account retains exact-revision CAS, provider ownership and safe response semantics", async () => withProvider(async () => {
  const state = nativeState(); assert.equal(validateSharedCloudState(state), true);
  controls.row = { revision: 4, state: nativeState() };
  const response = await route.PUT(request({ scopeKey: `supabase:${A}`, sharedState: state, expectedRevision: 4 }, { "oai-authenticated-user-id": B, "x-lucid-device-id": "device-123456" }, true));
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.identity, `supabase:${A}`); assert.equal(value.revision, 5); assert.deepEqual(value.sharedState, state);
  assert.deepEqual(controls.rpcCalls, [{ expected_revision: 4, new_state: state }]);
  assert.equal(controls.dbInitializations, 0); assert.equal(controls.dbReads, 0);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.doesNotMatch(JSON.stringify(value), /synthetic-a|access_token|refresh_token/);
}));

test("verified account cannot write another scope or overwrite a newer shared revision", async () => withProvider(async () => {
  const state = nativeState(); controls.row = { revision: 7, state };
  assert.equal((await route.PUT(request({ scopeKey: `supabase:${B}`, sharedState: state, expectedRevision: 7 }, {}, true))).status, 409);
  assert.equal(controls.rpcCalls.length, 0);
  const before = structuredClone(controls.row);
  assert.equal((await route.PUT(request({ scopeKey: `supabase:${A}`, sharedState: state, expectedRevision: 6 }, {}, true))).status, 409);
  assert.deepEqual(controls.row, before); assert.equal(controls.dbInitializations, 0);
}));

test("new write gate preserves exact legacy rows and their explicit read/import path", async () => withProvider(async () => {
  const legacy = prepareWebState({ version: 2, settings: { lessonTime: "09:00", timeZone: "UTC", dailyWordCount: 3 }, introducedWordIds: ["old-guest-word"] });
  controls.legacyRows.set("device:device-123456", { state: legacy });
  const before = JSON.stringify([...controls.legacyRows]);
  assert.equal((await route.PUT(request({ scopeKey: "device:device-123456", state: legacy }, { "x-lucid-device-id": "device-123456" }))).status, 401);
  assert.equal(controls.dbInitializations, 0);
  const response = await route.GET(new Request(`${origin}/api/state`, { headers: { cookie: "lucid-shared-access=synthetic-a", "x-lucid-state-source": "legacy", "x-lucid-device-id": "device-123456" } }));
  assert.equal(response.status, 200);
  const value = await response.json(); assert.equal(value.identity, "device:device-123456"); assert.deepEqual(value.state.introducedWordIds, ["old-guest-word"]);
  assert.equal(JSON.stringify([...controls.legacyRows]), before); assert.equal(controls.dbInitializations, 1); assert.equal(controls.rpcCalls.length, 0);
}));
