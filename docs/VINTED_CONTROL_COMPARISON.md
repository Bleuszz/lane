# Vinted repair against the working eBay control — 11 September 2026

Baseline: branch `codex/lane-smart-crosslisting`, HEAD `b80e3f7`, including `f34d7b1` and `0bdb1eb`. Owner confirms eBay works. Existing saved eBay diagnostics independently show CONNECTED, LISTING_DISCOVERY_PASSED, 24 owned links matching the live count, identity resolved, identical visible/background Session objects, and cookies surviving login-window close. This investigation did not replay eBay's real session.

## Actual lifecycle comparison

Paths below are relative to `desktop/`. They identify executable functions, not proposed abstractions.

| Stage | eBay working implementation | Vinted before repair | Difference | Action |
|---|---|---|---|---|
| Entry | `secure-main.cjs` action(connect) → `connection-manager.cjs` connect | Same | None | Retain |
| Session creation | `session-transport.cjs` runtime → session.fromPartition; cached per profile | Same | None found | Retain exact Session instance |
| Partition | `lane-memory-<profile key>`; profileKey isolates device/marketplace/account slot | Same | No evidence origin storage is needed | Retain DPAPI cookie design |
| Login URL | openLogin → `/sh/lst/active` | openLogin → `/inbox` | Vinted main document becomes interactive without full load completion | Vinted-only dom-ready navigation |
| Navigation | secureWindow domain allowlist; openLogin bounded loadURL | Same loadURL wait | Vinted live trace never emitted did-finish-load | Keep strict allowlist; condition-driven readiness |
| Child windows | secureWindow setWindowOpenHandler, same explicit session and approved auth domains | Same | No proven child/session mismatch | No changes; Google restrictions remain |
| Cookie capture | runtime restores vault; sessionInfo counts allowed cookies, cookie change marks dirty | Same; 26 restored initially, 30 after navigation | Vinted session material was present | No magic cookie names or raw Cookie headers |
| DOM execution | inspect uses webContents.executeJavaScript after load | Same | Electron documents this method as waiting for loading to stop | Vinted uses bounded mainFrame.executeJavaScript after dom-ready |
| Auth detection | readPage combines Seller Hub route/container/account signals, no challenge/login | readPage requires authenticated navigation plus own profile/logout | Header rendered but identity control not hydrated | Retry observed user-menu-button, bounded to three attempts per inspection |
| Identity | inspect hovers `.gh-identity__greeting`; readPage resolves `/usr/<seller>` | readPage resolves numeric `/member/<id>` inside account chrome | Vinted profile link was behind account menu; initial click preceded hydration | Keep original Vinted identity rules; reveal menu then read again |
| Independent validation | manager.validate → transport.validate → hidden visit on protected page; same identity required | Same | visit stalled or returned identity missing | Vinted readiness used in both visible and hidden windows |
| Session proof | secureWindow asserts webContents.session === runtime.session and records deterministic partition | Same | No mismatch observed | Preserve and expose diagnostics |
| Login close | manager connect validates, persists, then closeLogin destroys windows only | Same | Previously never reached validation success | No lifecycle rewrite |
| Listing discovery | discover uses validated Seller Hub, owned links/row IDs, next pages, count agreement | discover opens validated wardrobeUrl; reader restricts links to matching owned profile/main | Auth header can precede wardrobe items | Wait for owned listing state before returning Vinted page |
| Detail extraction | readItems checks identity and requested ID; readPage parses rendered Product metadata | Same with Vinted attributes | Header can precede Product metadata; current field extraction remains partial | Wait for item metadata; preserve unknown values |
| Background refresh | manager.refresh validates then syncs through show:false windows | Same | Vinted readiness was the blocker | No visible browser required by this repair |
| Persistence | manager.validate/persist and secure-main dirty/quit handling → DPAPI vault | Same | Restored Vinted cookies now validate in fresh helper processes | Do not switch storage architecture |
| Cold restart | secure-main restores profiles and refreshes those with identity; expiry requires reconnect | Same | Full owner app restart not yet accepted | Owner acceptance still required; fixture storage check passes |
| Error reporting | manager stage/error category; profileDiagnostics whitelist; SESSION PROBE | Same | Navigation timeout obscured rendered/auth state | Add redacted route, dom-ready/finished/in-page, wardrobe-found evidence |

## Confirmed gates and bounded attempts

1. **F: dynamic-page readiness failure**, with **E: unresolved identity**. Live `/inbox` emitted dom-ready, document.readyState=interactive and in-page navigation but no did-finish-load. `webContents.executeJavaScript` waited on the unfinished load too. Cookie presence and exact background Session reuse were confirmed, so this was not evidence for changing persistence.
2. First menu attempt ran before hydration: observed BUTTON existed, no expanded menu/profile links, and SPA navigation occurred later. A bounded retry at 1.5 seconds exposed the stable profile route; existing identity/auth predicates then passed. No eBay selector or cookie rule was copied.
3. **H: premature listing readiness**. Owned profile identity resolved while listing state was unknown. Waiting for actual wardrobe content yielded 20 owned links. The timeout was not increased and unknown did not become zero.

## Live read-only evidence and limits

The helper `probe-saved-session.cjs --vinted-only --vinted-read-proof` decrypts the existing local vault, uses an ephemeral copy, and never persists rotated cookies/settings. Only metadata, booleans, counts and the already supplied public target IDs are printed. It does not perform marketplace writes.

- Restored Vinted session: identity resolved and protected `/inbox` authenticated; 30 allowed cookies, 9 HTTP-only; same background Session confirmed.
- Two independent validation windows resolved the same account. Matching owned wardrobe page returned 20 links.
- Target `9912534056` appeared and its detail reader returned title, description, GBP price, brand, category and one photo URL.
- Target `9912518964` was not in the discovered set. We have NOT established whether it remains active or whether more items require lazy-load/pagination handling.
- Full wardrobe completeness is unknown (no reliable total observed). Size, condition, colour and material remain unknown; photo completeness/order needs comparison with the actual listing. Existing data is not invented.
- Fresh interactive Connect → automatic window close → UI refresh → full application restart remains the owner's next acceptance test. The helper's successful cold-process cookie replay is useful evidence, not completion of those gates.

## Regression checks

- 19 targeted state-machine, diagnostics and security tests pass.
- `verify-vinted-readiness.cjs`: actual isolated Electron pages keep an image response open forever, delay account handlers and wardrobe/detail content. It proves dom-ready reads, matching identity, validation, auto-close, hidden refresh/detail reads, photo order, null unknown fields, mismatch rejection, challenge/expiry recovery and fixture disconnect cleanup.
- Unchanged `verify-session-flow.cjs`: eBay synthetic control passes connect, independent validation, auto-close, pagination/count matching, hidden refresh/details, expiry and disconnect.
- `verify-reader-gates.cjs`: greeting rejection, empty-vs-unknown, own/foreign wardrobe boundaries pass.
- `verify-storage-restart.cjs`: Windows-protected synthetic value survives separate Electron processes. Actual owner cold restart still pending.

## Delivery / next action

Commit source, generate the clean-HEAD fingerprint, build `npm run dist:dir --prefix desktop`, verify ASAR entry/module bytes and build-info against HEAD, launch the absolute win-unpacked/Lane.exe path, then inspect the visible fingerprint and both SESSION PROBE buttons. No installer, storage wipe, OAuth/API changes or paid services.

Ask one owner Vinted connection test once that exact diagnostic build is running. Then inspect the resulting stages; finish wardrobe completeness/field evidence and real restart acceptance before calling Vinted fixed. Weekly allowance after this pass: 58% used / 42% remaining; £0 spent.
