// The backend supplies stages; elapsed time never implies a successful upload.
window.KcmtReportSubmission = class KcmtReportSubmission {
  constructor(dialog) {
    this.dialog = dialog;
    const find = (id) => dialog.querySelector('#' + id);
    this.copy = find('reportSubmissionCopy');
    this.title = find('reportSubmissionTitle');
    this.status = find('reportSubmissionStatus');
    this.bar = find('reportSubmissionProgress');
    this.track = find('reportSubmissionTrack');
    this.count = find('reportSubmissionCount');
    this.details = find('reportSubmissionDetails');
    this.close = find('closeReportSubmissionDialog');
    this.mark = find('reportSubmissionMark');
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.running = false;
    this.timer = null;
    this.pending = null;
    this.currentTitle = '';
    this.close.onclick = () => dialog.close();
    dialog.addEventListener('cancel', (event) => {
      if (this.running) event.preventDefault();
    });
    dialog.addEventListener('close', () => {
      // A queued close event can arrive after the next submission opens.
      if (dialog.open) return;
      window.clearTimeout(this.timer);
      this.timer = null;
      this.pending = null;
    });
  }

  setText(title, detail) {
    this.title.textContent = title;
    this.status.textContent = detail;
    this.currentTitle = title;
  }

  transition(title, detail) {
    // Keep just the newest pending update when files finish quickly.
    // This prevents old upload messages playing after the submission finishes.
    this.pending = { title, detail };
    if (this.timer !== null) return;
    if (this.reducedMotion.matches || this.currentTitle === title) {
      this.setText(title, detail);
      this.pending = null;
      return;
    }
    this.copy.classList.add('is-fading');
    this.timer = window.setTimeout(() => {
      const next = this.pending;
      this.pending = null;
      this.setText(next.title, next.detail);
      this.copy.classList.remove('is-fading');
      this.timer = window.setTimeout(() => {
        this.timer = null;
        if (this.pending) this.transition(this.pending.title, this.pending.detail);
      }, 260);
    }, 220);
  }

  start(total) {
    window.clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.running = true;
    this.total = total;
    this.dialog.dataset.state = 'running';
    this.copy.classList.remove('is-fading');
    this.setText('Preparing records', 'Getting your records ready for submission.');
    this.details.replaceChildren();
    this.mark.className = 'bi bi-check-lg';
    this.close.classList.add('d-none');
    this.processed(0, total);
    if (!this.dialog.open) this.dialog.showModal();
  }

  stage(progress) {
    if (!this.running) return;
    const labels = {
      authorizing: 'Connecting to Google',
      preparing: 'Preparing records', folders: 'Preparing Drive folders',
      photos: 'Uploading photos', documents: 'Uploading documents',
      saving: 'Saving report',
    };
    if (labels[progress.stage]) this.transition(labels[progress.stage], progress.detail || '');
  }

  processed(processed, total) {
    const percent = total ? Math.round(processed / total * 100) : 0;
    this.bar.style.width = percent + '%';
    this.track.setAttribute('aria-valuenow', String(percent));
    this.track.setAttribute('aria-valuetext', `${processed} of ${total} reports processed`);
    this.count.textContent = `${processed} of ${total} reports processed`;
  }

  stopBeforeSubmission(message) {
    this.running = false;
    this.dialog.dataset.state = 'failed';
    this.mark.className = 'bi bi-exclamation-lg';
    this.transition('Sign-in not completed', message);
    this.count.textContent = 'No reports submitted';
    this.close.classList.remove('d-none');
  }

  finish(results) {
    this.running = false;
    const failed = results.filter(item => !item.result.success);
    const successful = results.length - failed.length;
    const allSuccessful = results.length === this.total && !failed.length;
    this.dialog.dataset.state = allSuccessful ? 'success' : 'failed';
    this.mark.className = allSuccessful ? 'bi bi-check-lg' : 'bi bi-exclamation-lg';
    this.processed(results.length, this.total);
    this.transition(allSuccessful ? 'Reports submitted' : 'Submission needs attention',
      allSuccessful ? `${successful} report(s) submitted successfully.` :
        `${successful} submitted, ${failed.length} failed, ${Math.max(0, this.total - results.length)} not processed.`);
    this.details.replaceChildren();
    for (const item of results) {
      const row = document.createElement('div');
      row.className = 'submission-result-line';
      row.dataset.result = item.result.success ? 'success' : 'failed';
      const title = document.createElement('strong');
      title.textContent = item.report;
      const detail = document.createElement('span');
      detail.textContent = item.result.success ?
        `Submitted to ${item.result.sheet || 'Google Sheets'} (${item.result.rows ?? 0} rows)` :
        item.result.message || 'Submission failed. Your local files are retained; retry this report.';
      row.append(title, detail);
      this.details.append(row);
    }
    this.close.classList.remove('d-none');
  }
};
