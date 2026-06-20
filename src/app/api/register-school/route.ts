/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

interface RegisterRequestBody {
  email?: string
  password?: string
  fullName?: string
  schoolName?: string
  academicSession?: string
  schoolPhone?: string
  schoolEmail?: string
  schoolAddress?: string
  themeColor?: string
}

export async function POST(request: NextRequest) {
  let authUserId: string | null = null
  let schoolId: string | null = null
  let supabaseAdmin: any = null

  let requestBody: RegisterRequestBody = {}
  try {
    requestBody = await request.json() as RegisterRequestBody
  } catch (_e) {
    return Response.json(
      { success: false, error: 'Invalid JSON request body.' },
      { status: 400 }
    )
  }

  const {
    email,
    password,
    fullName,
    schoolName,
    academicSession,
    schoolPhone,
    schoolEmail,
    schoolAddress,
    themeColor
  } = requestBody

  // Input Validation
  if (!email || !password || !fullName || !schoolName || !academicSession) {
    return Response.json(
      { success: false, error: 'Missing required registration fields (email, password, fullName, schoolName, academicSession).' },
      { status: 400 }
    )
  }

  if (password.length < 6) {
    return Response.json(
      { success: false, error: 'Password must be at least 6 characters long.' },
      { status: 400 }
    )
  }

  // Structured Logging
  console.group('REGISTER-SCHOOL API: ONBOARDING NEW TENANT')
  console.log('REQUEST PAYLOAD:', {
    email,
    fullName,
    schoolName,
    academicSession,
    phone: schoolPhone || 'None',
    schoolEmail: schoolEmail || 'None',
    themeColor: themeColor || 'Default'
  })

  try {
    // Dynamically retrieve client (throws clean error if environment variables are missing)
    supabaseAdmin = getSupabaseAdmin()

    // STEP 1: Create Auth User
    console.log('STEP 1: Creating Supabase Auth User...')
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    })

    if (userError || !userData?.user) {
      throw new Error(`Auth User Creation Failed: ${userError?.message || 'No user returned.'}`)
    }

    authUserId = userData.user.id
    console.log(`STEP 1 SUCCESS: Auth User Created. User ID: ${authUserId}`)

    // STEP 2: Create School Record
    console.log('STEP 2: Inserting School Record...')
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert({
        name: schoolName,
        phone: schoolPhone || null,
        email: schoolEmail || null,
        address: schoolAddress || null,
        academic_session: academicSession,
        theme_color: themeColor || '#4f46e5',
        logo_url: null // Updated on frontend after upload
      })
      .select()
      .single()

    if (schoolError || !schoolData) {
      throw new Error(`School Record Insertion Failed: ${schoolError?.message || 'No school data returned.'}`)
    }

    schoolId = schoolData.id
    console.log(`STEP 2 SUCCESS: School Created. School ID: ${schoolId}`)

    // STEP 3: Create User Profile
    console.log('STEP 3: Inserting User Profile...')
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUserId,
        full_name: fullName
      })
      .select()
      .single()

    const profileStatus = profileError ? `FAILED: ${profileError.message}` : 'SUCCESS'
    console.log(`STEP 3 STATUS: Profile Insert -> ${profileStatus}`)

    if (profileError) {
      throw new Error(`User Profile Insertion Failed: ${profileError.message}`)
    }

    // STEP 4: Create School Membership as Admin
    console.log('STEP 4: Inserting School Membership...')
    const { data: membershipData, error: membershipError } = await supabaseAdmin
      .from('school_memberships')
      .insert({
        user_id: authUserId,
        school_id: schoolId,
        role: 'Admin'
      })
      .select()
      .single()

    const membershipStatus = membershipError ? `FAILED: ${membershipError.message}` : 'SUCCESS'
    console.log(`STEP 4 STATUS: Membership Insert -> ${membershipStatus}`)

    if (membershipError) {
      throw new Error(`School Membership Creation Failed: ${membershipError.message}`)
    }

    // STEP 5: Create Staff Registry Record
    console.log('STEP 5: Inserting Staff Registry Record...')
    const { data: staffData, error: staffError } = await supabaseAdmin
      .from('staff')
      .insert({
        school_id: schoolId,
        user_id: authUserId,
        full_name: fullName,
        email: email,
        phone: schoolPhone || null,
        role: 'Admin',
        status: 'Active'
      })
      .select()
      .single()

    const staffStatus = staffError ? `FAILED: ${staffError.message}` : 'SUCCESS'
    console.log(`STEP 5 STATUS: Staff Registry Insert -> ${staffStatus}`)

    if (staffError) {
      throw new Error(`Staff Record Creation Failed: ${staffError.message}`)
    }

    // Registration succeeded completely
    console.table([
      { Step: '1. Create User', Status: 'SUCCESS', ID: authUserId },
      { Step: '2. Create School', Status: 'SUCCESS', ID: schoolId },
      { Step: '3. Create Profile', Status: 'SUCCESS', ID: profileData?.id },
      { Step: '4. Create Membership', Status: 'SUCCESS', ID: membershipData?.id },
      { Step: '5. Create Staff', Status: 'SUCCESS', ID: staffData?.id }
    ])
    console.groupEnd()

    return Response.json({
      success: true,
      schoolId,
      userId: authUserId
    })

  } catch (err) {
    const error = err as Error
    console.error('REGISTRATION FLOW EXCEPTION:', error.message || error)

    // TRANSACTION-LIKE CLEANUP / ROLLBACK
    console.group('ROLLBACK: Cleaning up created tenant records...')
    
    if (supabaseAdmin && schoolId) {
      console.log(`ROLLBACK: Deleting school record ${schoolId}...`)
      // Deleting school cascades to school_memberships, staff, etc.
      const { error: delSchoolError } = await supabaseAdmin
        .from('schools')
        .delete()
        .eq('id', schoolId)

      if (delSchoolError) {
        console.error(`ROLLBACK ERROR: Failed to delete school: ${delSchoolError.message}`)
      } else {
        console.log('ROLLBACK SUCCESS: School record deleted.')
      }
    }

    if (supabaseAdmin && authUserId) {
      console.log(`ROLLBACK: Deleting auth user ${authUserId}...`)
      const { error: delUserError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)

      if (delUserError) {
        console.error(`ROLLBACK ERROR: Failed to delete auth user: ${delUserError.message}`)
      } else {
        console.log('ROLLBACK SUCCESS: Auth user deleted.')
      }
    }

    console.groupEnd()
    console.groupEnd()

    return Response.json(
      { success: false, error: error.message || 'Onboarding failed due to internal error.' },
      { status: 500 }
    )
  }
}
