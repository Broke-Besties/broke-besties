-- A native Sign in with Apple id token never carries the user's name, so the previous
-- version of this function raised for every first-time Apple sign-in (Supabase Auth
-- then fails the sign-up with a 500). Fall back to the email prefix instead.
--
-- search_path is pinned because this runs as SECURITY DEFINER; every reference below
-- is schema-qualified or a pg_catalog built-in.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
BEGIN
  user_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  )), '');

  -- Apple (and email/password) sign-ups have no name: fall back to the email prefix.
  -- The app PATCHes /api/user with the Apple-provided name right after first sign-in.
  IF user_name IS NULL THEN
    user_name := SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1);
  END IF;

  INSERT INTO public."User" (id, email, name, "createdAt", "updatedAt")
  VALUES (NEW.id, NEW.email, user_name, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
