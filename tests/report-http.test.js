const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Database } = require('../electron/database');
const {
  httpResponseError,
  readJsonResponse,
  safeEndpoint,
} = require('../electron/report-http');
const { withTimeout } = require('../electron/person-files');

test('a stalled Drive request is aborted and rejected within its deadline', async () => {
  let signal;
  await assert.rejects(
    withTimeout(requestSignal => {
      signal = requestSignal;
      return new Promise(() => {});
    }, 15),
    error => error.code === 'REPORT_DRIVE_TIMEOUT' && /timed out after 1 seconds/.test(error.message),
  );
  assert.equal(signal.aborted, true);
});

test('report endpoint errors preserve HTTP status and safe requested/response URLs', async () => {
  const endpoint = 'https://script.google.com/macros/s/deployment-secret/exec?token=must-not-appear';
  const response = {
    status: 404,
    ok: false,
    url: 'https://script.googleusercontent.com/macros/echo?user_content_key=private-key',
    headers: { get: name => name === 'content-type' ? 'text/html; charset=utf-8' : null },
    text: async () => "<!doctype html><script>window['ppConfig']={}</script><title>Not found</title>",
  };
  await assert.rejects(
    readJsonResponse(response, endpoint, 'submission'),
    error => {
      assert.equal(error.code, 'REPORT_HTTP_404');
      assert.equal(error.status, 404);
      assert.equal(error.endpoint, 'https://script.google.com/macros/s/deployment-secret/exec');
      assert.match(error.message, /HTTP 404/);
      assert.match(error.message, /window\['ppConfig'\]/);
      assert.match(error.message, /Requested endpoint: https:\/\/script\.google\.com\/macros\/s\/deployment-secret\/exec/);
      assert.match(error.message, /Response endpoint: https:\/\/script\.googleusercontent\.com\/macros\/echo/);
      assert.doesNotMatch(error.message, /must-not-appear|private-key/);
      return true;
    },
  );
});

test('JSON HTTP errors retain the real status and configured endpoint', () => {
  const error = httpResponseError({
    status: 401,
    url: 'https://script.google.com/macros/s/deployment/exec',
  }, 'https://script.google.com/macros/s/deployment/exec', { message: 'Unauthorized' }, 'sign-in');
  assert.equal(error.code, 'REPORT_HTTP_401');
  assert.equal(error.status, 401);
  assert.match(error.message, /Unauthorized/);
  assert.equal(
    safeEndpoint('https://script.google.com/macros/s/deployment/exec?token=private#section'),
    'https://script.google.com/macros/s/deployment/exec',
  );
});

test('failed report submission records 404 endpoint diagnostics and never reports success', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-report-http-'));
  const db = new Database(path.join(directory, 'database', 'kumakh.db'), { seed: false, initializePermissions: false });
  const originalFetch = global.fetch;
  const endpoint = 'https://script.google.com/macros/s/deployment-secret/exec';
  try {
    await db.open();
    await db.saveReportConfig({ endpoint });
    global.fetch = async () => ({
      status: 404,
      ok: false,
      url: 'https://script.googleusercontent.com/macros/echo?user_content_key=private-key',
      headers: { get: name => name === 'content-type' ? 'text/html; charset=utf-8' : null },
      text: async () => "<!doctype html><script>window['ppConfig']={}</script>",
    });
    const result = await db.submitReport({
      reportKey: 'courses',
      dateFrom: '2026-09-27',
      dateTo: '2026-09-27',
      rows: [{ id: 'course-1', course_name: 'Testing' }],
      sessionToken: 'test-session',
    });
    assert.equal(result.success, false);
    assert.equal(result.code, 'REPORT_HTTP_404');
    assert.match(result.message, /HTTP 404/);
    assert.match(result.message, /deployment-secret/);
    assert.match(result.message, /window\['ppConfig'\]/);
    assert.doesNotMatch(result.message, /private-key/);
    const submissions = await db.reportSubmissions({ limit: 1 });
    assert.equal(submissions[0].status, 'Failed');
    assert.equal(submissions[0].error_message, result.message);
  } finally {
    global.fetch = originalFetch;
    await db.pool.end();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
