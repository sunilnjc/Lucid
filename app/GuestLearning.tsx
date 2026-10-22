"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { professionalRoles, type RoleId } from "../lib/professional-content";
import { translateLearning, type LearningLocale } from "../lib/learning-locales";

export type GuestAccess = {
  active: boolean; cap: number; used: number; prompt: "save" | "limit" | null;
  legacyAvailable: boolean; sessionImportAvailable: boolean;
  requestAccount: (reason?: "save" | "limit") => boolean;
  getGuestPrompt: () => "save" | "limit" | null;
  canExploreItem: (fullKey: string) => boolean;
};
const GuestAccessContext = createContext<GuestAccess>({ active: false, cap: 5, used: 0, prompt: null, legacyAvailable: false, sessionImportAvailable: false, requestAccount: () => false, getGuestPrompt: () => null, canExploreItem: () => true });
export function GuestAccessProvider({ value, children }: { value: GuestAccess; children: ReactNode }) { return <GuestAccessContext.Provider value={value}>{children}</GuestAccessContext.Provider>; }
export function useGuestAccess() { return useContext(GuestAccessContext); }

const copy = {
  en: {
    eyebrow: "EXPLORE LUCID", heading: "Find language you want to use.", intro: "Browse words and idioms freely. Choose a role for a short practice session—no sign-in needed.", trial: "Try up to {cap} words or expressions in this tab’s temporary session. Sign in when you want to save.", library: "Browse all words", idioms: "Explore idioms", role: "Choose a role for practice", start: "Try guest practice", personalize: "Personalize my course", optional: "Personalization is optional. You can change your role later.",
    temporary: "Temporary guest session", count: "{used} of {cap} learning items tried", session: "Practice stays in this tab’s session. Sign in to save words and progress to your account; your guest work is not transferred automatically.", signIn: "Account options", old: "Earlier learning is still on this device. Download its original backup before choosing whether to import it into an account.", backup: "Download earlier local backup", saveTitle: "Save it to your own account", saveBody: "You can keep exploring without signing in. Sign in when you want to keep a word, review schedule or learning progress beyond this guest session.", limitTitle: "You’ve reached this session’s practice limit", limitBody: "This guest session includes {cap} different learning items. Revisit those items or keep browsing the dictionaries. Sign in when you want to continue learning and save your progress.", continue: "Keep browsing", account: "Sign in or create an account", preserved: "Existing local records stay separate. Importing them is always your choice."
  },
  ko: {
    eyebrow: "LUCID 둘러보기", heading: "사용하고 싶은 영어를 찾아보세요.", intro: "단어와 관용어를 자유롭게 둘러보세요. 짧은 학습을 해보고 싶을 때 직무를 선택하면 됩니다. 로그인은 필요하지 않아요.", trial: "이 탭의 임시 세션에서 단어나 표현을 최대 {cap}개 체험할 수 있어요. 저장하려면 로그인하세요.", library: "모든 단어 둘러보기", idioms: "관용어 둘러보기", role: "학습할 직무 선택", start: "게스트로 학습해 보기", personalize: "내 코스 맞춤 설정", optional: "맞춤 설정은 선택 사항이며 직무는 나중에 바꿀 수 있어요.",
    temporary: "임시 게스트 세션", count: "학습 항목 {cap}개 중 {used}개 체험", session: "학습 내용은 현재 탭의 세션에만 임시로 보관됩니다. 단어와 진도를 계정에 저장하려면 로그인하세요. 게스트 기록은 자동으로 옮겨지지 않습니다.", signIn: "계정 옵션", old: "이 기기의 이전 학습 기록은 그대로 보관되어 있어요. 계정으로 가져올지 선택하기 전에 원본 백업을 내려받을 수 있습니다.", backup: "이전 기기 기록 백업 내려받기", saveTitle: "내 계정에 저장하기", saveBody: "로그인하지 않아도 계속 둘러볼 수 있어요. 단어, 복습 일정, 학습 진도를 이번 게스트 세션 이후에도 보관하려면 로그인하세요.", limitTitle: "이번 세션의 학습 체험 한도에 도달했어요", limitBody: "게스트 세션에서는 서로 다른 학습 항목 {cap}개를 체험할 수 있어요. 체험한 항목을 다시 보거나 사전을 계속 둘러볼 수 있습니다. 더 학습하고 진도를 저장하려면 로그인하세요.", continue: "계속 둘러보기", account: "로그인 또는 계정 만들기", preserved: "기존 기기 기록은 따로 보관됩니다. 가져오기는 언제나 직접 선택할 수 있어요."
  }
} as const;
function fill(text: string, values: Record<string, number>) { return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? "")); }

