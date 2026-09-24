const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Database } = require('../electron/database');

test('report sign-in retries timeouts once without sending report data', async () => {
  const original = global.fetch;
  const database = { reportConfig: async () => ({ endpoint: 'https://script.google.com/macros/s/test/exec' }), pool: { query: async () => [[]] } };
  try {
    for (const recover of [true, false]) {
      let calls = 0;
      global.fetch = async (_, options) => {
        assert.equal(JSON.parse(options.body).action, 'authenticateUser');
        calls++;
        if (!recover || calls === 1) throw Object.assign(new Error('aborted due to timeout'), { name: 'TimeoutError' });
        return { ok: true, json: async () => ({ success: true, data: { sessionToken: 'test-session', permissions: ['reports.view'] } }) };
      };
      const run = Database.prototype.authenticateReports.call(database, { username: 'test', password: 'test' });
      if (recover) assert.equal((await run).sessionToken, 'test-session');
      else await assert.rejects(run, error => error.code === 'REPORT_AUTH_TIMEOUT' && error.retryable);
      assert.equal(calls, 2);
    }
    let calls = 0;
    global.fetch = async () => { calls++; return { ok: true, json: async () => ({ success: false, message: 'Invalid username or password.' }) }; };
    await assert.rejects(Database.prototype.authenticateReports.call(database, { username: 'test', password: 'wrong' }), { code: 'REPORT_AUTH_INVALID' });
    assert.equal(calls, 1);
    global.fetch = async () => ({ ok: true, json: async () => ({ success: false, message: 'ACCESS_DENIED', data: { error: 'ACCESS_DENIED', message: 'Your session is invalid or expired.' } }) });
    await assert.rejects(Database.prototype.authenticateReports.call(database, { username: 'test', password: 'test' }), { code: 'REPORT_LOGIN_SESSION_REJECTED' });
  } finally { global.fetch = original; }
});

test('Submit opens designed animation before sign-in and blocks duplicate clicks', async () => {
  const page = fs.readFileSync(require.resolve('../frontend/pages/reports.html'), 'utf8');
  const source = page.slice(page.indexOf('    submit.onclick ='), page.lastIndexOf('  };'));
  const events = [];
  let resolveLogin;
  const context = vm.createContext({
    submit: { disabled: false }, submitting:false, current: [{ report: { name: 'Students' } }], endpointConfigured: true,
    window: { sessionStorage: { getItem: () => '{}' } },
    showSubmissionPopup: () => events.push('animation'),
    readyToSubmit: () => { events.push('login'); return new Promise(resolve => { resolveLogin = resolve; }); },
    submissionAnimation: { stopBeforeSubmission: () => events.push('failure') },
    reportAuthenticationError: 'Connection timed out',
  });
  context.setSubmissionBusy = busy => { context.submitting=busy; context.submit.disabled=busy; };
  vm.runInContext(source, context);
  const first = context.submit.onclick();
  await context.submit.onclick();
  assert.deepEqual(events, ['animation', 'login']);
  resolveLogin(false);
  await first;
  assert.equal(context.submit.disabled, false);
  assert.equal(context.current.length, 1);
  assert.deepEqual(events, ['animation', 'login', 'failure']);
});
