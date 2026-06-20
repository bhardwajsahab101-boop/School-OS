'use client'

import { useState, Fragment, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useSchool } from '../../lib/SchoolContext'

type Activity = {
  id: string
  title: string
  subtitle: string
  timestamp: string
  type: 'document' | 'fee' | 'admission'
}

function formatTimeAgo(dateString: string): string {
  try {
    const now = new Date()
    const past = new Date(dateString)
    const diffMs = now.getTime() - past.getTime()
    if (isNaN(diffMs) || diffMs < 0) return 'Just now'
    
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch (e) {
    return 'Recently'
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [activities, setActivities] = useState<Activity[]>([])
  const [navbarSearch, setNavbarSearch] = useState('')
  const pathname = usePathname()
  const router = useRouter()

  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    profile,
    userRole,
    userEmail,
    memberships,
    switchSchool,
    isLoading
  } = useSchool()

  const getInitials = (name: string) => {
    if (!name) return 'AD'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  useEffect(() => {
    if (userRole === 'Teacher') {
      const restrictedRoutes = ['/dashboard/settings', '/dashboard/staff']
      if (restrictedRoutes.some(route => pathname.startsWith(route))) {
        router.push('/dashboard')
      }
    }
  }, [userRole, pathname, router])

  useEffect(() => {
    if (!schoolId) {
      setActivities([])
      return
    }
    
    async function fetchActivities() {
      try {
        // Fetch 3 most recent student admissions
        const { data: recentAdmissions } = await supabase
          .from('students')
          .select('id, full_name, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(3)

        // Fetch 3 most recent document uploads
        const { data: recentDocs } = await supabase
          .from('documents')
          .select('id, document_type, created_at, student_id')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(3)

        // Fetch 3 most recent fee records
        const { data: recentFees } = await supabase
          .from('fees')
          .select('id, amount, status, created_at, month, student_id')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(3)

        // Gather all unique student IDs to query full names
        const studentIds = Array.from(new Set([
          ...(recentDocs || []).map(d => d.student_id),
          ...(recentFees || []).map(f => f.student_id)
        ].filter(Boolean)))

        const studentMap: Record<string, string> = {}
        if (studentIds.length > 0) {
          const { data: studentNames } = await supabase
            .from('students')
            .select('id, full_name')
            .in('id', studentIds)
          
          if (studentNames) {
            studentNames.forEach(s => {
              studentMap[s.id] = s.full_name
            })
          }
        }

        const combined: Activity[] = []

        if (recentAdmissions) {
          recentAdmissions.forEach(a => {
            combined.push({
              id: `admission-${a.id}`,
              title: 'New Student Registered',
              subtitle: `${a.full_name}`,
              timestamp: a.created_at || new Date().toISOString(),
              type: 'admission'
            })
          })
        }

        if (recentDocs) {
          recentDocs.forEach(d => {
            const studentName = studentMap[d.student_id] || 'Student'
            combined.push({
              id: `doc-${d.id}`,
              title: `${d.document_type || 'Document'} Uploaded`,
              subtitle: `${studentName}`,
              timestamp: d.created_at || new Date().toISOString(),
              type: 'document'
            })
          })
        }

        if (recentFees) {
          recentFees.forEach(f => {
            const studentName = studentMap[f.student_id] || 'Student'
            const action = f.status === 'paid' ? 'Collected' : 'Billed'
            combined.push({
              id: `fee-${f.id}`,
              title: `${f.month || 'Fee'} ${action}`,
              subtitle: `${studentName} • ₹${f.amount}`,
              timestamp: f.created_at || new Date().toISOString(),
              type: 'fee'
            })
          })
        }

        // Sort combined list by timestamp descending
        combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setActivities(combined.slice(0, 5))
      } catch (err) {
        console.error('DashboardLayout: Error loading recent activities:', err)
      }
    }

    void fetchActivities()
  }, [schoolId])

  const navLinks = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      ) 
    },
    { 
      name: 'Students', 
      href: '/students', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ) 
    },
    { 
      name: 'Staff', 
      href: '/dashboard/staff', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ) 
    },
    { 
      name: 'Attendance', 
      href: '/attendance', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </svg>
      ) 
    },
    {
      name: 'Fees',
      href: '/fees',
      icon: (
      <svg className="w-5 h-5 transition-transform group-hover:scale-110" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
  <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/>
  <path d="M0 4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm3 0a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2h10a2 2 0 0 1 2-2V6a2 2 0 0 1-2-2z"/>
</svg>
      ) 
    },
    { 
      name: 'Documents', 
      href: '/documents', 
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" />
          <line x1="16" x2="8" y1="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ) 
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: (
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    },
  ]

  const filteredNavLinks = useMemo(() => {
    if (userRole === 'Teacher') {
      return navLinks.filter(link => link.name !== 'Settings' && link.name !== 'Staff')
    }
    if (userRole === 'SuperAdmin') {
      return [
        ...navLinks,
        {
          name: 'Registered Schools',
          href: '/dashboard/superadmin/schools',
          icon: (
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )
        }
      ]
    }
    return navLinks
  }, [userRole, navLinks])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-650 animate-spin border-4 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm font-semibold text-slate-500 animate-pulse">Loading school session...</span>
        </div>
      </div>
    )
  }

  if (!schoolId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50/50 p-4 font-sans">
        <div className="max-w-md w-full bg-white border border-slate-200/60 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-sm shadow-rose-100/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">No School Membership</h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Your account ({userEmail || 'registered user'}) is not linked to any registered school space. Please contact your administrator or ask them to add your email to the school staff registry.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {userRole === 'SuperAdmin' && (
              <Link
                href="/register"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition shadow shadow-indigo-500/10 active:scale-95 text-center block"
              >
                + Register a New School
              </Link>
            )}
            <Link
              href="/login"
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200/60 text-slate-655 font-bold text-xs py-3 rounded-xl transition active:scale-95 text-center block"
            >
              Sign Out / Switch Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return ['Home']
    return parts.map((part) => {
      if (part.length > 20) return 'Profile'
      const label = part.charAt(0).toUpperCase() + part.slice(1)
      if (label === 'Documents') return 'Documents Vault'
      if (label === 'Fees') return 'Fees & Billing'
      return label
    })
  }

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden font-sans">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/60 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col print:hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow shadow-indigo-500/20 overflow-hidden shrink-0">
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt={schoolName || 'School Logo'} className="object-cover w-full h-full" />
              ) : (
                <span>{schoolName ? schoolName.charAt(0).toUpperCase() : '★'}</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-extrabold text-slate-800 truncate leading-tight select-none" title={schoolName || 'EduManage'}>
                {schoolName || 'EduManage'}
              </span>
              <span className="text-[9px] text-indigo-655 font-black tracking-wider uppercase leading-none mt-0.5">
                {userRole || 'Staff'}
              </span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors ml-2 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
        {memberships.length > 1 && (
          <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <label className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">School:</label>
            <select
              value={schoolId || ''}
              onChange={(e) => void switchSchool(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-[10px] font-bold text-indigo-650 cursor-pointer focus:ring-0 truncate"
            >
              {memberships.map((m) => (
                <option key={m.id} value={m.school_id} className="text-slate-800 font-semibold">
                  {m.school_name || 'School'}
                </option>
              ))}
            </select>
          </div>
        )}
        {userRole === 'SuperAdmin' && (
          <div className="px-6 py-2.5 bg-indigo-50/50 border-b border-slate-100/60 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider">Super Admin:</span>
            <Link
              href="/register"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm shadow-indigo-500/10"
            >
              + Register School
            </Link>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="space-y-1.5 px-4">
            {filteredNavLinks.map((link) => {
              const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/dashboard')
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                    isActive 
                      ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 rounded-r-full" />
                  )}
                  <span className={`mr-3 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                    {link.icon}
                  </span>
                  {link.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-100/80">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-100 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-100 to-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-200/50 shadow-sm transition-transform group-hover:scale-105">
              {getInitials(profile?.full_name || 'Admin User')}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate">{profile?.full_name || 'Admin User'}</span>
              <span className="text-xs text-slate-400 truncate">{userEmail || 'admin@school.com'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" onClick={() => {
        setIsNotificationsOpen(false)
        setIsProfileOpen(false)
      }}>
        {/* Top Navbar */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 h-16 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsSidebarOpen(true)
              }}
              className="lg:hidden text-slate-500 hover:text-slate-700 p-2 hover:bg-slate-50 rounded-xl transition-colors focus:outline-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>

            {/* Breadcrumbs */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 select-none">
              <span>Home</span>
              {getBreadcrumbs().map((b, i) => (
                <Fragment key={i}>
                  <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className={i === getBreadcrumbs().length - 1 ? "text-indigo-650" : ""}>{b}</span>
                </Fragment>
              ))}
            </div>

            {/* Mobile / fallback Title */}
            <span className="md:hidden font-black text-sm text-slate-800">EduManage ERP</span>
          </div>

          <div className="flex items-center gap-4">             {/* Search Input */}
            <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white focus-within:border-indigo-400/80 transition-all relative">
              <svg className="text-slate-400 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input 
                type="text" 
                placeholder="Search students, billing..." 
                className="bg-transparent border-none outline-none text-xs ml-2 w-48 placeholder-slate-400 text-slate-700 focus:outline-none"
                value={navbarSearch}
                onChange={(e) => setNavbarSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && navbarSearch.trim()) {
                    router.push(`/students?search=${encodeURIComponent(navbarSearch.trim())}`)
                  }
                }}
              />
              <span className="text-[9px] font-black text-slate-400 bg-slate-100 border border-slate-200/60 px-1.5 py-0.2 rounded-md ml-2 select-none">⌘K</span>
            </div>

            {/* Notifications Dropdown Container */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNotificationsOpen(!isNotificationsOpen)
                  setIsProfileOpen(false)
                }}
                className="text-slate-400 hover:text-indigo-600 relative p-2 hover:bg-slate-50 rounded-xl transition-all group cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:rotate-12">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {activities.length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
              </button>

              {isNotificationsOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2.5 w-76 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-2">
                    <span className="text-xs font-black text-slate-800">Recent Activity Logs</span>
                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded-full">{activities.length} Logs</span>
                  </div>
                  <div className="space-y-3.5 pt-1 max-h-76 overflow-y-auto">
                    {activities.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-4 font-semibold">No recent activity logs.</p>
                    ) : (
                      activities.map(act => {
                        let dotColor = 'bg-indigo-600'
                        if (act.type === 'fee' && act.title.includes('Billed')) {
                          dotColor = 'bg-rose-500'
                        } else if (act.type === 'fee') {
                          dotColor = 'bg-emerald-500'
                        } else if (act.type === 'admission') {
                          dotColor = 'bg-violet-600'
                        }
                        
                        return (
                          <div key={act.id} className="flex gap-3 text-left">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 block">{act.title}</span>
                              <span className="text-[9px] font-bold text-slate-400 block mt-0.2">
                                {act.subtitle} • {formatTimeAgo(act.timestamp)}
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Container */}
            <div className="relative">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setIsProfileOpen(!isProfileOpen)
                  setIsNotificationsOpen(false)
                }}
                className="flex items-center gap-2.5 pl-2 border-l border-slate-250/70 cursor-pointer focus:outline-none group select-none text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-100 to-indigo-100 text-indigo-750 flex items-center justify-center font-black text-xs border border-indigo-200/50 shadow-sm transition-transform group-hover:scale-105">
                  {getInitials(profile?.full_name || 'Admin User')}
                </div>
                <div className="hidden md:flex flex-col text-left min-w-0">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{profile?.full_name || 'Admin User'}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{userRole || 'Staff'}</span>
                </div>
                <svg className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isProfileOpen && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-2.5 w-48 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in-50 slide-in-from-top-2 duration-200"
                >
                  <div className="px-3 py-2 border-b border-slate-100 mb-1.5 md:hidden">
                    <span className="text-xs font-bold text-slate-850 block">{profile?.full_name || 'Admin User'}</span>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{userEmail || 'admin@school.com'}</span>
                  </div>
                  <Link 
                    href="/dashboard/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all block text-left"
                  >
                    Settings
                  </Link>
                  {userRole === 'SuperAdmin' && (
                    <Link 
                      href="/register"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition-all block text-left font-semibold"
                    >
                      Register New School
                    </Link>
                  )}

                  <hr className="border-slate-100 my-1.5" />
                  <Link 
                    href="/login"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all block text-left"
                  >
                    Log Out
                  </Link>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8 print:p-0 print:bg-white">
          {children}
        </main>
      </div>
    </div>
  )
}
