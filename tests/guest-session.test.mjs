import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const dataURL = (value) => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
const sourceURL = async (path) => dataURL(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), "utf8")));
const professionalURL = await sourceURL("../lib/professional-content.ts");
const expressionURL = await sourceURL("../lib/expression-content.ts");
const idiomURL = await sourceURL("../lib/daily-idioms.ts");
const dailySource = stripTypeScriptTypes(await readFile(new URL("../lib/daily-vocabulary-state.ts", import.meta.url), "utf8")).replace('from "./professional-content"', `from "${professionalURL}"`).replace('from "./daily-idioms"', `from "${idiomURL}"`);
const dailyURL = dataURL(dailySource);
const stateSource = stripTypeScriptTypes(await readFile(new URL("../lib/web-learning-state.ts", import.meta.url), "utf8")).replace('from "./daily-vocabulary-state"', `from "${dailyURL}"`);
const stateURL = dataURL(stateSource);
const stateModule = await import(stateURL);
const sharedSource = stripTypeScriptTypes(await readFile(new URL("../lib/shared-learning-state.ts", import.meta.url), "utf8")).replace('from "./professional-content"', `from "${professionalURL}"`).replace('from "./expression-content"', `from "${expressionURL}"`).replace('from "./web-learning-state"', `from "${stateURL}"`);
const sharedURL = dataURL(sharedSource);
const guestSource = stripTypeScriptTypes(await readFile(new URL("../lib/guest-learning.ts", import.meta.url), "utf8")).replace('from "./expression-content"', `from "${expressionURL}"`);
const guestURL = dataURL(guestSource);
const syncSource = stripTypeScriptTypes(await readFile(new URL("../lib/web-learning-sync.ts", import.meta.url), "utf8")).replace(/import \{ useCallback, useEffect, useRef, useState \} from "react";/, "const useCallback = (f) => f, useEffect = () => {}, useRef = () => {}, useState = () => {};").replace('from "./web-learning-state"', `from "${stateURL}"`).replace('from "./shared-learning-state"', `from "${sharedURL}"`).replace('from "./daily-vocabulary-state"', `from "${dailyURL}"`).replace('from "./guest-learning"', `from "${guestURL}"`);
const { createWebLearningSync } = await import(dataURL(syncSource));
const defaults = { version: 3, profile: null, settings: { lessonTime: "09:00", timeZone: "Etc/UTC", dailyWordCount: 3 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [] };
const fresh = () => stateModule.prepareWebState(defaults, defaults);
const deviceId = "guest-fixture-browser";
const deviceKey = `lucid-learning-v3:${encodeURIComponent(`device:${deviceId}`)}`;
const sessionKey = "lucid-guest-learning-session-v1";
const ids = ["finance-reconcile", "finance-discrepancy", "finance-variance", "finance-outstanding", "finance-cut-off", "finance-seasonal"];
const alice = "supabase:11111111-1111-4111-8111-111111111111", bob = "supabase:22222222-2222-4222-8222-222222222222";
function storage(seed = {}) { const entries = new Map(Object.entries(seed)); return { entries, fail: false, getItem(key) { if (this.fail) throw new Error("storage unavailable"); return entries.get(key) ?? null; }, setItem(key, value) { if (this.fail) throw new Error("storage unavailable"); entries.set(key, value); } }; }
function server() {
  return { identity: null, reads: 0, calls: [], writes: [], records: new Map(), legacy: null, afterRead: null, override: null, async fetch(_url, options) {
    this.calls.push(options.method ?? "GET");
    const overridden = await this.override?.(_url, options); if (overridden) return overridden;
    const legacy = options.headers?.["x-lucid-state-source"] === "legacy";
    if (legacy) return Response.json({ identity: `device:${deviceId}`, state: this.legacy });
    if (!this.identity) return Response.json({ requiresSignIn: true }, { status: 401 });
    if (options.method === "PUT") {
      const body = JSON.parse(options.body); this.writes.push(body);
      if (body.scopeKey !== this.identity) return Response.json({ identity: this.identity }, { status: 409 });
      const old = this.records.get(this.identity);
      if (body.expectedRevision !== (old?.revision ?? 0)) return Response.json({ identity: this.identity }, { status: 409 });
      this.records.set(this.identity, { revision: (old?.revision ?? 0) + 1, sharedState: body.sharedState });
    }
    this.reads += 1;
    const identity = this.identity, record = this.records.get(identity);
    const reply = Response.json({ identity, revision: record?.revision ?? 0, sharedState: record?.sharedState ?? null, state: null });
    this.afterRead?.(this.reads); return reply;
  } };
}
function controller(durable, tab, remote, cap = 5) { return createWebLearningSync({ storage: durable, sessionStorage: tab, guestFirst: true, guestCap: cap, fetch: remote.fetch.bind(remote), defaults, deviceId }); }
function draft(instance, id, text = "A fictional sentence kept in this tab.") { return instance.commit((state) => ({ ...state, learningV3: { ...state.learningV3, practiceDrafts: { ...state.learningV3.practiceDrafts, [`${id}::finance-accounting`]: text } } })); }
async function signIn(instance, remote, identity) { await instance.suspendForAccountChange(); remote.identity = identity; await instance.refreshIdentity(); await instance.retrySync(); }

// These are controlled local fixtures, not evidence of hosted email/session acceptance.
test("public 401 starts a fresh temporary guest without opening or changing durable legacy learning", async () => {
  const old = fresh(); old.favouriteIds = [ids[4]]; old.learningV3.practiceDrafts.private = "Earlier private writing";
  const raw = JSON.stringify(old), durable = storage({ [deviceKey]: raw, "lucid-offline-state": raw }), tab = storage(), remote = server();
  const instance = controller(durable, tab, remote); await instance.load();
  assert.equal(instance.snapshot().ready, true); assert.equal(instance.snapshot().guest.active, true); assert.equal(instance.snapshot().guest.legacyAvailable, true);
  assert.deepEqual(instance.snapshot().state.favouriteIds, []); assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, undefined);
  assert.equal(durable.entries.get(deviceKey), raw); assert.equal(durable.entries.get("lucid-offline-state"), raw);
  assert.deepEqual(instance.legacyGuestBackup(), { name: "lucid-earlier-device-learning.json", content: raw });
  assert.equal(remote.writes.length, 0); assert.ok(tab.entries.has(sessionKey)); instance.dispose();
});

