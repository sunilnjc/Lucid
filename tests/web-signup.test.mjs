import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const dataURL = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const serverURL = dataURL(stripTypeScriptTypes(await readFile(new URL("../lib/web-account.ts", import.meta.url), "utf8")));
const browserURL = dataURL(ts.transpileModule(await readFile(new URL("../lib/web-account-request.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { sharedAuthConfig, handleAccountRequest } = await import(serverURL);
const { accountFromReply, requestWebAccount } = await import(browserURL);
const id = "11111111-1111-4111-8111-111111111111";
const origin = "https://lucid.example.test";
const environment = { LUCID_SHARED_AUTH_ENABLED: "true", LUCID_SHARED_EMAIL_ENABLED: "true", LUCID_SUPABASE_URL: "https://fixture.supabase.co", LUCID_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic" };
const signupEnvironment = { ...environment, LUCID_SHARED_SIGNUP_ENABLED: "true" };
const verifiedUser = { id, email: "learner@example.test", email_confirmed_at: "2026-10-22T00:00:00Z" };
const request = (action, body, headers = {}) => new Request(`${origin}/api/account/${action}`, { method: action === "status" ? "GET" : "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
function provider(user = verifiedUser) {
  const calls = [];
  return { calls, fetch: async (url, options = {}) => {
    calls.push({ url, options });
    switch (new URL(url).pathname) {
      case "/auth/v1/otp": return new Response(null, { status: 204 });
      case "/auth/v1/verify": return Response.json({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 3600, user });
      case "/auth/v1/user": return Response.json(user);
      default: throw new Error("Unexpected provider request");
    }
  } };
}

test("signup needs exact server opt-in plus enabled auth and email; callers cannot opt in", async () => {
  for (const flag of [undefined, false, true, "false", "TRUE", "1"]) {
    const config = { ...environment, LUCID_SHARED_SIGNUP_ENABLED: flag };
    assert.equal(sharedAuthConfig(config).signupEnabled, false);
    const p = provider();
    const response = await handleAccountRequest(request("otp", { email: "learner@example.test", create_user: true, signupEnabled: true }), config, "otp", p.fetch);
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(p.calls[0].options.body).create_user, false);
  }
  for (const config of [{ ...signupEnvironment, LUCID_SHARED_AUTH_ENABLED: "false" }, { ...signupEnvironment, LUCID_SHARED_EMAIL_ENABLED: "false" }]) {
    const p = provider();
    const response = await handleAccountRequest(request("otp", { email: "learner@example.test" }), config, "otp", p.fetch);
    assert.equal(response.status, 503); assert.equal(p.calls.length, 0);
    assert.equal((await response.json()).signupEnabled, false);
  }
});

test("approved signup requests a normalized email code without creating a browser session or touching learning storage", async () => {
  const p = provider();
  const response = await handleAccountRequest(request("otp", { email: " Learner@Example.test " }), signupEnvironment, "otp", p.fetch);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { sent: true });
  assert.deepEqual(response.headers.getSetCookie(), []);
  assert.equal(p.calls.length, 1); assert.ok(p.calls[0].url.endsWith("/auth/v1/otp"));
  assert.deepEqual(JSON.parse(p.calls[0].options.body), { email: "learner@example.test", create_user: true });
});

test("requesting signup cannot open an unverified learner; confirmed code verification retains exact UUID and HttpOnly cookies", async () => {
  const unverified = provider({ id, email: verifiedUser.email });
  const rejected = await handleAccountRequest(request("verify", { email: verifiedUser.email, code: "123456" }), signupEnvironment, "verify", unverified.fetch);
  assert.equal(rejected.status, 401); assert.deepEqual(rejected.headers.getSetCookie(), []);
  assert.equal((await rejected.json()).identity, null);
  const p = provider();
  const response = await handleAccountRequest(request("verify", { email: verifiedUser.email, code: "123456" }), signupEnvironment, "verify", p.fetch);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.identity, `supabase:${id}`); assert.equal(value.signupEnabled, true);
  assert.doesNotMatch(JSON.stringify(value), /synthetic-access|synthetic-refresh/);
  assert.equal(response.headers.getSetCookie().length, 2);
  for (const cookie of response.headers.getSetCookie()) assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/; Secure/);
  assert.ok(p.calls.every((call) => new URL(call.url).pathname.startsWith("/auth/v1/")), "verification does not merge or write a guest learning record");
});

test("signup enablement cannot alter same-account reverification or its server-selected email", async () => {
  const p = provider();
  const response = await handleAccountRequest(request("reverify-otp", { expectedIdentity: `supabase:${id}`, email: "other@example.test", create_user: true }, { Cookie: "lucid-shared-access=synthetic-current" }), signupEnvironment, "reverify-otp", p.fetch);
  assert.equal(response.status, 200);
  const sent = p.calls.filter((call) => new URL(call.url).pathname === "/auth/v1/otp");
  assert.equal(sent.length, 1); assert.deepEqual(JSON.parse(sent[0].options.body), { email: verifiedUser.email, create_user: false });
});

test("signup remains subject to same-origin protection before a provider call", async () => {
  const p = provider();
  const response = await handleAccountRequest(request("otp", { email: verifiedUser.email }, { Origin: "https://attacker.example.test" }), signupEnvironment, "otp", p.fetch);
  assert.equal(response.status, 403); assert.equal(p.calls.length, 0);
});

test("status exposes a boolean signup capability while old or malformed browser metadata cannot enable signup", async () => {
  for (const [config, expected] of [[{}, false], [environment, false], [signupEnvironment, true]]) {
    const response = await handleAccountRequest(request("status"), config, "status", provider().fetch);
    assert.equal(response.status, 200); assert.equal((await response.json()).signupEnabled, expected);
  }
  const legacy = { enabled: true, emailReady: true, identity: null, email: null };
  assert.deepEqual(accountFromReply(await requestWebAccount("status", undefined, async () => Response.json(legacy))), legacy);
  for (const supplied of ["true", 1, {}, null]) {
    const parsed = accountFromReply(await requestWebAccount("status", undefined, async () => Response.json({ ...legacy, signupEnabled: supplied, access_token: "never-exposed" })));
    assert.notEqual(parsed.signupEnabled, true); assert.equal("access_token" in parsed, false);
  }
  assert.equal(accountFromReply(await requestWebAccount("status", undefined, async () => Response.json({ ...legacy, signupEnabled: true }))).signupEnabled, true);
});

async function renderReadyPanel(account, language) {
  // Keep the real component and hook logic. Only initial server-render state is
  // seeded, because React SSR deliberately does not execute its status effect.
  const reactURL = import.meta.resolve("react");
  const hooksURL = dataURL(`import * as React from ${JSON.stringify(reactURL)};
    export const useCallback=React.useCallback,useEffect=React.useEffect,useRef=React.useRef,useSyncExternalStore=React.useSyncExternalStore;
    export function useState(initial){return React.useState(initial && typeof initial==='object' && 'enabled' in initial ? ${JSON.stringify(account)} : initial==='checking' ? 'ready' : initial);}`);
  const source = await readFile(new URL("../app/WebAccountPanel.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const resolved = compiled.replace(/from "([^"]+)"/g, (_match, name) => `from ${JSON.stringify(name === "react" ? hooksURL : name === "../lib/web-account-request" ? browserURL : import.meta.resolve(name))}`);
  const { default: Panel } = await import(dataURL(resolved));
  let imports = 0;
  const html = renderToStaticMarkup(React.createElement(Panel, { scopeKey: "device:fixture", language, onIdentityChange: async () => {}, onImportLegacy: async () => { imports += 1; return true; } }));
  assert.equal(imports, 0); return html;
}

test("actual English and Korean entry panels disclose signup only when available and never offer automatic guest import", async () => {
  const guest = { enabled: true, emailReady: true, identity: null, email: null };
  const english = await renderReadyPanel({ ...guest, signupEnabled: true }, "en");
  assert.match(english, /Sign in or create an account with an email code/);
  assert.match(english, /Guest work stays separate until you choose to merge it/);
  assert.match(english, />Email address<\/label>/); assert.match(english, />Send email code<\/button>/);
  assert.doesNotMatch(english, />Merge earlier web progress into this account<\/button>/);
  assert.doesNotMatch(english, /Lucid mobile/);
  const korean = await renderReadyPanel({ ...guest, signupEnabled: true }, "ko");
  assert.match(korean, /이메일 코드로 로그인하거나 계정을 만드세요/);
  assert.match(korean, /게스트 기록은 직접 합치기를 선택하기 전까지 따로 보관됩니다/);
  assert.match(korean, />이메일 주소<\/label>/); assert.match(korean, />이메일 코드 보내기<\/button>/);
  assert.doesNotMatch(korean, /모바일/);
  for (const account of [guest, { ...guest, signupEnabled: false }, { ...guest, emailReady: false, signupEnabled: true }]) {
    const existing = await renderReadyPanel(account, "en");
    assert.doesNotMatch(existing, /Sign in or create an account|Lucid mobile/);
    assert.match(existing, /Use a verified email code to open your saved learning/);
    const koreanExisting = await renderReadyPanel(account, "ko");
    assert.doesNotMatch(koreanExisting, /모바일/); assert.match(koreanExisting, /계정 이메일 주소/);
  }
});
