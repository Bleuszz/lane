# Cursor prompt — UPDATE the existing Cloudflare Lane deploy

Paste everything below the line into Cursor. This is an **update**, not a first-time create. A previous Cursor pass already put Lane on Cloudflare. Do not create a second Pages/Workers project.

Repo on GitHub is already current: `https://github.com/Bleuszz/lane` branch `main`.

---

You are Cursor on the owner’s machine. Your only job is to **redeploy the latest `main` of Bleuszz/lane** onto the **existing** Cloudflare project and leave a working HTTPS hostname.

When you finish, reply with exactly:

1. Live HTTPS URL (one line, no trailing slash)
2. Cloudflare project name and whether it is Pages or Workers
3. Neon project name + whether migrations `0001`–`0006` are applied
4. Env vars that are set (names only) and env vars still empty
5. Result of these checks: `/` landing, `/download`, `/login`, create-account, signed-in dashboard
6. Exact errors if anything failed

Do not invent eBay, Stripe, or custom-domain credentials. Do not collect marketplace passwords. Do not commit `.env`. Do not rebuild `Lane.exe`. Do not fork the repo.

## What changed since the last deploy

`main` now has:

- Website-shell desktop (Electron loads this hostname; Connect Vinted dumps the cookie jar + Bearer and closes)
- `/download` page pointing at Drive file `1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr` (`Lane-Windows.zip` build 0.2.1)
- Privacy + terms, robots, sitemap
- Cursor/Grok dark theme (zinc + `#4d8dff`), Vindy-style inbox
- Honest phone-connect copy (QR is HTTPS; capture still happens on the PC app)

`vite.config.ts` still uses Nitro preset **`vercel`**. That is why a naïve Pages “output directory” deploy often serves a blank or broken site. Prefer updating the project that already works. If that project is Pages and the last build used a Vercel bundle that happened to boot, keep that path and only pull latest `main`. If it is broken, switch to Path B (Workers + `cloudflare_module`).

## Step 0 — find what already exists

1. Open https://dash.cloudflare.com → Workers & Pages. List existing projects named `lane`, `lane-*`, or similar. Use that project. Do not Create again.
2. Open https://console.neon.tech. Find the existing Lane database. Reuse `DATABASE_URL`. Do not create a second Neon project unless there is none.
3. `git fetch origin && git checkout main && git pull`. Confirm `src/routes/download.tsx` and `src/lib/lane/download.ts` exist (`WINDOWS_FILE_ID = 1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr`).
4. Note the current production hostname. That string is `BETTER_AUTH_URL`.

## Secrets (update, do not rotate unless missing)

Required:

```
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
BETTER_AUTH_SECRET=<already generated — keep it or the existing sessions die>
BETTER_AUTH_URL=https://<existing-hostname>
VITE_AUTH_ENABLED=true
NODE_VERSION=22
```

Leave empty if the owner has not pasted values (do not invent):

```
EBAY_CLIENT_ID
EBAY_CLIENT_SECRET
EBAY_RU_NAME
EBAY_ENV=production
EBAY_MARKETPLACE_ID=EBAY_GB
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_SELLER
STRIPE_PRICE_PRO
STRIPE_PRICE_AI_PACK
XAI_API_KEY
VINTED_USER_AGENT
```

If `BETTER_AUTH_URL` still points at an old preview host or has a trailing slash, fix it and redeploy.

## Path A — existing Cloudflare Pages project (try first)

1. Pages project → Settings → Builds & deployments.
2. Production branch: `main`. Root: `/`. Build command: `npm ci && npm run build`.
3. If the last successful build used a specific output directory, keep it. Otherwise try `.output/public` only after reading the build log.
4. Framework preset: None. Node 22.
5. Confirm the required secrets above.
6. Deployments → Retry deployment on latest `main` (or push an empty commit only if Git integration is stuck).
7. Wait for the green build. Open the hostname.

If the build log says the Vercel preset cannot run on Pages, stop Path A and do Path B. Do not retry the same failure.

## Path B — Workers, if Pages cannot host this bundle

On the machine, Node 22:

```sh
git clone https://github.com/Bleuszz/lane.git
cd lane
git checkout main
git pull
npm ci
```

In `vite.config.ts` change only:

```ts
nitro({
  preset: "cloudflare_module",
  serverDir: "./server",
})
```

(Use `cloudflare-module` if the installed Nitro version documents that spelling.)

```sh
npm run build
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler deploy
```

`wrangler.toml` name is `lane`, `nodejs_compat` is on, `main` may need to match the file Nitro just printed (often `.output/server/index.mjs`). Do not commit secrets. You may commit the preset change if Workers is the path that actually boots — say so in the report.

## Database

Neon SQL editor or `psql "$DATABASE_URL"`:

Apply every file in `migrations/` in order (`0001_auth.sql` … `0006_trial_desktop.sql`). Skip a file only if Neon says the object already exists. A Pages/Workers deploy without this schema boots a blank or 500ing app.

`npm run build` also runs `npm run db:migrate`. That needs `DATABASE_URL` in the build environment. If the build host cannot reach Neon, run migrations yourself in the Neon console.

## After it is live — click these yourself

1. `https://<host>/` — landing “List once. Stay in sync.” plus Download for Windows and 7-day trial. Not GitHub. Not an error dump. Dark zinc, not cream.
2. `https://<host>/download` — button for `Lane-Windows.zip`. If Drive shows a Google login wall, the file is still private; report that. Do not upload a new zip.
3. `https://<host>/login` — create a throwaway email account. You must land on onboarding or the dashboard.
4. Signed-in sidebar: Inventory, Inbox, Activity, Settings → Channels. No `london_rails` / `lane_uk_shop`.
5. `/api/auth` must not 500.

## What you must not do

- Do not rebuild or replace `Lane.exe`. The portable zip is already on Drive (`1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr`). The EXE asks for this hostname on first run (`lane.json` next to `Lane.exe`).
- Do not buy a domain.
- Do not fake connected shops.
- Do not put Vinted/eBay passwords in env.
- Do not change `WINDOWS_FILE_ID` unless the owner uploaded a new zip.

## Owner follow-ups you only report, not fix

- Drive file `1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr` → Share → Anyone with the link.
- eBay / Stripe keys when they have them.
- Optional Authenticode cert so SmartScreen stops warning.

Reply with the six-point report. Put the HTTPS URL on line one.
