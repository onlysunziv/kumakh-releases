const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {Database} = require('../electron/database');
const {importLegacyDatabase} = require('../electron/legacy-database');

test('legacy SQLite records migrate once, preserve cloud values, and retain relationships and originals', async () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-legacy-'));
  const legacy=new Database(path.join(directory,'kumakh.db'),{seed:false,initializePermissions:false});
  const cloud=new Database(path.join(directory,'replica.db'),{seed:false,initializePermissions:false});
  try {
    await legacy.open();await cloud.open();
    await legacy.save('Courses',{id:'shared',course_name:'Old local name',duration:'1 month',total_fee:20});
    await cloud.save('Courses',{id:'shared',course_name:'Cloud name',duration:'1 month',total_fee:25});
    await legacy.save('Students',{id:'local-student',registration_number:'REG-1',full_name:'Offline student',course_id:'shared',registration_fee:0,training_course_fee:20,discount:0});
    const original=fs.readFileSync(legacy.pool.file);
    const result=await importLegacyDatabase(cloud.pool,legacy.pool.file);
    assert.equal(result.inserted,1);assert.equal(result.existing,1);
    assert.ok(fs.existsSync(result.backup));
    assert.equal((await cloud.pool.query('SELECT course_name FROM Courses'))[0][0].course_name,'Cloud name');
    assert.equal((await cloud.pool.query('SELECT course_id FROM Students'))[0][0].course_id,'shared');
    assert.deepEqual(fs.readFileSync(legacy.pool.file),original);
    await cloud.pool.query("DELETE FROM Students WHERE id='local-student'");
    assert.equal(await importLegacyDatabase(cloud.pool,legacy.pool.file),null);
    assert.equal((await cloud.pool.query('SELECT * FROM Students'))[0].length,0,'a restart cannot resurrect a migrated record deleted later');
  } finally {await legacy.close();await cloud.close();fs.rmSync(directory,{recursive:true,force:true});}
});

test('legacy import rolls back every row on a conflicting unique identifier', async () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-legacy-conflict-'));
  const legacy=new Database(path.join(directory,'kumakh.db'),{seed:false,initializePermissions:false});
  const cloud=new Database(path.join(directory,'replica.db'),{seed:false,initializePermissions:false});
  try {
    await legacy.open();await cloud.open();
    await legacy.save('Courses',{id:'local-course',course_name:'Retained',duration:'1 month',total_fee:20});
    await legacy.save('Staff',{id:'local-staff',employee_id:'EMP-1',full_name:'Local',basic_salary:20});
    await cloud.save('Staff',{id:'cloud-staff',employee_id:'EMP-1',full_name:'Cloud',basic_salary:25});
    await assert.rejects(importLegacyDatabase(cloud.pool,legacy.pool.file),/UNIQUE/);
    assert.equal((await cloud.pool.query('SELECT * FROM Courses'))[0].length,0);
    assert.equal((await cloud.pool.query("SELECT * FROM SystemSettings WHERE key LIKE 'migration.legacy.%'"))[0].length,0);
    assert.equal((await legacy.pool.query('SELECT * FROM Courses'))[0].length,1);
  } finally {await legacy.close();await cloud.close();fs.rmSync(directory,{recursive:true,force:true});}
});
