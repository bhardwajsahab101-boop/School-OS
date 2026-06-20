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

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFees() {
  const { data, error } = await supabase.from('fees').select('*');
  if (error) {
    console.error('Error fetching fees:', error);
  } else {
    console.log('Total fee records in DB:', data.length);
    const combinedMonths = data.filter(f => {
      const mStr = f.month || '';
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const matches = months.filter(m => mStr.toLowerCase().includes(m.toLowerCase()));
      return matches.length > 1;
    });
    console.log('Fee records with combined months in DB:', JSON.stringify(combinedMonths, null, 2));
  }
}

checkFees();
