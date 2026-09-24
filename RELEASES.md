# KUMAKH Windows updates and releases

The implementation is complete and the application version remains **1.0.0**.
No public release was made. The configured release destination is the existing
public repository `onlysunziv/kumakh-releases`. Publishing uploads compiled
installer/update artifacts only; it does not push this project's source code.

## One-time setup

1. Use the **existing public repository** `onlysunziv/kumakh-releases` exclusively
   for compiled release/update artifacts. Do not create another repository or
   upload application source. `package.json` already explicitly sets
   `provider: github`, `owner: onlysunziv`, `repo: kumakh-releases`, and
   `releaseType: release`. These settings also become each installed
   application's update destination. No owner/repository placeholders remain.
2. Create a fine-grained GitHub personal access token restricted to that release
   repository with **Contents: Read and write**. Enter it only in the development
   terminal session. Do not add it to `.env`, npm configuration, scripts or source.
3. In PowerShell, from this project:

   ```powershell
   npm ci
   npm test
   npm run build:win
   ```

   `npm ci` is needed on a new checkout; dependencies are already installed here.
   If this PC's npm launcher fails, define this session-only wrapper first:

   ```powershell
   function npm { & node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' @args }
   ```

4. Provision runtime credentials **on each Windows user account that runs the
   installed application**, before its first launch with this build. The old
   packaging configuration included `.env`; new installers deliberately exclude
   all environment files. Existing `%APPDATA%\kumakh-college-management-system\turso.env`
   remains supported. Existing report settings stored in the database remain
   supported too. For installations that relied on bundled `.env`, run this once
   from a secured project copy containing that installation's existing `.env`:

   ```powershell
   npm run config:installed
   ```

   This explicitly copies only Turso and report configuration to
   `%APPDATA%\kumakh-college-management-system\runtime.env`. It refuses to
   overwrite an existing runtime.env, does not copy GitHub publishing credentials,
   and prints no credential values. On other PCs an administrator can instead
   provision that file directly through their secure process. Do not distribute
   runtime.env in a GitHub release. Preserve each installation's existing Turso
   endpoint and identity. Missing Turso configuration stops startup with a
   meaningful error; it never falls back to a new empty production database.
5. Install the newly rebuilt `dist\KCMT-Setup-1.0.0.exe`. An older installed app
   without this updater must receive this baseline installer manually once.

## Publishing commands

Set the publishing token in each new development PowerShell session without
putting it in shell history:

```powershell
$env:GH_TOKEN = [System.Net.NetworkCredential]::new('', (Read-Host 'GitHub release token' -AsSecureString)).Password
```

Then run exactly one command for the intended release:

```powershell
npm run release:patch   # 1.0.0 -> 1.0.1
npm run release:minor   # 1.0.1 -> 1.1.0
npm run release:major   # 1.1.0 -> 2.0.0
```

Each command checks owner/repository/token configuration and matching package
versions before changing files, obtains a local publishing lock, runs
`npm version <kind> --no-git-tag-version --ignore-scripts`, then executes
`electron-builder --win --publish always`. Both package manifests advance.
The public GitHub release is created with `releaseType: release`, rather than
remaining a draft. Installed clients need no publishing token. Add release notes
to the GitHub release body; they will appear as plain text on subsequent checks.

To publish the initial/current version **without increasing it**, or recover a
failed publish of that version after inspecting its existing GitHub assets:

```powershell
npm run release:publish
```

On any build/publish failure the command exits nonzero and retains the version.
Do not blindly run another patch bump: inspect the failed release first. A
partially uploaded public release may exist. Retry `release:publish` to finish it;
if replacing already-published application bytes, use a new version instead.
After a terminated process, `.release.lock` may remain; remove it only after
confirming that no release process is still running. No Git commit or tag is
created in this source folder (which currently is not a Git repository).

```powershell
Remove-Item Env:GH_TOKEN
```

## Builds and artifact verification

```powershell
npm run build:win       # Always --publish never, even with a token or CI variables
npm run release:verify
```

