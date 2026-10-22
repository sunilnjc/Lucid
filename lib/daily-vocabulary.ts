import { professionalWords, type RoleId, type ProfessionalWord } from "./professional-content";
import { dailyIdioms, dailyIdiomForDay, type DailyIdiom } from "./daily-idioms";
import { createWordMastery, SRS_INTERVAL_DAYS } from "./learning-engine";
import { contextEvidenceKey } from "./web-learning-state";
import { contextualWord, makePlan, recordContextExposure, stamp, tapStableHash, type State } from "./web-learning-ui";
import { dailyDayValid, emptyDailyVocabulary, type DailyIdiomPractice, type DailyVocabularyLocal } from "./daily-vocabulary-state";
export type { DailyWordCollection, DailyVocabularyLocal } from "./daily-vocabulary-state";
const keyFor = (day: string, role: string) => `${day}:${role}`;
const ordinal = (day: string) => { if (!dailyDayValid(day)) throw new Error("Invalid learning day."); return Math.floor(Date.parse(day + "T00:00:00Z") / 86400000); };
const addDays = (day: string, n: number) => new Date((ordinal(day) + n) * 86400000).toISOString().slice(0, 10);
const permitted = (state: State, day: string, role: RoleId) => dailyDayValid(day) && state.profile?.roleId === role;
const local = (state: State) => state.learningV3.dailyVocabulary ?? emptyDailyVocabulary();
function update(state: State, next: DailyVocabularyLocal): State { return { ...state, learningV3: { ...state.learningV3, dailyVocabulary: next, updatedAt: stamp() } }; }
/** Same ASCII catalogue ordering, UTF-8 FNV hash and day arithmetic as native. */
export function selectDailyWordIds(day: string, roleId: RoleId, excluded: readonly string[] = []): string[] {
  const eligible = professionalWords.filter(w => w.roles.includes(roleId) && w.learningMode === "active" && !excluded.includes(w.id)).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const seen = new Set<string>();
  const unique = (items: ProfessionalWord[]) => items.filter(w => { const term = w.term.trim().toLowerCase(); if (seen.has(term)) return false; seen.add(term); return true; });
  const advanced = unique(eligible.filter(w => (w.roleContexts?.[roleId]?.difficulty ?? w.difficulty) === "c1"));
  const pool = advanced.length >= 8 ? advanced : [...advanced, ...unique(eligible.filter(w => !advanced.includes(w)))];
  if (!pool.length) return [];
  const count = pool.length, hash = Number(tapStableHash(roleId) % BigInt(count));
  const offset = ((ordinal(day) * 8 + hash) % count + count) % count;
  return Array.from({ length: Math.min(8, count) }, (_, i) => pool[(offset + i) % count].id);
}
export function dailyCollection(state: State, day: string, roleId: RoleId) { return state.learningV3.dailyVocabulary?.collections[keyFor(day, roleId)]; }
export function dailyWords(state: State, day: string, roleId: RoleId): ProfessionalWord[] {
  const c = dailyCollection(state, day, roleId);
  return (c?.wordIds.slice(0, c.extraUnlocked ? 8 : 5) ?? []).flatMap(id => { const w = contextualWord(id, roleId); return w?.roles.includes(roleId) ? [w] : []; });
}
export function ensureDailyVocabulary(state: State, day: string, roleId: RoleId): State {
  if (!permitted(state,day,roleId)) return state;
  const old = local(state), key = keyFor(day,roleId);
  if (old.collections[key] && old.idiomsByDay[day]) return state;
  const core = state.learningV3.rolePlans[key] ?? makePlan(state,roleId,day);
  return update(state, { ...old, collections: old.collections[key] ? old.collections : { ...old.collections, [key]: { day, roleId, wordIds: selectDailyWordIds(day,roleId,core.wordIds), extraUnlocked: false, revealedWordIds: [], drafts: {} } }, idiomsByDay: { ...old.idiomsByDay, [day]: old.idiomsByDay[day] ?? dailyIdiomForDay(day).id } });
}
export function unlockDailyExtra(state: State, day: string, roleId: RoleId): State {
  const c = dailyCollection(state,day,roleId); if (!permitted(state,day,roleId) || !c || c.extraUnlocked) return state;
  const old = local(state); return update(state,{ ...old, collections:{ ...old.collections,[keyFor(day,roleId)]:{ ...c,extraUnlocked:true } } });
}
function visible(state: State, day: string, role: RoleId, id: string) { return permitted(state,day,role) && dailyWords(state,day,role).some(w => w.id === id); }
export function saveDailyWordDraft(state: State, day: string, roleId: RoleId, wordId: string, text: string): State {
  if (!visible(state,day,roleId,wordId) || dailyCollection(state,day,roleId)?.revealedWordIds.includes(wordId) || text.length > 2_000) return state;
  const old=local(state), c=old.collections[keyFor(day,roleId)];
  return update(state,{...old,collections:{...old.collections,[keyFor(day,roleId)]:{...c,drafts:{...c.drafts,[wordId]:text}}}});
}
export function revealDailyWord(state: State, day: string, roleId: RoleId, wordId: string): State {
  if (!visible(state,day,roleId,wordId)) return state;
  const old=local(state), c=old.collections[keyFor(day,roleId)];
  const next = c.revealedWordIds.includes(wordId) ? state : update(state,{...old,collections:{...old.collections,[keyFor(day,roleId)]:{...c,revealedWordIds:[...c.revealedWordIds,wordId]}}});
  return recordContextExposure(next,[contextEvidenceKey(wordId,roleId)],day);
}
export function dailyWordIsInReview(state: State, roleId: RoleId, wordId: string): boolean {
  const sense = contextEvidenceKey(wordId,roleId);
  return !!state.learningV3.contextIntroducedOn[sense] || state.learningV3.reviewEvidence.some(event => event.senseId === sense);
}
export function addDailyWordToReview(state: State, day: string, roleId: RoleId, wordId: string): State {
  if (!visible(state,day,roleId,wordId) || !dailyCollection(state,day,roleId)?.revealedWordIds.includes(wordId) || dailyWordIsInReview(state,roleId,wordId)) return state;
  return { ...state,introducedWordIds:[...new Set([...state.introducedWordIds,wordId])],masteryByWordId:{...state.masteryByWordId,[wordId]:state.masteryByWordId[wordId] ?? createWordMastery(wordId,day)}, learningV3:{...state.learningV3,contextIntroducedOn:{...state.learningV3.contextIntroducedOn,[contextEvidenceKey(wordId,roleId)]:day},updatedAt:stamp()} };
}
export function dailyIdiom(state: State, day: string): DailyIdiom { return dailyIdioms.find(i => i.id === state.learningV3.dailyVocabulary?.idiomsByDay[day]) ?? dailyIdiomForDay(day); }
export function idiomPractice(state: State, day: string, idiomId: string): DailyIdiomPractice | undefined { return state.learningV3.dailyVocabulary?.idiomPractice[keyFor(day,idiomId)]; }
export function dueIdiomReviews(state: State, day: string): DailyIdiom[] { return dailyIdioms.filter(i => { const r = state.learningV3.dailyVocabulary?.idiomReviews[i.id]; return r && day > r.introducedOn && r.nextReviewOn <= day && r.lastReviewedOn !== day; }); }
function allowedIdiom(state: State, day: string, role: RoleId, id: string) { return permitted(state,day,role) && (dailyIdiom(state,day).id === id || dueIdiomReviews(state,day).some(i => i.id === id)); }
export function saveDailyIdiomDraft(state: State, day: string, roleId: RoleId, idiomId: string, text: string): State {
  if (!allowedIdiom(state,day,roleId,idiomId) || idiomPractice(state,day,idiomId)?.revealed || text.length > 2_000) return state;
  const old=local(state), key=keyFor(day,idiomId), p=old.idiomPractice[key] ?? {draft:"",revealed:false};
  return update(state,{...old,idiomPractice:{...old.idiomPractice,[key]:{...p,draft:text}}});
}
export function revealDailyIdiom(state: State, day: string, roleId: RoleId, idiomId: string): State {
  if (!allowedIdiom(state,day,roleId,idiomId)) return state;
  const old=local(state), key=keyFor(day,idiomId), p=old.idiomPractice[key] ?? {draft:"",revealed:false};
  if (p.revealed) return state;
  return update(state,{...old,idiomPractice:{...old.idiomPractice,[key]:{...p,originalResponse:p.originalResponse ?? p.draft,revealed:true}}});
}
/** Ungraded self-report scheduling; never enters word evidence, mastery, or XP. */
export function reviewDailyIdiom(state: State, day: string, roleId: RoleId, idiomId: string, remembered: boolean): State {
  if (!permitted(state,day,roleId) || !dueIdiomReviews(state,day).some(i => i.id === idiomId)) return state;
  const old=local(state), key=keyFor(day,idiomId), p=old.idiomPractice[key], r=old.idiomReviews[idiomId];
  if (!p?.revealed || p.reviewed) return state;
  const success = remembered && !!p.originalResponse?.trim();
  const index = success ? Math.min(4,r.intervalIndex+1) : 0;
  return update(state,{...old,idiomPractice:{...old.idiomPractice,[key]:{...p,reviewed:true}},idiomReviews:{...old.idiomReviews,[idiomId]:{...r,intervalIndex:index,nextReviewOn:addDays(day,SRS_INTERVAL_DAYS[index]),lastReviewedOn:day,reviewCount:r.reviewCount+1}}});
}

