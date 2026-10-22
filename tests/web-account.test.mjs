import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const moduleURL = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(await readFile(new URL("../lib/web-account.ts", import.meta.url), "utf8"))).toString("base64")}`;
const { sharedAuthConfig, verifiedSharedAccount, handleAccountRequest, requireSameOrigin, sharedBackendRequest } = await import(moduleURL);
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const environment = { LUCID_SHARED_AUTH_ENABLED: "true", LUCID_SHARED_EMAIL_ENABLED: "true", LUCID_SUPABASE_URL: "https://fixture.supabase.co", LUCID_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic" };
const user = (id=A, email="synthetic@example.test") => ({ id, email, email_confirmed_at: "2026-10-14T00:00:00Z" });
const session = (id=A) => ({ access_token: `access-${id}`, refresh_token: `refresh-${id}`, expires_in: 3600, user: user(id) });
const request = (method="GET", body, headers={}) => new Request("https://lucid.example.test/api/account/status", { method, headers: { origin: "https://lucid.example.test", "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
function provider(overrides={}) {
  const calls=[];
  const fetch = async (url, options={}) => {
    calls.push({ url, options });
    const path=new URL(url).pathname;
    if (overrides[path]) return overrides[path](url,options);
    if (path==="/auth/v1/otp" || path==="/auth/v1/logout") return new Response(null,{status:204});
    if (path==="/auth/v1/verify" || path==="/auth/v1/token") return Response.json(session());
    if (path==="/auth/v1/user") return Response.json(user());
    return Response.json({unexpected:true},{status:500});
  };
  return {calls,fetch};
}

test("shared auth stays disabled by default and accepts only explicitly configured public keys", () => {
  assert.equal(sharedAuthConfig({}),null);
  assert.equal(sharedAuthConfig({...environment,LUCID_SHARED_AUTH_ENABLED:"false"}),null);
  assert.equal(sharedAuthConfig({...environment,LUCID_SUPABASE_PUBLISHABLE_KEY:"sb_secret_admin"}),null);
  const token=`a.${Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")}.b`;
  assert.equal(sharedAuthConfig({...environment,LUCID_SUPABASE_PUBLISHABLE_KEY:token}),null);
  assert.equal(sharedAuthConfig({...environment,LUCID_SUPABASE_URL:"http://provider.example.test"}),null);
  assert.equal(sharedAuthConfig({...environment,LUCID_SUPABASE_URL:"http://127.0.0.1:1234",LUCID_SUPABASE_PUBLISHABLE_KEY:"synthetic",LUCID_SHARED_ALLOW_LOCAL_TEST:"true"}).url,"http://127.0.0.1:1234");
});

test("sign-in requests an existing learner code without silently creating an account", async () => {
  const p = provider();
  const response = await handleAccountRequest(request("POST", { email: " Synthetic@Example.test " }), environment, "otp", p.fetch);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(p.calls[0].options.body), { email: "synthetic@example.test", create_user: false });
});

test("OTP verification validates actual Supabase user and keeps both tokens out of response JSON", async () => {
  const p=provider();
  const response=await handleAccountRequest(request("POST",{email:" Synthetic@Example.test ",code:"123456"}),environment,"verify",p.fetch);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.identity,`supabase:${A}`);
  assert.equal(JSON.stringify(body).includes("access-"),false);
  const cookies=response.headers.getSetCookie();
  assert.equal(cookies.length,2);
  for (const cookie of cookies) for (const flag of ["HttpOnly","SameSite=Strict","Secure","Path=/"]) assert.ok(cookie.includes(flag));
  assert.equal(JSON.parse(p.calls[0].options.body).email,"synthetic@example.test");
  assert.ok(p.calls[1].url.endsWith("/auth/v1/user"));
});

test("matching email labels cannot join different UUIDs or bypass confirmation", async () => {
  const mismatch=provider({"/auth/v1/user":()=>Response.json(user(B))});
  const response=await handleAccountRequest(request("POST",{email:"synthetic@example.test",code:"123456"}),environment,"verify",mismatch.fetch);
  assert.equal(response.status,401);
  assert.deepEqual(response.headers.getSetCookie(),[]);
  const unverified=provider({"/auth/v1/user":()=>Response.json({id:A,email:"synthetic@example.test"})});
  await assert.rejects(verifiedSharedAccount(request("GET",undefined,{cookie:"lucid-shared-access=opaque"}),environment,unverified.fetch),/verified learner/);
});

