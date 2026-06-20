'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { useSchool } from '../../../lib/SchoolContext'

type StudentInfo = {
  full_name: string
  class_name: string
}

type StudentListInfo = {
  id: string
  full_name: string
  class_name: string
  school_id: string
  created_at?: string
}

type FeeRow = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  paid_at?: string | null
  amount: number
  status: string
  month: string
  students: StudentInfo
}

type DBFeeRow = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  paid_at?: string | null
  amount: number
  status: string
  month: string
  students: StudentInfo | StudentInfo[] | null
}

type FeesAggregates = {
  totalCollected: number
  pendingAmount: number
  totalBills: number
  pendingStudents: number
}

function formatINR(value: number) {
  const safe = Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(safe)
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  } catch (e) {
    return '-'
  }
}

function splitConcatenatedMonths(monthStr: any): string[] {
  const safeStr = typeof monthStr === 'string' ? monthStr : String(monthStr || '')
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const regexPattern = new RegExp(months.join('|'), 'gi')
  const matches = safeStr.match(regexPattern)
  if (matches && matches.length > 1) {
    return matches.map(m => {
      const matched = months.find(sm => sm.toLowerCase() === m.toLowerCase())
      return matched || m
    })
  }
  return [safeStr]
}

const standardMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function Page() {
  const { schoolId } = useSchool()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<FeesAggregates>({
    totalCollected: 0,
    pendingAmount: 0,
    totalBills: 0,
    pendingStudents: 0
  })
  const [rows, setRows] = useState<FeeRow[]>([])

  // Student list for Add Fee modal
  const [studentsList, setStudentsList] = useState<StudentListInfo[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<string[]>([])

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedClass, setSelectedClass] = useState('all')
  const [searchStudentQuery, setSearchStudentQuery] = useState('')

  // Add Fee Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  
  const [formStudent, setFormStudent] = useState<StudentListInfo | null>(null)
  const [formMonths, setFormMonths] = useState<string[]>(['June'])
  const [customMonth, setCustomMonth] = useState('')
  const [showCustomMonthInput, setShowCustomMonthInput] = useState(false)
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState('unpaid')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handlePayFee = async (feeId: string, studentId: string) => {
    try {
      // 1. Update database if it's a real database fee
      if (!feeId.startsWith('fee-') && !feeId.startsWith('mock-')) {
        await supabase
          .from('fees')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', feeId)
      }

      // 2. Update localStorage fallback
      const localFeesKey = `edumanage_fees_${studentId}`
      const stored = localStorage.getItem(localFeesKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<FeeRow>[]
        const updated = parsed.map((f) => {
          if (f.id === feeId) {
            return { ...f, status: 'paid', paid_at: new Date().toISOString() }
          }
          return f
        })
        localStorage.setItem(localFeesKey, JSON.stringify(updated))
      }

      // 3. Update component state row status
      setRows((prev) =>
        prev.map((f) => {
          if (f.id === feeId) {
            return { ...f, status: 'paid', paid_at: new Date().toISOString() }
          }
          return f
        })
      )

      // 4. Recalculate stats dynamically
      setStats((prev) => {
        const fee = rows.find((r) => r.id === feeId)
        if (!fee || fee.status?.toLowerCase() === 'paid') return prev

        const amt = Number(fee.amount) || 0
        const studentPendingCount = rows.filter(
          (r) => r.student_id === studentId && r.id !== feeId && r.status?.toLowerCase() !== 'paid'
        ).length

        return {
          ...prev,
          totalCollected: prev.totalCollected + amt,
          pendingAmount: Math.max(0, prev.pendingAmount - amt),
          pendingStudents: studentPendingCount === 0 ? Math.max(0, prev.pendingStudents - 1) : prev.pendingStudents
        }
      })
    } catch (err) {
      console.error('Error paying fee:', err)
    }
  }

  useEffect(() => {
    if (!schoolId) return

    async function load() {
      try {
        setLoading(true)

        // Get user session and role
        const { data: { session } } = await supabase.auth.getSession()
        let isTeacher = false
        let assigned: string[] = []

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
                assigned = classData.map((c: any) => c.classes?.name).filter(Boolean)
                setTeacherClasses(assigned)
              }
            }
          }
        }

        // 1. Fetch all students to build a map of id -> student details
        let studentQuery = supabase
          .from('students')
          .select('id, full_name, class_name, school_id, created_at')
          .eq('school_id', schoolId)

        if (isTeacher) {
          if (assigned.length > 0) {
            studentQuery = studentQuery.in('class_name', assigned)
          } else {
            // No classes assigned
            setStudentsList([])
            setRows([])
            setStats({ totalCollected: 0, pendingAmount: 0, totalBills: 0, pendingStudents: 0 })
            setLoading(false)
            return
          }
        }

        const studentsRes = await studentQuery

        const studentsMap = new Map<string, StudentInfo>()
        const list: StudentListInfo[] = []
        const teacherStudentIds: string[] = []

        if (studentsRes.data) {
          studentsRes.data.forEach((s) => {
            studentsMap.set(s.id, {
              full_name: s.full_name || 'Unknown',
              class_name: s.class_name || 'N/A'
            })
            list.push({
              id: s.id,
              full_name: s.full_name || 'Unknown',
              class_name: s.class_name || 'N/A',
              school_id: s.school_id || schoolId,
              created_at: s.created_at
            })
            teacherStudentIds.push(s.id)
          })
        }
        setStudentsList(list)

        // 2. Fetch DB fees
        let feesQuery = supabase
          .from('fees')
          .select(`
            *,
            students (
              full_name,
              class_name
            )
          `)
          .eq('school_id', schoolId)

        if (isTeacher) {
          feesQuery = feesQuery.in('student_id', teacherStudentIds)
        }

        const feesRes = await feesQuery

        let combinedFees: FeeRow[] = []
        if (feesRes.data) {
          (feesRes.data as unknown as DBFeeRow[]).forEach((f) => {
            let studentInfo: StudentInfo = { full_name: 'Unknown', class_name: 'N/A' }
            if (f.students) {
              if (Array.isArray(f.students)) {
                if (f.students.length > 0) {
                  studentInfo = {
                    full_name: f.students[0].full_name || 'Unknown',
                    class_name: f.students[0].class_name || 'N/A'
                  }
                }
              } else {
                studentInfo = {
                  full_name: f.students.full_name || 'Unknown',
                  class_name: f.students.class_name || 'N/A'
                }
              }
            } else {
              const matched = studentsMap.get(f.student_id)
              if (matched) {
                studentInfo = matched
              }
            }

            const monthParts = splitConcatenatedMonths(f.month || '')
            monthParts.forEach((m) => {
              combinedFees.push({
                id: monthParts.length > 1 ? `${f.id}-${m.toLowerCase()}` : f.id,
                student_id: f.student_id,
                school_id: f.school_id,
                created_at: f.created_at,
                paid_at: f.paid_at,
                amount: f.amount,
                status: f.status,
                month: m,
                students: studentInfo
              })
            })
          })
        }

        // 3. Load all localStorage keys starting with `edumanage_fees_`
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('edumanage_fees_')) {
            const studentId = key.replace('edumanage_fees_', '')
            if (isTeacher && !teacherStudentIds.includes(studentId)) {
              continue // skip this localStorage record since it is outside teacher's classes
            }
            try {
              const parsed = JSON.parse(localStorage.getItem(key) || '[]') as Partial<FeeRow>[]
              parsed.forEach((lf) => {
                if (lf.school_id !== schoolId) {
                  return // skip if not matching current active school
                }
                // Avoid duplicate records if it's already in combinedFees
                const studentInfo = studentsMap.get(studentId) || { full_name: 'Unknown', class_name: 'N/A' }
                const monthParts = splitConcatenatedMonths(lf.month || 'Admission Fee')
                monthParts.forEach((m) => {
                  const tempId = monthParts.length > 1 && lf.id ? `${lf.id}-${m.toLowerCase()}` : (lf.id || `fee-${Math.random().toString(36).substring(2, 9)}`)
                  if (!combinedFees.some((df) => df.id === tempId)) {
                    combinedFees.push({
                      id: tempId,
                      student_id: studentId,
                      school_id: schoolId as string,
                      created_at: lf.created_at || new Date().toISOString(),
                      paid_at: lf.paid_at,
                      amount: lf.amount || 0,
                      status: lf.status || 'pending',
                      month: m,
                      students: studentInfo
                    })
                  }
                })
              })
            } catch (e) {
              console.error('Error parsing localStorage fee record:', e)
            }
          }
        }

        // 4. Calculate stats from combined dataset
        let totalCollected = 0
        let pendingAmount = 0
        const pendingStudentsSet = new Set<string>()

        combinedFees.forEach((fee) => {
          const amt = Number(fee.amount) || 0
          const isPaid = fee.status?.toLowerCase() === 'paid'
          if (isPaid) {
            totalCollected += amt
          } else {
            pendingAmount += amt
            if (fee.student_id) {
              pendingStudentsSet.add(fee.student_id)
            }
          }
        })

        const totalBills = combinedFees.length
        const pendingStudents = pendingStudentsSet.size

        setRows(combinedFees)
        setStats({
          totalCollected,
          pendingAmount,
          totalBills,
          pendingStudents
        })
      } catch (err) {
        console.error('Error loading fees dashboard cards:', err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [schoolId])

  // Dynamic filter values
  const uniqueClasses = useMemo(() => {
    const classesFromStudents = studentsList.map(s => s.class_name).filter(Boolean)
    const classesFromRows = rows.map(r => r.students.class_name).filter(Boolean)
    const set = new Set(['Nursery', 'LKG', 'UKG', ...classesFromStudents, ...classesFromRows])
    return Array.from(set).sort((a, b) => {
      const order = { 'nursery': 1, 'lkg': 2, 'ukg': 3 }
      const aOrder = order[a.toLowerCase() as keyof typeof order] || 99
      const bOrder = order[b.toLowerCase() as keyof typeof order] || 99
      if (aOrder !== bOrder) return aOrder - bOrder
      
      const aNum = parseInt(a, 10)
      const bNum = parseInt(b, 10)
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
      return a.localeCompare(b)
    })
  }, [studentsList, rows])

  const uniqueMonths = useMemo(() => {
    const monthsFromRows = rows.map(r => r.month).filter(Boolean)
    const set = new Set([...standardMonths, ...monthsFromRows])
    return Array.from(set)
  }, [rows])

  // Filtered rows matching search query and dropdown selects
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Student Search Bar Filter
      if (searchStudentQuery.trim()) {
        const query = searchStudentQuery.toLowerCase()
        const name = row.students.full_name?.toLowerCase() || ''
        if (!name.includes(query)) {
          return false
        }
      }

      // Month Filter
      if (selectedMonth !== 'all' && row.month !== selectedMonth) {
        return false
      }
      
      // Status Filter
      if (selectedStatus !== 'all') {
        const rowStatus = row.status?.toLowerCase()
        const filterStatus = selectedStatus.toLowerCase()
        if (filterStatus === 'paid') {
          if (rowStatus !== 'paid') return false
        } else if (filterStatus === 'pending' || filterStatus === 'unpaid') {
          if (rowStatus === 'paid') return false
        } else {
          if (rowStatus !== filterStatus) return false
        }
      }
      
      // Class Filter
      if (selectedClass !== 'all' && row.students.class_name !== selectedClass) {
        return false
      }
      
      return true
    })
  }, [rows, searchStudentQuery, selectedMonth, selectedStatus, selectedClass])

  // Student list filtered by modal search query
  const filteredStudentsForModal = useMemo(() => {
    if (!searchQuery.trim()) return studentsList
    const query = searchQuery.toLowerCase()
    return studentsList.filter(s => 
      s.full_name.toLowerCase().includes(query) || 
      s.class_name.toLowerCase().includes(query)
    )
  }, [studentsList, searchQuery])

  const studentIdMap = useMemo(() => {
    const sorted = [...studentsList].sort((a, b) => {
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
  }, [studentsList])

  // Export current filtered fee records to CSV
  const exportFeesToCSV = () => {
    if (filteredRows.length === 0) return

    const headers = 'Student Name,Class,Month,Amount (INR),Status,Paid On,Billing Date\r\n'
    const rowsCSV = [...filteredRows]
      .map(r => {
        const studentName = r.students.full_name || 'Unknown'
        const className = isNaN(Number(r.students.class_name)) ? r.students.class_name : `Class ${r.students.class_name}`
        const paidDate = r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '-'
        const billingDate = r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'
        
        return `"${studentName.replace(/"/g, '""')}","${className.replace(/"/g, '""')}","${r.month.replace(/"/g, '""')}",${r.amount},"${r.status || 'Pending'}","${paidDate}","${billingDate}"`
      })
      .join('\r\n')

    const csvContent = headers + rowsCSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    
    const filename = `fees_export_${new Date().toISOString().split('T')[0]}.csv`
    
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle new fee submission
  const handleAddFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formStudent) {
      setSubmitError('Please select a student.')
      return
    }
    if (!schoolId) {
      setSubmitError('No active school selected.')
      return
    }

    const selectedMonthsList = showCustomMonthInput 
      ? [customMonth.trim()] 
      : formMonths

    if (selectedMonthsList.length === 0 || (showCustomMonthInput && !customMonth.trim())) {
      setSubmitError('Please select or specify at least one month.')
      return
    }

    const amountNum = parseFloat(formAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setSubmitError('Please enter a valid amount greater than 0.')
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)

      const statusVal = formStatus.toLowerCase() // 'paid', 'pending', or 'unpaid'
      const studentId = formStudent.id

      const insertedRows: FeeRow[] = []
      const newLocalFeesToSave: any[] = []

      for (const month of selectedMonthsList) {
        // 1. Insert into Supabase
        const { data, error } = await supabase
          .from('fees')
          .insert({
            student_id: studentId,
            school_id: schoolId,
            month: month,
            amount: amountNum,
            status: statusVal,
            paid_at: statusVal === 'paid' ? new Date().toISOString() : null
          })
          .select()
          .single()

        const tempId = `fee-${Math.random().toString(36).substring(2, 9)}`
        const newFeeRow: FeeRow = {
          id: data?.id || tempId,
          student_id: studentId,
          school_id: schoolId as string,
          created_at: data?.created_at || new Date().toISOString(),
          paid_at: data?.paid_at || (statusVal === 'paid' ? new Date().toISOString() : null),
          amount: amountNum,
          status: statusVal,
          month: month,
          students: {
            full_name: formStudent.full_name,
            class_name: formStudent.class_name
          }
        }

        if (error) {
          console.warn(`Supabase insertion error for month ${month}, using localStorage fallback:`, error.message)
        }

        insertedRows.push(newFeeRow)
        newLocalFeesToSave.push({
          id: newFeeRow.id,
          school_id: newFeeRow.school_id,
          created_at: newFeeRow.created_at,
          paid_at: newFeeRow.paid_at,
          amount: newFeeRow.amount,
          status: newFeeRow.status,
          month: newFeeRow.month
        })
      }

      // 2. Sync with localStorage fallback
      const localFeesKey = `edumanage_fees_${studentId}`
      const stored = localStorage.getItem(localFeesKey)
      const currentList = stored ? JSON.parse(stored) as Partial<FeeRow>[] : []
      const updatedList = [...newLocalFeesToSave, ...currentList]
      localStorage.setItem(localFeesKey, JSON.stringify(updatedList))

      // 3. Update UI states
      setRows((prev) => [...insertedRows, ...prev])

      // 4. Update overall statistics card values
      setStats((prev) => {
        const isPaid = statusVal === 'paid'
        const totalAmountAdded = amountNum * selectedMonthsList.length
        
        // Count student pending bills
        const hasOtherPending = rows.some(r => r.student_id === studentId && r.status?.toLowerCase() !== 'paid')
        const isStudentNewlyPending = !isPaid && !hasOtherPending

        return {
          totalCollected: isPaid ? prev.totalCollected + totalAmountAdded : prev.totalCollected,
          pendingAmount: !isPaid ? prev.pendingAmount + totalAmountAdded : prev.pendingAmount,
          totalBills: prev.totalBills + selectedMonthsList.length,
          pendingStudents: isStudentNewlyPending ? prev.pendingStudents + 1 : prev.pendingStudents
        }
      })

      // Close modal and reset form
      setIsAddModalOpen(false)
      setFormStudent(null)
      setSearchQuery('')
      setFormAmount('')
      setFormMonths(['June'])
      setCustomMonth('')
      setShowCustomMonthInput(false)
      setFormStatus('unpaid')
    } catch (err: any) {
      console.error('Submit error:', err)
      setSubmitError(err.message || 'An error occurred during submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header section with title and Add Fee Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Fees Overview</h1>
          <p className="text-slate-500 mt-1.5 font-medium">Collected vs pending fee status</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          {filteredRows.length > 0 && (
            <button
              onClick={exportFeesToCSV}
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}
          <button
            onClick={() => {
              setIsAddModalOpen(true)
              setSubmitError(null)
            }}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Fee
          </button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Collected</span>
          {loading ? (
            <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">{formatINR(stats.totalCollected)}</h4>
          )}
        </div>

        <div className="bg-white border border-rose-100/60 rounded-2xl p-6 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Pending</span>
          {loading ? (
            <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <h4 className="text-2xl font-black text-rose-600 tracking-tight">{formatINR(stats.pendingAmount)}</h4>
          )}
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bills</span>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">{stats.totalBills}</h4>
          )}
        </div>

        <div 
          onClick={() => setSelectedStatus('pending')}
          className="bg-white border border-indigo-150 rounded-2xl p-6 shadow-sm space-y-1 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all active:scale-[0.98] select-none"
          title="Click to show only pending/unpaid fees"
        >
          <span className="text-[10px] font-bold text-indigo-605 uppercase tracking-wider block">Due</span>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <h4 className="text-2xl font-black text-indigo-655 tracking-tight">{stats.pendingStudents}</h4>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm relative">
        <input
          type="text"
          placeholder="Search Student..."
          value={searchStudentQuery}
          onChange={(e) => setSearchStudentQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-450 transition-all font-medium placeholder-slate-400"
        />
        <div className="absolute left-7.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        {searchStudentQuery && (
          <button
            type="button"
            onClick={() => setSearchStudentQuery('')}
            className="absolute right-7.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Filters Section */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4.5 shadow-sm flex flex-col md:flex-row gap-4">
        {/* Month Filter */}
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Month</label>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-450 transition-all appearance-none cursor-pointer font-medium"
            >
              <option value="all">All Months</option>
              {uniqueMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</label>
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-450 transition-all appearance-none cursor-pointer font-medium"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Class Filter */}
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class</label>
          <div className="relative">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-450 transition-all appearance-none cursor-pointer font-medium"
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map((c) => (
                <option key={c} value={c}>
                  {isNaN(Number(c)) ? c : `Class ${c}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Fees Table */}
      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Student</th>
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Class</th>
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Month</th>
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Paid On</th>
              <th className="border-b border-slate-200/60 px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm font-semibold text-slate-400 bg-slate-50/10">
                  No fee records match the selected filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((fee) => (
                <tr key={fee.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800 text-sm">
                    <div className="flex flex-col">
                      <span>{fee.students.full_name}</span>
                      <span className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">{studentIdMap.get(fee.student_id) || 'Stu-?'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm font-medium">
                    {isNaN(Number(fee.students.class_name)) ? fee.students.class_name : `Class ${fee.students.class_name}`}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm font-medium">{fee.month}</td>
                  <td className="px-6 py-4 text-slate-800 text-sm font-bold">{formatINR(Number(fee.amount) || 0)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      fee.status?.toLowerCase() === 'paid'
                        ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100'
                        : 'bg-rose-50/50 text-rose-700 border-rose-100'
                    }`}>
                      {fee.status?.toLowerCase() === 'paid' ? 'Paid' : fee.status?.charAt(0).toUpperCase() + fee.status?.slice(1) || 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-550 text-xs font-semibold">{formatDate(fee.paid_at)}</td>
                  <td className="px-6 py-4 text-right">
                    {fee.status?.toLowerCase() !== 'paid' ? (
                      <button
                        onClick={() => handlePayFee(fee.id, fee.student_id)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Mark Paid
                      </button>
                    ) : (
                      <Link
                        href={`/receipt/${fee.id}`}
                        target="_blank"
                        className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-250/35 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Receipt
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Fee Modal Overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAddModalOpen(false)}
          />
          
          {/* Modal Container */}
          <div className="relative bg-white border border-slate-200/80 shadow-2xl rounded-2xl max-w-md w-full overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">Add Fee Record</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddFeeSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {submitError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs font-semibold px-4 py-3 rounded-xl">
                  {submitError}
                </div>
              )}

              {/* Student Search selector */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Student</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search student by name or class..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (!formStudent || e.target.value !== formStudent.full_name) {
                        setFormStudent(null)
                      }
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-450 transition-all font-medium"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                  </div>
                  {formStudent && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormStudent(null)
                        setSearchQuery('')
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Combobox dropdown options */}
                {isSearchFocused && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsSearchFocused(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-xl max-h-48 overflow-y-auto z-20 divide-y divide-slate-100">
                      {filteredStudentsForModal.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 font-semibold text-center">
                          No matching students found
                        </div>
                      ) : (
                        filteredStudentsForModal.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setFormStudent(s)
                              setSearchQuery(s.full_name)
                              setIsSearchFocused(false)
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50/80 flex justify-between items-center transition-colors group cursor-pointer"
                          >
                            <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                              {s.full_name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md">
                              {isNaN(Number(s.class_name)) ? s.class_name : `Class ${s.class_name}`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Month Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Billed Months</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomMonthInput(!showCustomMonthInput)
                      setCustomMonth('')
                    }}
                    className="text-xs font-bold text-indigo-650 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    {showCustomMonthInput ? 'Select Months' : 'Custom Month...'}
                  </button>
                </div>

                {!showCustomMonthInput ? (
                  <div className="grid grid-cols-4 gap-2 animate-in fade-in duration-200">
                    {[
                      { label: 'Jan', value: 'January' },
                      { label: 'Feb', value: 'February' },
                      { label: 'Mar', value: 'March' },
                      { label: 'Apr', value: 'April' },
                      { label: 'May', value: 'May' },
                      { label: 'Jun', value: 'June' },
                      { label: 'Jul', value: 'July' },
                      { label: 'Aug', value: 'August' },
                      { label: 'Sep', value: 'September' },
                      { label: 'Oct', value: 'October' },
                      { label: 'Nov', value: 'November' },
                      { label: 'Dec', value: 'December' }
                    ].map((m) => {
                      const isSelected = formMonths.includes(m.value)
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setFormMonths((prev) =>
                              prev.includes(m.value)
                                ? prev.filter((x) => x !== m.value)
                                : [...prev, m.value]
                            )
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer select-none active:scale-95 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                              : 'bg-slate-50 border-slate-200/80 text-slate-650 hover:bg-slate-100 hover:border-slate-350'
                          }`}
                        >
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-150">
                    <input
                      type="text"
                      placeholder="e.g. Admission / Annual Fee"
                      value={customMonth}
                      onChange={(e) => setCustomMonth(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-450 transition-all font-medium"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="250"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-450 transition-all font-medium"
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    ₹
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Status</label>
                <div className="relative">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-450 transition-all appearance-none cursor-pointer font-medium"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold px-4.5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Add Fee'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

