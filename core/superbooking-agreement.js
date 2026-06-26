/* Astranov Sites agreement — admin upload + customer acknowledgement */
window.AstranovSitesAgreement = {
  init(adapter, config, opts = {}) {
    const storeKey = config.storage?.agreement || `sb_${config.siteId}_agreement_v1`;
    const $ = id => document.getElementById(id);

    function fileToData(f) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res({ dataUrl: fr.result, name: f.name, type: f.type });
        fr.onerror = rej;
        fr.readAsDataURL(f);
      });
    }

    async function loadFromDb() {
      if (!adapter.rpc) return null;
      try {
        const s = adapter.getSession?.();
        const d = await adapter.rpc('get_setting', { p_token: s?.token || null, p_key: 'agreement_jpeg' });
        return d?.dataUrl || null;
      } catch { return null; }
    }

    async function loadAgreement() {
      let src = localStorage.getItem(storeKey) || '';
      if (!src) src = await loadFromDb() || '';
      const preview = $('sbAgreementPreview');
      const open = $('sbOpenAgreement');
      const dl = $('sbDownloadAgreement');
      if (!preview) return;
      if (src) {
        preview.innerHTML = `<img src="${src}" alt="Participant agreement" class="sb-agreement-img">`;
        if (open) { open.href = src; open.classList.remove('sb-hidden'); }
        if (dl) { dl.href = src; dl.download = 'frogschool-agreement.jpg'; dl.classList.remove('sb-hidden'); }
      } else {
        preview.innerHTML = '<span class="sb-muted">Admin has not uploaded the agreement document yet.</span>';
        if (open) open.classList.add('sb-hidden');
        if (dl) dl.classList.add('sb-hidden');
      }
    }

    async function saveAgreement() {
      const s = adapter.getSession?.();
      if (!s || !['admin', 'super_admin'].includes(s.role)) return opts.toast?.('Admin only.');
      const f = $('sbAgreementUpload')?.files?.[0];
      if (!f) return opts.toast?.('Choose agreement image first.');
      const data = await fileToData(f);
      localStorage.setItem(storeKey, data.dataUrl);
      await loadAgreement();
      if (adapter.rpc && s.token) {
        try {
          await adapter.rpc('save_setting', {
            p_token: s.token, p_key: 'agreement_jpeg',
            p_value: { dataUrl: data.dataUrl, fileName: f.name, mimeType: f.type }
          });
        } catch { /* local ok */ }
      }
      opts.toast?.('Agreement saved.');
    }

    $('sbSaveAgreementBtn')?.addEventListener('click', saveAgreement);
    loadAgreement();
    return { loadAgreement, saveAgreement };
  }
};
window.SuperBookingAgreement = window.AstranovSitesAgreement;