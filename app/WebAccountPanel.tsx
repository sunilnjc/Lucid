"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WebAccount } from "../lib/web-account";
import type { LearningLocale } from "../lib/learning-locales";
import { accountFromReply, accountMessage, browserAccountRequests, performAccountTransition, requestWebAccount, WebAccountRequestError, WebAccountSaveError, type AccountAction } from "../lib/web-account-request";

type Connection = "checking" | "ready" | "unavailable";
const busySnapshot = () => browserAccountRequests.busy;
const serverBusySnapshot = () => false;
const copy = {
  en: {
    heading: "Your learner account", intro: "Use the same verified email sign-in as Lucid mobile to keep your learning progress together.", guest: "Practise as a guest on this device, and export a backup when you want to move your learning.", checking: "Checking shared sign-in for this browser…", unavailable: "Reconnect to check shared sign-in. Guest practice and portable backups remain available.", retry: "Retry account connection", disabled: "Shared sign-in is disabled for this build. Guest practice and portable backups remain available.", signedIn: "Signed in as", learner: "verified learner", shared: "Course progress, learning evidence, authored saved phrasing and practice history use this account. Personal situations and sentences stay on this device.", signOut: "Sign out of this browser", signedOut: "Signed out of this browser. Your account cache and guest record stay separate.", mergeInfo: "You can explicitly merge this browser’s guest or earlier web learning record. This uses both verified storage identities and keeps the source record.", merge: "Merge earlier web progress into this account", merging: "Merging…", merged: "Earlier web progress was merged into this verified account. The original record is still available.", mergeFailed: "The merge could not be completed. Your original records were kept; check the connection and retry.", disclosure: "Sign-in shares your email with Lucid’s existing Supabase and email delivery service. It never joins accounts just because their email labels match.", email: "Email used in Lucid mobile", send: "Send sign-in code", resend: "Request another code", connecting: "Connecting…", emailDisabled: "Email sign-in is not enabled for this preview.", code: "Email sign-in code", verify: "Verify and sign in", sent: "A sign-in code was requested. Enter the code from your email.", success: "Signed in. Earlier web or guest work stays separate until you choose to merge it.", verifyAgain: "Verify this account again", reverifyInfo: "Request a fresh code for this signed-in account. Its verified email is selected by the server; this does not switch accounts.", reverifyCode: "Fresh code for this account", confirmReverify: "Verify this same account", reverifySent: "A fresh code was requested for this account’s verified email.", reverified: "This same learner account was verified again.", cancel: "Cancel code entry", expired: "Sign in again with an email code. Saved account records remain on this device and will only reopen after the account is verified.", mismatch: "The verified account and learning data are reconnecting. Wait or reconnect before merging progress.", reconnect: "Reconnect learning data", reconnected: "Learning-data reconnect was attempted. Check the learning connection status before continuing.", reloadFailed: "Your account request completed, but learning data could not reconnect. Reconnect learning data before continuing.", saveFirst: "Save your current learning changes on this device before changing accounts. Your original account and records were kept.", connectionUnavailable: "Your account connection is unavailable. Reconnect to check sign-in; guest practice and backups remain available.", accountChanged: "The learner account changed. Request a new code for the account shown here."
  },
  ko: {
    heading: "내 학습 계정", intro: "Lucid 모바일에서 사용하는 인증된 이메일로 로그인해 학습 진도를 함께 관리하세요.", guest: "이 기기에서 게스트로 학습하고, 학습 기록을 옮길 때 백업을 내보낼 수 있습니다.", checking: "이 브라우저의 로그인 상태를 확인하고 있어요…", unavailable: "연결을 복구해 로그인 상태를 확인하세요. 게스트 학습과 백업은 계속 사용할 수 있습니다.", retry: "계정 연결 다시 시도", disabled: "이 버전에서는 계정 로그인이 아직 활성화되지 않았습니다. 게스트 학습과 백업은 사용할 수 있습니다.", signedIn: "로그인한 계정:", learner: "인증된 학습자", shared: "코스 진도, 학습 기록, 저장한 표현은 이 계정에 저장됩니다. 개인 상황과 직접 쓴 문장은 이 기기에 보관됩니다.", signOut: "이 브라우저에서 로그아웃", signedOut: "이 브라우저에서 로그아웃했습니다. 계정 캐시와 게스트 기록은 따로 유지됩니다.", mergeInfo: "이 브라우저의 게스트 또는 이전 웹 학습 기록을 직접 선택해 합칠 수 있습니다. 두 저장 계정을 확인하며 원본 기록은 그대로 보관합니다.", merge: "이전 웹 학습 기록을 이 계정에 합치기", merging: "기록을 합치는 중…", merged: "이전 웹 학습 기록을 인증된 계정에 합쳤습니다. 원본 기록도 그대로 보관됩니다.", mergeFailed: "기록을 합치지 못했습니다. 원본 기록은 보존되었습니다. 연결을 확인한 뒤 다시 시도하세요.", disclosure: "로그인 시 이메일이 Lucid의 기존 Supabase 및 이메일 전송 서비스에 전달됩니다. 이메일 표시가 같다는 이유만으로 계정을 합치지 않습니다.", email: "Lucid 모바일에서 사용하는 이메일", send: "로그인 코드 보내기", resend: "코드 다시 요청", connecting: "연결 중…", emailDisabled: "이 미리보기에서는 이메일 로그인이 아직 활성화되지 않았습니다.", code: "이메일 로그인 코드", verify: "코드 확인 후 로그인", sent: "로그인 코드를 요청했습니다. 이메일로 받은 코드를 입력하세요.", success: "로그인했습니다. 직접 합치기를 선택하기 전까지 이전 웹·게스트 기록은 따로 유지됩니다.", verifyAgain: "이 계정 다시 인증", reverifyInfo: "현재 로그인한 계정으로 새 코드를 요청합니다. 서버에서 확인한 이메일로 보내며 다른 계정으로 전환하지 않습니다.", reverifyCode: "이 계정의 새 인증 코드", confirmReverify: "현재 계정 인증 확인", reverifySent: "현재 계정의 인증된 이메일로 새 코드를 요청했습니다.", reverified: "동일한 학습 계정을 다시 인증했습니다.", cancel: "코드 입력 취소", expired: "이메일 코드로 다시 로그인하세요. 저장된 계정 기록은 기기에 유지되며 계정 인증 후에만 다시 열립니다.", mismatch: "인증된 계정과 학습 기록을 다시 연결하고 있습니다. 기록을 합치기 전에 기다리거나 다시 연결하세요.", reconnect: "학습 기록 다시 연결", reconnected: "\ud559\uc2b5 \uae30\ub85d \uc5f0\uacb0\uc744 \ub2e4\uc2dc \uc2dc\ub3c4\ud588\uc2b5\ub2c8\ub2e4. \uacc4\uc18d\ud558\uae30 \uc804\uc5d0 \ud559\uc2b5 \uc5f0\uacb0 \uc0c1\ud0dc\ub97c \ud655\uc778\ud558\uc138\uc694.", reloadFailed: "계정 요청은 완료되었지만 학습 기록을 다시 연결하지 못했습니다. 계속하기 전에 학습 기록을 다시 연결하세요.", saveFirst: "계정을 변경하기 전에 이 기기의 현재 학습 내용을 저장하세요. 기존 계정과 기록은 그대로 보존되었습니다.", connectionUnavailable: "계정에 연결할 수 없습니다. 연결을 복구해 로그인 상태를 확인하세요. 게스트 학습과 백업은 사용할 수 있습니다.", accountChanged: "학습 계정이 변경되었습니다. 현재 표시된 계정의 코드를 새로 요청하세요."
  }
} as const;

