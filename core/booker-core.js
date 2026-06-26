/* Astranov Sites — multipurpose booking & web presence (evolved from SuperBooker) */
window.AstranovSites = (() => {
  const DEFAULT = {
    siteId: 'booker',
    domain: '',
    businessType: 'generic',
    mode: 'slot',
    currency: 'EUR',
    database: 'central',
    youtubeVideoId: '',
    youtubeUrl: '',
    youtubeChannelUrl: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    developmentDemo: false,
    decentral: { enabled: true, syncPath: '/superbooking/sync' },
    branding: { title: 'Astranov Sites', subtitle: 'Your astranov.eu presence', logoUrl: '' },
    contact: { phone: '', vhf: '', email: '', whatsapp: '', address: '', mapUrl: '', messenger: true },
    products: [],
    employees: [],
    agents: [],
    referrals: [],
    timeslots: {},
    fields: [],
    tabs: [{ id: 'book', label: 'Book' }, { id: 'portal', label: 'Portal' }],
    paymentMethods: [{ id: 'cash_on_arrival', label: 'Cash on arrival' }]
  };

  function mergeConfig(override) {
    const o = override || window.ASTRANOV_SITES_CONFIG || window.ASTRANOV_SUPERBOOKING_CONFIG || window.ASTRANOV_BOOKER_CONFIG || window.ASTRANOV_YACHTING_CONFIG || {};
    let cfg;
    if (window.ASTRANOV_YACHTING_CONFIG && !window.ASTRANOV_SUPERBOOKING_CONFIG && !window.ASTRANOV_BOOKER_CONFIG) {
      cfg = {
        ...DEFAULT,
        siteId: 'yachts',
        businessType: 'yacht_charter',
        mode: 'range',
        branding: { title: 'AstranoV Yachting', subtitle: 'Central database yacht charter booking' },
        youtubeVideoId: o.youtubeVideoId || '',
        supabaseUrl: o.supabaseUrl || '',
        supabaseAnonKey: o.supabaseAnonKey || '',
        currency: o.currency || 'EUR',
        developmentDemo: !!o.developmentDemo,
        tables: o.tables || {},
        contact: o.contact || DEFAULT.contact
      };
    } else {
      const yt = o.youtubeUrl || o.videoUrl || '';
      cfg = {
        ...DEFAULT,
        ...(window.ASTRANOV_SITES_DEFAULTS || window.ASTRANOV_SUPERBOOKING_DEFAULTS || {}),
        ...o,
        youtubeUrl: yt,
        youtubeVideoId: o.youtubeVideoId || youtubeId(yt),
        media: { ...(o.media || {}), ...(o.branding?.media || {}) },
        branding: { ...DEFAULT.branding, ...(o.branding || {}) },
        contact: { ...DEFAULT.contact, ...(o.contact || {}) },
        decentral: { ...DEFAULT.decentral, ...(o.decentral || {}) }
      };
    }
    return typeof applyCentralDatabase === 'function' ? applyCentralDatabase(cfg) : cfg;
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const norm = s => (s || '').toString().toLowerCase().trim();
  const money = (n, c = 'EUR') => n ? `${Number(n).toLocaleString('en-US')} ${c}` : 'Request quote';

  let toastTimer;
  function toast(msg, id = 'sbToast') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
  }

  function youtubeId(urlOrId) {
    if (!urlOrId) return '';
    if (!urlOrId.includes('/') && !urlOrId.includes('?')) return urlOrId;
    try {
      const u = new URL(urlOrId);
      return u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || '';
    } catch { return urlOrId; }
  }

  function renderVideoHero(shellId, config) {
    const shell = document.getElementById(shellId);
    if (!shell) return;
    const id = youtubeId(config.youtubeVideoId || config.youtubeUrl);
    if (!id) {
      shell.innerHTML = `<div><b>${esc(config.branding.title)}</b><div class="sb-muted">${esc(config.domain || config.branding.subtitle)}</div></div>`;
      return;
    }
    const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    shell.style.setProperty('--sb-video-thumb', `url("${thumb}")`);
    shell.innerHTML = `<div class="sb-video-preview"></div><button type="button" class="sb-play-btn" aria-label="Play video" data-yt="${esc(id)}"></button>`;
    shell.querySelector('.sb-play-btn')?.addEventListener('click', () => {
      shell.innerHTML = `<iframe title="${esc(config.branding.title)} video" src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      if (config.youtubeChannelUrl) {
        const a = document.createElement('a');
        a.className = 'sb-btn tiny ghost';
        a.href = config.youtubeChannelUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Channel';
        a.style.cssText = 'position:absolute;top:8px;right:8px;z-index:3';
        shell.appendChild(a);
      }
    });
  }

  function renderContactBar(containerId, contact, branding) {
    const box = document.getElementById(containerId);
    if (!box || !contact) return;
    const items = [];
    if (contact.phone) items.push({ icon: '☎', label: 'Call', href: `tel:${contact.phone.replace(/\s/g, '')}` });
    if (contact.vhf) items.push({ icon: '📡', label: 'VHF', href: contact.vhf.startsWith('http') ? contact.vhf : `https://astranov.eu/?vhf=${encodeURIComponent(contact.vhf)}` });
    if (contact.whatsapp) items.push({ icon: '💬', label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` });
    if (contact.email) items.push({ icon: '✉', label: 'Email', href: `mailto:${contact.email}?subject=${encodeURIComponent(branding?.title || 'Booking enquiry')}` });
    if (contact.mapUrl) items.push({ icon: '📍', label: 'Map', href: contact.mapUrl });
    box.innerHTML = items.length
      ? `<div class="sb-contact-bar">${items.map(i => `<a class="sb-btn ghost tiny" href="${esc(i.href)}">${i.icon} ${esc(i.label)}</a>`).join('')}</div>`
      : '';
  }

  function dynamicOptions(field, config, state = {}) {
    if (field.dynamic === 'products') return (config.products || []).map(p => ({ value: p.name, label: `${p.name}${p.price ? ` · €${p.price}` : ''}` }));
    if (field.dynamic === 'employees') return (config.employees || []).map(e => ({ value: e, label: e }));
    if (field.dynamic === 'referrals') return (config.referrals || []).map(r => ({ value: r, label: r }));
    if (field.dynamic === 'timeslots') {
      const slots = config.timeslots || {};
      return Object.keys(slots).sort().map(t => {
        const cap = slots[t];
        const used = state.bookedCount?.(t) ?? 0;
        const left = Math.max(0, cap - used);
        return { value: t, label: `${t} · ${left}/${cap} available`, disabled: left <= 0 };
      });
    }
    if (field.options) return field.options.map(o => typeof o === 'object' ? o : ({ value: o === 'Any' ? '' : o, label: o }));
    return [];
  }

  function fieldHtml(field, config, state) {
    const opts = dynamicOptions(field, config, state);
    const req = field.required ? ' required' : '';
    const val = state.values?.[field.id] ?? field.default ?? '';
    const name = `sb_${field.id}`;
    if (field.type === 'textarea') return `<div class="sb-field" data-field="${field.id}" data-stage="${field.stage}"><label class="sb-label">${esc(field.label)}</label><textarea name="${name}" placeholder="${esc(field.placeholder || '')}"${req}>${esc(val)}</textarea></div>`;
    if (field.type === 'select') {
      const inner = opts.map(o => `<option value="${esc(o.value)}"${o.disabled ? ' disabled' : ''}${o.value === val ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
      return `<div class="sb-field" data-field="${field.id}" data-stage="${field.stage}"><label class="sb-label">${esc(field.label)}</label><select name="${name}"${req}>${inner}</select></div>`;
    }
    const type = field.type === 'tel' ? 'tel' : field.type || 'text';
    const extra = field.min != null ? ` min="${field.min}"` : '';
    return `<div class="sb-field" data-field="${field.id}" data-stage="${field.stage}"><label class="sb-label">${esc(field.label)}</label><input name="${name}" type="${type}" value="${esc(val)}" placeholder="${esc(field.placeholder || '')}"${extra}${req}></div>`;
  }

  function renderProgressiveForm(containerId, config, state = {}) {
    const box = document.getElementById(containerId);
    if (!box || !(window.AstranovSitesFields || window.SuperBookingFields)) return;
    const fields = (window.AstranovSitesFields || window.SuperBookingFields).resolve(config);
    const stages = [...new Set(fields.map(f => f.stage))];
    const showStage = state.activeStage || stages[0];
    box.innerHTML = stages.map(stage => {
      const stageFields = fields.filter(f => f.stage === stage);
      if (!stageFields.length) return '';
      const hidden = stage !== showStage ? ' sb-hidden' : '';
      return `<section class="sb-stage${hidden}" data-stage="${stage}"><p class="sb-stage-label">${esc(stage)}</p>${stageFields.map(f => fieldHtml(f, config, state)).join('')}${stage !== 'contact' ? `<div class="sb-actions"><button type="button" class="sb-btn ghost sb-stage-next" data-next-stage="${esc(stages[stages.indexOf(stage) + 1] || 'contact')}">Continue</button></div>` : ''}</section>`;
    }).join('');
    box.querySelectorAll('.sb-stage-next').forEach(btn => btn.addEventListener('click', () => {
      const next = btn.dataset.nextStage;
      if (!next) return;
      $$('.sb-stage', box).forEach(s => s.classList.toggle('sb-hidden', s.dataset.stage !== next));
      state.activeStage = next;
    }));
  }

  function readFormData(formEl) {
    const d = {};
    new FormData(formEl).forEach((v, k) => { d[k.replace(/^sb_/, '')] = v; });
    return d;
  }

  function applyBranding(config) {
    document.title = `${config.branding.title} · Astranov Sites`;
    const brand = $('#sbBrand');
    if (brand) brand.innerHTML = `<b>${esc(config.branding.title)}</b><span>${esc(config.branding.subtitle || config.domain)}</span>`;
  }

  function initShell(config) {
    applyBranding(config);
    renderVideoHero('sbVideoShell', config);
    renderContactBar('sbContactBar', config.contact, config.branding);
  }

  return {
    DEFAULT, mergeConfig, $, $$, esc, norm, money, toast, youtubeId,
    renderVideoHero, renderContactBar, renderProgressiveForm, readFormData, dynamicOptions, initShell
  };
})();
window.SuperBooking = window.AstranovSites;
window.SuperBooker = window.AstranovSites;