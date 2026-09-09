LANE — FULL BUILD PROMPT
Paste this entire file into the next coding agent. Implement. Do not summarise and wait.
Repo: https://github.com/Bleuszz/lane
Owner: VEIL / Bleuszz
Date: 9 September 2026
Read instructions.txt first. Never reintroduce placeholder shops (london_rails / lane_uk_shop).
Never collect marketplace passwords on a Lane form. Never fake a marketplace login page.

This is the job:

  1. Ship Lane as a Windows EXE the owner can install like a normal app.
  2. Connect is one click: the real marketplace site opens, they sign in there,
     Lane captures the session automatically. No paste-a-cookie. No DevTools.
  3. Crosslist to EVERY marketplace in src/lib/lane/channels.ts, not only
     Vinted and eBay.
  4. Dark mode, same brand, toggle on website and in the app.
  5. Quiet landing page in a human voice, 7-day free trial button, obvious
     Download for Windows.
  6. A zip the owner can open, run the installer from, and walk a clean
     visible setup wizard. Windows SmartScreen will warn until a code-signing
     cert exists — say that on the wizard. Do not look like a crack.
  7. Push every change to GitHub main. Keep instructions.txt current.


0. WHAT “LOGIN → AUTO CONNECT” MEANS
------------------------------------
The website cannot read HttpOnly cookies from vinted.co.uk. A desktop
WebView can. That is why Crosslist is an app.

Happy path for a session channel (Vinted, Depop, Facebook Marketplace,
Gumtree, Grailed, Poshmark, Mercari):

  User clicks Connect Vinted
  → Lane desktop opens an embedded BrowserWindow to https://www.vinted.co.uk
    (partition persist:lane-vinted_uk, isolated from other channels)
  → User types email / Apple / Google / 2FA on Vinted’s real page
  → App watches cookies + URL. When a signed-in shell is visible
    (refresh_token_web present, or /member/ or wardrobe URL), it reads
    ONLY that WebView’s cookies, POSTs them to Lane
    POST /api/bridge/session  { marketplace, cookies, refreshToken, accessToken }
    Authorization: pairing token already on the machine
  → Tokens sealed AES-256-GCM with BETTER_AUTH_SECRET. Never logged.
  → Connect window closes. Settings shows that channel green.

Happy path for an OAuth channel (eBay UK, Etsy, Shopify, WooCommerce, Whatnot):

  User clicks Connect
  → system or in-app browser to the official consent screen
  → callback stores sealed tokens
  → no cookie scrape

Hard rules:
  • No Lane-hosted fake login.
  • No “paste your cookie” on the happy path. Hidden advanced fallback only.
  • Website Connect button, when running inside Electron, asks the
    desktop shell (window.laneDesktop.connect(marketplace)) to open the
    WebView. When running in a normal browser it says “Download Lane
    for Windows” for session channels, and still does eBay OAuth.
  • If a marketplace blocks datacentre IPs, those jobs stay on the
    desktop WebView. UI copy: “this channel runs on this PC”.
  • Pairing token is stored in the desktop app after the user signs
    into Lane once. They do not re-paste it every connect.


1. WINDOWS EXE
--------------
Add /desktop as Electron (Chromium cookie model). Not Tauri unless Electron
is blocked. electron-builder nsis installer.

Identity
  Product name: Lane
  Executable: Lane.exe
  Publisher: Lane (UK)
  AppId: uk.lane.desktop
  Default install dir: %LOCALAPPDATA%\Lane

First-run wizard — VISIBLE, boring, legitimate. Five steps, one screen
at a time, back/next, progress dots.

  1. Welcome
     “Lane keeps one inventory and lists it on the marketplaces you
     already sell on. You sign in on those sites. We never ask for
     those passwords.”
  2. Where files go
     Show %LOCALAPPDATA%\Lane. Do not hide it. Optional change folder.
  3. How connect works
     “When you press Connect, Lane opens the real Vinted / Depop /
     eBay page in a window. You sign in there. Lane then stores an
     encrypted session on this PC. We do not see the password.”
  4. Windows warning (unsigned builds)
     “This build is not yet code-signed. Windows may show SmartScreen.
     Click More info → Run anyway. That is expected until the owner
     buys an Authenticode certificate. Publisher: Lane (UK).”
  5. Optional start-with-Windows. Done → main window.