export async function readAccountStatus(request: () => Promise<WebAccount>): Promise<{ connection: "ready"; account: WebAccount; message: string } | { connection: "unavailable"; message: string }> {
  try { return { connection: "ready", account: await request(), message: "" }; }
  catch (error) { return { connection: "unavailable", message: accountMessage(error) }; }
}
type IdentityCallbacks = { onIdentityWillChange?: () => Promise<void>; onIdentityChange?: () => Promise<void> };
export function useWebAccount(scopeKey = "pending", language: LearningLocale = "en", callbacks: IdentityCallbacks = {}) {
  const c = copy[language];
  const [account, setAccount] = useState<WebAccount>({ enabled: false, emailReady: false, identity: null, email: null });
  const [connection, setConnection] = useState<Connection>("checking");
  const busy = useSyncExternalStore(browserAccountRequests.subscribe, busySnapshot, serverBusySnapshot);
  const [message, setMessage] = useState("");
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [needsLearningReconnect, setNeedsLearningReconnect] = useState(false);
  const active = useRef(false);
  const refreshPending = useRef(false);
  const statusInFlight = useRef(false);
  const knownConfiguration = useRef(false);
  const failureMessage = useRef<string | null>(null);
  const describeError = useCallback((error: unknown) => error instanceof WebAccountSaveError ? c.saveFirst : error instanceof TypeError || error instanceof SyntaxError ? c.connectionUnavailable : accountMessage(error), [c]);
  const showFailure = useCallback((error: unknown, statusRequest = false) => {
    if (!active.current) return;
    if (error instanceof WebAccountRequestError && error.requiresSignIn) {
      setRequiresSignIn(true);
      if (error.account) { knownConfiguration.current = true; setAccount(error.account); setConnection("ready"); }
      else setConnection("unavailable");
    } else if (statusRequest) setConnection("unavailable");
    const text = describeError(error); failureMessage.current = error instanceof WebAccountSaveError ? null : text; setMessage(text);
  }, [describeError]);
  const refresh = useCallback(async () => {
    refreshPending.current = true;
    if (browserAccountRequests.busy) return;
    refreshPending.current = false;
    const result = await browserAccountRequests.read(async () => {
      statusInFlight.current = true;
      if (active.current) setConnection("checking");
      try { return accountFromReply(await requestWebAccount("status")); }
      finally { statusInFlight.current = false; }
    });
    if (!active.current || !result.current) return;
    if ("error" in result) { showFailure(result.error, true); return; }
    knownConfiguration.current = true; setAccount(result.value); setConnection("ready"); setRequiresSignIn(false);
    const previousFailure = failureMessage.current;
    if (previousFailure) setMessage((current) => current === previousFailure ? "" : current);
    failureMessage.current = null;
  }, [showFailure]);
  useEffect(() => {
    active.current = true;
    const unsubscribe = browserAccountRequests.subscribe((nextBusy) => {
      if (!active.current) return;
      if (!nextBusy && refreshPending.current) void refresh();
    });
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { active.current = false; unsubscribe(); window.removeEventListener("focus", focus); };
  }, [refresh]);
  useEffect(() => { browserAccountRequests.invalidate(); void refresh(); }, [scopeKey, refresh]);
  const exclusive = useCallback(async (work: () => Promise<boolean>) => {
    // A reserved action discards an older status result; replace it even if the save barrier rejects.
    if (connection === "checking" || statusInFlight.current) refreshPending.current = true;
    const result = await browserAccountRequests.mutate(async () => {
      if (active.current) { setMessage(""); failureMessage.current = null; }
      try { return await work(); } catch (error) { showFailure(error); return false; }
    });
    return result.accepted && result.value;
  }, [showFailure, connection]);
  const run = useCallback(async (action: Exclude<AccountAction, "status">, body?: unknown) => {
    let reloaded = true;
    const ok = await exclusive(async () => {
      const changesSession = action === "verify" || action === "signout" || action === "reverify" || action === "reverify-otp";
      const result = changesSession ? await performAccountTransition({ before: callbacks.onIdentityWillChange, request: () => requestWebAccount(action, body), after: callbacks.onIdentityChange }) : { value: await requestWebAccount(action, body) };
      if (!active.current) return true;
      if (action === "verify" || action === "reverify") { setAccount(accountFromReply(result.value)); knownConfiguration.current = true; setConnection("ready"); setRequiresSignIn(false); }
      else if (action === "signout") { setAccount((old) => ({ ...old, identity: null, email: null })); setRequiresSignIn(false); if (knownConfiguration.current) setConnection("ready"); }
      if ("reloadError" in result && result.reloadError !== undefined) { reloaded = false; setNeedsLearningReconnect(true); setMessage(c.reloadFailed); }
      else if (changesSession) setNeedsLearningReconnect(false);
      return true;
    });
    return { ok, reloaded };
  }, [callbacks.onIdentityWillChange, callbacks.onIdentityChange, exclusive, c]);
  return { account, connection, busy, message, setMessage, requiresSignIn, needsLearningReconnect, setNeedsLearningReconnect, run, refresh, exclusive };
}

