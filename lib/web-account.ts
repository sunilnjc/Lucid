/** Shared learner identity uses the existing Supabase Auth UUID; no email-based account joining. */
export type SharedAuthConfig = { url: string; publicKey: string; emailReady: boolean };
export type WebAccount = { enabled: boolean; emailReady: boolean; identity: string | null; email: string | null; error?: string };
export type AccountEnvironment = Record<string, unknown>;
export const SHARED_COOKIE_NAMES = { access: "lucid-shared-access", refresh: "lucid-shared-refresh" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class WebAccountError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) { super(message); this.status = status; }
}
export function sharedAuthConfig(environment: AccountEnvironment): SharedAuthConfig | null {
  if (environment.LUCID_SHARED_AUTH_ENABLED !== "true") return null;
  const url = environment.LUCID_SUPABASE_URL, publicKey = environment.LUCID_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== "string" || typeof publicKey !== "string" || !publicKey || publicKey.length > 3000) return null;
  // No privileged database key is accepted. Explicit local test mode only accepts loopback.
  if (publicKey.startsWith("sb_secret_")) return null;
  try {
    const parsed = new URL(url);
    const local = environment.LUCID_SHARED_ALLOW_LOCAL_TEST === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (publicKey.split(".").length === 3) {
      const claims = JSON.parse(atob(publicKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
      if (claims.role !== "anon") return null;
    } else if (!publicKey.startsWith("sb_publishable_") && !local) return null;
    if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    return { url: parsed.origin, publicKey, emailReady: environment.LUCID_SHARED_EMAIL_ENABLED === "true" };
  } catch { return null; }
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || origin !== new URL(request.url).origin) throw new WebAccountError("Open Lucid directly before changing account or saving progress.", 403);
}
export function hasSharedSession(request: Request) { return Boolean(readCookies(request)[SHARED_COOKIE_NAMES.access] || readCookies(request)[SHARED_COOKIE_NAMES.refresh] || request.headers.get("authorization")); }
function readCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get("cookie") ?? "").split(";").flatMap((part) => {
    const index = part.indexOf("="); if (index < 0) return [];
    try { return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]]; } catch { return []; }
  }));
}
function sessionCookies(request: Request, session?: { access_token: string; refresh_token: string; expires_in: number }) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const base = `; HttpOnly; SameSite=Strict; Path=/${secure}`;
  if (!session) return Object.values(SHARED_COOKIE_NAMES).map((name) => `${name}=; Max-Age=0${base}`);
  return [
    `${SHARED_COOKIE_NAMES.access}=${encodeURIComponent(session.access_token)}; Max-Age=${Math.min(86400, Math.max(60, session.expires_in))}${base}`,
    `${SHARED_COOKIE_NAMES.refresh}=${encodeURIComponent(session.refresh_token)}; Max-Age=2592000${base}`,
  ];
}
export function accountJSON(request: Request, body: unknown, status = 200, cookies: string[] = []) {
  void request;
  const headers = new Headers({ "Cache-Control": "no-store, private", "Vary": "Cookie, Authorization, oai-authenticated-user-id, x-lucid-device-id" });
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return Response.json(body, { status, headers });
}
async function providerRequest(config: SharedAuthConfig, path: string, options: { method?: string; token?: string; body?: unknown } = {}, fetcher: typeof fetch = fetch) {
  let response: Response;
  try { response = await fetcher(`${config.url}/${path}`, { method: options.method ?? "GET", headers: { apikey: config.publicKey, "Content-Type": "application/json", "Cache-Control": "no-store", ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }), cache: "no-store", signal: AbortSignal.timeout(25000) }); }
  catch { throw new WebAccountError("The account service is unavailable. Your local progress is safe; retry the connection.", 503); }
  if (!response.ok) throw new WebAccountError(response.status === 429 ? "Wait a moment before requesting another sign-in code." : response.status === 409 ? "Another client saved first. Download, merge and retry." : response.status >= 500 ? "The account service is unavailable. Try again later." : response.status === 400 && path.startsWith("rest/") ? "Shared learning storage rejected this record. Check the compatible backend migration before retrying." : "Your sign-in session or code is no longer valid. Sign in again.", response.status === 429 ? 429 : response.status === 409 ? 409 : response.status >= 500 ? 503 : response.status === 400 && path.startsWith("rest/") ? 400 : 401);
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { throw new WebAccountError("The account service returned an unsupported record.", 502); }
}
type User = { id: string; email?: string; email_confirmed_at?: string; confirmed_at?: string };
function userValue(value: unknown): User {
  const user = value as User | null;
  if (!user || !UUID.test(user.id) || !(user.email_confirmed_at || user.confirmed_at)) throw new WebAccountError("A verified learner account is required.");
  return user;
}
function sessionValue(value: unknown) {
  const session = value as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; user?: unknown } | null;
  if (!session || typeof session.access_token !== "string" || typeof session.refresh_token !== "string" || !session.access_token || !session.refresh_token || session.access_token.length > 6000 || session.refresh_token.length > 6000 || (!Number.isFinite(session.expires_in) || Number(session.expires_in) <= 0)) throw new WebAccountError("The account service returned an unsupported session.", 502);
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: Number(session.expires_in), user: userValue(session.user) };
}
export type VerifiedSharedAccount = { identity: string; userId: string; email: string | null; accessToken: string; cookies: string[]; config: SharedAuthConfig };
export async function verifiedSharedAccount(request: Request, environment: AccountEnvironment, fetcher: typeof fetch = fetch): Promise<VerifiedSharedAccount | null> {
  const config = sharedAuthConfig(environment);
  if (!config) { if (hasSharedSession(request)) throw new WebAccountError("Shared account access is not enabled on this server.", 503); return null; }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new WebAccountError("Open Lucid directly to access your account.", 403);
  const stored = readCookies(request), bearer = request.headers.get("authorization");
  if (bearer && !bearer.startsWith("Bearer ")) throw new WebAccountError("The sign-in token is invalid.");
  let accessToken = bearer?.startsWith("Bearer ") ? bearer.slice(7) : stored[SHARED_COOKIE_NAMES.access];
  const refresh = bearer ? undefined : stored[SHARED_COOKIE_NAMES.refresh];
  if (!accessToken && !refresh) return null;
  let user: User;
  let cookies: string[] = [];
  try { if (!accessToken) throw new WebAccountError("Session expired."); user = userValue(await providerRequest(config, "auth/v1/user", { token: accessToken }, fetcher)); }
  catch (error) {
    if (!(error instanceof WebAccountError) || error.status !== 401 || !refresh) throw error;
    const session = sessionValue(await providerRequest(config, "auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refresh } }, fetcher));
    accessToken = session.access_token;
    user = userValue(await providerRequest(config, "auth/v1/user", { token: accessToken }, fetcher));
    if (user.id.toLowerCase() !== session.user.id.toLowerCase()) throw new WebAccountError("The account changed during session recovery.");
    cookies = sessionCookies(request, session);
  }
  return { identity: `supabase:${user.id.toLowerCase()}`, userId: user.id.toLowerCase(), email: user.email ?? null, accessToken, cookies, config };
}
const emailValue = (value: unknown) => {
  if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new WebAccountError("Enter a valid email address.", 400);
  return value.trim().toLowerCase();
};
export async function handleAccountRequest(request: Request, environment: AccountEnvironment, action = "status", fetcher: typeof fetch = fetch): Promise<Response> {
  const config = sharedAuthConfig(environment);
  try {
    if (action === "status") {
      const account = await verifiedSharedAccount(request, environment, fetcher);
      return accountJSON(request, { enabled: Boolean(config), emailReady: config?.emailReady === true, identity: account?.identity ?? null, email: account?.email ?? null }, 200, account?.cookies);
    }
    requireSameOrigin(request);
    if (request.method !== "POST") throw new WebAccountError("POST required for account changes.", 405);
    if (action === "signout") {
      // Local cookie clearing must work even when shared preview configuration is disabled.
      try { const account = await verifiedSharedAccount(request, environment, fetcher); if (account) await providerRequest(account.config, "auth/v1/logout?scope=local", { method: "POST", token: account.accessToken }, fetcher); } catch { /* Local sign-out works while offline or revoked. */ }
      return accountJSON(request, { signedOut: true, identity: null }, 200, sessionCookies(request));
    }
    if (!config) throw new WebAccountError("Shared account sign-in is not enabled on this server.", 503);
    if (Number(request.headers.get("content-length")) > 2048) throw new WebAccountError("Account request is too large.", 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048) throw new WebAccountError("Account request is too large.", 413);
    let body: Record<string, unknown>;
    try { body = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { throw new WebAccountError("Invalid account request.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new WebAccountError("Invalid account request.", 400);
    if (["reverify-otp", "reverify"].includes(action)) {
      const account = await verifiedSharedAccount(request, environment, fetcher);
      if (!account) throw new WebAccountError("Sign in again before verifying this account.");
      if (body.expectedIdentity !== account.identity) throw new WebAccountError("The learner account changed. Check the signed-in account before continuing.", 409);
      if (!config.emailReady) throw new WebAccountError("Email verification is not enabled on this server.", 503);
      if (!account.email) throw new WebAccountError("This verified account has no email for verification.", 422);
      if (action === "reverify-otp") {
        await providerRequest(config, "auth/v1/otp", { method: "POST", body: { email: account.email, create_user: false } }, fetcher);
        return accountJSON(request, { sent: true, identity: account.identity }, 200, account.cookies);
      }
      if (typeof body.code !== "string" || !/^[0-9]{6,10}$/.test(body.code)) throw new WebAccountError("Enter the code from your email.", 400);
      const session = sessionValue(await providerRequest(config, "auth/v1/verify", { method: "POST", body: { email: account.email, token: body.code, type: "email" } }, fetcher));
      const user = userValue(await providerRequest(config, "auth/v1/user", { token: session.access_token }, fetcher));
      if (user.id.toLowerCase() !== account.userId || user.id.toLowerCase() !== session.user.id.toLowerCase()) throw new WebAccountError("Verification returned a different learner account. No account was changed.", 409);
      return accountJSON(request, { enabled: true, emailReady: true, identity: account.identity, email: user.email ?? null, reverified: true }, 200, sessionCookies(request, session));
    }
    if (action === "otp") {
      if (!config.emailReady) throw new WebAccountError("Email sign-in is not enabled for this preview.", 503);
      // This module signs in existing learner accounts. Public signup is a separate approval.
      await providerRequest(config, "auth/v1/otp", { method: "POST", body: { email: emailValue(body.email), create_user: false } }, fetcher);
      return accountJSON(request, { sent: true });
    }
    if (action === "verify") {
      if (!config.emailReady) throw new WebAccountError("Email sign-in is not enabled for this preview.", 503);
      if (typeof body.code !== "string" || !/^[0-9]{6,10}$/.test(body.code)) throw new WebAccountError("Enter the code from your email.", 400);
      const session = sessionValue(await providerRequest(config, "auth/v1/verify", { method: "POST", body: { email: emailValue(body.email), token: body.code, type: "email" } }, fetcher));
      const user = userValue(await providerRequest(config, "auth/v1/user", { token: session.access_token }, fetcher));
      if (user.id.toLowerCase() !== session.user.id.toLowerCase()) throw new WebAccountError("The verified account changed before sign-in.");
      return accountJSON(request, { enabled: true, emailReady: true, identity: `supabase:${user.id.toLowerCase()}`, email: user.email ?? null }, 200, sessionCookies(request, session));
    }
    throw new WebAccountError("Unsupported account action.", 404);
  } catch (error) {
    const failure = error instanceof WebAccountError ? error : new WebAccountError("Unable to connect to the account service.", 503);
    // A late failure from an older refresh must not erase a newer valid session.
    // Only explicit sign-out clears browser cookies.
    return accountJSON(request, { enabled: Boolean(config), emailReady: config?.emailReady === true, identity: null, email: null, requiresSignIn: failure.status === 401, error: failure.message }, failure.status);
  }
}
export async function sharedBackendRequest(account: VerifiedSharedAccount, path: string, options: { method?: string; body?: unknown } = {}, fetcher: typeof fetch = fetch) {
  return providerRequest(account.config, path, { ...options, token: account.accessToken }, fetcher);
}
