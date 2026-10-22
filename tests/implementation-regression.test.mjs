import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import test, { after } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url);
const moduleUrls = new Map();
const runtimeDirectory = await mkdtemp(join(tmpdir(), "lucid-implementation-regression-"));
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

const engine = await load("lib/learning-engine.ts");
const persistence = await load("lib/web-learning-state.ts");
const sync = await load("lib/web-learning-sync.ts");

test("recognition after a lapse cannot restore historical productive mastery", () => {
  let state = engine.createWordMastery("fixture-word", "2026-08-01");
  for (const date of ["2026-08-02", "2026-08-10", "2026-09-01"]) {
    state = engine.reviewWord(state, { reviewedOn: date, quality: 2, productive: true });
  }
  assert.equal(engine.isWordMastered(state), true);
  const successDates = [...state.productiveSuccessDates];
  state = engine.reviewWord(state, { reviewedOn: "2026-09-02", quality: 0, productive: false });
  assert.equal(engine.isWordMastered(state), false);
  state = engine.reviewWord(state, { reviewedOn: "2026-09-03", quality: 3, productive: false });
  assert.deepEqual(state.productiveSuccessDates, successDates, "recognition preserves historical evidence without adding production");
  assert.equal(state.mastered, false, "a successful recognition answer must not restore independent-recall mastery");
  assert.equal(engine.isWordMastered(state), false);
  state = engine.reviewWord(state, { reviewedOn: "2026-09-04", quality: 2, productive: true });
  assert.equal(engine.isWordMastered(state), true);
});

test("same-day productive repetitions cannot substitute for delayed independent retrieval", () => {
  let state = engine.createWordMastery("fixture-word", "2026-08-01");
  for (let index = 0; index < 5; index++) state = engine.reviewWord(state, { reviewedOn: "2026-08-02", quality: 3, productive: true });
  assert.deepEqual(state.productiveSuccessDates, ["2026-08-02"]);
  assert.equal(state.mastered, false);
  state = engine.reviewWord(state, { reviewedOn: "2026-08-10", quality: 3, productive: true });
  assert.equal(state.mastered, false, "two days without a 30-day event are not mastery");
});

test("local lexical feedback explicitly leaves semantic accuracy unverified", () => {
  const feedback = engine.evaluateUsage({ sentence: "The rationale proves that the outcome is guaranteed.", targetWord: "rationale", expectedCollocations: ["the rationale"], meaning: "reasoning for a decision" });
  assert.equal(feedback.targetFound, true);
  assert.equal(feedback.method, "local-rule-based-heuristics");
  assert.match(feedback.limitation, /cannot reliably verify/i);
});

const profile = (roleId = "technology-engineering") => ({ roleId, seniorityId: "experienced-contributor", situationIds: [roleId === "finance-accounting" ? "finance:month-end-close" : "technology:architecture-review"], goalIds: ["clarify"] });
function baseState() {
  return { version: 2, profile: profile(), introducedWordIds: [], masteryByWordId: {}, dailySessions: [], usageAttempts: {}, lessonStatus: "not_started", lessonWordProgress: 0,
    completedDays: [1, 2, 3, 4], difficultIds: [], favouriteIds: [], reviewedIds: [], masteryScores: {}, reviewDates: {}, nextReviewAt: {}, exerciseAnswers: {}, quizAnswers: {}, quizAttempts: [],
    settings: { lessonTime: "09:00", timeZone: "Asia/Dubai", notificationsEnabled: false, dailyWordCount: 3 } };
}
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
function event(number, date, changes = {}) {
  return persistence.makeReviewEvidence({ id: uuid(number), wordId: "finance-rationale", roleId: "technology-engineering", date,
    recordedAtISO: `${date}T09:00:00.000Z`, kind: "self-assessed-production", quality: 2, independent: true,
    response: "The rationale for testing is to reduce rework.", meaningAttested: true, naturalnessAttested: true, ...changes });
}
function preparedState() { return persistence.prepareWebState(baseState()); }
function rolePlan(date = "2026-10-13", wordIds = ["one", "two", "three"]) {
  return { id: `${date}:technology-engineering`, date, roleId: "technology-engineering", wordIds, completedIds: [], cursor: 0, answers: {}, createdAt: `${date}T09:00:00.000Z` };
}

test("legacy migration preserves IDs, history and scheduled dates without inventing context mastery", () => {
  const legacy = baseState();
  const mastery = engine.createWordMastery("finance-rationale", "2026-08-01");
  mastery.nextReviewOn = "2026-11-01";
  mastery.reviewCount = 5;
  legacy.introducedWordIds = [mastery.wordId];
  legacy.masteryByWordId[mastery.wordId] = mastery;
  legacy.reviewDates[mastery.wordId] = ["2026-08-01", "2026-09-01"];
  legacy.nextReviewAt[mastery.wordId] = "2026-11-01";
  legacy.favouriteIds = [mastery.wordId];
  const snapshot = structuredClone(legacy);
  const migrated = persistence.prepareWebState(legacy);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.masteryByWordId, snapshot.masteryByWordId);
  assert.deepEqual(migrated.reviewDates, snapshot.reviewDates);
  assert.deepEqual(migrated.nextReviewAt, snapshot.nextReviewAt);
  assert.deepEqual(migrated.completedDays, [1, 2, 3, 4]);
  assert.deepEqual(migrated.favouriteIds, snapshot.favouriteIds);
  assert.deepEqual(migrated.learningV3.contextMastery, {}, "legacy global word history cannot demonstrate a role-specific sense");
  assert.deepEqual(legacy, snapshot, "migration must not mutate its source record");
});

test("state validation fails closed on future versions, oversized data and prototype keys", () => {
  const invalid = [
    { ...baseState(), version: 4 },
    { ...preparedState(), learningV3: { ...preparedState().learningV3, version: 4 } },
    { ...baseState(), usageAttempts: { privateText: "x".repeat(persistence.MAX_STATE_BYTES) } },
    JSON.parse('{"version":2,"settings":{"__proto__":{"polluted":true}}}'),
    { ...baseState(), settings: new Date("2026-10-13") },
    { ...baseState(), lessonWordProgress: Number.NaN },
    { ...baseState(), introducedWordIds: [42] },
  ];
  for (const record of invalid) {
    assert.equal(persistence.validateWebState(record), false);
    assert.throws(() => persistence.prepareWebState(record));
  }
  assert.equal({}.polluted, undefined);
});

test("malformed nested learning records are rejected before they can replace usable progress", () => {
  const state = baseState();
  state.masteryByWordId["finance-rationale"] = { ...engine.createWordMastery("finance-rationale", "2026-10-01"), nextReviewOn: "2026-99-99", reviewCount: -1 };
  assert.equal(persistence.validateWebState(state), false, "a root object check alone cannot protect persisted schedules");
  const invalidPlan = preparedState();
  invalidPlan.learningV3.rolePlans["2026-10-13:technology-engineering"] = { ...rolePlan(), completedIds: ["not-assigned"] };
  assert.equal(persistence.validateWebState(invalidPlan), false);
  assert.equal(persistence.makeReviewEvidence({ wordId: "word", roleId: "role", date: "2026-13-01", kind: "recognition", quality: 2, independent: false }), null);
});

