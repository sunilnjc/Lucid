"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  allWords,
  categories,
  dailyExercise,
  dayFiveQuiz,
  dayFiveWords,
  lessonDates,
  seedWords,
  type Category,
  type QuizQuestion,
  type VocabularyWord,
} from "../lib/vocabulary-data";

type View = "home" | "lesson" | "history" | "review" | "progress" | "settings";
type LessonStatus = "not_started" | "in_progress" | "completed";

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

const initialMastery = Object.fromEntries(seedWords.map((item) => [item.id, 0]));

const initialState: AppState = {
  version: 1,
  lessonStatus: "not_started",
  lessonWordProgress: 0,
  completedDays: [1, 2, 3, 4],
  difficultIds: [],
  favouriteIds: [],
  reviewedIds: [],
  masteryScores: initialMastery,
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
    notificationsEnabled: true,
    generationMode: "advance-on-open",
    difficulty: "upper-B2-to-C1",
    audioRate: 0.9,
    textSize: "normal",
  },
  lastNotificationDate: null,
};

const navItems: Array<{ id: View; label: string; mark: string }> = [
  { id: "home", label: "Today", mark: "01" },
  { id: "lesson", label: "Lesson", mark: "02" },
  { id: "history", label: "History", mark: "03" },
  { id: "review", label: "Review", mark: "04" },
  { id: "progress", label: "Progress", mark: "05" },
  { id: "settings", label: "Settings", mark: "06" },
];

const categoryNames: Record<Category, string> = {
  emotions: "Emotions",
  intellectual: "Intellectual conversation",
  leadership: "Leadership",
};

