# Migration safety

`npm run db:migrate` uses `DATABASE_URL` privately loaded in the process. `npm run db:verify` checks reachability, recorded checksums, missing/extra migrations, critical tables and actual TLS on remote PostgreSQL. Both exit nonzero on failure without printing connection strings. Startup runs the same migrator; no manual code editing or separate Render shell is required.

Files matching `NNNN_name.sql` run in sorted order. The migration runner acquires transaction-scoped advisory lock 721034, applies all pending files and records normalized SHA256 checksums in one transaction. Concurrent starts serialize; repeat runs apply zero files. A SQL failure rolls back that migration batch and prevents startup. Edited historical SQL or a database ahead of this source is rejected. Existing pre-checksum installations are baselined once: this records current file checksums and cannot retroactively prove historic SQL was unmodified. Review the existing history before adopting a populated database.

Never edit an applied SQL file, delete `_migrations`, use schema-push/reset, or run an automatic down migration. Add a new ordered migration. Do not wrap files in COMMIT/BEGIN or use statements incompatible with the runner's transaction, such as CREATE INDEX CONCURRENTLY. Large future migrations need a planned maintenance process and timeout review. The current migration connection has a 60-second statement timeout; timeout rolls back cleanly. Backup before changes to a populated database.

## Audit of all current files

- **0001_auth — SAFE NEW SCHEMA.** Better Auth user/session/account/verification tables, indices and cascade relationships. Keep identical to its source copy. Old comments about build-time migrations are historical; current Node startup is authoritative.
- **0002_lane — SAFE NEW SCHEMA.** Inventory, images/tags, accounts, listing/job/activity/settings/sales tables and indices. Existing default values are subsequently corrected by ordered migrations. No seeded marketplace login is created.
- **0003_live_adapters — ALTERATION.** Adds legacy OAuth/lease/pairing columns; sandbox default changes. Does not populate credentials.
- **0004_honest_defaults — DATA MIGRATION.** Sets existing extension-awake flags false and fixes sandbox default. Deliberate state reset, not data deletion.
- **0005_connect_billing — ALTERATION + SAFE NEW SCHEMA.** Billing identifiers and legacy connect session table. Its existence does not enable cloud marketplace sessions.
- **0006_trial_desktop — ALTERATION.** Adds nullable trial timestamps.
- **0007_smart_listing — ALTERATION + SAFE NEW SCHEMA.** Adds specifics/photos/autofill settings and old AI usage table; AI defaults off.
- **0008_reliable_operations — DATA MIGRATION / POTENTIALLY DESTRUCTIVE TO JOB STATE.** Duplicate legacy active intents are marked dead for review, idempotency keys backfilled, unique indices and sale function installed. No job rows are erased or automatically replayed. Inspect duplicate/constraint conflicts before upgrading a populated legacy database.
- **0009_entitlements_usage — DATA MIGRATION + ALTERATION + SAFE NEW SCHEMA.** Backfills trial dates from existing clocks/created time, changes billing defaults and installs entitlement/AI ledgers/functions. Does not restart expired trials. Existing paid-state classification changes where no subscription ID exists: review legacy records before upgrade.
- **0010_channel_source — DATA MIGRATION + ALTERATION.** Copies legacy eBay specifics into empty canonical channel fields; preserves legacy column and adds source evidence columns.
- **0011_billing_webhooks — SAFE NEW SCHEMA + ALTERATION.** Receipt/lock tables and unique Stripe ownership indices. Existing duplicate customer/subscription identifiers intentionally block migration rather than silently merging owners.
- **0012_listing_snapshots — SAFE NEW SCHEMA.** Owner-scoped immutable snapshot records.
- **0013_ebay_photo_uploads — SAFE NEW SCHEMA.** Content-addressed upload receipts, no source image rewrite.
- **0014_sale_outbox_events — ALTERATION.** Replaces sale function to preserve distinct stock follow-ups. Existing records unchanged; affects later function invocations.
- **0015_manual_sale_amounts — ALTERATION.** Adds nullable cost/reference and basis fields; does not invent past costs.
- **0016_inventory_parent_guards — ALTERATION.** Adds owner/item unique index and NOT VALID foreign keys. New writes enforced; historical orphans intentionally preserved for later audit before VALIDATE CONSTRAINT. Deletion uses RESTRICT.
- **0017_ebay_order_polling — SAFE NEW SCHEMA + ALTERATION.** Owner/account unique index and isolated order-sync/event tables. Polling remains disabled.
- **0018_desktop_devices — SAFE NEW SCHEMA.** Pairing/device rows with hashed secrets, expiries and revocation fields.
- **0019_website_support_measurement — SAFE NEW SCHEMA.** Owner-bound support queue and aggregate event counters. Flags remain off.
- **0020_ai_workbench — SAFE NEW SCHEMA.** Wallet/job/reservation/cost/suggestion/asset lineage tables with ownership constraints. Provider calls remain disabled.
- **0021_scheduler_normalization — SAFE NEW SCHEMA.** Queue/settings/safety/history tables. Does not register a marketplace write transport or alter originals.
- **0022_request_limits — SAFE NEW SCHEMA.** HMAC-keyed count/expiry records plus cleanup index. No raw IP, request body or credential is stored in this table.

No current migration drops/truncates an application table. Function replacements and legacy state updates are meaningful changes, not all “additive.” Constraint conflicts fail the entire pending batch. `check:deploy` tests all files on fresh PostgreSQL, concurrent/repeated migration, tampered checksums and SQL rollback. It also keeps local schema/entitlement/device regression tests.

## Upgrade and rollback

For first staging, provision an empty database. For future changes: export/verify a private backup, inspect migration diff and affected data, run the one-command check, then deploy. If startup fails, leave the database intact, inspect the sanitized code and diagnose privately. Restore to a separate database/branch for recovery, validate there, then deliberately change the application URL secret. Code rollback must remain compatible with the schema; the migrator refuses a database with newer migrations than its code. Prefer a forward fix or deploy older application behavior retaining the latest reviewed migration manifest, not deleting history.
