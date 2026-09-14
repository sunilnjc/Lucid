-- Lucid account-storage security smoke test.
-- Run the ENTIRE script in Supabase Dashboard > SQL Editor using its admin role.
-- Requires BOTH 202609140001_lucid_accounts.sql and 202609140002_lucid_payload_validation.sql.
-- Includes new nested-payload tests; uses only the original reserved synthetic UUIDs.
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
     OR to_regprocedure('public.lucid_save_state(bigint,jsonb)') IS NULL
     OR to_regprocedure('public.lucid_v2_value_valid(jsonb,text)') IS NULL THEN
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

-- New v2 nested-payload assertions. Run as the SQL editor owner.
-- The native_state JSON below was emitted by the checked-in Swift
-- LearningMerge.cloudRecord encoder, including Date.distantPast and stripped drafts.
DO $payload_shapes$
DECLARE
  native_state jsonb := $native${"activities":[{"date":811209600,"dayKey":"2026-09-15","id":"66666666-6666-6666-6666-666666666666","kind":"practice","productive":false,"quality":2,"wordId":"finance-reconcile"}],"completedWordIdsToday":["finance-reconcile"],"currentLessonDate":811209600,"currentWordIds":["finance-reconcile"],"dailyWordGoal":3,"displayName":"Test learner","favouriteChanges":{"finance-reconcile":{"selected":true,"updatedAt":811209600}},"favouriteWordIds":["finance-reconcile"],"introducedWordIds":["finance-reconcile"],"lessonDayKey":"2026-09-15","profile":{"goalIds":["clarity"],"roleId":"finance-accounting","seniorityId":"early-career","situationIds":["finance-month-end-close"]},"profileUpdatedAt":811209600,"progressByWordId":{"finance-reconcile":{"intervalIndex":0,"introducedOn":811209600,"lapses":0,"mastered":false,"nextReviewOn":811209600,"reviewCount":0,"successfulReviewDates":[]}},"reviewPromptMilestone":0,"schemaVersion":2,"sessions":[{"completedAt":811209600,"date":811209600,"dayKey":"2026-09-15","id":"55555555-5555-5555-5555-555555555555","wordIds":["finance-reconcile"]}],"settings":{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46},"updatedAt":-63114076800}$native$::jsonb;
  label text;
  bad jsonb;
