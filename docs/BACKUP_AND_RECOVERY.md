# Backup and recovery

Checked [Neon plans](https://neon.com/docs/introduction/plans), 12 September 2026: Free history is six hours subject to a 1 GB-month allowance, plus one manual snapshot. Confirm account entitlements when provisioned. This is not independent long-term backup or a guaranteed recovery point. No cloud backup has been created or restore-tested here.

GitHub stores code, migrations and release metadata, not database contents or credentials. Keep stable auth/encryption secrets in the provider secret store and an owner-controlled secure backup. Losing encryption keys can make encrypted records unusable. Never include credentials in backup filenames or command arguments.

Before a populated-database upgrade, use a compatible PostgreSQL `pg_dump` client, credentials in a protected service/password file or process environment, and a timestamped custom-format output outside Git. With PGHOST/PGDATABASE/PGUSER/PGPASSFILE configured privately, run `pg_dump --format=custom --file=lane-backup.dump`. Encrypt the export using an owner-controlled key and retain it in an approved independent location. Record date, migration head and checksum only. Dumps contain account/personal data and must never go to GitHub. No backup subscription is authorised now.

Restore-test into an empty separate database, run `db:verify`, then compare expected account/trial/device records. Do not restore destructively over the active service. Cut over by deliberately changing the private `DATABASE_URL` only after validation. Reconcile jobs and revoke old credentials where appropriate; restoration must not replay marketplace writes. Automation stays disabled. Agree retention, responsible operator and tolerable data loss before paying customers; no recovery-time promise exists yet.

Render Free retains limited prior deploys. Code rollback must remain schema-compatible: migration checks reject a database newer than the code manifest. Use a forward fix or restore previous application behavior with the latest reviewed migration manifest. Do not remove migration history to force an old build to start.

Imported photo URLs can expire independently of PostgreSQL recovery. Existing inline image/derivative data follows database backups and consumes its small allowance. AI remains mocked/disabled. Render disk is ephemeral, never durable asset storage. Real image generation later needs a separate approved storage/retention/restore design.

Marketplace sessions stay in existing local encrypted Desktop storage. They are not uploaded or included in cloud backups. If a local session cannot recover, use normal marketplace reauthentication; never send cookie files as support attachments.