test("fresh independent responses and explicit attestations are required for production evidence", () => {
  assert.equal(event(1, "2026-10-02", { response: "" }), null);
  assert.equal(event(1, "2026-10-02", { response: "rationale" }), null);
  assert.equal(event(1, "2026-10-02", { meaningAttested: false }), null);
  assert.equal(event(1, "2026-10-02", { naturalnessAttested: false }), null);
  assert.equal(event(1, "2026-10-02", { modelSeen: true }).independent, false);
  assert.equal(event(1, "2026-10-02", { assisted: true }).independent, false);
  const recognition = event(1, "2026-10-02", { kind: "recognition", response: "", independent: true });
  assert.equal(recognition.independent, false);
  assert.equal(recognition.kind, "recognition");
  assert.equal(Object.hasOwn(event(1, "2026-10-02"), "response"), false, "anonymous evidence must not retain the private response");
});

test("retention evidence remains scoped to a sense and same-day weak evidence wins", () => {
  const state = preparedState();
  const key = persistence.contextEvidenceKey("finance-rationale", "technology-engineering");
  const other = persistence.contextEvidenceKey("finance-rationale", "finance-accounting");
  state.learningV3.contextIntroducedOn = { [key]: "2026-08-01", [other]: "2026-08-01" };
  state.learningV3.reviewEvidence = [event(1, "2026-08-02", { kind: "unaided-recall" }), event(2, "2026-08-10", { kind: "unaided-recall" }), event(3, "2026-09-01", { kind: "unaided-recall" })];
  const mastered = persistence.prepareWebState(state);
  assert.equal(mastered.learningV3.contextMastery[key].mastered, true);
  assert.equal(mastered.learningV3.contextMastery[other].mastered, false);
  assert.deepEqual(mastered.learningV3.contextMastery[other].productiveSuccessDates, []);
  state.learningV3.reviewEvidence.push(event(4, "2026-09-01", { kind: "unaided-recall", quality: 0, independent: false }));
  const lapsed = persistence.prepareWebState(state);
  assert.equal(lapsed.learningV3.contextMastery[key].mastered, false);
  assert.equal(lapsed.learningV3.contextMastery[key].nextReviewOn, "2026-09-02");
  assert.deepEqual(lapsed.learningV3.contextMastery[key].productiveSuccessDates, ["2026-08-02", "2026-08-10"]);
});

test("offline merge unions concurrent evidence and completion while retaining local unfinished work", () => {
  const local = preparedState(), remote = preparedState();
  const key = persistence.contextEvidenceKey("finance-rationale", "technology-engineering");
  local.learningV3.contextIntroducedOn[key] = "2026-08-01";
  remote.learningV3.contextIntroducedOn[key] = "2026-08-05";
  local.learningV3.reviewEvidence = [event(1, "2026-08-02", { kind: "unaided-recall" }), event(2, "2026-08-10", { kind: "unaided-recall" })];
  remote.learningV3.reviewEvidence = [event(2, "2026-08-10", { kind: "unaided-recall" }), event(3, "2026-09-01", { kind: "unaided-recall" })];
  local.learningV3.practiceDrafts = { private: "Local unfinished sentence." };
  remote.learningV3.practiceDrafts = { private: "Another device's private sentence." };
  local.learningV3.rolePlans["2026-10-13:technology-engineering"] = { ...rolePlan(), completedIds: ["one"], cursor: 1 };
  remote.learningV3.rolePlans["2026-10-13:technology-engineering"] = { ...rolePlan(), completedIds: ["two"], cursor: 2 };
  local.introducedWordIds = ["one"];
  remote.introducedWordIds = ["two"];
  local.favouriteIds = ["finance-rationale"];
  remote.favouriteIds = ["finance-rationale"];
  local.learningV3.favouriteChanges["finance-rationale"] = { selected: true, updatedAt: "2026-10-01T09:00:00Z" };
  remote.learningV3.favouriteChanges["finance-rationale"] = { selected: false, updatedAt: "2026-10-02T09:00:00Z" };
  const snapshot = structuredClone(local);
  const merged = persistence.mergeWebStates(local, remote);
  assert.deepEqual(merged.introducedWordIds, ["one", "two"]);
  assert.equal(merged.learningV3.reviewEvidence.length, 3);
  assert.equal(merged.learningV3.contextIntroducedOn[key], "2026-08-01");
  assert.equal(merged.learningV3.contextMastery[key].mastered, true);
  assert.deepEqual(merged.learningV3.rolePlans["2026-10-13:technology-engineering"].completedIds, ["one", "two"]);
  assert.equal(merged.learningV3.rolePlans["2026-10-13:technology-engineering"].cursor, 1);
  assert.equal(merged.learningV3.practiceDrafts.private, "Local unfinished sentence.");
  assert.deepEqual(merged.favouriteIds, []);
  assert.deepEqual(local, snapshot);
  const replayed = persistence.mergeWebStates(merged, remote);
  assert.equal(replayed.learningV3.reviewEvidence.length, 3, "reconnection replay cannot multiply evidence");
});

test("cloud projection excludes responses, unfinished answers and native companion text", () => {
  const state = preparedState();
  state.usageAttempts = { word: { sentence: "Private example", checkedAt: "2026-10-13T09:00:00Z" } };
  state.exerciseAnswers = { question: "Private exercise" };
  state.quizAnswers = { question: "Private quiz answer" };
  state.learningV3.practiceDrafts.private = "Private sentence";
  state.learningV3.reviewDrafts.private = { response: "Private recall", hinted: false, revealed: false };
  state.learningV3.expressionDraft = "Private expression gap";
  state.learningV3.nativeCompanion = { studioDrafts: { private: "Native private text" } };
  state.learningV3.rolePlans["2026-10-13:technology-engineering"] = { ...rolePlan(), cursor: 2, answers: { one: { choices: ["one"], revealed: true } } };
  const cloud = persistence.toCloudWebState(state);
  assert.doesNotMatch(JSON.stringify(cloud), /Private|private text|Native private/);
  assert.deepEqual(cloud.learningV3.rolePlans["2026-10-13:technology-engineering"].answers, {});
  assert.equal(cloud.learningV3.rolePlans["2026-10-13:technology-engineering"].cursor, 0);
  assert.equal(state.learningV3.practiceDrafts.private, "Private sentence", "projection must not erase the local record");
});

