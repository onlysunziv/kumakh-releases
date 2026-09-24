# Current Windows release storage note

For the September 2026 automatic-update implementation, the installed application
uses `%APPDATA%\kumakh-college-management-system\database\kumakh-sync.db` with
credentials in user-local `turso.env` or `runtime.env`. Some historical directions
below describe older storage/build behavior and are retained as history. Follow
[RELEASES.md](RELEASES.md) for current installed paths, credential provisioning,
backup/migration safeguards and updater acceptance testing. Do not copy or restore
an actively used replica, and do not assume the Node backup script targets the
installed application's database.

# Historical application storage

SQLite is the required primary database. Electron stores it at
`app.getPath("userData")/database/kumakh.db`, creates it when missing, enables
foreign keys and WAL mode, and runs non-destructive migrations on startup.
The application does not require internet access, Turso, Google Sheets, or
Google Drive to open and operate locally.

Turso support remains optional and must never block SQLite startup. If optional
Turso credentials are present, any cloud synchronization failure is a warning;
local SQLite operations continue normally.

Production configuration template:

```env
TURSO_DATABASE_URL=<MY_DATABASE_URL>
TURSO_AUTH_TOKEN=<MY_NEW_ROTATED_TOKEN>
```

Optional Turso credentials are read only by the backend integration. They are
not required for startup, are not returned to the renderer, and are not used
as the primary database path.

All frontend API calls use the Electron IPC bridge and local SQLite, including login.
There is no remote CRUD fallback. Google Sheets is contacted only when submitting
or retrying a report. Previews and submission history come from SQLite.

Set the report Web App /exec URL and submission token in Settings. The token must
match REPORTS_API_TOKEN in the deployed Apps Script properties. A saved URL takes
precedence over REPORTS_APPS_SCRIPT_URL; REPORTS_API_TOKEN is an optional environment
fallback. Tokens are never returned with report configuration. Failed exports are
recorded locally and can be retried with the same submission ID and saved rows.

