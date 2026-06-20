-- ========================================================
-- 1. CREATE SECURITY DEFINER HELPER FUNCTIONS (RLS Bypasses)
-- ========================================================

-- Helper to check if a user is an Admin of a given school
CREATE OR REPLACE FUNCTION public.check_user_is_school_admin(p_user_id UUID, p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships 
    WHERE user_id = p_user_id 
      AND school_id = p_school_id 
      AND role = 'Admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper to check if a user is a Member of a given school
CREATE OR REPLACE FUNCTION public.check_user_is_school_member(p_user_id UUID, p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships 
    WHERE user_id = p_user_id 
      AND school_id = p_school_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper to check if a user is a SuperAdmin
CREATE OR REPLACE FUNCTION public.check_user_is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships 
    WHERE user_id = p_user_id 
      AND role = 'SuperAdmin'
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ========================================================
-- 2. RECONFIGURE school_memberships POLICIES (Recursion-Free)
-- ========================================================

-- Drop old recursive policies
DROP POLICY IF EXISTS "Users and admins can view school memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can insert school memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can update school memberships" ON school_memberships;
DROP POLICY IF EXISTS "School admins can delete school memberships" ON school_memberships;
DROP POLICY IF EXISTS "Anyone can create a membership during registration" ON school_memberships;

-- Re-enable RLS
ALTER TABLE school_memberships ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy: Users can see their own memberships, school Admins can see memberships in their school, SuperAdmins can see all
CREATE POLICY "Select school memberships" ON school_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.check_user_is_school_admin(auth.uid(), school_id)
    OR public.check_user_is_super_admin(auth.uid())
  );

-- 2. INSERT policy: School admins can add memberships to their school, SuperAdmins can add any, and new signups can insert their own initial Admin membership
CREATE POLICY "Insert school memberships" ON school_memberships
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.check_user_is_school_admin(auth.uid(), school_id)
    OR public.check_user_is_super_admin(auth.uid())
  );

-- 3. UPDATE policy: School admins can update memberships in their school, SuperAdmins can update any
CREATE POLICY "Update school memberships" ON school_memberships
  FOR UPDATE
  USING (
    public.check_user_is_school_admin(auth.uid(), school_id)
    OR public.check_user_is_super_admin(auth.uid())
  );

-- 4. DELETE policy: School admins can delete memberships in their school, SuperAdmins can delete any
CREATE POLICY "Delete school memberships" ON school_memberships
  FOR DELETE
  USING (
    public.check_user_is_school_admin(auth.uid(), school_id)
    OR public.check_user_is_super_admin(auth.uid())
  );


-- ========================================================
-- 3. RECONFIGURE schools POLICIES
-- ========================================================

DROP POLICY IF EXISTS "Anyone can insert a school during registration" ON schools;
DROP POLICY IF EXISTS "Users can view details of schools they are members of" ON schools;
DROP POLICY IF EXISTS "School admins can update details of their school" ON schools;

-- Re-enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy
CREATE POLICY "Users can view details of schools they are members of" ON schools
  FOR SELECT
  USING (
    public.check_user_is_school_member(auth.uid(), id)
    OR public.check_user_is_super_admin(auth.uid())
  );

-- 2. UPDATE policy
CREATE POLICY "School admins can update details of their school" ON schools
  FOR UPDATE
  USING (
    public.check_user_is_school_admin(auth.uid(), id)
    OR public.check_user_is_super_admin(auth.uid())
  );

-- 3. INSERT policy: Allow any authenticated user (or registration request) to create a school tenant record
CREATE POLICY "Anyone can insert a school during registration" ON schools
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );


-- ========================================================
-- 4. RECONFIGURE staff POLICIES (No SuperAdmin bypass)
-- ========================================================

DROP POLICY IF EXISTS "Users can manage staff of schools they are members of" ON staff;
DROP POLICY IF EXISTS "Manage staff" ON staff;

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage staff" ON staff
  FOR ALL
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  );


-- ========================================================
-- 5. RECONFIGURE students POLICIES (No SuperAdmin bypass)
-- ========================================================

DROP POLICY IF EXISTS "Users can manage students of schools they are members of" ON students;
DROP POLICY IF EXISTS "Manage students" ON students;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage students" ON students
  FOR ALL
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  );


-- ========================================================
-- 6. RECONFIGURE OTHER TABLES POLICIES (No SuperAdmin bypass)
-- ========================================================

-- A. Classes
DROP POLICY IF EXISTS "Users can manage classes of schools they are members of" ON classes;
CREATE POLICY "Users can manage classes of schools they are members of" ON classes
  FOR ALL
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  );

-- B. Fee Structure
DROP POLICY IF EXISTS "Users can manage fee structures of their classes" ON fee_structure;
CREATE POLICY "Users can manage fee structures of their classes" ON fee_structure
  FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE public.check_user_is_school_member(auth.uid(), school_id)
    )
  );

-- C. Teacher Classes
DROP POLICY IF EXISTS "Users can manage teacher classes of their staff" ON teacher_classes;
CREATE POLICY "Users can manage teacher classes of their staff" ON teacher_classes
  FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM staff WHERE public.check_user_is_school_member(auth.uid(), school_id)
    )
  );

-- D. Attendance
DROP POLICY IF EXISTS "Users can manage attendance of schools they are members of" ON attendance;
CREATE POLICY "Users can manage attendance of schools they are members of" ON attendance
  FOR ALL
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  );

-- E. Fees
DROP POLICY IF EXISTS "Users can manage fees of schools they are members of" ON fees;
CREATE POLICY "Users can manage fees of schools they are members of" ON fees
  FOR ALL
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  );

-- F. Documents
DROP POLICY IF EXISTS "Users can manage documents of schools they are members of" ON documents;
CREATE POLICY "Users can manage documents of schools they are members of" ON documents
  FOR ALL
  USING (
    public.check_user_is_school_member(auth.uid(), school_id)
  );
