/* Astranov Identity bridge — central Supabase session in shell + standalone sites */
window.AstranovAuthBridge = {
  client: null,
  user: null,
  session: null,
  siteId: null,
  isSiteOwner: false,

  async init(config = {}) {
    this.siteId = config.siteId || null;
    const url = config.supabaseUrl || window.ASTRANOV_SITES_DEFAULTS?.supabaseUrl || window.ASTRANOV_CENTRAL_DB?.url;
    const key = config.supabaseAnonKey || window.ASTRANOV_SITES_DEFAULTS?.supabaseAnonKey || window.ASTRANOV_CENTRAL_DB?.anonKey;
    if (!url || !key || !window.supabase) return null;
    this.client = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'astranov_auth_v2' }
    });
    const { data } = await this.client.auth.getSession();
    this.session = data?.session || null;
    this.user = this.session?.user || null;
    this.client.auth.onAuthStateChange((_e, s) => {
      this.session = s;
      this.user = s?.user || null;
      this._refreshOwner();
      window.dispatchEvent(new CustomEvent('astranov-auth', { detail: { user: this.user } }));
    });
    if (this._inShell()) {
      window.addEventListener('message', e => this._onParentAuth(e));
      try { window.parent.postMessage({ type: 'astranov-auth-request' }, '*'); } catch { /* */ }
    }
    await this._refreshOwner();
    return this;
  },

  _inShell() {
    try {
      const p = new URLSearchParams(location.search);
      return p.get('shell') === '1' || p.get('embed') === '1' || window.self !== window.top;
    } catch { return false; }
  },

  async _onParentAuth(e) {
    if (!e.data || e.data.type !== 'astranov-auth' || !this.client) return;
    try {
      await this.client.auth.setSession({
        access_token: e.data.access_token,
        refresh_token: e.data.refresh_token
      });
    } catch { /* */ }
  },

  async _refreshOwner() {
    this.isSiteOwner = false;
    if (!this.user?.id || !this.siteId) return;
    try {
      const { data } = await this.client.from('booker_sites').select('owner_id').eq('id', this.siteId).maybeSingle();
      this.isSiteOwner = data?.owner_id === this.user.id;
    } catch { /* */ }
  },

  getCentralSession() {
    if (!this.user) return null;
    return {
      role: this.isSiteOwner ? 'admin' : 'user',
      email: this.user.email,
      name: this.user.user_metadata?.full_name || this.user.user_metadata?.name || this.user.email?.split('@')[0],
      userId: this.user.id,
      token: this.session?.access_token,
      central: true
    };
  },

  async ensureSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    this.session = data?.session || null;
    this.user = this.session?.user || null;
    return this.session;
  },

  async signInOAuth(provider = 'google') {
    if (!this.client) throw new Error('Auth not ready');
    const redirectTo = window.location.origin + window.location.pathname + window.location.search;
    const { error } = await this.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: false }
    });
    if (error) throw error;
  }
};