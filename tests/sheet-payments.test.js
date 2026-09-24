const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

for (const file of ['code.gs', 'code.js']) {
  test(`${file}: payment and cafe exports retain distinct IDs and retry without duplicates`, () => {
    const sheets = new Map();
    const spreadsheet = {
      getSheetByName: name => sheets.get(name),
      insertSheet(name) {
        const grid = [];
        const sheet = {
          grid, getLastRow: () => grid.length, getLastColumn: () => grid[0]?.length || 0,
          getRange: (r, c, n, m) => ({
            getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => grid[r-1+i]?.[c-1+j] ?? '')),
            setValues(values) { values.forEach((row, i) => { grid[r-1+i] ||= []; row.forEach((v,j) => { grid[r-1+i][c-1+j] = v; }); }); },
          }),
        };
        sheets.set(name, sheet); return sheet;
      },
    };
    const context = vm.createContext({
      SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
      LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
      Utilities: { getUuid: () => 'test' }, formatSheet_() {}, formatReportSheet_() {}, writeAuditLog_() {},
      jsonResponse: (success, message, data) => ({ success, message, data }),
    });
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInContext(source.slice(source.indexOf('function getDatabaseStructure()'), source.indexOf('function initializeDatabase()')), context);
    vm.runInContext(source.slice(source.indexOf('  function vendorReportIdentity_'), source.indexOf('  function writeAuditLog_')), context);
    for (const [reportKey, sheetName, amountHeader, extra] of [
      ['customer-payments','CustomerPayments','Amount',{ amount: 30, payment_date: '2026-09-17' }],
      ['due-received','DueReceived','Received Amount',{ received_amount: 30, receipt_date: '2026-09-17' }],
      ['cafe-sales','CafeSales','Total Bill',{ total_bill: 30, sale_date: '2026-09-17' }],
      ['credit-sales','CreditSales','Due Amount',{ due_amount: 30, sale_date: '2026-09-17' }],
    ]) {
      const rows = ['one','two'].map(id => ({ id, customer_id: 'same-customer', customer_name: 'Customer', ...extra }));
      for (let retry=0; retry<2; retry++) assert.equal(context.upsertReport_({reportKey, rows}).success, true);
      const grid = sheets.get(sheetName).grid;
      assert.equal(grid.length, 3, sheetName);
      assert.equal(grid[1][grid[0].indexOf('Record ID')], 'one');
      assert.equal(grid[2][grid[0].indexOf('Record ID')], 'two');
      assert.equal(grid[1][grid[0].indexOf(amountHeader)], 30);
      assert.equal(grid[1][grid[0].indexOf('Customer ID')], 'same-customer');
    }
  });
}