export function GuestExploreStart({ language = "en", onBrowse, onStart, onPersonalize, practiceReady = true, cap = 5 }: { language?: LearningLocale; onBrowse: (view: "library" | "idioms") => void; onStart: (roleId: RoleId) => void; onPersonalize: () => void; practiceReady?: boolean; cap?: number }) {
  const c = copy[language];
  const [role, setRole] = useState<RoleId>(professionalRoles[0].id);
  return <section className="guest-explore-start" aria-labelledby="guest-explore-title" lang={language}>
    <span className="eyebrow">{c.eyebrow}</span><h1 id="guest-explore-title">{c.heading}</h1><p>{c.intro}</p><p className="muted">{fill(c.trial, { cap })}</p>
    <div className="button-row"><button className="primary-button" onClick={() => onBrowse("library")}>{c.library}</button><button className="secondary-button" onClick={() => onBrowse("idioms")}>{c.idioms}</button></div>
    <div className="guest-quick-start"><label htmlFor="guest-role">{c.role}</label><select id="guest-role" value={role} onChange={event => setRole(event.target.value as RoleId)}>{professionalRoles.map(item => <option key={item.id} value={item.id}>{translateLearning(language, item.label)}</option>)}</select><button className="primary-button" disabled={!practiceReady} onClick={() => onStart(role)}>{practiceReady ? c.start : language === "ko" ? "학습 세션 준비 중…" : "Preparing practice session…"}</button></div>
    <p className="muted">{c.optional}</p><button className="text-button" disabled={!practiceReady} onClick={onPersonalize}>{c.personalize}</button>
  </section>;
}

export function GuestSessionNotice({ language = "en", guest, onAccount, onLegacyBackup }: { language?: LearningLocale; guest: Pick<GuestAccess, "active" | "cap" | "used" | "legacyAvailable">; onAccount: () => void; onLegacyBackup?: () => void }) {
  const c = copy[language];
  if (!guest.active && !guest.legacyAvailable) return null;
  return <section className="guest-session-notice" aria-label={c.temporary} lang={language}>
    {guest.active && <><div><strong>{c.temporary}</strong><span role="status">{fill(c.count, { used: guest.used, cap: guest.cap })}</span></div><p>{c.session}</p><button className="secondary-button" onClick={onAccount}>{c.signIn}</button></>}
    {guest.legacyAvailable && onLegacyBackup && <div className="guest-legacy-preserved"><p>{c.old}</p><button className="text-button" onClick={onLegacyBackup}>{c.backup}</button></div>}
  </section>;
}

export function GuestAccountPrompt({ language = "en", reason, cap, onAccount, onDismiss }: { language?: LearningLocale; reason: "save" | "limit" | null; cap: number; onAccount: () => void; onDismiss: () => void }) {
  const c = copy[language];
  const panel = useRef<HTMLElement>(null); const previousFocus = useRef<HTMLElement | null>(null);
  const focusFrame = useRef<number | null>(null);
  const dismiss = useCallback(() => {
    if (focusFrame.current !== null) { window.cancelAnimationFrame(focusFrame.current); focusFrame.current = null; }
    onDismiss();
    const origin = previousFocus.current;
    if (!origin?.isConnected) return;
    if (!origin.matches("textarea[readonly], input[readonly]")) { origin.focus(); return; }
    // A readonly guest-limit field opens this prompt on focus. Return to its
    // adjacent reveal action, or another enabled card action, without reopening it.
    const next = origin.nextElementSibling;
    const adjacentAction = next instanceof HTMLElement && next.matches("button:not(:disabled)") ? next : next?.querySelector<HTMLElement>("button:not(:disabled)");
    const cardAction = origin.closest("article, section, form, main")?.querySelector<HTMLElement>("button:not(:disabled), a[href]");
    (adjacentAction ?? cardAction)?.focus();
  }, [onDismiss]);
  useEffect(() => {
    if (!reason) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !panel.current?.contains(active)) previousFocus.current = active;
    // React can flush a focus-triggered effect before the browser completes its
    // default focus action. The next frame lets the prompt receive focus last.
    const frame = window.requestAnimationFrame(() => { if (focusFrame.current === frame) { focusFrame.current = null; panel.current?.focus(); } });
    focusFrame.current = frame;
    return () => { window.cancelAnimationFrame(frame); if (focusFrame.current === frame) focusFrame.current = null; };
  }, [reason]);
  useEffect(() => {
    if (!reason) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [reason, dismiss]);
  if (!reason) return null;
  return <section className="guest-account-prompt" role="dialog" aria-labelledby="guest-account-prompt-title" aria-describedby="guest-account-prompt-description" tabIndex={-1} ref={panel} lang={language}>
    <h2 id="guest-account-prompt-title">{reason === "limit" ? c.limitTitle : c.saveTitle}</h2><p id="guest-account-prompt-description">{fill(reason === "limit" ? c.limitBody : c.saveBody, { cap })}</p><p className="muted">{c.preserved}</p><div className="button-row"><button className="primary-button" onClick={onAccount}>{c.account}</button><button className="secondary-button" onClick={dismiss}>{c.continue}</button></div>
  </section>;
}
