const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env vars from .env.local
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
} catch (e) {
  console.warn('Failed to parse .env.local:', e.message);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'superadmin@school.com';
const password = process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD || 'SuperPassword123!';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSuperAdmin() {
  console.log(`Signing up Super Admin user: ${email}...`);
  const signUpRes = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'System Super Admin'
      }
    }
  });

  if (signUpRes.error) {
    if (signUpRes.error.message.includes('already registered') || signUpRes.error.message.includes('already exists')) {
      console.log('Super Admin user is already registered in Auth.');
    } else {
      console.error('Error signing up Super Admin:', signUpRes.error.message);
      process.exit(1);
    }
  } else {
    console.log('Super Admin user signed up successfully!');
  }

  console.log('Logging in as Super Admin to establish session context for RLS...');
  const signInRes = await supabase.auth.signInWithPassword({ email, password });
  if (signInRes.error) {
    console.error('Login failed:', signInRes.error.message);
    process.exit(1);
  }

  const user = signInRes.data.user;
  const token = signInRes.data.session.access_token;
  console.log('Login successful! User ID:', user.id);

  // Authenticate Supabase client for active RLS profiles/memberships policies
  const authSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });

  console.log('Upserting user profile...');
  const profileRes = await authSupabase.from('profiles').upsert({
    id: user.id,
    full_name: 'System Super Admin'
  });

  if (profileRes.error) {
    console.error('Profile creation failed:', profileRes.error.message);
  } else {
    console.log('Profile created successfully!');
  }

  // Get default school ID
  const schoolRes = await authSupabase.from('schools').select('id').limit(1);
  let schoolId = '74d6f085-ee05-4ac3-bc9f-a261cef151d6'; // fallback
  if (!schoolRes.error && schoolRes.data && schoolRes.data.length > 0) {
    schoolId = schoolRes.data[0].id;
  }
  console.log('Using active school ID for membership:', schoolId);

  console.log('Creating SuperAdmin membership record...');
  const membershipRes = await authSupabase.from('school_memberships').upsert({
    user_id: user.id,
    school_id: schoolId,
    role: 'SuperAdmin'
  }, { onConflict: 'user_id,school_id' });

  if (membershipRes.error) {
    console.error('SuperAdmin membership creation failed:', membershipRes.error.message);
  } else {
    console.log('SuperAdmin membership created/verified successfully!');
    console.log('\n=============================================');
    console.log('Super Admin User ready:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('=============================================');
  }
}

createSuperAdmin();
