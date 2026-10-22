import { professionalRoles, professionalWords } from "./professional-content";
import { dailyIdioms } from "./daily-idioms";
/** Optional device-local sidecar. It is never part of ordinary account sync. */
export type DailyWordCollection = { day: string; roleId: string; wordIds: string[]; extraUnlocked: boolean; revealedWordIds: string[]; drafts: Record<string, string> };
export type DailyIdiomPractice = { draft: string; originalResponse?: string; revealed: boolean; reviewed?: boolean };
export type DailyIdiomReview = { introducedOn: string; intervalIndex: number; nextReviewOn: string; lastReviewedOn?: string; reviewCount: number };
export type DailyVocabularyLocal = { version: 1; collections: Record<string, DailyWordCollection>; idiomsByDay: Record<string, string>; idiomPractice: Record<string, DailyIdiomPractice>; idiomReviews: Record<string, DailyIdiomReview> };
export const emptyDailyVocabulary = (): DailyVocabularyLocal => ({ version: 1, collections: {}, idiomsByDay: {}, idiomPractice: {}, idiomReviews: {} });
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,159}$/.test(v);
export const dailyDayValid = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + "T00:00:00Z")) && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
const text = (v: unknown): v is string => typeof v === "string" && v.length <= 2_000;
export function validateDailyVocabulary(v: unknown): v is DailyVocabularyLocal {
  if (!object(v) || v.version !== 1 || !object(v.collections) || !object(v.idiomsByDay) || !object(v.idiomPractice) || !object(v.idiomReviews)) return false;
  const idiomIds = new Set(dailyIdioms.map(i => i.id));
  for (const [key, c] of Object.entries(v.collections)) {
    if (!object(c) || !dailyDayValid(c.day) || !id(c.roleId) || key !== `${c.day}:${c.roleId}` || !Array.isArray(c.wordIds) || c.wordIds.length > 8 || !c.wordIds.every(id) || new Set(c.wordIds).size !== c.wordIds.length || typeof c.extraUnlocked !== "boolean" || !Array.isArray(c.revealedWordIds) || new Set(c.revealedWordIds).size !== c.revealedWordIds.length || !c.revealedWordIds.every(w => c.wordIds instanceof Array && c.wordIds.slice(0,c.extraUnlocked ? 8 : 5).includes(w)) || !object(c.drafts) || !Object.entries(c.drafts).every(([w, t]) => c.wordIds instanceof Array && c.wordIds.slice(0,c.extraUnlocked ? 8 : 5).includes(w) && text(t))) return false;
    if (!professionalRoles.some(r => r.id === c.roleId)) return false;
    const entries = c.wordIds.map(w => professionalWords.find(entry => entry.id === w && entry.roles.some(role => role === c.roleId) && entry.learningMode === "active"));
    if (entries.some(w => !w) || new Set(entries.map(w => w!.term.trim().toLowerCase())).size !== entries.length) return false;
  }
  for (const [day, idiom] of Object.entries(v.idiomsByDay)) if (!dailyDayValid(day) || !id(idiom) || !idiomIds.has(idiom)) return false;
  for (const [key, p] of Object.entries(v.idiomPractice)) {
    const colon = key.indexOf(":");
    if (!dailyDayValid(key.slice(0, colon)) || !id(key.slice(colon + 1)) || !idiomIds.has(key.slice(colon + 1)) || !object(p) || !text(p.draft) || typeof p.revealed !== "boolean" || p.originalResponse !== undefined && !text(p.originalResponse) || p.reviewed !== undefined && typeof p.reviewed !== "boolean" || p.revealed && p.originalResponse === undefined) return false;
  }
  for (const [key, r] of Object.entries(v.idiomReviews)) if (!id(key) || !idiomIds.has(key) || !object(r) || !dailyDayValid(r.introducedOn) || !dailyDayValid(r.nextReviewOn) || r.nextReviewOn < r.introducedOn || !Number.isInteger(r.intervalIndex) || Number(r.intervalIndex) < 0 || Number(r.intervalIndex) > 4 || !Number.isInteger(r.reviewCount) || Number(r.reviewCount) < 0 || r.lastReviewedOn !== undefined && (!dailyDayValid(r.lastReviewedOn) || r.lastReviewedOn < r.introducedOn)) return false;
  return true;
}
/** Explicit backup imports can merge private work. Ordinary cloud merges do not call this. */
export function mergeDailyVocabulary(local?: DailyVocabularyLocal, incoming?: DailyVocabularyLocal): DailyVocabularyLocal | undefined {
  if (!local) return incoming ? JSON.parse(JSON.stringify(incoming)) as DailyVocabularyLocal : undefined;
  if (!incoming) return local;
  const merged: DailyVocabularyLocal = { version: 1, collections: { ...incoming.collections, ...local.collections }, idiomsByDay: { ...incoming.idiomsByDay, ...local.idiomsByDay }, idiomPractice: { ...incoming.idiomPractice, ...local.idiomPractice }, idiomReviews: { ...incoming.idiomReviews, ...local.idiomReviews } };
  for (const [key, own] of Object.entries(local.collections)) {
    const other = incoming.collections[key];
    if (other && JSON.stringify(other.wordIds) === JSON.stringify(own.wordIds)) merged.collections[key] = { ...own, extraUnlocked: own.extraUnlocked || other.extraUnlocked, revealedWordIds: [...new Set([...own.revealedWordIds, ...other.revealedWordIds])], drafts: { ...other.drafts, ...Object.fromEntries(Object.entries(own.drafts).filter(([, draft]) => !!draft)) } };
  }
  for (const [key, own] of Object.entries(local.idiomPractice)) {
    const other = incoming.idiomPractice[key];
    if (other) merged.idiomPractice[key] = { ...own, draft: own.draft || other.draft, originalResponse: own.revealed && !own.originalResponse?.trim() || other.revealed && !other.originalResponse?.trim() ? "" : own.originalResponse ?? other.originalResponse, revealed: own.revealed || other.revealed, reviewed: own.reviewed === true || other.reviewed === true ? true : own.reviewed ?? other.reviewed };
  }
  for (const [key, own] of Object.entries(local.idiomReviews)) {
    const other = incoming.idiomReviews[key];
    if (other) merged.idiomReviews[key] = {introducedOn:[own.introducedOn,other.introducedOn].sort()[0],intervalIndex:Math.min(own.intervalIndex,other.intervalIndex),nextReviewOn:[own.nextReviewOn,other.nextReviewOn].sort()[0],lastReviewedOn:[own.lastReviewedOn,other.lastReviewedOn].filter((d): d is string => !!d).sort().at(-1),reviewCount:Math.max(own.reviewCount,other.reviewCount)};
  }
  return JSON.parse(JSON.stringify(merged)) as DailyVocabularyLocal;
}
