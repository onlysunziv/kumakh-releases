// Exercise editable form controls in a hidden renderer with an isolated database.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Database } = require('../electron/database');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'input-fields-ui-'));
app.setPath('userData', path.join(temporary, 'browser'));
let db;
app.whenReady().then(async () => {
  db = new Database(path.join(temporary, 'test.db'));
  await db.open();
  await db.request('saveCourse', { id:'course', courseName:'Test Course', duration:'1 month', totalFee:100 });
  await db.request('saveVendor', { id:'vendor', vendorName:'Test Vendor' });
  await db.request('addStudent', { id:'student', fullName:'Test Student', registrationNumber:'TEST-1', course:'Test Course', registrationFee:0, trainingCourseFee:100, discount:0 });
  await db.request('saveCafeCategory', { id:'category', categoryName:'Food' });
  await db.request('saveCafeCustomer', { id:'customer', customerName:'Test Customer', creditLimit:1000 });
  await db.request('saveStaff', { id:'staff', employeeId:'EMP-1', employeeName:'Test Staff', department:'Kitchen', basicSalary:1000, status:'Working' });
  await db.request('saveCafeTable', { tableNo:'C1' });
  ipcMain.handle('review:api', (_event, action, payload) => db.request(action, payload));
  ipcMain.handle('review:page', (_event, name) => fs.readFileSync(path.join(__dirname, '../frontend/pages', path.basename(name)), 'utf8'));
  const win = new BrowserWindow({ show:false, width:1366, height:900, webPreferences:{ offscreen:true, backgroundThrottling:false, preload:path.join(__dirname,'ui-review-preload.js'), sandbox:false } });
  const run = code => win.webContents.executeJavaScript(code);
  const results=[];
  for(const page of ['dashboard','course','students','staff','payments','salary','payment-out','purchases','expenses','vendors','reports','settings','cafe','login']) {
    await win.loadFile(path.join(__dirname, '../frontend', page==='cafe'?'pages/cafe.html':page==='login'?'login.html':'index.html'));
    if(!['cafe','login'].includes(page)) await run(`loadPage(${JSON.stringify(page)})`);
    await run('new Promise(resolve=>setTimeout(resolve,500))');
    if(page==='purchases')await run("document.getElementById('addItem').click()");
    const fields=await run(`(() => {
      // Reveal form panels for exhaustive coverage, including inactive wizard steps.
      document.querySelectorAll('dialog[open]').forEach(el=>el.close());
      const root=document.getElementById('pageContent')||document.body;
      return [...root.querySelectorAll('input,textarea,select')].map((el,index)=>{
        el.dataset.inputReview=String(index);
        return { index, id:el.id||el.name||String(index), type:el.type, readonly:el.readOnly, disabled:el.disabled, tag:el.tagName };
      });
    })()`);
    let checked=0;
    const skipped=[];
    for(const field of fields) {
      await run('new Promise(resolve=>window.kumakhLoading ? window.kumakhLoading.whenIdle(resolve) : resolve())');
      if(field.readonly||field.disabled||['hidden','submit','button','reset'].includes(field.type)) { skipped.push({id:field.id,reason:field.readonly?'calculated/read-only':field.disabled?'disabled':field.type}); continue; }
      const setup=await run(`(() => {
        const el=document.querySelector('[data-input-review="${field.index}"]');
        if(!el)return {skip:'re-rendered'};
        for(let parent=el;parent&&parent!==document.body;parent=parent.parentElement){parent.hidden=false;parent.classList.remove('d-none');parent.style.setProperty('display',parent===el?'inline-block':'block','important');parent.style.setProperty('visibility','visible','important'); if(parent.tagName==='DIALOG')parent.setAttribute('open','');}
        if(el.type==='file') {
          const transfer=new DataTransfer(); transfer.items.add(new File([new Uint8Array([137,80,78,71])],'input-test.png',{type:'image/png'}));
          el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));return {done:el.files.length===1};
        }
        if(el.tagName==='SELECT') {
          const option=[...el.options].find(option=>!option.disabled&&option.value);
          if(!option)return {skip:'no populated options'};
          el.value=option.value;el.dispatchEvent(new Event('change',{bubbles:true}));return {done:el.value===option.value};
        }
        if(['checkbox','radio'].includes(el.type)){el.checked=false;el.click();return {done:el.checked};}
        if(['date','month','time','datetime-local','color','range'].includes(el.type)) {
          const value=({date:'2026-09-18',month:'2026-09',time:'12:30','datetime-local':'2026-09-18T12:30',color:'#123456',range:el.min||'1'})[el.type];
          el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));return {done:el.value===value};
        }
        el.value='';el.focus();return {typing:document.activeElement===el, active:document.activeElement?.id, disabled:el.disabled, inert:!!el.closest('[inert]'), dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id), value:el.type==='number'?'2':el.type==='email'?'test@example.com':el.type==='url'?'https://example.com':'Test input'};
      })()`);
      if(setup.skip){skipped.push({id:field.id,reason:setup.skip});continue;}
      if(setup.typing) {
        await win.webContents.insertText(setup.value);
        setup.done=await run(`document.querySelector('[data-input-review="${field.index}"]')?.value === ${JSON.stringify(setup.value)}`);
      }
      if(!setup.done)throw new Error(`Input rejected on ${page}: ${field.id} (${field.type}); ${JSON.stringify(setup)}; actual=${await run(`document.querySelector('[data-input-review="${field.index}"]')?.value`)}`);
      checked++;
    }
    results.push({page,checked,skipped});
  }
  fs.mkdirSync(path.join(__dirname,'../.ui-review'),{recursive:true});
  fs.writeFileSync(path.join(__dirname,'../.ui-review/input-fields.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results.map(({page,checked,skipped})=>({page,checked,skipped:skipped.length})),null,2));
  win.destroy();await db.pool.end();db=null;app.quit();
}).catch(async error=>{console.error(error);if(db)await db.pool.end();app.exit(1);});