Electron-builder generates all metadata. Never create/edit latest.yml manually.
For each version, output includes `KCMT-Setup-<version>.exe`, the corresponding
`.exe.blockmap`, and `latest.yml`. Verification compares the installer size and
SHA-512 against metadata, checks the packaged version and GitHub feed, and checks
the blockmap exists. A pre-artifact `afterPack` hook inspects the actual archive
for credential patterns, known environment-secret values, database files,
environment files, and private key files. No source, operational SQL dump, seed
data, Apps Script deployment source, local attachments or backup is released.

After a publish, confirm that all three assets are visible in the same public
GitHub release. The validator checks the local output; actual client download
and GitHub availability are covered by the installed two-version test below.

## Installed application behavior

- The version comes from `app.getVersion()` through limited preload methods.
- A packaged Windows app checks 12 seconds after its window becomes ready, then
  every six hours. Users can also check from Settings → Software Update or the
  Software Update section of the login page. Development builds do not contact
  the updater and show that updates are unavailable in development.
- Downloads require **Download Update**. The UI shows versions, last check time,
  release notes, percentage, and transferred/total MB. Checks and downloads cannot
  overlap or start twice. Failed checks/downloads leave the app usable; use Check
  for Updates and then Download Update to retry after restoring connectivity.
- A downloaded update shows **Restart & Install** and **Install Later**. Install
  Later suppresses the current announcement and leaves the update available. It
  does not install automatically on exit.
- Finish/save or cancel your work, then sign out. Restart from Settings explains
  this requirement rather than closing your workspace. On the login screen open
  Software Update, choose Restart & Install and confirm the native dialog. Main
  process checks require every application window to be at login and all API/PDF
  operations to be finished. It then blocks new requests, stops background sync,
  waits for database shutdown, and starts the installer. No transaction or unsaved
  workspace is automatically closed for an update.
- Download errors/checksum errors are handled as retryable update failures.
  Installer failure is reported, with a relaunch if the database was already
  closed. Downloaded installers are verified by electron-updater.
- Logs: `%APPDATA%\kumakh-college-management-system\logs\main.log` (electron-log,
  rotated at 2 MB). Sensitive URLs, authorization values and known tokens are
  redacted. Updater errors shown to the renderer contain no raw server responses.

## Database preservation and migrations

The production path already uses `app.getPath('userData')`, not the installation
directory. Its name, appId, product name and installer identity are unchanged.
For the default Windows account this is:

```text
%APPDATA%\kumakh-college-management-system\database\kumakh-sync.db
%APPDATA%\kumakh-college-management-system\database\kumakh.db
%APPDATA%\kumakh-college-management-system\files\...
%APPDATA%\kumakh-college-management-system\backups\...
```

Production currently requires the configured Turso replica (`kumakh-sync.db`).
The SQLite adapter is also retained for explicit local files and tests. No live
database was moved, imported, reset, seeded, copied into the installer, or tested
against during this work. NSIS `deleteAppDataOnUninstall: false` is preserved.
Keep the application's `name` and storage identity stable in future releases.

`PRAGMA user_version` records schema version 2. Existing v1 data receives a
timestamped backup before additive migration statements; Turso checkpoints under
its operation/sync locks before copying and SQLite uses `VACUUM INTO`. Migrations
run in a transaction, validate columns, foreign keys and integrity, record/check
the version, then commit. Failure rolls back and reports the retained backup
path. A backup failure prevents the migration. Newer or populated unversioned
databases fail closed. Extend the ordered migration list for future schemas;
never replace a database to make it match a new schema.

Before rollout, take an operational backup of the entire user-data directory
while the app is fully closed, including replica sidecars, attachments and
configuration. Retain it securely outside the installation folder. The older
`db:backup` script runs in Node against its explicit/development storage context;
do not assume it backs up an installed user's Roaming replica. Do not restore a
single Turso snapshot over a running/synchronizing replica; coordinate any
disaster recovery with the database administrator and preserve all originals.

## Two installed builds: v1.0.0 -> v1.0.1

Use a disposable Windows account/VM and a separate test Turso database containing
representative test records. Do not use college production data for the test.