test("guest exploration survives same-tab reload, has a cumulative cap and never uploads anonymous progress", async () => {
  const durable = storage(), tab = storage(), remote = server(); let instance = controller(durable, tab, remote); await instance.load();
  const initialRequests = remote.calls.length;
  for (const id of ids.slice(0, 5)) assert.equal(draft(instance, id), true);
  assert.equal(remote.calls.length, initialRequests, "typing guest drafts must not poll account storage");
  assert.equal(instance.canExploreItem(`word:${ids[0]}`), true); assert.equal(instance.canExploreItem(`word:${ids[5]}`), false);
  await instance.retrySync(); assert.equal(instance.snapshot().guest.used, 5); assert.equal(remote.writes.length, 0);
  const before = JSON.stringify(instance.snapshot().state);
  assert.equal(draft(instance, ids[5]), false); assert.equal(instance.getGuestPrompt(), "limit"); assert.equal(instance.snapshot().status, "saved"); assert.equal(JSON.stringify(instance.snapshot().state), before);
  instance.dismissGuestPrompt(); assert.equal(draft(instance, ids[0], "A revised temporary answer."), true);
  assert.equal(instance.commit((state) => ({ ...state, learningV3: { ...state.learningV3, practiceDrafts: {} } })), true);
  await instance.retrySync(); instance.dispose(); instance = controller(durable, tab, remote); await instance.load();
  assert.equal(instance.snapshot().guest.used, 5); assert.equal(instance.canExploreItem(`word:${ids[0]}`), true); assert.equal(instance.canExploreItem(`word:${ids[5]}`), false); assert.equal(draft(instance, ids[5]), false); assert.equal(draft(instance, ids[0]), true);
  assert.equal([...durable.entries.keys()].some((key) => key.startsWith("lucid-learning-v3:")), false); assert.equal(remote.writes.length, 0); instance.dispose();
});

