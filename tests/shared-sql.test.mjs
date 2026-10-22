import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSharedPostgresFixture } from '../scripts/shared-postgres-fixture.mjs';

const available = Boolean(process.env.PGLITE_MODULE_PATH);
const securityFile = new URL('../supabase/proposals/shared-progress-security.sql', import.meta.url);
const zero = (rows) => rows.every((row) => Object.values(row).every((value) => value === 0));

test('Actual PostgreSQL executes pending v2 validation and complete original security suite', { skip: !available }, async () => {
  const f = await createSharedPostgresFixture({ shared: false });
  try {
    assert.match(f.engine, /PostgreSQL/);
    const r = await f.exec(await readFile(new URL('../supabase/proposals/account-payload-security.sql', import.meta.url), 'utf8'));
    assert.ok(zero(r.at(-1).rows));
  } finally { await f.close(); }
});

test('Actual PostgreSQL shared SQL validates shapes, private exclusions, RLS, CAS, conservative merges and rollback cleanup', { skip: !available }, async () => {
  const f = await createSharedPostgresFixture();
  try {
    const r = await f.exec(await readFile(securityFile, 'utf8'));
    assert.ok(zero(r.at(-1).rows));
    const count = await f.query('select count(*)::integer n from auth.users');
    assert.equal(count.rows[0].n, 0);
  } finally { await f.close(); }
});

