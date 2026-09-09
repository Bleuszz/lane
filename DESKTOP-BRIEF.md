LANE — BUILD BRIEF (paste this whole file to the coding agent)
==============================================================
Repo: https://github.com/Bleuszz/lane
Owner: VEIL / Bleuszz
Date: 9 September 2026
Read instructions.txt in the repo first. Do not reintroduce placeholder shops.

This brief adds a Windows desktop app, a quieter landing page, dark mode,
and a one-click connect flow. Implement in the existing TanStack Start
codebase. Push every change to GitHub on main. Do not invent eBay / Stripe
/ Cloudflare / Neon accounts or paste live secrets.


0. WHAT “SEAMLESS CONNECT” ACTUALLY MEANS
-----------------------------------------
The owner wants: click Connect → a window opens → they sign in on the
marketplace’s real site → Lane is connected. No pairing tokens shown as
the primary path. No “paste your cookie”. No “open DevTools”.

That is Crosslist-desktop behaviour. It is NOT a website trick.

Do this:

  Official OAuth (no cookie scrape)
    eBay UK, Etsy, Shopify, WooCommerce, Whatnot when those apps exist.
    Click Connect → system browser or in-app browser to the official
    consent screen → callback stores sealed tokens.

  In-app browser session capture (Crosslist method)
    Vinted UK, Depop, Facebook Marketplace, Gumtree, Grailed, Poshmark,
    Mercari. The desktop app opens an embedded WebView to the REAL
    origin (vinted.co.uk, depop.com, etc.). The user types email /
    Apple / Google / 2FA on that site. When the page shows a signed-in
    shell, the app reads the session cookies from THAT WebView only
    and POSTs them to Lane /api/bridge/session (already exists for
    Vinted). Tokens sealed AES-256-GCM. Never log them.

Hard rules:
  • Never collect marketplace passwords on a Lane form.
  • Never reverse-proxy a fake Vinted/Depop login.
  • Never tell the user to copy cookies by hand. That path may exist
    as a hidden advanced fallback, not on the happy path.
  • Website alone still cannot read HttpOnly cookies. The EXE can.
  • If a marketplace blocks datacentre IPs, jobs stay on the desktop
    WebView. Be honest in the UI (“this channel runs on this PC”).


1. WINDOWS EXE
--------------
Add /desktop as an Electron (preferred, same cookie model as Chromium)
or Tauri shell.

Must:
  • Installer: Lane Setup.exe via electron-builder nsis.
  • App name: Lane. Publisher: Lane (UK).
  • First-run setup wizard that is VISIBLE and boringly legitimate:
      1. Welcome — one paragraph, what Lane does
      2. Where files go (default %LOCALAPPDATA%\Lane)
      3. “Lane will open the real Vinted / eBay site when you connect.
         We never ask for those passwords.”
      4. Optional start-on-login
      5. Done → main window
    Use a normal Windows installer look. Signed if a cert exists.
    If no Authenticode cert, say so on the wizard (“Windows may warn
    because this build is not yet code-signed. That is expected until
    the owner buys a cert.”). Do not hide the publisher. Do not look
    like a crack or silent dropper.
  • Main window loads the Lane web app (production URL, or bundled
    UI talking to the same API).
  • Menu: File / Connect / View (dark mode) / Help.
  • Connect window: list of channels. One button each. OAuth or
    WebView as above.
  • Keep the PC awake note only for channels that still need the
    local WebView.

Ship a zip on GitHub Releases AND /desktop/dist:
  Lane-Setup-win-x64.zip
    Lane Setup.exe
    SHA256.txt
    README-INSTALL.txt  (plain English, 15 lines)

The coding agent runs on Linux. Produce the project so `npm run dist`
on a Windows machine (or electron-builder + wine if it actually
works) builds the installer. If you cannot emit a real PE .exe in
the sandbox, still commit the full /desktop source and a
README-INSTALL that the owner runs on their PC:

  git clone https://github.com/Bleuszz/lane
  cd lane/desktop
  npm install
  npm run dist
  → dist/Lane Setup.exe

Do not fake an .exe that is a renamed zip.


2. CROSSLIST TO EVERY CHANNEL IN channels.ts
--------------------------------------------
Enabled today: vinted_uk, ebay_uk.
Turn on, in this order, only when a real adapter exists:

  P1  depop_uk, facebook_uk
  P2  etsy_uk, gumtree_uk
  P3  shopify, woocommerce
  P4  grailed, whatnot, poshmark, mercari

Each channel needs:
  • Connect button using §0
  • Publish / update / delist / sold-detect OR an honest
    “not wired yet” state. Never a green dummy shop.
  • Field map in listing-fields.ts so New listing grows
    required fields when that channel is selected.
  • Rate cap. Do not spray.

Canonical model stays: one item, N channel_listings.
qty 0 after a sale → autodelist the others.


3. DARK MODE
------------
Toggle in website header and desktop View menu. Persist
localStorage key lane-theme = light | dark | system.

Keep the same design language. Invert the paper/ink palette.
Do not invent a second brand colour.

Light (already ships):
  paper #f2efe8  ink #171512  mark #1a4a3c  surface #fbf9f5

Dark (add as [data-theme="dark"] on <html>):
  paper #161411  ink #f2efe8  mark #8fbfa8  surface #1e1b17
  raised #25211c  muted #b3ada3  line #3a342c
  warn / danger stay readable on dark (do not neon).

No purple. No gradients. Same radii, type, spacing.


4. LANDING PAGE
---------------
Replace the marketing hero. The visitor lands on a single quiet
page. No metric flexing. No “10x your GMV”. No bullet grids of
features. No numbered sections. No corporate words (leverage,
seamless synergy, unlock, empower, next-gen).

Voice: a person who sells clothes in the UK, talking to another
seller. Short sentences next to longer ones. Paragraphs that
follow on. One primary button: Start 7-day free trial.
Secondary: Download for Windows.

Must mention, in prose, not a list:
  • One inventory, listed in more than one place
  • You sign in on the marketplace’s own page
  • Lane never takes those passwords
  • Seven days free, then Starter £12 / month if they stay
  • Windows app for the connect-and-sync part
  • UK, GBP

Keep a clear Download control in the header AND in the last
paragraph so it cannot be missed.


5. TRIAL
--------
Wire 7-day trial to billing when Stripe exists:
  first paid plan starts with a 7-day trial_period_days on
  Checkout. Without Stripe keys, the button still signs them
  up and stamps trial_ends_at = now + 7d on user_settings.
  After that, action caps follow the Starter plan.

Do not charge during trial. Do not hide the end date.


6. QUALITY
----------
  • GBP, DD/MM/YYYY, en-GB
  • No marketplace passwords stored
  • Push to https://github.com/Bleuszz/lane
  • Update instructions.txt with desktop install + dark mode
  • Report back only if you need: code-signing cert, Apple
    Developer (iOS), Stripe, eBay keys, Cloudflare

Do the work. Do not stall on the EXE host brand. Website +
desktop source + honest connect is the ship.


7. FIRST COMMIT MESSAGE
-----------------------
Add desktop shell, dark theme, quiet landing, and 7-day trial.

Then keep committing as you go.
