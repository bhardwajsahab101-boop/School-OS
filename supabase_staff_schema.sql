-- 1. Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- nullable to support future logins or accounts created manually
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('Teacher', 'Admin', 'Accountant', 'Receptionist')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive')) DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create teacher_classes table (stores multiple class assignments for teachers)
CREATE TABLE IF NOT EXISTS teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_teacher_class UNIQUE (teacher_id, class_name)
);

-- 3. Auto-link the existing default administrator (admin@school.com)
-- We run a script inside a DO block to get the user ID for admin@school.com and insert it into staff
DO $$
DECLARE
  v_admin_id UUID;
  v_school_id UUID := '74d6f085-ee05-4ac3-bc9f-a261cef151d6';
BEGIN
  -- Retrieve user ID for admin@school.com from auth.users
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@school.com' LIMIT 1;
  
  -- Insert into staff
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO staff (school_id, user_id, full_name, email, phone, role, status)
    VALUES (v_school_id, v_admin_id, 'Admin User', 'admin@school.com', '+91 98765 43210', 'Admin', 'Active')
    ON CONFLICT (email) DO UPDATE 
    SET user_id = EXCLUDED.user_id, role = 'Admin';
  END IF;
END $$;