1. Build and install this v1.0.0 baseline configured for `onlysunziv/kumakh-releases`.
   Provision runtime.env for the test database. Record version, record counts,
   selected financial values, media hashes and the user-data path. Optionally run
   `npm run release:publish` yourself to publish the v1.0.0 baseline.
2. On the development PC set GH_TOKEN and run **`npm run release:patch` yourself**.
   Confirm GitHub v1.0.1 includes the matching installer, blockmap and latest.yml.
3. Keep the installed v1.0.0 running. Open Settings → Software Update → Check for
   Updates (or restart to use the delayed startup check). Confirm both versions
   and release notes. Download; watch progress. Test a connection interruption
   and retry. Test Install Later and ordinary exit: neither may install the update.
4. Reopen v1.0.0, check/download again (the verified installer can be reused from
   cache). With work open, an install request must tell you to sign out. Finish
   work, sign out, then confirm Restart & Install on the login screen.
5. After installation, confirm v1.0.1, the same user-data path, all recorded counts,
   values, accounts and attachments, and that ordinary sales/payments/reports still
   work. Keep the v1.0.0 installer and the closed-app backup for review. Do not
   downgrade schema versions to simulate an update.

This live GitHub/NSIS replacement test is deliberately not executed here: it
requires your real repository and your explicit publishing command.

## Validation and remaining deployment work

All **68 tests passed**, along with syntax checks across the Electron, frontend
JavaScript and scripts directories. The implementation is covered by the existing regression tests plus new tests
for updater lifecycle, concurrent requests, recovery, IPC provenance, preload
subscriptions, migration backups/rollback and SQLite/Turso preservation. The
hidden Electron test uses the real preload and renderer with temporary data and
a mocked update provider. It never publishes or installs a real update.

```powershell
npm test
.\node_modules\electron\dist\electron.exe scripts/update-ui-smoke.js
.\node_modules\electron\dist\electron.exe scripts/update-ui-smoke.js --packaged
```

The Windows NSIS build, local artifact verification, and real Electron UI smoke
test against the packaged app archive passed. Packaged runtime files were also
compared byte-for-byte with the final source. No credentials
were provisioned on production accounts. GitHub publishing, a real installed
upgrade, production Turso synchronization and actual network-failure recovery
across two installed builds still require the acceptance test above.

The current installer is **unsigned**. Configure Windows code signing before
production distribution (for certificate-based signing, builder supports
`CSC_LINK` and `CSC_KEY_PASSWORD` as development-machine environment variables).
Keep the signing identity consistent across updates. No certificate was supplied.
Also, npm audit reports two existing high-severity dependency entries: Electron
32.3.3 and its extract-zip dependency. The suggested fix crosses Electron major
versions and needs its own compatibility validation; it was not silently applied
as part of updater integration. The current renderer also retains its existing
missing-CSP warning. These are outstanding application release-hardening tasks,
so this work does not certify the entire existing application as production-safe.

References: [electron-builder v26 auto update](https://www.electron.build/v26/docs/features/auto-update/)
and [publishing configuration](https://www.electron.build/v26/docs/publish/).

## Files changed

- `package.json`, `package-lock.json`, `.gitignore`
- `electron/main.js`, `electron/preload.js`, `electron/updates.js`
- `electron/database.js`, `electron/sqlite-pool.js`, `electron/turso-pool.js`, `electron/schema-migrations.js`
- `frontend/index.html`, `frontend/login.html`, `frontend/pages/settings.html`
- `frontend/js/app.js`, `frontend/js/updates.js`
- `scripts/build-win.js`, `scripts/release.js`, `scripts/validate-release.js`, `scripts/verify-package.js`, `scripts/configure-installed.js`, `scripts/update-ui-smoke.js`
- `tests/updates.test.js`, `tests/update-migrations.test.js`
- `RELEASES.md`, `DATABASE_MIGRATION.md`

Added dependency: `electron-log` 5.4.4. Reused `electron-updater` 6.8.9 and the
existing electron-builder. No Google Sheets/Drive report submission code, existing
business workflow, appId, product name, icon or NSIS installation options was redesigned.
