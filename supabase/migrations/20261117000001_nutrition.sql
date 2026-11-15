-- SetSmart phase 3: foods, food log and daily nutrition targets.
-- Energy is stored in kJ and macros in grams, always per 100 g (or 100 ml) on foods.

-- ---------------------------------------------------------------------------
-- Foods: the user's own custom foods, plus personal copies of foods picked from
-- Open Food Facts or USDA (so they show up in recents and can be re-logged
-- without another network lookup). source_id is the barcode or USDA fdcId.
-- ---------------------------------------------------------------------------
create table public.foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source        text not null default 'custom' check (source in ('custom', 'off', 'usda')),
  source_id     text,
  name          text not null check (char_length(btrim(name)) between 1 and 200),
  brand         text,
  barcode       text,
  base_unit     text not null default 'g' check (base_unit in ('g', 'ml')),
  energy_kj     numeric(8, 2) not null check (energy_kj >= 0),
  protein_g     numeric(7, 2) check (protein_g >= 0),
  carbs_g       numeric(7, 2) check (carbs_g >= 0),
  fat_g         numeric(7, 2) check (fat_g >= 0),
  serving_size  numeric(8, 2) check (serving_size > 0),
  serving_label text,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Custom foods have a null source_id, and nulls never collide here.
  unique (user_id, source, source_id)
);

create index foods_user_barcode_idx on public.foods (user_id, barcode) where barcode is not null;

-- ---------------------------------------------------------------------------
-- Food log. Each entry snapshots the name and the nutrients eaten, so editing
-- or archiving a food never rewrites past days. food_id is null for quick adds.
-- ---------------------------------------------------------------------------
create table public.food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on    date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id     uuid references public.foods (id) on delete set null,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  brand       text,
  amount      numeric(8, 2) check (amount > 0),
  amount_unit text check (amount_unit in ('g', 'ml', 'serving')),
  -- Grams (or ml) eaten; null for quick adds.
  grams       numeric(8, 2) check (grams > 0),
  energy_kj   numeric(9, 2) not null check (energy_kj >= 0),
  protein_g   numeric(7, 2) not null default 0 check (protein_g >= 0),
  carbs_g     numeric(7, 2) not null default 0 check (carbs_g >= 0),
  fat_g       numeric(7, 2) not null default 0 check (fat_g >= 0),
  created_at  timestamptz not null default now(),
  check ((amount is null) = (amount_unit is null))
);

create index food_logs_user_day_idx on public.food_logs (user_id, eaten_on);
create index food_logs_user_created_idx on public.food_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Daily targets, one row per user. Any target can be left unset.
-- ---------------------------------------------------------------------------
create table public.nutrition_targets (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  energy_kj  numeric(8, 2) check (energy_kj > 0),
  protein_g  numeric(7, 2) check (protein_g > 0),
  carbs_g    numeric(7, 2) check (carbs_g > 0),
  fat_g      numeric(7, 2) check (fat_g > 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security: users only ever see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.nutrition_targets enable row level security;

create policy "Own foods" on public.foods
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Own food logs" on public.food_logs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Own nutrition targets" on public.nutrition_targets
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.foods to authenticated;
grant select, insert, update, delete on public.food_logs to authenticated;
grant select, insert, update, delete on public.nutrition_targets to authenticated;
