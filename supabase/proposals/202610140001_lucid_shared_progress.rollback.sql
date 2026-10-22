-- Safe RPC rollback/pause. Before an approved production rollout, export an owner-only
-- database backup plus pg_get_functiondef for lucid_save_state and its private base.
-- Pause new web/native shared-sync clients before using this compatibility function.
-- It never deletes or rewrites existing records during installation. Prior shared
-- metadata stays attached on later legacy v2 saves; a new shared client fails visibly.
-- Authored lookup tables/helpers remain private, so a later forward rollout is possible.
-- Restoring the full forward RPC is a separately approved deployment action.
create or replace function public.lucid_save_state(expected_revision bigint,new_state jsonb)
returns bigint language plpgsql security definer set search_path='' set timezone='UTC'
as $pause$
declare actor uuid:=auth.uid(); previous jsonb; revision bigint;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor) then
    raise sqlstate 'PT401' using message='Sign in required';
  end if;
  if new_state ? 'sharedLearning' then
    raise sqlstate 'PT400' using message='Shared sync is paused; local progress is preserved';
  end if;
  insert into public.lucid_state(user_id) values(actor) on conflict do nothing;
  select state into previous from public.lucid_state where user_id=actor for update;
  revision:=public.lucid_save_state_v2_base(expected_revision,new_state);
  if previous ? 'sharedLearning' then
    update public.lucid_state set state=jsonb_set(state,'{sharedLearning}',previous->'sharedLearning') where user_id=actor;
  end if;
  return revision;
end;
$pause$;
revoke all on function public.lucid_save_state(bigint,jsonb) from public,anon;
grant execute on function public.lucid_save_state(bigint,jsonb) to authenticated;
