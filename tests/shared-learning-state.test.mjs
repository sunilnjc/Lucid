import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
const loadSource = async (name) => stripTypeScriptTypes(await readFile(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"));
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const professionalURL = url(await loadSource("professional-content"));
const expressionURL = url(await loadSource("expression-content"));
const idiomURL = url(await loadSource("daily-idioms"));
const dailyStateURL = url((await loadSource("daily-vocabulary-state"))
  .replace('from "./professional-content"', `from "${professionalURL}"`)
  .replace('from "./daily-idioms"', `from "${idiomURL}"`));
const webURL = url((await loadSource("web-learning-state")).replace('from "./daily-vocabulary-state"', `from "${dailyStateURL}"`));
const sharedURL = url((await loadSource("shared-learning-state")).replace('from "./professional-content"', `from "${professionalURL}"`).replace('from "./expression-content"', `from "${expressionURL}"`).replace('from "./web-learning-state"', `from "${webURL}"`));
const shared = await import(sharedURL), web = await import(webURL), professional = await import(professionalURL), expression = await import(expressionURL);
const role = "finance-accounting", date = "2026-10-13", stamp = `${date}T10:00:00.000Z`;
const id1 = "30000000-0000-4000-8000-000000000001", id2 = "30000000-0000-4000-8000-000000000002";
const defaults = { version: 3, profile: { roleId: role, seniorityId: "experienced-contributor", situationIds: [], goalIds: ["clarify"] }, settings: { lessonTime: "09:00", timeZone: "Etc/UTC", dailyWordCount: 3 }, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], favouriteIds: [], difficultIds: [], reviewedIds: [], completedDays: [], quizAttempts: [] };
const fresh = () => { const state = web.prepareWebState(defaults); state.learningV3.updatedAt = stamp; return state; };
const empty = () => ({ version: 1, lessonCheckpoints: {}, startingChecks: {}, notebook: {}, rehearsals: {}, challenges: {}, exposures: {} });
const practiceContent = expression.getExpressionPracticeContent(professional.professionalWords);
const authored = practiceContent.expressions.find((e) => e.id === "bridge-the-difference");
const scenario = practiceContent.scenarios.find((e) => e.expressionId === authored.id && e.roleIds.includes(role));
const plan = () => ({ roleId: role, dayKey: date, wordIds: ["finance-reconcile", "finance-rationale"], completedWordIds: [], cursorWordId: "finance-reconcile", answers: {}, updatedAt: stamp });
const note = () => ({ id: id1, roleId: role, expressionId: authored.id, style: "precise", phrase: authored.precise, createdAt: stamp, nextReviewOn: "2026-10-14" });
const rehearsal = () => ({ id: id2, roleId: role, scenarioId: scenario.id, expressionId: authored.id, mode: "initial", startedAt: stamp, completedAt: "2026-10-13T10:10:00.000Z", modelSeen: true });

test("canonical projection retains legacy schedules and placements, excludes every private root/sidecar", () => {
  const state = fresh(); state.introducedWordIds = ["finance-reconcile"];
  state.masteryByWordId["finance-reconcile"] = { wordId: "finance-reconcile", introducedOn: "2026-10-01", intervalIndex: 1, intervalDays: 3, nextReviewOn: "2026-10-15", reviewCount: 1, lapses: 0, productiveSuccessDates: [], mastered: false };
  state.learningV3.nativeCompanion = { schemaVersion: 2, practiceDrafts: { word: "PRIVATE response" }, displayName: "Guest", studioDrafts: { one: "PRIVATE" }, portableWebCompanion: { note: "PRIVATE" } };
  state.learningV3.reviewDrafts.word = { sentence: "PRIVATE", hinted: false, revealed: false }; state.usageAttempts = { word: "PRIVATE spoken" };
  const cloud = shared.webToSharedCloudState(state); assert.equal(shared.validateSharedCloudState(cloud), true); assert.equal(JSON.stringify(cloud).includes("PRIVATE"), false); assert.equal("webLearningBackup" in cloud, false); assert.equal(cloud.progressByWordId["finance-reconcile"].nextReviewOn, web.isoToFoundationDate("2026-10-15T12:00:00Z"));
  const back = shared.sharedCloudStateToWeb(cloud, fresh(), defaults); assert.equal(back.masteryByWordId["finance-reconcile"].nextReviewOn, "2026-10-15"); assert.deepEqual(back.introducedWordIds, state.introducedWordIds);
});

test("shared authored notebook and text-free rehearsal histories hydrate the actual workspace while private local writing survives", () => {
  const local = fresh(); local.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { [role]: { version: 1, roleId: role, intent: "PRIVATE real situation", response: "PRIVATE unfinished", notebook: [] } } });
  const incoming = shared.webToSharedCloudState(fresh()); incoming.sharedLearning.notebook[id1] = note(); incoming.sharedLearning.rehearsals[id2] = rehearsal();
  const back = shared.sharedCloudStateToWeb(incoming, local, defaults), workspace = JSON.parse(back.learningV3.expressionDraft).workspaces[role];
  assert.equal(workspace.intent, "PRIVATE real situation"); assert.equal(workspace.response, "PRIVATE unfinished"); assert.equal(workspace.notebook[0].phrase, authored.precise); assert.equal(workspace.notebook[0].variant, "precise"); assert.equal(workspace.rehearsalHistory[0].scenarioId, scenario.id); assert.equal(workspace.pendingCheckpoints[0].dueOn, "2026-10-14");
  const roundTrip = shared.webToSharedCloudState(back); assert.equal(JSON.stringify(roundTrip).includes("PRIVATE"), false); assert.equal(roundTrip.sharedLearning.notebook[id1].phrase, authored.precise); assert.equal(roundTrip.sharedLearning.rehearsals[id2].completedAt, rehearsal().completedAt);
});