test("native portable dates use Foundation's 2001 epoch and preserve placements and schedules", () => {
  assert.equal(persistence.foundationDateToISO(0), "2001-01-01T00:00:00.000Z");
  assert.equal(persistence.isoToFoundationDate("2001-01-01T00:00:00Z"), 0);
  const nativeSeconds = 813542400;
  assert.equal(persistence.foundationDateToISO(nativeSeconds), "2026-10-13T00:00:00.000Z");
  const native = {
    version: 2,
    learner: { schemaVersion: 2, profile: profile("finance-accounting"), introducedWordIds: ["finance-rationale"],
      progressByWordId: { "finance-rationale": { introducedOn: nativeSeconds - 864000, intervalIndex: 2, nextReviewOn: nativeSeconds + 604800, lastReviewedOn: nativeSeconds, reviewCount: 4, successfulReviewDates: [nativeSeconds - 86400], lapses: 1, mastered: false } },
      sessions: [{ id: uuid(100), date: nativeSeconds, completedAt: nativeSeconds + 32400, dayKey: "2026-10-13", wordIds: ["finance-rationale"] }],
      favouriteWordIds: ["finance-rationale"], pathPlacements: { "finance-accounting": { pathId: "finance-accounting", startingModuleId: "finance-module-3", checkedAt: nativeSeconds, correctAnswers: 4, questionCount: 6 } },
      settings: { reminderHour: 9, reminderMinute: 30, speechRate: 0.46 }, dailyWordGoal: 2,
      studioDrafts: { private: "Native draft stays in portable file only" },
    },
  };
  const local = preparedState();
  const imported = persistence.importPortableBackup(native, local);
  assert.equal(imported.profile.roleId, local.profile.roleId, "restoring progress must not silently switch the current profile");
  assert.equal(imported.masteryByWordId["finance-rationale"].nextReviewOn, "2026-10-20");
  assert.equal(imported.masteryByWordId["finance-rationale"].intervalIndex, 2);
  assert.equal(imported.learningV3.placementsByRole["finance-accounting"].checkedAtISO, "2026-10-13T00:00:00.000Z");
  assert.equal(imported.dailySessions[0].date, "2026-10-13");
  const exported = persistence.exportPortableBackup(imported);
  assert.equal(exported.learner.progressByWordId["finance-rationale"].nextReviewOn + 978307200, Date.parse("2026-10-20T12:00:00Z") / 1000);
  assert.equal(exported.learner.pathPlacements["finance-accounting"].checkedAt, nativeSeconds);
  assert.equal(exported.learner.studioDrafts.private, native.learner.studioDrafts.private);
  assert.doesNotMatch(JSON.stringify(persistence.toCloudWebState(imported)), /Native draft stays/);
  const switched = persistence.importPortableBackup(native, local, undefined, true);
  assert.equal(switched.profile.roleId, "finance-accounting");
});

test("web session identifiers export as native-decodable stable UUIDs", () => {
  const state = preparedState();
  state.dailySessions = [{ id: "2026-10-13:technology-engineering", date: "2026-10-13", roleId: "technology-engineering", situationId: "technology:architecture-review", wordIds: ["finance-rationale"], completedAt: "2026-10-13T09:00:00Z" }];
  const first = persistence.exportPortableBackup(state), second = persistence.exportPortableBackup(state);
  assert.match(first.learner.sessions[0].id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Swift UUID decoding must accept a web-exported session");
  assert.equal(first.learner.sessions[0].id, second.learner.sessions[0].id, "repeat exports must not multiply sessions");
  const roundtrip = persistence.importPortableBackup(first, state);
  assert.equal(roundtrip.dailySessions.length, 1, "portable round trips must not duplicate daily session history");
});


test("web backups decode with the actual native Codable models and return across time zones", { skip: process.platform !== "darwin", timeout: 60_000 }, async () => {
  const state = preparedState();
  const term = "finance-rationale";
  const key = persistence.contextEvidenceKey(term, "technology-engineering");
  state.introducedWordIds = [term];
  state.masteryByWordId[term] = engine.createWordMastery(term, "2026-10-01");
  state.learningV3.contextIntroducedOn[key] = "2026-10-01";
  state.learningV3.reviewEvidence = [event(40, "2026-10-13", { recordedAtISO: "2026-10-13T09:00:00+04:00", kind: "unaided-recall" })];
  state.learningV3.placementsByRole["technology-engineering"] = { pathId: "technology-engineering", startingModuleId: "engineering-module-3", checkedAtISO: "2026-10-13T09:00:00+04:00", correctCount: 4, questionCount: 6 };
  state.dailySessions = [{ id: "2026-10-13:technology-engineering", date: "2026-10-13", roleId: "technology-engineering", situationId: "technology:architecture-review", wordIds: [term], completedAt: "2026-10-13T09:00:00+04:00" }];
  const exported = persistence.exportPortableBackup(state);
  const [studio, persistenceSource, dailyVocabularySource] = await Promise.all([
    readFile(new URL("ios/Lucid/Lucid/ExpressionStudio.swift", root), "utf8"),
    readFile(new URL("ios/Lucid/Lucid/LearningPersistence.swift", root), "utf8"),
    readFile(new URL("ios/Lucid/Lucid/DailyVocabulary.swift", root), "utf8"),
  ]);
  const modelEnd = studio.indexOf("@MainActor\nextension LearningStore");
  assert.ok(modelEnd > 0, "native feature Codable declarations must be extracted intact");
  const dailyModelEnd = dailyVocabularySource.indexOf("enum DailyVocabularyEngine {");
  assert.ok(dailyModelEnd > 0, "daily vocabulary Codable declarations must be extracted intact");
  const dailyModels = dailyVocabularySource.slice(0, dailyModelEnd);
  assert.doesNotMatch(dailyModels, /extension LearningStore/, "portable declarations must exclude runtime daily store extensions");
  const envelope = / {4}struct Envelope: Codable \{[\s\S]*?\n {4}\}\n {4}struct Loaded/.exec(persistenceSource);
  assert.ok(envelope, "portable test must use the production Envelope declaration");
  const fixture = join(runtimeDirectory, "portable-fixture.json");
  const declarations = join(runtimeDirectory, "StudioDeclarations.swift");
  const dailyDeclarations = join(runtimeDirectory, "DailyVocabularyDeclarations.swift");
  const main = join(runtimeDirectory, "PortableMain.swift");
  const executable = join(runtimeDirectory, "portable-model-check");
  await writeFile(fixture, JSON.stringify(exported));
  const evidenceStart = studio.lastIndexOf("\nextension ContextEvidence {");
  assert.ok(evidenceStart > modelEnd, "portable test must use the production ContextEvidence helpers");
  const evidenceEnd = studio.indexOf("\n@MainActor", evidenceStart);
  const evidenceExtension = studio.slice(evidenceStart, evidenceEnd < 0 ? undefined : evidenceEnd);
  assert.ok(evidenceExtension.includes("static func calendarDay"));
  assert.doesNotMatch(evidenceExtension, /extension LearningStore/, "portable declarations must exclude runtime store extensions");
  await writeFile(declarations, studio.slice(0, modelEnd) + evidenceExtension);
  await writeFile(dailyDeclarations, dailyModels);
  await writeFile(main, `import Foundation\nstruct LearningPersistence {\n${envelope[0].replace(/\n {4}struct Loaded$/, "")}\n}\n
@main struct PortableFixtureCheck {
  static func main() throws {
    let bytes = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
    let decoded = try JSONDecoder().decode(LearningPersistence.Envelope.self, from: bytes)
    precondition(decoded.version == 2)
    precondition(decoded.learner.sessions.count == 1)
    precondition(decoded.learner.contextEvidence?.count == 1)
    let event = decoded.learner.contextEvidence![0]
    precondition(event.recordedAt.timeIntervalSince1970 == 1791867600, "Foundation conversion must preserve +04:00 instant")
    precondition(decoded.learner.pathPlacements!["technology-engineering"]!.checkedAt == event.recordedAt)
    let output = try JSONEncoder().encode(decoded)
    print(String(decoding: output, as: UTF8.self))
  }
}
`);
  const build = spawnSync("xcrun", ["swiftc", "-parse-as-library", new URL("ios/Lucid/Lucid/Models.swift", root).pathname, declarations, dailyDeclarations, main, "-o", executable], { encoding: "utf8", timeout: 45_000 });
  assert.equal(build.status, 0, build.stderr || build.error?.message);
  const decoded = spawnSync(executable, [fixture], { encoding: "utf8", timeout: 10_000 });
  assert.equal(decoded.status, 0, decoded.stderr || decoded.error?.message);
  const nativeReencoded = JSON.parse(decoded.stdout);
  const returned = persistence.importPortableBackup(nativeReencoded, preparedState());
  assert.equal(returned.dailySessions.length, 1);
  assert.equal(returned.learningV3.reviewEvidence.length, 1);
  assert.equal(Date.parse(returned.learningV3.reviewEvidence[0].recordedAtISO), Date.parse("2026-10-13T09:00:00+04:00"));
  assert.equal(Date.parse(returned.learningV3.placementsByRole["technology-engineering"].checkedAtISO), Date.parse("2026-10-13T09:00:00+04:00"));
});


function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, failScopeWrites: false, getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { if (this.failScopeWrites && key.startsWith("lucid-learning-v3:")) throw new Error("Fixture storage full"); data.set(key, value); } };
}
function syncServer(identity = "device:device-qa-001") {
  return { identity, offline: false, records: new Map(), writes: [], async fetch(_url, options = {}) {
    if (this.offline) throw new Error("Fixture disconnected");
    if (options.method === "PUT") {
      const body = JSON.parse(options.body);
      if (body.scopeKey !== this.identity) return Response.json({ identity: this.identity, error: "Identity changed" }, { status: 409 });
      this.writes.push(structuredClone(body));
      const previous = this.records.get(this.identity);
      this.records.set(this.identity, previous ? persistence.mergeWebStates(previous, body.state) : body.state);
    }
    return Response.json({ identity: this.identity, state: this.records.get(this.identity) ?? null });
  } };
}
function controller(storage, server) { return sync.createWebLearningSync({ storage, fetch: server.fetch.bind(server), defaults: baseState(), deviceId: "device-qa-001" }); }

