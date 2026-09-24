/* KCMT desktop migration/report-only endpoints. Included in code.gs/code.js.
 * Do not deploy this file alongside code.gs: it is its source copy. */
function findSheetCaseInsensitive_(name) {
  var matches = SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function(sheet) { return sheet.getName().toLowerCase() === name.toLowerCase(); });
  if (matches.length > 1) throw new Error('Ambiguous sheet name: ' + name);
  return matches[0] || null;
}
function readOnlyImportAdmin_(request) {
  var sheet = findSheetCaseInsensitive_('Users');
  if (!sheet) throw new Error('Existing Users sheet is required');
  var values=sheet.getDataRange().getValues(), headers=values.shift()||[];
  var user=values.map(function(row){var record={};headers.forEach(function(h,i){record[h]=row[i];});return record;}).find(function(record){return String(record.Username||'').toLowerCase()===String(request.username||'').trim().toLowerCase() && String(record.Status||'Active').toLowerCase()==='active' && verifyUserPassword_(request.password,record['Password Hash']);});
  if (!user || String(user.Role||'').toUpperCase()!=='ADMIN') throw new Error('An existing administrator account is required for initial import');
  // Intentionally no authenticateUser(), audit writes, sheet initialization,
  // password upgrade, last-login update, or session creation in this read path.
  return user;
}
function exportAllData_(request) {
  readOnlyImportAdmin_(request);
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var supported=PRODUCTION_SHEET_NAMES.map(function(name){return name.toLowerCase();});
  var sheets=ss.getSheets().filter(function(sheet){return supported.indexOf(sheet.getName().toLowerCase())>=0;}).map(function(sheet){
    var values=sheet.getDataRange().getValues(), headers=(values.shift()||[]).map(String);
    if(headers.some(function(h,i){return h && headers.indexOf(h)!==i;}))throw new Error('Duplicate headers: '+sheet.getName());
    var rows=values.map(function(cells,index){
      var row={_row:index+2};headers.forEach(function(header,i){
        var value=cells[i];
        if(Object.prototype.toString.call(value)==='[object Date]') {
          var pattern=/^time$/i.test(header)?'HH:mm:ss':/date|birth/i.test(header)&&!/created|updated|submitted|transaction/i.test(header)?'yyyy-MM-dd':'yyyy-MM-dd HH:mm:ss';
          value=Utilities.formatDate(value,ss.getSpreadsheetTimeZone(),pattern);
        }
        if(header)row[header]=value;
        else if(value!==''&&value!=null)throw new Error('Unnamed data column in '+sheet.getName());
      });return row;
    }).filter(function(row){return Object.keys(row).some(function(k){return k!=='_row'&&row[k]!==''&&row[k]!=null;});});
    return {name:sheet.getName(),headers:headers,count:rows.length,rows:rows};
  });
  return jsonResponse(true,'Read-only snapshot exported',{version:1,spreadsheetId:ss.getId(),exportedAt:new Date().toISOString(),sheets:sheets});
}
function isUnderDriveRoot_(entry,rootId) {
  var queue=[entry],seen={};
  while(queue.length){var item=queue.shift(),id=item.getId();if(id===rootId)return true;if(seen[id])continue;seen[id]=true;var parents=item.getParents();while(parents.hasNext())queue.push(parents.next());}
  return false;
}
function personRoot_(entity) {
  if(entity==='Students')return getStudentsDriveFolder();
  if(entity==='Staff')return getStaffDriveFolder();
  throw new Error('Invalid person entity');
}
function readPersonFile_(request) {
  readOnlyImportAdmin_(request);
  var root=personRoot_(request.entity),file=DriveApp.getFileById(String(request.fileId||''));
  if(!isUnderDriveRoot_(file,root.getId()))throw new Error('File is outside the configured person root');
  if(file.getSize()>20*1024*1024)throw new Error('Historical file exceeds 20 MB: '+file.getName());
  return jsonResponse(true,'File read',{fileName:file.getName(),mimeType:file.getMimeType(),base64:Utilities.base64Encode(file.getBlob().getBytes())});
}
function uploadPersonFile_(request) {
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    var entity=String(request.entity||'').trim();
    entity=entity.toLowerCase()==='staff'?'Staff':entity.toLowerCase()==='students'?'Students':entity;
    var encoded=String(request.base64||request.data||'').replace(/^data:[^,]*,/,'');
    var root=personRoot_(entity),identifier=String(request.identifier||'').trim(),name=String(request.fullName||'').trim();
    if(!identifier||!name||(!request.folderOnly&&(!request.fileName||!encoded||!request.fileHash)))throw new Error('Missing person/file identity');
    if(!request.folderOnly&&['photo','document'].indexOf(String(request.mediaType||'').toLowerCase())<0)throw new Error('Invalid document type');
    var bytes=Utilities.base64Decode(encoded);
    if(!request.folderOnly&&(!bytes.length||bytes.length>20*1024*1024))throw new Error('File must be at most 20 MB');
    var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+(b<0?b+256:b).toString(16)).slice(-2);}).join('');
    if(!request.folderOnly&&hash!==request.fileHash)throw new Error('File hash mismatch');
    var properties=PropertiesService.getScriptProperties();
    var folderKey='KCMT_PERSON_'+entity+'_'+identifier;
    var supplied=String(request.folderId||properties.getProperty(folderKey)||'');
    var idMatch=supplied.match(/(?:\/folders\/)([\w-]+)/);
    if(idMatch)supplied=idMatch[1];
    var folder;
    if(supplied){folder=DriveApp.getFolderById(supplied);if(folder.getId()===root.getId()||!isUnderDriveRoot_(folder,root.getId()))throw new Error('Person folder is outside configured root');}
    else {
      var desired=name+' - '+identifier,existing=root.getFoldersByName(desired),legacy=root.getFoldersByName(identifier+' - '+name);
      folder=existing.hasNext()?existing.next():legacy.hasNext()?legacy.next():root.createFolder(desired);
    }
    properties.setProperty(folderKey,folder.getId());
    var photoFolder=getOrCreateChildFolder_(folder,'Photo'),documentsFolder=getOrCreateChildFolder_(folder,'Documents');
    if(request.folderOnly)return jsonResponse(true,'Person folders ready',{folderId:folder.getId()});
    var target=request.mediaType==='photo'?photoFolder:documentsFolder;
    // Stable remote filename makes a retry safe even if upload succeeded but
    // the client lost the response or SQLite metadata update failed.
    var remoteName=hash+'--'+String(request.fileName),matches=target.getFilesByName(remoteName);
    var file=matches.hasNext()?matches.next():target.createFile(Utilities.newBlob(bytes,request.mimeType||'application/octet-stream',remoteName));
    file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
    return jsonResponse(true,'File stored',{fileId:file.getId(),url:file.getUrl(),folderId:folder.getId(),fileName:request.fileName,fileHash:hash});
  } finally {lock.releaseLock();}
}