test("web notebook, interrupted starting check, tap cursor and hints derive into canonical safe metadata", () => {
  const state = fresh(), path = professional.professionalLearningPaths.find((p) => p.roleId === role);
  state.learningV3.rolePlans[`${date}:${role}`] = { id: "localplan", date, roleId: role, wordIds: ["finance-reconcile"], completedIds: [], cursor: 0, answers: { "finance-reconcile": { choiceId: "answer-1", wrongChoiceIds: [], completed: false, helped: true } }, createdAt: stamp };
  state.learningV3.startingCheckDrafts[role] = { pathId: path.id, signature: JSON.stringify(path.startingCheck), answers: [0, -1], updatedAt: stamp };
  state.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { [role]: { version: 1, roleId: role, notebook: [{ id: id1, expressionId: authored.id, variant: "precise", phrase: authored.precise, intent: "PRIVATE", createdOn: date }] } } });
  const cloud = shared.webToSharedCloudState(state); assert.equal(cloud.sharedLearning.lessonCheckpoints[`${date}:${role}`].answers["finance-reconcile"].hinted, true); assert.deepEqual(cloud.sharedLearning.startingChecks[role].answers, [0, -1]); assert.equal(cloud.sharedLearning.notebook[id1].phrase, authored.precise);
  const back = shared.sharedCloudStateToWeb(cloud, fresh(), defaults); assert.equal(back.learningV3.rolePlans[`${date}:${role}`].answers["finance-reconcile"].helped, true); assert.equal(back.learningV3.startingCheckDrafts[role].signature, JSON.stringify(path.startingCheck));
});

test("simultaneous matching daily plans union completions and hint exposure; conflicting plans retain the earlier stable plan", () => {
  const a = empty(), b = empty(), key = `${date}:${role}`; a.lessonCheckpoints[key] = { ...plan(), completedWordIds: ["finance-reconcile"], answers: { "finance-rationale": { choiceId: "one", hinted: true } } }; b.lessonCheckpoints[key] = { ...plan(), completedWordIds: ["finance-rationale"], cursorWordId: "finance-rationale", answers: { "finance-rationale": { choiceId: "two", hinted: false } }, updatedAt: "2026-10-13T11:00:00Z" };
  const merged = shared.mergeSharedLearning(a, b); assert.equal(merged.lessonCheckpoints[key].completedWordIds.length, 2); assert.equal(merged.lessonCheckpoints[key].answers["finance-rationale"].hinted, true); assert.equal(merged.lessonCheckpoints[key].cursorWordId, "finance-rationale");
  b.lessonCheckpoints[key] = { ...b.lessonCheckpoints[key], wordIds: ["finance-rationale"], completedWordIds: [], answers: {} }; assert.deepEqual(shared.mergeSharedLearning(a, b).lessonCheckpoints[key].wordIds, plan().wordIds);
});

