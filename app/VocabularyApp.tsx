"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  communicationGoals,
  professionalRoles,
  professionalWords,
  seniorityLevels,
  type GoalId,
  type ProfessionalWord,
  type RoleId,
  type SeniorityId,
  type SituationId,
} from "../lib/professional-content";
import {
  createDailyPlan,
  createWordMastery,
  evaluateUsage,
  isWordMastered,
  reviewWord,
  SRS_INTERVAL_DAYS,
  type LearnerProfile,
  type ReviewQuality,
  type TaggedWord,
  type UsageFeedback,
  type WordMastery,
} from "../lib/learning-engine";
import { allWords } from "../lib/vocabulary-data";

type View = "today" | "practice" | "library" | "progress" | "settings";
type LessonStatus = "not_started" | "in_progress" | "completed";

type LearnerProfileState = {
  roleId: RoleId;
  seniorityId: SeniorityId;
  situationIds: SituationId[];
  goalIds: GoalId[];
};

type DailySession = {
  id: string;
  date: string;
  roleId: RoleId;
  situationId: SituationId;
  wordIds: string[];
  completedAt: string;
};

type UsageAttempt = {
  sentence: string;
  feedback: UsageFeedback;
  checkedAt: string;
  source: "written" | "spoken";
};

type QuizAttempt = {
  id: string;
  completedAt: string;
  durationSeconds: number;
  score: number;
  total: number;
  mistakeWordIds: string[];
};

type Settings = {
  lessonTime: string;
  timeZone: string;
  notificationsEnabled: boolean;
  generationMode: "advance-on-open" | "calendar-day";
  difficulty: string;
  audioRate: number;
  textSize: "normal" | "large";
};

type AppState = {
  version: number;
  profile: LearnerProfileState | null;
  introducedWordIds: string[];
  masteryByWordId: Record<string, WordMastery>;
  dailySessions: DailySession[];
  usageAttempts: Record<string, UsageAttempt>;
  betaFeedbackSubmittedAt: string | null;
  lessonStatus: LessonStatus;
  lessonWordProgress: number;
  completedDays: number[];
  difficultIds: string[];
  favouriteIds: string[];
  reviewedIds: string[];
  masteryScores: Record<string, number>;
  reviewDates: Record<string, string[]>;
  nextReviewAt: Record<string, string>;
  exerciseAnswers: Record<string, string>;
  exerciseSubmitted: boolean;
  exerciseRevealed: boolean;
  quizAnswers: Record<string, string>;
  quizAttempts: QuizAttempt[];
  currentQuizSubmitted: boolean;
  settings: Settings;
  lastNotificationDate: string | null;
};

type LearningWord = TaggedWord & {
  source: ProfessionalWord;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: unknown) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

const navItems: Array<{ id: View; label: string; mark: string }> = [
  { id: "today", label: "Today", mark: "01" },
  { id: "practice", label: "Practice", mark: "02" },
  { id: "library", label: "Library", mark: "03" },
  { id: "progress", label: "Progress", mark: "04" },
  { id: "settings", label: "Settings", mark: "05" },
];

const initialState: AppState = {
  version: 2,
  profile: null,
  introducedWordIds: [],
  masteryByWordId: {},
  dailySessions: [],
  usageAttempts: {},
  betaFeedbackSubmittedAt: null,
  lessonStatus: "not_started",
  lessonWordProgress: 0,
  completedDays: [1, 2, 3, 4],
  difficultIds: [],
  favouriteIds: [],
  reviewedIds: [],
  masteryScores: {},
  reviewDates: {},
  nextReviewAt: {},
  exerciseAnswers: {},
  exerciseSubmitted: false,
  exerciseRevealed: false,
  quizAnswers: {},
  quizAttempts: [],
  currentQuizSubmitted: false,
  settings: {
    lessonTime: "09:00",
    timeZone: "Asia/Dubai",
    notificationsEnabled: false,
    generationMode: "calendar-day",
    difficulty: "upper-B2-to-C1",
    audioRate: 0.9,
    textSize: "normal",
  },
  lastNotificationDate: null,
};

const usefulnessScore = { essential: 5, high: 4, specialist: 3 } as const;
const difficultyScore = { "upper-b2": 3, c1: 4 } as const;
const seniorityForEngine: Record<SeniorityId, LearnerProfile["seniority"]> = {
  "early-career": "entry",
  "experienced-contributor": "mid",
  manager: "senior",
  "senior-leader": "lead",
  executive: "executive",
};

const learningWords: readonly LearningWord[] = professionalWords.map((word) => ({
  id: word.id,
  active: word.learningMode === "active",
  roles: word.roles,
  situations: word.situations,
  goals: word.goals,
  usefulness: usefulnessScore[word.usefulness],
  difficulty: difficultyScore[word.difficulty],
  source: word,
}));

function mergeState(saved: unknown): AppState {
  if (!saved || typeof saved !== "object") return initialState;
  const next = saved as Partial<AppState>;
  return {
    ...initialState,
    ...next,
    settings: { ...initialState.settings, ...(next.settings ?? {}) },
    masteryByWordId: next.masteryByWordId ?? {},
    dailySessions: next.dailySessions ?? [],
    introducedWordIds: next.introducedWordIds ?? [],
    usageAttempts: next.usageAttempts ?? {},
  };
}

