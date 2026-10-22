import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
const dataURL = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const expressionURL = dataURL(stripTypeScriptTypes(await readFile(new URL("../lib/expression-content.ts", import.meta.url), "utf8")));
const { expressionContent } = await import(expressionURL);
const source = stripTypeScriptTypes(await readFile(new URL("../lib/guest-learning.ts", import.meta.url), "utf8")).replace('from "./expression-content"', `from ${JSON.stringify(expressionURL)}`);
const { DEFAULT_GUEST_LEARNING_CAP, normalizeGuestLearningCap, guestLearningItems, guestChangeDecision } = await import(dataURL(source));
const empty = () => ({ version: 3, introducedWordIds: [], favouriteIds: [], difficultIds: [], learningV3: { version: 3, rolePlans: {}, contextIntroducedOn: {}, reviewEvidence: [], favouriteChanges: {}, reviewDrafts: {}, practiceDrafts: {}, exposedOn: {}, expressionDraft: "", dailyVocabulary: { version: 1, collections: {}, idiomsByDay: {}, idiomPractice: {}, idiomReviews: {} } } });
const clone = value => JSON.parse(JSON.stringify(value));
const word = (state, id) => { const next = clone(state); next.learningV3.practiceDrafts[id] = "A fictional example"; return next; };
const daily = state => state.learningV3.dailyVocabulary;

test("guest cap defaults to five and accepts only bounded integer configuration", () => {
  assert.equal(DEFAULT_GUEST_LEARNING_CAP, 5);
  for (const value of [undefined, null, false, true, 0, -2, 1.5, 21, "TRUE", "3.2", "100", NaN, Infinity]) assert.equal(normalizeGuestLearningCap(value), 5);
  for (const value of [1, 5, 20, "1", "7", "20"]) assert.equal(normalizeGuestLearningCap(value), Number(value));
});

test("first five distinct practiced words are admitted, repeats are free, and sixth is refused without mutation", () => {
  let state = empty();
  for (let index = 1; index <= 5; index++) {
    const next = word(state, `word-${index}`), original = JSON.stringify(next);
    assert.deepEqual(guestChangeDecision(state, next, 5), { allowed: true, reason: null, used: index });
    assert.equal(JSON.stringify(next), original); state = next;
  }
  const repeated = word(state, "word-1"); repeated.learningV3.practiceDrafts["word-1"] = "A changed fictional sentence";
  assert.deepEqual(guestChangeDecision(state, repeated, 5), { allowed: true, reason: null, used: 5 });
  const original = JSON.stringify(state);
  assert.deepEqual(guestChangeDecision(state, word(state, "word-6"), 5), { allowed: false, reason: "limit", used: 5 });
  assert.equal(JSON.stringify(state), original);
  const cleared = clone(state); cleared.learningV3.practiceDrafts["word-1"] = "";
  assert.equal(guestLearningItems(cleared).length, 5);
});

test("catalogue exposure, course allocation, profile and settings do not spend learning slots", () => {
  const state = empty(), next = clone(state);
  next.profile = { roleId: "finance-accounting" }; next.settings = { dailyWordCount: 3 };
  next.learningV3.exposedOn = Object.fromEntries(Array.from({ length: 470 }, (_, i) => [`word-${i}::finance-accounting`, "2026-10-22"]));
  next.learningV3.rolePlans.today = { wordIds: ["a", "b", "c"], completedIds: [], answers: {} };
  daily(next).collections.today = { wordIds: ["a", "b", "c", "d", "e", "f", "g", "h"], revealedWordIds: [], drafts: {}, extraUnlocked: true };
  daily(next).idiomsByDay["2026-10-22"] = "a-planned-idiom";
  assert.deepEqual(guestLearningItems(next), []);
  assert.deepEqual(guestChangeDecision(state, next, 5), { allowed: true, reason: null, used: 0 });
});

test("word attempts, private drafts, evidence and contextual repetition share canonical word slots", () => {
  const state = empty();
  state.learningV3.rolePlans.today = { wordIds: ["finance-reconcile", "finance-substantiate"], completedIds: ["finance-reconcile"], answers: { "finance-reconcile": { choiceId: "right", completed: true }, "finance-substantiate": { choiceId: "wrong" } } };
  state.introducedWordIds = ["finance-reconcile"];
  state.learningV3.contextIntroducedOn["finance-reconcile::finance-accounting"] = "2026-10-22";
  state.learningV3.reviewDrafts["2026-10-22:finance-reconcile::finance-accounting"] = { sentence: "" };
  state.learningV3.reviewEvidence = [{ id: "evidence", wordId: "finance-reconcile" }];
  state.learningV3.practiceDrafts["finance-reconcile"] = "";
  assert.deepEqual(guestLearningItems(state), ["word:finance-reconcile", "word:finance-substantiate"]);
});