test("offline challenge fragments can complete once without granting word or review evidence", () => {
  const next = practiceContent.scenarios.find((s) => s.roleIds.includes(role) && s.id !== scenario.id), a = empty(), b = empty(), challenge = { id: `transfer:${role}:5`, roleId: role, mode: "transfer", milestone: 5, startedAt: stamp, scenarioIds: [scenario.id, next.id], completedScenarioIds: [scenario.id] };
  a.challenges[challenge.id] = challenge; b.challenges[challenge.id] = { ...challenge, completedScenarioIds: [next.id] }; const merged = shared.mergeSharedLearning(a, b); assert.equal(merged.challenges[challenge.id].completedScenarioIds.length, 2); assert.equal(merged.challenges[challenge.id].completedAt, stamp); assert.deepEqual(merged.rehearsals, {});
  const canonical = shared.webToSharedCloudState(fresh()); canonical.sharedLearning = merged; const back = shared.sharedCloudStateToWeb(canonical, fresh()); assert.equal(JSON.parse(back.learningV3.expressionDraft).workspaces[role].completedChallengeCounts[0], 5); assert.deepEqual(back.learningV3.reviewEvidence, []);
});

test("immutable evidence ID collisions reject; repeated sync and same-day weaker evidence cannot inflate mastery", () => {
  const state = fresh(); state.learningV3.contextIntroducedOn[`finance-reconcile::${role}`] = "2026-09-01";
  state.learningV3.reviewEvidence = [web.makeReviewEvidence({ id: id1, wordId: "finance-reconcile", roleId: role, date, recordedAtISO: stamp, kind: "unaided-recall", quality: 3, independent: true, response: "We reconcile both reports before closing the period." })];
  const a = shared.webToSharedCloudState(state), b = structuredClone(a); b.contextEvidence[0].quality = 0;
  const merged = shared.mergeSharedCloudStates(a, b); assert.equal(merged.contextEvidence.length, 1); assert.equal(merged.contextEvidence[0].quality, 0); assert.equal(shared.sharedCloudStateToWeb(merged, fresh()).learningV3.contextMastery[`finance-reconcile::${role}`].mastered, false);
  assert.deepEqual(shared.mergeSharedCloudStates(merged, merged), merged);
  b.contextEvidence[0].wordId = "finance-rationale"; b.contextEvidence[0].senseId = `finance-rationale::${role}`; assert.throws(() => shared.mergeSharedCloudStates(a, b), /Conflicting immutable/);
});

test("earlier model exposure on another client caps independent evidence but a captured original before exposure remains independent", () => {
  const state = fresh(), sense = `finance-reconcile::${role}`; state.learningV3.reviewEvidence = [web.makeReviewEvidence({ id: id1, wordId: "finance-reconcile", roleId: role, date, recordedAtISO: "2026-10-13T10:15:00Z", capturedAtISO: "2026-10-13T10:00:00Z", kind: "unaided-recall", quality: 3, independent: true, response: "We reconcile the accounts before completing this review." })];
  const a = shared.webToSharedCloudState(state), b = shared.webToSharedCloudState(fresh()); b.sharedLearning.exposures[sense] = { dayKey: date, firstSeenAt: "2026-10-13T10:05:00Z" };
  assert.equal(shared.mergeSharedCloudStates(a, b).contextEvidence[0].independent, true); b.sharedLearning.exposures[sense].firstSeenAt = "2026-10-13T09:55:00Z";
  const capped = shared.mergeSharedCloudStates(a, b).contextEvidence[0]; assert.equal(capped.independent, false); assert.equal(capped.quality, 1);
});

