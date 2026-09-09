Lane for Windows
================

Unzip the folder. Double-click Lane.exe. SmartScreen: More info → Run anyway
(the build is not code-signed yet).

The window is the Lane website, not a separate inventory. First launch asks
for your Lane URL (the Cloudflare hostname). Paste it, sign in with the same
email you used on the site. Plan, products, and connected shops stay in sync.

Connect
-------
Accounts → Connect Vinted. A real vinted.co.uk window opens. Sign in there
(Google, Apple, email, 2FA all work). When you are in, Lane reads the session
cookies — including HttpOnly ones a normal website cannot see — posts them to
your Lane account, and closes the window. Same idea as Crosslist.

If a previous build left the Vinted window open after you were already in:
that was a cookie-filter bug on .co.uk domains. This build dumps the whole
cookie jar and also looks for the Log out menu, then closes.

You can also use Connect in the menu bar.

Phone
-----
Safari cannot hand Vinted cookies to a website. On a phone, use Firefox + the
Lane Bridge extension, or open the QR link and tap “Open in Lane Windows”
so this PC does the capture. 2FA prompts still work inside the Vinted window.

lane.json
---------
Sits next to Lane.exe:

  { "appUrl": "https://YOUR-LANE.pages.dev" }

File → Change Lane URL to pick a new host.

Do not paste marketplace passwords into Lane. Ever.
