import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url), directory = await mkdtemp(join(tmpdir(), "lucid-integrated-ui-"));
const modules = new Map();
after(() => rm(directory, { recursive: true, force: true }));
async function moduleURL(relative) {
  if (!modules.has(relative)) modules.set(relative, (async () => {
    const sourceURL = new URL(relative, root);
    let { outputText } = ts.transpileModule(await readFile(sourceURL, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: relative });
    const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS), edits = [];
    for (const statement of parsed.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier, name = specifier.text;
      let url;
      if (!name.startsWith(".")) url = import.meta.resolve(name);
      else {
        const dependency = new URL(name, sourceURL);
        if (!/\.[cm]?[jt]sx?$/.test(dependency.pathname)) {
          try { await readFile(new URL(dependency.href + ".ts"), "utf8"); dependency.pathname += ".ts"; }
          catch (error) { if (error.code !== "ENOENT") throw error; dependency.pathname += ".tsx"; }
        }
        url = await moduleURL(dependency.pathname.slice(root.pathname.length));
      }
      edits.push({ start: specifier.getStart(parsed), end: specifier.end, value: JSON.stringify(url) });
    }
    for (const edit of edits.sort((a, b) => b.start - a.start)) outputText = outputText.slice(0, edit.start) + edit.value + outputText.slice(edit.end);
    const path = join(directory, relative.replaceAll("/", "_") + ".mjs"); await writeFile(path, outputText); return pathToFileURL(path).href;
  })());
  return modules.get(relative);
}
const load = async (relative) => import(await moduleURL(relative));
const ui = await load("lib/web-learning-ui.ts"), web = await load("lib/web-learning-state.ts"), shared = await load("lib/shared-learning-state.ts"), engine = await load("lib/learning-engine.ts");
const roleId = "finance-accounting", wordId = "finance-reconcile", sense = `${wordId}::${roleId}`, date = "2026-10-14";
const defaults = { version: 3, profile: { roleId, seniorityId: "experienced-contributor", situationIds: ["finance:month-end-close"], goalIds: ["clarify"] }, settings: { lessonTime: "09:00", timeZone: "Etc/UTC", dailyWordCount: 1 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [], usageAttempts: {} };
function fresh() { return web.prepareWebState(defaults); }
function due() { const state = fresh(); state.masteryByWordId[wordId] = engine.createWordMastery(wordId, "2026-10-01"); state.masteryByWordId[wordId].nextReviewOn = date; return state; }
const response = "We reconcile the accounts before completing the monthly report.";
const capture = (state) => ui.captureReviewResponse(state, { roleId, contextRole: roleId, date, currentDay: date, wordId, response, capturedAtISO: `${date}T00:00:10.000Z` });
const review = (state) => ui.applyContextReview(state, { roleId, contextRole: roleId, date, currentDay: date, wordId, response, quality: 3, meaningAttested: true, naturalnessAttested: true });

test("deep links normalize the review alias, preserve URL context and reject unknown view names", () => {
  for (const view of ["today", "courses", "practice", "express", "library", "progress", "settings"]) assert.equal(ui.viewFromURL(ui.urlForView("/lucid?source=installed#content", view)), view);
  assert.equal(ui.viewFromURL("/?view=review"), "practice"); assert.equal(ui.viewFromURL("/?view=javascript:alert(1)"), "today");
  assert.equal(ui.urlForView("https://example.test/?source=installed&view=today#content", "express"), "/?source=installed&view=express#content");
});

test("app update guard blocks incomplete identity/profile/forms and local write failure, while saved offline practice can refresh", () => {
  const saved = { ready: true, hasProfile: true, editingProfile: false, status: "offline", accountDraft: false, settingsDraft: false };
  assert.equal(ui.canRefreshApp(saved), true);
  for (const changes of [{ ready: false }, { hasProfile: false }, { editingProfile: true }, { status: "error" }, { accountDraft: true }, { settingsDraft: true }]) assert.equal(ui.canRefreshApp({ ...saved, ...changes }), false, JSON.stringify(changes));
});

test("actual app server rendering exposes one install action and the learner account before a profile exists", async () => {
  const { default: VocabularyApp } = await load("app/VocabularyApp.tsx");
  const html = renderToStaticMarkup(React.createElement(VocabularyApp, { initialDate: date, initialGreeting: "Good morning." }));
  assert.equal((html.match(/>Install app<\/button>/g) ?? []).length, 1);
  assert.match(html, /Your learner account/); assert.match(html, /Checking shared sign-in for this browser/); assert.doesNotMatch(html, /Shared sign-in is disabled for this build/);
  assert.match(html, /Add Lucid to your Home Screen or app launcher/); assert.match(html, /installed app may keep separate local storage/);
  assert.equal((html.match(/aria-label="Lucid app installation"/g) ?? []).length, 1);
});

test("guidance exposures retain actual instants, earliest same-day support and conservative legacy day flags", () => {
  let state = ui.recordContextExposure(fresh(), [sense], date, `${date}T10:10:00.000Z`);
  assert.deepEqual(state.learningV3.sharedLearning.exposures[sense], { dayKey: date, firstSeenAt: `${date}T10:10:00.000Z` });
  assert.equal(ui.recordContextExposure(state, [sense], date, `${date}T11:00:00.000Z`), state);
  state = ui.recordContextExposure(state, [sense], date, `${date}T10:05:00.000Z`);
  assert.equal(state.learningV3.sharedLearning.exposures[sense].firstSeenAt, `${date}T10:05:00.000Z`);
  const legacy = fresh(); legacy.learningV3.exposedOn[sense] = date;
  assert.equal(ui.recordContextExposure(legacy, [sense], date, `${date}T12:00:00.000Z`).learningV3.sharedLearning.exposures[sense].firstSeenAt, `${date}T00:00:00.000Z`);
  assert.equal(ui.recordContextExposure(state, ["unrelated::unknown"], date), state);
});

test("fresh original is captured strictly before its own reveal, survives shared round-trip and remains independent", (t) => {
  // Recording must happen on the fixture's learning day, after its frozen answer.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(`${date}T00:00:20.000Z`) });
  const frozen = capture(due()), draft = frozen.learningV3.reviewDrafts[`${date}:${sense}`];
  assert.equal(draft.originalCapturedAtISO, `${date}T00:00:10.000Z`);
  assert.equal(frozen.learningV3.sharedLearning.exposures[sense].firstSeenAt, `${date}T00:00:10.001Z`);
  assert.equal(ui.isFrozenReviewIndependent(frozen, wordId, roleId, date), true);
  const recorded = review(frozen), event = recorded.learningV3.reviewEvidence.at(-1);
  assert.equal(event.independent, true); assert.equal(event.capturedAtISO, draft.originalCapturedAtISO);
  assert.equal(event.recordedAtISO, `${date}T00:00:20.000Z`);
  const back = shared.sharedCloudStateToWeb(shared.webToSharedCloudState(recorded), recorded, defaults);
  assert.equal(back.learningV3.reviewEvidence.at(-1).independent, true); assert.equal(ui.effortPoints(back), 15);
  assert.equal(review(back), back, "a saved same-day retrieval cannot award twice");
});

test("earlier remote exposure downgrades the frozen answer and caps native and web review credit", () => {
  let frozen = capture(due()); frozen = ui.recordContextExposure(frozen, [sense], date, `${date}T00:00:05.000Z`);
  assert.equal(ui.isFrozenReviewIndependent(frozen, wordId, roleId, date), false);
  const recorded = review(frozen), event = recorded.learningV3.reviewEvidence.at(-1);
  assert.equal(event.independent, false); assert.equal(event.quality, 1);
  recorded.learningV3.nativeCompanion = { activities: [{ id: crypto.randomUUID(), kind: "review", wordId, dayKey: date, quality: 3, productive: true, date: web.isoToFoundationDate(`${date}T10:00:00Z`) }] };
  assert.equal(ui.effortPoints(recorded), 5);
});

test("a legacy frozen draft cannot acquire missing capture proof after shared exposure arrives", () => {
  const state = due(); state.learningV3.reviewDrafts[`${date}:${sense}`] = { sentence: response, originalResponse: response, originalIndependent: true, originalCapturedOn: date, hinted: false, revealed: true };
  assert.equal(ui.isFrozenReviewIndependent(state, wordId, roleId, date), true, "old local-only frozen behavior stays compatible until shared exposure is known");
  const connected = ui.recordContextExposure(state, [sense], date, `${date}T11:00:00Z`);
  assert.equal(ui.isFrozenReviewIndependent(connected, wordId, roleId, date), false);
  assert.equal(capture(connected), connected, "revealed legacy work cannot be upgraded by recapture");
});

test("new guided completion has a UUID and recognition evidence; reconnect preserves older IDs without duplicate awards", () => {
  const state = fresh(), key = `${date}:${roleId}`, word = ui.contextualWord(wordId, roleId), correctId = ui.createTapChallenge(word, roleId).correctId;
  state.learningV3.rolePlans[key] = { id: key, date, roleId, wordIds: [wordId], completedIds: [], cursor: 0, answers: { [wordId]: { choiceId: correctId, wrongChoiceIds: [], helped: false, completed: false } }, createdAt: `${date}T10:00:00Z` };
  state.dailySessions.push({ id: `2026-10-13:${roleId}`, date: "2026-10-13", roleId, situationId: "finance:month-end-close", wordIds: [wordId], completedAt: "2026-10-13T10:00:00Z" });
  const input = { key, roleId, date, currentDay: date, wordId }, complete = ui.completeGuidedWord(state, input);
  assert.match(complete.dailySessions.at(-1).id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/i); assert.equal(complete.dailySessions[0].id, state.dailySessions[0].id);
  assert.equal(complete.learningV3.reviewEvidence.at(-1).kind, "recognition"); assert.equal(complete.learningV3.reviewEvidence.at(-1).independent, false);
  assert.equal(ui.completeGuidedWord(complete, input), complete);
  complete.learningV3.nativeCompanion = { activities: [{ id: crypto.randomUUID(), kind: "practice", wordId, dayKey: date, quality: 2, productive: false, date: web.isoToFoundationDate(`${date}T10:00:00Z`) }, { id: crypto.randomUUID(), kind: "lesson", dayKey: date, quality: 2, productive: true, date: web.isoToFoundationDate(`${date}T10:00:00Z`) }] };
  assert.equal(ui.effortPoints(complete), 50, "two daily bonuses plus one word award, despite overlapping activity ledgers");
});

test("studio reveal uses the supplied model instant and never grants practice/review effort credit", () => {
  const state = fresh();
  const next = ui.applyExpressionCommit(state, { roleId, date, draft: "{\"version\":2}", exposedContextIds: [sense], exposedAtISO: `${date}T00:00:10.001Z` });
  assert.equal(next.learningV3.sharedLearning.exposures[sense].firstSeenAt, `${date}T00:00:10.001Z`); assert.equal(ui.effortPoints(next), 0);
});


test("account network failure cannot claim shared sign-in is disabled without a successful status response", async () => {
  const { readAccountStatus } = await load("app/WebAccountPanel.tsx");
  const offline = await readAccountStatus(async () => { throw new TypeError("Failed to fetch"); });
  assert.equal(offline.connection, "unavailable"); assert.equal("account" in offline, false);
  assert.match(offline.message, /Reconnect to check sign-in/); assert.doesNotMatch(offline.message, /Failed to fetch|disabled for this build/);
  const disabled = { enabled: false, emailReady: false, identity: null, email: null };
  const confirmed = await readAccountStatus(async () => disabled);
  assert.equal(confirmed.connection, "ready"); assert.deepEqual(confirmed.account, disabled); assert.equal(confirmed.message, "");
});