test("strict shared cloud validation rejects arbitrary learner text, spoofed authored phrases, unknown nested fields and future timestamps", () => {
  const cloud = shared.webToSharedCloudState(fresh()); cloud.sharedLearning.notebook[id1] = note(); assert.equal(shared.validateSharedCloudState(cloud), true);
  cloud.sharedLearning.notebook[id1].phrase = "My personal medical situation"; assert.equal(shared.validateSharedCloudState(cloud), false); cloud.sharedLearning.notebook[id1] = note(); cloud.sharedLearning.notebook[id1].intent = "PRIVATE"; assert.equal(shared.validateSharedCloudState(cloud), false); delete cloud.sharedLearning.notebook[id1].intent;
  cloud.practiceDrafts = { text: "PRIVATE" }; assert.equal(shared.validateSharedCloudState(cloud), false); delete cloud.practiceDrafts;
  cloud.sharedLearning.notebook[id1].createdAt = "2100-01-01T00:00:00Z"; assert.equal(shared.validateSharedCloudState(cloud), false);
});

test("old client omissions preserve selected notebook, shared checkpoints, activities and safe native history", () => {
  const a = shared.webToSharedCloudState(fresh()), b = shared.webToSharedCloudState(fresh()); a.sharedLearning.notebook[id1] = note(); a.activities = [{ id: id2, kind: "practice", wordId: "finance-reconcile", date: web.isoToFoundationDate(stamp), dayKey: date, quality: 0, productive: false }]; delete b.sharedLearning; delete b.activities;
  const merged = shared.mergeSharedCloudStates(a, b); assert.equal(merged.sharedLearning.notebook[id1].phrase, authored.precise); assert.equal(merged.activities.length, 1);
  const local = shared.sharedCloudStateToWeb(merged, fresh()); const reencoded = shared.webToSharedCloudState(local); assert.deepEqual(reencoded.activities, merged.activities);
});

test("shared UUID normalization and immutable notebook/rehearsal identity prevent duplicate rows or hidden reassignment", () => {
  const a = empty(), b = empty(); a.notebook[id1] = note(); b.notebook[id1.toUpperCase()] = { ...note(), id: id1.toUpperCase() }; assert.equal(Object.keys(shared.mergeSharedLearning(a, b).notebook).length, 1);
  b.notebook[id1.toUpperCase()].style = "plain"; b.notebook[id1.toUpperCase()].phrase = authored.plain; assert.throws(() => shared.mergeSharedLearning(a, b), /immutable/);
  b.notebook = {}; a.rehearsals[id2] = rehearsal(); b.rehearsals[id2] = { ...rehearsal(), modelSeen: false }; assert.equal(shared.mergeSharedLearning(a, b).rehearsals[id2].modelSeen, true);
});


test("PostgreSQL JSONB key order and Codable optional nil do not create false immutable activity conflicts", () => {
  const a = shared.webToSharedCloudState(fresh()), b = shared.webToSharedCloudState(fresh());
  a.activities = [{ id: id2, kind: "lesson", date: web.isoToFoundationDate(stamp), dayKey: date, quality: 2, productive: true }];
  b.activities = [{ productive: true, quality: 2, dayKey: date, date: web.isoToFoundationDate(stamp), kind: "lesson", id: id2.toUpperCase(), wordId: null }];
  assert.equal(shared.mergeSharedCloudStates(a, b).activities.length, 1);
});

test("legacy larger lessons and local-day anchors survive while future outcome timestamps fail", () => {
  const state = fresh(), today = new Date().toISOString().slice(0, 10);
  state.dailySessions = [{ id: "legacy-ten-words", date: today, roleId: role, situationId: "meeting", wordIds: professional.professionalWords.filter((w) => w.roles.includes(role)).slice(0, 10).map((w) => w.id), completedAt: new Date().toISOString() }];
  const canonical = shared.webToSharedCloudState(state); assert.equal(canonical.sessions[0].wordIds.length, 10);
  canonical.sessions[0].completedAt = web.isoToFoundationDate("2100-01-01T00:00:00Z"); assert.equal(shared.validateSharedCloudState(canonical), false);
});

