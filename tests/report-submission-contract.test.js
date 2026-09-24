const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {Database} = require('../electron/database');
const reportSheet = require('./helpers/report-sheet');

const date = '2026-09-23';
const records = {
  Courses: {id:'course',course_name:'Cooking',duration:'1 month',total_fee:100},
  Students: {id:'student',registration_number:'REG-1',full_name:'Student',course_id:'course',registration_fee:20,training_course_fee:100,discount:0},
  Staff: {id:'staff',employee_id:'EMP-1',full_name:'Staff',address:'Staff address',father_name:'Father',basic_salary:500},
  Vendors: {id:'vendor',name:'Vendor',pan_vat_no:'123',address:'Town',contact_no:'0123456',email:'vendor@example.test'},
  Expenses: {id:'expense',name:'Supplies',amount:12,expense_date:date},
  Purchases: {id:'purchase',vendor_id:'vendor',invoice_no:'INV-1',purchase_date:date,grand_total:100,paid_amount:20,due_amount:80,discount:0,tax:0},
  PurchaseItems: {id:'purchase-item',purchase_id:'purchase',item_name:'Rice',quantity:2,unit_price:50,amount:100},
  Payroll: {id:'payroll',employee_id:'EMP-1',payroll_month:'2026-09',basic_salary:500,normal_working_days:26,days_worked:26,earned_salary:500,total_earning:500,net_salary:500,total_paid:0,due_salary:500},
  Inventory: {id:'inventory',item_name:'Rice',quantity:2,unit:'kg'},
  InventoryTransactions: {id:'movement',inventory_id:'inventory',quantity:2,transaction_type:'IN',created_at:date},
  CafeCategories: {id:'category',name:'Drinks'},
  CafeMenu: {id:'menu',name:'Tea',category_id:'category',price:10},
  CafeTables: {id:'table',table_no:'1',tableName:'Window',capacity:4},
  CafeCustomers: {id:'customer',name:'Customer',phone:'01234',credit_limit:100},
  CafeSales: {id:'sale',customer_id:'customer',customer_name:'Customer',sale_date:date,total_bill:30,paid_amount:0,due_amount:30,payment_method:'Credit'},
  CafeRecipes: {id:'recipe',name:'Tea Recipe',menu_item_id:'menu',menu_item_name:'Tea'},
  CafeRecipeItems: {id:'ingredient',recipe_id:'recipe',inventory_id:'inventory',quantity:1},
  StudentPayments: {id:'student-payment',student_id:'student',student_name:'Student',payment_date:date,amount:10},
  VendorPayments: {id:'vendor-payment',vendor_id:'vendor',vendor_name:'Vendor',payment_date:date,paid_amount:15},
  StaffPayments: {id:'staff-payment',employee_id:'EMP-1',employee_name:'Staff',payment_date:date,paid_amount:25},
  DueReceived: {id:'receipt',customer_id:'customer',customer_name:'Customer',receipt_date:date,received_amount:5},
};
// Each section must persist its business data, not merely report a row count.
const expected = {
  students: {'Full Name':'Student','Registration Number':'REG-1'},
  'student-ledger': {'Student Name':'Student','Total Paid Amount':10},
  staff: {'Full Name':'Staff','Personal Address':'Staff address',"Father's Name":'Father'},
  courses: {'Course Name':'Cooking','Total Fee':100},
  vendors: {Name:'Vendor','PAN/VAT No.':'123','Contact No':'0123456'},
  'vendor-ledger': {'Vendor Name':'Vendor','Address':'Town','Total Purchased Amount':100,'Total Paid Amount':35},
  'vendor-payments': {'Vendor ID':'vendor','Amount':15},
  'cafe-sales': {'Customer ID':'customer','Total Bill':30},
  'credit-customers': {'Customer Name':'Customer','Phone Number':'01234'},
  'credit-customer-ledger': {'Customer ID':'customer','Total Received Amount':5},
  expenses: {'Expense Name':'Supplies',Amount:12},
  purchases: {'Vendor ID':'vendor','Vendor Name':'Vendor','Subtotal':100,'Total Amount':100},
  inventory: {'Item Name':'Rice','Current Stock':2},
  payroll: {'Payroll ID':'payroll','Employee Name':'Staff','Net Salary':500},
  'student-payments': {'Student ID':'student',Amount:10},
  'customer-payments': {'Customer ID':'customer',Amount:5},
  'due-received': {'Customer ID':'customer','Received Amount':5},
  'credit-sales': {'Customer ID':'customer','Due Amount':30},
  'staff-payments': {'Employee ID':'EMP-1',Amount:25},
  'cafe-tables': {'Table No':'1','Table Name':'Window'},
  'cafe-menu': {'Item Name':'Tea','Category Name':'Drinks','Selling Price':10},
  'cafe-categories': {'Category Name':'Drinks'},
  'cafe-daily-sales': {'Total Sales':30,Transaction:1},
  'purchase-items': {'Purchase ID':'purchase','Item Name':'Rice',Rate:50},
  'inventory-transactions': {'Item ID':'inventory','Item Name':'Rice',Quantity:2},
  'cafe-recipes': {'Recipe ID':'recipe','Menu Item ID':'menu'},
  'cafe-recipe-items': {'Recipe ID':'recipe','Inventory Item ID':'inventory','Inventory Item Name':'Rice',Quantity:1},
  'payroll-summary': {'Employee ID':'EMP-1','Total Earnings':500,'Total Paid':25},
  'payment-out': {'Payee ID':'vendor','Paid Amount':15},
};

