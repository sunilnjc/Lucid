import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = await readFile(new URL("../lib/web-account-request.ts", import.meta.url), "utf8");
const accountURL = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const account = await import(accountURL);
const alice = { enabled: true, emailReady: true, identity: "supabase:11111111-1111-4111-8111-111111111111", email: "alice@example.test" };
const bob = { ...alice, identity: "supabase:22222222-2222-4222-8222-222222222222", email: "bob@example.test" };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a status response settles before sign-out; its stale UI cannot restore the signed-out account", async () => {
  const sequence = account.createAccountRequestSequence(), status = deferred(), events = [];
  let cookie = "alice-old", displayed = alice;
  const reading = sequence.read(async () => { events.push("status"); await status.promise; cookie = "alice-refreshed"; return alice; });
  await tick();
  const signingOut = sequence.mutate(async () => { events.push("signout"); cookie = null; displayed = null; });
  assert.equal(sequence.busy, true);
  assert.deepEqual(events, ["status"], "cookie-changing sign-out waits for the prior HTTP response");
  status.resolve();
  const result = await reading;
  if (result.current && "value" in result) displayed = result.value;
  await signingOut;
  assert.equal(result.current, false); assert.equal(displayed, null); assert.equal(cookie, null);
  assert.deepEqual(events, ["status", "signout"]);
});

test("account switch waits for stale status cookies, then keeps only the newly verified account", async () => {
  const sequence = account.createAccountRequestSequence(), oldStatus = deferred();
  let cookie = "alice", visible = alice;
  const status = sequence.read(async () => { await oldStatus.promise; cookie = "alice-refreshed"; return alice; });
  await tick();
  const switching = sequence.mutate(async () => { cookie = "bob"; visible = bob; return bob; });
  oldStatus.resolve();
  const outdated = await status;
  if (outdated.current && "value" in outdated) visible = outdated.value;
  const result = await switching;
  assert.equal(result.accepted, true); assert.equal(cookie, "bob"); assert.deepEqual(visible, bob);
});

test("mutex is synchronous before durable drain; rapid verify, sign-out and merge clicks cannot overlap", async () => {
  const sequence = account.createAccountRequestSequence(), drain = deferred(), events = [], busyEvents = [];
  sequence.subscribe((busy) => busyEvents.push(busy));
  const first = sequence.mutate(() => account.performAccountTransition({ before: async () => { events.push("drain"); await drain.promise; }, request: async () => { events.push("verify"); return bob; }, after: async () => { events.push("reload"); } }));
  assert.equal(sequence.busy, true, "lock is reserved before any awaited drain work");
  const signout = sequence.mutate(async () => { events.push("signout"); });
  const merge = sequence.mutate(async () => { events.push("merge"); });
  assert.deepEqual(await signout, { accepted: false }); assert.deepEqual(await merge, { accepted: false });
  await tick(); assert.deepEqual(events, ["drain"]);
  drain.resolve(); assert.equal((await first).accepted, true);
  assert.deepEqual(events, ["drain", "verify", "reload"]); assert.deepEqual(busyEvents, [true, false]);
});

test("an undurable original-scope save prevents auth HTTP and releases the action lock", async () => {
  const sequence = account.createAccountRequestSequence(), events = [];
  await assert.rejects(sequence.mutate(() => account.performAccountTransition({ before: async () => { throw new Error("storage full"); }, request: async () => { events.push("verify"); }, after: async () => { events.push("reload"); } })), account.WebAccountSaveError);
  assert.deepEqual(events, [], "no identity HTTP or reload after a barrier that restores itself");
  assert.equal(sequence.busy, false);
  assert.equal((await sequence.mutate(async () => "retry")).value, "retry");
});

test("failed auth still resumes drained learning sync and does not poison later queued reads", async () => {
  const sequence = account.createAccountRequestSequence(), events = [];
  const failure = new account.WebAccountRequestError("Code expired", 401, true, { ...alice, identity: null, email: null });
  await assert.rejects(sequence.mutate(() => account.performAccountTransition({ before: async () => { events.push("drain"); }, request: async () => { events.push("request"); throw failure; }, after: async () => { events.push("reload"); } })), (error) => error === failure);
  assert.deepEqual(events, ["drain", "request", "reload"]); assert.equal(sequence.busy, false);
  assert.deepEqual(await sequence.read(async () => bob), { current: true, value: bob });
});

test("successful auth remains distinguishable from a failed learning-data reload", async () => {
  const failure = new Error("local reconnect unavailable");
  const result = await account.performAccountTransition({ before: async () => {}, request: async () => bob, after: async () => { throw failure; } });
  assert.deepEqual(result.value, bob); assert.equal(result.reloadError, failure);
});

test("verified scope changes invalidate older status; a fresh read sees the new identity", async () => {
  const sequence = account.createAccountRequestSequence(), prior = deferred();
  const oldRead = sequence.read(async () => { await prior.promise; return alice; });
  await tick(); sequence.invalidate();
  const newRead = sequence.read(async () => bob);
  prior.resolve(); assert.deepEqual(await oldRead, { current: false });
  assert.deepEqual(await newRead, { current: true, value: bob });
});

