import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

async function load(path) {
  const source = stripTypeScriptTypes(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const feature = await load("lib/expression-content.ts");
const catalogue = await load("lib/professional-content.ts");
const roles = catalogue.professionalRoles;
const words = catalogue.professionalWords;
const dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];

test("authored expression content preserves catalogue IDs, role scope and distinct alternate scenarios", () => {
  const { expressions, scenarios } = feature.expressionContent;
  assert.ok(expressions.length >= 12);
  assert.equal(new Set(expressions.map((entry) => entry.id)).size, expressions.length);
  for (const entry of expressions) {
    const word = words.find((word) => word.id === entry.wordId);
    assert.ok(word, entry.wordId);
    assert.equal(word.term, entry.term);
    assert.ok(entry.roleIds.every((id) => word.roles.includes(id)), `${entry.id} role scope`);
    assert.ok(entry.plain && entry.precise && entry.diplomatic && entry.register && entry.misuse);
    assert.notEqual(entry.plain, entry.precise);
    assert.ok(entry.contrasts.every((contrast) => contrast.fitting !== contrast.awkward && contrast.explanation));
    const scenario = scenarios.find((scenario) => scenario.expressionId === entry.id);
    assert.ok(scenario);
    assert.notEqual(scenario.prompt, scenario.freshPrompt);
    assert.notEqual(scenario.exampleResponse, scenario.freshExampleResponse);
  }
  for (const role of roles) assert.ok(feature.getScenariosForRole(role.id).length >= 1, role.id);
});

test("local intent lookup explains goal fallback and does not substring-match keywords", () => {
  const input = { roleId: "technology-engineering", goalId: "challenge-diplomatically", text: "What evidence supports this estimate?" };
  const matches = feature.findExpressionMatches(input);
  assert.equal(matches[0].expression.id, "evidence-to-decision");
  assert.ok(matches[0].matchedKeywords.includes("evidence"));
  assert.equal(matches[0].reason, "keywords");
  const fallback = feature.findExpressionMatches({ ...input, text: "unmapped personal wording" });
  assert.ok(fallback.every((match) => match.reason === "selected-goal" && match.matchedKeywords.length === 0));
  const substring = feature.findExpressionMatches({ ...input, text: "database" }).find((match) => match.expression.id === "evidence-to-decision");
  assert.ok(!substring.matchedKeywords.includes("data"));
});

test("phrase checks report lexical evidence without pretending to assess meaning", () => {
  assert.equal(feature.checkExpressionResponse("clear-ownership", "Accountability is something we discuss.").termFound, false);
  const check = feature.checkExpressionResponse("clear-ownership", "Mina is accountable with the final outcome.");
  assert.equal(check.termFound, true);
  assert.equal(check.collocationFound, false);
  assert.match(check.message, /meaning and naturalness yourself/);
  assert.match(check.message, /accountable for/);
  assert.match(check.message, /Other wording can also be valid/);
  assert.equal(feature.checkExpressionResponse("clear-ownership", "accountable").enoughContext, false);
});

test("self-assessed production needs learner attestations and a contextual term; hints never earn independent credit", () => {
  const input = { expressionId: "clear-ownership", roleId: "project-product", response: "Mina is accountable for the final outcome.", modelSeen: false, meaningConfirmed: true, naturalnessConfirmed: true, quality: 2, independent: true };
  assert.equal(feature.buildExpressionEvidence({ ...input, meaningConfirmed: false }), null);
  assert.equal(feature.buildExpressionEvidence({ ...input, naturalnessConfirmed: false }), null);
  assert.equal(feature.buildExpressionEvidence({ ...input, response: "Mina owns the outcome and will update us." }), null);
  assert.equal(feature.buildExpressionEvidence({ ...input, roleId: "healthcare" }), null);
  const evidence = feature.buildExpressionEvidence(input);
  assert.equal(evidence.kind, "self-assessed-production");
  assert.equal(evidence.senseId, "project-product-accountable::project-product");
  assert.equal(evidence.independent, true);
  assert.equal(feature.buildExpressionEvidence({ ...input, modelSeen: true }).independent, false);
});

test("fifth-day challenge covers learned role words outside the curated expression subset and remains pending", () => {
  for (const role of roles) {
    const path = catalogue.professionalLearningPaths.find((path) => path.roleId === role.id);
    const learnedWordIds = path.modules[0].lessons[0].wordIds;
    const input = { date: dates[4], activeDates: [...dates, dates[0], "invalid"], roleId: role.id, learnedWordIds, catalogueWords: words };
    const challenge = feature.getFifthDayChallenge(input);
    assert.equal(challenge.activeDayCount, 5);
    assert.equal(challenge.due, true, role.id);
    assert.ok(challenge.scenarios.length >= 1 && challenge.scenarios.length <= 3);
    assert.ok(challenge.scenarios.every((scenario) => scenario.wordIds.every((id) => learnedWordIds.includes(id))));
    const later = feature.getFifthDayChallenge({ ...input, date: "2026-10-06", activeDates: [...dates, "2026-10-06"] });
    assert.equal(later.due, true);
    assert.equal(feature.getFifthDayChallenge({ ...input, completedChallengeCounts: [5] }).due, false);
    assert.equal(challenge.newWordCount, 0);
  }
});

test("comeback practice is bounded, role scoped and does not manufacture new-word credit", () => {
  const learnedWordIds = words.filter((word) => word.roles.includes("finance-accounting")).slice(0, 8).map((word) => word.id);
  const plan = feature.buildComebackPlan({ date: "2026-10-13", lastActiveDate: "2026-10-01", roleId: "finance-accounting", learnedWordIds, catalogueWords: words });
  assert.equal(plan.awayDays, 12);
  assert.equal(plan.suggested, true);
  assert.ok(plan.scenarios.length > 0 && plan.scenarios.length <= 3);
  assert.equal(plan.newWordCount, 0);
  assert.equal(feature.buildComebackPlan({ date: "2026-10-13", lastActiveDate: "2026-10-15", roleId: "finance-accounting", learnedWordIds, catalogueWords: words }).suggested, false);
});

test("ten-word discovery stays role scoped and produces no learning credit", () => {
  for (const role of roles) {
    const entries = feature.getTenWordDiscovery({ roleId: role.id, catalogueWords: words });
    assert.equal(entries.length, 10, role.id);
    assert.ok(entries.every((entry) => words.find((word) => word.id === entry.wordId).roles.includes(role.id)));
    assert.ok(entries.every((entry) => entry.learningCredit === false));
  }
});

test("calendar checkpoint validation handles leap dates and rejects invalid dates", () => {
  assert.equal(feature.expressionNextDay("2028-02-28"), "2028-02-29");
  assert.equal(feature.expressionNextDay("2028-02-29"), "2028-03-01");
  assert.throws(() => feature.expressionNextDay("2026-02-29"));
});

test("an unfinished fifth-day checkpoint survives ten active days and later ones follow it", () => {
  const activeDates = Array.from({ length: 12 }, (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`);
  const input = { date: "2026-10-12", activeDates, roleId: "technology-engineering", learnedWordIds: words.filter((word) => word.roles.includes("technology-engineering")).slice(0, 8).map((word) => word.id), catalogueWords: words };
  assert.equal(feature.getFifthDayChallenge(input).challengeCount, 5);
  assert.equal(feature.getFifthDayChallenge({ ...input, completedChallengeCounts: [5] }).challengeCount, 10);
  assert.equal(feature.getFifthDayChallenge({ ...input, completedChallengeCounts: [5, 10] }).due, false);
});

test("catalogue fallback gives every role a different situation with the target withheld", () => {
  for (const role of roles) {
    const scenarios = feature.getLearnedExpressionScenarios(role.id, words.map((word) => word.id), words);
    const fallbacks = scenarios.filter((scenario) => scenario.id.startsWith("catalogue-"));
    assert.ok(fallbacks.length >= 50, role.id);
    for (const scenario of fallbacks) {
      const expression = feature.getPracticeExpression(scenario.expressionId, words);
      assert.notEqual(scenario.prompt, scenario.freshPrompt);
      const termPattern = new RegExp(`\\b${expression.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      assert.equal(termPattern.test(scenario.freshPrompt), false, `${role.id} / ${expression.term}`);
      assert.equal(scenario.freshExampleResponse, scenario.exampleResponse, "comparison remains the authored reference; it is not an AI-generated grade");
      assert.equal(expression.senseId, `${expression.wordId}::${role.id}`);
    }
  }
});

test("mobile expression bundle has unique role-safe entries and preserves authored role contexts", () => {
  const bundle = feature.getExpressionPracticeContent(words);
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(new Set(bundle.expressions.map((entry) => entry.id)).size, bundle.expressions.length);
  assert.equal(new Set(bundle.scenarios.map((entry) => entry.id)).size, bundle.scenarios.length);
  assert.ok(bundle.expressions.length > 600);
  for (const role of roles) {
    const word = words.find((word) => word.roleContexts?.[role.id] && word.learningMode === "active" && !feature.getExpressionsForRole(role.id).some((entry) => entry.wordId === word.id));
    assert.ok(word);
    const expression = bundle.expressions.find((entry) => entry.id === `catalogue:${role.id}:${word.id}`);
    assert.equal(expression.precise, word.roleContexts[role.id].example);
    assert.equal(expression.register, word.roleContexts[role.id].whenToUse);
    assert.deepEqual(expression.collocations, word.roleContexts[role.id].collocations);
  }
});

test("discovery and model exposure invalidate same-day independence only for that role context", () => {
  const exposed = { "finance-rationale::finance-accounting": "2026-10-13" };
  assert.equal(feature.expressionIndependentAllowed("finance-rationale", "finance-accounting", "2026-10-13", exposed), false);
  assert.equal(feature.expressionIndependentAllowed("finance-rationale", "project-product", "2026-10-13", exposed), true);
  assert.equal(feature.expressionIndependentAllowed("finance-rationale", "finance-accounting", "2026-10-14", exposed), true);
  const ids = feature.getTenWordDiscovery({ roleId: "finance-accounting", catalogueWords: words }).map((entry) => `${entry.wordId}::finance-accounting`);
  const discoveryExposure = Object.fromEntries(ids.map((id) => [id, "2026-10-13"]));
  assert.ok(ids.every((id) => !feature.expressionIndependentAllowed(id.split("::")[0], "finance-accounting", "2026-10-13", discoveryExposure)));
});

test("atomic save failure leaves both phase and evidence unchanged and retry saves once", () => {
  const gate = feature.createExpressionCommitGate();
  let current = { phase: "comparison", attemptId: "test-attempt" };
  let accept = false;
  let acceptedEvidence = 0;
  const evidence = feature.buildExpressionEvidence({ expressionId: "clear-ownership", roleId: "project-product", response: "Mina is accountable for the final outcome.", modelSeen: false, meaningConfirmed: true, naturalnessConfirmed: true, quality: 2, independent: true, date: "2026-10-13", attemptId: "test-attempt" });
  const transaction = { gate, next: { ...current, phase: "saved" }, evidence, exposedContextIds: [evidence.senseId], transactionId: "finish:test-attempt", onCommit: (serialized, result, exposed) => {
    assert.equal(JSON.parse(serialized).phase, "saved"); assert.deepEqual(exposed, [evidence.senseId]);
    if (!accept) return false;
    acceptedEvidence += Number(Boolean(result)); return true;
  }, onApply: (next) => { current = next; } };
  assert.equal(feature.commitExpressionTransaction(transaction), false);
  assert.equal(current.phase, "comparison"); assert.equal(acceptedEvidence, 0);
  accept = true;
  assert.equal(feature.commitExpressionTransaction(transaction), true);
  assert.equal(current.phase, "saved"); assert.equal(acceptedEvidence, 1);
  assert.equal(feature.commitExpressionTransaction(transaction), false);
  assert.equal(acceptedEvidence, 1);
});

test("reentrant or throwing commits cannot advance twice and release the save gate", () => {
  const gate = feature.createExpressionCommitGate();
  let applications = 0;
  const input = { gate, next: { phase: "saved" }, transactionId: "one", onCommit: () => { assert.equal(feature.commitExpressionTransaction(input), false); return true; }, onApply: () => { applications += 1; } };
  assert.equal(feature.commitExpressionTransaction(input), true);
  assert.equal(applications, 1);
  assert.throws(() => feature.commitExpressionTransaction({ ...input, transactionId: "two", onCommit: () => { throw new Error("disk full"); } }), /disk full/);
  assert.equal(gate.busy, false);
  assert.equal(applications, 1);
  assert.equal(feature.commitExpressionTransaction({ ...input, transactionId: "two", onCommit: () => true }), true);
  assert.equal(applications, 2);
});

async function loadExpressionComponent() {
  const ts = (await import("typescript")).default;
  const componentSource = await readFile(new URL("../app/ExpressionPractice.tsx", import.meta.url), "utf8");
  const sources = await Promise.all(["lib/professional-content.ts", "lib/expression-content.ts"].map(async (path) => {
    const source = stripTypeScriptTypes(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
    return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  }));
  let compiled = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  compiled = compiled.replaceAll('"react"', JSON.stringify(import.meta.resolve("react")))
    .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
    .replaceAll('"../lib/professional-content"', JSON.stringify(sources[0]))
    .replaceAll('"../lib/expression-content"', JSON.stringify(sources[1]));
  return await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const component = await loadExpressionComponent();
const ExpressionPractice = component.default;
const { createElement } = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
function renderWorkspace(workspace, extra = {}) {
  return renderToStaticMarkup(createElement(ExpressionPractice, { roleId: "finance-accounting", learnedWordIds: ["finance-rationale"], today: "2026-10-13", savedDraft: JSON.stringify(workspace), onCommit: () => true, ...extra }));
}

test("rendered unhinted rehearsal hides the target and exposes same-day support honestly", () => {
  const workspace = { version: 1, roleId: "finance-accounting", screen: "practice", scenarioId: "explain-the-reason-interview", attemptId: "render-attempt", attemptDate: "2026-10-13", phase: "draft" };
  const unhinted = renderWorkspace(workspace);
  assert.match(unhinted, /Respond without revealing a word or example/);
  assert.doesNotMatch(unhinted, /\brationale\b/i);
  assert.match(unhinted, /Commit response and compare/);
  const supported = renderWorkspace(workspace, { exposedOn: { "finance-rationale::finance-accounting": "2026-10-13" } });
  assert.match(supported, /seen support for this phrase today/);
  assert.doesNotMatch(supported, /\brationale\b/i);
});

test("role-scoped draft envelope restores the right intent and notebook without showing another role", () => {
  const envelope = { version: 2, workspaces: {
    "finance-accounting": { version: 1, roleId: "finance-accounting", screen: "find", intent: "My finance expression gap", notebook: [{ id: "saved-phrase", expressionId: "explain-the-reason", variant: "plain", phrase: feature.expressionContent.expressions.find((entry) => entry.id === "explain-the-reason").plain, intent: "A finance choice", createdOn: "2026-10-12" }] },
    "technology-engineering": { version: 1, roleId: "technology-engineering", screen: "find", intent: "My engineering expression gap" },
  } };
  const finance = renderWorkspace(envelope);
  assert.match(finance, /My finance expression gap/);
  assert.match(finance, /Your useful phrasing/);
  assert.match(finance, /A finance choice/);
  assert.doesNotMatch(finance, /My engineering expression gap/);
  const engineering = renderWorkspace(envelope, { roleId: "technology-engineering" });
  assert.match(engineering, /My engineering expression gap/);
  assert.doesNotMatch(engineering, /My finance expression gap/);
  assert.doesNotMatch(engineering, /A finance choice/);
});

test("comparison allows a clear paraphrase to be kept without claiming a target-word score", () => {
  const html = renderWorkspace({ version: 1, roleId: "finance-accounting", screen: "practice", scenarioId: "explain-the-reason-interview", phase: "comparison", submittedResponse: "We wanted to find problems before committing more resources.", attemptId: "paraphrase", attemptDate: "2026-10-13", attemptIndependent: true });
  assert.match(html, /A clear paraphrase can work well/);
  assert.match(html, /Save rehearsal without a word score/);
  assert.match(html, /does not give a semantic, factual or fluency grade/);
  assert.match(html, /Save self-assessed word practice/);
});


test("studio-only participation unlocks a fifth-day challenge without creating word mastery", () => {
  const html = renderWorkspace({ version: 2, workspaces: { "finance-accounting": { version: 1, roleId: "finance-accounting", screen: "find", practiceDates: ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-12"], practiceWordIds: ["finance-rationale"] } } }, { learnedWordIds: [], activeDates: [] });
  assert.match(html, /Your fifth-day transfer challenge/);
  assert.match(html, /completion is separate from word mastery/);
});

test("every professional role has authored meeting, interview and disagreement practice", () => {
  for (const role of roles) {
    const scenarios = feature.getScenariosForRole(role.id);
    assert.deepEqual([...new Set(scenarios.map((scenario) => scenario.kind))].sort(), ["disagreement", "interview", "meeting"], role.id);
    for (const scenario of scenarios) {
      const expression = feature.getPracticeExpression(scenario.expressionId, words);
      const normalized = (text) => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
      assert.equal(normalized(scenario.prompt).includes(normalized(expression.term)), false, `${scenario.id} initial target`);
      assert.equal(normalized(scenario.freshPrompt).includes(normalized(expression.term)), false, `${scenario.id} alternate target`);
      assert.notEqual(scenario.prompt, scenario.freshPrompt);
    }
  }
});

test("authored nuance choices produce recognition once with no independent or productive evidence", () => {
  const input = { expressionId: "clear-ownership", roleId: "project-product", contrastIndex: 0, choice: "awkward", date: "2026-10-13", attemptId: "5d1519fe-698b-4890-9a85-b4c3d2e6c501" };
  const wrong = feature.buildNuanceChoice(input);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.evidence, undefined);
  assert.match(wrong.explanation, /accountable for/);
  const correct = feature.buildNuanceChoice({ ...input, choice: "fitting", previous: wrong.answer });
  assert.equal(correct.correct, true);
  assert.equal(correct.answer.recognizedOn, "2026-10-13");
  assert.equal(correct.evidence.kind, "recognition");
  assert.equal(correct.evidence.senseId, "project-product-accountable::project-product");
  assert.equal(correct.evidence.independent, false);
  assert.equal(correct.evidence.modelSeen, true);
  assert.equal(correct.evidence.assisted, true);
  assert.equal(correct.evidence.response, "");
  const restored = JSON.parse(JSON.stringify(correct.answer));
  const repeated = feature.buildNuanceChoice({ ...input, choice: "fitting", date: "2026-10-14", previous: restored });
  assert.equal(repeated.evidence, undefined);
  assert.equal(repeated.answer.attemptId, correct.answer.attemptId);
  assert.equal(feature.buildNuanceChoice({ ...input, roleId: "healthcare", choice: "fitting" }), null);
  assert.equal(feature.buildNuanceChoice({ ...input, contrastIndex: 99 }), null);
});

test("failed nuance saving preserves the previous answer and repeated correct saves do not duplicate credit", () => {
  const input = { expressionId: "clear-ownership", roleId: "project-product", contrastIndex: 0, choice: "fitting", date: "2026-10-13", attemptId: "bcf2d727-06ce-4434-a119-402d078fa2c5" };
  const choice = feature.buildNuanceChoice(input);
  const gate = feature.createExpressionCommitGate();
  let current = { nuanceAnswers: {} };
  let accepted = false;
  let credit = 0;
  const commit = { gate, next: { nuanceAnswers: { [choice.key]: choice.answer } }, evidence: choice.evidence, exposedContextIds: [choice.evidence.senseId], transactionId: `nuance:${input.attemptId}`, onCommit: (_draft, evidence) => { if (!accepted) return false; credit += Number(Boolean(evidence)); return true; }, onApply: (next) => { current = next; } };
  assert.equal(feature.commitExpressionTransaction(commit), false);
  assert.deepEqual(current.nuanceAnswers, {});
  assert.equal(credit, 0);
  accepted = true;
  assert.equal(feature.commitExpressionTransaction(commit), true);
  assert.equal(feature.commitExpressionTransaction(commit), false);
  assert.equal(credit, 1);
  assert.equal(feature.buildNuanceChoice({ ...input, previous: current.nuanceAnswers[choice.key] }).evidence, undefined);
});

test("rendered nuance asks for a choice and restores targeted recognition feedback", () => {
  const initial = renderWorkspace({ version: 1, roleId: "finance-accounting", screen: "find" });
  assert.match(initial, /Which example fits this meaning\?/);
  assert.match(initial, /Plain and direct:/);
  assert.match(initial, /Sense and misuse:/);
  assert.match(initial, /no unaided recall, production, mastery or XP credit/);
  assert.doesNotMatch(initial, /This fits the authored distinction/);
  const key = feature.expressionNuanceKey("explain-the-reason", 0);
  const wrong = renderWorkspace({ version: 1, roleId: "finance-accounting", screen: "find", nuanceAnswers: { [key]: { choice: "awkward" } } });
  assert.match(wrong, /Compare the distinction again/);
  assert.match(wrong, /An explanation of a decision is not proof of its outcome/);
  const right = renderWorkspace({ version: 1, roleId: "finance-accounting", screen: "find", nuanceAnswers: { [key]: { choice: "fitting", recognizedOn: "2026-10-13", attemptId: "bcf2d727-06ce-4434-a119-402d078fa2c5" } } });
  assert.match(right, /This fits the authored distinction/);
  assert.match(right, /Recognition saved once for this comparison/);
  assert.match(right, /Choose plain English when it is clearer or warmer/);
});

const historyRole = "finance-accounting";
const historyScenario = feature.getScenariosForRole(historyRole).find((scenario) => scenario.expressionId === "explain-the-reason");
const secondHistoryScenario = feature.getScenariosForRole(historyRole).find((scenario) => scenario.expressionId === "bridge-the-difference");
const historyId = "39000000-0000-4000-8000-000000000001";
const secondHistoryId = "39000000-0000-4000-8000-000000000002";
const noteId = "39000000-0000-4000-8000-000000000003";
const stamp = "2026-10-13T10:00:00.000Z";
function emptyHistoryWorkspace(extra = {}) { return component.parseExpressionWorkspace(historyRole, JSON.stringify({ version: 1, roleId: historyRole, ...extra })); }
const notebookEntry = () => ({ id: noteId, expressionId: "explain-the-reason", variant: "plain", phrase: feature.getPracticeExpression("explain-the-reason").plain, intent: "PRIVATE intent", createdOn: "2026-10-13", createdAt: stamp, nextReviewOn: "2026-10-14" });
function completedHistoryWorkspace() {
  let workspace = component.beginExpressionRehearsal(emptyHistoryWorkspace({ notebook: [notebookEntry()] }), { scenarioId: historyScenario.id, today: "2026-10-13", atISO: stamp, id: historyId, gapId: noteId });
  workspace.response = "The rationale for the small pilot was to learn before committing.";
  workspace = component.captureExpressionRehearsal(workspace, { today: "2026-10-13", capturedAtISO: "2026-10-13T10:01:00.000Z", help: false, independent: true, id: historyId });
  return component.finishExpressionRehearsal(workspace, { today: "2026-10-13", atISO: "2026-10-13T10:02:00.000Z", id: historyId });
}

test("actual Studio transitions preserve safe history and advance notebook dates only on completed practice", () => {
  const empty = emptyHistoryWorkspace({ notebook: [notebookEntry()] });
  const started = component.beginExpressionRehearsal(empty, { scenarioId: historyScenario.id, today: "2026-10-13", atISO: stamp, id: historyId, gapId: noteId });
  assert.equal(started.rehearsalHistory[0].mode, "initial");
  assert.equal(started.rehearsalHistory[0].modelSeen, false);
  assert.equal(started.rehearsalHistory[0].gapId, noteId);
  assert.equal(started.notebook[0].lastPractisedAt, undefined);
  const captured = component.captureExpressionRehearsal({ ...started, response: "The rationale for the small pilot was to learn before committing." }, { today: "2026-10-13", capturedAtISO: "2026-10-13T10:01:00.000Z", help: false, independent: true, id: historyId });
  assert.equal(captured.originalCapturedAtISO, "2026-10-13T10:01:00.000Z");
  assert.equal(captured.attemptIndependent, true);
  assert.equal(captured.rehearsalHistory[0].modelSeen, true);
  assert.equal(captured.notebook[0].lastPractisedAt, undefined);
  const evidence = component.productionEvidenceForRehearsal(captured, { today: "2026-10-13", quality: 2, meaningConfirmed: true, naturalnessConfirmed: true, attemptId: historyId });
  assert.equal(evidence.capturedAtISO, captured.originalCapturedAtISO);
  const completed = component.finishExpressionRehearsal(captured, { today: "2026-10-13", atISO: "2026-10-13T10:02:00.000Z", id: historyId });
  assert.equal(completed.notebook[0].lastPractisedAt, "2026-10-13T10:02:00.000Z");
  assert.equal(completed.notebook[0].nextReviewOn, "2026-10-14");
  assert.equal(completed.pendingCheckpoints[0].gapId, noteId);
  assert.equal(completed.rehearsalHistory[0].completedAt, "2026-10-13T10:02:00.000Z");
  assert.equal("response" in completed.rehearsalHistory[0], false);
  assert.equal("intent" in completed.rehearsalHistory[0], false);
  const restored = component.parseExpressionWorkspace(historyRole, JSON.stringify({ version: 2, workspaces: { [historyRole]: completed } }));
  assert.deepEqual(restored.rehearsalHistory, completed.rehearsalHistory);
  assert.equal(restored.notebook[0].lastPractisedAt, completed.notebook[0].lastPractisedAt);
  assert.equal(component.finishExpressionRehearsal(restored, { today: "2026-10-13", atISO: "2026-10-13T10:03:00.000Z", id: historyId }), restored);
});

test("shared history renders completed outcomes and fresh-start actions without fake private originals", () => {
  const completed = completedHistoryWorkspace();
  const safeRecord = completed.rehearsalHistory[0];
  const html = renderWorkspace({ version: 1, roleId: historyRole, screen: "practice", phase: "saved", scenarioId: historyScenario.id, attemptIndependent: true, rehearsalHistory: [safeRecord, { ...safeRecord, id: secondHistoryId, completedAt: undefined, modelSeen: true }] });
  assert.match(html, /Your rehearsal history/);
  assert.match(html, /Rehearsal completed/);
  assert.match(html, /Unfinished rehearsal/);
  assert.match(html, /Start a fresh response/);
  assert.doesNotMatch(html, /Your committed response/);
  assert.doesNotMatch(html, /Your first response was committed before support/);
  assert.doesNotMatch(html, /PRIVATE intent/);
  const parsed = component.parseExpressionWorkspace(historyRole, JSON.stringify({ version: 1, roleId: historyRole, rehearsalHistory: [{ ...safeRecord, roleId: "healthcare" }, { ...safeRecord, scenarioId: "unknown-scenario" }, { ...safeRecord, response: "PRIVATE response", intent: "PRIVATE intent" }] }));
  assert.equal(parsed.rehearsalHistory.length, 1);
  assert.equal(JSON.stringify(parsed.rehearsalHistory).includes("PRIVATE"), false);
});

test("stable transferred challenge resumes its assignment and completes only after every assigned situation", () => {
  const spec = { mode: "transfer", milestone: 5, scenarioIds: [historyScenario.id, secondHistoryScenario.id] };
  let workspace = component.beginExpressionRehearsal(emptyHistoryWorkspace(), { scenarioId: historyScenario.id, today: "2026-10-13", atISO: stamp, id: historyId, fresh: true, challenge: spec });
  assert.equal(workspace.challengeHistory[0].id, `${historyRole}:transfer:5`);
  workspace = component.captureExpressionRehearsal({ ...workspace, response: "The rationale for the small pilot was to learn before committing." }, { today: "2026-10-13", capturedAtISO: "2026-10-13T10:01:00.000Z", help: false, independent: true, id: historyId });
  workspace = component.finishExpressionRehearsal(workspace, { today: "2026-10-13", atISO: "2026-10-13T10:02:00.000Z", id: historyId });
  assert.equal(workspace.challengeHistory[0].completedScenarioIds.length, 1);
  assert.equal(workspace.challengeHistory[0].completedAt, undefined);
  assert.deepEqual(workspace.completedChallengeCounts, []);
  const interrupted = component.parseExpressionWorkspace(historyRole, JSON.stringify(workspace));
  let resumed = component.beginExpressionRehearsal(interrupted, { scenarioId: historyScenario.id, today: "2026-10-14", atISO: "2026-10-14T01:00:00.000Z", id: secondHistoryId, fresh: true, challenge: { ...spec, scenarioIds: [historyScenario.id] } });
  assert.equal(resumed.scenarioId, secondHistoryScenario.id);
  assert.deepEqual(resumed.challengeHistory[0].scenarioIds, spec.scenarioIds);
  resumed = component.captureExpressionRehearsal({ ...resumed, response: "Let's reconcile the records before completing this review." }, { today: "2026-10-14", capturedAtISO: "2026-10-14T01:01:00.000Z", help: false, independent: true, id: secondHistoryId });
  resumed = component.finishExpressionRehearsal(resumed, { today: "2026-10-14", atISO: "2026-10-14T01:02:00.000Z", id: secondHistoryId });
  assert.equal(resumed.challengeHistory[0].completedScenarioIds.length, 2);
  assert.equal(resumed.challengeHistory[0].completedAt, "2026-10-14T01:02:00.000Z");
  assert.deepEqual(resumed.completedChallengeCounts, [5]);
  assert.match(renderWorkspace(resumed, { today: "2026-10-14" }), /Challenge completed/);
});

test("save failure cannot claim completed shared history or update the notebook and repeated saving stays idempotent", () => {
  const completed = completedHistoryWorkspace();
  let current = component.parseExpressionWorkspace(historyRole, JSON.stringify({ ...completed, phase: "comparison", rehearsalHistory: completed.rehearsalHistory.map((record) => ({ ...record, completedAt: undefined })), notebook: [notebookEntry()] }));
  let accepted = false, saves = 0;
  const gate = feature.createExpressionCommitGate();
  const commit = { gate, next: completed, transactionId: `finish:${historyId}`, onCommit: () => { if (!accepted) return false; saves += 1; return true; }, onApply: (next) => { current = next; } };
  assert.equal(feature.commitExpressionTransaction(commit), false);
  assert.equal(current.phase, "comparison");
  assert.equal(current.rehearsalHistory[0].completedAt, undefined);
  assert.equal(current.notebook[0].lastPractisedAt, undefined);
  accepted = true;
  assert.equal(feature.commitExpressionTransaction(commit), true);
  assert.equal(feature.commitExpressionTransaction(commit), false);
  assert.equal(saves, 1);
  assert.equal(current.rehearsalHistory[0].completedAt, "2026-10-13T10:02:00.000Z");
});

test("older private originals are preserved as supported participation without a fabricated current capture", () => {
  const completed = completedHistoryWorkspace();
  const stale = { ...completed, phase: "comparison", attemptDate: "2026-10-12", originalCapturedAtISO: "2026-10-12T10:01:00.000Z" };
  const input = { today: "2026-10-14", meaningConfirmed: true, naturalnessConfirmed: true, attemptId: historyId };
  assert.equal(component.productionEvidenceForRehearsal(stale, { ...input, quality: 2 }), null);
  const supported = component.productionEvidenceForRehearsal(stale, { ...input, quality: 1 });
  assert.equal(supported.independent, false);
  assert.equal(supported.capturedAtISO, undefined);
  assert.equal(supported.response, completed.submittedResponse);
  const html = renderWorkspace(stale, { today: "2026-10-14" });
  assert.match(html, /earlier session or has no original capture time/);
  assert.match(html, /value="2" disabled/);
  assert.match(html, /value="3" disabled/);
});

async function loadSharedProjection() {
  const sourceURL = async (path) => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(await readFile(new URL(`../lib/${path}.ts`, import.meta.url), "utf8"))).toString("base64")}`;
  const professionalURL = await sourceURL("professional-content"), expressionURL = await sourceURL("expression-content"), idiomURL = await sourceURL("daily-idioms");
  const dailySource = stripTypeScriptTypes(await readFile(new URL("../lib/daily-vocabulary-state.ts", import.meta.url), "utf8"))
    .replace('from "./professional-content"', `from "${professionalURL}"`)
    .replace('from "./daily-idioms"', `from "${idiomURL}"`);
  const dailyStateURL = `data:text/javascript;base64,${Buffer.from(dailySource).toString("base64")}`;
  const webSource = stripTypeScriptTypes(await readFile(new URL("../lib/web-learning-state.ts", import.meta.url), "utf8"))
    .replace('from "./daily-vocabulary-state"', `from "${dailyStateURL}"`);
  const webURL = `data:text/javascript;base64,${Buffer.from(webSource).toString("base64")}`;
  const source = stripTypeScriptTypes(await readFile(new URL("../lib/shared-learning-state.ts", import.meta.url), "utf8"))
    .replace('from "./professional-content"', `from "${professionalURL}"`).replace('from "./expression-content"', `from "${expressionURL}"`).replace('from "./web-learning-state"', `from "${webURL}"`);
  return { shared: await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`), web: await import(webURL) };
}

test("actual Studio metadata projects, hydrates, renders and reprojects without dropping history or private-text leakage", async () => {
  const { shared, web } = await loadSharedProjection();
  const defaults = { version: 3, profile: { roleId: historyRole, seniorityId: "experienced-contributor", situationIds: [], goalIds: ["clarify"] }, settings: { lessonTime: "09:00", timeZone: "Etc/UTC", dailyWordCount: 3 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [] };
  const local = web.prepareWebState(defaults), completed = completedHistoryWorkspace();
  local.learningV3.updatedAt = "2026-10-13T10:02:00.000Z";
  local.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { [historyRole]: { ...completed, intent: "PRIVATE real situation", response: "PRIVATE response remains here" } } });
  const canonical = shared.webToSharedCloudState(local);
  assert.equal(shared.validateSharedCloudState(canonical), true);
  assert.equal(JSON.stringify(canonical).includes("PRIVATE"), false);
  assert.equal(Object.keys(canonical.sharedLearning.rehearsals).length, 1);
  assert.equal(canonical.sharedLearning.notebook[noteId].lastPractisedAt, "2026-10-13T10:02:00.000Z");
  const hydrated = shared.sharedCloudStateToWeb(canonical, web.prepareWebState(defaults), defaults);
  const parsed = component.parseExpressionWorkspace(historyRole, hydrated.learningV3.expressionDraft);
  assert.equal(parsed.rehearsalHistory.length, 1);
  assert.equal(parsed.rehearsalHistory[0].gapId, noteId);
  assert.equal(parsed.submittedResponse, "");
  assert.equal(parsed.attemptIndependent, false);
  const html = renderToStaticMarkup(createElement(ExpressionPractice, { roleId: historyRole, learnedWordIds: [], today: "2026-10-14", savedDraft: hydrated.learningV3.expressionDraft, onCommit: () => true }));
  assert.match(html, /Rehearsal completed/);
  assert.doesNotMatch(html, /Your committed response/);
  hydrated.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { [historyRole]: parsed } });
  const again = shared.webToSharedCloudState(hydrated);
  assert.deepEqual(again.sharedLearning.rehearsals, canonical.sharedLearning.rehearsals);
  assert.deepEqual(again.sharedLearning.notebook, canonical.sharedLearning.notebook);
});