test("bookmark and backup saves request sign-in without changing temporary work or blocking reference browsing", async () => {
  const durable = storage(), tab = storage(), remote = server(), instance = controller(durable, tab, remote); await instance.load();
  assert.equal(draft(instance, ids[0]), true); await instance.retrySync(); const original = tab.entries.get(sessionKey);
  assert.equal(instance.commit((state) => ({ ...state, favouriteIds: [ids[0]] })), false); assert.equal(instance.getGuestPrompt(), "save");
  assert.equal(instance.snapshot().status, "saved"); assert.equal(tab.entries.get(sessionKey), original);
  assert.equal(await instance.recoverFromBackup({ version: 99 }), false); assert.equal(instance.getGuestPrompt(), "save"); assert.equal(tab.entries.get(sessionKey), original);
  instance.dismissGuestPrompt();
  assert.equal(instance.commit((state) => ({ ...state, learningV3: { ...state.learningV3, exposedOn: Object.fromEntries(ids.map((id) => [`${id}::finance-accounting`, "2026-10-22"])) } })), true);
  assert.equal(instance.snapshot().guest.used, 1); assert.equal(instance.getGuestPrompt(), null); instance.dispose();
});

test("guest exploration uses memory when durable and tab storage are unavailable", async () => {
  const durable = storage(), tab = storage(), remote = server(); durable.fail = tab.fail = true;
  const instance = controller(durable, tab, remote); await instance.load();
  assert.equal(instance.snapshot().ready, true); assert.equal(instance.snapshot().guest.active, true); assert.equal(draft(instance, ids[0]), true);
  assert.equal(instance.snapshot().guest.used, 1); assert.equal(instance.snapshot().state.learningV3.practiceDrafts[`${ids[0]}::finance-accounting`], "A fictional sentence kept in this tab.");
  assert.equal(remote.writes.length, 0); instance.dispose();
});

test("sign-in keeps guest work separate and explicit import preserves its raw private source", async () => {
  const durable = storage(), tab = storage(), remote = server(), instance = controller(durable, tab, remote); await instance.load();
  const secret = "Fictional guest private draft must stay in its source tab"; assert.equal(draft(instance, ids[0], secret), true); await instance.retrySync();
  const source = tab.entries.get(sessionKey); await signIn(instance, remote, alice);
  assert.equal(instance.snapshot().guest.active, false); assert.equal(instance.snapshot().guest.sessionImportAvailable, true);
  assert.deepEqual(instance.snapshot().state.favouriteIds, []); assert.equal(instance.snapshot().state.learningV3.practiceDrafts[`${ids[0]}::finance-accounting`], undefined);
  assert.doesNotMatch(JSON.stringify(remote.writes), /Fictional guest private draft/);
  assert.equal(await instance.importGuestSession(alice), true); await instance.retrySync();
  assert.ok(instance.snapshot().state.favouriteIds.includes(ids[0])); assert.equal(tab.entries.get(sessionKey), source);
  const accountRaw = durable.entries.get(`lucid-learning-v3:${encodeURIComponent(alice)}`); assert.doesNotMatch(accountRaw, /Fictional guest private draft/);
  assert.doesNotMatch(JSON.stringify(remote.writes), /Fictional guest private draft/); assert.equal(remote.writes.at(-1).scopeKey, alice);
  await signIn(instance, remote, bob); assert.deepEqual(instance.snapshot().state.favouriteIds, []); assert.equal(tab.entries.get(sessionKey), source); instance.dispose();
});

