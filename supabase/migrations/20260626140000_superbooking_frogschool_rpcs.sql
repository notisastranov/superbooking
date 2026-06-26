-- FrogSchool SuperBooking RPCs: messenger, settings, master data, decentral sync log

create table if not exists public.astranov_superbooking_sync (
  id uuid primary key default gen_random_uuid(),
  site_id text,
  domain text,
  business_type text,
  mode text,
  event text,
  payload jsonb default '{}'::jsonb,
  platform text,
  node_id text,
  client_ts bigint,
  received_at timestamptz not null default now()
);

create index if not exists astranov_superbooking_sync_site_idx
  on public.astranov_superbooking_sync (site_id, received_at desc);

alter table public.astranov_superbooking_sync enable row level security;

do $$ begin
  create policy astranov_superbooking_sync_insert on public.astranov_superbooking_sync
    for insert with check (true);
exception when duplicate_object then null;
end $$;

create or replace function public.fs_get_setting(p_token text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
  v_value jsonb;
begin
  if p_key = 'agreement_jpeg' then
    select value into v_value from public.fs_settings where key = p_key;
    return coalesce(v_value, '{}'::jsonb);
  end if;
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if v_profile.role not in ('admin', 'super_admin', 'employee') and p_key not in ('agreement_jpeg') then
    raise exception 'Not allowed';
  end if;
  select value into v_value from public.fs_settings where key = p_key;
  return coalesce(v_value, '{}'::jsonb);
end; $$;

create or replace function public.fs_save_setting(p_token text, p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
begin
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if v_profile.role not in ('admin', 'super_admin') then raise exception 'Admin only'; end if;
  insert into public.fs_settings (key, value, updated_at)
  values (p_key, coalesce(p_value, '{}'::jsonb), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end; $$;

create or replace function public.fs_save_master_data(
  p_token text,
  p_products jsonb,
  p_employees jsonb,
  p_agents jsonb,
  p_referrals jsonb,
  p_timeslots jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
begin
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if v_profile.role not in ('admin', 'super_admin') then raise exception 'Admin only'; end if;
  insert into public.fs_settings (key, value, updated_at)
  values ('master_data', jsonb_build_object(
    'products', coalesce(p_products, '[]'::jsonb),
    'employees', coalesce(p_employees, '[]'::jsonb),
    'agents', coalesce(p_agents, '[]'::jsonb),
    'referrals', coalesce(p_referrals, '[]'::jsonb),
    'timeslots', coalesce(p_timeslots, '{}'::jsonb)
  ), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  update public.booker_sites set
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'products', coalesce(p_products, '[]'::jsonb),
      'employees', coalesce(p_employees, '[]'::jsonb),
      'agents', coalesce(p_agents, '[]'::jsonb),
      'referrals', coalesce(p_referrals, '[]'::jsonb),
      'timeslots', coalesce(p_timeslots, '{}'::jsonb)
    ),
    updated_at = now()
  where id = 'frogschool';
end; $$;

create or replace function public.fs_send_message(
  p_token text,
  p_client_phone text,
  p_body text,
  p_message_type text default 'text',
  p_file_name text default null,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_file_data_url text default null,
  p_target text default 'operators'
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
  v_id uuid;
  v_client text;
begin
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  v_client := coalesce(nullif(trim(p_client_phone), ''), v_profile.phone);
  if v_profile.role = 'customer' and v_client <> v_profile.phone then
    raise exception 'Customers may only message on their own phone';
  end if;
  insert into public.fs_messages (
    sender_profile_id, sender_name, sender_role, client_phone, body,
    message_type, file_name, mime_type, file_data_url, target
  ) values (
    v_profile.id,
    coalesce(v_profile.display_name, v_profile.phone),
    v_profile.role,
    v_client,
    coalesce(p_body, ''),
    coalesce(nullif(p_message_type, ''), 'text'),
    p_file_name,
    p_mime_type,
    p_file_data_url,
    coalesce(nullif(p_target, ''), 'operators')
  ) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.fs_list_messages(p_token text, p_client_phone text default null)
returns setof public.fs_messages language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
begin
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if v_profile.role in ('admin', 'super_admin', 'employee') then
    if p_client_phone is not null and trim(p_client_phone) <> '' then
      return query select * from public.fs_messages
        where client_phone = p_client_phone
        order by created_at asc;
    else
      return query select * from public.fs_messages order by created_at asc;
    end if;
  else
    return query select * from public.fs_messages
      where client_phone = v_profile.phone
      order by created_at asc;
  end if;
end; $$;

create or replace function public.astranov_superbooking_sync_ingest(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.astranov_superbooking_sync (
    site_id, domain, business_type, mode, event, payload, platform, node_id, client_ts
  ) values (
    p_payload->>'siteId',
    p_payload->>'domain',
    p_payload->>'businessType',
    p_payload->>'mode',
    p_payload->>'event',
    coalesce(p_payload->'payload', '{}'::jsonb),
    p_payload->>'platform',
    p_payload->>'nodeId',
    (p_payload->>'ts')::bigint
  ) returning id into v_id;
  return v_id;
end; $$;