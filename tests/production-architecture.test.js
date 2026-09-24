const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Database } = require('../electron/database');
const { importSnapshot,setupStatus,readSetting,verifyPassword } = require('../electron/initial-import');
const { activeMedia } = require('../electron/person-files');
const hash = value=>crypto.createHash('sha256').update(value).digest('hex');
const sheet = (name,rows)=>({name,headers:Object.keys(rows[0]||{}),count:rows.length,rows});
function snapshot() { return {version:1,spreadsheetId:'test-sheet',exportedAt:'2026-09-18 01:02:03',sheets:[
  sheet('Roles',[{'Role ID':'role-original','Role Name':'ADMIN'}]),
  sheet('Users',[{'User ID':'user-original',Username:'admin','Password Hash':'salt$'+hash('saltpassword'),Role:'ADMIN',Status:'Active'}]),
  sheet('Courses',[{'Course ID':'course-original','Course Name':'Cooking',Duration:'1 month','Total Fee':'100.50'}]),
  sheet('students',[{'Registration Number':'REG-001','Full Name':'Test Student',Course:'Cooking','Registration Fee':'10.00','Training/Course Fee':'100.50',Discount:'0.00'}]),
  sheet('staff',[{'Employee ID':'EMP-001','Full Name':'Test Staff','Basic Salary':'500.25'}]),
  sheet('StudentPayments',[{'Payment ID':'PAY-001','Student ID':'REG-001','Payment Date':'2026-09-18',Amount:'25.25'}]),
  sheet('Vendors',[{'Vendor ID':'V-1',Name:'Test Vendor'}]),
  sheet('Purchases',[{'Purchase ID':'P-1','Vendor ID':'V-1',Date:'2026-09-18','Invoice Number':'INV-1','Total Amount':'300.25','Paid Amount':'100.00','Due Amount':'200.25'}]),
  sheet('PurchaseItems',[{'Purchase Item ID':'PI-1','Purchase ID':'P-1','Item Name':'Rice',Quantity:'2',Rate:'150.125',Amount:'300.25'}]),
  sheet('PaymentOut',[{'Payment ID':'VP-original','Paid Amount':12,'Payment Type':'Vendor'}]),
]}; }
async function fixture(work) { const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-production-'));const db=new Database(path.join(directory,'database','kumakh.db'),{seed:false,initializePermissions:false});try{await db.open();await work(db,directory);}finally{await db.pool.end();fs.rmSync(directory,{recursive:true,force:true});} }

test('initial migration preserves identifiers, exact financial values, relationships, salted logins and restart marker',()=>fixture(async db=>{
  assert.equal((await setupStatus(db)).required,true);
  const progress=[];const report=await importSnapshot(db,snapshot(),state=>progress.push(state.stage));
  assert.equal(report.status,'COMPLETED');assert.equal(report.integrity,'PASSED');assert.equal(report.foreignKeys,'PASSED');
  assert.ok(report.order.indexOf('Courses')<report.order.indexOf('Students'));
  assert.ok(report.order.indexOf('Purchases')<report.order.indexOf('PurchaseItems'));
  const [payments]=await db.pool.query('SELECT * FROM StudentPayments');assert.equal(payments[0].id,'PAY-001');assert.equal(payments[0].student_id,'REG-001');assert.equal(payments[0].amount,'25.25');
  const [purchases]=await db.pool.query('SELECT * FROM Purchases');assert.equal(purchases[0].grand_total,'300.25');assert.equal(purchases[0].purchase_date,'2026-09-18');
  assert.equal((await setupStatus(db)).required,false);
  const again=await importSnapshot(db,{invalid:true});assert.equal(again.status,'COMPLETED');
  assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM StudentPayments'))[0][0].n,1);
  assert.equal((await readSetting(db,'migration.source.PaymentOut')).rows.length,1);
  const fetch=global.fetch;global.fetch=()=>{throw new Error('Unexpected network on local login');};
  try{assert.equal((await db.request('authenticateUser',{username:'admin',password:'password'})).data.userId,'user-original');}finally{global.fetch=fetch;}
  assert.equal(verifyPassword('wrong','salt$'+hash('saltpassword')),false);
}));

test('failed import rolls back all rows and marker; unknown financial values and relationships are not guessed',()=>fixture(async db=>{
  const source=snapshot();source.sheets.find(s=>s.name==='PurchaseItems').rows[0]['Purchase ID']='missing';
  await assert.rejects(importSnapshot(db,source),/FOREIGN KEY/);
  assert.equal(await readSetting(db,'initial_sheets_import_completed'),null);
  assert.equal((await db.pool.query('SELECT COUNT(*) AS n FROM Students'))[0][0].n,0);
  const bad=snapshot();delete bad.sheets.find(s=>s.name==='StudentPayments').rows[0].Amount;
  await assert.rejects(importSnapshot(db,bad),/Missing financial value/);
  await importSnapshot(db,snapshot());
}));

test('existing operational database is adopted without contacting or importing Sheets',()=>fixture(async db=>{
  await db.request('saveVendor',{id:'keep-me',vendorName:'Existing vendor'});
  const fetch=global.fetch;global.fetch=()=>{throw new Error('No network allowed');};
  try{const status=await setupStatus(db);assert.equal(status.required,false);assert.equal(status.report.status,'EXISTING_LOCAL');assert.equal((await db.request('getVendors')).data[0].id,'keep-me');}finally{global.fetch=fetch;}
}));

for(const table of ['Students','Staff'])test(`${table}: legacy embedded attachments are uploaded rather than creating only a folder`,()=>fixture(async(db)=>{
  const originalFetch=global.fetch;
  try {
    const person=table==='Staff'?{id:'legacy',employeeId:'LEGACY',fullName:'Legacy Person',basicSalary:100}:{id:'legacy',registrationNumber:'LEGACY',fullName:'Legacy Person',registrationFee:0,trainingCourseFee:100,discount:0};
    await db.request(table==='Staff'?'saveStaff':'addStudent',person);
    const media=(name,data)=>({name,mimeType:'image/png',data:Buffer.from(data).toString('base64')});
    await db.pool.query(`UPDATE ${table} SET passport_photo=?,documents=? WHERE id=?`,[JSON.stringify(media('photo.png','photo bytes')),JSON.stringify([media('document.png','document bytes')]),'legacy']);
    assert.equal((await activeMedia(db,table,'legacy')).length,0);
    const uploads=[];let report;
    global.fetch=async(_,options)=>{
      const body=JSON.parse(options.body);
      if(body.action==='uploadPersonFile') {
        if(body.folderOnly)return {ok:true,json:async()=>({success:true,data:{folderId:'folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder'}})};
        assert.equal(body.entity,table);
        assert.equal(Buffer.from(body.base64,'base64').toString(),body.mediaType==='photo'?'photo bytes':'document bytes');
        uploads.push(body.mediaType);
        return {ok:true,json:async()=>({success:true,data:{fileId:'file-'+body.mediaType,url:'https://drive.google.com/file/d/file-'+body.mediaType+'/view',folderId:'folder',fileHash:body.fileHash}})};
      }
      report=body;
      return {ok:true,json:async()=>({success:true,data:{sheet:table,rows:1}})};
    };
    const payload={reportKey:table==='Staff'?'staff':'students',sessionToken:'test'};
    const result=await db.request('submitReport',payload);
    assert.equal(result.success,true,result.message);
    assert.deepEqual(uploads.sort(),['document','photo']);
    assert.match(report.rows[0].Documents,/drive.google.com\/file\/d\/file-document/);
    assert.match(report.rows[0]['Passport Size Photo'],/drive.google.com\/file\/d\/file-photo/);
    assert.equal((await db.request('submitReport',payload)).success,true);
    assert.equal(uploads.length,2);
  } finally {global.fetch=originalFetch;}
}));

for(const table of ['Students','Staff'])test(`${table}: offline disk files, edit preservation, partial Drive retry, duplicate prevention and private report references`,()=>fixture(async(db,directory)=>{
  const originalFetch=global.fetch;global.fetch=()=>{throw new Error('Offline');};
  const media=(fileName,text)=>({fileName,mimeType:'image/png',base64:Buffer.from(text).toString('base64')});
  const person=table==='Students'?{id:'person',registrationNumber:'REG-1',fullName:'Test Person',registrationFee:0,trainingCourseFee:100,discount:0}:{id:'person',employeeId:'EMP-1',employeeName:'Test Person',basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  try {
    const staffMedia = table === 'Staff'
      ? (fileName, text) => ({fileName, name:fileName, mimeType:'image/png', data:Buffer.from(text).toString('base64')})
      : media;
    await db.request(action,{...person,passportPhoto:staffMedia('photo.png','photo'),documents:[staffMedia('one.png','one'),staffMedia('two.png','two')]});
    let rows=await activeMedia(db,table,'person');assert.equal(rows.length,3);for(const row of rows){assert.ok(fs.existsSync(row.local_path));assert.ok(row.local_path.startsWith(path.join(directory,'files',table.toLowerCase())));}
    await db.request(action,{...person,fullName:'Renamed Person',passportPhoto:media('photo.png','new-photo')});
    rows=await activeMedia(db,table,'person');assert.equal(rows.length,3);assert.equal(rows.filter(row=>row.media_type==='document').length,2);
    const uploaded=[];let fail=true,posted;
    global.fetch=async(_url,options)=>{const request=JSON.parse(options.body);if(request.action==='uploadPersonFile'){
      if(request.folderOnly)return {ok:true,json:async()=>({success:true,data:{folderId:'person-folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder'}})};
      uploaded.push(request.fileName);if(fail&&request.fileName==='two.png')throw new Error('Simulated disconnect');
      return {ok:true,json:async()=>({success:true,data:{fileId:'drive-'+request.fileName,url:'https://drive.google.com/file/d/drive-'+request.fileName+'/view?usp=drivesdk',folderId:'person-folder',fileHash:request.fileHash}})};
    }posted=request;return {ok:true,json:async()=>({success:true,data:{sheet:table.toLowerCase(),rows:request.rows.length}})};};
    const reportKey=table==='Students'?'students':'staff';
    const progress=[];
    const first=await db.request('submitReport',{reportKey,sessionToken:'test-session'},{onReportProgress:event=>progress.push(event)});assert.equal(first.success,false);assert.equal(posted,undefined);
    assert.equal(progress[0].stage,'preparing');assert.ok(progress.some(event=>event.stage==='documents'));assert.ok(!progress.some(event=>event.stage==='saving'));
    const before=uploaded.slice();fail=false;
    const retryProgress=[];
    assert.equal((await db.request('retryReport',{submissionId:first.submissionId,sessionToken:'test-session'},{onReportProgress:event=>retryProgress.push(event)})).success,true);
    assert.equal(retryProgress[0].stage,'preparing');assert.equal(retryProgress.at(-1).stage,'saving');assert.ok(retryProgress.some(event=>event.stage==='photos'));
    for(const file of before.filter(name=>name!=='two.png'))assert.equal(uploaded.filter(name=>name===file).length,1);
    assert.equal(uploaded.filter(name=>name==='two.png').length,2);
    assert.equal(typeof posted.rows[0].Documents,'string');
    assert.equal(posted.rows[0].Documents.split('\n').length,2);
    assert.ok(posted.rows[0]['Passport Size Photo'].includes('/file/d/'));
    assert.ok(posted.rows[0].Documents.split('\n').every(url=>url.includes('/file/d/') && url.includes('/view?usp=drivesdk')));
    assert.equal(/fileName|documentType|driveFileId|[{}\[\]]/.test(posted.rows[0].Documents),false);
    assert.equal(/base64|localPath|file_path|data:image/i.test(JSON.stringify(posted)),false);
    const count=uploaded.length;assert.equal((await db.request('submitReport',{reportKey,sessionToken:'test-session'})).success,true);assert.equal(uploaded.length,count);
    assert.ok((await activeMedia(db,table,'person')).every(row=>row.upload_status==='SUBMITTED_TO_SHEETS'));
    await db.request(action,{...person,fullName:'Renamed again'});
    assert.equal((await db.pool.query(`SELECT ${table==='Students'?'student_folder':'staff_folder'} AS folder FROM ${table}`))[0][0].folder,'person-folder');
    const listed=(await db.request(table==='Students'?'getStudents':'getStaff')).data[0];assert.ok(JSON.stringify(listed).includes(Buffer.from('new-photo').toString('base64')));
  } finally {global.fetch=originalFetch;}
}));
