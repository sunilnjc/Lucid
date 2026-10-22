/** Canonical native-v2 account record. This projection never uploads a private backup. */
import { professionalWords, professionalLearningPaths, PROFESSIONAL_ROLE_IDS } from "./professional-content";
import { getExpressionPracticeContent } from "./expression-content";
import { exportPortableBackup, importPortableBackup, prepareWebState, isoToFoundationDate, foundationDateToISO, foundationDateToLocalDay, type WebLearningState, type WebLearningExtension } from "./web-learning-state";

type Row = Record<string, unknown>;
export type SharedLessonCheckpoint = { roleId: string; dayKey: string; wordIds: string[]; completedWordIds: string[]; cursorWordId?: string; answers?: Record<string, { choiceId: string; hinted: boolean }>; updatedAt: string };
export type SharedStartingCheck = { roleId: string; pathId: string; questionIds: string[]; answers: number[]; updatedAt: string };
export type SharedNotebookEntry = { id: string; roleId: string; expressionId: string; style: "plain" | "precise" | "diplomatic"; phrase: string; createdAt: string; nextReviewOn: string; lastPractisedAt?: string };
export type SharedRehearsal = { id: string; roleId: string; scenarioId: string; expressionId: string; mode: "initial" | "delayed"; gapId?: string; startedAt: string; completedAt?: string; modelSeen: boolean };
export type SharedChallenge = { id: string; roleId: string; mode: "transfer" | "comeback"; milestone: number; startedAt: string; scenarioIds: string[]; completedScenarioIds: string[]; completedAt?: string };
export type SharedExposure = { dayKey: string; firstSeenAt: string };
export type SharedLearning = { version: 1; lessonCheckpoints: Record<string, SharedLessonCheckpoint>; startingChecks: Record<string, SharedStartingCheck>; notebook: Record<string, SharedNotebookEntry>; rehearsals: Record<string, SharedRehearsal>; challenges: Record<string, SharedChallenge>; exposures: Record<string, SharedExposure> };
const maps = ["lessonCheckpoints", "startingChecks", "notebook", "rehearsals", "challenges", "exposures"] as const;
const row = (v: unknown): v is Row => v !== null && typeof v === "object" && !Array.isArray(v);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,199}$/.test(v);
const day = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
const instant = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) && day(v.slice(0, 10)) && Date.parse(v) >= 0 && Date.parse(v) <= Date.now() + 300_000;
const numericDate = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= -978307200 && v <= Date.now() / 1000 - 978307200 + 300;
const logicalDate = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= -978307200 && v <= Date.now() / 1000 - 978307200 + 86400;
const dueDate = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= -978307200 && v <= Date.now() / 1000 - 978307200 + 45 * 86400;
const plausibleDay = (v: unknown): v is string => day(v) && Date.parse(midnight(v)) <= Date.now() + 86400000;
const list = (v: unknown, max = 10000): v is string[] => Array.isArray(v) && v.length <= max && v.every(id) && new Set(v).size === v.length;
const keys = (v: Row, allowed: readonly string[]) => Object.keys(v).every((k) => allowed.includes(k));
const roles = new Set<string>(PROFESSIONAL_ROLE_IDS);
const content = getExpressionPracticeContent(professionalWords);
const expressions = new Map(content.expressions.map((e) => [e.id, e]));
const scenarios = new Map(content.scenarios.map((e) => [e.id, e]));
const midnight = (date: string) => date + "T00:00:00.000Z";
const previousDay = (date: string) => new Date(Date.parse(midnight(date)) - 86400000).toISOString().slice(0, 10);
const plusDay = (date: string) => new Date(Date.parse(midnight(date)) + 86400000).toISOString().slice(0, 10);
const earlier = (a: string, b: string) => Date.parse(a) <= Date.parse(b) ? a : b;
const later = (a: string | undefined, b: string | undefined) => !a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b;
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort();
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (!row(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined && !(key === "wordId" && value[key] === null)).map((key) => [key, ordered(value[key])]));
}
const stableText = (value: unknown) => JSON.stringify(ordered(value));
const equal = (a: unknown, b: unknown) => stableText(a) === stableText(b);
const empty = (): SharedLearning => ({ version: 1, lessonCheckpoints: {}, startingChecks: {}, notebook: {}, rehearsals: {}, challenges: {}, exposures: {} });
function safeJSON(v: unknown, depth = 0, seen = new Set<object>()): boolean {
  if (depth > 24) return false;
  if (v === null || typeof v === "string" || typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "object" || seen.has(v)) return false;
  const p = Object.getPrototypeOf(v); if (p !== Object.prototype && p !== Array.prototype && p !== null) return false;
  seen.add(v); const valid = Object.entries(v).length <= 10000 && Object.entries(v).every(([k, x]) => !["__proto__", "constructor", "prototype"].includes(k) && safeJSON(x, depth + 1, seen)); seen.delete(v); return valid;
}
export function validateSharedLearning(value: unknown): value is SharedLearning {
  try {
  if (!safeJSON(value) || !row(value) || value.version !== 1 || !keys(value, ["version", ...maps])) return false;
  for (const name of maps) if (value[name] !== undefined && !row(value[name])) return false;
  const data = { ...empty(), ...value } as SharedLearning;
  for (const [key, p] of Object.entries(data.lessonCheckpoints)) {
    if (!row(p) || !keys(p, ["roleId", "dayKey", "wordIds", "completedWordIds", "cursorWordId", "answers", "updatedAt"]) || !roles.has(p.roleId) || !plausibleDay(p.dayKey) || key !== `${p.dayKey}:${p.roleId}` || !list(p.wordIds, 3) || !list(p.completedWordIds, 3) || !p.completedWordIds.every((x) => p.wordIds.includes(x)) || p.cursorWordId !== undefined && !p.wordIds.includes(p.cursorWordId) || !instant(p.updatedAt)) return false;
    if (p.answers !== undefined && (!row(p.answers) || Object.entries(p.answers).some(([wordId, a]) => !p.wordIds.includes(wordId) || !row(a) || !keys(a, ["choiceId", "hinted"]) || !id(a.choiceId) || typeof a.hinted !== "boolean"))) return false;
  }
  for (const [key, p] of Object.entries(data.startingChecks)) {
    const path = professionalLearningPaths.find((x) => x.id === p.pathId && x.roleId === key);
    if (!row(p) || !keys(p, ["roleId", "pathId", "questionIds", "answers", "updatedAt"]) || p.roleId !== key || !path || !list(p.questionIds, 6) || !equal(p.questionIds, path.startingCheck?.map((x) => x.id)) || !Array.isArray(p.answers) || p.answers.length > 6 || !p.answers.every((x, n) => Number.isInteger(x) && x >= -1 && x < (path.startingCheck?.[n].options.length ?? 0)) || !instant(p.updatedAt)) return false;
  }
  for (const [key, p] of Object.entries(data.notebook)) {
    const e = expressions.get(p.expressionId);
    if (!row(p) || !keys(p, ["id", "roleId", "expressionId", "style", "phrase", "createdAt", "nextReviewOn", "lastPractisedAt"]) || !uuid(key) || key.toLowerCase() !== String(p.id).toLowerCase() || !e || !e.roleIds.includes(p.roleId as never) || !["plain", "precise", "diplomatic"].includes(p.style) || p.phrase !== e[p.style] || !instant(p.createdAt) || !day(p.nextReviewOn) || Date.parse(midnight(p.nextReviewOn)) > Date.now() + 45 * 86400000 || p.lastPractisedAt !== undefined && !instant(p.lastPractisedAt)) return false;
  }
  for (const [key, p] of Object.entries(data.rehearsals)) {
    const scenario = scenarios.get(p.scenarioId);
    if (!row(p) || !keys(p, ["id", "roleId", "scenarioId", "expressionId", "mode", "gapId", "startedAt", "completedAt", "modelSeen"]) || !uuid(key) || key.toLowerCase() !== String(p.id).toLowerCase() || !scenario || scenario.expressionId !== p.expressionId || !scenario.roleIds.includes(p.roleId as never) || !["initial", "delayed"].includes(p.mode) || p.gapId !== undefined && !uuid(p.gapId) || !instant(p.startedAt) || p.completedAt !== undefined && (!instant(p.completedAt) || Date.parse(p.completedAt) < Date.parse(p.startedAt)) || typeof p.modelSeen !== "boolean") return false;
  }
  for (const [key, p] of Object.entries(data.challenges)) {
    if (!row(p) || !keys(p, ["id", "roleId", "mode", "milestone", "startedAt", "scenarioIds", "completedScenarioIds", "completedAt"]) || !id(key) || key !== p.id || !roles.has(p.roleId) || !["transfer", "comeback"].includes(p.mode) || !Number.isInteger(p.milestone) || p.milestone < 0 || !instant(p.startedAt) || !list(p.scenarioIds, 3) || p.scenarioIds.length === 0 || !p.scenarioIds.every((x) => scenarios.get(x)?.roleIds.includes(p.roleId as never)) || !list(p.completedScenarioIds, 3) || !p.completedScenarioIds.every((x) => p.scenarioIds.includes(x)) || p.completedAt !== undefined && (!instant(p.completedAt) || Date.parse(p.completedAt) < Date.parse(p.startedAt) || p.completedScenarioIds.length !== p.scenarioIds.length)) return false;
  }
  for (const [key, p] of Object.entries(data.exposures)) if (!row(p) || !keys(p, ["dayKey", "firstSeenAt"]) || !id(key) || !key.includes("::") || !plausibleDay(p.dayKey) || !instant(p.firstSeenAt)) return false;
  return true;
  } catch { return false; }
}
function normalized(value: unknown): SharedLearning {
  if (value === undefined || value === null) return empty();
  if (!validateSharedLearning(value)) throw new Error("Invalid shared learning checkpoints.");
  const out = copy({ ...empty(), ...value });
  out.notebook = Object.fromEntries(Object.entries(out.notebook).map(([key, entry]) => [key.toLowerCase(), { ...entry, id: entry.id.toLowerCase() }]));
  out.rehearsals = Object.fromEntries(Object.entries(out.rehearsals).map(([key, entry]) => [key.toLowerCase(), { ...entry, id: entry.id.toLowerCase(), ...(entry.gapId ? { gapId: entry.gapId.toLowerCase() } : {}) }]));
  return out;
}
function immutable(a: Row, b: Row, fields: string[]) {
  if (!fields.every((k) => equal(a[k], b[k]))) throw new Error("Conflicting immutable learning identifiers. Neither record was replaced.");
}
export function mergeSharedLearning(left: unknown, right: unknown): SharedLearning {
  const a = normalized(left), b = normalized(right), out = copy(a);
  for (const [key, incoming] of Object.entries(b.lessonCheckpoints)) {
    const own = out.lessonCheckpoints[key]; if (!own) { out.lessonCheckpoints[key] = incoming; continue; }
    const first = Date.parse(own.updatedAt) < Date.parse(incoming.updatedAt) || own.updatedAt === incoming.updatedAt && JSON.stringify(own.wordIds) <= JSON.stringify(incoming.wordIds) ? own : incoming;
    if (!equal(own.wordIds, incoming.wordIds)) { out.lessonCheckpoints[key] = first; continue; }
    const newest = Date.parse(incoming.updatedAt) > Date.parse(own.updatedAt) ? incoming : Date.parse(incoming.updatedAt) < Date.parse(own.updatedAt) ? own : stableText({ cursorWordId: own.cursorWordId ?? null, answers: own.answers ?? {} }) <= stableText({ cursorWordId: incoming.cursorWordId ?? null, answers: incoming.answers ?? {} }) ? own : incoming;
    const answers = { ...own.answers };
    for (const [wordId, answer] of Object.entries(incoming.answers ?? {})) { const existing = answers[wordId]; answers[wordId] = existing ? { choiceId: newest.answers?.[wordId]?.choiceId ?? existing.choiceId, hinted: existing.hinted || answer.hinted } : answer; }
    out.lessonCheckpoints[key] = { ...first, ...newest, completedWordIds: union(own.completedWordIds, incoming.completedWordIds), answers };
  }
  for (const [key, incoming] of Object.entries(b.startingChecks)) {
    const own = out.startingChecks[key]; if (!own) { out.startingChecks[key] = incoming; continue; }
    const first = Date.parse(own.updatedAt) < Date.parse(incoming.updatedAt) ? own : Date.parse(own.updatedAt) > Date.parse(incoming.updatedAt) ? incoming : stableText({ questionIds: own.questionIds, answers: own.answers }) <= stableText({ questionIds: incoming.questionIds, answers: incoming.answers }) ? own : incoming;
    const prefix = own.answers.slice(0, Math.min(own.answers.length, incoming.answers.length));
    out.startingChecks[key] = equal(own.questionIds, incoming.questionIds) && equal(prefix, incoming.answers.slice(0, prefix.length)) ? own.answers.length >= incoming.answers.length ? own : incoming : first;
  }
  for (const [key, incoming] of Object.entries(b.notebook)) {
    const own = out.notebook[key]; if (!own) { out.notebook[key] = incoming; continue; }
    immutable(own, incoming, ["id", "roleId", "expressionId", "style", "phrase"]);
    const ownPractice = own.lastPractisedAt ? Date.parse(own.lastPractisedAt) : -Infinity, incomingPractice = incoming.lastPractisedAt ? Date.parse(incoming.lastPractisedAt) : -Infinity;
    const nextReviewOn = ownPractice > incomingPractice ? own.nextReviewOn : incomingPractice > ownPractice ? incoming.nextReviewOn : [own.nextReviewOn, incoming.nextReviewOn].sort()[0];
    out.notebook[key] = { ...own, createdAt: earlier(own.createdAt, incoming.createdAt), nextReviewOn, ...(later(own.lastPractisedAt, incoming.lastPractisedAt) ? { lastPractisedAt: later(own.lastPractisedAt, incoming.lastPractisedAt) } : {}) };
  }
  for (const [key, incoming] of Object.entries(b.rehearsals)) {
    const own = out.rehearsals[key]; if (!own) { out.rehearsals[key] = incoming; continue; }
    immutable(own, incoming, ["id", "roleId", "scenarioId", "expressionId", "mode"]);
    if (own.gapId && incoming.gapId && own.gapId !== incoming.gapId) throw new Error("Conflicting rehearsal notebook identifiers.");
    out.rehearsals[key] = { ...own, ...(own.gapId || incoming.gapId ? { gapId: own.gapId ?? incoming.gapId } : {}), startedAt: earlier(own.startedAt, incoming.startedAt), ...(own.completedAt || incoming.completedAt ? { completedAt: own.completedAt && incoming.completedAt ? earlier(own.completedAt, incoming.completedAt) : own.completedAt ?? incoming.completedAt } : {}), modelSeen: own.modelSeen || incoming.modelSeen };
  }
  for (const [key, incoming] of Object.entries(b.challenges)) {
    const own = out.challenges[key]; if (!own) { out.challenges[key] = incoming; continue; }
    immutable(own, incoming, ["id", "roleId", "mode", "milestone", "scenarioIds"]);
    const completedScenarioIds = union(own.completedScenarioIds, incoming.completedScenarioIds);
    out.challenges[key] = { ...own, startedAt: earlier(own.startedAt, incoming.startedAt), completedScenarioIds };
    if (completedScenarioIds.length === own.scenarioIds.length) out.challenges[key].completedAt = own.completedAt && incoming.completedAt ? earlier(own.completedAt, incoming.completedAt) : own.completedAt ?? incoming.completedAt ?? later(own.startedAt, incoming.startedAt);
  }
  for (const [key, incoming] of Object.entries(b.exposures)) { const own = out.exposures[key]; out.exposures[key] = !own || incoming.dayKey > own.dayKey ? incoming : incoming.dayKey < own.dayKey ? own : { dayKey: own.dayKey, firstSeenAt: earlier(own.firstSeenAt, incoming.firstSeenAt) }; }
  return out;
}
/** Stable UUID for legacy local IDs; never a credential or learner identity. */
function stableUUID(source: string) {
  if (uuid(source as unknown)) return source.toLowerCase();
  const parts = [2166136261, 2246822519, 3266489917, 668265263].map((seed) => { let hash = seed; for (const ch of source) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619); return (hash >>> 0).toString(16).padStart(8, "0"); });
  const h = parts.join(""); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function workspaces(text: string): Record<string, Row> {
  try { const decoded = JSON.parse(text); if (!row(decoded)) return {}; if (decoded.version === 2 && row(decoded.workspaces)) return Object.fromEntries(Object.entries(decoded.workspaces).filter(([, v]) => row(v))) as Record<string, Row>; if (decoded.version === 1 && typeof decoded.roleId === "string") return { [decoded.roleId]: decoded }; } catch { /* Empty or legacy free text stays local. */ }
  return {};
}
function derived(ext: WebLearningExtension): SharedLearning {
  const out = empty();
  const exposure = (senseId: string, date: string) => ext.sharedLearning?.exposures[senseId]?.dayKey === date ? ext.sharedLearning.exposures[senseId] : { dayKey: date, firstSeenAt: midnight(date) };
  for (const [key, p] of Object.entries(ext.rolePlans)) {
    const candidate: SharedLessonCheckpoint = { roleId: p.roleId, dayKey: p.date, wordIds: p.wordIds, completedWordIds: p.completedIds, ...(p.wordIds[p.cursor] ? { cursorWordId: p.wordIds[p.cursor] } : {}), answers: Object.fromEntries(Object.entries(p.answers).filter(([, a]) => id(a.choiceId)).map(([wordId, a]) => [wordId, { choiceId: a.choiceId, hinted: a.helped || a.revealed === true }])), updatedAt: ext.updatedAt === "1970-01-01T00:00:00.000Z" ? p.createdAt : ext.updatedAt };
    const existing = ext.sharedLearning?.lessonCheckpoints[key];
    if (existing && equal({ ...existing, updatedAt: "" }, { ...candidate, updatedAt: "" })) candidate.updatedAt = existing.updatedAt;
    out.lessonCheckpoints[key] = candidate;
    for (const [wordId, answer] of Object.entries(p.answers)) if (answer.helped || answer.revealed === true) out.exposures[`${wordId}::${p.roleId}`] = exposure(`${wordId}::${p.roleId}`, p.date);
  }
  for (const [roleId, p] of Object.entries(ext.startingCheckDrafts)) {
    const path = professionalLearningPaths.find((x) => x.roleId === roleId && x.id === p.pathId);
    if (path?.startingCheck && p.signature === JSON.stringify(path.startingCheck)) out.startingChecks[roleId] = { roleId, pathId: path.id, questionIds: path.startingCheck.map((q) => q.id), answers: p.answers, updatedAt: p.updatedAt ?? ext.updatedAt };
  }
  for (const [roleId, workspace] of Object.entries(workspaces(ext.expressionDraft))) {
    if (!roles.has(roleId)) continue;
    for (const note of Array.isArray(workspace.notebook) ? workspace.notebook : []) {
      if (!row(note) || typeof note.expressionId !== "string" || typeof note.variant !== "string" || !day(note.createdOn)) continue;
      const e = expressions.get(note.expressionId); if (!e || !e.roleIds.includes(roleId as never) || !["plain", "precise", "diplomatic"].includes(note.variant) || note.phrase !== e[note.variant as SharedNotebookEntry["style"]]) continue;
      const key = stableUUID(String(note.id)); out.notebook[key] = { id: key, roleId, expressionId: e.id, style: note.variant as SharedNotebookEntry["style"], phrase: String(note.phrase), createdAt: instant(note.createdAt) ? note.createdAt : midnight(note.createdOn), nextReviewOn: day(note.nextReviewOn) ? note.nextReviewOn : plusDay(note.createdOn), ...(instant(note.lastPractisedAt) ? { lastPractisedAt: note.lastPractisedAt } : {}) };
    }
    for (const history of Array.isArray(workspace.rehearsalHistory) ? workspace.rehearsalHistory : []) if (row(history) && uuid(history.id)) { const candidate = { ...empty(), rehearsals: { [history.id.toLowerCase()]: history } }; if (validateSharedLearning(candidate)) out.rehearsals[history.id.toLowerCase()] = history as SharedRehearsal; }
    for (const history of Array.isArray(workspace.challengeHistory) ? workspace.challengeHistory : []) if (row(history) && id(history.id)) { const candidate = { ...empty(), challenges: { [history.id]: history } }; if (validateSharedLearning(candidate)) out.challenges[history.id] = history as SharedChallenge; }
    // Historical local versions stored delayed checkpoints but no immutable history.
    for (const checkpoint of Array.isArray(workspace.pendingCheckpoints) ? workspace.pendingCheckpoints : []) {
      if (!row(checkpoint) || typeof checkpoint.scenarioId !== "string" || !day(checkpoint.dueOn)) continue;
      const s = scenarios.get(checkpoint.scenarioId); if (!s || !s.roleIds.includes(roleId as never)) continue;
      const key = stableUUID(`checkpoint:${roleId}:${s.id}:${checkpoint.dueOn}`);
      const existingHistory = Object.values({ ...ext.sharedLearning?.rehearsals, ...out.rehearsals }).filter((r) => r.roleId === roleId && r.scenarioId === s.id);
      if (existingHistory.some((r) => r.completedAt)) continue;
      if (!existingHistory.some((r) => r.mode === "initial" && r.completedAt && plusDay(r.completedAt.slice(0, 10)) === checkpoint.dueOn)) out.rehearsals[key] = { id: key, roleId, scenarioId: s.id, expressionId: s.expressionId, mode: "initial", startedAt: midnight(previousDay(checkpoint.dueOn)), completedAt: midnight(previousDay(checkpoint.dueOn)), modelSeen: true };
      if (day(checkpoint.completedOn) && !existingHistory.some((r) => r.mode === "delayed" && r.completedAt?.slice(0, 10) === checkpoint.completedOn)) { const delayedId = stableUUID(`delayed:${key}`); out.rehearsals[delayedId] = { id: delayedId, roleId, scenarioId: s.id, expressionId: s.expressionId, mode: "delayed", startedAt: midnight(checkpoint.completedOn), completedAt: midnight(checkpoint.completedOn), modelSeen: true }; }
    }
    for (const [senseId, date] of Object.entries(row(workspace.hintedOn) ? workspace.hintedOn : {})) if (day(date) && senseId.includes("::")) out.exposures[senseId] = exposure(senseId, date);
  }
  for (const [senseId, date] of Object.entries(ext.exposedOn)) out.exposures[senseId] = exposure(senseId, date);
  return mergeSharedLearning(ext.sharedLearning, out);
}
const rootKeys = ["schemaVersion", "displayName", "dailyWordGoal", "profileUpdatedAt", "lessonDayKey", "pathPlacements", "contextEvidence", "contextIntroducedOn", "activities", "favouriteChanges", "updatedAt", "profile", "introducedWordIds", "currentLessonDate", "currentWordIds", "progressByWordId", "sessions", "favouriteWordIds", "completedWordIdsToday", "settings", "reviewPromptMilestone", "sharedLearning"];
export function validateSharedCloudState(value: unknown): value is Row {
  try {
    if (!safeJSON(value) || !row(value) || value.schemaVersion !== 2 || !keys(value, rootKeys) || JSON.stringify(value).length > 2_000_000) return false;
    if (!list(value.introducedWordIds) || !list(value.currentWordIds ?? []) || !list(value.favouriteWordIds) || !list(value.completedWordIdsToday ?? []) || !row(value.progressByWordId) || !Array.isArray(value.sessions)) return false;
    if (value.sharedLearning !== undefined && !validateSharedLearning(value.sharedLearning)) return false;
    for (const key of ["profileUpdatedAt", "updatedAt"]) if (value[key] !== undefined && !numericDate(value[key])) return false;
    if (value.currentLessonDate !== undefined && !logicalDate(value.currentLessonDate)) return false;
    if (value.lessonDayKey !== undefined && !plausibleDay(value.lessonDayKey)) return false;
    if (value.displayName !== undefined && (typeof value.displayName !== "string" || value.displayName.length > 100)) return false;
    if (value.dailyWordGoal !== undefined && ![1, 2, 3].includes(Number(value.dailyWordGoal))) return false;
    if (value.profile != null && (!row(value.profile) || !keys(value.profile, ["roleId", "seniorityId", "situationIds", "goalIds"]) || !roles.has(String(value.profile.roleId)) || !id(value.profile.seniorityId) || !list(value.profile.situationIds, 20) || !list(value.profile.goalIds, 20))) return false;
    if (!row(value.settings) || !keys(value.settings, ["notificationsEnabled", "reminderHour", "reminderMinute", "speechRate"]) || typeof value.settings.notificationsEnabled !== "boolean" || !Number.isInteger(value.settings.reminderHour) || Number(value.settings.reminderHour) < 0 || Number(value.settings.reminderHour) > 23 || !Number.isInteger(value.settings.reminderMinute) || Number(value.settings.reminderMinute) < 0 || Number(value.settings.reminderMinute) > 59 || typeof value.settings.speechRate !== "number" || value.settings.speechRate < 0 || value.settings.speechRate > 1) return false;
    for (const p of Object.values(value.progressByWordId)) if (!row(p) || !keys(p, ["introducedOn", "intervalIndex", "nextReviewOn", "lastReviewedOn", "reviewCount", "successfulReviewDates", "lapses", "mastered"]) || !logicalDate(p.introducedOn) || !dueDate(p.nextReviewOn) || !Number.isInteger(p.intervalIndex) || Number(p.intervalIndex) < 0 || Number(p.intervalIndex) > 4 || !Number.isInteger(p.reviewCount) || Number(p.reviewCount) < 0 || !Number.isInteger(p.lapses) || Number(p.lapses) < 0 || !Array.isArray(p.successfulReviewDates) || !p.successfulReviewDates.every(logicalDate) || typeof p.mastered !== "boolean" || p.lastReviewedOn !== undefined && !logicalDate(p.lastReviewedOn)) return false;
    for (const p of value.sessions) if (!row(p) || !keys(p, ["id", "date", "wordIds", "completedAt", "dayKey"]) || !uuid(p.id) || !logicalDate(p.date) || !numericDate(p.completedAt) || !list(p.wordIds, 1000) || p.dayKey !== undefined && !day(p.dayKey)) return false;
    if (value.contextEvidence !== undefined && (!Array.isArray(value.contextEvidence) || value.contextEvidence.some((e) => !row(e) || !keys(e, ["id", "wordId", "roleId", "senseId", "date", "recordedAt", "capturedAt", "kind", "quality", "independent"]) || !uuid(e.id) || !id(e.wordId) || !roles.has(String(e.roleId)) || e.senseId !== `${e.wordId}::${e.roleId}` || !plausibleDay(e.date) || !numericDate(e.recordedAt) || Math.abs(Date.parse(midnight(String(e.date))) - Date.parse(midnight(foundationDateToISO(Number(e.recordedAt)).slice(0, 10)))) > 86400000 || e.capturedAt !== undefined && (!numericDate(e.capturedAt) || e.capturedAt > Number(e.recordedAt) || Math.abs(Date.parse(midnight(String(e.date))) - Date.parse(midnight(foundationDateToISO(e.capturedAt).slice(0, 10)))) > 86400000) || !["recognition", "unaided-recall", "self-assessed-production"].includes(String(e.kind)) || ![0, 1, 2, 3].includes(Number(e.quality)) || typeof e.quality !== "number" || typeof e.independent !== "boolean" || e.kind === "recognition" && e.independent))) return false;
    if (value.contextIntroducedOn !== undefined && (!row(value.contextIntroducedOn) || !Object.entries(value.contextIntroducedOn).every(([k, v]) => id(k) && k.includes("::") && logicalDate(v)))) return false;
    if (value.pathPlacements !== undefined && (!row(value.pathPlacements) || !Object.entries(value.pathPlacements).every(([k, p]) => roles.has(k) && row(p) && keys(p, ["pathId", "startingModuleId", "checkedAt", "correctAnswers", "questionCount"]) && id(p.pathId) && id(p.startingModuleId) && numericDate(p.checkedAt) && Number.isInteger(p.correctAnswers) && Number.isInteger(p.questionCount) && Number(p.correctAnswers) >= 0 && Number(p.correctAnswers) <= Number(p.questionCount) && Number(p.questionCount) === 6))) return false;
    if (value.activities !== undefined && (!Array.isArray(value.activities) || value.activities.some((p) => !row(p) || !keys(p, ["id", "kind", "wordId", "date", "dayKey", "quality", "productive"]) || !uuid(p.id) || !["practice", "review", "lesson"].includes(String(p.kind)) || p.wordId !== undefined && p.wordId !== null && !id(p.wordId) || !numericDate(p.date) || !day(p.dayKey) || ![0, 1, 2, 3].includes(Number(p.quality)) || typeof p.productive !== "boolean"))) return false;
    if (value.favouriteChanges !== undefined && (!row(value.favouriteChanges) || Object.values(value.favouriteChanges).some((p) => !row(p) || !keys(p, ["selected", "updatedAt"]) || typeof p.selected !== "boolean" || !numericDate(p.updatedAt)))) return false;
    return true;
  } catch { return false; }
}
export function webToSharedCloudState<T extends { version: number }>(value: WebLearningState<T>): Row {
  const state = prepareWebState(value), native = exportPortableBackup(state).learner as Row;
  const out = Object.fromEntries(rootKeys.filter((k) => native[k] !== undefined).map((k) => [k, native[k]]));
  // Notification, reminder and native speech preferences remain device-local.
  out.settings = { notificationsEnabled: false, reminderHour: 9, reminderMinute: 0, speechRate: 0.46 };
  const companion = state.learningV3.nativeCompanion;
  const originalSessions = Array.isArray(companion?.sessions) ? companion.sessions as Row[] : [];
  out.sessions = (out.sessions as Row[]).map((session) => {
    const original = originalSessions.find((p) => String(p.id).toLowerCase() === String(session.id).toLowerCase());
    const timeZone = row((state as Row).settings) && typeof ((state as Row).settings as Row).timeZone === "string" ? String(((state as Row).settings as Row).timeZone) : "Etc/UTC";
    const originalDay = original && (day(original.dayKey) ? original.dayKey : typeof original.date === "number" ? foundationDateToLocalDay(original.date, timeZone) : undefined);
    if (original && originalDay === session.dayKey && equal(original.wordIds, session.wordIds) && numericDate(original.completedAt) && foundationDateToISO(original.completedAt) === foundationDateToISO(Number(session.completedAt))) return copy(original);
    return session;
  });
  const timeZone = row((state as Row).settings) && typeof ((state as Row).settings as Row).timeZone === "string" ? String(((state as Row).settings as Row).timeZone) : "Etc/UTC";
  for (const [wordId, progress] of Object.entries(out.progressByWordId as Row)) {
    const original = row(companion?.progressByWordId) ? companion.progressByWordId[wordId] : undefined;
    if (!row(original) || !row(progress)) continue;
    for (const field of ["introducedOn", "nextReviewOn", "lastReviewedOn"]) if (typeof original[field] === "number" && typeof progress[field] === "number" && foundationDateToLocalDay(original[field], timeZone) === foundationDateToLocalDay(progress[field], timeZone)) progress[field] = original[field];
    if (Array.isArray(original.successfulReviewDates) && Array.isArray(progress.successfulReviewDates)) progress.successfulReviewDates = progress.successfulReviewDates.map((v) => (original.successfulReviewDates as unknown[]).find((date: unknown) => typeof date === "number" && foundationDateToLocalDay(date, timeZone) === foundationDateToLocalDay(Number(v), timeZone)) ?? v);
  }
  if (row(companion?.contextIntroducedOn) && row(out.contextIntroducedOn)) for (const [senseId, value] of Object.entries(out.contextIntroducedOn)) {
    const original = companion.contextIntroducedOn[senseId];
    if (typeof original === "number" && typeof value === "number" && foundationDateToISO(original).slice(0, 10) === foundationDateToISO(value).slice(0, 10)) out.contextIntroducedOn[senseId] = original;
  }
  // Foundation Date can carry sub-millisecond precision. Keep the immutable
  // native event timestamp when the JS display value denotes the same instant.
  const originalEvidence = Array.isArray(state.learningV3.nativeCompanion?.contextEvidence) ? state.learningV3.nativeCompanion.contextEvidence as Row[] : [];
  for (const event of out.contextEvidence as Row[] ?? []) {
    const original = originalEvidence.find((e) => String(e.id).toLowerCase() === String(event.id).toLowerCase());
    if (original && ["wordId", "roleId", "senseId", "date", "kind"].every((key) => equal(original[key], event[key])) && numericDate(original.recordedAt) && foundationDateToISO(original.recordedAt) === foundationDateToISO(Number(event.recordedAt))) {
      event.recordedAt = original.recordedAt;
      if (numericDate(original.capturedAt) && numericDate(event.capturedAt) && foundationDateToISO(original.capturedAt) === foundationDateToISO(event.capturedAt)) event.capturedAt = original.capturedAt;
    }
  }
  out.sharedLearning = derived(state.learningV3); out.updatedAt = isoToFoundationDate(state.learningV3.updatedAt);
  if (state.learningV3.profileUpdatedAt) out.profileUpdatedAt = isoToFoundationDate(state.learningV3.profileUpdatedAt);
  out.favouriteChanges = Object.fromEntries(Object.entries(state.learningV3.favouriteChanges).map(([k, p]) => [k, { selected: p.selected, updatedAt: isoToFoundationDate(p.updatedAt) }]));
  const activities: Row[] = Array.isArray(native.activities) ? copy(native.activities) : [];
  const addActivity = (source: string, kind: string, date: string, recordedAt: number, wordId: string | undefined, quality: number, productive: boolean) => {
    const activityId = stableUUID(source); if (activities.some((x) => String(x.id).toLowerCase() === activityId || kind !== "review" && x.kind === kind && x.dayKey === date && x.wordId === wordId)) return;
    activities.push({ id: activityId, kind, ...(wordId ? { wordId } : {}), date: recordedAt, dayKey: date, quality, productive });
  };
  for (const plan of Object.values((out.sharedLearning as SharedLearning).lessonCheckpoints)) for (const wordId of plan.completedWordIds) addActivity(`web:practice:${plan.dayKey}:${wordId}:${plan.updatedAt}`, "practice", plan.dayKey, isoToFoundationDate(plan.updatedAt), wordId, 0, false);
  for (const session of out.sessions as Row[]) { const date = day(session.dayKey) ? session.dayKey : foundationDateToISO(Number(session.date)).slice(0, 10); addActivity(`web:lesson:${session.id}`, "lesson", date, Number(session.completedAt), undefined, 2, true); }
  for (const event of state.learningV3.reviewEvidence) if (event.kind === "unaided-recall") addActivity(`web:review:${event.id}:${event.quality}:${event.independent}`, "review", event.date, isoToFoundationDate(event.recordedAtISO), event.wordId, event.quality, event.independent && event.quality >= 2);
  out.activities = activities;
  if (!validateSharedCloudState(out)) throw new Error("This account record cannot be safely synchronized.");
  return copy(out);
}
function mergeSessionRows(a: unknown, b: unknown): Row[] {
  const out = new Map<string, Row>();
  for (const source of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) if (row(source)) {
    const key = String(source.id).toLowerCase(); const p: Row = { ...source, id: key }, own = out.get(key);
    if (!own) { out.set(key, p); continue; }
    immutable(own, p, ["date", "wordIds"]);
    if (own.dayKey !== undefined && p.dayKey !== undefined && own.dayKey !== p.dayKey) throw new Error("Conflicting immutable session period.");
    const merged: Row = { ...own, completedAt: Math.min(Number(own.completedAt), Number(p.completedAt)) };
    if (own.dayKey === undefined || p.dayKey === undefined) delete merged.dayKey;
    out.set(key, merged);
  }
  return [...out.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
function immutableRows(a: unknown, b: unknown): Row[] {
  const out = new Map<string, Row>();
  for (const p of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) if (row(p)) { const key = String(p.id).toLowerCase(), normalized = { ...p, id: key }; const own = out.get(key); if (own && !equal(own, normalized)) throw new Error("Conflicting immutable activity identifiers."); out.set(key, normalized); }
  return [...out.values()].sort((x, y) => String(x.id).localeCompare(String(y.id)));
}
export function mergeSharedCloudStates(left: unknown, right: unknown): Row {
  if (!validateSharedCloudState(left) || !validateSharedCloudState(right)) throw new Error("Invalid shared account record.");
  const a = copy(left), b = copy(right), latest = Number(b.updatedAt ?? 0) > Number(a.updatedAt ?? 0) ? b : a;
  const out: Row = { ...a, ...latest, sharedLearning: mergeSharedLearning(a.sharedLearning, b.sharedLearning) };
  const profileNewer = Number(b.profileUpdatedAt ?? -Infinity) > Number(a.profileUpdatedAt ?? -Infinity) || Number(b.profileUpdatedAt ?? -Infinity) === Number(a.profileUpdatedAt ?? -Infinity) && stableText(b.profile ?? null) < stableText(a.profile ?? null) || !a.profile && b.profile && a.profileUpdatedAt === undefined;
  out.profile = profileNewer ? b.profile : a.profile; if (out.profile === undefined) delete out.profile;
  if (a.profileUpdatedAt !== undefined || b.profileUpdatedAt !== undefined) out.profileUpdatedAt = Math.max(Number(a.profileUpdatedAt ?? -978307200), Number(b.profileUpdatedAt ?? -978307200));
  for (const key of ["introducedWordIds", "favouriteWordIds"]) out[key] = union(a[key] as string[], b[key] as string[]);
  out.sessions = mergeSessionRows(a.sessions, b.sessions); out.activities = immutableRows(a.activities, b.activities);
  const progress: Row = { ...a.progressByWordId as Row };
  for (const [key, incoming] of Object.entries(b.progressByWordId as Row)) {
    const p = incoming as Row, own = progress[key] as Row | undefined; if (!own) { progress[key] = p; continue; }
    const newer = Number(p.lastReviewedOn ?? p.introducedOn) > Number(own.lastReviewedOn ?? own.introducedOn) ? p : own;
    const sameReview = Number(p.lastReviewedOn ?? p.introducedOn) === Number(own.lastReviewedOn ?? own.introducedOn);
    progress[key] = { ...newer, introducedOn: Math.min(Number(own.introducedOn), Number(p.introducedOn)), intervalIndex: sameReview ? Math.min(Number(own.intervalIndex), Number(p.intervalIndex)) : newer.intervalIndex, nextReviewOn: sameReview ? Math.min(Number(own.nextReviewOn), Number(p.nextReviewOn)) : newer.nextReviewOn, reviewCount: Math.max(Number(own.reviewCount), Number(p.reviewCount)), lapses: Math.max(Number(own.lapses), Number(p.lapses)), successfulReviewDates: [...new Set([...(own.successfulReviewDates as number[]), ...(p.successfulReviewDates as number[])])].sort((x, y) => x - y), mastered: sameReview ? own.mastered === true && p.mastered === true : newer.mastered };
  }
  out.progressByWordId = progress;
  const placements = { ...a.pathPlacements as Row }; for (const [key, p] of Object.entries(b.pathPlacements as Row ?? {})) if (!row(placements[key]) || Number((p as Row).checkedAt) > Number((placements[key] as Row).checkedAt)) placements[key] = p; out.pathPlacements = placements;
  const intro = { ...a.contextIntroducedOn as Row }; for (const [key, v] of Object.entries(b.contextIntroducedOn as Row ?? {})) intro[key] = Math.min(Number(intro[key] ?? v), Number(v)); out.contextIntroducedOn = intro;
  const evidence = new Map<string, Row>(); for (const p of [...(a.contextEvidence as Row[] ?? []), ...(b.contextEvidence as Row[] ?? [])]) {
    const key = String(p.id).toLowerCase(), own = evidence.get(key);
    if (own) { immutable(own, p, ["wordId", "roleId", "senseId", "date", "kind", "recordedAt"]); evidence.set(key, { ...own, quality: Math.min(Number(own.quality), Number(p.quality)), independent: own.independent === true && p.independent === true, ...(own.capturedAt !== undefined && p.capturedAt !== undefined ? { capturedAt: Math.max(Number(own.capturedAt), Number(p.capturedAt)) } : { capturedAt: undefined }) }); } else evidence.set(key, p);
  }
  const shared = out.sharedLearning as SharedLearning;
  for (const event of evidence.values()) if (event.capturedAt === undefined) delete event.capturedAt;
  out.contextEvidence = [...evidence.values()].map((p) => { const exposure = shared.exposures[String(p.senseId)]; if (p.independent && exposure?.dayKey === p.date && (p.capturedAt === undefined || Number(p.capturedAt) >= isoToFoundationDate(exposure.firstSeenAt))) return { ...p, independent: false, quality: Math.min(1, Number(p.quality)) }; return p; }).sort((x, y) => String(x.id).localeCompare(String(y.id)));
  const fav = { ...a.favouriteChanges as Row }; for (const [key, incoming] of Object.entries(b.favouriteChanges as Row ?? {})) { const own = fav[key] as Row | undefined, p = incoming as Row; if (!own || Number(p.updatedAt) > Number(own.updatedAt) || Number(p.updatedAt) === Number(own.updatedAt) && p.selected === false) fav[key] = p; } out.favouriteChanges = fav;
  out.favouriteWordIds = (out.favouriteWordIds as string[]).filter((k) => (fav[k] as Row | undefined)?.selected !== false);
  for (const [key, p] of Object.entries(fav)) if ((p as Row).selected && !(out.favouriteWordIds as string[]).includes(key)) (out.favouriteWordIds as string[]).push(key);
  if (!validateSharedCloudState(out)) throw new Error("The shared merge could not be safely applied.");
  return copy(out);
}
export function sharedCloudStateToWeb<T extends { version: number }>(native: unknown, local: WebLearningState<T>, defaults?: T): WebLearningState<T> {
  if (!validateSharedCloudState(native)) throw new Error("Invalid shared account response.");
  const source = mergeSharedCloudStates(webToSharedCloudState(local), native);
  const merged = importPortableBackup({ version: 2, learner: source }, local, defaults), shared = normalized(source.sharedLearning);
  const ext = merged.learningV3;
  const localSettings = (local as Row).settings;
  if (row(localSettings) && row((merged as Row).settings)) for (const key of ["lessonTime", "notificationsEnabled", "audioRate"]) if (localSettings[key] !== undefined) ((merged as Row).settings as Row)[key] = localSettings[key];
  // Preserve an explicit local milestone archive when the verified backend
  // replaces legacy aggregate mastery with role-specific recall evidence.
  const oldCompanion = local.learningV3.nativeCompanion;
  const historical = new Set<string>(Array.isArray(oldCompanion?.historicalMasteredWordIds) ? oldCompanion.historicalMasteredWordIds.filter((id): id is string => typeof id === "string") : []);
  for (const [id, p] of Object.entries(row((local as Row).masteryByWordId) ? (local as Row).masteryByWordId as Row : {})) if (row(p) && p.mastered === true) historical.add(id);
  for (const [id, p] of Object.entries(row(oldCompanion?.progressByWordId) ? oldCompanion.progressByWordId : {})) if (row(p) && p.mastered === true) historical.add(id);
  if (historical.size) ext.nativeCompanion = { ...ext.nativeCompanion, historicalMasteredWordIds: [...historical].sort() };
  if (row((merged as Row).masteryByWordId)) for (const [id, p] of Object.entries((merged as Row).masteryByWordId as Row)) if (row(p) && row((source.progressByWordId as Row)[id])) { p.mastered = ((source.progressByWordId as Row)[id] as Row).mastered === true; }
  if (row(source.profile) && Number(source.profileUpdatedAt ?? source.updatedAt ?? 0) >= isoToFoundationDate(local.learningV3.profileUpdatedAt ?? "1970-01-01T00:00:00.000Z")) { (merged as Row).profile = copy(source.profile); if (numericDate(source.profileUpdatedAt)) ext.profileUpdatedAt = foundationDateToISO(source.profileUpdatedAt); }
  ext.sharedLearning = shared;
  if (numericDate(source.updatedAt) && Date.parse(foundationDateToISO(source.updatedAt)) > Date.parse(ext.updatedAt)) ext.updatedAt = foundationDateToISO(source.updatedAt);
  for (const [key, p] of Object.entries(shared.lessonCheckpoints)) {
    const own = ext.rolePlans[key], oldAnswers = own?.answers ?? {}, answers = { ...oldAnswers };
    for (const [wordId, a] of Object.entries(p.answers ?? {})) answers[wordId] = { ...(oldAnswers[wordId] ?? { wrongChoiceIds: [], completed: false }), choiceId: a.choiceId, helped: a.hinted || oldAnswers[wordId]?.helped === true };
    for (const wordId of p.wordIds) if (shared.exposures[`${wordId}::${p.roleId}`]?.dayKey === p.dayKey) answers[wordId] = { ...(answers[wordId] ?? { choiceId: "", wrongChoiceIds: [], completed: false }), helped: true };
    ext.rolePlans[key] = { id: own?.id ?? key, date: p.dayKey, roleId: p.roleId, wordIds: p.wordIds, completedIds: p.completedWordIds, cursor: p.cursorWordId ? p.wordIds.indexOf(p.cursorWordId) : p.wordIds.length, answers, createdAt: own?.createdAt ?? p.updatedAt };
  }
  for (const [roleId, p] of Object.entries(shared.startingChecks)) { const path = professionalLearningPaths.find((x) => x.id === p.pathId && x.roleId === roleId); if (path?.startingCheck) ext.startingCheckDrafts[roleId] = { pathId: p.pathId, signature: JSON.stringify(path.startingCheck), answers: p.answers, updatedAt: p.updatedAt }; }
  for (const [senseId, p] of Object.entries(shared.exposures)) if (!ext.exposedOn[senseId] || p.dayKey > ext.exposedOn[senseId]) ext.exposedOn[senseId] = p.dayKey;
  const spaces = workspaces(ext.expressionDraft);
  for (const roleId of roles) {
    const notes = Object.values(shared.notebook).filter((x) => x.roleId === roleId), rehearsals = Object.values(shared.rehearsals).filter((x) => x.roleId === roleId), challenges = Object.values(shared.challenges).filter((x) => x.roleId === roleId);
    if (!notes.length && !rehearsals.length && !challenges.length) continue;
    const own = spaces[roleId] ?? { version: 1, roleId, intent: "", goalId: "clarify", screen: "find", matchesVisible: false, scenarioId: "", response: "", submittedResponse: "", responses: {}, phase: "draft", hintExposed: false, attemptIndependent: false, hintedOn: {}, attemptId: "", attemptDate: "", notebook: [], practiceDates: [], practiceWordIds: [], nuanceAnswers: {}, fresh: false, pendingCheckpoints: [], completedChallengeCounts: [], challengeScenarioIds: [], challengeCompletedIds: [] };
    const notebook = new Map((Array.isArray(own.notebook) ? own.notebook : []).filter(row).map((x) => [stableUUID(String(x.id)), x]));
    for (const note of notes) notebook.set(note.id, { ...notebook.get(note.id), id: note.id, expressionId: note.expressionId, variant: note.style, phrase: note.phrase, intent: notebook.get(note.id)?.intent ?? "", createdOn: note.createdAt.slice(0, 10), createdAt: note.createdAt, nextReviewOn: note.nextReviewOn, ...(note.lastPractisedAt ? { lastPractisedAt: note.lastPractisedAt } : {}) });
    own.notebook = [...notebook.values()]; own.rehearsalHistory = rehearsals; own.challengeHistory = challenges;
    const checkpoints = new Map((Array.isArray(own.pendingCheckpoints) ? own.pendingCheckpoints : []).filter(row).map((x) => [`${x.scenarioId}:${x.dueOn}`, x]));
    for (const r of rehearsals.filter((x) => x.mode === "initial" && x.completedAt)) { const dueOn = plusDay(r.completedAt!.slice(0, 10)); const delayed = rehearsals.filter((x) => x.mode === "delayed" && x.scenarioId === r.scenarioId && x.completedAt && x.completedAt >= r.completedAt!); checkpoints.set(`${r.scenarioId}:${dueOn}`, { scenarioId: r.scenarioId, dueOn, ...(r.gapId ? { gapId: r.gapId } : {}), ...(delayed.length ? { completedOn: delayed.map((x) => x.completedAt!.slice(0, 10)).sort()[0] } : {}) }); }
    for (const note of notes) {
      const linked = rehearsals.filter((r) => r.completedAt && (r.gapId === note.id || !r.gapId && r.expressionId === note.expressionId && r.completedAt >= note.createdAt)).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
      if (!linked.length) continue;
      const scenarioId = linked[0].scenarioId, key = `${scenarioId}:${note.nextReviewOn}`;
      const completion = linked.find((r) => r.mode === "delayed" && r.completedAt!.slice(0, 10) >= note.nextReviewOn);
      if (!checkpoints.has(key)) checkpoints.set(key, { scenarioId, dueOn: note.nextReviewOn, gapId: note.id, ...(completion ? { completedOn: completion.completedAt!.slice(0, 10) } : {}) });
      else if (!checkpoints.get(key)?.gapId) checkpoints.get(key)!.gapId = note.id;
    }
    own.pendingCheckpoints = [...checkpoints.values()]; own.practiceDates = union(Array.isArray(own.practiceDates) ? own.practiceDates as string[] : [], rehearsals.flatMap((x) => x.completedAt ? [x.completedAt.slice(0, 10)] : []));
    own.practiceWordIds = union(Array.isArray(own.practiceWordIds) ? own.practiceWordIds as string[] : [], rehearsals.filter((x) => x.completedAt).flatMap((x) => scenarios.get(x.scenarioId)?.wordIds ?? []));
    own.completedChallengeCounts = [...new Set([...(Array.isArray(own.completedChallengeCounts) ? own.completedChallengeCounts : []), ...challenges.filter((x) => x.mode === "transfer" && x.completedAt).map((x) => x.milestone)])];
    const pending = challenges.filter((x) => x.mode === "transfer" && !x.completedAt).sort((a, b) => a.milestone - b.milestone)[0]; if (pending) { own.challengeCount = pending.milestone; own.challengeScenarioIds = pending.scenarioIds; own.challengeCompletedIds = pending.completedScenarioIds; }
    const comeback = challenges.filter((x) => x.mode === "comeback" && x.completedAt).map((x) => x.completedAt!.slice(0, 10)).sort().at(-1); if (comeback) own.completedComebackOn = comeback;
    spaces[roleId] = own;
  }
  if (Object.keys(spaces).length) ext.expressionDraft = JSON.stringify({ version: 2, workspaces: spaces });
  return prepareWebState(merged, defaults);
}
