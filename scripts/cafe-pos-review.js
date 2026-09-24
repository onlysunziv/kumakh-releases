// Exercise the real renderer and SQLite API in an isolated Electron window.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { Database } = require('../electron/database');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-ui-'));
app.setPath('userData', path.join(temporary, 'browser'));
let db;
app.whenReady().then(async () => {
  db = new Database(path.join(temporary, 'test.db'));
  await db.open();
  await db.request('saveCafeCategory', { id: 'drinks', categoryName: 'Drinks' });
  await db.request('saveCafeMenu', { id: 'tea', itemName: 'Tea', categoryId: 'drinks', categoryName: 'Drinks', sellingPrice: 100, quantity: 50, costPrice: 20, unit: 'Plate', available: 'Yes' });
  for (const name of ['C1', 'C2']) await db.request('saveCafeTable', { tableNo: name, tableName: name });
  await db.request('saveCafeCustomer', { id: 'customer', customerName: 'Credit Customer', phoneNumber: '123', creditLimit: 1000 });
  ipcMain.handle('review:api', (_event, action, payload) => db.request(action, payload));
  ipcMain.handle('review:page', (_event, name) => fs.readFileSync(path.join(__dirname, '../frontend/pages', path.basename(name)), 'utf8'));
  const win = new BrowserWindow({ show: false, width: 1366, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(__dirname, 'ui-review-preload.js'), sandbox: false } });
  const run = code => win.webContents.executeJavaScript(code);
  await win.loadFile(path.join(__dirname, '../frontend/pages/cafe.html'));
  for (let i = 0; i < 100 && !await run('databaseReady'); i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await run('databaseReady'), true);
  const result = await run(`(async () => {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const change = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('change')); };
    const input = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('input', { bubbles: true })); };
    const wait = async predicate => { for(let i=0;i<100;i++){if(predicate()) return; await new Promise(r=>setTimeout(r,30));} throw new Error('UI operation timed out'); };
    window.alerts = []; window.alert = message => alerts.push(message);
    check($('tableSelect').value === '', 'table placeholder');
    check([...$('tableSelect').options].some(o=>o.text === 'C1'), 'single table name');
    $('menuGrid').querySelector('[data-item]').click();
    check(order.length === 0 && alerts.length === 1, 'table required before adding');
    change('tableSelect', 'C1');
    const portionSelect = $('menuGrid').querySelector('[data-item="tea"][data-portion-select]');
    const portionAdd = $('menuGrid').querySelector('[data-item="tea"].add-btn');
    check(portionSelect && portionAdd, 'portion dropdown is displayed');
    portionAdd.click();
    portionSelect.value = 'half';
    portionAdd.click();
    check(order.length === 2 && order[0].price === 100 && order[1].price === 50, 'separate full and half plate lines');
    portionAdd.click();
    check(order[1].qty === 2, 'repeat half plate adds serving');
    check(!$('orderItems').querySelector('input, [data-qty-adjust]'), 'order quantities are not editable');
    $('clearBtn').click();
    portionSelect.value = 'half';
    portionAdd.click();
    check(order[0].qty === 1 && order[0].price === 50 && order[0].name.includes('Half Plate'), 'half plate price and label');
    input('discount', '10');
    change('customerName', 'Credit Customer');
    check($('customerPhone').value === '123', 'customer phone autofill');
    change('tableSelect', 'C2');
    check(order.length === 0 && $('discount').value === '0', 'independent table discount');
    change('tableSelect', 'C1');
    check(order.length === 1 && $('discount').value === '10', 'restore table order');
    document.querySelector('[data-shortcut="tables"]').click();
    check($('reportContent').textContent.includes('Occupied'), 'occupied table');
    check(getComputedStyle(document.querySelector('[data-state="occupied"] .table-status-card__state strong')).color === 'rgb(180, 35, 24)', 'occupied red');
    check(getComputedStyle(document.querySelector('[data-state="available"] .table-status-card__state strong')).color === 'rgb(22, 132, 74)', 'available green');
    $('reportDialog').close();
    $('completeBtn').click(); input('printTenderAmount','20');
    check(refreshPaymentPrintForm().creditAmount === 25, 'partial credit amount');
    const realReceipt = window.KumakhVouchers.cafeReceipt;
    window.KumakhVouchers.cafeReceipt = () => { throw new Error('Simulated printer failure'); };
    $('confirmPaymentPrint').click();
    await wait(()=>!$('confirmPaymentPrint').disabled);
    check(order.length === 0 && pendingSale === null, 'committed order cleared despite print error');
    check(alerts.some(m=>m.includes('Sale saved')), 'saved sale print error message');
    await loadReport('history');
    check($('reportContent').textContent.includes('45.00'), 'history amount');
    change('salesHistoryFilter','today');
    check($('reportContent').textContent.includes('1 sale'), 'history today filter');
    change('salesHistoryFilter','yesterday'); check($('reportContent').textContent.includes('0 sales'), 'yesterday filter');
    change('salesHistoryFilter','last7'); check($('reportContent').textContent.includes('1 sale'), 'last seven days filter');
    change('salesHistoryFilter','date'); check($('reportContent').textContent.includes('1 sale'), 'date filter');
    $('reportDialog').close();
    await loadReport('closing');
    check($('reportContent').textContent.includes('25.00'), 'closing credit amount');
    check(!$('submitClosingReport'), 'closing submission belongs to Submit Reports');
    $('reportDialog').close();
    window.KumakhVouchers.cafeReceipt = realReceipt;
    for (const [method, customerName, tender, valid, due, changeAmount] of [
      ['Cash','', '50', false, 0, 0], ['QR','', '150', false, 0, 0],
      ['Credit','', '0', false, 0, 0], ['Cash','', '150', true, 0, 50],
      ['QR','', '100', true, 0, 0], ['Credit','Credit Customer','0',true,100,0],
      ['QR','Credit Customer','40',true,60,0],
    ]) {
      $('menuGrid').querySelector('[data-item="tea"]').click();
      change('customerName',customerName); $('customerPhone').value=customerName?'123':'';
      setSelectedPayment(method); $('completeBtn').click(); input('printTenderAmount',tender);
      const payment=refreshPaymentPrintForm(true);
      check(payment.valid===valid,'payment validation '+method+'/'+customerName+'/'+tender);
      if(valid){
        check(payment.creditAmount===due && payment.changeAmount===changeAmount,'payment split');
        $('confirmPaymentPrint').click(); await wait(()=>!$('confirmPaymentPrint').disabled);
        check(!!document.querySelector('.kumakh-voucher-overlay'),'actual receipt displayed');
        document.querySelector('.kumakh-voucher-overlay [data-close]').click();
      } else { closePaymentPrintDialog(); $('clearBtn').click(); }
    }
    await openCafeSettings();
    check($('cafeCategoryOptions').options.length === 1, 'category list');
    $('cafeMenuItemName').value='Coffee'; $('cafeMenuCategory').value='Drinks';
    $('cafeMenuQuantity').value='10'; $('cafeMenuUnit').value='Plate'; $('cafeMenuPrice').value='150'; $('cafeMenuCostPrice').value='50';
    $('cafeMenuForm').dispatchEvent(new Event('submit', {cancelable:true}));
    await wait(()=>menuItems.some(i=>i.name==='Coffee'));
    $('cafeCustomerName').value='New Customer'; $('cafeCustomerPhone').value='456'; $('cafeCustomerCreditLimit').value='500';
    $('cafeCustomerForm').dispatchEvent(new Event('submit', {cancelable:true}));
    await wait(()=>cafeCustomers.some(c=>c['Customer Name']==='New Customer'));
    $('settingsDialog').close();
    input('searchInput','Coffee'); check($('itemCount').textContent==='1','menu search');
    input('searchInput','');
    return { passed: ['table selection','add item','full and half plate selection','discount isolation','customer lookup','table order restoration','occupied status','partial credit','print failure recovery','history filters','closing submission','add menu item','add customer','search','cash change','QR exact payment','walk-in underpayment rejected','walk-in credit rejected','QR overpayment rejected','full credit','partial QR credit','actual receipt rendering'] };
  })()`);
  const ledger = (await db.request('getCustomerLedger')).data;
  assert.equal(Number(ledger.find(c => c.customerId === 'customer').totalDue), 185);
  const output = path.join(__dirname, '../.ui-review');
  fs.mkdirSync(output, { recursive: true });
  await run("new Promise(resolve => window.kumakhLoading.whenIdle(resolve))");
  await new Promise(resolve => setTimeout(resolve, 700));
  fs.writeFileSync(path.join(output, 'cafe-tested.png'), (await win.webContents.capturePage()).toPNG());
  await run(`$('menuGrid').querySelector('[data-item="tea"][data-portion="full"]').click(); $('menuGrid').querySelector('[data-item="tea"][data-portion="half"]').click();`);
  await run("new Promise(resolve=>setTimeout(resolve,300))");
  fs.writeFileSync(path.join(output, 'cafe-portions.png'), (await win.webContents.capturePage()).toPNG());
  await run("$('clearBtn').click()");
  await run("loadReport('closing')");
  await new Promise(resolve => setTimeout(resolve, 700));
  fs.writeFileSync(path.join(output, 'cafe-closing-tested.png'), (await win.webContents.capturePage()).toPNG());
  await run("$('reportDialog').close(); openCafeSettings()");
  await new Promise(resolve => setTimeout(resolve, 700));
  fs.writeFileSync(path.join(output, 'cafe-settings-tested.png'), (await win.webContents.capturePage()).toPNG());
  await db.request('saveReportConfig', { endpoint: 'https://script.google.com/macros/s/test/exec', apiToken: 'legacy-token' });
  let uploads = 0;
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    if (payload.action === 'authenticateUser') return {
      ok: true, json: async () => payload.username === 'reporter' && payload.password === 'test-password'
        ? { success: true, data: { sessionToken: 'test-session', permissions: ['reports.view'] } }
        : { success: false, message: 'Invalid credentials' },
    };
    assert.equal(payload.sessionToken, 'test-session');
    assert.equal(payload.apiToken, undefined);
    assert.equal(payload.reportKey, 'cafe-daily-sales');
    assert.equal(payload.rows[0].total_sales, 445);
    uploads++;
    return { ok: true, json: async () => ({ success: true, data: { sheet: 'CafeDailySales', rows: 1 } }) };
  };
  await win.loadFile(path.join(__dirname, '../frontend/index.html'));
  await run("loadPage('payments')");
  await run(`(async () => {
    const el = id => document.getElementById(id);
    const wait = async test => { for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Payment UI timed out: '+el('paymentMessage').textContent); };
    await wait(()=>el('dueCustomer')?.querySelector('option[value="customer"]'));
    for (const amount of [25, 160]) {
      el('dueCustomer').value='customer'; el('dueCustomer').dispatchEvent(new Event('change'));
      el('dueAmount').value=String(amount);
      el('customerDueForm').dispatchEvent(new Event('submit', {cancelable:true}));
      await wait(()=>!el('receiveCustomerDueButton').disabled);
      if(!el('paymentMessage').textContent.includes('Payment saved successfully'))throw new Error(el('paymentMessage').textContent);
      el('paymentStatusClose').click();
    }
  })()`);
  assert.equal(Number((await db.request('getCustomerLedger')).data.find(c=>c.customerId==='customer').totalDue), 0);
  assert.equal((await db.request('getDueReceived')).data.length, 2);
  result.passed.push('customer partial due collection', 'customer full settlement');
  await db.request('saveCourse', { id: 'edit-course', courseName: 'Test Course', duration: '1 month', totalFee: 100 });
  await db.request('addStudent', { student: { id: 'edit-student', registrationNumber: 'EDIT-1', fullName: 'Before Edit', studentContact: '12345', joiningDate: '2026-09-18', course: 'Test Course', courseDuration: '1 month', registrationFee: 0, trainingCourseFee: 100, discount: 0 } });
  await run("loadPage('students')");
  await run(`(async () => {
    const el = id => document.getElementById(id);
    for(let i=0;i<100&&!document.querySelector('[data-student-edit-index]');i++)await new Promise(r=>setTimeout(r,30));
    document.querySelector('[data-student-edit-index]').click();
    if(el('studentContact').value!=='12345')throw new Error('Contact not populated');
    const form=el('addStudentForm');
    form.elements.fullName.value='After Edit'; form.elements.studentContact.value='67890';
    for(let i=0;i<3;i++)el('studentNextButton').click();
    form.dispatchEvent(new Event('submit', {cancelable:true}));
    for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,30));if(!el('saveStudentButton').disabled)break;}
  })()`);
  const editedStudents = (await db.request('getStudents')).data;
  assert.equal(editedStudents.length, 1);
  assert.equal(editedStudents[0].id, 'edit-student');
  assert.equal(editedStudents[0].full_name, 'After Edit');
  assert.equal(editedStudents[0].student_contact, '67890');
  await run(`(async () => {
    const select=document.querySelector('[data-student-status-index]');
    select.value='Passed'; select.dispatchEvent(new Event('change',{bubbles:true}));
    for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,30));if(!select.disabled)break;}
  })()`);
  assert.equal((await db.request('getStudents')).data[0].status, 'Passed');
  result.passed.push('student edit updates original record and contact');
  await run("loadPage('reports')");
  await run(`(async () => {
    const el = id => document.getElementById(id);
    const wait = async test => { for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Reports UI timed out'); };
    await wait(()=>document.querySelector('input[value="cafe-daily-sales"]'));
    document.querySelector('input[value="cafe-daily-sales"]').checked=true;
    await el('reportForm').onsubmit({preventDefault(){}});
    await el('submitReportButton').onclick();
    if(!el('reportAuthMessage').textContent.includes('username and password'))throw new Error('Missing sign-in gate');
    el('reportUsername').value='reporter';el('reportPassword').value='wrong';
    await el('reportSignInForm').onsubmit({preventDefault(){},currentTarget:el('reportSignInForm')});
    if(!el('reportAuthMessage').textContent.includes('Invalid'))throw new Error('Failed login accepted');
    el('reportPassword').value='test-password';
    await el('reportSignInForm').onsubmit({preventDefault(){},currentTarget:el('reportSignInForm')});
    if(el('reportPassword').value)throw new Error('Password not cleared');
    await el('submitReportButton').onclick();
    if(!el('reportSubmissionTitle').textContent.includes('successfully'))throw new Error('Closing report submission failed');
  })()`);
  assert.equal(uploads, 1);
  result.passed.push('mandatory report login', 'invalid reporting credentials', 'authenticated closing export');
  console.log(JSON.stringify(result, null, 2));
  win.destroy(); await db.pool.end(); db = null; app.quit();
}).catch(async error => { console.error(error); if (db) await db.pool.end(); app.exit(1); });