export function idiomReviewSchedule(state: State, idiomId: string) { return state.learningV3.dailyVocabulary?.idiomReviews[idiomId]; }

export function addDailyIdiomToReview(state: State, day: string, roleId: RoleId, idiomId: string): State {
  if (!allowedIdiom(state,day,roleId,idiomId) || !idiomPractice(state,day,idiomId)?.revealed || idiomReviewSchedule(state,idiomId)) return state;
  const old=local(state); return update(state,{...old,idiomReviews:{...old.idiomReviews,[idiomId]:{introducedOn:day,intervalIndex:0,nextReviewOn:addDays(day,1),reviewCount:0}}});
}

/** Reference browsing uses canonical idioms without changing daily selection or due eligibility. */
export function revealCatalogIdiom(state: State, day: string, roleId: RoleId, idiomId: string): State {
  if (!permitted(state, day, roleId) || !dailyIdioms.some(idiom => idiom.id === idiomId)) return state;
  const old = local(state), key = keyFor(day, idiomId), practice = old.idiomPractice[key] ?? { draft: "", revealed: false };
  if (practice.revealed) return state;
  return update(state, { ...old, idiomPractice: { ...old.idiomPractice, [key]: { ...practice, originalResponse: practice.originalResponse ?? practice.draft, revealed: true } } });
}
/** Explicit reference opt-in starts tomorrow and preserves any existing idiom schedule. */
export function addCatalogIdiomToReview(state: State, day: string, roleId: RoleId, idiomId: string): State {
  if (!permitted(state, day, roleId) || !dailyIdioms.some(idiom => idiom.id === idiomId) || !idiomPractice(state, day, idiomId)?.revealed || idiomReviewSchedule(state, idiomId)) return state;
  const old = local(state);
  return update(state, { ...old, idiomReviews: { ...old.idiomReviews, [idiomId]: { introducedOn: day, intervalIndex: 0, nextReviewOn: addDays(day, 1), reviewCount: 0 } } });
}
