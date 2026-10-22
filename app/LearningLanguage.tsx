"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { translateLearning, LEARNING_LANGUAGE_STORAGE_KEY, type LearningLocale } from "../lib/learning-locales";

export const LEARNING_LANGUAGE_KEY = LEARNING_LANGUAGE_STORAGE_KEY;
type Parameters = Record<string, string | number>;
type LanguageContext = { locale: LearningLocale; t: (english: string, values?: Parameters) => string; setLocale: (locale: LearningLocale) => void; preferenceWarning: boolean };
const Language = createContext<LanguageContext>({ locale: "en", t: (key, values) => translateLearning("en", key, values), setLocale() {}, preferenceWarning: false });

/** This preference never enters learner/account state or a portable learning backup. */
export function readLearningLanguage(storage: Pick<Storage, "getItem">): LearningLocale {
  return storage.getItem(LEARNING_LANGUAGE_KEY) === "ko" ? "ko" : "en";
}
export function saveLearningLanguage(storage: Pick<Storage, "setItem">, locale: LearningLocale): void {
  storage.setItem(LEARNING_LANGUAGE_KEY, locale);
}

export function requestedLearningLanguage(href: string): LearningLocale | undefined {
  try { const value = new URL(href).searchParams.get("lang"); return value === "en" || value === "ko" ? value : undefined; }
  catch { return undefined; }
}
export function urlForLearningLanguage(href: string, locale: LearningLocale): string {
  const url = new URL(href); url.searchParams.set("lang", locale); return `${url.pathname}${url.search}${url.hash}`;
}

let visitLanguage: LearningLocale | undefined;
const LANGUAGE_EVENT = "lucid:learning-language";
function languageSnapshot(): LearningLocale {
  const requested = requestedLearningLanguage(window.location.href);
  if (requested) return requested;
  if (visitLanguage) return visitLanguage;
  try { return readLearningLanguage(window.localStorage); } catch { return "en"; }
}
function subscribeLanguage(change: () => void) {
  const followURL = () => {
    const requested = requestedLearningLanguage(window.location.href);
    if (requested) {
      visitLanguage = requested;
      try { saveLearningLanguage(window.localStorage, requested); } catch { /* The explicit choice remains usable for this visit. */ }
    }
    change();
  };
  followURL();
  const externalChange = (event: StorageEvent) => {
    if (event.key === LEARNING_LANGUAGE_KEY || event.key === null) { visitLanguage = undefined; change(); }
  };
  window.addEventListener("popstate", followURL);
  window.addEventListener("storage", externalChange);
  window.addEventListener(LANGUAGE_EVENT, change);
  return () => { window.removeEventListener("popstate", followURL); window.removeEventListener("storage", externalChange); window.removeEventListener(LANGUAGE_EVENT, change); };
}

export function LearningLanguageProvider({ children, initialLocale = "en" }: { children: ReactNode; initialLocale?: LearningLocale }) {
  // React uses this server snapshot for hydration, then reads the device preference.
  const locale = useSyncExternalStore(subscribeLanguage, languageSnapshot, () => initialLocale);
  const [preferenceWarning, setPreferenceWarning] = useState(false);
  const setLocale = useCallback((next: LearningLocale) => {
    visitLanguage = next;
    try { saveLearningLanguage(window.localStorage, next); setPreferenceWarning(false); }
    catch { setPreferenceWarning(true); }
    try { window.history.replaceState(window.history.state, "", urlForLearningLanguage(window.location.href, next)); } catch { /* Device preference still works if browser history is restricted. */ }
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, []);
  const value = useMemo<LanguageContext>(() => ({ locale, setLocale, preferenceWarning, t: (key, values) => translateLearning(locale, key, values) }), [locale, setLocale, preferenceWarning]);
  return <Language.Provider value={value}>{children}</Language.Provider>;
}

export function useLearningLanguage() { return useContext(Language); }

export function LearningLanguageChoice({ compact = false }: { compact?: boolean }) {
  const { locale, t, setLocale, preferenceWarning } = useLearningLanguage();
  return <div className={`learning-language ${compact ? "learning-language-compact" : ""}`}>
    <div role="group" aria-label={t("Learning language")}>
      <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button>
      <button type="button" lang="ko" aria-pressed={locale === "ko"} onClick={() => setLocale("ko")}>한국어</button>
    </div>
    {preferenceWarning && <small role="status">{t("Language changed for this visit. Your browser could not save the preference.")}</small>}
  </div>;
}

export function LearningCoverageNote() {
  const { locale, t } = useLearningLanguage();
  if (locale !== "ko") return null;
  return <p className="learning-coverage-note" lang="ko">{t("Korean support covers navigation, setup, daily words, idioms and review guidance. Course questions, Express, account controls, detailed settings, privacy and support remain in English.")}</p>;
}

export function EnglishLearningContentNotice() {
  const { locale, t } = useLearningLanguage();
  return locale === "ko" ? <p className="learning-content-notice" lang="ko">{t("This section’s learning content is in English. Your language choice does not change your course or progress.")}</p> : null;
}
