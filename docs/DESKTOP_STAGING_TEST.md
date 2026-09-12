# Shared-account live acceptance

Local release proof exercises real HTTPS application + PostgreSQL: signup, device approval, verifier exchange, heartbeat, server restart, refresh and revoke. Regression tests cover ownership, expiry, one-use exchange and local state/security. This does not prove the packaged Desktop has paired with Render.

After staging is Live, Codex launches the exact verified existing unpacked executable by absolute path, checks process path/fingerprint and preserves profiles. No reinstall or marketplace-session clearing is needed.

1. Create one synthetic staging Lane email/password account. Confirm seven-day trial and zero AI credits.
2. Configure the generated HTTPS website origin in Desktop. Choose Sign in to Lane; the normal browser opens the same website account/approval flow.
3. Check the pairing code and approve under the intended account. Desktop must never request stored Lane passwords or associate a different user.
4. Verify pairing, version, heartbeat and last-seen on `/devices`. Tokens never appear in screenshots/UI/Copy diagnostics.
5. Close/relaunch the same Desktop build/profile, then restart/redeploy the web service. Pairing and original trial dates must persist.
6. Revoke on the website. Existing access and refresh must both be refused; Desktop asks to pair again and cannot resume with old credentials.
7. Start a fresh pairing; confirm new owner-bound credentials. Quit Desktop and check offline messaging. Expired access refreshes only while authorised.
8. Record build SHA, safe status and time; inspect logs for secret leakage. Do not record token/cookie values.

Report exact failed gates. Do not clear local eBay/Vinted state to avoid diagnosis. The first product task after deployment is **full Vinted listing-detail extraction**; “Title unknown” with discovered IDs does not prove full import.