for (const file of ['code.gs','code.js']) test(`${file}: every submission section persists local records and retries without duplicates`,async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-report-contract-'));
  const db = new Database(path.join(directory,'report.db'),{seed:false,initializePermissions:false});
  const originalFetch = global.fetch;
  const {context,sheets} = reportSheet(file);
  try {
    await db.open();
    for (const [table,record] of Object.entries(records)) {
      const defaults = Object.fromEntries(Object.entries(require('../database/columns.json')[table]).filter(([,spec]) => spec.scale !== undefined).map(([field]) => [field,0]));
      const row = {...defaults,...record};
      if (['PurchaseItems','InventoryTransactions','CafeRecipes','CafeRecipeItems'].includes(table)) {
        const columns = await db.tableColumns(table);
        const stored = {...row, data_json:JSON.stringify(row)};
        if (columns.includes('created_at')) stored.created_at = date;
        const fields = Object.keys(stored).filter(key => columns.includes(key));
        await db.pool.query(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,fields.map(key => stored[key]));
      } else await db.save(table,row);
    }
    global.fetch = async (_url,options) => {
      const request = JSON.parse(options.body);
      const result = request.action === 'uploadPersonFile'
        ? {success:true,data:{folderId:'folder',photoFolderId:'photo',documentsFolderId:'docs'}}
        : context.upsertReport_(request);
      return {ok:true,json:async () => result};
    };
    const config = await db.reportConfig();
    assert.deepEqual(config.reports.find(r => r.key === 'vendor-report').package,['vendors','vendor-ledger']);
    assert.equal(config.reports.filter(r => !r.package).length,Object.keys(expected).length);
    const problems = [];
    for (const report of config.reports.filter(r => !r.package)) {
      const payload = {reportKey:report.key,dateFrom:date,dateTo:date,sessionToken:'test'};
      const result = await db.submitReport(payload);
      if (!result.success) { problems.push(`${report.key}: ${result.message}`); continue; }
      const sheet = sheets.get(result.sheet);
      const firstCount = sheet.grid.length;
      assert.ok(firstCount > 1,`${report.key} has records`);
      assert.equal(result.data.verifiedRows,firstCount-1,report.key);
      assert.match(result.sheetUrl,/^https:\/\/docs.google.com\/spreadsheets\/d\/report-test\/edit#gid=\d+$/);
      for (const [header,value] of Object.entries(expected[report.key])) {
        const column = sheet.grid[0].indexOf(header);
        const actual = sheet.grid[1][column];
        if (typeof value === 'number' ? Number(actual) !== value : String(actual) !== value) problems.push(`${report.key}.${header}: ${JSON.stringify(actual)} != ${JSON.stringify(value)}`);
      }
      const retry = await db.submitReport(payload);
      assert.equal(retry.success,true,`${report.key}: ${retry.message}`);
      assert.equal(sheet.grid.length,firstCount,`${report.key} duplicated`);
    }
    assert.deepEqual(problems,[]);
  } finally {
    global.fetch = originalFetch;
    await db.pool.end();
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
