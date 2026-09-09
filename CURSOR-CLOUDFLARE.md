# Paste this into Cursor

Open `CLOUDFLARE-PROMPT.md` in this repo and paste the block under the `---` line into a new Cursor chat.

That prompt tells Cursor to **update the existing Cloudflare + Neon deploy** with latest `main`. It must not create a second project and must not rebuild the Windows EXE.

Expected report back from Cursor:

1. Live HTTPS URL
2. Pages vs Workers project name
3. Neon + migrations 0001–0006
4. Env names set / still empty
5. `/` `/download` `/login` account create
6. Errors

Windows zip (do not replace):
https://drive.google.com/file/d/1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr/view

Share that Drive file **Anyone with the link** or `/download` hits a Google login wall.