test("an authenticated account never automatically imports an unscoped guest cache", async () => {
  const legacy = baseState(); legacy.introducedWordIds = ["guest-only-word"]; legacy.usageAttempts = { private: { sentence: "Guest private wording" } };
  const original = JSON.stringify(legacy);
  const storage = memoryStorage({ "lucid-offline-state": original });
  const server = syncServer("user:account-a");
  const instance = controller(storage, server);
  try {
    await instance.load(); await instance.retrySync();
    assert.equal(instance.snapshot().scopeKey, "user:account-a");
    assert.deepEqual(instance.snapshot().state.introducedWordIds, []);
    assert.equal(storage.getItem("lucid-offline-state"), original, "original cache remains available for a consented guest restore");
    assert.doesNotMatch(JSON.stringify(server.writes), /Guest private|guest-only-word/);
  } finally { instance.dispose(); }
});

test("confirmed guest migration preserves old schedules and server-confirmed device isolation", async () => {
  const legacy = baseState(); legacy.introducedWordIds = ["finance-rationale"]; legacy.masteryByWordId["finance-rationale"] = engine.createWordMastery("finance-rationale", "2026-08-01");
  legacy.masteryByWordId["finance-rationale"].nextReviewOn = "2026-11-01";
  const storage = memoryStorage({ "lucid-offline-state": JSON.stringify(legacy) }); const server = syncServer(); const instance = controller(storage, server);
  try {
    await instance.load(); await instance.retrySync();
    assert.equal(instance.snapshot().scopeKey, "device:device-qa-001");
    assert.equal(instance.snapshot().state.masteryByWordId["finance-rationale"].nextReviewOn, "2026-11-01");
    assert.ok(storage.getItem("lucid-learning-v3:device%3Adevice-qa-001"));
    assert.ok(server.writes.every((body) => body.scopeKey === "device:device-qa-001"));
  } finally { instance.dispose(); }
});

test("account changes invalidate stale actions and retain each account in its own cache", async () => {
  const storage = memoryStorage(); const server = syncServer("user:account-a"); const instance = controller(storage, server);
  try {
    await instance.load(); await instance.retrySync();
    const accountA = instance.snapshot().scopeKey;
    assert.equal(instance.commit((state) => ({ ...state, introducedWordIds: ["a-only"] }), accountA), true);
    await instance.retrySync();
    server.identity = "user:account-b";
    await instance.retrySync();
    assert.equal(instance.snapshot().scopeKey, "user:account-b");
    assert.deepEqual(instance.snapshot().state.introducedWordIds, []);
    let staleUpdaterRan = false;
    assert.equal(instance.commit((state) => { staleUpdaterRan = true; return state; }, accountA), false);
    assert.equal(staleUpdaterRan, false, "reject the old account before executing its captured updater");
    assert.deepEqual(JSON.parse(storage.getItem("lucid-learning-v3:user%3Aaccount-a")).introducedWordIds, ["a-only"]);
    server.identity = "user:account-a"; await instance.retrySync();
    assert.deepEqual(instance.snapshot().state.introducedWordIds, ["a-only"]);
  } finally { instance.dispose(); }
});

test("offline startup never opens account data under an unverified guest identity", async () => {
  const account = preparedState(); account.introducedWordIds = ["account-only"];
  const storage = memoryStorage({ "lucid-learning-v3:user%3Aaccount-a": JSON.stringify(account) });
  const server = syncServer("user:account-a"); server.offline = true; const instance = controller(storage, server);
  try {
    await instance.load();
    assert.equal(instance.snapshot().scopeKey, "device:device-qa-001");
    assert.equal(instance.snapshot().status, "offline");
    assert.deepEqual(instance.snapshot().state.introducedWordIds, []);
    assert.equal(instance.commit((state) => ({ ...state, introducedWordIds: ["guest-offline"] })), true);
    await instance.retrySync();
    server.offline = false; await instance.retrySync();
    assert.equal(instance.snapshot().scopeKey, "user:account-a");
    assert.deepEqual(instance.snapshot().state.introducedWordIds, ["account-only"]);
    assert.deepEqual(JSON.parse(storage.getItem("lucid-learning-v3:device%3Adevice-qa-001")).introducedWordIds, ["guest-offline"]);
    assert.ok(server.writes.every((body) => !body.state.introducedWordIds.includes("guest-offline")), "reconnection must not upload guest history to an account");
  } finally { instance.dispose(); }
});

test("local write failure blocks learning advance and keeps updater drafts recoverable for retry", async () => {
  const storage = memoryStorage(); const server = syncServer(); const instance = controller(storage, server);
  try {
    await instance.load(); await instance.retrySync();
    const before = structuredClone(instance.snapshot().state); const writesBefore = server.writes.length;
    storage.failScopeWrites = true;
    const saved = instance.commit((state) => ({ ...state, introducedWordIds: ["not-yet-earned"], learningV3: { ...state.learningV3, practiceDrafts: { private: "Recover this unfinished response" } } }));
    assert.equal(saved, false);
    assert.deepEqual(instance.snapshot().state, before);
    assert.equal(instance.snapshot().status, "error");
    assert.equal(server.writes.length, writesBefore, "an unsaved advance cannot be uploaded");
    storage.failScopeWrites = false; await instance.retrySync();
    assert.equal(instance.snapshot().state.learningV3.practiceDrafts.private, "Recover this unfinished response");
    assert.deepEqual(instance.snapshot().state.introducedWordIds, ["not-yet-earned"]);
    assert.doesNotMatch(JSON.stringify(server.writes), /Recover this unfinished response/);
  } finally { instance.dispose(); }
});

