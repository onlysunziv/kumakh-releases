const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {documentLinks} = require('../electron/person-files');
const urls = ['https://drive.google.com/file/d/first/view', 'https://drive.google.com/file/d/second/view'];
const documents = urls.map((url, index) => ({fileName:`file-${index}.pdf`, documentType:'document', driveFileId:index?'second':'first', url, localPath:'C:/private/document.pdf'}));

test('desktop document export contains only deduplicated Drive links', () => {
  const expected=urls.map(url=>url+'?usp=drivesdk').join('\n');
  assert.equal(documentLinks(documents),expected);
  assert.equal(documentLinks(JSON.stringify(documents)),expected);
  assert.equal(documentLinks(expected),expected);
  assert.equal(documentLinks([...documents,documents[0]]),expected);
  assert.equal(documentLinks(['https://example.com/file','C:/private/file.pdf','data:image/png;base64,AAAA','function upload() {}',null]),'');
  assert.equal(documentLinks(null),'');
});

for(const file of ['code.gs','code.js'])for(const person of [
  {sheet:'Students',key:'students',idHeader:'Registration Number',idField:'registration_number',identifier:'REG-1'},
  {sheet:'Staff',key:'staff',idHeader:'Employee ID',idField:'employee_id',identifier:'EMP-1'},
])test(`${file} ${person.sheet}: Documents cells overwrite legacy metadata with links and preserve other columns`,()=>{
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  let grid=[[person.idHeader,'Full Name','Documents','Record ID'],[person.identifier,'Test Person',JSON.stringify(documents),'person']];
  const sheet={
    getName:()=> person.sheet, getLastRow:()=>grid.length, getLastColumn:()=>grid[0].length,
    getRange:(r,c,n,m)=>({
      getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>grid[r-1+i]?.[c-1+j]??'')),
      setValues:values=>values.forEach((row,i)=>{grid[r-1+i]||=[];row.forEach((v,j)=>{grid[r-1+i][c-1+j]=v;});}),
    }),
  };
  const context=vm.createContext({
    findSheetCaseInsensitive_:()=>sheet,
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet}),flush(){}},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    Utilities:{getUuid:()=> 'submission-test'},
    formatSheet_(){},formatReportSheet_(){},writeAuditLog_(){},
    jsonResponse:(success,message,data)=>({success,message,data}),
  });
  vm.runInContext(source.slice(source.indexOf('  function vendorReportIdentity_'),source.indexOf('  function writeAuditLog_')),context);
  const expected=urls.join('\n');
  for(const value of [documents,JSON.stringify(documents),expected]) {
    assert.equal(context.upsertReport_({reportKey:person.key,rows:[{id:'person',[person.idField]:person.identifier,full_name:'Test Person',Documents:value}]}).success,true);
    assert.equal(grid.length,2);
    assert.deepEqual(grid[1],[person.identifier,'Test Person',expected,'person']);
  }
  assert.equal(context.reportDocumentLinks_([{fileId:'drive-id'},documents[0],documents[0]]),'https://drive.google.com/file/d/drive-id/view\n'+urls[0]);
  assert.equal(context.reportDocumentLinks_(['function upload() {}','data:application/pdf;base64,AAAA','https://evil.example/drive.google.com/file/d/test']), '');
});
