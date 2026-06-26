/* Astranov Sites media — profile, cover, video, background (owner click → Change) */
window.AstranovSitesMedia = {
  KEYS: ['profile', 'cover', 'video', 'background'],
  LABELS: { profile: 'Profile photo', cover: 'Cover image', video: 'Hero video', background: 'Page background' },
  ACCEPT: {
    profile: 'image/jpeg,image/png,image/webp',
    cover: 'image/jpeg,image/png,image/webp',
    video: 'video/*,image/jpeg,image/png,image/webp',
    background: 'image/jpeg,image/png,image/webp'
  },

  init(adapter, config, opts = {}) {
    const storeKey = config.storage?.media || `sb_${config.siteId}_media_v1`;
    const state = { media: { ...(config.media || {}) }, editing: null, supa: null };

    const $ = id => document.getElementById(id);
    const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

    const isOwner = () => {
      if (opts.isOwner) return opts.isOwner();
      if (window.AstranovAuthBridge?.isSiteOwner) return true;
      const s = adapter.getSession?.();
      return !!(s && ((s.central && s.role === 'admin') || ['admin', 'super_admin'].includes(s.role)));
    };

    function fileToData(f) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res({ dataUrl: fr.result, name: f.name, type: f.type, size: f.size });
        fr.onerror = rej;
        fr.readAsDataURL(f);
      });
    }

    async function loadFromDb() {
      if (!adapter.rpc) return null;
      try {
        const s = adapter.getSession?.();
        const d = await adapter.rpc('get_setting', { p_token: s?.token || null, p_key: 'site_media' });
        return d && typeof d === 'object' ? d : null;
      } catch { return null; }
    }

    async function loadMedia() {
      let local = {};
      try { local = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { /* */ }
      const remote = await loadFromDb();
      state.media = { ...local, ...(remote || {}), ...(config.media || {}) };
      if (config.youtubeUrl || config.videoUrl) {
        state.media.youtubeUrl = state.media.youtubeUrl || config.youtubeUrl || config.videoUrl;
      }
      applyAll();
    }

    async function saveMedia() {
      localStorage.setItem(storeKey, JSON.stringify(state.media));
      const s = adapter.getSession?.();
      if (isOwner()) {
        try {
          if (s?.central && window.AstranovAuthBridge?.client && config.siteId) {
            await window.AstranovAuthBridge.client.rpc('booker_owner_save_setting', {
              p_site_id: config.siteId, p_key: 'site_media', p_value: state.media
            });
          } else if (adapter.rpc && s?.token) {
            await adapter.rpc('save_setting', { p_token: s.token, p_key: 'site_media', p_value: state.media });
          }
        } catch { /* local ok */ }
      }
      applyAll();
      opts.toast?.('Media saved.');
    }

    function applyBackground() {
      const bg = state.media.background;
      if (bg) {
        document.body.style.backgroundImage = `url("${bg}")`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundPosition = 'center';
      } else {
        document.body.style.backgroundImage = '';
      }
    }

    function applyProfile() {
      const el = $('sbMediaProfile');
      if (!el) return;
      const src = state.media.profile;
      el.innerHTML = src
        ? `<img src="${esc(src)}" alt="Profile">`
        : `<span class="sb-media-placeholder">${esc((config.branding?.title || 'SB').slice(0, 1))}</span>`;
      el.classList.toggle('sb-has-media', !!src);
    }

    function applyCover() {
      const el = $('sbMediaCover');
      if (!el) return;
      if (state.media.cover) el.style.backgroundImage = `url("${state.media.cover}")`;
      else el.style.backgroundImage = '';
      el.classList.toggle('sb-has-media', !!state.media.cover);
    }

    function renderHero() {
      const shell = $('sbVideoShell');
      if (!shell) return;
      const uploaded = state.media.video;
      const yt = (window.AstranovSites || window.SuperBooking).youtubeId(state.media.youtubeUrl || config.youtubeUrl || config.videoUrl || config.youtubeVideoId);

      if (uploaded && !uploaded.includes('youtube')) {
        const isVideo = state.media.videoType?.startsWith('video/') || /\.(mp4|webm|mov)/i.test(uploaded);
        if (isVideo) {
          shell.innerHTML = `<video src="${esc(uploaded)}" controls playsinline class="sb-hero-video"></video>`;
          return;
        }
        shell.style.setProperty('--sb-video-thumb', `url("${uploaded}")`);
        shell.innerHTML = `<div class="sb-video-preview"></div>`;
        return;
      }

      if (yt) {
        (window.AstranovSites || window.SuperBooking).renderVideoHero('sbVideoShell', {
          ...config,
          youtubeUrl: state.media.youtubeUrl || config.youtubeUrl || config.videoUrl,
          youtubeVideoId: yt,
          youtubeChannelUrl: config.youtubeChannelUrl
        });
        return;
      }

      shell.innerHTML = `<div><b>${esc(config.branding?.title)}</b><div class="sb-muted">${esc(config.domain || config.branding?.subtitle)}</div></div>`;
    }

    function applyAll() {
      applyProfile();
      applyCover();
      applyBackground();
      renderHero();
      document.querySelectorAll('.sb-media-zone').forEach(z => {
        z.classList.toggle('sb-owner-edit', isOwner());
      });
    }

    function openEditor(kind) {
      if (!isOwner()) {
        if (kind === 'video' && !state.media.video) {
          const btn = $('sbVideoShell')?.querySelector('.sb-play-btn');
          btn?.click();
        }
        return;
      }
      state.editing = kind;
      const modal = $('sbMediaModal');
      const title = $('sbMediaModalTitle');
      const preview = $('sbMediaPreview');
      const urlRow = $('sbMediaUrlRow');
      const fileIn = $('sbMediaFile');
      if (!modal) return;
      if (title) title.textContent = this.LABELS[kind] || kind;
      if (urlRow) urlRow.style.display = kind === 'video' ? 'block' : 'none';
      if (fileIn) fileIn.accept = this.ACCEPT[kind] || 'image/*,video/*';
      const cur = kind === 'video' && state.media.youtubeUrl && !state.media.video
        ? state.media.youtubeUrl
        : state.media[kind];
      if (preview) {
        if (kind === 'video' && cur && (cur.includes('youtube') || cur.includes('youtu.be'))) {
          preview.innerHTML = `<span class="sb-muted">YouTube: ${esc(cur)}</span>`;
        } else if (cur && (state.media.videoType?.startsWith('video/') || /\.(mp4|webm)/i.test(cur))) {
          preview.innerHTML = `<video src="${esc(cur)}" controls style="max-width:100%;border-radius:12px"></video>`;
        } else if (cur) {
          preview.innerHTML = `<img src="${esc(cur)}" alt="" style="max-width:100%;border-radius:12px">`;
        } else preview.innerHTML = '<span class="sb-muted">No media yet — tap Change to upload.</span>';
      }
      const urlIn = $('sbMediaYoutubeUrl');
      if (urlIn && kind === 'video') urlIn.value = state.media.youtubeUrl || config.youtubeUrl || config.videoUrl || '';
      modal.classList.add('show');
    }

    async function applyChange() {
      const kind = state.editing;
      if (!kind) return;
      const f = $('sbMediaFile')?.files?.[0];
      const yt = ($('sbMediaYoutubeUrl')?.value || '').trim();
      if (kind === 'video' && yt) {
        state.media.youtubeUrl = yt;
        state.media.video = '';
        delete state.media.videoType;
      } else if (f) {
        const data = await fileToData(f);
        if (kind === 'video' && f.type.startsWith('video/')) {
          state.media.video = data.dataUrl;
          state.media.videoType = f.type;
        } else if (kind === 'video' && f.type.startsWith('image/')) {
          state.media.video = data.dataUrl;
          state.media.videoType = f.type;
        } else {
          state.media[kind] = data.dataUrl;
        }
      } else if (kind !== 'video') {
        return opts.toast?.('Choose a file first.');
      } else if (!yt) {
        return opts.toast?.('Upload a file or paste a YouTube URL.');
      }
      await saveMedia();
      $('sbMediaModal')?.classList.remove('show');
      if ($('sbMediaFile')) $('sbMediaFile').value = '';
    }

    function bindZones() {
      document.querySelectorAll('.sb-media-zone').forEach(zone => {
        zone.addEventListener('click', e => {
          if (e.target.closest('.sb-play-btn') && !isOwner()) return;
          e.preventDefault();
          const kind = zone.dataset.media;
          if (!kind) return;
          if (isOwner()) openEditor.call(this, kind);
          else if (kind === 'video') {
            const btn = zone.querySelector('.sb-play-btn');
            if (btn) btn.click();
          }
        });
      });
      $('sbMediaChangeBtn')?.addEventListener('click', () => $('sbMediaFile')?.click());
      $('sbMediaApplyBtn')?.addEventListener('click', () => applyChange());
      $('sbMediaCloseBtn')?.addEventListener('click', () => $('sbMediaModal')?.classList.remove('show'));
      $('sbMediaFile')?.addEventListener('change', async () => {
        const kind = state.editing;
        const f = $('sbMediaFile')?.files?.[0];
        if (!f || !kind) return;
        const preview = $('sbMediaPreview');
        const data = await fileToData(f);
        if (preview) {
          if (f.type.startsWith('video/')) preview.innerHTML = `<video src="${data.dataUrl}" controls style="max-width:100%"></video>`;
          else preview.innerHTML = `<img src="${data.dataUrl}" alt="" style="max-width:100%;border-radius:12px">`;
        }
      });
    }

    bindZones.call(this);
    loadMedia();

    return {
      refresh: () => { applyAll(); return loadMedia(); },
      getMedia: () => ({ ...state.media }),
      isOwner
    };
  }
};
window.SuperBookingMedia = window.AstranovSitesMedia;