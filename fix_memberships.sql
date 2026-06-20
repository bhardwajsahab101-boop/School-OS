-- 1. Correct SELECT policies on school_memberships to allow Admins & SuperAdmins to view them
DROP POLICY IF EXISTS "Users can view their own memberships" ON school_memberships;
CREATE POLICY "Users and admins can view school memberships" ON school_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR school_id IN (
      SELECT school_id FROM school_memberships WHERE user_id = auth.uid() AND role = 'Admin'
    )
    OR EXISTS (
      SELECT 1 FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin'
    )
  );

-- 2. Correct policies on profiles to allow Admins & SuperAdmins to view and insert them for staff
DROP POLICY IF EXISTS "Users can manage their own profiles" ON profiles;
CREATE POLICY "Users and admins can manage profiles" ON profiles
  FOR ALL
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM school_memberships 
      WHERE user_id = auth.uid() 
      AND role IN ('Admin', 'SuperAdmin')
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM school_memberships 
      WHERE user_id = auth.uid() 
      AND role IN ('Admin', 'SuperAdmin')
    )
  );

-- 3. Synchronize existing staff accounts that are missing profiles or memberships
-- Create missing profiles for existing staff
INSERT INTO public.profiles (id, full_name)
SELECT user_id, full_name 
FROM public.staff 
WHERE user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Create missing memberships for existing staff
INSERT INTO public.school_memberships (user_id, school_id, role)
SELECT user_id, school_id, 
  CASE 
    WHEN role = 'Admin' THEN 'Admin'::text
    WHEN role = 'Teacher' THEN 'Teacher'::text
    WHEN role = 'Accountant' THEN 'Accountant'::text
    WHEN role = 'Receptionist' THEN 'Receptionist'::text
    ELSE 'Teacher'::text
  END
FROM public.staff 
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, school_id) DO NOTHING;

-- 4. Set up an automatic trigger to ensure profiles & memberships are created on future auth.users creations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_school_id UUID;
  v_role TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract values from user metadata
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'New User');
  v_school_id := (new.raw_user_meta_data->>'school_id')::UUID;
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'Teacher');

  -- Insert profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, v_full_name)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name;

  -- Insert school membership if school_id metadata exists
  IF v_school_id IS NOT NULL THEN
    INSERT INTO public.school_memberships (user_id, school_id, role)
    VALUES (new.id, v_school_id, v_role)
    ON CONFLICT (user_id, school_id) DO UPDATE
    SET role = EXCLUDED.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Correct INSERT policy on schools to allow any user (including anonymous registration flows) to register a school
DROP POLICY IF EXISTS "Anyone can insert a school during registration" ON schools;
CREATE POLICY "Anyone can insert a school during registration" ON schools
  FOR INSERT
  WITH CHECK (
    true
  );
