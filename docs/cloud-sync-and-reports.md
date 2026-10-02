# Cloud sync and report validation

The desktop database remains in `%APPDATA%/kumakh-college-management-system/database` across installer updates. All installations must use the same Turso database configuration. Install the updated application on devices that still run a local-only version; changing this source cannot retrofit an already installed executable.

The installer supplies the authoritative URL/token pair in resources/config/turso.env. Stale runtime.env and shell variables cannot override a packaged release. Dashboard URLs are rejected. Building with TURSO_CONFIG_FILE=.env uses the verified development configuration; the packaged EXE must successfully read the cloud with its shipped credentials before packaging can finish. Changing database identity creates a separate cache and preserves the previous replica and pending changes.

Startup awaits a cloud pull/rebase, guarded push, and final pull before opening the login window. Synchronization also runs after committed requests, every 30 seconds, and at shutdown. SQL transactions and sync share an operation lock. The renderer receives a completion event and reloads the current view; active edits are preserved with a reload notice. An unavailable cloud displays LOCAL/OFFLINE MODE and queued changes remain local. A first installation without a usable cache must bootstrap online.

Updates and deletes compare the complete original row atomically, including null values. If the cloud row has changed, the cloud value wins. Inserts never replace a conflicting cloud row. This avoids relying on PC clocks or second-resolution timestamps. Local mutation intent is retained in database/backups/sync-intents.jsonl for reviewed recovery. This policy resolves conflicts per row; related business changes should be checked when recovering conflicting offline transactions. All PCs must install the fixed version: an old writer cannot be protected by code running only on another PC.

Old standalone kumakh.db files are preserved but no longer automatically imported at startup. Automatic import could resurrect cloud-deleted records on a second PC. The explicit legacy import utility remains available for reviewed recovery. Photo/document files still follow the existing Drive submission workflow.

Diagnostic entries in database/logs/turso-sync.jsonl contain the endpoint domain, connection state, last successful sync time, submitted guarded row mutations, downloaded changed records/deletions, and redacted errors. Uploaded counts describe mutations sent, not guaranteed accepted rows (a stale guarded mutation may change zero rows). Download counts describe records changed in the local cache, not network packets. No tokens or row contents go into that diagnostic log. The recovery history is separate and contains local record values.

Reports retry transient Google HTTP errors once with the same submission ID and payload. Pending submissions left by an interrupted process can be retried from history. A successful report still requires confirmation of its sheet, row count, and saved records.

## Validation commands

- `electron scripts/sync-ui-smoke.js`: real preload IPC, online/offline labels, refreshed student data, and unsaved draft protection.
- `npm test`: database, migration, report contract, authentication, media, retry, and UI state regressions.
- `electron scripts/report-section-review.js`: isolated Reports renderer, including all 29 sections, partial failures, duplicate-click prevention, and interrupted submissions. It uses a fake remote API.
- `npm run db:turso:check`: read-only fresh cloud replica check, using root `.env` credentials.
- `npm run db:turso:check -- --write-probe`: writes a uniquely named temporary `SystemSettings` key locally, restarts the writer, verifies it from a second cloud replica, tests stale-edit and stale-delete conflicts, then deletes it and verifies cleanup. No business records are edited.

## Google deployment

Deploy the current `code.gs` to the existing Google Apps Script web app (new version of the same deployment). Keep its `/exec` URL in the report configuration. Local tests exercise both `code.gs` and `code.js`, but cannot prove which source is currently deployed in Google.

The live endpoint's login routing was reachable during validation. A full authenticated live submission still requires a reporting account with `reports.view` permission. The Windows installer does not deploy Google Apps Script.
