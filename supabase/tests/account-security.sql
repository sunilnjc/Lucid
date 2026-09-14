-- Lucid account-storage security smoke test.
-- Run the ENTIRE script in Supabase Dashboard > SQL Editor using its admin role.
-- Requires migration 202609140001_lucid_accounts.sql to have been applied.
-- No extensions, email delivery, JWT issuance, or external services are used.
-- This simulates PostgREST's verified claims with transaction-local settings; it
-- tests SQL grants/RLS/RPC behavior, not the authentication gateway itself.
--
-- Only these synthetic UUIDs are written, after collision checks:
--   learner A: 8d8cd2a4-f092-4757-b689-75c94284c2a1
--   learner B: 8d8cd2a4-f092-4757-b689-75c94284c2a2
--   missing C: 8d8cd2a4-f092-4757-b689-75c94284c2a3 (never inserted)
-- Every INSERT/UPDATE is inside BEGIN/ROLLBACK. There is intentionally no COMMIT.
-- If the editor stops on a failed assertion, run ROLLBACK; before retrying.

BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

DO $preflight$
BEGIN
  IF to_regclass('public.lucid_state') IS NULL
     OR to_regclass('public.lucid_activity') IS NULL
     OR to_regprocedure('public.lucid_save_state(bigint,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'FAIL preflight: apply the Lucid account migration first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id IN (
      '8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid,
      '8d8cd2a4-f092-4757-b689-75c94284c2a2'::uuid,
      '8d8cd2a4-f092-4757-b689-75c94284c2a3'::uuid
    )
  ) OR EXISTS (
    SELECT 1 FROM public.lucid_state
    WHERE user_id IN (
      '8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid,
      '8d8cd2a4-f092-4757-b689-75c94284c2a2'::uuid,
      '8d8cd2a4-f092-4757-b689-75c94284c2a3'::uuid
    )
  ) OR EXISTS (
    SELECT 1 FROM public.lucid_activity
    WHERE user_id IN (
      '8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid,
      '8d8cd2a4-f092-4757-b689-75c94284c2a2'::uuid,
      '8d8cd2a4-f092-4757-b689-75c94284c2a3'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'FAIL preflight: a reserved test UUID already exists; no test data was inserted';
  END IF;

  -- A rollback cannot undo an HTTP/email call made by an application trigger.
  -- This fresh-project test refuses to run around unknown application triggers.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid IN ('auth.users'::regclass, 'public.lucid_state'::regclass, 'public.lucid_activity'::regclass)
      AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'FAIL preflight: inspect enabled application triggers before running synthetic account tests';
  END IF;
END
$preflight$;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  ('8d8cd2a4-f092-4757-b689-75c94284c2a1', 'authenticated', 'authenticated',
   'lucid-smoke-75c94284c2a1@example.invalid', now(), now()),
  ('8d8cd2a4-f092-4757-b689-75c94284c2a2', 'authenticated', 'authenticated',
   'lucid-smoke-75c94284c2a2@example.invalid', now(), now());

-- Anonymous clients must not be able to read either table or execute the RPC.
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{}';
SET LOCAL "request.jwt.claim.sub" = '';
DO $anonymous$
DECLARE
  denied boolean;
BEGIN
  IF current_user <> 'anon' THEN RAISE EXCEPTION 'FAIL: anonymous test did not switch roles'; END IF;
  denied := false;
  BEGIN
    PERFORM 1 FROM public.lucid_state LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: anon can read lucid_state'; END IF;

  denied := false;
  BEGIN
    PERFORM 1 FROM public.lucid_activity LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: anon can read lucid_activity'; END IF;

  denied := false;
  BEGIN
    PERFORM public.lucid_save_state(0, '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: anon can execute lucid_save_state'; END IF;
  RAISE NOTICE 'PASS: anonymous table reads and RPC execution are denied';
END
$anonymous$;
RESET ROLE;

-- A role alone is insufficient: the RPC also needs a live authenticated subject.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '';
DO $missing_subject$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.lucid_save_state(0, '{}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'PT401' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: authenticated role without a subject can save'; END IF;
  RAISE NOTICE 'PASS: missing authenticated subject returns PT401';
END
$missing_subject$;

SET LOCAL "request.jwt.claims" = '{"sub":"8d8cd2a4-f092-4757-b689-75c94284c2a3","role":"authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '8d8cd2a4-f092-4757-b689-75c94284c2a3';
DO $missing_user$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.lucid_save_state(0, '{}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'PT401' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: a subject absent from auth.users can save'; END IF;
  RAISE NOTICE 'PASS: nonexistent/deleted account cannot recreate learning state';
END
$missing_user$;

-- Create A's own record through the same RPC used by the native app.
SET LOCAL "request.jwt.claims" = '{"sub":"8d8cd2a4-f092-4757-b689-75c94284c2a1","role":"authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '8d8cd2a4-f092-4757-b689-75c94284c2a1';
DO $seed_a$
DECLARE
  revision bigint;
  payload jsonb := '{
    "schemaVersion":2,"displayName":"Synthetic learner A",
    "introducedWordIds":[],"currentWordIds":[],"progressByWordId":{},
    "sessions":[],"favouriteWordIds":[],"completedWordIdsToday":[],
    "settings":{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46},
    "reviewPromptMilestone":0,
    "activities":[{"id":"d824387e-6517-4f8d-9861-1aac2668e701","kind":"review",
      "wordId":"smoke-test-word","date":0,"dayKey":"2001-01-01","quality":1,"productive":false}]
  }'::jsonb;
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() <> '8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid THEN
    RAISE EXCEPTION 'FAIL: learner A context was not established';
  END IF;
  revision := public.lucid_save_state(0, payload);
  IF revision <> 1 THEN RAISE EXCEPTION 'FAIL: initial save did not return revision 1'; END IF;
  IF (SELECT count(*) FROM public.lucid_state WHERE user_id = auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'FAIL: A cannot read its own saved state';
  END IF;
  IF (SELECT count(*) FROM public.lucid_activity WHERE user_id = auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'FAIL: A cannot read its own saved activity';
  END IF;
  RAISE NOTICE 'PASS: initial CAS save and own-account reads work';
END
$seed_a$;

-- B deliberately uses the same event UUID. IDs are immutable within an account,
-- not shared between accounts; B must neither collide with nor reveal A's event.
SET LOCAL "request.jwt.claims" = '{"sub":"8d8cd2a4-f092-4757-b689-75c94284c2a2","role":"authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '8d8cd2a4-f092-4757-b689-75c94284c2a2';
DO $seed_b$
DECLARE
  payload jsonb := '{
    "schemaVersion":2,"displayName":"Synthetic learner B",
    "introducedWordIds":[],"currentWordIds":[],"progressByWordId":{},
    "sessions":[],"favouriteWordIds":[],"completedWordIdsToday":[],
    "settings":{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46},
    "reviewPromptMilestone":0,
    "activities":[{"id":"d824387e-6517-4f8d-9861-1aac2668e701","kind":"review",
      "wordId":"other-smoke-word","date":0,"dayKey":"2001-01-01","quality":3,"productive":true}]
  }'::jsonb;
BEGIN
  IF public.lucid_save_state(0, payload) <> 1 THEN RAISE EXCEPTION 'FAIL: B initial save failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.lucid_state WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a1')
     OR EXISTS (SELECT 1 FROM public.lucid_activity WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a1') THEN
    RAISE EXCEPTION 'FAIL: B can read A learning data';
  END IF;
  IF (SELECT count(*) FROM public.lucid_state) <> 1 OR (SELECT count(*) FROM public.lucid_activity) <> 1 THEN
    RAISE EXCEPTION 'FAIL: B sees records other than its own';
  END IF;
  RAISE NOTICE 'PASS: B is isolated from A, including a reused event UUID';
END
$seed_b$;

SET LOCAL "request.jwt.claims" = '{"sub":"8d8cd2a4-f092-4757-b689-75c94284c2a1","role":"authenticated"}';
SET LOCAL "request.jwt.claim.sub" = '8d8cd2a4-f092-4757-b689-75c94284c2a1';
DO $owner_and_cas$
DECLARE
  denied boolean;
  before_state jsonb;
  before_revision bigint;
  field_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.lucid_state WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a2')
     OR EXISTS (SELECT 1 FROM public.lucid_activity WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a2') THEN
    RAISE EXCEPTION 'FAIL: A can read B learning data';
  END IF;
  SELECT state, revision INTO STRICT before_state, before_revision
  FROM public.lucid_state WHERE user_id = auth.uid();
  IF before_state->>'displayName' <> 'Synthetic learner A' OR before_revision <> 1 THEN
    RAISE EXCEPTION 'FAIL: A own-state read returned the wrong record';
  END IF;

  denied := false;
  BEGIN
    UPDATE public.lucid_state SET revision = revision + 100 WHERE user_id = auth.uid();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct state UPDATE bypasses CAS'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.lucid_activity (user_id, event_id, payload)
    VALUES (auth.uid(), 'd824387e-6517-4f8d-9861-1aac2668e702', '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct activity INSERT bypasses RPC validation'; END IF;

  denied := false;
  BEGIN
    DELETE FROM public.lucid_state WHERE user_id = auth.uid();
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct state DELETE is unexpectedly granted'; END IF;
  RAISE NOTICE 'PASS: A cannot read B and authenticated clients cannot bypass RPC writes';

  denied := false;
  BEGIN
    PERFORM public.lucid_save_state(0, before_state || '{"displayName":"Stale overwrite"}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'FAIL: stale revision did not return PT409'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lucid_state
      WHERE user_id = auth.uid() AND state = before_state AND revision = before_revision) THEN
    RAISE EXCEPTION 'FAIL: rejected stale write changed state or revision';
  END IF;
  RAISE NOTICE 'PASS: stale CAS returns PT409 and preserves the existing record';

  FOREACH field_name IN ARRAY ARRAY['practiceDrafts', 'reviewAttempts'] LOOP
    denied := false;
    BEGIN
      PERFORM public.lucid_save_state(before_revision,
        before_state || jsonb_build_object(field_name, jsonb_build_object('test-only', 'must remain local')));
    EXCEPTION WHEN SQLSTATE 'PT400' THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'FAIL: private field % was accepted', field_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lucid_state
        WHERE user_id = auth.uid() AND state = before_state AND revision = before_revision) THEN
      RAISE EXCEPTION 'FAIL: rejected private field % changed the record', field_name;
    END IF;
    RAISE NOTICE 'PASS: private field % rejected atomically with PT400', field_name;
  END LOOP;
END
$owner_and_cas$;

DO $immutable_events$
DECLARE
  payload jsonb;
  original_event jsonb;
  conflicting_event jsonb;
  new_event jsonb := '{"id":"d824387e-6517-4f8d-9861-1aac2668e702","kind":"review",
    "wordId":"smoke-test-word","date":86400,"dayKey":"2001-01-02","quality":2,"productive":true}'::jsonb;
BEGIN
  SELECT state INTO STRICT payload FROM public.lucid_state WHERE user_id = auth.uid();
  SELECT a.payload INTO STRICT original_event FROM public.lucid_activity AS a
  WHERE a.user_id = auth.uid() AND a.event_id = 'd824387e-6517-4f8d-9861-1aac2668e701';
  conflicting_event := original_event || '{"quality":3,"productive":true}'::jsonb;
  payload := jsonb_set(payload, '{activities}', jsonb_build_array(conflicting_event, new_event));
  IF public.lucid_save_state(1, payload) <> 2 THEN RAISE EXCEPTION 'FAIL: second CAS save failed'; END IF;

  IF (SELECT a.payload FROM public.lucid_activity AS a
      WHERE a.user_id = auth.uid() AND a.event_id = 'd824387e-6517-4f8d-9861-1aac2668e701') IS DISTINCT FROM original_event THEN
    RAISE EXCEPTION 'FAIL: an existing immutable event was replaced by a conflicting payload';
  END IF;
  IF (SELECT count(*) FROM public.lucid_activity WHERE user_id = auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'FAIL: event collision duplicated a row or prevented the new event';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lucid_state AS s
    CROSS JOIN LATERAL jsonb_array_elements(s.state->'activities') AS event(value)
    WHERE s.user_id = auth.uid() AND event.value = original_event
  ) THEN
    RAISE EXCEPTION 'FAIL: state snapshot kept the conflicting event instead of the original';
  END IF;
  RAISE NOTICE 'PASS: immutable event collision preserves the original and accepts a new event';

  -- An old/offline client may omit history. Stored immutable events must survive.
  payload := jsonb_set(payload, '{activities}', '[]'::jsonb);
  IF public.lucid_save_state(2, payload) <> 3 THEN RAISE EXCEPTION 'FAIL: third CAS save failed'; END IF;
  IF (SELECT count(*) FROM public.lucid_activity WHERE user_id = auth.uid()) <> 2
     OR (SELECT jsonb_array_length(state->'activities') FROM public.lucid_state WHERE user_id = auth.uid()) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FAIL: omitted events disappeared from storage or the state snapshot';
  END IF;
  RAISE NOTICE 'PASS: omitted activity history survives later writes';
END
$immutable_events$;
RESET ROLE;

-- Admin-context assertions ensure A's tests did not change B or create C.
DO $final_checks$
BEGIN
  IF (SELECT revision FROM public.lucid_state WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a2') IS DISTINCT FROM 1
     OR (SELECT state->>'displayName' FROM public.lucid_state WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a2') IS DISTINCT FROM 'Synthetic learner B'
     OR (SELECT payload->>'quality' FROM public.lucid_activity
         WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a2'
           AND event_id = 'd824387e-6517-4f8d-9861-1aac2668e701') IS DISTINCT FROM '3' THEN
    RAISE EXCEPTION 'FAIL: A changed B state or its same-UUID event';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lucid_state WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a3')
     OR EXISTS (SELECT 1 FROM public.lucid_activity WHERE user_id = '8d8cd2a4-f092-4757-b689-75c94284c2a3') THEN
    RAISE EXCEPTION 'FAIL: nonexistent account acquired learning rows';
  END IF;
  RAISE NOTICE 'PASS: all Lucid SQL security assertions completed; rolling back every synthetic row';
END
$final_checks$;

SELECT 'All SQL security assertions passed; synthetic fixtures will now be rolled back.' AS security_test_result;
ROLLBACK;

-- Read-only cleanup verification. Each count must be zero.
SELECT
  (SELECT count(*) FROM auth.users
   WHERE id IN ('8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid, '8d8cd2a4-f092-4757-b689-75c94284c2a2'::uuid)) AS synthetic_users_remaining,
  (SELECT count(*) FROM public.lucid_state
   WHERE user_id IN ('8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid, '8d8cd2a4-f092-4757-b689-75c94284c2a2'::uuid)) AS synthetic_states_remaining,
  (SELECT count(*) FROM public.lucid_activity
   WHERE user_id IN ('8d8cd2a4-f092-4757-b689-75c94284c2a1'::uuid, '8d8cd2a4-f092-4757-b689-75c94284c2a2'::uuid)) AS synthetic_events_remaining;
