// Deploy with JWT gateway verification disabled: this function validates the bearer itself
// with Auth.getUser, which also rejects deleted users and supports publishable API keys.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (request: Request) => {
  const respond = (status: number, message: string) =>
    Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return respond(405, "POST required");
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, "Sign in required");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond(503, "Account service unavailable");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.slice(7);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return respond(401, "Sign in required");
  // getUser above has validated this exact token. Read its session-bound AMR claim,
  // never user.last_sign_in_at (another device's recent login must not authorise this token).
  let signInTime = 0;
  try {
    const part = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
    if (claims.sub !== user.id || claims.role !== "authenticated"
      || typeof claims.session_id !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)
      || !Array.isArray(claims.amr)) return respond(401, "Sign in required");
    for (const method of claims.amr) {
      if (method?.method === "otp" && typeof method.timestamp === "number" && Number.isFinite(method.timestamp)) {
        signInTime = Math.max(signInTime, method.timestamp * 1000);
      }
    }
  } catch { return respond(401, "Sign in required"); }
  if (!signInTime || Date.now() - signInTime > 5 * 60 * 1000 || signInTime > Date.now() + 60_000) {
    return respond(403, "Verify your email again before deleting your account");
  }
  // The request body cannot select a user. The verified bearer is the only identity used.
  // Cascading FKs remove learning state/activity and Auth removes sessions/identities.
  const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
  if (deletionError) return respond(503, "Account could not be deleted. Please retry");
  return respond(200, "Account and cloud learning data deleted");
});
