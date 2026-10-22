import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import ts from 'typescript';
import { createSharedPostgresFixture } from '../scripts/shared-postgres-fixture.mjs';
import { createSyntheticSharedBackend, SYNTHETIC_LEARNERS, SYNTHETIC_PUBLIC_KEY } from '../scripts/shared-backend-harness.mjs';

const root = new URL('../', import.meta.url);
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const foundation = (date) => Date.parse(date) / 1000 - 978307200;
function minimalNativeState() {
  return { schemaVersion: 2, introducedWordIds: [], progressByWordId: {}, sessions: [], favouriteWordIds: [], completedWordIdsToday: [], currentWordIds: [], settings: { notificationsEnabled: false, reminderHour: 9, reminderMinute: 0, speechRate: 0.46 }, reviewPromptMilestone: 0 };
}
function minimalWebState() {
  return { version: 2, introducedWordIds: [], masteryByWordId: {}, dailySessions: [], usageAttempts: {}, lessonStatus: 'not_started', lessonWordProgress: 0, completedDays: [], difficultIds: [], favouriteIds: [], reviewedIds: [], masteryScores: {}, reviewDates: {}, nextReviewAt: {}, exerciseAnswers: {}, quizAnswers: {}, quizAttempts: [], settings: { lessonTime: '09:00', timeZone: 'UTC', notificationsEnabled: false, dailyWordCount: 3 } };
}

