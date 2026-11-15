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
   and add both it and `http://localhost:5173` under Redirect URLs.

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

## Food logging

- Search covers your own foods, USDA (generic foods) and Open Food Facts (packaged products). A search result
  is copied into your `foods` the first time you log it, so it shows up under Recent.
- Each `food_logs` row stores a snapshot of the name and the nutrients eaten, so editing or deleting a food
  never changes past days. Quick adds have no food and no amount.
- Barcode scanning uses the browser's `BarcodeDetector` where available, otherwise a bundled ZXing WebAssembly
  build that loads only when the scanner opens. The camera needs HTTPS (or `localhost`): to scan from your phone
  against the dev server, expose it over HTTPS (e.g. a tunnel) or type the barcode number instead.

## Data model

All weights are stored in kilograms (displayed in kg or lb per user setting); energy will be stored in kJ.
Every table has row-level security: users only ever see their own rows (plus the built-in exercise library).
