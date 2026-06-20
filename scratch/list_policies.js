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
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
const superAdminPassword = process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD;

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

    const token = authData.session.access_token;
    const authSupabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Query active policies
    const { data: policies, error: polErr } = await authSupabase
      .rpc('execute_sql_query', { 
        sql_query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('schools', 'profiles', 'school_memberships')" 
      });

    if (polErr) {
      console.log('RPC execute_sql_query not available, trying custom query...');
      // If RPC is not available, we can read what policies are defined by trying to fetch policies through postgres system queries if exposed,
      // or we can test if we can insert a school anonymouse/authenticated.
      // Let's try inserting a test school as anonymous to see if it fails.
      console.log('\nTesting anonymous insert on schools...');
      const anonSupabase = createClient(supabaseUrl, supabaseKey);
      const { data: anonData, error: anonErr } = await anonSupabase
        .from('schools')
        .insert({ name: 'Test Anon School ' + Date.now() })
        .select();
      
      console.log('Anonymous insert result:', anonErr ? `FAILED: ${anonErr.message}` : `SUCCESS: ${JSON.stringify(anonData)}`);

      console.log('\nTesting authenticated insert on schools...');
      const { data: authDataSchool, error: authErrSchool } = await authSupabase
        .from('schools')
        .insert({ name: 'Test Auth School ' + Date.now() })
        .select();

      console.log('Authenticated insert result:', authErrSchool ? `FAILED: ${authErrSchool.message}` : `SUCCESS: ${JSON.stringify(authDataSchool)}`);
    } else {
      console.log('\n--- Active Policies ---');
      console.log(policies);
    }

  } catch (e) {
    console.error('Error:', e);
  }
}

run();
