const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['code.gs','code.js'])for(const scenario of ['existing','missing','trashed','root-denied','outside-root','lock-busy'])test(file+': person folder '+scenario,()=>{
  const children=new Map();
  const folder={getId:()=> 'existing-person',getName:()=> 'Existing Person',isTrashed:()=>scenario==='trashed'};
  const replacement={getId:()=> 'replacement'};
  const context=vm.createContext({
    LockService:{getScriptLock:()=>({tryLock:()=>scenario!=='lock-busy',releaseLock(){}})},
    personRoot_:()=>{return {getId:()=> 'root',getName:()=>{if(scenario==='root-denied')throw new Error('Access denied');return 'Root';},getFoldersByName:()=>({hasNext:()=>false}),createFolder:()=>replacement};},
    DriveApp:{getFolderById:id=>{assert.equal(id,'existing-person');if(scenario==='missing')throw new Error('Not found');return folder;}},
    isUnderDriveRoot_:()=>scenario!=='outside-root',
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
    Utilities:{base64Decode:()=>[],computeDigest:()=>[],DigestAlgorithm:{SHA_256:'sha256'}},
    getOrCreateChildFolder_:(_parent,name)=>{if(!children.has(name))children.set(name,{getId:()=>name+'-id'});return children.get(name);},
    jsonResponse:(success,message,data)=>({success,message,data}),
  });
  const source=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  vm.runInContext(source.slice(source.indexOf('function uploadPersonFile_(')),context);
  for(const entity of ['Staff','Students']){
    const run=()=>context.uploadPersonFile_({entity,identifier:'test',fullName:'Test',folderId:'existing-person',folderOnly:true});
    if(scenario==='lock-busy'){
      const response=run();
      assert.equal(response.success,false);
      assert.equal(response.data.error,'DRIVE_BUSY');
      assert.equal(response.data.retryAfterMs,1000);
      assert.equal(children.size,0);
      continue;
    }
    if(scenario==='root-denied'||scenario==='outside-root'){
      assert.throws(run,scenario==='root-denied'?/Drive root folder is missing or inaccessible/:/outside configured root/);
      assert.equal(children.size,0);continue;
    }
    const response=run();
    assert.equal(response.data.folderId,scenario==='existing'?'existing-person':'replacement');
    assert.equal(response.data.photoFolderId,'Photo-id');
    assert.equal(response.data.documentsFolderId,'Documents-id');
    assert.equal(children.size,2);
  }
});

for(const file of ['code.gs','code.js'])for(const scenario of ['authorized','expired-session','denied','missing-file','outside-root'])test(file+': read Drive media '+scenario,()=>{
  const context=vm.createContext({
    sessionUser_:()=>scenario==='expired-session'?null:{'User ID':'report-user'},
    permissionsForUser_:()=>scenario==='denied'?[]:['reports.view'],
    readOnlyImportAdmin_:()=>{throw new Error('Legacy admin credentials required');},
    personRoot_:()=>({getId:()=> 'configured-root'}),
    DriveApp:{getFileById:id=>{
      assert.equal(id,'drive-file');
      if(scenario==='missing-file')throw new Error('Not found');
      return {getSize:()=>5,getName:()=> 'portrait.jpg',getMimeType:()=> 'image/jpeg',getBlob:()=>({getBytes:()=>Buffer.from('photo')})};
    }},
    isUnderDriveRoot_:()=>scenario!=='outside-root',
    Utilities:{base64Encode:bytes=>Buffer.from(bytes).toString('base64')},
    jsonResponse:(success,message,data)=>({success,message,data}),
  });
  const source=fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8');
  const start=source.indexOf('function readPersonFile_(');
  const end=source.indexOf('function uploadPersonFile_(',start);
  vm.runInContext(source.slice(start,end),context);
  const response=context.readPersonFile_({sessionToken:'report-session',entity:'Students',fileId:'drive-file'});
  if(scenario==='authorized') {
    assert.equal(response.success,true,response.message);
    assert.equal(response.data.base64,Buffer.from('photo').toString('base64'));
    return;
  }
  if(scenario==='expired-session')assert.equal(response.data.error,'REPORT_AUTH_REQUIRED');
  else if(scenario==='denied')assert.equal(response.data.error,'ACCESS_DENIED');
  else assert.equal(response.data.error,'PERSON_MEDIA_UNAVAILABLE');
});
