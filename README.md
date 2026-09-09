# Lane

UK-first crosslister. One canonical inventory record; channel listings hang off it. A confirmed sale with quantity 0 delists the rest.

**This is not a Crosslist clone and it never stores marketplace passwords.**

- eBay UK — official REST OAuth (`sell.inventory`)
- Vinted UK — Lane Bridge and/or the Windows app WebView session
- Other channels in `channels.ts` can be connected; publish adapters ship as they are wired
- 7-day trial, then Starter £12 / month
- Dark mode (same brand, inverted paper/ink)
- Windows desktop app in `/desktop`

## Repo map

| Path | What |
|---|---|
| `AGENT-PROMPT.md` | **Paste-this prompt** for the next coding agent |
| `DESKTOP-BRIEF.md` | Pointer to that prompt |
| `instructions.txt` | Developer handoff |
| `desktop/` | Electron shell, setup wizard, WebView cookie capture |
| `extension/` | Chrome/Firefox MV3 Lane Bridge |
| `src/routes/download.tsx` | Public download page |

## Windows installer

On a Windows PC with Node 20+:

```sh
cd desktop
BUILD-ON-WINDOWS.bat
# dist/Lane Setup.exe
```

## Local web app

```sh
cp .env.example .env
npm install
npm run dev            # 0.0.0.0:8080
```
