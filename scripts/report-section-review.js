// Isolated renderer review: real Reports DOM and animation, fake remote API.
// No college records or live Google endpoints are accessed.
const {app,BrowserWindow} = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {Database}=require('../electron/database');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-reports-ui-'));
app.setPath('userData',temporary);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:1280,height:900,webPreferences:{offscreen:true,backgroundThrottling:false}});
  await win.webContents.session.enableNetworkEmulation({offline:true});
  const frame=path.join(temporary,'frame.html');
  fs.writeFileSync(frame,'<!doctype html><html><body></body></html>');
  await win.loadFile(frame);
  const run=code=>win.webContents.executeJavaScript(code);
  const config=await Database.prototype.reportConfig.call({pool:{query:async()=>[[]]}});
  config.endpoint='https://script.google.com/macros/s/test/exec';
  const page=fs.readFileSync(path.join(__dirname,'../frontend/pages/reports.html'),'utf8');
  const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const markup=page.replace(/<script>[\s\S]*?<\/script>/,'');
  await run(`document.body.innerHTML=${JSON.stringify(markup)};`);
  await run(fs.readFileSync(path.join(__dirname,'../frontend/js/report-submission.js'),'utf8')+';void 0;');
  await run(`
    window.review={config:${JSON.stringify(config)},calls:[],hold:false,pending:[],failKey:'',authFail:false,historyFail:false,history:[],subscriptions:0};
    window.kumakhReportCredentials={username:'test',password:'test'};
    window.kumakhApp={onReportProgress(){review.subscriptions++;return()=>review.subscriptions--;}};
    window.kumakhApi={
      getReportConfig:async()=>({success:true,data:review.config}),
      getReportSubmissions:async()=>{if(review.historyFail)throw Error('History offline');return{success:true,data:review.history};},
      authenticateReports:async()=>review.authFail?{success:false,message:'Sign-in offline'}:{success:true,data:{sessionToken:'test',endpoint:review.config.endpoint}},
      getReportPreview:async payload=>{
        const result={success:true,data:{report:review.config.reports.find(r=>r.key===payload.reportKey),dateFrom:payload.dateFrom,dateTo:payload.dateTo,rows:[{id:'test'}],count:1}};
        return review.hold?new Promise(resolve=>review.pending.push(()=>resolve(result))):result;
      },
      submitReport:async payload=>{
        review.calls.push(payload.report.key);
        if(payload.report.key===review.failKey)throw Error('Simulated transport failure');
        return{success:true,sheet:payload.report.sheets[0],rows:payload.rows.length};
      },
      retryReport:async()=>{review.calls.push('retry');if(review.holdRetry)await new Promise(resolve=>review.releaseRetry=resolve);return{success:true,sheet:'Courses',rows:1};}
    };void 0;
  `);
  await run(script);
  await run('initializeReportsPage()');
  const checks=[];
  async function check(name,expression){assert.equal(await run(expression),true,name);checks.push(name);}
  const preview=()=>run('document.getElementById("reportForm").onsubmit({preventDefault(){}})');
  const submit=()=>run('document.getElementById("submitReportButton").onclick()');
  await run('document.getElementById("selectAllReports").click()');
  await preview();
  await check('complete report expands to all 29 unique sections','document.querySelectorAll(".preview-report-card").length===29 && !document.getElementById("submitReportButton").disabled');
  await run('document.getElementById("reportFrom").value="2026-01-01";document.getElementById("reportFrom").dispatchEvent(new Event("input",{bubbles:true}))');
  await check('date change invalidates preview','document.getElementById("submitReportButton").disabled && !document.querySelector(".preview-report-card")');
  await run('document.getElementById("reportTo").value="2025-01-01"');
  await preview();
  await check('reversed dates cannot submit','document.getElementById("submitReportButton").disabled && document.getElementById("reportMessage").textContent.includes("valid dates")');
  await run('document.getElementById("reportTo").value="2026-12-31";review.hold=true;window.oldPreview=document.getElementById("reportForm").onsubmit({preventDefault(){}});void 0;');
  await run('document.getElementById("clearReports").click();document.querySelector("input[value=courses]").click();review.hold=false;');
  await preview();
  await run('review.pending.splice(0).forEach(resolve=>resolve());window.oldPreview');
  await check('late previews cannot overwrite latest selection','document.querySelectorAll(".preview-report-card").length===1 && document.getElementById("reportPreview").textContent.includes("Course Report")');
  await run('review.authFail=true');
  await submit();
  await check('failed sign-in sends no reports and releases buttons','review.calls.length===0 && !document.getElementById("submitReportButton").disabled && document.getElementById("reportSubmissionDialog").dataset.state==="failed"');
  await run('document.getElementById("reportSubmissionDialog").close();review.authFail=false;document.getElementById("selectAllReports").click()');
  await preview();
  await run('window.firstSubmit=document.getElementById("submitReportButton").onclick();window.secondSubmit=document.getElementById("submitReportButton").onclick();void 0;');
  await run('Promise.all([window.firstSubmit,window.secondSubmit])');
  await check('duplicate Submit sends each section once','review.calls.length===29 && new Set(review.calls).size===29');
  await check('success animation and progress complete','document.getElementById("reportSubmissionDialog").dataset.state==="success" && document.getElementById("reportSubmissionProgress").style.width==="100%"');
  await check('progress listeners are released','review.subscriptions===0');
  await check('controls recover after success','!document.getElementById("reportFrom").disabled && !document.getElementById("submitReportButton").disabled');
  await run('document.getElementById("reportSubmissionDialog").close();document.getElementById("clearReports").click();document.querySelector("input[value=courses]").click();document.querySelector("input[value=vendor-report]").click();review.calls=[];review.failKey="courses";');
  await preview();
  await submit();
  await check('one thrown request does not skip other selected reports','review.calls.length===3 && review.calls.includes("vendors") && review.calls.includes("vendor-ledger")');
  await check('partial failures display all section outcomes','document.getElementById("reportSubmissionDialog").dataset.state==="failed" && document.querySelectorAll(".submission-result-line").length===3');
  await run('document.getElementById("reportSubmissionDialog").close();review.failKey="";review.historyFail=true;');
  await submit();
  await check('history failure preserves success and releases controls','document.getElementById("reportSubmissionDialog").dataset.state==="success" && !document.getElementById("submitReportButton").disabled && document.getElementById("reportMessage").textContent.includes("history could not refresh")');
  await run(`document.body.innerHTML=${JSON.stringify(markup)};`);
  await run('initializeReportsPage()');
  await check('initial history failure does not disable preview','typeof document.getElementById("reportForm").onsubmit==="function" && document.getElementById("reportMessage").textContent.includes("history could not load")');
  await run(`document.body.innerHTML=${JSON.stringify(markup)};review.historyFail=false;review.history=[{id:'failed-1',report_name:'Courses',status:'Failed'},{id:'failed-2',report_name:'Vendors',status:'Failed'}];review.calls=[];review.holdRetry=true;`);
  await run('initializeReportsPage()');
  await run('document.querySelectorAll(".retry-report")[0].click();void 0;');
  await run('document.querySelectorAll(".retry-report")[1].click();void 0;');
  await check('retry prevents simultaneous submissions','review.calls.length===1 && document.getElementById("reportFrom").disabled');
  await run('review.releaseRetry();new Promise(resolve=>setTimeout(resolve,30))');
  await check('retry completes and releases progress listeners and controls','document.getElementById("reportSubmissionDialog").dataset.state==="success" && review.subscriptions===0 && !document.getElementById("reportFrom").disabled');
  console.log(JSON.stringify({passed:checks.length,checks},null,2));
  win.destroy();
}).then(()=>app.exit(0)).catch(error=>{console.error(error.stack);app.exit(1);});
