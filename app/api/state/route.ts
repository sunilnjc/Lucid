import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { accountJSON, hasSharedSession, requireSameOrigin, sharedBackendRequest, verifiedSharedAccount, WebAccountError, type VerifiedSharedAccount } from "@/lib/web-account";
import { validateSharedCloudState } from "@/lib/shared-learning-state";
import { getDb, initializeDatabase } from "@/db";
import { learnerState } from "@/db/schema";
import { MAX_STATE_BYTES, mergeWebStates, prepareWebState, toCloudWebState, validateWebState } from "@/lib/web-learning-state";
function learnerKey(request: Request) {
  const authenticated = request.headers.get("oai-authenticated-user-id");
  // Shared mode cannot treat a browser-supplied Sites header as identity proof.
  // Existing Sites records remain intact; gateway trust is a separate deployment gate.
  if (authenticated && (environment().LUCID_SHARED_AUTH_ENABLED !== "true" || environment().LUCID_TRUST_SITES_IDENTITY === "true")) return `user:${authenticated}`;
  const device = request.headers.get("x-lucid-device-id") ?? "";
  return /^[a-zA-Z0-9-]{8,80}$/.test(device) ? `device:${device}` : null;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "Vary": "Cookie, Authorization, oai-authenticated-user-id, x-lucid-device-id" } });
const environment = () => env as unknown as Record<string, unknown>;
export async function getSharedRecord(account: VerifiedSharedAccount) {
  const rows = await sharedBackendRequest(account, `rest/v1/lucid_state?user_id=eq.${account.userId}&select=revision,state`) as { revision?: unknown; state?: unknown }[];
  if (!Array.isArray(rows) || rows.length > 1 || rows.some((row) => !Number.isSafeInteger(row.revision) || Number(row.revision) < 0)) throw new WebAccountError("The saved record requires recovery or a newer client.", 422);
  const row = rows[0];
  // A newly inserted account row can contain the initial empty state before its first CAS.
  if (row && Number(row.revision) > 0 && !validateSharedCloudState(row.state)) throw new WebAccountError("The saved record requires recovery or a newer client.", 422);
  return { identity: account.identity, sharedState: row && Number(row.revision) > 0 ? row.state : null, revision: row ? Number(row.revision) : 0 };
}
function accountFailure(request: Request, error: unknown, cookies: string[] = []) {
  const failure = error instanceof WebAccountError ? error : new WebAccountError("Unable to connect to shared learning storage.", 503);
  return accountJSON(request, { error: failure.message, requiresSignIn: failure.status === 401 }, failure.status, cookies);
}
export async function GET(request: Request) {
  let account: VerifiedSharedAccount | null;
  try {
    account = await verifiedSharedAccount(request, environment());
    if (account && request.headers.get("x-lucid-state-source") !== "legacy") return accountJSON(request, await getSharedRecord(account), 200, account.cookies);
  } catch (error) { return accountFailure(request, error); }
  const identity = learnerKey(request);
  if (!identity) return json({ error: "A signed-in user or device identifier is required." }, 401);
  try {
    await initializeDatabase(); const db = getDb();
    const row = await db.query.learnerState.findFirst({ columns: { state: true }, where: eq(learnerState.userKey, identity) });
    if (row && !validateWebState(row.state)) return json({ error: "The saved record requires recovery or a newer client." }, 422);
    return accountJSON(request, { identity, state: row ? toCloudWebState(prepareWebState(row.state)) : null }, 200, account?.cookies);
  } catch { return json({ error: "Unable to load app state." }, 500); }
}
export async function PUT(request: Request) {
  let account: VerifiedSharedAccount | null;
  try {
    // Shared writes are protected by same-origin checks even when a token is expired.
    if (hasSharedSession(request)) requireSameOrigin(request);
    account = await verifiedSharedAccount(request, environment());
  } catch (error) { return accountFailure(request, error); }
  const identity = learnerKey(request);
  if (!identity && !account) return json({ error: "A signed-in user or device identifier is required." }, 401);
  if (Number(request.headers.get("content-length")) > MAX_STATE_BYTES + 100) return json({ error: "Learning state is too large." }, 413);
  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_STATE_BYTES + 100) return json({ error: "Learning state is too large." }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  if (account) {
    try {
      const shared = body as { scopeKey?: unknown; sharedState?: unknown; expectedRevision?: unknown } | null;
      if (!shared || shared.scopeKey !== account.identity) return accountJSON(request, { identity: account.identity, error: "The learner account changed. Reload before saving." }, 409, account.cookies);
      if (!Number.isSafeInteger(shared.expectedRevision) || Number(shared.expectedRevision) < 0 || !validateSharedCloudState(shared.sharedState)) return accountJSON(request, { error: "Request body must include a supported shared learning record and revision." }, 400, account.cookies);
      await sharedBackendRequest(account, "rest/v1/rpc/lucid_save_state", { method: "POST", body: { expected_revision: shared.expectedRevision, new_state: shared.sharedState } });
      return accountJSON(request, await getSharedRecord(account), 200, account.cookies);
    } catch (error) { return accountFailure(request, error, account.cookies); }
  }
  if (!identity) return json({ error: "A verified legacy identity or device identifier is required." }, 401);
  if (!body || typeof body !== "object" || !validateWebState((body as { state?: unknown }).state)) return json({ error: "Request body must include a supported learning state." }, 400);
  if ((body as { scopeKey?: unknown }).scopeKey !== identity) return json({ identity, error: "The learning identity changed. Reload before saving." }, 409);
  const incoming = toCloudWebState(prepareWebState((body as { state: unknown }).state));
  try {
    await initializeDatabase(); const db = getDb();
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await db.query.learnerState.findFirst({ columns: { state: true, updatedAt: true }, where: eq(learnerState.userKey, identity) });
      if (row && !validateWebState(row.state)) return json({ error: "The saved record requires recovery before it can be replaced." }, 422);
      const state = row ? toCloudWebState(mergeWebStates(row.state, incoming)) : incoming;
      const now = new Date(Math.max(Date.now(), (row?.updatedAt.getTime() ?? 0) + 1));
      const saved = row
        ? await db.update(learnerState).set({ state, updatedAt: now }).where(and(eq(learnerState.userKey, identity), eq(learnerState.updatedAt, row.updatedAt))).returning({ userKey: learnerState.userKey })
        : await db.insert(learnerState).values({ userKey: identity, state, createdAt: now, updatedAt: now }).onConflictDoNothing().returning({ userKey: learnerState.userKey });
      if (saved.length) return json({ identity, state });
    }
    return json({ error: "Another device is updating this record. Retry to merge both records." }, 409);
  } catch { return json({ error: "Unable to save app state." }, 500); }
}
