const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { normalizeSyncUrl, replicaExists, isReplicaDeserializationError, syncErrorMessage } = require("../electron/turso-pool");
const { TursoPool } = require('../electron/turso-pool');
const { AsyncLocalStorage } = require('node:async_hooks');

function fixture(client) {
  return Object.assign(Object.create(TursoPool.prototype), {
    client, context: new AsyncLocalStorage(), tail: Promise.resolve(),
    syncTail: Promise.resolve(), ready: Promise.resolve(), syncUrl: 'https://test.turso.io',
    status: {state:'offline',pending:true,lastError:'NETWORK',lastSyncAt:null},
  });
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve=r; }); return {promise,resolve}; };

test('cloud sync waits for the transaction commit and never uses its temporary handle', async () => {
  const started = deferred(), release = deferred(), events = [];
  const pool = fixture({
    transactionAsync: work => async () => { events.push('begin'); await work({}); events.push('commit'); },
    push: async () => { events.push('push'); }, pull: async () => { events.push('pull'); },
  });
  const transaction = pool.transaction(async () => { started.resolve(); await release.promise; events.push('write'); });
  await started.promise;
  const sync = pool.sync();
  await new Promise(setImmediate);
  assert.deepEqual(events,['begin']);
  release.resolve();
  await Promise.all([transaction,sync]);
  assert.deepEqual(events,['begin','write','commit','pull','push','pull']);
});

test('offline writes retry, clear stale errors, and reach a second installation', async () => {
  let online = false, cloud = [], local = ['offline record'], remote = [];
  const writer = fixture({push: async () => { if (!online) throw Error('offline'); cloud=local.slice(); },pull:async()=>{local=[...new Set([...cloud,...local])];}});
  const reader = fixture({push:async()=>{},pull:async()=>{remote=cloud.slice();}});
  await assert.rejects(writer.sync(),/offline/);
  assert.equal(writer.syncStatus().pending,true);
  online = true;
  await writer.push();
  assert.equal(writer.syncStatus().state,'synced');
  assert.equal(writer.syncStatus().lastError,null);
  await reader.sync();
  assert.deepEqual(remote,['offline record']);
});

test('slow cloud operations coalesce repeated sync requests instead of building a backlog', async () => {
  const release = deferred(); let pushes=0,pulls=0;
  const pool=fixture({push:async()=>{pushes++;await release.promise;},pull:async()=>{pulls++;}});
  const requests=Array.from({length:30},()=>pool.sync());
  await new Promise(setImmediate);
  release.resolve();
  await Promise.all(requests);
  assert.equal(pushes,1);assert.equal(pulls,2);
});

test('durable unsent operations restore pending status after restart or pull', async () => {
  const pool=fixture({pull:async()=>{},stats:async()=>({cdcOperations:3})});
  pool.status.pending=false;
  await pool.pull();
  assert.equal(pool.syncStatus().pending,true);
});

test('recovery includes the native change log and sync metadata', () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-sidecars-'));
  try {
    const file=path.join(directory,'replica.db');
    const files=['','-wal','-shm','-info','-changes','-wal-revert'].map(suffix=>file+suffix);
    files.forEach(file=>fs.writeFileSync(file,'preserve'));
    const pool=fixture({});pool.file=file;
    assert.deepEqual(pool.replicaFiles().sort(),files.sort());
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test("normalizes supported Turso URLs without changing their database host", () => {
  assert.equal(normalizeSyncUrl("libsql://example.turso.io/"), "libsql://example.turso.io");
  assert.equal(normalizeSyncUrl("https://example.turso.io"), "https://example.turso.io");
  assert.throws(() => normalizeSyncUrl("not-a-url"), /TURSO_DATABASE_URL/);
});

test("detects a real local replica by file contents, not a sync marker", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kumakh-turso-"));
  const file = path.join(directory, "database", "kumakh.db");
  fs.mkdirSync(path.dirname(file));
  assert.equal(replicaExists(file), false);
  fs.writeFileSync(file, Buffer.from("replica"));
  assert.equal(replicaExists(file), true);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("keeps the real sync error and code in startup diagnostics", () => {
  assert.equal(syncErrorMessage(Object.assign(new Error("expected value at line 1 column 1"), { code: "TURSO_SYNC_FAILED" })), "expected value at line 1 column 1 [TURSO_SYNC_FAILED]");
});

test("matches only the known local replica deserialization failure", () => {
  assert.equal(isReplicaDeserializationError(new Error("sync engine operation failed: deserialization error: expected value at line 1 column 1")), true);
  assert.equal(isReplicaDeserializationError(new Error("fetch failed: network unavailable")), false);
  assert.equal(isReplicaDeserializationError(new Error("SQLITE_CORRUPT: database disk image is malformed")), false);
});

test('successful round trip clears acknowledged CDC history from pending UI state', async () => {
  const pool = fixture({ pull: async () => false, push: async () => {}, stats: async () => ({cdcOperations: 2}) });
  await pool.sync();
  assert.equal(pool.syncStatus().pending, false);
  await pool.push();
  assert.equal(pool.syncStatus().pending, false);
});