test("offline progress reconnects by union and repeated reconnect does not multiply evidence", async () => {
  const storage = memoryStorage(); const server = syncServer(); const remote = preparedState();
  const key = persistence.contextEvidenceKey("finance-rationale", "technology-engineering");
  remote.introducedWordIds = ["remote-word"]; remote.learningV3.contextIntroducedOn[key] = "2026-08-01"; remote.learningV3.reviewEvidence = [event(80, "2026-08-02", { kind: "unaided-recall" })];
  server.records.set(server.identity, remote); const instance = controller(storage, server);
  try {
    await instance.load(); await instance.retrySync(); server.offline = true;
    assert.equal(instance.commit((state) => ({ ...state, introducedWordIds: [...state.introducedWordIds, "local-word"], learningV3: { ...state.learningV3, reviewEvidence: [...state.learningV3.reviewEvidence, event(81, "2026-08-10", { kind: "unaided-recall" })] } })), true);
    await instance.retrySync();
    assert.equal(instance.snapshot().status, "offline");
    const concurrent = preparedState(); concurrent.introducedWordIds = ["remote-word", "other-device-word"]; concurrent.learningV3.contextIntroducedOn[key] = "2026-08-01"; concurrent.learningV3.reviewEvidence = [event(80, "2026-08-02", { kind: "unaided-recall" }), event(82, "2026-09-01", { kind: "unaided-recall" })];
    server.records.set(server.identity, concurrent); server.offline = false;
    await instance.retrySync(); await instance.retrySync();
    assert.deepEqual(instance.snapshot().state.introducedWordIds, ["local-word", "other-device-word", "remote-word"]);
    assert.equal(instance.snapshot().state.learningV3.reviewEvidence.length, 3);
    assert.equal(instance.snapshot().state.learningV3.contextMastery[key].mastered, true);
    assert.equal(server.records.get(server.identity).learningV3.reviewEvidence.length, 3);
  } finally { instance.dispose(); }
});

test("identity changes between GET and PUT reject stale uploads before selecting the next account", async () => {
  const storage = memoryStorage(); const server = syncServer("user:account-a"); const originalFetch = server.fetch.bind(server); let changeOnPut = false;
  server.fetch = async (url, options = {}) => { if (options.method === "PUT" && changeOnPut) { changeOnPut = false; server.identity = "user:account-b"; } return originalFetch(url, options); };
  const instance = controller(storage, server);
  try {
    await instance.load(); await instance.retrySync(); changeOnPut = true;
    assert.equal(instance.commit((state) => ({ ...state, introducedWordIds: ["a-new-word"] })), true);
    await instance.retrySync();
    assert.equal(instance.snapshot().scopeKey, "user:account-b");
    assert.deepEqual(instance.snapshot().state.introducedWordIds, []);
    assert.ok(server.writes.every((body) => body.scopeKey !== "user:account-b" || !body.state.introducedWordIds.includes("a-new-word")));
    assert.deepEqual(JSON.parse(storage.getItem("lucid-learning-v3:user%3Aaccount-a")).introducedWordIds, ["a-new-word"]);
  } finally { instance.dispose(); }
});


test("self-assessed production and recognition do not overwrite retained unaided recall", () => {
  const state = preparedState();
  const key = persistence.contextEvidenceKey("finance-rationale", "technology-engineering");
  state.learningV3.contextIntroducedOn[key] = "2026-08-01";
  state.learningV3.reviewEvidence = [event(101, "2026-08-02", { kind: "unaided-recall" }), event(102, "2026-08-10", { kind: "unaided-recall" }), event(103, "2026-09-01", { kind: "unaided-recall" })];
  const before = persistence.prepareWebState(state).learningV3.contextMastery[key];
  assert.equal(before.mastered, true);
  state.learningV3.reviewEvidence.push(event(104, "2026-09-02", { quality: 0, independent: false }), event(105, "2026-09-03", { kind: "recognition", quality: 3, independent: false }));
  const after = persistence.prepareWebState(state).learningV3.contextMastery[key];
  assert.deepEqual(after, before, "production and recognition are separate outcomes from delayed recall");
});

test("ambiguous reused evidence IDs fail closed rather than earning cross-context credit", () => {
  const first = preparedState(), second = preparedState();
  first.learningV3.reviewEvidence = [event(110, "2026-10-02")];
  second.learningV3.reviewEvidence = [event(110, "2026-10-02", { roleId: "finance-accounting" })];
  const malformed = preparedState(); malformed.learningV3.reviewEvidence = [...first.learningV3.reviewEvidence, ...second.learningV3.reviewEvidence];
  assert.equal(persistence.validateWebState(malformed), false);
  const snapshot = structuredClone(first);
  assert.throws(() => persistence.mergeWebStates(first, second));
  assert.deepEqual(first, snapshot, "a rejected merge cannot partially modify the existing learner");
});

test("a shared word remains available for an unseen professional context", async () => {
  const web = await load("lib/web-learning-ui.ts"), catalogue = await load("lib/professional-content.ts");
  const state = preparedState(); const roleId = "technology-engineering";
  const path = catalogue.professionalLearningPaths.find((path) => path.roleId === roleId);
  const sequence = path.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.wordIds));
  const sharedIndex = sequence.findIndex((id) => catalogue.professionalWords.find((word) => word.id === id).roles.includes("finance-accounting"));
  assert.ok(sharedIndex >= 0);
  const sharedId = sequence[sharedIndex];
  state.introducedWordIds = [sharedId];
  state.learningV3.contextIntroducedOn[persistence.contextEvidenceKey(sharedId, "finance-accounting")] = "2026-10-01";
  for (const id of sequence.slice(0, sharedIndex)) state.learningV3.contextIntroducedOn[persistence.contextEvidenceKey(id, roleId)] = "2026-10-01";
  assert.equal(web.roleDailyWords(state, roleId, 1)[0], sharedId, "global exposure must not skip a new role-specific sense");
  state.learningV3.contextIntroducedOn[persistence.contextEvidenceKey(sharedId, roleId)] = "2026-10-02";
  assert.ok(!web.roleDailyWords(state, roleId, 3).includes(sharedId));
});

test("starting placement changes the course sequence without awarding vocabulary mastery", async () => {
  const web = await load("lib/web-learning-ui.ts"), catalogue = await load("lib/professional-content.ts");
  const state = preparedState(); const path = catalogue.professionalLearningPaths.find((path) => path.roleId === state.profile.roleId);
  state.learningV3.placementsByRole[path.roleId] = { pathId: path.id, startingModuleId: path.modules[2].id, checkedAtISO: "2026-10-13T09:00:00Z", correctCount: 4, questionCount: 6 };
  assert.deepEqual(web.roleDailyWords(state, path.roleId, 2), path.modules[2].lessons[0].wordIds.slice(0, 2));
  assert.deepEqual(state.introducedWordIds, []);
  assert.deepEqual(state.learningV3.contextIntroducedOn, {});
  assert.deepEqual(state.learningV3.reviewEvidence, []);
  assert.deepEqual(persistence.prepareWebState(state).learningV3.contextMastery, {});
});

