const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { Database } = require('../electron/database');

test('cafe tender rules cover walk-in and registered customers', () => {
  const html = fs.readFileSync(path.join(__dirname, '../frontend/pages/cafe.html'), 'utf8');
  const context = vm.createContext({ normalize: value => String(value).toLowerCase(), moneyExact: String });
  vm.runInContext(html.slice(html.indexOf('function calculatePayment('), html.indexOf('function refreshPaymentPrintForm(')), context);
  for (const customer of [null, { id: 'customer' }]) {
    for (const paymentMethod of ['Cash', 'QR', 'Credit']) {
      for (const tender of ['', '0', '50', '100', '150', '-1', 'bad']) {
        const p = context.calculatePayment({ total: 100, customer, paymentMethod }, tender);
        const numeric = Number(tender);
        const expected = Number.isFinite(numeric) && numeric >= 0 &&
          (paymentMethod === 'Credit' ? !!customer : (customer || numeric >= 100) && (paymentMethod !== 'QR' || numeric <= 100));
        assert.equal(p.valid, Boolean(expected), `${!!customer}/${paymentMethod}/${tender}`);
        if (p.valid) assert.equal(p.paidAmount + p.creditAmount, 100);
      }
    }
  }
  assert.equal(context.calculatePayment({ total: 10.125, paymentMethod: 'Cash' }, '10.13').billTotal, 10.13);
});

test('POS camelCase sales create credit ledger, history and accurate repeatable closing', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-regression-'));
  const db = new Database(path.join(directory, 'test.db'));
  try {
    await db.open();
    const request = async (action, payload) => (await db.request(action, payload)).data;
    await request('saveCafeCustomer', { id: 'customer', customerName: 'Test customer', creditLimit: 1000 });
    for (const [id, paymentMethod, paidAmount, dueAmount, customerId] of [
      ['walkin', 'Cash', 100, 0, ''], ['qr', 'QR', 100, 0, ''],
      ['partial', 'Cash', 40, 60, 'customer'], ['credit', 'Credit', 0, 100, 'customer'],
    ]) {
      await request('saveCafeSale', { id, tableNo: 'C1', customerId, customerName: customerId ? 'Test customer' : '',
        totalBill: 100, paidAmount, dueAmount, tenderedAmount: paidAmount, changeAmount: 0, discountAmount: 0, vatAmount: 0,
        paymentMethod, itemsOrdered: 'Tea x1' });
    }
    assert.equal((await request('getCreditSales')).length, 2);
    assert.equal(Number((await request('getCustomerLedger'))[0].totalDue), 160);
    const receipt = await request('saveDueReceived', {
      customerId: 'customer', receiptDate: '2026-09-17', receivedAmount: 25, paymentMode: 'Cash', remarks: 'Test receipt',
    });
    assert.ok(receipt.receiptId);
    const payments = await request('getCustomerPayments');
    const receipts = await request('getDueReceived');
    assert.equal(payments[0].id, receipts[0].id);
    assert.equal(Number(payments[0].amount), 25);
    assert.equal(Number((await request('getCustomerLedger'))[0].totalDue), 135);
    for (const reportKey of ['customer-payments', 'due-received']) {
      const preview = await request('getReportPreview', { reportKey });
      assert.equal(preview.rows.length, 1);
      assert.equal(preview.rows[0].id, receipt.receiptId);
    }
    const history = await request('getCafeSales');
    assert.equal(history.length, 4);
    assert.ok(history.every(row => row['Sale Date'] && row['Table No'] === 'C1' && Number(row['Total Bill']) === 100));
    const summary = await request('getCafeTodaySummary');
    assert.deepEqual([summary.total, summary.cash, summary.qr, summary.credit, summary.transactionCount], [400, 140, 100, 160, 4]);
    const closingPreview = await request('getReportPreview', { reportKey: 'cafe-daily-sales', dateFrom: summary.date, dateTo: summary.date });
    assert.equal(closingPreview.rows.length, 1);
    assert.deepEqual([closingPreview.rows[0].total_sales, closingPreview.rows[0].cash_sales, closingPreview.rows[0].qr_sales, closingPreview.rows[0].credit_sales], [400, 140, 100, 160]);
    await request('saveReportConfig', { endpoint: 'https://script.google.com/macros/s/test/exec', apiToken: 'legacy-token' });
    const unauthenticated = await db.request('submitReport', { reportKey: 'cafe-daily-sales' });
    assert.equal(unauthenticated.success, false);
    assert.equal(unauthenticated.code, 'REPORT_AUTH_REQUIRED');
    await request('submitCafeDailyClosingReport', { date: summary.date });
    await request('submitCafeDailyClosingReport', { date: summary.date });
    const [closings] = await db.pool.query('SELECT * FROM DayClosings');
    assert.equal(closings.length, 1);
    assert.equal(closings[0].closing_date, summary.date);
    assert.equal(JSON.parse(closings[0].data_json).credit, 160);
    await assert.rejects(request('submitCafeDailyClosingReport', { date: '2000-01-01' }), /Reload/);
  } finally {
    await db.pool.end();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
