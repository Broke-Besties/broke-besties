-- Create auth schema and table for shadow database (will skip in Supabase due to permissions)
DO $$
BEGIN
  -- Try to create auth schema (will succeed in shadow DB, fail gracefully in Supabase)
  CREATE SCHEMA IF NOT EXISTS auth;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Schema already exists or no permission
END $$;

DO $$
BEGIN
  -- Try to create minimal auth.users table (will succeed in shadow DB, fail gracefully in Supabase)
  CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL
  );
EXCEPTION
  WHEN insufficient_privilege OR duplicate_table THEN
    NULL; -- Table already exists or no permission
END $$;

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."User" (id, email, "createdAt", "updatedAt")
  VALUES (NEW.id, NEW.email, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after user creation in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
