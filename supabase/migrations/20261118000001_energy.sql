-- SetSmart: body details for estimated energy expenditure.
-- All new columns are optional; estimates are only shown once enough is filled in.

alter table public.profiles
  add column height_cm      numeric(5, 1) check (height_cm between 50 and 272),
  add column birth_year     int           check (birth_year between 1900 and 2100),
  -- Sex is only used by the Mifflin-St Jeor equation; null means "not set".
  add column sex            text          check (sex in ('male', 'female')),
  -- Everyday (non-workout) activity, mapped to a physical activity level (PAL).
  add column daily_activity text          check (daily_activity in ('sitting', 'mixed', 'active')),
  -- How hard a typical weights session is, mapped to a Compendium MET value.
  add column workout_effort text not null default 'moderate' check (workout_effort in ('moderate', 'vigorous'));

-- Optional body fat reading taken with a weigh-in (e.g. from a smart scale).
alter table public.body_weights
  add column body_fat_pct numeric(4, 1) check (body_fat_pct between 3 and 70);
