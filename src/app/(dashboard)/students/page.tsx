'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { useSchool } from '../../../lib/SchoolContext'

type StudentRow = {
  id: string
  full_name: string
  parent_name: string
  parent_phone: string
  class_name: string
  created_at?: string
}

export default function StudentsPage() {
  const { schoolId } = useSchool()
  const searchParams = useSearchParams()
  const initialSearch = searchParams ? (searchParams.get('search') || '') : ''

  const [fullName, setFullName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [className, setClassName] = useState('')
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [admissionDate, setAdmissionDate] = useState('')
  const [address, setAddress] = useState('')
  const [admissionFeeAmount, setAdmissionFeeAmount] = useState('')
  const [admissionFeeStatus, setAdmissionFeeStatus] = useState('pending')

  // Document uploads states
  const [uploadDocs, setUploadDocs] = useState(false)
  const [birthCertFile, setBirthCertFile] = useState<File | null>(null)
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null)
  const [tcFile, setTcFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploadingDocs, setUploadingDocs] = useState(false)

  const [students, setStudents] = useState<StudentRow[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (searchParams) {
      setSearchTerm(searchParams.get('search') || '')
    }
  }, [searchParams])
  const [isExporting, setIsExporting] = useState(false)
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<string[]>([])

  async function fetchStudents(isTeacherRole = userRole === 'Teacher', classes = teacherClasses) {
    if (!schoolId) return
    try {
      setLoading(true)
      let query = supabase.from('students').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
      if (isTeacherRole) {
        if (classes.length > 0) {
          query = query.in('class_name', classes)
        } else {
          setStudents([])
          setLoading(false)
          return
        }
      }
      const { data, error } = await query

      if (error) {
        console.error(error)
      } else {
        setStudents(data || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function exportDirectoryReport() {
    if (!schoolId) return
    setIsExporting(true)
    try {
      // 1. Fetch all students
      let query = supabase.from('students').select('*').eq('school_id', schoolId).order('class_name', { ascending: true })
      if (userRole === 'Teacher') {
        if (teacherClasses.length > 0) {
          query = query.in('class_name', teacherClasses)
        } else {
          setIsExporting(false)
          return
        }
      }
      const { data: allStudents, error: studentError } = await query

      if (studentError) throw studentError
      if (!allStudents) return

      // 2. Fetch all attendance logs
      const { data: allAttendance, error: attError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)

      // 3. Fetch all database fees
      const { data: dbFees, error: feesError } = await supabase
        .from('fees')
        .select('student_id, amount, status')
        .eq('school_id', schoolId)

      const finalFees: any[] = dbFees || []

      // Read all localStorage keys starting with `edumanage_fees_`
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('edumanage_fees_')) {
          const sId = key.replace('edumanage_fees_', '')
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || '[]')
            parsed.forEach((lf: any) => {
              if (!finalFees.some((df: any) => df.id === lf.id)) {
                finalFees.push({
                  student_id: sId,
                  amount: lf.amount,
                  status: lf.status
                })
              }
            })
          } catch (e) { }
        }
      }

      // 4. Aggregate data
      const csvRows = []
      csvRows.push('Student ID,Full Name,Class,Gender,Date of Birth,Admission Date,Parent Name,Parent Phone,Attendance Rate (%),Total Billed (₹),Total Paid (₹),Pending Balance (₹)')

      allStudents.forEach(st => {
        // Attendance
        const studentAtt = (allAttendance || []).filter(a => a.student_id === st.id)
        const present = studentAtt.filter(a => a.status === 'present').length
        const totalAtt = studentAtt.length
        const attRate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : 100

        // Fees
        const studentFees = finalFees.filter(f => f.student_id === st.id)
        let billed = 0
        let paid = 0
        let pending = 0
        studentFees.forEach(f => {
          const amt = Number(f.amount) || 0
          billed += amt
          if (f.status?.toLowerCase() === 'paid') {
            paid += amt
          } else {
            pending += amt
          }
        })

        // Clean values for CSV
        const esc = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`

        csvRows.push([
          esc(st.id),
          esc(st.full_name),
          esc(st.class_name),
          esc(st.gender),
          esc(st.date_of_birth),
          esc(st.admission_date),
          esc(st.parent_name),
          esc(st.parent_phone),
          `${attRate}%`,
          billed,
          paid,
          pending
        ].join(','))
      })

      // 5. Trigger download
      const csvContent = csvRows.join('\r\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `school_students_directory_report_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (err) {
      console.error(err)
      alert('Failed to export directory report.')
    } finally {
      setIsExporting(false)
    }
  }

  async function fetchClasses(isTeacherRole = userRole === 'Teacher', classes = teacherClasses) {
    if (!schoolId) return
    try {
      let query = supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name', { ascending: true })
      if (isTeacherRole) {
        if (classes.length > 0) {
          query = query.in('name', classes)
        } else {
          setClassesList([])
          return
        }
      }
      const { data, error } = await query
      if (!error && data) {
        setClassesList(data)
      }
    } catch (e) {
      console.error('Failed to fetch classes:', e)
    }
  }

  useEffect(() => {
    if (!schoolId) return

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let isTeacher = false
        let classes: string[] = []

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
                classes = classData
                  .map((c: any) => c.classes?.name)
                  .filter(Boolean)
                setTeacherClasses(classes)
              }
            }
          } else {
            setUserRole(null)
            setTeacherClasses([])
          }
        }

        await fetchStudents(isTeacher, classes)
        await fetchClasses(isTeacher, classes)
      } catch (err) {
        console.error('Initialization error:', err)
        await fetchStudents(false, [])
        await fetchClasses(false, [])
      }
    }
    void init()
  }, [schoolId])

  async function handleAddStudent() {
    if (!fullName || !className) {
      alert('Student name and class are required.')
      return
    }
    if (!schoolId) {
      alert('No active school selected.')
      return
    }

    const { data: newStudentData, error } = await supabase
      .from('students')
      .insert([
        {
          school_id: schoolId,
          full_name: fullName,
          parent_name: parentName || null,
          parent_phone: parentPhone || null,
          class_name: className,
          gender: gender || null,
          date_of_birth: dateOfBirth || null,
          admission_date: admissionDate || null,
          address: address || null
        }
      ])
      .select()
      .single()

    if (error) {
      alert(error.message)
    } else {
      if (uploadDocs && newStudentData?.id) {
        setUploadingDocs(true)
        const docUploads = [
          { file: birthCertFile, type: 'Birth Certificate' },
          { file: aadhaarFile, type: 'Aadhaar Card' },
          { file: tcFile, type: 'Transfer Certificate' },
          { file: photoFile, type: 'Student Photograph' }
        ]

        for (const item of docUploads) {
          if (item.file) {
            try {
              const filePath = `${schoolId}/${newStudentData.id}/${Date.now()}_${item.file.name}`
              const { error: uploadError } = await supabase.storage
                .from('student-documents')
                .upload(filePath, item.file)

              if (uploadError) {
                console.error(`Failed to upload ${item.type} to storage:`, uploadError.message)
                alert(`Failed to upload ${item.type}: ${uploadError.message}`)
                continue
              }

              const { error: insertError } = await supabase
                .from('documents')
                .insert({
                  school_id: schoolId,
                  student_id: newStudentData.id,
                  document_type: item.type,
                  file_url: filePath
                })

              if (insertError) {
                console.error(`Failed to insert database record for ${item.type}:`, insertError.message)
              }
            } catch (err) {
              console.error(`Error processing ${item.type} upload:`, err)
            }
          }
        }
        setUploadingDocs(false)
      }

      if (admissionFeeAmount && newStudentData?.id) {
        const amt = Number(admissionFeeAmount)
        if (!isNaN(amt) && amt > 0) {
          const studentId = newStudentData.id
          const month = 'Admission Fee'
          const status = admissionFeeStatus || 'pending'

          // Try inserting into Supabase
          const { data: feeData } = await supabase
            .from('fees')
            .insert({
              student_id: studentId,
              school_id: schoolId,
              amount: amt,
              status: status,
              month: month
            })
            .select()
            .single()

          // LocalStorage fallback
          const localFeesKey = `edumanage_fees_${studentId}`
          const newFee = {
            id: feeData?.id || `fee-${Math.random().toString(36).substr(2, 9)}`,
            student_id: studentId,
            school_id: schoolId,
            created_at: new Date().toISOString(),
            amount: amt,
            status: status,
            month: month
          }
          localStorage.setItem(localFeesKey, JSON.stringify([newFee]))
        }
      }

      fetchStudents()
      setFullName('')
      setParentName('')
      setParentPhone('')
      setClassName('')
      setGender('')
      setDateOfBirth('')
      setAdmissionDate('')
      setAddress('')
      setAdmissionFeeAmount('')
      setAdmissionFeeStatus('pending')
      setUploadDocs(false)
      setBirthCertFile(null)
      setAadhaarFile(null)
      setTcFile(null)
      setPhotoFile(null)
      setIsModalOpen(false)
    }
  }

  const availableClasses = useMemo(() => {
    const dbNames = classesList.map(c => c.name)
    const studentNames = students.map((s) => s.class_name).filter(Boolean)
    return Array.from(new Set([...dbNames, ...studentNames])).sort()
  }, [classesList, students])

  const filteredStudents = students.filter((student) => {
    const normalizedSearch = searchTerm.toLowerCase()
    const digitsOnly = (value: string) => value.replace(/\D/g, '')
    const searchDigits = digitsOnly(searchTerm)
    const parentDigits = digitsOnly(String(student.parent_phone ?? ''))

    const matchesSearch =
      (student.full_name?.toLowerCase() || '').includes(normalizedSearch) ||
      (student.class_name?.toLowerCase() || '').includes(normalizedSearch) ||
      (student.parent_name?.toLowerCase() || '').includes(normalizedSearch) ||
      (searchDigits.length > 0 && parentDigits.includes(searchDigits))

    const matchesClass = selectedClass === 'all' || student.class_name === selectedClass

    return matchesSearch && matchesClass
  })

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

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header and Search/Filter Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Students Directory</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Manage, filter, and view all enrolled student profiles.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, class, parent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white placeholder-slate-400 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>

          {/* Class Select Dropdown */}
          <div className="relative">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="all">All classes</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>

          {/* Export Directory Button */}
          <button
            onClick={exportDirectoryReport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExporting ? 'Exporting...' : 'Export Directory'}
          </button>

          {/* Add Student Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 focus:outline-none active:scale-[0.98] whitespace-nowrap"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-6 space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-50 space-y-2">
                <div className="h-3.5 bg-slate-100 rounded w-2/3" />
                <div className="h-3.5 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 border-dashed p-16 text-center max-w-2xl mx-auto shadow-sm">
          <div className="mx-auto h-14 w-14 text-indigo-500 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No students found</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto font-medium">
            {searchTerm
              ? "We couldn't find any students matching your search criteria. Try a different query."
              : "Get started by adding your first student to the school directory."}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 text-indigo-600 font-bold hover:text-indigo-700 text-sm inline-flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add first student
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-indigo-200/80 group flex flex-col justify-between hover:-translate-y-0.5"
            >
              <div className="p-6">
                <Link
                  href={`/students/${student.id}`}
                  className="flex items-start gap-4 mb-5 group-hover:text-indigo-600 cursor-pointer"
                >
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-50 to-violet-50 text-indigo-600 font-black text-lg border border-indigo-100 flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-105">
                    {student.full_name ? student.full_name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1 text-base" title={student.full_name}>
                      {student.full_name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/30">
                        Class {student.class_name}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200/50">
                        {studentIdMap.get(student.id) || 'Stu-?'}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="space-y-3 pt-4 border-t border-slate-100/80">
                  <div className="flex items-center text-sm text-slate-500 font-medium">
                    <svg className="mr-3 h-4 w-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
                    <span className="truncate" title={student.parent_name}>
                      Parent: <strong className="text-slate-700 font-semibold">{student.parent_name || '-'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-slate-500 font-medium">
                    <svg className="mr-3 h-4 w-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    <span className="text-slate-700 font-semibold">{student.parent_phone || '-'}</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100/60 flex items-center justify-end">
                <Link
                  href={`/students/${student.id}`}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  View Profile
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Modal Overlay */}
          <div
            className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-white shadow-xl rounded-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden transition-all transform">
            {/* Sticky Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Add New Student
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                {/* Class / Grade */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Class / Grade *
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-medium"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                  >
                    <option value="">Select class...</option>
                    {classesList.map((cls) => (
                      <option key={cls.id} value={cls.name}>
                        Class {cls.name}
                      </option>
                    ))}
                  </select>
                  {classesList.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-semibold mt-1">
                      No classes configured. Please set them up in{' '}
                      <Link href="/dashboard/settings" className="underline font-black text-indigo-600">
                        Settings
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Parent Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Parent/Guardian Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                  />
                </div>

                {/* Parent Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Parent Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gender Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white cursor-pointer"
                  >
                    <option value="">Select gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white cursor-pointer"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Admission Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Admission Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white cursor-pointer"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                  />
                </div>

                {/* Home Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Home Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123 Main St, New Delhi"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                {/* Admission Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Admission Fee (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                    value={admissionFeeAmount}
                    onChange={(e) => setAdmissionFeeAmount(e.target.value)}
                  />
                </div>

                {/* Admission Fee Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Admission Fee Status
                  </label>
                  <select
                    value={admissionFeeStatus}
                    onChange={(e) => setAdmissionFeeStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              {/* Checkbox for document upload */}
              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={uploadDocs}
                    onChange={(e) => setUploadDocs(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-200 focus:ring-indigo-500 rounded"
                  />
                  <span className="text-sm font-bold text-slate-700">Upload compliance documents now?</span>
                </label>
              </div>

              {/* Document inputs if checked */}
              {uploadDocs && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4.5 bg-slate-50/50 rounded-2xl border border-slate-200/50 animate-in fade-in-50 duration-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Birth Certificate
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                      onChange={(e) => setBirthCertFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Aadhaar Card
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                      onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Transfer Certificate (TC)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                      onChange={(e) => setTcFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Student Photograph
                    </label>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 justify-end shrink-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4.5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddStudent}
                disabled={uploadingDocs}
                className="px-4.5 py-2.5 text-sm font-semibold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                {uploadingDocs ? 'Saving Student & Documents...' : 'Save Student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}