# SetSmart

Workout + nutrition tracker. React web app now, iOS/Android (Expo) later — both share `packages/core`.

```
apps/web         React + Vite + Tailwind web app
packages/core    Shared TypeScript: types, Supabase data access, unit conversion, workout engine
supabase/        SQL migrations (schema, row-level security, RPCs, exercise library seed)
```

## Setup

1. **Create a Supabase project** at <https://supabase.com>.
2. **Run the migrations**: open *SQL Editor* and run each file in `supabase/migrations/` in filename order.
   (Or with the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. **Configure the web app**: `cp apps/web/.env.example apps/web/.env.local` and fill in the project URL and
   anon key from *Project Settings → API*.
4. **Optional, for food search:** get a free USDA FoodData Central key at
   <https://fdc.nal.usda.gov/api-key-signup> and set `VITE_USDA_API_KEY` in `apps/web/.env.local`. Without it,
   generic-food search ("banana", "rice") uses a shared demo key that only allows a few searches per hour.
   Packaged-food search and barcodes use Open Food Facts, which needs no key.
5. **Auth URLs**: in *Authentication → URL Configuration*, set the Site URL to `http://localhost:5173` for
   development so confirmation/reset emails link back to the app.
6. Install and run:

   ```sh
   npm install
   npm run dev        # http://localhost:5173
   ```

## Deploying (Netlify)

The site is at <https://setsmart.netlify.app> and deploys from `main`. Build settings live in `netlify.toml`.

1. In Netlify → *Site configuration → Environment variables*, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   and `VITE_USDA_API_KEY`. They are baked in at build time, so **redeploy** after changing them.
   Only ever use the anon/publishable key here, never the service-role key.
2. In Supabase → *Authentication → URL Configuration*, set the Site URL to `https://setsmart.netlify.app`
   and add `https://setsmart.netlify.app/**` and `http://localhost:5173/**` under Redirect URLs. Password reset
   emails link to `/reset-password`; if that URL isn't allowed, Supabase sends people to the Site URL instead,
   and the app still takes them to the reset screen.

## Scripts (from repo root)

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the web app                         |
| `npm run build`     | Typecheck + production build of the web app |
| `npm test`          | Unit tests for the workout engine         |
| `npm run typecheck` | Typecheck all workspaces                  |
| `npm run lint`      | Lint all workspaces                       |

## How the workout player works

`packages/core/src/workout/engine.ts` is a pure reducer (no React, no browser APIs), so the mobile app can reuse it.

- `queue[0]` is the current exercise. **Postpone** swaps it with the next one (repeatable), or sends it to the end.
- The rest timer stores an absolute `endsAt` timestamp, so it stays correct across tab switches and reloads.
- **Cardio** exercises (runs, treadmill, rowing machine and so on) sit in routines next to weights exercises, with
  an optional goal duration instead of sets. In a workout they're timed: Start, Pause/Resume and End, with an alert
  when the goal is reached. The timer also uses absolute times (`accumulatedMs` + `runningSince`). After ending it,
  the time is filled in from the timer and the user can add a distance *or* a pace (a speed for cycling); the other is
  worked out. Cardio can only be logged by timing it.
- The in-progress workout is saved to `localStorage` after every action and uploaded once via the
  `log_workout` RPC when you save. The RPC is idempotent, so a failed save on bad gym Wi-Fi can be retried safely.

Limitation: on the web, iOS Safari suspends JavaScript when the phone is locked, so the rest alarm sounds
when you unlock. The native app will use scheduled local notifications to fix this.

## Food logging

- Search covers your own foods, USDA (generic foods) and Open Food Facts (packaged products). A search result
  is copied into your `foods` the first time you log it, so it shows up under Recent.
- Each `food_logs` row stores a snapshot of the name and the nutrients eaten, so editing or deleting a food
  never changes past days. Quick adds have no food and no amount.
- Barcode scanning uses the browser's `BarcodeDetector` where available, otherwise a bundled ZXing WebAssembly
  build that loads only when the scanner opens. The camera needs HTTPS (or `localhost`): to scan from your phone
  against the dev server, expose it over HTTPS (e.g. a tunnel) or type the barcode number instead.

## Energy estimates

Estimated energy burned is worked out in `packages/core/src/energy/estimates.ts` and always shown as an
estimate. The in-app "How it's worked out" sheet explains it to users with their own numbers and sources.

- **Resting (BMR):** Cunningham (1980), `500 + 22 × fat-free mass`, when a body fat % was logged within 90 days.
  Otherwise Mifflin-St Jeor (1990) from weight, height and age. If sex isn't set, the average of the two constants is used.
- **Everyday activity:** resting × (PAL − 1), with PAL 1.4 / 1.55 / 1.75 from the FAO/WHO/UNU (2004) ranges.
  It's assumed to be 1.4 until the user picks a level.
- **Weight training:** `(MET × 3.5 × kg ÷ 200 − resting per minute) × minutes`, with 3.5 METs (moderate) or 6.0 METs
  (vigorous) from the 2024 Adult Compendium. The minutes are the workout's length minus its timed cardio (none for a
  cardio-only workout). Only the energy above resting is counted, and weight training is capped at 3 hours.
- **Cardio:** the same formula for each cardio exercise's timed duration, with no cap. The MET value comes from the 2024 Compendium, listed with its code in
  `packages/core/src/energy/cardio.ts`. For runs, walks and outdoor rides with a distance, the average speed picks the
  row with the nearest speed (flat ground). Otherwise the chosen effort picks a row, and the middle option is used if
  none was chosen. Each cardio exercise "counts as" one of these activities; a custom one can instead have its own
  MET value. Distances are in km for kg users and miles for lb users,
  and in metres for swims and rows.
- Displayed estimates are rounded to 10 kcal or 50 kJ so they don't look more precise than they are.

## Data model

All weights are stored in kilograms (displayed in kg or lb per user setting); energy will be stored in kJ.
Every table has row-level security: users only ever see their own rows (plus the built-in exercise library).

Exercises have a `kind` (`weights` or `cardio`); cardio ones also have a `cardio_activity` and, for "other", a
`cardio_met`. Logged cardio is stored in `workout_cardio`, one row per cardio exercise in a workout, sharing
`exercise_position` numbering with `workout_sets`.

**Deleting an account:** Settings → Delete account asks for the user's password, then calls the
`delete_my_account()` RPC. It's a `security definer` function that only acts on `auth.uid()`. It deletes every row
the user owns, child tables first (custom exercises are referenced with `on delete restrict`), and then their
`auth.users` row, all in one transaction. The app then signs out locally.
