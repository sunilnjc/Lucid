"use client";

import { useLearningLanguage, LearningLanguageProvider, LearningLanguageChoice, LearningCoverageNote, EnglishLearningContentNotice } from "./LearningLanguage";
import { koreanWordSupport } from "../lib/learning-locales";

import { useCallback, useEffect, useRef, useState } from "react";
import { communicationGoals, professionalLearningPaths, professionalRoles, professionalWords, seniorityLevels, type GoalId, type ProfessionalWord, type RoleId, type SeniorityId, type SituationId } from "../lib/professional-content";
import { SRS_INTERVAL_DAYS, type ReviewQuality } from "../lib/learning-engine";
import { allWords } from "../lib/vocabulary-data";
import { dailyIdioms } from "../lib/daily-idioms";
import { dictionaryPage } from "../lib/list-pagination";
import { contextEvidenceKey, exportPortableBackup, importPortableBackup, makeReviewEvidence, prepareWebState } from "../lib/web-learning-state";
import { useWebLearningState } from "../lib/web-learning-sync";
import ExpressionPractice from "./ExpressionPractice";
import DailyVocabulary, { DailyIdiomReviewSection, IdiomCollection, DictionaryPagination } from "./DailyVocabulary";
import WebAccountPanel from "./WebAccountPanel";
import PWAInstall from "./PWAInstall";
import { GuestAccessProvider, GuestExploreStart, GuestSessionNotice, GuestAccountPrompt, useGuestAccess } from "./GuestLearning";
export { GuestExploreStart } from "./GuestLearning";
import { contextualWord, createTapChallenge, completeGuidedWord, captureReviewResponse, isFrozenReviewIndependent, applyContextReview, applyExpressionCommit, practiceDates, contextStarted, effortPoints, stamp, dayAt, hideTerm, makePlan, currentStreak, reviewQueue, recordContextExposure, viewFromURL, urlForView, canRefreshApp, type View, type AppState, type State, type Plan, type Profile, type Settings } from "../lib/web-learning-ui";
export { contextualWord, roleDailyWords, createTapChallenge } from "../lib/web-learning-ui";
type Commit = (next: State | ((current: State) => State), expectedScopeKey?: string) => boolean;

