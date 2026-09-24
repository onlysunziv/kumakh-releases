const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../code.gs'), 'utf8');
const start = source.indexOf('function authorizeRequest_(');
const end = source.indexOf('  /* Receives canonical', start);
function authorize(request, token, user) {
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => token }) },
    sessionUser_: () => user,
    permissionsForUser_: () => user?.permissions || [],
    apiPermissionForAction_: () => 'reports.view',
    jsonResponse: (success, message, data) => ({ success, message, data }),
  });
  vm.runInContext(source.slice(start, end), context);
  return context.authorizeRequest_(request, 'upsertreport');
}
test('Apps Script report authorization requires a permitted login session even with an API token', () => {
  assert.equal(authorize({ apiToken: 'secret' }, 'secret', null).data.error, 'REPORT_AUTH_REQUIRED');
  assert.equal(authorize({ sessionToken: 'valid' }, '', { permissions: ['reports.view'] }), null);
  assert.equal(authorize({ apiToken: 'wrong' }, 'secret', null).data.error, 'REPORT_AUTH_REQUIRED');
  assert.equal(authorize({}, '', null).success, false);
  assert.equal(authorize({ sessionToken: 'valid' }, '', { permissions: [] }).data.error, 'ACCESS_DENIED');
});
