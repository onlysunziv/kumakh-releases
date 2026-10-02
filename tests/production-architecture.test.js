const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Database } = require('../electron/database');
const { importSnapshot,setupStatus,readSetting,verifyPassword } = require('../electron/initial-import');
const { activeMedia, fileRoot } = require('../electron/person-files');
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
    let rows=await activeMedia(db,table,'person');assert.equal(rows.length,3);for(const row of rows){assert.ok(!path.isAbsolute(row.local_path));assert.ok(row.local_path.startsWith(`${table.toLowerCase()}/`));assert.ok(fs.existsSync(path.resolve(fileRoot(db),row.local_path)));}
    await db.request(action,{...person,fullName:'Renamed Person',passportPhoto:media('photo.png','new-photo')});
    rows=await activeMedia(db,table,'person');assert.equal(rows.length,3);assert.equal(rows.filter(row=>row.media_type==='document').length,2);
    const uploaded=[];let fail=true,posted;
    global.fetch=async(_url,options)=>{const request=JSON.parse(options.body);if(request.action==='uploadPersonFile'){
      if(request.folderOnly)return {ok:true,json:async()=>({success:true,data:{folderId:'person-folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder'}})};
      uploaded.push(request.fileName);if(fail&&request.fileName==='two.png')throw new Error('Simulated disconnect');
      const fileId='drive-'+request.fileName.replace(/[^a-z0-9_-]/gi,'-');
      return {ok:true,json:async()=>({success:true,data:{fileId,url:`https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,folderId:'person-folder',fileHash:request.fileHash}})};
    }posted=request;return {ok:true,json:async()=>({success:true,data:{sheet:table.toLowerCase(),rows:request.rows.length}})};};
    const reportKey=table==='Students'?'students':'staff';
    const progress=[];
    const first=await db.request('submitReport',{reportKey,sessionToken:'test-session'},{onReportProgress:event=>progress.push(event)});assert.equal(first.success,false);assert.equal(posted,undefined);
    assert.equal(progress[0].stage,'preparing');assert.ok(progress.some(event=>event.stage==='documents'));assert.ok(!progress.some(event=>event.stage==='saving'));
    assert.ok(progress.some(event=>event.stage==='folders'&&new RegExp(table==='Students'?'REG-1':'EMP-1').test(event.detail)));
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

for(const table of ['Students','Staff'])test(`${table}: missing media is identified, other records submit, and retry succeeds after reselection`,()=>fixture(async(db)=>{
  const originalFetch=global.fetch;
  const reportRequests=[];
  const driveRequests=[];
  const media={fileName:'missing-photo.png',mimeType:'image/png',base64:Buffer.from('replacement photo').toString('base64')};
  const common=table==='Students'
    ? {registrationFee:0,trainingCourseFee:100,discount:0}
    : {basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  const missing=table==='Students'
    ? {id:'missing',registrationNumber:'REG-MISSING',fullName:'Missing Media',...common,passportPhoto:media}
    : {id:'missing',employeeId:'EMP-MISSING',fullName:'Missing Media',...common,passportPhoto:media};
  const complete=table==='Students'
    ? {id:'complete',registrationNumber:'REG-COMPLETE',fullName:'Complete Record',...common}
    : {id:'complete',employeeId:'EMP-COMPLETE',fullName:'Complete Record',...common};
  try {
    await db.request(action,missing);
    await db.request(action,complete);
    const {fileRoot}=require('../electron/person-files');
    const [savedMedia]=await db.pool.query("SELECT local_path FROM StudentMedia WHERE entity_table=? AND entity_id='missing' AND active=1",[table]);
    fs.rmSync(path.resolve(fileRoot(db),savedMedia[0].local_path));
    await db.pool.query(`UPDATE ${table} SET passport_photo=? WHERE id='missing'`,[JSON.stringify('https://drive.google.com/file/d/unavailable-drive-photo/view')]);
    global.fetch=async(_url,options)=>{
      const request=JSON.parse(options.body);
      if(request.action==='readPersonFile')return {ok:true,json:async()=>({success:false,message:'The existing Drive media is missing or inaccessible.',data:{error:'PERSON_MEDIA_UNAVAILABLE'}})};
      if(request.action==='uploadPersonFile') {
        driveRequests.push(request);
        return {ok:true,json:async()=>({success:true,data:{folderId:'person-folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder',fileId:'drive-photo',url:'https://drive.google.com/file/d/drive-photo/view',fileHash:request.fileHash}})};
      }
      reportRequests.push(request);
      return {ok:true,json:async()=>({success:true,data:{sheet:table,rows:request.rows.length,requestedRows:request.rows.length,verifiedRows:request.rows.length}})};
    };
    const reportKey=table==='Students'?'students':'staff';
    const partial=await db.request('submitReport',{reportKey,sessionToken:'test-session'});
    assert.equal(partial.success,false);
    assert.equal(partial.partial,true);
    assert.equal(partial.code,'PERSON_MEDIA_MISSING');
    assert.match(partial.message,new RegExp(`${table==='Students'?'REG-MISSING':'EMP-MISSING'} / missing-photo\\.png`));
    assert.equal(driveRequests.length,0);
    assert.equal(reportRequests.length,1);
    assert.equal(reportRequests[0].rows.length,1);
    assert.equal(reportRequests[0].rows[0].id,'complete');

    await db.request(action,missing);
    const retried=await db.request('retryReport',{submissionId:partial.submissionId,sessionToken:'test-session'});
    assert.equal(retried.success,true,retried.message);
    assert.equal(reportRequests.at(-1).rows.length,2);
    assert.match(reportRequests.at(-1).rows.find(row=>row.id==='missing')['Passport Size Photo'],/drive\.google\.com\/file\/d\/drive-photo/);
  } finally {global.fetch=originalFetch;}
}));

for(const table of ['Students','Staff'])test(`${table}: synced media reuses a confirmed Drive link when its local file is absent`,()=>fixture(async(db)=>{
  const originalFetch=global.fetch;
  const common=table==='Students'
    ? {id:'synced',registrationNumber:'REG-SYNCED',fullName:'Synced Record',registrationFee:0,trainingCourseFee:100,discount:0}
    : {id:'synced',employeeId:'EMP-SYNCED',fullName:'Synced Record',basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  const photo={fileName:'passport.jpg',mimeType:'image/jpeg',base64:Buffer.from('synced photo').toString('base64')};
  const existingDriveUrl='https://drive.google.com/file/d/existing-drive-photo/view';
  try {
    await db.request(action,{...common,passportPhoto:photo});
    const {fileRoot,digest}=require('../electron/person-files');
    const [rows]=await db.pool.query("SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id='synced' AND active=1",[table]);
    const localPath=path.resolve(fileRoot(db),rows[0].local_path);
    const hash=digest(fs.readFileSync(localPath));
    fs.rmSync(localPath);
    await db.pool.query(
      "UPDATE StudentMedia SET drive_file_id=?,drive_url=?,file_hash=?,uploaded_hash=?,upload_status='UPLOADED_TO_DRIVE',drive_folder_id=NULL WHERE id=?",
      ['existing-drive-photo',existingDriveUrl,hash,hash,rows[0].id],
    );
    const requests=[];
    global.fetch=async(_url,options)=>{
      const request=JSON.parse(options.body);
      requests.push(request);
      if(request.action==='uploadPersonFile')return {ok:true,json:async()=>({success:true,data:{folderId:'person-folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder'}})};
      return {ok:true,json:async()=>({success:true,data:{sheet:table,rows:request.rows.length,requestedRows:request.rows.length,verifiedRows:request.rows.length}})};
    };
    const reportKey=table==='Students'?'students':'staff';
    const result=await db.request('submitReport',{reportKey,sessionToken:'test-session'});
    assert.equal(result.success,true,result.message);
    assert.equal(requests.filter(request=>request.action==='uploadPersonFile').length,0);
    const report=requests.find(request=>request.action==='upsertReport');
    assert.equal(report.rows.length,1);
    assert.match(report.rows[0]['Passport Size Photo'],/drive\.google\.com\/file\/d\/existing-drive-photo/);
  } finally {global.fetch=originalFetch;}
}));

for(const table of ['Students','Staff'])test(`${table}: missing local files recover matching legacy Drive links without uploading`,()=>fixture(async(db)=>{
  const originalFetch=global.fetch;
  const common=table==='Students'
    ? {id:'legacy-links',registrationNumber:'REG-LINKS',fullName:'Legacy Links',registrationFee:0,trainingCourseFee:100,discount:0}
    : {id:'legacy-links',employeeId:'EMP-LINKS',fullName:'Legacy Links',basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  const photo={fileName:'portrait.jpg',mimeType:'image/jpeg',base64:Buffer.from('portrait').toString('base64')};
  const document={fileName:'identity.pdf',mimeType:'application/pdf',base64:Buffer.from('identity').toString('base64')};
  try {
    await db.request(action,{...common,passportPhoto:photo,documents:[document]});
    const {fileRoot}=require('../electron/person-files');
    const [rows]=await db.pool.query("SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id='legacy-links' AND active=1",[table]);
    for(const row of rows) fs.rmSync(path.resolve(fileRoot(db),row.local_path));
    const photoUrl='https://drive.google.com/file/d/legacy-photo/view';
    const documentUrl='https://drive.google.com/file/d/legacy-document/view';
    await db.pool.query(
      `UPDATE ${table} SET passport_photo=?,documents=? WHERE id=?`,
      [JSON.stringify(photoUrl),JSON.stringify([{fileName:'identity.pdf',url:documentUrl}]),'legacy-links'],
    );
    const requests=[];
    global.fetch=async(_url,options)=>{
      const request=JSON.parse(options.body);
      requests.push(request);
      if(request.action==='readPersonFile') {
        const entry=request.fileId==='legacy-photo'
          ? {fileName:'portrait.jpg',mimeType:'image/jpeg',base64:Buffer.from('portrait').toString('base64')}
          : {fileName:'identity.pdf',mimeType:'application/pdf',base64:Buffer.from('identity').toString('base64')};
        return {ok:true,json:async()=>({success:true,data:entry})};
      }
      return {ok:true,json:async()=>({success:true,data:{sheet:table,rows:1,requestedRows:1,verifiedRows:1}})};
    };
    const result=await db.request('submitReport',{reportKey:table==='Students'?'students':'staff',sessionToken:'test-session'});
    assert.equal(result.success,true,result.message);
    assert.equal(requests.filter(request=>request.action==='uploadPersonFile').length,0);
    const report=requests.find(request=>request.action==='upsertReport').rows[0];
    assert.match(report['Passport Size Photo'],/drive\.google\.com\/file\/d\/legacy-photo/);
    assert.match(report.Documents,/drive\.google\.com\/file\/d\/legacy-document/);
    assert.deepEqual(requests.filter(request=>request.action==='readPersonFile').map(request=>request.fileId).sort(),['legacy-document','legacy-photo']);
    const recovered=await db.pool.query("SELECT local_path,upload_status FROM StudentMedia WHERE entity_table=? AND entity_id='legacy-links' AND active=1",[table]);
    assert.ok(recovered[0].every(row=>!path.isAbsolute(row.local_path)&&fs.existsSync(path.resolve(fileRoot(db),row.local_path))&&row.upload_status==='SUBMITTED_TO_SHEETS'));
  } finally {global.fetch=originalFetch;}
}));

for(const table of ['Students','Staff'])test(`${table}: selected media is persisted before save and survives source deletion and database restart`,()=>fixture(async(db,directory)=>{
  const person=table==='Students'
    ? {id:'staged-person',registrationNumber:'REG-STAGED',fullName:'Staged Person',registrationFee:0,trainingCourseFee:100,discount:0}
    : {id:'staged-person',employeeId:'EMP-STAGED',fullName:'Staged Person',basicSalary:100};
  const source=path.join(directory,'selected-photo.png');
  const bytes=Buffer.from('selected media survives restart');
  fs.writeFileSync(source,bytes);
  const staged=await db.request('stagePersonMedia',{
    entityTable:table,
    mediaType:'photo',
    personIdentifier:table==='Students'?'REG-STAGED':'EMP-STAGED',
    media:{fileName:path.basename(source),mimeType:'image/png',base64:fs.readFileSync(source).toString('base64')},
  });
  assert.equal(staged.success,true);
  fs.rmSync(source);
  const stagedRow=(await db.pool.query('SELECT * FROM StudentMedia WHERE id=?',[staged.data.mediaId]))[0][0];
  const {fileRoot}=require('../electron/person-files');
  assert.ok(stagedRow.local_path.startsWith(`${table.toLowerCase()}/${table==='Students'?'REG-STAGED':'EMP-STAGED'}/`));
  assert.equal(fs.readFileSync(path.resolve(fileRoot(db),stagedRow.local_path)).toString(),bytes.toString());
  assert.equal(stagedRow.upload_status,'STAGED');
  assert.equal(stagedRow.active,0);
  await db.request(table==='Students'?'addStudent':'saveStaff',{...person,stagedMedia:[staged.data.mediaId]});
  const [saved]=await db.pool.query('SELECT * FROM StudentMedia WHERE id=?',[staged.data.mediaId]);
  assert.equal(saved[0].entity_id,person.id);
  assert.match(saved[0].local_path,new RegExp(`^${table.toLowerCase()}/(?:REG-STAGED|EMP-STAGED)/`));
  assert.equal(path.isAbsolute(saved[0].local_path),false);
  await db.pool.end();
  const restarted=new Database(db.pool.file,{seed:false,initializePermissions:false});
  await restarted.open();
  db.pool=restarted.pool;
  const media=await activeMedia(db,table,person.id);
  assert.equal(media.length,1);
  assert.equal(Buffer.from(media[0].base64||fs.readFileSync(path.resolve(fileRoot(db),media[0].local_path)).toString('base64'),'base64').toString(),bytes.toString());
}));

test('same-named document selections retain distinct content and paths',()=>fixture(async(db)=>{
  const person={id:'duplicates',registrationNumber:'REG-DUP',fullName:'Duplicate Files',registrationFee:0,trainingCourseFee:100,discount:0};
  const saved=[];
  for(const contents of ['first copy','second copy']) {
    const result=await db.request('stagePersonMedia',{
      entityTable:'Students',mediaType:'document',
      media:{fileName:'identity.pdf',mimeType:'application/pdf',base64:Buffer.from(contents).toString('base64')},
    });
    saved.push(result.data.mediaId);
  }
  await db.request('addStudent',{...person,stagedMedia:saved});
  const [rows]=await db.pool.query("SELECT * FROM StudentMedia WHERE entity_table='Students' AND entity_id=? AND media_type='document' AND active=1",[person.id]);
  assert.equal(rows.length,2);
  assert.notEqual(rows[0].local_path,rows[1].local_path);
  const {fileRoot}=require('../electron/person-files');
  assert.deepEqual(rows.map(row=>fs.readFileSync(path.resolve(fileRoot(db),row.local_path)).toString()).sort(),['first copy','second copy']);
}));

for(const table of ['Students','Staff'])test(`${table}: stale foreign absolute media paths are cleared without deleting media records`,()=>fixture(async(db)=>{
  const person=table==='Students'
    ? {id:'foreign-path',registrationNumber:'REG-FOREIGN',fullName:'Foreign Path',registrationFee:0,trainingCourseFee:100,discount:0}
    : {id:'foreign-path',employeeId:'EMP-FOREIGN',fullName:'Foreign Path',basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  await db.request(action,{...person,passportPhoto:{fileName:'kept.png',mimeType:'image/png',base64:Buffer.from('retained hash').toString('base64')}});
  const {fileRoot}=require('../electron/person-files');
  const [existingMedia]=await db.pool.query("SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id=?",[table,person.id]);
  fs.rmSync(path.resolve(fileRoot(db),existingMedia[0].local_path));
  const foreignPath=path.join('C:\\Users\\FormerUser\\AppData\\Roaming\\KUMAKH\\files','students','other-person','photo','missing.png');
  await db.pool.query("UPDATE StudentMedia SET local_path=?,drive_file_id=?,drive_url=?,uploaded_hash=NULL WHERE entity_table=? AND entity_id=?",[foreignPath,'retained-drive-id','https://drive.google.com/file/d/retained-drive-id/view',table,person.id]);
  const rows=await activeMedia(db,table,person.id);
  assert.equal(rows.length,1);
  assert.equal(rows[0].local_path,null);
  const [stored]=await db.pool.query("SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id=?",[table,person.id]);
  assert.equal(stored[0].local_path,null);
  assert.ok(stored[0].file_hash);
  assert.equal(stored[0].drive_file_id,'retained-drive-id');
  assert.equal(stored[0].active,1);
}));

for(const table of ['Students','Staff'])test(`${table}: missing media can be found and repaired without changing other records`,()=>fixture(async(db)=>{
  const person=table==='Students'
    ? {id:'repair-person',registrationNumber:'REG-REPAIR',fullName:'Repair Person',registrationFee:0,trainingCourseFee:100,discount:0}
    : {id:'repair-person',employeeId:'EMP-REPAIR',fullName:'Repair Person',basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  await db.request(action,{...person,passportPhoto:{fileName:'original.png',mimeType:'image/png',base64:Buffer.from('original').toString('base64')}});
  const {fileRoot}=require('../electron/person-files');
  const [media]=await db.pool.query("SELECT * FROM StudentMedia WHERE entity_table=? AND entity_id=? AND active=1",[table,person.id]);
  fs.rmSync(path.resolve(fileRoot(db),media[0].local_path));
  const validation=await db.request('getMissingPersonMedia');
  assert.equal(validation.data.missing,1);
  assert.equal(validation.data.items[0].personId,table==='Students'?'REG-REPAIR':'EMP-REPAIR');
  assert.equal(validation.data.items[0].personName,'Repair Person');
  assert.equal(validation.data.items[0].mediaType,'photo');
  const repaired=await db.request('repairPersonMedia',{
    mediaId:media[0].id,
    media:{fileName:'reselected.png',mimeType:'image/png',base64:Buffer.from('reselected').toString('base64')},
  });
  assert.equal(repaired.success,true);
  assert.equal(repaired.data.fileName,'reselected.png');
  const after=await db.request('getMissingPersonMedia');
  assert.equal(after.data.missing,0);
  assert.equal(after.data.ready,1);
}));

for(const table of ['Students','Staff'])test(`${table}: Drive lock contention is retried without a redundant folder request`,()=>fixture(async(db)=>{
  const originalFetch=global.fetch;
  const common=table==='Students'
    ? {id:'busy',registrationNumber:'REG-BUSY',fullName:'Busy Record',registrationFee:0,trainingCourseFee:100,discount:0}
    : {id:'busy',employeeId:'EMP-BUSY',fullName:'Busy Record',basicSalary:100};
  const action=table==='Students'?'addStudent':'saveStaff';
  const media={fileName:'portrait.png',mimeType:'image/png',base64:Buffer.from('portrait bytes').toString('base64')};
  try {
    await db.request(action,{...common,passportPhoto:media});
    const calls=[];
    global.fetch=async(_url,options)=>{
      const request=JSON.parse(options.body);
      calls.push(request);
      if(request.action==='uploadPersonFile'&&calls.filter(item=>item.action==='uploadPersonFile').length===1) {
        return {ok:true,json:async()=>({success:false,message:'Google Drive is busy.',data:{error:'DRIVE_BUSY',retryAfterMs:250}})};
      }
      if(request.action==='uploadPersonFile') {
        return {ok:true,json:async()=>({success:true,data:{folderId:'person-folder',fileId:'drive-photo',url:'https://drive.google.com/file/d/drive-photo/view',fileHash:request.fileHash}})};
      }
      return {ok:true,json:async()=>({success:true,data:{sheet:table,rows:1,requestedRows:1,verifiedRows:1}})};
    };
    const result=await db.request('submitReport',{reportKey:table==='Students'?'students':'staff',sessionToken:'test-session'});
    assert.equal(result.success,true,result.message);
    const mediaCalls=calls.filter(request=>request.action==='uploadPersonFile');
    assert.equal(mediaCalls.length,2);
    assert.ok(mediaCalls.every(request=>!request.folderOnly));
    assert.equal(mediaCalls[0].fileHash,mediaCalls[1].fileHash);
  } finally {global.fetch=originalFetch;}
}));
