-- Tighten native v2 cloud payload validation without changing stored learner data.
-- Apply AFTER 202609140001_lucid_accounts.sql. This migration does not rewrite rows.
-- Client dates are Foundation Date seconds since 2001-01-01, NOT Unix timestamps.
-- Strict field allowlists prevent accidental free-text/draft leakage in nested objects.
-- The helper is private to the function owner; it is not a client-callable RPC.
create function public.lucid_v2_value_valid(v jsonb, shape text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $validation$
declare
  required_keys text[];
  optional_keys text[] := array[]::text[];
  key text;
  child jsonb;
  child_shape text;
  text_value text;
begin
  -- Scalar validation uses JSON type checks and comparisons, not unchecked casts.
  case shape
    when 'identifier' then
      return coalesce(jsonb_typeof(v) = 'string' and length(v #>> '{}') between 1 and 128
        and (v #>> '{}') ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$', false);
    when 'uuid' then
      return coalesce(jsonb_typeof(v) = 'string'
        and (v #>> '{}') ~ '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$', false);
    when 'date' then
      return coalesce(jsonb_typeof(v) = 'number'
        and v >= '-63114076800'::jsonb and v <= '252423993599'::jsonb, false);
    when 'integer' then
      return coalesce(jsonb_typeof(v) = 'number' and v::text ~ '^(0|[1-9][0-9]{0,9})$'
        and v <= '2147483647'::jsonb, false);
    when 'quality' then return coalesce(jsonb_typeof(v) = 'number' and v::text ~ '^[0-3]$', false);
    when 'interval' then return coalesce(jsonb_typeof(v) = 'number' and v::text ~ '^[0-4]$', false);
    when 'pace' then return coalesce(jsonb_typeof(v) = 'number' and v::text ~ '^[1-3]$', false);
    when 'boolean' then return coalesce(jsonb_typeof(v) = 'boolean', false);
    when 'name' then
      -- Native names use a 40-grapheme limit. Allow room for multi-codepoint scripts.
      return coalesce(jsonb_typeof(v) = 'string' and length(v #>> '{}') <= 512, false);
    when 'day' then
      if jsonb_typeof(v) is distinct from 'string' then return false; end if;
      text_value := v #>> '{}';
      if text_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
      -- Casts are only reached after fixed-width digits are checked. make_date rejects
      -- impossible calendar dates (including 2026-02-31 and year zero).
      begin
        perform make_date(substring(text_value, 1, 4)::integer,
                          substring(text_value, 6, 2)::integer,
                          substring(text_value, 9, 2)::integer);
        return true;
      exception when datetime_field_overflow then return false;
      end;
    when 'kind' then return coalesce(v in ('"practice"'::jsonb, '"review"'::jsonb, '"lesson"'::jsonb), false);
    when 'ids', 'dates', 'events', 'sessions' then
      if jsonb_typeof(v) is distinct from 'array' then return false; end if;
      child_shape := case shape when 'ids' then 'identifier' when 'dates' then 'date'
                        when 'events' then 'event' else 'session' end;
      for child in select value from jsonb_array_elements(v) loop
        if not public.lucid_v2_value_valid(child, child_shape) then return false; end if;
      end loop;
      return true;
    when 'progress-map', 'favourite-map' then
      if jsonb_typeof(v) is distinct from 'object' then return false; end if;
      child_shape := case shape when 'progress-map' then 'progress' else 'favourite' end;
      for key, child in select * from jsonb_each(v) loop
        if not public.lucid_v2_value_valid(to_jsonb(key), 'identifier')
           or not public.lucid_v2_value_valid(child, child_shape) then return false; end if;
      end loop;
      return true;
    when 'profile' then
      required_keys := array['roleId', 'seniorityId', 'situationIds', 'goalIds'];
    when 'progress' then
      required_keys := array['introducedOn', 'intervalIndex', 'nextReviewOn', 'reviewCount',
                             'successfulReviewDates', 'lapses', 'mastered'];
      optional_keys := array['lastReviewedOn'];
    when 'session' then
      required_keys := array['id', 'date', 'wordIds', 'completedAt'];
      optional_keys := array['dayKey'];
    when 'event' then
      required_keys := array['id', 'kind', 'date', 'dayKey', 'quality', 'productive'];
      optional_keys := array['wordId'];
    when 'favourite' then required_keys := array['selected', 'updatedAt'];
    when 'settings' then
      required_keys := array['notificationsEnabled', 'reminderHour', 'reminderMinute', 'speechRate'];
    when 'state' then
      required_keys := array['schemaVersion', 'introducedWordIds', 'currentWordIds',
        'progressByWordId', 'sessions', 'favouriteWordIds', 'completedWordIdsToday',
        'settings', 'reviewPromptMilestone'];
      optional_keys := array['displayName', 'dailyWordGoal', 'profileUpdatedAt', 'lessonDayKey',
        'activities', 'favouriteChanges', 'updatedAt', 'profile', 'currentLessonDate'];
    else return false;
  end case;

  if jsonb_typeof(v) is distinct from 'object' then return false; end if;
  if not (v ?& required_keys) or v - (required_keys || optional_keys) <> '{}'::jsonb then return false; end if;
  for key, child in select * from jsonb_each(v) loop
    -- Optional Swift Codable values may be absent or explicitly null.
    if key = any(optional_keys) and child = 'null'::jsonb then continue; end if;
    child_shape := case key
      when 'roleId' then 'identifier' when 'seniorityId' then 'identifier' when 'wordId' then 'identifier'
      when 'situationIds' then 'ids' when 'goalIds' then 'ids' when 'wordIds' then 'ids'
      when 'introducedWordIds' then 'ids' when 'currentWordIds' then 'ids'
      when 'favouriteWordIds' then 'ids' when 'completedWordIdsToday' then 'ids'
      when 'id' then 'uuid' when 'kind' then 'kind'
      when 'date' then 'date' when 'completedAt' then 'date' when 'introducedOn' then 'date'
      when 'nextReviewOn' then 'date' when 'lastReviewedOn' then 'date'
      when 'profileUpdatedAt' then 'date' when 'updatedAt' then 'date' when 'currentLessonDate' then 'date'
      when 'dayKey' then 'day' when 'lessonDayKey' then 'day'
      when 'intervalIndex' then 'interval'
      when 'reviewCount' then 'integer' when 'lapses' then 'integer' when 'reviewPromptMilestone' then 'integer'
      when 'successfulReviewDates' then 'dates'
      when 'mastered' then 'boolean' when 'productive' then 'boolean'
      when 'selected' then 'boolean' when 'notificationsEnabled' then 'boolean'
      when 'quality' then 'quality' when 'dailyWordGoal' then 'pace'
      when 'displayName' then 'name'
      when 'profile' then 'profile' when 'settings' then 'settings'
      when 'progressByWordId' then 'progress-map' when 'favouriteChanges' then 'favourite-map'
      when 'sessions' then 'sessions' when 'activities' then 'events'
      else null end;
    if child_shape is not null then
      if not public.lucid_v2_value_valid(child, child_shape) then return false; end if;
    elsif key = 'schemaVersion' then
      if child is distinct from '2'::jsonb then return false; end if;
    elsif key = 'reminderHour' then
      if not public.lucid_v2_value_valid(child, 'integer') or child > '23'::jsonb then return false; end if;
    elsif key = 'reminderMinute' then
      if not public.lucid_v2_value_valid(child, 'integer') or child > '59'::jsonb then return false; end if;
    elsif key = 'speechRate' then
      if jsonb_typeof(child) is distinct from 'number' or child < '0.36'::jsonb or child > '0.56'::jsonb then return false; end if;
    else return false;
    end if;
  end loop;

  if shape = 'profile' then
    if jsonb_array_length(v->'situationIds') = 0 or jsonb_array_length(v->'goalIds') = 0 then return false; end if;
  elsif shape = 'state' then
    if jsonb_array_length(v->'currentWordIds') > 3 then return false; end if;
  elsif shape = 'event' then
    if v->>'kind' <> 'lesson' and not public.lucid_v2_value_valid(v->'wordId', 'identifier') then return false; end if;
  end if;
  return true;
end;
$validation$;

revoke all on function public.lucid_v2_value_valid(jsonb, text) from public, anon, authenticated;

-- Preserve RLS, authenticated ownership, CAS, immutable activity IDs, and deleted-user
-- checks. Validation runs before the first write, so malformed payloads cannot poison
-- a learner's cloud record. This changes only the function, not existing stored rows.
create or replace function public.lucid_save_state(expected_revision bigint, new_state jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $save$
declare
  actor uuid := auth.uid();
  actual_revision bigint;
  event jsonb;
  merged_events jsonb;
  safe_state jsonb;
begin
  if actor is null or not exists (select 1 from auth.users where id = actor) then
    raise sqlstate 'PT401' using message = 'Sign in required';
  end if;
  if expected_revision is null or expected_revision < 0
     or new_state is null or octet_length(new_state::text) > 2000000 then
    raise sqlstate 'PT400' using message = 'Unsupported learning record';
  end if;
  if not public.lucid_v2_value_valid(new_state, 'state') then
    raise sqlstate 'PT400' using message = 'Unsupported learning record';
  end if;
  insert into public.lucid_state(user_id) values (actor) on conflict do nothing;
  select revision into actual_revision from public.lucid_state where user_id = actor for update;
  if actual_revision <> expected_revision then
    raise sqlstate 'PT409' using message = 'Learning record changed; merge and retry';
  end if;
  for event in select value from jsonb_array_elements(coalesce(nullif(new_state->'activities', 'null'::jsonb), '[]'::jsonb)) loop
    -- The validator checked a canonical UUID before this cast.
    insert into public.lucid_activity(user_id, event_id, payload)
      values (actor, (event->>'id')::uuid, event)
      on conflict (user_id, event_id) do nothing;
  end loop;
  select coalesce(jsonb_agg(payload order by payload->'date', event_id), '[]'::jsonb)
    into merged_events from public.lucid_activity where user_id = actor;
  safe_state := jsonb_set(new_state, '{activities}', merged_events);
  -- Notification and playback preferences stay on the device, even if a modified
  -- client accidentally sends them. The native merge already preserves local settings.
  safe_state := jsonb_set(safe_state, '{settings}',
    '{"notificationsEnabled":false,"reminderHour":9,"reminderMinute":0,"speechRate":0.46}'::jsonb);
  -- Previously stored activities are merged too. Reject an over-limit/invalid result
  -- atomically instead of saving a snapshot the native app cannot safely consume.
  if octet_length(safe_state::text) > 2000000
     or not public.lucid_v2_value_valid(safe_state, 'state') then
    raise sqlstate 'PT400' using message = 'Learning history needs support before syncing';
  end if;
  update public.lucid_state set state = safe_state,
    revision = revision + 1, updated_at = now() where user_id = actor;
  return actual_revision + 1;
end;
$save$;
revoke all on function public.lucid_save_state(bigint, jsonb) from public, anon;
grant execute on function public.lucid_save_state(bigint, jsonb) to authenticated;
