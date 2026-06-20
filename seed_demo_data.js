const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local
try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      process.env[key] = val;
    }
  });
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const schoolId = '74d6f085-ee05-4ac3-bc9f-a261cef151d6';

const firstNames = ['Aarav', 'Vihaan', 'Kabir', 'Sai', 'Arjun', 'Aditya', 'Krishna', 'Reyansh', 'Ishaan', 'Rahul', 'Ananya', 'Diya', 'Aditi', 'Sanya', 'Pari', 'Sneha', 'Meera', 'Riya', 'Kavya', 'Avani'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Joshi', 'Mehta', 'Nair', 'Rao', 'Choudhury', 'Sen', 'Das', 'Mishra'];
const parentNames = ['Rajesh', 'Sunita', 'Ramesh', 'Geeta', 'Sanjay', 'Anita', 'Anil', 'Kiran', 'Vijay', 'Meena', 'Rakesh', 'Suman', 'Manoj', 'Pooja', 'Vikram'];
const cities = ['New Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Kolkata', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Jaipur', 'Lucknow'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
}

async function seed() {
  console.log('--- STARTING DEMO DATA SEEDING ---');

  // 1. Clean up existing tables
  console.log('Deleting existing data...');
  
  const { error: delDocsErr } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delDocsErr) console.warn('Warning deleting docs:', delDocsErr.message);

  const { error: delAttErr } = await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delAttErr) console.warn('Warning deleting attendance:', delAttErr.message);

  const { error: delFeesErr } = await supabase.from('fees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delFeesErr) console.warn('Warning deleting fees:', delFeesErr.message);

  const { error: delStudErr } = await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delStudErr) {
    console.error('Error deleting students:', delStudErr.message);
    process.exit(1);
  }
  console.log('Successfully cleared database.');

  // 2. Generate 50 students
  console.log('Generating 50 demo students...');
  const studentsToInsert = [];
  for (let i = 1; i <= 50; i++) {
    const gender = Math.random() > 0.5 ? 'Male' : 'Female';
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const pName = `${getRandomElement(parentNames)} ${lastName}`;
    const pPhone = `+91 ${Math.floor(6000000000 + Math.random() * 4000000000)}`;
    const className = String(Math.floor(1 + Math.random() * 10)); // Class 1 to 10
    const dob = getRandomDate(new Date(2010, 0, 1), new Date(2020, 11, 31));
    const admDate = getRandomDate(new Date(2024, 0, 1), new Date(2026, 5, 1));
    const address = `${Math.floor(1 + Math.random() * 200)}, Pocket ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}, Vasant Kunj, ${getRandomElement(cities)}`;

    studentsToInsert.push({
      school_id: schoolId,
      full_name: fullName,
      parent_name: pName,
      parent_phone: pPhone,
      class_name: className,
      gender: gender,
      date_of_birth: dob,
      admission_date: admDate,
      address: address
    });
  }

  const { data: insertedStudents, error: insertStudErr } = await supabase
    .from('students')
    .insert(studentsToInsert)
    .select();

  if (insertStudErr || !insertedStudents) {
    console.error('Error inserting students:', insertStudErr?.message || 'No data returned');
    process.exit(1);
  }
  console.log(`Inserted ${insertedStudents.length} students successfully.`);

  // 3. Generate attendance and fees for each student
  console.log('Generating fees and attendance records...');
  const feesToInsert = [];
  const attendanceToInsert = [];

  for (const student of insertedStudents) {
    // Generate 1-3 fees
    // Admission Fee
    feesToInsert.push({
      student_id: student.id,
      school_id: schoolId,
      amount: 5000,
      status: Math.random() > 0.1 ? 'paid' : 'pending',
      month: 'Admission Fee'
    });

    // Term 1 Fee
    if (Math.random() > 0.3) {
      feesToInsert.push({
        student_id: student.id,
        school_id: schoolId,
        amount: 3000,
        status: Math.random() > 0.5 ? 'paid' : 'pending',
        month: 'Term 1 Fee'
      });
    }

    // Term 2 Fee
    if (Math.random() > 0.6) {
      feesToInsert.push({
        student_id: student.id,
        school_id: schoolId,
        amount: 3500,
        status: 'pending',
        month: 'Term 2 Fee'
      });
    }

    // Generate last 10 days of attendance
    for (let d = 0; d < 10; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      attendanceToInsert.push({
        student_id: student.id,
        school_id: schoolId,
        date: date.toISOString().split('T')[0],
        status: Math.random() > 0.12 ? 'present' : 'absent'
      });
    }
  }

  // Batch insert fees
  console.log(`Inserting ${feesToInsert.length} fee records...`);
  const { error: feesErr } = await supabase.from('fees').insert(feesToInsert);
  if (feesErr) console.error('Error inserting fees:', feesErr.message);

  // Batch insert attendance
  console.log(`Inserting ${attendanceToInsert.length} attendance logs...`);
  const chunkSize = 200;
  for (let i = 0; i < attendanceToInsert.length; i += chunkSize) {
    const chunk = attendanceToInsert.slice(i, i + chunkSize);
    const { error: attErr } = await supabase.from('attendance').insert(chunk);
    if (attErr) console.error(`Error inserting attendance chunk at index ${i}:`, attErr.message);
  }

  console.log('--- SEEDING COMPLETED SUCCESSFULLY ---');
}

seed();