test("legacy durable import remains explicit and byte-preserving after guest storage becomes temporary", async () => {
  const old = fresh(); old.favouriteIds = [ids[1]]; old.learningV3.favouriteChanges[ids[1]] = { selected: true, updatedAt: "2026-10-21T10:00:00.000Z" };
  old.learningV3.practiceDrafts.private = "Earlier private writing never transfers";
  const raw = JSON.stringify(old), durable = storage({ [deviceKey]: raw }), tab = storage(), remote = server(), instance = controller(durable, tab, remote);
  await instance.load(); await signIn(instance, remote, alice); assert.deepEqual(instance.snapshot().state.favouriteIds, []);
  assert.equal(await instance.importLegacyProgress(`device:${deviceId}`, alice), true); await instance.retrySync();
  assert.ok(instance.snapshot().state.favouriteIds.includes(ids[1])); assert.equal(durable.entries.get(deviceKey), raw);
  assert.doesNotMatch(durable.entries.get(`lucid-learning-v3:${encodeURIComponent(alice)}`), /Earlier private writing never transfers/); instance.dispose();
});

test("a changed account or guest source interrupts explicit import without replaying work", async () => {
  const durable = storage(), tab = storage(), remote = server(), instance = controller(durable, tab, remote); await instance.load();
  assert.equal(draft(instance, ids[0]), true); await instance.retrySync(); const source = tab.entries.get(sessionKey);
  await signIn(instance, remote, alice); const accountKey = `lucid-learning-v3:${encodeURIComponent(alice)}`, accountBytes = durable.entries.get(accountKey);
  remote.afterRead = () => { remote.identity = bob; remote.afterRead = null; };
  assert.equal(await instance.importGuestSession(alice), false); assert.equal(tab.entries.get(sessionKey), source); assert.equal(durable.entries.get(accountKey), accountBytes);
  remote.identity = alice; await instance.refreshIdentity(); await instance.retrySync();
  const freshAccount = durable.entries.get(accountKey);
  remote.afterRead = () => { const changed = JSON.parse(tab.entries.get(sessionKey)); changed.state.learningV3.practiceDrafts[`${ids[0]}::finance-accounting`] = "Changed during import"; tab.entries.set(sessionKey, JSON.stringify(changed)); remote.afterRead = null; };
  assert.equal(await instance.importGuestSession(alice), false); assert.equal(durable.entries.get(accountKey), freshAccount); assert.match(instance.snapshot().error, /guest session changed/); instance.dispose();
});

test("damaged temporary data does not open an account cache under an unverified identity or block a verified account", async () => {
  const account = fresh(); account.favouriteIds = [ids[2]];
  const accountKey = `lucid-learning-v3:${encodeURIComponent(alice)}`, accountBytes = JSON.stringify(account);
  const durable = storage({ [accountKey]: accountBytes }), tab = storage({ [sessionKey]: "unreadable original temporary bytes" }), remote = server();
  let instance = controller(durable, tab, remote); await instance.load();
  assert.deepEqual(instance.snapshot().state.favouriteIds, []); assert.equal(durable.entries.get(accountKey), accountBytes); assert.equal(tab.entries.get(sessionKey), "unreadable original temporary bytes");
  remote.identity = alice; await instance.refreshIdentity(); await instance.retrySync();
  assert.equal(instance.snapshot().scopeKey, alice); assert.ok(instance.snapshot().state.favouriteIds.includes(ids[2])); instance.dispose();
});


test("a legacy Sites identity cannot turn new guest practice into durable storage or open its old private cache", async () => {
  const old = fresh(); old.learningV3.practiceDrafts.private = "Earlier Sites account private work";
  const sitesScope = "user:legacy-sites-account", oldKey = `lucid-learning-v3:${encodeURIComponent(sitesScope)}`, raw = JSON.stringify(old);
  const durable = storage({ [oldKey]: raw }), tab = storage(), calls = [];
  const remote = { async fetch(_url, options) { calls.push(options.method ?? "GET"); return Response.json({ identity: sitesScope, state: old }); } };
  const instance = controller(durable, tab, remote); await instance.load();
  assert.equal(instance.snapshot().scopeKey, `device:${deviceId}`); assert.equal(instance.snapshot().guest.active, true);
  assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, undefined);
  assert.equal(draft(instance, ids[0]), true); await instance.retrySync();
  assert.equal(calls.includes("PUT"), false); assert.equal(durable.entries.get(oldKey), raw); instance.dispose();
});