test("delayed completion advances the linked selected phrase and preserves the original immutable rehearsal", () => {
  const original = completedHistoryWorkspace();
  let delayed = component.beginExpressionRehearsal(original, { scenarioId: historyScenario.id, today: "2026-10-14", atISO: "2026-10-14T01:00:00.000Z", id: secondHistoryId, fresh: true, gapId: noteId });
  delayed = component.captureExpressionRehearsal({ ...delayed, response: "The rationale for a second opinion was to test our assumptions." }, { today: "2026-10-14", capturedAtISO: "2026-10-14T01:01:00.000Z", help: false, independent: true, id: secondHistoryId });
  delayed = component.finishExpressionRehearsal(delayed, { today: "2026-10-14", atISO: "2026-10-14T01:02:00.000Z", id: secondHistoryId });
  assert.equal(delayed.rehearsalHistory.length, 2);
  assert.deepEqual(delayed.rehearsalHistory[0], original.rehearsalHistory[0]);
  assert.equal(delayed.rehearsalHistory[1].mode, "delayed");
  assert.equal(delayed.notebook[0].lastPractisedAt, "2026-10-14T01:02:00.000Z");
  assert.equal(delayed.notebook[0].nextReviewOn, "2026-10-15");
  assert.ok(delayed.pendingCheckpoints.some((item) => item.dueOn === "2026-10-15" && item.gapId === noteId));
});


test("incoming safe history merges while an origin device keeps its local response and frozen capture", () => {
  const local = completedHistoryWorkspace();
  local.phase = "comparison";
  local.intent = "PRIVATE local intent";
  const incoming = emptyHistoryWorkspace({ rehearsalHistory: [{ ...local.rehearsalHistory[0], modelSeen: true }], notebook: [{ ...notebookEntry(), lastPractisedAt: "2026-10-13T10:02:00.000Z", nextReviewOn: "2026-10-14" }] });
  const merged = component.mergeExpressionWorkspaceHistory(local, incoming);
  assert.equal(merged.intent, local.intent);
  assert.equal(merged.submittedResponse, local.submittedResponse);
  assert.equal(merged.originalCapturedAtISO, local.originalCapturedAtISO);
  assert.equal(merged.phase, "comparison");
  assert.equal(merged.rehearsalHistory.length, 1);
  assert.equal(merged.rehearsalHistory[0].modelSeen, true);
});
