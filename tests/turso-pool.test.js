const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { normalizeSyncUrl, replicaExists, syncErrorMessage } = require("../electron/turso-pool");

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
