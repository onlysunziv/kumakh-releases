const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['code.gs','code.js'])for(const scenario of ['existing','missing','trashed','root-denied','outside-root'])test(file+': person folder '+scenario,()=>{
  const children=new Map();
  const folder={getId:()=> 'existing-person',getName:()=> 'Existing Person',isTrashed:()=>scenario==='trashed'};
  const replacement={getId:()=> 'replacement'};
  const context=vm.createContext({
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
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
