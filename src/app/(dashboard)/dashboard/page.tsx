
'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import ClientAuth from '../ClientAuth'
import { useSchool } from '../../../lib/SchoolContext'

type StudentRow = {
  id: string
  full_name: string
  class_name: string
  created_at: string
}

type AttendanceRow = {
  id: string
  status: 'present' | 'absent'
  date: string
}

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function DashboardPage() {
  const todayDate = getTodayDate()
  const { schoolId } = useSchool()

  const [loading, setLoading] = useState(true)
  const [studentsCount, setStudentsCount] = useState(0)
  const [classesCount, setClassesCount] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState(0)
  const [recentStudents, setRecentStudents] = useState<StudentRow[]>([])
  const [studentIdMap, setStudentIdMap] = useState<Map<string, string>>(new Map())
  const [staffCount, setStaffCount] = useState(0)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userFullName, setUserFullName] = useState<string>('Admin')
  
  // Weekly chart data - loaded dynamically from attendance logs
  const [weeklyData, setWeeklyData] = useState<any[]>([
    { day: 'Mon', rate: 0, present: 0, total: 0 },
    { day: 'Tue', rate: 0, present: 0, total: 0 },
    { day: 'Wed', rate: 0, present: 0, total: 0 },
    { day: 'Thu', rate: 0, present: 0, total: 0 },
    { day: 'Fri', rate: 0, present: 0, total: 0 },
  ])

  useEffect(() => {
    if (!schoolId) return

    async function loadDashboardData() {
      try {
        setLoading(true)
        
        // Get user session and role
        const { data: { session } } = await supabase.auth.getSession()
        let isTeacher = false
        let teacherClasses: string[] = []
        let fullName = 'Admin'

        if (session?.user) {
          fullName = session.user.user_metadata?.full_name || 'Admin User'
          const { data: staffData } = await supabase
            .from('staff')
            .select('full_name, role, id')
            .eq('user_id', session.user.id)
            .eq('school_id', schoolId)
            .single()

          if (staffData) {
            fullName = staffData.full_name
            setUserRole(staffData.role)
            if (staffData.role === 'Teacher') {
              isTeacher = true
              const { data: classData } = await supabase
                .from('teacher_classes')
                .select('classes(name)')
                .eq('teacher_id', staffData.id)

              if (classData) {
                teacherClasses = classData.map((c: any) => c.classes?.name).filter(Boolean)
              }
            }
          } else {
            setUserRole('Admin')
          }
        }
        setUserFullName(fullName)

        // Fetch active staff count (for Card 4)
        let activeStaff = 0
        try {
          const { count } = await supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Active')
            .eq('school_id', schoolId)
          activeStaff = count || 0
        } catch (e) {
          console.error('Failed to fetch staff count:', e)
        }
        setStaffCount(activeStaff)

        // 1. Fetch total students and list for classes
        let studentQuery = supabase
          .from('students')
          .select('id, full_name, class_name, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })

        if (isTeacher) {
          if (teacherClasses.length > 0) {
            studentQuery = studentQuery.in('class_name', teacherClasses)
          } else {
            setStudentsCount(0)
            setClassesCount(0)
            setRecentStudents([])
            setAttendanceRate(0)
            setLoading(false)
            return
          }
        }

        const { data: studentsData, error: studentsError } = await studentQuery

        if (studentsError) throw studentsError

        const totalStudents = studentsData?.length || 0
        setStudentsCount(totalStudents)

        if (studentsData) {
          const sorted = [...studentsData].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
            if (timeA !== timeB) return timeA - timeB
            return a.id.localeCompare(b.id)
          })
          const map = new Map<string, string>()
          sorted.forEach((s, idx) => {
            map.set(s.id, `Stu-${idx + 1}`)
          })
          setStudentIdMap(map)
        }

        // Count unique classes
        const uniqueClasses = new Set(studentsData?.map(s => s.class_name).filter(Boolean))
        setClassesCount(uniqueClasses.size)

        // Last 5 enrolled students
        setRecentStudents(studentsData?.slice(0, 5) || [])

        // 2. Fetch today's attendance rate
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('date', todayDate)
          .eq('school_id', schoolId)

        if (attendanceError) throw attendanceError

        let finalAttendanceData = attendanceData || []
        if (isTeacher && studentsData) {
          const teacherStudentIds = studentsData.map(s => s.id)
          finalAttendanceData = finalAttendanceData.filter(a => teacherStudentIds.includes(a.student_id))
        }

        if (finalAttendanceData.length > 0) {
          const presentCount = finalAttendanceData.filter(a => a.status === 'present').length
          const rate = Math.round((presentCount / finalAttendanceData.length) * 100)
          setAttendanceRate(rate)
        } else {
          setAttendanceRate(0)
        }

        // 3. Fetch weekly attendance trend (last 5 active dates)
        const { data: dateRecords, error: dateError } = await supabase
          .from('attendance')
          .select('date')
          .eq('school_id', schoolId)
          .order('date', { ascending: false })

        if (!dateError && dateRecords) {
          const uniqueDates = Array.from(new Set(dateRecords.map(r => r.date))).slice(0, 5)
          if (uniqueDates.length > 0) {
            const { data: weeklyAttendance, error: weeklyError } = await supabase
              .from('attendance')
              .select('student_id, date, status')
              .in('date', uniqueDates)
              .eq('school_id', schoolId)

            if (!weeklyError && weeklyAttendance) {
              const sortedDates = [...uniqueDates].sort((a, b) => a.localeCompare(b))
              const teacherStudentIds = isTeacher && studentsData ? studentsData.map(s => s.id) : []

              const calculatedWeeklyData = sortedDates.map(dateStr => {
                let dayRecords = weeklyAttendance.filter(a => a.date === dateStr)
                if (isTeacher) {
                  dayRecords = dayRecords.filter(a => teacherStudentIds.includes(a.student_id))
                }
                const present = dayRecords.filter(a => a.status === 'present').length
                const totalMarked = dayRecords.length
                const rate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0
                
                // Get short weekday name (e.g. "Mon")
                const dateObj = new Date(dateStr)
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                
                return {
                  day: dayName,
                  rate,
                  present,
                  total: totalMarked
                }
              })

              // Pad up to 5 items if needed
              if (calculatedWeeklyData.length < 5) {
                const defaultWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                const needed = 5 - calculatedWeeklyData.length
                const startIdx = calculatedWeeklyData.length
                for (let i = 0; i < needed; i++) {
                  calculatedWeeklyData.push({
                    day: defaultWeekdays[(startIdx + i) % 5],
                    rate: 0,
                    present: 0,
                    total: 0
                  })
                }
              }

              setWeeklyData(calculatedWeeklyData)
            }
          }
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadDashboardData()
  }, [todayDate, schoolId])

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [])

  return (
    <>
      <ClientAuth />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
            <p className="text-slate-500 mt-1.5 font-medium">Welcome back, {userFullName}! Here is the status of your {userRole === 'Teacher' ? 'classes' : 'school'} today.</p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-700 shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            {currentDateFormatted}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Total Enrolled Students */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all duration-300 rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Students</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{studentsCount}</h3>
              )}
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                +4% this month
              </span>
            </div>
            <div className="bg-indigo-50/60 text-indigo-600 p-3.5 rounded-xl border border-indigo-100/30 transition-transform group-hover:scale-105 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>

          {/* Card 2: Attendance Rate */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all duration-300 rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Attendance Today</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {attendanceRate > 0 ? `${attendanceRate}%` : '0%'}
                </h3>
              )}
              <span className={`text-[11px] font-bold uppercase tracking-wider ${attendanceRate > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {attendanceRate > 0 ? '● Active' : 'No logs today'}
              </span>
            </div>
            <div className="bg-violet-50/60 text-violet-600 p-3.5 rounded-xl border border-violet-100/30 transition-transform group-hover:scale-105 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M10 14l2 2 4-4"/></svg>
            </div>
          </div>

          {/* Card 3: Active Classes */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all duration-300 rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Classes</span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{classesCount}</h3>
              )}
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Configured Groups
              </span>
            </div>
            <div className="bg-teal-50/60 text-teal-600 p-3.5 rounded-xl border border-teal-100/30 transition-transform group-hover:scale-105 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
          </div>

          {/* Card 4: Staff or Workload status */}
          <div className="bg-white hover:shadow-md hover:border-slate-300/80 transition-all duration-300 rounded-2xl border border-slate-200/60 p-6 flex items-center justify-between group cursor-default">
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                {userRole === 'Teacher' ? 'Assigned Workload' : 'School Staff'}
              </span>
              {loading ? (
                <div className="h-9 w-20 bg-slate-100 animate-pulse rounded-lg" />
              ) : (
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {userRole === 'Teacher' ? `${classesCount} Classes` : `${staffCount} Members`}
                </h3>
              )}
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {userRole === 'Teacher' ? 'Active teaching workload' : 'Active staff profiles'}
              </span>
            </div>
            <div className="bg-emerald-50/60 text-emerald-600 p-3.5 rounded-xl border border-emerald-100/30 transition-transform group-hover:scale-105 shadow-sm">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>

        </div>

        {/* Dashboard Grid Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Visuals & Actions */}
          <div className="lg:col-span-2 space-y-8">
            {/* Weekly Attendance flex-based Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 00-2 2h-2a2 2 0 00-2-2z" />
                    </svg>
                    Weekly Attendance Trend
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Average registration attendance ratios</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-md bg-gradient-to-tr from-indigo-600 to-violet-500"></span> Present %
                </div>
              </div>

              {/* Chart container */}
              <div className="flex gap-4">
                {/* Y-Axis Labels */}
                <div className="flex flex-col justify-between text-[10px] font-black text-slate-300 pb-8 h-60 pt-2 select-none">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>

                {/* Grid container */}
                <div className="flex-1 h-60 flex items-end justify-between px-2 pt-6 border-b border-slate-100/80 relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-2 select-none">
                    <div className="border-t border-slate-100/50 w-full" />
                    <div className="border-t border-slate-100/50 w-full" />
                    <div className="border-t border-slate-100/50 w-full" />
                    <div className="border-t border-slate-100/50 w-full" />
                  </div>

                  {weeklyData.map((d, idx) => (
                    <div key={`${d.day}-${idx}`} className="flex flex-col items-center flex-1 group gap-2 relative z-10">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2.5 transition-all duration-200 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg pointer-events-none z-20 whitespace-nowrap">
                        {d.rate}% ({d.present}/{d.total} Present)
                      </div>
                      {/* Bar track */}
                      <div className="w-10 bg-slate-50/80 rounded-t-xl h-40 flex items-end overflow-hidden border border-slate-100/40">
                        {/* Bar filled */}
                        <div 
                          style={{ height: `${d.rate}%` }} 
                          className="w-full bg-gradient-to-t from-indigo-600 to-violet-500 rounded-t-xl transition-all duration-1000 group-hover:brightness-110 shadow-sm"
                        />
                      </div>
                      {/* Label */}
                      <span className="text-xs font-bold text-slate-400 group-hover:text-slate-700 transition-colors py-1">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Management Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link 
                  href="/dashboard/attendance" 
                  className="flex flex-col items-center p-5 rounded-2xl border border-slate-200/55 bg-slate-50/30 hover:bg-violet-50/30 hover:border-violet-200/80 hover:shadow-sm active:scale-[0.98] transition-all text-center group gap-4 cursor-pointer"
                >
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-500 group-hover:text-violet-600 group-hover:border-violet-100 transition-all">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M9 16l2 2 4-4"/></svg>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors block">Mark Attendance</span>
                    <p className="text-xs text-slate-400 font-semibold">Record student check-ins</p>
                  </div>
                </Link>

                <Link 
                  href="/students" 
                  className="flex flex-col items-center p-5 rounded-2xl border border-slate-200/55 bg-slate-50/30 hover:bg-indigo-50/30 hover:border-indigo-200/80 hover:shadow-sm active:scale-[0.98] transition-all text-center group gap-4 cursor-pointer"
                >
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-500 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="16" x2="22" y1="11" y2="11"/></svg>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors block">Add Student</span>
                    <p className="text-xs text-slate-400 font-semibold">Register a new profile</p>
                  </div>
                </Link>

                <Link 
                  href="/students" 
                  className="flex flex-col items-center p-5 rounded-2xl border border-slate-200/55 bg-slate-50/30 hover:bg-teal-50/30 hover:border-teal-200/80 hover:shadow-sm active:scale-[0.98] transition-all text-center group gap-4 cursor-pointer"
                >
                  <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-500 group-hover:text-teal-600 group-hover:border-teal-100 transition-all">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M8 11h6"/></svg>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors block">Search Directory</span>
                    <p className="text-xs text-slate-400 font-semibold">View enrolled lists</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Recent Enrolments */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm flex flex-col h-[480px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Recent Enrolments
              </h3>
              <Link href="/students" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/30 px-2 py-1 rounded-lg transition-colors">View All</Link>
            </div>

            {loading ? (
              <div className="space-y-4 flex-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentStudents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2 text-slate-400 border border-slate-100">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                </div>
                <span className="text-sm font-bold text-slate-700">No students yet</span>
                <p className="text-xs text-slate-400 mt-1 max-w-[180px] font-medium">Added profiles will show up here.</p>
              </div>
            ) : (
              <div className="space-y-3.5 flex-1 overflow-y-auto pr-1">
                {recentStudents.map((s) => (
                  <Link 
                    key={s.id} 
                    href={`/students/${s.id}`}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100/80 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 text-indigo-700 font-bold flex items-center justify-center border border-indigo-200/20 shadow-sm shrink-0">
                        {s.full_name ? s.full_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-800 truncate block group-hover:text-indigo-600 transition-colors">
                          {s.full_name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-semibold text-slate-400">Class {s.class_name}</span>
                          <span className="text-slate-300 text-xs">•</span>
                          <span className="text-[10px] font-bold text-indigo-550">{studentIdMap.get(s.id) || 'Stu-?'}</span>
                        </div>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
