const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Database } = require('../electron/database');
const { SQLitePool, databasePath, decimal } = require('../electron/sqlite-pool');
const schema = require('../database/columns.json');

test('SQLite local API regression, persistence and backup', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-sqlite-'));
  const file = path.join(directory, 'kumakh.db');
  let database = new Database(file);
  const originalFetch = global.fetch;
  const reportEndpoint = process.env.REPORTS_APPS_SCRIPT_URL;
  process.env.REPORTS_APPS_SCRIPT_URL = '';
  global.fetch = async () => { throw new Error('Offline'); };
  try {
    await database.open();
    const query = async (sql, values = []) => (await database.pool.query(sql, values))[0];
    const request = async (action, payload) => ((result) => /^(submitReport|retryReport)$/.test(action) ? result : result.data)(await database.request(action, /^(submitReport|retryReport)$/.test(action) ? { sessionToken: 'remote-session', ...payload } : payload));
    assert.equal((await query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'"))[0].n, 43);
    assert.equal((await query('PRAGMA foreign_keys'))[0].foreign_keys, 1);
    assert.equal((await query('PRAGMA user_version'))[0].user_version, 2);
    assert.equal((await query('PRAGMA journal_mode'))[0].journal_mode, 'delete');
    for (const [table, expected] of Object.entries(schema)) {
      assert.deepEqual((await database.tableColumns(table)).sort(), Object.keys(expected).sort());
    }
    const course = { id: 'course', courseName: 'Course', duration: '3 months', total_fee: '123.455' };
    await request('saveCourse', course);
    assert.equal((await request('getCourses'))[0].total_fee, '123.46');
    await request('updateCourse', { ...course, courseName: 'Edited' });
    const student = { id: 'student', studentName: 'Student', registration_number: 'REG1', course_id: 'course', registration_fee: 20, training_course_fee: 100, discount: 10 };
    await request('addStudent', student);
    await request('updateStudent', { ...student, studentContact: '123' });
    await request('updateStudentStatus', { id: 'student', status: 'Inactive' });
    assert.equal((await request('getStudents'))[0].status, 'Inactive');
    await assert.rejects(request('deleteCourse', { id: 'course' }), /FOREIGN KEY/);
    await request('saveStudentPayment', { id: 'sp', studentId: 'student', studentName: 'Student', paymentDate: '2026-09-15', amount: 10, paymentMode: 'Cash' });
    assert.equal((await request('getStudentPayments'))[0].total_paid, '10.00');
    await assert.rejects(
      request('deleteStudent', { studentId: 'REG1', role: 'CASHIER', username: 'cashier', userId: 'cashier' }),
      /Only an administrator/,
    );
    await request('deleteStudent', { studentId: 'REG1', role: 'ADMIN', username: 'kcmtadmin', userId: 'user-admin' });
    assert.equal((await request('getStudents')).some((row) => row.id === 'student'), false);
    await request('saveStaff', { id: 'staff', employee_id: 'EMP1', employeeName: 'Staff', basic_salary: 500 });
    assert.equal((await request('getStaff'))[0].employee_id, 'EMP1');
    await request('saveVendor', { id: 'vendor', vendorName: 'Vendor', panNo: '123', contactNumber: '456', address: 'Town' });
    const savedVendor = (await request('getVendors')).find(row => row.vendorId === 'vendor');
    assert.equal(savedVendor.vendorName, 'Vendor');
    assert.equal(savedVendor.pan_vat_no, '123');
    assert.equal(savedVendor.contact_no, '456');
    assert.equal((await request('getVendorLedger'))[0].vendorId, 'vendor');
    const purchase = { id: 'purchase', vendorId: 'vendor', purchaseDate: '2026-09-15', paid_amount: 10, discount: 0, tax: 0, items: [{ itemName: 'Milk', quantity: 2, unitPrice: 10 }] };
    await request('savePurchase', purchase);
    const savedPurchase = (await request('getPurchaseBills'))[0];
    assert.equal(savedPurchase.grand_total, '20.00');
    assert.equal(savedPurchase.paid_amount, '10.00');
    assert.equal(savedPurchase.due_amount, '10.00');
    assert.equal(Number(savedPurchase.paidAmount) + Number(savedPurchase.dueAmount), Number(savedPurchase.grandTotal));
    assert.equal((await query('SELECT COUNT(*) AS n FROM PurchaseItems'))[0].n, 1);
    await request('saveVendorPayment', { id: 'vp', vendorId: 'vendor', vendorName: 'Vendor', paymentDate: '2026-09-15', amount: 5 });
    assert.equal(Number((await request('getVendorLedger'))[0].totalDue), 5);
    await request('saveCafeCategory', { id: 'category', categoryName: 'Drinks' });
    await request('saveCafeMenu', { id: 'menu', itemName: 'Tea', category_id: 'category', price: 10, cost_price: 5, quantity: 20 });
    await request('saveCafeMenu', { itemName: 'Coffee', categoryId: 'category', price: 15, cost_price: 7, quantity: 20 });
    const drinks = (await request('getCafeMenu')).filter((item) =>
      String(item.category_id || item.categoryId) === 'category',
    );
    assert.equal(drinks.length, 2);
    assert.deepEqual(
      drinks.map((item) => item.name || item.itemName).sort(),
      ['Coffee', 'Tea'],
    );
    await request('saveCafeTable', { id: 'table', table_no: '1', tableName: 'Window Table', capacity: 4 });
    const savedCafeTable = (await request('getCafeTables'))[0];
    assert.equal(savedCafeTable.tableNo, '1');
    assert.equal(savedCafeTable['Table No'], '1');
    assert.equal(savedCafeTable.tableName, 'Window Table');
    assert.equal(savedCafeTable['Table Name'], 'Window Table');
    await request('saveCafeCustomer', { id: 'customer', customerName: 'Customer', credit_limit: 100 });
    for (const method of ['Cash', 'QR', 'Credit']) {
      await request('saveCafeSale', { id: method, customerId: method === 'Credit' ? 'customer' : null, saleDate: '2026-09-15', total_bill: 20, discount_amount: 0, vat_amount: 0, tendered_amount: 30, paid_amount: method === 'Credit' ? 5 : 20, change_amount: method === 'Credit' ? 0 : 10, due_amount: method === 'Credit' ? 15 : 0, payment_method: method, items_ordered: [{ name: 'Tea', quantity: 2, price: 10 }] });
    }
    assert.equal((await request('getCafeSales')).length, 3);
    assert.equal((await request('getCreditSales')).length, 1);
    await request('saveDueReceived', { id: 'receipt', customerId: 'customer', receiptDate: '2026-09-15', receivedAmount: 5 });
    assert.equal(Number((await request('getCustomerLedger'))[0].totalDue), 10);
    assert.equal((await request('getCustomerPayments')).length, 1);
    const dueReceipts = await request('getDueReceived');
    assert.equal(dueReceipts.length, 1);
    assert.equal(dueReceipts[0].id, 'receipt');
    assert.equal(Number(dueReceipts[0].received_amount), 5);
    assert.equal(Number(dueReceipts[0].remaining_due_amount), 10);
    await database.save('Inventory', { id: 'inventory', item_name: 'Milk', quantity: '1.2345', unit: 'L' });
    assert.equal((await request('getInventory'))[0].quantity, '1.235');
    const payroll = { id: 'payroll', employee_id: 'EMP1', payroll_month: '2026-09' };
    for (const [name, info] of Object.entries(schema.Payroll)) if (info.scale !== undefined) payroll[name] = 0;
    Object.assign(payroll, { basic_salary: 500, normal_working_days: 26, days_worked: 26, earned_salary: 500, bonus: 10, allowance: 20, total_earning: 530, deduction: 5, tds: 5, net_salary: 520, total_paid: 500, due_salary: 20 });
    await request('savePayroll', payroll);
    assert.equal((await request('getPayroll'))[0].net_salary, '520.00');
    assert.equal((await request('getPayrollSummary'))[0].employee_name, 'Staff');
    await request('saveSystemRole', { id: 'cashier-role', roleName: 'CASHIER' });
    await request('saveSystemUser', { id: 'cashier', username: 'cashier', password: 'test-password', role: 'CASHIER', full_name: 'Cashier' });
    await request('savePermissionAssignment', { targetType: 'role', targetId: 'cashier-role', permissionKey: 'cafe.view', allowed: true });
    const user = await request('authenticateUser', { username: 'CASHIER', password: 'test-password' });
    assert.equal(user.role, 'CASHIER');
    assert.deepEqual(user.permissions, ['cafe.view']);
    await assert.rejects(request('authenticateUser', { username: 'cashier', password: 'wrong' }), /Invalid/);
    await request('savePermissionAssignment', { targetType: 'user', targetId: 'cashier', permissionKey: 'cafe.view', allowed: false });
    assert.deepEqual((await request('authenticateUser', { username: 'cashier', password: 'test-password' })).permissions, []);
    assert.ok((await request('getPermissionMatrix')).permissions.length > 50);
    await request('saveSystemUser', { id: 'user-admin', username: 'kcmtadmin', password: 'test-admin', role: 'ADMIN', full_name: 'Admin' });
    assert.equal((await request('authenticateUser', { username: 'kcmtadmin', password: 'test-admin' })).role, 'ADMIN');
    // Inject a child-write failure after the header and verify whole-sale rollback.
    await database.pool.exec("CREATE TRIGGER reject_credit BEFORE INSERT ON CreditSales BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    await assert.rejects(request('saveCafeSale', { id: 'bad-sale', customerId: 'customer', total_bill: 5, paid_amount: 0, due_amount: 5, discount_amount: 0, vat_amount: 0, tendered_amount: 0, change_amount: 0 }), /test failure/);
    assert.equal((await query("SELECT COUNT(*) AS n FROM CafeSales WHERE id='bad-sale'"))[0].n, 0);
    await database.pool.exec('DROP TRIGGER reject_credit');
    await Promise.all(Array.from({ length: 8 }, (_, index) => request('saveCourse', { ...course, id: `parallel-${index}` })));
    assert.equal((await request('getCourses')).length, 9);
    for (const report of (await request('getReportConfig')).reports) {
      if (report.package) continue; // The renderer submits each component report.
      assert.ok(Array.isArray((await request('getReportPreview', { reportKey: report.key, dateFrom: '2026-09-01', dateTo: '2026-09-30' })).rows));
    }
    await request("saveReportConfig", { endpoint: "https://script.google.com/macros/s/test/exec", apiToken: "test-token" });
    assert.equal((await request("getReportConfig")).endpoint, "https://script.google.com/macros/s/test/exec");
    // A reporting login is explicit, and does not change local login or require a shared token.
    global.fetch = async (_url, options) => {
      const login = JSON.parse(options.body);
      assert.equal(login.action, 'authenticateUser');
      return { ok: true, json: async () => ({ success: true, data: { sessionToken: 'remote-session', permissions: ['reports.view'] } }) };
    };
    assert.equal((await request('authenticateReports', { username: 'report-user', password: 'report-password' })).sessionToken, 'remote-session');
    let sent;
    global.fetch = async (_url, options) => { sent = JSON.parse(options.body); return { ok: true, json: async () => ({ success: true, data: { submissionId: 'remote', sheet: 'Purchases', rows: 1 } }) }; };
    await request('submitReport', { reportKey: 'purchases', dateFrom: '2026-09-01', dateTo: '2026-09-30', userId: 'cashier' });
    assert.ok(sent);
    assert.equal(sent.action, "upsertReport");
    assert.equal(sent.apiToken, undefined);
    assert.equal(sent.sessionToken, 'remote-session');
    assert.equal((await request('getReportSubmissions'))[0].status, 'Submitted');
    assert.equal((await query('SELECT COUNT(*) AS n FROM AuditLog'))[0].n, 1);
    global.fetch = async () => { throw new Error('Offline'); };
    const failed = await request('submitReport', { reportKey: 'staff', dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    assert.equal(failed.success, false);
    let requestedEndpoint;
    global.fetch = async (url) => {
      requestedEndpoint = url;
      return { ok: false, status: 404, text: async () => '<!DOCTYPE html><script>window.ppConfig={};</script>' };
    };
    const missingEndpoint = await request('submitReport', {
      reportKey: 'student-payments',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      sessionToken: 'remote-session',
    });
    assert.equal(requestedEndpoint, 'https://script.google.com/macros/s/test/exec');
    assert.equal(missingEndpoint.success, false);
    assert.match(missingEndpoint.message, /HTTP|endpoint/i);
    assert.doesNotMatch(missingEndpoint.message, /ppConfig|DOCTYPE|window/i);
    let redirectOptions;
    global.fetch = async (_url, options) => {
      redirectOptions = options;
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, data: { submissionId: "remote", sheet: "StudentLedger", rows: 0 } }) };
    };
    assert.equal((await request("submitReport", { reportKey: "student-ledger", dateFrom: "2026-09-01", dateTo: "2026-09-30", sessionToken: "remote-session" })).success, true);
    assert.equal(redirectOptions.redirect, "follow");
    assert.equal(redirectOptions.method, "POST");
    global.fetch = async () => ({ ok: false, status: 404, text: async () => "<!doctype html><script>window.ppConfig={};</script>" });
    const signInFailure = await database.request("authenticateReports", { username: "report-user", password: "report-password" });
    assert.equal(signInFailure.success, false);
    assert.match(signInFailure.message, /endpoint was not found/i);
    global.fetch = async (_url, options) => ({ ok: true, json: async () => ({ success: true, data: JSON.parse(options.body).action === 'uploadPersonFile' ? { folderId: 'staff-folder', photoFolderId:'photo-folder', documentsFolderId:'documents-folder' } : { sheet: 'Staff', rows: 1 } }) });
    assert.equal((await request('retryReport', { submissionId: failed.submissionId })).success, true);
    await database.pool.query("DELETE FROM SystemSettings WHERE `key`='reports.apiToken'");
    const previousToken = process.env.REPORTS_API_TOKEN;
    process.env.REPORTS_API_TOKEN = '';
    try {
      global.fetch = async (_url, options) => {
        assert.equal(JSON.parse(options.body).sessionToken, 'remote-session');
        return { ok: true, json: async () => ({ success: true, data: JSON.parse(options.body).action === 'uploadPersonFile' ? {folderId:'staff-folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder'} : { sheet: 'Staff', rows: 1 } }) };
      };
      assert.equal((await request('submitReport', { reportKey: 'staff', dateFrom: '2026-09-01', dateTo: '2026-09-30', sessionToken: 'remote-session' })).success, true);
      global.fetch = async () => ({ ok: true, json: async () => ({ success: false, message: 'Report authentication required.', data: { error: 'REPORT_AUTH_REQUIRED', message: 'Sign in again.' } }) });
      const denied = await request('submitReport', { reportKey: 'staff', dateFrom: '2026-09-01', dateTo: '2026-09-30', sessionToken: 'expired' });
      assert.equal(denied.success, false);
      assert.equal(denied.code, 'REPORT_AUTH_REQUIRED');
      assert.equal(denied.message, 'Sign in again.');
    } finally {
      if (previousToken === undefined) delete process.env.REPORTS_API_TOKEN; else process.env.REPORTS_API_TOKEN = previousToken;
    }
    await query(
      "INSERT INTO StaffDocuments (id, staff_id, name, path, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ['staff-document', 'staff', 'id-proof.pdf', '/tmp/id-proof.pdf'],
    );
    await query(
      "INSERT INTO StudentMedia (id, entity_table, entity_id, media_type, file_name, total_chunks, created_at, active) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1)",
      ['staff-media', 'Staff', 'staff', 'document', 'id-proof.pdf', 0],
    );
    await request('deleteStaff', { employeeId: 'EMP1' });
    assert.equal((await request('getStaff')).some((row) => row.id === 'staff'), false);
    assert.equal((await query("SELECT COUNT(*) AS n FROM StaffDocuments WHERE staff_id = 'staff'"))[0].n, 0);
    assert.equal((await query("SELECT COUNT(*) AS n FROM StudentMedia WHERE entity_table = 'Staff' AND entity_id = 'staff'"))[0].n, 0);
    const preservedPayroll = (await query("SELECT employee_id, data_json FROM Payroll WHERE id = 'payroll'"))[0];
    assert.equal(preservedPayroll.employee_id, null);
    assert.match(preservedPayroll.data_json, /EMP1/);
    const backup = await database.pool.backup(path.join(directory, 'backup.db'));
    const copy = new SQLitePool(backup);
    await copy.ready;
    assert.equal((await copy.all('SELECT COUNT(*) AS n FROM CafeSales'))[0].n, 3);
    assert.deepEqual(await copy.all('PRAGMA integrity_check'), [{ integrity_check: 'ok' }]);
    await copy.end();
    await database.pool.end();
    database = new Database(file);
    await database.open();
    assert.equal((await database.list('CafeSales')).length, 3);
    assert.equal((await database.list('Courses')).find(row => row.id === 'course').course_name, 'Edited');
    const previous = process.cwd();
    try { process.chdir(directory); assert.equal(databasePath(), path.resolve(__dirname, '../database/kumakh.db')); } finally { process.chdir(previous); }
    assert.equal(decimal('9999999999.994', 12, 2), '9999999999.99');
    assert.equal(decimal('-1.005', 12, 2), '-1.01');
    assert.equal(decimal('1e-3', 12, 3), '0.001');
  } finally {
    global.fetch = originalFetch;
    if (reportEndpoint === undefined) delete process.env.REPORTS_APPS_SCRIPT_URL; else process.env.REPORTS_APPS_SCRIPT_URL = reportEndpoint;
    await database.pool.end();
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
