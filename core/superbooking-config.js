/* Astranov Sites — central AstranoV database config (all *.astranov.eu tenants) */
window.ASTRANOV_CENTRAL_DB = {
  supabaseRef: 'lkoatrkhuigdolnjsbie',
  supabaseUrl: 'https://lkoatrkhuigdolnjsbie.supabase.co',
  customUrl: 'https://api.astranov.eu',
  useCustomDomain: false,
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI',
  profilesTable: 'astranov_profiles'
};

window.ASTRANOV_SITES_DEFAULTS = {
  decentral: {
    enabled: true,
    syncPath: '/superbooking/sync',
    storageKey: 'astranov_decentral_node_v1',
    platforms: ['windows', 'mac', 'android', 'ios']
  },
  database: 'central'
};
window.ASTRANOV_SUPERBOOKING_DEFAULTS = window.ASTRANOV_SITES_DEFAULTS;

function astranovCentralSupabaseUrl() {
  const c = window.ASTRANOV_CENTRAL_DB;
  return c.useCustomDomain && c.customUrl ? c.customUrl : c.supabaseUrl;
}

function applyCentralDatabase(config) {
  const c = window.ASTRANOV_CENTRAL_DB;
  if (!c) return config;
  if (config.database === 'legacy') return config;
  return {
    ...config,
    database: config.database || 'central',
    supabaseUrl: config.supabaseUrl || astranovCentralSupabaseUrl(),
    supabaseAnonKey: config.supabaseAnonKey || c.supabaseAnonKey,
    tables: { profiles: c.profilesTable, ...(config.tables || {}) }
  };
}