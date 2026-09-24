(() => {
  const bridge = window.kumakhApp;
  if (!bridge?.getUpdateState) return;
  let state;
  let busy = false;
  const labels = { idle: 'Not checked yet', disabled: 'Unavailable in development', checking: 'Checking', current: 'Up to Date', available: 'Update Available', downloading: 'Downloading', ready: 'Ready to Install', installing: 'Restarting', error: 'Error' };
  const mb = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const panelMarkup = `<div class="settings-pane-heading"><div><h5>Software Update</h5><p>KUMAKH College Management System</p></div></div>
    <dl class="row mb-3"><dt class="col-6">Current Version</dt><dd class="col-6" data-update-value="currentVersion">—</dd><dt class="col-6">Latest Version</dt><dd class="col-6" data-update-value="latestVersion">—</dd><dt class="col-6">Update Status</dt><dd class="col-6" data-update-value="status" role="status">—</dd><dt class="col-6">Last Checked</dt><dd class="col-6" data-update-value="lastChecked">Never</dd></dl>
    <div data-update-progress hidden><label>Downloading Update <span data-update-value="percent"></span></label><progress class="w-100" max="100" value="0" aria-label="Download progress"></progress><p class="small" data-update-value="bytes"></p></div>
    <div data-update-notes hidden><h6>Release notes</h6><pre class="small text-wrap" style="font-family:inherit;max-height:180px;overflow:auto" data-update-value="releaseNotes"></pre></div>
    <p class="small text-danger" data-update-value="error" role="alert"></p>
    <p class="small text-muted">Save or cancel your work and sign out before installing. Updates never restart an active workspace.</p>
    <div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-primary btn-sm" type="button" data-update-action="check">Check for Updates</button><button class="btn btn-primary btn-sm" type="button" data-update-action="download" hidden>Download Update</button><button class="btn btn-primary btn-sm" type="button" data-update-action="install" hidden>Restart &amp; Install</button><button class="btn btn-light border btn-sm" type="button" data-update-action="later" hidden>Install Later</button></div>
    <p class="small mt-2" data-update-notice role="status"></p>`;

  function render(next) {
    state = next;
    document.querySelectorAll('[data-software-update]').forEach(panel => {
      if (!panel.dataset.initialized) { panel.innerHTML = panelMarkup; panel.dataset.initialized = 'true'; }
      const values = { ...state, currentVersion: state.currentVersion || '—', latestVersion: state.latestVersion || '—', status: labels[state.status] || state.status, lastChecked: state.lastChecked ? new Date(state.lastChecked).toLocaleString() : 'Never', error: state.error || '', percent: `${Math.round(state.progress?.percent || 0)}%`, bytes: `${mb(state.progress?.transferred || 0)} / ${mb(state.progress?.total || 0)}` };
      panel.querySelectorAll('[data-update-value]').forEach(node => { node.textContent = values[node.dataset.updateValue] || ''; });
      panel.querySelector('[data-update-progress]').hidden = state.status !== 'downloading';
      panel.querySelector('progress').value = state.progress?.percent || 0;
      panel.querySelector('[data-update-notes]').hidden = !state.releaseNotes;
      const visible = { check: ['idle', 'current', 'error', 'available', 'disabled'].includes(state.status), download: state.status === 'available', install: state.status === 'ready', later: state.status === 'ready' };
      panel.querySelectorAll('[data-update-action]').forEach(button => { button.hidden = !visible[button.dataset.updateAction]; button.disabled = busy || !state.enabled; });
      if (state.notice) panel.querySelector('[data-update-notice]').textContent = state.notice;
    });
    const announcement = document.getElementById('softwareUpdateAnnouncement');
    if (announcement) {
      const deferred = sessionStorage.getItem('kumakhDeferredUpdate') === state.latestVersion;
      announcement.hidden = !['available', 'ready'].includes(state.status) || deferred;
      announcement.textContent = state.status === 'ready' ? `KUMAKH ${state.latestVersion} is ready. Finish your work and sign out to install, or continue working and install later.` : `KUMAKH ${state.latestVersion} is available (current: ${state.currentVersion}). Open Settings → Software Update, or the Software Update section on the login screen.`;
    }
  }
  window.initializeSoftwareUpdate = () => {
    if (state) render(state);
    bridge.getUpdateState().then(render).catch(() => {});
  };
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-update-action]');
    if (!button || !button.closest('[data-software-update]') || busy) return;
    const panel = button.closest('[data-software-update]');
    const notice = panel.querySelector('[data-update-notice]');
    notice.textContent = '';
    if (button.dataset.updateAction === 'later') {
      sessionStorage.setItem('kumakhDeferredUpdate', state.latestVersion);
      notice.textContent = 'Update postponed. It will not install automatically when you exit.';
      render(state); return;
    }
    busy = true; render(state);
    try {
      const method = { check: 'checkForUpdates', download: 'downloadUpdate', install: 'installUpdate' }[button.dataset.updateAction];
      render(await bridge[method]());
    } catch (_) { notice.textContent = 'Unable to complete the update request. Please try again.'; }
    finally { busy = false; render(state); }
  });
  const unsubscribe = bridge.onUpdateState(render);
  window.addEventListener('beforeunload', unsubscribe, { once: true });
  document.addEventListener('DOMContentLoaded', window.initializeSoftwareUpdate);
})();