async function productionModuleLoader(directory, environment) {
  const cache = new Map();
  globalThis.__lucidSharedBackendTestEnvironment = environment;
  const workerPath = join(directory, 'cloudflare-worker-env.mjs');
  await writeFile(workerPath, 'export const env = globalThis.__lucidSharedBackendTestEnvironment;');
  async function moduleURL(relative) {
    if (!cache.has(relative)) cache.set(relative, (async () => {
      const sourceURL = new URL(relative, root);
      const source = await readFile(sourceURL, 'utf8');
      let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: relative });
      const parsed = ts.createSourceFile(relative, outputText, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS), edits = [];
      for (const statement of parsed.statements) {
        const specifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier)) continue;
        const name = specifier.text;
        let url;
        if (name === 'cloudflare:workers') url = pathToFileURL(workerPath).href;
        else if (!name.startsWith('.') && !name.startsWith('@/')) url = import.meta.resolve(name);
        else {
          let dependency = name.startsWith('@/') ? new URL(name.slice(2), root) : new URL(name, sourceURL);
          if (!/\.[cm]?[jt]sx?$/.test(dependency.pathname)) {
            try { await readFile(new URL(dependency.href + '.ts'), 'utf8'); dependency = new URL(dependency.href + '.ts'); }
            catch (error) { if (error.code !== 'ENOENT') throw error; dependency = new URL(dependency.href + '/index.ts'); }
          }
          url = await moduleURL(dependency.pathname.slice(root.pathname.length));
        }
        edits.push({ start: specifier.getStart(parsed), end: specifier.end, value: JSON.stringify(url) });
      }
      for (const edit of edits.sort((a, b) => b.start - a.start)) outputText = outputText.slice(0, edit.start) + edit.value + outputText.slice(edit.end);
      const path = join(directory, relative.replaceAll('/', '_') + '.mjs');
      await writeFile(path, outputText); return pathToFileURL(path).href;
    })());
    return cache.get(relative);
  }
  return (relative) => moduleURL(relative).then((url) => import(url));
}
function execute(executable, argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argumentsList, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', (bytes) => { output += bytes; }); child.stderr.on('data', (bytes) => { errors += bytes; });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`Native fixture failed (${code}): ${errors || output}`)));
  });
}
class BrowserSession {
  constructor(origin) { this.origin = origin; this.cookies = new Map(); }
  async request(path, { method = 'GET', body, headers = {}, origin = this.origin, storeCookies = true } = {}) {
    const response = await fetch(this.origin + path, { method, headers: { Origin: origin, ...(this.cookies.size ? { Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ') } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (storeCookies) for (const cookie of response.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0].split('='); if (/Max-Age=0(?:;|$)/.test(cookie)) this.cookies.delete(key); else this.cookies.set(key, value); }
    const text = await response.text();
    return { status: response.status, headers: response.headers, value: text ? JSON.parse(text) : null };
  }
  signIn(name) { return this.request('/api/account/verify', { method: 'POST', body: { email: SYNTHETIC_LEARNERS[name].email, code: '123456' } }); }
  save(state, revision, name = 'alice') { return this.request('/api/state', { method: 'PUT', body: { scopeKey: `supabase:${SYNTHETIC_LEARNERS[name].id}`, sharedState: state, expectedRevision: revision } }); }
}

test('shared backend: production web routes and real native client use one isolated PostgreSQL record', { skip: !process.env.PGLITE_MODULE_PATH, timeout: 300000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'lucid-shared-backend-integration-'));
  let postgres, backend;
  try {
    postgres = await createSharedPostgresFixture();
    const environment = { LUCID_SHARED_AUTH_ENABLED: 'true', LUCID_SHARED_EMAIL_ENABLED: 'true', LUCID_SHARED_ALLOW_LOCAL_TEST: 'true', LUCID_SUPABASE_PUBLISHABLE_KEY: SYNTHETIC_PUBLIC_KEY };
    backend = await createSyntheticSharedBackend({ postgres }); environment.LUCID_SUPABASE_URL = backend.origin;
    const load = await productionModuleLoader(directory, environment);
    for (const action of ['status', 'otp', 'verify', 'signout']) backend.handlers[`/api/account/${action}`] = await load(`app/api/account/${action}/route.ts`);
    backend.handlers['/api/state'] = await load('app/api/state/route.ts');
    const contract = await load('lib/shared-learning-state.ts');
    const webPersistence = await load('lib/web-learning-state.ts');
    const executable = join(directory, 'native-shared-backend-client');
    // Freeze exact production sources before swiftc: parallel implementation edits
    // must not change a compiler input halfway through its build.
    const nativeSources = [];
    for (const name of ['Models', 'LearningPersistence', 'LearningStore', 'AccountService', 'LocalBackup', 'PracticeChallenges', 'ExpressionStudio', 'DailyVocabulary']) {
      const path = join(directory, `${name}.swift`); await writeFile(path, await readFile(new URL(`ios/Lucid/Lucid/${name}.swift`, root))); nativeSources.push(path);
    }
    const fixtureSource = join(directory, 'NativeSharedBackendClient.swift'); await writeFile(fixtureSource, await readFile(new URL('tests/native-shared-backend-client.swift', root))); nativeSources.push(fixtureSource);
    const compile = spawnSync('xcrun', ['swiftc', '-parse-as-library', '-module-cache-path', join(directory, 'module-cache'), ...nativeSources, '-o', executable], { cwd: root, encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr);
    let commandID = 0;
    async function native(command, input = {}) {
      commandID += 1; const inputFile = join(directory, `input-${commandID}.json`), outputFile = join(directory, `output-${commandID}.json`);
      await writeFile(inputFile, JSON.stringify({ email: SYNTHETIC_LEARNERS.alice.email, ...input }));
      try { await execute(executable, [backend.origin, command, inputFile, outputFile]); } catch (error) { throw new Error(`${error.message}; synthetic SQL diagnostics: ${JSON.stringify(backend.errors)}`); }
      return JSON.parse(await readFile(outputFile, 'utf8'));
    }
    const alice = new BrowserSession(backend.origin), bob = new BrowserSession(backend.origin);
    await t.test('verified identity, protected cookies and same native UUID', async () => {
      const signedIn = await alice.signIn('alice'); assert.equal(signedIn.status, 200); assert.equal(signedIn.value.identity, `supabase:${SYNTHETIC_LEARNERS.alice.id}`);
      assert.equal(signedIn.headers.get('cache-control'), 'no-store, private');
      assert.equal(signedIn.headers.getSetCookie().length, 2);
      for (const cookie of signedIn.headers.getSetCookie()) { assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); }
      const nativeIdentity = await native('fetch'); assert.equal(nativeIdentity.userID, SYNTHETIC_LEARNERS.alice.id); assert.equal(nativeIdentity.record, null);
      assert.equal((await bob.signIn('bob')).status, 200); assert.equal((await bob.request('/api/state')).value.sharedState, null);
    });
    await t.test('CSRF, spoofed identities and malformed signed sessions fail closed', async () => {
      assert.equal((await alice.request('/api/account/verify', { method: 'POST', origin: 'https://attacker.invalid', body: { email: SYNTHETIC_LEARNERS.alice.email, code: '123456' } })).status, 403);
      assert.equal((await alice.request('/api/state', { method: 'PUT', origin: 'https://attacker.invalid', body: {} })).status, 403);
      const anonymous = new BrowserSession(backend.origin);
      const spoofed = await anonymous.request('/api/account/status', { headers: { 'oai-authenticated-user-id': SYNTHETIC_LEARNERS.alice.id, 'x-lucid-user-id': SYNTHETIC_LEARNERS.alice.id, 'x-lucid-email': SYNTHETIC_LEARNERS.alice.email } });
      assert.equal(spoofed.value.identity, null);
      assert.equal((await anonymous.request('/api/state', { headers: { 'oai-authenticated-user-id': SYNTHETIC_LEARNERS.alice.id } })).status, 401);
      assert.equal((await alice.request('/api/state', { headers: { 'x-lucid-state-source': 'legacy', 'oai-authenticated-user-id': SYNTHETIC_LEARNERS.bob.id } })).status, 401);
      assert.equal((await anonymous.request('/api/state', { headers: { Authorization: 'Bearer not-a-verifiable-signed-token' } })).status, 401);
      assert.equal((await alice.save(minimalNativeState(), 0, 'bob')).status, 409);
      assert.equal((await bob.request('/api/state')).value.sharedState, null);
    });
    let latest;
    await t.test('web save is read by actual native Codable/AccountService', async () => {
      const state = minimalNativeState();
      state.profile = { roleId: 'finance-accounting', seniorityId: 'experienced-contributor', situationIds: ['finance:month-end-close'], goalIds: ['clarify'] };
      state.profileUpdatedAt = foundation('2026-10-13T09:00:00Z');
      state.introducedWordIds = ['finance-reconcile'];
      state.favouriteWordIds = ['finance-reconcile'];
      state.sessions = [{ id: uuid(919), date: foundation('2026-10-13T00:00:00Z'), dayKey: '2026-10-13', wordIds: ['finance-reconcile'], completedAt: foundation('2026-10-13T08:00:00Z') + 0.123456 }];
      state.favouriteChanges = { 'finance-reconcile': { selected: true, updatedAt: foundation('2026-10-13T09:00:00Z') } };
      const saved = await alice.save(state, 0); assert.equal(saved.status, 200, JSON.stringify(saved.value));
      latest = saved.value;
      const fetched = await native('fetch'); assert.equal(fetched.record.revision, 1); assert.deepEqual(fetched.record.state.profile, state.profile); assert.deepEqual(fetched.record.state.introducedWordIds, state.introducedWordIds);
    });
    await t.test('native merge/save propagates to web without replacing existing progress', async () => {
      const local = minimalNativeState(); local.introducedWordIds = ['finance-discrepancy']; local.favouriteWordIds = ['finance-discrepancy'];
      local.favouriteChanges = { 'finance-discrepancy': { selected: true, updatedAt: foundation('2026-10-13T09:01:00Z') } };
      const saved = await native('merge-save', { local }); assert.equal(saved.saved, true);
      const webRead = await alice.request('/api/state'); assert.equal(webRead.status, 200, JSON.stringify({ webRead: webRead.value, nativeRead: saved.record, fixtureErrors: backend.errors })); latest = webRead.value;
      assert.deepEqual(new Set(latest.sharedState.introducedWordIds), new Set(['finance-reconcile', 'finance-discrepancy']));
      assert.equal(latest.revision, 2);
    });
    await t.test('placement, interrupted checkpoints, all evidence kinds and authored Studio history round-trip in both directions', async () => {
      const catalogue = JSON.parse(await readFile(new URL('ios/Lucid/Lucid/Resources/professional-content.json', root), 'utf8'));
      const studio = JSON.parse(await readFile(new URL('ios/Lucid/Lucid/Resources/expression-content.json', root), 'utf8'));
      const roleId = 'finance-accounting', path = catalogue.learningPaths.find((item) => item.roleId === roleId);
      const expression = studio.expressions.find((item) => item.id === 'bridge-the-difference');
      const scenario = studio.scenarios.find((item) => item.expressionId === expression.id && item.roleIds.includes(roleId));
      const secondScenario = studio.scenarios.find((item) => item.expressionId !== expression.id && item.roleIds.includes(roleId));
      const notebookId = uuid(920), rehearsalId = uuid(921), context = `finance-reconcile::${roleId}`;
      const state = structuredClone(latest.sharedState);
      state.pathPlacements = { [roleId]: { pathId: path.id, startingModuleId: path.modules[0].id, checkedAt: foundation('2026-10-13T08:00:00Z'), correctAnswers: 4, questionCount: 6 } };
      state.contextIntroducedOn = { [context]: foundation('2026-10-10T12:00:00Z') };
      state.contextEvidence = [
        { id: uuid(922), wordId: 'finance-reconcile', roleId, senseId: context, date: '2026-10-13', recordedAt: foundation('2026-10-13T08:00:00Z') + 0.123456, capturedAt: foundation('2026-10-13T08:00:00Z') + 0.123456, kind: 'recognition', quality: 2, independent: false },
        { id: uuid(923), wordId: 'finance-reconcile', roleId, senseId: context, date: '2026-10-13', recordedAt: foundation('2026-10-13T08:30:00Z') + 0.123456, capturedAt: foundation('2026-10-13T08:30:00Z') + 0.123456, kind: 'unaided-recall', quality: 2, independent: true },
        { id: uuid(924), wordId: 'finance-reconcile', roleId, senseId: context, date: '2026-10-13', recordedAt: foundation('2026-10-13T09:00:00Z'), capturedAt: foundation('2026-10-13T09:00:00Z'), kind: 'self-assessed-production', quality: 2, independent: true },
      ];
      state.sharedLearning = {
        version: 1,
        lessonCheckpoints: { [`2026-10-13:${roleId}`]: { roleId, dayKey: '2026-10-13', wordIds: ['finance-reconcile', 'finance-discrepancy'], completedWordIds: ['finance-reconcile'], cursorWordId: 'finance-discrepancy', answers: { 'finance-reconcile': { choiceId: 'choice-meaning-0', hinted: false } }, updatedAt: '2026-10-13T09:00:00.000Z' } },
        startingChecks: { [roleId]: { roleId, pathId: path.id, questionIds: path.startingCheck.map((item) => item.id), answers: [0, 1], updatedAt: '2026-10-13T09:00:00.000Z' } },
        notebook: { [notebookId]: { id: notebookId, roleId, expressionId: expression.id, style: 'precise', phrase: expression.precise, createdAt: '2026-10-13T09:00:00.000Z', nextReviewOn: '2026-10-14' } },
        rehearsals: { [rehearsalId]: { id: rehearsalId, roleId, expressionId: expression.id, scenarioId: scenario.id, gapId: notebookId, mode: 'initial', modelSeen: false, startedAt: '2026-10-13T09:00:00.000Z' } },
        challenges: { 'transfer:finance-accounting:5': { id: 'transfer:finance-accounting:5', roleId, mode: 'transfer', milestone: 5, startedAt: '2026-10-13T09:00:00.000Z', scenarioIds: [scenario.id, secondScenario.id], completedScenarioIds: [scenario.id] } },
        exposures: {},
      };
      const webSaved = await alice.save(state, latest.revision); assert.equal(webSaved.status, 200, JSON.stringify({ value: webSaved.value, fixtureErrors: backend.errors })); latest = webSaved.value;
      const nativeRead = await native('fetch');
      assert.deepEqual(nativeRead.record.state.sharedLearning, latest.sharedState.sharedLearning);
      assert.deepEqual(nativeRead.record.state.pathPlacements, state.pathPlacements);
      assert.deepEqual(new Set(nativeRead.record.state.contextEvidence.map((item) => item.kind)), new Set(['recognition', 'unaided-recall', 'self-assessed-production']));
      const nativeLocal = nativeRead.record.state, checkpoint = nativeLocal.sharedLearning.lessonCheckpoints[`2026-10-13:${roleId}`];
      checkpoint.completedWordIds.push('finance-discrepancy'); checkpoint.cursorWordId = 'finance-discrepancy'; checkpoint.updatedAt = '2026-10-13T09:10:00.000Z';
      nativeLocal.sharedLearning.startingChecks[roleId].answers.push(2); nativeLocal.sharedLearning.startingChecks[roleId].updatedAt = '2026-10-13T09:10:00.000Z';
      nativeLocal.sharedLearning.notebook[notebookId].lastPractisedAt = '2026-10-13T09:10:00.000Z'; nativeLocal.sharedLearning.notebook[notebookId].nextReviewOn = '2026-10-16';
      nativeLocal.sharedLearning.rehearsals[rehearsalId].completedAt = '2026-10-13T09:10:00.000Z'; nativeLocal.sharedLearning.rehearsals[rehearsalId].modelSeen = true;
      nativeLocal.sharedLearning.challenges['transfer:finance-accounting:5'].completedScenarioIds.push(secondScenario.id); nativeLocal.sharedLearning.challenges['transfer:finance-accounting:5'].completedAt = '2026-10-13T09:10:00.000Z';
      nativeLocal.practiceDrafts = { 'finance-reconcile': 'PRIVATE-SYNTHETIC-RESPONSE-MUST-NOT-SYNC' };
      const nativeSaved = await native('store-sync', { local: nativeLocal }); assert.equal(nativeSaved.saved, true); assert.equal(nativeSaved.scope, SYNTHETIC_LEARNERS.alice.id); assert.equal(nativeSaved.hydratedNotebook, 1); assert.equal(nativeSaved.hydratedRehearsals, 1); assert.equal(nativeSaved.hydratedChallenges, 1);
      latest = (await alice.request('/api/state')).value;
      assert.deepEqual(latest.sharedState.sharedLearning.lessonCheckpoints[`2026-10-13:${roleId}`].completedWordIds, ['finance-discrepancy', 'finance-reconcile']);
      assert.deepEqual(latest.sharedState.sharedLearning.startingChecks[roleId].answers, [0, 1, 2]);
      assert.equal(latest.sharedState.sharedLearning.notebook[notebookId].lastPractisedAt, '2026-10-13T09:10:00.000Z');
      assert.equal(latest.sharedState.sharedLearning.notebook[notebookId].nextReviewOn, '2026-10-16');
      assert.equal(latest.sharedState.sharedLearning.rehearsals[rehearsalId].completedAt, '2026-10-13T09:10:00.000Z');
      assert.equal(latest.sharedState.sharedLearning.challenges['transfer:finance-accounting:5'].completedScenarioIds.length, 2);
      assert.equal(JSON.stringify(latest.sharedState).includes('PRIVATE-SYNTHETIC-RESPONSE-MUST-NOT-SYNC'), false);
    });
    await t.test('future records, immutable evidence edits and free-form private notebook phrases are rejected without changing revision', async () => {
      const before = latest.revision;
      const invalid = structuredClone(latest.sharedState); invalid.sharedLearning.notebook[uuid(920)].createdAt = '2099-01-01T00:00:00.000Z';
      assert.equal((await alice.save(invalid, before)).status, 400);
      const privateText = structuredClone(latest.sharedState); privateText.sharedLearning.notebook[uuid(920)].phrase = 'Synthetic private workplace note not in authored catalogue.';
      assert.ok([400, 401].includes((await alice.save(privateText, before)).status));
      const collision = structuredClone(latest.sharedState); collision.contextEvidence[0].wordId = 'finance-discrepancy'; collision.contextEvidence[0].senseId = 'finance-discrepancy::finance-accounting';
      assert.ok([400, 401].includes((await alice.save(collision, before)).status));
      assert.equal((await alice.request('/api/state')).value.revision, before);
    });
    await t.test('server cannot upgrade repeated evidence and later exposure preserves only an earlier frozen original', async () => {
      const upgrade = structuredClone(latest.sharedState), recall = upgrade.contextEvidence.find((item) => item.id === uuid(923));
      recall.quality = 3;
      const unchanged = await alice.save(upgrade, latest.revision); assert.equal(unchanged.status, 200); latest = unchanged.value;
      assert.equal(latest.sharedState.contextEvidence.find((item) => item.id === uuid(923)).quality, 2);
      const exposed = structuredClone(latest.sharedState);
      exposed.sharedLearning.exposures['finance-reconcile::finance-accounting'] = { dayKey: '2026-10-13', firstSeenAt: '2026-10-13T08:45:00.000Z' };
      const saved = await alice.save(exposed, latest.revision); assert.equal(saved.status, 200); latest = saved.value;
      const original = latest.sharedState.contextEvidence.find((item) => item.id === uuid(923));
      const later = latest.sharedState.contextEvidence.find((item) => item.id === uuid(924));
      assert.equal(original.independent, true); assert.equal(original.quality, 2);
      assert.equal(later.independent, false); assert.equal(later.quality, 1);
      const nativeRead = await native('fetch'); assert.equal(nativeRead.record.state.contextEvidence.find((item) => item.id === uuid(923)).independent, true);
      const web = contract.sharedCloudStateToWeb(latest.sharedState, webPersistence.prepareWebState(minimalWebState()));
      assert.equal(web.learningV3.contextMastery['finance-reconcile::finance-accounting'].mastered, false, 'one recall day, recognition and production cannot imply delayed retained recall');
      const roundtrip = contract.webToSharedCloudState(web);
      assert.equal(roundtrip.contextEvidence.find((item) => item.id === uuid(923)).independent, true);
      for (const event of latest.sharedState.contextEvidence) { const encoded = roundtrip.contextEvidence.find((item) => item.id === event.id); assert.equal(encoded.recordedAt, event.recordedAt, 'immutable native sub-millisecond evidence timestamps must survive web projection exactly'); if (event.capturedAt !== undefined) assert.equal(encoded.capturedAt, event.capturedAt); }
      for (const session of latest.sharedState.sessions) assert.deepEqual(roundtrip.sessions.find((item) => item.id.toLowerCase() === session.id.toLowerCase()), session, 'immutable native session date/precision must survive web projection');
      const savedRoundtrip = await alice.save(roundtrip, latest.revision); assert.equal(savedRoundtrip.status, 200, JSON.stringify(savedRoundtrip.value)); latest = savedRoundtrip.value;
    });
    await t.test('concurrent stale CAS has one winner; retry retains both edits', async () => {
      const first = structuredClone(latest.sharedState), second = structuredClone(latest.sharedState);
      first.introducedWordIds.push('finance-variance'); second.introducedWordIds.push('finance-material');
      const responses = await Promise.all([alice.save(first, latest.revision), alice.save(second, latest.revision)]);
      assert.deepEqual(responses.map((result) => result.status).sort(), [200, 409]);
      const winner = responses.find((result) => result.status === 200).value;
      const merged = contract.mergeSharedCloudStates(first, second);
      const retried = await alice.save(contract.mergeSharedCloudStates(merged, winner.sharedState), winner.revision);
      assert.equal(retried.status, 200, JSON.stringify(retried.value)); latest = retried.value;
      assert.ok(latest.sharedState.introducedWordIds.includes('finance-variance')); assert.ok(latest.sharedState.introducedWordIds.includes('finance-material'));
      const stale = await native('save', { local: second, revision: 2 }); assert.equal(stale.conflict, true);
      assert.equal((await alice.request('/api/state')).value.revision, latest.revision);
    });
    await t.test('offline modifications survive reconnect and interrupted committed response is idempotent', async () => {
      const local = structuredClone(latest.sharedState); local.introducedWordIds.push('finance-accrue');
      backend.controls.offline = true;
      const failed = await alice.save(local, latest.revision); assert.equal(failed.status, 503); assert.ok(local.introducedWordIds.includes('finance-accrue'));
      backend.controls.offline = false;
      const remote = (await alice.request('/api/state')).value;
      const saved = await alice.save(contract.mergeSharedCloudStates(local, remote.sharedState), remote.revision); assert.equal(saved.status, 200); latest = saved.value;
      const event = { id: uuid(910), kind: 'lesson', wordId: null, date: foundation('2026-10-13T10:00:00Z'), dayKey: '2026-10-13', quality: 2, productive: false };
      const interrupted = structuredClone(latest.sharedState); interrupted.activities = [...(interrupted.activities ?? []), event];
      backend.controls.disconnectAfterSave = true;
      const disconnected = await alice.save(interrupted, latest.revision); assert.equal(disconnected.status, 503);
      const committed = (await alice.request('/api/state')).value; assert.equal(committed.revision, latest.revision + 1);
      const retry = await alice.save(contract.mergeSharedCloudStates(interrupted, committed.sharedState), committed.revision); assert.equal(retry.status, 200); latest = retry.value;
      assert.equal(latest.sharedState.activities.filter((entry) => entry.id.toLowerCase() === event.id).length, 1);
    });
    await t.test('account isolation, sign-out and expired-session refresh', async () => {
      const aliceToken = backend.mint('alice');
      const stolen = await fetch(`${backend.origin}/rest/v1/lucid_state?user_id=eq.${SYNTHETIC_LEARNERS.bob.id}&select=revision,state`, { headers: { apikey: SYNTHETIC_PUBLIC_KEY, Authorization: `Bearer ${aliceToken.access_token}` } });
      assert.deepEqual(await stolen.json(), []);
      assert.equal((await bob.request('/api/state')).value.sharedState, null);
      const expired = backend.mint('alice', -1), refreshed = new BrowserSession(backend.origin);
      refreshed.cookies.set('lucid-shared-access', encodeURIComponent(expired.access_token)); refreshed.cookies.set('lucid-shared-refresh', expired.refresh_token);
      const recovered = await refreshed.request('/api/account/status'); assert.equal(recovered.status, 200); assert.equal(recovered.value.identity, `supabase:${SYNTHETIC_LEARNERS.alice.id}`); assert.equal(recovered.headers.getSetCookie().length, 2);
      const before = new Map(bob.cookies); assert.equal((await bob.request('/api/account/signout', { method: 'POST', body: {} })).status, 200); assert.equal(bob.cookies.size, 0);
      bob.cookies = before; assert.equal((await bob.request('/api/state')).status, 401); bob.cookies.clear();
      assert.equal((await bob.signIn('alice')).status, 200); assert.equal((await bob.request('/api/state')).value.revision, latest.revision);
      assert.equal((await native('signout', { email: SYNTHETIC_LEARNERS.bob.email })).revoked, true);
    });
    await t.test('native guest progress transfers only after explicit consent and private writing remains local', async () => {
      const guest = minimalNativeState(); guest.introducedWordIds = ['finance-seasonal']; guest.practiceDrafts = { 'finance-seasonal': 'SYNTHETIC-GUEST-PRIVATE-NOTE' };
      const isolated = await native('store-sync', { email: SYNTHETIC_LEARNERS.bob.email, guest, includeGuest: false });
      assert.equal(isolated.record.state.introducedWordIds.includes('finance-seasonal'), false);
      assert.deepEqual(isolated.guestIntroducedWordIds, ['finance-seasonal']); assert.equal(isolated.guestDraftCount, 1);
      const consented = await native('store-sync', { email: SYNTHETIC_LEARNERS.bob.email, guest, includeGuest: true });
      assert.equal(consented.record.state.introducedWordIds.includes('finance-seasonal'), true);
      assert.equal(JSON.stringify(consented.record.state).includes('SYNTHETIC-GUEST-PRIVATE-NOTE'), false);
      assert.deepEqual(consented.guestIntroducedWordIds, ['finance-seasonal']); assert.equal(consented.guestDraftCount, 1);
      const aliceRead = await native('fetch'); assert.equal(aliceRead.record.state.introducedWordIds.includes('finance-seasonal'), false);
    });
    await t.test('production sync controller keeps offline account edits and native edits, then isolates account switching', async () => {
      const syncModule = await load('lib/web-learning-sync.ts');
      const browser = new BrowserSession(backend.origin); assert.equal((await browser.signIn('alice')).status, 200);
      const records = new Map(), storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
      let networkOffline = false;
      const fixtureFetch = async (path, options = {}) => {
        if (networkOffline) throw new TypeError('Synthetic browser is offline');
        const headers = new Headers(options.headers); headers.set('Origin', backend.origin);
        if (browser.cookies.size) headers.set('Cookie', [...browser.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
        const response = await fetch(new URL(path, backend.origin), { ...options, headers });
        for (const cookie of response.headers.getSetCookie()) { const [key, value] = cookie.split(';')[0].split('='); if (/Max-Age=0(?:;|$)/.test(cookie)) browser.cookies.delete(key); else browser.cookies.set(key, value); }
        return response;
      };
      const controller = syncModule.createWebLearningSync({ storage, fetch: fixtureFetch, defaults: minimalWebState(), deviceId: 'shared-fixture-browser' });
      try {
        await controller.load(); await controller.retrySync();
        const aliceScope = `supabase:${SYNTHETIC_LEARNERS.alice.id}`;
        assert.equal(controller.snapshot().scopeKey, aliceScope);
        networkOffline = true;
        assert.equal(controller.commit((state) => ({ ...state, introducedWordIds: [...state.introducedWordIds, 'finance-outstanding'] }), aliceScope), true);
        await controller.retrySync();
        assert.equal(controller.snapshot().status, 'offline'); assert.equal(controller.snapshot().scopeKey, aliceScope); assert.ok(controller.snapshot().state.introducedWordIds.includes('finance-outstanding'));
        const nativeLocal = minimalNativeState(); nativeLocal.introducedWordIds = ['finance-cut-off'];
        assert.equal((await native('merge-save', { local: nativeLocal })).saved, true);
        networkOffline = false; await controller.retrySync();
        assert.equal(controller.snapshot().status, 'saved');
        assert.ok(controller.snapshot().state.introducedWordIds.includes('finance-outstanding')); assert.ok(controller.snapshot().state.introducedWordIds.includes('finance-cut-off'));
        const fetched = await native('fetch'); assert.ok(fetched.record.state.introducedWordIds.includes('finance-outstanding')); assert.ok(fetched.record.state.introducedWordIds.includes('finance-cut-off'));
        const nativeMetrics = await native('store-sync'); const ui = await load('lib/web-learning-ui.ts');
        await controller.retrySync();
        assert.equal(nativeMetrics.totalXP, ui.effortPoints(controller.snapshot().state), 'both clients grant the same once-per-day/word effort credit');
        assert.equal(nativeMetrics.totalXP, 55, 'two guided words, one recalled word and one day-wide completion; duplicate lesson/event IDs add no credit');
        assert.equal(nativeMetrics.retainedContextCount, 0, 'recognition and same-day production cannot claim 30-day retained recall');
        // A delayed old-account response can carry refreshed HTTP-only cookies.
        // The production auth boundary must drain it before a new login starts.
        const expiredBeforeSwitch = backend.mint('alice', -1);
        browser.cookies.set('lucid-shared-access', encodeURIComponent(expiredBeforeSwitch.access_token)); browser.cookies.set('lucid-shared-refresh', expiredBeforeSwitch.refresh_token);
        backend.controls.holdStateGETResponses = true;
        const oldSync = controller.retrySync(); await backend.waitForHeldResponse();
        let drained = false; const boundary = controller.suspendForAccountChange().then(() => { drained = true; });
        await Promise.resolve(); assert.equal(drained, false);
        backend.releaseHeldResponses(); await oldSync; await boundary; assert.equal(drained, true);
        assert.equal((await browser.signIn('bob')).status, 200); await controller.refreshIdentity(); await controller.retrySync();
        assert.equal(controller.snapshot().scopeKey, `supabase:${SYNTHETIC_LEARNERS.bob.id}`);
        assert.equal(controller.snapshot().state.introducedWordIds.includes('finance-outstanding'), false);
        assert.equal(controller.commit((state) => ({ ...state, introducedWordIds: [...state.introducedWordIds, 'finance-material'] }), aliceScope), false);
        assert.ok(records.has(`lucid-learning-v3:${encodeURIComponent(aliceScope)}`));
        assert.equal((await browser.request('/api/account/signout', { method: 'POST', body: {} })).status, 200);
        await controller.refreshIdentity();
        assert.equal(controller.snapshot().state.introducedWordIds.includes('finance-outstanding'), false);
      } finally { backend.releaseHeldResponses(); controller.dispose(); }
      latest = (await alice.request('/api/state')).value;
    });
    await t.test('manual backup compatibility remains separate from automatic transport', async () => {
      const web = webPersistence.prepareWebState(minimalWebState());
      const decoded = contract.sharedCloudStateToWeb(latest.sharedState, web);
      const encoded = contract.webToSharedCloudState(decoded);
      assert.ok(encoded.introducedWordIds.includes('finance-reconcile'));
      const backup = webPersistence.exportPortableBackup(decoded);
      const restored = webPersistence.importPortableBackup(backup, web);
      assert.ok(restored.introducedWordIds.includes('finance-reconcile'));
    });
    t.diagnostic(`${postgres.engine}; production web route handlers and native AccountService/LearningMerge over real HTTP; signed synthetic Auth/PostgREST protocol; not hosted Supabase or separate-session PostgreSQL contention.`);
  } finally {
    if (backend) await backend.close(); if (postgres) await postgres.close();
    delete globalThis.__lucidSharedBackendTestEnvironment;
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
