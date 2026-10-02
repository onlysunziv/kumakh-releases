(() => {
  if (!window.kumakhApp?.getSyncStatus) return;
  let revision = null, pendingRefresh = false, dirty = false, refreshTimer;
  let label, refresh;
  function refreshWhenSafe() {
    clearTimeout(refreshTimer);
    if (!pendingRefresh || !document.getElementById('pageContent')) return;
    const modalOpen = [...document.querySelectorAll('dialog, .modal, [role="dialog"]')].some(element => !element.hidden && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    const busy = window.kumakhLoading?.pending || modalOpen;
    if (busy) { refreshTimer = setTimeout(refreshWhenSafe, 500); return; }
    if (dirty || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      refresh.hidden = false;
      return;
    }
    pendingRefresh = false;
    refresh.hidden = true;
    window.dispatchEvent(new CustomEvent('kumakh:cloud-refresh'));
  }
  function show(state) {
    if (!label) return;
    const online = state.state === 'synced';
    label.textContent = `${online ? 'CLOUD CONNECTED' : 'LOCAL/OFFLINE MODE'}${state.pending ? ' — changes waiting to upload' : ''}`;
    label.parentElement.style.background = online ? '#e8f5ed' : '#fff1cf';
    label.parentElement.style.color = online ? '#14532d' : '#78350f';
    label.title = `Database: ${state.domain || 'not connected'} | Last sync: ${state.lastSyncAt || 'never'}${state.lastError ? ' | ' + state.lastError : ''}`;
    if (revision !== null && state.revision > revision) pendingRefresh = true;
    revision = state.revision;
    refreshWhenSafe();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.id = 'cloudSyncStatus';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:6px 12px;font:12px system-ui;display:flex;gap:12px;justify-content:center;background:#fff1cf;color:#78350f';
    label = document.createElement('span');
    label.textContent = 'Connecting to cloud…';
    refresh = document.createElement('button');
    refresh.textContent = 'Cloud data changed — reload view when edits are saved';
    refresh.hidden = true;
    refresh.onclick = () => {
      dirty = false;
      refresh.blur();
      refreshWhenSafe();
    };
    bar.append(label, refresh);
    document.body.appendChild(bar);
    // Button-driven drafts (for example a cafe cart) also need protection.
    document.addEventListener('click', event => { if (event.target.closest('#pageContent button')) dirty = true; });
    document.addEventListener('input', event => { if (event.target.closest('#pageContent, dialog, .modal')) dirty = true; });
    window.addEventListener('kumakh:page-loaded', () => { dirty = false; refreshWhenSafe(); });
    window.kumakhApp.onSyncStatus(show);
    window.kumakhApp.getSyncStatus().then(show).catch(() => show({ state: 'offline' }));
  });
})();
