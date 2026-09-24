const crypto = require('crypto');
const schema = require('../database/columns.json');
const { bindValue } = require('./sqlite-pool');
const key = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g,'');
const pick = (row, ...names) => { for(const name of names) { const found=Object.keys(row).find(field=>key(field)===key(name)); if(found!==undefined && row[found]!=='' && row[found]!=null)return row[found]; } return undefined; };
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex');
function verifyPassword(password, stored) { const parts=String(stored||'').split('$');const expected=parts.length===2?sha(parts[0]+String(password||'')):sha(password||'');return expected===parts.at(-1).toLowerCase(); }
const mapping = {
  Courses:{table:'Courses',id:['Course ID'],fields:{}},
  Students:{table:'Students',id:['Student ID','Registration Number'],fields:{course_name:['Course'],passport_photo:['Passport Size Photo'],student_folder:['Student Drive Folder'],training_course_fee:['Training/Course Fee'],student_contact:['Student Contact Number']}},
  Staff:{table:'Staff',id:['Staff ID','Employee ID'],fields:{address:['Personal Address'],passport_photo:['Passport Size Photo'],staff_folder:['Employee Drive Folder'],father_name:["Father's Name"],mother_name:["Mother's Name"],grandfather_name:["Grandfather's Name"],grandmother_name:["Grandmother's Name"]}},
  Vendors:{table:'Vendors',id:['Vendor ID'],fields:{name:['Name','Vendor Name'],pan_vat_no:['PAN/VAT No.','PAN No'],contact_no:['Contact No','Contact Number']}},
  'Vendor Ledger':{table:'VendorLedger',fields:{total_due_amount:['Due Amount']}},
  VendorPayments:{table:'VendorPayments',id:['Payment ID','Vendor Payment ID'],fields:{paid_amount:['Amount'],notes:['Remarks']}},
  StudentPayments:{table:'StudentPayments',id:['Payment ID'],fields:{}},
  StaffPayments:{table:'StaffPayments',id:['Payment ID'],fields:{paid_amount:['Amount'],notes:['Remarks']}},
  Expenses:{table:'Expenses',id:['Expense ID'],fields:{name:['Expense Name']}},
  Purchases:{table:'Purchases',id:['Purchase ID','Bill ID'],fields:{purchase_date:['Date'],invoice_no:['Invoice Number','Invoice No'],grand_total:['Grand Total','Total Amount']}},
  PurchaseItems:{table:'PurchaseItems',id:['Purchase Item ID'],fields:{purchase_id:['Purchase Bill ID','Bill ID'],unit_price:['Rate']}},
  Payroll:{table:'Payroll',id:['Payroll ID'],fields:{}},
  Inventory:{table:'Inventory',id:['Item ID','Item Code'],fields:{quantity:['Current Stock']}},
  InventoryTransactions:{table:'InventoryTransactions',id:['Transaction ID'],fields:{inventory_id:['Item ID'],created_at:['Date']}},
  CafeCategories:{table:'CafeCategories',id:['Category ID'],fields:{name:['Category Name']}},
  CafeMenu:{table:'CafeMenu',id:['Menu Item ID','Item ID'],fields:{name:['Item Name'],price:['Selling Price'],status:['Available']}},
  CafeTables:{table:'CafeTables',id:['Table ID','Table No'],fields:{}},
  CafeCustomers:{table:'CafeCustomers',id:['Customer ID'],fields:{name:['Customer Name'],phone:['Phone Number']}},
  CafeSales:{table:'CafeSales',id:['Sale ID'],fields:{sale_date:['Date']}},
  CreditSales:{table:'CreditSales',id:['Credit Sale ID'],fields:{}},
  DueReceived:{table:'DueReceived',id:['Receipt ID'],fields:{}},
  CustomerPayments:{table:'CustomerPayments',id:['Payment ID'],fields:{}},
  CustomerLedger:{table:'CustomerLedger',fields:{}},
  CafeDailySales:{table:'DayClosings',id:['Closing ID','Date'],fields:{closing_date:['Date']}},
  CafeRecipes:{table:'CafeRecipes',id:['Recipe ID'],fields:{name:['Menu Item Name']}},
  CafeRecipeItems:{table:'CafeRecipeItems',id:['Recipe Item ID'],fields:{inventory_id:['Inventory Item ID']}},
  Users:{table:'Users',id:['User ID'],fields:{role_id:['Role']}},
  Roles:{table:'Roles',id:['Role ID'],fields:{name:['Role Name']}},
  Permissions:{table:'Permissions',id:['Permission ID','Permission Key'],fields:{name:['Description']}},
  RolePermissions:{table:'RolePermissions',fields:{permission_id:['Permission Key']}},
  UserPermissions:{table:'UserPermissions',fields:{permission_id:['Permission Key']}},
  AuditLog:{table:'AuditLog',id:['Audit ID','Log ID'],fields:{created_at:['Timestamp','Date'],entity:['Module'],entity_id:['Record ID']}},
};
// Existing derived reports have no corresponding physical SQLite table. Preserve
// their complete source snapshots in SystemSettings; never double-post payments.
const snapshots = ['StudentLedger','PayrollSummary','PaymentOut'];
const financialRequired = { StudentPayments:['amount'],VendorPayments:['paid_amount'],StaffPayments:['paid_amount'],Purchases:['grand_total','paid_amount','due_amount'],PurchaseItems:['quantity','unit_price','amount'],CafeSales:['total_bill','paid_amount','due_amount'],CreditSales:['total_bill','paid_amount','due_amount'],DueReceived:['received_amount'],CustomerPayments:['amount'],Inventory:['quantity'],InventoryTransactions:['quantity'],Payroll:['net_salary','total_paid','due_salary'] };
async function setting(db,name,value) { await db.pool.query("INSERT INTO SystemSettings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",[name,JSON.stringify(value)]); }
async function readSetting(db,name) { const [rows]=await db.pool.query('SELECT value FROM SystemSettings WHERE key=?',[name]);try{return JSON.parse(rows[0]?.value||'null');}catch{return null;} }
async function integrity(db) { const [checks]=await db.pool.query('PRAGMA integrity_check'); const [foreign]=await db.pool.query('PRAGMA foreign_key_check');if(checks.length!==1||checks[0].integrity_check!=='ok'||foreign.length)throw new Error('Database integrity or foreign-key validation failed');return {integrity:'PASSED',foreignKeys:'PASSED'}; }
async function setupStatus(db) {
  await db.open();
  if(await readSetting(db,'initial_sheets_import_completed'))return {required:false,report:await readSetting(db,'initial_sheets_import_report')};
  // Upgrade protection: operational records take precedence over historical Sheets.
  const business=Object.keys(schema).filter(table=>!['Users','Roles','Permissions','RolePermissions','UserPermissions','SystemSettings'].includes(table));
  let records=0;
  for(const table of business){const [rows]=await db.pool.query(`SELECT COUNT(*) AS count FROM ${table}`);records+=rows[0].count;}
  const [users]=await db.pool.query("SELECT COUNT(*) AS count FROM Users WHERE id <> 'user-admin' OR username <> 'kcmtadmin'");records+=users[0].count;
  if(records){
    const report={status:'EXISTING_LOCAL',message:'Existing local database preserved; no Sheets import performed.',...await integrity(db)};
    await db.pool.transaction(async()=>{await setting(db,'initial_sheets_import_completed',true);await setting(db,'initial_sheets_import_report',report);await setting(db,'initial_sheets_import_version',1);await setting(db,'initial_sheets_import_date',new Date().toISOString());});
    return {required:false,report};
  }
  return {required:true,endpoint:(await db.reportConfig()).endpoint};
}
async function tableOrder(db,tables) {
  const ordered=[],pending=new Set(tables);
  while(pending.size){let progress=false;for(const table of pending){const [foreign]=await db.pool.query(`PRAGMA foreign_key_list(${table})`);if(foreign.some(fk=>pending.has(fk.table)&&fk.table!==table))continue;ordered.push(table);pending.delete(table);progress=true;}if(!progress)throw new Error('Cyclic import dependencies require review');}
  return ordered;
}
function prepareRows(source) {
  if(!source || source.version!==1 || !Array.isArray(source.sheets))throw new Error('Unsupported export response. Deploy the updated code.gs before importing.');
  const groups=new Map(),aliases=new Map();
  for(const sheet of source.sheets){
    const canonical=Object.keys(mapping).concat(snapshots).find(name=>key(name)===key(sheet.name));
    if(!canonical){if(sheet.rows?.length)throw new Error(`Unmapped sheet: ${sheet.name}`);continue;}
    if(!Array.isArray(sheet.rows)||!Array.isArray(sheet.headers))throw new Error(`Invalid exported sheet: ${sheet.name}`);
    if(sheet.count!==sheet.rows.length)throw new Error(`Source count mismatch: ${sheet.name}`);
    if(groups.has(canonical))throw new Error(`Multiple sheets match ${canonical}; resolve duplicate sheet names before importing`);
    groups.set(canonical,sheet);
  }
  for(const required of ['Users','Students','Staff'])if(!groups.has(required))throw new Error(`Required source sheet missing: ${required}`);
  const tables=new Map();
  for(const [sheetName,definition] of Object.entries(mapping)){
    const sheet=groups.get(sheetName);if(!sheet)continue;
    const rows=sheet.rows.map((original,index)=>{
      const row={};for(const column of Object.keys(schema[definition.table])){const value=pick(original,column,...(definition.fields[column]||[]));if(value!==undefined)row[column]=value;}
      const id=definition.table==='AuditLog' ? pick(original,...definition.id) : pick(original,'Record ID','id',...(definition.id||[]));
      if(schema[definition.table].id)row.id=String(id ?? `sheets-${key(sheetName)}-${sha(`${source.spreadsheetId}|${sheet.name}|${original._row||index+2}`).slice(0,24)}`);
      for(const required of financialRequired[definition.table]||[])if(row[required]===undefined)throw new Error(`Missing financial value ${sheet.name} row ${original._row||index+2}: ${required}`);
      if(definition.table==='Vendors'&&!id){
        const candidates=(groups.get('Vendor Ledger')?.rows||[]).filter(v=>key(pick(v,'Vendor Name','Name'))===key(row.name));
        if(candidates.length>1)throw new Error(`Ambiguous vendor identity: ${row.name}`);
        const ledgerId=pick(candidates[0]||{},'Vendor ID');if(ledgerId)row.id=String(ledgerId);
      }
      if(definition.table==='CafeSales'&&row.sale_date&&pick(original,'Time'))row.sale_date=String(row.sale_date).slice(0,10)+' '+String(pick(original,'Time')).slice(-8);
      if(schema[definition.table].data_json)row.data_json=JSON.stringify({...original, migrationSource:sheet.name, sourceRow:original._row||index+2});
      const lookups=[row.id,...(definition.id||[]).map(name=>pick(original,name)),row.registration_number,row.employee_id,row.name,row.course_name,row.permission_key].filter(value=>value!==undefined&&value!=='');
      if(!aliases.has(definition.table))aliases.set(definition.table,new Map());
      for(const value of lookups){const map=aliases.get(definition.table),k=String(value).trim().toLowerCase();if(map.has(k)&&map.get(k)!==row.id)map.set(k,null);else if(!map.has(k))map.set(k,row.id);}
      return row;
    });
    tables.set(definition.table,{sheet:sheet.name,rows});
  }
  const resolve=(table,value)=>{if(value==null||value==='')return null;const mapped=aliases.get(table)?.get(String(value).trim().toLowerCase());if(mapped===null)throw new Error(`Ambiguous ${table} reference: ${value}`);return mapped===undefined?String(value):mapped;};
  for(const [table,{rows}] of tables)for(const row of rows){
    if(table==='Students'&&!row.course_id&&row.course_name)row.course_id=resolve('Courses',row.course_name);
    for(const [column,parent] of Object.entries({course_id:'Courses',vendor_id:'Vendors',student_id:'Students',category_id:'CafeCategories',customer_id:'CafeCustomers',purchase_id:'Purchases',inventory_id:'Inventory',sale_id:'CafeSales',menu_id:'CafeMenu',recipe_id:'CafeRecipes',role_id:'Roles',permission_id:'Permissions',user_id:'Users'}))if(row[column]!==undefined)row[column]=resolve(parent,row[column]);
    if(table==='RolePermissions'||table==='UserPermissions')row.allowed=['true','1','yes'].includes(String(row.allowed).toLowerCase())?1:0;
  }
  return {tables,groups};
}
async function importSnapshot(db,source,onProgress=()=>{}, mediaLoader) {
  if(await readSetting(db,'initial_sheets_import_completed'))return await readSetting(db,'initial_sheets_import_report');
  const {tables,groups}=prepareRows(source);
  const order=await tableOrder(db,[...tables.keys()]);
  const report={status:'IMPORTING',version:1,sourceId:source.spreadsheetId,order,tables:[],snapshots:[],failed:0};
  try {
    await db.pool.transaction(async()=>{
      for(const table of order){
        const {sheet,rows}=tables.get(table);const [info]=await db.pool.query(`PRAGMA table_info(${table})`);const primary=info.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
        const entry={sheet,table,source:rows.length,imported:0,skipped:0,failed:0,financialTotals:{}};report.tables.push(entry);
        onProgress({stage:'importing',message:`Importing ${sheet}`,table,count:rows.length});
        for(const raw of rows){
          const row={...raw};
          for(const column of info){
            if(row[column.name]!==undefined)row[column.name]=bindValue(row[column.name],schema[table][column.name]);
            else if(column.dflt_value!=null)continue;
            else if(column.notnull){if(['created_at','updated_at'].includes(column.name))row[column.name]=source.exportedAt;else if(column.name==='data_json')row[column.name]='{}';else throw new Error(`Missing required ${table}.${column.name}`);}
          }
          if(primary.some(column=>row[column]==null||row[column]===''))throw new Error(`Missing primary key in ${table}`);
          const where=primary.map(column=>`${column}=?`).join(' AND ');
          const [existing]=await db.pool.query(`SELECT * FROM ${table} WHERE ${where}`,primary.map(column=>row[column]));
          if(existing.length){
            const different=Object.keys(row).filter(column=>!['data_json','created_at','updated_at'].includes(column)).some(column=>String(existing[0][column]??'')!==String(row[column]??''));
            if(different)throw new Error(`Existing ${table} record conflicts with import; no records overwritten`);
            entry.skipped++;
          } else {const names=Object.keys(row);await db.pool.query(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(()=>'?').join(',')})`,Object.values(row));entry.imported++;}
          const [copied]=await db.pool.query(`SELECT * FROM ${table} WHERE ${where}`,primary.map(column=>row[column]));
          for(const [column,value] of Object.entries(row))if(!['data_json','created_at','updated_at'].includes(column)&&String(copied[0][column]??'')!==String(value??''))throw new Error(`Value verification failed: ${table}.${column}`);
          for(const [column,definition] of Object.entries(schema[table]))if(definition.scale!==undefined && row[column]!=null){
            const units=value=>BigInt(String(bindValue(value,definition)).replace('.',''));
            const totals=entry.financialTotals[column]||{source:'0',destination:'0',scale:definition.scale};
            totals.source=String(BigInt(totals.source)+units(row[column]));totals.destination=String(BigInt(totals.destination)+units(copied[0][column]));entry.financialTotals[column]=totals;
          }
        }
        if(entry.imported+entry.skipped!==entry.source)throw new Error(`Count mismatch: ${table}`);
        for(const totals of Object.values(entry.financialTotals))if(totals.source!==totals.destination)throw new Error(`Financial totals differ: ${table}`);
      }
      for(const name of snapshots){const sheet=groups.get(name);if(sheet){await setting(db,`migration.source.${name}`,sheet);report.snapshots.push({sheet:name,source:sheet.rows.length,preserved:sheet.rows.length,storage:'SystemSettings'});}}
      // Retain source-only columns/identities even on tables without data_json.
      for(const [name,sheet] of groups)await setting(db,`migration.source.${name}`,sheet);
      // Validate application relationships that the legacy SQL schema does not
      // declare as foreign keys, without changing any source identifier.
      for(const [child,column,parent,parentColumn] of [
        ['StudentPayments','student_id','Students','id'],['VendorPayments','vendor_id','Vendors','id'],
        ['StaffPayments','employee_id','Staff','employee_id'],['CreditSales','customer_id','CafeCustomers','id'],
        ['DueReceived','customer_id','CafeCustomers','id'],['CustomerPayments','customer_id','CafeCustomers','id'],
      ]) {
        const [orphans]=await db.pool.query(`SELECT c.${column} FROM ${child} c LEFT JOIN ${parent} p ON p.${parentColumn}=c.${column} WHERE c.${column} IS NOT NULL AND c.${column}<>'' AND p.${parentColumn} IS NULL LIMIT 1`);
        if(orphans.length)throw new Error(`Unresolved relationship: ${child}.${column} → ${parent}`);
      }
      const [users]=await db.pool.query("SELECT id FROM Users WHERE lower(status)='active'");if(!users.length)throw new Error('Import has no active local login account');
      onProgress({stage:'files',message:'Saving historical student and staff files locally'});
      for(const table of ['Students','Staff'])for(const person of tables.get(table)?.rows||[])await importPersonFiles(db,table,person,mediaLoader);
      onProgress({stage:'validating',message:'Checking record counts, financial values, integrity and foreign keys'});
      Object.assign(report,await integrity(db),{status:'COMPLETED'});
      await setting(db,'initial_sheets_import_completed',true);await setting(db,'initial_sheets_import_date',new Date().toISOString());await setting(db,'initial_sheets_import_version',1);await setting(db,'initial_sheets_import_report',report);
    });
    return report;
  }catch(error){report.status='FAILED';report.failed=1;report.committed=0;error.migrationReport=report;throw error;}
}
function driveId(value){const text=String(value||'');if(/^[\w-]{20,}$/.test(text))return text;return text.match(/(?:\/d\/|[?&]id=|\/folders\/)([\w-]+)/)?.[1]||'';}
async function importPersonFiles(db,table,person,loader){
  const files=require('./person-files');
  const references=[];
  for(const [type,value] of [['photo',person.passport_photo],['document',person.documents]]){
    if(!value)continue;
    let parsed=files.parse(value,null);
    if(parsed==null)parsed=String(value).split(/[\n,]+/).map(url=>({url:url.trim()}));
    for(const entry of Array.isArray(parsed)?parsed:[parsed]){
      const item=typeof entry==='string'?{url:entry}:entry;
      if(item.base64)references.push({type,media:item});
      else {const id=driveId(item.driveFileId||item.fileId||item.id||item.url||item.downloadUrl);if(!id)throw new Error(`Unmapped ${table} file reference for ${person.id}`);if(!loader)throw new Error('Historical Drive files require an authenticated download');references.push({type,media:await loader(id,table),driveId:id,url:item.url||`https://drive.google.com/file/d/${id}/view`});}
    }
  }
  for(const entry of references){const saved=await files.saveFile(db,table,person.id,entry.type,entry.media,person.registration_number||person.employee_id);if(entry.driveId)await db.pool.query("UPDATE StudentMedia SET drive_file_id=?,drive_url=?,uploaded_hash=file_hash,upload_status='UPLOADED_TO_DRIVE' WHERE id=?",[entry.driveId,entry.url,saved.mediaId]);}
}
async function initialImport(db,credentials,onProgress){
  const status=await setupStatus(db);if(!status.required)return status.report;
  const endpoint=String(credentials.endpoint||status.endpoint||'');
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint))throw new Error('Enter the deployed Apps Script /exec URL');
  const call=async payload=>{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},signal:AbortSignal.timeout(120000),body:JSON.stringify({...payload,username:credentials.username,password:credentials.password})});const body=await response.json();if(!response.ok||!body.success)throw new Error(body.message||'Google Sheets export failed');return body.data;};
  onProgress({stage:'connecting',message:'Connecting to the read-only Google Sheets export'});
  const source=await call({action:'exportAllData'});
  const result=await importSnapshot(db,source,onProgress,(fileId,entity)=>call({action:'readPersonFile',fileId,entity}));
  await setting(db,'reports.appsScriptUrl',endpoint); // Store standard text value used by reportConfig.
  await db.pool.query('UPDATE SystemSettings SET value=? WHERE key=?',[endpoint,'reports.appsScriptUrl']);
  return result;
}
module.exports={mapping,snapshots,prepareRows,importSnapshot,initialImport,setupStatus,integrity,readSetting,setting,verifyPassword,driveId};
