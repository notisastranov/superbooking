/* Astranov Match Engine — universal supply/demand matching for all business types */
window.AstranovMatchEngine = {
  resolveConfig(siteConfig) {
    const type = siteConfig?.businessType || siteConfig?.business_type || 'generic';
    const preset = window.AstranovMatchPresets?.[type] || window.AstranovMatchPresets?.generic || {};
    const override = siteConfig?.match_engine || siteConfig?.config?.match_engine || {};
    const activeFields = override.active_fields || siteConfig?.active_fields || null;
    const demandFields = activeFields?.demand || preset.demand_fields;
    const supplyFields = activeFields?.supply || preset.supply_fields;
    return {
      ...preset,
      businessType: type,
      siteId: siteConfig?.siteId || siteConfig?.id,
      demand_fields: demandFields,
      supply_fields: supplyFields,
      resources: { ...preset.resources, ...(override.resources || {}) },
      constraints: override.constraints || preset.constraints || {},
      enabled: override.enabled !== false,
    };
  },

  daysBetween(start, end) {
    const a = new Date(start);
    const b = new Date(end);
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  },

  overlap(a1, a2, b1, b2) {
    return a1 <= b2 && b1 <= a2;
  },

  covers(avail, start, end) {
    return avail.start_date <= start && avail.end_date >= end;
  },

  resourceAvailable(r, start, end, supplyId) {
    if (r.active === false) return false;
    if (r.available_from && start < r.available_from) return false;
    if (r.available_to && end > r.available_to) return false;
    const ids = r.supply_ids || r.yacht_ids || [];
    if (supplyId && ids.length && !ids.includes(supplyId)) return false;
    return true;
  },

  pickResources(pool, role, need, start, end, supplyId, defaultRates) {
    const rows = (pool || []).filter((r) =>
      r.role === role && this.resourceAvailable(r, start, end, supplyId)
    );
    if (rows.length >= need) return rows.slice(0, need);
    const rate = defaultRates?.[role] || 0;
    const stubs = [];
    for (let i = rows.length; i < need; i++) {
      stubs.push({ id: 'pool-' + role + '-' + i, role, display_name: role.replace(/_/g, ' '), rate_per_day_eur: rate, _pool: true });
    }
    return rows.concat(stubs);
  },

  normalizeDemand(demand, cfg) {
    const d = { ...demand };
    d.start_date = d.start_date || d.check_in || d.pickup_date || d.date;
    d.end_date = d.end_date || d.check_out || d.return_date || d.date;
    d.passengers = Number(d.passengers || d.guests || d.party_size || d.divers_count || d.quantity || 1);
    d.budget = d.budget != null ? Number(d.budget) : null;
    return d;
  },

  supplyCapacity(item, cfg) {
    const m = item.metadata || {};
    return Number(
      item[cfg.capacity_field]
      || m[cfg.capacity_field]
      || item.max_passengers
      || item.guest_capacity
      || item.capacity
      || item.seats
      || 999
    );
  },

  supplyPrice(item, cfg, days) {
    const perDay = Number(item[cfg.price_field] || item.price_per_day_eur || item.metadata?.price_per_day || 0);
    if (perDay) return perDay * days;
    const week = Number(item.price_week || item.metadata?.price_week || 0);
    if (week && days) return Math.ceil(week * (days / 7));
    return Number(item.price || item.metadata?.price || 0);
  },

  matchLocal(supply, resources, demand, cfg) {
    if (!cfg?.enabled) return [];
    const d = this.normalizeDemand(demand, cfg);
    const start = d.start_date;
    const end = d.end_date;
    const days = start && end ? this.daysBetween(start, end) : 1;
    const passengers = d.passengers;
    const maxDurField = cfg.max_duration_field;
    const resCfg = cfg.resources || {};
    const required = resCfg.required || {};
    const defaultRates = resCfg.default_rates || {};
    const matches = [];

    (supply || []).forEach((item) => {
      if (item.active === false) return;
      const cap = this.supplyCapacity(item, cfg);
      if (passengers > cap) return;
      if (maxDurField) {
        const maxD = Number(item[maxDurField] || item.metadata?.[maxDurField] || item.max_hire_days || 999);
        if (days > maxD) return;
      }
      if (d.budget != null && d.budget > 0) {
        const est = this.supplyPrice(item, cfg, days);
        if (est > d.budget * 1.15) return;
      }
      if (d.yacht_type && item.yacht_type && item.yacht_type !== d.yacht_type) return;

      const availability = item.availability || [];
      if (start && end && availability.length) {
        const bad = availability.some((a) =>
          ['blocked', 'booked', 'maintenance'].includes(a.status)
          && this.overlap(start, end, a.start_date, a.end_date)
        );
        const ok = availability.some((a) =>
          ['available', 'request_only'].includes(a.status) && this.covers(a, start, end)
        );
        if (bad || !ok) return;
      }

      const roster = [];
      let resourcesOk = true;
      if (resCfg.enabled) {
        Object.keys(required).forEach((role) => {
          const need = required[role] || 0;
          const picked = this.pickResources(resources, role, need, start, end, item.id, defaultRates);
          if (picked.length < need) resourcesOk = false;
          roster.push(...picked);
        });
        if (!resourcesOk) return;
      }

      const supplyTotal = this.supplyPrice(item, cfg, days);
      const resourceTotal = roster.reduce(
        (s, r) => s + days * Number(r.rate_per_day_eur || defaultRates[r.role] || 0), 0
      );
      const total = supplyTotal + resourceTotal;

      matches.push({
        supply: item,
        days,
        passengers,
        resources: roster,
        breakdown: { supply_total: supplyTotal, resource_total: resourceTotal, days },
        total,
        score: total,
      });
    });

    matches.sort((a, b) => a.score - b.score || b.passengers - a.passengers);
    return matches;
  },

  legacyYachtToSupply(y, availability) {
    const days = 7;
    const perDay = y.price_week ? Math.round(y.price_week / days) : 0;
    return {
      id: y.id,
      site_id: 'yachts',
      kind: 'yacht',
      name: y.name,
      active: y.active !== false,
      max_passengers: y.guest_capacity,
      max_hire_days: 30,
      price_per_day_eur: perDay,
      price_week: y.price_week,
      yacht_type: y.yacht_type,
      cabins: y.cabins,
      metadata: { legacy: 'yachting_yachts', characteristics: y.characteristics },
      availability: availability || y.availability || [],
    };
  },

  async fetchSupply(supa, siteConfig) {
    if (!supa) return { supply: [], resources: [] };
    const cfg = this.resolveConfig(siteConfig);
    const siteId = siteConfig.siteId || siteConfig.id;

    const [sRes, rRes] = await Promise.all([
      supa.from('booker_supply').select('*').eq('site_id', siteId).eq('active', true),
      supa.from('booker_resources').select('*').eq('site_id', siteId).eq('active', true),
    ]);

    let supply = sRes.data || [];
    let resources = rRes.data || [];

    if (!supply.length && cfg.legacy_tables?.catalog) {
      const { data: yachts } = await supa.from(cfg.legacy_tables.catalog).select('*').eq('active', true);
      let av = [];
      if (cfg.legacy_tables.availability) {
        const { data: avRows } = await supa.from(cfg.legacy_tables.availability).select('*');
        av = avRows || [];
      }
      supply = (yachts || []).map((y) =>
        this.legacyYachtToSupply(y, av.filter((a) => a.yacht_id === y.id))
      );
    }

    if (!resources.length && siteConfig.businessType === 'yacht_charter') {
      const { data: crew } = await supa.from('booker_crew').select('*').eq('site_id', siteId).eq('active', true);
      resources = (crew || []).map((c) => ({
        ...c,
        supply_ids: c.yacht_ids || [],
        rate_per_day_eur: c.rate_per_day_eur,
      }));
    }

    return { supply, resources, config: cfg };
  },

  async matchDemand(supa, siteConfig, demand) {
    const fleet = await this.fetchSupply(supa, siteConfig);
    const matches = this.matchLocal(fleet.supply, fleet.resources, demand, fleet.config);
    return { demand: this.normalizeDemand(demand, fleet.config), matches, best: matches[0] || null, config: fleet.config };
  },

  async persistMatch(supa, siteConfig, demand, result) {
    if (!supa || !result?.best) return null;
    const siteId = siteConfig.siteId || siteConfig.id;
    const row = {
      site_id: siteId,
      supply_id: result.best.supply.id,
      customer_id: siteConfig.customer_id || null,
      start_date: demand.start_date || demand.check_in,
      end_date: demand.end_date || demand.check_out,
      party_size: demand.passengers || demand.guests,
      status: 'matched',
      matched_payload: { matches: result.matches.slice(0, 8), picked: result.best },
      total_price: result.best.total,
      business_type: siteConfig.businessType,
    };
    const { data, error } = await supa.from('booker_match_requests').insert(row).select().single();
    if (error) throw error;
    return data;
  },

  formatMatch(m, cfg) {
    if (!m) return 'No match for this demand — adjust dates, capacity, or ask Coders to add supply.';
    const name = m.supply.name || m.supply.title || 'Supply';
    const res = (m.resources || []).map((r) =>
      (r.display_name || r.role) + ' ' + (r.rate_per_day_eur || 0) + '€/d'
    ).join(' · ');
    return name + ' · ' + m.days + 'd · ' + m.passengers + ' pax · '
      + Math.round(m.total) + ' EUR (supply ' + Math.round(m.breakdown.supply_total)
      + (m.breakdown.resource_total ? ' + ' + cfg?.resources?.label + ' ' + Math.round(m.breakdown.resource_total) : '')
      + ')' + (res ? ' · ' + res : '');
  },

  async requestField(supa, siteId, userId, spec) {
    const row = {
      site_id: siteId,
      user_id: userId,
      field_spec: spec,
      status: 'pending',
      notes: spec.description || '',
    };
    if (supa) {
      const { data, error } = await supa.from('booker_field_requests').insert(row).select().single();
      if (error) throw error;
      row.id = data.id;
    }
    try {
      window.parent?.postMessage?.({
        type: 'astranov-match-field-request',
        siteId,
        spec,
      }, '*');
    } catch (_) {}
    return row;
  },

  evolveFromText(text, siteConfig) {
    const low = String(text || '').toLowerCase();
    if (!/match|book|charter|yacht|dive|rent|reserve|κράτη|ενοικ/.test(low)) return null;
    const dates = text.match(/(\d{4}-\d{2}-\d{2})/g) || [];
    const cfg = this.resolveConfig(siteConfig || {});
    return {
      hint: 'Use match with site config — dates: ' + (dates.join(' → ') || 'missing'),
      config: cfg,
      coders: 'Ask Coders: develop field ' + (low.match(/field\s+(\w+)/)?.[1] || 'custom_param') + ' for ' + cfg.businessType,
    };
  },
};

window.YachtMatcher = {
  CREW_RATES: { captain: 300, vice_captain: 200, cadet: 100 },
  async matchDemand(opts) {
    const cfg = { siteId: opts.site_id, businessType: 'yacht_charter', customer_id: opts.customer_id };
    const supa = opts.supa || window.AstranovAuthBridge?.client;
    if (!supa) throw new Error('database required');
    const r = await AstranovMatchEngine.matchDemand(supa, cfg, opts);
    if (opts.persist !== false && r.best) await AstranovMatchEngine.persistMatch(supa, cfg, r.demand, r);
    return r;
  },
  formatMatch(m) {
    return AstranovMatchEngine.formatMatch(m, AstranovMatchEngine.resolveConfig({ businessType: 'yacht_charter' }));
  },
};