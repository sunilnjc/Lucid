import { expressionContent, getPracticeExpression } from "./expression-content";

/** Initial product allowance, not an anonymous security or billing boundary. */
export const DEFAULT_GUEST_LEARNING_CAP = 5;
export type GuestPrompt = "save" | "limit";
export type GuestChangeDecision = { allowed: boolean; reason: GuestPrompt | null; used: number };
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown): string[] => list(value).filter((item): item is string => typeof item === "string" && item.length > 0);
const id = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,249}$/.test(value);
const extension = (state: unknown) => row(row(state).learningV3);
const daily = (state: unknown) => row(extension(state).dailyVocabulary);
const wordFromContext = (key: string) => key.replace(/^\d{4}-\d\d-\d\d:/, "").split("::")[0];

export function normalizeGuestLearningCap(value: unknown): number {
  const number = typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && number >= 1 && number <= 20 ? number : DEFAULT_GUEST_LEARNING_CAP;
}

function expressionWorkspaces(state: unknown): Row[] {
  const text = extension(state).expressionDraft;
  if (typeof text !== "string" || !text || text.length > 2_000_000) return [];
  try {
    const parsed = row(JSON.parse(text));
    if (parsed.version === 2) return Object.values(row(parsed.workspaces)).map(row);
    return parsed.version === 1 && typeof parsed.roleId === "string" ? [parsed] : [];
  } catch { return []; }
}
function expressionItem(expressionId: unknown): string | null {
  if (!id(expressionId)) return null;
  const curated = getPracticeExpression(expressionId);
  const catalogue = /^catalogue:[^:]+:([^:]+)$/.exec(expressionId);
  const word = curated?.wordId ?? catalogue?.[1];
  return word ? `word:${word}` : `expression:${expressionId}`;
}
const scenarioExpressions = new Map(expressionContent.scenarios.map((scenario) => [scenario.id, scenario.expressionId]));
function scenarioItem(scenarioId: unknown, roleId: unknown): string | null {
  if (!id(scenarioId)) return null;
  const curated = scenarioExpressions.get(scenarioId);
  if (curated) return expressionItem(curated);
  const prefix = typeof roleId === "string" ? `catalogue-${roleId}-` : "";
  if (prefix && scenarioId.startsWith(prefix)) {
    const word = scenarioId.slice(prefix.length);
    if (id(word)) return `word:${word}`;
  }
  if (scenarioId.startsWith("catalogue:")) return expressionItem(scenarioId);
  return `expression:${scenarioId}`;
}
function addScenario(target: Set<string>, scenarioId: unknown, roleId: unknown) {
  const item = scenarioItem(scenarioId, roleId); if (item) target.add(item);
}
function addWords(target: Set<string>, value: unknown) { for (const word of strings(value)) if (id(word)) target.add(`word:${word}`); }
function addContextWords(target: Set<string>, value: unknown) { for (const key of Object.keys(row(value))) { const word = wordFromContext(key); if (id(word)) target.add(`word:${word}`); } }
function addRehearsals(target: Set<string>, value: unknown) {
  for (const item of list(value)) {
    const entry = row(item), expression = expressionItem(entry.expressionId);
    if (expression) target.add(expression); else addScenario(target, entry.scenarioId, entry.roleId);
  }
}
function addWorkspacePractice(target: Set<string>, workspace: Row) {
  const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  const active = hasText(workspace.response) || hasText(workspace.submittedResponse) || workspace.phase === "comparison" || workspace.phase === "saved"
    || workspace.screen === "practice" && (workspace.hintExposed === true || hasText(workspace.activeRehearsalId) || hasText(workspace.attemptId));
  if (active) addScenario(target, workspace.scenarioId, workspace.roleId);
  for (const [key, value] of Object.entries(row(workspace.responses))) {
    // The UI creates a response key on editing; a subsequently cleared answer remains touched.
    if (typeof value === "string") addScenario(target, key.replace(/:(?:fresh|initial)$/, ""), workspace.roleId);
  }
  for (const [key, value] of Object.entries(row(workspace.nuanceAnswers))) {
    if (["fitting", "awkward"].includes(String(row(value).choice))) {
      const item = expressionItem(key.replace(/::contrast:\d+$/, "")); if (item) target.add(item);
    }
  }
  addCompletedChallenges(target, workspace.challengeHistory, workspace.roleId);
  for (const scenarioId of strings(workspace.challengeCompletedIds)) addScenario(target, scenarioId, workspace.roleId);
  for (const value of list(workspace.pendingCheckpoints)) {
    const checkpoint = row(value); if (hasText(checkpoint.completedOn)) addScenario(target, checkpoint.scenarioId, workspace.roleId);
  }
}
function addCompletedChallenges(target: Set<string>, value: unknown, roleId?: unknown) {
  for (const item of list(value)) {
    const challenge = row(item);
    for (const scenarioId of strings(challenge.completedScenarioIds)) addScenario(target, scenarioId, challenge.roleId ?? roleId);
  }
}

