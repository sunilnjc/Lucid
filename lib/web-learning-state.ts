import type { SharedLearning } from "./shared-learning-state";
import { validateDailyVocabulary, mergeDailyVocabulary, type DailyVocabularyLocal } from "./daily-vocabulary-state";
/** Versioned learning metadata. Private responses and unfinished work stay local. */
export const WEB_STATE_VERSION = 3;
export const MAX_STATE_BYTES = 2_000_000;
const FOUNDATION_EPOCH = 978307200;
const INTERVALS = [1, 3, 7, 14, 30] as const;
type JsonRecord = Record<string, unknown>;
export type EvidenceKind = "recognition" | "unaided-recall" | "self-assessed-production";
export type ContextEvidence = { id: string; wordId: string; roleId: string; senseId: string; date: string; recordedAtISO: string; capturedAtISO?: string; kind: EvidenceKind; quality: 0 | 1 | 2 | 3; independent: boolean };
export type ContextMastery = { wordId: string; roleId: string; senseId: string; introducedOn: string; intervalIndex: number; intervalDays: number; nextReviewOn: string; lastReviewedOn?: string; lastQuality?: number; reviewCount: number; successfulReviewCount: number; lapses: number; productiveSuccessDates: string[]; retainedAfter30Days: boolean; mastered: boolean; masteredOn?: string };
export type RolePlan = { id: string; date: string; roleId: string; wordIds: string[]; completedIds: string[]; cursor: number; answers: Record<string, { signature?: string; choices?: string[]; choiceId: string; wrongChoiceIds: string[]; completed: boolean; revealed?: boolean; helped: boolean; correct?: boolean }>; createdAt: string };
export type Placement = { pathId: string; startingModuleId: string; checkedAtISO?: string; checkedAt?: string; correctCount?: number; correctAnswers?: number; questionCount: number };
export type WebLearningExtension = {
  version: 3; updatedAt: string; profileUpdatedAt?: string;
  rolePlans: Record<string, RolePlan>; placementsByRole: Record<string, Placement>;
  contextIntroducedOn: Record<string, string>; reviewEvidence: ContextEvidence[]; contextMastery: Record<string, ContextMastery>;
  favouriteChanges: Record<string, { selected: boolean; updatedAt: string }>;
  startingCheckDrafts: Record<string, { pathId: string; signature: string; answers: number[]; updatedAt?: string }>;
  reviewDrafts: Record<string, { sentence: string; response?: string; hinted: boolean; revealed: boolean; originalResponse?: string; originalIndependent?: boolean; originalCapturedOn?: string; originalCapturedAtISO?: string }>;
  practiceDrafts: Record<string, string>; expressionDraft: string; exposedOn: Record<string, string>;
  /** Opaque native-only fields retained across a manual round trip, never uploaded. */
  nativeCompanion?: JsonRecord;
  sharedLearning?: SharedLearning;
  dailyVocabulary?: DailyVocabularyLocal;
};
export type WebLearningState<T extends { version: number } = { version: number } & JsonRecord> = T & { learningV3: WebLearningExtension };
type MutableWebState = { version: number; learningV3: WebLearningExtension } & JsonRecord;
const record = (value: unknown): value is JsonRecord => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const validISO = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const validDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const timestamp = (value: unknown) => validISO(value) ? Date.parse(value) : 0;
function inspectJSON(value: unknown, depth = 0, seen = new Set<object>()): boolean {
  if (depth > 32) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return false;
  seen.add(value);
  const entries = Object.entries(value);
  const valid = entries.length <= 30_000 && entries.every(([key, item]) => !["__proto__", "prototype", "constructor"].includes(key) && inspectJSON(item, depth + 1, seen));
  seen.delete(value); return valid;
}
function evidenceValid(value: unknown): value is ContextEvidence {
  if (!record(value)) return false;
  return typeof value.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && typeof value.wordId === "string" && value.wordId.length > 0 && typeof value.roleId === "string" && value.roleId.length > 0
    && (value.capturedAtISO === undefined || validISO(value.capturedAtISO) && timestamp(value.capturedAtISO) <= timestamp(value.recordedAtISO))
    && value.senseId === contextEvidenceKey(value.wordId, value.roleId) && validDay(value.date) && validISO(value.recordedAtISO)
    && ["recognition", "unaided-recall", "self-assessed-production"].includes(String(value.kind))
    && [0, 1, 2, 3].includes(Number(value.quality)) && typeof value.quality === "number" && typeof value.independent === "boolean"
    && !(value.kind === "recognition" && value.independent);
}
export function validateWebState(value: unknown): value is WebLearningState {
  try {
    if (!inspectJSON(value) || !record(value) || !Number.isInteger(value.version) || Number(value.version) < 1 || Number(value.version) > WEB_STATE_VERSION) return false;
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_STATE_BYTES) return false;
    for (const key of ["introducedWordIds", "difficultIds", "favouriteIds", "reviewedIds"]) if (value[key] !== undefined && !strings(value[key])) return false;
    for (const key of ["masteryByWordId", "masteryScores", "reviewDates", "nextReviewAt", "usageAttempts", "settings"]) if (value[key] !== undefined && !record(value[key])) return false;
    for (const key of ["dailySessions", "quizAttempts"]) if (value[key] !== undefined && !Array.isArray(value[key])) return false;
    if (record(value.masteryByWordId)) for (const mastery of Object.values(value.masteryByWordId)) {
      if (!record(mastery) || !validDay(mastery.introducedOn) || !validDay(mastery.nextReviewOn) || !Number.isInteger(mastery.intervalIndex) || Number(mastery.intervalIndex) < 0 || Number(mastery.intervalIndex) > 4 || !Number.isInteger(mastery.reviewCount) || Number(mastery.reviewCount) < 0 || !Number.isInteger(mastery.lapses) || Number(mastery.lapses) < 0 || !strings(mastery.productiveSuccessDates) || !mastery.productiveSuccessDates.every(validDay) || (mastery.lastReviewedOn !== undefined && !validDay(mastery.lastReviewedOn))) return false;
    }
    if (Array.isArray(value.dailySessions) && !value.dailySessions.every((session) => record(session) && typeof session.id === "string" && validDay(session.date) && strings(session.wordIds) && validISO(session.completedAt))) return false;
    if (value.profile !== undefined && value.profile !== null && (!record(value.profile) || typeof value.profile.roleId !== "string" || typeof value.profile.seniorityId !== "string" || !strings(value.profile.situationIds) || !strings(value.profile.goalIds))) return false;
    const ext = value.learningV3;
    if (ext === undefined) return true; // Legacy migration is local and lossless.
    if (!record(ext) || ext.version !== 3) return false;
    for (const key of ["rolePlans", "placementsByRole", "contextIntroducedOn", "contextMastery", "favouriteChanges", "startingCheckDrafts", "reviewDrafts", "practiceDrafts", "exposedOn"]) if (ext[key] !== undefined && !record(ext[key])) return false;
    if (ext.reviewEvidence !== undefined && (!Array.isArray(ext.reviewEvidence) || !ext.reviewEvidence.every(evidenceValid))) return false;
    if (Array.isArray(ext.reviewEvidence)) { const identities = new Map<string, string>(); for (const event of ext.reviewEvidence as ContextEvidence[]) { const id = event.id.toLowerCase(); const identity = JSON.stringify([event.wordId, event.roleId, event.senseId, event.date, event.kind]); if (identities.has(id) && identities.get(id) !== identity) return false; identities.set(id, identity); } }
    if (record(ext.rolePlans)) for (const plan of Object.values(ext.rolePlans)) {
      if (!record(plan) || typeof plan.id !== "string" || !validDay(plan.date) || typeof plan.roleId !== "string" || !strings(plan.wordIds) || plan.wordIds.length > 3 || !strings(plan.completedIds) || !plan.completedIds.every((id) => (plan.wordIds as string[]).includes(id)) || !Number.isInteger(plan.cursor) || Number(plan.cursor) < 0 || Number(plan.cursor) > plan.wordIds.length || !record(plan.answers) || !validISO(plan.createdAt)) return false;
    }
    if (record(ext.placementsByRole)) for (const placement of Object.values(ext.placementsByRole)) {
      if (!record(placement) || typeof placement.pathId !== "string" || typeof placement.startingModuleId !== "string" || !validISO(placement.checkedAtISO ?? placement.checkedAt) || !Number.isInteger(placement.questionCount) || Number(placement.questionCount) < 1 || !Number.isInteger(placement.correctCount ?? placement.correctAnswers) || Number(placement.correctCount ?? placement.correctAnswers) < 0 || Number(placement.correctCount ?? placement.correctAnswers) > Number(placement.questionCount)) return false;
    }
    if (record(ext.contextIntroducedOn) && !Object.values(ext.contextIntroducedOn).every(validDay)) return false;
    if (record(ext.favouriteChanges) && !Object.values(ext.favouriteChanges).every((change) => record(change) && typeof change.selected === "boolean" && validISO(change.updatedAt))) return false;
    if (record(ext.exposedOn) && !Object.values(ext.exposedOn).every(validDay)) return false;
    if (record(ext.reviewDrafts)) for (const draft of Object.values(ext.reviewDrafts)) {
      if (!record(draft) || typeof draft.hinted !== "boolean" || typeof draft.revealed !== "boolean") return false;
      for (const key of ["sentence", "response", "originalResponse"]) if (draft[key] !== undefined && typeof draft[key] !== "string") return false;
      if (draft.originalIndependent !== undefined && typeof draft.originalIndependent !== "boolean") return false;
      if (draft.originalCapturedOn !== undefined && !validDay(draft.originalCapturedOn)) return false;
      if (draft.originalCapturedAtISO !== undefined && !validISO(draft.originalCapturedAtISO)) return false;
    }
    if (ext.dailyVocabulary !== undefined && !validateDailyVocabulary(ext.dailyVocabulary)) return false;
    const shared = ext.sharedLearning;
    if (shared !== undefined && (!record(shared) || shared.version !== 1 || ["lessonCheckpoints", "startingChecks", "notebook", "rehearsals", "challenges", "exposures"].some((key) => shared[key] !== undefined && !record(shared[key])))) return false;
    if (ext.expressionDraft !== undefined && typeof ext.expressionDraft !== "string") return false;
    return true;
  } catch { return false; }
}
export function contextEvidenceKey(wordId: string, roleId: string) { return `${wordId}::${roleId}`; }
export function makeReviewEvidence(input: {
  id?: string; wordId: string; roleId: string; senseId?: string; date: string; recordedAtISO?: string; capturedAtISO?: string; kind: EvidenceKind; quality: number; independent: boolean;
  response?: string; assisted?: boolean; modelSeen?: boolean; meaningAttested?: boolean; naturalnessAttested?: boolean;
}): ContextEvidence | null {
  if (!validDay(input.date) || ![0, 1, 2, 3].includes(input.quality) || !input.wordId || !input.roleId) return null;
  const productive = input.kind !== "recognition";
  const hasResponse = typeof input.response === "string" && input.response.trim().length >= 12 && input.response.trim().split(/\s+/).length >= 4;
  const independent = productive && input.independent && !input.assisted && !input.modelSeen && hasResponse;
  const quality = productive && !independent ? Math.min(1, input.quality) : input.quality;
  // An explicit failed retrieval can have no response; it never earns success credit.
  if (productive && !hasResponse && !(input.kind === "unaided-recall" && quality <= 1 && (input.quality <= 1 || input.assisted || input.modelSeen))) return null;
  if (input.kind === "self-assessed-production" && (!input.meaningAttested || !input.naturalnessAttested)) return null;
  const value: ContextEvidence = {
    id: input.id ?? crypto.randomUUID(), wordId: input.wordId, roleId: input.roleId, senseId: contextEvidenceKey(input.wordId, input.roleId), date: input.date,
    recordedAtISO: input.recordedAtISO ?? new Date().toISOString(), ...(input.capturedAtISO ? { capturedAtISO: input.capturedAtISO } : {}), kind: input.kind, quality: quality as ContextEvidence["quality"],
    independent,
  };
  return evidenceValid(value) ? value : null;
}
function emptyExtension(): WebLearningExtension {
  return { version: 3, updatedAt: "1970-01-01T00:00:00.000Z", rolePlans: {}, placementsByRole: {}, contextIntroducedOn: {}, reviewEvidence: [], contextMastery: {}, favouriteChanges: {}, startingCheckDrafts: {}, reviewDrafts: {}, practiceDrafts: {}, exposedOn: {}, expressionDraft: "" };
}
function addDays(day: string, count: number) { return new Date(Date.parse(day + "T00:00:00Z") + count * 86400000).toISOString().slice(0, 10); }
function rebuildContextMastery(extension: WebLearningExtension): Record<string, ContextMastery> {
  const grouped: Record<string, ContextEvidence[]> = {};
  for (const item of extension.reviewEvidence) (grouped[item.senseId] ??= []).push(item);
  const result: Record<string, ContextMastery> = {};
  for (const [senseId, events] of Object.entries(grouped)) {
    events.sort((a, b) => a.date.localeCompare(b.date) || a.recordedAtISO.localeCompare(b.recordedAtISO) || a.id.localeCompare(b.id));
    const introducedOn = extension.contextIntroducedOn[senseId] ?? events[0].date;
    let state: ContextMastery = { wordId: events[0].wordId, roleId: events[0].roleId, senseId, introducedOn, intervalIndex: 0, intervalDays: 1, nextReviewOn: addDays(introducedOn, 1), reviewCount: 0, successfulReviewCount: 0, lapses: 0, productiveSuccessDates: [], retainedAfter30Days: false, mastered: false };
    const days = new Map<string, ContextEvidence[]>();
    for (const event of events) if (event.date >= introducedOn) days.set(event.date, [...(days.get(event.date) ?? []), event]);
    for (const [date, sameDay] of days) {
      // Concurrent events on one day cannot multiply retention credit. The weakest result wins.
      const reviews = sameDay.filter((item) => item.kind === "unaided-recall");
      if (!reviews.length) continue;
      const independent = reviews.every((item) => item.independent);
      const quality = Math.min(independent ? 3 : 1, ...reviews.map((item) => item.quality));
      const retainedRecall = independent && reviews.every((item) => item.kind === "unaided-recall");
      const successful = quality >= 2;
      const intervalIndex = quality === 0 ? 0 : quality === 1 ? Math.max(0, state.intervalIndex - 1) : Math.min(4, state.intervalIndex + (quality === 3 ? 2 : 1));
      const productiveSuccessDates = retainedRecall && successful ? [...state.productiveSuccessDates, date] : state.productiveSuccessDates;
      const retainedAfter30Days = productiveSuccessDates.some((day) => Date.parse(day) - Date.parse(introducedOn) >= 30 * 86400000);
      const mastered = productiveSuccessDates.length >= 3 && retainedAfter30Days && successful && retainedRecall;
      state = { ...state, intervalIndex, intervalDays: INTERVALS[intervalIndex], nextReviewOn: addDays(date, INTERVALS[intervalIndex]), lastReviewedOn: date, lastQuality: quality, reviewCount: state.reviewCount + 1, successfulReviewCount: state.successfulReviewCount + Number(successful), lapses: state.lapses + Number(quality === 0), productiveSuccessDates, retainedAfter30Days, mastered, ...(state.masteredOn || mastered ? { masteredOn: state.masteredOn ?? date } : {}) };
    }
    result[senseId] = state;
  }
  for (const [senseId, introducedOn] of Object.entries(extension.contextIntroducedOn)) if (!result[senseId]) {
    const [wordId, roleId] = senseId.split("::");
    if (wordId && roleId) result[senseId] = { wordId, roleId, senseId, introducedOn, intervalIndex: 0, intervalDays: 1, nextReviewOn: addDays(introducedOn, 1), reviewCount: 0, successfulReviewCount: 0, lapses: 0, productiveSuccessDates: [], retainedAfter30Days: false, mastered: false };
  }
  return result;
}
export function prepareWebState<T extends { version: number }>(value: unknown, defaults?: T): WebLearningState<T> {
  if (!validateWebState(value)) throw new Error("That learning record is invalid or requires a newer version of Lucid.");
  const base = { ...(defaults ? clone(defaults) : {}), ...clone(value) } as unknown as unknown as MutableWebState;
  if (defaults && record((defaults as JsonRecord).settings)) base.settings = { ...(defaults as JsonRecord).settings as JsonRecord, ...(record(base.settings) ? base.settings : {}) };
  const saved = record(base.learningV3) ? base.learningV3 : {};
  const extension = { ...emptyExtension(), ...saved, version: 3 as const } as WebLearningExtension;
  for (const [key, placement] of Object.entries(extension.placementsByRole)) extension.placementsByRole[key] = { ...placement, checkedAtISO: placement.checkedAtISO ?? placement.checkedAt, correctCount: placement.correctCount ?? placement.correctAnswers };
  extension.reviewEvidence = deduplicateEvidence(extension.reviewEvidence);
  extension.contextMastery = rebuildContextMastery(extension);
  base.version = WEB_STATE_VERSION; base.learningV3 = extension;
  const normalized = clone(base);
  if (!validateWebState(normalized)) throw new Error("Lucid could not safely migrate this learning record.");
  return normalized as WebLearningState<T>;
}
function unionStrings(left: unknown, right: unknown) { return [...new Set([...(strings(left) ? left : []), ...(strings(right) ? right : [])])].sort(); }
function deduplicateEvidence(events: ContextEvidence[]) {
  const byId = new Map<string, ContextEvidence>();
  for (const source of events) {
    const event = { ...source, id: source.id.toLowerCase() };
    const old = byId.get(event.id);
    if (!old) byId.set(event.id, event);
    else if (event.wordId === old.wordId && event.senseId === old.senseId && event.date === old.date && event.kind === old.kind) byId.set(event.id, { ...old, quality: Math.min(old.quality, event.quality) as ContextEvidence["quality"], independent: old.independent && event.independent, recordedAtISO: [old.recordedAtISO, event.recordedAtISO].sort()[0], ...(old.capturedAtISO && event.capturedAtISO ? { capturedAtISO: timestamp(old.capturedAtISO) >= timestamp(event.capturedAtISO) ? old.capturedAtISO : event.capturedAtISO } : { capturedAtISO: undefined }) });
    else throw new Error("Conflicting learning events share an identifier. The records were not replaced.");
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
function mergeRows(left: unknown, right: unknown): unknown[] {
  const items = [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])];
  const seen = new Map<string, unknown>();
  for (const item of items) { const key = record(item) && typeof item.id === "string" ? item.id : JSON.stringify(item); if (!seen.has(key)) seen.set(key, item); }
  return [...seen.values()];
}
function mergeLegacyMastery(left: unknown, right: unknown): JsonRecord {
  const result: JsonRecord = { ...(record(left) ? left : {}) };
  for (const [id, incoming] of Object.entries(record(right) ? right : {})) {
    const own = result[id];
    if (!record(own) || !record(incoming)) { result[id] ??= incoming; continue; }
    const newer = String(incoming.lastReviewedOn ?? incoming.introducedOn) > String(own.lastReviewedOn ?? own.introducedOn) ? incoming : own;
    result[id] = { ...own, ...incoming, ...newer, productiveSuccessDates: unionStrings(own.productiveSuccessDates, incoming.productiveSuccessDates), reviewCount: Math.max(Number(own.reviewCount) || 0, Number(incoming.reviewCount) || 0), successfulReviewCount: Math.max(Number(own.successfulReviewCount) || 0, Number(incoming.successfulReviewCount) || 0), lapses: Math.max(Number(own.lapses) || 0, Number(incoming.lapses) || 0) };
  }
  return result;
}
export function mergeWebStates<T extends { version: number }>(local: unknown, remote: unknown, defaults?: T): WebLearningState<T> {
  const own = prepareWebState(local, defaults) as unknown as MutableWebState;
  const incoming = prepareWebState(remote, defaults) as unknown as MutableWebState;
  const a = own.learningV3, b = incoming.learningV3;
  const newer = timestamp(b.updatedAt) > timestamp(a.updatedAt) ? incoming : own;
  const merged = { ...incoming, ...own, settings: { ...(record(incoming.settings) ? incoming.settings : {}), ...(record(own.settings) ? own.settings : {}), ...(record(newer.settings) ? newer.settings : {}) } } as unknown as MutableWebState;
  merged.profile = timestamp(b.profileUpdatedAt) > timestamp(a.profileUpdatedAt) || own.profile == null && incoming.profile != null && !a.profileUpdatedAt ? incoming.profile : own.profile;
  for (const key of ["introducedWordIds", "difficultIds", "reviewedIds"]) merged[key] = unionStrings(own[key], incoming[key]);
  merged.completedDays = [...new Set([...(Array.isArray(own.completedDays) ? own.completedDays : []), ...(Array.isArray(incoming.completedDays) ? incoming.completedDays : [])])];
  merged.dailySessions = mergeRows(own.dailySessions, incoming.dailySessions); merged.quizAttempts = mergeRows(own.quizAttempts, incoming.quizAttempts);
  merged.masteryByWordId = mergeLegacyMastery(own.masteryByWordId, incoming.masteryByWordId);
  for (const key of ["masteryScores", "reviewDates", "nextReviewAt"]) merged[key] = { ...(record(incoming[key]) ? incoming[key] : {}), ...(record(own[key]) ? own[key] : {}) };
  const ext: WebLearningExtension = { ...b, ...a, updatedAt: timestamp(b.updatedAt) > timestamp(a.updatedAt) ? b.updatedAt : a.updatedAt, profileUpdatedAt: timestamp(b.profileUpdatedAt) > timestamp(a.profileUpdatedAt) ? b.profileUpdatedAt : a.profileUpdatedAt, reviewEvidence: deduplicateEvidence([...a.reviewEvidence, ...b.reviewEvidence]), contextIntroducedOn: { ...b.contextIntroducedOn, ...a.contextIntroducedOn }, favouriteChanges: { ...a.favouriteChanges }, placementsByRole: { ...a.placementsByRole }, rolePlans: { ...a.rolePlans } };
  for (const [key, date] of Object.entries(b.contextIntroducedOn)) ext.contextIntroducedOn[key] = [date, a.contextIntroducedOn[key] ?? date].sort()[0];
  for (const [id, change] of Object.entries(b.favouriteChanges)) if (!ext.favouriteChanges[id] || timestamp(change.updatedAt) > timestamp(ext.favouriteChanges[id].updatedAt) || timestamp(change.updatedAt) === timestamp(ext.favouriteChanges[id].updatedAt) && !change.selected) ext.favouriteChanges[id] = change;
  for (const [roleId, placement] of Object.entries(b.placementsByRole)) if (!ext.placementsByRole[roleId] || timestamp(placement.checkedAtISO ?? placement.checkedAt) > timestamp(ext.placementsByRole[roleId].checkedAtISO ?? ext.placementsByRole[roleId].checkedAt)) ext.placementsByRole[roleId] = placement;
  for (const [key, plan] of Object.entries(b.rolePlans)) {
    const existing = ext.rolePlans[key];
    if (!existing) ext.rolePlans[key] = { ...plan, cursor: 0, answers: {} };
    else if (JSON.stringify(existing.wordIds) === JSON.stringify(plan.wordIds)) ext.rolePlans[key] = { ...existing, completedIds: unionStrings(existing.completedIds, plan.completedIds).filter((id) => existing.wordIds.includes(id)) };
    // Conflicting daily plans are retained on their own device; completed history is unioned above.
  }
  merged.favouriteIds = unionStrings(own.favouriteIds, incoming.favouriteIds).filter((id) => ext.favouriteChanges[id]?.selected !== false);
  for (const [id, change] of Object.entries(ext.favouriteChanges)) if (change.selected && !(merged.favouriteIds as string[]).includes(id)) (merged.favouriteIds as string[]).push(id);
  for (const [key, day] of Object.entries(b.exposedOn)) if (!ext.exposedOn[key] || day > ext.exposedOn[key]) ext.exposedOn[key] = day;
  if (a.sharedLearning || b.sharedLearning) ext.sharedLearning = { version: 1, ...Object.fromEntries(["lessonCheckpoints", "startingChecks", "notebook", "rehearsals", "challenges", "exposures"].map((key) => [key, { ...(b.sharedLearning?.[key as keyof SharedLearning] as JsonRecord ?? {}), ...(a.sharedLearning?.[key as keyof SharedLearning] as JsonRecord ?? {}) }])) } as SharedLearning;
  // A normal remote pull never imports another device’s private daily work.
  if (a.dailyVocabulary) ext.dailyVocabulary = a.dailyVocabulary; else delete ext.dailyVocabulary;
  merged.learningV3 = ext;
  return prepareWebState(clone(merged), defaults);
}
export function toCloudWebState<T extends { version: number }>(value: WebLearningState<T>): WebLearningState<T> {
  const state = prepareWebState(value) as unknown as MutableWebState;
  const allowed = new Set(["version", "profile", "introducedWordIds", "masteryByWordId", "dailySessions", "betaFeedbackSubmittedAt", "lessonStatus", "lessonWordProgress", "completedDays", "difficultIds", "favouriteIds", "reviewedIds", "masteryScores", "reviewDates", "nextReviewAt", "quizAttempts", "settings", "lastNotificationDate", "learningV3"]);
  for (const key of Object.keys(state)) if (!allowed.has(key)) delete state[key];
  const ext = state.learningV3;
  const pick = (source: JsonRecord, keys: string[]) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
  if (record(state.profile)) state.profile = pick(state.profile, ["roleId", "seniorityId", "situationIds", "goalIds"]);
  if (record(state.settings)) state.settings = pick(state.settings, ["lessonTime", "timeZone", "notificationsEnabled", "generationMode", "difficulty", "textSize", "dailyWordCount"]);
  if (Array.isArray(state.dailySessions)) state.dailySessions = state.dailySessions.filter(record).map((item) => pick(item, ["id", "date", "roleId", "situationId", "wordIds", "completedAt"]));
  if (record(state.masteryByWordId)) state.masteryByWordId = Object.fromEntries(Object.entries(state.masteryByWordId).filter(([, item]) => record(item)).map(([key, item]) => [key, pick(item as JsonRecord, ["wordId", "introducedOn", "intervalIndex", "intervalDays", "nextReviewOn", "lastReviewedOn", "lastQuality", "reviewCount", "successfulReviewCount", "lapses", "productiveSuccessDates", "retainedAfter30Days", "mastered", "masteredOn"])]));
  if (record(state.masteryScores)) state.masteryScores = Object.fromEntries(Object.entries(state.masteryScores).filter(([, value]) => typeof value === "number" && Number.isFinite(value)));
  if (record(state.reviewDates)) state.reviewDates = Object.fromEntries(Object.entries(state.reviewDates).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, (value as unknown[]).filter((date) => validDay(date) || validISO(date))]));
  if (record(state.nextReviewAt)) state.nextReviewAt = Object.fromEntries(Object.entries(state.nextReviewAt).filter(([, date]) => validDay(date) || validISO(date)));
  if (Array.isArray(state.quizAttempts)) state.quizAttempts = state.quizAttempts.filter(record).map((item) => pick(item, ["id", "completedAt", "durationSeconds", "score", "total", "mistakeWordIds"]));
  state.learningV3 = { version: 3, updatedAt: ext.updatedAt, profileUpdatedAt: ext.profileUpdatedAt, rolePlans: Object.fromEntries(Object.entries(ext.rolePlans).map(([key, plan]) => [key, { id: plan.id, date: plan.date, roleId: plan.roleId, wordIds: plan.wordIds, completedIds: plan.completedIds, createdAt: plan.createdAt, cursor: 0, answers: {} }])), placementsByRole: Object.fromEntries(Object.entries(ext.placementsByRole).map(([key, placement]) => [key, { pathId: placement.pathId, startingModuleId: placement.startingModuleId, checkedAtISO: placement.checkedAtISO ?? placement.checkedAt, correctCount: placement.correctCount ?? placement.correctAnswers, questionCount: placement.questionCount }])), contextIntroducedOn: ext.contextIntroducedOn, reviewEvidence: ext.reviewEvidence.map((event) => ({ id: event.id, wordId: event.wordId, roleId: event.roleId, senseId: event.senseId, date: event.date, recordedAtISO: event.recordedAtISO, kind: event.kind, quality: event.quality, independent: event.independent })), contextMastery: ext.contextMastery, favouriteChanges: ext.favouriteChanges, startingCheckDrafts: {}, reviewDrafts: {}, practiceDrafts: {}, exposedOn: {}, expressionDraft: "" };
  return clone(state) as WebLearningState<T>;
}
export function foundationDateToISO(seconds: number): string { if (!Number.isFinite(seconds)) throw new Error("Invalid native date."); return new Date((seconds + FOUNDATION_EPOCH) * 1000).toISOString(); }
export function isoToFoundationDate(iso: string): number { if (!validISO(iso)) throw new Error("Invalid portable date."); return Date.parse(iso) / 1000 - FOUNDATION_EPOCH; }
function portableUUID(source: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source)) return source.toLowerCase();
  const parts = [2166136261, 2246822519, 3266489917, 668265263].map((seed) => { let hash = seed; for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16).padStart(8, "0"); });
  const hex = parts.join(""); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function foundationDateToLocalDay(seconds: number, timeZone = "Etc/UTC"): string {
  const date = new Date((seconds + FOUNDATION_EPOCH) * 1000);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid native date.");
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { calendar: "gregory", numberingSystem: "latn", timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch { return date.toISOString().slice(0, 10); }
}
const nativeLocalDay = (value: unknown, timeZone: string) => typeof value === "number" ? foundationDateToLocalDay(value, timeZone) : validISO(value) ? foundationDateToLocalDay(isoToFoundationDate(value), timeZone) : undefined;
const nativeDay = (value: unknown) => typeof value === "number" ? foundationDateToISO(value).slice(0, 10) : validISO(value) ? value.slice(0, 10) : undefined;
export function exportPortableBackup<T extends { version: number }>(value: WebLearningState<T>) {
  const state = prepareWebState(value) as unknown as MutableWebState;
  const ext = state.learningV3;
  const progressByWordId: JsonRecord = {};
  for (const [id, item] of Object.entries(record(state.masteryByWordId) ? state.masteryByWordId : {})) if (record(item) && validDay(item.introducedOn) && validDay(item.nextReviewOn)) progressByWordId[id] = { introducedOn: isoToFoundationDate(item.introducedOn + "T12:00:00Z"), intervalIndex: Number(item.intervalIndex) || 0, nextReviewOn: isoToFoundationDate(item.nextReviewOn + "T12:00:00Z"), ...(validDay(item.lastReviewedOn) ? { lastReviewedOn: isoToFoundationDate(item.lastReviewedOn + "T12:00:00Z") } : {}), reviewCount: Number(item.reviewCount) || 0, successfulReviewDates: (strings(item.productiveSuccessDates) ? item.productiveSuccessDates : []).filter(validDay).map((date) => isoToFoundationDate(date + "T12:00:00Z")), lapses: Number(item.lapses) || 0, mastered: item.mastered === true };
  const pathPlacements = Object.fromEntries(Object.entries(ext.placementsByRole).map(([roleId, item]) => [roleId, { pathId: item.pathId, startingModuleId: item.startingModuleId, checkedAt: isoToFoundationDate(item.checkedAtISO ?? item.checkedAt!), correctAnswers: item.correctCount ?? item.correctAnswers ?? 0, questionCount: item.questionCount }]));
  const sessions = (Array.isArray(state.dailySessions) ? state.dailySessions : []).filter(record).filter((item) => validDay(item.date) && strings(item.wordIds)).map((item) => ({ id: portableUUID(String(item.id)), date: isoToFoundationDate(String(item.date) + "T12:00:00Z"), wordIds: item.wordIds, completedAt: isoToFoundationDate(validISO(item.completedAt) ? item.completedAt : String(item.date) + "T12:00:00Z"), dayKey: item.date }));
  const settings = record(state.settings) ? state.settings : {};
  const [reminderHour, reminderMinute] = String(settings.lessonTime ?? "09:00").split(":").map(Number);
  const learner = { ...(ext.nativeCompanion ?? {}), schemaVersion: 2, profile: state.profile ?? null, introducedWordIds: state.introducedWordIds ?? [], currentWordIds: [], progressByWordId, sessions, favouriteWordIds: state.favouriteIds ?? [], completedWordIdsToday: [], settings: { notificationsEnabled: settings.notificationsEnabled === true, reminderHour, reminderMinute, speechRate: 0.46 }, reviewPromptMilestone: 0, dailyWordGoal: settings.dailyWordCount ?? 3, pathPlacements, contextEvidence: ext.reviewEvidence.map(({ recordedAtISO, capturedAtISO, ...event }) => ({ ...event, recordedAt: isoToFoundationDate(recordedAtISO), ...(capturedAtISO ? { capturedAt: isoToFoundationDate(capturedAtISO) } : {}) })), contextIntroducedOn: Object.fromEntries(Object.entries(ext.contextIntroducedOn).map(([key, day]) => [key, isoToFoundationDate(day + "T12:00:00Z")])), contextExposures: ext.exposedOn };
  if (ext.dailyVocabulary) Object.assign(learner, { dailyVocabulary: ext.dailyVocabulary });
  else delete (learner as JsonRecord).dailyVocabulary;
  if (ext.sharedLearning) Object.assign(learner, { sharedLearning: ext.sharedLearning });
  const backup = { version: 2, learner, webLearningBackup: { version: 3, state } };
  if (new TextEncoder().encode(JSON.stringify(backup)).byteLength > MAX_STATE_BYTES) throw new Error("This backup is too large for Lucid’s portable format.");
  return backup;
}
function restorePrivateBackupWork(merged: WebLearningExtension, local: WebLearningExtension, incoming: WebLearningExtension): WebLearningExtension {
  const restored = { ...merged, startingCheckDrafts: { ...incoming.startingCheckDrafts, ...local.startingCheckDrafts }, reviewDrafts: { ...incoming.reviewDrafts, ...local.reviewDrafts }, practiceDrafts: { ...incoming.practiceDrafts, ...local.practiceDrafts }, expressionDraft: local.expressionDraft || incoming.expressionDraft, rolePlans: { ...merged.rolePlans } };
  const daily = mergeDailyVocabulary(local.dailyVocabulary, incoming.dailyVocabulary);
  if (daily) restored.dailyVocabulary = daily; else delete restored.dailyVocabulary;
  for (const [key, saved] of Object.entries(incoming.rolePlans)) {
    const own = local.rolePlans[key], plan = restored.rolePlans[key];
    if (plan && JSON.stringify(plan.wordIds) === JSON.stringify(saved.wordIds) && (!own || Object.keys(own.answers).length === 0 && own.cursor === 0)) restored.rolePlans[key] = { ...plan, cursor: saved.cursor, answers: saved.answers };
  }
  return restored;
}
export function importPortableBackup<T extends { version: number }>(value: unknown, local: WebLearningState<T>, defaults?: T, restoreProfile = false): WebLearningState<T> {
  if (!inspectJSON(value) || !record(value) || value.version !== 2 || !record(value.learner) || new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_STATE_BYTES) throw new Error("That file is not a supported Lucid backup.");
  const native = value.learner;
  if (!strings(native.introducedWordIds) || !record(native.progressByWordId) || !Array.isArray(native.sessions) || !strings(native.favouriteWordIds)) throw new Error("That backup has an invalid learner record.");
  const converted = prepareWebState(defaults ?? { version: 3 }) as unknown as MutableWebState;
  const localSettings = (local as unknown as JsonRecord).settings;
  const timeZone = record(localSettings) && typeof localSettings.timeZone === "string" ? localSettings.timeZone : record(converted.settings) && typeof converted.settings.timeZone === "string" ? converted.settings.timeZone : "Etc/UTC";
  converted.profile = native.profile ?? null; converted.introducedWordIds = native.introducedWordIds; converted.favouriteIds = native.favouriteWordIds;
  const progress: JsonRecord = {};
  for (const [id, item] of Object.entries(native.progressByWordId)) {
    if (!record(item) || !Number.isInteger(item.intervalIndex) || Number(item.intervalIndex) < 0 || Number(item.intervalIndex) > 4 || Number(item.reviewCount) < 0 || Number(item.lapses) < 0) throw new Error("That backup has invalid progress.");
    const introducedOn = nativeLocalDay(item.introducedOn, timeZone), nextReviewOn = nativeLocalDay(item.nextReviewOn, timeZone), lastReviewedOn = nativeLocalDay(item.lastReviewedOn, timeZone);
    if (!introducedOn || !nextReviewOn) throw new Error("That backup has invalid dates.");
    progress[id] = { wordId: id, introducedOn, intervalIndex: item.intervalIndex, intervalDays: INTERVALS[Number(item.intervalIndex)], nextReviewOn, ...(lastReviewedOn ? { lastReviewedOn, lastQuality: item.mastered ? 2 : 0 } : {}), reviewCount: item.reviewCount, successfulReviewCount: Array.isArray(item.successfulReviewDates) ? item.successfulReviewDates.length : 0, lapses: item.lapses, productiveSuccessDates: (Array.isArray(item.successfulReviewDates) ? item.successfulReviewDates : []).map((value) => nativeLocalDay(value, timeZone)).filter(Boolean), retainedAfter30Days: item.mastered === true, mastered: item.mastered === true };
  }
  converted.masteryByWordId = progress;
  converted.dailySessions = native.sessions.map((item) => {
    if (!record(item) || typeof item.id !== "string" || !strings(item.wordIds)) throw new Error("That backup has invalid sessions.");
    const date = validDay(item.dayKey) ? item.dayKey : nativeLocalDay(item.date, timeZone); if (!date) throw new Error("That backup has invalid sessions.");
    const sidecarState = record(value.webLearningBackup) && record(value.webLearningBackup.state) ? value.webLearningBackup.state : {};
    const webRows = Array.isArray(sidecarState.dailySessions) ? sidecarState.dailySessions : [];
    const nativeId = item.id.toLowerCase();
    const original = webRows.find((row) => record(row) && typeof row.id === "string" && portableUUID(row.id) === nativeId);
    return { id: record(original) ? original.id : item.id, date, roleId: record(native.profile) ? native.profile.roleId : "", situationId: "", wordIds: item.wordIds, completedAt: typeof item.completedAt === "number" ? foundationDateToISO(item.completedAt) : item.completedAt };
  });
  if (record(native.settings)) converted.settings = { ...(record(converted.settings) ? converted.settings : {}), lessonTime: `${String(native.settings.reminderHour ?? 9).padStart(2, "0")}:${String(native.settings.reminderMinute ?? 0).padStart(2, "0")}`, notificationsEnabled: native.settings.notificationsEnabled === true, dailyWordCount: [1, 2, 3].includes(Number(native.dailyWordGoal)) ? native.dailyWordGoal : 3 };
  const placements: Record<string, Placement> = {};
  if (record(native.pathPlacements)) for (const [id, item] of Object.entries(native.pathPlacements)) {
    if (!record(item) || typeof item.checkedAt !== "number") throw new Error("Invalid starting point in backup.");
    placements[id] = { pathId: String(item.pathId), startingModuleId: String(item.startingModuleId), checkedAtISO: foundationDateToISO(item.checkedAt), correctCount: Number(item.correctAnswers), questionCount: Number(item.questionCount) };
  }
  converted.learningV3.placementsByRole = placements;
  converted.learningV3.nativeCompanion = clone(native);
  if (native.dailyVocabulary !== undefined) {
    if (!validateDailyVocabulary(native.dailyVocabulary)) throw new Error("That daily vocabulary record needs a supported Lucid version.");
    converted.learningV3.dailyVocabulary = clone(native.dailyVocabulary);
  }
  if (record(native.favouriteChanges)) converted.learningV3.favouriteChanges = Object.fromEntries(Object.entries(native.favouriteChanges).filter(([, change]) => record(change) && typeof change.selected === "boolean" && typeof change.updatedAt === "number").map(([key, change]) => [key, { selected: (change as JsonRecord).selected === true, updatedAt: foundationDateToISO((change as JsonRecord).updatedAt as number) }]));
  if (record(native.sharedLearning) && native.sharedLearning.version === 1) converted.learningV3.sharedLearning = clone(native.sharedLearning) as SharedLearning;
  if (record(native.contextExposures) && Object.values(native.contextExposures).every(validDay)) converted.learningV3.exposedOn = native.contextExposures as Record<string, string>;
  if (Array.isArray(native.contextEvidence)) {
    const events = native.contextEvidence.map((event) => record(event) ? { ...event, recordedAtISO: typeof event.recordedAt === "number" ? foundationDateToISO(event.recordedAt) : event.recordedAtISO, ...(typeof event.capturedAt === "number" ? { capturedAtISO: foundationDateToISO(event.capturedAt) } : {}) } : event).map((event) => { if (record(event)) { delete event.recordedAt; delete event.capturedAt; } return event; });
    if (!events.every(evidenceValid)) throw new Error("Invalid context evidence in backup.");
    converted.learningV3.reviewEvidence = events;
  }
  if (record(native.contextIntroducedOn)) {
    const dates = Object.fromEntries(Object.entries(native.contextIntroducedOn).map(([key, value]) => [key, validDay(value) ? value : nativeDay(value)]));
    if (!Object.values(dates).every(validDay)) throw new Error("Invalid context introduction dates in backup.");
    converted.learningV3.contextIntroducedOn = dates as Record<string, string>;
  }
  let incoming: WebLearningState<T> = prepareWebState(converted, defaults);
  if (record(value.webLearningBackup)) {
    if (value.webLearningBackup.version !== 3 || !validateWebState(value.webLearningBackup.state)) throw new Error("That web backup requires a supported Lucid version.");
    const savedWeb = prepareWebState(value.webLearningBackup.state, defaults);
    const nativeLocal = incoming.learningV3;
    incoming = mergeWebStates(incoming, savedWeb, defaults);
    incoming.learningV3 = restorePrivateBackupWork(incoming.learningV3, nativeLocal, savedWeb.learningV3);
  }
  const merged = mergeWebStates(local, incoming, defaults);
  merged.learningV3 = restorePrivateBackupWork(merged.learningV3, local.learningV3, incoming.learningV3);
  if (restoreProfile && (incoming as unknown as MutableWebState).profile) { (merged as unknown as MutableWebState).profile = (incoming as unknown as MutableWebState).profile; merged.learningV3.profileUpdatedAt = new Date().toISOString(); }
  else { (merged as unknown as MutableWebState).profile = (local as unknown as MutableWebState).profile; merged.learningV3.profileUpdatedAt = local.learningV3.profileUpdatedAt; }
  return prepareWebState(clone(merged), defaults);
}
