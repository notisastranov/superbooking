-- FrogSchool SuperBooking on central AstranoV Supabase (lkoatrkhuigdolnjsbie)
-- Slot-mode site_id: frogschool · RPC prefix fs_

insert into public.booker_sites (id, domain, business_type, mode, branding, contact, config)
values (
  'frogschool',
  'frogschool.astranov.eu',
  'diving_school',
  'slot',
  '{"title":"AstranoV FrogSchool","subtitle":"Diving · MartialSthenics · Rhodes"}'::jsonb,
  '{"phone":"+306971930225","vhf":"FrogSchool","email":"notiscs@gmail.com","address":"Rhodes, Greece"}'::jsonb,
  '{"rpcPrefix":"fs_","currency":"EUR"}'::jsonb
) on conflict (id) do update set
  domain = excluded.domain,
  business_type = excluded.business_type,
  config = excluded.config,
  updated_at = now();

create table if not exists public.fs_profiles (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  email text not null,
  display_name text,
  password_hash text not null,
  role text not null default 'customer' check (role in ('customer','employee','agent','admin','super_admin')),
  session_token text unique,
  created_at timestamptz not null default now(),
  unique (phone, email)
);

create table if not exists public.fs_reservations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.fs_profiles(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  reservation_date date not null,
  timeslot text not null,
  product_name text,
  product_price_eur numeric default 0,
  product_includes text,
  participants jsonb default '[]'::jsonb,
  divers_count integer default 0,
  passengers_count integer default 0,
  kids_count integer default 0,
  babies_count integer default 0,
  certification_level text,
  number_of_dives integer default 0,
  preferred_employee_name text,
  assigned_employee_name text,
  agent_name text,
  comments text,
  referral text,
  agreement_ack text,
  status text not null default 'confirmed',
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fs_messages (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid references public.fs_profiles(id) on delete set null,
  sender_name text,
  sender_role text,
  client_phone text,
  body text,
  message_type text default 'text',
  file_name text,
  mime_type text,
  file_data_url text,
  target text default 'operators',
  created_at timestamptz not null default now()
);

create table if not exists public.fs_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.fs_login(p_phone text, p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles%rowtype; v_token text;
begin
  select * into v_profile from public.fs_profiles where phone = p_phone and lower(email) = lower(p_email);
  if not found then
    v_token := encode(gen_random_bytes(24), 'hex');
    insert into public.fs_profiles (phone, email, display_name, password_hash, role, session_token)
    values (p_phone, lower(p_email), split_part(p_email, '@', 1), crypt(p_password, gen_salt('bf')), 'customer', v_token)
    returning * into v_profile;
  else
    if v_profile.password_hash is distinct from crypt(p_password, v_profile.password_hash) then
      raise exception 'Invalid credentials';
    end if;
    v_token := encode(gen_random_bytes(24), 'hex');
    update public.fs_profiles set session_token = v_token where id = v_profile.id returning * into v_profile;
  end if;
  return jsonb_build_object('role', v_profile.role, 'phone', v_profile.phone, 'email', v_profile.email,
    'display_name', v_profile.display_name, 'token', v_token, 'profile_id', v_profile.id);
end; $$;

create or replace function public.fs_profile_from_token(p_token text)
returns public.fs_profiles language sql stable security definer set search_path = public as $$
  select * from public.fs_profiles where session_token = p_token limit 1;
$$;

create or replace function public.fs_list_reservations(p_token text)
returns setof public.fs_reservations language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
begin
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if v_profile.role in ('admin','super_admin') then
    return query select * from public.fs_reservations order by reservation_date desc, timeslot;
  elsif v_profile.role = 'employee' then
    return query select * from public.fs_reservations where assigned_employee_name = v_profile.display_name order by reservation_date desc;
  else
    return query select * from public.fs_reservations where customer_phone = v_profile.phone order by reservation_date desc;
  end if;
end; $$;

create or replace function public.fs_upsert_reservation(
  p_token text, p_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_reservation_date date, p_timeslot text, p_product_name text, p_product_price_eur numeric,
  p_product_includes text, p_participants jsonb, p_divers_count int, p_passengers_count int,
  p_kids_count int, p_babies_count int, p_certification_level text, p_number_of_dives int,
  p_preferred_employee_name text, p_assigned_employee_name text, p_agent_name text,
  p_comments text, p_referral text, p_agreement_ack text, p_status text, p_payment_method text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles; v_id uuid;
begin
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if p_id is not null then
    update public.fs_reservations set
      customer_name = p_customer_name, customer_phone = p_customer_phone, customer_email = p_customer_email,
      reservation_date = p_reservation_date, timeslot = p_timeslot, product_name = p_product_name,
      product_price_eur = p_product_price_eur, product_includes = p_product_includes,
      participants = coalesce(p_participants, '[]'::jsonb), divers_count = p_divers_count,
      passengers_count = p_passengers_count, kids_count = p_kids_count, babies_count = p_babies_count,
      certification_level = p_certification_level, number_of_dives = p_number_of_dives,
      preferred_employee_name = p_preferred_employee_name, assigned_employee_name = p_assigned_employee_name,
      agent_name = p_agent_name, comments = p_comments, referral = p_referral,
      agreement_ack = p_agreement_ack, status = p_status, payment_method = p_payment_method,
      updated_at = now()
    where id = p_id returning id into v_id;
  else
    insert into public.fs_reservations (
      profile_id, customer_name, customer_phone, customer_email, reservation_date, timeslot,
      product_name, product_price_eur, product_includes, participants, divers_count, passengers_count,
      kids_count, babies_count, certification_level, number_of_dives, preferred_employee_name,
      assigned_employee_name, agent_name, comments, referral, agreement_ack, status, payment_method
    ) values (
      v_profile.id, p_customer_name, p_customer_phone, p_customer_email, p_reservation_date, p_timeslot,
      p_product_name, p_product_price_eur, p_product_includes, coalesce(p_participants, '[]'::jsonb),
      p_divers_count, p_passengers_count, p_kids_count, p_babies_count, p_certification_level,
      p_number_of_dives, p_preferred_employee_name, p_assigned_employee_name, p_agent_name,
      p_comments, p_referral, p_agreement_ack, p_status, p_payment_method
    ) returning id into v_id;
  end if;
  return v_id;
end; $$;

alter table public.fs_profiles enable row level security;
alter table public.fs_reservations enable row level security;
alter table public.fs_messages enable row level security;
alter table public.fs_settings enable row level security;

create policy fs_reservations_insert on public.fs_reservations for insert with check (true);
create policy fs_reservations_select on public.fs_reservations for select using (true);
create policy fs_messages_insert on public.fs_messages for insert with check (true);
create policy fs_messages_select on public.fs_messages for select using (true);