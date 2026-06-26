/* Astranov Sites — replicate writes to Decentralized Server apps (Win/Mac/Android/iOS) */
window.AstranovSitesDecentral = {
  STORAGE_NODE: 'astranov_decentral_node_v1',
  STORAGE_QUEUE: 'astranov_superbooking_sync_queue_v1',

  getNodeEndpoint(config) {
    if (config?.decentral?.nodeUrl) return config.decentral.nodeUrl.replace(/\/$/, '');
    try {
      const raw = localStorage.getItem(this.STORAGE_NODE);
      if (raw) {
        const j = JSON.parse(raw);
        return (j.url || j.endpoint || '').replace(/\/$/, '');
      }
    } catch { /* */ }
    if (window.AstranovNode?.nodeId) return null;
    return null;
  },

  registerNode(url, meta = {}) {
    if (!url) return;
    localStorage.setItem(this.STORAGE_NODE, JSON.stringify({
      url: url.replace(/\/$/, ''),
      platform: meta.platform || SuperBookingDecentral.detectPlatform(),
      registeredAt: Date.now(),
      ...meta
    }));
  },

  detectPlatform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/mac/i.test(ua)) return 'mac';
    if (/win/i.test(ua)) return 'windows';
    return 'desktop';
  },

  queue(event) {
    try {
      const q = JSON.parse(localStorage.getItem(this.STORAGE_QUEUE) || '[]');
      q.push({ ...event, queuedAt: Date.now() });
      localStorage.setItem(this.STORAGE_QUEUE, JSON.stringify(q.slice(-200)));
    } catch { /* */ }
  },

  async flushQueue(config) {
    const node = this.getNodeEndpoint(config);
    if (!node) return { flushed: 0 };
    let q = [];
    try { q = JSON.parse(localStorage.getItem(this.STORAGE_QUEUE) || '[]'); } catch { /* */ }
    let flushed = 0;
    const remain = [];
    for (const item of q) {
      const ok = await this._post(node, config?.decentral?.syncPath || '/superbooking/sync', item);
      if (ok) flushed++; else remain.push(item);
    }
    localStorage.setItem(this.STORAGE_QUEUE, JSON.stringify(remain));
    return { flushed, pending: remain.length };
  },

  async replicate(config, event, payload) {
    const body = {
      siteId: config.siteId,
      domain: config.domain,
      businessType: config.businessType,
      mode: config.mode,
      event,
      payload,
      platform: this.detectPlatform(),
      nodeId: window.AstranovNode?.nodeId || null,
      ts: Date.now()
    };
    const node = this.getNodeEndpoint(config);
    if (!node) {
      this.queue(body);
      return { ok: false, queued: true, reason: 'no_decentral_node' };
    }
    const path = config.decentral?.syncPath || '/superbooking/sync';
    const ok = await this._post(node, path, body);
    if (!ok) this.queue(body);
    return { ok, queued: !ok };
  },

  async _post(node, path, body) {
    try {
      const r = await fetch(node + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      });
      return r.ok;
    } catch {
      return false;
    }
  }
};
window.SuperBookingDecentral = window.AstranovSitesDecentral;