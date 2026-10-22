import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url);
const moduleUrls = new Map();
const runtimeDirectory = await mkdtemp(join(tmpdir(), "lucid-learning-features-"));
after(() => rm(runtimeDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
async function moduleUrl(relativePath) {
  if (!moduleUrls.has(relativePath)) moduleUrls.set(relativePath, (async () => {
    const sourceUrl = new URL(relativePath, root);
    const source = await readFile(sourceUrl, "utf8");
    let { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: relativePath,
    });
    const parsed = ts.createSourceFile(relativePath + ".mjs", outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
    const imports = parsed.statements.filter((statement) => (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)).map((statement) => statement.moduleSpecifier);
    const edits = [];
    for (const specifier of imports) {
      const name = specifier.text;
      let url;
      if (!name.startsWith(".")) url = import.meta.resolve(name);
      else {
        const dependency = new URL(name, sourceUrl);
        if (!/\.[cm]?[jt]sx?$/.test(dependency.pathname)) {
          try { await readFile(new URL(dependency.href + ".ts"), "utf8"); dependency.pathname += ".ts"; }
          catch (error) { if (error.code !== "ENOENT") throw error; dependency.pathname += ".tsx"; }
        }
        url = await moduleUrl(dependency.pathname.slice(root.pathname.length));
      }
      edits.push({ start: specifier.getStart(parsed), end: specifier.end, value: JSON.stringify(url) });
    }
    for (const edit of edits.sort((left, right) => right.start - left.start)) outputText = outputText.slice(0, edit.start) + edit.value + outputText.slice(edit.end);
    const path = join(runtimeDirectory, relativePath.replaceAll("/", "_") + ".mjs");
    await writeFile(path, outputText);
    return pathToFileURL(path).href;
  })());
  return moduleUrls.get(relativePath);
}
async function load(relativePath) { return import(await moduleUrl(relativePath)); }

const feature = await load("lib/expression-content.ts");
const catalogue = await load("lib/professional-content.ts");
const { default: ExpressionPractice } = await load("app/ExpressionPractice.tsx");
const persistence = await load("lib/web-learning-state.ts");
const web = await load("lib/web-learning-ui.ts");
const roleId = "finance-accounting";
const today = "2026-10-13";
function render(workspace = {}, extra = {}) {
  return renderToStaticMarkup(React.createElement(ExpressionPractice, {
    roleId, today, learnedWordIds: ["finance-rationale", "finance-substantiate", "finance-reconcile"],
    savedDraft: JSON.stringify({ version: 1, roleId, screen: "find", ...workspace }), onCommit: () => true, ...extra,
  }));
}
const activeDates = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"];

test("actual studio UI offers a fifth-active-day transfer challenge and shows an unfamiliar unhinted prompt", () => {
  const front = render({}, { activeDates, lastActiveDate: "2026-10-12" });
  assert.match(front, /Your fifth-day transfer challenge/);
  assert.match(front, /<button[^>]*>Start the challenge<\/button>/);
  assert.match(front, /completion is separate from word mastery/);
  assert.doesNotMatch(front, /A small restart/);
  const challenge = feature.getFifthDayChallenge({ date: today, activeDates, roleId, learnedWordIds: ["finance-rationale", "finance-substantiate", "finance-reconcile"], catalogueWords: catalogue.professionalWords });
  const first = challenge.scenarios[0], word = catalogue.professionalWords.find((word) => word.id === first.wordIds[0]);
  const html = render({ screen: "practice", scenarioId: first.id, fresh: true, phase: "draft", attemptId: "transfer-fixture", attemptDate: today, challengeCount: 5, challengeScenarioIds: challenge.scenarios.map((item) => item.id), challengeCompletedIds: [] });
  assert.ok(html.includes(first.freshPrompt));
  assert.ok(!html.includes(first.prompt), "the selected transfer must not render the original lesson situation");
  assert.match(html, /Respond without revealing a word or example/);
  const target = new RegExp(`\\b${word.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  assert.doesNotMatch(html, target);
});

test("actual comeback UI is available after absence, bounded, and suppressed after completing it today", () => {
  const front = render({}, { activeDates: ["2026-10-01"], lastActiveDate: "2026-10-01" });
  assert.match(front, /A small restart/);
  assert.match(front, /away for 12 days/);
  assert.match(front, /<button[^>]*>Try one familiar situation<\/button>/);
  const plan = feature.buildComebackPlan({ date: today, lastActiveDate: "2026-10-01", roleId, learnedWordIds: ["finance-rationale", "finance-substantiate", "finance-reconcile"], catalogueWords: catalogue.professionalWords });
  assert.ok(plan.scenarios.length >= 1 && plan.scenarios.length <= 3);
  assert.equal(plan.newWordCount, 0);
  const completed = render({ completedComebackOn: today }, { activeDates: ["2026-10-01"], lastActiveDate: "2026-10-01" });
  assert.doesNotMatch(completed, /A small restart/);
});

test("actual discovery UI shows exactly ten role entries without learning or mastery claims", () => {
  const html = render({ screen: "discover" });
  const entries = feature.getTenWordDiscovery({ roleId, catalogueWords: catalogue.professionalWords });
  assert.equal(entries.length, 10);
  const headings = [...html.matchAll(/<article[^>]*><h3>([^<]+)<\/h3>/g)].map(([, text]) => text);
  assert.deepEqual(headings, entries.map((entry) => entry.term));
  assert.match(html, /Browsing awards no learning or mastery credit/);
  assert.match(html, /Find a word or meaning/);
  assert.ok(entries.every((entry) => entry.learningCredit === false));
});

test("every professional role offers meeting, interview and disagreement rehearsal", () => {
  for (const role of catalogue.professionalRoles) {
    const kinds = new Set(feature.getScenariosForRole(role.id).map((scenario) => scenario.kind));
    const html = render({ roleId: role.id, screen: "practice" }, { roleId: role.id, learnedWordIds: [] });
    for (const expected of ["meeting", "interview", "disagreement"]) {
      assert.ok(kinds.has(expected), `${role.id} is missing ${expected} rehearsal`);
      assert.ok(html.includes(`<small>${expected}</small>`), `${role.id} does not expose ${expected} rehearsal in the actual UI`);
    }
  }
});


test("nuance choices provide targeted feedback and emit recognition once without recall or production", () => {
  const input = { expressionId: "explain-the-reason", roleId, contrastIndex: 0, date: today, attemptId: "00000000-0000-4000-8000-000000000310" };
  const wrong = feature.buildNuanceChoice({ ...input, choice: "awkward" });
  assert.equal(wrong.correct, false); assert.equal(wrong.evidence, undefined);
  assert.match(wrong.explanation, /not proof/);
  const correct = feature.buildNuanceChoice({ ...input, choice: "fitting", previous: wrong.answer });
  assert.equal(correct.correct, true);
  assert.equal(correct.evidence.kind, "recognition"); assert.equal(correct.evidence.independent, false);
  assert.equal(correct.evidence.assisted, true); assert.equal(correct.evidence.modelSeen, true);
  assert.equal(correct.answer.recognizedOn, today);
  const reloaded = JSON.parse(JSON.stringify(correct.answer));
  assert.equal(feature.buildNuanceChoice({ ...input, choice: "fitting", previous: reloaded }).evidence, undefined);
  const wrongAgain = feature.buildNuanceChoice({ ...input, choice: "awkward", previous: reloaded });
  assert.equal(feature.buildNuanceChoice({ ...input, choice: "fitting", previous: wrongAgain.answer }).evidence, undefined);
  assert.equal(feature.buildNuanceChoice({ ...input, roleId: "operations-supply-chain", choice: "fitting" }), null);
  assert.equal(feature.buildNuanceChoice({ ...input, contrastIndex: 100, choice: "fitting" }), null);
});

function learnerState() {
  return persistence.prepareWebState({ version: 3, profile: { roleId, seniorityId: "experienced-contributor", situationIds: ["finance:month-end-close"], goalIds: ["clarify"] },
    introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], masteryScores: {}, reviewDates: {}, nextReviewAt: {}, completedDays: [], quizAttempts: [],
    settings: { lessonTime: "09:00", timeZone: "Asia/Dubai", dailyWordCount: 2 } });
}

test("the integrated correct nuance transaction schedules tomorrow with zero mastery, reviews or XP", () => {
  const id = "00000000-0000-4000-8000-000000000311";
  const chosen = feature.buildNuanceChoice({ expressionId: "explain-the-reason", roleId, contrastIndex: 0, date: today, attemptId: id, choice: "fitting" });
  const evidence = persistence.makeReviewEvidence({ ...chosen.evidence, id }); assert.ok(evidence);
  const state = learnerState(), key = evidence.senseId;
  const input = { roleId, date: today, draft: JSON.stringify({ version: 1, roleId, nuanceAnswers: { [chosen.key]: chosen.answer } }), evidence, exposedContextIds: [key] };
  const saved = persistence.prepareWebState(web.applyExpressionCommit(state, input));
  assert.deepEqual(saved.introducedWordIds, [evidence.wordId]);
  assert.equal(saved.learningV3.contextIntroducedOn[key], today);
  assert.equal(saved.learningV3.contextMastery[key].nextReviewOn, "2026-10-14");
  assert.equal(saved.learningV3.contextMastery[key].reviewCount, 0);
  assert.equal(saved.learningV3.contextMastery[key].mastered, false);
  assert.deepEqual(saved.learningV3.contextMastery[key].productiveSuccessDates, []);
  assert.equal(web.effortPoints(saved), 0);
  assert.equal(saved.learningV3.reviewEvidence.length, 1);
  assert.equal(saved.learningV3.reviewEvidence[0].kind, "recognition");
  const repeated = persistence.prepareWebState(web.applyExpressionCommit(saved, input));
  assert.equal(repeated.learningV3.reviewEvidence.length, 1); assert.equal(web.effortPoints(repeated), 0);
  const old = learnerState(); old.learningV3.contextIntroducedOn[key] = "2026-10-01";
  assert.equal(persistence.prepareWebState(web.applyExpressionCommit(old, input)).learningV3.contextIntroducedOn[key], "2026-10-01");
  assert.equal(web.applyExpressionCommit(state, { ...input, roleId: "technology-engineering" }), state);
  assert.equal(web.applyExpressionCommit(state, { ...input, evidence: { ...evidence, roleId: "technology-engineering" } }), state);
  assert.equal(web.applyExpressionCommit(state, { ...input, evidence: { ...evidence, kind: "unaided-recall", independent: true } }), state);
});

test("actual web nuance UI has selectable examples, wrong/correct explanations and honest no-credit copy", () => {
  const expression = feature.getExpressionsForRole(roleId).find((entry) => entry.id === "explain-the-reason"), contrast = expression.contrasts[0];
  const key = feature.expressionNuanceKey(expression.id, 0);
  const fresh = render();
  assert.match(fresh, /Which example fits this meaning/);
  assert.ok(fresh.includes(contrast.fitting)); assert.ok(fresh.includes(contrast.awkward));
  assert.match(fresh, /no unaided recall, production, mastery or XP credit/);
  const wrong = render({ nuanceAnswers: { [key]: { choice: "awkward" } } });
  assert.match(wrong, /Compare the distinction again/); assert.ok(wrong.includes(contrast.explanation));
  const correct = render({ nuanceAnswers: { [key]: { choice: "fitting", recognizedOn: today, attemptId: "00000000-0000-4000-8000-000000000312" } } });
  assert.match(correct, /This fits the authored distinction/);
  assert.match(correct, /Repeating it adds no new credit/);
  assert.ok(correct.includes(contrast.explanation));
  assert.match(correct, /Reason is often warmer and clearer/);
});
