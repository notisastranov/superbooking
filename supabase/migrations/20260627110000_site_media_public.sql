-- Public read for site_media (profile, cover, video, background) on all SuperBooking tenants

create or replace function public.fs_get_setting(p_token text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.fs_profiles;
  v_value jsonb;
begin
  if p_key in ('agreement_jpeg', 'site_media') then
    select value into v_value from public.fs_settings where key = p_key;
    return coalesce(v_value, '{}'::jsonb);
  end if;
  select * into v_profile from public.fs_profile_from_token(p_token);
  if v_profile.id is null then raise exception 'Invalid session'; end if;
  if v_profile.role not in ('admin', 'super_admin', 'employee') and p_key not in ('agreement_jpeg', 'site_media') then
    raise exception 'Not allowed';
  end if;
  select value into v_value from public.fs_settings where key = p_key;
  return coalesce(v_value, '{}'::jsonb);
end; $$;

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
    'config', s.config,
    'media', coalesce(s.config->'media', '{}'::jsonb)
  )
  from public.booker_sites s
  where s.active = true
    and (lower(s.domain) = lower(p_domain) or lower(s.slug || '.astranov.eu') = lower(p_domain))
  limit 1;
$$;