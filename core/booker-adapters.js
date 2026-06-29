/* Astranov Sites adapters — central DB: range (yachting) + slot (frogschool fs_*) */
window.AstranovSitesAdapters = {
  range(config) {
    const tables = {
      profiles: 'astranov_profiles',
      catalog: 'yachting_yachts',
      availability: 'yachting_availability',
      bookings: 'yachting_booking_requests',
      ...(config.tables || {})
    };
    let supa = null;
    const chars = v => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map(x => x.trim()).filter(Boolean) : []);
    const overlap = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
    const covers = (a, s, e) => a.start_date <= s && a.end_date >= e;

    return {
      async connect() {
        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return null;
        supa = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        return supa;
      },
      async listCatalog() {
        if (!supa) return [];
        const { data: y, error: e1 } = await supa.from(tables.catalog).select('*').eq('active', true).order('name');
        const { data: a, error: e2 } = await supa.from(tables.availability).select('*').order('start_date');
        if (e1 || e2) throw e1 || e2;
        return (y || []).map(row => ({ ...row, characteristics: chars(row.characteristics), availability: (a || []).filter(x => x.yacht_id === row.id) }));
      },
      filterCatalog(items, filters) {
        const { start_date: s, end_date: e, guests: g, cabins: c, budget: b, yacht_type: t, traits } = filters;
        const traitList = chars(traits).map(x => x.toLowerCase());
        return items.filter(y => {
          const av = y.availability || [];
          const bad = av.some(a => ['blocked', 'booked', 'maintenance'].includes(a.status) && overlap(s, e, a.start_date, a.end_date));
          const ok = !s || !e || av.some(a => ['available', 'request_only'].includes(a.status) && covers(a, s, e));
          if (bad || !ok) return false;
          if (g && y.guest_capacity < g) return false;
          if (c && y.cabins < c) return false;
          if (b && y.price_week > b) return false;
          if (t && y.yacht_type !== t) return false;
          const ch = chars(y.characteristics).join(' ').toLowerCase();
          return !traitList.length || traitList.every(x => ch.includes(x));
        });
      },
      async createBooking(data, userId) {
        if (!supa) throw new Error('Database not configured.');
        const payload = {
          yacht_id: data.yacht_id || null,
          user_id: userId || null,
          client_name: data.client_name,
          client_email: data.client_email,
          client_phone: data.client_phone,
          start_date: data.start_date,
          end_date: data.end_date,
          guests: +data.guests || null,
          cabins: +data.cabins || null,
          yacht_type: data.yacht_type || null,
          budget: data.budget ? +data.budget : null,
          currency: config.currency || 'EUR',
          desired_characteristics: chars(data.traits || data.desired_characteristics),
          message: data.message,
          status: 'waiting_for_answer'
        };
        const { error } = await supa.from(tables.bookings).insert(payload);
        if (error) throw error;
        if (window.SuperBookingDecentral?.replicate) {
          await SuperBookingDecentral.replicate(config, 'booking.created', payload);
        }
      },
      async loadProfile(user) {
        const { data, error } = await supa.from(tables.profiles).select('id,role,full_name,email').eq('id', user.id).maybeSingle();
        if (error) throw error;
        return data || { id: user.id, role: 'client', email: user.email, full_name: user.email };
      },
      tables
    };
  },

  slot(config) {
    const prefix = config.rpcPrefix || 'fs_';
    let supa = null;
    let session = null;
    const storeKey = config.storage?.reservations || `sb_${config.siteId}_reservations`;
    const sessionKey = config.storage?.session || `sb_${config.siteId}_session`;

    return {
      async connect() {
        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return null;
        supa = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        await window.AstranovAuthBridge?.init?.(config);
        return supa;
      },
      getSession() {
        const central = window.AstranovAuthBridge?.getCentralSession?.();
        if (central) return central;
        if (session) return session;
        try { session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { session = null; }
        return session;
      },
      setSession(s) { session = s; localStorage.setItem(sessionKey, JSON.stringify(s)); },
      async rpc(name, args) {
        if (!supa) return null;
        const { data, error } = await supa.rpc(prefix + name, args);
        if (error) throw error;
        return data;
      },
      async login(phone, email, password) {
        const d = await this.rpc('login', { p_phone: phone, p_email: email, p_password: password });
        const s = { role: d.role, phone: d.phone, email: d.email, name: d.display_name, token: d.token, profileId: d.profile_id };
        this.setSession(s);
        return s;
      },
      async saveReservation(r) {
        const s = this.getSession();
        if (!s?.token) throw new Error('Login required.');
        await this.rpc('upsert_reservation', {
          p_token: s.token, p_id: r.id || null,
          p_customer_name: r.client_name || r.customer,
          p_customer_phone: r.client_phone || r.phone,
          p_customer_email: r.client_email || r.email,
          p_reservation_date: r.date,
          p_timeslot: r.time,
          p_product_name: r.product,
          p_product_price_eur: r.productPrice || 0,
          p_product_includes: r.productIncludes || '',
          p_participants: r.people || [],
          p_divers_count: r.divers || 0,
          p_passengers_count: r.passengers || 0,
          p_kids_count: r.kids || 0,
          p_babies_count: r.babies || 0,
          p_certification_level: r.certification || '',
          p_number_of_dives: r.dives || 0,
          p_preferred_employee_name: r.employee || '',
          p_assigned_employee_name: r.employee || '',
          p_agent_name: r.agent || '',
          p_comments: r.comments || '',
          p_referral: r.referral || '',
          p_agreement_ack: r.agreement_ack || '',
          p_status: r.status || 'confirmed',
          p_payment_method: r.payment || 'CASH ON ARRIVAL ONLY'
        });
        if (window.SuperBookingDecentral?.replicate) {
          await SuperBookingDecentral.replicate(config, 'reservation.saved', r);
        }
      },
      async listReservations() {
        const s = this.getSession();
        if (!s?.token) return JSON.parse(localStorage.getItem(storeKey) || '[]');
        try {
          const d = await this.rpc('list_reservations', { p_token: s.token });
          if (!Array.isArray(d)) return [];
          const rows = d.map(x => ({
            id: x.id, date: x.reservation_date, time: x.timeslot,
            customer: x.customer_name, phone: x.customer_phone, email: x.customer_email,
            product: x.product_name, productPrice: Number(x.product_price_eur || 0),
            productIncludes: x.product_includes || '',
            divers: x.divers_count || 0, passengers: x.passengers_count || 0,
            kids: x.kids_count || 0, babies: x.babies_count || 0,
            certification: x.certification_level || '', dives: x.number_of_dives || 0,
            employee: x.assigned_employee_name || x.preferred_employee_name || '',
            referral: x.referral || '', status: x.status, payment: x.payment_method || ''
          }));
          localStorage.setItem(storeKey, JSON.stringify(rows));
          return rows;
        } catch { return JSON.parse(localStorage.getItem(storeKey) || '[]'); }
      },
      bookedCount(date, rows) {
        const list = rows || JSON.parse(localStorage.getItem(storeKey) || '[]');
        return slot => list.filter(r => r.date === date && r.time === slot && r.status !== 'cancelled').length;
      },
      productByName(name) {
        return (config.products || []).find(p => p.name.toLowerCase() === String(name || '').toLowerCase()) || null;
      }
    };
  },

  /** Universal supply/demand matcher — all business types */
  match(config) {
    let supa = null;
    const engine = window.AstranovMatchEngine;
    return {
      async connect() {
        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return null;
        supa = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        await window.AstranovAuthBridge?.init?.(config);
        return supa;
      },
      resolveConfig() {
        return engine?.resolveConfig?.(config) || {};
      },
      async runMatch(demand) {
        if (!engine) throw new Error('match-engine.js not loaded');
        const uid = window.AstranovAuthBridge?.user?.id || config.customer_id;
        return engine.matchDemand(supa, { ...config, customer_id: uid }, demand);
      },
      async saveMatch(demand, result) {
        return engine.persistMatch(supa, config, demand, result);
      },
      format(m) {
        return engine.formatMatch(m, engine.resolveConfig(config));
      },
      async requestField(spec) {
        const uid = window.AstranovAuthBridge?.user?.id;
        return engine.requestField(supa, config.siteId, uid, spec);
      },
    };
  },

  /** Yacht charter — matcher + legacy yachting booking */
  charter(config) {
    const matchAdapter = this.match({ ...config, businessType: 'yacht_charter', mode: 'range' });
    const rangeAdapter = this.range(config);
    return {
      async connect() {
        await matchAdapter.connect();
        await rangeAdapter.connect?.();
        return matchAdapter;
      },
      async runMatch(demand) {
        const r = await matchAdapter.runMatch(demand);
        if (r.best && config.persistMatch !== false) {
          try { await matchAdapter.saveMatch(r.demand, r); } catch (_) {}
        }
        return r;
      },
      format: (m) => matchAdapter.format(m),
      filterCatalog: (items, filters) => rangeAdapter.filterCatalog(items, filters),
      async listCatalog() { return rangeAdapter.listCatalog(); },
      async createBooking(data, userId) { return rangeAdapter.createBooking(data, userId); },
      requestField: (spec) => matchAdapter.requestField(spec),
    };
  },

  /** Multi-tenant provisioned sites — config from booker_site_by_domain, reservations in booker_reservations */
  tenant(config) {
    let supa = null;
    const storeKey = config.storage?.reservations || `sb_${config.siteId}_reservations`;

    return {
      async connect() {
        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) return null;
        supa = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        return supa;
      },
      getSession() { return null; },
      setSession() {},
      async rpc(name, args) {
        if (!supa) return null;
        const { data, error } = await supa.rpc(name, args);
        if (error) throw error;
        return data;
      },
      async login() { throw new Error('Login coming soon for provisioned sites.'); },
      async saveReservation(r) {
        if (!supa || !config.siteId) throw new Error('Site not configured.');
        const payload = {
          site_id: config.siteId,
          client_name: r.client_name || r.customer,
          client_phone: r.client_phone || r.phone,
          client_email: r.client_email || r.email,
          mode: config.mode || 'slot',
          slot_date: r.date,
          slot_time: r.time,
          party_size: r.divers || r.party_size || null,
          payload: r,
          status: r.status || 'pending',
          payment_method: r.payment || null,
          currency: config.currency || 'EUR',
          total_price: r.productPrice || null
        };
        const { error } = await supa.from('booker_reservations').insert(payload);
        if (error) throw error;
        const local = JSON.parse(localStorage.getItem(storeKey) || '[]');
        local.push({ ...r, id: 'local-' + Date.now() });
        localStorage.setItem(storeKey, JSON.stringify(local.slice(-100)));
        if (window.SuperBookingDecentral?.replicate) {
          await SuperBookingDecentral.replicate(config, 'reservation.saved', r);
        }
      },
      async listReservations() {
        return JSON.parse(localStorage.getItem(storeKey) || '[]');
      },
      bookedCount(date, rows) {
        const list = rows || JSON.parse(localStorage.getItem(storeKey) || '[]');
        return slot => list.filter(x => x.date === date && x.time === slot && x.status !== 'cancelled').length;
      },
      productByName(name) {
        return (config.products || []).find(p => p.name.toLowerCase() === String(name || '').toLowerCase()) || null;
      }
    };
  }
};
window.SuperBookingAdapters = window.AstranovSitesAdapters;
window.SuperBookerAdapters = window.AstranovSitesAdapters;
window.SuperBookerFields = window.SuperBookingFields;