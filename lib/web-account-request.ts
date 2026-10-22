import type { WebAccount } from "./web-account";

export type AccountAction = "status" | "otp" | "verify" | "signout" | "reverify-otp" | "reverify";
export type AccountReply = Partial<WebAccount> & { sent?: boolean; signedOut?: boolean; reverified?: boolean };
const actions: readonly string[] = ["status", "otp", "verify", "signout", "reverify-otp", "reverify"];
const identityPattern = /^supabase:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = "Your account connection is unavailable. Reconnect to check sign-in; guest practice and backups remain available.";

export class WebAccountRequestError extends Error {
  constructor(message: string, readonly status: number, readonly requiresSignIn = false, readonly account: WebAccount | null = null) { super(message); }
}
export class WebAccountSaveError extends Error {
  constructor() { super("Save your current learning changes on this device before changing accounts. Your original account and records were kept."); }
}
export function accountMessage(error: unknown): string {
  return error instanceof TypeError || error instanceof SyntaxError ? unavailable : error instanceof Error ? error.message : unavailable;
}
export function accountFromReply(value: AccountReply): WebAccount {
  if (typeof value.enabled !== "boolean" || typeof value.emailReady !== "boolean" || !(value.identity === null || (typeof value.identity === "string" && identityPattern.test(value.identity))) || !(value.email === null || (typeof value.email === "string" && value.email.length <= 254))) throw new WebAccountRequestError("The account service returned an unsupported record. Reconnect to check sign-in.", 502);
  return { enabled: value.enabled, emailReady: value.emailReady, identity: value.identity, email: value.email };
}
/** Only account metadata reaches React. Provider sessions remain in HttpOnly cookies. */
export async function requestWebAccount(action: AccountAction, body?: unknown, fetcher: typeof fetch = fetch): Promise<AccountReply> {
  if (!actions.includes(action)) throw new WebAccountRequestError("Unsupported account action.", 400);
  const response = await fetcher(`/api/account/${action}`, { ...(action === "status" ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }), cache: "no-store", credentials: "same-origin" });
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new WebAccountRequestError("The account service returned an unsupported record. Reconnect to check sign-in.", 502);
  const record = raw as Record<string, unknown>;
  const value: AccountReply = {};
  if (typeof record.enabled === "boolean") value.enabled = record.enabled;
  if (typeof record.emailReady === "boolean") value.emailReady = record.emailReady;
  if (record.identity === null || (typeof record.identity === "string" && identityPattern.test(record.identity))) value.identity = record.identity;
  if (record.email === null || (typeof record.email === "string" && record.email.length <= 254)) value.email = record.email;
  for (const key of ["sent", "signedOut", "reverified"] as const) if (typeof record[key] === "boolean") value[key] = record[key];
  if (!response.ok) {
    let account: WebAccount | null = null;
    try { account = accountFromReply(value); } catch { /* An unverified failure must not manufacture configuration. */ }
    const message = typeof record.error === "string" && record.error.length <= 500 ? record.error : unavailable;
    throw new WebAccountRequestError(message, response.status, record.requiresSignIn === true, account);
  }
  if (["status", "verify", "reverify"].includes(action)) accountFromReply(value);
  return value;
}

type ReadResult<T> = { current: false } | { current: true; value: T } | { current: true; error: unknown };
type MutationResult<T> = { accepted: false } | { accepted: true; value: T };
/** A queue contains no learner data. Reserving a mutation invalidates older status reads synchronously. */
export function createAccountRequestSequence() {
  let tail: Promise<void> = Promise.resolve();
  let generation = 0;
  let busy = false;
  const listeners = new Set<(busy: boolean) => void>();
  const enqueue = <T,>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
  const notify = () => { for (const listener of listeners) listener(busy); };
  return {
    get busy() { return busy; },
    invalidate() { generation += 1; },
    subscribe(listener: (busy: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read<T>(work: () => Promise<T>): Promise<ReadResult<T>> {
      if (busy) return Promise.resolve({ current: false });
      const ticket = ++generation;
      return enqueue(async () => {
        if (ticket !== generation || busy) return { current: false };
        try { const value = await work(); return ticket === generation && !busy ? { current: true, value } : { current: false }; }
        catch (error) { return ticket === generation && !busy ? { current: true, error } : { current: false }; }
      });
    },
    mutate<T>(work: () => Promise<T>): Promise<MutationResult<T>> {
      if (busy) return Promise.resolve({ accepted: false });
      // This runs before the first await, including the durable learning-state barrier.
      busy = true; generation += 1; notify();
      return enqueue(async () => {
        try { return { accepted: true, value: await work() }; }
        finally { busy = false; notify(); }
      });
    },
  };
}
// Shared by mounts in this browser document; never stores an account, email, token or draft.
export const browserAccountRequests = createAccountRequestSequence();

/** A failed durable save prevents HTTP. Once drained, learning sync resumes even if auth fails. */
export async function performAccountTransition<T>({ before, request, after }: { before?: () => Promise<void>; request: () => Promise<T>; after?: () => Promise<void> }): Promise<{ value: T; reloadError?: unknown }> {
  try { await before?.(); } catch { throw new WebAccountSaveError(); }
  let value: T | undefined;
  let requestError: unknown;
  let failed = false;
  try { value = await request(); } catch (error) { requestError = error; failed = true; }
  let reloadError: unknown;
  try { await after?.(); } catch (error) { reloadError = error; }
  if (failed) throw requestError;
  return { value: value as T, ...(reloadError === undefined ? {} : { reloadError }) };
}
