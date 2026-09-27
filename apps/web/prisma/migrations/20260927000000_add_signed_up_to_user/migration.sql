-- AlterTable
ALTER TABLE "User" ADD COLUMN "signedUp" BOOLEAN NOT NULL DEFAULT true;

-- Recreate the auth trigger to adopt a placeholder User row (created via
-- "add friend by email" before the person signs up) on signup. Because every
-- User foreign key is declared with ON UPDATE CASCADE, updating the primary
-- key `id` to the new auth.users UUID automatically re-points all existing
-- debts/friends/invites/memberships at the real user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- Extract name from OAuth metadata (Google provides this)
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',  -- Try Google's full_name field first
    NEW.raw_user_meta_data->>'name'        -- Try Google's name field second
  );

  -- If no name found and this is an OAuth user, raise an error
  -- Email/password users won't have metadata, so we allow NULL for them
  IF user_name IS NULL AND NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data != '{}'::jsonb THEN
    RAISE EXCEPTION 'OAuth user missing name in metadata. User ID: %, Email: %', NEW.id, NEW.email;
  END IF;

  -- For email/password users (no metadata), use email prefix as fallback
  IF user_name IS NULL THEN
    user_name := SPLIT_PART(NEW.email, '@', 1);
  END IF;

  -- Upsert on email: adopt an existing placeholder row (signedUp = false) by
  -- swapping its id to the real auth user id, or create a brand new user.
  INSERT INTO public."User" (id, email, name, "signedUp", "createdAt", "updatedAt")
  VALUES (NEW.id, NEW.email, user_name, TRUE, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    "signedUp" = TRUE,
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
