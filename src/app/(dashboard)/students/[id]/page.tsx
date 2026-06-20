"use client"

import { use, useEffect, useMemo, useState, useRef } from "react"
import Link from "next/link"
import { supabase } from "../../../../lib/supabase-client"
import { useSchool } from "../../../../lib/SchoolContext"

// Import modular student profile components
import ProfileHeader from "../../../components/student/ProfileHeader"
import ContactCard from "../../../components/student/ContactCard"
import PersonalDetailsCard from "../../../components/student/PersonalDetailsCard"
import AttendanceSection from "../../../components/student/AttendanceSection"
import FeesSection from "../../../components/student/FeesSection"
import DocumentsSection from "../../../components/student/DocumentsSection"
import ActivityTimeline from "../../../components/student/ActivityTimeline"

type StudentDetails = {
  id: string
  school_id: string
  full_name: string | null
  date_of_birth: string | null
  gender: string | null
  parent_name: string | null
  parent_phone: string | null
  address: string | null
  class_name: string | null
  admission_date: string | null
  created_at: string
}

type AttendanceRecord = {
  id: string
  date: string
  status: 'present' | 'absent'
}

type FeeRecord = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  paid_at?: string | null
  amount: number
  status: string
  month: string
}

type DocumentRecord = {
  id: string
  student_id: string
  school_id: string
  created_at: string
  file_url: string
}

type Params = { id?: string }

function formatDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