test("a fresh unverified visit never opens old account cache and failed account work still blocks identity changes", async () => {
  const old = fresh(); old.learningV3.practiceDrafts.private = "Own account private work";
  const accountKey = `lucid-learning-v3:${encodeURIComponent(alice)}`, durable = storage({ [accountKey]: JSON.stringify(old) }), tab = storage(), remote = server(), instance = controller(durable, tab, remote);
  await instance.load(); assert.equal(instance.snapshot().guest.active, true); assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, undefined);
  await signIn(instance, remote, alice); assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, "Own account private work");
  durable.fail = true;
  assert.equal(draft(instance, ids[0], "Pending account-only private change"), false);
  await assert.rejects(instance.suspendForAccountChange(), /pending learning changes/);
  assert.equal(instance.snapshot().scopeKey, alice); assert.equal(instance.snapshot().status, "error");
  durable.fail = false; await instance.retrySync(); await instance.suspendForAccountChange(); remote.identity = null; await instance.refreshIdentity();
  assert.equal(instance.snapshot().guest.active, true); assert.equal(instance.snapshot().state.learningV3.practiceDrafts[`${ids[0]}::finance-accounting`], undefined);
  assert.match(durable.entries.get(accountKey), /Pending account-only private change/); instance.dispose();
});


test("an unscoped earlier guest record is imported only after device and account verification, with exact source retained", async () => {
  const old = fresh(); old.favouriteIds = [ids[3]]; old.learningV3.favouriteChanges[ids[3]] = { selected: true, updatedAt: "2026-10-21T10:00:00.000Z" };
  old.learningV3.practiceDrafts.private = "Unscoped earlier private text";
  const raw = JSON.stringify(old), durable = storage({ "lucid-offline-state": raw }), tab = storage(), remote = server(), instance = controller(durable, tab, remote);
  await instance.load(); assert.deepEqual(instance.snapshot().state.favouriteIds, []); assert.equal(instance.snapshot().guest.legacyAvailable, true);
  await signIn(instance, remote, alice);
  assert.equal(await instance.importLegacyProgress(`device:${deviceId}`, alice), true); await instance.retrySync();
  assert.ok(instance.snapshot().state.favouriteIds.includes(ids[3])); assert.equal(durable.entries.get("lucid-offline-state"), raw);
  assert.doesNotMatch(durable.entries.get(`lucid-learning-v3:${encodeURIComponent(alice)}`), /Unscoped earlier private text/); instance.dispose();
});


test("background identity refresh opens only the verified account and never auto-imports guest work", async () => {
  const durable = storage(), tab = storage(), remote = server(), instance = controller(durable, tab, remote); await instance.load();
  assert.equal(draft(instance, ids[0], "Temporary guest text stays private"), true); const source = tab.entries.get(sessionKey);
  remote.identity = alice; await instance.retrySync();
  assert.equal(instance.snapshot().scopeKey, alice); assert.equal(instance.snapshot().guest.active, false);
  assert.deepEqual(instance.snapshot().state.favouriteIds, []); assert.deepEqual(instance.snapshot().state.learningV3.practiceDrafts, {});
  assert.equal(tab.entries.get(sessionKey), source); assert.doesNotMatch(JSON.stringify(remote.writes), /Temporary guest text/); instance.dispose();
});