test("bookmark removals and guided/review effort events survive canonical reencoding without repeated credit IDs", () => {
  const incoming = shared.webToSharedCloudState(fresh()); incoming.favouriteWordIds = ["finance-reconcile"]; incoming.favouriteChanges = { "finance-reconcile": { selected: false, updatedAt: web.isoToFoundationDate(stamp) } };
  const back = shared.sharedCloudStateToWeb(incoming, fresh()); assert.equal(back.favouriteIds.includes("finance-reconcile"), false); assert.equal(shared.webToSharedCloudState(back).favouriteChanges["finance-reconcile"].selected, false);
  const state = fresh(); state.learningV3.rolePlans[`${date}:${role}`] = { id: `${date}:${role}`, date, roleId: role, wordIds: ["finance-reconcile"], completedIds: ["finance-reconcile"], cursor: 0, answers: {}, createdAt: stamp };
  const first = shared.webToSharedCloudState(state), again = shared.webToSharedCloudState(shared.sharedCloudStateToWeb(first, fresh()));
  assert.equal(first.activities.filter((x) => x.kind === "practice").length, 1); assert.equal(new Set(again.activities.map((x) => x.id)).size, again.activities.length); assert.equal(again.activities.filter((x) => x.kind === "practice").length, 1);
});


test("reconnecting remote snapshots preserve unsynced local completions, cursor and selected authored notes", () => {
  const remote = shared.webToSharedCloudState(fresh()), local = fresh(), key = `${date}:${role}`;
  remote.sharedLearning.lessonCheckpoints[key] = plan();
  local.learningV3.rolePlans[key] = { id: key, date, roleId: role, wordIds: plan().wordIds, completedIds: ["finance-reconcile"], cursor: 1, answers: {}, createdAt: stamp };
  local.learningV3.updatedAt = "2026-10-13T11:00:00Z";
  local.learningV3.expressionDraft = JSON.stringify({ version: 2, workspaces: { [role]: { version: 1, roleId: role, notebook: [{ id: id1, expressionId: authored.id, variant: "precise", phrase: authored.precise, intent: "PRIVATE", createdOn: date }] } } });
  const merged = shared.sharedCloudStateToWeb(remote, local); assert.deepEqual(merged.learningV3.rolePlans[key].completedIds, ["finance-reconcile"]); assert.equal(merged.learningV3.rolePlans[key].cursor, 1); assert.equal(merged.learningV3.sharedLearning.notebook[id1].phrase, authored.precise);
});

test("native sub-millisecond Foundation evidence timestamps retain their immutable numeric representation", () => {
  const native = shared.webToSharedCloudState(fresh()); native.contextEvidence = [{ id: id1, wordId: "finance-reconcile", roleId: role, senseId: `finance-reconcile::${role}`, date, recordedAt: web.isoToFoundationDate(stamp) + 0.000456, capturedAt: web.isoToFoundationDate(stamp) - 0.000321, kind: "unaided-recall", quality: 2, independent: true }];
  const back = shared.sharedCloudStateToWeb(native, fresh()); const next = shared.webToSharedCloudState(back);
  assert.equal(next.contextEvidence[0].recordedAt, native.contextEvidence[0].recordedAt); assert.equal(next.contextEvidence[0].capturedAt, native.contextEvidence[0].capturedAt); assert.equal(shared.mergeSharedCloudStates(native, next).contextEvidence.length, 1);
});


test("native immutable session shape and sub-millisecond dates round-trip without forged replacement", () => {
  const native = shared.webToSharedCloudState(fresh()); native.sessions = [{ id: id2.toUpperCase(), date: web.isoToFoundationDate("2026-10-13T00:00:00Z") + 0.000456, wordIds: ["finance-reconcile"], completedAt: web.isoToFoundationDate(stamp) + 0.000789 }];
  const back = shared.sharedCloudStateToWeb(native, fresh()), next = shared.webToSharedCloudState(back);
  assert.equal(next.sessions[0].date, native.sessions[0].date); assert.equal(next.sessions[0].completedAt, native.sessions[0].completedAt); assert.equal("dayKey" in next.sessions[0], false); assert.equal(shared.mergeSharedCloudStates(native, next).sessions.length, 1);
});