export default function StudentDetailsPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params)
  const studentId = resolvedParams.id
  const { schoolId } = useSchool()

  const [student, setStudent] = useState<StudentDetails | null>(null)
  const [displayId, setDisplayId] = useState<string>('Stu-?')
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [fees, setFees] = useState<FeeRecord[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Document Upload States
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadDocType, setUploadDocType] = useState<string>("Birth Certificate")
  const [isUploading, setIsUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<{ file: File; type: string } | null>(null)

  // Restore upload modal state from sessionStorage
  useEffect(() => {
    if (studentId) {
      const isRestoreOpen = sessionStorage.getItem(`edumanage_profile_upload_open_${studentId}`) === 'true'
      if (isRestoreOpen) {
        const docType = sessionStorage.getItem(`edumanage_profile_upload_type_${studentId}`) || 'Birth Certificate'
        setUploadDocType(docType)
        setIsUploadOpen(true)
      }
    }
  }, [studentId])

  // Persist upload modal state to sessionStorage
  useEffect(() => {
    if (studentId) {
      if (isUploadOpen) {
        sessionStorage.setItem(`edumanage_profile_upload_open_${studentId}`, 'true')
        sessionStorage.setItem(`edumanage_profile_upload_type_${studentId}`, uploadDocType)
      } else {
        sessionStorage.removeItem(`edumanage_profile_upload_open_${studentId}`)
        sessionStorage.removeItem(`edumanage_profile_upload_type_${studentId}`)
      }
    }
  }, [isUploadOpen, uploadDocType, studentId])

  // Trigger hidden input click
  const triggerFileInput = (docType: string) => {
    setUploadDocType(docType)
    if (studentId) {
      sessionStorage.setItem(`edumanage_profile_upload_type_${studentId}`, docType)
    }
    // Small timeout to ensure input element is active
    setTimeout(() => {
      fileInputRef.current?.click()
    }, 0)
  }

  // Handle selected file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setSelectedFile(file)
      if (!isUploadOpen) {
        // Direct upload without modal
        setPendingFile({ file, type: uploadDocType })
      }
    }
  }

  // Effect to process deferred/pending uploads once hydrated
  useEffect(() => {
    if (pendingFile && student && schoolId) {
      const { file, type } = pendingFile
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      void handleUploadDocument(file, type)
    }
  }, [pendingFile, student, schoolId])

  const handleModalUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      alert('Please select a file to upload.')
      return
    }
    const file = selectedFile
    setSelectedFile(null)
    setIsUploadOpen(false)
    void handleUploadDocument(file, uploadDocType)
  }

  // Load fees from Supabase + localStorage fallback
  const fetchFeesAndDocs = async (sId: string) => {
    if (!schoolId) return
    try {
      // 1. Fetch fees
      const { data: dbFees } = await supabase
        .from("fees")
        .select("*")
        .eq("student_id", sId)
        .eq("school_id", schoolId)
 
      // 3. Load from localStorage
      const localFeesKey = `edumanage_fees_${sId}`
 
      let finalFees: FeeRecord[] = []
      if (dbFees) {
        dbFees.forEach(f => {
          const monthParts = splitConcatenatedMonths(f.month || '')
          monthParts.forEach(m => {
            finalFees.push({
              ...f,
              id: monthParts.length > 1 ? `${f.id}-${m.toLowerCase()}` : f.id,
              month: m
            })
          })
        })
      }
 
      const storedFees = localStorage.getItem(localFeesKey)
 
      if (storedFees) {
        const parsed = JSON.parse(storedFees)
        // Merge - unique by month/id
        parsed.forEach((lf: FeeRecord) => {
          const monthParts = splitConcatenatedMonths(lf.month || '')
          monthParts.forEach(m => {
            const tempId = monthParts.length > 1 ? `${lf.id}-${m.toLowerCase()}` : lf.id
            if (!finalFees.some(df => df.id === tempId || df.month === m)) {
              finalFees.push({
                ...lf,
                id: tempId,
                month: m
              })
            }
          })
        })
      }
 
      setFees(finalFees)
    } catch (err) {
      console.error("Failed to load fees:", err)
    }
  }

  // Load documents directly from Supabase
  const fetchDocuments = async (sId: string) => {
    if (!schoolId) return
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("student_id", sId)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to fetch documents:", error.message)
        return
      }

      setDocuments(data || [])
    } catch (err) {
      console.error("Failed to load documents:", err)
    }
  }

  // Map database logs into a 30-day grid log
  const attendanceHistory = useMemo(() => {
    const dates = []

    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = formatDateString(date)
      const dayOfWeek = date.getDay()

      const dbRecord = attendanceRecords.find(r => r.date === dateStr)

      let status: 'present' | 'absent' | 'weekend' | 'unmarked' = 'unmarked'

      if (dbRecord) {
        status = dbRecord.status
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = 'weekend'
      }

      dates.push({
        dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayNum: date.getDate(),
        status
      })
    }
    return dates
  }, [attendanceRecords])

  const attendanceSummary = useMemo(() => {
    const present = attendanceRecords.filter(r => r.status === 'present').length
    const totalMarked = attendanceRecords.length
    const rate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 100
    return { present, totalMarked, rate }
  }, [attendanceRecords])

  // Computed Fee status ("Paid" or "Outstanding")
  const feeStatus = useMemo(() => {
    const hasPending = fees.some(f => f.status?.toLowerCase() === 'pending')
    return hasPending ? 'Outstanding' : 'Paid'
  }, [fees])

  useEffect(() => {
    if (!studentId) {
      setLoading(false)
      setErrorMsg("Invalid student id.")
      setStudent(null)
      return
    }
    if (!schoolId) {
      return
    }

    const sId = studentId
    let cancelled = false

    async function fetchStudentAndLogs() {
      setLoading(true)
      setErrorMsg(null)

      try {
        // Fetch student profile details
        const studentRes = await supabase
          .from("students")
          .select("*")
          .eq("id", sId)
          .eq("school_id", schoolId)
          .single()

        if (cancelled) return

        if (studentRes.error) {
          setErrorMsg(studentRes.error.message)
          setStudent(null)
          setLoading(false)
          return
        }

        // Verify Teacher permissions
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('id, role')
            .eq('user_id', session.user.id)
            .eq('school_id', schoolId)
            .single()

          if (staffData && staffData.role === 'Teacher') {
            const { data: classData } = await supabase
              .from('teacher_classes')
              .select('classes(name)')
              .eq('teacher_id', staffData.id)

            const teacherClasses = classData?.map((c: any) => c.classes?.name).filter(Boolean) || []
            const studentClass = studentRes.data?.class_name

            if (!studentClass || !teacherClasses.includes(studentClass)) {
              setErrorMsg('Access Denied: You do not have permission to view students from this class.')
              setStudent(null)
              setLoading(false)
              return
            }
          }
        }

        setStudent(studentRes.data as unknown as StudentDetails)

        // Fetch all students to calculate display ID (Stu-X)
        const allStudentsRes = await supabase
          .from("students")
          .select("id, created_at")
          .eq("school_id", schoolId)
        
        if (!allStudentsRes.error && allStudentsRes.data) {
          const sorted = [...allStudentsRes.data].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
            if (timeA !== timeB) return timeA - timeB
            return a.id.localeCompare(b.id)
          })
          const idx = sorted.findIndex(s => s.id === sId)
          if (idx !== -1) {
            setDisplayId(`Stu-${idx + 1}`)
          }
        }

        // Fetch attendance logs for this student
        const attendanceRes = await supabase
          .from("attendance")
          .select("id, date, status")
          .eq("student_id", sId)
          .eq("school_id", schoolId)
          .order("date", { ascending: false })

        if (cancelled) return

        if (!attendanceRes.error) {
          setAttendanceRecords(attendanceRes.data || [])
        }

        // Fetch fees and docs
        await fetchFeesAndDocs(sId)
        await fetchDocuments(sId)

      } catch (err: any) {
        console.error(err)
        setErrorMsg(err.message || "An unexpected error occurred.")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchStudentAndLogs()

    return () => {
      cancelled = true
    }
  }, [studentId, schoolId])

  // Edit Student Callback
  const handleUpdateStudent = async (updatedDetails: Partial<StudentDetails>) => {
    if (!studentId) return
    const { data, error } = await supabase
      .from("students")
      .update(updatedDetails)
      .eq("id", studentId)
      .select()
      .single()

    if (error) {
      throw error
    } else {
      setStudent(data as unknown as StudentDetails)
    }
  }

  // Add Fee Callback
  const handleAddFee = async (months: string[], amount: number, status: 'paid' | 'pending') => {
    if (!studentId || !student || !schoolId) return

    const newFeesToSave: FeeRecord[] = []

    for (const month of months) {
      const newFee: FeeRecord = {
        id: `fee-${Math.random().toString(36).substr(2, 9)}`,
        student_id: studentId,
        school_id: schoolId as string,
        created_at: new Date().toISOString(),
        paid_at: status === 'paid' ? new Date().toISOString() : null,
        amount,
        status,
        month
      }

      // Try inserting into Supabase
      const { data, error } = await supabase
        .from('fees')
        .insert({
          student_id: studentId,
          school_id: schoolId,
          amount,
          status,
          month,
          paid_at: status === 'paid' ? new Date().toISOString() : null
        })
        .select()
        .single()

      let feeToSave = newFee
      if (!error && data) {
        feeToSave = data as unknown as FeeRecord
      }
      newFeesToSave.push(feeToSave)
    }

    // Save to localStorage fallback
    const localFeesKey = `edumanage_fees_${studentId}`
    const stored = localStorage.getItem(localFeesKey)
    const currentList = stored ? JSON.parse(stored) : []
    const updatedList = [...newFeesToSave, ...currentList]
    localStorage.setItem(localFeesKey, JSON.stringify(updatedList))

    setFees(prev => [...newFeesToSave, ...prev])
  }

  // Pay Fee Callback
  const handlePayFee = async (feeId: string) => {
    if (!studentId) return

    // Try updating Supabase if it's a db fee
    if (!feeId.startsWith('fee-') && !feeId.startsWith('mock-')) {
      await supabase
        .from('fees')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', feeId)
    }

    // Always update local storage list
    const localFeesKey = `edumanage_fees_${studentId}`
    const stored = localStorage.getItem(localFeesKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      const updated = parsed.map((f: FeeRecord) => {
        if (f.id === feeId) {
          return { ...f, status: 'paid', paid_at: new Date().toISOString() }
        }
        return f
      })
      localStorage.setItem(localFeesKey, JSON.stringify(updated))
    }

    // Update state
    setFees(prev => prev.map(f => {
      if (f.id === feeId) {
        return { ...f, status: 'paid', paid_at: new Date().toISOString() }
      }
      return f
    }))
  }

  // Pay Multiple Fees Callback
  const handlePayMultipleFees = async (feeIds: string[]) => {
    if (!studentId) return

    // 1. Identify DB fees and update them in Supabase
    const dbFeeIds = feeIds.filter(id => !id.startsWith('fee-') && !id.startsWith('mock-'))
    if (dbFeeIds.length > 0) {
      await supabase
        .from('fees')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .in('id', dbFeeIds)
    }

    // 2. Update local storage
    const localFeesKey = `edumanage_fees_${studentId}`
    const stored = localStorage.getItem(localFeesKey)
    if (stored) {
      const parsed = JSON.parse(stored)
      const updated = parsed.map((f: FeeRecord) => {
        if (feeIds.includes(f.id)) {
          return { ...f, status: 'paid', paid_at: new Date().toISOString() }
        }
        return f
      })
      localStorage.setItem(localFeesKey, JSON.stringify(updated))
    }

    // 3. Update React state
    setFees(prev => prev.map(f => {
      if (feeIds.includes(f.id)) {
        return { ...f, status: 'paid', paid_at: new Date().toISOString() }
      }
      return f
    }))
  }

  // Upload Document Callback
  const handleUploadDocument = async (file: File, documentType: string = "Other") => {
    // Validate file size and format first
    const allowedExtensions = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'xlsx', 'webp', 'heic', 'heif', 'jfif'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImg = file.type.startsWith('image/');
    if (!allowedExtensions.includes(ext) && !isImg) {
      alert("Invalid file format. Please upload PDF, Word, Excel, or image files only.");
      return;
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`File size exceeds the 10 MB limit. (Selected file: ${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      return;
    }

    if (!studentId || !student || !schoolId) {
      // Defer uploader logic if page reloaded and details are still loading
      setPendingFile({ file, type: documentType })
      return
    }

    setIsUploading(true)
    console.log("Upload started")
    console.log("File selected", file)
    console.log("Page visibility", document.visibilityState)
    console.log("Before upload")

    const filePath = `${schoolId}/${studentId}/${Date.now()}_${file.name}`

    try {
      // 1. Upload file to storage private bucket
      const { error: uploadError } = await supabase.storage
        .from("student-documents")
        .upload(filePath, file)

      if (uploadError) {
        console.error("Storage upload error:", uploadError.message)
        alert(`Storage upload failed: ${uploadError.message}`)
        console.log("Upload failed")
        return
      }

      // 2. Insert document record in Database
      const { error: insertError } = await supabase
        .from("documents")
        .insert({
          school_id: schoolId,
          student_id: studentId,
          document_type: documentType,
          file_url: filePath
        })

      if (insertError) {
        console.error("Database insert error:", insertError.message)
        alert(`Failed to save document metadata: ${insertError.message}`)
        console.log("Upload failed")
        return
      }

      console.log("Upload success")
      // 3. Refresh list from Supabase
      await fetchDocuments(studentId)

    } catch (err: any) {
      console.error("Failed to upload document:", err)
      alert(`An error occurred: ${err.message || err}`)
      console.log("Upload failed")
    } finally {
      setIsUploading(false)
      sessionStorage.removeItem(`edumanage_profile_upload_open_${studentId}`)
      sessionStorage.removeItem(`edumanage_profile_upload_type_${studentId}`)
    }
  }

  // Delete Document Callback
  const handleDeleteDocument = async (docId: string) => {
    if (!studentId) return

    try {
      // 1. Fetch document record to get file_url
      const { data: docRecord, error: fetchError } = await supabase
        .from("documents")
        .select("file_url")
        .eq("id", docId)
        .single()

      if (fetchError) {
        console.error("Failed to fetch document metadata for deletion:", fetchError.message)
        setDocuments(prev => prev.filter(d => d.id !== docId))
        return
      }

      const fileUrl = docRecord?.file_url

      // 2. Delete from Storage
      if (fileUrl) {
        const { error: storageError } = await supabase.storage
          .from("student-documents")
          .remove([fileUrl])

        if (storageError) {
          console.warn("Storage deletion warning:", storageError.message)
        }
      }

      // 3. Delete from Database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId)

      if (dbError) {
        console.error("Database deletion error:", dbError.message)
        alert(`Failed to delete document: ${dbError.message}`)
        return
      }

      // 4. Refresh list
      await fetchDocuments(studentId)

    } catch (err: any) {
      console.error("Failed to delete document:", err)
      alert(`Deletion error: ${err.message || err}`)
    }
  }

  // Delete Student Callback
  const handleDeleteStudent = async () => {
    if (!studentId) return

    try {
      // 1. Delete dependent records sequentially to handle database constraints
      // Delete attendance logs
      await supabase
        .from('attendance')
        .delete()
        .eq('student_id', studentId)

      // Delete fee logs
      await supabase
        .from('fees')
        .delete()
        .eq('student_id', studentId)

      // Delete documents logs
      await supabase
        .from('documents')
        .delete()
        .eq('student_id', studentId)

      // Delete activities or logs (if tables exist)
      try {
        await supabase
          .from('activities')
          .delete()
          .eq('student_id', studentId)
      } catch (e) { }

      try {
        await supabase
          .from('activity_log')
          .delete()
          .eq('student_id', studentId)
      } catch (e) { }

      // 2. Delete student record
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)

      if (error) throw error

      // 3. Clear local storage records
      localStorage.removeItem(`edumanage_fees_${studentId}`)
      localStorage.removeItem(`edumanage_docs_${studentId}`)

      // 4. Redirect back to directory
      alert('Student profile deleted successfully.')
      window.location.href = '/students'

    } catch (err: any) {
      console.error(err)
      alert(`Failed to delete student: ${err.message}`)
    }
  }

  // Download history as CSV
  function exportToCSV() {
    if (!student || attendanceRecords.length === 0) return

    const headers = 'Date,Day of Week,Status\r\n'
    const rows = [...attendanceRecords]
      .sort((a, b) => b.date.localeCompare(a.date)) // descending date sorting
      .map(r => {
        const dateObj = new Date(r.date)
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
        return `${r.date},${dayName},${r.status}`
      })
      .join('\r\n')

    const csvContent = headers + rows
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    const filename = `${student.full_name?.toLowerCase().replace(/\s+/g, '_')}_attendance_history.csv`
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export Comprehensive Student Report as CSV
  function exportStudentReport() {
    if (!student) return

    const lines = []
    lines.push('EDUMANAGE STUDENT PROFILE REPORT')
    lines.push(`Generated on: ${new Date().toLocaleDateString()}`)
    lines.push('')

    lines.push('--- STUDENT DEMOGRAPHICS ---')
    lines.push(`Student ID,${student.id}`)
    lines.push(`Full Name,${student.full_name || '-'}`)
    lines.push(`Class / Grade,Class ${student.class_name || '-'}`)
    lines.push(`Parent/Guardian Name,${student.parent_name || '-'}`)
    lines.push(`Parent Phone Number,${student.parent_phone || '-'}`)
    lines.push(`Home Address,${student.address?.replace(/,/g, ' ') || '-'}`)
    lines.push(`Gender,${student.gender || '-'}`)
    lines.push(`Date of Birth,${student.date_of_birth || '-'}`)
    lines.push(`Admission Date,${student.admission_date || '-'}`)
    lines.push('')

    const present = attendanceRecords.filter(r => r.status === 'present').length
    const absent = attendanceRecords.filter(r => r.status === 'absent').length
    const totalMarked = attendanceRecords.length
    const rate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 100

    const sortedAtt = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date))
    let longestStreak = 0
    let currentStreak = 0
    for (const record of sortedAtt) {
      if (record.status === 'present') {
        currentStreak++
        if (currentStreak > longestStreak) longestStreak = currentStreak
      } else if (record.status === 'absent') {
        currentStreak = 0
      }
    }

    lines.push('--- ATTENDANCE ANALYSIS (LAST 30 DAYS) ---')
    lines.push(`Attendance Rate,${rate}%`)
    lines.push(`Total Days Present,${present}`)
    lines.push(`Total Days Absent,${absent}`)
    lines.push(`Longest Present Streak,${longestStreak} days`)
    lines.push('')

    let totalBilled = 0
    let totalPaid = 0
    let pendingBalance = 0
    const pendingMonths: string[] = []

    fees.forEach(f => {
      const amt = Number(f.amount) || 0
      totalBilled += amt
      if (f.status?.toLowerCase() === 'paid') {
        totalPaid += amt
      } else {
        pendingBalance += amt
        pendingMonths.push(`${f.month} (₹${f.amount})`)
      }
    })

    lines.push('--- FINANCIAL STATUS (₹) ---')
    lines.push(`Total Fees Billed,₹${totalBilled}`)
    lines.push(`Total Fees Paid,₹${totalPaid}`)
    lines.push(`Pending Balance,₹${pendingBalance}`)
    lines.push(`Fee Status,${feeStatus}`)
    lines.push(`Outstanding Months,${pendingMonths.join('; ') || 'None'}`)
    lines.push('')

    lines.push('--- ATTACHED DOCUMENTS ---')
    if (documents.length === 0) {
      lines.push('No documents uploaded.')
    } else {
      lines.push('Document Name,File URL')
      documents.forEach(doc => {
        const docName = doc.file_url.split('/').pop() || 'document.pdf'
        const cleanedName = decodeURIComponent(docName).replace(/^\d{13}_/, '')
        lines.push(`${cleanedName},${doc.file_url}`)
      })
    }

    const fileContent = lines.join('\r\n')
    const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    const filename = `${student.full_name?.toLowerCase().replace(/\s+/g, '_')}_profile_report.csv`
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:-translate-x-0.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Back to students directory
        </Link>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200/60 rounded-2xl p-8 space-y-6 animate-pulse">
          <div className="h-24 bg-slate-100 rounded-2xl w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="h-44 bg-slate-100 rounded-2xl w-full" />
              <div className="h-64 bg-slate-100 rounded-2xl w-full" />
              <div className="h-44 bg-slate-100 rounded-2xl w-full" />
            </div>
            <div className="space-y-6">
              <div className="h-44 bg-slate-100 rounded-2xl w-full" />
              <div className="h-64 bg-slate-100 rounded-2xl w-full" />
              <div className="h-52 bg-slate-100 rounded-2xl w-full" />
            </div>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-rose-800 font-semibold shadow-sm">
          Failed to load student details: {errorMsg}
        </div>
      ) : !student ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-slate-500 font-bold shadow-sm">
          Student profile not found in directory.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Component */}
          <ProfileHeader
            student={{ ...student, displayId }}
            attendanceRate={attendanceSummary.rate}
            feeStatus={feeStatus}
            onUpdateStudent={handleUpdateStudent}
            onAddFee={handleAddFee}
            onOpenUploadDoc={() => setIsUploadOpen(true)}
            onExportReport={exportStudentReport}
            onDeleteStudent={handleDeleteStudent}
          />

          {/* Profile Symmetric 2-Column Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Left Column: Academic & Administrative details */}
            <div className="space-y-6">
              <PersonalDetailsCard
                gender={student.gender}
                dateOfBirth={student.date_of_birth}
                admissionDate={student.admission_date}
                className={student.class_name}
              />

              <AttendanceSection
                attendanceRecords={attendanceRecords}
                attendanceHistory={attendanceHistory}
                attendanceSummary={attendanceSummary}
                exportToCSV={exportToCSV}
              />

              <DocumentsSection
                documents={documents}
                onTriggerUpload={triggerFileInput}
                onUploadDocument={handleUploadDocument}
                onDeleteDocument={handleDeleteDocument}
                studentName={student.full_name ?? undefined}
                isUploading={isUploading}
              />
            </div>

            {/* Right Column: Contact details, Financial logs & History */}
            <div className="space-y-6">
              <ContactCard
                parentName={student.parent_name}
                parentPhone={student.parent_phone}
                address={student.address}
              />

              <FeesSection
                fees={fees}
                onPayFee={handlePayFee}
                onPayMultipleFees={handlePayMultipleFees}
                onOpenAddFeeModal={() => {
                  // Direct trigger to click add fee button in header
                  const buttons = document.querySelectorAll('button')
                  const addFeeBtn = Array.from(buttons).find(b => b.textContent?.includes('Add Fee'))
                  if (addFeeBtn) (addFeeBtn as HTMLButtonElement).click()
                }}
                studentName={student.full_name ?? undefined}
              />

              <ActivityTimeline
                student={student}
                attendanceRecords={attendanceRecords}
                fees={fees}
                documents={documents}
              />
            </div>

          </div>
        </div>
      )}

      {/* Hidden File Input - Always Mounted to survive browser process restarts */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      />

      {/* ================= UPLOAD DOCUMENT MODAL - Always mounted relative to DOM loading state ================= */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsUploadOpen(false)} />
            
            <div className="relative inline-block w-full max-w-sm p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                <h3 className="text-lg font-bold text-slate-900">Upload Student Document</h3>
                <button type="button" onClick={() => setIsUploadOpen(false)} className="text-slate-400 hover:text-slate-600 focus:outline-none">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleModalUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Document Type</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 text-slate-800 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer mb-3 select-none"
                  >
                    <option value="Birth Certificate">Birth Certificate</option>
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="Transfer Certificate">Transfer Certificate</option>
                    <option value="Student Photograph">Student Photograph</option>
                    <option value="Medical Record">Medical Record</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Student File</label>
                  <div 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-5 text-center cursor-pointer transition-colors animate-pulse"
                  >
                    <svg className="w-6 h-6 mx-auto text-slate-400 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {selectedFile ? (
                      <span className="text-xs font-bold text-indigo-600 truncate block max-w-xs mx-auto">
                        {selectedFile.name}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">
                        Click here to browse files
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-slate-50 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setIsUploadOpen(false)
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 focus:outline-none transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Upload Document
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
