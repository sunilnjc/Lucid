import test from "node:test";
import assert from "node:assert/strict";
import { createSharedPostgresFixture } from "../scripts/shared-postgres-fixture.mjs";

// This fixture only creates an in-memory PostgreSQL database. It neither contacts
// Supabase Auth/PostgREST nor models their JWT verification or session revocation.
const available = Boolean(process.env.PGLITE_MODULE_PATH);
const alice = "a0221022-1111-4111-8111-111111111111";
const bob = "a0221022-2222-4222-8222-222222222222";
const replacement = "a0221022-3333-4333-8333-333333333333";
const eventID = "a0221022-4444-4444-8444-444444444444";
const aliceEmail = "lucid-deletion-a@example.invalid";

function learningState(wordId, displayName) {
  const now = Date.now();
  const instant = now / 1000 - 978307200;
  const dayKey = new Date(now).toISOString().slice(0, 10);
  return {
    schemaVersion: 2,
    displayName,
    introducedWordIds: wordId ? [wordId] : [],
    currentWordIds: wordId ? [wordId] : [],
    progressByWordId: wordId ? { [wordId]: {
      introducedOn: instant - 86400,
      intervalIndex: 0,
      nextReviewOn: instant + 86400,
      reviewCount: 0,
      successfulReviewDates: [],
      lapses: 0,
      mastered: false,
    } } : {},
    sessions: [],
    activities: wordId ? [{ id: eventID, kind: "practice", wordId, date: instant, dayKey, quality: 0, productive: false }] : [],
    favouriteWordIds: wordId ? [wordId] : [],
    completedWordIdsToday: [],
    settings: { notificationsEnabled: false, reminderHour: 9, reminderMinute: 0, speechRate: 0.46 },
    reviewPromptMilestone: 0,
    sharedLearning: { version: 1 },
  };
}

