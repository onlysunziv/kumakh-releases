const el = id => document.getElementById(id);
const api = window.kumakhApp;
const stages = ['schema','connecting','importing','files','validating','complete'];
function progress(update) {
  const current=stages.indexOf(update.stage);
  document.querySelectorAll('[data-stage]').forEach(item=>{const index=stages.indexOf(item.dataset.stage);item.classList.toggle('done',index<current);item.classList.toggle('active',index===current);});
  el('status').textContent=update.message;
}
function complete(report) {
  el('setupForm').hidden=true;el('results').hidden=false;
  el('counts').replaceChildren();
  for(const item of report.tables||[]){const line=document.createElement('div'),label=document.createElement('span'),count=document.createElement('strong');label.textContent=item.sheet;count.textContent=`${item.imported} imported · ${item.skipped} unchanged`;line.append(label,count);el('counts').append(line);}
  el('checks').textContent=`Database integrity: ${report.integrity}. Foreign keys: ${report.foreignKeys}.`;
  progress({stage:'complete',message:'Setup verified and saved. Future starts will use the local database.'});
}
api.onSetupProgress(progress);
api.setupStatus().then(status=>{if(!status.required)complete(status.report);else el('endpoint').value=status.endpoint||'';}).catch(error=>{el('status').textContent=error.message;});
el('setupForm').addEventListener('submit',async event=>{
  event.preventDefault();el('importButton').disabled=true;el('exitButton').disabled=true;el('status').className='';
  try{complete(await api.runInitialImport({endpoint:el('endpoint').value.trim(),username:el('username').value.trim(),password:el('password').value}));el('password').value='';}
  catch(error){el('status').className='error';el('status').textContent=`Unable to import existing data. ${error.message} Your local database has not been finalized. Check the connection and deployed backend, then retry.`;el('importButton').textContent='Retry Import';}
  finally{el('importButton').disabled=false;el('exitButton').disabled=false;}
});
el('continueButton').onclick=()=>api.continueToLogin();
el('exitButton').onclick=()=>api.exitSetup();
