import { professionalLearningPaths, professionalWords, type GoalId, type ProfessionalLearningPath, type ProfessionalWord, type RoleId, type SeniorityId, type SituationId } from "./professional-content";
import { createWordMastery, reviewWord, type ReviewQuality, type UsageFeedback, type WordMastery } from "./learning-engine";
import { contextEvidenceKey, makeReviewEvidence, type WebLearningExtension, type ContextMastery, type ContextEvidence } from "./web-learning-state";
export type Profile = { roleId: RoleId; seniorityId: SeniorityId; situationIds: SituationId[]; goalIds: GoalId[] };
export type Settings = { lessonTime: string; timeZone: string; notificationsEnabled: boolean; generationMode: "advance-on-open" | "calendar-day"; difficulty: string; audioRate: number; textSize: "normal" | "large"; dailyWordCount: 1 | 2 | 3 };
export type DailySession = { id: string; date: string; roleId: RoleId; situationId: SituationId; wordIds: string[]; completedAt: string };
export type AppState = {
  version: number; profile: Profile | null; introducedWordIds: string[]; masteryByWordId: Record<string, WordMastery>; dailySessions: DailySession[];
  usageAttempts: Record<string, { sentence: string; feedback: UsageFeedback; checkedAt: string; source: "written" | "spoken" }>;
  betaFeedbackSubmittedAt: string | null; lessonStatus: "not_started" | "in_progress" | "completed"; lessonWordProgress: number; completedDays: number[];
  difficultIds: string[]; favouriteIds: string[]; reviewedIds: string[]; masteryScores: Record<string, number>; reviewDates: Record<string, string[]>; nextReviewAt: Record<string, string>;
  exerciseAnswers: Record<string, string>; exerciseSubmitted: boolean; exerciseRevealed: boolean; quizAnswers: Record<string, string>;
  quizAttempts: { id: string; completedAt: string; durationSeconds: number; score: number; total: number; mistakeWordIds: string[] }[];
  currentQuizSubmitted: boolean; settings: Settings; lastNotificationDate: string | null;
};
export type State = AppState & { learningV3: WebLearningExtension };
export type Plan = WebLearningExtension["rolePlans"][string];
export type Choice = { id: string; text: string; explanation: string };
export type Challenge = { prompt: string; context: string; kind: string; choices: Choice[]; correctId: string; explanation: string };
export const stamp = () => new Date().toISOString();
export function dayAt(timeZone: string, instant = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch { return instant.toISOString().slice(0, 10); }
}
export function contextualWord(id: string, roleId: RoleId): ProfessionalWord | undefined {
  const word = professionalWords.find((entry) => entry.id === id);
  return word ? { ...word, ...word.roleContexts?.[roleId] } : undefined;
}
/** Same wrapping FNV-1a over UTF-8 bytes as native PracticeChallenge.stableHash. */
export function tapStableHash(value: string): bigint {
  let result = BigInt("14695981039346656037");
  for (const byte of new TextEncoder().encode(value)) result = BigInt.asUintN(64, (result ^ BigInt(byte)) * BigInt("1099511628211"));
  return result;
}
export type View = "today" | "courses" | "practice" | "express" | "library" | "progress" | "settings" | "idioms";
export function viewFromURL(url: string): View {
  const value = new URL(url, "https://lucid.invalid").searchParams.get("view");
  return value === "review" ? "practice" : ["today", "courses", "practice", "express", "library", "progress", "settings", "idioms"].includes(value ?? "") ? value as View : "today";
}
export function urlForView(url: string, view: View): string {
  const parsed = new URL(url, "https://lucid.invalid"); parsed.searchParams.set("view", view);
  return parsed.pathname + parsed.search + parsed.hash;
}
export function canRefreshApp(input: { ready: boolean; hasProfile: boolean; editingProfile: boolean; status: string; accountDraft: boolean; settingsDraft: boolean }): boolean {
  return input.ready && input.hasProfile && !input.editingProfile && input.status !== "error" && !input.accountDraft && !input.settingsDraft;
}
/** Guidance exposure uses the actual instant; old day-only flags remain conservative. */
export function recordContextExposure(state: State, ids: readonly string[], date: string, firstSeenAtISO = stamp()): State {
  if (!Number.isFinite(Date.parse(firstSeenAtISO))) return state;
  const prior = state.learningV3.sharedLearning;
  const exposures = { ...(prior?.exposures ?? {}) }, exposedOn = { ...state.learningV3.exposedOn };
  let changed = false;
  for (const senseId of ids) {
    const split = senseId.lastIndexOf("::"), wordId = senseId.slice(0, split), roleId = senseId.slice(split + 2) as RoleId;
    if (split < 1 || !contextualWord(wordId, roleId)?.roles.includes(roleId)) continue;
    const old = exposures[senseId];
    const firstSeenAt = !old && exposedOn[senseId] === date ? date + "T00:00:00.000Z" : firstSeenAtISO;
    if (!old || old.dayKey < date || old.dayKey === date && Date.parse(firstSeenAt) < Date.parse(old.firstSeenAt)) {
      exposures[senseId] = { dayKey: date, firstSeenAt }; changed = true;
    }
    if (!exposedOn[senseId] || exposedOn[senseId] < date) { exposedOn[senseId] = date; changed = true; }
  }
  if (!changed) return state;
  return { ...state, learningV3: { ...state.learningV3, exposedOn, sharedLearning: { version: 1, lessonCheckpoints: {}, startingChecks: {}, notebook: {}, rehearsals: {}, challenges: {}, ...prior, exposures }, updatedAt: stamp() } };
}
export function regexTerm(term: string) { return new RegExp("\\b" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"); }
export function hideTerm(text: string, term: string) { return text.replace(regexTerm(term), "[the word]"); }
function orderedModules(path: ProfessionalLearningPath, state: State) {
  const placement = state.learningV3.placementsByRole[path.roleId];
  const index = placement?.pathId === path.id ? Math.max(0, path.modules.findIndex((item) => item.id === placement.startingModuleId)) : 0;
  return [...path.modules.slice(index), ...path.modules.slice(0, index)];
}
export function roleDailyWords(state: State, roleId: RoleId, count: number) {
  const path = professionalLearningPaths.find((item) => item.roleId === roleId);
  const ids = path ? orderedModules(path, state).flatMap((module) => module.lessons.flatMap((lesson) => lesson.wordIds)) : professionalWords.filter((word) => word.roles.includes(roleId)).map((word) => word.id);
  return [...new Set(ids)].filter((id) => !state.learningV3.contextIntroducedOn[contextEvidenceKey(id, roleId)] && contextualWord(id, roleId)?.roles.includes(roleId)).slice(0, Math.min(3, Math.max(1, count)));
}
export function makePlan(state: State, roleId: RoleId, date: string): Plan {
  return { id: `${date}:${roleId}`, date, roleId, wordIds: roleDailyWords(state, roleId, state.settings.dailyWordCount ?? 3), completedIds: [], cursor: 0, answers: {}, createdAt: stamp() };
}
const confusionSets = [ ["outstanding", "unresolved"], ["verify", "validate", "corroborate", "substantiate", "confirm"], ["accountability", "ownership", "responsibility"], ["clarify", "elucidate", "explain"], ["discrepancy", "variance", "deviation"], ["mitigate", "alleviate", "reduce"], ["contingency", "fallback", "contingency plan"], ["prioritize", "prioritise", "triage"], ["constraint", "limitation", "bottleneck"], ["assumption", "hypothesis", "premise"], ["service level", "service-level objective", "benchmark"], ["course-correct", "iterate", "recalibrate"], ["migration path", "roadmap"], ["tailored support", "coaching"] ];
export function createTapChallenge(word: ProfessionalWord, roleId: RoleId): Challenge {
  const path = professionalLearningPaths.find((item) => item.roleId === roleId);
  const sequence = path?.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.wordIds)) ?? [];
  const index = Math.max(0, sequence.indexOf(word.id));
  const excluded = confusionSets.filter((set) => set.includes(word.term.toLowerCase())).flat();
  const sameLesson = new Set(path?.modules.flatMap((module) => module.lessons).find((lesson) => lesson.wordIds.includes(word.id))?.wordIds ?? []);
  const pool = professionalWords.filter((item) => item.id !== word.id && item.roles.includes(roleId) && item.learningMode === "active").map((item) => contextualWord(item.id, roleId)!).filter((item) => item.meaning !== word.meaning && item.term.toLowerCase() !== word.term.toLowerCase() && !excluded.includes(item.term.toLowerCase()) && !item.meaning.toLowerCase().includes(word.term.toLowerCase()) && !word.meaning.toLowerCase().includes(item.term.toLowerCase())).sort((a, b) => Number(sameLesson.has(a.id)) - Number(sameLesson.has(b.id)) || (tapStableHash(word.id + a.id) < tapStableHash(word.id + b.id) ? -1 : tapStableHash(word.id + a.id) > tapStableHash(word.id + b.id) ? 1 : 0));
  const candidates = pool.slice(0, 2);
  let result: Challenge = { kind: "Meaning choice", prompt: "Which word fits this meaning?", context: word.meaning, correctId: word.id, choices: [word, ...candidates].map((entry) => ({ id: entry.id, text: entry.term, explanation: `${entry.term}: ${entry.meaning}` })), explanation: `${word.term}: ${word.meaning}` };
  if (index % 3 === 1) {
    const group = (entry: ProfessionalWord) => entry.partOfSpeech.includes("noun") ? "noun" : entry.partOfSpeech.includes("verb") && !entry.partOfSpeech.includes("adverb") ? "verb" : entry.partOfSpeech;
    const alternatives = pool.filter((item) => group(item) === group(word)).slice(0, 2);
    if (new RegExp("(?<![\\p{L}\\p{N}])" + word.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}])", "iu").test(word.example) && alternatives.length === 2) result = { kind: "Sentence completion", prompt: "Complete the workplace sentence", context: word.example.replace(regexTerm(word.term), "______") + "\n\nMeaning needed: " + word.meaning, correctId: word.id, choices: [word, ...alternatives].map((entry) => ({ id: entry.id, text: entry.term, explanation: `${entry.term}: ${entry.meaning}` })), explanation: word.example };
  } else if (index % 3 === 2 && candidates.length) {
    result = { kind: "Spot incorrect guidance", prompt: `Spot the incorrect guidance for “${word.term}”`, context: "Two notes fit this word. Choose the note that gives it another word’s meaning.", correctId: `mistake:${candidates[0].id}`, choices: [
      { id: `meaning:${word.id}`, text: "Meaning: " + word.meaning, explanation: "This is the correct meaning. Look for another word’s meaning." },
      { id: `usage:${word.id}`, text: "When to use: " + word.whenToUse, explanation: "This guidance fits the word. Look for another word’s meaning." },
      { id: `mistake:${candidates[0].id}`, text: "Meaning: " + candidates[0].meaning, explanation: `That meaning belongs to “${candidates[0].term}”.` },
    ], explanation: `That note describes “${candidates[0].term}”. ${word.term}: ${word.meaning}\n\nWatch out: ${word.avoidOrMisuse}` };
  }
  const offset = Number(tapStableHash(roleId + ":" + word.id) % BigInt(result.choices.length));
  return { ...result, choices: [...result.choices.slice(offset), ...result.choices.slice(0, offset)] };
}
export function currentStreak(sessions: readonly Pick<DailySession, "date">[], today: string) {
  const dates = new Set(sessions.map((item) => item.date)); let cursor = today;
  if (!dates.has(cursor)) cursor = new Date(new Date(today + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
  let days = 0; while (dates.has(cursor)) { days++; cursor = new Date(new Date(cursor + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10); } return days;
}

/** Pure, replay-safe guided completion. It never grants independent recall. */
export function completeGuidedWord(state: State, input: { key: string; roleId: RoleId; date: string; currentDay: string; wordId: string }): State {
  const plan = state.learningV3.rolePlans[input.key];
  if (state.profile?.roleId !== input.roleId || input.date !== input.currentDay || !plan || plan.date !== input.date || plan.roleId !== input.roleId || plan.id !== input.key || plan.wordIds[plan.cursor] !== input.wordId || plan.completedIds.includes(input.wordId)) return state;
  const word = contextualWord(input.wordId, input.roleId);
  if (!word || plan.answers[word.id]?.choiceId !== createTapChallenge(word, input.roleId).correctId) return state;
  const completedIds = [...new Set([...plan.completedIds, word.id])];
  const remaining = plan.wordIds.findIndex((id) => !completedIds.includes(id));
  const nextPlan = { ...plan, completedIds, cursor: remaining >= 0 ? remaining : plan.cursor, answers: { ...plan.answers, [word.id]: { ...plan.answers[word.id], completed: true } } };
  const finished = plan.wordIds.length > 0 && plan.wordIds.every((id) => completedIds.includes(id));
  const session: DailySession = { id: crypto.randomUUID(), date: input.date, roleId: input.roleId, situationId: state.profile.situationIds[0], wordIds: [...plan.wordIds], completedAt: stamp() };
  const evidence = makeReviewEvidence({ wordId: word.id, roleId: input.roleId, date: input.date, kind: "recognition", quality: 2, independent: false });
  return { ...state, introducedWordIds: [...new Set([...state.introducedWordIds, word.id])], masteryByWordId: { ...state.masteryByWordId, [word.id]: state.masteryByWordId[word.id] ?? createWordMastery(word.id, input.date) }, lessonStatus: finished ? "completed" : "in_progress", lessonWordProgress: completedIds.length,
    dailySessions: finished && !state.dailySessions.some((item) => item.date === input.date && item.roleId === input.roleId) ? [...state.dailySessions, session] : state.dailySessions,
    learningV3: { ...state.learningV3, reviewEvidence: evidence ? [...state.learningV3.reviewEvidence, evidence] : state.learningV3.reviewEvidence, rolePlans: { ...state.learningV3.rolePlans, [input.key]: nextPlan }, contextIntroducedOn: { ...state.learningV3.contextIntroducedOn, [contextEvidenceKey(word.id, input.roleId)]: state.learningV3.contextIntroducedOn[contextEvidenceKey(word.id, input.roleId)] ?? input.date }, updatedAt: stamp() } };
}
/** One local transaction saves private studio work and text-free evidence without review or XP credit. */
export function applyExpressionCommit(state: State, input: { roleId: RoleId; date: string; draft: string; evidence?: ContextEvidence; exposedContextIds?: readonly string[]; exposedAtISO?: string }): State {
  if (state.profile?.roleId !== input.roleId) return state;
  const event = input.evidence;
  if (event) {
    const word = contextualWord(event.wordId, input.roleId);
    if (!word || !word.roles.includes(input.roleId) || event.roleId !== input.roleId || event.date !== input.date || event.senseId !== contextEvidenceKey(event.wordId, input.roleId) || event.kind === "unaided-recall" || (event.kind === "recognition" && event.independent)) return state;
  }
  const exposed = recordContextExposure(state, (input.exposedContextIds ?? []).filter((id) => id.endsWith(`::${input.roleId}`)), input.date, input.exposedAtISO);
  const existing = event && state.learningV3.reviewEvidence.some((item) => item.id === event.id);
  return { ...state, introducedWordIds: event ? [...new Set([...state.introducedWordIds, event.wordId])] : state.introducedWordIds, learningV3: { ...exposed.learningV3, expressionDraft: input.draft, contextIntroducedOn: event ? { ...state.learningV3.contextIntroducedOn, [event.senseId]: state.learningV3.contextIntroducedOn[event.senseId] ?? input.date } : state.learningV3.contextIntroducedOn, reviewEvidence: event && !existing ? [...state.learningV3.reviewEvidence, event] : state.learningV3.reviewEvidence, updatedAt: stamp() } };
}
export function contextStarted(state: State, wordId: string, roleId: RoleId) { return Boolean(state.learningV3.contextIntroducedOn[contextEvidenceKey(wordId, roleId)]); }
/** Native-style effort points: once per word/day and once per day-wide completion. */
export function effortPoints(state: State) {
  const awards = new Map<string, number>();
  const award = (key: string, points: number) => awards.set(key, Math.min(awards.get(key) ?? points, points));
  const activities = state.learningV3.nativeCompanion?.activities;
  if (Array.isArray(activities)) for (const event of activities) {
    if (!event || typeof event !== "object" || Array.isArray(event)) continue;
    const a = event as Record<string, unknown>;
    if (typeof a.dayKey !== "string" || !["practice", "review", "lesson"].includes(String(a.kind))) continue;
    award(`${a.dayKey}:${a.kind}:${a.wordId ?? "lesson"}`, a.kind === "practice" ? 10 : a.kind === "lesson" ? 20 : a.productive === true && Number(a.quality) >= 2 ? 15 : 5);
  }
  for (const plan of Object.values(state.learningV3.rolePlans)) for (const id of plan.completedIds) award(`${plan.date}:practice:${id}`, 10);
  for (const event of state.learningV3.reviewEvidence) {
    if (event.kind !== "unaided-recall") continue;
    const exposure = state.learningV3.sharedLearning?.exposures[event.senseId];
    const independent = event.independent && !(exposure?.dayKey === event.date && (!event.capturedAtISO || Date.parse(event.capturedAtISO) >= Date.parse(exposure.firstSeenAt)));
    award(`${event.date}:review:${event.wordId}`, independent && event.quality >= 2 ? 15 : 5);
  }
  for (const date of new Set(state.dailySessions.map((session) => session.date))) award(`${date}:lesson:lesson`, 20);
  return [...awards.values()].reduce((total, value) => total + value, 0);
}

export type DueContext = { word: ProfessionalWord; roleId: RoleId; context?: ContextMastery; legacy?: WordMastery };
export function reviewQueue(state: State, day: string, selectedRole: RoleId, includeOtherRoles = false): DueContext[] {
  const entries: DueContext[] = [];
  for (const word of professionalWords) {
    const roles = includeOtherRoles ? word.roles : word.roles.filter((roleId) => roleId === selectedRole);
    for (const roleId of roles) {
      const context = state.learningV3.contextMastery[contextEvidenceKey(word.id, roleId)];
      const legacy = roleId === selectedRole && !context ? state.masteryByWordId[word.id] : undefined;
      const progress = context ?? legacy;
      if (progress && progress.nextReviewOn <= day && progress.lastReviewedOn !== day) entries.push({ word: contextualWord(word.id, roleId)!, roleId, context, legacy });
    }
  }
  return entries.sort((a, b) => (a.context ?? a.legacy)!.nextReviewOn.localeCompare((b.context ?? b.legacy)!.nextReviewOn) || a.word.id.localeCompare(b.word.id) || a.roleId.localeCompare(b.roleId));
}

/** Eligibility belongs to the original committed response, before guidance was exposed. */
export function isFrozenReviewIndependent(state: State, wordId: string, contextRole: RoleId, date: string): boolean {
  const word = contextualWord(wordId, contextRole);
  const draft = state.learningV3.reviewDrafts[`${date}:${contextEvidenceKey(wordId, contextRole)}`];
  if (!word || !word.roles.includes(contextRole) || word.learningMode !== "active" || !draft?.revealed || draft.hinted || draft.originalIndependent !== true || draft.originalCapturedOn !== date || typeof draft.originalResponse !== "string") return false;
  const exposure = state.learningV3.sharedLearning?.exposures[contextEvidenceKey(wordId, contextRole)];
  if (exposure?.dayKey === date && (!draft.originalCapturedAtISO || Date.parse(draft.originalCapturedAtISO) >= Date.parse(exposure.firstSeenAt))) return false;
  const original = draft.originalResponse.trim();
  return original === (draft.sentence ?? draft.response ?? "").trim() && original.split(/\s+/).filter(Boolean).length >= 5 && regexTerm(word.term).test(original);
}

/** Freeze once, before reveal. Earlier exposure and legacy revealed drafts never become independent. */
export function captureReviewResponse(state: State, input: { roleId: RoleId; contextRole: RoleId; date: string; currentDay: string; wordId: string; response: string; capturedAtISO?: string }): State {
  if (state.profile?.roleId !== input.roleId || input.date !== input.currentDay) return state;
  const word = contextualWord(input.wordId, input.contextRole);
  if (!word || !word.roles.includes(input.contextRole)) return state;
  const contextId = contextEvidenceKey(word.id, input.contextRole); const key = `${input.date}:${contextId}`;
  const schedule = state.learningV3.contextMastery[contextId] ?? state.masteryByWordId[word.id];
  if (!schedule || schedule.nextReviewOn > input.date || schedule.lastReviewedOn === input.date) return state;
  const prior = state.learningV3.reviewDrafts[key] ?? { sentence: "", hinted: false, revealed: false };
  if (prior.revealed) return state; // Old revealed drafts cannot be retrofitted into unaided answers.
  const response = input.response.trim();
  const alreadyCaptured = prior.originalResponse !== undefined || prior.originalIndependent !== undefined || prior.originalCapturedOn !== undefined;
  const capturedAtISO = input.capturedAtISO ?? stamp();
  if (!Number.isFinite(Date.parse(capturedAtISO))) return state;
  const exposure = state.learningV3.sharedLearning?.exposures[contextId];
  const earlierExposure = exposure?.dayKey === input.date ? Date.parse(exposure.firstSeenAt) <= Date.parse(capturedAtISO) : state.learningV3.exposedOn[contextId] === input.date;
  const independent = !prior.hinted && !earlierExposure && word.learningMode === "active" && response.split(/\s+/).filter(Boolean).length >= 5 && regexTerm(word.term).test(response);
  const nextDraft = alreadyCaptured ? { ...prior, revealed: true } : { ...prior, sentence: response, originalResponse: response, originalIndependent: independent, originalCapturedOn: input.date, originalCapturedAtISO: capturedAtISO, revealed: true };
  // Logical ordering is explicit even if capture and reveal share a millisecond.
  const exposed = recordContextExposure(state, [contextId], input.date, new Date(Date.parse(capturedAtISO) + 1).toISOString());
  return { ...exposed, learningV3: { ...exposed.learningV3, reviewDrafts: { ...state.learningV3.reviewDrafts, [key]: nextDraft }, updatedAt: stamp() } };
}

/** A failed or supported retrieval still schedules a review; it never counts as independent success. */
export function applyContextReview(state: State, input: { roleId: RoleId; contextRole: RoleId; date: string; currentDay: string; wordId: string; response: string; quality: ReviewQuality; hinted?: boolean; revealed?: boolean; meaningAttested?: boolean; naturalnessAttested?: boolean }): State {
  if (state.profile?.roleId !== input.roleId || input.date !== input.currentDay) return state;
  const word = contextualWord(input.wordId, input.contextRole);
  if (!word || !word.roles.includes(input.contextRole)) return state;
  const contextId = contextEvidenceKey(word.id, input.contextRole); const key = `${input.date}:${contextId}`;
  const context = state.learningV3.contextMastery[contextId]; const legacy = state.masteryByWordId[word.id]; const schedule = context ?? legacy;
  if (!schedule || schedule.nextReviewOn > input.date || schedule.lastReviewedOn === input.date) return state;
  const draft = state.learningV3.reviewDrafts[key] ?? { sentence: "", hinted: false, revealed: false };
  const frozen = typeof draft.originalResponse === "string";
  const response = (frozen ? draft.originalResponse! : draft.sentence ?? draft.response ?? "").trim();
  if (frozen && (input.response.trim() !== response || (draft.sentence ?? draft.response ?? "").trim() !== response)) return state;
  const independent = isFrozenReviewIndependent(state, word.id, input.contextRole, input.date);
  const supported = !independent && (draft.hinted || draft.revealed || state.learningV3.exposedOn[contextId] === input.date || word.learningMode === "recognition");
  const successful = independent && input.meaningAttested === true && input.naturalnessAttested === true && input.quality >= 2;
  if (input.quality >= 2 && !successful && !supported) return state;
  const quality: ReviewQuality = successful ? input.quality : input.quality === 0 ? 0 : 1;
  const evidence = makeReviewEvidence({ wordId: word.id, roleId: input.contextRole, senseId: contextId, date: input.date, kind: "unaided-recall", quality, independent, assisted: !independent, response, capturedAtISO: draft.originalCapturedAtISO });
  if (!evidence) return state;
  const nextLegacy = legacy && (!legacy.lastReviewedOn || legacy.lastReviewedOn < input.date) ? reviewWord(legacy, { reviewedOn: input.date, quality, productive: successful }) : legacy ?? createWordMastery(word.id, input.date);
  return { ...state, masteryByWordId: { ...state.masteryByWordId, [word.id]: nextLegacy }, reviewedIds: [...new Set([...state.reviewedIds, word.id])], difficultIds: quality < 2 ? [...new Set([...state.difficultIds, word.id])] : state.difficultIds.filter((id) => id !== word.id), learningV3: { ...state.learningV3, contextIntroducedOn: { ...state.learningV3.contextIntroducedOn, [contextId]: state.learningV3.contextIntroducedOn[contextId] ?? context?.introducedOn ?? input.date }, reviewEvidence: [...state.learningV3.reviewEvidence, evidence], reviewDrafts: { ...state.learningV3.reviewDrafts, [key]: draft }, updatedAt: stamp() } };
}
export function practiceDates(state: State) {
  const studioDates: string[] = [];
  try {
    const draft: unknown = JSON.parse(state.learningV3.expressionDraft ?? "null");
    if (draft && typeof draft === "object" && !Array.isArray(draft)) {
      const value = draft as Record<string, unknown>;
      const entries = value.version === 2 && value.workspaces && typeof value.workspaces === "object" ? Object.values(value.workspaces) : [value];
      for (const item of entries) if (item && typeof item === "object" && !Array.isArray(item)) {
        const dates = (item as Record<string, unknown>).practiceDates;
        if (Array.isArray(dates)) for (const date of dates) if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + "T00:00:00Z")) && new Date(date + "T00:00:00Z").toISOString().slice(0, 10) === date) studioDates.push(date);
      }
    }
  } catch { /* Private unfinished text does not imply a practice day. */ }
  return [...new Set([...state.dailySessions.map((session) => session.date), ...Object.values(state.learningV3.rolePlans).filter((plan) => plan.completedIds.length > 0).map((plan) => plan.date), ...state.learningV3.reviewEvidence.map((item) => item.date), ...studioDates])].sort();
}
