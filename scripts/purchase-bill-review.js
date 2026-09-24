// Verify Bill History against disposable purchases through the actual renderer.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { Database } = require('../electron/database');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'purchase-bill-ui-'));
app.setPath('userData', path.join(temporary, 'browser'));
let db;
app.whenReady().then(async () => {
  db = new Database(path.join(temporary, 'test.db'));
  await db.open();
  for (const vendorId of ['vendor-a', 'vendor-b']) {
    await db.request('saveVendor', { id: vendorId, vendorName: vendorId, address: 'Test address', panNo: '123', contactNumber: '456' });
  }
  for (const [invoiceNo, vendorId, paidAmount] of [['UNPAID', 'vendor-a', 0], ['PARTIAL', 'vendor-b', 200], ['PAID', 'vendor-a', 950]]) {
    await db.request('savePurchase', { vendorId, invoiceNo, purchaseDate: '2026-09-18', discount: 100, tax: 50, paidAmount, paymentMethod: 'Cash', remarks: invoiceNo + ' remarks', items: [
      { itemName: invoiceNo + ' Rice', quantity: 2, unit: 'kg', unitPrice: 300 },
      { itemName: invoiceNo + ' Oil', quantity: 4, unit: 'ltr', unitPrice: 100 },
    ] });
  }
  const bills = (await db.request('getPurchaseBills')).data;
  assert.equal(bills.length, 3);
  bills.forEach(bill => assert.equal(bill.subtotal, 1000));
  ipcMain.handle('review:api', (_event, action, payload) => db.request(action, payload));
  ipcMain.handle('review:page', (_event, name) => fs.readFileSync(path.join(__dirname, '../frontend/pages', path.basename(name)), 'utf8'));
  const win = new BrowserWindow({ show: false, width: 1366, height: 900, webPreferences: { offscreen: true, backgroundThrottling: false, preload: path.join(__dirname, 'ui-review-preload.js'), sandbox: false } });
  await win.loadFile(path.join(__dirname, '../frontend/index.html'));
  await win.webContents.executeJavaScript("loadPage('purchases')");
  const result = await win.webContents.executeJavaScript(`(async () => {
    const wait = async predicate => { for(let i=0;i<150;i++){if(predicate())return;await new Promise(r=>setTimeout(r,30));}throw new Error('Purchase history timed out'); };
    const check = (condition, message) => { if(!condition)throw new Error(message); };
    await wait(()=>document.querySelectorAll('#history .view').length===3);
    let count=0;
    for(const filter of ['', 'vendor-b', 'vendor-a']) {
      const select=document.getElementById('historyVendor'); select.value=filter; select.dispatchEvent(new Event('change'));
      for(const button of document.querySelectorAll('#history .view')) {
        const cells=button.closest('tr').cells;
        const purchaseId=cells[0].textContent.trim();
        const invoice=cells[2].textContent.trim();
        const paid=invoice==='PAID'?950:invoice==='PARTIAL'?200:0;
        button.click();
        await wait(()=>document.querySelector('.kumakh-voucher-overlay .purchase-voucher'));
        const voucher=document.querySelector('.kumakh-voucher-overlay');
        check(voucher.querySelector('.document-number').textContent.includes(purchaseId), 'Wrong purchase ID');
        check(voucher.querySelector('.vendor-card .info-name').textContent===cells[3].textContent.trim(), 'Wrong vendor');
        const rows=[...voucher.querySelectorAll('.summary-row')].map(row=>row.querySelector('span:last-child').textContent);
        check(JSON.stringify(rows)===JSON.stringify(['1,000.00','100.00','50.00',paid.toFixed(2),(950-paid).toFixed(2)]), 'Incorrect summary: '+JSON.stringify(rows));
        check(voucher.querySelector('.grand-total strong').textContent==='Rs 950.00','Wrong total');
        const items=[...voucher.querySelectorAll('tbody tr')];
        check(items.length===2 && items.every(row=>row.textContent.includes(invoice)), 'Items belong to another invoice');
        check(items.map(row=>Number(row.cells[6].textContent.replaceAll(',',''))).reduce((a,b)=>a+b,0)===1000, 'Wrong item amounts');
        check(voucher.querySelector('.reference-card').textContent.includes('Purchase date:'), 'Missing purchase date');
        check(voucher.querySelector('[data-purchase-remarks]').textContent===invoice+' remarks','Wrong remarks');
        voucher.querySelector('[data-close]').click(); count++;
      }
    }
    return { billsVerified:count, passed:['unpaid, partial and paid summaries','vendor filtering selects exact bill','purchase ID, vendor, items, date and remarks'] };
  })()`);
  console.log(JSON.stringify(result, null, 2));
  win.destroy(); await db.pool.end(); db=null; app.quit();
}).catch(async error => { console.error(error); if(db)await db.pool.end(); app.exit(1); });
