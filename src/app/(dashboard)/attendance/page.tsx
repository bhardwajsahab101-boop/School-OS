'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import AttendanceCard from '../../../components/AttendanceCard'
import { useSchool } from '../../../lib/SchoolContext'

type Student = {
  id: string
  full_name: string
  class_name: string
  created_at?: string
}

type AttendanceMap = {
  [studentId: string]: 'present' | 'absent'
}

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AttendancePage() {
  const todayDate = getTodayDate()
  const { schoolId } = useSchool()

  const [students, setStudents] = useState<Student[]>([])
  const [attendance, setAttendance] = useState<AttendanceMap>({})
  const [selectedClass, setSelectedClass] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'present' | 'absent' | 'unmarked'>('all')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [assignedClasses, setAssignedClasses] = useState<string[]>([])

  useEffect(() => {
    if (!schoolId) return

    async function load() {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        let isTeacher = false
        let teacherClasses: string[] = []

        if (session?.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, role')
            .eq('user_id', session.user.id)
            .eq('school_id', schoolId)
            .single()

          if (staffData) {
            setUserRole(staffData.role)
            if (staffData.role === 'Teacher') {
              isTeacher = true
              const { data: classData } = await supabase
                .from('teacher_classes')
                .select('classes(name)')
                .eq('teacher_id', staffData.id)

              if (classData) {
                teacherClasses = classData.map((c: any) => c.classes?.name).filter(Boolean)
                setAssignedClasses(teacherClasses)
              }
            }
          } else {
            setUserRole('Admin')
          }
        }

        let studentQuery = supabase.from('students').select('*').eq('school_id', schoolId).order('full_name')
        if (isTeacher) {
          if (teacherClasses.length > 0) {
            studentQuery = studentQuery.in('class_name', teacherClasses)
          } else {
            setStudents([])
            setAttendance({})
            setLoading(false)
            return
          }
        }

        const [studentsRes, attendanceRes] = await Promise.all([
          studentQuery,
          supabase.from('attendance').select('*').eq('date', todayDate).eq('school_id', schoolId)
        ])

        const { data: studentsData, error: studentsError } = studentsRes
        if (studentsError) throw studentsError
        setStudents(studentsData || [])

        const { data: attendanceData, error: attendanceError } = attendanceRes
        if (attendanceError) throw attendanceError

        const attendanceObject: AttendanceMap = {}
        attendanceData?.forEach((item) => {
          attendanceObject[item.student_id] = item.status
        })
        setAttendance(attendanceObject)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [todayDate, schoolId])

  async function markAttendance(studentId: string, status: 'present' | 'absent') {
    if (!schoolId) return
    setSavingId(studentId)
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert(
          {
            school_id: schoolId,
            student_id: studentId,
            date: todayDate,
            status
          },
          {
            onConflict: 'student_id,date'
          }
        )

      if (error) {
        console.error(error)
        alert(error.message)
        return
      }

      setAttendance((prev) => ({
        ...prev,
        [studentId]: status
      }))
    } catch (err) {
      console.error(err)
    } finally {
      setSavingId(null)
    }
  }

  async function handleMarkAllPresent() {
    if (filteredStudents.length === 0) return
    if (!schoolId) return
    if (!confirm('Mark all currently displayed students as present?')) return

    setLoading(true)
    try {
      const promises = filteredStudents.map((student) =>
        supabase.from('attendance').upsert(
          {
            school_id: schoolId,
            student_id: student.id,
            date: todayDate,
            status: 'present'
          },
          {
            onConflict: 'student_id,date'
          }
        )
      )

      await Promise.all(promises)

      const updated = { ...attendance }
      filteredStudents.forEach((student) => {
        updated[student.id] = 'present'
      })
      setAttendance(updated)
    } catch (err) {
      console.error(err)
      alert('Error marking all present.')
    } finally {
      setLoading(false)
    }
  }

  const availableClasses = useMemo(() => {
    return Array.from(
      new Set(
        students
          .map((student) => student.class_name)
          .filter(Boolean)
      )
    ).sort()
  }, [students])

  // Stats calculation based on current class selection
  const stats = useMemo(() => {
    const classStudents = selectedClass === 'all'
      ? students
      : students.filter(s => s.class_name === selectedClass)

    const total = classStudents.length
    let present = 0
    let absent = 0
    let unmarked = 0

    classStudents.forEach(s => {
      const status = attendance[s.id]
      if (status === 'present') present++
      else if (status === 'absent') absent++
      else unmarked++
    })

    const rate = total > 0 ? Math.round((present / total) * 100) : 0

    return { total, present, absent, unmarked, rate }
  }, [students, selectedClass, attendance])

  const filteredStudents = useMemo(() => {
    const classFiltered =
      selectedClass === 'all'
        ? students
        : students.filter((student) => student.class_name === selectedClass)

    return classFiltered.filter((student) => {
      if (selectedStatus === 'all') return true
      const currentStatus = attendance[student.id]
      if (selectedStatus === 'present') return currentStatus === 'present'
      if (selectedStatus === 'absent') return currentStatus === 'absent'
      return !currentStatus // unmarked
    })
  }, [students, selectedClass, selectedStatus, attendance])

  const studentIdMap = useMemo(() => {
    const sorted = [...students].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      if (timeA !== timeB) return timeA - timeB
      return a.id.localeCompare(b.id)
    })
    const map = new Map<string, string>()
    sorted.forEach((s, idx) => {
      map.set(s.id, `Stu-${idx + 1}`)
    })
    return map
  }, [students])

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Attendance Manager</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Record and track today's student attendance logs.</p>
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/60 rounded-xl text-sm font-semibold text-slate-700 shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
          {currentDateFormatted}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class Size</span>
          <h4 className="text-2xl font-black text-slate-800 tracking-tight">{stats.total}</h4>
        </div>
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm space-y-1 bg-emerald-50/10">
          <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider block">Present</span>
          <h4 className="text-2xl font-black text-emerald-600 tracking-tight">{stats.present}</h4>
        </div>
        <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-sm space-y-1 bg-rose-50/10">
          <span className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wider block">Absent</span>
          <h4 className="text-2xl font-black text-rose-600 tracking-tight">{stats.absent}</h4>
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm space-y-1 bg-slate-50/30">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unmarked</span>
          <h4 className="text-2xl font-black text-slate-500 tracking-tight">{stats.unmarked}</h4>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-tr from-indigo-50/80 to-violet-50/80 border border-indigo-100/60 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-indigo-700/80 uppercase tracking-wider block">Attendance Rate</span>
          <h4 className="text-2xl font-black text-indigo-700 tracking-tight">{stats.rate}%</h4>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between pb-4">
        <div className="flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center flex-1">
          {/* Class Selector */}
          <div className="w-full sm:w-56">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="all">All Classes</option>
              {availableClasses.map((className) => (
                <option key={className} value={className}>
                  Class {className}
                </option>
              ))}
            </select>
          </div>

          {/* Status Buttons Segmented Controls */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl items-center border border-slate-200/40 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedStatus === 'all'
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/20'
                  : 'text-slate-500 hover:text-slate-850'
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('present')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedStatus === 'present'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Present
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('absent')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedStatus === 'absent'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Absent
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('unmarked')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedStatus === 'unmarked'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Unmarked
            </button>
          </div>
        </div>

        {/* Quick actions (e.g. Mark All Present) */}
        {filteredStudents.length > 0 && (
          <button
            onClick={handleMarkAllPresent}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
            Mark Displayed Present
          </button>
        )}
      </div>

      {/* Grid of Student Attendance Cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white border border-slate-200/60 rounded-2xl" />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 border-dashed p-16 text-center max-w-2xl mx-auto shadow-sm">
          <div className="mx-auto h-14 w-14 text-indigo-500 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No students match the filters</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
            Try switching class filters or attendance status views to manage different student lists.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((student) => (
            <AttendanceCard
              key={student.id}
              student={student}
              displayId={studentIdMap.get(student.id) || 'Stu-?'}
              currentStatus={attendance[student.id]}
              savingId={savingId}
              markAttendance={markAttendance}
            />
          ))}
        </div>
      )}
    </div>
  )
}
