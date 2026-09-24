// Read-only login-routing probe: deliberately omits credentials and never submits reports.
const endpoint = process.env.REPORTS_APPS_SCRIPT_URL;

if (!endpoint) {
  throw new Error("REPORTS_APPS_SCRIPT_URL is not configured");
}const app = process.versions.electron && require('electron').app;
if (app) {
  app.disableHardwareAcceleration();
  app.setPath('userData', require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'kcmt-login-probe-')));
}
(async () => {
  if (app) await app.whenReady();
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'authenticateUser', username: '', password: '' }),
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  const result = JSON.stringify({ runtime: process.versions.electron ? 'Electron' : 'Node', status: response.status, responseHost: new URL(response.url).hostname, message: body.data?.message || body.message });
  console.log(result);
  require('fs').writeFileSync(require('path').join(__dirname, '../.ui-review/report-login-probe.json'), result);
})().catch(error => { console.error(error.name, error.message); process.exitCode = 1; }).finally(() => { if (app) app.quit(); });
