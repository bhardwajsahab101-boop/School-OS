const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env vars
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
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    const studentId = "7d9d55f9-e27c-4187-af24-f3fb3d226fd1";
    const schoolId = "74d6f085-ee05-4ac3-bc9f-a261cef151d6";
    const email = `temp_${Math.random().toString(36).substring(2, 9)}@example.com`;
    const password = "Password123!";

    console.log(`Signing up test user: ${email}...`);
    const signUpRes = await supabase.auth.signUp({ email, password });
    if (signUpRes.error) {
      console.error('Sign up failed:', signUpRes.error.message);
      return;
    }
    console.log('Sign up successful!');

    console.log('Signing in as test user...');
    const signInRes = await supabase.auth.signInWithPassword({ email, password });
    if (signInRes.error) {
      console.error('Sign in failed:', signInRes.error.message);
      return;
    }
    console.log('Sign in successful!');

    console.log('Testing fee insert as authenticated user...');
    const insertRes = await supabase.from('fees').insert({
      student_id: studentId,
      school_id: schoolId,
      amount: 1200,
      status: 'unpaid',
      month: 'Test Authenticated Fee'
    }).select();
    
    console.log('Insert result:', JSON.stringify(insertRes));
  } catch (e) {
    console.error('Test error:', e);
  }
}

test();