test("actual PostgreSQL enforces account isolation, deletion cascades and fresh UUID ownership", { skip: !available, timeout: 60_000 }, async (t) => {
  const fixture = await createSharedPostgresFixture();
  let transactionOpen = false;
  const stateA = learningState("finance-reconcile", "Synthetic deletion learner A");
  const stateB = learningState("finance-variance", "Synthetic deletion learner B");

  async function actor(role, id = "") {
    assert.ok(role === "anon" || role === "authenticated");
    await fixture.exec(`reset role; set local role ${role};`);
    await fixture.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",
      [id, JSON.stringify({ role, ...(id ? { sub: id } : {}) })]);
  }
  async function owner() {
    await fixture.exec("reset role");
    await fixture.query("select set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claims','{}',true)");
  }
  async function rejected(sql, parameters = [], code = "42501") {
    await fixture.exec("savepoint denied_operation");
    try {
      await assert.rejects(fixture.query(sql, parameters), (error) => error.code === code,
        `Expected ${code} from ${sql}`);
    } finally {
      // Even an accidentally successful write is undone before the next assertion.
      await fixture.exec("rollback to savepoint denied_operation; release savepoint denied_operation;");
    }
  }
  async function save(state, revision) {
    return (await fixture.query("select public.lucid_save_state($1,$2::jsonb) revision", [revision, state])).rows[0].revision;
  }
  async function snapshot(id) {
    await owner();
    return {
      state: (await fixture.query("select user_id,revision,state,updated_at from public.lucid_state where user_id=$1", [id])).rows,
      activities: (await fixture.query("select user_id,event_id,payload,created_at from public.lucid_activity where user_id=$1 order by event_id", [id])).rows,
    };
  }
  async function denyDirectWrites(id) {
    for (const target of [id, id === alice ? bob : alice]) {
      await rejected("insert into public.lucid_state(user_id,state) values($1,'{}')", [target]);
      await rejected("update public.lucid_state set revision=revision+100 where user_id=$1", [target]);
      await rejected("delete from public.lucid_state where user_id=$1", [target]);
      await rejected("insert into public.lucid_activity(user_id,event_id,payload) values($1,$2,'{}')", [target, eventID]);
      await rejected("update public.lucid_activity set payload='{}' where user_id=$1", [target]);
      await rejected("delete from public.lucid_activity where user_id=$1", [target]);
    }
  }

  try {
    assert.match(fixture.engine, /PostgreSQL/);
    await fixture.exec("begin; set local statement_timeout='10s';");
    transactionOpen = true;
    await fixture.query("insert into auth.users(id,aud,role,email,created_at,updated_at) values($1,'authenticated','authenticated',$2,now(),now()),($3,'authenticated','authenticated',$4,now(),now())",
      [alice, aliceEmail, bob, "lucid-deletion-b@example.invalid"]);
    await actor("authenticated", alice);
    assert.equal(await save(stateA, 0), 1);
    await actor("authenticated", bob);
    assert.equal(await save(stateB, 0), 1);
    const originalA = await snapshot(alice);
    const originalB = await snapshot(bob);
    assert.equal(originalA.activities.length, 1);
    assert.equal(originalB.activities.length, 1);
    assert.equal(originalA.activities[0].event_id, originalB.activities[0].event_id,
      "An activity UUID must be independent in each account");

    await t.test("anonymous clients cannot read either table, write rows or execute the save RPC", async () => {
      await actor("anon");
      for (const table of ["lucid_state", "lucid_activity"]) {
        await rejected(`select * from public.${table}`);
      }
      await denyDirectWrites(alice);
      await rejected("select public.lucid_save_state(0,$1::jsonb)", [stateA]);
      assert.deepEqual(await snapshot(alice), originalA);
      assert.deepEqual(await snapshot(bob), originalB);
    });

    await t.test("both authenticated accounts read only their own state/activity and cannot write either table directly", async () => {
      for (const [id, other] of [[alice, bob], [bob, alice]]) {
        await actor("authenticated", id);
        for (const table of ["lucid_state", "lucid_activity"]) {
          const visible = (await fixture.query(`select user_id from public.${table}`)).rows;
          assert.deepEqual(visible.map((row) => row.user_id), [id]);
          assert.deepEqual((await fixture.query(`select * from public.${table} where user_id=$1`, [other])).rows, []);
        }
        await denyDirectWrites(id);
      }
      assert.deepEqual(await snapshot(alice), originalA);
      assert.deepEqual(await snapshot(bob), originalB);
    });

    await t.test("missing identity and private RPC helpers cannot bypass the public ownership boundary", async () => {
      await actor("authenticated");
      await rejected("select public.lucid_save_state(0,$1::jsonb)", [stateA], "PT401");
      for (const role of ["anon", "authenticated"]) {
        await actor(role, role === "authenticated" ? alice : "");
        await rejected("select public.lucid_save_state_v2_base(0,$1::jsonb)", [stateA]);
        await rejected("select public.lucid_shared_merge('{}','{}')");
        await rejected("select public.lucid_v2_value_valid($1::jsonb,'state')", [stateA]);
      }
    });

    await t.test("stale CAS fails without changing either account and the current revision can save", async () => {
      await actor("authenticated", alice);
      await rejected("select public.lucid_save_state(0,$1::jsonb)", [stateA], "PT409");
      assert.deepEqual(await snapshot(alice), originalA);
      assert.deepEqual(await snapshot(bob), originalB);
      await actor("authenticated", alice);
      assert.equal(await save(stateA, 1), 2);
      assert.deepEqual(await snapshot(bob), originalB);
    });

    await t.test("deleting A cascades its state/activity and stale A claims cannot recreate rows or affect B", async () => {
      await owner();
      assert.equal((await fixture.query("delete from auth.users where id=$1 returning id", [alice])).rows.length, 1);
      assert.deepEqual(await snapshot(alice), { state: [], activities: [] });
      assert.deepEqual(await snapshot(bob), originalB);
      await actor("authenticated", alice);
      assert.equal((await fixture.query("select auth.uid() id")).rows[0].id, alice,
        "The fixture deliberately retains the deleted account's stale claims");
      for (const table of ["lucid_state", "lucid_activity"]) {
        assert.deepEqual((await fixture.query(`select * from public.${table}`)).rows, []);
      }
      for (const revision of [0, 2]) {
        await rejected("select public.lucid_save_state($1,$2::jsonb)", [revision, stateA], "PT401");
      }
      assert.deepEqual(await snapshot(alice), { state: [], activities: [] });
      assert.deepEqual(await snapshot(bob), originalB);
    });

    await t.test("a new UUID with A's same email starts empty and cannot recover the deleted UUID's data", async () => {
      await owner();
      await fixture.query("insert into auth.users(id,aud,role,email,created_at,updated_at) values($1,'authenticated','authenticated',$2,now(),now())", [replacement, aliceEmail]);
      await actor("authenticated", replacement);
      for (const table of ["lucid_state", "lucid_activity"]) {
        assert.deepEqual((await fixture.query(`select * from public.${table}`)).rows, []);
      }
      await rejected("select public.lucid_save_state(2,$1::jsonb)", [stateA], "PT409");
      assert.deepEqual(await snapshot(replacement), { state: [], activities: [] });
      await actor("authenticated", replacement);
      assert.equal(await save(learningState(null, "Synthetic replacement learner"), 0), 1);
      const fresh = await snapshot(replacement);
      assert.deepEqual(fresh.state[0].state.introducedWordIds, []);
      assert.deepEqual(fresh.state[0].state.favouriteWordIds, []);
      assert.deepEqual(fresh.activities, []);
      assert.deepEqual(await snapshot(alice), { state: [], activities: [] });
      assert.deepEqual(await snapshot(bob), originalB);
    });

    await t.test("rollback removes every synthetic account, state and activity", async () => {
      await owner();
      await fixture.exec("rollback");
      transactionOpen = false;
      const counts = (await fixture.query("select (select count(*)::int from auth.users) users,(select count(*)::int from public.lucid_state) states,(select count(*)::int from public.lucid_activity) activities")).rows[0];
      assert.deepEqual(counts, { users: 0, states: 0, activities: 0 });
    });
  } finally {
    try {
      if (transactionOpen) await fixture.exec("reset role; rollback;");
    } finally {
      await fixture.close();
    }
  }
});
