-- Fix frogschool login: pgcrypto lives in extensions schema on Supabase
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.fs_login(p_phone text, p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile public.fs_profiles%rowtype;
  v_token text;
BEGIN
  SELECT * INTO v_profile FROM public.fs_profiles
  WHERE phone = p_phone AND lower(email) = lower(p_email);

  IF NOT FOUND THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.fs_profiles (phone, email, display_name, password_hash, role, session_token)
    VALUES (
      p_phone, lower(p_email), split_part(p_email, '@', 1),
      crypt(p_password, gen_salt('bf')), 'customer', v_token
    )
    RETURNING * INTO v_profile;
  ELSE
    IF v_profile.password_hash IS DISTINCT FROM crypt(p_password, v_profile.password_hash) THEN
      RAISE EXCEPTION 'Invalid credentials';
    END IF;
    v_token := encode(gen_random_bytes(24), 'hex');
    UPDATE public.fs_profiles SET session_token = v_token
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;
  END IF;

  RETURN jsonb_build_object(
    'role', v_profile.role,
    'phone', v_profile.phone,
    'email', v_profile.email,
    'display_name', v_profile.display_name,
    'token', v_token,
    'profile_id', v_profile.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fs_login(text, text, text) TO anon, authenticated, service_role;