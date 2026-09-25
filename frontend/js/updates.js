(() => {
  const bridge = window.kumakhApp;
  if (!bridge?.getUpdateState) return;
  let state, dialog, opener;
  let busy = false;
  const mb = bytes => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const presentation = {
    idle: ['Ready when you are', 'Check for the latest improvements to your KUMAKH workspace.', 'Not checked yet', 'arrow-repeat'],
    disabled: ['Updates in the installed app', 'Open your installed copy of KUMAKH to check for new versions.', 'Development preview', 'laptop'],
    checking: ['Checking for updates…', 'Looking for the latest version of KUMAKH.', 'Checking', 'arrow-repeat'],
    current: ['You’re up to date', 'You have the latest version. Your workspace is ready to go.', 'Up to date', 'check2-circle'],
    available: ['A fresh update is available', 'Download the latest improvements whenever you’re ready.', 'Update available', 'download'],
    downloading: ['Your update is on its way', 'You can close this window and carry on working while it downloads.', 'Downloading', 'cloud-arrow-down'],
    ready: ['Ready for a fresh start', 'Your update has downloaded. Choose when to restart and install.', 'Ready to install', 'check2-circle'],
    installing: ['See you in a moment', 'KUMAKH is preparing to restart and install your update.', 'Restarting', 'arrow-repeat'],
    error: ['We couldn’t complete the update', 'Check your connection and try again. You can keep using KUMAKH.', 'Try again', 'wifi-off'],
  };
  const settingsPanelMarkup = `<div class="settings-pane-heading"><div><h5>Software Update</h5><p>KUMAKH College Management System</p></div></div>
    <dl class="row mb-3"><dt class="col-6">Current Version</dt><dd class="col-6" data-update-value="currentVersion">—</dd><dt class="col-6">Latest Version</dt><dd class="col-6" data-update-value="latestVersion">—</dd><dt class="col-6">Update Status</dt><dd class="col-6" data-update-value="status" role="status">—</dd><dt class="col-6">Last Checked</dt><dd class="col-6" data-update-value="lastChecked">Never</dd></dl>
    <div data-update-progress hidden><label>Downloading Update <span data-update-value="percent"></span></label><progress max="100" value="0" aria-label="Download progress"></progress><p data-update-value="bytes"></p></div>
    <p class="small text-danger" data-update-value="error" role="alert"></p><p class="small text-muted">Save or cancel your work and sign out before installing.</p>
    <div class="d-flex gap-2 flex-wrap"><button class="btn btn-outline-primary btn-sm" type="button" data-update-action="check">Check for Updates</button><button class="btn btn-primary btn-sm" type="button" data-update-action="download" hidden>Download Update</button><button class="btn btn-primary btn-sm" type="button" data-update-action="install" hidden>Restart &amp; Install</button></div>
    <p class="small mt-2" data-update-notice role="status"></p>`;
  const panelMarkup = `<header class="update-dialog-header">
    <div class="update-brand"><span class="update-brand-icon"><i class="bi bi-arrow-repeat" aria-hidden="true"></i></span><div><span class="update-eyebrow">KUMAKH DESKTOP</span><h2 id="updateDialogTitle">Check for Updates</h2></div></div>
    <button type="button" class="update-close" data-update-close aria-label="Close update window" autofocus><i class="bi bi-x-lg" aria-hidden="true"></i></button></header>
    <div class="update-dialog-body">
      <div class="update-summary"><span class="update-state-icon"><i data-update-icon class="bi bi-arrow-repeat" aria-hidden="true"></i></span><div><span class="update-status" data-update-value="status" role="status"></span><h3 data-update-value="heading">Checking your version…</h3><p data-update-value="description"></p></div></div>
      <div class="update-versions"><div><span>Current version</span><strong data-update-value="currentVersion">—</strong><small>Installed on this computer</small></div><i class="bi bi-arrow-right update-version-arrow" aria-hidden="true"></i><div><span>Latest version</span><strong data-update-value="latestVersion">—</strong><small>Latest release</small></div></div>
      <div class="update-progress" data-update-progress hidden><div><span>Downloading update</span><strong data-update-value="percent"></strong></div><progress max="100" value="0" aria-label="Download progress"></progress><p data-update-value="bytes"></p></div>
      <section class="update-notes" data-update-notes hidden><h4><i class="bi bi-stars" aria-hidden="true"></i> What’s new</h4><pre data-update-value="releaseNotes"></pre></section>
      <p class="update-error" data-update-value="error" role="alert" hidden></p>
      <div class="update-last-checked"><i class="bi bi-clock-history" aria-hidden="true"></i><span>Last checked</span><span data-update-value="lastChecked">Never</span></div>
      <div class="update-reassurance"><i class="bi bi-shield-check" aria-hidden="true"></i><p data-update-value="safety">Your saved records stay safe. You choose when to restart.</p></div>
      <p class="update-notice" data-update-notice role="status" hidden></p>
    </div>
    <footer class="update-dialog-footer"><span>KUMAKH College Management System</span><div class="update-actions"><button class="update-button update-button-secondary" type="button" data-update-action="later" hidden>Install Later</button><button class="update-button update-button-primary" type="button" data-update-action="check"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Check for Updates</button><button class="update-button update-button-primary" type="button" data-update-action="download" hidden><i class="bi bi-download" aria-hidden="true"></i> Download Update</button><button class="update-button update-button-primary" type="button" data-update-action="install" hidden><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Restart &amp; Install</button></div></footer>`;

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'update-dialog';
    dialog.id = 'updateDialog';
    dialog.dataset.softwareUpdate = '';
    dialog.setAttribute('aria-labelledby', 'updateDialogTitle');
    dialog.innerHTML = panelMarkup;
    document.body.append(dialog);
    dialog.querySelector('[data-update-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('update-modal-open');
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }
  function notice(text) {
    if (!dialog) return;
    const node = dialog.querySelector('[data-update-notice]');
    node.textContent = text;
    node.hidden = !text;
  }
  function render(next) {
    state = next;
    document.querySelectorAll('[data-software-update]').forEach(panel => {
      if (panel.closest('dialog')) return;
      if (!panel.dataset.initialized) { panel.innerHTML = settingsPanelMarkup; panel.dataset.initialized = 'true'; }
      const values = { ...state, currentVersion: state.currentVersion || '—', latestVersion: state.latestVersion || '—', status: presentation[state.status]?.[2] || state.status, lastChecked: state.lastChecked ? new Date(state.lastChecked).toLocaleString() : 'Never', error: state.error || '', percent: `${Math.round(state.progress?.percent || 0)}%`, bytes: `${mb(state.progress?.transferred || 0)} of ${mb(state.progress?.total || 0)}` };
      panel.querySelectorAll('[data-update-value]').forEach(node => { node.textContent = values[node.dataset.updateValue] || ''; });
      panel.querySelector('[data-update-progress]').hidden = state.status !== 'downloading';
      panel.querySelector('progress').value = state.progress?.percent || 0;
      const visible = { check: ['idle', 'current', 'error', 'available', 'disabled'].includes(state.status), download: state.status === 'available', install: state.status === 'ready' };
      panel.querySelectorAll('[data-update-action]').forEach(button => { button.hidden = !visible[button.dataset.updateAction]; button.disabled = busy || !state.enabled; });
      panel.querySelector('[data-update-notice]').textContent = state.notice || '';
    });
    if (dialog) {
      const [heading, description, status, icon] = presentation[state.status] || presentation.idle;
      dialog.dataset.state = state.status;
      const atLogin = window.location.pathname.endsWith('/login.html');
      const values = { ...state, heading, description, status, currentVersion: state.currentVersion || '—', latestVersion: state.latestVersion || '—', lastChecked: state.lastChecked ? new Date(state.lastChecked).toLocaleString() : 'Not checked yet', error: state.error || '', percent: `${Math.round(state.progress?.percent || 0)}%`, bytes: `${mb(state.progress?.transferred || 0)} of ${mb(state.progress?.total || 0)}`, safety: atLogin ? 'Your saved records stay safe. You choose when to restart.' : 'Save your work and sign out before installing. Your saved records stay safe.' };
      dialog.querySelectorAll('[data-update-value]').forEach(node => { node.textContent = values[node.dataset.updateValue] || ''; });
      dialog.querySelector('[data-update-icon]').className = `bi bi-${icon}`;
      dialog.querySelector('[data-update-progress]').hidden = state.status !== 'downloading';
      dialog.querySelector('progress').value = state.progress?.percent || 0;
      dialog.querySelector('[data-update-notes]').hidden = !state.releaseNotes;
      dialog.querySelector('[data-update-value="error"]').hidden = !state.error;
      const visible = { check: ['idle', 'current', 'error', 'available', 'disabled'].includes(state.status), download: state.status === 'available', install: state.status === 'ready', later: state.status === 'ready' };
      dialog.querySelectorAll('[data-update-action]').forEach(button => { button.hidden = !visible[button.dataset.updateAction]; button.disabled = busy || !state.enabled; });
      if (state.notice) notice(state.notice);
    }
    const announcement = document.getElementById('softwareUpdateAnnouncement');
    if (announcement) {
      const deferred = sessionStorage.getItem('kumakhDeferredUpdate') === state.latestVersion;
      announcement.hidden = !['available', 'ready'].includes(state.status) || deferred;
      announcement.textContent = state.status === 'ready' ? `KUMAKH ${state.latestVersion} is ready. Finish your work and sign out to install, or continue working and install later.` : `KUMAKH ${state.latestVersion} is available (current: ${state.currentVersion}). Select Check for Updates in Settings or on the login screen.`;
    }
  }
  window.initializeSoftwareUpdate = () => bridge.getUpdateState().then(render).catch(() => {});
  async function openUpdates(trigger) {
    ensureDialog();
    if (dialog.open) return;
    opener = trigger;
    notice('');
    if (state) render(state);
    dialog.showModal();
    document.documentElement.classList.add('update-modal-open');
    if (busy) return;
    busy = true;
    try {
      render(await bridge.getUpdateState());
      if (state.enabled && ['idle', 'current', 'error', 'available'].includes(state.status)) render(await bridge.checkForUpdates());
    } catch (_) {
      notice('Unable to check for updates. Please try again.');
    } finally {
      busy = false;
      if (state) render(state);
    }
  }
  document.addEventListener('click', async event => {
    const trigger = event.target.closest('[data-open-updates]');
    if (trigger) { await openUpdates(trigger); return; }
    const button = event.target.closest('[data-update-action]');
    if (!button || !button.closest('[data-software-update]') || busy || !state) return;
    notice('');
    if (button.dataset.updateAction === 'later') {
      sessionStorage.setItem('kumakhDeferredUpdate', state.latestVersion);
      render(state);
      dialog?.close();
      return;
    }
    busy = true;
    render(state);
    try {
      const method = { check: 'checkForUpdates', download: 'downloadUpdate', install: 'installUpdate' }[button.dataset.updateAction];
      render(await bridge[method]());
    } catch (_) {
      notice('Unable to complete the update request. Please try again.');
    } finally {
      busy = false;
      render(state);
    }
  });
  const unsubscribe = bridge.onUpdateState(render);
  window.addEventListener('beforeunload', unsubscribe, { once: true });
  document.addEventListener('DOMContentLoaded', window.initializeSoftwareUpdate);
})();