BEGIN
  IF public.lucid_v2_value_valid(native_state, 'state') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: native Swift cloudRecord fixture was rejected';
  END IF;
  IF native_state ?| ARRAY['practiceDrafts', 'reviewAttempts'] THEN
    RAISE EXCEPTION 'FAIL: generated native fixture leaked private fields';
  END IF;
  IF public.lucid_v2_value_valid(native_state - 'activities', 'state') IS DISTINCT FROM true
     OR public.lucid_v2_value_valid(jsonb_set(native_state, '{activities}', 'null'), 'state') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: optional activity history missing/null rejected';
  END IF;
  IF public.lucid_v2_value_valid(native_state - 'profile' - 'displayName' - 'dailyWordGoal', 'state') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: pre-onboarding account payload rejected';
  END IF;
  IF public.lucid_v2_value_valid(
       jsonb_set(jsonb_set(native_state, '{activities,0,kind}', '"lesson"'), '{activities,0,wordId}', 'null'), 'state') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: lesson event with no word ID rejected';
  END IF;
  IF public.lucid_v2_value_valid(
       jsonb_set(native_state, '{activities,0,dayKey}', '"2024-02-29"'), 'state') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: valid leap-day activity rejected';
  END IF;
  FOR label, bad IN SELECT * FROM (VALUES
    ('missing required state fields', native_state - 'currentWordIds'),
    ('future schema version', jsonb_set(native_state, '{schemaVersion}', '3')),
    ('string schema version', jsonb_set(native_state, '{schemaVersion}', '"2"')),
    ('nested profile string', jsonb_set(native_state, '{profile}', '"not a profile"')),
    ('empty role', jsonb_set(native_state, '{profile,roleId}', '""')),
    ('numeric situation identifier', jsonb_set(native_state, '{profile,situationIds}', '[7]')),
    ('empty profile goal list', jsonb_set(native_state, '{profile,goalIds}', '[]')),
    ('private field nested in profile', jsonb_set(native_state, '{profile,practiceDrafts}', '{"private":"text"}')),
    ('progress map array', jsonb_set(native_state, '{progressByWordId}', '[]')),
    ('out-of-range interval', jsonb_set(native_state, '{progressByWordId,finance-reconcile,intervalIndex}', '5')),
    ('fractional review count', jsonb_set(native_state, '{progressByWordId,finance-reconcile,reviewCount}', '1.5')),
    ('negative lapse count', jsonb_set(native_state, '{progressByWordId,finance-reconcile,lapses}', '-1')),
    ('unsafe date magnitude', jsonb_set(native_state, '{progressByWordId,finance-reconcile,nextReviewOn}', '1e309')),
    ('date represented as string', jsonb_set(native_state, '{progressByWordId,finance-reconcile,nextReviewOn}', '"tomorrow"')),
    ('invalid successful-review date', jsonb_set(native_state, '{progressByWordId,finance-reconcile,successfulReviewDates}', '["yesterday"]')),
    ('string mastery flag', jsonb_set(native_state, '{progressByWordId,finance-reconcile,mastered}', '"true"')),
    ('malformed activity UUID', jsonb_set(native_state, '{activities,0,id}', '"not-a-uuid"')),
    ('fractional activity quality', jsonb_set(native_state, '{activities,0,quality}', '2.5')),
    ('missing practice word', native_state #- '{activities,0,wordId}'),
    ('impossible calendar date', jsonb_set(native_state, '{activities,0,dayKey}', '"2026-02-31"')),
    ('calendar year zero', jsonb_set(native_state, '{activities,0,dayKey}', '"0000-01-01"')),
    ('unknown activity kind', jsonb_set(native_state, '{activities,0,kind}', '"reset"')),
    ('string productive flag', jsonb_set(native_state, '{activities,0,productive}', '"false"')),
    ('private response nested in event', jsonb_set(native_state, '{activities,0,response}', '"private practice text"')),
    ('out-of-range reminder hour', jsonb_set(native_state, '{settings,reminderHour}', '24')),
    ('out-of-range reminder minute', jsonb_set(native_state, '{settings,reminderMinute}', '60')),
    ('wrong notification flag', jsonb_set(native_state, '{settings,notificationsEnabled}', '"false"')),
    ('unsafe playback speed', jsonb_set(native_state, '{settings,speechRate}', '4')),
    ('missing settings property', native_state #- '{settings,reminderHour}'),
    ('favourite string flag', jsonb_set(native_state, '{favouriteChanges,finance-reconcile,selected}', '"true"')),
    ('favourite invalid timestamp', jsonb_set(native_state, '{favouriteChanges,finance-reconcile,updatedAt}', '"later"')),
    ('invalid session UUID', jsonb_set(native_state, '{sessions,0,id}', '"invalid"')),
    ('invalid session word IDs', jsonb_set(native_state, '{sessions,0,wordIds}', '[{}]')),
    ('invalid session day', jsonb_set(native_state, '{sessions,0,dayKey}', '"2026-13-10"')),
    ('oversized current lesson', jsonb_set(native_state, '{currentWordIds}', '["a","b","c","d"]')),
    ('private drafts present even as null', native_state || '{"practiceDrafts":null}'::jsonb),
    ('private attempts present even as null', native_state || '{"reviewAttempts":null}'::jsonb),
    ('unknown root data', native_state || '{"unknownText":"must not be uploaded"}'::jsonb)
  ) AS invalid(label, payload) LOOP
    IF public.lucid_v2_value_valid(bad, 'state') IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'FAIL: malformed payload accepted: %', label;
    END IF;
    RAISE NOTICE 'PASS: rejected %', label;
  END LOOP;
  IF has_function_privilege('anon', 'public.lucid_v2_value_valid(jsonb,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.lucid_v2_value_valid(jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: validation helper was exposed to client roles';
  END IF;
  RAISE NOTICE 'PASS: native fixture and optional fields accepted; 38 malformed cases rejected; helper stays private';
END
$payload_shapes$;

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

-- Additional malformed-RPC tests: owner A is still selected here.
DO $malformed_rpc$
DECLARE
  native_state jsonb := $native${"activities":[{"date":811209600,"dayKey":"2026-09-15","id":"66666666-6666-6666-6666-666666666666","kind":"practice","productive":false,"quality":2,"wordId":"finance-reconcile"}],"completedWordIdsToday":["finance-reconcile"],"currentLessonDate":811209600,"currentWordIds":["finance-reconcile"],"dailyWordGoal":3,"displayName":"Test learner","favouriteChanges":{"finance-reconcile":{"selected":true,"updatedAt":811209600}},"favouriteWordIds":["finance-reconcile"],"introducedWordIds":["finance-reconcile"],"lessonDayKey":"2026-09-15","profile":{"goalIds":["clarity"],"roleId":"finance-accounting","seniorityId":"early-career","situationIds":["finance-month-end-close"]},"profileUpdatedAt":811209600,"progressByWordId":{"finance-reconcile":{"intervalIndex":0,"introducedOn":811209600,"lapses":0,"mastered":false,"nextReviewOn":811209600,"reviewCount":0,"successfulReviewDates":[]}},"reviewPromptMilestone":0,"schemaVersion":2,"sessions":[{"completedAt":811209600,"date":811209600,"dayKey":"2026-09-15","id":"55555555-5555-5555-5555-555555555555","wordIds":["finance-reconcile"]}],"settings":{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46},"updatedAt":-63114076800}$native$::jsonb;
  before_state jsonb;
  before_revision bigint;
  before_events bigint;
  denied boolean;
  label text;
  bad jsonb;
BEGIN
  SELECT state, revision INTO STRICT before_state, before_revision
  FROM public.lucid_state WHERE user_id = auth.uid();
  SELECT count(*) INTO before_events FROM public.lucid_activity WHERE user_id = auth.uid();
  FOR label, bad IN SELECT * FROM (VALUES
    ('missing required state fields', native_state - 'currentWordIds'),
    ('future schema version', jsonb_set(native_state, '{schemaVersion}', '3')),
    ('string schema version', jsonb_set(native_state, '{schemaVersion}', '"2"')),
    ('nested profile string', jsonb_set(native_state, '{profile}', '"not a profile"')),
    ('empty role', jsonb_set(native_state, '{profile,roleId}', '""')),
    ('numeric situation identifier', jsonb_set(native_state, '{profile,situationIds}', '[7]')),
    ('empty profile goal list', jsonb_set(native_state, '{profile,goalIds}', '[]')),
    ('private field nested in profile', jsonb_set(native_state, '{profile,practiceDrafts}', '{"private":"text"}')),
    ('progress map array', jsonb_set(native_state, '{progressByWordId}', '[]')),
    ('out-of-range interval', jsonb_set(native_state, '{progressByWordId,finance-reconcile,intervalIndex}', '5')),
    ('fractional review count', jsonb_set(native_state, '{progressByWordId,finance-reconcile,reviewCount}', '1.5')),
    ('negative lapse count', jsonb_set(native_state, '{progressByWordId,finance-reconcile,lapses}', '-1')),
    ('unsafe date magnitude', jsonb_set(native_state, '{progressByWordId,finance-reconcile,nextReviewOn}', '1e309')),
    ('date represented as string', jsonb_set(native_state, '{progressByWordId,finance-reconcile,nextReviewOn}', '"tomorrow"')),
    ('invalid successful-review date', jsonb_set(native_state, '{progressByWordId,finance-reconcile,successfulReviewDates}', '["yesterday"]')),
    ('string mastery flag', jsonb_set(native_state, '{progressByWordId,finance-reconcile,mastered}', '"true"')),
    ('malformed activity UUID', jsonb_set(native_state, '{activities,0,id}', '"not-a-uuid"')),
    ('fractional activity quality', jsonb_set(native_state, '{activities,0,quality}', '2.5')),
    ('missing practice word', native_state #- '{activities,0,wordId}'),
    ('impossible calendar date', jsonb_set(native_state, '{activities,0,dayKey}', '"2026-02-31"')),
    ('calendar year zero', jsonb_set(native_state, '{activities,0,dayKey}', '"0000-01-01"')),
    ('unknown activity kind', jsonb_set(native_state, '{activities,0,kind}', '"reset"')),
    ('string productive flag', jsonb_set(native_state, '{activities,0,productive}', '"false"')),
    ('private response nested in event', jsonb_set(native_state, '{activities,0,response}', '"private practice text"')),
    ('out-of-range reminder hour', jsonb_set(native_state, '{settings,reminderHour}', '24')),
    ('out-of-range reminder minute', jsonb_set(native_state, '{settings,reminderMinute}', '60')),
    ('wrong notification flag', jsonb_set(native_state, '{settings,notificationsEnabled}', '"false"')),
    ('unsafe playback speed', jsonb_set(native_state, '{settings,speechRate}', '4')),
    ('missing settings property', native_state #- '{settings,reminderHour}'),
    ('favourite string flag', jsonb_set(native_state, '{favouriteChanges,finance-reconcile,selected}', '"true"')),
    ('favourite invalid timestamp', jsonb_set(native_state, '{favouriteChanges,finance-reconcile,updatedAt}', '"later"')),
    ('invalid session UUID', jsonb_set(native_state, '{sessions,0,id}', '"invalid"')),
    ('invalid session word IDs', jsonb_set(native_state, '{sessions,0,wordIds}', '[{}]')),
    ('invalid session day', jsonb_set(native_state, '{sessions,0,dayKey}', '"2026-13-10"')),
    ('oversized current lesson', jsonb_set(native_state, '{currentWordIds}', '["a","b","c","d"]')),
    ('private drafts present even as null', native_state || '{"practiceDrafts":null}'::jsonb),
    ('private attempts present even as null', native_state || '{"reviewAttempts":null}'::jsonb),
    ('unknown root data', native_state || '{"unknownText":"must not be uploaded"}'::jsonb)
  ) AS invalid(label, payload) LOOP
    denied := false;
    BEGIN
      PERFORM public.lucid_save_state(before_revision, bad);
    EXCEPTION WHEN SQLSTATE 'PT400' THEN denied := true;
    END;
    -- Unexpected cast/constraint errors intentionally fail this script, rather
    -- than counting as a friendly PT400 validation rejection.
    IF NOT denied THEN RAISE EXCEPTION 'FAIL: RPC accepted malformed %', label; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lucid_state
        WHERE user_id = auth.uid() AND state = before_state AND revision = before_revision)
       OR (SELECT count(*) FROM public.lucid_activity WHERE user_id = auth.uid()) <> before_events THEN
      RAISE EXCEPTION 'FAIL: rejected % changed state/revision/activities', label;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS: all 38 malformed RPC inputs return PT400 atomically';
END
$malformed_rpc$;

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

DO $native_rpc$
DECLARE
  payload jsonb := $native${"activities":[{"date":811209600,"dayKey":"2026-09-15","id":"66666666-6666-6666-6666-666666666666","kind":"practice","productive":false,"quality":2,"wordId":"finance-reconcile"}],"completedWordIdsToday":["finance-reconcile"],"currentLessonDate":811209600,"currentWordIds":["finance-reconcile"],"dailyWordGoal":3,"displayName":"Test learner","favouriteChanges":{"finance-reconcile":{"selected":true,"updatedAt":811209600}},"favouriteWordIds":["finance-reconcile"],"introducedWordIds":["finance-reconcile"],"lessonDayKey":"2026-09-15","profile":{"goalIds":["clarity"],"roleId":"finance-accounting","seniorityId":"early-career","situationIds":["finance-month-end-close"]},"profileUpdatedAt":811209600,"progressByWordId":{"finance-reconcile":{"intervalIndex":0,"introducedOn":811209600,"lapses":0,"mastered":false,"nextReviewOn":811209600,"reviewCount":0,"successfulReviewDates":[]}},"reviewPromptMilestone":0,"schemaVersion":2,"sessions":[{"completedAt":811209600,"date":811209600,"dayKey":"2026-09-15","id":"55555555-5555-5555-5555-555555555555","wordIds":["finance-reconcile"]}],"settings":{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46},"updatedAt":-63114076800}$native$::jsonb;
  prior_revision bigint;
BEGIN
  SELECT revision INTO STRICT prior_revision FROM public.lucid_state WHERE user_id = auth.uid();
  payload := jsonb_set(payload, '{settings}',
    '{"notificationsEnabled":true,"reminderHour":18,"reminderMinute":30,"speechRate":0.5}'::jsonb);
  IF public.lucid_save_state(prior_revision, payload) <> prior_revision + 1 THEN
    RAISE EXCEPTION 'FAIL: valid native encoder payload failed CAS save';
  END IF;
  IF (SELECT state->'settings' FROM public.lucid_state WHERE user_id = auth.uid()) IS DISTINCT FROM
      '{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46}'::jsonb THEN
    RAISE EXCEPTION 'FAIL: device notification/playback settings leaked into cloud state';
  END IF;
  IF (SELECT state ?| ARRAY['practiceDrafts', 'reviewAttempts'] FROM public.lucid_state WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'FAIL: native private fields reached cloud storage';
  END IF;
  IF (SELECT count(*) FROM public.lucid_activity WHERE user_id = auth.uid()) <> 3 THEN
    RAISE EXCEPTION 'FAIL: native RPC save did not preserve old immutable events plus its new event';
  END IF;
  RAISE NOTICE 'PASS: full native payload saves with CAS; settings normalized and immutable history preserved';
END
$native_rpc$;
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