test("equal timestamps converge deterministically for conflicting checkpoint answers and cursors in either merge order", () => {
  const a = empty(), b = empty(), key = `${date}:${role}`, path = professional.professionalLearningPaths.find((p) => p.roleId === role);
  a.lessonCheckpoints[key] = { ...plan(), cursorWordId: "finance-reconcile", answers: { "finance-reconcile": { choiceId: "one", hinted: false } } }; b.lessonCheckpoints[key] = { ...plan(), cursorWordId: "finance-rationale", answers: { "finance-reconcile": { choiceId: "two", hinted: false } } };
  a.startingChecks[role] = { roleId: role, pathId: path.id, questionIds: path.startingCheck.map((q) => q.id), answers: [0], updatedAt: stamp }; b.startingChecks[role] = { ...a.startingChecks[role], answers: [1] };
  assert.deepEqual(shared.mergeSharedLearning(a, b), shared.mergeSharedLearning(b, a));
});


test("Help before choosing an answer syncs exposure and resumes safely without an invented choice", () => {
  const state = fresh(), key = `${date}:${role}`;
  state.learningV3.rolePlans[key] = { id: key, date, roleId: role, wordIds: ["finance-reconcile"], completedIds: [], cursor: 0, answers: { "finance-reconcile": { choiceId: "", wrongChoiceIds: [], completed: false, helped: true } }, createdAt: stamp };
  const canonical = shared.webToSharedCloudState(state); assert.equal(canonical.sharedLearning.lessonCheckpoints[key].answers["finance-reconcile"], undefined); assert.equal(canonical.sharedLearning.exposures[`finance-reconcile::${role}`].dayKey, date);
  const back = shared.sharedCloudStateToWeb(canonical, fresh()); assert.equal(back.learningV3.rolePlans[key].answers["finance-reconcile"].helped, true); assert.equal(back.learningV3.rolePlans[key].answers["finance-reconcile"].choiceId, ""); assert.equal(shared.validateSharedCloudState(shared.webToSharedCloudState(back)), true);
});


test("later completed notebook practice advances its reminder; matching practice timestamps preserve the earlier due date", () => {
  const a = empty(), b = empty(); a.notebook[id1] = note(); b.notebook[id1] = { ...note(), lastPractisedAt: "2026-10-13T11:00:00Z", nextReviewOn: "2026-10-20" };
  assert.equal(shared.mergeSharedLearning(a, b).notebook[id1].nextReviewOn, "2026-10-20"); assert.deepEqual(shared.mergeSharedLearning(a, b), shared.mergeSharedLearning(b, a));
  a.notebook[id1].lastPractisedAt = "2026-10-13T11:00:00.000Z"; assert.equal(shared.mergeSharedLearning(a, b).notebook[id1].nextReviewOn, "2026-10-14");
});


test("hydrated real rehearsal history is not duplicated by its legacy pending-checkpoint projection", () => {
  const native = shared.webToSharedCloudState(fresh()); native.sharedLearning.rehearsals[id2] = rehearsal();
  const local = shared.sharedCloudStateToWeb(native, fresh()); assert.equal(Object.keys(shared.webToSharedCloudState(local).sharedLearning.rehearsals).length, 1);
  const next = shared.sharedCloudStateToWeb(shared.webToSharedCloudState(local), local); assert.equal(Object.keys(shared.webToSharedCloudState(next).sharedLearning.rehearsals).length, 1);
});


