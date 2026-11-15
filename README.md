# GymBro

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
4. **Auth URLs**: in *Authentication → URL Configuration*, set the Site URL to `http://localhost:5173` for
   development so confirmation/reset emails link back to the app.
5. Install and run:

   ```sh
   npm install
   npm run dev        # http://localhost:5173
   ```

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
- The in-progress workout is saved to `localStorage` after every action and uploaded once via the
  `log_workout` RPC when you save. The RPC is idempotent, so a failed save on bad gym Wi-Fi can be retried safely.

Limitation: on the web, iOS Safari suspends JavaScript when the phone is locked, so the rest alarm sounds
when you unlock. The native app will use scheduled local notifications to fix this.

## Data model

All weights are stored in kilograms (displayed in kg or lb per user setting); energy will be stored in kJ.
Every table has row-level security: users only ever see their own rows (plus the built-in exercise library).
