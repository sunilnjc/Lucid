import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";

// Test the checked-in function; every Supabase operation is a memory-only stub.
const source = (await fs.readFile(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8"))
  .replace(/^import \{ createClient \} from .*;\n/m, "");
const outputText = stripTypeScriptTypes(source);
const userID = "11111111-1111-1111-1111-111111111111";
const sessionID = "22222222-2222-2222-2222-222222222222";
const now = Math.floor(Date.now() / 1000);
const standardClaims = { sub: userID, role: "authenticated", session_id: sessionID, amr: [{ method: "otp", timestamp: now }] };
function bearer(claims) { return `test-header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.verified-by-test-stub`; }

async function runCase(name, claims, expectedStatus, { valid = true, body = {}, method = "POST" } = {}) {
  let handler;
  const deleted = [];
  const token = bearer(claims);
  const context = vm.createContext({
    Response, Date, atob,
    Deno: {
      env: { get: (name) => name === "SUPABASE_URL" ? "https://lucid-auth.invalid" : "test-service-key-never-sent" },
      serve: (callback) => { handler = callback; },
    },
    createClient: () => ({ auth: {
      getUser: async (received) => {
        assert.equal(received, token);
        return valid ? { data: { user: { id: userID, last_sign_in_at: new Date().toISOString() } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } };
      },
      admin: { deleteUser: async (id) => { deleted.push(id); return { error: null }; } },
    } }),
  });
  vm.runInContext(outputText, context);
  const response = await handler(new Request("https://lucid-auth.invalid/functions/v1/delete-account", {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  }));
  assert.equal(response.status, expectedStatus, name);
  assert.deepEqual(deleted, expectedStatus === 200 ? [userID] : [], name);
  console.log(`PASS ${name}`);
}

await runCase("fresh OTP can delete only its verified user", standardClaims, 200, { body: { user_id: "33333333-3333-3333-3333-333333333333" } });
await runCase("invalid bearer never reaches admin deletion", standardClaims, 401, { valid: false });
await runCase("old OTP rejected despite another device's fresh last_sign_in_at", { ...standardClaims, amr: [{ method: "otp", timestamp: now - 600 }] }, 403);
await runCase("token refresh is not fresh OTP authentication", { ...standardClaims, amr: [{ method: "token_refresh", timestamp: now }] }, 403);
await runCase("future OTP timestamps rejected", { ...standardClaims, amr: [{ method: "otp", timestamp: now + 600 }] }, 403);
await runCase("missing session ID rejected", { ...standardClaims, session_id: undefined }, 401);
await runCase("service-role-like claims rejected", { ...standardClaims, role: "service_role" }, 401);
await runCase("mismatched subject rejected", { ...standardClaims, sub: sessionID }, 401);
await runCase("non-POST never deletes", standardClaims, 405, { method: "GET" });
console.log("9 deletion authorization tests passed; all Supabase operations mocked");