function guidedFixture(web) {
  const state = preparedState(), roleId = state.profile.roleId, date = "2026-10-13";
  const plan = web.makePlan(state, roleId, date); state.learningV3.rolePlans[plan.id] = plan;
  for (const wordId of plan.wordIds) plan.answers[wordId] = { choiceId: web.createTapChallenge(web.contextualWord(wordId, roleId), roleId).correctId, wrongChoiceIds: [], helped: true, completed: false };
  return { state, roleId, date, key: plan.id, plan };
}
function guidedInput(fixture, wordId, changes = {}) { return { key: fixture.key, roleId: fixture.roleId, date: fixture.date, currentDay: fixture.date, wordId, ...changes }; }

test("guided completion requires every assigned word and wraps back to skipped work", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = guidedFixture(web);
  const ids = fixture.plan.wordIds; assert.equal(ids.length, 3);
  fixture.plan.cursor = 1; // The learner paused the first card and resumed on the second.
  let state = web.completeGuidedWord(fixture.state, guidedInput(fixture, ids[1]));
  assert.equal(state.learningV3.rolePlans[fixture.key].cursor, 0, "resume must select an unfinished card instead of becoming stuck on a completed one");
  assert.equal(state.lessonStatus, "in_progress"); assert.equal(state.dailySessions.length, 0);
  state = web.completeGuidedWord(state, guidedInput(fixture, ids[0]));
  assert.equal(state.learningV3.rolePlans[fixture.key].cursor, 2);
  assert.equal(state.dailySessions.length, 0, "two of three words cannot complete the daily session");
  state = web.completeGuidedWord(state, guidedInput(fixture, ids[2]));
  assert.equal(state.lessonStatus, "completed"); assert.equal(state.dailySessions.length, 1);
  assert.deepEqual(state.dailySessions[0].wordIds, ids);
  const repeated = web.completeGuidedWord(state, guidedInput(fixture, ids[2]));
  assert.equal(repeated, state, "repeated Continue/navigation cannot award a second completion");
  const normalized = persistence.prepareWebState(state);
  for (const wordId of ids) {
    const context = normalized.learningV3.contextMastery[persistence.contextEvidenceKey(wordId, fixture.roleId)];
    assert.equal(context.nextReviewOn, "2026-10-14");
    assert.equal(context.reviewCount, 0);
    assert.equal(context.mastered, false);
    assert.deepEqual(context.productiveSuccessDates, []);
  }
  assert.ok(state.learningV3.reviewEvidence.every((event) => event.kind === "recognition" && event.independent === false));
  assert.equal(web.effortPoints(state), 50, "three guided words plus one day completion are effort, not mastery");
});

test("stale day, role, cursor and wrong answer actions cannot advance a saved plan", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = guidedFixture(web), first = fixture.plan.wordIds[0];
  assert.equal(web.completeGuidedWord(fixture.state, guidedInput(fixture, first, { currentDay: "2026-10-14" })), fixture.state);
  const roleChanged = { ...fixture.state, profile: profile("finance-accounting") };
  assert.equal(web.completeGuidedWord(roleChanged, guidedInput(fixture, first)), roleChanged);
  assert.equal(web.completeGuidedWord(fixture.state, guidedInput(fixture, fixture.plan.wordIds[1])), fixture.state);
  fixture.plan.answers[first].choiceId = "wrong-choice";
  assert.equal(web.completeGuidedWord(fixture.state, guidedInput(fixture, first)), fixture.state);
  assert.deepEqual(fixture.state.introducedWordIds, []);
  assert.equal(fixture.state.dailySessions.length, 0);
});

test("all eight courses offer deterministic, usable tap challenges with distinct choices", async () => {
  const web = await load("lib/web-learning-ui.ts"), catalogue = await load("lib/professional-content.ts");
  const formats = new Set();
  for (const path of catalogue.professionalLearningPaths) {
    for (const wordId of path.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.wordIds))) {
      const word = web.contextualWord(wordId, path.roleId), challenge = web.createTapChallenge(word, path.roleId);
      assert.equal(challenge.choices.length, 3, `${path.roleId}/${wordId}`);
      assert.equal(new Set(challenge.choices.map((choice) => choice.id)).size, 3);
      assert.equal(new Set(challenge.choices.map((choice) => choice.text)).size, 3);
      assert.equal(challenge.choices.filter((choice) => choice.id === challenge.correctId).length, 1);
      assert.ok(challenge.choices.every((choice) => choice.text.trim() && choice.explanation.trim()));
      assert.deepEqual(web.createTapChallenge(word, path.roleId), challenge, "resume must preserve choices and answer ordering");
      if (challenge.kind === "Sentence completion") assert.ok(challenge.context.includes("______"));
      formats.add(challenge.kind);
    }
  }
  assert.deepEqual([...formats].sort(), ["Meaning choice", "Sentence completion", "Spot incorrect guidance"]);
});

test("review queue respects current-role context and separate legacy review schedules", async () => {
  const web = await load("lib/web-learning-ui.ts"); const state = preparedState();
  const shared = "finance-rationale";
  state.masteryByWordId[shared] = engine.createWordMastery(shared, "2026-09-01");
  state.learningV3.contextIntroducedOn[persistence.contextEvidenceKey(shared, "finance-accounting")] = "2026-09-01";
  const normalized = persistence.prepareWebState(state);
  const current = web.reviewQueue(normalized, "2026-10-13", "technology-engineering");
  assert.ok(current.every((entry) => entry.roleId === "technology-engineering"));
  assert.ok(current.some((entry) => entry.word.id === shared && entry.legacy));
  const all = web.reviewQueue(normalized, "2026-10-13", "technology-engineering", true);
  assert.ok(all.some((entry) => entry.word.id === shared && entry.roleId === "finance-accounting" && entry.context));
  assert.notEqual(all.find((entry) => entry.roleId === "finance-accounting").word.meaning, all.find((entry) => entry.roleId === "technology-engineering").word.meaning);
});

test("learning days use the selected timezone at the midnight boundary", async () => {
  const web = await load("lib/web-learning-ui.ts"); const instant = new Date("2026-10-13T22:30:00Z");
  assert.equal(web.dayAt("Etc/UTC", instant), "2026-10-13");
  assert.equal(web.dayAt("Asia/Dubai", instant), "2026-10-14");
  assert.equal(web.dayAt("America/Los_Angeles", instant), "2026-10-13");
});


function dueReviewFixture() {
  const state = preparedState(); const wordId = "finance-rationale", roleId = state.profile.roleId, date = "2026-10-13";
  state.introducedWordIds = [wordId];
  state.masteryByWordId[wordId] = engine.createWordMastery(wordId, "2026-08-01");
  state.learningV3.contextIntroducedOn[persistence.contextEvidenceKey(wordId, roleId)] = "2026-08-01";
  state.learningV3.reviewEvidence = [event(201, "2026-08-02", { kind: "unaided-recall" }), event(202, "2026-08-10", { kind: "unaided-recall" }), event(203, "2026-09-01", { kind: "unaided-recall" })];
  return { state: persistence.prepareWebState(state), wordId, roleId, contextRole: roleId, date, currentDay: date };
}
function reviewInput(fixture, changes = {}) { return { roleId: fixture.roleId, contextRole: fixture.contextRole, date: fixture.date, currentDay: fixture.date, wordId: fixture.wordId, response: "The rationale for testing is to reduce costly rework.", quality: 2, meaningAttested: true, naturalnessAttested: true, ...changes }; }

