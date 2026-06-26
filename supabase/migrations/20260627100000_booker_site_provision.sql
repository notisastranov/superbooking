-- Instant SuperBooking web presence: any user → {slug}.astranov.eu

alter table public.booker_sites
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists vendor_id text references public.vendors(id) on delete set null,
  add column if not exists slug text;

create unique index if not exists booker_sites_slug_idx on public.booker_sites (slug) where slug is not null;

create table if not exists public.booker_site_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_id text references public.vendors(id) on delete set null,
  site_id text references public.booker_sites(id) on delete set null,
  slug text not null,
  business_name text not null,
  business_type text not null default 'generic',
  mode text not null default 'slot' check (mode in ('slot', 'range')),
  domain text,
  status text not null default 'live' check (status in ('pending', 'provisioning', 'live', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists booker_site_requests_user_idx on public.booker_site_requests (user_id, created_at desc);

alter table public.booker_site_requests enable row level security;

do $$ begin
  create policy booker_site_requests_owner_read on public.booker_site_requests
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create or replace function public.booker_site_by_domain(p_domain text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id,
    'domain', s.domain,
    'slug', s.slug,
    'business_type', s.business_type,
    'mode', s.mode,
    'branding', s.branding,
    'contact', s.contact,
    'config', s.config
  )
  from public.booker_sites s
  where s.active = true
    and (lower(s.domain) = lower(p_domain) or lower(s.slug || '.astranov.eu') = lower(p_domain))
  limit 1;
$$;

create or replace function public.booker_provision_site(
  p_slug text,
  p_business_name text,
  p_business_type text default 'generic',
  p_mode text default 'slot',
  p_vendor_id text default null,
  p_contact jsonb default '{}'::jsonb,
  p_branding jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_slug text;
  v_domain text;
  v_site_id text;
  v_existing public.booker_sites%rowtype;
  v_email text;
  v_name text;
begin
  if v_user is null then raise exception 'login_required'; end if;

  v_slug := lower(regexp_replace(trim(coalesce(p_slug, '')), '[^a-z0-9-]', '-', 'g'));
  v_slug := regexp_replace(v_slug, '-{2,}', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  if length(v_slug) < 3 or length(v_slug) > 32 then
    raise exception 'slug must be 3-32 characters (a-z, 0-9, hyphen)';
  end if;

  if v_slug in ('www', 'api', 'app', 'mail', 'admin', 'astranov', 'booker', 'superbooking', 'frogschool', 'yachts') then
    raise exception 'slug reserved';
  end if;

  select * into v_existing from public.booker_sites where slug = v_slug or id = v_slug or lower(domain) = v_slug || '.astranov.eu';
  if found and v_existing.owner_id is distinct from v_user then
    raise exception 'slug already taken';
  end if;

  v_domain := v_slug || '.astranov.eu';
  v_site_id := v_slug;
  v_name := coalesce(nullif(trim(p_business_name), ''), v_slug);

  select email into v_email from auth.users where id = v_user;

  if found then
    update public.booker_sites set
      business_type = coalesce(nullif(p_business_type, ''), business_type),
      mode = coalesce(nullif(p_mode, ''), mode),
      branding = branding || coalesce(p_branding, '{}'::jsonb) || jsonb_build_object('title', v_name),
      contact = contact || coalesce(p_contact, '{}'::jsonb),
      vendor_id = coalesce(p_vendor_id, vendor_id),
      owner_id = v_user,
      active = true,
      updated_at = now()
    where id = v_existing.id
    returning * into v_existing;
  else
    insert into public.booker_sites (
      id, slug, domain, owner_id, vendor_id, business_type, mode,
      branding, contact, config, active
    ) values (
      v_site_id, v_slug, v_domain, v_user, p_vendor_id,
      coalesce(nullif(p_business_type, ''), 'generic'),
      coalesce(nullif(p_mode, ''), 'slot'),
      coalesce(p_branding, '{}'::jsonb) || jsonb_build_object('title', v_name, 'subtitle', v_domain),
      coalesce(p_contact, '{}'::jsonb) || jsonb_build_object('email', v_email),
      jsonb_build_object('rpcPrefix', 'booker_', 'provisioned', true, 'currency', 'EUR'),
      true
    ) returning * into v_existing;
  end if;

  insert into public.booker_site_requests (
    user_id, vendor_id, site_id, slug, business_name, business_type, mode, domain, status
  ) values (
    v_user, p_vendor_id, v_existing.id, v_slug, v_name,
    v_existing.business_type, v_existing.mode, v_domain, 'live'
  );

  return jsonb_build_object(
    'ok', true,
    'site_id', v_existing.id,
    'slug', v_slug,
    'domain', v_domain,
    'url', 'https://' || v_domain,
    'business_type', v_existing.business_type,
    'mode', v_existing.mode
  );
end; $$;

do $$ begin
  create policy booker_sites_owner_read on public.booker_sites
    for select using (auth.uid() = owner_id);
exception when duplicate_object then null;
end $$;

grant execute on function public.booker_site_by_domain(text) to anon, authenticated;
grant execute on function public.booker_provision_site(text, text, text, text, text, jsonb, jsonb) to authenticated;