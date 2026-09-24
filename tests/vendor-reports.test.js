const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const file of ['code.gs', 'code.js']) {
  test(`${file}: vendor reports clean legacy duplicates and remain idempotent without an ID column`, () => {
    const headers = ['PAN/VAT No.', 'Name', 'Address', 'Contact No', 'Email', 'Status', 'Created At', 'Updated At'];
    const a = ['98456378', 'SAINO MART', 'DANG NEPAL', '98456738265', 'sainomart@example.com', 'Active', '2026-09-13', '2026-09-13'];
    const b = ['6847484', 'Bhandari Fresh House', 'Dang, Nepal', '9823546712', 'bhandari@example.com', 'Active', '2026-09-13', '2026-09-13'];
    let grid = [headers.slice(), ...Array.from({ length: 6 }, () => [a.slice(), b.slice()]).flat()];
    let backups = 0, locked = false;
    const sheet = {
      getLastRow: () => grid.length,
      getLastColumn: () => grid[0].length,
      getRange: (r, c, n, m) => ({
        getValues: () => Array.from({length:n}, (_,i) => Array.from({length:m}, (_,j) => grid[r-1+i]?.[c-1+j] ?? '')),
        setValues: values => { assert.equal(locked, true); values.forEach((row,i) => { grid[r-1+i] ||= []; row.forEach((value,j) => { grid[r-1+i][c-1+j]=value; }); }); },
      }),
      deleteRow: r => { assert.equal(locked, true); grid.splice(r - 1, 1); },
      copyTo: () => { backups++; return { setName: () => {} }; },
    };
    const context = vm.createContext({
      LockService: { getScriptLock: () => ({ waitLock: () => { assert.equal(locked, false); locked = true; }, releaseLock: () => { locked = false; } }) },
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }), flush: () => {} },
      Utilities: { getUuid: () => 'test-id' },
      formatSheet_: () => {}, formatReportSheet_: () => {}, writeAuditLog_: () => {},
      jsonResponse: (success, message, data) => ({ success, message, data }),
    });
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source.slice(source.indexOf('  function vendorReportIdentity_'), source.indexOf('  function writeAuditLog_')), context);
    const cleanup = context.removeDuplicateVendors();
    assert.equal(cleanup.success, true);
    assert.equal(cleanup.data.duplicatesRemoved, 10);
    assert.equal(backups, 1);
    assert.equal(grid.length, 3);
    const rows = [a, b].map((row, i) => ({ id: `local-${i}`, pan_vat_no: row[0], name: row[1], address: row[2], contact_no: row[3], email: row[4], status: row[5] }));
    for (let i = 0; i < 3; i++) {
      assert.equal(context.upsertReport_({ reportKey: 'vendors', rows }).success, true);
      assert.equal(grid.length, 3);
    }
    rows[0].address = 'Updated address';
    context.upsertReport_({ reportKey: 'vendors', rows });
    assert.equal(grid[1][2], 'Updated address');
    assert.equal(grid.length, 3);
    assert.equal(context.upsertReport_({ reportKey: 'vendors', rows: [{ name: 'Unidentified' }] }).success, false);
    assert.equal(grid.length, 3);
    assert.equal(locked, false);
    const identity = context.vendorReportIdentity_;
    assert.notEqual(identity(headers, a), identity(headers, b));
    assert.equal(identity(headers, a), identity(headers, a.map((value, i) => i === 1 ? '  saino   mart ' : value)));
  });
}