const initialState: AppState = {
  version: 3, profile: null, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], usageAttempts: {}, betaFeedbackSubmittedAt: null,
  lessonStatus: "not_started", lessonWordProgress: 0, completedDays: [], difficultIds: [], favouriteIds: [], reviewedIds: [], masteryScores: {}, reviewDates: {}, nextReviewAt: {},
  exerciseAnswers: {}, exerciseSubmitted: false, exerciseRevealed: false, quizAnswers: {}, quizAttempts: [], currentQuizSubmitted: false,
  settings: { lessonTime: "09:00", timeZone: "Etc/UTC", notificationsEnabled: false, generationMode: "calendar-day", difficulty: "upper-B2-to-C1", audioRate: 0.9, textSize: "normal", dailyWordCount: 3 }, lastNotificationDate: null,
};
const navItems: { id: View; label: string; mark: string }[] = [
  { id: "today", label: "Today", mark: "01" }, { id: "courses", label: "Courses", mark: "02" }, { id: "practice", label: "Review", mark: "03" },
  { id: "idioms", label: "Idioms", mark: "04" }, { id: "express", label: "Express", mark: "05" }, { id: "library", label: "Library", mark: "06" }, { id: "progress", label: "Progress", mark: "07" }, { id: "settings", label: "Settings", mark: "08" },
];
function useLearningDay(timeZone: string, fallback: string) {
  const [day, setDay] = useState(fallback);
  useEffect(() => {
    const update = () => setDay(dayAt(timeZone)); update();
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [timeZone]);
  return day;
}
export default function VocabularyApp(props: { initialDate: string; initialGreeting: string }) {
  return <LearningLanguageProvider><VocabularyAppContent {...props} /></LearningLanguageProvider>;
}

function VocabularyAppContent({ initialDate, initialGreeting }: { initialDate: string; initialGreeting: string }) {
  const { locale, t } = useLearningLanguage();
  const { state, ready, status, error, commit, retrySync, recoverFromBackup, scopeKey, suspendForAccountChange, refreshIdentity, importLegacyProgress, guest, requestAccount, dismissGuestPrompt, getGuestPrompt, canExploreItem, importGuestSession, legacyGuestBackup } = useWebLearningState(initialState);
  const storageBlocked = status === "error";
  const [view, setView] = useState<View>("today"); const [viewHydrated, setViewHydrated] = useState(false);
  const [editingProfileScope, setEditingProfileScope] = useState<string | null>(null);
  const editingProfile = editingProfileScope === scopeKey;
  const [accountDraft, setAccountDraft] = useState(false); const [settingsDraft, setSettingsDraft] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false); const accountDetails = useRef<HTMLDetailsElement>(null);
  const [backupError, setBackupError] = useState("");
  const guestAccess = { active: guest?.active === true, cap: guest?.cap ?? 5, used: guest?.used ?? 0, prompt: guest?.prompt ?? null, legacyAvailable: guest?.legacyAvailable === true, sessionImportAvailable: guest?.sessionImportAvailable === true, requestAccount, getGuestPrompt, canExploreItem };
  const openAccount = () => { dismissGuestPrompt(); setAccountOpen(true); window.requestAnimationFrame(() => { accountDetails.current?.scrollIntoView({ block: "start", behavior: "smooth" }); accountDetails.current?.querySelector<HTMLElement>("summary")?.focus(); }); };
  const downloadLegacy = () => {
    try { const backup = legacyGuestBackup(); if (!backup) return; const url = URL.createObjectURL(new Blob([backup.content], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = backup.name; link.click(); URL.revokeObjectURL(url); setBackupError(""); }
    catch { setBackupError(locale === "ko" ? "이전 백업을 내려받지 못했습니다. 원본 기록은 그대로 보관됩니다." : "The earlier backup could not be downloaded. Its original record is unchanged."); }
  };
  useEffect(() => {
    const followURL = () => { setView(viewFromURL(window.location.href)); setViewHydrated(true); };
    followURL(); window.addEventListener("popstate", followURL);
    return () => window.removeEventListener("popstate", followURL);
  }, []);
  const day = useLearningDay(state.settings.timeZone, initialDate); const profile = state.profile;
  const role = professionalRoles.find((item) => item.id === profile?.roleId);
  const key = profile ? `${day}:${profile.roleId}` : ""; const plan = state.learningV3.rolePlans[key];
  useEffect(() => {
    if (!ready || storageBlocked || !profile || day !== dayAt(state.settings.timeZone) || plan) return;
    commit((current) => {
      if (current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day || current.learningV3.rolePlans[key]) return current;
      return { ...current, learningV3: { ...current.learningV3, rolePlans: { ...current.learningV3.rolePlans, [key]: makePlan(current, profile.roleId, day) }, updatedAt: stamp() } };
    }, scopeKey);
  }, [ready, storageBlocked, profile, day, key, plan, commit, scopeKey, state.settings.timeZone]);
  useEffect(() => {
    if (!ready || storageBlocked || !state.settings.notificationsEnabled || typeof Notification === "undefined") return;
    const check = () => {
      const date = dayAt(state.settings.timeZone); const time = new Intl.DateTimeFormat("en-GB", { timeZone: state.settings.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      if (Notification.permission === "granted" && time >= state.settings.lessonTime && state.lastNotificationDate !== date) {
        new Notification("Your Lucid practice is ready", { body: "A few useful words and a short professional practice." });
        commit((current) => ({ ...current, lastNotificationDate: date }), scopeKey);
      }
    }; check(); const timer = window.setInterval(check, 60_000); return () => window.clearInterval(timer);
  }, [ready, storageBlocked, state.settings, state.lastNotificationDate, commit, scopeKey]);
  const navigate = (next: View) => { if (storageBlocked && next !== "today" && next !== "library" && next !== "idioms") return; if (viewFromURL(window.location.href) !== next) window.history.pushState({ lucidView: next }, "", urlForView(window.location.href, next)); setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const guarded = (mutate: (current: State, currentPlan: Plan) => State) => {
    if (storageBlocked) return false;
    let accepted = false; const capturedScope = scopeKey;
    const saved = commit((current) => {
      const active = current.learningV3.rolePlans[key];
      if (!profile || current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day || !active || active.id !== plan?.id) return current;
      const next = mutate(current, active); accepted = next !== current; return next;
    }, capturedScope);
    return saved && accepted;
  };
  const roleDue = profile ? reviewQueue(state, day, profile.roleId) : [];
  const selectedRoleId = profile?.roleId;
  const expose = useCallback((contextIds: readonly string[]) => {
    if (storageBlocked) return false;
    let accepted = false;
    const saved = commit((current) => {
      if (!selectedRoleId || current.profile?.roleId !== selectedRoleId || dayAt(current.settings.timeZone) !== day) return current;
      const next = recordContextExposure(current, contextIds, day); accepted = true; return next;
    }, scopeKey); return accepted && saved;
  }, [selectedRoleId, day, scopeKey, commit, storageBlocked]);
  useEffect(() => {
    if (!ready || !viewHydrated || storageBlocked || !profile || view !== "today" || !plan) return;
    const ids = plan.wordIds.map((id) => contextEvidenceKey(id, profile.roleId)).filter((id) => state.learningV3.exposedOn[id] !== day);
    if (ids.length) expose(ids);
  }, [ready, viewHydrated, storageBlocked, profile, view, plan, state.learningV3.exposedOn, day, expose]);
  const saveProfile = (next: Profile, dailyWordCount: 1 | 2 | 3) => {
    if (!ready || !viewHydrated || storageBlocked) return;
    if (commit((current) => ({ ...current, profile: next, settings: { ...current.settings, dailyWordCount, timeZone: current.profile ? current.settings.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone }, learningV3: { ...current.learningV3, profileUpdatedAt: stamp(), updatedAt: stamp() } }), scopeKey)) { setEditingProfileScope(null); navigate("today"); }
  };
  const bookmark = (id: string) => { if (!ready || storageBlocked) { openAccount(); return false; } if (guestAccess.active) return requestAccount("save"); return commit((current) => {
    const selected = !current.favouriteIds.includes(id); return { ...current, favouriteIds: selected ? [...current.favouriteIds, id] : current.favouriteIds.filter((item) => item !== id), learningV3: { ...current.learningV3, favouriteChanges: { ...current.learningV3.favouriteChanges, [id]: { selected, updatedAt: stamp() } }, updatedAt: stamp() } };
  }, scopeKey); };
  const canReload = canRefreshApp({ ready: ready && viewHydrated, hasProfile: Boolean(profile) || (guestAccess.active && guestAccess.used === 0 && !editingProfile), editingProfile, status, accountDraft, settingsDraft });
  // Account controls stay mounted while identity requests suspend learner UI.
  const surround = (content: React.ReactNode) => <GuestAccessProvider value={guestAccess}><div lang={locale} className={`lucid-root ${profile && !editingProfile ? "lucid-root-learning" : ""}`}>
    <div className="app-tools">
      <div lang="en"><PWAInstall canReload={canReload} prepareReload={() => canReload} promoteInstall={ready && !storageBlocked && Boolean(profile) && !guestAccess.active} /></div>
      <details lang={locale} className="account-access account-access-optional" open={accountOpen} ref={accountDetails} onToggle={event => setAccountOpen(event.currentTarget.open)}>
        <summary>{locale === "ko" ? "계정 · 로그인 및 저장 옵션" : "Account · sign-in and saving options"}</summary>
        <WebAccountPanel language={locale} scopeKey={scopeKey} onIdentityWillChange={suspendForAccountChange} onIdentityChange={refreshIdentity} onImportLegacy={importLegacyProgress} onDraftChange={setAccountDraft} guestSessionAvailable={guestAccess.sessionImportAvailable} onImportGuestSession={importGuestSession} />
      </details>
    </div>
    <div className="guest-access-wrap"><GuestSessionNotice language={locale} guest={{ ...guestAccess, active: guestAccess.active && (Boolean(profile) || guestAccess.used > 0) }} onAccount={openAccount} onLegacyBackup={downloadLegacy} />{backupError && <p role="alert">{backupError}</p>}<GuestAccountPrompt language={locale} reason={guestAccess.prompt} cap={guestAccess.cap} onAccount={openAccount} onDismiss={dismissGuestPrompt} /></div>
    {content}
  </div></GuestAccessProvider>;
  if (!ready || !viewHydrated || storageBlocked || !profile && !editingProfile) {
    // Reference browsing remains available while identity or storage needs attention.
    // Never expose cached private account state in this reference-only shell.
    const referenceState = ready && viewHydrated && !storageBlocked ? state : prepareWebState(initialState, initialState);
    const browseRole = professionalRoles[0];
    const browseProfile: Profile = { roleId: browseRole.id, seniorityId: seniorityLevels[0].id, situationIds: browseRole.situations.slice(0, 1).map(item => item.id), goalIds: [...browseRole.defaultGoalIds.slice(0, 2)] };
    const startGuest = (roleId: RoleId) => { const selected = professionalRoles.find(item => item.id === roleId)!; saveProfile({ roleId, seniorityId: seniorityLevels[0].id, situationIds: selected.situations.slice(0, 1).map(item => item.id), goalIds: [...selected.defaultGoalIds.slice(0, 2)] }, 3); };
    return surround(<div className="onboarding-shell web-learning guest-public-shell"><header className="onboarding-header"><div className="static-wordmark"><span className="wordmark-glyph">L</span><strong>Lucid</strong><small>{t("Professional English")}</small></div><LearningLanguageChoice compact /></header><main className="onboarding-main guest-public-main">
      <nav className="guest-public-nav" aria-label={locale === "ko" ? "자유롭게 둘러보기" : "Explore without an account"}>{(["today", "library", "idioms"] as const).map(item => <button key={item} className={view === item ? "active" : ""} aria-current={view === item ? "page" : undefined} onClick={() => navigate(item)}>{locale === "ko" ? item === "library" ? "단어 사전" : item === "idioms" ? "관용어" : "둘러보기" : item === "library" ? "Word dictionary" : item === "idioms" ? "Idioms" : "Explore"}</button>)}</nav>
      {storageBlocked && <div className="save-notice" role="alert"><p><strong>{locale === "ko" ? "학습 저장소를 확인해 주세요." : "Learning storage needs attention."}</strong></p><p>{locale === "ko" ? "단어와 관용어는 계속 둘러볼 수 있어요. 학습과 저장은 잠시 멈췄으며 기존 기록은 그대로 보관됩니다. 이 탭을 열어 둔 채 다시 시도해 주세요." : "You can still browse words and idioms. Practice and saving are paused; existing records are kept. Keep this tab open and retry."}</p>{error && <p className="muted">{t(error)}</p>}<button className="secondary-button" onClick={retrySync}>{locale === "ko" ? "학습 저장소 다시 연결" : "Retry learning storage"}</button>{scopeKey.startsWith("supabase:") && <RecoveryPanel onRestore={(value, restoreProfile) => recoverFromBackup(value, restoreProfile, scopeKey)} />}</div>}
      {view === "idioms" ? <IdiomCollection key={`${scopeKey}:${day}`} state={referenceState} day={day} profile={null} scopeKey={scopeKey} commit={commit} blocked={false} onBack={() => navigate("today")} onSetup={storageBlocked ? undefined : () => navigate("today")} /> : view === "library" ? <Library key={`${scopeKey}:public`} profile={browseProfile} state={referenceState} bookmark={bookmark} expose={() => true} day={day} publicBrowse /> : <GuestExploreStart language={locale} cap={guestAccess.cap} practiceReady={ready && viewHydrated && !storageBlocked} onBrowse={navigate} onStart={startGuest} onPersonalize={() => setEditingProfileScope(scopeKey)} />}
    </main></div>);
  }
  if (editingProfile) return surround(<Onboarding key={`${scopeKey}:edit`} initialProfile={profile} dailyWordCount={state.settings.dailyWordCount} onSave={saveProfile} onRecover={(value, restoreProfile) => recoverFromBackup(value, restoreProfile, scopeKey)} onCancel={() => setEditingProfileScope(null)} onExploreIdioms={() => { setEditingProfileScope(null); navigate("idioms"); }} error={error} />);
  if (!profile) return null;
  let greeting = initialGreeting;
  try { const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: state.settings.timeZone, hour: "2-digit", hour12: false }).format(new Date())); greeting = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening."; } catch { /* Keep the server greeting until the time zone is corrected. */ }
  const displayDate = new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-GB", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z"));
  return surround(<div className={`app-shell web-learning text-${state.settings.textSize}`}>
    <a className="skip-link" href="#main-content">{t("Skip to content")}</a>
    <header className="topbar"><button className="wordmark" onClick={() => navigate("today")} aria-label={t("Lucid home")}><span className="wordmark-glyph" aria-hidden="true">L</span><span>Lucid<small>{t("Professional English")}</small></span></button><div className="topbar-meta"><LearningLanguageChoice compact /><span className="role-chip">{t(role?.shortLabel ?? "")}</span><span className="sync-status" role="status">{guestAccess.active ? locale === "ko" ? "현재 세션에서만 학습 중" : "Practising in this session" : status === "offline" ? t("Saved locally · offline") : storageBlocked ? t("Save needs retry") : status === "syncing" ? t("Syncing learning progress") : t(status)}</span></div></header>
    <aside className="sidebar"><nav aria-label={t("Primary navigation")}>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.mark}</span>{t(item.label)}{item.id === "practice" && roleDue.length > 0 && <b>{roleDue.length}</b>}</button>)}</nav><div className="sidebar-note"><span>{t("YOUR PROFESSIONAL PATH")}</span><p>{t(role?.shortLabel ?? "")}</p><small>{t(seniorityLevels.find((item) => item.id === profile.seniorityId)?.label ?? "")}</small></div></aside>
    <main id="main-content" className="main-content">
      <LearningCoverageNote />
      {view !== "today" && view !== "practice" && view !== "idioms" && <EnglishLearningContentNotice />}
      {error && <div className="save-notice" role="alert"><p>{t(error)}</p><button onClick={retrySync}>{storageBlocked ? t("Retry saving") : t("Retry connection")}</button>{storageBlocked && <RecoveryPanel onRestore={(value, restoreProfile) => recoverFromBackup(value, restoreProfile, scopeKey)} />}</div>}
      {view === "today" && <DailyVocabulary key={`${scopeKey}:${key}`} state={state} day={day} profile={profile} scopeKey={scopeKey} commit={commit} blocked={storageBlocked} dateLabel={displayDate} greeting={greeting} dueCount={roleDue.length} navigate={navigate}><Today state={state} day={day} plan={plan} profile={profile} guarded={guarded} bookmark={bookmark} navigate={navigate} dueCount={roleDue.length} /></DailyVocabulary>}
      {view === "idioms" && <IdiomCollection key={`${scopeKey}:${day}:${profile.roleId}`} state={state} day={day} profile={profile} scopeKey={scopeKey} commit={commit} blocked={storageBlocked} onBack={() => navigate("today")} />}
      {view === "courses" && <Courses key={`${scopeKey}:${profile.roleId}`} state={state} day={day} profile={profile} commit={commit} scopeKey={scopeKey} navigate={navigate} expose={expose} />}
      {view === "practice" && <Review key={`${scopeKey}:${day}:${profile.roleId}`} state={state} day={day} profile={profile} commit={commit} scopeKey={scopeKey} blocked={storageBlocked} />}
      {view === "express" && <ExpressionPractice key={`${scopeKey}:${day}:${profile.roleId}`} roleId={profile.roleId} learnedWordIds={Object.keys(state.learningV3.contextIntroducedOn).filter((id) => id.endsWith(`::${profile.roleId}`)).map((id) => id.split("::")[0])} activeDates={practiceDates(state)} lastActiveDate={practiceDates(state).at(-1)} today={day} savedDraft={state.learningV3.expressionDraft ?? ""} exposedOn={state.learningV3.exposedOn} onCommit={(draft, input, exposedIds, exposedAtISO) => {
        if (input?.date && input.date !== day) return false;
        const evidence = input ? makeReviewEvidence({ ...input, id: input.attemptId, date: day }) : undefined;
        if (input && !evidence) return false;
        let accepted = false;
        const saved = commit((current) => {
          if (current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day) return current;
          const next = applyExpressionCommit(current, { roleId: profile.roleId, date: day, draft, evidence: evidence ?? undefined, exposedContextIds: exposedIds, exposedAtISO });
          accepted = next !== current;
          return next;
        }, scopeKey); return accepted && saved;
      }} />}
      {view === "library" && <Library key={`${scopeKey}:${profile.roleId}`} profile={profile} state={state} bookmark={bookmark} expose={expose} day={day} blocked={storageBlocked} />}
      {view === "progress" && <Progress state={state} day={day} roleId={profile.roleId} dueCount={roleDue.length} />}
      {view === "settings" && <SettingsPanel key={scopeKey} state={state} commit={commit} scopeKey={scopeKey} editProfile={() => setEditingProfileScope(scopeKey)} onDraftChange={setSettingsDraft} needsRecovery={storageBlocked} onRecover={(value, restoreProfile) => recoverFromBackup(value, restoreProfile, scopeKey)} />}
    </main>
    <nav className="mobile-nav" aria-label={t("Mobile navigation")}>{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.mark}</span>{t(item.label)}</button>)}</nav>
  </div>);
}