test("legacy native local-midnight global schedules use the learner timezone while contextual noon anchors stay UTC", () => {
  const local = fresh(); local.settings.timeZone = "Asia/Dubai";
  const native = shared.webToSharedCloudState(local), midnight = web.isoToFoundationDate("2026-10-13T20:00:00Z");
  native.progressByWordId["finance-reconcile"] = { introducedOn: midnight, intervalIndex: 0, nextReviewOn: midnight, lastReviewedOn: midnight, reviewCount: 1, successfulReviewDates: [midnight], lapses: 0, mastered: false };
  native.contextIntroducedOn = { [`finance-reconcile::${role}`]: web.isoToFoundationDate("2026-10-13T12:00:00Z") };
  native.sessions = [{ id: id2, date: midnight, wordIds: ["finance-reconcile"], completedAt: web.isoToFoundationDate("2026-10-13T21:00:00Z") }];
  const back = shared.sharedCloudStateToWeb(native, local), next = shared.webToSharedCloudState(back);
  assert.equal(back.masteryByWordId["finance-reconcile"].nextReviewOn, "2026-10-14"); assert.equal(back.masteryByWordId["finance-reconcile"].productiveSuccessDates[0], "2026-10-14"); assert.equal(back.dailySessions[0].date, "2026-10-14"); assert.equal(back.learningV3.contextIntroducedOn[`finance-reconcile::${role}`], "2026-10-13"); assert.equal(next.progressByWordId["finance-reconcile"].nextReviewOn, midnight); assert.equal(next.sessions[0].date, midnight);
});

test("missing capture proof cannot be added to an old evidence UUID and later capture wins conflicts", () => {
  const base = shared.webToSharedCloudState(fresh()), sense = `finance-reconcile::${role}`;
  base.contextEvidence = [{ id: id1, wordId: "finance-reconcile", roleId: role, senseId: sense, date, recordedAt: web.isoToFoundationDate("2026-10-13T10:30:00Z"), kind: "unaided-recall", quality: 3, independent: true }];
  base.sharedLearning.exposures[sense] = { dayKey: date, firstSeenAt: "2026-10-13T10:10:00Z" };
  const edited = structuredClone(base); edited.contextEvidence[0].capturedAt = web.isoToFoundationDate("2026-10-13T10:00:00Z");
  const merged = shared.mergeSharedCloudStates(base, edited); assert.equal(merged.contextEvidence[0].capturedAt, undefined); assert.equal(merged.contextEvidence[0].independent, false);
  base.contextEvidence[0].capturedAt = web.isoToFoundationDate("2026-10-13T10:20:00Z"); assert.equal(shared.mergeSharedCloudStates(base, edited).contextEvidence[0].capturedAt, base.contextEvidence[0].capturedAt);
});

test("legacy identical session IDs merge earliest completion but conflicting period or word identities reject", () => {
  const a = shared.webToSharedCloudState(fresh()), b = shared.webToSharedCloudState(fresh());
  const session = { id: id2, date: web.isoToFoundationDate(`${date}T12:00:00Z`), dayKey: date, wordIds: ["finance-reconcile"], completedAt: web.isoToFoundationDate(`${date}T13:00:00Z`) };
  a.sessions = [session]; b.sessions = [{ ...session, completedAt: web.isoToFoundationDate(`${date}T14:00:00Z`) }]; assert.equal(shared.mergeSharedCloudStates(a, b).sessions[0].completedAt, session.completedAt);
  b.sessions[0].wordIds = ["finance-rationale"]; assert.throws(() => shared.mergeSharedCloudStates(a, b), /immutable/);
});

test("canonical temporal validators reject mismatched learning days and capture proof from an old original", () => {
  const value = shared.webToSharedCloudState(fresh()); value.contextEvidence = [{ id: id1, wordId: "finance-reconcile", roleId: role, senseId: `finance-reconcile::${role}`, date: "2026-10-01", recordedAt: web.isoToFoundationDate(stamp), kind: "unaided-recall", quality: 2, independent: true }]; assert.equal(shared.validateSharedCloudState(value), false);
  value.contextEvidence[0].date = date; value.contextEvidence[0].capturedAt = web.isoToFoundationDate("2026-10-01T10:00:00Z"); assert.equal(shared.validateSharedCloudState(value), false);
});

