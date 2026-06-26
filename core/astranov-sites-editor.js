/* Astranov Sites — click-to-edit content (layout stays on CLI) */
window.AstranovSitesEditor = {
  FIELDS: {
    'branding.title': { label: 'Site title', type: 'text', selector: '#sbProfileTitle, #sbBrand b' },
    'branding.subtitle': { label: 'Subtitle', type: 'text', selector: '#sbProfileSubtitle, .sb-brand span' },
    'contact.phone': { label: 'Phone', type: 'text', selector: '[data-as-edit="contact.phone"]' },
    'contact.email': { label: 'Email', type: 'text', selector: '[data-as-edit="contact.email"]' },
    'contact.address': { label: 'Address', type: 'text', selector: '#contactAddress, [data-as-edit="contact.address"]' },
  },

  init(adapter, config, opts = {}) {
    const self = this;
    const storeKey = config.storage?.content || `sb_${config.siteId}_content_v1`;
    const state = { content: { branding: { ...(config.branding || {}) }, contact: { ...(config.contact || {}) } } };
    const bridge = window.AstranovAuthBridge;

    const isOwner = () => {
      if (opts.isOwner) return opts.isOwner();
      if (bridge?.isSiteOwner) return true;
      const s = adapter.getSession?.();
      return !!(s && ((s.central && s.role === 'admin') || ['admin', 'super_admin'].includes(s.role)));
    };

    async function load() {
      try {
        const local = JSON.parse(localStorage.getItem(storeKey) || '{}');
        state.content.branding = { ...state.content.branding, ...local.branding };
        state.content.contact = { ...state.content.contact, ...local.contact };
      } catch { /* */ }
      if (adapter.rpc) {
        try {
          const s = adapter.getSession?.();
          const d = await adapter.rpc('get_setting', { p_token: s?.token || null, p_key: 'site_content' });
          if (d && typeof d === 'object') {
            state.content.branding = { ...state.content.branding, ...(d.branding || {}) };
            state.content.contact = { ...state.content.contact, ...(d.contact || {}) };
          }
        } catch { /* */ }
      }
      applyAll();
    }

    async function save() {
      localStorage.setItem(storeKey, JSON.stringify(state.content));
      const s = adapter.getSession?.();
      if (isOwner()) {
        try {
          if (s?.central && bridge?.client && config.siteId) {
            await bridge.client.rpc('booker_owner_save_setting', {
              p_site_id: config.siteId, p_key: 'site_content', p_value: state.content
            });
          } else if (adapter.rpc && s?.token) {
            await adapter.rpc('save_setting', { p_token: s.token, p_key: 'site_content', p_value: state.content });
          }
        } catch { /* */ }
      }
      Object.assign(config.branding || (config.branding = {}), state.content.branding);
      Object.assign(config.contact || (config.contact = {}), state.content.contact);
      applyAll();
      opts.toast?.('Content saved.');
    }

    function applyAll() {
      document.querySelectorAll('[data-as-edit]').forEach(el => {
        const key = el.dataset.asEdit;
        const val = key.split('.').reduce((o, k) => o?.[k], state.content);
        if (val != null && el.tagName !== 'INPUT') el.textContent = val;
        el.classList.toggle('sb-owner-edit', isOwner());
      });
      Object.entries(self.FIELDS).forEach(([key, def]) => {
        const val = key.split('.').reduce((o, k) => o?.[k], state.content);
        if (val == null) return;
        document.querySelectorAll(def.selector).forEach(el => {
          if (!el.hasAttribute('data-as-edit')) el.textContent = val;
          el.classList.toggle('sb-owner-edit', isOwner());
        });
      });
    }

    function openEditor(key) {
      if (!isOwner()) return;
      const def = self.FIELDS[key];
      if (!def) return;
      const cur = key.split('.').reduce((o, k) => o?.[k], state.content) || '';
      const next = prompt(def.label + ' — click edit (layout via CLI on astranov.eu)', cur);
      if (next == null) return;
      const parts = key.split('.');
      let ref = state.content;
      for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]] || (ref[parts[i]] = {});
      ref[parts[parts.length - 1]] = next.trim();
      save();
    }

    document.querySelectorAll('[data-as-edit]').forEach(el => {
      el.addEventListener('click', e => {
        if (!isOwner()) return;
        e.preventDefault();
        openEditor(el.dataset.asEdit);
      });
    });
    Object.keys(self.FIELDS).forEach(key => {
      const def = self.FIELDS[key];
      document.querySelectorAll(def.selector).forEach(el => {
        if (el.closest('.sb-media-zone')) return;
        el.setAttribute('data-as-edit', key);
        el.addEventListener('click', e => {
          if (!isOwner()) return;
          e.preventDefault();
          openEditor(key);
        });
      });
    });

    window.addEventListener('astranov-auth', () => applyAll());
    load();

    return { refresh: load, isOwner, getContent: () => ({ ...state.content }) };
  }
};
window.SuperBookingEditor = window.AstranovSitesEditor;