Wizard chrome: paper/ink palette, Lane wordmark, no dark-pattern
buttons, no silent admin, no bundled junk.

Main window loads LANE_APP_URL. Inject preload window.laneDesktop.
Menu: File, Connect (one item per channel), View → Dark mode, Help.

Ship: npm run dist on Windows produces dist/Lane Setup.exe.
Zip as Lane-Setup-win-x64.zip with Lane Setup.exe, SHA256.txt,
README-INSTALL.txt. Do not fake a PE file from Linux.

  git clone https://github.com/Bleuszz/lane
  cd lane/desktop
  npm install
  npm run dist


2. CROSSLIST TO EVERY CHANNEL
-----------------------------
Turn every channel in channels.ts on in the UI. Do not invent green dummy shops.

  Already live   vinted_uk (session / Bridge), ebay_uk (OAuth)
  P1             depop_uk, facebook_uk
  P2             etsy_uk, gumtree_uk
  P3             shopify, woocommerce
  P4             grailed, whatnot, poshmark, mercari

Each channel needs Connect via §0, field map in listing-fields.ts,
publish/update/delist OR honest “connected, publish adapter not wired yet”,
and a rate cap. Canonical model: one item, N channel_listings. qty 0 autodelists others.

Generalise POST /api/bridge/session so it accepts { marketplace }.
Never log cookie values.


3. DARK MODE
------------
Toggle in website header and desktop View menu.
Persist localStorage lane-theme = light | dark | system.
Set data-theme on <html> before first paint.

Light: paper #f2efe8 ink #171512 mark #1a4a3c surface #fbf9f5
Dark:  paper #161411 ink #f2efe8 mark #8fbfa8 surface #1e1b17
       raised #25211c muted #b3ada3 line #3a342c mark-fg #161411
No purple. No gradients. Same radii, type, spacing.


4. LANDING PAGE
---------------
Replace src/routes/index.tsx. One quiet page. No metric flexing. No bullets.
No numbered how-it-works tiles. No corporate words.

Voice: a UK seller talking to another seller. Vary sentence length.
Mention in prose: one inventory in more than one place; sign in on the
marketplace’s own page; Lane never takes those passwords; seven days free
then Starter £12/month; Windows app for connect-and-sync; UK, GBP.

Primary: Start 7-day free trial → /login?trial=1
Secondary: Download for Windows → /download
Download also in the header and last paragraph.


5. DOWNLOAD PAGE + ZIP
----------------------
Add /download. Link GitHub Releases and Drive folder
https://drive.google.com/drive/folders/1Mt51vCQELFEY7Ny2lhuotqcfpE76YEr_

README-INSTALL.txt: unzip, run Lane Setup.exe, SmartScreen More info →
Run anyway, walk five screens, sign in, Connect on the real site.


6. SEVEN DAY TRIAL
------------------
Stamp user_settings.trial_ends_at = now + 7 days.
Stripe Checkout trial_period_days: 7 when keys exist.
Show end date DD/MM/YYYY in Billing. Do not charge during trial.

migrations/0006_trial_desktop.sql
  alter table user_settings add column if not exists trial_ends_at timestamptz;
  alter table user_settings add column if not exists trial_started_at timestamptz;


7. QUALITY
----------
GBP, DD/MM/YYYY, en-GB. No marketplace passwords.
Push to https://github.com/Bleuszz/lane on main.
Update instructions.txt and README.md.
Report back only for Authenticode cert, Apple Developer, Stripe, eBay keys,
Cloudflare, Neon.

Do the work. Website + desktop source + honest connect is the ship.


8. FIRST COMMIT MESSAGE
-----------------------
Add desktop shell, dark theme, quiet landing, all-channel connect, and 7-day trial.
