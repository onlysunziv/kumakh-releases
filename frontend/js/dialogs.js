// Keep confirmations inside the renderer so native dialogs cannot leave the
// desktop window's keyboard focus behind. All callers receive an explicit result.
(() => {
  let queue = Promise.resolve();
  function show(kind, message, initial = '') {
    const run = () => new Promise(resolve => {
      const previous = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'app-message-dialog';
      dialog.setAttribute('aria-labelledby', 'appMessageTitle');
      dialog.innerHTML = '<form method="dialog"><h2 id="appMessageTitle"></h2><p id="appMessageText"></p><input class="form-control" aria-labelledby="appMessageText"><div class="app-message-actions"><button type="button" class="btn btn-outline-secondary" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">OK</button></div></form>';
      dialog.querySelector('h2').textContent = kind === 'alert' ? 'Notice' : kind === 'prompt' ? 'Update details' : 'Please confirm';
      dialog.querySelector('p').textContent = String(message);
      const input = dialog.querySelector('input');
      input.hidden = kind !== 'prompt';
      input.value = initial;
      const cancel = dialog.querySelector('[data-cancel]');
      cancel.hidden = kind === 'alert';
      let value = kind === 'prompt' ? null : false;
      dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        value = kind === 'prompt' ? input.value : true;
        dialog.close();
      };
      cancel.onclick = () => dialog.close();
      dialog.addEventListener('close', () => {
        dialog.remove();
        if (previous?.isConnected && !previous.disabled && previous.getClientRects().length) previous.focus({ preventScroll: true });
        resolve(value);
      }, { once: true });
      document.body.append(dialog);
      dialog.showModal();
      if (kind === 'prompt') { input.focus(); input.select(); }
      else (kind === 'confirm' ? cancel : dialog.querySelector('[type="submit"]')).focus();
    });
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  }
  window.kumakhDialogs = {
    alert: message => show('alert', message),
    confirm: message => show('confirm', message),
    prompt: (message, initial) => show('prompt', message, initial),
  };
})();