/** Count work the guest actually touched; plans and reference exposure do not consume allowance. */
export function guestLearningItems(state: unknown): string[] {
  const root = row(state), ext = extension(state), local = daily(state), result = new Set<string>();
  addWords(result, root.introducedWordIds);
  addWords(result, root.completedWordIdsToday);
  addContextWords(result, ext.contextIntroducedOn);
  addContextWords(result, ext.practiceDrafts);
  addContextWords(result, ext.reviewDrafts);
  for (const evidence of list(ext.reviewEvidence)) addWords(result, [row(evidence).wordId]);
  for (const planValue of Object.values(row(ext.rolePlans))) {
    const plan = row(planValue); addWords(result, plan.completedIds);
    for (const [word, value] of Object.entries(row(plan.answers))) {
      const answer = row(value);
      if (typeof answer.choiceId === "string" && answer.choiceId.length > 0 || strings(answer.wrongChoiceIds).length > 0 || answer.revealed === true || answer.completed === true) addWords(result, [word]);
    }
  }
  for (const collectionValue of Object.values(row(local.collections))) {
    const collection = row(collectionValue); addWords(result, collection.revealedWordIds);
    // A cleared draft still marks a touched word; deleting text does not refund its slot.
    addWords(result, Object.keys(row(collection.drafts)));
  }
  for (const key of Object.keys(row(local.idiomPractice))) {
    const idiom = key.replace(/^\d{4}-\d\d-\d\d:/, "");
    if (id(idiom)) result.add(`idiom:${idiom}`);
  }
  const shared = row(ext.sharedLearning);
  for (const value of Object.values(row(shared.lessonCheckpoints))) {
    const checkpoint = row(value); addWords(result, checkpoint.completedWordIds);
    addWords(result, Object.keys(row(checkpoint.answers)));
  }
  addRehearsals(result, Object.values(row(shared.rehearsals)));
  addCompletedChallenges(result, Object.values(row(shared.challenges)));
  for (const workspace of expressionWorkspaces(state)) {
    addWords(result, workspace.practiceWordIds);
    addRehearsals(result, workspace.rehearsalHistory);
    addWorkspacePractice(result, workspace);
  }
  return [...result].sort();
}
function newStrings(before: unknown, after: unknown) {
  const old = new Set(strings(before)); return strings(after).filter((item) => !old.has(item));
}
function evidenceWordsAdded(before: unknown, after: unknown): Set<string> {
  const old = new Set(list(extension(before).reviewEvidence).map((item) => row(item).id));
  return new Set(list(extension(after).reviewEvidence).filter((item) => !old.has(row(item).id)).flatMap((item) => id(row(item).wordId) ? [row(item).wordId as string] : []));
}
function completedWordsAdded(before: unknown, after: unknown): Set<string> {
  const old = row(extension(before).rolePlans), result = new Set<string>();
  for (const [key, value] of Object.entries(row(extension(after).rolePlans))) for (const word of newStrings(row(old[key]).completedIds, row(value).completedIds)) result.add(word);
  return result;
}
function notebookEntries(state: unknown): Map<string, string> {
  const result = new Map<string, string>();
  const add = (value: unknown, fallback: string) => {
    const note = row(value), key = typeof note.id === "string" ? note.id : fallback;
    if (!key) return;
    // Rehearsal dates can advance in temporary practice. Saved wording and identity are gated.
    result.set(key, JSON.stringify([note.expressionId, note.phrase, note.style ?? note.variant]));
  };
  for (const [key, value] of Object.entries(row(row(extension(state).sharedLearning).notebook))) add(value, key);
  for (const workspace of expressionWorkspaces(state)) for (const [index, value] of list(workspace.notebook).entries()) add(value, `${String(workspace.roleId)}:${index}`);
  return result;
}
function addsSavedSelection(before: unknown, after: unknown): boolean {
  const a = row(before), b = row(after), old = extension(before), next = extension(after);
  if (newStrings(a.favouriteIds, b.favouriteIds).length || newStrings(a.favouriteWordIds, b.favouriteWordIds).length) return true;
  for (const [key, value] of Object.entries(row(next.favouriteChanges))) if (row(value).selected === true && row(row(old.favouriteChanges)[key]).selected !== true) return true;
  const evidence = evidenceWordsAdded(before, after), completed = completedWordsAdded(before, after);
  // A low-quality review automatically changes difficultIds; it is temporary practice, not a save button.
  if (newStrings(a.difficultIds, b.difficultIds).some((word) => !evidence.has(word) && !completed.has(word))) return true;
  const oldReviews = row(daily(before).idiomReviews);
  if (Object.keys(row(daily(after).idiomReviews)).some((key) => !(key in oldReviews))) return true;
  const revealed = new Set<string>();
  for (const value of Object.values(row(daily(after).collections))) for (const word of strings(row(value).revealedWordIds)) revealed.add(word);
  const oldIntroduced = row(old.contextIntroducedOn);
  // Daily "Add to spaced review" introduces a revealed word without performing a course/review attempt.
  if (Object.keys(row(next.contextIntroducedOn)).some((key) => !(key in oldIntroduced) && revealed.has(wordFromContext(key)) && !evidence.has(wordFromContext(key)) && !completed.has(wordFromContext(key)))) return true;
  const oldNotes = notebookEntries(before);
  for (const [key, value] of notebookEntries(after)) if (oldNotes.get(key) !== value) return true;
  return false;
}

/** Pure admission only. The caller owns identity verification, session storage and the cumulative ledger. */
export function guestChangeDecision(previous: unknown, next: unknown, cap: number): GuestChangeDecision {
  const before = guestLearningItems(previous), after = guestLearningItems(next), seen = new Set(before), combined = new Set([...before, ...after]);
  if (addsSavedSelection(previous, next)) return { allowed: false, reason: "save", used: before.length };
  const addsItem = after.some((item) => !seen.has(item));
  if (addsItem && combined.size > normalizeGuestLearningCap(cap)) return { allowed: false, reason: "limit", used: before.length };
  return { allowed: true, reason: null, used: combined.size };
}
