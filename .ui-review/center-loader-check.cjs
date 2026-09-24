const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os');
const {pathToFileURL}=require('url');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kcmt-loader-center-'));
app.setPath('userData',path.join(directory,'profile'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async()=>{
  const base=pathToFileURL(path.join(process.cwd(),'frontend')+path.sep).href;
  const file=path.join(directory,'test.html');
  fs.writeFileSync(file,`<!doctype html><html><head><base href="${base}"><link rel="stylesheet" href="assets/vendor/bootstrap.min.css"><link rel="stylesheet" href="css/main.css"><link rel="stylesheet" href="css/ui-polish.css"></head><body><main style="padding:60px"><h1>Staff details</h1><label for="name">Full name</label><input class="form-control" id="name" style="max-width:350px"></main><script src="js/api.js"></script></body></html>`);
  const win=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{offscreen:true,backgroundThrottling:false,sandbox:false}});
  await win.loadFile(file);
  const results=[];
  for(const zoom of [1,.75,.5]){
    const result=await win.webContents.executeJavaScript(`(()=>{
      document.body.style.zoom=${zoom};
      const input=document.getElementById('name');input.value='';input.focus();
      window.release=window.kumakhLoading.begin();
      const overlay=document.getElementById('appSplash'),logo=overlay.querySelector('.kcmt-loader');
      const box=overlay.getBoundingClientRect(),r=logo.getBoundingClientRect(),field=input.getBoundingClientRect();
      return {zoom:${zoom},centered:Math.abs(r.left+r.width/2-innerWidth/2)<2&&Math.abs(r.top+r.height/2-innerHeight/2)<2,fullscreen:Math.abs(box.width-innerWidth)<2&&Math.abs(box.height-innerHeight)<2,focused:document.activeElement===input,clickThrough:document.elementFromPoint(field.left+10,field.top+10)===input};
    })()`);
    await win.webContents.insertText('Still typing');
    result.typing=await win.webContents.executeJavaScript(`document.getElementById('name').value==='Still typing'`);
    if(Object.entries(result).some(([k,v])=>k!=='zoom'&&!v))throw new Error(JSON.stringify(result));
    results.push(result);
    await win.webContents.executeJavaScript('window.release()');
  }
  await win.webContents.executeJavaScript('document.body.style.zoom=1;window.kumakhLoading.begin();void 0;');
  await new Promise(resolve=>setTimeout(resolve,500));
  fs.writeFileSync(path.join(__dirname,'centered-general-loader.png'),(await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(results));
  win.destroy();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