test("status while a mutation is reserved does not start HTTP, and can be retried after it completes", async () => {
  const sequence = account.createAccountRequestSequence(), gate = deferred();
  const mutation = sequence.mutate(async () => { await gate.promise; });
  let reads = 0;
  assert.deepEqual(await sequence.read(async () => { reads += 1; return alice; }), { current: false });
  assert.equal(reads, 0); gate.resolve(); await mutation;
  assert.equal((await sequence.read(async () => { reads += 1; return bob; })).current, true); assert.equal(reads, 1);
});

test("remount-style subscribers share sequencing but no previous account result is replayed", async () => {
  const sequence = account.createAccountRequestSequence(), gate = deferred(), firstBusy = [], secondBusy = [];
  const unsubscribe = sequence.subscribe((busy) => firstBusy.push(busy));
  const mutation = sequence.mutate(async () => { await gate.promise; return alice; });
  unsubscribe(); sequence.subscribe((busy) => secondBusy.push(busy));
  assert.equal(sequence.busy, true);
  gate.resolve(); await mutation;
  assert.deepEqual(firstBusy, [true]); assert.deepEqual(secondBusy, [false]);
  assert.equal("account" in sequence, false); assert.equal("token" in sequence, false);
});

test("structured status 401 retains verified configuration for deliberate sign-in and signout recovery", async () => {
  const response = { enabled: true, emailReady: true, identity: null, email: null, requiresSignIn: true, error: "Sign in again." };
  let options;
  await assert.rejects(account.requestWebAccount("status", undefined, async (_url, init) => { options = init; return Response.json(response, { status: 401 }); }), (error) => {
    assert.equal(error.requiresSignIn, true); assert.equal(error.status, 401);
    assert.deepEqual(error.account, { enabled: true, emailReady: true, identity: null, email: null }); return true;
  });
  assert.equal(options.credentials, "same-origin"); assert.equal(options.cache, "no-store"); assert.equal(options.method, undefined);
});

test("network and malformed responses cannot manufacture a disabled guest account", async () => {
  await assert.rejects(account.requestWebAccount("status", undefined, async () => { throw new TypeError("Failed to fetch"); }), TypeError);
  await assert.rejects(account.requestWebAccount("status", undefined, async () => Response.json({ identity: null })), /unsupported record/);
  await assert.rejects(account.requestWebAccount("status", undefined, async () => Response.json({ enabled: true, error: "Unavailable" }, { status: 503 })), (error) => error.account === null && error.requiresSignIn === false);
  assert.match(account.accountMessage(new TypeError("Failed to fetch")), /Reconnect to check sign-in/);
});

test("account responses expose only metadata and reject an invalid identity", async () => {
  const value = await account.requestWebAccount("verify", { email: alice.email, code: "123456" }, async () => Response.json({ ...alice, access_token: "fixture-not-returned", refresh_token: "fixture-not-returned", provider_metadata: { private: true } }));
  assert.deepEqual(value, alice); assert.equal("access_token" in value, false); assert.equal("refresh_token" in value, false);
  await assert.rejects(account.requestWebAccount("status", undefined, async () => Response.json({ ...alice, identity: "supabase:not-a-uuid" })), /unsupported record/);
});

test("same-account reverification sends the expected UUID, never a caller-selected email", async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, body: JSON.parse(options.body), method: options.method }); return Response.json(url.endsWith("reverify-otp") ? { sent: true, identity: alice.identity } : { ...alice, reverified: true }); };
  await account.requestWebAccount("reverify-otp", { expectedIdentity: alice.identity }, fetcher);
  await account.requestWebAccount("reverify", { expectedIdentity: alice.identity, code: "123456" }, fetcher);
  assert.deepEqual(calls, [
    { url: "/api/account/reverify-otp", method: "POST", body: { expectedIdentity: alice.identity } },
    { url: "/api/account/reverify", method: "POST", body: { expectedIdentity: alice.identity, code: "123456" } }
  ]);
});


test("actual account panel renders Korean labels and checks status before claiming guest-only mode", async () => {
  const panelSource = await readFile(new URL("../app/WebAccountPanel.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(panelSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const resolved = compiled.replace(/from "([^"]+)"/g, (_match, name) => `from ${JSON.stringify(name === "../lib/web-account-request" ? accountURL : import.meta.resolve(name))}`);
  const { default: Panel } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`);
  const props = { scopeKey: "pending", onIdentityChange: async () => {}, onImportLegacy: async () => false };
  const korean = renderToStaticMarkup(React.createElement(Panel, { ...props, language: "ko" }));
  assert.match(korean, /lang="ko"/); assert.match(korean, /\ub0b4 \ud559\uc2b5 \uacc4\uc815/); assert.match(korean, /\ub85c\uadf8\uc778 \uc0c1\ud0dc\ub97c \ud655\uc778\ud558\uace0 \uc788\uc5b4\uc694/);
  assert.doesNotMatch(korean, /\uacc4\uc815 \ub85c\uadf8\uc778\uc774 \uc544\uc9c1 \ud65c\uc131\ud654\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4/);
  const english = renderToStaticMarkup(React.createElement(Panel, props));
  assert.match(english, /Your learner account/); assert.match(english, /Checking shared sign-in for this browser/);
  assert.doesNotMatch(english, /Shared sign-in is disabled for this build/);
});
