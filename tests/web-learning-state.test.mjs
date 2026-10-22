import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const sourceURL = async (path) => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), "utf8"))).toString("base64")}`;
const professionalURL = await sourceURL("../lib/professional-content.ts");
const expressionURL = await sourceURL("../lib/expression-content.ts");
const accountURL = await sourceURL("../lib/web-account.ts");
const idiomURL = await sourceURL("../lib/daily-idioms.ts");
const dailyStateSource = stripTypeScriptTypes(await readFile(new URL("../lib/daily-vocabulary-state.ts", import.meta.url), "utf8"))
  .replace('from "./professional-content"', `from "${professionalURL}"`)
  .replace('from "./daily-idioms"', `from "${idiomURL}"`);
const dailyStateURL = `data:text/javascript;base64,${Buffer.from(dailyStateSource).toString("base64")}`;
const stateSource = stripTypeScriptTypes(await readFile(new URL("../lib/web-learning-state.ts", import.meta.url), "utf8"))
  .replace('from "./daily-vocabulary-state"', `from "${dailyStateURL}"`);
const stateURL = `data:text/javascript;base64,${Buffer.from(stateSource).toString("base64")}`;
const learning = await import(stateURL);
const sharedSource = stripTypeScriptTypes(await readFile(new URL("../lib/shared-learning-state.ts", import.meta.url), "utf8"))
  .replace('from "./professional-content"', `from "${professionalURL}"`)
  .replace('from "./expression-content"', `from "${expressionURL}"`)
  .replace('from "./web-learning-state"', `from "${stateURL}"`);
const sharedURL = `data:text/javascript;base64,${Buffer.from(sharedSource).toString("base64")}`;
const guestSource = stripTypeScriptTypes(await readFile(new URL("../lib/guest-learning.ts", import.meta.url), "utf8"))
  .replace('from "./expression-content"', `from "${expressionURL}"`);
const guestURL = `data:text/javascript;base64,${Buffer.from(guestSource).toString("base64")}`;
const syncSource = stripTypeScriptTypes(await readFile(new URL("../lib/web-learning-sync.ts", import.meta.url), "utf8"))
  .replace(/import \{ useCallback, useEffect, useRef, useState \} from "react";/, "const useCallback = (f) => f, useEffect = () => {}, useRef = () => {}, useState = () => {};")
  .replace('from "./web-learning-state"', `from "${stateURL}"`)
  .replace('from "./shared-learning-state"', `from "${sharedURL}"`)
  .replace('from "./daily-vocabulary-state"', `from "${dailyStateURL}"`)
  .replace('from "./guest-learning"', `from "${guestURL}"`);
const { createWebLearningSync } = await import(`data:text/javascript;base64,${Buffer.from(syncSource).toString("base64")}`);
const defaults = { version: 2, profile: null, settings: { lessonTime: "09:00", timeZone: "Etc/UTC", dailyWordCount: 3 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [] };
const fresh = () => learning.prepareWebState(defaults, defaults);
const event = (date, quality = 2, extra = {}) => learning.makeReviewEvidence({ wordId: "shared-word", roleId: "finance", date, kind: "unaided-recall", quality, independent: true, response: "We need to clarify the owner before proceeding.", ...extra });
function storage(seed = {}) { const entries = new Map(Object.entries(seed)); return { entries, fail: false, getItem(key) { return entries.get(key) ?? null; }, setItem(key, value) { if (this.fail) throw new Error("disk full"); entries.set(key, value); } }; }
function server(identity = "device:device-123456") {
  return { identity, state: null, offline: false, writes: [], async fetch(_url, options) {
    if (this.offline) throw new Error("offline");
    if (options.method === "PUT") { const body = JSON.parse(options.body); if (body.scopeKey !== this.identity) return Response.json({ identity: this.identity }, { status: 409 }); this.writes.push(body); this.state = this.state ? learning.toCloudWebState(learning.mergeWebStates(this.state, body.state, defaults)) : body.state; }
    return Response.json({ identity: this.identity, state: this.state });
  } };
}
function controller(store, remote) { return createWebLearningSync({ storage: store, fetch: remote.fetch.bind(remote), defaults, deviceId: "device-123456" }); }

test("legacy migration retains IDs, schedules and opaque local history without context mastery", () => {
  const state = fresh(); state.version = 2; delete state.learningV3;
  state.introducedWordIds = ["retired-but-valid-id"]; state.legacyHistory = { note: "local archived material" };
  const migrated = learning.prepareWebState(state, defaults);
  assert.equal(migrated.version, 3); assert.deepEqual(migrated.introducedWordIds, state.introducedWordIds); assert.deepEqual(migrated.legacyHistory, state.legacyHistory);
  assert.deepEqual(migrated.learningV3.contextMastery, {});
});

test("validators reject nested invalid/future/oversize/prototype/nonfinite records", () => {
  assert.equal(learning.validateWebState({ ...defaults, version: 4 }), false);
  assert.equal(learning.validateWebState({ ...defaults, extra: Infinity }), false);
  assert.equal(learning.validateWebState(JSON.parse('{"version":3,"__proto__":{"polluted":true}}')), false);
  assert.equal(learning.validateWebState({ ...defaults, extra: "a".repeat(learning.MAX_STATE_BYTES) }), false);
  const malformed = fresh(); malformed.masteryByWordId.word = { introducedOn: "2026-02-30", nextReviewOn: "2026-10-14", intervalIndex: 0, reviewCount: 0, lapses: 0, productiveSuccessDates: [] };
  assert.equal(learning.validateWebState(malformed), false);
  assert.equal(event("2026-13-01"), null);
});

test("fresh recall/production evidence needs response and attestations, never stores text", () => {
  assert.equal(event("2026-10-13", 2, { response: "word" }), null);
  assert.equal(event("2026-10-13", 2, { kind: "self-assessed-production" }), null);
  const supported = event("2026-10-13", 2, { assisted: true }); assert.equal(supported.independent, false);
  const production = event("2026-10-13", 2, { kind: "self-assessed-production", meaningAttested: true, naturalnessAttested: true });
  assert.ok(production); assert.equal(production.senseId, "shared-word::finance"); assert.equal("response" in production, false);
});

test("recognition schedules tomorrow with no review count and cannot imply retained recall", () => {
  const state = fresh(); state.learningV3.contextIntroducedOn["shared-word::finance"] = "2026-10-01";
  state.learningV3.reviewEvidence = [event("2026-10-01", 3, { kind: "recognition" })];
  const mastery = learning.prepareWebState(state).learningV3.contextMastery["shared-word::finance"];
  assert.equal(mastery.nextReviewOn, "2026-10-02"); assert.equal(mastery.reviewCount, 0); assert.equal(mastery.mastered, false);
});

test("retained recall needs distinct independent days plus 30-day evidence, isolated by role", () => {
  const state = fresh(); state.learningV3.contextIntroducedOn["shared-word::finance"] = "2026-09-01";
  const first = event("2026-09-02"), second = event("2026-09-08"), third = event("2026-10-02");
  state.learningV3.reviewEvidence = [first, first, second, third, event("2026-10-02", 3, { roleId: "leadership" })];
  const merged = learning.prepareWebState(state); const mastery = merged.learningV3.contextMastery["shared-word::finance"];
  assert.equal(merged.learningV3.reviewEvidence.length, 4); assert.equal(mastery.reviewCount, 3); assert.equal(mastery.mastered, true);
  assert.equal(merged.learningV3.contextMastery["shared-word::leadership"].mastered, false);
  const productionOnly = structuredClone(state); productionOnly.learningV3.reviewEvidence = state.learningV3.reviewEvidence.filter((item) => item.roleId === "finance").map((item) => ({ ...item, kind: "self-assessed-production" }));
  assert.equal(learning.prepareWebState(productionOnly).learningV3.contextMastery["shared-word::finance"].mastered, false);
});

test("same-day conflicts and helped good answers cannot advance independent credit", () => {
  const a = fresh(), b = fresh(); a.learningV3.contextIntroducedOn["shared-word::finance"] = "2026-10-01";
  a.learningV3.reviewEvidence = [event("2026-10-02", 3)]; b.learningV3.reviewEvidence = [event("2026-10-02", 0)];
  const merged = learning.mergeWebStates(a, b, defaults); const mastery = merged.learningV3.contextMastery["shared-word::finance"];
  assert.equal(mastery.reviewCount, 1); assert.equal(mastery.lastQuality, 0); assert.deepEqual(mastery.productiveSuccessDates, []);
  a.learningV3.reviewEvidence = [event("2026-10-02", 3, { assisted: true })];
  const supported = learning.prepareWebState(a).learningV3.contextMastery["shared-word::finance"];
  assert.equal(supported.intervalIndex, 0); assert.equal(supported.lastQuality, 1);
});

test("timestamped bookmark removal survives merge and cloud payload excludes private state", () => {
  const a = fresh(), b = fresh(); a.favouriteIds = ["word"]; a.learningV3.favouriteChanges.word = { selected: true, updatedAt: "2026-10-01T00:00:00Z" };
  b.learningV3.favouriteChanges.word = { selected: false, updatedAt: "2026-10-02T00:00:00Z" };
  a.learningV3.practiceDrafts.word = "private learner response"; a.learningV3.expressionDraft = "private expression notebook"; a.learningV3.exposedOn["word::finance"] = "2026-10-13"; a.usageAttempts = { word: { sentence: "private past response" } }; a.unknownPrivateField = "private";
  const merged = learning.mergeWebStates(a, b, defaults); assert.deepEqual(merged.favouriteIds, []); assert.equal(merged.learningV3.practiceDrafts.word, "private learner response");
  const cloud = JSON.stringify(learning.toCloudWebState(merged)); assert.equal(cloud.includes("private"), false); assert.equal(cloud.includes("word::finance"), false);
});

test("native-compatible backup has Foundation dates, UUID sessions and lossless web sidecar", () => {
  const state = fresh(); state.dailySessions = [{ id: "2026-10-13:finance", date: "2026-10-13", roleId: "finance", situationId: "meeting", wordIds: ["shared-word"], completedAt: "2026-10-13T08:00:00Z" }];
  state.learningV3.contextIntroducedOn["shared-word::finance"] = "2026-09-01"; state.learningV3.reviewEvidence = [event("2026-10-13")]; state.learningV3.exposedOn["shared-word::finance"] = "2026-10-13";
  const backup = learning.exportPortableBackup(state);
  assert.match(backup.learner.sessions[0].id, /^[0-9a-f-]{36}$/); assert.equal(typeof backup.learner.contextEvidence[0].recordedAt, "number"); assert.equal(typeof backup.learner.contextIntroducedOn["shared-word::finance"], "number");
  assert.equal(learning.foundationDateToISO(0), "2001-01-01T00:00:00.000Z");
  assert.equal(learning.isoToFoundationDate("2001-01-01T00:00:00.000Z"), 0);
  const imported = learning.importPortableBackup(backup, fresh(), defaults); assert.equal(imported.dailySessions.length, 1); assert.equal(imported.dailySessions[0].id, state.dailySessions[0].id); assert.deepEqual(imported.learningV3.contextIntroducedOn, state.learningV3.contextIntroducedOn);
  const nativeOnly = structuredClone(backup); delete nativeOnly.webLearningBackup; nativeOnly.learner.nativeSpecific = { preserve: "native opaque settings" };
  const bridged = learning.importPortableBackup(nativeOnly, fresh(), defaults); assert.equal(bridged.learningV3.reviewEvidence[0].recordedAtISO, state.learningV3.reviewEvidence[0].recordedAtISO); assert.equal(learning.exportPortableBackup(bridged).learner.nativeSpecific.preserve, "native opaque settings");
});

test("online account identity never imports unscoped guest cache", async () => {
  const guest = fresh(); guest.introducedWordIds = ["guest-word"];
  const store = storage({ "lucid-offline-state": JSON.stringify(guest) }); const remote = server("user:alice"); const sync = controller(store, remote);
  await sync.load(); await sync.retrySync(); assert.equal(sync.snapshot().scopeKey, "user:alice"); assert.deepEqual(sync.snapshot().state.introducedWordIds, []); assert.ok(store.entries.has("lucid-learning-v3:user%3Aalice")); sync.dispose();
});

test("offline changes merge remote events on reconnect rather than overwrite", async () => {
  const store = storage(), remote = server(), sync = controller(store, remote); await sync.load(); await sync.retrySync();
  remote.offline = true;
  assert.equal(sync.commit((state) => ({ ...state, introducedWordIds: ["local-word"] })), true); await sync.retrySync();
  remote.state = fresh(); remote.state.introducedWordIds = ["remote-word"]; remote.offline = false; await sync.retrySync();
  assert.deepEqual(sync.snapshot().state.introducedWordIds, ["local-word", "remote-word"]); assert.deepEqual(remote.state.introducedWordIds, ["local-word", "remote-word"]); sync.dispose();
});

test("local write failure blocks advance but updater draft survives explicit retry", async () => {
  const store = storage(), remote = server(), sync = controller(store, remote); await sync.load(); await sync.retrySync(); store.fail = true;
  assert.equal(sync.commit((state) => ({ ...state, learningV3: { ...state.learningV3, practiceDrafts: { word: "recover this typed sentence" } } })), false);
  assert.deepEqual(sync.snapshot().state.learningV3.practiceDrafts, {}); assert.equal(sync.snapshot().status, "error"); await sync.retrySync(); assert.equal(sync.snapshot().status, "error");
  store.fail = false; await sync.retrySync(); assert.equal(sync.snapshot().state.learningV3.practiceDrafts.word, "recover this typed sentence"); assert.equal(JSON.stringify(remote.state).includes("recover this typed sentence"), false); sync.dispose();
});

test("account switch rejects stale scope action and late disposed response", async () => {
  const store = storage(), remote = server("user:alice"), sync = controller(store, remote); await sync.load(); await sync.retrySync(); const oldScope = sync.snapshot().scopeKey;
  remote.identity = "user:bob"; remote.state = fresh(); await sync.retrySync(); assert.equal(sync.snapshot().scopeKey, "user:bob"); assert.equal(sync.commit((state) => ({ ...state, introducedWordIds: ["alice-word"] }), oldScope), false);
  sync.dispose(); assert.equal(sync.commit(fresh()), false);
});

const routeSource = stripTypeScriptTypes(await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"))
  .replace('import { env } from "cloudflare:workers";', 'const env = {};')
  .replace('from "@/lib/web-account"', `from "${accountURL}"`)
  .replace('from "@/lib/shared-learning-state"', `from "${sharedURL}"`)
  .replace('import { eq } from "drizzle-orm";', 'const eq=(field,value)=>({field,value});')
  .replace('import { getDb, initializeDatabase } from "@/db";', 'const getDb=()=>globalThis.__lucidTestDb,initializeDatabase=async()=>{};')
  .replace('import { learnerState } from "@/db/schema";', 'const learnerState={userKey:"userKey",updatedAt:"updatedAt"};')
  .replace('from "@/lib/web-learning-state"', `from "${stateURL}"`);
const route = await import(`data:text/javascript;base64,${Buffer.from(routeSource).toString("base64")}`);
function dbFixture() {
  const rows = new Map();
  const copy = (row) => row ? { ...row, state: structuredClone(row.state), updatedAt: new Date(row.updatedAt) } : undefined;
  return { rows, query: { learnerState: { async findFirst({ where }) { const snapshot = copy(rows.get(where.value)); await Promise.resolve(); return snapshot; } } },
    insert() { return { values(value) { return { onConflictDoNothing() { return { async returning() { if (rows.has(value.userKey)) return []; rows.set(value.userKey, value); return [{ userKey: value.userKey }]; } }; } }; } }; },
    update() { return { set(value) { return { where({ conditions }) { return { async returning() { const key = conditions.find((item) => item.field === "userKey").value; const time = conditions.find((item) => item.field === "updatedAt").value; const row = rows.get(key); if (!row || row.updatedAt.getTime() !== time.getTime()) return []; rows.set(key, { ...row, ...value }); return [{ userKey: key }]; } }; } }; } }; },
  };
}
const request = (state, scopeKey = "device:device-123456") => new Request("http://localhost/api/state", { method: "PUT", headers: { origin: "http://localhost", "x-lucid-device-id": "device-123456", "content-type": "application/json" }, body: JSON.stringify({ scopeKey, state }) });

test("server refuses concurrent guest durable saves while retaining existing legacy records", async () => {
  globalThis.__lucidTestDb = dbFixture(); const a = fresh(), b = fresh(); a.introducedWordIds = ["word-a"]; b.introducedWordIds = ["word-b"];
  a.learningV3.reviewEvidence = [event("2026-10-02")]; b.learningV3.reviewEvidence = [event("2026-10-03")];
  const results = await Promise.all([route.PUT(request(a)), route.PUT(request(b))]); assert.deepEqual(results.map((item) => item.status), [401, 401]);
  assert.equal(globalThis.__lucidTestDb.rows.size, 0);
  const original = { userKey: "device:device-123456", state: a, updatedAt: new Date() };
  globalThis.__lucidTestDb.rows.set(original.userKey, original);
  const before = JSON.stringify(original);
  assert.equal((await route.PUT(request(b))).status, 401);
  assert.equal(JSON.stringify(globalThis.__lucidTestDb.rows.get(original.userKey)), before);
  const oldRead = await route.GET(new Request("http://localhost/api/state", { headers: { "x-lucid-device-id": "device-123456", "x-lucid-state-source": "legacy" } }));
  assert.equal(oldRead.status, 200); assert.deepEqual((await oldRead.json()).state.introducedWordIds, ["word-a"]);
});

test("server cannot write through a claimed legacy identity and preserves an unreadable saved record", async () => {
  globalThis.__lucidTestDb = dbFixture(); const mismatch = await route.PUT(request(fresh(), "user:previous-account")); assert.equal(mismatch.status, 401); assert.equal(globalThis.__lucidTestDb.rows.size, 0);
  globalThis.__lucidTestDb.rows.set("device:device-123456", { userKey: "device:device-123456", state: { version: 99 }, updatedAt: new Date() });
  assert.equal((await route.PUT(request(fresh()))).status, 401); assert.equal(globalThis.__lucidTestDb.rows.get("device:device-123456").state.version, 99);
  const response = await route.GET(new Request("http://localhost/api/state", { headers: { "x-lucid-device-id": "device-123456" } })); assert.equal(response.headers.get("cache-control"), "no-store, private"); assert.equal(response.status, 422);
});

test("failed empty recall and helped recall reschedule without claiming success", () => {
  const failed = event("2026-10-13", 0, { response: "" }); assert.ok(failed); assert.equal(failed.independent, false); assert.equal(failed.quality, 0);
  const helped = event("2026-10-13", 3, { response: "", assisted: true }); assert.ok(helped); assert.equal(helped.independent, false); assert.equal(helped.quality, 1);
  assert.equal(event("2026-10-13", 2, { response: "" }), null);
});

test("cloud nested allowlists retain learning metadata while excluding unknown learner text", () => {
  const state = fresh(); state.profile = { roleId: "finance", seniorityId: "manager", situationIds: [], goalIds: [], personalNote: "PRIVATE-profile" };
  state.settings.personalNote = "PRIVATE-settings";
  state.dailySessions = [{ id: "uuid-session", date: "2026-10-13", wordIds: ["shared-word"], completedAt: "2026-10-13T09:00:00Z", personalNote: "PRIVATE-session" }];
  state.masteryByWordId.word = { wordId: "word", introducedOn: "2026-10-01", nextReviewOn: "2026-10-02", intervalIndex: 0, reviewCount: 0, lapses: 0, productiveSuccessDates: [], personalNote: "PRIVATE-mastery" };
  state.learningV3.reviewEvidence = [{ ...event("2026-10-13"), personalNote: "PRIVATE-evidence" }];
  const cloud = learning.toCloudWebState(learning.prepareWebState(state)); assert.equal(JSON.stringify(cloud).includes("PRIVATE"), false); assert.equal(state.profile.personalNote, "PRIVATE-profile"); assert.equal(cloud.dailySessions.length, 1); assert.equal(cloud.learningV3.reviewEvidence.length, 1);
});

test("corrupt cache recovery archives exact original bytes before restoring verified scoped backup", async () => {
  const original = '{"version":3,broken'; const key = "lucid-learning-v3:user%3Aalice"; const store = storage({ [key]: original }); const remote = server("user:alice"), sync = controller(store, remote);
  await sync.load(); assert.equal(sync.snapshot().scopeKey, "user:alice"); assert.equal(sync.snapshot().status, "error"); assert.equal(sync.commit(fresh()), false);
  const backupState = fresh(); backupState.introducedWordIds = ["restored-word"]; const backup = learning.exportPortableBackup(backupState);
  assert.equal(await sync.recoverFromBackup(backup, false, "user:alice"), true); await sync.retrySync();
  assert.equal([...store.entries].find(([name]) => name.startsWith(key + ":recovery:"))[1], original); assert.deepEqual(sync.snapshot().state.introducedWordIds, ["restored-word"]); assert.equal(sync.snapshot().scopeKey, "user:alice"); sync.dispose();
});

test("failed archive and unconfirmed identity cannot replace corrupt local bytes", async () => {
  const original = 'BROKEN-private-record'; const key = "lucid-learning-v3:user%3Aalice"; const store = storage({ [key]: original }); const originalSet = store.setItem.bind(store);
  store.setItem = (name, value) => { if (name.includes(":recovery:")) throw new Error("Archive unavailable"); originalSet(name, value); };
  const remote = server("user:alice"), sync = controller(store, remote); await sync.load();
  assert.equal(await sync.recoverFromBackup(learning.exportPortableBackup(fresh()), false, "user:alice"), false); assert.equal(store.entries.get(key), original);
  remote.offline = true; assert.equal(await sync.recoverFromBackup(learning.exportPortableBackup(fresh()), false, "user:alice"), false); assert.equal(store.entries.get(key), original); assert.equal(remote.writes.length, 0); sync.dispose();
});

test("recovery rejects an account changed after the Restore action was selected", async () => {
  const store = storage(), remote = server("user:alice"), sync = controller(store, remote); await sync.load(); await sync.retrySync();
  const before = store.entries.get("lucid-learning-v3:user%3Aalice"), backupState = fresh(); backupState.introducedWordIds = ["should-not-transfer"];
  remote.identity = "user:bob"; remote.state = fresh(); const writes = remote.writes.length;
  assert.equal(await sync.recoverFromBackup(learning.exportPortableBackup(backupState), false, "user:alice"), false); assert.equal(sync.snapshot().scopeKey, "user:bob"); assert.equal(remote.writes.length, writes); assert.equal(store.entries.get("lucid-learning-v3:user%3Aalice"), before); assert.deepEqual(sync.snapshot().state.introducedWordIds, []); sync.dispose();
});

test("future-version scoped records require an update and cannot be repaired by an older backup", async () => {
  const key = "lucid-learning-v3:user%3Aalice"; const original = JSON.stringify({ ...fresh(), version: 4 }); const store = storage({ [key]: original }); const remote = server("user:alice"), sync = controller(store, remote);
  await sync.load(); assert.equal(sync.snapshot().status, "error");
  assert.equal(await sync.recoverFromBackup(learning.exportPortableBackup(fresh()), false, "user:alice"), false);
  assert.equal(store.entries.get(key), original); assert.equal([...store.entries.keys()].some((name) => name.startsWith(key + ":recovery:")), false); assert.match(sync.snapshot().error, /newer version.*Update Lucid/); assert.equal(remote.writes.length, 0); sync.dispose();
});

test("future daily-sidecar versions preserve exact scoped bytes and reject backup recovery before archival or upload", async () => {
  for (const dailyVocabulary of [{ version: 2 }, { version: 99, collections: "unsupported future shape", idiomsByDay: null }]) {
    const key = "lucid-learning-v3:user%3Aalice", state = fresh();
    state.learningV3.dailyVocabulary = dailyVocabulary;
    const original = JSON.stringify(state), store = storage({ [key]: original });
    const remote = server("user:alice"), sync = controller(store, remote);
    await sync.load(); assert.equal(sync.snapshot().status, "error");
    assert.equal(await sync.recoverFromBackup(learning.exportPortableBackup(fresh()), false, "user:alice"), false);
    assert.match(sync.snapshot().error, /newer version.*Update Lucid/);
    await sync.retrySync();
    assert.equal(store.entries.get(key), original);
    assert.equal([...store.entries.keys()].some((name) => name.startsWith(key + ":recovery:")), false);
    assert.equal(remote.writes.length, 0);
    sync.dispose();
  }
});

test("frozen original review attempts survive local backup but remain private and type checked", () => {
  const state = fresh(); const key = "2026-10-13:shared-word::finance";
  state.learningV3.reviewDrafts[key] = { sentence: "The revised sentence after comparison.", hinted: false, revealed: true, originalResponse: "We need to clarify the owner before proceeding.", originalIndependent: true, originalCapturedOn: "2026-10-13" };
  const prepared = learning.prepareWebState(state); assert.deepEqual(prepared.learningV3.reviewDrafts[key], state.learningV3.reviewDrafts[key]);
  const restored = learning.importPortableBackup(learning.exportPortableBackup(prepared), fresh(), defaults); assert.deepEqual(restored.learningV3.reviewDrafts[key], state.learningV3.reviewDrafts[key]);
  const cloud = learning.toCloudWebState(prepared); assert.deepEqual(cloud.learningV3.reviewDrafts, {}); assert.equal(JSON.stringify(cloud).includes("clarify the owner"), false);
  const invalid = structuredClone(state); invalid.learningV3.reviewDrafts[key].originalIndependent = "true"; assert.equal(learning.validateWebState(invalid), false);
  invalid.learningV3.reviewDrafts[key].originalIndependent = true; invalid.learningV3.reviewDrafts[key].originalCapturedOn = "2026-13-01"; assert.equal(learning.validateWebState(invalid), false);
  const legacy = fresh(); legacy.learningV3.reviewDrafts[key] = { sentence: "An earlier saved sentence.", hinted: false, revealed: true }; assert.equal(learning.prepareWebState(legacy).learningV3.reviewDrafts[key].originalIndependent, undefined);
});

const sharedContract = await import(sharedURL);
const accountA = "supabase:11111111-1111-4111-8111-111111111111";
const accountB = "supabase:22222222-2222-4222-8222-222222222222";
const scopedCache = (scope) => "lucid-learning-v3:" + encodeURIComponent(scope);
function sharedServer() {
  const records = new Map([accountA, accountB].map((identity) => [identity, { state: sharedContract.webToSharedCloudState(fresh()), revision: 1 }]));
  return {
    identity: accountA, records, writes: [], legacyReads: 0, legacyIdentity: "device:device-123456", legacyState: null, beforeRead: null,
    async fetch(_url, options) {
      const legacy = new Headers(options.headers).get("x-lucid-state-source") === "legacy";
      if (options.method !== "PUT") {
        if (legacy) this.legacyReads++;
        if (this.beforeRead) await this.beforeRead(legacy);
        if (legacy) return Response.json({ identity: this.legacyIdentity, state: this.legacyState });
      }
      if (options.method === "PUT") {
        const body = JSON.parse(options.body);
        if (body.scopeKey !== this.identity) return Response.json({ identity: this.identity }, { status: 409 });
        assert.equal(sharedContract.validateSharedCloudState(body.sharedState), true);
        this.writes.push(structuredClone(body));
        this.records.set(this.identity, { state: body.sharedState, revision: this.records.get(this.identity).revision + 1 });
      }
      const value = this.records.get(this.identity);
      return Response.json({ identity: this.identity, sharedState: value.state, revision: value.revision });
    },
  };
}

function addPrivateDraft(state, key, value) { return { ...state, learningV3: { ...state.learningV3, practiceDrafts: { ...state.learningV3.practiceDrafts, [key]: value } } }; }

test("account boundary refuses an undurable failed save, remains retryable, then switches without replaying Alice into Bob", async () => {
  const store = storage(), remote = sharedServer(), sync = controller(store, remote);
  await sync.load(); await sync.retrySync();
  store.fail = true;
  assert.equal(sync.commit((state) => addPrivateDraft({ ...state, favouriteIds: ["finance-rationale"] }, "word-a", "PRIVATE Alice draft"), accountA), false);
  await assert.rejects(sync.suspendForAccountChange(), /pending learning changes before changing account/);
  assert.equal(sync.snapshot().ready, true); assert.equal(sync.snapshot().scopeKey, accountA);
  assert.equal(sync.snapshot().status, "error");
  store.fail = false; await sync.retrySync();
  const protectedBytes = store.entries.get(scopedCache(accountA));
  assert.equal(JSON.parse(protectedBytes).learningV3.practiceDrafts["word-a"], "PRIVATE Alice draft");
  await sync.suspendForAccountChange(); remote.identity = accountB;
  await sync.refreshIdentity(); await sync.retrySync();
  assert.equal(sync.snapshot().scopeKey, accountB);
  assert.equal(sync.snapshot().state.favouriteIds.includes("finance-rationale"), false);
  assert.equal(JSON.stringify(sync.snapshot().state).includes("PRIVATE Alice"), false);
  assert.equal(store.entries.get(scopedCache(accountA)), protectedBytes);
  assert.equal(remote.records.get(accountB).state.favouriteWordIds.includes("finance-rationale"), false);
  assert.equal(JSON.stringify(remote.records.get(accountB).state).includes("PRIVATE Alice"), false);
  sync.dispose();
});

test("direct identity refresh and externally changed sessions preserve failed work only under its original account", async () => {
  const store = storage(), remote = sharedServer(), sync = controller(store, remote);
  await sync.load(); await sync.retrySync(); store.fail = true;
  assert.equal(sync.commit((state) => ({ ...state, favouriteIds: ["finance-rationale"] }), accountA), false);
  remote.identity = accountB;
  await sync.refreshIdentity();
  assert.equal(sync.snapshot().scopeKey, accountA);
  assert.equal(store.entries.has(scopedCache(accountB)), false);
  store.fail = false; await sync.retrySync();
  assert.equal(sync.snapshot().scopeKey, accountB);
  assert.equal(JSON.parse(store.entries.get(scopedCache(accountA))).favouriteIds.includes("finance-rationale"), true);
  assert.equal(sync.snapshot().state.favouriteIds.includes("finance-rationale"), false);
  assert.equal(remote.records.get(accountB).state.favouriteWordIds.includes("finance-rationale"), false);
  remote.identity = accountA; await sync.refreshIdentity(); await sync.retrySync();
  assert.equal(remote.records.get(accountA).state.favouriteWordIds.includes("finance-rationale"), true);
  sync.dispose();
});

test("consecutive failed updater edits and a later successful edit preserve all same-account private work", async () => {
  const store = storage(), remote = server("user:alice"), sync = controller(store, remote);
  await sync.load(); await sync.retrySync(); store.fail = true;
  assert.equal(sync.commit((state) => addPrivateDraft(state, "one", "PRIVATE first draft")), false);
  assert.equal(sync.commit((state) => addPrivateDraft(state, "two", "PRIVATE second draft")), false);
  assert.deepEqual(sync.snapshot().state.learningV3.practiceDrafts, {});
  store.fail = false;
  assert.equal(sync.commit((state) => ({ ...state, settings: { ...state.settings, textSize: "large" } })), true);
  await sync.retrySync();
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.one, "PRIVATE first draft");
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.two, "PRIVATE second draft");
  assert.equal(sync.snapshot().state.settings.textSize, "large");
  assert.equal(JSON.stringify(remote.state).includes("PRIVATE"), false);
  sync.dispose();
});

test("a direct replacement cannot silently drop either pending or new private writing", async () => {
  const store = storage(), remote = server("user:alice"), sync = controller(store, remote);
  await sync.load(); await sync.retrySync(); store.fail = true;
  assert.equal(sync.commit((state) => addPrivateDraft(state, "one", "PRIVATE pending draft")), false);
  store.fail = false;
  const replacement = addPrivateDraft(sync.snapshot().state, "two", "PRIVATE replacement draft");
  assert.equal(sync.commit(replacement), false);
  assert.match(sync.snapshot().error, /Retry saving.*before replacing/);
  await sync.retrySync();
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.one, "PRIVATE pending draft");
  assert.equal(sync.commit((state) => addPrivateDraft(state, "two", "PRIVATE replacement draft")), true);
  await sync.retrySync();
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.two, "PRIVATE replacement draft");
  sync.dispose();
});

test("same-account backup recovery first preserves a pending draft and never archives or replaces while blocked", async () => {
  const store = storage(), remote = server("user:alice"), sync = controller(store, remote);
  await sync.load(); await sync.retrySync(); const original = store.entries.get(scopedCache("user:alice"));
  store.fail = true;
  assert.equal(sync.commit((state) => addPrivateDraft(state, "local", "PRIVATE unsaved before restore")), false);
  const backupState = fresh(); backupState.favouriteIds = ["finance-rationale"];
  const backup = learning.exportPortableBackup(backupState);
  assert.equal(await sync.recoverFromBackup(backup, false, "user:alice"), false);
  assert.equal(store.entries.get(scopedCache("user:alice")), original);
  assert.equal([...store.entries.keys()].some((key) => key.includes(":recovery:")), false);
  store.fail = false;
  assert.equal(await sync.recoverFromBackup(backup, false, "user:alice"), true);
  await sync.retrySync();
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.local, "PRIVATE unsaved before restore");
  assert.equal(sync.snapshot().state.favouriteIds.includes("finance-rationale"), true);
  const archive = [...store.entries].find(([key]) => key.startsWith(scopedCache("user:alice") + ":recovery:"));
  assert.equal(JSON.parse(archive[1]).learningV3.practiceDrafts.local, "PRIVATE unsaved before restore");
  assert.equal(JSON.stringify(remote.state).includes("PRIVATE"), false);
  sync.dispose();
});

test("explicit guest import preserves destination pending drafts and exact source bytes without importing private source writing", async () => {
  const guest = addPrivateDraft(fresh(), "guest", "PRIVATE guest-only writing"); guest.favouriteIds = ["finance-reconcile"];
  const originalGuest = JSON.stringify(guest), store = storage({ [scopedCache("device:device-123456")]: originalGuest });
  const remote = sharedServer(); remote.legacyState = learning.toCloudWebState(guest);
  const sync = controller(store, remote); await sync.load(); await sync.retrySync();
  store.fail = true;
  assert.equal(sync.commit((state) => addPrivateDraft(state, "destination", "PRIVATE account-only draft"), accountA), false);
  const beforeWrites = remote.writes.length;
  assert.equal(await sync.importLegacyProgress("device:device-123456", accountA), false);
  assert.equal(remote.legacyReads, 0); assert.equal(remote.writes.length, beforeWrites);
  assert.equal(store.entries.get(scopedCache("device:device-123456")), originalGuest);
  store.fail = false;
  assert.equal(await sync.importLegacyProgress("device:device-123456", accountA), true);
  await sync.retrySync();
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.destination, "PRIVATE account-only draft");
  assert.equal(sync.snapshot().state.learningV3.practiceDrafts.guest, undefined);
  assert.equal(sync.snapshot().state.favouriteIds.includes("finance-reconcile"), true);
  assert.equal(store.entries.get(scopedCache("device:device-123456")), originalGuest);
  assert.equal(JSON.stringify(remote.records.get(accountA).state).includes("PRIVATE"), false);
  assert.equal(remote.records.get(accountB).state.favouriteWordIds.includes("finance-reconcile"), false);
  sync.dispose();
});

test("explicit import interrupted by source or destination changes preserves pending destination work and the source", async () => {
  for (const changed of ["source", "destination"]) {
    const guest = fresh(); guest.favouriteIds = ["finance-reconcile"];
    const originalGuest = JSON.stringify(guest), store = storage({ [scopedCache("device:device-123456")]: originalGuest });
    const remote = sharedServer(); remote.legacyState = learning.toCloudWebState(guest);
    const sync = controller(store, remote); await sync.load(); await sync.retrySync();
    store.fail = true; sync.commit((state) => addPrivateDraft(state, "destination", "PRIVATE preserved account draft"), accountA); store.fail = false;
    let reads = 0;
    remote.beforeRead = async (legacy) => { reads++; if (changed === "source" && legacy) remote.legacyIdentity = "user:changed-source"; if (changed === "destination" && reads === 3) remote.identity = accountB; };
    const beforeWrites = remote.writes.length;
    assert.equal(await sync.importLegacyProgress("device:device-123456", accountA), false);
    assert.equal(remote.writes.length, beforeWrites);
    assert.equal(store.entries.get(scopedCache("device:device-123456")), originalGuest);
    assert.equal(JSON.parse(store.entries.get(scopedCache(accountA))).learningV3.practiceDrafts.destination, "PRIVATE preserved account draft");
    assert.equal(remote.records.get(accountB).state.favouriteWordIds.includes("finance-reconcile"), false);
    sync.dispose();
  }
});

test("a failed local write made while a remote identity response waits cannot be discarded or replayed by that response", async () => {
  const store = storage(), remote = sharedServer(), sync = controller(store, remote);
  await sync.load(); await sync.retrySync();
  let release, entered;
  const held = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { entered = resolve; });
  remote.beforeRead = async () => { entered(); await held; };
  const oldSync = sync.retrySync(); await started;
  store.fail = true;
  assert.equal(sync.commit((state) => ({ ...state, favouriteIds: ["finance-rationale"] }), accountA), false);
  remote.identity = accountB; release(); await oldSync;
  assert.equal(sync.snapshot().scopeKey, accountA); assert.equal(sync.snapshot().status, "error");
  assert.equal(store.entries.has(scopedCache(accountB)), false);
  remote.beforeRead = null; store.fail = false; await sync.retrySync();
  assert.equal(sync.snapshot().scopeKey, accountB);
  assert.equal(JSON.parse(store.entries.get(scopedCache(accountA))).favouriteIds.includes("finance-rationale"), true);
  assert.equal(remote.records.get(accountB).state.favouriteWordIds.includes("finance-rationale"), false);
  sync.dispose();
});
