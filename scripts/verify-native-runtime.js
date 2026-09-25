// Invoked by afterPack using the packaged executable. Only disposable data.
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const root = process.argv[2];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kumakh-packaged-native-'));
(async () => {
  for (const [moduleName, className] of [['sqlite-pool', 'SQLitePool'], ['turso-pool', 'TursoPool']]) {
    const Pool = require(path.join(root, 'electron', moduleName))[className];
    const file = path.join(directory, `${moduleName}.db`);
    let pool = new Pool(file, { seed: false }); await pool.ready;
    await pool.run("INSERT INTO Courses (id,course_name,total_fee,created_at,updated_at,data_json) VALUES ('fixture','Packaged runtime','5','2026-09-24','2026-09-24','{}')");
    await pool.end();
    pool = new Pool(file, { seed: false }); await pool.ready;
    assert.equal((await pool.all('SELECT id FROM Courses'))[0].id, 'fixture');
    await pool.end();
  }
  console.log('Native packaged database verification passed.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(directory, { recursive: true, force: true }));
