const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { createUpdateService, safeLogger } = require('../electron/updates');
const { preflight } = require('../scripts/release');

function fixture(t, enabled = true, currentVersion = '1.0.0') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-updates-'));
  const updater = new EventEmitter();
  updater.setFeedURL = feed => { updater.feedURL = feed; };
  const handlers = new Map();
  const events = [];
  const sender = { isDestroyed: () => false, send: (_, state) => events.push(state), mainFrame: { url: pathToFileURL(path.resolve(__dirname, '../frontend/index.html')).href } };
  const event = { sender, senderFrame: sender.mainFrame };
  const control = { safe: false, confirm: false, preparations: 0, installs: 0 };
  updater.quitAndInstall = () => { control.installs++; assert.equal(control.preparations, 1); };
  const service = createUpdateService({
    app: { isPackaged: enabled, getPath: () => directory, getVersion: () => currentVersion },
    platform: 'win32', updater, logger: Object.fromEntries(['info', 'debug', 'warn', 'error'].map(key => [key, () => {}])),
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    getWindows: () => [{ isDestroyed: () => false, webContents: sender }],
    canInstall: () => control.safe, confirmInstall: async () => control.confirm,
    prepareInstall: async () => { control.preparations++; },
  });
  t.after(() => { service.dispose(); fs.rmSync(directory, { force: true, recursive: true }); });
  return { directory, updater, service, handlers, event, events, control };
}

test('manual update lifecycle coalesces checks/downloads, sends progress, never installs on exit', async t => {
  const { updater, service, events, control, event } = fixture(t);
  assert.equal(updater.autoDownload, false);
  assert.deepEqual(updater.feedURL, { provider: 'github', owner: 'onlysunziv', repo: 'kumakh-releases', releaseType: 'release' });
  assert.equal(updater.autoInstallOnAppQuit, false);
  let completeCheck, checks = 0;
  updater.checkForUpdates = async () => { checks++; await new Promise(resolve => { completeCheck = resolve; }); updater.emit('update-available', { version: '1.0.1', releaseNotes: '<script>untrusted</script>' }); };
  const checking = service.check();
  await service.check(); await service.download();
  assert.equal(checks, 1); completeCheck(); await checking;
  assert.equal(service.snapshot().latestVersion, '1.0.1');
  let completeDownload, downloads = 0;
  updater.downloadUpdate = async () => { downloads++; await new Promise(resolve => { completeDownload = resolve; }); updater.emit('update-downloaded', { version: '1.0.1' }); };
  const downloading = service.download();
  await service.download(); await service.check();
  updater.emit('download-progress', { percent: 72, transferred: 31e6, total: 43e6 });
  assert.equal(events.at(-1).progress.percent, 72);
  assert.equal(downloads, 1); assert.equal(checks, 1);
  completeDownload(); await downloading;
  assert.equal(service.snapshot().status, 'ready');
  assert.match((await service.install(event)).notice, /sign out/);
  assert.equal(control.installs, 0);
  control.safe = true;
  await service.install(event); // Install Later in native confirmation.
  assert.equal(control.installs, 0);
  control.confirm = true;
  await service.install(event); await service.install(event);
  assert.equal(control.installs, 1);
});

test('offline, metadata and checksum failures are recoverable and never expose raw errors', async t => {
  const { updater, service } = fixture(t);
  updater.checkForUpdates = async () => { throw new Error('secret-response-body'); };
  await service.check();
  assert.equal(service.snapshot().status, 'error');
  assert.ok(!service.snapshot().error.includes('secret-response-body'));
  updater.checkForUpdates = async () => updater.emit('update-available', { version: '1.0.1' });
  await service.check();
  updater.downloadUpdate = async () => { updater.emit('error', new Error('sha512 checksum mismatch')); throw new Error('interrupted'); };
  await service.download();
  assert.equal(service.snapshot().status, 'error');
  await service.check();
  updater.downloadUpdate = async () => updater.emit('update-downloaded', { version: '1.0.1' });
  await service.download();
  assert.equal(service.snapshot().status, 'ready');
});

