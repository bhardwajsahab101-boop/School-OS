import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'

export async function GET() {
  const health = {
    serviceRole: false,
    schoolsTable: false,
    profilesTable: false,
    membershipsTable: false,
    staffTable: false
  }

  try {
    // 1. Check if service role key is present
    health.serviceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY

    // 2. Initialize Supabase Admin client
    const supabaseAdmin = getSupabaseAdmin()

    // 3. Test schools table connection
    const { error: schoolsErr } = await supabaseAdmin.from('schools').select('id').limit(1)
    health.schoolsTable = !schoolsErr

    // 4. Test profiles table connection
    const { error: profilesErr } = await supabaseAdmin.from('profiles').select('id').limit(1)
    health.profilesTable = !profilesErr

    // 5. Test memberships table connection
    const { error: membershipsErr } = await supabaseAdmin.from('school_memberships').select('id').limit(1)
    health.membershipsTable = !membershipsErr

    // 6. Test staff table connection
    const { error: staffErr } = await supabaseAdmin.from('staff').select('id').limit(1)
    health.staffTable = !staffErr

    console.log('ONBOARDING HEALTH CHECK:', health)
    return NextResponse.json(health)
  } catch (err) {
    const error = err as Error
    console.error('ONBOARDING HEALTH CHECK FAILED:', error)
    return NextResponse.json({
      ...health,
      error: error.message || 'Health diagnostics failed'
    }, { status: 500 })
  }
}
