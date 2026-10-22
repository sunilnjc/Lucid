-- Synthetic shared-progress SQL acceptance. Real PG grants/RLS/RPC; claims gateway is simulated.
-- Apply proposals in a disposable database. Do not run against production.
-- All synthetic fixtures and temporary helper functions are rolled back.
BEGIN;
SET LOCAL statement_timeout='30s';
DO $preflight$ BEGIN
  if exists(select 1 from auth.users where id in ('d3041440-1111-4111-8111-111111111111','d3041440-2222-4222-8222-222222222222')) then
    raise exception 'Synthetic account UUID collision';
  end if;
  if exists(select 1 from pg_catalog.pg_trigger where tgrelid in ('auth.users'::regclass,'public.lucid_state'::regclass,'public.lucid_activity'::regclass) and not tgisinternal and tgenabled<>'D') then
    raise exception 'Unknown enabled application trigger';
  end if;
END $preflight$;
INSERT INTO auth.users(id,aud,role,email,created_at,updated_at) VALUES
 ('d3041440-1111-4111-8111-111111111111','authenticated','authenticated','shared-a@example.invalid',now(),now()),
 ('d3041440-2222-4222-8222-222222222222','authenticated','authenticated','shared-b@example.invalid',now(),now());

create function pg_temp.shared_fixture() returns jsonb language sql as $fixture$
select jsonb_build_object(
 'schemaVersion',2,'introducedWordIds',jsonb_build_array('finance-reconcile'),'currentWordIds',jsonb_build_array('finance-reconcile'),
 'progressByWordId',jsonb_build_object('finance-reconcile',jsonb_build_object('introducedOn',extract(epoch from now()-interval '40 days')-978307200,'intervalIndex',4,'nextReviewOn',extract(epoch from now()+interval '30 days')-978307200,'reviewCount',100,'successfulReviewDates','[]'::jsonb,'lapses',0,'mastered',true)),
 'sessions','[]'::jsonb,'favouriteWordIds','[]'::jsonb,'completedWordIdsToday','[]'::jsonb,
 'settings','{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46}'::jsonb,'reviewPromptMilestone',0,
 'contextIntroducedOn',jsonb_build_object('finance-reconcile::finance-accounting',extract(epoch from now()-interval '40 days')-978307200),
 'contextEvidence',jsonb_build_array(jsonb_build_object('id','77777777-7777-4777-8777-777777777777','wordId','finance-reconcile','roleId','finance-accounting','senseId','finance-reconcile::finance-accounting','date',to_char(now()-interval '2 days','YYYY-MM-DD'),'recordedAt',extract(epoch from now()-interval '2 days')-978307200,'capturedAt',extract(epoch from now()-interval '2 days 1 hour')-978307200,'kind','unaided-recall','quality',2,'independent',true)),
 'sharedLearning',jsonb_build_object('version',1,
   'lessonCheckpoints',jsonb_build_object('2001-01-01:finance-accounting',jsonb_build_object('roleId','finance-accounting','dayKey','2001-01-01','wordIds',jsonb_build_array('finance-reconcile'),'completedWordIds','[]'::jsonb,'cursorWordId','finance-reconcile','answers',jsonb_build_object('finance-reconcile',jsonb_build_object('choiceId','meaning-0','hinted',true)),'updatedAt',to_char(now()-interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
   'startingChecks',jsonb_build_object('finance-accounting',jsonb_build_object('roleId','finance-accounting','pathId','finance-foundations-v1','questionIds',jsonb_build_array('finance-start-1','finance-start-2','finance-start-3','finance-start-4','finance-start-5','finance-start-6'),'answers',jsonb_build_array(0,2),'updatedAt',to_char(now()-interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
   'notebook',jsonb_build_object('11111111-1111-4111-8111-111111111111',jsonb_build_object('id','11111111-1111-4111-8111-111111111111','roleId','finance-accounting','expressionId','bridge-the-difference','style','precise','phrase', 'Let''s reconcile the two accounts before making a decision.','createdAt',to_char(now()-interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'nextReviewOn',to_char(now()+interval '1 day','YYYY-MM-DD'))),
   'rehearsals',jsonb_build_object('22222222-2222-4222-8222-222222222222',jsonb_build_object('id','22222222-2222-4222-8222-222222222222','roleId','finance-accounting','scenarioId','bridge-the-difference-disagreement','expressionId','bridge-the-difference','mode','initial','startedAt',to_char(now()-interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'modelSeen',true)),
   'challenges',jsonb_build_object('finance-transfer-5',jsonb_build_object('id','finance-transfer-5','roleId','finance-accounting','mode','transfer','milestone',5,'startedAt',to_char(now()-interval '2 days','YYYY-MM-DD"T"HH24:MI:SS"Z"'),'scenarioIds',jsonb_build_array('bridge-the-difference-disagreement'),'completedScenarioIds','[]'::jsonb)),
   'exposures',jsonb_build_object('finance-reconcile::finance-accounting',jsonb_build_object('dayKey',to_char(now()-interval '2 days','YYYY-MM-DD'),'firstSeenAt',to_char(now()-interval '2 days 30 minutes','YYYY-MM-DD"T"HH24:MI:SS"Z"')))
  )
)
$fixture$;

DO $validator$ DECLARE payload jsonb:=pg_temp.shared_fixture(); bad jsonb; label text;
BEGIN
 if not public.lucid_shared_value_valid(payload->'sharedLearning','shared') then raise exception 'Valid sharedfixture rejected'; end if;
 FOR label,bad IN SELECT * FROM (VALUES
  ('future version',jsonb_set(payload,'{sharedLearning,version}','2')),
  ('private situation',jsonb_set(payload,'{sharedLearning,notebook,11111111-1111-4111-8111-111111111111,situation}','"private"')),
  ('private original',jsonb_set(payload,'{sharedLearning,rehearsals,22222222-2222-4222-8222-222222222222,response}','"private"')),
  ('private check text',jsonb_set(payload,'{sharedLearning,startingChecks,finance-accounting,response}','"private"')),
  ('private answer text',jsonb_set(payload,'{sharedLearning,lessonCheckpoints,2001-01-01:finance-accounting,answers,finance-reconcile,response}','"private"')),
  ('freeform phrase',jsonb_set(payload,'{sharedLearning,notebook,11111111-1111-4111-8111-111111111111,phrase}','"private learner text"')),
  ('wrong notebook identity',jsonb_set(payload,'{sharedLearning,notebook,11111111-1111-4111-8111-111111111111,id}','"33333333-3333-4333-8333-333333333333"')),
  ('unknown scenario',jsonb_set(payload,'{sharedLearning,rehearsals,22222222-2222-4222-8222-222222222222,scenarioId}','"unknown-scenario"')),
  ('duplicate challenge scenario',jsonb_set(payload,'{sharedLearning,challenges,finance-transfer-5,scenarioIds}','["bridge-the-difference-disagreement","bridge-the-difference-disagreement"]')),
  ('unknown completion',jsonb_set(payload,'{sharedLearning,lessonCheckpoints,2001-01-01:finance-accounting,completedWordIds}','["unknown-word"]')),
  ('cursor outside plan',jsonb_set(payload,'{sharedLearning,lessonCheckpoints,2001-01-01:finance-accounting,cursorWordId}','"unknown-word"')),
  ('future timestamp',jsonb_set(payload,'{sharedLearning,notebook,11111111-1111-4111-8111-111111111111,createdAt}',to_jsonb(to_char(now()+interval '1 year','YYYY-MM-DD"T"HH24:MI:SS"Z"')))),
  ('impossible day',jsonb_set(payload,'{sharedLearning,lessonCheckpoints,2001-01-01:finance-accounting,dayKey}','"2026-02-31"')),
  ('excess check answer',jsonb_set(payload,'{sharedLearning,startingChecks,finance-accounting,answers}','[0,1,2,3,0,1,2]')),
  ('negative milestone',jsonb_set(payload,'{sharedLearning,challenges,finance-transfer-5,milestone}','-1')),
  ('unsupported rehearsal mode',jsonb_set(payload,'{sharedLearning,rehearsals,22222222-2222-4222-8222-222222222222,mode}','"production"'))
 )invalid(label,payload) LOOP
   if public.lucid_shared_value_valid(bad->'sharedLearning','shared') then raise exception 'Malformed shared accepted: %',label; end if;
 END LOOP;
 if has_function_privilege('authenticated','public.lucid_save_state_v2_base(bigint,jsonb)','execute')
    or has_function_privilege('authenticated','public.lucid_shared_merge(jsonb,jsonb)','execute')
    or has_table_privilege('authenticated','public.lucid_expression_phrase','insert') then raise exception 'Private helper/table writable'; end if;
 RAISE NOTICE 'PASS strict shared shape/authored phrase catalogue/private helpers (16 malformed fixtures)';
END $validator$;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub"='d3041440-1111-4111-8111-111111111111';
DO $save_a$ DECLARE p jsonb:=pg_temp.shared_fixture(); saved jsonb;
BEGIN
 if public.lucid_save_state(0,p)<>1 then raise exception 'Initial shared save failed'; end if;
 select state into saved from public.lucid_state where user_id=auth.uid();
 if saved->'sharedLearning'->'notebook' is distinct from p->'sharedLearning'->'notebook' then raise exception 'Notebook lost'; end if;
 if (saved->'progressByWordId'->'finance-reconcile'->>'mastered')::boolean then raise exception 'Aggregate forged mastery'; end if;
 if not(saved->'contextEvidence'->0->>'independent')::boolean then raise exception 'Original before exposure lost independence'; end if;
 RAISE NOTICE 'PASS initial CAS/complete shared record and capped aggregate mastery';
END $save_a$;
DO $invalid_atomic$ DECLARE p jsonb:=pg_temp.shared_fixture(); bad jsonb; label text; denied boolean; before_state jsonb;
BEGIN
 select state into before_state from public.lucid_state where user_id=auth.uid();
 FOR label,bad IN SELECT * FROM (VALUES
 ('future evidence',jsonb_set(p,'{contextEvidence,0,recordedAt}',to_jsonb(extract(epoch from now()+interval '1 day')-978307200))),
 ('backdated evidence',jsonb_set(p,'{contextEvidence,0,date}',to_jsonb(to_char(now()-interval '40 days','YYYY-MM-DD')))),
 ('capture after review',jsonb_set(p,'{contextEvidence,0,capturedAt}',to_jsonb(extract(epoch from now()-interval '1 day')-978307200))),
 ('private draft',p||'{"practiceDrafts":{}}'::jsonb),
 ('altered context identity',jsonb_set(p,'{contextEvidence,0,roleId}','"sales-business-development"')),
 ('reused notebook UUID',jsonb_set(jsonb_set(p,'{sharedLearning,notebook,11111111-1111-4111-8111-111111111111,style}','"plain"'),'{sharedLearning,notebook,11111111-1111-4111-8111-111111111111,phrase}','"Let''s compare the two accounts and explain the differences."'))
 )invalid(label,payload) LOOP
   denied:=false;
   begin perform public.lucid_save_state(1,bad); exception when sqlstate 'PT400' then denied:=true; end;
   if not denied then raise exception 'Invalid save accepted: %',label; end if;
   if (select revision from public.lucid_state where user_id=auth.uid())<>1 or (select state from public.lucid_state where user_id=auth.uid())<>before_state then raise exception 'Failed write mutated state: %',label; end if;
 END LOOP;
 RAISE NOTICE 'PASS six malformed writes rejected atomically/future/backdating/UUID collision';
END $invalid_atomic$;

DO $stale_and_merge$ DECLARE p jsonb:=pg_temp.shared_fixture(); saved jsonb; denied boolean:=false;
BEGIN
 begin perform public.lucid_save_state(0,p); exception when sqlstate 'PT409' then denied:=true; end;
 if not denied then raise exception 'Stale revision accepted'; end if;
 p:=jsonb_set(p,'{sharedLearning,lessonCheckpoints,2001-01-01:finance-accounting,completedWordIds}','["finance-reconcile"]');
 p:=jsonb_set(p,'{sharedLearning,lessonCheckpoints,2001-01-01:finance-accounting,answers,finance-reconcile,hinted}','false');
 p:=jsonb_set(p,'{sharedLearning,rehearsals,22222222-2222-4222-8222-222222222222,modelSeen}','false');
 p:=jsonb_set(p,'{sharedLearning,challenges,finance-transfer-5,completedScenarioIds}','["bridge-the-difference-disagreement"]');
 if public.lucid_save_state(1,p)<>2 then raise exception 'Merged CAS failed'; end if;
 select state into saved from public.lucid_state where user_id=auth.uid();
 if not(saved->'sharedLearning'->'lessonCheckpoints'->'2001-01-01:finance-accounting'->'answers'->'finance-reconcile'->>'hinted')::boolean
    or not(saved->'sharedLearning'->'rehearsals'->'22222222-2222-4222-8222-222222222222'->>'modelSeen')::boolean then raise exception 'Exposure erased'; end if;
 -- A legacy client omits all new metadata: unioned evidence/notebook/checkpoints survive.
 if public.lucid_save_state(2,p-'sharedLearning'-'contextEvidence'-'contextIntroducedOn')<>3 then raise exception 'Legacy omission save failed'; end if;
 select state into saved from public.lucid_state where user_id=auth.uid();
 if saved->'sharedLearning'->'lessonCheckpoints'->'2001-01-01:finance-accounting'->'completedWordIds'<>'["finance-reconcile"]'::jsonb
    or jsonb_array_length(saved->'contextEvidence')<>1
    or saved->'sharedLearning'->'challenges'->'finance-transfer-5'->'completedScenarioIds'<>'["bridge-the-difference-disagreement"]'::jsonb then raise exception 'Old client deleted new history'; end if;
 RAISE NOTICE 'PASS stale CAS/unioned checkpoint+challenge/OR exposure/legacy omission';
END $stale_and_merge$;

DO $exposure_and_duplicate$ DECLARE p jsonb; saved jsonb;
BEGIN
 select state into p from public.lucid_state where user_id=auth.uid();
 p:=jsonb_set(p,'{sharedLearning,exposures,finance-reconcile::finance-accounting,firstSeenAt}',to_jsonb(to_char(now()-interval '2 days 2 hours','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 if public.lucid_save_state(3,p)<>4 then raise exception 'Exposure update failed'; end if;
 select state into saved from public.lucid_state where user_id=auth.uid();
 if (saved->'contextEvidence'->0->>'independent')::boolean or (saved->'contextEvidence'->0->>'quality')::integer>1 then raise exception 'Earlier model exposure promoted recall'; end if;
 p:=jsonb_set(jsonb_set(p,'{contextEvidence,0,independent}','true'),'{contextEvidence,0,quality}','3');
 if public.lucid_save_state(4,p)<>5 then raise exception 'Duplicate conservative save failed'; end if;
 select state into saved from public.lucid_state where user_id=auth.uid();
 if jsonb_array_length(saved->'contextEvidence')<>1 or (saved->'contextEvidence'->0->>'independent')::boolean then raise exception 'Duplicate improved evidence'; end if;
 RAISE NOTICE 'PASS same-day earliest exposure caps recall/duplicate UUID cannot promote';
END $exposure_and_duplicate$;

SET LOCAL "request.jwt.claim.sub"='d3041440-2222-4222-8222-222222222222';
DO $isolation$ DECLARE p jsonb:=pg_temp.shared_fixture(); denied boolean:=false;
BEGIN
 if exists(select 1 from public.lucid_state where user_id='d3041440-1111-4111-8111-111111111111') then raise exception 'B read A'; end if;
 if public.lucid_save_state(0,p)<>1 then raise exception 'B independent record failed'; end if;
 begin update public.lucid_state set state='{}' where user_id=auth.uid(); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Direct write bypassed CAS'; end if;
 RAISE NOTICE 'PASS A/B isolation including reused shared UUID/direct write denied';
END $isolation$;
RESET ROLE;
DO $final$ BEGIN
 if (select revision from public.lucid_state where user_id='d3041440-1111-4111-8111-111111111111')<>5 then raise exception 'B changed A'; end if;
 RAISE NOTICE 'PASS shared SQL acceptance complete; rolling back all synthetic fixtures';
END $final$;
ROLLBACK;
SELECT (SELECT count(*) FROM auth.users WHERE id in ('d3041440-1111-4111-8111-111111111111','d3041440-2222-4222-8222-222222222222')) synthetic_users_remaining,
 (SELECT count(*) FROM public.lucid_state WHERE user_id in ('d3041440-1111-4111-8111-111111111111','d3041440-2222-4222-8222-222222222222')) synthetic_states_remaining,
 (SELECT count(*) FROM public.lucid_activity WHERE user_id in ('d3041440-1111-4111-8111-111111111111','d3041440-2222-4222-8222-222222222222')) synthetic_events_remaining;
