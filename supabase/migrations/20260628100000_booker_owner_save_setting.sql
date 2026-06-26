-- Owner saves via central Astranov Identity (auth.uid) — click-to-edit on sites
CREATE OR REPLACE FUNCTION public.booker_owner_save_setting(
  p_site_id text,
  p_key text,
  p_value jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'login_required';
  END IF;
  SELECT owner_id, COALESCE(config->>'rpcPrefix', 'fs_') INTO v_owner, v_prefix
  FROM booker_sites WHERE id = p_site_id AND active = true;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not_site_owner';
  END IF;
  IF p_key = 'site_media' THEN
    UPDATE booker_sites SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{media}', p_value, true)
    WHERE id = p_site_id;
  ELSIF p_key = 'site_content' THEN
    UPDATE booker_sites SET
      branding = COALESCE(branding, '{}'::jsonb) || COALESCE(p_value->'branding', '{}'::jsonb),
      contact = COALESCE(contact, '{}'::jsonb) || COALESCE(p_value->'contact', '{}'::jsonb),
      config = jsonb_set(COALESCE(config, '{}'::jsonb), '{content}', p_value, true)
    WHERE id = p_site_id;
  ELSE
    UPDATE booker_sites SET config = jsonb_set(COALESCE(config, '{}'::jsonb), ARRAY['settings', p_key], p_value, true)
    WHERE id = p_site_id;
  END IF;
  RETURN p_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.booker_owner_save_setting(text, text, jsonb) TO authenticated;