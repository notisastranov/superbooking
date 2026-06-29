# Astranov Sites

Multipurpose booking & web presence engine for all `*.astranov.eu` business subdomains (evolved from SuperBooker). Every tenant talks to the **central AstranoV Supabase** (`lkoatrkhuigdolnjsbie`), with optional replication to **Astranov Decentralized Server** apps (Windows, Mac, Android, iOS).

## Stack

| Layer | Files |
|-------|-------|
| Central DB config | `core/superbooking-config.js` |
| UI + progressive forms | `core/booker-core.js`, `core/booker-fields.js`, `core/booker-theme.css` |
| Adapters | `core/booker-adapters.js` (`range` · `slot` · `match` · `charter`) |
| Match engine | `core/match-engine.js`, `core/match-presets.js` — supply/demand for every business |
| Decentral sync | `core/superbooking-decentral.js` |

## Configuration

```html
<script src="core/superbooking-config.js"></script>
<script>
window.ASTRANOV_SITES_CONFIG = {  // legacy: ASTRANOV_SUPERBOOKING_CONFIG
  siteId: "frogschool",
  domain: "frogschool.astranov.eu",
  businessType: "diving_school",
  mode: "slot",
  database: "central",
  rpcPrefix: "fs_",
  youtubeVideoId: "DH02kmLRgUA",
  contact: { phone: "+30...", vhf: "FrogSchool", email: "..." },
  decentral: { enabled: true, nodeUrl: "http://192.168.1.10:8787" }
};
</script>
```

Omit `supabaseUrl` / `supabaseAnonKey` to auto-use central AstranoV database.

`window.ASTRANOV_BOOKER_CONFIG` and `window.ASTRANOV_YACHTING_CONFIG` remain supported.

## Decentralized Server

When an Astranov node app is running, register its endpoint:

```js
AstranovSitesDecentral.registerNode('http://localhost:8787', { platform: 'windows' });
// legacy alias: SuperBookingDecentral
```

Writes replicate to `{nodeUrl}/superbooking/sync`. Offline events queue in `localStorage` and flush when the node returns.

## Deployment sites

| Repo | Domain | Mode | Tables/RPC |
|------|--------|------|------------|
| `yachts.astranov.eu` | yachts.astranov.eu | range | `yachting_*` |
| `frogschool.astranov.eu` | frogschool.astranov.eu | slot | `fs_*` on central |

## Migrations (central Supabase)

```bash
supabase link --project-ref lkoatrkhuigdolnjsbie
supabase db push
```

- `20260626120000_booker_unified_schema.sql` — multi-tenant `booker_*`
- `20260626130000_superbooking_frogschool_central.sql` — FrogSchool `fs_*` on central