export function Onboarding({ initialProfile, dailyWordCount, onSave, onRecover, onCancel, onExploreIdioms, error }: { initialProfile: Profile | null; dailyWordCount: 1 | 2 | 3; onSave: (profile: Profile, dailyWordCount: 1 | 2 | 3) => void; onRecover: (value: unknown, restoreProfile?: boolean) => Promise<boolean>; onCancel?: () => void; onExploreIdioms?: () => void; error: string | null }) {
  const { t } = useLearningLanguage();
  const [step, setStep] = useState(0); const [roleId, setRoleId] = useState<RoleId | "">(initialProfile?.roleId ?? ""); const [seniorityId, setSeniorityId] = useState<SeniorityId | "">(initialProfile?.seniorityId ?? "");
  const [situations, setSituations] = useState<SituationId[]>(initialProfile?.situationIds ?? []); const [goals, setGoals] = useState<GoalId[]>(initialProfile?.goalIds ?? []);
  const [pace, setPace] = useState<1 | 2 | 3>(dailyWordCount ?? 3);
  const role = professionalRoles.find((item) => item.id === roleId); const headings = ["Where do you use English most?", "What communication do you own?", "Which moments matter every week?", "What would you like to do better?", "What pace feels manageable?"];
  const allowed = step === 0 ? Boolean(roleId) : step === 1 ? Boolean(seniorityId) : step === 2 ? situations.length > 0 : step === 3 ? goals.length > 0 : true;
  return <div className="onboarding-shell"><header className="onboarding-header"><div className="static-wordmark"><span className="wordmark-glyph">L</span><strong>Lucid</strong><small>{t("Professional English for your role")}</small></div><LearningLanguageChoice compact />{onCancel && <button onClick={onCancel}>{t("Cancel")}</button>}</header><main className="onboarding-main"><LearningCoverageNote /><span className="eyebrow">{t("YOUR LEARNING PATH · {step} OF 5", { step: step + 1 })}</span><h1>{t(headings[step])}</h1><p>{t("Learn one to three useful words at your own pace. Practise them in realistic workplace situations.")}</p>{error && <p role="alert" className="error-copy">{t(error)}</p>}
    {onExploreIdioms && <div className="onboarding-idiom-entry"><p>{t("Explore idioms before setting up your course.")}</p><button className="secondary-button" onClick={onExploreIdioms}>{t("Explore all {count} idioms", { count: dailyIdioms.length })} →</button></div>}
    <div className="choice-grid">
      {step === 0 && professionalRoles.map((item) => <button aria-pressed={roleId === item.id} key={item.id} className={roleId === item.id ? "selected" : ""} onClick={() => { setRoleId(item.id); if (item.id !== roleId) { setSituations([]); setGoals([...item.defaultGoalIds.slice(0, 2)]); } }}><strong>{t(item.label)}</strong><small>{t(item.description)}</small></button>)}
      {step === 1 && seniorityLevels.map((item) => <button key={item.id} aria-pressed={seniorityId === item.id} className={seniorityId === item.id ? "selected" : ""} onClick={() => setSeniorityId(item.id)}><strong>{t(item.label)}</strong><small>{t(item.communicationFocus)}</small></button>)}
      {step === 2 && role?.situations.map((item) => <button key={item.id} aria-pressed={situations.includes(item.id)} className={situations.includes(item.id) ? "selected" : ""} onClick={() => setSituations((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : current.length < 3 ? [...current, item.id] : current)}><strong>{t(item.label)}</strong><small>{t(item.description)}</small></button>)}
      {step === 3 && communicationGoals.map((item) => <button key={item.id} aria-pressed={goals.includes(item.id)} className={goals.includes(item.id) ? "selected" : ""} onClick={() => setGoals((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : current.length < 3 ? [...current, item.id] : current)}><strong>{t(item.label)}</strong><small>{t(item.outcome)}</small></button>)}
      {step === 4 && ([1, 2, 3] as const).map((count) => <button key={count} aria-pressed={pace === count} className={pace === count ? "selected" : ""} onClick={() => setPace(count)}><strong>{t("{count} words per day", { count })}</strong><small>{count === 1 ? t("A small, sustainable step.") : count === 2 ? t("A little variety, with room to revisit.") : t("A focused collection for daily practice.")}</small></button>)}
    </div><p className="muted">{step === 1 ? t("Career stage guides your context. It is separate from language ability.") : step === 2 || step === 3 ? t("Choose up to three.") : step === 4 ? t("Your course pace is separate from Today’s Words: five advanced words, with three optional extras and one daily idiom.") : t("You can change your role later without losing your learning history.")}</p><div className="onboarding-actions"><button className="secondary-button" disabled={step === 0} onClick={() => setStep(step - 1)}>{t("Back")}</button><button className="primary-button" disabled={!allowed} onClick={() => step < 4 ? setStep(step + 1) : roleId && seniorityId && onSave({ roleId, seniorityId, situationIds: situations, goalIds: goals }, pace)}>{step === 4 ? t("Build my daily path") : t("Continue")} <span aria-hidden="true">→</span></button></div>
    <RecoveryPanel onRestore={onRecover} />
  </main></div>;
}

function WordGuidance({ word, roleId }: { word: ProfessionalWord; roleId?: RoleId }) {
  const { locale, t } = useLearningLanguage();
  const support = locale === "ko" && roleId ? koreanWordSupport(word.id, roleId) : undefined;
  return <div className="word-guidance"><p className="word-meaning" lang="en">{word.meaning}</p>{locale === "ko" && roleId && (support ? <p className="korean-learning-support" lang="ko"><strong>{t("Korean meaning")}</strong>{support.meaning}{support.usage && <span>{support.usage}</span>}</p> : <p className="korean-translation-unavailable" lang="ko">{t("Korean support is not available for this entry yet. The original English guidance is shown.")}</p>)}<div className="usage-guidance"><div><small>{t("WHEN TO USE")}</small><p>{word.whenToUse}</p></div><div><small>{t("AVOID THIS")}</small><p>{word.avoidOrMisuse}</p></div></div><div className="collocation-list"><small>{t("COLLOCATIONS")}</small>{word.collocations.map((item) => <span key={item}>{item}</span>)}</div><blockquote lang="en">{word.example}</blockquote><small>{t("WORKPLACE MISSION")}</small><p>{word.mission}</p></div>;
}
function Today({ state, day, plan, profile, guarded, bookmark, navigate, dueCount }: { state: State; day: string; plan?: Plan; profile: Profile; guarded: (mutate: (current: State, plan: Plan) => State) => boolean; bookmark: (id: string) => boolean; navigate: (view: View) => void; dueCount: number }) {
  const { t, locale } = useLearningLanguage();
  const guest = useGuestAccess();
  const [active, setActive] = useState(false); const [notice, setNotice] = useState(""); const [writtenDrafts, setWrittenDrafts] = useState<Record<string, string>>({});
  if (!plan) return <div className="empty-state"><h1>{t("Preparing today’s words")}</h1><p>{guest.active ? t("Preparing practice for this session…") : t("Your daily plan will appear after it is saved on this device.")}</p></div>;
  const words = plan.wordIds.map((id) => contextualWord(id, profile.roleId)).filter((item): item is ProfessionalWord => Boolean(item));
  const complete = words.length > 0 && words.every((item) => plan.completedIds.includes(item.id));
  const currentIndex = Math.min(plan.cursor, Math.max(0, words.length - 1)); const word = words[currentIndex];
  const challenge = word ? createTapChallenge(word, profile.roleId) : undefined; const answer = word ? plan.answers[word.id] : undefined;
  const correct = answer?.choiceId === challenge?.correctId; const selectedRole = professionalRoles.find((item) => item.id === profile.roleId);
  const changeAnswer = (choiceId: string, helped = false) => {
    if (!word || !challenge || plan.completedIds.includes(word.id)) return;
    const saved = guarded((current, currentPlan) => {
      const prior = currentPlan.answers[word.id] ?? { choiceId: "", wrongChoiceIds: [], helped: false, completed: false };
      if (currentPlan.wordIds[currentPlan.cursor] !== word.id || prior.completed) return current;
      const nextAnswer = { ...prior, choiceId: helped ? prior.choiceId : choiceId, helped: prior.helped || helped, wrongChoiceIds: !helped && choiceId !== challenge.correctId ? [...new Set([...(prior.wrongChoiceIds ?? []), choiceId])] : prior.wrongChoiceIds };
      const exposed = helped || choiceId === challenge.correctId ? recordContextExposure(current, [contextEvidenceKey(word.id, profile.roleId)], day) : current;
      return { ...exposed, learningV3: { ...exposed.learningV3, rolePlans: { ...exposed.learningV3.rolePlans, [currentPlan.id]: { ...currentPlan, answers: { ...currentPlan.answers, [word.id]: nextAnswer } } }, updatedAt: stamp() } };
    }); if (!saved) setNotice(guest.active && guest.getGuestPrompt() ? "" : "Your answer could not be saved. Please retry before continuing."); else setNotice("");
  };
  const advance = () => {
    if (!word || !correct) return;
    const saved = guarded((current) => completeGuidedWord(current, { key: plan.id, roleId: profile.roleId, date: day, currentDay: dayAt(current.settings.timeZone), wordId: word.id })    ); if (!saved) setNotice(guest.active && guest.getGuestPrompt() ? "" : "We could not save this step. Your answer is still here; retry to continue."); else setNotice("");
  };
  const move = (cursor: number) => { if (guarded((current, currentPlan) => ({ ...current, learningV3: { ...current.learningV3, rolePlans: { ...current.learningV3.rolePlans, [currentPlan.id]: { ...currentPlan, cursor } } } }))) { setNotice(""); return true; } setNotice(guest.active && guest.getGuestPrompt() ? "" : "Could not save this position. Please retry."); return false; };
  const saveDraft = (text: string) => word && guarded((current) => ({ ...current, learningV3: { ...current.learningV3, practiceDrafts: { ...current.learningV3.practiceDrafts, [word.id]: text } } }));
  return <>
    <div className="section-heading daily-course-heading"><div><span className="eyebrow">{t("YOUR COURSE · CHOSEN PACE")}</span><h2>{t("Your course practice")}</h2></div><div className="lesson-progress" aria-label={t("{count} of {total} words completed", { count: plan.completedIds.length, total: words.length })}><span>{t("{count} / {total} guided words", { count: plan.completedIds.length, total: words.length })}</span><progress max={Math.max(1, words.length)} value={plan.completedIds.length} /></div></div>
    <EnglishLearningContentNotice /><section className="coach-hero"><div><span className="eyebrow">{t(selectedRole?.shortLabel ?? "")} · {t("YOUR DAILY PRACTICE")}</span><h2>{t("Learn less. Use more.")}</h2><p>{t("Choose the meaning, complete a sentence, or spot misleading guidance. Come back later to retrieve the words independently.")}</p><div className="hero-actions"><button className="primary-button" onClick={() => setActive(true)} disabled={!words.length || complete}>{complete ? t("Daily practice complete") : active ? t("Practice open below") : plan.completedIds.length || Object.keys(plan.answers).length ? t("Resume practice") : t("Start practice")}</button><button className="secondary-button" onClick={() => navigate("courses")}>{t("Explore my course")}</button>{dueCount > 0 && <button className="text-button" onClick={() => navigate("practice")}>{t("{count} words ready for review →", { count: dueCount })}</button>}</div></div><div className="mission-card"><small>{t("TODAY’S OUTCOME")}</small><strong>{complete ? t("You kept your practice going.") : t("Make one useful expression feel familiar.")}</strong><p>{t("Guided practice builds familiarity. Independent recall and lasting mastery are measured separately.")}</p></div></section>
    {notice && <p className="save-notice" role="alert">{t(notice)}</p>}
    {complete && <div className="completion-banner" role="status"><span aria-hidden="true">✓</span><div><strong>{t("Today’s guided practice is complete.")}</strong><p>{t("Your words are scheduled for spaced review. Try one in a fresh situation in Express.")}</p></div><button className="secondary-button" onClick={() => navigate("express")}>{t("Put it to work")}</button></div>}
    {active && word && challenge && !complete && <section className="practice-lab" aria-label={t("Daily guided practice")}><div className="section-heading"><span className="eyebrow">{t("WORD {index} OF {total}", { index: currentIndex + 1, total: words.length })} · {challenge.kind}</span><button className="text-button" onClick={() => setActive(false)}>{t("Pause and save")}</button></div><h2>{challenge.prompt}</h2><p className="challenge-context">{challenge.context}</p><div className="challenge-options">{challenge.choices.map((choice) => <button key={choice.id} disabled={Boolean(correct) || plan.completedIds.includes(word.id)} aria-pressed={answer?.choiceId === choice.id} className={answer?.choiceId === choice.id ? correct ? "correct" : "incorrect" : ""} onClick={() => changeAnswer(choice.id)}>{choice.text}</button>)}</div>
      {answer?.choiceId && <div className={correct ? "answer-feedback correct" : "answer-feedback incorrect"} role="status"><strong>{correct ? t("That’s the right choice.") : t("Try again.")}</strong><p>{correct ? challenge.explanation : challenge.choices.find((item) => item.id === answer.choiceId)?.explanation}</p>{!correct && <p>{t("Choose again, or open Help for the word’s guidance.")}</p>}</div>}
      {answer?.helped && <div className="help-panel"><h3>{word.term}</h3><WordGuidance word={word} roleId={profile.roleId} /><p className="muted">{t("This is assisted practice. Help does not earn independent recall credit.")}</p></div>}
      <div className="button-row"><button className="secondary-button" onClick={() => changeAnswer("", true)}>{t("Help")}</button><button className="secondary-button" disabled={currentIndex >= words.length - 1} onClick={() => move(Math.min(words.length - 1, currentIndex + 1))}>{t("Skip for now")}</button><button className="primary-button" disabled={!correct || plan.completedIds.includes(word.id)} onClick={advance}>{guest.active ? locale === "ko" ? "이번 세션에서 계속" : "Continue this session" : t("Save and continue")}</button></div>
      <details className="optional-stretch"><summary>{t("Optional written practice")}</summary><p>{word.mission} {t("Use fictional details. This draft stays on this device.")}</p><label htmlFor="daily-written">{t("Your workplace sentence")}</label><textarea id="daily-written" rows={4} readOnly={guest.active && !guest.canExploreItem(`word:${word.id}`)} onFocus={() => { if (guest.active && !guest.canExploreItem(`word:${word.id}`)) guest.requestAccount("limit"); }} value={writtenDrafts[word.id] ?? state.learningV3.practiceDrafts[word.id] ?? ""} onChange={(event) => { const text = event.target.value; setWrittenDrafts((current) => ({ ...current, [word.id]: text })); if (!saveDraft(text)) setNotice(guest.active && guest.getGuestPrompt() ? "" : "Your text remains here. Retry saving before leaving this page."); }} placeholder={t("Write what you might say in a meeting or email.")} /><p className="muted">{t("Written practice is a stretch. It is not required to complete the guided question.")}</p></details>
    </section>}
    <section><div className="section-heading"><div><span className="eyebrow">{t("COURSE WORDS")}</span><h2>{t("Your focused course collection")}</h2></div><p>{t("{count} words at your chosen pace", { count: words.length })}</p></div>{words.length ? <div className="professional-word-grid">{words.map((entry, index) => <article className="professional-word-card" key={entry.id}><div className="card-top"><span>{plan.completedIds.includes(entry.id) ? t("Practised ✓") : t("To practise")} · {entry.learningMode}</span><button className="bookmark-button" aria-pressed={state.favouriteIds.includes(entry.id)} aria-label={`${state.favouriteIds.includes(entry.id) ? t("Remove bookmark for") : t("Bookmark")} ${entry.term}`} onClick={() => bookmark(entry.id)}>{state.favouriteIds.includes(entry.id) ? "★" : "☆"}</button></div><h3>{entry.term}</h3><p className="word-meta">{entry.partOfSpeech} · {entry.pronunciation}</p><WordGuidance word={entry} roleId={profile.roleId} />{!complete && <button className="secondary-button" disabled={plan.completedIds.includes(entry.id)} onClick={() => { if (move(index)) setActive(true); }}>{plan.completedIds.includes(entry.id) ? t("Practised today") : t("Practise this word")}</button>}</article>)}</div> : <div className="empty-state"><h3>{t("You’ve started every word in this course.")}</h3><p>{t("Keep the words available through Review, or explore another professional role in Settings.")}</p><button className="primary-button" onClick={() => navigate("practice")}>{t("Open Review")}</button></div>}</section>
  </>;
}

function Courses({ state, day, profile, commit, scopeKey, navigate, expose }: { state: State; day: string; profile: Profile; commit: Commit; scopeKey: string; navigate: (view: View) => void; expose: (ids: readonly string[]) => boolean }) {
  const path = professionalLearningPaths.find((item) => item.roleId === profile.roleId); const [checking, setChecking] = useState(false); const [selected, setSelected] = useState<number | null>(null); const [message, setMessage] = useState("");
  if (!path) return <div className="empty-state"><h1>Your course is being prepared</h1></div>;
  const questions = path.startingCheck ?? []; const signature = JSON.stringify(questions); const savedDraft = state.learningV3.startingCheckDrafts[profile.roleId];
  const answers = savedDraft?.pathId === path.id && savedDraft.signature === signature ? savedDraft.answers : [];
  const finished = questions.length === 6 && answers.length === 6; const score = answers.filter((answer, index) => answer === questions[index]?.correctIndex).length;
  const foundation = answers[0] === questions[0]?.correctIndex && answers[1] === questions[1]?.correctIndex; const suggestion = foundation && score >= 4 ? score === 6 ? 4 : 2 : 0;
  const placement = state.learningV3.placementsByRole[profile.roleId]; const allIds = [...new Set(path.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.wordIds)))];
  const guard = (updater: (current: State) => State) => { let allowed = false; const success = commit((current) => { if (current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day) return current; allowed = true; return updater(current); }, scopeKey); return allowed && success; };
  const saveAnswer = (choice: number) => {
    if (answers.length >= questions.length) return;
    if (guard((current) => {
      const draft = current.learningV3.startingCheckDrafts[profile.roleId]; const currentAnswers = draft?.signature === signature && draft.pathId === path.id ? draft.answers : [];
      if (currentAnswers.length !== answers.length) return current;
      return { ...current, learningV3: { ...current.learningV3, startingCheckDrafts: { ...current.learningV3.startingCheckDrafts, [profile.roleId]: { pathId: path.id, signature, answers: [...currentAnswers, choice], updatedAt: stamp() } } } };
    })) { setSelected(null); setMessage(""); } else setMessage("Your answer could not be saved. Please retry.");
  };
  const apply = (index: number) => {
    const saved = guard((current) => {
      const draft = current.learningV3.startingCheckDrafts[profile.roleId]; if (draft?.signature !== signature || draft.answers.length !== 6) return current;
      const next = { ...current, learningV3: { ...current.learningV3, placementsByRole: { ...current.learningV3.placementsByRole, [profile.roleId]: { pathId: path.id, startingModuleId: path.modules[index].id, checkedAtISO: stamp(), correctCount: score, questionCount: 6 } }, updatedAt: stamp() } };
      const key = `${day}:${profile.roleId}`; const plan = next.learningV3.rolePlans[key];
      const untouched = plan && plan.completedIds.length === 0 && Object.keys(plan.answers).length === 0 && !plan.wordIds.some((id) => current.learningV3.practiceDrafts[id]?.trim());
      return untouched ? { ...next, learningV3: { ...next.learningV3, rolePlans: { ...next.learningV3.rolePlans, [key]: makePlan(next, profile.roleId, day) } } } : next;
    }); if (saved) { setChecking(false); setMessage("Starting point saved. Existing practice and review history stay with you."); } else setMessage("Your starting point could not be saved. Please retry.");
  };
  return <><div className="page-intro"><div><span className="eyebrow">YOUR PROFESSIONAL COURSE</span><h1>{path.title}</h1><p>{path.description}</p></div></div><div className="course-summary"><article><strong>{allIds.length}</strong><span>word and phrase entries</span></article><article><strong>{path.modules.length}</strong><span>chapters</span></article><article><strong>{path.modules.reduce((count, module) => count + module.lessons.length, 0)}</strong><span>lessons at your own pace</span></article><article><strong>{allIds.filter((id) => contextStarted(state, id, profile.roleId)).length}</strong><span>words started, not mastered</span></article></div>
    <section className="starting-point"><div><span className="eyebrow">AN OPTIONAL SIX-QUESTION CHECK</span><h2>{placement ? `Your starting chapter: ${path.modules.find((item) => item.id === placement.startingModuleId)?.title}` : "Find a comfortable starting point"}</h2><p>This recognition check suggests where to begin. It does not measure mastery or award learning credit. Earlier chapters remain available and return later.</p></div><button className="secondary-button" onClick={() => setChecking(!checking)}>{checking ? "Pause check" : answers.length ? "Resume starting check" : "Find my starting point"}</button></section>
    {message && <p role="status" className="save-notice">{message}</p>}
    {checking && <section className="check-panel"><span className="eyebrow">STARTING CHECK · {Math.min(6, answers.length + 1)} OF 6</span>{savedDraft && savedDraft.signature !== signature && <p>The questions have changed. This check starts again; your existing learning stays.</p>}
      {!finished && questions[answers.length] && <><h2>{questions[answers.length].prompt}</h2><div className="challenge-options">{questions[answers.length].options.map((option, index) => <button key={option} aria-pressed={selected === index} className={selected === index ? "selected" : ""} onClick={() => setSelected(index)}>{option}</button>)}</div><div className="button-row"><button className="secondary-button" onClick={() => saveAnswer(-1)}>Skip this question</button><button className="primary-button" disabled={selected === null} onClick={() => selected !== null && saveAnswer(selected)}>Save answer and continue</button></div></>}
      {finished && <><h2>A starting point, not a label.</h2><p>{score} of 6 choices correct. Suggested chapter: <strong>{path.modules[suggestion].title}</strong>.</p><p>Untouched daily cards can update now. If you have already practised or written a draft, the choice applies to your next new daily plan.</p><div className="button-row"><button className="primary-button" onClick={() => apply(suggestion)}>Use suggested starting point</button><button className="secondary-button" onClick={() => apply(0)}>Start from chapter one</button></div><details><summary>Review my answers</summary>{questions.map((question, index) => <article key={question.id}><h3>{index + 1}. {question.prompt}</h3><p>Your choice: {answers[index] === -1 ? "Skipped" : question.options[answers[index]]}</p><p>{question.explanation}</p></article>)}</details><button className="text-button" onClick={() => { if (guard((current) => ({ ...current, learningV3: { ...current.learningV3, startingCheckDrafts: { ...current.learningV3.startingCheckDrafts, [profile.roleId]: { pathId: path.id, signature, answers: [], updatedAt: stamp() } } } }))) setSelected(null); }}>Restart check</button></>}
    </section>}
    <section className="course-chapters">{path.modules.map((module, index) => <details key={module.id} className="course-chapter"><summary><span className="chapter-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{module.title}</strong><small>{module.outcome}</small></span><span className="chapter-status">{module.lessons.flatMap((lesson) => lesson.wordIds).filter((id) => contextStarted(state, id, profile.roleId)).length} / {module.lessons.flatMap((lesson) => lesson.wordIds).length} started</span></summary><div className="course-lessons">{module.lessons.map((lesson) => <details key={lesson.id} onToggle={(event) => { if (event.currentTarget.open) expose(lesson.wordIds.map((id) => contextEvidenceKey(id, profile.roleId))); }}><summary>{lesson.title}</summary><p>{lesson.objective}</p><div className="word-tags">{lesson.wordIds.map((id) => <span key={id}>{contextualWord(id, profile.roleId)?.term}</span>)}</div><h3>Workplace scenario</h3><p>{lesson.challenge}</p><details><summary>See a model response</summary><blockquote>{lesson.exampleResponse}</blockquote></details><button className="secondary-button" onClick={() => navigate("today")}>Go to today’s practice</button></details>)}</div></details>)}</section><p className="muted">Use fictional details in practice. These courses teach communication. Follow qualified advice and approved workplace procedures for real decisions.</p></>;
}

export function Review({ state, day, profile, commit, scopeKey, blocked = false }: { state: State; day: string; profile: Profile; commit: Commit; scopeKey: string; blocked?: boolean }) {
  const { t } = useLearningLanguage();
  const [otherRoles, setOtherRoles] = useState(false);
  const [attestations, setAttestations] = useState<Record<string, { meaning: boolean; natural: boolean }>>({});
  const [notice, setNotice] = useState(""); const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const words = reviewQueue(state, day, profile.roleId, otherRoles);
  const saveDraft = (contextId: string, update: Partial<{ sentence: string; hinted: boolean; revealed: boolean }>) => {
    let accepted = false;
    const saved = commit((current) => {
      if (current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day) return current;
      const key = `${day}:${contextId}`;
      const prior = current.learningV3.reviewDrafts[key] ?? { sentence: "", hinted: false, revealed: false };
      if (update.revealed) {
        const split = contextId.lastIndexOf("::"); const wordId = contextId.slice(0, split); const contextRole = contextId.slice(split + 2) as RoleId;
        const next = captureReviewResponse(current, { roleId: profile.roleId, contextRole, date: day, currentDay: dayAt(current.settings.timeZone), wordId, response: textDrafts[contextId] ?? prior.sentence ?? prior.response ?? "" });
        accepted = next !== current; return next;
      }
      if (prior.revealed || prior.originalResponse !== undefined || prior.originalIndependent !== undefined) return current;
      accepted = true;
      const exposed = update.hinted ? recordContextExposure(current, [contextId], day) : current;
      return { ...exposed, learningV3: { ...exposed.learningV3, reviewDrafts: { ...current.learningV3.reviewDrafts, [key]: { ...prior, ...update, hinted: prior.hinted || update.hinted === true, revealed: prior.revealed } } } };
    }, scopeKey);
    if (!saved || !accepted) setNotice("Your change could not be saved. Retry before continuing."); else setNotice("");
    return saved && accepted;
  };
  const record = (word: ProfessionalWord, contextRole: RoleId, quality: ReviewQuality) => {
    const contextId = contextEvidenceKey(word.id, contextRole); const key = `${day}:${contextId}`; let accepted = false;
    const saved = commit((current) => {
      if (current.profile?.roleId !== profile.roleId || dayAt(current.settings.timeZone) !== day) return current;
      const draft = current.learningV3.reviewDrafts[key] ?? { sentence: "", hinted: false, revealed: false };
      const attestation = attestations[contextId];
      const next = applyContextReview(current, { roleId: profile.roleId, contextRole, date: day, currentDay: dayAt(current.settings.timeZone), wordId: word.id, response: textDrafts[contextId] ?? draft.sentence ?? draft.response ?? "", quality, hinted: draft.hinted, revealed: draft.revealed, meaningAttested: attestation?.meaning, naturalnessAttested: attestation?.natural });
      accepted = next !== current; return next;
    }, scopeKey);
    setNotice(saved && accepted ? "Review saved. This records your self-assessment; it is not an automatic judgement of meaning or naturalness." : "This review could not be saved. Check your fresh answer and assessment, then retry.");
  };
  return <><div className="page-intro"><div><span className="eyebrow">{t("SPACED REVIEW")}</span><h1>{t("Retrieve before you recognise.")}</h1><p>{t("Recall the expression and write a fresh sentence before revealing guidance. Self-assessment keeps recognition, unaided recall and production separate.")}</p></div><div className="due-badge"><strong>{words.length}</strong><span>{t("words due")}</span></div></div><DailyIdiomReviewSection state={state} day={day} profile={profile} commit={commit} scopeKey={scopeKey} blocked={blocked} /><div className="srs-ladder" aria-label={t("Spaced review schedule")}>{SRS_INTERVAL_DAYS.map((days) => <span key={days}><b>{days}</b><small>{t(days === 1 ? "day" : "days")}</small></span>)}</div><label className="checkbox-line"><input type="checkbox" checked={otherRoles} onChange={(event) => setOtherRoles(event.target.checked)} /> {t("Include due contexts from other roles")}</label>{notice && <p className="save-notice" role="status">{t(notice)}</p>}
    {words.length ? <div className="due-review-list">{words.map(({ word, roleId: contextRole, context }, index) => {
      const contextId = contextEvidenceKey(word.id, contextRole); const key = `${day}:${contextId}`;
      const draft = state.learningV3.reviewDrafts[key] ?? { sentence: "", hinted: false, revealed: false }; const sentence = draft.revealed ? draft.originalResponse ?? draft.sentence ?? draft.response ?? "" : textDrafts[contextId] ?? draft.sentence ?? draft.response ?? "";
      const frozenIndependent = isFrozenReviewIndependent(state, word.id, contextRole, day);
      const assisted = !frozenIndependent && (draft.hinted || draft.revealed || state.learningV3.exposedOn[contextId] === day);
      const attestation = attestations[contextId] ?? { meaning: false, natural: false };
      const canRateGood = frozenIndependent && attestation.meaning && attestation.natural;
      return <article key={key} className="review-card"><span className="eyebrow">{t("RECALL {index}", { index: index + 1 })} · {t(professionalRoles.find((role) => role.id === contextRole)?.shortLabel ?? "")} · {word.learningMode === "recognition" ? t("RECOGNITION VOCABULARY") : t("ANSWER HIDDEN")}</span>{!context && <p className="muted">{t("Earlier word history is preserved. This is your first assessment of this role’s context.")}</p>}<h2 lang="en">{hideTerm(word.meaning, word.term)}</h2><p lang="en">{hideTerm(word.mission, word.term)}</p><label htmlFor={`review-${contextId}`}>{draft.revealed ? t("Your committed original response") : t("Your fresh workplace sentence")}</label><textarea id={`review-${contextId}`} autoComplete="off" rows={4} readOnly={draft.revealed} value={sentence} onChange={(event) => { setTextDrafts((current) => ({ ...current, [contextId]: event.target.value })); saveDraft(contextId, { sentence: event.target.value }); setAttestations((current) => ({ ...current, [contextId]: { meaning: false, natural: false } })); }} placeholder={t("Recall the expression and use it in a new situation.")} />
        <div className="button-row"><button className="secondary-button" disabled={draft.revealed} onClick={() => saveDraft(contextId, { hinted: true })}>{t("Use a hint")}</button><button className="secondary-button" disabled={draft.revealed} onClick={() => saveDraft(contextId, { revealed: true })}>{t("Commit response and reveal guidance")}</button></div>
        {draft.hinted && !draft.revealed && <div className="help-panel"><p>{t("The expression starts with {letter} and has {count} words.", { letter: word.term[0], count: word.term.split(/\s+/).length })}</p></div>}
        {draft.revealed && <div className="help-panel"><h3>{word.term}</h3><WordGuidance word={word} roleId={contextRole} /></div>}
        {frozenIndependent ? <fieldset className="self-assessment"><legend>{t("Your self-assessment")}</legend><label className="checkbox-line"><input type="checkbox" checked={attestation.meaning} onChange={(event) => setAttestations((current) => ({ ...current, [contextId]: { ...attestation, meaning: event.target.checked } }))} /> {t("My sentence uses the intended meaning correctly.")}</label><label className="checkbox-line"><input type="checkbox" checked={attestation.natural} onChange={(event) => setAttestations((current) => ({ ...current, [contextId]: { ...attestation, natural: event.target.checked } }))} /> {t("It sounds natural and appropriate for this audience.")}</label><p className="muted">{t("Your original response was saved before support appeared. These confirmations capture your judgement; they do not prove correctness.")}</p></fieldset> : assisted || word.learningMode === "recognition" ? <p className="assisted-label">{t("This is supported practice. Save Again or Hard to review it sooner; this attempt cannot earn independent recall credit.")}</p> : <p className="muted">{t("Commit your response and reveal guidance before assessing it. Lucid saves the original response and keeps it unchanged while you compare.")}</p>}
        <div className="quality-actions"><span>{t("How well could you retrieve it?")}</span>{([{ quality: 0, label: t("Again"), note: t("Could not recall") }, { quality: 1, label: t("Hard"), note: t("Partial or uncertain") }, { quality: 2, label: t("Good"), note: t("Confident recall") }, { quality: 3, label: t("Easy"), note: t("Comfortable recall") }] as const).map((item) => <button key={item.quality} disabled={item.quality >= 2 && !canRateGood} onClick={() => record(word, contextRole, item.quality)}><b>{item.label}</b><small>{item.note}</small></button>)}</div>
      </article>;
    })}</div> : <div className="empty-state"><h2>{t("You’re caught up for this role.")}</h2><p>{t("Return when a review is due. Lasting recall requires three confident independent retrieval dates, including one at least 30 days after first practice in this context.")}</p></div>}
  </>;
}

export function Library({ profile, state, bookmark, expose, day, blocked = false, publicBrowse = false }: { profile: Profile; state: State; bookmark: (id: string) => boolean; expose: (ids: readonly string[]) => boolean; day: string; blocked?: boolean; publicBrowse?: boolean }) {
  const { t, locale } = useLearningLanguage();
  const guest = useGuestAccess();
  const [listing, setListing] = useState<{ search: string; mode: "role" | "all" | "bookmarks" | "recognition"; page: number }>({ search: "", mode: publicBrowse ? "all" : "role", page: 1 });
  const [archivePage, setArchivePage] = useState(1);
  const { search, mode } = listing;
  const filtered = professionalWords.filter(entry => mode === "all" || entry.roles.includes(profile.roleId)).map(entry => contextualWord(entry.id, entry.roles.includes(profile.roleId) ? profile.roleId : entry.roles[0])!).filter(entry => (mode !== "bookmarks" || state.favouriteIds.includes(entry.id)) && (mode !== "recognition" || entry.learningMode === "recognition") && [entry.term, entry.meaning, entry.collocations.join(" "), entry.whenToUse].join(" ").toLowerCase().includes(search.toLowerCase().trim()));
  const page = dictionaryPage(filtered, { page: listing.page, headword: entry => entry.term, id: entry => entry.id });
  const archive = dictionaryPage(allWords, { page: archivePage, headword: entry => entry.word, id: entry => entry.id });
  const words = page.items;
  useEffect(() => {
    const ids = words.map(word => contextEvidenceKey(word.id, word.roles.includes(profile.roleId) ? profile.roleId : word.roles[0])).filter(id => state.learningV3.exposedOn[id] !== day);
    if (ids.length) expose(ids);
  }, [words, profile.roleId, state.learningV3.exposedOn, day, expose]);
  return <>
    <div className="page-intro"><div><span className="eyebrow">ROLE-BASED WORD LIBRARY</span><h1>Useful language, ready to revisit.</h1><p>{guest.active ? locale === "ko" ? "예문과 용법을 자유롭게 둘러보세요. 단어를 내 목록에 저장하려면 로그인하세요." : "Browse examples and usage freely. Sign in when you want to save a word to your collection." : "Read your role’s examples, collocations and common mistakes. A bookmark saves an entry; it does not award learning credit."}</p></div></div>
    <div className="library-tools"><label htmlFor="library-search" className="sr-only">Search professional words</label><input id="library-search" disabled={blocked} value={search} onChange={event => setListing(current => ({ ...current, search: event.target.value, page: 1 }))} placeholder="Search words, meanings, or collocations…" /><div className="filter-tabs">{(["role", "all", "bookmarks", "recognition"] as const).map(item => <button key={item} disabled={blocked} aria-pressed={mode === item} className={mode === item ? "active" : ""} onClick={() => item === "bookmarks" && guest.active ? guest.requestAccount("save") : setListing(current => ({ ...current, mode: item, page: 1 }))}>{item === "role" ? "For my role" : item === "all" ? "All roles" : item === "bookmarks" ? "Bookmarks" : "Recognition"}</button>)}</div></div>
    <DictionaryPagination page={page.page} totalPages={page.totalPages} totalCount={page.totalCount} label="Vocabulary pages" disabled={blocked} onPageChange={next => setListing(current => ({ ...current, page: next }))} />
    {words.length ? <div className="library-grid">{words.map(word => <article key={word.id}><div className="card-top"><span>{word.learningMode} · {word.usefulness}</span><button className="bookmark-button" aria-pressed={state.favouriteIds.includes(word.id)} aria-label={`${state.favouriteIds.includes(word.id) ? "Remove bookmark for" : "Bookmark"} ${word.term}`} onClick={() => bookmark(word.id)}>{state.favouriteIds.includes(word.id) ? "★" : "☆"}</button></div><h2 lang="en">{word.term}</h2><p className="word-meta">{word.partOfSpeech} · {word.pronunciation}</p><WordGuidance word={word} roleId={word.roles.includes(profile.roleId) ? profile.roleId : word.roles[0]} /><span className="word-state">{state.learningV3.contextMastery[contextEvidenceKey(word.id, word.roles.includes(profile.roleId) ? profile.roleId : word.roles[0])]?.mastered ? "Recall retained in this context" : contextStarted(state, word.id, word.roles.includes(profile.roleId) ? profile.roleId : word.roles[0]) ? "In practice" : "Not started"}</span></article>)}</div> : <div className="empty-state"><h2>No matching entries</h2><p>Try a shorter search or a different collection.</p></div>}
    <DictionaryPagination page={page.page} totalPages={page.totalPages} totalCount={page.totalCount} label="Vocabulary pages, bottom" disabled={blocked} onPageChange={next => setListing(current => ({ ...current, page: next }))} />
    <details className="legacy-archive"><summary>Learning history · Original Days 1–5 collection · {allWords.length} words</summary><DictionaryPagination page={archive.page} totalPages={archive.totalPages} totalCount={archive.totalCount} label="Learning history pages" disabled={blocked} onPageChange={setArchivePage} /><div className="archive-words">{archive.items.map(word => <article key={word.id}><h3>{word.word}</h3><p>{word.meaning}</p><blockquote lang="en">{word.example}</blockquote></article>)}</div></details>
    <p className="muted">{t("Your saved words and course pace stay unchanged.")}</p>
  </>;
}

function Progress({ state, day, roleId, dueCount }: { state: State; day: string; roleId: RoleId; dueCount: number }) {
  const contexts = Object.values(state.learningV3.contextMastery).filter((item) => item.roleId === roleId);
  const evidence = state.learningV3.reviewEvidence.filter((item) => item.roleId === roleId);
  const production = evidence.filter((item) => item.kind === "self-assessed-production" && item.independent && item.quality >= 2);
  const recall = evidence.filter((item) => item.kind === "unaided-recall" && item.independent);
  const recognition = new Set([...evidence.filter((item) => !item.independent).map((item) => `${item.date}:${item.senseId}`), ...Object.values(state.learningV3.rolePlans).filter((plan) => plan.roleId === roleId).flatMap((plan) => plan.completedIds.map((id) => `${plan.date}:${contextEvidenceKey(id, roleId)}`))]).size;
  const learned = Object.keys(state.learningV3.contextIntroducedOn).filter((id) => id.endsWith(`::${roleId}`)).length;
  return <><div className="page-intro"><div><span className="eyebrow">HISTORY & PROGRESS</span><h1>Watch familiarity become recall.</h1><p>Guided practice, unaided recall, self-assessed production and retained recall stay separate.</p></div></div><div className="progress-stats"><article><span>CONTEXTS STARTED</span><strong>{learned}</strong><small>in this role</small></article><article><span>INDEPENDENT PRODUCTIONS</span><strong>{production.length}</strong><small>self-assessed attempts</small></article><article><span>CURRENT STREAK</span><strong>{currentStreak(practiceDates(state).map((date) => ({ date })), day)}</strong><small>days with learning practice</small></article><article><span>RETAINED RECALL</span><strong>{contexts.filter((item) => item.mastered).length}</strong><small>{dueCount} due for review</small></article></div><div className="evidence-summary"><p><strong>{recognition}</strong> guided or recognition practices · <strong>{recall.length}</strong> unaided recall attempts · <strong>{effortPoints(state)}</strong> effort points.</p><p>Daily completion adds 20 points once across roles. Guided words earn 10, and reviews earn 5 or 15 for successful independent retrieval. Points measure practice effort.</p><p>Retained recall requires confident independent retrieval on three distinct dates, including one at least 30 days after first practice in this role’s context. A later assisted or uncertain result returns it to practice.</p><p className="muted">Earlier word history and schedules are preserved. Older self-ratings are historical records, not newly verified context mastery. Lucid does not automatically judge meaning or naturalness.</p></div><section className="history-timeline"><h2>Your daily practice history</h2>{state.dailySessions.length ? [...state.dailySessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).map((session) => <article key={session.id}><time>{session.date}</time><div><small>{professionalRoles.find((item) => item.id === session.roleId)?.shortLabel}</small><h3>{session.wordIds.map((id) => contextualWord(id, session.roleId)?.term).filter(Boolean).join(" · ")}</h3></div><span>Complete ✓</span></article>) : <p>Your first completed daily practice will appear here.</p>}</section><section className="mastery-evidence"><h2>Your context review schedule</h2><div>{contexts.map((item) => <article key={item.senseId}><strong>{contextualWord(item.wordId, roleId)?.term}</strong><span>Next review: {item.nextReviewOn}</span><small>{item.mastered ? "Recall retained in this context" : "In practice"} · {item.reviewCount} review days</small></article>)}</div>{!contexts.length && <p>Start a guided word or review to build evidence for this role.</p>}</section></>;
}

function SettingsPanel({ state, commit, scopeKey, editProfile, needsRecovery, onRecover, onDraftChange }: { state: State; commit: Commit; scopeKey: string; editProfile: () => void; onDraftChange: (dirty: boolean) => void; needsRecovery: boolean; onRecover: (value: unknown, restoreProfile?: boolean) => Promise<boolean> }) {
  const guest = useGuestAccess();
  const { locale } = useLearningLanguage();
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => commit((current) => ({ ...current, settings: { ...current.settings, [key]: value }, learningV3: { ...current.learningV3, updatedAt: stamp() } }), scopeKey);
  const [notificationMessage, setNotificationMessage] = useState(""); const [zoneDraft, setZoneDraft] = useState(state.settings.timeZone); const [zoneError, setZoneError] = useState("");
  const [backupValue, setBackupValue] = useState<unknown>(null); const [backupName, setBackupName] = useState(""); const [backupMessage, setBackupMessage] = useState(""); const [restoreProfile, setRestoreProfile] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState(false);
  useEffect(() => { onDraftChange(zoneDraft !== state.settings.timeZone || backupValue !== null || feedbackDraft); }, [zoneDraft, state.settings.timeZone, backupValue, feedbackDraft, onDraftChange]);
  useEffect(() => () => onDraftChange(false), [onDraftChange]);
  const notifications = async (enabled: boolean) => { if (typeof Notification === "undefined") { setNotificationMessage("This browser does not support notifications."); return; } const permission = enabled && Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission; const allowed = enabled && permission === "granted"; update("notificationsEnabled", allowed); setNotificationMessage(enabled && !allowed ? "Notifications are blocked. You can still practise whenever you open Lucid." : ""); };
  const saveZone = () => { try { new Intl.DateTimeFormat("en", { timeZone: zoneDraft }).format(); if (update("timeZone", zoneDraft)) setZoneError(""); } catch { setZoneError("Enter a valid time zone, such as Europe/London or Asia/Dubai."); } };
  const downloadBackup = () => {
    if (guest.active) { guest.requestAccount("save"); return; }
    try {
      const blob = new Blob([JSON.stringify(exportPortableBackup(state), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `Lucid-learning-${dayAt(state.settings.timeZone)}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupMessage("Backup prepared. Save it somewhere private; it includes your personal practice drafts.");
    } catch { setBackupMessage("Could not prepare this backup. Your learning remains on this device."); }
  };
  const readBackup = async (file?: File) => {
    if (guest.active) { guest.requestAccount("save"); return; }
    if (!file) return; setBackupValue(null); setBackupName("");
    try { if (file.size > 2_000_000) throw new Error("This backup is too large. Choose a Lucid learning backup under 2 MB."); const value: unknown = JSON.parse(await file.text()); importPortableBackup(value, state, initialState, false); setBackupValue(value); setBackupName(file.name); setRestoreProfile(false); setBackupMessage("Backup checked. Review the options below, then choose Merge backup to import it."); }
    catch (error) { setBackupMessage(error instanceof Error ? error.message : "This is not a compatible Lucid backup."); }
  };
  const mergeBackup = async () => {
    if (!backupValue) return;
    if (needsRecovery) { const restored = await onRecover(backupValue, restoreProfile); setBackupMessage(restored ? "Backup restored after preserving your earlier record." : "Could not restore this backup. Keep it safe and retry when your session and device storage are available."); if (restored) setBackupValue(null); return; }
    try { let accepted = false; const saved = commit((current) => { accepted = true; return importPortableBackup(backupValue, current, initialState, restoreProfile); }, scopeKey); if (saved && accepted) { setBackupValue(null); setBackupName(""); setBackupMessage("Backup merged. Your existing history stays with you. Check your course and review schedule."); } else setBackupMessage("This backup could not be saved. It is still ready here; retry before leaving."); }
    catch (error) { setBackupMessage(error instanceof Error ? error.message : "Could not merge the backup."); }
  };
  return <><LearningLanguageChoice /><LearningCoverageNote /><div className="page-intro"><div><span className="eyebrow">SETTINGS</span><h1>Keep practice comfortable.</h1><p>Set a manageable pace and a time that suits your day.</p></div></div><div className="settings-sections"><section><div><h2>Professional profile</h2><p>{professionalRoles.find((item) => item.id === state.profile?.roleId)?.label}</p><p>{seniorityLevels.find((item) => item.id === state.profile?.seniorityId)?.label}</p></div><button className="secondary-button" onClick={editProfile}>Edit learning profile</button></section><section><div><h2>Daily pace</h2><p>A pace change applies to your next new plan. Today’s saved cards stay stable.</p></div><div className="setting-fields"><label htmlFor="daily-count">New words per day</label><select id="daily-count" value={state.settings.dailyWordCount ?? 3} onChange={(event) => update("dailyWordCount", Number(event.target.value) as 1 | 2 | 3)}><option value={1}>1 word · a small step</option><option value={2}>2 words · steady practice</option><option value={3}>3 words · a focused session</option></select><label htmlFor="text-size">Text size</label><select id="text-size" value={state.settings.textSize} onChange={(event) => update("textSize", event.target.value as Settings["textSize"])}><option value="normal">Normal</option><option value="large">Large</option></select></div></section><section><div><h2>Daily schedule</h2><p>Browser alerts work while Lucid is open. Learning days follow your selected time zone.</p></div><div className="setting-fields"><label htmlFor="lesson-time">Lesson time</label><input id="lesson-time" type="time" value={state.settings.lessonTime} onChange={(event) => update("lessonTime", event.target.value)} /><label htmlFor="time-zone">Time zone</label><input id="time-zone" list="time-zone-options" value={zoneDraft} onChange={(event) => setZoneDraft(event.target.value)} /><datalist id="time-zone-options">{["Etc/UTC", "Asia/Dubai", "Asia/Kolkata", "Europe/London", "America/New_York", "America/Los_Angeles"].map((zone) => <option key={zone} value={zone} />)}</datalist><button className="secondary-button" onClick={saveZone}>Save time zone</button>{zoneError && <p role="alert">{zoneError}</p>}<label className="checkbox-line"><input type="checkbox" checked={state.settings.notificationsEnabled} onChange={(event) => void notifications(event.target.checked)} /> Lesson notifications</label>{notificationMessage && <p role="status">{notificationMessage}</p>}</div></section><section className="portable-backup"><div><h2>Learning backup</h2><p>{guest.active ? locale === "ko" ? "새 게스트 학습은 현재 세션에만 임시 보관됩니다. 진도를 저장하거나 백업을 가져오려면 로그인하세요. 이전 기기 기록은 그대로 보존되며 위의 안내에서 원본 백업을 내려받을 수 있습니다." : "New guest practice is temporary for this session. Sign in to save progress or import a backup. Earlier local records are preserved; download their original backup from the notice above." : "Export or import a compatible learning backup yourself. A verified learner account can synchronize supported progress when shared sign-in is enabled. Private writing stays on its original device unless you explicitly move a backup."}</p><p>Private writing, original responses and retry text stay on this device. Safe lesson checkpoints, starting checks and practice history can sync through your verified account. A downloaded backup includes private drafts, so keep it private.</p></div><div className="setting-fields"><button className="secondary-button" onClick={downloadBackup}>{guest.active ? locale === "ko" ? "진도를 저장하려면 로그인" : "Sign in to save progress" : "Export learning backup"}</button><label htmlFor="backup-file">Choose a Lucid backup from web or mobile</label><input id="backup-file" type="file" disabled={guest.active} accept=".json,application/json" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void readBackup(file); }} />{backupValue !== null && <div className="backup-preview"><strong>{backupName}</strong><p>Existing history and bookmarks will be merged. This explicit import also restores private writing and drafts that account sync leaves on their original device.</p><label className="checkbox-line"><input type="checkbox" checked={restoreProfile} onChange={(event) => setRestoreProfile(event.target.checked)} /> Also use this backup’s role, goals and preferences</label><div className="button-row"><button className="primary-button" onClick={() => void mergeBackup()}>{needsRecovery ? "Restore backup" : "Merge backup"}</button><button className="secondary-button" disabled={needsRecovery} onClick={() => { setBackupValue(null); setBackupMessage("Import cancelled. Your current progress is unchanged."); }}>Cancel import</button></div></div>}{backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}</div></section><BetaFeedback onDraftChange={setFeedbackDraft} roleId={state.profile?.roleId ?? "consulting-strategy"} onSaved={() => commit((current) => ({ ...current, betaFeedbackSubmittedAt: stamp() }), scopeKey)} /></div></>;
}

function BetaFeedback({ roleId, onSaved, onDraftChange }: { roleId: RoleId; onSaved: () => boolean; onDraftChange: (dirty: boolean) => void }) {
  const [rating, setRating] = useState(0); const [helpful, setHelpful] = useState(""); const [confusing, setConfusing] = useState(""); const [missing, setMissing] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { onDraftChange(busy || rating > 0 || Boolean(helpful || confusing || missing)); }, [busy, rating, helpful, confusing, missing, onDraftChange]);
  useEffect(() => () => onDraftChange(false), [onDraftChange]);
  const submit = async () => { if (!rating || !helpful.trim()) { setStatus("Choose a rating and tell us what helped."); return; } setBusy(true); setStatus("Sending…"); try { const deviceId = window.localStorage.getItem("lucid-device-id"); const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json", ...(deviceId ? { "x-lucid-device-id": deviceId } : {}) }, body: JSON.stringify({ roleId, rating, helpful, confusing, missing }) }); if (!response.ok) throw new Error(); if (onSaved()) { setRating(0); setHelpful(""); setConfusing(""); setMissing(""); } setStatus("Thank you. Your beta feedback has been saved."); } catch { setStatus("We could not send that yet. Your answers remain on this screen."); } finally { setBusy(false); } };
  return <section className="beta-feedback"><div><h2>Beta feedback</h2><p>What helped you retrieve a word or use it in a real moment? Please leave out confidential work details.</p></div><div className="feedback-form"><fieldset><legend>How useful was today’s experience?</legend><div className="rating-row">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-pressed={rating === value} className={rating === value ? "active" : ""} onClick={() => setRating(value)}>{value}</button>)}</div></fieldset><label htmlFor="feedback-helpful">What helped you most?</label><textarea id="feedback-helpful" value={helpful} onChange={(event) => setHelpful(event.target.value)} rows={3} /><label htmlFor="feedback-confusing">What felt confusing?</label><textarea id="feedback-confusing" value={confusing} onChange={(event) => setConfusing(event.target.value)} rows={3} /><label htmlFor="feedback-missing">What should Lucid add next?</label><textarea id="feedback-missing" value={missing} onChange={(event) => setMissing(event.target.value)} rows={3} /><button className="primary-button" disabled={busy} onClick={() => void submit()}>Send beta feedback</button><p role="status">{status}</p></div></section>;
}

function RecoveryPanel({ onRestore }: { onRestore: (value: unknown, restoreProfile?: boolean) => Promise<boolean> }) {
  const { t, locale } = useLearningLanguage();
  const guest = useGuestAccess();
  const [value, setValue] = useState<unknown>(null); const [name, setName] = useState(""); const [restoreProfile, setRestoreProfile] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  if (guest.active) return <details className="onboarding-backup"><summary>{t("Restore a learning backup")}</summary><p>{locale === "ko" ? "백업을 계정에 가져오려면 로그인하세요. 이전 기기 기록은 그대로 보관되며 위의 안내에서 원본 백업을 내려받을 수 있습니다." : "Sign in to import a backup into your account. Earlier local records stay unchanged; download their original backup from the notice above."}</p><button className="secondary-button" onClick={() => guest.requestAccount("save")}>{locale === "ko" ? "계정 옵션 보기" : "Open account options"}</button></details>;
  const choose = async (file?: File) => {
    if (!file) return; setValue(null); setName("");
    try { if (file.size > 2_000_000) throw new Error("Choose a Lucid backup under 2 MB."); const data: unknown = JSON.parse(await file.text()); setValue(data); setName(file.name); setMessage("Ready to check and restore this backup. Lucid will reconnect to confirm where this progress should be restored."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "This backup could not be read."); }
  };
  const restore = async () => {
    if (!value || busy) return; setBusy(true);
    try { const restored = await onRestore(value, restoreProfile); setMessage(restored ? "Backup restored. You can continue your learning." : "Could not restore this backup. Keep it safe, reconnect or make storage available, then retry. Existing saved bytes have not been discarded."); if (restored) setValue(null); }
    catch { setMessage("Could not restore this backup. Keep it safe and retry when learning storage is available."); }
    finally { setBusy(false); }
  };
  return <details className="onboarding-backup"><summary>{t("Restore a learning backup")}</summary><p>{t("Choose a Lucid web or mobile backup. This manually imports progress into your current web session. A damaged local record is archived before replacement; if that archive cannot be saved, restoration stops.")}</p><label htmlFor="recovery-file">{t("Lucid backup")}<input id="recovery-file" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void choose(file); }} /></label>{value !== null && <><p><strong>{name}</strong></p><label className="checkbox-line"><input type="checkbox" checked={restoreProfile} disabled={busy} onChange={(event) => setRestoreProfile(event.target.checked)} /> {t("Also restore this backup’s role, goals and preferences")}</label><button className="secondary-button" disabled={busy} onClick={() => void restore()}>{busy ? t("Checking and restoring…") : t("Check and restore backup")}</button></>}{message && <p role="status">{t(message)}</p>}</details>;
}
