# Cloud sync and report validation

The desktop database remains in `%APPDATA%/kumakh-college-management-system/database` across installer updates. All installations must use the same Turso database configuration. Install the updated application on devices that still run a local-only version; changing this source cannot retrofit an already installed executable.

Cloud push/pull and SQL transactions share one operation lock. Committed offline changes are uploaded at restart, after desktop requests, every 30 seconds, and at shutdown. Repeated background requests coalesce. Synchronization runs automatically without a manual control or status section. Turso is the only database used by the installed app; SQLite compatibility is reserved for importing old files and isolated development fixtures.

On first use of an older `kumakh.db`, the application imports missing records into the tracked `kumakh-sync.db` replica in one transaction. It preserves cloud rows with matching primary keys, keeps the original SQLite file, and saves a consistent JSON snapshot under `database/backups`. Unique-key/schema/foreign-key conflicts stop the migration rather than partially importing or silently overwriting cloud data. A durable marker prevents re-importing deleted records at later starts. Photo/document files still follow the existing Drive submission workflow.

Reports retry transient Google HTTP errors once with the same submission ID and payload. Pending submissions left by an interrupted process can be retried from history. A successful report still requires confirmation of its sheet, row count, and saved records.

## Validation commands

- `npm test`: database, migration, report contract, authentication, media, retry, and UI state regressions.
- `electron scripts/report-section-review.js`: isolated Reports renderer, including all 29 sections, partial failures, duplicate-click prevention, and interrupted submissions. It uses a fake remote API.
- `npm run db:turso:check`: read-only fresh cloud replica check, using root `.env` credentials.
- `npm run db:turso:check -- --write-probe`: writes a uniquely named temporary `SystemSettings` key locally, restarts the writer, verifies it from a second cloud replica, then deletes it and verifies cleanup. No business records are edited.

## Google deployment

Deploy the current `code.gs` to the existing Google Apps Script web app (new version of the same deployment). Keep its `/exec` URL in the report configuration. Local tests exercise both `code.gs` and `code.js`, but cannot prove which source is currently deployed in Google.

The live endpoint's login routing was reachable during validation. A full authenticated live submission still requires a reporting account with `reports.view` permission. The Windows installer does not deploy Google Apps Script.
