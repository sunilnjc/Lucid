-- Lucid's native app authenticates with Supabase Auth. Guest data never reaches this database.
create table public.lucid_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint state_is_object check (jsonb_typeof(state) = 'object')
);
create table public.lucid_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.lucid_state enable row level security;
alter table public.lucid_activity enable row level security;
revoke all on public.lucid_state, public.lucid_activity from anon, authenticated;
grant select on public.lucid_state, public.lucid_activity to authenticated;
create policy "Read own learning state" on public.lucid_state for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Read own learning activity" on public.lucid_activity for select to authenticated
  using ((select auth.uid()) = user_id);

-- All writes run through a compare-and-swap transaction. A stale device must download,
-- merge and retry instead of replacing another device's progress. An unexpired JWT from
-- a deleted account cannot recreate it: both the live-user check and FKs prevent that.
create function public.lucid_save_state(expected_revision bigint, new_state jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actual_revision bigint;
  event jsonb;
  merged_events jsonb;
begin
  if actor is null or not exists (select 1 from auth.users where id = actor) then
    raise sqlstate 'PT401' using message = 'Sign in required';
  end if;
  if expected_revision < 0 or expected_revision is null
     or new_state is null or jsonb_typeof(new_state) <> 'object'
     or octet_length(new_state::text) > 2000000
     or coalesce((new_state->>'schemaVersion')::int, 0) <> 2
     or jsonb_typeof(new_state->'introducedWordIds') is distinct from 'array'
     or jsonb_typeof(new_state->'progressByWordId') is distinct from 'object'
     or jsonb_typeof(new_state->'sessions') is distinct from 'array'
     or jsonb_typeof(coalesce(new_state->'activities', '[]'::jsonb)) <> 'array'
     or new_state ?| array['practiceDrafts', 'reviewAttempts'] then
    raise sqlstate 'PT400' using message = 'Unsupported learning record';
  end if;
  insert into public.lucid_state(user_id) values (actor) on conflict do nothing;
  select revision into actual_revision from public.lucid_state where user_id = actor for update;
  if actual_revision <> expected_revision then
    raise sqlstate 'PT409' using message = 'Learning record changed; merge and retry';
  end if;
  for event in select value from jsonb_array_elements(coalesce(new_state->'activities', '[]'::jsonb)) loop
    if jsonb_typeof(event) <> 'object'
       or coalesce(event->>'kind', '') not in ('practice', 'review', 'lesson')
       or coalesce(event->>'dayKey', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or jsonb_typeof(event->'quality') is distinct from 'number'
       or (event->>'quality')::int not between 0 and 3
       or jsonb_typeof(event->'productive') is distinct from 'boolean'
       or jsonb_typeof(event->'date') is distinct from 'number' then
      raise sqlstate 'PT400' using message = 'Invalid activity';
    end if;
    insert into public.lucid_activity(user_id, event_id, payload)
      values (actor, (event->>'id')::uuid, event)
      on conflict (user_id, event_id) do nothing;
  end loop;
  -- Immutable stored activities survive an old client omitting part of its history.
  select coalesce(jsonb_agg(payload order by payload->>'date', event_id), '[]'::jsonb)
    into merged_events from public.lucid_activity where user_id = actor;
  update public.lucid_state
    set state = jsonb_set(new_state - 'practiceDrafts' - 'reviewAttempts', '{activities}', merged_events),
        revision = revision + 1, updated_at = now()
    where user_id = actor;
  return actual_revision + 1;
end;
$$;
revoke all on function public.lucid_save_state(bigint, jsonb) from public, anon;
grant execute on function public.lucid_save_state(bigint, jsonb) to authenticated;
