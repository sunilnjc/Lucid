"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WEB_STATE_VERSION, importPortableBackup, mergeWebStates, prepareWebState, toCloudWebState, type WebLearningState } from "./web-learning-state";
import { webToSharedCloudState, sharedCloudStateToWeb } from "./shared-learning-state";
import { mergeDailyVocabulary } from "./daily-vocabulary-state";
import { guestChangeDecision, guestLearningItems, normalizeGuestLearningCap } from "./guest-learning";
export type SyncStatus = "loading" | "saved" | "syncing" | "offline" | "error";
export type GuestPrompt = "save" | "limit";
export type GuestAccess = { active: boolean; cap: number; used: number; prompt: GuestPrompt | null; legacyAvailable: boolean; sessionImportAvailable: boolean };
export type SyncSnapshot<T extends { version: number }> = { state: WebLearningState<T>; ready: boolean; status: SyncStatus; error: string | null; scopeKey: string; guest?: GuestAccess };
class LocalSaveError extends Error {}
class LocalReadError extends Error {}
class SignInRequiredError extends Error {}
class AccountIdentityChangedError extends Error {}
type StorageAdapter = Pick<Storage, "getItem" | "setItem">;
type Options<T extends { version: number }> = { storage: StorageAdapter; fetch: typeof fetch; defaults: T; deviceId?: string; onChange?: (snapshot: SyncSnapshot<T>) => void; guestFirst?: boolean; sessionStorage?: StorageAdapter; guestCap?: number };
const CACHE_PREFIX = "lucid-learning-v3:";
const GUEST_SESSION_KEY = "lucid-guest-learning-session-v1";
function memoryStorage(): StorageAdapter {
  const entries = new Map<string, string>();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
}
/** Guest exploration can continue in memory when tab storage is unavailable. */
function temporaryStorage(adapter?: StorageAdapter): StorageAdapter {
  const memory = memoryStorage(), fallback = new Set<string>();
  return {
    getItem(key) {
      if (!adapter || fallback.has(key)) return memory.getItem(key);
      try { const value = adapter.getItem(key); if (value !== null) { memory.setItem(key, value); return value; } return memory.getItem(key); }
      catch { fallback.add(key); return memory.getItem(key); }
    },
    setItem(key, value) { memory.setItem(key, value); try { adapter?.setItem(key, value); fallback.delete(key); } catch { fallback.add(key); /* This tab's in-memory record remains available. */ } },
  };
}
export function createWebLearningSync<T extends { version: number }>(options: Options<T>) {
  let deviceId = options.deviceId ?? "";
  const session = temporaryStorage(options.sessionStorage);
  const guestCap = normalizeGuestLearningCap(options.guestCap);
  let guestState: WebLearningState<T> | null = null;
  let guestItems = new Set<string>();
  let guestPrompt: GuestPrompt | null = null;
  let generation = 0, disposed = false, initialized = false, revision = 0;
  let remoteRevision = 0;
  let accountChanging = false;
  let accountBoundary: Promise<void> | null = null;
  const requests = new Set<Promise<Response>>();
  function trackedFetch(url: string, init: RequestInit) {
    const promise = options.fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
    requests.add(promise);
    void promise.finally(() => requests.delete(promise)).catch(() => {});
    return promise;
  }
  let sharedBackend = false;
  let running: Promise<void> | null = null, retryRequested = false;
  let failedCandidate: { scopeKey: string; state: WebLearningState<T> } | null = null;
  let current: SyncSnapshot<T> = { state: prepareWebState(options.defaults, options.defaults), ready: false, status: "loading", error: null, scopeKey: "pending" };
  const publish = (patch: Partial<SyncSnapshot<T>>) => { current = { ...current, ...patch }; if (options.guestFirst) current.guest = guestAccess(); if (!disposed) options.onChange?.(snapshot()); };
  const snapshot = (): SyncSnapshot<T> => ({ ...current });
  const headers = () => ({ "x-lucid-device-id": deviceId, "Content-Type": "application/json" });
  const cacheKey = (scopeKey: string) => CACHE_PREFIX + encodeURIComponent(scopeKey);
  const isGuestScope = (scopeKey = current.scopeKey) => options.guestFirst === true && scopeKey !== "pending" && !scopeKey.startsWith("supabase:");
  function readGuestRecord(): { state: WebLearningState<T>; items: string[] } | null {
    const raw = session.getItem(GUEST_SESSION_KEY); if (!raw) return null;
    try {
      const value = JSON.parse(raw) as { version?: unknown; state?: unknown; items?: unknown };
      if (value.version !== 1 || !Array.isArray(value.items)) throw new Error("Unknown guest session");
      const state = prepareWebState(value.state, options.defaults);
      const items = value.items.filter((id): id is string => typeof id === "string" && id.length <= 261 && /^(word|idiom|expression):[a-zA-Z0-9][a-zA-Z0-9:._-]{0,249}$/.test(id));
      return { state, items: [...new Set([...items, ...guestLearningItems(state)])] };
    } catch { throw new LocalReadError("This tab’s temporary learning record is unreadable. Earlier saved device records were kept unchanged."); }
  }
  function legacyGuestBackup(): { name: string; content: string } | null {
    // Only the current browser's device record is exposed without account verification.
    try {
      const scoped = deviceId ? options.storage.getItem(cacheKey(`device:${deviceId}`)) : null;
      const content = scoped ?? options.storage.getItem("lucid-offline-state");
      return content === null ? null : { name: "lucid-earlier-device-learning.json", content };
    } catch { return null; }
  }
  function guestAccess(): GuestAccess {
    return { active: isGuestScope(), cap: guestCap, used: guestItems.size, prompt: guestPrompt, legacyAvailable: legacyGuestBackup() !== null, sessionImportAvailable: Boolean(guestState && guestItems.size) };
  }
  function requestAccount(reason: GuestPrompt = "save"): boolean {
    if (!options.guestFirst || !isGuestScope()) return false;
    guestPrompt = reason; publish({}); return false;
  }
  function dismissGuestPrompt() { guestPrompt = null; if (options.guestFirst) publish({}); }
  function getGuestPrompt(): GuestPrompt | null { return guestPrompt; }
  function canExploreItem(fullKey: string): boolean { return !isGuestScope() || guestItems.has(fullKey) || guestItems.size < guestCap; }
  function readDurable(scopeKey: string): WebLearningState<T> | null {
    const raw = options.storage.getItem(cacheKey(scopeKey));
    if (!raw) return null;
    try { return prepareWebState(JSON.parse(raw), options.defaults); }
    catch { throw new LocalReadError("This device’s saved learning record is unreadable. Lucid kept the original record unchanged; restore a valid backup to repair it."); }
  }
  function read(scopeKey: string): WebLearningState<T> | null { return isGuestScope(scopeKey) ? readGuestRecord()?.state ?? null : readDurable(scopeKey); }
  function persist(state: WebLearningState<T>, scopeKey = current.scopeKey) {
    if (isGuestScope(scopeKey)) {
      const items = [...new Set([...guestItems, ...guestLearningItems(state)])];
      session.setItem(GUEST_SESSION_KEY, JSON.stringify({ version: 1, state, items })); guestItems = new Set(items); guestState = state; return;
    }
    try { options.storage.setItem(cacheKey(scopeKey), JSON.stringify(state)); } catch { throw new LocalSaveError("Progress could not be saved on this device. Keep this page open and retry before continuing."); }
  }
  function selectGuest() {
    preserveFailedCandidate();
    const stored = readGuestRecord(); guestState = stored?.state ?? prepareWebState(options.defaults, options.defaults); guestItems = new Set(stored?.items ?? []);
    const scopeKey = `device:${deviceId}`;
    persist(guestState, scopeKey); sharedBackend = false; remoteRevision = 0; initialized = true; revision++;
    publish({ state: guestState, ready: true, scopeKey, status: "saved", error: null });
  }
  function preserveFailedCandidate() {
    const pending = failedCandidate;
    if (!pending) return;
    // The failed write belongs to its original verified scope, even if cookies changed elsewhere.
    persist(pending.state, pending.scopeKey);
    if (failedCandidate === pending) failedCandidate = null;
    if (current.scopeKey === pending.scopeKey) { revision++; publish({ state: pending.state }); }
  }
  function invalidateKnownAccountFailure(error: unknown): boolean {
    if (!(error instanceof SignInRequiredError || error instanceof AccountIdentityChangedError)) return false;
    // Invalidate only the visible identity. Original caches, candidates and guest sources stay scoped and untouched.
    initialized = false; sharedBackend = false; retryRequested = false; generation++;
    publish({ state: prepareWebState(options.defaults, options.defaults), ready: true, scopeKey: "pending", status: "error", error: error.message });
    return true;
  }
  function pendingSaveMessage() { return "Save your pending learning changes before changing account. Keep this page open, retry saving, then try again."; }
  function validIdentity(value: unknown): value is string { return typeof value === "string" && value.length <= 250 && (value.startsWith("user:") && value.length > 5 || /^supabase:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) || value === `device:${deviceId}`); }
  async function getRemote(legacy = false) {
    const response = await trackedFetch("/api/state", { headers: { ...headers(), ...(legacy ? { "x-lucid-state-source": "legacy" } : {}) }, credentials: "same-origin", cache: "no-store" });
    if (response.status === 401 || response.status === 403) throw new SignInRequiredError("Sign in again to reconnect this learner account. Your local record stays separate and has not been uploaded.");
    if (!response.ok) throw new Error("Unable to connect to your learning storage.");
    const body = await response.json() as { identity?: unknown; state?: unknown; sharedState?: unknown; revision?: unknown };
    if (!validIdentity(body.identity)) throw new Error("Learning storage needs an updated identity-aware server.");
    const shared = body.identity.startsWith("supabase:");
    if (shared && (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0)) throw new Error("Shared learning storage returned an invalid revision.");
    return { identity: body.identity, state: body.state === null || body.state === undefined ? null : prepareWebState(body.state, options.defaults), shared, sharedState: body.sharedState ?? null, revision: Number(body.revision) || 0 };
  }
  type Remote = Awaited<ReturnType<typeof getRemote>>;
  function remoteState(remote: Remote, local?: WebLearningState<T>): WebLearningState<T> | null {
    if (!remote.shared) return remote.state;
    return remote.sharedState === null ? null : sharedCloudStateToWeb(remote.sharedState, local ?? prepareWebState(options.defaults, options.defaults), options.defaults) as WebLearningState<T>;
  }
  function selectScope(response: Remote) {
    if (options.guestFirst && !response.shared) { selectGuest(); return; }
    preserveFailedCandidate(); guestPrompt = null;
    const scopeKey = response.identity;
    const saved = read(scopeKey);
    const remote = remoteState(response, saved ?? undefined);
    let local = saved ?? prepareWebState(options.defaults, options.defaults);
    let hasLocal = saved !== null;
    // Legacy cache migration is allowed only after the server confirms this guest device.
    if (!saved && scopeKey === `device:${deviceId}`) {
      const raw = options.storage.getItem("lucid-offline-state");
      if (raw) { try { local = prepareWebState(JSON.parse(raw), options.defaults); hasLocal = true; } catch { /* Preserve the original legacy bytes. */ } }
    }
    const state = remote ? response.shared ? remote : hasLocal ? mergeWebStates(local, remote, options.defaults) : prepareWebState(remote, options.defaults) : local;
    persist(state, scopeKey); remoteRevision = response.revision; sharedBackend = response.shared; initialized = true; revision++;
    publish({ state, ready: true, scopeKey, status: "saved", error: null });
  }
  async function load() {
    if (disposed || accountChanging) return;
    try { preserveFailedCandidate(); }
    catch { initialized = false; publish({ ready: true, status: "error", error: pendingSaveMessage() }); return; }
    const token = ++generation;
    publish({ ready: false, status: "loading", error: null });
    try {
      deviceId = deviceId || options.storage.getItem("lucid-device-id") || crypto.randomUUID();
      if (!/^[a-zA-Z0-9-]{8,80}$/.test(deviceId)) throw new Error("The local device identifier is invalid.");
      options.storage.setItem("lucid-device-id", deviceId);
    } catch {
      if (options.guestFirst) {
        deviceId = session.getItem("lucid-guest-device-id") ?? crypto.randomUUID();
        if (!/^[a-zA-Z0-9-]{8,80}$/.test(deviceId)) deviceId = crypto.randomUUID();
        session.setItem("lucid-guest-device-id", deviceId);
      } else { publish({ ready: true, status: "error", error: "Lucid cannot save on this device. Free storage or enable browser storage, then retry." }); return; }
    }
    if (options.guestFirst) {
      try { const stored = readGuestRecord(); guestState = stored?.state ?? null; guestItems = new Set(stored?.items ?? []); }
      catch { guestState = null; guestItems = new Set(); /* A damaged guest session must not block a verified account from opening. */ }
    }
    let confirmed: Remote | null = null;
    try {
      const remote = await getRemote(); if (disposed || token !== generation) return;
      confirmed = options.guestFirst && !remote.shared ? null : remote; selectScope(remote);
      const cloud = remoteState(remote);
      if (options.guestFirst && !remote.shared) return;
      if (cloud === null || JSON.stringify(remote.shared ? webToSharedCloudState(current.state) : toCloudWebState(current.state)) !== JSON.stringify(remote.shared ? webToSharedCloudState(cloud) : toCloudWebState(cloud))) void retrySync();
    } catch (error) {
      if (disposed || token !== generation) return;
      if (options.guestFirst && !confirmed) { try { selectGuest(); } catch (storageError) { initialized = false; publish({ ready: true, status: "error", error: storageError instanceof Error ? storageError.message : "Unable to open this temporary session." }); } return; }
      if (error instanceof SignInRequiredError) { initialized = false; publish({ state: prepareWebState(options.defaults, options.defaults), ready: true, scopeKey: "pending", status: "error", error: error.message }); return; }
      if (confirmed && (error instanceof LocalReadError || error instanceof LocalSaveError)) { initialized = false; publish({ state: confirmed.state ?? prepareWebState(options.defaults, options.defaults), ready: true, scopeKey: confirmed.identity, status: "error", error: error.message }); return; }
      try {
        const scopeKey = `device:${deviceId}`;
        // Offline startup never opens a cached account under an unverified identity.
        const state = read(scopeKey) ?? prepareWebState(options.defaults, options.defaults);
        initialized = true; publish({ state, ready: true, scopeKey, status: "offline", error: error instanceof Error ? error.message : "Offline; progress stays on this device." });
      } catch (storageError) { initialized = false; publish({ ready: true, status: "error", error: storageError instanceof Error ? storageError.message : "Unable to read local progress." }); }
    }
  }
  function commit(next: WebLearningState<T> | ((state: WebLearningState<T>) => WebLearningState<T>), expectedScopeKey = current.scopeKey): boolean {
    if (disposed || accountChanging || !initialized || !current.ready || expectedScopeKey !== current.scopeKey) return false;
    let candidate: WebLearningState<T> | null = null;
    try {
      // Continue edits from the same scope's unsaved draft rather than silently dropping it.
      if (failedCandidate && failedCandidate.scopeKey !== current.scopeKey) preserveFailedCandidate();
      if (failedCandidate && typeof next !== "function") throw new LocalSaveError("Retry saving your pending changes before replacing the learning record.");
      const base = failedCandidate?.scopeKey === current.scopeKey ? failedCandidate.state : current.state;
      const value = typeof next === "function" ? next(base) : next;
      if (value === base) return false;
      candidate = prepareWebState(value, options.defaults);
      if (isGuestScope()) {
        const decision = guestChangeDecision(base, candidate, guestCap);
        const candidateItems = guestLearningItems(candidate), added = candidateItems.filter((id) => !guestItems.has(id));
        const used = new Set([...guestItems, ...candidateItems]).size;
        if (decision.reason === "save") { candidate = null; return requestAccount("save"); }
        if (added.length && used > guestCap) { candidate = null; return requestAccount("limit"); }
      }
      // Reject stale UI scope before computing its updater; persist before any learning advance.
      candidate.learningV3.updatedAt = new Date().toISOString();
      persist(candidate); failedCandidate = null; revision++;
      publish({ state: candidate, status: "saved", error: null }); if (!isGuestScope()) void retrySync(); return true;
    } catch (error) {
      // Preserve the draft in memory for retry without committing evidence or navigation.
      if (candidate) failedCandidate = { scopeKey: current.scopeKey, state: candidate };
      publish({ status: "error", error: error instanceof Error && (error instanceof LocalSaveError || /invalid|newer|migrate/i.test(error.message)) ? error.message : "Progress could not be saved on this device. Keep this page open and retry before continuing." }); return false;
    }
  }
  async function performSync(token: number) {
    if (!initialized || disposed) return;
    if (isGuestScope()) {
      let confirmed: Remote | null = null;
      try {
        const remote = await getRemote(); if (disposed || token !== generation) return;
        if (remote.shared) { confirmed = remote; selectScope(remote); generation++; retryRequested = true; }
      } catch (error) {
        if (confirmed && !disposed && token === generation) {
          initialized = false;
          publish({ state: prepareWebState(options.defaults, options.defaults), ready: true, scopeKey: confirmed.identity, status: "error", error: error instanceof Error ? error.message : "This account's local storage is unavailable." });
        }
        // An unidentified/offline visitor can keep exploring this temporary session.
      }
      return;
    }
    publish({ status: "syncing", error: null });
    try {
      preserveFailedCandidate();
      const remote = await getRemote(); if (disposed || token !== generation) return;
      if (remote.identity !== current.scopeKey) {
        // Account changes invalidate in-flight actions. Never merge across identities.
        selectScope(remote); generation++; retryRequested = true; return;
      }
      remoteRevision = remote.revision; sharedBackend = remote.shared;
      const downloaded = remoteState(remote, current.state);
      let state = downloaded ? remote.shared ? downloaded : mergeWebStates(current.state, downloaded, options.defaults) : current.state;
      persist(state); publish({ state }); const sentRevision = revision;
      const response = await trackedFetch("/api/state", { method: "PUT", headers: headers(), cache: "no-store", credentials: "same-origin", body: JSON.stringify(sharedBackend ? { scopeKey: current.scopeKey, expectedRevision: remoteRevision, sharedState: webToSharedCloudState(state) } : { scopeKey: current.scopeKey, state: toCloudWebState(state) }) });
      if (!response.ok) {
        if (response.status === 409) { const conflict = await response.json() as { identity?: unknown }; if (validIdentity(conflict.identity) && conflict.identity !== current.scopeKey) { const fresh = await getRemote(); if (disposed || token !== generation) return; selectScope(fresh); generation++; retryRequested = true; return; } }
        if (response.status === 401 || response.status === 403) throw new SignInRequiredError("Sign in again to reconnect this learner account. Your local changes have not been uploaded.");
        if (response.status === 409) retryRequested = true;
        throw new Error(response.status === 409 ? "Another device saved first. Retry to merge both records." : "Unable to sync your learning storage.");
      }
      const body = await response.json() as { identity?: unknown; state?: unknown; sharedState?: unknown; revision?: unknown };
      if (disposed || token !== generation) return;
      if (body.identity !== current.scopeKey) { if (!validIdentity(body.identity)) throw new Error("The learning identity changed. Reload before continuing."); selectScope({ identity: body.identity, state: body.state ? prepareWebState(body.state, options.defaults) : null, shared: body.identity.startsWith("supabase:"), sharedState: body.sharedState ?? null, revision: Number(body.revision) || 0 }); generation++; retryRequested = true; return; }
      if (sharedBackend && (!Number.isSafeInteger(body.revision) || Number(body.revision) < remoteRevision)) throw new Error("Shared learning storage returned an invalid save revision.");
      remoteRevision = Number(body.revision) || 0;
      const savedState = sharedBackend ? body.sharedState ? sharedCloudStateToWeb(body.sharedState, current.state, options.defaults) as WebLearningState<T> : null : body.state ? prepareWebState(body.state, options.defaults) : null;
      state = savedState ? sharedBackend ? savedState : mergeWebStates(current.state, savedState, options.defaults) : current.state;
      persist(state); publish({ state, status: "saved", error: null });
      if (revision !== sentRevision) retryRequested = true;
    } catch (error) {
      if (!disposed && token === generation) {
        if (options.guestFirst && error instanceof SignInRequiredError) {
          try { selectGuest(); } catch (storageError) { initialized = false; publish({ state: prepareWebState(options.defaults, options.defaults), ready: true, scopeKey: "pending", status: "error", error: storageError instanceof Error ? storageError.message : "Unable to open this temporary session." }); }
          return;
        }
        if (error instanceof SignInRequiredError) initialized = false;
        publish({ status: error instanceof LocalSaveError || error instanceof SignInRequiredError ? "error" : "offline", error: error instanceof Error ? error.message : "Offline; progress stays on this device." });
      }
    }
  }
  function retrySync(): Promise<void> {
    if (disposed || accountChanging) return Promise.resolve();
    if (!initialized) return load();
    if (running) { retryRequested = true; return running; }
    running = (async () => {
      let attempts = 0;
      do { retryRequested = false; await performSync(generation); attempts++; } while (retryRequested && !disposed && attempts < 5);
    })().finally(() => { running = null; });
    return running;
  }
  async function recoverFromBackup(value: unknown, restoreProfile = false, expectedScopeKey = current.scopeKey): Promise<boolean> {
    if (disposed || accountChanging) return false;
    if (isGuestScope()) return requestAccount("save");
    try { preserveFailedCandidate(); }
    catch { publish({ ready: true, status: "error", error: pendingSaveMessage() }); return false; }
    const token = ++generation;
    const prior = current, wasInitialized = initialized, priorCandidate = failedCandidate;
    initialized = false; retryRequested = false;
    publish({ ready: false, status: "loading", error: null });
    try {
      const remote = await getRemote(); if (disposed || token !== generation) return false;
      if (options.guestFirst && !remote.shared) throw new SignInRequiredError("Sign in before saving a learning backup. Your original backup remains unchanged.");
      if (expectedScopeKey !== "pending" && expectedScopeKey !== remote.identity) {
        publish({ state: remoteState(remote) ?? prepareWebState(options.defaults, options.defaults), scopeKey: remote.identity, ready: true, status: "error", error: "The account changed before recovery. Review the current account and choose Restore again." });
        return false;
      }
      const key = cacheKey(remote.identity), original = options.storage.getItem(key);
      let base = remoteState(remote, prior.scopeKey === remote.identity ? prior.state : undefined) ?? prepareWebState(options.defaults, options.defaults);
      remoteRevision = remote.revision; sharedBackend = remote.shared;
      if (original) {
        let parsed: unknown;
        try { parsed = JSON.parse(original); } catch { /* Malformed current records may be repaired after archival. */ }
        if (parsed && typeof parsed === "object") {
          const future = parsed as { version?: unknown; learningV3?: { version?: unknown; dailyVocabulary?: { version?: unknown } } };
          if (typeof future.version === "number" && future.version > WEB_STATE_VERSION || typeof future.learningV3?.version === "number" && future.learningV3.version > WEB_STATE_VERSION || typeof future.learningV3?.dailyVocabulary?.version === "number" && future.learningV3.dailyVocabulary.version > 1) throw new Error("This saved record requires a newer version of Lucid. Update Lucid before restoring a backup; the record was kept unchanged.");
        }
        try { base = mergeWebStates(prepareWebState(parsed, options.defaults), base, options.defaults); } catch { /* Archive malformed current-version bytes below before repair. */ }
      }
      else if (prior.scopeKey === remote.identity) base = mergeWebStates(prior.state, base, options.defaults);
      const restored = importPortableBackup(value, base, options.defaults, restoreProfile);
      restored.learningV3.updatedAt = new Date().toISOString();
      if (original !== null) options.storage.setItem(`${key}:recovery:${Date.now()}:${crypto.randomUUID()}`, original);
      // A failed archive or replacement leaves the original cache untouched.
      persist(restored, remote.identity); failedCandidate = null; initialized = true; revision++;
      publish({ state: restored, scopeKey: remote.identity, ready: true, status: "saved", error: null });
      void retrySync(); return true;
    } catch (error) {
      if (disposed || token !== generation) return false;
      if (invalidateKnownAccountFailure(error)) return false;
      initialized = wasInitialized; failedCandidate = priorCandidate;
      publish({ ...prior, ready: true, status: "error", error: error instanceof Error ? error.message : "The backup could not be restored. Existing records were kept unchanged." });
      return false;
    }
  }
  async function importLegacyProgress(expectedSourceScope?: string, expectedDestinationScope = current.scopeKey): Promise<boolean> {
    const destination = current.scopeKey;
    if (disposed || accountChanging || expectedDestinationScope !== destination || !destination.startsWith("supabase:") || !initialized) return false;
    try { preserveFailedCandidate(); }
    catch { publish({ ready: true, status: "error", error: pendingSaveMessage() }); return false; }
    const token = ++generation;
    publish({ ready: false, status: "loading", error: null });
    try {
      const account = await getRemote(); if (disposed || token !== generation) return false;
      if (!account.shared || account.identity !== destination) throw new AccountIdentityChangedError("The learner account changed before import. Sign in again and retry.");
      let legacy: Remote;
      try { legacy = await getRemote(true); }
      catch (error) {
        if (!(error instanceof SignInRequiredError)) throw error;
        // A legacy-source denial alone does not revoke the separately verified destination account.
        const check = await getRemote(); if (disposed || token !== generation) return false;
        if (!check.shared || check.identity !== destination) throw new AccountIdentityChangedError("The learner account changed before import. Sign in again and retry.");
        throw new Error("The earlier web record could not be verified. Your current account and source records were kept unchanged.");
      }
      if (disposed || token !== generation) return false;
      if (legacy.shared || expectedSourceScope && legacy.identity !== expectedSourceScope) throw new Error("The earlier web identity changed before import. Your source records were kept unchanged.");
      let saved = readDurable(legacy.identity);
      if (!saved && options.guestFirst && legacy.identity === `device:${deviceId}`) {
        const raw = options.storage.getItem("lucid-offline-state");
        if (raw !== null) saved = prepareWebState(JSON.parse(raw), options.defaults);
      }
      const source = legacy.state ? saved ? mergeWebStates(saved, legacy.state, options.defaults) : legacy.state : saved;
      if (!source) throw new Error("There is no earlier web progress for this verified browser identity.");
      // Use the canonical shared projection; raw guest writing never crosses the account boundary.
      const destinationState = remoteState(account, current.state) ?? current.state;
      const imported = sharedCloudStateToWeb(webToSharedCloudState(source), destinationState, options.defaults) as WebLearningState<T>;
      const check = await getRemote(); if (disposed || token !== generation) return false;
      if (!check.shared || check.identity !== destination) throw new AccountIdentityChangedError("The learner account changed during import. The merge was not saved.");
      remoteRevision = check.revision; sharedBackend = true;
      const merged = remoteState(check, imported) ?? imported;
      persist(merged, destination); revision++; failedCandidate = null;
      publish({ state: merged, ready: true, status: "saved", error: null }); void retrySync(); return true;
    } catch (error) {
      if (!disposed && token === generation && !invalidateKnownAccountFailure(error)) publish({ ready: true, status: "error", error: error instanceof Error ? error.message : "The source records were kept unchanged." });
      return false;
    }
  }
  async function importGuestSession(expectedDestinationScope = current.scopeKey): Promise<boolean> {
    const destination = current.scopeKey;
    if (!options.guestFirst || disposed || accountChanging || !initialized || expectedDestinationScope !== destination || !destination.startsWith("supabase:")) return false;
    try { preserveFailedCandidate(); } catch { publish({ ready: true, status: "error", error: pendingSaveMessage() }); return false; }
    const token = ++generation;
    publish({ ready: false, status: "loading", error: null });
    try {
      const sourceBytes = session.getItem(GUEST_SESSION_KEY);
      const source = readGuestRecord()?.state;
      if (!source) throw new Error("There is no temporary guest session to import.");
      const account = await getRemote(); if (disposed || token !== generation) return false;
      if (!account.shared || account.identity !== destination) throw new AccountIdentityChangedError("The learner account changed before import. Your guest session was kept unchanged.");
      const safe = prepareWebState(source, options.defaults);
      // Explicit import saves tried professional words as bookmarks, never as mastery.
      const tried = guestLearningItems(source).filter((id) => id.startsWith("word:")).map((id) => id.slice(5));
      const at = new Date().toISOString();
      const row = safe as WebLearningState<T> & { favouriteIds?: string[] };
      row.favouriteIds = [...new Set([...(row.favouriteIds ?? []), ...tried])];
      for (const id of tried) safe.learningV3.favouriteChanges[id] = { selected: true, updatedAt: at };
      let imported = sharedCloudStateToWeb(webToSharedCloudState(safe), remoteState(account, current.state) ?? current.state, options.defaults) as WebLearningState<T>;
      // Daily exploration is account-local metadata; raw guest writing stays in its source session.
      if (source.learningV3.dailyVocabulary) {
        const daily = JSON.parse(JSON.stringify(source.learningV3.dailyVocabulary)) as NonNullable<typeof source.learningV3.dailyVocabulary>;
        for (const collection of Object.values(daily.collections)) collection.drafts = {};
        for (const practice of Object.values(daily.idiomPractice)) { practice.draft = ""; if (practice.originalResponse !== undefined) practice.originalResponse = ""; }
        imported.learningV3.dailyVocabulary = mergeDailyVocabulary(imported.learningV3.dailyVocabulary, daily);
      }
      const check = await getRemote(); if (disposed || token !== generation) return false;
      if (!check.shared || check.identity !== destination) throw new AccountIdentityChangedError("The learner account changed during import. Your guest session was kept unchanged.");
      if (session.getItem(GUEST_SESSION_KEY) !== sourceBytes) throw new Error("The guest session changed during import. Review it and choose Import again.");
      remoteRevision = check.revision; sharedBackend = true;
      imported = remoteState(check, imported) ?? imported;
      persist(imported, destination); revision++; failedCandidate = null;
      publish({ state: imported, ready: true, status: "saved", error: null }); void retrySync(); return true;
    } catch (error) {
      if (!disposed && token === generation && !invalidateKnownAccountFailure(error)) publish({ ready: true, status: "error", error: error instanceof Error ? error.message : "The guest session could not be imported. Its original record was kept unchanged." });
      return false;
    }
  }
  function suspendForAccountChange(): Promise<void> {
    if (disposed) return Promise.reject(new Error("This learning session is no longer active."));
    if (accountBoundary) return accountBoundary;
    const wasInitialized = initialized;
    accountChanging = true; generation++; initialized = false; retryRequested = false;
    publish({ ready: false, status: "loading", error: null });
    accountBoundary = (async () => {
      // Drain prior cookie-refresh responses and their sync continuations before mutating identity.
      await Promise.allSettled([...requests, ...(running ? [running] : [])]);
      try { preserveFailedCandidate(); }
      catch {
        accountChanging = false; accountBoundary = null; initialized = wasInitialized;
        const message = pendingSaveMessage();
        publish({ ready: true, status: "error", error: message });
        throw new LocalSaveError(message);
      }
    })();
    return accountBoundary;
  }
  function refreshIdentity() { accountChanging = false; accountBoundary = null; return load(); }
  function dispose() { disposed = true; generation++; }
  return { load, commit, retrySync, recoverFromBackup, refreshIdentity, suspendForAccountChange, importLegacyProgress, importGuestSession, requestAccount, dismissGuestPrompt, getGuestPrompt, canExploreItem, legacyGuestBackup, dispose, snapshot };
}
export function useWebLearningState<T extends { version: number }>(defaults: T, guestCap?: number) {
  const [snapshot, setSnapshot] = useState<SyncSnapshot<T>>(() => ({ state: prepareWebState(defaults, defaults), ready: false, status: "loading", error: null, scopeKey: "pending" }));
  const controller = useRef<ReturnType<typeof createWebLearningSync<T>> | null>(null);
  useEffect(() => {
    let storage: StorageAdapter;
    try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new LocalSaveError("Device storage is unavailable."); } }; }
    let sessionStorage: StorageAdapter | undefined;
    try { sessionStorage = window.sessionStorage; } catch { /* Guest exploration falls back to memory. */ }
    const instance = createWebLearningSync({ storage, sessionStorage, guestFirst: true, guestCap, fetch: window.fetch.bind(window), defaults, onChange: setSnapshot });
    controller.current = instance; void instance.load();
    const reconnect = () => { void instance.retrySync(); };
    window.addEventListener("online", reconnect); window.addEventListener("focus", reconnect);
    const timer = window.setInterval(reconnect, 60_000);
    return () => { instance.dispose(); controller.current = null; window.removeEventListener("online", reconnect); window.removeEventListener("focus", reconnect); window.clearInterval(timer); };
  }, [defaults, guestCap]);
  const commit = useCallback((next: WebLearningState<T> | ((state: WebLearningState<T>) => WebLearningState<T>), expectedScopeKey?: string) => controller.current?.commit(next, expectedScopeKey) ?? false, []);
  const retrySync = useCallback(() => controller.current?.retrySync() ?? Promise.resolve(), []);
  const recoverFromBackup = useCallback((value: unknown, restoreProfile = false, expectedScopeKey?: string) => controller.current?.recoverFromBackup(value, restoreProfile, expectedScopeKey) ?? Promise.resolve(false), []);
  const refreshIdentity = useCallback(() => controller.current?.refreshIdentity() ?? Promise.resolve(), []);
  const suspendForAccountChange = useCallback(() => controller.current?.suspendForAccountChange() ?? Promise.resolve(), []);
  const importLegacyProgress = useCallback((expectedSourceScope?: string, expectedDestinationScope?: string) => controller.current?.importLegacyProgress(expectedSourceScope, expectedDestinationScope) ?? Promise.resolve(false), []);
  const requestAccount = useCallback((reason: GuestPrompt = "save") => controller.current?.requestAccount(reason) ?? false, []);
  const dismissGuestPrompt = useCallback(() => controller.current?.dismissGuestPrompt(), []);
  const getGuestPrompt = useCallback(() => controller.current?.getGuestPrompt() ?? null, []);
  const canExploreItem = useCallback((fullKey: string) => controller.current?.canExploreItem(fullKey) ?? true, []);
  const importGuestSession = useCallback((expectedDestinationScope?: string) => controller.current?.importGuestSession(expectedDestinationScope) ?? Promise.resolve(false), []);
  const legacyGuestBackup = useCallback(() => controller.current?.legacyGuestBackup() ?? null, []);
  return { ...snapshot, commit, retrySync, recoverFromBackup, refreshIdentity, suspendForAccountChange, importLegacyProgress, importGuestSession, requestAccount, dismissGuestPrompt, getGuestPrompt, canExploreItem, legacyGuestBackup };
}
