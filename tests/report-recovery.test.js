const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { materialize, digest } = require('../electron/person-files');
const page = fs.readFileSync(path.join(__dirname, '../frontend/pages/reports.html'), 'utf8');

test('report submission renews rejected sessions once and preserves submission identity', async () => {
  const source = page.slice(page.indexOf('    const submitWithSession ='), page.indexOf('    const today ='));
  for (const code of ['REPORT_AUTH_REQUIRED', 'ACCESS_DENIED', 'NETWORK_ERROR']) {
    let renewals = 0;
    const calls = [];
    const context = vm.createContext({
      window: { kumakhApi: { submitReport: async payload => {
        calls.push(payload);
        return { success: false, code, message: 'Your session is invalid or expired.', submissionId: 'same-id' };
      } } },
      reportSessionToken: () => renewals ? 'fresh' : 'stale',
      readyToSubmit: async refresh => { assert.equal(refresh, true); renewals++; return true; },
    });
    vm.runInContext(source + '\nglobalThis.run = submitWithSession;', context);
    await context.run('submitReport', { reportKey: 'students' });
    assert.equal(calls.length, code === 'NETWORK_ERROR' ? 1 : 2);
    if (calls.length === 2) {
      assert.equal(renewals, 1);
      assert.equal(calls[1].sessionToken, 'fresh');
      assert.equal(calls[1].submissionId, 'same-id');
    }
  }
});

test('moved media is recovered only when the current copy matches the saved hash', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-media-recovery-'));
  try {
    const bytes = Buffer.from('photo');
    const row = { id: 'media', entity_table: 'Students', entity_id: 'student', media_type: 'photo', file_name: 'photo.png', file_hash: digest(bytes), local_path: path.join(directory, 'old-install', 'photo.png') };
    const candidate = path.join(directory, 'files', 'students', 'REG-1', 'photo', `${row.file_hash}-photo.png`);
    fs.mkdirSync(path.dirname(candidate), { recursive: true });
    fs.writeFileSync(candidate, bytes);
    const updates = [];
    const db = { pool: { file: path.join(directory, 'database', 'kumakh.db'), query: async (sql, args) => {
      if (sql.startsWith('UPDATE')) { updates.push(args); return []; }
      return sql.includes('StudentMediaChunks') ? [[]] : [[{ registration_number: 'REG-1' }]];
    } } };
    assert.equal((await materialize(db, row)).local_path, candidate);
    assert.equal(updates.length, 1);
    fs.writeFileSync(candidate, 'wrong content');
    assert.equal((await materialize(db, row)).local_path, row.local_path);
    assert.equal(updates.length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('report page inline JavaScript parses', () => {
  new vm.Script(page.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
