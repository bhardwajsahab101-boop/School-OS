const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      process.env[key] = val;
    }
  });
} catch (e) {
  console.error('Error loading env file:', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
const superAdminPassword = process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log('--- Logging in as Super Admin ---');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: superAdminEmail,
      password: superAdminPassword
    });

    if (authError) {
      console.error('Super Admin Auth Error:', authError.message);
      return;
    }
    console.log('Logged in successfully! User ID:', authData.user.id);

    // 1. Fetch schools
    const { data: schools, error: schoolsErr } = await supabase.from('schools').select('*');
    console.log('\n--- Schools in Database ---');
    if (schoolsErr) console.error(schoolsErr);
    else console.log(schools);

    // 2. Fetch memberships
    const { data: memberships, error: membErr } = await supabase.from('school_memberships').select('*');
    console.log('\n--- School Memberships ---');
    if (membErr) console.error(membErr);
    else console.log(memberships);

    // 3. Fetch profiles
    const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
    console.log('\n--- Profiles ---');
    if (profErr) console.error(profErr);
    else console.log(profiles);

    // 4. Fetch staff registry
    const { data: staff, error: staffErr } = await supabase.from('staff').select('*');
    console.log('\n--- Staff Registry ---');
    if (staffErr) console.error(staffErr);
    else console.log(staff);

  } catch (e) {
    console.error('Execution error:', e);
  }
}

run();
