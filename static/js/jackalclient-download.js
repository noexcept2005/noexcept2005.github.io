(() => {
    const trigger = document.getElementById('domesticDownload');
    const dialog = document.getElementById('domesticDialog');
    if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;
    const copy = document.getElementById('domesticCopy');
    const status = document.getElementById('domesticStatus');
    const close = document.getElementById('domesticClose');
    const direct = document.getElementById('domesticDirect');

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        status.textContent = '';
        delete status.dataset.i18n;
        direct.href = trigger.href;
        dialog.showModal();
        document.body.classList.add('jc-download-open');
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        document.body.classList.remove('jc-download-open');
        trigger.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    copy.addEventListener('click', async () => {
        if (copy.disabled) return;
        copy.disabled = true;
        try {
            await navigator.clipboard.writeText('d1lu');
            window.location.assign(trigger.href);
        } catch {
            status.dataset.i18n = 'download.copyFailure';
            status.textContent = jackalText(status.dataset.i18n);
        } finally {
            copy.disabled = false;
        }
    });
})();