test("daily words and idiom drafts or reveals consume slots; repeated dates do not double count", () => {
  const state = empty();
  daily(state).collections.day1 = { wordIds: ["finance-reconcile"], revealedWordIds: ["finance-reconcile"], drafts: { "finance-reconcile": "" } };
  daily(state).collections.day2 = { wordIds: ["finance-reconcile"], revealedWordIds: ["finance-reconcile"], drafts: {} };
  daily(state).idiomPractice["2026-10-22:read-the-room"] = { draft: "", revealed: true };
  daily(state).idiomPractice["2026-10-23:read-the-room"] = { draft: "A fictional answer", revealed: false };
  assert.deepEqual(guestLearningItems(state), ["idiom:read-the-room", "word:finance-reconcile"]);
  assert.equal(guestChangeDecision(empty(), state, 1).reason, "limit");
});

test("bookmark and explicit word or idiom review saves require an account before any budget denial", () => {
  const state = empty();
  for (const mutate of [
    next => { next.favouriteIds = ["finance-reconcile"]; },
    next => { next.favouriteWordIds = ["finance-reconcile"]; },
    next => { next.learningV3.favouriteChanges["finance-reconcile"] = { selected: true }; },
    next => { daily(next).idiomReviews["read-the-room"] = { nextReviewOn: "2026-10-23" }; },
    next => { next.difficultIds = ["finance-reconcile"]; }
  ]) {
    const next = clone(state); mutate(next); next.learningV3.practiceDrafts.extra = "";
    assert.equal(guestChangeDecision(state, next, 1).reason, "save");
  }
  const revealed = empty(); daily(revealed).collections.today = { revealedWordIds: ["finance-reconcile"], drafts: {} };
  const saved = clone(revealed); saved.introducedWordIds = ["finance-reconcile"]; saved.learningV3.contextIntroducedOn["finance-reconcile::finance-accounting"] = "2026-10-22";
  assert.equal(guestChangeDecision(revealed, saved, 5).reason, "save");
  const removed = clone(saved); removed.favouriteIds = []; removed.learningV3.favouriteChanges["finance-reconcile"] = { selected: false };
  assert.equal(guestChangeDecision(saved, removed, 5).allowed, true);
});

test("automatic course/review scheduling stays temporary and does not trigger the explicit save gate", () => {
  const state = empty(); daily(state).collections.today = { revealedWordIds: ["finance-reconcile"], drafts: {} };
  const next = clone(state);
  next.introducedWordIds = ["finance-reconcile"]; next.difficultIds = ["finance-reconcile"];
  next.learningV3.contextIntroducedOn["finance-reconcile::finance-accounting"] = "2026-10-22";
  next.learningV3.reviewEvidence = [{ id: "new-review", wordId: "finance-reconcile" }];
  next.nextReviewAt = { "finance-reconcile": "2026-10-23" };
  assert.deepEqual(guestChangeDecision(state, next, 5), { allowed: true, reason: null, used: 1 });
});

test("Express rehearsal maps to the same word while saved notebook additions and changes require sign-in", () => {
  const state = empty(), next = clone(state);
  next.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { "finance-accounting": { roleId: "finance-accounting", rehearsalHistory: [{ expressionId: "bridge-the-difference" }, { expressionId: "catalogue:finance-accounting:finance-reconcile" }], practiceWordIds: ["finance-reconcile"], notebook: [] } } });
  assert.deepEqual(guestLearningItems(next), ["word:finance-reconcile"]);
  assert.equal(guestChangeDecision(state, next, 5).allowed, true);
  const saved = clone(next), workspace = JSON.parse(saved.learningV3.expressionDraft);
  workspace.workspaces["finance-accounting"].notebook.push({ id: "note-1", expressionId: "bridge-the-difference", phrase: "A curated alternative", variant: "plain" });
  saved.learningV3.expressionDraft = JSON.stringify(workspace);
  assert.equal(guestChangeDecision(next, saved, 5).reason, "save");
  const updated = clone(saved), changed = JSON.parse(updated.learningV3.expressionDraft);
  changed.workspaces["finance-accounting"].notebook[0].phrase = "A different saved alternative";
  updated.learningV3.expressionDraft = JSON.stringify(changed);
  assert.equal(guestChangeDecision(saved, updated, 5).reason, "save");
  const datesOnly = clone(saved), dates = JSON.parse(datesOnly.learningV3.expressionDraft);
  dates.workspaces["finance-accounting"].notebook[0].lastPractisedAt = "2026-10-22T01:00:00Z";
  datesOnly.learningV3.expressionDraft = JSON.stringify(dates);
  assert.equal(guestChangeDecision(saved, datesOnly, 5).allowed, true);
});

