// Actual form opening, hit testing, and native text insertion in a disposable app.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Database } = require('../electron/database');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kcmt-form-focus-'));
app.setPath('userData', path.join(temporary, 'browser'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
let database;
app.whenReady().then(async () => {
  database = new Database(path.join(temporary, 'test.db'));
  await database.open();
  await database.request('saveCourse', { id:'course', courseName:'Test Course', duration:'1 month', totalFee:100 });
  await database.request('saveVendor', { id:'vendor', vendorName:'Test Vendor' });
  await database.request('addStudent', { id:'student', fullName:'Test Student', registrationNumber:'TEST-1', course:'Test Course', registrationFee:0, trainingCourseFee:100, discount:0 });
  await database.request('saveStaff', { id:'staff', employeeId:'EMP-1', employeeName:'Test Staff', department:'Kitchen', basicSalary:1000, status:'Working' });
  ipcMain.handle('review:api', (_event, action, payload) => database.request(action, payload));
  ipcMain.handle('review:page', (_event, name) => fs.readFileSync(path.join(__dirname, '../frontend/pages', path.basename(name)), 'utf8'));
  const win = new BrowserWindow({ show:false, width:1366, height:1000, webPreferences:{ offscreen:true, backgroundThrottling:false, preload:path.join(__dirname,'ui-review-preload.js'), sandbox:false } });
  win.webContents.session.enableNetworkEmulation({offline:true});
  const run = code => win.webContents.executeJavaScript(code);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const results = [];
  await win.loadFile(path.join(__dirname, '../frontend/index.html'));
  await wait(1000);
  async function typeInto(selector, label) {
    const hit=await run(`(() => {
      const el=document.querySelector(${JSON.stringify(selector)});if(!el)return {error:'missing field'};
      el.scrollIntoView({block:'center',behavior:'instant'});
      const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      const target=document.elementFromPoint(x,y);
      return {x,y,hit:target===el,blockedBy:target?.id||target?.className,readonly:el.readOnly,disabled:el.disabled,type:el.type};
    })()`);
    if(!hit.hit) { results.push({label,pass:false,...hit});return; }
    win.webContents.sendInputEvent({type:'mouseDown',x:Math.round(hit.x),y:Math.round(hit.y),button:'left',clickCount:1});
    win.webContents.sendInputEvent({type:'mouseUp',x:Math.round(hit.x),y:Math.round(hit.y),button:'left',clickCount:1});
    await wait(40);
    const focused=await run(`document.activeElement===document.querySelector(${JSON.stringify(selector)})`);
    if(focused)await run(`document.activeElement.select()`);
    const expected=hit.type==='number'?'123':'Typing test';
    await win.webContents.insertText(expected);
    const value=await run(`document.querySelector(${JSON.stringify(selector)}).value`);
    results.push({label,pass:focused&&value===expected,focused,value});
  }
  const scenarios=[
    {page:'students',add:'#addStudentButton',edit:'[data-student-edit-index]',close:'[data-add-student-modal-close]',field:'#studentFullName',other:'#studentAddress',search:'#studentSearch'},
    {page:'staff',add:'#addStaffButton',edit:'#staffTableBody [data-action="edit"]',close:'[data-staff-modal-close]',field:'#staffFullName',other:'#staffAddress',search:'#staffSearch'},
    {page:'vendors',add:'#openAddVendorButton',edit:'[data-vendor-action="edit"]',close:'#closeVendorModalButton',field:'#vendorName',other:'#vendorAddress',search:'#vendorSearch'},
  ];
  for(const s of scenarios) {
    await run(`loadPage(${JSON.stringify(s.page)})`);await wait(650);
    for(const mode of ['add','edit']) {
      await run(`document.querySelector(${JSON.stringify(s[mode])}).click()`);await wait(500);
      await typeInto(s.field,`${s.page} ${mode} name offline`);
      await typeInto(s.other,`${s.page} ${mode} address offline`);
      const editable=await run(`Array.from(document.querySelector(${JSON.stringify(s.field)}).closest('form').querySelectorAll('input,textarea')).filter(el=>!el.disabled&&!el.readOnly&&['text','tel','email','number','textarea','password','url'].includes(el.type)&&el.getClientRects().length).map((el,i)=>{el.dataset.focusReview='modal-'+i;return '[data-focus-review="modal-'+i+'"]'})`);
      for(const field of editable) await typeInto(field,s.page+' '+mode+' editable '+field);
      for (const kind of ['alert', 'confirm', 'prompt']) {
        await run(`document.querySelector(${JSON.stringify(s.field)}).focus(); window.dialogProbe=window.kumakhDialogs[${JSON.stringify(kind)}]('Focus check','Working'); void 0;`);
        await wait(60);
        await run(`document.querySelector('.app-message-dialog ${kind === 'alert' ? '[type="submit"]' : '[data-cancel]'}').click()`);
        const answer=await run('window.dialogProbe');
        results.push({label:s.page+' '+mode+' '+kind+' dismissal result',pass:answer===(kind==='alert'?true:kind==='prompt'?null:false)});
        const restored=await run(`document.activeElement===document.querySelector(${JSON.stringify(s.field)})`);
        results.push({label:s.page+' '+mode+' '+kind+' restores caret',pass:restored});
        await typeInto(s.field,`${s.page} ${mode} typing after ${kind}`);
      }
      // A delayed local/background request must not take the caret from the user.
      const focus=await run(`(() => {
        const field=document.querySelector(${JSON.stringify(s.field)});field.focus();
        field.select();
        const before=document.activeElement===field;
        window.releaseFocusProbe=window.kumakhLoading.begin();
        return {before,after:document.activeElement===field,active:document.activeElement?.id};
      })()`);
      results.push({label:`${s.page} ${mode} retains focus while loading`,pass:focus.before&&focus.after,...focus});
      await win.webContents.insertText('Still typing');
      const duringLoading=await run(`document.querySelector(${JSON.stringify(s.field)}).value`);
      await run('window.releaseFocusProbe()');
      await win.webContents.insertText(' after loading');
      const afterLoading=await run(`document.querySelector(${JSON.stringify(s.field)}).value`);
      results.push({label:`${s.page} ${mode} uninterrupted typing`,pass:duringLoading==='Still typing'&&afterLoading==='Still typing after loading'});
      await run(`document.querySelector(${JSON.stringify(s.close)}).click()`);await wait(500);
      await typeInto(s.search,`${s.page} ${mode} close restores page input`);
      await run(`(() => {const el=document.querySelector(${JSON.stringify(s.search)});el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    }
  }
  for(const kind of ['confirm','prompt']) {
    await run(`window.dialogProbe=window.kumakhDialogs[${JSON.stringify(kind)}]('Accept check','Working');void 0;`);
    await wait(100);
    await run(`document.querySelector('.app-message-dialog [type="submit"]').click()`);
    const answer=await run('window.dialogProbe');
    results.push({label:kind+' returns accepted value',pass:answer===(kind==='prompt'?'Working':true)});
  }
  // Inspect every currently editable text field on the remaining operational pages.
  for (const page of ['course','payments','salary','payment-out','purchases','expenses','cafe','settings']) {
    await run(`loadPage(${JSON.stringify(page)})`); await wait(450);
    const fields=await run(`Array.from(document.querySelectorAll('#pageContent input:not([type]),#pageContent input[type="text"],#pageContent input[type="search"],#pageContent input[type="email"],#pageContent textarea')).filter(el=>!el.disabled&&!el.readOnly&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map((el,i)=>{el.dataset.focusReview='field-'+i;return '[data-focus-review="field-'+i+'"]'})`);
    for(const field of fields) await typeInto(field,page+' visible field '+field);
  }
  // Exercise Staff's actual FileReader/save pipeline, not a hand-built API payload.
  await run(`loadPage('staff')`);await wait(500);
  await run(`(() => {
    document.getElementById('addStaffButton').click();
    const form=document.getElementById('staffForm');
    const values={fullName:'Document Test',address:'Test',mobileNumber:'9800000000',citizenshipNumber:'TEST',jobTitle:'Test',employeeId:'EMP-DOCUMENT-TEST',department:'Test',companyName:'Test',companyAddress:'Test',companyContactNo:'9800000000',joiningDate:'2026-09-22',basicSalary:'100'};
    for(const [name,value] of Object.entries(values))form.elements.namedItem(name).value=value;
    for(const name of ['gender','bloodGroup','maritalStatus'])form.elements.namedItem(name).selectedIndex=1;
    window.selectStaffTestFile=(name,type)=>{const dt=new DataTransfer();dt.items.add(new File(['test document '+name],name,{type}));const input=document.getElementById('staffDocumentUpload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));};
    selectStaffTestFile('bad.exe','application/octet-stream');
    document.getElementById('saveStaffButton').click();
  })()`);await wait(100);
  const blocked=await run(`document.getElementById('staffFormAlert').textContent.includes('Select valid documents')`);
  results.push({label:'Staff invalid attachment blocks save',pass:blocked});
  await run(`selectStaffTestFile('first.pdf','application/pdf');selectStaffTestFile('second.pdf','application/pdf');const input=document.getElementById('staffDocumentUpload');input.files=new DataTransfer().files;input.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('saveStaffButton').click();`);
  await wait(900);
  const [savedPeople]=await database.pool.query('SELECT id FROM Staff WHERE employee_id=?',['EMP-DOCUMENT-TEST']);
  const docs=savedPeople[0]?await require('../electron/person-files').activeMedia(database,'Staff',savedPeople[0].id):[];
  results.push({label:'Staff form saves both documents after repeated selection and picker cancel',pass:docs.filter(row=>row.media_type==='document').length===2});
  const oldFetch=global.fetch,uploaded=[];
  try {
    global.fetch=async(_,options)=>{
      const body=JSON.parse(options.body);
      if(body.action==='uploadPersonFile'){
        if(body.folderOnly)return {ok:true,json:async()=>({success:true,data:{folderId:'test-folder',photoFolderId:'photo-folder',documentsFolderId:'documents-folder'}})};
        uploaded.push(body.fileName);
        return {ok:true,json:async()=>({success:true,data:{fileId:'test-'+body.fileName,url:'https://drive.google.com/file/d/test-'+body.fileName+'/view',folderId:'test-folder',fileHash:body.fileHash}})};
      }
      return {ok:true,json:async()=>({success:true,data:{sheet:'Staff',rows:body.rows.length}})};
    };
    const submission=await database.request('submitReport',{reportKey:'staff',sessionToken:'test-only'});
    results.push({label:'Staff form documents reach report upload requests',pass:submission.success&&uploaded.includes('first.pdf')&&uploaded.includes('second.pdf')});
  }finally{global.fetch=oldFetch;}
  // Closing the real report dialog must release the browser's modal focus lock.
  await run(`sessionStorage.setItem('kumakhReportSession',JSON.stringify({sessionToken:'ui-test',endpoint:'ui-test'}));loadPage('reports')`);
  const reportFocus=await run(`(() => {
    const dialog=document.getElementById('reportSubmissionDialog');
    const animation=new window.KcmtReportSubmission(dialog);
    animation.start(1);
    animation.finish([{report:'Test',result:{success:false,message:'Test offline failure'}}]);
    document.getElementById('closeReportSubmissionDialog').click();
    const input=document.getElementById('reportFrom');input.focus();
    return !dialog.open&&document.activeElement===input;
  })()`);
  results.push({label:'report dialog close releases field focus',pass:reportFocus});
  fs.mkdirSync(path.join(__dirname,'../.ui-review'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../.ui-review/form-focus.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
  win.destroy();await database.pool.end();database=null;
  app.exit(results.some(row=>!row.pass)?1:0);
}).catch(async error=>{console.error(error);if(database)await database.pool.end();app.exit(1);});
