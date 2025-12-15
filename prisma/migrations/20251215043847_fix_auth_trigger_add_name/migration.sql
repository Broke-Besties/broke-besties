-- Update the handle_new_user function to include the name field
-- This fixes Google OAuth signup by extracting name from user metadata
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

  -- Insert new user into User table
  INSERT INTO public."User" (id, email, name, "createdAt", "updatedAt")
  VALUES (
    NEW.id,                    -- User ID from Supabase auth.users
    NEW.email,                 -- Email from Supabase auth.users
    user_name,                 -- Name from OAuth metadata or email prefix
    NOW(),                     -- Current timestamp for createdAt
    NOW()                      -- Current timestamp for updatedAt
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