test("a failed retrieval without the target schedules tomorrow and suspends current retention", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture();
  const key = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId);
  assert.equal(fixture.state.learningV3.contextMastery[key].mastered, true);
  for (const response of ["", "I cannot remember this expression today."]) {
    const draftState = structuredClone(fixture.state);
    draftState.learningV3.reviewDrafts[`${fixture.date}:${key}`] = { sentence: response, hinted: false, revealed: false };
    const applied = web.applyContextReview(draftState, reviewInput(fixture, { response, quality: 0, meaningAttested: false, naturalnessAttested: false }));
    assert.notEqual(applied, fixture.state, "Again records the failed recall even when the expression was forgotten");
    const saved = persistence.prepareWebState(applied), latest = saved.learningV3.reviewEvidence.at(-1);
    assert.equal(latest.kind, "unaided-recall"); assert.equal(latest.independent, false); assert.equal(latest.quality, 0);
    assert.equal(saved.learningV3.contextMastery[key].mastered, false);
    assert.equal(saved.learningV3.contextMastery[key].nextReviewOn, "2026-10-14");
    assert.ok(!web.reviewQueue(saved, fixture.date, fixture.roleId).some((entry) => entry.word.id === fixture.wordId));
    assert.equal(web.applyContextReview(saved, reviewInput(fixture, { response, quality: 0 })), saved, "saved failure cannot be replayed as a second review");
  }
});

test("supported review success is capped at Hard and cannot preserve independent mastery", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(); const key = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId);
  const hinted = structuredClone(fixture.state);
  hinted.learningV3.reviewDrafts[`${fixture.date}:${key}`] = { sentence: reviewInput(fixture).response, hinted: true, revealed: false };
  const captured = web.captureReviewResponse(hinted, reviewInput(fixture));
  const applied = web.applyContextReview(captured, reviewInput(fixture, { hinted: true, quality: 3 }));
  const saved = persistence.prepareWebState(applied), latest = saved.learningV3.reviewEvidence.at(-1);
  assert.equal(latest.kind, "unaided-recall"); assert.equal(latest.independent, false); assert.equal(latest.quality, 1);
  assert.equal(saved.learningV3.contextMastery[key].mastered, false);
  assert.deepEqual(saved.learningV3.contextMastery[key].productiveSuccessDates, fixture.state.learningV3.contextMastery[key].productiveSuccessDates);
  const exposed = structuredClone(fixture.state); exposed.learningV3.exposedOn[key] = fixture.date;
  const exposedSaved = persistence.prepareWebState(web.applyContextReview(exposed, reviewInput(fixture)));
  assert.equal(exposedSaved.learningV3.reviewEvidence.at(-1).independent, false, "support from another screen applies to review too");
});

test("successful independent review needs fresh use and attestations and rejects stale actions", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture();
  for (const changes of [{ response: "rationale" }, { response: "I cannot remember this expression today." }, { meaningAttested: false }, { naturalnessAttested: false }, { currentDay: "2026-10-14" }]) {
    assert.equal(web.applyContextReview(fixture.state, reviewInput(fixture, changes)), fixture.state);
  }
  const changedRole = { ...fixture.state, profile: profile("finance-accounting") };
  assert.equal(web.applyContextReview(changedRole, reviewInput(fixture)), changedRole);
  const captured = web.captureReviewResponse(fixture.state, reviewInput(fixture));
  const saved = persistence.prepareWebState(web.applyContextReview(captured, reviewInput(fixture)));
  const latest = saved.learningV3.reviewEvidence.at(-1);
  assert.equal(latest.kind, "unaided-recall"); assert.equal(latest.independent, true); assert.equal(latest.quality, 2);
  assert.equal(Object.hasOwn(latest, "response"), false);
  assert.equal(web.applyContextReview(saved, reviewInput(fixture)), saved);
});

test("partial guided days count toward the fifth-day and comeback activity anchors", async () => {
  const web = await load("lib/web-learning-ui.ts"); const state = preparedState();
  for (let day = 1; day <= 5; day++) {
    const date = `2026-10-${String(day).padStart(2, "0")}`, plan = web.makePlan(state, state.profile.roleId, date);
    plan.completedIds = [plan.wordIds[0]]; state.learningV3.rolePlans[plan.id] = plan;
  }
  assert.equal(state.dailySessions.length, 0, "this fixture deliberately never completed a full daily plan");
  assert.deepEqual(web.practiceDates(state), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
  const feature = await load("lib/expression-content.ts"), catalogue = await load("lib/professional-content.ts");
  const learnedWordIds = Object.values(state.learningV3.rolePlans).flatMap((plan) => plan.completedIds);
  const challenge = feature.getFifthDayChallenge({ date: "2026-10-05", activeDates: web.practiceDates(state), roleId: state.profile.roleId, learnedWordIds, catalogueWords: catalogue.professionalWords });
  assert.equal(challenge.due, true); assert.equal(challenge.activeDayCount, 5);
  const comeback = feature.buildComebackPlan({ date: "2026-10-06", lastActiveDate: web.practiceDates(state).at(-1), roleId: state.profile.roleId, learnedWordIds, catalogueWords: catalogue.professionalWords });
  assert.equal(comeback.suggested, false, "partial real practice yesterday must not trigger an inactivity comeback");
});


test("an eligible original response survives its own reveal, navigation and local reload", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(), input = reviewInput(fixture);
  const contextId = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId), key = `${fixture.date}:${contextId}`;
  const before = structuredClone(fixture.state);
  const captured = web.captureReviewResponse(fixture.state, input);
  assert.equal(captured.learningV3.reviewDrafts[key].originalResponse, input.response);
  assert.equal(captured.learningV3.reviewDrafts[key].originalIndependent, true);
  assert.equal(captured.learningV3.reviewDrafts[key].originalCapturedOn, fixture.date);
  assert.equal(captured.learningV3.exposedOn[contextId], fixture.date, "the reveal is tracked without changing pre-reveal eligibility");
  assert.equal(web.isFrozenReviewIndependent(captured, fixture.wordId, fixture.roleId, fixture.date), true);
  assert.deepEqual(fixture.state, before, "capture cannot mutate an already saved record");
  const reloaded = persistence.prepareWebState(JSON.parse(JSON.stringify(captured)));
  assert.equal(web.isFrozenReviewIndependent(reloaded, fixture.wordId, fixture.roleId, fixture.date), true);
  assert.equal(web.captureReviewResponse(reloaded, { ...input, response: "A replacement from the revealed model." }), reloaded, "the first captured response is immutable");
  const saved = persistence.prepareWebState(web.applyContextReview(reloaded, input));
  const latest = saved.learningV3.reviewEvidence.at(-1);
  assert.equal(latest.kind, "unaided-recall"); assert.equal(latest.independent, true); assert.equal(latest.quality, 2);
  assert.equal(saved.learningV3.contextMastery[contextId].lastReviewedOn, fixture.date);
  assert.equal(web.applyContextReview(saved, input), saved);
  assert.doesNotMatch(JSON.stringify(persistence.toCloudWebState(reloaded)), /The rationale for testing is to reduce costly rework/);
});

