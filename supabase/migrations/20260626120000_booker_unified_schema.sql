-- AstranoV Super Booker unified schema (future multi-tenant layer)
-- Existing yachting_* and fs_* adapters remain valid; this adds booker_* for new businesses.

create extension if not exists pgcrypto;

create table if not exists public.booker_sites (
  id text primary key,
  domain text not null unique,
  business_type text not null default 'generic',
  mode text not null default 'slot' check (mode in ('slot', 'range')),
  branding jsonb not null default '{}'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booker_products (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.booker_sites(id) on delete cascade,
  name text not null,
  description text,
  price numeric check (price is null or price >= 0),
  currency text not null default 'EUR',
  includes text,
  images jsonb not null default '[]'::jsonb,
  prep_time_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.booker_availability (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.booker_sites(id) on delete cascade,
  product_id uuid null references public.booker_products(id) on delete cascade,
  start_at timestamptz,
  end_at timestamptz,
  slot_date date,
  slot_time time,
  capacity integer not null default 1 check (capacity > 0),
  booked integer not null default 0 check (booked >= 0),
  status text not null default 'available' check (status in ('available','blocked','booked','maintenance','request_only')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.booker_reservations (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references public.booker_sites(id) on delete cascade,
  product_id uuid null references public.booker_products(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  mode text not null check (mode in ('slot', 'range')),
  start_date date,
  end_date date,
  slot_date date,
  slot_time time,
  party_size integer,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  payment_method text,
  currency text not null default 'EUR',
  total_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booker_products_site_idx on public.booker_products(site_id);
create index if not exists booker_availability_site_idx on public.booker_availability(site_id, slot_date);
create index if not exists booker_reservations_site_idx on public.booker_reservations(site_id, created_at desc);

alter table public.booker_sites enable row level security;
alter table public.booker_products enable row level security;
alter table public.booker_availability enable row level security;
alter table public.booker_reservations enable row level security;

create policy booker_sites_public_read on public.booker_sites for select using (active = true);
create policy booker_products_public_read on public.booker_products for select using (active = true);
create policy booker_availability_public_read on public.booker_availability for select using (true);
create policy booker_reservations_guest_insert on public.booker_reservations for insert with check (true);