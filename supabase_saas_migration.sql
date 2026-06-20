-- Supabase Multi-School SaaS Migration Script

-- 1. Alter schools table to add status columns (Super Admin preparation)
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'suspended')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'trial'));

-- Update existing school status
UPDATE schools
SET status = 'approved', subscription_status = 'active'
WHERE id = '74d6f085-ee05-4ac3-bc9f-a261cef151d6';

-- 2. Create profiles table (1-to-1 with auth.users for profile data like name)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create school_memberships table (enables users to manage multiple schools)
CREATE TABLE IF NOT EXISTS school_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Teacher', 'Accountant', 'Receptionist', 'SuperAdmin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_school UNIQUE (user_id, school_id)
);

-- 4. Recreate/normalize teacher_classes table
-- First, drop the existing teacher_classes table to rebuild it referencing class_id
DROP TABLE IF EXISTS teacher_classes CASCADE;

CREATE TABLE teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_teacher_class UNIQUE (teacher_id, class_id)
);

-- 5. Enable Row Level Security (RLS) on all ERP tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 6. Recreate public/anonymous RLS Policies

-- Clear legacy policies if any exist
DROP POLICY IF EXISTS "Allow public read schools" ON schools;
DROP POLICY IF EXISTS "Allow public all schools" ON schools;
DROP POLICY IF EXISTS "Allow public read classes" ON classes;
DROP POLICY IF EXISTS "Allow public all classes" ON classes;
DROP POLICY IF EXISTS "Allow public all fee_structure" ON fee_structure;
DROP POLICY IF EXISTS "Allow public all staff" ON staff;
DROP POLICY IF EXISTS "Allow public all teacher_classes" ON teacher_classes;
DROP POLICY IF EXISTS "Allow public all students" ON students;
DROP POLICY IF EXISTS "Allow public all attendance" ON attendance;
DROP POLICY IF EXISTS "Allow public all fees" ON fees;
DROP POLICY IF EXISTS "Allow public all documents" ON documents;
DROP POLICY IF EXISTS "Users can view their own memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can manage school memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can insert school memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can update school memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can delete school memberships" ON school_memberships;
DROP POLICY IF EXISTS "Anyone can create a membership during registration" ON school_memberships;
DROP POLICY IF EXISTS "Users can manage their own profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can create a profile during registration" ON profiles;



-- A. Profiles policies (view & update own profile)
CREATE POLICY "Users can manage their own profiles" ON profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Anyone can create a profile during registration" ON profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- B. School Memberships policies
CREATE POLICY "Users can view their own memberships" ON school_memberships
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "School admins can insert school memberships" ON school_memberships
  FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM school_memberships WHERE user_id = auth.uid() AND role = 'Admin'
    )
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

CREATE POLICY "School admins can update school memberships" ON school_memberships
  FOR UPDATE
  USING (
    school_id IN (
      SELECT school_id FROM school_memberships WHERE user_id = auth.uid() AND role = 'Admin'
    )
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

CREATE POLICY "School admins can delete school memberships" ON school_memberships
  FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM school_memberships WHERE user_id = auth.uid() AND role = 'Admin'
    )
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

CREATE POLICY "Anyone can create a membership during registration" ON school_memberships
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- C. Schools policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view details of schools they are members of" ON schools;

-- C. Schools policies
CREATE POLICY "Users can view details of schools they are members of" ON schools
  FOR SELECT
  USING (
    id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "School admins can update details of their school" ON schools;

-- C. Schools policies (update)
CREATE POLICY "School admins can update details of their school" ON schools
  FOR UPDATE
  USING (
    id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid() AND role = 'Admin')
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can insert a school during registration" ON schools;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can insert a school during registration" ON schools;

CREATE POLICY "Anyone can insert a school during registration" ON schools
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- D. Classes policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage classes of schools they are members of" ON classes;

-- D. Classes policies
CREATE POLICY "Users can manage classes of schools they are members of" ON classes
  FOR ALL
  USING (
    school_id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- E. Fee Structure policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage fee structures of their classes" ON fee_structure;

-- E. Fee Structure policies
CREATE POLICY "Users can manage fee structures of their classes" ON fee_structure
  FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE school_id IN (
        SELECT school_id FROM school_memberships WHERE user_id = auth.uid()
      )
    )
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- F. Staff policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage staff of schools they are members of" ON staff;

CREATE POLICY "Users can manage staff of schools they are members of" ON staff
  FOR ALL
  USING (
    school_id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- G. Teacher Classes policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage teacher classes of their staff" ON teacher_classes;

CREATE POLICY "Users can manage teacher classes of their staff" ON teacher_classes
  FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM staff WHERE school_id IN (
        SELECT school_id FROM school_memberships WHERE user_id = auth.uid()
      )
    )
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- H. Students policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage students of schools they are members of" ON students;

CREATE POLICY "Users can manage students of schools they are members of" ON students
  FOR ALL
  USING (
    school_id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- I. Attendance policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage attendance of schools they are members of" ON attendance;

CREATE POLICY "Users can manage attendance of schools they are members of" ON attendance
  FOR ALL
  USING (
    school_id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- J. Fees policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage fees of schools they are members of" ON fees;

CREATE POLICY "Users can manage fees of schools they are members of" ON fees
  FOR ALL
  USING (
    school_id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );

-- K. Documents policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage documents of schools they are members of" ON documents;

CREATE POLICY "Users can manage documents of schools they are members of" ON documents
  FOR ALL
  USING (
    school_id IN (SELECT school_id FROM school_memberships WHERE user_id = auth.uid())
    OR (SELECT TRUE FROM school_memberships WHERE user_id = auth.uid() AND role = 'SuperAdmin' LIMIT 1)
  );


-- 7. Seed migrations: Map existing default admin@school.com & superadmin@school.com users to profiles and memberships
DO $$
DECLARE
  v_admin_id UUID;
  v_super_admin_id UUID;
  v_school_id UUID := '74d6f085-ee05-4ac3-bc9f-a261cef151d6';
BEGIN
  -- Retrieve user ID for admin@school.com
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@school.com' LIMIT 1;
  
  IF v_admin_id IS NOT NULL THEN
    -- Seed profile
    INSERT INTO profiles (id, full_name)
    VALUES (v_admin_id, 'Admin User')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- Seed membership
    INSERT INTO school_memberships (user_id, school_id, role)
    VALUES (v_admin_id, v_school_id, 'Admin')
    ON CONFLICT (user_id, school_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;

  -- Retrieve user ID for superadmin@school.com
  SELECT id INTO v_super_admin_id FROM auth.users WHERE email = 'superadmin@school.com' LIMIT 1;
  
  IF v_super_admin_id IS NOT NULL THEN
    -- Seed profile
    INSERT INTO profiles (id, full_name)
    VALUES (v_super_admin_id, 'System Super Admin')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    -- Seed membership
    INSERT INTO school_memberships (user_id, school_id, role)
    VALUES (v_super_admin_id, v_school_id, 'SuperAdmin')
    ON CONFLICT (user_id, school_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;
END $$;
