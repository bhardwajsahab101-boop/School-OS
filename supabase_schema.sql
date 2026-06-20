-- 1. Alter the schools table to add necessary metadata fields
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS academic_session TEXT;

-- Update existing default schools with some initial info
UPDATE schools
SET address = '123 Main Street, New Delhi, India',
    phone = '+91 98765 43210',
    email = 'info@littleplay.edu',
    academic_session = '2026-27 Session'
WHERE id = '74d6f085-ee05-4ac3-bc9f-a261cef151d6';

-- 2. Create the classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_school_class_name UNIQUE (school_id, name)
);

-- Enable RLS for classes table (if needed, otherwise standard public access)
-- ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read classes" ON classes FOR SELECT USING (true);
-- CREATE POLICY "Allow public all classes" ON classes FOR ALL USING (true);

-- 3. Create the fee_structure table
CREATE TABLE IF NOT EXISTS fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID UNIQUE NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  monthly_fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for fee_structure table
-- ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;

-- 4. Seed initial default classes and monthly fees for the active school (ID: '74d6f085-ee05-4ac3-bc9f-a261cef151d6')
-- We use a DO block to prevent duplicate key violations if they already exist
DO $$
DECLARE
  v_school_id UUID := '74d6f085-ee05-4ac3-bc9f-a261cef151d6';
  v_class_id UUID;
BEGIN
  -- Class 1: Nursery
  INSERT INTO classes (school_id, name)
  VALUES (v_school_id, 'Nursery')
  ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_class_id;

  INSERT INTO fee_structure (class_id, monthly_fee)
  VALUES (v_class_id, 500)
  ON CONFLICT (class_id) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;

  -- Class 2: LKG
  INSERT INTO classes (school_id, name)
  VALUES (v_school_id, 'LKG')
  ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_class_id;

  INSERT INTO fee_structure (class_id, monthly_fee)
  VALUES (v_class_id, 600)
  ON CONFLICT (class_id) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;

  -- Class 3: UKG
  INSERT INTO classes (school_id, name)
  VALUES (v_school_id, 'UKG')
  ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_class_id;

  INSERT INTO fee_structure (class_id, monthly_fee)
  VALUES (v_class_id, 700)
  ON CONFLICT (class_id) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;

  -- Class 4: Class 1
  INSERT INTO classes (school_id, name)
  VALUES (v_school_id, 'Class 1')
  ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_class_id;

  INSERT INTO fee_structure (class_id, monthly_fee)
  VALUES (v_class_id, 800)
  ON CONFLICT (class_id) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;

  -- Class 5: Class 2
  INSERT INTO classes (school_id, name)
  VALUES (v_school_id, 'Class 2')
  ON CONFLICT (school_id, name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_class_id;

  INSERT INTO fee_structure (class_id, monthly_fee)
  VALUES (v_class_id, 900)
  ON CONFLICT (class_id) DO UPDATE SET monthly_fee = EXCLUDED.monthly_fee;
END $$;