type AccountPanelProps = IdentityCallbacks & { language?: LearningLocale; onDraftChange?: (dirty: boolean) => void; scopeKey: string; onIdentityChange: () => Promise<void>; onImportLegacy: (expectedSourceScope?: string, expectedDestinationScope?: string) => Promise<boolean> };
type CodeIntent = { kind: "signin"; email: string } | { kind: "reverify"; identity: string };
export default function WebAccountPanel({ scopeKey, language = "en", onIdentityChange, onIdentityWillChange, onImportLegacy, onDraftChange }: AccountPanelProps) {
  const c = copy[language];
  const { account, connection, busy, message, setMessage, requiresSignIn, needsLearningReconnect, setNeedsLearningReconnect, run, refresh, exclusive } = useWebAccount(scopeKey, language, { onIdentityWillChange, onIdentityChange });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [intent, setIntent] = useState<CodeIntent | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const priorScope = useRef<string | undefined>(undefined);
  const lastVerifiedEmail = useRef<string | null>(null);
  const previousScope = useRef(scopeKey);
  const previousIdentity = useRef<string | null>(null);
  const dirty = Boolean(email.trim() || code.trim() || intent || busy || importBusy);
  useEffect(() => { onDraftChange?.(dirty); }, [onDraftChange, dirty]);
  useEffect(() => () => { onDraftChange?.(false); }, [onDraftChange]);
  useEffect(() => {
    if (scopeKey !== "pending" && !scopeKey.startsWith("supabase:")) priorScope.current = scopeKey;
    if (previousScope.current !== scopeKey) { setCode(""); setIntent(null); previousScope.current = scopeKey; }
  }, [scopeKey]);
  useEffect(() => {
    if (account.identity) lastVerifiedEmail.current = account.email;
    if (previousIdentity.current !== account.identity) { setCode(""); setIntent(null); previousIdentity.current = account.identity; }
  }, [account.identity, account.email]);
  useEffect(() => { if (requiresSignIn && lastVerifiedEmail.current) setEmail((current) => current || lastVerifiedEmail.current || ""); }, [requiresSignIn]);
  const sendCode = async () => {
    const requestedEmail = email.trim();
    const { ok } = await run("otp", { email: requestedEmail });
    if (ok) { setIntent({ kind: "signin", email: requestedEmail }); setCode(""); setMessage(c.sent); }
  };
  const verify = async () => {
    if (intent?.kind !== "signin" || intent.email !== email.trim()) return;
    const { ok, reloaded } = await run("verify", { email: intent.email, code });
    if (ok) { setEmail(""); setCode(""); setIntent(null); if (reloaded) setMessage(c.success); }
  };
  const signOut = async () => {
    const { ok, reloaded } = await run("signout");
    if (ok) { setEmail(""); setCode(""); setIntent(null); if (reloaded) setMessage(c.signedOut); }
  };
  const sendReverification = async () => {
    const identity = account.identity;
    if (!identity) return;
    const { ok, reloaded } = await run("reverify-otp", { expectedIdentity: identity });
    if (ok) { setCode(""); setIntent({ kind: "reverify", identity }); if (reloaded) setMessage(c.reverifySent); }
  };
  const reverify = async () => {
    if (intent?.kind !== "reverify" || intent.identity !== account.identity) { setMessage(c.accountChanged); return; }
    const { ok, reloaded } = await run("reverify", { expectedIdentity: intent.identity, code });
    if (ok) { setCode(""); setIntent(null); if (reloaded) setMessage(c.reverified); }
  };
  const merge = () => exclusive(async () => {
    setImportBusy(true);
    try { const ok = await onImportLegacy(priorScope.current, scopeKey); setMessage(ok ? c.merged : c.mergeFailed); return ok; }
    finally { setImportBusy(false); }
  });
  const reconnect = () => exclusive(async () => {
    await performAccountTransition({ before: onIdentityWillChange, request: onIdentityChange });
    setNeedsLearningReconnect(false); setMessage(c.reconnected); return true;
  });
  const signedIn = connection === "ready" && Boolean(account.identity);
  const scopeMatches = Boolean(account.identity) && scopeKey === account.identity;
  const canSignOut = Boolean(account.identity) || requiresSignIn || scopeKey.startsWith("supabase:");
  const showSignIn = connection === "ready" && account.enabled && !account.identity;
  const validCode = /^[0-9]{6,10}$/.test(code);
  return <section className="web-account-panel" aria-labelledby="web-account-heading" aria-busy={busy} lang={language}>
    <div><h2 id="web-account-heading">{c.heading}</h2><p>{connection === "ready" && account.enabled ? c.intro : c.guest}</p></div>
    <div className="setting-fields">
      {connection !== "ready" && <><p>{connection === "checking" ? c.checking : c.unavailable}</p>{connection === "unavailable" && <button className="secondary-button" disabled={busy} onClick={() => void refresh()}>{c.retry}</button>}</>}
      {connection === "ready" && !account.enabled && <p>{c.disabled}</p>}
      {(needsLearningReconnect || (signedIn && !scopeMatches)) && <div className="backup-preview"><p>{needsLearningReconnect ? c.reloadFailed : c.mismatch}</p><button className="secondary-button" disabled={busy} onClick={() => void reconnect()}>{c.reconnect}</button></div>}
      {signedIn && <>
        <p>{c.signedIn} <strong>{account.email ?? c.learner}</strong></p><p>{c.shared}</p>
        <div className="backup-preview"><p>{c.reverifyInfo}</p><button className="secondary-button" disabled={busy || !account.emailReady} onClick={() => void sendReverification()}>{intent?.kind === "reverify" ? c.resend : c.verifyAgain}</button>
          {intent?.kind === "reverify" && intent.identity === account.identity && <><label htmlFor="shared-account-reverify-code">{c.reverifyCode}</label><input id="shared-account-reverify-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} /><button className="primary-button" disabled={busy || !validCode} onClick={() => void reverify()}>{c.confirmReverify}</button><button className="secondary-button" disabled={busy} onClick={() => { setIntent(null); setCode(""); }}>{c.cancel}</button></>}
        </div>
        <div className="backup-preview"><p>{c.mergeInfo}</p><button className="secondary-button" disabled={busy || !scopeMatches || needsLearningReconnect} onClick={() => void merge()}>{importBusy ? c.merging : c.merge}</button></div>
      </>}
      {showSignIn && <>
        {requiresSignIn && <p>{c.expired}</p>}<p>{c.disclosure}</p>
        <label htmlFor="shared-account-email">{c.email}</label><input id="shared-account-email" type="email" autoComplete="email" maxLength={254} value={email} disabled={busy} onChange={(event) => { setEmail(event.target.value); setIntent(null); setCode(""); }} />
        <button className="secondary-button" disabled={busy || !account.emailReady || !email.trim()} onClick={() => void sendCode()}>{busy ? c.connecting : intent?.kind === "signin" ? c.resend : c.send}</button>
        {!account.emailReady && <p>{c.emailDisabled}</p>}
        {intent?.kind === "signin" && <><label htmlFor="shared-account-code">{c.code}</label><input id="shared-account-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} /><button className="primary-button" disabled={busy || !validCode} onClick={() => void verify()}>{c.verify}</button></>}
      </>}
      {canSignOut && <button className="secondary-button" disabled={busy} onClick={() => void signOut()}>{c.signOut}</button>}
      {message && <p role="status">{message}</p>}
    </div>
  </section>;
}