test('Actual PostgreSQL safe rollback retains shared snapshots, permits old clients, fails new clients visibly, and restores transactional DDL', { skip: !available }, async () => {
  const f = await createSharedPostgresFixture();
  try {
    const originalDefinition = (await f.query("select pg_get_functiondef('public.lucid_save_state(bigint,jsonb)'::regprocedure) definition")).rows[0].definition;
    await f.exec((await readFile(securityFile, 'utf8')).split('DO $validator$')[0]);
    await f.exec(`set local role authenticated; set local "request.jwt.claim.sub"='d3041440-1111-4111-8111-111111111111';`);
    assert.equal((await f.query('select public.lucid_save_state(0,pg_temp.shared_fixture()) revision')).rows[0].revision, 1);
    const before = (await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state;
    await f.exec('reset role');
    await f.exec(await readFile(new URL('../supabase/proposals/202610140001_lucid_shared_progress.rollback.sql', import.meta.url), 'utf8'));
    await f.exec(`set local role authenticated; set local "request.jwt.claim.sub"='d3041440-1111-4111-8111-111111111111';`);
    assert.equal((await f.query("select public.lucid_save_state(1,pg_temp.shared_fixture()-'sharedLearning') revision")).rows[0].revision, 2);
    const after = (await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state;
    assert.deepEqual(after.sharedLearning, before.sharedLearning);
    await f.exec('savepoint unsupported_new_client');
    await assert.rejects(f.query('select public.lucid_save_state(2,pg_temp.shared_fixture())'), (error) => error.code === 'PT400');
    await f.exec('rollback to savepoint unsupported_new_client');
    assert.equal((await f.query('select revision from public.lucid_state where user_id=auth.uid()')).rows[0].revision, 2);
    await f.exec('rollback');
    assert.equal((await f.query("select pg_get_functiondef('public.lucid_save_state(bigint,jsonb)'::regprocedure) definition")).rows[0].definition, originalDefinition);
    assert.equal((await f.query('select count(*)::integer n from auth.users')).rows[0].n, 0);
  } finally { await f.close(); }
});

test('Actual PostgreSQL derives retention from distinct recall dates, refuses production/duplicate promotion, and keeps core history after omissions', { skip: !available }, async () => {
  const f = await createSharedPostgresFixture();
  try {
    await f.exec((await readFile(securityFile, 'utf8')).split('DO $validator$')[0]);
    await f.exec(`set local role authenticated; set local "request.jwt.claim.sub"='d3041440-1111-4111-8111-111111111111';`);
    const p = (await f.query('select pg_temp.shared_fixture() state')).rows[0].state;
    const foundation = (ms) => ms / 1000 - 978307200;
    const now = Date.now(), anchor = foundation(now - 45 * 86400000);
    p.contextIntroducedOn['finance-reconcile::finance-accounting'] = anchor;
    p.progressByWordId['finance-reconcile'].introducedOn = anchor;
    p.sharedLearning.exposures = {};
    const evidence = (n, age, kind = 'unaided-recall') => {
      const time = now - age * 86400000;
      return { id: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`, wordId: 'finance-reconcile', roleId: 'finance-accounting', senseId: 'finance-reconcile::finance-accounting', date: new Date(time).toISOString().slice(0, 10), recordedAt: foundation(time), capturedAt: foundation(time - 1000), kind, quality: 2, independent: kind !== 'recognition' };
    };
    p.contextEvidence = [evidence(1, 31), evidence(2, 15), evidence(3, 1)];
    p.sessions = [{ id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', date: foundation(Date.parse(new Date(now - 86400000).toISOString().slice(0, 10) + 'T00:00:00Z')), dayKey: new Date(now - 86400000).toISOString().slice(0, 10), completedAt: foundation(now - 86400000), wordIds: ['finance-reconcile'] }];
    p.activities = [{ id: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB', kind: 'lesson', wordId: null, date: foundation(now - 86400000), dayKey: new Date(now - 86400000).toISOString().slice(0, 10), quality: 1, productive: false }];
    assert.equal((await f.query('select public.lucid_save_state(0,$1::jsonb) revision', [p])).rows[0].revision, 1);
    let saved = (await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state;
    assert.equal(saved.progressByWordId['finance-reconcile'].mastered, true);
    // Native UUID capitalization and omitted nil wordId are semantically identical.
    delete p.activities[0].wordId;
    p.sessions[0].id = p.sessions[0].id.toLowerCase();
    p.contextEvidence[0].id = p.contextEvidence[0].id.toUpperCase();
    assert.equal((await f.query('select public.lucid_save_state(1,$1::jsonb) revision', [p])).rows[0].revision, 2);
    saved = (await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state;
    assert.equal(saved.contextEvidence.length, 3);
    assert.equal(saved.sessions.length, 1);
    // A weaker same-day recall and production self-assessment cannot sustain retention.
    p.contextEvidence.push({ ...evidence(4, 1), quality: 1, independent: false }, evidence(5, 1, 'self-assessed-production'));
    assert.equal((await f.query('select public.lucid_save_state(2,$1::jsonb) revision', [p])).rows[0].revision, 3);
    saved = (await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state;
    assert.equal(saved.progressByWordId['finance-reconcile'].mastered, false);
    const omitted = { ...p, introducedWordIds: [], progressByWordId: {}, sessions: [], activities: [] };
    delete omitted.contextEvidence; delete omitted.contextIntroducedOn; delete omitted.sharedLearning;
    assert.equal((await f.query('select public.lucid_save_state(3,$1::jsonb) revision', [omitted])).rows[0].revision, 4);
    saved = (await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state;
    assert.deepEqual(saved.introducedWordIds, ['finance-reconcile']);
    assert.equal(saved.sessions.length, 1); assert.equal(saved.activities.length, 1); assert.equal(saved.contextEvidence.length, 5);
    assert.equal(saved.progressByWordId['finance-reconcile'].mastered, false);
    await f.exec('rollback');
    assert.equal((await f.query('select count(*)::integer n from auth.users')).rows[0].n, 0);
  } finally { await f.close(); }
});

test('SQL authored allowlists match both exported clients exactly and never accept notebook free text', { skip: !available }, async () => {
  const f = await createSharedPostgresFixture();
  try {
    const expressions = JSON.parse(await readFile(new URL('../ios/Lucid/Lucid/Resources/expression-content.json', import.meta.url), 'utf8'));
    const curriculum = JSON.parse(await readFile(new URL('../ios/Lucid/Lucid/Resources/professional-content.json', import.meta.url), 'utf8'));
    const expectedPhrases = expressions.expressions.flatMap((e) => e.roleIds.flatMap((role_id) => ['plain', 'precise', 'diplomatic'].map((style) => ({ expression_id: e.id, role_id, style, phrase: e[style] }))));
    const actualPhrases = (await f.query('select expression_id,role_id,style,phrase from public.lucid_expression_phrase')).rows;
    const stable = (rows) => rows.map((x) => JSON.stringify(x)).sort();
    assert.deepEqual(stable(actualPhrases), stable(expectedPhrases));
    const expectedScenarios = expressions.scenarios.flatMap((s) => s.roleIds.map((role_id) => ({ scenario_id: s.id, expression_id: s.expressionId, role_id })));
    assert.deepEqual(stable((await f.query('select scenario_id,expression_id,role_id from public.lucid_expression_scenario')).rows), stable(expectedScenarios));
    const expectedWords = curriculum.words.flatMap((w) => w.roles.map((role_id) => ({ role_id, word_id: w.id })));
    assert.deepEqual(stable((await f.query('select role_id,word_id from public.lucid_course_word')).rows), stable(expectedWords));
    const expectedChecks = curriculum.learningPaths.map((p) => ({ role_id: p.roleId, path_id: p.id, question_ids: p.startingCheck.map((q) => q.id), option_counts: p.startingCheck.map((q) => q.options.length) }));
    assert.deepEqual(stable((await f.query('select role_id,path_id,question_ids,option_counts from public.lucid_course_path')).rows), stable(expectedChecks));
  } finally { await f.close(); }
});

test('Actual SQL merge ties converge in either order and retention uses the exact context calendar-day anchor', { skip: !available }, async () => {
  const f = await createSharedPostgresFixture();
  try {
    await f.exec((await readFile(securityFile, 'utf8')).split('DO $validator$')[0]);
    const p = (await f.query('select pg_temp.shared_fixture() state')).rows[0].state;
    const a = p.sharedLearning, b = structuredClone(a);
    const plan = '2001-01-01:finance-accounting';
    b.lessonCheckpoints[plan].answers['finance-reconcile'].choiceId = 'meaning-1';
    a.startingChecks['finance-accounting'].answers = [2]; b.startingChecks['finance-accounting'].answers = [1];
    const merge = async (left, right) => (await f.query('select public.lucid_shared_merge($1::jsonb,$2::jsonb) merged', [left, right])).rows[0].merged;
    assert.deepEqual(await merge(a, b), await merge(b, a));
    assert.deepEqual((await merge(a, b)).startingChecks['finance-accounting'].answers, [1]);
    const noteId = '11111111-1111-4111-8111-111111111111';
    a.notebook[noteId].lastPractisedAt = a.notebook[noteId].createdAt;
    b.notebook[noteId].lastPractisedAt = new Date(Date.now() - 86400000).toISOString();
    const laterDue = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    b.notebook[noteId].nextReviewOn = laterDue;
    assert.equal((await merge(a, b)).notebook[noteId].nextReviewOn, laterDue);
    assert.equal((await merge(b, a)).notebook[noteId].nextReviewOn, laterDue);
    const isoDay = a.exposures['finance-reconcile::finance-accounting'].dayKey;
    a.exposures['finance-reconcile::finance-accounting'].firstSeenAt = isoDay + 'T10:00:00Z';
    b.exposures['finance-reconcile::finance-accounting'].firstSeenAt = isoDay + 'T10:00:00.001Z';
    assert.equal((await merge(a, b)).exposures['finance-reconcile::finance-accounting'].firstSeenAt, isoDay + 'T10:00:00Z');
    await f.exec(`set local role authenticated; set local "request.jwt.claim.sub"='d3041440-1111-4111-8111-111111111111';`);
    const now = Date.now(), foundation = (ms) => ms / 1000 - 978307200;
    const ev = (n, days) => ({ id: `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`, wordId: 'finance-reconcile', roleId: 'finance-accounting', senseId: 'finance-reconcile::finance-accounting', date: new Date(now - days * 86400000).toISOString().slice(0, 10), recordedAt: foundation(now - days * 86400000), kind: 'unaided-recall', quality: 2, independent: true });
    p.sharedLearning.exposures = {}; delete p.contextIntroducedOn;
    p.contextEvidence = [ev(1, 15), ev(2, 10), ev(3, 1)];
    // Global word history is 40 days old, but this role's first recall is only 15 days old.
    await f.query('select public.lucid_save_state(0,$1::jsonb)', [p]);
    assert.equal((await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state.progressByWordId['finance-reconcile'].mastered, false);
    // A genuine context introduction 31 days ago reaches its 30th calendar day yesterday.
    const anchorDay = new Date(now - 31 * 86400000).toISOString().slice(0, 10);
    p.contextIntroducedOn = { 'finance-reconcile::finance-accounting': foundation(Date.parse(anchorDay + 'T12:00:00Z')) };
    await f.query('select public.lucid_save_state(1,$1::jsonb)', [p]);
    assert.equal((await f.query('select state from public.lucid_state where user_id=auth.uid()')).rows[0].state.progressByWordId['finance-reconcile'].mastered, true);
    await f.exec('rollback');
  } finally { await f.close(); }
});