function engineProfile(profile: LearnerProfileState): LearnerProfile {
  return {
    role: profile.roleId,
    seniority: seniorityForEngine[profile.seniorityId],
    situations: profile.situationIds,
    goals: profile.goalIds,
  };
}

function formatDisplayDate(date: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(date + "T12:00:00Z"));
}

function feedbackLabel(score: number) {
  if (score >= 85) return "Strong professional use";
  if (score >= 65) return "Promising — refine it";
  return "Needs more context";
}

function getWord(id: string) {
  return professionalWords.find((word) => word.id === id);
}

function consecutiveStreak(sessions: DailySession[]) {
  const dates = [...new Set(sessions.map((session) => session.date))].sort().reverse();
  if (!dates.length) return 0;
  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(dates[index - 1] + "T00:00:00Z").getTime();
    const current = new Date(dates[index] + "T00:00:00Z").getTime();
    if ((previous - current) / 86_400_000 !== 1) break;
    streak += 1;
  }
  return streak;
}

export default function VocabularyApp({
  initialDate,
  initialGreeting,
}: {
  initialDate: string;
  initialGreeting: string;
}) {
  const [view, setView] = useState<View>("today");
  const [state, setState] = useState<AppState>(initialState);
  const [syncReady, setSyncReady] = useState(false);
  const [syncLabel, setSyncLabel] = useState("Connecting…");
  const [editingProfile, setEditingProfile] = useState(false);
  const [practiceDrafts, setPracticeDrafts] = useState<Record<string, string>>({});
  const [listeningWordId, setListeningWordId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const deviceId = window.localStorage.getItem("lucid-device-id") ?? crypto.randomUUID();
    window.localStorage.setItem("lucid-device-id", deviceId);
    fetch("/api/state", { headers: { "x-lucid-device-id": deviceId } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load saved progress");
        return response.json() as Promise<{ state: unknown }>;
      })
      .then(({ state: saved }) => {
        if (!active) return;
        setState(mergeState(saved));
        setSyncLabel("Progress saved");
      })
      .catch(() => {
        if (!active) return;
        const cached = window.localStorage.getItem("lucid-offline-state");
        if (cached) {
          try {
            setState(mergeState(JSON.parse(cached)));
          } catch {
            // Ignore a corrupt device cache; durable state remains authoritative.
          }
        }
        setSyncLabel("Offline — progress is cached");
      })
      .finally(() => {
        if (active) setSyncReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const retry = () => setSyncLabel("Reconnecting…");
    window.addEventListener("online", retry);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    if (!syncReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    queueMicrotask(() => setSyncLabel("Saving…"));
    window.localStorage.setItem("lucid-offline-state", JSON.stringify(state));
    saveTimer.current = setTimeout(() => {
      const deviceId = window.localStorage.getItem("lucid-device-id") ?? crypto.randomUUID();
      window.localStorage.setItem("lucid-device-id", deviceId);
      fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-lucid-device-id": deviceId },
        body: JSON.stringify({ state }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Save failed");
          setSyncLabel("Progress saved");
        })
        .catch(() => setSyncLabel("Offline — progress is cached"));
    }, 550);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, syncReady]);

  useEffect(() => {
    if (!state.settings.notificationsEnabled || typeof Notification === "undefined") return;
    const checkReminder = () => {
      const now = new Date();
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: state.settings.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: state.settings.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(now);
      if (
        Notification.permission === "granted" &&
        localTime >= state.settings.lessonTime &&
        state.lastNotificationDate !== localDate
      ) {
        new Notification("Your role-specific Lucid session is ready.", {
          body: "Three active words, due review, and one workplace mission.",
        });
        setTimeout(() => setState((current) => ({ ...current, lastNotificationDate: localDate })), 0);
      }
    };
    checkReminder();
    const reminderTimer = window.setInterval(checkReminder, 60_000);
    return () => window.clearInterval(reminderTimer);
  }, [state.lastNotificationDate, state.settings.lessonTime, state.settings.notificationsEnabled, state.settings.timeZone]);

  const profile = state.profile;
  const selectedRole = profile ? professionalRoles.find((role) => role.id === profile.roleId) : undefined;
  const todaySession = state.dailySessions.find((session) => session.date === initialDate);
  const eligibleSituations = selectedRole?.situations.filter((item) => profile?.situationIds.includes(item.id)) ?? [];
  const situationIndex = eligibleSituations.length ? Number(initialDate.replaceAll("-", "")) % eligibleSituations.length : 0;
  const selectedSituation = todaySession
    ? selectedRole?.situations.find((item) => item.id === todaySession.situationId)
    : eligibleSituations[situationIndex] ?? selectedRole?.situations[0];
  const selectedGoal = communicationGoals.find((goal) =>
    profile?.goalIds.includes(goal.id) && (!selectedSituation || selectedSituation.goalIds.includes(goal.id))
  ) ?? communicationGoals.find((goal) => profile?.goalIds.includes(goal.id));

  const plan = useMemo(() => {
    if (!profile) return null;
    return createDailyPlan({
      date: initialDate,
      profile: engineProfile(profile),
      words: learningWords,
      introducedWordIds: state.introducedWordIds,
      masteryByWordId: state.masteryByWordId,
      newWordCount: 3,
    });
  }, [initialDate, profile, state.introducedWordIds, state.masteryByWordId]);

  const activeWords = useMemo(() => {
    if (todaySession) {
      return todaySession.wordIds.map(getWord).filter((word): word is ProfessionalWord => Boolean(word));
    }
    return plan?.activeNewWords.map((item) => item.word.source) ?? [];
  }, [plan, todaySession]);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProfile = (nextProfile: LearnerProfileState) => {
    setState((current) => ({ ...current, profile: nextProfile, version: 2 }));
    setEditingProfile(false);
    setView("today");
  };

  const speak = (word: ProfessionalWord) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.term);
    utterance.lang = "en-GB";
    utterance.rate = state.settings.audioRate;
    window.speechSynthesis.speak(utterance);
  };

  const checkUsage = (word: ProfessionalWord, source: "written" | "spoken", transcript?: string) => {
    const sentence = (transcript ?? practiceDrafts[word.id] ?? "").trim();
    if (!sentence) return;
    const partOfSpeech = ["noun", "verb", "adjective", "adverb"].includes(word.partOfSpeech)
      ? word.partOfSpeech as "noun" | "verb" | "adjective" | "adverb"
      : undefined;
    const feedback = evaluateUsage({
      sentence,
      targetWord: word.term,
      partOfSpeech,
      meaning: word.meaning,
      expectedCollocations: word.collocations,
    });
    setPracticeDrafts((current) => ({ ...current, [word.id]: sentence }));
    setState((current) => ({
      ...current,
      usageAttempts: {
        ...current.usageAttempts,
        [word.id]: {
          sentence,
          feedback,
          checkedAt: new Date().toISOString(),
          source,
        },
      },
    }));
  };

  const startSpokenPractice = (word: ProfessionalWord) => {
    const recognitionConstructor = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).SpeechRecognition ?? (
      window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).webkitSpeechRecognition;
    if (!recognitionConstructor) {
      setPracticeDrafts((current) => ({
        ...current,
        [word.id]: current[word.id] ?? "Spoken practice is not supported in this browser. Type what you would say instead.",
      }));
      return;
    }
    const recognition = new recognitionConstructor();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.continuous = false;
    setListeningWordId(word.id);
    recognition.onresult = (event: unknown) => {
      const result = event as { results?: { [key: number]: { [key: number]: { transcript?: string } } } };
      const transcript = result.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) checkUsage(word, "spoken", transcript);
    };
    recognition.onerror = () => setListeningWordId(null);
    recognition.onend = () => setListeningWordId(null);
    recognition.start();
  };

  const completeToday = () => {
    if (!profile || !selectedSituation || todaySession || activeWords.length === 0) return;
    const masteryByWordId = { ...state.masteryByWordId };
    for (const word of activeWords) {
      masteryByWordId[word.id] = masteryByWordId[word.id] ?? createWordMastery(word.id, initialDate);
    }
    const session: DailySession = {
      id: crypto.randomUUID(),
      date: initialDate,
      roleId: profile.roleId,
      situationId: selectedSituation.id,
      wordIds: activeWords.map((word) => word.id),
      completedAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      lessonStatus: "completed",
      lessonWordProgress: 3,
      introducedWordIds: [...new Set([...current.introducedWordIds, ...session.wordIds])],
      masteryByWordId,
      dailySessions: [...current.dailySessions, session],
    }));
  };

  const recordReview = (wordId: string, quality: ReviewQuality) => {
    const existing = state.masteryByWordId[wordId] ?? createWordMastery(wordId, initialDate);
    const next = reviewWord(existing, {
      reviewedOn: initialDate,
      quality,
      productive: quality >= 2,
    });
    setState((current) => ({
      ...current,
      masteryByWordId: { ...current.masteryByWordId, [wordId]: next },
      reviewedIds: [...new Set([...current.reviewedIds, wordId])],
      difficultIds: quality < 2
        ? [...new Set([...current.difficultIds, wordId])]
        : current.difficultIds.filter((id) => id !== wordId),
    }));
  };

  const updateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setState((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  };

  const requestNotifications = async (enabled: boolean) => {
    let allowed = enabled;
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      allowed = (await Notification.requestPermission()) === "granted";
    }
    updateSettings("notificationsEnabled", allowed);
  };

  if (!syncReady) {
    return <LoadingScreen />;
  }

  if (!profile || editingProfile) {
    return <Onboarding initialProfile={profile} onComplete={saveProfile} onCancel={profile ? () => setEditingProfile(false) : undefined} />;
  }

  return (
    <div className={"app-shell phase-two text-" + state.settings.textSize}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate("today")} aria-label="Lucid home">
          <span className="wordmark-glyph" aria-hidden="true">L</span>
          <span>Lucid</span>
          <small>Professional English</small>
        </button>
        <div className="topbar-meta">
          <span className="sync-status" role="status" aria-live="polite"><i aria-hidden="true" />{syncLabel}</span>
          <span className="time-chip">{selectedRole?.shortLabel} · {seniorityLevels.find((level) => level.id === profile.seniorityId)?.label}</span>
          <span className="avatar" aria-label={"Learning profile: " + selectedRole?.label}>{selectedRole?.shortLabel.slice(0, 1)}</span>
        </div>
      </header>

      <aside className="sidebar" aria-label="Primary navigation">
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
              <span>{item.mark}</span>{item.label}
              {item.id === "practice" && <b>{Math.min(99, plan?.dueReviews.length ?? 0)}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note role-note">
          <span>YOUR PROFESSIONAL PATH</span>
          <p>{selectedRole?.shortLabel}</p>
          <small>{selectedGoal?.label ?? "Precise communication"}</small>
        </div>
      </aside>

      <main id="main-content" className="main-content">
        {view === "today" && selectedRole && selectedSituation && (
          <TodayView
            date={initialDate}
            greeting={initialGreeting}
            role={selectedRole}
            situation={selectedSituation}
            goalPrompt={selectedGoal?.coachingPrompt}
            activeWords={activeWords}
            dueCount={plan?.dueReviews.length ?? 0}
            completed={Boolean(todaySession)}
            attempts={state.usageAttempts}
            drafts={practiceDrafts}
            listeningWordId={listeningWordId}
            setDrafts={setPracticeDrafts}
            speak={speak}
            checkUsage={checkUsage}
            startSpokenPractice={startSpokenPractice}
            completeToday={completeToday}
            navigate={navigate}
            displayDate={formatDisplayDate(initialDate, state.settings.timeZone)}
          />
        )}
        {view === "practice" && (
          <PracticeView
            dueReviews={plan?.dueReviews ?? []}
            masteryByWordId={state.masteryByWordId}
            recordReview={recordReview}
            speak={speak}
          />
        )}
        {view === "library" && (
          <LibraryView profile={profile} speak={speak} />
        )}
        {view === "progress" && (
          <ProgressView state={state} dueCount={plan?.dueReviews.length ?? 0} />
        )}
        {view === "settings" && (
          <SettingsView
            state={state}
            roleLabel={selectedRole?.label ?? ""}
            requestNotifications={requestNotifications}
            updateSettings={updateSettings}
            editProfile={() => setEditingProfile(true)}
            markFeedbackSubmitted={() => setState((current) => ({ ...current, betaFeedbackSubmittedAt: new Date().toISOString() }))}
          />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
            <span>{item.mark}</span>{item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="loading-screen">
      <span className="wordmark-glyph" aria-hidden="true">L</span>
      <h1>Lucid</h1>
      <p>Preparing your professional English path…</p>
    </main>
  );
}

function Onboarding({
  initialProfile,
  onComplete,
  onCancel,
}: {
  initialProfile: LearnerProfileState | null;
  onComplete: (profile: LearnerProfileState) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(initialProfile ? 1 : 0);
  const [roleId, setRoleId] = useState<RoleId | "">(initialProfile?.roleId ?? "");
  const [seniorityId, setSeniorityId] = useState<SeniorityId | "">(initialProfile?.seniorityId ?? "");
  const [situationIds, setSituationIds] = useState<SituationId[]>(initialProfile?.situationIds ?? []);
  const [goalIds, setGoalIds] = useState<GoalId[]>(initialProfile?.goalIds ?? []);
  const role = professionalRoles.find((item) => item.id === roleId);

  const chooseRole = (id: RoleId) => {
    const nextRole = professionalRoles.find((item) => item.id === id);
    setRoleId(id);
    setSituationIds([]);
    setGoalIds(nextRole?.defaultGoalIds.slice(0, 2) as GoalId[] ?? []);
  };

  const toggleSituation = (id: SituationId) => {
    setSituationIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  };

  const toggleGoal = (id: GoalId) => {
    setGoalIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  };

  const canContinue =
    (step === 0 && Boolean(roleId)) ||
    (step === 1 && Boolean(seniorityId)) ||
    (step === 2 && situationIds.length > 0) ||
    (step === 3 && goalIds.length > 0);

  const finish = () => {
    if (!roleId || !seniorityId || !situationIds.length || !goalIds.length) return;
    onComplete({ roleId, seniorityId, situationIds, goalIds });
  };

  const headings = [
    ["Professional role", "Where do you use English most?"],
    ["Seniority", "What kind of communication do you own?"],
    ["Communication situations", "Choose the moments that matter every week."],
    ["Learning goals", "How do you want your language to work harder?"],
  ];

  return (
    <div className="onboarding-shell">
      <header className="onboarding-header">
        <div className="static-wordmark"><span className="wordmark-glyph">L</span><strong>Lucid</strong><small>Professional English for your role</small></div>
        {onCancel && <button onClick={onCancel}>Cancel</button>}
      </header>
      <nav className="onboarding-progress" aria-label="Onboarding progress">
        {headings.map(([label], index) => <span key={label} className={step === index ? "active" : step > index ? "done" : ""}>{index + 1}<small>{label}</small></span>)}
      </nav>
      <main className="onboarding-main">
        <span className="eyebrow">YOUR PERSONAL LEARNING PATH · {step + 1} OF 4</span>
        <h1>{headings[step][1]}</h1>
        <p>Lucid will select three active words and realistic practice from your professional context.</p>

        {step === 0 && <div className="choice-grid role-choice-grid">
          {professionalRoles.map((item) => <button key={item.id} className={roleId === item.id ? "selected" : ""} onClick={() => chooseRole(item.id)}><span>{item.shortLabel.slice(0, 1)}</span><strong>{item.label}</strong><small>{item.description}</small></button>)}
        </div>}

        {step === 1 && <div className="choice-grid seniority-grid">
          {seniorityLevels.map((item) => <button key={item.id} className={seniorityId === item.id ? "selected" : ""} onClick={() => setSeniorityId(item.id)}><strong>{item.label}</strong><small>{item.description}</small><em>{item.communicationFocus}</em></button>)}
        </div>}

        {step === 2 && <div className="choice-grid situation-grid">
          {role?.situations.map((item) => <button key={item.id} className={situationIds.includes(item.id) ? "selected" : ""} onClick={() => toggleSituation(item.id)}><strong>{item.label}</strong><small>{item.description}</small><em>{situationIds.includes(item.id) ? "Selected ✓" : "Select situation"}</em></button>)}
        </div>}

        {step === 3 && <div className="choice-grid goals-grid">
          {communicationGoals.map((item) => <button key={item.id} className={goalIds.includes(item.id) ? "selected" : ""} onClick={() => toggleGoal(item.id)}><strong>{item.label}</strong><small>{item.outcome}</small><em>{goalIds.includes(item.id) ? "Selected ✓" : "Select goal"}</em></button>)}
        </div>}

        <div className="onboarding-actions">
          <button className="secondary-button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>
          {step < 3
            ? <button className="primary-button" disabled={!canContinue} onClick={() => setStep((current) => Math.min(3, current + 1))}>Continue <span aria-hidden="true">→</span></button>
            : <button className="primary-button" disabled={!canContinue} onClick={finish}>Build my daily path <span aria-hidden="true">→</span></button>}
        </div>
      </main>
    </div>
  );
}

function TodayView({
  greeting,
  role,
  situation,
  goalPrompt,
  activeWords,
  dueCount,
  completed,
  attempts,
  drafts,
  listeningWordId,
  setDrafts,
  speak,
  checkUsage,
  startSpokenPractice,
  completeToday,
  navigate,
  displayDate,
}: {
  date: string;
  greeting: string;
  role: (typeof professionalRoles)[number];
  situation: (typeof professionalRoles)[number]["situations"][number];
  goalPrompt?: string;
  activeWords: ProfessionalWord[];
  dueCount: number;
  completed: boolean;
  attempts: Record<string, UsageAttempt>;
  drafts: Record<string, string>;
  listeningWordId: string | null;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  speak: (word: ProfessionalWord) => void;
  checkUsage: (word: ProfessionalWord, source: "written" | "spoken", transcript?: string) => void;
  startSpokenPractice: (word: ProfessionalWord) => void;
  completeToday: () => void;
  navigate: (view: View) => void;
  displayDate: string;
}) {
  const hasProductivePractice = activeWords.some((word) => Boolean(attempts[word.id]));
  return (
    <>
      <div className="page-intro coach-intro">
        <div><span className="eyebrow">{displayDate.toUpperCase()}</span><h1>{greeting}</h1><p>Three words selected for your role. Learn them deeply, practise them in context, then use one at work.</p></div>
        <div className="lesson-progress" aria-label={(completed ? 3 : 0) + " of 3 active words completed"}><span>{completed ? "Daily mission completed" : "0 / 3 active words"}</span><i><b style={{ width: completed ? "100%" : "8%" }} /></i></div>
      </div>

      <section className="coach-hero">
        <div className="scenario-copy">
          <span className="hero-kicker"><b>YOUR WORKPLACE SCENARIO</b><i />{role.shortLabel}</span>
          <h2>{situation.label}</h2>
          <p>{situation.description}</p>
          <blockquote>{goalPrompt ?? "What does your listener need to understand or do next?"}</blockquote>
          <div className="scenario-meta"><span><strong>3</strong> active words</span><span><strong>{dueCount}</strong> due review</span><span><strong>10</strong> focused minutes</span></div>
        </div>
        <div className="mission-card">
          <small>TODAY&apos;S OUTCOME</small>
          <strong>Use one precise word in a real professional moment.</strong>
          <p>Meeting, email, presentation, feedback, or decision note—it only counts when the language becomes yours.</p>
          {dueCount > 0 && <button onClick={() => navigate("practice")}>Review due words first →</button>}
        </div>
      </section>

      {completed && <div className="completion-banner" role="status"><span>✓</span><div><strong>Today&apos;s loop is complete.</strong><p>Your three words will return on the 1 / 3 / 7 / 14 / 30-day review ladder.</p></div></div>}

      <section className="active-word-section">
        <div className="section-heading"><div><span className="eyebrow">THREE ACTIVE WORDS</span><h2>Learn less. Use more.</h2></div><p>Chosen by role, situation, goal, usefulness, and difficulty.</p></div>
        <div className="professional-word-grid">
          {activeWords.map((word, index) => (
            <article className="professional-word-card" key={word.id}>
              <div className="professional-word-top"><span>{String(index + 1).padStart(2, "0")} · {word.learningMode} vocabulary</span><b>{word.difficulty.replace("-", " ")}</b></div>
              <div className="professional-word-title"><span className="role-emblem">{role.shortLabel.slice(0, 1)}</span><div><h3>{word.term}</h3><button onClick={() => speak(word)}>▶ {word.pronunciation}</button><small>{word.partOfSpeech}</small></div></div>
              <p className="word-meaning">{word.meaning}</p>
              <div className="usage-guidance"><div><small>WHEN TO USE</small><p>{word.whenToUse}</p></div><div className="avoid-guidance"><small>AVOID THIS</small><p>{word.avoidOrMisuse}</p></div></div>
              <div className="collocation-list"><small>COLLOCATIONS</small>{word.collocations.map((item) => <span key={item}>{item}</span>)}</div>
              <blockquote>{word.example}</blockquote>
              <div className="word-mission"><small>WORKPLACE MISSION</small><p>{word.mission}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="practice-lab">
        <div className="practice-lab-header"><span className="eyebrow">PUT THE WORDS TO WORK</span><h2>Written practice and spoken practice</h2><p>Write or say a real sentence from your job. Lucid checks transparent surface signals and shows exactly what it can—and cannot—judge.</p></div>
        <div className="practice-prompt-grid">
          {activeWords.map((word) => {
            const attempt = attempts[word.id];
            return <article key={word.id}>
              <div><strong>{word.term}</strong><small>{word.mission}</small></div>
              <label htmlFor={"practice-" + word.id}>Your professional sentence</label>
              <textarea id={"practice-" + word.id} value={drafts[word.id] ?? attempt?.sentence ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [word.id]: event.target.value }))} rows={4} placeholder={"Use “" + word.term + "” in a meeting, email, or decision."} />
              <div className="practice-actions">
                <button onClick={() => startSpokenPractice(word)}>{listeningWordId === word.id ? "Listening…" : "● Spoken practice"}</button>
                <button className="primary-button" onClick={() => checkUsage(word, "written")}>Check my usage</button>
              </div>
              {attempt && <div className="usage-feedback" role="status">
                <div className="feedback-score"><strong>{attempt.feedback.overallScore}</strong><span>/100</span></div>
                <div><b>{feedbackLabel(attempt.feedback.overallScore)}</b><p>{attempt.feedback.suggestions[0] ?? "The configured checks found no immediate surface issue."}</p><small>{attempt.feedback.limitation}</small></div>
              </div>}
            </article>;
          })}
        </div>
      </section>

      <section className="complete-daily-mission">
        <div><span className="eyebrow">CLOSE THE LOOP</span><h2>{completed ? "You showed up and used the language." : "Make today count."}</h2><p>{completed ? "Come back tomorrow for a fresh professional scenario and your due review." : "Complete today after you have practised the words. They will enter your adaptive review schedule."}</p></div>
        <button className="primary-button" disabled={completed || activeWords.length < 3 || !hasProductivePractice} onClick={completeToday}>{completed ? "Completed ✓" : hasProductivePractice ? "Complete daily mission" : "Practise one word first"} </button>
      </section>
    </>
  );
}

function PracticeView({
  dueReviews,
  masteryByWordId,
  recordReview,
  speak,
}: {
  dueReviews: readonly { word: LearningWord; mastery: WordMastery; overdueDays: number }[];
  masteryByWordId: Record<string, WordMastery>;
  recordReview: (wordId: string, quality: ReviewQuality) => void;
  speak: (word: ProfessionalWord) => void;
}) {
  return (
    <>
      <div className="page-intro"><div><span className="eyebrow">ADAPTIVE PRACTICE</span><h1>Retrieve before you recognise.</h1><p>Words return after 1, 3, 7, 14, and 30 days. A word is mastered only after successful productive use on three separate dates and retention after day 30.</p></div><div className="due-badge"><strong>{dueReviews.length}</strong><span>due now</span></div></div>
      <div className="srs-ladder" aria-label="Spaced review schedule">{SRS_INTERVAL_DAYS.map((days, index) => <span key={days}><b>{days}</b><small>{days === 1 ? "day" : "days"}</small>{index < SRS_INTERVAL_DAYS.length - 1 && <i>→</i>}</span>)}</div>
      {dueReviews.length ? <div className="due-review-list">
        {dueReviews.map(({ word, mastery, overdueDays }) => <article key={word.id}>
          <div className="review-word-copy"><small>{overdueDays > 0 ? overdueDays + " days overdue" : "Due today"}</small><h2>{word.source.term}</h2><button onClick={() => speak(word.source)}>▶ {word.source.pronunciation}</button><p>Recall the meaning and say a natural workplace sentence before revealing the guidance.</p><details><summary>Reveal guidance</summary><p>{word.source.meaning}</p><blockquote>{word.source.example}</blockquote></details></div>
          <div className="quality-actions"><span>How well did you produce it?</span><button onClick={() => recordReview(word.id, 0)}><b>Again</b><small>1 day</small></button><button onClick={() => recordReview(word.id, 1)}><b>Hard</b><small>step back</small></button><button onClick={() => recordReview(word.id, 2)}><b>Good</b><small>advance</small></button><button onClick={() => recordReview(word.id, 3)}><b>Easy</b><small>advance ×2</small></button><em>{mastery.reviewCount} previous reviews</em></div>
        </article>)}
      </div> : <div className="empty-state"><strong>You&apos;re caught up.</strong><p>Complete today&apos;s mission or return when the next scheduled review is due.</p></div>}
      {Object.keys(masteryByWordId).length > 0 && <section className="mastery-evidence"><span className="eyebrow">YOUR ACTIVE VOCABULARY</span><div>{Object.values(masteryByWordId).slice(0, 12).map((mastery) => { const word = getWord(mastery.wordId); return word ? <span key={mastery.wordId}><b>{word.term}</b><small>Next: {mastery.nextReviewOn}</small><em>{isWordMastered(mastery) ? "Mastered" : "In practice"}</em></span> : null; })}</div></section>}
    </>
  );
}

function LibraryView({ profile, speak }: { profile: LearnerProfileState; speak: (word: ProfessionalWord) => void }) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"role" | "all" | "recognition">("role");
  const words = professionalWords.filter((word) => {
    const matchesMode = mode === "all" || (mode === "role" && word.roles.includes(profile.roleId)) || (mode === "recognition" && word.learningMode === "recognition");
    const haystack = [word.term, word.meaning, word.collocations.join(" "), word.whenToUse].join(" ").toLowerCase();
    return matchesMode && haystack.includes(search.toLowerCase());
  });
  return (
    <>
      <div className="page-intro"><div><span className="eyebrow">ROLE-BASED WORD LIBRARY</span><h1>Useful language, not obscure language.</h1><p>Every entry is tagged by professional role, daily situation, usefulness, difficulty, seniority, and communication goal.</p></div></div>
      <div className="library-tools"><label><span className="sr-only">Search professional words</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search words, meanings, or collocations…" /></label><div>{(["role", "all", "recognition"] as const).map((item) => <button className={mode === item ? "active" : ""} onClick={() => setMode(item)} key={item}>{item === "role" ? "For my role" : item}</button>)}</div></div>
      <div className="library-grid">{words.map((word) => <article key={word.id}><div><span>{word.learningMode}</span><b>{word.usefulness}</b></div><h2>{word.term}</h2><button onClick={() => speak(word)}>▶ {word.pronunciation}</button><p>{word.meaning}</p><small>WHEN TO USE</small><p>{word.whenToUse}</p><em>{word.collocations.slice(0, 2).join(" · ")}</em></article>)}</div>
      <details className="legacy-archive"><summary>Learning history · Original Days 1–5 collection · {allWords.length} words</summary><div>{allWords.map((word) => <span key={word.id}><b>{word.word}</b><small>{word.meaning}</small></span>)}</div></details>
    </>
  );
}

function ProgressView({ state, dueCount }: { state: AppState; dueCount: number }) {
  const mastery = Object.values(state.masteryByWordId);
  const mastered = mastery.filter(isWordMastered).length;
  const productive = Object.keys(state.usageAttempts).length;
  return (
    <>
      <div className="page-intro"><div><span className="eyebrow">HISTORY & PROGRESS</span><h1>Measure language you can use.</h1><p>Lucid tracks productive practice, scheduled retention, and professional missions—not exposure alone.</p></div></div>
      <div className="progress-stats"><article><span>ACTIVE WORDS</span><strong>{state.introducedWordIds.length}</strong><small>introduced through your role</small></article><article><span>PRODUCTIVE USES</span><strong>{productive}</strong><small>written or spoken</small></article><article><span>CURRENT STREAK</span><strong>{consecutiveStreak(state.dailySessions)}</strong><small>completed daily missions</small></article><article><span>MASTERED</span><strong>{mastered}</strong><small>{dueCount} due for review</small></article></div>
      <section className="history-timeline"><div><span className="eyebrow">DAILY MISSION HISTORY</span><h2>What you practised</h2></div>{state.dailySessions.length ? [...state.dailySessions].reverse().map((session) => <article key={session.id}><time>{session.date}</time><div><small>{professionalRoles.find((role) => role.id === session.roleId)?.shortLabel}</small><h3>{professionalRoles.flatMap((role) => role.situations).find((item) => item.id === session.situationId)?.label}</h3><p>{session.wordIds.map((id) => getWord(id)?.term).filter(Boolean).join(" · ")}</p></div><span>Complete ✓</span></article>) : <p>Your first completed daily mission will appear here.</p>}</section>
      <section className="retention-explainer"><span className="eyebrow">MASTERY STANDARD</span><h2>Recognition is not ownership.</h2><div><p><b>1.</b> Produce the word correctly on at least three distinct dates.</p><p><b>2.</b> Retain it in productive practice at least 30 days after introduction.</p><p><b>3.</b> Recover from later lapses before it returns to Mastered.</p></div></section>
    </>
  );
}

function SettingsView({
  state,
  roleLabel,
  requestNotifications,
  updateSettings,
  editProfile,
  markFeedbackSubmitted,
}: {
  state: AppState;
  roleLabel: string;
  requestNotifications: (enabled: boolean) => Promise<void>;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  editProfile: () => void;
  markFeedbackSubmitted: () => void;
}) {
  return (
    <>
      <div className="page-intro"><div><span className="eyebrow">SETTINGS & BETA</span><h1>Keep Lucid relevant to your work.</h1><p>Update your professional path, schedule your practice, and tell us what should improve before the wider launch.</p></div></div>
      <div className="settings-sections">
        <section><div><span>01</span><h2>Professional profile</h2><p>Your words and scenarios are selected from your role, seniority, communication situations, and learning goals.</p></div><div className="profile-summary"><strong>{roleLabel}</strong><span>{seniorityLevels.find((item) => item.id === state.profile?.seniorityId)?.label}</span><p>{state.profile?.situationIds.length} situations · {state.profile?.goalIds.length} goals</p><button onClick={editProfile}>Edit learning profile →</button></div></section>
        <section>
          <div><span>02</span><h2>Daily schedule</h2><p>Browser alerts work while Lucid is open. Your lesson remains available even when notifications are off.</p></div>
          <div className="setting-fields">
            <div className="field-group"><label htmlFor="lesson-time">Lesson time</label><input id="lesson-time" type="time" value={state.settings.lessonTime} onChange={(event) => updateSettings("lessonTime", event.target.value)} /></div>
            <div className="field-group"><label htmlFor="time-zone">Time zone</label><select id="time-zone" value={state.settings.timeZone} onChange={(event) => updateSettings("timeZone", event.target.value)}><option value="Asia/Dubai">Asia/Dubai</option><option value="Asia/Kolkata">Asia/Kolkata</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></div>
            <label className="toggle-field" htmlFor="notifications"><span><b>Lesson notifications</b><small>One reminder at your selected local time</small></span><input id="notifications" aria-label="Lesson notifications" type="checkbox" checked={state.settings.notificationsEnabled} onChange={(event) => requestNotifications(event.target.checked)} /></label>
          </div>
        </section>
        <section>
          <div><span>03</span><h2>Learning experience</h2><p>Adjust reading comfort and pronunciation playback.</p></div>
          <div className="setting-fields">
            <div className="field-group"><label htmlFor="audio-speed">Audio speed</label><select id="audio-speed" value={state.settings.audioRate} onChange={(event) => updateSettings("audioRate", Number(event.target.value))}><option value={0.7}>Slow · 0.7×</option><option value={0.9}>Natural · 0.9×</option><option value={1}>Standard · 1×</option></select></div>
            <div className="field-group"><label htmlFor="text-size">Text size</label><select id="text-size" value={state.settings.textSize} onChange={(event) => updateSettings("textSize", event.target.value as Settings["textSize"])}><option value="normal">Normal</option><option value="large">Large</option></select></div>
          </div>
        </section>
        <BetaFeedback roleId={state.profile?.roleId ?? "consulting-strategy"} submitted={Boolean(state.betaFeedbackSubmittedAt)} onSubmitted={markFeedbackSubmitted} />
      </div>
    </>
  );
}

function BetaFeedback({ roleId, submitted, onSubmitted }: { roleId: RoleId; submitted: boolean; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [helpful, setHelpful] = useState("");
  const [confusing, setConfusing] = useState("");
  const [missing, setMissing] = useState("");
  const [status, setStatus] = useState("");

  const submit = async () => {
    if (!rating || !helpful.trim()) {
      setStatus("Choose a rating and tell us what helped.");
      return;
    }
    setStatus("Sending…");
    const deviceId = window.localStorage.getItem("lucid-device-id") ?? crypto.randomUUID();
    window.localStorage.setItem("lucid-device-id", deviceId);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-lucid-device-id": deviceId },
        body: JSON.stringify({ roleId, rating, helpful, confusing, missing }),
      });
      if (!response.ok) throw new Error("Unable to save feedback");
      setStatus("Thank you. Your beta feedback has been saved.");
      onSubmitted();
    } catch {
      setStatus("We could not send that yet. Your answers remain on this screen.");
    }
  };

  return (
    <section className="beta-feedback"><div><span>04</span><h2>Beta feedback</h2><p>Designed for the first 10–20 professional testers. No email content or confidential work information is requested.</p></div><div className="feedback-form">
      {submitted && <div className="feedback-thanks">Feedback already submitted—you can send another update after more practice.</div>}
      <fieldset><legend>How useful was today&apos;s experience?</legend><div className="rating-row">{[1, 2, 3, 4, 5].map((value) => <button type="button" aria-pressed={rating === value} className={rating === value ? "active" : ""} onClick={() => setRating(value)} key={value}>{value}<small>{value === 1 ? "Low" : value === 5 ? "High" : ""}</small></button>)}</div></fieldset>
      <label>What helped you most?<textarea rows={3} value={helpful} onChange={(event) => setHelpful(event.target.value)} placeholder="A specific card, scenario, or practice moment…" /></label>
      <label>What felt confusing?<textarea rows={3} value={confusing} onChange={(event) => setConfusing(event.target.value)} /></label>
      <label>What should Lucid add next?<textarea rows={3} value={missing} onChange={(event) => setMissing(event.target.value)} /></label>
      <button className="primary-button" onClick={submit}>Send beta feedback</button><p className="form-status" role="status">{status}</p>
    </div></section>
  );
}