test("legacy mastery milestones remain in private backups without becoming new shared recall proof", () => {
  const local = fresh(); local.masteryByWordId["finance-reconcile"] = { introducedOn: "2026-09-01", nextReviewOn: "2026-10-14", intervalIndex: 4, reviewCount: 3, lapses: 0, productiveSuccessDates: ["2026-09-02", "2026-09-08", "2026-10-02"], mastered: true };
  const native = shared.webToSharedCloudState(local); native.progressByWordId["finance-reconcile"].mastered = false;
  const back = shared.sharedCloudStateToWeb(native, local); assert.equal(back.masteryByWordId["finance-reconcile"].mastered, false); assert.deepEqual(back.learningV3.nativeCompanion.historicalMasteredWordIds, ["finance-reconcile"]); assert.equal("historicalMasteredWordIds" in shared.webToSharedCloudState(back), false); assert.deepEqual(web.exportPortableBackup(back).learner.historicalMasteredWordIds, ["finance-reconcile"]);
});


test("native contextual anchor timestamps survive round-trip while retaining the same logical calendar day", () => {
  const native = shared.webToSharedCloudState(fresh()), sense = `finance-reconcile::${role}`;
  native.contextIntroducedOn[sense] = web.isoToFoundationDate("2026-09-01T08:25:19.123Z") + 0.000456;
  const back = shared.sharedCloudStateToWeb(native, fresh()), next = shared.webToSharedCloudState(back);
  assert.equal(back.learningV3.contextIntroducedOn[sense], "2026-09-01"); assert.equal(next.contextIntroducedOn[sense], native.contextIntroducedOn[sense]);
});

test("a real delayed completion preserves linked notebook reminder without synthetic initial rehearsal duplicates", () => {
  const native = shared.webToSharedCloudState(fresh()); native.sharedLearning.notebook[id1] = { ...note(), lastPractisedAt: "2026-10-13T11:00:00Z", nextReviewOn: "2026-10-20" };
  native.sharedLearning.rehearsals[id2] = { ...rehearsal(), mode: "delayed", gapId: id1 };
  const back = shared.sharedCloudStateToWeb(native, fresh()); const workspace = JSON.parse(back.learningV3.expressionDraft).workspaces[role];
  assert.equal(workspace.pendingCheckpoints.some((p) => p.dueOn === "2026-10-20" && p.scenarioId === scenario.id && p.gapId === id1), true);
  const projected = shared.webToSharedCloudState(back); assert.equal(Object.keys(projected.sharedLearning.rehearsals).length, 1); assert.equal(projected.sharedLearning.rehearsals[id2].mode, "delayed");
});

test("frozen review timestamps validate locally and survive private backup without cloud text", () => {
  const state = fresh(); state.learningV3.reviewDrafts["finance-reconcile"] = { sentence: "PRIVATE original", hinted: false, revealed: true, originalCapturedOn: date, originalCapturedAtISO: stamp, originalIndependent: true };
  assert.equal(web.validateWebState(state), true); const restored = web.importPortableBackup(web.exportPortableBackup(state), fresh()); assert.equal(restored.learningV3.reviewDrafts["finance-reconcile"].originalCapturedAtISO, stamp);
  state.learningV3.reviewDrafts["finance-reconcile"].originalCapturedAtISO = "invalid"; assert.equal(web.validateWebState(state), false);
});


test("shared cloud settings match native defaults while local reminder and speech preferences survive hydration", () => {
  const state = fresh(); state.settings.lessonTime = "06:20"; state.settings.notificationsEnabled = true; state.settings.audioRate = 0.7;
  const cloud = shared.webToSharedCloudState(state); assert.deepEqual(cloud.settings, { notificationsEnabled: false, reminderHour: 9, reminderMinute: 0, speechRate: 0.46 });
  const back = shared.sharedCloudStateToWeb(cloud, state); assert.equal(back.settings.lessonTime, "06:20"); assert.equal(back.settings.notificationsEnabled, true); assert.equal(back.settings.audioRate, 0.7);
  const portable = web.exportPortableBackup(state); assert.equal(portable.learner.settings.reminderHour, 6); assert.equal(portable.learner.settings.notificationsEnabled, true);
});