test("shared notebook and rehearsal projections enforce the same learning and save distinction", () => {
  const state = empty(), next = clone(state);
  next.learningV3.sharedLearning = { rehearsals: { a: { expressionId: "bridge-the-difference" } }, lessonCheckpoints: { today: { wordIds: ["unpracticed"], completedWordIds: ["finance-reconcile"], answers: { "finance-substantiate": { choiceId: "a" } } } } };
  assert.deepEqual(guestLearningItems(next), ["word:finance-reconcile", "word:finance-substantiate"]);
  next.learningV3.sharedLearning.notebook = { a: { id: "a", expressionId: "bridge-the-difference", phrase: "A saved phrase", style: "plain" } };
  assert.equal(guestChangeDecision(state, next, 5).reason, "save");
});

test("already admitted work remains editable above a lowered cap and malformed optional shapes fail safely", () => {
  let state = empty(); for (let i = 0; i < 5; i++) state = word(state, `word-${i}`);
  const next = word(state, "word-0"); next.settings = { textSize: "large" };
  assert.equal(guestChangeDecision(state, next, 2).allowed, true);
  assert.equal(guestChangeDecision(state, word(state, "another"), 2).reason, "limit");
  for (const value of [null, undefined, [], { learningV3: { expressionDraft: "bad JSON", dailyVocabulary: [] } }]) assert.deepEqual(guestLearningItems(value), []);
});


const withStudioWorkspace = (state, workspace) => {
  const next = clone(state); next.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { "finance-accounting": { version: 1, roleId: "finance-accounting", notebook: [], rehearsalHistory: [], ...workspace } } }); return next;
};

test("Express starts, drafts, submitted answers and hints count before a rehearsal completes", () => {
  for (const workspace of [
    { screen: "practice", scenarioId: "bridge-the-difference-disagreement", response: "A fictional response" },
    { screen: "practice", scenarioId: "bridge-the-difference-disagreement", submittedResponse: "A fictional answer", phase: "comparison" },
    { screen: "practice", scenarioId: "bridge-the-difference-disagreement", hintExposed: true },
    { screen: "practice", scenarioId: "bridge-the-difference-disagreement", attemptId: "active-attempt", response: "" },
    { screen: "find", scenarioId: "bridge-the-difference-disagreement", response: "An earlier retained response" },
    { screen: "practice", scenarioId: "catalogue-finance-accounting-finance-reconcile", response: "A catalogue response" },
    { responses: { "bridge-the-difference-disagreement:initial": "", "catalogue-finance-accounting-finance-reconcile:fresh": "A later response" } }
  ]) assert.deepEqual(guestLearningItems(withStudioWorkspace(empty(), workspace)), ["word:finance-reconcile"]);
});

test("Express response history across six unfinished scenarios cannot bypass the guest cap", () => {
  const seen = new Set();
  const scenarios = expressionContent.scenarios.filter(scenario => {
    if (seen.has(scenario.wordIds[0])) return false;
    seen.add(scenario.wordIds[0]); return true;
  }).slice(0, 6);
  assert.equal(scenarios.length, 6);
  const responses = Object.fromEntries(scenarios.map(scenario => [`${scenario.id}:initial`, "A draft response"]));
  const firstFive = { ...responses }; delete firstFive[Object.keys(firstFive).at(-1)];
  const before = withStudioWorkspace(empty(), { responses: firstFive });
  const after = withStudioWorkspace(before, { responses });
  assert.equal(guestLearningItems(before).length, 5);
  assert.deepEqual(guestChangeDecision(before, after, 5), { allowed: false, reason: "limit", used: 5 });
  assert.equal(guestLearningItems(after).length, 6);
});

test("Express wrong nuance choices and completed challenges count, while reference exposure and assigned scenarios remain free", () => {
  const reference = withStudioWorkspace(empty(), { screen: "discover", matchesVisible: true, scenarioId: "bridge-the-difference-disagreement", hintExposed: true, hintedOn: { "finance-reconcile::finance-accounting": "2026-10-22", "finance-rationale::finance-accounting": "2026-10-22" }, challengeScenarioIds: ["bridge-the-difference-disagreement", "explain-the-reason-interview"], challengeHistory: [{ scenarioIds: ["bridge-the-difference-disagreement"], completedScenarioIds: [] }], pendingCheckpoints: [{ scenarioId: "bridge-the-difference-disagreement", dueOn: "2026-10-23" }] });
  assert.deepEqual(guestLearningItems(reference), []);
  const answered = withStudioWorkspace(reference, { nuanceAnswers: { "bridge-the-difference::contrast:0": { choice: "awkward" } } });
  assert.deepEqual(guestLearningItems(answered), ["word:finance-reconcile"]);
  const completed = withStudioWorkspace(empty(), { challengeHistory: [{ scenarioIds: ["bridge-the-difference-disagreement", "explain-the-reason-interview"], completedScenarioIds: ["bridge-the-difference-disagreement"] }], pendingCheckpoints: [{ scenarioId: "catalogue-finance-accounting-finance-substantiate", completedOn: "2026-10-22" }] });
  assert.deepEqual(guestLearningItems(completed), ["word:finance-reconcile", "word:finance-substantiate"]);
});