test("an account cache failure during background refresh is surfaced without relabeling guest private work", async () => {
  const durable = storage(), tab = storage(), remote = server(), instance = controller(durable, tab, remote); await instance.load();
  assert.equal(draft(instance, ids[0], "Temporary guest writing"), true); const source = tab.entries.get(sessionKey);
  durable.fail = true; remote.identity = alice; await instance.retrySync();
  assert.equal(instance.snapshot().scopeKey, alice); assert.equal(instance.snapshot().status, "error");
  assert.deepEqual(instance.snapshot().state.learningV3.practiceDrafts, {}); assert.equal(tab.entries.get(sessionKey), source); assert.equal(remote.writes.length, 0); instance.dispose();
});

test("expired account plus damaged guest storage cannot reopen private account state under a guest identity", async () => {
  const own = fresh(); own.learningV3.practiceDrafts.private = "Verified account private draft";
  const accountKey = `lucid-learning-v3:${encodeURIComponent(alice)}`, durable = storage({ [accountKey]: JSON.stringify(own) }), tab = storage({ [sessionKey]: "damaged temporary bytes" }), remote = server(); remote.identity = alice;
  const instance = controller(durable, tab, remote); await instance.load(); await instance.retrySync();
  assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, "Verified account private draft"); const accountBytes = durable.entries.get(accountKey);
  remote.identity = null; await instance.retrySync();
  assert.equal(instance.snapshot().scopeKey, "pending"); assert.equal(instance.snapshot().status, "error"); assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, undefined);
  assert.equal(durable.entries.get(accountKey), accountBytes); assert.equal(tab.entries.get(sessionKey), "damaged temporary bytes"); instance.dispose();
});

async function privateImportFixture() {
  const legacy = fresh(); legacy.favouriteIds = [ids[4]]; legacy.learningV3.favouriteChanges[ids[4]] = { selected: true, updatedAt: "2026-10-21T10:00:00.000Z" };
  legacy.learningV3.practiceDrafts.private = "Earlier private source text";
  const legacyBytes = JSON.stringify(legacy), durable = storage({ [deviceKey]: legacyBytes }), tab = storage(), remote = server(), instance = controller(durable, tab, remote);
  await instance.load(); assert.equal(draft(instance, ids[0], "Temporary source stays private"), true); await instance.retrySync();
  await signIn(instance, remote, alice);
  assert.equal(instance.commit((state) => ({ ...state, profile: { roleId: "finance-accounting", seniorityId: "experienced-contributor", situationIds: [], goalIds: [] }, learningV3: { ...state.learningV3, practiceDrafts: { ...state.learningV3.practiceDrafts, private: "Alice-only private account draft" } } })), true);
  await instance.retrySync();
  const accountKey = `lucid-learning-v3:${encodeURIComponent(alice)}`;
  return { instance, remote, durable, tab, accountKey, accountBytes: durable.entries.get(accountKey), legacyBytes, guestBytes: tab.entries.get(sessionKey), writeCount: remote.writes.length };
}
function assertInvalidatedAccount(fixture) {
  const { instance, durable, tab, accountKey, accountBytes, legacyBytes, guestBytes, remote, writeCount } = fixture;
  const snapshot = instance.snapshot();
  assert.equal(snapshot.scopeKey, "pending"); assert.equal(snapshot.ready, true); assert.equal(snapshot.status, "error");
  assert.equal(snapshot.state.profile, null); assert.deepEqual(snapshot.state.learningV3.practiceDrafts, {});
  assert.equal(instance.commit((state) => ({ ...state, favouriteIds: [ids[5]] }), alice), false);
  assert.equal(durable.entries.get(accountKey), accountBytes); assert.equal(durable.entries.get(deviceKey), legacyBytes); assert.equal(tab.entries.get(sessionKey), guestBytes); assert.equal(remote.writes.length, writeCount);
}