Electron installations store the primary SQLite database at
`app.getPath('userData')/database/kumakh.db`, never beside the executable or
inside `app.asar`. Explicit test/import databases may still use a supplied
filesystem path. Existing SQLite records are preserved.
Records that exist only in Google Sheets are not automatically imported by this fix.
Run the updated project or rebuild the installer; existing dist packages are unchanged.
Regression checks: node --test tests/*.test.js.

The historical migration notes below describe the original SQLite adapter work;
the remote frontend fallback and payroll limitation mentioned there are now fixed.

# SQLite migration

## Inspection and implementation plan

The application is Electron 32 / CommonJS JavaScript. `electron/main.js` forwards
the existing IPC API to `electron/database.js`; all local SQL is in that module.
The browser fallback and Google Apps Script are separate remote integrations.
They and every frontend file remain unchanged.

`mysql.sql` is the current schema (including media, ledger, payment and reporting
tables). `db.sql` is an older, incomplete SQLite schema and is not used for startup.
There are no stored procedures, SQL triggers or explicit runtime transactions in
the current implementation. Relationships, indexes, defaults and unique keys are
defined in `mysql.sql`. Payroll summary references two columns absent from that
schema; this discrepancy must be reported rather than silently changing payroll.

Planned changes:

1. Add an asynchronous SQLite adapter behind the existing `pool.query` interface.
2. Generate and inspect a complete SQLite schema from `mysql.sql`; preserve all
   tables, columns, relationships, indexes, defaults and initial admin seed.
3. Convert the specific runtime SQL dialect differences in `electron/database.js`:
   inline indexes/engine clauses, upserts, INSERT IGNORE, SHOW COLUMNS, GREATEST,
   NOW and CURRENT_DATE. Keep bound parameters and date string results.
4. Serialize atomic local operations; keep remote submission outside transactions.
5. Add versioned initialization, safe online backup and an intentional MySQL import
   with schema checks, row verification and rollback on any failure.
6. Test using disposable databases, then remove mysql2 from runtime dependencies.

The development database resolves from the project root; packaged builds resolve
from the executable directory (outside app.asar), always `database/kumakh.db`.
No working-directory fallback is allowed. Install into a writable local folder.
This checkout is in OneDrive: move the project to an unsynced local directory
before using a live database. Do not share an active file between machines.
Use rollback journaling with FULL synchronization and a busy timeout; WAL is not
selected for this portable installation currently located in a sync folder.

Decimal columns retain decimal strings (TEXT affinity) and their original scales
in metadata; writes are rounded to the original MySQL decimal scale. Existing
application Number calculations and SQL aggregates remain unchanged.

## Result and files

Modified: `electron/database.js`, `electron/main.js`, `package.json`,
`package-lock.json`, `.env.example`, `.gitignore`.

Created: `electron/sqlite-pool.js`, `database/KUMAKH_DATABASE.sql`,
`database/columns.json`, `database/seed.sql`, `scripts/build-sqlite-schema.js`,
`scripts/convert-database-module.js`, `scripts/migrate-mysql.js`,
`scripts/mysql-migration.env.example`, `scripts/backup-database.js`,
`tests/sqlite.test.js`, `tests/import.test.js`, and this document.

`sqlite3` 6.0.1 provides asynchronous native SQLite access. `mysql2` is now a
development dependency used only by the intentional import utility; it is absent
from normal application imports and production dependencies. The original `.env`
and `mysql.sql` remain available for import/fallback. The original `db.sql` remains
an unused historical artifact. Existing distributables in `dist` are not updated.

The 43 schema tables are: Courses, Students, StudentDocuments, StudentMedia,
StudentMediaChunks, Staff, StaffDocuments, Vendors, Expenses, Purchases,
PurchaseItems, PurchasePayments, Payroll, Inventory, InventoryTransactions,
CafeCategories, CafeMenu, CafeTables, CafeCustomers, CafeSales, CafeSaleItems,
CafePayments, CafeRecipes, CafeRecipeItems, Roles, Users, Permissions,
RolePermissions, UserPermissions, StudentPayments, VendorPayments, StaffPayments,
CreditSales, DueReceived, CustomerPayments, CustomerLedger, VendorLedger,
DayClosings, AuditLog, SyncQueue, SystemSettings, ReportSubmissions, FileAttachments.

SQL conversion removes engine and inline index clauses, creates separate indexes,
uses SQLite upserts and `excluded` values, uses PRAGMA table_info, replaces
GREATEST with scalar MAX, and uses local-time SQLite date functions. JSON functions,
backtick identifiers, positional parameters and supported joins remain intact.

## Run and import

1. Move the project/installation to a writable, **unsynced local disk folder**.
   The current checkout is under OneDrive; no live `kumakh.db` was created there.
2. For existing data, stop KUMAKH and temporarily start the original MySQL server.
   Keep its credentials in the existing `.env` or supply the variables shown in
   `scripts/mysql-migration.env.example`. Run `npm run db:inspect`, then
   `npm run db:migrate` before first startup. The importer never writes to MySQL.
3. Start with `npm start`. On this machine the npm launcher is broken; the exact
   PowerShell alternative from the project directory is:

   `& .\node_modules\electron\dist\electron.exe .`

   To run npm scripts on this machine use:

   `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" test`

4. A fresh installation automatically creates `database/kumakh.db`, all tables,
   schema version 1, and the original seed account. Existing records are never
   reset. Unknown/newer or incomplete schemas fail safely rather than being erased.
5. After import verification, MySQL/XAMPP can stay stopped. Local database calls
   never connect to a server. Google Sheets/Drive features still need internet.
6. Rebuild distributables with `npm run build:win` before distributing this change.
   Schema assets are included in the packaging configuration; writable data lives
   beside the executable, outside app.asar. Packaged-install testing remains pending.

The importer uses a read-only consistent InnoDB snapshot and a separate SQLite
staging file. It preserves IDs, checks source columns, copies every field, checks
every row count, compares every converted record and validates foreign keys before
publishing the database. Any unknown table/column, constraint failure or mismatch
stops migration. It will not overwrite an existing destination. Failed staged
imports have their rows rolled back and their diagnostic path reported.

If a destination already exists, back it up and intentionally move it aside while
the app is closed. Never replace a database with unverified imported records.

## Backup and schema updates

`npm run db:backup` synchronizes a configured embedded replica first and creates
`backups/kumakh_<timestamp>.db` from the local replica. Standalone SQLite uses
SQLite VACUUM INTO for a consistent snapshot. It refuses to overwrite a backup. To restore,
close the app, keep the current database as a separate backup, then put the verified
backup at `database/kumakh.db`. Do not copy an actively written database file.

Initialization uses PRAGMA user_version. Future schema changes should add ordered,
transactional version steps to `SQLitePool.initialize`; advance user_version only
after successful validation. Never edit the version-1 schema expecting existing
installations to pick up added columns automatically. Never delete a user's file
to apply a migration.

## Verification and remaining issues

- `npm test` (via the direct npm CLI path) passed: syntax checks and two integration
  tests using disposable SQLite databases.
- The local API regression also passed inside Electron 32 / Node 20.18.1, confirming
  that its runtime can load the native driver.
- Tested schema/column coverage, PRAGMAs, decimal rounding, course edits, student
  updates/deactivation and payments, staff retrieval, vendor payments, purchases
  and items, ledgers, café Cash/QR/Credit and partial credit receipts, inventory
  precision, payroll stored figures, login/password rejection, permission assignment
  and overrides, all component report previews, mocked report submission/retry,
  audit persistence, concurrent saves, injected child-write rollback, foreign-key
  rejection, consistent backups, integrity check and reopening persistence.
- Import fixture: 1 source row = 1 destination row, all fields verified. Duplicate
  source IDs cause rollback; destination-overwrite attempts leave bytes unchanged.
- **Actual MySQL data migration and row-count comparison are pending:** the source
  connection returned ECONNREFUSED. No live data was copied or deleted.
- The supplied schema lacks `Payroll.employee_name` and `outstanding_salary`, which
  the pre-existing payroll-summary method queries. The test confirms this existing
  error; payroll storage/retrieval passes. Resolving this requires the actual source
  schema or a separate decision about the intended calculation.
- SQLite NOCASE preserves ASCII case-insensitivity but does not fully reproduce
  MySQL utf8mb4_unicode_ci accent/Unicode comparison rules. Non-ASCII uniqueness and
  sorting parity require further validation against the real source data.
- Raw SQLite aggregates use numeric results; decimal storage/rounding is preserved,
  but exhaustive MySQL-versus-SQLite aggregate result-type parity needs the live
  source. Existing application Number-based calculations were not redesigned.
- Real Google Sheets/Drive delivery, interactive printing, every UI workflow,
  packaged startup, and XAMPP-stopped interactive acceptance remain untested.
  Google integration code and all frontend HTML/CSS/JavaScript are unchanged.
  Existing user-visible references to “MySQL” were deliberately retained under
  the strict no-UI-change requirement.
