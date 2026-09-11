# Lane Desktop 0.3.1 — auth/session rebuild beta

The newer session diagnostic runs from `Launch Lane Session Diagnostic.vbs` using local
development source. It is **not included in this installer**. See `docs/SESSION_DIAGNOSTIC.md`.
The next installer waits for live owner-session/read acceptance.

This is a Windows x64 test build. It is not a verified production crosslisting release.

## Included

- Standalone Lane interface, version display, optional Windows startup, pause and redacted diagnostics.
- Separate Vinted UK and eBay UK login windows. Marketplace pages have no Node access or Lane preload.
- Local encrypted cookie storage using Electron safeStorage (Windows DPAPI). Each marketplace profile has its own encrypted file and in-memory browser partition.
- Validated connection state machine, automatic login-window closure, background listing refresh and a bounded read of two owned links. Observations stay local. Unknown attributes remain unknown.
- Lane browser approval with matching code, verifier-protected single-use pairing, short-lived access, heartbeat and device revocation.
- Per-user NSIS installer and branded icon. No Node, terminal or cookie extraction required for users.

## Install and update

Run `Lane-Setup-0.3.1.exe`. Choose the install location, then open Lane from Start. This build is **unsigned**: Windows may report an unknown publisher. Do not describe it as signed or verified by Microsoft. Code signing and store distribution require a later release decision.

The test build allows marketplace login checks before Lane is deployed. Leave the temporary website address blank for those checks. When staging exists, enter its exact HTTPS origin, choose Sign in to Lane and approve the same code in the browser. Then connect a marketplace and sign in directly there.

Choose Connect (or Reconnect) and sign in directly. Lane must independently validate the session and account before showing Connected and closing the login window. Refresh listings runs in the background. Read item details reads at most two current owned links; it does not populate cloud inventory yet. Report the exact status/error if validation fails; do not share passwords, cookies or tokens.

Choose **Review read items** to inspect saved source IDs, descriptions, fields, unknown values and photo order. Thumbnail requests are restricted to supported marketplace image hosts and carry no Lane session headers; other URLs remain visible as text. This is an inspection screen, not a claim that extraction is complete.

Updates are manual for this beta. Quit Lane before installing a newer version over it. There is no automatic download/install or unsigned update feed. Future version checking should use a maintained HTTPS release manifest, show an update notification, validate signed artifacts and retain the previous release. Do not automatically roll back encrypted state across incompatible schema versions; preserve it and reconnect if necessary.

Uninstall through Windows Settings → Apps → Lane. The installer is configured to remove app data on uninstall. **Disconnect** inside Lane first for a deliberate local session removal; **Disconnect Lane** revokes web pairing. Neither action logs other devices out of the marketplace. Windows installer upgrade/uninstall behavior still needs an interactive clean-machine check.

## Storage and recovery

Storage is under Electron's `app.getPath('userData')/protected` (normally `%APPDATA%/Lane/protected` on Windows). `settings.vault` holds encrypted local configuration and Lane pairing credentials; hashed profile filenames hold encrypted cookies. No raw credentials are sent in diagnostics or to the cloud. Browser cache/localStorage are not persisted by this transport. Some marketplace login methods may therefore need further work after real tests.

DPAPI protects data at rest for the Windows user. It does not protect against malware or somebody controlling that Windows account. When protected storage cannot be unlocked, Lane fails closed and does not silently replace it. Marketplace status is rechecked after restart; saved cookies alone are not proof of a valid session. Choose Reconnect after expiry; only that interactive step opens the login window. Disconnect clears the local session, cached observations and browser storage.

Legacy desktop sources remain in Git for continuity but are excluded from this package. Existing legacy `lane.json` is not read or migrated. Old remotely stored sessions are not automatically erased; owners must reconcile/revoke those separately. Legacy cloud-cookie intake is disabled by default. Do not enable `LANE_LEGACY_CLOUD_SESSIONS` for this beta.

## Reproducible build

Maintainer commands from the repository root:

```powershell
npm ci --prefix desktop
npm run verify:runtime --prefix desktop
node desktop/verify-storage-restart.cjs
npm run test:desktop
& desktop/node_modules/electron/dist/electron.exe desktop/verify-session-flow.cjs
npm run dist --prefix desktop -- --publish never
Get-FileHash desktop/dist/installer/Lane-Setup-0.3.1.exe -Algorithm SHA256
Get-AuthenticodeSignature desktop/dist/installer/Lane-Setup-0.3.1.exe
```

Electron and electron-builder are pinned in `desktop/package-lock.json`. Packaging reuses the installed Electron distribution to avoid a Windows unpack/rename failure observed in the builder download path. Output is `desktop/dist/installer/`, including the installer, blockmap and unpacked application. Only the explicit `build.files` allowlist enters the application archive. Build files and local vaults are ignored by Git. Reproducible means a locked, repeatable process; installer timestamps mean byte-identical output is not promised.

Check archive contents, signature status, checksum, install, launch, reconnect and uninstall before publishing a release. Update version in package/lock/download metadata together. Publish only the intended versioned installer and checksum, then set the verified public URL and byte size in `src/lib/lane/download.ts`. `/download` deliberately has no active public installer button until an artifact is hosted.

## Evidence and next gates

Windows safeStorage encryption/decryption, encrypted file inspection, local UI launch, packaging and synthetic browser/device pairing have been checked. These do **not** prove real Vinted/eBay authentication, session persistence, owned listing extraction or canonical inventory import. See `docs/AUTH_SESSION_REBUILD.md` and `progress.txt` for the current gates. Real Google success and both owner marketplace flows remain unproven. The 3 PM reminder was deleted and will not be recreated.