test('reports up-to-date versions and classifies updater errors with technical details', async t => {
  const { updater, service } = fixture(t, true, '1.0.2');
  updater.checkForUpdates = async () => updater.emit('update-not-available', { version: '1.0.2' });
  await service.check();
  assert.deepEqual({
    status: service.snapshot().status,
    currentVersion: service.snapshot().currentVersion,
    latestVersion: service.snapshot().latestVersion,
  }, { status: 'current', currentVersion: '1.0.2', latestVersion: '1.0.2' });

  const newer = fixture(t, true, '1.0.2');
  newer.updater.checkForUpdates = async () => newer.updater.emit('update-available', { version: '1.0.3', releaseNotes: 'Bug fixes' });
  await newer.service.check();
  assert.equal(newer.service.snapshot().status, 'available');
  assert.equal(newer.service.snapshot().currentVersion, '1.0.2');
  assert.equal(newer.service.snapshot().latestVersion, '1.0.3');
  assert.equal(newer.service.snapshot().releaseNotes, 'Bug fixes');

  const cases = [
    [{ message: 'GET https://server/latest.yml 404 not found', statusCode: 404 }, 'Update metadata (latest.yml) was not found on the release server.'],
    [{ message: 'GET /releases/download/1.0.1/KCMT.exe 404', statusCode: 404 }, 'The update release or required update file was not found.'],
    [{ message: 'forbidden', statusCode: 403 }, 'Access to the update server was denied.'],
    [{ code: 'ERR_NETWORK_IO_SUSPENDED', message: 'ERR_NETWORK_IO_SUSPENDED' }, 'The network request was suspended by the operating system. Reconnect and try again.'],
    [{ code: 'ETIMEDOUT', message: 'request timed out' }, 'The update server did not respond in time.'],
    [{ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' }, 'No internet connection.'],
    [{ message: 'sha512 checksum mismatch' }, 'The downloaded update file failed integrity verification.'],
  ];
  for (const [error, expected] of cases) {
    updater.checkForUpdates = async () => { throw Object.assign(new Error(error.message), error); };
    await service.check();
    assert.equal(service.snapshot().error, expected);
    assert.ok(service.snapshot().technicalError);
  }
});

test('restores the last checked version and status after restart', async t => {
  const first = fixture(t, true, '1.0.2');
  first.updater.checkForUpdates = async () => first.updater.emit('update-not-available', { version: '1.0.2' });
  await first.service.check();
  const restored = createUpdateService({
    app: { isPackaged: true, getPath: () => first.directory, getVersion: () => '1.0.2' },
    platform: 'win32',
    updater: new EventEmitter(),
    logger: Object.fromEntries(['info', 'debug', 'warn', 'error'].map(key => [key, () => {}])),
    ipcMain: { handle() {} },
    getWindows: () => [],
    canInstall: () => false,
    confirmInstall: async () => false,
    prepareInstall: async () => {},
  });
  t.after(() => restored.dispose());
  assert.equal(restored.snapshot().latestVersion, '1.0.2');
  assert.equal(restored.snapshot().status, 'current');
});

test('development mode avoids updater calls and IPC rejects foreign windows and subframes', async t => {
  const { updater, service, handlers, event } = fixture(t, false);
  updater.checkForUpdates = () => { throw new Error('Development must never check'); };
  service.schedule(); await service.check(); await service.download(); await service.install(event);
  assert.equal(service.snapshot().status, 'disabled');
  const read = handlers.get('kumakh:update-state');
  assert.equal(read(event).currentVersion, '1.0.0');
  assert.throws(() => read({ ...event, sender: {} }), /denied/);
  assert.throws(() => read({ ...event, senderFrame: { url: event.senderFrame.url } }), /denied/);
  event.senderFrame.url = 'https://example.com';
  assert.throws(() => read(event), /denied/);
});

test('preload exposes only specific update methods and removable subscriptions', async () => {
  let api; const ipc = new EventEmitter(); const calls = [];
  ipc.invoke = async (channel, ...args) => { calls.push([channel, ...args]); return { currentVersion: '2.3.4' }; };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../electron/preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld: (_, value) => { api = value; } }, ipcRenderer: ipc }),
    process: { platform: 'win32', env: {} }, window: { addEventListener: () => {} },
  });
  assert.equal(await api.getVersion(), '2.3.4');
  assert.equal(api.ipcRenderer, undefined); assert.equal(api.invoke, undefined);
  let received; const unsubscribe = api.onUpdateState(value => { received = value; });
  ipc.emit('kumakh:update-state', { sender: 'must not escape' }, { status: 'ready' });
  assert.deepEqual(received, { status: 'ready' });
  unsubscribe(); assert.equal(ipc.listenerCount('kumakh:update-state'), 0);
  await api.checkForUpdates(); await api.downloadUpdate(); await api.installUpdate();
  assert.deepEqual(calls.map(call => call[0]), ['kumakh:update-state', 'kumakh:update-check', 'kumakh:update-download', 'kumakh:update-install']);
});

test('release preflight requires public configuration, credentials and synchronized versions before bump', () => {
  const pkg = { version: '1.0.0', build: { publish: { provider: 'github', owner: 'college', repo: 'kumakh-releases', releaseType: 'release' } } };
  const lock = { version: '1.0.0', packages: { '': { version: '1.0.0' } } };
  assert.equal(preflight(pkg, lock, { GH_TOKEN: 'environment-only' }, 'win32'), true);
  assert.throws(() => preflight(pkg, lock, {}, 'win32'), /GH_TOKEN/);
  assert.throws(() => preflight(pkg, { ...lock, version: '2.0.0' }, { GH_TOKEN: 'present' }, 'win32'), /same stable version/);
  pkg.build.publish.owner = 'YOUR_GITHUB_USERNAME';
  assert.throws(() => preflight(pkg, lock, { GH_TOKEN: 'present' }, 'win32'), /Set build.publish.owner/);
});

test('updater logger redacts signed URLs and authorization values', () => {
  let result;
  safeLogger({ error: value => { result = value; } }).error('url https://host/asset?secret=abc token=private authorization=hidden');
  assert.ok(!result.includes('abc')); assert.ok(!result.includes('private')); assert.ok(!result.includes('hidden'));
});