test("every account read validates provider identity and ignores client UUID or Sites claims", async () => {
  const p=provider();
  const result=await verifiedSharedAccount(request("GET",undefined,{cookie:"lucid-shared-access=opaque", "x-lucid-account-id":B,"oai-authenticated-user-id":B}),environment,p.fetch);
  assert.equal(result.userId,A); assert.equal(result.identity,`supabase:${A}`);
  assert.equal(p.calls.length,1); assert.equal(p.calls[0].options.headers.Authorization,"Bearer opaque");
});

test("expired sessions refresh through provider and validate refreshed UUID before cookies change", async () => {
  let reads=0;
  const p=provider({"/auth/v1/user":()=>++reads===1?Response.json({error:"expired"},{status:401}):Response.json(user())});
  const result=await verifiedSharedAccount(request("GET",undefined,{cookie:"lucid-shared-access=expired; lucid-shared-refresh=old-refresh"}),environment,p.fetch);
  assert.equal(result.userId,A); assert.equal(result.cookies.length,2);
  assert.equal(p.calls.length,3); assert.ok(p.calls[1].url.includes("grant_type=refresh_token"));
  assert.equal(JSON.parse(p.calls[1].options.body).refresh_token,"old-refresh");
});

test("revocation, unavailable provider and malformed bearer fail without opening another learner", async () => {
  const revoked=provider({"/auth/v1/user":()=>Response.json({error:"revoked"},{status:401}),"/auth/v1/token":()=>Response.json({error:"revoked"},{status:401})});
  await assert.rejects(verifiedSharedAccount(request("GET",undefined,{cookie:"lucid-shared-access=revoked; lucid-shared-refresh=revoked"}),environment,revoked.fetch),/no longer valid/);
  await assert.rejects(verifiedSharedAccount(request("GET",undefined,{authorization:"Basic nope"}),environment,revoked.fetch),/token is invalid/);
  await assert.rejects(verifiedSharedAccount(request("GET",undefined,{cookie:"lucid-shared-access=opaque"}),environment,async()=>{throw new Error("network");}),/local progress is safe/);
});

test("mutations and cross-site reads enforce origin before any provider call", async () => {
  const p=provider();
  const response=await handleAccountRequest(request("POST",{email:"synthetic@example.test"},{origin:"https://attacker.example.test"}),environment,"otp",p.fetch);
  assert.equal(response.status,403); assert.equal(p.calls.length,0);
  assert.throws(()=>requireSameOrigin(new Request("https://lucid.example.test/api/state",{method:"PUT"})),/Open Lucid/);
  await assert.rejects(verifiedSharedAccount(request("GET",undefined,{cookie:"lucid-shared-access=opaque","sec-fetch-site":"cross-site"}),environment,p.fetch),/Open Lucid/);
});

test("sign-out clears only browser cookies even when revoked, offline or feature disabled", async () => {
  const offline=async()=>{throw new Error("offline");};
  for (const config of [environment,{}]) {
    const response=await handleAccountRequest(request("POST",{}, {cookie:"lucid-shared-access=opaque"}),config,"signout",offline);
    assert.equal(response.status,200); assert.ok(response.headers.getSetCookie().every((value)=>value.includes("Max-Age=0")));
  }
});

test("shared backend CAS carries public apikey and the live user's access token only", async () => {
  const p=provider();
  const account=await verifiedSharedAccount(request("GET",undefined,{authorization:"Bearer opaque"}),environment,p.fetch);
  await assert.rejects(sharedBackendRequest(account,"rest/v1/rpc/lucid_save_state",{method:"POST",body:{expected_revision:0,new_state:{schemaVersion:2}}},p.fetch),/unavailable/);
  const call=p.calls.at(-1); assert.equal(call.options.headers.apikey,environment.LUCID_SUPABASE_PUBLISHABLE_KEY); assert.equal(call.options.headers.Authorization,"Bearer opaque");
  assert.deepEqual(JSON.parse(call.options.body),{expected_revision:0,new_state:{schemaVersion:2}});
});