test("earlier hints, prior screen exposure and insufficient originals cannot be upgraded after reveal", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(), valid = reviewInput(fixture);
  const contextId = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId), key = `${fixture.date}:${contextId}`;
  const cases = [
    { sentence: valid.response, hinted: true, exposed: false },
    { sentence: valid.response, hinted: false, exposed: true },
    { sentence: "rationale", hinted: false, exposed: false },
  ];
  for (const item of cases) {
    const state = structuredClone(fixture.state);
    state.learningV3.reviewDrafts[key] = { sentence: item.sentence, hinted: item.hinted, revealed: false };
    if (item.exposed) state.learningV3.exposedOn[contextId] = fixture.date;
    const input = { ...valid, response: item.sentence };
    const captured = web.captureReviewResponse(state, input), reloaded = persistence.prepareWebState(JSON.parse(JSON.stringify(captured)));
    assert.equal(reloaded.learningV3.reviewDrafts[key].originalIndependent, false);
    assert.equal(web.isFrozenReviewIndependent(reloaded, fixture.wordId, fixture.roleId, fixture.date), false);
    if (item.sentence !== valid.response) assert.equal(web.applyContextReview(reloaded, valid), reloaded, "editing a short original into the model cannot earn credit");
    const saved = persistence.prepareWebState(web.applyContextReview(reloaded, { ...input, quality: 3 }));
    assert.equal(saved.learningV3.reviewEvidence.at(-1).independent, false);
    assert.equal(saved.learningV3.reviewEvidence.at(-1).quality, 1);
    assert.deepEqual(saved.learningV3.contextMastery[contextId].productiveSuccessDates, fixture.state.learningV3.contextMastery[contextId].productiveSuccessDates);
  }
});

test("legacy revealed drafts cannot manufacture a pre-reveal original or reset eligibility", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(), input = reviewInput(fixture);
  const contextId = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId), key = `${fixture.date}:${contextId}`;
  const old = structuredClone(fixture.state);
  old.learningV3.reviewDrafts[key] = { sentence: input.response, hinted: false, revealed: true };
  const reloaded = persistence.prepareWebState(JSON.parse(JSON.stringify(old)));
  assert.equal(web.captureReviewResponse(reloaded, input), reloaded);
  assert.equal(web.isFrozenReviewIndependent(reloaded, fixture.wordId, fixture.roleId, fixture.date), false);
  assert.equal(reloaded.learningV3.reviewDrafts[key].originalResponse, undefined);
  const saved = persistence.prepareWebState(web.applyContextReview(reloaded, { ...input, hinted: false, revealed: false, quality: 3 }));
  assert.equal(saved.learningV3.reviewEvidence.at(-1).independent, false, "caller flags cannot override persisted model exposure");
  assert.equal(saved.learningV3.reviewEvidence.at(-1).quality, 1);
});

test("frozen review evidence rejects changed text, stale dates and stale roles", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(), input = reviewInput(fixture);
  const contextId = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId), key = `${fixture.date}:${contextId}`;
  const captured = web.captureReviewResponse(fixture.state, input);
  assert.equal(web.applyContextReview(captured, { ...input, response: "The rationale for a different task uses the revealed example." }), captured);
  assert.equal(web.captureReviewResponse(fixture.state, { ...input, currentDay: "2026-10-14" }), fixture.state);
  const otherRole = { ...fixture.state, profile: profile("finance-accounting") };
  assert.equal(web.captureReviewResponse(otherRole, input), otherRole);
  const altered = structuredClone(captured); altered.learningV3.reviewDrafts[key].sentence = "The rationale is an edited answer after seeing support.";
  assert.equal(web.isFrozenReviewIndependent(altered, fixture.wordId, fixture.roleId, fixture.date), false);
  assert.equal(web.applyContextReview(altered, input), altered);
  const stale = structuredClone(captured); stale.learningV3.reviewDrafts[key].originalCapturedOn = "2026-10-12";
  assert.equal(web.isFrozenReviewIndependent(stale, fixture.wordId, fixture.roleId, fixture.date), false);
});

function reviewButton(html, label) {
  const matches = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)];
  const button = matches.find(([markup]) => markup.includes(`<b>${label}</b>`));
  assert.ok(button, `${label} review control should be rendered`);
  return button[0];
}
async function renderReview(state, fixture) {
  const component = await load("app/VocabularyApp.tsx");
  assert.equal(typeof component.Review, "function", "SSR must use the production review component");
  return renderToStaticMarkup(React.createElement(component.Review, { state, day: fixture.date, profile: state.profile, commit: () => false, scopeKey: "device:ssr-review-fixture" }));
}

test("actual review UI preserves self-assessment for a captured answer after reveal", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(), input = reviewInput(fixture);
  const hidden = await renderReview(fixture.state, fixture);
  assert.match(hidden, /Commit your response and reveal guidance before assessing it/);
  assert.doesNotMatch(hidden, /<fieldset class="self-assessment"/);
  const captured = persistence.prepareWebState(web.captureReviewResponse(fixture.state, input));
  const html = await renderReview(captured, fixture);
  assert.match(html, /<textarea[^>]*readOnly=""[^>]*>The rationale for testing is to reduce costly rework\.<\/textarea>/i);
  assert.match(html, /<fieldset class="self-assessment"/);
  assert.match(html, /My sentence uses the intended meaning correctly/);
  assert.match(html, /It sounds natural and appropriate for this audience/);
  assert.doesNotMatch(html, /This is supported practice|cannot earn independent recall credit/);
  assert.match(reviewButton(html, "Good"), /disabled=""/, "Good waits for the learner's two assessments");
  assert.doesNotMatch(reviewButton(html, "Hard"), /disabled=""/);
});

test("actual helped and legacy review UI locks the original and disables misleading Good controls", async () => {
  const web = await load("lib/web-learning-ui.ts"), fixture = dueReviewFixture(), input = reviewInput(fixture);
  const contextId = persistence.contextEvidenceKey(fixture.wordId, fixture.roleId), key = `${fixture.date}:${contextId}`;
  const hinted = structuredClone(fixture.state); hinted.learningV3.reviewDrafts[key] = { sentence: input.response, hinted: true, revealed: false };
  const legacy = structuredClone(fixture.state); legacy.learningV3.reviewDrafts[key] = { sentence: input.response, hinted: false, revealed: true };
  for (const state of [web.captureReviewResponse(hinted, input), legacy, web.captureReviewResponse(fixture.state, { ...input, response: "rationale" })]) {
    const html = await renderReview(persistence.prepareWebState(JSON.parse(JSON.stringify(state))), fixture);
    assert.match(html, /<textarea[^>]*readOnly=""/i);
    assert.doesNotMatch(html, /<fieldset class="self-assessment"/);
    assert.match(html, /This is supported practice\. Save Again or Hard to review it sooner/);
    for (const label of ["Good", "Easy"]) assert.match(reviewButton(html, label), /disabled=""/);
    for (const label of ["Again", "Hard"]) assert.doesNotMatch(reviewButton(html, label), /disabled=""/);
  }
});
