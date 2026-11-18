-- SetSmart: let a signed-in user permanently delete their own account and data.
--
-- Runs as the function owner (security definer) because only that role can delete
-- from auth.users. It only ever acts on auth.uid(), so a user can't delete anyone else.
-- Rows are deleted child-first because logged sets and routine entries reference
-- custom exercises with ON DELETE RESTRICT, which a plain cascade from auth.users
-- could trip over. Everything runs in one transaction: all or nothing.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from public.workout_sets where user_id = v_uid;
  delete from public.workout_sessions where user_id = v_uid;
  delete from public.routine_exercises
    where routine_id in (select id from public.routines where user_id = v_uid);
  delete from public.routines where user_id = v_uid;
  delete from public.cardio_sessions where user_id = v_uid;
  delete from public.food_logs where user_id = v_uid;
  delete from public.foods where user_id = v_uid;
  delete from public.nutrition_targets where user_id = v_uid;
  delete from public.body_weights where user_id = v_uid;
  delete from public.exercises where owner_id = v_uid;
  delete from public.profiles where id = v_uid;
  -- Also removes their sessions, refresh tokens and identities (cascades inside auth).
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
