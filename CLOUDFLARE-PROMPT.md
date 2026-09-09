# Prompt for an internal AI with a VM — put Lane on Cloudflare and get a free URL

Copy everything below the line into the VM agent. Do not skip the Neon database. A Pages deploy without Postgres will boot a blank app.

---

You are an operator on a desktop VM with a browser. Your job is to publish the Lane website from GitHub `Bleuszz/lane` (branch `main`) onto Cloudflare so it has a permanent free hostname (`*.pages.dev` or `*.workers.dev`). When you are done, reply with:

1. The live HTTPS URL
2. The Cloudflare project name
3. Whether Neon is connected
4. Any env vars still missing
5. Exact errors if it failed

Do not invent eBay, Stripe, or custom-domain credentials. Do not put marketplace passwords anywhere.

## What Lane is

TanStack Start + React + Tailwind, Node server, Better Auth, Postgres. Preview-quality local mode uses PGLite; production needs a real `DATABASE_URL`. The Windows EXE is a Chromium shell that **loads this URL**, so the hostname you produce is what sellers sign into.

## Accounts to create (free)

1. **Cloudflare** — https://dash.cloudflare.com/sign-up  
   Workers & Pages must be available. Free plan is enough.

2. **Neon Postgres** — https://console.neon.tech/  
   Create a project in a nearby region (EU if possible). Copy the pooled `DATABASE_URL` (`sslmode=require`). Lane’s schema is in `migrations/0001_auth.sql` through `0006_trial_desktop.sql`. Run them against Neon (Neon SQL editor or `psql`).

3. GitHub access to `Bleuszz/lane` is already there. Do not fork unless the owner’s repo cannot be connected.

## Secrets to set (generate, do not reuse)

In a terminal:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice. Use one as `BETTER_AUTH_SECRET`. Keep the other as a spare. Never commit them.

Required on the Cloudflare project:

```
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=https://<the-hostname-you-will-get>
VITE_AUTH_ENABLED=true
```

Optional, leave empty if the owner has not supplied them:

```
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_RU_NAME=
EBAY_ENV=production
EBAY_MARKETPLACE_ID=EBAY_GB
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_SELLER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_AI_PACK=
XAI_API_KEY=
VINTED_USER_AGENT=
```

`BETTER_AUTH_URL` must be the final `https://…pages.dev` (or custom domain) with no trailing slash. If the first deploy assigns a hostname you did not know, set the var and redeploy.

## Path A — Cloudflare Pages from GitHub (try this first)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize GitHub. Select `Bleuszz/lane`, production branch `main`.
3. Framework preset: None.
4. Build command: `npm ci && npm run build`
5. Build output directory: leave default / try `.output/public` if the first build log names it.
6. Root directory: `/`
7. Node version: `22` (environment variable `NODE_VERSION=22`).
8. Add the required secrets above.
9. Save and Deploy.

This repo’s Vite config currently uses Nitro’s **`vercel` preset**. If Pages fails with a Vercel-only output, go to Path B. Do not keep retrying a Vercel bundle on Pages.

## Path B — Cloudflare Workers (if Pages rejects the Vercel preset)

On the VM, with Node 22:

```sh
git clone https://github.com/Bleuszz/lane.git
cd lane
npm ci
```

In `vite.config.ts`, find the `nitro({...})` call and set `preset: "cloudflare_module"` (or `"cloudflare-module"` — use whichever the installed Nitro version documents). Do not change anything else unless the build error names a file.

```sh
npm run build
npx wrangler login
```

Complete the browser login. Then:

```sh
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
```

Paste values when prompted. `wrangler.toml` at the repo root is named `lane`. Deploy:

```sh
npx wrangler deploy
```

If Wrangler asks for a main module, point it at the Nitro Cloudflare output the build just printed (often `.output/server/index.mjs` or `dist/server/index.js`). Enable `nodejs_compat` (already in `wrangler.toml`).

Free hostname looks like `https://lane.<account>.workers.dev`.

## After it is live

1. Open the URL in the VM browser. You should see Lane’s landing page (“List once. Stay in sync.”), not GitHub, not an error dump.
2. Create a test account (email + password). Confirm you land on onboarding or the dashboard.
3. If the page is blank or `/api/auth` 500s, the database migrations did not apply — run `0001`–`0006` on Neon and retry.
4. Reply with the HTTPS URL in a single line at the top of your report.

The Windows app reads this URL from `lane.json` next to `Lane.exe` (or the first-run screen). After you have the URL, the owner pastes it there. Do not rebuild the EXE yourself unless asked.

## Hard rules

- Never collect Vinted / eBay / Depop passwords.
- Never fake a connected shop.
- Never commit `.env` or secrets to GitHub.
- Do not buy a domain. Free `pages.dev` / `workers.dev` is the point.
- If Cloudflare login requires email verification, complete it in the VM browser.
- If Neon requires a card, stop and report that — do not invent a database.
