-- Universal supply/demand match engine — all business types

CREATE TABLE IF NOT EXISTS booker_match_config (
  site_id text PRIMARY KEY REFERENCES booker_sites(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  active_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_supply (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL REFERENCES booker_sites(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'service',
  name text NOT NULL,
  description text,
  capacity integer,
  max_passengers integer,
  max_hire_days integer,
  price_per_day_eur numeric DEFAULT 0,
  price numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL REFERENCES booker_sites(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  rate_per_day_eur numeric NOT NULL DEFAULT 0,
  supply_ids uuid[] NOT NULL DEFAULT '{}',
  available_from date,
  available_to date,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_match_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL REFERENCES booker_sites(id) ON DELETE CASCADE,
  supply_id uuid,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  business_type text,
  start_date date,
  end_date date,
  party_size integer,
  demand_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'matching' CHECK (status IN ('matching', 'matched', 'pending_payment', 'confirmed', 'cancelled')),
  matched_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_price numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booker_field_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id text NOT NULL REFERENCES booker_sites(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field_spec jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booker_supply_site_idx ON booker_supply(site_id, kind);
CREATE INDEX IF NOT EXISTS booker_resources_site_idx ON booker_resources(site_id, role);
CREATE INDEX IF NOT EXISTS booker_match_requests_site_idx ON booker_match_requests(site_id, created_at DESC);

ALTER TABLE booker_match_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booker_field_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY booker_supply_public_read ON booker_supply FOR SELECT USING (active = true);
CREATE POLICY booker_resources_public_read ON booker_resources FOR SELECT USING (active = true);
CREATE POLICY booker_match_guest_insert ON booker_match_requests FOR INSERT WITH CHECK (true);
CREATE POLICY booker_field_requests_owner ON booker_field_requests FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Migrate booker_yachts → booker_supply if present
INSERT INTO booker_supply (site_id, kind, name, max_passengers, max_hire_days, price_per_day_eur, metadata, active)
SELECT site_id, 'yacht', name, max_passengers, max_hire_days, price_per_day_eur,
  jsonb_build_object('migrated_from', 'booker_yachts', 'required_crew', required_crew) || COALESCE(metadata, '{}'::jsonb),
  active
FROM booker_yachts y
WHERE NOT EXISTS (SELECT 1 FROM booker_supply s WHERE s.site_id = y.site_id AND s.name = y.name);

INSERT INTO booker_resources (site_id, display_name, role, rate_per_day_eur, supply_ids, active)
SELECT site_id, display_name, role, rate_per_day_eur, yacht_ids, active
FROM booker_crew c
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booker_crew')
  AND NOT EXISTS (SELECT 1 FROM booker_resources r WHERE r.site_id = c.site_id AND r.role = c.role AND r.display_name = c.display_name);

-- Seed yachts site crew defaults
INSERT INTO booker_resources (site_id, display_name, role, rate_per_day_eur, active)
SELECT 'yachts', 'Captain pool', 'captain', 300, true
WHERE EXISTS (SELECT 1 FROM booker_sites WHERE id = 'yachts')
  AND NOT EXISTS (SELECT 1 FROM booker_resources WHERE site_id = 'yachts' AND role = 'captain');
INSERT INTO booker_resources (site_id, display_name, role, rate_per_day_eur, active)
SELECT 'yachts', 'Vice captain pool', 'vice_captain', 200, true
WHERE EXISTS (SELECT 1 FROM booker_sites WHERE id = 'yachts')
  AND NOT EXISTS (SELECT 1 FROM booker_resources WHERE site_id = 'yachts' AND role = 'vice_captain');
INSERT INTO booker_resources (site_id, display_name, role, rate_per_day_eur, active)
SELECT 'yachts', 'Cadet sailor pool', 'cadet', 100, true
WHERE EXISTS (SELECT 1 FROM booker_sites WHERE id = 'yachts')
  AND NOT EXISTS (SELECT 1 FROM booker_resources WHERE site_id = 'yachts' AND role = 'cadet');

-- Sync yachting_yachts into booker_supply for site yachts (legacy bridge; optional table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'yachting_yachts'
  ) THEN
    INSERT INTO booker_supply (site_id, kind, name, max_passengers, price_per_day_eur, metadata, active)
    SELECT 'yachts', 'yacht', y.name, y.guest_capacity,
      CASE WHEN y.price_week > 0 THEN round(y.price_week / 7.0) ELSE 0 END,
      jsonb_build_object('legacy_yachting_id', y.id, 'yacht_type', y.yacht_type, 'cabins', y.cabins, 'price_week', y.price_week, 'characteristics', y.characteristics),
      COALESCE(y.active, true)
    FROM yachting_yachts y
    WHERE NOT EXISTS (
      SELECT 1 FROM booker_supply s
      WHERE s.site_id = 'yachts' AND s.metadata->>'legacy_yachting_id' = y.id::text
    );
  END IF;
END $$;

GRANT SELECT ON booker_supply TO anon, authenticated;
GRANT SELECT ON booker_resources TO anon, authenticated;