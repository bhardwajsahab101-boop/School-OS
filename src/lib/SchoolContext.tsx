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
    try {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        setSchoolId(null)
        setSchoolName(null)
        setSchoolLogoUrl(null)
        setSchoolDetails(null)
        setProfile(null)
        setMemberships([])
        setUserRole(null)
        setUserEmail(null)
        setIsLoading(false)
        return
      }

      setUserEmail(session.user.email || null)

      // 1. Query profiles table (Using maybeSingle to handle null states gracefully)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profileError) {
        console.warn('Failed to query profile details:', profileError.message)
      }
      setProfile(profileData || null)

      // 2. Query memberships
      const { data: membershipsData, error: membershipsError } = await supabase
        .from('school_memberships')
        .select('*')
        .eq('user_id', session.user.id)

      if (membershipsError || !membershipsData || membershipsData.length === 0) {
        console.warn('No school memberships found for user:', session.user.email, membershipsError?.message || '')
        setSchoolId(null)
        setMemberships([])
        setUserRole(null)
        setIsLoading(false)
        return
      }

      // Fetch names for schools in user's memberships
      const schoolIds = membershipsData.map(m => m.school_id)
      const { data: schoolsData } = await supabase
        .from('schools')
        .select('id, name')
        .in('id', schoolIds)

      // Construct memberships list
      const membershipsWithNames = membershipsData.map(m => {
        const sch = schoolsData?.find(s => s.id === m.school_id)
        return {
          ...m,
          school_name: sch ? sch.name : 'Unknown School'
        }
      })

      setMemberships(membershipsWithNames)

      // 3. Determine active school ID
      let activeId = overrideSchoolId
      
      if (!activeId) {
        const cachedId = localStorage.getItem('edumanage_active_school_id')
        const isValidCached = membershipsWithNames.some(m => m.school_id === cachedId)
        activeId = isValidCached ? (cachedId as string) : (membershipsWithNames[0]?.school_id || null)
      }

      if (activeId) {
        localStorage.setItem('edumanage_active_school_id', activeId)
        setSchoolId(activeId)

        // Get role in active school
        const activeMembership = membershipsWithNames.find(m => m.school_id === activeId)
        setUserRole(activeMembership ? activeMembership.role : null)
      } else {
        setSchoolId(null)
        setUserRole(null)
      }

      // 4. Fetch Active School Details
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', activeId)
        .single()

      if (!schoolError && schoolData) {
        setSchoolDetails(schoolData)
        setSchoolName(schoolData.name)

        if (schoolData.logo_url) {
          if (schoolData.logo_url.startsWith('http')) {
            setSchoolLogoUrl(schoolData.logo_url)
          } else {
            // Fetch signed logo URL from student-documents bucket
            const { data: urlData } = await supabase.storage
              .from('student-documents')
              .createSignedUrl(schoolData.logo_url, 3600)
            setSchoolLogoUrl(urlData?.signedUrl || null)
          }
        } else {
          setSchoolLogoUrl(null)
        }
      } else {
        console.error('Error fetching active school details:', schoolError?.message)
        setSchoolDetails(null)
        setSchoolName(null)
        setSchoolLogoUrl(null)
      }
    } catch (e) {
      console.error('Error loading school session state:', e)
    } finally {
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
    void loadSchoolData()

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
