Lane for Windows
================

1. Unzip this folder.
2. Double-click Lane Setup.exe. If you only have the source tree, open
   Command Prompt in the desktop folder and run:
     npm install
     npm run dist
   Then use dist\Lane Setup.exe.
3. If Windows SmartScreen appears, click More info, then Run anyway.
   This build is not code-signed yet. Publisher: Lane (UK). That warning
   goes away when the owner buys an Authenticode certificate.
4. Walk the five setup screens. They are meant to be readable.
5. Sign in to Lane. Open Connect, pick a marketplace, and sign in on
   that site. Lane never asks for the marketplace password.

eBay uses official OAuth. Vinted, Depop, Facebook Marketplace, Gumtree,
Grailed, Poshmark and Mercari use the in-app window on the real site.
Publish adapters other than Vinted and eBay are marked honestly if they
are not wired yet.

UK product. GBP. Questions: the repo at https://github.com/Bleuszz/lane
