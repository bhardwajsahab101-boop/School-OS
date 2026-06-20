'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

export type SchoolDetails = {
  id: string
  name: string
  logo_url: string | null
  theme_color: string | null
  address: string | null
  phone: string | null
  email: string | null
  academic_session: string | null
  status?: string
  subscription_status?: string
}

export type ProfileDetails = {
  id: string
  full_name: string
  created_at: string
}

export type SchoolMembership = {
  id: string
  user_id: string
  school_id: string
  role: 'Admin' | 'Teacher' | 'Accountant' | 'Receptionist' | 'SuperAdmin'
  created_at: string
  school_name?: string
}

type SchoolContextType = {
  schoolId: string | null
  schoolName: string | null
  schoolLogoUrl: string | null
  schoolDetails: SchoolDetails | null
  profile: ProfileDetails | null
  memberships: SchoolMembership[]
  userRole: string | null
  userEmail: string | null
  isLoading: boolean
  switchSchool: (id: string) => Promise<void>
  refreshSchool: () => Promise<void>
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null)
  const [schoolDetails, setSchoolDetails] = useState<SchoolDetails | null>(null)
  const [profile, setProfile] = useState<ProfileDetails | null>(null)
  const [memberships, setMemberships] = useState<SchoolMembership[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadSchoolData(overrideSchoolId?: string) {
    console.log('SchoolContext: Starting loadSchoolData...', { overrideSchoolId })
    try {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        console.log('SchoolContext: No active session or user found.')
        setSchoolId(null)
        setSchoolName(null)
        setSchoolLogoUrl(null)
        setSchoolDetails(null)
        setProfile(null)
        setMemberships([])
        setUserRole(null)
        setUserEmail(null)
        return
      }

      console.log('SchoolContext: Active session found for email:', session.user.email)
      setUserEmail(session.user.email || null)

      // 1. Query profiles table (Using maybeSingle to handle null states gracefully)
      console.log('SchoolContext: Fetching profile for user ID:', session.user.id)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError) {
        console.warn('SchoolContext: Failed to query profile details:', profileError.message)
      } else {
        console.log('SchoolContext: Profile fetched successfully:', profileData)
      }
      setProfile(profileData || null)

      // 2. Query memberships
      console.log('SchoolContext: Fetching memberships for user ID:', session.user.id)
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('school_memberships')
        .select('*')
        .eq('user_id', session.user.id)

      if (membershipsError || !membershipsData || membershipsData.length === 0) {
        console.warn('SchoolContext: No school memberships found for user:', session.user.email, membershipsError?.message || '')
        setSchoolId(null)
        setMemberships([])
        setUserRole(null)
        return
      }

      console.log('SchoolContext: Memberships fetched:', membershipsData)

      // Fetch names for schools in user's memberships
      const schoolIds = membershipsData.map(m => m.school_id)
      console.log('SchoolContext: Fetching school names for IDs:', schoolIds)
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('id, name')
        .in('id', schoolIds)

      if (schoolsError) {
        console.warn('SchoolContext: Error fetching school names:', schoolsError.message)
      }

      // Construct memberships list
      const membershipsWithNames = membershipsData.map(m => {
        const sch = schoolsData?.find(s => s.id === m.school_id)
        return {
          ...m,
          school_name: sch ? sch.name : 'Unknown School'
        }
      })

      setMemberships(membershipsWithNames)
      console.log('SchoolContext: Memberships list resolved:', membershipsWithNames)

      // 3. Determine active school ID
      let activeId = overrideSchoolId
      
      if (!activeId) {
        const cachedId = localStorage.getItem('edumanage_active_school_id')
        const isValidCached = membershipsWithNames.some(m => m.school_id === cachedId)
        activeId = isValidCached ? (cachedId as string) : (membershipsWithNames[0]?.school_id || null)
        console.log('SchoolContext: Determined active ID from cache or first membership:', activeId)
      } else {
        console.log('SchoolContext: Using override school ID:', activeId)
      }

      if (activeId) {
        localStorage.setItem('edumanage_active_school_id', activeId)
        setSchoolId(activeId)

        // Get role in active school
        const activeMembership = membershipsWithNames.find(m => m.school_id === activeId)
        setUserRole(activeMembership ? activeMembership.role : null)
        console.log('SchoolContext: Active school ID set in state:', activeId, 'Role:', activeMembership ? activeMembership.role : null)
      } else {
        console.log('SchoolContext: No active school ID could be determined.')
        setSchoolId(null)
        setUserRole(null)
      }

      // 4. Fetch Active School Details
      if (activeId) {
        console.log('SchoolContext: Fetching school details for active school ID:', activeId)
        const { data: schoolData, error: schoolError } = await supabase
          .from('schools')
          .select('*')
          .eq('id', activeId)
          .maybeSingle()

        if (!schoolError && schoolData) {
          console.log('SchoolContext: School details fetched successfully:', schoolData)
          setSchoolDetails(schoolData)
          setSchoolName(schoolData.name)

          if (schoolData.logo_url) {
            if (schoolData.logo_url.startsWith('http')) {
              console.log('SchoolContext: School logo is external URL:', schoolData.logo_url)
              setSchoolLogoUrl(schoolData.logo_url)
            } else {
              // Fetch signed logo URL from student-documents bucket
              console.log('SchoolContext: Creating signed URL for logo:', schoolData.logo_url)
              const { data: urlData, error: signedUrlError } = await supabase.storage
                .from('student-documents')
                .createSignedUrl(schoolData.logo_url, 3600)
              
              if (signedUrlError) {
                console.warn('SchoolContext: Failed to create signed URL for logo:', signedUrlError.message)
                setSchoolLogoUrl(null)
              } else {
                console.log('SchoolContext: Logo signed URL created:', urlData?.signedUrl)
                setSchoolLogoUrl(urlData?.signedUrl || null)
              }
            }
          } else {
            console.log('SchoolContext: School has no logo_url.')
            setSchoolLogoUrl(null)
          }
        } else {
          console.error('SchoolContext: Error fetching active school details:', schoolError?.message || 'No data found')
          setSchoolDetails(null)
          setSchoolName(null)
          setSchoolLogoUrl(null)
        }
      } else {
        console.log('SchoolContext: Skipping school query since activeId is null.')
        setSchoolDetails(null)
        setSchoolName(null)
        setSchoolLogoUrl(null)
      }
    } catch (e) {
      console.error('SchoolContext: Error loading school session state:', e)
    } finally {
      console.log('SchoolContext: Setting isLoading to false.')
      setIsLoading(false)
    }
  }

  const switchSchool = async (id: string) => {
    const isMember = memberships.some(m => m.school_id === id)
    if (!isMember) {
      throw new Error('You do not have membership access to this school.')
    }
    await loadSchoolData(id)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSchoolData()
    }, 0)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('edumanage_active_school_id')
        setSchoolId(null)
        setSchoolName(null)
        setSchoolLogoUrl(null)
        setSchoolDetails(null)
        setProfile(null)
        setMemberships([])
        setUserRole(null)
        setUserEmail(null)
        setIsLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void loadSchoolData()
      }
    })

    return () => {
      clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SchoolContext.Provider
      value={{
        schoolId,
        schoolName,
        schoolLogoUrl,
        schoolDetails,
        profile,
        memberships,
        userRole,
        userEmail,
        isLoading,
        switchSchool,
        refreshSchool: () => loadSchoolData()
      }}
    >
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const context = useContext(SchoolContext)
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider')
  }
  return context
}
