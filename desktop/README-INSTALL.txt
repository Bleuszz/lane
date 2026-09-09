Lane for Windows
================

Unzip the folder. Double-click Lane.exe. SmartScreen: More info → Run anyway
(the build is not code-signed yet). Publisher shows as Lane (UK).

The window is the Lane website, not a separate inventory. First launch asks
for your Lane URL (the Cloudflare hostname). Paste it, sign in with the same
email you used on the site. Plan, products, and connected shops stay in sync.

Connect
-------
Accounts → Connect Vinted. A real vinted.co.uk window opens with a bar at the
top. Sign in there (Google, Apple, email, 2FA all work). When you are in —
Sell now visible, or Log out in the profile menu — Lane dumps the cookie jar,
reads any Bearer token, posts it to your Lane account, and closes the window.

If the window sits there after you are clearly in, click “I'm signed in —
connect” on the bar.

Do not use an old zip that looks like a local “Home / Connect / Inventory”
app. That build never captured sessions. This one loads the website.

Phone
-----
Safari cannot hand Vinted cookies to a website. Generate a connect link on
the website, then on this PC tap “Open capture in Windows app”. Android
Firefox + Lane Bridge is the only on-phone capture path.

lane.json
---------
Sits next to Lane.exe:

  { "appUrl": "https://YOUR-LANE.pages.dev" }

Press Alt → File → Change Lane URL to pick a new host.

Do not paste marketplace passwords into Lane. Ever.