function mergeState(saved: unknown): AppState {
  if (!saved || typeof saved !== "object") return initialState;
  const next = saved as Partial<AppState>;
  return {
    ...initialState,
    ...next,
    settings: { ...initialState.settings, ...(next.settings ?? {}) },
    masteryScores: { ...initialState.masteryScores, ...(next.masteryScores ?? {}) },
    reviewDates: next.reviewDates ?? {},
    nextReviewAt: next.nextReviewAt ?? {},
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const copy = [...items];
  let value = seed || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const swapIndex = Math.floor((value / 233280) * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/[.!?,;:]+$/g, "");
}

const sentenceSignals: Record<string, RegExp> = {
  wistful: /memory|remember|miss|past|childhood|old|used to|longing|nostalg/i,
  reconcile: /with|and|between|competing|conflict|priority|priorities|difference/i,
  vulnerable: /feel|felt|emotion|critic|hurt|share|open|admit|trust/i,
  pragmatic: /decision|approach|choice|solution|practical|constraint|result/i,
};

const naturalSentenceExamples: Record<string, string> = {
  wistful: "I felt wistful when I found photographs from our old neighbourhood.",
  reconcile: "We must reconcile the need for speed with our security obligations.",
  vulnerable: "I felt vulnerable when I admitted that the criticism had hurt me.",
  pragmatic: "We made a pragmatic decision to fix the highest-risk issue first.",
};

function sentenceUsesWord(value: string, target: string) {
  const escaped = target.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const complete = new RegExp(`\\b${escaped}\\b`, "i").test(value) && value.trim().split(/\s+/).length >= 6;
  return complete && (sentenceSignals[target.toLowerCase()]?.test(value) ?? true);
}

function stateLabel(score: number, difficult: boolean, distinctDates = 0) {
  if (difficult) return "Difficult";
  if (score >= 6 && distinctDates >= 3) return "Mastered";
  if (score >= 3) return "Familiar";
  if (score > 0) return "Learning";
  return "New";
}

function wordsForDay(day: number) {
  return allWords.filter((item) => item.day === day);
}

export default function VocabularyApp() {
  const [view, setView] = useState<View>("home");
  const [state, setState] = useState<AppState>(initialState);
  const [syncReady, setSyncReady] = useState(false);
  const [syncLabel, setSyncLabel] = useState("Connecting…");
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizSeed, setQuizSeed] = useState(517);
  const [quizStartedAt, setQuizStartedAt] = useState(0);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "difficult" | "favourite" | "quiz">("all");
  const [historyDay, setHistoryDay] = useState<number | null>(null);
  const [reviewLimit, setReviewLimit] = useState(5);
  const [reviewCategory, setReviewCategory] = useState<"all" | Category>("all");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);
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
            // A corrupt device cache is ignored; D1 remains authoritative.
          }
        }
        setSyncLabel("Saving will resume when connected");
      })
      .finally(() => {
        if (active) setSyncReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const retry = () => setSyncNonce((value) => value + 1);
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
        .catch(() => setSyncLabel("Saving will resume when connected"));
    }, 550);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, syncReady, syncNonce]);

  useEffect(() => {
    if (!state.settings.notificationsEnabled || typeof Notification === "undefined") return;
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
      new Notification("Your Day 5 lesson and review quiz are ready.", {
        body: "10 new words, a quick exercise, and your first spaced review.",
      });
      setTimeout(() => setState((current) => ({ ...current, lastNotificationDate: localDate })), 0);
    }
  }, [state.lastNotificationDate, state.settings.lessonTime, state.settings.notificationsEnabled, state.settings.timeZone]);

  const quizQuestions = useMemo(
    () => shuffle(dayFiveQuiz, quizSeed).map((question) => ({ ...question, options: question.options ? shuffle(question.options, quizSeed + Number(question.id.slice(1)) * 31) : undefined })),
    [quizSeed],
  );

  const reviewWords = useMemo(() => {
    const difficult = allWords.filter((item) => state.difficultIds.includes(item.id));
    const standardDue = seedWords.filter((item) => (state.masteryScores[item.id] ?? 0) < 3);
    const unique = [...difficult, ...standardDue].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index);
    return unique.filter((item) => reviewCategory === "all" || item.category === reviewCategory).slice(0, reviewLimit);
  }, [reviewCategory, reviewLimit, state.difficultIds, state.masteryScores]);

  const navigate = (next: View) => {
    setView(next);
    setHistoryDay(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateState = <K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const toggleList = (key: "difficultIds" | "favouriteIds", id: string) => {
    setState((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
    }));
  };

  const startLesson = () => {
    setState((current) => ({ ...current, lessonStatus: current.lessonStatus === "not_started" ? "in_progress" : current.lessonStatus }));
    navigate("lesson");
  };

  const speak = (item: VocabularyWord) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(item.word);
    utterance.lang = "en-GB";
    utterance.rate = state.settings.audioRate;
    window.speechSynthesis.speak(utterance);
  };

  const submitExercise = () => {
    const scoreChanges: Record<string, number> = {};
    const missedTargets: string[] = [];
    dailyExercise.forEach((question) => {
      const response = state.exerciseAnswers[question.id] ?? "";
      const correct = question.type === "fill" ? normalise(response) === question.answer : sentenceUsesWord(response, question.answer);
      const target = dayFiveWords.find((item) => item.word.toLowerCase() === question.answer)?.id;
      if (target) scoreChanges[target] = correct ? (question.type === "sentence" ? 2 : 1) : -0.5;
      if (target && !correct) missedTargets.push(target);
    });
    setState((current) => ({
      ...current,
      exerciseSubmitted: true,
      difficultIds: [...new Set([...current.difficultIds, ...missedTargets])],
      masteryScores: Object.fromEntries(
        Object.keys({ ...current.masteryScores, ...scoreChanges }).map((id) => [
          id,
          Math.max(0, (current.masteryScores[id] ?? 0) + (scoreChanges[id] ?? 0)),
        ]),
      ),
    }));
  };

  const startQuiz = () => {
    const nextSeed = Date.now() % 100000;
    setQuizSeed(nextSeed);
    setQuizStartedAt(Date.now());
    setQuizOpen(true);
    setState((current) => ({ ...current, quizAnswers: {}, currentQuizSubmitted: false }));
    setTimeout(() => document.getElementById("review-quiz")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const submitQuiz = () => {
    let score = 0;
    const mistakes: string[] = [];
    const nextMastery = { ...state.masteryScores };
    const nextReviewDates = { ...state.reviewDates };
    const today = new Date().toISOString();
    dayFiveQuiz.forEach((question) => {
      const response = state.quizAnswers[question.id] ?? "";
      const correct = question.type === "sentence" ? sentenceUsesWord(response, question.answer) : normalise(response) === normalise(question.answer);
      const target = allWords.find((item) => item.word.toLowerCase() === question.word.toLowerCase());
      if (correct) {
        score += 1;
        if (target) {
          nextMastery[target.id] = (nextMastery[target.id] ?? 0) + (question.type === "sentence" ? 2 : question.type === "fill" ? 1 : 0.5);
          nextReviewDates[target.id] = [...(nextReviewDates[target.id] ?? []), today];
        }
      } else if (target) {
        mistakes.push(target.id);
        nextMastery[target.id] = Math.max(0, (nextMastery[target.id] ?? 0) - 0.5);
      }
    });
    const attempt: QuizAttempt = {
      id: crypto.randomUUID(),
      completedAt: today,
      durationSeconds: Math.max(1, Math.round((Date.now() - quizStartedAt) / 1000)),
      score,
      total: dayFiveQuiz.length,
      mistakeWordIds: mistakes,
    };
    setState((current) => ({
      ...current,
      currentQuizSubmitted: true,
      quizAttempts: [...current.quizAttempts, attempt],
      masteryScores: nextMastery,
      reviewDates: nextReviewDates,
      nextReviewAt: Object.fromEntries(Object.keys(nextReviewDates).map((id) => [id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()])),
      difficultIds: [...new Set([...current.difficultIds, ...mistakes])],
    }));
  };

  const retakeQuiz = () => {
    setState((current) => ({ ...current, quizAnswers: {}, currentQuizSubmitted: false }));
    setQuizSeed(Date.now() % 100000);
    setQuizStartedAt(Date.now());
    setQuizOpen(true);
  };

  const completeLesson = () => {
    setState((current) => ({
      ...current,
      lessonStatus: "completed",
      lessonWordProgress: 10,
      completedDays: current.completedDays.includes(5) ? current.completedDays : [...current.completedDays, 5],
    }));
    navigate("home");
  };

  const markReview = (item: VocabularyWord, remembered: boolean) => {
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      reviewedIds: [...new Set([...current.reviewedIds, item.id])],
      masteryScores: {
        ...current.masteryScores,
        [item.id]: Math.max(0, (current.masteryScores[item.id] ?? 0) + (remembered ? 1 : -0.5)),
      },
      reviewDates: remembered ? { ...current.reviewDates, [item.id]: [...(current.reviewDates[item.id] ?? []), now] } : current.reviewDates,
      nextReviewAt: { ...current.nextReviewAt, [item.id]: new Date(Date.now() + (remembered ? 3 : 1) * 24 * 60 * 60 * 1000).toISOString() },
      difficultIds: remembered ? current.difficultIds : [...new Set([...current.difficultIds, item.id])],
    }));
    setFlashcardFlipped(false);
    setReviewIndex((current) => Math.min(current + 1, Math.max(0, reviewWords.length - 1)));
  };

  const requestNotifications = async (enabled: boolean) => {
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      enabled = permission === "granted";
    }
    setState((current) => ({ ...current, settings: { ...current.settings, notificationsEnabled: enabled } }));
  };

  const download = (format: "json" | "markdown") => {
    const payload = format === "json"
      ? JSON.stringify({ preferences: state.settings, progress: state, words: allWords }, null, 2)
      : allWords.map((item) => `### ${item.word} *(${item.partOfSpeech})*\n\n- Pronunciation: ${item.pronunciation}${item.ipa ? ` · ${item.ipa}` : ""}\n- Meaning: ${item.meaning}\n- Example: *${item.example}*\n- Category: ${categoryNames[item.category]}\n- Day: ${item.day}`).join("\n\n");
    const blob = new Blob([payload], { type: format === "json" ? "application/json" : "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lucid-vocabulary.${format === "json" ? "json" : "md"}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const resetProgress = () => {
    if (window.confirm("Reset all lesson, quiz, and review progress? Your preferences will also return to their defaults.")) {
      setState(initialState);
      navigate("home");
    }
  };

  return (
    <div className={`app-shell text-${state.settings.textSize}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate("home")} aria-label="Lucid home">
          <span className="wordmark-glyph" aria-hidden="true">L</span>
          <span>Lucid</span>
          <small>Vocabulary coach</small>
        </button>
        <div className="topbar-meta">
          <span className="sync-status" role="status" aria-live="polite"><i aria-hidden="true" />{syncLabel}</span>
          <span className="time-chip">{state.settings.lessonTime} · {state.settings.timeZone.replace("Asia/", "")}</span>
          <span className="avatar" aria-label="Learner profile: Sunil">S</span>
        </div>
      </header>

      <aside className="sidebar" aria-label="Primary navigation">
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
              <span>{item.mark}</span>{item.label}
              {item.id === "review" && <b>{Math.min(9, reviewWords.length)}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>DAY 5 · QUIZ DAY</span>
          <p>Precision gives your thoughts a shape other people can hold.</p>
          <small>Today’s coach note</small>
        </div>
      </aside>

      <main id="main-content" className="main-content">
        {view === "home" && (
          <HomeView state={state} startLesson={startLesson} navigate={navigate} reviewCount={reviewWords.length} />
        )}
        {view === "lesson" && (
          <LessonView
            state={state}
            setState={setState}
            speak={speak}
            toggleList={toggleList}
            submitExercise={submitExercise}
            startQuiz={startQuiz}
            quizOpen={quizOpen}
            quizQuestions={quizQuestions}
            submitQuiz={submitQuiz}
            retakeQuiz={retakeQuiz}
            completeLesson={completeLesson}
          />
        )}
        {view === "history" && (
          <HistoryView
            state={state}
            search={historySearch}
            setSearch={setHistorySearch}
            filter={historyFilter}
            setFilter={setHistoryFilter}
            selectedDay={historyDay}
            setSelectedDay={setHistoryDay}
            speak={speak}
          />
        )}
        {view === "review" && (
          <ReviewView
            words={reviewWords}
            state={state}
            limit={reviewLimit}
            setLimit={setReviewLimit}
            category={reviewCategory}
            setCategory={setReviewCategory}
            index={reviewIndex}
            setIndex={setReviewIndex}
            flipped={flashcardFlipped}
            setFlipped={setFlashcardFlipped}
            markReview={markReview}
            speak={speak}
          />
        )}
        {view === "progress" && <ProgressView state={state} />}
        {view === "settings" && (
          <SettingsView state={state} updateState={updateState} requestNotifications={requestNotifications} download={download} resetProgress={resetProgress} />
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

function PageIntro({ eyebrow, title, copy, aside }: { eyebrow: string; title: string; copy: string; aside?: React.ReactNode }) {
  return (
    <div className="page-intro">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{copy}</p></div>
      {aside}
    </div>
  );
}

function HomeView({ state, startLesson, navigate, reviewCount }: { state: AppState; startLesson: () => void; navigate: (view: View) => void; reviewCount: number }) {
  const progress = state.lessonStatus === "completed" ? 100 : state.lessonStatus === "in_progress" ? Math.max(12, state.lessonWordProgress * 10) : 0;
  const statusText = state.lessonStatus === "completed" ? "Completed" : state.lessonStatus === "in_progress" ? "In progress" : "Ready to begin";
  return (
    <>
      <PageIntro eyebrow="MONDAY · 17 AUGUST" title="Good evening, Sunil." copy="Your fifth lesson is ready when you are. Take ten focused minutes and leave with sharper language." aside={<button className="quiet-button" onClick={() => navigate("settings")}>Lesson settings</button>} />

      <section className="lesson-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><span>DAY 5</span><i />REVIEW QUIZ TODAY</div>
          <h2>Words for the moments that ask more of you.</h2>
          <p>Ten precise words for naming complex feelings, challenging assumptions, and leading steadily.</p>
          <div className="category-pills" aria-label="Lesson category split">
            <span>4 <small>Emotions</small></span><span>3 <small>Intellect</small></span><span>3 <small>Leadership</small></span>
          </div>
          <button className="primary-button" onClick={startLesson}>{state.lessonStatus === "not_started" ? "Start Day 5" : state.lessonStatus === "completed" ? "Revisit lesson" : "Continue lesson"}<span aria-hidden="true">→</span></button>
        </div>
        <div className="lesson-orbit" aria-label={`${progress}% lesson progress`} style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
          <div><strong>{progress}%</strong><span>{statusText}</span></div>
          <b className="orbit-word word-one">Wistful</b><b className="orbit-word word-two">Incisive</b><b className="orbit-word word-three">Unflappable</b>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="stat-panel review-panel">
          <div className="panel-heading"><span className="panel-icon">R</span><div><small>REVIEW QUEUE</small><h3>{reviewCount} words are due</h3></div><button onClick={() => navigate("review")}>Review now →</button></div>
          <div className="review-stack">
            {seedWords.slice(0, 3).map((item, index) => <span key={item.id} style={{ "--index": index } as React.CSSProperties}><b>{item.word}</b><small>{categoryNames[item.category]}</small></span>)}
            <i>+{Math.max(0, reviewCount - 3)}</i>
          </div>
        </article>
        <article className="stat-panel streak-panel">
          <small>CURRENT STREAK</small><div><strong>{state.completedDays.length}</strong><span>days</span></div>
          <div className="week-dots" aria-label="Five learning days"><i className="done">M</i><i className="done">T</i><i className="done">W</i><i className="done">T</i><i className={state.completedDays.includes(5) ? "done" : "today"}>F</i></div>
          <p>One lesson at a time. Your longest streak is {Math.max(4, state.completedDays.length)} days.</p>
        </article>
        <article className="stat-panel quiz-panel">
          <div><small>NEXT MILESTONE</small><h3>First review quiz</h3><p>15 questions from Days 1–4, after today’s new words.</p></div>
          <span className="quiz-score">{state.quizAttempts.length ? `${state.quizAttempts.at(-1)?.score}/15` : "DAY 5"}</span>
        </article>
      </section>

      <section className="word-preview-section">
        <div className="section-heading"><div><span className="eyebrow">A FIRST LOOK</span><h2>Three words you’ll meet today</h2></div><button onClick={startLesson}>See all ten →</button></div>
        <div className="word-preview-grid">
          {[dayFiveWords[0], dayFiveWords[4], dayFiveWords[7]].map((item, index) => (
            <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><small>{categoryNames[item.category]}</small><h3>{item.word}</h3><i>{item.partOfSpeech} · {item.pronunciation}</i><p>{item.meaning}</p></article>
          ))}
        </div>
      </section>
    </>
  );
}

function WordCard({ item, index, state, speak, toggleList }: { item: VocabularyWord; index: number; state: AppState; speak: (item: VocabularyWord) => void; toggleList: (key: "difficultIds" | "favouriteIds", id: string) => void }) {
  const difficult = state.difficultIds.includes(item.id);
  const favourite = state.favouriteIds.includes(item.id);
  return (
    <article className="word-card">
      <div className="word-card-top"><span>{String(index + 1).padStart(2, "0")}</span><div className="word-actions"><button className={favourite ? "selected" : ""} onClick={() => toggleList("favouriteIds", item.id)} aria-pressed={favourite} aria-label={`${favourite ? "Remove" : "Add"} ${item.word} ${favourite ? "from" : "to"} favourites`}>☆</button><button className={difficult ? "selected difficult" : ""} onClick={() => toggleList("difficultIds", item.id)} aria-pressed={difficult}>Difficult</button></div></div>
      <small>{categoryNames[item.category]}</small>
      <h3>{item.word} <i>{item.partOfSpeech}</i></h3>
      <button className="pronunciation" onClick={() => speak(item)} aria-label={`Play pronunciation for ${item.word}`}><span aria-hidden="true">▶</span>{item.pronunciation}{item.ipa && <i>{item.ipa}</i>}</button>
      <p>{item.meaning}</p>
      <blockquote>{item.example}</blockquote>
    </article>
  );
}

function LessonView({ state, setState, speak, toggleList, submitExercise, startQuiz, quizOpen, quizQuestions, submitQuiz, retakeQuiz, completeLesson }: {
  state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; speak: (item: VocabularyWord) => void; toggleList: (key: "difficultIds" | "favouriteIds", id: string) => void; submitExercise: () => void; startQuiz: () => void; quizOpen: boolean; quizQuestions: QuizQuestion[]; submitQuiz: () => void; retakeQuiz: () => void; completeLesson: () => void;
}) {
  return (
    <>
      <PageIntro eyebrow="MAKE YOUR MEANING UNMISTAKABLE" title="Day 5 — Advanced English Practice" copy="Move through each category, listen to the words aloud, then practise using them in context." aside={<div className="lesson-progress" aria-label={`${state.lessonStatus === "completed" ? 10 : state.lessonWordProgress} of 10 words read`}><span>{state.lessonStatus === "completed" ? 10 : state.lessonWordProgress} / 10 words</span><i><b style={{ width: `${state.lessonStatus === "completed" ? 100 : state.lessonWordProgress * 10}%` }} /></i></div>} />
      {categories.map((category) => {
        const words = dayFiveWords.filter((item) => item.category === category.id);
        const offset = category.id === "emotions" ? 0 : category.id === "intellectual" ? 4 : 7;
        return (
          <section className={`lesson-category category-${category.id}`} key={category.id}>
            <div className="category-heading"><div><span>{category.eyebrow}</span><h2>{category.label}</h2></div><b>{words.length} words</b></div>
            <div className="word-card-grid">
              {words.map((item, index) => <WordCard key={item.id} item={item} index={index + offset} state={state} speak={speak} toggleList={toggleList} />)}
            </div>
            <button className="category-check" onClick={() => setState((current) => ({ ...current, lessonStatus: "in_progress", lessonWordProgress: Math.max(current.lessonWordProgress, offset + words.length) }))}>Mark section read <span aria-hidden="true">✓</span></button>
          </section>
        );
      })}

      <section className="exercise-section">
        <div className="exercise-header"><div><span className="eyebrow">QUICK USAGE EXERCISE</span><h2>Put the words to work.</h2><p>Complete five sentences, then write two of your own. Answers stay private until you submit.</p></div><span>7 prompts · about 5 min</span></div>
        <div className="word-bank"><small>WORD BANK</small>{dayFiveWords.map((item) => <span key={item.id}>{item.word}</span>)}</div>
        <div className="exercise-list">
          {dailyExercise.map((question, index) => {
            const response = state.exerciseAnswers[question.id] ?? "";
            const correct = question.type === "fill" ? normalise(response) === question.answer : sentenceUsesWord(response, question.answer);
            const showFeedback = state.exerciseSubmitted || state.exerciseRevealed;
            return (
              <article key={question.id} className={showFeedback ? (correct ? "answer-correct" : "answer-incorrect") : ""}>
                <div className="question-number">{String(index + 1).padStart(2, "0")}</div>
                <div className="question-body"><label htmlFor={question.id}>{question.prompt}</label>
                  {question.type === "fill" ? <input id={question.id} value={response} disabled={state.exerciseSubmitted} onChange={(event) => setState((current) => ({ ...current, exerciseAnswers: { ...current.exerciseAnswers, [question.id]: event.target.value } }))} placeholder="Type the best word" autoComplete="off" /> : <textarea id={question.id} value={response} disabled={state.exerciseSubmitted} onChange={(event) => setState((current) => ({ ...current, exerciseAnswers: { ...current.exerciseAnswers, [question.id]: event.target.value } }))} placeholder="Write a natural sentence…" rows={3} />}
                  {showFeedback && <div className="answer-feedback"><b>{correct ? (question.type === "sentence" ? "Natural use" : "Correct") : question.type === "sentence" ? "Needs another look" : `Answer: ${question.answer}`}</b><p>{correct ? question.reason : question.type === "sentence" ? `Use “${question.answer}” in its intended context. Try: “${naturalSentenceExamples[question.answer]}” ${question.reason}` : question.reason}</p></div>}
                </div>
              </article>
            );
          })}
        </div>
        <div className="exercise-actions"><button className="secondary-button" onClick={() => setState((current) => ({ ...current, exerciseRevealed: true }))}>Show answers</button><button className="primary-button" onClick={submitExercise} disabled={state.exerciseSubmitted}>{state.exerciseSubmitted ? "Answers submitted ✓" : "Submit exercise"}</button></div>
      </section>

      <section className="quiz-invitation">
        <span>DAY 5 MILESTONE</span><div><h2>Your first review quiz is ready.</h2><p>15 questions drawn only from Days 1–4. Missed words will return to your review queue.</p></div><button className="primary-button light" onClick={startQuiz}>{state.quizAttempts.length ? "Retake quiz" : "Start review quiz"} →</button>
      </section>

      {quizOpen && <QuizPanel state={state} setState={setState} questions={quizQuestions} submitQuiz={submitQuiz} retakeQuiz={retakeQuiz} />}

      <div className="complete-panel"><div><span className="eyebrow">WHEN YOU’RE READY</span><h2>Close the loop on Day 5.</h2><p>Your lesson, answers, flags, and quiz attempts will remain exactly as you leave them.</p></div><button className="primary-button" onClick={completeLesson}>Complete Day 5 <span aria-hidden="true">✓</span></button></div>
    </>
  );
}

function QuizPanel({ state, setState, questions, submitQuiz, retakeQuiz }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; questions: QuizQuestion[]; submitQuiz: () => void; retakeQuiz: () => void }) {
  const latest = state.quizAttempts.at(-1);
  return (
    <section id="review-quiz" className="quiz-section">
      <div className="quiz-header"><div><span className="eyebrow">REVIEW QUIZ · DAYS 1–4</span><h2>Retrieve, don’t just recognise.</h2></div>{state.currentQuizSubmitted && latest && <div className="result-badge" role="status" aria-live="polite" aria-label={`Score ${latest.score} out of ${latest.total}`}><strong>{latest.score}</strong><span>/ {latest.total}</span><small>{Math.round((latest.score / latest.total) * 100)}%</small></div>}</div>
      <p className="quiz-note">Question and option order changes with every attempt. Your score appears only after submission.</p>
      <div className="quiz-list">
        {questions.map((question, index) => {
          const response = state.quizAnswers[question.id] ?? "";
          const correct = question.type === "sentence" ? sentenceUsesWord(response, question.answer) : normalise(response) === normalise(question.answer);
          return (
            <article key={question.id} className={state.currentQuizSubmitted ? (correct ? "answer-correct" : "answer-incorrect") : ""}>
              <div className="question-number">{String(index + 1).padStart(2, "0")}<small>{question.type.replace("meaning", "multiple choice")}</small></div>
              <fieldset className="question-body"><legend className="quiz-prompt">{question.prompt}</legend>
                {question.options ? <div className="option-list">{question.options.map((option) => <label key={option}><input type="radio" name={question.id} value={option} checked={response === option} disabled={state.currentQuizSubmitted} onChange={(event) => setState((current) => ({ ...current, quizAnswers: { ...current.quizAnswers, [question.id]: event.target.value } }))} /><span>{option}</span></label>)}</div> : question.type === "sentence" ? <textarea aria-label={`Answer for: ${question.prompt}`} rows={3} value={response} disabled={state.currentQuizSubmitted} onChange={(event) => setState((current) => ({ ...current, quizAnswers: { ...current.quizAnswers, [question.id]: event.target.value } }))} placeholder="Write an original sentence…" /> : <input aria-label={`Answer for: ${question.prompt}`} value={response} disabled={state.currentQuizSubmitted} onChange={(event) => setState((current) => ({ ...current, quizAnswers: { ...current.quizAnswers, [question.id]: event.target.value } }))} placeholder="Type your answer" autoComplete="off" />}
                {state.currentQuizSubmitted && <div className="answer-feedback"><b>{correct ? "Correct" : `Correct answer: ${question.answer}`}</b><p>{question.explanation}</p></div>}
              </fieldset>
            </article>
          );
        })}
      </div>
      <div className="exercise-actions">{state.currentQuizSubmitted ? <button className="primary-button" onClick={retakeQuiz}>Retake quiz</button> : <button className="primary-button" onClick={submitQuiz}>Submit all answers</button>}</div>
      {state.quizAttempts.length > 0 && <div className="attempt-history"><small>ATTEMPT HISTORY</small>{state.quizAttempts.map((attempt, index) => <span key={attempt.id}><b>Attempt {index + 1}</b>{attempt.score}/{attempt.total} · {Math.floor(attempt.durationSeconds / 60)}m {attempt.durationSeconds % 60}s</span>)}</div>}
    </section>
  );
}

function HistoryView({ state, search, setSearch, filter, setFilter, selectedDay, setSelectedDay, speak }: { state: AppState; search: string; setSearch: (value: string) => void; filter: "all" | "difficult" | "favourite" | "quiz"; setFilter: (value: "all" | "difficult" | "favourite" | "quiz") => void; selectedDay: number | null; setSelectedDay: (day: number | null) => void; speak: (item: VocabularyWord) => void }) {
  const filteredDays = [5, 4, 3, 2, 1].filter((day) => {
    const words = wordsForDay(day);
    const matchesSearch = !search || words.some((item) => `${item.word} ${item.meaning} ${item.example} ${categoryNames[item.category]}`.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === "all" || (filter === "quiz" && day % 5 === 0) || (filter === "difficult" && words.some((item) => state.difficultIds.includes(item.id))) || (filter === "favourite" && words.some((item) => state.favouriteIds.includes(item.id)));
    return matchesSearch && matchesFilter;
  });
  if (selectedDay) {
    const selectedWords = wordsForDay(selectedDay);
    return <><button className="back-button" onClick={() => setSelectedDay(null)}>← Back to history</button><PageIntro eyebrow={`${lessonDates[selectedDay]} · ${selectedDay === 5 ? "QUIZ DAY" : "DELIVERED"}`} title={`Day ${selectedDay} — Advanced English Practice`} copy="This lesson is preserved exactly as it was first delivered." /> <div className="history-word-list">{selectedWords.map((item, index) => <article key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{categoryNames[item.category]}</small><h2>{item.word} <i>{item.partOfSpeech}</i></h2><button onClick={() => speak(item)}>▶ {item.pronunciation}</button><p>{item.meaning}</p><blockquote>{item.example}</blockquote></div></article>)}</div></>;
  }
  return (
    <>
      <PageIntro eyebrow="LESSON ARCHIVE" title="Every word stays within reach." copy="Search all five delivered lessons by word, meaning, category, or example. Opening an earlier day never changes it." />
      <div className="history-tools"><label><span className="sr-only">Search lesson history</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search words, meanings, or examples…" /></label><div>{(["all", "difficult", "favourite", "quiz"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
      <div className="history-list">
        {filteredDays.map((day) => { const words = wordsForDay(day); return <article key={day}><div className="history-day"><span>DAY</span><strong>{String(day).padStart(2, "0")}</strong><small>{lessonDates[day]}</small></div><div className="history-summary"><div><span>{day === 5 ? "Current · Review quiz" : "Delivered"}</span><h2>{words.slice(0, 3).map((item) => item.word).join(", ")} <i>+{words.length - 3}</i></h2></div><div className="history-categories"><span>4 emotions</span><span>3 intellect</span><span>3 leadership</span></div></div><button onClick={() => setSelectedDay(day)}>Open lesson <span aria-hidden="true">→</span></button></article>; })}
        {!filteredDays.length && <div className="empty-state"><strong>No lessons match that search.</strong><p>Try a different word or remove a filter.</p></div>}
      </div>
    </>
  );
}

function ReviewView({ words, state, limit, setLimit, category, setCategory, index, setIndex, flipped, setFlipped, markReview, speak }: { words: VocabularyWord[]; state: AppState; limit: number; setLimit: (value: number) => void; category: "all" | Category; setCategory: (value: "all" | Category) => void; index: number; setIndex: React.Dispatch<React.SetStateAction<number>>; flipped: boolean; setFlipped: (value: boolean) => void; markReview: (item: VocabularyWord, remembered: boolean) => void; speak: (item: VocabularyWord) => void }) {
  const safeIndex = Math.min(index, Math.max(0, words.length - 1));
  const current = words[safeIndex];
  return (
    <>
      <PageIntro eyebrow="SPACED REVIEW" title="Bring the right words back at the right time." copy="Difficult and low-mastery words return sooner. A remembered word moves to a longer review interval." aside={<div className="due-badge"><strong>{words.length}</strong><span>due now</span></div>} />
      <div className="review-controls"><div><small>SESSION SIZE</small>{[5, 10, 20].map((value) => <button className={limit === value ? "active" : ""} key={value} onClick={() => { setLimit(value); setIndex(0); }}>{value}</button>)}</div><label>Category<select value={category} onChange={(event) => { setCategory(event.target.value as "all" | Category); setIndex(0); }}><option value="all">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
      {current ? <div className="flashcard-area">
        <div className="flashcard-progress"><span>{safeIndex + 1} of {words.length}</span><i><b style={{ width: `${((safeIndex + 1) / words.length) * 100}%` }} /></i></div>
        <button className={`flashcard ${flipped ? "flipped" : ""}`} onClick={() => setFlipped(!flipped)} aria-label={`${flipped ? "Hide" : "Reveal"} definition for ${current.word}`}>
          <small>{categoryNames[current.category]}</small><h2>{current.word}</h2><p>{flipped ? current.meaning : current.pronunciation}</p>{flipped ? <blockquote>{current.example}</blockquote> : <span>Tap to reveal meaning</span>}
        </button>
        <div className="flashcard-actions"><button onClick={() => speak(current)}>▶ Hear it</button><button className="missed" onClick={() => markReview(current, false)}>Still learning</button><button className="remembered" onClick={() => markReview(current, true)}>I remembered</button></div>
        <div className="mastery-line"><span>Current state</span><b>{stateLabel(state.masteryScores[current.id] ?? 0, state.difficultIds.includes(current.id), new Set((state.reviewDates[current.id] ?? []).map((date) => date.slice(0, 10))).size)}</b><small>Next review: {state.nextReviewAt[current.id] ? new Date(state.nextReviewAt[current.id]).toLocaleDateString() : "tomorrow"}</small></div>
      </div> : <div className="empty-state"><strong>You’re caught up.</strong><p>No words match this review session right now.</p></div>}
    </>
  );
}

function ProgressView({ state }: { state: AppState }) {
  const learnedCount = state.completedDays.includes(5) ? 50 : 40;
  const mastered = allWords.filter((item) => (state.masteryScores[item.id] ?? 0) >= 6 && new Set((state.reviewDates[item.id] ?? []).map((date) => date.slice(0, 10))).size >= 3).length;
  const familiar = allWords.filter((item) => (state.masteryScores[item.id] ?? 0) >= 3).length;
  const categoryScores = categories.map((category) => {
    const words = allWords.filter((item) => item.category === category.id);
    const earned = words.reduce((sum, item) => sum + Math.min(6, state.masteryScores[item.id] ?? 0), 0);
    return { ...category, percent: Math.round((earned / (words.length * 6)) * 100) };
  });
  return (
    <>
      <PageIntro eyebrow="LEARNING PROGRESS" title="Small repetitions. Durable language." copy="Your score grows through correct use across separate days—not through exposure alone." />
      <div className="progress-stats"><article><span>UNIQUE WORDS</span><strong>{learnedCount}</strong><small>+10 ready today</small></article><article><span>LESSONS COMPLETED</span><strong>{state.completedDays.length}</strong><small>of 5 delivered</small></article><article><span>CURRENT STREAK</span><strong>{state.completedDays.length}</strong><small>days</small></article><article><span>MASTERED</span><strong>{mastered}</strong><small>{familiar} familiar</small></article></div>
      <div className="progress-grid">
        <section className="mastery-chart"><div className="section-heading"><div><span className="eyebrow">MASTERY BY CATEGORY</span><h2>Where your language is growing</h2></div></div>{categoryScores.map((item) => <div key={item.id}><span>{item.label}</span><i><b style={{ width: `${Math.max(4, item.percent)}%` }} /></i><strong>{item.percent}%</strong></div>)}</section>
        <section className="quiz-history-chart"><span className="eyebrow">QUIZ SCORES</span><h2>{state.quizAttempts.length ? "Your attempts" : "Your first score will appear here"}</h2><div className="bars">{state.quizAttempts.length ? state.quizAttempts.map((attempt, index) => <div key={attempt.id}><i style={{ height: `${Math.max(8, (attempt.score / attempt.total) * 100)}%` }} /><span>{attempt.score}/{attempt.total}</span><small>A{index + 1}</small></div>) : <p>Finish today’s review quiz to establish your baseline.</p>}</div></section>
      </div>
      <section className="attention-list"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Difficult and frequently missed</h2></div>{state.difficultIds.length ? state.difficultIds.slice(0, 8).map((id) => { const item = allWords.find((wordItem) => wordItem.id === id); return item ? <span key={id}><b>{item.word}</b><small>{categoryNames[item.category]}</small><i>{stateLabel(state.masteryScores[id] ?? 0, true)}</i></span> : null; }) : <p>No difficult words yet. Mark a word during a lesson or miss it in a quiz and it will appear here.</p>}</section>
    </>
  );
}

function SettingsView({ state, updateState, requestNotifications, download, resetProgress }: { state: AppState; updateState: <K extends keyof AppState>(key: K, value: AppState[K]) => void; requestNotifications: (enabled: boolean) => Promise<void>; download: (format: "json" | "markdown") => void; resetProgress: () => void }) {
  const updateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => updateState("settings", { ...state.settings, [key]: value });
  return (
    <>
      <PageIntro eyebrow="PREFERENCES" title="Shape the lesson around your day." copy="Your time zone is stored as a region, so reminders stay at the right local time." />
      <div className="settings-sections">
        <section><div><span>01</span><h2>Lesson schedule</h2><p>Day numbers advance when you open a lesson by default.</p></div><div className="setting-fields"><label>Lesson time<input type="time" value={state.settings.lessonTime} onChange={(event) => updateSettings("lessonTime", event.target.value)} /></label><label>Time zone<select value={state.settings.timeZone} onChange={(event) => updateSettings("timeZone", event.target.value)}><option value="Asia/Dubai">Asia/Dubai (UAE)</option><option value="Europe/London">Europe/London</option><option value="Asia/Kolkata">Asia/Kolkata</option><option value="America/New_York">America/New_York</option></select></label><label className="wide">Lesson generation<select value={state.settings.generationMode} onChange={(event) => updateSettings("generationMode", event.target.value as Settings["generationMode"])}><option value="advance-on-open">Advance only when I open the lesson</option><option value="calendar-day">Create lessons every calendar day</option></select></label></div></section>
        <section><div><span>02</span><h2>Notifications</h2><p>Receive one alert when a new lesson becomes available.</p></div><div className="setting-fields"><label className="toggle-field" htmlFor="lesson-notifications"><span><b>Lesson notifications</b><small>Daily at {state.settings.lessonTime} in {state.settings.timeZone}</small></span><input id="lesson-notifications" aria-label="Lesson notifications" type="checkbox" checked={state.settings.notificationsEnabled} onChange={(event) => requestNotifications(event.target.checked)} /></label><div className="reminder-row"><button onClick={() => { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Your Day 5 lesson and review quiz are ready."); }}>Send a test notification</button><button onClick={() => alert("Reminder set for 6:00 PM today.")}>Remind me later today</button></div></div></section>
        <section><div><span>03</span><h2>Learning experience</h2><p>Keep the difficulty advanced, natural, and useful.</p></div><div className="setting-fields"><label>Difficulty<select value={state.settings.difficulty} onChange={(event) => updateSettings("difficulty", event.target.value)}><option value="upper-B2-to-C1">Upper-B2 to C1</option><option value="B2">B2</option><option value="C1">C1</option></select></label><label>Audio speed<select value={state.settings.audioRate} onChange={(event) => updateSettings("audioRate", Number(event.target.value))}><option value={0.7}>Slow · 0.7×</option><option value={0.9}>Natural · 0.9×</option><option value={1}>Standard · 1×</option></select></label><label>Text size<select value={state.settings.textSize} onChange={(event) => updateSettings("textSize", event.target.value as Settings["textSize"])}><option value="normal">Normal</option><option value="large">Large</option></select></label></div></section>
        <section><div><span>04</span><h2>Your data</h2><p>Take your lessons and progress with you at any time.</p></div><div className="data-actions"><button onClick={() => download("markdown")}>Export Markdown <span>↓</span></button><button onClick={() => download("json")}>Export JSON <span>↓</span></button><button className="danger-button" onClick={resetProgress}>Reset progress</button></div></section>
      </div>
    </>
  );
}
