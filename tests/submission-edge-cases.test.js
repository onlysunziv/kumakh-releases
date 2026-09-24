const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {Database} = require('../electron/database');
const reportSheet = require('./helpers/report-sheet');

test('submission validates dates, remote confirmations, offline failures and corrupt retries',async () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-submission-edges-'));
  const db=new Database(path.join(directory,'test.db'),{seed:false,initializePermissions:false});
  const original=global.fetch;
  try {
    await db.open();
    await db.save('Courses',{id:'course',courseName:'Course',duration:'1 month',totalFee:100});
    const preview=await db.reportPreview({reportKey:'courses'});
    for (const dates of [{dateFrom:'2026-10-02',dateTo:'2026-10-01'},{dateFrom:'2026-02-30'}, {dateTo:'not-a-date'}]) await assert.rejects(db.reportPreview({reportKey:'courses',...dates}),/valid report dates/);
    await assert.rejects(db.submitReport({...preview,rows:'bad',sessionToken:'test'}),/records are invalid/);
    for (const body of [null,[],{success:true,data:{sheet:'Staff',rows:1}},{success:true,data:{sheet:'Courses',rows:0,requestedRows:1}},{success:true,data:{sheet:'Courses',rows:1,verifiedRows:0}}]) {
      global.fetch=async()=>({ok:true,json:async()=>body});
      const result=await db.submitReport({...preview,sessionToken:'test'});
      assert.equal(result.success,false);
      const [[saved]]=await db.pool.query('SELECT status FROM ReportSubmissions WHERE id=?',[result.submissionId]);
      assert.equal(saved.status,'Failed');
    }
    let calls=0;
    global.fetch=async()=>{calls++;throw new Error('fetch failed: offline');};
    const offline=await db.submitReport({...preview,sessionToken:'test'});
    assert.equal(offline.success,false); assert.equal(calls,2);
    await db.pool.query('UPDATE ReportSubmissions SET rows_json=? WHERE id=?',['{broken',offline.submissionId]);
    await assert.rejects(db.retryReport({submissionId:offline.submissionId,sessionToken:'test'}),/could not be read/);
    assert.equal(calls,2,'corrupt retries must never be sent as empty success');
    global.fetch=async()=>({ok:true,status:200,text:async()=>'<html>Login required</html>'});
    assert.equal((await db.submitReport({...preview,sessionToken:'test'})).success,false);
  } finally {global.fetch=original;await db.pool.end();fs.rmSync(directory,{recursive:true,force:true});}
});

for (const entity of ['Students','Staff']) test(`${entity}: submission uses previewed people only and rejects deleted records`,async () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-preview-people-'));
  const db=new Database(path.join(directory,'test.db'),{seed:false,initializePermissions:false});
  const original=global.fetch;
  try {
    await db.open();
    const record=id=>entity==='Staff'?{id,employee_id:'EMP-'+id,full_name:id,basic_salary:100}:{id,registration_number:'REG-'+id,full_name:id,registration_fee:0,training_course_fee:100,discount:0};
    await db.save(entity,record('first'));
    const reportKey=entity==='Staff'?'staff':'students';
    const preview=await db.reportPreview({reportKey});
    await db.save(entity,record('second'));
    const sent=[];
    global.fetch=async(_url,options)=>{
      const body=JSON.parse(options.body);sent.push(body);
      return {ok:true,json:async()=>body.action==='uploadPersonFile'?{success:true,data:{folderId:'folder',photoFolderId:'photo',documentsFolderId:'docs'}}:{success:true,data:{sheet:entity,rows:body.rows.length}}};
    };
    assert.equal((await db.submitReport({...preview,sessionToken:'test'})).success,true);
    assert.deepEqual(sent.find(body=>body.action==='upsertReport').rows.map(row=>row.id),['first']);
    sent.length=0;
    assert.equal((await db.submitReport({...preview,rows:[],sessionToken:'test'})).success,true);
    assert.equal(sent.length,1,'empty preview must not upload any people');
    assert.equal(sent[0].rows.length,0);
    await db.pool.query(`DELETE FROM ${entity} WHERE id=?`,['first']);
    sent.length=0;
    const deleted=await db.submitReport({...preview,sessionToken:'test'});
    assert.equal(deleted.success,false);assert.match(deleted.message,/no longer exists/);assert.equal(sent.length,0);
  } finally {global.fetch=original;await db.pool.end();fs.rmSync(directory,{recursive:true,force:true});}
});

for(const file of ['code.gs','code.js']) test(`${file}: malformed input fails before mutating sheets`,()=>{
  const {context,sheets}=reportSheet(file);
  for(const rows of [undefined,null,'bad',[null],[123],[[]]]) assert.equal(context.upsertReport_({reportKey:'vendors',rows}).success,false);
  assert.equal(sheets.size,0);
});