test("both imports blank a known changed or revoked destination at either verification boundary", async (t) => {
  for (const method of ["guest", "legacy"]) for (const stage of ["first", "final"]) for (const outcome of ["other-account", "revoked"]) {
    await t.test(`${method}: ${stage} destination check reports ${outcome}`, async () => {
      const fixture = await privateImportFixture(), { instance, remote, durable, tab, accountBytes, accountKey, guestBytes, legacyBytes } = fixture;
      const nextIdentity = outcome === "other-account" ? bob : null;
      if (stage === "first") remote.identity = nextIdentity;
      else remote.afterRead = () => { remote.identity = nextIdentity; remote.afterRead = null; };
      const imported = method === "guest" ? await instance.importGuestSession(alice) : await instance.importLegacyProgress(`device:${deviceId}`, alice);
      assert.equal(imported, false); assertInvalidatedAccount(fixture);
      // Only a fresh verified load can select Bob; it cannot use Alice's local private context.
      remote.identity = bob; await instance.refreshIdentity(); await instance.retrySync();
      assert.equal(instance.snapshot().scopeKey, bob); assert.deepEqual(instance.snapshot().state.learningV3.practiceDrafts, {}); assert.equal(instance.snapshot().state.profile, null);
      assert.equal(durable.entries.get(accountKey), accountBytes); assert.equal(tab.entries.get(sessionKey), guestBytes); assert.equal(durable.entries.get(deviceKey), legacyBytes);
      assert.doesNotMatch(durable.entries.get(`lucid-learning-v3:${encodeURIComponent(bob)}`), /Alice-only private account draft|Temporary source stays private/); instance.dispose();
    });
  }
});

test("revoked backup recovery blanks visible account state but a network failure retains the verified context", async (t) => {
  for (const status of [401, 503]) await t.test(`recovery response ${status}`, async () => {
    const fixture = await privateImportFixture(), { instance, remote, durable, tab, accountKey, accountBytes, guestBytes, legacyBytes } = fixture;
    remote.override = async () => Response.json({ error: "Controlled fixture response" }, { status });
    const backup = stateModule.exportPortableBackup(fresh());
    assert.equal(await instance.recoverFromBackup(backup, false, alice), false);
    if (status === 401) assertInvalidatedAccount(fixture);
    else {
      assert.equal(instance.snapshot().scopeKey, alice); assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, "Alice-only private account draft"); assert.equal(instance.snapshot().status, "error");
      assert.equal(durable.entries.get(accountKey), accountBytes); assert.equal(durable.entries.get(deviceKey), legacyBytes); assert.equal(tab.entries.get(sessionKey), guestBytes);
    }
    instance.dispose();
  });
});

test("a wrong or denied legacy source cannot invalidate a destination that is still verified", async (t) => {
  for (const source of ["other-source", "denied-source"]) await t.test(source, async () => {
    const fixture = await privateImportFixture(), { instance, remote, durable, tab, accountKey, accountBytes, guestBytes, legacyBytes } = fixture;
    remote.override = async (_url, options) => options.headers?.["x-lucid-state-source"] === "legacy"
      ? source === "other-source" ? Response.json({ identity: "user:other-legacy-source", state: null }) : Response.json({ error: "Legacy source unavailable" }, { status: 401 })
      : null;
    assert.equal(await instance.importLegacyProgress(`device:${deviceId}`, alice), false);
    assert.equal(instance.snapshot().scopeKey, alice); assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, "Alice-only private account draft"); assert.equal(instance.snapshot().status, "error");
    assert.equal(durable.entries.get(accountKey), accountBytes); assert.equal(durable.entries.get(deviceKey), legacyBytes); assert.equal(tab.entries.get(sessionKey), guestBytes); instance.dispose();
  });
});

test("a denied legacy source still invalidates the view if destination reverification observes Bob", async () => {
  const fixture = await privateImportFixture(), { instance, remote } = fixture;
  remote.override = async (_url, options) => {
    if (options.headers?.["x-lucid-state-source"] === "legacy") { remote.identity = bob; return Response.json({ error: "Legacy source unavailable" }, { status: 401 }); }
    return null;
  };
  assert.equal(await instance.importLegacyProgress(`device:${deviceId}`, alice), false); assertInvalidatedAccount(fixture); instance.dispose();
});
