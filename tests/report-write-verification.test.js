const {test} = require('node:test');
const assert = require('node:assert/strict');
const reportSheet = require('./helpers/report-sheet');

for (const file of ['code.gs','code.js']) {
  test(`${file}: Home Number repairs an inherited numeric format without losing zeros`, () => {
    const {context,spreadsheet}=reportSheet(file);
    const sheet=spreadsheet.insertSheet('Staff');
    sheet.parseText=true;
    sheet.numericTextColumn=true;
    sheet.grid.push(['Record ID','Employee ID','Home Number'],['staff','EMP',12]);
    const request={reportKey:'staff',rows:[{id:'staff',employee_id:'EMP',home_number:'0012'}]};
    for(let retry=0;retry<2;retry++) {
      assert.equal(context.upsertReport_(request).success,true);
      assert.equal(sheet.grid[1][2],'0012');
      assert.equal(sheet.grid.length,2);
    }
    sheet.formats.clear();sheet.typedColumn=true;
    assert.throws(()=>context.upsertReport_(request),/REPORT-TEXT-4: expected 4 characters; read 2; type Number.*column type to Text/);
    sheet.typedColumn=false;sheet.dropWrites=true;
    assert.throws(()=>context.upsertReport_(request),/verification failed for Staff row 2, column Home Number/);
  });

  test(`${file}: typed month dates and exact phone numbers verify on retries`, () => {
    const {context,spreadsheet} = reportSheet(file);
    const payroll = spreadsheet.insertSheet('Payroll');
    payroll.parseText = true;
    const rows = [{id:'payroll-1',employee_id:'EMP-1',payroll_month:'2026-09',net_salary:'500.00'},
      {id:'payroll-2',employee_id:'EMP-2',payroll_month:'2026-10',net_salary:'300.00'}];
    for (let retry=0; retry<2; retry++) {
      assert.equal(context.upsertReport_({reportKey:'payroll',rows}).data.verifiedRows,2);
      const column = payroll.grid[0].indexOf('Payroll Month');
      assert.deepEqual(payroll.grid.slice(1).map(row => context.reportPayrollMonth_(row[column],spreadsheet)),['2026-09','2026-10']);
      assert.equal(payroll.grid.length,3);
    }
    assert.equal(payroll.richTextWrites.length,0,'equivalent typed dates need no text rewrite');
    const staff = spreadsheet.insertSheet('Staff');
    staff.parseText = true;
    const people = [{id:'staff-1',employee_id:'EMP-1',home_number:'0012345',mobile_number:'+9779812345678',account_number:'0000000123456789012345'},
      {id:'staff-2',employee_id:'EMP-2',home_number:'0',mobile_number:'0987654321',account_number:'0002'}];
    for (let retry=0; retry<2; retry++) {
      assert.equal(context.upsertReport_({reportKey:'staff',rows:people}).data.verifiedRows,2);
      for (const [header,field] of [['Home Number','home_number'],['Mobile Number','mobile_number'],['Account Number','account_number']]) {
        const column = staff.grid[0].indexOf(header);
        assert.deepEqual(staff.grid.slice(1).map(row => String(row[column])),people.map(person => person[field]));
      }
      assert.equal(staff.grid.length,3);
    }
    staff.dropWrites = true;
    people[0].home_number = '0099999';
    assert.throws(() => context.upsertReport_({reportKey:'staff',rows:people}),/verification failed for Staff row 2, column Home Number/);
  });

  test(`${file}: payroll month uses spreadsheet timezone and still rejects a different month`, () => {
    const {context,spreadsheet} = reportSheet(file);
    spreadsheet.timezone = 'Asia/Kathmandu';
    // May 1 at midnight in Nepal is still April in UTC.
    const may = new Date('2026-04-30T18:15:00Z');
    assert.equal(context.reportPayrollMonth_(may,spreadsheet),'2026-05');
    assert.equal(context.reportPayrollMonth_('2026-13',spreadsheet),'');
    assert.equal(context.reportPayrollMonth_('05/06/2026',spreadsheet),'');
    const sheet = spreadsheet.insertSheet('Payroll');
    sheet.grid.push(['Record ID','Payroll Month'],['payroll',may]);
    sheet.dropWrites = true; // Keep returning the typed Date even after a text write.
    const request = {reportKey:'payroll',rows:[{id:'payroll',payroll_month:'2026-05'}]};
    assert.equal(context.upsertReport_(request).data.verifiedRows,1);
    request.rows[0].payroll_month = '2026-06';
    assert.throws(() => context.upsertReport_(request),/REPORT-MONTH-3: expected 2026-06; read 2026-05; type Date/);
    request.rows[0].payroll_month = '2027-05';
    assert.throws(() => context.upsertReport_(request),/expected 2027-05; read 2026-05/);
    sheet.grid[1][1] = '';
    assert.throws(() => context.upsertReport_(request),/read invalid month; type String/);
  });

  test(`${file}: vendor IDs work without PAN and ledger updates preserve contacts and formulas`, () => {
    const {context,sheets,spreadsheet} = reportSheet(file);
    const vendors = spreadsheet.insertSheet('vendors');
    vendors.grid.push(['Name','PAN/VAT No.','Address','Custom Formula'],['Legacy','123','Town',2]);
    vendors.formulas.set('2:4','=1+1');
    const submit = rows => context.upsertReport_({reportKey:'vendors',rows});
    assert.equal(submit([{id:'legacy',name:'Legacy',pan_vat_no:'123'}]).success,true);
    assert.equal(vendors.grid.length,2);
    assert.equal(vendors.grid[1][2],'Town');
    assert.equal(vendors.grid[1][3],'=1+1');
    assert.equal(submit([{id:'new',name:'Name only'}]).success,true);
    assert.equal(submit([{id:'new',name:'Updated name'}]).success,true);
    assert.equal(vendors.grid.length,3);
    assert.equal(vendors.grid[2][0],'Updated name');
    assert.equal(sheets.has('Vendors'),false,'reuse existing lowercase tab');

    const ledger = spreadsheet.insertSheet('Vendor Ledger');
    ledger.grid.push(['Vendor ID','Vendor Name','Address','Contact No','Purchased','Paid Amount','Due Amount'],['legacy','Legacy','Town','01234',0,0,0]);
    for (let i=0;i<2;i++) {
      assert.equal(context.upsertReport_({reportKey:'vendor-ledger',rows:[{id:'legacy',vendor_id:'legacy',vendor_name:'Legacy',total_purchased_amount:'100.00',total_paid_amount:'20.00',due_amount:'80.00'}]}).success,true);
      assert.equal(ledger.grid.length,2);
      assert.deepEqual(ledger.grid[1].slice(2,7),['Town','01234',100,20,80]);
    }
  });

  test(`${file}: decimal and date normalization passes but a dropped write fails`, () => {
    const {context,sheets} = reportSheet(file);
    const request = {reportKey:'courses',rows:[{id:'c',course_name:'Course',total_fee:'500.00',created_at:'2026-09-23T10:00:00.987Z'}]};
    assert.equal(context.upsertReport_(request).data.verifiedRows,1);
    const sheet = sheets.get('Courses');
    assert.equal(sheet.grid[1][sheet.grid[0].indexOf('Total Fee')],500);
    sheet.dropWrites = true;
    request.rows[0].total_fee = '501.00';
    assert.throws(() => context.upsertReport_(request),/verification failed for Courses row 2, column Total Fee/);
  });
}
