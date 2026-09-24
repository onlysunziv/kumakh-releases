const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function client(bridge) {
  const window = { kumakhApp: bridge };
  const context = vm.createContext({ window, fetch: () => { throw new Error('Renderer must never contact Google Sheets'); } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../frontend/js/api.js'), 'utf8'), context);
  return context;
}

test('non-interactive loading indicator hides before idle callbacks after concurrent requests', () => {
  const classes = new Set(['database-loading-indicator', 'is-hidden']);
  const overlay = { tagName: 'DIV', classList: { add(value) { classes.add(value); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); } } };
  const context = client({});
  context.document = { getElementById: () => overlay };
  context.window.setTimeout = () => 1;
  context.window.clearTimeout = () => {};
  const loading = context.window.kumakhLoading;
  loading.begin();
  loading.begin();
  let idle = false;
  loading.whenIdle(() => { assert.equal(classes.has('is-hidden'), true); idle = true; });
  loading.end();
  assert.equal(classes.has('is-hidden'), false);
  assert.equal(idle, false);
  loading.end();
  assert.equal(idle, true);
  assert.equal(classes.has('is-hidden'), true);
});

test('every frontend API action routes through the local bridge without a network fallback', async () => {
  const calls = [];
  const context = client({ apiRequest: async (action, payload) => {
    calls.push({ action, payload });
    return { success: true, data: { id: 'local-id' } };
  } });
  context.beginDatabaseLoading = () => {};
  context.endDatabaseLoading = () => {};
  for (const [name, fn] of Object.entries(context.window.kumakhApi)) {
    if (name === 'getApiUrl' || name === 'setApiUrl') continue;
    await fn({ vendorName: 'Offline vendor' });
  }
  assert.ok(calls.length > 50);
  assert.ok(calls.some(call => call.action === 'savevendor'));
  assert.ok(calls.some(call => call.action === 'submitreport'));
  assert.ok(calls.some(call => call.action === 'authenticateuser'));
});

test('missing local bridge fails instead of silently writing to Sheets', async () => {
  const context = client(undefined);
  await assert.rejects(context.window.kumakhApi.saveVendor({ vendorName: 'Vendor' }), /application database is unavailable/);
});

test('report failures retain their status and local errors reach the caller', async () => {
  const context = client({ apiRequest: async (action) => {
    if (action === 'submitreport') return { success: false, submissionId: 'pending', message: 'Offline' };
    throw new Error('SQLite write failed');
  } });
  context.beginDatabaseLoading = () => {};
  context.endDatabaseLoading = () => {};
  assert.equal((await context.window.kumakhApi.submitReport({})).success, false);
  await assert.rejects(context.window.kumakhApi.saveVendor({}), /SQLite write failed/);
});
